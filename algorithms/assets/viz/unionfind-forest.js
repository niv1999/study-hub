/* =====================================================================
   unionfind-forest.js  —  Module 05 "Union-Find ואלגוריתם Kruskal"
   Grounded in _notes/04-mst-kruskal-unionfind.md  (union-find-mst-kruskal.pdf
   עמ' 3-10) — the lecturer's EXACT graphic demonstration of building the
   Disjoint-Set Forest on the 8 nodes  X, Y, Z, W, R, S, T, V,  then running
   Find-Set(S) to show path compression flatten the depth-3 chain S→R→T→W.

   The build reproduces the slides step-by-step. The slides keep the deep
   chain S→R→T→W all the way to עמ' 8 and only flatten it at the explicit
   Find-Set(S) on עמ' 9-10 — i.e. the DEMO applies union-by-rank while
   BUILDING and defers path compression to the final Find-Set. So the build
   unions here link the two ROOTS directly (union by rank only); compression
   is shown only in the last two steps, exactly as in class.

   Operation script (produces the slides' states verbatim):
     Make-Set(x) for X,Y,Z,W,R,S,T,V         → עמ' 3  (8 singletons, rank 0)
     Union(X,Y)  Link(X,Y)  p[X]=Y, rank[Y]=1 → עמ' 4
     Union(Z,W)  Link(Z,W)  p[Z]=W, rank[W]=1 ┐
     Union(S,R)  Link(S,R)  p[S]=R, rank[R]=1 ├ עמ' 5  (4 pairs)
     Union(V,T)  Link(V,T)  p[V]=T, rank[T]=1 ┘
     Union(X,Z)  Link(Y,W)  p[Y]=W, rank[W]=2 → עמ' 6  (left tree, rank 2)
     Union(S,V)  Link(R,T)  p[R]=T, rank[T]=2 → עמ' 7  (right tree, rank 2)
     Union(S,X)  Link(T,W)  p[T]=W, rank[W]=3 → עמ' 8  (one tree, chain S→R→T→W)
     Find-Set(S) traverse S→R→T→W  (root=W)   → עמ' 9
     Find-Set(S) path compression p[S]=W,p[R]=W→ עמ' 10  (ranks UNCHANGED)

   Pseudocode used (VERBATIM from the notes, עמ' 2):
     Make-Set(x): p[x]←x ; rank[x]←0
     Union(x,y):  Link(Find-Set(x), Find-Set(y))
     Find-Set(x): if x≠p[x] then p[x]←Find-Set(p[x]); return p[x]   (compression)
     Link(x,y):   if rank[x]>rank[y] then p[y]←x
                  else p[x]←y ; if rank[x]=rank[y] then rank[y]←rank[y]+1

   Self-contained IIFE, hand-authored SVG. Cream design tokens hardcoded
   (CONTRACT §2). RTL Hebrew captions; English/LTR algorithm identifiers.
   Works over a static server AND file://. Graceful if the mount is absent.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "unionfind-forest";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design palette (hardcoded per CONTRACT §2; unit-2 accent = sage) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",   /* node fill (slides: blue circles) */
    blueDk: "#54707F",
    clay: "#BE7C5E",   /* Find-Set / path compression (slides: red label) */
    sage: "#7C9885",   /* unit-2 accent — a just-linked edge / a changed cell */
    sageDk: "#5F7C69",
    mustard: "#C9A24B"
  };

  var NODES = ["X", "Y", "Z", "W", "R", "S", "T", "V"];

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
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* =====================================================================
     STEP MODEL — run the real Union-Find engine once and snapshot after
     each operation. Guarantees the displayed p[]/rank[] are algorithmically
     correct rather than hand-typed.
     ===================================================================== */
  function buildSteps() {
    var P = {}, RK = {};
    NODES.forEach(function (n) { P[n] = n; RK[n] = 0; });

    var steps = [];
    function snapP() { var o = {}; NODES.forEach(function (n) { o[n] = P[n]; }); return o; }
    function snapR() { var o = {}; NODES.forEach(function (n) { o[n] = RK[n]; }); return o; }
    function root(x) { while (P[x] !== x) x = P[x]; return x; } /* no compression (build phase) */

    function push(meta) {
      meta.P = snapP(); meta.RK = snapR();
      meta.changed = meta.changed || [];
      meta.hlEdges = meta.hlEdges || [];
      meta.path = meta.path || [];
      steps.push(meta);
    }

    /* --- step 0: Make-Set × 8 --- */
    push({
      badge: "Make-Set × 8", color: C.blue,
      title: "0 · אתחול — Make-Set לכל צומת",
      body: "מבצעים <b dir=\"ltr\">Make-Set(x)</b> לכל אחד מ-8 הצמתים " +
        "<span dir=\"ltr\">X, Y, Z, W, R, S, T, V</span>. כל צומת הופך " +
        "לשורש של עצמו (<span dir=\"ltr\">p[x] = x</span>, מצוין בלולאה עצמית) עם " +
        "<span dir=\"ltr\">rank = 0</span>. יש כרגע <b>8 קבוצות זרות</b>.",
      changed: NODES.slice()
    });

    /* Link(rx,ry) exactly as the pseudocode; returns the child that got a parent. */
    function unionStep(a, b, meta) {
      var rx = root(a), ry = root(b);
      var attached, changed;
      if (RK[rx] > RK[ry]) {
        P[ry] = rx; attached = ry; changed = [ry];
      } else {
        P[rx] = ry; attached = rx; changed = [rx];
        if (RK[rx] === RK[ry]) { RK[ry] += 1; if (changed.indexOf(ry) < 0) changed.push(ry); }
      }
      meta.changed = changed;
      meta.hlEdges = [attached];
      meta.roots = [rx, ry];
      push(meta);
    }

    unionStep("X", "Y", {
      badge: "Union(X, Y)", color: C.sage,
      title: "1 · Union(X, Y)",
      body: "<b dir=\"ltr\">Union(X, Y)</b> קורא ל-<b dir=\"ltr\">Link(Find-Set(X), Find-Set(Y))</b> " +
        "= <b dir=\"ltr\">Link(X, Y)</b> (כל אחד שורש של עצמו). הדרגות שוות " +
        "(<span dir=\"ltr\">0 = 0</span>) ⇒ לפי <b>union by rank</b> תולים את X תחת Y " +
        "(<span dir=\"ltr\">p[X] = Y</span>) ומעלים <span dir=\"ltr\">rank[Y]</span> ל-1."
    });
    unionStep("Z", "W", {
      badge: "Union(Z, W)", color: C.sage,
      title: "2 · Union(Z, W)",
      body: "אותו דפוס: <b dir=\"ltr\">Link(Z, W)</b>, דרגות שוות ⇒ " +
        "<span dir=\"ltr\">p[Z] = W</span>, <span dir=\"ltr\">rank[W] = 1</span>."
    });
    unionStep("S", "R", {
      badge: "Union(S, R)", color: C.sage,
      title: "3 · Union(S, R)",
      body: "<b dir=\"ltr\">Link(S, R)</b>: <span dir=\"ltr\">p[S] = R</span>, " +
        "<span dir=\"ltr\">rank[R] = 1</span>."
    });
    unionStep("V", "T", {
      badge: "Union(V, T)", color: C.sage,
      title: "4 · Union(V, T) — נוצרו 4 זוגות",
      body: "<b dir=\"ltr\">Link(V, T)</b>: <span dir=\"ltr\">p[V] = T</span>, " +
        "<span dir=\"ltr\">rank[T] = 1</span>. כעת יש 4 קבוצות, כל אחת עץ בגובה 1: " +
        "<span dir=\"ltr\">{X,Y}, {Z,W}, {S,R}, {V,T}</span> (שקף עמ' 5)."
    });
    unionStep("X", "Z", {
      badge: "Union(X, Z)", color: C.sage,
      title: "5 · Union(X, Z) — איחוד שתי דרגות שוות",
      body: "השורשים הם <b>Y</b> ו-<b>W</b> (דרגה 1 כל אחד). <b dir=\"ltr\">Link(Y, W)</b>: " +
        "הדרגות שוות ⇒ Y נתלה תחת W (<span dir=\"ltr\">p[Y] = W</span>), " +
        "ו-<span dir=\"ltr\">rank[W]</span> <b>עולה ל-2</b>. כשמאחדים שני עצים בעלי דרגה זהה — " +
        "הדרגה גדֵלה. {X,Y,Z,W} עץ אחד בגובה 2."
    });
    unionStep("S", "V", {
      badge: "Union(S, V)", color: C.sage,
      title: "6 · Union(S, V) — העץ הימני מגיע לדרגה 2",
      body: "השורשים <b>R</b> ו-<b>T</b> (דרגה 1). <b dir=\"ltr\">Link(R, T)</b>: שוות ⇒ " +
        "<span dir=\"ltr\">p[R] = T</span>, <span dir=\"ltr\">rank[T] = 2</span>. עכשיו שני עצים " +
        "נפרדים בני 4 צמתים, כל אחד בדרגה 2 (שקף עמ' 7)."
    });
    unionStep("S", "X", {
      badge: "Union(S, X)", color: C.sage,
      title: "7 · Union(S, X) — העץ המלא, השורש W בדרגה 3",
      body: "השורשים <b>T</b> (של S) ו-<b>W</b> (של X), שניהם דרגה 2. " +
        "<b dir=\"ltr\">Link(T, W)</b>: שוות ⇒ <span dir=\"ltr\">p[T] = W</span> " +
        "ו-<span dir=\"ltr\">rank[W]</span> <b>עולה ל-3</b>. נוצר עץ יחיד בן 8 צמתים, השורש W. " +
        "שימו לב לשרשרת העמוקה <span dir=\"ltr\">S → R → T → W</span> (עומק 3) — בדיוק זו מה " +
        "ש-path compression עומד לשטח."
    });

    /* --- Find-Set(S) — traverse (no state change) --- */
    push({
      badge: "Find-Set(S)", color: C.clay,
      title: "8 · Find-Set(S) — מטפסים אל השורש",
      body: "כדי לדעת לאיזו קבוצה שייך S מטפסים במעלה מצביעי ה-p לאורך המסלול " +
        "<span dir=\"ltr\">S → R → T → W</span>, עד שמגיעים לשורש <b>W</b> " +
        "(<span dir=\"ltr\">W = p[W]</span>). זהו „שם” הקבוצה. כעת בדרך חזרה יופעל " +
        "<b>path compression</b>.",
      hlEdges: ["S", "R", "T"], path: ["S", "R", "T", "W"], find: "S"
    });

    /* --- Find-Set(S) — path compression --- */
    (function () {
      var w = root("S");                 /* = W */
      ["S", "R", "T"].forEach(function (n) { P[n] = w; });
      push({
        badge: "path compression", color: C.clay,
        title: "9 · Path compression — שיטוח המסלול",
        body: "בדרך החזרה מהרקורסיה, <b>כל צומת שנפגש</b> במסלול מקבל מצביע <b>ישיר</b> אל השורש: " +
          "<span dir=\"ltr\">p[S] = W</span> ו-<span dir=\"ltr\">p[R] = W</span> " +
          "(T כבר הצביע ל-W). השרשרת בעומק 3 השתטחה לגובה 1. " +
          "<b>שימו לב:</b> הדרגות (<span dir=\"ltr\">rank</span>) <b>לא השתנו</b> — rank הוא רק " +
          "חסם עליון על הגובה, ו-path compression אינו מעדכן אותו. עתידית Find יהיה מהיר יותר.",
        changed: ["S", "R"], hlEdges: ["S", "R", "T"], path: ["S", "R", "T", "W"], find: "S"
      });
    })();

    return steps;
  }

  /* =====================================================================
     Tidy-forest layout: root at top (with self-loop), children below.
     Leaves get sequential columns; a parent sits above the midpoint of
     its children. Columns are scaled to fit the SVG width.
     ===================================================================== */
  var W = 680, Hs = 348, TOP = 66, ROWH = 74, R_NODE = 19;

  function computeLayout(P) {
    var kids = {}, roots = [];
    NODES.forEach(function (n) { kids[n] = []; });
    NODES.forEach(function (n) { if (P[n] === n) roots.push(n); else kids[P[n]].push(n); });
    NODES.forEach(function (n) {
      kids[n].sort(function (a, b) { return NODES.indexOf(a) - NODES.indexOf(b); });
    });
    roots.sort(function (a, b) { return NODES.indexOf(a) - NODES.indexOf(b); });

    var col = 0, colOf = {}, depthOf = {};
    function dfs(n, d) {
      depthOf[n] = d;
      var ch = kids[n];
      if (!ch.length) { colOf[n] = col; col += 1; }
      else {
        ch.forEach(function (c) { dfs(c, d + 1); });
        colOf[n] = (colOf[ch[0]] + colOf[ch[ch.length - 1]]) / 2;
      }
    }
    roots.forEach(function (r) { dfs(r, 0); col += 1; /* gap between trees */ });

    var minC = Infinity, maxC = -Infinity;
    NODES.forEach(function (n) { minC = Math.min(minC, colOf[n]); maxC = Math.max(maxC, colOf[n]); });
    var span = Math.max(1, maxC - minC);
    var margin = 44;
    var COLW = Math.min(62, (W - 2 * margin) / span);
    var used = span * COLW;
    var offX = (W - used) / 2 - minC * COLW;

    var pos = {};
    NODES.forEach(function (n) {
      pos[n] = { x: offX + colOf[n] * COLW, y: TOP + depthOf[n] * ROWH };
    });
    return pos;
  }

  /* =====================================================================
     Render one mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-uf-ready") === "1") return;
    mount.setAttribute("data-uf-ready", "1");
    mount.innerHTML = "";

    var STEPS = buildSteps();
    var idx = 0;
    var autoTimer = null;
    var rafId = null;
    var curPos = null;

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");
    wrap.style.outline = "none";

    /* ---------- SVG scene ---------- */
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + Hs, width: "100%",
      role: "img", direction: "ltr",
      "aria-label": "יער Union-Find על הצמתים X Y Z W R S T V עם דרגות ומצביעי אב"
    });
    svg.style.display = "block";
    svg.style.maxWidth = W + "px";
    svg.style.margin = "0 auto";

    var defs = el("defs");
    function mkArrow(id, color) {
      var m = el("marker", {
        id: id, viewBox: "0 0 10 10", refX: "8.5", refY: "5",
        markerWidth: "6.5", markerHeight: "6.5", orient: "auto-start-reverse"
      });
      m.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", fill: color }));
      defs.appendChild(m);
    }
    mkArrow("uf-arr", C.inkSoft);
    mkArrow("uf-arr-sage", C.sageDk);
    mkArrow("uf-arr-clay", C.clay);
    mkArrow("uf-arr-blue", C.blueDk);
    svg.appendChild(defs);

    /* soft backdrop for the forest area */
    svg.appendChild(el("rect", {
      x: 6, y: 6, width: W - 12, height: Hs - 12, rx: 14,
      fill: C.surface, stroke: C.line, "stroke-width": 1.5
    }));

    /* edge layer (rebuilt each frame) sits UNDER the node groups */
    var edgeLayer = el("g", {});
    svg.appendChild(edgeLayer);

    /* build the 8 persistent node groups */
    var ng = {};
    NODES.forEach(function (n) {
      var g = el("g", { transform: "translate(0,0)" });
      var loop = el("path", {
        d: "M -7 " + (-R_NODE) + " C -24 " + (-R_NODE - 26) + ", 24 " + (-R_NODE - 26) + ", 7 " + (-R_NODE),
        fill: "none", stroke: C.blueDk, "stroke-width": 2,
        "marker-end": "url(#uf-arr-blue)", opacity: 0
      });
      var circ = el("circle", {
        cx: 0, cy: 0, r: R_NODE, fill: C.blue, stroke: C.blueDk, "stroke-width": 2
      });
      var ring = el("circle", {   /* highlight ring for "changed"/path */
        cx: 0, cy: 0, r: R_NODE + 4, fill: "none", stroke: C.sage,
        "stroke-width": 2.6, opacity: 0
      });
      var lbl = txt(0, 5, n, {
        "text-anchor": "middle", "font-size": 16, "font-weight": 800, fill: "#fff",
        "font-family": "system-ui, sans-serif"
      });
      /* rank badge (white square, upper-left — slides put rank in a white box) */
      var rBox = el("rect", {
        x: -R_NODE - 15, y: -R_NODE - 6, width: 17, height: 17, rx: 3.5,
        fill: "#fff", stroke: C.mustard, "stroke-width": 1.5
      });
      var rTx = txt(-R_NODE - 6.5, -R_NODE + 6.5, "0", {
        "text-anchor": "middle", "font-size": 11, "font-weight": 800, fill: C.ink,
        "font-family": "ui-monospace, monospace"
      });
      g.appendChild(loop); g.appendChild(ring); g.appendChild(circ);
      g.appendChild(lbl); g.appendChild(rBox); g.appendChild(rTx);
      svg.appendChild(g);
      ng[n] = { g: g, loop: loop, circ: circ, ring: ring, lbl: lbl, rBox: rBox, rTx: rTx };
    });

    var sceneBox = document.createElement("div");
    sceneBox.style.background = C.surface2;
    sceneBox.style.borderRadius = "14px";
    sceneBox.style.padding = "4px";
    sceneBox.appendChild(svg);
    wrap.appendChild(sceneBox);

    /* ---------- legend ---------- */
    var legend = document.createElement("div");
    legend.style.cssText = "display:flex;flex-wrap:wrap;gap:10px 16px;margin:8px 4px 0;" +
      "font-size:.78rem;color:" + C.inkSoft + ";align-items:center;";
    legend.innerHTML =
      '<span><span style="display:inline-block;width:12px;height:12px;border-radius:50%;' +
        'background:' + C.blue + ';vertical-align:-1px"></span> צומת</span>' +
      '<span><span style="display:inline-block;width:11px;height:11px;border-radius:3px;' +
        'background:#fff;border:1.5px solid ' + C.mustard + ';vertical-align:-1px"></span> ' +
        '<span dir="ltr">rank</span> (חסם על הגובה)</span>' +
      '<span>↑ חץ = <span dir="ltr">p[x]</span> (מצביע לאב)</span>' +
      '<span>לולאה עצמית = שורש</span>' +
      '<span><span style="display:inline-block;width:12px;height:3px;background:' + C.clay +
        ';vertical-align:3px"></span> מסלול <span dir="ltr">Find-Set</span></span>';
    wrap.appendChild(legend);

    /* ---------- disjoint-sets chips ---------- */
    var setsRow = document.createElement("div");
    setsRow.setAttribute("aria-live", "polite");
    setsRow.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:12px 4px 0;";
    wrap.appendChild(setsRow);

    /* ---------- bookkeeping table (p[] and rank[]) ---------- */
    var tableBox = document.createElement("div");
    tableBox.style.cssText = "overflow-x:auto;margin-top:10px;";
    var table = document.createElement("table");
    table.style.cssText = "border-collapse:collapse;width:100%;min-width:420px;" +
      "font-size:.82rem;text-align:center;direction:ltr;";
    tableBox.appendChild(table);
    wrap.appendChild(tableBox);

    /* header + two data rows built once; cells updated per step */
    var cellsP = {}, cellsR = {};
    (function buildTable() {
      var thead = document.createElement("thead");
      var htr = document.createElement("tr");
      var corner = document.createElement("th");
      corner.textContent = "";
      corner.style.cssText = "padding:5px 8px;";
      htr.appendChild(corner);
      NODES.forEach(function (n) {
        var th = document.createElement("th");
        th.textContent = n;
        th.style.cssText = "padding:5px 0;font-weight:800;color:" + C.blueDk +
          ";border-bottom:2px solid " + C.line + ";font-family:ui-monospace,monospace;";
        htr.appendChild(th);
      });
      thead.appendChild(htr);
      table.appendChild(thead);

      var tbody = document.createElement("tbody");
      function row(label, store) {
        var tr = document.createElement("tr");
        var th = document.createElement("th");
        th.innerHTML = label;
        th.style.cssText = "padding:5px 8px;text-align:right;font-weight:700;color:" +
          C.inkSoft + ";white-space:nowrap;font-family:ui-monospace,monospace;";
        tr.appendChild(th);
        NODES.forEach(function (n) {
          var td = document.createElement("td");
          td.style.cssText = "padding:5px 0;font-family:ui-monospace,monospace;" +
            "border-bottom:1px solid " + C.line + ";transition:background .3s;";
          tr.appendChild(td);
          store[n] = td;
        });
        tbody.appendChild(tr);
      }
      row("p[·]", cellsP);
      row("rank[·]", cellsR);
      table.appendChild(tbody);
    })();

    /* ---------- explanation panel ---------- */
    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.cssText = "background:" + C.surface2 + ";border:1px solid " + C.line +
      ";border-radius:12px;padding:12px 14px;margin-top:12px;min-height:96px;color:" +
      C.ink + ";line-height:1.7;font-size:.9rem;";
    wrap.appendChild(panel);

    /* ---------- step rail ---------- */
    var rail = document.createElement("div");
    rail.setAttribute("role", "tablist");
    rail.setAttribute("aria-label", "שלבי בניית היער");
    rail.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 4px;";
    var chips = STEPS.map(function (s, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn";
      b.setAttribute("role", "tab");
      b.textContent = String(i);
      b.title = s.title;
      b.setAttribute("aria-label", s.title);
      b.style.cssText = "padding:.2rem .58rem;font-size:.82rem;min-width:1.9rem;";
      b.addEventListener("click", function () { stopAuto(); goto(i); });
      rail.appendChild(b);
      return b;
    });
    wrap.appendChild(rail);

    /* ---------- controls ---------- */
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
    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); goto(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); goto(idx + 1); }, true);
    var btnPlay = mkBtn("▶ הפעל", function () { toggleAuto(); });
    var btnReset = mkBtn("↺ איפוס", function () { stopAuto(); goto(0); });
    controls.appendChild(btnPrev);
    controls.appendChild(btnNext);
    controls.appendChild(btnPlay);
    controls.appendChild(btnReset);
    wrap.appendChild(controls);

    mount.appendChild(wrap);

    /* =====================================================================
       Rendering helpers
       ===================================================================== */
    function interp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

    function drawEdges(pos, step) {
      while (edgeLayer.firstChild) edgeLayer.removeChild(edgeLayer.firstChild);
      NODES.forEach(function (n) {
        if (step.P[n] === n) return; /* root — self-loop drawn in node group */
        var a = pos[n], b = pos[step.P[n]];
        var dx = b.x - a.x, dy = b.y - a.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        var ux = dx / d, uy = dy / d;
        var x1 = a.x + ux * (R_NODE + 1), y1 = a.y + uy * (R_NODE + 1);
        var x2 = b.x - ux * (R_NODE + 5), y2 = b.y - uy * (R_NODE + 5);
        var hot = step.hlEdges.indexOf(n) !== -1;
        var col = hot ? (step.find ? C.clay : C.sageDk) : C.inkSoft;
        var mk = hot ? (step.find ? "uf-arr-clay" : "uf-arr-sage") : "uf-arr";
        edgeLayer.appendChild(el("line", {
          x1: x1, y1: y1, x2: x2, y2: y2,
          stroke: col, "stroke-width": hot ? 3 : 1.7,
          opacity: hot ? 1 : 0.7, "marker-end": "url(#" + mk + ")"
        }));
      });
    }

    function placeNodes(pos) {
      NODES.forEach(function (n) {
        ng[n].g.setAttribute("transform", "translate(" + pos[n].x + "," + pos[n].y + ")");
      });
    }

    /* per-step styling (colors, ranks, root loops) — not animated */
    function styleNodes(step) {
      NODES.forEach(function (n) {
        var node = ng[n];
        node.rTx.textContent = String(step.RK[n]);
        var isRoot = step.P[n] === n;
        node.loop.setAttribute("opacity", isRoot ? 1 : 0);
        var onPath = step.path.indexOf(n) !== -1;
        var isChanged = step.changed.indexOf(n) !== -1;
        /* root gets a slightly deeper fill so the "name of the set" stands out */
        node.circ.setAttribute("fill", isRoot ? C.blueDk : C.blue);
        if (onPath) {
          node.ring.setAttribute("stroke", C.clay);
          node.ring.setAttribute("opacity", 1);
        } else if (isChanged) {
          node.ring.setAttribute("stroke", C.sage);
          node.ring.setAttribute("opacity", 1);
        } else {
          node.ring.setAttribute("opacity", 0);
        }
      });
    }

    function renderSets(step) {
      var groups = {};
      NODES.forEach(function (n) {
        /* find root by walking snapshot parents */
        var r = n, guard = 0;
        while (step.P[r] !== r && guard < 20) { r = step.P[r]; guard += 1; }
        (groups[r] = groups[r] || []).push(n);
      });
      setsRow.innerHTML = "";
      var lbl = document.createElement("span");
      lbl.textContent = "קבוצות זרות:";
      lbl.style.cssText = "font-weight:700;font-size:.82rem;color:" + C.ink + ";";
      setsRow.appendChild(lbl);
      Object.keys(groups).sort(function (a, b) {
        return NODES.indexOf(a) - NODES.indexOf(b);
      }).forEach(function (r) {
        var members = groups[r].sort(function (a, b) { return NODES.indexOf(a) - NODES.indexOf(b); });
        var chip = document.createElement("span");
        chip.dir = "ltr";
        chip.style.cssText = "background:" + C.surface + ";border:1.5px solid " + C.line +
          ";border-radius:99px;padding:2px 10px;font-size:.8rem;font-family:ui-monospace,monospace;" +
          "color:" + C.ink + ";";
        chip.innerHTML = "{ " + members.map(function (m) {
          return m === r ? '<b style="color:' + C.blueDk + '">' + m + '</b>' : m;
        }).join(", ") + " }";
        setsRow.appendChild(chip);
      });
    }

    function renderTable(step, prev) {
      NODES.forEach(function (n) {
        var pChanged = !prev || prev.P[n] !== step.P[n];
        var rChanged = !prev || prev.RK[n] !== step.RK[n];
        cellsP[n].textContent = step.P[n];
        cellsR[n].textContent = String(step.RK[n]);
        cellsP[n].style.color = step.P[n] === n ? C.blueDk : C.ink;
        cellsP[n].style.fontWeight = step.P[n] === n ? "800" : "600";
        cellsP[n].style.background = pChanged ? "rgba(124,152,133,0.28)" : "transparent";
        cellsR[n].style.background = rChanged ? "rgba(201,162,75,0.28)" : "transparent";
      });
    }

    function renderPanel(step) {
      panel.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px">' +
          '<span dir="ltr" style="background:' + step.color + ';color:#fff;font-weight:700;' +
            'font-size:.72rem;padding:2px 10px;border-radius:99px">' + step.badge + '</span>' +
          '<b style="font-size:1rem;color:' + C.ink + '">' + step.title + '</b>' +
        '</div><div>' + step.body + '</div>';
    }

    function renderChips() {
      chips.forEach(function (b, i) {
        var active = i === idx, done = i < idx;
        var col = STEPS[i].color;
        b.setAttribute("aria-selected", active ? "true" : "false");
        if (active) { b.style.background = col; b.style.color = "#fff"; b.style.borderColor = col; }
        else if (done) { b.style.background = C.surface; b.style.color = C.ink; b.style.borderColor = col; }
        else { b.style.background = C.surface2; b.style.color = C.inkSoft; b.style.borderColor = C.line; }
      });
    }

    function pulse(step) {
      if (reducedMotion()) return;
      step.changed.concat(step.path).forEach(function (n) {
        var ring = ng[n] && ng[n].ring;
        if (ring && ring.animate) {
          ring.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 340 });
        }
      });
    }

    /* =====================================================================
       Navigation with a soft position transition between forest states.
       ===================================================================== */
    function stopRaf() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

    function goto(n) {
      n = clamp(n, 0, STEPS.length - 1);
      idx = n;
      var step = STEPS[idx];
      var prev = idx > 0 ? STEPS[idx - 1] : null;
      var target = computeLayout(step.P);

      /* synchronous UI */
      styleNodes(step);
      renderSets(step);
      renderTable(step, prev);
      renderPanel(step);
      renderChips();
      btnPrev.disabled = idx === 0;
      btnNext.disabled = idx === STEPS.length - 1;

      stopRaf();
      if (!curPos || reducedMotion()) {
        curPos = target;
        placeNodes(curPos);
        drawEdges(curPos, step);
        pulse(step);
        return;
      }
      var from = {};
      NODES.forEach(function (k) { from[k] = { x: curPos[k].x, y: curPos[k].y }; });
      var t0 = null, DUR = 460;
      function frame(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min(1, (ts - t0) / DUR);
        var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        var now = {};
        NODES.forEach(function (k) { now[k] = interp(from[k], target[k], e); });
        placeNodes(now);
        drawEdges(now, step);
        if (p < 1) { rafId = requestAnimationFrame(frame); }
        else { rafId = null; curPos = target; }
      }
      rafId = requestAnimationFrame(frame);
      pulse(step);
    }

    /* ---------- autoplay ---------- */
    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      if (idx >= STEPS.length - 1) goto(0);
      btnPlay.innerHTML = "⏸ השהה";
      btnPlay.classList.add("primary");
      var delay = reducedMotion() ? 1900 : 2500;
      autoTimer = setInterval(function () {
        if (idx >= STEPS.length - 1) { stopAuto(); return; }
        goto(idx + 1);
      }, delay);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      btnPlay.innerHTML = "▶ הפעל";
      btnPlay.classList.remove("primary");
    }

    /* keyboard (RTL-aware: Right = prev, Left = next) */
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { stopAuto(); goto(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { stopAuto(); goto(idx + 1); e.preventDefault(); }
      else if (e.key === "Home") { stopAuto(); goto(0); e.preventDefault(); }
      else if (e.key === "End") { stopAuto(); goto(STEPS.length - 1); e.preventDefault(); }
    });

    /* initial paint */
    goto(0);
  }

  /* =====================================================================
     boot — mount every instance; never throw.
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
