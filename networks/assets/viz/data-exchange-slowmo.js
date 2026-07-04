/* =====================================================================
   data-exchange-slowmo.js  —  Module 07 "העברת מידע אמינה (RDT) — תרחיש A"
   Grounded in _notes/congestion-rdt.md  חלק ב' (§10–17, "Diagram B"):
   TCP Data Exchange / RDT Scenario A — Chrome sends a 2000-byte GET to
   an Apache server, in the lecturer's "slow-motion movie" walkthrough.

   Exact model constants from the notes:
     MSS = 1460
     ISN (Chrome) = 1,000,000  →  first DATA byte = 1,000,001
     seg #1 : payload 1460 B, Sequence Number = 1,000,001
     seg #2 : payload  540 B, Sequence Number = 1,001,461  (=1,000,001+1460)
     rwnd advertised by server = 65,535 ; cwnd = 10 MSS = 14,600
     Send Window = min(rwnd, cwnd) = 14,600  → both segments sent together
     copies kept in sk_sndbuf as "בני ערובה" + Retransmission Timer (RTO)
     Receiver: checksum OK → in-order → RCV.NXT 1,000,001 → 1,002,001
     Cumulative ACK: pure ACK segment, Payload=0, ACK flag=1,
                     Acknowledgment Number = 1,002,001
     Client deletes segments from sndbuf + computes SampleRTT → EstRTT/RTO

   Loss toggle (lecturer's suggested interactive dynamic, §15 critical note):
     if seg #1 is LOST and only seg #2 arrives → receiver ACKs 1,000,001
     (still asking for the missing byte) and stores seg #2 OUT-OF-ORDER
     (a "hole"), which triggers retransmission (and SACK — "תסריט ב'").

   Self-contained IIFE. Hand-authored SVG/DOM. No external deps.
   Cream design tokens hardcoded (CONTRACT §2). RTL-aware; English LTR.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "data-exchange-slowmo";

  /* --- design palette (hardcoded per CONTRACT §2) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",   /* dusty-blue — day-2 uses clay, but blue = sender */
    clay: "#BE7C5E",   /* day-2 accent — loss / retransmit / alerts */
    sage: "#7C9885",   /* success / ACK / receiver-OK */
    mustard: "#C9A24B" /* segments / data in flight */
  };

  var SVGNS = "http://www.w3.org/2000/svg";

  /* model constants (verbatim from the notes) */
  var MSS = 1460;
  var ISN = 1000000;
  var SEG1_SEQ = ISN + 1;            /* 1,000,001 */
  var SEG1_LEN = 1460;
  var SEG2_SEQ = SEG1_SEQ + SEG1_LEN;/* 1,001,461 */
  var SEG2_LEN = 540;
  var RCVNXT_INIT = SEG1_SEQ;        /* server expects 1,000,001 */
  var ACK_OK = SEG2_SEQ + SEG2_LEN;  /* 1,002,001 (cumulative, all 2000B) */
  var RWND = 65535;
  var CWND = 14600;                  /* 10 MSS */

  function fmt(n) { return n.toLocaleString("en-US"); }
  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* =====================================================================
     STEP MODELS.  Two ordered scripts share the same scene: the "happy
     path" (No Loss) and the "loss of seg #1" branch.  Each step declares
     which visual state the scene should be in + a Hebrew explanation.
     ===================================================================== */

  /* keys the scene understands (see applyState) */
  function step(o) { return o; }

  var STEPS_OK = [
    step({
      badge: "send()", color: C.blue,
      title: "1 · Chrome קורא ל-send() — היצרן מזרים לקרנל",
      body: "ה-thread של <b>Chrome</b> ב-<span dir=\"ltr\">user space</span> סיים לבנות מחרוזת " +
        "<b dir=\"ltr\">GET</b> בגודל <b>2000 בתים</b> ומבצע <code dir=\"ltr\">send(fd, buffer, 2000, 0)</code>. " +
        "המעבד קופץ מ-<span dir=\"ltr\">Ring 3</span> ל-<span dir=\"ltr\">Ring 0</span>: " +
        "הקרנל מעתיק את 2000 הבתים אל <b dir=\"ltr\">sk_sndbuf</b> (128KB — שפע מקום).",
      state: { copied: true }
    }),
    step({
      badge: "Segmentation", color: C.mustard,
      title: "2 · חיתוך לסגמנטים + ניהול הרצף",
      body: "ה-MSS מול השרת הוא <b dir=\"ltr\">1460</b>, לכן הקרנל „חותך” את 2000 הבתים לשני " +
        "<span dir=\"ltr\">sk_buff</span>:<br>" +
        "• <b>סגמנט 1</b> — 1460B, <span dir=\"ltr\">Seq = " + fmt(SEG1_SEQ) + "</span><br>" +
        "• <b>סגמנט 2</b> — 540B, <span dir=\"ltr\">Seq = " + fmt(SEG2_SEQ) + "</span> " +
        "(= " + fmt(SEG1_SEQ) + " + 1460).<br>" +
        "<b>המספר הסידורי = האינדקס של הבית הראשון בסגמנט</b>, לא „מספר החבילה”. " +
        "לכל סגמנט מחושב <b>Checksum</b> (התחייבות No Error).",
      state: { segmented: true }
    }),
    step({
      badge: "min(rwnd, cwnd)", color: C.blue,
      title: "3 · בקרת זרימה + בקרת עומסים",
      body: "לפני „ירי” הסגמנטים החוצה, הקרנל בודק שני פרמטרים:<br>" +
        "• <b dir=\"ltr\">rwnd</b> = " + fmt(RWND) + " (הצהיר השרת ב-SYN-ACK) — <b>Flow Control</b><br>" +
        "• <b dir=\"ltr\">cwnd</b> = " + fmt(CWND) + " (10 MSS, חלון התחלתי) — <b>Congestion Control</b><br>" +
        "<span dir=\"ltr\">Send Window = min(" + fmt(RWND) + ", " + fmt(CWND) + ") = " + fmt(CWND) + "</span>. " +
        "מכיוון ש-2000 &lt; 14,600 → <b>שני הסגמנטים נשלחים יחד ומיד</b> (Pipelining — בלי להמתין ל-ACK של הראשון).",
      state: { segmented: true, windowChecked: true }
    }),
    step({
      badge: "transmit", color: C.mustard,
      title: "4 · שידור + „בני ערובה” ב-Buffer + טיימר RTO",
      body: "שני הסגמנטים יוצאים אל ה-<span dir=\"ltr\">NIC</span> וטסים ברשת אל השרת. " +
        "<b>קריטי ל-RDT:</b> העותקים <b>לא נמחקים</b> מ-<span dir=\"ltr\">sk_sndbuf</span> — הם נשמרים " +
        "כ„בני ערובה” למקרה שילכו לאיבוד, ועליהם מופעל <b dir=\"ltr\">Retransmission Timer (RTO)</b>. " +
        "המצביעים: <span dir=\"ltr\">SND.UNA</span> = " + fmt(SEG1_SEQ) + " (הישן שטרם אושר), " +
        "<span dir=\"ltr\">SND.NXT</span> = " + fmt(ACK_OK) + " (הבא לשידור).",
      state: { segmented: true, windowChecked: true, inFlight: [1, 2], timer: true,
               sndUna: SEG1_SEQ, sndNxt: ACK_OK }
    }),
    step({
      badge: "No Error + In-Order", color: C.sage,
      title: "5 · נחיתה בשרת — Checksum + סדר",
      body: "שני הסגמנטים מגיעים ל-NIC של <b>Apache</b> ופסיקת <span dir=\"ltr\">SoftIRQ</span> " +
        "מקפיצה אותם לקרנל. הקרנל <b>מחשב מחדש Checksum</b> — תואם → <b>No Error</b>. " +
        "בודק רצף: סגמנט 1 = " + fmt(SEG1_SEQ) + " (בדיוק מה שציפה לו <span dir=\"ltr\">RCV.NXT</span>), " +
        "סגמנט 2 = " + fmt(SEG2_SEQ) + " (ממשיך אותו) → <b>In-Order</b>. " +
        "<span dir=\"ltr\">RCV.NXT</span> מקודם ל-<b>" + fmt(ACK_OK) + "</b>, והנתונים נשמרים ב-" +
        "<span dir=\"ltr\">sk_rcvbuf</span>.",
      state: { segmented: true, delivered: [1, 2], rcvNxt: ACK_OK,
               sndUna: SEG1_SEQ, sndNxt: ACK_OK, timer: true }
    }),
    step({
      badge: "Cumulative ACK", color: C.sage,
      title: "6 · האישור המצטבר חוזר",
      body: "השרת מייצר <b>סגמנט ACK טהור</b> — <span dir=\"ltr\">Payload = 0</span> " +
        "(אין עדיין תשובת HTTP → אין Piggybacking אמיתי), <span dir=\"ltr\">ACK flag = 1</span>, ו-" +
        "<b dir=\"ltr\">Acknowledgment Number = " + fmt(ACK_OK) + "</b>.<br>" +
        "<b>Cumulative ACK:</b> „קיבלתי את כל הבתים ברצף עד " + fmt(ACK_OK - 1) + ", " +
        "כעת אני מצפה ל-" + fmt(ACK_OK) + "”. TCP מאשר <b>רצף בתים</b>, לא „חבילות”.",
      state: { segmented: true, delivered: [1, 2], rcvNxt: ACK_OK,
               ackInFlight: ACK_OK, sndUna: SEG1_SEQ, sndNxt: ACK_OK, timer: true }
    }),
    step({
      badge: "cleanup + RTT", color: C.blue,
      title: "7 · ניקוי Buffer + חישוב RTT דינמי",
      body: "ה-ACK מגיע לקרנל של Chrome. מ-<span dir=\"ltr\">Ack# = " + fmt(ACK_OK) + "</span> " +
        "הוא מבין ששני „בני הערובה” הגיעו בבטחה → <b>מוחק אותם מ-sk_sndbuf</b> " +
        "(<span dir=\"ltr\">SND.UNA</span> מתקדם ל-" + fmt(ACK_OK) + ") ומכבה את טיימר ה-RTO. " +
        "מודד <span dir=\"ltr\">SampleRTT</span> ומעדכן:<br>" +
        "<span dir=\"ltr\">EstimatedRTT = 0.875·EstimatedRTT + 0.125·SampleRTT</span><br>" +
        "<span dir=\"ltr\">RTO = EstimatedRTT + 4·DevRTT</span>.",
      state: { segmented: true, acked: [1, 2], rcvNxt: ACK_OK,
               sndUna: ACK_OK, sndNxt: ACK_OK, timer: false, rttDone: true }
    })
  ];

  var STEPS_LOSS = [
    step({
      badge: "send()", color: C.blue,
      title: "1 · Chrome קורא ל-send() — היצרן מזרים לקרנל",
      body: "כמו בתרחיש התקין: <code dir=\"ltr\">send(fd, buffer, 2000, 0)</code> מעתיק 2000 בתים " +
        "אל <span dir=\"ltr\">sk_sndbuf</span> בקרנל.",
      state: { copied: true }
    }),
    step({
      badge: "Segmentation", color: C.mustard,
      title: "2 · חיתוך לשני סגמנטים",
      body: "• <b>סגמנט 1</b> — 1460B, <span dir=\"ltr\">Seq = " + fmt(SEG1_SEQ) + "</span><br>" +
        "• <b>סגמנט 2</b> — 540B, <span dir=\"ltr\">Seq = " + fmt(SEG2_SEQ) + "</span>. " +
        "שניהם נשלחים יחד (<span dir=\"ltr\">min(rwnd, cwnd) = " + fmt(CWND) + "</span>).",
      state: { segmented: true, windowChecked: true }
    }),
    step({
      badge: "seg #1 LOST", color: C.clay,
      title: "3 · סגמנט 1 הולך לאיבוד ברשת",
      body: "בדרך אל השרת, תור מלא בנתב מפיל את <b>סגמנט 1</b> (<span dir=\"ltr\">Packet Drop</span>). " +
        "רק <b>סגמנט 2</b> (540B, <span dir=\"ltr\">Seq = " + fmt(SEG2_SEQ) + "</span>) ממשיך ומגיע. " +
        "שני העותקים עדיין שמורים ב-<span dir=\"ltr\">sk_sndbuf</span> כ„בני ערובה” עם טיימר RTO פועל.",
      state: { segmented: true, windowChecked: true, inFlight: [2], lost: [1], timer: true,
               sndUna: SEG1_SEQ, sndNxt: ACK_OK }
    }),
    step({
      badge: "Out-of-Order (חור)", color: C.clay,
      title: "4 · השרת מקבל את סגמנט 2 מחוץ לסדר",
      body: "סגמנט 2 עובר Checksum בהצלחה, אבל <span dir=\"ltr\">Seq = " + fmt(SEG2_SEQ) + "</span> " +
        "<b>אינו</b> הערך ש-<span dir=\"ltr\">RCV.NXT</span> ציפה לו (" + fmt(RCVNXT_INIT) + "). " +
        "הקרנל מזהה <b>חור (hole)</b>: הוא <b>שומר את סגמנט 2 מחוץ-לסדר</b> אבל <b>לא</b> מקדם את " +
        "<span dir=\"ltr\">RCV.NXT</span> — הוא נשאר על <b>" + fmt(RCVNXT_INIT) + "</b> (הבית החסר). " +
        "שכבה 5 עדיין לא יכולה לקרוא את הנתונים.",
      state: { segmented: true, delivered: [2], outOfOrder: [2], hole: true,
               rcvNxt: RCVNXT_INIT, sndUna: SEG1_SEQ, sndNxt: ACK_OK, timer: true }
    }),
    step({
      badge: "ACK " + fmt(RCVNXT_INIT), color: C.clay,
      title: "5 · השרת מבקש שוב את הבית שאבד",
      body: "השרת שולח ACK עם <b dir=\"ltr\">Acknowledgment Number = " + fmt(RCVNXT_INIT) + "</b> " +
        "(= RCV.NXT) — <b>„עדיין חסר לי הבית " + fmt(RCVNXT_INIT) + "”</b>. " +
        "זהו לב ה-Cumulative ACK: המספר מצביע על <b>הבית הראשון החסר</b>, לא על מה שכבר הגיע. " +
        "כאן נכנס לתמונה <b dir=\"ltr\">Selective ACK (SACK)</b> — „תסריט ב’” (מחוץ לקבצים אלה).",
      state: { segmented: true, delivered: [2], outOfOrder: [2], hole: true,
               rcvNxt: RCVNXT_INIT, ackInFlight: RCVNXT_INIT, dupAck: true,
               sndUna: SEG1_SEQ, sndNxt: ACK_OK, timer: true }
    }),
    step({
      badge: "Retransmit", color: C.clay,
      title: "6 · שידור חוזר של סגמנט 1 → החור נסגר",
      body: "ה-ACK החוזר (" + fmt(RCVNXT_INIT) + ") מגלה לשולח שסגמנט 1 חסר → הוא <b>משדר מחדש</b> את " +
        "„בן הערובה” סגמנט 1 מ-<span dir=\"ltr\">sk_sndbuf</span>. הפעם הוא מגיע: <span dir=\"ltr\">RCV.NXT</span> " +
        "מקודם ל-<b>" + fmt(ACK_OK) + "</b>, <b>החור נסגר</b>, ושכבה 5 יכולה לקרוא את כל 2000 הבתים ברצף. " +
        "עכשיו נשלח ACK מצטבר <b dir=\"ltr\">" + fmt(ACK_OK) + "</b> והמעגל נסגר.",
      state: { segmented: true, delivered: [1, 2], acked: [1, 2], retransmit: 1,
               rcvNxt: ACK_OK, ackInFlight: ACK_OK, sndUna: ACK_OK, sndNxt: ACK_OK, timer: false }
    })
  ];

  /* =====================================================================
     Scene builder — hand-authored SVG. Two "hosts" (Chrome client kernel
     on the right in RTL reading, Apache server on the left), a network
     lane between them, seq-number pointer readouts, and animated segments.
     The SVG itself is drawn LTR (client left, server right) which is the
     conventional sender→receiver direction; captions are RTL Hebrew.
     ===================================================================== */
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

  var W = 760, H = 360;
  var CLIENT_X = 30, HOST_W = 232;
  var SERVER_X = W - 30 - HOST_W;      /* right host */
  var LANE_TOP = 96, LANE_BOT = 250;   /* vertical band where segments fly */
  var SEG1_Y = 132, SEG2_Y = 186, ACK_Y = 214;

  function buildScene() {
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H, width: "100%",
      role: "img", direction: "ltr",
      "aria-label": "חילופי נתונים בהילוך איטי בין Chrome ל-Apache"
    });
    svg.style.display = "block";
    svg.style.maxWidth = W + "px";
    svg.style.margin = "0 auto";

    var defs = el("defs");
    var mk = function (id, color) {
      var m = el("marker", { id: id, viewBox: "0 0 10 10", refX: "7", refY: "5",
        markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" });
      m.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", fill: color }));
      defs.appendChild(m);
    };
    mk("des-arr-blue", C.blue);
    mk("des-arr-mustard", C.mustard);
    mk("des-arr-sage", C.sage);
    mk("des-arr-clay", C.clay);
    svg.appendChild(defs);

    var g = {};

    /* ---- host cards ---- */
    function hostCard(x, titleTop, titleBot, accent) {
      var card = el("rect", { x: x, y: 40, width: HOST_W, height: 280, rx: 16,
        fill: C.surface2, stroke: C.line, "stroke-width": 2 });
      svg.appendChild(card);
      svg.appendChild(txt(x + HOST_W / 2, 62, titleTop, {
        "text-anchor": "middle", "font-size": 13, "font-weight": 800, fill: C.ink }));
      svg.appendChild(txt(x + HOST_W / 2, 78, titleBot, {
        "text-anchor": "middle", "font-size": 10, fill: C.inkSoft }));
      return card;
    }
    hostCard(CLIENT_X, "Chrome  ·  Client", "user space → kernel (TCP)", C.blue);
    hostCard(SERVER_X, "Apache  ·  Server", "kernel (TCP) → user space", C.sage);

    /* ---- client sk_sndbuf (the send buffer holding "hostages") ---- */
    var sbX = CLIENT_X + 20, sbY = 96, sbW = HOST_W - 40, sbH = 66;
    svg.appendChild(el("rect", { x: sbX, y: sbY, width: sbW, height: sbH, rx: 8,
      fill: C.surface, stroke: C.line, "stroke-width": 1.5 }));
    svg.appendChild(txt(sbX + sbW - 6, sbY + 14, "sk_sndbuf · 128KB", {
      "text-anchor": "end", "font-size": 9.5, fill: C.inkSoft }));
    /* two hostage slots inside sndbuf */
    g.sbSeg = [];
    var slotW = 78;
    [0, 1].forEach(function (i) {
      var sx = sbX + 8 + i * (slotW + 6), sy = sbY + 24;
      var slot = el("rect", { x: sx, y: sy, width: slotW, height: 30, rx: 5,
        fill: "none", stroke: C.line, "stroke-width": 1.2, "stroke-dasharray": "4 3" });
      svg.appendChild(slot);
      var seg = el("rect", { x: sx, y: sy, width: slotW, height: 30, rx: 5,
        fill: C.mustard, opacity: 0 });
      svg.appendChild(seg);
      var lbl = txt(sx + slotW / 2, sy + 19, "seg " + (i + 1), {
        "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: "#fff", opacity: 0 });
      svg.appendChild(lbl);
      g.sbSeg.push({ box: seg, lbl: lbl });
    });

    /* ---- client copied-message block (the 2000B GET) ---- */
    g.msgBlock = el("rect", { x: sbX + 8, y: sbY + 24, width: slotW * 2 + 6, height: 30, rx: 5,
      fill: C.blue, opacity: 0 });
    svg.appendChild(g.msgBlock);
    g.msgLbl = txt(sbX + 8 + slotW + 3, sbY + 43, "GET 2000B", {
      "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: "#fff", opacity: 0 });
    svg.appendChild(g.msgLbl);

    /* ---- client pointer readouts SND.UNA / SND.NXT ---- */
    g.sndUna = txt(sbX, sbY + sbH + 20, "", { "font-size": 10.5, "font-weight": 700, fill: C.blue });
    g.sndNxt = txt(sbX, sbY + sbH + 36, "", { "font-size": 10.5, "font-weight": 700, fill: C.clay });
    svg.appendChild(g.sndUna);
    svg.appendChild(g.sndNxt);

    /* ---- RTO timer chip on the client ---- */
    g.timer = el("g", { opacity: 0 });
    var tchip = el("rect", { x: sbX + sbW - 96, y: sbY + sbH + 6, width: 96, height: 20, rx: 10,
      fill: C.clay });
    g.timer.appendChild(tchip);
    g.timer.appendChild(txt(sbX + sbW - 48, sbY + sbH + 20, "⏱ RTO running", {
      "text-anchor": "middle", "font-size": 9.5, "font-weight": 700, fill: "#fff" }));
    svg.appendChild(g.timer);

    /* ---- server sk_rcvbuf + hole ---- */
    var rbX = SERVER_X + 20, rbY = 96, rbW = HOST_W - 40, rbH = 66;
    svg.appendChild(el("rect", { x: rbX, y: rbY, width: rbW, height: rbH, rx: 8,
      fill: C.surface, stroke: C.line, "stroke-width": 1.5 }));
    svg.appendChild(txt(rbX + 6, rbY + 14, "sk_rcvbuf · 128KB", {
      "text-anchor": "start", "font-size": 9.5, fill: C.inkSoft }));
    g.rbSeg = [];
    [0, 1].forEach(function (i) {
      var rx2 = rbX + 8 + i * (slotW + 6), ry2 = rbY + 24;
      svg.appendChild(el("rect", { x: rx2, y: ry2, width: slotW, height: 30, rx: 5,
        fill: "none", stroke: C.line, "stroke-width": 1.2, "stroke-dasharray": "4 3" }));
      var seg = el("rect", { x: rx2, y: ry2, width: slotW, height: 30, rx: 5,
        fill: C.sage, opacity: 0 });
      svg.appendChild(seg);
      var lbl = txt(rx2 + slotW / 2, ry2 + 19, "seg " + (i + 1), {
        "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: "#fff", opacity: 0 });
      svg.appendChild(lbl);
      g.rbSeg.push({ box: seg, lbl: lbl, x: rx2, y: ry2 });
    });
    /* "hole" marker over slot 1 */
    g.hole = el("g", { opacity: 0 });
    g.hole.appendChild(el("rect", { x: rbX + 8, y: rbY + 24, width: slotW, height: 30, rx: 5,
      fill: "none", stroke: C.clay, "stroke-width": 2, "stroke-dasharray": "5 3" }));
    g.hole.appendChild(txt(rbX + 8 + slotW / 2, rbY + 43, "חור", {
      "text-anchor": "middle", "font-size": 11, "font-weight": 800, fill: C.clay, direction: "rtl" }));
    svg.appendChild(g.hole);

    /* ---- server RCV.NXT readout ---- */
    g.rcvNxt = txt(rbX, rbY + rbH + 20, "", { "font-size": 10.5, "font-weight": 700, fill: C.sage });
    svg.appendChild(g.rcvNxt);

    /* ---- network lane divider + label ---- */
    var laneCx = W / 2;
    svg.appendChild(el("line", { x1: laneCx, y1: 44, x2: laneCx, y2: 316,
      stroke: C.line, "stroke-width": 1.4, "stroke-dasharray": "3 5" }));
    svg.appendChild(txt(laneCx, 306, "network  ·  route (routers / switches)", {
      "text-anchor": "middle", "font-size": 9.5, "font-weight": 600, fill: C.inkSoft }));

    /* ---- travelling segments (fly across the lane) ---- */
    g.fly = {};
    function flySeg(id, color) {
      var grp = el("g", { opacity: 0 });
      var box = el("rect", { x: 0, y: 0, width: 66, height: 26, rx: 6, fill: color });
      var t1 = txt(33, 12, "", { "text-anchor": "middle", "font-size": 10, "font-weight": 800, fill: "#fff" });
      var t2 = txt(33, 22, "", { "text-anchor": "middle", "font-size": 8, fill: "#fff", opacity: 0.9 });
      grp.appendChild(box); grp.appendChild(t1); grp.appendChild(t2);
      svg.appendChild(grp);
      return { grp: grp, t1: t1, t2: t2 };
    }
    g.fly.seg1 = flySeg("s1", C.mustard);
    g.fly.seg2 = flySeg("s2", C.mustard);
    g.fly.ack = flySeg("ack", C.sage);

    /* a "drop" burst marker for a lost segment */
    g.drop = el("g", { opacity: 0 });
    var dcx = laneCx - 60, dcy = SEG1_Y + 13;
    g.drop.appendChild(el("circle", { cx: dcx, cy: dcy, r: 16, fill: "none",
      stroke: C.clay, "stroke-width": 2.5 }));
    g.drop.appendChild(txt(dcx, dcy + 5, "✕", {
      "text-anchor": "middle", "font-size": 18, "font-weight": 800, fill: C.clay }));
    g.drop.appendChild(txt(dcx, dcy + 30, "Packet Drop", {
      "text-anchor": "middle", "font-size": 9, "font-weight": 700, fill: C.clay }));
    svg.appendChild(g.drop);

    /* store geometry for animation */
    g.geom = {
      clientEdge: sbX + sbW,          /* right edge of client buffer */
      serverEdge: rbX,                /* left edge of server buffer */
      slotW: slotW,
      sbSlot0X: sbX + 8, sbSlotY: sbY + 24,
      rbSlot: g.rbSeg.map(function (r) { return { x: r.x, y: r.y }; })
    };

    return { svg: svg, g: g };
  }

  /* =====================================================================
     Apply a static visual state (idempotent — no motion required).
     Used for step-through and as the settled state after any animation.
     ===================================================================== */
  function applyState(scene, s) {
    var g = scene.g;
    s = s || {};
    var op = function (n, v) { if (n) n.setAttribute("opacity", v); };

    /* client message block (before segmentation) */
    var showMsg = s.copied && !s.segmented;
    op(g.msgBlock, showMsg ? 1 : 0);
    op(g.msgLbl, showMsg ? 1 : 0);

    /* which hostages are still held in sndbuf?  held until acked. */
    var acked = s.acked || [];
    [1, 2].forEach(function (n, i) {
      var held = s.segmented && acked.indexOf(n) === -1;
      op(g.sbSeg[i].box, held ? 1 : 0);
      op(g.sbSeg[i].lbl, held ? 1 : 0);
      g.sbSeg[i].box.setAttribute("fill",
        (s.lost && s.lost.indexOf(n) !== -1) ? C.clay : C.mustard);
    });

    /* server rcvbuf: delivered & in place */
    var delivered = s.delivered || [];
    var outOfOrder = s.outOfOrder || [];
    [1, 2].forEach(function (n, i) {
      var here = delivered.indexOf(n) !== -1;
      op(g.rbSeg[i].box, here ? 1 : 0);
      op(g.rbSeg[i].lbl, here ? 1 : 0);
      g.rbSeg[i].box.setAttribute("fill",
        outOfOrder.indexOf(n) !== -1 ? C.mustard : C.sage);
    });
    op(g.hole, s.hole ? 1 : 0);

    /* pointer readouts */
    g.sndUna.textContent = "SND.UNA = " + (s.sndUna != null ? fmt(s.sndUna) : "—");
    g.sndNxt.textContent = "SND.NXT = " + (s.sndNxt != null ? fmt(s.sndNxt) : "—");
    g.rcvNxt.textContent = "RCV.NXT = " + (s.rcvNxt != null ? fmt(s.rcvNxt) : fmt(RCVNXT_INIT));

    /* RTO timer chip */
    op(g.timer, s.timer ? 1 : 0);

    /* travelling segments hidden in the static state (animation shows them) */
    op(g.fly.seg1.grp, 0);
    op(g.fly.seg2.grp, 0);
    op(g.fly.ack.grp, 0);
    op(g.drop, s.lost && s.lost.length && !s.delivered ? 0 : 0);
  }

  /* =====================================================================
     Transient animations for the "slow-motion" feel (respect RM).
     Triggered when entering a step; the scene settles into applyState.
     ===================================================================== */
  function easeInOut(p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }

  function moveGroup(grp, fromX, fromY, toX, toY, dur, done) {
    if (reducedMotion()) {
      grp.setAttribute("transform", "translate(" + toX + "," + toY + ")");
      if (done) done();
      return;
    }
    grp.setAttribute("opacity", 1);
    var start = null;
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var e = easeInOut(p);
      var x = fromX + (toX - fromX) * e;
      var y = fromY + (toY - fromY) * e;
      grp.setAttribute("transform", "translate(" + x + "," + y + ")");
      if (p < 1) requestAnimationFrame(frame);
      else if (done) done();
    }
    requestAnimationFrame(frame);
  }

  function setFly(fly, seq, len, color) {
    fly.grp.querySelector("rect").setAttribute("fill", color);
    fly.t1.textContent = "Seq " + fmt(seq);
    fly.t2.textContent = len + "B";
    fly.t2.setAttribute("opacity", 0.9);
  }
  function setFlyAck(fly, ackNo, isDup) {
    fly.grp.querySelector("rect").setAttribute("fill", isDup ? C.clay : C.sage);
    fly.t1.textContent = "ACK " + fmt(ackNo);
    fly.t2.textContent = "Payload 0";
  }

  /* run the entering animation for a step; calls settle() at the end */
  function animateStep(scene, stepObj, isLoss, settle) {
    var g = scene.g, geom = g.geom;
    var badge = stepObj.badge;
    var startX = geom.clientEdge - 40;
    var endX = geom.serverEdge - 26;

    var hideFly = function () {
      g.fly.seg1.grp.setAttribute("opacity", 0);
      g.fly.seg2.grp.setAttribute("opacity", 0);
      g.fly.ack.grp.setAttribute("opacity", 0);
      g.drop.setAttribute("opacity", 0);
    };
    hideFly();

    if (reducedMotion()) { settle(); return; }

    /* No-Loss: step 4 = both segments fly right */
    if (!isLoss && badge === "transmit") {
      setFly(g.fly.seg1, SEG1_SEQ, SEG1_LEN, C.mustard);
      setFly(g.fly.seg2, SEG2_SEQ, SEG2_LEN, C.mustard);
      moveGroup(g.fly.seg1.grp, startX, SEG1_Y, endX, SEG1_Y, 1200);
      moveGroup(g.fly.seg2.grp, startX, SEG2_Y, endX, SEG2_Y, 1200, function () {
        hideFly(); settle();
      });
      return;
    }
    /* No-Loss: step 6 = ACK flies back left */
    if (!isLoss && badge === "Cumulative ACK") {
      setFlyAck(g.fly.ack, ACK_OK, false);
      moveGroup(g.fly.ack.grp, endX, ACK_Y, startX, ACK_Y, 1100, function () {
        hideFly(); settle();
      });
      return;
    }
    /* Loss: step 3 = seg1 drops mid-lane, seg2 continues */
    if (isLoss && badge === "seg #1 LOST") {
      setFly(g.fly.seg1, SEG1_SEQ, SEG1_LEN, C.clay);
      setFly(g.fly.seg2, SEG2_SEQ, SEG2_LEN, C.mustard);
      var midX = (startX + endX) / 2 - 60;
      moveGroup(g.fly.seg1.grp, startX, SEG1_Y, midX, SEG1_Y, 700, function () {
        g.fly.seg1.grp.setAttribute("opacity", 0);
        g.drop.setAttribute("opacity", 1);
        setTimeout(function () { g.drop.setAttribute("opacity", 0); }, 1200);
      });
      moveGroup(g.fly.seg2.grp, startX, SEG2_Y, endX, SEG2_Y, 1200, function () {
        g.fly.seg2.grp.setAttribute("opacity", 0); settle();
      });
      return;
    }
    /* Loss: step 5 = duplicate/again ACK for the missing byte flies back */
    if (isLoss && badge.indexOf("ACK ") === 0) {
      setFlyAck(g.fly.ack, RCVNXT_INIT, true);
      moveGroup(g.fly.ack.grp, endX, ACK_Y, startX, ACK_Y, 1000, function () {
        hideFly(); settle();
      });
      return;
    }
    /* Loss: step 6 = retransmit seg1 flies right */
    if (isLoss && badge === "Retransmit") {
      setFly(g.fly.seg1, SEG1_SEQ, SEG1_LEN, C.clay);
      moveGroup(g.fly.seg1.grp, startX, SEG1_Y, endX, SEG1_Y, 1200, function () {
        hideFly(); settle();
      });
      return;
    }

    /* default: no travel — settle immediately */
    settle();
  }

  /* =====================================================================
     Render into a mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-des-ready") === "1") return;
    mount.setAttribute("data-des-ready", "1");
    mount.innerHTML = "";

    var mode = "ok";                 /* "ok" | "loss" */
    var idx = 0;
    var autoTimer = null;
    var busy = false;                /* animation in progress guard */

    function steps() { return mode === "loss" ? STEPS_LOSS : STEPS_OK; }

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");

    /* ---- scenario toggle (No Loss / Loss) ---- */
    var toggleRow = document.createElement("div");
    toggleRow.className = "viz-controls";
    toggleRow.style.marginTop = "0";
    toggleRow.style.marginBottom = ".85rem";
    var lblScn = document.createElement("span");
    lblScn.textContent = "תרחיש:";
    lblScn.style.fontWeight = "700";
    lblScn.style.color = C.ink;
    lblScn.style.fontSize = ".9rem";
    toggleRow.appendChild(lblScn);

    var btnOk = mkBtn("✓ ללא אובדן", function () { setMode("ok"); });
    var btnLoss = mkBtn("✕ אובדן סגמנט 1", function () { setMode("loss"); });
    toggleRow.appendChild(btnOk);
    toggleRow.appendChild(btnLoss);
    wrap.appendChild(toggleRow);

    /* ---- scene ---- */
    var scene = buildScene();
    var sceneBox = document.createElement("div");
    sceneBox.style.background = C.surface;
    sceneBox.style.borderRadius = "12px";
    sceneBox.style.padding = "6px 4px";
    sceneBox.appendChild(scene.svg);
    wrap.appendChild(sceneBox);

    /* ---- step rail (clickable chips) ---- */
    var rail = document.createElement("div");
    rail.setAttribute("role", "tablist");
    rail.setAttribute("aria-label", "שלבי חילופי הנתונים");
    rail.style.display = "flex";
    rail.style.flexWrap = "wrap";
    rail.style.gap = "6px";
    rail.style.margin = "14px 0 4px";
    var chips = [];

    /* ---- explanation panel ---- */
    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.background = C.surface2;
    panel.style.border = "1px solid " + C.line;
    panel.style.borderRadius = "12px";
    panel.style.padding = "12px 14px";
    panel.style.marginTop = "10px";
    panel.style.minHeight = "104px";
    panel.style.color = C.ink;
    panel.style.lineHeight = "1.65";
    panel.style.fontSize = ".9rem";

    wrap.appendChild(rail);
    wrap.appendChild(panel);

    /* ---- step controls ---- */
    var controls = document.createElement("div");
    controls.className = "viz-controls";
    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); goto(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); goto(idx + 1); });
    btnNext.classList.add("primary");
    var btnPlay = mkBtn("▶ הילוך איטי", function () { toggleAuto(); });
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

    /* rebuild the step chips for the current mode */
    function buildChips() {
      rail.innerHTML = "";
      chips = steps().map(function (s, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "viz-btn";
        b.setAttribute("role", "tab");
        b.textContent = (i + 1) + "";
        b.title = s.title;
        b.setAttribute("aria-label", s.title);
        b.style.padding = ".2rem .62rem";
        b.style.fontSize = ".82rem";
        b.style.minWidth = "2rem";
        b.addEventListener("click", function () { stopAuto(); goto(i); });
        rail.appendChild(b);
        return b;
      });
    }

    function setMode(m) {
      stopAuto();
      mode = m;
      idx = 0;
      buildChips();
      btnOk.classList.toggle("primary", m === "ok");
      btnLoss.classList.toggle("primary", m === "loss");
      btnOk.setAttribute("aria-pressed", m === "ok" ? "true" : "false");
      btnLoss.setAttribute("aria-pressed", m === "loss" ? "true" : "false");
      goto(0);
    }

    /* ---- navigation ---- */
    function goto(n) {
      var arr = steps();
      idx = Math.max(0, Math.min(arr.length - 1, n));
      var stepObj = arr[idx];
      busy = true;
      /* settle to the target state, then run the entering animation which
         re-settles at the end (keeps final state correct even w/ RM). */
      applyState(scene, stepObj.state);
      animateStep(scene, stepObj, mode === "loss", function () {
        applyState(scene, stepObj.state);
        busy = false;
      });
      renderPanel(stepObj);
      renderChips();
      btnPrev.disabled = (idx === 0);
      btnNext.disabled = (idx === arr.length - 1);
    }

    function renderPanel(s) {
      var html =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px">' +
          '<span style="background:' + s.color + ';color:#fff;font-weight:700;font-size:.72rem;' +
            'padding:2px 10px;border-radius:99px" dir="ltr">' + s.badge + '</span>' +
          '<b style="font-size:1rem;color:' + C.ink + '">' + s.title + '</b>' +
        '</div>' +
        '<div>' + s.body + '</div>';
      panel.innerHTML = html;
    }

    function renderChips() {
      chips.forEach(function (b, i) {
        var active = (i === idx), done = (i < idx);
        var col = steps()[i].color;
        b.setAttribute("aria-selected", active ? "true" : "false");
        if (active) {
          b.style.background = col; b.style.color = "#fff"; b.style.borderColor = col;
        } else if (done) {
          b.style.background = C.surface2; b.style.color = C.ink; b.style.borderColor = col;
        } else {
          b.style.background = C.surface2; b.style.color = C.inkSoft; b.style.borderColor = C.line;
        }
      });
    }

    /* ---- autoplay ("slow motion") ---- */
    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      var arr = steps();
      if (idx >= arr.length - 1) goto(0);
      btnPlay.textContent = "⏸ השהה";
      btnPlay.classList.add("primary");
      var delay = reducedMotion() ? 2200 : 2900;
      autoTimer = setInterval(function () {
        if (idx >= steps().length - 1) { stopAuto(); return; }
        goto(idx + 1);
      }, delay);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      btnPlay.textContent = "▶ הילוך איטי";
      btnPlay.classList.remove("primary");
    }

    /* keyboard: RTL-aware (Right = prev, Left = next) */
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { stopAuto(); goto(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { stopAuto(); goto(idx + 1); e.preventDefault(); }
      else if (e.key === "Home") { stopAuto(); goto(0); e.preventDefault(); }
      else if (e.key === "End") { stopAuto(); goto(steps().length - 1); e.preventDefault(); }
    });

    /* initial paint */
    setMode("ok");
  }

  /* =====================================================================
     boot: mount all instances (guard for already-ready). Never throw.
     ===================================================================== */
  function boot() {
    try {
      var mounts = document.querySelectorAll('[data-viz="' + VIZ_ID + '"]');
      if (!mounts || !mounts.length) return;
      mounts.forEach(function (m) { render(m); });
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
