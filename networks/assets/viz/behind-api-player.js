/* =====================================================================
   behind-api-player.js  —  Module 04 "מאחורי ה-API — מ-browser ל-packets"
   Grounded in _notes/sockets-transport-intro.md §4 (browser → HTTP → TCP
   connection → send() → packetization → DTA → wire → ATD).

   A step-by-step "player" that animates the EXACT lecturer model:
     צעד 1  URL supplied by the user
     צעד 2  browser parses the URL → hostname + file name (default if none)
     צעד 3  browser activates the http module → http request message
     צעד 4  http establishes a TCP connection (LOGICAL, not physical) +
            prepares the request message (a collection of bytes / fields)
     צעד 5  http calls send() through the TCP connection
     packetization  message divided & packed into packets (מנות) by L4
     DTA   the NIC converts the packet bytes to an analog carrier signal
           (Digital To Analog — lecturer's own abbreviation)
     wire  the carrier EM wave travels the physical channel to the switch NIC
     ATD   the far NIC converts analog → binary (Analog To Digital)

   Self-contained IIFE. No external deps. Cream design tokens hardcoded.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "behind-api-player";

  /* --- design palette (hardcoded per CONTRACT §2) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",   /* dusty-blue = day-1 accent */
    clay: "#BE7C5E",
    sage: "#7C9885",
    mustard: "#C9A24B"
  };

  var SVGNS = "http://www.w3.org/2000/svg";

  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ---------------------------------------------------------------
     The model: ordered stages. Each stage highlights part of the
     scene and shows a Hebrew explanation grounded in the notes.
     --------------------------------------------------------------- */
  var STAGES = [
    {
      key: "url",
      badge: "צעד 1",
      title: "המשתמש מספק URL",
      body: "המשתמש מקליד כתובת — <b dir=\"ltr\">URL = Uniform Resource Locator</b>. " +
            "לדוגמה <code dir=\"ltr\">online.shenkar.ac.il</code>. זו נקודת הפתיחה של כל המסע.",
      color: C.blue
    },
    {
      key: "parse",
      badge: "צעד 2",
      title: "ה-browser מנתח (parsing) את ה-URL",
      body: "ה-browser מחלץ את <b>שם המארח</b> (<span dir=\"ltr\">hostname</span>) ואת " +
            "<b>שם הקובץ</b> המבוקש. אם אין שם קובץ — משתמש ב-<span dir=\"ltr\">default file name</span>.",
      color: C.blue
    },
    {
      key: "http",
      badge: "צעד 3",
      title: "הפעלת מודול ה-http",
      body: "ה-browser מפעיל מודול המממש את פרוטוקול התקשורת <b dir=\"ltr\">http = hyper-text transfer protocol</b> " +
            "(ה-<span dir=\"ltr\">http client</span>) ומורה לו להכין הודעת בקשה — <b>http request message (הודעת בקשה)</b>.",
      color: C.clay
    },
    {
      key: "tcp",
      badge: "צעד 4",
      title: "הקמת TCP connection + הכנת ההודעה",
      body: "ה-http מקים <b dir=\"ltr\">TCP connection</b> מול ה-<span dir=\"ltr\">http server</span> שבתוך ה-" +
            "<span dir=\"ltr\">WSP (Web Server Program)</span>, ומכין את הודעת הבקשה — אוסף בתים המאורגן " +
            "כ<b>שדות (fields)</b>.<br><b style=\"color:" + C.clay + "\">שימו לב: הקישור לוגי !!! לא פיזי.</b>",
      color: C.clay
    },
    {
      key: "send",
      badge: "צעד 5",
      title: "קריאה ל-send()",
      body: "ה-http מבצע <code dir=\"ltr\">send()</code> ושולח את הודעת הבקשה <b>דרך</b> ה-" +
            "<span dir=\"ltr\">TCP connection</span> שהקים מול ה-http של השרת.",
      color: C.clay
    },
    {
      key: "packets",
      badge: "packetization",
      title: "פירוק ל-packets (מנות)",
      body: "בדרך אל ה-NIC מתרחשים „אלפי צעדים”: בתי ההודעה <b>מחולקים ונארזים</b> ליחידות מידע " +
            "הנקראות <b>packets (מנות)</b>. את האריזה מבצע פרוטוקול שכבה 4 (<b dir=\"ltr\">TCP / UDP</b>); " +
            "כל packet קטן מ-<span dir=\"ltr\">~2000 bytes</span>.",
      color: C.mustard
    },
    {
      key: "dta",
      badge: "DTA",
      title: "המרה דיגיטלית ← אנלוגית (Digital To Analog)",
      body: "ה-NIC יוצר <b>אות נושא (carrier signal)</b> — גל אלקטרו-מגנטי / גל אור — ה„נושא על גבו” " +
            "את הביטים. ההמרה של בתי ה-packet לאות אנלוגי מכונה אצל המרצה <b dir=\"ltr\">DTA = Digital To Analog</b>.",
      color: C.sage,
      note: "הערה: „DTA” היא הקיצור הלא-סטנדרטי של המרצה; בשקפים הסימון של DTA/ATD אינו עקבי."
    },
    {
      key: "wire",
      badge: "wire",
      title: "מעבר בערוץ הפיזי",
      body: "האות הנושא נע <b>פיזית !!! לא לוגית</b> דרך ערוץ התקשורת (קווי חשמלי / אופטי, או אלחוטי = אוויר) " +
            "אל ה-NIC של ציוד התקשורת הבא — <span dir=\"ltr\">access switch</span> / home router.",
      color: C.sage
    },
    {
      key: "atd",
      badge: "ATD",
      title: "המרה אנלוגית ← דיגיטלית (Analog To Digital)",
      body: "ב-NIC המרוחק האות מומר בחזרה מאנלוגי לבינארי — <b dir=\"ltr\">ATD = Analog To Digital</b> — " +
            "וה-packet מתקבל בצד הנמען.",
      color: C.sage,
      note: "הערה: גם „ATD” הוא קיצור של המרצה; בשקף המקורי הוא נכתב לעיתים אף הוא כ-„DTA”."
    }
  ];

  /* ---------------------------------------------------------------
     SVG scene builder (hand-authored). Layout, LTR box (host C) on the
     left, wire in the middle, receiver NIC (switch) on the right.
     --------------------------------------------------------------- */
  function el(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function txt(x, y, s, attrs) {
    var t = el("text", attrs || {});
    t.setAttribute("x", x);
    t.setAttribute("y", y);
    t.textContent = s;
    return t;
  }

  function buildScene() {
    var svg = el("svg", {
      viewBox: "0 0 720 300",
      width: "100%",
      role: "img",
      "aria-label": "מסע הודעת HTTP מה-browser אל ה-NIC וה-wire",
      direction: "ltr"
    });
    svg.style.display = "block";
    svg.style.maxWidth = "720px";
    svg.style.margin = "0 auto";

    /* --- defs: carrier square-wave gradient not needed; use plain --- */
    var defs = el("defs");
    var grad = el("linearGradient", { id: "bap-wire", x1: "0", y1: "0", x2: "1", y2: "0" });
    grad.appendChild(el("stop", { offset: "0", "stop-color": C.sage, "stop-opacity": "0.25" }));
    grad.appendChild(el("stop", { offset: "0.5", "stop-color": C.sage, "stop-opacity": "0.6" }));
    grad.appendChild(el("stop", { offset: "1", "stop-color": C.sage, "stop-opacity": "0.25" }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    var g = {};

    /* ===== HOST C (sender) rectangle ===== */
    var host = el("rect", {
      x: 24, y: 30, width: 300, height: 236, rx: 16,
      fill: C.surface2, stroke: C.line, "stroke-width": 2
    });
    svg.appendChild(host);
    svg.appendChild(txt(174, 52, "מארח C  ·  host C", {
      "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: C.inkSoft, direction: "rtl"
    }));

    /* browser oval + message square (the magenta square in the notes) */
    g.browser = el("ellipse", {
      cx: 130, cy: 96, rx: 78, ry: 30,
      fill: C.surface, stroke: C.blue, "stroke-width": 2
    });
    svg.appendChild(g.browser);
    svg.appendChild(txt(130, 92, "browser", {
      "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: C.ink
    }));
    g.browserLabel = txt(130, 108, "http client", {
      "text-anchor": "middle", "font-size": 10, fill: C.inkSoft
    });
    svg.appendChild(g.browserLabel);

    /* the message square (magenta-ish -> clay) that appears at step 3/4 */
    g.msg = el("rect", {
      x: 250, y: 82, width: 26, height: 26, rx: 5,
      fill: C.clay, opacity: 0
    });
    svg.appendChild(g.msg);
    g.msgLabel = txt(263, 99, "M", {
      "text-anchor": "middle", "font-size": 12, "font-weight": 800, fill: "#fff", opacity: 0
    });
    svg.appendChild(g.msgLabel);

    /* TCP connection: a dashed LOGICAL link that leaves the host to the right */
    g.tcp = el("path", {
      d: "M208 96 C 360 96, 520 96, 690 96",
      fill: "none", stroke: C.clay, "stroke-width": 2.5,
      "stroke-dasharray": "7 6", opacity: 0, "stroke-linecap": "round"
    });
    svg.appendChild(g.tcp);
    g.tcpLabel = txt(430, 84, "TCP connection (לוגי, לא פיזי)", {
      "text-anchor": "middle", "font-size": 11, "font-weight": 600, fill: C.clay, opacity: 0, direction: "rtl"
    });
    svg.appendChild(g.tcpLabel);

    /* bottom hardware blocks: NVM, לוח אם, NIC */
    var by = 214, bw = 88, bh = 40;
    var blocks = [
      { x: 40, label1: "NVM", label2: "" },
      { x: 40 + bw + 8, label1: "לוח אם", label2: "mainboard" },
      { x: 40 + 2 * (bw + 8), label1: "NIC", label2: "network card" }
    ];
    blocks.forEach(function (b, i) {
      var r = el("rect", {
        x: b.x, y: by, width: bw, height: bh, rx: 7,
        fill: C.surface, stroke: C.blue, "stroke-width": 1.5, opacity: 0.9
      });
      svg.appendChild(r);
      svg.appendChild(txt(b.x + bw / 2, by + 18, b.label1, {
        "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: C.ink
      }));
      if (b.label2) svg.appendChild(txt(b.x + bw / 2, by + 31, b.label2, {
        "text-anchor": "middle", "font-size": 8.5, fill: C.inkSoft
      }));
      if (i === 2) { g.nic = r; g.nicX = b.x + bw / 2; }
    });

    /* down arrow browser -> NIC (appears at packetization) */
    g.downArrow = el("path", {
      d: "M" + g.nicX + " 128 L " + g.nicX + " 206",
      fill: "none", stroke: C.mustard, "stroke-width": 3,
      "marker-end": "url(#bap-arrow)", opacity: 0, "stroke-linecap": "round"
    });
    /* arrow marker */
    var marker = el("marker", {
      id: "bap-arrow", viewBox: "0 0 10 10", refX: "6", refY: "5",
      markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse"
    });
    marker.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", fill: C.mustard }));
    defs.appendChild(marker);
    svg.appendChild(g.downArrow);

    /* small packet squares that stack near NIC at packetization */
    g.packets = [];
    for (var p = 0; p < 3; p++) {
      var pk = el("rect", {
        x: g.nicX - 30 + p * 20, y: 168, width: 15, height: 15, rx: 3,
        fill: C.mustard, opacity: 0
      });
      svg.appendChild(pk);
      g.packets.push(pk);
    }

    /* ===== WIRE (physical channel) ===== */
    var wireY = 234;
    g.wireLine = el("line", {
      x1: 260, y1: wireY, x2: 500, y2: wireY,
      stroke: C.line, "stroke-width": 8, "stroke-linecap": "round"
    });
    svg.appendChild(g.wireLine);

    /* carrier square-wave path drawn over the wire (hidden until DTA) */
    g.wave = el("path", {
      d: squareWavePath(268, wireY, 224, 9),
      fill: "none", stroke: C.sage, "stroke-width": 2.5, opacity: 0, "stroke-linejoin": "round"
    });
    svg.appendChild(g.wave);
    g.waveLabel = txt(380, wireY + 26, "carrier signal  0 1 0 1 1 0", {
      "text-anchor": "middle", "font-size": 10, "font-weight": 600, fill: C.sage, opacity: 0
    });
    svg.appendChild(g.waveLabel);

    /* a travelling pulse dot on the wire */
    g.pulse = el("circle", { cx: 268, cy: wireY, r: 6, fill: C.sage, opacity: 0 });
    svg.appendChild(g.pulse);

    /* ===== RECEIVER: switch NIC ===== */
    var rx = 512;
    g.switch = el("rect", {
      x: rx, y: 200, width: 176, height: 66, rx: 12,
      fill: C.surface2, stroke: C.line, "stroke-width": 2
    });
    svg.appendChild(g.switch);
    svg.appendChild(txt(rx + 88, 222, "access switch", {
      "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: C.inkSoft
    }));
    g.switchNic = el("rect", {
      x: rx + 52, y: 232, width: 72, height: 26, rx: 6,
      fill: C.surface, stroke: C.sage, "stroke-width": 1.5
    });
    svg.appendChild(g.switchNic);
    svg.appendChild(txt(rx + 88, 249, "NIC", {
      "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: C.ink
    }));

    /* received packet indicator on the switch */
    g.rxPacket = el("rect", {
      x: rx + 80, y: 168, width: 15, height: 15, rx: 3, fill: C.sage, opacity: 0
    });
    svg.appendChild(g.rxPacket);

    return { svg: svg, g: g, wireY: wireY };
  }

  /* build a square-wave path (digital carrier) */
  function squareWavePath(x, midY, width, amp) {
    var bits = [0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
    var step = width / bits.length;
    var d = "M" + x + " " + (midY - (bits[0] ? amp : -amp));
    var cx = x;
    for (var i = 0; i < bits.length; i++) {
      var y = midY - (bits[i] ? amp : -amp);
      d += " L" + cx + " " + y;
      cx += step;
      d += " L" + cx + " " + y;
      /* vertical transition to next level handled by next L to new y at same cx */
      if (i < bits.length - 1) {
        var ny = midY - (bits[i + 1] ? amp : -amp);
        d += " L" + cx + " " + ny;
      }
    }
    return d;
  }

  /* ---------------------------------------------------------------
     Apply visual state for a given stage index (idempotent).
     --------------------------------------------------------------- */
  function applyStage(scene, idx) {
    var g = scene.g;
    var reached = function (key) {
      // is stage `key` at or before current idx?
      for (var i = 0; i <= idx; i++) if (STAGES[i].key === key) return true;
      return false;
    };
    var setOp = function (node, v) { if (node) node.setAttribute("opacity", v); };

    // message square: visible from http (3) onward
    var showMsg = reached("http") ? 1 : 0;
    setOp(g.msg, showMsg);
    setOp(g.msgLabel, showMsg);
    // message sits in browser until send, then moves toward NIC at packets
    var atPackets = reached("packets");
    g.msg.setAttribute("x", atPackets ? (g.nicX - 13) : 250);
    g.msg.setAttribute("y", atPackets ? 150 : 82);
    g.msgLabel.setAttribute("x", atPackets ? g.nicX : 263);
    g.msgLabel.setAttribute("y", atPackets ? 167 : 99);
    // hide the single message square once it becomes packets
    if (atPackets) { setOp(g.msg, 0); setOp(g.msgLabel, 0); }

    // browser highlight on parse/url/http steps
    g.browser.setAttribute("stroke", (reached("url") && !reached("tcp")) ? C.blue : C.line);
    g.browser.setAttribute("stroke-width", 2);

    // TCP connection: visible from tcp(4) onward
    var showTcp = reached("tcp") ? 1 : 0;
    setOp(g.tcp, showTcp);
    setOp(g.tcpLabel, showTcp);
    // emphasise send: thicken the dashed link briefly is handled by animation

    // down arrow + packets at packetization
    var showPk = atPackets ? 1 : 0;
    setOp(g.downArrow, showPk);
    g.packets.forEach(function (pk, i) {
      setOp(pk, showPk);
      pk.setAttribute("x", g.nicX - 30 + i * 20);
      pk.setAttribute("y", 168);
    });

    // NIC highlight from DTA onward
    var atDTA = reached("dta");
    g.nic.setAttribute("stroke", atDTA ? C.sage : C.blue);
    g.nic.setAttribute("stroke-width", atDTA ? 2.5 : 1.5);

    // wave on wire from DTA onward
    var showWave = atDTA ? 1 : 0;
    setOp(g.wave, showWave);
    setOp(g.waveLabel, showWave);
    g.wireLine.setAttribute("stroke", atDTA ? "url(#bap-wire)" : C.line);

    // pulse travelling on wire = wire stage
    var atWire = reached("wire");
    setOp(g.pulse, atWire && !reached("atd") ? 1 : 0);
    g.pulse.setAttribute("cx", atWire ? 490 : 268);

    // ATD: receiver NIC lights + rx packet appears
    var atATD = reached("atd");
    g.switchNic.setAttribute("stroke", atATD ? C.sage : C.line);
    g.switchNic.setAttribute("stroke-width", atATD ? 2.5 : 1.5);
    setOp(g.rxPacket, atATD ? 1 : 0);
  }

  /* one-shot transient animation cue for entering a stage (respects RM) */
  function pulseStage(scene, idx) {
    if (reducedMotion()) return;
    var g = scene.g;
    var key = STAGES[idx].key;
    if (key === "send") {
      // flash the TCP link
      var t = g.tcp;
      t.setAttribute("stroke-width", 4);
      setTimeout(function () { t.setAttribute("stroke-width", 2.5); }, 260);
      // animate dash offset for a "sending" feel
      animateDash(t, 900);
    } else if (key === "wire") {
      // slide the pulse across
      slidePulse(g.pulse, 268, 490, 700);
    } else if (key === "packets") {
      // stagger packet pop
      g.packets.forEach(function (pk, i) {
        pk.setAttribute("opacity", 0);
        setTimeout(function () { pk.setAttribute("opacity", 1); }, 90 * i + 40);
      });
    } else if (key === "dta") {
      animateDash(g.tcp, 0); // no-op safe
    }
  }

  function animateDash(path, dur) {
    if (reducedMotion() || !dur) return;
    var start = null, total = 40;
    function frame(ts) {
      if (start === null) start = ts;
      var p = (ts - start);
      path.setAttribute("stroke-dashoffset", (p / dur * total) % total * -1);
      if (p < dur) requestAnimationFrame(frame);
      else path.setAttribute("stroke-dashoffset", 0);
    }
    requestAnimationFrame(frame);
  }

  function slidePulse(node, from, to, dur) {
    var start = null;
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      node.setAttribute("cx", from + (to - from) * e);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------
     Render into a mount.
     --------------------------------------------------------------- */
  function render(mount) {
    if (!mount || mount.getAttribute("data-bap-ready") === "1") return;
    mount.setAttribute("data-bap-ready", "1");
    mount.innerHTML = "";

    var idx = 0;
    var autoTimer = null;

    /* wrapper */
    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";

    /* scene */
    var scene = buildScene();
    var sceneBox = document.createElement("div");
    sceneBox.style.background = C.surface;
    sceneBox.style.borderRadius = "12px";
    sceneBox.appendChild(scene.svg);
    wrap.appendChild(sceneBox);

    /* progress rail (clickable stage chips) */
    var rail = document.createElement("div");
    rail.setAttribute("role", "tablist");
    rail.setAttribute("aria-label", "שלבי המסע");
    rail.style.display = "flex";
    rail.style.flexWrap = "wrap";
    rail.style.gap = "6px";
    rail.style.margin = "14px 0 4px";
    rail.style.direction = "rtl";

    var chips = STAGES.map(function (s, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn";
      b.setAttribute("role", "tab");
      b.textContent = s.badge;
      b.style.padding = ".28rem .7rem";
      b.style.fontSize = ".78rem";
      b.addEventListener("click", function () { stopAuto(); goto(i); });
      rail.appendChild(b);
      return b;
    });
    wrap.appendChild(rail);

    /* explanation panel */
    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.background = C.surface2;
    panel.style.border = "1px solid " + C.line;
    panel.style.borderRadius = "12px";
    panel.style.padding = "12px 14px";
    panel.style.marginTop = "10px";
    panel.style.minHeight = "82px";
    panel.style.color = C.ink;
    panel.style.lineHeight = "1.6";
    wrap.appendChild(panel);

    /* controls */
    var controls = document.createElement("div");
    controls.className = "viz-controls";

    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); goto(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); goto(idx + 1); });
    btnNext.classList.add("primary");
    var btnPlay = mkBtn("▶ הפעל", function () { toggleAuto(); });
    var btnReset = mkBtn("↺ איפוס", function () { stopAuto(); goto(0); });

    controls.appendChild(btnPrev);
    controls.appendChild(btnNext);
    controls.appendChild(btnPlay);
    controls.appendChild(btnReset);
    wrap.appendChild(controls);

    mount.appendChild(wrap);

    function mkBtn(label, fn) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn";
      b.textContent = label;
      b.addEventListener("click", fn);
      return b;
    }

    /* ---- navigation ---- */
    function goto(n) {
      idx = Math.max(0, Math.min(STAGES.length - 1, n));
      applyStage(scene, idx);
      pulseStage(scene, idx);
      renderPanel();
      renderChips();
      btnPrev.disabled = (idx === 0);
      btnNext.disabled = (idx === STAGES.length - 1);
    }

    function renderPanel() {
      var s = STAGES[idx];
      var html =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">' +
          '<span style="background:' + s.color + ';color:#fff;font-weight:700;font-size:.72rem;' +
            'padding:2px 9px;border-radius:99px" dir="ltr">' + s.badge + '</span>' +
          '<b style="font-size:1rem;color:' + C.ink + '">' + s.title + '</b>' +
        '</div>' +
        '<div style="font-size:.9rem">' + s.body + '</div>';
      if (s.note) {
        html += '<div style="margin-top:8px;font-size:.78rem;color:' + C.inkSoft +
          ';border-inline-start:3px solid ' + C.mustard + ';padding-inline-start:8px">' +
          s.note + '</div>';
      }
      panel.innerHTML = html;
    }

    function renderChips() {
      chips.forEach(function (b, i) {
        var active = (i === idx);
        var done = (i < idx);
        b.setAttribute("aria-selected", active ? "true" : "false");
        if (active) {
          b.style.background = STAGES[i].color;
          b.style.color = "#fff";
          b.style.borderColor = STAGES[i].color;
        } else if (done) {
          b.style.background = C.surface2;
          b.style.color = C.ink;
          b.style.borderColor = STAGES[i].color;
        } else {
          b.style.background = C.surface2;
          b.style.color = C.inkSoft;
          b.style.borderColor = C.line;
        }
      });
    }

    /* ---- autoplay ---- */
    function toggleAuto() {
      if (autoTimer) stopAuto();
      else startAuto();
    }
    function startAuto() {
      if (idx === STAGES.length - 1) goto(0);
      btnPlay.textContent = "⏸ השהה";
      btnPlay.classList.add("primary");
      var delay = reducedMotion() ? 1500 : 2100;
      autoTimer = setInterval(function () {
        if (idx >= STAGES.length - 1) { stopAuto(); return; }
        goto(idx + 1);
      }, delay);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      btnPlay.textContent = "▶ הפעל";
      btnPlay.classList.remove("primary");
    }

    /* keyboard: arrows move stages (RTL-aware: Right = prev, Left = next) */
    wrap.setAttribute("tabindex", "0");
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { stopAuto(); goto(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { stopAuto(); goto(idx + 1); e.preventDefault(); }
      else if (e.key === "Home") { stopAuto(); goto(0); e.preventDefault(); }
      else if (e.key === "End") { stopAuto(); goto(STAGES.length - 1); e.preventDefault(); }
    });

    /* initial paint */
    goto(0);
  }

  /* ---------------------------------------------------------------
     mount all instances on DOMContentLoaded (guard for already-ready)
     --------------------------------------------------------------- */
  function boot() {
    try {
      var mounts = document.querySelectorAll('[data-viz="' + VIZ_ID + '"]');
      if (!mounts || !mounts.length) return;
      mounts.forEach(function (m) { render(m); });
    } catch (err) {
      /* degrade silently — never throw into the page */
      if (window.console && console.warn) console.warn("[" + VIZ_ID + "] " + err.message);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
