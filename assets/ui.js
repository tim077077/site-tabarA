/* Shared UI helpers used by both the participant and admin pages. */
(function (global) {
  "use strict";

  var AV_COLORS = [
    "#e8692a", "#3b7ea1", "#2f9e6a", "#c65b7c", "#8a6bc4",
    "#d99a1e", "#4a8f7b", "#c76b4a", "#5e88c9", "#b8567c"
  ];

  var UI = {
    genderLabel: function (g) { return g === "F" ? "Fete" : "Băieți"; },
    genderBadge: function (g) {
      return g === "F"
        ? '<span class="badge badge-girls">👧 Fete</span>'
        : '<span class="badge badge-boys">👦 Băieți</span>';
    },
    initials: function (name) {
      var parts = (name || "?").trim().split(/\s+/);
      return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
    },
    color: function (name) {
      var h = 0; name = name || "";
      for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
      return AV_COLORS[h % AV_COLORS.length];
    },
    avatar: function (name, cls) {
      return '<span class="avatar ' + (cls || "") + '" style="background:' + UI.color(name) + '">' +
        UI.initials(name) + '</span>';
    },
    esc: function (s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    },
    el: function (html) {
      var t = document.createElement("template");
      t.innerHTML = html.trim();
      return t.content.firstElementChild;
    },
    toast: function (msg, kind) {
      var wrap = document.querySelector(".toast-wrap");
      if (!wrap) { wrap = UI.el('<div class="toast-wrap"></div>'); document.body.appendChild(wrap); }
      var icon = kind === "err" ? "⚠️" : kind === "info" ? "ℹ️" : "🎉";
      var t = UI.el('<div class="toast ' + (kind || "ok") + '"><span>' + icon + '</span><span>' + UI.esc(msg) + '</span></div>');
      wrap.appendChild(t);
      setTimeout(function () {
        t.style.transition = "opacity .3s, transform .3s";
        t.style.opacity = "0"; t.style.transform = "translateY(10px)";
        setTimeout(function () { t.remove(); }, 300);
      }, 2600);
    },
    openSheet: function (innerHtml) {
      UI.closeSheet();
      var overlay = UI.el('<div class="overlay"><div class="sheet"><div class="grabber"></div>' + innerHtml + '</div></div>');
      overlay.addEventListener("click", function (e) { if (e.target === overlay) UI.closeSheet(); });
      document.body.appendChild(overlay);
      document.body.style.overflow = "hidden";
      return overlay;
    },
    closeSheet: function () {
      var o = document.querySelector(".overlay");
      if (o) o.remove();
      document.body.style.overflow = "";
    },
    confetti: function () {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      var colors = AV_COLORS.concat(["#2f9e6a", "#f0803c"]);
      for (var i = 0; i < 70; i++) {
        var p = document.createElement("span");
        p.className = "confetti-piece";
        p.style.left = Math.random() * 100 + "vw";
        p.style.background = colors[i % colors.length];
        p.style.animationDuration = (1.6 + Math.random() * 1.4) + "s";
        p.style.animationDelay = (Math.random() * 0.3) + "s";
        p.style.transform = "rotate(" + (Math.random() * 360) + "deg)";
        if (i % 3 === 0) p.style.borderRadius = "50%";
        document.body.appendChild(p);
        (function (el) { setTimeout(function () { el.remove(); }, 3400); })(p);
      }
    }
  };

  global.UI = UI;
})(window);
