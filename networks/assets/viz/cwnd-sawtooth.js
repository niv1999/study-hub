/* =====================================================================
   cwnd-sawtooth.js  —  Module 10 "בקרת עומסים (Congestion Control)"
   Grounded in _notes/congestion-rdt.md  חלק א' (§3–8) + "דיאגרמה A".

   Draws the classic cwnd-vs-time (in RTTs) graph the lecturer describes,
   as an EVENT-DRIVEN simulator. The learner presses event buttons and the
   line is built in real time — exactly the interactive dynamic proposed in
   the notes ("כפתורי 'ACK מוצלח', 'Triple Dup ACK', 'RTO Timeout' … סליידר
   ל-ssthresh התחלתי").

   Exact model (verbatim from the notes):
   ─ cwnd measured in MSS ; X axis = time in RTTs (§3, §4, "דיאגרמה A").
   ─ Slow Start (§4.1, §8): cwnd DOUBLES each RTT (exponential). The notes'
       numeric example: 10 → 20 → 40, and the ssthresh example: 1,2,4,8,16.
   ─ Transition (§8.2): when cwnd >= ssthresh → switch to Congestion
       Avoidance.
   ─ Congestion Avoidance / AIMD (§4.2, §8.1): +1 MSS per RTT (linear) —
       "מ-20 ל-40 לוקח 20 RTT".
   ─ Triple Dup ACK / Fast Retransmit (§6.א, §8.3): cwnd → HALF of current
       ("לרוב חצי מהערך הנוכחי"); ssthresh ← that half; controlled slow-down,
       resume growth (fast recovery, linear) — this makes the SAWTOOTH (§8.4).
   ─ RTO Timeout / Hard Reset (§6.ב): cwnd → 1 MSS ; ssthresh ← half of the
       value that caused the loss ; return to Slow Start ("הפחד של TCP").
   ─ ssthresh (§5, §8.3): the exponential↔linear switch point; on every loss
       it drops to half the value that triggered the loss; a brand-new
       connection starts with ssthresh = ∞ (§5, "Wall").

   MAY use Chart.js (CONTRACT §6): if window.Chart is undefined we inject the
   CDN script and render on load. Self-contained IIFE; cream tokens hardcoded
   (§2); day-3 accent = sage. RTL-aware (Hebrew captions, English tech LTR).
   Accessible real <button>s, keyboard, prefers-reduced-motion; degrades if
   the mount is absent; throws no console errors.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "cwnd-sawtooth";
  var CDN = "https://cdn.jsdelivr.net/npm/chart.js";

  /* --- design palette (hardcoded per CONTRACT §2) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",    /* dusty-blue — Slow Start (exponential probe) */
    clay: "#BE7C5E",    /* clay — loss events / drops */
    sage: "#7C9885",    /* sage — day-3 accent / Congestion Avoidance */
    mustard: "#C9A24B"  /* mustard — ssthresh line */
  };

  function reducedMotion() {
    return !!(window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  /* =====================================================================
     MODEL — the exact cwnd state machine from the notes.
     phase: "ss" (Slow Start, ×2/RTT) | "ca" (Congestion Avoidance, +1/RTT)
     Each event advances time by one RTT and pushes a point + a log line.
     ===================================================================== */
  var INF = 64; /* practical "∞" for a fresh connection's ssthresh (§5) */

  function newState(startCwnd, startSsthresh) {
    return {
      t: 0,
      cwnd: startCwnd,
      ssthresh: startSsthresh,
      phase: startCwnd >= startSsthresh ? "ca" : "ss",
      history: [],        /* {t, cwnd, phase, event} */
      ssHistory: [],      /* {t, ssthresh} step points for the dashed line */
      log: []             /* {kind, he} */
    };
  }

  /* apply one event, mutate state, return a log entry */
  function applyEvent(s, kind) {
    var before = s.cwnd;
    var note = "";

    if (kind === "ack") {
      s.t += 1;
      if (s.phase === "ss") {
        /* §4.1 / §8 — doubling each RTT (exponential) */
        s.cwnd = s.cwnd * 2;
        if (s.cwnd >= s.ssthresh) {
          /* §8.2 — clamp at ssthresh & switch to linear */
          s.cwnd = s.ssthresh;
          s.phase = "ca";
          note = "Slow Start: הכפלה (" + before + "→" + s.cwnd +
            "). הגענו ל-ssthresh → מעבר ל-Congestion Avoidance.";
        } else {
          note = "Slow Start: cwnd הוכפל " + before + "→" + s.cwnd +
            " MSS (גידול מעריכי, +1 MSS לכל ACK).";
        }
      } else {
        /* §4.2 / §8.1 — AIMD additive increase, +1 MSS per RTT */
        s.cwnd = s.cwnd + 1;
        note = "Congestion Avoidance: +1 MSS ל-RTT (" + before + "→" +
          s.cwnd + "). דגימה זהירה של רוחב הפס.";
      }
    } else if (kind === "dupack") {
      /* §6.א / §8.3 — Fast Retransmit: halve, ssthresh←half, stay running */
      s.t += 1;
      var half = Math.max(1, Math.floor(s.cwnd / 2));
      s.ssthresh = half;
      s.cwnd = half;
      s.phase = "ca"; /* fast recovery → linear growth resumes */
      note = "Triple Dup ACK (Fast Retransmit): האטה מבוקרת — cwnd→חצי (" +
        before + "→" + s.cwnd + "), ssthresh←" + s.ssthresh +
        ". ממשיכים לרוץ ליניארית → שן המסור.";
    } else if (kind === "rto") {
      /* §6.ב — Hard Reset: cwnd→1, ssthresh←half of loss value, back to SS */
      s.t += 1;
      s.ssthresh = Math.max(2, Math.floor(before / 2));
      s.cwnd = 1;
      s.phase = "ss";
      note = "RTO Timeout (Hard Reset): 'הפחד' של TCP — cwnd→1 MSS, " +
        "ssthresh←" + s.ssthresh + ". חוזרים ל-Slow Start מההתחלה.";
    }

    s.history.push({ t: s.t, cwnd: s.cwnd, phase: s.phase, event: kind });
    s.ssHistory.push({ t: s.t, ssthresh: s.ssthresh });
    var entry = { kind: kind, he: note, t: s.t, cwnd: s.cwnd };
    s.log.push(entry);
    return entry;
  }

  /* seed the history with the starting point at t=0 */
  function seedHistory(s) {
    s.history.push({ t: 0, cwnd: s.cwnd, phase: s.phase, event: "start" });
    s.ssHistory.push({ t: 0, ssthresh: s.ssthresh });
  }

  /* =====================================================================
     RENDER
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-cwnd-ready") === "1") return;
    mount.setAttribute("data-cwnd-ready", "1");
    mount.setAttribute("dir", "rtl");

    /* --- scoped styles (once) --- */
    injectStyle();

    var startSsthresh = 16; /* matches the §8.2 example ssthresh = 16 */
    var startCwnd = 1;      /* the ssthresh example runs 1,2,4,8,16 */
    var state = newState(startCwnd, startSsthresh);
    seedHistory(state);

    /* ---- layout skeleton ---- */
    var root = el("div", "cw-root");

    /* status strip */
    var strip = el("div", "cw-strip");
    var mCwnd = stat("cwnd", "0", C.blue);
    var mSs = stat("ssthresh", "0", C.mustard);
    var mPhase = stat("phase", "—", C.sage);
    var mRtt = stat("RTT (time)", "0", C.inkSoft);
    strip.appendChild(mCwnd.box);
    strip.appendChild(mSs.box);
    strip.appendChild(mPhase.box);
    strip.appendChild(mRtt.box);
    root.appendChild(strip);

    /* chart canvas */
    var chartWrap = el("div", "cw-chart");
    var canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label",
      "גרף cwnd (ב-MSS) מול זמן (ב-RTT): Slow Start מעריכי, " +
      "Congestion Avoidance ליניארי, נפילות באובדן — תבנית שן המסור.");
    chartWrap.appendChild(canvas);
    root.appendChild(chartWrap);

    /* live log (aria-live) */
    var logLine = el("p", "cw-logline");
    logLine.setAttribute("aria-live", "polite");
    logLine.textContent =
      "לחצו על אירוע כדי לבנות את הגרף. חיבור חדש: cwnd = 1 MSS, ssthresh = " +
      startSsthresh + " MSS.";
    root.appendChild(logLine);

    /* ---- ssthresh slider ---- */
    var sliderRow = el("div", "cw-slider-row");
    var sLabel = el("label", "cw-slider-label");
    var sSpanA = el("span", null, "ssthresh התחלתי: ");
    var sVal = el("span", "cw-slider-val", String(startSsthresh) + " MSS");
    sLabel.appendChild(sSpanA);
    sLabel.appendChild(sVal);
    var slider = document.createElement("input");
    slider.type = "range";
    slider.min = "2";
    slider.max = "48";
    slider.step = "1";
    slider.value = String(startSsthresh);
    slider.className = "cw-slider";
    slider.setAttribute("aria-label", "ssthresh התחלתי ב-MSS");
    sLabel.setAttribute("for", "cw-ss-" + Math.random().toString(36).slice(2));
    slider.id = sLabel.getAttribute("for");
    sliderRow.appendChild(sLabel);
    sliderRow.appendChild(slider);
    root.appendChild(sliderRow);

    /* ---- controls ---- */
    var controls = el("div", "viz-controls");
    var bAck = btn("✅ ACK מוצלח", "primary");
    var bDup = btn("⚡ Triple Dup ACK");
    var bRto = btn("⏱ RTO Timeout");
    var bDemo = btn("▶ הדגמה אוטומטית");
    var bReset = btn("↺ אפס");
    controls.appendChild(bAck);
    controls.appendChild(bDup);
    controls.appendChild(bRto);
    controls.appendChild(bDemo);
    controls.appendChild(bReset);
    root.appendChild(controls);

    /* legend */
    var legend = el("div", "cw-legend");
    legend.appendChild(legItem(C.blue, "Slow Start (מעריכי ×2)"));
    legend.appendChild(legItem(C.sage, "Congestion Avoidance (AIMD +1)"));
    legend.appendChild(legItem(C.clay, "אירוע Loss (נפילה)"));
    legend.appendChild(legItem(C.mustard, "ssthresh (סף)", true));
    root.appendChild(legend);

    mount.innerHTML = "";
    mount.appendChild(root);

    /* ---------- state wiring ---------- */
    var chart = null;
    var demoTimer = null;

    function refreshStrip(lastNote) {
      mCwnd.val.textContent = state.cwnd + " MSS";
      mSs.val.textContent =
        (state.ssthresh >= INF ? "∞" : state.ssthresh + " MSS");
      mPhase.val.textContent =
        state.phase === "ss" ? "Slow Start" : "Cong. Avoidance";
      mPhase.val.style.color = state.phase === "ss" ? C.blue : C.sage;
      mRtt.val.textContent = String(state.t);
      if (lastNote) logLine.textContent = lastNote;
    }

    function doEvent(kind) {
      var entry = applyEvent(state, kind);
      refreshStrip(entry.he);
      updateChart();
    }

    function resetAll(newSsthresh) {
      stopDemo();
      state = newState(1, newSsthresh);
      seedHistory(state);
      refreshStrip(
        "אופס. חיבור חדש: cwnd = 1 MSS, ssthresh = " + newSsthresh + " MSS.");
      buildChart();
    }

    /* ---- events ---- */
    bAck.addEventListener("click", function () { doEvent("ack"); });
    bDup.addEventListener("click", function () { doEvent("dupack"); });
    bRto.addEventListener("click", function () { doEvent("rto"); });
    bReset.addEventListener("click", function () {
      resetAll(parseInt(slider.value, 10));
    });

    slider.addEventListener("input", function () {
      var v = parseInt(slider.value, 10);
      sVal.textContent = v + " MSS";
    });
    slider.addEventListener("change", function () {
      resetAll(parseInt(slider.value, 10));
    });

    /* auto demo: a full sawtooth story (ACKs → dup ACK → grow → RTO …) */
    var demoScript = [
      "ack", "ack", "ack", "ack",      /* Slow Start climb to ssthresh */
      "ack", "ack", "ack", "ack", "ack", "ack", /* AIMD linear rise */
      "dupack",                        /* Triple Dup ACK → halve (sawtooth) */
      "ack", "ack", "ack", "ack", "ack", "ack", "ack", "ack",
      "rto",                           /* Hard Reset → back to Slow Start */
      "ack", "ack", "ack"
    ];
    function stopDemo() {
      if (demoTimer) { clearInterval(demoTimer); demoTimer = null; }
      bDemo.classList.remove("primary");
      bDemo.textContent = "▶ הדגמה אוטומטית";
      setBtns(false);
    }
    bDemo.addEventListener("click", function () {
      if (demoTimer) { stopDemo(); return; }
      /* start fresh so the demo always tells the full story */
      state = newState(1, parseInt(slider.value, 10));
      seedHistory(state);
      buildChart();
      refreshStrip("הדגמה: בונים sawtooth שלם — Slow Start, AIMD, נפילות.");
      bDemo.classList.add("primary");
      bDemo.textContent = "⏸ עצור הדגמה";
      setBtns(true);
      var i = 0;
      var interval = reducedMotion() ? 90 : 620;
      demoTimer = setInterval(function () {
        if (i >= demoScript.length) { stopDemo(); return; }
        doEvent(demoScript[i]);
        i++;
      }, interval);
    });
    function setBtns(disabled) {
      bAck.disabled = disabled;
      bDup.disabled = disabled;
      bRto.disabled = disabled;
      bReset.disabled = disabled;
      slider.disabled = disabled;
    }

    /* =================================================================
       CHART.JS glue
       ================================================================= */
    function segColorForPoint(ctx) {
      /* color each line segment by the destination point's meaning:
         a drop segment (loss) = clay; ss = blue; ca = sage */
      var pts = state.history;
      var idx = ctx.p1DataIndex;
      var p = pts[idx];
      if (!p) return C.sage;
      if (p.event === "dupack" || p.event === "rto") return C.clay;
      if (p.phase === "ss") return C.blue;
      return C.sage;
    }

    function pointStyle(ctx) {
      var p = state.history[ctx.dataIndex];
      if (!p) return C.sage;
      if (p.event === "dupack") return C.clay;
      if (p.event === "rto") return "#9c4f34"; /* darker clay for hard reset */
      if (p.phase === "ss") return C.blue;
      return C.sage;
    }
    function pointRadius(ctx) {
      var p = state.history[ctx.dataIndex];
      if (!p) return 3;
      if (p.event === "dupack" || p.event === "rto") return 5.5;
      return 3.2;
    }

    function cwndData() {
      return state.history.map(function (p) { return { x: p.t, y: p.cwnd }; });
    }
    function ssData() {
      return state.ssHistory.map(function (p) {
        return { x: p.t, y: (p.ssthresh >= INF ? null : p.ssthresh) };
      });
    }
    function xMax() {
      var last = state.history[state.history.length - 1];
      return Math.max(8, (last ? last.t : 0) + 2);
    }
    function yMax() {
      var m = 0, i;
      for (i = 0; i < state.history.length; i++) {
        if (state.history[i].cwnd > m) m = state.history[i].cwnd;
      }
      for (i = 0; i < state.ssHistory.length; i++) {
        var v = state.ssHistory[i].ssthresh;
        if (v < INF && v > m) m = v;
      }
      return Math.max(20, Math.ceil((m + 2) / 4) * 4);
    }

    function buildChart() {
      if (chart) { chart.destroy(); chart = null; }
      var animate = !reducedMotion();
      chart = new window.Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
          datasets: [
            {
              label: "cwnd",
              data: cwndData(),
              parsing: false,
              borderColor: C.blue,
              borderWidth: 2.6,
              tension: 0,
              stepped: false,
              pointBackgroundColor: pointStyle,
              pointBorderColor: C.surface,
              pointBorderWidth: 1.4,
              pointRadius: pointRadius,
              pointHoverRadius: 7,
              segment: { borderColor: segColorForPoint },
              order: 1
            },
            {
              label: "ssthresh",
              data: ssData(),
              parsing: false,
              borderColor: C.mustard,
              borderWidth: 1.8,
              borderDash: [6, 5],
              stepped: true,
              pointRadius: 0,
              pointHoverRadius: 0,
              spanGaps: false,
              tension: 0,
              order: 2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: animate ? { duration: 350 } : false,
          interaction: { mode: "nearest", intersect: false },
          layout: { padding: { top: 6, right: 8, bottom: 2, left: 2 } },
          scales: {
            x: {
              type: "linear",
              min: 0,
              max: xMax(),
              title: {
                display: true,
                text: "time  (RTT)",
                color: C.inkSoft,
                font: { family: "'Heebo', sans-serif", size: 12, weight: "600" }
              },
              ticks: {
                color: C.inkSoft,
                stepSize: 1,
                font: { family: "'JetBrains Mono', monospace", size: 10 }
              },
              grid: { color: "rgba(231,222,207,.65)" },
              border: { color: C.line }
            },
            y: {
              min: 0,
              max: yMax(),
              title: {
                display: true,
                text: "cwnd  (MSS)",
                color: C.inkSoft,
                font: { family: "'Heebo', sans-serif", size: 12, weight: "600" }
              },
              ticks: {
                color: C.inkSoft,
                font: { family: "'JetBrains Mono', monospace", size: 10 }
              },
              grid: { color: "rgba(231,222,207,.65)" },
              border: { color: C.line }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: C.ink,
              titleColor: "#FBF7F0",
              bodyColor: "#FBF7F0",
              borderColor: C.line,
              borderWidth: 1,
              padding: 10,
              displayColors: false,
              callbacks: {
                title: function (items) {
                  if (!items.length) return "";
                  return "RTT " + items[0].parsed.x;
                },
                label: function (item) {
                  if (item.datasetIndex === 1) {
                    return "ssthresh = " + item.parsed.y + " MSS";
                  }
                  var p = state.history[item.dataIndex];
                  var lines = ["cwnd = " + item.parsed.y + " MSS"];
                  if (p) {
                    if (p.event === "dupack") lines.push("Triple Dup ACK → ½");
                    else if (p.event === "rto") lines.push("RTO → reset to 1");
                    else if (p.phase === "ss") lines.push("Slow Start (×2)");
                    else if (p.event !== "start") lines.push("Cong. Avoidance (+1)");
                  }
                  return lines;
                }
              }
            }
          }
        }
      });
    }

    function updateChart() {
      if (!chart) { buildChart(); return; }
      chart.data.datasets[0].data = cwndData();
      chart.data.datasets[1].data = ssData();
      chart.options.scales.x.max = xMax();
      chart.options.scales.y.max = yMax();
      chart.update(reducedMotion() ? "none" : undefined);
    }

    refreshStrip();
    buildChart();

    /* clean up demo timer if the node is torn out */
    mount._cwCleanup = stopDemo;
  }

  /* =====================================================================
     small UI builders
     ===================================================================== */
  function stat(labelTxt, valTxt, color) {
    var box = el("div", "cw-stat");
    var lab = el("span", "cw-stat-lab", labelTxt);
    lab.setAttribute("dir", "ltr");
    var val = el("span", "cw-stat-val", valTxt);
    val.style.color = color;
    box.appendChild(lab);
    box.appendChild(val);
    return { box: box, val: val };
  }
  function btn(txt, extra) {
    var b = el("button", "viz-btn" + (extra ? " " + extra : ""), txt);
    b.type = "button";
    return b;
  }
  function legItem(color, txt, dashed) {
    var it = el("span", "cw-leg");
    var sw = el("span", "cw-swatch");
    if (dashed) {
      sw.style.background = "transparent";
      sw.style.borderTop = "2px dashed " + color;
      sw.style.height = "0";
    } else {
      sw.style.background = color;
    }
    it.appendChild(sw);
    it.appendChild(el("span", null, txt));
    return it;
  }

  /* =====================================================================
     scoped CSS (cream tokens, injected once)
     ===================================================================== */
  var STYLE_DONE = false;
  function injectStyle() {
    if (STYLE_DONE) return;
    STYLE_DONE = true;
    var css = [
      ".cw-root{display:flex;flex-direction:column;gap:.9rem;font-family:'Heebo','Assistant',sans-serif;color:" + C.ink + ";}",
      ".cw-strip{display:flex;flex-wrap:wrap;gap:.6rem;}",
      ".cw-stat{flex:1 1 110px;min-width:100px;background:" + C.surface2 + ";border:1px solid " + C.line + ";border-radius:10px;padding:.5rem .7rem;display:flex;flex-direction:column;gap:.15rem;}",
      ".cw-stat-lab{font-size:.72rem;letter-spacing:.02em;color:" + C.inkSoft + ";font-family:'JetBrains Mono',monospace;}",
      ".cw-stat-val{font-size:1.12rem;font-weight:800;font-family:'JetBrains Mono',monospace;line-height:1.1;}",
      ".cw-chart{position:relative;height:300px;width:100%;background:" + C.surface + ";border:1px solid " + C.line + ";border-radius:12px;padding:.5rem .6rem .3rem;}",
      "@media(max-width:520px){.cw-chart{height:240px;}}",
      ".cw-logline{margin:0;font-size:.9rem;line-height:1.55;color:" + C.ink + ";background:" + C.surface2 + ";border:1px solid " + C.line + ";border-radius:10px;padding:.6rem .8rem;min-height:1.2em;}",
      ".cw-slider-row{display:flex;flex-direction:column;gap:.35rem;}",
      ".cw-slider-label{font-size:.86rem;color:" + C.inkSoft + ";display:flex;gap:.25rem;align-items:baseline;}",
      ".cw-slider-val{font-weight:800;color:" + C.mustard + ";font-family:'JetBrains Mono',monospace;}",
      ".cw-slider{width:100%;accent-color:" + C.mustard + ";cursor:pointer;height:1.4rem;}",
      ".cw-legend{display:flex;flex-wrap:wrap;gap:.4rem 1rem;font-size:.8rem;color:" + C.inkSoft + ";padding-top:.1rem;}",
      ".cw-leg{display:inline-flex;align-items:center;gap:.4rem;}",
      ".cw-swatch{width:16px;height:10px;border-radius:3px;display:inline-block;flex:0 0 auto;}",
      ".cw-root .viz-btn[disabled]{opacity:.45;cursor:default;}"
    ].join("\n");
    var st = el("style");
    st.setAttribute("data-cwnd-style", "1");
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* =====================================================================
     bootstrap — ensure Chart.js is present, then render each mount
     ===================================================================== */
  function mountAll() {
    var nodes = document.querySelectorAll('[data-viz="' + VIZ_ID + '"]');
    if (!nodes.length) return; /* degrade gracefully */
    ensureChart(function (ok) {
      nodes.forEach(function (m) {
        if (ok) {
          render(m);
        } else {
          /* graceful fallback if the CDN is unreachable */
          m.innerHTML =
            '<p style="color:' + C.inkSoft + ';font-family:Heebo,sans-serif;' +
            'padding:1rem;text-align:center;">' +
            'לא ניתן לטעון את ספריית הגרפים (Chart.js). בדקו את החיבור לאינטרנט.' +
            '</p>';
        }
      });
    });
  }

  function ensureChart(cb) {
    if (window.Chart) { cb(true); return; }
    var existing = document.querySelector('script[data-cwnd-chartjs]');
    if (existing) {
      existing.addEventListener("load", function () { cb(!!window.Chart); });
      existing.addEventListener("error", function () { cb(false); });
      if (window.Chart) cb(true);
      return;
    }
    var s = document.createElement("script");
    s.src = CDN;
    s.async = true;
    s.setAttribute("data-cwnd-chartjs", "1");
    s.onload = function () { cb(!!window.Chart); };
    s.onerror = function () { cb(false); };
    document.head.appendChild(s);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAll);
  } else {
    mountAll();
  }
})();
