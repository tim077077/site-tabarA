/* =====================================================================
   Store — data layer (localStorage + demo data, Supabase-ready).
   Model: tents are CREATED BY participants. Anyone can create a cort
   (capacity + optional nickname); others join it until it's full.
   ===================================================================== */
(function (global) {
  "use strict";

  var KEY = "corturi.v2";
  var DEFAULT_PIN = "1234";

  function uid() { return "id_" + Math.random().toString(36).slice(2, 10); }

  function seed() {
    var boys = ["Andrei", "Mihai", "Ștefan", "David", "Luca", "Rareș", "Vlad", "Matei",
                "Darius", "Cosmin", "Robert", "Ionuț", "Alex", "Cristi"];
    var girls = ["Maria", "Ioana", "Andreea", "Elena", "Sofia", "Daria", "Bianca",
                 "Alexandra", "Gabriela", "Teodora", "Larisa", "Ana", "Delia"];
    var participants = [];
    boys.forEach(function (n) { participants.push({ id: uid(), name: n, gender: "M", tentId: null }); });
    girls.forEach(function (n) { participants.push({ id: uid(), name: n, gender: "F", tentId: null }); });

    function byName(n) { return participants.find(function (p) { return p.name === n; }); }

    // two example user-created corturi
    var t1 = { id: uid(), name: null, gender: "M", capacity: 6, createdBy: byName("Andrei").id, createdAt: Date.now() - 6000 };
    var t2 = { id: uid(), name: "Zânele", gender: "F", capacity: 4, createdBy: byName("Maria").id, createdAt: Date.now() - 3000 };
    byName("Andrei").tentId = t1.id; byName("Mihai").tentId = t1.id;
    byName("Maria").tentId = t2.id; byName("Ioana").tentId = t2.id; byName("Andreea").tentId = t2.id;

    return {
      settings: { eventName: "Tabăra Făgăraș", bookingOpen: true, pin: DEFAULT_PIN },
      participants: participants,
      tents: [t1, t2],
      requests: []
    };
  }

  var db = null;
  function load() {
    if (db) return db;
    try { var raw = localStorage.getItem(KEY); db = raw ? JSON.parse(raw) : seed(); }
    catch (e) { db = seed(); }
    return db;
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(db)); }
  function delay(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 80); }); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function nameOf(id) { var p = db.participants.find(function (x) { return x.id === id; }); return p ? p.name : "?"; }

  function tentStatus(t) {
    var occ = db.participants.filter(function (p) { return p.tentId === t.id; })
      .map(function (p) { return { id: p.id, name: p.name }; });
    return {
      id: t.id, name: t.name, gender: t.gender, capacity: t.capacity,
      createdBy: t.createdBy, createdByName: nameOf(t.createdBy), createdAt: t.createdAt || 0,
      occupants: occ, occupied: occ.length, free: t.capacity - occ.length
    };
  }

  // auto-remove a cort once everyone has left it
  function pruneEmpty(tentId) {
    var still = db.participants.some(function (p) { return p.tentId === tentId; });
    if (!still) db.tents = db.tents.filter(function (t) { return t.id !== tentId; });
  }

  var Store = {
    backend: "demo",
    init: function () { load(); return Promise.resolve(); },

    getSettings: function () { load(); return delay({ eventName: db.settings.eventName, bookingOpen: db.settings.bookingOpen }); },

    getParticipants: function () {
      load();
      return delay(clone(db.participants).sort(function (a, b) { return a.name.localeCompare(b.name, "ro"); }));
    },
    getParticipant: function (id) {
      load();
      var p = db.participants.find(function (x) { return x.id === id; });
      return delay(p ? clone(p) : null);
    },

    getTents: function (gender) {
      load();
      var list = db.tents.filter(function (t) { return !gender || t.gender === gender; })
        .map(tentStatus)
        .sort(function (a, b) { return a.createdAt - b.createdAt; });
      return delay(list);
    },
    getTent: function (id) {
      load();
      var t = db.tents.find(function (x) { return x.id === id; });
      return delay(t ? tentStatus(t) : null);
    },

    // ---- participant actions ----
    createTent: function (creatorId, capacity, name, extraIds) {
      load();
      if (!db.settings.bookingOpen) return delay({ ok: false, code: "closed", message: "Înscrierile sunt închise momentan." });
      var creator = db.participants.find(function (p) { return p.id === creatorId; });
      if (!creator) return delay({ ok: false, code: "bad", message: "Participant invalid." });
      capacity = Math.max(1, Math.min(12, parseInt(capacity, 10) || 1));
      var members = [creator].concat((extraIds || []).map(function (id) {
        return db.participants.find(function (p) { return p.id === id; });
      }).filter(Boolean));
      if (members.some(function (m) { return m.gender !== creator.gender; }))
        return delay({ ok: false, code: "gender", message: "Toți trebuie să fie de același gen." });
      if (members.some(function (m) { return m.tentId; }))
        return delay({ ok: false, code: "taken", message: "Cineva din grup e deja într-un cort." });
      if (members.length > capacity)
        return delay({ ok: false, code: "no_space", message: "Ai ales mai multe persoane decât locuri." });

      var t = { id: uid(), name: (name || "").trim() || null, gender: creator.gender, capacity: capacity, createdBy: creatorId, createdAt: Date.now() };
      db.tents.push(t);
      members.forEach(function (m) { m.tentId = t.id; });
      save();
      return delay({ ok: true, tent: tentStatus(t) });
    },

    joinTent: function (tentId, participantIds) {
      load();
      if (!db.settings.bookingOpen) return delay({ ok: false, code: "closed", message: "Înscrierile sunt închise momentan." });
      var t = db.tents.find(function (x) { return x.id === tentId; });
      if (!t) return delay({ ok: false, code: "no_tent", message: "Cortul nu mai există." });
      var people = participantIds.map(function (id) { return db.participants.find(function (p) { return p.id === id; }); });
      if (people.some(function (p) { return !p; })) return delay({ ok: false, code: "bad", message: "Persoană invalidă." });
      if (people.some(function (p) { return p.gender !== t.gender; })) return delay({ ok: false, code: "gender", message: "Cortul e pentru " + (t.gender === "F" ? "fete" : "băieți") + "." });
      if (people.some(function (p) { return p.tentId && p.tentId !== tentId; })) return delay({ ok: false, code: "taken", message: "Cineva din grup e deja în alt cort." });
      var current = db.participants.filter(function (p) { return p.tentId === tentId; }).length;
      var toAdd = people.filter(function (p) { return p.tentId !== tentId; });
      if (current + toAdd.length > t.capacity) return delay({ ok: false, code: "no_space", message: "Nu mai sunt suficiente locuri în acest cort." });
      toAdd.forEach(function (p) { p.tentId = tentId; });
      save();
      return delay({ ok: true, tent: tentStatus(t) });
    },

    leave: function (participantId) {
      load();
      var p = db.participants.find(function (x) { return x.id === participantId; });
      if (p && p.tentId) { var tid = p.tentId; p.tentId = null; pruneEmpty(tid); save(); }
      return delay({ ok: true });
    },

    createRequest: function (requesterId, participantIds, note) {
      load();
      db.requests.push({ id: uid(), requesterId: requesterId, participantIds: participantIds || [], note: note || "", status: "pending", createdAt: Date.now() });
      save();
      return delay({ ok: true });
    },

    // ---- admin ----
    verifyPin: function (pin) { load(); return delay(String(pin) === String(db.settings.pin)); },
    addParticipants: function (rows) {
      load(); var added = 0;
      rows.forEach(function (r) { if (!r.name) return; db.participants.push({ id: uid(), name: r.name.trim(), gender: r.gender === "F" ? "F" : "M", tentId: null }); added++; });
      save(); return delay({ ok: true, added: added });
    },
    deleteParticipant: function (id) {
      load();
      var p = db.participants.find(function (x) { return x.id === id; });
      var tid = p && p.tentId;
      db.participants = db.participants.filter(function (x) { return x.id !== id; });
      if (tid) pruneEmpty(tid);
      save(); return delay({ ok: true });
    },
    deleteTent: function (id) {
      load();
      db.participants.forEach(function (p) { if (p.tentId === id) p.tentId = null; });
      db.tents = db.tents.filter(function (t) { return t.id !== id; });
      save(); return delay({ ok: true });
    },
    setBookingOpen: function (v) { load(); db.settings.bookingOpen = !!v; save(); return delay({ ok: true }); },
    setEventName: function (name) { load(); db.settings.eventName = name; save(); return delay({ ok: true }); },
    setPin: function (pin) { load(); db.settings.pin = String(pin); save(); return delay({ ok: true }); },
    forceAssign: function (pid, tentId) {
      load();
      var p = db.participants.find(function (x) { return x.id === pid; });
      if (p) { var old = p.tentId; p.tentId = tentId; if (old && old !== tentId) pruneEmpty(old); save(); }
      return delay({ ok: true });
    },
    listRequests: function () {
      load();
      var out = db.requests.filter(function (r) { return r.status === "pending"; }).map(function (r) {
        return { id: r.id, requester: nameOf(r.requesterId), people: r.participantIds.map(nameOf), note: r.note, createdAt: r.createdAt };
      });
      return delay(out);
    },
    resolveRequest: function (id, approve) {
      load();
      var r = db.requests.find(function (x) { return x.id === id; });
      if (r) { r.status = approve ? "approved" : "rejected"; r.resolvedAt = Date.now(); save(); }
      return delay({ ok: true });
    },
    resetAssignments: function () {
      load();
      db.participants.forEach(function (p) { p.tentId = null; });
      db.tents = [];
      save(); return delay({ ok: true });
    },
    _reseed: function () { db = seed(); save(); return delay({ ok: true }); }
  };

  global.Store = Store;
})(window);
