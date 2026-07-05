/* =====================================================================
   bellman-ford-rounds.js  —  Module 07 "Bellman-Ford והפרשי אילוצים"
   Grounded in _notes/06-bellman-ford.md:
     • Full pseudocode (dc עמ' 2-4, VERBATIM):
         Bellman-Ford(G,w,s)
         1. Initialize-Single-Source(G,s)
         2. for i←1 to |V[G]|-1
         3.   do for each edge (u,v)∈E[G]
         4.        do Relax(u,v,w)
         5. for each edge (u,v)∈E[G]
         6.   do if d[v] > d[u]+w(u,v)   // check pass = |V|-th round
         7.        then return False     // negative cycle detected
         8. return answer (True)
     • THE lecture example graph (dc עמ' 4) — students saw this in class:
         Vertices: S, A, B, C   (source = S)
         Edges:  S→A (1),  S→C (2),  A→B (2),  B→C (1),  C→A (−4)
       The edge C→A(−4) closes the cycle A→B→C→A whose weight is
       2+1+(−4) = −1 < 0  →  a NEGATIVE CYCLE. Bellman-Ford runs
       |V|−1 = 3 relaxation rounds and then the |V|-th (check) round
       still relaxes edge A→B  ⇒  returns FALSE.
     • Secondary toggle "ללא מעגל שלילי" is the SAME graph with C→A
       changed to −1 (clearly labelled as a variant, NOT from the
       lecture) so the TRUE/converges case can be shown for contrast.

   The step engine simulates the real algorithm edge-by-edge over a
   fixed edge order and snapshots dist[]/π[] after every edge — the
   bookkeeping IS the pedagogy (CONTRACT §5).

   Self-contained IIFE. Hand-authored SVG + DOM. No external deps.
   Cream design tokens hardcoded (CONTRACT §2). RTL Hebrew captions,
   English/LTR algorithm identifiers. Works on http(s):// and file://.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "bellman-ford-rounds";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design palette (hardcoded per CONTRACT §2) --- */
  var C = {
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",   /* source / neutral accent */
    clay: "#BE7C5E",   /* negative weights / detection / alert */
    sage: "#7C9885",   /* relaxation success / shortest-path tree */
    mustard: "#C9A24B" /* active edge being examined */
  };
  var TINT_SAGE = "rgba(124,152,133,.22)";
  var TINT_CLAY = "rgba(190,124,94,.20)";

  var NODE_R = 25;

  /* --- the two scenarios (same node layout, differ only in C→A weight) --- */
  var SCENARIOS = {
    neg: {
      key: "neg",
      source: "S",
      nodes: ["S", "A", "B", "C"],
      coord: { S: [92, 192], A: [300, 96], B: [560, 150], C: [332, 302] },
      edges: [
        { u: "S", v: "A", w: 1 },
        { u: "S", v: "C", w: 2 },
        { u: "A", v: "B", w: 2 },
        { u: "B", v: "C", w: 1 },
        { u: "C", v: "A", w: -4 }
      ],
      caption: "גרף ההרצאה (מקור: dc עמ׳ 4) · קודקודים S,A,B,C · הקשת " +
        "C→A במשקל −4 סוגרת מעגל שלילי A→B→C→A."
    },
    safe: {
      key: "safe",
      source: "S",
      nodes: ["S", "A", "B", "C"],
      coord: { S: [92, 192], A: [300, 96], B: [560, 150], C: [332, 302] },
      edges: [
        { u: "S", v: "A", w: 1 },
        { u: "S", v: "C", w: 2 },
        { u: "A", v: "B", w: 2 },
        { u: "B", v: "C", w: 1 },
        { u: "C", v: "A", w: -1 }
      ],
      caption: "וריאנט להמחשה (לא מההרצאה) · כמו גרף ההרצאה אך C→A במשקל −1 — " +
        "אין מעגל שלילי, האלגוריתם מסתיים ב-TRUE."
    }
  };

  /* ---------- small helpers ---------- */
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
  function clone(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }
  function fmt(n) { return n === Infinity ? "∞" : (n < 0 ? "−" + (-n) : "" + n); }
  function ltr(s) { return '<span dir="ltr">' + s + "</span>"; }
  function ekey(e) { return e.u + "->" + e.v; }
  function ename(e) { return e.u + "→" + e.v; }
  /* "du ± |w| = res" with proper minus signs */
  function relExpr(du, w) {
    if (du === Infinity) return "∞ " + (w < 0 ? "−" : "+") + " " + Math.abs(w) + " = ∞";
    return fmt(du) + " " + (w < 0 ? "−" : "+") + " " + Math.abs(w) + " = " + fmt(du + w);
  }

  /* =====================================================================
     STEP ENGINE — run the real Bellman-Ford, snapshot dist/π per edge.
     Rounds with zero relaxations are collapsed into one summary step so
     the walkthrough stays readable; rounds/checks with real action are
     shown edge-by-edge (that is where the learning is).
     ===================================================================== */
  function buildSteps(scn) {
    var V = scn.nodes, E = scn.edges;
    var n = V.length, m = E.length;
    var steps = [];
    var dist = {}, pi = {};
    var i, e, ed;

    for (i = 0; i < n; i++) { dist[V[i]] = Infinity; pi[V[i]] = null; }
    dist[scn.source] = 0;

    steps.push({
      kind: "init", phaseKey: "init", phaseLabel: "אתחול",
      round: 0, edge: null, changed: null, canRelax: false, updated: false,
      dist: clone(dist), pi: clone(pi),
      expl: "אתחול " + ltr("Initialize-Single-Source") + ": " +
        ltr("d[" + scn.source + "]=0") + " (המקור), לכל שאר הקודקודים " +
        ltr("d=∞") + " ו-" + ltr("π=NIL") + ". נבצע " +
        ltr("|V|−1 = " + (n - 1)) + " סבבי Relax על כל " + m +
        " הקשתות, ואז מעבר בדיקה אחד (הסבב ה-|V|) לזיהוי מעגל שלילי."
    });

    /* ---- |V|-1 relaxation rounds ---- */
    for (i = 1; i <= n - 1; i++) {
      /* peek: does this round relax anything? (decides granularity) */
      var snap = clone(dist);
      var anyRelax = false;
      for (e = 0; e < m; e++) {
        ed = E[e];
        if (snap[ed.u] !== Infinity && snap[ed.u] + ed.w < snap[ed.v]) {
          snap[ed.v] = snap[ed.u] + ed.w; anyRelax = true;
        }
      }

      if (!anyRelax) {
        steps.push({
          kind: "round-noop", phaseKey: "r" + i, phaseLabel: "סבב " + i,
          round: i, edge: null, changed: null, canRelax: false, updated: false,
          dist: clone(dist), pi: clone(pi),
          expl: "סבב " + i + ": מעבר מלא על כל " + m +
            " הקשתות — אף הקלה לא בוצעה. ערכי " + ltr("d") +
            " התייצבו, והסבבים הנותרים לא ישנו דבר."
        });
        continue;
      }

      for (e = 0; e < m; e++) {
        ed = E[e];
        var du = dist[ed.u], dvB = dist[ed.v];
        var cand = du === Infinity ? Infinity : du + ed.w;
        var did = (du !== Infinity && cand < dvB);
        if (did) { dist[ed.v] = cand; pi[ed.v] = ed.u; }

        var ex;
        if (did) {
          ex = "סבב " + i + " · קשת " + ltr(ename(ed)) + " (משקל " + ltr(fmt(ed.w)) +
            "): " + ltr(relExpr(du, ed.w)) + " קטן מ-" + ltr("d[" + ed.v + "]=" + fmt(dvB)) +
            " → <b>Relax</b>: " + ltr("d[" + ed.v + "]←" + fmt(cand)) + ", " +
            ltr("π[" + ed.v + "]←" + ed.u) + ".";
        } else if (du === Infinity) {
          ex = "סבב " + i + " · קשת " + ltr(ename(ed)) + ": " + ltr("d[" + ed.u + "]=∞") +
            " עדיין — לא ניתן להקל דרך " + ed.u + " → אין שינוי.";
        } else {
          ex = "סבב " + i + " · קשת " + ltr(ename(ed)) + " (משקל " + ltr(fmt(ed.w)) +
            "): " + ltr(relExpr(du, ed.w)) + " אינו קטן מ-" + ltr("d[" + ed.v + "]=" + fmt(dvB)) +
            " → אין שיפור.";
        }

        steps.push({
          kind: "relax", phaseKey: "r" + i, phaseLabel: "סבב " + i,
          round: i, edge: ed, edgeIdx: e, changed: did ? ed.v : null,
          updated: did, canRelax: false,
          dist: clone(dist), pi: clone(pi), expl: ex
        });
      }
    }

    /* ---- check pass = the |V|-th round (lines 5-7) ---- */
    var detected = null, detectIdx = -1;
    for (e = 0; e < m; e++) {
      ed = E[e];
      if (dist[ed.u] !== Infinity && dist[ed.u] + ed.w < dist[ed.v]) {
        detected = ed; detectIdx = e; break;
      }
    }

    if (detected) {
      /* show the check edge-by-edge up to (and including) the detecting edge */
      for (e = 0; e <= detectIdx; e++) {
        ed = E[e];
        var du2 = dist[ed.u], dvB2 = dist[ed.v];
        var can = (du2 !== Infinity && du2 + ed.w < dvB2);
        var cx;
        if (can) {
          cx = "מעבר הבדיקה (סבב |V| = " + n + ") · קשת " + ltr(ename(ed)) + ": " +
            ltr(relExpr(du2, ed.w)) + " עדיין קטן מ-" + ltr("d[" + ed.v + "]=" + fmt(dvB2)) +
            " → <b>עדיין ניתן להקל!</b> זו העדות למעגל שלילי — האלגוריתם מחזיר FALSE.";
        } else {
          cx = "מעבר הבדיקה (סבב |V| = " + n + ") · קשת " + ltr(ename(ed)) + ": " +
            ltr(relExpr(du2, ed.w)) + " אינו קטן מ-" + ltr("d[" + ed.v + "]=" + fmt(dvB2)) +
            " → תקין.";
        }
        steps.push({
          kind: "check", phaseKey: "check", phaseLabel: "בדיקה",
          round: n, edge: ed, edgeIdx: e, changed: null, updated: false,
          canRelax: can, dist: clone(dist), pi: clone(pi), expl: cx
        });
      }
      steps.push({
        kind: "done", phaseKey: "done", phaseLabel: "סיום",
        round: n, edge: null, changed: null, updated: false, canRelax: false,
        resultTrue: false,
        highlightEdges: ["A->B", "B->C", "C->A"], highlightColor: C.clay,
        highlightNodes: ["A", "B", "C"],
        dist: clone(dist), pi: clone(pi),
        expl: "<b>תוצאה: FALSE.</b> קיים מעגל שלילי " + ltr("A→B→C→A") +
          " במשקל " + ltr("2 + 1 − 4 = −1 < 0") + ". ההקלה הנוספת בסבב ה-|V| " +
          "היא בדיוק העדות לכך. עבור כל קודקוד הנגיש מהמעגל " + ltr("δ(s,v) = −∞") +
          " ואינו מוגדר."
      });
    } else {
      /* no negative cycle → single summary check step, then TRUE */
      steps.push({
        kind: "check-noop", phaseKey: "check", phaseLabel: "בדיקה",
        round: n, edge: null, changed: null, updated: false, canRelax: false,
        dist: clone(dist), pi: clone(pi),
        expl: "מעבר הבדיקה (סבב |V| = " + n + "): עוברים שוב על כל " + m +
          " הקשתות — אף אחת אינה ניתנת עוד להקלה. אין מעגל שלילי."
      });

      var tree = [], list = [];
      for (i = 0; i < n; i++) {
        var id = V[i];
        list.push("d[" + id + "]=" + fmt(dist[id]));
        if (pi[id]) tree.push(pi[id] + "->" + id);
      }
      steps.push({
        kind: "done", phaseKey: "done", phaseLabel: "סיום",
        round: n, edge: null, changed: null, updated: false, canRelax: false,
        resultTrue: true,
        highlightEdges: tree, highlightColor: C.sage, highlightNodes: [],
        dist: clone(dist), pi: clone(pi),
        expl: "<b>תוצאה: TRUE.</b> אף קשת אינה ניתנת עוד להקלה, ולכן ערכי " +
          ltr("d") + " הם המרחקים הקצרים ביותר " + ltr("δ(s,v)") + ": " +
          ltr(list.join(", ")) + ". הקשתות הירוקות הן עץ המסלולים הקצרים (" +
          ltr("π") + ")."
      });
    }

    return steps;
  }

  /* =====================================================================
     Scene builder — hand-authored SVG graph (edges under nodes).
     ===================================================================== */
  function markerFor(color) {
    if (color === C.mustard) return "url(#bfr-arr-mustard)";
    if (color === C.sage) return "url(#bfr-arr-sage)";
    if (color === C.clay) return "url(#bfr-arr-clay)";
    return "url(#bfr-arr-gray)";
  }

  function buildScene(scn) {
    var W = 720, H = 380;
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H, width: "100%",
      role: "img", direction: "ltr",
      "aria-label": "גרף Bellman-Ford: קודקודים S, A, B, C והרצת הסבבים"
    });
    svg.style.display = "block";
    svg.style.maxWidth = W + "px";
    svg.style.margin = "0 auto";

    var defs = el("defs");
    ["gray", "mustard", "sage", "clay"].forEach(function (name) {
      var col = name === "gray" ? "#B9AD98" : C[name];
      var mk = el("marker", {
        id: "bfr-arr-" + name, viewBox: "0 0 10 10", refX: "8.5", refY: "5",
        markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse"
      });
      mk.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", fill: col }));
      defs.appendChild(mk);
    });
    svg.appendChild(defs);

    /* centroid — used to push weight labels outward */
    var cx = 0, cy = 0;
    scn.nodes.forEach(function (id) { cx += scn.coord[id][0]; cy += scn.coord[id][1]; });
    cx /= scn.nodes.length; cy /= scn.nodes.length;

    var edgeMap = {};
    scn.edges.forEach(function (edge) {
      var a = scn.coord[edge.u], b = scn.coord[edge.v];
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / len, uy = dy / len;
      var x1 = a[0] + ux * NODE_R, y1 = a[1] + uy * NODE_R;
      var x2 = b[0] - ux * (NODE_R + 7), y2 = b[1] - uy * (NODE_R + 7);

      var line = el("line", {
        x1: x1, y1: y1, x2: x2, y2: y2,
        stroke: "#B9AD98", "stroke-width": 2, "stroke-linecap": "round",
        "marker-end": "url(#bfr-arr-gray)"
      });
      svg.appendChild(line);

      /* weight label — offset perpendicular, away from centroid */
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2, O = 17;
      var p1x = mx - uy * O, p1y = my + ux * O;
      var p2x = mx + uy * O, p2y = my - ux * O;
      var d1 = (p1x - cx) * (p1x - cx) + (p1y - cy) * (p1y - cy);
      var d2 = (p2x - cx) * (p2x - cx) + (p2y - cy) * (p2y - cy);
      var lx = d1 >= d2 ? p1x : p2x, ly = d1 >= d2 ? p1y : p2y;

      var wStr = fmt(edge.w);
      var halfW = 8 + wStr.length * 4.5;
      var wg = el("g");
      wg.appendChild(el("rect", {
        x: lx - halfW, y: ly - 11, width: halfW * 2, height: 20, rx: 6,
        fill: C.surface, stroke: C.line, "stroke-width": 1
      }));
      wg.appendChild(txt(lx, ly + 4, wStr, {
        "text-anchor": "middle", "font-size": 12.5, "font-weight": 700,
        fill: edge.w < 0 ? C.clay : C.inkSoft
      }));
      svg.appendChild(wg);

      edgeMap[ekey(edge)] = { line: line };
    });

    /* nodes on top */
    var nodeMap = {};
    scn.nodes.forEach(function (id) {
      var p = scn.coord[id];
      var g = el("g");
      var isSrc = (id === scn.source);
      var circle = el("circle", {
        cx: p[0], cy: p[1], r: NODE_R,
        fill: isSrc ? "#E7EDF1" : C.surface,
        stroke: isSrc ? C.blue : C.line, "stroke-width": isSrc ? 3 : 2
      });
      g.appendChild(circle);
      g.appendChild(txt(p[0], p[1] + 6, id, {
        "text-anchor": "middle", "font-size": 17, "font-weight": 800,
        fill: C.ink
      }));

      /* dist pill above the node */
      var pillY = p[1] - NODE_R - 20;
      var pill = el("rect", {
        x: p[0] - 24, y: pillY, width: 48, height: 21, rx: 10.5,
        fill: C.surface2, stroke: C.line, "stroke-width": 1.2
      });
      g.appendChild(pill);
      var distTx = txt(p[0], pillY + 15, "∞", {
        "text-anchor": "middle", "font-size": 13, "font-weight": 800, fill: C.ink
      });
      g.appendChild(distTx);

      svg.appendChild(g);
      nodeMap[id] = { circle: circle, dist: distTx, pill: pill, isSrc: isSrc };
    });

    return { svg: svg, edgeMap: edgeMap, nodeMap: nodeMap };
  }

  /* =====================================================================
     render one mount
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-bfr-ready") === "1") return;
    mount.setAttribute("data-bfr-ready", "1");
    mount.innerHTML = "";

    var scenarioKey = "neg";
    var scn, scene, steps, phases, idx, autoTimer = null;

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");
    wrap.style.outline = "none";

    /* ---- scenario toggle ---- */
    var scnRow = document.createElement("div");
    scnRow.className = "viz-controls";
    scnRow.style.marginTop = "0";
    scnRow.style.marginBottom = ".7rem";
    var scnLbl = document.createElement("span");
    scnLbl.textContent = "תרחיש:";
    scnLbl.style.fontWeight = "700";
    scnLbl.style.color = C.ink;
    scnLbl.style.fontSize = ".9rem";
    scnRow.appendChild(scnLbl);
    var btnNeg = mkBtn("● מעגל שלילי · גרף ההרצאה", function () { switchScenario("neg"); });
    var btnSafe = mkBtn("○ ללא מעגל שלילי · וריאנט", function () { switchScenario("safe"); });
    scnRow.appendChild(btnNeg);
    scnRow.appendChild(btnSafe);
    wrap.appendChild(scnRow);

    /* ---- graph caption ---- */
    var caption = document.createElement("div");
    caption.style.fontSize = ".82rem";
    caption.style.color = C.inkSoft;
    caption.style.lineHeight = "1.6";
    caption.style.margin = "0 0 .5rem";
    wrap.appendChild(caption);

    /* ---- scene box ---- */
    var sceneBox = document.createElement("div");
    sceneBox.style.background = C.surface;
    sceneBox.style.borderRadius = "12px";
    sceneBox.style.padding = "6px 4px";
    sceneBox.style.border = "1px solid " + C.line;
    wrap.appendChild(sceneBox);

    /* ---- round / edge-order strip ---- */
    var roundBar = document.createElement("div");
    roundBar.style.display = "flex";
    roundBar.style.alignItems = "center";
    roundBar.style.flexWrap = "wrap";
    roundBar.style.gap = "8px";
    roundBar.style.margin = "12px 0 2px";
    var roundLbl = document.createElement("span");
    roundLbl.style.fontWeight = "800";
    roundLbl.style.fontSize = ".92rem";
    roundLbl.style.color = C.ink;
    roundLbl.style.minWidth = "8.5rem";
    roundBar.appendChild(roundLbl);
    var edgeStrip = document.createElement("div");
    edgeStrip.style.display = "flex";
    edgeStrip.style.flexWrap = "wrap";
    edgeStrip.style.gap = "5px";
    roundBar.appendChild(edgeStrip);
    wrap.appendChild(roundBar);
    var edgePills = [];

    /* ---- dist / π tables ---- */
    var tableBox = document.createElement("div");
    tableBox.style.overflowX = "auto";
    tableBox.style.margin = "10px 0 0";
    var table = document.createElement("table");
    table.style.borderCollapse = "collapse";
    table.style.width = "100%";
    table.style.minWidth = "340px";
    table.style.fontSize = ".9rem";
    table.setAttribute("dir", "ltr");
    tableBox.appendChild(table);
    wrap.appendChild(tableBox);
    var distCells = {}, piCells = {};

    /* ---- explanation panel ---- */
    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.background = C.surface2;
    panel.style.border = "1px solid " + C.line;
    panel.style.borderRadius = "12px";
    panel.style.padding = "12px 14px";
    panel.style.marginTop = "12px";
    panel.style.minHeight = "88px";
    panel.style.color = C.ink;
    panel.style.lineHeight = "1.7";
    panel.style.fontSize = ".9rem";
    wrap.appendChild(panel);

    /* ---- phase rail ---- */
    var rail = document.createElement("div");
    rail.setAttribute("role", "tablist");
    rail.setAttribute("aria-label", "שלבי ההרצה");
    rail.style.display = "flex";
    rail.style.flexWrap = "wrap";
    rail.style.gap = "6px";
    rail.style.margin = "12px 0 2px";
    wrap.appendChild(rail);
    var phaseBtns = [];

    /* ---- step controls ---- */
    var controls = document.createElement("div");
    controls.className = "viz-controls";
    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); go(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); go(idx + 1); });
    btnNext.classList.add("primary");
    var btnPlay = mkBtn("▶ הפעל", function () { toggleAuto(); });
    var btnReset = mkBtn("↺ איפוס", function () { stopAuto(); go(0); });
    controls.appendChild(btnPrev);
    controls.appendChild(btnNext);
    controls.appendChild(btnPlay);
    controls.appendChild(btnReset);
    var stepCounter = document.createElement("span");
    stepCounter.style.marginInlineStart = "auto";
    stepCounter.style.alignSelf = "center";
    stepCounter.style.fontSize = ".82rem";
    stepCounter.style.color = C.inkSoft;
    stepCounter.style.fontWeight = "700";
    controls.appendChild(stepCounter);
    wrap.appendChild(controls);

    /* screen-reader live status (visually hidden, no layout impact) */
    var status = document.createElement("p");
    status.setAttribute("aria-live", "polite");
    status.style.cssText =
      "position:absolute;width:1px;height:1px;margin:-1px;padding:0;" +
      "overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;";
    wrap.appendChild(status);

    mount.appendChild(wrap);

    /* ---------- builders ---------- */
    function mkBtn(label, fn) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn";
      b.innerHTML = label;
      b.addEventListener("click", fn);
      return b;
    }

    function buildTable() {
      table.innerHTML = "";
      distCells = {}; piCells = {};
      var thead = document.createElement("thead");
      var htr = document.createElement("tr");
      htr.appendChild(thCell("", true));
      scn.nodes.forEach(function (id) { htr.appendChild(thCell(id, true)); });
      thead.appendChild(htr);
      table.appendChild(thead);

      var tbody = document.createElement("tbody");
      var dtr = document.createElement("tr");
      dtr.appendChild(thCell("d[v]", false));
      scn.nodes.forEach(function (id) {
        var td = tdCell(); distCells[id] = td; dtr.appendChild(td);
      });
      tbody.appendChild(dtr);
      var ptr = document.createElement("tr");
      ptr.appendChild(thCell("π[v]", false));
      scn.nodes.forEach(function (id) {
        var td = tdCell(); piCells[id] = td; ptr.appendChild(td);
      });
      tbody.appendChild(ptr);
      table.appendChild(tbody);
    }
    function thCell(s, head) {
      var th = document.createElement("th");
      th.textContent = s;
      th.style.border = "1px solid " + C.line;
      th.style.padding = "6px 8px";
      th.style.fontWeight = "800";
      th.style.textAlign = "center";
      th.style.background = head ? C.surface2 : C.surface;
      th.style.color = head ? C.ink : C.inkSoft;
      th.style.fontFamily = head ? "inherit" : "monospace";
      return th;
    }
    function tdCell() {
      var td = document.createElement("td");
      td.style.border = "1px solid " + C.line;
      td.style.padding = "6px 8px";
      td.style.textAlign = "center";
      td.style.fontFamily = "monospace";
      td.style.fontWeight = "700";
      td.style.color = C.ink;
      td.style.transition = "background .25s";
      return td;
    }

    function buildEdgeStrip() {
      edgeStrip.innerHTML = "";
      edgePills = scn.edges.map(function (e) {
        var pill = document.createElement("span");
        pill.setAttribute("dir", "ltr");
        pill.textContent = e.u + "→" + e.v + " (" + fmt(e.w) + ")";
        pill.style.fontFamily = "monospace";
        pill.style.fontSize = ".78rem";
        pill.style.fontWeight = "700";
        pill.style.padding = "2px 8px";
        pill.style.borderRadius = "99px";
        pill.style.border = "1px solid " + C.line;
        pill.style.background = C.surface2;
        pill.style.color = C.inkSoft;
        edgeStrip.appendChild(pill);
        return pill;
      });
    }

    function buildRail() {
      rail.innerHTML = "";
      phaseBtns = phases.map(function (ph) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "viz-btn";
        b.setAttribute("role", "tab");
        b.textContent = ph.label;
        b.style.padding = ".2rem .66rem";
        b.style.fontSize = ".8rem";
        b.addEventListener("click", function () { stopAuto(); go(ph.start); });
        rail.appendChild(b);
        return b;
      });
    }

    function computePhases() {
      phases = [];
      var cur = null;
      steps.forEach(function (s, i) {
        if (!cur || cur.key !== s.phaseKey) {
          cur = { key: s.phaseKey, label: s.phaseLabel, start: i };
          phases.push(cur);
        }
      });
    }

    /* ---------- paint a step (idempotent) ---------- */
    function pulse(node) {
      if (reducedMotion() || !node.animate) return;
      node.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 320 });
    }

    function paintGraph(st) {
      /* reset edges */
      for (var key in scene.edgeMap) {
        var ln = scene.edgeMap[key].line;
        ln.setAttribute("stroke", "#B9AD98");
        ln.setAttribute("stroke-width", 2);
        ln.setAttribute("marker-end", "url(#bfr-arr-gray)");
      }
      /* reset nodes */
      scn.nodes.forEach(function (id) {
        var nd = scene.nodeMap[id];
        nd.dist.textContent = fmt(st.dist[id]);
        nd.dist.setAttribute("fill", st.dist[id] === Infinity ? C.inkSoft : C.ink);
        nd.circle.setAttribute("stroke", nd.isSrc ? C.blue : C.line);
        nd.circle.setAttribute("stroke-width", nd.isSrc ? 3 : 2);
        nd.circle.setAttribute("fill", nd.isSrc ? "#E7EDF1" : C.surface);
        nd.pill.setAttribute("stroke", C.line);
        nd.pill.setAttribute("fill", C.surface2);
      });

      /* done: highlight cycle or shortest-path tree */
      if (st.kind === "done" && st.highlightEdges) {
        st.highlightEdges.forEach(function (k) {
          var eo = scene.edgeMap[k];
          if (!eo) return;
          eo.line.setAttribute("stroke", st.highlightColor);
          eo.line.setAttribute("stroke-width", 4);
          eo.line.setAttribute("marker-end", markerFor(st.highlightColor));
        });
        (st.highlightNodes || []).forEach(function (id) {
          var nd = scene.nodeMap[id];
          nd.circle.setAttribute("stroke", st.highlightColor);
          nd.circle.setAttribute("stroke-width", 3);
          nd.pill.setAttribute("stroke", st.highlightColor);
        });
      }

      /* active edge (relax / check) */
      if (st.edge) {
        var col = (st.kind === "check")
          ? (st.canRelax ? C.clay : C.mustard)
          : (st.updated ? C.sage : C.mustard);
        var eo2 = scene.edgeMap[ekey(st.edge)];
        if (eo2) {
          eo2.line.setAttribute("stroke", col);
          eo2.line.setAttribute("stroke-width", 4);
          eo2.line.setAttribute("marker-end", markerFor(col));
          pulse(eo2.line);
        }
        var tgt = scene.nodeMap[st.edge.v];
        if (tgt) {
          tgt.circle.setAttribute("stroke", col);
          tgt.circle.setAttribute("stroke-width", 3);
          if (st.updated) { tgt.pill.setAttribute("stroke", C.sage); pulse(tgt.pill); }
          if (st.kind === "check" && st.canRelax) tgt.pill.setAttribute("stroke", C.clay);
        }
      }
    }

    function paintTables(st) {
      scn.nodes.forEach(function (id) {
        distCells[id].textContent = fmt(st.dist[id]);
        distCells[id].style.background = "";
        distCells[id].style.color = st.dist[id] === Infinity ? C.inkSoft : C.ink;
        var pv = st.pi[id];
        piCells[id].textContent = pv ? pv : (id === scn.source ? "—" : "NIL");
        piCells[id].style.background = "";
      });
      if (st.changed) {
        distCells[st.changed].style.background = TINT_SAGE;
        piCells[st.changed].style.background = TINT_SAGE;
      }
      if (st.kind === "check" && st.canRelax && st.edge) {
        distCells[st.edge.v].style.background = TINT_CLAY;
      }
    }

    function paintStrip(st) {
      edgePills.forEach(function (pill, i) {
        var active = st.edge && st.edgeIdx === i &&
          (st.kind === "relax" || st.kind === "check");
        if (active) {
          var col = (st.kind === "check")
            ? (st.canRelax ? C.clay : C.mustard)
            : (st.updated ? C.sage : C.mustard);
          pill.style.background = col;
          pill.style.color = "#fff";
          pill.style.borderColor = col;
        } else {
          pill.style.background = C.surface2;
          pill.style.color = C.inkSoft;
          pill.style.borderColor = C.line;
        }
      });

      if (st.kind === "init") roundLbl.textContent = "אתחול";
      else if (st.kind === "round-noop") roundLbl.textContent = "סבב " + st.round + " / " + (scn.nodes.length - 1);
      else if (st.kind === "relax") roundLbl.textContent = "סבב " + st.round + " / " + (scn.nodes.length - 1);
      else if (st.kind === "check" || st.kind === "check-noop") roundLbl.textContent = "מעבר בדיקה · סבב |V|=" + scn.nodes.length;
      else roundLbl.textContent = st.resultTrue ? "סיום · TRUE ✓" : "סיום · FALSE ✕";
    }

    function paintPanel(st) {
      var badgeCol, badgeTx;
      if (st.kind === "init") { badgeCol = C.blue; badgeTx = "Init"; }
      else if (st.kind === "relax") { badgeCol = st.updated ? C.sage : C.mustard; badgeTx = st.updated ? "Relax ✓" : "no change"; }
      else if (st.kind === "round-noop") { badgeCol = C.blue; badgeTx = "round " + st.round; }
      else if (st.kind === "check" || st.kind === "check-noop") { badgeCol = st.canRelax ? C.clay : C.blue; badgeTx = "check"; }
      else { badgeCol = st.resultTrue ? C.sage : C.clay; badgeTx = st.resultTrue ? "return TRUE" : "return FALSE"; }
      panel.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
          '<span dir="ltr" style="background:' + badgeCol + ';color:#fff;font-weight:700;' +
            'font-size:.72rem;padding:2px 10px;border-radius:99px">' + badgeTx + "</span>" +
        "</div><div>" + st.expl + "</div>";
    }

    function paintPhases() {
      phaseBtns.forEach(function (b, i) {
        var ph = phases[i];
        var nextStart = (i + 1 < phases.length) ? phases[i + 1].start : steps.length;
        var active = idx >= ph.start && idx < nextStart;
        var done = idx >= nextStart;
        b.setAttribute("aria-selected", active ? "true" : "false");
        if (active) { b.style.background = C.blue; b.style.color = "#fff"; b.style.borderColor = C.blue; }
        else if (done) { b.style.background = C.surface2; b.style.color = C.ink; b.style.borderColor = C.blue; }
        else { b.style.background = C.surface2; b.style.color = C.inkSoft; b.style.borderColor = C.line; }
      });
    }

    /* ---------- navigation ---------- */
    function go(n) {
      idx = Math.max(0, Math.min(steps.length - 1, n));
      var st = steps[idx];
      paintGraph(st);
      paintTables(st);
      paintStrip(st);
      paintPanel(st);
      paintPhases();
      stepCounter.textContent = "צעד " + (idx + 1) + " / " + steps.length;
      btnPrev.disabled = (idx === 0);
      btnNext.disabled = (idx === steps.length - 1);
      status.textContent = st.expl.replace(/<[^>]+>/g, "");
    }

    /* ---------- autoplay ---------- */
    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      if (idx >= steps.length - 1) go(0);
      btnPlay.innerHTML = "⏸ השהה";
      btnPlay.classList.add("primary");
      var delay = reducedMotion() ? 1400 : 1650;
      autoTimer = setInterval(function () {
        if (idx >= steps.length - 1) { stopAuto(); return; }
        go(idx + 1);
      }, delay);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      btnPlay.innerHTML = "▶ הפעל";
      btnPlay.classList.remove("primary");
    }

    /* ---------- scenario switching ---------- */
    function switchScenario(key) {
      stopAuto();
      scenarioKey = key;
      scn = SCENARIOS[key];
      caption.textContent = scn.caption;
      btnNeg.classList.toggle("primary", key === "neg");
      btnSafe.classList.toggle("primary", key === "safe");
      btnNeg.setAttribute("aria-pressed", key === "neg" ? "true" : "false");
      btnSafe.setAttribute("aria-pressed", key === "safe" ? "true" : "false");

      scene = buildScene(scn);
      sceneBox.innerHTML = "";
      sceneBox.appendChild(scene.svg);

      steps = buildSteps(scn);
      computePhases();
      buildTable();
      buildEdgeStrip();
      buildRail();
      go(0);
    }

    /* keyboard (RTL-aware: Right = prev, Left = next) */
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { stopAuto(); go(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { stopAuto(); go(idx + 1); e.preventDefault(); }
      else if (e.key === "Home") { stopAuto(); go(0); e.preventDefault(); }
      else if (e.key === "End") { stopAuto(); go(steps.length - 1); e.preventDefault(); }
      else if (e.key === " " || e.key === "Enter") { toggleAuto(); e.preventDefault(); }
    });

    /* initial */
    switchScenario("neg");
  }

  /* =====================================================================
     boot — mount all instances, never throw.
     ===================================================================== */
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
