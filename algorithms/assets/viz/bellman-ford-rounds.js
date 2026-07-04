/* =====================================================================
   bellman-ford-rounds.js  —  Module 07 "Bellman-Ford והפרשי אילוצים"
   Grounded in _notes/06-bellman-ford.md:
     • הפסאודו-קוד המלא (dc עמ' 2–4): Initialize-Single-Source, ואז
       |V|−1 סבבים של Relax על כל הקשתות, ואז סבב בדיקה (שורות 5–7)
       שמזהה מעגל שלילי ומחזיר FALSE.
     • דוגמת הגרף לחזרה (dc עמ' 4): גרף מכוון עם 4 קודקודים S, A, B, C:
         S → A  (1)
         S → C  (2)
         A → B  (2)
         B → C  (1)
         C → A  (−4)   ← הקשת השלילית
       הגרף הזה מכיל מעגל שלילי  A → B → C → A  במשקל 2+1−4 = −1,
       ולכן Bellman-Ford מזהה אותו בסבב ה-|V| ומחזיר FALSE — בדיוק
       התרחיש שהברִיף מבקש להדגים ("מצב עם מעגל שלילי מראה את הזיהוי
       בסבב ה-|V|").
     • תרחיש שני ("וריאנט שלנו"): אותו גרף כשהקשת C→A במשקל +4 —
       אין מעגל שלילי, האלגוריתם מתכנס ומחזיר TRUE. מסומן במפורש
       כדוגמה שלנו (לא מההרצאה) כדי להראות גם את הכיוון החיובי של ה-iff.

   הבוקקיפינג המוצג (זו הפדגוגיה): טבלת d/π חיה, רשימת הקשתות בסדר
   העיבוד עם הקשת הנוכחית, מונה הסבב, ועץ המסלולים הקצרים (π) הנצבע
   על גבי הגרף תוך כדי ההרצה.

   Self-contained IIFE. Hand-authored SVG/DOM. No external deps.
   Cream design tokens hardcoded (CONTRACT §2). RTL Hebrew; English LTR.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "bellman-ford-rounds";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design palette (hardcoded per CONTRACT §2) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    edge: "#C4B49A",   /* neutral edge stroke */
    blue: "#6E8CA0",   /* dusty-blue — source / current edge */
    clay: "#BE7C5E",   /* unit-3 accent — negative edge / detection / FALSE */
    sage: "#7C9885",   /* relaxed / π-tree / TRUE */
    mustard: "#C9A24B" /* round accent */
  };

  /* ---- the lecture graph (dc עמ' 4). SOURCE = S ---- */
  var NODES = ["S", "A", "B", "C"];
  var SOURCE = "S";
  var V = NODES.length;                 /* |V| = 4 → 3 relax rounds + check */

  /* fixed edge processing order (as listed in the notes) */
  function edgesFor(cToA) {
    return [
      { u: "S", v: "A", w: 1 },
      { u: "S", v: "C", w: 2 },
      { u: "A", v: "B", w: 2 },
      { u: "B", v: "C", w: 1 },
      { u: "C", v: "A", w: cToA }
    ];
  }
  var SCENARIOS = {
    neg: { cToA: -4, label: "גרף ההרצאה · C→A במשקל 4−", hasCycle: true },
    pos: { cToA: 4, label: "וריאנט שלנו · C→A במשקל 4+", hasCycle: false }
  };

  /* node positions in the SVG (LTR drawing) */
  var POS = {
    S: { x: 85, y: 190 },
    A: { x: 235, y: 100 },
    B: { x: 385, y: 190 },
    C: { x: 235, y: 280 }
  };
  var R = 27;
  var GW = 470, GH = 360;
  var GCX = 235, GCY = 190;             /* graph centre (for label offset) */

  function fmt(v) { return v === Infinity ? "∞" : String(v); }
  function paren(w) { return w < 0 ? "(" + w + ")" : "+" + w; }
  function copy(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }
  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* =====================================================================
     STEP ENGINE — simulate Bellman-Ford and record every micro-step.
     A "step" = one edge relaxation (round phase) or one edge check
     (check phase), plus the init step and the terminal step. Each step
     carries a post-step d/π snapshot + a Hebrew explanation.
     ===================================================================== */
  function buildSteps(scn) {
    var edges = edgesFor(scn.cToA);
    var steps = [];
    var d = {}, pi = {};
    NODES.forEach(function (n) { d[n] = Infinity; pi[n] = null; });
    d[SOURCE] = 0;

    steps.push({
      phase: "init", round: 0, edgeIdx: -1,
      d: copy(d), pi: copy(pi), changed: null,
      badge: "Init", badgeColor: C.blue,
      title: "אתחול · Initialize-Single-Source(G, s)",
      body: "מציבים <span dir=\"ltr\">d[S] = 0</span> (המקור), ולכל שאר הקודקודים " +
        "<span dir=\"ltr\">d = ∞</span> ו-<span dir=\"ltr\">π = NIL</span>. " +
        "כעת נריץ <b>|V|−1 = 3 סבבים</b>, ובכל סבב נבצע <b>Relax</b> על כל 5 הקשתות " +
        "בסדר קבוע. לבסוף נריץ <b>סבב בדיקה</b> אחד (שורות 5–7) לזיהוי מעגל שלילי."
    });

    var detected = false;

    for (var i = 1; i <= V - 1; i++) {
      for (var e = 0; e < edges.length; e++) {
        var edge = edges[e];
        var du = d[edge.u], oldv = d[edge.v], relaxed = false;
        if (du !== Infinity && du + edge.w < oldv) {
          d[edge.v] = du + edge.w; pi[edge.v] = edge.u; relaxed = true;
        }
        steps.push(makeRelaxStep(i, e, edge, du, oldv, relaxed, d, pi, false));
      }
    }

    /* check round (the |V|-th pass) */
    for (var c = 0; c < edges.length; c++) {
      var ce = edges[c];
      var cdu = d[ce.u];
      var improvable = (cdu !== Infinity && cdu + ce.w < d[ce.v]);
      steps.push(makeCheckStep(c, ce, cdu, d[ce.v], improvable, d, pi));
      if (improvable) { detected = true; break; }
    }

    /* terminal step */
    if (detected) {
      steps.push({
        phase: "done", round: V, edgeIdx: -1,
        d: copy(d), pi: copy(pi), changed: null, detected: true, success: false,
        badge: "return FALSE", badgeColor: C.clay,
        title: "סיום · FALSE — זוהה מעגל שלילי",
        body: "בסבב הבדיקה עדיין נמצאה קשת שניתן להקל → קיים <b>מעגל שלילי</b>. " +
          "המעגל כאן הוא <span dir=\"ltr\">A → B → C → A</span> במשקל " +
          "<span dir=\"ltr\">2 + 1 − 4 = −1</span> (מודגש בכתום). " +
          "בכל סיבוב במעגל ה-d יורד עוד, ולכן <span dir=\"ltr\">δ(s, v) = −∞</span> " +
          "לכל קודקוד הנגיש מהמעגל — המרחקים <b>אינם מוגדרים</b>, והאלגוריתם מחזיר FALSE."
      });
    } else {
      steps.push({
        phase: "done", round: V, edgeIdx: -1,
        d: copy(d), pi: copy(pi), changed: null, detected: false, success: true,
        badge: "return TRUE", badgeColor: C.sage,
        title: "סיום · TRUE — אין מעגל שלילי",
        body: "בסבב הבדיקה אף קשת לא ניתנת עוד להקלה → <b>אין מעגל שלילי</b>. " +
          "לכן לכל קודקוד <span dir=\"ltr\">d[v] = δ(s, v)</span> — ערכי ה-d הם " +
          "בדיוק משקלי המסלולים הקצרים ביותר מ-S. הקשתות הירוקות מרכיבות את " +
          "<b>עץ המסלולים הקצרים</b> (π). האלגוריתם מחזיר TRUE."
      });
    }
    return steps;
  }

  function roundNote(du, oldv, relaxed, edge) {
    if (du === Infinity) {
      return "<span dir=\"ltr\">d[" + edge.u + "] = ∞</span> — עדיין אין מסלול ידוע אל " +
        "<span dir=\"ltr\">" + edge.u + "</span>, לכן אי אפשר להקל דרכו (לא מעדכנים).";
    }
    var sum = du + edge.w;
    var lhs = "<span dir=\"ltr\">d[" + edge.u + "] + w = " + du + " " + paren(edge.w) +
      " = " + sum + "</span>";
    if (relaxed) {
      return "<b>Relax:</b> " + lhs + " &lt; <span dir=\"ltr\">d[" + edge.v + "]</span> הקודם " +
        "(<span dir=\"ltr\">" + fmt(oldv) + "</span>) ← מעדכנים " +
        "<span dir=\"ltr\">d[" + edge.v + "] = " + sum + "</span>, " +
        "<span dir=\"ltr\">π[" + edge.v + "] = " + edge.u + "</span>.";
    }
    return lhs + " ≥ <span dir=\"ltr\">d[" + edge.v + "] = " + fmt(oldv) +
      "</span> — אין שיפור, לא מעדכנים.";
  }

  function makeRelaxStep(i, e, edge, du, oldv, relaxed, d, pi) {
    return {
      phase: "round", round: i, edgeIdx: e, edge: edge,
      d: copy(d), pi: copy(pi), changed: relaxed ? edge.v : null,
      badge: "i = " + i, badgeColor: relaxed ? C.sage : C.mustard,
      title: "סבב " + i + " · הקלת הקשת " +
        "<span dir=\"ltr\">" + edge.u + " → " + edge.v + "</span> " +
        "<span dir=\"ltr\">(w = " + edge.w + ")</span>",
      body: roundNote(du, oldv, relaxed, edge)
    };
  }

  function makeCheckStep(c, edge, du, dv, improvable, d, pi) {
    var body;
    if (improvable) {
      body = "<b>נמצא שיפור!</b> <span dir=\"ltr\">d[" + edge.u + "] + w = " + du + " " +
        paren(edge.w) + " = " + (du + edge.w) + " &lt; d[" + edge.v + "] = " + fmt(dv) +
        "</span> — עדיין ניתן להקל אחרי |V|−1 סבבים → <b>יש מעגל שלילי</b>. " +
        "האלגוריתם עוצר ומחזיר FALSE.";
    } else if (du === Infinity) {
      body = "<span dir=\"ltr\">d[" + edge.u + "] = ∞</span> — אין מה לבדוק בקשת זו.";
    } else {
      body = "<span dir=\"ltr\">d[" + edge.u + "] + w = " + du + " " + paren(edge.w) + " = " +
        (du + edge.w) + " ≥ d[" + edge.v + "] = " + fmt(dv) + "</span> — אין שיפור. תקין.";
    }
    return {
      phase: "check", round: V, edgeIdx: c, edge: edge,
      d: copy(d), pi: copy(pi), changed: null, improvable: improvable,
      badge: "check", badgeColor: improvable ? C.clay : C.mustard,
      title: "סבב הבדיקה (ה-|V|) · הקשת " +
        "<span dir=\"ltr\">" + edge.u + " → " + edge.v + "</span>",
      body: body
    };
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
     Build the graph scene (SVG). Returns refs used by applyStep.
     ===================================================================== */
  function buildGraph() {
    var svg = el("svg", {
      viewBox: "0 0 " + GW + " " + GH, width: "100%",
      role: "img", direction: "ltr",
      "aria-label": "גרף ההרצאה עם הקודקודים S, A, B, C והקשתות שלהם"
    });
    svg.style.display = "block";
    svg.style.maxWidth = GW + "px";
    svg.style.margin = "0 auto";

    var defs = el("defs");
    [["bf-n", C.edge], ["bf-b", C.blue], ["bf-s", C.sage], ["bf-c", C.clay]].forEach(function (m) {
      var mk = el("marker", {
        id: m[0], viewBox: "0 0 10 10", refX: "8.5", refY: "5",
        markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse"
      });
      mk.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", fill: m[1] }));
      defs.appendChild(mk);
    });
    svg.appendChild(defs);

    /* legend (top) */
    var leg = [
      [C.blue, "הקשת הנוכחית"],
      [C.sage, "עץ π / הוקלה"],
      [C.clay, "קשת שלילית / מעגל"]
    ];
    var lx = 14;
    leg.forEach(function (it) {
      svg.appendChild(el("line", { x1: lx, y1: 20, x2: lx + 22, y2: 20,
        stroke: it[0], "stroke-width": 3.5, "stroke-linecap": "round" }));
      var t = txt(lx + 28, 24, it[1], { "font-size": 11, fill: C.inkSoft, direction: "rtl" });
      svg.appendChild(t);
      lx += 30 + it[1].length * 7.4;
    });

    /* edges (created below nodes so nodes sit on top) */
    var edgeEls = [];
    var baseEdges = edgesFor(0);          /* geometry only; weights set per scenario */
    baseEdges.forEach(function (edge, idx) {
      var a = POS[edge.u], b = POS[edge.v];
      var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      var ux = dx / len, uy = dy / len;
      var x1 = a.x + ux * (R + 1), y1 = a.y + uy * (R + 1);
      var x2 = b.x - ux * (R + 3), y2 = b.y - uy * (R + 3);
      var line = el("line", {
        x1: x1, y1: y1, x2: x2, y2: y2,
        stroke: C.edge, "stroke-width": 2, "marker-end": "url(#bf-n)", "stroke-linecap": "round"
      });
      svg.appendChild(line);

      /* weight chip at midpoint, pushed outward from graph centre */
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      var px = -uy, py = ux;                /* perpendicular */
      var dot = px * (mx - GCX) + py * (my - GCY);
      var sign = Math.abs(dot) < 1 ? 1 : (dot > 0 ? 1 : -1);
      var off = 15;
      var wx = mx + px * off * sign, wy = my + py * off * sign;
      var chip = el("rect", { x: wx - 15, y: wy - 11, width: 30, height: 20, rx: 6,
        fill: C.surface, stroke: C.line, "stroke-width": 1 });
      var wtext = txt(wx, wy + 4, "", {
        "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: C.ink });
      svg.appendChild(chip);
      svg.appendChild(wtext);
      edgeEls.push({ line: line, chip: chip, wtext: wtext, edge: edge });
    });

    /* nodes */
    var nodeEls = {};
    NODES.forEach(function (name) {
      var p = POS[name];
      var g = el("g", {});
      var isSrc = (name === SOURCE);
      var circ = el("circle", { cx: p.x, cy: p.y, r: R,
        fill: C.surface, stroke: isSrc ? C.blue : C.edge,
        "stroke-width": isSrc ? 3.5 : 2 });
      g.appendChild(circ);
      g.appendChild(txt(p.x, p.y - 2, name, {
        "text-anchor": "middle", "font-size": 17, "font-weight": 800,
        fill: isSrc ? C.blue : C.ink }));
      /* d value inside the circle (lower half) */
      var dText = txt(p.x, p.y + 15, "", {
        "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: C.inkSoft });
      g.appendChild(dText);
      /* source tag */
      if (isSrc) {
        g.appendChild(txt(p.x, p.y - R - 8, "source", {
          "text-anchor": "middle", "font-size": 10, "font-weight": 700, fill: C.blue }));
      }
      svg.appendChild(g);
      nodeEls[name] = { circ: circ, dText: dText, isSrc: isSrc };
    });

    return { svg: svg, edgeEls: edgeEls, nodeEls: nodeEls };
  }

  /* =====================================================================
     Render into a mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-bf-ready") === "1") return;
    mount.setAttribute("data-bf-ready", "1");
    mount.innerHTML = "";

    var scnKey = "neg";
    var steps = buildSteps(SCENARIOS.neg);
    var idx = 0;
    var autoTimer = null;

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");
    wrap.style.outline = "none";

    /* ---- scenario toggle ---- */
    var scnRow = document.createElement("div");
    scnRow.className = "viz-controls";
    scnRow.style.marginTop = "0";
    scnRow.style.marginBottom = ".85rem";
    var scnLbl = document.createElement("span");
    scnLbl.textContent = "תרחיש:";
    scnLbl.style.cssText = "font-weight:700;color:" + C.ink + ";font-size:.9rem";
    scnRow.appendChild(scnLbl);
    var btnNeg = mkBtn(SCENARIOS.neg.label, function () { setScenario("neg"); });
    var btnPos = mkBtn(SCENARIOS.pos.label, function () { setScenario("pos"); });
    scnRow.appendChild(btnNeg);
    scnRow.appendChild(btnPos);
    wrap.appendChild(scnRow);

    /* ---- main flex row: graph + bookkeeping ---- */
    var flow = document.createElement("div");
    flow.style.cssText = "display:flex;flex-wrap:wrap;gap:14px;align-items:stretch";

    /* graph card */
    var graphCard = document.createElement("div");
    graphCard.style.cssText =
      "flex:1 1 320px;min-width:280px;background:" + C.surface +
      ";border:1px solid " + C.line + ";border-radius:14px;padding:8px 6px";
    var graph = buildGraph();
    graphCard.appendChild(graph.svg);
    flow.appendChild(graphCard);

    /* bookkeeping card */
    var bkCard = document.createElement("div");
    bkCard.style.cssText =
      "flex:1 1 300px;min-width:260px;background:" + C.surface +
      ";border:1px solid " + C.line + ";border-radius:14px;padding:12px 14px";

    /* phase chips */
    var phaseRow = document.createElement("div");
    phaseRow.style.cssText = "display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px";
    var phaseDefs = [
      { key: "init", label: "אתחול" },
      { key: "r1", label: "סבב 1" },
      { key: "r2", label: "סבב 2" },
      { key: "r3", label: "סבב 3" },
      { key: "check", label: "בדיקה" }
    ];
    var phaseChips = phaseDefs.map(function (pd) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn";
      b.textContent = pd.label;
      b.style.cssText = "padding:.18rem .55rem;font-size:.78rem";
      b.addEventListener("click", function () { stopAuto(); goto(firstIndexOfPhase(pd.key)); });
      phaseRow.appendChild(b);
      return { key: pd.key, btn: b };
    });
    bkCard.appendChild(phaseRow);

    /* edge-order strip */
    var stripTitle = document.createElement("div");
    stripTitle.innerHTML = "קשתות בסדר העיבוד:";
    stripTitle.style.cssText = "font-size:.78rem;font-weight:700;color:" + C.inkSoft + ";margin-bottom:5px";
    bkCard.appendChild(stripTitle);
    var strip = document.createElement("div");
    strip.style.cssText = "display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px";
    var stripChips = [];
    edgesFor(0).forEach(function (edge, i) {
      var c = document.createElement("span");
      c.setAttribute("dir", "ltr");
      c.style.cssText =
        "font-size:.76rem;font-weight:700;padding:2px 7px;border-radius:7px;" +
        "border:1px solid " + C.line + ";background:" + C.surface2 + ";color:" + C.inkSoft;
      strip.appendChild(c);
      stripChips.push(c);
    });
    bkCard.appendChild(strip);

    /* dist/π table */
    var table = document.createElement("table");
    table.style.cssText = "width:100%;border-collapse:collapse;font-size:.9rem";
    var thead = document.createElement("thead");
    thead.innerHTML =
      "<tr>" +
      "<th style=\"text-align:right;padding:5px 8px;border-bottom:2px solid " + C.line +
        ";color:" + C.inkSoft + ";font-size:.82rem\">קודקוד</th>" +
      "<th style=\"text-align:center;padding:5px 8px;border-bottom:2px solid " + C.line +
        ";color:" + C.inkSoft + "\" dir=\"ltr\">d[v]</th>" +
      "<th style=\"text-align:center;padding:5px 8px;border-bottom:2px solid " + C.line +
        ";color:" + C.inkSoft + "\" dir=\"ltr\">π[v]</th>" +
      "</tr>";
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    var rowEls = {};
    NODES.forEach(function (name) {
      var tr = document.createElement("tr");
      var tdN = document.createElement("td");
      tdN.setAttribute("dir", "ltr");
      tdN.textContent = name + (name === SOURCE ? " (s)" : "");
      tdN.style.cssText = "padding:6px 8px;font-weight:800;color:" +
        (name === SOURCE ? C.blue : C.ink) + ";border-bottom:1px solid " + C.line + ";text-align:right";
      var tdD = document.createElement("td");
      tdD.setAttribute("dir", "ltr");
      tdD.style.cssText = "padding:6px 8px;text-align:center;font-weight:700;font-family:monospace;" +
        "border-bottom:1px solid " + C.line;
      var tdP = document.createElement("td");
      tdP.setAttribute("dir", "ltr");
      tdP.style.cssText = "padding:6px 8px;text-align:center;font-family:monospace;color:" +
        C.inkSoft + ";border-bottom:1px solid " + C.line;
      tr.appendChild(tdN); tr.appendChild(tdD); tr.appendChild(tdP);
      tbody.appendChild(tr);
      rowEls[name] = { tr: tr, d: tdD, pi: tdP };
    });
    table.appendChild(tbody);
    bkCard.appendChild(table);

    flow.appendChild(bkCard);
    wrap.appendChild(flow);

    /* ---- explanation panel ---- */
    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.cssText =
      "background:" + C.surface2 + ";border:1px solid " + C.line + ";border-radius:12px;" +
      "padding:12px 14px;margin-top:12px;min-height:92px;color:" + C.ink +
      ";line-height:1.7;font-size:.9rem";
    wrap.appendChild(panel);

    /* ---- controls ---- */
    var controls = document.createElement("div");
    controls.className = "viz-controls";
    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); goto(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); goto(idx + 1); });
    btnNext.classList.add("primary");
    var btnPlay = mkBtn("▶ הפעל", function () { toggleAuto(); });
    var btnReset = mkBtn("↺ איפוס", function () { stopAuto(); goto(0); });
    var counter = document.createElement("span");
    counter.style.cssText = "font-size:.82rem;color:" + C.inkSoft + ";font-weight:700;margin-inline-start:auto";
    controls.appendChild(btnPrev);
    controls.appendChild(btnNext);
    controls.appendChild(btnPlay);
    controls.appendChild(btnReset);
    controls.appendChild(counter);
    wrap.appendChild(controls);

    mount.appendChild(wrap);

    /* ---- helpers ---- */
    function mkBtn(label, fn) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn";
      b.textContent = label;
      b.addEventListener("click", fn);
      return b;
    }

    function firstIndexOfPhase(key) {
      for (var i = 0; i < steps.length; i++) {
        var s = steps[i];
        if (key === "init" && s.phase === "init") return i;
        if (key === "check" && s.phase === "check") return i;
        if (key.charAt(0) === "r" && s.phase === "round" && s.round === parseInt(key.slice(1), 10)) return i;
      }
      return idx;
    }

    function phaseKeyOf(s) {
      if (s.phase === "init") return "init";
      if (s.phase === "round") return "r" + s.round;
      return "check"; /* check + done */
    }

    /* ---- edge visual priority: current > π-tree > (negative base) ---- */
    function paintEdges(s) {
      var edges = edgesFor(SCENARIOS[scnKey].cToA);
      var cycleActive = (s.phase === "done" && s.detected);
      graph.edgeEls.forEach(function (ee, i) {
        var edge = edges[i];
        ee.wtext.textContent = edge.w < 0 ? "−" + Math.abs(edge.w) : String(edge.w);
        var isTree = (s.pi[edge.v] === edge.u);
        var isCurrent = (i === s.edgeIdx && (s.phase === "round" || s.phase === "check"));
        var isCycleEdge = cycleActive && edge.u !== SOURCE; /* A→B,B→C,C→A */
        var stroke = C.edge, wStroke = 2, marker = "bf-n";
        if (edge.w < 0) { stroke = C.clay; marker = "bf-c"; }         /* negative base */
        if (isTree) { stroke = C.sage; wStroke = 3; marker = "bf-s"; }
        if (isCycleEdge) { stroke = C.clay; wStroke = 3.5; marker = "bf-c"; }
        if (isCurrent) {
          stroke = s.improvable ? C.clay : (s.changed === edge.v ? C.sage : C.blue);
          wStroke = 4.5; marker = (stroke === C.clay ? "bf-c" : stroke === C.sage ? "bf-s" : "bf-b");
        }
        ee.line.setAttribute("stroke", stroke);
        ee.line.setAttribute("stroke-width", wStroke);
        ee.line.setAttribute("marker-end", "url(#" + marker + ")");
        ee.chip.setAttribute("stroke", isCurrent ? stroke : C.line);
        ee.chip.setAttribute("stroke-width", isCurrent ? 1.6 : 1);
      });
    }

    function paintNodes(s) {
      NODES.forEach(function (name) {
        var ne = graph.nodeEls[name];
        ne.dText.textContent = "d=" + fmt(s.d[name]);
        ne.dText.setAttribute("fill", s.d[name] === Infinity ? C.inkSoft : C.ink);
        var active = (s.changed === name) ||
          (s.edge && s.edge.v === name && (s.phase === "round" || s.phase === "check"));
        ne.circ.setAttribute("stroke", active ? (s.improvable ? C.clay : s.changed === name ? C.sage : C.blue)
          : (ne.isSrc ? C.blue : C.edge));
        ne.circ.setAttribute("stroke-width", active ? 4 : (ne.isSrc ? 3.5 : 2));
      });
    }

    function paintTable(s, prev) {
      NODES.forEach(function (name) {
        var re = rowEls[name];
        re.d.textContent = fmt(s.d[name]);
        re.d.style.color = s.d[name] === Infinity ? C.inkSoft :
          (s.d[name] < 0 ? C.clay : C.ink);
        re.pi.textContent = s.pi[name] === null ? "NIL" : s.pi[name];
        var changed = prev && prev.d[name] !== s.d[name];
        re.tr.style.background = (s.changed === name) ? "#F3ECDD"
          : (changed ? "#F3ECDD" : "transparent");
      });
    }

    function paintStrip(s) {
      var edges = edgesFor(SCENARIOS[scnKey].cToA);
      var activeRound = (s.phase === "round" || s.phase === "check");
      stripChips.forEach(function (c, i) {
        var edge = edges[i];
        c.textContent = edge.u + "→" + edge.v + " " +
          (edge.w < 0 ? "−" + Math.abs(edge.w) : "+" + edge.w);
        var isCur = activeRound && i === s.edgeIdx;
        var isDone = activeRound && i < s.edgeIdx;
        if (isCur) {
          var col = s.improvable ? C.clay : (s.changed === edge.v ? C.sage : C.blue);
          c.style.background = col; c.style.color = "#fff"; c.style.borderColor = col;
        } else if (isDone) {
          c.style.background = C.surface2; c.style.color = C.ink; c.style.borderColor = C.line;
        } else {
          c.style.background = C.surface2; c.style.color = C.inkSoft; c.style.borderColor = C.line;
        }
      });
    }

    function paintPhaseChips(s) {
      var key = phaseKeyOf(s);
      phaseChips.forEach(function (pc) {
        var active = (pc.key === key);
        pc.btn.style.background = active ? C.mustard : C.surface2;
        pc.btn.style.color = active ? "#fff" : C.inkSoft;
        pc.btn.style.borderColor = active ? C.mustard : C.line;
      });
    }

    function renderPanel(s) {
      panel.innerHTML =
        "<div style=\"display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px\">" +
          "<span dir=\"ltr\" style=\"background:" + s.badgeColor + ";color:#fff;font-weight:700;" +
            "font-size:.72rem;padding:2px 10px;border-radius:99px\">" + s.badge + "</span>" +
          "<b style=\"font-size:.98rem;color:" + C.ink + "\">" + s.title + "</b>" +
        "</div>" +
        "<div>" + s.body + "</div>";
    }

    function pulse(name) {
      if (reducedMotion()) return;
      var ne = graph.nodeEls[name];
      if (ne && ne.circ.animate) {
        ne.circ.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(1)" }],
          { duration: 320, easing: "ease-out",
            /* scale around the node centre */
          });
        ne.circ.style.transformOrigin = POS[name].x + "px " + POS[name].y + "px";
        ne.circ.style.transformBox = "fill-box";
      }
    }

    /* ---- navigation ---- */
    function goto(n) {
      var prev = steps[idx];
      idx = Math.max(0, Math.min(steps.length - 1, n));
      var s = steps[idx];
      paintEdges(s);
      paintNodes(s);
      paintTable(s, prev);
      paintStrip(s);
      paintPhaseChips(s);
      renderPanel(s);
      if (s.changed) pulse(s.changed);
      counter.textContent = "צעד " + (idx + 1) + " / " + steps.length;
      btnPrev.disabled = (idx === 0);
      btnNext.disabled = (idx === steps.length - 1);
    }

    function setScenario(key) {
      stopAuto();
      scnKey = key;
      steps = buildSteps(SCENARIOS[key]);
      idx = 0;
      btnNeg.classList.toggle("primary", key === "neg");
      btnPos.classList.toggle("primary", key === "pos");
      btnNeg.setAttribute("aria-pressed", key === "neg" ? "true" : "false");
      btnPos.setAttribute("aria-pressed", key === "pos" ? "true" : "false");
      goto(0);
    }

    /* ---- autoplay ---- */
    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      if (idx >= steps.length - 1) goto(0);
      btnPlay.textContent = "⏸ השהה";
      btnPlay.classList.add("primary");
      var delay = reducedMotion() ? 1500 : 1600;
      autoTimer = setInterval(function () {
        if (idx >= steps.length - 1) { stopAuto(); return; }
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
      else if (e.key === "End") { stopAuto(); goto(steps.length - 1); e.preventDefault(); }
    });

    /* initial paint */
    setScenario("neg");
  }

  /* =====================================================================
     boot: mount all instances (guard for already-ready). Never throw.
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
