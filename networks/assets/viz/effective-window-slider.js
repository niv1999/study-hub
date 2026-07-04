/* =====================================================================
   effective-window-slider.js  —  Module 12 "מחוון min(rwnd, cwnd) לתרגול"
   Grounded in:
     _notes/window-flow.md  §חלק ד'  "Effective Window = min(rwnd, cwnd)"
     _notes/congestion-rdt.md  §3  cwnd הפרמטר החשוב ביותר
     _notes/congestion-rdt.md  §10  "Triple Dance: Effective Window = min(rwnd, cwnd)"
     _notes/window-flow.md  §3  "Effective Window = min(rwnd, cwnd)"  (flow.pdf §3)
     "הריקוד המשולש" — cwnd (רשת) vs rwnd (נמען) → השולח בוחר את המינימום.

   Interactive dual-slider + scenario cards.
   Self-contained IIFE, hand-authored SVG/DOM. No external deps.
   RTL Hebrew captions, LTR technical labels. Cream design palette (CONTRACT §2).
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "effective-window-slider";

  /* ── design palette (CONTRACT §2 hex) ── */
  var C = {
    bg:       "#FBF7F0",
    surface:  "#FFFDF8",
    surface2: "#FBF5EA",
    ink:      "#33302B",
    inkSoft:  "#6B655C",
    line:     "#E7DECF",
    blue:     "#6E8CA0",   /* dusty-blue — cwnd */
    clay:     "#BE7C5E",   /* rwnd */
    sage:     "#7C9885",   /* effective window */
    mustard:  "#C9A24B"    /* accent / highlight */
  };

  /* ── reduced-motion helper ── */
  var prefersReducedMotion = (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  var TRANSITION = prefersReducedMotion ? "none" : "all 0.22s cubic-bezier(.4,0,.2,1)";

  /* ── scenario bank (grounded in notes) ── */
  var SCENARIOS = [
    {
      label:  "חיבור חדש (Slow Start)",
      desc:   "בתחילת חיבור TCP: cwnd = 10 MSS (14,600 B), rwnd שהוצהר ב-SYN-ACK = 65,535 B.",
      rwnd:   65535,
      cwnd:   14600,
      mss:    1460,
      hint:   "הרשת מגבילה — cwnd קטן בהרבה מ-rwnd. הבעיה: בקרת עומסים."
    },
    {
      label:  "שרת עמוס (Zero Window מתקרב)",
      desc:   "Apache עסוק: חוצץ קבלה נותר עם 2,920 B בלבד. cwnd = 40,000 B.",
      rwnd:   2920,
      cwnd:   40000,
      mss:    1460,
      hint:   "הנמען מגבבל — rwnd קטן משמעותית. הבעיה: בקרת זרימה."
    },
    {
      label:  "אחרי אובדן מנה (RTO Reset)",
      desc:   "פקע RTO Timeout. TCP מאפס cwnd = 1 MSS. rwnd = 32,000 B.",
      rwnd:   32000,
      cwnd:   1460,
      mss:    1460,
      hint:   "איפוס קשה: cwnd = 1 MSS. Slow Start מחדש. הבעיה: בקרת עומסים (RTO)."
    },
    {
      label:  "Congestion Avoidance בשיא",
      desc:   "cwnd גדל ליניארית ל-58,400 B (40 MSS). rwnd = 65,535 B.",
      rwnd:   65535,
      cwnd:   58400,
      mss:    1460,
      hint:   "קרוב לאיזון: cwnd ≈ rwnd. שניהם גדולים — צינור מנוצל היטב."
    },
    {
      label:  "Zero Window!",
      desc:   "האפליקציה המקבלת לא קוראת. חוצץ מלא: rwnd = 0. cwnd = 20,000 B.",
      rwnd:   0,
      cwnd:   20000,
      mss:    1460,
      hint:   "Zero Window — השולח עוצר לחלוטין. Persistent Timer יתחיל לשלוח Probe."
    }
  ];

  /* ── max display range (B) — covers all scenarios ── */
  var MAX_B = 70000;  /* 70,000 bytes displayed range */

  /* ═══════════════════════════════════════════════════════════════════
     render(mount)  —  builds the full component into the mount element
     ═══════════════════════════════════════════════════════════════════ */
  function render(mount) {
    if (!mount) return;

    /* ── state ── */
    var state = {
      rwnd: SCENARIOS[0].rwnd,
      cwnd: SCENARIOS[0].cwnd,
      mss:  SCENARIOS[0].mss,
      scenarioIdx: 0,
      showHint: false,
      quizAnswered: false
    };

    /* ── root container ── */
    mount.style.background = C.bg;
    mount.style.borderRadius = "14px";
    mount.style.padding = "0";
    mount.style.overflow = "hidden";
    mount.style.fontFamily = "'Heebo', 'Assistant', sans-serif";
    mount.style.direction = "rtl";

    /* ── build DOM ── */
    mount.innerHTML = "";
    var root = el("div", {
      style: {
        background: C.surface,
        borderRadius: "14px",
        border: "1px solid " + C.line,
        boxShadow: "0 2px 10px rgba(120,100,70,.08), 0 1px 3px rgba(120,100,70,.06)",
        overflow: "hidden"
      }
    });
    mount.appendChild(root);

    /* ── header ── */
    var header = el("div", {
      style: {
        background: C.surface2,
        borderBottom: "1px solid " + C.line,
        padding: "14px 18px 12px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap"
      }
    });
    var titleBox = el("div", { style: { flex: "1 1 auto" } });
    titleBox.appendChild(el("div", {
      style: { fontSize: "15px", fontWeight: "700", color: C.ink, lineHeight: "1.3" },
      text: "החלון האפקטיבי — "
    }));
    var titleEn = el("span", {
      dir: "ltr",
      style: { fontSize: "13px", fontWeight: "500", color: C.inkSoft },
      text: "Effective Window = min(rwnd, cwnd)"
    });
    titleBox.firstChild.appendChild(titleEn);
    var subtitle = el("div", {
      style: { fontSize: "12px", color: C.inkSoft, marginTop: "2px" },
      text: "הריקוד המשולש: הנמען (rwnd) × הרשת (cwnd) → השולח בוחר את המינימום"
    });
    titleBox.appendChild(subtitle);
    header.appendChild(titleBox);
    root.appendChild(header);

    /* ── body ── */
    var body = el("div", { style: { padding: "18px 18px 14px" } });
    root.appendChild(body);

    /* ── formula banner ── */
    var formulaBanner = el("div", {
      style: {
        background: C.surface2,
        border: "1px solid " + C.line,
        borderRadius: "10px",
        padding: "10px 14px",
        marginBottom: "18px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap"
      }
    });
    var formulaLabel = el("span", {
      style: { fontSize: "12px", color: C.inkSoft, whiteSpace: "nowrap" },
      text: "נוסחה:"
    });
    var formulaText = el("span", {
      dir: "ltr",
      style: {
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: "13px",
        fontWeight: "600",
        color: C.ink,
        letterSpacing: "0.02em"
      },
      text: "Effective Window = min(rwnd, cwnd)"
    });
    formulaBanner.appendChild(formulaLabel);
    formulaBanner.appendChild(formulaText);
    body.appendChild(formulaBanner);

    /* ── gauge section ── */
    var gaugeSection = el("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "12px",
        marginBottom: "20px"
      }
    });
    body.appendChild(gaugeSection);

    /* Gauge cards: rwnd, cwnd, effective */
    var rwndCard = buildGaugeCard({
      id: "rwnd-gauge",
      labelHe: "חלון הקבלה",
      labelEn: "rwnd",
      color: C.clay,
      desc: "מגבלת הנמען — כמה מקום בחוצץ הקבלה"
    });
    var cwndCard = buildGaugeCard({
      id: "cwnd-gauge",
      labelHe: "חלון העומס",
      labelEn: "cwnd",
      color: C.blue,
      desc: "מגבלת הרשת — כמה מותר לשלוח ל-in-flight"
    });
    var effCard = buildGaugeCard({
      id: "eff-gauge",
      labelHe: "חלון אפקטיבי",
      labelEn: "min(rwnd, cwnd)",
      color: C.sage,
      desc: "מה שהשולח בפועל רשאי להזרים לרשת"
    });
    gaugeSection.appendChild(rwndCard.card);
    gaugeSection.appendChild(cwndCard.card);
    gaugeSection.appendChild(effCard.card);

    /* ── min indicator (arrow between) ── */
    /* Visual bar comparing the three values */
    var barSection = el("div", {
      style: { marginBottom: "20px" }
    });
    var barLabel = el("div", {
      style: { fontSize: "11px", color: C.inkSoft, marginBottom: "8px", textAlign: "center" },
      text: "השוואה חזותית (סקאלה אחידה)"
    });
    barSection.appendChild(barLabel);

    var barContainer = el("div", {
      style: {
        background: C.surface2,
        border: "1px solid " + C.line,
        borderRadius: "10px",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px"
      }
    });
    var rwndBarRow = buildBarRow("rwnd", C.clay, "חלון הקבלה");
    var cwndBarRow = buildBarRow("cwnd", C.blue, "חלון העומס");
    var effBarRow  = buildBarRow("eff",  C.sage, "אפקטיבי");
    barContainer.appendChild(rwndBarRow.row);
    barContainer.appendChild(cwndBarRow.row);
    barContainer.appendChild(effBarRow.row);
    barSection.appendChild(barContainer);
    body.appendChild(barSection);

    /* ── sliders ── */
    var sliderSection = el("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "14px",
        marginBottom: "18px"
      }
    });
    body.appendChild(sliderSection);

    var rwndSlider = buildSlider({
      id: "rwnd-slider",
      labelHe: "rwnd",
      labelSub: "חוצץ קבלה של הנמען",
      color: C.clay,
      min: 0,
      max: MAX_B,
      value: state.rwnd,
      step: state.mss,
      onChange: function (v) {
        state.rwnd = v;
        state.showHint = false;
        state.quizAnswered = false;
        update();
      }
    });
    var cwndSlider = buildSlider({
      id: "cwnd-slider",
      labelHe: "cwnd",
      labelSub: "חלון עומסים (רשת)",
      color: C.blue,
      min: 0,
      max: MAX_B,
      value: state.cwnd,
      step: state.mss,
      onChange: function (v) {
        state.cwnd = v;
        state.showHint = false;
        state.quizAnswered = false;
        update();
      }
    });
    sliderSection.appendChild(rwndSlider.container);
    sliderSection.appendChild(cwndSlider.container);

    /* ── MSS info row ── */
    var mssRow = el("div", {
      style: {
        fontSize: "11px",
        color: C.inkSoft,
        textAlign: "center",
        marginBottom: "16px"
      }
    });
    var mssSpan = el("span", {
      dir: "ltr",
      style: { fontFamily: "monospace" },
      text: "MSS = 1460 B"
    });
    mssRow.appendChild(document.createTextNode("גודל סגמנט: "));
    mssRow.appendChild(mssSpan);
    mssRow.appendChild(document.createTextNode(" — החלון האפקטיבי = "));
    var mssCalc = el("span", {
      dir: "ltr",
      style: { fontFamily: "monospace", fontWeight: "600", color: C.sage }
    });
    mssRow.appendChild(mssCalc);
    mssRow.appendChild(document.createTextNode(" סגמנטים"));
    body.appendChild(mssRow);

    /* ── bottleneck badge ── */
    var bottleneckBadge = el("div", {
      style: {
        borderRadius: "9px",
        padding: "10px 14px",
        marginBottom: "18px",
        fontSize: "13px",
        fontWeight: "500",
        textAlign: "center",
        transition: TRANSITION
      }
    });
    body.appendChild(bottleneckBadge);

    /* ── scenario section ── */
    var scenarioSection = el("div", {
      style: {
        background: C.surface2,
        border: "1px solid " + C.line,
        borderRadius: "10px",
        padding: "14px 16px",
        marginBottom: "14px"
      }
    });
    var scenarioTitle = el("div", {
      style: {
        fontSize: "12px",
        fontWeight: "700",
        color: C.inkSoft,
        marginBottom: "10px",
        textTransform: "uppercase",
        letterSpacing: "0.06em"
      },
      text: "תרחישים לתרגול"
    });
    scenarioSection.appendChild(scenarioTitle);

    var scenarioBtns = el("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: "7px",
        marginBottom: "12px"
      }
    });
    SCENARIOS.forEach(function (sc, idx) {
      var btn = el("button", {
        cls: "viz-btn",
        style: {
          fontSize: "11px",
          padding: "5px 10px",
          borderRadius: "8px",
          border: "1px solid " + C.line,
          background: C.surface,
          color: C.ink,
          cursor: "pointer",
          transition: TRANSITION,
          fontFamily: "inherit"
        },
        text: sc.label
      });
      btn.addEventListener("click", function () {
        state.scenarioIdx = idx;
        state.rwnd = sc.rwnd;
        state.cwnd = sc.cwnd;
        state.mss  = sc.mss;
        state.showHint = false;
        state.quizAnswered = false;
        rwndSlider.input.value = sc.rwnd;
        cwndSlider.input.value = sc.cwnd;
        update();
      });
      btn._scenarioIdx = idx;
      scenarioBtns.appendChild(btn);
    });
    scenarioSection.appendChild(scenarioBtns);

    /* scenario description */
    var scenarioDesc = el("div", {
      style: {
        fontSize: "12px",
        color: C.inkSoft,
        lineHeight: "1.55",
        minHeight: "36px"
      }
    });
    scenarioSection.appendChild(scenarioDesc);

    /* hint row */
    var hintRow = el("div", {
      style: { marginTop: "10px", display: "flex", gap: "8px", alignItems: "flex-start" }
    });
    var hintBtn = el("button", {
      cls: "viz-btn",
      style: {
        fontSize: "11px",
        padding: "4px 10px",
        borderRadius: "7px",
        border: "1px solid " + C.mustard,
        background: C.surface,
        color: C.mustard,
        cursor: "pointer",
        fontWeight: "600",
        fontFamily: "inherit",
        transition: TRANSITION,
        whiteSpace: "nowrap"
      },
      text: "הצג ניתוח"
    });
    var hintText = el("div", {
      style: {
        fontSize: "12px",
        color: C.ink,
        lineHeight: "1.55",
        background: "#FFF8E8",
        border: "1px solid " + C.mustard,
        borderRadius: "7px",
        padding: "6px 10px",
        display: "none",
        flex: "1"
      }
    });
    hintBtn.addEventListener("click", function () {
      state.showHint = !state.showHint;
      update();
    });
    hintRow.appendChild(hintBtn);
    hintRow.appendChild(hintText);
    scenarioSection.appendChild(hintRow);
    body.appendChild(scenarioSection);

    /* ── controls row ── */
    var controlsRow = el("div", {
      cls: "viz-controls",
      style: {
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        justifyContent: "center"
      }
    });
    body.appendChild(controlsRow);

    function makeCtrlBtn(label, title, onClick) {
      var b = el("button", {
        cls: "viz-btn",
        style: {
          fontSize: "12px",
          padding: "6px 13px",
          borderRadius: "9px",
          border: "1px solid " + C.line,
          background: C.surface2,
          color: C.ink,
          cursor: "pointer",
          fontFamily: "inherit",
          transition: TRANSITION
        },
        text: label
      });
      if (title) b.title = title;
      b.addEventListener("click", onClick);
      controlsRow.appendChild(b);
      return b;
    }

    makeCtrlBtn("⟳ איפוס", "חזור לתרחיש הראשון", function () {
      state.scenarioIdx = 0;
      var sc = SCENARIOS[0];
      state.rwnd = sc.rwnd; state.cwnd = sc.cwnd; state.mss = sc.mss;
      state.showHint = false; state.quizAnswered = false;
      rwndSlider.input.value = sc.rwnd;
      cwndSlider.input.value = sc.cwnd;
      update();
    });

    makeCtrlBtn("rwnd ↑", "הגדל rwnd ב-MSS אחד", function () {
      state.rwnd = Math.min(MAX_B, state.rwnd + state.mss);
      rwndSlider.input.value = state.rwnd;
      update();
    });
    makeCtrlBtn("rwnd ↓", "הקטן rwnd ב-MSS אחד", function () {
      state.rwnd = Math.max(0, state.rwnd - state.mss);
      rwndSlider.input.value = state.rwnd;
      update();
    });
    makeCtrlBtn("cwnd ↑", "הגדל cwnd ב-MSS אחד", function () {
      state.cwnd = Math.min(MAX_B, state.cwnd + state.mss);
      cwndSlider.input.value = state.cwnd;
      update();
    });
    makeCtrlBtn("cwnd ↓", "הקטן cwnd ב-MSS אחד", function () {
      state.cwnd = Math.max(0, state.cwnd - state.mss);
      cwndSlider.input.value = state.cwnd;
      update();
    });

    /* ═══════════════════════════════════════════════════════════════
       update() — re-renders all live elements from state
       ═══════════════════════════════════════════════════════════════ */
    function update() {
      var rwnd = state.rwnd;
      var cwnd = state.cwnd;
      var eff  = Math.min(rwnd, cwnd);
      var mss  = state.mss;

      /* gauge values */
      rwndCard.setVal(fmtBytes(rwnd), rwnd / MAX_B, rwnd === 0 ? "Zero Window!" : "");
      cwndCard.setVal(fmtBytes(cwnd), cwnd / MAX_B, "");
      effCard.setVal(fmtBytes(eff),   eff  / MAX_B, eff === 0 ? "שידור עצור" : "");

      /* bars */
      rwndBarRow.setVal(rwnd, MAX_B);
      cwndBarRow.setVal(cwnd, MAX_B);
      effBarRow.setVal(eff, MAX_B);

      /* mss calc */
      var segs = mss > 0 ? Math.floor(eff / mss) : 0;
      mssCalc.textContent = segs + " × MSS";

      /* bottleneck badge */
      var isZero     = eff === 0;
      var rwndLimits = !isZero && rwnd <= cwnd;
      var cwndLimits = !isZero && cwnd < rwnd;
      var balanced   = !isZero && Math.abs(rwnd - cwnd) < mss * 2;

      if (isZero) {
        bottleneckBadge.style.background = "#FDE8E8";
        bottleneckBadge.style.color = "#B33";
        bottleneckBadge.style.border = "1px solid #F5B5B5";
        bottleneckBadge.textContent = "⛔ Zero Window — השולח עוצר לחלוטין. Persistent Timer יתחיל Zero Window Probe.";
      } else if (balanced) {
        bottleneckBadge.style.background = "#EDF5EE";
        bottleneckBadge.style.color = "#3A6044";
        bottleneckBadge.style.border = "1px solid " + C.sage;
        bottleneckBadge.textContent = "✓ איזון: cwnd ≈ rwnd — הצינור מנוצל בצורה אופטימלית.";
      } else if (rwndLimits) {
        bottleneckBadge.style.background = "#FBF0EB";
        bottleneckBadge.style.color = "#7A3C1F";
        bottleneckBadge.style.border = "1px solid " + C.clay;
        bottleneckBadge.textContent = "🔶 צוואר בקבוק: rwnd < cwnd — הנמען מגביל (בקרת זרימה).";
      } else {
        bottleneckBadge.style.background = "#EBF1F5";
        bottleneckBadge.style.color = "#1F3C5A";
        bottleneckBadge.style.border = "1px solid " + C.blue;
        bottleneckBadge.textContent = "🔷 צוואר בקבוק: cwnd < rwnd — הרשת מגביבלת (בקרת עומסים).";
      }

      /* scenario buttons highlight */
      Array.from(scenarioBtns.children).forEach(function (b, i) {
        if (i === state.scenarioIdx) {
          b.style.background = C.surface2;
          b.style.borderColor = C.mustard;
          b.style.fontWeight = "700";
        } else {
          b.style.background = C.surface;
          b.style.borderColor = C.line;
          b.style.fontWeight = "400";
        }
      });

      /* scenario desc & hint */
      var sc = SCENARIOS[state.scenarioIdx];
      scenarioDesc.textContent = sc ? sc.desc : "";
      if (state.showHint && sc) {
        hintText.textContent = sc.hint;
        hintText.style.display = "block";
        hintBtn.textContent = "הסתר ניתוח";
      } else {
        hintText.style.display = "none";
        hintBtn.textContent = "הצג ניתוח";
      }

      /* slider value labels */
      rwndSlider.setLabel(fmtBytes(rwnd));
      cwndSlider.setLabel(fmtBytes(cwnd));
    }

    /* ── initial render ── */
    update();

    /* ── keyboard navigation for sliders ── */
    [rwndSlider.input, cwndSlider.input].forEach(function (inp) {
      inp.addEventListener("input", function () {
        var which = inp === rwndSlider.input ? "rwnd" : "cwnd";
        state[which] = parseInt(inp.value, 10) || 0;
        update();
      });
    });
  } /* end render() */

  /* ══════════════════════════════════════════════════════════════════
     buildGaugeCard(opts) — creates a card with circular-ish gauge bar
     ══════════════════════════════════════════════════════════════════ */
  function buildGaugeCard(opts) {
    var card = el("div", {
      style: {
        background: "#FFFDF8",
        border: "1px solid #E7DECF",
        borderRadius: "12px",
        padding: "12px 10px 10px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
        minWidth: "0"
      }
    });

    var labelHe = el("div", {
      style: { fontSize: "11px", fontWeight: "700", color: "#6B655C", textAlign: "center" },
      text: opts.labelHe
    });
    var labelEn = el("span", {
      dir: "ltr",
      style: {
        fontSize: "10px",
        fontFamily: "'JetBrains Mono', monospace",
        color: opts.color,
        fontWeight: "600"
      },
      text: opts.labelEn
    });
    card.appendChild(labelHe);
    card.appendChild(labelEn);

    /* arc gauge using SVG */
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 80 50");
    svg.setAttribute("width", "80");
    svg.setAttribute("height", "50");
    svg.setAttribute("aria-hidden", "true");

    /* background arc (track) */
    var trackArc = document.createElementNS(svgNS, "path");
    trackArc.setAttribute("d", describeArc(40, 45, 34, -175, -5));
    trackArc.setAttribute("fill", "none");
    trackArc.setAttribute("stroke", "#E7DECF");
    trackArc.setAttribute("stroke-width", "7");
    trackArc.setAttribute("stroke-linecap", "round");
    svg.appendChild(trackArc);

    /* value arc */
    var valueArc = document.createElementNS(svgNS, "path");
    valueArc.setAttribute("fill", "none");
    valueArc.setAttribute("stroke", opts.color);
    valueArc.setAttribute("stroke-width", "7");
    valueArc.setAttribute("stroke-linecap", "round");
    if (!prefersReducedMotion) {
      valueArc.style.transition = "d 0.22s ease, stroke 0.22s ease";
    }
    svg.appendChild(valueArc);

    card.appendChild(svg);

    /* value text */
    var valueText = el("div", {
      style: {
        fontSize: "14px",
        fontWeight: "800",
        color: opts.color,
        fontFamily: "'JetBrains Mono', monospace",
        textAlign: "center",
        lineHeight: "1"
      }
    });
    card.appendChild(valueText);

    /* zero badge */
    var zeroBadge = el("div", {
      style: {
        fontSize: "10px",
        fontWeight: "600",
        color: "#B33",
        background: "#FDE8E8",
        border: "1px solid #F5B5B5",
        borderRadius: "5px",
        padding: "1px 6px",
        display: "none"
      }
    });
    card.appendChild(zeroBadge);

    /* desc */
    var descEl = el("div", {
      style: {
        fontSize: "9px",
        color: "#6B655C",
        textAlign: "center",
        lineHeight: "1.4",
        marginTop: "2px"
      },
      text: opts.desc
    });
    card.appendChild(descEl);

    function setVal(valStr, ratio, badge) {
      valueText.textContent = valStr;
      /* clamp ratio 0..1 */
      var r = Math.max(0, Math.min(1, ratio));
      var startAngle = -175;
      var endAngle   = -5;
      var angle = startAngle + r * (endAngle - startAngle);
      if (r <= 0.001) {
        valueArc.setAttribute("d", "M0,0"); /* invisible */
      } else {
        valueArc.setAttribute("d", describeArc(40, 45, 34, startAngle, angle));
      }
      if (badge) {
        zeroBadge.textContent = badge;
        zeroBadge.style.display = "block";
        valueArc.setAttribute("stroke", "#C86B5A");
      } else {
        zeroBadge.style.display = "none";
        valueArc.setAttribute("stroke", opts.color);
      }
    }

    return { card: card, setVal: setVal };
  }

  /* ══════════════════════════════════════════════════════════════════
     buildBarRow(id, color, labelText) — horizontal bar row
     ══════════════════════════════════════════════════════════════════ */
  function buildBarRow(id, color, labelText) {
    var row = el("div", {
      style: { display: "flex", alignItems: "center", gap: "8px" }
    });
    var label = el("div", {
      style: {
        fontSize: "10px",
        color: "#6B655C",
        width: "72px",
        textAlign: "right",
        flexShrink: "0",
        fontWeight: "500"
      },
      text: labelText
    });
    var track = el("div", {
      style: {
        flex: "1",
        height: "10px",
        background: "#E7DECF",
        borderRadius: "5px",
        overflow: "hidden",
        position: "relative"
      }
    });
    var fill = el("div", {
      style: {
        height: "100%",
        background: color,
        borderRadius: "5px",
        width: "0%",
        transition: prefersReducedMotion ? "none" : "width 0.22s ease"
      }
    });
    track.appendChild(fill);
    var valLabel = el("div", {
      dir: "ltr",
      style: {
        fontSize: "10px",
        color: "#33302B",
        width: "72px",
        textAlign: "left",
        flexShrink: "0",
        fontFamily: "monospace"
      }
    });
    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(valLabel);

    function setVal(val, max) {
      var pct = max > 0 ? Math.min(100, (val / max) * 100) : 0;
      fill.style.width = pct + "%";
      valLabel.textContent = fmtBytes(val);
    }
    return { row: row, setVal: setVal };
  }

  /* ══════════════════════════════════════════════════════════════════
     buildSlider(opts) — labeled range input with value display
     ══════════════════════════════════════════════════════════════════ */
  function buildSlider(opts) {
    var container = el("div", {
      style: {
        background: "#FFFDF8",
        border: "1px solid #E7DECF",
        borderRadius: "10px",
        padding: "10px 12px"
      }
    });

    var topRow = el("div", {
      style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }
    });
    var nameBox = el("div");
    var nameHe = el("span", {
      style: { fontSize: "11px", fontWeight: "700", color: opts.color },
      text: opts.labelSub + " — "
    });
    var nameEn = el("span", {
      dir: "ltr",
      style: { fontSize: "12px", fontWeight: "800", color: opts.color, fontFamily: "monospace" },
      text: opts.labelHe
    });
    nameBox.appendChild(nameHe);
    nameBox.appendChild(nameEn);
    topRow.appendChild(nameBox);

    var valDisp = el("span", {
      dir: "ltr",
      style: {
        fontSize: "12px",
        fontWeight: "700",
        color: opts.color,
        fontFamily: "monospace"
      }
    });
    topRow.appendChild(valDisp);
    container.appendChild(topRow);

    var input = document.createElement("input");
    input.type = "range";
    input.min  = String(opts.min);
    input.max  = String(opts.max);
    input.step = String(opts.step || 1);
    input.value = String(opts.value);
    input.setAttribute("aria-label", opts.labelHe + " slider");
    /* style the range input */
    input.style.width = "100%";
    input.style.accentColor = opts.color;
    input.style.margin = "4px 0 2px";
    input.style.cursor = "pointer";
    container.appendChild(input);

    var subLabel = el("div", {
      style: { fontSize: "10px", color: "#6B655C" },
      text: opts.labelSub
    });
    container.appendChild(subLabel);

    function setLabel(txt) { valDisp.textContent = txt; }

    input.addEventListener("input", function () {
      opts.onChange(parseInt(input.value, 10) || 0);
    });

    return { container: container, input: input, setLabel: setLabel };
  }

  /* ══════════════════════════════════════════════════════════════════
     helpers
     ══════════════════════════════════════════════════════════════════ */

  /* SVG arc path — cx,cy = center; r = radius; startDeg, endDeg in degrees */
  function describeArc(cx, cy, r, startDeg, endDeg) {
    var s = polarToXY(cx, cy, r, startDeg);
    var e = polarToXY(cx, cy, r, endDeg);
    var largeArc = (endDeg - startDeg) > 180 ? 1 : 0;
    return [
      "M", s.x, s.y,
      "A", r, r, 0, largeArc, 1, e.x, e.y
    ].join(" ");
  }
  function polarToXY(cx, cy, r, deg) {
    var rad = (deg - 90) * Math.PI / 180;
    return { x: +(cx + r * Math.cos(rad)).toFixed(3), y: +(cy + r * Math.sin(rad)).toFixed(3) };
  }

  function fmtBytes(b) {
    if (b === 0) return "0 B";
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
    return (b / (1024 * 1024)).toFixed(2) + " MB";
  }

  function el(tag, opts) {
    var node = document.createElement(tag);
    opts = opts || {};
    if (opts.cls) node.className = opts.cls;
    if (opts.dir) node.setAttribute("dir", opts.dir);
    if (opts.style) {
      Object.keys(opts.style).forEach(function (k) {
        node.style[k] = opts.style[k];
      });
    }
    if (opts.text) node.textContent = opts.text;
    return node;
  }

  /* ══════════════════════════════════════════════════════════════════
     boot
     ══════════════════════════════════════════════════════════════════ */
  function boot() {
    document.querySelectorAll('[data-viz="' + VIZ_ID + '"]').forEach(function (mount) {
      try { render(mount); } catch (err) { console.error("[" + VIZ_ID + "]", err); }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();
