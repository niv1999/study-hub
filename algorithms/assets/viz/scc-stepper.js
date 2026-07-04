/* =====================================================================
   scc-stepper.js  —  Module 03 "רכיבים קשירים היטב (SCC)"
   Grounded in _notes/02-scc.md — the EXACT lecture example (lec-scc.pdf /
   strongly-connected-components.pdf). This is the SCC(G) algorithm taught
   in class (Kosaraju's, CLRS form): DFS(G) → G^T → sort V by decreasing
   f → DFS(G^T) → each DFS-tree of G^T is one SCC → condensation G^scc.

   EXACT GRAPH G (8 vertices, two rows A,B,C,D over E,F,G,H):
     A→B, B→C, B→E, E→A, B→F, C→D & D→C, C→G, D→H,
     E→F, F→G & G→F, G→H, H→H (self-loop)          [_notes 02-scc.md §דוגמאות]

   DFS(G) discovery/finish times  d/f  [lec-scc.pdf p.3, verbatim]:
     A 13/14 · B 11/16 · C 1/10 · D 8/9 · E 12/15 · F 3/4 · G 2/7 · H 5/6
     first-DFS root = C ; finish order (f↑): F,H,G,D,C,A,E,B
     decreasing-f order (2nd-DFS root order): B,E,A,C,D,G,H,F

   DFS(G^T) times [lec-scc.pdf p.6, verbatim]:
     A 2/5 · B 1/6 · C 7/10 · D 8/9 · E 3/4 · F 12/13 · G 11/14 · H 15/16
     2nd-DFS root = B.

   OUTPUT — the four SCCs [strongly-connected-components.pdf p.3 / lec p.7]:
     {A,B,E}(mustard) · {C,D}(sage) · {F,G}(clay) · {H}(slate)
   Condensation G^scc edges [lec-scc.pdf p.8]:
     ABE→CD, ABE→FG, CD→FG, CD→H, FG→H   (a DAG).

   Every d/f/order/edge above is taken verbatim from the notes; the event
   trace below was reconstructed so each discovery follows a real edge from
   a gray ancestor and reproduces the notes' exact d/f values.

   Self-contained IIFE. Hand-authored SVG/DOM. No external deps. Works over
   http(s) and file://. Cream design tokens hardcoded (CONTRACT §2). RTL
   Hebrew captions; English/LTR algorithm identifiers. Keyboard accessible;
   prefers-reduced-motion respected; graceful if no mount; zero console err.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "scc-stepper";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design tokens (hardcoded per CONTRACT §2) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",    /* dusty-blue — unit-1 accent (DFS current) */
    clay: "#BE7C5E",    /* SCC {F,G} */
    sage: "#7C9885",    /* SCC {C,D} */
    mustard: "#C9A24B", /* SCC {A,B,E} */
    slate: "#7E8CA0",   /* SCC {H} */
    black: "#4A463F"    /* finished (DFS "black") vertex */
  };

  /* --- the lecture graph -------------------------------------------- */
  var VERTS = ["A", "B", "C", "D", "E", "F", "G", "H"];
  var R = 25;
  var POS = {
    A: { x: 80, y: 92 }, B: { x: 225, y: 92 }, C: { x: 370, y: 92 }, D: { x: 515, y: 92 },
    E: { x: 80, y: 248 }, F: { x: 225, y: 248 }, G: { x: 370, y: 248 }, H: { x: 515, y: 248 }
  };
  /* directed edges of G (reversed in G^T); bidirectional & self stay put */
  var DIR = [["A", "B"], ["B", "C"], ["B", "E"], ["E", "A"], ["B", "F"],
             ["C", "G"], ["D", "H"], ["E", "F"], ["G", "H"]];
  var BI = [["C", "D"], ["F", "G"]];
  var SELF = ["H"];

  /* SCCs (index = DFS(G^T) tree order): {A,B,E},{C,D},{F,G},{H} */
  var SCC_MEMBERS = [["A", "B", "E"], ["C", "D"], ["F", "G"], ["H"]];
  var SCC_FILL = [C.mustard, C.sage, C.clay, C.slate];
  var SCC_NAME = ["ABE", "CD", "FG", "H"];

  /* DFS(G) final times (verbatim, _notes) */
  var P1D = { C: 1, G: 2, F: 3, H: 5, D: 8, B: 11, E: 12, A: 13 };
  var P1F = { F: 4, H: 6, G: 7, D: 9, C: 10, A: 14, E: 15, B: 16 };
  var SORTED = ["B", "E", "A", "C", "D", "G", "H", "F"]; /* decreasing f */

  /* --- event traces (each discovery uses a real edge; reproduces d/f) --- */
  var P1 = [
    { ty: "d", v: "C", t: 1, root: true,
      x: "מתחילים <span dir=\"ltr\">DFS</span> על G מהקדקוד <b dir=\"ltr\">C</b> — נצבע אפור ונכנס למחסנית. <span dir=\"ltr\">d[C]=1</span>." },
    { ty: "d", v: "G", t: 2, e: ["C", "G"],
      x: "מ-C סורקים את הקשת <span dir=\"ltr\">C→G</span>: G לבן → מגלים אותו. <span dir=\"ltr\">d[G]=2</span>." },
    { ty: "d", v: "F", t: 3, e: ["G", "F"],
      x: "מ-G דרך <span dir=\"ltr\">G→F</span> מגלים את F. <span dir=\"ltr\">d[F]=3</span>." },
    { ty: "f", v: "F", t: 4,
      x: "לשכן היחיד של F שנותר (<span dir=\"ltr\">F→G</span>) G כבר אפור → אין קדקוד לבן. מסיימים: <span dir=\"ltr\">f[F]=4</span>." },
    { ty: "d", v: "H", t: 5, e: ["G", "H"],
      x: "חוזרים ל-G ודרך <span dir=\"ltr\">G→H</span> מגלים את H. <span dir=\"ltr\">d[H]=5</span>." },
    { ty: "f", v: "H", t: 6,
      x: "השכן היחיד של H הוא הלולאה העצמית <span dir=\"ltr\">H→H</span>. מסיימים: <span dir=\"ltr\">f[H]=6</span>." },
    { ty: "f", v: "G", t: 7,
      x: "כל שכני G (F,H) טופלו. מסיימים: <span dir=\"ltr\">f[G]=7</span>." },
    { ty: "d", v: "D", t: 8, e: ["C", "D"],
      x: "חוזרים ל-C ודרך <span dir=\"ltr\">C→D</span> מגלים את D. <span dir=\"ltr\">d[D]=8</span>." },
    { ty: "f", v: "D", t: 9,
      x: "שכני D (C אפור, H שחור) טופלו. מסיימים: <span dir=\"ltr\">f[D]=9</span>." },
    { ty: "f", v: "C", t: 10,
      x: "כל שכני C טופלו. מסיימים: <span dir=\"ltr\">f[C]=10</span>. המחסנית התרוקנה — עץ ה-DFS הראשון הושלם: {C,G,F,H,D}." },
    { ty: "d", v: "B", t: 11, root: true,
      x: "הקדקוד הלבן הבא הוא <b dir=\"ltr\">B</b> → שורש עץ DFS שני. <span dir=\"ltr\">d[B]=11</span>." },
    { ty: "d", v: "E", t: 12, e: ["B", "E"],
      x: "מ-B: הקשת <span dir=\"ltr\">B→C</span> מובילה ל-C שכבר טופל, ולכן דרך <span dir=\"ltr\">B→E</span> מגלים את E. <span dir=\"ltr\">d[E]=12</span>." },
    { ty: "d", v: "A", t: 13, e: ["E", "A"],
      x: "מ-E דרך <span dir=\"ltr\">E→A</span> מגלים את A. <span dir=\"ltr\">d[A]=13</span>." },
    { ty: "f", v: "A", t: 14,
      x: "שכן A→B מוביל ל-B אפור. מסיימים: <span dir=\"ltr\">f[A]=14</span>." },
    { ty: "f", v: "E", t: 15,
      x: "שכני E (A,F) טופלו. מסיימים: <span dir=\"ltr\">f[E]=15</span>." },
    { ty: "f", v: "B", t: 16,
      x: "כל שכני B טופלו. מסיימים: <span dir=\"ltr\">f[B]=16</span>. <b>DFS(G) הסתיים</b> — בידינו כל זמני הסיום." }
  ];
  var P2 = [
    { ty: "d", v: "B", t: 1, root: true,
      x: "DFS שני, על G^T, בסדר f יורד. הראשון הוא <b dir=\"ltr\">B</b> (<span dir=\"ltr\">f=16</span>) → שורש עץ = <b>רכיב חדש</b>. <span dir=\"ltr\">d[B]=1</span>." },
    { ty: "d", v: "A", t: 2, e: ["B", "A"],
      x: "ב-G^T מ-B דרך <span dir=\"ltr\">B→A</span> מגלים את A — מצטרף לרכיב הנוכחי. <span dir=\"ltr\">d[A]=2</span>." },
    { ty: "d", v: "E", t: 3, e: ["A", "E"],
      x: "מ-A דרך <span dir=\"ltr\">A→E</span> מגלים את E — מצטרף. <span dir=\"ltr\">d[E]=3</span>." },
    { ty: "f", v: "E", t: 4,
      x: "שכן E→B מוביל ל-B אפור. מסיימים: <span dir=\"ltr\">f[E]=4</span>." },
    { ty: "f", v: "A", t: 5,
      x: "מסיימים: <span dir=\"ltr\">f[A]=5</span>." },
    { ty: "f", v: "B", t: 6,
      x: "מסיימים: <span dir=\"ltr\">f[B]=6</span>. המחסנית ריקה — העץ הושלם → <b>רכיב קשיר היטב {A,B,E}</b>." },
    { ty: "d", v: "C", t: 7, root: true,
      x: "הקדקוד הלבן הבא בסדר f היורד הוא <b dir=\"ltr\">C</b> (<span dir=\"ltr\">f=10</span>) → שורש → רכיב חדש. <span dir=\"ltr\">d[C]=7</span>." },
    { ty: "d", v: "D", t: 8, e: ["C", "D"],
      x: "מ-C דרך <span dir=\"ltr\">C→D</span> מגלים את D (הקשת <span dir=\"ltr\">C→B</span> מובילה ל-B שכבר טופל). <span dir=\"ltr\">d[D]=8</span>." },
    { ty: "f", v: "D", t: 9,
      x: "מסיימים: <span dir=\"ltr\">f[D]=9</span>." },
    { ty: "f", v: "C", t: 10,
      x: "מסיימים: <span dir=\"ltr\">f[C]=10</span>. העץ הושלם → <b>רכיב {C,D}</b>." },
    { ty: "d", v: "G", t: 11, root: true,
      x: "הבא הלבן בסדר f: <b dir=\"ltr\">G</b> (<span dir=\"ltr\">f=7</span>) → שורש → רכיב חדש. <span dir=\"ltr\">d[G]=11</span>." },
    { ty: "d", v: "F", t: 12, e: ["G", "F"],
      x: "מ-G דרך <span dir=\"ltr\">G→F</span> מגלים את F. <span dir=\"ltr\">d[F]=12</span>." },
    { ty: "f", v: "F", t: 13,
      x: "שכני F (B,E,G) טופלו. מסיימים: <span dir=\"ltr\">f[F]=13</span>." },
    { ty: "f", v: "G", t: 14,
      x: "מסיימים: <span dir=\"ltr\">f[G]=14</span>. העץ הושלם → <b>רכיב {F,G}</b>." },
    { ty: "d", v: "H", t: 15, root: true,
      x: "נותר רק <b dir=\"ltr\">H</b> (<span dir=\"ltr\">f=6</span>) → שורש → רכיב חדש. <span dir=\"ltr\">d[H]=15</span>." },
    { ty: "f", v: "H", t: 16,
      x: "השכן היחיד הוא הלולאה <span dir=\"ltr\">H→H</span>. מסיימים: <span dir=\"ltr\">f[H]=16</span>. <b>רכיב {H}</b> — DFS(G^T) הסתיים, 4 רכיבים." }
  ];

  /* =====================================================================
     Build the flat list of step snapshots (pure data → render consumes).
     ===================================================================== */
  function cp(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }

  function buildSteps() {
    var steps = [];

    /* phase 1: intro */
    steps.push({
      phase: 1, graph: "G", pass: "—", clock: null,
      dtab: {}, ftab: {}, color: {}, stack: [], roots: {}, scc: {}, treeEdges: [],
      activeV: null, activeE: null,
      listMode: "finish", finishList: [], sortPtr: -1, bubbles: false,
      badge: "שלב 1 · DFS(G)", badgeColor: C.blue,
      title: "גרף הדוגמה G",
      body: "זהו גרף הדוגמה מההרצאה: 8 קדקודים (A–D למעלה, E–H למטה) עם קשתות מכוונות. " +
        "המטרה — למצוא את הרכיבים הקשירים היטב (<span dir=\"ltr\">SCC</span>). " +
        "<b>שלב 1:</b> נריץ <span dir=\"ltr\">DFS(G)</span> ונחשב לכל קדקוד זמן סיום <span dir=\"ltr\">f</span>. לחצו „הבא”."
    });

    /* phase 1: DFS(G) events */
    (function () {
      var d = {}, f = {}, col = {}, stack = [], roots = {}, tEdges = [], flist = [];
      P1.forEach(function (ev) {
        if (ev.ty === "d") {
          d[ev.v] = ev.t; col[ev.v] = "gray"; stack.push(ev.v);
          if (ev.root) roots[ev.v] = true;
          if (ev.e) tEdges = tEdges.concat([{ from: ev.e[0], to: ev.e[1], color: C.blue }]);
        } else {
          f[ev.v] = ev.t; col[ev.v] = "black"; stack.pop(); flist.push(ev.v);
        }
        steps.push({
          phase: 1, graph: "G", pass: "DFS(G)", clock: ev.t,
          dtab: cp(d), ftab: cp(f), color: cp(col), stack: stack.slice(),
          roots: cp(roots), scc: {}, treeEdges: tEdges.slice(),
          activeV: ev.v, activeE: ev.e || null,
          listMode: "finish", finishList: flist.slice(), sortPtr: -1, bubbles: false,
          badge: (ev.ty === "d" ? "d[" + ev.v + "] = " + ev.t : "f[" + ev.v + "] = " + ev.t),
          badgeColor: (ev.ty === "d" ? C.blue : C.mustard),
          title: "DFS(G) · שעון t=" + ev.t,
          body: ev.x
        });
      });
    })();

    /* phase 2: transpose */
    steps.push({
      phase: 2, graph: "GT", pass: "—", clock: null,
      dtab: cp(P1D), ftab: cp(P1F), color: allBlack(), stack: [], roots: {}, scc: {},
      treeEdges: [], activeV: null, activeE: null,
      listMode: "finish", finishList: ["F", "H", "G", "D", "C", "A", "E", "B"], sortPtr: -1, bubbles: false,
      badge: "שלב 2 · G^T", badgeColor: C.clay,
      title: "בונים את הגרף המשוחלף G^T",
      body: "הופכים את כיוון <b>כל</b> קשת: <span dir=\"ltr\">u→v</span> הופכת ל-<span dir=\"ltr\">v→u</span>. " +
        "שימו לב — הקשתות הדו-כיווניות <span dir=\"ltr\">C↔D</span> ו-<span dir=\"ltr\">F↔G</span> נשארות זהות, וכך גם הלולאה <span dir=\"ltr\">H→H</span>. " +
        "זמני ה-<span dir=\"ltr\">d/f</span> שחישבנו ב-DFS(G) נשמרים לצורך המיון."
    });

    /* phase 3: sort by decreasing f */
    steps.push({
      phase: 3, graph: "GT", pass: "—", clock: null,
      dtab: cp(P1D), ftab: cp(P1F), color: allBlack(), stack: [], roots: {}, scc: {},
      treeEdges: [], activeV: null, activeE: null,
      listMode: "sort", finishList: [], sortPtr: -1, bubbles: false, sortAll: true,
      badge: "שלב 3 · מיון f↓", badgeColor: C.slate,
      title: "ממיינים את V בסדר יורד של f",
      body: "מסדרים את הקדקודים לפי <span dir=\"ltr\">f</span> יורד — זה בדיוק <b>היפוך סדר הסיום</b> של DFS(G). " +
        "הסדר המתקבל: <b dir=\"ltr\">B, E, A, C, D, G, H, F</b>. לפי סדר זה נבחר את שורשי ה-DFS השני. " +
        "(המיון עצמו ב-<span dir=\"ltr\">Θ(V)</span> במיון מנייה, כי <span dir=\"ltr\">f∈[1,2|V|]</span>.)"
    });

    /* phase 4: DFS(G^T) events */
    (function () {
      var d = {}, f = {}, col = {}, stack = [], roots = {}, tEdges = [], scc = {};
      var tree = -1;
      P2.forEach(function (ev) {
        if (ev.ty === "d") {
          if (ev.root) { tree++; roots[ev.v] = true; }
          d[ev.v] = ev.t; col[ev.v] = "gray"; stack.push(ev.v); scc[ev.v] = tree;
          if (ev.e) tEdges = tEdges.concat([{ from: ev.e[0], to: ev.e[1], color: SCC_FILL[tree] }]);
        } else {
          f[ev.v] = ev.t; col[ev.v] = "black"; stack.pop();
        }
        /* sort pointer = index in SORTED of current active vertex */
        var sp = SORTED.indexOf(ev.v);
        steps.push({
          phase: 4, graph: "GT", pass: "DFS(G^T)", clock: ev.t,
          dtab: cp(d), ftab: cp(f), color: cp(col), stack: stack.slice(),
          roots: cp(roots), scc: cp(scc), treeEdges: tEdges.slice(),
          activeV: ev.v, activeE: ev.e || null,
          listMode: "sort", finishList: [], sortPtr: sp, bubbles: false,
          badge: (ev.ty === "d" ? "d[" + ev.v + "] = " + ev.t : "f[" + ev.v + "] = " + ev.t),
          badgeColor: (ev.ty === "d" ? C.blue : C.mustard),
          title: "DFS(G^T) · שעון t=" + ev.t,
          body: ev.x
        });
      });
    })();

    /* phase 5a: the four SCCs (bubbles) */
    var fullScc = {};
    SCC_MEMBERS.forEach(function (m, i) { m.forEach(function (v) { fullScc[v] = i; }); });
    var allTreeEdges = [];
    P2.forEach(function (ev) {
      if (ev.ty === "d" && ev.e) allTreeEdges.push({ from: ev.e[0], to: ev.e[1], color: SCC_FILL[fullScc[ev.v]] });
    });
    steps.push({
      phase: 5, graph: "GT", pass: "DFS(G^T)", clock: 16,
      dtab: cp(P2D()), ftab: cp(P2F()), color: allBlack(), stack: [],
      roots: { B: true, C: true, G: true, H: true }, scc: cp(fullScc),
      treeEdges: allTreeEdges, activeV: null, activeE: null,
      listMode: "sort", finishList: [], sortPtr: -1, bubbles: true,
      badge: "שלב 4 · הפלט", badgeColor: C.sage,
      title: "ארבעת הרכיבים הקשירים היטב",
      body: "כל עץ ביער ה-DFS של G^T הוא <b>רכיב קשיר היטב</b>. קיבלנו 4 רכיבים: " +
        "<b style=\"color:" + C.mustard + "\">{A,B,E}</b>, " +
        "<b style=\"color:" + C.sage + "\">{C,D}</b>, " +
        "<b style=\"color:" + C.clay + "\">{F,G}</b>, " +
        "<b style=\"color:" + C.slate + "\">{H}</b> (רכיב יחיד עם לולאה עצמית)."
    });

    /* phase 5b: condensation DAG */
    steps.push({
      phase: 5, graph: "COND", pass: "—", clock: null,
      dtab: cp(P2D()), ftab: cp(P2F()), color: allBlack(), stack: [],
      roots: {}, scc: cp(fullScc), treeEdges: [], activeV: null, activeE: null,
      listMode: "sort", finishList: [], sortPtr: -1, bubbles: false, cond: true,
      badge: "שלב 5 · G^scc (DAG)", badgeColor: C.blue,
      title: "גרף הרכיבים (condensation)",
      body: "מכווצים כל רכיב לקדקוד יחיד → <span dir=\"ltr\">G^scc</span>. יש קשת בין רכיבים אם קיימת קשת ב-G ביניהם: " +
        "<span dir=\"ltr\">ABE→CD</span>, <span dir=\"ltr\">ABE→FG</span>, <span dir=\"ltr\">CD→FG</span>, " +
        "<span dir=\"ltr\">CD→H</span>, <span dir=\"ltr\">FG→H</span>. " +
        "גרף הרכיבים הוא <b>תמיד DAG</b> (גרף מכוון ללא מעגלים) — כפי שמוכיחים בתרגיל 1."
    });

    return steps;
  }

  function allBlack() { var o = {}; VERTS.forEach(function (v) { o[v] = "black"; }); return o; }
  function P2D() { return { A: 2, B: 1, C: 7, D: 8, E: 3, F: 12, G: 11, H: 15 }; }
  function P2F() { return { A: 5, B: 6, C: 10, D: 9, E: 4, F: 13, G: 14, H: 16 }; }

  var STEPS = buildSteps();

  /* phase → index of its first step (for the phase-jump chips) */
  var PHASE_FIRST = [];
  (function () {
    for (var i = 0; i < STEPS.length; i++) {
      var p = STEPS[i].phase;
      if (PHASE_FIRST[p - 1] == null) PHASE_FIRST[p - 1] = i;
    }
  })();
  var PHASE_LABELS = ["DFS(G)", "G^T", "מיון f↓", "DFS(G^T)", "גרף הרכיבים"];

  /* =====================================================================
     small helpers
     ===================================================================== */
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
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* geometry for straight directed edge a→b (shortened to circle borders) */
  function segPath(a, b) {
    var A = POS[a], B = POS[b];
    var dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
    var ux = dx / L, uy = dy / L;
    var x1 = A.x + ux * R, y1 = A.y + uy * R;
    var x2 = B.x - ux * (R + 8), y2 = B.y - uy * (R + 8);
    return "M" + x1.toFixed(1) + " " + y1.toFixed(1) + " L" + x2.toFixed(1) + " " + y2.toFixed(1);
  }
  /* curved arc for one direction of a bidirectional pair */
  function arcPath(a, b, side) {
    var A = POS[a], B = POS[b];
    var dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
    var ux = dx / L, uy = dy / L;         /* along */
    var px = -uy, py = ux;                /* perpendicular */
    var off = 16 * side;
    var x1 = A.x + ux * R + px * off * 0.5, y1 = A.y + uy * R + py * off * 0.5;
    var x2 = B.x - ux * (R + 8) + px * off * 0.5, y2 = B.y - uy * (R + 8) + py * off * 0.5;
    var mx = (A.x + B.x) / 2 + px * off, my = (A.y + B.y) / 2 + py * off;
    return "M" + x1.toFixed(1) + " " + y1.toFixed(1) + " Q" + mx.toFixed(1) + " " + my.toFixed(1) +
      " " + x2.toFixed(1) + " " + y2.toFixed(1);
  }
  function selfPath(v) {
    var P = POS[v];
    var x = P.x, y = P.y + R;
    return "M" + (x - 9) + " " + (y - 2) +
      " C" + (x - 40) + " " + (y + 46) + " " + (x + 40) + " " + (y + 46) + " " + (x + 9) + " " + (y - 2);
  }

  /* =====================================================================
     Build the (persistent) SVG scene once; return handles for updates.
     ===================================================================== */
  var EDGE_MARKER_COLORS = ["#A99B80", C.blue, C.mustard, C.sage, C.clay, C.slate];
  function markerId(color) {
    var i = EDGE_MARKER_COLORS.indexOf(color);
    return "scc-arr-" + (i < 0 ? 0 : i);
  }

  function buildScene() {
    var W = 595, H = 340;
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H, width: "100%",
      role: "img", direction: "ltr",
      "aria-label": "אלגוריתם SCC צעד-אחר-צעד על גרף הדוגמה מההרצאה"
    });
    svg.style.display = "block";
    svg.style.maxWidth = W + "px";
    svg.style.margin = "0 auto";

    var defs = el("defs");
    EDGE_MARKER_COLORS.forEach(function (color, i) {
      var m = el("marker", {
        id: "scc-arr-" + i, viewBox: "0 0 10 10", refX: "8.5", refY: "5",
        markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse"
      });
      m.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", fill: color }));
      defs.appendChild(m);
    });
    svg.appendChild(defs);

    var gMain = el("g");     /* graph (edges + bubbles + vertices) */
    var gBubbles = el("g");  /* SCC blobs (below edges) */
    var gEdges = el("g");
    var gVerts = el("g");
    gMain.appendChild(gBubbles);
    gMain.appendChild(gEdges);
    gMain.appendChild(gVerts);
    svg.appendChild(gMain);

    /* ---- SCC bubbles (group-opacity blobs; robust vs. scattered layout) ---- */
    SCC_MEMBERS.forEach(function (mem, i) {
      var g = el("g", { opacity: 0, fill: SCC_FILL[i], stroke: SCC_FILL[i] });
      mem.forEach(function (v) {
        g.appendChild(el("circle", { cx: POS[v].x, cy: POS[v].y, r: 33, "stroke-width": 0 }));
      });
      for (var a = 0; a < mem.length; a++)
        for (var b = a + 1; b < mem.length; b++)
          g.appendChild(el("line", {
            x1: POS[mem[a]].x, y1: POS[mem[a]].y, x2: POS[mem[b]].x, y2: POS[mem[b]].y,
            "stroke-width": 26, "stroke-linecap": "round"
          }));
      gBubbles.appendChild(g);
    });

    /* ---- edges ---- */
    var edgePaths = [];   /* {el, kind, a, b, from, to} */
    DIR.forEach(function (e) {
      var p = el("path", { fill: "none", "stroke-linecap": "round" });
      gEdges.appendChild(p);
      edgePaths.push({ el: p, kind: "dir", a: e[0], b: e[1], from: e[0], to: e[1] });
    });
    BI.forEach(function (e) {
      var p1 = el("path", { fill: "none", "stroke-linecap": "round" });
      var p2 = el("path", { fill: "none", "stroke-linecap": "round" });
      gEdges.appendChild(p1); gEdges.appendChild(p2);
      edgePaths.push({ el: p1, kind: "bi", a: e[0], b: e[1], from: e[0], to: e[1], side: 1 });
      edgePaths.push({ el: p2, kind: "bi", a: e[1], b: e[0], from: e[1], to: e[0], side: 1 });
    });
    SELF.forEach(function (v) {
      var p = el("path", { fill: "none", "stroke-linecap": "round", d: selfPath(v) });
      gEdges.appendChild(p);
      edgePaths.push({ el: p, kind: "self", a: v, b: v, from: v, to: v });
    });

    /* ---- vertices ---- */
    var vg = {};
    VERTS.forEach(function (v) {
      var P = POS[v];
      var g = el("g");
      var rootRing = el("circle", {
        cx: P.x, cy: P.y, r: R + 6, fill: "none", stroke: C.clay,
        "stroke-width": 2, "stroke-dasharray": "4 3", opacity: 0
      });
      var pulse = el("circle", {
        cx: P.x, cy: P.y, r: R + 3, fill: "none", stroke: C.blue, "stroke-width": 3, opacity: 0
      });
      var circle = el("circle", {
        cx: P.x, cy: P.y, r: R, fill: C.surface, stroke: C.line, "stroke-width": 2
      });
      var label = txt(P.x, P.y + 6, v, {
        "text-anchor": "middle", "font-size": 18, "font-weight": 800,
        fill: C.ink, "font-family": "monospace"
      });
      var df = txt(P.x, P.y + R + 16, "", {
        "text-anchor": "middle", "font-size": 12, "font-weight": 700,
        fill: C.inkSoft, "font-family": "monospace"
      });
      g.appendChild(rootRing); g.appendChild(pulse); g.appendChild(circle);
      g.appendChild(label); g.appendChild(df);
      gVerts.appendChild(g);
      vg[v] = { g: g, circle: circle, label: label, df: df, rootRing: rootRing, pulse: pulse };
      if (!reducedMotion()) {
        circle.style.transition = "fill .25s ease, stroke .25s ease";
      }
    });

    /* ---- condensation DAG (hidden until phase 5b) ---- */
    var gCond = el("g", { opacity: 0 });
    gCond.setAttribute("display", "none");
    svg.appendChild(gCond);
    var condPos = {
      ABE: { x: 110, y: 90 }, CD: { x: 320, y: 90 },
      FG: { x: 320, y: 250 }, H: { x: 505, y: 170 }
    };
    var condEdges = [["ABE", "CD"], ["ABE", "FG"], ["CD", "FG"], ["CD", "H"], ["FG", "H"]];
    var CW = 96, CH = 50;
    function condCenter(k) { return { x: condPos[k].x, y: condPos[k].y }; }
    condEdges.forEach(function (e) {
      var A = condCenter(e[0]), B = condCenter(e[1]);
      var dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
      var ux = dx / L, uy = dy / L;
      /* stop at rectangle-ish boundary (approx via ellipse of CW/2,CH/2) */
      var rA = 1 / Math.hypot(ux / (CW / 2 + 4), uy / (CH / 2 + 4));
      var rB = 1 / Math.hypot(ux / (CW / 2 + 10), uy / (CH / 2 + 10));
      var x1 = A.x + ux * rA, y1 = A.y + uy * rA;
      var x2 = B.x - ux * rB, y2 = B.y - uy * rB;
      gCond.appendChild(el("path", {
        d: "M" + x1.toFixed(1) + " " + y1.toFixed(1) + " L" + x2.toFixed(1) + " " + y2.toFixed(1),
        fill: "none", stroke: "#A99B80", "stroke-width": 2.4, "stroke-linecap": "round",
        "marker-end": "url(#scc-arr-0)"
      }));
    });
    SCC_NAME.forEach(function (name, i) {
      var P = condPos[name];
      var g = el("g");
      g.appendChild(el("rect", {
        x: P.x - CW / 2, y: P.y - CH / 2, width: CW, height: CH, rx: 12,
        fill: SCC_FILL[i], stroke: "rgba(0,0,0,.14)", "stroke-width": 1.5
      }));
      g.appendChild(txt(P.x, P.y + 3, "{" + SCC_MEMBERS[i].join(",") + "}", {
        "text-anchor": "middle", "font-size": 15, "font-weight": 800, fill: "#fff", "font-family": "monospace"
      }));
      g.appendChild(txt(P.x, P.y + 19, "SCC", {
        "text-anchor": "middle", "font-size": 8.5, "font-weight": 700, fill: "rgba(255,255,255,.85)"
      }));
      gCond.appendChild(g);
    });

    return { svg: svg, gMain: gMain, gCond: gCond, edgePaths: edgePaths, vg: vg,
      bubbles: Array.prototype.slice.call(gBubbles.childNodes) };
  }

  /* =====================================================================
     Apply a snapshot to the persistent scene (idempotent).
     ===================================================================== */
  function applySnap(scene, snap) {
    var vg = scene.vg;

    /* graph vs condensation */
    if (snap.graph === "COND") {
      scene.gMain.setAttribute("display", "none");
      scene.gCond.setAttribute("display", "");
      scene.gCond.setAttribute("opacity", 1);
      return; /* condensation is fully static */
    }
    scene.gMain.setAttribute("display", "");
    scene.gCond.setAttribute("display", "none");
    scene.gCond.setAttribute("opacity", 0);

    /* edge directions for G vs G^T (dir edges flip in G^T) */
    var isGT = (snap.graph === "GT");
    scene.edgePaths.forEach(function (ep) {
      if (ep.kind === "dir") {
        var from = isGT ? ep.b : ep.a, to = isGT ? ep.a : ep.b;
        ep.from = from; ep.to = to;
        ep.el.setAttribute("d", segPath(from, to));
      } else if (ep.kind === "bi") {
        ep.el.setAttribute("d", arcPath(ep.from, ep.to, ep.side));
      }
      /* default styling */
      ep.el.setAttribute("stroke", "#CFC3AC");
      ep.el.setAttribute("stroke-width", "2");
      ep.el.setAttribute("opacity", "1");
      ep.el.setAttribute("marker-end", "url(#" + markerId("#A99B80") + ")");
    });

    /* tree edges (DFS forest) — colour them */
    (snap.treeEdges || []).forEach(function (te) {
      var ep = findEdge(scene, te.from, te.to);
      if (ep) {
        ep.el.setAttribute("stroke", te.color);
        ep.el.setAttribute("stroke-width", "3");
        ep.el.setAttribute("marker-end", "url(#" + markerId(te.color) + ")");
      }
    });
    /* active edge — brightest */
    if (snap.activeE) {
      var ea = findEdge(scene, snap.activeE[0], snap.activeE[1]);
      if (ea) { ea.el.setAttribute("stroke-width", "4"); }
    }

    /* SCC bubbles */
    scene.bubbles.forEach(function (g, i) {
      var on = snap.bubbles && hasSccMember(snap, i);
      g.setAttribute("opacity", on ? 0.2 : 0);
    });

    /* vertices */
    VERTS.forEach(function (v) {
      var h = vg[v];
      var fill, txtCol, stroke;
      if (snap.scc && v in snap.scc) {
        fill = SCC_FILL[snap.scc[v]]; txtCol = "#fff"; stroke = "rgba(0,0,0,.12)";
      } else if (snap.color[v] === "gray") {
        fill = C.blue; txtCol = "#fff"; stroke = "rgba(0,0,0,.10)";
      } else if (snap.color[v] === "black") {
        fill = C.black; txtCol = "#fff"; stroke = "rgba(0,0,0,.10)";
      } else {
        fill = C.surface; txtCol = C.ink; stroke = C.line;
      }
      h.circle.setAttribute("fill", fill);
      h.circle.setAttribute("stroke", stroke);
      h.label.setAttribute("fill", txtCol);

      var d = snap.dtab[v], f = snap.ftab[v];
      var s = "";
      if (d != null && f != null) s = d + "/" + f;
      else if (d != null) s = d + "/·";
      h.df.textContent = s;

      h.rootRing.setAttribute("opacity", snap.roots[v] ? 1 : 0);
      h.pulse.setAttribute("opacity", (snap.activeV === v) ? 1 : 0);
    });

    /* active pulse animation */
    if (snap.activeV && !reducedMotion()) {
      var pc = vg[snap.activeV].pulse;
      if (pc.animate) {
        try {
          pc.animate(
            [{ opacity: 0.9, strokeWidth: 3 }, { opacity: 0, strokeWidth: 9 }],
            { duration: 700, iterations: 1 }
          );
        } catch (e) {}
      }
    }
  }

  function findEdge(scene, from, to) {
    for (var i = 0; i < scene.edgePaths.length; i++) {
      var ep = scene.edgePaths[i];
      if (ep.from === from && ep.to === to) return ep;
    }
    return null;
  }
  function hasSccMember(snap, sccIdx) {
    for (var v in snap.scc) if (snap.scc[v] === sccIdx) return true;
    return false;
  }

  /* =====================================================================
     Render into a mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-scc-ready") === "1") return;
    mount.setAttribute("data-scc-ready", "1");
    mount.innerHTML = "";

    var idx = 0;
    var autoTimer = null;

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "מדגים SCC צעד-אחר-צעד — חצים להחלפת צעד");

    /* ---- phase-jump chips ---- */
    var phaseRow = document.createElement("div");
    phaseRow.className = "viz-controls";
    phaseRow.style.marginTop = "0";
    phaseRow.style.marginBottom = ".7rem";
    phaseRow.setAttribute("role", "tablist");
    phaseRow.setAttribute("aria-label", "שלבי האלגוריתם");
    var phaseChips = PHASE_LABELS.map(function (lbl, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn";
      b.setAttribute("role", "tab");
      b.style.padding = ".28rem .7rem";
      b.style.fontSize = ".82rem";
      b.innerHTML = '<span dir="ltr" style="opacity:.65">' + (i + 1) + '</span>&nbsp; ' +
        '<span dir="ltr">' + esc(lbl) + '</span>';
      b.addEventListener("click", function () { stopAuto(); goto(PHASE_FIRST[i]); });
      phaseRow.appendChild(b);
      return b;
    });
    wrap.appendChild(phaseRow);

    /* ---- scene ---- */
    var scene = buildScene();
    var sceneBox = document.createElement("div");
    sceneBox.style.background = C.surface;
    sceneBox.style.borderRadius = "12px";
    sceneBox.style.border = "1px solid " + C.line;
    sceneBox.style.padding = "8px 4px";
    sceneBox.appendChild(scene.svg);
    wrap.appendChild(sceneBox);

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
    panel.style.fontSize = ".92rem";
    wrap.appendChild(panel);

    /* ---- bookkeeping area ---- */
    var book = document.createElement("div");
    book.style.marginTop = "12px";
    book.style.display = "grid";
    book.style.gap = "12px";
    book.style.gridTemplateColumns = "1fr";
    wrap.appendChild(book);

    /* d/f table (scrollable on narrow screens) */
    var tableWrap = document.createElement("div");
    tableWrap.style.overflowX = "auto";
    tableWrap.style.background = C.surface;
    tableWrap.style.border = "1px solid " + C.line;
    tableWrap.style.borderRadius = "12px";
    tableWrap.style.padding = "10px 12px";
    book.appendChild(tableWrap);

    /* side info: stack + order list + scc legend */
    var side = document.createElement("div");
    side.style.display = "grid";
    side.style.gap = "10px";
    book.appendChild(side);

    var stackBox = infoBox();
    var listBox = infoBox();
    var legendBox = infoBox();
    side.appendChild(stackBox);
    side.appendChild(listBox);
    side.appendChild(legendBox);

    function infoBox() {
      var d = document.createElement("div");
      d.style.background = C.surface;
      d.style.border = "1px solid " + C.line;
      d.style.borderRadius = "12px";
      d.style.padding = "10px 12px";
      d.style.fontSize = ".86rem";
      d.style.color = C.ink;
      return d;
    }

    /* ---- controls ---- */
    var controls = document.createElement("div");
    controls.className = "viz-controls";
    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); goto(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); goto(idx + 1); }, true);
    var btnPlay = mkBtn("▶ הפעל", function () { toggleAuto(); });
    var btnReset = mkBtn("↺ איפוס", function () { stopAuto(); goto(0); });
    var counter = document.createElement("span");
    counter.style.marginInlineStart = "auto";
    counter.style.fontSize = ".85rem";
    counter.style.color = C.inkSoft;
    counter.style.fontFamily = "monospace";
    controls.appendChild(btnPrev);
    controls.appendChild(btnNext);
    controls.appendChild(btnPlay);
    controls.appendChild(btnReset);
    controls.appendChild(counter);
    wrap.appendChild(controls);

    /* SR live region */
    var status = document.createElement("p");
    status.setAttribute("aria-live", "polite");
    status.style.cssText =
      "position:absolute;width:1px;height:1px;margin:-1px;padding:0;" +
      "overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;";
    wrap.appendChild(status);

    mount.appendChild(wrap);

    function mkBtn(label, fn, primary) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn" + (primary ? " primary" : "");
      b.textContent = label;
      b.addEventListener("click", fn);
      return b;
    }

    /* ---- rendering of DOM panels ---- */
    function renderTable(snap) {
      var pass = snap.pass !== "—" ? snap.pass : "DFS(G)/DFS(G^T)";
      var html = '<div style="font-size:.8rem;color:' + C.inkSoft + ';margin-bottom:6px">' +
        'זמני גילוי/סיום <span dir="ltr">d/f</span>' +
        (snap.pass !== "—" ? ' · <span dir="ltr">' + esc(snap.pass) + '</span>' : '') + '</div>';
      html += '<table style="border-collapse:collapse;font-family:monospace;font-size:.9rem;width:100%;min-width:360px" dir="ltr"><tbody>';
      var rows = [["v", null], ["d", "dtab"], ["f", "ftab"]];
      rows.forEach(function (row) {
        html += '<tr>';
        html += '<td style="text-align:center;font-weight:800;color:' + C.inkSoft +
          ';padding:3px 6px;border-bottom:1px solid ' + C.line + '">' + row[0] + '</td>';
        VERTS.forEach(function (v) {
          var active = (snap.activeV === v);
          var cellBg = active ? C.blue : "transparent";
          var cellFg = active ? "#fff" : C.ink;
          var content;
          if (row[1] === null) {
            content = v;
          } else {
            var val = snap[row[1]][v];
            content = (val == null) ? '<span style="color:' + C.line + '">·</span>' : val;
          }
          html += '<td style="text-align:center;min-width:30px;padding:3px 6px;font-weight:700;' +
            'background:' + cellBg + ';color:' + cellFg + ';border-radius:5px">' + content + '</td>';
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
      tableWrap.innerHTML = html;
    }

    function renderStack(snap) {
      var chips = snap.stack.map(function (v) {
        return '<span dir="ltr" style="display:inline-block;background:' + C.blue +
          ';color:#fff;font-family:monospace;font-weight:800;font-size:.9rem;' +
          'padding:2px 9px;border-radius:6px;margin-inline-end:4px">' + v + '</span>';
      }).join("");
      if (!chips) chips = '<span style="color:' + C.inkSoft + '">(ריקה)</span>';
      stackBox.innerHTML = '<div style="font-weight:700;margin-bottom:6px">מחסנית ה-DFS ' +
        '<span style="font-weight:400;color:' + C.inkSoft + ';font-size:.8rem">(המסלול האפור מהשורש)</span></div>' +
        '<div>' + chips + '</div>';
    }

    function renderList(snap) {
      if (snap.listMode === "finish") {
        var chips = snap.finishList.map(function (v) {
          return '<span dir="ltr" style="display:inline-block;background:' + C.surface2 +
            ';border:1px solid ' + C.line + ';color:' + C.ink +
            ';font-family:monospace;font-weight:700;padding:2px 8px;border-radius:6px;margin-inline-end:4px;margin-bottom:4px">' +
            v + '</span>';
        }).join("");
        if (!chips) chips = '<span style="color:' + C.inkSoft + '">—</span>';
        listBox.innerHTML = '<div style="font-weight:700;margin-bottom:6px">סדר הסיום ' +
          '<span style="font-weight:400;color:' + C.inkSoft + ';font-size:.8rem">(f עולה)</span></div>' +
          '<div>' + chips + '</div>';
      } else {
        /* sorted (decreasing f) order — used as 2nd-DFS root order */
        var full = {};
        SCC_MEMBERS.forEach(function (m, i) { m.forEach(function (v) { full[v] = i; }); });
        var chips2 = SORTED.map(function (v, i) {
          var assigned = (snap.scc && v in snap.scc);
          var bg = C.surface2, fg = C.ink, bd = C.line;
          if (snap.sortAll) { bg = C.surface2; }
          if (assigned) { bg = SCC_FILL[snap.scc[v]]; fg = "#fff"; bd = "transparent"; }
          var ring = (snap.sortPtr === i) ? ";outline:2px solid " + C.ink + ";outline-offset:1px" : "";
          return '<span dir="ltr" style="display:inline-block;background:' + bg +
            ';border:1px solid ' + bd + ';color:' + fg +
            ';font-family:monospace;font-weight:800;padding:2px 9px;border-radius:6px;margin-inline-end:4px;margin-bottom:4px' +
            ring + '">' + v + '</span>';
        }).join("");
        listBox.innerHTML = '<div style="font-weight:700;margin-bottom:6px">סדר עיבוד ' +
          '<span style="font-weight:400;color:' + C.inkSoft + ';font-size:.8rem">(f יורד = היפוך סדר הסיום)</span></div>' +
          '<div>' + chips2 + '</div>';
      }
    }

    function renderLegend(snap) {
      var items = SCC_NAME.map(function (name, i) {
        var found = hasSccMember(snap, i);
        return '<span style="display:inline-flex;align-items:center;gap:5px;opacity:' +
          (found ? 1 : 0.35) + ';margin-inline-end:12px;margin-bottom:4px">' +
          '<span style="width:13px;height:13px;border-radius:4px;background:' + SCC_FILL[i] +
          ';display:inline-block"></span>' +
          '<span dir="ltr" style="font-family:monospace;font-weight:700">{' + SCC_MEMBERS[i].join(",") + '}</span>' +
          '</span>';
      }).join("");
      legendBox.innerHTML = '<div style="font-weight:700;margin-bottom:6px">רכיבים קשירים היטב ' +
        '<span dir="ltr" style="font-weight:400;color:' + C.inkSoft + ';font-size:.8rem">(SCC)</span></div>' +
        '<div>' + items + '</div>';
    }

    function renderPanel(snap) {
      var clockChip = (snap.clock != null)
        ? '<span dir="ltr" style="background:' + C.ink + ';color:#fff;font-family:monospace;font-weight:700;' +
          'font-size:.72rem;padding:2px 9px;border-radius:99px">t = ' + snap.clock + '</span>'
        : '';
      panel.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px">' +
          '<span style="background:' + snap.badgeColor + ';color:#fff;font-weight:700;font-size:.74rem;' +
            'padding:2px 11px;border-radius:99px" dir="ltr">' + esc(snap.badge) + '</span>' +
          '<b style="font-size:1rem;color:' + C.ink + '">' + snap.title + '</b>' +
          clockChip +
        '</div>' +
        '<div>' + snap.body + '</div>';
    }

    /* ---- navigation ---- */
    function goto(n) {
      idx = Math.max(0, Math.min(STEPS.length - 1, n));
      var snap = STEPS[idx];
      applySnap(scene, snap);
      renderPanel(snap);
      renderTable(snap);
      renderStack(snap);
      renderList(snap);
      renderLegend(snap);

      phaseChips.forEach(function (b, i) {
        var on = (snap.phase - 1) === i;
        b.classList.toggle("primary", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      counter.textContent = "צעד " + (idx + 1) + " / " + STEPS.length;
      btnPrev.disabled = (idx === 0);
      btnNext.disabled = (idx === STEPS.length - 1);
      status.textContent = snap.title + ". " + snap.body.replace(/<[^>]+>/g, "");
    }

    /* ---- autoplay ---- */
    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      if (idx >= STEPS.length - 1) goto(0);
      btnPlay.textContent = "⏸ השהה";
      btnPlay.classList.add("primary");
      var delay = reducedMotion() ? 2000 : 1500;
      autoTimer = setInterval(function () {
        if (idx >= STEPS.length - 1) { stopAuto(); return; }
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
      else if (e.key === "End") { stopAuto(); goto(STEPS.length - 1); e.preventDefault(); }
    });

    goto(0);
  }

  /* =====================================================================
     boot: mount all instances; never throw.
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
