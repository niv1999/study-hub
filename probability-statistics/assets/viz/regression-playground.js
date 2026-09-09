/* =====================================================================
   regression-playground.js — Module 03 "רגרסיה ליניארית ומקדם המיתאם"
   Grounded in:
     _notes/lec02-regression.md   — שיטת LSQ (Least Squares), מרחקים
       אנכיים (לא ניצבים לקו), המשוואות הסטטיסטיות:
         β₁ = Cov(x,y)/VAR(x),  ȳ = β₀ + β₁x̄  (נקודת הממוצעים על הקו)
         Cov(x,y) = Σxᵢyᵢ/n − x̄ȳ,  VAR(x) = Σxᵢ²/n − x̄²
         R² = Cov²(x,y) / (VAR(x)·VAR(y)),  −1 ≤ R ≤ 1
       תרגיל מס' 2 של ההרצאה: (1,3),(2,5),(3,6),(4,8) ⇒ y = 1.5 + 1.6x,
       R² = 0.985 — משמש כדוגמת ברירת המחדל ולאימות המנוע.
     _notes/class02-03.md (תרגול 02) — שאלה 2 (גיל/משקל), שאלה 3 (ציוני
       סטטיסטיקה/מתמטיקה; תוצאת ה-Excel בשקף: y = 0.7692x + 3.4615,
       R² = 0.8547 — אומתה מול המנוע), פירוש סימן ± של הקשר.
     _notes/booklet-part1.md — תרגיל מס' 2 שאלה 6 (מתח/זרם, "שרטט את קו
       הרגרסיה ידנית" — ההשראה למצב ניחוש הקו).
   כל המספרים המוצגים מחושבים חי מאותן נוסחאות הרצאה — לעולם לא מוקלדים
   ידנית — ולכן אינם יכולים לסטות מהמתמטיקה.

   Self-contained IIFE, vanilla JS. SVG עם viewBox (רספונסיבי). צבעים
   אך ורק מ-CSS tokens (var(--accent) וכו') כך ששני ה-themes נתמכים.
   ממשק בעברית RTL; המספרים והגרף LTR. כפתורים אמיתיים, aria-labels,
   גרירה בעכבר/מגע + הזזה מלאה במקלדת (חיצים, Delete).
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "regression-playground";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* ---- geometry (viewBox units) ---- */
  var VB_W = 680, VB_H = 440;
  var ML = 56, MR = 18, MT = 18, MB = 48;
  var PW = VB_W - ML - MR, PH = VB_H - MT - MB;

  /* =====================================================================
     דוגמאות מוכנות — כולן מקבצי ה-notes של המודול (מקור מצוין ליד כל אחת).
     ===================================================================== */
  var PRESETS = [
    {
      id: "lec2",
      label: "הרצאה 2 — תרגיל מס' 2 (הדוגמה מהשיעור)",
      xLabel: "x", yLabel: "y",
      source: "מקור: הרצאה 2 (ד\"ר דוד סעד), תרגיל מס' 2 — בהרצאה חושב: y = 1.5 + 1.6x, R² = 0.985.",
      pts: [[1, 3], [2, 5], [3, 6], [4, 8]]
    },
    {
      id: "cls2q2",
      label: "תרגול 02 שאלה 2 — גיל/משקל",
      xLabel: "גיל (חודשים)", yLabel: "משקל (ק\"ג)",
      source: "מקור: תרגול 02, שאלה 2 — ניבוי משקל (Y) על-פי גיל (X). בשקפים אין פתרון — הקו כאן מחושב חי.",
      pts: [[5, 6], [8, 7], [10, 8], [12, 9], [14, 10]]
    },
    {
      id: "cls2q3",
      label: "תרגול 02 שאלה 3 — ציוני סטטיסטיקה/מתמטיקה",
      xLabel: "ציון בסטטיסטיקה (x)", yLabel: "ציון במתמטיקה (y)",
      source: "מקור: תרגול 02, שאלה 3 — תוצאת ה-Excel בשקף: y = 0.7692x + 3.4615, R² = 0.8547.",
      pts: [[80, 60], [95, 75], [60, 50], [85, 75]]
    },
    {
      id: "bookq6",
      label: "חוברת, תרגיל 2 שאלה 6 — מתח/זרם",
      xLabel: "מתח", yLabel: "זרם",
      source: "מקור: חוברת התרגילים, תרגיל מס' 2 שאלה 6 — סעיף א מבקש \"שרטט את קו הרגרסיה ידנית\": נסו במצב ניחוש הקו!",
      pts: [[110, 2.15], [120, 2.45], [150, 3.05], [180, 3.55], [220, 4.4]]
    },
    {
      id: "free",
      label: "לוח חופשי (מתחיל ריק)",
      xLabel: "x", yLabel: "y",
      source: "לוח חופשי — לחצו על הגרף כדי להוסיף נקודות ולבנות פיזור משלכם.",
      pts: []
    }
  ];

  /* =====================================================================
     המתמטיקה — בדיוק נוסחאות ההרצאה (חלוקה ב-n, כמו בכתב היד).
     ===================================================================== */
  function computeStats(pts) {
    var n = pts.length;
    if (n < 2) return { ok: false, reason: "few", n: n };
    var sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0, i;
    for (i = 0; i < n; i++) {
      sx += pts[i].x; sy += pts[i].y;
      sxy += pts[i].x * pts[i].y;
      sxx += pts[i].x * pts[i].x;
      syy += pts[i].y * pts[i].y;
    }
    var xbar = sx / n, ybar = sy / n;
    var cov = sxy / n - xbar * ybar;          /* Cov = Σxᵢyᵢ/n − x̄ȳ */
    var varx = sxx / n - xbar * xbar;         /* VAR(x) = Σxᵢ²/n − x̄² */
    var vary = syy / n - ybar * ybar;         /* VAR(y) = Σyᵢ²/n − ȳ² */
    if (varx < 1e-12) return { ok: false, reason: "varx0", n: n, xbar: xbar, ybar: ybar };
    var b1 = cov / varx;                      /* β₁ = Cov/VAR(x) */
    var b0 = ybar - b1 * xbar;                /* ȳ = β₀ + β₁x̄ */
    var r2 = (vary < 1e-12) ? NaN : (cov * cov) / (varx * vary);
    var sse = 0;
    for (i = 0; i < n; i++) {
      var e = b0 + b1 * pts[i].x - pts[i].y;
      sse += e * e;
    }
    return {
      ok: true, n: n, xbar: xbar, ybar: ybar, cov: cov, varx: varx,
      vary: vary, b1: b1, b0: b0, r2: r2,
      r: (isNaN(r2) ? NaN : (cov < 0 ? -1 : 1) * Math.sqrt(Math.max(r2, 0))),
      sse: sse
    };
  }

  /* SSE של קו שרירותי y = b + m·x (למצב הניחוש) */
  function sseFor(pts, m, b) {
    var s = 0;
    for (var i = 0; i < pts.length; i++) {
      var e = b + m * pts[i].x - pts[i].y;
      s += e * e;
    }
    return s;
  }

  /* =====================================================================
     helpers — מספרים, DOM, SVG
     ===================================================================== */
  function fmt(v) {
    if (v == null || !isFinite(v)) return "—";
    var a = Math.abs(v), s;
    if (a >= 1000) s = v.toFixed(0);
    else if (a >= 100) s = v.toFixed(1);
    else if (a >= 10) s = v.toFixed(2);
    else s = v.toFixed(3);
    s = s.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
    return s.replace("-", "−"); /* מינוס טיפוגרפי */
  }
  function fmt3(v) {
    if (v == null || !isFinite(v)) return "—";
    return v.toFixed(3).replace("-", "−");
  }
  function fmtTick(v, step) {
    if (Math.abs(v) < step * 1e-6) v = 0; /* מניעת "−0.00" משגיאות float */
    var dec = Math.max(0, -Math.floor(Math.log(step) / Math.LN10 + 1e-9));
    return v.toFixed(Math.min(dec, 6)).replace("-", "−");
  }
  /* ŷ = β₀ ± |β₁|·x כמחרוזת תצוגה */
  function eqString(b0, b1) {
    if (!isFinite(b0) || !isFinite(b1)) return "—";
    return "ŷ = " + fmt(b0) + (b1 < 0 ? " − " : " + ") + fmt(Math.abs(b1)) + "·x";
  }
  function niceStep(range, target) {
    var raw = range / target;
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var norm = raw / mag;
    var f = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
    return f * mag;
  }
  function mk(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function svgEl(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  /* =====================================================================
     STYLE — scoped, theme tokens בלבד
     ===================================================================== */
  var STYLE_ID = "rp-style";
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      ".viz-regplay{direction:rtl;position:relative}" +
      ".rp-lede{font-size:.88rem;color:var(--ink-soft);margin:0 0 .8rem;line-height:1.6}" +
      ".rp-controls{display:flex;flex-wrap:wrap;gap:.5rem .8rem;align-items:center;margin-bottom:.5rem}" +
      ".rp-controls label{font-weight:700;font-size:.86rem;color:var(--ink)}" +
      ".rp-select{font-family:inherit;font-size:.86rem;font-weight:600;color:var(--ink);background:var(--surface-2);" +
      "border:1.5px solid var(--line);border-radius:99px;padding:.35rem .9rem;cursor:pointer;max-width:100%}" +
      ".rp-select:focus-visible{outline:2px solid var(--accent);outline-offset:2px}" +
      ".rp-source{font-size:.78rem;color:var(--ink-soft);margin:.15rem 0 .6rem;line-height:1.55}" +
      ".rp-svg-wrap{direction:ltr;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);overflow:hidden}" +
      ".rp-svg-wrap svg{display:block;width:100%;height:auto;touch-action:none}" +
      ".rp-grid{stroke:var(--line);stroke-width:1}" +
      ".rp-frame{stroke:var(--ink-soft);stroke-width:1.2;fill:none;opacity:.7}" +
      ".rp-tick{font-family:var(--font-mono);font-size:11px;fill:var(--ink-soft)}" +
      ".rp-axis-label{font-size:12px;font-weight:700;fill:var(--ink)}" +
      ".rp-bgrect{fill:var(--surface);cursor:crosshair}" +
      ".rp-lsq{stroke:var(--accent);stroke-width:3;fill:none}" +
      ".rp-guess{stroke:var(--mustard);stroke-width:3;fill:none}" +
      ".rp-guess-hit{stroke:transparent;stroke-width:18;fill:none;cursor:move}" +
      ".rp-guess-hit:focus-visible{outline:none;stroke:var(--mustard);opacity:.25}" +
      ".rp-resid{stroke:var(--clay);stroke-width:2;stroke-dasharray:4 3;opacity:.85}" +
      ".rp-mean{stroke:var(--plum);stroke-width:2.5}" +
      ".rp-point{fill:var(--dusty-blue);stroke:var(--surface);stroke-width:1.5;cursor:grab}" +
      ".rp-point:focus{outline:none;stroke:var(--accent);stroke-width:3}" +
      ".rp-point.is-selected{stroke:var(--accent);stroke-width:3}" +
      ".rp-handle{fill:var(--mustard);stroke:var(--surface);stroke-width:1.5;cursor:ns-resize}" +
      ".rp-handle:focus{outline:none;stroke:var(--accent);stroke-width:3}" +
      ".rp-msg{font-size:.85rem;font-weight:700;color:var(--clay);margin:.5rem 0 0}" +
      ".rp-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.7rem;margin-top:.8rem}" +
      ".rp-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);padding:.7rem .9rem}" +
      ".rp-card h4{margin:0 0 .45rem;font-size:.9rem;color:var(--ink)}" +
      ".rp-eq{font-family:var(--font-mono);direction:ltr;text-align:left;font-size:1.02rem;font-weight:700;" +
      "color:var(--accent);margin:0 0 .3rem}" +
      ".rp-formula{font-family:var(--font-mono);direction:ltr;text-align:left;font-size:.78rem;line-height:1.8;" +
      "white-space:pre-wrap;color:var(--ink);background:var(--surface-2);border:1px dashed var(--line);" +
      "border-radius:8px;padding:.5rem .65rem;margin:.3rem 0 0;overflow-x:auto}" +
      ".rp-interp{font-size:.82rem;color:var(--ink-soft);margin:.4rem 0 0;line-height:1.55}" +
      ".rp-note{font-size:.76rem;color:var(--ink-soft);margin:.45rem 0 0;line-height:1.5}" +
      ".rp-sse-row{display:flex;align-items:center;gap:.55rem;margin:.35rem 0}" +
      ".rp-sse-label{flex:0 0 88px;font-size:.8rem;font-weight:700;color:var(--ink)}" +
      ".rp-sse-track{flex:1;height:16px;border-radius:6px;background:var(--surface-2);border:1px solid var(--line);" +
      "position:relative;overflow:hidden}" +
      ".rp-sse-fill{position:absolute;inset-inline-start:0;top:0;bottom:0;border-radius:6px;transition:width .15s ease}" +
      ".rp-sse-fill.guess{background:var(--mustard)}" +
      ".rp-sse-fill.lsq{background:var(--accent)}" +
      ".rp-sse-val{flex:0 0 84px;font-family:var(--font-mono);font-size:.78rem;font-weight:700;" +
      "color:var(--ink-soft);direction:ltr;text-align:left}" +
      ".rp-gap{font-size:.85rem;font-weight:700;color:var(--ink);margin:.4rem 0 0}" +
      ".rp-gap.is-good{color:var(--sage)}" +
      ".rp-toggle.primary{background:var(--accent);color:#fff;border-color:var(--accent)}" +
      ".rp-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);" +
      "clip-path:inset(50%);white-space:nowrap}" +
      "@media (max-width:560px){.rp-sse-label{flex-basis:70px}.rp-sse-val{flex-basis:70px}}";
    document.head.appendChild(s);
  }

  /* =====================================================================
     render — בניית מופע אחד
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-rp-ready") === "1") return;
    mount.setAttribute("data-rp-ready", "1");
    mount.innerHTML = "";
    ensureStyle();

    var uid = "rp" + Math.random().toString(36).slice(2, 8);

    /* ---------------- state ---------------- */
    var presetIdx = 0;
    var pts = [];                 /* [{x,y}] */
    var bounds = { xmin: 0, xmax: 10, ymin: 0, ymax: 10 };
    var showResiduals = false;
    var guessMode = false;
    var showLsqInGuess = false;
    var guess = { ya: 0, yb: 0 }; /* גובה שני קצות קו הניחוש */
    var selectedIdx = -1;
    var stats = null;

    /* מיפוי עולם→מסך */
    function SX(x) { return ML + (x - bounds.xmin) / (bounds.xmax - bounds.xmin) * PW; }
    function SY(y) { return MT + (bounds.ymax - y) / (bounds.ymax - bounds.ymin) * PH; }
    function guessXA() { return bounds.xmin + 0.12 * (bounds.xmax - bounds.xmin); }
    function guessXB() { return bounds.xmax - 0.12 * (bounds.xmax - bounds.xmin); }
    function guessLine() {
      var xa = guessXA(), xb = guessXB();
      var m = (guess.yb - guess.ya) / (xb - xa);
      return { m: m, b: guess.ya - m * xa };
    }
    function clampX(x) { return Math.min(bounds.xmax, Math.max(bounds.xmin, x)); }
    function clampY(y) { return Math.min(bounds.ymax, Math.max(bounds.ymin, y)); }

    function setBoundsFromPts() {
      if (!pts.length) { bounds = { xmin: 0, xmax: 10, ymin: 0, ymax: 10 }; return; }
      var xs = pts.map(function (p) { return p.x; });
      var ys = pts.map(function (p) { return p.y; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
      var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      var rx = (x1 - x0) || 1, ry = (y1 - y0) || 1;
      bounds = {
        xmin: x0 - 0.18 * rx, xmax: x1 + 0.18 * rx,
        ymin: y0 - 0.22 * ry, ymax: y1 + 0.22 * ry
      };
    }

    /* ---------------- DOM ---------------- */
    var root = mk("div", "viz-regplay");

    root.appendChild(mk("p", "rp-lede",
      "מגרש משחקים ל<b>רגרסיה ליניארית</b> בשיטת LSQ (Least Squares): גררו נקודות וראו את הקו, " +
      "המשוואה ו-R² מתעדכנים חי לפי נוסחאות ההרצאה. השאריות נמדדות <b>אנכית</b> (במקביל לציר y) — " +
      "כמו שהודגש בהרצאה — ולא בניצב לקו."));

    /* --- שורת בקרה: בחירת דוגמה + כפתורי נקודות --- */
    var controls = mk("div", "rp-controls");
    var selLbl = mk("label", null, "דוגמה מהקורס:");
    selLbl.htmlFor = uid + "-preset";
    var select = document.createElement("select");
    select.className = "rp-select";
    select.id = uid + "-preset";
    PRESETS.forEach(function (p, i) {
      var o = document.createElement("option");
      o.value = String(i);
      o.textContent = p.label;
      select.appendChild(o);
    });
    controls.appendChild(selLbl);
    controls.appendChild(select);

    /* שם נגיש = הטקסט הנראה (ללא aria-label דורס); title כהסבר משלים */
    var resetBtn = mkBtn("איפוס הדוגמה", "טעינה מחדש של נקודות הדוגמה הנוכחית");
    var addBtn = mkBtn("+ הוסף נקודה", "הוספת נקודה במרכז הגרף (ואפשר גם בלחיצה על הגרף)");
    var delBtn = mkBtn("מחק נקודה", "מחיקת הנקודה הנבחרת (או האחרונה)");
    controls.appendChild(resetBtn);
    controls.appendChild(addBtn);
    controls.appendChild(delBtn);
    root.appendChild(controls);

    /* --- שורת מתגים --- */
    var toggles = mk("div", "rp-controls");
    var residBtn = mkToggle("הצג שאריות");
    var guessBtn = mkToggle("מצב: נחש את הקו");
    var showLsqBtn = mkToggle("הצג את קו ה-LSQ");
    showLsqBtn.hidden = true;
    toggles.appendChild(residBtn);
    toggles.appendChild(guessBtn);
    toggles.appendChild(showLsqBtn);
    root.appendChild(toggles);

    var sourceP = mk("p", "rp-source", "");
    root.appendChild(sourceP);

    /* --- SVG --- */
    var svgWrap = mk("div", "rp-svg-wrap");
    svgWrap.setAttribute("dir", "ltr");
    var svg = svgEl("svg", {
      viewBox: "0 0 " + VB_W + " " + VB_H,
      role: "group", "aria-label": "מערכת צירים אינטראקטיבית של דיאגרמת פיזור וקו רגרסיה"
    });

    var defs = svgEl("defs");
    var clip = svgEl("clipPath", { id: uid + "-clip" });
    clip.appendChild(svgEl("rect", { x: ML, y: MT, width: PW, height: PH }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    var bgRect = svgEl("rect", {
      x: ML, y: MT, width: PW, height: PH, "class": "rp-bgrect"
    });
    bgRect.appendChild(svgEl("title"));
    bgRect.firstChild.textContent = "לחיצה מוסיפה נקודה";
    svg.appendChild(bgRect);

    var gridG = svgEl("g");
    var frame = svgEl("rect", { x: ML, y: MT, width: PW, height: PH, "class": "rp-frame" });
    var lineG = svgEl("g", { "clip-path": "url(#" + uid + "-clip)" }); /* residuals + lines */
    var residG = svgEl("g");
    var lsqPath = svgEl("line", { "class": "rp-lsq" });
    var guessG = svgEl("g");
    var guessPath = svgEl("line", { "class": "rp-guess" });
    var guessHit = svgEl("line", { "class": "rp-guess-hit", tabindex: "0", role: "button" });
    guessHit.setAttribute("aria-label", "קו הניחוש — חיצים למעלה/למטה מזיזים את כולו");
    guessG.appendChild(guessPath);
    guessG.appendChild(guessHit);
    lineG.appendChild(residG);
    lineG.appendChild(lsqPath);
    lineG.appendChild(guessG);

    var meanG = svgEl("g", { "class": "rp-mean" });
    var meanTitle = svgEl("title");
    meanTitle.textContent = "נקודת הממוצעים (x̄, ȳ) — תמיד יושבת על קו ה-LSQ";
    meanG.appendChild(meanTitle);
    var meanL1 = svgEl("line"), meanL2 = svgEl("line");
    meanG.appendChild(meanL1);
    meanG.appendChild(meanL2);

    var pointsG = svgEl("g");
    var handleA = svgEl("circle", { r: 8, "class": "rp-handle", tabindex: "0", role: "button" });
    var handleB = svgEl("circle", { r: 8, "class": "rp-handle", tabindex: "0", role: "button" });
    handleA.setAttribute("aria-label", "ידית שמאלית של קו הניחוש — חיצים למעלה/למטה");
    handleB.setAttribute("aria-label", "ידית ימנית של קו הניחוש — חיצים למעלה/למטה");

    var xAxisLbl = svgEl("text", { "class": "rp-axis-label", "text-anchor": "middle", x: ML + PW / 2, y: VB_H - 8 });
    var yAxisLbl = svgEl("text", { "class": "rp-axis-label", "text-anchor": "start", x: 6, y: 13 });

    svg.appendChild(gridG);
    svg.appendChild(frame);
    svg.appendChild(lineG);
    svg.appendChild(meanG);
    svg.appendChild(pointsG);
    svg.appendChild(handleA);
    svg.appendChild(handleB);
    svg.appendChild(xAxisLbl);
    svg.appendChild(yAxisLbl);
    svgWrap.appendChild(svg);
    root.appendChild(svgWrap);

    var msgP = mk("p", "rp-msg", "");
    msgP.hidden = true;
    root.appendChild(msgP);

    /* --- cards --- */
    var cards = mk("div", "rp-cards");

    var eqCard = mk("div", "rp-card");
    eqCard.appendChild(mk("h4", null, "משוואת קו הרגרסיה ומקדם המיתאם"));
    var eqLine = mk("p", "rp-eq", "—");
    var r2Line = mk("p", "rp-eq", "—");
    r2Line.style.color = "var(--ink)";
    r2Line.style.fontSize = ".9rem";
    var interpLine = mk("p", "rp-interp", "");
    eqCard.appendChild(eqLine);
    eqCard.appendChild(r2Line);
    eqCard.appendChild(interpLine);
    eqCard.appendChild(mk("p", "rp-note",
      "|R| קרוב ל-1 — קשר חזק (ב-R = ±1 כל הנקודות בדיוק על הקו); R קרוב ל-0 — חוסר קשר ופיזור אקראי."));
    cards.appendChild(eqCard);

    var statsCard = mk("div", "rp-card");
    statsCard.appendChild(mk("h4", null, "החישוב המלא (נוסחאות ההרצאה)"));
    var statsBlock = mk("div", "rp-formula", "—");
    statsCard.appendChild(statsBlock);
    statsCard.appendChild(mk("p", "rp-note",
      "החלוקה ב-n בכל הנוסחאות — בדיוק כמו בהרצאה. נקודת הממוצעים (x̄, ȳ) מסומנת על הגרף בצלב — היא תמיד על הקו."));
    cards.appendChild(statsCard);

    var sseCard = mk("div", "rp-card");
    sseCard.hidden = true;
    sseCard.appendChild(mk("h4", null, "סכום ריבועי השאריות — Σ(ŷᵢ − yᵢ)²"));
    var rowGuess = mk("div", "rp-sse-row");
    rowGuess.appendChild(mk("span", "rp-sse-label", "הקו שלכם"));
    var trackGuess = mk("span", "rp-sse-track");
    var fillGuess = mk("span", "rp-sse-fill guess");
    trackGuess.appendChild(fillGuess);
    rowGuess.appendChild(trackGuess);
    var valGuess = mk("span", "rp-sse-val", "—");
    valGuess.setAttribute("dir", "ltr");
    rowGuess.appendChild(valGuess);
    var rowLsq = mk("div", "rp-sse-row");
    rowLsq.appendChild(mk("span", "rp-sse-label", "קו ה-LSQ"));
    var trackLsq = mk("span", "rp-sse-track");
    var fillLsq = mk("span", "rp-sse-fill lsq");
    trackLsq.appendChild(fillLsq);
    rowLsq.appendChild(trackLsq);
    var valLsq = mk("span", "rp-sse-val", "—");
    valLsq.setAttribute("dir", "ltr");
    rowLsq.appendChild(valLsq);
    sseCard.appendChild(rowGuess);
    sseCard.appendChild(rowLsq);
    var gapLine = mk("p", "rp-gap", "");
    sseCard.appendChild(gapLine);
    sseCard.appendChild(mk("p", "rp-note",
      "גררו את שתי הידיות (או את הקו כולו) כדי לכוון שיפוע וגובה; במקלדת: חיצים ↑/↓ על ידית ממוקדת. " +
      "קו ה-LSQ הוא, לפי ההגדרה מההרצאה, הקו שעבורו הסכום הזה מינימלי."));
    cards.appendChild(sseCard);

    root.appendChild(cards);

    var live = mk("div", "rp-live");
    live.setAttribute("aria-live", "polite");
    root.appendChild(live);

    mount.appendChild(root);

    /* ---------------- קטנות ---------------- */
    function mkBtn(text, tip) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn";
      b.textContent = text;
      if (tip) b.title = tip;
      return b;
    }
    function mkToggle(text) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn rp-toggle";
      b.textContent = text;
      b.setAttribute("aria-pressed", "false");
      return b;
    }
    function setToggle(btn, on) {
      btn.classList.toggle("primary", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    function announce(text) { live.textContent = text; }

    function worldFromEvent(e) {
      var rect = svg.getBoundingClientRect();
      var px = (e.clientX - rect.left) * (VB_W / rect.width);
      var py = (e.clientY - rect.top) * (VB_H / rect.height);
      return {
        x: bounds.xmin + (px - ML) / PW * (bounds.xmax - bounds.xmin),
        y: bounds.ymax - (py - MT) / PH * (bounds.ymax - bounds.ymin)
      };
    }

    /* ---------------- ציור צירים ---------------- */
    function paintAxes() {
      while (gridG.firstChild) gridG.removeChild(gridG.firstChild);
      var xr = bounds.xmax - bounds.xmin, yr = bounds.ymax - bounds.ymin;
      var xs = niceStep(xr, 6), ys = niceStep(yr, 6), v;
      for (v = Math.ceil(bounds.xmin / xs) * xs; v <= bounds.xmax + 1e-9; v += xs) {
        var gx = SX(v);
        gridG.appendChild(svgEl("line", { x1: gx, y1: MT, x2: gx, y2: MT + PH, "class": "rp-grid" }));
        var tx = svgEl("text", { x: gx, y: MT + PH + 16, "text-anchor": "middle", "class": "rp-tick" });
        tx.textContent = fmtTick(v, xs);
        gridG.appendChild(tx);
      }
      for (v = Math.ceil(bounds.ymin / ys) * ys; v <= bounds.ymax + 1e-9; v += ys) {
        var gy = SY(v);
        gridG.appendChild(svgEl("line", { x1: ML, y1: gy, x2: ML + PW, y2: gy, "class": "rp-grid" }));
        var ty = svgEl("text", { x: ML - 6, y: gy + 4, "text-anchor": "end", "class": "rp-tick" });
        ty.textContent = fmtTick(v, ys);
        gridG.appendChild(ty);
      }
      var p = PRESETS[presetIdx];
      xAxisLbl.textContent = p.xLabel;
      yAxisLbl.textContent = p.yLabel + " ↑";
    }

    /* ---------------- נקודות (בנייה מחדש) ---------------- */
    var pointEls = [];
    function rebuildPoints(focusIdx) {
      while (pointsG.firstChild) pointsG.removeChild(pointsG.firstChild);
      pointEls = [];
      pts.forEach(function (p, i) {
        var c = svgEl("circle", { r: 7, "class": "rp-point", tabindex: "0", role: "button" });
        c.setAttribute("cx", SX(p.x));
        c.setAttribute("cy", SY(p.y));
        updatePointAria(c, p, i);
        c.classList.toggle("is-selected", i === selectedIdx);

        c.addEventListener("pointerdown", function (e) {
          e.preventDefault();
          e.stopPropagation();
          selectPoint(i);
          startDrag(c, e, function (w) {
            p.x = clampX(w.x); p.y = clampY(w.y);
            c.setAttribute("cx", SX(p.x));
            c.setAttribute("cy", SY(p.y));
            updatePointAria(c, p, i);
            paintDynamic();
          }, function () { announceStats(); });
          try { c.focus({ preventScroll: true }); } catch (err) { c.focus(); }
        });
        c.addEventListener("focus", function () { selectPoint(i); });
        c.addEventListener("keydown", function (e) {
          var xr = bounds.xmax - bounds.xmin, yr = bounds.ymax - bounds.ymin;
          var dx = xr / 60 * (e.shiftKey ? 5 : 1);
          var dy = yr / 60 * (e.shiftKey ? 5 : 1);
          var moved = false;
          if (e.key === "ArrowLeft") { p.x = clampX(p.x - dx); moved = true; }
          else if (e.key === "ArrowRight") { p.x = clampX(p.x + dx); moved = true; }
          else if (e.key === "ArrowUp") { p.y = clampY(p.y + dy); moved = true; }
          else if (e.key === "ArrowDown") { p.y = clampY(p.y - dy); moved = true; }
          else if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            deletePoint(i);
            return;
          }
          if (moved) {
            e.preventDefault();
            c.setAttribute("cx", SX(p.x));
            c.setAttribute("cy", SY(p.y));
            updatePointAria(c, p, i);
            paintDynamic();
            announceStats();
          }
        });
        pointsG.appendChild(c);
        pointEls.push(c);
      });
      if (focusIdx != null && pointEls[focusIdx]) {
        try { pointEls[focusIdx].focus({ preventScroll: true }); } catch (err) { pointEls[focusIdx].focus(); }
      }
    }
    function updatePointAria(c, p, i) {
      c.setAttribute("aria-label",
        "נקודה " + (i + 1) + ": x=" + fmt(p.x) + ", y=" + fmt(p.y) +
        " — חיצים מזיזים, Delete מוחק");
    }
    function selectPoint(i) {
      selectedIdx = i;
      pointEls.forEach(function (el, j) { el.classList.toggle("is-selected", j === i); });
    }

    /* גרירה גנרית עם pointer capture */
    function startDrag(target, downEvt, onMove, onEnd) {
      var pid = downEvt.pointerId;
      try { target.setPointerCapture(pid); } catch (err) { /* ignore */ }
      function move(e) {
        if (e.pointerId !== pid) return;
        onMove(worldFromEvent(e));
      }
      function up(e) {
        if (e.pointerId !== pid) return;
        target.removeEventListener("pointermove", move);
        target.removeEventListener("pointerup", up);
        target.removeEventListener("pointercancel", up);
        if (onEnd) onEnd();
      }
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerup", up);
      target.addEventListener("pointercancel", up);
    }

    /* ---------------- ציור דינמי ---------------- */
    function paintDynamic() {
      stats = computeStats(pts);

      /* הודעות מצב */
      var msg = "";
      if (!stats.ok && stats.reason === "few") {
        msg = "צריך לפחות 2 נקודות כדי לחשב קו רגרסיה — לחצו על הגרף כדי להוסיף.";
      } else if (!stats.ok && stats.reason === "varx0") {
        msg = "כל הנקודות באותו x — VAR(x) = 0 ואין קו רגרסיה. הזיזו נקודה הצידה.";
      }
      msgP.textContent = msg;
      msgP.hidden = !msg;

      /* קו LSQ */
      var showLsq = stats.ok && (!guessMode || showLsqInGuess);
      lsqPath.style.display = showLsq ? "" : "none";
      if (stats.ok) {
        lsqPath.setAttribute("x1", SX(bounds.xmin));
        lsqPath.setAttribute("y1", SY(stats.b0 + stats.b1 * bounds.xmin));
        lsqPath.setAttribute("x2", SX(bounds.xmax));
        lsqPath.setAttribute("y2", SY(stats.b0 + stats.b1 * bounds.xmax));
      }

      /* קו ניחוש + ידיות */
      guessG.style.display = guessMode ? "" : "none";
      handleA.style.display = guessMode ? "" : "none";
      handleB.style.display = guessMode ? "" : "none";
      var gl = null;
      if (guessMode) {
        gl = guessLine();
        guessPath.setAttribute("x1", SX(bounds.xmin));
        guessPath.setAttribute("y1", SY(gl.b + gl.m * bounds.xmin));
        guessPath.setAttribute("x2", SX(bounds.xmax));
        guessPath.setAttribute("y2", SY(gl.b + gl.m * bounds.xmax));
        guessHit.setAttribute("x1", SX(bounds.xmin));
        guessHit.setAttribute("y1", SY(gl.b + gl.m * bounds.xmin));
        guessHit.setAttribute("x2", SX(bounds.xmax));
        guessHit.setAttribute("y2", SY(gl.b + gl.m * bounds.xmax));
        handleA.setAttribute("cx", SX(guessXA()));
        handleA.setAttribute("cy", SY(guess.ya));
        handleB.setAttribute("cx", SX(guessXB()));
        handleB.setAttribute("cy", SY(guess.yb));
      }

      /* שאריות — אל הקו הרלוונטי (ניחוש במצב ניחוש, אחרת LSQ) */
      while (residG.firstChild) residG.removeChild(residG.firstChild);
      if (showResiduals) {
        var m = null, b = null;
        if (guessMode && gl) { m = gl.m; b = gl.b; }
        else if (stats.ok) { m = stats.b1; b = stats.b0; }
        if (m !== null) {
          pts.forEach(function (p) {
            residG.appendChild(svgEl("line", {
              x1: SX(p.x), y1: SY(p.y),
              x2: SX(p.x), y2: SY(b + m * p.x),
              "class": "rp-resid"
            }));
          });
        }
      }

      /* צלב הממוצעים */
      meanG.style.display = stats.ok ? "" : "none";
      if (stats.ok) {
        var mx = SX(stats.xbar), my = SY(stats.ybar);
        meanL1.setAttribute("x1", mx - 7); meanL1.setAttribute("y1", my);
        meanL1.setAttribute("x2", mx + 7); meanL1.setAttribute("y2", my);
        meanL2.setAttribute("x1", mx); meanL2.setAttribute("y1", my - 7);
        meanL2.setAttribute("x2", mx); meanL2.setAttribute("y2", my + 7);
      }

      /* כרטיסים */
      if (stats.ok) {
        eqLine.textContent = eqString(stats.b0, stats.b1);
        r2Line.textContent = "R² = " + fmt3(stats.r2) +
          (isNaN(stats.r2) ? "" : "   (R = " + fmt3(stats.r) + ")");
        if (isNaN(stats.r2)) {
          interpLine.textContent = "VAR(y) = 0 — כל הנקודות באותו גובה, ולכן R אינו מוגדר.";
        } else if (stats.r2 > 0.9999) {
          interpLine.textContent = "R = ±1 — כל הנקודות בדיוק על הקו.";
        } else if (Math.abs(stats.cov) < 1e-12) {
          interpLine.textContent = "Cov(x,y) = 0 ולכן R = 0 — אין קשר ליניארי בין המשתנים.";
        } else if (stats.cov > 0) {
          interpLine.textContent = "הסימן של R כסימן ה-Cov: חיובי — שני המשתנים באותה מגמה (קו עולה).";
        } else {
          interpLine.textContent = "הסימן של R כסימן ה-Cov: שלילי — המשתנים במגמות מנוגדות (קו יורד).";
        }
        statsBlock.textContent =
          "n = " + stats.n + "   x̄ = " + fmt(stats.xbar) + "   ȳ = " + fmt(stats.ybar) + "\n" +
          "Cov(x,y) = Σxᵢyᵢ/n − x̄·ȳ = " + fmt(stats.cov) + "\n" +
          "VAR(x) = Σxᵢ²/n − x̄² = " + fmt(stats.varx) + "\n" +
          "VAR(y) = Σyᵢ²/n − ȳ² = " + fmt(stats.vary) + "\n" +
          "β₁ = Cov/VAR(x) = " + fmt(stats.b1) + "\n" +
          "β₀ = ȳ − β₁·x̄ = " + fmt(stats.b0) + "\n" +
          "R² = Cov²/(VAR(x)·VAR(y)) = " + fmt3(stats.r2) + "\n" +
          "SSE = Σ(ŷᵢ − yᵢ)² = " + fmt(stats.sse);
      } else {
        eqLine.textContent = "—";
        r2Line.textContent = "—";
        interpLine.textContent = "";
        statsBlock.textContent = "—";
      }

      /* כרטיס SSE במצב ניחוש */
      sseCard.hidden = !guessMode;
      if (guessMode && stats.ok && gl) {
        var sseG = sseFor(pts, gl.m, gl.b);
        var sseL = stats.sse;
        var maxS = Math.max(sseG, sseL, 1e-12);
        fillGuess.style.width = Math.max(2, sseG / maxS * 100) + "%";
        fillLsq.style.width = Math.max(2, sseL / maxS * 100) + "%";
        valGuess.textContent = fmt(sseG);
        valLsq.textContent = fmt(sseL);
        var good = false, gapTxt;
        if (sseL < 1e-9) {
          good = sseG < 1e-6;
          gapTxt = good ? "מדויק! גם הקו שלכם עובר בכל הנקודות." :
            "קו ה-LSQ כאן מושלם (SSE = 0) — נסו להצמיד אליו את הקו שלכם.";
        } else {
          var gapPct = Math.max(0, (sseG / sseL - 1) * 100);
          good = gapPct <= 1;
          gapTxt = good ? "מצוין! אתם בתוך ‎1%‎ מהקו האופטימלי." :
            "פער מהאופטימום: " + ltrText("+" + fmt(gapPct) + "%") + " — נסו לקרב את הקו לנקודות.";
        }
        gapLine.innerHTML = gapTxt;
        gapLine.classList.toggle("is-good", good);
      } else if (guessMode) {
        valGuess.textContent = "—";
        valLsq.textContent = "—";
        fillGuess.style.width = "0";
        fillLsq.style.width = "0";
        gapLine.textContent = "";
      }
    }
    function ltrText(s) { return '<span dir="ltr">' + s + "</span>"; }

    function announceStats() {
      if (!stats || !stats.ok) return;
      announce("משוואת הקו: " + eqString(stats.b0, stats.b1) + ", R בריבוע " + fmt3(stats.r2));
    }

    /* ---------------- פעולות ---------------- */
    function initGuess() {
      var s = computeStats(pts);
      var mid = s.ok ? s.ybar : (bounds.ymin + bounds.ymax) / 2;
      guess.ya = clampY(mid);
      guess.yb = clampY(mid);
    }
    function loadPreset(i, keepAnnounceQuiet) {
      presetIdx = i;
      var p = PRESETS[i];
      pts = p.pts.map(function (q) { return { x: q[0], y: q[1] }; });
      selectedIdx = -1;
      setBoundsFromPts();
      sourceP.textContent = p.source;
      initGuess();
      paintAxes();
      rebuildPoints(null);
      paintDynamic();
      if (!keepAnnounceQuiet) {
        announce("נטענה הדוגמה: " + p.label + (stats && stats.ok ?
          ". " + eqString(stats.b0, stats.b1) : ""));
      }
    }
    function addPointAt(x, y, focus) {
      pts.push({ x: clampX(x), y: clampY(y) });
      rebuildPoints(focus ? pts.length - 1 : null);
      paintDynamic();
      announce("נוספה נקודה: x=" + fmt(x) + ", y=" + fmt(y) +
        (stats && stats.ok ? ". " + eqString(stats.b0, stats.b1) : ""));
    }
    function deletePoint(i) {
      if (i < 0 || i >= pts.length) return;
      pts.splice(i, 1);
      if (selectedIdx >= pts.length) selectedIdx = pts.length - 1;
      rebuildPoints(pts.length ? Math.min(i, pts.length - 1) : null);
      paintDynamic();
      announce("נקודה נמחקה. נותרו " + pts.length + " נקודות.");
    }

    /* ---------------- events ---------------- */
    select.addEventListener("change", function () {
      loadPreset(parseInt(select.value, 10) || 0);
    });
    resetBtn.addEventListener("click", function () {
      loadPreset(presetIdx);
    });
    addBtn.addEventListener("click", function () {
      addPointAt((bounds.xmin + bounds.xmax) / 2, (bounds.ymin + bounds.ymax) / 2, true);
    });
    delBtn.addEventListener("click", function () {
      if (!pts.length) return;
      deletePoint(selectedIdx >= 0 ? selectedIdx : pts.length - 1);
    });
    residBtn.addEventListener("click", function () {
      showResiduals = !showResiduals;
      setToggle(residBtn, showResiduals);
      paintDynamic();
    });
    guessBtn.addEventListener("click", function () {
      guessMode = !guessMode;
      setToggle(guessBtn, guessMode);
      showLsqBtn.hidden = !guessMode;
      if (guessMode) {
        showLsqInGuess = false;
        setToggle(showLsqBtn, false);
        initGuess();
        announce("מצב ניחוש: גררו את הידיות כדי לכוון את הקו, והשוו את סכום ריבועי השאריות לקו ה-LSQ.");
      }
      paintDynamic();
    });
    showLsqBtn.addEventListener("click", function () {
      showLsqInGuess = !showLsqInGuess;
      setToggle(showLsqBtn, showLsqInGuess);
      paintDynamic();
    });

    /* הוספת נקודה בלחיצה על הרקע */
    bgRect.addEventListener("click", function (e) {
      var w = worldFromEvent(e);
      addPointAt(w.x, w.y, false);
    });

    /* גרירת ידיות קו הניחוש */
    function bindHandle(handle, key) {
      handle.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        startDrag(handle, e, function (w) {
          guess[key] = clampY(w.y);
          paintDynamic();
        }, function () { announceGuess(); });
        try { handle.focus({ preventScroll: true }); } catch (err) { handle.focus(); }
      });
      handle.addEventListener("keydown", function (e) {
        var dy = (bounds.ymax - bounds.ymin) / 60 * (e.shiftKey ? 5 : 1);
        if (e.key === "ArrowUp") { guess[key] = clampY(guess[key] + dy); }
        else if (e.key === "ArrowDown") { guess[key] = clampY(guess[key] - dy); }
        else return;
        e.preventDefault();
        paintDynamic();
        announceGuess();
      });
    }
    bindHandle(handleA, "ya");
    bindHandle(handleB, "yb");

    /* גרירת גוף הקו (הזזה אנכית של שני הקצוות יחד) */
    guessHit.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var startYa = guess.ya, startYb = guess.yb;
      var startW = worldFromEvent(e);
      startDrag(guessHit, e, function (w) {
        var d = w.y - startW.y;
        guess.ya = clampY(startYa + d);
        guess.yb = clampY(startYb + d);
        paintDynamic();
      }, function () { announceGuess(); });
    });
    guessHit.addEventListener("keydown", function (e) {
      var dy = (bounds.ymax - bounds.ymin) / 60 * (e.shiftKey ? 5 : 1);
      if (e.key === "ArrowUp") { guess.ya = clampY(guess.ya + dy); guess.yb = clampY(guess.yb + dy); }
      else if (e.key === "ArrowDown") { guess.ya = clampY(guess.ya - dy); guess.yb = clampY(guess.yb - dy); }
      else return;
      e.preventDefault();
      paintDynamic();
      announceGuess();
    });
    function announceGuess() {
      if (!stats || !stats.ok) return;
      var gl = guessLine();
      announce("סכום ריבועי השאריות של הקו שלכם: " + fmt(sseFor(pts, gl.m, gl.b)) +
        ", ושל קו ה-LSQ: " + fmt(stats.sse));
    }

    /* ---------------- init ---------------- */
    loadPreset(0, true);
  }

  /* =====================================================================
     boot — לעולם לא זורק; שקט אם אין mount בעמוד.
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
