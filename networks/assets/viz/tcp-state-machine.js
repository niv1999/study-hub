/* ============================================================================
 * tcp-state-machine.js  —  Module 06 · TCP: חיבורים, מכונת המצבים, וכותרת ה-Segment
 * ----------------------------------------------------------------------------
 * Interactive explorer of the lecturer's 11-state TCP state machine.
 * Grounded ONLY in _notes/tcp.md:
 *   - §7 (the 11 formal states, roles, entry/exit events, TCB lifecycle,
 *         TIME_WAIT = 2×MSL, dual purpose).
 *   - §12 D1 (the exact state-machine topology + edge labels): CLOSED at the
 *         apex splits into a LEFT active path (client / connect()) and a RIGHT
 *         passive path (server / listen()); ESTABLISHED is "קו המשווה של הגרף"
 *         (setup above, teardown below); every arc carries a (Recv:…)/(Send:…)
 *         label; a "Timeout / RST" edge returns any state to CLOSED.
 *   - §10 / D-examples (three-way handshake, teardown, simultaneous open/close).
 *
 * Interaction:
 *   - Click / keyboard-focus any of the 11 state nodes → highlights that state,
 *     shows its role + entry/exit events, and lights up its outgoing edges.
 *   - "מסלול לקוח (active)" / "מסלול שרת (passive)" toggles dim the other path.
 *   - Scenario player steps through the lecturer's canonical sequences
 *     (handshake, active close, passive close, simultaneous open, simultaneous
 *      close, timeout/RST) — each step advances the current state along a real
 *      transition, animates a segment on the wire, and captions Recv/Send.
 *
 * Self-contained IIFE. No external deps. Accessible, keyboard-operable,
 * respects prefers-reduced-motion, degrades if the mount is absent.
 * ==========================================================================*/
(function () {
  "use strict";

  /* ---- design palette (hardcoded per CONTRACT §2) ---- */
  var C = {
    bg: "#FBF7F0", surface: "#FFFDF8", surface2: "#FBF5EA",
    ink: "#33302B", inkSoft: "#6B655C", line: "#E7DECF",
    dustyBlue: "#6E8CA0", clay: "#BE7C5E", sage: "#7C9885", mustard: "#C9A24B"
  };

  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) { reduceMotion = false; }

  /* ------------------------------------------------------------------ *
   * THE MODEL — 11 states laid out on the lecturer's two-path topology. *
   * Layout grid (viewBox 720×560):                                      *
   *   apex        CLOSED                                                 *
   *   setup row1  SYN_SENT (left/active)      LISTEN (right/passive)     *
   *   setup row2                              SYN_RCVD                    *
   *   equator     ESTABLISHED (centred)                                  *
   *   teardown    FIN_WAIT_1 (left)           CLOSE_WAIT (right)         *
   *               FIN_WAIT_2 · CLOSING        LAST_ACK                   *
   *               TIME_WAIT                                              *
   * side = "active" (client, left) | "passive" (server, right) | "both" *
   * ------------------------------------------------------------------ */
  var STATES = [
    {
      key: "CLOSED", x: 360, y: 46, side: "both", band: "apex",
      he: "סגור", role: "מצב פיקטיבי — אין קיום רשתי ואין TCB. נקודת ההתחלה והסיום של כל חיבור; כל המסלולים מתכנסים לכאן.",
      entry: "אתחול · קבלת RST · פקיעת טיימר ה-TIME_WAIT",
      exit: "Active Open ‏(connect()) ← SYN_SENT · Passive Open ‏(listen()) ← LISTEN"
    },
    {
      key: "LISTEN", x: 560, y: 150, side: "passive", band: "setup",
      he: "מאזין", role: "השרת ממתין פסיבית ל-SYN. לא מוקצה עדיין TCB מלא לחיבור ספציפי.",
      entry: "listen()", exit: "קבלת SYN ← מקצה TCB, שולח SYN-ACK ← SYN_RCVD"
    },
    {
      key: "SYN_SENT", x: 160, y: 150, side: "active", band: "setup",
      he: "SYN נשלח", role: "הלקוח יזם: יצר ISN, שלח SYN, הפעיל טיימר, וממתין. חצי הדרך אל החיבור.",
      entry: "connect()", exit: "קבלת SYN-ACK ← שולח ACK ← ESTABLISHED · (Simultaneous) קבלת SYN ← שולח SYN-ACK ← SYN_RCVD"
    },
    {
      key: "SYN_RCVD", x: 560, y: 258, side: "passive", band: "setup",
      he: "SYN התקבל", role: "צד השרת קיבל SYN ואישר ב-SYN-ACK — 'חצי הדרך'. מצב חצי-פתוח פגיע, טיימר קצר (הגנה מ-SYN Flood).",
      entry: "קבלת SYN ‏(מ-LISTEN) · קבלת SYN ‏(מ-SYN_SENT)", exit: "קבלת ACK חוקי ← ESTABLISHED · Timeout/RST ← LISTEN"
    },
    {
      key: "ESTABLISHED", x: 360, y: 300, side: "both", band: "equator",
      he: "מבוסס", role: "הלב התפעולי. החוזה נחתם, החוצצים הוקצו. המצב היחיד שבו מותר Payload אמיתי — כל מנגנוני ה-RDT עובדים כאן.",
      entry: "השלמת לחיצת היד המשולשת", exit: "Active Close ‏(close()) ← שולח FIN ← FIN_WAIT_1 · Passive Close ‏(קבלת FIN) ← שולח ACK ← CLOSE_WAIT"
    },
    {
      key: "FIN_WAIT_1", x: 160, y: 372, side: "active", band: "teardown",
      he: "המתנה ל-FIN 1", role: "היוזם סגר כלפי חוץ; שלח FIN וממתין ל-ACK. עדיין יכול לקבל נתונים בכיוון הנגדי.",
      entry: "close() ‏(מ-ESTABLISHED)", exit: "קבלת ACK ל-FIN ← FIN_WAIT_2 · (Simultaneous) קבלת FIN ← שולח ACK ← CLOSING"
    },
    {
      key: "CLOSE_WAIT", x: 560, y: 372, side: "passive", band: "teardown",
      he: "המתנה לסגירה", role: "הצד הפסיבי קיבל FIN ואישר ב-ACK. ממתין שהאפליקציה המקומית תקרא close().",
      entry: "קבלת FIN ‏(מ-ESTABLISHED)", exit: "האפליקציה קוראת close() ← שולח FIN ← LAST_ACK"
    },
    {
      key: "FIN_WAIT_2", x: 100, y: 452, side: "active", band: "teardown",
      he: "המתנה ל-FIN 2", role: "היוזם קיבל ACK ל-FIN שלו; ממתין שהצד המרוחק יסיים וישלח FIN. חיבור חצי-סגור.",
      entry: "קבלת ACK על ה-FIN", exit: "קבלת FIN ← שולח ACK סופי ← TIME_WAIT"
    },
    {
      key: "CLOSING", x: 262, y: 452, side: "active", band: "teardown",
      he: "בסגירה", role: "מצב קצה נדיר — שני הצדדים קראו close() כמעט בו-זמנית. שלח FIN אך קיבל FIN לפני ה-ACK; משיב ACK וממתין ל-ACK שלו.",
      entry: "קבלת FIN בעודו ב-FIN_WAIT_1", exit: "קבלת ה-ACK ל-FIN המקורי ← TIME_WAIT"
    },
    {
      key: "LAST_ACK", x: 560, y: 452, side: "passive", band: "teardown",
      he: "אישור אחרון", role: "הצד הפסיבי (שהיה ב-CLOSE_WAIT) סיים, שלח FIN; ממתין לאישור האחרון.",
      entry: "close() ‏(מ-CLOSE_WAIT)", exit: "קבלת ACK ל-FIN ← מיד משמיד TCB, מוחק סוקט ← CLOSED"
    },
    {
      key: "TIME_WAIT", x: 160, y: 520, side: "active", band: "teardown",
      he: "המתנת זמן (2MSL)", role: "'מצב גאוני הנדסית', שמור אך ורק לצד שיזם את הניתוק. נועל את ה-TCB ל-2×MSL (‏60–120 שניות). מטרה כפולה: (1) קליטת חבילות תועות ישנות שלא יזלגו לחיבור חדש; (2) אם ה-ACK האחרון אבד — עדיין כאן לשלוח שוב ACK.",
      entry: "משלוח ה-ACK הסופי ‏(מ-FIN_WAIT_2 או CLOSING)", exit: "פקיעת טיימר ה-2MSL בלבד ← CLOSED"
    }
  ];

  /* ---- transitions (from §12 D1). label = short segment on the wire ----
   * dir: "send" (this host emits) / "recv" (this host receives) / "app"
   * (local API call, no wire) / "timer" (2MSL wait, no wire).           */
  var EDGES = [
    // setup — active (left)
    { from: "CLOSED", to: "SYN_SENT", side: "active", ev: "App: connect()", label: "SYN", dir: "send" },
    { from: "SYN_SENT", to: "ESTABLISHED", side: "active", ev: "Recv: SYN-ACK", label: "ACK", dir: "send", recv: "SYN-ACK" },
    { from: "SYN_SENT", to: "SYN_RCVD", side: "active", ev: "Simultaneous · Recv: SYN", label: "SYN-ACK", dir: "send", recv: "SYN", curve: -60 },
    // setup — passive (right)
    { from: "CLOSED", to: "LISTEN", side: "passive", ev: "App: listen()", label: "", dir: "app" },
    { from: "LISTEN", to: "SYN_RCVD", side: "passive", ev: "Recv: SYN", label: "SYN-ACK", dir: "send", recv: "SYN" },
    { from: "SYN_RCVD", to: "ESTABLISHED", side: "passive", ev: "Recv: ACK", label: "", dir: "recv", recv: "ACK" },
    // teardown — active (left)
    { from: "ESTABLISHED", to: "FIN_WAIT_1", side: "active", ev: "App: close()", label: "FIN", dir: "send" },
    { from: "FIN_WAIT_1", to: "FIN_WAIT_2", side: "active", ev: "Recv: ACK", label: "", dir: "recv", recv: "ACK" },
    { from: "FIN_WAIT_1", to: "CLOSING", side: "active", ev: "Simultaneous · Recv: FIN", label: "ACK", dir: "send", recv: "FIN" },
    { from: "FIN_WAIT_2", to: "TIME_WAIT", side: "active", ev: "Recv: FIN", label: "ACK", dir: "send", recv: "FIN" },
    { from: "CLOSING", to: "TIME_WAIT", side: "active", ev: "Recv: ACK", label: "", dir: "recv", recv: "ACK" },
    { from: "TIME_WAIT", to: "CLOSED", side: "active", ev: "Wait 2MSL", label: "", dir: "timer" },
    // teardown — passive (right)
    { from: "ESTABLISHED", to: "CLOSE_WAIT", side: "passive", ev: "Recv: FIN", label: "ACK", dir: "send", recv: "FIN" },
    { from: "CLOSE_WAIT", to: "LAST_ACK", side: "passive", ev: "App: close()", label: "FIN", dir: "send" },
    { from: "LAST_ACK", to: "CLOSED", side: "passive", ev: "Recv: ACK", label: "", dir: "recv", recv: "ACK" }
  ];

  /* ---- runnable scenarios: ordered lists of edges (from→to) ---- */
  var SCENARIOS = {
    handshake: {
      he: "לחיצת יד תלת-שלבית",
      note: "connect() ← SYN · SYN-ACK ← ACK. הלקוח (שמאל) יזם, השרת (ימין) הקשיב.",
      steps: [
        ["CLOSED", "LISTEN"],
        ["CLOSED", "SYN_SENT"],
        ["LISTEN", "SYN_RCVD"],
        ["SYN_SENT", "ESTABLISHED"],
        ["SYN_RCVD", "ESTABLISHED"]
      ]
    },
    activeClose: {
      he: "סגירה — צד יוזם (Active Close)",
      note: "close() ← FIN · ACK · FIN · ACK. שים לב ל-TIME_WAIT ‏(2MSL) בצד היוזם.",
      steps: [
        ["ESTABLISHED", "FIN_WAIT_1"],
        ["FIN_WAIT_1", "FIN_WAIT_2"],
        ["ESTABLISHED", "CLOSE_WAIT"],
        ["FIN_WAIT_2", "TIME_WAIT"],
        ["CLOSE_WAIT", "LAST_ACK"],
        ["LAST_ACK", "CLOSED"],
        ["TIME_WAIT", "CLOSED"]
      ]
    },
    passiveClose: {
      he: "סגירה — צד פסיבי (Passive Close)",
      note: "הצד המרוחק סגר קודם: ESTABLISHED ← CLOSE_WAIT ← LAST_ACK ← CLOSED. אין TIME_WAIT.",
      steps: [
        ["ESTABLISHED", "CLOSE_WAIT"],
        ["CLOSE_WAIT", "LAST_ACK"],
        ["LAST_ACK", "CLOSED"]
      ]
    },
    simulOpen: {
      he: "פתיחה בו-זמנית (Simultaneous Open)",
      note: "שני הצדדים שלחו SYN יחד: SYN_SENT ← SYN_RCVD ← ESTABLISHED.",
      steps: [
        ["CLOSED", "SYN_SENT"],
        ["SYN_SENT", "SYN_RCVD"],
        ["SYN_RCVD", "ESTABLISHED"]
      ]
    },
    simulClose: {
      he: "סגירה בו-זמנית (Simultaneous Close)",
      note: "שני close() כמעט יחד: FIN_WAIT_1 ← CLOSING ← TIME_WAIT.",
      steps: [
        ["ESTABLISHED", "FIN_WAIT_1"],
        ["FIN_WAIT_1", "CLOSING"],
        ["CLOSING", "TIME_WAIT"],
        ["TIME_WAIT", "CLOSED"]
      ]
    }
  };

  /* ---------------------------------------------------------------- */
  var SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    return e;
  }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function byKey(k) {
    for (var i = 0; i < STATES.length; i++) if (STATES[i].key === k) return STATES[i];
    return null;
  }
  function edgeOf(from, to) {
    for (var i = 0; i < EDGES.length; i++) if (EDGES[i].from === from && EDGES[i].to === to) return EDGES[i];
    return null;
  }
  function sideColor(side) {
    return side === "active" ? C.dustyBlue : side === "passive" ? C.sage : C.clay;
  }

  /* node geometry */
  var NODE_W = 128, NODE_H = 40;

  /* ================================================================ *
   * RENDER                                                            *
   * ================================================================ */
  function render(mount) {
    if (!mount) return;
    mount.innerHTML = "";
    injectStyles();

    var root = el("div", "tsm-root");
    root.setAttribute("dir", "rtl");
    mount.appendChild(root);

    /* ---- title ---- */
    var head = el("div", "tsm-head");
    head.innerHTML =
      '<div class="tsm-title">מכונת המצבים של <span dir="ltr">TCP</span> — 11 מצבים</div>' +
      '<div class="tsm-sub">לחצו על מצב כדי לפתוח אותו, או הריצו תרחיש. ' +
      '<span class="tsm-leg"><i style="background:' + C.dustyBlue + '"></i>מסלול לקוח (active)</span>' +
      '<span class="tsm-leg"><i style="background:' + C.sage + '"></i>מסלול שרת (passive)</span>' +
      '<span class="tsm-leg"><i style="background:' + C.clay + '"></i>משותף</span></div>';
    root.appendChild(head);

    /* ---- main grid: diagram (left) + detail panel (right) ---- */
    var grid = el("div", "tsm-grid");
    root.appendChild(grid);

    var diagWrap = el("div", "tsm-diag");
    grid.appendChild(diagWrap);

    var VB_W = 720, VB_H = 560;
    var s = svg("svg", {
      viewBox: "0 0 " + VB_W + " " + VB_H,
      width: "100%",
      role: "group",
      "aria-label": "דיאגרמת מכונת המצבים של TCP — 11 מצבים, מסלול לקוח משמאל ומסלול שרת מימין"
    });
    s.classList.add("tsm-svg");
    diagWrap.appendChild(s);

    /* arrowhead marker defs */
    var defs = svg("defs");
    ["dim", "active", "passive", "both", "hot"].forEach(function (kind) {
      var col = kind === "dim" ? C.line
        : kind === "hot" ? C.mustard
        : sideColor(kind);
      var m = svg("marker", {
        id: "tsm-arrow-" + kind, viewBox: "0 0 10 10",
        refX: "8.5", refY: "5", markerWidth: "7", markerHeight: "7",
        orient: "auto-start-reverse"
      });
      m.appendChild(svg("path", { d: "M0,0 L10,5 L0,10 z", fill: col }));
      defs.appendChild(m);
    });
    s.appendChild(defs);

    /* ---- equator line (ESTABLISHED = קו המשווה) ---- */
    var eqY = byKey("ESTABLISHED").y + NODE_H / 2 + 6;
    var eq = svg("line", {
      x1: 24, y1: eqY, x2: VB_W - 24, y2: eqY,
      stroke: C.line, "stroke-width": 1.4, "stroke-dasharray": "3 6"
    });
    s.appendChild(eq);
    var eqUp = svg("text", { x: VB_W - 30, y: eqY - 8, "text-anchor": "end", class: "tsm-eqlabel", fill: C.inkSoft });
    eqUp.textContent = "▲ הקמת חיבור (הקצאת TCB)";
    s.appendChild(eqUp);
    var eqDn = svg("text", { x: VB_W - 30, y: eqY + 18, "text-anchor": "end", class: "tsm-eqlabel", fill: C.inkSoft });
    eqDn.textContent = "▼ סגירת חיבור (פירוק TCB)";
    s.appendChild(eqDn);

    /* ---- edges layer (under nodes) ---- */
    var edgeLayer = svg("g", { class: "tsm-edges" });
    s.appendChild(edgeLayer);

    var edgeNodes = []; // { edge, path, hit, labelG }

    EDGES.forEach(function (E) {
      var a = byKey(E.from), b = byKey(E.to);
      var p = anchorPath(a, b, E.curve || 0);
      var col = sideColor(E.side);

      var path = svg("path", {
        d: p.d, fill: "none",
        stroke: col, "stroke-width": 2, "stroke-opacity": "0.45",
        "marker-end": "url(#tsm-arrow-" + E.side + ")",
        class: "tsm-edge", "data-side": E.side
      });
      edgeLayer.appendChild(path);

      // label pill on the wire (only when it carries a real segment)
      var labelG = null;
      if (E.label) {
        labelG = svg("g", { class: "tsm-elabel" });
        var lw = E.label.length * 7.2 + 14;
        labelG.appendChild(svg("rect", {
          x: p.mx - lw / 2, y: p.my - 10, width: lw, height: 18, rx: 9,
          fill: C.surface, stroke: col, "stroke-width": 1, "stroke-opacity": "0.55"
        }));
        var lt = svg("text", {
          x: p.mx, y: p.my + 3.5, "text-anchor": "middle",
          class: "tsm-elabel-t", fill: col, direction: "ltr"
        });
        lt.textContent = E.label;
        labelG.appendChild(lt);
        edgeLayer.appendChild(labelG);
      }

      edgeNodes.push({ E: E, path: path, labelG: labelG, mid: { x: p.mx, y: p.my } });
    });

    /* ---- Timeout / RST global return edge (right margin) ---- */
    var rstPath = svg("path", {
      d: "M " + (VB_W - 20) + " " + (byKey("ESTABLISHED").y) +
         " C " + (VB_W - 2) + " 220, " + (VB_W - 2) + " 100, " + (VB_W - 30) + " 60",
      fill: "none", stroke: C.clay, "stroke-width": 1.6,
      "stroke-dasharray": "5 4", "stroke-opacity": "0.5",
      "marker-end": "url(#tsm-arrow-both)"
    });
    s.appendChild(rstPath);
    var rstT = svg("text", { x: VB_W - 8, y: 150, "text-anchor": "end", class: "tsm-rst-t", fill: C.clay, transform: "rotate(90 " + (VB_W - 8) + " 150)" });
    rstT.textContent = "Timeout / RST → CLOSED";
    s.appendChild(rstT);

    /* ---- travelling segment dot (wire animation) ---- */
    var seg = svg("g", { class: "tsm-seg", opacity: "0" });
    var segRect = svg("rect", { x: -18, y: -11, width: 36, height: 22, rx: 7, fill: C.mustard });
    var segT = svg("text", { x: 0, y: 4, "text-anchor": "middle", class: "tsm-seg-t", fill: "#fff", direction: "ltr" });
    seg.appendChild(segRect); seg.appendChild(segT);
    s.appendChild(seg);

    /* ---- nodes layer ---- */
    var nodeNodes = {}; // key -> { g, rect }
    STATES.forEach(function (S, i) {
      var col = sideColor(S.side);
      var g = svg("g", {
        class: "tsm-node", tabindex: "0", role: "button",
        "data-key": S.key, "data-side": S.side,
        transform: "translate(" + (S.x - NODE_W / 2) + "," + (S.y - NODE_H / 2) + ")"
      });
      g.setAttribute("aria-label", S.key + " — " + S.he);

      var rect = svg("rect", {
        x: 0, y: 0, width: NODE_W, height: NODE_H, rx: 11,
        fill: C.surface, stroke: col, "stroke-width": 2, class: "tsm-node-rect"
      });
      g.appendChild(rect);
      // side chip
      g.appendChild(svg("rect", { x: 0, y: 0, width: 7, height: NODE_H, rx: 3.5, fill: col }));
      // state name (LTR)
      var nameT = svg("text", {
        x: NODE_W / 2 + 3, y: NODE_H / 2 - 2, "text-anchor": "middle",
        class: "tsm-node-t", fill: C.ink, direction: "ltr"
      });
      nameT.textContent = S.key;
      g.appendChild(nameT);
      // hebrew micro-label
      var heT = svg("text", {
        x: NODE_W / 2 + 3, y: NODE_H / 2 + 12, "text-anchor": "middle",
        class: "tsm-node-he", fill: C.inkSoft
      });
      heT.textContent = S.he;
      g.appendChild(heT);

      s.appendChild(g);
      nodeNodes[S.key] = { g: g, rect: rect, S: S };

      var activate = function () { selectState(S.key, true); };
      g.addEventListener("click", activate);
      g.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); activate(); }
        else if (ev.key === "ArrowDown" || ev.key === "ArrowRight") { ev.preventDefault(); focusNode(i + 1); }
        else if (ev.key === "ArrowUp" || ev.key === "ArrowLeft") { ev.preventDefault(); focusNode(i - 1); }
      });
    });

    function focusNode(i) {
      if (i < 0 || i >= STATES.length) return;
      nodeNodes[STATES[i].key].g.focus();
    }

    /* ===== RIGHT: detail panel ===== */
    var panel = el("div", "tsm-panel");
    panel.setAttribute("aria-live", "polite");
    grid.appendChild(panel);

    /* ---- controls: path filter + scenario player ---- */
    var controls = el("div", "viz-controls");
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "פקדים");

    var btnActive = el("button", "viz-btn");
    btnActive.type = "button";
    btnActive.setAttribute("aria-pressed", "false");
    btnActive.textContent = "מסלול לקוח";

    var btnPassive = el("button", "viz-btn");
    btnPassive.type = "button";
    btnPassive.setAttribute("aria-pressed", "false");
    btnPassive.textContent = "מסלול שרת";

    var sep = el("span", "tsm-sep");

    var btnPlay = el("button", "viz-btn primary");
    btnPlay.type = "button";
    btnPlay.innerHTML = "▶ הרץ תרחיש";

    var btnStep = el("button", "viz-btn");
    btnStep.type = "button";
    btnStep.textContent = "צעד ›";

    var btnReset = el("button", "viz-btn");
    btnReset.type = "button";
    btnReset.textContent = "איפוס";

    controls.appendChild(btnActive);
    controls.appendChild(btnPassive);
    controls.appendChild(sep);
    controls.appendChild(btnPlay);
    controls.appendChild(btnStep);
    controls.appendChild(btnReset);
    root.appendChild(controls);

    /* ---- scenario chooser row ---- */
    var scRow = el("div", "tsm-scrow");
    scRow.setAttribute("role", "radiogroup");
    scRow.setAttribute("aria-label", "בחירת תרחיש");
    var scButtons = {};
    Object.keys(SCENARIOS).forEach(function (id) {
      var b = el("button", "tsm-chip");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", "false");
      b.textContent = SCENARIOS[id].he;
      b.addEventListener("click", function () { chooseScenario(id); });
      scRow.appendChild(b);
      scButtons[id] = b;
    });
    root.appendChild(scRow);

    /* ---- scenario caption ---- */
    var scCap = el("div", "tsm-sccap");
    scCap.hidden = true;
    root.appendChild(scCap);

    /* ================= state & behaviour ================= */
    var current = null;     // currently *selected* state key
    var pathFilter = null;  // null | "active" | "passive"
    var scenarioId = null;
    var scStep = -1;        // index of last-applied step
    var machineState = null; // current live state during a scenario run
    var timers = [];
    var playing = false;

    function clearTimers() { timers.forEach(function (t) { clearTimeout(t); }); timers = []; }

    /* ---- select a state: highlight node + light outgoing edges + panel ---- */
    function selectState(key, fromClick) {
      current = key;
      var S = byKey(key);

      // node highlight
      Object.keys(nodeNodes).forEach(function (k) {
        var on = k === key;
        nodeNodes[k].g.classList.toggle("is-active", on);
        nodeNodes[k].rect.setAttribute("stroke-width", on ? 3.5 : 2);
      });

      // edge highlight: outgoing edges of this state glow
      edgeNodes.forEach(function (en) {
        var out = en.E.from === key;
        en.path.classList.toggle("is-out", out);
        en.path.setAttribute("stroke-opacity", out ? "1" : "0.45");
        en.path.setAttribute("stroke-width", out ? "3" : "2");
        if (en.labelG) en.labelG.classList.toggle("is-out", out);
      });

      renderPanel(S);
      applyFilter(); // keep dimming consistent
    }

    function renderPanel(S) {
      panel.innerHTML = "";
      if (!S) return;
      var col = sideColor(S.side);

      var badge = el("div", "tsm-p-badge");
      badge.style.setProperty("--sc", col);
      var sideHe = S.side === "active" ? "מסלול לקוח (active open/close)"
        : S.side === "passive" ? "מסלול שרת (passive open/close)"
        : "מצב משותף (שני הצדדים)";
      badge.innerHTML =
        '<span class="tsm-p-key" dir="ltr">' + S.key + '</span>' +
        '<span class="tsm-p-meta"><span class="tsm-p-he">' + S.he + '</span>' +
        '<span class="tsm-p-side">' + sideHe + '</span></span>';
      panel.appendChild(badge);

      var role = el("p", "tsm-p-role", S.role);
      panel.appendChild(role);

      var evWrap = el("div", "tsm-events");
      var ein = el("div", "tsm-event tsm-in");
      ein.innerHTML = '<span class="tsm-ev-k">אירוע כניסה</span><span class="tsm-ev-v">' + S.entry + '</span>';
      var eout = el("div", "tsm-event tsm-out");
      eout.innerHTML = '<span class="tsm-ev-k">אירוע יציאה → מצב יעד</span><span class="tsm-ev-v">' + S.exit + '</span>';
      evWrap.appendChild(ein);
      evWrap.appendChild(eout);
      panel.appendChild(evWrap);

      // outgoing transitions as a mini-list
      var outs = EDGES.filter(function (e) { return e.from === S.key; });
      if (outs.length) {
        var tl = el("div", "tsm-translist");
        tl.appendChild(el("div", "tsm-tl-h", "מעברים יוצאים"));
        outs.forEach(function (e) {
          var row = el("button", "tsm-tl-row");
          row.type = "button";
          var wire = e.label ? '<span class="tsm-tl-wire" dir="ltr">' + e.label + '</span>' : '';
          row.innerHTML =
            '<span class="tsm-tl-ev" dir="ltr">' + e.ev + '</span>' +
            wire +
            '<span class="tsm-tl-arrow">←</span>' +
            '<span class="tsm-tl-to" dir="ltr">' + e.to + '</span>';
          row.addEventListener("click", function () {
            // jump the machine along this transition and animate it
            stopPlay();
            machineState = e.from;
            animateTransition(e, function () { selectState(e.to, false); });
          });
          tl.appendChild(row);
        });
        panel.appendChild(tl);
      }
    }

    /* ---- path filter (dim the other side) ---- */
    function applyFilter() {
      root.classList.toggle("filt-active", pathFilter === "active");
      root.classList.toggle("filt-passive", pathFilter === "passive");
      Object.keys(nodeNodes).forEach(function (k) {
        var S = nodeNodes[k].S;
        var dim = pathFilter && S.side !== "both" && S.side !== pathFilter;
        nodeNodes[k].g.classList.toggle("is-dim", !!dim);
      });
      edgeNodes.forEach(function (en) {
        var dim = pathFilter && en.E.side !== "both" && en.E.side !== pathFilter;
        en.path.classList.toggle("is-dim", !!dim);
        if (en.labelG) en.labelG.classList.toggle("is-dim", !!dim);
      });
    }

    function setFilter(f) {
      pathFilter = (pathFilter === f) ? null : f;
      btnActive.setAttribute("aria-pressed", pathFilter === "active" ? "true" : "false");
      btnActive.classList.toggle("primary", pathFilter === "active");
      btnPassive.setAttribute("aria-pressed", pathFilter === "passive" ? "true" : "false");
      btnPassive.classList.toggle("primary", pathFilter === "passive");
      applyFilter();
    }

    /* ---- animate one transition: pulse edge + send segment on wire ---- */
    function animateTransition(E, done) {
      var a = byKey(E.from), b = byKey(E.to);
      var p = anchorPath(a, b, E.curve || 0);

      // set live-state highlight on source, then move to target
      setMachineActive(E.from);

      // pulse the edge
      edgeNodes.forEach(function (en) {
        var hot = en.E === E;
        en.path.classList.toggle("is-hot", hot);
        if (hot) en.path.setAttribute("marker-end", "url(#tsm-arrow-hot)");
      });

      var caption = buildCaption(E);
      showFlash(caption);

      if (reduceMotion || E.dir === "app" || E.dir === "timer" || !E.label) {
        // no wire segment — just settle
        var d1 = setTimeout(function () {
          finishTransition(E);
          if (done) done();
        }, reduceMotion ? 1 : 420);
        timers.push(d1);
        return;
      }

      // travelling segment along the path
      seg.setAttribute("opacity", "1");
      segRect.setAttribute("fill", sideColor(E.side));
      segT.textContent = E.label;
      var lw = Math.max(36, E.label.length * 8 + 14);
      segRect.setAttribute("width", lw);
      segRect.setAttribute("x", String(-lw / 2));

      var dur = 560;
      var t0 = null;
      function frame(ts) {
        if (t0 == null) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur);
        var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // easeInOutQuad
        var pt = pointOnQuad(p, e);
        seg.setAttribute("transform", "translate(" + pt.x + "," + pt.y + ")");
        if (k < 1) { requestAnimationFrame(frame); }
        else {
          seg.setAttribute("opacity", "0");
          finishTransition(E);
          if (done) done();
        }
      }
      requestAnimationFrame(frame);
    }

    function finishTransition(E) {
      edgeNodes.forEach(function (en) {
        en.path.classList.remove("is-hot");
        en.path.setAttribute("marker-end", "url(#tsm-arrow-" + en.E.side + ")");
      });
      machineState = E.to;
      setMachineActive(E.to);
    }

    // mark the live machine state (distinct from the user's selected state)
    function setMachineActive(key) {
      Object.keys(nodeNodes).forEach(function (k) {
        nodeNodes[k].g.classList.toggle("is-machine", k === key);
      });
    }

    function buildCaption(E) {
      var parts = [];
      if (E.recv) parts.push('<span class="tsm-cap-recv" dir="ltr">Recv: ' + E.recv + '</span>');
      if (E.dir === "send" && E.label) parts.push('<span class="tsm-cap-send" dir="ltr">Send: ' + E.label + '</span>');
      if (E.dir === "app") parts.push('<span class="tsm-cap-app" dir="ltr">' + E.ev + '</span>');
      if (E.dir === "timer") parts.push('<span class="tsm-cap-timer">⏱ ' + E.ev + ' — נעילת TCB עד לפקיעה</span>');
      return '<b dir="ltr">' + E.from + '</b> <span class="tsm-cap-arr">←</span> <b dir="ltr">' + E.to + '</b>' +
             '<span class="tsm-cap-evs">' + parts.join('') + '</span>';
    }

    function showFlash(html) {
      scCap.hidden = false;
      scCap.innerHTML = '<div class="tsm-flash">' + html + '</div>' +
        (scenarioId ? '<div class="tsm-scnote">' + SCENARIOS[scenarioId].note + '</div>' : '');
    }

    /* ---- scenario player ---- */
    function chooseScenario(id) {
      scenarioId = id;
      Object.keys(scButtons).forEach(function (k) {
        var on = k === id;
        scButtons[k].classList.toggle("is-sel", on);
        scButtons[k].setAttribute("aria-checked", on ? "true" : "false");
      });
      resetRun(false);
      scCap.hidden = false;
      scCap.innerHTML = '<div class="tsm-scnote">' + SCENARIOS[id].note + '</div>' +
        '<div class="tsm-schint">לחצו “הרץ תרחיש” או “צעד ›”.</div>';
      // pre-position the machine on the scenario's starting state
      machineState = SCENARIOS[id].steps[0][0];
      setMachineActive(machineState);
      selectState(machineState, false);
    }

    function currentSteps() {
      return scenarioId ? SCENARIOS[scenarioId].steps : null;
    }

    function doStep(auto, after) {
      var steps = currentSteps();
      if (!steps) { chooseScenario("handshake"); steps = currentSteps(); }
      if (scStep + 1 >= steps.length) {
        // finished
        stopPlay();
        showFlash('<b>הסתיים</b> — התרחיש "' + SCENARIOS[scenarioId].he + '" הושלם.');
        if (after) after(true);
        return;
      }
      scStep++;
      var pair = steps[scStep];
      var E = edgeOf(pair[0], pair[1]);
      if (!E) { if (after) after(false); return; }
      selectState(E.from, false);
      animateTransition(E, function () {
        selectState(E.to, false);
        if (after) after(false);
      });
    }

    function play() {
      var steps = currentSteps();
      if (!steps) { chooseScenario("handshake"); }
      if (scStep + 1 >= currentSteps().length) resetRun(true); // replay from start
      playing = true;
      btnPlay.classList.add("is-playing");
      btnPlay.innerHTML = "⏸ עצור";
      var gap = reduceMotion ? 500 : 780;
      function next() {
        if (!playing) return;
        doStep(true, function (fin) {
          if (fin || !playing) return;
          var t = setTimeout(next, gap);
          timers.push(t);
        });
      }
      next();
    }

    function stopPlay() {
      playing = false;
      btnPlay.classList.remove("is-playing");
      btnPlay.innerHTML = "▶ הרץ תרחיש";
      clearTimers();
    }

    function resetRun(keepScenario) {
      stopPlay();
      scStep = -1;
      seg.setAttribute("opacity", "0");
      edgeNodes.forEach(function (en) {
        en.path.classList.remove("is-hot");
        en.path.setAttribute("marker-end", "url(#tsm-arrow-" + en.E.side + ")");
      });
      if (!keepScenario) { /* keep current scenarioId, just rewind */ }
      if (scenarioId) {
        machineState = SCENARIOS[scenarioId].steps[0][0];
        setMachineActive(machineState);
      } else {
        setMachineActive(null);
      }
    }

    /* ---- wire controls ---- */
    btnActive.addEventListener("click", function () { setFilter("active"); });
    btnPassive.addEventListener("click", function () { setFilter("passive"); });
    btnPlay.addEventListener("click", function () {
      if (playing) stopPlay(); else play();
    });
    btnStep.addEventListener("click", function () {
      stopPlay();
      if (!scenarioId) chooseScenario("handshake");
      doStep(false);
    });
    btnReset.addEventListener("click", function () {
      resetRun(false);
      scCap.hidden = true;
      scenarioId = null;
      Object.keys(scButtons).forEach(function (k) {
        scButtons[k].classList.remove("is-sel");
        scButtons[k].setAttribute("aria-checked", "false");
      });
      pathFilter = null;
      btnActive.classList.remove("primary"); btnActive.setAttribute("aria-pressed", "false");
      btnPassive.classList.remove("primary"); btnPassive.setAttribute("aria-pressed", "false");
      setMachineActive(null);
      applyFilter();
      selectState("CLOSED", false);
    });

    /* ---- initial state ---- */
    selectState("CLOSED", false);
  }

  /* ================================================================ *
   * GEOMETRY HELPERS                                                  *
   * ================================================================ */
  // Build a quadratic path between two node borders, with optional curve bow.
  function anchorPath(a, b, bow) {
    var p1 = borderPoint(a, b);
    var p2 = borderPoint(b, a);
    // control point: midpoint pushed perpendicular by `bow`
    var mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    var dx = p2.x - p1.x, dy = p2.y - p1.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len, ny = dx / len;
    var cx = mx + nx * bow, cy = my + ny * bow;
    var d = "M " + p1.x + " " + p1.y + " Q " + cx + " " + cy + " " + p2.x + " " + p2.y;
    // midpoint on the curve (t=0.5) for label placement
    var mid = quad(p1, { x: cx, y: cy }, p2, 0.5);
    return { d: d, p1: p1, p2: p2, c: { x: cx, y: cy }, mx: mid.x, my: mid.y };
  }

  // point on the border of node `from`'s box, aimed toward `to`
  function borderPoint(from, to) {
    var cx = from.x, cy = from.y;
    var dx = to.x - cx, dy = to.y - cy;
    var hw = NODE_W / 2 + 2, hh = NODE_H / 2 + 2;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    var sx = dx === 0 ? Infinity : hw / Math.abs(dx);
    var sy = dy === 0 ? Infinity : hh / Math.abs(dy);
    var t = Math.min(sx, sy);
    return { x: cx + dx * t, y: cy + dy * t };
  }

  function quad(p0, pc, p1, t) {
    var u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * pc.x + t * t * p1.x,
      y: u * u * p0.y + 2 * u * t * pc.y + t * t * p1.y
    };
  }
  function pointOnQuad(p, t) { return quad(p.p1, p.c, p.p2, t); }

  /* ================================================================ *
   * STYLES                                                            *
   * ================================================================ */
  function injectStyles() {
    if (document.getElementById("tsm-styles")) return;
    var css =
"" +
".tsm-root{--blue:#6E8CA0;--sage:#7C9885;--clay:#BE7C5E;--mustard:#C9A24B;font-family:inherit;color:#33302B;}" +
".tsm-head{margin-bottom:.7rem;}" +
".tsm-title{font-weight:800;font-size:1.02rem;}" +
".tsm-title span[dir=ltr]{font-weight:800;}" +
".tsm-sub{font-size:.8rem;color:#6B655C;margin-top:.25rem;display:flex;flex-wrap:wrap;align-items:center;gap:.35rem .8rem;}" +
".tsm-leg{display:inline-flex;align-items:center;gap:.32rem;font-weight:600;}" +
".tsm-leg i{width:11px;height:11px;border-radius:3px;display:inline-block;}" +

".tsm-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:1.1rem;align-items:start;}" +
"@media(max-width:760px){.tsm-grid{grid-template-columns:1fr;}}" +

".tsm-diag{background:#FFFDF8;border:1px solid #E7DECF;border-radius:14px;padding:.4rem;}" +
".tsm-svg{display:block;width:100%;height:auto;overflow:visible;}" +

/* equator + rst labels */
".tsm-eqlabel{font-size:10px;font-weight:600;}" +
".tsm-rst-t{font-size:10px;font-weight:700;font-family:'JetBrains Mono',ui-monospace,monospace;}" +

/* edges */
".tsm-edge{transition:stroke-opacity .2s ease,stroke-width .2s ease;}" +
".tsm-edge.is-dim{stroke-opacity:.1!important;}" +
".tsm-edge.is-hot{stroke:#C9A24B!important;stroke-opacity:1!important;stroke-width:3.4!important;}" +
".tsm-elabel-t{font-size:11px;font-weight:800;font-family:'JetBrains Mono',ui-monospace,monospace;}" +
".tsm-elabel{transition:opacity .2s ease;}" +
".tsm-elabel.is-dim{opacity:.12;}" +

/* nodes */
".tsm-node{cursor:pointer;outline:none;transition:transform .16s ease,opacity .2s ease;}" +
".tsm-node-rect{transition:stroke-width .15s ease,filter .18s ease,fill .18s ease;}" +
".tsm-node:hover{transform:translateY(-2px);}" +
".tsm-node:focus-visible{outline:none;}" +
".tsm-node:focus-visible .tsm-node-rect{stroke-width:3.4;filter:drop-shadow(0 0 0 3px rgba(110,140,160,.28));}" +
".tsm-node.is-active .tsm-node-rect{filter:drop-shadow(0 4px 10px rgba(120,100,70,.22));}" +
".tsm-node.is-machine .tsm-node-rect{fill:#FBF5EA;filter:drop-shadow(0 0 0 3px rgba(201,162,75,.5));}" +
".tsm-node.is-dim{opacity:.22;}" +
".tsm-node-t{font-size:13px;font-weight:800;font-family:'JetBrains Mono',ui-monospace,monospace;}" +
".tsm-node-he{font-size:9.5px;font-weight:600;}" +

/* travelling segment */
".tsm-seg{transition:opacity .2s ease;pointer-events:none;}" +
".tsm-seg-t{font-size:11px;font-weight:800;font-family:'JetBrains Mono',ui-monospace,monospace;}" +

/* controls extras */
".tsm-sep{width:1px;height:22px;background:#E7DECF;margin:0 .15rem;}" +
".viz-btn.is-playing{background:#BE7C5E;color:#fff;border-color:#BE7C5E;}" +

/* scenario chips */
".tsm-scrow{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.6rem;}" +
".tsm-chip{font-family:inherit;font-size:.8rem;font-weight:600;color:#6B655C;background:#FBF5EA;border:1px solid #E7DECF;border-radius:99px;padding:.28rem .7rem;cursor:pointer;transition:all .15s ease;}" +
".tsm-chip:hover{border-color:#6E8CA0;color:#33302B;}" +
".tsm-chip.is-sel{background:#6E8CA0;color:#fff;border-color:#6E8CA0;}" +
".tsm-chip:focus-visible{outline:2px solid #6E8CA0;outline-offset:2px;}" +

/* scenario caption */
".tsm-sccap{margin-top:.7rem;}" +
".tsm-flash{font-size:.9rem;background:#FFFDF8;border:1px solid #E7DECF;border-radius:10px;padding:.5rem .7rem;line-height:1.6;}" +
".tsm-flash b{font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:800;}" +
".tsm-cap-arr{color:#C9A24B;font-weight:800;margin:0 .25rem;}" +
".tsm-cap-evs{display:inline-flex;flex-wrap:wrap;gap:.35rem;margin-inline-start:.5rem;}" +
".tsm-cap-recv,.tsm-cap-send,.tsm-cap-app,.tsm-cap-timer{font-size:.74rem;font-weight:700;border-radius:6px;padding:.05rem .4rem;font-family:'JetBrains Mono',ui-monospace,monospace;}" +
".tsm-cap-recv{background:#E4ECEA;color:#4d6b60;}" +
".tsm-cap-send{background:#EAE0D3;color:#8a5c40;}" +
".tsm-cap-app{background:#E7ECEF;color:#4d6478;}" +
".tsm-cap-timer{background:#F2E8CE;color:#8a6f2e;font-family:inherit;}" +
".tsm-scnote{font-size:.8rem;color:#6B655C;margin-top:.4rem;line-height:1.5;}" +
".tsm-schint{font-size:.76rem;color:#8a857c;margin-top:.2rem;}" +

/* panel */
".tsm-panel{background:#FBF5EA;border:1px solid #E7DECF;border-radius:14px;padding:1rem 1.05rem;min-height:260px;}" +
".tsm-p-badge{display:flex;align-items:center;gap:.65rem;margin-bottom:.6rem;}" +
".tsm-p-key{--sc:#6E8CA0;flex:0 0 auto;font-weight:800;font-size:.95rem;color:#fff;background:var(--sc);border-radius:9px;padding:.3rem .6rem;font-family:'JetBrains Mono',ui-monospace,monospace;}" +
".tsm-p-meta{display:flex;flex-direction:column;line-height:1.2;}" +
".tsm-p-he{font-weight:800;font-size:.98rem;}" +
".tsm-p-side{font-size:.74rem;color:#6B655C;}" +
".tsm-p-role{font-size:.86rem;line-height:1.6;margin:.1rem 0 .7rem;}" +
".tsm-events{display:grid;gap:.45rem;margin-bottom:.6rem;}" +
".tsm-event{background:#FFFDF8;border:1px solid #E7DECF;border-radius:9px;padding:.45rem .55rem;}" +
".tsm-event.tsm-in{border-inline-start:3px solid #7C9885;}" +
".tsm-event.tsm-out{border-inline-start:3px solid #BE7C5E;}" +
".tsm-ev-k{display:block;font-size:.68rem;color:#6B655C;font-weight:700;margin-bottom:.12rem;}" +
".tsm-ev-v{display:block;font-size:.79rem;line-height:1.45;}" +
".tsm-translist{margin-top:.3rem;}" +
".tsm-tl-h{font-size:.72rem;font-weight:700;color:#6B655C;margin-bottom:.3rem;}" +
".tsm-tl-row{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;width:100%;text-align:start;font-family:inherit;background:#FFFDF8;border:1px solid #E7DECF;border-radius:8px;padding:.34rem .5rem;margin-bottom:.3rem;cursor:pointer;transition:border-color .15s ease,background .15s ease;}" +
".tsm-tl-row:hover{border-color:#6E8CA0;background:#FEFAF2;}" +
".tsm-tl-row:focus-visible{outline:2px solid #6E8CA0;outline-offset:1px;}" +
".tsm-tl-ev{font-size:.72rem;color:#6B655C;font-weight:600;font-family:'JetBrains Mono',ui-monospace,monospace;}" +
".tsm-tl-wire{font-size:.7rem;font-weight:800;color:#8a5c40;background:#EEE3D6;border-radius:5px;padding:.02rem .35rem;font-family:'JetBrains Mono',ui-monospace,monospace;}" +
".tsm-tl-arrow{color:#C9A24B;font-weight:800;margin-inline-start:auto;}" +
".tsm-tl-to{font-size:.76rem;font-weight:800;color:#33302B;font-family:'JetBrains Mono',ui-monospace,monospace;}" +

"@media(prefers-reduced-motion:reduce){.tsm-node,.tsm-node-rect,.tsm-edge,.tsm-elabel,.tsm-seg{transition:none!important;}}";

    var st = document.createElement("style");
    st.id = "tsm-styles";
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ================================================================ *
   * MOUNT                                                             *
   * ================================================================ */
  function boot() {
    var mounts = document.querySelectorAll('[data-viz="tcp-state-machine"]');
    if (!mounts.length) return; // degrade gracefully
    mounts.forEach(function (m) {
      try { render(m); }
      catch (err) {
        if (window.console && console.error) {
          console.error("[tcp-state-machine] render failed:", err);
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
