/* =====================================================================
   task-states.js — "מכונת המצבים של תהליך" (task life-cycle explorer)

   Grounded in the lecturer's handouts:
   - _notes/task-struct.md   — השדה __state: TASK_RUNNING (רץ או ממתין
     בתור המעבד), TASK_INTERRUPTIBLE / TASK_UNINTERRUPTIBLE (ישן וממתין
     לאירוע או לדיסק), TASK_STOPPED, EXIT_ZOMBIE; pid / tgid (tgid משותף
     לכל הנימים); real_parent / children.
   - _notes/echo-concurrent.md — בן שהסתיים נשאר בטבלת התהליכים כ-Zombie
     עד שהאב קורא ל-wait(); בלי waitpid טבלת התהליכים תתמלא;
     waitpid(-1, NULL, WNOHANG) קוצר בלי לחסום; exit(0) בסוף קוד הבן.
   - _notes/bash-scenario.md   — fork() יוצרת עותק עם PID חדש; execve
     מחליפה את התמונה (מרחב הזיכרון הישן נמחק).
   - _notes/mutex-race.md      — חוט שממתין למנעול תפוס מועבר ע"י קריאת
     המערכת futex ל-Sleep/Blocked, והקרנל מוציא אותו מתור התזמון; unlock
     מעיר חוט אחד והקרנל מחזיר אותו ל-Ready.
   - _notes/threads-linux.md   — אם ה-Main Thread מסיים את main, הקרנל
     סוגר את כל התהליך וכל החוטים שבו.
   - _notes/exam-sample.md     — שאלה 11: בלי waitpid טבלת התהליכים
     מתמלאת בזומבים.

   Mount: <div class="viz" data-viz="task-states"></div>
   Optional attribute: data-step-ms="1000" — קצב ההרצה האוטומטית.

   Self-contained IIFE, zero deps, works from file:// and http.
   Colors: only the site's CSS custom properties (var(--ink), var(--accent),
   var(--ok), var(--err) ...) + color-mix() — light and dark both work.
   RTL Hebrew chrome; the drawing area itself is dir="ltr".
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "task-states";
  var SVGNS = "http://www.w3.org/2000/svg";
  var STYLE_ID = "task-states-style";
  var instCount = 0;

  /* ---------------------------------------------------------------- utils */
  function se(tag, attrs, parent) {
    var el = document.createElementNS(SVGNS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function ce(tag, cls, parent, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  }
  function ltr(s) { return '<span dir="ltr">' + s + "</span>"; }

  /* ב-SVG ‏text-anchor הוא יחסי לכיוון הכתיבה: בשורה בעברית (rtl) הערך
     "start" הוא הקצה הימני. כדי שכל שורות התווית ייושרו חזותית לאותו צד,
     מחליפים start↔end לשורות RTL. */
  function visualAnchor(anchor, isRtl) {
    if (!isRtl || anchor === "middle") return anchor;
    return anchor === "start" ? "end" : "start";
  }

  /* =====================================================================
     המצבים — שמות הקבועים בדיוק כפי שהמרצה מנה אותם ב-__state
     ===================================================================== */
  var NODES = {
    ready: {
      x: 280, y: 90, w: 200, h: 66,
      lines: [
        { t: "TASK_RUNNING", mono: 1, bold: 1, size: 14 },
        { t: "ready — ממתין בתור המעבד", rtl: 1, size: 12, soft: 1 }
      ]
    },
    running: {
      x: 560, y: 90, w: 200, h: 66,
      lines: [
        { t: "TASK_RUNNING", mono: 1, bold: 1, size: 14 },
        { t: "running — רץ על ליבה", rtl: 1, size: 12, soft: 1 }
      ]
    },
    stopped: {
      x: 30, y: 200, w: 190, h: 62,
      lines: [
        { t: "TASK_STOPPED", mono: 1, bold: 1, size: 13.5 },
        { t: "הופסק — ממתין ל-SIGCONT", rtl: 1, size: 11.5, soft: 1 }
      ]
    },
    interruptible: {
      x: 560, y: 216, w: 200, h: 74,
      lines: [
        { t: "TASK_INTERRUPTIBLE", mono: 1, bold: 1, size: 13 },
        { t: "ישן — ממתין לאירוע,", rtl: 1, size: 11.5, soft: 1 },
        { t: "למנעול או ל-sleep", rtl: 1, size: 11.5, soft: 1 }
      ]
    },
    uninterruptible: {
      x: 560, y: 336, w: 200, h: 74,
      lines: [
        { t: "TASK_UNINTERRUPTIBLE", mono: 1, bold: 1, size: 12.5 },
        { t: "ישן — ממתין לדיסק,", rtl: 1, size: 11.5, soft: 1 },
        { t: "לא ניתן להעיר באות", rtl: 1, size: 11.5, soft: 1 }
      ]
    },
    zombie: {
      x: 280, y: 320, w: 200, h: 64,
      lines: [
        { t: "EXIT_ZOMBIE", mono: 1, bold: 1, size: 14 },
        { t: "הסתיים — ממתין ל-()wait", rtl: 1, size: 12, soft: 1 }
      ]
    },
    reaped: {
      x: 280, y: 424, w: 200, h: 54, dashed: 1,
      lines: [
        { t: "נמחק מטבלת התהליכים", rtl: 1, bold: 1, size: 13.5 },
        { t: "ה-task_struct שוחרר", rtl: 1, size: 11.5, soft: 1 }
      ]
    }
  };

  /* מצב → נוסח לכרטיס task_struct ולפאנל ההסבר */
  var STATE_INFO = {
    none: {
      he: "התהליך טרם נוצר",
      konst: "—", hex: "",
      body: "עדיין אין " + ltr("task_struct") + " במערכת. הדרך היחידה ליצור תהליך חדש היא " +
        "שתהליך קיים יקרא ל-" + ltr("fork()") + " (או " + ltr("clone()") + ") — הקרנל משכפל " +
        "את ה-task_struct של האב ונותן לבן <b>PID ייחודי משלו</b>. לחצו על " +
        ltr("fork()") + " כדי להתחיל."
    },
    ready: {
      he: "מוכן לריצה — בתור המעבד",
      konst: "TASK_RUNNING", hex: "0x0000",
      body: "התהליך מוכן לחלוטין לרוץ ומחכה שהמתזמן (EEVDF/CFS) יבחר בו. שימו לב לנקודה " +
        "שהמרצה הדגיש: <b>אותו ערך בדיוק</b> ב-" + ltr("__state") + " מתאר גם תהליך שרץ בפועל " +
        "וגם תהליך שרק ממתין בתור המעבד — שניהם " + ltr("TASK_RUNNING") + "."
    },
    running: {
      he: "רץ עכשיו על ליבה",
      konst: "TASK_RUNNING", hex: "0x0000",
      body: "המתזמן בחר בתהליך והוא מבצע הוראות על ליבה. הוא יישאר כאן עד שיקרה אחד משלושה: " +
        "יפוג לו קצב הזמן (Time Slice) והוא יחזור לתור, הוא יבקש משאב שאינו זמין ויירדם, " +
        "או שהוא יסתיים. " + ltr("__state") + " עדיין " + ltr("TASK_RUNNING") + "."
    },
    interruptible: {
      he: "ישן שינה קלה (ניתן להעיר)",
      konst: "TASK_INTERRUPTIBLE", hex: "0x0001",
      body: "התהליך או החוט ממתין לאירוע: " + ltr("sleep()") + ", קלט, או מנעול תפוס. " +
        "כשחוט קורא ל-" + ltr("pthread_mutex_lock") + " על מנעול תפוס הוא <b>אינו</b> מבצע " +
        "busy-wait — קריאת המערכת " + ltr("futex") + " מעבירה אותו ל-Sleep/Blocked, " +
        "וה-Kernel <b>מוציא אותו מתור התזמון</b> ולא נותן לו זמן מעבד עד שהמנעול משתחרר. " +
        "מכאן אפשר להעיר אותו גם באות (Signal)."
    },
    uninterruptible: {
      he: "ישן שינה עמוקה (לא ניתן להעיר)",
      konst: "TASK_UNINTERRUPTIBLE", hex: "0x0002",
      body: "התהליך ממתין להשלמת פעולת I/O מול הדיסק — למשל " + ltr("read()") + " שהחטיא את " +
        "ה-Page Cache והבקשה ירדה עד ה-NVMe. במצב הזה <b>אי אפשר להעיר אותו באות</b>, כדי " +
        "שלא ייקטע באמצע פעולת חומרה; הוא יתעורר רק כשהנתונים יגיעו."
    },
    stopped: {
      he: "הופסק",
      konst: "TASK_STOPPED", hex: "0x0004",
      body: "התהליך הוקפא — למשל אחרי " + ltr("Ctrl-Z") + " במסוף, ששולח " + ltr("SIGSTOP") +
        ". הוא לא רץ, לא בתור, וגם לא ממתין לאירוע כלשהו: ה-task_struct נשמר כמו שהוא עד " +
        "שיגיע " + ltr("SIGCONT") + " שיחזיר אותו לתור המעבד."
    },
    zombie: {
      he: "זומבי — סיים אבל עדיין בטבלה",
      konst: "EXIT_ZOMBIE", hex: "0x0020",
      body: "התהליך סיים לרוץ ומשאביו (זיכרון, קבצים פתוחים) שוחררו — אבל ה-" +
        ltr("task_struct") + " שלו <b>נשאר בטבלת התהליכים</b> כדי לשמור את סטטוס היציאה " +
        "עבור האב. כלשון ההנדאוט: בן שהסתיים נשאר כ-Zombie <b>עד שהאב קורא ל-" +
        ltr("wait()") + "</b>."
    },
    reaped: {
      he: "נמחק מטבלת התהליכים",
      konst: "—", hex: "",
      body: "האב קרא ל-" + ltr("wait()") + " / " + ltr("waitpid()") + ", אסף את סטטוס היציאה, " +
        "והקרנל שחרר סופית את ה-" + ltr("task_struct") + ". ה-PID התפנה ואפשר להקצות אותו " +
        "מחדש. זהו סוף חייו של התהליך."
    }
  };

  /* =====================================================================
     הקשתות — נתיב, תווית וסידור התוויות בשטחים הפנויים
     ===================================================================== */
  var EDGES = {
    fork: {
      d: "M 380,54 L 380,86",
      lines: [{ t: "fork() / clone()", mono: 1 }],
      lx: 398, ly: 53, anchor: "start"
    },
    sched: {
      d: "M 482,110 L 556,110",
      lines: [{ t: "המתזמן בוחר", rtl: 1 }],
      lx: 519, ly: 98, anchor: "middle"
    },
    preempt: {
      d: "M 556,138 L 482,138",
      lines: [{ t: "פג קצב הזמן", rtl: 1 }],
      lx: 519, ly: 152, anchor: "middle"
    },
    sleep: {
      d: "M 640,158 L 640,212",
      lines: [{ t: "sleep(2) / futex", mono: 1 }, { t: "ממתין ל-mutex", rtl: 1 }],
      lx: 652, ly: 190, anchor: "start"
    },
    wake: {
      d: "M 558,244 L 360,244 L 360,158",
      lines: [{ t: "האירוע הגיע / unlock", rtl: 1 }],
      lx: 430, ly: 236, anchor: "middle"
    },
    readDisk: {
      d: "M 762,140 L 800,140 L 800,373 L 764,373",
      lines: [{ t: "read()", mono: 1 }, { t: "מהדיסק", rtl: 1 }],
      lx: 800, ly: 246, anchor: "middle"
    },
    diskDone: {
      d: "M 558,373 C 520,340 520,240 400,158",
      lines: [{ t: "הדיסק החזיר", rtl: 1 }, { t: "נתונים", rtl: 1 }],
      lx: 515, ly: 300, anchor: "middle"
    },
    sigstop: {
      d: "M 300,181 C 258,183 190,188 132,196",
      lines: [{ t: "Ctrl-Z", mono: 1 }, { t: "(SIGSTOP)", mono: 1 }],
      lx: 278, ly: 216, anchor: "middle"
    },
    sigcont: {
      d: "M 110,198 L 110,123 L 276,123",
      lines: [{ t: "SIGCONT", mono: 1 }],
      lx: 168, ly: 112, anchor: "middle"
    },
    exit: {
      d: "M 580,158 C 500,200 480,270 452,316",
      lines: [{ t: "exit(0) / return", mono: 1 }, { t: "או אות קטלני", rtl: 1 }],
      lx: 552, ly: 196, anchor: "end"
    },
    reap: {
      d: "M 380,386 L 380,420",
      lines: [{ t: "waitpid()", mono: 1 }, { t: "האב אוסף את הבן", rtl: 1 }],
      lx: 396, ly: 404, anchor: "start"
    }
  };

  /* =====================================================================
     האירועים — כפתור אחד לכל אירוע; רק המעברים החוקיים פעילים
     ===================================================================== */
  var EVENTS = [
    {
      id: "fork", btn: "fork() — צור תהליך", from: ["none", "zombie", "reaped"], to: "ready",
      edge: "fork",
      log: function (st, prev) {
        if (prev === "zombie") {
          return "האב קרא שוב ל-" + ltr("fork()") + " בלי לאסוף את הבן הקודם — הזומבי " +
            "הקודם נשאר בטבלת התהליכים, ונוצר בן חדש " + ltr("pid " + st.pid) + " במצב " +
            ltr("TASK_RUNNING") + " (ready).";
        }
        if (st.mode === "thread") {
          return ltr("clone()") + " עם " + ltr("CLONE_THREAD") + " יצרה <b>נימה חדשה</b> " +
            "באותו תהליך: " + ltr("pid " + st.pid) + " אבל " + ltr("tgid " + st.tgid) +
            " — אותו tgid כמו הנימה הראשית. הנימה נכנסת לתור המעבד.";
        }
        return ltr("fork()") + " שכפלה את ה-task_struct של האב. הבן קיבל <b>PID ייחודי " +
          "משלו</b> (" + ltr(String(st.pid)) + "), ערך ההחזרה אצלו הוא 0, והוא נכנס לתור " +
          "המעבד במצב " + ltr("TASK_RUNNING") + ".";
      }
    },
    {
      id: "sched", btn: "המתזמן בוחר", from: ["ready"], to: "running", edge: "sched",
      log: function () {
        return "המתזמן (EEVDF/CFS) בחר בתהליך והקצה לו ליבה. " + ltr("__state") +
          " לא השתנה — הוא היה ונשאר " + ltr("TASK_RUNNING") + ".";
      }
    },
    {
      id: "preempt", btn: "פג קצב הזמן", from: ["running"], to: "ready", edge: "preempt",
      log: function () {
        return "פג קצב הזמן (Time Slice) והמתזמן ביצע Context Switch. התהליך חזר לתור " +
          "המעבד — עדיין " + ltr("TASK_RUNNING") + ", פשוט לא על ליבה.";
      }
    },
    {
      id: "readDisk", btn: "read() מהדיסק", from: ["running"], to: "uninterruptible",
      edge: "readDisk",
      log: function () {
        return ltr("read()") + " החטיאה את ה-Page Cache והבקשה ירדה לדיסק. הקרנל מרדים את " +
          "התהליך ב-" + ltr("TASK_UNINTERRUPTIBLE") + " — שינה שאי אפשר להעיר ממנה באות, " +
          "כדי לא לקטוע פעולת חומרה באמצע.";
      }
    },
    {
      id: "diskDone", btn: "הדיסק החזיר נתונים", from: ["uninterruptible"], to: "ready",
      edge: "diskDone",
      log: function () {
        return "פסיקת החומרה הודיעה שה-I/O הסתיים. הקרנל מעיר את התהליך ומחזיר אותו לתור " +
          "המעבד — " + ltr("TASK_RUNNING") + " (ready).";
      }
    },
    {
      id: "sleep", btn: "sleep(2) / ממתין ל-mutex", from: ["running"], to: "interruptible",
      edge: "sleep",
      log: function (st) {
        return (st.mode === "thread"
          ? "החוט קרא ל-" + ltr("pthread_mutex_lock") + " על מנעול תפוס. אין busy-wait: "
          : "התהליך קרא ל-" + ltr("sleep(2)") + " / ממתין למנעול. ") +
          "קריאת המערכת " + ltr("futex") + " מעבירה אותו ל-Sleep/Blocked, והקרנל <b>מוציא " +
          "אותו מתור התזמון</b> — לא נצרך זמן CPU כל עוד הוא חסום.";
      }
    },
    {
      id: "wake", btn: "האירוע הגיע / unlock", from: ["interruptible"], to: "ready",
      edge: "wake",
      log: function () {
        return "המחזיק במנעול קרא ל-" + ltr("pthread_mutex_unlock") + " (או שהאירוע הגיע). " +
          "הקרנל <b>מעיר</b> את הממתין ומחזיר אותו ל-Ready — והוא ירוץ ברגע שהמתזמן יבחר בו.";
      }
    },
    {
      id: "sigstop", btn: "Ctrl-Z (SIGSTOP)", from: ["running", "ready"], to: "stopped",
      edge: "sigstop",
      log: function () {
        return ltr("Ctrl-Z") + " במסוף שלח " + ltr("SIGSTOP") + ". הקרנל הקפיא את התהליך " +
          "והעביר אותו ל-" + ltr("TASK_STOPPED") + " — הוא יצא מתור המעבד ולא יקבל זמן ריצה.";
      }
    },
    {
      id: "sigcont", btn: "SIGCONT", from: ["stopped"], to: "ready", edge: "sigcont",
      log: function () {
        return ltr("SIGCONT") + " שחרר את ההקפאה. התהליך חוזר לתור המעבד במצב " +
          ltr("TASK_RUNNING") + " (ready) וימשיך מהנקודה שבה הופסק.";
      }
    },
    {
      id: "exit", btn: "exit(0)", from: ["running"], to: "zombie", edge: "exit",
      log: function (st) {
        var base = ltr("exit(0)") + " (או " + ltr("return") + " מ-main, או אות קטלני) סיים " +
          "את הריצה. המשאבים שוחררו — אבל ה-task_struct <b>נשאר בטבלת התהליכים</b> כ-" +
          ltr("EXIT_ZOMBIE") + " עד שהאב יאסוף את סטטוס היציאה.";
        if (st.mode === "thread") {
          base += " <b>שימו לב:</b> אם דווקא ה-Main Thread מסיים את " + ltr("main") +
            ", הקרנל סוגר את <b>כל התהליך וכל החוטים שבו</b>.";
        }
        return base;
      }
    },
    {
      id: "reap", btn: "האב קורא waitpid()", from: ["zombie"], to: "reaped", edge: "reap",
      log: function (st) {
        if (st.ppid === 1) {
          return "התהליך היה יתום, ולכן <b>init/systemd (PID 1)</b> הוא זה שאסף אותו: הוא " +
            "קורא " + ltr("wait()") + " ברקע כל הזמן. ה-task_struct שוחרר וה-PID התפנה.";
        }
        return "האב קרא " + ltr("waitpid(-1, NULL, WNOHANG)") + " — קציר לא-חוסם. סטטוס " +
          "היציאה נאסף, הקרנל <b>מחק את ה-task_struct מטבלת התהליכים</b> וה-PID התפנה.";
      }
    }
  ];

  var EVENT_BY_ID = {};
  EVENTS.forEach(function (e) { EVENT_BY_ID[e.id] = e; });

  /* =====================================================================
     תרחישים מוכנים (הרצה אוטומטית)
     ===================================================================== */
  var PRESETS = [
    {
      id: "normal", btn: "מחזור חיים רגיל", mode: "proc",
      steps: ["fork", "sched", "preempt", "sched", "readDisk", "diskDone", "sched", "exit", "reap"],
      intro: "מחזור החיים המלא של תהליך: מ-" + ltr("fork()") + " ועד המחיקה מטבלת התהליכים, " +
        "כולל הפסקה בגלל קצב זמן וכולל שינה על המתנה לדיסק."
    },
    {
      id: "zombie", btn: 'זומבי — האב לא קורא wait()', mode: "proc",
      steps: ["fork", "sched", "exit", "fork", "sched", "exit", "fork", "sched", "exit"],
      intro: "השרת הקונקורנטי מבצע " + ltr("fork()") + " לכל לקוח, כל בן מסיים ב-" +
        ltr("exit(0)") + " — אבל האב <b>לא</b> קורא ל-" + ltr("waitpid()") +
        ". שימו לב למונה הזומבים."
    },
    {
      id: "orphan", btn: "יתום — האב מסיים לפני הבן", mode: "proc",
      steps: ["fork", "sched", "@orphan", "exit", "reap"],
      intro: "מה קורה כשדווקא <b>האב</b> מסיים ראשון? הבן הופך ל-<b>יתום</b> ומאומץ על ידי " +
        ltr("init/systemd (PID 1)") + " שאוסף אותו. (הרחבה — לא מהשקפים.)"
    },
    {
      id: "mutex", btn: "thread ממתין ל-mutex", mode: "thread",
      steps: ["fork", "sched", "sleep", "wake", "sched"],
      intro: "חוט (Thread) שנתקל במנעול תפוס: " + ltr("futex") + " מרדים אותו ומוציא אותו " +
        "מתור התזמון, ו-" + ltr("unlock") + " מחזיר אותו ל-Ready — <b>בלי לבזבז זמן CPU</b> " +
        "בהמתנה."
    }
  ];

  var PRESET_BY_ID = {};
  PRESETS.forEach(function (p) { PRESET_BY_ID[p.id] = p; });

  /* =====================================================================
     מצב התחלתי + מעברים (הכול נגזר מהאובייקט הזה)
     ===================================================================== */
  var BASE_PID = 4521, BASE_PPID = 2310;

  function initialState(mode) {
    return {
      cur: "none",
      mode: mode || "proc",
      pid: BASE_PID,
      tgid: mode === "thread" ? BASE_PID : BASE_PID,
      ppid: BASE_PPID,
      seq: 0,
      zombies: 0,        /* זומבים ישנים, לא כולל הבן שאנחנו עוקבים אחריו */
      orphan: false,
      lastEdge: null,
      lastEvent: null,
      log: [],
      preset: null,
      presetStep: 0,
      playing: false
    };
  }

  function legal(st, ev) { return ev.from.indexOf(st.cur) !== -1; }

  function zombieTotal(st) { return st.zombies + (st.cur === "zombie" ? 1 : 0); }

  function applyEvent(st, evId) {
    var ev = EVENT_BY_ID[evId];
    if (!ev || !legal(st, ev)) return false;
    var prev = st.cur;

    if (evId === "fork") {
      if (prev === "zombie") st.zombies += 1;   /* הבן הקודם נשאר בטבלה */
      st.seq += 1;
      if (st.mode === "thread") {
        st.pid = BASE_PID + 1;                  /* נימה: pid משלה */
        st.tgid = BASE_PID;                     /* אותו tgid כמו הנימה הראשית */
        st.ppid = BASE_PPID;
      } else {
        st.pid = BASE_PID + st.seq * 3;
        st.tgid = st.pid;
        st.ppid = st.orphan ? 1 : BASE_PPID;
      }
    }

    st.cur = ev.to;
    st.lastEdge = ev.edge;
    st.lastEvent = evId;
    pushLog(st, ev.btn, ev.log(st, prev));
    return true;
  }

  /* צעד מיוחד של תרחיש: האב מסיים לפני הבן (הרחבה — לא מהשקפים) */
  function applyOrphan(st) {
    st.orphan = true;
    st.ppid = 1;
    st.lastEdge = null;
    st.lastEvent = "@orphan";
    pushLog(st, "האב הסתיים",
      "<b>האב סיים לפני הבן.</b> מצב הבן לא השתנה — הוא ממשיך לרוץ — אבל הוא נשאר יתום, " +
      "ולכן הקרנל מחליף לו את ה-" + ltr("real_parent") + " ל-" + ltr("PID 1") +
      " (init/systemd), שיאסוף אותו כשיסיים. " +
      '<span class="ts-enrich">הרחבה — לא מהשקפים</span>');
    return true;
  }

  function pushLog(st, title, html) {
    st.log.push({ n: st.log.length + 1, title: title, html: html, state: st.cur });
    if (st.log.length > 60) st.log.shift();
  }

  /* =====================================================================
     STYLE (scoped, injected once)
     ===================================================================== */
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      ".viz-task-states{direction:rtl;min-height:460px;container-type:inline-size}" +
      ".viz-task-states .ts-lead{font-size:.85rem;color:var(--ink-soft);line-height:1.65;margin-bottom:.7rem}" +
      /* ברירת המחדל: התרשים ברוחב מלא והפאנל מתחתיו — כך הוא נשאר קריא בעמודת
         תוכן של 880px. במיכל רחב (‎≥1020px) הפאנל עובר לצד. */
      ".viz-task-states .ts-grid{display:grid;grid-template-columns:1fr;gap:14px;align-items:start}" +
      ".viz-task-states .ts-scene{background:var(--surface);border:1px solid var(--line);" +
      "border-radius:12px;padding:8px 4px;overflow:hidden;min-width:0}" +
      ".viz-task-states .ts-side{display:grid;gap:10px;min-width:0;align-items:start;" +
      "grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}" +
      "@container (min-width:1020px){" +
      ".viz-task-states .ts-grid{grid-template-columns:minmax(0,1fr) 320px}" +
      ".viz-task-states .ts-side{grid-template-columns:1fr}}" +
      ".viz-task-states .ts-card{background:var(--surface-2);border:1px solid var(--line);" +
      "border-radius:12px;padding:10px 12px}" +
      ".viz-task-states .ts-card h4{margin:0 0 .45rem;font-size:.8rem;font-weight:800;color:var(--ink-soft);" +
      "letter-spacing:.01em}" +
      ".viz-task-states .ts-badge{display:inline-block;background:var(--accent);color:#fff;font-weight:700;" +
      "font-size:.72rem;padding:2px 10px;border-radius:99px;margin-inline-end:6px}" +
      ".viz-task-states .ts-badge.err{background:var(--err)}" +
      ".viz-task-states .ts-badge.gone{background:var(--ink-soft)}" +
      ".viz-task-states .ts-state-body{margin-top:6px;font-size:.86rem;line-height:1.7;color:var(--ink)}" +
      ".viz-task-states .ts-struct{direction:ltr;text-align:left;font-family:ui-monospace,Consolas,monospace;" +
      "font-size:.76rem;line-height:1.75;color:var(--ink);white-space:pre;overflow-x:auto}" +
      ".viz-task-states .ts-struct .k{color:var(--ink-soft)}" +
      ".viz-task-states .ts-struct .v{font-weight:700}" +
      ".viz-task-states .ts-struct .hot{color:var(--accent);font-weight:800}" +
      ".viz-task-states .ts-struct .hot-err{color:var(--err);font-weight:800}" +
      ".viz-task-states .ts-struct .c{color:var(--ink-soft);opacity:.85}" +
      ".viz-task-states .ts-struct .he{unicode-bidi:isolate;direction:rtl}" +
      ".viz-task-states .ts-parent{font-size:.78rem;color:var(--ink-soft);line-height:1.7}" +
      ".viz-task-states .ts-parent b{color:var(--ink)}" +
      ".viz-task-states .ts-note{border-inline-start:3px solid var(--err);background:" +
      "color-mix(in srgb, var(--err) 10%, var(--surface));border-radius:8px;padding:8px 10px;" +
      "font-size:.8rem;line-height:1.65;color:var(--ink)}" +
      ".viz-task-states .ts-note.calm{border-inline-start-color:var(--accent);" +
      "background:color-mix(in srgb, var(--accent) 10%, var(--surface))}" +
      ".viz-task-states .ts-enrich{display:inline-block;background:var(--surface-2);border:1px solid var(--line);" +
      "border-radius:99px;padding:1px 8px;font-size:.7rem;font-weight:700;color:var(--ink-soft);margin-inline-start:4px}" +
      ".viz-task-states .ts-log{list-style:none;margin:0;padding:0;max-height:200px;overflow-y:auto;" +
      "font-size:.8rem;line-height:1.6}" +
      ".viz-task-states .ts-log li{padding:.4rem 0;border-top:1px dashed var(--line);color:var(--ink)}" +
      ".viz-task-states .ts-log li:first-child{border-top:none}" +
      ".viz-task-states .ts-log .num{display:inline-block;min-width:1.5em;font-weight:800;color:var(--accent)}" +
      ".viz-task-states .ts-log .lt{font-weight:800}" +
      ".viz-task-states .ts-log .empty{color:var(--ink-soft)}" +
      ".viz-task-states .ts-grouplabel{font-size:.76rem;font-weight:800;color:var(--ink-soft);" +
      "margin:.9rem 0 .35rem}" +
      ".viz-task-states .viz-controls{margin-top:0}" +
      ".viz-task-states .viz-btn{font-size:.82rem;padding:.34rem .8rem}" +
      ".viz-task-states .ts-count{margin-inline-start:auto;font-size:.8rem;font-weight:700;" +
      "color:var(--ink-soft);align-self:center}";
    document.head.appendChild(s);
  }

  /* =====================================================================
     בניית ה-SVG (פעם אחת) — הצביעה מתבצעת אחר כך מתוך אובייקט המצב
     ===================================================================== */
  var VB_W = 840, VB_H = 494, EDGE_FS = 11;

  function estWidth(lines) {
    var w = 0;
    lines.forEach(function (l) {
      var size = l.size || EDGE_FS;
      w = Math.max(w, l.t.length * size * (l.mono ? 0.6 : 0.55));
    });
    return w;
  }

  function buildScene(inst) {
    var mid = function (p) { return "tsmk-" + inst + "-" + p; };
    var svg = se("svg", {
      viewBox: "0 0 " + VB_W + " " + VB_H, width: "100%", role: "img", direction: "ltr",
      "aria-label": "תרשים מכונת המצבים של תהליך בלינוקס: TASK_RUNNING (בתור המעבד ועל ליבה), " +
        "TASK_INTERRUPTIBLE, TASK_UNINTERRUPTIBLE, TASK_STOPPED, EXIT_ZOMBIE ומחיקה מטבלת התהליכים"
    });
    svg.style.cssText = "display:block;max-width:" + VB_W + "px;margin:0 auto";

    var defs = se("defs", {}, svg);
    [["soft", "var(--ink-soft)"], ["accent", "var(--accent)"]].forEach(function (m) {
      var mk = se("marker", {
        id: mid(m[0]), viewBox: "0 0 10 10", refX: "8.5", refY: "5",
        markerWidth: "6.2", markerHeight: "6.2", orient: "auto-start-reverse"
      }, defs);
      se("path", { d: "M0 0 L10 5 L0 10 z", fill: m[1] }, mk);
    });

    /* מסגרת TASK_RUNNING סביב שני תת-המצבים */
    var frame = se("rect", {
      x: 258, y: 68, width: 524, height: 112, rx: 14,
      fill: "none", stroke: "var(--line)", "stroke-width": 1.5, "stroke-dasharray": "6 5"
    }, svg);
    var frameLbl = se("text", {
      x: 470, y: 84, "text-anchor": "end", direction: "rtl",
      "font-size": 11, "font-weight": 800, fill: "var(--ink-soft)"
    }, svg);
    frameLbl.textContent = "‏__state זהה בשני המצבים — TASK_RUNNING";

    /* נקודת ההתחלה */
    var startOuter = se("circle", {
      cx: 380, cy: 40, r: 13, fill: "var(--surface)", stroke: "var(--ink-soft)", "stroke-width": 2
    }, svg);
    var startInner = se("circle", { cx: 380, cy: 40, r: 6, fill: "var(--ink-soft)" }, svg);
    var startLbl = se("text", {
      x: 358, y: 45, "text-anchor": "start", direction: "rtl",
      "font-size": 11, "font-weight": 700, fill: "var(--ink-soft)"
    }, svg);
    startLbl.textContent = "אין תהליך";

    /* קשתות — קודם, כדי שהתיבות יצוירו מעליהן */
    var edgeRefs = {};
    Object.keys(EDGES).forEach(function (key) {
      var e = EDGES[key];
      var g = se("g", {}, svg);
      var path = se("path", {
        d: e.d, fill: "none", stroke: "var(--ink-soft)", "stroke-width": 2,
        "stroke-linecap": "round", "stroke-linejoin": "round",
        "marker-end": "url(#" + mid("soft") + ")"
      }, g);
      edgeRefs[key] = { g: g, path: path, texts: [], chip: null, e: e };
    });

    /* תיבות המצבים */
    var nodeRefs = {};
    Object.keys(NODES).forEach(function (key) {
      var n = NODES[key];
      var g = se("g", {}, svg);
      var rect = se("rect", {
        x: n.x, y: n.y, width: n.w, height: n.h, rx: 10,
        fill: "var(--surface)", stroke: "var(--line)", "stroke-width": 2
      }, g);
      if (n.dashed) rect.setAttribute("stroke-dasharray", "5 4");
      var texts = [];
      var total = n.lines.length;
      n.lines.forEach(function (ln, i) {
        var startY = n.y + n.h / 2 + 4 - (total - 1) * 7.5;
        var t = se("text", {
          x: n.x + n.w / 2, y: startY + i * 15, "text-anchor": "middle",
          "font-size": ln.size || 12, "font-weight": ln.bold ? 800 : 600,
          fill: ln.soft ? "var(--ink-soft)" : "var(--ink)"
        }, g);
        if (ln.mono) t.setAttribute("font-family", "ui-monospace, Consolas, monospace");
        if (ln.rtl) t.setAttribute("direction", "rtl");
        t.textContent = ln.t;
        texts.push({ el: t, ln: ln });
      });
      nodeRefs[key] = { g: g, rect: rect, texts: texts, n: n };
    });

    /* תוויות הקשתות — "צ׳יפ" עם רקע אטום, כדי שקווים חוצים לא יפריעו */
    Object.keys(EDGES).forEach(function (key) {
      var e = EDGES[key], ref = edgeRefs[key];
      var w = estWidth(e.lines) + 11;
      var h = e.lines.length * 13.5 + 7;
      var x = e.anchor === "start" ? e.lx - 5 : (e.anchor === "end" ? e.lx - w + 5 : e.lx - w / 2);
      var chip = se("rect", {
        x: x, y: e.ly - h / 2, width: w, height: h, rx: 5,
        fill: "var(--surface)", opacity: 0.93
      }, ref.g);
      ref.chip = chip;
      e.lines.forEach(function (ln, i) {
        var t = se("text", {
          x: e.lx, y: e.ly - h / 2 + 12 + i * 13.5,
          "text-anchor": visualAnchor(e.anchor, ln.rtl),
          "font-size": EDGE_FS, "font-weight": 700, fill: "var(--ink-soft)"
        }, ref.g);
        if (ln.mono) t.setAttribute("font-family", "ui-monospace, Consolas, monospace");
        if (ln.rtl) t.setAttribute("direction", "rtl");
        t.textContent = ln.t;
        ref.texts.push(t);
      });
    });

    /* תג מונה הזומבים (ליד תיבת EXIT_ZOMBIE) */
    var zg = se("g", { opacity: 0 }, svg);
    var zRect = se("rect", {
      x: 78, y: 322, width: 186, height: 30, rx: 15,
      fill: "color-mix(in srgb, var(--err) 16%, var(--surface))",
      stroke: "var(--err)", "stroke-width": 1.5
    }, zg);
    var zText = se("text", {
      x: 171, y: 342, "text-anchor": "middle", direction: "rtl",
      "font-size": 12, "font-weight": 800, fill: "var(--err)"
    }, zg);
    zText.textContent = "זומבים בטבלה: 0";

    /* תג "על ליבה" ליד המצב הרץ */
    var cg = se("g", { opacity: 0 }, svg);
    se("rect", {
      x: 636, y: 40, width: 126, height: 25, rx: 12.5,
      fill: "color-mix(in srgb, var(--ok) 16%, var(--surface))",
      stroke: "var(--ok)", "stroke-width": 1.5
    }, cg);
    var cText = se("text", {
      x: 699, y: 57, "text-anchor": "middle", direction: "rtl",
      "font-size": 11, "font-weight": 800, fill: "var(--ok)"
    }, cg);
    cText.textContent = "צורך זמן CPU";

    /* תג "לא צורך CPU" ליד מצבי השינה */
    var sg = se("g", { opacity: 0 }, svg);
    se("rect", {
      x: 588, y: 296, width: 172, height: 25, rx: 12.5,
      fill: "var(--surface-2)", stroke: "var(--line)", "stroke-width": 1.5
    }, sg);
    var sText = se("text", {
      x: 674, y: 313, "text-anchor": "middle", direction: "rtl",
      "font-size": 11, "font-weight": 800, fill: "var(--ink-soft)"
    }, sg);
    sText.textContent = "מחוץ לתור המתזמן";

    return {
      svg: svg, mid: mid, nodes: nodeRefs, edges: edgeRefs,
      frame: frame, startOuter: startOuter, startInner: startInner,
      zg: zg, zRect: zRect, zText: zText, cg: cg, sg: sg, sText: sText
    };
  }

  /* צביעת הסצנה מתוך המצב */
  function paintScene(sc, st) {
    var cur = st.cur;

    Object.keys(sc.nodes).forEach(function (key) {
      var r = sc.nodes[key], on = key === cur;
      var tone = "var(--accent)";
      if (key === "zombie") tone = "var(--err)";
      else if (key === "reaped") tone = "var(--ink-soft)";
      if (on) {
        r.rect.setAttribute("fill", "color-mix(in srgb, " + tone + " 18%, var(--surface))");
        r.rect.setAttribute("stroke", tone);
        r.rect.setAttribute("stroke-width", 3.2);
        r.g.setAttribute("opacity", 1);
      } else {
        r.rect.setAttribute("fill", "var(--surface)");
        r.rect.setAttribute("stroke", "var(--line)");
        r.rect.setAttribute("stroke-width", 2);
        r.g.setAttribute("opacity", cur === "none" ? 0.9 : 0.62);
      }
      r.texts.forEach(function (tx) {
        tx.el.setAttribute("fill", on && !tx.ln.soft ? tone
          : (tx.ln.soft ? "var(--ink-soft)" : "var(--ink)"));
      });
    });

    /* מסגרת TASK_RUNNING מודגשת כשאנחנו בתוכה */
    var inRunning = cur === "ready" || cur === "running";
    sc.frame.setAttribute("stroke", inRunning ? "var(--accent)" : "var(--line)");
    sc.frame.setAttribute("opacity", inRunning ? 0.75 : 0.5);

    /* נקודת ההתחלה */
    var atStart = cur === "none";
    sc.startOuter.setAttribute("stroke", atStart ? "var(--accent)" : "var(--ink-soft)");
    sc.startInner.setAttribute("fill", atStart ? "var(--accent)" : "var(--ink-soft)");

    /* קשתות: הקשת האחרונה שנעשה בה שימוש מודגשת; החוקיות ברורות; השאר עמומות */
    var legalEdges = {};
    EVENTS.forEach(function (ev) {
      if (legal(st, ev)) legalEdges[ev.edge] = true;
    });
    Object.keys(sc.edges).forEach(function (key) {
      var r = sc.edges[key];
      var isLast = st.lastEdge === key;
      var isLegal = !!legalEdges[key];
      r.path.setAttribute("stroke", isLast ? "var(--accent)" : "var(--ink-soft)");
      r.path.setAttribute("stroke-width", isLast ? 3.4 : 2);
      r.path.setAttribute("marker-end", "url(#" + sc.mid(isLast ? "accent" : "soft") + ")");
      r.g.setAttribute("opacity", isLast ? 1 : (isLegal ? 0.85 : 0.26));
      r.texts.forEach(function (t) {
        t.setAttribute("fill", isLast ? "var(--accent)" : "var(--ink-soft)");
        t.setAttribute("font-weight", isLast ? 800 : 700);
      });
    });

    /* תגים */
    var zt = zombieTotal(st);
    sc.zg.setAttribute("opacity", zt > 0 ? 1 : 0);
    sc.zText.textContent = "זומבים בטבלה: " + zt;
    sc.cg.setAttribute("opacity", cur === "running" ? 1 : 0);
    var sleeping = cur === "interruptible" || cur === "uninterruptible";
    sc.sg.setAttribute("opacity", sleeping ? 1 : 0);
  }

  /* =====================================================================
     כרטיס ה-task_struct
     ===================================================================== */
  /* הערה בעברית בתוך בלוק קוד LTR — הסוגריים נשארים בחוץ כדי שלא יתהפכו */
  function heComment(he) {
    return ' <span class="c">/* <span class="he">' + he + "</span> */</span>";
  }

  function structHTML(st) {
    var info = STATE_INFO[st.cur];
    var hot = st.cur === "zombie" ? "hot-err" : "hot";
    var stateVal = st.cur === "none"
      ? '<span class="c">/* <span class="he">טרם קיים</span> */</span>'
      : '<span class="' + hot + '">' + info.konst + "</span>" +
        (info.hex ? ' <span class="c">/* ' + info.hex + " */</span>" : "");
    var pid = st.cur === "none" ? "—" : String(st.pid);
    var tgid = st.cur === "none" ? "—" : String(st.tgid);
    var ppid = st.cur === "none" ? "—" : String(st.ppid);
    var ppidNote = st.ppid === 1 && st.cur !== "none"
      ? ' <span class="c">/* init/systemd */</span>' : "";
    var tgidNote = st.mode === "thread" && st.cur !== "none"
      ? heComment("נימה — tgid של התהליך")
      : (st.cur !== "none" ? ' <span class="c">/* = pid */</span>' : "");
    return "struct task_struct {\n" +
      '  <span class="k">__state</span>      = ' + stateVal + "\n" +
      '  <span class="k">pid</span>          = <span class="v">' + pid + "</span>\n" +
      '  <span class="k">tgid</span>         = <span class="v">' + tgid + "</span>" + tgidNote + "\n" +
      '  <span class="k">real_parent</span>  → <span class="v">' + ppid + "</span>" + ppidNote + "\n" +
      '  <span class="k">children</span>     = <span class="v">0</span>' +
      heComment("אין לו בנים משלו") + "\n" +
      "};";
  }

  function parentHTML(st) {
    var alive = (st.cur !== "none" && st.cur !== "reaped" && st.cur !== "zombie") ? 1 : 0;
    var zt = zombieTotal(st);
    var kids = alive + zt;
    if (st.mode === "thread") {
      return "התהליך שאליו שייכת הנימה: " + ltr("tgid " + BASE_PID) +
        ". כל הנימות חולקות " + ltr("tgid") + " אחד — " + ltr("getpid()") +
        " יחזיר לכולן את אותו מספר.";
    }
    if (st.ppid === 1 && st.cur !== "none") {
      return "<b>האב המקורי (" + ltr("pid " + BASE_PPID) + ") כבר הסתיים.</b> " +
        "האב הנוכחי הוא " + ltr("init/systemd (PID 1)") + " — הוא קורא " + ltr("wait()") +
        " ברקע ולכן יתומים לעולם לא נשארים זומבים.";
    }
    return "האב " + ltr("pid " + BASE_PPID) + " (השרת): " +
      "<b>children = " + kids + "</b>" +
      (zt > 0 ? " — מתוכם <b>" + zt + " זומבים</b> שלא נאספו" : "") + ".";
  }

  /* =====================================================================
     Render one mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-ts-ready") === "1") return;
    mount.setAttribute("data-ts-ready", "1");
    mount.innerHTML = "";
    ensureStyle();

    var inst = ++instCount;
    var stepMs = parseInt(mount.getAttribute("data-step-ms"), 10);
    if (!isFinite(stepMs) || stepMs < 20) stepMs = 1000;

    var st = initialState("proc");
    var timer = null;

    var root = ce("div", "viz-task-states", null);
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", "מכונת המצבים של תהליך — סייר אינטראקטיבי");

    var lead = ce("div", "ts-lead", root);
    lead.innerHTML = "כל תהליך בלינוקס נמצא בכל רגע במצב אחד, ששמור בשדה " + ltr("__state") +
      " שב-" + ltr("task_struct") + ". לחצו על אירוע (רק המעברים החוקיים פעילים) או הריצו " +
      "תרחיש מוכן, וראו איך המצב, הכרטיס והיומן משתנים.";

    var grid = ce("div", "ts-grid", root);
    var sceneBox = ce("div", "ts-scene", grid);
    var scene = buildScene(inst);
    sceneBox.appendChild(scene.svg);

    var side = ce("div", "ts-side", grid);

    var stateCard = ce("div", "ts-card", side);
    stateCard.setAttribute("aria-live", "polite");

    var structCard = ce("div", "ts-card", side);
    ce("h4", null, structCard, "כרטיס ה-task_struct");
    var structPre = ce("div", "ts-struct", structCard);
    var parentP = ce("div", "ts-parent", structCard);
    parentP.style.marginTop = ".5rem";

    var noteBox = ce("div", "ts-note", side);
    noteBox.hidden = true;

    var logCard = ce("div", "ts-card", side);
    ce("h4", null, logCard, "יומן המעברים");
    var logList = ce("ol", "ts-log", logCard);
    logList.setAttribute("aria-live", "polite");

    /* ---------------- controls ---------------- */
    ce("div", "ts-grouplabel", root, "אירועים — רק המעברים החוקיים מהמצב הנוכחי פעילים");
    var evRow = ce("div", "viz-controls", root);
    var evBtns = {};
    EVENTS.forEach(function (ev) {
      var b = ce("button", "viz-btn", evRow, ev.btn);
      b.type = "button";
      b.setAttribute("data-ev", ev.id);
      b.addEventListener("click", function () { manual(ev.id); });
      evBtns[ev.id] = b;
    });
    var resetBtn = ce("button", "viz-btn", evRow, "⟳ מהתחלה");
    resetBtn.type = "button";
    resetBtn.setAttribute("data-ev", "reset");
    resetBtn.addEventListener("click", function () { reset(); });

    ce("div", "ts-grouplabel", root, "תרחישים — הרצה אוטומטית");
    var psRow = ce("div", "viz-controls", root);
    var psBtns = {};
    PRESETS.forEach(function (p) {
      var b = ce("button", "viz-btn", psRow, p.btn);
      b.type = "button";
      b.setAttribute("data-preset", p.id);
      b.addEventListener("click", function () { startPreset(p.id); });
      psBtns[p.id] = b;
    });
    var pauseBtn = ce("button", "viz-btn", psRow, "⏸ השהה");
    pauseBtn.type = "button";
    pauseBtn.setAttribute("data-ev", "pause");
    pauseBtn.disabled = true;
    pauseBtn.addEventListener("click", function () { togglePause(); });
    var counter = ce("span", "ts-count", psRow);

    mount.appendChild(root);

    /* ---------------- actions ---------------- */
    function stopTimer() {
      if (timer) { clearTimeout(timer); timer = null; }
    }

    function manual(evId) {
      stopTimer();
      st.playing = false;
      st.preset = null;
      applyEvent(st, evId);
      paint();
    }

    function reset() {
      stopTimer();
      st = initialState("proc");
      paint();
    }

    function startPreset(id) {
      stopTimer();
      var p = PRESET_BY_ID[id];
      if (!p) return;
      st = initialState(p.mode);
      st.preset = id;
      st.presetStep = 0;
      st.playing = true;
      pushLog(st, "תרחיש: " + p.btn, p.intro);
      paint();
      timer = setTimeout(tick, Math.max(stepMs * 0.6, 60));
    }

    function tick() {
      timer = null;
      if (!st.playing || !st.preset) return;
      var p = PRESET_BY_ID[st.preset];
      if (!p || st.presetStep >= p.steps.length) {
        st.playing = false;
        paint();
        return;
      }
      var step = p.steps[st.presetStep++];
      if (step === "@orphan") applyOrphan(st);
      else applyEvent(st, step);
      var done = st.presetStep >= p.steps.length;
      if (done) st.playing = false;
      paint();
      if (!done) timer = setTimeout(tick, stepMs);
    }

    function togglePause() {
      if (!st.preset) return;
      if (st.playing) {
        st.playing = false;
        stopTimer();
      } else {
        var p = PRESET_BY_ID[st.preset];
        if (!p || st.presetStep >= p.steps.length) return;
        st.playing = true;
        timer = setTimeout(tick, Math.max(stepMs * 0.4, 40));
      }
      paint();
    }

    /* ---------------- paint (everything derives from `st`) ---------------- */
    function paint() {
      var info = STATE_INFO[st.cur];
      root.setAttribute("data-state", st.cur);
      root.setAttribute("data-preset", st.preset || "");
      root.setAttribute("data-playing", st.playing ? "1" : "0");

      paintScene(scene, st);

      var badgeCls = st.cur === "zombie" ? "ts-badge err"
        : (st.cur === "reaped" || st.cur === "none" ? "ts-badge gone" : "ts-badge");
      stateCard.innerHTML =
        '<span class="' + badgeCls + '">' + (info.konst === "—" ? "מצב" : info.konst) + "</span>" +
        "<b>" + info.he + "</b>" +
        '<div class="ts-state-body">' + info.body + "</div>";

      structPre.innerHTML = structHTML(st);
      parentP.innerHTML = parentHTML(st);

      /* הערות הקשריות */
      var note = null, calm = false;
      var zt = zombieTotal(st);
      if (zt >= 2) {
        note = "<b>טבלת התהליכים מתמלאת</b> — כבר " + zt + " זומבים שלא נאספו. אם השרת ירוץ " +
          "כך זמן רב לא יהיה אפשר ליצור תהליכים חדשים. זו בדיוק <b>שאלה 11 במבחן לדוגמה</b>: " +
          "מה קורה אם האב לא מבצע " + ltr("waitpid()") + " בכלל. הפתרון בהנדאוט: " +
          ltr("while (waitpid(-1, NULL, WNOHANG) > 0);");
      } else if (zt === 1 && st.cur === "zombie") {
        note = "הבן סיים, אבל הוא עדיין תופס שורה בטבלת התהליכים. עד שהאב לא יקרא ל-" +
          ltr("wait()") + " / " + ltr("waitpid()") + " — הזומבי לא ייעלם.";
      } else if (st.cur === "interruptible") {
        calm = true;
        note = "בזמן ההמתנה <b>לא מתבזבז זמן CPU</b>: הקרנל הוציא את התהליך מתור התזמון, " +
          "והליבה פנויה לתהליכים אחרים.";
      } else if (st.cur === "uninterruptible") {
        calm = true;
        note = "אות (Signal) <b>לא</b> יעיר את התהליך כאן — רק סיום פעולת ה-I/O. זה ההבדל " +
          "המעשי בין שני מצבי השינה.";
      } else if (st.ppid === 1 && st.cur !== "none") {
        calm = true;
        note = "התהליך יתום ואומץ על ידי " + ltr("PID 1") + ". " +
          '<span class="ts-enrich">הרחבה — לא מהשקפים</span>';
      }
      if (note) { noteBox.hidden = false; noteBox.innerHTML = note; }
      else { noteBox.hidden = true; noteBox.innerHTML = ""; }
      noteBox.className = calm ? "ts-note calm" : "ts-note";

      /* יומן */
      logList.innerHTML = "";
      if (!st.log.length) {
        var li0 = ce("li", "empty", logList);
        li0.innerHTML = "עדיין לא בוצע אף מעבר. התחילו ב-" + ltr("fork()") + ".";
      } else {
        st.log.forEach(function (entry) {
          var li = ce("li", null, logList);
          li.innerHTML = '<span class="num">' + entry.n + ".</span> " +
            '<span class="lt">' + entry.title + "</span> — " + entry.html;
        });
        logList.scrollTop = logList.scrollHeight;
      }

      /* כפתורים */
      EVENTS.forEach(function (ev) {
        var b = evBtns[ev.id], ok = legal(st, ev);
        b.disabled = !ok;
        b.setAttribute("aria-disabled", ok ? "false" : "true");
        b.classList.toggle("primary", ok && st.cur === "none" && ev.id === "fork");
      });
      PRESETS.forEach(function (p) {
        var b = psBtns[p.id];
        b.classList.toggle("primary", st.preset === p.id);
        b.setAttribute("aria-pressed", st.preset === p.id ? "true" : "false");
      });
      var pr = st.preset ? PRESET_BY_ID[st.preset] : null;
      var canPause = !!(pr && st.presetStep < pr.steps.length);
      pauseBtn.disabled = !canPause;
      pauseBtn.textContent = st.playing ? "⏸ השהה" : "▶ המשך";
      counter.textContent = pr
        ? "צעד " + Math.min(st.presetStep, pr.steps.length) + " / " + pr.steps.length
        : "";
    }

    paint();
  }

  /* =====================================================================
     boot — mount all instances; never throw; graceful if absent.
     ===================================================================== */
  function boot() {
    try {
      var mounts = document.querySelectorAll('[data-viz="' + VIZ_ID + '"]');
      if (!mounts || !mounts.length) return;
      Array.prototype.forEach.call(mounts, function (m) { render(m); });
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
