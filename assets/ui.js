/* Shared UI helpers for both pages. */
(function (global) {
  "use strict";

  var AV_COLORS = [
    "#2dd4bf", "#4d9dff", "#a78bfa", "#ff7eb6", "#f59e0b",
    "#34d399", "#f472b6", "#60a5fa", "#c084fc", "#2dd4bf"
  ];
  var CORT_EMOJI = ["⛺", "🏕️", "🔥", "🌲", "🏔️", "🌙", "⭐", "🦌", "🧭", "🪵"];

  var UI = {
    genderLabel: function (g) { return g === "F" ? "Fete" : "Băieți"; },
    genderBadge: function (g) {
      return g === "F" ? '<span class="badge badge-girls">Fete</span>'
                       : '<span class="badge badge-boys">Băieți</span>';
    },
    tentName: function (t) { return t.name || ("Cortul lui " + (t.createdByName || "?")); },
    tentEmoji: function (t) {
      var h = 0, s = t.id || "";
      for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      return CORT_EMOJI[h % CORT_EMOJI.length];
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
      return '<span class="avatar ' + (cls || "") + '" style="background:' + UI.color(name) + '">' + UI.initials(name) + '</span>';
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
      var t = UI.el('<div class="toast ' + (kind || "ok") + '"><span class="bar"></span><span>' + UI.esc(msg) + '</span></div>');
      wrap.appendChild(t);
      setTimeout(function () {
        t.style.transition = "opacity .3s, transform .3s"; t.style.opacity = "0"; t.style.transform = "translateY(10px)";
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
    }
  };

  global.UI = UI;
})(window);
