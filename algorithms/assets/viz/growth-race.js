/* =====================================================================
   growth-race.js  —  Module 01-intro "מרוץ פונקציות גדילה"
   Grounded in _notes/01-intro.md → introduction.pdf עמ' 1-3
   ("Complexity Question" table) + עמ' 4 (Definition: tractable).

   THE EXACT LECTURE EXAMPLE (reproduced faithfully):
     Model: a computer performing 1,000,000 (10^6) operations per second.
     Functions compared (the four in the lecturer's table, VERBATIM):
        n , n^5 , 2^n , 3^n
     plus two functions the same slides discuss (עמ' 4 clouds/definition):
        n log n , n^2   — polynomial companions (tractable), for the race.

     Question 1 (slide row 1) — for N=60, how much time is needed?
        n   → 60/10^6           = 0.00006 sec.
        n^5 → 60^5 ops          ≈ 13 min.
        2^n → 2^60 ops          ≈ 366 centuries.
        3^n → 3^60 ops          ≈ 1.3×10^13 centuries.
     Question 2 (slide row 2) — with 5 CPU hours, which N is reachable?
        n → 18×10^9 , n^5 → 112 , 2^n → 34 , 3^n → 21.
     Question 3 (slide row 3) — a 10× faster computer, 5 CPU hours?
        n → 18×10^10 , n^5 → 178 , 2^n → 37 , 3^n → 23.
     Insight: 10× hardware moves the linear input ×10, but the exponentials
     barely budge (34→37, 21→23) — faster hardware never "rescues" an
     exponential algorithm.  This is exactly the tractable/intractable abyss.

     Definition (עמ' 4): an algorithm is *tractable* if its complexity is
     O(n^k), k a constant (polynomial = "efficient"); an exponential-time
     algorithm is intractable.

   The wall-clock times shown for every function/n are a direct arithmetic
   application of the lecturer's own 10^6 ops/sec model (not invented facts);
   the four lecture functions reproduce the table values above exactly.

   Self-contained IIFE, hand-authored SVG (no Chart.js dep → works file://
   and offline). Cream design tokens hardcoded (CONTRACT §2). RTL Hebrew UI,
   LTR/English identifiers. Keyboard accessible, prefers-reduced-motion aware,
   zero console errors, graceful if the mount is absent.
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
    blue: "#6E8CA0",   /* dusty-blue (unit-1) */
    sage: "#7C9885",
    teal: "#3F8E9B",
    mustard: "#C9A24B",
    clay: "#BE7C5E",
    red: "#B4534A"
  };

  /* physical model — EXACTLY the lecturer's numbers */
  var OPS_PER_SEC = 1e6;            /* 1,000,000 op per second */
  var SEC_PER_YEAR = 3.1536e7;     /* 365 days → reproduces "366 cent." etc. */

  /* the racing functions. tract=true ⇢ polynomial (tractable / "efficient"). */
  var FUNZ = [
    { key: "n",     label: "n",       color: C.sage,    tract: true,  f: function (n) { return n; } },
    { key: "nlogn", label: "n log n", color: C.blue,    tract: true,  f: function (n) { return n * Math.log2(n < 1 ? 1 : n); } },
    { key: "n2",    label: "n²",      color: C.teal,    tract: true,  f: function (n) { return n * n; } },
    { key: "n5",    label: "n⁵",      color: C.mustard, tract: true,  f: function (n) { return Math.pow(n, 5); } },
    { key: "2n",    label: "2ⁿ",      color: C.clay,    tract: false, f: function (n) { return Math.pow(2, n); } },
    { key: "3n",    label: "3ⁿ",      color: C.red,     tract: false, f: function (n) { return Math.pow(3, n); } }
  ];
  function fun(key) { for (var i = 0; i < FUNZ.length; i++) if (FUNZ[i].key === key) return FUNZ[i]; return null; }

  /* the reverse-question tables (VERBATIM from the notes, four lecture fns) */
  var REVERSE = {
    q2: { title: "5 שעות CPU · אותו מחשב", vals: { n: "18×10⁹", n5: "112", "2n": "34", "3n": "21" } },
    q3: { title: "5 שעות CPU · מחשב מהיר פי 10", vals: { n: "18×10¹⁰", n5: "178", "2n": "37", "3n": "23" } }
  };

  /* --------------------------- helpers --------------------------- */
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
    t.setAttribute("x", x); t.setAttribute("y", y); t.textContent = s;
    return t;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function log10(v) { return Math.log(v) / Math.LN10; }

  /* m×10^e superscript HTML */
  function sciHTML(x, dp) {
    if (x === 0) return "0";
    var e = Math.floor(log10(Math.abs(x)));
    var m = x / Math.pow(10, e);
    return (dp == null ? m.toFixed(1) : m.toFixed(dp)) + "×10<sup>" + e + "</sup>";
  }
  /* format an operation count for the table */
  function formatOps(v) {
    if (!isFinite(v)) return "∞";
    if (v < 1e5) return Math.round(v).toLocaleString("en-US");
    return sciHTML(v, 1);
  }
  /* trim a small decimal like 0.00006 without exponent noise */
  function trimNum(x) {
    var s = parseFloat(x.toPrecision(3));
    return String(s);
  }
  /* wall-clock time to run f(n) operations at 10^6 ops/sec → Hebrew HTML */
  function formatTime(ops) {
    if (!isFinite(ops)) return "∞";
    var sec = ops / OPS_PER_SEC;
    if (sec < 1) return trimNum(sec) + " שנ׳";
    if (sec < 90) return Math.round(sec) + " שנ׳";
    var min = sec / 60;
    if (min < 90) return Math.round(min) + " דק׳";
    var hr = min / 60;
    if (hr < 48) return Math.round(hr) + " שע׳";
    var day = hr / 24;
    if (day < 365) return Math.round(day) + " ימים";
    var yr = sec / SEC_PER_YEAR;
    if (yr < 100) return Math.round(yr) + " שנים";
    var cent = yr / 100;
    if (cent < 1e4) return Math.round(cent).toLocaleString("en-US") + " מאות שנים";
    return sciHTML(cent, 1) + " מאות שנים";
  }

  /* =====================================================================
     Narrated steps — walk the lecturer's three complexity questions,
     then the tractable definition. Each step sets the slider n, the Y
     scale, and (optionally) shows a reverse-question table in its body.
     ===================================================================== */
  var STEPS = [
    {
      badge: "n = 8", color: C.sage, n: 8, scale: "log",
      title: "המרוץ מתחיל — n קטן",
      body: "במחשב שמבצע <b dir=\"ltr\">10⁶</b> פעולות בשנייה משווים שש פונקציות גדילה. " +
        "בגדלים קטנים כולן קרובות זו לזו — ההבדל בקצב הגדילה עדיין <b>לא מורגש</b>. " +
        "הזז את המחוון <span dir=\"ltr\">n</span> קדימה והבחן איך <span dir=\"ltr\">2ⁿ</span> " +
        "ו-<span dir=\"ltr\">3ⁿ</span> מתחילות להאיץ. שים לב: ציר <span dir=\"ltr\">Y</span> לוגריתמי — " +
        "כל משבצת = פי 1000 פעולות."
    },
    {
      badge: "n = 23", color: C.mustard, n: 23, scale: "log",
      title: "נקודת החיתוך — האקספוננט עוקף",
      body: "סביב <span dir=\"ltr\">n≈23</span> מתרחשת נקודת מפנה: <span dir=\"ltr\">2ⁿ</span> " +
        "<b>עוקפת את הפולינום</b> <span dir=\"ltr\">n⁵</span> " +
        "(<span dir=\"ltr\">2²³ ≈ 8.4×10⁶</span> מול <span dir=\"ltr\">23⁵ ≈ 6.4×10⁶</span>). " +
        "מכאן והלאה, ככל ש-<span dir=\"ltr\">n</span> גדל הפער רק מתעצם — אקספוננט תמיד מנצח פולינום " +
        "בסופו של דבר, לא משנה כמה גדול המעריך <span dir=\"ltr\">k</span> ב-<span dir=\"ltr\">n^k</span>."
    },
    {
      badge: "שאלה 1 · N = 60", color: C.clay, n: 60, scale: "log",
      title: "כמה זמן ריצה עבור N = 60?",
      body: "השאלה מהשקופית: „כמה זמן דרוש לחישוב עבור קלט בגודל <span dir=\"ltr\">N=60</span>?” " +
        "התשובות (ראה טבלת הבוקקיפינג למטה): <span dir=\"ltr\">n</span> ≈ " +
        "<b dir=\"ltr\">0.00006 שנ׳</b>, <span dir=\"ltr\">n⁵</span> ≈ <b>13 דק׳</b>, אבל " +
        "<span dir=\"ltr\">2⁶⁰</span> ≈ <b>366 מאות שנים</b> ו-<span dir=\"ltr\">3⁶⁰</span> ≈ " +
        "<b dir=\"ltr\">1.3×10¹³ מאות שנים</b>. זו <b>התהום</b> בין פולינומי לאקספוננציאלי — " +
        "אותו קלט קטן, הבדל של מיליארדי מיליארדים בזמן."
    },
    {
      badge: "שאלה 2 · 5 שעות CPU", color: C.blue, n: 60, scale: "log",
      title: "מהכיוון ההפוך — לאיזה N מגיעים ב-5 שעות?",
      reverse: "q2",
      body: "נהפוך את השאלה: בהינתן <b>תקציב זמן</b> של 5 שעות CPU (על אותו מחשב), עד לאיזה גודל קלט " +
        "<span dir=\"ltr\">N</span> ניתן להגיע? הליניארי מגיע ל-<span dir=\"ltr\">~18×10⁹</span>, " +
        "אבל <span dir=\"ltr\">2ⁿ</span> נעצר כבר ב-<span dir=\"ltr\">N=34</span> ו-" +
        "<span dir=\"ltr\">3ⁿ</span> ב-<span dir=\"ltr\">N=21</span> בלבד. אלגוריתם אקספוננציאלי " +
        "„חונק” את גודל הקלט האפשרי."
    },
    {
      badge: "שאלה 3 · חומרה פי 10", color: C.red, n: 60, scale: "log",
      title: "מחשב מהיר פי 10 — האם זה מציל?",
      reverse: "q3",
      body: "התובנה המרכזית של השיעור: מחשב <b>מהיר פי 10</b> מגדיל את הקלט הליניארי פי 10 " +
        "(<span dir=\"ltr\">18×10⁹ → 18×10¹⁰</span>), אבל האקספוננציאליים כמעט לא זזים: " +
        "<span dir=\"ltr\">2ⁿ</span> מ-<span dir=\"ltr\">34</span> ל-<span dir=\"ltr\">37</span>, " +
        "<span dir=\"ltr\">3ⁿ</span> מ-<span dir=\"ltr\">21</span> ל-<span dir=\"ltr\">23</span>. " +
        "<b>חומרה מהירה יותר לא „מצילה” אלגוריתם אקספוננציאלי</b> — צריך אלגוריתם טוב יותר."
    },
    {
      badge: "הגדרה · tractable", color: C.teal, n: 60, scale: "log",
      title: "פולינומי = tractable = „יעיל”",
      body: "<b>Definition:</b> אלגוריתם נקרא <b dir=\"ltr\"><i>tractable</i></b> אם סיבוכיותו " +
        "<span dir=\"ltr\">O(n^k)</span> עבור <span dir=\"ltr\">k</span> קבוע. הפונקציות הירוקות/כחולות " +
        "כאן (<span dir=\"ltr\">n, n log n, n², n⁵</span>) הן <b>פולינומיות → tractable</b> — גם " +
        "<span dir=\"ltr\">n⁵</span> (ה-13 דקות) נחשב „יעיל” תיאורטית. " +
        "<span dir=\"ltr\">2ⁿ, 3ⁿ</span> אינן חסומות ע\"י אף פולינום → <b>intractable</b>. " +
        "והערת השוליים מהשקופית: גם <span dir=\"ltr\">O(n log n)</span> חסום ע\"י פולינום " +
        "(למשל <span dir=\"ltr\">O(n²)</span>) ולכן <b>tractable</b>."
    }
  ];

  /* =====================================================================
     render one mount
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-gr-ready") === "1") return;
    mount.setAttribute("data-gr-ready", "1");
    mount.innerHTML = "";

    /* ---- state ---- */
    var st = {
      n: 8,
      scale: "log",              /* "log" | "linear" */
      visible: { n: true, nlogn: true, n2: true, n5: true, "2n": true, "3n": true },
      step: 0
    };

    /* ---- geometry ---- */
    var W = 720, H = 384;
    var padL = 58, padR = 92, padT = 20, padB = 46;
    var X0 = padL, X1 = W - padR, Y0 = padT, Y1 = H - padB;
    var NMIN = 1, NMAX = 64;
    var YDEC = 31;             /* log decades on the Y axis (covers 3^64≈10^30.5) */
    var LINMAX = 5000;         /* linear-scale ceiling (dramatizes the blow-up) */

    function xOf(n) { return X0 + (n - NMIN) / (NMAX - NMIN) * (X1 - X0); }
    function yOf(v) {
      if (st.scale === "log") {
        var d = clamp(log10(v < 1 ? 1 : v), 0, YDEC);
        return Y1 - d / YDEC * (Y1 - Y0);
      }
      return Y1 - clamp(v, 0, LINMAX) / LINMAX * (Y1 - Y0);
    }
    function clipped(v) { return st.scale === "linear" && v > LINMAX; }

    /* =============================== DOM =============================== */
    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");
    wrap.style.outline = "none";

    /* ---- legend (clickable function toggles) ---- */
    var legend = document.createElement("div");
    legend.style.display = "flex";
    legend.style.flexWrap = "wrap";
    legend.style.gap = "6px";
    legend.style.marginBottom = ".7rem";
    legend.setAttribute("role", "group");
    legend.setAttribute("aria-label", "בחירת פונקציות למרוץ");
    var legendBtns = {};
    FUNZ.forEach(function (fnc) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn";
      b.style.padding = ".22rem .6rem";
      b.style.fontSize = ".84rem";
      b.style.display = "inline-flex";
      b.style.alignItems = "center";
      b.style.gap = ".4rem";
      b.setAttribute("aria-pressed", "true");
      var dot = document.createElement("span");
      dot.style.width = "11px"; dot.style.height = "11px";
      dot.style.borderRadius = "3px"; dot.style.background = fnc.color;
      dot.style.flex = "0 0 auto";
      var lab = document.createElement("span");
      lab.textContent = fnc.label; lab.setAttribute("dir", "ltr");
      lab.style.fontWeight = "700";
      b.appendChild(dot); b.appendChild(lab);
      b.addEventListener("click", function () {
        st.visible[fnc.key] = !st.visible[fnc.key];
        structural();
      });
      legend.appendChild(b);
      legendBtns[fnc.key] = { btn: b, dot: dot };
    });
    wrap.appendChild(legend);

    /* ---- SVG scene ---- */
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H, width: "100%",
      role: "img", direction: "ltr",
      "aria-label": "מרוץ פונקציות גדילה: n, n log n, n בריבוע, n בחמישית, 2 בחזקת n, 3 בחזקת n על ציר משותף"
    });
    svg.style.display = "block";
    svg.style.maxWidth = W + "px";
    svg.style.margin = "0 auto";
    svg.style.touchAction = "none";

    /* static frame */
    svg.appendChild(el("rect", {
      x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0, rx: 8,
      fill: C.surface, stroke: C.line, "stroke-width": 1.5
    }));
    /* axis titles */
    svg.appendChild(txt((X0 + X1) / 2, H - 8, "n  ·  input size (גודל הקלט)", {
      "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: C.inkSoft
    }));
    var yTitle = txt(15, (Y0 + Y1) / 2, "מספר פעולות", {
      "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: C.inkSoft, direction: "rtl"
    });
    yTitle.setAttribute("transform", "rotate(-90 15 " + ((Y0 + Y1) / 2) + ")");
    svg.appendChild(yTitle);

    var gGrid = el("g");     svg.appendChild(gGrid);
    var gCurves = el("g");   svg.appendChild(gCurves);
    var gSweep = el("g");    svg.appendChild(gSweep);

    /* persistent sweep elements */
    var sweepLine = el("line", { stroke: C.inkSoft, "stroke-width": 1.4, "stroke-dasharray": "4 4", opacity: .85 });
    gSweep.appendChild(sweepLine);
    var sweepChip = el("rect", { width: 46, height: 18, rx: 9, fill: C.ink, opacity: .9 });
    var sweepChipTx = txt(0, 0, "", { "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: "#fff" });
    gSweep.appendChild(sweepChip); gSweep.appendChild(sweepChipTx);
    var dots = {};
    FUNZ.forEach(function (fnc) {
      var c = el("circle", { r: 5.2, fill: fnc.color, stroke: C.surface, "stroke-width": 1.6, opacity: 0 });
      var arr = el("path", { fill: fnc.color, opacity: 0 }); /* clip arrow (linear mode) */
      gSweep.appendChild(c); gSweep.appendChild(arr);
      dots[fnc.key] = { dot: c, arr: arr };
    });

    var sceneBox = document.createElement("div");
    sceneBox.style.background = C.surface2;
    sceneBox.style.borderRadius = "12px";
    sceneBox.style.padding = "6px 4px";
    sceneBox.appendChild(svg);
    wrap.appendChild(sceneBox);

    /* ---- slider + scale toggle row ---- */
    var sliderRow = document.createElement("div");
    sliderRow.className = "viz-controls";
    sliderRow.style.marginTop = "12px";
    sliderRow.style.alignItems = "center";

    var slLabel = document.createElement("label");
    slLabel.style.display = "flex";
    slLabel.style.alignItems = "center";
    slLabel.style.gap = ".5rem";
    slLabel.style.fontSize = ".9rem";
    slLabel.style.fontWeight = "600";
    slLabel.style.color = C.ink;
    var slText = document.createElement("span");
    slText.innerHTML = 'מחוון <span dir="ltr">n</span>:';
    var slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(NMIN); slider.max = String(NMAX); slider.step = "1";
    slider.value = String(st.n);
    slider.setAttribute("aria-label", "גודל הקלט n");
    slider.style.width = "220px";
    slider.style.accentColor = C.clay;
    var slVal = document.createElement("span");
    slVal.style.fontFamily = "monospace";
    slVal.style.fontWeight = "700";
    slVal.style.color = C.clay;
    slVal.style.minWidth = "3.2rem";
    slLabel.appendChild(slText); slLabel.appendChild(slider); slLabel.appendChild(slVal);
    sliderRow.appendChild(slLabel);

    var btnScale = document.createElement("button");
    btnScale.type = "button";
    btnScale.className = "viz-btn";
    btnScale.addEventListener("click", function () {
      st.scale = (st.scale === "log") ? "linear" : "log";
      structural();
    });
    sliderRow.appendChild(btnScale);
    wrap.appendChild(sliderRow);

    /* ---- live note (updates as the slider moves) ---- */
    var liveNote = document.createElement("div");
    liveNote.setAttribute("aria-live", "polite");
    liveNote.style.fontSize = ".84rem";
    liveNote.style.color = C.inkSoft;
    liveNote.style.margin = "8px 2px 0";
    liveNote.style.minHeight = "1.2em";
    wrap.appendChild(liveNote);

    /* ---- bookkeeping table (the pedagogy) ---- */
    var tableWrap = document.createElement("div");
    tableWrap.style.overflowX = "auto";
    tableWrap.style.marginTop = "12px";
    var table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.fontSize = ".86rem";
    table.style.background = C.surface;
    table.style.borderRadius = "10px";
    table.style.overflow = "hidden";
    table.setAttribute("aria-label", "טבלת מספר הפעולות וזמן הריצה לכל פונקציה");
    var thead = document.createElement("thead");
    thead.innerHTML =
      '<tr style="background:' + C.surface2 + ';color:' + C.ink + '">' +
      '<th style="text-align:right;padding:7px 10px;font-weight:800">פונקציה</th>' +
      '<th style="text-align:right;padding:7px 10px;font-weight:800">סיווג</th>' +
      '<th style="text-align:left;padding:7px 10px;font-weight:800" dir="ltr">f(n) — מספר פעולות</th>' +
      '<th style="text-align:left;padding:7px 10px;font-weight:800">זמן ריצה @ 10⁶/שנ׳</th>' +
      '</tr>';
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    wrap.appendChild(tableWrap);
    var rowRefs = {};   /* key → {ops, time} */

    /* ---- explanation panel ---- */
    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.background = C.surface2;
    panel.style.border = "1px solid " + C.line;
    panel.style.borderRadius = "12px";
    panel.style.padding = "12px 14px";
    panel.style.marginTop = "12px";
    panel.style.color = C.ink;
    panel.style.lineHeight = "1.7";
    panel.style.fontSize = ".9rem";
    panel.style.minHeight = "96px";
    wrap.appendChild(panel);

    /* ---- step chips ---- */
    var rail = document.createElement("div");
    rail.setAttribute("role", "tablist");
    rail.setAttribute("aria-label", "שלבי ההסבר");
    rail.style.display = "flex";
    rail.style.flexWrap = "wrap";
    rail.style.gap = "6px";
    rail.style.margin = "12px 0 4px";
    var chips = STEPS.map(function (s, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn";
      b.setAttribute("role", "tab");
      b.textContent = (i + 1) + "";
      b.title = s.title;
      b.setAttribute("aria-label", (i + 1) + ": " + s.title);
      b.style.padding = ".2rem .6rem";
      b.style.minWidth = "2rem";
      b.addEventListener("click", function () { stopPlay(); goto(i); });
      rail.appendChild(b);
      return b;
    });
    wrap.appendChild(rail);

    /* ---- step controls ---- */
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
    var btnPrev = mkBtn("→ הקודם", function () { stopPlay(); goto(st.step - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopPlay(); goto(st.step + 1); }, true);
    var btnPlay = mkBtn("▶ הרצת המרוץ", function () { togglePlay(); });
    var btnReset = mkBtn("↺ איפוס", function () { stopPlay(); resetAll(); });
    controls.appendChild(btnPrev);
    controls.appendChild(btnNext);
    controls.appendChild(btnPlay);
    controls.appendChild(btnReset);
    wrap.appendChild(controls);

    mount.appendChild(wrap);

    /* =====================================================================
       DRAW: grid + axis labels (depends on scale)
       ===================================================================== */
    function buildGrid() {
      while (gGrid.firstChild) gGrid.removeChild(gGrid.firstChild);

      if (st.scale === "log") {
        for (var d = 0; d <= YDEC; d += 3) {
          var y = Y1 - d / YDEC * (Y1 - Y0);
          gGrid.appendChild(el("line", { x1: X0, y1: y, x2: X1, y2: y,
            stroke: C.line, "stroke-width": 1, opacity: d === 0 ? 0 : .8 }));
          gGrid.appendChild(txt(X0 - 6, y + 3.5, "10", {
            "text-anchor": "end", "font-size": 9.5, fill: C.inkSoft }));
          gGrid.appendChild(txt(X0 - 6, y - 4, String(d), {
            "text-anchor": "end", "font-size": 7.5, fill: C.inkSoft }));
        }
        /* the "one second" reference line = 10^6 operations */
        var ys = Y1 - 6 / YDEC * (Y1 - Y0);
        gGrid.appendChild(el("line", { x1: X0, y1: ys, x2: X1, y2: ys,
          stroke: C.clay, "stroke-width": 1.3, "stroke-dasharray": "6 4", opacity: .9 }));
        gGrid.appendChild(txt(X1 - 4, ys - 5, "10⁶ פעולות = שנייה אחת", {
          "text-anchor": "end", "font-size": 9.5, "font-weight": 700, fill: C.clay, direction: "rtl" }));
      } else {
        for (var v = 0; v <= LINMAX; v += 1000) {
          var yl = Y1 - v / LINMAX * (Y1 - Y0);
          gGrid.appendChild(el("line", { x1: X0, y1: yl, x2: X1, y2: yl,
            stroke: C.line, "stroke-width": 1, opacity: v === 0 ? 0 : .8 }));
          gGrid.appendChild(txt(X0 - 6, yl + 3.5, v.toLocaleString("en-US"), {
            "text-anchor": "end", "font-size": 9, fill: C.inkSoft }));
        }
      }
      /* x ticks */
      [10, 20, 30, 40, 50, 60].forEach(function (nv) {
        var x = xOf(nv);
        gGrid.appendChild(el("line", { x1: x, y1: Y1, x2: x, y2: Y1 + 4, stroke: C.inkSoft, "stroke-width": 1 }));
        gGrid.appendChild(txt(x, Y1 + 16, String(nv), { "text-anchor": "middle", "font-size": 9.5, fill: C.inkSoft }));
      });
    }

    /* =====================================================================
       DRAW: curves + end labels (depends on scale + visibility)
       ===================================================================== */
    function buildCurves() {
      while (gCurves.firstChild) gCurves.removeChild(gCurves.firstChild);
      FUNZ.forEach(function (fnc) {
        if (!st.visible[fnc.key]) return;
        var pts = [], lastOn = null, exited = false;
        for (var n = NMIN; n <= NMAX; n += 0.5) {
          var v = fnc.f(n);
          var x = xOf(n), y = yOf(v);
          if (clipped(v)) {
            if (!exited) { pts.push(x + "," + Y0); exited = true; }  /* pin to ceiling then stop */
            break;
          }
          pts.push(x + "," + y);
          lastOn = { x: x, y: y };
        }
        if (pts.length < 2) return;
        var path = el("polyline", {
          points: pts.join(" "), fill: "none", stroke: fnc.color,
          "stroke-width": fnc.tract ? 2.4 : 3, "stroke-linejoin": "round", "stroke-linecap": "round"
        });
        gCurves.appendChild(path);
        /* end-of-curve label near its last on-chart point */
        if (lastOn && !exited) {
          gCurves.appendChild(txt(clamp(lastOn.x + 6, X0, X1 + 4), clamp(lastOn.y + 4, Y0 + 10, Y1), fnc.label, {
            "font-size": 12, "font-weight": 800, fill: fnc.color, direction: "ltr" }));
        } else if (lastOn) {
          gCurves.appendChild(txt(clamp(lastOn.x + 4, X0, X1 - 24), Y0 + 12, fnc.label, {
            "font-size": 12, "font-weight": 800, fill: fnc.color, direction: "ltr" }));
        }
      });
    }

    /* =====================================================================
       DRAW: sweep line + dots (depends on n)
       ===================================================================== */
    function updateSweep() {
      var x = xOf(st.n);
      sweepLine.setAttribute("x1", x); sweepLine.setAttribute("x2", x);
      sweepLine.setAttribute("y1", Y0); sweepLine.setAttribute("y2", Y1);
      var chipX = clamp(x - 23, X0, X1 - 46);
      sweepChip.setAttribute("x", chipX); sweepChip.setAttribute("y", Y0 + 2);
      sweepChipTx.setAttribute("x", chipX + 23); sweepChipTx.setAttribute("y", Y0 + 15);
      sweepChipTx.textContent = "n = " + st.n;

      FUNZ.forEach(function (fnc) {
        var d = dots[fnc.key];
        if (!st.visible[fnc.key]) { d.dot.setAttribute("opacity", 0); d.arr.setAttribute("opacity", 0); return; }
        var v = fnc.f(st.n);
        if (clipped(v)) {
          d.dot.setAttribute("opacity", 0);
          d.arr.setAttribute("opacity", 1);
          d.arr.setAttribute("d", "M" + (x - 5) + " " + (Y0 + 12) + " L" + (x + 5) + " " + (Y0 + 12) +
            " L" + x + " " + (Y0 + 3) + " Z");
        } else {
          d.arr.setAttribute("opacity", 0);
          d.dot.setAttribute("opacity", 1);
          d.dot.setAttribute("cx", x);
          d.dot.setAttribute("cy", yOf(v));
        }
      });
    }

    /* =====================================================================
       DRAW: bookkeeping table (structure depends on visibility)
       ===================================================================== */
    function buildTable() {
      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
      rowRefs = {};
      FUNZ.forEach(function (fnc) {
        if (!st.visible[fnc.key]) return;
        var tr = document.createElement("tr");
        tr.style.borderTop = "1px solid " + C.line;
        var tdF = document.createElement("td");
        tdF.style.padding = "6px 10px";
        tdF.style.borderRight = "4px solid " + fnc.color;
        tdF.innerHTML = '<span dir="ltr" style="font-weight:800;color:' + C.ink + '">' + fnc.label + '</span>';
        var tdClass = document.createElement("td");
        tdClass.style.padding = "6px 10px";
        var badgeCol = fnc.tract ? C.sage : C.red;
        tdClass.innerHTML = '<span dir="ltr" style="background:' + badgeCol + ';color:#fff;font-size:.72rem;' +
          'font-weight:700;padding:2px 8px;border-radius:99px">' +
          (fnc.tract ? "tractable" : "intractable") + '</span>';
        var tdOps = document.createElement("td");
        tdOps.style.padding = "6px 10px"; tdOps.style.textAlign = "left";
        tdOps.style.fontFamily = "monospace"; tdOps.setAttribute("dir", "ltr");
        var tdTime = document.createElement("td");
        tdTime.style.padding = "6px 10px"; tdTime.style.textAlign = "left";
        tdTime.style.fontWeight = "700"; tdTime.setAttribute("dir", "ltr");
        tdTime.style.color = fnc.tract ? C.ink : C.red;
        tr.appendChild(tdF); tr.appendChild(tdClass); tr.appendChild(tdOps); tr.appendChild(tdTime);
        tbody.appendChild(tr);
        rowRefs[fnc.key] = { ops: tdOps, time: tdTime };
      });
    }
    function updateTable() {
      FUNZ.forEach(function (fnc) {
        var r = rowRefs[fnc.key];
        if (!r) return;
        var v = fnc.f(st.n);
        r.ops.innerHTML = formatOps(v);
        r.time.innerHTML = formatTime(v);
      });
    }

    /* =====================================================================
       live note under the slider
       ===================================================================== */
    function updateLiveNote() {
      var exp2 = fun("2n").f(st.n), poly5 = fun("n5").f(st.n);
      var msg;
      if (exp2 > poly5) {
        msg = '<span dir="ltr">n = ' + st.n + '</span> — כאן <span dir="ltr">2ⁿ</span> כבר עוקף את ' +
          '<span dir="ltr">n⁵</span>: האקספוננט מנצח והזמן מתפוצץ.';
      } else {
        msg = '<span dir="ltr">n = ' + st.n + '</span> — הפולינומים עדיין מובילים; ' +
          '<span dir="ltr">2ⁿ</span> יעקוף את <span dir="ltr">n⁵</span> סביב <span dir="ltr">n≈23</span>.';
      }
      liveNote.innerHTML = msg;
    }

    /* =====================================================================
       recompose
       ===================================================================== */
    function structural() {
      buildGrid();
      buildCurves();
      buildTable();
      /* legend button states */
      FUNZ.forEach(function (fnc) {
        var lb = legendBtns[fnc.key];
        var on = st.visible[fnc.key];
        lb.btn.setAttribute("aria-pressed", on ? "true" : "false");
        lb.btn.style.opacity = on ? "1" : ".45";
      });
      btnScale.innerHTML = st.scale === "log"
        ? 'ציר <span dir="ltr">Y</span>: לוגריתמי ⇄ ליניארי'
        : 'ציר <span dir="ltr">Y</span>: ליניארי ⇄ לוגריתמי';
      dynamic();
    }
    function dynamic() {
      updateSweep();
      updateTable();
      updateLiveNote();
      slider.value = String(st.n);
      slVal.textContent = "n = " + st.n;
    }

    /* =====================================================================
       step navigation
       ===================================================================== */
    function reverseTableHTML(kind) {
      var R = REVERSE[kind];
      var order = ["n", "n5", "2n", "3n"];
      var labels = { n: "n", n5: "n⁵", "2n": "2ⁿ", "3n": "3ⁿ" };
      var cells = order.map(function (k) {
        var col = (k === "2n" || k === "3n") ? C.red : C.sage;
        return '<div style="flex:1;min-width:76px;background:' + C.surface + ';border:1px solid ' + C.line +
          ';border-radius:8px;padding:6px 8px;text-align:center">' +
          '<div dir="ltr" style="font-weight:800;color:' + col + '">' + labels[k] + '</div>' +
          '<div style="font-size:.78rem;color:' + C.inkSoft + '">N ≤</div>' +
          '<div dir="ltr" style="font-family:monospace;font-weight:700;color:' + C.ink + '">' + R.vals[k] + '</div>' +
          '</div>';
      }).join("");
      return '<div style="margin-top:9px"><div style="font-size:.8rem;font-weight:700;color:' + C.inkSoft +
        ';margin-bottom:5px">' + R.title + ' — גודל הקלט המרבי שאפשר לעבד:</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' + cells + '</div></div>';
    }

    function renderPanel(s) {
      panel.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px">' +
          '<span style="background:' + s.color + ';color:#fff;font-weight:700;font-size:.72rem;' +
            'padding:2px 10px;border-radius:99px" dir="rtl">' + s.badge + '</span>' +
          '<b style="font-size:1rem;color:' + C.ink + '">' + s.title + '</b>' +
        '</div>' +
        '<div>' + s.body + '</div>' +
        (s.reverse ? reverseTableHTML(s.reverse) : "");
    }

    function renderChips() {
      chips.forEach(function (b, i) {
        var active = (i === st.step), done = (i < st.step);
        var col = STEPS[i].color;
        b.setAttribute("aria-selected", active ? "true" : "false");
        if (active) { b.style.background = col; b.style.color = "#fff"; b.style.borderColor = col; }
        else if (done) { b.style.background = C.surface2; b.style.color = C.ink; b.style.borderColor = col; }
        else { b.style.background = C.surface2; b.style.color = C.inkSoft; b.style.borderColor = C.line; }
      });
    }

    function goto(i) {
      st.step = clamp(i, 0, STEPS.length - 1);
      var s = STEPS[st.step];
      st.n = s.n;
      st.scale = s.scale;
      structural();
      renderPanel(s);
      renderChips();
      btnPrev.disabled = (st.step === 0);
      btnNext.disabled = (st.step === STEPS.length - 1);
    }

    /* =====================================================================
       "race" playback — sweep n from 1 up to 60
       ===================================================================== */
    var raf = null;
    function togglePlay() { if (raf) stopPlay(); else startPlay(); }
    function startPlay() {
      btnPlay.innerHTML = "⏸ השהה";
      btnPlay.classList.add("primary");
      if (reducedMotion()) { st.n = 60; dynamic(); stopPlay(); return; }
      st.n = NMIN;
      var startTs = null, dur = 4200, from = NMIN, to = 60;
      function frame(ts) {
        if (raf === null) return;                 /* cancelled */
        if (startTs === null) startTs = ts;
        var p = Math.min(1, (ts - startTs) / dur);
        st.n = Math.round(from + (to - from) * p);
        dynamic();
        if (p < 1) raf = requestAnimationFrame(frame);
        else stopPlay();
      }
      raf = requestAnimationFrame(frame);
    }
    function stopPlay() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      btnPlay.innerHTML = "▶ הרצת המרוץ";
      btnPlay.classList.remove("primary");
    }

    function resetAll() {
      st.visible = { n: true, nlogn: true, n2: true, n5: true, "2n": true, "3n": true };
      goto(0);
    }

    /* =====================================================================
       events
       ===================================================================== */
    slider.addEventListener("input", function () {
      stopPlay();
      st.n = clamp(parseInt(slider.value, 10) || NMIN, NMIN, NMAX);
      dynamic();
    });

    /* keyboard on wrapper: RTL-aware step nav (Right = prev, Left = next).
       Ignore when focus is on the slider/buttons so their own keys work. */
    wrap.addEventListener("keydown", function (e) {
      var tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "BUTTON") return;
      if (e.key === "ArrowRight") { stopPlay(); goto(st.step - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { stopPlay(); goto(st.step + 1); e.preventDefault(); }
      else if (e.key === "Home") { stopPlay(); goto(0); e.preventDefault(); }
      else if (e.key === "End") { stopPlay(); goto(STEPS.length - 1); e.preventDefault(); }
    });

    /* initial paint */
    goto(0);
  }

  /* =====================================================================
     boot — mount all instances, never throw.
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
