/* =====================================================================
   floyd-warshall-matrix.js  —  Module 08 "תכנון דינמי ו-Floyd-Warshall (APSP)"
   Grounded in _notes/07-apsp-dp.md:

   THE EXAMPLE  —  "דוגמה שלנו" (labelled as such per CONTRACT §5):
     The notes explicitly flag a gap — "אין בקבצים trace מספרי מלא של הרצת
     Floyd-Warshall על גרף קונקרטי" (07-apsp-dp.md §פערים). The lecture teaches
     only the general correctness proof (induction on k) and the cost table.
     Per the contract, when the notes lack a concrete numeric example we use the
     smallest clear one and mark it "דוגמה שלנו". We use the canonical
     directed weighted digraph on 5 vertices (with negative edges, no negative
     cycle) so students recognise it from the standard treatment / the course
     video (Abdul Bari, brief videos[0]) which fills the matrix per k exactly
     as here.

       Vertices V = {1,2,3,4,5}.  Weighted digraph  w: E → ℝ.
       Edges (directed):
         1→2 = 3 · 1→3 = 8 · 1→5 = −4
         2→4 = 1 · 2→5 = 7
         3→2 = 4
         4→1 = 2 · 4→3 = −5
         5→4 = 6
       Final matrix D⁵ = δ(i,j) (all-pairs shortest-path weights); every
       diagonal entry d[i,i] = 0 ⟹ no negative cycle — tying directly to the
       course homework (07-apsp-dp.md שאלה 1: מעגל שלילי ⟺ ∃i d_{i,i}^{|V|}<0).

   PSEUDOCODE:  the 7-line Floyd-Warshall body is itself a documented gap in the
   notes (they reference "line 2 / line 3 / line 6" of the cost table but never
   print the code). We reconstruct the standard form so the referenced lines
   match exactly: line 2 = init d⁰[i,j]=w(i,j); line 3 = the for-k loop whose
   k-th iteration the proof discusses; line 6 = d[i,j] ← min(...). Cost Θ(|V|³).

   Live bookkeeping shown (the pedagogy, CONTRACT §5): the running D⁽ᵏ⁾ matrix,
   the pivot row k / column k that every improvement routes through, the cells
   that improve at each k (with the exact d[i,k]+d[k,j] arithmetic), the
   predecessor matrix π for path reconstruction, and the active pseudocode line.

   Colour code (design tokens, CONTRACT §2):
     blue  = pivot row k / column k (the "through-k" axis)
     mustard = a cell that just improved (relaxed) at this k
     clay  = the current intermediate vertex k / negative weights
     sage  = final answer / "no negative cycle" conclusion.

   Self-contained IIFE. Hand-authored SVG + DOM. No external deps.
   Works over http(s):// and file://. RTL Hebrew prose, LTR technical ids.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "floyd-warshall-matrix";
  var SVGNS = "http://www.w3.org/2000/svg";
  var INF = Infinity;
  var INF_S = "∞";

  /* --- design palette (hardcoded per CONTRACT §2) --- */
  var C = {
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",    /* pivot row/col (through-k axis) */
    clay: "#BE7C5E",    /* intermediate vertex k / negative weights */
    sage: "#7C9885",    /* final answer / conclusion */
    mustard: "#C9A24B"  /* improved cell (relax) */
  };
  var BLUE_TINT = "#E3EBF0";
  var MUST_TINT = "#F3E9CF";
  var CLAY_TINT = "#F1E0D6";
  var SAGE_TINT = "#E4ECE5";
  var MUST_INK = "#8a6d1f";

  /* ---------------- graph model (our example) ---------------- */
  var N = 5;
  var VLABEL = ["1", "2", "3", "4", "5"];
  /* weight matrix W[i][j] (0-indexed), diagonal 0, INF where no direct edge */
  var W = [
    [0, 3, 8, INF, -4],
    [INF, 0, INF, 1, 7],
    [INF, 4, 0, INF, INF],
    [2, INF, -5, 0, INF],
    [INF, INF, INF, 6, 0]
  ];
  /* directed edge list for the graph drawing: [from,to,weight] (0-indexed) */
  var EDGES = [
    [0, 1, 3], [0, 2, 8], [0, 4, -4],
    [1, 3, 1], [1, 4, 7],
    [2, 1, 4],
    [3, 0, 2], [3, 2, -5],
    [4, 3, 6]
  ];
  /* node positions in the graph viewBox */
  var POS = [
    [80, 78],    /* 1 */
    [410, 78],   /* 2 */
    [410, 262],  /* 3 */
    [80, 262],   /* 4 */
    [250, 210]   /* 5 */
  ];

  /* ---------------- small helpers ---------------- */
  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function ltr(s) { return '<span dir="ltr">' + s + "</span>"; }
  function fmt(v) { return v === INF ? INF_S : String(v); }
  var SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵" };
  function sup(n) { return String(n).split("").map(function (d) { return SUP[d] || d; }).join(""); }
  function copyMat(m) { return m.map(function (r) { return r.slice(); }); }
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
     STEP ENGINE — actually run Floyd-Warshall, one snapshot per k.
     Snapshot list: init(D⁰) → after k=1 … after k=5 → done.
     This IS the algorithm, so the display can never drift from semantics.
     ===================================================================== */
  function buildSteps() {
    var D = copyMat(W);
    /* predecessor matrix π⁰: π[i][j] = i (label) if a direct edge exists, else NIL */
    var Pi = [];
    for (var i = 0; i < N; i++) {
      Pi.push([]);
      for (var j = 0; j < N; j++) {
        Pi[i][j] = (i !== j && W[i][j] !== INF) ? (i + 1) : null;
      }
    }

    var steps = [];

    /* ---- init snapshot (lines 1-2) ---- */
    steps.push({
      phase: "init", kLabel: 0, pivot: null, activeLines: [1, 2],
      D: copyMat(D), Pi: copyMat(Pi), improved: [],
      title: "אתחול — D" + sup(0),
      body: "מאתחלים את הטבלה: " + ltr("d⁰[i,j] = w(i,j)") +
        " — משקל הקשת הישירה מ-" + ltr("i") + " ל-" + ltr("j") +
        " (line 2). האלכסון " + ltr("d[i,i]=0") + ", ותא ללא קשת ישירה מקבל " +
        ltr(INF_S) + ". קבוצת קודקודי-הביניים המותרים כרגע היא " + ltr("{ }") +
        " (ריקה) — עדיין אין מסלולים העוברים דרך קודקוד ביניים כלשהו."
    });

    /* ---- main loop: line 3 (for k), lines 4-6 (for i, for j, min) ---- */
    for (var k = 0; k < N; k++) {
      var prev = copyMat(D);
      var prevPi = copyMat(Pi);
      var improved = [];
      for (var a = 0; a < N; a++) {
        for (var b = 0; b < N; b++) {
          var through = prev[a][k] + prev[k][b]; /* INF-safe: INF+x = INF */
          if (through < prev[a][b]) {
            D[a][b] = through;
            Pi[a][b] = prevPi[k][b];
            improved.push({
              i: a, j: b, old: prev[a][b],
              viaA: prev[a][k], viaB: prev[k][b], val: through
            });
          }
        }
      }
      var kk = k + 1;
      var lines = improved.map(function (m) {
        return ltr("d[" + (m.i + 1) + "," + (m.j + 1) + "]") + ": min(" +
          fmt(m.old) + ", " + ltr("d[" + (m.i + 1) + "," + kk + "]+d[" + kk + "," + (m.j + 1) + "]") +
          " = " + fmt(m.viaA) + "+" + fmt(m.viaB) + " = " + m.val + ") ⟹ " +
          '<b style="color:' + MUST_INK + '">' + m.val + "</b>" +
          " &nbsp;<span style=\"color:" + C.inkSoft + "\">(מסלול קצר יותר " +
          ltr((m.i + 1) + "⤳" + kk + "⤳" + (m.j + 1)) + ")</span>";
      });
      var intro = "איטרציית הלולאה החיצונית עם קודקוד-ביניים " +
        '<b style="color:' + C.clay + '">' + ltr("k=" + kk) + "</b>" +
        " (line 3). כעת מותר להשתמש בקודקודי-ביניים מהקבוצה " +
        ltr("{1.." + kk + "}") + ". לכל זוג " + ltr("(i,j)") + " בודקים אם " +
        ltr("d[i," + kk + "] + d[" + kk + ",j]") + " קצר יותר מ-" + ltr("d[i,j]") +
        " (line 6). <b>השורה " + ltr("k=" + kk) + " והעמודה " + ltr("k=" + kk) +
        "</b> (הצבועות) הן ה'ציר' — כל שיפור עובר דרכן.";
      var body = improved.length
        ? intro + "<br><br><b style=\"color:" + C.mustard + "\">תאים שהשתפרו:</b><br>" + lines.join("<br>")
        : intro + "<br><br>באיטרציה זו <b>אף תא לא השתפר</b> — אף מסלול חדש דרך " +
          ltr((kk)) + " אינו קצר יותר מהקיים.";

      steps.push({
        phase: "kstep", kLabel: kk, pivot: k, activeLines: [3, 4, 5, 6],
        D: copyMat(D), Pi: copyMat(Pi), improved: improved,
        title: "k = " + kk + " — D" + sup(kk),
        body: body
      });
    }

    /* ---- done (line 7) ---- */
    steps.push({
      phase: "done", kLabel: N, pivot: null, activeLines: [7],
      D: copyMat(D), Pi: copyMat(Pi), improved: [],
      title: "סיום — D" + sup(N) + " = δ",
      body: "הלולאה הסתיימה. כעת " + ltr("D" + sup(N) + "[i,j] = δ(i,j)") +
        " — משקל המסלול הקצר ביותר בין כל זוג קודקודים (line 7). " +
        "כל האלכסון מקיים " + ltr("d[i,i]=0") + ", ולכן לפי " +
        "<b style=\"color:" + C.sage + "\">תרגיל הבית</b> אין בגרף מעגל שלילי — " +
        "מעגל שלילי היה גורם ל-" + ltr("d[i,i] < 0") + " באחד האלכסונים."
    });

    return steps;
  }

  /* =====================================================================
     GRAPH scene — hand-authored directed weighted digraph.
     ===================================================================== */
  var GW = 500, GH = 330, R = 21;

  function trim(from, to, by) {
    var dx = to[0] - from[0], dy = to[1] - from[1];
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    return [from[0] + dx / len * by, from[1] + dy / len * by];
  }

  function buildGraph() {
    var svg = el("svg", {
      viewBox: "0 0 " + GW + " " + GH, width: "100%",
      role: "img", direction: "ltr",
      "aria-label": "גרף ממושקל מכוון עם חמישה קודקודים — דוגמת ההרצה של Floyd-Warshall"
    });
    svg.style.display = "block";
    svg.style.maxWidth = GW + "px";
    svg.style.margin = "0 auto";

    var defs = el("defs");
    /* one arrowhead per relevant colour */
    [["fw-ar", C.inkSoft], ["fw-ar-neg", C.clay]].forEach(function (p) {
      var m = el("marker", {
        id: p[0], viewBox: "0 0 10 10", refX: "9", refY: "5",
        markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse"
      });
      m.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", fill: p[1] }));
      defs.appendChild(m);
    });
    svg.appendChild(defs);

    /* edges (under nodes) */
    EDGES.forEach(function (e, idx) {
      var neg = e[2] < 0;
      var A = POS[e[0]], B = POS[e[1]];
      var s = trim(A, B, R + 2), t = trim(B, A, R + 6);
      var line = el("line", {
        x1: s[0], y1: s[1], x2: t[0], y2: t[1],
        stroke: neg ? C.clay : C.inkSoft, "stroke-width": neg ? 2.4 : 1.8,
        "stroke-linecap": "round",
        "marker-end": "url(#" + (neg ? "fw-ar-neg" : "fw-ar") + ")",
        opacity: neg ? 0.9 : 0.7
      });
      svg.appendChild(line);
      /* weight chip, nudged perpendicular off the edge to avoid overlaps */
      var mx = (s[0] + t[0]) / 2, my = (s[1] + t[1]) / 2;
      var dx = t[0] - s[0], dy = t[1] - s[1];
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var off = (idx % 2 === 0) ? 12 : -12;
      var cx = mx + (-dy / len) * off, cy = my + (dx / len) * off;
      var bg = el("rect", {
        x: cx - 12, y: cy - 11, width: 24, height: 20, rx: 6,
        fill: C.surface, stroke: neg ? C.clay : C.line, "stroke-width": 1
      });
      var tx = txt(cx, cy + 4, String(e[2]), {
        "text-anchor": "middle", "font-size": 12, "font-weight": 700,
        fill: neg ? C.clay : C.inkSoft
      });
      svg.appendChild(bg); svg.appendChild(tx);
    });

    /* nodes */
    var nodeEls = [];
    for (var v = 0; v < N; v++) {
      var p = POS[v];
      var g = el("g", {});
      var circle = el("circle", {
        cx: p[0], cy: p[1], r: R,
        fill: C.surface, stroke: C.line, "stroke-width": 2.5
      });
      var letter = txt(p[0], p[1] + 6, VLABEL[v], {
        "text-anchor": "middle", "font-size": 17, "font-weight": 800, fill: C.ink
      });
      g.appendChild(circle); g.appendChild(letter);
      svg.appendChild(g);
      nodeEls.push({ g: g, circle: circle, letter: letter });
    }
    return { svg: svg, nodeEls: nodeEls };
  }

  /* =====================================================================
     Render one mount
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-fw-ready") === "1") return;
    mount.setAttribute("data-fw-ready", "1");
    mount.innerHTML = "";

    var STEPS = buildSteps();
    var idx = 0, autoTimer = null;
    var showPi = false;

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");
    wrap.style.outline = "none";

    /* ---- caption ---- */
    var cap = document.createElement("div");
    cap.style.cssText = "display:flex;flex-wrap:wrap;gap:.5rem;align-items:baseline;" +
      "margin-bottom:.7rem;color:" + C.inkSoft + ";font-size:.86rem";
    cap.innerHTML =
      '<b style="color:' + C.ink + ';font-size:.98rem">Floyd-Warshall צעד-אחר-צעד</b>' +
      '<span>גרף ממושקל מכוון עם 5 קודקודים ' +
      '<span style="color:' + C.clay + ';font-weight:600">(דוגמה שלנו)</span> — ' +
      'המטריצה ' + ltr("D⁽ᵏ⁾") + ' מתמלאת לפי קודקוד-הביניים ' + ltr("k") + '.</span>';
    wrap.appendChild(cap);

    /* ---- top row: graph + pseudocode ---- */
    var top = document.createElement("div");
    top.style.cssText = "display:flex;flex-wrap:wrap;gap:14px;align-items:stretch";

    var graphBox = document.createElement("div");
    graphBox.style.cssText = "flex:1 1 320px;min-width:280px;background:" + C.surface +
      ";border:1px solid " + C.line + ";border-radius:12px;padding:8px 6px";
    var graph = buildGraph();
    graphBox.appendChild(graph.svg);
    var glegend = document.createElement("div");
    glegend.style.cssText = "display:flex;flex-wrap:wrap;gap:.4rem 1rem;justify-content:center;" +
      "margin-top:2px;font-size:.72rem;color:" + C.inkSoft;
    glegend.innerHTML =
      '<span style="display:inline-flex;align-items:center;gap:.3rem">' +
        '<span style="width:11px;height:11px;border-radius:50%;background:' + CLAY_TINT +
        ';border:2px solid ' + C.clay + ';display:inline-block"></span>קודקוד-הביניים ' + ltr("k") + '</span>' +
      '<span style="display:inline-flex;align-items:center;gap:.3rem">' +
        '<span style="width:14px;height:0;border-top:2.4px solid ' + C.clay +
        ';display:inline-block"></span>קשת שלילית</span>';
    graphBox.appendChild(glegend);
    top.appendChild(graphBox);

    /* pseudocode box */
    var pseudoBox = document.createElement("div");
    pseudoBox.style.cssText = "flex:1 1 260px;min-width:240px;background:" + C.surface2 +
      ";border:1px solid " + C.line + ";border-radius:12px;padding:10px 12px";
    var pseudoTitle = document.createElement("div");
    pseudoTitle.style.cssText = "font-size:.8rem;font-weight:700;color:" + C.inkSoft +
      ";margin-bottom:6px;direction:rtl";
    pseudoTitle.innerHTML = "פסאודו-קוד " + ltr("Floyd-Warshall(W)");
    pseudoBox.appendChild(pseudoTitle);

    var PSEUDO = [
      "1.  n ← rows[W]",
      "2.  D ← W               // d⁰[i,j] = w(i,j)",
      "3.  for k ← 1 to n",
      "4.      for i ← 1 to n",
      "5.          for j ← 1 to n",
      "6.              d[i,j] ← min( d[i,j],",
      "                     d[i,k] + d[k,j] )",
      "7.  return D"
    ];
    /* map display-row → logical line number (row 6 wraps onto two rows) */
    var ROW_LINE = [1, 2, 3, 4, 5, 6, 6, 7];
    var pre = document.createElement("pre");
    pre.setAttribute("dir", "ltr");
    pre.style.cssText = "margin:0;font-size:.75rem;line-height:1.5;white-space:pre;" +
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
    var costNote = document.createElement("div");
    costNote.style.cssText = "margin-top:8px;font-size:.72rem;color:" + C.inkSoft + ";direction:rtl";
    costNote.innerHTML = "עלות: שלוש לולאות מקוננות ⟹ " +
      '<b dir="ltr" style="color:' + C.clay + '">Θ(|V|³)</b>' +
      " (מול " + ltr("O(|V|⁴)") + " בפתרון הנאיבי).";
    pseudoBox.appendChild(costNote);
    top.appendChild(pseudoBox);
    wrap.appendChild(top);

    /* ---- the D matrix ---- */
    var matWrap = document.createElement("div");
    matWrap.style.cssText = "margin-top:14px;display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start";

    var dBox = document.createElement("div");
    dBox.style.cssText = "flex:1 1 320px;min-width:280px;overflow-x:auto;background:" + C.surface +
      ";border:1px solid " + C.line + ";border-radius:12px;padding:10px";
    var dTitle = document.createElement("div");
    dTitle.style.cssText = "font-size:.82rem;font-weight:700;color:" + C.ink +
      ";margin-bottom:8px;direction:rtl";
    dBox.appendChild(dTitle);
    var dMat = buildMatrix("D");
    dBox.appendChild(dMat.table);
    matWrap.appendChild(dBox);

    /* ---- the π matrix (toggled) ---- */
    var piBox = document.createElement("div");
    piBox.style.cssText = "flex:1 1 260px;min-width:240px;overflow-x:auto;background:" + C.surface2 +
      ";border:1px solid " + C.line + ";border-radius:12px;padding:10px;display:none";
    var piTitle = document.createElement("div");
    piTitle.style.cssText = "font-size:.82rem;font-weight:700;color:" + C.ink +
      ";margin-bottom:8px;direction:rtl";
    piTitle.innerHTML = "מטריצת קודמים " + ltr("π") + " — לשחזור מסלולים";
    piBox.appendChild(piTitle);
    var piMat = buildMatrix("π");
    piBox.appendChild(piMat.table);
    matWrap.appendChild(piBox);
    wrap.appendChild(matWrap);

    /* ---- path reconstruction row ---- */
    var pathRow = document.createElement("div");
    pathRow.style.cssText = "margin-top:12px;background:" + C.surface +
      ";border:1px solid " + C.line + ";border-radius:12px;padding:10px 12px;" +
      "display:flex;align-items:center;gap:.55rem;flex-wrap:wrap;font-size:.85rem;color:" + C.ink;
    function mkSelect() {
      var s = document.createElement("select");
      s.style.cssText = "font-family:monospace;font-weight:700;padding:.15rem .4rem;" +
        "border:1.5px solid " + C.line + ";border-radius:7px;background:" + C.surface +
        ";color:" + C.ink;
      for (var v = 0; v < N; v++) {
        var o = document.createElement("option");
        o.value = String(v); o.textContent = VLABEL[v];
        s.appendChild(o);
      }
      return s;
    }
    var selFrom = mkSelect(), selTo = mkSelect();
    selFrom.value = "2"; selTo.value = "3"; /* 3 → 4, a path built through k */
    var pathLbl1 = document.createElement("span");
    pathLbl1.innerHTML = "שחזור מסלול קצר ביותר מ-";
    var pathLbl2 = document.createElement("span");
    pathLbl2.textContent = " ל-";
    var pathOut = document.createElement("span");
    pathOut.style.cssText = "font-family:monospace;font-weight:700;color:" + C.sage +
      ";direction:ltr;margin-inline-start:.3rem";
    pathRow.appendChild(pathLbl1);
    pathRow.appendChild(selFrom);
    pathRow.appendChild(pathLbl2);
    pathRow.appendChild(selTo);
    pathRow.appendChild(document.createTextNode(" : "));
    pathRow.appendChild(pathOut);
    wrap.appendChild(pathRow);

    /* ---- explanation panel ---- */
    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.cssText = "margin-top:12px;background:" + C.surface +
      ";border:1px solid " + C.line + ";border-radius:12px;padding:12px 14px;" +
      "min-height:110px;color:" + C.ink + ";line-height:1.65;font-size:.9rem";
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

    /* π toggle */
    var piToggleRow = document.createElement("div");
    piToggleRow.style.cssText = "margin-top:8px;font-size:.82rem;color:" + C.inkSoft;
    var piCheck = document.createElement("label");
    piCheck.style.cssText = "display:inline-flex;align-items:center;gap:.4rem;cursor:pointer";
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.style.accentColor = C.blue;
    var cbTxt = document.createElement("span");
    cbTxt.innerHTML = "הצג מטריצת " + ltr("π") + " (שחזור מסלולים)";
    piCheck.appendChild(cb); piCheck.appendChild(cbTxt);
    piToggleRow.appendChild(piCheck);
    wrap.appendChild(piToggleRow);
    cb.addEventListener("change", function () {
      showPi = cb.checked;
      piBox.style.display = showPi ? "" : "none";
    });

    /* live-region status (visually hidden) */
    var status = document.createElement("p");
    status.setAttribute("aria-live", "polite");
    status.style.cssText =
      "position:absolute;width:1px;height:1px;margin:-1px;padding:0;" +
      "overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;";
    wrap.appendChild(status);

    mount.appendChild(wrap);

    /* ---------------------------------------------------------------
       matrix builder — a table with row/col headers 1..N
       --------------------------------------------------------------- */
    function buildMatrix(corner) {
      var table = document.createElement("table");
      table.setAttribute("dir", "ltr");
      table.style.cssText = "border-collapse:separate;border-spacing:3px;" +
        "font-size:.86rem;text-align:center;margin:0 auto";
      var cells = [];       /* cells[i][j] */
      var colHead = [], rowHead = [];

      /* header row */
      var trh = document.createElement("tr");
      var cc = document.createElement("th");
      cc.style.cssText = "width:34px;height:30px;color:" + C.inkSoft +
        ";font-size:.74rem;font-weight:800";
      cc.textContent = corner;
      trh.appendChild(cc);
      for (var j = 0; j < N; j++) {
        var th = document.createElement("th");
        th.textContent = "j=" + VLABEL[j];
        th.style.cssText = "width:44px;height:30px;font-size:.72rem;font-weight:800;" +
          "color:" + C.inkSoft + ";border-radius:6px;transition:background .15s,color .15s";
        trh.appendChild(th);
        colHead.push(th);
      }
      table.appendChild(trh);

      for (var i = 0; i < N; i++) {
        var tr = document.createElement("tr");
        var rh = document.createElement("th");
        rh.textContent = "i=" + VLABEL[i];
        rh.style.cssText = "width:34px;height:38px;font-size:.72rem;font-weight:800;" +
          "color:" + C.inkSoft + ";border-radius:6px;transition:background .15s,color .15s";
        tr.appendChild(rh);
        rowHead.push(rh);
        cells.push([]);
        for (var j2 = 0; j2 < N; j2++) {
          var td = document.createElement("td");
          td.style.cssText = "width:44px;height:38px;font-family:monospace;font-weight:700;" +
            "border-radius:7px;border:1px solid " + C.line + ";background:" + C.surface +
            ";transition:background .18s,color .18s,border-color .18s";
          tr.appendChild(td);
          cells[i].push(td);
        }
        table.appendChild(tr);
      }
      return { table: table, cells: cells, colHead: colHead, rowHead: rowHead };
    }

    /* ---------------------------------------------------------------
       path reconstruction from a π snapshot (CLRS PRINT-ALL-PAIRS-PATH)
       --------------------------------------------------------------- */
    function reconstruct(Pi, i, j) {
      if (i === j) return [i];
      var out = [];
      var guard = 0;
      function rec(a, b) {
        if (guard++ > 4 * N) return false;
        if (a === b) { out.push(a); return true; }
        if (Pi[a][b] == null) return false;
        if (!rec(a, Pi[a][b] - 1)) return false;
        out.push(b);
        return true;
      }
      return rec(i, j) ? out : null;
    }

    /* ---------------------------------------------------------------
       apply a step's state to the whole scene
       --------------------------------------------------------------- */
    function pulse(node) {
      if (reducedMotion() || !node.animate) return;
      node.animate(
        [{ opacity: 0.35 }, { opacity: 1 }],
        { duration: 420, easing: "ease-out" }
      );
    }

    function applyState(s) {
      var pv = s.pivot; /* 0-indexed intermediate vertex, or null */
      var impSet = {};
      s.improved.forEach(function (m) { impSet[m.i + "," + m.j] = true; });

      /* D matrix title */
      dTitle.innerHTML = "מטריצה " + ltr("D" + sup(s.kLabel)) +
        (s.pivot != null
          ? " &nbsp;·&nbsp; קודקודי-ביניים מותרים " + ltr("{1.." + s.kLabel + "}")
          : (s.phase === "done"
            ? " &nbsp;·&nbsp; <span style=\"color:" + C.sage + ";font-weight:700\">= δ(i,j) הסופי</span>"
            : " &nbsp;·&nbsp; קודקודי-ביניים " + ltr("{ }")));

      /* D cells */
      for (var i = 0; i < N; i++) {
        for (var j = 0; j < N; j++) {
          var td = dMat.cells[i][j];
          var val = s.D[i][j];
          td.textContent = fmt(val);
          var bg = C.surface, col = (val === INF ? C.inkSoft : (val < 0 ? C.clay : C.ink));
          var bd = C.line, fw = "700";
          if (i === j) { bg = C.surface2; }                 /* diagonal */
          if (pv != null && (i === pv || j === pv)) {        /* pivot axis */
            bg = BLUE_TINT; bd = C.blue;
          }
          if (pv != null && i === pv && j === pv) {          /* pivot cell */
            bg = "#d3e0e8"; bd = C.blue;
          }
          if (impSet[i + "," + j]) {                          /* improved */
            bg = MUST_TINT; bd = C.mustard; col = MUST_INK; fw = "800";
          }
          if (s.phase === "done") { bd = C.line; }
          td.style.background = bg;
          td.style.borderColor = bd;
          td.style.color = col;
          td.style.fontWeight = fw;
          if (impSet[i + "," + j]) pulse(td);
        }
      }
      /* D headers */
      for (var h = 0; h < N; h++) {
        var onCol = (pv != null && h === pv);
        var onRow = (pv != null && h === pv);
        dMat.colHead[h].style.background = onCol ? C.blue : "transparent";
        dMat.colHead[h].style.color = onCol ? "#fff" : C.inkSoft;
        dMat.rowHead[h].style.background = onRow ? C.blue : "transparent";
        dMat.rowHead[h].style.color = onRow ? "#fff" : C.inkSoft;
      }

      /* π matrix (only styled work if visible, but keep values fresh) */
      for (var pi = 0; pi < N; pi++) {
        for (var pj = 0; pj < N; pj++) {
          var pc = piMat.cells[pi][pj];
          var pval = s.Pi[pi][pj];
          pc.textContent = pval == null ? "–" : String(pval);
          var pbg = C.surface, pcol = pval == null ? C.inkSoft : C.ink, pbd = C.line;
          if (pi === pj) pbg = C.surface2;
          if (impSet[pi + "," + pj]) { pbg = MUST_TINT; pbd = C.mustard; pcol = MUST_INK; }
          pc.style.background = pbg;
          pc.style.borderColor = pbd;
          pc.style.color = pcol;
        }
      }
      for (var ph = 0; ph < N; ph++) {
        var onp = (pv != null && ph === pv);
        piMat.colHead[ph].style.background = onp ? C.blue : "transparent";
        piMat.colHead[ph].style.color = onp ? "#fff" : C.inkSoft;
        piMat.rowHead[ph].style.background = onp ? C.blue : "transparent";
        piMat.rowHead[ph].style.color = onp ? "#fff" : C.inkSoft;
      }

      /* graph: highlight the intermediate vertex k */
      for (var v = 0; v < N; v++) {
        var ne = graph.nodeEls[v];
        var isK = (pv != null && v === pv);
        ne.circle.setAttribute("fill", isK ? CLAY_TINT : C.surface);
        ne.circle.setAttribute("stroke", isK ? C.clay : C.line);
        ne.circle.setAttribute("stroke-width", isK ? 3.5 : 2.5);
        ne.letter.setAttribute("fill", isK ? C.clay : C.ink);
        if (isK) pulse(ne.g);
      }

      /* pseudocode highlight */
      var active = {};
      s.activeLines.forEach(function (n) { active[n] = true; });
      lineEls.forEach(function (span, ri) {
        var on = active[ROW_LINE[ri]];
        span.style.background = on ? CLAY_TINT : "transparent";
        span.style.color = on ? C.clay : C.ink;
        span.style.fontWeight = on ? "700" : "400";
      });

      updatePath(s);
    }

    /* path reconstruction display, using the CURRENT step's π + D */
    function updatePath(s) {
      var i = parseInt(selFrom.value, 10);
      var j = parseInt(selTo.value, 10);
      var d = s.D[i][j];
      if (d === INF) {
        pathOut.style.color = C.inkSoft;
        pathOut.textContent = "אין מסלול (∞)";
        return;
      }
      var p = reconstruct(s.Pi, i, j);
      pathOut.style.color = C.sage;
      if (!p) { pathOut.style.color = C.inkSoft; pathOut.textContent = "—"; return; }
      var labels = p.map(function (x) { return VLABEL[x]; });
      pathOut.textContent = labels.join(" → ") + "   (w = " + d + ")";
    }

    /* ---------------------------------------------------------------
       navigation
       --------------------------------------------------------------- */
    function renderPanel(s) {
      var badgeCol = s.phase === "kstep"
        ? (s.improved.length ? C.mustard : C.blue)
        : s.phase === "done" ? C.sage : C.blue;
      var sub = s.phase === "kstep"
        ? (s.improved.length + " תאים השתפרו")
        : (s.phase === "done" ? "מטריצת המרחקים הסופית" : "טבלה התחלתית");
      panel.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px">' +
          '<span style="background:' + badgeCol + ';color:#fff;font-weight:700;font-size:.72rem;' +
            'padding:2px 10px;border-radius:99px">' + s.title + '</span>' +
          '<span style="font-size:.8rem;color:' + C.inkSoft + '">' + sub + '</span>' +
        '</div>' +
        '<div>' + s.body + '</div>';
    }

    function go(n) {
      idx = Math.max(0, Math.min(STEPS.length - 1, n));
      var s = STEPS[idx];
      applyState(s);
      renderPanel(s);
      counter.textContent = "שלב " + (idx + 1) + " / " + STEPS.length;
      btnPrev.disabled = idx === 0;
      btnNext.disabled = idx === STEPS.length - 1;
      status.textContent = s.title + ". " + s.body.replace(/<[^>]+>/g, "");
    }

    /* recompute the path line when the dropdowns change */
    selFrom.addEventListener("change", function () { updatePath(STEPS[idx]); });
    selTo.addEventListener("change", function () { updatePath(STEPS[idx]); });

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
      }, reducedMotion() ? 2100 : 1700);
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
