/* =====================================================================
   local-search-lab.js  —  Module 06 "Local Search Algorithms"
   Grounded in _notes/local-search.md (06-local-search.pdf, AIMA פרק 4):

   The 1-D landscape mirrors the lecture's state-space-landscape figure
   (עמ' 20): global maximum · local maximum · "flat" local maximum
   (plateau) · a ridge-like decoy bump right before the true ascent.
   English labels on the diagram match the lecture's own terms so the
   figure is instantly recognizable.

   Hill-Climbing engine implements BOTH the basic algorithm (stops on
   Value(neighbor) ≤ Value(current)) and the "improved" version taught
   right after it (sideways moves on a tie, capped to avoid infinite
   loops — עמ' 24-26) — every step is the real algorithm, snapshotted.

   Simulated Annealing engine runs the exact pseudocode (עמ' 31):
   next = random successor; ΔE>0 always accepted; ΔE≤0 accepted with
   probability e^(ΔE/Temp); Temp cools via a schedule each iteration;
   stops when Temp≈0 ("if Temp = 0 then return current").

   "אתחול אקראי" tallies attempts vs. global-maximum hits — a live demo
   of the Random-Restart idea (עמ' 27): p = success chance ⇒ ~1/p runs
   needed.

   Self-contained IIFE. Vanilla JS + inline SVG/DOM. No external deps.
   ALL colours via the site's CSS custom properties (--accent, --surface,
   --surface-2, --ink, --ink-soft, --line) so light/dark themes both
   work; any extra tone is produced with color-mix() on those tokens.
   Never throws; graceful if no mount. Keyboard focusable, no console
   errors, prefers-reduced-motion respected.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "local-search-lab";
  var SVGNS = "http://www.w3.org/2000/svg";
  var EPS = 1e-6;
  var MAX_SIDEWAYS = 10;

  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function ltr(s) { return '<span dir="ltr">' + s + "</span>"; }
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
  function mkBtn(label, fn, primary) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "viz-btn" + (primary ? " primary" : "");
    b.innerHTML = label;
    b.addEventListener("click", fn);
    return b;
  }

  /* =====================================================================
     THE LANDSCAPE — anchors sampled with cosine easing between them.
     Anchors chosen to reproduce the AIMA figure's four features:
       x=18 local maximum (0.62) · x=44–54 flat local maximum / plateau
       (0.40, flanked by lower ground both sides — a genuine trap) ·
       x=70 a ridge-like decoy bump (0.54, dips right after it) ·
       x=84 global maximum (1.00, the tallest point overall).
     ===================================================================== */
  var ANCHORS = [
    [0, 0.12], [10, 0.20], [18, 0.62], [26, 0.30], [34, 0.34],
    [44, 0.40], [54, 0.40], [62, 0.30], [70, 0.54], [75, 0.47],
    [84, 1.00], [92, 0.62], [100, 0.25]
  ];
  var N = 241; /* samples across x∈[0,100] */

  function buildCurve() {
    var out = new Array(N);
    for (var i = 0; i < N; i++) {
      var x = (i / (N - 1)) * 100;
      var seg = 0;
      while (seg < ANCHORS.length - 2 && x > ANCHORS[seg + 1][0]) seg++;
      var x0 = ANCHORS[seg][0], x1 = ANCHORS[seg + 1][0];
      var y0 = ANCHORS[seg][1], y1 = ANCHORS[seg + 1][1];
      var t = clamp((x - x0) / (x1 - x0 || 1), 0, 1);
      var ease = (1 - Math.cos(t * Math.PI)) / 2;
      out[i] = y0 + (y1 - y0) * ease;
    }
    return out;
  }
  var Y = buildCurve();
  var GMAX_I = 0;
  for (var gi = 1; gi < N; gi++) if (Y[gi] > Y[GMAX_I]) GMAX_I = gi;
  function fmtX(i) { return Math.round((i / (N - 1)) * 100); }
  function fmtY(v) { return v.toFixed(3); }
  function nearGlobal(i) { return Math.abs(i - GMAX_I) <= 3; }

  /* =====================================================================
     HILL-CLIMBING step engine — runs the real algorithm, one snapshot
     per action. Sideways moves allowed (the "improved" version, עמ' 25),
     capped at MAX_SIDEWAYS to avoid an infinite loop on a true plateau.
     ===================================================================== */
  function genHillClimb(startI) {
    var steps = [], i = startI, sideways = 0, guard = 0;
    steps.push({
      i: i, kind: "start", badge: "התחלה",
      title: "המטפס יורד לנוף", body: "מיקום התחלתי x=" + ltr(fmtX(i)) +
        ", ערך הפונקציה h=" + ltr(fmtY(Y[i])) + ". לוחצים על " + ltr("הרץ") +
        " כדי לטפס, שכן אחרי שכן, עד שנתקעים."
    });
    while (guard++ < 400) {
      var hasL = i > 0, hasR = i < N - 1;
      var lv = hasL ? Y[i - 1] : -Infinity, rv = hasR ? Y[i + 1] : -Infinity;
      var cur = Y[i];
      var best = Math.max(lv, rv);
      if (best > cur + EPS) {
        var eqTie = Math.abs(lv - rv) <= EPS;
        var dir = eqTie ? (Math.random() < 0.5 ? -1 : 1) : (rv > lv ? 1 : -1);
        i += dir; sideways = 0;
        steps.push({
          i: i, kind: "climb", badge: "טיפוס",
          title: "צעד טיפוס " + (dir > 0 ? "→" : "←"),
          body: "השכן ב" + (dir > 0 ? "ימין" : "שמאל") + " גבוה יותר (h=" +
            ltr(fmtY(Y[i])) + " > " + ltr(fmtY(cur)) + ")" +
            (eqTie ? " — שני השכנים שווים, שובר-שוויון שרירותי בחר כיוון זה." : "") +
            " ⇒ עוברים אליו."
        });
        continue;
      }
      var eqL = Math.abs(lv - cur) <= EPS, eqR = Math.abs(rv - cur) <= EPS;
      if ((eqL || eqR) && sideways < MAX_SIDEWAYS) {
        var d2 = (eqL && eqR) ? (Math.random() < 0.5 ? -1 : 1) : (eqR ? 1 : -1);
        i += d2; sideways++;
        steps.push({
          i: i, kind: "sideways", badge: "רמה — צעד צדדי",
          title: "צעד צדדי (" + sideways + "/" + MAX_SIDEWAYS + ")",
          body: "השכנים שווים בערכם ל-h=" + ltr(fmtY(cur)) + " — זו " + ltr("plateau") +
            " (רמה). כמו באלגוריתם המשופר (Value(neighbor) &lt; Value(current) בלבד עוצר), " +
            "מבצעים צעד צדדי כדי לנסות לצאת ממנה, עד למגבלת " + ltr(MAX_SIDEWAYS) + " צעדים."
        });
        continue;
      }
      if (eqL || eqR) {
        steps.push({
          i: i, kind: "stuck-plateau", badge: "נתקע: רמה (Plateau)",
          title: "נגמרו הצעדים הצדדיים",
          body: "בוצעו " + ltr(MAX_SIDEWAYS) + " צעדים צדדיים על רמה שטוחה ועדיין אין שיפור — " +
            "זו " + ltr('"flat" local maximum') + " אמיתית (מוקפת בגובה נמוך יותר משני הצדדים). " +
            "האלגוריתם עוצר ומחזיר את המצב הנוכחי (h=" + ltr(fmtY(cur)) + "), בדיוק בגלל ההגבלה " +
            "שנועדה למנוע לולאה אינסופית."
        });
        break;
      }
      var isG = nearGlobal(i);
      steps.push({
        i: i, kind: isG ? "stuck-global" : "stuck-local",
        badge: isG ? "🏆 מקסימום גלובלי!" : "נתקע: מקסימום מקומי",
        title: isG ? "הגעה למקסימום הגלובלי" : "שני השכנים נמוכים יותר",
        body: "h(שמאל)=" + ltr(fmtY(lv)) + ", h(ימין)=" + ltr(fmtY(rv)) + " — שניהם קטנים מ-h=" +
          ltr(fmtY(cur)) + " ⇒ " + ltr("Value(neighbor) ≤ Value(current)") + " ⇒ האלגוריתם עוצר. " +
          (isG ? "הפעם זהו גם המקסימום הגלובלי של הנוף — הצלחה!" :
            "אבל זהו רק מקסימום <b>מקומי</b> — לא בהכרח הפתרון הטוב ביותר בנוף כולו.")
      });
      break;
    }
    return steps;
  }

  /* =====================================================================
     SIMULATED ANNEALING step engine — the exact pseudocode (עמ' 31):
     next = random successor; ΔE>0 ⇒ always accept; ΔE≤0 ⇒ accept with
     probability e^(ΔE/Temp); Temp cools each iteration; Temp≈0 ⇒ stop.
     ===================================================================== */
  function genSA(startI, T0) {
    var steps = [], i = startI, decay = 0.94, minT = 0.02, maxIter = 150;
    steps.push({
      i: i, kind: "start", badge: "התחלה", T: T0,
      title: "המטפס יורד לנוף — מצב Simulated Annealing",
      body: "מיקום התחלתי x=" + ltr(fmtX(i)) + ", h=" + ltr(fmtY(Y[i])) +
        ", טמפרטורה התחלתית " + ltr("T₀=" + T0.toFixed(2)) + "."
    });
    for (var t = 1; t <= maxIter; t++) {
      var T = T0 * Math.pow(decay, t);
      if (T < minT) {
        steps.push({
          i: i, kind: "done", T: 0,
          badge: "סיום — התקררות", title: "Temp ≈ 0",
          body: "כמו בפסאודו-קוד " + ltr("if Temp = 0 then return current") +
            " — הטמפרטורה התקררה מתחת לסף. מחזירים את המצב הנוכחי (h=" + ltr(fmtY(Y[i])) + ")" +
            (nearGlobal(i) ? ", וזהו המקסימום הגלובלי!" : ", לאו דווקא מקסימום כלשהו.")
        });
        break;
      }
      var opts = [];
      if (i > 0) opts.push(-1);
      if (i < N - 1) opts.push(1);
      var dir = opts[Math.floor(Math.random() * opts.length)];
      var ni = i + dir, dE = Y[ni] - Y[i];
      if (dE > 0) {
        i = ni;
        steps.push({
          i: i, kind: "uphill", T: T, dE: dE,
          badge: "עלייה", title: "מהלך משפר — מתקבל תמיד",
          body: "שכן אקראי (" + (dir > 0 ? "ימין" : "שמאל") + "): " + ltr("ΔE=" + dE.toFixed(3)) +
            " &gt; 0 ⇒ תמיד מקבלים. " + ltr("T=" + T.toFixed(3)) + "."
        });
      } else {
        var p = Math.exp(dE / T), roll = Math.random(), accept = roll < p;
        if (accept) i = ni;
        steps.push({
          i: i, kind: accept ? "downhill-accept" : "downhill-reject", T: T, dE: dE, p: p,
          badge: accept ? "ירידה — התקבלה" : "ירידה — נדחתה",
          title: "שכן אקראי (" + (dir > 0 ? "ימין" : "שמאל") + ") גרוע יותר",
          body: ltr("ΔE=" + dE.toFixed(3)) + ", הסתברות קבלה " +
            ltr("e^(ΔE/T) = " + p.toFixed(3)) + " (בטמפרטורה " + ltr("T=" + T.toFixed(3)) + "). " +
            "הגרלה " + ltr("r=" + roll.toFixed(3)) + (accept
              ? " &lt; ההסתברות ⇒ מתקבל, למרות שהוא גרוע יותר!"
              : " ≥ ההסתברות ⇒ נדחה, נשארים במקום.")
        });
      }
      if (t === maxIter) {
        steps.push({
          i: i, kind: "done", T: T,
          badge: "סיום — מגבלת צעדים", title: "הגעה למספר הצעדים המרבי",
          body: "בוצעו " + ltr(maxIter) + " צעדים; עוצרים ומחזירים את המצב הנוכחי (h=" +
            ltr(fmtY(Y[i])) + ")."
        });
      }
    }
    return steps;
  }

  /* =====================================================================
     SCENE — the 1-D landscape as an SVG curve. LTR inside (English
     axis/feature labels, matching the lecture's own terminology).
     ===================================================================== */
  var VBW = 640, VBH = 232, ML = 26, MR = 26, MT = 24, MB = 30;
  var PW = VBW - ML - MR, PH = VBH - MT - MB;
  function px(i) { return ML + (i / (N - 1)) * PW; }
  function py(v) { return MT + (1 - v) * PH; }

  function buildScene() {
    var svg = el("svg", {
      viewBox: "0 0 " + VBW + " " + VBH, width: "100%",
      role: "img", direction: "ltr",
      "aria-label": "נוף פונקציית מטרה חד-ממדי עם מקסימום גלובלי, מקסימום מקומי, רמה שטוחה ובליטת רכס"
    });
    svg.setAttribute("class", "lsl-svg");

    var areaD = "M" + px(0) + "," + py(0);
    var lineD = "M" + px(0) + "," + py(Y[0]);
    for (var i = 0; i < N; i++) { lineD += " L" + px(i) + "," + py(Y[i]); areaD += " L" + px(i) + "," + py(Y[i]); }
    areaD += " L" + px(N - 1) + "," + py(0) + " Z";
    svg.appendChild(el("path", { d: areaD, fill: "var(--ls-area)", stroke: "none" }));
    svg.appendChild(el("path", { d: lineD, fill: "none", stroke: "var(--ink)", "stroke-width": 2.4, "stroke-linejoin": "round" }));

    var baseY = py(0);
    svg.appendChild(el("line", { x1: ML, y1: baseY, x2: VBW - MR, y2: baseY, stroke: "var(--line)", "stroke-width": 1.2 }));

    /* feature labels — the lecture's own English terms */
    function flabel(xAnchor, y, s) {
      svg.appendChild(txt(px(Math.round((xAnchor / 100) * (N - 1))), py(y) - 10, s, {
        "text-anchor": "middle", "font-size": 9.5, "font-weight": 700, fill: "var(--ink-soft)"
      }));
    }
    flabel(18, 0.62, "local maximum");
    flabel(49, 0.40, '"flat" local maximum');
    flabel(70, 0.54, "ridge");
    flabel(84, 1.00, "global maximum");
    svg.appendChild(txt(VBW / 2, VBH - 6, "state space →", { "text-anchor": "middle", "font-size": 10, "font-weight": 600, fill: "var(--ink-soft)" }));
    var yl = txt(10, VBH / 2, "objective function", { "text-anchor": "middle", "font-size": 10, "font-weight": 600, fill: "var(--ink-soft)" });
    yl.setAttribute("transform", "rotate(-90 10 " + (VBH / 2) + ")");
    svg.appendChild(yl);

    /* travelled trail (under the climber, over the curve) */
    var trail = el("path", { d: "", fill: "none", stroke: "var(--accent)", "stroke-width": 2, "stroke-dasharray": "3 3", opacity: 0.55 });
    svg.appendChild(trail);

    /* hover ghost (click affordance) */
    var ghost = el("circle", { r: 4.5, fill: "none", stroke: "var(--ink-soft)", "stroke-width": 1.4, opacity: 0 });
    svg.appendChild(ghost);

    /* climber marker */
    var mg = el("g", {});
    mg.style.opacity = "0";
    var glow = el("circle", { r: 11, fill: "var(--ls-glow)" });
    var dot = el("circle", { r: 7, fill: "var(--accent)", stroke: "var(--surface)", "stroke-width": 2 });
    mg.appendChild(glow); mg.appendChild(dot);
    if (!reducedMotion()) mg.style.transition = "transform .32s ease, opacity .2s ease";
    svg.appendChild(mg);

    /* click / hover overlay */
    var overlay = el("rect", { x: ML, y: 0, width: PW, height: VBH, fill: "transparent" });
    overlay.setAttribute("class", "lsl-overlay");
    svg.appendChild(overlay);

    return { svg: svg, trail: trail, ghost: ghost, climber: mg, overlay: overlay };
  }

  function idxFromClientX(svg, clientX) {
    var rect = svg.getBoundingClientRect();
    var relX = ((clientX - rect.left) / rect.width) * VBW;
    var frac = clamp((relX - ML) / PW, 0, 1);
    return Math.round(frac * (N - 1));
  }

  /* =====================================================================
     One mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-lsl-ready") === "1") return;
    mount.setAttribute("data-lsl-ready", "1");
    mount.innerHTML = "";
    mount.classList.add("viz-local-search-lab");

    var mode = "hc";           /* "hc" | "sa" */
    var T0 = 2.5;
    var steps = [], idx = 0, autoTimer = null, placed = false;
    var lastStartI = Math.round(N * 0.30);
    var attempts = 0, hits = 0;

    var wrap = document.createElement("div");
    wrap.setAttribute("tabindex", "0");
    wrap.className = "lsl-wrap";

    /* ---- mode row ---- */
    var modeRow = document.createElement("div");
    modeRow.className = "viz-controls";
    var modeLbl = document.createElement("span");
    modeLbl.className = "lsl-lbl"; modeLbl.textContent = "מצב:";
    var btnHC = mkBtn("Hill Climbing", function () { setMode("hc"); }, true);
    var btnSA = mkBtn("מצב Simulated Annealing", function () { setMode("sa"); });
    modeRow.appendChild(modeLbl); modeRow.appendChild(btnHC); modeRow.appendChild(btnSA);
    wrap.appendChild(modeRow);

    /* ---- temperature slider (SA only) ---- */
    var sliderRow = document.createElement("div");
    sliderRow.className = "lsl-slider-row";
    sliderRow.style.display = "none";
    var sliderLbl = document.createElement("span");
    var slider = document.createElement("input");
    slider.type = "range"; slider.min = "0.3"; slider.max = "6"; slider.step = "0.1"; slider.value = String(T0);
    var preview = document.createElement("span");
    preview.className = "lsl-preview";
    sliderRow.appendChild(sliderLbl); sliderRow.appendChild(slider); sliderRow.appendChild(preview);
    wrap.appendChild(sliderRow);
    function updateSliderLabels() {
      sliderLbl.innerHTML = "טמפרטורה התחלתית " + ltr("T₀=" + T0.toFixed(1));
      var p = Math.exp(-0.05 / T0) * 100;
      preview.innerHTML = "לדוגמה: ירידה של " + ltr("ΔE=−0.05") + " תתקבל בהסתברות ≈" + ltr(p.toFixed(0) + "%") + " בטמפרטורה זו.";
    }
    slider.addEventListener("input", function () { T0 = parseFloat(slider.value); updateSliderLabels(); });

    /* ---- scene ---- */
    var sceneBox = document.createElement("div");
    sceneBox.className = "lsl-scene";
    var scene = buildScene();
    sceneBox.appendChild(scene.svg);
    wrap.appendChild(sceneBox);

    var stats = document.createElement("div");
    stats.className = "lsl-stats";
    wrap.appendChild(stats);
    function updateStats() {
      stats.innerHTML = attempts === 0
        ? "עוד לא בוצעו אתחולים אקראיים."
        : "אתחולים אקראיים: " + ltr(attempts) + " · הגיעו למקסימום גלובלי: " + ltr(hits) +
          " (" + ltr(Math.round((hits / attempts) * 100) + "%") + ") — ממחיש את רעיון ה-Random Restart.";
    }
    updateStats();

    /* ---- caption ---- */
    var panel = document.createElement("div");
    panel.className = "lsl-caption";
    panel.setAttribute("aria-live", "polite");
    wrap.appendChild(panel);

    /* ---- controls ---- */
    var controls = document.createElement("div");
    controls.className = "viz-controls";
    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); go(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); go(idx + 1); });
    var btnRun = mkBtn("▶ הרץ", function () { toggleAuto(); }, true);
    var btnReset = mkBtn("↺ איפוס", function () { stopAuto(); go(0); });
    var btnRestart = mkBtn("🎲 אתחול אקראי", function () { randomRestart(); });
    var counter = document.createElement("span");
    counter.className = "lsl-counter";
    [btnPrev, btnNext, btnRun, btnReset, btnRestart, counter].forEach(function (n) { controls.appendChild(n); });
    wrap.appendChild(controls);

    mount.appendChild(wrap);

    /* ---- render one step ---- */
    function go(n) {
      if (!placed) return;
      idx = clamp(n, 0, steps.length - 1);
      var s = steps[idx];
      applyClimber(s.i);
      renderTrail();
      renderCaption(s);
      counter.textContent = "צעד " + (idx + 1) + " / " + steps.length;
      btnPrev.disabled = idx === 0;
      btnNext.disabled = idx === steps.length - 1;
    }
    function applyClimber(i) {
      scene.climber.style.opacity = "1";
      scene.climber.setAttribute("transform", "translate(" + px(i) + " " + py(Y[i]) + ")");
    }
    function renderTrail() {
      var d = "";
      for (var k = 0; k <= idx; k++) {
        var p = steps[k].i;
        d += (k === 0 ? "M" : "L") + px(p) + "," + py(Y[p]);
      }
      scene.trail.setAttribute("d", d);
    }
    function badgeTone(kind) {
      if (kind === "stuck-global") return "var(--accent)";
      if (kind === "stuck-local" || kind === "stuck-plateau") return "color-mix(in srgb, var(--ink) 78%, var(--accent) 22%)";
      if (kind === "downhill-reject") return "color-mix(in srgb, var(--ink-soft) 55%, var(--surface-2) 45%)";
      if (kind === "downhill-accept") return "color-mix(in srgb, var(--accent) 65%, var(--ink) 35%)";
      if (kind === "sideways") return "color-mix(in srgb, var(--accent) 50%, var(--ink-soft) 50%)";
      return "var(--accent)";
    }
    function renderCaption(s) {
      var tHtml = (mode === "sa" && s.T != null)
        ? '<span class="lsl-temp">T=' + s.T.toFixed(2) + "</span>" : "";
      panel.innerHTML =
        '<div class="lsl-badgerow"><span class="lsl-badge" style="background:' + badgeTone(s.kind) +
        '">' + s.badge + "</span>" + tHtml +
        '<b class="lsl-title">' + s.title + "</b></div>" +
        "<div>" + s.body + "</div>";
    }

    /* ---- start a fresh run from index i ---- */
    function startRun(i, isRestart) {
      stopAuto();
      lastStartI = i; placed = true;
      steps = (mode === "hc") ? genHillClimb(i) : genSA(i, T0);
      if (isRestart) {
        attempts++;
        var last = steps[steps.length - 1];
        if (mode === "hc" ? last.kind === "stuck-global" : nearGlobal(last.i)) hits++;
        updateStats();
      }
      go(0);
    }
    function randomRestart() { startRun(1 + Math.floor(Math.random() * (N - 2)), true); }

    /* ---- autoplay ---- */
    function toggleAuto() {
      if (!placed) { randomRestart(); return; }
      if (autoTimer) stopAuto(); else startAuto();
    }
    function startAuto() {
      if (idx >= steps.length - 1) go(0);
      btnRun.innerHTML = "⏸ עצור"; btnRun.classList.add("primary");
      var delay = reducedMotion() ? 500 : (mode === "sa" ? 220 : 550);
      autoTimer = setInterval(function () {
        if (idx >= steps.length - 1) { stopAuto(); return; }
        go(idx + 1);
      }, delay);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      btnRun.innerHTML = "▶ הרץ"; btnRun.classList.remove("primary");
    }

    /* ---- mode switch: re-run from the same starting point ---- */
    function setMode(m) {
      stopAuto(); mode = m;
      btnHC.classList.toggle("primary", m === "hc");
      btnSA.classList.toggle("primary", m === "sa");
      btnHC.setAttribute("aria-pressed", m === "hc" ? "true" : "false");
      btnSA.setAttribute("aria-pressed", m === "sa" ? "true" : "false");
      sliderRow.style.display = m === "sa" ? "flex" : "none";
      if (m === "sa") updateSliderLabels();
      attempts = 0; hits = 0; updateStats();
      if (placed) startRun(lastStartI, false);
    }

    /* ---- initial instructions (before any placement) ---- */
    function showIntro() {
      panel.innerHTML =
        '<div class="lsl-badgerow"><span class="lsl-badge" style="background:var(--accent)">התחלה</span>' +
        '<b class="lsl-title">לחצו על העקומה כדי להניח את המטפס</b></div>' +
        "<div>אחרי שהמטפס יונח, לחצו על " + ltr("▶ הרץ") + " כדי לטפס שכן-אחר-שכן עד שנתקעים, " +
        "או השתמשו ב" + ltr("→ הקודם") + "/" + ltr("הבא ←") + " כדי לעבור צעד-צעד. " +
        ltr("🎲 אתחול אקראי") + " מניח את המטפס במקום רנדומלי (ומצטבר בסטטיסטיקה למטה).</div>";
      counter.textContent = "";
      btnPrev.disabled = true; btnNext.disabled = true;
    }

    /* ---- interaction: click / hover on the curve ---- */
    scene.overlay.addEventListener("click", function (e) {
      startRun(idxFromClientX(scene.svg, e.clientX), false);
    });
    scene.overlay.addEventListener("mousemove", function (e) {
      var i = idxFromClientX(scene.svg, e.clientX);
      scene.ghost.setAttribute("cx", px(i));
      scene.ghost.setAttribute("cy", py(Y[i]));
      scene.ghost.setAttribute("opacity", "0.9");
    });
    scene.overlay.addEventListener("mouseleave", function () { scene.ghost.setAttribute("opacity", "0"); });

    /* keyboard: RTL-aware (Right = prev, Left = next), Space toggles run */
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { stopAuto(); go(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { stopAuto(); go(idx + 1); e.preventDefault(); }
      else if (e.key === "Home") { stopAuto(); go(0); e.preventDefault(); }
      else if (e.key === "End") { stopAuto(); go(steps.length - 1); e.preventDefault(); }
      else if ((e.key === " " || e.key === "Enter") && e.target === wrap) { toggleAuto(); e.preventDefault(); }
    });

    btnPrev.disabled = true; btnNext.disabled = true;
    showIntro();
  }

  /* =====================================================================
     Scoped styles — injected once, colours entirely via CSS custom
     properties (plus color-mix() on those tokens for extra tones).
     ===================================================================== */
  function injectStyle() {
    if (document.getElementById("lsl-style")) return;
    var s = document.createElement("style");
    s.id = "lsl-style";
    s.textContent =
      ".viz-local-search-lab{direction:rtl;--ls-area:color-mix(in srgb, var(--accent) 10%, transparent);" +
      "--ls-glow:color-mix(in srgb, var(--accent) 22%, transparent)}" +
      ".viz-local-search-lab .lsl-wrap{outline:none}" +
      ".viz-local-search-lab .lsl-lbl{font-weight:700;color:var(--ink);font-size:.85rem;align-self:center}" +
      ".viz-local-search-lab .lsl-slider-row{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;" +
      "font-size:.82rem;color:var(--ink-soft);margin-top:.5rem}" +
      ".viz-local-search-lab .lsl-slider-row input[type=range]{flex:1;min-width:120px;accent-color:var(--accent)}" +
      ".viz-local-search-lab .lsl-preview{flex-basis:100%;font-size:.78rem}" +
      ".viz-local-search-lab .lsl-scene{background:var(--surface);border:1px solid var(--line);" +
      "border-radius:12px;padding:8px 6px;margin-top:.7rem}" +
      ".viz-local-search-lab .lsl-svg{display:block;max-width:640px;margin:0 auto}" +
      ".viz-local-search-lab .lsl-overlay{cursor:pointer;touch-action:manipulation}" +
      ".viz-local-search-lab .lsl-stats{font-size:.8rem;color:var(--ink-soft);margin-top:.5rem}" +
      ".viz-local-search-lab .lsl-caption{background:var(--surface-2);border:1px solid var(--line);" +
      "border-radius:12px;padding:.8rem 1rem;margin-top:.8rem;min-height:76px;color:var(--ink);" +
      "line-height:1.7;font-size:.9rem}" +
      ".viz-local-search-lab .lsl-badgerow{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.4rem}" +
      ".viz-local-search-lab .lsl-badge{color:#fff;font-weight:700;font-size:.72rem;padding:.15rem .65rem;" +
      "border-radius:99px;white-space:nowrap}" +
      ".viz-local-search-lab .lsl-temp{font-family:monospace;font-size:.78rem;font-weight:700;color:var(--ink-soft);" +
      "direction:ltr;padding:.05rem .5rem;border:1px solid var(--line);border-radius:99px}" +
      ".viz-local-search-lab .lsl-title{font-size:1rem;color:var(--ink)}" +
      ".viz-local-search-lab .lsl-counter{margin-inline-start:auto;font-size:.82rem;font-weight:700;color:var(--ink-soft)}";
    document.head.appendChild(s);
  }

  /* =====================================================================
     boot — mount all instances; never throw; graceful if absent.
     ===================================================================== */
  function boot() {
    try {
      var mounts = document.querySelectorAll('[data-viz="' + VIZ_ID + '"]');
      if (!mounts || !mounts.length) return;
      injectStyle();
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
