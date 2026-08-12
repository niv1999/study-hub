/* =====================================================================
   syscall-flow.js — "המסע של system call אחד" (printf → write → kernel)
   Grounded in _notes/kernel-sdlc-part2.md עמוד 25 (השקף "System Calls &
   the glibc Library"): C program invoking printf() library call, which
   calls write(); תרשים user mode מעל / kernel mode מתחת, standard C
   library על הקו המפריד; תפקיד ה-wrapper — arguments לרגיסטרים +
   system call number ייחודי → portability.
   וגם: _notes/apps-kernel.md (הוראות מיוחסות רק במצב גרעין; ניסיון במצב
   משתמש → Interrupt שמפסיק את התהליך), _notes/syscall-open.md /
   syscall-read.md (פקודת syscall = מעבר Ring 3 → Ring 0; sys_write /
   sys_read רצים בקרנל; מיפוי fd → struct file; בדיקת f_mode; בסוף חזרה
   ל-Ring 3 עם ערך ההחזרה).

   Mount: <div class="viz" data-viz="syscall-flow"></div>
   Self-contained IIFE. Hand-authored SVG + DOM, zero deps, works from
   file:// and http. Colors: only the site's CSS custom properties
   (var(--ink), var(--accent), ...) + color-mix() — both themes work.
   RTL Hebrew chrome; the diagram itself is dir="ltr".
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "syscall-flow";
  var SVGNS = "http://www.w3.org/2000/svg";
  var STYLE_ID = "sysflow-style";
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

  /* order of the journey; boxes are code/glibc/kernel, cross+ret are
     the boundary crossing and the return path */
  var ORDER = ["code", "glibc", "cross", "kernel", "ret"];
  var BOX_ORDER_IDX = { code: 0, glibc: 1, kernel: 3 };

  var STEPS = [
    {
      active: null, ring: 3,
      badge: "מבוא", badgeVar: "var(--accent)",
      title: "המסע של קריאת מערכת אחת — למה בכלל צריך לחצות גבול?",
      body: "התוכנית שלכם רצה ב-<b>User Space (Ring 3)</b> — מצב ריצה שבו המעבד מסרב לבצע " +
        "הוראות מיוחסות: אין גישה ישירה לחומרה, למסך או לדיסק. את אלה רשאי לבצע רק הקרנל, " +
        "שרץ ב-<b>Kernel Space (Ring 0)</b>. הדרך היחידה לחצות את הגבול היא <b>פסיקת תוכנה</b> " +
        "(software interrupt). נעקוב אחרי " + ltr('printf("Hello")') + " אחת — בדיוק לפי התרשים " +
        "מהשקפים: הקוד ← הספרייה הסטנדרטית ← הקרנל ← ובחזרה."
    },
    {
      active: "code", ring: 3,
      badge: "User Space · Ring 3", badgeVar: "var(--accent)",
      title: "שלב 1 — הקוד קורא ל-" + ltr('printf("Hello")'),
      body: ltr("printf()") + " היא <b>library call</b> — פונקציה רגילה מספריית glibc, לא קריאת " +
        "מערכת. אנחנו עדיין לגמרי ב-user mode ושום דבר מיוחס לא קרה. אבל כדי להדפיס למסך " +
        ltr("printf") + " זקוקה לשירות שרק הקרנל יכול לספק — ולכן היא קוראת בעצמה לקריאת " +
        "המערכת " + ltr("write()") + " (כלשון השקף: C program invoking printf() library call, " +
        "which calls write())."
    },
    {
      active: "glibc", ring: 3,
      badge: "User Space · Ring 3", badgeVar: "var(--accent)",
      title: "שלב 2 — ה-wrapper של glibc מכין רגיסטרים ומספר קריאה",
      body: "לכל קריאת מערכת יש wrapper בספרייה הסטנדרטית, ותפקידו (מהשקפים): <b>(1)</b> להניח " +
        "את כל ה-arguments של קריאת המערכת ב<b>רגיסטרים</b> המתאימים של המעבד (ולעיתים גם על " +
        "ה-call stack); <b>(2)</b> לקבוע <b>system call number</b> ייחודי — המספר של write — " +
        "שלפיו הקרנל יידע איזו קריאה התבקשה. הספרייה, שיושבת בין ה-OS לאפליקציה, מגדילה כך " +
        "את ה-<b>portability</b> של הקוד."
    },
    {
      active: "cross", ring: 0,
      badge: 'מעבר <span dir="ltr">Ring 3 → Ring 0</span>', badgeVar: "var(--err)",
      title: "שלב 3 — פסיקת תוכנה: הרגע שחוצים את הגבול",
      body: "פקודת האסמבלי " + ltr("syscall") + " יוצרת <b>פסיקת תוכנה</b>, והמעבד עובר מ-" +
        ltr("Ring 3") + " ל-" + ltr("Ring 0") + ". זו הדרך היחידה החוקית פנימה: תהליך משתמש " +
        "שמנסה לבצע הוראה מיוחסת בעצמו — המעבד מזהה זאת בשלב פענוח ההוראה " +
        "(Instruction Decode), מסרב לבצע, ויוצר Interrupt שמוביל להפסקה מיידית של התהליך. " +
        "דרך ה-syscall, לעומת זאת, הכניסה נעשית בנקודת כניסה מסודרת של הקרנל."
    },
    {
      active: "kernel", ring: 0,
      badge: "Kernel Space · Ring 0", badgeVar: "var(--ink)",
      title: "שלב 4 — " + ltr("sys_write") + " רץ ב-kernel mode",
      body: "הבקשה מגיעה לפונקציית הליבה " + ltr("sys_write") + ". עכשיו המעבד במצב גרעין ורשאי " +
        "לבצע גם הוראות מיוחסות: הקרנל ממפה את ה-FD לאובייקט ה-" + ltr("struct file") + ", מוודא " +
        "ב-" + ltr("f_mode") + " שהקובץ נפתח במצב שמתיר כתיבה, ומבצע את הכתיבה בפועל — אותו " +
        "דפוס בדיוק כמו האלגוריתם של " + ltr("read()") + " מההנדאוט (כניסה לקרנל ← איתור " +
        "struct file ← בדיקת הרשאות ← ביצוע)."
    },
    {
      active: "ret", ring: 3,
      badge: "חזרה ל-Ring 3", badgeVar: "var(--ok)",
      title: "שלב 5 — הערך חוזר ל-user space וההמשך",
      body: "הקרנל מעביר את המעבד בחזרה מ-" + ltr("Ring 0") + " ל-" + ltr("Ring 3") + ", וערך " +
        "ההחזרה — מספר הבייטים שנכתבו — מטפס בחזרה: מהקרנל אל ה-wrapper של glibc, וממנו אל " +
        "הקוד שלכם. התוכנית ממשיכה לרוץ מהשורה שאחרי ה-" + ltr("printf") + ", בלי לדעת שהמעבד " +
        "הספיק לבקר ב-Ring 0 ולחזור. (בדיוק כמו החץ המעוגל שחוזר מהענן של " + ltr("write()") +
        " בתרשים שבשקפים.)"
    }
  ];

  /* =====================================================================
     SCENE — vertical two-zone diagram (LTR)
     ===================================================================== */
  function buildScene(inst) {
    var W = 560, H = 400, BX = 150, BW = 280, CX = BX + BW / 2; /* 290 */
    var mid = function (p) { return "sfmk-" + inst + "-" + p; };

    var svg = se("svg", {
      viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", direction: "ltr",
      "aria-label": "תרשים המסע של קריאת מערכת: User Space מעל, Kernel Space מתחת, גבול שנחצה רק דרך פסיקת תוכנה"
    });
    svg.style.cssText = "display:block;max-width:" + W + "px;margin:0 auto";

    /* arrowhead markers (one set per color) */
    var defs = se("defs", {}, svg);
    [["soft", "var(--ink-soft)"], ["accent", "var(--accent)"],
     ["err", "var(--err)"], ["ok", "var(--ok)"]].forEach(function (m) {
      var mk = se("marker", {
        id: mid(m[0]), viewBox: "0 0 10 10", refX: "8.5", refY: "5",
        markerWidth: "6.5", markerHeight: "6.5", orient: "auto-start-reverse"
      }, defs);
      se("path", { d: "M0 0 L10 5 L0 10 z", fill: m[1] }, mk);
    });

    /* zones */
    se("rect", {
      x: 0, y: 0, width: W, height: 252,
      fill: "color-mix(in srgb, var(--accent) 6%, var(--surface))"
    }, svg);
    se("rect", {
      x: 0, y: 252, width: W, height: H - 252,
      fill: "color-mix(in srgb, var(--ink) 8%, var(--surface))"
    }, svg);
    var zu = se("text", {
      x: W - 14, y: 26, "text-anchor": "end",
      "font-size": 12, "font-weight": 800, fill: "var(--ink-soft)"
    }, svg);
    zu.textContent = "User Space · Ring 3";
    var zk = se("text", {
      x: W - 14, y: H - 12, "text-anchor": "end",
      "font-size": 12, "font-weight": 800, fill: "var(--ink-soft)"
    }, svg);
    zk.textContent = "Kernel Space · Ring 0";

    /* the boundary — a thick labeled band */
    var bandRect = se("rect", { x: 0, y: 245, width: W, height: 16, fill: "var(--ink)" }, svg);
    var bandText = se("text", {
      x: W - 14, y: 257.5, "text-anchor": "start", direction: "rtl",
      "font-size": 11, "font-weight": 700, fill: "var(--surface)"
    }, svg);
    bandText.textContent = "הגבול — חציה רק דרך פסיקת תוכנה";

    /* box builder */
    function box(x, y, w, h, lines) {
      var g = se("g", {}, svg);
      var rect = se("rect", {
        x: x, y: y, width: w, height: h, rx: 10,
        fill: "var(--surface)", stroke: "var(--line)", "stroke-width": 2
      }, g);
      var texts = [];
      lines.forEach(function (ln, i) {
        var t = se("text", {
          x: x + w / 2, y: y + (lines.length === 1 ? h / 2 + 4 : 25 + i * 22),
          "text-anchor": "middle",
          "font-size": ln.size || (i === 0 ? 13 : 11.5),
          "font-weight": ln.bold ? 800 : 600,
          fill: ln.fill || (i === 0 ? "var(--ink)" : "var(--ink-soft)")
        }, g);
        if (ln.mono) t.setAttribute("font-family", "ui-monospace, Consolas, monospace");
        if (ln.rtl) t.setAttribute("direction", "rtl");
        t.textContent = ln.t;
        texts.push(t);
      });
      return { g: g, rect: rect, texts: texts };
    }

    var boxes = {
      code: box(BX, 44, BW, 62, [
        { t: "הקוד שלך (User Program)", rtl: true, bold: true },
        { t: 'printf("Hello");', mono: true, size: 12.5 }
      ]),
      glibc: box(BX, 142, BW, 62, [
        { t: "glibc — standard C library", bold: true },
        { t: "מכינה רגיסטרים + מספר קריאת המערכת write", rtl: true, size: 11 }
      ]),
      kernel: box(BX, 296, BW, 62, [
        { t: "sys_write()", mono: true, bold: true },
        { t: "רץ ב-kernel mode — הכתיבה מתבצעת כאן", rtl: true, size: 11 }
      ])
    };

    /* downward arrows */
    function arrow(y1, y2) {
      return se("line", {
        x1: CX, y1: y1, x2: CX, y2: y2,
        stroke: "var(--ink-soft)", "stroke-width": 2, "stroke-linecap": "round",
        "marker-end": "url(#" + mid("soft") + ")"
      }, svg);
    }
    var a1 = arrow(106, 136);   /* code  -> glibc  */
    var a2 = arrow(204, 241);   /* glibc -> boundary */
    var a3 = arrow(265, 292);   /* boundary -> kernel */

    /* syscall chip next to the crossing arrows */
    var chipRect = se("rect", {
      x: 302, y: 218, width: 78, height: 20, rx: 10,
      fill: "var(--surface)", stroke: "var(--line)", "stroke-width": 1.5
    }, svg);
    var chipText = se("text", {
      x: 341, y: 232, "text-anchor": "middle", "font-size": 10.5, "font-weight": 700,
      "font-family": "ui-monospace, Consolas, monospace", fill: "var(--ink-soft)"
    }, svg);
    chipText.textContent = "syscall";

    /* return path (kernel -> back to the code), on the left */
    var retPath = se("path", {
      d: "M150,327 L70,327 L70,75 L146,75",
      fill: "none", stroke: "var(--ink-soft)", "stroke-width": 2,
      "stroke-dasharray": "6 4", "stroke-linecap": "round",
      "marker-end": "url(#" + mid("soft") + ")"
    }, svg);
    var retLabel = se("text", {
      x: 86, y: 64, "text-anchor": "start", direction: "rtl",
      "font-size": 10.5, "font-weight": 700, fill: "var(--ink-soft)"
    }, svg);
    retLabel.textContent = "הערך המוחזר";

    /* CPU ring chip (top-left) */
    var ringRect = se("rect", {
      x: 14, y: 12, width: 148, height: 26, rx: 13,
      fill: "var(--surface-2)", stroke: "var(--line)", "stroke-width": 1.5
    }, svg);
    var ringText = se("text", {
      x: 88, y: 29.5, "text-anchor": "middle", "font-size": 11, "font-weight": 800,
      fill: "var(--ink)"
    }, svg);
    ringText.textContent = "CPU: Ring 3 · User";

    return {
      svg: svg, boxes: boxes, a1: a1, a2: a2, a3: a3,
      chipRect: chipRect, chipText: chipText,
      bandRect: bandRect, bandText: bandText,
      retPath: retPath, retLabel: retLabel,
      ringRect: ringRect, ringText: ringText, mid: mid
    };
  }

  /* pure repaint of the scene for one step */
  function applyScene(sc, step) {
    var activeIdx = step.active ? ORDER.indexOf(step.active) : -1;

    /* boxes: active / visited / idle */
    Object.keys(sc.boxes).forEach(function (key) {
      var b = sc.boxes[key], oi = BOX_ORDER_IDX[key];
      if (step.active === key) {
        b.rect.setAttribute("fill", "color-mix(in srgb, var(--accent) 18%, var(--surface))");
        b.rect.setAttribute("stroke", "var(--accent)");
        b.rect.setAttribute("stroke-width", 3);
        b.g.setAttribute("opacity", 1);
      } else if (activeIdx > -1 && oi < activeIdx) {
        b.rect.setAttribute("fill", "color-mix(in srgb, var(--ink-soft) 10%, var(--surface))");
        b.rect.setAttribute("stroke", "var(--ink-soft)");
        b.rect.setAttribute("stroke-width", 2);
        b.g.setAttribute("opacity", 1);
      } else {
        b.rect.setAttribute("fill", "var(--surface)");
        b.rect.setAttribute("stroke", "var(--line)");
        b.rect.setAttribute("stroke-width", 2);
        b.g.setAttribute("opacity", activeIdx === -1 ? 1 : 0.75);
      }
    });

    /* arrows */
    function paint(line, on, colorName) {
      line.setAttribute("stroke", on ? "var(--" + colorName + ")" : "var(--ink-soft)");
      line.setAttribute("stroke-width", on ? 3.5 : 2);
      line.setAttribute("marker-end", "url(#" + sc.mid(on ? colorName : "soft") + ")");
    }
    paint(sc.a1, step.active === "glibc", "accent");
    paint(sc.a2, step.active === "cross", "err");
    paint(sc.a3, step.active === "cross", "err");

    /* boundary band + syscall chip */
    var crossing = step.active === "cross";
    sc.bandRect.setAttribute("fill", crossing ? "var(--err)" : "var(--ink)");
    sc.bandRect.setAttribute("height", crossing ? 18 : 16);
    sc.chipRect.setAttribute("fill", crossing
      ? "color-mix(in srgb, var(--err) 18%, var(--surface))" : "var(--surface)");
    sc.chipRect.setAttribute("stroke", crossing ? "var(--err)" : "var(--line)");
    sc.chipText.setAttribute("fill", crossing ? "var(--err)" : "var(--ink-soft)");

    /* return path */
    var returning = step.active === "ret";
    sc.retPath.setAttribute("stroke", returning ? "var(--ok)" : "var(--ink-soft)");
    sc.retPath.setAttribute("stroke-width", returning ? 3.2 : 2);
    sc.retPath.setAttribute("marker-end", "url(#" + sc.mid(returning ? "ok" : "soft") + ")");
    sc.retLabel.setAttribute("fill", returning ? "var(--ok)" : "var(--ink-soft)");
    sc.retLabel.setAttribute("font-size", returning ? 11.5 : 10.5);

    /* CPU ring chip */
    if (step.ring === 0) {
      sc.ringRect.setAttribute("fill", "var(--ink)");
      sc.ringRect.setAttribute("stroke", "var(--ink)");
      sc.ringText.setAttribute("fill", "var(--surface)");
      sc.ringText.textContent = "CPU: Ring 0 · Kernel";
    } else {
      sc.ringRect.setAttribute("fill", "var(--surface-2)");
      sc.ringRect.setAttribute("stroke", "var(--line)");
      sc.ringText.setAttribute("fill", "var(--ink)");
      sc.ringText.textContent = "CPU: Ring 3 · User";
    }
  }

  /* =====================================================================
     STYLE (scoped, injected once)
     ===================================================================== */
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      ".viz-syscall-flow{direction:rtl}" +
      ".viz-syscall-flow .sf-scene{background:var(--surface);border:1px solid var(--line);" +
      "border-radius:12px;padding:10px 6px;overflow:hidden}" +
      ".viz-syscall-flow .sf-panel{background:var(--surface-2);border:1px solid var(--line);" +
      "border-radius:12px;padding:12px 14px;margin-top:12px;min-height:104px;line-height:1.7;" +
      "font-size:.9rem;color:var(--ink)}" +
      ".viz-syscall-flow .sf-badge{display:inline-block;color:var(--surface);font-weight:700;" +
      "font-size:.72rem;padding:2px 10px;border-radius:99px;margin-inline-end:8px}" +
      ".viz-syscall-flow .viz-controls{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:12px}" +
      ".viz-syscall-flow .sf-counter{margin-inline-start:auto;font-weight:700;" +
      "color:var(--ink-soft);font-size:.85rem;align-self:center}";
    document.head.appendChild(s);
  }

  /* =====================================================================
     Render one mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-sysflow-ready") === "1") return;
    mount.setAttribute("data-sysflow-ready", "1");
    mount.innerHTML = "";
    ensureStyle();

    var inst = ++instCount;
    var root = ce("div", "viz-syscall-flow", null);
    root.setAttribute("tabindex", "0");
    root.style.outline = "none";

    var sceneBox = ce("div", "sf-scene", root);
    var scene = buildScene(inst);
    sceneBox.appendChild(scene.svg);

    var panel = ce("div", "sf-panel", root);
    panel.setAttribute("aria-live", "polite");

    var controls = ce("div", "viz-controls", root);
    function mkBtn(label, fn) {
      var b = ce("button", "viz-btn", null, label);
      b.type = "button";
      b.addEventListener("click", fn);
      return b;
    }
    var btnPrev = mkBtn("→ הקודם", function () { go(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { go(idx + 1); });
    btnNext.classList.add("primary");
    var btnReset = mkBtn("⟳ מהתחלה", function () { go(0); });
    controls.appendChild(btnPrev); controls.appendChild(btnNext); controls.appendChild(btnReset);
    var counter = ce("span", "sf-counter", controls);

    mount.appendChild(root);

    var idx = 0;

    function go(n) {
      idx = Math.max(0, Math.min(STEPS.length - 1, n));
      var step = STEPS[idx];
      applyScene(scene, step);
      panel.innerHTML = '<span class="sf-badge" style="background:' + step.badgeVar + '">' +
        step.badge + "</span><b>" + step.title +
        '</b><div style="margin-top:6px">' + step.body + "</div>";
      counter.textContent = "שלב " + (idx + 1) + " / " + STEPS.length;
      btnPrev.disabled = idx === 0;
      btnNext.disabled = idx === STEPS.length - 1;
    }

    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { go(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { go(idx + 1); e.preventDefault(); }
      else if (e.key === "Home") { go(0); e.preventDefault(); }
      else if (e.key === "End") { go(STEPS.length - 1); e.preventDefault(); }
    });

    go(0);
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
