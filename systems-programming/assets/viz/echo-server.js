/* =====================================================================
   echo-server.js — "מדרגות הזרימה של שרת ה-Echo" — סטפר צעד-אחר-צעד
   של קוד השרת של המרצה, בשני מצבים:

     <div class="viz" data-viz="echo-server" data-mode="iterative"></div>
     <div class="viz" data-viz="echo-server" data-mode="concurrent"></div>

   Grounded ONLY in the lecturer's handouts:
   - _notes/echo-iterative.md  — server.c: socket → setsockopt
     (SO_REUSEADDR | SO_REUSEPORT) → INADDR_ANY + htons(8080) → bind →
     listen(server_fd, 3) → while(1){ accept → while(read>0) send →
     bytes_read==0 ⇒ "Client disconnected" → close(client_fd) };
     "A new FD is created specifically for this conversation";
     read ו-accept הן קריאות חוסמות.
   - _notes/echo-concurrent.md — concurrent_server.c: setsockopt רק עם
     SO_REUSEADDR, listen(server_fd, 10), fork() לכל לקוח; הבן סוגר
     server_fd; האב סוגר client_fd (אחרת ה-socket לעולם לא ייסגר באמת,
     כי ה-Reference Count לא יגיע לאפס); process_echo = toupper In-place;
     exit(0) בבן — "very important!" (בלעדיו הבן חוזר ללולאת while(1)
     ומתחיל בעצמו לבצע accept); זומבים + while (waitpid(-1, NULL,
     WNOHANG) > 0); — ניקוי לא-חוסם, אחרת טבלת התהליכים מתמלאת.

   Self-contained IIFE, zero deps, works from file:// and http, theme
   aware (CSS custom properties only ⇒ dark mode via
   html[data-theme="dark"] just works). Hebrew RTL chrome; the drawing
   stage is dir="ltr" with Hebrew labels marked dir="rtl".
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "echo-server";
  var STYLE_ID = "echo-server-style";
  var AUTO_MS = 1200;
  var instCount = 0;

  var PID_PARENT = 1042, PID_CHILD_A = 1088, PID_CHILD_B = 1093, PID_CHILD_A2 = 1101;
  var MSG_IN = '"Hello from client!..."';
  var MSG_UP = '"HELLO FROM CLIENT!..."';

  function ltr(s) { return '<span dir="ltr">' + s + "</span>"; }
  function ce(tag, cls, parent, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  }
  function escHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* =====================================================================
     CODE STRIPS — קטעים מקוצרים מקוד המרצה (שמות הקריאות מדויקים)
     ===================================================================== */
  var CODE_ITER = [
    "server_fd = socket(AF_INET, SOCK_STREAM, 0);",
    "setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR | SO_REUSEPORT, &opt, sizeof(opt));",
    "address.sin_addr.s_addr = INADDR_ANY;",
    "address.sin_port = htons(PORT);",
    "bind(server_fd, (struct sockaddr *)&address, sizeof(address));",
    "listen(server_fd, 3);",
    "while (1) {",
    "  client_fd = accept(server_fd, &address, &addrlen);",
    "  while ((bytes_read = read(client_fd, buffer, BUFFER_SIZE)) > 0)",
    "    send(client_fd, buffer, bytes_read, 0);",
    "  if (bytes_read == 0) printf(\"Client disconnected\\n\");",
    "  close(client_fd);",
    "}"
  ];

  var CODE_CONC = [
    "server_fd = socket(AF_INET, SOCK_STREAM, 0);",
    "setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));",
    "address.sin_addr.s_addr = INADDR_ANY;",
    "address.sin_port = htons(PORT);",
    "bind(server_fd, (struct sockaddr *)&address, sizeof(address));",
    "listen(server_fd, 10);",
    "while (1) {",
    "  client_fd = accept(server_fd, &address, &addrlen);",
    "  pid_t pid = fork();",
    "  if (pid == 0) {        /* child */",
    "    close(server_fd);",
    "    while ((bytes_read = read(client_fd, buffer, BUFFER_SIZE)) > 0) {",
    "      process_echo(buffer, bytes_read);",
    "      send(client_fd, buffer, bytes_read, 0);",
    "    }",
    "    close(client_fd);",
    "    exit(0);",
    "  } else {               /* parent */",
    "    close(client_fd);",
    "    while (waitpid(-1, NULL, WNOHANG) > 0);",
    "  }",
    "}"
  ];

  /* line indices that a broken scenario replaces with a "missing" comment */
  var BROKEN_LINE = {
    "no-close": { i: 18, t: "    /* close(client_fd);  <-- MISSING! */" },
    "no-wait": { i: 19, t: "    /* while (waitpid(-1, NULL, WNOHANG) > 0);  <-- MISSING! */" },
    "no-exit": { i: 16, t: "    /* exit(0);  <-- MISSING! */" }
  };

  function codeFor(mode, scenario) {
    if (mode !== "concurrent") return { lines: CODE_ITER.slice(), bad: -1 };
    var lines = CODE_CONC.slice(), bad = -1;
    var b = BROKEN_LINE[scenario];
    if (b) { lines[b.i] = b.t; bad = b.i; }
    return { lines: lines, bad: bad };
  }

  /* =====================================================================
     STATE BUILDER — כל צעד הוא snapshot של אובייקט מצב אחד
     ===================================================================== */
  function F(n, name, desc, tone) {
    return { n: n, name: name || "", desc: desc, tone: tone || "" };
  }
  function stdFds() {
    return [F(0, "", "stdin"), F(1, "", "stdout"), F(2, "", "stderr")];
  }

  function B() {
    this.steps = [];
    this.st = { procs: [], kobjs: null, ptable: [], clients: [], backlog: null };
  }
  B.prototype.reset = function () {
    /* per-step housekeeping: drop closed FDs / sockets, cool down highlights */
    this.st.procs.forEach(function (p) {
      if (!p.fds) return;
      p.fds = p.fds.filter(function (f) { return f.tone !== "gone"; });
      p.fds.forEach(function (f) { if (f.tone === "new" || f.tone === "hot") f.tone = ""; });
    });
    if (this.st.kobjs) {
      this.st.kobjs = this.st.kobjs.filter(function (k) { return k.tone !== "gone"; });
      this.st.kobjs.forEach(function (k) { if (k.tone === "hot") k.tone = ""; });
    }
    if (this.st.backlog) this.st.backlog.tone = "";
  };
  B.prototype.proc = function (id) {
    for (var i = 0; i < this.st.procs.length; i++) {
      if (this.st.procs[i].id === id) return this.st.procs[i];
    }
    return null;
  };
  B.prototype.dropProc = function (id) {
    this.st.procs = this.st.procs.filter(function (p) { return p.id !== id; });
  };
  B.prototype.fd = function (procId, n) {
    var p = this.proc(procId);
    if (!p || !p.fds) return null;
    for (var i = 0; i < p.fds.length; i++) if (p.fds[i].n === n) return p.fds[i];
    return null;
  };
  B.prototype.kobj = function (id) {
    if (!this.st.kobjs) return null;
    for (var i = 0; i < this.st.kobjs.length; i++) {
      if (this.st.kobjs[i].id === id) return this.st.kobjs[i];
    }
    return null;
  };
  B.prototype.client = function (id) {
    for (var i = 0; i < this.st.clients.length; i++) {
      if (this.st.clients[i].id === id) return this.st.clients[i];
    }
    return null;
  };
  B.prototype.setClient = function (id, state, he, msg) {
    var c = this.client(id);
    if (!c) return;
    c.state = state; c.he = he;
    if (msg !== undefined) c.msg = msg;
  };
  B.prototype.snap = function (meta) {
    var s = JSON.parse(JSON.stringify(this.st));
    s.line = typeof meta.line === "number" ? [meta.line] : (meta.line || []);
    s.chip = meta.chip;
    s.tone = meta.tone || "run";
    s.title = meta.title;
    s.note = meta.note;
    this.steps.push(s);
  };

  function newClient(id, label) {
    return { id: id, label: label, state: "idle", he: "לא מחובר", msg: "" };
  }

  /* ---------------------------------------------------------------------
     המשותף לשני המצבים: socket → setsockopt → bind → listen → accept
     --------------------------------------------------------------------- */
  function prologue(b, mode) {
    var srv = {
      id: "srv", name: mode === "concurrent" ? "Server (parent)" : "Server process",
      he: "תהליך השרת", pid: PID_PARENT, role: "parent", fds: stdFds(), status: null
    };
    b.st.procs.push(srv);
    b.st.clients = [newClient("A", "Client A"), newClient("B", "Client B")];
    if (mode === "concurrent") b.st.kobjs = [];

    var backlogSize = mode === "concurrent" ? 10 : 3;
    var reuse = mode === "concurrent"
      ? ltr("SO_REUSEADDR")
      : ltr("SO_REUSEADDR | SO_REUSEPORT");

    /* 1 — socket() */
    b.reset();
    srv = b.proc("srv");
    srv.fds.push(F(3, "server_fd", "TCP socket", "new"));
    srv.status = { t: "רץ", tone: "run" };
    if (b.st.kobjs) {
      b.st.kobjs.push({ id: "lsn", label: "socket object (TCP)", refs: 1, tone: "hot" });
    }
    b.snap({
      line: 0, chip: "רץ", tone: "run",
      title: ltr("socket()") + " — נוצר ה-socket",
      note: ltr("socket(AF_INET, SOCK_STREAM, 0)") + " — " + ltr("AF_INET") + " = IPv4, " +
        ltr("SOCK_STREAM") + " = TCP. ה-socket <b>הוא File Descriptor</b>, והוא מקבל את התא " +
        "הפנוי הראשון בטבלה: " + ltr("fd = 3") + " (0,1,2 תפוסים מראש)."
    });

    /* 2 — setsockopt() */
    b.reset();
    b.fd("srv", 3).tone = "hot";
    b.snap({
      line: 1, chip: "רץ", tone: "run",
      title: ltr("setsockopt()") + " — " + ltr("SO_REUSEADDR"),
      note: "הדגל " + reuse + " מאפשר לשרת לעלות מחדש <b>מיד</b>, בלי להמתין לפקיעת מצב " +
        ltr("TIME_WAIT") + " של הקרנל — שאחרת משאיר את הפורט \"תקוע\" למשך כמה דקות."
    });

    /* 3 — bind() */
    b.reset();
    b.fd("srv", 3).desc = "bound · 0.0.0.0:8080";
    b.fd("srv", 3).tone = "hot";
    if (b.kobj("lsn")) b.kobj("lsn").label = "socket :8080";
    b.snap({
      line: [2, 3, 4], chip: "רץ", tone: "run",
      title: ltr("bind()") + " — קישור לכתובת ולפורט",
      note: ltr("INADDR_ANY") + " = להאזין על <b>כל ממשקי הרשת</b> (כולל localhost); " +
        ltr("htons(8080)") + " = המרה ל-Network Byte Order‏ (Big-Endian). " +
        ltr("bind()") + " מקשרת את " + ltr("server_fd") + " לכתובת הזו."
    });

    /* 4 — listen() */
    b.reset();
    b.fd("srv", 3).desc = "listening socket :8080";
    b.fd("srv", 3).tone = "hot";
    if (b.kobj("lsn")) b.kobj("lsn").label = "listening socket :8080";
    b.st.backlog = { cap: backlogSize, items: [], tone: "hot" };
    b.snap({
      line: 5, chip: "רץ", tone: "run",
      title: ltr("listen(server_fd, " + backlogSize + ")") + " — מעבר למצב פסיבי",
      note: "ה-socket עובר למצב <b>פסיבי</b> ונפתח לצידו <b>תור המתנה (backlog)</b> — עד " +
        backlogSize + " חיבורים ממתינים." + (mode === "concurrent"
          ? " ה-backlog הוגדל ל-10 <b>כיוון שהשרת עכשיו קונקורנטי</b> (באיטרטיבי היה 3)."
          : " בגרסה האיטרטיבית ה-backlog הוא 3 (בקונקורנטית — 10).")
    });

    /* 5 — accept() blocks */
    b.reset();
    b.proc("srv").status = { t: "חסום ב-" + ltr("accept()"), tone: "block" };
    b.snap({
      line: 7, chip: "חסום ב-" + ltr("accept()"), tone: "block",
      title: ltr("accept()") + " — קריאה חוסמת",
      note: ltr("accept()") + " היא <b>קריאה חוסמת (blocking)</b>: התהליך נעצר כאן ולא " +
        "צורך CPU עד שיגיע לקוח. אין עדיין אף לקוח — התור ריק."
    });

    /* 6 — Client A connects, accept() returns a brand-new fd */
    b.reset();
    b.setClient("A", "served", ltr("connect()") + " · מחובר", MSG_IN);
    b.proc("srv").fds.push(F(4, "client_fd", "connection ↔ Client A", "new"));
    b.proc("srv").status = { t: "רץ", tone: "run" };
    if (b.st.kobjs) {
      b.st.kobjs.push({ id: "cA", label: "connection ↔ Client A", refs: 1, tone: "hot" });
    }
    b.snap({
      line: 7, chip: "רץ", tone: "run",
      title: "Client A מבצע " + ltr("connect()") + " — " + ltr("accept()") + " חוזרת",
      note: "זה ההבדל בין " + ltr("socket") + " ל-" + ltr("accept") + ": " +
        ltr("<b>\"A new FD is created specifically for this conversation\"</b>") + " — " +
        ltr("client_fd = 4") + " לשיחה עם A, בעוד " + ltr("server_fd = 3") +
        " ממשיך להאזין לחיבורים חדשים."
    });
  }

  /* ---------------------------------------------------------------------
     ITERATIVE
     --------------------------------------------------------------------- */
  function buildIterative() {
    var b = new B();
    prologue(b, "iterative");

    /* 7 — read() blocks */
    b.reset();
    b.proc("srv").status = { t: "חסום ב-" + ltr("read()"), tone: "block" };
    b.snap({
      line: 8, chip: "חסום ב-" + ltr("read()"), tone: "block",
      title: ltr("read()") + " — עוד קריאה חוסמת",
      note: "השרת נכנס ללולאת ה-Echo וקורא " + ltr("read(client_fd, buffer, BUFFER_SIZE)") +
        ". גם היא <b>חוסמת</b> — התהליך היחיד של השרת תקוע כאן עד ש-A ישלח בייטים."
    });

    /* 8 — data arrives, echo back */
    b.reset();
    b.setClient("A", "served", "שלח הודעה · קיבל echo", MSG_IN);
    b.fd("srv", 4).tone = "hot";
    b.proc("srv").status = { t: "רץ · echo", tone: "run" };
    b.snap({
      line: [8, 9], chip: "רץ", tone: "run",
      title: ltr("read()") + " מחזירה n בייטים, ו-" + ltr("send()") + " מחזיר אותם",
      note: "A שלח " + ltr(MSG_IN) + "; " + ltr("read") + " מחזירה " + ltr("bytes_read = 49") +
        ", ו-" + ltr("send(client_fd, buffer, bytes_read, 0)") + " שולח בחזרה <b>בדיוק את " +
        "מספר הבייטים שהתקבלו</b> — לא את כל המאגר בן 4096 הבייטים."
    });

    /* 9 — Client B is stuck in the backlog: THE point of "iterative" */
    b.reset();
    b.setClient("B", "queue", "בתור ה-backlog — לא מטופל!", "");
    b.st.backlog.items = ["B"];
    b.st.backlog.tone = "bad";
    b.proc("srv").status = { t: "חסום ב-" + ltr("read()") + " של A", tone: "block" };
    b.snap({
      line: 8, chip: "חסום ב-" + ltr("read()"), tone: "err",
      title: "Client B מתחבר — ונשאר בתור",
      note: "<b>כאן נמצאת החולשה של המודל האיטרטיבי:</b> החיבור של B נכנס לתור ה-backlog, " +
        "אבל התהליך היחיד של השרת תקוע בלולאת ה-" + ltr("read") + " של A ולא יחזור ל-" +
        ltr("accept") + " עד ש-A יסיים. לקוח אחד ששולח לאט — חוסם את כולם."
    });

    /* 10 — A disconnects: read()==0 → close(client_fd) */
    b.reset();
    b.setClient("A", "done", ltr("close(sock)") + " · התנתק", "");
    b.fd("srv", 4).tone = "gone";
    b.fd("srv", 4).desc = "closed";
    b.proc("srv").status = { t: "רץ", tone: "run" };
    b.snap({
      line: [10, 11], chip: "רץ", tone: "run",
      title: ltr("read()") + " מחזירה 0 — " + ltr("\"Client disconnected\""),
      note: "החזרת <b>0</b> מ-" + ltr("read") + " על socket משמעה <b>EOF — הלקוח התנתק</b> " +
        "(ערך שלילי ⇒ שגיאה). הלולאה נשברת, מודפס " + ltr('"Client disconnected"') + " ומתבצע " +
        ltr("close(client_fd)") + " — תא 4 מתפנה."
    });

    /* 11 — back to accept: B is finally served, fd 4 reused */
    b.reset();
    b.setClient("B", "served", "התקבל סוף-סוף · מטופל", MSG_IN);
    b.st.backlog.items = [];
    b.proc("srv").fds.push(F(4, "client_fd", "connection ↔ Client B", "new"));
    b.proc("srv").status = { t: "רץ · מטפל ב-B", tone: "run" };
    b.snap({
      line: 7, chip: "רץ", tone: "run",
      title: "חזרה ל-" + ltr("accept()") + " — רק עכשיו תורו של B",
      note: "הלולאה " + ltr("while(1)") + " חוזרת ל-" + ltr("accept") + ", והחיבור שחיכה בתור " +
        "מתקבל. שימו לב שה-FD החדש קיבל שוב את המספר <b>4</b> — התא התפנה ב-" + ltr("close") +
        " והוקצה מחדש."
    });

    /* 12 — summary */
    b.reset();
    b.snap({
      line: [6, 7, 8, 9, 11], chip: "רץ", tone: "run",
      title: "סיכום — למה המודל הזה נקרא \"איטרטיבי\"",
      note: "תהליך אחד, לקוח אחד בכל רגע: " +
        ltr("socket → setsockopt → bind → listen → accept → read/send → close") +
        ". " + ltr("accept") + " ו-" + ltr("read") + " שתיהן חוסמות, ולכן כל שאר הלקוחות " +
        "ממתינים בתור. את זה בדיוק פותר " + ltr("fork()") + " בגרסה הקונקורנטית."
    });

    return b.steps;
  }

  /* ---------------------------------------------------------------------
     CONCURRENT — משותף לכל התרחישים: fork + סגירות + האב חוזר ל-accept
     --------------------------------------------------------------------- */
  function childBox(pid, label, he) {
    return {
      id: "ch" + pid, name: label, he: he, pid: pid, role: "child",
      fds: stdFds().concat([]), status: { t: "רץ", tone: "run" }
    };
  }

  function concurrentCore(b, scenario) {
    prologue(b, "concurrent");

    /* 7 — fork(): child gets a COPY of the FD table; refcounts jump to 2 */
    b.reset();
    var chA = childBox(PID_CHILD_A, "Child · Client A", "הבן שמטפל ב-A");
    chA.fds = stdFds();
    chA.fds.push(F(3, "server_fd", "listening socket :8080", "new"));
    chA.fds.push(F(4, "client_fd", "connection ↔ Client A", "new"));
    chA.status = { t: "רץ (עותק של האב)", tone: "run" };
    b.st.procs.push(chA);
    b.kobj("lsn").refs = 2; b.kobj("lsn").tone = "hot";
    b.kobj("cA").refs = 2; b.kobj("cA").tone = "hot";
    b.proc("srv").status = { t: "רץ · אחרי " + ltr("fork()"), tone: "run" };
    b.snap({
      line: [8, 9], chip: "רץ", tone: "run",
      title: ltr("fork()") + " — \"מפעל לשכפול תהליכים\"",
      note: ltr("fork()") + " יוצרת <b>שכפול מדויק</b> של תהליך השרת: לכל תהליך יש עותק משלו " +
        "של טבלת ה-FD. לכן הקרנל <b>מגדיל את ה-Reference Count</b> של כל socket פתוח — " +
        "ה-listening וגם החיבור עם A עומדים עכשיו על " + ltr("ref = 2") + "."
    });

    /* 8 — the two mandatory closes (or the broken variant) */
    b.reset();
    b.fd("ch" + PID_CHILD_A, 3).tone = "gone";
    b.fd("ch" + PID_CHILD_A, 3).desc = "closed";
    b.kobj("lsn").refs = 1; b.kobj("lsn").tone = "hot";
    if (scenario === "no-close") {
      b.fd("srv", 4).tone = "leak";
      b.fd("srv", 4).desc = "connection ↔ A · לא נסגר!";
      b.kobj("cA").refs = 2; b.kobj("cA").tone = "bad";
      b.proc("srv").status = { t: "רץ · עדיין מחזיק " + ltr("fd 4"), tone: "err" };
      b.snap({
        line: [10, 18], chip: "באג — האב לא סגר", tone: "err",
        title: "הבן סוגר " + ltr("server_fd") + " — אבל האב <b>לא</b> סוגר " + ltr("client_fd"),
        note: "הבן סוגר את ה-socket המאזין (כדי שלא יבצע " + ltr("accept") + " בטעות) — עד כאן " +
          "תקין. אבל האב דילג על " + ltr("close(client_fd)") + ", ולכן ה-Reference Count של " +
          "החיבור <b>נשאר 2</b>. זכרו: <b>ה-socket לעולם לא ייסגר באמת אם ה-refcount לא " +
          "מגיע לאפס</b>."
      });
    } else {
      b.fd("srv", 4).tone = "gone";
      b.fd("srv", 4).desc = "closed";
      b.kobj("cA").refs = 1; b.kobj("cA").tone = "hot";
      b.proc("srv").status = { t: "רץ", tone: "run" };
      b.snap({
        line: [10, 18], chip: "רץ", tone: "run",
        title: "שתי הסגירות החובה שאחרי " + ltr("fork()"),
        note: "<b>הבן</b> סוגר את " + ltr("server_fd") + " — לבטיחות וליעילות, כדי שלא יבצע " +
          ltr("accept") + " נוסף בטעות. <b>האב</b> סוגר את " + ltr("client_fd") + " — חובה, " +
          "אחרת ה-socket לעולם לא ייסגר באמת כי ה-Reference Count לא יגיע לאפס. כל refcount " +
          "חוזר ל-1."
      });
    }

    /* 9 — parent back to accept(); child does read → process_echo → send */
    b.reset();
    b.proc("srv").status = { t: "חסום ב-" + ltr("accept()"), tone: "block" };
    b.proc("ch" + PID_CHILD_A).status = { t: "רץ · " + ltr("read → toupper → send"), tone: "run" };
    b.setClient("A", "served", "מטופל בידי הבן · קיבל echo", MSG_UP);
    b.snap({
      line: [7, 11, 12, 13], chip: "האב חסום ב-" + ltr("accept()") + " · הבן רץ", tone: "run",
      title: "האב חוזר מיד ל-" + ltr("accept()") + ", הבן מטפל בלקוח",
      note: "<b>האב</b> חוזר מיד ל-" + ltr("accept") + " כדי לקבל את הלקוח הבא; <b>הבן</b> " +
        "מטפל ב-A עצמאית לחלוטין: " + ltr("read → process_echo → send") + " (המרה " +
        "ל-Uppercase <b>In-place</b>, בלי malloc ובלי memcpy). A מקבל " +
        ltr(MSG_UP) + ". שני התהליכים יכולים לרוץ על ליבות שונות (Multi-core)."
    });
  }

  function buildConcurrentOk() {
    var b = new B();
    concurrentCore(b, "ok");

    /* 10 — Client B: accepted immediately, second fork */
    b.reset();
    b.setClient("B", "served", "התקבל מיד · מטופל", MSG_IN);
    b.proc("srv").fds.push(F(4, "client_fd", "connection ↔ Client B", "new"));
    b.st.kobjs.push({ id: "cB", label: "connection ↔ Client B", refs: 1, tone: "hot" });
    var chB = childBox(PID_CHILD_B, "Child · Client B", "הבן שמטפל ב-B");
    chB.fds = stdFds();
    chB.fds.push(F(4, "client_fd", "connection ↔ Client B", "new"));
    chB.status = { t: "רץ · " + ltr("read → toupper → send"), tone: "run" };
    b.st.procs.push(chB);
    b.fd("srv", 4).tone = "gone";
    b.fd("srv", 4).desc = "closed";
    b.proc("srv").status = { t: "רץ · fork שני", tone: "run" };
    b.snap({
      line: [7, 8, 10, 18], chip: "רץ", tone: "run",
      title: "Client B מתקבל <b>מיד</b> — fork שני",
      note: "בניגוד לשרת האיטרטיבי, B לא מחכה בתור: האב פנוי ב-" + ltr("accept") + ", מקבל " +
        "אותו (שוב " + ltr("fd = 4") + " — התא התפנה), ומבצע " + ltr("fork") + " שני. גם כאן " +
        "הבן סוגר " + ltr("server_fd") + " והאב סוגר " + ltr("client_fd") + "."
    });

    /* 11 — child A finishes: exit(0) → zombie */
    b.reset();
    b.setClient("A", "done", ltr("close(sock)") + " · סיים", "");
    b.dropProc("ch" + PID_CHILD_A);
    b.st.ptable.push({ pid: PID_CHILD_A, label: "Child · Client A" });
    b.kobj("cA").tone = "gone";
    b.proc("srv").status = { t: "חסום ב-" + ltr("accept()"), tone: "block" };
    b.snap({
      line: [11, 15, 16], chip: "הבן הפך ל-Zombie", tone: "err",
      title: "הבן מסיים: " + ltr("exit(0) → EXIT_ZOMBIE"),
      note: ltr("read") + " החזירה 0 (A התנתק), הבן ביצע " + ltr("close(client_fd)") + " — " +
        "ה-refcount ירד ל-0 <b>והחיבור נסגר באמת</b> — ואז " + ltr("exit(0)") + ". אבל בלינוקס " +
        "בן שהסתיים <b>נשאר בטבלת התהליכים כ-Zombie</b> עד שהאב יקרא ל-" + ltr("wait") + "."
    });

    /* 12 — waitpid reaps */
    b.reset();
    b.setClient("A", "served", "התחבר שוב · מטופל", MSG_IN);
    b.st.ptable = [];
    var chA2 = childBox(PID_CHILD_A2, "Child · Client A (2)", "בן חדש ל-A");
    chA2.fds = stdFds();
    chA2.fds.push(F(4, "client_fd", "connection ↔ Client A", "new"));
    b.st.procs.push(chA2);
    b.st.kobjs.push({ id: "cA2", label: "connection ↔ Client A", refs: 1, tone: "hot" });
    b.proc("srv").status = { t: "רץ · קוצר בנים שסיימו", tone: "ok" };
    b.snap({
      line: 19, chip: "רץ · waitpid קוצר", tone: "ok",
      title: ltr("while (waitpid(-1, NULL, WNOHANG) > 0);"),
      note: "הלקוח הבא הגיע, " + ltr("accept") + " חזרה, " + ltr("fork") + " נוסף — ואז, בענף " +
        "האב, רצה לולאת ה-" + ltr("waitpid") + ": " + ltr("<b>-1</b>") + " = כל בן שהוא, " + ltr("<b>NULL</b>") + " = לא " +
        "מעניין אותנו סטטוס היציאה, <b>WNOHANG</b> = לא-חוסם. הזומבי נקצר וטבלת התהליכים נקייה."
    });

    /* 13 — summary */
    b.reset();
    b.snap({
      line: [8, 10, 16, 18, 19], chip: "רץ", tone: "run",
      title: "סיכום — ארבע החובות של השרת הקונקורנטי",
      note: "<b>(1)</b> הבן סוגר " + ltr("server_fd") + "; <b>(2)</b> האב סוגר " +
        ltr("client_fd") + " — אחרת ה-socket לא ייסגר באמת; <b>(3)</b> " + ltr("exit(0)") +
        " בסוף קוד הבן — \"very important!\"; <b>(4)</b> " +
        ltr("while (waitpid(-1, NULL, WNOHANG) > 0);") + " באב, אחרת טבלת התהליכים מתמלאת " +
        "בזומבים. נסו את התרחישים השבורים למעלה."
    });

    return b.steps;
  }

  function buildConcurrentNoClose() {
    var b = new B();
    concurrentCore(b, "no-close");

    /* 10 — B arrives: fd 4 is still taken, so accept() returns fd 5 */
    b.reset();
    b.setClient("B", "served", "התקבל מיד · מטופל", MSG_IN);
    b.proc("srv").fds.push(F(5, "client_fd", "connection ↔ B · גם הוא ידלוף", "leak"));
    b.st.kobjs.push({ id: "cB", label: "connection ↔ Client B", refs: 2, tone: "bad" });
    var chB = childBox(PID_CHILD_B, "Child · Client B", "הבן שמטפל ב-B");
    chB.fds = stdFds();
    chB.fds.push(F(5, "client_fd", "connection ↔ Client B", "new"));
    chB.status = { t: "רץ · " + ltr("read → toupper → send"), tone: "run" };
    b.st.procs.push(chB);
    b.proc("srv").status = { t: "רץ · שני FD דלופים", tone: "err" };
    b.snap({
      line: [7, 8, 18], chip: "דליפת Open Handles", tone: "err",
      title: "התא 4 עדיין תפוס — " + ltr("accept()") + " מחזירה 5",
      note: "מכיוון שהאב לא סגר את fd 4, ה-" + ltr("accept") + " הבא מקבל את התא הפנוי הבא — " +
        ltr("fd = 5") + " — והמשתנה " + ltr("client_fd") + " נדרס. <b>כבר אין דרך לסגור את " +
        ltr("fd 4") + "</b>. כל לקוח מדליף עוד FD, עד שהתהליך מגיע למגבלת ה-FD שלו."
    });

    /* 11 — child A exits: refcount 2 → 1, socket stays open */
    b.reset();
    b.setClient("A", "done", ltr("close(sock)") + " · סיים", "");
    b.dropProc("ch" + PID_CHILD_A);
    b.st.ptable.push({ pid: PID_CHILD_A, label: "Child · Client A" });
    b.kobj("cA").refs = 1; b.kobj("cA").tone = "bad";
    b.kobj("cA").label = "connection ↔ A · עדיין פתוח!";
    b.proc("srv").status = { t: "חסום ב-" + ltr("accept()"), tone: "block" };
    b.snap({
      line: [15, 16], chip: "ה-socket לא נסגר", tone: "err",
      title: "הבן סגר ויצא — והחיבור עדיין פתוח",
      note: ltr("close(client_fd)") + " של הבן הוריד את ה-Reference Count מ-2 ל-<b>1</b>, " +
        "ולא ל-0. הלקוח כבר הלך, הבן מת — אבל <b>ה-socket לעולם לא ייסגר באמת</b>, כי האב " +
        "עדיין מחזיק בו הפניה. משאבי הקרנל נשארים תפוסים."
    });

    /* 12 — the zombie is reaped, the leak is not */
    b.reset();
    b.st.ptable = [];
    b.kobj("cA").tone = "bad";
    b.proc("srv").status = { t: "רץ · הדליפה נשארה", tone: "err" };
    b.snap({
      line: 19, chip: "הזומבי נוקה · ה-socket דולף", tone: "err",
      title: "waitpid קוצר את הזומבי — אבל לא את הדליפה",
      note: "ניקוי הזומבים עובד כרגיל, אבל הוא לא נוגע ב-FD הדלוף: החיבור עם A נשאר במונה " +
        ltr("ref = 1") + " לנצח. שרת שרץ ימים יאסוף אלפי חיבורים \"מתים\" שאי אפשר לסגור."
    });

    /* 13 — summary */
    b.reset();
    b.snap({
      line: 18, chip: "התיקון: " + ltr("close(client_fd)"), tone: "ok",
      title: "התיקון — שורה אחת בענף האב",
      note: "<b>האב חייב לסגור את " + ltr("client_fd") + "</b> מיד אחרי ה-fork: הוא לא " +
        "משתמש בו, האחריות עברה לבן. " + ltr("\"If it doesn't, the socket will never truly close " +
        "(because the reference count will never reach zero)\"") + " — זו נקודה קלאסית למבחן."
    });

    return b.steps;
  }

  function buildConcurrentNoWait() {
    var b = new B();
    concurrentCore(b, "no-wait");

    /* 10 — Client B: accepted immediately, second fork (identical to ok) */
    b.reset();
    b.setClient("B", "served", "התקבל מיד · מטופל", MSG_IN);
    b.proc("srv").fds.push(F(4, "client_fd", "connection ↔ Client B", "new"));
    b.st.kobjs.push({ id: "cB", label: "connection ↔ Client B", refs: 1, tone: "hot" });
    var chB = childBox(PID_CHILD_B, "Child · Client B", "הבן שמטפל ב-B");
    chB.fds = stdFds();
    chB.fds.push(F(4, "client_fd", "connection ↔ Client B", "new"));
    chB.status = { t: "רץ · " + ltr("read → toupper → send"), tone: "run" };
    b.st.procs.push(chB);
    b.fd("srv", 4).tone = "gone";
    b.fd("srv", 4).desc = "closed";
    b.snap({
      line: [7, 8, 10, 18], chip: "רץ", tone: "run",
      title: "Client B מתקבל מיד — fork שני",
      note: "עד כאן הכול תקין: הסגירות מתבצעות כמו שצריך ושני הבנים מטפלים בשני לקוחות " +
        "במקביל. הבעיה תתגלה רק כשהבנים יתחילו <b>לסיים</b>."
    });

    /* 11 — first zombie */
    b.reset();
    b.setClient("A", "done", ltr("close(sock)") + " · סיים", "");
    b.dropProc("ch" + PID_CHILD_A);
    b.st.ptable.push({ pid: PID_CHILD_A, label: "Child · Client A" });
    b.kobj("cA").tone = "gone";
    b.proc("srv").status = { t: "חסום ב-" + ltr("accept()"), tone: "block" };
    b.snap({
      line: 16, chip: ltr("Zombie #1"), tone: "err",
      title: "הבן הראשון סיים — ואף אחד לא קוצר אותו",
      note: "הבן ביצע " + ltr("exit(0)") + " ונשאר בטבלת התהליכים כ-<b>Zombie</b> — רשומה " +
        "שממתינה לכך שהאב יקרא ל-" + ltr("wait") + ". אבל בענף האב אין " + ltr("waitpid") + "."
    });

    /* 12 — second zombie */
    b.reset();
    b.setClient("B", "done", ltr("close(sock)") + " · סיים", "");
    b.dropProc("ch" + PID_CHILD_B);
    b.st.ptable.push({ pid: PID_CHILD_B, label: "Child · Client B" });
    b.kobj("cB").tone = "gone";
    b.snap({
      line: 19, chip: ltr("Zombie #2"), tone: "err",
      title: "עוד בן מסיים — עוד זומבי",
      note: "השורה " + ltr("while (waitpid(-1, NULL, WNOHANG) > 0);") + " הוסרה מענף האב, " +
        "ולכן אף אחד לא אוסף את רשומות הבנים שסיימו. הן פשוט מצטברות."
    });

    /* 13 — the process table fills up */
    b.reset();
    b.setClient("A", "idle", "לא מחובר", "");
    b.setClient("B", "idle", "לא מחובר", "");
    b.st.ptable.push({ pid: 1119, label: "Child · לקוח שלישי" });
    b.st.ptable.push({ pid: 1126, label: "Child · לקוח רביעי" });
    b.proc("srv").status = { t: ltr("fork()") + " נכשל — אין מקום", tone: "err" };
    b.snap({
      line: [8, 19], chip: "טבלת התהליכים מתמלאת", tone: "err",
      title: "אחרי מספיק לקוחות — הטבלה מתמלאת",
      note: ltr("<b>\"If the server runs for a long time without waitpid, the process table will " +
        "fill up\"</b>") + ": כל לקוח שהגיע והלך משאיר זומבי. בשלב מסוים אי אפשר ליצור תהליכים " +
        "חדשים — " + ltr("fork()") + " נכשל, והשרת מפסיק לשרת לקוחות."
    });

    /* 14 — the fix */
    b.reset();
    b.snap({
      line: 19, chip: "התיקון: waitpid + WNOHANG", tone: "ok",
      title: "התיקון — לולאת waitpid לא-חוסמת",
      note: ltr("while (waitpid(-1, NULL, WNOHANG) > 0);") + " בענף האב קוצרת בכל סיבוב את " +
        "<b>כל</b> הבנים שכבר סיימו, ומיד חוזרת: <b>WNOHANG</b> = " + ltr("Non-blocking") +
        " — האב לא נעצר ולו לרגע וממשיך לקבל לקוחות."
    });

    return b.steps;
  }

  function buildConcurrentNoExit() {
    var b = new B();
    concurrentCore(b, "no-exit");

    /* 10 — A disconnects; the child closes but never exits */
    b.reset();
    b.setClient("A", "done", ltr("close(sock)") + " · התנתק", "");
    b.fd("ch" + PID_CHILD_A, 4).tone = "gone";
    b.fd("ch" + PID_CHILD_A, 4).desc = "closed";
    b.kobj("cA").tone = "gone";
    b.proc("ch" + PID_CHILD_A).status = { t: "סיים את הלקוח — ולא יצא", tone: "err" };
    b.snap({
      line: [11, 15], chip: "הבן לא הסתיים", tone: "err",
      title: ltr("read") + " מחזירה 0, " + ltr("close") + " מתבצע — ואין " + ltr("exit(0)"),
      note: "לולאת ה-echo נשברה והבן סגר את " + ltr("client_fd") + " כמו שצריך. אבל הבלוק של " +
        "הבן נגמר בלי " + ltr("exit(0)") + ", ולכן <b>התהליך לא מת</b> — הביצוע פשוט ממשיך " +
        "לשורה שאחרי " + ltr("if/else") + "."
    });

    /* 11 — the child falls back into the accept loop */
    b.reset();
    b.proc("ch" + PID_CHILD_A).name = "Child → 2nd accept loop";
    b.proc("ch" + PID_CHILD_A).he = "הבן חזר ללולאת " + ltr("while(1)");
    b.proc("ch" + PID_CHILD_A).status = { t: "מנסה " + ltr("accept()") + " בעצמו!", tone: "err" };
    b.snap({
      line: [6, 7], chip: "שני תהליכים ב-" + ltr("accept()"), tone: "err",
      title: "הבן נופל בחזרה ללולאת " + ltr("while(1)"),
      note: "בדיוק מה שהמרצה מזהיר מפניו: <b>בלי " + ltr("exit(0)") + " הבן ימשיך ללולאת " +
        ltr("while(1)") + " ויתחיל בעצמו לבצע " + ltr("accept") + "</b>. במקום שרת אחד " +
        "שמפצל בנים — יש עכשיו שני תהליכים שמנסים לקבל לקוחות."
    });

    /* 12 — and it spins forever, because server_fd was already closed */
    b.reset();
    b.proc("ch" + PID_CHILD_A).status = { t: ltr("accept() → -1") + " · לולאה אינסופית", tone: "err" };
    b.setClient("B", "connect", ltr("connect()") + " · מי יענה?", "");
    b.proc("srv").status = { t: "חסום ב-" + ltr("accept()"), tone: "block" };
    b.snap({
      line: [7, 9], chip: "תהליך רץ שלא מת לעולם", tone: "err",
      title: "ומכאן זה רק מחמיר",
      note: "הבן כבר סגר את " + ltr("server_fd") + " (שלב 8), ולכן ה-" + ltr("accept") +
        " שלו נכשל מיד — ובקוד הזה כישלון accept הוא " + ltr("perror") + " + " +
        ltr("continue") + ". התוצאה: <b>לולאה אינסופית שאוכלת CPU</b>, ותהליך שלא מסתיים " +
        "לעולם — ולכן גם לא הופך לזומבי ולא נקצר."
    });

    /* 13 — the fix */
    b.reset();
    b.snap({
      line: 16, chip: "התיקון: " + ltr("exit(0)"), tone: "ok",
      title: "התיקון — " + ltr("exit(0)") + " בסוף קוד הבן",
      note: "בקוד המרצה השורה מסומנת " + ltr("<b>\"Terminate child process - very important!\"</b>") + ". " +
        ltr("exit(0)") + " מסיים את הבן, משחרר את משאביו, והופך אותו לזומבי קצר-ימים שהאב " +
        "קוצר ב-" + ltr("waitpid") + " — בדיוק כפי שתוכנן."
    });

    return b.steps;
  }

  var SCENARIOS = [
    { key: "ok", label: "תקין", build: buildConcurrentOk },
    { key: "no-close", label: "האב לא סוגר client_fd",
      html: "האב לא סוגר " + ltr("client_fd"), build: buildConcurrentNoClose },
    { key: "no-wait", label: "בלי waitpid", build: buildConcurrentNoWait },
    { key: "no-exit", label: "הבן לא קורא exit(0)",
      html: "הבן לא קורא " + ltr("exit(0)"), build: buildConcurrentNoExit }
  ];

  /* =====================================================================
     STYLE (scoped, injected once)
     ===================================================================== */
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      ".viz-echo{direction:rtl;--es-mono:var(--font-mono,ui-monospace,Consolas,monospace)}",
      ".viz-echo .es-top{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-bottom:.6rem}",
      ".viz-echo .es-mode{display:inline-block;background:var(--accent);color:#fff;font-weight:700;",
      "font-size:.72rem;padding:2px 10px;border-radius:99px}",
      ".viz-echo .es-lede{font-size:.82rem;color:var(--ink-soft);line-height:1.6}",
      ".viz-echo .es-scn{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.7rem}",
      ".viz-echo .es-scn .viz-btn{font-size:.78rem;padding:.28rem .8rem}",

      ".viz-echo .es-stage{direction:ltr;display:flex;flex-wrap:wrap;gap:.7rem;",
      "align-items:flex-start;min-height:420px}",
      ".viz-echo .es-col{flex:1 1 185px;min-width:0;display:flex;flex-direction:column;gap:.55rem}",
      ".viz-echo .es-col-code{flex:1.75 1 240px}",
      ".viz-echo .es-cap{font-size:.66rem;font-weight:800;letter-spacing:.02em;",
      "color:var(--ink-soft);margin-bottom:.3rem}",

      /* process boxes */
      ".viz-echo .es-proc{border:1.5px solid var(--line);border-radius:10px;background:var(--surface);",
      "padding:.45rem .55rem}",
      ".viz-echo .es-proc[data-role=\"child\"]{border-color:color-mix(in srgb,var(--accent) 50%,var(--line));",
      "background:color-mix(in srgb,var(--accent) 5%,var(--surface))}",
      ".viz-echo .es-proc-head{display:flex;justify-content:space-between;align-items:baseline;gap:.4rem}",
      ".viz-echo .es-proc-name{font-family:var(--es-mono);font-size:.75rem;font-weight:800;color:var(--ink)}",
      ".viz-echo .es-pid{font-family:var(--es-mono);font-size:.64rem;color:var(--ink-soft);white-space:nowrap}",
      ".viz-echo .es-he{font-size:.72rem;color:var(--ink-soft);margin:.1rem 0 .35rem}",
      ".viz-echo .es-fdt{border-top:1px dashed var(--line);padding-top:.3rem}",
      ".viz-echo .es-fd{display:flex;gap:.4rem;align-items:baseline;padding:.13rem .28rem;",
      "border-radius:5px;border:1px solid transparent}",
      ".viz-echo .es-fd-n{font-family:var(--es-mono);font-size:.72rem;font-weight:800;color:var(--ink);",
      "min-width:1.1em;text-align:center}",
      ".viz-echo .es-fd-b{min-width:0}",
      ".viz-echo .es-fd-name{font-family:var(--es-mono);font-size:.68rem;font-weight:700;color:var(--ink);",
      "display:block;line-height:1.25;overflow-wrap:anywhere}",
      ".viz-echo .es-fd-d{font-size:.64rem;color:var(--ink-soft);display:block;line-height:1.3;",
      "overflow-wrap:anywhere}",
      ".viz-echo .es-fd[data-tone=\"new\"],.viz-echo .es-fd[data-tone=\"hot\"]{",
      "background:color-mix(in srgb,var(--accent) 16%,var(--surface));border-color:var(--accent)}",
      ".viz-echo .es-fd[data-tone=\"leak\"]{background:color-mix(in srgb,var(--err) 14%,var(--surface));",
      "border-color:var(--err)}",
      ".viz-echo .es-fd[data-tone=\"leak\"] .es-fd-n,.viz-echo .es-fd[data-tone=\"leak\"] .es-fd-name{color:var(--err)}",
      ".viz-echo .es-fd[data-tone=\"gone\"]{opacity:.5}",
      ".viz-echo .es-fd[data-tone=\"gone\"] .es-fd-name,.viz-echo .es-fd[data-tone=\"gone\"] .es-fd-n{",
      "text-decoration:line-through}",
      ".viz-echo .es-status{margin-top:.35rem;font-size:.68rem;font-weight:700;border-radius:99px;",
      "padding:.12rem .55rem;display:inline-block;background:var(--surface-2);color:var(--ink-soft);",
      "border:1px solid var(--line)}",
      ".viz-echo .es-status[data-tone=\"block\"]{background:color-mix(in srgb,var(--mustard,#C9A24B) 22%,var(--surface));",
      "color:var(--ink);border-color:color-mix(in srgb,var(--mustard,#C9A24B) 60%,var(--line))}",
      ".viz-echo .es-status[data-tone=\"run\"]{background:color-mix(in srgb,var(--ok) 16%,var(--surface));",
      "color:var(--ink);border-color:color-mix(in srgb,var(--ok) 55%,var(--line))}",
      ".viz-echo .es-status[data-tone=\"ok\"]{background:color-mix(in srgb,var(--ok) 22%,var(--surface));",
      "color:var(--ink);border-color:var(--ok)}",
      ".viz-echo .es-status[data-tone=\"err\"]{background:color-mix(in srgb,var(--err) 16%,var(--surface));",
      "color:var(--err);border-color:var(--err)}",

      /* kernel + process table panels */
      ".viz-echo .es-panel{border:1.5px solid var(--line);border-radius:10px;background:var(--surface-2);",
      "padding:.45rem .55rem}",
      ".viz-echo .es-kobj{display:flex;flex-wrap:wrap;row-gap:.15rem;justify-content:space-between;",
      "align-items:center;gap:.4rem;padding:.22rem .3rem;border-radius:6px;border:1px solid transparent}",
      ".viz-echo .es-kobj-label{font-family:var(--es-mono);font-size:.66rem;color:var(--ink);min-width:0;",
      "overflow-wrap:anywhere}",
      ".viz-echo .es-refbadge{font-family:var(--es-mono);font-size:.63rem;font-weight:800;white-space:nowrap;",
      "border-radius:99px;padding:.08rem .5rem;background:var(--surface);border:1px solid var(--line);color:var(--ink)}",
      ".viz-echo .es-kobj[data-tone=\"hot\"]{background:color-mix(in srgb,var(--accent) 12%,var(--surface));",
      "border-color:var(--accent)}",
      ".viz-echo .es-kobj[data-tone=\"hot\"] .es-refbadge{background:var(--accent);color:#fff;border-color:var(--accent)}",
      ".viz-echo .es-kobj[data-tone=\"bad\"]{background:color-mix(in srgb,var(--err) 12%,var(--surface));",
      "border-color:var(--err)}",
      ".viz-echo .es-kobj[data-tone=\"bad\"] .es-refbadge{background:var(--err);color:#fff;border-color:var(--err)}",
      ".viz-echo .es-zrow{display:flex;justify-content:space-between;align-items:center;gap:.4rem;",
      "font-family:var(--es-mono);font-size:.64rem;font-weight:700;color:var(--ink-soft);",
      "background:color-mix(in srgb,var(--ink-soft) 16%,var(--surface));border:1px dashed var(--ink-soft);",
      "border-radius:6px;padding:.2rem .45rem;margin-top:.25rem}",
      ".viz-echo .es-empty{font-size:.66rem;color:var(--ink-soft);opacity:.8;padding:.15rem .3rem}",

      /* code strip */
      ".viz-echo .es-code{direction:ltr;border:1.5px solid var(--line);border-radius:10px;",
      "background:var(--surface-2);padding:.45rem .3rem;font-family:var(--es-mono);font-size:.66rem;",
      "line-height:1.55}",
      ".viz-echo .es-line{display:flex;gap:.4rem;padding:.02rem .3rem;border-radius:4px;color:var(--ink-soft)}",
      ".viz-echo .es-ln{opacity:.55;min-width:1.4em;text-align:right;font-size:.62rem;",
      "flex:0 0 auto;padding-top:.1rem}",
      ".viz-echo .es-c{white-space:pre-wrap;overflow-wrap:anywhere;flex:1 1 auto}",
      ".viz-echo .es-line.on{background:color-mix(in srgb,var(--accent) 18%,var(--surface));",
      "color:var(--ink);font-weight:700;box-shadow:inset 3px 0 0 var(--accent)}",
      ".viz-echo .es-line.bad{color:var(--err);background:color-mix(in srgb,var(--err) 10%,var(--surface));",
      "box-shadow:inset 3px 0 0 var(--err)}",

      /* clients */
      ".viz-echo .es-client{border:1.5px solid var(--line);border-radius:10px;background:var(--surface);",
      "padding:.45rem .55rem}",
      ".viz-echo .es-client[data-state=\"idle\"]{border-style:dashed;opacity:.6}",
      ".viz-echo .es-client[data-state=\"served\"]{border-color:var(--ok);",
      "background:color-mix(in srgb,var(--ok) 8%,var(--surface))}",
      ".viz-echo .es-client[data-state=\"queue\"]{border-color:var(--err);",
      "background:color-mix(in srgb,var(--err) 8%,var(--surface))}",
      ".viz-echo .es-client[data-state=\"connect\"]{border-color:var(--accent);",
      "background:color-mix(in srgb,var(--accent) 8%,var(--surface))}",
      ".viz-echo .es-client[data-state=\"done\"]{opacity:.75}",
      ".viz-echo .es-client-name{font-family:var(--es-mono);font-size:.75rem;font-weight:800;color:var(--ink)}",
      ".viz-echo .es-client-he{font-size:.7rem;color:var(--ink-soft);margin-top:.15rem;line-height:1.4}",
      ".viz-echo .es-client-msg{font-family:var(--es-mono);font-size:.63rem;color:var(--ink);",
      "background:var(--surface-2);border:1px solid var(--line);border-radius:6px;",
      "padding:.15rem .35rem;margin-top:.3rem;overflow-wrap:anywhere}",
      ".viz-echo .es-bl{display:flex;flex-wrap:wrap;gap:.2rem;margin-top:.25rem}",
      ".viz-echo .es-slot{width:1.35rem;height:1.35rem;border-radius:4px;border:1px dashed var(--line);",
      "background:var(--surface);font-family:var(--es-mono);font-size:.62rem;font-weight:800;",
      "display:flex;align-items:center;justify-content:center;color:var(--ink-soft)}",
      ".viz-echo .es-slot.full{border-style:solid;border-color:var(--err);color:var(--err);",
      "background:color-mix(in srgb,var(--err) 14%,var(--surface))}",
      ".viz-echo .es-panel[data-tone=\"hot\"]{border-color:var(--accent)}",
      ".viz-echo .es-panel[data-tone=\"bad\"]{border-color:var(--err)}",

      /* foot */
      ".viz-echo .es-foot{margin-top:.75rem;background:var(--surface-2);border:1px solid var(--line);",
      "border-radius:12px;padding:.65rem .8rem;min-height:96px}",
      ".viz-echo .es-chip{display:inline-block;font-size:.72rem;font-weight:800;border-radius:99px;",
      "padding:.12rem .7rem;margin-inline-end:.5rem;background:var(--surface);border:1.5px solid var(--line);",
      "color:var(--ink)}",
      ".viz-echo .es-chip[data-tone=\"block\"]{border-color:color-mix(in srgb,var(--mustard,#C9A24B) 70%,var(--line));",
      "background:color-mix(in srgb,var(--mustard,#C9A24B) 20%,var(--surface))}",
      ".viz-echo .es-chip[data-tone=\"run\"]{border-color:var(--ok);background:color-mix(in srgb,var(--ok) 14%,var(--surface))}",
      ".viz-echo .es-chip[data-tone=\"ok\"]{border-color:var(--ok);background:color-mix(in srgb,var(--ok) 22%,var(--surface))}",
      ".viz-echo .es-chip[data-tone=\"err\"]{border-color:var(--err);color:var(--err);",
      "background:color-mix(in srgb,var(--err) 12%,var(--surface))}",
      ".viz-echo .es-title{font-weight:800;font-size:.92rem;color:var(--ink)}",
      ".viz-echo .es-note{margin-top:.35rem;font-size:.86rem;line-height:1.7;color:var(--ink)}",
      ".viz-echo .es-counter{margin-inline-start:auto;font-weight:700;color:var(--ink-soft);",
      "font-size:.82rem;align-self:center}",
      "@media (max-width:640px){.viz-echo .es-stage{min-height:0}",
      ".viz-echo .es-col,.viz-echo .es-col-code{flex:1 1 100%}}"
    ].join("");
    document.head.appendChild(s);
  }

  /* =====================================================================
     RENDER HELPERS — HTML strings built from the state object
     ===================================================================== */
  function fdRowHtml(f) {
    return '<div class="es-fd" data-tone="' + f.tone + '">' +
      '<span class="es-fd-n">' + f.n + "</span>" +
      '<span class="es-fd-b">' +
      '<span class="es-fd-name">' + (f.name || "&mdash;") + "</span>" +
      '<span class="es-fd-d" dir="auto">' + f.desc + "</span>" +
      "</span></div>";
  }

  function procHtml(p) {
    var h = '<div class="es-proc" data-role="' + p.role + '">' +
      '<div class="es-proc-head"><span class="es-proc-name">' + p.name + "</span>" +
      '<span class="es-pid">PID ' + p.pid + "</span></div>";
    if (p.he) h += '<div class="es-he" dir="rtl">' + p.he + "</div>";
    if (p.fds && p.fds.length) {
      h += '<div class="es-fdt"><div class="es-cap">FD table</div>' +
        p.fds.map(fdRowHtml).join("") + "</div>";
    }
    if (p.status) {
      h += '<div class="es-status" data-tone="' + p.status.tone + '" dir="rtl">' +
        p.status.t + "</div>";
    }
    return h + "</div>";
  }

  function kernelHtml(kobjs) {
    var h = '<div class="es-panel"><div class="es-cap" dir="rtl">הקרנל — אובייקטי socket פתוחים</div>';
    if (!kobjs.length) h += '<div class="es-empty" dir="rtl">אין עדיין sockets פתוחים</div>';
    kobjs.forEach(function (k) {
      h += '<div class="es-kobj" data-tone="' + (k.tone || "") + '">' +
        '<span class="es-kobj-label" dir="auto">' + k.label + "</span>" +
        '<span class="es-refbadge">ref = ' + k.refs + "</span></div>";
    });
    return h + "</div>";
  }

  function ptableHtml(rows) {
    var h = '<div class="es-panel"><div class="es-cap" dir="rtl">טבלת התהליכים</div>';
    rows.forEach(function (z) {
      h += '<div class="es-zrow"><span>PID ' + z.pid + "</span>" +
        "<span>EXIT_ZOMBIE</span></div>";
    });
    return h + "</div>";
  }

  function backlogHtml(bl) {
    var h = '<div class="es-panel" data-tone="' + (bl.tone || "") + '">' +
      '<div class="es-cap" dir="rtl">תור ההמתנה — ' +
      ltr("listen(server_fd, " + bl.cap + ")") + "</div>" +
      '<div class="es-bl">';
    for (var i = 0; i < bl.cap; i++) {
      var item = bl.items[i];
      h += '<div class="es-slot' + (item ? " full" : "") + '">' + (item || "") + "</div>";
    }
    h += "</div>";
    if (bl.items.length) {
      h += '<div class="es-empty" dir="rtl">' + bl.items.length + " חיבור/ים ממתין/ים — עוד לא בוצע accept</div>";
    }
    return h + "</div>";
  }

  function clientHtml(c) {
    var h = '<div class="es-client" data-state="' + c.state + '">' +
      '<div class="es-client-name">' + c.label + "</div>" +
      '<div class="es-client-he" dir="rtl">' + c.he + "</div>";
    if (c.msg) h += '<div class="es-client-msg" dir="ltr">' + escHtml(c.msg) + "</div>";
    return h + "</div>";
  }

  function codeHtml(code, activeLines) {
    var on = {};
    (activeLines || []).forEach(function (i) { on[i] = true; });
    var h = '<div class="es-code" dir="ltr" aria-hidden="false">';
    code.lines.forEach(function (t, i) {
      var cls = "es-line" + (on[i] ? " on" : "") + (i === code.bad ? " bad" : "");
      h += '<div class="' + cls + '"><span class="es-ln">' + (i + 1) + "</span>" +
        '<span class="es-c">' + escHtml(t) + "</span></div>";
    });
    return h + "</div>";
  }

  /* =====================================================================
     Render one mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-echo-ready") === "1") return;
    mount.setAttribute("data-echo-ready", "1");
    mount.innerHTML = "";
    ensureStyle();

    var inst = ++instCount;
    var mode = mount.getAttribute("data-mode") === "concurrent" ? "concurrent" : "iterative";

    var root = ce("div", "viz-echo", null);
    root.setAttribute("data-mode", mode);
    root.setAttribute("data-step", "1");
    root.setAttribute("tabindex", "0");
    root.style.outline = "none";

    /* header */
    var top = ce("div", "es-top", root);
    var modeChip = ce("span", "es-mode", top,
      mode === "concurrent" ? "Concurrent Echo Server · fork()" : "Iterative Echo Server");
    modeChip.setAttribute("dir", "ltr");
    var lede = ce("div", "es-lede", top);
    lede.innerHTML = mode === "concurrent"
      ? "עקבו אחרי הקוד של " + ltr("concurrent_server.c") + " צעד-אחר-צעד — כולל מוני ההפניות של הקרנל."
      : "עקבו אחרי הקוד של " + ltr("server.c") + " צעד-אחר-צעד — ותראו למה לקוח אחד חוסם את כולם.";

    /* scenario selector (concurrent only) */
    var scnRow = null, scnBtns = [];
    var scenario = "ok";
    if (mode === "concurrent") {
      scnRow = ce("div", "es-scn", root);
      scnRow.setAttribute("role", "group");
      scnRow.setAttribute("aria-label", "בחירת תרחיש");
      SCENARIOS.forEach(function (sc) {
        var btn = ce("button", "viz-btn", scnRow);
        btn.innerHTML = sc.html || sc.label;
        btn.type = "button";
        btn.setAttribute("aria-label", "תרחיש: " + sc.label);
        btn.addEventListener("click", function () { setScenario(sc.key); });
        scnBtns.push({ key: sc.key, btn: btn });
      });
    }

    var stage = ce("div", "es-stage", root);
    stage.setAttribute("dir", "ltr");
    var colServer = ce("div", "es-col es-col-server", stage);
    var colCode = ce("div", "es-col es-col-code", stage);
    var colClients = ce("div", "es-col es-col-clients", stage);

    var foot = ce("div", "es-foot", root);
    foot.setAttribute("aria-live", "polite");

    /* controls */
    var controls = ce("div", "viz-controls", root);
    function mkBtn(label, aria, fn) {
      var b = ce("button", "viz-btn", controls, label);
      b.type = "button";
      b.setAttribute("aria-label", aria);
      b.addEventListener("click", fn);
      return b;
    }
    var btnNext = mkBtn("▶ צעד הבא", "מעבר לצעד הבא", function () { go(idx + 1); });
    btnNext.classList.add("primary");
    var btnPrev = mkBtn("◀ צעד אחורה", "חזרה לצעד הקודם", function () { go(idx - 1); });
    var btnReset = mkBtn("⟳ מהתחלה", "התחלה מחדש מהצעד הראשון", function () { stopAuto(); go(0); });
    var btnAuto = mkBtn("▶▶ הרצה אוטומטית", "הרצה אוטומטית של כל הצעדים", function () { toggleAuto(); });
    var counter = ce("span", "es-counter", controls);

    mount.appendChild(root);

    /* ---- state ---- */
    var steps = [], code = null, idx = 0, timer = null;

    function stopAuto() {
      if (timer) { clearInterval(timer); timer = null; }
      btnAuto.textContent = "▶▶ הרצה אוטומטית";
      btnAuto.setAttribute("aria-label", "הרצה אוטומטית של כל הצעדים");
      btnAuto.classList.remove("primary");
    }
    function toggleAuto() {
      if (timer) { stopAuto(); return; }
      if (idx >= steps.length - 1) idx = -1; /* restart from the top */
      btnAuto.textContent = "⏸ עצור";
      btnAuto.setAttribute("aria-label", "עצירת ההרצה האוטומטית");
      btnAuto.classList.add("primary");
      timer = setInterval(function () {
        if (idx >= steps.length - 1) { stopAuto(); return; }
        go(idx + 1);
      }, AUTO_MS);
      go(idx + 1);
    }

    function draw() {
      var s = steps[idx];
      root.setAttribute("data-step", String(idx + 1));

      var left = s.procs.map(procHtml).join("");
      if (s.kobjs) left += kernelHtml(s.kobjs);
      if (s.ptable && s.ptable.length) left += ptableHtml(s.ptable);
      colServer.innerHTML = left;

      colCode.innerHTML = codeHtml(code, s.line);

      var right = "";
      if (s.backlog) right += backlogHtml(s.backlog);
      right += s.clients.map(clientHtml).join("");
      colClients.innerHTML = right;

      foot.innerHTML = '<span class="es-chip" data-tone="' + s.tone + '">' + s.chip + "</span>" +
        '<span class="es-title">' + s.title + "</span>" +
        '<div class="es-note">' + s.note + "</div>";

      counter.textContent = "שלב " + (idx + 1) + " / " + steps.length;
      btnPrev.disabled = idx === 0;
      btnNext.disabled = idx === steps.length - 1;
    }

    function go(n) {
      idx = Math.max(0, Math.min(steps.length - 1, n));
      draw();
    }

    function setScenario(key) {
      stopAuto();
      scenario = key;
      var def = SCENARIOS[0];
      SCENARIOS.forEach(function (sc) { if (sc.key === key) def = sc; });
      steps = def.build();
      code = codeFor(mode, key);
      scnBtns.forEach(function (p) {
        p.btn.classList.toggle("primary", p.key === key);
        p.btn.setAttribute("aria-pressed", p.key === key ? "true" : "false");
      });
      root.setAttribute("data-scenario", key);
      go(0);
    }

    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { stopAuto(); go(idx + 1); e.preventDefault(); }
      else if (e.key === "ArrowRight") { stopAuto(); go(idx - 1); e.preventDefault(); }
      else if (e.key === "Home") { stopAuto(); go(0); e.preventDefault(); }
      else if (e.key === "End") { stopAuto(); go(steps.length - 1); e.preventDefault(); }
    });

    if (mode === "concurrent") {
      setScenario("ok");
    } else {
      steps = buildIterative();
      code = codeFor("iterative", null);
      go(0);
    }
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
