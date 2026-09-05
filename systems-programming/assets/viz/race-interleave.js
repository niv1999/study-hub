/* =====================================================================
   race-interleave.js — "מצב מירוץ ומנגנון ה-Mutex": סימולטור שזירה
   ידני של שני חוטים שמבצעים counter++.

   Grounded in _notes/mutex-race.md (דף העזר של המרצה יצחק נודלר,
   "Race Conditions & The Mutex Mechanism"):
   - עמ' 3: `counter++` אינו אטומי — הוא מתורגם ל-3 הוראות מכונה:
     1. Read  (קריאה מהזיכרון/RAM לאוגר), 2. Modify (+1 בתוך האוגר),
     3. Write (כתיבת הערך מהאוגר חזרה לזיכרון).
   - עמ' 3: תרחיש ה-Interleaving — חוט א' קורא 100, חוט ב' קורא 100,
     שניהם מעלים ל-101 באוגרים הנפרדים שלהם ושניהם כותבים 101; במקום
     102 — קידום אחד אבד.
   - עמ' 8: הלוגיקה מנקודת מבט הקרנל — (1) pthread_mutex_lock בודקת עם
     Atomic Compare-and-Swap; (2) אם המנעול תפוס אין לולאה אינסופית
     (busy-wait) אלא קריאת מערכת futex שמעבירה את החוט ל-Sleep/Blocked
     והקרנל מוציא אותו מתור התזמון; (3) pthread_mutex_unlock מעיר חוט
     אחד מהתור והקרנל מחזיר אותו ל-Ready.
   - עמ' 9: unlock חייבת להתבצע תמיד על ידי אותו חוט שביצע את הנעילה;
     lock היא פעולה חוסמת (Blocking).

   Mount: <div class="viz" data-viz="race-interleave"></div>
   Self-contained IIFE, zero deps, works from file:// ובמצב כהה.
   צבעים — רק ה-CSS custom properties של האתר. ה-chrome בעברית RTL,
   אזור הקוד/המצב הוא dir="ltr". כל הפקדים <button type="button">.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "race-interleave";
  var STYLE_ID = "race-interleave-style";
  var SPEED_MS = 240;          /* קצב ההרצה האוטומטית של הפריסטים */
  var instCount = 0;

  function ce(tag, cls, parent, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  }
  function ltr(s) { return '<span dir="ltr" class="ri-nw">' + s + "</span>"; }
  function mono(s) { return '<span dir="ltr" class="ri-m">' + s + "</span>"; }

  /* =====================================================================
     המודל: תוכנית של החוט = רשימת הוראות מכונה.
     ללא mutex — 3 הוראות לאיטרציה (Read / Modify / Write).
     עם mutex  — 5: lock → Read → Modify → Write → unlock.
     ===================================================================== */
  var PROG_PLAIN = [
    { op: "load",  txt: "LOAD   {r} ← counter" },
    { op: "add",   txt: "{r} ← {r} + 1" },
    { op: "store", txt: "STORE  counter ← {r}" }
  ];
  var PROG_MUTEX = [
    { op: "lock",   txt: "pthread_mutex_lock(&m);" },
    { op: "load",   txt: "LOAD   {r} ← counter" },
    { op: "add",    txt: "{r} ← {r} + 1" },
    { op: "store",  txt: "STORE  counter ← {r}" },
    { op: "unlock", txt: "pthread_mutex_unlock(&m);" }
  ];

  var IDS = ["T1", "T2"];
  var REG = { T1: "r1", T2: "r2" };
  var START = 0;               /* int counter = 0; — כמו בקוד של המרצה */

  function programOf(st) { return st.mutex ? PROG_MUTEX : PROG_PLAIN; }
  function totalInstr(st) { return programOf(st).length * st.K; }
  function isDone(st, id) { return st.th[id].pc >= totalInstr(st); }
  function runnable(st, id) { return !isDone(st, id) && !st.th[id].blocked; }

  function makeState(K, mutex) {
    return {
      K: K, mutex: !!mutex,
      counter: START,
      th: {
        T1: { id: "T1", pc: 0, reg: null, blocked: false },
        T2: { id: "T2", pc: 0, reg: null, blocked: false }
      },
      owner: null,             /* בעל המנעול */
      waiters: [],             /* תור הממתינים (futex wait queue) */
      log: [],
      steps: 0,
      last: null,              /* החוט שביצע את ההוראה האחרונה = Running */
      lost: 0,                 /* כמה קידומים אבדו */
      flash: null,             /* "ok" / "bad" — הבהוב תא הזיכרון */
      running: false
    };
  }

  function push(st, id, kind, html) { st.log.push({ id: id, kind: kind, html: html }); }

  /* ביצוע הוראת מכונה אחת של חוט אחד. מחזיר true אם בוצע משהו. */
  function step(st, id) {
    if (!runnable(st, id)) return false;
    var th = st.th[id], prog = programOf(st), L = prog.length;
    var ins = prog[th.pc % L];
    var r = REG[id];
    st.flash = null;

    if (ins.op === "lock") {
      if (st.owner === null) {
        st.owner = id;
        th.pc++;
        push(st, id, "lock", id + " ביצע " + mono("pthread_mutex_lock") +
          " — ה-" + mono("Compare-and-Swap") + " האטומי הצליח, המנעול בידיו. " +
          "החוט נכנס ל<b>קטע הקריטי</b>.");
      } else {
        th.blocked = true;
        if (st.waiters.indexOf(id) < 0) st.waiters.push(id);
        push(st, id, "block", id + " ניסה לנעול אבל המנעול תפוס אצל " + st.owner +
          " → קריאת המערכת " + mono("futex") + " מעבירה אותו ל-<b>Sleep/Blocked</b>; " +
          "הקרנל מוציא אותו מתור התזמון והוא <b>לא מבזבז זמן CPU</b>.");
      }
    } else if (ins.op === "load") {
      th.reg = st.counter;
      th.pc++;
      push(st, id, "read", id + " <b>קרא</b> " + mono(String(st.counter)) +
        " מהזיכרון אל האוגר " + mono(r) + " (שלב Read).");
    } else if (ins.op === "add") {
      var before = th.reg;
      th.reg = th.reg + 1;
      th.pc++;
      push(st, id, "calc", id + " <b>חישב באוגר שלו</b>: " +
        mono(before + " + 1 = " + th.reg) + " (שלב Modify — הזיכרון עדיין " +
        mono(String(st.counter)) + ").");
    } else if (ins.op === "store") {
      var old = st.counter;
      st.counter = th.reg;
      th.pc++;
      push(st, id, "write", id + " <b>כתב</b> " + mono(String(st.counter)) +
        " מהאוגר " + mono(r) + " חזרה לזיכרון (שלב Write).");
      if (st.counter <= old) {
        st.lost++;
        st.flash = "bad";
        push(st, id, "lost", "⚠ הכתיבה של " + id + " <b>דרסה</b> את הכתיבה הקודמת — " +
          mono("counter") + " נשאר " + mono(String(st.counter)) + " במקום " +
          mono(String(old + 1)) + ". <b>קידום אחד אבד!</b>");
      } else {
        st.flash = "ok";
      }
    } else if (ins.op === "unlock") {
      if (st.owner !== id) {
        /* לא אמור לקרות — unlock תמיד ע"י החוט שנעל */
        push(st, id, "block", id + " ניסה לשחרר מנעול שאינו שלו — " +
          mono("pthread_mutex_unlock") + " חייבת להתבצע ע\"י החוט שנעל.");
        return false;
      }
      st.owner = null;
      th.pc++;
      var woke = st.waiters.length ? st.waiters.shift() : null;
      if (woke) {
        st.th[woke].blocked = false;
        push(st, id, "unlock", id + " ביצע " + mono("pthread_mutex_unlock") +
          " ויצא מהקטע הקריטי → הקרנל <b>מעיר</b> את " + woke +
          ": " + mono("Blocked → Ready") + ".");
      } else {
        push(st, id, "unlock", id + " ביצע " + mono("pthread_mutex_unlock") +
          " — המנעול פנוי (אין ממתינים בתור).");
      }
    }

    st.steps++;
    st.last = id;
    if (isDone(st, id)) {
      push(st, id, "done", id + " סיים את כל " + st.K + " האיטרציות — " +
        mono("Done") + ".");
    }
    return true;
  }

  /* מצב תצוגתי של חוט */
  function stateOf(st, id) {
    if (isDone(st, id)) return "done";
    if (st.th[id].blocked) return "blocked";
    if (st.last === id) return "running";
    return "ready";
  }
  var STATE_HE = {
    running: "Running", ready: "Ready", blocked: "Blocked", done: "Done"
  };

  /* =====================================================================
     STYLE (scoped, מוזרק פעם אחת)
     ===================================================================== */
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      ".viz-race-interleave{direction:rtl;min-height:380px}" +
      ".viz-race-interleave .ri-m{font-family:var(--font-mono,ui-monospace,Consolas,monospace);" +
      "font-weight:700;font-size:.92em;white-space:nowrap}" +
      ".viz-race-interleave .ri-nw{white-space:nowrap}" +
      ".viz-race-interleave .ri-lead{font-size:.86rem;color:var(--ink-soft);line-height:1.65;margin-bottom:.7rem}" +

      /* ---- שורות פקדים ---- */
      ".viz-race-interleave .ri-bar{display:flex;flex-wrap:wrap;gap:.45rem;align-items:center;margin-bottom:.6rem}" +
      ".viz-race-interleave .ri-bar-label{font-size:.82rem;font-weight:700;color:var(--ink-soft)}" +
      ".viz-race-interleave .ri-seg{display:inline-flex;gap:.25rem;background:var(--surface-2);" +
      "border:1.5px solid var(--line);border-radius:99px;padding:.15rem}" +
      ".viz-race-interleave .ri-seg .viz-btn{border:none;background:transparent;padding:.22rem .7rem;font-size:.82rem}" +
      ".viz-race-interleave .ri-seg .viz-btn.primary{background:var(--accent);color:#fff}" +
      ".viz-race-interleave .ri-spacer{flex:1 1 auto}" +
      ".viz-race-interleave .ri-help-btn{width:2rem;height:2rem;padding:0;border-radius:50%;font-weight:800}" +

      /* ---- הגריד ---- */
      ".viz-race-interleave .ri-grid{display:grid;grid-template-columns:1fr minmax(160px,.9fr) 1fr;" +
      "gap:.6rem;align-items:stretch}" +
      "@media (max-width:760px){.viz-race-interleave .ri-grid{grid-template-columns:1fr}}" +

      /* ---- כרטיס חוט ---- */
      ".viz-race-interleave .ri-thread{background:var(--surface-2);border:1.5px solid var(--line);" +
      "border-radius:12px;padding:.55rem .6rem;transition:border-color .15s ease,opacity .15s ease}" +
      ".viz-race-interleave .ri-thread[data-state='running']{border-color:var(--accent);" +
      "box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 20%,transparent)}" +
      ".viz-race-interleave .ri-thread[data-state='blocked']{opacity:.75;" +
      "background:color-mix(in srgb,var(--ink-soft) 14%,var(--surface));border-style:dashed}" +
      ".viz-race-interleave .ri-thread[data-state='done']{opacity:.9;border-color:var(--ok)}" +
      ".viz-race-interleave .ri-thead{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap}" +
      ".viz-race-interleave .ri-tname{font-family:var(--font-mono,ui-monospace,Consolas,monospace);" +
      "font-weight:800;font-size:1rem;color:var(--ink)}" +
      ".viz-race-interleave .ri-pill{font-size:.7rem;font-weight:800;padding:.1rem .55rem;border-radius:99px;" +
      "border:1.5px solid var(--line);color:var(--ink-soft);background:var(--surface)}" +
      ".viz-race-interleave .ri-pill[data-state='running']{background:var(--accent);color:#fff;border-color:var(--accent)}" +
      ".viz-race-interleave .ri-pill[data-state='done']{background:var(--ok);color:#fff;border-color:var(--ok)}" +
      ".viz-race-interleave .ri-pill[data-state='blocked']{border-style:dashed}" +
      ".viz-race-interleave .ri-iter{margin-inline-start:auto;font-size:.72rem;color:var(--ink-soft);font-weight:700}" +

      ".viz-race-interleave .ri-code{direction:ltr;text-align:left;background:var(--surface);" +
      "border:1px solid var(--line);border-radius:8px;padding:.3rem;margin:.45rem 0 .4rem;" +
      "font-family:var(--font-mono,ui-monospace,Consolas,monospace);font-size:.72rem;overflow-x:auto}" +
      ".viz-race-interleave .ri-line{display:block;white-space:pre;padding:.15rem .4rem;border-radius:5px;" +
      "color:var(--ink-soft)}" +
      ".viz-race-interleave .ri-line.cur{background:color-mix(in srgb,var(--accent) 20%,var(--surface));" +
      "color:var(--ink);font-weight:700}" +
      ".viz-race-interleave .ri-line.crit{border-inline-start:3px solid color-mix(in srgb,var(--err) 55%,transparent)}" +

      ".viz-race-interleave .ri-reg{direction:ltr;text-align:center;font-family:var(--font-mono,ui-monospace,Consolas,monospace);" +
      "font-size:.82rem;font-weight:800;color:var(--ink);background:var(--surface);border:1px solid var(--line);" +
      "border-radius:7px;padding:.2rem .4rem}" +
      ".viz-race-interleave .ri-chip{margin-top:.4rem;font-size:.72rem;font-weight:700;line-height:1.5;" +
      "border-radius:8px;padding:.25rem .45rem;text-align:center}" +
      ".viz-race-interleave .ri-chip.blk{background:color-mix(in srgb,var(--ink-soft) 26%,var(--surface));" +
      "color:var(--ink);border:1px dashed var(--ink-soft)}" +
      ".viz-race-interleave .ri-chip.own{background:color-mix(in srgb,var(--accent) 18%,var(--surface));color:var(--ink)}" +
      ".viz-race-interleave .ri-step-btn{width:100%;margin-top:.45rem}" +

      /* ---- הזיכרון המשותף ---- */
      ".viz-race-interleave .ri-mem{background:var(--surface-2);border:1.5px solid var(--line);" +
      "border-radius:12px;padding:.6rem .5rem;text-align:center;display:flex;flex-direction:column;gap:.35rem}" +
      ".viz-race-interleave .ri-mem-t{font-size:.76rem;font-weight:800;color:var(--ink-soft)}" +
      ".viz-race-interleave .ri-cell{direction:ltr;font-family:var(--font-mono,ui-monospace,Consolas,monospace);" +
      "font-size:1.75rem;font-weight:800;color:var(--ink);background:var(--surface);border:2px solid var(--line);" +
      "border-radius:10px;padding:.25rem .2rem}" +
      ".viz-race-interleave .ri-cell.f-ok{animation:ri-pop-ok .5s ease-out}" +
      ".viz-race-interleave .ri-cell.f-bad{animation:ri-pop-bad .5s ease-out}" +
      "@keyframes ri-pop-ok{0%{background:color-mix(in srgb,var(--ok) 40%,var(--surface));transform:scale(1.09)}" +
      "100%{background:var(--surface);transform:scale(1)}}" +
      "@keyframes ri-pop-bad{0%{background:color-mix(in srgb,var(--err) 45%,var(--surface));transform:scale(1.09)}" +
      "100%{background:var(--surface);transform:scale(1)}}" +
      ".viz-race-interleave .ri-cellname{direction:ltr;font-family:var(--font-mono,ui-monospace,Consolas,monospace);" +
      "font-size:.74rem;font-weight:700;color:var(--ink-soft)}" +
      ".viz-race-interleave .ri-lockrow{font-size:.74rem;font-weight:700;color:var(--ink);" +
      "border:1.5px solid var(--line);border-radius:99px;padding:.2rem .4rem;background:var(--surface)}" +
      ".viz-race-interleave .ri-lockrow[data-held='1']{border-color:var(--accent);" +
      "background:color-mix(in srgb,var(--accent) 15%,var(--surface))}" +
      ".viz-race-interleave .ri-wait{font-size:.7rem;color:var(--ink-soft);font-weight:700}" +

      /* ---- סיכום ---- */
      ".viz-race-interleave .ri-sum{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;justify-content:center;" +
      "margin-top:.7rem;font-size:.88rem;font-weight:700;color:var(--ink)}" +
      ".viz-race-interleave .ri-badge{font-size:.8rem;font-weight:800;padding:.2rem .7rem;border-radius:99px;color:#fff}" +
      ".viz-race-interleave .ri-badge.bad{background:var(--err)}" +
      ".viz-race-interleave .ri-badge.good{background:var(--ok)}" +

      /* ---- יומן ---- */
      ".viz-race-interleave .ri-logwrap{margin-top:.7rem;background:var(--surface-2);border:1px solid var(--line);" +
      "border-radius:12px;padding:.5rem .6rem}" +
      ".viz-race-interleave .ri-logtitle{font-size:.76rem;font-weight:800;color:var(--ink-soft);margin-bottom:.3rem}" +
      ".viz-race-interleave .ri-log{max-height:168px;overflow-y:auto;font-size:.8rem;line-height:1.6}" +
      ".viz-race-interleave .ri-ent{display:flex;gap:.4rem;padding:.16rem 0;border-top:1px dotted var(--line)}" +
      ".viz-race-interleave .ri-ent:first-child{border-top:none}" +
      ".viz-race-interleave .ri-tag{flex:0 0 auto;font-family:var(--font-mono,ui-monospace,Consolas,monospace);" +
      "font-size:.7rem;font-weight:800;color:var(--surface);background:var(--ink-soft);border-radius:5px;" +
      "padding:.05rem .3rem;height:1.2rem;line-height:1.15rem}" +
      ".viz-race-interleave .ri-ent[data-id='T1'] .ri-tag{background:var(--accent)}" +
      ".viz-race-interleave .ri-ent[data-id='T2'] .ri-tag{background:color-mix(in srgb,var(--ink) 62%,var(--accent))}" +
      ".viz-race-interleave .ri-ent[data-kind='lost'] .ri-txt{color:var(--err);font-weight:700}" +
      ".viz-race-interleave .ri-ent[data-kind='sched'] .ri-txt{color:var(--ink-soft);font-style:italic}" +
      ".viz-race-interleave .ri-ent[data-kind='block'] .ri-txt{color:var(--ink-soft)}" +
      ".viz-race-interleave .ri-ent[data-kind='done'] .ri-txt{color:var(--ok);font-weight:700}" +

      /* ---- פאנל ההסבר ---- */
      ".viz-race-interleave .ri-help{margin-top:.7rem;background:var(--surface-2);border:1px solid var(--line);" +
      "border-radius:12px;padding:.7rem .85rem;font-size:.86rem;line-height:1.75;color:var(--ink)}" +
      ".viz-race-interleave .ri-help h4{margin:.6rem 0 .15rem;font-size:.88rem;color:var(--accent)}" +
      ".viz-race-interleave .ri-help h4:first-child{margin-top:0}" +
      ".viz-race-interleave .ri-help ol{margin:.2rem 1.2rem;padding:0}";
    document.head.appendChild(s);
  }

  /* =====================================================================
     בניית ה-DOM פעם אחת; repaint(state) מצייר מחדש מתוך אובייקט המצב.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-ri-ready") === "1") return;
    mount.setAttribute("data-ri-ready", "1");
    mount.innerHTML = "";
    ensureStyle();

    var inst = ++instCount;
    var root = ce("div", "viz-race-interleave", null);
    root.setAttribute("data-viz-root", VIZ_ID);

    var lead = ce("div", "ri-lead", root);
    lead.innerHTML = "שני חוטים מבצעים " + mono("counter++") + " — אבל " + mono("counter++") +
      " <b>אינו אטומי</b>: הוא 3 הוראות מכונה (" + ltr("Read → Modify → Write") + "). " +
      "<b>אתם המתזמן</b>: לחצו “צעד” לכל חוט ובחרו את סדר השזירה, או הפעילו פריסט מוכן.";

    /* ---------- שורת פקדים א׳: K + mutex ---------- */
    var bar1 = ce("div", "ri-bar", root);
    ce("span", "ri-bar-label", bar1, "איטרציות לכל חוט:");
    var segK = ce("div", "ri-seg", bar1);
    segK.setAttribute("role", "group");
    segK.setAttribute("aria-label", "מספר איטרציות לכל חוט");
    var kBtns = [1, 2, 3].map(function (k) {
      var b = ce("button", "viz-btn", segK, String(k));
      b.type = "button";
      b.setAttribute("aria-label", "הרץ " + k + " איטרציות לכל חוט");
      b.addEventListener("click", function () { setK(k); });
      b.dataset.k = String(k);
      return b;
    });

    var btnMutex = ce("button", "viz-btn", bar1, "🔒 עם Mutex");
    btnMutex.type = "button";
    btnMutex.setAttribute("aria-label", "הפעלה או כיבוי של מנגנון ה-Mutex");
    btnMutex.addEventListener("click", function () { setMutex(!state.mutex); });

    ce("span", "ri-spacer", bar1);
    var btnHelp = ce("button", "viz-btn ri-help-btn", bar1, "?");
    btnHelp.type = "button";
    btnHelp.setAttribute("aria-label", "הצג או הסתר את פאנל ההסבר");
    btnHelp.setAttribute("aria-expanded", "false");

    /* ---------- שורת פקדים ב׳: פריסטים ---------- */
    var bar2 = ce("div", "ri-bar", root);
    ce("span", "ri-bar-label", bar2, "תזמון:");
    function preset(label, kind, aria) {
      var b = ce("button", "viz-btn", bar2, label);
      b.type = "button";
      b.setAttribute("aria-label", aria);
      b.addEventListener("click", function () { runPreset(kind); });
      return b;
    }
    var btnSerial = preset("הרצה סדרתית (T1 ואז T2)", "serial",
      "הרץ תזמון סדרתי: כל ההוראות של T1 ואז כל ההוראות של T2");
    var btnInter = preset("הרצה שזורה (מאבד עדכונים)", "interleave",
      "הרץ תזמון שזור לסירוגין — התרחיש שמאבד קידומים");
    var btnRand = preset("אקראי", "random", "הרץ תזמון אקראי");
    var btnReset = ce("button", "viz-btn", bar2, "⟳ אתחול");
    btnReset.type = "button";
    btnReset.setAttribute("aria-label", "אתחל את הסימולציה");
    btnReset.addEventListener("click", function () { cancel(); reset(); });

    /* ---------- הגריד ---------- */
    var grid = ce("div", "ri-grid", root);
    var cards = {};

    function buildThread(id) {
      var card = ce("div", "ri-thread", null);
      card.setAttribute("data-id", id);
      var head = ce("div", "ri-thead", card);
      ce("span", "ri-tname", head, id);
      var pill = ce("span", "ri-pill", head, "Ready");
      var iter = ce("span", "ri-iter", head, "");
      var code = ce("div", "ri-code", card);
      code.setAttribute("dir", "ltr");
      var reg = ce("div", "ri-reg", card, "");
      var chip = ce("div", "ri-chip", card, "");
      chip.hidden = true;
      var btn = ce("button", "viz-btn ri-step-btn", card, "צעד " + id);
      btn.type = "button";
      btn.addEventListener("click", function () { cancel(); manual(id); });
      return { card: card, pill: pill, iter: iter, code: code, reg: reg, chip: chip, btn: btn, lines: [] };
    }

    cards.T1 = buildThread("T1");
    grid.appendChild(cards.T1.card);

    /* ---------- הזיכרון המשותף (אמצע) ---------- */
    var mem = ce("div", "ri-mem", grid);
    ce("div", "ri-mem-t", mem, "זיכרון משותף (RAM)");
    var cellName = ce("div", "ri-cellname", mem, "int counter");
    var cell = ce("div", "ri-cell", mem, String(START));
    cell.setAttribute("aria-live", "polite");
    cell.setAttribute("aria-label", "ערך המשתנה המשותף counter");
    var lockRow = ce("div", "ri-lockrow", mem, "");
    var waitRow = ce("div", "ri-wait", mem, "");

    cards.T2 = buildThread("T2");
    grid.appendChild(cards.T2.card);

    /* ---------- סיכום ---------- */
    var sum = ce("div", "ri-sum", root);
    sum.setAttribute("aria-live", "polite");
    var sumTxt = ce("span", null, sum, "");
    var badge = ce("span", "ri-badge", sum, "");
    badge.hidden = true;

    /* ---------- יומן ---------- */
    var logWrap = ce("div", "ri-logwrap", root);
    ce("div", "ri-logtitle", logWrap, "ציר הזמן — הוראה אחת בכל שורה");
    var logEl = ce("div", "ri-log", logWrap);
    logEl.setAttribute("role", "log");
    logEl.setAttribute("aria-label", "יומן ההוראות שבוצעו");

    /* ---------- פאנל ההסבר ---------- */
    var help = ce("div", "ri-help", root);
    help.hidden = true;
    help.innerHTML =
      "<h4>1. למה " + mono("counter++") + " נכשל? — Read / Modify / Write</h4>" +
      "פעולת ה-" + mono("++") + " <b>אינה אטומית</b>. ברמת הוראות המכונה היא מתורגמת ל-" +
      "<b>שלוש הוראות נפרדות</b>:<ol>" +
      "<li><b>Read</b> — קריאת הערך מהזיכרון (RAM) לתוך <b>אוגר</b> (Register) במעבד.</li>" +
      "<li><b>Modify</b> — הוספת 1 לערך <u>בתוך האוגר</u>.</li>" +
      "<li><b>Write</b> — כתיבת הערך המעודכן מהאוגר חזרה לזיכרון.</li></ol>" +

      "<h4>2. Interleaving — שזירה</h4>" +
      "כששני חוטים רצים במקביל, הקרנל עלול לבצע Context Switch <u>באמצע</u> שלושת השלבים: " +
      "חוט א׳ קורא " + mono("100") + ", ובאותו רגע חוט ב׳ גם קורא " + mono("100") + "; " +
      "שניהם מעלים ל-" + mono("101") + " <b>באוגרים הנפרדים שלהם</b>, ושניהם כותבים " +
      mono("101") + " חזרה לזיכרון. במקום ששני קידומים יביאו אותנו ל-" + mono("102") +
      " — <b>איבדנו קידום אחד</b> בגלל ה״מרוץ״ ביניהם. לכן 2 חוטים × מיליון קידומים " +
      "נותנים תוצאה <b>נמוכה יותר ושונה בכל הרצה</b>." +

      "<h4>3. Critical Section — הקטע הקריטי</h4>" +
      "ה-Mutex (Mutual Exclusion) הוא אובייקט סנכרון שמתנהג כמו <b>מפתח יחיד לחדר</b>. " +
      "אזור הקוד שבו ניגשים למשאב המשותף הוא ה<b>קטע הקריטי</b>, וכדי להיכנס אליו חייבים " +
      "לקחת את המפתח ב-" + mono("pthread_mutex_lock") + ". רק חוט אחד יכול להיות בפנים בכל רגע." +

      "<h4>4. Blocked → Ready — מבט מהקרנל</h4><ol>" +
      "<li><b>ניסיון הנעילה:</b> " + mono("pthread_mutex_lock") + " בודקת אם המנעול פנוי — " +
      "לרוב בעזרת הוראת מעבד אטומית מסוג " + mono("Atomic Compare-and-Swap") + ".</li>" +
      "<li><b>המתנה:</b> אם המנעול תפוס, החוט <u>אינו</u> מבצע לולאה אינסופית (זה היה מבזבז " +
      "זמן CPU). במקומה מתבצעת קריאת מערכת " + mono("futex") + " שמעבירה אותו למצב " +
      "<b>Sleep/Blocked</b>, והקרנל <b>מוציא אותו מתור התזמון</b> ולא נותן לו זמן מעבד.</li>" +
      "<li><b>השחרור:</b> " + mono("pthread_mutex_unlock") + " <b>מעיר</b> אחד החוטים הממתינים " +
      "בתור; הקרנל מחזיר אותו ל-<b>Ready</b>, והוא ימשיך ברגע שהמתזמן יבחר בו.</li></ol>" +
      "שימו לב: " + mono("pthread_mutex_unlock") + " חייבת להתבצע <b>תמיד על ידי אותו חוט " +
      "שביצע את הנעילה</b>, ו-" + mono("pthread_mutex_lock") + " היא פעולה <b>חוסמת</b> (Blocking).";

    btnHelp.addEventListener("click", function () {
      help.hidden = !help.hidden;
      btnHelp.setAttribute("aria-expanded", help.hidden ? "false" : "true");
      btnHelp.classList.toggle("primary", !help.hidden);
    });

    mount.appendChild(root);

    /* =====================================================================
       מנוע
       ===================================================================== */
    var state = makeState(2, false);
    var timer = null;
    var lastFlashStep = -1;

    function cancel() {
      if (timer) { clearTimeout(timer); timer = null; }
      state.running = false;
    }

    function reset() {
      var s = makeState(state.K, state.mutex);
      push(s, null, "sched", "התחלה: " + mono("counter = " + START) + ". כל חוט יבצע " +
        s.K + " × " + mono("counter++") + " — הציפייה היא " + mono(String(START + 2 * s.K)) + ".");
      state = s;
      repaint();
    }

    function setK(k) {
      cancel();
      state.K = k;
      reset();
    }
    function setMutex(on) {
      cancel();
      state.mutex = !!on;
      reset();
    }
    function manual(id) {
      if (!runnable(state, id)) return;
      step(state, id);
      repaint();
    }

    /* ---- פריסטים ---- */
    function chooseActor(kind, i) {
      var intended;
      if (kind === "serial") intended = isDone(state, "T1") ? "T2" : "T1";
      else if (kind === "interleave") intended = (i % 2 === 0) ? "T1" : "T2";
      else {
        var pool = IDS.filter(function (x) { return runnable(state, x); });
        if (!pool.length) return null;
        return pool[Math.floor(Math.random() * pool.length)];
      }
      if (runnable(state, intended)) return intended;
      var other = intended === "T1" ? "T2" : "T1";
      if (runnable(state, other)) {
        if (state.th[intended].blocked) {
          push(state, null, "sched", "המתזמן דילג על " + intended +
            " — הוא <b>Blocked</b> ואינו בתור התזמון; במקומו רץ " + other + ".");
        }
        return other;
      }
      return null;
    }

    function runPreset(kind) {
      cancel();
      reset();
      state.running = true;
      var i = 0;
      repaint();
      (function tick() {
        var actor = chooseActor(kind, i);
        if (!actor) { state.running = false; timer = null; repaint(); return; }
        step(state, actor);
        i++;
        repaint();
        timer = setTimeout(tick, SPEED_MS);
      })();
    }

    /* ---- ציור ---- */
    function repaint() {
      var prog = programOf(state), L = prog.length, total = totalInstr(state);
      var allDone = isDone(state, "T1") && isDone(state, "T2");

      root.setAttribute("data-step", String(state.steps));
      root.setAttribute("data-counter", String(state.counter));
      root.setAttribute("data-mutex", state.mutex ? "1" : "0");
      root.setAttribute("data-running", state.running ? "1" : "0");
      root.setAttribute("data-done", allDone ? "1" : "0");
      root.setAttribute("data-lost", String(state.lost));
      mount.setAttribute("data-step", String(state.steps));
      mount.setAttribute("data-counter", String(state.counter));

      kBtns.forEach(function (b) {
        var on = Number(b.dataset.k) === state.K;
        b.classList.toggle("primary", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      btnMutex.classList.toggle("primary", state.mutex);
      btnMutex.setAttribute("aria-pressed", state.mutex ? "true" : "false");
      btnMutex.textContent = state.mutex ? "🔒 עם Mutex" : "🔓 בלי Mutex";

      IDS.forEach(function (id) {
        var c = cards[id], th = state.th[id], stt = stateOf(state, id);
        var curIdx = isDone(state, id) ? -1 : (th.pc % L);
        var iterNo = Math.min(Math.floor(th.pc / L) + 1, state.K);

        c.card.setAttribute("data-state", stt);
        c.pill.textContent = STATE_HE[stt];
        c.pill.setAttribute("data-state", stt);
        c.iter.textContent = "איטרציה " + iterNo + "/" + state.K;

        /* שורות הקוד — נבנות מחדש רק כשמספר השורות השתנה */
        if (c.lines.length !== L) {
          c.code.innerHTML = "";
          c.lines = prog.map(function (ins) {
            var el = ce("span", "ri-line", c.code, ins.txt.replace(/\{r\}/g, REG[id]));
            return el;
          });
        }
        c.lines.forEach(function (el, i) {
          el.classList.toggle("cur", i === curIdx);
          el.classList.toggle("crit", state.mutex && i > 0 && i < L - 1);
        });

        c.reg.textContent = REG[id] + " = " + (th.reg === null ? "—" : th.reg);

        if (stt === "blocked") {
          c.chip.hidden = false;
          c.chip.className = "ri-chip blk";
          c.chip.textContent = "Blocked — futex: ישן, לא מבזבז CPU";
        } else if (state.mutex && state.owner === id) {
          c.chip.hidden = false;
          c.chip.className = "ri-chip own";
          c.chip.textContent = "🔒 מחזיק במנעול — בקטע הקריטי";
        } else {
          c.chip.hidden = true;
          c.chip.textContent = "";
        }

        var dis = !runnable(state, id);
        c.btn.disabled = dis;
        c.btn.setAttribute("aria-label", "צעד " + id + " — בצע הוראת מכונה אחת" +
          (th.blocked ? " (חסום: Blocked)" : (isDone(state, id) ? " (הסתיים)" : "")));
        c.btn.textContent = th.blocked ? ("צעד " + id + " (חסום)")
          : (isDone(state, id) ? ("צעד " + id + " ✓") : ("צעד " + id));
      });

      /* זיכרון */
      cell.textContent = String(state.counter);
      cell.classList.remove("f-ok", "f-bad");
      if (state.flash && state.steps !== lastFlashStep) {
        lastFlashStep = state.steps;
        void cell.offsetWidth;                       /* reflow → restart animation */
        cell.classList.add(state.flash === "bad" ? "f-bad" : "f-ok");
      }

      if (state.mutex) {
        lockRow.hidden = false;
        lockRow.textContent = state.owner ? ("🔒 המנעול בידי " + state.owner) : "🔓 המנעול פנוי";
        lockRow.setAttribute("data-held", state.owner ? "1" : "0");
        waitRow.hidden = false;
        waitRow.textContent = state.waiters.length
          ? ("תור הממתינים (futex): " + state.waiters.join(", "))
          : "תור הממתינים: ריק";
      } else {
        lockRow.hidden = true;
        waitRow.hidden = true;
      }

      /* סיכום */
      var expected = START + 2 * state.K;
      sumTxt.innerHTML = "צפוי: " + mono(String(expected)) + " · בפועל: " +
        mono(String(state.counter)) + " " +
        '<span style="color:var(--ink-soft);font-weight:600">(2 חוטים × ' +
        state.K + " קידומים)</span>";
      if (!allDone) {
        badge.hidden = true;
      } else {
        badge.hidden = false;
        if (state.mutex) {
          badge.className = "ri-badge good";
          badge.textContent = "🔒 תמיד נכון — הקטע הקריטי הגן על המונה";
        } else if (state.counter < expected) {
          badge.className = "ri-badge bad";
          badge.textContent = "אבד עדכון! (" + (expected - state.counter) + " קידומים אבדו)";
        } else {
          badge.className = "ri-badge good";
          badge.textContent = "הפעם לא אבד כלום — אבל זה מזל, לא הבטחה";
        }
      }

      /* יומן */
      logEl.innerHTML = "";
      state.log.forEach(function (e) {
        var row = ce("div", "ri-ent", logEl);
        row.setAttribute("data-id", e.id || "");
        row.setAttribute("data-kind", e.kind);
        ce("span", "ri-tag", row, e.id || "·");
        var t = ce("span", "ri-txt", row);
        t.innerHTML = e.html;
      });
      logEl.scrollTop = logEl.scrollHeight;
    }

    reset();
  }

  /* =====================================================================
     boot — מרכיב את כל המופעים; לעולם לא זורק.
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
