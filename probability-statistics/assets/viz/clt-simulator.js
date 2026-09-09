/* =====================================================================
   clt-simulator.js — Module 09 "משפט הגבול המרכזי והתפלגות הממוצע"
   study-hub/probability-statistics — mounts on
   <div class="viz" data-viz="clt-simulator"></div>

   Grounding (מודול 09, MODULE_MAP):
   - _notes/class06-07.md עמ' 3 (תרגול 07): "אם n גדול מספיק (n>30~),
     התפלגות הדגימה של ממוצעים תתפלג בקירוב נורמלית ללא קשר לצורת
     ההתפלגות המקורית", עם תוחלת μ וטעות התקן σ/√n (לא σ!).
   - _notes/lec05-06-continuous-clt.md עמ' 8-10: ניסוח ה-CLT של המרצה
     (ממוצע מדגם: תוחלת μ, סטיית תקן σ/√m; כלל אצבע m≥35 או m≥40),
     סדרת שקיות הקמח: P(מעל 1010) = 15.87% לשקית בודדת → 2.28% לממוצע
     n=4 → 0 לממוצע n=25; תרגיל הבית — קוביה: תוחלת 3.5, שונות 2.9
     (בהרצאה; הערך המדויק 35/12 ≈ 2.917 מחושב כאן מה-pmf עצמו);
     ההתפלגות המעריכית עם תוחלת 5 (תרגיל אורך חיי הטלוויזיה, עמ' 2).

   כל הסטטיסטיקות (μ, σ, σ/√n, ממוצע/סטיית תקן אמפיריים, העקומה
   הנורמלית) מחושבות בקוד — אף מספר אינו מוקלד ידנית, כך שהגרפים
   לעולם לא סוטים מהמתמטיקה.

   Vanilla JS, IIFE, ללא ספריות. SVG עם viewBox (רספונסיבי). צבעים
   מ-CSS tokens בלבד (var(--accent) וכו') — עובד בשני ה-themes.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "clt-simulator";
  var SVG_NS = "http://www.w3.org/2000/svg";
  var SQRT2PI = Math.sqrt(2 * Math.PI);
  var NBINS = 80;          /* bins of the means histogram (fixed axis!) */
  var CURVE_PTS = 160;     /* sampling points for smooth curves */
  var BATCH = 1000;        /* "הגרל 1000 מדגמים" */
  var uid = 0;

  /* =====================================================================
     POPULATIONS — the three selectable distributions.
     die μ/σ² computed live from the pmf (lecture homework: תוחלת 3.5,
     שונות 2.9 — the exact value 35/12 falls out of the same sum).
     ===================================================================== */
  var DIE_FACES = [1, 2, 3, 4, 5, 6];
  var dieMu = DIE_FACES.reduce(function (s, x) { return s + x / 6; }, 0);
  var dieVar = DIE_FACES.reduce(function (s, x) { return s + (x - dieMu) * (x - dieMu) / 6; }, 0);

  var DISTS = [
    {
      key: "uniform",
      btn: "אחידה רציפה",
      title: "התפלגות אחידה רציפה בתחום 0–10",
      mu: 5, sigma: 10 / Math.sqrt(12),
      min: 0, max: 10, ticks: [0, 2, 4, 6, 8, 10],
      kind: "pdf",
      pdf: function (x) { return (x >= 0 && x <= 10) ? 0.1 : 0; },
      sample: function () { return Math.random() * 10; },
      note: "כל ערך בתחום סביר באותה צפיפות — צורה שטוחה לגמרי, רחוקה מפעמון."
    },
    {
      key: "skewed",
      btn: "מוטה (מעריכית)",
      title: "התפלגות מעריכית (Exponential) עם תוחלת 5",
      mu: 5, sigma: 5,
      min: 0, max: 25, ticks: [0, 5, 10, 15, 20, 25],
      kind: "pdf",
      pdf: function (x) { return x >= 0 ? Math.exp(-x / 5) / 5 : 0; },
      sample: function () { return -5 * Math.log(1 - Math.random()); },
      note: "מוטה חזק ימינה (כמו אורך חיי הטלוויזיה מההרצאה: תוחלת 5) — רוב הערכים קטנים וזנב ארוך."
    },
    {
      key: "die",
      btn: "קוביה בדידה",
      title: "קוביה הוגנת — התפלגות אחידה בדידה על 1–6",
      mu: dieMu, sigma: Math.sqrt(dieVar),
      min: 0.5, max: 6.5, ticks: [1, 2, 3, 4, 5, 6],
      kind: "pmf",
      faces: DIE_FACES, p: 1 / 6,
      sample: function () { return Math.floor(Math.random() * 6) + 1; },
      note: "תרגיל הבית מההרצאה: תוחלת 3.5, שונות 35/12 ≈ 2.917 (בהרצאה עוגל ל-2.9)."
    }
  ];

  /* ===================================================================== */
  function normalPdf(x, mu, se) {
    var z = (x - mu) / se;
    return Math.exp(-0.5 * z * z) / (se * SQRT2PI);
  }
  function fmt(n, d) {
    if (!isFinite(n)) return "—";
    return n.toFixed(d == null ? 3 : d);
  }
  function thousands(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function ltrNum(html) { return '<span class="clt-num">' + html + "</span>"; }
  function mk(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function svgEl(tag, attrs) {
    var e = document.createElementNS(SVG_NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  /* =====================================================================
     STYLE — scoped, theme tokens only (light+dark both work).
     ===================================================================== */
  var STYLE_ID = "clt-sim-style";
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      ".viz-clt{direction:rtl}" +
      ".clt-lede{font-size:.88rem;color:var(--ink-soft);line-height:1.65;margin:0 0 .7rem}" +
      ".clt-lede b{color:var(--ink)}" +
      ".clt-row{display:flex;flex-wrap:wrap;gap:.5rem .9rem;align-items:center;margin:.3rem 0 .45rem}" +
      ".clt-lab{font-weight:700;font-size:.85rem;color:var(--ink)}" +
      ".clt-seg{display:flex;flex-wrap:wrap;gap:.45rem}" +
      ".clt-slider{width:min(240px,58vw);accent-color:var(--accent);cursor:pointer}" +
      ".clt-slider:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:4px}" +
      ".clt-n-badge{font-family:var(--font-mono);font-size:.85rem;font-weight:700;color:var(--accent);" +
      "direction:ltr;unicode-bidi:isolate;min-width:4.5ch;display:inline-block;text-align:left}" +
      ".clt-num{font-family:var(--font-mono);direction:ltr;unicode-bidi:isolate;font-size:.95em}" +
      ".clt-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);" +
      "padding:.7rem .9rem;margin-top:.75rem}" +
      ".clt-card h4{margin:0 0 .2rem;font-size:.9rem;color:var(--ink)}" +
      ".clt-params{font-size:.79rem;color:var(--ink-soft);margin:.05rem 0 .4rem;line-height:1.6}" +
      ".clt-chart{direction:ltr}" +
      ".clt-chart svg{display:block;width:100%;height:auto}" +
      ".clt-axis{stroke:var(--line);stroke-width:1.5}" +
      ".clt-tick{stroke:var(--line);stroke-width:1}" +
      ".clt-ticktext{fill:var(--ink-soft);font-size:11px;font-family:var(--font-mono)}" +
      ".clt-pop-area{fill:var(--accent);fill-opacity:.16;stroke:var(--accent);stroke-width:2.25;stroke-linejoin:round}" +
      ".clt-pop-bar{fill:var(--accent);fill-opacity:.4;stroke:var(--accent);stroke-width:1.5}" +
      ".clt-bar{fill:var(--accent);fill-opacity:.6}" +
      ".clt-curve{fill:none;stroke:var(--clay);stroke-width:2.5;stroke-linejoin:round}" +
      ".clt-mu{stroke:var(--ink-soft);stroke-width:1.5;stroke-dasharray:5 4}" +
      ".clt-mu-label{fill:var(--ink-soft);font-size:12px;font-weight:700;font-family:var(--font-mono)}" +
      ".clt-legend{display:flex;flex-wrap:wrap;gap:.3rem 1.1rem;font-size:.76rem;color:var(--ink-soft);margin-top:.35rem}" +
      ".clt-legend span{display:inline-flex;align-items:center;gap:.35rem}" +
      ".clt-sw{display:inline-block;width:13px;height:13px;border-radius:3px;flex:none}" +
      ".clt-sw-hist{background:var(--accent);opacity:.65}" +
      ".clt-sw-norm{background:var(--clay)}" +
      ".clt-sw-pop{background:var(--accent);opacity:.3;border:1.5px solid var(--accent)}" +
      ".clt-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:.6rem}" +
      ".clt-col{background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:.55rem .75rem}" +
      ".clt-col h5{margin:0 0 .35rem;font-size:.78rem;font-weight:800;color:var(--accent);letter-spacing:.02em}" +
      ".clt-line{font-size:.83rem;color:var(--ink);margin:.18rem 0;line-height:1.55}" +
      ".clt-sample{font-size:.8rem;color:var(--ink);margin:.45rem 0 0;line-height:1.6}" +
      ".clt-note{font-size:.75rem;color:var(--ink-soft);margin:.45rem 0 0}" +
      ".clt-insight{border-inline-start:4px solid var(--accent)}" +
      ".clt-insight p{font-size:.83rem;color:var(--ink);line-height:1.7;margin:.2rem 0 0}";
    document.head.appendChild(s);
  }

  /* =====================================================================
     Render one mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-clt-ready") === "1") return;
    mount.setAttribute("data-clt-ready", "1");
    mount.innerHTML = "";
    ensureStyle();

    /* ---------------- state ---------------- */
    var dist = DISTS[0];
    var nSize = 25;
    var m = 0, sum = 0, sumSq = 0;      /* accumulators over sample MEANS */
    var bins = [];                       /* fixed-axis histogram of means */
    var lastSample = null;               /* {vals:[...first 10], mean, n} */

    function resetMeans() {
      m = 0; sum = 0; sumSq = 0; lastSample = null;
      bins = [];
      for (var i = 0; i < NBINS; i++) bins.push(0);
    }
    resetMeans();

    function stderr() { return dist.sigma / Math.sqrt(nSize); }

    function drawSamples(count) {
      for (var k = 0; k < count; k++) {
        var s = 0;
        var keep = (count === 1) ? [] : null;
        for (var i = 0; i < nSize; i++) {
          var v = dist.sample();
          s += v;
          if (keep && keep.length < 10) keep.push(v);
        }
        var mean = s / nSize;
        m++; sum += mean; sumSq += mean * mean;
        /* ממוצע מחוץ לציר (זנב המעריכית ב-n קטן) לא מצויר — בלי לזייף
           spike בעמודת הקצה; הוא עדיין נספר בסטטיסטיקה האמפירית. */
        var idx = Math.floor((mean - dist.min) / (dist.max - dist.min) * NBINS);
        if (idx >= 0 && idx < NBINS) bins[idx]++;
        if (keep) lastSample = { vals: keep, mean: mean, n: nSize };
      }
      if (count > 1) lastSample = null;
      paintMeans(); paintStats();
    }

    /* ---------------- skeleton ---------------- */
    var root = mk("div", "viz-clt");

    root.appendChild(mk("p", "clt-lede",
      "<b>משפט הגבול המרכזי (Central Limit Theorem):</b> אם " + ltrNum("n") +
      " גדול מספיק (כלל אצבע מהתרגול: " + ltrNum("n > 30~") +
      "; בהרצאה הוזכרו גם " + ltrNum("35") + " או " + ltrNum("40") +
      "), התפלגות הדגימה של הממוצעים " + ltrNum("x̄") +
      " תתפלג בקירוב נורמלית — ללא קשר לצורת ההתפלגות המקורית — עם תוחלת " +
      ltrNum("μ") + " וטעות התקן " + ltrNum("σ/√n") +
      " (לא " + ltrNum("σ") + "!). בחרו אוכלוסיה, קבעו " + ltrNum("n") +
      ", והגרילו מדגמים: ההיסטוגרמה של הממוצעים תתלבש על העקומה הנורמלית, ותתחדד ככל ש-" +
      ltrNum("n") + " גדל."));

    /* --- distribution picker (real buttons, aria-pressed) --- */
    var rowDist = mk("div", "clt-row");
    rowDist.appendChild(mk("span", "clt-lab", "התפלגות האוכלוסיה:"));
    var seg = mk("div", "clt-seg");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "בחירת התפלגות האוכלוסיה");
    var distBtns = {};
    DISTS.forEach(function (d) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn";
      b.textContent = d.btn;
      b.setAttribute("aria-pressed", d === dist ? "true" : "false");
      if (d === dist) b.classList.add("primary");
      b.addEventListener("click", function () {
        if (dist === d) return;
        dist = d;
        DISTS.forEach(function (o) {
          distBtns[o.key].classList.toggle("primary", o === dist);
          distBtns[o.key].setAttribute("aria-pressed", o === dist ? "true" : "false");
        });
        resetMeans();
        paintPopulation(); paintMeans(); paintStats();
      });
      distBtns[d.key] = b;
      seg.appendChild(b);
    });
    rowDist.appendChild(seg);
    root.appendChild(rowDist);

    /* --- n slider --- */
    var rowN = mk("div", "clt-row");
    var sliderId = "clt-n-" + (++uid);
    var sliderLab = mk("label", "clt-lab", "גודל מדגם " + ltrNum("n") + ":");
    sliderLab.htmlFor = sliderId;
    var slider = document.createElement("input");
    slider.type = "range";
    slider.min = "1"; slider.max = "100"; slider.step = "1";
    slider.value = String(nSize);
    slider.id = sliderId;
    slider.className = "clt-slider";
    slider.setAttribute("aria-label", "גודל מדגם n, בין 1 ל-100");
    var nBadge = mk("span", "clt-n-badge", "n = " + nSize);
    slider.addEventListener("input", function () {
      nSize = parseInt(slider.value, 10) || 1;
      nBadge.textContent = "n = " + nSize;
      resetMeans();
      paintMeans(); paintStats();
    });
    rowN.appendChild(sliderLab);
    rowN.appendChild(slider);
    rowN.appendChild(nBadge);
    root.appendChild(rowN);

    /* --- action buttons --- */
    var rowBtns = mk("div", "clt-row");
    var btnOne = document.createElement("button");
    btnOne.type = "button";
    btnOne.className = "viz-btn";
    btnOne.textContent = "הגרל מדגם אחד";
    btnOne.setAttribute("aria-label", "הגרלת מדגם אחד בגודל n והוספת הממוצע שלו להיסטוגרמה");
    btnOne.addEventListener("click", function () { drawSamples(1); });
    var btnMany = document.createElement("button");
    btnMany.type = "button";
    btnMany.className = "viz-btn primary";
    btnMany.textContent = "הגרל " + thousands(BATCH) + " מדגמים";
    btnMany.setAttribute("aria-label", "הגרלת " + BATCH + " מדגמים בבת אחת");
    btnMany.addEventListener("click", function () { drawSamples(BATCH); });
    var btnReset = document.createElement("button");
    btnReset.type = "button";
    btnReset.className = "viz-btn";
    btnReset.textContent = "איפוס";
    btnReset.setAttribute("aria-label", "איפוס היסטוגרמת הממוצעים");
    btnReset.addEventListener("click", function () {
      resetMeans();
      paintMeans(); paintStats();
    });
    rowBtns.appendChild(btnOne);
    rowBtns.appendChild(btnMany);
    rowBtns.appendChild(btnReset);
    root.appendChild(rowBtns);
    root.appendChild(mk("p", "clt-note",
      "שינוי ההתפלגות או " + ltrNum("n") + " מאפס את ההיסטוגרמה (ממוצעים מ-" +
      ltrNum("n") + " שונים אינם שייכים לאותה התפלגות דגימה)."));

    /* --- chart 1: population --- */
    var W = 640, H = 210, ML = 16, MR = 16, MT = 20, MB = 28;
    var popCard = mk("div", "clt-card");
    var popTitle = mk("h4", null, "");
    popCard.appendChild(popTitle);
    var popParams = mk("p", "clt-params", "");
    popCard.appendChild(popParams);
    var popWrap = mk("div", "clt-chart");
    var popSvg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, "aria-hidden": "true", focusable: "false" });
    popWrap.appendChild(popSvg);
    popCard.appendChild(popWrap);
    popCard.appendChild(mk("div", "clt-legend",
      '<span><i class="clt-sw clt-sw-pop"></i>התפלגות האוכלוסיה</span>' +
      '<span>קו מקווקו — התוחלת ' + ltrNum("μ") + "</span>"));
    root.appendChild(popCard);

    /* --- chart 2: histogram of means + normal overlay --- */
    var meansCard = mk("div", "clt-card");
    meansCard.appendChild(mk("h4", null,
      "התפלגות הדגימה של הממוצעים " + ltrNum("x̄") + " (אותו ציר בדיוק!)"));
    var meansHint = mk("p", "clt-params",
      "העקומה: הנורמלית התיאורטית " + ltrNum("N(μ, σ/√n)") +
      " לפי ה-CLT. הגרילו מדגמים כדי למלא את ההיסטוגרמה מתחתיה.");
    meansCard.appendChild(meansHint);
    var meansWrap = mk("div", "clt-chart");
    var meansSvg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, "aria-hidden": "true", focusable: "false" });
    meansWrap.appendChild(meansSvg);
    meansCard.appendChild(meansWrap);
    meansCard.appendChild(mk("div", "clt-legend",
      '<span><i class="clt-sw clt-sw-hist"></i>ממוצעי המדגמים שהוגרלו</span>' +
      '<span><i class="clt-sw clt-sw-norm"></i>נורמלית תיאורטית ' + ltrNum("N(μ, σ/√n)") + "</span>" +
      '<span>קו מקווקו — ' + ltrNum("μ") + "</span>"));
    root.appendChild(meansCard);

    /* --- stats compare card (aria-live) --- */
    var statsCard = mk("div", "clt-card");
    statsCard.setAttribute("aria-live", "polite");
    var statsGrid = mk("div", "clt-stats");
    var colTheory = mk("div", "clt-col");
    var colEmp = mk("div", "clt-col");
    statsGrid.appendChild(colTheory);
    statsGrid.appendChild(colEmp);
    statsCard.appendChild(statsGrid);
    var sampleLine = mk("p", "clt-sample", "");
    statsCard.appendChild(sampleLine);
    root.appendChild(statsCard);

    /* --- grounded insight (the lecture's flour-bags series) --- */
    var insight = mk("div", "clt-card clt-insight");
    insight.appendChild(mk("h4", null, "ההדגמה מההרצאה — סדרת שקיות הקמח"));
    insight.appendChild(mk("p", null,
      "באותה שאלה בדיוק (" + ltrNum("μ = 1000, σ = 10") +
      ") ההסתברות למשקל מעל " + ltrNum("1010") + " גרם הצטמקה ככל ש-" + ltrNum("n") +
      " גדל: שקית בודדת (" + ltrNum("σ/√1 = 10") + ") — " + ltrNum("15.87%") +
      "; ממוצע " + ltrNum("n = 4") + " (" + ltrNum("σ/√4 = 5") + ") — " + ltrNum("2.28%") +
      "; ממוצע " + ltrNum("n = 25") + " (" + ltrNum("σ/√25 = 2") + ") — " + ltrNum("0") +
      ". זה בדיוק מה שרואים כאן: טעות התקן " + ltrNum("σ/√n") +
      " קטנה, וההיסטוגרמה מתחדדת סביב " + ltrNum("μ") + "."));
    root.appendChild(insight);

    mount.appendChild(root);

    /* =================================================================
       geometry helpers (shared by both charts)
       ================================================================= */
    var plotW = W - ML - MR, plotH = H - MT - MB;
    function X(v) { return ML + (v - dist.min) / (dist.max - dist.min) * plotW; }
    function Y(t) { return H - MB - t * plotH; }  /* t in [0,1] */

    function drawAxis(svg) {
      svg.appendChild(svgEl("line", {
        x1: ML, y1: H - MB, x2: W - MR, y2: H - MB, "class": "clt-axis"
      }));
      dist.ticks.forEach(function (tv) {
        var x = X(tv);
        svg.appendChild(svgEl("line", { x1: x, y1: H - MB, x2: x, y2: H - MB + 5, "class": "clt-tick" }));
        var t = svgEl("text", { x: x, y: H - MB + 18, "text-anchor": "middle", "class": "clt-ticktext" });
        t.textContent = String(tv);
        svg.appendChild(t);
      });
    }
    function drawMuLine(svg) {
      var x = X(dist.mu);
      svg.appendChild(svgEl("line", { x1: x, y1: MT - 4, x2: x, y2: H - MB, "class": "clt-mu" }));
      var t = svgEl("text", { x: x + 5, y: MT + 8, "class": "clt-mu-label" });
      t.textContent = "μ";
      svg.appendChild(t);
    }

    /* =================================================================
       chart 1 — population (repainted on distribution change only)
       ================================================================= */
    function paintPopulation() {
      popSvg.innerHTML = "";
      drawAxis(popSvg);

      if (dist.kind === "pdf") {
        var maxP = 0, pts = [], i, x, p;
        for (i = 0; i <= CURVE_PTS; i++) {
          x = dist.min + (dist.max - dist.min) * i / CURVE_PTS;
          p = dist.pdf(x);
          if (p > maxP) maxP = p;
          pts.push([x, p]);
        }
        var d = "M " + X(dist.min) + " " + Y(0);
        pts.forEach(function (pt) {
          d += " L " + X(pt[0]).toFixed(2) + " " + Y(pt[1] / maxP * 0.9).toFixed(2);
        });
        d += " L " + X(dist.max) + " " + Y(0) + " Z";
        popSvg.appendChild(svgEl("path", { d: d, "class": "clt-pop-area" }));
      } else {
        /* pmf — six bars of 1/6 */
        var bw = plotW / (dist.max - dist.min) * 0.6; /* 0.6 value-units wide */
        dist.faces.forEach(function (f) {
          popSvg.appendChild(svgEl("rect", {
            x: (X(f) - bw / 2).toFixed(2),
            y: Y(0.9).toFixed(2),
            width: bw.toFixed(2),
            height: (Y(0) - Y(0.9)).toFixed(2),
            rx: 3,
            "class": "clt-pop-bar"
          }));
        });
      }
      drawMuLine(popSvg);

      popTitle.innerHTML = "התפלגות האוכלוסיה — " + dist.title;
      popParams.innerHTML = dist.note + "<br>" +
        "פרמטרי האוכלוסיה: " +
        ltrNum("μ = " + fmt(dist.mu, 3)) + " · " +
        ltrNum("σ² = " + fmt(dist.sigma * dist.sigma, 3)) + " · " +
        ltrNum("σ = " + fmt(dist.sigma, 3));
    }

    /* =================================================================
       chart 2 — histogram of means + theoretical N(μ, σ/√n)
       ================================================================= */
    function paintMeans() {
      meansSvg.innerHTML = "";
      drawAxis(meansSvg);

      var se = stderr();
      var binW = (dist.max - dist.min) / NBINS;
      var maxCount = 0, i;
      for (i = 0; i < NBINS; i++) if (bins[i] > maxCount) maxCount = bins[i];

      var yMax; /* in "counts" */
      var expectedPeak = m * binW * normalPdf(dist.mu, dist.mu, se);
      if (m > 0) {
        yMax = Math.max(maxCount, expectedPeak, 1) * 1.06;
      } else {
        yMax = 1; /* curve drawn normalized below */
      }

      /* histogram bars */
      if (m > 0) {
        var pxW = plotW / NBINS;
        for (i = 0; i < NBINS; i++) {
          if (!bins[i]) continue;
          var t = bins[i] / yMax;
          meansSvg.appendChild(svgEl("rect", {
            x: (ML + i * pxW).toFixed(2),
            y: Y(t).toFixed(2),
            width: Math.max(pxW - 0.5, 0.8).toFixed(2),
            height: (Y(0) - Y(t)).toFixed(2),
            "class": "clt-bar"
          }));
        }
      }

      /* theoretical normal curve on the same count scale
         (expected count per bin = m · binWidth · φ(x)) */
      var d = "";
      for (i = 0; i <= CURVE_PTS; i++) {
        var x = dist.min + (dist.max - dist.min) * i / CURVE_PTS;
        var val = normalPdf(x, dist.mu, se);
        var t2 = (m > 0)
          ? (m * binW * val) / yMax
          : val / normalPdf(dist.mu, dist.mu, se) * 0.85;
        if (t2 > 1) t2 = 1;
        d += (i === 0 ? "M " : " L ") + X(x).toFixed(2) + " " + Y(t2).toFixed(2);
      }
      meansSvg.appendChild(svgEl("path", { d: d, "class": "clt-curve" }));

      drawMuLine(meansSvg);
      meansHint.hidden = (m > 0);
    }

    /* =================================================================
       stats compare — theory vs simulation (all computed live)
       ================================================================= */
    function paintStats() {
      var se = stderr();
      colTheory.innerHTML =
        "<h5>תיאורטי לפי ה-CLT</h5>" +
        '<p class="clt-line">תוחלת התפלגות הדגימה: ' + ltrNum("μ = " + fmt(dist.mu, 3)) + "</p>" +
        '<p class="clt-line">טעות התקן: ' +
        ltrNum("σ/√n = " + fmt(dist.sigma, 3) + "/√" + nSize + " = " + fmt(se, 3)) + "</p>";

      var empHtml = "<h5>אמפירי מהסימולציה</h5>" +
        '<p class="clt-line">מדגמים שהוגרלו: ' + ltrNum("m = " + thousands(m)) + "</p>";
      if (m > 0) {
        var mean = sum / m;
        var varr = sumSq / m - mean * mean;
        if (varr < 0) varr = 0;
        empHtml +=
          '<p class="clt-line">ממוצע הממוצעים: ' + ltrNum(fmt(mean, 3)) +
          " (מול " + ltrNum("μ = " + fmt(dist.mu, 3)) + ")</p>" +
          '<p class="clt-line">סטיית התקן של הממוצעים: ' + ltrNum(fmt(Math.sqrt(varr), 3)) +
          " (מול " + ltrNum("σ/√n = " + fmt(se, 3)) + ")</p>";
      } else {
        empHtml += '<p class="clt-line">עוד לא הוגרלו מדגמים — לחצו על אחד הכפתורים למעלה.</p>';
      }
      colEmp.innerHTML = empHtml;

      if (lastSample) {
        var isDiscrete = (dist.kind === "pmf");
        var shown = lastSample.vals.map(function (v) {
          return isDiscrete ? String(v) : fmt(v, 2);
        }).join(", ");
        var more = lastSample.n > lastSample.vals.length ? ", …" : "";
        sampleLine.hidden = false;
        sampleLine.innerHTML =
          "המדגם האחרון (" + ltrNum("n = " + lastSample.n) + "): " +
          ltrNum(shown + more) + " ← הממוצע שנוסף להיסטוגרמה: " +
          ltrNum("x̄ = " + fmt(lastSample.mean, 3));
      } else {
        sampleLine.hidden = true;
        sampleLine.innerHTML = "";
      }
    }

    paintPopulation();
    paintMeans();
    paintStats();
  }

  /* =====================================================================
     boot — mount all instances; never throw.
     ===================================================================== */
  function boot() {
    try {
      var mounts = document.querySelectorAll('[data-viz="' + VIZ_ID + '"]');
      if (!mounts || !mounts.length) return;
      Array.prototype.forEach.call(mounts, function (mo) { render(mo); });
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
