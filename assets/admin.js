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
  function downloadRoster() {
    Promise.all([Store.getTents(), Store.getParticipants()]).then(function (res) {
      var tents = res[0].slice().sort(function (a, b) { return (a.number || 0) - (b.number || 0); });
      var people = res[1];
      var memberIds = {}, invitedIds = {};
      tents.forEach(function (t) { t.occupants.forEach(function (o) { memberIds[o.id] = 1; }); (t.invited || []).forEach(function (iv) { invitedIds[iv.id] = 1; }); });
      var rows = [["Nr cort", "Cort", "Gen", "Capacitate", "Rol", "Nume", "Făcut de"]];
      tents.forEach(function (t) {
        var nm = UI.tentName(t), g = UI.genderLabel(t.gender);
        t.occupants.forEach(function (o) { rows.push([t.number || "", nm, g, t.capacity, "Membru", o.name, t.createdByName]); });
        (t.invited || []).forEach(function (iv) { rows.push([t.number || "", nm, g, t.capacity, "Invitat (în așteptare)", iv.name, t.createdByName]); });
      });
      people.filter(function (pp) { return !memberIds[pp.id] && !invitedIds[pp.id]; }).forEach(function (pp) { rows.push(["", "— nerepartizat —", UI.genderLabel(pp.gender), "", "", pp.name, ""]); });
      var csv = "﻿" + rows.map(function (r) { return r.map(function (f) { return '"' + String(f == null ? "" : f).replace(/"/g, '""') + '"'; }).join(","); }).join("\r\n");
      var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      var url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = "corturi-fagaras-" + new Date().toISOString().slice(0, 10) + ".csv";
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      UI.toast("Lista descărcată (CSV).", "ok");
    });
  }

  function openPrintableRoster() {
    Promise.all([Store.getTents(), Store.getParticipants(), Store.getSettings()]).then(function (res) {
      var tents = res[0].slice().sort(function (a, b) { return (a.number || 0) - (b.number || 0); });
      var people = res[1], ev = (res[2].eventName || "Tabără");
      var memberIds = {}, invitedIds = {};
      tents.forEach(function (t) { t.occupants.forEach(function (o) { memberIds[o.id] = 1; }); (t.invited || []).forEach(function (iv) { invitedIds[iv.id] = 1; }); });
      var assigned = Object.keys(memberIds).length;
      var esc = UI.esc;

      function tentBlock(t) {
        var li = t.occupants.map(function (o) { return "<li>" + esc(o.name) + "</li>"; }).join("");
        var inv = (t.invited || []).length ? '<div class="inv">În așteptare: ' + t.invited.map(function (x) { return esc(x.name); }).join(", ") + '</div>' : "";
        var freeN = t.capacity - t.filled;
        var freeTxt = freeN > 0 ? '<span class="free">' + freeN + ' ' + (freeN === 1 ? "loc liber" : "locuri libere") + '</span>' : '<span class="full">complet</span>';
        return '<div class="cort">' +
          '<div class="cort-h"><span class="num">Cortul ' + (t.number || "?") + '</span>' + (t.name ? ' <span class="nick">„' + esc(t.name) + '"</span>' : "") +
          '<span class="cap">' + t.filled + '/' + t.capacity + ' · ' + freeTxt + '</span></div>' +
          '<div class="by">făcut de ' + esc(t.createdByName) + '</div>' +
          (li ? '<ol>' + li + '</ol>' : '<div class="empty">— gol —</div>') + inv + '</div>';
      }
      function section(g, label) {
        var group = tents.filter(function (t) { return t.gender === g; });
        var html = '<h2>' + label + ' <span class="cnt">' + group.length + ' corturi</span></h2>';
        html += group.length ? '<div class="grid">' + group.map(tentBlock).join("") + '</div>' : '<p class="muted">— niciun cort încă —</p>';
        var un = people.filter(function (pp) { return pp.gender === g && !memberIds[pp.id] && !invitedIds[pp.id]; });
        html += '<div class="unassigned"><strong>Nerepartizați ' + label.toLowerCase() + ' (' + un.length + '):</strong> ' + (un.length ? un.map(function (pp) { return esc(pp.name); }).join(", ") : "—") + '</div>';
        return html;
      }

      var now = new Date().toLocaleString("ro-RO");
      var html = '<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Corturi · ' + esc(ev) + '</title><style>' +
        '*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c2530;background:#f4f6f8;margin:0;padding:28px 18px 60px;line-height:1.45}' +
        '.wrap{max-width:820px;margin:0 auto}h1{font-size:1.7rem;margin:0 0 2px;color:#20303f}.sub{color:#5f7183;margin-bottom:6px}' +
        '.stats{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 24px}.stat{background:#fff;border:1px solid #e2e8ee;border-radius:12px;padding:10px 16px;text-align:center;flex:1;min-width:90px}.stat b{display:block;font-size:1.4rem;color:#2f6f9c}.stat span{font-size:.75rem;color:#6a7c8c}' +
        'h2{font-size:1.15rem;margin:26px 0 12px;padding-bottom:6px;border-bottom:2px solid #cfe0ec;color:#20303f}h2 .cnt{font-size:.8rem;color:#8496a6;font-weight:400}' +
        '.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:560px){.grid{grid-template-columns:1fr}}' +
        '.cort{background:#fff;border:1px solid #e2e8ee;border-radius:14px;padding:12px 14px;break-inside:avoid}' +
        '.cort-h{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.num{font-weight:800;font-size:1.05rem;color:#20303f}.nick{color:#5f7183;font-size:.9rem}.cap{margin-left:auto;font-size:.78rem;color:#6a7c8c}' +
        '.free{color:#2f8f5f;font-weight:600}.full{color:#b06a4a;font-weight:600}.by{font-size:.76rem;color:#8496a6;margin:2px 0 8px}' +
        'ol{margin:0;padding-left:22px}ol li{margin:2px 0}.inv{margin-top:8px;font-size:.82rem;color:#8a6d3b;background:#fdf3e0;border:1px solid #f0e0c0;border-radius:8px;padding:6px 9px}.empty{color:#a7b3bf;font-style:italic;font-size:.85rem}' +
        '.unassigned{margin-top:12px;font-size:.85rem;color:#5f7183;background:#fff;border:1px solid #e2e8ee;border-radius:10px;padding:10px 12px}' +
        '.toolbar{position:sticky;top:0;background:#f4f6f8;padding:6px 0 14px;display:flex;gap:8px}.btn{border:none;border-radius:10px;padding:10px 18px;font-weight:700;cursor:pointer;font-size:.95rem}.btn.p{background:#2f6f9c;color:#fff}.btn.g{background:#e6edf2;color:#33465a}' +
        '@media print{body{background:#fff;padding:0}.toolbar{display:none}.stat,.cort,.unassigned{border-color:#ccc}}' +
        '</style></head><body><div class="wrap">' +
        '<div class="toolbar"><button class="btn p" onclick="window.print()">🖨️ Printează / Salvează PDF</button><button class="btn g" onclick="window.close()">Închide</button></div>' +
        '<h1>⛺ Corturi — ' + esc(ev) + '</h1><div class="sub">Generat: ' + now + '</div>' +
        '<div class="stats"><div class="stat"><b>' + people.length + '</b><span>participanți</span></div><div class="stat"><b>' + tents.length + '</b><span>corturi</span></div><div class="stat"><b>' + assigned + '</b><span>repartizați</span></div><div class="stat"><b>' + (people.length - assigned) + '</b><span>nerepartizați</span></div></div>' +
        section("M", "Băieți") + section("F", "Fete") +
        '</div></body></html>';

      var w = window.open("", "_blank");
      if (!w) { UI.toast("Permite pop-up-urile ca să deschizi lista.", "err"); return; }
      w.document.write(html); w.document.close();
    });
  }

  function renderOverview(p) {
    p.innerHTML = '<button class="btn btn-primary btn-block" id="print">📋 Lista corturilor (printează / PDF)</button>' +
      '<button class="btn btn-ghost btn-block mt" id="dl" style="font-size:.84rem;color:var(--text-soft)">sau descarcă CSV brut</button>' +
      '<div id="ov" class="mt"></div>';
    document.getElementById("print").addEventListener("click", openPrintableRoster);
    document.getElementById("dl").addEventListener("click", downloadRoster);
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
    for (var i = 0; i < t.capacity; i++) { var c = i < t.occupied ? " on" : (i < t.filled ? " res" : ""); pips += '<span class="pip' + c + '"></span>'; }
    var full = t.filled >= t.capacity;
    var card = UI.el(
      '<div class="cort" style="cursor:default">' +
        '<div class="row"><div class="cort-emoji">' + UI.tentEmoji(t) + '</div>' +
          '<div class="grow"><div class="cort-name">' + UI.esc(UI.tentName(t)) + '</div>' +
          '<div class="cort-sub">' + t.filled + '/' + t.capacity + ' ocupate · ' + UI.esc(t.createdByName) + '</div></div></div>' +
        '<div class="meter">' + pips + '</div>' +
        '<div class="person-list"></div>' +
        (full ? "" : '<button class="btn btn-glass btn-sm add">＋ Adaugă în cort</button>') +
      '</div>'
    );
    var list = card.querySelector(".person-list");
    if (!t.occupants.length && !(t.invited || []).length) list.innerHTML = '<span class="none muted" style="font-size:.84rem">gol</span>';
    t.occupants.forEach(function (o) {
      var row = UI.el('<div class="person" style="cursor:default;padding:8px 11px">' + UI.avatar(o.name, "sm") +
        '<span class="who"><span class="name">' + UI.esc(o.name) + '</span></span>' +
        '<button class="btn btn-danger btn-sm" title="Scoate">✕</button></div>');
      row.querySelector("button").addEventListener("click", function () { Store.forceAssign(o.id, null).then(function () { renderOverview(document.getElementById("panel")); }); });
      list.appendChild(row);
    });
    (t.invited || []).forEach(function (iv) {
      var row = UI.el('<div class="person" style="cursor:default;padding:8px 11px">' + UI.avatar(iv.name, "sm pending") +
        '<span class="who"><span class="name">' + UI.esc(iv.name) + '</span><span class="meta">invitat · în așteptare</span></span>' +
        '<button class="btn btn-glass btn-sm" title="Anulează invitația">✕</button></div>');
      row.querySelector("button").addEventListener("click", function () { Store.adminCancelInvite(iv.inviteId).then(function () { renderOverview(document.getElementById("panel")); }); });
      list.appendChild(row);
    });
    var addBtn = card.querySelector(".add");
    if (addBtn) addBtn.addEventListener("click", function () { openAddToTent(t); });
    return card;
  }

  function openAddToTent(t) {
    Store.getParticipants().then(function (all) {
      var free = all.filter(function (p) { return p.gender === t.gender && !p.tentId; });
      var rows = free.length ? free.map(function (p) { return '<button class="person add-p" data-id="' + p.id + '">' + UI.avatar(p.name, "sm") + '<span class="who"><span class="name">' + UI.esc(p.name) + '</span></span><span class="chev">＋</span></button>'; }).join("") : '<div class="muted" style="padding:6px 2px">Nimeni liber de genul acesta.</div>';
      UI.openSheet('<h2>Adaugă în „' + UI.esc(UI.tentName(t)) + '"</h2><p class="muted mt" style="font-size:.88rem">Alege pe cine adaugi (îl repartizezi direct, fără invitație).</p><div class="search mt"><input class="input" id="aq" placeholder="Caută…" /></div><div class="person-list mt" id="alist">' + rows + '</div><button class="btn btn-ghost btn-block mt" id="acancel">Închide</button>');
      document.getElementById("acancel").addEventListener("click", UI.closeSheet);
      var q = document.getElementById("aq");
      q.addEventListener("input", function () { var term = q.value.trim().toLowerCase(); Array.prototype.forEach.call(document.querySelectorAll("#alist .add-p"), function (b) { b.style.display = b.querySelector(".name").textContent.toLowerCase().indexOf(term) >= 0 ? "" : "none"; }); });
      Array.prototype.forEach.call(document.querySelectorAll("#alist .add-p"), function (b) {
        b.addEventListener("click", function () { Store.forceAssign(b.dataset.id, t.id).then(function () { UI.closeSheet(); UI.toast("Adăugat în cort.", "ok"); renderOverview(document.getElementById("panel")); }); });
      });
    });
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
      '<div class="notice mt" style="font-size:.85rem">Verifică genurile — unele au fost <strong>ghicite</strong> din nume. Apasă M/F ca să corectezi. Filtrează după gen mai jos.</div>' +
      '<div class="search mt"><input class="input" id="pq" placeholder="Caută…" /></div>' +
      '<div class="row mt" style="gap:6px"><button class="btn btn-glass btn-sm gf active" data-g="all">Toți</button>' +
      '<button class="btn btn-glass btn-sm gf" data-g="M">Băieți</button>' +
      '<button class="btn btn-glass btn-sm gf" data-g="F">Fete</button>' +
      '<span class="grow"></span><span class="muted" id="pcount" style="font-size:.82rem"></span></div>' +
      '<div class="person-list mt" id="plist"></div>';
    document.getElementById("bulk").addEventListener("click", bulkSheet);
    var filter = "all";
    Store.getParticipants().then(function (list) {
      var box = document.getElementById("plist"), q = document.getElementById("pq");
      function draw() {
        var term = q.value.trim().toLowerCase();
        var f = list.filter(function (x) { return x.name.toLowerCase().indexOf(term) >= 0 && (filter === "all" || x.gender === filter); });
        document.getElementById("pcount").textContent = f.length + " / " + list.length;
        box.innerHTML = "";
        if (!f.length) { box.innerHTML = '<div class="empty"><div class="ico">🧑‍🤝‍🧑</div><p>Niciun participant.</p></div>'; return; }
        f.forEach(function (x) {
          var row = UI.el('<div class="person" style="cursor:default">' + UI.avatar(x.name) +
            '<span class="who"><span class="name">' + UI.esc(x.name) + '</span>' +
            '<span class="meta">' + (x.tentId ? "are cort" : "liber") + '</span></span>' +
            '<span class="gtoggle" style="display:inline-flex;gap:3px;margin-right:6px">' +
            '<button class="btn btn-sm gm" style="padding:6px 10px;' + (x.gender === "M" ? "background:var(--grad);color:var(--ink)" : "background:var(--glass);color:var(--text-soft)") + '">M</button>' +
            '<button class="btn btn-sm gf2" style="padding:6px 10px;' + (x.gender === "F" ? "background:var(--grad);color:var(--ink)" : "background:var(--glass);color:var(--text-soft)") + '">F</button></span>' +
            '<button class="btn btn-glass btn-sm ph" title="Telefon" style="padding:6px 9px">📱</button>' +
            '<button class="btn btn-danger btn-sm del" style="padding:6px 9px">🗑️</button></div>');
          function setG(g) { if (x.gender === g) return; x.gender = g; Store.setGender(x.id, g).then(function () { draw(); }); }
          row.querySelector(".gm").addEventListener("click", function () { setG("M"); });
          row.querySelector(".gf2").addEventListener("click", function () { setG("F"); });
          row.querySelector(".ph").addEventListener("click", function () {
            var v = prompt("Telefon pentru " + x.name + " (pentru verificare). Lasă gol ca să anulezi:", "");
            if (v && v.trim()) Store.setPhone(x.id, v.trim()).then(function () { UI.toast("Telefon salvat.", "ok"); });
          });
          row.querySelector(".del").addEventListener("click", function () { if (confirm('Ștergi pe „' + x.name + '"?')) Store.deleteParticipant(x.id).then(function () { renderParticipants(p); }); });
          box.appendChild(row);
        });
      }
      Array.prototype.forEach.call(document.querySelectorAll(".gf"), function (b) {
        b.addEventListener("click", function () { Array.prototype.forEach.call(document.querySelectorAll(".gf"), function (x) { x.classList.remove("active"); }); b.classList.add("active"); filter = b.dataset.g; draw(); });
      });
      q.addEventListener("input", draw); draw();
    });
  }

  function bulkSheet() {
    UI.openSheet(
      '<h2>Adaugă participanți</h2>' +
      '<p class="muted mt" style="font-size:.9rem">Câte unul pe linie: <strong>Nume, gen, telefon</strong>. Telefonul e opțional (pentru verificare).</p>' +
      '<div class="card mt" style="font-family:monospace;font-size:.85rem;white-space:pre;color:var(--text-soft)">Andrei, M, 0722123456\nMaria, F</div>' +
      '<div class="field mt"><textarea class="input" id="txt" rows="8" placeholder="Andrei, M, 0722123456&#10;Maria, F"></textarea></div>' +
      '<button class="btn btn-primary btn-block" id="save">Adaugă toți</button>' +
      '<button class="btn btn-ghost btn-block mt" id="cancel">Anulează</button>'
    );
    document.getElementById("cancel").addEventListener("click", UI.closeSheet);
    document.getElementById("save").addEventListener("click", function () {
      var rows = [];
      document.getElementById("txt").value.split("\n").forEach(function (ln) {
        ln = ln.trim(); if (!ln) return;
        var parts = ln.split(","), name = (parts[0] || "").trim(), g = (parts[1] || "M").trim().toUpperCase(), phone = (parts[2] || "").trim();
        if (name) rows.push({ name: name, gender: g === "F" ? "F" : "M", phone: phone });
      });
      if (!rows.length) { UI.toast("Nimic de adăugat.", "err"); return; }
      Store.addParticipants(rows).then(function (r) { UI.closeSheet(); UI.toast((r.added || 0) + " adăugați.", "ok"); renderParticipants(document.getElementById("panel")); });
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
