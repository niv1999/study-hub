/* ============================================================================
 * tcp-header-inspector.js  —  Module 06 · TCP: חיבורים, מכונת המצבים וכותרת ה-Segment
 * ----------------------------------------------------------------------------
 * A bespoke, bit-accurate TCP Segment Format inspector — hover / focus / click a
 * field to reveal its meaning. Grounded ONLY in _notes/tcp.md §9 (The TCP Segment
 * Format) and diagram D6:
 *   IP dg = [IP Hdr | IP Data],  IP Data = [TCP Data | TCP Hdr]
 *   32-bit-wide word map (bit indices 0 · 15 · 31):
 *     [Src port | Dst port]
 *     [Sequence #]                 ← balloon "counting by bytes of data (not segments!)"
 *     [Ack Sequence #]
 *     [HLEN(4) | RSVD(6) | Flags: URG ACK PSH RST SYN FIN | Window Size]
 *     [Checksum | Urg Pointer]
 *     [(TCP Options)]
 *     [TCP Data]
 *   balloons: ports → "Src/dst port numbers and IP addresses uniquely identify socket"
 *             Window → "# bytes rcvr willing to accept"
 *   the 6 flags (tcp2 slides 48-50): URG(generally not used), ACK, PSH(deliver now,
 *             not buffer), RST(reset the connection), SYN, FIN.
 *   the lecturer's quirk (tcp3 slide 146 / §11): HTTPS server port shown as 431
 *             — rendered here as 431 with a "במקור נכתב 431" fidelity note (443 תקני).
 *   Seq# example (§4): byte-level sequencing, ISN, segment Seq = first byte number.
 *
 * Interactive: hover/focus reveals a field; click pins it; a "scenario" switch
 * loads a real segment (SYN / SYN-ACK / DATA to an HTTPS=431 server) and shows how
 * the flags & numbers change; a Seq/Ack byte-counter mini-demo. Real <button>s,
 * keyboard-operable, prefers-reduced-motion respected, degrades if mount absent,
 * throws no console errors.  Self-contained IIFE, no external deps.
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
   * THE MODEL — TCP header fields, in the lecturer's word-map order.    *
   * `bits` = width; each 32-bit word is grouped by `word`.             *
   * ------------------------------------------------------------------ */
  var FIELDS = [
    {
      key: "srcport", word: 0, span: 16, bits: 16, color: C.dustyBlue,
      label: "Src Port", he: "פורט מקור",
      short: "מספר הפורט של התכנית השולחת (16 ביט → 0–65535).",
      role: "מזהה את התכנית (הסוקט) בצד השולח בתוך המארח. יחד עם פורט היעד וכתובות ה-IP — מזהים חד-ערכית את הסוקט.",
      balloon: "Src/dst port numbers and IP addresses uniquely identify socket",
      source: "tcp2 שקף 46"
    },
    {
      key: "dstport", word: 0, span: 16, bits: 16, color: C.dustyBlue,
      label: "Dst Port", he: "פורט יעד",
      short: "מספר הפורט של L5-prot-server (WKPN אם סטנדרטי).",
      role: "מזהה את התכנית ביעד. לשרתים סטנדרטיים נשמרו פורטים 0–1023 (WKPN): HTTP=80, SMTP=25, HTTPS=431.",
      balloon: "Src/dst port numbers and IP addresses uniquely identify socket",
      note431: true,
      source: "tcp3 שקפים 144–146"
    },
    {
      key: "seq", word: 1, span: 32, bits: 32, color: C.sage,
      label: "Sequence #", he: "מספר רצף",
      short: "מספר הבית הראשון בסגמנט — סופר בתים, לא סגמנטים!",
      role: "TCP ממספר את זרם הבתים החל מ-ISN אקראי. מספר הרצף של סגמנט = מספר הבית הראשון בו (למשל Bisn, Bisn+400, Bisn+700) — לא אינדקס הסגמנט.",
      balloon: "counting by bytes of data (not segments!)",
      demo: "seq",
      source: "tcp2 שקף 46 · tcp3 שקפים 48–50"
    },
    {
      key: "ack", word: 2, span: 32, bits: 32, color: C.sage,
      label: "Ack Sequence #", he: "מספר אישור",
      short: "מספר הבית הבא שה-receiver מצפה לקבל (cumulative ACK).",
      role: "בזכות דגל ה-ACK: המקבל מאשר תמיד את מספר הבית הבא שהוא מצפה לו. אם הגיעו בתים מחוץ לסדר — ישלח שוב ושוב את אותו ACK עד סגירת החור (Cumulative ACK).",
      demo: "ack",
      source: "tcp2 שקף 46 · tcp1 עמ' 4"
    },
    {
      key: "hlen", word: 3, span: 4, bits: 4, color: C.mustard,
      label: "HLEN", he: "אורך כותרת",
      short: "אורך כותרת ה-TCP (4 ביט) — כמה מילים של 32 ביט.",
      role: "head len — מציין היכן נגמרת הכותרת ומתחילה ה-TCP Data. נחוץ כי שדה ה-Options משתנה באורכו.",
      source: "tcp2 שקף 46"
    },
    {
      key: "rsvd", word: 3, span: 6, bits: 6, color: C.inkSoft,
      label: "RSVD", he: "שמורים",
      short: "6 ביטים שמורים / not used.",
      role: "ביטים שמורים לשימוש עתידי. במקור המרצה מסומנים 'not used'.",
      source: "tcp2 שקף 46"
    },
    {
      key: "flags", word: 3, span: 6, bits: 6, color: C.clay,
      label: "Flags", he: "דגלים (6)",
      short: "6 דגלי בקרה: URG ACK PSH RST SYN FIN.",
      role: "ששת דגלי הבקרה. בשקף 48 מסודרים U A P R S F. כל דגל הוא ביט אחד שמדליק התנהגות. לחצו על דגל בודד למטה כדי לפתוח אותו.",
      isFlags: true,
      source: "tcp2 שקפים 48–50"
    },
    {
      key: "window", word: 3, span: 16, bits: 16, color: C.dustyBlue,
      label: "Window Size", he: "גודל חלון",
      short: "כמה בתים ה-receiver מוכן לקבל (= rwnd).",
      role: "= חלון הקבלה (rwnd). המקבל מפרסם כמה מקום פנוי נותר בחלון הקבלה שלו — כך פועלת בקרת הזרימה (flow control). אם מתאפס → Zero Window, השולח עוצר.",
      balloon: "# bytes rcvr willing to accept",
      source: "tcp2 שקף 46 · tcp3 שקפים 100–106"
    },
    {
      key: "checksum", word: 4, span: 16, bits: 16, color: C.sage,
      label: "Checksum", he: "סכום ביקורת",
      short: "'חתימת DNA' של הדאטה — לאיתור שיבוש.",
      role: "המקבל מחשב checksum של הדאטה ומשווה לזו שבכותרת. 2 החתימות לא זהות → הסגמנט הגיע משובש → נזרק ונדרש retransmit. בשונה מ-UDP: כאן ה-checksum הוא של הדאטה שבסגמנט.",
      source: "tcp3 שקפים 63–70"
    },
    {
      key: "urgptr", word: 4, span: 16, bits: 16, color: C.mustard,
      label: "Urg Pointer", he: "מצביע דחוף",
      short: "offset לדאטה דחופה (תקף רק כש-URG=1).",
      role: "כאשר URG=1 — מצביע למיקום ב-byte stream (offset ממספר הרצף) שבו נגמרת הדאטה הדחופה: SeqNo ≤ urgent data ≤ SeqNo + urgent pointer.",
      source: "tcp2 שקף 49"
    },
    {
      key: "options", word: 5, span: 32, bits: 0, color: C.inkSoft,
      label: "(TCP Options)", he: "אפשרויות",
      short: "אפשרויות באורך משתנה (MSS, SACK, Window Scaling...).",
      role: "שדה אופציונלי באורך משתנה. כאן מוחלפים פרמטרים בלחיצת היד — למשל MSS ו-SACK. אורכו נלקח בחשבון ב-HLEN.",
      variable: true,
      source: "tcp2 שקף 46"
    },
    {
      key: "data", word: 6, span: 32, bits: 0, color: C.clay,
      label: "TCP Data", he: "נתונים",
      short: "מקטע רציף מזרם הבתים (application data).",
      role: "ה-payload — מקטע רציף מה-byte stream של האפליקציה. סגמנט ללא data (0 בתים, רק כותרת) הוא SYN segment / ACK segment טהור. Data אמיתי מותר רק במצב ESTABLISHED.",
      variable: true, isData: true,
      source: "tcp3 שקפים 44–62"
    }
  ];

  /* the 6 flags, in the lecturer's slide-48 order U A P R S F */
  var FLAGS = [
    { key: "URG", he: "Urgent", desc: "מציין ש-Urgent Pointer תקף — דאטה דחופה שיש לטפל בה במהירות. במקור: generally not used." },
    { key: "ACK", he: "Acknowledgment", desc: "מציין ששדה ה-Ack Sequence # תקף. דולק כמעט תמיד אחרי לחיצת היד (חלק מ-piggybacking)." },
    { key: "PSH", he: "Push", desc: "התראה למקבל למסור את הדאטה לאפליקציה מיד עם הגעתה — ולא לאגור (not buffer)." },
    { key: "RST", he: "Reset", desc: "מאלץ את המקבל לאפס/לסגור את החיבור. משמש כשהחיבור 'מבולבל' (confused) או לא ניתן להקמה." },
    { key: "SYN", he: "Synchronize", desc: "פותח חיבור ומסנכרן מספרי רצף (ISN). דולק ב-SYN וב-SYN-ACK של לחיצת היד." },
    { key: "FIN", he: "Finish", desc: "מבקש לסגור את כיוון השליחה שלי (graceful shutdown). מפעיל את מכונת המצבים לכיוון teardown." }
  ];

  /* ------------------------------------------------------------------ *
   * SCENARIOS — real segments, byte-level numbers per the notes' model. *
   * Ports use the lecturer's HTTPS=431 quirk. Seq/Ack per §4 + §10.2.    *
   * ------------------------------------------------------------------ */
  var SCENARIOS = {
    syn: {
      name: "SYN — לקוח פותח חיבור",
      caption: "שלב 1 בלחיצת היד: הלקוח שולח SYN עם ISN=100, ללא data. יעד: HTTPS server (פורט 431).",
      values: {
        srcport: "49152", dstport: "431", seq: "100", ack: "0",
        hlen: "6", window: "64240", checksum: "0x8f2a", urgptr: "0",
        options: "MSS=1460, SACK", data: "— (0 bytes)"
      },
      flags: { URG: 0, ACK: 0, PSH: 0, RST: 0, SYN: 1, FIN: 0 }
    },
    synack: {
      name: "SYN-ACK — השרת מגיב",
      caption: "שלב 2: השרת בוחר ISN=500 ומאשר את הלקוח: Ack=101 (הבית הבא). SYN+ACK משולבים ב-piggybacking.",
      values: {
        srcport: "431", dstport: "49152", seq: "500", ack: "101",
        hlen: "6", window: "65535", checksum: "0x1c74", urgptr: "0",
        options: "MSS=1460, SACK", data: "— (0 bytes)"
      },
      flags: { URG: 0, ACK: 1, PSH: 0, RST: 0, SYN: 1, FIN: 0 }
    },
    data: {
      name: "DATA — סגמנט נתונים",
      caption: "מצב ESTABLISHED: הלקוח שולח 500 בתים (בתים 101..600). מאשר את בית 501 של השרת. PSH דולק כדי למסור מיד.",
      values: {
        srcport: "49152", dstport: "431", seq: "101", ack: "501",
        hlen: "5", window: "63740", checksum: "0xa3e1", urgptr: "0",
        options: "—", data: "500 bytes (101..600)"
      },
      flags: { URG: 0, ACK: 1, PSH: 1, RST: 0, SYN: 0, FIN: 0 }
    },
    fin: {
      name: "FIN — סגירה אלגנטית",
      caption: "שלב 3: הלקוח מסיים את כיוונו — שולח FIN (עם ACK על מה שקיבל). מכאן מכונת המצבים עוברת ל-teardown.",
      values: {
        srcport: "49152", dstport: "431", seq: "601", ack: "1401",
        hlen: "5", window: "63740", checksum: "0x77b0", urgptr: "0",
        options: "—", data: "— (0 bytes)"
      },
      flags: { URG: 0, ACK: 1, PSH: 0, RST: 0, SYN: 0, FIN: 1 }
    }
  };

  /* ---------------------------------------------------------------- */
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
    injectStyles();

    var root = el("div", "thi-root");
    root.setAttribute("dir", "rtl");
    mount.appendChild(root);

    var title = el("div", "thi-title");
    title.innerHTML =
      'בוחן כותרת ה-<span dir="ltr">TCP Segment</span> — ריחוף / לחיצה על שדה מציג את תפקידו';
    root.appendChild(title);

    /* ---- context strip: IP dg nesting (from §9 / D6) ---- */
    var ctx = el("div", "thi-ctx");
    ctx.setAttribute("dir", "ltr");
    ctx.innerHTML =
      '<span class="thi-ctx-b thi-ip">IP Hdr</span>' +
      '<span class="thi-ctx-arrow">›</span>' +
      '<span class="thi-ctx-b thi-tcph is-here">TCP Hdr</span>' +
      '<span class="thi-ctx-plus">+</span>' +
      '<span class="thi-ctx-b thi-tcpd">TCP Data</span>' +
      '<span class="thi-ctx-cap">IP dg = [ IP Hdr | IP Data ] &nbsp;·&nbsp; IP Data = [ TCP Hdr | TCP Data ]</span>';
    root.appendChild(ctx);

    /* ---- main grid: bit-map (left) + inspector panel (right) ---- */
    var grid = el("div", "thi-grid");
    root.appendChild(grid);

    /* ===== LEFT: the 32-bit-wide header map ===== */
    var mapWrap = el("div", "thi-mapwrap");
    grid.appendChild(mapWrap);

    // bit ruler 0 .. 15 .. 31
    var ruler = el("div", "thi-ruler");
    ruler.setAttribute("dir", "ltr");
    [["0", 0], ["15", 47], ["16", 50], ["31", 100]].forEach(function (r) {
      var t = el("span", "thi-tick", r[0]);
      t.style.insetInlineStart = r[1] + "%";
      ruler.appendChild(t);
    });
    mapWrap.appendChild(ruler);

    var mapT = el("div", "thi-map");
    mapWrap.appendChild(mapT);

    // group fields into 32-bit words (rows)
    var words = [];
    FIELDS.forEach(function (f) {
      if (!words[f.word]) words[f.word] = [];
      words[f.word].push(f);
    });

    var cellByKey = {};       // key -> DOM cell
    var flagChips = {};       // flag key -> chip

    words.forEach(function (row) {
      var wr = el("div", "thi-word");
      row.forEach(function (f) {
        var cell = el("button", "thi-cell");
        cell.type = "button";
        cell.setAttribute("data-key", f.key);
        cell.style.setProperty("--fc", f.color);
        cell.style.flexGrow = String(f.span);
        cell.style.flexBasis = "0";
        cell.setAttribute("aria-label",
          f.label + " — " + f.he + " (" + (f.bits ? f.bits + " bit" : "variable") + ")");

        var lab = el("span", "thi-cell-label");
        lab.setAttribute("dir", "ltr");
        lab.textContent = f.label;
        cell.appendChild(lab);

        var meta = el("span", "thi-cell-bits");
        meta.setAttribute("dir", "ltr");
        meta.textContent = f.bits ? f.bits + "b" : "var";
        cell.appendChild(meta);

        // value chip (populated by scenarios)
        var val = el("span", "thi-cell-val");
        val.setAttribute("dir", "ltr");
        cell.appendChild(val);
        cell._val = val;

        if (f.isFlags) {
          // render the 6 flag micro-chips inside the flags cell
          var fbox = el("span", "thi-flagbox");
          FLAGS.forEach(function (fl) {
            var chip = el("span", "thi-flagchip", fl.key);
            chip.setAttribute("dir", "ltr");
            chip.setAttribute("data-flag", fl.key);
            fbox.appendChild(chip);
            flagChips[fl.key] = chip;
          });
          cell.appendChild(fbox);
        }
        if (f.variable) cell.classList.add("is-var");
        if (f.isData) cell.classList.add("is-data");

        wr.appendChild(cell);
        cellByKey[f.key] = cell;

        // interactions
        cell.addEventListener("mouseenter", function () { if (!pinned) show(f.key, false); });
        cell.addEventListener("focus", function () { show(f.key, false); });
        cell.addEventListener("click", function () {
          if (pinned === f.key) { pinned = null; show(f.key, false); }
          else { pinned = f.key; show(f.key, true); }
        });
      });
      mapT.appendChild(wr);
    });

    /* ===== RIGHT: inspector panel ===== */
    var panel = el("div", "thi-panel");
    panel.setAttribute("aria-live", "polite");
    grid.appendChild(panel);

    /* ---- controls: scenario switch (CONTRACT: .viz-controls + .viz-btn) ---- */
    var controls = el("div", "viz-controls");
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "טעינת תרחיש סגמנט");
    var cLabel = el("span", "thi-clabel", "טען סגמנט:");
    controls.appendChild(cLabel);

    var scenBtns = {};
    var order = [["blank", "כותרת ריקה"], ["syn", "SYN"], ["synack", "SYN-ACK"], ["data", "DATA"], ["fin", "FIN"]];
    order.forEach(function (o) {
      var b = el("button", "viz-btn");
      b.type = "button";
      b.textContent = o[1];
      b.setAttribute("data-scen", o[0]);
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () { loadScenario(o[0]); });
      controls.appendChild(b);
      scenBtns[o[0]] = b;
    });
    root.appendChild(controls);

    /* ---- scenario caption bar ---- */
    var scenBar = el("div", "thi-scenbar");
    scenBar.hidden = true;
    root.appendChild(scenBar);

    /* ================= state & behaviour ================= */
    var pinned = null;
    var activeScen = "blank";

    function clearFieldFx() {
      FIELDS.forEach(function (f) {
        cellByKey[f.key].classList.remove("is-active", "is-pinned");
      });
    }

    function findField(key) {
      for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].key === key) return FIELDS[i];
      return null;
    }

    function show(key, isPinned) {
      var f = findField(key);
      if (!f) return;
      clearFieldFx();
      cellByKey[key].classList.add("is-active");
      if (isPinned) cellByKey[key].classList.add("is-pinned");

      panel.innerHTML = "";

      var head = el("div", "thi-p-head");
      head.style.setProperty("--fc", f.color);
      head.innerHTML =
        '<span class="thi-p-en" dir="ltr">' + f.label + '</span>' +
        '<span class="thi-p-he">' + f.he + '</span>' +
        '<span class="thi-p-bits" dir="ltr">' +
          (f.bits ? f.bits + " bit" : "variable") + '</span>';
      if (isPinned) {
        var pin = el("span", "thi-pin", "📌 מוצמד");
        head.appendChild(pin);
      }
      panel.appendChild(head);

      var role = el("p", "thi-p-role", f.role);
      panel.appendChild(role);

      // lecturer's balloon annotation, if any (LTR technical text)
      if (f.balloon) {
        var bl = el("div", "thi-balloon");
        bl.innerHTML =
          '<span class="thi-balloon-tag">בלון המרצה</span>' +
          '<span dir="ltr" class="thi-balloon-txt">' + f.balloon + '</span>';
        panel.appendChild(bl);
      }

      // HTTPS=431 fidelity note on the destination port
      if (f.note431) {
        var n = el("div", "thi-note431");
        n.innerHTML =
          '<span class="thi-note-i" aria-hidden="true">⚑</span>' +
          '<span>נאמנות למקור: המרצה כתב את שרת ה-<span dir="ltr">HTTPS</span> על ' +
          '<b dir="ltr">port 431</b>. <span class="thi-note-src">במקור נכתב 431</span> ' +
          '(הערך התקני המקובל הוא <span dir="ltr">443</span>).</span>';
        panel.appendChild(n);
      }

      // flag breakdown (all 6) when the Flags field is shown
      if (f.isFlags) {
        var fl = el("div", "thi-flaglist");
        FLAGS.forEach(function (fg) {
          var row = el("button", "thi-flagrow");
          row.type = "button";
          row.setAttribute("data-flag", fg.key);
          var on = SCENARIOS[activeScen] && SCENARIOS[activeScen].flags &&
            SCENARIOS[activeScen].flags[fg.key];
          if (on) row.classList.add("is-set");
          row.innerHTML =
            '<span class="thi-fr-bit" dir="ltr">' + (on ? "1" : "0") + '</span>' +
            '<span class="thi-fr-key" dir="ltr">' + fg.key + '</span>' +
            '<span class="thi-fr-desc">' + fg.desc + '</span>';
          row.addEventListener("mouseenter", function () { highlightFlag(fg.key); });
          row.addEventListener("focus", function () { highlightFlag(fg.key); });
          row.addEventListener("mouseleave", function () { highlightFlag(null); });
          row.addEventListener("blur", function () { highlightFlag(null); });
          fl.appendChild(row);
        });
        panel.appendChild(fl);
      }

      // byte-level Seq/Ack mini-demo
      if (f.demo) buildByteDemo(panel, f.demo);

      // current scenario value for this field
      if (activeScen !== "blank" && SCENARIOS[activeScen]) {
        var sc = SCENARIOS[activeScen];
        var v = null;
        if (f.isFlags) {
          var bits = FLAGS.map(function (fg) { return fg.key + "=" + sc.flags[fg.key]; }).join("  ");
          v = bits;
        } else if (sc.values[f.key] != null) {
          v = sc.values[f.key];
        }
        if (v != null) {
          var vb = el("div", "thi-curval");
          vb.innerHTML = '<span class="thi-curval-k">בתרחיש ' + sc.name.split(" ")[0] +
            '</span><span class="thi-curval-v" dir="ltr">' + v + '</span>';
          panel.appendChild(vb);
        }
      }

      var src = el("p", "thi-source", "מקור: " + f.source);
      panel.appendChild(src);
    }

    function highlightFlag(key) {
      Object.keys(flagChips).forEach(function (k) {
        flagChips[k].classList.toggle("is-hi", k === key);
      });
    }

    /* ---- byte-level Seq/Ack demo (grounded in §4 numeric example) ---- */
    function buildByteDemo(container, kind) {
      var box = el("div", "thi-bytedemo");
      var cap = el("div", "thi-bd-cap");
      cap.innerHTML = (kind === "seq")
        ? 'מספר רצף = <b>מספר הבית הראשון</b> בסגמנט (לא אינדקס!). גררו את המחוון:'
        : 'ה-ACK מאשר את <b>הבית הבא הצפוי</b> = Seq + מס\' הבתים שהתקבלו:';
      box.appendChild(cap);

      var isn = 100;
      var slider = el("input", "thi-bd-slider");
      slider.type = "range";
      slider.min = "0"; slider.max = "1500"; slider.step = "100"; slider.value = "0";
      slider.setAttribute("aria-label", "מיקום הבית הראשון בזרם (offset מ-ISN)");

      var readout = el("div", "thi-bd-readout");
      readout.setAttribute("dir", "ltr");

      // byte-stream ribbon
      var ribbon = el("div", "thi-bd-ribbon");
      ribbon.setAttribute("dir", "ltr");
      var segMark = el("span", "thi-bd-seg");
      ribbon.appendChild(segMark);

      function update() {
        var off = parseInt(slider.value, 10);
        var segLen = 500;
        var first = isn + off;
        var last = first + segLen - 1;
        if (kind === "seq") {
          readout.innerHTML = 'ISN=' + isn + ' &nbsp;•&nbsp; Seq = B<sub>isn</sub>+' + off +
            ' = <b>' + first + '</b> &nbsp;→&nbsp; מכסה בתים ' + first + '..' + last;
        } else {
          readout.innerHTML = 'קיבלתי בתים ' + first + '..' + last +
            ' &nbsp;→&nbsp; Ack = <b>' + (last + 1) + '</b> (הבית הבא הצפוי)';
        }
        var pct = (off / 1500) * 62;
        segMark.style.insetInlineStart = pct + "%";
      }
      slider.addEventListener("input", update);
      update();

      box.appendChild(readout);
      box.appendChild(ribbon);
      box.appendChild(slider);
      container.appendChild(box);
    }

    /* ---- load a full scenario into the header cells ---- */
    function loadScenario(name) {
      activeScen = name;
      Object.keys(scenBtns).forEach(function (k) {
        var on = k === name;
        scenBtns[k].classList.toggle("primary", on);
        scenBtns[k].setAttribute("aria-pressed", on ? "true" : "false");
      });

      if (name === "blank" || !SCENARIOS[name]) {
        // clear values
        FIELDS.forEach(function (f) {
          if (cellByKey[f.key]._val) cellByKey[f.key]._val.textContent = "";
        });
        FLAGS.forEach(function (fg) {
          flagChips[fg.key].classList.remove("is-on");
        });
        scenBar.hidden = true;
        if (pinned) show(pinned, true);
        return;
      }

      var sc = SCENARIOS[name];
      FIELDS.forEach(function (f) {
        var cell = cellByKey[f.key];
        if (f.isFlags) return;
        var v = sc.values[f.key];
        if (cell._val) cell._val.textContent = (v != null ? v : "");
      });
      // light up flags
      FLAGS.forEach(function (fg) {
        var on = sc.flags[fg.key] === 1;
        flagChips[fg.key].classList.toggle("is-on", on);
        flagChips[fg.key].textContent = fg.key + (on ? "·1" : "");
        if (!on) flagChips[fg.key].textContent = fg.key;
      });

      // scenario caption
      scenBar.hidden = false;
      scenBar.innerHTML =
        '<span class="thi-scen-name" dir="ltr">' + sc.name.split(" — ")[0] + '</span>' +
        '<span class="thi-scen-cap">' + sc.caption + '</span>';

      // pulse the flags that are set (unless reduced motion)
      if (!reduceMotion) {
        var flagCell = cellByKey.flags;
        flagCell.classList.remove("pulse");
        // force reflow to restart animation
        void flagCell.offsetWidth;
        flagCell.classList.add("pulse");
      }

      // refresh panel if a field is currently shown/pinned
      if (pinned) show(pinned, true);
      else show("flags", false); // surface the flags so the change is visible
    }

    /* ---- init ---- */
    show("seq", false);          // open on the star field: byte-level Sequence #
    loadScenario("syn");         // load a real SYN so numbers are visible immediately
  }

  /* ================================================================ *
   * STYLES (scoped, injected once)                                    *
   * ================================================================ */
  function injectStyles() {
    if (document.getElementById("thi-styles")) return;
    var mono = "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace";
    var css =
"" +
".thi-root{font-family:inherit;color:#33302B;}" +
".thi-title{font-weight:700;font-size:1rem;margin-bottom:.7rem;}" +
".thi-title span[dir=ltr]{font-weight:800;}" +

/* context strip */
".thi-ctx{display:flex;align-items:center;flex-wrap:wrap;gap:.35rem;font-family:" + mono + ";font-size:.72rem;margin-bottom:.9rem;}" +
".thi-ctx-b{padding:.18rem .55rem;border-radius:7px;border:1px solid #E7DECF;font-weight:700;}" +
".thi-ip{background:#F0E4C4;color:#8a6d1f;}" +
".thi-tcph{background:#EFD9CC;color:#a2542f;}" +
".thi-tcph.is-here{outline:2px solid #BE7C5E;outline-offset:1px;}" +
".thi-tcpd{background:#DCE7DE;color:#43664e;}" +
".thi-ctx-arrow,.thi-ctx-plus{color:#6B655C;font-weight:800;}" +
".thi-ctx-cap{flex-basis:100%;color:#6B655C;font-size:.66rem;margin-top:.15rem;}" +

/* grid */
".thi-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:1.05rem;align-items:start;}" +
"@media(max-width:680px){.thi-grid{grid-template-columns:1fr;}}" +

/* bit ruler + map */
".thi-mapwrap{position:relative;}" +
".thi-ruler{position:relative;height:14px;margin:0 0 3px;font-family:" + mono + ";}" +
".thi-tick{position:absolute;top:0;transform:translateX(-50%);font-size:.6rem;color:#6B655C;}" +
".thi-map{display:flex;flex-direction:column;gap:5px;background:#FBF5EA;border:1px solid #E7DECF;border-radius:12px;padding:6px;}" +
".thi-word{display:flex;gap:5px;}" +
".thi-cell{--fc:#6E8CA0;position:relative;display:flex;flex-direction:column;justify-content:center;gap:1px;min-width:0;min-height:46px;padding:5px 7px;border:1.5px solid var(--fc);border-radius:9px;background:#FFFDF8;cursor:pointer;text-align:right;font-family:inherit;transition:transform .14s ease,box-shadow .16s ease,background .16s ease;overflow:hidden;}" +
".thi-cell:hover{transform:translateY(-2px);}" +
".thi-cell:focus-visible{outline:2px solid #33302B;outline-offset:2px;}" +
".thi-cell.is-active{background:var(--fc);box-shadow:0 3px 10px rgba(120,100,70,.2);}" +
".thi-cell.is-active .thi-cell-label,.thi-cell.is-active .thi-cell-bits,.thi-cell.is-active .thi-cell-val{color:#fff;}" +
".thi-cell.is-pinned{outline:2px dashed #33302B;outline-offset:2px;}" +
".thi-cell.is-var{background:repeating-linear-gradient(135deg,#FFFDF8 0 7px,#FBF5EA 7px 14px);}" +
".thi-cell.is-var.is-active{background:var(--fc);}" +
".thi-cell-label{font-family:" + mono + ";font-size:.74rem;font-weight:800;color:#33302B;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
".thi-cell-bits{position:absolute;top:4px;inset-inline-start:6px;font-family:" + mono + ";font-size:.55rem;color:#6B655C;opacity:.8;}" +
".thi-cell-val{font-family:" + mono + ";font-size:.7rem;font-weight:700;color:var(--fc);line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
".thi-cell.is-active .thi-cell-val{color:#fff;}" +

/* flag micro-chips inside the flags cell */
".thi-flagbox{display:flex;gap:2px;flex-wrap:wrap;margin-top:2px;}" +
".thi-flagchip{font-family:" + mono + ";font-size:.56rem;font-weight:800;color:#a2542f;background:#FFFDF8;border:1px solid #BE7C5E;border-radius:4px;padding:0 3px;line-height:1.4;opacity:.55;transition:all .15s ease;}" +
".thi-flagchip.is-on{opacity:1;background:#BE7C5E;color:#fff;}" +
".thi-flagchip.is-hi{outline:2px solid #33302B;opacity:1;}" +
".thi-cell.is-active .thi-flagchip{border-color:#fff;color:#fff;background:rgba(255,255,255,.18);}" +
".thi-cell.is-active .thi-flagchip.is-on{background:#fff;color:#a2542f;}" +
"@keyframes thi-pulse{0%{box-shadow:0 0 0 0 rgba(190,124,94,.5);}70%{box-shadow:0 0 0 8px rgba(190,124,94,0);}100%{box-shadow:0 0 0 0 rgba(190,124,94,0);}}" +
".thi-cell.pulse{animation:thi-pulse .9s ease-out;}" +

/* inspector panel */
".thi-panel{background:#FBF5EA;border:1px solid #E7DECF;border-radius:14px;padding:.95rem 1rem;min-height:230px;}" +
".thi-p-head{--fc:#6E8CA0;display:flex;align-items:baseline;flex-wrap:wrap;gap:.5rem;padding-bottom:.5rem;border-bottom:2px solid var(--fc);margin-bottom:.6rem;}" +
".thi-p-en{font-family:" + mono + ";font-weight:800;font-size:1.02rem;color:var(--fc);}" +
".thi-p-he{font-size:.86rem;color:#33302B;font-weight:600;}" +
".thi-p-bits{margin-inline-start:auto;font-family:" + mono + ";font-size:.68rem;color:#6B655C;background:#FFFDF8;border:1px solid #E7DECF;border-radius:6px;padding:1px 6px;}" +
".thi-pin{font-size:.66rem;color:#6B655C;flex-basis:100%;}" +
".thi-p-role{font-size:.86rem;line-height:1.55;margin:0 0 .5rem;}" +

/* balloon */
".thi-balloon{display:flex;align-items:center;gap:.5rem;background:#FFFDF8;border:1px dashed #7C9885;border-radius:9px;padding:.4rem .55rem;margin-bottom:.5rem;}" +
".thi-balloon-tag{flex:0 0 auto;font-size:.62rem;font-weight:700;color:#43664e;background:#DCE7DE;border-radius:5px;padding:1px 5px;}" +
".thi-balloon-txt{font-family:" + mono + ";font-size:.72rem;font-weight:600;color:#43664e;}" +

/* 431 note */
".thi-note431{display:flex;gap:.5rem;align-items:flex-start;background:#FFFDF8;border-inline-start:3px solid #C9A24B;border-radius:8px;padding:.45rem .6rem;margin-bottom:.5rem;font-size:.78rem;line-height:1.45;color:#6B655C;}" +
".thi-note-i{color:#C9A24B;font-weight:800;}" +
".thi-note431 b{font-family:" + mono + ";color:#33302B;}" +
".thi-note-src{font-weight:700;color:#a2542f;background:#EFD9CC;border-radius:4px;padding:0 4px;}" +

/* flag list */
".thi-flaglist{display:flex;flex-direction:column;gap:4px;margin:.2rem 0 .5rem;}" +
".thi-flagrow{display:grid;grid-template-columns:auto auto 1fr;align-items:center;gap:.5rem;text-align:right;background:#FFFDF8;border:1px solid #E7DECF;border-radius:8px;padding:.35rem .5rem;cursor:pointer;font-family:inherit;transition:border-color .14s ease,background .14s ease;}" +
".thi-flagrow:hover,.thi-flagrow:focus-visible{border-color:#BE7C5E;outline:none;}" +
".thi-fr-bit{font-family:" + mono + ";font-weight:800;font-size:.8rem;width:20px;height:20px;display:grid;place-items:center;border-radius:5px;background:#EDE6D8;color:#6B655C;}" +
".thi-flagrow.is-set .thi-fr-bit{background:#BE7C5E;color:#fff;}" +
".thi-fr-key{font-family:" + mono + ";font-weight:800;font-size:.78rem;color:#a2542f;}" +
".thi-fr-desc{font-size:.72rem;line-height:1.35;color:#6B655C;}" +

/* byte demo */
".thi-bytedemo{background:#FFFDF8;border:1px solid #E7DECF;border-radius:10px;padding:.55rem .6rem;margin:.2rem 0 .5rem;}" +
".thi-bd-cap{font-size:.76rem;line-height:1.4;margin-bottom:.45rem;}" +
".thi-bd-readout{font-family:" + mono + ";font-size:.74rem;color:#43664e;margin-bottom:.4rem;line-height:1.4;}" +
".thi-bd-readout b{color:#33302B;}" +
".thi-bd-ribbon{position:relative;height:14px;border-radius:7px;background:linear-gradient(90deg,#DCE7DE,#c9dccd);border:1px solid #7C9885;margin-bottom:.5rem;overflow:hidden;}" +
".thi-bd-seg{position:absolute;top:-1px;height:14px;width:20%;background:#7C9885;border-radius:6px;transition:inset-inline-start .18s ease;opacity:.85;}" +
".thi-bd-slider{width:100%;accent-color:#7C9885;cursor:pointer;}" +

/* current value */
".thi-curval{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;background:#FBF5EA;border:1px solid #E7DECF;border-radius:8px;padding:.35rem .55rem;margin-bottom:.5rem;}" +
".thi-curval-k{font-size:.68rem;color:#6B655C;font-weight:600;}" +
".thi-curval-v{font-family:" + mono + ";font-size:.82rem;font-weight:800;color:#33302B;}" +

".thi-source{font-size:.68rem;color:#6B655C;margin:.3rem 0 0;font-style:italic;}" +

/* controls extras */
".thi-clabel{font-size:.8rem;font-weight:600;color:#6B655C;}" +

/* scenario bar */
".thi-scenbar{margin-top:.7rem;background:#FFFDF8;border:1px solid #E7DECF;border-inline-start:3px solid #6E8CA0;border-radius:10px;padding:.5rem .7rem;display:flex;flex-direction:column;gap:.15rem;}" +
".thi-scen-name{font-family:" + mono + ";font-weight:800;font-size:.82rem;color:#6E8CA0;}" +
".thi-scen-cap{font-size:.8rem;line-height:1.45;color:#33302B;}" +

"@media(prefers-reduced-motion:reduce){.thi-cell,.thi-bd-seg,.thi-flagchip{transition:none!important;}.thi-cell.pulse{animation:none!important;}}";

    var st = document.createElement("style");
    st.id = "thi-styles";
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ================================================================ *
   * MOUNT                                                             *
   * ================================================================ */
  function boot() {
    var mounts = document.querySelectorAll('[data-viz="tcp-header-inspector"]');
    if (!mounts.length) return; // degrade gracefully
    mounts.forEach(function (m) {
      try { render(m); }
      catch (err) {
        if (window.console && console.error) {
          console.error("[tcp-header-inspector] render failed:", err);
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
