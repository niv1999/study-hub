/* =====================================================================
   bfs-dfs-explorer.js  —  Module 02 "חזרה על גרפים — ייצוגים, BFS, DFS"
   Grounded in _notes/01b-graph-review.md — the EXACT lecture examples so
   students recognize them from class (שקד זוהר, lec-graph-review.pdf).

   ── DFS example (directed, עמ' 16–31) ──────────────────────────────
     Vertices: A,B,C (top)  D,E,F (bottom)
     Edges:  A→B, A→D, D→B, B→E, C→E, C→F, E→D
     Adjacency (order reproduces the lecture's run):
       A:[B,D]  B:[E]  C:[E,F]  D:[B]  E:[D]  F:[]
     DFS(G) outer order: A,B,C,D,E,F
     Final d/f  :  A=1/8  B=2/7  E=3/6  D=4/5  C=9/12  F=10/11
     Edge class :  tree {A→B,B→E,E→D,C→F} · back {D→B}
                   forward {A→D} · cross {C→E}

   ── BFS example (undirected, CLRS classic, עמ' 34–61) ──────────────
     Vertices: r,s,t,u (top)  v,w,x,y (bottom)   Source s.
     Edges: r–s, r–v, s–w, t–u, t–w, t–x, u–x, u–y, w–x, x–y
     Adjacency (order reproduces the lecture's queue):
       r:[s,v] s:[w,r] t:[w,u,x] u:[t,x,y] v:[r] w:[s,t,x] x:[w,t,u,y] y:[u,x]
     Dequeue order: s,w,r,t,x,v,u,y
     Final d (מרחק מ-s): s=0 · w=1,r=1 · t=2,x=2,v=2 · u=3,y=3

   Self-contained IIFE. Hand-authored SVG + DOM. No external deps.
   Cream design tokens hardcoded (CONTRACT §2). RTL Hebrew captions,
   English/LTR algorithm identifiers. prefers-reduced-motion respected.
   Works over http:// and file://. Never throws; graceful if no mount.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "bfs-dfs-explorer";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design palette (hardcoded per CONTRACT §2) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",    /* dusty-blue — unit-1 accent */
    clay: "#BE7C5E",
    sage: "#7C9885",    /* tree edge */
    mustard: "#C9A24B", /* forward edge */
    rose: "#C0574E"     /* back edge */
  };

  /* edge-classification colours (lecture convention: tree=ירוק, back=אדום,
     forward=ירוק-בהיר, cross=כחול) */
  var EC = { tree: C.sage, back: C.rose, forward: C.mustard, cross: C.blue };
  var ECHE = { tree: "עץ", back: "אחורה", forward: "קדימה", cross: "חוצה" };
  var NEUTRAL = "#D9CFBE";

  /* node fills by color-state */
  var NODE = {
    white: { fill: C.surface, stroke: "#CFC1A9", text: C.ink, sub: C.inkSoft },
    gray: { fill: "#BCB3A4", stroke: "#8E8676", text: C.ink, sub: "#4C463D" },
    black: { fill: C.ink, stroke: C.ink, text: "#FFFFFF", sub: "#E7DECF" }
  };

  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function clone(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }
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
     GRAPH DEFINITIONS (exact lecture examples)
     ===================================================================== */
  var GRAPHS = {
    dfs: {
      directed: true,
      order: ["A", "B", "C", "D", "E", "F"],
      pos: { /* 3 cols × 2 rows */
        A: [0, 0], B: [1, 0], C: [2, 0],
        D: [0, 1], E: [1, 1], F: [2, 1]
      },
      cols: 3,
      adj: { A: ["B", "D"], B: ["E"], C: ["E", "F"], D: ["B"], E: ["D"], F: [] },
      edges: [["A", "B"], ["A", "D"], ["D", "B"], ["B", "E"], ["C", "E"], ["C", "F"], ["E", "D"]]
    },
    bfs: {
      directed: false,
      order: ["r", "s", "t", "u", "v", "w", "x", "y"],
      pos: { /* 4 cols × 2 rows */
        r: [0, 0], s: [1, 0], t: [2, 0], u: [3, 0],
        v: [0, 1], w: [1, 1], x: [2, 1], y: [3, 1]
      },
      cols: 4,
      source: "s",
      adj: {
        r: ["s", "v"], s: ["w", "r"], t: ["w", "u", "x"], u: ["t", "x", "y"],
        v: ["r"], w: ["s", "t", "x"], x: ["w", "t", "u", "y"], y: ["u", "x"]
      },
      edges: [["r", "s"], ["r", "v"], ["s", "w"], ["t", "u"], ["t", "w"],
              ["t", "x"], ["u", "x"], ["u", "y"], ["w", "x"], ["x", "y"]]
    }
  };

  function dkey(u, v) { return u + ">" + v; }              /* directed key   */
  function ukey(a, b) { return a < b ? a + "-" + b : b + "-" + a; } /* undirected */

  /* =====================================================================
     STEP GENERATION — runs the REAL algorithm and snapshots each action.
     ===================================================================== */
  function genDFS() {
    var G = GRAPHS.dfs;
    var color = {}, d = {}, f = {}, pi = {};
    G.order.forEach(function (v) { color[v] = "white"; d[v] = null; f[v] = null; pi[v] = null; });
    var edgeClass = {}, steps = [], stack = [], time = 0;

    function snap(o) {
      steps.push(Object.assign({
        colors: clone(color), d: clone(d), f: clone(f), pi: clone(pi),
        edgeClass: clone(edgeClass), container: stack.slice(), containerKind: "stack"
      }, o));
    }
    function visit(u, root) {
      color[u] = "gray"; time++; d[u] = time; stack.push(u);
      snap({
        badge: root ? "עץ חדש" : "discover", badgeColor: C.sage, current: u, activeEdge: null,
        title: (root ? "שורש חדש ביער: גילוי " : "גילוי ") + u + " — d[" + u + "]=" + time,
        body: (root
          ? "לולאת <b dir=\"ltr\">DFS(G)</b> מצאה קדקוד לבן חדש ⇒ מתחילים ממנו עץ עומק חדש ביער. "
          : "") +
          "צובעים את <b>" + u + "</b> אפור (<span dir=\"ltr\">GRAY</span> — \"בעבודה\"), מקדמים " +
          "<span dir=\"ltr\">time</span> ורושמים <span dir=\"ltr\">d[" + u + "]=" + time + "</span>. " +
          "<b>" + u + "</b> נכנס למחסנית הרקורסיה."
      });
      var A = G.adj[u];
      for (var i = 0; i < A.length; i++) {
        var v = A[i], key = dkey(u, v);
        if (color[v] === "white") {
          pi[v] = u; edgeClass[key] = "tree";
          snap({
            badge: "tree edge", badgeColor: EC.tree, current: u, activeEdge: key, activeType: "tree",
            title: "קשת עץ " + u + "→" + v,
            body: "בודקים את הקשת <span dir=\"ltr\">" + u + "→" + v + "</span>: הקדקוד <b>" + v +
              "</b> לבן ⇒ זו <b>קשת עץ</b> (<span dir=\"ltr\">tree edge</span>). קובעים " +
              "<span dir=\"ltr\">π[" + v + "]=" + u + "</span> ויורדים לעומק — קריאה רקורסיבית " +
              "<span dir=\"ltr\">DFS-VISIT(" + v + ")</span>."
          });
          visit(v, false);
        } else if (color[v] === "gray") {
          edgeClass[key] = "back";
          snap({
            badge: "back edge", badgeColor: EC.back, current: u, activeEdge: key, activeType: "back",
            title: "קשת אחורה " + u + "→" + v,
            body: "הקשת <span dir=\"ltr\">" + u + "→" + v + "</span>: <b>" + v + "</b> אפור (אב־קדמון " +
              "שנמצא כרגע במחסנית) ⇒ <b>קשת אחורה</b> (<span dir=\"ltr\">back edge</span>). " +
              "קשת אחורה מעידה על <b>מעגל</b> בגרף."
          });
        } else { /* black */
          var type = d[u] < d[v] ? "forward" : "cross";
          edgeClass[key] = type;
          snap({
            badge: type + " edge", badgeColor: EC[type], current: u, activeEdge: key, activeType: type,
            title: (type === "forward" ? "קשת קדימה " : "קשת חוצה ") + u + "→" + v,
            body: "הקשת <span dir=\"ltr\">" + u + "→" + v + "</span>: <b>" + v + "</b> שחור" +
              (type === "forward"
                ? " ו־<span dir=\"ltr\">d[" + v + "]=" + d[v] + " &gt; d[" + u + "]=" + d[u] + "</span> " +
                  "(צאצא שכבר הסתיים) ⇒ <b>קשת קדימה</b> (<span dir=\"ltr\">forward edge</span>)."
                : " ו־<span dir=\"ltr\">d[" + v + "]=" + d[v] + " &lt; d[" + u + "]=" + d[u] + "</span> " +
                  "(קדקוד בעץ אחר ביער) ⇒ <b>קשת חוצה</b> (<span dir=\"ltr\">cross edge</span>).")
          });
        }
      }
      color[u] = "black"; time++; f[u] = time; stack.pop();
      snap({
        badge: "finish", badgeColor: C.ink, current: u, activeEdge: null,
        title: "סיום " + u + " — f[" + u + "]=" + time,
        body: "כל שכני <b>" + u + "</b> טופלו ⇒ צובעים אותו שחור (<span dir=\"ltr\">BLACK</span>), " +
          "מקדמים <span dir=\"ltr\">time</span> ורושמים <span dir=\"ltr\">f[" + u + "]=" + time + "</span>. " +
          "<b>" + u + "</b> יוצא מהמחסנית — הקטע <span dir=\"ltr\">[d,f]=[" + d[u] + "," + time + "]</span> נסגר."
      });
    }
    for (var i = 0; i < G.order.length; i++) {
      if (color[G.order[i]] === "white") visit(G.order[i], true);
    }
    return steps;
  }

  function genBFS() {
    var G = GRAPHS.bfs;
    var color = {}, dist = {}, pi = {};
    G.order.forEach(function (v) { color[v] = "white"; dist[v] = Infinity; pi[v] = null; });
    var edgeClass = {}, steps = [], Q = [];
    var s = G.source;

    function snap(o) {
      steps.push(Object.assign({
        colors: clone(color), dist: clone(dist), pi: clone(pi),
        edgeClass: clone(edgeClass), container: Q.slice(), containerKind: "queue"
      }, o));
    }
    color[s] = "gray"; dist[s] = 0; Q.push(s);
    snap({
      badge: "init", badgeColor: C.blue, current: s, activeEdge: null,
      title: "אתחול — המקור s",
      body: "אתחול: כל קדקוד לבן עם <span dir=\"ltr\">d=∞</span> ו־<span dir=\"ltr\">π=NIL</span>. " +
        "המקור <b>s</b> נצבע אפור, <span dir=\"ltr\">d[s]=0</span>, ומוכנס לתור. " +
        "<span dir=\"ltr\">Q=[s]</span>."
    });
    while (Q.length) {
      var u = Q.shift();
      var A = G.adj[u], discovered = [], skipped = [];
      for (var i = 0; i < A.length; i++) {
        var v = A[i];
        if (color[v] === "white") {
          color[v] = "gray"; dist[v] = dist[u] + 1; pi[v] = u;
          edgeClass[ukey(u, v)] = "tree";
          Q.push(v); discovered.push(v);
        } else {
          skipped.push(v);
        }
      }
      color[u] = "black";
      var body = "מוציאים את <b>" + u + "</b> מראש התור ועוברים על רשימת השכנים " +
        "<span dir=\"ltr\">Adj[" + u + "]</span>. ";
      if (discovered.length) {
        body += "שכנים לבנים שהתגלו: <b dir=\"ltr\">" + discovered.join(", ") + "</b> — כל אחד נצבע " +
          "אפור, מקבל <span dir=\"ltr\">d=" + (dist[u] + 1) + "</span> ו־<span dir=\"ltr\">π=" + u +
          "</span>, ונכנס לזנב התור. ";
      } else {
        body += "אין שכנים לבנים. ";
      }
      if (skipped.length) {
        body += "שכנים שכבר נתגלו (מדלגים): <b dir=\"ltr\">" + skipped.join(", ") + "</b>. ";
      }
      body += "לבסוף <b>" + u + "</b> נצבע שחור (<span dir=\"ltr\">BLACK</span>).";
      snap({
        badge: "dequeue " + u, badgeColor: C.blue, current: u, activeEdge: null,
        discovered: discovered.slice(),
        title: "הוצאת " + u + " מהתור",
        body: body
      });
    }
    return steps;
  }

  /* =====================================================================
     SCENE — hand-authored SVG graph.  Rebuilt per mode.
     ===================================================================== */
  function buildScene(mode) {
    var G = GRAPHS[mode];
    var W = 520, H = 288;
    var mL = 74, mR = 74, mT = 74, gapY = 120;
    var cols = G.cols;
    var gapX = (W - mL - mR) / (cols - 1);
    var R = 24;

    function cx(v) { return mL + G.pos[v][0] * gapX; }
    function cy(v) { return mT + G.pos[v][1] * gapY; }

    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H, width: "100%",
      role: "img", direction: "ltr",
      "aria-label": mode === "dfs" ? "גרף הדוגמה של DFS מההרצאה" : "גרף ה-BFS הקלאסי מ-CLRS"
    });
    svg.style.display = "block";
    svg.style.maxWidth = W + "px";
    svg.style.margin = "0 auto";

    /* directed arrowhead markers (one per colour so heads match edge state) */
    var defs = el("defs");
    var markers = { neutral: NEUTRAL, tree: EC.tree, back: EC.back, forward: EC.forward, cross: EC.cross };
    for (var mk in markers) {
      var m = el("marker", {
        id: "bde-arr-" + mode + "-" + mk, viewBox: "0 0 10 10",
        refX: "8.5", refY: "5", markerWidth: "8", markerHeight: "8", orient: "auto-start-reverse"
      });
      m.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", fill: markers[mk] }));
      defs.appendChild(m);
    }
    svg.appendChild(defs);

    /* edges (drawn first, under nodes) */
    var edgeRefs = {};
    G.edges.forEach(function (e) {
      var a = e[0], b = e[1];
      var x1 = cx(a), y1 = cy(a), x2 = cx(b), y2 = cy(b);
      var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / len, uy = dy / len;
      var sx = x1 + ux * R, sy = y1 + uy * R;
      var exx = x2 - ux * (R + (G.directed ? 3 : 0));
      var eyy = y2 - uy * (R + (G.directed ? 3 : 0));
      var line = el("line", {
        x1: sx, y1: sy, x2: exx, y2: eyy,
        stroke: NEUTRAL, "stroke-width": 2, "stroke-linecap": "round"
      });
      if (!reducedMotion()) line.style.transition = "stroke .3s, stroke-width .3s, opacity .3s";
      if (G.directed) line.setAttribute("marker-end", "url(#bde-arr-" + mode + "-neutral)");
      svg.appendChild(line);
      var key = G.directed ? dkey(a, b) : ukey(a, b);
      edgeRefs[key] = { line: line, directed: G.directed };
    });

    /* nodes */
    var nodeRefs = {};
    G.order.forEach(function (v) {
      var x = cx(v), y = cy(v);
      var g = el("g", {});
      var ring = el("circle", {
        cx: x, cy: y, r: R + 5, fill: "none",
        stroke: C.blue, "stroke-width": 3, opacity: 0
      });
      if (!reducedMotion()) ring.style.transition = "opacity .25s";
      var circle = el("circle", {
        cx: x, cy: y, r: R, fill: NODE.white.fill,
        stroke: NODE.white.stroke, "stroke-width": 2.2
      });
      if (!reducedMotion()) circle.style.transition = "fill .35s, stroke .35s";
      var letter = txt(x, y - 3, v, {
        "text-anchor": "middle", "font-size": 16, "font-weight": 800, fill: NODE.white.text
      });
      var sub = txt(x, y + 12, "", {
        "text-anchor": "middle", "font-size": 10.5, "font-weight": 600, fill: NODE.white.sub
      });
      g.appendChild(ring); g.appendChild(circle); g.appendChild(letter); g.appendChild(sub);
      svg.appendChild(g);
      nodeRefs[v] = { ring: ring, circle: circle, letter: letter, sub: sub };
    });

    return { svg: svg, nodeRefs: nodeRefs, edgeRefs: edgeRefs, mode: mode };
  }

  /* =====================================================================
     Apply a step's state to the scene (idempotent).
     ===================================================================== */
  function applyScene(scene, step) {
    var mode = scene.mode, G = GRAPHS[mode];

    G.order.forEach(function (v) {
      var ref = scene.nodeRefs[v];
      var st = step.colors[v];
      var p = NODE[st];
      ref.circle.setAttribute("fill", p.fill);
      ref.circle.setAttribute("stroke", p.stroke);
      ref.letter.setAttribute("fill", p.text);
      ref.sub.setAttribute("fill", p.sub);
      /* sub-label */
      if (mode === "dfs") {
        var dv = step.d[v], fv = step.f[v];
        ref.sub.textContent = (dv == null ? "·" : dv) + "/" + (fv == null ? "·" : fv);
      } else {
        var dd = step.dist[v];
        ref.sub.textContent = dd === Infinity ? "∞" : String(dd);
      }
      ref.ring.setAttribute("opacity", step.current === v ? 1 : 0);
    });

    for (var key in scene.edgeRefs) {
      var er = scene.edgeRefs[key];
      var cls = step.edgeClass[key];
      var active = step.activeEdge === key;
      var col = cls ? EC[cls] : NEUTRAL;
      er.line.setAttribute("stroke", col);
      er.line.setAttribute("stroke-width", active ? 4.5 : (cls ? 3.2 : 2));
      er.line.setAttribute("opacity", active ? 1 : (cls ? 0.95 : 0.5));
      if (er.directed) {
        var mk = cls ? cls : "neutral";
        er.line.setAttribute("marker-end", "url(#bde-arr-" + scene.mode + "-" + mk + ")");
      }
    }
  }

  /* =====================================================================
     Render one mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-bde-ready") === "1") return;
    mount.setAttribute("data-bde-ready", "1");
    mount.innerHTML = "";

    var mode = "dfs";
    var steps = [];
    var idx = 0;
    var autoTimer = null;
    var scene = null;

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");
    wrap.style.outline = "none";

    /* ---- algorithm toggle ---- */
    var toggleRow = document.createElement("div");
    toggleRow.className = "viz-controls";
    toggleRow.style.marginBottom = ".7rem";
    var lbl = document.createElement("span");
    lbl.textContent = "אלגוריתם:";
    lbl.style.fontWeight = "700";
    lbl.style.color = C.ink;
    lbl.style.fontSize = ".9rem";
    toggleRow.appendChild(lbl);
    var btnDFS = mkBtn("DFS — סריקת עומק", function () { setMode("dfs"); });
    var btnBFS = mkBtn("BFS — סריקת רוחב", function () { setMode("bfs"); });
    toggleRow.appendChild(btnDFS);
    toggleRow.appendChild(btnBFS);
    wrap.appendChild(toggleRow);

    /* ---- scene box ---- */
    var sceneBox = document.createElement("div");
    sceneBox.style.background = C.surface;
    sceneBox.style.borderRadius = "12px";
    sceneBox.style.border = "1px solid " + C.line;
    sceneBox.style.padding = "6px 4px";
    wrap.appendChild(sceneBox);

    /* ---- legend (edge classes for DFS, colours for both) ---- */
    var legend = document.createElement("div");
    legend.style.display = "flex";
    legend.style.flexWrap = "wrap";
    legend.style.gap = "10px";
    legend.style.margin = "8px 2px 0";
    legend.style.fontSize = ".76rem";
    legend.style.color = C.inkSoft;
    wrap.appendChild(legend);

    /* ---- explanation panel ---- */
    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.background = C.surface2;
    panel.style.border = "1px solid " + C.line;
    panel.style.borderRadius = "12px";
    panel.style.padding = "12px 14px";
    panel.style.marginTop = "12px";
    panel.style.minHeight = "96px";
    panel.style.color = C.ink;
    panel.style.lineHeight = "1.7";
    panel.style.fontSize = ".9rem";
    wrap.appendChild(panel);

    /* ---- bookkeeping grid: table + container ---- */
    var grid = document.createElement("div");
    grid.style.display = "flex";
    grid.style.flexWrap = "wrap";
    grid.style.gap = "12px";
    grid.style.marginTop = "12px";

    var tableWrap = document.createElement("div");
    tableWrap.style.flex = "1 1 300px";
    tableWrap.style.minWidth = "0";
    tableWrap.style.overflowX = "auto";
    var tableCard = document.createElement("div");
    tableCard.style.background = C.surface;
    tableCard.style.border = "1px solid " + C.line;
    tableCard.style.borderRadius = "12px";
    tableCard.style.padding = "10px 12px";
    var tableTitle = document.createElement("div");
    tableTitle.style.fontWeight = "700";
    tableTitle.style.fontSize = ".82rem";
    tableTitle.style.color = C.ink;
    tableTitle.style.marginBottom = "6px";
    tableTitle.textContent = "טבלת הבּוּקקיפינג של האלגוריתם";
    tableCard.appendChild(tableTitle);
    var table = document.createElement("table");
    table.style.borderCollapse = "collapse";
    table.style.width = "100%";
    table.style.fontSize = ".8rem";
    table.style.direction = "ltr";
    tableCard.appendChild(table);
    tableWrap.appendChild(tableCard);

    var contWrap = document.createElement("div");
    contWrap.style.flex = "1 1 220px";
    contWrap.style.minWidth = "0";
    var contCard = document.createElement("div");
    contCard.style.background = C.surface;
    contCard.style.border = "1px solid " + C.line;
    contCard.style.borderRadius = "12px";
    contCard.style.padding = "10px 12px";
    contCard.style.height = "100%";
    contCard.style.boxSizing = "border-box";
    var contTitle = document.createElement("div");
    contTitle.style.fontWeight = "700";
    contTitle.style.fontSize = ".82rem";
    contTitle.style.color = C.ink;
    contTitle.style.marginBottom = "8px";
    contCard.appendChild(contTitle);
    var contEnds = document.createElement("div");
    contEnds.style.display = "flex";
    contEnds.style.justifyContent = "space-between";
    contEnds.style.fontSize = ".7rem";
    contEnds.style.color = C.inkSoft;
    contEnds.style.marginBottom = "4px";
    contEnds.style.direction = "ltr";
    contCard.appendChild(contEnds);
    var contStrip = document.createElement("div");
    contStrip.style.display = "flex";
    contStrip.style.gap = "6px";
    contStrip.style.flexWrap = "wrap";
    contStrip.style.direction = "ltr";
    contStrip.style.minHeight = "38px";
    contStrip.style.alignItems = "center";
    contCard.appendChild(contStrip);
    contWrap.appendChild(contCard);

    grid.appendChild(tableWrap);
    grid.appendChild(contWrap);
    wrap.appendChild(grid);

    /* ---- step controls ---- */
    var controls = document.createElement("div");
    controls.className = "viz-controls";
    controls.style.marginTop = "12px";
    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); go(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); go(idx + 1); });
    btnNext.classList.add("primary");
    var btnPlay = mkBtn("▶ הפעל", function () { toggleAuto(); });
    var btnReset = mkBtn("↺ איפוס", function () { stopAuto(); go(0); });
    var counter = document.createElement("span");
    counter.style.marginInlineStart = "auto";
    counter.style.alignSelf = "center";
    counter.style.fontSize = ".82rem";
    counter.style.fontWeight = "700";
    counter.style.color = C.inkSoft;
    controls.appendChild(btnPrev);
    controls.appendChild(btnNext);
    controls.appendChild(btnPlay);
    controls.appendChild(btnReset);
    controls.appendChild(counter);
    wrap.appendChild(controls);

    mount.appendChild(wrap);

    function mkBtn(label, fn) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn";
      b.innerHTML = label;
      b.addEventListener("click", fn);
      return b;
    }

    /* ---- build legend contents per mode ---- */
    function buildLegend() {
      legend.innerHTML = "";
      function chip(color, he, en, isNode) {
        var s = document.createElement("span");
        s.style.display = "inline-flex";
        s.style.alignItems = "center";
        s.style.gap = "5px";
        var sw = document.createElement("span");
        sw.style.width = isNode ? "13px" : "18px";
        sw.style.height = isNode ? "13px" : "4px";
        sw.style.borderRadius = isNode ? "50%" : "2px";
        sw.style.background = color;
        if (isNode) sw.style.border = "1px solid " + C.line;
        var t = document.createElement("span");
        t.innerHTML = he + (en ? ' <span dir="ltr" style="opacity:.7">(' + en + ')</span>' : "");
        s.appendChild(sw); s.appendChild(t);
        return s;
      }
      /* node colour legend */
      legend.appendChild(chip(NODE.white.fill, "לבן — טרם נסרק", "WHITE", true));
      legend.appendChild(chip(NODE.gray.fill, "אפור — בעבודה", "GRAY", true));
      legend.appendChild(chip(NODE.black.fill, "שחור — הסתיים", "BLACK", true));
      if (mode === "dfs") {
        legend.appendChild(chip(EC.tree, "קשת עץ", "tree", false));
        legend.appendChild(chip(EC.back, "קשת אחורה", "back", false));
        legend.appendChild(chip(EC.forward, "קשת קדימה", "forward", false));
        legend.appendChild(chip(EC.cross, "קשת חוצה", "cross", false));
      } else {
        legend.appendChild(chip(EC.tree, "קשת עץ ה-BFS", "tree", false));
      }
    }

    /* ---- build the bookkeeping table skeleton per mode ---- */
    var cellRefs = {};
    function buildTable() {
      var G = GRAPHS[mode];
      table.innerHTML = "";
      cellRefs = {};
      var rows = mode === "dfs"
        ? [["קדקוד", "head"], ["d", "d"], ["f", "f"], ["π", "pi"], ["צבע", "color"]]
        : [["קדקוד", "head"], ["d", "d"], ["π", "pi"], ["צבע", "color"]];
      rows.forEach(function (rowDef) {
        var tr = document.createElement("tr");
        var th = document.createElement("th");
        th.textContent = rowDef[0];
        th.style.textAlign = "right";
        th.style.padding = "3px 6px";
        th.style.fontWeight = "700";
        th.style.color = C.inkSoft;
        th.style.borderBottom = "1px solid " + C.line;
        th.style.whiteSpace = "nowrap";
        th.style.fontFamily = rowDef[1] === "head" ? "inherit" : "monospace";
        tr.appendChild(th);
        cellRefs[rowDef[1]] = {};
        G.order.forEach(function (v) {
          var td = document.createElement("td");
          td.style.textAlign = "center";
          td.style.padding = "3px 6px";
          td.style.borderBottom = "1px solid " + C.line;
          td.style.minWidth = "26px";
          if (rowDef[1] === "head") {
            td.textContent = v;
            td.style.fontWeight = "800";
            td.style.color = C.ink;
          } else {
            td.style.fontFamily = "monospace";
            td.style.color = C.ink;
          }
          tr.appendChild(td);
          cellRefs[rowDef[1]][v] = td;
        });
        table.appendChild(tr);
      });
    }

    function updateTable(step) {
      var G = GRAPHS[mode];
      G.order.forEach(function (v) {
        if (mode === "dfs") {
          cellRefs.d[v].textContent = step.d[v] == null ? "·" : step.d[v];
          cellRefs.f[v].textContent = step.f[v] == null ? "·" : step.f[v];
        } else {
          cellRefs.d[v].textContent = step.dist[v] === Infinity ? "∞" : step.dist[v];
        }
        cellRefs.pi[v].textContent = step.pi[v] == null ? "–" : step.pi[v];
        var st = step.colors[v];
        var cc = cellRefs.color[v];
        cc.textContent = st === "white" ? "לבן" : st === "gray" ? "אפור" : "שחור";
        cc.style.background = st === "white" ? "transparent" : st === "gray" ? NODE.gray.fill : NODE.black.fill;
        cc.style.color = st === "black" ? "#fff" : C.ink;
        cc.style.fontFamily = "inherit";
        cc.style.borderRadius = "4px";
      });
    }

    function updateContainer(step) {
      var isQueue = step.containerKind === "queue";
      contTitle.innerHTML = isQueue
        ? 'התור <span dir="ltr">Q</span> (מבנה FIFO)'
        : 'מחסנית הרקורסיה <span dir="ltr">(DFS stack)</span>';
      contEnds.innerHTML = isQueue
        ? '<span>← יציאה (Dequeue)</span><span>כניסה (Enqueue) →</span>'
        : '<span>תחתית</span><span>ראש (top) →</span>';
      contStrip.innerHTML = "";
      var arr = step.container;
      if (!arr.length) {
        var em = document.createElement("span");
        em.textContent = isQueue ? "∅  התור ריק" : "∅  ריקה";
        em.style.color = C.inkSoft;
        em.style.fontSize = ".82rem";
        contStrip.appendChild(em);
        return;
      }
      arr.forEach(function (v, i) {
        var cell = document.createElement("span");
        cell.textContent = v;
        cell.style.display = "inline-flex";
        cell.style.alignItems = "center";
        cell.style.justifyContent = "center";
        cell.style.width = "30px";
        cell.style.height = "30px";
        cell.style.borderRadius = "7px";
        cell.style.fontWeight = "800";
        cell.style.fontSize = ".95rem";
        var front = isQueue ? (i === 0) : (i === arr.length - 1);
        cell.style.background = front ? C.blue : C.surface2;
        cell.style.color = front ? "#fff" : C.ink;
        cell.style.border = "1.5px solid " + (front ? C.blue : C.line);
        contStrip.appendChild(cell);
      });
    }

    function renderPanel(step) {
      panel.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px">' +
          '<span style="background:' + step.badgeColor + ';color:#fff;font-weight:700;font-size:.72rem;' +
            'padding:2px 10px;border-radius:99px" dir="ltr">' + step.badge + '</span>' +
          '<b style="font-size:1rem;color:' + C.ink + '">' + step.title + '</b>' +
        '</div>' +
        '<div>' + step.body + '</div>';
    }

    /* ---- navigation ---- */
    function go(n) {
      idx = Math.max(0, Math.min(steps.length - 1, n));
      var step = steps[idx];
      applyScene(scene, step);
      updateTable(step);
      updateContainer(step);
      renderPanel(step);
      counter.textContent = "צעד " + (idx + 1) + " / " + steps.length;
      btnPrev.disabled = (idx === 0);
      btnNext.disabled = (idx === steps.length - 1);
    }

    /* ---- autoplay ---- */
    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      if (idx >= steps.length - 1) go(0);
      btnPlay.innerHTML = "⏸ השהה";
      btnPlay.classList.add("primary");
      var delay = reducedMotion() ? 1400 : 1700;
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

    /* ---- mode switch ---- */
    function setMode(m) {
      stopAuto();
      mode = m;
      steps = (m === "dfs") ? genDFS() : genBFS();
      idx = 0;
      scene = buildScene(m);
      sceneBox.innerHTML = "";
      sceneBox.appendChild(scene.svg);
      buildLegend();
      buildTable();
      btnDFS.classList.toggle("primary", m === "dfs");
      btnBFS.classList.toggle("primary", m === "bfs");
      btnDFS.setAttribute("aria-pressed", m === "dfs" ? "true" : "false");
      btnBFS.setAttribute("aria-pressed", m === "bfs" ? "true" : "false");
      go(0);
    }

    /* keyboard: RTL-aware (Right = prev, Left = next) */
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { stopAuto(); go(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { stopAuto(); go(idx + 1); e.preventDefault(); }
      else if (e.key === "Home") { stopAuto(); go(0); e.preventDefault(); }
      else if (e.key === "End") { stopAuto(); go(steps.length - 1); e.preventDefault(); }
      else if (e.key === " " || e.key === "Enter") {
        if (e.target === wrap) { toggleAuto(); e.preventDefault(); }
      }
    });

    /* initial */
    setMode("dfs");
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
