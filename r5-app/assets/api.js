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

  // ---- AUTH -------------------------------------------------------- //
  var listeners = [], _user = null, _admin = false;
  function notify() { var p = profileOf(_user); listeners.forEach(function (f) { try { f(p, _admin); } catch (e) {} }); }
  function refreshAdmin() {
    if (!sb || !_user) { _admin = false; return Promise.resolve(); }
    return sb.from("r5_admins").select("user_id").eq("user_id", _user.id).maybeSingle()
      .then(function (r) { _admin = !!(r && r.data); }).catch(function () { _admin = false; });
  }
  if (sb) {
    sb.auth.getSession().then(function (res) { _user = res.data.session ? res.data.session.user : null; return refreshAdmin(); }).then(notify);
    sb.auth.onAuthStateChange(function (_e, session) { _user = session ? session.user : null; refreshAdmin().then(notify); });
  }

  g.R5AUTH = {
    ready: !!sb,
    user: function () { return profileOf(_user); },
    isAdmin: function () { return _admin; },
    onChange: function (cb) { listeners.push(cb); cb(profileOf(_user), _admin); },
    signInWithGoogle: function () {
      if (!sb) return Promise.resolve({ ok: false, code: "nosb" });
      return sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
    },
    signInWithEmail: function (email) {
      if (!sb) return Promise.resolve({ ok: false, code: "nosb" });
      return sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.origin + location.pathname } })
        .then(function (r) { return { ok: !r.error, error: r.error }; });
    },
    logout: function () { if (!sb) return Promise.resolve(); return sb.auth.signOut(); },
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
      return sb.from("r5_photos").select("id,url").eq("event_id", eventId).order("created_at", { ascending: false })
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
    uploadPhoto: function (eventId, file) {
      if (!sb) return Promise.resolve({ ok: false });
      var ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      var path = eventId + "/" + Date.now() + "_" + Math.random().toString(36).slice(2, 8) + "." + ext;
      return sb.storage.from("event-photos").upload(path, file, { cacheControl: "3600", upsert: false }).then(function (up) {
        if (up.error) return { ok: false, error: up.error };
        var url = sb.storage.from("event-photos").getPublicUrl(path).data.publicUrl;
        return sb.from("r5_photos").insert({ event_id: eventId, url: url, storage_path: path, uploaded_by: _user ? _user.id : null })
          .then(function (r) { return { ok: !r.error, url: url, error: r.error }; });
      });
    },
    deletePhoto: function (id) { if (!sb) return Promise.resolve(); return sb.from("r5_photos").delete().eq("id", id); }
  };
})(window);
