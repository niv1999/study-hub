/* =====================================================================
   constraints-to-graph.js  —  Module 07 "Bellman-Ford והפרשי אילוצים"
   Grounded in _notes/06-bellman-ford.md — "תרגיל 2 (כיתה) — אילוצי הפרשים"
   [מקור: lec-bellman-ford-difference-constraints.pdf עמ' 18–26].

   THE EXACT LECTURE EXAMPLE (verbatim from the notes):
     המערכת הנתונה (7 אילוצים):
        x₁ − x₂ ≤ −5
        x₃ − x₄ ≤ 18
        x₃ − x₂ ≥ 2          (דורש הכפלה ב-(−1))
        x₁ − x₃ ≤ −10
        2x₅ − 2x₆ ≤ 14        (דורש חלוקה ב-2)
        x₆ − x₁ ≤ 1
        x₃ − x₅ = 9           (שוויון → שני אי-שוויונים)

     לאחר סידור לצורה  xⱼ − xᵢ ≤ b  (8 אילוצים) [dc עמ' 20]:
        x₁ − x₂ ≤ −5 · x₃ − x₄ ≤ 18 · x₂ − x₃ ≤ −2 · x₁ − x₃ ≤ −10
        x₅ − x₆ ≤ 7 · x₆ − x₁ ≤ 1 · x₃ − x₅ ≤ 9 · x₅ − x₃ ≤ −9

     הרדוקציה [bf עמ' 18]:  V = {v₀,…,v₆},  קשת v₀→vᵢ במשקל 0 לכל i,
     ולכל אילוץ xⱼ − xᵢ ≤ b קשת (vᵢ → vⱼ) במשקל b.

     הפתרון לאחר Bellman-Ford [dc עמ' 26]:
        d = (v0=0, v1=−10, v2=−2, v3=0, v4=0, v5=−9, v6=−9)
        ⇒ X = (x₁=−10, x₂=−2, x₃=0, x₄=0, x₅=−9, x₆=−9)
     (אומת ידנית: הפתרון מקיים את כל 7 האילוצים המקוריים.)

   הערה: בטבלאות הטרייס שבשקפים עמודת π נשארה NIL (המרצה עקבה רק אחרי d);
   כאן אנו מציגים גם את π האמיתי (עץ המסלולים הקצרים) לצורך הבנה מלאה.

   Live bookkeeping (זו הפדגוגיה): טבלת d/π לאורך הסבבים, תוכן גרף האילוצים,
   הדגשת הקשתות המרגיעות (relax) בכל סבב, ושורת הפסאודו-קוד הפעילה.

   Self-contained IIFE. Hand-authored SVG + DOM. No external deps.
   Cream design tokens hardcoded (CONTRACT §2). RTL Hebrew captions,
   English/LTR algorithm identifiers. Works over http(s):// and file://.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "constraints-to-graph";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design palette (hardcoded per CONTRACT §2) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",   /* source vertex v0 / info */
    clay: "#BE7C5E",   /* active / just-added edge / active pseudocode line */
    sage: "#7C9885",   /* solution / shortest-path tree */
    mustard: "#C9A24B" /* relax (edge relaxation this round) */
  };
  var SAGE_TINT = "#E4ECE5";
  var CLAY_TINT = "#F1E0D6";
  var MUST_TINT = "#F3E9CF";
  var BLUE_TINT = "#E3EBF0";
  var EDGE_BASE = "#B3A895";
  var INF = "∞";

  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function ltr(s) { return '<span dir="ltr">' + s + "</span>"; }
  function copy(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }
  function fmtD(x) { return x === Infinity ? INF : String(x); }

  /* ---------------- graph model (the lecture's constraint graph) ------- */
  var VERTS = ["v0", "v1", "v2", "v3", "v4", "v5", "v6"];
  var VLABEL = { v0: "v₀", v1: "v₁", v2: "v₂", v3: "v₃", v4: "v₄", v5: "v₅", v6: "v₆" };

  /* SVG positions — v0 the artificial source on the left; the rest laid
     out so the constraint edges read cleanly. */
  var POS = {
    v0: [58, 196],
    v3: [252, 116],
    v4: [246, 258],
    v2: [412, 60],
    v1: [442, 188],
    v5: [410, 306],
    v6: [606, 250]
  };

  /* the six weight-0 source edges v0 → vi */
  var V0EDGES = ["v1", "v2", "v3", "v4", "v5", "v6"].map(function (t) {
    return { id: "v0>" + t, u: "v0", v: t, w: 0, src: true };
  });

  /* the eight constraint edges, in the normalized order.
     constraint  xⱼ − xᵢ ≤ b  ⇒  edge (vᵢ → vⱼ) weight b. */
  var CEDGES = [
    { id: "v2>v1", u: "v2", v: "v1", w: -5,  ci: 0 },
    { id: "v4>v3", u: "v4", v: "v3", w: 18,  ci: 1 },
    { id: "v3>v2", u: "v3", v: "v2", w: -2,  ci: 2 },
    { id: "v3>v1", u: "v3", v: "v1", w: -10, ci: 3 },
    { id: "v6>v5", u: "v6", v: "v5", w: 7,   ci: 4 },
    { id: "v1>v6", u: "v1", v: "v6", w: 1,   ci: 5 },
    { id: "v5>v3", u: "v5", v: "v3", w: 9,   ci: 6 },
    { id: "v3>v5", u: "v3", v: "v5", w: -9,  ci: 7 }
  ];
  var ALL_EDGES = CEDGES.concat(V0EDGES);
  var EDGE_BY_ID = {};
  ALL_EDGES.forEach(function (e) { EDGE_BY_ID[e.id] = e; });

  /* anti-parallel pair v3↔v5 → curve both so they don't overlap */
  var CURVE = { "v3>v5": 1, "v5>v3": -1 };

  /* raw constraint system (phase-A display) */
  var RAW = [
    { tex: "x₁ − x₂ ≤ −5",   fix: false },
    { tex: "x₃ − x₄ ≤ 18",   fix: false },
    { tex: "x₃ − x₂ ≥ 2",    fix: true, why: "אי-שוויון ≥ — נכפיל ב-(−1)" },
    { tex: "x₁ − x₃ ≤ −10",  fix: false },
    { tex: "2x₅ − 2x₆ ≤ 14", fix: true, why: "מקדם 2 — נחלק ב-2" },
    { tex: "x₆ − x₁ ≤ 1",    fix: false },
    { tex: "x₃ − x₅ = 9",    fix: true, why: "שוויון — שני אי-שוויונים" }
  ];

  /* normalized 8-constraint system, aligned with CEDGES */
  var NORM = [
    { tex: "x₁ − x₂ ≤ −5",  edge: "v2>v1", from: "x₁−x₂≤−5" },
    { tex: "x₃ − x₄ ≤ 18",  edge: "v4>v3", from: "x₃−x₄≤18" },
    { tex: "x₂ − x₃ ≤ −2",  edge: "v3>v2", from: "x₃−x₂≥2 ×(−1)" },
    { tex: "x₁ − x₃ ≤ −10", edge: "v3>v1", from: "x₁−x₃≤−10" },
    { tex: "x₅ − x₆ ≤ 7",   edge: "v6>v5", from: "2x₅−2x₆≤14 ÷2" },
    { tex: "x₆ − x₁ ≤ 1",   edge: "v1>v6", from: "x₆−x₁≤1" },
    { tex: "x₃ − x₅ ≤ 9",   edge: "v5>v3", from: "x₃−x₅=9 (⇐)" },
    { tex: "x₅ − x₃ ≤ −9",  edge: "v3>v5", from: "x₃−x₅=9 (⇒)" }
  ];

  var MATRIX =
    "[  1  −1   0   0   0   0 ] [x₁]     [ −5 ]\n" +
    "[  0   0   1  −1   0   0 ] [x₂]     [ 18 ]\n" +
    "[  0   1  −1   0   0   0 ] [x₃]     [ −2 ]\n" +
    "[  1   0  −1   0   0   0 ] [x₄]  ≤  [−10 ]\n" +
    "[  0   0   0   0   1  −1 ] [x₅]     [  7 ]\n" +
    "[ −1   0   0   0   0   1 ] [x₆]     [  1 ]\n" +
    "[  0   0   1   0  −1   0 ]          [  9 ]\n" +
    "[  0   0  −1   0   1   0 ]          [ −9 ]";

  /* =====================================================================
     STEP ENGINE.  Phase C (Bellman-Ford) is genuinely simulated, so the
     table / graph highlights can never drift from the algorithm.
     Edge order per round: the 8 constraint edges (normalized order) then
     the 6 source edges v0→vi — reproduces the notes' round-1 = all-zeros.
     ===================================================================== */
  function simulateBF() {
    var dist = {}, pi = {};
    VERTS.forEach(function (v) { dist[v] = Infinity; pi[v] = null; });
    dist.v0 = 0;
    var rounds = [];
    for (var i = 1; i <= VERTS.length - 1; i++) {
      var updated = {}, relaxIds = [], changed = false;
      ALL_EDGES.forEach(function (e) {
        if (dist[e.u] !== Infinity && dist[e.u] + e.w < dist[e.v]) {
          dist[e.v] = dist[e.u] + e.w;
          pi[e.v] = e.u;
          updated[e.v] = true;
          relaxIds.push(e.id);
          changed = true;
        }
      });
      rounds.push({
        i: i, dist: copy(dist), pi: copy(pi),
        updated: updated, relaxIds: relaxIds.slice(), changed: changed
      });
      if (!changed) break;
    }
    return rounds;
  }

  /* the shortest-path-tree edges from the final π */
  function treeEdgeIds(pi) {
    var ids = [];
    VERTS.forEach(function (v) {
      if (v !== "v0" && pi[v] != null) ids.push(pi[v] + ">" + v);
    });
    return ids;
  }

  /* build the ordered list of step snapshots */
  function buildSteps() {
    var rounds = simulateBF();
    var finalR = rounds[rounds.length - 1];
    var steps = [];

    /* helper to push a snapshot with sensible defaults */
    function S(o) {
      var base = {
        phase: 0, badge: C.blue, title: "", body: "",
        cons: "raw", hlCons: -1, addedEdges: [], /* edges shown as built */
        showDist: false, dist: null, pi: null,
        hlEdges: {}, hlVerts: {}, showTable: false, activeLines: [],
        showHint: false, solution: false
      };
      for (var k in o) base[k] = o[k];
      return base;
    }
    /* edge-id lists for the two build phases */
    var srcIds = V0EDGES.map(function (e) { return e.id; });

    /* -------------------- PHASE A — normalization -------------------- */
    steps.push(S({
      phase: 0, cons: "raw", hlCons: -1, showHint: true,
      title: "המערכת הנתונה — 7 אילוצים",
      body: "נתונה מערכת אילוצי הפרשים " + ltr("(difference constraints)") + ". " +
        "המטרה: למצוא וקטור " + ltr("x = (x₁,…,x₆)") + " שמקיים את כולם. " +
        "כדי לפתור בעזרת " + ltr("Bellman-Ford") + " צריך תחילה שכל אילוץ יהיה בצורה " +
        "האחידה " + ltr("xⱼ − xᵢ ≤ b") + ". שלושה אילוצים (מסומנים) עדיין לא בצורה זו."
    }));
    steps.push(S({
      phase: 0, cons: "raw", hlCons: 2, showHint: true,
      badge: C.clay,
      title: "סידור 1 · אי-שוויון ≥ → הכפלה ב-(−1)",
      body: ltr("x₃ − x₂ ≥ 2") + " אינו בצורה " + ltr("≤") + ". נכפיל את שני האגפים " +
        "ב-(−1), מה שהופך את כיוון האי-שוויון:<br>" +
        '<pre dir="ltr">x₃ − x₂ ≥ 2   /×(−1)   ⟹   x₂ − x₃ ≤ −2</pre>'
    }));
    steps.push(S({
      phase: 0, cons: "raw", hlCons: 4, showHint: true,
      badge: C.clay,
      title: "סידור 2 · מקדם 2 → חלוקה ב-2",
      body: "בצורה האחידה מקדמי המשתנים חייבים להיות 1 ו-(−1). נחלק את " +
        ltr("2x₅ − 2x₆ ≤ 14") + " ב-2:<br>" +
        '<pre dir="ltr">2x₅ − 2x₆ ≤ 14   /÷2   ⟹   x₅ − x₆ ≤ 7</pre>'
    }));
    steps.push(S({
      phase: 0, cons: "raw", hlCons: 6, showHint: true,
      badge: C.clay,
      title: "סידור 3 · שוויון → שני אי-שוויונים",
      body: "שוויון " + ltr("x₃ − x₅ = 9") + " שקול לשני אי-שוויונים משלימים:<br>" +
        '<pre dir="ltr">x₃ − x₅ = 9   ⟹   x₃ − x₅ ≤ 9   וגם   x₅ − x₃ ≤ −9</pre>' +
        "כך אילוץ אחד הופך לשניים, ובסך הכול נקבל <b>8 אילוצים</b>."
    }));
    steps.push(S({
      phase: 0, cons: "norm", hlCons: -1, showHint: true,
      badge: C.sage,
      title: "המערכת המסודרת — 8 אילוצים · צורת מטריצה A·x ≤ b",
      body: "כל 8 האילוצים כעת בצורה " + ltr("xⱼ − xᵢ ≤ b") + " (כל שורה במטריצה A מכילה " +
        "בדיוק 1 אחד ו-(−1) אחד):" +
        '<div style="overflow-x:auto"><pre dir="ltr">' + MATRIX + "</pre></div>"
    }));

    /* -------------------- PHASE B — build constraint graph ----------- */
    steps.push(S({
      phase: 1, cons: "norm", hlCons: -1,
      badge: C.blue,
      addedEdges: srcIds,
      hlEdges: (function () { var h = {}; srcIds.forEach(function (id) { h[id] = "src"; }); return h; })(),
      hlVerts: { v0: "source" },
      title: "בניית הגרף · קודקוד המקור המלאכותי v₀",
      body: "יוצרים קודקוד לכל משתנה: " + ltr("v₁…v₆") + ", ומוסיפים <b>קודקוד מקור מלאכותי</b> " +
        ltr("v₀") + ". מ-" + ltr("v₀") + " נמתחת קשת במשקל <b>0</b> לכל קודקוד אחר " +
        "(6 הקשתות המקווקוות). תפקידן: להבטיח שכל הקודקודים <b>נגישים</b> ממקור יחיד, " +
        "כדי ש-" + ltr("Bellman-Ford") + " יחשב עבורם מרחק."
    }));
    /* one step per constraint edge added */
    CEDGES.forEach(function (e, k) {
      var built = srcIds.concat(CEDGES.slice(0, k + 1).map(function (x) { return x.id; }));
      var nc = NORM[e.ci];
      steps.push(S({
        phase: 1, cons: "norm", hlCons: e.ci,
        badge: C.clay,
        addedEdges: built,
        hlEdges: (function () { var h = {}; h[e.id] = "add"; return h; })(),
        hlVerts: (function () { var h = {}; h[e.u] = "tail"; h[e.v] = "head"; return h; })(),
        title: "אילוץ " + (k + 1) + "/8 → קשת " + VLABEL[e.u] + " → " + VLABEL[e.v] +
          " (משקל " + e.w + ")",
        body: "האילוץ " + ltr(nc.tex) + " הוא בצורה " + ltr("xⱼ − xᵢ ≤ b") +
          " עם " + ltr("j=" + e.v.slice(1) + ", i=" + e.u.slice(1) + ", b=" + e.w) + ". " +
          "לפי הרדוקציה מוסיפים קשת מ-" + ltr(VLABEL[e.u]) + " אל " + ltr(VLABEL[e.v]) +
          " במשקל " + ltr(String(e.w)) + " — כי " + ltr("d[" + e.v + "] ≤ d[" + e.u + "] + " + e.w) +
          " שקול בדיוק ל-" + ltr(nc.tex) + "."
      }));
    });

    /* -------------------- PHASE C — run Bellman-Ford ---------------- */
    var allBuilt = srcIds.concat(CEDGES.map(function (x) { return x.id; }));
    var initDist = {}; VERTS.forEach(function (v) { initDist[v] = Infinity; }); initDist.v0 = 0;
    steps.push(S({
      phase: 2, cons: "norm", hlCons: -1,
      badge: C.blue, addedEdges: allBuilt,
      showDist: true, dist: initDist, pi: (function () { var p = {}; VERTS.forEach(function (v) { p[v] = null; }); return p; })(),
      showTable: true, activeLines: [1],
      hlVerts: { v0: "source" },
      title: "Bellman-Ford · אתחול " + "(Initialize-Single-Source)",
      body: "מריצים את " + ltr("Bellman-Ford") + " מהמקור " + ltr("s = v₀") + ". " +
        "אתחול: " + ltr("d[v₀] = 0") + " ולכל שאר הקודקודים " + ltr("d[v] = ∞") + ", " +
        ltr("π[v] = NIL") + ". בכל אחד מ-" + ltr("|V|−1 = 6") + " הסבבים נבצע " +
        ltr("Relax") + " על כל 14 הקשתות."
    }));
    rounds.forEach(function (r, ri) {
      if (!r.changed) return; /* the trailing unchanged round handled below */
      var relaxSet = {};
      r.relaxIds.forEach(function (id) { relaxSet[id] = "relax"; });
      var updV = {};
      for (var v in r.updated) updV[v] = "updated";
      var bodyExtra;
      if (r.i === 1) {
        bodyExtra = "בסבב הראשון רק <b>קשתות המקור</b> " + ltr("v₀→vᵢ") + " מרגיעות משהו: " +
          "כל " + ltr("d[vᵢ]") + " יורד מ-" + INF + " ל-<b>0</b> (קשתות האילוץ עדיין רואות " +
          INF + " בשני קצותיהן ואינן משנות דבר).";
      } else {
        var parts = [];
        r.relaxIds.forEach(function (id) {
          var e = EDGE_BY_ID[id];
          if (e.src) return;
          parts.push(ltr(VLABEL[e.u] + "→" + VLABEL[e.v]) + " ⟹ " +
            ltr("d[" + e.v + "]=" + r.dist[e.v]));
        });
        bodyExtra = "כעת קשתות האילוץ מרגיעות ערכים: " + parts.join(" · ") + ". " +
          "שימו לב שבתוך הסבב עדכון מוקדם (למשל " + ltr("d[v₁]=−10") + ") מנוצל מיד " +
          "ע\"י קשת מאוחרת יותר (" + ltr("v₁→v₆") + ") באותו סבב.";
      }
      steps.push(S({
        phase: 2, cons: "norm", hlCons: -1,
        badge: C.mustard, addedEdges: allBuilt,
        showDist: true, dist: r.dist, pi: r.pi,
        showTable: true, activeLines: [2, 3, 4],
        hlEdges: relaxSet, hlVerts: updV,
        title: "סבב i = " + r.i + " · Relax על כל הקשתות",
        body: bodyExtra
      }));
    });
    /* trailing no-change rounds (3..6) collapsed into one explanatory step */
    steps.push(S({
      phase: 2, cons: "norm", hlCons: -1,
      badge: C.blue, addedEdges: allBuilt,
      showDist: true, dist: finalR.dist, pi: finalR.pi,
      showTable: true, activeLines: [2, 3, 4],
      hlVerts: {},
      title: "סבבים 3–6 · אין שינוי (התכנסות)",
      body: "בסבב 3 שום קשת כבר לא מרגיעה — ערכי " + ltr("d") + " יציבים. " +
        "האלגוריתם עדיין ירוץ פורמלית עד סבב " + ltr("|V|−1 = 6") + ", אך כולם זהים. " +
        "המבנה מבטיח שמסלול פשוט באורך לכל היותר " + ltr("|V|−1") + " קשתות התייצב."
    }));
    /* the check pass (lines 5-7) → returns TRUE */
    steps.push(S({
      phase: 2, cons: "norm", hlCons: -1,
      badge: C.sage, addedEdges: allBuilt,
      showDist: true, dist: finalR.dist, pi: finalR.pi,
      showTable: true, activeLines: [5, 6, 7, 8],
      hlVerts: {},
      title: "מעבר הבדיקה (שורות 5–7) · אין מעגל שלילי → TRUE",
      body: "עוברים פעם נוספת על כל הקשתות ובודקים אם קיימת קשת " + ltr("(u,v)") + " עם " +
        ltr("d[v] > d[u] + w(u,v)") + ". אף קשת לא נכשלת ⟹ <b>אין מעגל שלילי</b> ⟹ " +
        ltr("Bellman-Ford") + " מחזיר " + ltr("TRUE") + ", והפתרון תקף. " +
        "(אילו הייתה נמצאת הרגעה כאן — היה מעגל שלילי, והמערכת הייתה חסרת פתרון.)"
    }));
    /* solution */
    steps.push(S({
      phase: 2, cons: "norm", hlCons: -1,
      badge: C.sage, addedEdges: allBuilt,
      showDist: true, dist: finalR.dist, pi: finalR.pi,
      showTable: true, activeLines: [8],
      solution: true,
      hlEdges: (function () {
        var h = {}; treeEdgeIds(finalR.pi).forEach(function (id) { h[id] = "tree"; }); return h;
      })(),
      title: "הפתרון · X = d[v₁…v₆]",
      body: "הפתרון למערכת הוא וקטור המרחקים מ-" + ltr("v₀") + ":<br>" +
        '<b dir="ltr" style="color:' + C.sage + '">' +
        "X = (x₁=−10, x₂=−2, x₃=0, x₄=0, x₅=−9, x₆=−9)</b><br>" +
        "הקשתות המודגשות (ירוק) הן עץ המסלולים הקצרים " + ltr("(π)") + ". " +
        "בדיקה: כל אילוץ מקורי מתקיים — למשל " + ltr("x₆ − x₁ = −9 − (−10) = 1 ≤ 1") + " ✓, " +
        ltr("x₃ − x₂ = 0 − (−2) = 2 ≥ 2") + " ✓."
    }));

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
  function trim(ax, ay, bx, by, r) {
    var dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    return { x: ax + dx / L * r, y: ay + dy / L * r };
  }

  /* =====================================================================
     Scene builder — the constraint graph. Every vertex and edge is created
     once (hidden); applyState toggles visibility + colour.
     ===================================================================== */
  var GW = 680, GH = 384, R = 21;

  function buildGraph() {
    var svg = el("svg", {
      viewBox: "0 0 " + GW + " " + GH, width: "100%",
      role: "img", direction: "ltr",
      "aria-label": "גרף האילוצים: קודקוד מקור v0 וקשתות המתאימות לאילוצי ההפרשים"
    });
    svg.style.display = "block";
    svg.style.maxWidth = GW + "px";
    svg.style.margin = "0 auto";

    var defs = el("defs");
    var mk = function (id, color) {
      var m = el("marker", {
        id: id, viewBox: "0 0 10 10", refX: "8.5", refY: "5",
        markerWidth: "6.5", markerHeight: "6.5", orient: "auto-start-reverse"
      });
      m.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", fill: color }));
      defs.appendChild(m);
    };
    mk("ctg-base", EDGE_BASE);
    mk("ctg-src", C.blue);
    mk("ctg-add", C.clay);
    mk("ctg-relax", C.mustard);
    mk("ctg-tree", C.sage);
    svg.appendChild(defs);

    /* hint text (phase A, before graph is built) */
    var hint = txt(GW / 2, GH / 2, "", {
      "text-anchor": "middle", "font-size": 14, fill: C.inkSoft, direction: "rtl"
    });
    hint.textContent = "גרף האילוצים ייבנה בשלב הבא ←";
    svg.appendChild(hint);

    /* ---- edges (under nodes) ---- */
    var edgeEls = {};
    ALL_EDGES.forEach(function (e) {
      var a = POS[e.u], b = POS[e.v];
      var g = el("g", { opacity: 0 });
      var path = el("path", {
        fill: "none", stroke: EDGE_BASE, "stroke-width": 2.2,
        "stroke-linecap": "round", "marker-end": "url(#ctg-base)"
      });
      if (e.src) {
        path.setAttribute("stroke-dasharray", "5 5");
        path.setAttribute("stroke-width", 1.5);
      }
      g.appendChild(path);
      /* weight chip */
      var chipBg = el("rect", {
        width: 26, height: 18, rx: 6, fill: C.surface,
        stroke: C.line, "stroke-width": 1
      });
      var chipTx = txt(0, 0, String(e.w), {
        "text-anchor": "middle", "font-size": 11.5, "font-weight": 700,
        fill: e.src ? C.blue : C.inkSoft
      });
      g.appendChild(chipBg); g.appendChild(chipTx);
      svg.appendChild(g);
      edgeEls[e.id] = { g: g, path: path, chipBg: chipBg, chipTx: chipTx, e: e };

      /* geometry: trimmed straight or curved path + chip anchor */
      var s = trim(a[0], a[1], b[0], b[1], R + 4);
      var t = trim(b[0], b[1], a[0], a[1], R + 4);
      if (CURVE[e.id]) {
        var mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
        var dx = t.x - s.x, dy = t.y - s.y, L = Math.hypot(dx, dy) || 1;
        var nx = -dy / L, ny = dx / L, off = 30 * CURVE[e.id];
        var cx = mx + nx * off, cy = my + ny * off;
        path.setAttribute("d", "M" + s.x + " " + s.y + " Q" + cx + " " + cy + " " + t.x + " " + t.y);
        var chipX = mx + nx * off * 0.55, chipY = my + ny * off * 0.55;
        chipBg.setAttribute("x", chipX - 13); chipBg.setAttribute("y", chipY - 9);
        chipTx.setAttribute("x", chipX); chipTx.setAttribute("y", chipY + 4);
      } else {
        path.setAttribute("d", "M" + s.x + " " + s.y + " L" + t.x + " " + t.y);
        var cmx = (s.x + t.x) / 2, cmy = (s.y + t.y) / 2;
        /* nudge source-edge chips slightly to reduce overlap with node chips */
        chipBg.setAttribute("x", cmx - 13); chipBg.setAttribute("y", cmy - 9);
        chipTx.setAttribute("x", cmx); chipTx.setAttribute("y", cmy + 4);
      }
    });

    /* ---- nodes ---- */
    var nodeEls = {};
    VERTS.forEach(function (v) {
      var p = POS[v];
      var g = el("g", { opacity: 0 });
      var circle = el("circle", {
        cx: p[0], cy: p[1], r: R,
        fill: v === "v0" ? BLUE_TINT : C.surface,
        stroke: v === "v0" ? C.blue : C.line, "stroke-width": 2.5
      });
      var label = txt(p[0], p[1] + 5, VLABEL[v], {
        "text-anchor": "middle", "font-size": 15, "font-weight": 800,
        fill: C.ink, direction: "ltr"
      });
      /* dist chip below the node */
      var chipY = p[1] + R + 15;
      var dBg = el("rect", {
        x: p[0] - 17, y: chipY - 11, width: 34, height: 18, rx: 9,
        fill: C.surface2, stroke: C.line, "stroke-width": 1, opacity: 0
      });
      var dTx = txt(p[0], chipY + 3, INF, {
        "text-anchor": "middle", "font-size": 11.5, "font-weight": 700,
        fill: C.inkSoft, direction: "ltr", opacity: 0
      });
      g.appendChild(circle); g.appendChild(label);
      g.appendChild(dBg); g.appendChild(dTx);
      svg.appendChild(g);
      nodeEls[v] = { g: g, circle: circle, label: label, dBg: dBg, dTx: dTx };
    });

    return { svg: svg, edgeEls: edgeEls, nodeEls: nodeEls, hint: hint };
  }

  /* =====================================================================
     Render one mount
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-ctg-ready") === "1") return;
    mount.setAttribute("data-ctg-ready", "1");
    mount.innerHTML = "";

    var STEPS = buildSteps();
    var idx = 0, autoTimer = null;

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");
    wrap.style.outline = "none";

    /* ---- caption ---- */
    var cap = document.createElement("div");
    cap.style.cssText = "display:flex;flex-wrap:wrap;gap:.5rem;align-items:baseline;" +
      "margin-bottom:.6rem;color:" + C.inkSoft + ";font-size:.86rem";
    cap.innerHTML =
      '<b style="color:' + C.ink + ';font-size:.98rem">מאילוצי הפרשים לגרף אילוצים</b>' +
      '<span>דוגמת הכיתה (תרגיל 2) — רדוקציה ל-' + ltr("Bellman-Ford") + '.</span>';
    wrap.appendChild(cap);

    /* ---- phase pills ---- */
    var pills = document.createElement("div");
    pills.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;margin-bottom:.7rem";
    var PHASES = ["1 · סידור לצורה אחידה", "2 · בניית גרף האילוצים", "3 · הרצת Bellman-Ford"];
    var pillEls = PHASES.map(function (label) {
      var p = document.createElement("span");
      p.style.cssText = "font-size:.76rem;font-weight:700;padding:.25rem .7rem;border-radius:99px;" +
        "border:1.5px solid " + C.line + ";background:" + C.surface2 + ";color:" + C.inkSoft +
        ";transition:all .2s ease";
      p.textContent = label;
      pills.appendChild(p);
      return p;
    });
    wrap.appendChild(pills);

    /* ---- graph card ---- */
    var graphBox = document.createElement("div");
    graphBox.style.cssText = "background:" + C.surface + ";border:1px solid " + C.line +
      ";border-radius:12px;padding:8px 6px";
    var graph = buildGraph();
    graphBox.appendChild(graph.svg);
    var legend = document.createElement("div");
    legend.style.cssText = "display:flex;flex-wrap:wrap;gap:.35rem .9rem;justify-content:center;" +
      "margin-top:4px;font-size:.72rem;color:" + C.inkSoft;
    function dot(col, label, dash) {
      return '<span style="display:inline-flex;align-items:center;gap:.3rem">' +
        '<span style="width:14px;height:0;border-top:3px ' + (dash ? "dashed" : "solid") +
        " " + col + ';display:inline-block"></span>' + label + '</span>';
    }
    legend.innerHTML =
      dot(C.blue, "קשת מקור " + ltr("v₀→vᵢ") + " (0)", true) +
      dot(EDGE_BASE, "קשת אילוץ", false) +
      dot(C.mustard, "הרגעה בסבב (relax)", false) +
      dot(C.sage, "עץ מסלולים " + ltr("(π)"), false);
    graphBox.appendChild(legend);
    wrap.appendChild(graphBox);

    /* ---- middle row: constraints panel + [table over pseudocode] ---- */
    var mid = document.createElement("div");
    mid.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;margin-top:12px;align-items:stretch";

    /* constraints panel */
    var consBox = document.createElement("div");
    consBox.style.cssText = "flex:1 1 260px;min-width:240px;background:" + C.surface2 +
      ";border:1px solid " + C.line + ";border-radius:12px;padding:10px 12px";
    var consTitle = document.createElement("div");
    consTitle.style.cssText = "font-size:.8rem;font-weight:700;color:" + C.inkSoft +
      ";margin-bottom:7px;direction:rtl";
    consBox.appendChild(consTitle);
    var consList = document.createElement("div");
    consList.style.cssText = "display:flex;flex-direction:column;gap:4px";
    consBox.appendChild(consList);
    mid.appendChild(consBox);

    /* right column: table + pseudocode */
    var rightCol = document.createElement("div");
    rightCol.style.cssText = "flex:1 1 320px;min-width:280px;display:flex;flex-direction:column;gap:12px";

    /* dist/π table */
    var tableBox = document.createElement("div");
    tableBox.style.cssText = "overflow-x:auto;background:" + C.surface +
      ";border:1px solid " + C.line + ";border-radius:12px;padding:8px 6px";
    var table = document.createElement("table");
    table.setAttribute("dir", "ltr");
    table.style.cssText = "border-collapse:separate;border-spacing:0;width:100%;" +
      "min-width:300px;font-size:.82rem;text-align:center";
    var cellEls = { head: {}, d: {}, pi: {} };
    var rowsSpec = [
      { label: "V", head: true },
      { label: "d", key: "d" },
      { label: "π", key: "pi" }
    ];
    rowsSpec.forEach(function (spec) {
      var tr = document.createElement("tr");
      var th = document.createElement("th");
      th.textContent = spec.label;
      th.style.cssText = "padding:5px 8px;color:" + C.inkSoft + ";font-weight:700;" +
        "font-size:.78rem;position:sticky;left:0;background:" + C.surface +
        ";border-bottom:1px solid " + C.line;
      tr.appendChild(th);
      VERTS.forEach(function (v) {
        var cell = document.createElement(spec.head ? "th" : "td");
        cell.style.cssText = "padding:5px 0;min-width:34px;font-weight:" +
          (spec.head ? "800" : "700") + ";font-family:" +
          (spec.head ? "inherit" : "monospace") +
          ";border-bottom:1px solid " + C.line + ";transition:background .15s ease";
        tr.appendChild(cell);
        if (spec.head) { cellEls.head[v] = cell; cell.textContent = VLABEL[v]; }
        else cellEls[spec.key][v] = cell;
      });
      table.appendChild(tr);
    });
    tableBox.appendChild(table);
    rightCol.appendChild(tableBox);

    /* pseudocode box */
    var pseudoBox = document.createElement("div");
    pseudoBox.style.cssText = "background:" + C.surface2 + ";border:1px solid " + C.line +
      ";border-radius:12px;padding:10px 12px";
    var pseudoTitle = document.createElement("div");
    pseudoTitle.style.cssText = "font-size:.8rem;font-weight:700;color:" + C.inkSoft +
      ";margin-bottom:6px;direction:rtl";
    pseudoTitle.innerHTML = "פסאודו-קוד " + ltr("Bellman-Ford(G, w, s)");
    pseudoBox.appendChild(pseudoTitle);
    var PSEUDO = [
      "1. Initialize-Single-Source(G, s)",
      "2. for i ← 1 to |V[G]| − 1",
      "3.     do for each edge (u,v) ∈ E[G]",
      "4.         do Relax(u, v, w)",
      "5. for each edge (u,v) ∈ E[G]",
      "6.     do if d[v] > d[u] + w(u,v)",
      "7.         then return False",
      "8. return answer"
    ];
    var pre = document.createElement("pre");
    pre.setAttribute("dir", "ltr");
    pre.style.cssText = "margin:0;font-size:.76rem;line-height:1.5;white-space:pre;" +
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
    rightCol.appendChild(pseudoBox);
    mid.appendChild(rightCol);
    wrap.appendChild(mid);

    /* ---- explanation panel ---- */
    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.cssText = "margin-top:12px;background:" + C.surface +
      ";border:1px solid " + C.line + ";border-radius:12px;padding:12px 14px;" +
      "min-height:104px;color:" + C.ink + ";line-height:1.65;font-size:.9rem";
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
       render the constraints panel for a step
       --------------------------------------------------------------- */
    function renderCons(s) {
      var list = s.cons === "raw" ? RAW : NORM;
      consTitle.innerHTML = s.cons === "raw"
        ? "מערכת האילוצים (7) — " + ltr("difference constraints")
        : "המערכת המסודרת (8) → קשתות";
      consList.innerHTML = "";
      list.forEach(function (c, i) {
        var row = document.createElement("div");
        var active = (i === s.hlCons);
        var isNorm = s.cons === "norm";
        var built = isNorm && s.addedEdges && s.addedEdges.indexOf(c.edge) !== -1;
        var accent = active ? (s.cons === "raw" && c.fix ? C.clay : C.clay)
          : (c.fix && s.cons === "raw" ? C.clay : (built ? C.sage : C.line));
        row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:.5rem;" +
          "padding:.28rem .5rem;border-radius:8px;border:1.5px solid " + accent +
          ";background:" + (active ? CLAY_TINT : (built ? SAGE_TINT : C.surface)) +
          ";transition:all .18s ease";
        var left = document.createElement("span");
        left.setAttribute("dir", "ltr");
        left.style.cssText = "font-family:monospace;font-weight:700;font-size:.84rem;color:" + C.ink;
        left.textContent = c.tex;
        row.appendChild(left);
        var right = document.createElement("span");
        right.style.cssText = "font-size:.72rem;color:" + C.inkSoft + ";direction:rtl;text-align:left";
        if (isNorm) {
          var e = EDGE_BY_ID[c.edge];
          right.innerHTML = ltr(VLABEL[e.u] + "→" + VLABEL[e.v] + " : " + e.w) +
            (built ? ' <b style="color:' + C.sage + '">✓</b>' : "");
        } else if (c.fix) {
          right.textContent = c.why;
        } else {
          right.innerHTML = '<b style="color:' + C.sage + '">✓ בצורה</b>';
        }
        row.appendChild(right);
        consList.appendChild(row);
      });
    }

    /* ---------------------------------------------------------------
       apply a step's state to the whole scene
       --------------------------------------------------------------- */
    function pulse(node) {
      if (reducedMotion() || !node.animate) return;
      node.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.16)" }, { transform: "scale(1)" }],
        { duration: 360, easing: "ease-out" }
      );
    }

    function applyState(s) {
      graph.hint.setAttribute("opacity", s.showHint ? 1 : 0);

      /* nodes: which are visible */
      var anyGraph = (s.phase >= 1);
      VERTS.forEach(function (v) {
        var ne = graph.nodeEls[v];
        ne.g.setAttribute("opacity", anyGraph ? 1 : 0);
        var role = s.hlVerts[v];
        var fill = v === "v0" ? BLUE_TINT : C.surface;
        var stroke = v === "v0" ? C.blue : C.line, sw = 2.5, lc = C.ink;
        if (role === "source") { fill = BLUE_TINT; stroke = C.blue; sw = 3; }
        if (role === "tail")   { stroke = C.clay; sw = 3; }
        if (role === "head")   { fill = CLAY_TINT; stroke = C.clay; sw = 3.5; lc = C.clay; }
        if (role === "updated"){ fill = MUST_TINT; stroke = C.mustard; sw = 3.5; }
        ne.circle.setAttribute("fill", fill);
        ne.circle.setAttribute("stroke", stroke);
        ne.circle.setAttribute("stroke-width", sw);
        ne.label.setAttribute("fill", lc);
        /* dist chip */
        var showD = s.showDist && s.dist;
        ne.dBg.setAttribute("opacity", showD ? 1 : 0);
        ne.dTx.setAttribute("opacity", showD ? 1 : 0);
        if (showD) {
          var dv = s.dist[v];
          ne.dTx.textContent = fmtD(dv);
          var upd = role === "updated";
          ne.dTx.setAttribute("fill", dv === Infinity ? C.inkSoft : (upd ? "#8a6d1f" : (s.solution ? C.sage : C.ink)));
          ne.dBg.setAttribute("fill", upd ? MUST_TINT : (s.solution ? SAGE_TINT : C.surface2));
          ne.dBg.setAttribute("stroke", upd ? C.mustard : (s.solution ? C.sage : C.line));
        }
      });

      /* edges */
      for (var id in graph.edgeEls) {
        var ge = graph.edgeEls[id], e = ge.e;
        var shown = s.addedEdges && s.addedEdges.indexOf(id) !== -1;
        ge.g.setAttribute("opacity", shown ? 1 : 0);
        if (!shown) continue;
        var role2 = s.hlEdges[id];
        var col = e.src ? C.blue : EDGE_BASE;
        var wdt = e.src ? 1.5 : 2.2;
        var marker = e.src ? "url(#ctg-src)" : "url(#ctg-base)";
        var chipCol = e.src ? C.blue : C.inkSoft, chipStroke = C.line, chipFill = C.surface;
        if (role2 === "src")   { col = C.blue; marker = "url(#ctg-src)"; }
        if (role2 === "add")   { col = C.clay; wdt = 3.2; marker = "url(#ctg-add)"; chipCol = C.clay; chipStroke = C.clay; chipFill = CLAY_TINT; }
        if (role2 === "relax") { col = C.mustard; wdt = 3.6; marker = "url(#ctg-relax)"; chipCol = "#8a6d1f"; chipStroke = C.mustard; chipFill = MUST_TINT; }
        if (role2 === "tree")  { col = C.sage; wdt = 3.6; marker = "url(#ctg-tree)"; chipCol = C.sage; chipStroke = C.sage; chipFill = SAGE_TINT; }
        ge.path.setAttribute("stroke", col);
        ge.path.setAttribute("stroke-width", wdt);
        ge.path.setAttribute("marker-end", marker);
        ge.chipTx.setAttribute("fill", chipCol);
        ge.chipBg.setAttribute("stroke", chipStroke);
        ge.chipBg.setAttribute("fill", chipFill);
      }

      /* constraints panel */
      renderCons(s);

      /* dist/π table */
      var showTable = s.showTable && s.dist;
      tableBox.style.opacity = showTable ? "1" : ".45";
      VERTS.forEach(function (v) {
        var role = s.hlVerts[v];
        var upd = role === "updated";
        var dCell = cellEls.d[v], pCell = cellEls.pi[v], hCell = cellEls.head[v];
        if (showTable) {
          var dv = s.dist[v];
          dCell.textContent = fmtD(dv);
          pCell.textContent = s.pi && s.pi[v] != null ? VLABEL[s.pi[v]] : "–";
        } else {
          dCell.textContent = "·"; pCell.textContent = "·";
        }
        var bg = "transparent", dcol = C.ink, hbg = "transparent", hcol = C.ink;
        if (v === "v0") { hcol = C.blue; }
        if (s.solution && showTable && s.dist[v] !== Infinity) { hbg = SAGE_TINT; hcol = C.sage; }
        if (upd) { bg = MUST_TINT; dcol = "#8a6d1f"; hbg = MUST_TINT; hcol = C.mustard; }
        hCell.style.background = hbg; hCell.style.color = hcol;
        dCell.style.background = bg;
        dCell.style.color = showTable && s.dist[v] === Infinity ? C.inkSoft : dcol;
        pCell.style.background = bg; pCell.style.color = dcol;
      });

      /* pseudocode highlight */
      var active = {};
      s.activeLines.forEach(function (n) { active[n] = true; });
      var anyPseudo = s.activeLines.length > 0;
      pseudoBox.style.opacity = anyPseudo ? "1" : ".5";
      lineEls.forEach(function (span, i) {
        var on = active[i + 1];
        span.style.background = on ? CLAY_TINT : "transparent";
        span.style.color = on ? C.clay : C.ink;
        span.style.fontWeight = on ? "700" : "400";
      });

      /* phase pills */
      var pillCol = [C.clay, C.blue, C.sage];
      pillEls.forEach(function (p, i) {
        var on = (i === s.phase);
        p.style.background = on ? pillCol[i] : C.surface2;
        p.style.color = on ? "#fff" : C.inkSoft;
        p.style.borderColor = on ? pillCol[i] : C.line;
      });
    }

    /* ---------------------------------------------------------------
       navigation
       --------------------------------------------------------------- */
    function renderPanel(s) {
      panel.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px">' +
          '<span style="background:' + s.badge + ';color:#fff;font-weight:700;font-size:.72rem;' +
            'padding:2px 10px;border-radius:99px">' + s.title + '</span>' +
        '</div>' +
        '<div>' + s.body + '</div>';
    }

    function go(n) {
      idx = Math.max(0, Math.min(STEPS.length - 1, n));
      var s = STEPS[idx];
      applyState(s);
      renderPanel(s);
      /* pulse the head node when adding an edge / updated nodes when relaxing */
      for (var v in s.hlVerts) {
        if ((s.hlVerts[v] === "head" || s.hlVerts[v] === "updated") && graph.nodeEls[v]) {
          pulse(graph.nodeEls[v].g);
        }
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
