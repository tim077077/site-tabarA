/* =====================================================================
   Store — data layer. Two interchangeable backends behind ONE async API:
     • Supabase  — used when assets/config.js + the supabase-js CDN load
                   (the live site). All writes go through validated RPCs.
     • Demo      — localStorage fallback (offline/preview) with seed data.
   The UI never changes; only this file knows which backend is active.
   ===================================================================== */
(function (global) {
  "use strict";

  function delay(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 60); }); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function uid() { return "id_" + Math.random().toString(36).slice(2, 10); }

  /* ================================================================= *
   *  SUPABASE BACKEND                                                 *
   * ================================================================= */
  function makeSupabaseStore(cfg) {
    var sb = global.supabase.createClient(cfg.url, cfg.key);

    function stashPin(p) { try { sessionStorage.setItem("corturi.pin", p); } catch (e) {} }
    function getPin() { try { return sessionStorage.getItem("corturi.pin") || ""; } catch (e) { return ""; } }

    // build tent status objects from raw rows
    function buildTents(tents, assigns, people, gender) {
      var pmap = {}; people.forEach(function (p) { pmap[p.id] = p; });
      var byTent = {}; assigns.forEach(function (a) { (byTent[a.tent_id] = byTent[a.tent_id] || []).push(a.participant_id); });
      return tents
        .filter(function (t) { return !gender || t.gender === gender; })
        .map(function (t) {
          var occ = (byTent[t.id] || []).map(function (id) { return { id: id, name: (pmap[id] || {}).name || "?" }; });
          return {
            id: t.id, name: t.name, gender: t.gender, capacity: t.capacity,
            createdBy: t.created_by, createdByName: (pmap[t.created_by] || {}).name || "?",
            createdAt: new Date(t.created_at).getTime(),
            occupants: occ, occupied: occ.length, free: t.capacity - occ.length
          };
        })
        .sort(function (a, b) { return a.createdAt - b.createdAt; });
    }

    function fetchAll() {
      return Promise.all([
        sb.from("camp_tents").select("id,name,gender,capacity,created_by,created_at"),
        sb.from("camp_assignments").select("participant_id,tent_id"),
        sb.from("camp_participants").select("id,name,gender")
      ]).then(function (r) {
        return { tents: r[0].data || [], assigns: r[1].data || [], people: r[2].data || [] };
      });
    }

    function rpc(fn, args) {
      return sb.rpc(fn, args).then(function (r) {
        if (r.error) return { ok: false, code: "net", message: "Eroare de rețea. Încearcă din nou." };
        return r.data;
      });
    }
    function adminRpc(fn, args) {
      var pin = getPin();
      if (!pin) return delay({ ok: false, code: "pin" });
      var a = Object.assign({ p_pin: pin }, args || {});
      return rpc(fn, a);
    }

    return {
      backend: "supabase",
      init: function () { return Promise.resolve(); },

      getSettings: function () {
        return rpc("get_public_settings", {}).then(function (d) {
          d = d || {}; return { eventName: d.event_name || "Tabără", bookingOpen: d.booking_open !== false };
        });
      },
      getParticipants: function () {
        return Promise.all([
          sb.from("camp_participants").select("id,name,gender"),
          sb.from("camp_assignments").select("participant_id,tent_id")
        ]).then(function (r) {
          var assigns = r[1].data || {}; var amap = {};
          (r[1].data || []).forEach(function (a) { amap[a.participant_id] = a.tent_id; });
          return (r[0].data || []).map(function (p) { return { id: p.id, name: p.name, gender: p.gender, tentId: amap[p.id] || null }; })
            .sort(function (a, b) { return a.name.localeCompare(b.name, "ro"); });
        });
      },
      getParticipant: function (id) {
        return this.getParticipants().then(function (list) { return list.find(function (p) { return p.id === id; }) || null; });
      },
      getTents: function (gender) { return fetchAll().then(function (d) { return buildTents(d.tents, d.assigns, d.people, gender); }); },
      getTent: function (id) { return fetchAll().then(function (d) { return buildTents(d.tents, d.assigns, d.people).find(function (t) { return t.id === id; }) || null; }); },

      createTent: function (creatorId, capacity, name, extraIds) {
        var self = this;
        return rpc("create_tent", { p_creator: creatorId, p_capacity: capacity, p_name: name || null, p_extra: extraIds || [] })
          .then(function (r) { if (!r || !r.ok) return r || { ok: false }; return self.getTent(r.tent_id).then(function (t) { return { ok: true, tent: t }; }); });
      },
      joinTent: function (tentId, ids) {
        var self = this;
        return rpc("join_tent", { p_tent: tentId, p_ids: ids || [] })
          .then(function (r) { if (!r || !r.ok) return r || { ok: false }; return self.getTent(r.tent_id).then(function (t) { return { ok: true, tent: t }; }); });
      },
      leave: function (pid) { return rpc("leave_tent", { p_participant: pid }); },
      createRequest: function (requesterId, ids, note) { return rpc("create_request", { p_requester: requesterId, p_ids: ids || [], p_note: note || "" }); },

      verifyPin: function (pin) {
        return sb.rpc("admin_verify", { p_pin: String(pin) }).then(function (r) {
          var ok = r.data && r.data.ok; if (ok) stashPin(String(pin)); return !!ok;
        });
      },
      addParticipants: function (rows) { return adminRpc("admin_add_participants", { p_rows: rows }); },
      deleteParticipant: function (id) { return adminRpc("admin_delete_participant", { p_id: id }); },
      deleteTent: function (id) { return adminRpc("admin_delete_tent", { p_id: id }); },
      setBookingOpen: function (v) { return adminRpc("admin_set_booking", { p_open: !!v }); },
      setEventName: function (name) { return adminRpc("admin_set_event_name", { p_name: name }); },
      setPin: function (newPin) {
        return adminRpc("admin_set_pin", { p_new: String(newPin) }).then(function (r) { if (r && r.ok) stashPin(String(newPin)); return r; });
      },
      forceAssign: function (pid, tentId) { return adminRpc("admin_force_assign", { p_pid: pid, p_tent: tentId }); },
      listRequests: function () { return adminRpc("admin_list_requests", {}).then(function (r) { return (r && r.ok && r.requests) ? r.requests.map(function (x) { return { id: x.id, requester: x.requester, people: x.people || [], note: x.note, createdAt: Number(x.created_at) }; }) : []; }); },
      resolveRequest: function (id, approve) { return adminRpc("admin_resolve_request", { p_id: id, p_approve: !!approve }); },
      resetAssignments: function () { return adminRpc("admin_reset_tents", {}); },
      _reseed: function () { return delay({ ok: true }); } // n/a on live backend
    };
  }

  /* ================================================================= *
   *  DEMO BACKEND (localStorage)                                      *
   * ================================================================= */
  function makeDemoStore() {
    var KEY = "corturi.v2", DEFAULT_PIN = "1234", db = null;

    function seed() {
      var boys = ["Andrei", "Mihai", "Ștefan", "David", "Luca", "Rareș", "Vlad", "Matei", "Darius", "Cosmin", "Robert", "Ionuț", "Alex", "Cristi"];
      var girls = ["Maria", "Ioana", "Andreea", "Elena", "Sofia", "Daria", "Bianca", "Alexandra", "Gabriela", "Teodora", "Larisa", "Ana", "Delia"];
      var participants = [];
      boys.forEach(function (n) { participants.push({ id: uid(), name: n, gender: "M", tentId: null }); });
      girls.forEach(function (n) { participants.push({ id: uid(), name: n, gender: "F", tentId: null }); });
      function byName(n) { return participants.find(function (p) { return p.name === n; }); }
      var t1 = { id: uid(), name: null, gender: "M", capacity: 6, createdBy: byName("Andrei").id, createdAt: Date.now() - 6000 };
      var t2 = { id: uid(), name: "Zânele", gender: "F", capacity: 4, createdBy: byName("Maria").id, createdAt: Date.now() - 3000 };
      byName("Andrei").tentId = t1.id; byName("Mihai").tentId = t1.id;
      byName("Maria").tentId = t2.id; byName("Ioana").tentId = t2.id; byName("Andreea").tentId = t2.id;
      return { settings: { eventName: "Tabăra Făgăraș", bookingOpen: true, pin: DEFAULT_PIN }, participants: participants, tents: [t1, t2], requests: [] };
    }
    function load() { if (db) return db; try { var raw = localStorage.getItem(KEY); db = raw ? JSON.parse(raw) : seed(); } catch (e) { db = seed(); } return db; }
    function save() { localStorage.setItem(KEY, JSON.stringify(db)); }
    function nameOf(id) { var p = db.participants.find(function (x) { return x.id === id; }); return p ? p.name : "?"; }
    function tentStatus(t) {
      var occ = db.participants.filter(function (p) { return p.tentId === t.id; }).map(function (p) { return { id: p.id, name: p.name }; });
      return { id: t.id, name: t.name, gender: t.gender, capacity: t.capacity, createdBy: t.createdBy, createdByName: nameOf(t.createdBy), createdAt: t.createdAt || 0, occupants: occ, occupied: occ.length, free: t.capacity - occ.length };
    }
    function pruneEmpty(tid) { if (!db.participants.some(function (p) { return p.tentId === tid; })) db.tents = db.tents.filter(function (t) { return t.id !== tid; }); }

    return {
      backend: "demo",
      init: function () { load(); return Promise.resolve(); },
      getSettings: function () { load(); return delay({ eventName: db.settings.eventName, bookingOpen: db.settings.bookingOpen }); },
      getParticipants: function () { load(); return delay(clone(db.participants).sort(function (a, b) { return a.name.localeCompare(b.name, "ro"); })); },
      getParticipant: function (id) { load(); var p = db.participants.find(function (x) { return x.id === id; }); return delay(p ? clone(p) : null); },
      getTents: function (gender) { load(); return delay(db.tents.filter(function (t) { return !gender || t.gender === gender; }).map(tentStatus).sort(function (a, b) { return a.createdAt - b.createdAt; })); },
      getTent: function (id) { load(); var t = db.tents.find(function (x) { return x.id === id; }); return delay(t ? tentStatus(t) : null); },
      createTent: function (creatorId, capacity, name, extraIds) {
        load();
        if (!db.settings.bookingOpen) return delay({ ok: false, code: "closed", message: "Înscrierile sunt închise momentan." });
        var creator = db.participants.find(function (p) { return p.id === creatorId; });
        if (!creator) return delay({ ok: false, code: "bad", message: "Participant invalid." });
        capacity = Math.max(1, Math.min(12, parseInt(capacity, 10) || 1));
        var members = [creator].concat((extraIds || []).map(function (id) { return db.participants.find(function (p) { return p.id === id; }); }).filter(Boolean));
        if (members.some(function (m) { return m.gender !== creator.gender; })) return delay({ ok: false, code: "gender", message: "Toți trebuie să fie de același gen." });
        if (members.some(function (m) { return m.tentId; })) return delay({ ok: false, code: "taken", message: "Cineva din grup e deja într-un cort." });
        if (members.length > capacity) return delay({ ok: false, code: "no_space", message: "Ai ales mai multe persoane decât locuri." });
        var t = { id: uid(), name: (name || "").trim() || null, gender: creator.gender, capacity: capacity, createdBy: creatorId, createdAt: Date.now() };
        db.tents.push(t); members.forEach(function (m) { m.tentId = t.id; }); save();
        return delay({ ok: true, tent: tentStatus(t) });
      },
      joinTent: function (tentId, participantIds) {
        load();
        if (!db.settings.bookingOpen) return delay({ ok: false, code: "closed", message: "Înscrierile sunt închise momentan." });
        var t = db.tents.find(function (x) { return x.id === tentId; });
        if (!t) return delay({ ok: false, code: "no_tent", message: "Cortul nu mai există." });
        var people = participantIds.map(function (id) { return db.participants.find(function (p) { return p.id === id; }); });
        if (people.some(function (p) { return !p; })) return delay({ ok: false, code: "bad", message: "Persoană invalidă." });
        if (people.some(function (p) { return p.gender !== t.gender; })) return delay({ ok: false, code: "gender", message: "Genul nu se potrivește cu cortul." });
        if (people.some(function (p) { return p.tentId && p.tentId !== tentId; })) return delay({ ok: false, code: "taken", message: "Cineva din grup e deja în alt cort." });
        var current = db.participants.filter(function (p) { return p.tentId === tentId; }).length;
        var toAdd = people.filter(function (p) { return p.tentId !== tentId; });
        if (current + toAdd.length > t.capacity) return delay({ ok: false, code: "no_space", message: "Nu mai sunt suficiente locuri în acest cort." });
        toAdd.forEach(function (p) { p.tentId = tentId; }); save();
        return delay({ ok: true, tent: tentStatus(t) });
      },
      leave: function (participantId) { load(); var p = db.participants.find(function (x) { return x.id === participantId; }); if (p && p.tentId) { var tid = p.tentId; p.tentId = null; pruneEmpty(tid); save(); } return delay({ ok: true }); },
      createRequest: function (requesterId, participantIds, note) { load(); db.requests.push({ id: uid(), requesterId: requesterId, participantIds: participantIds || [], note: note || "", status: "pending", createdAt: Date.now() }); save(); return delay({ ok: true }); },
      verifyPin: function (pin) { load(); return delay(String(pin) === String(db.settings.pin)); },
      addParticipants: function (rows) { load(); var added = 0; rows.forEach(function (r) { if (!r.name) return; db.participants.push({ id: uid(), name: r.name.trim(), gender: r.gender === "F" ? "F" : "M", tentId: null }); added++; }); save(); return delay({ ok: true, added: added }); },
      deleteParticipant: function (id) { load(); var p = db.participants.find(function (x) { return x.id === id; }); var tid = p && p.tentId; db.participants = db.participants.filter(function (x) { return x.id !== id; }); if (tid) pruneEmpty(tid); save(); return delay({ ok: true }); },
      deleteTent: function (id) { load(); db.participants.forEach(function (p) { if (p.tentId === id) p.tentId = null; }); db.tents = db.tents.filter(function (t) { return t.id !== id; }); save(); return delay({ ok: true }); },
      setBookingOpen: function (v) { load(); db.settings.bookingOpen = !!v; save(); return delay({ ok: true }); },
      setEventName: function (name) { load(); db.settings.eventName = name; save(); return delay({ ok: true }); },
      setPin: function (pin) { load(); db.settings.pin = String(pin); save(); return delay({ ok: true }); },
      forceAssign: function (pid, tentId) { load(); var p = db.participants.find(function (x) { return x.id === pid; }); if (p) { var old = p.tentId; p.tentId = tentId; if (old && old !== tentId) pruneEmpty(old); save(); } return delay({ ok: true }); },
      listRequests: function () { load(); return delay(db.requests.filter(function (r) { return r.status === "pending"; }).map(function (r) { return { id: r.id, requester: nameOf(r.requesterId), people: r.participantIds.map(nameOf), note: r.note, createdAt: r.createdAt }; })); },
      resolveRequest: function (id, approve) { load(); var r = db.requests.find(function (x) { return x.id === id; }); if (r) { r.status = approve ? "approved" : "rejected"; r.resolvedAt = Date.now(); save(); } return delay({ ok: true }); },
      resetAssignments: function () { load(); db.tents = []; db.participants.forEach(function (p) { p.tentId = null; }); save(); return delay({ ok: true }); },
      _reseed: function () { db = seed(); save(); return delay({ ok: true }); }
    };
  }

  var cfg = global.CORTURI_CONFIG;
  var useSupabase = cfg && cfg.url && cfg.key && global.supabase && global.supabase.createClient;
  global.Store = useSupabase ? makeSupabaseStore(cfg) : makeDemoStore();
})(window);
