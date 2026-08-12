/* =====================================================================
   fd-chain.js — שרשרת התרגום של File Descriptor:
   Process (task_struct→files) → fd_array → struct file → in-core inode
   → data blocks, בשלושה תרחישים.

   Grounded in the lecturer's handouts:
   - _notes/syscall-open.md   — ה-fd הוא אינדקס למקום הפנוי הראשון בטבלת
     current->files (struct files_struct); struct file שומר File Offset
     (מתחיל ב-0) והדגלים (O_RDWR).
   - _notes/syscall-read.md   — בדיקת f_mode; f_pos מתקדם בדיוק במספר
     הבייטים שנקראו; שני תהליכים שפתחו את אותו קובץ בנפרד מחזיקים מצביעי
     f_pos נפרדים ועצמאיים לחלוטין; Page Cache מנוהל ברמת ה-Inode; עץ
     Extents / bio / blk-mq / NVMe ב-Cache Miss.
   - _notes/syscall-close.md  — fork()/dup()/dup2() גורמים לשני FDs להצביע
     על אותו struct file; f_count = Reference Counting; fput מפחית אטומית
     (atomic_long_sub_and_test); רק ב-f_count==0 מופעל release ומתבצע
     ניקוי מלא (dput/iput, שחרור ל-SLAB filp_cachep); התא בטבלה מתפנה
     להקצאה מחדש.
   - _notes/task-struct.md    — task_struct.files → struct files_struct
     (מפת ביטים + מערך מצביעים); בלעדיו אין read/write/close.
   - _notes/inodes-incore-vs-disk.md — In-Core inode = ממשק VFS אוניברסלי
     בזיכרון, מוני הפניות, מנעולים, דגל dirty.

   Mount: <div class="viz" data-viz="fd-chain"></div>
   Self-contained IIFE, zero deps, file:// friendly, theme-aware (CSS
   custom properties only). RTL Hebrew chrome; the drawing is dir="ltr".
   Click any element in the chain → its path lights up + Hebrew
   explanation; three scenario buttons re-render the diagram.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "fd-chain";
  var SVGNS = "http://www.w3.org/2000/svg";
  var STYLE_ID = "fd-chain-style";
  var instCount = 0;

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

  /* =====================================================================
     Shared info texts (Hebrew, grounded in the handouts)
     ===================================================================== */
  function stdCellInfo() {
    return {
      badge: "File Descriptor",
      title: "fd 0–2 — תפוסים מראש",
      body: "תיאור קובץ הוא בסך הכול <b>אינדקס</b> במערך. התאים 0, 1 ו-2 תפוסים כבר מרגע " +
        "יצירת התהליך (הערוצים הסטנדרטיים שלו), ולכן ה-open() הראשון מקבל את <b>המקום הפנוי " +
        "הראשון בטבלה</b> — אינדקס 3, בדיוק כמו בדוגמת ה-open מההנדאוט."
    };
  }
  function emptyCellInfo() {
    return {
      badge: "File Descriptor",
      title: "תא פנוי",
      body: "תא שעדיין לא הוקצה. open() נוסף יקבל את האינדקס הפנוי הנמוך ביותר; ואחרי close() " +
        "התא שהתפנה חוזר למאגר — הקרנל מאפס את הסיבית במפת הביטים, והמספר יוקצה מחדש לקובץ " +
        "או לסוקט שייפתחו בעתיד (מההנדאוט של close)."
    };
  }
  function blocksInfo() {
    return {
      badge: "אחסון",
      title: "Data Blocks — הנתונים עצמם על ה-SSD",
      body: "הבייטים של הקובץ יושבים בבלוקים פיזיים על ההתקן. כשקריאה מחטיאה את ה-Page Cache‏ " +
        "(Cache Miss), עץ ה-Extents של ה-inode מתרגם את הדרישה הלוגית לבלוקים פיזיים, הקרנל " +
        "מייצר אובייקט " + ltr("bio") + " ושולח בקשת I/O דרך שכבת " + ltr("blk-mq") + " ובקר " +
        "ה-NVMe — והבלוקים נטענים אל ה-Page Cache שב-RAM (שלב 5 באלגוריתם של read)."
    };
  }
  function inodeInfo(extra) {
    return {
      badge: "inode",
      title: "In-Core inode — הקובץ עצמו, פעם אחת בזיכרון",
      body: ltr("struct inode") + " הוא הייצוג של הקובץ בזיכרון הליבה — האובייקט האוניברסלי " +
        "שדרכו ה-VFS עובד מול כל מערכת קבצים (ext4, Btrfs ועוד). לכל קובץ יש inode אחד בזיכרון " +
        "גם אם נפתח פעמים רבות — כל אובייקטי ה-struct file מצביעים אליו. הוא מנהל את ה-Page " +
        "Cache של הקובץ, מוני הפניות (i_count), מנעולים ודגל dirty. ב-close() האחרון מופעל " +
        ltr("iput") + " שמפחית את מונה ההפניות — ובאפס ה-inode משוחרר מטבלת ה-Hash של הליבה." +
        (extra || "")
    };
  }
  function procInfoAB() {
    return {
      badge: "תהליך",
      title: "task_struct → files — טבלת ה-FD של התהליך",
      body: ltr("task_struct") + " (מוגדר ב-" + ltr("include/linux/sched.h") + ") מייצג את " +
        "התהליך כולו; השדה " + ltr("files") + " מצביע ל-" + ltr("struct files_struct") + " — " +
        "טבלת תיאורי הקבצים: מפת ביטים + מערך מצביעים (fd_array) לכל הקבצים הפתוחים. זה המבנה " +
        "שמתרגם את המספר הקטן שהתוכנית רואה (fd=3) למצביע אל אובייקט הקובץ בזיכרון הליבה — " +
        "בלעדיו אין read, write או close."
    };
  }

  /* box line builders */
  function procLines(nameHe, compact) {
    var l = [
      { t: "task_struct", dy: 24, mono: 1, bold: 1, size: 13 },
      { t: nameHe, dy: 46, rtl: 1, size: 11.5 }
    ];
    l.push({ t: "files ▸ fd_array", dy: compact ? 64 : 68, mono: 1, size: 10, soft: 1 });
    return l;
  }
  function fileLines(fpos, fcount) {
    return [
      { t: "struct file", dy: 22, mono: 1, bold: 1, size: 13 },
      { t: "f_pos = " + fpos, dy: 44, mono: 1, size: 11.5 },
      { t: "f_count = " + fcount, dy: 62, mono: 1, size: 11.5,
        fill: fcount > 1 ? "var(--err)" : null, bold: fcount > 1 },
      { t: "f_mode = O_RDWR", dy: 80, mono: 1, size: 11.5 }
    ];
  }
  function inodeLines() {
    return [
      { t: "inode", dy: 26, mono: 1, bold: 1, size: 13 },
      { t: "In-Core · RAM", dy: 48, size: 10.5, soft: 1 },
      { t: "Page Cache", dy: 70, mono: 1, size: 10.5, soft: 1 }
    ];
  }

  /* cells helper: returns cell nodes + logical edges tbl->cell */
  function makeCells(prefix, tblId, x, ys, h, active3, info3, info4, nodes, edges) {
    for (var i = 0; i < 5; i++) {
      var style = i < 3 ? "std" : (i === 3 ? "active" : "empty");
      if (!active3 && i === 3) style = "std";
      var id = prefix + "fd" + i;
      nodes.push({
        id: id, kind: "cell", x: x, y: ys[i], w: 58, h: h, num: i, style: style,
        info: i < 3 ? stdCellInfo() : (i === 3 ? info3 : (info4 || emptyCellInfo()))
      });
      edges.push({ from: tblId, to: id }); /* logical, not drawn */
    }
  }

  /* =====================================================================
     Scenario builders
     ===================================================================== */
  function scenarioA() {
    var nodes = [], edges = [];
    nodes.push({
      id: "proc", kind: "box", x: 12, y: 124, w: 124, h: 92,
      lines: procLines("התהליך שלך", false), info: procInfoAB()
    });
    nodes.push({ id: "tbl", kind: "frame", x: 176, y: 76, w: 64, h: 166, label: "fd_array" });
    makeCells("", "tbl", 179, [79, 111, 143, 175, 207], 30, true, {
      badge: "File Descriptor",
      title: "fd = 3 — ה-FD הוא רק אינדקס",
      body: "open() סרק את הטבלה, מצא את <b>התא הפנוי הראשון</b> (3) ורשם בו מצביע ל-" +
        ltr("struct file") + ". התוכנית מקבלת בחזרה רק את המספר 3 — וכל read/write עתידי " +
        "יתורגם דרך התא הזה. שימוש ב-fd לא תקין או סגור נעצר מיד עם " + ltr("-EBADF") +
        "‏ (Bad file descriptor)."
    }, null, nodes, edges);
    nodes.push({
      id: "fileA", kind: "box", x: 312, y: 126, w: 168, h: 96, lines: fileLines(0, 1),
      info: {
        badge: "struct file",
        title: "struct file — אובייקט הפתיחה",
        body: "נוצר ב-open() ושומר את מצב הפתיחה הנוכחי: <b>f_pos</b> — מצביע המיקום " +
          "(File Offset), מתחיל ב-0 ומתקדם בכל read בדיוק במספר הבייטים שנקראו בפועל; " +
          "<b>f_count</b> — מונה ההפניות (Reference Counting), כרגע 1 כי רק fd אחד מחזיק " +
          "אותו; <b>f_mode</b> — מצב הפתיחה: read על קובץ שנפתח רק ל-O_WRONLY ייחסם עם " +
          ltr("-EBADF") + ". ב-close() מופעל " + ltr("fput") + " שמוריד את f_count — ורק " +
          "כשהוא מגיע ל-0 האובייקט מושמד וזיכרונו חוזר למטמון ה-SLAB‏ (filp_cachep)."
      }
    });
    nodes.push({
      id: "inode", kind: "box", x: 528, y: 126, w: 112, h: 96, lines: inodeLines(),
      info: inodeInfo("")
    });
    nodes.push({ id: "blocks", kind: "blocks", x: 664, top: 134, info: blocksInfo() });
    edges.push({ from: "proc", to: "tbl", pts: [136, 170, 174, 170] });
    edges.push({ from: "fd3", to: "fileA", pts: [237, 190, 310, 174] });
    edges.push({ from: "fileA", to: "inode", pts: [480, 174, 526, 174] });
    edges.push({ from: "inode", to: "blocks", pts: [640, 174, 662, 174] });
    return {
      vb: "0 40 720 235", nodes: nodes, edges: edges,
      overview: {
        badge: "תרחיש א׳",
        title: "open() אחד — השרשרת הבסיסית",
        body: "open() איתר את ה-inode של הקובץ, יצר אובייקט " + ltr("struct file") + " חדש " +
          "(f_pos מתחיל ב-0), מצא את התא הפנוי הראשון בטבלת ה-FD של התהליך — אינדקס 3 — " +
          "ורשם בו מצביע לאובייקט. מעכשיו כל " + ltr("read(3, ...)") + " יתורגם דרך השרשרת " +
          "הזו. <b>לחצו על כל רכיב בשרשרת</b> כדי להכיר אותו מקרוב."
      }
    };
  }

  function scenarioB() {
    var nodes = [], edges = [];
    nodes.push({
      id: "proc", kind: "box", x: 12, y: 124, w: 124, h: 92,
      lines: procLines("התהליך שלך", false), info: procInfoAB()
    });
    nodes.push({ id: "tbl", kind: "frame", x: 176, y: 76, w: 64, h: 166, label: "fd_array" });
    makeCells("", "tbl", 179, [79, 111, 143, 175, 207], 30, true, {
      badge: "File Descriptor",
      title: "fd = 3 — הפתיחה הראשונה",
      body: "מצביע על ה-" + ltr("struct file") + " העליון, שיש לו f_pos משלו. " +
        ltr("read(3, ...)") + " יקדם רק את המצביע הזה — fd 4 לא ירגיש דבר."
    }, {
      badge: "File Descriptor",
      title: "fd = 4 — הפתיחה השנייה",
      body: "קריאת open() שנייה על אותו נתיב קיבלה את התא הפנוי הבא (4) ואובייקט " +
        ltr("struct file") + " חדש ונפרד. שני ה-FDs מובילים לאותו קובץ על הדיסק — אבל דרך " +
        "אובייקטי פתיחה שונים לגמרי."
    }, nodes, edges);
    /* fd4 is a real, active cell in this scenario */
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === "fd4") { nodes[i].style = "active"; nodes[i].num = 4; }
    }
    nodes.push({
      id: "fileA", kind: "box", x: 312, y: 30, w: 168, h: 96, lines: fileLines(120, 1),
      info: {
        badge: "struct file",
        title: "ה-struct file של fd 3 — f_pos עצמאי",
        body: "אובייקט נפרד לחלוטין מזה של fd 4: כאן f_pos=120 (אחרי שנקראו 120 בייטים דרך " +
          "fd 3), בעוד שלמטה f_pos=0. כדברי ההנדאוט של read: שני תהליכים (או שתי פתיחות) " +
          "שפתחו את אותו קובץ בנפרד מחזיקים מצביעי f_pos <b>נפרדים ועצמאיים לחלוטין</b>. " +
          "f_count=1 בכל אחד — כל אובייקט מוחזק על ידי fd יחיד."
      }
    });
    nodes.push({
      id: "fileB", kind: "box", x: 312, y: 216, w: 168, h: 96, lines: fileLines(0, 1),
      info: {
        badge: "struct file",
        title: "ה-struct file של fd 4 — עוד אובייקט, אותו קובץ",
        body: "הפתיחה השנייה יצרה אובייקט חדש עם f_pos=0 משלו — הקריאות שבוצעו דרך fd 3 לא " +
          "הזיזו אותו. close(3) ישמיד רק את האובייקט העליון (ה-f_count שלו יירד ל-0); " +
          "האובייקט הזה יישאר חי — ולכן גם ה-inode יישאר בשימוש."
      }
    });
    nodes.push({
      id: "inode", kind: "box", x: 528, y: 126, w: 112, h: 96, lines: inodeLines(),
      info: inodeInfo(" <b>שימו לב:</b> כאן שני אובייקטי struct file שונים מצביעים על אותו inode יחיד.")
    });
    nodes.push({ id: "blocks", kind: "blocks", x: 664, top: 134, info: blocksInfo() });
    nodes.push({
      id: "noteB", kind: "note", x: 396, y: 180,
      t: "שני אובייקטים נפרדים — לכל פתיחה f_pos משלה!"
    });
    edges.push({ from: "proc", to: "tbl", pts: [136, 170, 174, 170] });
    edges.push({ from: "fd3", to: "fileA", pts: [237, 190, 310, 78] });
    edges.push({ from: "fd4", to: "fileB", pts: [237, 222, 310, 264] });
    edges.push({ from: "fileA", to: "inode", pts: [480, 78, 526, 156] });
    edges.push({ from: "fileB", to: "inode", pts: [480, 264, 526, 192] });
    edges.push({ from: "inode", to: "blocks", pts: [640, 174, 662, 174] });
    return {
      vb: "0 10 720 320", nodes: nodes, edges: edges,
      overview: {
        badge: "תרחיש ב׳",
        title: "אותו קובץ נפתח פעמיים — שני struct file נפרדים",
        body: "שתי קריאות open() לאותו קובץ יוצרות <b>שני אובייקטי struct file נפרדים " +
          "לחלוטין</b> — כל אחד עם f_pos עצמאי ו-f_count=1 משלו — אבל שניהם מצביעים על אותו " +
          "In-Core inode יחיד. לכן read דרך fd 3 לא מזיז את מצביע הקריאה של fd 4 (מההנדאוט " +
          "של read: מצביעי f_pos נפרדים ועצמאיים לחלוטין). לחצו על הרכיבים כדי להשוות."
      }
    };
  }

  function scenarioC() {
    var nodes = [], edges = [];
    var fd3Info = {
      badge: "File Descriptor",
      title: "fd = 3 בשני תהליכים — אותו מצביע",
      body: "אותו מספר (3) בשתי טבלאות שונות — אבל <b>תוכן התא זהה</b>: מצביע לאותו " +
        ltr("struct file") + " יחיד. זה בדיוק מה ש-fork()/dup() משכפלים — את התא, לא את " +
        "האובייקט."
    };
    nodes.push({
      id: "proc1", kind: "box", x: 12, y: 24, w: 124, h: 76,
      lines: procLines("האב (P1)", true),
      info: {
        badge: "תהליך",
        title: "האב (P1) — טבלת FD משלו",
        body: "לכל תהליך " + ltr("task_struct") + " וטבלת FD משלו. ב-fork() הבן מקבל <b>עותק</b> " +
          "של הטבלה — אבל התאים מועתקים כמות שהם: המצביעים שבפנים ממשיכים להצביע על אותם " +
          "אובייקטי struct file."
      }
    });
    nodes.push({ id: "tbl1", kind: "frame", x: 176, y: 16, w: 64, h: 152, label: "fd_array" });
    makeCells("p1", "tbl1", 179, [19, 49, 79, 109, 139], 28, true, fd3Info, null, nodes, edges);
    nodes.push({
      id: "proc2", kind: "box", x: 12, y: 228, w: 124, h: 76,
      lines: procLines("הבן (P2)", true),
      info: {
        badge: "תהליך",
        title: "הבן (P2) — טבלה משוכפלת, מצביעים זהים",
        body: "אחרי fork() לבן יש טבלה נפרדת פיזית, אבל תא 3 שלו מכיל בדיוק את אותו מצביע כמו " +
          "אצל האב — ולכן שניהם חולקים struct file אחד (וזו הסיבה ש-f_count קפץ ל-2). אותו " +
          "הדבר קורה בתוך תהליך יחיד עם dup()/dup2()."
      }
    });
    nodes.push({ id: "tbl2", kind: "frame", x: 176, y: 186, w: 64, h: 152, label: "fd_array" });
    makeCells("p2", "tbl2", 179, [189, 219, 249, 279, 309], 28, true, fd3Info, null, nodes, edges);
    nodes.push({
      id: "fileS", kind: "box", x: 312, y: 122, w: 168, h: 98, lines: fileLines(120, 2),
      info: {
        badge: "struct file",
        title: "struct file משותף — f_count = 2",
        body: "שני תאים מצביעים על אותו אובייקט, ולכן <b>f_count=2</b> (המונה מנוהל אטומית — " +
          ltr("atomic_long_sub_and_test") + "). <b>ה-f_pos משותף:</b> read אצל האב מקדם את " +
          "המצביע גם עבור הבן. close() אצל אחד מהם מפעיל " + ltr("fput") + " שרק מוריד את " +
          "המונה ל-1 — הקובץ נשאר פתוח עבור המחזיק השני; רק כשהמונה מגיע ל-0 מופעל " +
          ltr("file_operations->release") + " ומתבצע הניקוי המלא (dput, iput ושחרור ל-SLAB)."
      }
    });
    nodes.push({
      id: "inode", kind: "box", x: 528, y: 123, w: 112, h: 96, lines: inodeLines(),
      info: inodeInfo("")
    });
    nodes.push({ id: "blocks", kind: "blocks", x: 664, top: 131, info: blocksInfo() });
    nodes.push({
      id: "noteC", kind: "note", x: 420, y: 240,
      t: "אובייקט אחד — שני מחזיקים, f_pos משותף"
    });
    edges.push({ from: "proc1", to: "tbl1", pts: [136, 62, 174, 62] });
    edges.push({ from: "proc2", to: "tbl2", pts: [136, 266, 174, 266] });
    edges.push({ from: "p1fd3", to: "fileS", pts: [237, 123, 310, 151] });
    edges.push({ from: "p2fd3", to: "fileS", pts: [237, 293, 310, 191] });
    edges.push({ from: "fileS", to: "inode", pts: [480, 171, 526, 171] });
    edges.push({ from: "inode", to: "blocks", pts: [640, 171, 662, 171] });
    return {
      vb: "0 0 720 345", nodes: nodes, edges: edges,
      overview: {
        badge: "תרחיש ג׳",
        title: "אחרי fork() או dup() — struct file אחד משותף",
        body: ltr("fork()") + ", " + ltr("dup()") + " ו-" + ltr("dup2()") + " משכפלים את " +
          "ה-FD — לא את האובייקט: fd 3 אצל האב ואצל הבן מצביעים בדיוק על אותו " +
          ltr("struct file") + " בזיכרון, ולכן <b>f_count=2</b> וה-<b>f_pos משותף</b> — read " +
          "אצל האחד מקדם את המצביע גם עבור השני. close() אצל אחד מהם רק יוריד את f_count " +
          "ל-1; רק כשהמונה מגיע ל-0 הקרנל משמיד את האובייקט. לחצו על הרכיבים לפרטים."
      }
    };
  }

  var SCENARIOS = { a: scenarioA, b: scenarioB, c: scenarioC };

  /* =====================================================================
     STYLE (scoped, injected once)
     ===================================================================== */
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      ".viz-fd-chain{direction:rtl}" +
      ".viz-fd-chain .fdc-legend{font-size:.85rem;color:var(--ink-soft);margin-bottom:.6rem;line-height:1.6}" +
      ".viz-fd-chain .fdc-chain{direction:ltr;text-align:center;font-family:ui-monospace,Consolas,monospace;" +
      "font-size:.78rem;font-weight:700;color:var(--ink);background:var(--surface-2);" +
      "border:1px solid var(--line);border-radius:8px;padding:.35rem .6rem;margin-bottom:.6rem;overflow-x:auto;white-space:nowrap}" +
      ".viz-fd-chain .fdc-scene{background:var(--surface);border:1px solid var(--line);" +
      "border-radius:12px;padding:8px 4px;overflow:hidden}" +
      ".viz-fd-chain .fdc-hit{cursor:pointer}" +
      ".viz-fd-chain .fdc-hit:focus{outline:2px dashed var(--accent);outline-offset:2px}" +
      ".viz-fd-chain .fdc-panel{background:var(--surface-2);border:1px solid var(--line);" +
      "border-radius:12px;padding:12px 14px;margin-top:12px;min-height:112px;line-height:1.7;" +
      "font-size:.9rem;color:var(--ink)}" +
      ".viz-fd-chain .fdc-badge{display:inline-block;background:var(--accent);color:var(--surface);" +
      "font-weight:700;font-size:.72rem;padding:2px 10px;border-radius:99px;margin-inline-end:8px}" +
      ".viz-fd-chain .viz-controls{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:.7rem}";
    document.head.appendChild(s);
  }

  /* =====================================================================
     Draw one scenario into the svg; returns refs for highlighting.
     ===================================================================== */
  function drawScenario(svg, sc, mid, onSelect) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", sc.vb);

    var defs = se("defs", {}, svg);
    [["soft", "var(--ink-soft)"], ["accent", "var(--accent)"]].forEach(function (m) {
      var mk = se("marker", {
        id: mid(m[0]), viewBox: "0 0 10 10", refX: "8.5", refY: "5",
        markerWidth: "6.5", markerHeight: "6.5", orient: "auto-start-reverse"
      }, defs);
      se("path", { d: "M0 0 L10 5 L0 10 z", fill: m[1] }, mk);
    });

    var nodeRefs = {}, edgeRefs = [], up = {}, down = {};
    sc.edges.forEach(function (e) {
      (down[e.from] = down[e.from] || []).push(e.to);
      (up[e.to] = up[e.to] || []).push(e.from);
    });

    /* frames first (background) */
    sc.nodes.forEach(function (n) {
      if (n.kind !== "frame") return;
      var g = se("g", { "pointer-events": "none" }, svg);
      var rect = se("rect", {
        x: n.x, y: n.y, width: n.w, height: n.h, rx: 8,
        fill: "var(--surface-2)", stroke: "var(--line)", "stroke-width": 1.5
      }, g);
      var lbl = se("text", {
        x: n.x + n.w / 2, y: n.y - 6, "text-anchor": "middle",
        "font-size": 10.5, "font-weight": 700, fill: "var(--ink-soft)",
        "font-family": "ui-monospace, Consolas, monospace"
      }, g);
      lbl.textContent = n.label;
      nodeRefs[n.id] = { node: n, g: g, shapes: [rect], baseFill: "var(--surface-2)", tint: false };
    });

    /* edges (under the boxes) */
    sc.edges.forEach(function (e) {
      if (!e.pts) return; /* logical only */
      var x1 = e.pts[0], y1 = e.pts[1], x2 = e.pts[2], y2 = e.pts[3], d;
      if (y1 === y2) d = "M" + x1 + "," + y1 + " L" + x2 + "," + y2;
      else {
        var mx = (x1 + x2) / 2;
        d = "M" + x1 + "," + y1 + " C" + mx + "," + y1 + " " + mx + "," + y2 + " " + x2 + "," + y2;
      }
      var path = se("path", {
        d: d, fill: "none", stroke: "var(--ink-soft)", "stroke-width": 2,
        "stroke-linecap": "round", "marker-end": "url(#" + mid("soft") + ")"
      }, svg);
      edgeRefs.push({ path: path, from: e.from, to: e.to });
    });

    /* clickable node factory */
    function hitGroup(n) {
      var g = se("g", { "class": "fdc-hit", tabindex: 0, role: "button" }, svg);
      g.setAttribute("aria-label", n.info && n.info.title ? n.info.title : n.id);
      function fire(ev) { ev.stopPropagation(); onSelect(n.id); }
      g.addEventListener("click", fire);
      g.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { fire(ev); ev.preventDefault(); }
      });
      return g;
    }

    /* boxes, cells, blocks, notes */
    sc.nodes.forEach(function (n) {
      if (n.kind === "box") {
        var g = hitGroup(n);
        var rect = se("rect", {
          x: n.x, y: n.y, width: n.w, height: n.h, rx: 10,
          fill: "var(--surface)", stroke: "var(--line)", "stroke-width": 2
        }, g);
        n.lines.forEach(function (ln) {
          var t = se("text", {
            x: n.x + n.w / 2, y: n.y + ln.dy, "text-anchor": "middle",
            "font-size": ln.size || 11.5, "font-weight": ln.bold ? 800 : 600,
            fill: ln.fill || (ln.soft ? "var(--ink-soft)" : "var(--ink)")
          }, g);
          if (ln.mono) t.setAttribute("font-family", "ui-monospace, Consolas, monospace");
          if (ln.rtl) t.setAttribute("direction", "rtl");
          t.textContent = ln.t;
        });
        nodeRefs[n.id] = { node: n, g: g, shapes: [rect], baseFill: "var(--surface)", tint: true };
      } else if (n.kind === "cell") {
        var g2 = hitGroup(n);
        var baseFill = n.style === "std"
          ? "color-mix(in srgb, var(--ink-soft) 12%, var(--surface))"
          : (n.style === "empty" ? "none" : "var(--surface)");
        var rect2 = se("rect", {
          x: n.x, y: n.y, width: n.w, height: n.h, rx: 5,
          fill: baseFill, stroke: "var(--line)", "stroke-width": 1.5
        }, g2);
        if (n.style === "empty") rect2.setAttribute("stroke-dasharray", "4 3");
        var t2 = se("text", {
          x: n.x + n.w / 2, y: n.y + n.h / 2 + 4.5, "text-anchor": "middle",
          "font-size": 13, "font-weight": 800,
          "font-family": "ui-monospace, Consolas, monospace",
          fill: n.style === "active" ? "var(--ink)" : "var(--ink-soft)"
        }, g2);
        t2.textContent = n.style === "empty" ? "·" : String(n.num);
        nodeRefs[n.id] = {
          node: n, g: g2, shapes: [rect2], baseFill: baseFill,
          tint: n.style !== "std" && n.style !== "empty",
          dash: n.style === "empty" ? "4 3" : null
        };
      } else if (n.kind === "blocks") {
        var g3 = hitGroup(n);
        var shapes = [], sqFill = "color-mix(in srgb, var(--ink-soft) 15%, var(--surface))";
        for (var i = 0; i < 3; i++) {
          shapes.push(se("rect", {
            x: n.x, y: n.top + i * 26, width: 22, height: 22, rx: 4,
            fill: sqFill, stroke: "var(--ink-soft)", "stroke-width": 1.5
          }, g3));
        }
        var c1 = se("text", {
          x: n.x + 11, y: n.top + 90, "text-anchor": "middle",
          "font-size": 9.5, "font-weight": 700, fill: "var(--ink-soft)"
        }, g3);
        c1.textContent = "Data";
        var c2 = se("text", {
          x: n.x + 11, y: n.top + 102, "text-anchor": "middle",
          "font-size": 9.5, "font-weight": 700, fill: "var(--ink-soft)"
        }, g3);
        c2.textContent = "Blocks";
        nodeRefs[n.id] = { node: n, g: g3, shapes: shapes, baseFill: sqFill, tint: true };
      } else if (n.kind === "note") {
        var nt = se("text", {
          x: n.x, y: n.y, "text-anchor": "middle", direction: "rtl",
          "font-size": 10.5, "font-weight": 800, fill: "var(--err)",
          "pointer-events": "none"
        }, svg);
        nt.textContent = n.t;
      }
    });

    /* clicking empty canvas clears the selection */
    svg.addEventListener("click", function (e) {
      if (e.target === svg) onSelect(null);
    });

    return { nodeRefs: nodeRefs, edgeRefs: edgeRefs, up: up, down: down, mid: mid };
  }

  /* apply highlight state for a selection (or null) */
  function applySelection(refs, selId) {
    var set = null;
    if (selId) {
      set = {};
      set[selId] = true;
      [refs.up, refs.down].forEach(function (adj) {
        var stack = [selId];
        while (stack.length) {
          var cur = stack.pop();
          (adj[cur] || []).forEach(function (nb) {
            if (!set[nb]) { set[nb] = true; stack.push(nb); }
          });
        }
      });
    }
    Object.keys(refs.nodeRefs).forEach(function (id) {
      var r = refs.nodeRefs[id];
      var state = !set ? "normal" : (id === selId ? "sel" : (set[id] ? "hi" : "dim"));
      r.g.setAttribute("opacity", state === "dim" ? 0.35 : 1);
      r.shapes.forEach(function (shape) {
        if (state === "sel" || state === "hi") {
          shape.setAttribute("stroke", "var(--accent)");
          shape.setAttribute("stroke-width", state === "sel" ? 3.2 : 2.6);
          if (r.tint && r.baseFill !== "none") {
            shape.setAttribute("fill", "color-mix(in srgb, var(--accent) " +
              (state === "sel" ? 18 : 9) + "%, var(--surface))");
          }
        } else {
          shape.setAttribute("stroke", r.node.kind === "blocks" ? "var(--ink-soft)" : "var(--line)");
          shape.setAttribute("stroke-width", r.node.kind === "box" ? 2 : 1.5);
          shape.setAttribute("fill", r.baseFill);
        }
        if (r.dash) shape.setAttribute("stroke-dasharray", r.dash);
      });
    });
    refs.edgeRefs.forEach(function (er) {
      var on = set && set[er.from] && set[er.to];
      er.path.setAttribute("stroke", on ? "var(--accent)" : "var(--ink-soft)");
      er.path.setAttribute("stroke-width", on ? 3.2 : 2);
      er.path.setAttribute("marker-end", "url(#" + refs.mid(on ? "accent" : "soft") + ")");
      er.path.setAttribute("opacity", set && !on ? 0.3 : 1);
    });
  }

  /* =====================================================================
     Render one mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-fdc-ready") === "1") return;
    mount.setAttribute("data-fdc-ready", "1");
    mount.innerHTML = "";
    ensureStyle();

    var inst = ++instCount;
    var mid = function (p) { return "fdcmk-" + inst + "-" + p; };

    var root = ce("div", "viz-fd-chain", null);

    var legend = ce("div", "fdc-legend", root);
    legend.innerHTML = "כך מתורגם מספר קטן כמו " + ltr("fd = 3") + " לנתונים אמיתיים על הדיסק. " +
      "בחרו תרחיש, ואז <b>לחצו על כל רכיב בשרשרת</b> כדי לקבל הסבר על תפקידו.";
    var chainBar = ce("div", "fdc-chain", root,
      "task_struct → fd_array → struct file → in-core inode → data blocks");

    var modeRow = ce("div", "viz-controls", root);
    function mkBtn(label, fn) {
      var b = ce("button", "viz-btn", null, label);
      b.type = "button";
      b.addEventListener("click", fn);
      return b;
    }
    var btnA = mkBtn("open() אחד", function () { setScenario("a"); });
    var btnB = mkBtn("אותו קובץ נפתח פעמיים", function () { setScenario("b"); });
    var btnC = mkBtn("אחרי fork()/dup()", function () { setScenario("c"); });
    modeRow.appendChild(btnA); modeRow.appendChild(btnB); modeRow.appendChild(btnC);

    var sceneBox = ce("div", "fdc-scene", root);
    var svg = se("svg", {
      width: "100%", role: "img", direction: "ltr",
      "aria-label": "תרשים שרשרת התרגום של File Descriptor: תהליך, טבלת FD, struct file, inode ובלוקים"
    });
    svg.style.cssText = "display:block;max-width:720px;margin:0 auto";
    sceneBox.appendChild(svg);

    var panel = ce("div", "fdc-panel", root);
    panel.setAttribute("aria-live", "polite");

    mount.appendChild(root);

    var scenario = null, refs = null, selId = null;

    function updatePanel() {
      var info = selId && refs.nodeRefs[selId] && refs.nodeRefs[selId].node.info
        ? refs.nodeRefs[selId].node.info
        : scenario.overview;
      panel.innerHTML = '<span class="fdc-badge">' + info.badge + "</span><b>" + info.title +
        '</b><div style="margin-top:6px">' + info.body + "</div>";
    }

    function select(id) {
      selId = (id && id !== selId) ? id : null; /* click again = deselect */
      applySelection(refs, selId);
      updatePanel();
    }

    function setScenario(key) {
      scenario = SCENARIOS[key]();
      selId = null;
      refs = drawScenario(svg, scenario, mid, select);
      applySelection(refs, null);
      updatePanel();
      [["a", btnA], ["b", btnB], ["c", btnC]].forEach(function (p) {
        p[1].classList.toggle("primary", p[0] === key);
        p[1].setAttribute("aria-pressed", p[0] === key ? "true" : "false");
      });
    }

    setScenario("a");
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
