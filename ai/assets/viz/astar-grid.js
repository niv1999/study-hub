/* =====================================================================
   astar-grid.js — Module 05 "חיפוש מיודע — Greedy Best-First ו-A*"
   Grounded in _notes/informed-part1.md (Russell & Norvig AIMA) — the EXACT
   Romania road-map example (עמ' 6), run twice:

   Graph (10 cities, edges in km): Arad–Zerind 75 · Arad–Sibiu 140 ·
   Arad–Timisoara 118 · Zerind–Oradea 71 · Oradea–Sibiu 151 · Sibiu–Fagaras
   99 · Sibiu–Rimnicu Vilcea 80 · Rimnicu Vilcea–Pitesti 97 · Rimnicu
   Vilcea–Craiova 146 · Pitesti–Craiova 138 · Pitesti–Bucharest 101 ·
   Fagaras–Bucharest 211. hSLD-to-Bucharest: Arad 366 · Bucharest 0 ·
   Craiova 160 · Fagaras 176 · Oradea 380 · Pitesti 100 · Rimnicu Vilcea
   193 · Sibiu 253 · Timisoara 329 · Zerind 374. Adjacency is generated
   alphabetically per node — matches the slides' child order exactly
   (e.g. Sibiu's children always listed Arad, Fagaras, Oradea, Rimnicu
   Vilcea).

   Greedy, f(n)=h(n) (עמ' 8–10): extract order Arad → Sibiu(253) →
   Fagaras(176) → Bucharest(0). Path Arad→Sibiu→Fagaras→Bucharest, cost
   140+99+211 = 450 (not optimal).

   A*, f(n)=g(n)+h(n) (עמ' 16–20): extract order Arad → Sibiu(393) →
   Rimnicu Vilcea(413) → Fagaras(415) → Pitesti(417) → Bucharest(418).
   Key beat (עמ' 19): Bucharest enters the open list via Fagaras with
   f=450 but is NOT selected — Pitesti's f=417 is lower; A* only stops
   when a goal is EXTRACTED, never merely discovered. Path Arad→Sibiu→
   Rimnicu Vilcea→Pitesti→Bucharest, cost 140+80+97+101 = 418 (optimal —
   hSLD is admissible).

   Both runs use simple graph-search with a closed set (no reopening of
   already-expanded nodes) — duplicate frontier entries for the same city
   (e.g. two Bucharest rows in the A* run) are kept un-merged, exactly as
   the lecture's tree diagrams show them.

   Self-contained IIFE, hand-authored inline SVG + DOM, no external deps.
   Colours come ONLY from the site's CSS custom properties (var(--accent),
   var(--surface), var(--surface-2), var(--ink), var(--ink-soft),
   var(--line)) plus color-mix() tints on those tokens, so light/dark
   themes both work. Never throws; graceful if no mount.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "astar-grid";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* =====================================================================
     GRAPH MODEL (exact lecture example)
     ===================================================================== */
  var NODES = ["Arad", "Zerind", "Oradea", "Timisoara", "Sibiu",
    "Fagaras", "RimnicuVilcea", "Pitesti", "Craiova", "Bucharest"];
  var CITY = {
    Arad: "Arad", Zerind: "Zerind", Oradea: "Oradea", Timisoara: "Timisoara",
    Sibiu: "Sibiu", Fagaras: "Fagaras", RimnicuVilcea: "Rimnicu Vilcea",
    Pitesti: "Pitesti", Craiova: "Craiova", Bucharest: "Bucharest"
  };
  var CODE = {
    Arad: "Ar", Zerind: "Ze", Oradea: "Or", Timisoara: "Ti", Sibiu: "Si",
    Fagaras: "Fa", RimnicuVilcea: "RV", Pitesti: "Pi", Craiova: "Cr", Bucharest: "Bu"
  };
  var H = {
    Arad: 366, Zerind: 374, Oradea: 380, Timisoara: 329, Sibiu: 253,
    Fagaras: 176, RimnicuVilcea: 193, Pitesti: 100, Craiova: 160, Bucharest: 0
  };
  var POS = {
    Oradea: [130, 60], Zerind: [55, 160], Arad: [75, 270], Timisoara: [110, 375],
    Sibiu: [255, 185], Fagaras: [440, 105], RimnicuVilcea: [300, 305],
    Craiova: [260, 405], Pitesti: [445, 320], Bucharest: [585, 270]
  };
  var EDGES = [
    ["Arad", "Zerind", 75], ["Arad", "Sibiu", 140], ["Arad", "Timisoara", 118],
    ["Zerind", "Oradea", 71], ["Oradea", "Sibiu", 151],
    ["Sibiu", "Fagaras", 99], ["Sibiu", "RimnicuVilcea", 80],
    ["RimnicuVilcea", "Pitesti", 97], ["RimnicuVilcea", "Craiova", 146],
    ["Pitesti", "Craiova", 138], ["Pitesti", "Bucharest", 101],
    ["Fagaras", "Bucharest", 211]
  ];
  var START = "Arad", GOAL = "Bucharest";
  var GW = 650, GH = 450, R = 22;

  /* --- tiny helpers --- */
  function ltr(s) { return '<span dir="ltr">' + s + "</span>"; }
  function assign(t, s) { for (var k in s) if (s.hasOwnProperty(k)) t[k] = s[k]; return t; }
  function pairId(a, b) { return a < b ? a + "|" + b : b + "|" + a; }
  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  function ce(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function buildGraphModel() {
    var W = {}, ADJ = {};
    NODES.forEach(function (n) { W[n] = {}; ADJ[n] = []; });
    EDGES.forEach(function (e) {
      W[e[0]][e[1]] = e[2]; W[e[1]][e[0]] = e[2];
      ADJ[e[0]].push(e[1]); ADJ[e[1]].push(e[0]);
    });
    NODES.forEach(function (n) { ADJ[n].sort(); });
    return { W: W, ADJ: ADJ };
  }

  /* =====================================================================
     STEP ENGINE — runs the REAL search (graph-search + closed set) and
     snapshots one step per Extract-Min. mode: "greedy" (f=h) | "astar" (f=g+h)
     ===================================================================== */
  function buildSteps(mode) {
    var GM = buildGraphModel(), W = GM.W, ADJ = GM.ADJ;
    var closed = {}, order = [], pi = {}, gFinal = {};
    var frontier = [{ id: 0, node: START, parent: null, g: 0, h: H[START], f: H[START] }];
    var nid = 1, steps = [];

    function openSorted() {
      return frontier.slice().sort(function (a, b) { return (a.f - b.f) || (a.id - b.id); });
    }
    function snap(extra) {
      steps.push(assign({
        closed: assign({}, closed), order: order.slice(), open: openSorted(),
        pi: assign({}, pi), gClosed: assign({}, gFinal)
      }, extra));
    }

    snap({
      phase: "init", current: null, path: null, cost: null,
      title: "אתחול — הרשימה הפתוחה מכילה רק את " + CITY[START],
      body: "הרשימה הפתוחה (Open) מכילה רק את המקור " + ltr(CITY[START]) + ": " +
        ltr("g=0, h=" + H[START] + ", f=" + H[START]) + ". הרשימה הסגורה (Closed) ריקה."
    });

    var reachedGoal = false;
    while (frontier.length && !reachedGoal) {
      frontier.sort(function (a, b) { return (a.f - b.f) || (a.id - b.id); });
      var picked = frontier.shift();
      if (closed[picked.node]) continue; /* stale duplicate, already closed via another entry */
      closed[picked.node] = true; order.push(picked.node);
      pi[picked.node] = picked.parent; gFinal[picked.node] = picked.g;

      if (picked.node === GOAL) {
        reachedGoal = true;
        snap({
          phase: "goal", current: GOAL, path: null, cost: null,
          title: "Extract-Min ← " + CITY[GOAL] + "  (המטרה!)",
          body: "המטרה " + ltr(CITY[GOAL]) + " נשלפת רק עכשיו, ברגע שהיא הפכה למינימלית " +
            "ברשימה הפתוחה (" + ltr("f=" + picked.f) + "). <b>שימו לב</b>: ייתכן ש-" +
            ltr(CITY[GOAL]) + " כבר הופיעה קודם ברשימה הפתוחה בערך גבוה יותר — האלגוריתם " +
            "אינו עוצר כשמטרה <b>נכנסת</b> לרשימה, רק כש<b>היא נבחרת לפיתוח</b>."
        });
        break;
      }

      var kids = [], added = [], pruned = [];
      ADJ[picked.node].forEach(function (v) {
        if (closed[v]) { pruned.push(CITY[v]); return; }
        var g2 = picked.g + W[picked.node][v], h2 = H[v];
        var f2 = mode === "greedy" ? h2 : g2 + h2;
        frontier.push({ id: nid++, node: v, parent: picked.node, g: g2, h: h2, f: f2 });
        added.push(CITY[v] + " (f=" + f2 + ")");
      });

      var body = "Extract-Min שולף את " + ltr(CITY[picked.node]) + " (" + ltr("f=" + picked.f) +
        ") — המינימלי ברשימה הפתוחה כרגע. " + ltr(CITY[picked.node]) + " עובר לרשימה הסגורה. " +
        (added.length ? "שכנים חדשים שנוספו: " + ltr(added.join(", ")) + ". " : "אין שכנים חדשים. ") +
        (pruned.length ? "שכנים שכבר ב-Closed (לא נוספים שוב): " + ltr(pruned.join(", ")) + "." : "");

      snap({
        phase: "expand", current: picked.node, path: null, cost: null,
        title: "Extract-Min ← " + CITY[picked.node] + "  (" + ltr("f=" + picked.f) + ")",
        body: body
      });
    }

    if (reachedGoal) {
      var path = [], cur = GOAL, guard = 0;
      while (cur && guard++ < 14) { path.unshift(cur); cur = pi[cur]; }
      var cost = gFinal[GOAL];
      var pathHe = ltr(path.map(function (n) { return CITY[n]; }).join(" → "));
      var body2;
      if (mode === "greedy") {
        body2 = "המסלול שנמצא: <b>" + pathHe + "</b> בעלות <b>" + ltr(String(cost)) + "</b> ק\"מ. " +
          "Greedy מתעלם לגמרי מ-" + ltr("g(n)") + " ובוחר תמיד את השכן עם ה-" + ltr("h") +
          " הקטן ביותר — בדיוק כפי שההרצאה מדגימה, זה מוביל למסלול <b>לא אופטימלי</b>: יקר " +
          "מהמסלול האופטימלי (" + ltr("418") + ") ש-A* מוצא על אותו גרף בדיוק.";
      } else {
        body2 = "המסלול שנמצא: <b>" + pathHe + "</b> בעלות <b>" + ltr(String(cost)) + "</b> ק\"מ. " +
          "בזכות ההיוריסטיקה הקבילה " + ltr("hSLD") + " (לעולם לא מפריזה על המרחק האמיתי), A* " +
          "מוצא בוודאות את המסלול האופטימלי — זול מהמסלול ש-Greedy מחזיר על אותו גרף (" +
          ltr("450") + ").";
      }
      snap({
        phase: "done", current: null, path: path, cost: cost,
        title: "סיום — נמצא מסלול ל-" + CITY[GOAL] + " (עלות " + cost + ")",
        body: body2
      });
    }

    return steps;
  }

  /* =====================================================================
     SVG scene — fixed layout, colours applied per step
     ===================================================================== */
  function buildGraph() {
    var svg = el("svg", {
      viewBox: "0 0 " + GW + " " + GH, width: "100%", role: "img", direction: "ltr",
      "aria-label": "מפת רומניה: עשרה קודקודים, מרחקים בין ערים והיוריסטיקת מרחק אווירי לבוקרשט"
    });
    svg.style.display = "block";
    svg.style.maxWidth = GW + "px";
    svg.style.margin = "0 auto";

    var edgeEls = {}, nodeEls = {};

    EDGES.forEach(function (e) {
      var a = e[0], b = e[1], w = e[2], pa = POS[a], pb = POS[b];
      var dx = pb[0] - pa[0], dy = pb[1] - pa[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / len, uy = dy / len;
      var line = el("line", {
        x1: pa[0] + ux * R, y1: pa[1] + uy * R, x2: pb[0] - ux * R, y2: pb[1] - uy * R,
        "stroke-width": 2.5, "stroke-linecap": "round"
      });
      svg.appendChild(line);
      var mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
      var chipBg = el("rect", { x: mx - 13, y: my - 10, width: 26, height: 18, rx: 6, "stroke-width": 1 });
      var chip = txt(mx, my + 4, String(w), { "text-anchor": "middle", "font-size": 11, "font-weight": 700 });
      svg.appendChild(chipBg); svg.appendChild(chip);
      edgeEls[pairId(a, b)] = { line: line, chip: chip, chipBg: chipBg };
    });

    NODES.forEach(function (v) {
      var p = POS[v];
      var g = el("g", {});
      var circle = el("circle", { cx: p[0], cy: p[1], r: R, "stroke-width": 2.5 });
      var code = txt(p[0], p[1] + 5, CODE[v], { "text-anchor": "middle", "font-size": 14, "font-weight": 800 });
      var cityLbl = txt(p[0], p[1] + R + 14, CITY[v], { "text-anchor": "middle", "font-size": 9.5, "font-weight": 600 });
      var hChip = txt(p[0], p[1] - R - 9, "h=" + H[v], { "text-anchor": "middle", "font-size": 9.5, "font-weight": 700 });
      g.appendChild(circle); g.appendChild(code); g.appendChild(cityLbl); g.appendChild(hChip);
      svg.appendChild(g);
      nodeEls[v] = { circle: circle, code: code, cityLbl: cityLbl, hChip: hChip };
    });

    return { svg: svg, edgeEls: edgeEls, nodeEls: nodeEls };
  }

  function nodeColor(state) {
    if (state === "current") return { fill: "var(--accent)", stroke: "var(--accent)", text: "#fff", sub: "#fff", w: 3.5 };
    if (state === "path") return {
      fill: "color-mix(in srgb, var(--accent) 25%, var(--surface))", stroke: "var(--accent)",
      text: "var(--ink)", sub: "var(--ink-soft)", w: 3.5
    };
    if (state === "closed") return {
      fill: "color-mix(in srgb, var(--ink) 12%, var(--surface))", stroke: "var(--ink-soft)",
      text: "var(--ink-soft)", sub: "var(--ink-soft)", w: 2.5
    };
    if (state === "open") return {
      fill: "color-mix(in srgb, var(--accent) 12%, var(--surface))",
      stroke: "color-mix(in srgb, var(--accent) 55%, var(--line))",
      text: "var(--ink)", sub: "var(--ink-soft)", w: 2.5
    };
    return { fill: "var(--surface)", stroke: "var(--line)", text: "var(--ink)", sub: "var(--ink-soft)", w: 2.5 };
  }

  function applyState(scene, s) {
    var openNodes = {};
    s.open.forEach(function (en) { openNodes[en.node] = true; });
    var pathSet = {}, pathEdges = {};
    if (s.path) {
      s.path.forEach(function (n) { pathSet[n] = true; });
      for (var i = 0; i < s.path.length - 1; i++) pathEdges[pairId(s.path[i], s.path[i + 1])] = true;
    }

    NODES.forEach(function (v) {
      var state = "default";
      if (s.closed[v]) state = "closed";
      if (openNodes[v] && !s.closed[v]) state = "open";
      if (pathSet[v]) state = "path";
      if (s.current === v) state = "current";
      var c = nodeColor(state), ref = scene.nodeEls[v];
      ref.circle.style.fill = c.fill;
      ref.circle.style.stroke = c.stroke;
      ref.circle.setAttribute("stroke-width", c.w);
      ref.code.style.fill = c.text;
      ref.cityLbl.style.fill = c.sub;
      ref.hChip.style.fill = c.sub;
    });

    for (var id in scene.edgeEls) {
      var ee = scene.edgeEls[id], onPath = !!pathEdges[id];
      ee.line.style.stroke = onPath ? "var(--accent)" : "var(--line)";
      ee.line.setAttribute("stroke-width", onPath ? 4.5 : 2.5);
      ee.chip.style.fill = onPath ? "var(--accent)" : "var(--ink-soft)";
      ee.chipBg.style.fill = "var(--surface)";
      ee.chipBg.style.stroke = onPath ? "var(--accent)" : "var(--line)";
    }
  }

  /* =====================================================================
     Open-list table / closed chips / explanation panel (pure renders)
     ===================================================================== */
  function renderOpenTable(table, s) {
    var html = "<tr><th>עיר</th><th>g</th><th>h</th><th>f</th></tr>";
    if (!s.open.length) {
      html += '<tr><td colspan="4" class="vag-empty-cell">∅ ריקה</td></tr>';
    } else {
      s.open.forEach(function (r, i) {
        html += '<tr' + (i === 0 ? ' class="vag-open-min"' : '') + '>' +
          '<td dir="ltr">' + CITY[r.node] + '</td><td>' + r.g + '</td><td>' + r.h +
          '</td><td>' + r.f + '</td></tr>';
      });
    }
    table.innerHTML = html;
  }

  function renderClosedChips(container, s) {
    container.innerHTML = "";
    if (!s.order.length) {
      container.appendChild(ce("span", "vag-empty", "∅ ריקה — טרם פותח אף קודקוד"));
      return;
    }
    s.order.forEach(function (v) {
      var chip = ce("span", "vag-chip");
      chip.setAttribute("dir", "ltr");
      chip.textContent = CITY[v] + " (g=" + s.gClosed[v] + ")";
      container.appendChild(chip);
    });
  }

  function renderPanel(panel, s) {
    panel.innerHTML = '<div><span class="vag-badge">' + s.title + '</span></div><div>' + s.body + "</div>";
  }

  /* =====================================================================
     Scoped stylesheet — colours ONLY via CSS custom properties / color-mix
     ===================================================================== */
  var STYLE_INJECTED = false;
  function injectStyle() {
    if (STYLE_INJECTED) return;
    STYLE_INJECTED = true;
    var css = [
      ".viz-astar-grid{direction:rtl;outline:none}",
      ".viz-astar-grid *,.viz-astar-grid *::before,.viz-astar-grid *::after{box-sizing:border-box}",
      ".viz-astar-grid .vag-head{display:flex;flex-wrap:wrap;gap:.35rem 1rem;align-items:baseline;margin-bottom:.6rem;color:var(--ink-soft);font-size:.86rem}",
      ".viz-astar-grid .vag-head b{color:var(--ink);font-size:.98rem}",
      ".viz-astar-grid .vag-toggle{margin-bottom:.8rem}",
      ".viz-astar-grid .vag-top{display:flex;flex-wrap:wrap;gap:14px;align-items:stretch}",
      ".viz-astar-grid .vag-graph{flex:1 1 360px;min-width:300px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:8px 6px}",
      ".viz-astar-grid .vag-graph svg{display:block;max-width:100%;margin:0 auto}",
      ".viz-astar-grid .vag-legend{display:flex;flex-wrap:wrap;gap:.35rem 1rem;justify-content:center;margin-top:4px;font-size:.72rem;color:var(--ink-soft)}",
      ".viz-astar-grid .vag-dot{width:12px;height:12px;border-radius:50%;display:inline-block;border:1.5px solid var(--line);margin-inline-end:4px;vertical-align:-1px;background:var(--surface)}",
      ".viz-astar-grid .vag-dot-open{background:color-mix(in srgb, var(--accent) 12%, var(--surface));border-color:color-mix(in srgb, var(--accent) 55%, var(--line))}",
      ".viz-astar-grid .vag-dot-closed{background:color-mix(in srgb, var(--ink) 12%, var(--surface));border-color:var(--ink-soft)}",
      ".viz-astar-grid .vag-dot-current{background:var(--accent);border-color:var(--accent)}",
      ".viz-astar-grid .vag-dot-path{background:color-mix(in srgb, var(--accent) 25%, var(--surface));border-color:var(--accent)}",
      ".viz-astar-grid .vag-side{flex:1 1 260px;min-width:240px;display:flex;flex-direction:column;gap:10px}",
      ".viz-astar-grid .vag-card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:9px 12px}",
      ".viz-astar-grid .vag-card h4{margin:0 0 4px;font-size:.82rem;font-weight:700;color:var(--ink)}",
      ".viz-astar-grid .vag-note{font-size:.72rem;color:var(--ink-soft);margin-bottom:6px}",
      ".viz-astar-grid .vag-table-wrap{overflow-x:auto}",
      ".viz-astar-grid table.vag-open{border-collapse:collapse;width:100%;font-size:.8rem;text-align:center}",
      ".viz-astar-grid table.vag-open th,.viz-astar-grid table.vag-open td{padding:3px 6px;border-bottom:1px solid var(--line)}",
      ".viz-astar-grid table.vag-open th{color:var(--ink-soft);font-weight:700}",
      ".viz-astar-grid table.vag-open td:first-child,.viz-astar-grid table.vag-open th:first-child{text-align:start}",
      ".viz-astar-grid table.vag-open .vag-empty-cell{padding:8px;color:var(--ink-soft);text-align:center}",
      ".viz-astar-grid table.vag-open tr.vag-open-min td{background:color-mix(in srgb, var(--accent) 14%, var(--surface));color:var(--accent);font-weight:800}",
      ".viz-astar-grid .vag-closed-strip{display:flex;gap:6px;flex-wrap:wrap;min-height:28px;align-items:center}",
      ".viz-astar-grid .vag-chip{display:inline-flex;align-items:center;padding:.15rem .55rem;border-radius:99px;font-weight:700;font-size:.76rem;border:1.5px solid var(--ink-soft);background:color-mix(in srgb, var(--ink) 10%, var(--surface));color:var(--ink-soft)}",
      ".viz-astar-grid .vag-empty{font-size:.8rem;color:var(--ink-soft)}",
      ".viz-astar-grid .vag-panel{margin-top:12px;background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:12px 14px;min-height:96px;color:var(--ink);line-height:1.7;font-size:.9rem}",
      ".viz-astar-grid .vag-badge{display:inline-block;background:var(--accent);color:#fff;font-weight:700;font-size:.72rem;padding:2px 10px;border-radius:99px;margin-bottom:7px}",
      ".viz-astar-grid .vag-counter{margin-inline-start:auto;align-self:center;font-size:.82rem;font-weight:700;color:var(--ink-soft)}"
    ].join("\n");
    var styleEl = document.createElement("style");
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  /* =====================================================================
     Render one mount
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-vag-ready") === "1") return;
    mount.setAttribute("data-vag-ready", "1");
    mount.innerHTML = "";
    injectStyle();

    var mode = "greedy";
    var STEPS = buildSteps(mode);
    var idx = 0, autoTimer = null;
    var scene = buildGraph();

    var wrap = ce("div", "viz-astar-grid");
    wrap.setAttribute("tabindex", "0");

    wrap.appendChild(ce("div", "vag-head",
      "<b>Greedy מול A*</b><span>אותו גרף רומניה מההרצאה (מקור " + ltr("Arad") + ", מטרה " +
      ltr("Bucharest") + ") וטבלת " + ltr("hSLD") + " — משווים בין שתי פונקציות ההערכה.</span>"));

    var toggle = ce("div", "viz-controls vag-toggle");
    var btnGreedy = mkBtn("Greedy — f=h", function () { setMode("greedy"); });
    var btnAstar = mkBtn("A* — f=g+h", function () { setMode("astar"); });
    toggle.appendChild(btnGreedy); toggle.appendChild(btnAstar);
    wrap.appendChild(toggle);

    var top = ce("div", "vag-top");
    var graphBox = ce("div", "vag-graph");
    graphBox.appendChild(scene.svg);
    graphBox.appendChild(ce("div", "vag-legend",
      '<span><span class="vag-dot"></span>לא התגלה</span>' +
      '<span><span class="vag-dot vag-dot-open"></span>ברשימה הפתוחה</span>' +
      '<span><span class="vag-dot vag-dot-closed"></span>ברשימה הסגורה</span>' +
      '<span><span class="vag-dot vag-dot-current"></span>נבחר כעת</span>' +
      '<span><span class="vag-dot vag-dot-path"></span>מסלול סופי</span>'));
    top.appendChild(graphBox);

    var side = ce("div", "vag-side");
    var openCard = ce("div", "vag-card");
    openCard.appendChild(ce("h4", null, 'רשימה פתוחה <span dir="ltr">(Open)</span> — ממוינת לפי f'));
    openCard.appendChild(ce("div", "vag-note", "אותה עיר עשויה להופיע כמה פעמים אם התגלתה משכנים שונים."));
    var openTableWrap = ce("div", "vag-table-wrap");
    var openTable = document.createElement("table");
    openTable.className = "vag-open";
    openTableWrap.appendChild(openTable);
    openCard.appendChild(openTableWrap);
    side.appendChild(openCard);

    var closedCard = ce("div", "vag-card");
    closedCard.appendChild(ce("h4", null, 'רשימה סגורה <span dir="ltr">(Closed)</span> — לפי סדר פיתוח'));
    var closedStrip = ce("div", "vag-closed-strip");
    closedCard.appendChild(closedStrip);
    side.appendChild(closedCard);

    top.appendChild(side);
    wrap.appendChild(top);

    var panel = ce("div", "vag-panel");
    panel.setAttribute("aria-live", "polite");
    wrap.appendChild(panel);

    var controls = ce("div", "viz-controls");
    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); go(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); go(idx + 1); }, true);
    var btnPlay = mkBtn("▶ הפעל", function () { toggleAuto(); });
    var btnReset = mkBtn("↺ איפוס", function () { stopAuto(); go(0); });
    var counter = ce("span", "vag-counter");
    [btnPrev, btnNext, btnPlay, btnReset, counter].forEach(function (x) { controls.appendChild(x); });
    wrap.appendChild(controls);

    mount.appendChild(wrap);

    function mkBtn(label, fn, primary) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn" + (primary ? " primary" : "");
      b.textContent = label;
      b.addEventListener("click", fn);
      return b;
    }

    function go(n) {
      idx = Math.max(0, Math.min(STEPS.length - 1, n));
      var s = STEPS[idx];
      applyState(scene, s);
      renderOpenTable(openTable, s);
      renderClosedChips(closedStrip, s);
      renderPanel(panel, s);
      counter.textContent = "צעד " + (idx + 1) + " / " + STEPS.length;
      btnPrev.disabled = idx === 0;
      btnNext.disabled = idx === STEPS.length - 1;
    }

    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      if (idx >= STEPS.length - 1) go(0);
      btnPlay.textContent = "⏸ השהה";
      btnPlay.classList.add("primary");
      autoTimer = setInterval(function () {
        if (idx >= STEPS.length - 1) { stopAuto(); return; }
        go(idx + 1);
      }, reducedMotion() ? 2000 : 1700);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      btnPlay.textContent = "▶ הפעל";
      btnPlay.classList.remove("primary");
    }

    function setMode(m) {
      stopAuto();
      mode = m; STEPS = buildSteps(m); idx = 0;
      btnGreedy.classList.toggle("primary", m === "greedy");
      btnAstar.classList.toggle("primary", m === "astar");
      btnGreedy.setAttribute("aria-pressed", m === "greedy" ? "true" : "false");
      btnAstar.setAttribute("aria-pressed", m === "astar" ? "true" : "false");
      go(0);
    }

    /* keyboard: RTL-aware (Right = prev, Left = next) */
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { stopAuto(); go(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { stopAuto(); go(idx + 1); e.preventDefault(); }
      else if (e.key === "Home") { stopAuto(); go(0); e.preventDefault(); }
      else if (e.key === "End") { stopAuto(); go(STEPS.length - 1); e.preventDefault(); }
      else if ((e.key === " " || e.key === "Enter") && e.target === wrap) { toggleAuto(); e.preventDefault(); }
    });

    setMode("greedy");
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
