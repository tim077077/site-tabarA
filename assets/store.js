/* =====================================================================
   Store — data layer. Two interchangeable backends, one async API:
     • Supabase — live site. Identity is verified by phone; every write
       carries a per-user token, so nobody can act as someone else.
     • Demo — localStorage fallback (offline/preview) with seed data.
   Session ({id, token, name, gender}) is kept in localStorage.
   ===================================================================== */
(function (global) {
  "use strict";

  function delay(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 60); }); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function uid() { return "id_" + Math.random().toString(36).slice(2, 10); }
  var SKEY = "corturi.session";
  function readSession() { try { return JSON.parse(localStorage.getItem(SKEY) || "null"); } catch (e) { return null; } }
  function writeSession(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) {} }
  function clearSession() { try { localStorage.removeItem(SKEY); } catch (e) {} }

  /* ================================================================= *
   *  SUPABASE BACKEND                                                 *
   * ================================================================= */
  function makeSupabaseStore(cfg) {
    var sb = global.supabase.createClient(cfg.url, cfg.key);
    function stashPin(p) { try { sessionStorage.setItem("corturi.pin", p); } catch (e) {} }
    function getPin() { try { return sessionStorage.getItem("corturi.pin") || ""; } catch (e) { return ""; } }

    function buildTents(tents, assigns, people, invites, gender) {
      var pmap = {}; people.forEach(function (p) { pmap[p.id] = p; });
      var byTent = {}; assigns.forEach(function (a) { (byTent[a.tent_id] = byTent[a.tent_id] || []).push(a.participant_id); });
      var invByTent = {}; (invites || []).forEach(function (i) { (invByTent[i.tent_id] = invByTent[i.tent_id] || []).push(i); });
      return tents.filter(function (t) { return !gender || t.gender === gender; }).map(function (t) {
        var occ = (byTent[t.id] || []).map(function (id) { return { id: id, name: (pmap[id] || {}).name || "?" }; });
        var pending = invByTent[t.id] || [];
        var inv = pending.filter(function (i) { return (i.kind || "invite") === "invite"; }).map(function (i) {
          return { inviteId: i.id, id: i.invitee_id, name: (pmap[i.invitee_id] || {}).name || "?", inviterName: (pmap[i.inviter_id] || {}).name || "?", kind: "invite" };
        });
        var joinReqs = pending.filter(function (i) { return i.kind === "join_request"; }).map(function (i) {
          return { inviteId: i.id, id: i.invitee_id, name: (pmap[i.invitee_id] || {}).name || "?", kind: "join_request" };
        });
        var reserved = inv.length + joinReqs.length;
        var filled = occ.length + reserved;
        var leaderId = t.leader_id || t.created_by;
        return { id: t.id, number: t.number, name: t.name, gender: t.gender, capacity: t.capacity, createdBy: t.created_by,
          createdByName: (pmap[t.created_by] || {}).name || "?", leaderId: leaderId,
          leaderName: (pmap[leaderId] || {}).name || "?", createdAt: new Date(t.created_at).getTime(),
          occupants: occ, invited: inv, joinRequests: joinReqs, occupied: occ.length, reserved: reserved, filled: filled, free: t.capacity - filled };
      }).sort(function (a, b) { return a.createdAt - b.createdAt; });
    }
    function fetchAll() {
      return Promise.all([
        sb.from("camp_tents").select("id,number,name,gender,capacity,created_by,leader_id,created_at"),
        sb.from("camp_assignments").select("participant_id,tent_id"),
        sb.from("camp_participants").select("id,name,gender"),
        sb.from("camp_invites").select("id,tent_id,invitee_id,inviter_id,kind").eq("status", "pending")
      ]).then(function (r) { return { tents: r[0].data || [], assigns: r[1].data || [], people: r[2].data || [], invites: r[3].data || [] }; });
    }
    function rpc(fn, args) { return sb.rpc(fn, args).then(function (r) { return r.error ? { ok: false, code: "net", message: "Eroare de rețea. Încearcă din nou." } : r.data; }); }
    function authArgs(extra) { var s = readSession(); return Object.assign({ p_actor: s ? s.id : null, p_token: s ? s.token : null }, extra || {}); }
    function adminRpc(fn, args) { var pin = getPin(); if (!pin) return delay({ ok: false, code: "pin" }); return rpc(fn, Object.assign({ p_pin: pin }, args || {})); }

    return {
      backend: "supabase",
      init: function () { return Promise.resolve(); },
      session: readSession, logout: function () { clearSession(); return delay({ ok: true }); },

      getSettings: function () { return rpc("get_public_settings", {}).then(function (d) { d = d || {}; return { eventName: d.event_name || "Tabără", bookingOpen: d.booking_open !== false, cap3Total: d.cap3_total || 6, cap4Total: d.cap4_total || 24 }; }); },
      getParticipants: function () {
        return Promise.all([sb.from("camp_participants").select("id,name,gender"), sb.from("camp_assignments").select("participant_id,tent_id")]).then(function (r) {
          var amap = {}; (r[1].data || []).forEach(function (a) { amap[a.participant_id] = a.tent_id; });
          return (r[0].data || []).map(function (p) { return { id: p.id, name: p.name, gender: p.gender, tentId: amap[p.id] || null }; }).sort(function (a, b) { return a.name.localeCompare(b.name, "ro"); });
        });
      },
      getParticipant: function (id) { return this.getParticipants().then(function (l) { return l.find(function (p) { return p.id === id; }) || null; }); },
      getTents: function (gender) { return fetchAll().then(function (d) { return buildTents(d.tents, d.assigns, d.people, d.invites, gender); }); },
      getTent: function (id) { return fetchAll().then(function (d) { return buildTents(d.tents, d.assigns, d.people, d.invites).find(function (t) { return t.id === id; }) || null; }); },

      verifyIdentity: function (participantId, phone) {
        return rpc("verify_identity", { p_id: participantId, p_phone: String(phone || "") }).then(function (d) {
          if (d && d.ok) { var s = { id: participantId, token: d.token, name: d.name, gender: d.gender }; writeSession(s); return { ok: true, session: s }; }
          return { ok: false, code: (d && d.code) || "net" };
        });
      },
      createTent: function (capacity, name, inviteIds) {
        var self = this;
        return rpc("create_tent", authArgs({ p_capacity: capacity, p_name: name || null, p_invite: inviteIds || [] }))
          .then(function (r) { if (!r || !r.ok) return r || { ok: false }; return self.getTent(r.tent_id).then(function (t) { return { ok: true, tent: t }; }); });
      },
      joinTent: function (tentId) {
        var self = this;
        return rpc("join_tent", authArgs({ p_tent: tentId })).then(function (r) {
          if (!r || !r.ok) return r || { ok: false };
          return self.getTent(r.tent_id).then(function (t) {
            return { ok: true, requested: !!r.requested, tent: t };
          });
        });
      },
      inviteToTent: function (tentId, inviteeId) { return rpc("invite_to_tent", authArgs({ p_tent: tentId, p_invitee: inviteeId })); },
      cancelInvite: function (inviteId) { return rpc("cancel_invite", authArgs({ p_invite: inviteId })); },
      adminCancelInvite: function (inviteId) { return adminRpc("admin_cancel_invite", { p_invite: inviteId }); },
      respondInvite: function (inviteId, accept) {
        var self = this;
        return rpc("respond_invite", authArgs({ p_invite: inviteId, p_accept: !!accept })).then(function (r) {
          if (r && r.ok && r.tent_id) return self.getTent(r.tent_id).then(function (t) { return { ok: true, tent: t }; });
          return r || { ok: false };
        });
      },
      removeFromTent: function (tentId, memberId) {
        return rpc("remove_from_tent", authArgs({ p_tent: tentId, p_member: memberId }));
      },
      getMyInvites: function () {
        return rpc("get_my_invites", authArgs()).then(function (r) {
          if (!r || !r.ok) return [];
          return (r.invites || []).map(function (x) {
            return { inviteId: x.invite_id, tentId: x.tent_id, tentName: x.tent_name, gender: x.gender, capacity: x.capacity, occupied: x.occupied, free: x.capacity - x.occupied, inviterName: x.inviter_name, createdByName: x.created_by_name };
          });
        });
      },
      leave: function () { return rpc("leave_tent", authArgs()).then(function (r) { return r || { ok: false }; }); },
      createRequest: function (ids, note) { return rpc("create_request", authArgs({ p_ids: ids || [], p_note: note || "" })); },

      // admin
      verifyPin: function (pin) { return sb.rpc("admin_verify", { p_pin: String(pin) }).then(function (r) { var ok = r.data && r.data.ok; if (ok) stashPin(String(pin)); return !!ok; }); },
      addParticipants: function (rows) { return adminRpc("admin_add_participants", { p_rows: rows }); },
      deleteParticipant: function (id) { return adminRpc("admin_delete_participant", { p_id: id }); },
      setGender: function (id, g) { return adminRpc("admin_set_gender", { p_id: id, p_gender: g }); },
      setPhone: function (id, phone) { return adminRpc("admin_set_phone", { p_id: id, p_phone: phone }); },
      deleteTent: function (id) { return adminRpc("admin_delete_tent", { p_id: id }); },
      setBookingOpen: function (v) { return adminRpc("admin_set_booking", { p_open: !!v }); },
      setEventName: function (name) { return adminRpc("admin_set_event_name", { p_name: name }); },
      setPin: function (newPin) { return adminRpc("admin_set_pin", { p_new: String(newPin) }).then(function (r) { if (r && r.ok) stashPin(String(newPin)); return r; }); },
      forceAssign: function (pid, tentId) { return adminRpc("admin_force_assign", { p_pid: pid, p_tent: tentId }); },
      listRequests: function () { return adminRpc("admin_list_requests", {}).then(function (r) { return (r && r.ok && r.requests) ? r.requests.map(function (x) { return { id: x.id, requester: x.requester, people: x.people || [], note: x.note, createdAt: Number(x.created_at) }; }) : []; }); },
      resolveRequest: function (id, approve) { return adminRpc("admin_resolve_request", { p_id: id, p_approve: !!approve }); },
      resetAssignments: function () { return adminRpc("admin_reset_tents", {}); },
      _reseed: function () { return delay({ ok: true }); }
    };
  }

  /* ================================================================= *
   *  DEMO BACKEND (localStorage, no real auth)                        *
   * ================================================================= */
  function makeDemoStore() {
    var KEY = "corturi.v3", DEFAULT_PIN = "1234", db = null;
    function seed() {
      var boys = ["Andrei", "Mihai", "Ștefan", "David", "Luca", "Rareș", "Vlad", "Matei", "Darius", "Cosmin", "Robert", "Ionuț", "Alex", "Cristi"];
      var girls = ["Maria", "Ioana", "Andreea", "Elena", "Sofia", "Daria", "Bianca", "Alexandra", "Gabriela", "Teodora", "Larisa", "Ana", "Delia"];
      var participants = [];
      boys.forEach(function (n) { participants.push({ id: uid(), name: n, gender: "M", tentId: null }); });
      girls.forEach(function (n) { participants.push({ id: uid(), name: n, gender: "F", tentId: null }); });
      function bn(n) { return participants.find(function (p) { return p.name === n; }); }
      var t1 = { id: uid(), number: 1, name: null, gender: "M", capacity: 4, createdBy: bn("Andrei").id, leaderId: bn("Andrei").id, createdAt: Date.now() - 6000 };
      var t2 = { id: uid(), number: 2, name: "Zânele", gender: "F", capacity: 4, createdBy: bn("Maria").id, leaderId: bn("Maria").id, createdAt: Date.now() - 3000 };
      bn("Andrei").tentId = t1.id; bn("Mihai").tentId = t1.id; bn("Maria").tentId = t2.id; bn("Ioana").tentId = t2.id;
      return { settings: { eventName: "Tabăra Făgăraș", bookingOpen: true, pin: DEFAULT_PIN }, participants: participants, tents: [t1, t2], requests: [], invites: [] };
    }
    function load() { if (db) return db; try { var raw = localStorage.getItem(KEY); db = raw ? JSON.parse(raw) : seed(); } catch (e) { db = seed(); } if (!db.invites) db.invites = []; db.tents.forEach(function (t) { if (!t.leaderId) t.leaderId = t.createdBy; }); db.invites.forEach(function (i) { if (!i.kind) i.kind = "invite"; }); return db; }
    function save() { localStorage.setItem(KEY, JSON.stringify(db)); }
    function nameOf(id) { var p = db.participants.find(function (x) { return x.id === id; }); return p ? p.name : "?"; }
    function P(id) { return db.participants.find(function (x) { return x.id === id; }); }
    function tentStatus(t) {
      var occ = db.participants.filter(function (p) { return p.tentId === t.id; }).map(function (p) { return { id: p.id, name: p.name }; });
      var pending = db.invites.filter(function (i) { return i.tentId === t.id && i.status === "pending"; });
      var inv = pending.filter(function (i) { return (i.kind || "invite") === "invite"; }).map(function (i) { return { inviteId: i.id, id: i.inviteeId, name: nameOf(i.inviteeId), inviterName: nameOf(i.inviterId), kind: "invite" }; });
      var joinReqs = pending.filter(function (i) { return i.kind === "join_request"; }).map(function (i) { return { inviteId: i.id, id: i.inviteeId, name: nameOf(i.inviteeId), kind: "join_request" }; });
      var reserved = inv.length + joinReqs.length;
      var filled = occ.length + reserved;
      var leaderId = t.leaderId || t.createdBy;
      return { id: t.id, number: t.number, name: t.name, gender: t.gender, capacity: t.capacity, createdBy: t.createdBy, createdByName: nameOf(t.createdBy), leaderId: leaderId, leaderName: nameOf(leaderId), createdAt: t.createdAt || 0, occupants: occ, invited: inv, joinRequests: joinReqs, occupied: occ.length, reserved: reserved, filled: filled, free: t.capacity - filled }; }
    function tentFilled(tid) { return db.participants.filter(function (p) { return p.tentId === tid; }).length + db.invites.filter(function (i) { return i.tentId === tid && i.status === "pending"; }).length; }
    function prune(tid) { if (!db.participants.some(function (p) { return p.tentId === tid; })) { db.tents = db.tents.filter(function (t) { return t.id !== tid; }); db.invites = db.invites.filter(function (i) { return i.tentId !== tid; }); } }
    function transferLeader(tid, leavingId) {
      var t = db.tents.find(function (x) { return x.id === tid; }); if (!t) return null;
      if (t.leaderId !== leavingId) return null;
      var remaining = db.participants.filter(function (p) { return p.tentId === tid; });
      if (!remaining.length) return null;
      // oldest: first in participants array among remaining is unstable; use order of existing occupants by appearance — demo uses first remaining
      t.leaderId = remaining[0].id;
      return remaining[0];
    }
    function meId() { var s = readSession(); return s ? s.id : null; }

    return {
      backend: "demo",
      init: function () { load(); return Promise.resolve(); },
      session: readSession, logout: function () { clearSession(); return delay({ ok: true }); },
      getSettings: function () { load(); return delay({ eventName: db.settings.eventName, bookingOpen: db.settings.bookingOpen, cap3Total: db.settings.cap3Total || 6, cap4Total: db.settings.cap4Total || 24 }); },
      getParticipants: function () { load(); return delay(clone(db.participants).sort(function (a, b) { return a.name.localeCompare(b.name, "ro"); })); },
      getParticipant: function (id) { load(); var p = P(id); return delay(p ? clone(p) : null); },
      getTents: function (gender) { load(); return delay(db.tents.filter(function (t) { return !gender || t.gender === gender; }).map(tentStatus).sort(function (a, b) { return a.createdAt - b.createdAt; })); },
      getTent: function (id) { load(); var t = db.tents.find(function (x) { return x.id === id; }); return delay(t ? tentStatus(t) : null); },

      verifyIdentity: function (participantId) { load(); var p = P(participantId); if (!p) return delay({ ok: false, code: "bad" }); var s = { id: p.id, token: "demo", name: p.name, gender: p.gender }; writeSession(s); return delay({ ok: true, session: s }); },
      createTent: function (capacity, name, inviteIds) {
        load(); if (!db.settings.bookingOpen) return delay({ ok: false, code: "closed", message: "Înscrierile sunt închise momentan." });
        var me = P(meId()); if (!me) return delay({ ok: false, code: "auth" });
        if (me.tentId) return delay({ ok: false, code: "taken", message: "Ești deja într-un cort." });
        capacity = parseInt(capacity, 10);
        if (capacity !== 3 && capacity !== 4) return delay({ ok: false, code: "bad_cap", message: "Corturile sunt doar de 3 sau 4 persoane." });
        var lim = capacity === 3 ? (db.settings.cap3Total || 6) : (db.settings.cap4Total || 24);
        if (db.tents.filter(function (t) { return t.capacity === capacity; }).length >= lim) return delay({ ok: false, code: "no_tents", message: "Nu mai sunt corturi de " + capacity + " libere." });
        var maxNum = db.tents.reduce(function (m, x) { return Math.max(m, x.number || 0); }, 0);
        var t = { id: uid(), number: maxNum + 1, name: (name || "").trim() || null, gender: me.gender, capacity: capacity, createdBy: me.id, leaderId: me.id, createdAt: Date.now() };
        db.tents.push(t); me.tentId = t.id;
        db.invites.forEach(function (i) { if (i.inviteeId === me.id && i.status === "pending") i.status = "declined"; });
        var slots = capacity - 1;
        (inviteIds || []).forEach(function (iid) {
          if (slots <= 0) return;
          var q = P(iid);
          if (q && q.id !== me.id && q.gender === me.gender && !q.tentId && !db.invites.some(function (i) { return i.inviteeId === iid && i.status === "pending"; })) { db.invites.push({ id: uid(), tentId: t.id, inviteeId: iid, inviterId: me.id, status: "pending", kind: "invite" }); slots--; }
        });
        save(); return delay({ ok: true, tent: tentStatus(t) });
      },
      joinTent: function (tentId) {
        load(); if (!db.settings.bookingOpen) return delay({ ok: false, code: "closed", message: "Înscrierile sunt închise momentan." });
        var t = db.tents.find(function (x) { return x.id === tentId; }); if (!t) return delay({ ok: false, code: "no_tent", message: "Cortul nu mai există." });
        var me = P(meId()); if (!me) return delay({ ok: false, code: "auth" });
        if (me.gender !== t.gender) return delay({ ok: false, code: "gender", message: "Cortul e pentru celălalt gen." });
        if (me.tentId) return delay({ ok: false, code: "taken", message: "Ești deja într-un cort." });
        if (db.invites.some(function (i) { return i.inviteeId === me.id && i.tentId === tentId && i.status === "pending" && i.kind === "join_request"; }))
          return delay({ ok: false, code: "pending", message: "Ai deja o cerere în așteptare pentru acest cort." });
        if (db.invites.some(function (i) { return i.inviteeId === me.id && i.status === "pending"; }))
          return delay({ ok: false, code: "pending", message: "Ai deja o invitație sau cerere în așteptare." });
        if (tentFilled(tentId) >= t.capacity) return delay({ ok: false, code: "no_space", message: "Nu mai sunt locuri în acest cort." });
        db.invites.push({ id: uid(), tentId: tentId, inviteeId: me.id, inviterId: me.id, status: "pending", kind: "join_request" });
        save(); return delay({ ok: true, requested: true, tent: tentStatus(t) });
      },
      inviteToTent: function (tentId, inviteeId) {
        load(); var me = P(meId()); var t = db.tents.find(function (x) { return x.id === tentId; }); if (!me || !t) return delay({ ok: false });
        if ((t.leaderId || t.createdBy) !== me.id) return delay({ ok: false, code: "notleader", message: "Doar liderul cortului poate invita." });
        var q = P(inviteeId); if (!q || q.gender !== t.gender) return delay({ ok: false, code: "gender", message: "Persoana nu se potrivește." });
        if (q.tentId) return delay({ ok: false, code: "taken", message: "Persoana e deja într-un cort." });
        if (db.invites.some(function (i) { return i.inviteeId === inviteeId && i.status === "pending"; })) return delay({ ok: false, code: "invited", message: "Persoana are deja o invitație în așteptare." });
        if (tentFilled(tentId) >= t.capacity) return delay({ ok: false, code: "no_space", message: "Cortul e plin (cu tot cu invitațiile)." });
        db.invites.push({ id: uid(), tentId: tentId, inviteeId: inviteeId, inviterId: me.id, status: "pending", kind: "invite" });
        save(); return delay({ ok: true });
      },
      respondInvite: function (inviteId, accept) {
        load(); var inv = db.invites.find(function (i) { return i.id === inviteId; }); var me = P(meId());
        if (!inv || !me || inv.status !== "pending") return delay({ ok: false, code: "gone", message: "Cererea nu mai e valabilă." });
        var t = db.tents.find(function (x) { return x.id === inv.tentId; });
        if ((inv.kind || "invite") === "join_request") {
          if (!t || (t.leaderId || t.createdBy) !== me.id) return delay({ ok: false, code: "forbidden", message: "Doar liderul poate răspunde la cereri." });
          if (!accept) { inv.status = "declined"; save(); return delay({ ok: true, declined: true }); }
          var who = P(inv.inviteeId);
          if (!who || who.tentId) { inv.status = "declined"; save(); return delay({ ok: false, code: "taken", message: "Persoana e deja într-un cort." }); }
          var others = db.invites.filter(function (i) { return i.tentId === t.id && i.status === "pending" && i.id !== inv.id; }).length;
          var occN = db.participants.filter(function (p) { return p.tentId === t.id; }).length;
          if (occN + others >= t.capacity) return delay({ ok: false, code: "no_space", message: "Nu mai sunt locuri în acest cort." });
          who.tentId = t.id; inv.status = "accepted";
          db.invites.forEach(function (i) { if (i.inviteeId === who.id && i.status === "pending") i.status = "declined"; });
          save(); return delay({ ok: true, tent: tentStatus(t) });
        }
        if (inv.inviteeId !== me.id) return delay({ ok: false, code: "gone", message: "Invitația nu mai e valabilă." });
        if (!accept) { inv.status = "declined"; save(); return delay({ ok: true, declined: true }); }
        if (me.tentId) return delay({ ok: false, code: "taken", message: "Ești deja într-un cort. Ieși întâi." });
        if (!t) { inv.status = "declined"; save(); return delay({ ok: false, code: "no_tent", message: "Cortul nu mai există." }); }
        me.tentId = t.id; inv.status = "accepted";
        db.invites.forEach(function (i) { if (i.inviteeId === me.id && i.status === "pending") i.status = "declined"; });
        save(); return delay({ ok: true, tent: tentStatus(t) });
      },
      cancelInvite: function (inviteId) {
        load(); var inv = db.invites.find(function (i) { return i.id === inviteId && i.status === "pending"; }); var m = P(meId());
        if (!inv) return delay({ ok: true });
        var t = db.tents.find(function (x) { return x.id === inv.tentId; });
        var isLeader = t && m && (t.leaderId || t.createdBy) === m.id;
        if (inv.inviteeId !== (m && m.id) && !isLeader) return delay({ ok: false, code: "forbidden" });
        inv.status = "declined"; save(); return delay({ ok: true });
      },
      adminCancelInvite: function (inviteId) { load(); var inv = db.invites.find(function (i) { return i.id === inviteId && i.status === "pending"; }); if (inv) inv.status = "declined"; save(); return delay({ ok: true }); },
      getMyInvites: function () {
        load(); var mid = meId();
        return delay(db.invites.filter(function (i) { return i.inviteeId === mid && i.status === "pending" && (i.kind || "invite") === "invite"; }).map(function (i) {
          var t = db.tents.find(function (x) { return x.id === i.tentId; }); if (!t) return null;
          var occ = db.participants.filter(function (p) { return p.tentId === t.id; }).length;
          return { inviteId: i.id, tentId: t.id, tentName: t.name, gender: t.gender, capacity: t.capacity, occupied: occ, free: t.capacity - occ, inviterName: nameOf(i.inviterId), createdByName: nameOf(t.createdBy) };
        }).filter(Boolean));
      },
      removeFromTent: function (tentId, memberId) {
        load(); var me = P(meId()); var t = db.tents.find(function (x) { return x.id === tentId; });
        if (!me || !t || (t.leaderId || t.createdBy) !== me.id) return delay({ ok: false, code: "notleader", message: "Doar liderul poate scoate pe cineva." });
        if (memberId === me.id) return delay({ ok: false, code: "self", message: "Folosește Ieși din cort pentru tine." });
        var p = P(memberId); if (p && p.tentId === tentId) p.tentId = null;
        save(); return delay({ ok: true });
      },
      leave: function () {
        load(); var me = P(meId()); if (!me || !me.tentId) return delay({ ok: true });
        var tid = me.tentId; var t = db.tents.find(function (x) { return x.id === tid; });
        var wasLeader = t && (t.leaderId || t.createdBy) === me.id;
        me.tentId = null;
        if (!db.participants.some(function (p) { return p.tentId === tid; })) {
          prune(tid); save(); return delay({ ok: true });
        }
        var newLeader = null;
        if (wasLeader) newLeader = transferLeader(tid, me.id);
        save();
        return delay(newLeader ? { ok: true, new_leader_id: newLeader.id, new_leader_name: newLeader.name } : { ok: true });
      },
      createRequest: function (ids, note) { load(); db.requests.push({ id: uid(), requesterId: meId(), participantIds: ids || [], note: note || "", status: "pending", createdAt: Date.now() }); save(); return delay({ ok: true }); },

      verifyPin: function (pin) { load(); return delay(String(pin) === String(db.settings.pin)); },
      addParticipants: function (rows) { load(); var added = 0; rows.forEach(function (r) { if (!r.name) return; db.participants.push({ id: uid(), name: r.name.trim(), gender: r.gender === "F" ? "F" : "M", tentId: null }); added++; }); save(); return delay({ ok: true, added: added }); },
      deleteParticipant: function (id) { load(); var p = P(id); var tid = p && p.tentId; db.participants = db.participants.filter(function (x) { return x.id !== id; }); if (tid) prune(tid); save(); return delay({ ok: true }); },
      setGender: function (id, g) { load(); var p = P(id); if (p) { p.gender = g === "F" ? "F" : "M"; save(); } return delay({ ok: true }); },
      setPhone: function () { return delay({ ok: true }); },
      deleteTent: function (id) { load(); db.participants.forEach(function (p) { if (p.tentId === id) p.tentId = null; }); db.tents = db.tents.filter(function (t) { return t.id !== id; }); db.invites = db.invites.filter(function (i) { return i.tentId !== id; }); save(); return delay({ ok: true }); },
      setBookingOpen: function (v) { load(); db.settings.bookingOpen = !!v; save(); return delay({ ok: true }); },
      setEventName: function (name) { load(); db.settings.eventName = name; save(); return delay({ ok: true }); },
      setPin: function (pin) { load(); db.settings.pin = String(pin); save(); return delay({ ok: true }); },
      forceAssign: function (pid, tentId) {
        load(); var p = P(pid); if (!p) return delay({ ok: true });
        var old = p.tentId;
        var oldTent = old && db.tents.find(function (x) { return x.id === old; });
        var wasLeader = oldTent && (oldTent.leaderId || oldTent.createdBy) === pid;
        p.tentId = tentId;
        if (old && old !== tentId) {
          if (!db.participants.some(function (x) { return x.tentId === old; })) prune(old);
          else if (wasLeader) transferLeader(old, pid);
        }
        if (tentId) db.invites.forEach(function (i) { if (i.inviteeId === pid && i.status === "pending") i.status = "declined"; });
        save(); return delay({ ok: true });
      },
      listRequests: function () { load(); return delay(db.requests.filter(function (r) { return r.status === "pending"; }).map(function (r) { return { id: r.id, requester: nameOf(r.requesterId), people: r.participantIds.map(nameOf), note: r.note, createdAt: r.createdAt }; })); },
      resolveRequest: function (id, approve) { load(); var r = db.requests.find(function (x) { return x.id === id; }); if (r) { r.status = approve ? "approved" : "rejected"; save(); } return delay({ ok: true }); },
      resetAssignments: function () { load(); db.tents = []; db.invites = []; db.participants.forEach(function (p) { p.tentId = null; }); save(); return delay({ ok: true }); },
      _reseed: function () { db = seed(); save(); clearSession(); return delay({ ok: true }); }
    };
  }

  var cfg = global.CORTURI_CONFIG;
  var useSupabase = cfg && cfg.url && cfg.key && global.supabase && global.supabase.createClient;
  global.Store = useSupabase ? makeSupabaseStore(cfg) : makeDemoStore();
})(window);
