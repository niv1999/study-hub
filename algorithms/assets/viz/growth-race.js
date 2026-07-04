/* =====================================================================
   growth-race.js  —  Module 01-intro "מרוץ פונקציות הגדילה"
   Grounded in _notes/01-intro.md — "Complexity Question" (introduction.pdf
   עמ' 1-3) + the two "tractable" definitions (עמ' 4).

   THE EXACT LECTURE EXAMPLE reproduced here (verbatim from the notes):
     • The machine performs 1,000,000 (10^6) operations per second.
     • Complexity-Question table, row 1 — "N=60, how much time?":
          n            → 60 / 10^6            = 0.00006 sec.
          n^5          → 60^5 operations      ≈ 13 min.
          2^n = 2^60   ≈ 1.15×10^18 ops       ≈ 366 cent. (מאות שנים)
          3^n = 3^60                          ≈ 1.3×10^13 cent.
     • Central insight (row 3): a 10× faster computer moves the reachable n
       for 2^n only from 34 → 37 — hardware does NOT "rescue" an exponential
       algorithm. Polynomial = tractable (O(n^k)); exponential = intractable.

   The interactive race plots the heroViz function set from the brief
   (01-intro.json): n , n log n , n² , n³ , 2ⁿ  on a shared LOG axis of
   "operations", with an n slider + guided step tour. The bookkeeping panel
   (operations count + wall-clock time on the 10^6 ops/sec machine + the
   tractable/intractable verdict) IS the pedagogy — it mirrors the table the
   lecturer built row-by-row in class.

   Self-contained IIFE. Hand-authored SVG/DOM. No external deps (bespoke,
   not Chart.js). Cream design tokens hardcoded (CONTRACT §2). RTL Hebrew
   captions; English/LTR identifiers isolated. Works over file:// and http.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "growth-race";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design palette (hardcoded per CONTRACT §2) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",   /* dusty-blue (unit-1 accent) */
    clay: "#BE7C5E",
    sage: "#7C9885",
    mustard: "#C9A24B",
    plum: "#9B7E9E",
    danger: "#B0455B"  /* darkened rose — the exponential "explosion" */
  };

  /* --- model constants (verbatim from the notes) --- */
  var OPS_PER_SEC = 1e6;              /* 1,000,000 operations per second */
  var NMIN = 1, NMAX = 64;           /* 2^64 ≈ 1.8×10^19 stays on-scale */
  var YMAX_LOG = 20;                 /* top of the log axis = 10^20 ops */

  /* seconds thresholds for the "time walls" */
  var SEC_HOUR = 3600;
  var SEC_YEAR = 3.1536e7;           /* 365 days — matches the notes' 2^60 ≈ 366 cent. */
  var SEC_CENTURY = 100 * SEC_YEAR;

  /* --- the five racing functions (brief heroViz set) --- */
  var FUNCS = [
    { key: "n",     label: "n",       color: C.sage,    kind: "poly", f: function (n) { return n; } },
    { key: "nlogn", label: "n log n", color: C.blue,    kind: "poly", f: function (n) { return n * Math.log2(n); } },
    { key: "n2",    label: "n²",      color: C.mustard, kind: "poly", f: function (n) { return n * n; } },
    { key: "n3",    label: "n³",      color: C.plum,    kind: "poly", f: function (n) { return n * n * n; } },
    { key: "exp",   label: "2ⁿ",      color: C.danger,  kind: "exp",  f: function (n) { return Math.pow(2, n); } }
  ];

  /* --- guided tour stops (each sets n + a Hebrew explanation) --- */
  function step(o) { return o; }
  var STEPS = [
    step({
      n: 5, color: C.sage,
      title: "n = 5 · הכול עדיין קרוב",
      body: "בקלט זעיר הפונקציות כמעט נבדלות: <span dir=\"ltr\">2ⁿ = 32</span> ואפילו " +
        "<span dir=\"ltr\">n³ = 125</span> <b>גדול</b> מ-<span dir=\"ltr\">2ⁿ</span>. " +
        "ההבדל האסימפטוטי בין פולינום לאקספוננט עדיין לא מורגש — כל אחת מסתיימת בהבזק."
    }),
    step({
      n: 10, color: C.blue,
      title: "n = 10 · האקספוננט עוקף",
      body: "<span dir=\"ltr\">2¹⁰ = 1024</span> חוצה את <span dir=\"ltr\">n³ = 1000</span> — " +
        "מכאן ואילך <span dir=\"ltr\">2ⁿ</span> משתלט לתמיד. הזמן עדיין זניח " +
        "(אלפית שנייה על מחשב של 10⁶ פעולות/שנייה)."
    }),
    step({
      n: 20, color: C.mustard,
      title: "n = 20 · חציית „קו השנייה”",
      body: "<span dir=\"ltr\">2²⁰ ≈ 1.05×10⁶</span> פעולות — כאן <span dir=\"ltr\">2ⁿ</span> " +
        "פוגש את הקו „<b>שנייה אחת</b>” (מיליון פעולות ÷ 10⁶ פעולות/שנייה). " +
        "לעומתו <span dir=\"ltr\">n³ = 8000</span> עדיין מיקרו-שניות."
    }),
    step({
      n: 30, color: C.clay,
      title: "n = 30 · התהום נפתחת",
      body: "<span dir=\"ltr\">2³⁰ ≈ 10⁹</span> פעולות ≈ <b>18 דקות</b>, בעוד " +
        "<span dir=\"ltr\">n³ = 27,000</span> = הבזק. הפער בין הפולינום לאקספוננט כבר " +
        "משתרע על סדרי-גודל שלמים בציר הלוגריתמי."
    }),
    step({
      n: 45, color: C.danger,
      title: "n = 45 · הפולינום נעלם מתחת",
      body: "<span dir=\"ltr\">2⁴⁵ ≈ 3.5×10¹³</span> פעולות ≈ <b>שנה</b> של חישוב. " +
        "אף פונקציה פולינומית כאן לא מתקרבת לקו הזמן הזה — כולן דבוקות לתחתית הגרף."
    }),
    step({
      n: 60, color: C.danger,
      title: "n = 60 · דוגמת השיעור — התהום",
      body: "בדיוק הטבלה מהכיתה: על מחשב 10⁶ פעולות/שנייה, קלט <span dir=\"ltr\">n = 60</span> — " +
        "הלינארי גומר ב-<span dir=\"ltr\">0.00006 שנ'</span>, אבל " +
        "<span dir=\"ltr\">2⁶⁰ ≈ 1.15×10¹⁸</span> פעולות ≈ <b>366 מאות שנים</b>. " +
        "זו התהום בין <b>tractable</b> (פולינומי, <span dir=\"ltr\">O(nᵏ)</span>) ל-<b>intractable</b> (אקספוננציאלי)."
    })
  ];

  /* --------------------------------------------------------------- utils */
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
  function log10safe(v) { return Math.log10(Math.max(1, v)); }

  var SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵",
              "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
  function supNum(k) {
    return String(k).split("").map(function (c) { return SUP[c] || c; }).join("");
  }
  /* operations count → compact string (uses unicode superscripts) */
  function opsStr(v) {
    if (v < 1e4) return Math.round(v).toLocaleString("en-US");
    var e = Math.floor(Math.log10(v));
    var m = v / Math.pow(10, e);
    return m.toFixed(2) + "×10" + supNum(e);
  }
  /* seconds → Hebrew wall-clock label (matches the notes' sec/min/cent. scale) */
  function timeStr(sec) {
    if (sec < 1e-6) return "פחות ממיליונית שנ'";
    if (sec < 1)    return sec.toPrecision(1) + " שנ'";
    if (sec < 60)   return sec.toFixed(1) + " שנ'";
    if (sec < SEC_HOUR)   return (sec / 60).toFixed(1) + " דק'";
    if (sec < 86400)      return (sec / SEC_HOUR).toFixed(1) + " שע'";
    if (sec < SEC_YEAR)   return (sec / 86400).toFixed(1) + " ימים";
    if (sec < SEC_CENTURY) return (sec / SEC_YEAR).toFixed(1) + " שנים";
    var cent = sec / SEC_CENTURY;
    if (cent < 1e4) return Math.round(cent).toLocaleString("en-US") + " מאות שנים";
    var e = Math.floor(Math.log10(cent));
    return (cent / Math.pow(10, e)).toFixed(1) + "×10" + supNum(e) + " מאות שנים";
  }

  /* =====================================================================
     Chart builder — bespoke SVG, log axis of "operations" vs. input size n.
     ===================================================================== */
  var W = 760, H = 400;
  var PAD_L = 60, PAD_R = 120, PAD_T = 28, PAD_B = 50;
  var PX = PAD_L, PY = PAD_T;
  var PW = W - PAD_L - PAD_R;        /* 580 */
  var PH = H - PAD_T - PAD_B;        /* 322 */

  function xScale(n) { return PX + (n - NMIN) / (NMAX - NMIN) * PW; }
  function yScale(logv) { return PY + PH - (logv / YMAX_LOG) * PH; }
  function yClamp(y) { return Math.max(PY, Math.min(PY + PH, y)); }

  function buildChart() {
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H, width: "100%",
      role: "img", direction: "ltr",
      "aria-label": "מרוץ פונקציות גדילה: n, n log n, n בריבוע, n בשלישית ו-2 בחזקת n על ציר לוגריתמי של מספר פעולות"
    });
    svg.style.display = "block";
    svg.style.maxWidth = W + "px";
    svg.style.margin = "0 auto";

    /* plot frame */
    svg.appendChild(el("rect", {
      x: PX, y: PY, width: PW, height: PH, rx: 8,
      fill: C.surface, stroke: C.line, "stroke-width": 1.5
    }));

    /* faint power-of-ten gridlines + left labels */
    for (var L = 0; L <= YMAX_LOG; L += 2) {
      var gy = yScale(L);
      svg.appendChild(el("line", {
        x1: PX, y1: gy, x2: PX + PW, y2: gy,
        stroke: C.line, "stroke-width": 1, opacity: 0.55
      }));
      svg.appendChild(txt(PX - 8, gy + 3.5, "10" + supNum(L), {
        "text-anchor": "end", "font-size": 9.5, fill: C.inkSoft
      }));
    }

    /* time "walls" (dashed clay) — ops = seconds × 10^6 */
    var walls = [
      { sec: 1,          he: "שנייה" },
      { sec: SEC_HOUR,   he: "שעה" },
      { sec: SEC_YEAR,   he: "שנה" },
      { sec: SEC_CENTURY, he: "מאה שנים" }
    ];
    walls.forEach(function (wd) {
      var wy = yScale(log10safe(wd.sec * OPS_PER_SEC));
      svg.appendChild(el("line", {
        x1: PX, y1: wy, x2: PX + PW, y2: wy,
        stroke: C.clay, "stroke-width": 1.4, "stroke-dasharray": "6 5", opacity: 0.85
      }));
      svg.appendChild(txt(PX + PW + 6, wy + 3.5, wd.he, {
        "text-anchor": "start", "font-size": 10, "font-weight": 700,
        fill: C.clay, direction: "rtl"
      }));
    });

    /* x ticks + labels */
    [1, 10, 20, 30, 40, 50, 60].forEach(function (nv) {
      var tx = xScale(nv);
      svg.appendChild(el("line", {
        x1: tx, y1: PY + PH, x2: tx, y2: PY + PH + 5, stroke: C.inkSoft, "stroke-width": 1
      }));
      svg.appendChild(txt(tx, PY + PH + 18, String(nv), {
        "text-anchor": "middle", "font-size": 10, fill: C.inkSoft
      }));
    });

    /* axis titles */
    svg.appendChild(txt(PX + PW / 2, H - 6, "n  —  גודל הקלט (input size)", {
      "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: C.ink, direction: "rtl"
    }));
    var yTitle = txt(16, PY + PH / 2, "מספר פעולות · סקאלה לוגריתמית", {
      "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: C.ink, direction: "rtl"
    });
    yTitle.setAttribute("transform", "rotate(-90 16 " + (PY + PH / 2) + ")");
    svg.appendChild(yTitle);

    /* the curves (static polylines, sampled at integer n) */
    FUNCS.forEach(function (fn) {
      var pts = [];
      for (var n = NMIN; n <= NMAX; n++) {
        var y = yClamp(yScale(log10safe(fn.f(n))));
        pts.push(xScale(n).toFixed(1) + "," + y.toFixed(1));
      }
      svg.appendChild(el("polyline", {
        points: pts.join(" "),
        fill: "none", stroke: fn.color,
        "stroke-width": fn.kind === "exp" ? 3 : 2.2,
        "stroke-linejoin": "round", "stroke-linecap": "round",
        opacity: fn.kind === "exp" ? 1 : 0.92
      }));
      /* end-of-curve label at n = NMAX */
      var ey = yClamp(yScale(log10safe(fn.f(NMAX))));
      svg.appendChild(txt(xScale(NMAX) + 7, ey + 3.5, fn.label, {
        "text-anchor": "start", "font-size": 12, "font-weight": 800,
        fill: fn.color, direction: "ltr"
      }));
    });

    /* movable marker (vertical line + dots + n badge) */
    var g = {};
    g.marker = el("line", {
      x1: xScale(NMIN), y1: PY, x2: xScale(NMIN), y2: PY + PH,
      stroke: C.ink, "stroke-width": 1.6, "stroke-dasharray": "3 3", opacity: 0.7
    });
    svg.appendChild(g.marker);

    /* n badge chip riding the top of the marker */
    g.badge = el("g");
    g.badgeRect = el("rect", { x: 0, y: PY - 20, width: 46, height: 17, rx: 8.5, fill: C.ink });
    g.badgeTx = txt(0, PY - 8, "", { "text-anchor": "middle", "font-size": 10.5, "font-weight": 800, fill: "#fff" });
    g.badge.appendChild(g.badgeRect);
    g.badge.appendChild(g.badgeTx);
    svg.appendChild(g.badge);

    g.dots = {};
    FUNCS.forEach(function (fn) {
      var c = el("circle", {
        cx: xScale(NMIN), cy: yScale(0), r: fn.kind === "exp" ? 5.5 : 4.5,
        fill: fn.color, stroke: C.surface, "stroke-width": 1.6
      });
      svg.appendChild(c);
      g.dots[fn.key] = c;
    });

    return { svg: svg, g: g };
  }

  /* =====================================================================
     render one mount
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-gr-ready") === "1") return;
    mount.setAttribute("data-gr-ready", "1");
    mount.innerHTML = "";

    var st = { n: STEPS[0].n, stepIdx: 0 };  /* stepIdx = -1 → free (slider) */
    var autoTimer = null;

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");

    /* --- machine note (grounded) --- */
    var note = document.createElement("div");
    note.style.cssText = "font-size:.82rem;color:" + C.inkSoft + ";margin:0 0 .5rem;line-height:1.5";
    note.innerHTML = 'מודל השיעור: המחשב מבצע <b dir="ltr">1,000,000</b> פעולות בשנייה. ' +
      'זמן ריצה = <span dir="ltr">f(n) ÷ 10⁶</span> שניות. הקווים המרוסקים הם „קירות הזמן”.';
    wrap.appendChild(note);

    /* --- chart --- */
    var chart = buildChart();
    var chartBox = document.createElement("div");
    chartBox.style.cssText = "background:" + C.surface2 + ";border-radius:12px;padding:6px 4px";
    chartBox.appendChild(chart.svg);
    wrap.appendChild(chartBox);

    /* --- explanation panel --- */
    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.cssText = "background:" + C.surface2 + ";border:1px solid " + C.line +
      ";border-radius:12px;padding:11px 14px;margin-top:10px;color:" + C.ink +
      ";line-height:1.65;font-size:.9rem;min-height:78px";
    wrap.appendChild(panel);

    /* --- bookkeeping table (the live state) --- */
    var tableBox = document.createElement("div");
    tableBox.style.cssText = "margin-top:12px;overflow-x:auto";
    var table = document.createElement("table");
    table.style.cssText = "width:100%;border-collapse:collapse;font-size:.86rem;min-width:440px";
    table.innerHTML =
      '<thead><tr>' +
        thCell("פונקציה") +
        thCell('פעולות <span dir="ltr">f(n)</span>') +
        thCell("זמן על מחשב 10⁶/שנ'") +
        thCell("מסקנה") +
      '</tr></thead>';
    var tbody = document.createElement("tbody");
    var rowRefs = {};
    FUNCS.forEach(function (fn) {
      var tr = document.createElement("tr");
      tr.style.borderTop = "1px solid " + C.line;
      var cName = document.createElement("td");
      cName.style.cssText = "padding:6px 8px;text-align:right";
      cName.innerHTML =
        '<span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:' +
        fn.color + ';vertical-align:middle;margin-inline-start:6px"></span>' +
        '<span dir="ltr" style="font-weight:800;color:' + fn.color + '">' + fn.label + '</span>';
      var cOps = document.createElement("td");
      cOps.style.cssText = "padding:6px 8px;text-align:left;font-variant-numeric:tabular-nums";
      cOps.setAttribute("dir", "ltr");
      var cTime = document.createElement("td");
      cTime.style.cssText = "padding:6px 8px;text-align:right;font-weight:600";
      var cVerdict = document.createElement("td");
      cVerdict.style.cssText = "padding:6px 8px;text-align:right";
      cVerdict.innerHTML = fn.kind === "exp"
        ? '<span style="background:' + C.danger + ';color:#fff;font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:99px">intractable · אקספוננציאלי</span>'
        : '<span style="background:' + C.sage + ';color:#fff;font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:99px">tractable · פולינומי</span>';
      tr.appendChild(cName); tr.appendChild(cOps); tr.appendChild(cTime); tr.appendChild(cVerdict);
      tbody.appendChild(tr);
      rowRefs[fn.key] = { ops: cOps, time: cTime };
    });
    table.appendChild(tbody);
    tableBox.appendChild(table);
    wrap.appendChild(tableBox);

    function thCell(html) {
      return '<th style="padding:6px 8px;text-align:right;font-size:.78rem;font-weight:700;color:' +
        C.inkSoft + ';white-space:nowrap">' + html + '</th>';
    }

    /* --- grounded lecture strip (introduction.pdf, N=60 row) --- */
    var strip = document.createElement("div");
    strip.style.cssText = "margin-top:12px;padding:9px 12px;background:" + C.surface +
      ";border:1px solid " + C.line + ";border-radius:10px;font-size:.8rem;color:" + C.inkSoft +
      ";line-height:1.7";
    strip.innerHTML =
      '<b style="color:' + C.ink + '">מהשיעור · טבלת ה-Complexity Question (introduction.pdf, N=60):</b><br>' +
      '<span dir="ltr">n</span> → 0.00006 שנ' + "'" + ' · ' +
      '<span dir="ltr">n⁵</span> → 13 דק' + "'" + ' · ' +
      '<span dir="ltr">2⁶⁰</span> → 366 מאות שנים · ' +
      '<span dir="ltr">3⁶⁰</span> → 1.3×10¹³ מאות שנים.<br>' +
      'מחשב מהיר פי 10 מזיז את ה-<span dir="ltr">n</span> שהאקספוננט מגיע אליו רק במעט ' +
      '(<span dir="ltr">2ⁿ</span> מ-34 ל-37 בלבד) — חומרה לא „מצילה” אלגוריתם אקספוננציאלי.';
    wrap.appendChild(strip);

    /* --- step chips rail --- */
    var rail = document.createElement("div");
    rail.setAttribute("role", "tablist");
    rail.setAttribute("aria-label", "תחנות במרוץ הגדילה");
    rail.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 4px";
    var chips = STEPS.map(function (s, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn";
      b.setAttribute("role", "tab");
      b.textContent = "n=" + s.n;
      b.title = s.title;
      b.setAttribute("aria-label", s.title);
      b.style.cssText = "padding:.2rem .6rem;font-size:.8rem";
      b.addEventListener("click", function () { stopAuto(); gotoStep(i); });
      rail.appendChild(b);
      return b;
    });
    wrap.appendChild(rail);

    /* --- n slider (free exploration) --- */
    var sliderRow = document.createElement("div");
    sliderRow.className = "viz-controls";
    sliderRow.style.marginTop = "8px";
    var slLabel = document.createElement("label");
    slLabel.style.cssText = "display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;font-size:.86rem;font-weight:600;color:" + C.ink;
    var slText = document.createElement("span");
    slText.innerHTML = '<span dir="ltr">n</span> = ';
    var slVal = document.createElement("span");
    slVal.style.cssText = "font-family:monospace;font-weight:700;color:" + C.blue + ";min-width:2ch;display:inline-block";
    var slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(NMIN); slider.max = String(NMAX); slider.step = "1";
    slider.value = String(st.n);
    slider.setAttribute("aria-label", "גודל הקלט n");
    slider.style.cssText = "accent-color:" + C.blue + ";flex:1;min-width:160px;max-width:340px";
    slLabel.appendChild(slText);
    slLabel.appendChild(slVal);
    slLabel.appendChild(slider);
    sliderRow.appendChild(slLabel);
    wrap.appendChild(sliderRow);

    /* --- step controls --- */
    var controls = document.createElement("div");
    controls.className = "viz-controls";
    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); gotoStep(st.stepIdx <= 0 ? 0 : st.stepIdx - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); gotoStep(st.stepIdx < 0 ? 0 : st.stepIdx + 1); }, true);
    var btnPlay = mkBtn("▶ הפעל", function () { toggleAuto(); });
    var btnReset = mkBtn("↺ איפוס", function () { stopAuto(); gotoStep(0); });
    controls.appendChild(btnPrev);
    controls.appendChild(btnNext);
    controls.appendChild(btnPlay);
    controls.appendChild(btnReset);
    wrap.appendChild(controls);

    mount.appendChild(wrap);

    function mkBtn(label, fn, primary) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn" + (primary ? " primary" : "");
      b.innerHTML = label;
      b.addEventListener("click", fn);
      return b;
    }

    /* ---------------------------------------------------------------
       core: redraw everything from st.n
       --------------------------------------------------------------- */
    function redraw() {
      var n = st.n;
      var mx = xScale(n);
      chart.g.marker.setAttribute("x1", mx);
      chart.g.marker.setAttribute("x2", mx);

      /* n badge (kept inside plot horizontally) */
      var bw = 46;
      var bx = Math.max(PX, Math.min(PX + PW - bw, mx - bw / 2));
      chart.g.badgeRect.setAttribute("x", bx);
      chart.g.badgeTx.setAttribute("x", bx + bw / 2);
      chart.g.badgeTx.textContent = "n = " + n;

      FUNCS.forEach(function (fn) {
        var v = fn.f(n);
        var cy = yClamp(yScale(log10safe(v)));
        var dot = chart.g.dots[fn.key];
        dot.setAttribute("cx", mx);
        dot.setAttribute("cy", cy);

        var sec = v / OPS_PER_SEC;
        rowRefs[fn.key].ops.textContent = opsStr(v);
        var timeCell = rowRefs[fn.key].time;
        timeCell.textContent = timeStr(sec);
        /* redden the time cell once an exponential blows past a year */
        timeCell.style.color = (fn.kind === "exp" && sec >= SEC_YEAR) ? C.danger : C.ink;
      });

      slider.value = String(n);
      slVal.textContent = String(n);
    }

    function renderPanel(color, title, body) {
      panel.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">' +
          '<span style="background:' + color + ';color:#fff;font-weight:800;font-size:.72rem;' +
            'padding:2px 10px;border-radius:99px" dir="ltr">n = ' + st.n + '</span>' +
          '<b style="font-size:.98rem;color:' + C.ink + '">' + title + '</b>' +
        '</div><div>' + body + '</div>';
    }

    function renderChips() {
      chips.forEach(function (b, i) {
        var active = (i === st.stepIdx), done = (st.stepIdx >= 0 && i < st.stepIdx);
        var col = STEPS[i].color;
        b.setAttribute("aria-selected", active ? "true" : "false");
        if (active) { b.style.background = col; b.style.color = "#fff"; b.style.borderColor = col; }
        else if (done) { b.style.background = C.surface2; b.style.color = C.ink; b.style.borderColor = col; }
        else { b.style.background = C.surface2; b.style.color = C.inkSoft; b.style.borderColor = C.line; }
      });
    }

    function pulseExp() {
      if (reducedMotion()) return;
      var d = chart.g.dots.exp;
      if (!d.animate) return;
      d.animate([{ r: 5.5 }, { r: 9 }, { r: 5.5 }], { duration: 380, easing: "ease-out" });
    }

    /* ---------------------------------------------------------------
       navigation
       --------------------------------------------------------------- */
    function gotoStep(i) {
      i = Math.max(0, Math.min(STEPS.length - 1, i));
      var s = STEPS[i];
      st.stepIdx = i;
      st.n = s.n;
      redraw();
      renderPanel(s.color, s.title, s.body);
      renderChips();
      pulseExp();
      btnPrev.disabled = (i === 0);
      btnNext.disabled = (i === STEPS.length - 1);
    }

    function setFree(n) {
      st.stepIdx = -1;
      st.n = Math.max(NMIN, Math.min(NMAX, n));
      redraw();
      var sec = FUNCS[4].f(st.n) / OPS_PER_SEC;
      renderPanel(C.blue, "מצב חופשי · גרירת המחוון",
        'הזז את המחוון כדי לראות מי „מנצח”. ב-<span dir="ltr">n = ' + st.n + '</span> ' +
        'הזמן של <span dir="ltr">2ⁿ</span> הוא <b dir="ltr">' + timeStr(sec) + '</b>, ' +
        'בעוד כל הפולינומים נשארים דבוקים לתחתית.');
      renderChips();
      btnPrev.disabled = false;
      btnNext.disabled = false;
    }

    slider.addEventListener("input", function () {
      stopAuto();
      setFree(parseInt(slider.value, 10) || NMIN);
    });

    /* ---------------------------------------------------------------
       autoplay through the tour
       --------------------------------------------------------------- */
    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      if (st.stepIdx < 0 || st.stepIdx >= STEPS.length - 1) gotoStep(0);
      btnPlay.innerHTML = "⏸ השהה";
      btnPlay.classList.add("primary");
      autoTimer = setInterval(function () {
        if (st.stepIdx >= STEPS.length - 1) { stopAuto(); return; }
        gotoStep(st.stepIdx + 1);
      }, reducedMotion() ? 2000 : 2600);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      btnPlay.innerHTML = "▶ הפעל";
      btnPlay.classList.remove("primary");
    }

    /* keyboard: RTL-aware (Right = prev step, Left = next step) */
    wrap.addEventListener("keydown", function (e) {
      if (e.target === slider) return;   /* let the slider handle its own keys */
      if (e.key === "ArrowRight") { stopAuto(); gotoStep(st.stepIdx <= 0 ? 0 : st.stepIdx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { stopAuto(); gotoStep(st.stepIdx < 0 ? 0 : st.stepIdx + 1); e.preventDefault(); }
      else if (e.key === "Home") { stopAuto(); gotoStep(0); e.preventDefault(); }
      else if (e.key === "End") { stopAuto(); gotoStep(STEPS.length - 1); e.preventDefault(); }
    });

    /* initial paint */
    gotoStep(0);
  }

  /* =====================================================================
     boot: mount all instances (guard already-ready). Never throw.
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
