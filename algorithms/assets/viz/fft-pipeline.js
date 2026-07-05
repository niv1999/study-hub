/* =====================================================================
   fft-pipeline.js  —  Module 12 "מכפלת פולינומים ו-FFT"
   Grounded in _notes/11-fft-he.md + 11-fft-en.md — the EXACT lecture
   example that the students traced in class (lec-polynomial-mult-fft.pdf):

     A(x) = x − 10        →  a = (−10, 1, 0, 0)   (padded to 2n = 4)
     B(x) = 2x + 1        →  b = ( 1, 2, 0, 0)
     FFT(A) = (−9, −10+i, −11, −10−i)     (roots 1, i, −1, −i)
     FFT(B) = ( 3, 1+2i, −1, 1−2i)
     pointwise C = (−27, −12−19i, 11, −12+19i)
     FFT⁻¹(C):  Recursive-FFT(C) = (−40, 0, 8, −76)
                / n=4  → (−10, 0, 2, −19)
                swap y[1]↔y[3] → (−10, −19, 2, 0)
     result c = (−10, −19, 2, 0)  =  2x² − 19x − 10
     sanity:  (x−10)(2x+1) = 2x² + x − 20x − 10 = 2x² − 19x − 10  ✓

   The whole pipeline (מקדמים → FFT → כפל נקודתי → FFT⁻¹) is walked
   step-by-step; the Recursive-FFT recursion tree unfolds node-by-node,
   with the live "הפרד/ומשול" (divide/butterfly) bookkeeping shown for
   every combine — that bookkeeping IS the pedagogy (CONTRACT §5).

   Self-contained IIFE. Hand-authored SVG + DOM. No external deps.
   Cream design tokens hardcoded (CONTRACT §2); unit-6 accent = teal.
   Keyboard accessible, prefers-reduced-motion respected, never throws,
   graceful when the mount is absent. Works over file:// and http(s)://.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "fft-pipeline";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design palette (hardcoded per CONTRACT §2; unit-6 = teal) --- */
  var C = {
    bg: "#FBF7F0", surface: "#FFFDF8", surface2: "#FBF5EA",
    ink: "#33302B", inkSoft: "#6B655C", line: "#E7DECF",
    teal: "#2E8C82", tealDeep: "#1E6E66",
    clay: "#BE7C5E",
    sage: "#7C9885",
    mustard: "#C29A3F",
    blue: "#6E8CA0"
  };
  /* soft tints for highlighted tree nodes (per accent colour) */
  var TINT = {};
  TINT[C.teal] = "#DCEDEA"; TINT[C.tealDeep] = "#DCEDEA";
  TINT[C.clay] = "#F1E2D8"; TINT[C.sage] = "#E4EBE4";
  TINT[C.mustard] = "#F1E7CC"; TINT[C.blue] = "#E1E8ED";
  function tintOf(col) { return TINT[col] || C.surface2; }

  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function hexA(hex, a) {
    var h = hex.replace("#", "");
    var r = parseInt(h.substring(0, 2), 16),
        g = parseInt(h.substring(2, 4), 16),
        b = parseInt(h.substring(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  /* =====================================================================
     Complex arithmetic — the genuine Recursive-FFT runs on these numbers,
     so every value on screen is computed, not hardcoded.
     ===================================================================== */
  function K(re, im) { return { re: re, im: im || 0 }; }
  function cadd(a, b) { return { re: a.re + b.re, im: a.im + b.im }; }
  function csub(a, b) { return { re: a.re - b.re, im: a.im - b.im }; }
  function cmul(a, b) {
    return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
  }
  function croot(n) {                     /* ω_n = e^(2πi/n) */
    var t = 2 * Math.PI / n;
    return { re: Math.cos(t), im: Math.sin(t) };
  }

  /* ---- formatting (clean tiny FP noise → Gaussian integers) ---- */
  function clean(x) { var r = Math.round(x); return Math.abs(x - r) < 1e-9 ? r : x; }
  function fmtNum(x) {
    x = clean(x);
    if (Number.isInteger(x)) return (x < 0 ? "−" : "") + Math.abs(x);
    return (x < 0 ? "−" : "") + Math.abs(x).toFixed(2);
  }
  function imPart(mag) {                   /* mag > 0 */
    var a = clean(mag);
    return (Math.abs(a - 1) < 1e-9 ? "" : fmtNum(a)) + "i";
  }
  function fmtC(z) {
    var re = clean(z.re), im = clean(z.im);
    var reZero = Math.abs(re) < 1e-9, imZero = Math.abs(im) < 1e-9;
    if (imZero) return fmtNum(re);
    if (reZero) return (im < 0 ? "−" : "") + imPart(Math.abs(im));
    return fmtNum(re) + (im < 0 ? "−" : "+") + imPart(Math.abs(im));
  }
  function vecStr(arr) { return "(" + arr.map(fmtC).join(", ") + ")"; }
  function pz(s) {                          /* parenthesise a signed term */
    return (/[+−]/.test(s.slice(1)) || s.charAt(0) === "−") ? "(" + s + ")" : s;
  }
  var SUP = { 2: "²", 3: "³", 4: "⁴" };
  function polyStr(coeffs) {                /* coeffs low→high, real numbers */
    var terms = [];
    for (var d = coeffs.length - 1; d >= 0; d--) {
      var v = clean(coeffs[d]);
      if (Math.abs(v) < 1e-9) continue;
      var av = Math.abs(v);
      var mono = d === 0 ? "" : (d === 1 ? "x" : "x" + (SUP[d] || ("^" + d)));
      var cs = (av === 1 && d !== 0) ? "" : fmtNum(av);
      terms.push({ neg: v < 0, term: cs + mono });
    }
    if (!terms.length) return "0";
    var s = (terms[0].neg ? "−" : "") + terms[0].term;
    for (var i = 1; i < terms.length; i++)
      s += (terms[i].neg ? " − " : " + ") + terms[i].term;
    return s;
  }

  /* =====================================================================
     The genuine Recursive-FFT (CLRS / lecture pseudocode), instrumented:
     every recursion call becomes a tree node carrying its input a, its
     primitive root ω_n, the per-k butterfly records, and its result y.
     ===================================================================== */
  function fft(a) {
    var n = a.length;
    if (n === 1) return { a: a, n: 1, y: [a[0]], leaf: true };
    var wn = croot(n);
    var ev = [], od = [], i;
    for (i = 0; i < n; i += 2) ev.push(a[i]);
    for (i = 1; i < n; i += 2) od.push(a[i]);
    var even = fft(ev), odd = fft(od);
    var y = new Array(n), combos = [], w = K(1, 0);
    for (var k = 0; k < n / 2; k++) {
      var t = cmul(w, odd.y[k]);           /* ω · y^[1]_k */
      var y0 = even.y[k];
      y[k] = cadd(y0, t);
      y[k + n / 2] = csub(y0, t);
      combos.push({ k: k, w: { re: w.re, im: w.im }, t: t,
                    y0: y0, y1: odd.y[k], yk: y[k], ykn: y[k + n / 2] });
      w = cmul(w, wn);
    }
    return { a: a, n: n, wn: wn, even: even, odd: odd, combos: combos, y: y };
  }

  /* ---- run the exact lecture pipeline ---- */
  var A_c = [K(-10), K(1), K(0), K(0)];
  var B_c = [K(1), K(2), K(0), K(0)];
  var treeA = fft(A_c);
  var treeB = fft(B_c);
  var Cpts = treeA.y.map(function (za, j) { return cmul(za, treeB.y[j]); });
  var treeInv = fft(Cpts);                 /* FFT⁻¹ calls the SAME FFT */
  var invDiv = treeInv.y.map(function (z) { return { re: z.re / treeInv.n, im: z.im / treeInv.n }; });
  var invSwap = invDiv.slice();
  var tmp = invSwap[1]; invSwap[1] = invSwap[3]; invSwap[3] = tmp;   /* swap y[1]↔y[3] */
  var finalReal = invSwap.map(function (z) { return clean(z.re); });
  var ROOT_LABELS = ["1", "i", "−1", "−i"];               /* ω⁰,ω¹,ω²,ω³ */

  /* =====================================================================
     small DOM / SVG helpers
     ===================================================================== */
  function el(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function txt(x, y, s, attrs) {
    var t = el("text", attrs || {});
    t.setAttribute("x", x); t.setAttribute("y", y); t.textContent = s;
    return t;
  }
  function dv(css) { var d = document.createElement("div"); if (css) d.style.cssText = css; return d; }
  function hv(s, col) { return '<b style="color:' + col + '">' + s + "</b>"; }
  function codeBlock(lines) {
    return '<div style="font-family:ui-monospace,Menlo,Consolas,monospace;' +
      'font-size:.82rem;line-height:1.95;color:' + C.ink + '">' +
      lines.map(function (l) {
        return '<div dir="ltr" style="white-space:nowrap;overflow-x:auto">' + l + "</div>";
      }).join("") + "</div>";
  }

  /* combine (butterfly) bookkeeping for node N, index k */
  function combineHTML(N, k, col) {
    var c = N.combos[k], n = N.n, hi = k + n / 2, w = fmtC(c.w);
    return [
      "y<sub>" + k + "</sub> = y<sup>[0]</sup><sub>" + k + "</sub> + ω·y<sup>[1]</sup><sub>" + k +
        "</sub> = " + fmtC(c.y0) + " + " + w + "·" + pz(fmtC(c.y1)) + " = " + hv(fmtC(c.yk), col),
      "y<sub>" + hi + "</sub> = y<sup>[0]</sup><sub>" + k + "</sub> − ω·y<sup>[1]</sup><sub>" + k +
        "</sub> = " + fmtC(c.y0) + " − " + w + "·" + pz(fmtC(c.y1)) + " = " + hv(fmtC(c.ykn), col)
    ];
  }

  /* =====================================================================
     Recursion-tree scene builder (one per transform).
     Fixed 3-level binary tree (4 leaves). Nodes reveal/fill/highlight
     as the step engine advances.
     ===================================================================== */
  var TREE_KEYS = ["root", "ev", "od", "ev0", "ev1", "od0", "od1"];
  var LAY = {
    root: { cx: 350, top: 30, w: 210, fs: 9,  cap: "קריאה ראשית · n=4" },
    ev:   { cx: 180, top: 112, w: 152, fs: 10, cap: "זוגי a[0] · n=2" },
    od:   { cx: 520, top: 112, w: 152, fs: 10, cap: "אי-זוגי a[1] · n=2" },
    ev0:  { cx: 104, top: 196, w: 92, fs: 10, leaf: true, cap: "n=1" },
    ev1:  { cx: 256, top: 196, w: 92, fs: 10, leaf: true, cap: "n=1" },
    od0:  { cx: 444, top: 196, w: 92, fs: 10, leaf: true, cap: "n=1" },
    od1:  { cx: 596, top: 196, w: 92, fs: 10, leaf: true, cap: "n=1" }
  };
  var EDGES = [["root", "ev"], ["root", "od"], ["ev", "ev0"], ["ev", "ev1"], ["od", "od0"], ["od", "od1"]];
  var BH = 46;

  function buildTree(tf) {
    var T = tf.tree, col = tf.color;
    var nodeOf = {
      root: T, ev: T.even, od: T.odd,
      ev0: T.even.even, ev1: T.even.odd, od0: T.odd.even, od1: T.odd.odd
    };
    var svg = el("svg", {
      viewBox: "0 0 700 258", width: "100%", role: "img", direction: "ltr",
      "aria-label": "עץ הרקורסיה של " + tf.name
    });
    svg.style.display = "block"; svg.style.maxWidth = "700px";
    svg.style.margin = "0 auto"; svg.style.minWidth = "580px";

    var edgeEls = {};
    EDGES.forEach(function (e) {
      var p = LAY[e[0]], c = LAY[e[1]];
      var ln = el("line", { x1: p.cx, y1: p.top + BH, x2: c.cx, y2: c.top,
        stroke: C.line, "stroke-width": 1.6 });
      svg.appendChild(ln); edgeEls[e[1]] = ln;
    });
    /* a^[0] / a^[1] edge labels off the root */
    [["ev", "a[0]"], ["od", "a[1]"]].forEach(function (pair) {
      var p = LAY.root, c = LAY[pair[0]];
      var t = txt((p.cx + c.cx) / 2 + (pair[0] === "ev" ? -14 : 14),
        (p.top + BH + c.top) / 2, pair[1],
        { "text-anchor": "middle", "font-size": 10, "font-weight": 700, fill: C.inkSoft });
      t.setAttribute("dir", "ltr"); svg.appendChild(t);
    });

    var nodes = {};
    TREE_KEYS.forEach(function (k) {
      var lay = LAY[k], nd = nodeOf[k], g = el("g", {});
      var left = lay.cx - lay.w / 2;
      var box = el("rect", { x: left, y: lay.top, width: lay.w, height: BH, rx: 9,
        fill: C.surface, stroke: C.line, "stroke-width": 1.4 });
      g.appendChild(box);
      var aStr = lay.leaf ? "[" + fmtC(nd.a[0]) + "]" : vecStr(nd.a);
      var aT = txt(lay.cx, lay.top + (lay.leaf ? 28 : 19), aStr,
        { "text-anchor": "middle", "font-size": lay.fs, "font-weight": 700, fill: C.ink });
      aT.setAttribute("dir", "ltr"); g.appendChild(aT);
      var yT = txt(lay.cx, lay.top + 37, "",
        { "text-anchor": "middle", "font-size": lay.fs, "font-weight": 700, fill: col });
      yT.setAttribute("dir", "ltr"); yT.style.display = "none"; g.appendChild(yT);
      var cap = txt(lay.cx, lay.top - 6, lay.cap,
        { "text-anchor": "middle", "font-size": 8.5, "font-weight": 600, fill: C.inkSoft });
      cap.setAttribute("dir", "rtl"); g.appendChild(cap);
      svg.appendChild(g);
      nodes[k] = { g: g, box: box, yT: yT, node: nd, leaf: !!lay.leaf };
    });

    function apply(reveal, filled, hi) {
      TREE_KEYS.forEach(function (k) {
        var r = nodes[k], rev = reveal.indexOf(k) >= 0;
        r.g.style.display = rev ? "" : "none";
        var fill = filled.indexOf(k) >= 0, isHi = (k === hi);
        r.box.setAttribute("fill", isHi ? tintOf(col) : C.surface);
        r.box.setAttribute("stroke", isHi ? col : (fill ? "#C9B89E" : C.line));
        r.box.setAttribute("stroke-width", isHi ? 2.6 : 1.4);
        if (fill && !r.leaf) { r.yT.style.display = ""; r.yT.textContent = "y = " + vecStr(r.node.y); }
        else r.yT.style.display = "none";
      });
      Object.keys(edgeEls).forEach(function (childKey) {
        edgeEls[childKey].style.display = reveal.indexOf(childKey) >= 0 ? "" : "none";
      });
    }
    return { svg: svg, apply: apply };
  }

  /* =====================================================================
     Per-transform 6-step script (split → even → odd → combine k0 →
     combine k1 → return). Values are pulled from the real trace.
     ===================================================================== */
  var ALL = TREE_KEYS.slice();
  var CHILD_FILLED = ["ev0", "ev1", "ev", "od0", "od1", "od"];
  var ALL_FILLED = CHILD_FILLED.concat(["root"]);

  function buildFFTSteps(tf) {
    var T = tf.tree, ev = T.even, od = T.odd, col = tf.color;
    var wn4 = fmtC(T.wn), wn2 = fmtC(ev.wn);
    var s = [];

    s.push({ detail: "tree", transform: tf.key,
      reveal: ["root", "ev", "od"], filled: [], hi: "root",
      book: codeBlock([
        "n ← length[a] = " + T.n,
        "ω<sub>n</sub> ← e^{2πi/" + T.n + "} = " + hv(wn4, col),
        "a<sup>[0]</sup> ← (זוגיים) = " + hv(vecStr(ev.a), col),
        "a<sup>[1]</sup> ← (אי-זוגיים) = " + hv(vecStr(od.a), col),
        "y<sup>[0]</sup> ← FFT(a<sup>[0]</sup>) ; y<sup>[1]</sup> ← FFT(a<sup>[1]</sup>)"
      ]),
      expl: (tf.lead || "") + "Recursive-FFT על a=" + vecStr(T.a) + ": n=" + T.n +
        ", שורש היחידה הפרימיטיבי ω<sub>n</sub>=" + wn4 +
        ". שלב ה“הפרד”: מפרידים לזוגיים a<sup>[0]</sup>=" +
        vecStr(ev.a) + " ולאי-זוגיים a<sup>[1]</sup>=" + vecStr(od.a) +
        ", וקוראים ל-FFT על כל חצי." });

    s.push({ detail: "tree", transform: tf.key,
      reveal: ["root", "ev", "od", "ev0", "ev1"], filled: ["ev0", "ev1", "ev"], hi: "ev",
      book: codeBlock([
        "FFT(" + vecStr(ev.a) + ") · n=2 · ω<sub>n</sub>=" + hv(wn2, col),
        "בסיס: FFT([" + fmtC(ev.even.a[0]) + "]) = " + fmtC(ev.even.a[0]) +
          " , FFT([" + fmtC(ev.odd.a[0]) + "]) = " + fmtC(ev.odd.a[0]),
        "ω = 1"
      ].concat(combineHTML(ev, 0, col)).concat(["return y = " + hv(vecStr(ev.y), col)])),
      expl: "הקריאה הרקורסיבית על החצי הזוגי " +
        vecStr(ev.a) + ": n=2, ω<sub>n</sub>=" + wn2 +
        ". מקרי הבסיס (n=1) מחזירים את עצמם, והפרפר (butterfly) עם ω=1 נותן y=" +
        vecStr(ev.y) + "." });

    s.push({ detail: "tree", transform: tf.key,
      reveal: ALL, filled: CHILD_FILLED, hi: "od",
      book: codeBlock([
        "FFT(" + vecStr(od.a) + ") · n=2 · ω<sub>n</sub>=" + hv(wn2, col),
        "בסיס: FFT([" + fmtC(od.even.a[0]) + "]) = " + fmtC(od.even.a[0]) +
          " , FFT([" + fmtC(od.odd.a[0]) + "]) = " + fmtC(od.odd.a[0]),
        "ω = 1"
      ].concat(combineHTML(od, 0, col)).concat(["return y = " + hv(vecStr(od.y), col)])),
      expl: "הקריאה על החצי האי-זוגי " +
        vecStr(od.a) + ": באותו אופן n=2 ו-ω<sub>n</sub>=" + wn2 +
        ", ומתקבל y=" + vecStr(od.y) + "." });

    s.push({ detail: "tree", transform: tf.key,
      reveal: ALL, filled: CHILD_FILLED, hi: "root",
      book: codeBlock([
        "שלב “ומשול” · ω<sub>n</sub>=" + hv(wn4, col),
        "k = 0 , ω = " + fmtC(T.combos[0].w)
      ].concat(combineHTML(T, 0, col)).concat([
        "ω ← ω·ω<sub>n</sub> = " + hv(fmtC(T.combos[1].w), col)
      ])),
      expl: "שלב ה“ומשול” בקריאה הראשית, k=0 עם ω=1: מחברים ומחסירים את ערכי הילדים ומקבלים y<sub>0</sub>=" +
        fmtC(T.combos[0].yk) + " ו-y<sub>2</sub>=" + fmtC(T.combos[0].ykn) +
        ". אז מקדמים ω←ω·ω<sub>n</sub>=" + fmtC(T.combos[1].w) + "." });

    s.push({ detail: "tree", transform: tf.key,
      reveal: ALL, filled: CHILD_FILLED, hi: "root",
      book: codeBlock([
        "k = 1 , ω = " + fmtC(T.combos[1].w)
      ].concat(combineHTML(T, 1, col))),
      expl: "k=1 עם ω=" + fmtC(T.combos[1].w) + ": y<sub>1</sub>=" +
        fmtC(T.combos[1].yk) + " ו-y<sub>3</sub>=" + fmtC(T.combos[1].ykn) +
        ". החצי השני של הערכים מתקבל מאותם ילדים בסימן מנוגד (תכונת ω^{n/2}=−1)." });

    s.push({ detail: "tree", transform: tf.key,
      reveal: ALL, filled: ALL_FILLED, hi: "root",
      book: codeBlock([
        "return y = " + hv(vecStr(T.y), col),
        "← " + tf.name + " (הפולינום בייצוג נקודות)"
      ]),
      expl: tf.close });

    return s;
  }

  /* =====================================================================
     Non-tree detail panels (setup / pointwise / divide / swap / result)
     ===================================================================== */
  function card(title, lines, col) {
    return '<div style="background:' + C.surface + ';border:1px solid ' + C.line +
      ';border-top:3px solid ' + col + ';border-radius:12px;padding:10px 16px;min-width:190px">' +
      '<div style="font-weight:800;color:' + col + ';font-size:.82rem;margin-bottom:5px">' + title + "</div>" +
      lines.map(function (l) {
        return '<div dir="ltr" style="font-family:ui-monospace,Menlo,Consolas,monospace;' +
          'font-size:.9rem;color:' + C.ink + ';line-height:1.7">' + l + "</div>";
      }).join("") + "</div>";
  }

  var setupHtml =
    '<div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin-bottom:12px">' +
      card("פולינום A", ["A(x) = x − 10", "a = " + vecStr(A_c)], C.teal) +
      card("פולינום B", ["B(x) = 2x + 1", "b = " + vecStr(B_c)], C.clay) +
    "</div>" +
    '<div style="background:' + C.surface2 + ';border:1px solid ' + C.line + ';border-radius:12px;' +
      'padding:12px 16px;color:' + C.ink + ';line-height:1.75;font-size:.9rem">' +
      "ריפדנו את וקטורי המקדמים באפסים ל-<b dir=\"ltr\">2n = 4</b> מקומות, כי המכפלה היא ממעלה 2 ודורשת 4 נקודות. " +
      "המטרה: להעביר את שני הפולינומים לייצוג נקודות בעזרת <b dir=\"ltr\">FFT</b>, לכפול נקודה-נקודה, ולחזור למקדמים בעזרת <b dir=\"ltr\">FFT⁻¹</b> — הכול ב-Θ(n log n)." +
    "</div>";

  function pointwiseHtml() {
    var rows = "";
    for (var j = 0; j < 4; j++) {
      rows += '<tr>' +
        '<td style="padding:5px 10px;color:' + C.inkSoft + '">ω<sup>' + j + "</sup> = " + ROOT_LABELS[j] + "</td>" +
        '<td style="padding:5px 10px;color:' + C.teal + ';font-weight:700">' + fmtC(treeA.y[j]) + "</td>" +
        '<td style="padding:5px 6px;color:' + C.inkSoft + '">×</td>' +
        '<td style="padding:5px 10px;color:' + C.clay + ';font-weight:700">' + fmtC(treeB.y[j]) + "</td>" +
        '<td style="padding:5px 6px;color:' + C.inkSoft + '">=</td>' +
        '<td style="padding:5px 10px;color:' + C.mustard + ';font-weight:800">' + fmtC(Cpts[j]) + "</td>" +
        "</tr>";
    }
    return '<div style="overflow-x:auto"><table dir="ltr" style="margin:0 auto;border-collapse:collapse;' +
      'font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.92rem">' +
      '<thead><tr style="color:' + C.inkSoft + ';font-size:.78rem;font-weight:700">' +
        "<th style=\"padding:4px 10px\">שורש</th><th style=\"padding:4px 10px\">A(ω)</th><th></th>" +
        "<th style=\"padding:4px 10px\">B(ω)</th><th></th><th style=\"padding:4px 10px\">C(ω)</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table></div>" +
      '<p style="text-align:center;color:' + C.ink + ';font-size:.88rem;margin-top:10px;line-height:1.7">' +
      "בייצוג נקודות כפל פולינומים הוא פשוט כפל איבר-איבר — <b dir=\"ltr\">Θ(n)</b> בלבד.</p>";
  }

  function vecTransformHtml(before, after, opLabel, col) {
    return '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center;' +
      'font-family:ui-monospace,Menlo,Consolas,monospace;font-size:1rem">' +
      '<span dir="ltr" style="color:' + C.ink + '">' + before + "</span>" +
      '<span style="color:' + col + ';font-weight:800;font-size:.85rem;padding:4px 12px;border:1px solid ' + col +
        ';border-radius:99px">' + opLabel + "</span>" +
      '<span dir="ltr" style="color:' + col + ';font-weight:800">' + after + "</span></div>";
  }

  var divideHtml = vecTransformHtml(vecStr(treeInv.y), vecStr(invDiv),
    "÷ n = 4", C.sage) +
    '<p style="text-align:center;color:' + C.inkSoft + ';font-size:.86rem;margin-top:12px;line-height:1.7">' +
    "שורה 3 ב-Recursive-FFT⁻¹: <span dir=\"ltr\">y ← divide_vector_by_scalar(n)</span> — מחלקים כל רכיב ב-n.</p>";

  var swapHtml = vecTransformHtml(vecStr(invDiv), vecStr(invSwap),
    "swap y[1] ↔ y[3]", C.sage) +
    '<p style="text-align:center;color:' + C.inkSoft + ';font-size:.86rem;margin-top:12px;line-height:1.7">' +
    "שורות 4–5: <span dir=\"ltr\">for i ← 1 to n/2−1: swap(y[i], y[n−i])</span> — עבור n=4 זה swap יחיד של y[1] ו-y[3].</p>";

  var resultHtml =
    '<div style="text-align:center">' +
      '<div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:1rem;color:' + C.ink + ';margin-bottom:6px" dir="ltr">c = ' +
        vecStr(invSwap) + "</div>" +
      '<div style="font-size:1.5rem;font-weight:800;color:' + C.tealDeep + ';margin:8px 0" dir="ltr">' +
        polyStr(finalReal) + "</div>" +
      '<div style="background:' + C.surface2 + ';border:1px solid ' + C.line + ';border-radius:12px;' +
        'padding:12px 16px;margin-top:12px;color:' + C.ink + ';line-height:1.85;font-size:.92rem">' +
        "<b>בדיקה ידנית:</b><br>" +
        '<span dir="ltr">(x − 10)(2x + 1) = 2x² + x − 20x − 10 = <b style="color:' + C.sage + '">2x² − 19x − 10</b></span> ✓<br>' +
        "בדיוק מה שקיבלנו דרך ה-FFT — אבל ב-Θ(n log n) במקום Θ(n²)." +
      "</div></div>";

  /* =====================================================================
     Transform descriptors
     ===================================================================== */
  var TFA = { key: "A", tree: treeA, color: C.teal, name: "FFT(A)",
    close: "FFT(A) הושלם — A מיוצג עכשיו בנקודות (בשורשי היחידה 1, i, −1, −i) כ-" + vecStr(treeA.y) + "." };
  var TFB = { key: "B", tree: treeB, color: C.clay, name: "FFT(B)",
    close: "FFT(B) הושלם — B מיוצג בנקודות כ-" + vecStr(treeB.y) + ". עכשיו אפשר לכפול נקודה-נקודה." };
  var TFI = { key: "INV", tree: treeInv, color: C.sage, name: "FFT (הפנימי של FFT⁻¹)",
    lead: "FFT⁻¹ משתמש באותו Recursive-FFT — הפעם על וקטור הנקודות C. ",
    close: "ה-FFT הפנימי הושלם: c=" + vecStr(treeInv.y) + ". כעת נחלק ב-n ונהפוך את הסדר כדי לסיים את FFT⁻¹." };

  /* =====================================================================
     Compose the full step list with phase + board metadata
     ===================================================================== */
  var PHASES = ["הכנה", "FFT(A)", "FFT(B)", "כפל נקודתי", "FFT⁻¹", "תוצאה"];
  var PHASE_COL = [C.blue, C.teal, C.clay, C.mustard, C.sage, C.tealDeep];

  var STEPS = [];
  STEPS.push({ phase: 0, color: C.blue, detail: "html", html: setupHtml,
    board: { stage: 1, arrow: null },
    book: codeBlock([
      "A = " + hv(vecStr(A_c), C.teal) + "  →  A(x) = x − 10",
      "B = " + hv(vecStr(B_c), C.clay) + "  →  B(x) = 2x + 1",
      "ריפוד ל-2n = 4 מקומות"
    ]),
    expl: "מתחילים מייצוג המקדמים של A ו-B, ונעקוב אחר כל שלב בצינור הכפל. לחצו “הבא” כדי להתקדם." });

  buildFFTSteps(TFA).forEach(function (st) { st.phase = 1; st.color = C.teal; st.board = { stage: 2, arrow: "fft" }; STEPS.push(st); });
  buildFFTSteps(TFB).forEach(function (st) { st.phase = 2; st.color = C.clay; st.board = { stage: 2, arrow: "fft" }; STEPS.push(st); });

  STEPS.push({ phase: 3, color: C.mustard, detail: "html", html: pointwiseHtml(),
    board: { stage: 3, arrow: "pw" },
    book: codeBlock([
      "R(ω<sup>i</sup>) = A(ω<sup>i</sup>) · B(ω<sup>i</sup>) , 0 ≤ i ≤ 3",
      "C = " + hv(vecStr(Cpts), C.mustard)
    ]),
    expl: "כפל נקודה-נקודה: לכל שורש ω<sup>j</sup> מכפילים A(ω<sup>j</sup>)·B(ω<sup>j</sup>) ומקבלים את C בייצוג נקודות — בזמן Θ(n) בלבד." });

  buildFFTSteps(TFI).forEach(function (st) { st.phase = 4; st.color = C.sage; st.board = { stage: 4, arrow: "ifft" }; STEPS.push(st); });

  STEPS.push({ phase: 4, color: C.sage, detail: "html", html: divideHtml,
    board: { stage: 4, arrow: "ifft" },
    book: codeBlock([
      "y ← divide_vector_by_scalar(n)",
      vecStr(treeInv.y) + " / 4 = " + hv(vecStr(invDiv), C.sage)
    ]),
    expl: "מחלקים כל רכיב ב-n=4: " + vecStr(treeInv.y) + " / 4 = " + vecStr(invDiv) + "." });

  STEPS.push({ phase: 4, color: C.sage, detail: "html", html: swapHtml,
    board: { stage: 4, arrow: "ifft" },
    book: codeBlock([
      "for i ← 1 to n/2−1 : swap(y[i], y[n−i])",
      "swap(y[1], y[3]) → " + hv(vecStr(invSwap), C.sage)
    ]),
    expl: "לולאת ההיפוך: עבור i מ-1 עד n/2−1=1 מבצעים swap(y[i], y[n−i]) → swap(y[1], y[3]). התוצאה: " + vecStr(invSwap) + "." });

  STEPS.push({ phase: 5, color: C.tealDeep, detail: "html", html: resultHtml,
    board: { stage: 4, arrow: null },
    book: codeBlock([
      "c = " + hv(vecStr(invSwap), C.tealDeep),
      "= " + polyStr(finalReal)
    ]),
    expl: "סיימנו! וקטור המקדמים של המכפלה הוא " + vecStr(invSwap) +
      " = " + polyStr(finalReal) + ". הבדיקה הידנית מאשרת את התוצאה." });

  /* board fill thresholds (index of the step at which each value appears) */
  var IDX_FA = 6, IDX_FB = 12, IDX_PW = 13, IDX_RES = STEPS.length - 1;

  /* =====================================================================
     render one mount
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-fftp-ready") === "1") return;
    mount.setAttribute("data-fftp-ready", "1");
    mount.innerHTML = "";

    var idx = 0, autoTimer = null;

    var wrap = dv("direction:rtl");
    wrap.setAttribute("tabindex", "0");
    wrap.style.outline = "none";

    /* ---------- pipeline board ---------- */
    var board = dv("direction:ltr;display:flex;align-items:stretch;gap:8px;flex-wrap:nowrap;" +
      "background:" + C.surface + ";border:1px solid " + C.line + ";border-radius:14px;" +
      "padding:12px;overflow-x:auto;margin-bottom:14px");

    function boardTile(titleHe) {
      var t = dv("min-width:150px;flex:0 0 auto;background:" + C.surface2 +
        ";border:2px solid " + C.line + ";border-radius:12px;padding:9px 12px;transition:border-color .2s,box-shadow .2s");
      var h = dv("font-weight:800;font-size:.72rem;color:" + C.inkSoft + ";margin-bottom:5px;direction:rtl");
      h.textContent = titleHe;
      t.appendChild(h);
      return t;
    }
    function boardLine(html, hidden) {
      var l = dv("font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.78rem;color:" +
        C.ink + ";line-height:1.65;white-space:nowrap");
      l.setAttribute("dir", "ltr");
      l.innerHTML = html;
      if (hidden) l.style.visibility = "hidden";
      return l;
    }
    function boardArrow(labelHe, complexity, col) {
      var a = dv("flex:0 0 auto;align-self:center;display:flex;flex-direction:column;align-items:center;" +
        "min-width:78px;transition:opacity .2s");
      a.innerHTML =
        '<div style="font-weight:800;font-size:.74rem;color:' + col + ';direction:rtl">' + labelHe + "</div>" +
        '<div style="font-size:1.15rem;line-height:1;color:' + col + '">→</div>' +
        '<div dir="ltr" style="font-size:.66rem;color:' + C.inkSoft + '">' + complexity + "</div>";
      a._col = col;
      return a;
    }

    var tile1 = boardTile("מקדמים");
    tile1.appendChild(boardLine("A = " + vecStr(A_c), false));
    tile1.appendChild(boardLine("B = " + vecStr(B_c), false));

    var tile2 = boardTile("ערכים בנקודות");
    var faLine = boardLine("FFT(A) = " + vecStr(treeA.y), true);
    var fbLine = boardLine("FFT(B) = " + vecStr(treeB.y), true);
    tile2.appendChild(faLine); tile2.appendChild(fbLine);

    var tile3 = boardTile("מכפלה בנקודות");
    var cLine = boardLine("C = " + vecStr(Cpts), true);
    tile3.appendChild(cLine);

    var tile4 = boardTile("מקדמי המכפלה");
    var resLine = boardLine("c = " + vecStr(invSwap), true);
    var polyLine = boardLine("= " + polyStr(finalReal), true);
    polyLine.style.fontWeight = "800"; polyLine.style.color = C.tealDeep;
    tile4.appendChild(resLine); tile4.appendChild(polyLine);

    var arrFFT = boardArrow("FFT", "Θ(n log n)", C.teal);
    var arrPW = boardArrow("כפל נקודתי", "Θ(n)", C.mustard);
    var arrIFFT = boardArrow("FFT⁻¹", "Θ(n log n)", C.sage);

    board.appendChild(tile1); board.appendChild(arrFFT);
    board.appendChild(tile2); board.appendChild(arrPW);
    board.appendChild(tile3); board.appendChild(arrIFFT);
    board.appendChild(tile4);
    wrap.appendChild(board);

    var boardStages = { 1: tile1, 2: tile2, 3: tile3, 4: tile4 };
    var boardArrows = { fft: arrFFT, pw: arrPW, ifft: arrIFFT };

    /* ---------- phase chips ---------- */
    var chipRow = dv("display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px");
    var phaseStart = [];                     /* first step index of each phase */
    STEPS.forEach(function (s, i) { if (phaseStart[s.phase] === undefined) phaseStart[s.phase] = i; });
    var chips = PHASES.map(function (name, p) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "viz-btn";
      b.textContent = (p + 1) + " · " + name;
      b.style.padding = ".2rem .6rem"; b.style.fontSize = ".78rem";
      b.setAttribute("dir", "rtl");
      b.addEventListener("click", function () { stopAuto(); goto(phaseStart[p]); });
      chipRow.appendChild(b);
      return b;
    });
    wrap.appendChild(chipRow);

    /* ---------- detail area (three trees + html block) ---------- */
    var detail = dv("background:" + C.surface + ";border:1px solid " + C.line +
      ";border-radius:14px;padding:14px 10px;min-height:250px;margin-bottom:12px");

    var treeScenes = {}, treeWraps = {};
    [TFA, TFB, TFI].forEach(function (tf) {
      var sc = buildTree(tf);
      var box = dv("overflow-x:auto");
      box.appendChild(sc.svg);
      box.style.display = "none";
      detail.appendChild(box);
      treeScenes[tf.key] = sc;
      treeWraps[tf.key] = box;
    });
    var htmlBlock = dv("display:none");
    detail.appendChild(htmlBlock);
    wrap.appendChild(detail);

    /* ---------- bookkeeping panel ---------- */
    var bookPanel = dv("background:" + C.surface2 + ";border:1px solid " + C.line +
      ";border-radius:12px;padding:12px 16px;margin-bottom:10px;min-height:70px");
    bookPanel.setAttribute("aria-live", "polite");
    wrap.appendChild(bookPanel);

    /* ---------- explanation line ---------- */
    var explPanel = dv("background:" + C.surface + ";border:1px solid " + C.line +
      ";border-right:4px solid " + C.teal + ";border-radius:12px;padding:12px 16px;" +
      "color:" + C.ink + ";line-height:1.75;font-size:.92rem;min-height:64px;margin-bottom:12px");
    explPanel.setAttribute("aria-live", "polite");
    wrap.appendChild(explPanel);

    /* ---------- controls ---------- */
    var controls = dv("");
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
    var counter = dv("align-self:center;color:" + C.inkSoft + ";font-size:.82rem;font-weight:600;margin-inline-start:auto");
    controls.appendChild(counter);
    wrap.appendChild(controls);

    mount.appendChild(wrap);

    /* ---------- board / glow helpers ---------- */
    function setGlow(node, on, col) {
      node.style.borderColor = on ? col : C.line;
      node.style.boxShadow = (on && !reducedMotion()) ? ("0 0 0 3px " + hexA(col, 0.22)) : "none";
    }

    function updateBoard(step) {
      faLine.style.visibility = idx >= IDX_FA ? "visible" : "hidden";
      fbLine.style.visibility = idx >= IDX_FB ? "visible" : "hidden";
      cLine.style.visibility = idx >= IDX_PW ? "visible" : "hidden";
      resLine.style.visibility = polyLine.style.visibility = idx >= IDX_RES ? "visible" : "hidden";

      [1, 2, 3, 4].forEach(function (s) { setGlow(boardStages[s], false, C.line); });
      Object.keys(boardArrows).forEach(function (a) { boardArrows[a].style.opacity = ".5"; });
      if (step.board.stage) setGlow(boardStages[step.board.stage], true, step.color);
      if (step.board.arrow) boardArrows[step.board.arrow].style.opacity = "1";
    }

    /* ---------- render one step ---------- */
    function applyStep() {
      var step = STEPS[idx];
      Object.keys(treeWraps).forEach(function (k) { treeWraps[k].style.display = "none"; });
      if (step.detail === "tree") {
        htmlBlock.style.display = "none";
        treeWraps[step.transform].style.display = "";
        treeScenes[step.transform].apply(step.reveal, step.filled, step.hi);
      } else {
        htmlBlock.style.display = "";
        htmlBlock.innerHTML = step.html;
      }
      bookPanel.innerHTML = step.book;
      explPanel.innerHTML = step.expl;
      explPanel.style.borderRightColor = step.color;
      updateBoard(step);

      chips.forEach(function (b, p) {
        var active = (step.phase === p);
        b.style.background = active ? PHASE_COL[p] : C.surface2;
        b.style.color = active ? "#fff" : C.inkSoft;
        b.style.borderColor = active ? PHASE_COL[p] : C.line;
        b.setAttribute("aria-current", active ? "step" : "false");
      });

      counter.textContent = (idx + 1) + " / " + STEPS.length;
      btnPrev.disabled = (idx === 0);
      btnNext.disabled = (idx === STEPS.length - 1);
    }

    function goto(n) {
      idx = Math.max(0, Math.min(STEPS.length - 1, n));
      applyStep();
    }

    /* ---------- autoplay ---------- */
    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      if (idx >= STEPS.length - 1) goto(0);
      btnPlay.innerHTML = "⏸ השהה";
      btnPlay.classList.add("primary");
      var delay = reducedMotion() ? 2600 : 2100;
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

    /* keyboard: RTL-aware (Right = prev, Left = next) */
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { stopAuto(); goto(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { stopAuto(); goto(idx + 1); e.preventDefault(); }
      else if (e.key === "Home") { stopAuto(); goto(0); e.preventDefault(); }
      else if (e.key === "End") { stopAuto(); goto(STEPS.length - 1); e.preventDefault(); }
      else if ((e.key === " " || e.key === "Enter") && e.target === wrap) { toggleAuto(); e.preventDefault(); }
    });

    goto(0);
  }

  /* =====================================================================
     boot: mount all instances; guard for already-ready; never throw.
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
