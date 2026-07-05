/* =====================================================================
   convolution-matcher.js  —  Module 11 "התאמת מחרוזות בעזרת קונבולוציה"
   Grounded in _notes/10-convolution.md — the lecture's running example
   (שקפים 49-64, "בניית הפתרון – רדוקציה לקונבולוציה"):

     EXACT lecture example:
       T = 1 1 0 1 0 1 1 1 0        (n = 9)   [lec עמ' 51+]
       P = 1 1 0                    (m = 3)
       Reverse(P)      = 0 1 1                 (שלב 1 ברדוקציה)
       P'  = PadWithZero(Rev(P), n) = 0 1 1 0 0 0 0 0 0
       c₁  = T ⊗ P'   → סופר התאמות של '1'
       T̄ = NOT(T), P̄' = Pad(Rev(NOT(P))) = 1 0 0 0 0 0 0 0 0
       c₀  = T̄ ⊗ P̄'  → סופר התאמות של '0'
       הזזה חוקית ⇔  c₁[j] + c₀[j] = m   (j = shift + m-1),  ומדפיסים shift = j-m+1

     תוצאה: התאמות מלאות בהזזות s=0 ו-s=6  (T[0..2]=110=P , T[6..8]=110=P).

   הערה: בטרייס שבשקף עמ' 62 מופיע c₁=[0,1,2,1,1,1,0,2,2] — הערך c₁[6]=0 הוא
   טעות-שקף (אי-התאמה שהמחברת מסמנת ב"פערים"). הקונבולוציה הנכונה נותנת c₁[6]=1
   (T[4]+T[5]=0+1). הרכיב כאן מחשב את הקונבולוציה בעצמו ⇒ הערכים תמיד נכונים.

   Self-contained IIFE, hand-authored SVG. Cream design tokens hardcoded
   (CONTRACT §2). Step engine (הקודם/הבא/הפעל/איפוס) + live c₁/c₀/סכום
   bookkeeping. RTL Hebrew captions; array/algorithm labels stay LTR.
   Graceful if the mount is absent; never throws; zero console errors.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "convolution-matcher";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design palette (hardcoded per CONTRACT §2, unit-5 = plum) --- */
  var C = {
    bg:      "#FBF7F0",
    surface: "#FFFDF8",
    surface2:"#FBF5EA",
    ink:     "#33302B",
    inkSoft: "#6B655C",
    line:    "#E7DECF",
    plum:    "#9B7E9E",  /* unit-5 accent — the pattern P */
    teal:    "#69A297",  /* '1'-match  → feeds c₁ */
    mustard: "#C9A24B",  /* full-match highlight (gold) */
    slate:   "#7E8CA0",  /* the text T */
    rose:    "#BE7C8F"   /* '0'-match  → feeds c₀ */
  };

  /* ---- the EXACT lecture example (see header) ---- */
  var T = [1, 1, 0, 1, 0, 1, 1, 1, 0];
  var P = [1, 1, 0];
  var n = T.length, m = P.length;

  /* ---- derive the reduction vectors + convolutions (always correct) ---- */
  function rev(a)      { return a.slice().reverse(); }
  function not(a)      { return a.map(function (x) { return 1 - x; }); }
  function pad(a, L)   { var b = a.slice(); while (b.length < L) b.push(0); return b; }
  function conv(a, b) {          /* c[j] = Σ_{k=0}^{j} a_k · b_{j-k}, j=0..n-1 */
    var c = [];
    for (var j = 0; j < n; j++) {
      var s = 0;
      for (var k = 0; k <= j; k++) s += (a[k] || 0) * (b[j - k] || 0);
      c.push(s);
    }
    return c;
  }
  var Prev  = rev(P);                 /* 0 1 1 */
  var Ppad  = pad(Prev, n);           /* 0 1 1 0 0 0 0 0 0 */
  var Tbar  = not(T);                 /* 0 0 1 0 1 0 0 0 1 */
  var Pbpad = pad(rev(not(P)), n);    /* 1 0 0 0 0 0 0 0 0 */
  var c1    = conv(T, Ppad);          /* '1'-match counts */
  var c0    = conv(Tbar, Pbpad);      /* '0'-match counts */
  var VALID = m - 1;                  /* first meaningful output index */

  /* ---------------------------------------------------------------
     STEP MODEL — an ordered script. Each step declares a phase (+shift)
     and its own Hebrew explanation. Shifts s = 0 .. n-m.
     --------------------------------------------------------------- */
  var STEPS = [];
  STEPS.push({ phase: "intro",   badge: "reduction",  color: C.slate });
  STEPS.push({ phase: "reverse", badge: "Reverse(P)", color: C.plum });
  STEPS.push({ phase: "pad",     badge: "PadWithZero", color: C.plum });
  for (var s = 0; s <= n - m; s++) {
    STEPS.push({ phase: "shift", s: s, badge: "shift = " + s, color: C.teal });
  }
  STEPS.push({ phase: "done", badge: "output", color: C.mustard });

  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function el(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function txt(x, y, s, attrs) {
    var t = el("text", attrs || {});
    t.setAttribute("x", x); t.setAttribute("y", y);
    t.textContent = s;
    return t;
  }
  function bin(v) { return v === 1 ? "1" : "0"; }

  /* ===============================================================
     render one mount
     =============================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-cm-ready") === "1") return;
    mount.setAttribute("data-cm-ready", "1");
    mount.innerHTML = "";

    /* ---------- geometry ---------- */
    var W = 760, H = 356;
    var cw = 52, stride = 60;
    var trackW = m > 0 ? (n * cw + (n - 1) * (stride - cw)) : 0; /* = (n-1)*stride+cw */
    trackW = (n - 1) * stride + cw;
    var x0 = Math.round((W - trackW) / 2);
    function ox(i) { return x0 + i * stride; }         /* cell left x   */
    function ocx(i) { return x0 + i * stride + cw / 2; } /* cell centre x */

    var yIdx = 34;              /* index numbers above T */
    var yT = 44,  cellH = 40;   /* text row   */
    var yP = 150;               /* pattern row */
    var chipY = 118;            /* comparison chip between the two rows */
    var yC1 = 224, vH = 34;     /* c₁ vector row */
    var yC0 = 268;              /* c₀ vector row */
    var yTot = 312, tH = 30;    /* c₁+c₀ row */

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";

    /* ===== SVG scene ===== */
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H,
      width: "100%", role: "img", direction: "ltr",
      "aria-label": "רדוקציה מהתאמת מחרוזות לקונבולוציה על הדוגמה T=110101110, P=110"
    });
    svg.style.display = "block";
    svg.style.maxWidth = W + "px";
    svg.style.margin = "0 auto";

    /* row labels (left, LTR technical) */
    function rowLabel(y, label, color, sub) {
      var g = el("g");
      g.appendChild(txt(x0 - 14, y, label, {
        "text-anchor": "end", "font-size": 15, "font-weight": 700,
        fill: color, "font-family": "monospace", "dominant-baseline": "middle"
      }));
      if (sub) g.appendChild(txt(x0 - 14, y + 15, sub, {
        "text-anchor": "end", "font-size": 9, fill: C.inkSoft,
        "dominant-baseline": "middle"
      }));
      svg.appendChild(g);
      return g;
    }

    /* ---- index numbers above T ---- */
    for (var i = 0; i < n; i++) {
      svg.appendChild(txt(ocx(i), yIdx, String(i), {
        "text-anchor": "middle", "font-size": 11, fill: C.inkSoft,
        "font-family": "monospace"
      }));
    }
    svg.appendChild(txt(ox(n - 1) + cw + 8, yIdx, "index", {
      "font-size": 9.5, fill: C.inkSoft, "dominant-baseline": "middle"
    }));

    /* ---- T row (static cells) ---- */
    rowLabel(yT + cellH / 2, "T", C.slate);
    var tCells = [];
    for (i = 0; i < n; i++) {
      var r = el("rect", {
        x: ox(i), y: yT, width: cw, height: cellH, rx: 8,
        fill: C.surface, stroke: C.slate, "stroke-width": 1.5
      });
      var tt = txt(ocx(i), yT + cellH / 2, bin(T[i]), {
        "text-anchor": "middle", "dominant-baseline": "central",
        "font-size": 20, "font-weight": 700, fill: C.ink, "font-family": "monospace"
      });
      svg.appendChild(r); svg.appendChild(tt);
      tCells.push({ rect: r, text: tt });
    }

    /* ---- gold window frame (over the current shift's m text cells) ---- */
    var winFrame = el("rect", {
      x: ox(0), y: yT - 5, width: m * stride - (stride - cw) + 10, height: cellH + 10,
      rx: 11, fill: "none", stroke: C.mustard, "stroke-width": 3, opacity: 0
    });
    svg.appendChild(winFrame);

    /* ---- comparison chips + connectors group (rebuilt each shift) ---- */
    var gConnect = el("g"); svg.appendChild(gConnect);

    /* ---- pattern group (rebuilt each step) ---- */
    var patLabel = rowLabel(yP + cellH / 2, "P", C.plum, "sliding");
    var gPattern = el("g"); svg.appendChild(gPattern);

    /* ---- c₁ / c₀ / total vector rows (static cells, updated per step) ---- */
    function mkVector(y, h, label, color, sub) {
      rowLabel(y + h / 2, label, color, sub);
      var arr = [];
      for (var i = 0; i < n; i++) {
        var relevant = i >= VALID;
        var r = el("rect", {
          x: ox(i), y: y, width: cw, height: h, rx: 7,
          fill: relevant ? C.surface : C.surface2,
          stroke: relevant ? C.line : C.line,
          "stroke-width": 1.5,
          "stroke-dasharray": relevant ? "" : "3 3"
        });
        var t = txt(ocx(i), y + h / 2, relevant ? "" : "·", {
          "text-anchor": "middle", "dominant-baseline": "central",
          "font-size": 17, "font-weight": 700,
          fill: relevant ? color : C.inkSoft, "font-family": "monospace"
        });
        svg.appendChild(r); svg.appendChild(t);
        arr.push({ rect: r, text: t, relevant: relevant });
      }
      return arr;
    }
    var c1Cells  = mkVector(yC1, vH,  "c₁", C.teal, "1-match");
    var c0Cells  = mkVector(yC0, vH,  "c₀", C.rose, "0-match");
    var totCells = mkVector(yTot, tH, "c₁+c₀", C.ink, "= m?");

    /* the "relevant window m-1 .. n-1" bracket under the index row of c₁ */
    svg.appendChild(txt(ocx(VALID), yC1 - 8, "↓ " + VALID + " .. " + (n - 1) + " (הזזות חוקיות)", {
      "font-size": 9.5, fill: C.inkSoft, "text-anchor": "start", direction: "rtl"
    }));

    var scene = document.createElement("div");
    scene.style.background = C.surface;
    scene.style.borderRadius = "12px";
    scene.style.overflowX = "auto";
    scene.appendChild(svg);
    wrap.appendChild(scene);

    /* ===== legend ===== */
    var legend = document.createElement("div");
    legend.style.cssText =
      "display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;font-size:.8rem;color:" +
      C.inkSoft + ";direction:rtl";
    [[C.teal, "התאמת '1' (→ c₁)"], [C.rose, "התאמת '0' (→ c₀)"],
     [C.line, "אי-התאמה"], [C.mustard, "התאמה מלאה (c₁+c₀=m)"]]
      .forEach(function (p) {
        var it = document.createElement("span");
        it.style.cssText = "display:inline-flex;align-items:center;gap:6px";
        it.innerHTML = '<span style="width:14px;height:14px;border-radius:4px;background:' +
          p[0] + ';display:inline-block;border:1px solid rgba(0,0,0,.08)"></span>' + p[1];
        legend.appendChild(it);
      });
    wrap.appendChild(legend);

    /* ===== explanation panel ===== */
    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.cssText =
      "background:" + C.surface2 + ";border:1px solid " + C.line +
      ";border-radius:12px;padding:12px 14px;margin-top:12px;min-height:112px;color:" +
      C.ink + ";line-height:1.7;font-size:.9rem";
    wrap.appendChild(panel);

    /* ===== step chips rail ===== */
    var rail = document.createElement("div");
    rail.setAttribute("role", "tablist");
    rail.setAttribute("aria-label", "שלבי הרדוקציה");
    rail.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-top:12px";
    var chips = STEPS.map(function (st, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "viz-btn"; b.setAttribute("role", "tab");
      b.textContent = st.phase === "shift" ? "s" + st.s
        : st.phase === "intro" ? "◦" : st.phase === "reverse" ? "R"
        : st.phase === "pad" ? "0" : "✓";
      b.style.cssText = "padding:.2rem .6rem;font-size:.8rem;min-width:2rem";
      b.addEventListener("click", function () { stopAuto(); goTo(i); });
      rail.appendChild(b);
      return b;
    });
    wrap.appendChild(rail);

    /* ===== controls ===== */
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
    var btnPrev  = mkBtn("→ הקודם", function () { stopAuto(); goTo(idx - 1); });
    var btnNext  = mkBtn("הבא ←",  function () { stopAuto(); goTo(idx + 1); }, true);
    var btnPlay  = mkBtn("▶ הפעל",  function () { toggleAuto(); });
    var btnReset = mkBtn("↺ איפוס", function () { stopAuto(); goTo(0); });
    [btnPrev, btnNext, btnPlay, btnReset].forEach(function (b) { controls.appendChild(b); });
    wrap.appendChild(controls);

    /* hidden live-region for screen readers */
    var status = document.createElement("p");
    status.setAttribute("aria-live", "polite");
    status.style.cssText =
      "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;" +
      "clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0";
    wrap.appendChild(status);

    mount.appendChild(wrap);

    /* ---------------------------------------------------------------
       pattern-row builder — cells + their chars for a phase
       --------------------------------------------------------------- */
    function buildPattern(cells, startI, highlightRev) {
      gPattern.innerHTML = "";
      cells.forEach(function (val, k) {
        var xi = startI + k;
        var isZeroPad = highlightRev === "pad" && k >= m;
        var r = el("rect", {
          x: ox(xi), y: yP, width: cw, height: cellH, rx: 8,
          fill: isZeroPad ? C.surface2 : C.surface,
          stroke: C.plum, "stroke-width": 1.5,
          "stroke-dasharray": isZeroPad ? "3 3" : "",
          opacity: isZeroPad ? 0.75 : 1
        });
        gPattern.appendChild(r);
        gPattern.appendChild(txt(ocx(xi), yP + cellH / 2, bin(val), {
          "text-anchor": "middle", "dominant-baseline": "central",
          "font-size": 20, "font-weight": 700,
          fill: isZeroPad ? C.inkSoft : C.ink, "font-family": "monospace"
        }));
      });
    }

    /* ---------------------------------------------------------------
       connectors + comparison chips for a given shift s
       --------------------------------------------------------------- */
    function buildConnectors(s) {
      gConnect.innerHTML = "";
      for (var k = 0; k < m; k++) {
        var ti = s + k;                 /* text index   */
        var tc = T[ti], pc = P[k];
        var cat = (tc === 1 && pc === 1) ? "one"
                : (tc === 0 && pc === 0) ? "zero" : "miss";
        var col = cat === "one" ? C.teal : cat === "zero" ? C.rose : C.line;
        var cx = ocx(ti);
        /* connector line */
        gConnect.appendChild(el("line", {
          x1: cx, y1: yT + cellH + 2, x2: cx, y2: yP - 2,
          stroke: col, "stroke-width": cat === "miss" ? 1.5 : 2.6,
          "stroke-dasharray": cat === "miss" ? "3 4" : "",
          opacity: cat === "miss" ? 0.65 : 1
        }));
        /* comparison chip */
        var glyph = cat === "miss" ? "≠" : "=";
        var chipW = 44;
        gConnect.appendChild(el("rect", {
          x: cx - chipW / 2, y: chipY - 11, width: chipW, height: 22, rx: 11,
          fill: cat === "miss" ? C.surface2 : col,
          stroke: cat === "miss" ? C.line : col, "stroke-width": 1
        }));
        gConnect.appendChild(txt(cx, chipY, bin(tc) + glyph + bin(pc), {
          "text-anchor": "middle", "dominant-baseline": "central",
          "font-size": 12.5, "font-weight": 700, "font-family": "monospace",
          fill: cat === "miss" ? C.inkSoft : "#ffffff"
        }));
      }
    }

    /* ---------------------------------------------------------------
       fill the c₁ / c₀ / total vectors up to a given shift (inclusive).
       upto = highest shift already computed, or -1 for none.
       --------------------------------------------------------------- */
    function fillVectors(upto) {
      for (var j = 0; j < n; j++) {
        var shiftForJ = j - (m - 1);
        var known = j >= VALID && shiftForJ <= upto;
        setCell(c1Cells[j], known ? String(c1[j]) : (j >= VALID ? "" : "·"), C.teal, known);
        setCell(c0Cells[j], known ? String(c0[j]) : (j >= VALID ? "" : "·"), C.rose, known);
        var tot = c1[j] + c0[j];
        var full = known && tot === m;
        var tc = totCells[j];
        setCell(tc, known ? String(tot) : (j >= VALID ? "" : "·"), C.ink, known);
        if (full) {
          tc.rect.setAttribute("fill", C.mustard);
          tc.rect.setAttribute("stroke", C.mustard);
          tc.text.setAttribute("fill", "#ffffff");
        }
      }
    }
    function setCell(cell, value, color, known) {
      cell.text.textContent = value;
      if (!cell.relevant) return;
      if (known) {
        cell.rect.setAttribute("fill", C.surface);
        cell.rect.setAttribute("stroke", color);
        cell.rect.setAttribute("stroke-dasharray", "");
        cell.text.setAttribute("fill", color);
      } else {
        cell.rect.setAttribute("fill", C.surface);
        cell.rect.setAttribute("stroke", C.line);
        cell.rect.setAttribute("stroke-dasharray", "");
        cell.text.setAttribute("fill", color);
      }
    }

    /* highlight the current output cell (ring) */
    function ringCell(cell) {
      cell.rect.setAttribute("stroke", C.mustard);
      cell.rect.setAttribute("stroke-width", "3");
    }
    function clearRings() {
      [c1Cells, c0Cells, totCells].forEach(function (row) {
        row.forEach(function (cell) { cell.rect.setAttribute("stroke-width", "1.5"); });
      });
    }

    /* ---------------------------------------------------------------
       explanation text (Hebrew) per step
       --------------------------------------------------------------- */
    var L = '<span dir="ltr">';
    function tv(a) { return '<b dir="ltr" style="font-family:monospace">' + a.join(" ") + '</b>'; }

    function panelIntro() {
      return {
        title: "המטרה — התאמת מחרוזות בעזרת קונבולוציה",
        html: "נחפש את כל ההזזות החוקיות של התבנית " + tv(P) + " בתוך הטקסט " + tv(T) +
          " — אך במקום השוואה ישירה, נשתמש ב<b>קונבולוציה</b>. הרעיון: הקונבולוציה " +
          "<span dir=\"ltr\">c = T⊗P'</span> „מחליקה” וקטור אחד על פני השני — בדיוק כמו הזזת " +
          "תבנית על טקסט. הערך " + L + "c₁[j]</span> יְסַפֵּר כמה תווי '1' מתאימים בכל הזזה."
      };
    }
    function panelReverse() {
      return {
        title: "שלב 1 ברדוקציה — היפוך התבנית " + L + "Reverse(P)</span>",
        html: "הקונבולוציה מזיזה את הווקטור השני כשהוא <b>הפוך</b>. כדי שההיפוך „יתבטל” ונקבל את סדר " +
          "ההשוואה המקורי, נהפוך את התבנית מראש: " + tv(P) + " ⟶ " + tv(Prev) +
          ". (זו בדיוק הסיבה שבהזזה " + L + "j=m-1</span> מתקיים " + L +
          "c₁=Σ T_k·p_k</span> — ההיפוך מתקזז.)"
      };
    }
    function panelPad() {
      return {
        title: "שלב 2 — ריפוד באפסים " + L + "PadWithZero</span>",
        html: "הקונבולוציה מוגדרת על שני וקטורים <b>באותו אורך</b>, לכן נרפד את התבנית ההפוכה באפסים " +
          "עד אורך הטקסט: " + L + "P'</span> = " + tv(Ppad) + ". האפסים אינם משפיעים על הסכום.<br>" +
          "במקביל, כדי לספור גם התאמות של '0' נחשב קונבולוציה שנייה על " + L + "T̄=NOT(T)</span> = " +
          tv(Tbar) + " ועל " + L + "P̄'=Pad(Rev(NOT(P)))</span> = " + tv(Pbpad) + " → הווקטור " +
          L + "c₀</span>."
      };
    }
    function panelShift(s) {
      var j = s + m - 1;
      var win = T.slice(s, s + m);
      var ones = c1[j], zeros = c0[j], tot = ones + zeros;
      var parts = [];
      for (var k = 0; k < m; k++) {
        var tc = T[s + k], pc = P[k];
        var cat = (tc === 1 && pc === 1) ? "one" : (tc === 0 && pc === 0) ? "zero" : "miss";
        var col = cat === "one" ? C.teal : cat === "zero" ? C.rose : C.inkSoft;
        parts.push('<span dir="ltr" style="color:' + col + ';font-weight:700;font-family:monospace">' +
          bin(tc) + (cat === "miss" ? "≠" : "=") + bin(pc) + '</span>');
      }
      var verdict = tot === m
        ? '<b style="color:' + C.mustard + '">c₁[' + j + ']+c₀[' + j + '] = ' + ones + '+' + zeros +
          ' = m ⟹ הזזה חוקית! מדפיסים <span dir="ltr">shift = j-m+1 = ' + s + '</span> ✓</b>'
        : '<span style="color:' + C.inkSoft + '">c₁[' + j + ']+c₀[' + j + '] = ' + ones + '+' + zeros +
          ' = ' + tot + ' &lt; m ⟹ אין התאמה מלאה בהזזה ' + s + '.</span>';
      return {
        title: "הזזה " + L + "s = " + s + "</span> — מיישרים את P מול " + L + "T[" + s + ".." + (s + m - 1) + "]</span>",
        html: "חלון הטקסט " + tv(win) + " מול התבנית " + tv(P) + ". משווים תו-מול-תו: " +
          parts.join(" · ") + ".<br>" +
          "מספר התאמות '1' → <b dir=\"ltr\" style=\"color:" + C.teal + "\">c₁[" + j + "]=" + ones +
          "</b> · מספר התאמות '0' → <b dir=\"ltr\" style=\"color:" + C.rose + "\">c₀[" + j + "]=" +
          zeros + "</b>.<br>" + verdict
      };
    }
    function panelDone() {
      return {
        title: "פלט האלגוריתם " + L + "convolution_string_matcher</span>",
        html: "עברנו על " + L + "j = m-1 .. n-1</span> ובכל תא שבו " + L + "c₁[j]+c₀[j]=m</span> " +
          "הדפסנו התאמה:<br>" +
          '<span dir="ltr" style="font-family:monospace;color:' + C.mustard + ';font-weight:700">' +
          'Pattern occurs with shift 0<br>Pattern occurs with shift 6</span><br>' +
          "ואכן " + L + "T[0..2]=110=P</span> ו-" + L + "T[6..8]=110=P</span>. שתי הקונבולוציות עולות " +
          L + "O(n·log n)</span> בעזרת FFT — לעומת " + L + "O(n·m)</span> בהשוואה נאיבית."
      };
    }

    /* ---------------------------------------------------------------
       navigation / rendering
       --------------------------------------------------------------- */
    var idx = 0, prevIdx = -1, autoTimer = null;

    function goTo(nIdx) {
      idx = Math.max(0, Math.min(STEPS.length - 1, nIdx));
      var st = STEPS[idx];
      clearRings();

      /* --- pattern row + connectors + window frame per phase --- */
      gConnect.innerHTML = "";
      winFrame.setAttribute("opacity", 0);
      patLabel.querySelector("text").textContent =
        st.phase === "reverse" ? "P" : st.phase === "pad" ? "P'" : "P";

      if (st.phase === "intro") {
        buildPattern(P, 0, null);
      } else if (st.phase === "reverse") {
        buildPattern(Prev, 0, "rev");
      } else if (st.phase === "pad") {
        buildPattern(Ppad, 0, "pad");
      } else if (st.phase === "shift") {
        buildPattern(P, st.s, null);
        buildConnectors(st.s);
        /* gold window frame over the m text cells */
        winFrame.setAttribute("x", ox(st.s) - 5);
        winFrame.setAttribute("width", (m - 1) * stride + cw + 10);
        var full = (c1[st.s + m - 1] + c0[st.s + m - 1]) === m;
        winFrame.setAttribute("opacity", full ? 1 : 0.4);
        winFrame.setAttribute("stroke", full ? C.mustard : C.plum);
        slidePattern(st.s);
      } else if (st.phase === "done") {
        buildPattern(P, n - m, null);   /* park at last window */
        winFrame.setAttribute("x", ox(n - m) - 5);
        winFrame.setAttribute("width", (m - 1) * stride + cw + 10);
        winFrame.setAttribute("opacity", 1);
        winFrame.setAttribute("stroke", C.mustard);
      }

      /* --- vectors --- */
      var upto = st.phase === "shift" ? st.s : (st.phase === "done" ? n - m : -1);
      fillVectors(upto);
      if (st.phase === "shift") {
        var j = st.s + m - 1;
        ringCell(c1Cells[j]); ringCell(c0Cells[j]); ringCell(totCells[j]);
        pulse([c1Cells[j], c0Cells[j], totCells[j]]);
      }

      /* --- panel + chips + status --- */
      var info = st.phase === "intro" ? panelIntro()
        : st.phase === "reverse" ? panelReverse()
        : st.phase === "pad" ? panelPad()
        : st.phase === "shift" ? panelShift(st.s)
        : panelDone();
      panel.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px">' +
          '<span style="background:' + st.color + ';color:#fff;font-weight:700;font-size:.72rem;' +
            'padding:2px 10px;border-radius:99px" dir="ltr">' + st.badge + '</span>' +
          '<b style="font-size:1rem;color:' + C.ink + '">' + info.title + '</b>' +
        '</div><div>' + info.html + '</div>';
      status.textContent = info.title.replace(/<[^>]+>/g, "");

      renderChips();
      btnPrev.disabled = (idx === 0);
      btnNext.disabled = (idx === STEPS.length - 1);
      prevIdx = idx;
    }

    function renderChips() {
      chips.forEach(function (b, i) {
        var active = (i === idx), done = (i < idx);
        var col = STEPS[i].color;
        b.setAttribute("aria-selected", active ? "true" : "false");
        if (active) { b.style.background = col; b.style.color = "#fff"; b.style.borderColor = col; }
        else if (done) { b.style.background = C.surface2; b.style.color = C.ink; b.style.borderColor = col; }
        else { b.style.background = C.surface2; b.style.color = C.inkSoft; b.style.borderColor = C.line; }
      });
    }

    function slidePattern(sNew) {
      if (reducedMotion() || !gPattern.animate) return;
      var prev = STEPS[prevIdx];
      if (!prev || prev.phase !== "shift") return;
      var dx = (prev.s - sNew) * stride;
      if (!dx) return;
      gPattern.animate(
        [{ transform: "translateX(" + dx + "px)" }, { transform: "translateX(0)" }],
        { duration: 320, easing: "cubic-bezier(.22,.61,.36,1)" }
      );
    }

    function pulse(cells) {
      if (reducedMotion()) return;
      cells.forEach(function (c) {
        if (c.rect.animate) c.rect.animate(
          [{ opacity: 0.4 }, { opacity: 1 }], { duration: 300 });
      });
    }

    /* ---- autoplay ---- */
    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      if (idx >= STEPS.length - 1) goTo(0);
      btnPlay.innerHTML = "⏸ השהה";
      btnPlay.classList.add("primary");
      var delay = reducedMotion() ? 1900 : 2100;
      autoTimer = setInterval(function () {
        if (idx >= STEPS.length - 1) { stopAuto(); return; }
        goTo(idx + 1);
      }, delay);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      btnPlay.innerHTML = "▶ הפעל";
      btnPlay.classList.remove("primary");
    }

    /* keyboard: RTL-aware (Right = prev, Left = next) */
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { stopAuto(); goTo(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { stopAuto(); goTo(idx + 1); e.preventDefault(); }
      else if (e.key === "Home") { stopAuto(); goTo(0); e.preventDefault(); }
      else if (e.key === "End") { stopAuto(); goTo(STEPS.length - 1); e.preventDefault(); }
    });
    if (!wrap.hasAttribute("tabindex")) wrap.setAttribute("tabindex", "0");

    /* initial paint */
    goTo(0);
  }

  /* ===============================================================
     boot: mount all instances; never throw.
     =============================================================== */
  function boot() {
    try {
      var mounts = document.querySelectorAll('[data-viz="' + VIZ_ID + '"]');
      if (!mounts || !mounts.length) return;
      Array.prototype.forEach.call(mounts, function (mnt) { render(mnt); });
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
