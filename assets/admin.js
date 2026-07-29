/* =====================================================================
   Admin panel: PIN login, then tabs for participants, tents, live
   assignment overview, requests, and settings.
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
      '<section class="hero fade-in"><span class="eyebrow">Acces organizator</span>' +
        '<h1>Autentificare</h1><p>Introdu codul PIN ca să gestionezi tabăra.</p></section>' +
      '<div class="card mt">' +
        '<div class="field"><label>Cod PIN</label>' +
          '<input class="input" id="pin" type="password" inputmode="numeric" placeholder="••••" autocomplete="off" /></div>' +
        (err ? '<div class="notice" style="background:#fde8e6;color:#b8433c;border-color:#f0b6b0">PIN greșit. Încearcă din nou.</div>' : "") +
        '<button class="btn btn-primary btn-block mt" id="login">Intră</button>' +
        '<p class="muted center mt" style="font-size:.82rem">PIN implicit demo: <strong>1234</strong> (schimbă-l din Setări)</p>' +
      '</div>';
    var pin = document.getElementById("pin");
    function tryLogin() {
      Store.verifyPin(pin.value).then(function (ok) {
        if (ok) { setAuthed(true); renderApp(); } else { renderLogin(true); }
      });
    }
    document.getElementById("login").addEventListener("click", tryLogin);
    pin.addEventListener("keydown", function (e) { if (e.key === "Enter") tryLogin(); });
    pin.focus();
  }

  // ---- shell ------------------------------------------------------- //
  var TABS = [
    { id: "repartizare", label: "Repartizare", icon: "🗺️" },
    { id: "corturi", label: "Corturi", icon: "⛺" },
    { id: "participanti", label: "Participanți", icon: "🧑‍🤝‍🧑" },
    { id: "cereri", label: "Cereri", icon: "✉️" },
    { id: "setari", label: "Setări", icon: "⚙️" }
  ];

  function renderApp() {
    view.innerHTML =
      '<div class="tabs" id="tabs"></div>' +
      '<div id="panel" class="mt"></div>';
    var tabs = document.getElementById("tabs");
    TABS.forEach(function (t) {
      var b = UI.el('<button class="tab' + (t.id === current ? " active" : "") + '" data-id="' + t.id + '">' + t.icon + ' <span>' + t.label + '</span></button>');
      b.addEventListener("click", function () { current = t.id; renderApp(); });
      tabs.appendChild(b);
    });
    updateRequestBadge();
    var p = document.getElementById("panel");
    if (current === "repartizare") renderOverview(p);
    else if (current === "corturi") renderTents(p);
    else if (current === "participanti") renderParticipants(p);
    else if (current === "cereri") renderRequests(p);
    else if (current === "setari") renderSettings(p);
  }

  function updateRequestBadge() {
    Store.listRequests().then(function (rs) {
      var tab = document.querySelector('.tab[data-id="cereri"]');
      if (tab && rs.length) tab.insertAdjacentHTML("beforeend", ' <span class="count-pill">' + rs.length + '</span>');
    });
  }

  // ---- Overview (live) --------------------------------------------- //
  function renderOverview(p) {
    p.innerHTML = '<div id="ov"></div>';
    Promise.all([Store.getTents(), Store.getParticipants()]).then(function (res) {
      var tents = res[0], people = res[1];
      var unassigned = people.filter(function (x) { return !x.tentId; });
      var totalCap = tents.reduce(function (a, t) { return a + t.capacity; }, 0);
      var totalOcc = tents.reduce(function (a, t) { return a + t.occupied; }, 0);
      var ov = document.getElementById("ov");
      ov.innerHTML =
        '<div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:8px">' +
          statTile(people.length, "participanți") +
          statTile(totalOcc + "/" + totalCap, "locuri ocupate") +
          statTile(unassigned.length, "nerepartizați") +
        '</div>';

      ["M", "F"].forEach(function (g) {
        var group = tents.filter(function (t) { return t.gender === g; });
        if (!group.length) return;
        ov.insertAdjacentHTML("beforeend", '<div class="section-title"><h2>' + UI.genderBadge(g) + '</h2></div>');
        var grid = UI.el('<div class="grid"></div>');
        group.forEach(function (t) { grid.appendChild(adminTentCard(t)); });
        ov.appendChild(grid);
      });

      ov.insertAdjacentHTML("beforeend", '<div class="section-title"><h2>Nerepartizați</h2><span class="hint">' + unassigned.length + '</span></div>');
      if (!unassigned.length) ov.insertAdjacentHTML("beforeend", '<div class="card muted center">Toți participanții au un cort 🎉</div>');
      else {
        var wrap = UI.el('<div class="card" style="display:flex;flex-wrap:wrap;gap:6px"></div>');
        unassigned.forEach(function (u) { wrap.appendChild(UI.el('<span class="chip">' + UI.avatar(u.name, "sm") + UI.esc(u.name) + '</span>')); });
        ov.appendChild(wrap);
      }
    });
  }

  function statTile(big, small) {
    return '<div class="card center" style="padding:14px 8px"><div style="font-size:1.5rem;font-weight:900;color:var(--brand-ink)">' + big + '</div>' +
      '<div class="muted" style="font-size:.78rem">' + small + '</div></div>';
  }

  function adminTentCard(t) {
    var pips = "";
    for (var i = 0; i < t.capacity; i++) pips += '<span class="pip' + (i < t.occupied ? " on" : "") + '"></span>';
    var card = UI.el(
      '<div class="tent" style="cursor:default">' +
        '<div class="row"><div class="tent-icon">⛺</div>' +
          '<div class="grow"><div class="tent-name">' + UI.esc(t.name) + '</div>' +
          '<div class="tent-sub">' + t.occupied + '/' + t.capacity + ' · ' + t.free + ' libere</div></div></div>' +
        '<div class="meter">' + pips + '</div>' +
        '<div class="person-list" style="margin-top:2px"></div>' +
      '</div>'
    );
    var list = card.querySelector(".person-list");
    if (!t.occupants.length) list.innerHTML = '<span class="none muted" style="font-size:.84rem">gol</span>';
    t.occupants.forEach(function (o) {
      var row = UI.el('<div class="person" style="cursor:default;padding:7px 10px">' + UI.avatar(o.name, "sm") +
        '<span class="who"><span class="name">' + UI.esc(o.name) + '</span></span>' +
        '<button class="btn btn-danger btn-sm" title="Scoate">✕</button></div>');
      row.querySelector("button").addEventListener("click", function () {
        Store.forceAssign(o.id, null).then(function () { renderOverview(document.getElementById("panel")); });
      });
      list.appendChild(row);
    });
    return card;
  }

  // ---- Tents ------------------------------------------------------- //
  function renderTents(p) {
    p.innerHTML =
      '<button class="btn btn-primary btn-block" id="add-tent">＋ Adaugă cort</button>' +
      '<div id="tent-list" class="mt"></div>';
    document.getElementById("add-tent").addEventListener("click", function () { tentSheet(null); });
    Store.getTents().then(function (tents) {
      var box = document.getElementById("tent-list");
      if (!tents.length) { box.innerHTML = '<div class="empty"><div class="ico">⛺</div><p>Niciun cort încă.</p></div>'; return; }
      box.innerHTML = "";
      tents.forEach(function (t) {
        var row = UI.el(
          '<div class="card mt" style="display:flex;align-items:center;gap:12px">' +
            '<div class="tent-icon">⛺</div>' +
            '<div class="grow"><div style="font-weight:800">' + UI.esc(t.name) + '</div>' +
            '<div class="muted" style="font-size:.84rem">' + UI.genderLabel(t.gender) + ' · ' + t.capacity + ' locuri · ' + t.occupied + ' ocupate</div></div>' +
            '<button class="btn btn-ghost btn-sm edit">✏️</button>' +
            '<button class="btn btn-danger btn-sm del">🗑️</button>' +
          '</div>'
        );
        row.querySelector(".edit").addEventListener("click", function () { tentSheet(t); });
        row.querySelector(".del").addEventListener("click", function () {
          if (confirm('Ștergi cortul „' + t.name + '"? Persoanele din el vor rămâne nerepartizate.'))
            Store.deleteTent(t.id).then(function () { renderTents(p); });
        });
        box.appendChild(row);
      });
    });
  }

  function tentSheet(t) {
    var edit = !!t;
    UI.openSheet(
      '<h2>' + (edit ? "Editează cortul" : "Cort nou") + '</h2>' +
      '<div class="field mt"><label>Nume</label><input class="input" id="t-name" value="' + (edit ? UI.esc(t.name) : "") + '" placeholder="Ex: Bradul" /></div>' +
      '<div class="field"><label>Gen</label><select class="select" id="t-gender">' +
        '<option value="M"' + (edit && t.gender === "M" ? " selected" : "") + '>Băieți</option>' +
        '<option value="F"' + (edit && t.gender === "F" ? " selected" : "") + '>Fete</option></select></div>' +
      '<div class="field"><label>Capacitate (nr. persoane)</label><input class="input" id="t-cap" type="number" min="1" max="20" value="' + (edit ? t.capacity : 4) + '" /></div>' +
      '<button class="btn btn-primary btn-block" id="t-save">' + (edit ? "Salvează" : "Adaugă") + '</button>' +
      '<button class="btn btn-ghost btn-block mt" id="t-cancel">Anulează</button>'
    );
    document.getElementById("t-cancel").addEventListener("click", UI.closeSheet);
    document.getElementById("t-save").addEventListener("click", function () {
      var name = document.getElementById("t-name").value.trim();
      var cap = parseInt(document.getElementById("t-cap").value, 10);
      if (!name || !cap || cap < 1) { UI.toast("Completează numele și capacitatea.", "err"); return; }
      Store.upsertTent({ id: edit ? t.id : null, name: name, gender: document.getElementById("t-gender").value, capacity: cap, sortOrder: edit ? t.sortOrder : 0 })
        .then(function () { UI.closeSheet(); UI.toast(edit ? "Cort salvat." : "Cort adăugat.", "ok"); renderTents(document.getElementById("panel")); });
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
      var box = document.getElementById("plist");
      var q = document.getElementById("pq");
      function draw() {
        var term = q.value.trim().toLowerCase();
        var f = list.filter(function (x) { return x.name.toLowerCase().indexOf(term) >= 0; });
        box.innerHTML = "";
        if (!f.length) { box.innerHTML = '<div class="empty"><div class="ico">🧑‍🤝‍🧑</div><p>Niciun participant.</p></div>'; return; }
        f.forEach(function (x) {
          var row = UI.el('<div class="person" style="cursor:default">' + UI.avatar(x.name) +
            '<span class="who"><span class="name">' + UI.esc(x.name) + '</span>' +
            '<span class="meta">' + UI.genderLabel(x.gender) + (x.tentId ? " · repartizat" : " · liber") + '</span></span>' +
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
      '<p class="muted mt">Câte unul pe linie. Format: <strong>Nume, gen</strong> (M sau F). Ex:</p>' +
      '<div class="card mt" style="font-family:monospace;font-size:.85rem;white-space:pre;color:var(--text-soft)">Andrei, M\nMaria, F\nVlad, M</div>' +
      '<div class="field mt"><textarea class="input" id="bulk-text" rows="8" placeholder="Andrei, M&#10;Maria, F"></textarea></div>' +
      '<button class="btn btn-primary btn-block" id="bulk-save">Adaugă toți</button>' +
      '<button class="btn btn-ghost btn-block mt" id="bulk-cancel">Anulează</button>'
    );
    document.getElementById("bulk-cancel").addEventListener("click", UI.closeSheet);
    document.getElementById("bulk-save").addEventListener("click", function () {
      var lines = document.getElementById("bulk-text").value.split("\n");
      var rows = [];
      lines.forEach(function (ln) {
        ln = ln.trim(); if (!ln) return;
        var parts = ln.split(",");
        var name = parts[0].trim();
        var g = (parts[1] || "M").trim().toUpperCase();
        if (name) rows.push({ name: name, gender: g === "F" ? "F" : "M" });
      });
      if (!rows.length) { UI.toast("Nimic de adăugat.", "err"); return; }
      Store.addParticipants(rows).then(function (r) {
        UI.closeSheet(); UI.toast(r.added + " participanți adăugați.", "ok"); renderParticipants(document.getElementById("panel"));
      });
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
            '<span class="muted" style="font-size:.8rem">' + new Date(r.createdAt).toLocaleString("ro-RO") + '</span></div>' +
            '<div class="muted mt" style="font-size:.88rem">Grup: ' + r.people.map(UI.esc).join(", ") + '</div>' +
            (r.note ? '<div class="notice mt">💬 ' + UI.esc(r.note) + '</div>' : "") +
            '<div class="row mt" style="gap:8px"><button class="btn btn-brand btn-sm grow ok">✓ Aprobă</button>' +
            '<button class="btn btn-danger btn-sm grow no">✕ Respinge</button></div>' +
          '</div>'
        );
        card.querySelector(".ok").addEventListener("click", function () {
          Store.resolveRequest(r.id, true).then(function () { UI.toast("Cerere aprobată.", "ok"); renderApp(); });
        });
        card.querySelector(".no").addEventListener("click", function () {
          Store.resolveRequest(r.id, false).then(function () { UI.toast("Cerere respinsă.", "info"); renderApp(); });
        });
        box.appendChild(card);
      });
    });
  }

  // ---- Settings ---------------------------------------------------- //
  function renderSettings(p) {
    Store.getSettings().then(function (s) {
      p.innerHTML =
        '<div class="card">' +
          '<div class="field"><label>Numele taberei</label><input class="input" id="s-name" value="' + UI.esc(s.eventName) + '" /></div>' +
          '<button class="btn btn-brand btn-sm" id="s-name-save">Salvează numele</button>' +
        '</div>' +
        '<div class="card mt"><div class="row-between"><div><strong>Înscrieri</strong>' +
          '<div class="muted" style="font-size:.84rem">Când sunt închise, participanții nu mai pot rezerva.</div></div>' +
          '<button class="btn ' + (s.bookingOpen ? "btn-brand" : "btn-outline") + ' btn-sm" id="s-toggle">' + (s.bookingOpen ? "Deschise ✓" : "Închise") + '</button></div></div>' +
        '<div class="card mt">' +
          '<div class="field"><label>Schimbă codul PIN</label><input class="input" id="s-pin" type="text" inputmode="numeric" placeholder="PIN nou" /></div>' +
          '<button class="btn btn-brand btn-sm" id="s-pin-save">Salvează PIN</button>' +
        '</div>' +
        '<div class="divider"></div>' +
        '<button class="btn btn-danger btn-block" id="s-reset">Golește toate repartizările</button>' +
        '<button class="btn btn-ghost btn-block mt" id="s-logout">Ieși din cont</button>' +
        '<button class="btn btn-ghost btn-block mt" id="s-demo" style="color:var(--text-soft)">↺ Resetează datele demo</button>';

      document.getElementById("s-name-save").addEventListener("click", function () {
        Store.setEventName(document.getElementById("s-name").value.trim() || "Tabără").then(function () { UI.toast("Nume salvat.", "ok"); });
      });
      document.getElementById("s-toggle").addEventListener("click", function () {
        Store.setBookingOpen(!s.bookingOpen).then(function () { renderSettings(p); });
      });
      document.getElementById("s-pin-save").addEventListener("click", function () {
        var v = document.getElementById("s-pin").value.trim();
        if (v.length < 3) { UI.toast("PIN-ul trebuie să aibă minim 3 caractere.", "err"); return; }
        Store.setPin(v).then(function () { UI.toast("PIN schimbat.", "ok"); document.getElementById("s-pin").value = ""; });
      });
      document.getElementById("s-reset").addEventListener("click", function () {
        if (confirm("Sigur golești TOATE repartizările? Participanții și corturile rămân.")) Store.resetAssignments().then(function () { UI.toast("Repartizări golite.", "info"); });
      });
      document.getElementById("s-logout").addEventListener("click", function () { setAuthed(false); renderLogin(); });
      document.getElementById("s-demo").addEventListener("click", function () {
        if (confirm("Resetezi complet datele demo (participanți, corturi, cereri)?")) Store._reseed().then(function () { UI.toast("Date demo resetate.", "info"); renderApp(); });
      });
    });
  }

  // ---- boot -------------------------------------------------------- //
  Store.init().then(function () {
    if (isAuthed()) renderApp(); else renderLogin();
  });
})();
