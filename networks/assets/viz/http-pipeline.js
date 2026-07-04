/* ============================================================================
 * http-pipeline.js  —  Hero viz for Module 1 (01-intro)
 * Follows the model in _notes/intro-layering.md §B5 (HTTP walkthrough, the
 * numbered steps 1–5) + the message → packets → DTA → physical-signal flow
 * (L01-2 v2, slides 21–34). Lecturer fidelity kept: URL parse → hostname +
 * default file name, http request message "GET file-name HTTP/1.1 CRLF …",
 * LOGICAL (not physical) TCP connection, send(), split into packets (<2000B),
 * DTA = Digital-To-Analog (lecturer's acronym order) → carrier signal on the
 * physical channel toward the switch/router.
 *
 * Self-contained IIFE. Hand-authored SVG/DOM. No external deps.
 * Palette hard-coded from the cream design system. RTL-aware; English
 * technical labels kept LTR.
 * ==========================================================================*/
(function () {
  "use strict";

  var VIZ_ID = "http-pipeline";

  // ---- design palette (hard-coded per contract §2) ------------------------
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0", // dusty-blue  (Day-1 accent)
    clay: "#BE7C5E",
    sage: "#7C9885",
    mustard: "#C9A24B"
  };

  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) { reduceMotion = false; }

  // ---- the 5-step model (exact lecturer wording, glossed) -----------------
  // Each step targets one region of the stage and reveals its detail card.
  var STEPS = [
    {
      n: 1,
      title: "המשתמש מספק URL",
      eng: "URL = Uniform Resource Locator",
      body: 'המשתמש מקליד כתובת בדפדפן, למשל <span dir="ltr">online.shenkar.ac.il</span>. ' +
            'זהו מחרוזת שהדפדפן צריך לפענח.',
      focus: "browser",
      accent: C.blue
    },
    {
      n: 2,
      title: "הדפדפן מבצע parsing ל-URL",
      eng: "parse → hostname + file name",
      body: 'הדפדפן מחלץ את <b>hostname</b> של השרת ואת שם ה<b>file</b> המבוקש. ' +
            'אם אין שם קובץ — משתמשים ב-<b>default file name</b>.',
      focus: "browser",
      accent: C.blue
    },
    {
      n: 3,
      title: "הדפדפן מפעיל את http ומכין בקשה",
      eng: "http = HyperText Transfer Protocol",
      body: 'הדפדפן מפעיל מודול שמממש את פרוטוקול <b>http</b> (ה-<span dir="ltr">http client</span>) ' +
            'ומורה לו לשלוח <b>http request message</b> אל תוכנית השרת.',
      focus: "http",
      accent: C.clay
    },
    {
      n: 4,
      title: "http יוצר קישור TCP ומכין את ההודעה",
      eng: "TCP connection — LOGICAL, not physical!",
      body: 'ה-<span dir="ltr">http client</span> יוצר <b>קישור TCP</b> אל ה-<span dir="ltr">http server</span>, ' +
            'ומכין את ההודעה: אוסף בתים המאורגן ל<b>שדות</b> ' +
            '(<span dir="ltr">GET file-name HTTP/1.1 CRLF …</span>, ~1300 bytes). ' +
            '<b>שימו לב: הקישור לוגי — לא פיזי!</b>',
      focus: "tcp",
      accent: C.clay
    },
    {
      n: 5,
      title: "http שולח את ההודעה — send()",
      eng: "send() over the TCP connection",
      body: 'ה-<span dir="ltr">http</span> קורא ל-<span dir="ltr">send()</span> ושולח את ההודעה ' +
            'דרך קישור ה-TCP שיצר. מכאן מתחילים אלפי צעדים עד לאות הפיזי.',
      focus: "tcp",
      accent: C.clay
    },
    {
      n: 6,
      title: "פירוק ל-packets",
      eng: "packet switching — each packet < 2000 bytes",
      body: 'ה-1300 בתים של ההודעה <b>אינם נשלחים במכה אחת</b> — הם מפוצלים ונארזים ' +
            'ליחידות מידע קטנות הנקראות <b>packets</b> (כל packet קטן מ-2000 בתים). ' +
            'זוהי שיטת ההעברה של רשתות מחשבים: <b>packet switching</b>.',
      focus: "packets",
      accent: C.sage
    },
    {
      n: 7,
      title: "DTA + אות פיזי אל ה-switch",
      eng: "DTA = Digital To Analog · carrier signal",
      body: 'ה-<b>NIC</b> ממיר את בתי ה-packet לאות אנלוגי — <b>DTA</b> ' +
            '(Digital&nbsp;To&nbsp;Analog) — ויוצר <b>carrier signal</b>: גל אלקטרומגנטי ' +
            'שנושא את הבתים <b>פיזית</b> דרך הערוץ אל ה-switch / הראוטר.',
      focus: "wire",
      accent: C.mustard
    }
  ];

  // ------------------------------------------------------------------------
  function render(mount) {
    if (!mount || mount.getAttribute("data-viz-ready") === "1") return;
    mount.setAttribute("data-viz-ready", "1");

    // scoped state ---------------------------------------------------------
    var state = { idx: 0, playing: false, timer: null };

    // ---- local stylesheet (scoped by prefix) ----------------------------
    injectStyle();

    // ---- DOM scaffold ---------------------------------------------------
    var root = el("div", "hp-root");
    root.dir = "rtl";

    var stageWrap = el("div", "hp-stagewrap");
    stageWrap.innerHTML = buildSVG();
    root.appendChild(stageWrap);

    // detail card
    var card = el("div", "hp-card");
    card.setAttribute("role", "status");
    card.setAttribute("aria-live", "polite");
    root.appendChild(card);

    // progress dots
    var dots = el("div", "hp-dots");
    dots.setAttribute("aria-hidden", "true");
    STEPS.forEach(function (s, i) {
      var d = el("button", "hp-dot");
      d.type = "button";
      d.setAttribute("aria-label", "שלב " + s.n);
      d.setAttribute("tabindex", "-1");
      d.addEventListener("click", function () { pause(); goTo(i); });
      dots.appendChild(d);
    });
    root.appendChild(dots);

    // controls -------------------------------------------------------------
    var controls = el("div", "viz-controls");
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "בקרת אנימציית מסע בקשת HTTP");

    var btnPrev = mkBtn("→ הקודם", "hp-prev");
    var btnPlay = mkBtn("▶ הפעל", "hp-play primary");
    var btnNext = mkBtn("הבא ←", "hp-next");
    var btnReset = mkBtn("↺ איפוס", "hp-reset");

    btnPrev.addEventListener("click", function () { pause(); goTo(state.idx - 1); });
    btnNext.addEventListener("click", function () { pause(); goTo(state.idx + 1); });
    btnReset.addEventListener("click", function () { pause(); goTo(0); });
    btnPlay.addEventListener("click", function () { togglePlay(); });

    controls.appendChild(btnPrev);
    controls.appendChild(btnPlay);
    controls.appendChild(btnNext);
    controls.appendChild(btnReset);
    root.appendChild(controls);

    // keyboard support on the root -----------------------------------------
    root.tabIndex = 0;
    root.setAttribute("role", "application");
    root.setAttribute("aria-label",
      "מסע בקשת HTTP: 7 שלבים מ-URL ועד לאות פיזי. חצים להחלפת שלב, רווח להפעלה.");
    root.addEventListener("keydown", function (ev) {
      // RTL: ArrowLeft = forward ("הבא ←"), ArrowRight = back.
      if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") {
        pause(); goTo(state.idx + 1); ev.preventDefault();
      } else if (ev.key === "ArrowRight" || ev.key === "ArrowUp") {
        pause(); goTo(state.idx - 1); ev.preventDefault();
      } else if (ev.key === " " || ev.key === "Enter") {
        togglePlay(); ev.preventDefault();
      } else if (ev.key === "Home") {
        pause(); goTo(0); ev.preventDefault();
      } else if (ev.key === "End") {
        pause(); goTo(STEPS.length - 1); ev.preventDefault();
      }
    });

    mount.appendChild(root);

    // cache SVG nodes ------------------------------------------------------
    var svg = stageWrap.querySelector("svg");
    var nodes = {
      browser: svg.querySelector("#hp-browser"),
      http: svg.querySelector("#hp-http"),
      tcp: svg.querySelector("#hp-tcp"),
      nic: svg.querySelector("#hp-nic"),
      packets: svg.querySelector("#hp-packets"),
      wire: svg.querySelector("#hp-wire"),
      tcpLink: svg.querySelector("#hp-tcplink"),
      msg: svg.querySelector("#hp-msg"),
      signal: svg.querySelector("#hp-signal"),
      urlText: svg.querySelector("#hp-urltext")
    };

    // ---- behavior --------------------------------------------------------
    function goTo(i) {
      if (i < 0) i = 0;
      if (i > STEPS.length - 1) i = STEPS.length - 1;
      state.idx = i;
      var step = STEPS[i];

      // card
      card.style.setProperty("--hp-accent", step.accent);
      card.innerHTML =
        '<div class="hp-card-head">' +
          '<span class="hp-badge">שלב ' + step.n + ' / ' + STEPS.length + '</span>' +
          '<span class="hp-eng" dir="ltr">' + step.eng + '</span>' +
        '</div>' +
        '<h4 class="hp-card-title">' + step.title + '</h4>' +
        '<p class="hp-card-body">' + step.body + '</p>';

      // dots
      Array.prototype.forEach.call(dots.children, function (d, di) {
        d.classList.toggle("on", di <= i);
        d.classList.toggle("cur", di === i);
      });

      // buttons enabled state
      btnPrev.disabled = (i === 0);
      btnNext.disabled = (i === STEPS.length - 1);

      updateStage(step);
    }

    function updateStage(step) {
      // reset highlight classes
      ["browser", "http", "tcp", "nic"].forEach(function (k) {
        setClass(nodes[k], "hp-focus", false);
      });
      // visibility of dynamic elements is cumulative by step index
      var i = state.idx;

      // URL text appears at step 1
      show(nodes.urlText, i >= 0);

      // message glyph (leaves browser at step 3, rides down through http/tcp)
      show(nodes.msg, i >= 2 && i <= 4);
      positionMsg(i);

      // logical TCP link (dashed) appears at step 4
      show(nodes.tcpLink, i >= 3);
      setClass(nodes.tcpLink, "hp-pulse", i === 3 || i === 4);

      // packets appear at step 6 (index 5)
      show(nodes.packets, i >= 5);
      setClass(nodes.packets, "hp-run", i >= 5 && !reduceMotion);

      // signal/carrier appears at step 7 (index 6)
      show(nodes.signal, i >= 6);
      setClass(nodes.signal, "hp-run", i >= 6 && !reduceMotion);
      setClass(nodes.wire, "hp-live", i >= 6);
      setClass(nodes.nic, "hp-focus", step.focus === "wire" || step.focus === "packets");

      // primary focus highlight
      if (step.focus === "browser") setClass(nodes.browser, "hp-focus", true);
      if (step.focus === "http") setClass(nodes.http, "hp-focus", true);
      if (step.focus === "tcp") setClass(nodes.tcp, "hp-focus", true);
    }

    function positionMsg(i) {
      if (!nodes.msg) return;
      // move the magenta message rectangle down the stack as steps advance
      var y = 96;                 // inside browser
      if (i === 3) y = 150;       // at TCP
      if (i === 4) y = 150;
      nodes.msg.setAttribute("transform", "translate(0," + (y - 96) + ")");
    }

    function togglePlay() {
      if (state.playing) { pause(); return; }
      if (state.idx >= STEPS.length - 1) goTo(0);
      state.playing = true;
      btnPlay.innerHTML = "❚❚ השהה";
      btnPlay.classList.remove("primary");
      tick();
    }

    function tick() {
      if (!state.playing) return;
      state.timer = window.setTimeout(function () {
        if (state.idx >= STEPS.length - 1) { pause(); return; }
        goTo(state.idx + 1);
        tick();
      }, reduceMotion ? 1400 : 2100);
    }

    function pause() {
      state.playing = false;
      if (state.timer) { window.clearTimeout(state.timer); state.timer = null; }
      btnPlay.innerHTML = "▶ הפעל";
      btnPlay.classList.add("primary");
    }

    // init
    goTo(0);
  }

  // ---- SVG stage (hand-authored) -----------------------------------------
  function buildSVG() {
    // A client "host" box on the right (RTL feel), the physical channel and a
    // switch on the left. Layers stacked inside the host: browser → http →
    // TCP → NIC. Colors follow the lecturer's stack colours.
    var W = 640, H = 300;
    return '' +
      '<svg class="hp-svg" viewBox="0 0 ' + W + ' ' + H + '" ' +
        'width="100%" preserveAspectRatio="xMidYMid meet" ' +
        'role="img" aria-label="דיאגרמת מארח לקוח עם שכבות הדפדפן, http, TCP ו-NIC, וערוץ פיזי אל switch">' +

      '<defs>' +
        // soft drop shadow
        '<filter id="hp-soft" x="-20%" y="-20%" width="140%" height="140%">' +
          '<feDropShadow dx="0" dy="1.5" stdDeviation="2.2" flood-color="#7a6446" flood-opacity="0.18"/>' +
        '</filter>' +
        // arrowhead
        '<marker id="hp-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">' +
          '<path d="M0,0 L6,3 L0,6 Z" fill="' + C.inkSoft + '"/>' +
        '</marker>' +
      '</defs>' +

      // ---- host box (client C) : right side ----
      '<g class="hp-host">' +
        '<rect x="330" y="24" width="286" height="252" rx="16" ' +
          'fill="' + C.surface2 + '" stroke="' + C.line + '" stroke-width="2" filter="url(#hp-soft)"/>' +
        '<text x="600" y="46" text-anchor="end" class="hp-hostlbl">מארח לקוח C</text>' +

        // browser layer (app)
        layerBox("hp-browser", 350, 62, 250, 56, C.surface, C.blue,
          'דפדפן', 'http client', C.blue) +
        // URL text (appears step 1)
        '<text id="hp-urltext" x="475" y="132" text-anchor="middle" ' +
          'class="hp-url" dir="ltr" opacity="0">online.shenkar.ac.il</text>' +

        // http / TCP (transport) layer
        layerBox("hp-http", 350, 122, 250, 34, C.surface, C.clay,
          'http', 'HyperText Transfer Protocol', C.clay) +
        layerBox("hp-tcp", 350, 162, 250, 34, C.surface, C.clay,
          'TCP', 'segment', C.clay) +

        // NIC layer
        layerBox("hp-nic", 350, 210, 250, 44, C.surface, C.mustard,
          'NIC', 'DTA · Digital→Analog', C.mustard) +

        // the message glyph (magenta) that travels down the stack
        '<g id="hp-msg" opacity="0">' +
          '<rect x="440" y="84" width="70" height="22" rx="5" ' +
            'fill="#C56B8E" stroke="#a8567a" stroke-width="1.5"/>' +
          '<text x="475" y="99" text-anchor="middle" class="hp-msglbl" dir="ltr">GET…</text>' +
        '</g>' +
      '</g>' +

      // ---- logical TCP connection (dashed, floats above) ----
      '<path id="hp-tcplink" d="M330,179 C220,179 200,120 96,120" fill="none" ' +
        'stroke="' + C.clay + '" stroke-width="2.5" stroke-dasharray="7 6" ' +
        'stroke-linecap="round" opacity="0"/>' +
      '<text x="200" y="104" text-anchor="middle" class="hp-linklbl" dir="ltr" ' +
        'fill="' + C.clay + '" opacity="0" id="hp-tcplinklbl">logical TCP connection</text>' +

      // ---- physical channel + packets + carrier signal ----
      // wire
      '<line id="hp-wire" x1="330" y1="232" x2="150" y2="232" ' +
        'stroke="' + C.line + '" stroke-width="6" stroke-linecap="round"/>' +

      // packets riding the wire (step 6)
      '<g id="hp-packets" opacity="0">' +
        packet(300, 232) + packet(258, 232) + packet(216, 232) + packet(174, 232) +
      '</g>' +

      // carrier signal (sine) over the wire (step 7)
      '<path id="hp-signal" opacity="0" fill="none" stroke="' + C.mustard + '" stroke-width="2.5" ' +
        'stroke-linecap="round" d="' + sineWirePath(150, 330, 232, 9) + '"/>' +

      // ---- switch on the left ----
      '<g class="hp-switch">' +
        '<rect x="40" y="196" width="96" height="72" rx="12" ' +
          'fill="' + C.surface + '" stroke="' + C.line + '" stroke-width="2" filter="url(#hp-soft)"/>' +
        '<text x="88" y="228" text-anchor="middle" class="hp-swlbl">switch</text>' +
        '<text x="88" y="246" text-anchor="middle" class="hp-swsub" dir="ltr">access switch</text>' +
        // little ports
        '<g fill="' + C.sage + '">' +
          '<rect x="54" y="256" width="12" height="6" rx="1.5"/>' +
          '<rect x="72" y="256" width="12" height="6" rx="1.5"/>' +
          '<rect x="90" y="256" width="12" height="6" rx="1.5"/>' +
          '<rect x="108" y="256" width="12" height="6" rx="1.5"/>' +
        '</g>' +
      '</g>' +

      // caption strip
      '<text x="150" y="288" text-anchor="middle" class="hp-wirelbl">ערוץ תקשורת פיזי</text>' +
      '</svg>';
  }

  // one stacked layer box with a Hebrew/English label pair
  function layerBox(id, x, y, w, h, fill, accent, heLbl, engLbl, engColor) {
    var cx = x + w / 2;
    return '' +
      '<g id="' + id + '" class="hp-layer">' +
        '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="9" ' +
          'fill="' + fill + '" stroke="' + accent + '" stroke-width="1.5"/>' +
        '<rect class="hp-layer-tab" x="' + x + '" y="' + y + '" width="6" height="' + h + '" ' +
          'rx="3" fill="' + accent + '"/>' +
        '<text x="' + (x + 16) + '" y="' + (y + h / 2 + 1) + '" class="hp-lyr-he">' + heLbl + '</text>' +
        '<text x="' + (x + w - 12) + '" y="' + (y + h / 2 + 1) + '" text-anchor="end" ' +
          'class="hp-lyr-en" dir="ltr" fill="' + engColor + '">' + engLbl + '</text>' +
      '</g>';
  }

  function packet(x, y) {
    return '<g class="hp-pkt">' +
      '<rect x="' + (x - 14) + '" y="' + (y - 9) + '" width="28" height="18" rx="4" ' +
        'fill="' + C.sage + '" stroke="#5e7a68" stroke-width="1.2"/>' +
      '<line x1="' + (x - 6) + '" y1="' + y + '" x2="' + (x + 6) + '" y2="' + y + '" ' +
        'stroke="#fff" stroke-width="1.4" opacity="0.8"/>' +
      '</g>';
  }

  // build a sine wave path along a horizontal wire
  function sineWirePath(x0, x1, y, amp) {
    var pts = [];
    var n = 60;
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var x = x1 + (x0 - x1) * t;
      var yy = y - amp * Math.sin(t * Math.PI * 8);
      pts.push((i === 0 ? "M" : "L") + x.toFixed(1) + "," + yy.toFixed(1));
    }
    return pts.join(" ");
  }

  // ---- tiny DOM helpers ---------------------------------------------------
  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }
  function mkBtn(label, cls) {
    var b = el("button", "viz-btn " + cls);
    b.type = "button";
    b.innerHTML = label;
    return b;
  }
  function setClass(node, cls, on) {
    if (!node) return;
    if (on) node.classList.add(cls); else node.classList.remove(cls);
  }
  function show(node, on) {
    if (!node) return;
    node.style.opacity = on ? "1" : "0";
  }

  // ---- scoped stylesheet --------------------------------------------------
  function injectStyle() {
    if (document.getElementById("hp-style")) return;
    var css =
      '.hp-root{font-family:inherit;color:' + C.ink + ';outline:none}' +
      '.hp-root:focus-visible{box-shadow:0 0 0 3px rgba(110,140,160,.35);border-radius:12px}' +
      '.hp-stagewrap{width:100%}' +
      '.hp-svg{display:block;margin:0 auto;max-width:640px}' +

      // svg text styles
      '.hp-hostlbl{font-size:12px;font-weight:700;fill:' + C.inkSoft + '}' +
      '.hp-lyr-he{font-size:13px;font-weight:700;fill:' + C.ink + '}' +
      '.hp-lyr-en{font-size:10.5px;font-weight:600}' +
      '.hp-url{font-size:12px;font-weight:600;fill:' + C.blue + ';transition:opacity .35s ease}' +
      '.hp-msglbl{font-size:11px;font-weight:700;fill:#fff}' +
      '.hp-linklbl{font-size:11px;font-weight:700;transition:opacity .35s ease}' +
      '.hp-swlbl{font-size:13px;font-weight:700;fill:' + C.ink + '}' +
      '.hp-swsub{font-size:9.5px;font-weight:600;fill:' + C.inkSoft + '}' +
      '.hp-wirelbl{font-size:11px;font-weight:600;fill:' + C.inkSoft + '}' +
      '.hp-wlbl{font-size:11px;fill:' + C.inkSoft + '}' +

      // layer highlight
      '.hp-layer rect:first-of-type{transition:filter .25s ease,transform .25s ease}' +
      '.hp-layer.hp-focus rect:first-of-type{filter:drop-shadow(0 0 0.5px currentColor)}' +
      '.hp-layer.hp-focus{}' +
      '.hp-layer.hp-focus .hp-layer-tab{width:9px}' +

      // dynamic svg elements transitions
      '#hp-msg,#hp-packets,#hp-signal,#hp-urltext,#hp-tcplink{transition:opacity .4s ease}' +
      '#hp-msg{transition:opacity .4s ease,transform .5s ease}' +
      '#hp-wire.hp-live{stroke:' + C.mustard + ';opacity:.5}' +
      '#hp-nic.hp-focus rect:first-of-type{stroke-width:2.5}' +

      // focus ring emulation via outline glow on group
      '.hp-layer.hp-focus > rect{stroke-width:2.75}' +

      // packets moving
      '@keyframes hp-flow{from{transform:translateX(0)}to{transform:translateX(-176px)}}' +
      '#hp-packets.hp-run .hp-pkt{animation:hp-pktfade 1.6s linear infinite}' +
      '#hp-packets.hp-run{animation:hp-flow 1.6s linear infinite}' +
      '@keyframes hp-pktfade{0%,100%{opacity:.55}45%{opacity:1}}' +

      // signal pulse
      '@keyframes hp-dash{to{stroke-dashoffset:-40}}' +
      '#hp-signal.hp-run{stroke-dasharray:5 4;animation:hp-dash 1s linear infinite}' +

      // logical tcp link pulse
      '@keyframes hp-linkpulse{0%,100%{stroke-opacity:.55}50%{stroke-opacity:1}}' +
      '#hp-tcplink.hp-pulse{animation:hp-linkpulse 1.4s ease-in-out infinite}' +

      // progress dots
      '.hp-dots{display:flex;justify-content:center;gap:8px;margin:.6rem 0 .2rem}' +
      '.hp-dot{width:11px;height:11px;padding:0;border-radius:50%;border:1.5px solid ' + C.line + ';' +
        'background:' + C.surface2 + ';cursor:pointer;transition:background .2s,transform .2s,border-color .2s}' +
      '.hp-dot.on{background:' + C.blue + ';border-color:' + C.blue + '}' +
      '.hp-dot.cur{transform:scale(1.35);box-shadow:0 0 0 3px rgba(110,140,160,.2)}' +

      // detail card
      '.hp-card{--hp-accent:' + C.blue + ';margin-top:.9rem;background:' + C.surface + ';' +
        'border:1px solid ' + C.line + ';border-inline-start:4px solid var(--hp-accent);' +
        'border-radius:12px;padding:.85rem 1rem;min-height:118px;' +
        'box-shadow:0 2px 10px rgba(120,100,70,.06)}' +
      '.hp-card-head{display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap}' +
      '.hp-badge{font-size:.72rem;font-weight:700;color:#fff;background:var(--hp-accent);' +
        'padding:.15rem .55rem;border-radius:99px}' +
      '.hp-eng{font-size:.74rem;font-weight:600;color:' + C.inkSoft + ';font-family:ui-monospace,"JetBrains Mono",monospace}' +
      '.hp-card-title{margin:.5rem 0 .3rem;font-size:1rem;font-weight:700;color:' + C.ink + '}' +
      '.hp-card-body{margin:0;font-size:.9rem;line-height:1.6;color:' + C.ink + '}' +
      '.hp-card-body b{color:var(--hp-accent)}' +
      '.hp-card-body span[dir="ltr"]{font-family:ui-monospace,"JetBrains Mono",monospace;font-size:.85em}' +

      // reduced motion
      '@media (prefers-reduced-motion: reduce){' +
        '#hp-packets.hp-run,#hp-packets.hp-run .hp-pkt,#hp-signal.hp-run,#hp-tcplink.hp-pulse{animation:none}' +
        '.hp-dot,.hp-card,#hp-msg,#hp-packets,#hp-signal,#hp-urltext,#hp-tcplink{transition:none}' +
      '}';

    var st = document.createElement("style");
    st.id = "hp-style";
    st.appendChild(document.createTextNode(css));
    (document.head || document.documentElement).appendChild(st);
  }

  // ---- mount --------------------------------------------------------------
  function mountAll() {
    var mounts = document.querySelectorAll('[data-viz="' + VIZ_ID + '"]');
    if (!mounts || !mounts.length) return; // degrade gracefully
    Array.prototype.forEach.call(mounts, function (m) {
      try { render(m); } catch (e) { /* never throw into the page */ }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAll);
  } else {
    mountAll();
  }
})();
