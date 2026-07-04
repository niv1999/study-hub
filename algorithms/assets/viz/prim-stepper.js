/* =====================================================================
   prim-stepper.js  —  Module 04 "עץ פורש מינימלי — אלגוריתם Prim"
   Grounded in _notes/03-mst-he.md + 03-mst-en.md:

   THE LECTURE EXAMPLE (exact, verbatim from the notes):
     • Graph = the classic CLRS graph used throughout part-1
       (_notes/03-mst-he.md §"הגרף הקבוע של part-1", lec-mst-part-1.pdf עמ' 2).
       9 vertices {a,b,c,d,e,f,g,h,i}, undirected, weights:
         a-b=4 · a-h=8 · b-c=8 · b-h=11 · c-d=7 · c-i=2 · c-f=4
         d-e=9 · d-f=14 · e-f=10 · f-g=2 · g-h=1 · g-i=6 · h-i=7
       The MST stated in the notes (turquoise in the slides):
         {a-b(4), a-h(8), h-g(1), g-f(2), f-c(4), c-i(2), c-d(7), d-e(9)}
         total weight = 37.
     • Pseudocode = MST-PRIM verbatim from _notes/03-mst-he.md
       (part-2 עמ' 9-16), 11 numbered lines, root r.

   We run MST-PRIM from root r = a and animate it step-by-step. The
   extraction order a,b,h,g,f,c,i,d,e reproduces the notes' MST exactly
   (weight 37). The only tie (h vs c, both key=8) is broken by discovery
   order — h was discovered before c — matching the slides' choice of a-h.

   Live bookkeeping shown (the pedagogy): key[] / π[] arrays, the contents
   of the priority queue Q, the growing tree with its running weight, and
   the active pseudocode line — exactly the state the lecturer tracks.

   Colour code (from _notes quirks §"קוד צבע עקבי"):
     sage/turquoise = tree / chosen light edge · clay/red = extracted
     vertex (Extract-Min) + active pseudocode line · mustard = key update
     (relax) · grey = ordinary edge.

   Self-contained IIFE. Hand-authored SVG + DOM. No external deps.
   Cream design tokens hardcoded (CONTRACT §2). RTL Hebrew captions,
   English/LTR algorithm identifiers. Works over http(s):// and file://.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "prim-stepper";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design palette (hardcoded per CONTRACT §2) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",   /* queue / info */
    clay: "#BE7C5E",   /* extracted vertex + active line (red) */
    sage: "#7C9885",   /* MST tree / chosen light edge (turquoise) */
    mustard: "#C9A24B" /* relax / key update */
  };
  var SAGE_TINT = "#E4ECE5";
  var CLAY_TINT = "#F1E0D6";
  var MUST_TINT = "#F3E9CF";
  var INF = "∞"; /* ∞ */

  /* ---------------- graph model (the CLRS lecture graph) ---------------- */
  var VERTS = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  var ROOT = "a";
  var EDGES = [
    ["a", "b", 4], ["a", "h", 8], ["b", "c", 8], ["b", "h", 11],
    ["c", "d", 7], ["c", "i", 2], ["c", "f", 4], ["d", "e", 9],
    ["d", "f", 14], ["e", "f", 10], ["f", "g", 2], ["g", "h", 1],
    ["g", "i", 6], ["h", "i", 7]
  ];

  /* SVG positions (classic CLRS layout) */
  var POS = {
    a: [40, 170], b: [165, 58], c: [300, 58], d: [435, 58],
    e: [548, 170], f: [435, 282], g: [300, 282], h: [165, 282], i: [300, 170]
  };

  /* adjacency list */
  var ADJ = {};
  VERTS.forEach(function (v) { ADJ[v] = []; });
  EDGES.forEach(function (e) {
    ADJ[e[0]].push({ v: e[1], w: e[2] });
    ADJ[e[1]].push({ v: e[0], w: e[2] });
  });

  function edgeId(a, b) { return [a, b].sort().join("~"); }
  function fmtKey(k) { return k === Infinity ? INF : String(k); }
  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function ltr(s) { return '<span dir="ltr">' + s + "</span>"; }

  /* =====================================================================
     STEP ENGINE — actually run MST-PRIM and record a snapshot per event.
     Events: init → (extract, relax)* → done. This IS the algorithm, so
     the animation and the bookkeeping can never drift from the semantics.
     ===================================================================== */
  function buildSteps() {
    var key = {}, pi = {}, disc = {}, discN = 0;
    var inQueue = {}, inTree = {};
    VERTS.forEach(function (v) {
      key[v] = Infinity; pi[v] = null; inQueue[v] = true; inTree[v] = false;
    });
    key[ROOT] = 0; disc[ROOT] = discN++;

    var treeEdges = [];     /* {p, c, w} */
    var weightSum = 0;
    var steps = [];

    function snap(extra) {
      var s = {
        key: Object.assign({}, key),
        pi: Object.assign({}, pi),
        inQueue: Object.assign({}, inQueue),
        inTree: Object.assign({}, inTree),
        treeEdgeIds: treeEdges.map(function (t) { return edgeId(t.p, t.c); }),
        weightSum: weightSum
      };
      for (var k in extra) s[k] = extra[k];
      steps.push(s);
    }

    /* ---- init (lines 1-5) ---- */
    snap({
      phase: "init", u: null, activeLines: [1, 2, 3, 4, 5],
      chosenEdgeId: null, relaxEdges: [], updated: [],
      title: "אתחול",
      body: "קובעים " + ltr("key[u]=" + INF) + " ו-" + ltr("π[u]=NIL") +
        " לכל קודקוד; לשורש " + ltr("r=a") + " קובעים " + ltr("key[a]=0") + ". " +
        "תור העדיפויות " + ltr("Q") + " מכיל את כל 9 הקודקודים. " +
        "הקודקוד עם ה-key המינימלי (0) הוא " + ltr("a") + " — הוא ייחלץ ראשון."
    });

    /* ---- main loop ---- */
    function extractMin() {
      var best = null;
      VERTS.forEach(function (v) {
        if (!inQueue[v]) return;
        if (best === null) { best = v; return; }
        if (key[v] < key[best]) { best = v; return; }
        if (key[v] === key[best]) {
          /* tie → earlier discovery wins (reproduces the notes' a-h choice),
             then alphabetical as a final deterministic fallback */
          var dv = disc[v] == null ? Infinity : disc[v];
          var db = disc[best] == null ? Infinity : disc[best];
          if (dv < db || (dv === db && v < best)) best = v;
        }
      });
      return best;
    }

    while (VERTS.some(function (v) { return inQueue[v]; })) {
      var u = extractMin();
      inQueue[u] = false;
      inTree[u] = true;
      var chosen = null;
      if (pi[u] !== null) {
        treeEdges.push({ p: pi[u], c: u, w: key[u] });
        weightSum += key[u];
        chosen = edgeId(pi[u], u);
      }

      /* extract snapshot (line 7) */
      var exBody;
      if (pi[u] === null) {
        exBody = ltr("Extract-Min") + " מחזיר את " + ltr("a") +
          " (key=0, המינימום). מוסיפים את " + ltr("a") + " לעץ. " +
          "זהו השורש ולכן אין קשת נכנסת (" + ltr("π[a]=NIL") + ").";
      } else {
        exBody = ltr("Extract-Min") + " מחזיר את " + ltr(u) +
          " — ה-key המינימלי ב-Q כרגע (" + ltr(String(key[u])) + "). " +
          "מצרפים לעץ את הקשת הבטוחה " + ltr("(" + pi[u] + "," + u + ")") +
          " במשקל " + ltr(String(key[u])) + " — היא הקשת הקלה החוצה את החתך " +
          "(העץ שנבנה מול שאר הקודקודים). משקל העץ המצטבר: " +
          ltr(String(weightSum)) + ".";
      }
      snap({
        phase: "extract", u: u, activeLines: [7],
        chosenEdgeId: chosen, relaxEdges: [], updated: [],
        title: "Extract-Min ← " + u + (pi[u] === null ? "  (השורש)" : ""),
        body: exBody
      });

      /* relax neighbours still in Q (lines 8-11) */
      var considered = [], updated = [];
      ADJ[u].forEach(function (nb) {
        if (!inQueue[nb.v]) return;
        var old = key[nb.v];
        var improves = nb.w < old;
        considered.push({ v: nb.v, w: nb.w, old: old, improves: improves });
        if (improves) {
          if (disc[nb.v] == null) disc[nb.v] = discN++;
          pi[nb.v] = u; key[nb.v] = nb.w;
          updated.push(nb.v);
        }
      });

      if (considered.length) {
        var lines = considered.map(function (c) {
          if (c.improves) {
            return "השכן " + ltr(c.v) + ": " +
              (c.old === Infinity
                ? "key יורד מ-" + INF + " ל-"
                : "key יורד מ-" + c.old + " ל-") +
              "<b style=\"color:" + C.mustard + "\">" + c.w + "</b> דרך " +
              ltr("(" + u + "," + c.v + ")") + ", ומעודכן " +
              ltr("π[" + c.v + "]=" + u) + ".";
          }
          return "השכן " + ltr(c.v) + ": המשקל " + ltr("w(" + u + "," + c.v + ")=" + c.w) +
            " אינו קטן מ-" + ltr("key[" + c.v + "]=" + fmtKey(c.old)) + " — אין עדכון.";
        });
        var relaxEdges = considered.map(function (c) {
          return { id: edgeId(u, c.v), improves: c.improves };
        });
        snap({
          phase: "relax", u: u, activeLines: [8, 9, 10, 11],
          chosenEdgeId: null, relaxEdges: relaxEdges, updated: updated,
          title: "עדכון שכנים (relax) של " + u,
          body: "עוברים על שכני " + ltr(u) + " שעדיין ב-Q ומריצים relax:<br>" +
            lines.join("<br>")
        });
      }
    }

    /* ---- done (line 6: while Q ≠ ∅ fails) ---- */
    snap({
      phase: "done", u: null, activeLines: [6],
      chosenEdgeId: null, relaxEdges: [], updated: [],
      title: "סיום — העץ הפורש המינימלי מוכן",
      body: "התור " + ltr("Q") + " ריק — כל 9 הקודקודים בעץ. העץ הפורש המינימלי הוא " +
        ltr("{a-b(4), a-h(8), h-g(1), g-f(2), f-c(4), c-i(2), c-d(7), d-e(9)}") +
        ", משקל כולל <b style=\"color:" + C.sage + "\">37</b> — בדיוק העץ הטורקיז מהשקפים."
    });

    return steps;
  }

  /* =====================================================================
     SVG helpers
     ===================================================================== */
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

  /* =====================================================================
     Scene builder — hand-authored graph SVG. Returns references keyed by
     vertex / edge so applyState can restyle them.
     ===================================================================== */
  var GW = 588, GH = 340, R = 19;

  function buildGraph() {
    var svg = el("svg", {
      viewBox: "0 0 " + GW + " " + GH, width: "100%",
      role: "img", direction: "ltr",
      "aria-label": "גרף CLRS עם תשעה קודקודים; אלגוריתם Prim בונה עליו עץ פורש מינימלי"
    });
    svg.style.display = "block";
    svg.style.maxWidth = GW + "px";
    svg.style.margin = "0 auto";

    var edgeEls = {};   /* id → { line, chip, chipBg } */
    var nodeEls = {};   /* v  → { circle, letter, keyBg, keyTx } */

    /* ---- edges (drawn first, under the nodes) ---- */
    EDGES.forEach(function (e) {
      var a = POS[e[0]], b = POS[e[1]], id = edgeId(e[0], e[1]);
      var line = el("line", {
        x1: a[0], y1: a[1], x2: b[0], y2: b[1],
        stroke: C.line, "stroke-width": 3, "stroke-linecap": "round"
      });
      svg.appendChild(line);
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      var chipBg = el("rect", {
        x: mx - 11, y: my - 10, width: 22, height: 20, rx: 6,
        fill: C.surface, stroke: C.line, "stroke-width": 1
      });
      var chip = txt(mx, my + 4, String(e[2]), {
        "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: C.inkSoft
      });
      svg.appendChild(chipBg);
      svg.appendChild(chip);
      edgeEls[id] = { line: line, chip: chip, chipBg: chipBg };
    });

    /* ---- nodes ---- */
    VERTS.forEach(function (v) {
      var p = POS[v];
      var g = el("g", {});
      var circle = el("circle", {
        cx: p[0], cy: p[1], r: R,
        fill: C.surface, stroke: C.line, "stroke-width": 2.5
      });
      var letter = txt(p[0], p[1] + 5, v, {
        "text-anchor": "middle", "font-size": 15, "font-weight": 800, fill: C.ink
      });
      /* key chip floating above the node */
      var chipY = p[1] - R - 13;
      var keyBg = el("rect", {
        x: p[0] - 15, y: chipY - 11, width: 30, height: 18, rx: 9,
        fill: C.surface2, stroke: C.line, "stroke-width": 1
      });
      var keyTx = txt(p[0], chipY + 3, INF, {
        "text-anchor": "middle", "font-size": 11.5, "font-weight": 700, fill: C.inkSoft,
        direction: "ltr"
      });
      g.appendChild(circle); g.appendChild(letter);
      g.appendChild(keyBg); g.appendChild(keyTx);
      svg.appendChild(g);
      nodeEls[v] = { g: g, circle: circle, letter: letter, keyBg: keyBg, keyTx: keyTx };
    });

    return { svg: svg, edgeEls: edgeEls, nodeEls: nodeEls };
  }

  /* =====================================================================
     Render one mount
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-prim-ready") === "1") return;
    mount.setAttribute("data-prim-ready", "1");
    mount.innerHTML = "";

    var STEPS = buildSteps();
    var idx = 0, autoTimer = null;

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");
    wrap.style.outline = "none";

    /* ---- caption row ---- */
    var cap = document.createElement("div");
    cap.style.cssText = "display:flex;flex-wrap:wrap;gap:.5rem;align-items:baseline;" +
      "margin-bottom:.7rem;color:" + C.inkSoft + ";font-size:.86rem";
    cap.innerHTML =
      '<b style="color:' + C.ink + ';font-size:.98rem">Prim צעד-אחר-צעד</b>' +
      '<span>על גרף ההרצאה (CLRS, קודקודים ' + ltr("a–i") + '), שורש ' + ltr("r=a") + '.</span>';
    wrap.appendChild(cap);

    /* ---- top row: graph + pseudocode ---- */
    var top = document.createElement("div");
    top.style.cssText = "display:flex;flex-wrap:wrap;gap:14px;align-items:stretch";

    var graphBox = document.createElement("div");
    graphBox.style.cssText = "flex:1 1 340px;min-width:300px;background:" + C.surface +
      ";border:1px solid " + C.line + ";border-radius:12px;padding:8px 6px";
    var graph = buildGraph();
    graphBox.appendChild(graph.svg);
    /* small legend under the graph */
    var legend = document.createElement("div");
    legend.style.cssText = "display:flex;flex-wrap:wrap;gap:.4rem 1rem;justify-content:center;" +
      "margin-top:4px;font-size:.72rem;color:" + C.inkSoft;
    function dot(col, label) {
      return '<span style="display:inline-flex;align-items:center;gap:.3rem">' +
        '<span style="width:11px;height:11px;border-radius:3px;background:' + col +
        ';display:inline-block"></span>' + label + '</span>';
    }
    legend.innerHTML =
      dot(C.sage, "קשת בעץ") +
      dot(C.clay, "הקודקוד שנחלץ") +
      dot(C.mustard, "עדכון key (relax)") +
      dot(C.line, "קשת רגילה");
    graphBox.appendChild(legend);
    top.appendChild(graphBox);

    /* pseudocode box */
    var pseudoBox = document.createElement("div");
    pseudoBox.style.cssText = "flex:1 1 260px;min-width:240px;background:" + C.surface2 +
      ";border:1px solid " + C.line + ";border-radius:12px;padding:10px 12px";
    var pseudoTitle = document.createElement("div");
    pseudoTitle.style.cssText = "font-size:.8rem;font-weight:700;color:" + C.inkSoft +
      ";margin-bottom:6px;direction:rtl";
    pseudoTitle.innerHTML = "פסאודו-קוד " + ltr("MST-PRIM(G, w, r)");
    pseudoBox.appendChild(pseudoTitle);

    var PSEUDO = [
      "1.  For each u ∈ V[G]",
      "2.      do key[u] ← ∞",
      "3.          π[u] ← NIL",
      "4.  key[r] ← 0",
      "5.  Q ← V[G]",
      "6.  While Q ≠ ∅",
      "7.      do u ← Extract-Min(Q)",
      "8.          for each v ∈ Adj[u]",
      "9.              do if v ∈ Q and w(u,v) < key[v]",
      "10.                 then π[v] ← u",
      "11.                      key[v] ← w(u,v)"
    ];
    var pre = document.createElement("pre");
    pre.setAttribute("dir", "ltr");
    pre.style.cssText = "margin:0;font-size:.78rem;line-height:1.5;white-space:pre;" +
      "overflow-x:auto;color:" + C.ink;
    var lineEls = PSEUDO.map(function (t, i) {
      var span = document.createElement("span");
      span.textContent = t;
      span.style.cssText = "display:block;border-radius:5px;padding:0 4px;margin:0 -4px;" +
        "transition:background .15s ease";
      pre.appendChild(span);
      if (i < PSEUDO.length - 1) pre.appendChild(document.createTextNode("\n"));
      return span;
    });
    pseudoBox.appendChild(pre);
    top.appendChild(pseudoBox);
    wrap.appendChild(top);

    /* ---- key / π table ---- */
    var tableBox = document.createElement("div");
    tableBox.style.cssText = "margin-top:14px;overflow-x:auto;background:" + C.surface +
      ";border:1px solid " + C.line + ";border-radius:12px;padding:8px 6px";
    var table = document.createElement("table");
    table.setAttribute("dir", "ltr");
    table.style.cssText = "border-collapse:separate;border-spacing:0;width:100%;" +
      "min-width:440px;font-size:.82rem;text-align:center";
    var rowsSpec = [
      { label: "V", get: function (v) { return v; }, head: true },
      { label: "key", get: function (s, v) { return fmtKey(s.key[v]); } },
      { label: "π", get: function (s, v) { return s.pi[v] == null ? "–" : s.pi[v]; } }
    ];
    var cellEls = { key: {}, pi: {}, head: {} };
    rowsSpec.forEach(function (spec, ri) {
      var tr = document.createElement("tr");
      var th = document.createElement("th");
      th.textContent = spec.label;
      th.style.cssText = "padding:5px 8px;color:" + C.inkSoft + ";font-weight:700;" +
        "font-size:.78rem;position:sticky;left:0;background:" + C.surface +
        ";border-bottom:1px solid " + C.line;
      tr.appendChild(th);
      VERTS.forEach(function (v) {
        var cell = document.createElement(spec.head ? "th" : "td");
        cell.style.cssText = "padding:5px 0;min-width:32px;font-weight:" +
          (spec.head ? "800" : "700") + ";font-family:" +
          (spec.head ? "inherit" : "monospace") +
          ";border-bottom:1px solid " + C.line + ";transition:background .15s ease";
        tr.appendChild(cell);
        if (spec.head) { cellEls.head[v] = cell; cell.textContent = v; }
        else if (ri === 1) cellEls.key[v] = cell;
        else cellEls.pi[v] = cell;
      });
      table.appendChild(tr);
    });
    tableBox.appendChild(table);
    wrap.appendChild(tableBox);

    /* ---- queue Q ---- */
    var qBox = document.createElement("div");
    qBox.style.cssText = "margin-top:12px;background:" + C.surface2 +
      ";border:1px solid " + C.line + ";border-radius:12px;padding:9px 12px;" +
      "display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;min-height:2.6rem";
    var qLabel = document.createElement("span");
    qLabel.style.cssText = "font-weight:700;color:" + C.ink + ";font-size:.85rem";
    qLabel.innerHTML = ltr("Q") + " (min-priority queue):";
    qBox.appendChild(qLabel);
    var qChips = document.createElement("span");
    qChips.style.cssText = "display:flex;gap:.35rem;flex-wrap:wrap;align-items:center";
    qBox.appendChild(qChips);
    wrap.appendChild(qBox);

    /* ---- explanation panel ---- */
    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.cssText = "margin-top:12px;background:" + C.surface +
      ";border:1px solid " + C.line + ";border-radius:12px;padding:12px 14px;" +
      "min-height:96px;color:" + C.ink + ";line-height:1.65;font-size:.9rem";
    wrap.appendChild(panel);

    /* ---- controls ---- */
    var controls = document.createElement("div");
    controls.className = "viz-controls";
    function mkBtn(label, fn, primary) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn" + (primary ? " primary" : "");
      b.innerHTML = label;
      b.addEventListener("click", fn);
      return b;
    }
    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); go(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); go(idx + 1); }, true);
    var btnPlay = mkBtn("▶ הפעל", function () { toggleAuto(); });
    var btnReset = mkBtn("↺ איפוס", function () { stopAuto(); go(0); });
    var counter = document.createElement("span");
    counter.style.cssText = "margin-inline-start:auto;font-size:.82rem;color:" +
      C.inkSoft + ";font-weight:600";
    controls.appendChild(btnPrev);
    controls.appendChild(btnNext);
    controls.appendChild(btnPlay);
    controls.appendChild(btnReset);
    controls.appendChild(counter);
    wrap.appendChild(controls);

    mount.appendChild(wrap);

    /* ---------------------------------------------------------------
       apply a step's state to the whole scene
       --------------------------------------------------------------- */
    function pulse(node) {
      if (reducedMotion() || !node.animate) return;
      node.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }],
        { duration: 380, easing: "ease-out" }
      );
    }

    function applyState(s) {
      var relaxMap = {};
      s.relaxEdges.forEach(function (r) { relaxMap[r.id] = r.improves; });
      var treeSet = {};
      s.treeEdgeIds.forEach(function (id) { treeSet[id] = true; });

      /* edges */
      for (var id in graph.edgeEls) {
        var ge = graph.edgeEls[id];
        var col = C.line, wdt = 3, chipCol = C.inkSoft, chipStroke = C.line;
        if (id in relaxMap) {
          col = C.mustard;
          wdt = relaxMap[id] ? 4.5 : 3;
          chipCol = C.mustard; chipStroke = C.mustard;
          ge.line.setAttribute("stroke-dasharray", relaxMap[id] ? "none" : "5 4");
        } else {
          ge.line.setAttribute("stroke-dasharray", "none");
        }
        if (treeSet[id]) { col = C.sage; wdt = 5; chipCol = C.sage; chipStroke = C.sage; }
        ge.line.setAttribute("stroke", col);
        ge.line.setAttribute("stroke-width", wdt);
        ge.chip.setAttribute("fill", chipCol);
        ge.chipBg.setAttribute("stroke", chipStroke);
      }

      /* nodes */
      var updatedSet = {};
      s.updated.forEach(function (v) { updatedSet[v] = true; });
      VERTS.forEach(function (v) {
        var ne = graph.nodeEls[v];
        var fill = C.surface, stroke = C.line, sw = 2.5, letterCol = C.ink;
        if (s.inTree[v]) { fill = SAGE_TINT; stroke = C.sage; sw = 2.5; }
        if (updatedSet[v]) { fill = MUST_TINT; stroke = C.mustard; sw = 3; }
        if (s.u === v) { fill = CLAY_TINT; stroke = C.clay; sw = 3.5; letterCol = C.clay; }
        ne.circle.setAttribute("fill", fill);
        ne.circle.setAttribute("stroke", stroke);
        ne.circle.setAttribute("stroke-width", sw);
        ne.letter.setAttribute("fill", letterCol);
        /* key chip */
        var kv = s.key[v];
        ne.keyTx.textContent = fmtKey(kv);
        var kc = kv === Infinity ? C.inkSoft : (s.inTree[v] ? C.sage : C.ink);
        var kbg = C.surface2, kst = C.line;
        if (updatedSet[v]) { kc = "#8a6d1f"; kbg = MUST_TINT; kst = C.mustard; }
        ne.keyTx.setAttribute("fill", kc);
        ne.keyBg.setAttribute("fill", kbg);
        ne.keyBg.setAttribute("stroke", kst);
      });

      /* pseudocode highlight */
      var active = {};
      s.activeLines.forEach(function (n) { active[n] = true; });
      lineEls.forEach(function (span, i) {
        var on = active[i + 1];
        span.style.background = on ? CLAY_TINT : "transparent";
        span.style.color = on ? C.clay : C.ink;
        span.style.fontWeight = on ? "700" : "400";
      });

      /* key / π table */
      VERTS.forEach(function (v) {
        cellEls.key[v].textContent = fmtKey(s.key[v]);
        cellEls.pi[v].textContent = s.pi[v] == null ? "–" : s.pi[v];
        var bg = "transparent", kcol = C.ink, hbg = "transparent", hcol = C.ink;
        if (s.inTree[v]) { hbg = SAGE_TINT; hcol = C.sage; }
        if (updatedSet[v]) { bg = MUST_TINT; kcol = "#8a6d1f"; }
        if (s.u === v) { hbg = CLAY_TINT; hcol = C.clay; }
        cellEls.head[v].style.background = hbg;
        cellEls.head[v].style.color = hcol;
        cellEls.key[v].style.background = bg;
        cellEls.key[v].style.color = s.key[v] === Infinity ? C.inkSoft : kcol;
        cellEls.pi[v].style.background = bg;
        cellEls.pi[v].style.color = kcol;
      });

      /* queue chips (in-Q vertices, sorted by key asc) */
      qChips.innerHTML = "";
      var inQ = VERTS.filter(function (v) { return s.inQueue[v]; })
        .sort(function (a, b) {
          if (s.key[a] !== s.key[b]) return s.key[a] - s.key[b];
          return a < b ? -1 : 1;
        });
      if (!inQ.length) {
        var empty = document.createElement("span");
        empty.textContent = "∅ (ריק)";
        empty.style.cssText = "font-family:monospace;color:" + C.sage + ";font-weight:700";
        qChips.appendChild(empty);
      } else {
        var minKey = s.key[inQ[0]];
        inQ.forEach(function (v, i) {
          var isMin = s.key[v] === minKey && i === 0;
          var chip = document.createElement("span");
          chip.setAttribute("dir", "ltr");
          chip.textContent = v + ":" + fmtKey(s.key[v]);
          chip.style.cssText = "font-family:monospace;font-size:.8rem;font-weight:700;" +
            "padding:.12rem .5rem;border-radius:99px;border:1.5px solid " +
            (isMin ? C.blue : C.line) + ";background:" +
            (isMin ? "#e3ebf0" : C.surface) + ";color:" +
            (isMin ? C.blue : (s.key[v] === Infinity ? C.inkSoft : C.ink));
          if (isMin) chip.title = "המינימום — ייחלץ בשלב הבא";
          qChips.appendChild(chip);
        });
      }
    }

    /* ---------------------------------------------------------------
       navigation
       --------------------------------------------------------------- */
    function renderPanel(s) {
      var badgeCol = s.phase === "extract" ? C.clay
        : s.phase === "relax" ? C.mustard
          : s.phase === "done" ? C.sage : C.blue;
      panel.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px">' +
          '<span style="background:' + badgeCol + ';color:#fff;font-weight:700;font-size:.72rem;' +
            'padding:2px 10px;border-radius:99px">' + s.title + '</span>' +
          '<span style="font-size:.8rem;color:' + C.inkSoft + '">משקל העץ עד כה: ' +
            '<b style="color:' + C.sage + '" dir="ltr">' + s.weightSum + '</b></span>' +
        '</div>' +
        '<div>' + s.body + '</div>';
    }

    function go(n) {
      idx = Math.max(0, Math.min(STEPS.length - 1, n));
      var s = STEPS[idx];
      applyState(s);
      renderPanel(s);
      /* pulse the chosen tree edge's child + the extracted node */
      if (s.chosenEdgeId && graph.edgeEls[s.chosenEdgeId]) {
        if (s.u && graph.nodeEls[s.u]) pulse(graph.nodeEls[s.u].g);
      } else if (s.phase === "extract" && s.u && graph.nodeEls[s.u]) {
        pulse(graph.nodeEls[s.u].g);
      }
      counter.textContent = "שלב " + (idx + 1) + " / " + STEPS.length;
      btnPrev.disabled = idx === 0;
      btnNext.disabled = idx === STEPS.length - 1;
    }

    /* ---------------------------------------------------------------
       autoplay
       --------------------------------------------------------------- */
    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      if (idx >= STEPS.length - 1) go(0);
      btnPlay.innerHTML = "⏸ השהה";
      btnPlay.classList.add("primary");
      autoTimer = setInterval(function () {
        if (idx >= STEPS.length - 1) { stopAuto(); return; }
        go(idx + 1);
      }, reducedMotion() ? 1900 : 1500);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      btnPlay.innerHTML = "▶ הפעל";
      btnPlay.classList.remove("primary");
    }

    /* keyboard: RTL-aware (Right = prev, Left = next) */
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { stopAuto(); go(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { stopAuto(); go(idx + 1); e.preventDefault(); }
      else if (e.key === "Home") { stopAuto(); go(0); e.preventDefault(); }
      else if (e.key === "End") { stopAuto(); go(STEPS.length - 1); e.preventDefault(); }
      else if (e.key === " " || e.key === "Enter") {
        if (e.target === wrap) { toggleAuto(); e.preventDefault(); }
      }
    });

    /* initial paint */
    go(0);
  }

  /* =====================================================================
     boot — mount all instances; never throw; graceful if absent.
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
