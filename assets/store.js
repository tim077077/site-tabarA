/* =====================================================================
   Store — data layer abstraction.
   Currently backed by localStorage + demo data so the site works
   standalone (frontend-first). The same async interface will later be
   implemented by a Supabase-backed store (validated RPC calls), so the
   UI code never changes.
   ===================================================================== */
(function (global) {
  "use strict";

  var KEY = "corturi.v1";
  var DEFAULT_PIN = "1234";

  // ---- demo seed -----------------------------------------------------
  function uid() { return "id_" + Math.random().toString(36).slice(2, 10); }

  function seed() {
    var boys = ["Andrei", "Mihai", "Ștefan", "David", "Luca", "Rareș", "Vlad", "Matei",
                "Darius", "Cosmin", "Robert", "Ionuț", "Alex", "Cristi"];
    var girls = ["Maria", "Ioana", "Andreea", "Elena", "Sofia", "Daria", "Bianca",
                 "Alexandra", "Gabriela", "Teodora", "Larisa", "Ana", "Delia"];
    var participants = [];
    boys.forEach(function (n) { participants.push({ id: uid(), name: n, gender: "M", tentId: null }); });
    girls.forEach(function (n) { participants.push({ id: uid(), name: n, gender: "F", tentId: null }); });

    var tents = [
      { id: uid(), name: "Bradul", gender: "M", capacity: 4, sortOrder: 1 },
      { id: uid(), name: "Vulturul", gender: "M", capacity: 6, sortOrder: 2 },
      { id: uid(), name: "Lupii", gender: "M", capacity: 4, sortOrder: 3 },
      { id: uid(), name: "Floarea de colț", gender: "F", capacity: 4, sortOrder: 1 },
      { id: uid(), name: "Rândunica", gender: "F", capacity: 6, sortOrder: 2 },
      { id: uid(), name: "Zâna", gender: "F", capacity: 4, sortOrder: 3 }
    ];

    // pre-fill a couple so occupancy is visible in the demo
    var b = tents[0]; // Bradul (4)
    participants.filter(function (p) { return p.gender === "M"; }).slice(0, 2)
      .forEach(function (p) { p.tentId = b.id; });
    var g = tents[4]; // Rândunica (6)
    participants.filter(function (p) { return p.gender === "F"; }).slice(0, 3)
      .forEach(function (p) { p.tentId = g.id; });

    return {
      settings: { eventName: "Tabăra de vară 2026", bookingOpen: true, pin: DEFAULT_PIN },
      participants: participants,
      tents: tents,
      requests: []
    };
  }

  // ---- persistence ---------------------------------------------------
  var db = null;
  function load() {
    if (db) return db;
    try {
      var raw = localStorage.getItem(KEY);
      db = raw ? JSON.parse(raw) : seed();
    } catch (e) { db = seed(); }
    return db;
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(db)); }
  function delay(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 90); }); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  // ---- computed ------------------------------------------------------
  function tentWithStatus(t) {
    var occ = db.participants
      .filter(function (p) { return p.tentId === t.id; })
      .map(function (p) { return { id: p.id, name: p.name }; });
    return {
      id: t.id, name: t.name, gender: t.gender, capacity: t.capacity,
      sortOrder: t.sortOrder || 0,
      occupants: occ, occupied: occ.length, free: t.capacity - occ.length
    };
  }

  // ---- public API ----------------------------------------------------
  var Store = {
    backend: "demo",

    init: function () { load(); return Promise.resolve(); },

    getSettings: function () {
      load();
      return delay({ eventName: db.settings.eventName, bookingOpen: db.settings.bookingOpen });
    },

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
      var list = db.tents
        .filter(function (t) { return !gender || t.gender === gender; })
        .map(tentWithStatus)
        .sort(function (a, b) { return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ro"); });
      return delay(list);
    },

    // participant actions ---------------------------------------------
    book: function (tentId, participantIds) {
      load();
      var t = db.tents.find(function (x) { return x.id === tentId; });
      if (!db.settings.bookingOpen) return delay({ ok: false, code: "closed", message: "Înscrierile sunt închise momentan." });
      if (!t) return delay({ ok: false, code: "no_tent", message: "Cortul nu există." });

      var people = participantIds.map(function (id) {
        return db.participants.find(function (p) { return p.id === id; });
      });
      if (people.some(function (p) { return !p; })) return delay({ ok: false, code: "bad_person", message: "Persoană invalidă." });
      if (people.some(function (p) { return p.gender !== t.gender; }))
        return delay({ ok: false, code: "gender", message: "Toți trebuie să fie de același gen cu cortul." });
      // people already in a DIFFERENT tent block the booking
      if (people.some(function (p) { return p.tentId && p.tentId !== tentId; }))
        return delay({ ok: false, code: "taken", message: "Cineva din grup e deja repartizat în alt cort." });

      var current = db.participants.filter(function (p) { return p.tentId === tentId; }).length;
      var toAdd = people.filter(function (p) { return p.tentId !== tentId; });
      if (current + toAdd.length > t.capacity)
        return delay({ ok: false, code: "no_space", message: "Nu sunt suficiente locuri libere în acest cort." });

      toAdd.forEach(function (p) { p.tentId = tentId; });
      save();
      return delay({ ok: true, tent: tentWithStatus(t) });
    },

    leave: function (participantId) {
      load();
      var p = db.participants.find(function (x) { return x.id === participantId; });
      if (p) { p.tentId = null; save(); }
      return delay({ ok: true });
    },

    createRequest: function (requesterId, participantIds, note) {
      load();
      db.requests.push({
        id: uid(), requesterId: requesterId, participantIds: participantIds || [],
        note: note || "", status: "pending", createdAt: Date.now()
      });
      save();
      return delay({ ok: true });
    },

    // admin -----------------------------------------------------------
    verifyPin: function (pin) { load(); return delay(String(pin) === String(db.settings.pin)); },

    addParticipants: function (rows) {
      load();
      var added = 0;
      rows.forEach(function (r) {
        if (!r.name) return;
        db.participants.push({ id: uid(), name: r.name.trim(), gender: r.gender === "F" ? "F" : "M", tentId: null });
        added++;
      });
      save();
      return delay({ ok: true, added: added });
    },

    deleteParticipant: function (id) {
      load();
      db.participants = db.participants.filter(function (p) { return p.id !== id; });
      save(); return delay({ ok: true });
    },

    upsertTent: function (t) {
      load();
      if (t.id) {
        var ex = db.tents.find(function (x) { return x.id === t.id; });
        if (ex) { ex.name = t.name; ex.gender = t.gender; ex.capacity = t.capacity; ex.sortOrder = t.sortOrder; }
      } else {
        db.tents.push({ id: uid(), name: t.name, gender: t.gender, capacity: t.capacity, sortOrder: t.sortOrder || (db.tents.length + 1) });
      }
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
      if (p) { p.tentId = tentId; save(); }
      return delay({ ok: true });
    },

    listRequests: function () {
      load();
      var out = db.requests.filter(function (r) { return r.status === "pending"; }).map(function (r) {
        return {
          id: r.id,
          requester: (db.participants.find(function (p) { return p.id === r.requesterId; }) || {}).name || "?",
          people: r.participantIds.map(function (id) {
            return (db.participants.find(function (p) { return p.id === id; }) || {}).name || "?";
          }),
          note: r.note, createdAt: r.createdAt
        };
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
      save(); return delay({ ok: true });
    },

    // demo helper
    _reseed: function () { db = seed(); save(); return delay({ ok: true }); }
  };

  global.Store = Store;
})(window);
