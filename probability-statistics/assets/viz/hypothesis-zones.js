/* =====================================================================
   hypothesis-zones.js — Module 11 "בדיקת השערות למדגם יחיד"
   Grounded in:
   - _notes/lec07-inference.md — H0/H1, חד-צדדי מול דו-צדדי (עמ' 3-5),
     קריטריון ההחלטה (בתוך תחום הטעות → מקבלים H0; מחוץ → דוחים H0
     ומקבלים H1), עבודה עם Z חיובי מטעמי סימטריה, Z(0.95)=1.645,
     Z(0.9)=1.28, מתי Z (שונות אוכלוסיה ידועה) ומתי t (שונות מדגם,
     df=n−1), t מתכנס ל-Z כשדרגות החופש גדלות.
   - _notes/class08-09.md עמ' 4 — טבלת t של סטודנט (VERBATIM): ערכי
     חלוקה חד-צדדיים מצטברים P(T ≤ t_p)=p, לפי דרגות חופש; שורת ∞
     נותנת את ערכי ה-Z המוכרים (1.282, 1.645, 1.960, 2.326, 2.576).
     בשורה df=1 בעמודת 0.975 מודפס במקור 12.709 (ולא 12.706) — הועתק
     כפי שמופיע במצגת.
   Cross-checks against the notes' own numbers:
     Z(0.95)=1.645 ✓ (α=0.05 חד-צדדי; α=0.10 דו-צדדי)
     Z(0.9)=1.28 בהרצאה ↔ 1.282 בשורת ∞ של טבלת התרגול ✓
     t(4, 0.95)=2.13 בהרצאה ↔ 2.132 בטבלה ✓
     t(9, 0.975)=2.26 בהרצאה ↔ 2.262 בטבלה ✓
     t(60, 0.9)=1.3 בהרצאה ↔ 1.296 בטבלה ✓
   ה-p-value אינו נלמד בהרצאה (המרצה מכריע דרך טעות הדגימה A /
   הערך הקריטי) — לכן הוא מוצג כאן בקופסת העשרה מסומנת בלבד,
   והפסק-דין הראשי נקבע בהשוואה לערך הקריטי, בשיטת המרצה.

   Vanilla JS, self-contained IIFE, no libraries. SVG with viewBox
   (responsive). Site tokens only (var(--accent) etc.) — works in both
   themes. RTL Hebrew UI; every number is LTR. Real buttons +
   aria-pressed, sliders are native <input type="range"> (keyboard OK),
   live verdict via aria-live.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "hypothesis-zones";

  /* =====================================================================
     DATA — טבלת t של סטודנט מתרגול 8 עמ' 4 (VERBATIM, כולל 12.709
     בשורה 1). עמודות: P(T ≤ t_p) = p. שורת ∞ = ערכי Z.
     בבורר דרגות החופש מוצגות רק שורות שמלואן תומלל וגם נכנסות לציר
     (df ≥ 4) — כדי לא להמציא ערכים ולא לשבור את קנה המידה.
     ===================================================================== */
  var PCOLS = [0.75, 0.90, 0.95, 0.975, 0.99, 0.995, 0.9995];
  var T_TABLE = {
    "1":   [1.000, 3.078, 6.314, 12.709, 31.821, 63.657, 636.619],
    "2":   [0.816, 1.886, 2.920, 4.303, 6.965, 9.925, 31.598],
    "3":   [0.765, 1.638, 2.353, 3.182, 4.541, 5.841, 12.941],
    "4":   [0.741, 1.533, 2.132, 2.776, 3.747, 4.604, 8.610],
    "5":   [0.727, 1.476, 2.015, 2.571, 3.365, 4.032, 6.859],
    "6":   [0.718, 1.440, 1.943, 2.447, 3.143, 3.707, 5.959],
    "7":   [0.711, 1.415, 1.895, 2.365, 2.998, 3.499, 5.405],
    "8":   [0.706, 1.397, 1.860, 2.306, 2.896, 3.355, 5.041],
    "9":   [0.703, 1.383, 1.833, 2.262, 2.821, 3.250, 4.781],
    "10":  [0.700, 1.372, 1.812, 2.228, 2.764, 3.169, 4.587],
    "11":  [0.697, 1.363, 1.796, 2.201, 2.718, 3.106, 4.437],
    "12":  [0.695, 1.356, 1.782, 2.179, 2.681, 3.055, 4.318],
    "40":  [0.681, 1.303, 1.684, 2.021, 2.423, 2.704, 3.551],
    "60":  [0.679, 1.296, 1.671, 2.000, 2.390, 2.660, 3.460],
    "120": [0.677, 1.289, 1.658, 1.980, 2.358, 2.617, 3.373],
    "inf": [0.674, 1.282, 1.645, 1.960, 2.326, 2.576, 3.291]
  };
  var DF_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 40, 60, 120];

  /* α slider: 3 מצבים. אינדקס → α, ועמודת ה-P המתאימה בטבלה:
     דו-צדדי: P = 1 − α/2 ; חד-צדדי: P = 1 − α (כמו בהרצאה עמ' 8). */
  var ALPHAS = [0.01, 0.05, 0.1];
  var COL_TWO = [5, 3, 2]; /* 0.995 / 0.975 / 0.95 */
  var COL_ONE = [4, 2, 1]; /* 0.99  / 0.95  / 0.90 */
  var COL_TWO_P = ["0.995", "0.975", "0.95"];
  var COL_ONE_P = ["0.99", "0.95", "0.90"];

  /* =====================================================================
     MATH — כלים חישוביים בלבד (לא תוכן): Φ מצטברת משמאל (כמו טבלת
     הקורס), צפיפות נורמלית ו-t לציור העקומה.
     ===================================================================== */
  var SQRT2PI = Math.sqrt(2 * Math.PI);

  function normPdf(x) { return Math.exp(-x * x / 2) / SQRT2PI; }

  /* Φ(z) — קירוב Abramowitz-Stegun 26.2.17, שגיאה < 7.5e-8:
     הערכים שמוצגים תואמים את טבלת Φ של החוברת ל-4 ספרות. */
  function phi(z) {
    if (z < 0) return 1 - phi(-z);
    var t = 1 / (1 + 0.2316419 * z);
    var poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 +
      t * (-1.821255978 + t * 1.330274429))));
    return 1 - normPdf(z) * poly;
  }

  /* log-gamma (Lanczos) — רק בשביל קבוע הנרמול של צפיפות t לציור. */
  function gammaln(x) {
    var g = [76.18009172947146, -86.50532032941677, 24.01409824083091,
      -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    var y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    var ser = 1.000000000190015;
    for (var j = 0; j < 6; j++) ser += g[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }

  function tPdf(x, v) {
    var c = Math.exp(gammaln((v + 1) / 2) - gammaln(v / 2)) / Math.sqrt(v * Math.PI);
    return c * Math.pow(1 + x * x / v, -(v + 1) / 2);
  }

  /* ---- number formatting (תמיד LTR, מינוס טיפוגרפי) ---- */
  function neg(s) { return String(s).replace(/-/g, "−"); }
  function f2(v) { return neg(v.toFixed(2)); }
  function f3(v) { return neg(v.toFixed(3)); }
  function f4(v) { return neg(v.toFixed(4)); }
  function trimNum(v) { return neg(String(parseFloat(v.toFixed(4)))); }
  function pct(a) { return trimNum((1 - a) * 100) + "%"; }

  /* =====================================================================
     STYLE (scoped, theme tokens only)
     ===================================================================== */
  var STYLE_ID = "hz-style";
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      ".viz-hz{direction:rtl}" +
      ".hz-lede{font-size:.88rem;color:var(--ink-soft);margin:0 0 .75rem;line-height:1.6}" +
      ".hz-controls{display:flex;flex-direction:column;gap:.55rem;margin-bottom:.7rem}" +
      ".hz-row{display:flex;flex-wrap:wrap;align-items:center;gap:.45rem .6rem}" +
      ".hz-row[hidden]{display:none}" +
      ".hz-row-label{font-weight:700;font-size:.85rem;color:var(--ink);min-width:104px}" +
      ".hz-btn{font-family:inherit;font-size:.82rem;font-weight:600;color:var(--ink);background:var(--surface-2);" +
      "border:1.5px solid var(--line);border-radius:99px;padding:.35rem .9rem;cursor:pointer}" +
      ".hz-btn[aria-pressed=\"true\"]{background:var(--accent);border-color:var(--accent);color:#fff}" +
      ".hz-btn:focus-visible,.hz-select:focus-visible,.hz-range:focus-visible{outline:2px solid var(--accent);outline-offset:2px}" +
      ".hz-select{font-family:var(--font-mono);font-size:.84rem;font-weight:600;color:var(--ink);background:var(--surface-2);" +
      "border:1.5px solid var(--line);border-radius:99px;padding:.32rem .8rem;cursor:pointer;direction:ltr}" +
      ".hz-range{direction:ltr;flex:1 1 170px;min-width:150px;max-width:330px;accent-color:var(--accent);cursor:pointer}" +
      ".hz-out{font-family:var(--font-mono);direction:ltr;unicode-bidi:isolate;font-weight:700;font-size:.88rem;" +
      "color:var(--accent);min-width:118px;text-align:left}" +
      ".hz-chart{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);" +
      "padding:.35rem;margin:.2rem 0 .75rem}" +
      ".viz-hz svg{width:100%;height:auto;display:block}" +
      ".hz-readout{display:flex;flex-direction:column;gap:.5rem}" +
      ".hz-line{font-size:.9rem;color:var(--ink);margin:0}" +
      ".hz-line b{color:var(--accent)}" +
      ".hz-num{direction:ltr;unicode-bidi:isolate;font-family:var(--font-mono);white-space:nowrap}" +
      ".hz-verdict{border:1.5px solid;border-radius:var(--radius-sm);padding:.6rem .85rem;font-size:.98rem;font-weight:800}" +
      ".hz-verdict.is-reject{border-color:var(--err);color:var(--err);" +
      "background:color-mix(in srgb,var(--err) 8%,var(--surface))}" +
      ".hz-verdict.is-accept{border-color:var(--sage);color:var(--ink);" +
      "background:color-mix(in srgb,var(--sage) 14%,var(--surface))}" +
      ".hz-verdict-detail{display:block;font-weight:600;font-size:.82rem;margin-top:.3rem;color:var(--ink-soft)}" +
      ".hz-enrich{border:1px dashed var(--line);border-inline-start:4px solid var(--mustard);" +
      "border-radius:var(--radius-sm);background:var(--surface-2);padding:.55rem .85rem;font-size:.85rem;" +
      "color:var(--ink);line-height:1.65}" +
      ".hz-enrich-title{font-weight:800;font-size:.78rem;color:var(--ink);margin:0 0 .25rem}" +
      ".hz-enrich p{margin:.15rem 0}";
    document.head.appendChild(s);
  }

  /* =====================================================================
     small DOM helpers
     ===================================================================== */
  function mk(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function num(s) { return '<span class="hz-num">' + s + "</span>"; }

  var UID = 0;

  /* =====================================================================
     chart geometry
     ===================================================================== */
  var W = 680, H = 330, ML = 26, MR = 26, AXIS_Y = 252, TOP = 42;
  var XMIN = -4.8, XMAX = 4.8;
  var YSCALE = (AXIS_Y - TOP) / 0.42;

  function X(v) { return ML + (v - XMIN) / (XMAX - XMIN) * (W - ML - MR); }
  function Y(p) { return AXIS_Y - p * YSCALE; }

  function curvePath(pdf) {
    var d = "", x;
    for (x = XMIN; x <= XMAX + 1e-9; x += 0.06) {
      d += (d ? "L" : "M") + X(x).toFixed(1) + " " + Y(pdf(x)).toFixed(1) + " ";
    }
    return d;
  }

  function areaPath(pdf, a, b) {
    a = Math.max(a, XMIN); b = Math.min(b, XMAX);
    if (b <= a) return "";
    var d = "M" + X(a).toFixed(1) + " " + AXIS_Y, x;
    for (x = a; x <= b + 1e-9; x += 0.05) {
      d += " L" + X(Math.min(x, b)).toFixed(1) + " " + Y(pdf(Math.min(x, b))).toFixed(1);
    }
    d += " L" + X(b).toFixed(1) + " " + AXIS_Y + " Z";
    return d;
  }

  /* =====================================================================
     Render one mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-hz-ready") === "1") return;
    mount.setAttribute("data-hz-ready", "1");
    mount.innerHTML = "";
    ensureStyle();

    var uid = "hz" + (++UID);

    /* state */
    var st = { type: "two", alphaIdx: 1, mode: "z", df: 9, obs: 1.8 };

    var root = mk("div", "viz-hz");

    root.appendChild(mk("p", "hz-lede",
      "עקומת הפעמון של סטטיסטי המבחן בהנחה ש-H<sub>0</sub> נכונה. בחרו סוג מבחן ורמת מובהקות " +
      "α — אזורי הדחייה נצבעים והערכים הקריטיים מסומנים; גררו את הסטטיסטי הנצפה וראו את פסק " +
      "הדין משתנה בזמן אמת. נסו לעבור בין חד-צדדי לדו-צדדי באותה α — הערך הקריטי משתנה, " +
      "והתשובה יכולה להתהפך (בדיוק המלכודת מהתרגול)."));

    /* ---------- controls ---------- */
    var controls = mk("div", "hz-controls");

    /* row 1: test type */
    var row1 = mk("div", "hz-row");
    row1.setAttribute("role", "group");
    row1.setAttribute("aria-label", "בחירת סוג המבחן");
    row1.appendChild(mk("span", "hz-row-label", "סוג המבחן:"));
    var typeDefs = [
      { key: "two", label: "דו-צדדי · " + num("H<sub>1</sub>: μ ≠ μ<sub>0</sub>") },
      { key: "right", label: "חד-צדדי ימני · " + num("H<sub>1</sub>: μ &gt; μ<sub>0</sub>") },
      { key: "left", label: "חד-צדדי שמאלי · " + num("H<sub>1</sub>: μ &lt; μ<sub>0</sub>") }
    ];
    var typeBtns = {};
    typeDefs.forEach(function (t) {
      var b = mk("button", "hz-btn", t.label);
      b.type = "button";
      b.setAttribute("aria-pressed", st.type === t.key ? "true" : "false");
      b.addEventListener("click", function () { st.type = t.key; paint(); });
      typeBtns[t.key] = b;
      row1.appendChild(b);
    });
    controls.appendChild(row1);

    /* row 2: statistic mode (Z / t) + df */
    var row2 = mk("div", "hz-row");
    row2.setAttribute("role", "group");
    row2.setAttribute("aria-label", "בחירת סטטיסטי המבחן");
    row2.appendChild(mk("span", "hz-row-label", "הסטטיסטי:"));
    var modeDefs = [
      { key: "z", label: num("Z") + " — שונות האוכלוסיה ידועה" },
      { key: "t", label: num("t") + " — שונות המדגם (" + num("S") + ")" }
    ];
    var modeBtns = {};
    modeDefs.forEach(function (m) {
      var b = mk("button", "hz-btn", m.label);
      b.type = "button";
      b.setAttribute("aria-pressed", st.mode === m.key ? "true" : "false");
      b.addEventListener("click", function () { st.mode = m.key; paint(); });
      modeBtns[m.key] = b;
      row2.appendChild(b);
    });
    var dfWrap = mk("span", "hz-row");
    var dfLbl = mk("label", "hz-row-label", "דרגות חופש:");
    dfLbl.htmlFor = uid + "-df";
    dfLbl.style.minWidth = "auto";
    var dfSel = document.createElement("select");
    dfSel.className = "hz-select";
    dfSel.id = uid + "-df";
    dfSel.setAttribute("aria-label", "בחירת דרגות חופש למבחן t, df שווה n פחות 1");
    DF_OPTIONS.forEach(function (d) {
      var o = document.createElement("option");
      o.value = String(d);
      o.textContent = "df = " + d + " (n = " + (d + 1) + ")";
      dfSel.appendChild(o);
    });
    dfSel.value = String(st.df);
    dfSel.addEventListener("change", function () { st.df = parseInt(dfSel.value, 10); paint(); });
    dfWrap.appendChild(dfLbl);
    dfWrap.appendChild(dfSel);
    row2.appendChild(dfWrap);
    controls.appendChild(row2);

    /* row 3: α slider */
    var row3 = mk("div", "hz-row");
    var aLbl = mk("label", "hz-row-label", "מובהקות α:");
    aLbl.htmlFor = uid + "-alpha";
    var aRange = document.createElement("input");
    aRange.type = "range";
    aRange.className = "hz-range";
    aRange.id = uid + "-alpha";
    aRange.min = "0"; aRange.max = "2"; aRange.step = "1";
    aRange.value = String(st.alphaIdx);
    aRange.setAttribute("aria-label", "רמת מובהקות אלפא");
    aRange.addEventListener("input", function () { st.alphaIdx = parseInt(aRange.value, 10); paint(); });
    var aOut = mk("span", "hz-out");
    row3.appendChild(aLbl);
    row3.appendChild(aRange);
    row3.appendChild(aOut);
    controls.appendChild(row3);

    /* row 4: observed statistic slider */
    var row4 = mk("div", "hz-row");
    var oLbl = mk("label", "hz-row-label", "הסטטיסטי הנצפה:");
    oLbl.htmlFor = uid + "-obs";
    var oRange = document.createElement("input");
    oRange.type = "range";
    oRange.className = "hz-range";
    oRange.id = uid + "-obs";
    oRange.min = "-4"; oRange.max = "4"; oRange.step = "0.05";
    oRange.value = String(st.obs);
    oRange.setAttribute("aria-label", "ערך סטטיסטי המבחן שהתקבל מהמדגם");
    oRange.addEventListener("input", function () { st.obs = parseFloat(oRange.value); paint(); });
    var oOut = mk("span", "hz-out");
    row4.appendChild(oLbl);
    row4.appendChild(oRange);
    row4.appendChild(oOut);
    controls.appendChild(row4);

    root.appendChild(controls);

    /* ---------- chart ---------- */
    var chartWrap = mk("div", "hz-chart");
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("aria-hidden", "true"); /* כל המידע קיים גם כטקסט חי מתחת */
    chartWrap.appendChild(svg);
    root.appendChild(chartWrap);

    /* ---------- readout ---------- */
    var readout = mk("div", "hz-readout");
    var hypLine = mk("p", "hz-line");
    var critLine = mk("p", "hz-line");
    var verdict = mk("div", "hz-verdict");
    verdict.setAttribute("aria-live", "polite");
    var enrich = mk("div", "hz-enrich");
    readout.appendChild(hypLine);
    readout.appendChild(critLine);
    readout.appendChild(verdict);
    readout.appendChild(enrich);
    root.appendChild(readout);

    mount.appendChild(root);

    /* =================================================================
       derived values
       ================================================================= */
    function critInfo() {
      var colIdx = (st.type === "two" ? COL_TWO : COL_ONE)[st.alphaIdx];
      var colP = (st.type === "two" ? COL_TWO_P : COL_ONE_P)[st.alphaIdx];
      var row = st.mode === "z" ? T_TABLE.inf : T_TABLE[String(st.df)];
      return { value: row[colIdx], colP: colP };
    }

    function isReject(crit) {
      if (st.type === "two") return Math.abs(st.obs) > crit;
      if (st.type === "right") return st.obs > crit;
      return st.obs < -crit;
    }

    /* one-sided p bracket from the t table row (שימוש בטבלה כמו במבחן) */
    function tBracket() {
      var row = T_TABLE[String(st.df)];
      var s = st.type === "two" ? Math.abs(st.obs) : (st.type === "right" ? st.obs : -st.obs);
      var mult = st.type === "two" ? 2 : 1;
      if (st.type !== "two" && s <= 0) {
        return "p &gt; 0.5";
      }
      var k = 0;
      while (k < PCOLS.length && row[k] < s) k++;
      if (k === 0) return "p &gt; " + trimNum(Math.min(mult * (1 - PCOLS[0]), 0.999));
      if (k === PCOLS.length) return "p &lt; " + trimNum(mult * (1 - PCOLS[PCOLS.length - 1]));
      var lo = mult * (1 - PCOLS[k]);
      var hi = mult * (1 - PCOLS[k - 1]);
      return trimNum(lo) + " &lt; p &lt; " + trimNum(hi);
    }

    /* =================================================================
       SVG markup (rebuilt on every paint)
       ================================================================= */
    function svgMarkup(crit) {
      var pdf = st.mode === "z" ? normPdf : function (x) { return tPdf(x, st.df); };
      var letter = st.mode === "z" ? "Z" : "t";
      var alpha = ALPHAS[st.alphaIdx];
      var parts = [];
      /* העמוד כולו RTL — טקסט SVG יורש את זה, לכן מספרים חייבים direction:ltr מפורש */
      var mono = "font-family:var(--font-mono);direction:ltr;";
      var ui = "font-family:var(--font-ui);";
      var i, x;

      /* rejection areas (מאחורי העקומה) */
      var zones = [];
      if (st.type === "two") { zones = [[crit, XMAX], [XMIN, -crit]]; }
      else if (st.type === "right") { zones = [[crit, XMAX]]; }
      else { zones = [[XMIN, -crit]]; }
      zones.forEach(function (zn) {
        parts.push('<path d="' + areaPath(pdf, zn[0], zn[1]) +
          '" style="fill:var(--err);fill-opacity:.28;stroke:var(--err);stroke-opacity:.5;stroke-width:1"/>');
      });

      /* axis + ticks */
      parts.push('<line x1="' + ML + '" y1="' + AXIS_Y + '" x2="' + (W - MR) + '" y2="' + AXIS_Y +
        '" style="stroke:var(--line);stroke-width:1.5"/>');
      for (i = -4; i <= 4; i++) {
        x = X(i);
        parts.push('<line x1="' + x.toFixed(1) + '" y1="' + AXIS_Y + '" x2="' + x.toFixed(1) + '" y2="' +
          (AXIS_Y + 5) + '" style="stroke:var(--line);stroke-width:1.5"/>');
        parts.push('<text x="' + x.toFixed(1) + '" y="' + (AXIS_Y + 19) +
          '" text-anchor="middle" style="' + mono + 'font-size:11px;fill:var(--ink-soft)">' +
          neg(String(i)) + "</text>");
      }

      /* curve */
      parts.push('<path d="' + curvePath(pdf) +
        '" style="fill:none;stroke:var(--ink);stroke-width:2"/>');

      /* caption: ההתפלגות תחת H0 — מעוגן לפינה הימנית; ב-direction:rtl
         נקודת ה-start היא הקצה הימני והטקסט נמשך שמאלה פנימה */
      var caption = st.mode === "z"
        ? "התפלגות Z תחת H₀"
        : "התפלגות t (df = " + st.df + ") תחת H₀";
      parts.push('<text x="' + (W - MR) + '" y="16" text-anchor="start" style="' + ui +
        'direction:rtl;font-size:12px;fill:var(--ink-soft)">' + caption + "</text>");

      /* critical lines + labels */
      var crits = st.type === "two" ? [crit, -crit] : (st.type === "right" ? [crit] : [-crit]);
      crits.forEach(function (c) {
        var cx = X(c);
        parts.push('<line x1="' + cx.toFixed(1) + '" y1="' + (TOP + 12) + '" x2="' + cx.toFixed(1) +
          '" y2="' + AXIS_Y + '" style="stroke:var(--err);stroke-width:1.5;stroke-dasharray:5 4"/>');
        parts.push('<text x="' + cx.toFixed(1) + '" y="' + (AXIS_Y + 35) +
          '" text-anchor="middle" style="' + mono +
          'font-size:12px;font-weight:700;fill:var(--err)">' +
          (c > 0 ? "+" : "−") + crit.toFixed(3) + "</text>");
      });

      /* tail labels: "דוחים את H0" + שטח הזנב */
      var tailArea = st.type === "two" ? "α/2 = " + trimNum(alpha / 2) : "α = " + trimNum(alpha);
      var tails = [];
      if (st.type === "two" || st.type === "right") tails.push(1);
      if (st.type === "two" || st.type === "left") tails.push(-1);
      tails.forEach(function (side) {
        var mid = side > 0 ? (crit + Math.min(crit + 1.6, XMAX)) / 2
                           : (-crit + Math.max(-crit - 1.6, XMIN)) / 2;
        var px = Math.max(64, Math.min(W - 64, X(mid)));
        parts.push('<text x="' + px.toFixed(1) + '" y="' + (AXIS_Y - 54) +
          '" text-anchor="middle" style="' + ui +
          'direction:rtl;font-size:11.5px;font-weight:700;fill:var(--err)">דוחים את H₀</text>');
        parts.push('<text x="' + px.toFixed(1) + '" y="' + (AXIS_Y - 38) +
          '" text-anchor="middle" style="' + mono + 'font-size:11.5px;fill:var(--err)">' +
          tailArea + "</text>");
      });

      /* acceptance-region label */
      var accMid = st.type === "right" ? (XMIN + crit) / 2 * 0.35
                  : st.type === "left" ? (XMAX - crit) / 2 * 0.35 : 0;
      parts.push('<text x="' + X(accMid).toFixed(1) + '" y="196" text-anchor="middle" style="' + ui +
        'direction:rtl;font-size:12.5px;fill:var(--ink-soft)">תחום הקבלה של H₀ (1 − α)</text>');

      /* observed statistic: marker line + dot + label */
      var ox = X(st.obs);
      parts.push('<line x1="' + ox.toFixed(1) + '" y1="46" x2="' + ox.toFixed(1) + '" y2="' + AXIS_Y +
        '" style="stroke:var(--accent);stroke-width:2;stroke-dasharray:2 3"/>');
      parts.push('<circle cx="' + ox.toFixed(1) + '" cy="' + AXIS_Y +
        '" r="5.5" style="fill:var(--accent);stroke:var(--surface);stroke-width:1.5"/>');
      var lx = Math.max(66, Math.min(W - 66, ox));
      parts.push('<text x="' + lx.toFixed(1) + '" y="38" text-anchor="middle" style="' + mono +
        'font-size:12.5px;font-weight:700;fill:var(--accent)">' +
        letter + " = " + f2(st.obs) + "</text>");

      return parts.join("");
    }

    /* =================================================================
       paint — pure function of state
       ================================================================= */
    function paint() {
      var alpha = ALPHAS[st.alphaIdx];
      var ci = critInfo();
      var crit = ci.value;
      var reject = isReject(crit);
      var letter = st.mode === "z" ? "Z" : "t";

      /* controls state */
      Object.keys(typeBtns).forEach(function (k) {
        typeBtns[k].setAttribute("aria-pressed", k === st.type ? "true" : "false");
      });
      Object.keys(modeBtns).forEach(function (k) {
        modeBtns[k].setAttribute("aria-pressed", k === st.mode ? "true" : "false");
      });
      dfWrap.hidden = st.mode !== "t";

      aOut.innerHTML = "α = " + trimNum(alpha) + " (" + pct(alpha) + ")";
      aRange.setAttribute("aria-valuetext",
        "אלפא " + trimNum(alpha) + ", רמת בטחון " + pct(alpha));
      oOut.innerHTML = letter + " = " + f2(st.obs);
      oRange.setAttribute("aria-valuetext", letter + " נצפה " + f2(st.obs));
      oLbl.innerHTML = "הסטטיסטי הנצפה (" + num(letter) + "):";

      /* chart */
      svg.innerHTML = svgMarkup(crit);

      /* hypotheses per test type */
      var h1sym = st.type === "two" ? "μ ≠ μ<sub>0</sub>"
                : st.type === "right" ? "μ &gt; μ<sub>0</sub>" : "μ &lt; μ<sub>0</sub>";
      var typeName = st.type === "two" ? "דו-צדדי" : (st.type === "right" ? "חד-צדדי ימני" : "חד-צדדי שמאלי");
      hypLine.innerHTML = "<b>השערות:</b> " + num("H<sub>0</sub>: μ = μ<sub>0</sub>") +
        " &nbsp;מול&nbsp; " + num("H<sub>1</sub>: " + h1sym) + " (" + typeName +
        ") — ניסוח " + num("H<sub>1</sub>") + " הוא שקובע אם המבחן חד-צדדי או דו-צדדי.";

      /* critical values line, בכתיב של המרצה: Z(שטח) / t(df, שטח) */
      var notation = st.mode === "z"
        ? letter + "(" + ci.colP + ") = " + f3(crit)
        : letter + "(" + st.df + ", " + ci.colP + ") = " + f3(crit);
      var critShow = st.type === "two" ? "±" + f3(crit)
                   : (st.type === "right" ? "+" + f3(crit) : "−" + f3(crit));
      var src = st.mode === "z"
        ? "שורת ∞ בטבלת t — ערכי ה-Z המוכרים"
        : "טבלת t של סטודנט, df = n − 1";
      critLine.innerHTML = "<b>ערך קריטי:</b> " + num(critShow) + " &nbsp;·&nbsp; " +
        num(notation) + " <span style='color:var(--ink-soft)'>(" + src + ")</span>";

      /* verdict, בלשון קריטריון ההחלטה של המרצה */
      var cmp;
      if (st.type === "two") {
        cmp = "|" + letter + "| = " + f2(Math.abs(st.obs)) +
          (reject ? " &gt; " : " ≤ ") + f3(crit);
      } else if (st.type === "right") {
        cmp = letter + " = " + f2(st.obs) + (reject ? " &gt; " : " ≤ ") + f3(crit);
      } else {
        cmp = letter + " = " + f2(st.obs) + (reject ? " &lt; " : " ≥ ") + "−" + f3(crit);
      }
      verdict.className = "hz-verdict " + (reject ? "is-reject" : "is-accept");
      if (reject) {
        verdict.innerHTML = "דוחים את H<sub>0</sub> ומקבלים את H<sub>1</sub>" +
          '<span class="hz-verdict-detail">' + num(cmp) +
          " — הסטטיסטי נפל באזור הדחייה: תוצאת המדגם מחוץ לתחום טעות הדגימה, השינוי מהותי (רמת בטחון " +
          pct(alpha) + ").</span>";
      } else {
        verdict.innerHTML = "מקבלים את H<sub>0</sub> (לא דוחים)" +
          '<span class="hz-verdict-detail">' + num(cmp) +
          " — הסטטיסטי בתוך תחום הקבלה: השינוי אינו מספיק מהותי ברמת בטחון " + pct(alpha) + ".</span>";
      }

      /* p-value — העשרה מסומנת (לא חלק משיטת ההכרעה של המרצה) */
      var pHtml;
      if (st.mode === "z") {
        var p, formula;
        if (st.type === "two") {
          p = 2 * (1 - phi(Math.abs(st.obs)));
          formula = "p = 2·(1 − Φ(|" + f2(st.obs) + "|)) = 2·(1 − " +
            f4(phi(Math.abs(st.obs))) + ")";
        } else if (st.type === "right") {
          p = 1 - phi(st.obs);
          formula = "p = 1 − Φ(" + f2(st.obs) + ") = 1 − " + f4(phi(st.obs));
        } else {
          p = phi(st.obs);
          formula = "p = Φ(" + f2(st.obs) + ")";
        }
        var pShow = p < 0.0001 ? "p &lt; 0.0001" : "p = " + f4(p);
        pHtml = "<p>" + num(formula) + " &nbsp;⇒&nbsp; <b>" + num(pShow) + "</b> " +
          (reject
            ? "— קטן מ-" + num("α = " + trimNum(alpha)) + ", מסקנה זהה: דוחים את H<sub>0</sub>."
            : "— גדול מ-" + num("α = " + trimNum(alpha)) + ", מסקנה זהה: מקבלים את H<sub>0</sub>.") +
          "</p>";
      } else {
        pHtml = "<p>טבלת t נותנת רק ערכי חלוקה בדידים, ולכן חוסמים את ה-p-value בין שתי עמודות " +
          "בשורה " + num("df = " + st.df) + ": &nbsp;<b>" + num(tBracket()) + "</b> — ולכן " +
          num("p " + (reject ? "&lt;" : "&gt;") + " α = " + trimNum(alpha)) +
          ", מסקנה זהה: " + (reject ? "דוחים" : "מקבלים") + " את H<sub>0</sub>.</p>";
      }
      enrich.innerHTML = '<p class="hz-enrich-title">העשרה — p-value (מעבר לחומר ההרצאה)</p>' +
        "<p>ה-p-value הוא שטח הזנב שמעבר לסטטיסטי הנצפה, מחושב עם Φ מצטברת משמאל כמו בטבלת " +
        "הקורס. הכלל: אם " + num("p ≤ α") + " דוחים את H<sub>0</sub> — שקול בדיוק לבדיקת המרצה " +
        "האם תוצאת המדגם נופלת מחוץ לתחום טעות הדגימה " + num("A") + " סביב ערך H<sub>0</sub>.</p>" +
        pHtml;
    }

    paint();
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
