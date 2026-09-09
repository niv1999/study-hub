/* =====================================================================
   normal-explorer.js — מעבדת ההתפלגות הנורמלית
   Grounded in _notes/lec05-06-continuous-clt.md (עמ' 3-9) +
   _notes/booklet-part1.md (שאלה 7 — "קמחי") + booklet-part2.md (טבלת Φ):

   - ציון תקן: z = (x − μ)/σ — "מספר סטיות תקן מן המרכז" (עמ' 3).
   - Φ(z) = השטח מן הקצה השמאלי ועד z; הטבלה נותנת z בדיוק של מאות
     וערכי שטח בדיוק של 4 ספרות (עמ' 3-4).
   - ערכים שליליים: Φ(−z) = 1 − Φ(z) (עמ' 3, ותרגיל 2 סעיף ד).
   - שאלה הפוכה: נתון שטח → מחפשים אותו בגוף הטבלה ומתאימים לו z,
     ואז x = μ + z·σ (עמ' 4, ותרגיל 2 סעיף ו: Φ=0.99 → z=2.33 → X=198.3).
   - z גדול: "הערכים בטבלה נגמרים" והזנב אפסי (עמ' 8, Φ(5)=1).
   - presets מהקורס: גבהים μ=175 σ=10 (עמ' 3-7); שקית קמח μ=1000 σ=10
     (עמ' 8-9); חוברת שאלה 7 "קמחי" μ=350 σ=3.

   Φ מחושבת עם קירוב erf מדויק (Abramowitz-Stegun 7.1.26, שגיאה
   ‎<1.5e-7‎) ומעוגלת ל-4 ספרות — כך שהערכים המוצגים זהים לטבלת
   booklet-part2 (0.8413, 0.9332, 0.9772...). המצב ההפוך מדמה חיפוש
   בגוף הטבלה: z הקרוב ביותר בדיוק של מאיות, בדיוק כמו שהמרצה עושה.

   Self-contained IIFE, vanilla JS. צבעים מ-CSS tokens בלבד
   (var(--accent) וכו') כדי ששני ה-themes יעבדו. SVG עם viewBox —
   רספונסיבי. ידיות a,b נגררות בעכבר/מגע וגם נגישות במקלדת
   (role="slider" + חצים).
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "normal-explorer";
  var SQRT2PI = Math.sqrt(2 * Math.PI);

  /* =====================================================================
     Presets — הדוגמאות מהקורס (ראו grounding בכותרת) + נורמלית סטנדרטית
     (הטבלה עצמה).
     ===================================================================== */
  var PRESETS = [
    { id: "heights", he: "גבהים (הרצאה)", mu: 175, sigma: 10 },
    { id: "flour", he: "שקית קמח (הרצאה)", mu: 1000, sigma: 10 },
    { id: "kimhi", he: "שקיות \"קמחי\" (חוברת)", mu: 350, sigma: 3 },
    { id: "std", he: "נורמלית סטנדרטית", mu: 0, sigma: 1 }
  ];

  /* =====================================================================
     Maths — Φ via erf (A&S 7.1.26), table-emulation helpers.
     ===================================================================== */
  function erf(x) {
    var sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return sign * y;
  }
  function phi(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
  function round4(v) { return Math.round(v * 10000) / 10000; }

  /* Φ "כמו מהטבלה": עיגול ל-4 ספרות; עבור z שלילי — בדיוק בשיטת המרצה,
     1 − Φ(|z|), כך שהאריתמטיקה המוצגת תמיד מתאזנת. */
  function tablePhi(zr) {
    if (zr >= 0) return round4(phi(zr));
    return round4(1 - round4(phi(-zr)));
  }

  /* חיפוש הפוך בגוף הטבלה: עבור שטח p ≥ 0.5 מחזיר את ה-z (בדיוק של
     מאיות, עד 3.49 — קצה הטבלה) שערך Φ שלו הקרוב ביותר ל-p. */
  function tableZ(p) {
    var best = 0, bestD = Infinity;
    for (var zi = 0; zi <= 349; zi++) {
      var z = zi / 100;
      var d = Math.abs(round4(phi(z)) - p);
      if (d < bestD - 1e-12) { bestD = d; best = z; }
    }
    return best;
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /* ---- formatting: numbers LTR, minus = U+2212, Φ always 4 digits ---- */
  function fmtX(v) {
    var r = Math.round(v * 100) / 100;
    var s = String(Math.abs(r));
    return (r < 0 ? "−" : "") + s;
  }
  function fmtZ(z) {
    return (z < 0 ? "−" : "") + Math.abs(z).toFixed(2);
  }
  function fmtP(p) { return p.toFixed(4); }

  /* =====================================================================
     Scoped style — theme tokens only.
     ===================================================================== */
  var STYLE_ID = "nx-style";
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      ".nx-root{direction:rtl}" +
      ".nx-lede{font-size:.88rem;color:var(--ink-soft);margin:0 0 .8rem;line-height:1.6}" +
      ".nx-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);padding:.85rem 1rem;margin-top:.9rem}" +
      ".nx-card h4{margin:0 0 .55rem;font-size:.92rem;color:var(--ink)}" +
      ".nx-presets{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:.8rem}" +
      ".nx-preset-btn{font-family:inherit;font-size:.8rem;font-weight:700;color:var(--ink);background:var(--bg);" +
      "border:1.5px solid var(--line);border-radius:99px;padding:.35rem .9rem;cursor:pointer}" +
      ".nx-preset-btn .nx-pp{direction:ltr;display:inline-block;font-family:var(--font-mono);font-weight:600;font-size:.72rem;color:var(--ink-soft)}" +
      ".nx-preset-btn.is-active{background:var(--accent);border-color:var(--accent);color:#fff}" +
      ".nx-preset-btn.is-active .nx-pp{color:#fff}" +
      ".nx-preset-btn:focus-visible,.nx-btn:focus-visible,.nx-input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}" +
      ".nx-sliders{display:flex;flex-wrap:wrap;gap:.6rem 1.6rem}" +
      ".nx-slider-group{display:flex;align-items:center;gap:.55rem;flex:1 1 240px}" +
      ".nx-slider-group label{font-weight:700;font-size:.86rem;color:var(--ink);white-space:nowrap}" +
      ".nx-slider-group input[type=range]{flex:1;accent-color:var(--accent);min-width:110px}" +
      ".nx-slider-val{font-family:var(--font-mono);font-size:.84rem;font-weight:700;color:var(--accent);direction:ltr;min-width:4.2em;text-align:left}" +
      ".nx-chart-wrap{direction:ltr;margin-top:.4rem}" +
      ".nx-svg{width:100%;height:auto;display:block;touch-action:none}" +
      ".nx-svg text{font-family:var(--font-mono);font-size:11px;fill:var(--ink-soft)}" +
      ".nx-svg .nx-hlabel{font-size:12px;font-weight:700;fill:var(--ink)}" +
      ".nx-svg .nx-hletter{font-size:11px;font-weight:800;fill:#fff}" +
      ".nx-handle{cursor:ew-resize;outline:none}" +
      ".nx-handle:focus-visible circle{stroke:var(--ink);stroke-width:3}" +
      ".nx-chart-hint{font-size:.78rem;color:var(--ink-soft);margin:.4rem 0 0}" +
      ".nx-big-p{direction:ltr;text-align:center;font-family:var(--font-mono);font-size:1.05rem;font-weight:800;" +
      "color:var(--accent);background:var(--bg);border:1px dashed var(--line);border-radius:8px;padding:.5rem .7rem;margin:.2rem 0 .6rem}" +
      ".nx-formula{font-family:var(--font-mono);direction:ltr;text-align:left;font-size:.8rem;line-height:1.8;white-space:pre-wrap;" +
      "color:var(--ink);background:var(--bg);border:1px dashed var(--line);border-radius:8px;padding:.55rem .7rem;margin-top:.2rem}" +
      ".nx-hint{font-size:.78rem;color:var(--ink-soft);margin:.45rem 0 0;line-height:1.55}" +
      ".nx-inv-row{display:flex;flex-wrap:wrap;align-items:center;gap:.55rem;margin-bottom:.5rem}" +
      ".nx-inv-row label{font-weight:700;font-size:.86rem;color:var(--ink)}" +
      ".nx-input{font-family:var(--font-mono);font-size:.88rem;direction:ltr;text-align:left;color:var(--ink);background:var(--bg);" +
      "border:1.5px solid var(--line);border-radius:8px;padding:.4rem .6rem;width:7.5em}" +
      ".nx-btn{font-family:inherit;font-size:.84rem;font-weight:700;color:#fff;background:var(--accent);" +
      "border:1.5px solid var(--accent);border-radius:99px;padding:.4rem 1.1rem;cursor:pointer}" +
      ".nx-inv-err{color:var(--err);font-size:.84rem;font-weight:700;margin:.3rem 0 0}";
    document.head.appendChild(s);
  }

  /* =====================================================================
     DOM helpers
     ===================================================================== */
  var SVG_NS = "http://www.w3.org/2000/svg";
  function mk(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function mkSvg(tag, attrs) {
    var e = document.createElementNS(SVG_NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function ltr(s) { return '<span dir="ltr">' + s + "</span>"; }

  /* =====================================================================
     Render one mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-nx-ready") === "1") return;
    mount.setAttribute("data-nx-ready", "1");
    mount.innerHTML = "";
    ensureStyle();

    /* ---------------- state ---------------- */
    var preset = PRESETS[0];
    var mu = preset.mu, sigma = preset.sigma;
    var x0 = 0, x1 = 1;              /* fixed x-domain per preset */
    var sigMin = 1, sigMax = 2;      /* σ-slider range per preset */
    var za = -1, zb = 1;             /* the bounds, stored in z-space */
    var invMark = null;              /* x of the last percentile marker */

    /* ---------------- chart geometry (viewBox units) ---------------- */
    var W = 720, H = 300, padL = 14, padR = 14, padT = 22, padB = 40;
    var baseY = H - padB, plotH = baseY - padT;
    function X(x) { return padL + (x - x0) / (x1 - x0) * (W - padL - padR); }
    function dens(x) {
      var t = (x - mu) / sigma;
      return Math.exp(-0.5 * t * t) / (sigma * SQRT2PI);
    }
    function Y(f) {
      var peakRef = 1 / (sigMin * SQRT2PI); /* בשיא הצר ביותר — 92% גובה */
      return baseY - (f / peakRef) * plotH * 0.92;
    }
    function curvePath(from, to, close) {
      var n = 140, d = "";
      for (var i = 0; i <= n; i++) {
        var x = from + (to - from) * i / n;
        d += (i ? " L " : "M ") + X(x).toFixed(1) + " " + Y(dens(x)).toFixed(1);
      }
      if (close) {
        d += " L " + X(to).toFixed(1) + " " + baseY +
             " L " + X(from).toFixed(1) + " " + baseY + " Z";
      }
      return d;
    }

    /* ---------------- skeleton ---------------- */
    var root = mk("div", "nx-root");
    root.appendChild(mk("p", "nx-lede",
      "עקומת הפעמון של ההתפלגות הנורמלית. גררו את הגבולות " + ltr("a, b") +
      " — השטח הצבוע הוא ההסתברות " + ltr("P(a ≤ X ≤ b)") +
      ", המחושבת בדיוק כמו בקורס: ציון תקן " + ltr("z = (x − μ)/σ") +
      ", קריאה מטבלת Φ (שטח מן הקצה השמאלי), והפרש " + ltr("Φ(z₂) − Φ(z₁)") + "."));

    /* presets */
    var presetsRow = mk("div", "nx-presets");
    presetsRow.setAttribute("role", "group");
    presetsRow.setAttribute("aria-label", "דוגמאות מהקורס");
    var presetBtns = {};
    PRESETS.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "nx-preset-btn";
      b.innerHTML = p.he + ' <span class="nx-pp">(μ=' + fmtX(p.mu) + ", σ=" + fmtX(p.sigma) + ")</span>";
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () { applyPreset(p); });
      presetsRow.appendChild(b);
      presetBtns[p.id] = b;
    });
    root.appendChild(presetsRow);

    /* sliders */
    var uid = "nx-" + Math.random().toString(36).slice(2);
    var slidersCard = mk("div", "nx-card");
    var sliders = mk("div", "nx-sliders");

    var muGroup = mk("div", "nx-slider-group");
    var muLbl = mk("label", null, "תוחלת μ:");
    muLbl.htmlFor = uid + "-mu";
    var muRange = document.createElement("input");
    muRange.type = "range";
    muRange.id = uid + "-mu";
    muRange.setAttribute("aria-label", "תוחלת μ");
    var muVal = mk("span", "nx-slider-val");
    muGroup.appendChild(muLbl); muGroup.appendChild(muRange); muGroup.appendChild(muVal);

    var sgGroup = mk("div", "nx-slider-group");
    var sgLbl = mk("label", null, "סטיית תקן σ:");
    sgLbl.htmlFor = uid + "-sg";
    var sgRange = document.createElement("input");
    sgRange.type = "range";
    sgRange.id = uid + "-sg";
    sgRange.setAttribute("aria-label", "סטיית תקן σ");
    var sgVal = mk("span", "nx-slider-val");
    sgGroup.appendChild(sgLbl); sgGroup.appendChild(sgRange); sgGroup.appendChild(sgVal);

    sliders.appendChild(muGroup);
    sliders.appendChild(sgGroup);
    slidersCard.appendChild(sliders);

    /* chart */
    var chartWrap = mk("div", "nx-chart-wrap");
    var svg = mkSvg("svg", { viewBox: "0 0 " + W + " " + H });
    svg.classList.add("nx-svg");
    svg.setAttribute("aria-label", "עקומת פעמון נורמלית עם שטח צבוע בין הגבולות a ו-b");

    var curveEl = mkSvg("path", { fill: "none", stroke: "var(--accent)", "stroke-width": "2.5", "stroke-linejoin": "round" });
    var areaEl = mkSvg("path", { fill: "var(--accent)", "fill-opacity": "0.22", stroke: "none" });
    var axisEl = mkSvg("line", { stroke: "var(--line)", "stroke-width": "1.5" });
    axisEl.setAttribute("x1", padL); axisEl.setAttribute("x2", W - padR);
    axisEl.setAttribute("y1", baseY); axisEl.setAttribute("y2", baseY);
    var ticksG = mkSvg("g", null);

    /* percentile marker (inverse mode) */
    var markG = mkSvg("g", null);
    markG.style.display = "none";
    var markLine = mkSvg("line", { stroke: "var(--mustard)", "stroke-width": "2", "stroke-dasharray": "5 3" });
    var markText = mkSvg("text", { "text-anchor": "middle", y: padT - 8 });
    markText.setAttribute("fill", "var(--ink)");
    markG.appendChild(markLine); markG.appendChild(markText);

    function makeHandle(letter, ariaLabel) {
      var g = mkSvg("g", { tabindex: "0", role: "slider", "aria-orientation": "horizontal" });
      g.classList.add("nx-handle");
      g.setAttribute("aria-label", ariaLabel);
      var line = mkSvg("line", { stroke: "var(--accent)", "stroke-width": "1.5", "stroke-dasharray": "4 3" });
      var circle = mkSvg("circle", { r: "9", fill: "var(--accent)", stroke: "var(--surface)", "stroke-width": "2" });
      var letterT = mkSvg("text", { "text-anchor": "middle" });
      letterT.classList.add("nx-hletter");
      letterT.textContent = letter;
      var valT = mkSvg("text", null);
      valT.classList.add("nx-hlabel");
      g.appendChild(line); g.appendChild(circle); g.appendChild(letterT); g.appendChild(valT);
      return { g: g, line: line, circle: circle, letterT: letterT, valT: valT };
    }
    var hA = makeHandle("a", "גבול תחתון a — הזיזו עם מקשי החצים");
    var hB = makeHandle("b", "גבול עליון b — הזיזו עם מקשי החצים");

    svg.appendChild(areaEl);
    svg.appendChild(curveEl);
    svg.appendChild(axisEl);
    svg.appendChild(ticksG);
    svg.appendChild(markG);
    svg.appendChild(hA.g);
    svg.appendChild(hB.g);
    chartWrap.appendChild(svg);
    slidersCard.appendChild(chartWrap);
    slidersCard.appendChild(mk("p", "nx-chart-hint",
      "טיפ מהשיעור: אותו רוחב של תחום \"שווה\" יותר שטח כשהוא קרוב למרכז — " +
      "סטיית תקן ראשונה מוסיפה הרבה יותר הסתברות מסטיית תקן שנייה."));
    root.appendChild(slidersCard);

    /* readout card */
    var readCard = mk("div", "nx-card");
    readCard.appendChild(mk("h4", null, "חישוב ההסתברות — דרך טבלת Φ"));
    var bigP = mk("div", "nx-big-p");
    var readFormula = mk("div", "nx-formula");
    var readHint = mk("p", "nx-hint");
    var readLive = mk("div", null);
    readLive.setAttribute("aria-live", "polite");
    readLive.appendChild(bigP);
    readLive.appendChild(readFormula);
    readLive.appendChild(readHint);
    readCard.appendChild(readLive);
    root.appendChild(readCard);

    /* inverse card */
    var invCard = mk("div", "nx-card");
    invCard.appendChild(mk("h4", null, "מצב הפוך — מהסתברות לאחוזון"));
    invCard.appendChild(mk("p", "nx-hint",
      "נתון שטח (הסתברות מצטברת) Φ — מחפשים אותו בגוף הטבלה, מתאימים לו " +
      ltr("z") + ", ומתרגמים לערך: " + ltr("x = μ + z·σ") +
      ". למשל בדוגמת הגבהים: " + ltr("Φ = 0.99 → z = 2.33 → X = 198.3") + "."));
    var invRow = mk("div", "nx-inv-row");
    var invLbl = mk("label", null, "הסתברות מצטברת (0 עד 1, או באחוזים):");
    invLbl.htmlFor = uid + "-p";
    var invInput = document.createElement("input");
    invInput.type = "text";
    invInput.className = "nx-input";
    invInput.id = uid + "-p";
    invInput.setAttribute("inputmode", "decimal");
    invInput.setAttribute("placeholder", "0.99");
    var invBtn = document.createElement("button");
    invBtn.type = "button";
    invBtn.className = "nx-btn";
    invBtn.textContent = "מצא אחוזון";
    invRow.appendChild(invLbl); invRow.appendChild(invInput); invRow.appendChild(invBtn);
    invCard.appendChild(invRow);
    var invOut = mk("div", null);
    invOut.setAttribute("aria-live", "polite");
    invCard.appendChild(invOut);
    root.appendChild(invCard);

    mount.appendChild(root);

    /* =================================================================
       state transitions
       ================================================================= */
    function applyPreset(p) {
      preset = p;
      mu = p.mu; sigma = p.sigma;
      x0 = p.mu - 4.5 * p.sigma;
      x1 = p.mu + 4.5 * p.sigma;
      sigMin = p.sigma / 2;
      sigMax = p.sigma * 2;
      muRange.min = p.mu - 2.5 * p.sigma;
      muRange.max = p.mu + 2.5 * p.sigma;
      muRange.step = p.sigma / 10;
      muRange.value = p.mu;
      sgRange.min = sigMin;
      sgRange.max = sigMax;
      sgRange.step = p.sigma / 20;
      sgRange.value = p.sigma;
      za = -1; zb = 1;
      PRESETS.forEach(function (q) {
        presetBtns[q.id].classList.toggle("is-active", q.id === p.id);
        presetBtns[q.id].setAttribute("aria-pressed", q.id === p.id ? "true" : "false");
      });
      clearInverse();
      paint();
    }

    function normalizeBounds() {
      var zLo = (x0 - mu) / sigma + 0.02;
      var zHi = (x1 - mu) / sigma - 0.02;
      za = clamp(za, zLo, zHi - 0.1);
      zb = clamp(zb, za + 0.1, zHi);
    }

    function clearInverse() {
      invMark = null;
      markG.style.display = "none";
      invOut.innerHTML = "";
    }

    muRange.addEventListener("input", function () {
      mu = parseFloat(muRange.value);
      clearInverse();
      paint();
    });
    sgRange.addEventListener("input", function () {
      sigma = parseFloat(sgRange.value);
      clearInverse();
      paint();
    });

    /* ---------------- dragging the bounds ---------------- */
    var dragging = null; /* "a" | "b" | null */
    function evtToX(e) {
      var pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      var m = svg.getScreenCTM();
      if (!m) return null;
      var p = pt.matrixTransform(m.inverse());
      return x0 + (p.x - padL) / (W - padL - padR) * (x1 - x0);
    }
    function setBound(which, xVal) {
      var z = (xVal - mu) / sigma;
      if (which === "a") za = Math.min(z, zb - 0.1);
      else zb = Math.max(z, za + 0.1);
      normalizeBounds();
      paint();
    }
    svg.addEventListener("pointerdown", function (e) {
      var x = evtToX(e);
      if (x == null) return;
      var xa = mu + za * sigma, xb = mu + zb * sigma;
      dragging = Math.abs(x - xa) <= Math.abs(x - xb) ? "a" : "b";
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
      setBound(dragging, x);
      e.preventDefault();
    });
    svg.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var x = evtToX(e);
      if (x != null) setBound(dragging, x);
    });
    svg.addEventListener("pointerup", function () { dragging = null; });
    svg.addEventListener("pointercancel", function () { dragging = null; });

    /* keyboard on the handles */
    function handleKeys(which) {
      return function (e) {
        var step = 0.05, big = 0.25, dz = 0;
        if (e.key === "ArrowRight" || e.key === "ArrowUp") dz = step;
        else if (e.key === "ArrowLeft" || e.key === "ArrowDown") dz = -step;
        else if (e.key === "PageUp") dz = big;
        else if (e.key === "PageDown") dz = -big;
        else return;
        e.preventDefault();
        if (which === "a") za += dz; else zb += dz;
        if (which === "a") za = Math.min(za, zb - 0.1); else zb = Math.max(zb, za + 0.1);
        normalizeBounds();
        paint();
      };
    }
    hA.g.addEventListener("keydown", handleKeys("a"));
    hB.g.addEventListener("keydown", handleKeys("b"));

    /* ---------------- inverse mode ---------------- */
    function runInverse() {
      invOut.innerHTML = "";
      var raw = (invInput.value || "").replace("%", "").trim();
      var p = parseFloat(raw);
      if (isNaN(p)) {
        invOut.appendChild(mk("p", "nx-inv-err", "הזינו מספר — הסתברות בין 0 ל-1, או אחוזים."));
        return;
      }
      if (p > 1 && p <= 100) p = p / 100;
      if (!(p > 0 && p < 1)) {
        invOut.appendChild(mk("p", "nx-inv-err", "ההסתברות חייבת להיות בין 0 ל-1 (לא כולל)."));
        return;
      }
      var lines = [], hints = [], z;
      if (p >= 0.5) {
        var zt = tableZ(round4(p));
        z = zt;
        lines.push("Φ(z) = " + fmtP(p) + "  →  z ≈ " + fmtZ(zt));
        hints.push("מחפשים את השטח בגוף טבלת Φ ומתאימים לו את z (בדיוק של מאיות, כמו בטבלה).");
      } else {
        var q = round4(1 - p);
        var zt2 = tableZ(q);
        z = -zt2;
        lines.push("1 − p = " + fmtP(q) + "  →  z(" + fmtP(q) + ") ≈ " + fmtZ(zt2));
        lines.push("z = −" + fmtZ(zt2));
        hints.push("שטח קטן מ-0.5, ולכן z שלילי. ערכים שליליים אינם בטבלה המקורית, אז לפי הסימטריה " +
          ltr("Φ(−z) = 1 − Φ(z)") + " מחפשים את 1−p ומהפכים סימן.");
      }
      var x = mu + z * sigma;
      lines.push("x = μ + z·σ = " + fmtX(mu) + " + " +
        (z < 0 ? "(" + fmtZ(z) + ")" : fmtZ(z)) + "·" + fmtX(sigma) + " = " + fmtX(x));
      if (p >= 0.9999 || p <= 0.0001) {
        hints.push("שטח כה קיצוני נמצא מעבר לקצה הטבלה (הטבלה מסתיימת סביב " + ltr("z ≈ 3.49") +
          ") — כפי שנאמר בשיעור, שם הזנב כבר אפסי והתוצאה מקורבת.");
      }
      invOut.appendChild(mk("div", "nx-formula", lines.join("\n")));
      hints.forEach(function (h) { invOut.appendChild(mk("p", "nx-hint", h)); });
      invMark = x;
      paint();
    }
    invBtn.addEventListener("click", runInverse);
    invInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); runInverse(); }
    });

    /* =================================================================
       paint — pure redraw from state.
       ================================================================= */
    function paint() {
      normalizeBounds();
      var xa = mu + za * sigma, xb = mu + zb * sigma;

      muVal.textContent = "μ = " + fmtX(mu);
      sgVal.textContent = "σ = " + fmtX(sigma);

      /* curve + area */
      curveEl.setAttribute("d", curvePath(x0, x1, false));
      areaEl.setAttribute("d", curvePath(xa, xb, true));

      /* ticks at μ + kσ */
      ticksG.innerHTML = "";
      for (var k = -3; k <= 3; k++) {
        var tx = mu + k * sigma;
        if (tx < x0 || tx > x1) continue;
        var px = X(tx);
        var tick = mkSvg("line", {
          x1: px, x2: px, y1: baseY, y2: baseY + 5,
          stroke: "var(--line)", "stroke-width": "1.5"
        });
        var lab = mkSvg("text", { x: px, y: baseY + 18, "text-anchor": "middle" });
        lab.textContent = fmtX(tx);
        ticksG.appendChild(tick);
        ticksG.appendChild(lab);
        if (k === 0) {
          var muLab = mkSvg("text", { x: px, y: baseY + 32, "text-anchor": "middle" });
          muLab.textContent = "μ";
          ticksG.appendChild(muLab);
        }
      }

      /* handles */
      function placeHandle(h, xVal, zVal, anchorEnd) {
        var px = X(xVal);
        h.line.setAttribute("x1", px); h.line.setAttribute("x2", px);
        h.line.setAttribute("y1", padT + 6); h.line.setAttribute("y2", baseY);
        h.circle.setAttribute("cx", px); h.circle.setAttribute("cy", baseY);
        h.letterT.setAttribute("x", px); h.letterT.setAttribute("y", baseY + 4);
        h.valT.setAttribute("x", anchorEnd ? px - 7 : px + 7);
        h.valT.setAttribute("y", padT + 16);
        h.valT.setAttribute("text-anchor", anchorEnd ? "end" : "start");
        h.valT.textContent = (anchorEnd ? "a = " : "b = ") + fmtX(xVal);
        h.g.setAttribute("aria-valuemin", String(Math.round(x0 * 100) / 100));
        h.g.setAttribute("aria-valuemax", String(Math.round(x1 * 100) / 100));
        h.g.setAttribute("aria-valuenow", String(Math.round(xVal * 100) / 100));
        h.g.setAttribute("aria-valuetext",
          (anchorEnd ? "a = " : "b = ") + fmtX(xVal) + ", z = " + fmtZ(zVal));
      }
      var z1r = Math.round(za * 100) / 100;
      var z2r = Math.round(zb * 100) / 100;
      placeHandle(hA, xa, z1r, true);
      placeHandle(hB, xb, z2r, false);

      /* percentile marker */
      if (invMark != null && invMark >= x0 && invMark <= x1) {
        var mpx = X(invMark);
        markLine.setAttribute("x1", mpx); markLine.setAttribute("x2", mpx);
        markLine.setAttribute("y1", padT + 2); markLine.setAttribute("y2", baseY);
        markText.setAttribute("x", mpx);
        markText.textContent = "x = " + fmtX(invMark);
        markG.style.display = "";
      } else {
        markG.style.display = "none";
      }

      /* readout: the full table computation, כמו שכותבים בפתרון */
      var p1 = tablePhi(z1r);
      var p2 = tablePhi(z2r);
      var P = round4(p2 - p1);
      bigP.textContent = "P(" + fmtX(xa) + " ≤ X ≤ " + fmtX(xb) + ") = " +
        fmtP(P) + "  (" + (P * 100).toFixed(2) + "%)";

      var lines = [];
      lines.push("z₁ = (a − μ) / σ = (" + fmtX(xa) + " − " + fmtX(mu) + ") / " + fmtX(sigma) + " = " + fmtZ(z1r));
      lines.push("z₂ = (b − μ) / σ = (" + fmtX(xb) + " − " + fmtX(mu) + ") / " + fmtX(sigma) + " = " + fmtZ(z2r));
      [{ z: z1r, i: "₁", v: p1 }, { z: z2r, i: "₂", v: p2 }].forEach(function (t) {
        if (t.z >= 0) {
          lines.push("Φ(z" + t.i + ") = Φ(" + fmtZ(t.z) + ") = " + fmtP(t.v));
        } else {
          lines.push("Φ(z" + t.i + ") = Φ(" + fmtZ(t.z) + ") = 1 − Φ(" + fmtZ(-t.z) + ") = 1 − " +
            fmtP(round4(phi(-t.z))) + " = " + fmtP(t.v));
        }
      });
      lines.push("P(a ≤ X ≤ b) = Φ(z₂) − Φ(z₁) = " +
        fmtP(p2) + " − " + fmtP(p1) + " = " + fmtP(P));
      readFormula.textContent = lines.join("\n");

      var hintBits = [];
      hintBits.push("ערכי Φ נקראים מהטבלה בדיוק של 4 ספרות, עם z מעוגל למאיות — בדיוק כמו בפתרונות הקורס.");
      if (z1r < 0 || z2r < 0) {
        hintBits.push("ל-z שלילי משתמשים בסימטריה: " + ltr("Φ(−z) = 1 − Φ(z)") + ".");
      }
      if (Math.abs(z1r) > 3.49 || Math.abs(z2r) > 3.49) {
        hintBits.push("כאשר |z| גדול מקצה הטבלה (" + ltr("≈ 3.49") + ") — \"הערכים בטבלה נגמרים\" והזנב נחשב אפסי.");
      }
      readHint.innerHTML = hintBits.join(" ");
    }

    applyPreset(PRESETS[0]);
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
