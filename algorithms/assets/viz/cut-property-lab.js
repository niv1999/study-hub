/* =====================================================================
   cut-property-lab.js  —  Module 04 "עץ פורש מינימלי — תכונות ואלגוריתם Prim"
   Grounded in _notes/03-mst-he.md + 03-mst-en.md — "משפט הקשת הבטוחה (cut
   property)" demonstrated on THE lecture graph: the classic CLRS graph
   (part-1 running example, 9 vertices a..i).

   EXACT graph from the notes (03-mst-he.md §"הגרף הקבוע של part-1"):
     a–b=4 · a–h=8 · b–c=8 · b–h=11 · c–d=7 · c–i=2 · c–f=4 · d–e=9
     d–f=14 · e–f=10 · f–g=2 · g–h=1 · g–i=6 · h–i=7
     Its MST (turquoise in the slides), total weight 37:
       {a–b(4), a–h(8), g–h(1), f–g(2), c–f(4), c–i(2), c–d(7), d–e(9)}

   The lab shows the cut property directly: pick a set S → the cut (S,V∖S)
   is drawn, its CROSSING edges are highlighted (clay), and the LIGHT edge
   (min-weight crossing) is turquoise = the safe edge the theorem promises.

   Two modes:
     • מדריך (guided) — grows the MST one safe edge at a time, exactly the
       generic algorithm / Prim from a; each step keeps a cut that respects
       A and adds its light edge. Step controls + Hebrew explanation + live
       bookkeeping (S, V∖S, crossing-edge table, safe edge, A and w(A)).
     • מעבדה חופשית (free) — click any vertex to move it between S and V∖S;
       the cut, crossing edges and (all) light edges update live — including
       ties, where more than one edge is light and therefore safe.

   Self-contained IIFE, hand-authored SVG. Cream design tokens hardcoded
   (CONTRACT §2; unit-2 accent = sage). RTL Hebrew UI; English/LTR ids.
   Works over a static server AND file://. Zero external deps.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "cut-property-lab";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design palette (hardcoded per CONTRACT §2) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    sage: "#7C9885",    /* unit-2 accent — S / committed MST edges */
    sageDeep: "#5F7C69",
    teal: "#69A297",    /* light (safe) edge — "טורקיז" in the slides */
    clay: "#BE7C5E",    /* crossing edges / the cut */
    mustard: "#C9A24B",
    edge: "#C7B79E"     /* ordinary (non-crossing) edges */
  };

  /* ---------------- the lecture graph (CLRS, a..i) ---------------- */
  var ORDER = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  var POS = {
    a: { x: 95,  y: 92 },
    b: { x: 255, y: 92 },
    c: { x: 420, y: 92 },
    d: { x: 585, y: 92 },
    e: { x: 692, y: 182 },
    f: { x: 692, y: 330 },
    g: { x: 552, y: 388 },
    i: { x: 420, y: 388 },
    h: { x: 255, y: 388 }
  };
  /* undirected edges [u, v, w] exactly as listed in the notes */
  var EDGES = [
    ["a", "b", 4], ["a", "h", 8], ["b", "c", 8], ["b", "h", 11],
    ["c", "d", 7], ["c", "i", 2], ["c", "f", 4], ["d", "e", 9],
    ["d", "f", 14], ["e", "f", 10], ["f", "g", 2], ["g", "h", 1],
    ["g", "i", 6], ["h", "i", 7]
  ];

  /* Guided trace: the safe edge added at each step (Prim from a / generic).
     S grows by the endpoint not yet inside. Verified min-crossing at each
     step against the notes (total weight 37). */
  var GUIDE_ADDS = [
    ["a", "b"], ["a", "h"], ["g", "h"], ["f", "g"],
    ["c", "f"], ["c", "i"], ["c", "d"], ["d", "e"]
  ];

  /* per-step Hebrew narration (index-aligned with the built guided steps) */
  var GUIDE_TEXT = [
    "אתחול: A=∅ ובחרנו קדקוד פתיחה a. החתך הוא ({a}, שאר הקדקודים). הקשתות החוצות אותו הן a–b=4 ו-a–h=8; הקשת הקלה (המינימלית מבין החוצות) היא <b>a–b=4</b>. לפי משפט הקשת הבטוחה — קשת קלה החוצה חתך שמכבד את A היא בטוחה — לכן נצרף אותה ל-A.",
    "צירפנו את a–b. כעת S={a,b}, וה-A מכבד את החתך (אף קשת ב-A אינה חוצה אותו). הקשתות החוצות: a–h=8, b–c=8, b–h=11. שימו לב לתיקו: יש <b>שתי</b> קשתות קלות במשקל 8 (a–h ו-b–c) — <b>שתיהן בטוחות</b>. נבחר את a–h, זו שבעפ\"מ הקלאסי של CLRS.",
    "צירפנו את a–h. S={a,b,h}. הקשתות החוצות: b–c=8, h–i=7, g–h=1. הקלה ביותר היא <b>g–h=1</b> — למעשה הקשת הקלה ביותר בכל הגרף, ובוודאי בטוחה.",
    "צירפנו את g–h. S={a,b,g,h}. הקשתות החוצות: b–c=8, h–i=7, g–i=6, f–g=2. הקלה <b>f–g=2</b> נבחרת ומצרפת את f לעץ.",
    "צירפנו את f–g. S={a,b,f,g,h}. הקשתות החוצות: b–c=8, h–i=7, g–i=6, c–f=4, e–f=10, d–f=14. הקלה <b>c–f=4</b> — שברנו את התיקו הישן של b–c מול a–h מזמן, וכעת c נכנס דרך קשת קלה יותר.",
    "צירפנו את c–f. S={a,b,c,f,g,h}. הקשתות החוצות: c–d=7, c–i=2, h–i=7, g–i=6, e–f=10, d–f=14. הקלה <b>c–i=2</b> מצרפת את i.",
    "צירפנו את c–i. S={a,b,c,f,g,h,i}. הקשתות החוצות: c–d=7, e–f=10, d–f=14. הקלה <b>c–d=7</b> מצרפת את d.",
    "צירפנו את c–d. S={a,b,c,d,f,g,h,i}. נותרו הקשתות החוצות d–e=9 ו-e–f=10. הקלה <b>d–e=9</b> מצרפת את הקדקוד האחרון e.",
    "כל הקדקודים ב-S — סיימנו. A הוא עפ\"מ שלם: 8 קשתות במשקל כולל <b>37</b>. בכל צעד בחרנו קשת קלה החוצה חתך שמכבד את A, ומשפט הקשת הבטוחה הבטיח שכל בחירה כזו בטוחה — ולכן A שנבנה הוא עפ\"מ. זהו בדיוק האלגוריתם הגנרי, וגם מה ש-Prim עושה כשמתחילים מ-a."
  ];

  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function el(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function txt(x, y, s, attrs) {
    var t = el("text", attrs || {});
    t.setAttribute("x", x); t.setAttribute("y", y);
    t.textContent = s;
    return t;
  }
  function sameEdge(e, u, v) {
    return (e[0] === u && e[1] === v) || (e[0] === v && e[1] === u);
  }
  function inSet(set, id) { return set.indexOf(id) !== -1; }
  function crosses(set, e) { return inSet(set, e[0]) !== inSet(set, e[1]); }

  /* Build the ordered guided steps from GUIDE_ADDS. Each step captures the
     cut S BEFORE adding, the already-committed A, and the safe edge chosen. */
  function buildGuideSteps() {
    var S = ["a"], A = [], steps = [];
    for (var k = 0; k < GUIDE_ADDS.length; k++) {
      var cand = GUIDE_ADDS[k];
      steps.push({ S: S.slice(), A: A.slice(), cand: cand.slice(), done: false });
      A.push(cand.slice());
      var nv = inSet(S, cand[0]) ? cand[1] : cand[0];
      S.push(nv);
    }
    steps.push({ S: S.slice(), A: A.slice(), cand: null, done: true });
    return steps;
  }

  /* ---------------------------------------------------------------
     render one mount
     --------------------------------------------------------------- */
  function render(mount) {
    if (!mount || mount.getAttribute("data-cpl-ready") === "1") return;
    mount.setAttribute("data-cpl-ready", "1");
    mount.innerHTML = "";

    var GUIDE = buildGuideSteps();
    var mode = "guide";          /* "guide" | "free" */
    var gIdx = 0;                /* guided step index */
    var freeS = ["a", "b", "h"]; /* free-mode cut set */

    /* ================= layout scaffolding ================= */
    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");
    wrap.style.outline = "none";

    /* ---- mode toggle ---- */
    var modeRow = document.createElement("div");
    modeRow.className = "viz-controls";
    modeRow.style.marginTop = "0";
    modeRow.style.marginBottom = ".85rem";
    var modeLbl = document.createElement("span");
    modeLbl.textContent = "מצב:";
    modeLbl.style.fontWeight = "700";
    modeLbl.style.color = C.ink;
    modeLbl.style.fontSize = ".9rem";
    modeLbl.style.alignSelf = "center";
    modeRow.appendChild(modeLbl);
    var btnGuide = mkBtn("▸ מדריך: בניית עפ\"מ", function () { setMode("guide"); });
    var btnFree = mkBtn("✋ מעבדה חופשית", function () { setMode("free"); });
    modeRow.appendChild(btnGuide);
    modeRow.appendChild(btnFree);
    wrap.appendChild(modeRow);

    /* ---- scene + bookkeeping grid ---- */
    var grid = document.createElement("div");
    grid.style.display = "flex";
    grid.style.flexWrap = "wrap";
    grid.style.gap = "14px";
    grid.style.alignItems = "stretch";
    wrap.appendChild(grid);

    /* SVG column */
    var sceneBox = document.createElement("div");
    sceneBox.style.flex = "1 1 380px";
    sceneBox.style.minWidth = "300px";
    sceneBox.style.background = C.surface;
    sceneBox.style.border = "1px solid " + C.line;
    sceneBox.style.borderRadius = "12px";
    sceneBox.style.padding = "6px";
    grid.appendChild(sceneBox);

    var scene = buildScene();
    sceneBox.appendChild(scene.svg);

    /* bookkeeping column */
    var book = document.createElement("div");
    book.style.flex = "1 1 260px";
    book.style.minWidth = "240px";
    book.style.background = C.surface2;
    book.style.border = "1px solid " + C.line;
    book.style.borderRadius = "12px";
    book.style.padding = "12px 14px";
    book.style.color = C.ink;
    book.style.fontSize = ".88rem";
    book.style.lineHeight = "1.6";
    grid.appendChild(book);

    /* ---- explanation panel ---- */
    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.background = C.surface;
    panel.style.border = "1px solid " + C.line;
    panel.style.borderRadius = "12px";
    panel.style.padding = "12px 14px";
    panel.style.marginTop = "12px";
    panel.style.minHeight = "88px";
    panel.style.color = C.ink;
    panel.style.lineHeight = "1.7";
    panel.style.fontSize = ".9rem";
    wrap.appendChild(panel);

    /* ---- controls ---- */
    var controls = document.createElement("div");
    controls.className = "viz-controls";
    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); gGoto(gIdx - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); gGoto(gIdx + 1); }, true);
    var btnPlay = mkBtn("▶ הפעל", function () { toggleAuto(); });
    var btnReset = mkBtn("↺ איפוס", function () { doReset(); });
    controls.appendChild(btnPrev);
    controls.appendChild(btnNext);
    controls.appendChild(btnPlay);
    controls.appendChild(btnReset);
    wrap.appendChild(controls);

    mount.appendChild(wrap);

    /* screen-reader live status */
    var status = document.createElement("p");
    status.setAttribute("aria-live", "polite");
    status.style.cssText =
      "position:absolute;width:1px;height:1px;margin:-1px;padding:0;" +
      "overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;";
    wrap.appendChild(status);

    function mkBtn(label, fn, primary) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn" + (primary ? " primary" : "");
      b.innerHTML = label;
      b.addEventListener("click", fn);
      return b;
    }

    /* ================= SVG scene builder ================= */
    function buildScene() {
      var W = 770, H = 470;
      var svg = el("svg", {
        viewBox: "0 0 " + W + " " + H, width: "100%",
        role: "img", direction: "ltr",
        "aria-label": "גרף CLRS עם קדקודים a עד i; החתך (S, V∖S) והקשת הקלה החוצה אותו"
      });
      svg.style.display = "block";
      svg.style.maxWidth = W + "px";
      svg.style.margin = "0 auto";
      svg.style.touchAction = "manipulation";

      var defs = el("defs");
      /* glow for the light (safe) edge */
      var f = el("filter", { id: "cpl-glow", x: "-40%", y: "-40%", width: "180%", height: "180%" });
      var b = el("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "3", result: "blur" });
      var merge = el("feMerge");
      merge.appendChild(el("feMergeNode", { in: "blur" }));
      merge.appendChild(el("feMergeNode", { in: "SourceGraphic" }));
      f.appendChild(b); f.appendChild(merge);
      defs.appendChild(f);
      svg.appendChild(defs);

      /* legend (LTR, top) */
      var lg = el("g");
      var items = [
        { c: C.sage, t: "S" },
        { c: C.clay, t: "crossing" },
        { c: C.teal, t: "light (safe)" },
        { c: C.sageDeep, t: "A (MST)" }
      ];
      items.forEach(function (it, i) {
        var lx = 20 + i * 150;
        lg.appendChild(el("rect", { x: lx, y: 14, width: 14, height: 14, rx: 3,
          fill: it.c }));
        lg.appendChild(txt(lx + 20, 25, it.t, { "font-size": 11.5, "font-weight": 700,
          fill: C.inkSoft }));
      });
      svg.appendChild(lg);

      /* edges (drawn first, under nodes) */
      var edgeEls = EDGES.map(function (e) {
        var p1 = POS[e[0]], p2 = POS[e[1]];
        var g = el("g");
        var line = el("line", { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
          stroke: C.edge, "stroke-width": 3, "stroke-linecap": "round" });
        g.appendChild(line);
        /* weight pill at midpoint */
        var mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        var pill = el("rect", { x: mx - 12, y: my - 10, width: 24, height: 19, rx: 9,
          fill: C.surface, stroke: C.line, "stroke-width": 1 });
        var wt = txt(mx, my + 4, String(e[2]), { "text-anchor": "middle",
          "font-size": 12, "font-weight": 700, fill: C.inkSoft });
        g.appendChild(pill); g.appendChild(wt);
        svg.appendChild(g);
        return { e: e, line: line, pill: pill, wt: wt };
      });

      /* nodes */
      var nodeEls = {};
      ORDER.forEach(function (id) {
        var p = POS[id];
        var g = el("g", { style: "cursor:default" });
        var circ = el("circle", { cx: p.x, cy: p.y, r: 21,
          fill: C.surface, stroke: C.sage, "stroke-width": 2.5 });
        var label = txt(p.x, p.y + 6, id, { "text-anchor": "middle",
          "font-size": 17, "font-weight": 800, fill: C.ink });
        g.appendChild(circ); g.appendChild(label);
        svg.appendChild(g);
        nodeEls[id] = { g: g, circ: circ, label: label };
      });

      return { svg: svg, edgeEls: edgeEls, nodeEls: nodeEls, W: W, H: H };
    }

    /* ================= paint a cut state onto the scene =================
       s.S      : array of vertex ids in S
       s.A      : array of committed edges [[u,v],..]  (guided)
       s.cand   : chosen safe edge [u,v] or null       (guided)
       s.free   : true → highlight ALL light edges (ties), no A
       returns computed info for the bookkeeping panel */
    function paintCut(s) {
      var S = s.S;
      /* which edges cross, and the min crossing weight */
      var crossingList = [];
      var minW = Infinity;
      EDGES.forEach(function (e) {
        if (crosses(S, e)) {
          crossingList.push(e);
          if (e[2] < minW) minW = e[2];
        }
      });
      var lightSet = crossingList.filter(function (e) { return e[2] === minW; });

      function isCommitted(e) {
        if (!s.A) return false;
        for (var i = 0; i < s.A.length; i++) {
          if (sameEdge(e, s.A[i][0], s.A[i][1])) return true;
        }
        return false;
      }
      function isCand(e) { return s.cand && sameEdge(e, s.cand[0], s.cand[1]); }
      function isLight(e) { return lightSet.indexOf(e) !== -1; }

      /* edges */
      scene.edgeEls.forEach(function (o) {
        var e = o.e, ln = o.line;
        var committed = isCommitted(e);
        var crossing = crosses(S, e);
        var candidate = isCand(e);
        var lightNow = s.free ? isLight(e) : candidate;

        ln.removeAttribute("filter");
        ln.removeAttribute("stroke-dasharray");
        o.pill.setAttribute("stroke", C.line);
        o.wt.setAttribute("fill", C.inkSoft);

        if (lightNow) {
          ln.setAttribute("stroke", C.teal);
          ln.setAttribute("stroke-width", 6);
          ln.setAttribute("filter", "url(#cpl-glow)");
          o.pill.setAttribute("stroke", C.teal);
          o.wt.setAttribute("fill", C.teal);
        } else if (committed) {
          ln.setAttribute("stroke", C.sageDeep);
          ln.setAttribute("stroke-width", 5.5);
          o.pill.setAttribute("stroke", C.sageDeep);
          o.wt.setAttribute("fill", C.sageDeep);
        } else if (crossing) {
          ln.setAttribute("stroke", C.clay);
          ln.setAttribute("stroke-width", 3.5);
          ln.setAttribute("stroke-dasharray", "7 5");
          o.pill.setAttribute("stroke", C.clay);
          o.wt.setAttribute("fill", C.clay);
        } else {
          ln.setAttribute("stroke", C.edge);
          ln.setAttribute("stroke-width", 3);
        }
      });

      /* nodes */
      ORDER.forEach(function (id) {
        var n = scene.nodeEls[id];
        if (inSet(S, id)) {
          n.circ.setAttribute("fill", C.sage);
          n.circ.setAttribute("stroke", C.sageDeep);
          n.circ.setAttribute("stroke-width", 2.5);
          n.label.setAttribute("fill", "#fff");
        } else {
          n.circ.setAttribute("fill", C.surface);
          n.circ.setAttribute("stroke", C.sage);
          n.circ.setAttribute("stroke-width", 2.5);
          n.label.setAttribute("fill", C.ink);
        }
      });

      return { crossingList: crossingList, lightSet: lightSet, minW: minW };
    }

    /* dashed "marching ants" pulse on the light edge (RM-gated) */
    function pulseLight() {
      if (reducedMotion()) return;
      scene.edgeEls.forEach(function (o) {
        if (o.line.getAttribute("stroke") === C.teal && o.line.animate) {
          o.line.animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 480 });
        }
      });
    }

    /* ================= bookkeeping panel ================= */
    function chip(id, on) {
      var bg = on ? C.sage : C.surface;
      var col = on ? "#fff" : C.ink;
      var bd = on ? C.sageDeep : C.line;
      return '<span dir="ltr" style="display:inline-block;min-width:20px;text-align:center;' +
        'margin:2px;padding:2px 8px;border-radius:8px;font-weight:800;font-size:.82rem;' +
        'background:' + bg + ';color:' + col + ';border:1.5px solid ' + bd + '">' + id + '</span>';
    }
    function edgeTag(e, kind) {
      var col = kind === "light" ? C.teal : (kind === "committed" ? C.sageDeep : C.clay);
      var bg = kind === "light" ? "rgba(105,162,151,.14)" :
        (kind === "committed" ? "rgba(95,124,105,.14)" : "rgba(190,124,94,.12)");
      var extra = kind === "light" ? " · קלה" : "";
      return '<span dir="ltr" style="display:inline-block;margin:2px;padding:2px 8px;border-radius:8px;' +
        'font-weight:700;font-size:.8rem;background:' + bg + ';color:' + col +
        ';border:1px solid ' + col + '">' + e[0] + "–" + e[1] + "=" + e[2] + extra + '</span>';
    }

    function renderBook(s, info) {
      var S = s.S;
      var vs = ORDER.filter(function (id) { return !inSet(S, id); });
      var html = "";

      html += '<div style="font-weight:800;color:' + C.sageDeep + ';margin-bottom:3px">' +
        'S <span style="font-weight:500;color:' + C.inkSoft + '">(' + S.length + ')</span></div>';
      html += '<div style="margin-bottom:9px">' +
        ORDER.filter(function (id) { return inSet(S, id); }).map(function (id) { return chip(id, true); }).join("") +
        (S.length === 0 ? '<span style="color:' + C.inkSoft + '">— ריק —</span>' : "") + '</div>';

      html += '<div style="font-weight:800;color:' + C.inkSoft + ';margin-bottom:3px" dir="rtl">' +
        'V∖S <span style="font-weight:500">(' + vs.length + ')</span></div>';
      html += '<div style="margin-bottom:11px">' +
        vs.map(function (id) { return chip(id, false); }).join("") +
        (vs.length === 0 ? '<span style="color:' + C.inkSoft + '">— ריק —</span>' : "") + '</div>';

      html += '<div style="border-top:1px dashed ' + C.line + ';padding-top:9px;margin-bottom:4px;' +
        'font-weight:800;color:' + C.clay + '">קשתות חוצות את החתך</div>';
      if (info.crossingList.length === 0) {
        html += '<div style="color:' + C.inkSoft + ';margin-bottom:8px">אין קשתות חוצות (S ריק או S=V).</div>';
      } else {
        html += '<div style="margin-bottom:6px">' + info.crossingList.map(function (e) {
          var isLight = info.lightSet.indexOf(e) !== -1;
          return edgeTag(e, isLight ? "light" : "crossing");
        }).join("") + '</div>';
        html += '<div style="font-size:.82rem;color:' + C.inkSoft + ';margin-bottom:8px" dir="rtl">' +
          'קשת קלה = משקל מינימלי מבין החוצות = <b style="color:' + C.teal + '">' + info.minW + '</b>' +
          (info.lightSet.length > 1 ? ' · <b style="color:' + C.teal + '">' + info.lightSet.length +
            ' קשתות קלות (תיקו)</b>' : '') + '</div>';
      }

      if (!s.free) {
        var wA = s.A.reduce(function (acc, e) {
          var f = EDGES.filter(function (g) { return sameEdge(g, e[0], e[1]); })[0];
          return acc + (f ? f[2] : 0);
        }, 0);
        html += '<div style="border-top:1px dashed ' + C.line + ';padding-top:9px;margin-bottom:4px;' +
          'font-weight:800;color:' + C.sageDeep + '">A — קשתות העפ\"מ עד כה · w(A)=' + wA + '</div>';
        html += '<div>' + (s.A.length ? s.A.map(function (e) {
          var f = EDGES.filter(function (g) { return sameEdge(g, e[0], e[1]); })[0];
          return edgeTag(f, "committed");
        }).join("") : '<span style="color:' + C.inkSoft + '">— ריק —</span>') + '</div>';
      } else {
        html += '<div style="border-top:1px dashed ' + C.line + ';padding-top:9px;font-size:.82rem;' +
          'color:' + C.inkSoft + '" dir="rtl">משפט הקשת הבטוחה: כל קשת קלה החוצה חתך שמכבד את A היא ' +
          '<b style="color:' + C.teal + '">בטוחה</b> — קיים עפ\"מ שמכיל אותה.</div>';
      }

      book.innerHTML = html;
    }

    /* ================= guided mode ================= */
    var autoTimer = null;

    function badge(text, col) {
      return '<span style="background:' + col + ';color:#fff;font-weight:800;font-size:.72rem;' +
        'padding:2px 10px;border-radius:99px" dir="ltr">' + text + '</span>';
    }

    function gGoto(n) {
      gIdx = Math.max(0, Math.min(GUIDE.length - 1, n));
      var s = GUIDE[gIdx];
      var info = paintCut(s);
      pulseLight();
      renderBook(s, info);
      var b = s.done ? badge("done · w=37", C.sageDeep)
        : badge("step " + (gIdx + 1) + " / " + (GUIDE.length - 1), C.sage);
      var candTxt = s.cand
        ? ' <span dir="ltr" style="color:' + C.teal + ';font-weight:800">' +
            s.cand[0] + "–" + s.cand[1] + '</span> תיבחר כעת.'
        : '';
      panel.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px">' +
          b + '<b style="font-size:.98rem;color:' + C.ink + '">משפט הקשת הבטוחה (cut property)</b></div>' +
        '<div dir="rtl">' + GUIDE_TEXT[gIdx] + candTxt + '</div>';
      btnPrev.disabled = (gIdx === 0);
      btnNext.disabled = (gIdx === GUIDE.length - 1);
      status.textContent = "שלב " + (gIdx + 1) + ": " +
        (s.cand ? "קשת בטוחה " + s.cand[0] + "-" + s.cand[1] : "העץ הושלם, משקל 37");
    }

    /* ================= free mode ================= */
    function freeGoto() {
      var s = { S: freeS.slice(), free: true };
      var info = paintCut(s);
      pulseLight();
      renderBook(s, info);
      panel.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px">' +
          badge("free", C.clay) +
          '<b style="font-size:.98rem;color:' + C.ink + '">מעבדת חתכים — בחרו את S בעצמכם</b></div>' +
        '<div dir="rtl">לחצו על קדקוד (עכבר או מקלדת: Tab ואז Enter/רווח) כדי להעביר אותו בין ' +
          '<b style="color:' + C.sageDeep + '">S</b> ל-<b>V∖S</b>. הקו הכתום מסמן את הקשתות ' +
          '<b style="color:' + C.clay + '">החוצות</b> את החתך, והקו הטורקיז את הקשת ' +
          '<b style="color:' + C.teal + '">הקלה</b> — שלפי המשפט <b>בטוחה</b>. נסו חתך שבו יש ' +
          'כמה קשתות קלות (תיקו): כולן בטוחות.</div>';
      status.textContent = "S = {" + freeS.join(", ") + "}";
    }

    function toggleVertex(id) {
      if (mode !== "free") return;
      var i = freeS.indexOf(id);
      if (i === -1) freeS.push(id); else freeS.splice(i, 1);
      freeGoto();
      var n = scene.nodeEls[id];
      n.g.setAttribute("aria-label", "קדקוד " + id + (freeS.indexOf(id) !== -1 ? ", בתוך S" : ", מחוץ ל-S"));
    }

    /* wire node interactivity (only active in free mode) */
    ORDER.forEach(function (id) {
      var n = scene.nodeEls[id];
      n.g.addEventListener("click", function () { toggleVertex(id); });
      n.g.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault(); toggleVertex(id);
        }
      });
    });

    /* ================= autoplay (guided) ================= */
    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      if (mode !== "guide") { setMode("guide"); }
      if (gIdx >= GUIDE.length - 1) gGoto(0);
      btnPlay.innerHTML = "⏸ השהה";
      btnPlay.classList.add("primary");
      var delay = reducedMotion() ? 1900 : 2400;
      autoTimer = setInterval(function () {
        if (gIdx >= GUIDE.length - 1) { stopAuto(); return; }
        gGoto(gIdx + 1);
      }, delay);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      btnPlay.innerHTML = "▶ הפעל";
      btnPlay.classList.remove("primary");
    }

    /* ================= mode switching ================= */
    function setMode(m) {
      stopAuto();
      mode = m;
      btnGuide.classList.toggle("primary", m === "guide");
      btnFree.classList.toggle("primary", m === "free");
      btnGuide.setAttribute("aria-pressed", m === "guide" ? "true" : "false");
      btnFree.setAttribute("aria-pressed", m === "free" ? "true" : "false");

      var guideCtl = (m === "guide");
      btnPrev.style.display = guideCtl ? "" : "none";
      btnNext.style.display = guideCtl ? "" : "none";
      btnPlay.style.display = guideCtl ? "" : "none";

      /* node cursor/focusability depends on mode */
      ORDER.forEach(function (id) {
        var n = scene.nodeEls[id];
        if (m === "free") {
          n.g.setAttribute("tabindex", "0");
          n.g.setAttribute("role", "button");
          n.g.setAttribute("aria-label", "קדקוד " + id + (freeS.indexOf(id) !== -1 ? ", בתוך S" : ", מחוץ ל-S"));
          n.g.setAttribute("style", "cursor:pointer");
        } else {
          n.g.removeAttribute("tabindex");
          n.g.removeAttribute("role");
          n.g.removeAttribute("aria-label");
          n.g.setAttribute("style", "cursor:default");
        }
      });

      if (m === "guide") gGoto(gIdx); else freeGoto();
    }

    function doReset() {
      stopAuto();
      if (mode === "guide") { gGoto(0); }
      else { freeS = ["a", "b", "h"]; setMode("free"); }
    }

    /* keyboard nav on the wrapper (guided; RTL-aware) */
    wrap.addEventListener("keydown", function (e) {
      if (mode !== "guide") return;
      var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
      if (tag === "button" || tag === "input") return;
      if (e.key === "ArrowRight") { stopAuto(); gGoto(gIdx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { stopAuto(); gGoto(gIdx + 1); e.preventDefault(); }
      else if (e.key === "Home") { stopAuto(); gGoto(0); e.preventDefault(); }
      else if (e.key === "End") { stopAuto(); gGoto(GUIDE.length - 1); e.preventDefault(); }
    });

    /* initial paint */
    setMode("guide");
  }

  /* ---------------------------------------------------------------
     boot: mount every instance; never throw.
     --------------------------------------------------------------- */
  function boot() {
    try {
      var mounts = document.querySelectorAll('[data-viz="' + VIZ_ID + '"]');
      if (!mounts || !mounts.length) return;
      Array.prototype.forEach.call(mounts, function (m) { render(m); });
    } catch (err) {
      if (window.console && console.warn) console.warn("[" + VIZ_ID + "] " + err.message);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
