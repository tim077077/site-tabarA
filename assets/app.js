/* =====================================================================
   Participant flow: pick your name → pick a tent → pick tentmates →
   confirm. Falls back to a "request to organizer" when nothing fits.
   ===================================================================== */
(function () {
  "use strict";

  var view = document.getElementById("view");
  var stepsEl = document.getElementById("steps");
  var state = { step: 1, me: null, tent: null, selected: new Set(), bookingOpen: true };

  function setSteps(n) {
    var dots = stepsEl.querySelectorAll(".dot");
    dots.forEach(function (d, i) {
      d.className = "dot" + (i + 1 < n ? " done" : i + 1 === n ? " active" : "");
    });
  }

  function go(step) { state.step = step; render(); }

  // ------------------------------------------------------------------ //
  function render() {
    setSteps(state.step);
    if (state.step === 1) return renderPickName();
    if (state.step === 2) return renderPickTent();
    if (state.step === 3) return renderPickMates();
    if (state.step === 4) return renderDone();
  }

  // ---- Step 1: who are you? ---------------------------------------- //
  function renderPickName() {
    view.innerHTML =
      '<section class="hero fade-in">' +
        '<span class="eyebrow">Pasul 1 din 3</span>' +
        '<h1>Cine ești?</h1>' +
        '<p>Caută-ți numele în listă ca să-ți alegi cortul și colegii.</p>' +
      '</section>' +
      '<div class="search mt"><input class="input" id="q" placeholder="Caută-ți numele…" autocomplete="off" /></div>' +
      '<div class="person-list mt" id="people"></div>';

    Store.getParticipants().then(function (list) {
      var box = document.getElementById("people");
      var q = document.getElementById("q");
      function draw() {
        var term = q.value.trim().toLowerCase();
        var filtered = list.filter(function (p) { return p.name.toLowerCase().indexOf(term) >= 0; });
        if (!filtered.length) { box.innerHTML = emptyState("🔍", "Niciun nume găsit."); return; }
        box.innerHTML = "";
        filtered.slice(0, 60).forEach(function (p) {
          var assigned = p.tentId ? '<span class="meta">✓ deja repartizat</span>' : '<span class="meta">' + UI.genderLabel(p.gender) + '</span>';
          var row = UI.el(
            '<button class="person">' + UI.avatar(p.name) +
            '<span class="who"><span class="name">' + UI.esc(p.name) + '</span>' + assigned + '</span>' +
            '<span style="font-size:1.2rem;color:var(--text-soft)">›</span></button>'
          );
          row.addEventListener("click", function () { state.me = p; state.selected = new Set(); go(2); });
          box.appendChild(row);
        });
      }
      q.addEventListener("input", draw);
      draw();
      q.focus();
    });
  }

  // ---- Step 2: pick a tent ----------------------------------------- //
  function renderPickTent() {
    view.innerHTML =
      '<section class="hero fade-in">' +
        '<span class="eyebrow">Pasul 2 din 3 · ' + UI.esc(state.me.name) + '</span>' +
        '<h1>Alege un cort</h1>' +
        '<p>Corturi pentru ' + UI.genderLabel(state.me.gender).toLowerCase() + '. Vezi câte locuri sunt libere.</p>' +
      '</section>' +
      '<div id="assigned-banner"></div>' +
      '<div class="section-title"><h2>Corturi disponibile</h2><span class="hint" id="livehint">actualizat live</span></div>' +
      '<div class="grid" id="tents"></div>' +
      '<button class="btn btn-ghost btn-block mt-lg" id="btn-back">← Nu sunt eu</button>';

    document.getElementById("btn-back").addEventListener("click", function () { state.me = null; go(1); });
    drawTents();
  }

  function drawTents() {
    Promise.all([Store.getTents(state.me.gender), Store.getSettings(), Store.getParticipant(state.me.id)])
      .then(function (res) {
        var tents = res[0]; state.bookingOpen = res[1].bookingOpen;
        state.me = res[2] || state.me; // refresh assignment
        var box = document.getElementById("tents");
        var banner = document.getElementById("assigned-banner");

        // already assigned?
        var mine = tents.find(function (t) {
          return t.occupants.some(function (o) { return o.id === state.me.id; });
        });
        banner.innerHTML = "";
        if (mine) {
          var b = UI.el(
            '<div class="card mt" style="border-color:var(--brand);background:var(--pine-50)">' +
              '<div class="row-between"><div><strong>Ești în cortul „' + UI.esc(mine.name) + '"</strong>' +
              '<div class="muted" style="font-size:.85rem">Colegi: ' + mine.occupants.map(function (o) { return UI.esc(o.name); }).join(", ") + '</div></div>' +
              '<button class="btn btn-outline btn-sm" id="btn-leave">Schimbă cortul</button></div></div>'
          );
          banner.appendChild(b);
          document.getElementById("btn-leave").addEventListener("click", function () {
            Store.leave(state.me.id).then(function () { UI.toast("Ai ieșit din cort. Alege altul.", "info"); drawTents(); });
          });
        }

        if (!state.bookingOpen) {
          banner.insertAdjacentHTML("afterbegin", '<div class="notice mt">🔒 Înscrierile sunt închise momentan. Poți vedea corturile, dar nu poți rezerva.</div>');
        }

        box.innerHTML = "";
        tents.forEach(function (t) { box.appendChild(tentCard(t, mine)); });

        // request fallback: no tent can fit even one more person
        var anyFree = tents.some(function (t) { return t.free > 0; });
        if (!anyFree && !mine) {
          box.insertAdjacentHTML("afterend",
            '<div class="notice mt-lg">😕 Toate corturile sunt pline. Poți trimite o cerere organizatorului.</div>');
          var req = UI.el('<button class="btn btn-primary btn-block mt">✉️ Trimite o cerere</button>');
          req.addEventListener("click", function () { openRequestSheet([state.me.id]); });
          box.parentNode.insertBefore(req, document.getElementById("btn-back"));
        }
      });
  }

  function tentCard(t, mine) {
    var iAmHere = mine && mine.id === t.id;
    var full = t.free <= 0 && !iAmHere;
    var pips = "";
    for (var i = 0; i < t.capacity; i++) pips += '<span class="pip' + (i < t.occupied ? " on" : "") + '"></span>';
    var occ = t.occupants.length
      ? '<div class="avatar-stack">' + t.occupants.slice(0, 6).map(function (o) { return UI.avatar(o.name, "sm"); }).join("") + '</div>' +
        '<span class="muted" style="font-size:.82rem">' + t.occupants.map(function (o) { return UI.esc(o.name.split(" ")[0]); }).join(", ") + '</span>'
      : '<span class="none">Cort gol — fii primul!</span>';

    var freeTxt = full
      ? '<span class="badge badge-full">Plin</span>'
      : '<span class="free">' + t.free + ' ' + (t.free === 1 ? "loc liber" : "locuri libere") + '</span>';

    var card = UI.el(
      '<div class="tent ' + (full ? "full" : "") + '">' +
        '<div class="row"><div class="tent-icon">⛺</div>' +
          '<div class="grow"><div class="tent-name">' + UI.esc(t.name) + '</div>' +
          '<div class="tent-sub">' + t.capacity + ' persoane · ' + UI.genderLabel(t.gender) + '</div></div>' +
          (iAmHere ? '<span class="badge badge-ok">Cortul tău</span>' : "") +
        '</div>' +
        '<div class="meter">' + pips + '</div>' +
        '<div class="capline"><span class="occupants">' + occ + '</span>' + freeTxt + '</div>' +
      '</div>'
    );
    if (!full && state.bookingOpen && !iAmHere) {
      card.addEventListener("click", function () {
        // if assigned elsewhere, leave first
        if (state.me.tentId && state.me.tentId !== t.id) {
          Store.leave(state.me.id).then(function () { state.me.tentId = null; enterTent(t); });
        } else { enterTent(t); }
      });
    }
    return card;
  }

  function enterTent(t) {
    state.tent = t; state.selected = new Set([state.me.id]); go(3);
  }

  // ---- Step 3: pick tentmates -------------------------------------- //
  function renderPickMates() {
    var t = state.tent;
    view.innerHTML =
      '<section class="hero fade-in">' +
        '<span class="eyebrow">Pasul 3 din 3 · Cortul „' + UI.esc(t.name) + '"</span>' +
        '<h1>Cu cine stai?</h1>' +
        '<p>Alege colegii din listă. Poți lăsa locuri libere — se pot alătura mai târziu.</p>' +
      '</section>' +
      '<div class="card mt">' +
        '<div class="row-between"><strong>Locuri</strong><span id="cap-label" class="badge badge-soft"></span></div>' +
        '<div class="meter mt" id="cap-meter"></div>' +
      '</div>' +
      '<div class="section-title"><h2>Persoane disponibile</h2><span class="hint">' + UI.genderLabel(t.gender) + '</span></div>' +
      '<div class="person-list" id="mates"></div>' +
      '<button class="btn btn-ghost btn-block mt-lg" id="btn-back2">← Alt cort</button>' +
      '<div class="sticky-cta"><div class="inner">' +
        '<button class="btn btn-primary btn-block" id="btn-book">Rezervă cortul</button>' +
      '</div></div>';

    document.getElementById("btn-back2").addEventListener("click", function () { go(2); });
    document.getElementById("btn-book").addEventListener("click", submitBooking);

    Store.getParticipants().then(function (list) {
      // people addable: same gender + unassigned (or it's me)
      var addable = list.filter(function (p) {
        return p.gender === t.gender && (!p.tentId || p.id === state.me.id);
      });
      // me first
      addable.sort(function (a, b) {
        if (a.id === state.me.id) return -1; if (b.id === state.me.id) return 1;
        return a.name.localeCompare(b.name, "ro");
      });
      var box = document.getElementById("mates");
      box.innerHTML = "";
      addable.forEach(function (p) {
        var isMe = p.id === state.me.id;
        var row = UI.el(
          '<button class="person' + (state.selected.has(p.id) ? " selected" : "") + '">' +
            UI.avatar(p.name) +
            '<span class="who"><span class="name">' + UI.esc(p.name) + (isMe ? ' <span class="badge badge-soft">tu</span>' : "") + '</span>' +
            '<span class="meta">' + UI.genderLabel(p.gender) + '</span></span>' +
            '<span class="check"></span></button>'
        );
        row.addEventListener("click", function () {
          if (isMe) return; // you are always in
          if (state.selected.has(p.id)) state.selected.delete(p.id);
          else {
            if (state.selected.size >= t.capacity) { UI.toast("Cortul are doar " + t.capacity + " locuri.", "err"); return; }
            state.selected.add(p.id);
          }
          row.classList.toggle("selected");
          updateCap();
        });
        box.appendChild(row);
      });
      updateCap();
    });
  }

  function updateCap() {
    var t = state.tent, sel = state.selected.size;
    var meter = document.getElementById("cap-meter");
    var label = document.getElementById("cap-label");
    if (!meter) return;
    var html = "";
    for (var i = 0; i < t.capacity; i++) html += '<span class="pip' + (i < sel ? " you" : "") + '"></span>';
    meter.innerHTML = html;
    label.textContent = sel + " / " + t.capacity + " ales" + (sel === 1 ? "" : "e");
    document.getElementById("btn-book").textContent =
      sel >= t.capacity ? "Rezervă cortul (complet)" : "Rezervă cortul (" + sel + "/" + t.capacity + ")";
  }

  function submitBooking() {
    var btn = document.getElementById("btn-book");
    btn.disabled = true; btn.textContent = "Se rezervă…";
    Store.book(state.tent.id, Array.from(state.selected)).then(function (res) {
      if (res.ok) { state.result = res.tent; go(4); }
      else {
        btn.disabled = false; updateCap();
        UI.toast(res.message, "err");
        if (res.code === "no_space") offerRequest();
      }
    });
  }

  function offerRequest() {
    var ids = Array.from(state.selected);
    var box = document.getElementById("mates");
    if (document.getElementById("inline-req")) return;
    var n = UI.el('<div id="inline-req" class="notice mt">Nu mai e loc aici. <a href="#" id="mk-req"><strong>Trimite o cerere organizatorului →</strong></a></div>');
    box.parentNode.insertBefore(n, box);
    document.getElementById("mk-req").addEventListener("click", function (e) { e.preventDefault(); openRequestSheet(ids); });
  }

  // ---- Step 4: confirmation ---------------------------------------- //
  function renderDone() {
    var t = state.result;
    setSteps(4);
    view.innerHTML =
      '<div class="card fade-in" style="overflow:hidden;padding:0">' +
        '<div class="confirm-hero"><div class="mark">✓</div>' +
          '<h1>Gata! Ești în cort.</h1>' +
          '<p class="muted mt">Te-am repartizat în cortul <strong>„' + UI.esc(t.name) + '"</strong>.</p>' +
        '</div>' +
        '<div style="padding:0 18px 18px">' +
          '<div class="section-title" style="margin:8px 2px 10px"><h2>Colegi de cort</h2><span class="hint">' + t.occupants.length + '/' + t.capacity + '</span></div>' +
          '<div class="person-list" id="final-list"></div>' +
          (t.free > 0 ? '<div class="notice mt">' + t.free + ' ' + (t.free === 1 ? "loc rămas liber" : "locuri rămase libere") + ' — se pot alătura și alții.</div>' : "") +
        '</div>' +
      '</div>' +
      '<button class="btn btn-brand btn-block mt-lg" id="btn-home">Termină</button>' +
      '<button class="btn btn-ghost btn-block mt" id="btn-change">Schimbă cortul</button>';

    var fl = document.getElementById("final-list");
    t.occupants.forEach(function (o) {
      fl.appendChild(UI.el('<div class="person" style="cursor:default">' + UI.avatar(o.name) +
        '<span class="who"><span class="name">' + UI.esc(o.name) + (o.id === state.me.id ? ' <span class="badge badge-soft">tu</span>' : "") + '</span></span></div>'));
    });
    UI.confetti();
    document.getElementById("btn-home").addEventListener("click", function () { state = { step: 1, me: null, tent: null, selected: new Set(), bookingOpen: state.bookingOpen }; go(1); });
    document.getElementById("btn-change").addEventListener("click", function () {
      Store.leave(state.me.id).then(function () { go(2); });
    });
  }

  // ---- Request sheet ----------------------------------------------- //
  function openRequestSheet(ids) {
    Store.getParticipants().then(function (list) {
      var names = ids.map(function (id) { var p = list.find(function (x) { return x.id === id; }); return p ? p.name : ""; });
      UI.openSheet(
        '<h2>Trimite o cerere</h2>' +
        '<p class="muted mt">Organizatorul va vedea cererea și te va ajuta cu repartizarea.</p>' +
        '<div class="card mt"><strong>Grup:</strong> ' + names.map(UI.esc).join(", ") + '</div>' +
        '<div class="field mt"><label>Mesaj (opțional)</label><textarea class="input" id="req-note" rows="3" placeholder="Ex: vrem să stăm împreună, dar nu mai e loc…"></textarea></div>' +
        '<button class="btn btn-primary btn-block" id="req-send">Trimite cererea</button>' +
        '<button class="btn btn-ghost btn-block mt" id="req-cancel">Anulează</button>'
      );
      document.getElementById("req-cancel").addEventListener("click", UI.closeSheet);
      document.getElementById("req-send").addEventListener("click", function () {
        var note = document.getElementById("req-note").value;
        Store.createRequest(state.me.id, ids, note).then(function () {
          UI.closeSheet(); UI.toast("Cererea a fost trimisă! ✉️", "ok");
        });
      });
    });
  }

  function emptyState(ico, msg) {
    return '<div class="empty"><div class="ico">' + ico + '</div><p>' + UI.esc(msg) + '</p></div>';
  }

  // ---- boot -------------------------------------------------------- //
  Store.init().then(function () {
    return Store.getSettings();
  }).then(function (s) {
    document.getElementById("event-name").textContent = s.eventName;
    document.title = s.eventName + " — Corturi";
    render();
  });
})();
