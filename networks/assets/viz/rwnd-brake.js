/* =====================================================================
   rwnd-brake.js  —  Module 09 "בקרת זרימה (Flow Control)"
   Grounded in _notes/window-flow.md  חלק ג' (Flow Control) — specifically:
     §2  ה-rwnd הוא ה"מד": כמה בתים פנויים בחוצץ הקבלה (sk_rcvbuf).
     §2  הנוסחה:
           rwnd = ReceiveBufferCapacity − (LastByteReceived − LastByteReadByApplication)
     §3  worked example (חוצץ 10,000 בתים, מצבים א'/ב'/ג' → rwnd 10,000/6,000/0).
     §4  Zero Window: כשה-buffer מלא → rwnd=0 → השולח עוצר לחלוטין (בלם).
     דיאגרמה 4  התפתחות ה-rwnd — חוצץ מלבני עם מדד מילוי; נתונים מגיעים מלמעלה
                (ממלאים, מקטינים rwnd), recv() מרוקן מלמטה (מגדיל rwnd); כל שינוי
                מפעיל ACK עם rwnd מעודכן. סליידר קצב-הגעה מול קצב-recv().

   סימולטור "בלם" rwnd: שני מחוונים (קצב-הגעה מהרשת מול קצב-recv() של האפליקציה)
   מזינים חוצץ קבלה חי; ה-rwnd מחושב בזמן אמת מהנוסחה; כשהחוצץ מתמלא → Zero Window
   והשולח נבלם. כפתורי preset מדגימים את מצבים א'/ב'/ג' מהשקף.

   Interactive, hand-authored SVG + DOM. Cream design tokens hardcoded (CONTRACT §2).
   Self-contained IIFE, no external deps. RTL Hebrew captions, LTR technical labels.
   Accessible (real <button>s, keyboard sliders), respects prefers-reduced-motion.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "rwnd-brake";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design palette (hardcoded per CONTRACT §2) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",   /* dusty-blue — rwnd / free space */
    clay: "#BE7C5E",   /* arrival (data landing in buffer) */
    sage: "#7C9885",   /* recv() drain / healthy flow */
    mustard: "#C9A24B" /* warning / near-zero window */
  };
  var DANGER = "#C86B5A"; /* Zero Window / brake */

  /* --- model constants (the worked example uses 10,000 bytes) --- */
  var CAP = 10000;               // ReceiveBufferCapacity (sk_rcvbuf) — bytes
  var TICK_MS = 90;              // simulation tick period
  var BYTES_PER_UNIT = 220;      // bytes moved per rate-unit per tick

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
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function fmt(n) { return Math.round(n).toLocaleString("en-US"); }

  /* ---------------------------------------------------------------
     render one mount
     --------------------------------------------------------------- */
  function render(mount) {
    if (!mount || mount.getAttribute("data-rb-ready") === "1") return;
    mount.setAttribute("data-rb-ready", "1");
    mount.innerHTML = "";

    /* --- model state ---
       occupied  = LastByteReceived − LastByteReadByApplication (bytes in buffer)
       rwnd      = CAP − occupied
       arrival   = rate of data arriving from the network (units)
       drain     = rate the application reads via recv() (units)
       running   = live simulation on/off */
    var st = {
      occupied: 0,
      arrival: 3,
      drain: 3,
      running: false
    };

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";

    /* ============================================================
       SVG SCENE
       ============================================================ */
    var W = 720, H = 340;
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H, width: "100%",
      role: "img",
      "aria-label": "חוצץ קבלה של הנמען: נתונים מגיעים מהרשת וממלאים אותו, recv() מרוקן, וה-rwnd הוא המקום הפנוי שנותר.",
      direction: "ltr"
    });
    svg.style.display = "block";
    svg.style.maxWidth = W + "px";
    svg.style.margin = "0 auto";

    var defs = el("defs");
    svg.appendChild(defs);

    /* arrow markers */
    function mkMarker(id, color) {
      var m = el("marker", { id: id, viewBox: "0 0 10 10", refX: "8", refY: "5",
        markerWidth: "7", markerHeight: "7", orient: "auto" });
      m.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", fill: color }));
      defs.appendChild(m);
    }
    mkMarker("rb-arr-clay", C.clay);
    mkMarker("rb-arr-sage", C.sage);

    /* ---- buffer geometry (vertical tank in the centre) ---- */
    var tankW = 150, tankH = 210;
    var tankX = (W - tankW) / 2;
    var tankY = 70;
    function fillY(occ) { return tankY + tankH * (1 - occ / CAP); } // top of filled column

    /* buffer frame */
    svg.appendChild(el("rect", {
      x: tankX - 6, y: tankY - 6, width: tankW + 12, height: tankH + 12, rx: 14,
      fill: C.surface2, stroke: C.line, "stroke-width": 2
    }));

    /* occupied fill (data in buffer, grows from bottom) */
    var fillRect = el("rect", {
      x: tankX, width: tankW, rx: 4, fill: C.clay, opacity: .9
    });
    svg.appendChild(fillRect);

    /* free-space (rwnd) region — drawn as a light blue band above the fill */
    var freeRect = el("rect", {
      x: tankX, y: tankY, width: tankW, rx: 4, fill: C.blue, opacity: .12
    });
    svg.appendChild(freeRect);

    /* the water-line between occupied and free (rwnd boundary) */
    var waterLine = el("line", {
      x1: tankX - 10, x2: tankX + tankW + 10, stroke: C.ink, "stroke-width": 2
    });
    svg.appendChild(waterLine);

    /* MSS / Clark half-buffer reference ticks on the tank right edge */
    function refTick(occFrac, label) {
      var y = tankY + tankH * (1 - occFrac);
      svg.appendChild(el("line", {
        x1: tankX + tankW, y1: y, x2: tankX + tankW + 8, y2: y,
        stroke: C.inkSoft, "stroke-width": 1, "stroke-dasharray": "3 2"
      }));
      svg.appendChild(txt(tankX + tankW + 12, y + 3.5, label, {
        "font-size": 9, fill: C.inkSoft
      }));
    }
    refTick(0.5, "½ buffer");

    /* tank caption */
    svg.appendChild(txt(tankX + tankW / 2, tankY - 16, "sk_rcvbuf", {
      "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: C.inkSoft
    }));
    svg.appendChild(txt(tankX + tankW / 2, H - 14, "חוצץ קבלה · " + fmt(CAP) + " bytes", {
      "text-anchor": "middle", "font-size": 11, fill: C.inkSoft, direction: "rtl"
    }));

    /* capacity label at top of tank */
    svg.appendChild(txt(tankX - 12, tankY + 4, String(CAP / 1000) + "K", {
      "text-anchor": "end", "font-size": 9.5, fill: C.inkSoft
    }));
    svg.appendChild(txt(tankX - 12, tankY + tankH + 2, "0", {
      "text-anchor": "end", "font-size": 9.5, fill: C.inkSoft
    }));

    /* ---- INCOMING data (network → buffer) : left arrow pointing right/in ---- */
    var inX = tankX - 150, inY = tankY + 34;
    svg.appendChild(txt(inX + 60, inY - 26, "מהרשת", {
      "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: C.clay, direction: "rtl"
    }));
    svg.appendChild(txt(inX + 60, inY - 12, "data arrival", {
      "text-anchor": "middle", "font-size": 9.5, fill: C.inkSoft
    }));
    var arrIn = el("line", {
      x1: inX, y1: inY, x2: tankX - 8, y2: inY,
      stroke: C.clay, "stroke-width": 3, "marker-end": "url(#rb-arr-clay)"
    });
    svg.appendChild(arrIn);
    /* animated packet dots on the inbound path */
    var inDots = [];
    for (var d = 0; d < 3; d++) {
      var dot = el("circle", { r: 4.5, cy: inY, fill: C.clay, opacity: 0 });
      svg.appendChild(dot); inDots.push(dot);
    }

    /* ---- recv() drain (buffer → application) : bottom arrow out ---- */
    var outY = tankY + tankH + 4, outX = tankX + tankW + 30;
    svg.appendChild(txt(outX + 60, tankY + tankH - 40, "recv()", {
      "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: C.sage, direction: "ltr"
    }));
    svg.appendChild(txt(outX + 60, tankY + tankH - 26, "האפליקציה קוראת", {
      "text-anchor": "middle", "font-size": 9.5, fill: C.inkSoft, direction: "rtl"
    }));
    var arrOut = el("path", {
      d: "M" + (tankX + tankW + 8) + " " + (tankY + tankH - 12) +
         " L" + (outX + 92) + " " + (tankY + tankH - 12),
      fill: "none", stroke: C.sage, "stroke-width": 3, "marker-end": "url(#rb-arr-sage)"
    });
    svg.appendChild(arrOut);
    svg.appendChild(txt(outX + 118, tankY + tankH - 9, "app", {
      "text-anchor": "middle", "font-size": 10, fill: C.inkSoft
    }));
    var outDots = [];
    for (var d2 = 0; d2 < 3; d2++) {
      var od = el("circle", { r: 4.5, cy: tankY + tankH - 12, fill: C.sage, opacity: 0 });
      svg.appendChild(od); outDots.push(od);
    }

    /* ---- rwnd advertisement (ACK) badge, pointing back toward the sender ---- */
    var badge = el("g", {});
    var badgeRect = el("rect", {
      x: inX - 4, y: tankY + tankH - 4, width: 138, height: 46, rx: 10,
      fill: C.surface, stroke: C.blue, "stroke-width": 1.5
    });
    badge.appendChild(badgeRect);
    var badgeT1 = txt(inX + 65, tankY + tankH + 13, "ACK · Window Update", {
      "text-anchor": "middle", "font-size": 10, "font-weight": 700, fill: C.blue
    });
    var badgeT2 = txt(inX + 65, tankY + tankH + 31, "rwnd = 10,000", {
      "text-anchor": "middle", "font-size": 13, "font-weight": 800, fill: C.blue,
      "font-family": "monospace"
    });
    badge.appendChild(badgeT1); badge.appendChild(badgeT2);
    svg.appendChild(badge);

    /* ---- Zero-Window / brake banner overlaid on the tank when full ---- */
    var brakeG = el("g", { opacity: 0 });
    brakeG.appendChild(el("rect", {
      x: tankX - 6, y: tankY + tankH / 2 - 24, width: tankW + 12, height: 48, rx: 10,
      fill: DANGER, opacity: .95
    }));
    brakeG.appendChild(txt(tankX + tankW / 2, tankY + tankH / 2 - 4, "ZERO WINDOW", {
      "text-anchor": "middle", "font-size": 13, "font-weight": 800, fill: "#fff"
    }));
    brakeG.appendChild(txt(tankX + tankW / 2, tankY + tankH / 2 + 14, "השולח נבלם", {
      "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: "#fff", direction: "rtl"
    }));
    svg.appendChild(brakeG);

    var sceneBox = document.createElement("div");
    sceneBox.style.background = C.surface;
    sceneBox.style.borderRadius = "12px";
    sceneBox.style.padding = "4px 0";
    sceneBox.appendChild(svg);
    wrap.appendChild(sceneBox);

    /* ============================================================
       LIVE FORMULA PANEL
       ============================================================ */
    var formula = document.createElement("div");
    formula.setAttribute("aria-live", "polite");
    formula.style.background = C.surface2;
    formula.style.border = "1px solid " + C.line;
    formula.style.borderRadius = "12px";
    formula.style.padding = "12px 14px";
    formula.style.marginTop = "12px";
    formula.style.color = C.ink;
    formula.style.lineHeight = "1.75";
    wrap.appendChild(formula);

    /* ============================================================
       RATE SLIDERS (arrival vs recv())
       ============================================================ */
    function mkSlider(labelHtml, color, initial, onInput, ariaLabel) {
      var row = document.createElement("div");
      row.className = "viz-controls";
      row.style.marginTop = "10px";
      var lab = document.createElement("label");
      lab.style.cssText = "font-size:.86rem;font-weight:600;color:" + C.ink +
        ";display:flex;align-items:center;gap:.5rem;flex-wrap:wrap";
      var span = document.createElement("span");
      span.innerHTML = labelHtml;
      var input = document.createElement("input");
      input.type = "range"; input.min = "0"; input.max = "8"; input.step = "1";
      input.value = String(initial);
      input.style.accentColor = color;
      input.style.width = "170px";
      input.setAttribute("aria-label", ariaLabel);
      var val = document.createElement("span");
      val.style.cssText = "font-family:monospace;font-weight:700;color:" + color + ";min-width:5.5rem";
      lab.appendChild(span); lab.appendChild(input); lab.appendChild(val);
      row.appendChild(lab); wrap.appendChild(row);
      input.addEventListener("input", function () { onInput(parseInt(input.value, 10) || 0, val); });
      return { input: input, val: val };
    }

    function rateWord(r) {
      if (r === 0) return "0 (עצור)";
      if (r <= 2) return r + " (איטי)";
      if (r <= 5) return r + " (בינוני)";
      return r + " (מהיר)";
    }

    var arrivalSl = mkSlider(
      'קצב הגעה <span dir="ltr">(network → buffer)</span>:', C.clay, st.arrival,
      function (v, valEl) { st.arrival = v; valEl.textContent = rateWord(v); update(); },
      "קצב הגעת נתונים מהרשת");
    var drainSl = mkSlider(
      'קצב קריאה <span dir="ltr">recv() (app)</span>:', C.sage, st.drain,
      function (v, valEl) { st.drain = v; valEl.textContent = rateWord(v); update(); },
      "קצב קריאת האפליקציה");

    /* ============================================================
       CONTROL BUTTONS
       ============================================================ */
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

    var btnPlay = mkBtn("▶ הרצה", function () { toggleRun(); }, true);
    var btnStep = mkBtn("⏭ צעד", function () { tick(); }, false);
    var btnReset = mkBtn("↺ איפוס", function () {
      stopRun();
      st.occupied = 0; st.arrival = 3; st.drain = 3;
      arrivalSl.input.value = "3"; drainSl.input.value = "3";
      arrivalSl.val.textContent = rateWord(3); drainSl.val.textContent = rateWord(3);
      update();
    });
    controls.appendChild(btnPlay);
    controls.appendChild(btnStep);
    controls.appendChild(btnReset);
    wrap.appendChild(controls);

    /* --- preset row: the worked example states א' / ב' / ג' --- */
    var presets = document.createElement("div");
    presets.className = "viz-controls";
    presets.style.marginTop = "8px";
    var presetLabel = document.createElement("span");
    presetLabel.style.cssText = "font-size:.82rem;color:" + C.inkSoft + ";font-weight:600";
    presetLabel.textContent = "דוגמת השקף:";
    presets.appendChild(presetLabel);
    function preset(name, occ, note) {
      return mkBtn(name, function () {
        stopRun();
        st.occupied = occ;
        update();
        say(note);
      });
    }
    presets.appendChild(preset("מצב א' · rwnd=10,000", 0, "מצב א': החוצץ ריק, rwnd=10,000."));
    presets.appendChild(preset("מצב ב' · rwnd=6,000", 4000, "מצב ב': הגיעו 4,000 בתים, rwnd=6,000."));
    presets.appendChild(preset("מצב ג' · rwnd=0", CAP, "מצב ג': החוצץ מלא, rwnd=0 — Zero Window."));
    wrap.appendChild(presets);

    /* live-region status for screen readers */
    var status = document.createElement("p");
    status.setAttribute("aria-live", "polite");
    status.style.cssText = "position:absolute;left:-9999px";
    wrap.appendChild(status);
    function say(m) { status.textContent = m; }

    mount.appendChild(wrap);

    /* ============================================================
       SIMULATION
       ============================================================ */
    var timer = null;

    function tick() {
      // Data arrives from the network (fills buffer, up to capacity).
      var incoming = st.arrival * BYTES_PER_UNIT;
      // The application reads via recv() (drains buffer, not below 0).
      var readBytes = st.drain * BYTES_PER_UNIT;

      // If rwnd is 0, the SENDER is braked: no *new* data can arrive.
      // (Zero Window — the sender must stop; only a Zero Window Probe of 1 byte
      //  may trickle in. We model the brake by capping arrival at the free space.)
      var free = CAP - st.occupied;
      incoming = Math.min(incoming, free);

      st.occupied = clamp(st.occupied + incoming - readBytes, 0, CAP);
      update();

      if (!reducedMotion()) animateFlow(incoming > 0, readBytes > 0 && st.occupied >= 0);
    }

    function toggleRun() {
      if (st.running) { stopRun(); } else { startRun(); }
    }
    function startRun() {
      if (st.running) return;
      st.running = true;
      btnPlay.innerHTML = "⏸ השהה";
      btnPlay.classList.remove("primary");
      timer = window.setInterval(tick, TICK_MS);
    }
    function stopRun() {
      st.running = false;
      btnPlay.innerHTML = "▶ הרצה";
      btnPlay.classList.add("primary");
      if (timer) { window.clearInterval(timer); timer = null; }
    }

    /* --- flowing packet dots (skipped under reduced-motion) --- */
    var flowT = 0;
    function animateFlow(inActive, outActive) {
      flowT = (flowT + 1) % 30;
      inDots.forEach(function (dot, i) {
        if (!inActive) { dot.setAttribute("opacity", 0); return; }
        var p = ((flowT + i * 10) % 30) / 30;
        dot.setAttribute("cx", inX + p * (tankX - 8 - inX));
        dot.setAttribute("opacity", 0.85 * (1 - Math.abs(p - 0.5)));
      });
      outDots.forEach(function (dot, i) {
        if (!outActive) { dot.setAttribute("opacity", 0); return; }
        var p = ((flowT + i * 10) % 30) / 30;
        dot.setAttribute("cx", (tankX + tankW + 8) + p * 84);
        dot.setAttribute("opacity", 0.85 * (1 - Math.abs(p - 0.5)));
      });
    }

    /* ============================================================
       UPDATE — recompute rwnd from the state and repaint everything
       ============================================================ */
    function update() {
      var occ = st.occupied;
      var rwnd = CAP - occ;                 // the lecturer's formula
      var lastRecv = occ;                   // LastByteReceived − LastByteRead = occupied
      var pct = occ / CAP;

      // ---- tank fill ----
      var y = fillY(occ);
      fillRect.setAttribute("y", y);
      fillRect.setAttribute("height", Math.max(0, tankY + tankH - y));
      freeRect.setAttribute("y", tankY);
      freeRect.setAttribute("height", Math.max(0, y - tankY));
      waterLine.setAttribute("y1", y);
      waterLine.setAttribute("y2", y);

      // ---- colour cues as the window closes ----
      var nearZero = rwnd > 0 && rwnd <= CAP * 0.15;
      var zero = rwnd <= 0;
      fillRect.setAttribute("fill", zero ? DANGER : (nearZero ? C.mustard : C.clay));

      // ---- rwnd badge ----
      badgeT2.textContent = "rwnd = " + fmt(rwnd);
      var badgeColor = zero ? DANGER : (nearZero ? C.mustard : C.blue);
      badgeT1.setAttribute("fill", badgeColor);
      badgeT2.setAttribute("fill", badgeColor);
      badgeRect.setAttribute("stroke", badgeColor);
      badgeT1.textContent = zero ? "ACK · rwnd=0 (Zero Window)" : "ACK · Window Update";

      // ---- brake banner ----
      brakeG.setAttribute("opacity", zero ? 1 : 0);

      // ---- inbound arrow dims when sender is braked ----
      arrIn.setAttribute("opacity", zero ? 0.25 : 1);

      // ---- formula panel ----
      var arrivalBrake = zero ? ' <b style="color:' + DANGER + '">— השולח נבלם (Zero Window)</b>' : '';
      var diagnosis;
      if (zero) {
        diagnosis = 'rwnd=0 → מצב <b style="color:' + DANGER + '">Zero Window</b>: השולח עוצר לחלוטין ומחכה. ' +
          'ה-<span dir="ltr">Persistent Timer</span> ישלח <span dir="ltr">Zero Window Probe</span> (בית אחד) לבדוק אם התפנה מקום.';
      } else if (nearZero) {
        diagnosis = 'ה-rwnd קטן מאוד — הקרנל מבטל <span dir="ltr">Delayed ACK</span> ושולח <span dir="ltr">Window Update</span> מיד, ומתזמן <span dir="ltr">ksoftirqd</span> בעדיפות גבוהה לפנות את החוצץ.';
      } else if (st.arrival > st.drain) {
        diagnosis = 'קצב ההגעה גדול מקצב ה-<span dir="ltr">recv()</span> → החוצץ מתמלא וה-rwnd הולך וקטן (בקרת זרימה מאיטה את השולח).';
      } else if (st.drain > st.arrival) {
        diagnosis = 'האפליקציה קוראת מהר מכפי שהנתונים מגיעים → החוצץ מתרוקן וה-rwnd גדל.';
      } else {
        diagnosis = 'קצב ההגעה שווה לקצב ה-<span dir="ltr">recv()</span> → החוצץ יציב וה-rwnd קבוע.';
      }

      formula.innerHTML =
        '<div style="font-family:monospace;font-size:.98rem;color:' + C.ink + ';margin-bottom:6px" dir="ltr">' +
          '<b>rwnd</b> = ReceiveBufferCapacity − (LastByteReceived − LastByteRead)' +
        '</div>' +
        '<div style="font-family:monospace;font-size:1.02rem" dir="ltr">' +
          'rwnd = <span style="font-weight:700">' + fmt(CAP) + '</span>' +
          ' − <span style="color:' + C.clay + ';font-weight:700">' + fmt(lastRecv) + '</span>' +
          ' = <b style="color:' + badgeColor + '">' + fmt(rwnd) + '</b> bytes' +
        '</div>' +
        '<div style="margin-top:8px;font-size:.86rem;color:' + C.inkSoft + ';direction:rtl">' +
          'תפוס בחוצץ: <b style="color:' + C.clay + '">' + fmt(occ) + '</b> בתים (' + Math.round(pct * 100) + '%) · ' +
          'פנוי (<span dir="ltr">rwnd</span>): <b style="color:' + badgeColor + '">' + fmt(rwnd) + '</b> בתים' +
          arrivalBrake +
        '</div>' +
        '<div style="margin-top:6px;font-size:.86rem;color:' + C.ink + ';direction:rtl;border-top:1px solid ' + C.line + ';padding-top:6px">' +
          diagnosis +
        '</div>';

      // ---- button states ----
      btnStep.disabled = false;
      arrIn.setAttribute("opacity", zero ? 0.25 : 1);
    }

    /* cleanup if the mount is removed from the DOM */
    if (window.MutationObserver) {
      var mo = new MutationObserver(function () {
        if (!document.contains(mount)) { stopRun(); mo.disconnect(); }
      });
      try { mo.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    }

    /* initial paint */
    arrivalSl.val.textContent = rateWord(st.arrival);
    drainSl.val.textContent = rateWord(st.drain);
    update();
  }

  /* ---------------------------------------------------------------
     mount all instances on DOMContentLoaded (guard for already-ready)
     --------------------------------------------------------------- */
  function boot() {
    try {
      var mounts = document.querySelectorAll('[data-viz="' + VIZ_ID + '"]');
      if (!mounts || !mounts.length) return;
      mounts.forEach(function (mnt) { render(mnt); });
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
