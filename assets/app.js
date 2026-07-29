/* =====================================================================
   Participant flow (dark redesign):
   landing → pick your name → corturi (create your own or join one).
   Tents are created by participants; anyone can make a cort.
   ===================================================================== */
(function () {
  "use strict";

  var view = document.getElementById("view");
  var app = document.getElementById("app");
  var landing = document.getElementById("landing");
  var state = { me: null, bookingOpen: true };

  function enterApp() {
    landing.style.transition = "opacity .5s, transform .5s";
    landing.style.opacity = "0"; landing.style.transform = "scale(1.04)";
    setTimeout(function () {
      landing.classList.add("hidden");
      app.classList.remove("hidden");
      window.scrollTo(0, 0);
      renderName();
    }, 460);
  }

  // ---------------------------------------------------------------- //
  function renderName() {
    view.innerHTML =
      '<div class="screen-head">' +
        '<span class="eyebrow-sm">Pasul 1</span>' +
        '<h1>Cine ești?</h1>' +
        '<p>Caută-ți numele ca să-ți alegi cortul.</p>' +
      '</div>' +
      '<div class="search mt"><input class="input" id="q" placeholder="Caută-ți numele…" autocomplete="off" /></div>' +
      '<div class="person-list mt" id="people"></div>';

    Store.getParticipants().then(function (list) {
      var box = document.getElementById("people"), q = document.getElementById("q");
      function draw() {
        var term = q.value.trim().toLowerCase();
        var f = list.filter(function (p) { return p.name.toLowerCase().indexOf(term) >= 0; });
        box.innerHTML = "";
        if (!f.length) { box.innerHTML = empty("🔍", "Niciun nume găsit."); return; }
        f.slice(0, 60).forEach(function (p) {
          var row = UI.el(
            '<button class="person">' + UI.avatar(p.name) +
            '<span class="who"><span class="name">' + UI.esc(p.name) + '</span>' +
            '<span class="meta">' + (p.tentId ? "are un cort" : UI.genderLabel(p.gender)) + '</span></span>' +
            '<span class="chev">›</span></button>'
          );
          row.addEventListener("click", function () { state.me = p; renderCorts(); });
          box.appendChild(row);
        });
      }
      q.addEventListener("input", draw); draw();
    });
  }

  // ---------------------------------------------------------------- //
  function renderCorts() {
    view.innerHTML =
      '<div class="screen-head">' +
        '<button class="back" id="back">‹ Nu sunt eu</button>' +
        '<span class="eyebrow-sm">Salut, ' + UI.esc(state.me.name.split(" ")[0]) + ' 👋</span>' +
        '<h1>Corturile voastre</h1>' +
      '</div>' +
      '<div id="mine-slot"></div>' +
      '<div class="section-title"><h2>Corturi ' + UI.genderLabel(state.me.gender).toLowerCase() + '</h2><span class="hint">live</span></div>' +
      '<div class="grid" id="corts"></div>';

    document.getElementById("back").addEventListener("click", function () { state.me = null; renderName(); });
    drawCorts();
  }

  function drawCorts() {
    Promise.all([Store.getTents(state.me.gender), Store.getSettings(), Store.getParticipant(state.me.id)])
      .then(function (res) {
        var tents = res[0]; state.bookingOpen = res[1].bookingOpen; state.me = res[2] || state.me;
        var mine = tents.find(function (t) { return t.occupants.some(function (o) { return o.id === state.me.id; }); });
        var slot = document.getElementById("mine-slot");
        var box = document.getElementById("corts");

        slot.innerHTML = "";
        if (!state.bookingOpen) slot.insertAdjacentHTML("beforeend", '<div class="notice warn mt">🔒 Înscrierile sunt închise momentan.</div>');

        if (mine) {
          var card = cortCard(mine, true);
          slot.appendChild(UI.el('<div class="section-title" style="margin-top:6px"><h2>Cortul tău</h2><span class="hint">' + mine.occupied + '/' + mine.capacity + '</span></div>'));
          slot.appendChild(card);
        } else if (state.bookingOpen) {
          var tile = UI.el(
            '<button class="create-tile mt"><span class="plus">＋</span>' +
            '<span class="grow"><span class="ct-title">Creează un cort</span>' +
            '<span class="ct-sub">Tu alegi câte locuri și cine intră</span></span><span class="chev">›</span></button>'
          );
          tile.addEventListener("click", openCreateSheet);
          slot.appendChild(tile);
        }

        box.innerHTML = "";
        if (!tents.length) { box.innerHTML = empty("⛺", "Niciun cort încă. Fii primul care creează unul!"); return; }
        tents.forEach(function (t) {
          var isMine = mine && mine.id === t.id;
          box.appendChild(cortCard(t, isMine));
        });
      });
  }

  function cortCard(t, isMine) {
    var full = t.free <= 0 && !isMine;
    var pips = "";
    for (var i = 0; i < t.capacity; i++) pips += '<span class="pip' + (i < t.occupied ? " on" : "") + '"></span>';
    var occ = t.occupants.length
      ? '<div class="avatar-stack">' + t.occupants.slice(0, 7).map(function (o) { return UI.avatar(o.name, "sm"); }).join("") + '</div>'
      : '<span class="none">Gol — fii primul!</span>';
    var right = isMine ? '<span class="badge badge-you">Cortul tău</span>'
      : full ? '<span class="badge badge-full">Plin</span>'
      : '<span class="free">' + t.free + ' ' + (t.free === 1 ? "loc" : "locuri") + '</span>';

    var card = UI.el(
      '<div class="cort ' + (full ? "full " : "") + (isMine ? "mine" : "") + '">' +
        '<div class="row"><div class="cort-emoji">' + UI.tentEmoji(t) + '</div>' +
          '<div class="grow"><div class="cort-name">' + UI.esc(UI.tentName(t)) + '</div>' +
          '<div class="cort-sub">' + t.capacity + ' locuri · făcut de ' + UI.esc(t.createdByName) + '</div></div></div>' +
        '<div class="meter">' + pips + '</div>' +
        '<div class="capline"><span class="occupants">' + occ + '</span>' + right + '</div>' +
      '</div>'
    );
    card.addEventListener("click", function () { openTentSheet(t.id); });
    return card;
  }

  // ---- Tent detail / join ----------------------------------------- //
  function openTentSheet(tentId) {
    Promise.all([Store.getTent(tentId), Store.getParticipants(), Store.getParticipant(state.me.id)]).then(function (res) {
      var t = res[0], all = res[1]; state.me = res[2] || state.me;
      if (!t) { UI.toast("Cortul nu mai există.", "err"); drawCorts(); return; }
      var iAmHere = t.occupants.some(function (o) { return o.id === state.me.id; });
      var inOther = state.me.tentId && state.me.tentId !== t.id;
      var full = t.free <= 0;

      var members = t.occupants.map(function (o) {
        return '<div class="person" style="cursor:default">' + UI.avatar(o.name) +
          '<span class="who"><span class="name">' + UI.esc(o.name) + (o.id === state.me.id ? ' <span class="badge badge-you">tu</span>' : "") + '</span></span></div>';
      }).join("");

      var action;
      if (iAmHere) {
        action = '<button class="btn btn-danger btn-block" id="leave">Ieși din cort</button>';
      } else if (inOther) {
        action = '<div class="notice warn">Ești deja în alt cort. Ieși din el ca să te muți aici.</div>' +
                 '<button class="btn btn-outline btn-block mt" id="leave-move">Ieși din cortul actual</button>';
      } else if (full) {
        action = '<div class="notice warn">Cortul e plin.</div>' +
                 '<button class="btn btn-glass btn-block mt" id="req">Trimite o cerere organizatorului</button>';
      } else if (!state.bookingOpen) {
        action = '<div class="notice warn">Înscrierile sunt închise.</div>';
      } else {
        action = '<div id="bring"></div><button class="btn btn-primary btn-block" id="join">Alătură-te cortului</button>';
      }

      UI.openSheet(
        '<div class="row" style="gap:12px;margin-bottom:4px"><div class="cort-emoji">' + UI.tentEmoji(t) + '</div>' +
          '<div class="grow"><h2 style="font-size:1.3rem">' + UI.esc(UI.tentName(t)) + '</h2>' +
          '<div class="muted" style="font-size:.85rem">' + t.occupied + '/' + t.capacity + ' · ' + UI.genderLabel(t.gender) + '</div></div></div>' +
        '<div class="section-title" style="margin:14px 2px 10px"><h2 style="font-size:.95rem">În cort</h2></div>' +
        '<div class="person-list">' + members + '</div>' +
        '<div class="mt-lg">' + action + '</div>'
      );

      if (iAmHere) document.getElementById("leave").addEventListener("click", function () {
        Store.leave(state.me.id).then(function () { UI.closeSheet(); UI.toast("Ai ieșit din cort.", "info"); drawCorts(); });
      });
      if (inOther) document.getElementById("leave-move").addEventListener("click", function () {
        Store.leave(state.me.id).then(function () { openTentSheet(tentId); });
      });
      if (full && !iAmHere && !inOther) document.getElementById("req").addEventListener("click", function () { openRequestSheet([state.me.id]); });

      if (!iAmHere && !inOther && !full && state.bookingOpen) {
        var canBring = t.free - 1;
        var picker = buildPeoplePicker(all, state.me, canBring, "Aduci pe cineva? (opțional)");
        document.getElementById("bring").appendChild(picker.el);
        document.getElementById("join").addEventListener("click", function () {
          var ids = [state.me.id].concat(picker.selected());
          Store.joinTent(t.id, ids).then(function (r) {
            if (r.ok) { UI.closeSheet(); renderDone(r.tent); }
            else UI.toast(r.message, "err");
          });
        });
      }
    });
  }

  // ---- Create cort ------------------------------------------------ //
  function openCreateSheet() {
    Store.getParticipants().then(function (all) {
      var caps = [2, 3, 4, 5, 6, 7, 8];
      var chips = caps.map(function (n) {
        return '<button class="cap-opt' + (n === 4 ? " active" : "") + '" data-n="' + n + '"><span class="n">' + n + '</span><span class="l">pers.</span></button>';
      }).join("");

      UI.openSheet(
        '<h2>Creează un cort</h2>' +
        '<p class="muted mt" style="font-size:.9rem">Alege câte locuri are cortul. Poți invita colegi acum sau îi lași să intre singuri.</p>' +
        '<div class="field mt-lg"><label>Câte locuri?</label><div class="cap-grid" id="caps">' + chips + '</div></div>' +
        '<div class="field"><label>Nume cort (opțional)</label><input class="input" id="cname" maxlength="28" placeholder="ex: Lupii de noapte" /></div>' +
        '<div id="bring"></div>' +
        '<button class="btn btn-primary btn-block mt" id="create">Creează cortul</button>' +
        '<button class="btn btn-ghost btn-block mt" id="cancel">Anulează</button>'
      );

      var capacity = 4;
      var caEls = Array.prototype.slice.call(document.querySelectorAll(".cap-opt"));
      var picker = buildPeoplePicker(all, state.me, capacity - 1, "Invită colegi acum (opțional)");
      document.getElementById("bring").appendChild(picker.el);

      caEls.forEach(function (b) {
        b.addEventListener("click", function () {
          caEls.forEach(function (x) { x.classList.remove("active"); });
          b.classList.add("active");
          capacity = parseInt(b.dataset.n, 10);
          picker.setMax(capacity - 1);
        });
      });
      document.getElementById("cancel").addEventListener("click", UI.closeSheet);
      document.getElementById("create").addEventListener("click", function () {
        var name = document.getElementById("cname").value;
        Store.createTent(state.me.id, capacity, name, picker.selected()).then(function (r) {
          if (r.ok) { UI.closeSheet(); renderDone(r.tent); }
          else UI.toast(r.message, "err");
        });
      });
    });
  }

  // reusable checkbox picker of FREE same-gender people (excludes me)
  function buildPeoplePicker(all, me, max, label) {
    var free = all.filter(function (p) { return p.gender === me.gender && !p.tentId && p.id !== me.id; });
    var selected = new Set();
    var wrap = UI.el('<div class="field"><label>' + UI.esc(label) + ' <span class="muted" id="pk-count"></span></label><div class="person-list" id="pk-list"></div></div>');
    if (!free.length) wrap.querySelector("#pk-list").innerHTML = '<div class="muted" style="font-size:.86rem;padding:4px 2px">Nimeni liber momentan — pot intra mai târziu.</div>';

    function refresh() {
      var c = wrap.querySelector("#pk-count");
      c.textContent = max > 0 ? "(" + selected.size + "/" + max + ")" : "(cort plin cu tine)";
    }
    free.forEach(function (p) {
      var row = UI.el('<button class="person" data-id="' + p.id + '"><span class="check"></span>' + UI.avatar(p.name, "sm") +
        '<span class="who"><span class="name">' + UI.esc(p.name) + '</span></span></button>');
      row.addEventListener("click", function () {
        if (selected.has(p.id)) { selected.delete(p.id); row.classList.remove("selected"); }
        else {
          if (max <= 0) { UI.toast("Nu mai e loc pentru alții.", "err"); return; }
          if (selected.size >= max) { UI.toast("Poți aduce maxim " + max + ".", "err"); return; }
          selected.add(p.id); row.classList.add("selected");
        }
        refresh();
      });
      wrap.querySelector("#pk-list").appendChild(row);
    });
    refresh();
    return {
      el: wrap,
      selected: function () { return Array.from(selected); },
      setMax: function (m) {
        max = Math.max(0, m);
        while (selected.size > max) { selected.delete(selected.values().next().value); }
        Array.prototype.forEach.call(wrap.querySelectorAll(".person"), function (r) {
          r.classList.toggle("selected", selected.has(r.dataset.id));
        });
        refresh();
      }
    };
  }

  // ---- Confirmation ----------------------------------------------- //
  function renderDone(t) {
    view.innerHTML =
      '<div class="fade-in">' +
        '<div class="confirm-hero"><div class="confirm-mark">✓</div>' +
          '<h1>Ești în cort!</h1>' +
          '<p class="muted mt">' + UI.esc(UI.tentName(t)) + '</p></div>' +
        '<div class="card mt-lg">' +
          '<div class="section-title" style="margin:2px 2px 10px"><h2 style="font-size:1rem">Colegi de cort</h2><span class="hint">' + t.occupants.length + '/' + t.capacity + '</span></div>' +
          '<div class="person-list" id="dl"></div>' +
          (t.free > 0 ? '<div class="notice mt">' + t.free + ' ' + (t.free === 1 ? "loc liber" : "locuri libere") + ' — se mai pot alătura.</div>' : "") +
        '</div>' +
      '</div>' +
      '<button class="btn btn-primary btn-block mt-lg" id="ok">Gata</button>' +
      '<button class="btn btn-ghost btn-block mt" id="leave">Ieși din cort</button>';

    var dl = document.getElementById("dl");
    t.occupants.forEach(function (o) {
      dl.appendChild(UI.el('<div class="person" style="cursor:default">' + UI.avatar(o.name) +
        '<span class="who"><span class="name">' + UI.esc(o.name) + (o.id === state.me.id ? ' <span class="badge badge-you">tu</span>' : "") + '</span></span></div>'));
    });
    document.getElementById("ok").addEventListener("click", renderCorts);
    document.getElementById("leave").addEventListener("click", function () {
      Store.leave(state.me.id).then(function () { UI.toast("Ai ieșit din cort.", "info"); renderCorts(); });
    });
  }

  // ---- Request ---------------------------------------------------- //
  function openRequestSheet(ids) {
    Store.getParticipants().then(function (all) {
      var names = ids.map(function (id) { var p = all.find(function (x) { return x.id === id; }); return p ? p.name : ""; });
      UI.openSheet(
        '<h2>Trimite o cerere</h2>' +
        '<p class="muted mt" style="font-size:.9rem">Organizatorul o vede și te ajută cu repartizarea.</p>' +
        '<div class="card mt"><strong>Pentru:</strong> ' + names.map(UI.esc).join(", ") + '</div>' +
        '<div class="field mt"><label>Mesaj (opțional)</label><textarea class="input" id="note" rows="3" placeholder="ex: vrem să stăm împreună…"></textarea></div>' +
        '<button class="btn btn-primary btn-block" id="send">Trimite cererea</button>' +
        '<button class="btn btn-ghost btn-block mt" id="cancel">Anulează</button>'
      );
      document.getElementById("cancel").addEventListener("click", UI.closeSheet);
      document.getElementById("send").addEventListener("click", function () {
        Store.createRequest(state.me.id, ids, document.getElementById("note").value).then(function () {
          UI.closeSheet(); UI.toast("Cererea a fost trimisă ✉️", "ok");
        });
      });
    });
  }

  function empty(ico, msg) { return '<div class="empty"><div class="ico">' + ico + '</div><p>' + UI.esc(msg) + '</p></div>'; }

  // ---- boot ------------------------------------------------------- //
  Store.init().then(function () { return Store.getSettings(); }).then(function (s) {
    document.getElementById("event-name").textContent = s.eventName;
    document.getElementById("enter").addEventListener("click", enterApp);
  });
})();
