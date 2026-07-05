/* =====================================================================
   roots-of-unity.js  —  Module 12-fft "מכפלת פולינומים ו-FFT"
   Grounded in _notes/11-fft-he.md + 11-fft-en.md (lecture lec-polynomial-mult-fft.pdf).

   THE LECTURE EXAMPLE animated here (recognisable from class):
     • n = 4  →  the FFT run on A(x) = x − 10 (vector a = (−10,1,0,0)) evaluates
       the polynomial at the 4th roots of unity  ω₄⁰,ω₄¹,ω₄²,ω₄³ = 1, i, −1, −i
       (primitive root ω₄ = e^{2πi/4} = i, exactly as the slide states in ליין 4).
       → FFT(A) = (−9, −10+i, −11, −10−i).  (lec עמ' 16, 21–26)
     • n = 8  →  the 8 roots of unity with explicit coordinates (fft.pdf עמ' 16),
       used for products of degree-n polynomials (order-2n roots).
     • n = 2  →  the base of the recursion, roots {1, −1}.

   Concept demonstrated interactively: the HALVING LEMMA (תכונת הריבוע) —
   squaring the n n-th roots of unity yields the n/2 (n/2)-th roots of unity,
   each hit exactly twice, because ω_n^{k+n/2} = −ω_n^k and (−ω)² = ω².
   This is precisely what makes the Divide&Conquer of Recursive-FFT work:
   P(x) = P_even(x²) + x·P_odd(x²), giving T(n) = 2T(n/2) + Θ(n) = Θ(n log n).
   (Recursive-FFT pseudocode, _notes ליין 4 ωₙ←e^{2πi/n}, ליינים 6–7 "הפרד",
    ליינים 10–13 "ומשול" — the butterfly y_k = y_k^{[0]} ± ω·y_k^{[1]}.)

   Self-contained IIFE. Hand-authored SVG + DOM. No external deps.
   Cream design tokens hardcoded (CONTRACT §2); unit-6 accent = teal #69A297.
   RTL Hebrew UI; algorithm identifiers stay English/LTR. Works file:// and http.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "roots-of-unity";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design palette (hardcoded per CONTRACT §2) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    teal: "#69A297",   /* unit-6 accent — the n-th root ω_n^k */
    clay: "#BE7C5E",   /* the antipode  −ω_n^k = ω_n^{k+n/2} */
    sage: "#7C9885",   /* the squared value ω_{n/2}^k (inner circle) */
    mustard: "#C9A24B",/* emphasis / primitive root highlight */
    plum: "#9B7E9E"
  };

  var SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  var SUB = "₀₁₂₃₄₅₆₇₈₉";
  function sup(n) { return String(n).split("").map(function (d) { return SUP[+d]; }).join(""); }
  function sub(n) { return String(n).split("").map(function (d) { return SUB[+d]; }).join(""); }
  function omega(order, power) { return "ω" + sub(order) + sup(power); }

  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ---------- complex-number formatting (LTR) ---------- */
  function fmtNum(x) {
    if (Math.abs(x) < 1e-9) return "0";
    var r = Math.round(x * 1000) / 1000;
    if (Math.abs(r - Math.round(r)) < 1e-9) r = Math.round(r);
    return (r < 0 ? "−" : "") + Math.abs(r);
  }
  function fmtC(re, im) {
    var a = Math.abs(re) < 1e-9 ? 0 : re;
    var b = Math.abs(im) < 1e-9 ? 0 : im;
    if (b === 0) return fmtNum(a);
    var isUnit = Math.abs(Math.abs(b) - 1) < 1e-9;
    if (a === 0) return (b < 0 ? "−" : "") + (isUnit ? "i" : fmtNum(Math.abs(b)) + "i");
    var sign = b < 0 ? " − " : " + ";
    var bpart = isUnit ? "i" : fmtNum(Math.abs(b)) + "i";
    return fmtNum(a) + sign + bpart;
  }

  /* ---------- geometry ---------- */
  var W = 480, H = 430, cx = 205, cy = 210, R = 150, Ri = 74;
  function polar(r, th) { return { x: cx + r * Math.cos(th), y: cy - r * Math.sin(th) }; }
  function theta(k, n) { return 2 * Math.PI * k / n; }
  function arcPath(r, a0, a1) {
    var p0 = polar(r, a0), p1 = polar(r, a1);
    return "M" + p0.x + " " + p0.y + " A" + r + " " + r + " 0 0 0 " + p1.x + " " + p1.y;
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

  /* =====================================================================
     STEP MODEL — 7 conceptual steps. `flags` drive the scene; `body(n,selK)`
     builds the Hebrew explanation using the currently chosen n / selection.
     ===================================================================== */
  function ltr(s) { return '<span dir="ltr">' + s + '</span>'; }

  var STEPS = [
    {
      badge: "ℂ", color: C.teal,
      title: "מעגל היחידה במישור המרוכב",
      flags: { arc: true, primitive: true },
      body: function (n) {
        var w = fmtC(Math.cos(2 * Math.PI / n), Math.sin(2 * Math.PI / n));
        return "עובדים במישור המרוכב, על <b>מעגל היחידה</b> (רדיוס 1). " +
          "<b>שורש היחידה הפרימיטיבי</b> מסדר n הוא " +
          ltr("ω" + sub(n) + " = e^{2πi/" + n + "} = cos(2π/" + n + ") + i·sin(2π/" + n + ")") +
          ". עבור " + ltr("n = " + n) + " יוצא " + ltr("ω" + sub(n) + " = " + w) + ". " +
          "אלגוריתם ה-FFT מעריך את הפולינום בדיוק בנקודות האלה (ליין 4 בפסאודו-קוד: " +
          ltr("ωₙ ← e^{2πi/n}") + ").";
      }
    },
    {
      badge: "n roots", color: C.teal,
      title: "n שורשי היחידה — מפוזרים אחיד",
      flags: { arc: true, powers: true },
      body: function (n) {
        return "החזקות " + ltr("ω" + sub(n) + "⁰, ω" + sub(n) + "¹, …, ω" + sub(n) + sup(n - 1)) +
          " הן <b>" + n + " השורשים</b> של המשוואה " + ltr("z" + sup(n) + " = 1") + ". " +
          "הם יושבים על מעגל היחידה ומפוזרים <b>במרווחים שווים</b> של זווית " +
          ltr("2π/" + n + " = " + Math.round(360 / n) + "°") + " זה מזה. " +
          "השורש הראשון תמיד " + ltr("ω" + sub(n) + "⁰ = 1") + ".";
      }
    },
    {
      badge: "values", color: C.mustard,
      title: "הערכים המפורשים — נקודות ההערכה של ה-FFT",
      flags: { arc: false, powers: true, valuesHi: true },
      body: function (n) {
        if (n === 4) {
          return "עבור " + ltr("n = 4") + " השורשים הם בדיוק " +
            "<b>" + ltr("1, i, −1, −i") + "</b> — אלו הנקודות שבהן ה-FFT מעריך את " +
            ltr("A(x) = x − 10") + " בדוגמת ההרצאה. שם התקבל " +
            ltr("FFT(A) = (−9, −10+i, −11, −10−i)") +
            ", כלומר " + ltr("A(1)=−9, A(i)=−10+i, A(−1)=−11, A(−i)=−10−i") + ". " +
            "עיין בטבלה שליד התרשים.";
        }
        return "בטבלה שליד התרשים מופיע הערך האלגברי " + ltr("cosθ + i·sinθ") +
          " של כל שורש. עבור " + ltr("n = " + n) + " אלו נקודות ההערכה שבהן ה-FFT מחשב את הפולינום. " +
          "שים לב ש-" + ltr("ω" + sub(n) + sup(n / 2) + " = −1") + " תמיד יושב בקצה השמאלי של הציר הממשי.";
      }
    },
    {
      badge: "±ω", color: C.clay,
      title: "זוגות אנטיפודליים — הבסיס ל-butterfly",
      flags: { powers: true, pairsAll: true },
      body: function (n) {
        return "כל שורש " + ltr("ω" + sub(n) + sup("k")) + " וה“בן-זוג” שלו במרחק חצי סיבוב מקיימים " +
          "<b>" + ltr("ω" + sub(n) + sup("k+" + (n / 2)) + " = −ω" + sub(n) + sup("k")) + "</b> " +
          "(נקודות נגדיות על המעגל, מחוברות בקו האלכסון). " +
          "בדיוק בגלל זה פעולת ה-<span class=\"term\" data-term=\"butterfly\">butterfly</span> מחשבת <b>שני</b> ערכים בבת אחת: " +
          ltr("y_k = y_k^{[0]} + ω·y_k^{[1]}") + " ו-" + ltr("y_{k+n/2} = y_k^{[0]} − ω·y_k^{[1]}") +
          " (ליינים 11–12 בפסאודו-קוד).";
      }
    },
    {
      badge: "square", color: C.sage,
      title: "תכונת הריבוע — (ωₙᵏ)² = ω_{n/2}ᵏ",
      flags: { powers: true, inner: true, squareSel: true },
      body: function (n, selK) {
        var pk = (selK + n / 2) % n;
        var m = n / 2;
        var innerK = selK % m;
        var re = Math.cos(2 * theta(selK, n)), im = Math.sin(2 * theta(selK, n));
        return "כשמעלים שורש בריבוע, הזווית <b>מכפילה את עצמה</b>: " +
          ltr("(ω" + sub(n) + sup(selK) + ")² = ω" + sub(n) + sup(2 * selK) + " = ω" + sub(m) + sup(innerK) + " = " + fmtC(re, im)) + ". " +
          "התוצאה יושבת על <b>מעגל פנימי</b> — מעגל " + m + " שורשי היחידה (ירוק). " +
          "לחיצה על נקודה בתרשים בוחרת שורש אחר; כאן נבחרו " +
          ltr("ω" + sub(n) + sup(selK)) + " (טורקיז) ובן-זוגו " + ltr("ω" + sub(n) + sup(pk)) + " (חמרה).";
      }
    },
    {
      badge: "halving lemma", color: C.sage,
      title: "למת החצייה — n ריבועים קורסים ל-n/2 ערכים",
      flags: { inner: true, pairsAll: true, squareAll: true },
      body: function (n) {
        var m = n / 2;
        return "מכיוון ש-" + ltr("ω" + sub(n) + sup("k+" + m) + " = −ω" + sub(n) + sup("k")) +
          " ו-" + ltr("(−ω)² = ω²") + ", כל <b>זוג</b> שורשים נגדיים מתרבע לאותו ערך. " +
          "לכן העלאת כל " + n + " השורשים בריבוע נותנת רק את <b>" + m + " השורשים</b> מסדר " + m +
          " — כל אחד מתקבל <b>בדיוק פעמיים</b>. זו <b>למת החצייה</b> (Halving Lemma). " +
          "שים לב איך כל שני חצים מהמעגל החיצוני נפגשים בנקודה אחת במעגל הפנימי.";
      }
    },
    {
      badge: "→ FFT", color: C.teal,
      title: "למה זה נותן Θ(n log n)",
      flags: { inner: true },
      body: function (n) {
        var m = n / 2;
        return "כותבים " + ltr("P(x) = P_even(x²) + x·P_odd(x²)") + " (הפרד: ליינים 6–7). " +
          "כדי להעריך את P ב-" + n + " השורשים, מספיק להעריך את " + ltr("P_even, P_odd") +
          " ב-<b>" + ltr("x²") + "</b> — ולפי למת החצייה יש רק <b>" + m + "</b> ערכים כאלה (מסדר " + m + "). " +
          "כל תת-בעיה בגודל חצי, ומשלבים ב-" + ltr("Θ(n)") + " עם ה-butterfly: " +
          "<b>" + ltr("T(n) = 2T(n/2) + Θ(n) = Θ(n log n)") + "</b>. זה הרעיון שמאחורי כל ה-FFT.";
      }
    }
  ];

  /* =====================================================================
     Scene: static frame (axes + unit circle) + dynamic layers rebuilt per n.
     ===================================================================== */
  function buildScene() {
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H, width: "100%",
      role: "img", direction: "ltr",
      "aria-label": "מעגל היחידה עם שורשי היחידה מסדר n ותכונת הריבוע"
    });
    svg.style.display = "block";
    svg.style.maxWidth = W + "px";
    svg.style.margin = "0 auto";
    svg.style.cursor = "default";

    var defs = el("defs");
    var mk = function (id, color) {
      var m = el("marker", { id: id, viewBox: "0 0 10 10", refX: "8", refY: "5",
        markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse" });
      m.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", fill: color }));
      defs.appendChild(m);
    };
    mk("rou-ax", C.line);
    mk("rou-sq", C.sage);
    svg.appendChild(defs);

    /* ---- axes (Re / Im) ---- */
    svg.appendChild(el("line", { x1: cx - R - 34, y1: cy, x2: cx + R + 34, y2: cy,
      stroke: C.line, "stroke-width": 1.6, "marker-end": "url(#rou-ax)", "marker-start": "url(#rou-ax)" }));
    svg.appendChild(el("line", { x1: cx, y1: cy + R + 34, x2: cx, y2: cy - R - 34,
      stroke: C.line, "stroke-width": 1.6, "marker-end": "url(#rou-ax)", "marker-start": "url(#rou-ax)" }));
    svg.appendChild(txt(cx + R + 40, cy + 4, "Re", { "font-size": 12, "font-weight": 700, fill: C.inkSoft }));
    svg.appendChild(txt(cx + 6, cy - R - 38, "Im", { "font-size": 12, "font-weight": 700, fill: C.inkSoft }));

    /* ---- inner circle (order n/2) — hidden until halving steps ---- */
    var innerCircle = el("circle", { cx: cx, cy: cy, r: Ri, fill: "none",
      stroke: C.sage, "stroke-width": 1.4, "stroke-dasharray": "4 4", opacity: 0 });
    svg.appendChild(innerCircle);

    /* ---- unit circle ---- */
    svg.appendChild(el("circle", { cx: cx, cy: cy, r: R, fill: "none",
      stroke: C.teal, "stroke-width": 2, opacity: 0.55 }));

    /* axis tick labels 1 / −1 / i / −i */
    svg.appendChild(txt(cx + R + 6, cy + 15, "1", { "font-size": 11, fill: C.inkSoft }));
    svg.appendChild(txt(cx - R - 14, cy + 15, "−1", { "font-size": 11, fill: C.inkSoft }));
    svg.appendChild(txt(cx + 8, cy - R - 4, "i", { "font-size": 11, "font-style": "italic", fill: C.inkSoft }));
    svg.appendChild(txt(cx + 8, cy + R + 15, "−i", { "font-size": 11, "font-style": "italic", fill: C.inkSoft }));

    /* ---- primitive-angle arc + label (steps 0–1) ---- */
    var gArc = el("g", { opacity: 0 });
    var arc = el("path", { d: "", fill: "none", stroke: C.mustard, "stroke-width": 2 });
    var arcLbl = txt(0, 0, "", { "font-size": 11, "font-weight": 700, fill: C.mustard,
      "text-anchor": "middle" });
    gArc.appendChild(arc); gArc.appendChild(arcLbl);
    svg.appendChild(gArc);

    /* ---- dynamic layers (rebuilt when n changes) ---- */
    var gPairs = el("g");   svg.appendChild(gPairs);   /* antipodal diameters */
    var gSquare = el("g");  svg.appendChild(gSquare);  /* squaring connectors */
    var gInner = el("g");   svg.appendChild(gInner);   /* inner (n/2) roots */
    var gDots = el("g");    svg.appendChild(gDots);    /* outer n roots */
    var gLabels = el("g");  svg.appendChild(gLabels);  /* ω_n^k power labels */

    /* travelling marker for the squaring animation */
    var flyer = el("circle", { cx: 0, cy: 0, r: 6, fill: C.sage, opacity: 0 });
    svg.appendChild(flyer);

    return {
      svg: svg, innerCircle: innerCircle, gArc: gArc, arc: arc, arcLbl: arcLbl,
      gPairs: gPairs, gSquare: gSquare, gInner: gInner, gDots: gDots, gLabels: gLabels,
      flyer: flyer,
      D: { dots: [], labels: [], pairLines: [], innerDots: [], sqLines: [] }
    };
  }

  /* rebuild the per-n geometry (dots, labels, pair lines, inner roots, connectors) */
  function buildDynamic(scene, n, onPick) {
    var m = n / 2;
    scene.gPairs.innerHTML = "";
    scene.gSquare.innerHTML = "";
    scene.gInner.innerHTML = "";
    scene.gDots.innerHTML = "";
    scene.gLabels.innerHTML = "";
    var D = scene.D;
    D.dots = []; D.labels = []; D.pairLines = []; D.innerDots = []; D.sqLines = [];
    var k;

    /* antipodal diameters: connect k and k+n/2 (each drawn once) */
    for (k = 0; k < m; k++) {
      var a = polar(R, theta(k, n)), b = polar(R, theta(k + m, n));
      var ln = el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        stroke: C.clay, "stroke-width": 1.3, "stroke-dasharray": "5 4", opacity: 0 });
      scene.gPairs.appendChild(ln);
      D.pairLines.push(ln);
    }

    /* inner (n/2) roots on the inner circle */
    for (var j = 0; j < m; j++) {
      var ip = polar(Ri, theta(j, m));
      var idot = el("circle", { cx: ip.x, cy: ip.y, r: 5.5, fill: C.sage,
        stroke: "#fff", "stroke-width": 1.4, opacity: 0 });
      scene.gInner.appendChild(idot);
      D.innerDots.push(idot);
    }

    /* squaring connectors: from outer dot k → inner dot (k mod m) at angle 2θ */
    for (k = 0; k < n; k++) {
      var op = polar(R, theta(k, n));
      var tp = polar(Ri, theta((k % m), m));
      var sq = el("line", { x1: op.x, y1: op.y, x2: tp.x, y2: tp.y,
        stroke: C.sage, "stroke-width": 1.4, "stroke-dasharray": "3 4",
        "marker-end": "url(#rou-sq)", opacity: 0 });
      scene.gSquare.appendChild(sq);
      D.sqLines.push(sq);
    }

    /* outer n-th roots + power labels */
    for (k = 0; k < n; k++) {
      var p = polar(R, theta(k, n));
      var dot = el("circle", { cx: p.x, cy: p.y, r: 7, fill: C.teal,
        stroke: "#fff", "stroke-width": 1.5 });
      dot.style.cursor = "pointer";
      dot.setAttribute("tabindex", "0");
      dot.setAttribute("role", "button");
      dot.setAttribute("aria-label", "שורש היחידה " + omega(n, k));
      (function (kk) {
        dot.addEventListener("click", function () { onPick(kk); });
        dot.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(kk); }
        });
      })(k);
      scene.gDots.appendChild(dot);
      D.dots.push(dot);

      var lp = polar(R + 20, theta(k, n));
      var lbl = txt(lp.x, lp.y + 4, omega(n, k), {
        "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: C.ink, opacity: 0 });
      scene.gLabels.appendChild(lbl);
      D.labels.push(lbl);
    }

    /* primitive-angle arc geometry (0 → 2π/n) */
    scene.arc.setAttribute("d", arcPath(42, 0, theta(1, n)));
    var mp = polar(58, theta(0.5, n));
    scene.arcLbl.setAttribute("x", mp.x);
    scene.arcLbl.setAttribute("y", mp.y + 3);
    scene.arcLbl.textContent = "2π/" + n;
  }

  /* apply a step's visual state (idempotent) */
  function applyState(scene, n, idx, selK) {
    var D = scene.D, f = STEPS[idx].flags || {}, m = n / 2;
    var op = function (node, v) { if (node) node.setAttribute("opacity", v); };

    /* reset outer dots */
    D.dots.forEach(function (d) {
      d.setAttribute("r", 7); d.setAttribute("fill", C.teal);
      d.setAttribute("stroke", "#fff"); d.setAttribute("stroke-width", 1.5);
    });
    D.labels.forEach(function (l) { op(l, f.powers ? 1 : 0); });

    op(scene.gArc, f.arc ? 1 : 0);
    op(scene.innerCircle, f.inner ? 1 : 0);
    D.innerDots.forEach(function (d) { op(d, f.inner ? 1 : 0); d.setAttribute("r", 5.5); });
    D.pairLines.forEach(function (l) { op(l, f.pairsAll ? 0.85 : 0); });
    D.sqLines.forEach(function (l) { op(l, f.squareAll ? 0.7 : 0); });
    op(scene.flyer, 0);

    /* step 0: emphasise the primitive root ω_n^1 */
    if (f.primitive && D.dots[1]) {
      D.dots[1].setAttribute("r", 9);
      D.dots[1].setAttribute("fill", C.mustard);
      op(D.labels[1], 1);
    }

    /* step 4: single squaring — highlight selK, its antipode, its target */
    if (f.squareSel) {
      var pk = (selK + m) % n, innerK = selK % m;
      if (D.dots[selK]) { D.dots[selK].setAttribute("r", 9); D.dots[selK].setAttribute("fill", C.teal); }
      if (D.dots[pk]) { D.dots[pk].setAttribute("r", 9); D.dots[pk].setAttribute("fill", C.clay); }
      op(D.sqLines[selK], 0.95);
      op(D.sqLines[pk], 0.95);
      if (D.innerDots[innerK]) { D.innerDots[innerK].setAttribute("r", 7.5); }
    }

    return f;
  }

  function easeInOut(p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }

  /* animate the flyer travelling outer→inner along the squaring line (step 4) */
  function animateSquare(scene, n, selK, done) {
    if (reducedMotion()) { if (done) done(); return; }
    var m = n / 2;
    var from = polar(R, theta(selK, n));
    var to = polar(Ri, theta(selK % m, m));
    var flyer = scene.flyer;
    flyer.setAttribute("opacity", 1);
    var start = null, dur = 700;
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur), e = easeInOut(p);
      flyer.setAttribute("cx", from.x + (to.x - from.x) * e);
      flyer.setAttribute("cy", from.y + (to.y - from.y) * e);
      if (p < 1) requestAnimationFrame(frame);
      else { flyer.setAttribute("opacity", 0); if (done) done(); }
    }
    requestAnimationFrame(frame);
  }

  /* =====================================================================
     Render into a mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-rou-ready") === "1") return;
    mount.setAttribute("data-rou-ready", "1");
    mount.innerHTML = "";

    var n = 4;        /* lecture default: the FFT run on A(x)=x−10 uses 4 roots */
    var idx = 0;
    var selK = 1;     /* selected root for the squaring demo */
    var autoTimer = null;

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");

    /* ---- n selector ---- */
    var nRow = document.createElement("div");
    nRow.className = "viz-controls";
    nRow.style.marginTop = "0";
    nRow.style.marginBottom = ".7rem";
    var nLbl = document.createElement("span");
    nLbl.textContent = "בחר n:";
    nLbl.style.fontWeight = "700"; nLbl.style.color = C.ink; nLbl.style.fontSize = ".9rem";
    nRow.appendChild(nLbl);
    var nBtns = {};
    [2, 4, 8].forEach(function (val) {
      var b = mkBtn("n = " + val, function () { setN(val); });
      b.setAttribute("dir", "ltr");
      if (val === 4) b.title = "דוגמת ההרצאה: A(x)=x−10";
      nBtns[val] = b;
      nRow.appendChild(b);
    });
    wrap.appendChild(nRow);

    /* ---- layout: scene (svg) + table side by side, wraps on narrow ---- */
    var grid = document.createElement("div");
    grid.style.display = "flex";
    grid.style.flexWrap = "wrap";
    grid.style.gap = "12px";
    grid.style.alignItems = "flex-start";

    var scene = buildScene();
    var sceneBox = document.createElement("div");
    sceneBox.style.flex = "1 1 320px";
    sceneBox.style.minWidth = "280px";
    sceneBox.style.background = C.surface;
    sceneBox.style.borderRadius = "12px";
    sceneBox.style.padding = "4px";
    sceneBox.appendChild(scene.svg);
    grid.appendChild(sceneBox);

    /* bookkeeping table */
    var tableBox = document.createElement("div");
    tableBox.style.flex = "1 1 240px";
    tableBox.style.minWidth = "240px";
    tableBox.style.overflowX = "auto";
    var table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.fontSize = ".82rem";
    table.style.color = C.ink;
    tableBox.appendChild(table);
    grid.appendChild(tableBox);
    wrap.appendChild(grid);

    /* ---- step rail ---- */
    var rail = document.createElement("div");
    rail.setAttribute("role", "tablist");
    rail.setAttribute("aria-label", "שלבי ההסבר");
    rail.style.display = "flex";
    rail.style.flexWrap = "wrap";
    rail.style.gap = "6px";
    rail.style.margin = "14px 0 4px";
    var chips = STEPS.map(function (s, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "viz-btn";
      b.setAttribute("role", "tab");
      b.textContent = (i + 1) + "";
      b.title = s.title; b.setAttribute("aria-label", s.title);
      b.style.padding = ".2rem .62rem"; b.style.fontSize = ".82rem"; b.style.minWidth = "2rem";
      b.addEventListener("click", function () { stopAuto(); goto(i); });
      rail.appendChild(b);
      return b;
    });
    wrap.appendChild(rail);

    /* ---- explanation panel ---- */
    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.background = C.surface2;
    panel.style.border = "1px solid " + C.line;
    panel.style.borderRadius = "12px";
    panel.style.padding = "12px 14px";
    panel.style.marginTop = "10px";
    panel.style.minHeight = "96px";
    panel.style.color = C.ink;
    panel.style.lineHeight = "1.7";
    panel.style.fontSize = ".9rem";
    wrap.appendChild(panel);

    /* ---- controls ---- */
    var controls = document.createElement("div");
    controls.className = "viz-controls";
    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); goto(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); goto(idx + 1); });
    btnNext.classList.add("primary");
    var btnPlay = mkBtn("▶ הפעל", function () { toggleAuto(); });
    var btnReset = mkBtn("↺ איפוס", function () { stopAuto(); selK = 1; goto(0); });
    controls.appendChild(btnPrev);
    controls.appendChild(btnNext);
    controls.appendChild(btnPlay);
    controls.appendChild(btnReset);
    wrap.appendChild(controls);

    mount.appendChild(wrap);

    function mkBtn(label, fn) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "viz-btn"; b.textContent = label;
      b.addEventListener("click", fn);
      return b;
    }

    /* clicking a root: select it and jump to the squaring step */
    function onPick(k) {
      stopAuto();
      selK = k;
      if (idx < 4) goto(4); else goto(idx);
    }

    /* ---- rebuild table for current n, highlight per step ---- */
    function renderTable() {
      var m = n / 2, f = STEPS[idx].flags || {};
      var pk = (selK + m) % n;
      var html =
        '<thead><tr>' +
        '<th style="text-align:center;padding:5px 6px;border-bottom:2px solid ' + C.line + '">k</th>' +
        '<th style="text-align:center;padding:5px 6px;border-bottom:2px solid ' + C.line + '">זווית</th>' +
        '<th style="text-align:center;padding:5px 6px;border-bottom:2px solid ' + C.line + '" dir="ltr">ω' + sub(n) + sup("k") + '</th>' +
        '<th style="text-align:center;padding:5px 6px;border-bottom:2px solid ' + C.line + '" dir="ltr">(ω' + sub(n) + sup("k") + ')²</th>' +
        '</tr></thead><tbody>';
      for (var k = 0; k < n; k++) {
        var re = Math.cos(theta(k, n)), im = Math.sin(theta(k, n));
        var sre = Math.cos(2 * theta(k, n)), sim = Math.sin(2 * theta(k, n));
        var bg = "transparent";
        if (f.squareSel) {
          if (k === selK) bg = "rgba(105,162,151,.20)";       /* teal tint */
          else if (k === pk) bg = "rgba(190,124,94,.18)";     /* clay tint */
        } else if (f.valuesHi) {
          bg = "rgba(201,162,75,.12)";                        /* mustard tint */
        }
        var deg = Math.round(360 * k / n);
        html += '<tr style="background:' + bg + '">' +
          '<td style="text-align:center;padding:5px 6px;border-bottom:1px solid ' + C.line + '" dir="ltr">' + k + '</td>' +
          '<td style="text-align:center;padding:5px 6px;border-bottom:1px solid ' + C.line + '" dir="ltr">' + deg + '°</td>' +
          '<td style="text-align:center;padding:5px 6px;border-bottom:1px solid ' + C.line + ';font-weight:600" dir="ltr">' + fmtC(re, im) + '</td>' +
          '<td style="text-align:center;padding:5px 6px;border-bottom:1px solid ' + C.line + ';color:' + C.sage + ';font-weight:600" dir="ltr">' + fmtC(sre, sim) + '</td>' +
          '</tr>';
      }
      html += '</tbody>';
      table.innerHTML = html;
    }

    /* ---- navigation ---- */
    function goto(nn) {
      idx = Math.max(0, Math.min(STEPS.length - 1, nn));
      var f = applyState(scene, n, idx, selK);
      if (f.squareSel) animateSquare(scene, n, selK, function () { applyState(scene, n, idx, selK); });
      renderTable();
      renderPanel();
      renderChips();
      btnPrev.disabled = (idx === 0);
      btnNext.disabled = (idx === STEPS.length - 1);
    }

    function renderPanel() {
      var s = STEPS[idx];
      var body = typeof s.body === "function" ? s.body(n, selK) : s.body;
      panel.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px">' +
          '<span style="background:' + s.color + ';color:#fff;font-weight:700;font-size:.72rem;' +
            'padding:2px 10px;border-radius:99px" dir="ltr">' + s.badge + '</span>' +
          '<b style="font-size:1rem;color:' + C.ink + '">' + s.title + '</b>' +
        '</div><div>' + body + '</div>';
    }

    function renderChips() {
      chips.forEach(function (b, i) {
        var active = (i === idx), done = (i < idx), col = STEPS[i].color;
        b.setAttribute("aria-selected", active ? "true" : "false");
        if (active) { b.style.background = col; b.style.color = "#fff"; b.style.borderColor = col; }
        else if (done) { b.style.background = C.surface2; b.style.color = C.ink; b.style.borderColor = col; }
        else { b.style.background = C.surface2; b.style.color = C.inkSoft; b.style.borderColor = C.line; }
      });
    }

    function setN(val) {
      stopAuto();
      n = val;
      if (selK >= n) selK = 1;
      buildDynamic(scene, n, onPick);
      nBtns[2].classList.toggle("primary", val === 2);
      nBtns[4].classList.toggle("primary", val === 4);
      nBtns[8].classList.toggle("primary", val === 8);
      goto(idx);
    }

    /* ---- autoplay ---- */
    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      if (idx >= STEPS.length - 1) goto(0);
      btnPlay.textContent = "⏸ השהה";
      btnPlay.classList.add("primary");
      autoTimer = setInterval(function () {
        if (idx >= STEPS.length - 1) { stopAuto(); return; }
        goto(idx + 1);
      }, reducedMotion() ? 2600 : 3200);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      btnPlay.textContent = "▶ הפעל";
      btnPlay.classList.remove("primary");
    }

    /* keyboard: RTL-aware (Right = prev, Left = next) */
    wrap.addEventListener("keydown", function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute("role") === "button") return;
      if (e.key === "ArrowRight") { stopAuto(); goto(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { stopAuto(); goto(idx + 1); e.preventDefault(); }
      else if (e.key === "Home") { stopAuto(); goto(0); e.preventDefault(); }
      else if (e.key === "End") { stopAuto(); goto(STEPS.length - 1); e.preventDefault(); }
    });

    /* initial paint */
    setN(4);
  }

  /* =====================================================================
     boot — mount all instances; never throw.
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
