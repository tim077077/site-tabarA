/* =====================================================================
   Participant flow:
   landing → pick your name → VERIFY (phone) → corturi.
   You create a cort or join one; to add friends you INVITE them and they
   accept on their own device — nobody is force-added. One tent per person.
   ===================================================================== */
(function () {
  "use strict";

  var view = document.getElementById("view");
  var app = document.getElementById("app");
  var landing = document.getElementById("landing");
  var state = { bookingOpen: true };
  var pollTimer = null;
  function me() { return Store.session(); }
  function stopPoll() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

  function enterApp() {
    landing.style.transition = "opacity .5s, transform .5s";
    landing.style.opacity = "0"; landing.style.transform = "scale(1.04)";
    setTimeout(function () {
      landing.classList.add("hidden"); app.classList.remove("hidden"); window.scrollTo(0, 0);
      if (me()) renderCorts(); else renderName();
    }, 460);
  }

  // ---- Step 1: who are you? --------------------------------------- //
  function renderName() { stopPoll();
    view.innerHTML =
      '<div class="screen-head"><span class="eyebrow-sm">Pasul 1</span><h1>Cine ești?</h1>' +
      '<p>Caută-ți numele în listă.</p></div>' +
      '<div class="search mt"><input class="input" id="q" placeholder="Caută-ți numele…" autocomplete="off" /></div>' +
      '<div class="person-list mt" id="people"></div>';
    Store.getParticipants().then(function (list) {
      var box = document.getElementById("people"), q = document.getElementById("q");
      function draw() {
        var term = q.value.trim().toLowerCase();
        var f = list.filter(function (p) { return p.name.toLowerCase().indexOf(term) >= 0; });
        box.innerHTML = f.length ? "" : empty("🔍", "Niciun nume găsit.");
        f.slice(0, 80).forEach(function (p) {
          var row = UI.el('<button class="person">' + UI.avatar(p.name) + '<span class="who"><span class="name">' + UI.esc(p.name) + '</span><span class="meta">' + (p.tentId ? "are un cort" : UI.genderLabel(p.gender)) + '</span></span><span class="chev">›</span></button>');
          row.addEventListener("click", function () { renderVerify(p); });
          box.appendChild(row);
        });
      }
      q.addEventListener("input", draw); draw();
    });
  }

  // ---- Step 2: verify identity by phone --------------------------- //
  function renderVerify(p) { stopPoll();
    view.innerHTML =
      '<div class="screen-head"><button class="back" id="back">‹ Nu sunt eu</button>' +
      '<span class="eyebrow-sm">Pasul 2 · confirmare</span><h1>Ești ' + UI.esc(p.name.split(" ")[0]) + '?</h1>' +
      '<p>Ca să nu te aleagă altcineva, confirmă cu <strong>numărul tău de telefon</strong> (cel din formular).</p></div>' +
      '<div class="card mt-lg"><div class="row" style="gap:12px;margin-bottom:14px">' + UI.avatar(p.name, "lg round") +
      '<div><div style="font-family:var(--display);font-weight:700;font-size:1.1rem">' + UI.esc(p.name) + '</div><div class="muted" style="font-size:.85rem">' + UI.genderLabel(p.gender) + '</div></div></div>' +
      '<div class="field"><label>Numărul tău de telefon</label><input class="input" id="phone" type="tel" inputmode="tel" placeholder="ex: 07xx xxx xxx" autocomplete="off" /></div>' +
      '<div id="verr"></div>' +
      '<button class="btn btn-primary btn-block" id="go">Confirmă și intră</button></div>';
    document.getElementById("back").addEventListener("click", renderName);
    var input = document.getElementById("phone");
    function submit() {
      var btn = document.getElementById("go"); btn.disabled = true; btn.textContent = "Se verifică…";
      Store.verifyIdentity(p.id, input.value).then(function (r) {
        if (r.ok) { renderCorts(); return; }
        btn.disabled = false; btn.textContent = "Confirmă și intră";
        var box = document.getElementById("verr");
        if (r.code === "nophone") box.innerHTML = '<div class="notice warn">Nu avem numărul tău în listă. Cere organizatorului să ți-l adauge (Admin → Participanți).</div>';
        else if (r.code === "mismatch") box.innerHTML = '<div class="notice warn">Numărul nu se potrivește cu cel din listă. Verifică cifrele sau întreabă organizatorul.</div>';
        else box.innerHTML = '<div class="notice warn">A apărut o eroare. Mai încearcă o dată.</div>';
      });
    }
    document.getElementById("go").addEventListener("click", submit);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    input.focus();
  }

  // ---- Corturi --------------------------------------------------- //
  function renderCorts() {
    var s = me();
    view.innerHTML =
      '<div class="screen-head"><button class="back" id="back">‹ Nu sunt eu</button>' +
      '<span class="eyebrow-sm">Salut, ' + UI.esc(s.name.split(" ")[0]) + ' 👋</span><h1>Corturile voastre</h1></div>' +
      '<div id="invites"></div><div id="mine-slot"></div>' +
      '<div class="section-title"><h2>Corturi ' + UI.genderLabel(s.gender).toLowerCase() + '</h2><span class="hint">live</span></div>' +
      '<div class="grid" id="corts"></div>';
    document.getElementById("back").addEventListener("click", function () { stopPoll(); Store.logout().then(renderName); });
    drawInvites(); drawCorts();
    stopPoll();
    pollTimer = setInterval(function () { if (!document.querySelector(".overlay") && document.getElementById("corts")) { drawInvites(); drawCorts(); } }, 12000);
  }

  function drawInvites() {
    Store.getMyInvites().then(function (invites) {
      var box = document.getElementById("invites"); if (!box) return; box.innerHTML = "";
      if (!invites.length) return;
      box.appendChild(UI.el('<div class="section-title" style="margin-top:4px"><h2>📩 Invitații pentru tine</h2><span class="hint">' + invites.length + '</span></div>'));
      invites.forEach(function (inv) {
        var full = inv.free <= 0;
        var card = UI.el(
          '<div class="card mt" style="border-color:rgba(111,159,188,.4)">' +
            '<div class="row" style="gap:11px"><div class="cort-emoji">📩</div>' +
            '<div class="grow"><div style="font-family:var(--display);font-weight:700">' + UI.esc(inv.tentName || ("Cortul lui " + inv.createdByName)) + '</div>' +
            '<div class="muted" style="font-size:.82rem">te-a invitat ' + UI.esc(inv.inviterName) + ' · ' + inv.occupied + '/' + inv.capacity + '</div></div></div>' +
            (full ? '<div class="notice warn mt">Cortul s-a umplut între timp.</div>' : "") +
            '<div class="row mt" style="gap:8px">' +
            '<button class="btn btn-primary btn-sm grow acc"' + (full ? " disabled" : "") + '>Accept</button>' +
            '<button class="btn btn-glass btn-sm grow dec">Refuz</button></div></div>'
        );
        card.querySelector(".acc").addEventListener("click", function () {
          Store.respondInvite(inv.inviteId, true).then(function (r) { if (r.ok && r.tent) renderDone(r.tent); else { UI.toast(r.message || "Nu s-a putut.", "err"); renderCorts(); } });
        });
        card.querySelector(".dec").addEventListener("click", function () {
          Store.respondInvite(inv.inviteId, false).then(function () { UI.toast("Invitație refuzată.", "info"); renderCorts(); });
        });
        box.appendChild(card);
      });
    });
  }

  function drawCorts() {
    var s = me(); if (!s) return;
    Promise.all([Store.getTents(s.gender), Store.getSettings()]).then(function (res) {
      if (!document.getElementById("corts")) return;
      var tents = res[0]; state.bookingOpen = res[1].bookingOpen;
      var mine = tents.find(function (t) { return t.occupants.some(function (o) { return o.id === s.id; }); });
      var slot = document.getElementById("mine-slot"), box = document.getElementById("corts");
      slot.innerHTML = "";
      if (!state.bookingOpen) slot.insertAdjacentHTML("beforeend", '<div class="notice warn mt">🔒 Înscrierile sunt închise momentan.</div>');
      if (mine) {
        slot.appendChild(UI.el('<div class="section-title" style="margin-top:6px"><h2>Cortul tău</h2><span class="hint">' + mine.occupied + '/' + mine.capacity + '</span></div>'));
        slot.appendChild(cortCard(mine, true));
      } else if (state.bookingOpen) {
        var tile = UI.el('<button class="create-tile mt"><span class="plus">＋</span><span class="grow"><span class="ct-title">Creează un cort</span><span class="ct-sub">Tu alegi câte locuri și pe cine inviți</span></span><span class="chev">›</span></button>');
        tile.addEventListener("click", openCreateSheet); slot.appendChild(tile);
      }
      box.innerHTML = "";
      if (!tents.length) { box.innerHTML = empty("⛺", "Niciun cort încă. Fii primul!"); return; }
      tents.forEach(function (t) { box.appendChild(cortCard(t, mine && mine.id === t.id)); });
    });
  }

  function cortCard(t, isMine) {
    var full = t.free <= 0 && !isMine, pips = "";
    for (var i = 0; i < t.capacity; i++) { var cls = i < t.occupied ? " on" : (i < t.filled ? " res" : ""); pips += '<span class="pip' + cls + '"></span>'; }
    var avs = t.occupants.map(function (o) { return UI.avatar(o.name, "sm"); }).concat((t.invited || []).map(function (iv) { return UI.avatar(iv.name, "sm pending"); }));
    var occ = avs.length ? '<div class="avatar-stack">' + avs.slice(0, 8).join("") + '</div>' + (t.reserved ? '<span class="pend-tag">' + t.reserved + ' invitat' + (t.reserved === 1 ? "" : "e") + '</span>' : "") : '<span class="none">Gol — fii primul!</span>';
    var right = isMine ? '<span class="badge badge-you">Cortul tău</span>' : full ? '<span class="badge badge-full">Plin</span>' : '<span class="free">' + t.free + ' ' + (t.free === 1 ? "loc" : "locuri") + '</span>';
    var card = UI.el('<div class="cort ' + (full ? "full " : "") + (isMine ? "mine" : "") + '"><div class="row"><div class="cort-emoji">' + UI.tentEmoji(t) + '</div><div class="grow"><div class="cort-name">' + UI.esc(UI.tentName(t)) + '</div><div class="cort-sub">' + t.capacity + ' locuri · făcut de ' + UI.esc(t.createdByName) + '</div></div></div><div class="meter">' + pips + '</div><div class="capline"><span class="occupants">' + occ + '</span>' + right + '</div></div>');
    card.addEventListener("click", function () { openTentSheet(t.id); });
    return card;
  }

  // ---- Tent detail ------------------------------------------------ //
  function openTentSheet(tentId) {
    Store.getTent(tentId).then(function (t) {
      var s = me();
      if (!t) { UI.toast("Cortul nu mai există.", "err"); drawCorts(); return; }
      var iAmHere = t.occupants.some(function (o) { return o.id === s.id; });
      var full = t.free <= 0;
      var members = t.occupants.map(function (o) { return '<div class="person" style="cursor:default">' + UI.avatar(o.name) + '<span class="who"><span class="name">' + UI.esc(o.name) + (o.id === s.id ? ' <span class="badge badge-you">tu</span>' : "") + '</span></span></div>'; }).join("");
      var invitedSection = (t.invited || []).length ? '<div class="section-title" style="margin:14px 2px 8px"><h2 style="font-size:.95rem">Invitați · în așteptare</h2><span class="hint">' + t.reserved + '</span></div><div class="person-list" id="invlist"></div>' : "";
      var action;
      if (iAmHere) action = '<div id="invzone"></div><button class="btn btn-danger btn-block mt" id="leave">Ieși din cort</button>';
      else if (full) action = '<div class="notice warn">Cortul e plin.</div><button class="btn btn-glass btn-block mt" id="req">Trimite o cerere organizatorului</button>';
      else if (!state.bookingOpen) action = '<div class="notice warn">Înscrierile sunt închise.</div>';
      else action = '<button class="btn btn-primary btn-block" id="join">Alătură-te cortului</button>';

      UI.openSheet(
        '<div class="row" style="gap:12px;margin-bottom:4px"><div class="cort-emoji">' + UI.tentEmoji(t) + '</div><div class="grow"><h2 style="font-size:1.3rem">' + UI.esc(UI.tentName(t)) + '</h2><div class="muted" style="font-size:.85rem">' + t.filled + '/' + t.capacity + ' ocupate · ' + UI.genderLabel(t.gender) + '</div></div></div>' +
        '<div class="section-title" style="margin:14px 2px 10px"><h2 style="font-size:.95rem">În cort</h2><span class="hint">' + t.occupied + '</span></div><div class="person-list">' + members + '</div>' +
        invitedSection + '<div class="mt-lg">' + action + '</div>'
      );
      var invBox = document.getElementById("invlist");
      if (invBox) (t.invited || []).forEach(function (iv) {
        var row = UI.el('<div class="person" style="cursor:default">' + UI.avatar(iv.name, "pending") + '<span class="who"><span class="name">' + UI.esc(iv.name) + '</span><span class="meta">invitat de ' + UI.esc(iv.inviterName) + ' · așteaptă</span></span>' + (iAmHere ? '<button class="btn btn-glass btn-sm" style="padding:6px 10px">Anulează</button>' : "") + '</div>');
        if (iAmHere) row.querySelector("button").addEventListener("click", function () { Store.cancelInvite(iv.inviteId).then(function () { UI.toast("Invitație anulată.", "info"); openTentSheet(tentId); drawCorts(); }); });
        invBox.appendChild(row);
      });
      if (iAmHere) {
        document.getElementById("leave").addEventListener("click", function () { Store.leave().then(function () { UI.closeSheet(); UI.toast("Ai ieșit din cort.", "info"); renderCorts(); }); });
        if (t.free > 0) buildInviteZone(t);
      }
      if (!iAmHere && full) document.getElementById("req").addEventListener("click", function () { openRequestSheet(); });
      if (!iAmHere && !full && state.bookingOpen) document.getElementById("join").addEventListener("click", function () {
        Store.joinTent(t.id).then(function (r) { if (r.ok) { UI.closeSheet(); renderDone(r.tent); } else UI.toast(r.message || "Nu s-a putut.", "err"); });
      });
    });
  }

  // invite people into a tent you're already in
  function buildInviteZone(t) {
    var zone = document.getElementById("invzone");
    var btn = UI.el('<button class="btn btn-glass btn-block" id="openinv">＋ Invită pe cineva</button>');
    zone.appendChild(btn);
    btn.addEventListener("click", function () {
      Store.getParticipants().then(function (all) {
        var picker = buildPeoplePicker(all, me(), t.free, "Pe cine inviți? (au " + t.free + " " + (t.free === 1 ? "loc" : "locuri") + ")");
        zone.innerHTML = ""; zone.appendChild(picker.el);
        var send = UI.el('<button class="btn btn-primary btn-block mt" id="sendinv">Trimite invitațiile</button>');
        zone.appendChild(send);
        send.addEventListener("click", function () {
          var ids = picker.selected(); if (!ids.length) { openTentSheet(t.id); return; }
          Promise.all(ids.map(function (id) { return Store.inviteToTent(t.id, id); })).then(function (results) {
            var okc = results.filter(function (r) { return r && r.ok; }).length;
            var failMsg = (results.find(function (r) { return r && !r.ok; }) || {}).message;
            if (okc) UI.toast(okc + (okc === 1 ? " invitație trimisă — locul e rezervat" : " invitații trimise — locurile sunt rezervate") + " ✉️", "ok");
            else if (failMsg) UI.toast(failMsg, "err");
            openTentSheet(t.id); drawCorts();
          });
        });
      });
    });
  }

  // ---- Create cort ------------------------------------------------ //
  function openCreateSheet() {
    Promise.all([Store.getParticipants(), Store.getSettings(), Store.getTents()]).then(function (res) {
      var all = res[0], set = res[1], tents = res[2];
      var used = { 3: 0, 4: 0 };
      tents.forEach(function (t) { if (t.capacity === 3) used[3]++; else if (t.capacity === 4) used[4]++; });
      var rem = { 3: Math.max(0, (set.cap3Total || 6) - used[3]), 4: Math.max(0, (set.cap4Total || 24) - used[4]) };
      var opts = [4, 3]; // show 4 first
      var chips = opts.map(function (n) {
        var out = rem[n] <= 0;
        return '<button class="cap-opt' + (out ? " full" : "") + '" data-n="' + n + '"' + (out ? " disabled" : "") + ' style="' + (out ? "opacity:.45;cursor:not-allowed" : "") + '">' +
          '<span class="n">' + n + '</span><span class="l">pers · ' + (out ? "epuizat" : rem[n] + " libere") + '</span></button>';
      }).join("");
      var anyLeft = rem[3] > 0 || rem[4] > 0;

      UI.openSheet(
        '<h2>Creează un cort</h2><p class="muted mt" style="font-size:.9rem">Alege mărimea. Pe cei aleși îi <strong>inviți</strong> — ei acceptă din contul lor.</p>' +
        (anyLeft ? '' : '<div class="notice warn mt">Nu mai sunt corturi de creat. Alătură-te unuia existent sau așteaptă o invitație.</div>') +
        '<div class="field mt-lg"><label>Cort de câte persoane?</label><div class="cap-grid" style="grid-template-columns:1fr 1fr" id="caps">' + chips + '</div></div>' +
        '<div class="field"><label>Nume cort (opțional)</label><input class="input" id="cname" maxlength="28" placeholder="" /></div>' +
        '<div id="bring"></div><button class="btn btn-primary btn-block mt" id="create"' + (anyLeft ? "" : " disabled") + '>Creează cortul</button><button class="btn btn-ghost btn-block mt" id="cancel">Anulează</button>'
      );
      var capacity = rem[4] > 0 ? 4 : (rem[3] > 0 ? 3 : 4);
      var caEls = Array.prototype.slice.call(document.querySelectorAll(".cap-opt"));
      caEls.forEach(function (b) { if (parseInt(b.dataset.n, 10) === capacity && !b.disabled) b.classList.add("active"); });
      var picker = buildPeoplePicker(all, me(), capacity - 1, "Invită colegi (opțional)");
      document.getElementById("bring").appendChild(picker.el);
      caEls.forEach(function (b) { b.addEventListener("click", function () { if (b.disabled) return; caEls.forEach(function (x) { x.classList.remove("active"); }); b.classList.add("active"); capacity = parseInt(b.dataset.n, 10); picker.setMax(capacity - 1); }); });
      document.getElementById("cancel").addEventListener("click", UI.closeSheet);
      document.getElementById("create").addEventListener("click", function () {
        Store.createTent(capacity, document.getElementById("cname").value, picker.selected()).then(function (r) {
          if (r.ok) { UI.closeSheet(); renderDone(r.tent, picker.selected().length); } else UI.toast(r.message || "Nu s-a putut.", "err");
        });
      });
    });
  }

  function buildPeoplePicker(all, meObj, max, label) {
    var free = all.filter(function (p) { return p.gender === meObj.gender && !p.tentId && p.id !== meObj.id; });
    var selected = new Set();
    var wrap = UI.el('<div class="field"><label>' + UI.esc(label) + ' <span class="muted" id="pk-count"></span></label><div class="person-list" id="pk-list"></div></div>');
    if (!free.length) wrap.querySelector("#pk-list").innerHTML = '<div class="muted" style="font-size:.86rem;padding:4px 2px">Nimeni liber momentan.</div>';
    function refresh() { wrap.querySelector("#pk-count").textContent = max > 0 ? "(" + selected.size + "/" + max + ")" : ""; }
    free.forEach(function (p) {
      var row = UI.el('<button class="person" data-id="' + p.id + '"><span class="check"></span>' + UI.avatar(p.name, "sm") + '<span class="who"><span class="name">' + UI.esc(p.name) + '</span></span></button>');
      row.addEventListener("click", function () {
        if (selected.has(p.id)) { selected.delete(p.id); row.classList.remove("selected"); }
        else { if (max <= 0) { UI.toast("Nu mai e loc.", "err"); return; } if (selected.size >= max) { UI.toast("Maxim " + max + ".", "err"); return; } selected.add(p.id); row.classList.add("selected"); }
        refresh();
      });
      wrap.querySelector("#pk-list").appendChild(row);
    });
    refresh();
    return { el: wrap, selected: function () { return Array.from(selected); }, setMax: function (m) { max = Math.max(0, m); while (selected.size > max) selected.delete(selected.values().next().value); Array.prototype.forEach.call(wrap.querySelectorAll(".person"), function (r) { r.classList.toggle("selected", selected.has(r.dataset.id)); }); refresh(); } };
  }

  // ---- Confirmation ----------------------------------------------- //
  function renderDone(t, invitedCount) { stopPoll();
    var s = me();
    view.innerHTML =
      '<div class="fade-in"><div class="confirm-hero"><div class="confirm-mark">✓</div><h1>Ești în cort!</h1><p class="muted mt">' + UI.esc(UI.tentName(t)) + '</p></div>' +
      '<div class="card mt-lg"><div class="section-title" style="margin:2px 2px 10px"><h2 style="font-size:1rem">Colegi de cort</h2><span class="hint">' + t.occupants.length + '/' + t.capacity + '</span></div><div class="person-list" id="dl"></div>' +
      (invitedCount ? '<div class="notice mt">Am trimis ' + invitedCount + (invitedCount === 1 ? ' invitație' : ' invitații') + '. Apar la ei ca să accepte.</div>' : (t.free > 0 ? '<div class="notice mt">' + t.free + ' ' + (t.free === 1 ? "loc liber" : "locuri libere") + ' — invită sau se alătură alții.</div>' : "")) +
      '</div></div><button class="btn btn-primary btn-block mt-lg" id="ok">Gata</button><button class="btn btn-ghost btn-block mt" id="leave">Ieși din cort</button>';
    var dl = document.getElementById("dl");
    t.occupants.forEach(function (o) { dl.appendChild(UI.el('<div class="person" style="cursor:default">' + UI.avatar(o.name) + '<span class="who"><span class="name">' + UI.esc(o.name) + (o.id === s.id ? ' <span class="badge badge-you">tu</span>' : "") + '</span></span></div>')); });
    document.getElementById("ok").addEventListener("click", renderCorts);
    document.getElementById("leave").addEventListener("click", function () { Store.leave().then(function () { UI.toast("Ai ieșit din cort.", "info"); renderCorts(); }); });
  }

  // ---- Request ---------------------------------------------------- //
  function openRequestSheet() {
    var s = me();
    UI.openSheet('<h2>Trimite o cerere</h2><p class="muted mt" style="font-size:.9rem">Organizatorul o vede și te ajută cu repartizarea.</p><div class="field mt"><label>Mesaj (opțional)</label><textarea class="input" id="note" rows="3" placeholder="ex: vrem să stăm împreună…"></textarea></div><button class="btn btn-primary btn-block" id="send">Trimite cererea</button><button class="btn btn-ghost btn-block mt" id="cancel">Anulează</button>');
    document.getElementById("cancel").addEventListener("click", UI.closeSheet);
    document.getElementById("send").addEventListener("click", function () { Store.createRequest([s.id], document.getElementById("note").value).then(function () { UI.closeSheet(); UI.toast("Cererea a fost trimisă ✉️", "ok"); }); });
  }

  function empty(ico, msg) { return '<div class="empty"><div class="ico">' + ico + '</div><p>' + UI.esc(msg) + '</p></div>'; }

  Store.init().then(function () { return Store.getSettings(); }).then(function (st) {
    document.getElementById("event-name").textContent = st.eventName;
    document.getElementById("enter").addEventListener("click", enterApp);
  });
})();
