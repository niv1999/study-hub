/* =====================================================================
   kmp-failure-explorer.js  —  Module 10 "התאמת מחרוזות · KMP"
   Grounded in _notes/09-string-matching.md — the EXACT lecture example
   from string-matching.pdf (Prof. Avivit Levy):

     Pattern  P = a b b a           (P[1..4], m=4)   →  π = [0, 0, 0, 1]
     Text     T = a b a b b a b b a b  (T[1..10], n=10)
     Valid shifts reported by KMP:  s = 2  and  s = 5     (עמ' 18–31)

   Second lecture pattern (עמ' 32) offered as an alternative for the
   prefix-function build phase, to expose a real while-loop back-jump:
     P = b b a b  →  π = [0, 1, 0, 1]

   Two guided phases (tab-switched):
     שלב 1 · Compute-Prefix-Function(P)  — fills the π table cell-by-cell,
             visualising "longest proper prefix that is also a suffix"
             via a prefix band + suffix band + the P[k+1] vs P[q] test.
     שלב 2 · KMP-Matcher(T,P)            — slides the pattern with π-jumps
             while the text pointer i NEVER moves back.

   The step engines below INSTRUMENT the real CLRS algorithms (every step
   is emitted from an actual run), so the animation cannot drift from the
   algorithm's semantics.

   Self-contained IIFE. Hand-authored SVG/DOM. No external deps. Works over
   http(s) and file://. Cream design tokens hardcoded (CONTRACT §2). RTL
   Hebrew captions; English/LTR algorithm identifiers (P, T, π, q, k, i).
   Keyboard accessible; prefers-reduced-motion respected; graceful if no
   mount; never throws; zero console errors.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "kmp-failure-explorer";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design tokens (hardcoded per CONTRACT §2) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",    /* pointer i / q */
    plum: "#9B7E9E",    /* unit-5 accent — π / updates */
    mustard: "#C9A24B", /* suffix band */
    ok: "#4F8A5B",      /* match */
    err: "#C25B4E"      /* mismatch */
  };
  var PREFIX_BAND = "rgba(155,126,158,0.18)"; /* plum-light  (prefix) */
  var SUFFIX_BAND = "rgba(201,162,75,0.20)";  /* mustard-light (suffix) */
  var MATCH_FILL  = "rgba(79,138,91,0.16)";   /* already-matched cells */
  var SET_FILL    = "rgba(155,126,158,0.22)"; /* just-written π cell */

  /* --- the lecture data --- */
  var T_ARR = "ababbabbab".split("");                 /* n = 10 */
  var PATTERNS = {
    abba: { chars: ["a", "b", "b", "a"], he: "דוגמת ההרצאה" },
    bbab: { chars: ["b", "b", "a", "b"], he: "דוגמה 2 (עמ' 32)" }
  };
  var MATCH_PATTERN = ["a", "b", "b", "a"];            /* phase-2 pattern */

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
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* =====================================================================
     STEP ENGINE 1 — Compute-Prefix-Function(P), instrumented.
       1. π[1] ← 0 ;  k ← 0
       2. for q ← 2 to m
       3.     while k > 0 and P[k+1] ≠ P[q]: k ← π[k]
       4.     if P[k+1] = P[q]: k ← k+1
       5.     π[q] ← k
     Parr is 0-indexed; Parr[i-1] == P[i] (1-indexed).
     ===================================================================== */
  function genBuild(Parr) {
    var m = Parr.length;
    var pi = new Array(m + 1).fill(null);   /* pi[1..m] */
    var steps = [];
    var snap = function () { return pi.slice(); };

    pi[1] = 0;
    steps.push({
      kind: "init", pi: snap(), k: 0, q: 1, compare: null, setIdx: 1,
      expl: "אתחול: π[1] ← 0. לתחילית באורך 1 אין תחילית שהיא סופית ממש (proper suffix), " +
        "לכן האורך הוא 0. מציבים גם k ← 0 (אורך המועמד הנוכחי)."
    });

    var k = 0;
    for (var q = 2; q <= m; q++) {
      steps.push({
        kind: "focus", pi: snap(), k: k, q: q, compare: null, setIdx: null,
        expl: "מחשבים את π[" + q + "] עבור P[" + q + "]='" + Parr[q - 1] + "'. " +
          "נבדוק אם אפשר להאריך את המועמד הנוכחי (k=" + k + ") ע\"י השוואת P[k+1] מול P[" + q + "]."
      });
      while (k > 0 && Parr[k] !== Parr[q - 1]) {
        steps.push({
          kind: "cmp", pi: snap(), k: k, q: q,
          compare: { a: k + 1, b: q, res: "mismatch" }, setIdx: null,
          expl: "אי-התאמה: P[" + (k + 1) + "]='" + Parr[k] + "' ≠ P[" + q + "]='" + Parr[q - 1] + "'. " +
            "מקצרים את המועמד לפי הטבלה שכבר נבנתה: k ← π[" + k + "] = " + pi[k] + "."
        });
        k = pi[k];
      }
      if (Parr[k] === Parr[q - 1]) {
        steps.push({
          kind: "cmp", pi: snap(), k: k, q: q,
          compare: { a: k + 1, b: q, res: "match" }, setIdx: null,
          expl: "התאמה: P[" + (k + 1) + "]='" + Parr[k] + "' = P[" + q + "]='" + Parr[q - 1] + "'. " +
            "אפשר להאריך את המועמד בתו אחד: k ← k+1 = " + (k + 1) + "."
        });
        k = k + 1;
      } else {
        steps.push({
          kind: "cmp", pi: snap(), k: k, q: q,
          compare: { a: k + 1, b: q, res: "mismatch" }, setIdx: null,
          expl: "אי-התאמה ו-k=0: אין מועמד קצר יותר לנסות. המועמד נשאר באורך 0."
        });
      }
      pi[q] = k;
      steps.push({
        kind: "set", pi: snap(), k: k, q: q, compare: null, setIdx: q,
        expl: "π[" + q + "] ← " + k + ". " + (k > 0
          ? ("התחילית הארוכה ביותר של P[1.." + q + "] שהיא גם סופית ממש שלה היא באורך " + k + ".")
          : ("אין תחילית לא-ריקה של P[1.." + q + "] שהיא גם סופית ממש שלה."))
      });
    }
    steps.push({
      kind: "done", pi: snap(), k: k, q: m, compare: null, setIdx: null,
      expl: "סיום הבנייה. וקטור פונקציית התחילית: π = [" + pi.slice(1).join(", ") + "]. " +
        "כל הבנייה עולה Θ(m) בזכות ניתוח אמורטייזד (סך ירידות k חסום בסך עליותיו)."
    });
    return { steps: steps, pi: pi };
  }

  /* =====================================================================
     STEP ENGINE 2 — KMP-Matcher(T,P), instrumented.
       q ← 0
       for i ← 1 to n
         while q > 0 and P[q+1] ≠ T[i]: q ← π[q]
         if P[q+1] = T[i]: q ← q+1
         if q = m: report shift i−m ; q ← π[q]
     patStart = 1-indexed text column under which P[1] is drawn = i − q
     (q = matched length before consuming T[i]); found ⇒ patStart = i−m+1.
     ===================================================================== */
  function genMatch(Tarr, Parr, pi) {
    var n = Tarr.length, m = Parr.length;
    var steps = [], matches = [], q = 0;

    steps.push({
      kind: "init", i: 0, q: 0, patStart: 1, compare: null, matches: [], usedPi: null,
      expl: "אתחול: q ← 0 (אורך ההתאמה הנוכחית בין תחילית P לבין הטקסט). " +
        "המצביע i יעבור על T משמאל לימין — ולעולם לא יחזור אחורה. זה הלב של KMP."
    });

    for (var i = 1; i <= n; i++) {
      while (q > 0 && Parr[q] !== Tarr[i - 1]) {
        steps.push({
          kind: "cmp", i: i, q: q, patStart: i - q,
          compare: { tCol: i, pIdx: q + 1, res: "mismatch" }, matches: matches.slice(), usedPi: q,
          expl: "אי-התאמה: P[" + (q + 1) + "]='" + Parr[q] + "' ≠ T[" + i + "]='" + Tarr[i - 1] + "'. " +
            "המצביע i לא זז אחורה! במקום זאת התבנית קופצת קדימה: q ← π[" + q + "] = " + pi[q] + " " +
            "(מחליקים את P כך שהתחילית באורך " + pi[q] + " כבר תואמת)."
        });
        q = pi[q];
      }
      if (Parr[q] === Tarr[i - 1]) {
        var qb = q; q = q + 1;
        steps.push({
          kind: "cmp", i: i, q: qb, patStart: i - qb, newQ: q,
          compare: { tCol: i, pIdx: qb + 1, res: "match" }, matches: matches.slice(), usedPi: null,
          expl: "התאמה: P[" + (qb + 1) + "]='" + Parr[qb] + "' = T[" + i + "]='" + Tarr[i - 1] + "'. " +
            "מרחיבים את ההתאמה: q ← " + q + "."
        });
      } else {
        steps.push({
          kind: "cmp", i: i, q: 0, patStart: i, newQ: 0,
          compare: { tCol: i, pIdx: 1, res: "mismatch" }, matches: matches.slice(), usedPi: null,
          expl: "אי-התאמה ו-q=0: אין התאמה חלקית לשמר. מחליקים את התבנית תו אחד וממשיכים ל-T[" +
            (i + 1 <= n ? (i + 1) : i) + "]."
        });
      }
      if (q === m) {
        matches.push(i - m);
        steps.push({
          kind: "found", i: i, q: m, patStart: i - m + 1, shift: i - m,
          compare: null, matches: matches.slice(), usedPi: m,
          expl: "q הגיע ל-m=" + m + " ⇒ P מופיע ב-T! היסט חוקי s = i−m = " + i + "−" + m + " = " + (i - m) + ". " +
            "להמשך החיפוש (אולי יש חפיפה): q ← π[" + m + "] = " + pi[m] + "."
        });
        q = pi[m];
      }
    }
    steps.push({
      kind: "done", i: n, q: q, patStart: n - q, compare: null, matches: matches.slice(), usedPi: null,
      expl: "סיום: הטקסט נסרק במעבר יחיד (i רץ מ-1 עד n, בלי חזרה). " +
        "ההיסטים החוקיים שנמצאו: s = " + matches.join(", ") + ". סה\"כ KMP רץ ב-Θ(n+m)."
    });
    return steps;
  }

  /* =====================================================================
     SCENE 1 — prefix-function builder.
     ===================================================================== */
  function buildScene(Parr) {
    var m = Parr.length;
    var cellW = 60, cellH = 52;
    var W = Math.max(380, m * cellW + 150), H = 288;
    var baseX = (W - m * cellW) / 2 + 10;
    var charY = 108, piY = charY + cellH + 42;

    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", direction: "ltr",
      "aria-label": "בניית טבלת פונקציית התחילית לתבנית " + Parr.join("")
    });
    svg.style.display = "block"; svg.style.maxWidth = W + "px"; svg.style.margin = "0 auto";

    var chip = txt(16, 27, "", { "font-size": 13.5, "font-weight": 700, fill: C.ink });
    svg.appendChild(chip);

    var bandPrefix = el("rect", { y: charY - 6, height: cellH + 12, rx: 9, fill: PREFIX_BAND, opacity: 0 });
    var bandSuffix = el("rect", { y: charY - 6, height: cellH + 12, rx: 9, fill: SUFFIX_BAND, opacity: 0 });
    svg.appendChild(bandPrefix); svg.appendChild(bandSuffix);

    var arc = el("path", { fill: "none", stroke: C.inkSoft, "stroke-width": 2.4, opacity: 0, "stroke-linecap": "round" });
    svg.appendChild(arc);

    /* row labels */
    svg.appendChild(txt(baseX - 12, charY + cellH / 2 + 7, "P", { "text-anchor": "end", "font-size": 16, "font-weight": 700, fill: C.ink }));
    svg.appendChild(txt(baseX - 12, piY + 25, "π", { "text-anchor": "end", "font-size": 16, "font-weight": 700, fill: C.plum, "font-style": "italic" }));

    var cells = [], piCells = [];
    for (var j = 0; j < m; j++) {
      var x = baseX + j * cellW;
      svg.appendChild(txt(x + cellW / 2, charY - 14, String(j + 1), { "text-anchor": "middle", "font-size": 11, fill: C.inkSoft }));
      var r = el("rect", { x: x + 4, y: charY, width: cellW - 8, height: cellH, rx: 9, fill: C.surface2, stroke: C.line, "stroke-width": 1.6 });
      svg.appendChild(r);
      var t = txt(x + cellW / 2, charY + cellH / 2 + 8, Parr[j], { "text-anchor": "middle", "font-size": 23, "font-weight": 700, fill: C.ink });
      svg.appendChild(t);
      var tag = txt(x + cellW / 2, charY - 32, "", { "text-anchor": "middle", "font-size": 11.5, "font-weight": 800, fill: C.plum });
      svg.appendChild(tag);
      cells.push({ r: r, tag: tag });
      var pr = el("rect", { x: x + 10, y: piY, width: cellW - 20, height: 38, rx: 8, fill: C.surface, stroke: C.line, "stroke-width": 1.4 });
      svg.appendChild(pr);
      var pt = txt(x + cellW / 2, piY + 25, "?", { "text-anchor": "middle", "font-size": 18, "font-weight": 700, fill: C.inkSoft });
      svg.appendChild(pt);
      piCells.push({ r: pr, t: pt });
    }

    function cx(idx1) { return baseX + (idx1 - 1) * cellW + cellW / 2; }

    function update(s) {
      chip.textContent = "q = " + s.q + "      k = " + s.k;
      var showBands = (s.kind === "focus" || s.kind === "cmp") && s.k > 0;

      for (var j = 0; j < m; j++) {
        var v = s.pi[j + 1];
        piCells[j].t.textContent = (v == null ? "?" : String(v));
        var isSet = (s.setIdx === j + 1);
        piCells[j].r.setAttribute("fill", isSet ? SET_FILL : C.surface);
        piCells[j].r.setAttribute("stroke", isSet ? C.plum : C.line);
        piCells[j].r.setAttribute("stroke-width", isSet ? 2.4 : 1.4);
        piCells[j].t.setAttribute("fill", v == null ? C.inkSoft : C.ink);
        cells[j].r.setAttribute("fill", C.surface2);
        cells[j].r.setAttribute("stroke", C.line);
        cells[j].r.setAttribute("stroke-width", 1.6);
        cells[j].tag.textContent = "";
      }

      if (s.q >= 1 && s.q <= m && s.kind !== "done") {
        cells[s.q - 1].r.setAttribute("stroke", C.blue);
        cells[s.q - 1].r.setAttribute("stroke-width", 2.2);
      }

      if (showBands) {
        bandPrefix.setAttribute("x", baseX + 2);
        bandPrefix.setAttribute("width", s.k * cellW - 4);
        bandPrefix.setAttribute("opacity", 1);
        var sfStart = s.q - s.k;
        bandSuffix.setAttribute("x", baseX + (sfStart - 1) * cellW + 2);
        bandSuffix.setAttribute("width", s.k * cellW - 4);
        bandSuffix.setAttribute("opacity", 1);
      } else {
        bandPrefix.setAttribute("opacity", 0);
        bandSuffix.setAttribute("opacity", 0);
      }

      var cmp = s.compare;
      if (cmp) {
        var col = cmp.res === "match" ? C.ok : C.err;
        cells[cmp.a - 1].r.setAttribute("stroke", col); cells[cmp.a - 1].r.setAttribute("stroke-width", 2.8);
        cells[cmp.b - 1].r.setAttribute("stroke", col); cells[cmp.b - 1].r.setAttribute("stroke-width", 2.8);
        cells[cmp.a - 1].tag.textContent = "P[k+1]"; cells[cmp.a - 1].tag.setAttribute("fill", col);
        cells[cmp.b - 1].tag.textContent = "P[q]"; cells[cmp.b - 1].tag.setAttribute("fill", col);
        var ax = cx(cmp.a), bx = cx(cmp.b), topY = charY - 4, apex = charY - 42;
        arc.setAttribute("d", "M" + ax + " " + topY + " Q " + ((ax + bx) / 2) + " " + apex + " " + bx + " " + topY);
        arc.setAttribute("stroke", col); arc.setAttribute("opacity", 1);
        if (!reducedMotion() && arc.animate) arc.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 220 });
      } else {
        arc.setAttribute("opacity", 0);
      }
    }
    return { node: svg, update: update };
  }

  /* =====================================================================
     SCENE 2 — KMP matcher.
     ===================================================================== */
  function matchScene(Tarr, Parr) {
    var n = Tarr.length, m = Parr.length;
    var cellW = 46, cellH = 46;
    var baseX = 40;
    var W = baseX + n * cellW + cellW * 3 + 16, H = 312;
    var textY = 120, patY = 200;

    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", direction: "ltr",
      "aria-label": "ריצת KMP על הטקסט " + Tarr.join("") + " והתבנית " + Parr.join("")
    });
    svg.style.display = "block"; svg.style.maxWidth = W + "px"; svg.style.margin = "0 auto";

    var chip = txt(16, 27, "", { "font-size": 13.5, "font-weight": 700, fill: C.ink });
    svg.appendChild(chip);

    svg.appendChild(txt(baseX - 12, textY + cellH / 2 + 6, "T", { "text-anchor": "end", "font-size": 16, "font-weight": 700, fill: C.ink }));
    svg.appendChild(txt(baseX - 12, patY + cellH / 2 + 6, "P", { "text-anchor": "end", "font-size": 16, "font-weight": 700, fill: C.plum }));

    /* text cells (fixed) */
    var tCells = [];
    for (var i = 0; i < n; i++) {
      var x = baseX + i * cellW;
      svg.appendChild(txt(x + cellW / 2, textY - 12, String(i + 1), { "text-anchor": "middle", "font-size": 10.5, fill: C.inkSoft }));
      var r = el("rect", { x: x + 3, y: textY, width: cellW - 6, height: cellH, rx: 8, fill: C.surface2, stroke: C.line, "stroke-width": 1.5 });
      svg.appendChild(r);
      var t = txt(x + cellW / 2, textY + cellH / 2 + 7, Tarr[i], { "text-anchor": "middle", "font-size": 20, "font-weight": 700, fill: C.ink });
      svg.appendChild(t);
      tCells.push({ r: r, t: t });
    }

    /* matches bracket layer (under text) */
    var matchLayer = el("g");
    svg.appendChild(matchLayer);

    /* vertical connector between compared cells */
    var conn = el("line", { stroke: C.inkSoft, "stroke-width": 2, "stroke-dasharray": "3 3", opacity: 0 });
    svg.appendChild(conn);

    /* i-pointer (blue flag pointing down, slides horizontally, never back) */
    var iptr = el("g", { opacity: 0 });
    iptr.appendChild(el("rect", { x: -18, y: textY - 44, width: 36, height: 22, rx: 7, fill: C.blue }));
    iptr.appendChild(txt(0, textY - 28, "i", { "text-anchor": "middle", "font-size": 13, "font-weight": 800, fill: "#fff", "font-style": "italic" }));
    iptr.appendChild(el("path", { d: "M-6 " + (textY - 22) + " L6 " + (textY - 22) + " L0 " + (textY - 12) + " z", fill: C.blue }));
    svg.appendChild(iptr);

    /* pattern group (slides via translateX) */
    var pg = el("g");
    svg.appendChild(pg);
    var pCells = [];
    for (var j = 0; j < m; j++) {
      var lx = j * cellW;
      var pr = el("rect", { x: lx + 3, y: patY, width: cellW - 6, height: cellH, rx: 8, fill: C.surface, stroke: C.plum, "stroke-width": 1.6 });
      pg.appendChild(pr);
      var ptx = txt(lx + cellW / 2, patY + cellH / 2 + 7, Parr[j], { "text-anchor": "middle", "font-size": 20, "font-weight": 700, fill: C.ink });
      pg.appendChild(ptx);
      pg.appendChild(txt(lx + cellW / 2, patY + cellH + 16, String(j + 1), { "text-anchor": "middle", "font-size": 10.5, fill: C.inkSoft }));
      pCells.push({ r: pr, t: ptx });
    }

    var patX = baseX, slideReq = null;
    function slideTo(target) {
      if (reducedMotion() || !window.requestAnimationFrame) {
        pg.setAttribute("transform", "translate(" + target + ",0)"); patX = target; return;
      }
      var from = patX, start = null, dur = 320;
      if (slideReq) cancelAnimationFrame(slideReq);
      function fr(ts) {
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / dur);
        var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        var xx = from + (target - from) * e;
        pg.setAttribute("transform", "translate(" + xx + ",0)");
        if (p < 1) slideReq = requestAnimationFrame(fr);
        else { patX = target; slideReq = null; }
      }
      slideReq = requestAnimationFrame(fr);
    }

    function tCx(col1) { return baseX + (col1 - 1) * cellW + cellW / 2; }

    function update(s) {
      chip.textContent = "i = " + (s.i >= 1 ? s.i : "—") + "      q = " +
        (s.kind === "found" ? m : (s.newQ != null ? s.newQ : s.q)) +
        "      shift s = " + (s.i >= 1 ? (s.patStart - 1) : "—");

      /* reset cells */
      var t2;
      for (t2 = 0; t2 < n; t2++) {
        tCells[t2].r.setAttribute("fill", C.surface2);
        tCells[t2].r.setAttribute("stroke", C.line);
        tCells[t2].r.setAttribute("stroke-width", 1.5);
      }
      for (t2 = 0; t2 < m; t2++) {
        pCells[t2].r.setAttribute("fill", C.surface);
        pCells[t2].r.setAttribute("stroke", C.plum);
        pCells[t2].r.setAttribute("stroke-width", 1.6);
      }

      /* slide pattern to current alignment */
      slideTo(baseX + (s.patStart - 1) * cellW);

      /* i-pointer */
      if (s.i >= 1) {
        iptr.setAttribute("opacity", 1);
        iptr.setAttribute("transform", "translate(" + tCx(s.i) + ",0)");
      } else {
        iptr.setAttribute("opacity", 0);
      }

      /* matched-so-far + comparison highlight */
      conn.setAttribute("opacity", 0);
      if (s.compare) {
        var pIdx = s.compare.pIdx;
        var col = s.compare.res === "match" ? C.ok : C.err;
        /* cells already matched (green light): pattern 1..pIdx-1, text patStart..patStart+pIdx-2 */
        for (var g = 1; g < pIdx; g++) {
          pCells[g - 1].r.setAttribute("fill", MATCH_FILL);
          pCells[g - 1].r.setAttribute("stroke", C.ok);
          var tc = s.patStart + g - 1;
          if (tc >= 1 && tc <= n) {
            tCells[tc - 1].r.setAttribute("fill", MATCH_FILL);
            tCells[tc - 1].r.setAttribute("stroke", C.ok);
          }
        }
        /* the compared pair */
        if (pIdx >= 1 && pIdx <= m) {
          pCells[pIdx - 1].r.setAttribute("stroke", col);
          pCells[pIdx - 1].r.setAttribute("stroke-width", 3);
          pCells[pIdx - 1].r.setAttribute("fill", s.compare.res === "match" ? MATCH_FILL : "rgba(194,91,78,0.14)");
        }
        var ti = s.compare.tCol;
        tCells[ti - 1].r.setAttribute("stroke", col);
        tCells[ti - 1].r.setAttribute("stroke-width", 3);
        tCells[ti - 1].r.setAttribute("fill", s.compare.res === "match" ? MATCH_FILL : "rgba(194,91,78,0.14)");
        /* connector */
        var cxp = tCx(ti);
        conn.setAttribute("x1", cxp); conn.setAttribute("x2", cxp);
        conn.setAttribute("y1", textY + cellH); conn.setAttribute("y2", patY);
        conn.setAttribute("stroke", col); conn.setAttribute("opacity", 1);
        if (!reducedMotion() && tCells[ti - 1].r.animate) {
          tCells[ti - 1].r.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 220 });
        }
      } else if (s.kind === "found") {
        /* whole pattern + covered text green */
        for (var f = 0; f < m; f++) {
          pCells[f].r.setAttribute("fill", MATCH_FILL);
          pCells[f].r.setAttribute("stroke", C.ok);
          pCells[f].r.setAttribute("stroke-width", 2.4);
          var tcf = s.patStart + f;
          if (tcf >= 1 && tcf <= n) {
            tCells[tcf - 1].r.setAttribute("fill", MATCH_FILL);
            tCells[tcf - 1].r.setAttribute("stroke", C.ok);
            tCells[tcf - 1].r.setAttribute("stroke-width", 2.4);
          }
        }
      }

      /* redraw match brackets under text for every found shift so far */
      clear(matchLayer);
      (s.matches || []).forEach(function (sh) {
        var x1 = baseX + sh * cellW + 3, x2 = baseX + (sh + m) * cellW - 3;
        var by = textY + cellH + 8;
        matchLayer.appendChild(el("path", {
          d: "M" + x1 + " " + by + " L" + x1 + " " + (by + 6) + " L" + x2 + " " + (by + 6) + " L" + x2 + " " + by,
          fill: "none", stroke: C.ok, "stroke-width": 2, "stroke-linecap": "round"
        }));
        matchLayer.appendChild(txt((x1 + x2) / 2, by + 20, "s=" + sh, {
          "text-anchor": "middle", "font-size": 11.5, "font-weight": 800, fill: C.ok
        }));
      });
    }
    return { node: svg, update: update };
  }

  /* =====================================================================
     π-table (HTML, LTR) shared below the scene.
     ===================================================================== */
  function piTableHTML(Parr, pi, hl) {
    hl = hl || {};
    var m = Parr.length;
    var head = "", chars = "", pis = "";
    function cellStyle(bg, bd) {
      return "border:1.5px solid " + (bd || C.line) + ";padding:5px 0;min-width:34px;text-align:center;" +
        (bg ? "background:" + bg + ";" : "background:" + C.surface + ";");
    }
    for (var j = 1; j <= m; j++) {
      var v = pi[j];
      var setHL = hl.set === j;
      var piHL = hl.piIdx === j;
      var cmpHL = hl.cells && hl.cells.indexOf(j) >= 0;
      var charBg = cmpHL ? "rgba(155,126,158,0.16)" : (hl.qCol === j ? "rgba(110,140,160,0.14)" : "");
      var charBd = cmpHL ? C.plum : (hl.qCol === j ? C.blue : C.line);
      var piBg = setHL ? SET_FILL : (piHL ? "rgba(110,140,160,0.18)" : "");
      var piBd = setHL ? C.plum : (piHL ? C.blue : C.line);
      head += '<td style="' + cellStyle("", C.line) + 'color:' + C.inkSoft + ';font-size:.72rem">' + j + "</td>";
      chars += '<td style="' + cellStyle(charBg, charBd) + 'font-weight:700;color:' + C.ink + '">' + Parr[j - 1] + "</td>";
      pis += '<td style="' + cellStyle(piBg, piBd) + 'font-weight:700;color:' +
        (v == null ? C.inkSoft : C.plum) + '">' + (v == null ? "?" : v) + "</td>";
    }
    var rh = 'style="text-align:end;padding:5px 8px 5px 4px;font-weight:700;color:';
    return '<table dir="ltr" style="border-collapse:separate;border-spacing:3px;margin:0 auto;font-family:' +
      "'JetBrains Mono',monospace" + '">' +
      '<tr><td ' + rh + C.inkSoft + '">i</td>' + head + "</tr>" +
      '<tr><td ' + rh + C.ink + '">P</td>' + chars + "</tr>" +
      '<tr><td ' + rh + C.plum + ';font-style:italic">π</td>' + pis + "</tr>" +
      "</table>";
  }

  /* =====================================================================
     RENDER
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-kmp-ready") === "1") return;
    mount.setAttribute("data-kmp-ready", "1");
    mount.innerHTML = "";

    var phase = "build";        /* "build" | "match" */
    var patKey = "abba";        /* build pattern */
    var idx = 0;
    var autoTimer = null;

    /* precomputed data */
    var buildData = genBuild(PATTERNS[patKey].chars);
    var matchPi = genBuild(MATCH_PATTERN).pi;
    var matchSteps = genMatch(T_ARR, MATCH_PATTERN, matchPi);

    function curSteps() { return phase === "build" ? buildData.steps : matchSteps; }
    function curPat() { return phase === "build" ? PATTERNS[patKey].chars : MATCH_PATTERN; }

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");

    /* ---- phase tabs ---- */
    var tabs = document.createElement("div");
    tabs.className = "viz-controls";
    tabs.style.marginBottom = ".7rem";
    var tabBuild = mkBtn('① בניית טבלת <span dir="ltr">π</span>', function () { setPhase("build"); }, true);
    var tabMatch = mkBtn('② ריצת ההתאמה <span dir="ltr">(KMP)</span>', function () { setPhase("match"); }, false);
    tabs.appendChild(tabBuild); tabs.appendChild(tabMatch);
    wrap.appendChild(tabs);

    /* ---- pattern selector (build only) ---- */
    var patRow = document.createElement("div");
    patRow.className = "viz-controls";
    patRow.style.marginBottom = ".6rem";
    var patLbl = document.createElement("span");
    patLbl.style.cssText = "font-weight:700;color:" + C.ink + ";font-size:.86rem;align-self:center";
    patLbl.innerHTML = 'תבנית <span dir="ltr">P</span>:';
    patRow.appendChild(patLbl);
    var patBtns = {};
    Object.keys(PATTERNS).forEach(function (key) {
      var b = mkBtn('<span dir="ltr">' + PATTERNS[key].chars.join("") + "</span> · " + PATTERNS[key].he,
        function () { setPattern(key); }, key === patKey);
      patBtns[key] = b;
      patRow.appendChild(b);
    });
    wrap.appendChild(patRow);

    /* ---- scene box ---- */
    var sceneBox = document.createElement("div");
    sceneBox.style.background = C.surface;
    sceneBox.style.borderRadius = "12px";
    sceneBox.style.padding = "8px 4px 4px";
    sceneBox.style.overflowX = "auto";
    wrap.appendChild(sceneBox);
    var sceneObj = null;

    /* ---- legend ---- */
    var legend = document.createElement("div");
    legend.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin:8px 0 2px;font-size:.76rem;color:" + C.inkSoft;
    legend.innerHTML =
      swatch(C.ok, "התאמה") + swatch(C.err, "אי-התאמה") +
      swatch(C.plum, 'עדכון <span dir="ltr">π</span> / התבנית') +
      swatch(C.blue, 'מצביע <span dir="ltr">i / q</span>') +
      swatch(C.mustard, "סופית (suffix)");
    wrap.appendChild(legend);

    /* ---- π table ---- */
    var piBox = document.createElement("div");
    piBox.style.cssText = "margin:10px 0 2px;overflow-x:auto";
    wrap.appendChild(piBox);

    /* ---- explanation panel ---- */
    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.cssText = "background:" + C.surface2 + ";border:1px solid " + C.line +
      ";border-radius:12px;padding:12px 14px;margin-top:10px;min-height:78px;color:" +
      C.ink + ";line-height:1.7;font-size:.9rem";
    wrap.appendChild(panel);

    /* ---- step controls ---- */
    var controls = document.createElement("div");
    controls.className = "viz-controls";
    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); go(idx - 1); }, false);
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); go(idx + 1); }, true);
    var btnPlay = mkBtn("▶ הפעל", function () { toggleAuto(); }, false);
    var btnReset = mkBtn("↺ איפוס", function () { stopAuto(); go(0); }, false);
    controls.appendChild(btnPrev); controls.appendChild(btnNext);
    controls.appendChild(btnPlay); controls.appendChild(btnReset);
    wrap.appendChild(controls);

    /* live region for screen readers */
    var live = document.createElement("p");
    live.setAttribute("aria-live", "polite");
    live.style.cssText = "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;" +
      "clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;";
    wrap.appendChild(live);

    mount.appendChild(wrap);

    /* ---- helpers ---- */
    function mkBtn(label, fn, primary) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn" + (primary ? " primary" : "");
      b.innerHTML = label;
      b.addEventListener("click", fn);
      return b;
    }
    function swatch(c, label) {
      return '<span style="display:inline-flex;align-items:center;gap:5px">' +
        '<span style="width:13px;height:13px;border-radius:4px;background:' + c + ';display:inline-block"></span>' +
        label + "</span>";
    }

    function rebuildScene() {
      clear(sceneBox);
      sceneObj = phase === "build" ? buildScene(curPat()) : matchScene(T_ARR, MATCH_PATTERN);
      sceneBox.appendChild(sceneObj.node);
    }

    function setPhase(p) {
      if (phase === p) return;
      stopAuto();
      phase = p; idx = 0;
      tabBuild.classList.toggle("primary", p === "build");
      tabMatch.classList.toggle("primary", p === "match");
      patRow.style.display = (p === "build") ? "" : "none";
      rebuildScene();
      go(0);
    }
    function setPattern(key) {
      if (patKey === key && phase === "build") { return; }
      stopAuto();
      patKey = key;
      buildData = genBuild(PATTERNS[patKey].chars);
      Object.keys(patBtns).forEach(function (k) { patBtns[k].classList.toggle("primary", k === patKey); });
      idx = 0;
      rebuildScene();
      go(0);
    }

    function go(n) {
      var steps = curSteps();
      idx = Math.max(0, Math.min(steps.length - 1, n));
      var s = steps[idx];
      sceneObj.update(s);

      /* π table + highlights */
      var pat = curPat();
      var hl;
      if (phase === "build") {
        hl = { set: s.setIdx, cells: s.compare ? [s.compare.a, s.compare.b] : null, qCol: s.q };
        piBox.innerHTML = piTableHTML(pat, s.pi, hl);
      } else {
        hl = { piIdx: s.usedPi, qCol: s.compare ? s.compare.pIdx : null };
        piBox.innerHTML = piTableHTML(MATCH_PATTERN, matchPi, hl);
      }

      /* panel */
      var badge, bcol;
      if (s.kind === "found") { badge = "MATCH · s=" + s.shift; bcol = C.ok; }
      else if (s.compare) { badge = s.compare.res === "match" ? "match" : "mismatch"; bcol = s.compare.res === "match" ? C.ok : C.err; }
      else if (s.kind === "init") { badge = "init"; bcol = C.blue; }
      else if (s.kind === "done") { badge = "done"; bcol = C.plum; }
      else if (s.kind === "set") { badge = "π[" + s.q + "]"; bcol = C.plum; }
      else { badge = "focus"; bcol = C.blue; }
      panel.innerHTML =
        '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:6px">' +
        '<span style="background:' + bcol + ';color:#fff;font-weight:700;font-size:.72rem;padding:2px 10px;border-radius:99px" dir="ltr">' + badge + "</span>" +
        '<span style="font-size:.8rem;color:' + C.inkSoft + '">שלב ' + (idx + 1) + " מתוך " + steps.length + "</span></div>" +
        "<div>" + s.expl + "</div>";
      live.textContent = s.expl;

      btnPrev.disabled = (idx === 0);
      btnNext.disabled = (idx === steps.length - 1);
    }

    /* ---- autoplay ---- */
    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      if (idx >= curSteps().length - 1) go(0);
      btnPlay.innerHTML = "⏸ השהה";
      btnPlay.classList.add("primary");
      var delay = reducedMotion() ? 1700 : 1500;
      autoTimer = setInterval(function () {
        if (idx >= curSteps().length - 1) { stopAuto(); return; }
        go(idx + 1);
      }, delay);
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
      else if (e.key === "End") { stopAuto(); go(curSteps().length - 1); e.preventDefault(); }
    });

    /* initial paint */
    rebuildScene();
    go(0);
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
