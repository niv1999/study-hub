/* =====================================================================
   sending-buffer.js  —  Module 08 "חלון השליחה (Send / Sliding Window)"
   Grounded in _notes/window-flow.md  חלק א' (The Send Window) — specifically:
     §2  4 אזורי ה-Sending Buffer: Acknowledged / In-Flight / Usable / Blocked
     §3  snd_una / snd_nxt / snd_wnd (tcp_sock control variables)
     §1  Window = LastByteAcked + min(rwnd, cwnd) − LastByteSent
     דיאגרמה 1  מבנה ה-Sending Buffer (4 אזורים) — פס אופקי של מרחב הרצפים,
                סמני גבול snd_una / snd_nxt / Window; ACK מזיז snd_una ימינה,
                שליחה מזיזה snd_nxt ימינה, שינוי min(rwnd,cwnd) מזיז את גבול
                החלון ומעביר בתים בין Usable ל-Blocked.

   Interactive, hand-authored SVG. Cream design tokens hardcoded (CONTRACT §2).
   Draggable boundaries + step buttons + a min(rwnd,cwnd) slider. Live formula.
   Self-contained IIFE, no external deps. RTL Hebrew captions, LTR technical labels.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "sending-buffer";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design palette (hardcoded per CONTRACT §2) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",   /* dusty-blue */
    clay: "#BE7C5E",   /* In-Flight */
    sage: "#7C9885",   /* Usable */
    mustard: "#C9A24B"
  };

  /* Region colours — mapped to the notes' suggested legend
     (Acknowledged אפור/דהוי, In-Flight כתום=clay, Usable ירוק=sage, Blocked אדום). */
  var REGION = {
    acked:  { fill: "#DED6C6", stroke: "#C4B9A4", label: "Acknowledged", he: "אושר" },
    inFlight:{ fill: C.clay,   stroke: "#A76648", label: "In-Flight",    he: "על החוט" },
    usable: { fill: C.sage,    stroke: "#5F7C69", label: "Usable",       he: "ניתן לשליחה" },
    blocked:{ fill: "#C86B5A", stroke: "#A9503F", label: "Blocked",      he: "חסום" }
  };

  /* --- model state (units = bytes, illustrative KB-scale) ---
     The buffer holds the byte range [base .. base+TOTAL). Absolute sequence
     numbers are shown so learners see monotonically increasing seq numbers. */
  var BASE_SEQ = 1000;          // sequence number at the left edge of the buffer
  var TOTAL    = 20;            // total bytes shown in the buffer window (columns)
  var STEP     = 2;            // how many bytes each ACK / send advances by

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

  /* ---------------------------------------------------------------
     render one mount
     --------------------------------------------------------------- */
  function render(mount) {
    if (!mount || mount.getAttribute("data-sb-ready") === "1") return;
    mount.setAttribute("data-sb-ready", "1");
    mount.innerHTML = "";

    /* --- state (all in "byte offsets from BASE_SEQ") ---
       una  = snd_una offset  (LastByteAcked)   — start of In-Flight
       nxt  = snd_nxt offset  (LastByteSent)    — start of Usable
       win  = min(rwnd,cwnd)  in bytes          — width of the flow/cong limit
       Window boundary offset = una + win       — end of Usable / start of Blocked */
    var st = { una: 4, nxt: 10, win: 12 };

    /* ---------- geometry ---------- */
    var W = 720, H = 300;
    var PAD_L = 40, PAD_R = 40;
    var trackY = 118, trackH = 64;
    var trackX = PAD_L, trackW = W - PAD_L - PAD_R;
    var col = trackW / TOTAL;                 // px per byte
    function ox(off) { return trackX + off * col; } // offset -> x px

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";

    /* ===== SVG scene ===== */
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H, width: "100%",
      role: "img",
      "aria-label": "מבנה ה-Sending Buffer עם ארבעה אזורים וסמני snd_una, snd_nxt וגבול החלון",
      direction: "ltr"
    });
    svg.style.display = "block";
    svg.style.maxWidth = W + "px";
    svg.style.margin = "0 auto";
    svg.style.touchAction = "none";

    var defs = el("defs");
    svg.appendChild(defs);

    /* subtle marker for the "increasing seq numbers" axis arrow */
    var m = el("marker", { id: "sb-ax", viewBox: "0 0 10 10", refX: "8", refY: "5",
      markerWidth: "7", markerHeight: "7", orient: "auto" });
    m.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", fill: C.inkSoft }));
    defs.appendChild(m);

    /* buffer frame */
    svg.appendChild(el("rect", {
      x: trackX - 4, y: trackY - 4, width: trackW + 8, height: trackH + 8, rx: 10,
      fill: C.surface2, stroke: C.line, "stroke-width": 2
    }));

    /* title above the buffer */
    svg.appendChild(txt(trackX, trackY - 30, "Sending Buffer", {
      "font-size": 13, "font-weight": 700, fill: C.inkSoft
    }));
    svg.appendChild(txt(trackX + 118, trackY - 30, "( sk_write_queue · linked-list of SKBs )", {
      "font-size": 10.5, fill: C.inkSoft, opacity: .85
    }));

    /* the four region rects (painted ON TOP of the frame background so their
       colours show; paint order = document order, later = on top). */
    var rAck  = el("rect", { y: trackY, height: trackH, fill: REGION.acked.fill });
    var rFly  = el("rect", { y: trackY, height: trackH, fill: REGION.inFlight.fill });
    var rUse  = el("rect", { y: trackY, height: trackH, fill: REGION.usable.fill });
    var rBlk  = el("rect", { y: trackY, height: trackH, fill: REGION.blocked.fill });
    svg.appendChild(rAck);
    svg.appendChild(rFly);
    svg.appendChild(rUse);
    svg.appendChild(rBlk);

    /* per-byte cells (thin dividers) drawn ON TOP of regions for a
       "linked-list of segments" feel */
    var cells = [];
    for (var i = 0; i < TOTAL; i++) {
      var c = el("rect", {
        x: ox(i), y: trackY, width: col, height: trackH,
        fill: "none", stroke: "#ffffff", "stroke-width": 0.6, opacity: .45
      });
      svg.appendChild(c);
      cells.push(c);
    }
    /* rounded clip so region colours honour the frame's rounded corners */
    var clip = el("clipPath", { id: "sb-clip" });
    clip.appendChild(el("rect", { x: trackX, y: trackY, width: trackW, height: trackH, rx: 6 }));
    defs.appendChild(clip);
    [rAck, rFly, rUse, rBlk].forEach(function (r) { r.setAttribute("clip-path", "url(#sb-clip)"); });

    /* the Sending Window bracket (spans una .. una+win) drawn above the track */
    var winBracket = el("path", { fill: "none", stroke: C.blue, "stroke-width": 2.5, "stroke-linecap": "round" });
    svg.appendChild(winBracket);
    var winLabel = txt(0, trackY - 10, "Sending Window", {
      "text-anchor": "middle", "font-size": 11.5, "font-weight": 700, fill: C.blue
    });
    svg.appendChild(winLabel);

    /* ===== sequence-number axis under the track ===== */
    var axisY = trackY + trackH + 30;
    svg.appendChild(el("line", {
      x1: trackX, y1: axisY, x2: trackX + trackW + 12, y2: axisY,
      stroke: C.inkSoft, "stroke-width": 1.5, "marker-end": "url(#sb-ax)"
    }));
    svg.appendChild(txt(trackX + trackW + 16, axisY + 4, "seq #", {
      "font-size": 10, fill: C.inkSoft
    }));
    /* a few axis ticks */
    var ticks = [];
    for (var tk = 0; tk <= TOTAL; tk += 5) {
      svg.appendChild(el("line", { x1: ox(tk), y1: axisY - 4, x2: ox(tk), y2: axisY + 4, stroke: C.inkSoft, "stroke-width": 1 }));
      var lbl = txt(ox(tk), axisY + 17, String(BASE_SEQ + tk), { "text-anchor": "middle", "font-size": 9.5, fill: C.inkSoft });
      svg.appendChild(lbl);
      ticks.push(lbl);
    }

    /* ===== draggable pointer builder =====
       Each pointer is a small flag above the track with a stem down to axisY. */
    function mkPointer(color, tag, handleKey) {
      var g = el("g", { style: "cursor:ew-resize", tabindex: "0",
        role: "slider", "aria-label": tag });
      var stem = el("line", { y1: trackY - 6, y2: axisY, stroke: color, "stroke-width": 2, "stroke-dasharray": "4 3" });
      var flag = el("rect", { y: trackY - 46, width: 4, height: 40, fill: color, rx: 2 });
      /* label chip */
      var chip = el("rect", { y: trackY - 64, width: 62, height: 18, rx: 9, fill: color });
      var chipTx = txt(0, trackY - 51, tag, { "text-anchor": "middle", "font-size": 10.5, "font-weight": 700, fill: "#fff" });
      /* hit area (wider, invisible) for easy grabbing */
      var hit = el("rect", { y: trackY - 66, width: 30, height: (axisY - (trackY - 66)), fill: "transparent" });
      g.appendChild(stem); g.appendChild(flag); g.appendChild(chip); g.appendChild(chipTx); g.appendChild(hit);
      svg.appendChild(g);
      return { g: g, stem: stem, flag: flag, chip: chip, chipTx: chipTx, hit: hit, key: handleKey, color: color };
    }
    /* window boundary pointer (blue) — dragging it changes win = boundary - una */
    var pWin = mkPointer(C.blue, "una+min(rwnd,cwnd)", "win");
    var pUna = mkPointer(REGION.acked.stroke, "snd_una", "una");
    var pNxt = mkPointer(REGION.inFlight.stroke, "snd_nxt", "nxt");

    /* ===== region legend inside the svg (top-right, LTR) ===== */
    var legendItems = [REGION.acked, REGION.inFlight, REGION.usable, REGION.blocked];
    var lgY = 24;
    legendItems.forEach(function (r, i) {
      var lx = trackX + i * 168;
      svg.appendChild(el("rect", { x: lx, y: lgY, width: 13, height: 13, rx: 3, fill: r.fill, stroke: r.stroke, "stroke-width": 1 }));
      svg.appendChild(txt(lx + 19, lgY + 11, r.label, { "font-size": 11, "font-weight": 700, fill: C.ink }));
      svg.appendChild(txt(lx + 19, lgY + 24, r.he, { "font-size": 9.5, fill: C.inkSoft, direction: "rtl" }));
    });

    var sceneBox = document.createElement("div");
    sceneBox.style.background = C.surface;
    sceneBox.style.borderRadius = "12px";
    sceneBox.appendChild(svg);
    wrap.appendChild(sceneBox);

    /* ===== formula panel ===== */
    var formula = document.createElement("div");
    formula.setAttribute("aria-live", "polite");
    formula.style.background = C.surface2;
    formula.style.border = "1px solid " + C.line;
    formula.style.borderRadius = "12px";
    formula.style.padding = "12px 14px";
    formula.style.marginTop = "12px";
    formula.style.color = C.ink;
    formula.style.lineHeight = "1.7";
    wrap.appendChild(formula);

    /* ===== min(rwnd,cwnd) slider row ===== */
    var sliderRow = document.createElement("div");
    sliderRow.className = "viz-controls";
    sliderRow.style.marginTop = "12px";
    var slLabel = document.createElement("label");
    slLabel.style.fontSize = ".86rem";
    slLabel.style.fontWeight = "600";
    slLabel.style.color = C.ink;
    slLabel.style.display = "flex";
    slLabel.style.alignItems = "center";
    slLabel.style.gap = ".5rem";
    slLabel.style.flexWrap = "wrap";
    var slText = document.createElement("span");
    slText.innerHTML = 'גבול <span dir="ltr">min(rwnd, cwnd)</span>:';
    var slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0"; slider.max = String(TOTAL); slider.step = "1";
    slider.value = String(st.win);
    slider.setAttribute("aria-label", "min(rwnd, cwnd) בבתים");
    slider.style.accentColor = C.blue;
    slider.style.width = "180px";
    var slVal = document.createElement("span");
    slVal.style.fontFamily = "monospace";
    slVal.style.fontWeight = "700";
    slVal.style.color = C.blue;
    slLabel.appendChild(slText);
    slLabel.appendChild(slider);
    slLabel.appendChild(slVal);
    sliderRow.appendChild(slLabel);
    wrap.appendChild(sliderRow);

    /* ===== step controls ===== */
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
    var btnAck  = mkBtn('קבלת <span dir="ltr">ACK</span> →', function () { doAck(); }, true);
    var btnSend = mkBtn('שליחת נתונים →', function () { doSend(); });
    var btnReset = mkBtn("↺ איפוס", function () { st = { una: 4, nxt: 10, win: 12 }; slider.value = st.win; layout(true); });
    controls.appendChild(btnAck);
    controls.appendChild(btnSend);
    controls.appendChild(btnReset);
    wrap.appendChild(controls);

    /* live-region status for screen readers — visually hidden WITHOUT
       affecting layout (clip + zero-box; no off-screen offset that could
       widen the document, esp. in RTL). */
    var status = document.createElement("p");
    status.setAttribute("aria-live", "polite");
    status.style.cssText =
      "position:absolute;width:1px;height:1px;margin:-1px;padding:0;" +
      "overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;";
    wrap.appendChild(status);

    mount.appendChild(wrap);

    /* ---------------------------------------------------------------
       actions
       --------------------------------------------------------------- */
    function doAck() {
      // ACK moves snd_una right (shrinks In-Flight, grows Acknowledged).
      // snd_una can never pass snd_nxt (can't ACK data not yet sent).
      var next = Math.min(st.nxt, st.una + STEP);
      if (next === st.una) { flash(btnAck); return; }
      st.una = next;
      layout(true);
      say("התקבל ACK — snd_una התקדם. אזור In-Flight התכווץ, Acknowledged גדל.");
    }
    function doSend() {
      // Sending data moves snd_nxt right, but only within the Usable region,
      // i.e. snd_nxt cannot pass the window boundary (una + win). If it would,
      // the window is full and the application blocks in write().
      var boundary = st.una + st.win;
      var next = Math.min(boundary, st.nxt + STEP);
      if (next === st.nxt) {
        flash(btnSend);
        say("החלון מלא — האפליקציה נחסמת ב-write(). אין מקום ב-Usable.");
        return;
      }
      st.nxt = next;
      layout(true);
      say("נשלחו נתונים — snd_nxt התקדם. אזור Usable התכווץ.");
    }

    function flash(btn) {
      if (reducedMotion()) return;
      btn.animate ? btn.animate(
        [{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }],
        { duration: 240 }
      ) : null;
    }
    function say(msg) { status.textContent = msg; }

    /* ---------------------------------------------------------------
       layout — position all regions, pointers, brackets & formula
       from the current state. `animate` triggers a soft transition.
       --------------------------------------------------------------- */
    function setRect(rect, offA, offB) {
      var x = ox(Math.min(offA, offB));
      var w = Math.abs(offB - offA) * col;
      rect.setAttribute("x", x);
      rect.setAttribute("width", Math.max(0, w));
      rect.setAttribute("opacity", w <= 0.01 ? 0 : 1);
    }

    function positionPointer(p, off) {
      var x = ox(off);
      p.stem.setAttribute("x1", x); p.stem.setAttribute("x2", x);
      p.flag.setAttribute("x", x - 2);
      // keep chip within the svg horizontally
      var chipX = clamp(x - 31, 2, W - 64);
      p.chip.setAttribute("x", chipX);
      p.chipTx.setAttribute("x", chipX + 31);
      p.hit.setAttribute("x", x - 15);
      p.g.setAttribute("aria-valuenow", String(BASE_SEQ + off));
    }

    function layout(animate) {
      // clamp invariants: 0 <= una <= nxt ; win >= 0 ; boundary <= TOTAL
      st.win = clamp(st.win, 0, TOTAL);
      st.una = clamp(st.una, 0, TOTAL);
      var boundary = clamp(st.una + st.win, st.una, TOTAL);
      st.nxt = clamp(st.nxt, st.una, boundary); // snd_nxt within [una, boundary]

      // regions along the track:
      //  [0 .. una]        Acknowledged
      //  [una .. nxt]      In-Flight
      //  [nxt .. boundary] Usable
      //  [boundary .. TOTAL] Blocked
      setRect(rAck, 0, st.una);
      setRect(rFly, st.una, st.nxt);
      setRect(rUse, st.nxt, boundary);
      setRect(rBlk, boundary, TOTAL);

      // window bracket over [una .. boundary]
      var bx1 = ox(st.una), bx2 = ox(boundary), by = trackY - 20;
      winBracket.setAttribute("d",
        "M" + bx1 + " " + (by + 6) + " L" + bx1 + " " + by +
        " L" + bx2 + " " + by + " L" + bx2 + " " + (by + 6));
      winLabel.setAttribute("x", (bx1 + bx2) / 2);
      winLabel.setAttribute("opacity", (boundary - st.una) > 2 ? 1 : 0);

      positionPointer(pUna, st.una);
      positionPointer(pNxt, st.nxt);
      positionPointer(pWin, boundary);

      // formula panel — the EXACT lecturer form
      var lastAcked = BASE_SEQ + st.una;
      var lastSent  = BASE_SEQ + st.nxt;
      var minrc     = st.win;
      var windowVal = lastAcked + minrc - lastSent; // usable bytes remaining
      var usableBytes = boundary - st.nxt;
      var blockedBytes = TOTAL - boundary;
      formula.innerHTML =
        '<div style="font-family:monospace;font-size:1rem;color:' + C.ink + ';margin-bottom:6px" dir="ltr">' +
          '<b>Window</b> = LastByteAcked + min(rwnd, cwnd) − LastByteSent' +
        '</div>' +
        '<div style="font-family:monospace;font-size:1rem" dir="ltr">' +
          'Window = <span style="color:' + REGION.acked.stroke + ';font-weight:700">' + lastAcked + '</span>' +
          ' + <span style="color:' + C.blue + ';font-weight:700">' + minrc + '</span>' +
          ' − <span style="color:' + REGION.inFlight.stroke + ';font-weight:700">' + lastSent + '</span>' +
          ' = <b style="color:' + C.sage + '">' + windowVal + '</b> bytes' +
        '</div>' +
        '<div style="margin-top:8px;font-size:.85rem;color:' + C.inkSoft + ';direction:rtl">' +
          '<span dir="ltr">snd_una</span>=' + lastAcked + ' · ' +
          '<span dir="ltr">snd_nxt</span>=' + lastSent + ' · ' +
          '<span dir="ltr">snd_wnd</span>=' + minrc + ' → ' +
          'ניתן לשליחה מיד (<span dir="ltr">Usable</span>): <b style="color:' + C.sage + '">' + usableBytes + '</b> בתים · ' +
          'חסום (<span dir="ltr">Blocked</span>): <b style="color:' + REGION.blocked.stroke + '">' + blockedBytes + '</b> בתים' +
          (windowVal === 0 ? ' — <b style="color:' + REGION.blocked.stroke + '">החלון מלא, האפליקציה חסומה ב-write()</b>' : '') +
        '</div>';

      slVal.textContent = st.win + " B";
      btnAck.disabled = (st.una >= st.nxt);
      btnSend.disabled = (st.nxt >= boundary);

      if (animate && !reducedMotion()) pulseRegions();
    }

    function pulseRegions() {
      [rAck, rFly, rUse].forEach(function (r) {
        if (!r.animate) return;
        r.animate([{ opacity: .55 }, { opacity: 1 }], { duration: 220 });
      });
    }

    /* ---------------------------------------------------------------
       dragging: pointer events on the three pointer groups
       --------------------------------------------------------------- */
    function offFromClientX(clientX) {
      var rect = svg.getBoundingClientRect();
      var scale = W / rect.width;             // viewBox px per client px
      var svgX = (clientX - rect.left) * scale;
      var off = (svgX - trackX) / col;
      return clamp(Math.round(off), 0, TOTAL);
    }

    function attachDrag(p) {
      var dragging = false;
      function down(e) {
        dragging = true;
        p.g.setAttribute("aria-grabbed", "true");
        try { p.g.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
      }
      function move(e) {
        if (!dragging) return;
        applyOff(p.key, offFromClientX(e.clientX));
      }
      function up(e) {
        dragging = false;
        p.g.setAttribute("aria-grabbed", "false");
        try { p.g.releasePointerCapture(e.pointerId); } catch (err) {}
      }
      p.g.addEventListener("pointerdown", down);
      p.g.addEventListener("pointermove", move);
      p.g.addEventListener("pointerup", up);
      p.g.addEventListener("pointercancel", up);

      /* keyboard on focused pointer (RTL-aware arrows) */
      p.g.addEventListener("keydown", function (e) {
        var cur = curOff(p.key);
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") { applyOff(p.key, cur + 1); e.preventDefault(); }
        else if (e.key === "ArrowRight" || e.key === "ArrowDown") { applyOff(p.key, cur - 1); e.preventDefault(); }
        else if (e.key === "Home") { applyOff(p.key, 0); e.preventDefault(); }
        else if (e.key === "End") { applyOff(p.key, TOTAL); e.preventDefault(); }
      });
    }
    function curOff(key) {
      if (key === "una") return st.una;
      if (key === "nxt") return st.nxt;
      return st.una + st.win; // boundary
    }
    function applyOff(key, off) {
      if (key === "una") {
        // snd_una: 0 <= una <= nxt. Moving una also carries the window
        // boundary implicitly (win stays fixed) — like receiving ACKs.
        st.una = clamp(off, 0, st.nxt);
      } else if (key === "nxt") {
        // snd_nxt: una <= nxt <= boundary (can't send past the window).
        var boundary = st.una + st.win;
        st.nxt = clamp(off, st.una, Math.min(TOTAL, boundary));
      } else {
        // window boundary: boundary >= nxt, boundary <= TOTAL.
        var b = clamp(off, st.nxt, TOTAL);
        st.win = b - st.una;
        slider.value = String(st.win);
      }
      layout(true);
    }
    attachDrag(pUna);
    attachDrag(pNxt);
    attachDrag(pWin);

    /* slider wiring: sets min(rwnd,cwnd) directly */
    slider.addEventListener("input", function () {
      st.win = clamp(parseInt(slider.value, 10) || 0, 0, TOTAL);
      layout(true);
    });

    /* initial paint */
    layout(false);
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
