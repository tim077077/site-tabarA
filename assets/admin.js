/* =====================================================================
   Admin panel (dark). Tents are participant-created; admin monitors,
   manages participants, resolves requests, and can delete corturi.
   ===================================================================== */
(function () {
  "use strict";

  var view = document.getElementById("view");
  var SESSION_KEY = "corturi.admin";
  var current = "repartizare";

  function isAuthed() { return sessionStorage.getItem(SESSION_KEY) === "1"; }
  function setAuthed(v) { if (v) sessionStorage.setItem(SESSION_KEY, "1"); else sessionStorage.removeItem(SESSION_KEY); }

  // ---- login ------------------------------------------------------- //
  function renderLogin(err) {
    view.innerHTML =
      '<div class="screen-head"><span class="eyebrow-sm">Acces organizator</span><h1>Autentificare</h1>' +
        '<p>Introdu codul PIN ca să gestionezi tabăra.</p></div>' +
      '<div class="card mt-lg">' +
        '<div class="field"><label>Cod PIN</label><input class="input" id="pin" type="password" inputmode="numeric" placeholder="••••" autocomplete="off" /></div>' +
        (err ? '<div class="notice warn">PIN greșit. Încearcă din nou.</div>' : "") +
        '<button class="btn btn-primary btn-block mt" id="login">Intră</button>' +
        '<p class="muted center mt" style="font-size:.8rem">PIN demo: <strong>1234</strong> (schimbă-l din Setări)</p>' +
      '</div>';
    var pin = document.getElementById("pin");
    function go() { Store.verifyPin(pin.value).then(function (ok) { if (ok) { setAuthed(true); renderApp(); } else renderLogin(true); }); }
    document.getElementById("login").addEventListener("click", go);
    pin.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    pin.focus();
  }

  // ---- shell ------------------------------------------------------- //
  var TABS = [
    { id: "repartizare", label: "Repartizare" },
    { id: "corturi", label: "Corturi" },
    { id: "participanti", label: "Participanți" },
    { id: "cereri", label: "Cereri" },
    { id: "setari", label: "Setări" }
  ];

  function renderApp() {
    view.innerHTML = '<div class="tabs mt" id="tabs"></div><div id="panel" class="mt fade-in"></div>';
    var tabs = document.getElementById("tabs");
    TABS.forEach(function (t) {
      var b = UI.el('<button class="tab' + (t.id === current ? " active" : "") + '" data-id="' + t.id + '">' + t.label + '</button>');
      b.addEventListener("click", function () { current = t.id; renderApp(); });
      tabs.appendChild(b);
    });
    updateRequestBadge();
    var p = document.getElementById("panel");
    ({ repartizare: renderOverview, corturi: renderTents, participanti: renderParticipants, cereri: renderRequests, setari: renderSettings }[current])(p);
  }

  function updateRequestBadge() {
    Store.listRequests().then(function (rs) {
      var tab = document.querySelector('.tab[data-id="cereri"]');
      if (tab && rs.length && tab.querySelectorAll(".count-pill").length === 0)
        tab.insertAdjacentHTML("beforeend", ' <span class="count-pill">' + rs.length + '</span>');
    });
  }

  // ---- Overview ---------------------------------------------------- //
  function renderOverview(p) {
    p.innerHTML = '<div id="ov"></div>';
    Promise.all([Store.getTents(), Store.getParticipants()]).then(function (res) {
      var tents = res[0], people = res[1];
      var unassigned = people.filter(function (x) { return !x.tentId; });
      var cap = tents.reduce(function (a, t) { return a + t.capacity; }, 0);
      var occ = tents.reduce(function (a, t) { return a + t.occupied; }, 0);
      var ov = document.getElementById("ov");
      ov.innerHTML = '<div class="grid" style="grid-template-columns:repeat(4,1fr);gap:8px">' +
        stat(people.length, "persoane") + stat(tents.length, "corturi") +
        stat(occ, "repartizați") + stat(unassigned.length, "liberi") + '</div>';

      ["M", "F"].forEach(function (g) {
        var group = tents.filter(function (t) { return t.gender === g; });
        if (!group.length) return;
        ov.insertAdjacentHTML("beforeend", '<div class="section-title"><h2>' + UI.genderBadge(g) + '</h2><span class="hint">' + group.length + (group.length === 1 ? ' cort' : ' corturi') + '</span></div>');
        var grid = UI.el('<div class="grid"></div>');
        group.forEach(function (t) { grid.appendChild(adminTentCard(t)); });
        ov.appendChild(grid);
      });

      ov.insertAdjacentHTML("beforeend", '<div class="section-title"><h2>Nerepartizați</h2><span class="hint">' + unassigned.length + '</span></div>');
      if (!unassigned.length) ov.insertAdjacentHTML("beforeend", '<div class="card muted center">Toți au un cort 🎉</div>');
      else {
        var wrap = UI.el('<div class="card" style="display:flex;flex-wrap:wrap;gap:7px"></div>');
        unassigned.forEach(function (u) { wrap.appendChild(UI.el('<span class="chip">' + UI.avatar(u.name, "sm") + UI.esc(u.name) + '</span>')); });
        ov.appendChild(wrap);
      }
    });
  }
  function stat(big, small) { return '<div class="stat"><div class="big">' + big + '</div><div class="small">' + small + '</div></div>'; }

  function adminTentCard(t) {
    var pips = "";
    for (var i = 0; i < t.capacity; i++) pips += '<span class="pip' + (i < t.occupied ? " on" : "") + '"></span>';
    var card = UI.el(
      '<div class="cort" style="cursor:default">' +
        '<div class="row"><div class="cort-emoji">' + UI.tentEmoji(t) + '</div>' +
          '<div class="grow"><div class="cort-name">' + UI.esc(UI.tentName(t)) + '</div>' +
          '<div class="cort-sub">' + t.occupied + '/' + t.capacity + ' · ' + UI.esc(t.createdByName) + '</div></div></div>' +
        '<div class="meter">' + pips + '</div>' +
        '<div class="person-list"></div>' +
      '</div>'
    );
    var list = card.querySelector(".person-list");
    if (!t.occupants.length) list.innerHTML = '<span class="none muted" style="font-size:.84rem">gol</span>';
    t.occupants.forEach(function (o) {
      var row = UI.el('<div class="person" style="cursor:default;padding:8px 11px">' + UI.avatar(o.name, "sm") +
        '<span class="who"><span class="name">' + UI.esc(o.name) + '</span></span>' +
        '<button class="btn btn-danger btn-sm" title="Scoate">✕</button></div>');
      row.querySelector("button").addEventListener("click", function () {
        Store.forceAssign(o.id, null).then(function () { renderOverview(document.getElementById("panel")); });
      });
      list.appendChild(row);
    });
    return card;
  }

  // ---- Corturi (list + delete) ------------------------------------ //
  function renderTents(p) {
    p.innerHTML = '<p class="muted" style="font-size:.88rem;margin:2px 2px 12px">Corturile sunt create de participanți. Aici le poți vedea și șterge.</p><div id="list"></div>';
    Store.getTents().then(function (tents) {
      var box = document.getElementById("list");
      if (!tents.length) { box.innerHTML = '<div class="empty"><div class="ico">⛺</div><p>Niciun cort încă.</p></div>'; return; }
      box.innerHTML = "";
      tents.forEach(function (t) {
        var row = UI.el(
          '<div class="card mt" style="display:flex;align-items:center;gap:12px">' +
            '<div class="cort-emoji">' + UI.tentEmoji(t) + '</div>' +
            '<div class="grow"><div style="font-family:var(--display);font-weight:700">' + UI.esc(UI.tentName(t)) + '</div>' +
            '<div class="muted" style="font-size:.82rem">' + UI.genderLabel(t.gender) + ' · ' + t.occupied + '/' + t.capacity + ' · de ' + UI.esc(t.createdByName) + '</div></div>' +
            '<button class="btn btn-danger btn-sm del">🗑️</button></div>'
        );
        row.querySelector(".del").addEventListener("click", function () {
          if (confirm('Ștergi „' + UI.tentName(t) + '"? Membrii rămân nerepartizați.')) Store.deleteTent(t.id).then(function () { renderTents(p); });
        });
        box.appendChild(row);
      });
    });
  }

  // ---- Participants ------------------------------------------------ //
  function renderParticipants(p) {
    p.innerHTML =
      '<button class="btn btn-primary btn-block" id="bulk">＋ Adaugă participanți</button>' +
      '<div class="search mt"><input class="input" id="pq" placeholder="Caută…" /></div>' +
      '<div class="person-list mt" id="plist"></div>';
    document.getElementById("bulk").addEventListener("click", bulkSheet);
    Store.getParticipants().then(function (list) {
      var box = document.getElementById("plist"), q = document.getElementById("pq");
      function draw() {
        var term = q.value.trim().toLowerCase();
        var f = list.filter(function (x) { return x.name.toLowerCase().indexOf(term) >= 0; });
        box.innerHTML = "";
        if (!f.length) { box.innerHTML = '<div class="empty"><div class="ico">🧑‍🤝‍🧑</div><p>Niciun participant.</p></div>'; return; }
        f.forEach(function (x) {
          var row = UI.el('<div class="person" style="cursor:default">' + UI.avatar(x.name) +
            '<span class="who"><span class="name">' + UI.esc(x.name) + '</span>' +
            '<span class="meta">' + UI.genderLabel(x.gender) + (x.tentId ? " · are cort" : " · liber") + '</span></span>' +
            '<button class="btn btn-danger btn-sm">🗑️</button></div>');
          row.querySelector("button").addEventListener("click", function () {
            if (confirm('Ștergi pe „' + x.name + '"?')) Store.deleteParticipant(x.id).then(function () { renderParticipants(p); });
          });
          box.appendChild(row);
        });
      }
      q.addEventListener("input", draw); draw();
    });
  }

  function bulkSheet() {
    UI.openSheet(
      '<h2>Adaugă participanți</h2>' +
      '<p class="muted mt" style="font-size:.9rem">Câte unul pe linie: <strong>Nume, gen</strong> (M sau F).</p>' +
      '<div class="card mt" style="font-family:monospace;font-size:.85rem;white-space:pre;color:var(--text-soft)">Andrei, M\nMaria, F\nVlad, M</div>' +
      '<div class="field mt"><textarea class="input" id="txt" rows="8" placeholder="Andrei, M&#10;Maria, F"></textarea></div>' +
      '<button class="btn btn-primary btn-block" id="save">Adaugă toți</button>' +
      '<button class="btn btn-ghost btn-block mt" id="cancel">Anulează</button>'
    );
    document.getElementById("cancel").addEventListener("click", UI.closeSheet);
    document.getElementById("save").addEventListener("click", function () {
      var rows = [];
      document.getElementById("txt").value.split("\n").forEach(function (ln) {
        ln = ln.trim(); if (!ln) return;
        var parts = ln.split(","), name = parts[0].trim(), g = (parts[1] || "M").trim().toUpperCase();
        if (name) rows.push({ name: name, gender: g === "F" ? "F" : "M" });
      });
      if (!rows.length) { UI.toast("Nimic de adăugat.", "err"); return; }
      Store.addParticipants(rows).then(function (r) { UI.closeSheet(); UI.toast(r.added + " adăugați.", "ok"); renderParticipants(document.getElementById("panel")); });
    });
  }

  // ---- Requests ---------------------------------------------------- //
  function renderRequests(p) {
    p.innerHTML = '<div id="rlist"></div>';
    Store.listRequests().then(function (rs) {
      var box = document.getElementById("rlist");
      if (!rs.length) { box.innerHTML = '<div class="empty"><div class="ico">📭</div><p>Nicio cerere în așteptare.</p></div>'; return; }
      box.innerHTML = "";
      rs.forEach(function (r) {
        var card = UI.el(
          '<div class="card mt">' +
            '<div class="row-between"><strong>' + UI.esc(r.requester) + '</strong>' +
            '<span class="muted" style="font-size:.78rem">' + new Date(r.createdAt).toLocaleString("ro-RO") + '</span></div>' +
            '<div class="muted mt" style="font-size:.88rem">Pentru: ' + r.people.map(UI.esc).join(", ") + '</div>' +
            (r.note ? '<div class="notice mt">💬 ' + UI.esc(r.note) + '</div>' : "") +
            '<div class="row mt" style="gap:8px"><button class="btn btn-primary btn-sm grow ok">✓ Aprobă</button>' +
            '<button class="btn btn-danger btn-sm grow no">✕ Respinge</button></div></div>'
        );
        card.querySelector(".ok").addEventListener("click", function () { Store.resolveRequest(r.id, true).then(function () { UI.toast("Aprobată.", "ok"); renderApp(); }); });
        card.querySelector(".no").addEventListener("click", function () { Store.resolveRequest(r.id, false).then(function () { UI.toast("Respinsă.", "info"); renderApp(); }); });
        box.appendChild(card);
      });
    });
  }

  // ---- Settings ---------------------------------------------------- //
  function renderSettings(p) {
    Store.getSettings().then(function (s) {
      p.innerHTML =
        '<div class="card"><div class="field"><label>Numele taberei</label><input class="input" id="name" value="' + UI.esc(s.eventName) + '" /></div>' +
          '<button class="btn btn-glass btn-sm" id="name-save">Salvează numele</button></div>' +
        '<div class="card mt"><div class="row-between"><div><strong>Înscrieri</strong>' +
          '<div class="muted" style="font-size:.82rem">Închise = nimeni nu mai poate crea sau intra în corturi.</div></div>' +
          '<button class="btn ' + (s.bookingOpen ? "btn-primary" : "btn-outline") + ' btn-sm" id="toggle">' + (s.bookingOpen ? "Deschise" : "Închise") + '</button></div></div>' +
        '<div class="card mt"><div class="field"><label>Schimbă codul PIN</label><input class="input" id="pin" inputmode="numeric" placeholder="PIN nou" /></div>' +
          '<button class="btn btn-glass btn-sm" id="pin-save">Salvează PIN</button></div>' +
        '<div class="divider"></div>' +
        '<button class="btn btn-danger btn-block" id="reset">Șterge toate corturile</button>' +
        '<button class="btn btn-ghost btn-block mt" id="logout">Ieși din cont</button>' +
        (Store.backend === "demo" ? '<button class="btn btn-ghost btn-block mt" id="demo" style="color:var(--text-dim)">↺ Resetează datele demo</button>' : "");

      document.getElementById("name-save").addEventListener("click", function () { Store.setEventName(document.getElementById("name").value.trim() || "Tabără").then(function () { UI.toast("Salvat.", "ok"); }); });
      document.getElementById("toggle").addEventListener("click", function () { Store.setBookingOpen(!s.bookingOpen).then(function () { renderSettings(p); }); });
      document.getElementById("pin-save").addEventListener("click", function () {
        var v = document.getElementById("pin").value.trim();
        if (v.length < 3) { UI.toast("Minim 3 caractere.", "err"); return; }
        Store.setPin(v).then(function () { UI.toast("PIN schimbat.", "ok"); document.getElementById("pin").value = ""; });
      });
      document.getElementById("reset").addEventListener("click", function () { if (confirm("Sigur ștergi TOATE corturile? Participanții rămân.")) Store.resetAssignments().then(function () { UI.toast("Corturi șterse.", "info"); }); });
      document.getElementById("logout").addEventListener("click", function () { setAuthed(false); try { sessionStorage.removeItem("corturi.pin"); } catch (e) {} renderLogin(); });
      var demoBtn = document.getElementById("demo");
      if (demoBtn) demoBtn.addEventListener("click", function () { if (confirm("Resetezi complet datele demo?")) Store._reseed().then(function () { UI.toast("Date demo resetate.", "info"); renderApp(); }); });
    });
  }

  // ---- boot -------------------------------------------------------- //
  Store.init().then(function () { if (isAuthed()) renderApp(); else renderLogin(); });
})();
