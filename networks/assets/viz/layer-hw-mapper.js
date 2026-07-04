/* ============================================================================
 * layer-hw-mapper.js  —  Module 3 (Application layer) hero visual
 *
 * Renders the lecturer's "TCP/IP Protocol Stack ↔ hardware mapping" diagram
 * (L02 (4).pdf, slides 21–24; application.md §10.2–10.3):
 *   - A vertical tower of the lecturer's 5 layers, with his REVERSE numbering:
 *       שכבה 5 = Application (pink),  4 = Transport (green),
 *       3 = Network (yellow),  2 = Link (red),  1 = PHYsical (gray).
 *   - Three hardware "grouping" brackets to the side:
 *       layer 5        → "תוכנית רשתית"   (OUTSIDE the kernel)
 *       layers 4 + 3   → "מערכת ההפעלה"   (TCP/UDP live INSIDE the kernel)
 *       layers 2 + 1   → "כרטיס רשת" (NIC)
 *   - A device-type switch (desktop / laptop / smartphone) that swaps ONLY the
 *     OS label and the number/type of NICs, keeping the upper layers identical —
 *     exactly the lecturer's point (slides 22–24): the top layers are the same
 *     on every device; only the physical/link NICs differ.
 *
 * Self-contained IIFE. No external deps. Cream design tokens hard-coded.
 * ========================================================================== */
(function () {
  "use strict";

  /* ---- design palette (CONTRACT §2, hard-coded) ---- */
  var C = {
    bg: "#FBF7F0", surface: "#FFFDF8", surface2: "#FBF5EA",
    ink: "#33302B", inkSoft: "#6B655C", line: "#E7DECF",
    dustyBlue: "#6E8CA0", clay: "#BE7C5E", sage: "#7C9885", mustard: "#C9A24B"
  };

  /* ---- the lecturer's 5 layers, top → bottom, with HIS colors & numbering ----
     Source: application.md §7.1 / §10.2 (slides 16, 21).
     Colors are muted to fit the cream theme while keeping his hue identity:
       App = pink/magenta, Transport = green, Network = yellow, Link = red, PHY = gray. */
  var LAYERS = [
    { n: 5, en: "Application", he: "יישום",  proto: "HTTP, SMTP, POP3, IMAP, ftp, telnet",
      fill: "#E9C4D4", stroke: "#C98BA6", chip: "HTTP",
      role: "כל פרוטוקולי היישום — מיושמים בתוך אפליקציות רשתיות (browser, Zoom, Waze). כולל סטנדרטיים (IETF) ולא-סטנדרטיים." },
    { n: 4, en: "Transport", he: "תעבורה", proto: "TCP  •  UDP",
      fill: "#BFD6C4", stroke: "#7C9885", chip: "TCP",
      role: "בדיוק 2 פרוטוקולים: TCP ו-UDP. ממומשים בתוכנה — בתוך ה-kernel של מערכת ההפעלה." },
    { n: 3, en: "Network", he: "רשת", proto: "IP",
      fill: "#EBD79A", stroke: "#C9A24B", chip: "IP",
      role: "שכבת הרשת (IP). קיימת בכל צומת לאורך המסלול, לא רק בקצוות." },
    { n: 2, en: "Link", he: "קישור", proto: "Ethernet",
      fill: "#E4B4A6", stroke: "#BE7C5E", chip: "Eth",
      role: "שכבת הקישור. ממומשת על כרטיס הרשת (NIC)." },
    { n: 1, en: "PHYsical", he: "פיזית", proto: "carrier signal",
      fill: "#CFCAC1", stroke: "#9C968B", chip: "PHY",
      role: "השכבה הפיזית — האות הנע בערוץ התקשורת. ממומשת על כרטיס הרשת (NIC)." }
  ];

  /* ---- the three hardware groups (slide 21). layerNums = which layers each wraps. ---- */
  var GROUPS = [
    { key: "app", label: "תוכנית רשתית", layerNums: [5],
      accent: C.dustyBlue, kernel: false,
      note: "קוד היישום יושב מחוץ ל-kernel. הוא פונה ל-TCP/UDP דרך send()." },
    { key: "os", label: "מערכת ההפעלה", layerNums: [4, 3],
      accent: C.sage, kernel: true,
      note: "TCP/UDP (שכבה 4) ו-IP (שכבה 3) ממומשים בתוך ה-kernel של מערכת ההפעלה." },
    { key: "nic", label: "כרטיס רשת", layerNums: [2, 1],
      accent: C.clay, kernel: false,
      note: "שכבות 1–2 (Link + PHYsical) ממומשות על כרטיס הרשת — NIC." }
  ];

  /* ---- device variants (slides 22–24). Only OS label + NIC list change. ---- */
  var DEVICES = {
    desktop: {
      label: "מחשב שולחני", icon: "desktop",
      appExample: "",
      osLabel: "מערכת ההפעלה",
      nics: [{ he: "כרטיס רשת", kind: "wired" }]
    },
    laptop: {
      label: "מחשב נייד", icon: "laptop",
      appExample: "לדוגמא: Zoom",
      osLabel: "מערכת ההפעלה",
      nics: [{ he: "כרטיס רשת קווי", kind: "wired" }, { he: "כרטיס רשת אלחוטי", kind: "wifi" }]
    },
    smartphone: {
      label: "סמארטפון", icon: "phone",
      appExample: "לדוגמא: Zoom",
      osLabel: "Android או IOS",
      nics: [{ he: "כרטיס רשת אלחוטי", kind: "wifi" }, { he: "כרטיס רשת סלולרי", kind: "cell" }]
    }
  };
  var DEVICE_ORDER = ["desktop", "laptop", "smartphone"];

  var SVGNS = "http://www.w3.org/2000/svg";
  var prefersReduced = false;
  try {
    prefersReduced = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) { prefersReduced = false; }

  /* ---------- tiny DOM helpers ---------- */
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k === "text") e.textContent = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (kids) kids.forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function svg(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function text(x, y, str, attrs) {
    var t = svg("text", attrs || {});
    t.setAttribute("x", x); t.setAttribute("y", y);
    t.textContent = str;
    return t;
  }

  /* ---------- small hardware glyphs (hand-authored SVG paths) ---------- */
  function deviceGlyph(kind, color) {
    var g = svg("svg", { viewBox: "0 0 24 24", width: "22", height: "22", "aria-hidden": "true" });
    var p = svg("g", { fill: "none", stroke: color, "stroke-width": "1.6",
      "stroke-linecap": "round", "stroke-linejoin": "round" });
    if (kind === "desktop") {
      p.appendChild(svg("rect", { x: 3, y: 4, width: 18, height: 12, rx: 1.5 }));
      p.appendChild(svg("path", { d: "M9 20h6 M12 16v4" }));
    } else if (kind === "laptop") {
      p.appendChild(svg("rect", { x: 5, y: 5, width: 14, height: 9, rx: 1 }));
      p.appendChild(svg("path", { d: "M3 18h18 l-1.5-2 H4.5 Z", fill: color, "fill-opacity": ".12" }));
    } else if (kind === "phone") {
      p.appendChild(svg("rect", { x: 7, y: 3, width: 10, height: 18, rx: 2 }));
      p.appendChild(svg("path", { d: "M11 18h2" }));
    }
    g.appendChild(p);
    return g;
  }
  function nicGlyph(kind, color) {
    var g = svg("g", { fill: "none", stroke: color, "stroke-width": "1.5",
      "stroke-linecap": "round", "stroke-linejoin": "round" });
    if (kind === "wired") {
      g.appendChild(svg("path", { d: "M2 8h6 M2 8v-3 M8 5v6 M8 8h4" }));
      g.appendChild(svg("rect", { x: 12, y: 4, width: 8, height: 8, rx: 1.2 }));
    } else if (kind === "wifi") {
      g.appendChild(svg("path", { d: "M3 9a12 12 0 0 1 16 0 M6 12a8 8 0 0 1 10 0 M9 15a4 4 0 0 1 4 0" }));
      g.appendChild(svg("circle", { cx: 11, cy: 17.5, r: 1, fill: color, stroke: "none" }));
    } else if (kind === "cell") {
      g.appendChild(svg("path", { d: "M11 3v14 M7 8v9 M15 6v11 M3 12v5 M19 9v8" }));
    }
    return g;
  }

  /* ============================ RENDER ============================ */
  function render(mount) {
    if (!mount) return;
    mount.innerHTML = "";
    mount.setAttribute("dir", "rtl");

    var state = { device: "desktop", active: null /* group key or layer n */ };

    /* ---- root scaffold ---- */
    var root = el("div", { class: "lhm-root" });

    /* device switch (real buttons) */
    var controls = el("div", { class: "viz-controls", role: "group",
      "aria-label": "בחירת סוג מכשיר" });
    var deviceBtns = {};
    DEVICE_ORDER.forEach(function (dk) {
      var d = DEVICES[dk];
      var b = el("button", { class: "viz-btn", type: "button",
        "aria-pressed": dk === state.device ? "true" : "false",
        title: d.label });
      b.appendChild(deviceGlyph(d.icon, "currentColor"));
      b.appendChild(el("span", { text: d.label }));
      b.style.display = "inline-flex";
      b.style.alignItems = "center";
      b.style.gap = ".4rem";
      b.addEventListener("click", function () { setDevice(dk); });
      deviceBtns[dk] = b;
      controls.appendChild(b);
    });

    /* stage: SVG on one side, info panel on the other */
    var stage = el("div", { class: "lhm-stage" });
    var svgHost = el("div", { class: "lhm-svg-host" });
    var panel = el("div", { class: "lhm-panel", "aria-live": "polite" });

    stage.appendChild(svgHost);
    stage.appendChild(panel);

    root.appendChild(el("div", { class: "lhm-title",
      html: '<strong>מיפוי שכבות ↔ חומרה</strong> · המספור של המרצה: ' +
            '<span dir="ltr">App = 5 … PHY = 1</span>' }));
    root.appendChild(controls);
    root.appendChild(stage);
    mount.appendChild(root);

    injectStyle();

    /* ---------- build the SVG diagram ---------- */
    // geometry
    var W = 460, H = 430;
    var padTop = 18;
    var layerX = 250, layerW = 150, layerH = 58, gap = 12;
    var bracketX = 214; // brackets sit to the LEFT of the tower (RTL-friendly)
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "lhm-svg",
      role: "img", "aria-label": "דיאגרמת מגדל השכבות ומיפוי החומרה" });
    s.setAttribute("width", "100%");
    s.setAttribute("preserveAspectRatio", "xMidYMid meet");

    // defs: soft shadow
    var defs = svg("defs", {});
    defs.innerHTML =
      '<filter id="lhm-soft" x="-20%" y="-20%" width="140%" height="140%">' +
      '<feDropShadow dx="0" dy="1.5" stdDeviation="2.2" flood-color="#78644620" /></filter>';
    s.appendChild(defs);

    // y position of each layer
    var layerY = {};
    LAYERS.forEach(function (L, i) {
      layerY[L.n] = padTop + i * (layerH + gap);
    });

    /* --- connector arrows between adjacent layers (down the tower) --- */
    var connLayer = svg("g", {});
    for (var i = 0; i < LAYERS.length - 1; i++) {
      var y1 = layerY[LAYERS[i].n] + layerH;
      var y2 = layerY[LAYERS[i + 1].n];
      var cx = layerX + layerW / 2;
      var ln = svg("line", { x1: cx, y1: y1, x2: cx, y2: y2 - 3,
        stroke: C.line, "stroke-width": "2" });
      connLayer.appendChild(ln);
      connLayer.appendChild(svg("path", {
        d: "M" + cx + " " + (y2 - 1) + " l-4 -6 l8 0 z",
        fill: C.line
      }));
    }
    s.appendChild(connLayer);

    /* --- hardware group brackets (drawn first, behind layer boxes) --- */
    var bracketG = svg("g", {});
    var bracketNodes = {}; // key -> {path, label, box}
    GROUPS.forEach(function (grp) {
      var ys = grp.layerNums.map(function (n) { return layerY[n]; });
      var top = Math.min.apply(null, ys) - 6;
      var bottom = Math.max.apply(null, ys) + layerH + 6;
      var bx = bracketX;
      // curly-ish bracket "[" opening toward the tower (to the right in RTL svg space)
      var mid = (top + bottom) / 2;
      var d = "M" + (bx + 14) + " " + top +
              " q-14 0 -14 14 L" + (bx) + " " + (mid - 8) +
              " q0 8 -6 8 q6 0 6 8 L" + bx + " " + (bottom - 14) +
              " q0 14 14 14";
      var path = svg("path", { d: d, fill: "none", stroke: grp.accent,
        "stroke-width": "2.4", "stroke-linecap": "round",
        "stroke-linejoin": "round", opacity: ".85", class: "lhm-bracket" });
      bracketG.appendChild(path);

      // group label box (to the left of the bracket)
      var lbW = 128, lbH = 30, lbX = bx - 18 - lbW, lbY = mid - lbH / 2;
      var box = svg("g", { class: "lhm-grouplabel", tabindex: "0",
        role: "button", "aria-label": "קבוצת חומרה: " + grp.label });
      var rect = svg("rect", { x: lbX, y: lbY, width: lbW, height: lbH, rx: 9,
        fill: C.surface, stroke: grp.accent, "stroke-width": "1.6",
        filter: "url(#lhm-soft)" });
      box.appendChild(rect);
      var glbl = text(lbX + lbW - 12, lbY + lbH / 2 + 4, grp.label,
        { "text-anchor": "end", fill: C.ink, "font-size": "13.5",
          "font-weight": "700", "font-family": "Heebo, sans-serif" });
      box.appendChild(glbl);
      // kernel marker
      if (grp.kernel) {
        var kchip = svg("g", { class: "lhm-kernelchip" });
        kchip.appendChild(svg("rect", { x: lbX + 6, y: lbY - 11, width: 60, height: 15,
          rx: 7.5, fill: C.sage, opacity: ".16" }));
        kchip.appendChild(text(lbX + 36, lbY + 0.5, "kernel",
          { "text-anchor": "middle", fill: "#5A7562", "font-size": "10",
            "font-weight": "700", "font-family": "JetBrains Mono, monospace" }));
        box.appendChild(kchip);
      }
      box.style.cursor = "pointer";
      (function (g) {
        function act() { toggleActive("g:" + g.key); }
        box.addEventListener("click", act);
        box.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); act(); }
        });
        box.addEventListener("mouseenter", function () { hoverActive("g:" + g.key, true); });
        box.addEventListener("mouseleave", function () { hoverActive("g:" + g.key, false); });
      })(grp);
      bracketG.appendChild(box);
      bracketNodes[grp.key] = { path: path, rect: rect, label: glbl };
    });
    s.appendChild(bracketG);

    /* --- layer boxes (interactive) --- */
    var layerG = svg("g", {});
    var layerNodes = {}; // n -> {rect, group}
    LAYERS.forEach(function (L) {
      var y = layerY[L.n];
      var g = svg("g", { class: "lhm-layer", tabindex: "0", role: "button",
        "aria-label": "שכבה " + L.n + " — " + L.en + " (" + L.he + ")" });
      g.style.cursor = "pointer";
      var rect = svg("rect", { x: layerX, y: y, width: layerW, height: layerH,
        rx: 12, fill: L.fill, stroke: L.stroke, "stroke-width": "1.6",
        filter: "url(#lhm-soft)" });
      g.appendChild(rect);
      // layer number badge (left side of box in RTL svg = numeric, LTR)
      var badge = svg("g", {});
      badge.appendChild(svg("circle", { cx: layerX + 20, cy: y + layerH / 2, r: 13,
        fill: C.surface, stroke: L.stroke, "stroke-width": "1.4" }));
      badge.appendChild(text(layerX + 20, y + layerH / 2 + 5, String(L.n),
        { "text-anchor": "middle", fill: L.stroke, "font-size": "15",
          "font-weight": "800", "font-family": "JetBrains Mono, monospace" }));
      g.appendChild(badge);
      // english name (LTR)
      g.appendChild(text(layerX + layerW - 14, y + 24, L.en,
        { "text-anchor": "end", fill: C.ink, "font-size": "15",
          "font-weight": "700", "font-family": "Heebo, sans-serif", direction: "ltr" }));
      // hebrew sub + proto chip
      g.appendChild(text(layerX + layerW - 14, y + 44, "שכבת ה" + L.he,
        { "text-anchor": "end", fill: C.inkSoft, "font-size": "11.5",
          "font-weight": "500", "font-family": "Heebo, sans-serif" }));
      layerG.appendChild(g);
      layerNodes[L.n] = { rect: rect, group: g };

      (function (Lyr) {
        function act() { toggleActive("l:" + Lyr.n); }
        g.addEventListener("click", act);
        g.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); act(); }
        });
        g.addEventListener("mouseenter", function () { hoverActive("l:" + Lyr.n, true); });
        g.addEventListener("mouseleave", function () { hoverActive("l:" + Lyr.n, false); });
      })(L);
    });
    s.appendChild(layerG);

    /* --- NIC hardware badges (below the tower, device-dependent) --- */
    var nicG = svg("g", {});
    s.appendChild(nicG);

    svgHost.appendChild(s);

    /* ---------- info panel default content ---------- */
    function defaultPanel() {
      var d = DEVICES[state.device];
      panel.innerHTML = "";
      panel.appendChild(el("div", { class: "lhm-p-head",
        html: 'מכשיר נבחר: <strong>' + d.label + '</strong>' +
              (d.appExample ? ' <span class="lhm-eg">(' + d.appExample + ')</span>' : '') }));
      panel.appendChild(el("p", { class: "lhm-p-body",
        html: 'לחצו על <strong>שכבה</strong> או על <strong>קבוצת חומרה</strong> כדי לראות ' +
              'מה היא, איזה PDU/פרוטוקול היא נושאת, ו<strong>היכן</strong> היא ממומשת ' +
              '(בתוך ה-kernel או מחוץ לו).' }));
      var ul = el("ul", { class: "lhm-p-list" });
      ul.appendChild(el("li", { html: 'השכבות העליונות (5,4,3) <strong>זהות</strong> בכל מכשיר.' }));
      ul.appendChild(el("li", { html: 'ההבדל בין מכשירים הוא רק ב<strong>כרטיסי הרשת</strong> (שכבות 1–2).' }));
      panel.appendChild(ul);
      // nic legend for current device
      var nl = el("div", { class: "lhm-niclegend" });
      d.nics.forEach(function (nic) {
        var chip = el("span", { class: "lhm-nicchip" });
        var g = svg("svg", { viewBox: "0 0 22 22", width: "20", height: "20" });
        g.appendChild(nicGlyph(nic.kind, C.clay));
        chip.appendChild(g);
        chip.appendChild(el("span", { text: nic.he }));
        nl.appendChild(chip);
      });
      panel.appendChild(nl);
    }

    /* ---------- info panel: a layer selected ---------- */
    function layerPanel(L) {
      panel.innerHTML = "";
      var grp = GROUPS.filter(function (g) { return g.layerNums.indexOf(L.n) >= 0; })[0];
      panel.appendChild(el("div", { class: "lhm-p-head" },
        [ el("span", { class: "lhm-numbadge", text: String(L.n) }),
          el("span", { html: '<strong dir="ltr">' + L.en + '</strong> · שכבת ה' + L.he }) ]));
      panel.appendChild(el("div", { class: "lhm-p-proto",
        html: 'פרוטוקול/PDU: <span dir="ltr">' + L.proto + '</span>' }));
      panel.appendChild(el("p", { class: "lhm-p-body", text: L.role }));
      var where = el("div", { class: "lhm-where" });
      where.style.setProperty("--w-accent", grp.accent);
      where.innerHTML = 'ממומשת ב: <strong>' + grp.label + '</strong>' +
        (grp.kernel ? ' <span class="lhm-kernbadge">בתוך ה-kernel</span>'
                    : ' <span class="lhm-kernbadge out">מחוץ ל-kernel</span>');
      panel.appendChild(where);
    }

    /* ---------- info panel: a group selected ---------- */
    function groupPanel(grp) {
      panel.innerHTML = "";
      panel.appendChild(el("div", { class: "lhm-p-head",
        html: '<strong>' + grp.label + '</strong>' +
          (grp.kernel ? ' <span class="lhm-kernbadge">kernel</span>'
                      : ' <span class="lhm-kernbadge out">user-space</span>') }));
      var names = grp.layerNums.map(function (n) {
        var L = LAYERS.filter(function (x) { return x.n === n; })[0];
        return '<span dir="ltr">' + L.en + '</span> (שכבה ' + n + ')';
      }).join(' · ');
      panel.appendChild(el("div", { class: "lhm-p-proto", html: 'עוטפת: ' + names }));
      panel.appendChild(el("p", { class: "lhm-p-body", text: grp.note }));
      if (grp.key === "nic") {
        var d = DEVICES[state.device];
        var nl = el("div", { class: "lhm-niclegend" });
        d.nics.forEach(function (nic) {
          var chip = el("span", { class: "lhm-nicchip" });
          var g = svg("svg", { viewBox: "0 0 22 22", width: "20", height: "20" });
          g.appendChild(nicGlyph(nic.kind, grp.accent));
          chip.appendChild(g);
          chip.appendChild(el("span", { text: nic.he }));
          nl.appendChild(chip);
        });
        panel.appendChild(el("div", { class: "lhm-p-body",
          html: 'ב<strong>' + d.label + '</strong>:' }));
        panel.appendChild(nl);
      }
    }

    /* ---------- highlight logic ---------- */
    function clearHighlights() {
      LAYERS.forEach(function (L) {
        layerNodes[L.n].group.classList.remove("is-active", "is-dim");
      });
      GROUPS.forEach(function (g) {
        bracketNodes[g.key].rect.classList.remove("is-active");
        bracketNodes[g.key].path.classList.remove("is-active");
      });
    }

    function applyActive(sel) {
      clearHighlights();
      if (!sel) { defaultPanel(); return; }
      if (sel.charAt(0) === "l") {
        var n = parseInt(sel.slice(2), 10);
        var L = LAYERS.filter(function (x) { return x.n === n; })[0];
        // highlight this layer, dim the rest
        LAYERS.forEach(function (x) {
          if (x.n === n) layerNodes[x.n].group.classList.add("is-active");
          else layerNodes[x.n].group.classList.add("is-dim");
        });
        // highlight owning group bracket
        var grp = GROUPS.filter(function (g) { return g.layerNums.indexOf(n) >= 0; })[0];
        bracketNodes[grp.key].rect.classList.add("is-active");
        bracketNodes[grp.key].path.classList.add("is-active");
        layerPanel(L);
      } else {
        var key = sel.slice(2);
        var g = GROUPS.filter(function (x) { return x.key === key; })[0];
        bracketNodes[key].rect.classList.add("is-active");
        bracketNodes[key].path.classList.add("is-active");
        LAYERS.forEach(function (x) {
          if (g.layerNums.indexOf(x.n) >= 0) layerNodes[x.n].group.classList.add("is-active");
          else layerNodes[x.n].group.classList.add("is-dim");
        });
        groupPanel(g);
      }
    }

    var hovered = null;
    function hoverActive(sel, on) {
      if (state.active) return;          // pinned selection wins
      hovered = on ? sel : null;
      applyActive(hovered);
    }
    function toggleActive(sel) {
      state.active = (state.active === sel) ? null : sel;
      hovered = null;
      applyActive(state.active);
    }

    /* ---------- device switch ---------- */
    function drawNics() {
      nicG.innerHTML = "";
      var d = DEVICES[state.device];
      var nics = d.nics;
      // NIC badges sit under the tower, aligned under layers 1-2
      var startY = layerY[1] + layerH + 26;
      var totalW = layerW;
      var each = Math.min(140, totalW / nics.length);
      var spacing = 10;
      var groupW = nics.length * each + (nics.length - 1) * spacing;
      var startX = layerX + layerW / 2 - groupW / 2;
      nics.forEach(function (nic, idx) {
        var nx = startX + idx * (each + spacing);
        var g = svg("g", { class: "lhm-nicbadge", opacity: prefersReduced ? "1" : "0" });
        g.appendChild(svg("rect", { x: nx, y: startY, width: each, height: 40, rx: 10,
          fill: C.surface2, stroke: C.clay, "stroke-width": "1.4", filter: "url(#lhm-soft)" }));
        var gl = svg("svg", { x: nx + 8, y: startY + 9, width: 22, height: 22, viewBox: "0 0 22 22" });
        gl.appendChild(nicGlyph(nic.kind, C.clay));
        g.appendChild(gl);
        g.appendChild(text(nx + each - 10, startY + 24, nic.he,
          { "text-anchor": "end", fill: C.ink, "font-size": "11",
            "font-weight": "600", "font-family": "Heebo, sans-serif" }));
        // connector from PHY layer down to nic badge
        var cx = nx + each / 2;
        g.appendChild(svg("line", { x1: cx, y1: layerY[1] + layerH,
          x2: cx, y2: startY, stroke: C.line, "stroke-width": "1.5",
          "stroke-dasharray": "3 3" }));
        nicG.appendChild(g);
        if (!prefersReduced) {
          // fade+rise in
          g.style.transform = "translateY(6px)";
          g.style.transition = "opacity .32s ease " + (idx * 70) + "ms, transform .32s ease " + (idx * 70) + "ms";
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              g.setAttribute("opacity", "1");
              g.style.transform = "translateY(0)";
            });
          });
        }
      });
    }

    function setDevice(dk) {
      state.device = dk;
      DEVICE_ORDER.forEach(function (k) {
        deviceBtns[k].setAttribute("aria-pressed", k === dk ? "true" : "false");
        deviceBtns[k].classList.toggle("primary", k === dk);
      });
      drawNics();
      // refresh panel if the NIC group / default is showing device-specific info
      if (!state.active) defaultPanel();
      else if (state.active === "g:nic") groupPanel(GROUPS[2]);
      else applyActive(state.active);
    }

    /* ---------- init ---------- */
    deviceBtns.desktop.classList.add("primary");
    drawNics();
    defaultPanel();
  }

  /* ---------- one-time scoped stylesheet ---------- */
  var styled = false;
  function injectStyle() {
    if (styled) return;
    styled = true;
    var css =
      '.lhm-root{font-family:Heebo,Assistant,sans-serif;color:#33302B}' +
      '.lhm-title{font-size:.9rem;color:#6B655C;margin:.1rem .2rem .2rem}' +
      '.lhm-title strong{color:#33302B}' +
      '.lhm-stage{display:flex;flex-wrap:wrap;gap:1rem;align-items:flex-start;margin-top:.8rem}' +
      '.lhm-svg-host{flex:1 1 300px;min-width:280px}' +
      '.lhm-svg{display:block;max-width:480px;margin-inline:auto;width:100%}' +
      '.lhm-panel{flex:1 1 240px;min-width:230px;background:#FBF5EA;border:1px solid #E7DECF;' +
        'border-radius:14px;padding:1rem 1.1rem;box-shadow:0 2px 10px rgba(120,100,70,.08)}' +
      '.lhm-p-head{display:flex;align-items:center;gap:.5rem;font-size:1.02rem;margin-bottom:.55rem;line-height:1.4}' +
      '.lhm-eg{color:#6B655C;font-size:.85rem;font-weight:500}' +
      '.lhm-numbadge{display:inline-flex;align-items:center;justify-content:center;' +
        'width:26px;height:26px;border-radius:50%;background:#FFFDF8;border:1.5px solid #C9A24B;' +
        'color:#33302B;font-weight:800;font-family:"JetBrains Mono",monospace;font-size:.85rem;flex:none}' +
      '.lhm-p-proto{font-size:.86rem;color:#6B655C;background:#FFFDF8;border:1px solid #E7DECF;' +
        'border-radius:9px;padding:.35rem .6rem;margin-bottom:.6rem}' +
      '.lhm-p-proto span[dir="ltr"]{font-family:"JetBrains Mono",monospace;color:#33302B}' +
      '.lhm-p-body{font-size:.9rem;line-height:1.6;margin:.2rem 0 .6rem}' +
      '.lhm-p-list{margin:.4rem 0 .2rem;padding-inline-start:1.1rem;font-size:.85rem;color:#6B655C;line-height:1.65}' +
      '.lhm-p-list li{margin-bottom:.25rem}' +
      '.lhm-where{font-size:.9rem;padding-top:.5rem;border-top:1px dashed #E7DECF}' +
      '.lhm-kernbadge{display:inline-block;background:#7C9885;color:#fff;border-radius:99px;' +
        'padding:.08rem .55rem;font-size:.74rem;font-weight:700;margin-inline-start:.2rem}' +
      '.lhm-kernbadge.out{background:#6E8CA0}' +
      '.lhm-niclegend{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.6rem}' +
      '.lhm-nicchip{display:inline-flex;align-items:center;gap:.35rem;background:#FFFDF8;' +
        'border:1px solid #E7DECF;border-radius:99px;padding:.25rem .6rem;font-size:.82rem;font-weight:600}' +
      /* svg interactive states */
      '.lhm-layer,.lhm-grouplabel{transition:opacity .2s ease}' +
      '.lhm-layer rect,.lhm-grouplabel rect{transition:transform .18s ease,filter .18s ease,stroke-width .18s ease}' +
      '.lhm-layer:focus{outline:none}' +
      '.lhm-layer:focus rect,.lhm-grouplabel:focus rect{stroke-width:3}' +
      '.lhm-layer.is-active rect{stroke-width:3}' +
      '.lhm-layer.is-active{filter:drop-shadow(0 3px 6px rgba(120,100,70,.22))}' +
      '.lhm-layer.is-dim{opacity:.42}' +
      '.lhm-grouplabel.is-active rect,.lhm-bracket.is-active{stroke-width:3}' +
      '.lhm-grouplabel:hover rect,.lhm-layer:hover rect{filter:drop-shadow(0 3px 5px rgba(120,100,70,.2))}' +
      '@media (prefers-reduced-motion: reduce){' +
        '.lhm-layer,.lhm-grouplabel,.lhm-layer rect,.lhm-grouplabel rect,.lhm-nicbadge{transition:none!important}}';
    var st = document.createElement("style");
    st.setAttribute("data-lhm", "");
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------- boot ---------- */
  function boot() {
    var mounts = document.querySelectorAll('[data-viz="layer-hw-mapper"]');
    if (!mounts.length) return;           // degrade gracefully if absent
    mounts.forEach(function (m) {
      try { render(m); }
      catch (err) {
        if (window.console && console.error) console.error("[layer-hw-mapper]", err);
      }
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
