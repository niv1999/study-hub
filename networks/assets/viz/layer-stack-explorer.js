/* ============================================================================
 * layer-stack-explorer.js  —  Module 02 · שכבות, ה-TCP/IP Stack ו-Encapsulation
 * ----------------------------------------------------------------------------
 * Interactive TCP/IP layer tray in the lecturer's exact colours
 * (Transport TCP/UDP = green, IP = yellow, Link Ethernet/WiFi = red, PHY = grey,
 *  Application = magenta/white client boxes).  Grounded ONLY in
 * _notes/intro-layering.md, Part C (C1–C3):
 *   - the 5-layer host stack: browser{http/https/ftp/telnet} → TCP/UDP → IP →
 *     Ethernet-or-WiFi → PHY → physical channel  (C2, שקפים 47–52)
 *   - same-layer-talks-to-same-layer peer exchange + PDU-per-layer naming
 *     message / segment / datagram(=IP packet) / frame / bits  (C1, שקף 45)
 *   - where each layer is implemented (app outside kernel; TCP/UDP + IP inside
 *     kernel; link at NIC driver; PHY inside the NIC hardware) — drawn from the
 *     host-anatomy model B3 + layer stack C1.
 *   - the lecturer's HTTPS quirk: shown as 431 with "במקור נכתב 431" note.
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
   * THE MODEL — the lecturer's 5 TCP/IP layers (top → bottom).          *
   * Colours are the lecturer's own stack colours (notes C2, שקף 47–52). *
   * ------------------------------------------------------------------ */
  var LAYERS = [
    {
      key: "app",
      num: 5,
      name: "Application",
      he: "יישום",
      pdu: "message",
      pduHe: "הודעה",
      color: C.clay,          // app clients drawn magenta/clay in the notes
      fill: "#F3E1D6",
      swatch: "לבן / מג'נטה",
      protos: "http · https · ftp · telnet",
      peer: "client program ↔ server program",
      peerPdu: "הודעות (messages)",
      where: "מחוץ ל-kernel — בתוך תהליך היישום",
      whereTag: "user space",
      role: "היישום הרשתי. בתוך הדפדפן יושבים ה-clients: http client, https client, ftp client, telnet client. הצד השני הוא ה-WSP (למשל Apache). היישום יוצר את ה-message ומעביר אותו כלפי מטה.",
      note: "המרצה כתב HTTPS כ-431 (במקור נכתב 431 — הערך התקני הוא 443)."
    },
    {
      key: "transport",
      num: 4,
      name: "Transport",
      he: "תעבורה",
      pdu: "segment",
      pduHe: "סגמנט",
      color: C.sage,          // GREEN box in the notes
      fill: "#DCE7DE",
      swatch: "ירוק",
      protos: "TCP · UDP",
      peer: "TCP ↔ TCP",
      peerPdu: "TCP segments",
      where: "בתוך ה-kernel של מערכת ההפעלה",
      whereTag: "kernel",
      role: "שכבת התעבורה. TCP מקים connection לוגי (לא פיזי!) בין http client ל-http server; UDP חסר-חיבור. השכבה עוטפת את ההודעה ל-segment. פעולה end-to-end — קיימת רק במארחים, לא ב-routers.",
      note: "ה-TCP connection הוא לוגי בלבד — לא פיזי (דגש מבחן חזק)."
    },
    {
      key: "ip",
      num: 3,
      name: "Network (IP)",
      he: "רשת",
      pdu: "datagram",
      pduHe: "דטהגרם / IP packet",
      color: C.mustard,       // YELLOW box in the notes
      fill: "#F0E4C4",
      swatch: "צהוב",
      protos: "IP",
      peer: "IP ↔ IP",
      peerPdu: "IP datagrams",
      where: "בתוך ה-kernel — וגם בכל router לאורך המסלול",
      whereTag: "kernel + routers",
      role: "שכבת הרשת. IP עוטף את ה-segment ל-datagram (נקרא גם IP packet). זו השכבה היחידה שקיימת גם ב-routers שבדרך — כל router בוחן את ה-IP מחדש hop-by-hop ומעביר הלאה.",
      note: "ה-routers מגיעים עד שכבת IP בלבד — הם מנתבים לפי IP hop-by-hop."
    },
    {
      key: "link",
      num: 2,
      name: "Link",
      he: "קישור",
      pdu: "frame",
      pduHe: "פריים",
      color: C.clay,          // RED box in the notes (clay is the warm-red token)
      fill: "#EFD9CC",
      swatch: "אדום",
      protos: "Ethernet · WiFi",
      peer: "link ↔ link",
      peerPdu: "Ethernet / WiFi frames",
      where: "מנהל ההתקן של ה-NIC (driver)",
      whereTag: "NIC driver",
      role: "שכבת הקישור. עוטפת את ה-datagram ל-frame (Ethernet או WiFi). ה-frame משתנה בכל hop — Ethernet על קטע אחד, טכנולוגיה אחרת על הבא. כל router מסיים את שכבת הקישור בכל צד בנפרד.",
      note: "ה-frame מוחלף בכל קטע (link) — לא נשמר end-to-end."
    },
    {
      key: "phy",
      num: 1,
      name: "Physical (PHY)",
      he: "פיזית",
      pdu: "bits",
      pduHe: "ביטים / carrier signal",
      color: C.inkSoft,       // GREY box in the notes
      fill: "#E4DED4",
      swatch: "אפור",
      protos: "PHY protocol",
      peer: "אות פיזי דרך הערוץ",
      peerPdu: "carrier signal",
      where: "בתוך חומרת ה-NIC",
      whereTag: "NIC hardware",
      role: "השכבה הפיזית. ה-NIC מבצע DTA (Digital→Analog): הופך את הביטים ל-carrier signal — גל אלקטרומגנטי או אור. המידע עובר פיזית דרך ערוץ קווי (כבל/סיב) או אלחוטי (האוויר). בצד הנמען: ATD (Analog→Digital).",
      note: "כאן המידע עובר פיזית! DTA בשליחה, ATD בקבלה (סימון המרצה)."
    }
  ];

  /* ---------------------------------------------------------------- */
  var SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
    return el;
  }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  /* ================================================================ *
   * RENDER                                                            *
   * ================================================================ */
  function render(mount) {
    if (!mount) return;
    mount.innerHTML = "";

    // scoped styles (once per document)
    injectStyles();

    var root = el("div", "lse-root");
    root.setAttribute("dir", "rtl");
    mount.appendChild(root);

    /* ---- header / mode switch ---- */
    var head = el("div", "lse-head");
    var title = el("div", "lse-title");
    title.innerHTML =
      'ה-<span dir="ltr">TCP/IP</span> Stack — לחצו על שכבה כדי לפתוח אותה';
    head.appendChild(title);
    root.appendChild(head);

    /* ---- main grid: stack (left) + detail panel (right) ---- */
    var grid = el("div", "lse-grid");
    root.appendChild(grid);

    /* ===== LEFT: the interactive host stack (SVG) ===== */
    var stackWrap = el("div", "lse-stack-wrap");
    grid.appendChild(stackWrap);

    var W = 340, rowH = 62, gap = 10, padTop = 8;
    var chanH = 34;
    var H = padTop + LAYERS.length * (rowH + gap) + chanH + 8;
    var s = svg("svg", {
      viewBox: "0 0 " + W + " " + H,
      width: "100%",
      role: "group",
      "aria-label": "מגש שכבות TCP/IP של מארח (host) — 5 שכבות"
    });
    s.classList.add("lse-svg");
    stackWrap.appendChild(s);

    // "host" bracket label on the side
    var hostLabel = el("div", "lse-hostlabel", "מארח (host)");
    stackWrap.appendChild(hostLabel);

    var rowNodes = [];
    var flowDot = null;

    LAYERS.forEach(function (L, i) {
      var y = padTop + i * (rowH + gap);
      var g = svg("g", { class: "lse-row", tabindex: "0", role: "button" });
      g.setAttribute("data-key", L.key);
      g.setAttribute("aria-label",
        L.name + " — שכבה " + L.num + ", יחידת נתונים " + L.pdu);

      var rect = svg("rect", {
        x: 12, y: y, width: W - 24, height: rowH, rx: 12,
        fill: L.fill, stroke: L.color, "stroke-width": 2
      });
      g.appendChild(rect);

      // colour chip on the trailing (left, since RTL) edge
      var chip = svg("rect", {
        x: 12, y: y, width: 10, height: rowH,
        rx: 5, fill: L.color
      });
      g.appendChild(chip);

      // layer number badge (LTR numeral, kept on the right edge visually)
      var badge = svg("circle", {
        cx: W - 34, cy: y + rowH / 2, r: 14,
        fill: C.surface, stroke: L.color, "stroke-width": 2
      });
      g.appendChild(badge);
      var badgeT = svg("text", {
        x: W - 34, y: y + rowH / 2 + 5,
        "text-anchor": "middle", class: "lse-badge-t",
        fill: L.color
      });
      badgeT.textContent = String(L.num);
      g.appendChild(badgeT);

      // English layer name (LTR)
      var nameT = svg("text", {
        x: W - 58, y: y + 26, "text-anchor": "end",
        class: "lse-name", fill: C.ink, direction: "ltr"
      });
      nameT.textContent = L.name;
      g.appendChild(nameT);

      // protocols (LTR mono)
      var protoT = svg("text", {
        x: W - 58, y: y + 46, "text-anchor": "end",
        class: "lse-proto", fill: C.inkSoft, direction: "ltr"
      });
      protoT.textContent = L.protos;
      g.appendChild(protoT);

      // PDU pill (LTR) — the unit this layer emits
      var pduG = svg("g", { class: "lse-pdu" });
      var pduW = 78;
      var pduRect = svg("rect", {
        x: 30, y: y + rowH / 2 - 13, width: pduW, height: 26, rx: 13,
        fill: L.color, opacity: "0.16", stroke: L.color, "stroke-width": 1.2
      });
      pduG.appendChild(pduRect);
      var pduT = svg("text", {
        x: 30 + pduW / 2, y: y + rowH / 2 + 4,
        "text-anchor": "middle", class: "lse-pdu-t",
        fill: L.color, direction: "ltr"
      });
      pduT.textContent = L.pdu;
      pduG.appendChild(pduT);
      g.appendChild(pduG);

      s.appendChild(g);

      rowNodes.push({ L: L, g: g, rect: rect, y: y, cy: y + rowH / 2 });

      var activate = function () { select(L.key); };
      g.addEventListener("click", activate);
      g.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); activate(); }
        else if (ev.key === "ArrowDown") { ev.preventDefault(); focusRow(i + 1); }
        else if (ev.key === "ArrowUp") { ev.preventDefault(); focusRow(i - 1); }
      });
    });

    function focusRow(i) {
      if (i < 0 || i >= rowNodes.length) return;
      rowNodes[i].g.focus();
    }

    // physical channel bar at the bottom
    var chY = padTop + LAYERS.length * (rowH + gap) + 2;
    var chan = svg("rect", {
      x: 12, y: chY, width: W - 24, height: chanH, rx: 10,
      fill: "#EDE6D8", stroke: C.line, "stroke-width": 1.5,
      "stroke-dasharray": "5 5"
    });
    s.appendChild(chan);
    var chanT = svg("text", {
      x: W / 2, y: chY + chanH / 2 + 4, "text-anchor": "middle",
      class: "lse-chan-t", fill: C.inkSoft
    });
    chanT.textContent = "ערוץ תקשורת פיזי — קווי / אלחוטי";
    s.appendChild(chanT);

    // travelling encapsulation dot (used by the "send" animation)
    flowDot = svg("circle", { cx: -20, cy: -20, r: 8, fill: C.dustyBlue,
      opacity: "0", class: "lse-flowdot" });
    s.appendChild(flowDot);
    var flowLabel = svg("text", { x: -40, y: -40, class: "lse-flowlabel",
      "text-anchor": "middle", fill: C.dustyBlue, opacity: "0", direction: "ltr" });
    s.appendChild(flowLabel);

    /* ===== RIGHT: detail panel ===== */
    var panel = el("div", "lse-panel");
    panel.setAttribute("aria-live", "polite");
    grid.appendChild(panel);

    /* ---- controls (CONTRACT: .viz-controls + .viz-btn) ---- */
    var controls = el("div", "viz-controls");
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "פקדים");

    var btnSend = el("button", "viz-btn primary");
    btnSend.type = "button";
    btnSend.innerHTML = '▶ שליחה: encapsulation מטה';

    var btnPeer = el("button", "viz-btn");
    btnPeer.type = "button";
    btnPeer.setAttribute("aria-pressed", "false");
    btnPeer.textContent = "שכבה↔שכבה (peer)";

    var btnReset = el("button", "viz-btn");
    btnReset.type = "button";
    btnReset.textContent = "איפוס";

    controls.appendChild(btnSend);
    controls.appendChild(btnPeer);
    controls.appendChild(btnReset);
    root.appendChild(controls);

    /* ---- peer-exchange overlay caption (below controls) ---- */
    var peerBar = el("div", "lse-peerbar");
    peerBar.hidden = true;
    peerBar.innerHTML =
      'עיקרון ה-<b>peer</b>: כל שכבה "משוחחת" עם השכבה המקבילה בצד השני — ' +
      '<span dir="ltr">same layer ↔ same layer</span>.';
    root.appendChild(peerBar);

    /* ================= state & behaviour ================= */
    var current = null;
    var peerOn = false;
    var animTimers = [];

    function clearTimers() {
      animTimers.forEach(function (t) { clearTimeout(t); });
      animTimers = [];
    }

    function select(key) {
      current = key;
      rowNodes.forEach(function (r) {
        var on = r.L.key === key;
        r.g.classList.toggle("is-active", on);
        r.rect.setAttribute("stroke-width", on ? 3.5 : 2);
      });
      renderPanel(key);
    }

    function renderPanel(key) {
      var L = null;
      for (var i = 0; i < LAYERS.length; i++) if (LAYERS[i].key === key) L = LAYERS[i];
      panel.innerHTML = "";
      if (!L) { return; }

      var badge = el("div", "lse-p-badge");
      badge.style.setProperty("--lc", L.color);
      badge.innerHTML =
        '<span class="lse-p-num">' + L.num + '</span>' +
        '<span class="lse-p-names"><span class="lse-p-en" dir="ltr">' + L.name +
        '</span><span class="lse-p-he">' + L.he + '</span></span>';
      panel.appendChild(badge);

      // stat row: PDU + where implemented
      var stats = el("div", "lse-stats");

      var stPdu = el("div", "lse-stat");
      stPdu.innerHTML =
        '<span class="lse-stat-k">יחידת נתונים (PDU)</span>' +
        '<span class="lse-stat-v"><b dir="ltr">' + L.pdu + '</b> · ' + L.pduHe + '</span>';
      stats.appendChild(stPdu);

      var stWhere = el("div", "lse-stat");
      stWhere.innerHTML =
        '<span class="lse-stat-k">היכן מיושם</span>' +
        '<span class="lse-stat-v"><span class="lse-where-tag" dir="ltr">' +
        L.whereTag + '</span> ' + L.where + '</span>';
      stats.appendChild(stWhere);

      var stProto = el("div", "lse-stat");
      stProto.innerHTML =
        '<span class="lse-stat-k">פרוטוקולים</span>' +
        '<span class="lse-stat-v" dir="ltr" style="text-align:right">' + L.protos + '</span>';
      stats.appendChild(stProto);

      var stPeer = el("div", "lse-stat");
      stPeer.innerHTML =
        '<span class="lse-stat-k">חילופין peer</span>' +
        '<span class="lse-stat-v"><span dir="ltr">' + L.peer + '</span> — ' +
        '<span dir="ltr">' + L.peerPdu + '</span></span>';
      stats.appendChild(stPeer);

      panel.appendChild(stats);

      var role = el("p", "lse-role", L.role);
      panel.appendChild(role);

      if (L.note) {
        var note = el("div", "lse-note");
        note.style.setProperty("--lc", L.color);
        note.innerHTML = '<span class="lse-note-i" aria-hidden="true">✎</span>' +
          '<span>' + L.note + '</span>';
        panel.appendChild(note);
      }
    }

    /* ---- SEND animation: dot travels top→bottom, growing (encapsulation) ---- */
    function playSend() {
      clearTimers();
      stopPeer();
      btnSend.disabled = true;
      var stepDur = reduceMotion ? 1 : 520;

      var seq = rowNodes.slice(); // top→bottom
      var i = 0;

      function step() {
        if (i >= seq.length) {
          // finally to the physical channel
          moveDot(W / 2, chY + chanH / 2, "signal", C.dustyBlue);
          animTimers.push(setTimeout(function () {
            fadeDot();
            btnSend.disabled = false;
          }, stepDur));
          return;
        }
        var r = seq[i];
        // highlight the row being wrapped
        rowNodes.forEach(function (rn) {
          rn.g.classList.toggle("is-wrapping", rn === r);
        });
        select(r.L.key);
        moveDot(W / 2, r.cy, r.L.pdu, r.L.color);
        // grow radius to suggest headers being added
        flowDot.setAttribute("r", String(8 + i * 1.6));
        i++;
        animTimers.push(setTimeout(step, stepDur));
      }

      if (reduceMotion) {
        // no motion: just show the final encapsulated state instantly
        rowNodes.forEach(function (rn) { rn.g.classList.remove("is-wrapping"); });
        select("phy");
        fadeDot();
        btnSend.disabled = false;
        announce("שליחה: ההודעה נעטפה שכבה-אחר-שכבה עד ל-frame ואות פיזי.");
        return;
      }
      step();
    }

    function moveDot(x, y, label, color) {
      flowDot.setAttribute("fill", color);
      flowDot.setAttribute("opacity", "1");
      flowDot.setAttribute("cx", String(x));
      flowDot.setAttribute("cy", String(y));
      flowLabel.setAttribute("fill", color);
      flowLabel.setAttribute("opacity", "1");
      flowLabel.setAttribute("x", String(x + 96));
      flowLabel.setAttribute("y", String(y + 4));
      flowLabel.textContent = label;
    }
    function fadeDot() {
      flowDot.setAttribute("opacity", "0");
      flowLabel.setAttribute("opacity", "0");
      flowDot.setAttribute("cx", "-20"); flowDot.setAttribute("cy", "-20");
      flowDot.setAttribute("r", "8");
      rowNodes.forEach(function (rn) { rn.g.classList.remove("is-wrapping"); });
    }

    /* ---- PEER mode: show horizontal same-layer arrows ---- */
    function startPeer() {
      peerOn = true;
      btnPeer.setAttribute("aria-pressed", "true");
      btnPeer.classList.add("primary");
      peerBar.hidden = false;
      root.classList.add("peer-on");
      rowNodes.forEach(function (r) { r.g.classList.add("peer-glow"); });
    }
    function stopPeer() {
      peerOn = false;
      btnPeer.setAttribute("aria-pressed", "false");
      btnPeer.classList.remove("primary");
      peerBar.hidden = true;
      root.classList.remove("peer-on");
      rowNodes.forEach(function (r) { r.g.classList.remove("peer-glow"); });
    }

    function announce(msg) {
      panel.setAttribute("data-say", msg); // aria-live already on panel; also flash
      var a = el("p", "lse-role");
      a.style.margin = ".4rem 0 0";
      a.textContent = msg;
      panel.appendChild(a);
    }

    /* ---- wire controls ---- */
    btnSend.addEventListener("click", playSend);
    btnPeer.addEventListener("click", function () {
      if (peerOn) stopPeer(); else startPeer();
    });
    btnReset.addEventListener("click", function () {
      clearTimers();
      stopPeer();
      fadeDot();
      btnSend.disabled = false;
      select("app");
      rowNodes.forEach(function (rn) { rn.g.classList.remove("is-wrapping"); });
    });

    // initial selection: Application layer (top of the stack)
    select("app");
  }

  /* ================================================================ *
   * STYLES (scoped, injected once)                                    *
   * ================================================================ */
  function injectStyles() {
    if (document.getElementById("lse-styles")) return;
    var css =
"" +
".lse-root{--lse-blue:#6E8CA0;font-family:inherit;color:#33302B;}" +
".lse-head{margin-bottom:.85rem;}" +
".lse-title{font-weight:700;font-size:1rem;color:#33302B;}" +
".lse-title span[dir=ltr]{font-weight:800;}" +
".lse-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:1.1rem;align-items:start;}" +
"@media(max-width:640px){.lse-grid{grid-template-columns:1fr;}}" +

/* stack */
".lse-stack-wrap{position:relative;}" +
".lse-svg{display:block;overflow:visible;}" +
".lse-hostlabel{position:absolute;top:-2px;inset-inline-start:4px;font-size:.68rem;font-weight:600;color:#6B655C;background:#FBF5EA;border:1px solid #E7DECF;border-radius:99px;padding:1px 8px;pointer-events:none;}" +
".lse-row{cursor:pointer;outline:none;transition:transform .18s ease;}" +
".lse-row rect{transition:stroke-width .15s ease,filter .18s ease;}" +
".lse-row:hover{transform:translateX(-3px);}" +
".lse-row:focus-visible rect:first-of-type{stroke:#6E8CA0;}" +
".lse-row:focus-visible{outline:2px solid #6E8CA0;outline-offset:3px;border-radius:12px;}" +
".lse-row.is-active rect:first-of-type{filter:drop-shadow(0 3px 8px rgba(120,100,70,.22));}" +
".lse-row.is-wrapping rect:first-of-type{filter:drop-shadow(0 0 0 2px rgba(110,140,160,.35));}" +
".lse-name{font-size:14px;font-weight:700;}" +
".lse-proto{font-size:11px;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;}" +
".lse-badge-t{font-size:13px;font-weight:800;font-family:'JetBrains Mono',ui-monospace,monospace;}" +
".lse-pdu-t{font-size:12px;font-weight:700;font-family:'JetBrains Mono',ui-monospace,monospace;}" +
".lse-chan-t{font-size:10.5px;font-weight:600;}" +
".lse-flowlabel{font-size:12px;font-weight:800;font-family:'JetBrains Mono',ui-monospace,monospace;}" +
".lse-flowdot{transition:cx .5s cubic-bezier(.4,0,.2,1),cy .5s cubic-bezier(.4,0,.2,1),r .5s ease,fill .3s ease;}" +

/* peer glow */
".peer-on .lse-row.peer-glow rect:first-of-type{stroke-dasharray:6 4;animation:lse-dash 1.1s linear infinite;}" +
"@keyframes lse-dash{to{stroke-dashoffset:-20;}}" +

/* panel */
".lse-panel{background:#FBF5EA;border:1px solid #E7DECF;border-radius:14px;padding:1rem 1.05rem;min-height:200px;}" +
".lse-p-badge{display:flex;align-items:center;gap:.7rem;margin-bottom:.7rem;}" +
".lse-p-num{--lc:#6E8CA0;flex:0 0 auto;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;font-weight:800;font-size:1.05rem;color:#fff;background:var(--lc);font-family:'JetBrains Mono',ui-monospace,monospace;}" +
".lse-p-badge{--lc:#6E8CA0;}" +
".lse-p-badge .lse-p-num{background:var(--lc);}" +
".lse-p-names{display:flex;flex-direction:column;line-height:1.15;}" +
".lse-p-en{font-weight:800;font-size:1.02rem;}" +
".lse-p-he{font-size:.8rem;color:#6B655C;}" +
".lse-stats{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin:.2rem 0 .7rem;}" +
"@media(max-width:400px){.lse-stats{grid-template-columns:1fr;}}" +
".lse-stat{background:#FFFDF8;border:1px solid #E7DECF;border-radius:10px;padding:.45rem .55rem;}" +
".lse-stat-k{display:block;font-size:.68rem;color:#6B655C;font-weight:600;margin-bottom:.15rem;}" +
".lse-stat-v{display:block;font-size:.82rem;line-height:1.35;}" +
".lse-stat-v b{font-family:'JetBrains Mono',ui-monospace,monospace;}" +
".lse-where-tag{display:inline-block;font-size:.68rem;font-weight:700;background:#EDE6D8;border-radius:5px;padding:0 5px;font-family:'JetBrains Mono',ui-monospace,monospace;}" +
".lse-role{font-size:.86rem;line-height:1.55;color:#33302B;margin:.1rem 0 0;}" +
".lse-note{--lc:#C9A24B;display:flex;gap:.5rem;align-items:flex-start;margin-top:.7rem;padding:.5rem .6rem;background:#FFFDF8;border-inline-start:3px solid var(--lc);border-radius:8px;font-size:.8rem;line-height:1.45;color:#6B655C;}" +
".lse-note-i{color:var(--lc);font-weight:800;}" +

/* peer bar */
".lse-peerbar{margin-top:.7rem;font-size:.82rem;line-height:1.5;color:#6B655C;background:#FFFDF8;border:1px dashed #E7DECF;border-radius:10px;padding:.55rem .7rem;}" +
".lse-peerbar b{color:#33302B;}" +

"@media(prefers-reduced-motion:reduce){.lse-row,.lse-row rect,.lse-flowdot{transition:none!important;}.peer-on .lse-row.peer-glow rect:first-of-type{animation:none!important;}}";

    var st = document.createElement("style");
    st.id = "lse-styles";
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ================================================================ *
   * MOUNT                                                             *
   * ================================================================ */
  function boot() {
    var mounts = document.querySelectorAll('[data-viz="layer-stack-explorer"]');
    if (!mounts.length) return; // degrade gracefully
    mounts.forEach(function (m) {
      try { render(m); }
      catch (err) {
        if (window.console && console.error) {
          console.error("[layer-stack-explorer] render failed:", err);
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
