/* ============================================================================
 * handshake-anim.js  —  Hero viz for Module 6 (06-tcp-core)
 * Follows the model in _notes/tcp.md §10 ("Three-Way Handshake — why 3 steps?"),
 * §14, and Worked Examples B + C.
 *
 * Two side-by-side, step-through modes over one client/server timeline:
 *   MODE "three"  — the correct 3-way handshake, lecturer numbers:
 *       1) client  SYN(Seq=100)             SYN_SENT
 *       2) server  SYN-ACK(Seq=500,Ack=101) LISTEN → SYN_RCVD  (piggyback:
 *                  the ACK of direction-1 + the SYN of direction-2 = one packet)
 *       3) client  ACK(Ack=501)             → ESTABLISHED (both sides)
 *     Shows the two-direction full-duplex ISN sync collapsed 4→3 by piggybacking.
 *   MODE "two"    — the FAILING two-way handshake with the delayed "ghost" SYN
 *       (§10.1 / Example C): SYN_1 stalls in a router → client times out →
 *       SYN_2 sets up + tears down a clean connection → hours later the old
 *       SYN_1 is released and reaches the server. In 2-way the server jumps
 *       straight to ESTABLISHED → permanent Half-Open Connection → Resource
 *       Exhaustion.  The overlaid "3-way rescue" shows the server going to
 *       SYN_RCVD instead, the client replying RST, and the server dropping the
 *       half TCB back to LISTEN — no harm done.
 *
 * Self-contained IIFE. Hand-authored SVG/DOM. No external deps.
 * Palette hard-coded from the cream design system (contract §2). RTL-aware;
 * English technical labels (SYN/ACK/Seq/state names) kept LTR.
 * ==========================================================================*/
(function () {
  "use strict";

  var VIZ_ID = "handshake-anim";

  // ---- design palette (hard-coded per contract §2) ------------------------
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",   // dusty-blue  — client
    clay: "#BE7C5E",   // clay        — server / Day-2 accent
    sage: "#7C9885",   // sage        — success / ESTABLISHED
    mustard: "#C9A24B" // mustard     — warnings / ghost packet
  };

  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) { reduceMotion = false; }

  // ---- geometry -----------------------------------------------------------
  // SVG canvas coordinates. Client lifeline on the LEFT, server on the RIGHT.
  var W = 640, H = 430;
  var CX = 130, SX = 510;      // client / server lifeline x
  var TOP = 96, BOT = 400;     // lifeline top / bottom

  // ---- THREE-WAY model: ordered messages ----------------------------------
  // Each message: from/to lifelines, y1 (leave) / y2 (arrive) times,
  // label, sequence detail, and the state each endpoint holds AFTER it lands.
  var THREE = [
    {
      key: "syn",
      dir: "cs",              // client → server
      y1: 128, y2: 176,
      label: "SYN",
      seq: "Seq=100",
      color: C.blue,
      title: "1 · SYN — הלקוח יוזם",
      eng: "client → server · SYN(Seq=100)",
      body: 'הלקוח קורא ל-<span dir="ltr">connect()</span>, בוחר ISN אקראי ' +
            '(<span dir="ltr">Seq=100</span>), שולח <b>SYN</b>, מפעיל טיימר ועובר ל-' +
            '<span dir="ltr">SYN_SENT</span>. זהו <b>סנכרון כיוון 1</b>: הלקוח מכריז על ה-ISN שלו.',
      clientState: "SYN_SENT",
      serverState: "LISTEN"
    },
    {
      key: "synack",
      dir: "sc",              // server → client
      y1: 200, y2: 248,
      label: "SYN-ACK",
      seq: "Seq=500, Ack=101",
      color: C.clay,
      title: "2 · SYN-ACK — השרת מאשר ומכריז",
      eng: "server → client · SYN(Seq=500) + ACK(Ack=101)",
      body: 'השרת מקצה TCB ועובר ל-<span dir="ltr">SYN_RCVD</span>. הוא ' +
            '<b>מאשר</b> את כיוון 1 (<span dir="ltr">Ack=101</span> = "קיבלתי עד בית 100") ' +
            'ו<b>מכריז</b> על ה-ISN שלו (<span dir="ltr">Seq=500</span>) — <b>סנכרון כיוון 2</b>. ' +
            'שני אלה נדחסים לחבילה אחת ע"י <b>piggybacking</b>.',
      clientState: "SYN_SENT",
      serverState: "SYN_RCVD"
    },
    {
      key: "ack",
      dir: "cs",              // client → server
      y1: 272, y2: 320,
      label: "ACK",
      seq: "Ack=501",
      color: C.sage,
      title: "3 · ACK — החותמת הסופית",
      eng: "client → server · ACK(Ack=501)",
      body: 'הלקוח מאשר את ה-ISN של השרת (<span dir="ltr">Ack=501</span>) ועובר ל-' +
            '<span dir="ltr">ESTABLISHED</span>. חבילה זו היא ה<b>הוכחה</b> שהלקוח חי ומסונכרן ' +
            '(<span dir="ltr">Positive Acknowledgment</span>) — בלעדיה השרת "לא יודע" שה-ISN שלו נקלט. ' +
            'עם קבלתה השרת עובר גם הוא ל-<span dir="ltr">ESTABLISHED</span>.',
      clientState: "ESTABLISHED",
      serverState: "ESTABLISHED"
    }
  ];

  // ---- TWO-WAY (failing) model: the delayed "ghost" SYN scenario ----------
  // Numbered per Example C. Message objects mirror THREE; some are "ghost".
  var TWO = [
    {
      key: "syn1",
      dir: "cs", ghost: true, stalled: true,
      y1: 120, y2: 288,       // long, slow: gets stuck in a router
      label: "SYN_1",
      seq: "Seq=100",
      color: C.mustard,
      title: "1 · SYN_1 נשלח ו…נתקע",
      eng: "client → server · SYN_1 (delayed in a router)",
      body: 'הלקוח שולח <b>SYN_1</b>, אבל החבילה <b>נתקעת בנתב עמוס</b> ומושהית ' +
            '(רשת IP אסינכרונית ובלתי אמינה). היא "תרחף" ברשת דקות/שעות.',
      clientState: "SYN_SENT",
      serverState: "LISTEN"
    },
    {
      key: "timeout",
      dir: "self",
      y1: 176, y2: 176,
      label: "Timeout",
      seq: "",
      color: C.clay,
      title: "2 · Timeout אצל הלקוח",
      eng: "client timer expires",
      body: 'הטיימר של הלקוח <b>פוקע</b> — אין תשובה. הלקוח מניח ש-SYN_1 אבד ' +
            'ומייצר <b>SYN_2</b> חדש.',
      clientState: "SYN_SENT",
      serverState: "LISTEN"
    },
    {
      key: "clean",
      dir: "clean",
      y1: 196, y2: 236,
      label: "SYN_2 ⇄ … ⇄ FIN",
      seq: "",
      color: C.sage,
      title: "3 · חיבור תקין קם ונסגר",
      eng: "SYN_2 → connection established → data → closed",
      body: 'הפעם התקשורת חלקה: <b>SYN_2</b> מקים חיבור תקין, הנתונים עוברים, ' +
            'ושני הצדדים סוגרים <b>תקין</b>. הכל טוב — לכאורה סיימנו.',
      clientState: "CLOSED",
      serverState: "LISTEN"
    },
    {
      key: "ghost",
      dir: "cs", ghost: true,
      y1: 288, y2: 336,
      label: "SYN_1 (רפאים)",
      seq: "Seq=100",
      color: C.mustard,
      title: "4 · SYN_1 הרפאים משתחרר",
      eng: "old SYN_1 finally released → arrives at server",
      body: 'שעות מאוחר יותר הנתב <b>משחרר</b> את SYN_1 הישן, והוא מגיע לשרת ' +
            'כ<b>"בקשת רפאים"</b> (Delayed Duplicate SYN). מה יעשה השרת?',
      clientState: "CLOSED",
      serverState: "LISTEN"
    }
  ];

  // Two divergent endings for the ghost SYN (step 5), toggled by the user.
  var ENDINGS = {
    two: {
      key: "half",
      label: "ESTABLISHED?!",
      color: C.clay,
      badge: "כישלון",
      title: "5 · דו-שלבי → Half-Open קבוע",
      eng: "2-way: server → ESTABLISHED, waits forever",
      body: 'ב<b>דו-שלבי</b> השרת קופץ ישר ל-<span dir="ltr">ESTABLISHED</span>, מקצה TCB, ' +
            'שולח SYN-ACK — וממתין <b>חסום</b>. אין לקוח שממתין לחיבור הזה → ' +
            'השרת נותר ב<b>חיבור חצי-פתוח (Half-Open) קבוע</b> → ' +
            'חזרה על התרחיש = <b>דליפת משאבים (Resource Exhaustion)</b> וקריסה.',
      serverState: "ESTABLISHED",
      verdict: "warn"
    },
    three: {
      key: "rst",
      label: "RST → LISTEN",
      color: C.sage,
      badge: "פתרון",
      title: "5 · תלת-שלבי → RST מנקה הכל",
      eng: "3-way: server → SYN_RCVD, client sends RST → LISTEN",
      body: 'ב<b>תלת-שלבי</b> השרת <b>לא</b> קופץ ל-ESTABLISHED אלא ל-' +
            '<span dir="ltr">SYN_RCVD</span> ("חצי-פתוח מאובטח"), ושולח SYN-ACK. ' +
            'ללקוח אין בקשה פעילה עם המספר הזה → הוא משיב <b>RST</b>. השרת מקבל RST → ' +
            '<b>משמיד את ה-TCB</b> ומפנה זיכרון, חוזר ל-<span dir="ltr">LISTEN</span> ' +
            'ללא כל פגיעה. השלב השלישי הוא האימות הקריטי.',
      serverState: "LISTEN",
      verdict: "ok"
    }
  };

  // ------------------------------------------------------------------------
  function render(mount) {
    if (!mount || mount.getAttribute("data-viz-ready") === "1") return;
    mount.setAttribute("data-viz-ready", "1");

    injectStyle();

    var state = {
      mode: "three",      // "three" | "two"
      idx: -1,            // step pointer; -1 = nothing revealed yet
      ending: "three",    // which rescue for the two-way scene
      playing: false,
      timer: null
    };

    // ---- DOM scaffold ----------------------------------------------------
    var root = el("div", "hs-root");
    root.dir = "rtl";

    // mode tabs
    var tabs = el("div", "hs-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "בחירת תרחיש");
    var tabThree = mkTab("לחיצת יד תלת-שלבית", "three");
    var tabTwo = mkTab("למה לא דו-שלבית? (רפאים)", "two");
    tabs.appendChild(tabThree);
    tabs.appendChild(tabTwo);
    root.appendChild(tabs);

    // stage
    var stageWrap = el("div", "hs-stagewrap");
    stageWrap.innerHTML = buildSVG();
    root.appendChild(stageWrap);

    // detail card
    var card = el("div", "hs-card");
    card.setAttribute("role", "status");
    card.setAttribute("aria-live", "polite");
    root.appendChild(card);

    // ending toggle (only meaningful in two-way mode)
    var endWrap = el("div", "hs-endwrap");
    endWrap.setAttribute("aria-label", "בחירת סיום לתרחיש הרפאים");
    var endThree = mkPill("3-way: SYN_RCVD → RST", "three");
    var endTwo = mkPill("2-way: Half-Open", "two");
    endWrap.appendChild(document.createTextNode(""));
    var endLbl = el("span", "hs-endlbl");
    endLbl.textContent = "כשה-SYN הרפאים מגיע, נהג כ:";
    endWrap.appendChild(endLbl);
    endWrap.appendChild(endTwo);
    endWrap.appendChild(endThree);
    root.appendChild(endWrap);

    // controls
    var controls = el("div", "viz-controls");
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "בקרת אנימציית לחיצת היד");
    var btnPrev = mkBtn("→ הקודם", "hs-prev");
    var btnPlay = mkBtn("▶ הפעל", "hs-play primary");
    var btnNext = mkBtn("הבא ←", "hs-next");
    var btnReset = mkBtn("↺ איפוס", "hs-reset");
    btnPrev.addEventListener("click", function () { pause(); step(-1); });
    btnNext.addEventListener("click", function () { pause(); step(1); });
    btnReset.addEventListener("click", function () { pause(); goTo(-1); });
    btnPlay.addEventListener("click", togglePlay);
    controls.appendChild(btnPrev);
    controls.appendChild(btnPlay);
    controls.appendChild(btnNext);
    controls.appendChild(btnReset);
    root.appendChild(controls);

    // keyboard
    root.tabIndex = 0;
    root.setAttribute("role", "application");
    root.setAttribute("aria-label",
      "אנימציית לחיצת יד TCP. חצים להחלפת שלב, רווח להפעלה, ט לתרחיש דו/תלת-שלבי.");
    root.addEventListener("keydown", function (ev) {
      // RTL: ArrowLeft = forward ("הבא ←"), ArrowRight = back.
      if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") { pause(); step(1); ev.preventDefault(); }
      else if (ev.key === "ArrowRight" || ev.key === "ArrowUp") { pause(); step(-1); ev.preventDefault(); }
      else if (ev.key === " " || ev.key === "Enter") { togglePlay(); ev.preventDefault(); }
      else if (ev.key === "Home") { pause(); goTo(-1); ev.preventDefault(); }
      else if (ev.key === "End") { pause(); goTo(steps().length - 1); ev.preventDefault(); }
    });

    mount.appendChild(root);

    // cache SVG nodes ------------------------------------------------------
    var svg = stageWrap.querySelector("svg");
    var N = {
      msgLayer: svg.querySelector("#hs-msglayer"),
      clientState: svg.querySelector("#hs-cstate"),
      serverState: svg.querySelector("#hs-sstate"),
      clientLabel: svg.querySelector("#hs-clabel"),
      serverLabel: svg.querySelector("#hs-slabel"),
      established: svg.querySelector("#hs-estab")
    };

    // ---- helpers to build one message on the stage -----------------------
    function steps() { return state.mode === "three" ? THREE : TWO; }

    // total step count includes the ending step for two-way mode
    function total() { return state.mode === "three" ? THREE.length : TWO.length + 1; }

    function currentMsg(i) {
      // returns a message-like object for step i in the active mode
      var arr = steps();
      if (i < arr.length) return arr[i];
      // two-way ending step
      return ENDINGS[state.ending];
    }

    // ---- render the stage for the current pointer ------------------------
    function draw() {
      // clear dynamic message layer & rebuild up to state.idx
      while (N.msgLayer.firstChild) N.msgLayer.removeChild(N.msgLayer.firstChild);
      N.established.style.opacity = "0";

      var arr = steps();
      var cState = "CLOSED", sState = "LISTEN";
      if (state.mode === "three") { cState = "CLOSED"; sState = "LISTEN"; }

      for (var i = 0; i <= state.idx; i++) {
        var last = (i === state.idx);
        if (i < arr.length) {
          drawMsg(arr[i], last);
          if (arr[i].clientState) cState = arr[i].clientState;
          if (arr[i].serverState) sState = arr[i].serverState;
        } else {
          // ending step (two-way only)
          var e = ENDINGS[state.ending];
          drawEnding(e, last);
          sState = e.serverState;
          cState = (state.ending === "three") ? "CLOSED" : "CLOSED";
        }
      }

      // ESTABLISHED tunnel appears when both sides reached it (three-way end)
      var bothEstab = (state.mode === "three" && cState === "ESTABLISHED" && sState === "ESTABLISHED");
      N.established.style.opacity = bothEstab ? "1" : "0";

      setState(N.clientState, cState);
      setState(N.serverState, sState);

      updateCard();
      syncControls();
    }

    function drawMsg(m, animate) {
      if (m.dir === "self") { drawTimeout(m, animate); return; }
      if (m.dir === "clean") { drawClean(m, animate); return; }
      var fromX = (m.dir === "cs") ? CX : SX;
      var toX = (m.dir === "cs") ? SX : CX;
      var g = svgEl("g", { "class": "hs-msg" });

      var line = svgEl("line", {
        x1: fromX, y1: m.y1, x2: toX, y2: m.y2,
        stroke: m.color, "stroke-width": 2.5,
        "marker-end": "url(#hs-arrow-" + m.color.replace("#", "") + ")",
        "stroke-dasharray": m.ghost ? "6 5" : "0"
      });
      if (m.stalled) line.setAttribute("stroke-dasharray", "2 6");
      g.appendChild(line);

      // label chip riding the arrow midpoint
      var mx = (fromX + toX) / 2, my = (m.y1 + m.y2) / 2;
      var chip = svgEl("g", { "class": "hs-chip" });
      var w = Math.max(46, m.label.length * 8.4 + 14);
      chip.appendChild(svgEl("rect", {
        x: mx - w / 2, y: my - 24, width: w, height: 19, rx: 9,
        fill: C.surface, stroke: m.color, "stroke-width": 1.4
      }));
      var t = svgEl("text", {
        x: mx, y: my - 10.5, "text-anchor": "middle",
        "class": "hs-chiptxt", fill: m.color, direction: "ltr"
      });
      t.textContent = m.label;
      chip.appendChild(t);
      if (m.seq) {
        var st2 = svgEl("text", {
          x: mx, y: my + 14, "text-anchor": "middle",
          "class": "hs-seqtxt", fill: C.inkSoft, direction: "ltr"
        });
        st2.textContent = m.seq;
        chip.appendChild(st2);
      }
      g.appendChild(chip);

      if (animate && !reduceMotion) {
        var len = Math.hypot(toX - fromX, m.y2 - m.y1);
        line.style.strokeDasharray = m.ghost ? "6 5" : (len + " " + len);
        if (!m.ghost) line.style.strokeDashoffset = len;
        line.classList.add(m.ghost ? "hs-fly-ghost" : "hs-fly");
        chip.classList.add("hs-chipin");
      }
      N.msgLayer.appendChild(g);
    }

    function drawTimeout(m, animate) {
      // small self-loop clock on the client lifeline
      var g = svgEl("g", { "class": "hs-msg" });
      var y = m.y1;
      g.appendChild(svgEl("path", {
        d: "M" + (CX - 4) + "," + (y - 12) +
           " a 16 16 0 1 0 16 4",
        fill: "none", stroke: m.color, "stroke-width": 2.2,
        "marker-end": "url(#hs-arrow-" + m.color.replace("#", "") + ")"
      }));
      var badge = svgEl("g", { "class": "hs-chip" });
      badge.appendChild(svgEl("rect", {
        x: CX - 78, y: y - 10, width: 62, height: 20, rx: 10,
        fill: C.surface, stroke: m.color, "stroke-width": 1.4
      }));
      var t = svgEl("text", {
        x: CX - 47, y: y + 4, "text-anchor": "middle",
        "class": "hs-chiptxt", fill: m.color, direction: "ltr"
      });
      t.textContent = "Timeout";
      badge.appendChild(t);
      g.appendChild(badge);
      if (animate && !reduceMotion) badge.classList.add("hs-chipin");
      N.msgLayer.appendChild(g);
    }

    function drawClean(m, animate) {
      // a compact "clean session" band between the lifelines
      var g = svgEl("g", { "class": "hs-msg" });
      var yA = m.y1, yB = m.y2;
      g.appendChild(svgEl("rect", {
        x: CX, y: yA - 6, width: SX - CX, height: yB - yA + 12, rx: 10,
        fill: "rgba(124,152,133,.10)", stroke: m.color,
        "stroke-width": 1.4, "stroke-dasharray": "5 4"
      }));
      var t = svgEl("text", {
        x: (CX + SX) / 2, y: (yA + yB) / 2 + 4, "text-anchor": "middle",
        "class": "hs-cleantxt", fill: C.sage, direction: "ltr"
      });
      t.textContent = "SYN_2 → connect → data → close  ✓";
      g.appendChild(t);
      if (animate && !reduceMotion) g.classList.add("hs-chipin");
      N.msgLayer.appendChild(g);
    }

    function drawEnding(e, animate) {
      // server-side reaction to the ghost SYN: SYN-ACK back, then RST or a
      // "waits forever" marker.
      var g = svgEl("g", { "class": "hs-msg" });
      var col = e.color;
      // server → client SYN-ACK
      g.appendChild(svgEl("line", {
        x1: SX, y1: 344, x2: CX, y2: 380,
        stroke: col, "stroke-width": 2.4,
        "marker-end": "url(#hs-arrow-" + col.replace("#", "") + ")",
        "stroke-dasharray": "6 5"
      }));
      var chip = svgEl("g", { "class": "hs-chip" });
      var lbl = (state.ending === "three") ? "SYN-ACK" : "SYN-ACK …";
      var w = Math.max(60, lbl.length * 8.4 + 14);
      var mx = (CX + SX) / 2, my = 362;
      chip.appendChild(svgEl("rect", {
        x: mx - w / 2, y: my - 10, width: w, height: 19, rx: 9,
        fill: C.surface, stroke: col, "stroke-width": 1.4
      }));
      var t = svgEl("text", {
        x: mx, y: my + 3.5, "text-anchor": "middle",
        "class": "hs-chiptxt", fill: col, direction: "ltr"
      });
      t.textContent = lbl;
      chip.appendChild(t);
      g.appendChild(chip);

      if (state.ending === "three") {
        // client fires RST back
        g.appendChild(svgEl("line", {
          x1: CX, y1: 384, x2: SX, y2: 392,
          stroke: C.sage, "stroke-width": 2.6,
          "marker-end": "url(#hs-arrow-" + C.sage.replace("#", "") + ")"
        }));
        var rt = svgEl("text", {
          x: mx, y: 405, "text-anchor": "middle",
          "class": "hs-chiptxt", fill: C.sage, direction: "ltr"
        });
        rt.textContent = "RST → server drops TCB → LISTEN";
        g.appendChild(rt);
      } else {
        var wt = svgEl("text", {
          x: SX - 6, y: 400, "text-anchor": "end",
          "class": "hs-warntxt", fill: C.clay, direction: "ltr"
        });
        wt.textContent = "⚠ Half-Open — waits forever";
        g.appendChild(wt);
      }
      if (animate && !reduceMotion) g.classList.add("hs-chipin");
      N.msgLayer.appendChild(g);
    }

    // ---- state pills on the lifelines ------------------------------------
    function setState(node, name) {
      var txt = node.querySelector("text");
      var rect = node.querySelector("rect");
      txt.textContent = name;
      var w = Math.max(78, name.length * 8.2 + 20);
      rect.setAttribute("width", w);
      rect.setAttribute("x", (+node.getAttribute("data-cx")) - w / 2);
      txt.setAttribute("x", node.getAttribute("data-cx"));
      var fill = C.inkSoft;
      if (name === "ESTABLISHED") fill = C.sage;
      else if (name === "SYN_RCVD" || name === "SYN_SENT") fill = C.mustard;
      else if (name === "LISTEN") fill = C.clay;
      rect.setAttribute("stroke", fill);
      txt.setAttribute("fill", fill);
    }

    // ---- detail card -----------------------------------------------------
    function updateCard() {
      if (state.idx < 0) {
        card.className = "hs-card";
        card.style.setProperty("--hs-accent", C.blue);
        card.innerHTML =
          '<div class="hs-card-head"><span class="hs-eng">' +
          (state.mode === "three"
            ? "TCP three-way handshake · SYN → SYN-ACK → ACK"
            : "why not two-way? · delayed duplicate SYN") +
          '</span></div>' +
          '<p class="hs-card-body">' +
          (state.mode === "three"
            ? 'שלושה שלבים מקימים חיבור TCP אמין. כל צד <b>מכריז</b> על ה-ISN שלו ' +
              'והשני <b>מאשר</b> — סנכרון דו-כיווני מלא (full-duplex). לוגית נדרשים 4 שלבים, ' +
              'אך <b>piggybacking</b> דוחס אותם ל-3. לחצו "הבא ←" כדי לצעוד.'
            : 'למה 3 ולא 2 שלבים? נראה תרחיש כישלון: <b>SYN רפאים מושהה</b> שמגיע ' +
              'אחרי שהחיבור כבר נסגר. השוו את הסיום הדו-שלבי (Half-Open) לתלת-שלבי ' +
              '(SYN_RCVD → RST). לחצו "הבא ←" כדי לצעוד.') +
          '</p>';
        return;
      }
      var m = currentMsg(state.idx);
      var accent = m.color || C.blue;
      card.className = "hs-card";
      if (m.verdict === "warn") card.className += " hs-warn";
      if (m.verdict === "ok") card.className += " hs-ok";
      card.style.setProperty("--hs-accent", accent);
      var badge = m.badge
        ? '<span class="hs-badge" style="background:' + accent + '">' + m.badge + '</span>'
        : '<span class="hs-badge" style="background:' + accent + '">' +
          (state.mode === "three" ? "שלב " + (state.idx + 1) : "צעד " + (state.idx + 1)) +
          '</span>';
      card.innerHTML =
        '<div class="hs-card-head">' + badge +
        '<span class="hs-eng">' + (m.eng || "") + '</span></div>' +
        '<h3 class="hs-card-title">' + (m.title || m.label) + '</h3>' +
        '<p class="hs-card-body">' + (m.body || "") + '</p>';
    }

    // ---- navigation ------------------------------------------------------
    function goTo(i) {
      var max = total() - 1;
      if (i < -1) i = -1;
      if (i > max) i = max;
      state.idx = i;
      draw();
    }
    function step(delta) { goTo(state.idx + delta); }

    function syncControls() {
      btnPrev.disabled = state.idx <= -1;
      btnNext.disabled = state.idx >= total() - 1;
      // end toggle only relevant in two-way mode
      endWrap.style.display = (state.mode === "two") ? "flex" : "none";
      setPill(endThree, state.ending === "three");
      setPill(endTwo, state.ending === "two");
      setTab(tabThree, state.mode === "three");
      setTab(tabTwo, state.mode === "two");
    }

    // ---- autoplay --------------------------------------------------------
    function togglePlay() { state.playing ? pause() : play(); }
    function play() {
      if (state.idx >= total() - 1) goTo(-1);
      state.playing = true;
      btnPlay.innerHTML = "❚❚ השהה";
      btnPlay.classList.add("hs-playing");
      tick();
    }
    function pause() {
      state.playing = false;
      if (state.timer) { clearTimeout(state.timer); state.timer = null; }
      btnPlay.innerHTML = "▶ הפעל";
      btnPlay.classList.remove("hs-playing");
    }
    function tick() {
      if (!state.playing) return;
      if (state.idx >= total() - 1) { pause(); return; }
      goTo(state.idx + 1);
      state.timer = setTimeout(tick, reduceMotion ? 900 : 1900);
    }

    // ---- mode + ending switches ------------------------------------------
    function setMode(mode) {
      if (state.mode === mode) return;
      pause();
      state.mode = mode;
      goTo(-1);
    }
    function setEnding(end) {
      if (state.ending === end) return;
      state.ending = end;
      // redraw the ending step if we're on it
      draw();
    }

    tabThree.addEventListener("click", function () { setMode("three"); });
    tabTwo.addEventListener("click", function () { setMode("two"); });
    endThree.addEventListener("click", function () { setEnding("three"); });
    endTwo.addEventListener("click", function () { setEnding("two"); });

    // ---- helpers to build tab / pill DOM ---------------------------------
    function mkTab(label, mode) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "hs-tab";
      b.setAttribute("role", "tab");
      b.textContent = label;
      return b;
    }
    function setTab(b, on) {
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    }
    function mkPill(label, val) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "hs-pill";
      b.setAttribute("aria-pressed", "false");
      b.textContent = label;
      return b;
    }
    function setPill(b, on) {
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    }

    // first paint
    goTo(-1);
  }

  // ---- SVG scaffold (static parts) ---------------------------------------
  function buildSVG() {
    var arrowDefs = [C.blue, C.clay, C.sage, C.mustard].map(function (c) {
      var id = "hs-arrow-" + c.replace("#", "");
      return '<marker id="' + id + '" viewBox="0 0 10 10" refX="9" refY="5" ' +
        'markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
        '<path d="M0,0 L10,5 L0,10 z" fill="' + c + '"/></marker>';
    }).join("");

    // lifelines
    function lifeline(x, id, color, headLabel, sub) {
      return '' +
        '<line x1="' + x + '" y1="' + TOP + '" x2="' + x + '" y2="' + BOT +
          '" stroke="' + C.line + '" stroke-width="2" stroke-dasharray="3 5"/>' +
        // header box
        '<rect x="' + (x - 62) + '" y="' + (TOP - 52) + '" width="124" height="40" rx="12" ' +
          'fill="' + C.surface2 + '" stroke="' + color + '" stroke-width="1.6"/>' +
        '<text id="' + id + '-label" x="' + x + '" y="' + (TOP - 32) + '" text-anchor="middle" ' +
          'class="hs-host" fill="' + color + '" direction="ltr">' + headLabel + '</text>' +
        '<text x="' + x + '" y="' + (TOP - 18) + '" text-anchor="middle" ' +
          'class="hs-hostsub" fill="' + C.inkSoft + '">' + sub + '</text>';
    }

    // state pill group (dynamic text set later)
    function statePill(x, id) {
      return '<g id="' + id + '" data-cx="' + x + '">' +
        '<rect x="' + (x - 45) + '" y="' + (BOT + 8) + '" width="90" height="24" rx="12" ' +
          'fill="' + C.surface + '" stroke="' + C.inkSoft + '" stroke-width="1.6"/>' +
        '<text x="' + x + '" y="' + (BOT + 24) + '" text-anchor="middle" ' +
          'class="hs-statetxt" fill="' + C.inkSoft + '" direction="ltr">CLOSED</text>' +
        '</g>';
    }

    return '' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" class="hs-svg" ' +
        'role="img" aria-label="ציר זמן לחיצת יד TCP בין לקוח לשרת" ' +
        'preserveAspectRatio="xMidYMid meet"><defs>' + arrowDefs +
      '</defs>' +
      // ESTABLISHED reliable-tunnel highlight (hidden until both sides reach it)
      '<g id="hs-estab" style="opacity:0;transition:opacity .4s ease">' +
        '<rect x="' + (CX - 8) + '" y="326" width="' + (SX - CX + 16) + '" height="30" rx="15" ' +
          'fill="rgba(124,152,133,.14)" stroke="' + C.sage + '" stroke-width="1.4" ' +
          'stroke-dasharray="6 4"/>' +
        '<text x="' + ((CX + SX) / 2) + '" y="345" text-anchor="middle" ' +
          'class="hs-estabtxt" fill="' + C.sage + '" direction="ltr">' +
          'reliable connection · full-duplex</text>' +
      '</g>' +
      lifeline(CX, "hs-clabel", C.blue, "TCP-client", "מחשב הלקוח") +
      lifeline(SX, "hs-slabel", C.clay, "TCP-server", "מחשב השרת") +
      '<g id="hs-msglayer"></g>' +
      statePill(CX, "hs-cstate") +
      statePill(SX, "hs-sstate") +
      '</svg>';
  }

  // ---- tiny DOM/SVG helpers ----------------------------------------------
  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }
  function mkBtn(label, cls) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "viz-btn " + (cls.indexOf("primary") >= 0 ? "primary " : "") +
      cls.replace(" primary", "");
    b.innerHTML = label;
    return b;
  }
  var SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    return e;
  }

  // ---- scoped stylesheet --------------------------------------------------
  function injectStyle() {
    if (document.getElementById("hs-style")) return;
    var css = '' +
      '.hs-root{--hs-accent:' + C.blue + '}' +
      '.hs-tabs{display:flex;gap:.5rem;margin-bottom:.9rem;flex-wrap:wrap}' +
      '.hs-tab{font-family:inherit;font-size:.86rem;font-weight:600;color:' + C.inkSoft + ';' +
        'background:' + C.surface2 + ';border:1.5px solid ' + C.line + ';border-radius:99px;' +
        'padding:.4rem 1rem;cursor:pointer;transition:all .15s ease}' +
      '.hs-tab:hover{border-color:' + C.clay + '}' +
      '.hs-tab.on{background:' + C.clay + ';color:#fff;border-color:' + C.clay + '}' +

      '.hs-stagewrap{background:' + C.bg + ';border:1px solid ' + C.line + ';border-radius:12px;' +
        'padding:.4rem;overflow:hidden}' +
      '.hs-svg{display:block;width:100%;height:auto}' +

      '.hs-host{font-size:13px;font-weight:700;font-family:ui-monospace,"JetBrains Mono",monospace}' +
      '.hs-hostsub{font-size:10.5px;font-weight:500}' +
      '.hs-statetxt{font-size:12px;font-weight:700;font-family:ui-monospace,"JetBrains Mono",monospace}' +
      '.hs-chiptxt{font-size:12px;font-weight:700;font-family:ui-monospace,"JetBrains Mono",monospace}' +
      '.hs-seqtxt{font-size:10.5px;font-weight:600;font-family:ui-monospace,"JetBrains Mono",monospace}' +
      '.hs-cleantxt{font-size:11px;font-weight:600;font-family:ui-monospace,"JetBrains Mono",monospace}' +
      '.hs-estabtxt{font-size:11px;font-weight:600;font-family:ui-monospace,"JetBrains Mono",monospace}' +
      '.hs-warntxt{font-size:11.5px;font-weight:700;font-family:ui-monospace,"JetBrains Mono",monospace}' +

      // message fly-in animation
      '@keyframes hs-fly{to{stroke-dashoffset:0}}' +
      '.hs-fly{animation:hs-fly .55s ease-out forwards}' +
      '@keyframes hs-ghostdash{to{stroke-dashoffset:-44}}' +
      '.hs-fly-ghost{animation:hs-ghostdash 1.2s linear infinite}' +
      '@keyframes hs-chipin{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}' +
      '.hs-chipin{animation:hs-chipin .5s ease-out both;transform-box:fill-box;transform-origin:center}' +

      // ending toggle
      '.hs-endwrap{display:none;align-items:center;flex-wrap:wrap;gap:.5rem;margin-top:.85rem}' +
      '.hs-endlbl{font-size:.82rem;font-weight:600;color:' + C.inkSoft + '}' +
      '.hs-pill{font-family:inherit;font-size:.8rem;font-weight:600;color:' + C.ink + ';' +
        'background:' + C.surface2 + ';border:1.5px solid ' + C.line + ';border-radius:99px;' +
        'padding:.32rem .8rem;cursor:pointer;transition:all .15s ease}' +
      '.hs-pill:hover{border-color:' + C.sage + '}' +
      '.hs-pill.on{background:' + C.sage + ';color:#fff;border-color:' + C.sage + '}' +

      // detail card
      '.hs-card{--hs-accent:' + C.blue + ';margin-top:.9rem;background:' + C.surface + ';' +
        'border:1px solid ' + C.line + ';border-inline-start:4px solid var(--hs-accent);' +
        'border-radius:12px;padding:.85rem 1rem;min-height:132px;' +
        'box-shadow:0 2px 10px rgba(120,100,70,.06)}' +
      '.hs-card.hs-warn{background:linear-gradient(0deg,rgba(190,124,94,.06),rgba(190,124,94,.06)),' + C.surface + '}' +
      '.hs-card.hs-ok{background:linear-gradient(0deg,rgba(124,152,133,.06),rgba(124,152,133,.06)),' + C.surface + '}' +
      '.hs-card-head{display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap}' +
      '.hs-badge{font-size:.72rem;font-weight:700;color:#fff;background:var(--hs-accent);' +
        'padding:.15rem .6rem;border-radius:99px;white-space:nowrap}' +
      '.hs-eng{font-size:.74rem;font-weight:600;color:' + C.inkSoft + ';direction:ltr;' +
        'font-family:ui-monospace,"JetBrains Mono",monospace}' +
      '.hs-card-title{margin:.5rem 0 .3rem;font-size:1rem;font-weight:700;color:' + C.ink + '}' +
      '.hs-card-body{margin:0;font-size:.9rem;line-height:1.62;color:' + C.ink + '}' +
      '.hs-card-body b{color:var(--hs-accent)}' +
      '.hs-card-body span[dir="ltr"]{font-family:ui-monospace,"JetBrains Mono",monospace;font-size:.86em;' +
        'color:' + C.ink + '}' +

      '.hs-play.hs-playing{background:' + C.mustard + ';border-color:' + C.mustard + '}' +

      // reduced motion
      '@media (prefers-reduced-motion: reduce){' +
        '.hs-fly,.hs-fly-ghost,.hs-chipin{animation:none}' +
        '.hs-fly{stroke-dashoffset:0!important}' +
        '#hs-estab{transition:none}' +
      '}';

    var st = document.createElement("style");
    st.id = "hs-style";
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
