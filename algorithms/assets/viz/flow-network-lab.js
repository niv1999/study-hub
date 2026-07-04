/* =====================================================================
   flow-network-lab.js  —  Module 09 "רשתות זרימה — Ford-Fulkerson"
   Grounded in _notes/08-flow-he.md (עמ' 5–22 בשקפי lec-flow-networks.pdf),
   the canonical CLRS network the lecturer traces iteration-by-iteration.

   EXACT lecture example (identical vertices / edges / capacities):
     Vertices : s, v1, v2, v3, v4, t
     Edges(cap): s→v1(16) s→v2(13) v1→v2(10) v2→v1(4) v1→v3(12)
                 v3→v2(9) v2→v4(14) v4→v3(7) v3→t(20) v4→t(4)
     (two antiparallel edges v1↔v2, exactly as in the slides.)

   The four augmenting paths from the notes, with bottleneck (c_f) and |f|:
     1) s→v1→v3→v2→v4→t   c_f=4  (v4→t saturates)          |f|=4
     2) s→v1→v2→v4→v3→t   c_f=7  (v4→v3 saturates)         |f|=11
     3) s→v2→v1→v3→t      c_f=8  "התחרטות — הורדנו 7"       |f|=19
        (residual v2→v1 = 11 = 7 cancel of v1→v2 flow + 4 real edge)
     4) s→v2→v3→t         c_f=4  "התחרטות — הורדנו 4"       |f|=23
        (residual v2→v3 = 4 = cancel of v3→v2 flow)
   Max flow = 23 = min cut {v1→v3, v4→v3, v4→t} (12+7+4), S-side {s,v1,v2,v4}.

   Self-contained IIFE. Hand-authored SVG/DOM. No external deps, no globals.
   Cream design tokens hardcoded (CONTRACT §2). RTL Hebrew UI; math LTR-isolated.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "flow-network-lab";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design palette (hardcoded per CONTRACT §2) --- */
  var C = {
    bg: "#FBF7F0", surface: "#FFFDF8", surface2: "#FBF5EA",
    ink: "#33302B", inkSoft: "#6B655C", line: "#E7DECF",
    mustard: "#C9A24B", clay: "#BE7C5E", sage: "#7C9885",
    teal: "#69A297", tealDeep: "#3E756C", blue: "#6E8CA0",
    err: "#C25B4E", ok: "#4F8A5B",
    edgeEmpty: "#CBBFA8"
  };

  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ---------------------------------------------------------------
     GRAPH MODEL — geometry + capacities (exact lecture network)
     --------------------------------------------------------------- */
  var NODES = {
    S:  { x: 60,  y: 205, label: "s",  term: true },
    V1: { x: 252, y: 82,  label: "v₁" },
    V2: { x: 252, y: 328, label: "v₂" },
    V3: { x: 456, y: 82,  label: "v₃" },
    V4: { x: 456, y: 328, label: "v₄" },
    t:  { x: 648, y: 205, label: "t",  term: true }
  };

  /* directed edges; off = perpendicular offset (for antiparallel v1↔v2);
     lx/ly = label anchor (hand-placed for a clean, non-overlapping look). */
  var EDGES = [
    { id: "s1", u: "S",  v: "V1", cap: 16, name: "s→v₁", lx: 138, ly: 128 },
    { id: "s2", u: "S",  v: "V2", cap: 13, name: "s→v₂", lx: 138, ly: 288 },
    { id: "12", u: "V1", v: "V2", cap: 10, name: "v₁→v₂", off: 12, lx: 210, ly: 205 },
    { id: "21", u: "V2", v: "V1", cap: 4,  name: "v₂→v₁", off: 12, lx: 296, ly: 205 },
    { id: "13", u: "V1", v: "V3", cap: 12, name: "v₁→v₃", lx: 354, ly: 64 },
    { id: "32", u: "V3", v: "V2", cap: 9,  name: "v₃→v₂", lx: 386, ly: 168 },
    { id: "24", u: "V2", v: "V4", cap: 14, name: "v₂→v₄", lx: 354, ly: 350 },
    { id: "43", u: "V4", v: "V3", cap: 7,  name: "v₄→v₃", lx: 490, ly: 205 },
    { id: "3t", u: "V3", v: "t",  cap: 20, name: "v₃→t", lx: 566, ly: 128 },
    { id: "4t", u: "V4", v: "t",  cap: 4,  name: "v₄→t", lx: 566, ly: 288 }
  ];
  var EDGE_BY_ID = {};
  EDGES.forEach(function (e) { EDGE_BY_ID[e.id] = e; });

  var R = 23; /* node radius */

  /* ---------------------------------------------------------------
     STEPS — the exact lecture trace. flow = flow value per edge id
     AFTER this step. overlay = augmenting path as node-pair hops.
     --------------------------------------------------------------- */
  function pathHtml(segs) {
    /* segs: [{n:"s"},{r:16,cancel:false},{n:"v1"}, ...] flattened as
       we build below.  We accept a compact spec instead. */
    return segs;
  }

  var STEPS = [
    {
      badge: "מצב התחלתי", color: C.teal,
      title: "0 · הרשת הקנונית — כל הזרימות אפס",
      body: "רשת הזרימה מההרצאה (דוגמת <span dir=\"ltr\">CLRS</span>): מקור <b dir=\"ltr\">s</b>, בור " +
        "<b dir=\"ltr\">t</b> וארבעה קדקודים <span dir=\"ltr\">v₁…v₄</span>. כל קשת מתויגת ב-" +
        "<span dir=\"ltr\">f/c</span> (זרימה חלקי קיבול). כרגע כל הזרימות 0, לכן <b>הרשת השיורית " +
        "<span dir=\"ltr\">G_f</span> שווה לקיבולים המקוריים</b>. נחפש שוב ושוב מסלול משפר מ-" +
        "<span dir=\"ltr\">s</span> ל-<span dir=\"ltr\">t</span> ב-<span dir=\"ltr\">G_f</span> ונדחוף " +
        "לאורכו זרימה — עד שלא יישאר מסלול כזה.",
      flow: {}, fval: 0, overlay: null, pathEdges: [], cancelEdges: [],
      pathSpec: null, cut: false
    },
    {
      badge: "איטרציה 1", color: C.mustard,
      title: "1 · מסלול משפר ראשון — צוואר בקבוק 4",
      body: "חיפוש ב-<span dir=\"ltr\">G_f</span> מצא מסלול <b dir=\"ltr\">s→v₁→v₃→v₂→v₄→t</b>. " +
        "הקיבול השיורי לאורכו הוא <span dir=\"ltr\">c_f(p) = min{16,12,9,14,4} = 4</span> — צוואר הבקבוק " +
        "הוא הקשת <span dir=\"ltr\">v₄→t</span> (קיבול 4). דוחפים 4 יחידות לכל אורך המסלול; " +
        "<span dir=\"ltr\">v₄→t</span> מגיעה ל<b>רוויה</b> (<span dir=\"ltr\">4/4</span>). " +
        "<b dir=\"ltr\">|f| = 4</b>.",
      flow: { s1: 4, "13": 4, "32": 4, "24": 4, "4t": 4 }, fval: 4,
      overlay: [["S", "V1", "f"], ["V1", "V3", "f"], ["V3", "V2", "f"], ["V2", "V4", "f"], ["V4", "t", "f"]],
      pathEdges: ["s1", "13", "32", "24", "4t"], cancelEdges: [],
      pathSpec: [{ n: "s" }, { r: 16 }, { n: "v₁" }, { r: 12 }, { n: "v₃" }, { r: 9 }, { n: "v₂" }, { r: 14 }, { n: "v₄" }, { r: 4, min: true }, { n: "t" }],
      bottleneck: 4, cut: false
    },
    {
      badge: "איטרציה 2", color: C.mustard,
      title: "2 · מסלול משפר שני — צוואר בקבוק 7",
      body: "מסלול חדש ב-<span dir=\"ltr\">G_f</span>: <b dir=\"ltr\">s→v₁→v₂→v₄→v₃→t</b>. " +
        "הקיבולים השיוריים: <span dir=\"ltr\">min{12,10,10,7,20} = 7</span> — צוואר הבקבוק הוא " +
        "<span dir=\"ltr\">v₄→v₃</span> (קיבול 7). דוחפים 7; <span dir=\"ltr\">v₄→v₃</span> " +
        "מגיעה לרוויה (<span dir=\"ltr\">7/7</span>) ו-<span dir=\"ltr\">s→v₁</span> מתמלאת ל-" +
        "<span dir=\"ltr\">11/16</span>. <b dir=\"ltr\">|f| = 11</b>.",
      flow: { s1: 11, "12": 7, "24": 11, "43": 7, "3t": 7, "13": 4, "32": 4, "4t": 4 }, fval: 11,
      overlay: [["S", "V1", "f"], ["V1", "V2", "f"], ["V2", "V4", "f"], ["V4", "V3", "f"], ["V3", "t", "f"]],
      pathEdges: ["s1", "12", "24", "43", "3t"], cancelEdges: [],
      pathSpec: [{ n: "s" }, { r: 12 }, { n: "v₁" }, { r: 10 }, { n: "v₂" }, { r: 10 }, { n: "v₄" }, { r: 7, min: true }, { n: "v₃" }, { r: 20 }, { n: "t" }],
      bottleneck: 7, cut: false
    },
    {
      badge: "איטרציה 3 · התחרטות", color: C.err,
      title: "3 · „חזרנו בנו” — ביטול 7 יחידות זרימה",
      body: "המסלול <b dir=\"ltr\">s→v₂→v₁→v₃→t</b> עובר על <b>קשת שיורית אחורית</b>. " +
        "הקיבול השיורי <span dir=\"ltr\">v₂→v₁</span> הוא <b dir=\"ltr\">11 = 7 + 4</b>: " +
        "7 מ<b>ביטול</b> הזרימה שכבר נשלחה על <span dir=\"ltr\">v₁→v₂</span>, ועוד 4 מהקשת " +
        "האמיתית <span dir=\"ltr\">v₂→v₁</span>. צוואר הבקבוק = 8. הדחיפה מבטלת את כל 7 היחידות " +
        "על <span dir=\"ltr\">v₁→v₂</span> (<span dir=\"ltr\">7/10 → 0/10</span>) ומעבירה " +
        "יחידה 1 על <span dir=\"ltr\">v₂→v₁</span>. זהו <b>לב הרעיון של הרשת השיורית</b> — " +
        "היכולת „לחזור בנו”. <span dir=\"ltr\">v₁→v₃</span> מגיעה לרוויה " +
        "(<span dir=\"ltr\">12/12</span>). <b dir=\"ltr\">|f| = 19</b>.",
      flow: { s1: 11, s2: 8, "12": 0, "21": 1, "13": 12, "3t": 15, "24": 11, "43": 7, "32": 4, "4t": 4 }, fval: 19,
      overlay: [["S", "V2", "f"], ["V2", "V1", "c"], ["V1", "V3", "f"], ["V3", "t", "f"]],
      pathEdges: ["s2", "12", "21", "13", "3t"], cancelEdges: ["12"],
      pathSpec: [{ n: "s" }, { r: 13 }, { n: "v₂" }, { r: 11, cancel: true }, { n: "v₁" }, { r: 8, min: true }, { n: "v₃" }, { r: 13 }, { n: "t" }],
      bottleneck: 8, cut: false
    },
    {
      badge: "איטרציה 4 · התחרטות", color: C.err,
      title: "4 · „חזרנו בנו” שוב — ביטול 4 יחידות",
      body: "המסלול האחרון: <b dir=\"ltr\">s→v₂→v₃→t</b>. הקשת <span dir=\"ltr\">v₂→v₃</span> " +
        "אינה קשת אמיתית — היא נובעת כולה מ<b>ביטול</b> הזרימה על <span dir=\"ltr\">v₃→v₂</span> " +
        "(קיבול שיורי אחורי 4). צוואר הבקבוק = 4. הדחיפה מבטלת את הזרימה על " +
        "<span dir=\"ltr\">v₃→v₂</span> (<span dir=\"ltr\">4/9 → 0/9</span>) ומעלה את " +
        "<span dir=\"ltr\">s→v₂</span> ל-<span dir=\"ltr\">12/13</span>. <b dir=\"ltr\">|f| = 23</b>.",
      flow: { s1: 11, s2: 12, "12": 0, "21": 1, "13": 12, "3t": 19, "24": 11, "43": 7, "32": 0, "4t": 4 }, fval: 23,
      overlay: [["S", "V2", "f"], ["V2", "V3", "c"], ["V3", "t", "f"]],
      pathEdges: ["s2", "32", "3t"], cancelEdges: ["32"],
      pathSpec: [{ n: "s" }, { r: 5 }, { n: "v₂" }, { r: 4, cancel: true, min: true }, { n: "v₃" }, { r: 5 }, { n: "t" }],
      bottleneck: 4, cut: false
    },
    {
      badge: "Max-Flow = Min-Cut", color: C.tealDeep,
      title: "5 · אין עוד מסלול משפר — הזרימה מקסימלית",
      body: "חיפוש ב-<span dir=\"ltr\">G_f</span> כבר <b>לא מוצא מסלול</b> מ-<span dir=\"ltr\">s</span> ל-" +
        "<span dir=\"ltr\">t</span> ← הזרימה מקסימלית, <b dir=\"ltr\">|f| = 23</b>. הקדקודים שאליהם עוד " +
        "אפשר להגיע מ-<span dir=\"ltr\">s</span> ברשת השיורית הם <b dir=\"ltr\">S = {s, v₁, v₂, v₄}</b> " +
        "(מודגשים בזהב). <b>החתך המינימלי</b> <span dir=\"ltr\">(S,T)</span> מורכב מהקשתות היוצאות מ-" +
        "<span dir=\"ltr\">S</span> אל <span dir=\"ltr\">T = {v₃, t}</span>: " +
        "<span dir=\"ltr\">v₁→v₃ (12)</span>, <span dir=\"ltr\">v₄→v₃ (7)</span>, " +
        "<span dir=\"ltr\">v₄→t (4)</span> — סכום <span dir=\"ltr\">12+7+4 = 23</span>. " +
        "<b>משפט <span dir=\"ltr\">Max-Flow Min-Cut</span>:</b> ערך הזרימה המקסימלית = קיבול החתך המינימלי = 23.",
      flow: { s1: 11, s2: 12, "12": 0, "21": 1, "13": 12, "3t": 19, "24": 11, "43": 7, "32": 0, "4t": 4 }, fval: 23,
      overlay: null, pathEdges: [], cancelEdges: [],
      pathSpec: null, cut: true, cutSide: ["S", "V1", "V2", "V4"], cutEdges: ["13", "43", "4t"]
    }
  ];

  var MAXFLOW = 23;

  /* ---------------------------------------------------------------
     small DOM/SVG helpers
     --------------------------------------------------------------- */
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
  function h(tag, cls, style) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (style) n.style.cssText = style;
    return n;
  }

  /* endpoints of an edge trimmed to node radius, with perpendicular offset */
  function endpoints(e, trimStart, trimEnd) {
    var a = NODES[e.u], b = NODES[e.v];
    var dx = b.x - a.x, dy = b.y - a.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / len, uy = dy / len;
    var px = -uy, py = ux;              /* perpendicular */
    var off = e.off || 0;
    return {
      x1: a.x + ux * trimStart + px * off,
      y1: a.y + uy * trimStart + py * off,
      x2: b.x - ux * trimEnd + px * off,
      y2: b.y - uy * trimEnd + py * off
    };
  }

  /* ---------------------------------------------------------------
     SCENE — hand-authored SVG of the flow network
     --------------------------------------------------------------- */
  var W = 706, H = 410;

  function buildScene() {
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H, width: "100%",
      role: "img", direction: "ltr",
      "aria-label": "רשת הזרימה הקנונית עם s, v1..v4, t"
    });
    svg.style.display = "block";
    svg.style.maxWidth = W + "px";
    svg.style.margin = "0 auto";

    var defs = el("defs");
    function marker(id, color) {
      var m = el("marker", { id: id, viewBox: "0 0 10 10", refX: "8.5", refY: "5",
        markerWidth: "7.5", markerHeight: "7.5", orient: "auto-start-reverse" });
      m.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", fill: color }));
      defs.appendChild(m);
    }
    marker("fnl-arr-empty", C.edgeEmpty);
    marker("fnl-arr-flow", C.sage);
    marker("fnl-arr-sat", C.tealDeep);
    defs.appendChild((function () {
      /* soft glow for the augmenting path */
      var f = el("filter", { id: "fnl-glow", x: "-30%", y: "-30%", width: "160%", height: "160%" });
      f.appendChild(el("feGaussianBlur", { stdDeviation: "2.4", result: "b" }));
      var merge = el("feMerge");
      merge.appendChild(el("feMergeNode", { in: "b" }));
      merge.appendChild(el("feMergeNode", { in: "SourceGraphic" }));
      f.appendChild(merge);
      return f;
    })());
    svg.appendChild(defs);

    /* layer order: overlay(path) under edges? -> put path over edges but
       under nodes so labels stay readable. */
    var gOverlay = el("g", {});          /* augmenting path highlight */
    var gEdges = el("g", {});
    var gLabels = el("g", {});
    var gNodes = el("g", {});
    svg.appendChild(gEdges);
    svg.appendChild(gOverlay);
    svg.appendChild(gLabels);
    svg.appendChild(gNodes);

    /* ---- edges ---- */
    var edgeEls = {};
    EDGES.forEach(function (e) {
      var p = endpoints(e, R, R + 7);
      var line = el("line", { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2,
        stroke: C.edgeEmpty, "stroke-width": 2.4, "stroke-linecap": "round",
        "marker-end": "url(#fnl-arr-empty)" });
      gEdges.appendChild(line);

      /* label f/c with a white halo for readability */
      var lbl = txt(e.lx, e.ly, "0/" + e.cap, {
        "text-anchor": "middle", "dominant-baseline": "middle",
        "font-size": 12.5, "font-weight": 700, "font-family": "ui-monospace, monospace",
        fill: C.inkSoft, stroke: C.surface, "stroke-width": 3.4,
        "paint-order": "stroke", direction: "ltr" });
      gLabels.appendChild(lbl);

      edgeEls[e.id] = { line: line, lbl: lbl };
    });

    /* ---- nodes ---- */
    var nodeEls = {};
    Object.keys(NODES).forEach(function (id) {
      var nd = NODES[id];
      var halo = el("circle", { cx: nd.x, cy: nd.y, r: R + 6, fill: "none",
        stroke: C.mustard, "stroke-width": 4, opacity: 0 });
      gNodes.appendChild(halo);
      var circ = el("circle", { cx: nd.x, cy: nd.y, r: R,
        fill: nd.term ? C.tealDeep : C.surface,
        stroke: nd.term ? C.tealDeep : C.sage, "stroke-width": 2.6 });
      gNodes.appendChild(circ);
      var lab = txt(nd.x, nd.y + 1, nd.label, {
        "text-anchor": "middle", "dominant-baseline": "central",
        "font-size": nd.term ? 19 : 17, "font-weight": 800,
        fill: nd.term ? "#fff" : C.ink, direction: "ltr" });
      gNodes.appendChild(lab);
      nodeEls[id] = { circ: circ, halo: halo, lab: lab };
    });

    /* small legend baked into the corner */
    var legend = el("g", { transform: "translate(14," + (H - 16) + ")", direction: "ltr" });
    function chip(dx, color, label) {
      var gg = el("g", { transform: "translate(" + dx + ",0)" });
      gg.appendChild(el("line", { x1: 0, y1: -4, x2: 20, y2: -4, stroke: color,
        "stroke-width": 4, "stroke-linecap": "round" }));
      gg.appendChild(txt(25, 0, label, { "font-size": 10.5, fill: C.inkSoft }));
      legend.appendChild(gg);
    }
    chip(0, C.mustard, "מסלול משפר");
    chip(112, C.err, "ביטול (התחרטות)");
    chip(262, C.tealDeep, "קשת רוויה");
    svg.appendChild(legend);

    return { svg: svg, edgeEls: edgeEls, nodeEls: nodeEls, gOverlay: gOverlay,
      antsRAF: null };
  }

  /* ---------------------------------------------------------------
     APPLY STATE — render a step (idempotent, no motion required)
     --------------------------------------------------------------- */
  function stopAnts(scene) {
    if (scene.antsRAF) { cancelAnimationFrame(scene.antsRAF); scene.antsRAF = null; }
  }

  function applyState(scene, step) {
    var flow = step.flow || {};

    /* edges: color + width + label by flow/cap */
    EDGES.forEach(function (e) {
      var f = flow[e.id] || 0;
      var els = scene.edgeEls[e.id];
      var col, mk, w;
      if (f <= 0) { col = C.edgeEmpty; mk = "fnl-arr-empty"; w = 2.4; }
      else if (f >= e.cap) { col = C.tealDeep; mk = "fnl-arr-sat"; w = 5.2; }
      else { col = C.sage; mk = "fnl-arr-flow"; w = 2.6 + 3.2 * (f / e.cap); }

      /* min-cut emphasis on final step */
      if (step.cut && step.cutEdges.indexOf(e.id) !== -1) {
        col = C.err; mk = "fnl-arr-sat";
        els.line.setAttribute("stroke-dasharray", "1 0");
      } else {
        els.line.removeAttribute("stroke-dasharray");
      }

      els.line.setAttribute("stroke", col);
      els.line.setAttribute("stroke-width", w);
      els.line.setAttribute("marker-end", "url(#" + mk + ")");
      els.lbl.textContent = f + "/" + e.cap;
      els.lbl.setAttribute("fill", f >= e.cap ? C.tealDeep : (f > 0 ? C.ink : C.inkSoft));
      els.lbl.setAttribute("font-weight", f > 0 ? 800 : 700);
    });

    /* nodes: min-cut halo on S-side */
    Object.keys(NODES).forEach(function (id) {
      var on = step.cut && step.cutSide.indexOf(id) !== -1;
      scene.nodeEls[id].halo.setAttribute("opacity", on ? 1 : 0);
    });

    /* augmenting-path overlay */
    stopAnts(scene);
    while (scene.gOverlay.firstChild) scene.gOverlay.removeChild(scene.gOverlay.firstChild);
    if (step.overlay) {
      var antLines = [];
      step.overlay.forEach(function (hop) {
        var a = NODES[hop[0]], b = NODES[hop[1]];
        var dx = b.x - a.x, dy = b.y - a.y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var ux = dx / len, uy = dy / len;
        var x1 = a.x + ux * R, y1 = a.y + uy * R;
        var x2 = b.x - ux * R, y2 = b.y - uy * R;
        var col = hop[2] === "c" ? C.err : C.mustard;
        var ln = el("line", { x1: x1, y1: y1, x2: x2, y2: y2,
          stroke: col, "stroke-width": 8, "stroke-linecap": "round",
          opacity: 0.55, filter: "url(#fnl-glow)",
          "stroke-dasharray": "10 8" });
        scene.gOverlay.appendChild(ln);
        antLines.push(ln);
      });
      /* marching-ants animation (respect reduced motion) */
      if (!reducedMotion() && antLines.length) {
        var off = 0;
        var tick = function () {
          off = (off - 0.9);
          antLines.forEach(function (l) { l.setAttribute("stroke-dashoffset", off); });
          scene.antsRAF = requestAnimationFrame(tick);
        };
        scene.antsRAF = requestAnimationFrame(tick);
      }
    }
  }

  /* ---------------------------------------------------------------
     BOOKKEEPING PANEL — residual network readout + flow meter
     --------------------------------------------------------------- */
  function buildPanel() {
    var box = h("div", null,
      "background:" + C.surface + ";border:1px solid " + C.line + ";border-radius:14px;" +
      "padding:12px 13px;min-width:236px;flex:1 1 236px;direction:rtl");

    /* flow meter */
    var meterHead = h("div", null, "display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px");
    var meterTitle = h("span", null, "font-weight:800;font-size:.92rem;color:" + C.ink);
    meterTitle.textContent = "ערך הזרימה";
    var meterVal = h("span", null, "font-family:ui-monospace,monospace;font-weight:800;font-size:1.05rem;color:" + C.tealDeep);
    meterVal.setAttribute("dir", "ltr");
    meterHead.appendChild(meterTitle); meterHead.appendChild(meterVal);
    box.appendChild(meterHead);

    var meterTrack = h("div", null,
      "height:14px;background:" + C.surface2 + ";border:1px solid " + C.line + ";border-radius:99px;overflow:hidden");
    var meterFill = h("div", null,
      "height:100%;width:0%;background:linear-gradient(90deg," + C.sage + "," + C.tealDeep + ");" +
      "border-radius:99px;transition:width .45s ease");
    meterTrack.appendChild(meterFill);
    box.appendChild(meterTrack);
    var meterCap = h("div", null, "text-align:left;font-size:.72rem;color:" + C.inkSoft + ";margin-top:2px");
    meterCap.setAttribute("dir", "ltr");
    meterCap.textContent = "max = " + MAXFLOW;
    box.appendChild(meterCap);

    /* augmenting path formula line */
    var pathWrap = h("div", null,
      "margin-top:11px;background:" + C.surface2 + ";border:1px solid " + C.line +
      ";border-radius:10px;padding:8px 10px;min-height:44px");
    var pathHead = h("div", null, "font-size:.74rem;font-weight:700;color:" + C.inkSoft + ";margin-bottom:3px");
    pathHead.textContent = "מסלול משפר (עם קיבולים שיוריים)";
    var pathLine = h("div", null, "font-family:ui-monospace,monospace;font-size:.86rem;line-height:1.7;color:" + C.ink);
    pathLine.setAttribute("dir", "ltr");
    pathWrap.appendChild(pathHead); pathWrap.appendChild(pathLine);
    box.appendChild(pathWrap);

    /* residual table */
    var tblHead = h("div", null, "font-size:.74rem;font-weight:700;color:" + C.inkSoft + ";margin:11px 0 4px");
    tblHead.innerHTML = "רשת שיורית <span dir=\"ltr\">G_f</span> — קיבולים שיוריים";
    box.appendChild(tblHead);

    var tbl = h("table", null, "width:100%;border-collapse:collapse;font-size:.78rem");
    var thead = h("thead");
    var htr = h("tr");
    ["קשת", "f / c", "שיורי"].forEach(function (t, i) {
      var th = h("th", null, "text-align:" + (i === 0 ? "right" : "center") +
        ";padding:2px 4px;color:" + C.inkSoft + ";font-weight:700;border-bottom:1px solid " + C.line);
      th.textContent = t;
      htr.appendChild(th);
    });
    thead.appendChild(htr); tbl.appendChild(thead);
    var tbody = h("tbody");
    var rowEls = {};
    EDGES.forEach(function (e) {
      var tr = h("tr");
      var cName = h("td", null, "padding:2px 4px;font-family:ui-monospace,monospace;direction:ltr;text-align:right");
      cName.textContent = e.name;
      var cFC = h("td", null, "padding:2px 4px;text-align:center;font-family:ui-monospace,monospace;direction:ltr");
      var cRes = h("td", null, "padding:2px 4px;text-align:center;font-family:ui-monospace,monospace;direction:ltr");
      tr.appendChild(cName); tr.appendChild(cFC); tr.appendChild(cRes);
      tbody.appendChild(tr);
      rowEls[e.id] = { tr: tr, fc: cFC, res: cRes };
    });
    tbl.appendChild(tbody);
    box.appendChild(tbl);

    return { box: box, meterVal: meterVal, meterFill: meterFill,
      pathLine: pathLine, rowEls: rowEls, pathWrap: pathWrap, pathHead: pathHead };
  }

  function renderPanel(panel, step) {
    /* flow meter */
    panel.meterVal.textContent = "|f| = " + step.fval;
    panel.meterFill.style.width = (100 * step.fval / MAXFLOW) + "%";

    /* path formula */
    if (step.pathSpec) {
      panel.pathWrap.style.display = "";
      var html = "";
      step.pathSpec.forEach(function (tk) {
        if (tk.n != null) {
          html += "<b>" + tk.n + "</b>";
        } else {
          var col = tk.cancel ? C.err : C.inkSoft;
          var wt = tk.min ? "800" : "600";
          var deco = tk.min ? ";text-decoration:underline" : "";
          var arrow = tk.cancel ? " ⇠" : " →";
          html += "<span style=\"color:" + col + ";font-weight:" + wt + deco + "\">" +
            arrow + "<sub style=\"font-size:.72em\">" + tk.r + "</sub> </span>";
        }
      });
      html += " &nbsp; <span style=\"color:" + C.tealDeep + ";font-weight:800\">min = " + step.bottleneck + "</span>";
      panel.pathLine.innerHTML = html;
    } else if (step.cut) {
      panel.pathWrap.style.display = "";
      panel.pathHead.textContent = "חתך מינימלי (S,T)";
      panel.pathLine.innerHTML = "<b>S={s,v₁,v₂,v₄}</b> · " +
        "<span style=\"color:" + C.err + ";font-weight:800\">v₁→v₃ + v₄→v₃ + v₄→t = 12+7+4 = 23</span>";
    } else {
      panel.pathWrap.style.display = "";
      panel.pathHead.textContent = "מסלול משפר (עם קיבולים שיוריים)";
      panel.pathLine.innerHTML = "<span style=\"color:" + C.inkSoft + "\">— אין (מצב התחלתי) —</span>";
    }

    /* residual table */
    var pe = step.pathEdges || [], ce = step.cancelEdges || [];
    EDGES.forEach(function (e) {
      var f = (step.flow || {})[e.id] || 0;
      var r = panel.rowEls[e.id];
      var resFwd = e.cap - f;
      r.fc.textContent = f + "/" + e.cap;
      /* residual: forward (c-f); backward (f) shown in red when > 0 */
      var resHtml = "<span style=\"color:" + (resFwd > 0 ? C.ink : C.inkSoft) + "\">→" + resFwd + "</span>";
      if (f > 0) resHtml += " <span style=\"color:" + C.err + "\">←" + f + "</span>";
      r.res.innerHTML = resHtml;

      var onPath = pe.indexOf(e.id) !== -1;
      var isCancel = ce.indexOf(e.id) !== -1;
      var isCut = step.cut && step.cutEdges.indexOf(e.id) !== -1;
      if (isCut) {
        r.tr.style.background = "rgba(194,91,78,.14)";
        r.tr.style.outline = "1px solid " + C.err;
      } else if (isCancel) {
        r.tr.style.background = "rgba(194,91,78,.10)";
        r.tr.style.outline = "none";
      } else if (onPath) {
        r.tr.style.background = "rgba(201,162,75,.16)";
        r.tr.style.outline = "none";
      } else {
        r.tr.style.background = f >= e.cap ? "rgba(62,117,108,.08)" : "transparent";
        r.tr.style.outline = "none";
      }
      r.fc.style.fontWeight = (f > 0 ? "800" : "600");
      r.fc.style.color = f >= e.cap ? C.tealDeep : C.ink;
    });
  }

  /* ---------------------------------------------------------------
     RENDER — wire everything into a mount
     --------------------------------------------------------------- */
  function render(mount) {
    if (!mount || mount.getAttribute("data-fnl-ready") === "1") return;
    mount.setAttribute("data-fnl-ready", "1");
    mount.innerHTML = "";

    var idx = 0, autoTimer = null;

    var wrap = h("div", null, "direction:rtl");
    wrap.setAttribute("tabindex", "0");
    wrap.style.outline = "none";

    /* intro line */
    var intro = h("p", null,
      "margin:0 0 .7rem;font-size:.9rem;color:" + C.inkSoft + ";line-height:1.6");
    intro.innerHTML = "מעבדת <b>Ford-Fulkerson</b> על רשת ההרצאה הקנונית. עקבו אחר ארבעת מסלולי " +
      "השיפור — כולל שתי „<b>התחרטויות</b>” (ביטול זרימה דרך קשתות שיוריות אחוריות) — עד לזרימה " +
      "המקסימלית 23 ולחתך המינימלי.";
    wrap.appendChild(intro);

    /* layout: graph + panel side by side */
    var layout = h("div", null, "display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start");
    var graphBox = h("div", null,
      "flex:2 1 380px;min-width:300px;background:" + C.surface +
      ";border:1px solid " + C.line + ";border-radius:14px;padding:6px 4px");
    var scene = buildScene();
    graphBox.appendChild(scene.svg);
    layout.appendChild(graphBox);

    var panel = buildPanel();
    layout.appendChild(panel.box);
    wrap.appendChild(layout);

    /* step rail (clickable chips) */
    var rail = h("div", null, "display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 4px");
    rail.setAttribute("role", "tablist");
    rail.setAttribute("aria-label", "שלבי אלגוריתם Ford-Fulkerson");
    var chips = STEPS.map(function (s, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "viz-btn";
      b.setAttribute("role", "tab");
      b.textContent = "" + i;
      b.title = s.title;
      b.setAttribute("aria-label", s.title);
      b.style.padding = ".2rem .62rem";
      b.style.fontSize = ".82rem";
      b.style.minWidth = "2rem";
      b.addEventListener("click", function () { stopAuto(); goto(i); });
      rail.appendChild(b);
      return b;
    });
    wrap.appendChild(rail);

    /* explanation panel */
    var explain = h("div", null,
      "background:" + C.surface2 + ";border:1px solid " + C.line +
      ";border-radius:12px;padding:12px 14px;margin-top:8px;min-height:118px;color:" +
      C.ink + ";line-height:1.7;font-size:.9rem");
    explain.setAttribute("aria-live", "polite");
    wrap.appendChild(explain);

    /* controls */
    var controls = h("div", "viz-controls");
    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); goto(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); goto(idx + 1); });
    btnNext.classList.add("primary");
    var btnPlay = mkBtn("▶ הפעל", function () { toggleAuto(); });
    var btnReset = mkBtn("↺ איפוס", function () { stopAuto(); goto(0); });
    controls.appendChild(btnPrev); controls.appendChild(btnNext);
    controls.appendChild(btnPlay); controls.appendChild(btnReset);
    wrap.appendChild(controls);

    mount.appendChild(wrap);

    function mkBtn(label, fn) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "viz-btn";
      b.textContent = label;
      b.addEventListener("click", fn);
      return b;
    }

    function renderExplain(s) {
      explain.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px">' +
          '<span style="background:' + s.color + ';color:#fff;font-weight:700;font-size:.74rem;' +
            'padding:2px 11px;border-radius:99px">' + s.badge + '</span>' +
          '<b style="font-size:1rem;color:' + C.ink + '">' + s.title + '</b>' +
        '</div><div>' + s.body + '</div>';
    }

    function renderChips() {
      chips.forEach(function (b, i) {
        var active = (i === idx), done = (i < idx);
        var col = STEPS[i].color;
        b.setAttribute("aria-selected", active ? "true" : "false");
        if (active) { b.style.background = col; b.style.color = "#fff"; b.style.borderColor = col; }
        else if (done) { b.style.background = C.surface2; b.style.color = C.ink; b.style.borderColor = col; }
        else { b.style.background = C.surface2; b.style.color = C.inkSoft; b.style.borderColor = C.line; }
      });
    }

    function goto(n) {
      idx = Math.max(0, Math.min(STEPS.length - 1, n));
      var s = STEPS[idx];
      applyState(scene, s);
      renderPanel(panel, s);
      renderExplain(s);
      renderChips();
      btnPrev.disabled = (idx === 0);
      btnNext.disabled = (idx === STEPS.length - 1);
    }

    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      if (idx >= STEPS.length - 1) goto(0);
      btnPlay.textContent = "⏸ השהה";
      btnPlay.classList.add("primary");
      var delay = reducedMotion() ? 2600 : 3200;
      autoTimer = setInterval(function () {
        if (idx >= STEPS.length - 1) { stopAuto(); return; }
        goto(idx + 1);
      }, delay);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      btnPlay.textContent = "▶ הפעל";
      btnPlay.classList.remove("primary");
    }

    /* keyboard: RTL-aware (Right = prev, Left = next) */
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { stopAuto(); goto(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { stopAuto(); goto(idx + 1); e.preventDefault(); }
      else if (e.key === "Home") { stopAuto(); goto(0); e.preventDefault(); }
      else if (e.key === "End") { stopAuto(); goto(STEPS.length - 1); e.preventDefault(); }
    });

    goto(0);
  }

  /* ---------------------------------------------------------------
     boot — mount all instances; never throw
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
