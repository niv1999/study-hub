/* =====================================================================
   search-stepper.js — Module 04 "חיפושים לא מיודעים" (BFS/DFS/IDS/UCS)
   Grounded in _notes/uninformed-part1.md + uninformed-part2.md — the
   lecturer's own Romania subgraph (9 cities out of the full AIMA map,
   exactly the cities used in her BFS run, pages 7-14):
     Arad, Zerind, Oradea, Sibiu, Timisoara, Lugoj, Fagaras,
     Rimnicu Vilcea, Bucharest — with the exact edge weights (עמ' 7/54).
   Tie-break: alphabetical (as in the lecture's BFS/DFS runs).

   Verified against the notes, step for step:
     BFS  — Arad,Sibiu,Timisoara,Zerind,Fagaras dequeued, Bucharest found
            as a child of Fagaras (early goal test) — עמ' 8-14.
     DFS  — Arad,Sibiu,Fagaras,Bucharest (lexicographic run) — עמ' 34.
     IDS  — limit 0,1 cutoff; limit 2 matches the DLS table on עמ' 54-55
            EXACTLY (Arad,Sibiu,Fagaras,Oradea,RimVilcea,Timisoara,Lugoj,
            Zerind,Oradea again); limit 3 finds Bucharest at depth 3,
            matching the handwritten example on עמ' 67.
     UCS  — pop order/g: Arad0,Zerind75,Timisoara118,Sibiu140,Oradea146,
            RimVilcea220,Lugoj229,Fagaras239,Bucharest450 — same mechanics
            (open sorted by g, closed-list rejection, decrease-key) as the
            full-map run on עמ' 81-94, restricted to this subgraph.

   Self-contained IIFE. Hand-authored SVG + DOM. No external deps. Colors
   use only the site's CSS custom properties (var(--accent) etc.) so both
   themes work. RTL Hebrew UI; LTR graph/city names. Steps are precomputed
   (pure data) so navigation is trivial and deterministic.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "search-stepper";
  var SVGNS = "http://www.w3.org/2000/svg";
  var START = "Arad", GOAL = "Bucharest";

  var NODES = {
    Oradea: { abbr: "Ora", full: "Oradea", x: 170, y: 35 },
    Zerind: { abbr: "Zer", full: "Zerind", x: 65, y: 115 },
    Arad: { abbr: "Arad", full: "Arad", x: 65, y: 235 },
    Timisoara: { abbr: "Tim", full: "Timisoara", x: 65, y: 350 },
    Lugoj: { abbr: "Lug", full: "Lugoj", x: 200, y: 350 },
    Sibiu: { abbr: "Sib", full: "Sibiu", x: 290, y: 150 },
    RimnicuVilcea: { abbr: "Rim", full: "Rimnicu Vilcea", x: 290, y: 275 },
    Fagaras: { abbr: "Fag", full: "Fagaras", x: 440, y: 90 },
    Bucharest: { abbr: "Buc", full: "Bucharest", x: 555, y: 210 }
  };
  var EDGES = [
    ["Oradea", "Zerind", 71], ["Oradea", "Sibiu", 151], ["Zerind", "Arad", 75],
    ["Arad", "Sibiu", 140], ["Arad", "Timisoara", 118], ["Sibiu", "Fagaras", 99],
    ["Sibiu", "RimnicuVilcea", 80], ["Timisoara", "Lugoj", 111], ["Fagaras", "Bucharest", 211]
  ];
  var ADJ = {};
  Object.keys(NODES).forEach(function (n) { ADJ[n] = []; });
  EDGES.forEach(function (e) { ADJ[e[0]].push(e[1]); ADJ[e[1]].push(e[0]); });
  Object.keys(ADJ).forEach(function (n) { ADJ[n].sort(); });

  function full(n) { return NODES[n].full; }
  function W(u, v) {
    for (var i = 0; i < EDGES.length; i++) {
      var e = EDGES[i];
      if ((e[0] === u && e[1] === v) || (e[0] === v && e[1] === u)) return e[2];
    }
    return null;
  }
  function eid(u, v) { return u < v ? u + "|" + v : v + "|" + u; }
  function ltr(s) { return '<span dir="ltr">' + s + "</span>"; }
  function se(tag, attrs, parent) {
    var el = document.createElementNS(SVGNS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function ce(tag, cls, parent, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  }

  /* =====================================================================
     STEP ENGINES — each runs the real algorithm and snapshots pure state.
     ===================================================================== */
  function genBFS() {
    var reached = {}; reached[START] = true;
    var queue = [START], visitedOrder = [], steps = [];
    function snap(o) {
      var s = {
        current: null, touchedEdges: [], done: false, roundLabel: null, phase: "expand",
        frontier: queue.map(function (n) { return { node: n }; }),
        frontierKind: "queue", visited: visitedOrder.slice()
      };
      for (var k in o) s[k] = o[k];
      steps.push(s);
    }
    snap({
      phase: "init", title: "אתחול — התור מכיל את " + ltr(START),
      body: "מתחילים מ-<b>" + ltr(START) + "</b> (המקור). התור (FIFO) מכיל רק אותו, וקבוצת <b>reached</b> " +
        "(מצבים שכבר הושגו) מכילה גם היא רק אותו. כל שכן שנוצר נבדק מיד במבחן המטרה — <b>בעת היצירה</b> " +
        "(early goal test), עוד לפני שהוא נכנס לתור."
    });
    while (queue.length) {
      var u = queue.shift();
      visitedOrder.push(u);
      var gen = [], skip = [], touched = [], goalHit = false;
      for (var i = 0; i < ADJ[u].length; i++) {
        var v = ADJ[u][i];
        if (reached[v]) { skip.push(v); touched.push({ u: u, v: v, kind: "skip" }); continue; }
        reached[v] = true;
        if (v === GOAL) { touched.push({ u: u, v: v, kind: "goal" }); goalHit = true; break; }
        queue.push(v); gen.push(v); touched.push({ u: u, v: v, kind: "gen" });
      }
      var body = "מוציאים מראש התור את <b>" + ltr(full(u)) + "</b> ועוברים על שכניו לפי סדר אלפביתי — " +
        ltr(ADJ[u].join(", ")) + ". ";
      if (gen.length) body += "שכנים חדשים (לא ב-reached) נכנסים לתור: <b>" + ltr(gen.map(full).join(", ")) + "</b>. ";
      if (skip.length) body += "שכנים שכבר ב-reached (מדלגים): <b>" + ltr(skip.map(full).join(", ")) + "</b>. ";
      if (goalHit) body += "<b>Bucharest נוצר — מבחן המטרה מצליח מיד, לפני שהוא אפילו נכנס לתור. החיפוש נעצר!</b>";
      snap({
        phase: goalHit ? "goal" : "expand", current: u, touchedEdges: touched, visited: visitedOrder.slice(),
        done: goalHit, title: goalHit ? "נמצאה המטרה!" : "הוצאה מהתור: " + full(u), body: body
      });
      if (goalHit) break;
    }
    return steps;
  }

  function genDFS() {
    var closed = {}, stack = [START], visitedOrder = [], steps = [];
    function snap(o) {
      var s = {
        current: null, touchedEdges: [], done: false, roundLabel: null, phase: "expand",
        frontier: stack.map(function (n) { return { node: n }; }),
        frontierKind: "stack", visited: visitedOrder.slice()
      };
      for (var k in o) s[k] = o[k];
      steps.push(s);
    }
    snap({
      phase: "init", title: "אתחול — המחסנית מכילה את " + ltr(START),
      body: "מתחילים מ-<b>" + ltr(START) + "</b>. המחסנית (LIFO) מכילה רק אותו. שוברים שוויון בין שכנים " +
        "<b>לפי סדר אלפביתי</b> — כדי שהשכן הראשון אלפביתית ייצא ראשון, דוחפים את השכנים <b>בסדר הפוך</b>."
    });
    while (stack.length) {
      var u = stack.pop();
      if (closed[u]) continue;
      if (u === GOAL) {
        visitedOrder.push(u);
        snap({
          phase: "goal", current: u, done: true, visited: visitedOrder.slice(), title: "נמצאה המטרה!",
          body: "שולפים את <b>" + ltr(full(u)) + "</b> מהמחסנית ומבחן המטרה מצליח (בדיקה <b>בעת השליפה</b>, " +
            "בניגוד ל-BFS שבודק בעת היצירה). החיפוש נעצר!"
        });
        break;
      }
      closed[u] = true; visitedOrder.push(u);
      var toPush = ADJ[u].filter(function (v) { return !closed[v]; });
      var skipped = ADJ[u].filter(function (v) { return closed[v]; });
      var touched = toPush.map(function (v) { return { u: u, v: v, kind: "gen" }; })
        .concat(skipped.map(function (v) { return { u: u, v: v, kind: "skip" }; }));
      for (var i = toPush.length - 1; i >= 0; i--) stack.push(toPush[i]);
      var body = "שולפים את <b>" + ltr(full(u)) + "</b> (אינו המטרה) וסוגרים אותו. שכניו לפי סדר אלפביתי: " +
        ltr(ADJ[u].join(", ")) + ". ";
      if (toPush.length) body += "נדחפים למחסנית (בסדר הפוך, כך ש-<b>" + ltr(full(toPush[0])) +
        "</b> ייצא ראשון): <b>" + ltr(toPush.map(full).join(", ")) + "</b>. ";
      if (skipped.length) body += "שכנים שכבר סגורים (מדלגים): <b>" + ltr(skipped.map(full).join(", ")) + "</b>.";
      snap({ phase: "expand", current: u, touchedEdges: touched, visited: visitedOrder.slice(), title: "פיתוח " + full(u), body: body });
    }
    return steps;
  }

  /* one Depth-Limited-Search round (used standalone conceptually by IDS) */
  function genDLSRound(limit) {
    var closed = {}, stack = [{ node: START, depth: 0 }], visitedOrder = [], steps = [];
    function snap(o) {
      var s = {
        current: null, touchedEdges: [], done: false, phase: "expand", roundLabel: "ℓ = " + limit,
        frontier: stack.map(function (e) { return { node: e.node, meta: e.depth }; }),
        frontierKind: "stack", visited: visitedOrder.slice()
      };
      for (var k in o) s[k] = o[k];
      steps.push(s);
    }
    snap({
      phase: "round-start", title: "איטרציה חדשה — " + ltr("ℓ = " + limit),
      body: "מריצים <b>Depth-Limited Search</b> מ-<b>" + ltr(START) + "</b> עם תקרת עומק " + ltr("ℓ=" + limit) +
        ". קודקוד בעומק " + limit + " ייחשב חסר-ילדים — לא נפתח אותו, גם אם יש לו שכנים."
    });
    var found = false;
    while (stack.length) {
      var top = stack.pop(), u = top.node, depth = top.depth;
      if (u === GOAL) {
        visitedOrder.push(u);
        snap({
          phase: "goal", current: u, done: true, visited: visitedOrder.slice(),
          title: "נמצאה המטרה! (עומק " + depth + ")",
          body: "שולפים את <b>" + ltr(full(u)) + "</b> בעומק <b>" + depth + "</b> — בתוך התקרה — ומבחן המטרה מצליח! " +
            "זו הפעם הראשונה שהעומק מספיק כדי להגיע ל-Bucharest."
        });
        found = true; break;
      }
      if (depth === limit) {
        snap({
          phase: "cutoff-node", current: u, visited: visitedOrder.slice(),
          title: full(u) + " — cutoff (עומק " + depth + ")",
          body: "<b>" + ltr(full(u)) + "</b> נמצא בדיוק בעומק התקרה <b>ℓ=" + limit + "</b> — לא מפתחים אותו הלאה, " +
            "גם אם יש לו שכנים לא-סגורים. מסמנים <b>cuttof</b> (שגיאת הכתיב המקורית מהשקף) וממשיכים."
        });
        continue;
      }
      if (closed[u]) continue;
      closed[u] = true; visitedOrder.push(u);
      var toPush = ADJ[u].filter(function (v) { return !closed[v]; });
      var skipped = ADJ[u].filter(function (v) { return closed[v]; });
      var touched = toPush.map(function (v) { return { u: u, v: v, kind: "gen" }; })
        .concat(skipped.map(function (v) { return { u: u, v: v, kind: "skip" }; }));
      for (var i = toPush.length - 1; i >= 0; i--) stack.push({ node: toPush[i], depth: depth + 1 });
      var body = "שולפים את <b>" + ltr(full(u)) + "</b> בעומק " + depth + " (מתחת לתקרה) — סוגרים אותו ומפתחים " +
        "שכנים לפי סדר אלפביתי: " + ltr(ADJ[u].join(", ")) + ". ";
      if (toPush.length) body += "נדחפים (בעומק " + (depth + 1) + "): <b>" + ltr(toPush.map(full).join(", ")) + "</b>. ";
      if (skipped.length) body += "כבר סגורים (מדלגים): <b>" + ltr(skipped.map(full).join(", ")) + "</b>.";
      snap({ phase: "expand", current: u, touchedEdges: touched, visited: visitedOrder.slice(), title: "פיתוח " + full(u) + " (עומק " + depth + ")", body: body });
    }
    if (!found) {
      snap({
        phase: "round-cutoff", title: "סוף האיטרציה — " + ltr("cutoff"),
        body: "המחסנית התרוקנה בלי למצוא את Bucharest בתוך התקרה <b>ℓ=" + limit + "</b>. התוצאה: <b>cutoff</b> " +
          "(לא failure!) — ייתכן שהפתרון קיים בעומק גדול יותר. IDS מעלה את התקרה ב-1 ומתחיל שוב מ-Arad."
      });
    }
    return { steps: steps, found: found };
  }

  function genIDS() {
    var all = [];
    for (var limit = 0; limit <= 6; limit++) {
      var r = genDLSRound(limit);
      all = all.concat(r.steps);
      if (r.found) break;
    }
    return all;
  }

  function genUCS() {
    var open = [{ node: START, g: 0 }], closed = {}, visitedOrder = [], steps = [];
    function sortOpen() {
      open.sort(function (a, b) { return a.g !== b.g ? a.g - b.g : (a.node < b.node ? -1 : 1); });
    }
    function snap(o) {
      sortOpen();
      var s = {
        current: null, touchedEdges: [], done: false, roundLabel: null, phase: "expand",
        frontier: open.map(function (e) { return { node: e.node, meta: e.g }; }),
        frontierKind: "pq", visited: visitedOrder.slice()
      };
      for (var k in o) s[k] = o[k];
      steps.push(s);
    }
    snap({
      phase: "init", title: "אתחול — " + ltr(START + ": g=0"),
      body: "תור העדיפויות הפתוח (<b>Open</b>) מכיל רק את <b>" + ltr(START) + "</b> עם עלות מסלול <b>g=0</b>. " +
        "UCS תמיד שולף את הקודקוד עם ה-g <b>הנמוך ביותר</b> בתור."
    });
    while (open.length) {
      sortOpen();
      var top = open.shift(), u = top.node, g = top.g;
      if (closed[u]) continue;
      if (u === GOAL) {
        visitedOrder.push(u);
        snap({
          phase: "goal", current: u, done: true, visited: visitedOrder.slice(), title: "נמצאה המטרה! (g=" + g + ")",
          body: "שולפים את <b>" + ltr(full(u)) + "</b> — עכשיו, כשהוא הזול ביותר בתור (<b>g=" + g + "</b>) — ומבחן " +
            "המטרה מצליח. <b>" + ltr(full(u)) + "</b> יכול היה להיווצר מוקדם יותר בעלות גבוהה יותר; UCS בודק מטרה " +
            "רק <b>בעת השליפה</b>, לא בעת היצירה — זו הסיבה שהוא אופטימלי."
        });
        break;
      }
      closed[u] = true; visitedOrder.push(u);
      var touched = [], notes = [];
      ADJ[u].forEach(function (v) {
        if (closed[v]) { touched.push({ u: u, v: v, kind: "skip" }); notes.push(full(v) + " (כבר סגור)"); return; }
        var ng = g + W(u, v), idx = -1;
        for (var i = 0; i < open.length; i++) { if (open[i].node === v) { idx = i; break; } }
        if (idx === -1) { open.push({ node: v, g: ng }); touched.push({ u: u, v: v, kind: "gen" }); notes.push(full(v) + " (g=" + ng + ", חדש)"); }
        else if (ng < open[idx].g) { var old = open[idx].g; open[idx].g = ng; touched.push({ u: u, v: v, kind: "update" }); notes.push(full(v) + " (g יורד מ-" + old + " ל-" + ng + ")"); }
        else { touched.push({ u: u, v: v, kind: "reject" }); notes.push(full(v) + " (g=" + ng + " גרוע מ-" + open[idx].g + ", מתעלמים)"); }
      });
      var body = "שולפים את <b>" + ltr(full(u)) + "</b> (g=" + g + ") — הזול ביותר בתור כרגע — וסוגרים אותו. " +
        "מרפים (<b>Relax</b>) את שכניו לפי סדר אלפביתי: " + ltr(notes.join(", ")) + ".";
      snap({ phase: "expand", current: u, touchedEdges: touched, visited: visitedOrder.slice(), title: "פיתוח " + full(u) + " (g=" + g + ")", body: body });
    }
    return steps;
  }

  var ALGOS = { bfs: genBFS, dfs: genDFS, ids: genIDS, ucs: genUCS };
  var PHASE_LABEL = {
    init: "אתחול", expand: "הרחבה", "cutoff-node": "cutoff", goal: "נמצאה המטרה!",
    "round-start": "סבב חדש", "round-cutoff": "סוף סבב — cutoff"
  };

  /* =====================================================================
     SCENE — the graph is identical across all four algorithms; built once.
     ===================================================================== */
  function buildScene() {
    var VW = 620, VH = 400, R = 24;
    var svg = se("svg", {
      viewBox: "0 0 " + VW + " " + VH, width: "100%", role: "img", direction: "ltr",
      "aria-label": "גרף רומניה המקוצר — תשע ערים, מ-Arad ל-Bucharest"
    });
    svg.style.cssText = "display:block;max-width:" + VW + "px;margin:0 auto";

    var edgeEls = {};
    EDGES.forEach(function (e) {
      var a = NODES[e[0]], b = NODES[e[1]];
      var line = se("line", {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        stroke: "var(--line)", "stroke-width": 2, "stroke-linecap": "round"
      }, svg);
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      se("rect", {
        x: mx - 13, y: my - 10, width: 26, height: 18, rx: 6,
        fill: "var(--surface)", stroke: "var(--line)"
      }, svg);
      var chip = se("text", {
        x: mx, y: my + 4, "text-anchor": "middle",
        "font-size": 11, "font-weight": 700, fill: "var(--ink-soft)"
      }, svg);
      chip.textContent = e[2];
      edgeEls[eid(e[0], e[1])] = { line: line };
    });

    var nodeEls = {};
    Object.keys(NODES).forEach(function (n) {
      var d = NODES[n];
      var g = se("g", {}, svg);
      var ring = se("circle", {
        cx: d.x, cy: d.y, r: R + 5, fill: "none", stroke: "var(--accent)", "stroke-width": 3, opacity: 0
      }, g);
      var circle = se("circle", {
        cx: d.x, cy: d.y, r: R, fill: "var(--surface)", stroke: "var(--line)", "stroke-width": 2.2
      }, g);
      var label = se("text", {
        x: d.x, y: d.y + 4, "text-anchor": "middle", "font-size": 12.5, "font-weight": 800, fill: "var(--ink)"
      }, g);
      label.textContent = d.abbr;
      var caption = se("text", {
        x: d.x, y: d.y + R + 14, "text-anchor": "middle", "font-size": 9.5, "font-weight": 600, fill: "var(--ink-soft)"
      }, g);
      caption.textContent = d.full + (n === START ? " (התחלה)" : n === GOAL ? " (יעד)" : "");
      nodeEls[n] = { circle: circle, label: label, ring: ring };
    });
    return { svg: svg, nodeEls: nodeEls, edgeEls: edgeEls };
  }

  /* pure repaint of the scene for one step */
  function applyScene(scene, step) {
    var frontierSet = {}, visitedSet = {};
    step.frontier.forEach(function (f) { frontierSet[f.node] = true; });
    step.visited.forEach(function (n) { visitedSet[n] = true; });
    Object.keys(NODES).forEach(function (n) {
      var ref = scene.nodeEls[n];
      var fill = "var(--surface)", stroke = "var(--line)", text = "var(--ink)";
      if (step.current === n) { fill = "var(--accent)"; stroke = "var(--accent)"; text = "var(--surface)"; }
      else if (visitedSet[n]) { fill = "color-mix(in srgb, var(--ink-soft) 22%, var(--surface))"; stroke = "var(--ink-soft)"; text = "var(--ink-soft)"; }
      else if (frontierSet[n]) { fill = "color-mix(in srgb, var(--accent) 16%, var(--surface))"; stroke = "var(--accent)"; }
      ref.circle.setAttribute("fill", fill);
      ref.circle.setAttribute("stroke", stroke);
      ref.label.setAttribute("fill", text);
      ref.ring.setAttribute("opacity", step.current === n ? 1 : 0);
    });
    for (var id in scene.edgeEls) {
      var er = scene.edgeEls[id];
      er.line.setAttribute("stroke", "var(--line)");
      er.line.setAttribute("stroke-width", 2);
      er.line.removeAttribute("stroke-dasharray");
    }
    (step.touchedEdges || []).forEach(function (t) {
      var er = scene.edgeEls[eid(t.u, t.v)];
      if (!er) return;
      if (t.kind === "gen" || t.kind === "update" || t.kind === "goal") {
        er.line.setAttribute("stroke", "var(--accent)");
        er.line.setAttribute("stroke-width", t.kind === "goal" ? 4.5 : 3.5);
      } else {
        er.line.setAttribute("stroke", "var(--ink-soft)");
        er.line.setAttribute("stroke-width", 2.5);
        er.line.setAttribute("stroke-dasharray", "4 3");
      }
    });
  }

  /* =====================================================================
     Render one mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-vss-ready") === "1") return;
    mount.setAttribute("data-vss-ready", "1");
    mount.innerHTML = "";

    var wrap = ce("div", "viz-search-stepper", null);
    wrap.setAttribute("tabindex", "0");

    var tabsRow = ce("div", "vss-tabs", wrap);
    tabsRow.setAttribute("role", "tablist");
    var TAB_DEFS = [
      ["bfs", "BFS — תור FIFO"], ["dfs", "DFS — מחסנית LIFO"],
      ["ids", "IDS — העמקה איטרטיבית"], ["ucs", "UCS — עלות אחידה"]
    ];
    var tabEls = {};
    TAB_DEFS.forEach(function (td) {
      var b = ce("button", "vss-tab", tabsRow, td[1]);
      b.type = "button"; b.setAttribute("role", "tab");
      b.addEventListener("click", function () { setAlgo(td[0]); });
      tabEls[td[0]] = b;
    });

    var roundEl = ce("div", "vss-round", wrap);

    var sceneBox = ce("div", "vss-scene", wrap);
    var scene = buildScene();
    sceneBox.appendChild(scene.svg);

    var legend = ce("div", "vss-legend", wrap);
    legend.innerHTML =
      '<span><i class="dot" style="background:var(--accent)"></i>קודקוד נוכחי</span>' +
      '<span><i class="dot" style="background:color-mix(in srgb, var(--accent) 16%, var(--surface));border-color:var(--accent)"></i>ב-frontier</span>' +
      '<span><i class="dot" style="background:color-mix(in srgb, var(--ink-soft) 22%, var(--surface));border-color:var(--ink-soft)"></i>סגור (visited)</span>';

    var panelsRow = ce("div", "vss-panels", wrap);
    var frontierCard = ce("div", "vss-card", panelsRow);
    var frontierTitle = ce("h4", null, frontierCard);
    var frontierChips = ce("div", "vss-chips", frontierCard);
    var visitedCard = ce("div", "vss-card", panelsRow);
    ce("h4", null, visitedCard, "קבוצת הסגורים (Visited)");
    var visitedChips = ce("div", "vss-chips", visitedCard);

    var panel = ce("div", "vss-panel", wrap);
    panel.setAttribute("aria-live", "polite");

    var controls = ce("div", "viz-controls", wrap);
    var btnPrev = mkBtn("→ הקודם", function () { go(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { go(idx + 1); }); btnNext.classList.add("primary");
    var btnReset = mkBtn("↺ אתחול", function () { go(0); });
    [btnPrev, btnNext, btnReset].forEach(function (b) { controls.appendChild(b); });
    var counter = ce("span", null, controls);
    counter.style.cssText = "margin-inline-start:auto;font-weight:700;color:var(--ink-soft);font-size:.85rem;align-self:center";

    mount.appendChild(wrap);

    function mkBtn(label, fn) {
      var b = ce("button", "viz-btn", null, label);
      b.type = "button";
      b.addEventListener("click", fn);
      return b;
    }

    var steps = [], idx = 0;

    function emptyChip(container) { ce("span", "vss-chip empty", container, "∅ ריק"); }
    function updateFrontier(step) {
      frontierTitle.textContent = step.frontierKind === "queue" ? "התור (FIFO) — Q"
        : step.frontierKind === "stack" ? "המחסנית (LIFO)" : "תור העדיפויות (ממוין לפי g)";
      frontierChips.innerHTML = "";
      if (!step.frontier.length) { emptyChip(frontierChips); return; }
      var frontIdx = step.frontierKind === "stack" ? step.frontier.length - 1 : 0;
      step.frontier.forEach(function (f, i) {
        var lbl = NODES[f.node].abbr;
        if (f.meta != null) lbl += step.frontierKind === "pq" ? (":" + f.meta) : (" d" + f.meta);
        var c = ce("span", "vss-chip" + (i === frontIdx ? " front" : ""), frontierChips, lbl);
        c.title = NODES[f.node].full;
      });
    }
    function updateVisited(step) {
      visitedChips.innerHTML = "";
      if (!step.visited.length) { emptyChip(visitedChips); return; }
      step.visited.forEach(function (n) {
        var c = ce("span", "vss-chip", visitedChips, NODES[n].abbr);
        c.title = NODES[n].full;
      });
    }
    function updateRound(step) { roundEl.textContent = step.roundLabel ? ("סבב נוכחי: " + step.roundLabel) : ""; }
    function updatePanel(step) {
      panel.innerHTML = '<span class="vss-badge">' + (PHASE_LABEL[step.phase] || "") + "</span><b>" + step.title +
        '</b><div style="margin-top:6px">' + step.body + "</div>";
    }
    function go(n) {
      idx = Math.max(0, Math.min(steps.length - 1, n));
      var step = steps[idx];
      applyScene(scene, step);
      updateFrontier(step); updateVisited(step); updateRound(step); updatePanel(step);
      counter.textContent = "שלב " + (idx + 1) + " / " + steps.length;
      btnPrev.disabled = idx === 0;
      btnNext.disabled = idx === steps.length - 1;
    }
    function setAlgo(key) {
      steps = ALGOS[key]();
      idx = 0;
      Object.keys(tabEls).forEach(function (k) { tabEls[k].setAttribute("aria-selected", k === key ? "true" : "false"); });
      go(0);
    }

    wrap.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { go(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { go(idx + 1); e.preventDefault(); }
      else if (e.key === "Home") { go(0); e.preventDefault(); }
      else if (e.key === "End") { go(steps.length - 1); e.preventDefault(); }
    });

    setAlgo("bfs");
  }

  /* =====================================================================
     boot — mount all instances; never throw; graceful if absent.
     ===================================================================== */
  function injectStyle() {
    var css = ".viz-search-stepper{direction:rtl}" +
      ".viz-search-stepper .vss-tabs{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:.7rem}" +
      ".viz-search-stepper .vss-tab{font:inherit;font-size:.86rem;font-weight:700;color:var(--ink);" +
      "background:var(--surface-2);border:1.5px solid var(--line);border-radius:99px;padding:.4rem 1.05rem;cursor:pointer}" +
      ".viz-search-stepper .vss-tab:hover{border-color:var(--accent)}" +
      '.viz-search-stepper .vss-tab[aria-selected="true"]{background:var(--accent);color:var(--surface);border-color:var(--accent)}' +
      ".viz-search-stepper .vss-round{min-height:1.3em;text-align:center;font-size:.85rem;font-weight:700;color:var(--accent);margin-bottom:.4rem}" +
      ".viz-search-stepper .vss-scene{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:8px 4px}" +
      ".viz-search-stepper .vss-legend{display:flex;flex-wrap:wrap;gap:.4rem 1rem;justify-content:center;margin-top:6px;font-size:.74rem;color:var(--ink-soft)}" +
      ".viz-search-stepper .vss-legend .dot{width:11px;height:11px;border-radius:50%;display:inline-block;margin-inline-end:5px;border:1.5px solid transparent;vertical-align:middle}" +
      ".viz-search-stepper .vss-panels{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px}" +
      ".viz-search-stepper .vss-card{flex:1 1 240px;min-width:220px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 12px}" +
      ".viz-search-stepper .vss-card h4{margin:0 0 8px;font-size:.8rem;color:var(--ink-soft);font-weight:700}" +
      ".viz-search-stepper .vss-chips{display:flex;flex-wrap:wrap;gap:6px;direction:ltr;min-height:30px;align-items:center}" +
      ".viz-search-stepper .vss-chip{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:30px;" +
      "padding:0 8px;border-radius:8px;font-weight:700;font-size:.8rem;border:1.5px solid var(--line);background:var(--surface-2);color:var(--ink)}" +
      ".viz-search-stepper .vss-chip.front{background:var(--accent);color:var(--surface);border-color:var(--accent)}" +
      ".viz-search-stepper .vss-chip.empty{color:var(--ink-soft);border-style:dashed;font-weight:600}" +
      ".viz-search-stepper .vss-panel{margin-top:12px;background:var(--surface-2);border:1px solid var(--line);border-radius:12px;" +
      "padding:12px 14px;min-height:92px;line-height:1.7;font-size:.9rem;color:var(--ink)}" +
      ".viz-search-stepper .vss-badge{display:inline-block;background:var(--accent);color:var(--surface);font-weight:700;" +
      "font-size:.72rem;padding:2px 10px;border-radius:99px;margin-inline-end:8px}";
    var style = document.createElement("style");
    style.setAttribute("data-vss-style", "1");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function boot() {
    try {
      var mounts = document.querySelectorAll('[data-viz="' + VIZ_ID + '"]');
      if (!mounts || !mounts.length) return;
      if (!document.querySelector("style[data-vss-style]")) injectStyle();
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
