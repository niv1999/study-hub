/* encapsulation-hops.js — Hero viz for Module 02 (שכבות + Encapsulation)
 *
 * Grounds itself EXACTLY in intro-layering.md §C3 (L01-2 v2, שקף 52 / Diagram D11):
 *   - Two hosts at the ends, two routers in the middle.
 *   - Host stack: HTTP → TCP → IP → Ethernet(link).  Router stack goes UP TO IP only,
 *     with a DIFFERENT link layer on each side (Ethernet on one link, "other" on the next).
 *   - Peer (horizontal) scopes:
 *       HTTP message  — end-to-end (hosts only)
 *       TCP segment   — end-to-end (hosts only)
 *       IP packet     — hop-by-hop (host↔router, router↔router, router↔host) => 3 hops
 *       link frame    — per-link, CHANGES at every hop (Ethernet / WiFi / other)
 *   - Teaching point: application & transport are end-to-end; IP is re-examined hop-by-hop
 *     in the routers; the link layer changes per hop.
 *
 * Self-contained IIFE. No external deps. Cream design tokens hardcoded (CONTRACT §2/§6).
 */
(function () {
  "use strict";

  // ---- design palette (hardcoded per CONTRACT §2) ----
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",   // dusty-blue
    clay: "#BE7C5E",
    sage: "#7C9885",
    mustard: "#C9A24B"
  };

  // Lecturer's layer color code (his slide): HTTP=magenta/pink, TCP=green, IP=yellow, link=red.
  // Mapped onto the cream palette while keeping the semantic distinction.
  var LAYER = {
    HTTP: { key: "HTTP", label: "HTTP", he: "יישום", color: C.clay,    soft: "#F1E1D7" },
    TCP:  { key: "TCP",  label: "TCP",  he: "תעבורה", color: C.sage,   soft: "#E3EBE4" },
    IP:   { key: "IP",   label: "IP",   he: "רשת",   color: C.mustard, soft: "#F3E9CF" },
    LINK: { key: "LINK", label: "Link", he: "קישור", color: C.blue,   soft: "#DEE6EB" }
  };

  var SVGNS = "http://www.w3.org/2000/svg";
  var reduceMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  // ---------- tiny SVG helpers ----------
  function el(name, attrs, parent) {
    var n = document.createElementNS(SVGNS, name);
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(parent, x, y, s, attrs) {
    var t = el("text", attrs || {}, parent);
    t.setAttribute("x", x);
    t.setAttribute("y", y);
    t.textContent = s;
    return t;
  }

  // ================================================================
  // MODEL — 4 nodes across the wire, 3 hops between them.
  //   node kinds: host / router. Each carries the stack it terminates.
  // ================================================================
  var NODES = [
    { kind: "host",   he: "מארח C",   sub: "client host", stack: ["HTTP", "TCP", "IP", "LINK"] },
    { kind: "router", he: "Router 1", sub: "נתב",         stack: ["IP", "LINK"] },
    { kind: "router", he: "Router 2", sub: "נתב",         stack: ["IP", "LINK"] },
    { kind: "host",   he: "מארח S",   sub: "server host", stack: ["HTTP", "TCP", "IP", "LINK"] }
  ];

  // link (physical) technology per hop — the lecturer stresses the link layer CHANGES per hop.
  var HOPS = [
    { link: "Ethernet", tech: "802.3" },
    { link: "WiFi",     tech: "802.11" },
    { link: "……….",     tech: "link אחר" }
  ];

  // The animation is a linear sequence of "beats" describing what moves & at which scope.
  // Each beat highlights one PDU scope traveling the wire. Encapsulation is shown at C
  // (headers added top→down) before the frame leaves onto hop 0.
  function buildBeats() {
    return [
      { phase: "encap", node: 0, add: "HTTP",
        he: "מארח C: הדפדפן יוצר הודעת בקשה — HTTP message." },
      { phase: "encap", node: 0, add: "TCP",
        he: "TCP עוטף את ההודעה בכותרת → TCP segment (end-to-end)." },
      { phase: "encap", node: 0, add: "IP",
        he: "IP עוטף את ה-segment → IP packet (datagram)." },
      { phase: "encap", node: 0, add: "LINK",
        he: "שכבת הקישור עוטפת → Ethernet frame, מוכן לצאת על ההופ הראשון." },
      { phase: "hop", hop: 0, scope: "LINK",
        he: "hop 1: ה-frame נע פיזית C → Router 1 (Ethernet)." },
      { phase: "router", node: 1, hop: 0,
        he: "Router 1 מפרק את ה-frame, בוחן רק עד IP, ומרכיב frame חדש להופ הבא." },
      { phase: "hop", hop: 1, scope: "LINK",
        he: "hop 2: frame חדש (WiFi) נע Router 1 → Router 2 — הקישור השתנה!" },
      { phase: "router", node: 2, hop: 1,
        he: "Router 2 שוב בוחן עד IP בלבד, ומחליף שכבת קישור להופ האחרון." },
      { phase: "hop", hop: 2, scope: "LINK",
        he: "hop 3: frame (link אחר) נע Router 2 → מארח S." },
      { phase: "decap", node: 3,
        he: "מארח S מקלף כותרות מלמטה למעלה: frame → IP → TCP → HTTP." },
      { phase: "done",
        he: "סיכום: HTTP ו-TCP הם end-to-end (רק במארחים); IP נבחן hop-by-hop בכל נתב; ה-frame משתנה בכל hop." }
    ];
  }

  // ================================================================
  // RENDER
  // ================================================================
  function render(mount) {
    if (!mount) return;
    mount.innerHTML = "";
    mount.setAttribute("dir", "rtl");

    var wrap = document.createElement("div");
    wrap.className = "encaphops";
    mount.appendChild(wrap);

    injectStyle();

    // ---- caption / live status ----
    var status = document.createElement("p");
    status.className = "encaphops-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    wrap.appendChild(status);

    // ---- SVG stage ----
    // Coordinate system chosen so it scales via viewBox.
    var W = 920, H = 430;
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H,
      width: "100%",
      role: "img",
      "aria-label": "דיאגרמת encapsulation לאורך שני נתבים: HTTP ו-TCP end-to-end, IP hop-by-hop, frame משתנה בכל hop"
    });
    svg.style.display = "block";
    svg.style.maxWidth = "100%";
    wrap.appendChild(svg);

    // geometry (LTR left→right: C, R1, R2, S — the wire is a technical LTR diagram)
    var margin = 40;
    var laneY = 300;                 // baseline where the "wire" sits
    var colW = (W - margin * 2) / 4; // 4 nodes
    var nodeX = [];
    for (var i = 0; i < 4; i++) nodeX.push(margin + colW * i + colW / 2);

    // --- wire (physical channel) ---
    var wireG = el("g", {}, svg);
    el("line", {
      x1: nodeX[0], y1: laneY, x2: nodeX[3], y2: laneY,
      stroke: C.line, "stroke-width": 6, "stroke-linecap": "round"
    }, wireG);

    // per-hop link segments (colored, relabeled as the animation swaps them)
    var hopSeg = [];   // {rect, label}
    for (var h = 0; h < 3; h++) {
      var x1 = nodeX[h], x2 = nodeX[h + 1];
      var g = el("g", {}, wireG);
      var seg = el("line", {
        x1: x1 + 34, y1: laneY, x2: x2 - 34, y2: laneY,
        stroke: LAYER.LINK.color, "stroke-width": 6, "stroke-linecap": "round",
        opacity: 0.28
      }, g);
      var mid = (x1 + x2) / 2;
      var chip = el("g", { transform: "translate(" + mid + "," + (laneY + 30) + ")" }, g);
      el("rect", {
        x: -46, y: -13, width: 92, height: 26, rx: 13,
        fill: C.surface2, stroke: C.line, "stroke-width": 1
      }, chip);
      var lbl = txt(chip, 0, 4, HOPS[h].link + " · hop " + (h + 1), {
        "text-anchor": "middle", "font-size": "12", "font-weight": "600",
        fill: C.inkSoft, "font-family": "monospace"
      });
      hopSeg.push({ line: seg, label: lbl, hop: h });
    }

    // --- nodes: box + label + mini-stack ---
    var nodeStacks = []; // per node: array of {key, rect, text}
    for (var n = 0; n < 4; n++) {
      var nd = NODES[n];
      var cx = nodeX[n];
      var g2 = el("g", {}, svg);

      // device glyph on the wire
      var isHost = nd.kind === "host";
      var glyphW = isHost ? 62 : 54;
      var glyphH = isHost ? 46 : 40;
      el("rect", {
        x: cx - glyphW / 2, y: laneY - glyphH / 2, width: glyphW, height: glyphH,
        rx: 9, fill: C.surface, stroke: isHost ? C.clay : C.blue, "stroke-width": 2
      }, g2);
      // little icon: host = monitor, router = double-arrow
      if (isHost) {
        el("rect", { x: cx - 14, y: laneY - 11, width: 28, height: 18, rx: 2,
          fill: "none", stroke: C.inkSoft, "stroke-width": 1.5 }, g2);
        el("line", { x1: cx, y1: laneY + 7, x2: cx, y2: laneY + 12,
          stroke: C.inkSoft, "stroke-width": 1.5 }, g2);
      } else {
        el("path", { d: "M " + (cx - 12) + " " + (laneY - 4) + " h 20 l -5 -5 M " +
          (cx + 12) + " " + (laneY + 4) + " h -20 l 5 5",
          fill: "none", stroke: C.inkSoft, "stroke-width": 1.6,
          "stroke-linecap": "round", "stroke-linejoin": "round" }, g2);
      }

      txt(g2, cx, laneY + 62, nd.he, {
        "text-anchor": "middle", "font-size": "13", "font-weight": "700", fill: C.ink
      });
      txt(g2, cx, laneY + 78, nd.sub, {
        "text-anchor": "middle", "font-size": "11", fill: C.inkSoft,
        "font-family": "monospace"
      });

      // vertical protocol stack ABOVE the node (grows the encapsulation intuition)
      var stackG = el("g", {}, svg);
      var rowH = 30, rowW = 74, gap = 6;
      var topY = laneY - glyphH / 2 - 18; // bottom of stack sits just above glyph
      var thisStack = [];
      // draw from bottom (LINK) up to top (HTTP) so IP/LINK align near the wire
      for (var s = nd.stack.length - 1, row = 0; s >= 0; s--, row++) {
        var key = nd.stack[s];
        var L = LAYER[key];
        var y = topY - row * (rowH + gap) - rowH;
        var rG = el("g", { opacity: 0.28 }, stackG);
        var rect = el("rect", {
          x: cx - rowW / 2, y: y, width: rowW, height: rowH, rx: 7,
          fill: L.soft, stroke: L.color, "stroke-width": 1.6
        }, rG);
        txt(rG, cx, y + rowH / 2 + 4, L.label, {
          "text-anchor": "middle", "font-size": "13", "font-weight": "700",
          fill: C.ink, "font-family": "monospace"
        });
        thisStack.push({ key: key, group: rG, rect: rect, y: y });
      }
      nodeStacks.push(thisStack);
    }

    // --- the traveling "packet" nesting (the moving object) ---
    // A group we reposition/reshape per beat. Layered rects = nested headers.
    var pktG = el("g", { opacity: 0 }, svg);
    var pktLayers = {}; // key -> rect
    (function () {
      var order = ["LINK", "IP", "TCP", "HTTP"]; // outer→inner
      var base = 132, step = -13, hStep = -6;    // nesting inset
      for (var i2 = 0; i2 < order.length; i2++) {
        var k = order[i2];
        var w = base + i2 * step * 2;
        var hh = 52 + i2 * hStep * 2;
        var r = el("rect", {
          x: -w / 2, y: -hh / 2, width: w, height: hh, rx: 7,
          fill: LAYER[k].soft, stroke: LAYER[k].color, "stroke-width": 2
        }, pktG);
        // header tag on the left edge of each layer
        var tag = txt(pktG, -w / 2 + 4, -hh / 2 + 14, LAYER[k].label, {
          "font-size": "10", "font-weight": "700", fill: LAYER[k].color,
          "font-family": "monospace", "text-anchor": "start"
        });
        pktLayers[k] = { rect: r, tag: tag };
      }
      // payload label in the very center
      pktLayers._payload = txt(pktG, 0, 4, "data", {
        "text-anchor": "middle", "font-size": "11", "font-weight": "600",
        fill: C.inkSoft, "font-family": "monospace"
      });
    })();

    // --- scope brackets (top): HTTP end-to-end, TCP end-to-end, IP hop-by-hop ---
    var scopeG = el("g", {}, svg);
    function bracket(x1, x2, y, color, label, dashed) {
      var g3 = el("g", { opacity: 0.9 }, scopeG);
      el("path", {
        d: "M " + x1 + " " + (y + 8) + " V " + y + " H " + x2 + " V " + (y + 8),
        fill: "none", stroke: color, "stroke-width": 2,
        "stroke-dasharray": dashed ? "5 4" : "none", "stroke-linecap": "round"
      }, g3);
      var mid = (x1 + x2) / 2;
      var tw = label.length * 6.4 + 16;
      el("rect", { x: mid - tw / 2, y: y - 22, width: tw, height: 19, rx: 9,
        fill: C.surface, stroke: color, "stroke-width": 1.2 }, g3);
      txt(g3, mid, y - 8, label, {
        "text-anchor": "middle", "font-size": "11", "font-weight": "700",
        fill: color, "font-family": "monospace"
      });
      return g3;
    }
    // HTTP message + TCP segment span host↔host (end to end)
    bracket(nodeX[0], nodeX[3], 42, LAYER.HTTP.color, "HTTP message  (end-to-end)");
    bracket(nodeX[0], nodeX[3], 78, LAYER.TCP.color,  "TCP segment  (end-to-end)");
    // IP packet appears 3 times — hop by hop
    var ipBrackets = [];
    for (var ib = 0; ib < 3; ib++) {
      var g4 = bracket(nodeX[ib] + 18, nodeX[ib + 1] - 18, 118, LAYER.IP.color, "IP packet", true);
      ipBrackets.push(g4);
    }

    // ================================================================
    // ANIMATION STATE
    // ================================================================
    var beats = buildBeats();
    var idx = 0;
    var playing = false;
    var timer = null;

    // helpers to (de)emphasize stack rows / hop segments
    function setStackVisible(nodeI, keysOn) {
      var st = nodeStacks[nodeI];
      for (var i3 = 0; i3 < st.length; i3++) {
        var on = keysOn.indexOf(st[i3].key) !== -1;
        st[i3].group.setAttribute("opacity", on ? 1 : 0.28);
        st[i3].rect.setAttribute("stroke-width", on ? 2.4 : 1.6);
      }
    }
    function pulseStackRow(nodeI, key) {
      var st = nodeStacks[nodeI];
      for (var i4 = 0; i4 < st.length; i4++) {
        if (st[i4].key === key) {
          st[i4].group.setAttribute("opacity", 1);
          st[i4].rect.setAttribute("stroke-width", 3);
        }
      }
    }
    function setHopActive(hopI) {
      for (var i5 = 0; i5 < hopSeg.length; i5++) {
        var active = hopSeg[i5].hop === hopI;
        hopSeg[i5].line.setAttribute("opacity", active ? 1 : 0.28);
        hopSeg[i5].line.setAttribute("stroke", active ? LAYER.LINK.color : LAYER.LINK.color);
        hopSeg[i5].label.setAttribute("fill", active ? C.ink : C.inkSoft);
        hopSeg[i5].label.setAttribute("font-weight", active ? "700" : "600");
      }
    }
    function setIpBracketActive(hopI) {
      for (var i6 = 0; i6 < ipBrackets.length; i6++) {
        ipBrackets[i6].setAttribute("opacity", hopI === i6 ? 1 : 0.32);
      }
    }
    // show nested packet with only the given layers (outer→inner subset from LINK inward)
    function showPacketLayers(keys) {
      var order = ["LINK", "IP", "TCP", "HTTP"];
      for (var i7 = 0; i7 < order.length; i7++) {
        var k = order[i7];
        var on = keys.indexOf(k) !== -1;
        pktLayers[k].rect.setAttribute("opacity", on ? 1 : 0);
        pktLayers[k].tag.setAttribute("opacity", on ? 1 : 0);
      }
    }
    function movePacketTo(x, y, cb) {
      var cur = pktG.getAttribute("transform");
      var m = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(cur || "");
      var x0 = m ? parseFloat(m[1]) : x;
      var y0 = m ? parseFloat(m[2]) : y;
      if (reduceMotion) {
        pktG.setAttribute("transform", "translate(" + x + "," + y + ")");
        if (cb) cb();
        return;
      }
      var t0 = null, dur = 620;
      function frame(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // easeInOut
        var xx = x0 + (x - x0) * e, yy = y0 + (y - y0) * e;
        pktG.setAttribute("transform", "translate(" + xx + "," + yy + ")");
        if (p < 1) requestAnimationFrame(frame);
        else if (cb) cb();
      }
      requestAnimationFrame(frame);
    }

    // Reset all visual state to "start"
    function resetVisual() {
      for (var i8 = 0; i8 < 4; i8++) setStackVisible(i8, []);
      setHopActive(-1);
      setIpBracketActive(-1);
      pktG.setAttribute("opacity", 0);
      pktG.setAttribute("transform", "translate(" + nodeX[0] + "," + (laneY - 150) + ")");
      showPacketLayers([]);
    }

    // Apply a beat (idx already set). Non-animated final layout of that beat.
    function applyBeat() {
      var b = beats[idx];
      status.textContent = b.he;

      // dim everything first, then light up what this beat is about
      for (var i9 = 0; i9 < 4; i9++) setStackVisible(i9, []);
      setHopActive(-1);
      setIpBracketActive(-1);

      if (b.phase === "encap") {
        // building the stack at host C, headers added top→down (HTTP first, then wrapped)
        var built = [];
        var wanted = ["HTTP", "TCP", "IP", "LINK"];
        for (var w2 = 0; w2 < wanted.length; w2++) {
          built.push(wanted[w2]);
          if (wanted[w2] === b.add) break;
        }
        setStackVisible(0, built);
        pulseStackRow(0, b.add);
        // packet grows as nested layers (LINK outermost once present)
        pktG.setAttribute("opacity", 1);
        var order = ["LINK", "IP", "TCP", "HTTP"];
        var present = order.filter(function (k) { return built.indexOf(k) !== -1; });
        showPacketLayers(present);
        pktG.setAttribute("transform", "translate(" + nodeX[0] + "," + (laneY - 150) + ")");
      } else if (b.phase === "hop") {
        setHopActive(b.hop);
        setIpBracketActive(b.hop);
        // both endpoints of this hop keep IP/LINK lit
        setStackVisible(b.hop, ["IP", "LINK"]);
        setStackVisible(b.hop + 1, ["IP", "LINK"]);
        // on the wire, only the full frame (all layers) travels; inner layers ride inside
        showPacketLayers(["LINK", "IP", "TCP", "HTTP"]);
        pktG.setAttribute("opacity", 1);
        var mid = (nodeX[b.hop] + nodeX[b.hop + 1]) / 2;
        pktG.setAttribute("transform", "translate(" + mid + "," + (laneY - 70) + ")");
      } else if (b.phase === "router") {
        // router examines up to IP only, swaps LINK
        setStackVisible(b.node, ["IP", "LINK"]);
        pulseStackRow(b.node, "IP");
        pulseStackRow(b.node, "LINK");
        setIpBracketActive(-1);
        pktG.setAttribute("opacity", 1);
        showPacketLayers(["LINK", "IP", "TCP", "HTTP"]);
        pktG.setAttribute("transform", "translate(" + nodeX[b.node] + "," + (laneY - 70) + ")");
      } else if (b.phase === "decap") {
        setStackVisible(3, ["HTTP", "TCP", "IP", "LINK"]);
        pktG.setAttribute("opacity", 1);
        showPacketLayers(["HTTP"]);
        pktG.setAttribute("transform", "translate(" + nodeX[3] + "," + (laneY - 150) + ")");
      } else if (b.phase === "done") {
        // light up the teaching summary: end-to-end vs hop-by-hop
        setStackVisible(0, ["HTTP", "TCP", "IP", "LINK"]);
        setStackVisible(3, ["HTTP", "TCP", "IP", "LINK"]);
        setStackVisible(1, ["IP", "LINK"]);
        setStackVisible(2, ["IP", "LINK"]);
        for (var ip2 = 0; ip2 < 3; ip2++) ipBrackets[ip2].setAttribute("opacity", 1);
        pktG.setAttribute("opacity", 0);
      }
      updateChrome();
    }

    // Animated transition INTO the current beat (used by step/play)
    function playBeat() {
      var b = beats[idx];
      status.textContent = b.he;
      for (var i10 = 0; i10 < 4; i10++) setStackVisible(i10, []);
      setHopActive(-1);
      setIpBracketActive(-1);

      if (b.phase === "hop") {
        setHopActive(b.hop);
        setIpBracketActive(b.hop);
        setStackVisible(b.hop, ["IP", "LINK"]);
        setStackVisible(b.hop + 1, ["IP", "LINK"]);
        showPacketLayers(["LINK", "IP", "TCP", "HTTP"]);
        pktG.setAttribute("opacity", 1);
        // start at source node, glide to next node along the wire
        var sx = nodeX[b.hop], tx = nodeX[b.hop + 1];
        pktG.setAttribute("transform", "translate(" + sx + "," + (laneY - 70) + ")");
        movePacketTo(tx, laneY - 70, function () {
          if (playing) scheduleNext();
        });
        return;
      }
      // non-hop beats: just snap into place, then (if playing) schedule next
      applyBeat();
      if (playing) scheduleNext();
    }

    function scheduleNext() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (!playing) return;
        if (idx < beats.length - 1) { idx++; playBeat(); }
        else { playing = false; updateChrome(); }
      }, reduceMotion ? 900 : 1150);
    }

    // ---------- controls ----------
    var controls = document.createElement("div");
    controls.className = "viz-controls";
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "בקרות אנימציה");
    wrap.appendChild(controls);

    var btnPrev = mkBtn("→ הקודם", "prev");
    var btnPlay = mkBtn("▶ הפעל", "play primary");
    var btnNext = mkBtn("הבא ←", "next");
    var btnReset = mkBtn("↺ אתחל", "reset");
    controls.appendChild(btnPrev);
    controls.appendChild(btnPlay);
    controls.appendChild(btnNext);
    controls.appendChild(btnReset);

    // progress dots
    var dots = document.createElement("div");
    dots.className = "encaphops-dots";
    dots.setAttribute("aria-hidden", "true");
    var dotEls = [];
    for (var d = 0; d < beats.length; d++) {
      var dot = document.createElement("span");
      dot.className = "encaphops-dot";
      dots.appendChild(dot);
      dotEls.push(dot);
    }
    controls.appendChild(dots);

    // legend
    var legend = document.createElement("div");
    legend.className = "encaphops-legend";
    ["HTTP", "TCP", "IP", "LINK"].forEach(function (k) {
      var L = LAYER[k];
      var item = document.createElement("span");
      item.className = "encaphops-leg";
      var sw = document.createElement("i");
      sw.style.background = L.soft;
      sw.style.borderColor = L.color;
      item.appendChild(sw);
      var t = document.createElement("b");
      t.textContent = L.label;
      t.setAttribute("dir", "ltr");
      item.appendChild(t);
      var he = document.createElement("small");
      he.textContent = " " + L.he;
      item.appendChild(he);
      legend.appendChild(item);
    });
    wrap.appendChild(legend);

    function mkBtn(label, cls) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn" + (cls.indexOf("primary") !== -1 ? " primary" : "");
      b.textContent = label;
      b.dataset.role = cls;
      return b;
    }

    function updateChrome() {
      btnPrev.disabled = idx === 0;
      btnNext.disabled = idx === beats.length - 1;
      btnPlay.textContent = playing ? "⏸ השהה" : (idx === beats.length - 1 ? "↺ שוב" : "▶ הפעל");
      for (var i11 = 0; i11 < dotEls.length; i11++) {
        dotEls[i11].classList.toggle("on", i11 === idx);
        dotEls[i11].classList.toggle("past", i11 < idx);
      }
    }

    function stop() { playing = false; clearTimeout(timer); updateChrome(); }
    function goto(n, animate) {
      idx = Math.max(0, Math.min(beats.length - 1, n));
      if (animate) playBeat(); else applyBeat();
    }

    btnNext.addEventListener("click", function () {
      stop();
      if (idx < beats.length - 1) goto(idx + 1, true);
    });
    btnPrev.addEventListener("click", function () {
      stop();
      if (idx > 0) goto(idx - 1, false);
    });
    btnReset.addEventListener("click", function () {
      stop(); idx = 0; resetVisual(); applyBeat();
    });
    btnPlay.addEventListener("click", function () {
      if (playing) { stop(); return; }
      if (idx === beats.length - 1) { idx = 0; resetVisual(); }
      playing = true;
      updateChrome();
      playBeat();
    });

    // keyboard: arrows step (RTL-aware: ← = next, → = prev), space = play/pause
    svg.setAttribute("tabindex", "0");
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); stop(); if (idx < beats.length - 1) goto(idx + 1, true); }
      else if (e.key === "ArrowRight") { e.preventDefault(); stop(); if (idx > 0) goto(idx - 1, false); }
      else if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); btnPlay.click(); }
      else if (e.key === "Home") { e.preventDefault(); btnReset.click(); }
    });

    // init
    resetVisual();
    applyBeat();
  }

  // ---------- one-time CSS for the DOM chrome (SVG uses inline attrs) ----------
  function injectStyle() {
    if (document.getElementById("encaphops-style")) return;
    var s = document.createElement("style");
    s.id = "encaphops-style";
    s.textContent = [
      ".encaphops{font-family:inherit;color:" + C.ink + ";}",
      ".encaphops-status{margin:0 0 .6rem;font-size:.95rem;font-weight:600;line-height:1.5;color:" + C.ink + ";min-height:2.9em;background:" + C.surface2 + ";border:1px solid " + C.line + ";border-radius:12px;padding:.6rem .8rem;}",
      ".encaphops-dots{display:flex;gap:6px;align-items:center;margin-inline-start:auto;}",
      ".encaphops-dot{width:9px;height:9px;border-radius:50%;background:" + C.line + ";transition:background .2s,transform .2s;}",
      ".encaphops-dot.past{background:" + C.sage + ";}",
      ".encaphops-dot.on{background:" + C.clay + ";transform:scale(1.4);}",
      ".encaphops-legend{display:flex;flex-wrap:wrap;gap:.4rem 1rem;margin-top:.8rem;font-size:.8rem;color:" + C.inkSoft + ";}",
      ".encaphops-leg{display:inline-flex;align-items:center;gap:.35rem;}",
      ".encaphops-leg i{width:14px;height:14px;border-radius:4px;border:1.6px solid;display:inline-block;}",
      ".encaphops-leg b{font-family:monospace;color:" + C.ink + ";font-weight:700;}",
      ".encaphops-leg small{color:" + C.inkSoft + ";}",
      "@media (prefers-reduced-motion: reduce){.encaphops-dot{transition:none;}}"
    ].join("");
    document.head.appendChild(s);
  }

  // ---------- mount ----------
  function boot() {
    var mounts = document.querySelectorAll('[data-viz="encapsulation-hops"]');
    if (!mounts.length) return;
    mounts.forEach(function (m) {
      try { render(m); }
      catch (err) {
        if (window.console && console.error) console.error("encapsulation-hops:", err);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
