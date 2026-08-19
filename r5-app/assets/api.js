/* =====================================================================
   R5 data + auth layer over Supabase (with an offline/demo fallback so
   the app still renders without a network or config).
     window.R5AUTH — Google/email sign-in, session, admin flag, delete.
     window.R5API  — events, photos, chat (realtime), admin writes.
   ===================================================================== */
(function (g) {
  "use strict";
  var cfg = g.R5CONFIG;
  var sb = (cfg && cfg.url && cfg.key && g.supabase && g.supabase.createClient)
    ? g.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
    : null;

  // ------------------------------------------------------------------ //
  function mapEvent(r) {
    var past = r.archived || (r.starts_at ? new Date(r.ends_at || r.starts_at) < new Date() : false);
    return { id: r.id, slug: r.slug || r.id, kicker: r.kicker, title: r.title, starts_at: r.starts_at,
      ends_at: r.ends_at, dateLabel: r.date_label, location: r.location, grad: r.grad,
      cover_url: r.cover_url, about: r.about || "", tag: r.tag, archived: !!r.archived, past: past };
  }
  function profileOf(u) {
    if (!u) return null; var m = u.user_metadata || {};
    return { id: u.id, name: m.full_name || m.name || (u.email ? u.email.split("@")[0] : "Tânăr R5"),
      avatar: m.avatar_url || m.picture || null, email: u.email || null };
  }
  // downscale a photo in the browser before upload (saves storage + data)
  function resizeImage(file, maxDim, quality) {
    return new Promise(function (resolve) {
      if (!/^image\//.test(file.type) || typeof document === "undefined") { resolve(file); return; }
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, maxDim / Math.max(img.width, img.height));
        var cw = Math.round(img.width * s), ch = Math.round(img.height * s);
        var c = document.createElement("canvas"); c.width = cw; c.height = ch;
        c.getContext("2d").drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { resolve(b || file); }, "image/jpeg", quality || 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  var CLOUD = (cfg && cfg.cloudinary) || {};
  function cloudReady() { return !!(CLOUD.cloudName && CLOUD.uploadPreset); }

  // ---- AUTH -------------------------------------------------------- //
  var listeners = [], _user = null, _admin = false;
  function notify() { var p = profileOf(_user); listeners.forEach(function (f) { try { f(p, _admin); } catch (e) {} }); try { registerPush(); } catch (e) {} }

  // ---- push notifications (native only) --------------------------- //
  var _pushToken = null;
  function pushPref() { try { return localStorage.getItem("r5-notif"); } catch (e) { return null; } }
  function setPushPref(v) { try { localStorage.setItem("r5-notif", v); } catch (e) {} }
  function pushPlugin() { var C = g.Capacitor; return C && C.Plugins && C.Plugins.PushNotifications; }
  function pushSupported() { var C = g.Capacitor; return !!(C && C.isNativePlatform && C.isNativePlatform() && pushPlugin()); }
  function registerPush() {
    if (!sb || !_user || !pushSupported()) return;
    if (pushPref() === "off") return;            // user turned notifications off
    var PN = pushPlugin();
    if (!registerPush._bound) {
      registerPush._bound = true;
      PN.addListener("registration", function (t) {
        var token = t && t.value; if (!token || !_user) return;
        _pushToken = token;
        sb.from("r5_push_tokens").upsert(
          { token: token, user_id: _user.id, platform: "android", updated_at: new Date().toISOString() },
          { onConflict: "token" }
        ).then(function () {}, function () {});
      });
      PN.addListener("pushNotificationActionPerformed", function (ev) {
        try { var url = ev && ev.notification && ev.notification.data && ev.notification.data.url; if (url) location.hash = url; } catch (e) {}
      });
      PN.addListener("registrationError", function (err) { try { localStorage.setItem("r5-push-err", JSON.stringify(err)); } catch (e) {} });
    }
    // Ask for display permission, but register for a token regardless —
    // the FCM token is available even before the notification permission.
    PN.requestPermissions().catch(function () {});
    PN.register().catch(function () {});
  }
  function refreshAdmin() {
    if (!sb || !_user) { _admin = false; return Promise.resolve(); }
    return sb.from("r5_admins").select("user_id").eq("user_id", _user.id).maybeSingle()
      .then(function (r) { _admin = !!(r && r.data); }).catch(function () { _admin = false; });
  }
  if (sb) {
    sb.auth.getSession().then(function (res) { _user = res.data.session ? res.data.session.user : null; return refreshAdmin(); }).then(notify);
    sb.auth.onAuthStateChange(function (_e, session) { _user = session ? session.user : null; refreshAdmin().then(notify); });
  }

  // ---- native (Capacitor) Google sign-in --------------------------- //
  var CAP = g.Capacitor;
  function isNative() { return !!(CAP && CAP.isNativePlatform && CAP.isNativePlatform()); }
  function socialPlugin() { return CAP && CAP.Plugins && CAP.Plugins.SocialLogin; }
  function errStr(e) { if (!e) return "necunoscut"; return e.message || e.errorMessage || e.error_description || e.error || e.code || (typeof e === "string" ? e : JSON.stringify(e)); }
  function nativeGoogle() {
    var SL = socialPlugin();
    if (!SL) return Promise.resolve({ ok: false, error: "Pluginul SocialLogin nu e încărcat" });
    if (!cfg.googleWebClientId) return Promise.resolve({ ok: false, error: "Lipsește googleWebClientId" });
    return SL.initialize({ google: { webClientId: cfg.googleWebClientId } })
      .catch(function (e) { throw new Error("initialize: " + errStr(e)); })
      .then(function () { return SL.login({ provider: "google", options: {} }); })
      .then(function (res) {
        var r = (res && res.result) || {};
        var idToken = r.idToken || (r.accessToken && r.accessToken.token) || null;
        if (!idToken) return { ok: false, error: "Google nu a returnat idToken" };
        return sb.auth.signInWithIdToken({ provider: "google", token: idToken }).then(function (rr) {
          if (!rr.error) { _user = rr.data.user; refreshAdmin().then(notify); }
          return { ok: !rr.error, error: rr.error ? ("Supabase: " + errStr(rr.error)) : null };
        });
      })
      .catch(function (e) { return { ok: false, error: errStr(e) }; });
  }

  g.R5AUTH = {
    ready: !!sb,
    user: function () { return profileOf(_user); },
    isAdmin: function () { return _admin; },
    onChange: function (cb) { listeners.push(cb); cb(profileOf(_user), _admin); },
    signInWithGoogle: function () {
      if (!sb) return Promise.resolve({ ok: false, code: "nosb" });
      if (isNative()) return nativeGoogle();
      return sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
    },
    signInWithEmail: function (email) {
      if (!sb) return Promise.resolve({ ok: false, code: "nosb" });
      return sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.origin + location.pathname } })
        .then(function (r) { return { ok: !r.error, error: r.error }; });
    },
    logout: function () {
      if (!sb) return Promise.resolve();
      if (isNative()) { var SL = socialPlugin(); if (SL && SL.logout) { try { SL.logout({ provider: "google" }); } catch (e) {} } }
      return sb.auth.signOut();
    },
    // ---- notification preference ----
    pushSupported: function () { return pushSupported(); },
    pushEnabled: function () { return pushPref() !== "off"; },
    enablePush: function () { setPushPref("on"); registerPush(); return Promise.resolve(true); },
    disablePush: function () {
      setPushPref("off");
      if (sb && _user) return sb.from("r5_push_tokens").delete().eq("user_id", _user.id).then(function () { _pushToken = null; return true; }, function () { return true; });
      return Promise.resolve(true);
    },
    deleteAccount: function () {
      if (!sb) return Promise.resolve();
      return sb.auth.getSession().then(function (res) {
        var sess = res.data.session; if (!sess) return;
        return fetch(cfg.url + "/functions/v1/delete-account", {
          method: "POST", headers: { Authorization: "Bearer " + sess.access_token, apikey: cfg.key, "Content-Type": "application/json" }
        }).then(function (r) { return r.json().catch(function () { return {}; }); })
          .then(function () { return sb.auth.signOut(); })
          .then(function () { location.reload(); });
      });
    }
  };

  // ---- DATA -------------------------------------------------------- //
  function demoEvents() {
    return (g.R5DATA ? g.R5DATA.events : []).map(function (e) {
      return { id: e.id, slug: e.id, kicker: e.kicker, title: e.title, starts_at: e.start, dateLabel: e.dateLabel,
        location: e.location, grad: e.grad, cover_url: null, about: e.about || "", tag: e.tag, past: !!e.past };
    });
  }

  g.R5API = {
    demo: !sb,
    getEvents: function () {
      if (!sb) return Promise.resolve(demoEvents());
      return sb.from("r5_events").select("*").then(function (r) { return (r.data || []).map(mapEvent); });
    },
    getPhotos: function (eventId) {
      if (!sb) return Promise.resolve([]);
      return sb.from("r5_photos").select("id,url,uploaded_by").eq("event_id", eventId).order("created_at", { ascending: false })
        .then(function (r) { return r.data || []; });
    },
    getMessages: function (eventId) {
      if (!sb) return Promise.resolve([]);
      return sb.from("r5_messages").select("*").eq("event_id", eventId).order("created_at", { ascending: true }).limit(300)
        .then(function (r) { return r.data || []; });
    },
    sendMessage: function (eventId, body) {
      if (!sb) return Promise.resolve({ ok: false, code: "nosb" });
      if (!_user) return Promise.resolve({ ok: false, code: "auth" });
      var p = profileOf(_user);
      return sb.from("r5_messages").insert({ event_id: eventId, user_id: p.id, author_name: p.name, author_avatar: p.avatar, body: body })
        .then(function (r) { return { ok: !r.error, error: r.error }; });
    },
    subscribeMessages: function (eventId, cb) {
      if (!sb) return function () {};
      var ch = sb.channel("msg-" + eventId)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "r5_messages", filter: "event_id=eq." + eventId }, function (payload) { cb(payload.new); })
        .subscribe();
      return function () { sb.removeChannel(ch); };
    },
    deleteMessage: function (id) { if (!sb) return Promise.resolve(); return sb.from("r5_messages").delete().eq("id", id); },

    // ----- admin -----
    saveEvent: function (ev) {
      if (!sb) return Promise.resolve({ ok: false });
      var row = { slug: ev.slug || null, kicker: ev.kicker || null, title: ev.title, starts_at: ev.starts_at || null,
        ends_at: ev.ends_at || null, date_label: ev.dateLabel || null, location: ev.location || null,
        about: ev.about || null, grad: ev.grad || null, cover_url: ev.cover_url || null, tag: ev.tag || null, archived: !!ev.archived };
      var q = ev.id ? sb.from("r5_events").update(row).eq("id", ev.id) : sb.from("r5_events").insert(row);
      return q.then(function (r) { return { ok: !r.error, error: r.error }; });
    },
    deleteEvent: function (id) { if (!sb) return Promise.resolve({ ok: false }); return sb.from("r5_events").delete().eq("id", id).then(function (r) { return { ok: !r.error, error: r.error }; }); },
    photoUploads: cloudReady,
    uploadPhoto: function (eventId, file) {
      if (!sb) return Promise.resolve({ ok: false, code: "nosb" });
      if (!_user) return Promise.resolve({ ok: false, code: "auth" });
      if (!cloudReady()) return Promise.resolve({ ok: false, code: "nocloud" });
      return resizeImage(file, 1600, 0.82).then(function (blob) {
        var fd = new FormData();
        // unique filename → unique Cloudinary public_id (preset has Unique filename off)
        fd.append("file", blob, "r5_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8) + ".jpg");
        fd.append("upload_preset", CLOUD.uploadPreset);
        // no folder param: unsigned presets can reject it, and the account uses
        // dynamic folders — the preset's own folder setting handles placement.
        return fetch("https://api.cloudinary.com/v1_1/" + CLOUD.cloudName + "/image/upload", { method: "POST", body: fd })
          .then(function (r) { return r.json(); })
          .then(function (up) {
            if (!up || !up.secure_url) return { ok: false, error: up && up.error };
            return sb.from("r5_photos").insert({ event_id: eventId, url: up.secure_url, storage_path: up.public_id, uploaded_by: _user.id })
              .then(function (r) { return { ok: !r.error, url: up.secure_url, error: r.error }; });
          });
      });
    },
    deletePhoto: function (id) { if (!sb) return Promise.resolve(); return sb.from("r5_photos").delete().eq("id", id); }
  };
})(window);
