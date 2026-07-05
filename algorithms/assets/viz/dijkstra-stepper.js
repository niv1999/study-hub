/* =====================================================================
   dijkstra-stepper.js  —  Module 06 "מסלולים קצרים ממקור יחיד — Dijkstra"
   Grounded in _notes/05-dijkstra.md + 05-shortest-paths-en.md:

   THE LECTURE EXAMPLE (exact, verbatim from _notes/05-dijkstra.md §"גרף
   הדוגמה הראשי", lec-dijkstra.pdf עמ' 4 ואילך — the full step-by-step trace):
     • Directed weighted graph, V = {S, A, B, C, T}, source s = S.
       Edges (exactly the 8 edges relaxed in the lecture trace):
         S→A = 1 · S→C = 2 · C→A = 1 · C→B = 1 · C→T = 6
         A→B = 2 · A→T = 8 · B→T = 1
       (Note: the exercise-1 variant adds S→B=2; the MAIN TRACE has no
        S→B — in iteration 1 only A and C are relaxed as neighbours of S,
        so we use the 8-edge trace graph to match the run exactly.)
     • Adjacency order matches the notes' relaxation order:
         Adj[S]=[A,C] · Adj[A]=[T,B] · Adj[C]=[A,B,T] · Adj[B]=[T]
     • The run reproduces the notes exactly:
         Extract order  S(0) → A(1) → C(2) → B(3) → T(4)
         Final d/π      S:0/NIL  A:1/S  C:2/S  B:3/A  T:4/B
         Shortest S→T   S→A→B→T, weight 4  (cheaper than A→T=8, C→T=6).
     • Pseudocode = DIJKSTRA(G, w, s) verbatim (עמ' 3), 8 numbered lines.
       The lecturer's slide misspells RELAX as "Relex" consistently — we
       preserve the typo (per _notes quirks §"טעות כתיב חוזרת").

   NEGATIVE-WEIGHT MODE (brief spec: "מצב 'משקל שלילי' שמראה איפה זה נשבר"):
     We flip C→A to −3 on the SAME graph. Now the true δ(A) = S→C→A = −1,
     but Dijkstra finalizes A at d=1 in iteration 2 (before C is processed).
     When C→A relaxes A down to −1 in iteration 3, A has already left Q and
     entered S, so the improvement is never propagated → B and T keep the
     stale values (d[B]=3, d[T]=4) instead of the true δ(B)=1, δ(T)=2.
     This is exactly the step the notes flag: 05-shortest-paths-en.md
     highlights "For (1) we use weights non-negativity!" — the inequality
     δ(s,y) ≤ δ(s,u) that fails once an edge can be negative.

   Live bookkeeping (the pedagogy): the dist[]/π[] table, the priority
   queue Q, the closed set S, the active pseudocode line, the extracted
   vertex, and the edge under relaxation — exactly what the lecturer tracks.

   Colour code (consistent with the site's spanning-tree family):
     clay  = extracted vertex u (Extract-Min) + active pseudocode line
     sage  = vertex closed in S (final) + shortest-path (π) tree edges
     mustard = relaxation / dist update · blue = current min in Q
     line  = ordinary edge.

   Self-contained IIFE. Hand-authored directed-SVG + DOM. No external deps.
   Cream design tokens hardcoded (CONTRACT §2). RTL Hebrew captions,
   English/LTR algorithm identifiers. Works over http(s):// and file://.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "dijkstra-stepper";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design palette (hardcoded per CONTRACT §2) --- */
  var C = {
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",   /* min-in-queue / info */
    clay: "#BE7C5E",   /* extracted vertex + active line (unit-3 accent) */
    sage: "#7C9885",   /* closed set S / shortest-path tree edges */
    mustard: "#C9A24B" /* relaxation / dist update */
  };
  var SAGE_TINT = "#E4ECE5";
  var CLAY_TINT = "#F1E0D6";
  var MUST_TINT = "#F3E9CF";
  var BLUE_TINT = "#E3EBF0";
  var WARN_RED = "#B5514B"; /* darker clay for the "it breaks" warning */

  /* ---------------- graph model (the lecture trace graph) ---------------- */
  var VERTS = ["S", "A", "B", "C", "T"];
  var SRC = "S";
  var BASE_EDGES = [
    ["S", "A", 1], ["S", "C", 2], ["C", "A", 1], ["C", "B", 1],
    ["C", "T", 6], ["A", "B", 2], ["A", "T", 8], ["B", "T", 1]
  ];
  /* adjacency order = the notes' relaxation order */
  var ADJ = { S: ["A", "C"], A: ["T", "B"], C: ["A", "B", "T"], B: ["T"], T: [] };

  /* directed SVG layout: S left → T right (source→target reading) */
  var POS = {
    S: [48, 160], A: [225, 62], C: [225, 258], B: [385, 100], T: [505, 175]
  };
  /* per-edge label nudges to avoid the chip sitting on a node/line */
  var LBL_NUDGE = { "A>T": [-6, -11], "C>A": [-17, 0], "C>B": [4, 6] };

  var INF = "∞";
  function fmt(v) {
    if (v === Infinity) return INF;
    if (v === -Infinity) return "−∞";
    return String(v);
  }
  function eid(u, v) { return u + ">" + v; }
  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function ltr(s) { return '<span dir="ltr">' + s + "</span>"; }
  function assign(t, s) { for (var k in s) if (s.hasOwnProperty(k)) t[k] = s[k]; return t; }

  /* build a weight map W[u][v] for a mode (neg flips C→A to −3) */
  function buildW(neg) {
    var W = {}; VERTS.forEach(function (u) { W[u] = {}; });
    BASE_EDGES.forEach(function (e) { W[e[0]][e[1]] = e[2]; });
    if (neg) W.C.A = -3;
    return W;
  }

  /* Bellman-Ford — the TRUE shortest-path weights (works with the one
     negative edge; the graph has no negative cycle). Used to expose the
     wrong answer Dijkstra returns in negative mode. */
  function trueDelta(W) {
    var d = {}; VERTS.forEach(function (v) { d[v] = Infinity; }); d[SRC] = 0;
    for (var i = 0; i < VERTS.length - 1; i++) {
      BASE_EDGES.forEach(function (e) {
        var u = e[0], v = e[1], w = W[u][v];
        if (d[u] !== Infinity && d[u] + w < d[v]) d[v] = d[u] + w;
      });
    }
    return d;
  }

  function pathToT(pi) {
    var p = ["T"], cur = "T", guard = 0;
    while (pi[cur] != null && guard++ < 10) { cur = pi[cur]; p.unshift(cur); }
    return p.join("→");
  }

  /* =====================================================================
     STEP ENGINE — actually run DIJKSTRA and record a snapshot per event.
     Events: init → (extract, relax*)* → done. This IS the algorithm, so
     the animation and the bookkeeping can never drift from the semantics.
     ===================================================================== */
  function buildSteps(neg) {
    var W = buildW(neg);
    var dist = {}, pi = {}, inQ = {}, inS = {}, sOrder = [];
    VERTS.forEach(function (v) {
      dist[v] = Infinity; pi[v] = null; inQ[v] = true; inS[v] = false;
    });
    dist[SRC] = 0;
    var steps = [];

    function snap(extra) {
      var s = {
        dist: assign({}, dist), pi: assign({}, pi),
        inQ: assign({}, inQ), inS: assign({}, inS),
        sOrder: sOrder.slice(), W: W
      };
      for (var k in extra) if (extra.hasOwnProperty(k)) s[k] = extra[k];
      steps.push(s);
    }

    /* ---- init (lines 1-3) ---- */
    snap({
      phase: "init", u: null, activeLines: [1, 2, 3],
      relaxEdge: null, relaxOk: false, updated: null, considered: null,
      title: "אתחול — Initialize-single-source",
      body: "קובעים " + ltr("d[v]=" + INF) + " ו-" + ltr("π[v]=NIL") +
        " לכל קודקוד, פרט למקור: " + ltr("d[S]=0") + ". הקבוצה " + ltr("S") +
        " (הקודקודים שמרחקם כבר סופי) מתחילה ריקה, ותור העדיפויות " + ltr("Q") +
        " מכיל את כל חמשת הקודקודים ממוין לפי " + ltr("d") + ". הקודקוד עם " +
        ltr("d") + " מינימלי — " + ltr("S (d=0)") + " — ייחלץ ראשון."
    });

    /* strict-min extract; iterating VERTS in fixed order → first minimum
       wins ties (there are none in this graph). Matches the notes' order. */
    function extractMin() {
      var best = null;
      VERTS.forEach(function (v) {
        if (!inQ[v]) return;
        if (best === null || dist[v] < dist[best]) best = v;
      });
      return best;
    }

    while (VERTS.some(function (v) { return inQ[v]; })) {
      var u = extractMin();
      inQ[u] = false; inS[u] = true; sOrder.push(u);

      /* ---- extract (lines 4-6) ---- */
      var exBody;
      if (u === SRC) {
        exBody = ltr("Extract-Min") + " מחזיר את המקור " + ltr("S") +
          " (" + ltr("d=0") + ", המינימום). מוסיפים אותו ל-" + ltr("S") +
          " ומריצים רלקסציה על שכניו " + ltr("Adj[S] = {A, C}") + ".";
      } else {
        exBody = ltr("Extract-Min") + " מחזיר את " + ltr("u=" + u) +
          " — ה-" + ltr("d") + " המינימלי ב-" + ltr("Q") + " כרגע (" +
          ltr("d=" + fmt(dist[u])) + "). מוסיפים אותו ל-" + ltr("S") + ". " +
          (neg
            ? "דייקסטרה <b>מניח</b> ש-" + ltr("d[" + u + "]=" + fmt(dist[u])) +
              " הוא כבר סופי ולא ישתנה — נראה בהמשך שההנחה הזו עלולה להישבר."
            : "לפי נכונות דייקסטרה " + ltr("d[" + u + "]=" + fmt(dist[u])) +
              " הוא כבר המרחק הסופי " + ltr("δ(S," + u + ")") + " — הוא לא ישתנה עוד.");
      }
      snap({
        phase: "extract", u: u, activeLines: [4, 5, 6],
        relaxEdge: null, relaxOk: false, updated: null, considered: null,
        title: "Extract-Min ← " + u + (u === SRC ? "  (המקור)" : ""),
        body: exBody
      });

      /* ---- relax each neighbour (lines 7-8), one snapshot per edge ---- */
      ADJ[u].forEach(function (v) {
        var w = W[u][v];
        var nd = dist[u] === Infinity ? Infinity : dist[u] + w;
        var old = dist[v];
        var improves = nd < old;
        var stale = false;
        if (improves) {
          dist[v] = nd; pi[v] = u;
          if (inS[v]) stale = true; /* relaxing a vertex already closed! */
        }
        var body;
        if (stale) {
          body = '<b style="color:' + WARN_RED + '">⚠ כאן דייקסטרה נשבר.</b> ' +
            "רלקסציה על הקשת השלילית " + ltr(u + "→" + v + " (w=" + fmt(w) + ")") +
            " מגלה מסלול זול יותר: " + ltr("d[" + u + "]+(" + fmt(w) + ") = " + fmt(nd)) +
            " &lt; " + ltr("d[" + v + "]=" + fmt(old)) + ", אז " + ltr("d[" + v + "]") +
            " יורד ל-" + ltr(fmt(nd)) + ". אבל " + ltr(v) + " <b>כבר נשלף מהתור ונמצא ב-S</b> — " +
            "דייקסטרה לעולם לא יחזור אליו, ולכן השיפור הזה <b>לא יופץ</b> לשכניו. " +
            "השכנים של " + ltr(v) + " כבר חושבו לפי הערך הישן.";
        } else if (improves) {
          body = "רלקסציה על " + ltr(u + "→" + v) + " (משקל " + ltr(fmt(w)) + "): " +
            ltr("d[" + u + "]+" + fmt(w) + " = " + fmt(nd)) + " <b>&lt;</b> " +
            ltr("d[" + v + "]=" + fmt(old)) + " ⟹ מעדכנים " +
            '<b style="color:' + C.mustard + '">' + ltr("d[" + v + "]=" + fmt(nd)) + "</b>" +
            " ו-" + ltr("π[" + v + "]=" + u) + ".";
        } else {
          body = "רלקסציה על " + ltr(u + "→" + v) + " (משקל " + ltr(fmt(w)) + "): " +
            ltr("d[" + u + "]+" + fmt(w) + " = " + fmt(nd)) + " <b>≥</b> " +
            ltr("d[" + v + "]=" + fmt(old)) + " ⟹ אין שיפור, " + ltr("d[" + v + "]") +
            " נשאר על " + ltr(fmt(old)) + ".";
        }
        snap({
          phase: "relax", u: u, activeLines: [7, 8],
          relaxEdge: [u, v], relaxOk: improves, stale: stale,
          updated: improves ? v : null, considered: v,
          title: "Relex(" + u + ", " + v + ", w)",
          body: body
        });
      });
    }

    /* ---- done (line 4: While Q ≠ ∅ becomes false) ---- */
    var doneBody, tD = null, mism = [];
    if (neg) {
      tD = trueDelta(W);
      VERTS.forEach(function (v) { if (dist[v] !== tD[v]) mism.push(v); });
      var rowHtml = VERTS.map(function (v) {
        var bad = dist[v] !== tD[v];
        var col = bad ? WARN_RED : C.sage;
        return '<tr>' +
          '<td style="padding:2px 10px;font-weight:800" dir="ltr">' + v + '</td>' +
          '<td style="padding:2px 10px;font-family:monospace;color:' + col + '" dir="ltr">' + fmt(dist[v]) + '</td>' +
          '<td style="padding:2px 10px;font-family:monospace;color:' + C.ink + '" dir="ltr">' + fmt(tD[v]) + '</td>' +
          '<td style="padding:2px 10px;color:' + col + ';font-weight:700">' + (bad ? "✗ שגוי" : "✓") + '</td>' +
          '</tr>';
      }).join("");
      doneBody =
        '<b style="color:' + WARN_RED + '">דייקסטרה החזיר תשובה שגויה.</b> ' +
        "עם הקשת השלילית " + ltr("C→A=−3") + " הקודקוד " + ltr("A") + " נסגר ב-" +
        ltr("d=1") + " עוד באיטרציה 2, לפני ש-" + ltr("C") + " שיפר אותו ל-" + ltr("−1") + ". " +
        "מכיוון ש-" + ltr("A") + " כבר לא היה בתור, " + ltr("B") + " ו-" + ltr("T") +
        " נשארו עם הערכים הישנים. השוואה מול המרחק האמיתי " + ltr("δ") +
        " (חושב ב-Bellman-Ford):" +
        '<div style="overflow-x:auto;margin-top:8px"><table dir="ltr" ' +
          'style="border-collapse:collapse;font-size:.82rem;margin:0 auto;text-align:center">' +
          '<tr style="color:' + C.inkSoft + ';font-size:.74rem">' +
            '<th style="padding:2px 10px">v</th><th style="padding:2px 10px">Dijkstra d</th>' +
            '<th style="padding:2px 10px">δ אמיתי</th><th style="padding:2px 10px"></th></tr>' +
          rowHtml +
        '</table></div>' +
        '<div style="margin-top:8px;font-size:.86rem">המסלול האמיתי הקצר ל-' + ltr("T") +
        " הוא " + ltr("S→C→A→B→T") + " במשקל " + ltr("2") +
        " — דייקסטרה מפספס אותו. זו הסיבה שדייקסטרה מחייב " +
        '<b>' + ltr("w: E → ℝ⁺") + "</b> (משקלים אי-שליליים).</div>";
    } else {
      doneBody = "התור " + ltr("Q") + " ריק — התנאי " + ltr("While Q ≠ ∅") +
        " נכשל והאלגוריתם מסתיים. המרחקים הסופיים: " +
        ltr("d[S]=0, d[A]=1, d[C]=2, d[B]=3, d[T]=4") + ". " +
        "המסלול הקצר ביותר " + ltr("S→T") + " הוא " +
        '<b style="color:' + C.sage + '">' + ltr(pathToT(pi)) + "</b> במשקל " +
        '<b style="color:' + C.sage + '">' + ltr("4") + "</b> — זול מהמסלול הישיר " +
        ltr("A→T (8)") + " ומהמסלול דרך " + ltr("C→T (6)") + ".";
    }
    snap({
      phase: "done", u: null, activeLines: [4],
      relaxEdge: null, relaxOk: false, updated: null, considered: null,
      title: neg ? "סיום — התשובה שגויה" : "סיום — כל המרחקים סופיים",
      body: doneBody, mismatch: mism, isNeg: neg
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
     Scene builder — hand-authored DIRECTED graph SVG. Returns references
     keyed by vertex / edge so applyState can restyle them.
     ===================================================================== */
  var GW = 560, GH = 320, R = 21;

  function buildGraph() {
    var svg = el("svg", {
      viewBox: "0 0 " + GW + " " + GH, width: "100%",
      role: "img", direction: "ltr",
      "aria-label": "גרף מכוון עם חמישה קודקודים S,A,B,C,T; אלגוריתם Dijkstra מהמקור S"
    });
    svg.style.display = "block";
    svg.style.maxWidth = GW + "px";
    svg.style.margin = "0 auto";

    /* arrowhead markers, one per colour */
    var defs = el("defs");
    [["dk-arr-line", C.line], ["dk-arr-clay", C.clay],
     ["dk-arr-sage", C.sage], ["dk-arr-mustard", C.mustard],
     ["dk-arr-warn", WARN_RED]].forEach(function (m) {
      var mk = el("marker", {
        id: m[0], viewBox: "0 0 10 10", refX: "8.5", refY: "5",
        markerWidth: "7.5", markerHeight: "7.5", orient: "auto-start-reverse"
      });
      mk.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", fill: m[1] }));
      defs.appendChild(mk);
    });
    svg.appendChild(defs);

    var edgeEls = {};  /* id → { line, chip, chipBg, u, v } */
    var nodeEls = {};  /* v  → { g, circle, letter, distBg, distTx } */

    /* ---- directed edges (drawn first, under the nodes) ---- */
    BASE_EDGES.forEach(function (e) {
      var u = e[0], v = e[1], id = eid(u, v);
      var a = POS[u], b = POS[v];
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / len, uy = dy / len;
      var x1 = a[0] + ux * R, y1 = a[1] + uy * R;
      var x2 = b[0] - ux * (R + 3.5), y2 = b[1] - uy * (R + 3.5);
      var line = el("line", {
        x1: x1, y1: y1, x2: x2, y2: y2,
        stroke: C.line, "stroke-width": 3, "stroke-linecap": "round",
        "marker-end": "url(#dk-arr-line)"
      });
      svg.appendChild(line);

      var nudge = LBL_NUDGE[id] || [0, 0];
      var mx = (a[0] + b[0]) / 2 + nudge[0];
      var my = (a[1] + b[1]) / 2 + nudge[1];
      var chipBg = el("rect", {
        x: mx - 11, y: my - 10, width: 22, height: 20, rx: 6,
        fill: C.surface, stroke: C.line, "stroke-width": 1
      });
      var chip = txt(mx, my + 4, String(e[2]), {
        "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: C.inkSoft
      });
      svg.appendChild(chipBg);
      svg.appendChild(chip);
      edgeEls[id] = { line: line, chip: chip, chipBg: chipBg, u: u, v: v };
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
      /* dist chip floating above the node */
      var chipY = p[1] - R - 12;
      var distBg = el("rect", {
        x: p[0] - 16, y: chipY - 11, width: 32, height: 18, rx: 9,
        fill: C.surface2, stroke: C.line, "stroke-width": 1
      });
      var distTx = txt(p[0], chipY + 3, INF, {
        "text-anchor": "middle", "font-size": 11.5, "font-weight": 700,
        fill: C.inkSoft, direction: "ltr"
      });
      g.appendChild(circle); g.appendChild(letter);
      g.appendChild(distBg); g.appendChild(distTx);
      svg.appendChild(g);
      nodeEls[v] = { g: g, circle: circle, letter: letter, distBg: distBg, distTx: distTx };
    });

    /* source badge on S */
    svg.appendChild(txt(POS.S[0], POS.S[1] + R + 15, "מקור", {
      "text-anchor": "middle", "font-size": 10, "font-weight": 700,
      fill: C.inkSoft, direction: "rtl"
    }));

    return { svg: svg, edgeEls: edgeEls, nodeEls: nodeEls };
  }

  /* =====================================================================
     Render one mount
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-dk-ready") === "1") return;
    mount.setAttribute("data-dk-ready", "1");
    mount.innerHTML = "";

    var mode = "ok";                 /* "ok" | "neg" */
    var STEPS = buildSteps(false);
    var idx = 0, autoTimer = null;

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");
    wrap.style.outline = "none";

    /* ---- caption + mode toggle ---- */
    var cap = document.createElement("div");
    cap.style.cssText = "display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:center;" +
      "margin-bottom:.7rem;color:" + C.inkSoft + ";font-size:.86rem";
    cap.innerHTML =
      '<b style="color:' + C.ink + ';font-size:.98rem">Dijkstra צעד-אחר-צעד</b>' +
      '<span>על גרף ההרצאה (' + ltr("S, A, B, C, T") + '), מקור ' + ltr("s=S") + '.</span>';
    wrap.appendChild(cap);

    var modeRow = document.createElement("div");
    modeRow.className = "viz-controls";
    modeRow.style.marginBottom = ".2rem";
    var modeLbl = document.createElement("span");
    modeLbl.style.cssText = "font-weight:700;color:" + C.ink + ";font-size:.85rem;align-self:center";
    modeLbl.textContent = "מצב:";
    modeRow.appendChild(modeLbl);
    var btnOk = mkBtn("✓ משקלים חיוביים", function () { setMode("ok"); });
    var btnNeg = mkBtn("✕ משקל שלילי (C→A=−3)", function () { setMode("neg"); });
    modeRow.appendChild(btnOk);
    modeRow.appendChild(btnNeg);
    wrap.appendChild(modeRow);

    /* ---- top row: graph + pseudocode ---- */
    var top = document.createElement("div");
    top.style.cssText = "display:flex;flex-wrap:wrap;gap:14px;align-items:stretch;margin-top:.6rem";

    var graphBox = document.createElement("div");
    graphBox.style.cssText = "flex:1 1 340px;min-width:300px;background:" + C.surface +
      ";border:1px solid " + C.line + ";border-radius:12px;padding:8px 6px";
    var graph = buildGraph();
    graphBox.appendChild(graph.svg);

    var legend = document.createElement("div");
    legend.style.cssText = "display:flex;flex-wrap:wrap;gap:.4rem 1rem;justify-content:center;" +
      "margin-top:4px;font-size:.72rem;color:" + C.inkSoft;
    function dot(col, label) {
      return '<span style="display:inline-flex;align-items:center;gap:.3rem">' +
        '<span style="width:11px;height:11px;border-radius:3px;background:' + col +
        ';display:inline-block"></span>' + label + '</span>';
    }
    legend.innerHTML =
      dot(C.clay, "נשלף (u)") +
      dot(C.sage, "סגור ב-S") +
      dot(C.mustard, "רלקסציה / עדכון") +
      dot(C.blue, "מינימום בתור");
    graphBox.appendChild(legend);
    top.appendChild(graphBox);

    /* pseudocode box */
    var pseudoBox = document.createElement("div");
    pseudoBox.style.cssText = "flex:1 1 250px;min-width:240px;background:" + C.surface2 +
      ";border:1px solid " + C.line + ";border-radius:12px;padding:10px 12px";
    var pseudoTitle = document.createElement("div");
    pseudoTitle.style.cssText = "font-size:.8rem;font-weight:700;color:" + C.inkSoft +
      ";margin-bottom:6px;direction:rtl";
    pseudoTitle.innerHTML = "פסאודו-קוד " + ltr("DIJKSTRA(G, w, s)") +
      '  <span style="color:' + C.inkSoft + '">' + ltr("W: E → ℝ⁺") + "</span>";
    pseudoBox.appendChild(pseudoTitle);

    var PSEUDO = [
      "1. Initialize-single-source(G,s)",
      "2. S ← ∅",
      "3. Q ← V[G]",
      "4. While Q ≠ ∅",
      "5.     do u ← Extract-Min(Q)",
      "6.          S ← S ∪ {u}",
      "7.           for each v ∈ Adj[u]",
      "8.                do Relex(u, v, w)"
    ];
    var pre = document.createElement("pre");
    pre.setAttribute("dir", "ltr");
    pre.style.cssText = "margin:0;font-size:.76rem;line-height:1.55;white-space:pre;" +
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
    /* note about the "Relex" typo (faithful to the slide) */
    var typoNote = document.createElement("div");
    typoNote.style.cssText = "margin-top:8px;font-size:.7rem;color:" + C.inkSoft +
      ";direction:rtl;line-height:1.5";
    typoNote.innerHTML = "* בשקף כתוב " + ltr("Relex") + " — שגיאת כתיב מקורית של " +
      ltr("Relax") + " (רלקסציה), נשמרת כלשונה.";
    pseudoBox.appendChild(typoNote);
    top.appendChild(pseudoBox);
    wrap.appendChild(top);

    /* ---- dist / π table ---- */
    var tableBox = document.createElement("div");
    tableBox.style.cssText = "margin-top:14px;overflow-x:auto;background:" + C.surface +
      ";border:1px solid " + C.line + ";border-radius:12px;padding:8px 6px";
    var table = document.createElement("table");
    table.setAttribute("dir", "ltr");
    table.style.cssText = "border-collapse:separate;border-spacing:0;width:100%;" +
      "min-width:380px;font-size:.84rem;text-align:center";
    var rowsSpec = [
      { label: "V", head: true },
      { label: "d", key: "dist" },
      { label: "π", key: "pi" }
    ];
    var cellEls = { dist: {}, pi: {}, head: {} };
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
        cell.style.cssText = "padding:5px 0;min-width:40px;font-weight:" +
          (spec.head ? "800" : "700") + ";font-family:" +
          (spec.head ? "inherit" : "monospace") +
          ";border-bottom:1px solid " + C.line + ";transition:background .15s ease";
        tr.appendChild(cell);
        if (spec.head) { cellEls.head[v] = cell; cell.textContent = v; }
        else cellEls[spec.key][v] = cell;
      });
      table.appendChild(tr);
    });
    tableBox.appendChild(table);
    wrap.appendChild(tableBox);

    /* ---- Q and S panels ---- */
    var setRow = document.createElement("div");
    setRow.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;margin-top:12px";

    function makeSetBox(labelHtml) {
      var box = document.createElement("div");
      box.style.cssText = "flex:1 1 240px;min-width:220px;background:" + C.surface2 +
        ";border:1px solid " + C.line + ";border-radius:12px;padding:9px 12px;" +
        "display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;min-height:2.7rem";
      var lbl = document.createElement("span");
      lbl.style.cssText = "font-weight:700;color:" + C.ink + ";font-size:.85rem";
      lbl.innerHTML = labelHtml;
      box.appendChild(lbl);
      var chips = document.createElement("span");
      chips.style.cssText = "display:flex;gap:.35rem;flex-wrap:wrap;align-items:center";
      box.appendChild(chips);
      return { box: box, chips: chips };
    }
    var qUI = makeSetBox(ltr("Q") + " (תור עדיפויות):");
    var sUI = makeSetBox(ltr("S") + " (סגורים, סופי):");
    setRow.appendChild(qUI.box);
    setRow.appendChild(sUI.box);
    wrap.appendChild(setRow);

    /* ---- explanation panel ---- */
    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.cssText = "margin-top:12px;background:" + C.surface +
      ";border:1px solid " + C.line + ";border-radius:12px;padding:12px 14px;" +
      "min-height:100px;color:" + C.ink + ";line-height:1.65;font-size:.9rem";
    wrap.appendChild(panel);

    /* ---- controls ---- */
    var controls = document.createElement("div");
    controls.className = "viz-controls";
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

    function mkBtn(label, fn, primary) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn" + (primary ? " primary" : "");
      b.innerHTML = label;
      b.addEventListener("click", fn);
      return b;
    }

    /* ---------------------------------------------------------------
       apply a step's state to the whole scene
       --------------------------------------------------------------- */
    function pulse(node) {
      if (reducedMotion() || !node || !node.animate) return;
      node.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.16)" }, { transform: "scale(1)" }],
        { duration: 360, easing: "ease-out" }
      );
    }

    function applyState(s) {
      var W = s.W;
      /* tree edges from π */
      var treeSet = {};
      VERTS.forEach(function (v) {
        if (s.pi[v] != null) treeSet[eid(s.pi[v], v)] = true;
      });
      var relaxId = s.relaxEdge ? eid(s.relaxEdge[0], s.relaxEdge[1]) : null;

      /* edges */
      for (var id in graph.edgeEls) {
        var ge = graph.edgeEls[id];
        var col = C.line, wdt = 3, chipCol = C.inkSoft, chipStroke = C.line, dash = "none";
        if (treeSet[id]) { col = C.sage; wdt = 4.5; chipCol = C.sage; chipStroke = C.sage; }
        if (id === relaxId) {
          col = s.stale ? WARN_RED : C.mustard;
          wdt = s.relaxOk ? 5 : 3;
          chipCol = col; chipStroke = col;
          dash = s.relaxOk ? "none" : "5 4";
        }
        ge.line.setAttribute("stroke", col);
        ge.line.setAttribute("stroke-width", wdt);
        ge.line.setAttribute("stroke-dasharray", dash);
        ge.line.setAttribute("marker-end",
          "url(#dk-arr-" + (col === C.sage ? "sage" : col === C.mustard ? "mustard" :
            col === WARN_RED ? "warn" : col === C.clay ? "clay" : "line") + ")");
        /* edge weight label reflects the current mode's weight */
        ge.chip.textContent = fmt(W[ge.u][ge.v]);
        ge.chip.setAttribute("fill", chipCol);
        ge.chipBg.setAttribute("stroke", chipStroke);
      }

      /* nodes */
      VERTS.forEach(function (v) {
        var ne = graph.nodeEls[v];
        var fill = C.surface, stroke = C.line, sw = 2.5, letterCol = C.ink;
        if (s.inS[v]) { fill = SAGE_TINT; stroke = C.sage; sw = 2.5; }
        if (s.updated === v) { fill = MUST_TINT; stroke = s.stale ? WARN_RED : C.mustard; sw = 3.2; }
        if (s.u === v) { fill = CLAY_TINT; stroke = C.clay; sw = 3.5; letterCol = C.clay; }
        ne.circle.setAttribute("fill", fill);
        ne.circle.setAttribute("stroke", stroke);
        ne.circle.setAttribute("stroke-width", sw);
        ne.letter.setAttribute("fill", letterCol);
        /* dist chip */
        var dv = s.dist[v];
        ne.distTx.textContent = fmt(dv);
        var dc = dv === Infinity ? C.inkSoft : (s.inS[v] ? C.sage : C.ink);
        var dbg = C.surface2, dst = C.line;
        if (s.u === v) { dc = C.clay; dbg = CLAY_TINT; dst = C.clay; }
        else if (s.updated === v) { dc = s.stale ? WARN_RED : "#8a6d1f"; dbg = MUST_TINT; dst = stroke; }
        ne.distTx.setAttribute("fill", dc);
        ne.distBg.setAttribute("fill", dbg);
        ne.distBg.setAttribute("stroke", dst);
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

      /* dist / π table */
      VERTS.forEach(function (v) {
        cellEls.dist[v].textContent = fmt(s.dist[v]);
        cellEls.pi[v].textContent = s.pi[v] == null ? "–" : s.pi[v];
        var bg = "transparent", vcol = s.dist[v] === Infinity ? C.inkSoft : C.ink;
        var hbg = "transparent", hcol = C.ink;
        if (s.inS[v]) { hbg = SAGE_TINT; hcol = C.sage; }
        if (s.updated === v) { bg = MUST_TINT; vcol = s.stale ? WARN_RED : "#8a6d1f"; }
        if (s.u === v) { hbg = CLAY_TINT; hcol = C.clay; }
        cellEls.head[v].style.background = hbg;
        cellEls.head[v].style.color = hcol;
        cellEls.dist[v].style.background = bg;
        cellEls.dist[v].style.color = vcol;
        cellEls.pi[v].style.background = bg;
        cellEls.pi[v].style.color = (s.updated === v && s.stale) ? WARN_RED : C.ink;
      });

      /* Q chips (in-queue, sorted by dist asc) */
      qUI.chips.innerHTML = "";
      var inQ = VERTS.filter(function (v) { return s.inQ[v]; })
        .sort(function (a, b) {
          if (s.dist[a] !== s.dist[b]) return s.dist[a] - s.dist[b];
          return VERTS.indexOf(a) - VERTS.indexOf(b);
        });
      if (!inQ.length) {
        var empty = document.createElement("span");
        empty.textContent = "∅ (ריק)";
        empty.style.cssText = "font-family:monospace;color:" + C.sage + ";font-weight:700";
        qUI.chips.appendChild(empty);
      } else {
        inQ.forEach(function (v, i) {
          var isMin = (i === 0);
          var chip = document.createElement("span");
          chip.setAttribute("dir", "ltr");
          chip.textContent = v + ":" + fmt(s.dist[v]);
          chip.style.cssText = "font-family:monospace;font-size:.8rem;font-weight:700;" +
            "padding:.12rem .5rem;border-radius:99px;border:1.5px solid " +
            (isMin ? C.blue : C.line) + ";background:" +
            (isMin ? BLUE_TINT : C.surface) + ";color:" +
            (isMin ? C.blue : (s.dist[v] === Infinity ? C.inkSoft : C.ink));
          if (isMin) chip.title = "המינימום — ייחלץ בשלב הבא";
          qUI.chips.appendChild(chip);
        });
      }

      /* S chips (in insertion order) */
      sUI.chips.innerHTML = "";
      if (!s.sOrder.length) {
        var e2 = document.createElement("span");
        e2.textContent = "∅ (ריק)";
        e2.style.cssText = "font-family:monospace;color:" + C.inkSoft + ";font-weight:700";
        sUI.chips.appendChild(e2);
      } else {
        s.sOrder.forEach(function (v) {
          var chip = document.createElement("span");
          chip.setAttribute("dir", "ltr");
          chip.textContent = v + ":" + fmt(s.dist[v]);
          chip.style.cssText = "font-family:monospace;font-size:.8rem;font-weight:700;" +
            "padding:.12rem .5rem;border-radius:99px;border:1.5px solid " + C.sage +
            ";background:" + SAGE_TINT + ";color:" + C.sage;
          sUI.chips.appendChild(chip);
        });
      }
    }

    /* ---------------------------------------------------------------
       explanation panel
       --------------------------------------------------------------- */
    function renderPanel(s) {
      var badgeCol = s.phase === "extract" ? C.clay
        : s.phase === "relax" ? (s.stale ? WARN_RED : C.mustard)
          : s.phase === "done" ? (s.isNeg ? WARN_RED : C.sage) : C.blue;
      panel.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px">' +
          '<span style="background:' + badgeCol + ';color:#fff;font-weight:700;font-size:.72rem;' +
            'padding:2px 10px;border-radius:99px" dir="auto">' + s.title + '</span>' +
        '</div>' +
        '<div>' + s.body + '</div>';
    }

    /* ---------------------------------------------------------------
       navigation
       --------------------------------------------------------------- */
    function go(n) {
      idx = Math.max(0, Math.min(STEPS.length - 1, n));
      var s = STEPS[idx];
      applyState(s);
      renderPanel(s);
      if (s.phase === "extract" && s.u && graph.nodeEls[s.u]) pulse(graph.nodeEls[s.u].g);
      else if (s.updated && graph.nodeEls[s.updated]) pulse(graph.nodeEls[s.updated].g);
      counter.textContent = "שלב " + (idx + 1) + " / " + STEPS.length;
      btnPrev.disabled = idx === 0;
      btnNext.disabled = idx === STEPS.length - 1;
    }

    /* ---------------------------------------------------------------
       mode switch
       --------------------------------------------------------------- */
    function setMode(m) {
      if (m === mode && STEPS) { /* still repaint toggle state */ }
      stopAuto();
      mode = m;
      STEPS = buildSteps(m === "neg");
      btnOk.classList.toggle("primary", m === "ok");
      btnNeg.classList.toggle("primary", m === "neg");
      btnOk.setAttribute("aria-pressed", m === "ok" ? "true" : "false");
      btnNeg.setAttribute("aria-pressed", m === "neg" ? "true" : "false");
      go(0);
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
      }, reducedMotion() ? 2000 : 1550);
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
    setMode("ok");
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
