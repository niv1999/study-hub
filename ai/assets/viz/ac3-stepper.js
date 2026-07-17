/* =====================================================================
   ac3-stepper.js — Module 08 "עקביות קשתית — AC-3" (Arc Consistency)
   Grounded in _notes/arc-consistency.md (עמ' 2–16, Slide credits: CMU AI /
   ai.berkeley.edu) + _notes/csp2.md (עמ' 4,15 — the same Australia map).

   THE LECTURE EXAMPLE (exact, verbatim from arc-consistency.md):
     Variables : WA, NT, SA, Q, NSW, V, T  (Western Australia … Tasmania)
     Domain    : {אדום (red), ירוק (green), כחול (blue)} per variable
     Constraints (9, "≠" between every neighbouring pair):
       WA-NT, WA-SA, NT-SA, NT-Q, SA-Q, SA-NSW, SA-V, Q-NSW, NSW-V
     T (Tasmania) is an isolated vertex — no constraints, domain never
     shrinks (עמ' 2 note).

     "X->Y" in the deck's queue means REVISE(X,Y): fix X's domain against
     support Y. Arrows in the deck point INTO the variable that just
     changed (drawn here the same way: tail=X, head=Y).

   DEFAULT TRACE — WA=red (עמ' 2-16), reproduced arc-for-arc from the
   deck's own "Queue:" lines (transcribed verbatim, including two slides
   — 5 and 15 — that only bold the next arc with no data change, folded
   into the surrounding step): SA→WA, NT→WA reduce NT/SA to {ירוק,כחול};
   the rest of wave 1 (WA→SA … Q→NT) causes no change and the queue empties
   (עמ' 9). The deck then scripts a SECOND assignment from search,
   Q←ירוק (עמ' 9-11, the class's own Piazza-poll question "what gets
   added to the queue?" — answered K→Q, not Q→K), which cascades through
   NT→Q, SA→Q, NSW→Q and finally — one arc past what the deck shows,
   completing the "!!!" cliff-hanger on עמ' 16 exactly as the notes spell
   out — REVISE(SA,NT) empties SA: a domain wipe-out (CSP inconsistent,
   backtrack needed).

   The page copy (08-arc-consistency.html) also invites students to pick
   WA's OWN starting colour ("בחרו איזו הצבה ראשונית לתת ל-WA"). WA=green
   and WA=blue are not in the notes, so those two modes run a real, generic
   AC-3 (same REVISE + FIFO-queue engine, no hand-scripted queues) from
   that single assignment only — no invented follow-up assignment — and
   by the graph's colour symmetry they always settle arc-consistent with
   no wipe-out, a nice contrast to the red trace's cascade.

   Colours: only CSS custom properties (var(--accent) etc.), color-mix()
   for tints — both themes just work. R/G/B swatches reuse the exact
   mapping already established for this graph in map-coloring-lab.js:
   red≈clay, green≈sage, blue≈dusty-blue.

   Self-contained IIFE. Hand-authored SVG + DOM. No external deps. RTL
   Hebrew chrome, LTR graph/identifiers inside. Never throws; no-op if no
   mount present.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "ac3-stepper";
  var SVGNS = "http://www.w3.org/2000/svg";

  var VERTS = ["WA", "NT", "SA", "Q", "NSW", "V", "T"];
  var NEI = {
    WA: ["NT", "SA"], NT: ["WA", "SA", "Q"], SA: ["WA", "NT", "Q", "NSW", "V"],
    Q: ["NT", "SA", "NSW"], NSW: ["SA", "Q", "V"], V: ["SA", "NSW"], T: []
  };
  var EDGES = [
    ["WA", "NT"], ["WA", "SA"], ["NT", "SA"], ["NT", "Q"], ["SA", "Q"],
    ["SA", "NSW"], ["SA", "V"], ["Q", "NSW"], ["NSW", "V"]
  ];
  var FULL_HE = {
    WA: "אוסטרליה המערבית", NT: "הטריטוריה הצפונית", SA: "אוסטרליה הדרומית",
    Q: "קווינסלנד", NSW: "ניו סאות' ויילס", V: "ויקטוריה", T: "טסמניה"
  };
  var COLOR_VAR = { R: "var(--clay)", G: "var(--sage)", B: "var(--dusty-blue)" };
  var COLOR_HE = { R: "אדום", G: "ירוק", B: "כחול" };
  var FULL_DOM = ["R", "G", "B"];

  var POS = {
    NT: { x: 170, y: 58 }, Q: { x: 375, y: 52 }, WA: { x: 60, y: 155 },
    SA: { x: 245, y: 158 }, NSW: { x: 430, y: 165 }, V: { x: 320, y: 250 },
    T: { x: 505, y: 235 }
  };
  var VBW = 560, VBH = 300, NR = 23;

  function ltr(s) { return '<span dir="ltr">' + s + "</span>"; }
  function domHtml(list) { return list.map(function (c) { return COLOR_HE[c]; }).join(", "); }
  function arcTxt(a) { return a[0] + "→" + a[1]; }
  function arcList(arr) { return arr.map(arcTxt).join(", "); }
  function baseKey(u, v) { return u < v ? u + "_" + v : v + "_" + u; }
  function el(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function ce(tag, cls, parent, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  /* =====================================================================
     REVISE — the one true rule for this "≠" CSP: X loses value v only if
     Y is already a singleton equal to v (its only possible support fails).
     ===================================================================== */
  function revise(domains, X, Y) {
    if (domains[Y].length === 1) {
      var w = domains[Y][0], i = domains[X].indexOf(w);
      if (i !== -1) { domains[X].splice(i, 1); return w; }
    }
    return null;
  }

  /* shared narration builders (mechanically identical in every mode) */
  function reviseChangeStep(X, Y, removed, domXAfter, addedArcs) {
    return {
      type: "revise-change", arc: [X, Y], removed: removed, changed: X,
      wipeoutVar: null, addedArcs: addedArcs,
      badge: "הסרה", badgeVar: "var(--err)",
      title: ltr("REVISE(" + X + ", " + Y + ")") + " — מסירים " + COLOR_HE[removed],
      body: "בשלב הזה " + ltr(Y) + " הוא כבר דומיין יחיד {" + COLOR_HE[removed] +
        "}, ולכן הערך <b>" + COLOR_HE[removed] + "</b> ב-" + ltr(X) +
        " נשאר בלי שום ערך שונה שתומך בו ⇒ מוסר. דומיין " + ltr(X) + " מצטמצם ל-{" +
        domHtml(domXAfter) + "}. מכיוון שדומיין " + ltr(X) + " השתנה, מוסיפים בסוף " +
        "התור קשתות " + ltr("K→" + X) + " עבור כל שכן שלו: " +
        ltr(addedArcs.map(function (a) { return a[0]; }).join(", ")) + "."
    };
  }
  function reviseNoChangeStep(X, Y, domX, domY) {
    return {
      type: "revise-nochange", arc: [X, Y], removed: null, changed: null,
      wipeoutVar: null, addedArcs: [],
      badge: "תקין", badgeVar: "var(--ink-soft)",
      title: ltr("REVISE(" + X + ", " + Y + ")") + " — אין שינוי",
      body: "לכל ערך בדומיין " + ltr(X) + "={" + domHtml(domX) + "} יש ערך שונה " +
        "שנתמך בדומיין " + ltr(Y) + "={" + domHtml(domY) + "} ⇒ <b>אין הסרה</b>. " +
        "הקשת יוצאת מהתור בלי להוסיף קשתות חדשות."
    };
  }
  function wipeoutStep(X, Y, removed) {
    return {
      type: "wipeout", arc: [X, Y], removed: removed, changed: X, wipeoutVar: X,
      addedArcs: [],
      badge: "דומיין התרוקן!", badgeVar: "var(--err)",
      title: ltr("REVISE(" + X + ", " + Y + ")") + " ⟹ כישלון",
      body: ltr(X) + " וגם " + ltr(Y) + " כבר צומצמו לאותו ערך יחיד: {" +
        COLOR_HE[removed] + "}. אין ל-" + ltr(X) + " שום ערך שונה מ-" + ltr(Y) +
        " ⇒ <b style=\"color:var(--err)\">גם " + COLOR_HE[removed] + " מוסר מ-" + X +
        "</b> — והדומיין שלו מתרוקן לגמרי (∅ — <b>domain wipe-out</b>)."
    };
  }

  /* =====================================================================
     RED TRACE (WA=אדום) — the deck's own arc, verbatim. queueAfter arrays
     are the literal "Queue:" lines transcribed from the notes (pages
     3,4,6,7,8,9,12,13,14,16); REVISE decides removals generically so the
     domains can never drift from real AC-3 semantics.
     ===================================================================== */
  var INIT_QUEUE_RED = [["SA", "WA"], ["NT", "WA"]];
  var EVENTS_PRE = [
    { arc: ["SA", "WA"], q: [["NT", "WA"], ["WA", "SA"], ["NT", "SA"], ["Q", "SA"], ["NSW", "SA"], ["V", "SA"]] },
    { arc: ["NT", "WA"], q: [["WA", "SA"], ["NT", "SA"], ["Q", "SA"], ["NSW", "SA"], ["V", "SA"], ["WA", "NT"], ["SA", "NT"], ["Q", "NT"]] },
    { arc: ["WA", "SA"], q: [["NT", "SA"], ["Q", "SA"], ["NSW", "SA"], ["V", "SA"], ["WA", "NT"], ["SA", "NT"], ["Q", "NT"]] },
    { arc: ["NT", "SA"], q: [["Q", "SA"], ["NSW", "SA"], ["V", "SA"], ["WA", "NT"], ["SA", "NT"], ["Q", "NT"]] },
    { arc: ["Q", "SA"], q: [["NSW", "SA"], ["V", "SA"], ["WA", "NT"], ["SA", "NT"], ["Q", "NT"]] },
    { arc: ["NSW", "SA"], q: [["V", "SA"], ["WA", "NT"], ["SA", "NT"], ["Q", "NT"]] },
    { arc: ["V", "SA"], q: [["WA", "NT"], ["SA", "NT"], ["Q", "NT"]] },
    { arc: ["WA", "NT"], q: [["SA", "NT"], ["Q", "NT"]] },
    { arc: ["SA", "NT"], q: [["Q", "NT"]] },
    { arc: ["Q", "NT"], q: [] }
  ];
  var ENQUEUE_AFTER = [["NT", "Q"], ["SA", "Q"], ["NSW", "Q"]];
  var EVENTS_POST = [
    { arc: ["NT", "Q"], q: [["SA", "Q"], ["NSW", "Q"], ["WA", "NT"], ["SA", "NT"], ["Q", "NT"]] },
    { arc: ["SA", "Q"], q: [["NSW", "Q"], ["WA", "NT"], ["SA", "NT"], ["Q", "NT"], ["WA", "SA"], ["NT", "SA"], ["Q", "SA"], ["NSW", "SA"], ["V", "SA"]] },
    { arc: ["NSW", "Q"], q: [["WA", "NT"], ["SA", "NT"], ["Q", "NT"], ["WA", "SA"], ["NT", "SA"], ["Q", "SA"], ["NSW", "SA"], ["V", "SA"], ["V", "NSW"], ["Q", "NSW"], ["SA", "NSW"]] },
    { arc: ["WA", "NT"], q: [["SA", "NT"], ["Q", "NT"], ["WA", "SA"], ["NT", "SA"], ["Q", "SA"], ["NSW", "SA"], ["V", "SA"], ["V", "NSW"], ["Q", "NSW"], ["SA", "NSW"]] },
    { arc: ["SA", "NT"], q: null } /* wipe-out — computed generically, not hardcoded */
  ];

  function buildStepsRed() {
    var domains = {};
    VERTS.forEach(function (v) { domains[v] = FULL_DOM.slice(); });
    domains.WA = ["R"];
    var queueCur = INIT_QUEUE_RED.slice();
    var steps = [], wiped = null;

    function snap(extra) {
      var d = {}; VERTS.forEach(function (v) { d[v] = domains[v].slice(); });
      var s = { domains: d, queue: queueCur.map(function (a) { return a.slice(); }) };
      for (var k in extra) s[k] = extra[k];
      steps.push(s);
    }
    function addedFrom(queueBefore) {
      return queueCur.slice(Math.max(queueBefore.length - 1, 0));
    }

    snap({
      type: "init", arc: null, removed: null, changed: "WA", wipeoutVar: null,
      addedArcs: queueCur.slice(),
      badge: "מצב התחלתי", badgeVar: "var(--accent)",
      title: ltr("AC-3") + " — לפני שהתחלנו לעקוב",
      body: "אלגוריתם <b>" + ltr("AC-3") + "</b> מתחזק תור של קשתות מכוונות. הכיתוב " +
        ltr("X→Y") + " פירושו " + ltr("REVISE(X, Y)") + " — לתקן את הדומיין של " + ltr("X") +
        " ביחס לתומך " + ltr("Y") + ". במצגת " + ltr("WA") + " כבר הוצב לצבע <b>אדום</b> " +
        "(מחוץ ל-AC-3, כתוצאה מהחלטת חיפוש) — ולכן שני שכניו, " + ltr("NT") + " ו-" + ltr("SA") +
        ", נכנסים מיד לתור: " + ltr("SA→WA") + " ואז " + ltr("NT→WA") + ". שאר החמישה (" +
        ltr("NT, SA, Q, NSW, V") + ") עדיין עם הדומיין המלא {אדום, ירוק, כחול}; " + ltr("T") +
        " (טסמניה) מבודד לגמרי בגרף האילוצים ולעולם לא יצטמצם."
    });

    function runEvents(list) {
      for (var i = 0; i < list.length; i++) {
        var ev = list[i], X = ev.arc[0], Y = ev.arc[1], queueBefore = queueCur;
        var removed = revise(domains, X, Y);
        if (removed && domains[X].length === 0) {
          wiped = X; queueCur = queueBefore.slice(1);
          var ws = wipeoutStep(X, Y, removed);
          ws.body += " זה בדיוק הרגע שהמצגת מרמזת עליו בסימון " + ltr('"!!!"') +
            " ליד " + ltr("SA") + " בשקף האחרון (עמ' 16).";
          snap(ws);
          return true;
        }
        queueCur = ev.q.slice();
        if (removed) snap(reviseChangeStep(X, Y, removed, domains[X], addedFrom(queueBefore)));
        else snap(reviseNoChangeStep(X, Y, domains[X], domains[Y]));
      }
      return false;
    }

    var stopped = runEvents(EVENTS_PRE);
    if (!stopped) {
      domains.Q = ["G"];
      snap({
        type: "assign", arc: null, removed: null, changed: "Q", wipeoutVar: null, addedArcs: [],
        badge: "הצבה חדשה", badgeVar: "var(--mustard)",
        title: "החיפוש מציב " + ltr("Q") + " = ירוק",
        body: "תור ה-AC-3 התרוקן — התפשטות הצמצום מ-" + ltr("WA=אדום") + " עצרה (רק " +
          ltr("NT") + " ו-" + ltr("SA") + " איבדו את האדום). כעת <b>מתבצעת הצבה חדשה מתוך " +
          "תהליך החיפוש</b> (לא חלק מ-AC-3 עצמו): " + ltr("Q ← ירוק") + ". שימו לב — " +
          "התור עדיין ריק ברגע זה; עוד לא נוספה אף קשת."
      });
      var queueBefore2 = queueCur;
      queueCur = ENQUEUE_AFTER.slice();
      snap({
        type: "enqueue", arc: null, removed: null, changed: null, wipeoutVar: null,
        addedArcs: addedFrom(queueBefore2),
        badge: "מוסיפים לתור", badgeVar: "var(--mustard)",
        title: "אילו קשתות נכנסות לתור? (שאלת תרגול מהכיתה)",
        body: "בדיוק כפי ש-" + ltr("WA") + " שהשתנה הוסיף קשתות לתור, גם ל-" + ltr("Q") +
          " יש להוסיף קשתות " + ltr("K→Q") + " עבור כל שכן " + ltr("K") + " שלו: " +
          ltr("NT, SA, NSW") + ". זו בדיוק שאלת ה-Piazza Poll מהמצגת (\"What gets added to " +
          "the Queue?\") — התשובה הנכונה היא <b>" + ltr("NT→Q, SA→Q, NSW→Q") + "</b>, ולא " +
          ltr("Q→NT, Q→SA, Q→NSW") + " — מוסיפים קשתות <u>אל תוך</u> " + ltr("Q") + ", לא ממנו."
      });
      stopped = runEvents(EVENTS_POST);
    }

    snap({
      type: "done", arc: null, removed: null, changed: null, wipeoutVar: wiped, addedArcs: [],
      badge: wiped ? "כישלון — Backtrack" : "עקביות קשתית",
      badgeVar: wiped ? "var(--err)" : "var(--ok)",
      title: wiped ? "AC-3 מגלה כישלון — יש לחזור אחורה" : "כל הקשתות עקביות",
      body: wiped
        ? ("דומיין ריק ⇒ ה-CSP <b>אינו עקבי</b> תחת ההשמות הנוכחיות (" + ltr("WA=אדום, Q=ירוק") +
          "). AC-3 חושף את הכישלון הזה <b>מוקדם</b> — עוד לפני שממשיכים לנסות להציב ערך " +
          "בפועל ל-" + ltr("SA") + " או ל-" + ltr("NT") + " ומגלים את התקיעה. יש לחזור אחורה " +
          "(<b>backtrack</b>) ולנסות ערך אחר (למשל " + ltr("Q=אדום") + ").")
        : "AC-3 סיים לרוקן את התור בלי לגלות דומיין ריק — כל הקשתות עקביות."
    });
    return steps;
  }

  /* =====================================================================
     GENERIC TRACE (WA=ירוק / WA=כחול) — real AC-3, no hard-coded queue;
     re-enqueue order follows NEI. No scripted second assignment (nothing
     in the notes grounds one), so this always settles arc-consistent.
     ===================================================================== */
  function buildStepsGeneric(startColor) {
    var domains = {};
    VERTS.forEach(function (v) { domains[v] = FULL_DOM.slice(); });
    domains.WA = [startColor];
    var queue = NEI.WA.map(function (k) { return [k, "WA"]; });
    var steps = [], wiped = null;

    function snap(extra) {
      var d = {}; VERTS.forEach(function (v) { d[v] = domains[v].slice(); });
      var s = { domains: d, queue: queue.map(function (a) { return a.slice(); }) };
      for (var k in extra) s[k] = extra[k];
      steps.push(s);
    }

    snap({
      type: "init", arc: null, removed: null, changed: "WA", wipeoutVar: null,
      addedArcs: queue.slice(),
      badge: "מצב התחלתי", badgeVar: "var(--accent)",
      title: ltr("AC-3") + " — הצבתם " + ltr("WA = " + COLOR_HE[startColor]),
      body: "בחרתם להציב " + ltr("WA") + " = <b>" + COLOR_HE[startColor] + "</b>. מכיוון ש-" +
        ltr("WA") + " הפך לדומיין יחיד, נכנסות מיד לתור קשתות עבור שני שכניו: " +
        ltr(arcList(queue)) + ". צפו איך AC-3 מפיץ (או לא מפיץ) את הצמצום הלאה — בלי שום " +
        "הצבה נוספת מתוזמרת מראש (בניגוד למסלול " + ltr("WA=אדום") + ", שבו החיפוש ממשיך " +
        "ומציב אחר-כך גם " + ltr("Q=ירוק") + ")."
    });

    while (queue.length) {
      var arc = queue.shift(), X = arc[0], Y = arc[1];
      var removed = revise(domains, X, Y);
      if (removed) {
        if (domains[X].length === 0) {
          wiped = X;
          snap(wipeoutStep(X, Y, removed));
          break;
        }
        var addedArcs = NEI[X].map(function (K) { var a = [K, X]; queue.push(a); return a; });
        snap(reviseChangeStep(X, Y, removed, domains[X], addedArcs));
      } else {
        snap(reviseNoChangeStep(X, Y, domains[X], domains[Y]));
      }
    }

    snap({
      type: "done", arc: null, removed: null, changed: null, wipeoutVar: wiped, addedArcs: [],
      badge: wiped ? "כישלון — Backtrack" : "עקביות קשתית",
      badgeVar: wiped ? "var(--err)" : "var(--ok)",
      title: wiped ? "AC-3 מגלה כישלון" : "כל הקשתות עקביות — אין wipe-out",
      body: wiped
        ? ("דומיין ריק ⇒ ה-CSP אינו עקבי תחת " + ltr("WA=" + COLOR_HE[startColor]) + " בלבד.")
        : ("התור התרוקן בלי דומיין ריק: הצבה יחידה של " + ltr("WA") + " הספיקה לצמצם רק את " +
          "שכניו הישירים ולא הרחיקה מעבר לזה — בניגוד להצבה הכפולה " + ltr("WA=אדום") + " + " +
          ltr("Q=ירוק") + " במסלול המקורי, שהובילה ל-wipe-out. היקף ה'תפוצה' (propagation) " +
          "תלוי מאוד באיזה משתנה משתנה ובאיזה שלב.")
    });
    return steps;
  }

  /* =====================================================================
     SVG scene — graph is identical across modes; only state repaints.
     ===================================================================== */
  function buildGraph() {
    var svg = el("svg", {
      viewBox: "0 0 " + VBW + " " + VBH, width: "100%", role: "img", direction: "ltr",
      "aria-label": "גרף האילוצים של בעיית צביעת מפת אוסטרליה — WA, NT, SA, Q, NSW, V, T"
    });
    svg.style.cssText = "display:block;max-width:" + VBW + "px;margin:0 auto";

    var defs = el("defs");
    [["accent", "var(--accent)"], ["err", "var(--err)"], ["mustard", "var(--mustard)"]].forEach(function (m) {
      var mk = el("marker", {
        id: "ac3-mk-" + m[0], viewBox: "0 0 10 10", refX: "8.5", refY: "5",
        markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse"
      });
      mk.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", fill: m[1] }));
      defs.appendChild(mk);
    });
    svg.appendChild(defs);

    var edgeRefs = {};
    EDGES.forEach(function (e) {
      var a = POS[e[0]], b = POS[e[1]];
      var line = el("line", {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        stroke: "var(--line)", "stroke-width": 2, "stroke-linecap": "round"
      });
      svg.appendChild(line);
      edgeRefs[baseKey(e[0], e[1])] = line;
    });

    var overlay = el("g", {});
    svg.appendChild(overlay);

    var nodeRefs = {};
    VERTS.forEach(function (v) {
      var p = POS[v], g = el("g", {});
      var circle = el("circle", {
        cx: p.x, cy: p.y, r: NR, fill: "var(--surface)", stroke: "var(--line)", "stroke-width": 2.4
      });
      if (v === "T") circle.setAttribute("stroke-dasharray", "4 3");
      var label = el("text", {
        x: p.x, y: p.y + 5, "text-anchor": "middle", "font-size": 13.5, "font-weight": 800, fill: "var(--ink)"
      });
      label.textContent = v;
      g.appendChild(circle); g.appendChild(label);
      svg.appendChild(g);
      nodeRefs[v] = { g: g, circle: circle, label: label };
    });

    var tCap = el("text", {
      x: POS.T.x, y: POS.T.y + NR + 15, "text-anchor": "middle",
      "font-size": 10, "font-weight": 700, fill: "var(--ink-soft)"
    });
    tCap.textContent = "מבודד — ללא אילוצים";
    svg.appendChild(tCap);

    return { svg: svg, edgeRefs: edgeRefs, nodeRefs: nodeRefs, overlay: overlay };
  }

  function arrowInto(overlay, X, Y, colorName, thick, flashClass) {
    var a = POS[X], b = POS[Y];
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / len, uy = dy / len;
    var line = el("line", {
      x1: a.x + ux * NR, y1: a.y + uy * NR,
      x2: b.x - ux * (NR + 4), y2: b.y - uy * (NR + 4),
      stroke: "var(--" + colorName + ")", "stroke-width": thick, "stroke-linecap": "round",
      "marker-end": "url(#ac3-mk-" + colorName + ")"
    });
    if (flashClass) line.setAttribute("class", flashClass);
    overlay.appendChild(line);
  }

  function applyGraph(scene, step) {
    scene.overlay.innerHTML = "";
    for (var k in scene.edgeRefs) {
      scene.edgeRefs[k].setAttribute("stroke", "var(--line)");
      scene.edgeRefs[k].setAttribute("stroke-width", 2);
    }
    VERTS.forEach(function (v) {
      var ref = scene.nodeRefs[v], singleton = step.domains[v].length === 1;
      var fill = "var(--surface)", stroke = "var(--line)";
      if (singleton) {
        fill = "color-mix(in srgb, " + COLOR_VAR[step.domains[v][0]] + " 20%, var(--surface))";
        stroke = COLOR_VAR[step.domains[v][0]];
      }
      ref.circle.setAttribute("fill", fill);
      ref.circle.setAttribute("stroke", stroke);
      ref.circle.setAttribute("stroke-width", 2.4);
      ref.g.classList.remove("ac3-pulse");
    });

    if (step.arc) {
      var X = step.arc[0], Y = step.arc[1];
      var col = (step.type === "wipeout" || step.removed) ? "err" : "accent";
      var be = scene.edgeRefs[baseKey(X, Y)];
      if (be) { be.setAttribute("stroke", "var(--" + col + ")"); be.setAttribute("stroke-width", 4.5); }
      arrowInto(scene.overlay, X, Y, col, 3.5, null);
      [X, Y].forEach(function (v) {
        scene.nodeRefs[v].circle.setAttribute("stroke", "var(--" + col + ")");
        scene.nodeRefs[v].circle.setAttribute("stroke-width", 3.4);
      });
    }

    var emph = step.wipeoutVar || step.changed;
    if (emph) {
      var emphColor = step.wipeoutVar ? "err" : (step.type === "revise-change" ? "err" : "mustard");
      var nref = scene.nodeRefs[emph];
      nref.circle.setAttribute("fill", "color-mix(in srgb, var(--" + emphColor + ") 25%, var(--surface))");
      nref.circle.setAttribute("stroke", "var(--" + emphColor + ")");
      nref.circle.setAttribute("stroke-width", 3.6);
      void nref.g.offsetWidth;
      nref.g.classList.add("ac3-pulse");
    }

    (step.addedArcs || []).forEach(function (a) {
      arrowInto(scene.overlay, a[0], a[1], "mustard", 2.6, "ac3-flash-arrow");
    });
  }

  /* =====================================================================
     STYLE
     ===================================================================== */
  var STYLE_ID = "ac3-style";
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = ce("style", null, document.head);
    s.id = STYLE_ID;
    s.textContent =
      ".viz-ac3-stepper{direction:rtl}" +
      ".viz-ac3-stepper .ac3-legend{font-size:.85rem;color:var(--ink-soft);margin-bottom:.6rem;line-height:1.6}" +
      ".viz-ac3-stepper .ac3-legend b{color:var(--ink)}" +
      ".viz-ac3-stepper .ac3-swatch{display:inline-flex;align-items:center;gap:4px;margin-inline-end:.7rem}" +
      ".viz-ac3-stepper .ac3-swatch i{width:11px;height:11px;border-radius:3px;display:inline-block}" +
      ".viz-ac3-stepper .ac3-top{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;margin-top:.5rem}" +
      ".viz-ac3-stepper .ac3-graphbox{flex:1 1 340px;min-width:300px;background:var(--surface);" +
      "border:1px solid var(--line);border-radius:12px;padding:8px 6px}" +
      ".viz-ac3-stepper .ac3-side{flex:1 1 230px;min-width:220px;display:flex;flex-direction:column;gap:12px}" +
      ".viz-ac3-stepper .ac3-card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 12px}" +
      ".viz-ac3-stepper .ac3-card h4{margin:0 0 8px;font-size:.8rem;color:var(--ink-soft);font-weight:700}" +
      ".viz-ac3-stepper .ac3-qchips{display:flex;flex-wrap:wrap;gap:6px;direction:ltr;min-height:32px;align-items:center}" +
      ".viz-ac3-stepper .ac3-qchip{display:inline-flex;align-items:center;font-weight:700;font-size:.78rem;" +
      "padding:.22rem .6rem;border-radius:99px;border:1.5px solid var(--line);background:var(--surface-2);color:var(--ink)}" +
      ".viz-ac3-stepper .ac3-qchip.next{border-color:var(--accent);background:color-mix(in srgb, var(--accent) 14%, var(--surface));color:var(--accent)}" +
      ".viz-ac3-stepper .ac3-qchip.flash{animation:ac3-chip-flash 900ms ease-out 1}" +
      ".viz-ac3-stepper .ac3-qempty{color:var(--ink-soft);font-size:.82rem;font-style:italic}" +
      "@keyframes ac3-chip-flash{0%{box-shadow:0 0 0 0 var(--mustard)}40%{box-shadow:0 0 0 4px var(--mustard)}100%{box-shadow:0 0 0 0 transparent}}" +
      ".viz-ac3-stepper .ac3-flash-arrow{animation:ac3-arrow-flash 900ms ease-out 1}" +
      "@keyframes ac3-arrow-flash{0%{opacity:0}30%{opacity:1}100%{opacity:.85}}" +
      ".viz-ac3-stepper .ac3-pulse circle{animation:ac3-pulse 700ms ease-in-out 2}" +
      "@keyframes ac3-pulse{0%,100%{stroke-width:3.6}50%{stroke-width:5.4}}" +
      ".viz-ac3-stepper .ac3-dgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px;margin-top:12px}" +
      ".viz-ac3-stepper .ac3-dcard{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:7px 8px;transition:box-shadow .15s ease}" +
      ".viz-ac3-stepper .ac3-dcard.ac3-pulse{animation:ac3-card-pulse 700ms ease-in-out 2}" +
      "@keyframes ac3-card-pulse{0%,100%{box-shadow:none}50%{box-shadow:0 0 0 3px var(--err)}}" +
      ".viz-ac3-stepper .ac3-dhead{font-weight:800;font-size:.85rem;color:var(--ink);direction:ltr;text-align:left;" +
      "border-radius:6px;padding:1px 5px;margin-bottom:5px}" +
      ".viz-ac3-stepper .ac3-dhead small{font-weight:500;color:var(--ink-soft);font-size:.68rem;margin-inline-start:4px}" +
      ".viz-ac3-stepper .ac3-dchips{display:flex;flex-direction:column;gap:2px}" +
      ".viz-ac3-stepper .ac3-dchip{display:flex;align-items:center;gap:5px;font-size:.74rem;color:var(--ink)}" +
      ".viz-ac3-stepper .ac3-dchip i{width:9px;height:9px;border-radius:50%;flex:none}" +
      ".viz-ac3-stepper .ac3-dchip.removed{color:var(--err);text-decoration:line-through;opacity:.65}" +
      ".viz-ac3-stepper .ac3-panel{background:var(--surface-2);border:1px solid var(--line);border-radius:12px;" +
      "padding:12px 14px;margin-top:12px;min-height:96px;line-height:1.7;font-size:.9rem;color:var(--ink)}" +
      ".viz-ac3-stepper .ac3-badge{display:inline-block;color:#fff;font-weight:700;font-size:.72rem;" +
      "padding:2px 10px;border-radius:99px;margin-inline-end:8px}" +
      ".viz-ac3-stepper .ac3-names{font-size:.76rem;color:var(--ink-soft);margin-top:8px;line-height:1.6}";
  }

  /* =====================================================================
     Render one mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-ac3-ready") === "1") return;
    mount.setAttribute("data-ac3-ready", "1");
    mount.innerHTML = "";
    ensureStyle();

    var root = ce("div", "viz-ac3-stepper", null);
    root.setAttribute("tabindex", "0");
    root.style.outline = "none";

    var legend = ce("div", "ac3-legend", root);
    legend.innerHTML =
      "<b>AC-3</b> על גרף האילוצים של צביעת מפת אוסטרליה — 7 משתנים, תחום " +
      ltr("{אדום, ירוק, כחול}") + ", אילוץ " + ltr("≠") + " בין כל שני שכנים. " +
      FULL_DOM.map(function (c) {
        return '<span class="ac3-swatch"><i style="background:' + COLOR_VAR[c] + '"></i>' + COLOR_HE[c] + "</span>";
      }).join("") +
      "<br>בחרו איזו הצבה ראשונית לתת ל-" + ltr("WA") + " וצפו כיצד " + ltr("AC-3") + " מפיץ (או לא) את הצמצום.";
    root.appendChild(legend);

    var modeRow = ce("div", "viz-controls", root);
    var btnR = mkBtn("WA = אדום (הדוגמה מהמצגת)", function () { setMode("R"); });
    var btnG = mkBtn("WA = ירוק", function () { setMode("G"); });
    var btnB = mkBtn("WA = כחול", function () { setMode("B"); });
    modeRow.appendChild(btnR); modeRow.appendChild(btnG); modeRow.appendChild(btnB);

    var top = ce("div", "ac3-top", root);
    var graphBox = ce("div", "ac3-graphbox", top);
    var scene = buildGraph();
    graphBox.appendChild(scene.svg);

    var side = ce("div", "ac3-side", top);
    var queueCard = ce("div", "ac3-card", side);
    ce("h4", null, queueCard, "התור (FIFO Queue)");
    var queueChips = ce("div", "ac3-qchips", queueCard);

    var namesCard = ce("div", null, side);
    namesCard.className = "ac3-names";
    namesCard.innerHTML = VERTS.map(function (v) {
      return ltr(v) + "=" + FULL_HE[v];
    }).join(" · ");
    side.appendChild(namesCard);

    var dgrid = ce("div", "ac3-dgrid", root);
    var dcards = {};
    VERTS.forEach(function (v) {
      var card = ce("div", "ac3-dcard", dgrid);
      var head = ce("div", "ac3-dhead", card);
      head.innerHTML = v + (v === "T" ? ' <small>(מבודד)</small>' : "");
      var chips = ce("div", "ac3-dchips", card);
      var chipEls = {};
      FULL_DOM.forEach(function (c) {
        var chip = ce("span", "ac3-dchip", chips);
        chip.innerHTML = '<i style="background:' + COLOR_VAR[c] + '"></i>' + COLOR_HE[c];
        chipEls[c] = chip;
      });
      dcards[v] = { card: card, head: head, chips: chipEls };
    });

    var panel = ce("div", "ac3-panel", root);
    panel.setAttribute("aria-live", "polite");

    var controls = ce("div", "viz-controls", root);
    var btnPrev = mkBtn("→ הקודם", function () { go(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { go(idx + 1); }); btnNext.classList.add("primary");
    var btnReset = mkBtn("↺ אתחול", function () { go(0); });
    controls.appendChild(btnPrev); controls.appendChild(btnNext); controls.appendChild(btnReset);
    var counter = ce("span", null, controls);
    counter.style.cssText = "margin-inline-start:auto;font-size:.82rem;font-weight:700;color:var(--ink-soft);align-self:center";

    mount.appendChild(root);

    function mkBtn(label, fn) {
      var b = ce("button", "viz-btn", null, label);
      b.type = "button";
      b.addEventListener("click", fn);
      return b;
    }

    var mode = "R", steps = [], idx = 0;

    function updateQueue(step) {
      queueChips.innerHTML = "";
      if (!step.queue.length) {
        var empty = ce("span", "ac3-qempty", queueChips, "∅ התור ריק");
        return;
      }
      var addedKeys = {};
      (step.addedArcs || []).forEach(function (a) { addedKeys[arcTxt(a)] = true; });
      step.queue.forEach(function (a, i) {
        var chip = ce("span", "ac3-qchip" + (i === 0 ? " next" : "") +
          (addedKeys[arcTxt(a)] ? " flash" : ""), queueChips, arcTxt(a));
      });
    }

    function updateDomains(step) {
      VERTS.forEach(function (v) {
        var dc = dcards[v], present = {};
        step.domains[v].forEach(function (c) { present[c] = true; });
        FULL_DOM.forEach(function (c) { dc.chips[c].classList.toggle("removed", !present[c]); });
        dc.head.style.background = step.domains[v].length === 1
          ? "color-mix(in srgb, " + COLOR_VAR[step.domains[v][0]] + " 22%, transparent)" : "transparent";
        dc.card.classList.remove("ac3-pulse");
        if (v === (step.wipeoutVar || step.changed)) { void dc.card.offsetWidth; dc.card.classList.add("ac3-pulse"); }
      });
    }

    function updatePanel(step) {
      panel.innerHTML = '<span class="ac3-badge" style="background:' + step.badgeVar + '">' + step.badge +
        "</span><b>" + step.title + "</b><div style=\"margin-top:.4rem\">" + step.body + "</div>";
    }

    function go(n) {
      idx = Math.max(0, Math.min(steps.length - 1, n));
      var step = steps[idx];
      applyGraph(scene, step);
      updateQueue(step);
      updateDomains(step);
      updatePanel(step);
      counter.textContent = "שלב " + (idx + 1) + " / " + steps.length;
      btnPrev.disabled = idx === 0;
      btnNext.disabled = idx === steps.length - 1;
    }

    function setMode(m) {
      mode = m;
      steps = m === "R" ? buildStepsRed() : buildStepsGeneric(m);
      btnR.classList.toggle("primary", m === "R");
      btnG.classList.toggle("primary", m === "G");
      btnB.classList.toggle("primary", m === "B");
      btnR.setAttribute("aria-pressed", m === "R" ? "true" : "false");
      btnG.setAttribute("aria-pressed", m === "G" ? "true" : "false");
      btnB.setAttribute("aria-pressed", m === "B" ? "true" : "false");
      idx = 0;
      go(0);
    }

    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { go(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { go(idx + 1); e.preventDefault(); }
      else if (e.key === "Home") { go(0); e.preventDefault(); }
      else if (e.key === "End") { go(steps.length - 1); e.preventDefault(); }
    });

    setMode("R");
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
