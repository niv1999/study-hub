/* =====================================================================
   roots-of-unity.js  —  Module 12 "מכפלת פולינומים ו-FFT"  (unit-6, teal)
   Grounded in _notes/11-fft-he.md + 11-fft-en.md — the lecture's treatment
   of unit roots ("שורשי יחידה") and the halving/squaring properties that
   make Recursive-FFT work.

   EXACT lecture material animated here:
     • שורשי היחידה מסדר n — פתרונות המשוואה Xⁿ = 1, פרוסים אחיד על מעגל
       היחידה (11-fft-en §"בסיס במספרים מרוכבים", עמ' 11–16; דוגמת n=8 עמ' 16).
     • השורש הפרימיטיבי ωₙ = e^{2πi/n} = cos(2π/n)+i·sin(2π/n)
       (Recursive-FFT שורה 4; דוגמאות מהשקף: n=2 → −1, n=4 → i).
     • Property 4 (עמ' 28–29):  ωₙ^{n/2} = −1.
     • Conclusion (עמ' 30):  החצי השני של השורשים = הנגדיים של החצי הראשון:
       ω^{n/2+j} = −ω^j.
     • Property 3 / Halving Lemma (עמ' 26–27):  אם ω פרימיטיבי מסדר n (זוגי)
       אז ω² פרימיטיבי מסדר n/2 — ריבוע השורשים ממפה n שורשים ל-n/2 (2-ל-1),
       וזו הסיבה ש-Recursive-FFT מעריך את P_even,P_odd ב-(ωₙ²)^k ומגיע ל-
       T(n)=2T(n/2)+Θ(n)=Θ(n log n) (11-fft-en שורות 8–9,136).

   ברירת המחדל n=8 = הדוגמה המפורשת מהשקף (עמ' 16). ניתן לבחור n∈{2,4,8,16}.

   Self-contained IIFE. Hand-authored SVG/DOM. No external deps, no globals.
   Cream design tokens hardcoded (CONTRACT §2); unit-6 accent = teal #69A297.
   RTL Hebrew UI; English/LTR math identifiers isolated. Works file:// too.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "roots-of-unity";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design palette (hardcoded per CONTRACT §2; unit-6 = teal) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    teal: "#69A297",     /* unit-6 accent — the roots themselves */
    tealDk: "#4C7A70",   /* teal stroke / emphasis */
    mustard: "#C9A24B",  /* squares / the n/2 image roots */
    clay: "#BE7C5E",     /* ω^{n/2} = −1 and antipodes */
    blue: "#6E8CA0"      /* the primitive root ωₙ */
  };

  var N_OPTIONS = [2, 4, 8, 16];
  var DEFAULT_N = 8;

  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ---- tiny DOM/SVG helpers ---- */
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

  /* ---- number / complex formatting ---- */
  var MINUS = "−"; /* unicode minus for display */
  function fmt3(v) {
    var r = Math.round(v * 1000) / 1000;
    if (Object.is(r, -0)) r = 0;
    var s = String(parseFloat(r.toFixed(3)));
    return s.replace("-", MINUS);
  }
  /* pretty "a + b·i" complex string (unicode minus, drops trivial parts) */
  function complexStr(re, im) {
    var a = fmt3(re), b = fmt3(im);
    if (b === "0") return a;
    var bAbs = fmt3(Math.abs(im));
    var bTerm = (bAbs === "1") ? "i" : bAbs + "i";
    if (a === "0") return (im < 0 ? MINUS : "") + bTerm;
    return a + " " + (im < 0 ? MINUS : "+") + " " + bTerm;
  }
  /* unicode-subscript for the order n (2,4,8,16) */
  var SUBS = { "0": "₀", "1": "₁", "2": "₂", "4": "₄",
               "6": "₆", "8": "₈" };
  function subN(n) {
    return String(n).split("").map(function (d) { return SUBS[d] || d; }).join("");
  }
  /* angle 2πk/n as a reduced fraction of π (string) */
  function fracPi(k, n) {
    if (k === 0) return "0";
    var p = 2 * k, q = n;
    var g = gcd(p, q); p /= g; q /= g;
    var num = (p === 1) ? "" : String(p);
    return (q === 1) ? num + "π" : num + "π/" + q;
  }
  function gcd(a, b) { while (b) { var t = b; b = a % b; a = t; } return a; }

  /* the n-th roots of unity: ωⁿ_k = e^{2πik/n} */
  function roots(n) {
    var out = [];
    for (var k = 0; k < n; k++) {
      var th = 2 * Math.PI * k / n;
      out.push({ k: k, th: th, re: Math.cos(th), im: Math.sin(th) });
    }
    return out;
  }

  /* =====================================================================
     STEP SCRIPT — each step is n-adaptive: a title, an accent colour, a
     Hebrew explanation (why it happened), and visual flags the scene reads.
     ===================================================================== */
  function primLabel(n) {
    if (n === 2) return "−1";            /* −1 */
    if (n === 4) return "i";
    return "e^{2πi/" + n + "}";
  }
  function w(n) { return "ω" + subN(n); } /* ωₙ */

  var STEPS = [
    {
      badge: "Xⁿ = 1", color: C.teal,
      title: "שורשי היחידה מסדר n",
      vis: { labels: true },
      body: function (n) {
        return "שורשי היחידה מסדר n הם n הפתרונות המרוכבים של המשוואה " +
          "<span dir=\"ltr\">X<sup>" + n + "</sup> = 1</span>. " +
          "לכל פולינום ממעלה n יש בדיוק n שורשים מרוכבים, ולכן יש בדיוק <b>" + n + "</b> שורשי יחידה. " +
          "הם יושבים על <b>מעגל היחידה</b> (רדיוס 1 סביב הראשית) ומחלקים אותו ל-" + n +
          " חלקים שווים — הזווית בין שכנים היא <span dir=\"ltr\">2π/" + n + "</span>.";
      }
    },
    {
      badge: "ωₙ = e^{2πi/n}", color: C.blue,
      title: "השורש הפרימיטיבי ωₙ",
      vis: { labels: true, primitive: true },
      body: function (n) {
        return "השורש ה<b>פרימיטיבי</b> הוא " +
          "<span dir=\"ltr\">" + w(n) + " = e<sup>2πi/" + n + "</sup> = " +
          "cos(2π/" + n + ") + i·sin(2π/" + n + ") = " + primLabel(n) + "</span>. " +
          "הוא פרימיטיבי כי החזקות שלו <span dir=\"ltr\">" + w(n) + "<sup>0</sup>, " +
          w(n) + "<sup>1</sup>, …, " + w(n) + "<sup>" + (n - 1) + "</sup></span> הן " + n +
          " מספרים <b>שונים זה מזה</b> — כלומר החזקות שלו לבדן כבר מייצרות את כל השורשים. " +
          "בשקף (שורה 4 ב-Recursive-FFT) זה בדיוק החישוב " +
          "<span dir=\"ltr\">" + w(n) + " ← e<sup>2πi/" + n + "</sup></span>.";
      }
    },
    {
      badge: "ωₙᵏ", color: C.teal,
      title: "החזקות מייצרות את כל השורשים",
      vis: { labels: true, powers: true },
      body: function (n) {
        return "מתחילים מ-<span dir=\"ltr\">" + w(n) + "<sup>0</sup> = 1</span> (הנקודה הימנית), " +
          "ובכל צעד כופלים ב-<span dir=\"ltr\">" + w(n) + "</span> — כלומר <b>מסתובבים</b> " +
          "<span dir=\"ltr\">2π/" + n + "</span> נגד כיוון השעון. " +
          "כך מקבלים בזה אחר זה את <span dir=\"ltr\">" + w(n) + "<sup>0</sup>, " + w(n) + "<sup>1</sup>, …, " +
          w(n) + "<sup>" + (n - 1) + "</sup></span>, וב-<span dir=\"ltr\">" + w(n) + "<sup>" + n +
          "</sup></span> חוזרים ל-1 (כי <span dir=\"ltr\">" + w(n) + "<sup>" + n + "</sup> = 1</span>). " +
          "זו בדיוק פעולת <span dir=\"ltr\">ω ← ω·" + w(n) + "</span> בלולאת ה-butterfly.";
      }
    },
    {
      badge: "Property 4", color: C.clay,
      title: "ωₙ^{n/2} = −1",
      vis: { labels: true, neg1: true },
      body: function (n) {
        return "בדיוק חצי סיבוב (<span dir=\"ltr\">" + n / 2 + "</span> צעדים) מגיע לנקודה " +
          "<span dir=\"ltr\">" + w(n) + "<sup>" + (n / 2) + "</sup></span> שבזווית <span dir=\"ltr\">π</span> — " +
          "והיא בדיוק <b dir=\"ltr\">" + MINUS + "1</b>. " +
          "<b>הוכחה (עמ' 28–29):</b> <span dir=\"ltr\">(" + w(n) + "<sup>" + (n / 2) +
          "</sup>)<sup>2</sup> = " + w(n) + "<sup>" + n + "</sup> = 1</span>, לכן " +
          "<span dir=\"ltr\">" + w(n) + "<sup>" + (n / 2) + "</sup></span> הוא שורש יחידה מסדר 2, כלומר " +
          "<span dir=\"ltr\">±1</span>. אבל " + w(n) + " פרימיטיבי ולכן " +
          "<span dir=\"ltr\">" + w(n) + "<sup>" + (n / 2) + "</sup> ≠ 1</span> — ולכן הוא " +
          "<span dir=\"ltr\">" + MINUS + "1</span>. תכונה זו היא הלב של פעולת ה-butterfly " +
          "(<span dir=\"ltr\">+ω</span> מול <span dir=\"ltr\">" + MINUS + "ω</span>).";
      }
    },
    {
      badge: "מסקנה עמ' 30", color: C.clay,
      title: "החצי השני = הנגדיים של הראשון",
      vis: { labels: true, pairs: true },
      body: function (n) {
        return "מכיוון ש-<span dir=\"ltr\">" + w(n) + "<sup>" + (n / 2) + "</sup> = " + MINUS + "1</span>, " +
          "כל שורש בחצי השני הוא הנגדי (הקוטר הנגדי) של שורש בחצי הראשון: " +
          "<span dir=\"ltr\">" + w(n) + "<sup>" + (n / 2) + "+j</sup> = " + w(n) + "<sup>" + (n / 2) + "</sup>·" +
          w(n) + "<sup>j</sup> = " + MINUS + w(n) + "<sup>j</sup></span>. " +
          "הקווים מחברים כל זוג נגדי — <span dir=\"ltr\">j</span> מול <span dir=\"ltr\">j+" + (n / 2) + "</span>. " +
          "בזכות זה ה-butterfly מחשב <b>שני</b> ערכים (<span dir=\"ltr\">y<sub>k</sub></span> ו-" +
          "<span dir=\"ltr\">y<sub>k+n/2</sub></span>) מאותה מכפלה <span dir=\"ltr\">ω·y<sup>[1]</sup></span>.";
      }
    },
    {
      badge: "Property 3 · Halving", color: C.mustard,
      title: "ריבוע: n שורשים ← n/2 שורשים",
      vis: { labels: true, square: true },
      body: function (n) {
        return "<b>למת החצייה (עמ' 26–27):</b> אם <span dir=\"ltr\">" + w(n) +
          "</span> פרימיטיבי מסדר n אז <span dir=\"ltr\">" + w(n) + "<sup>2</sup></span> פרימיטיבי מסדר " +
          "<span dir=\"ltr\">" + (n / 2) + "</span>. החצים מראים כל שורש בריבועו: " +
          "<span dir=\"ltr\">(" + w(n) + "<sup>k</sup>)<sup>2</sup> = " + w(n) + "<sup>2k</sup></span>. " +
          "שימו לב: <span dir=\"ltr\">k</span> ו-<span dir=\"ltr\">k+" + (n / 2) + "</span> " +
          "<b>נופלים לאותה נקודה</b> (כי <span dir=\"ltr\">2(k+" + (n / 2) + ") ≡ 2k</span>) — מיפוי <b>2-ל-1</b>. " +
          "לכן <span dir=\"ltr\">" + n + "</span> השורשים מתקפלים ל-<b>" + (n / 2) + "</b> שורשים בלבד " +
          "(המסומנים ב-<span style=\"color:" + C.mustard + ";font-weight:700\">חרדל</span>).";
      }
    },
    {
      badge: "→ FFT", color: C.tealDk,
      title: "למה זה נותן O(n log n)",
      vis: { labels: true, square: true, fft: true },
      body: function (n) {
        return "זו בדיוק הסיבה שה-<span dir=\"ltr\">Recursive-FFT</span> עובד: כדי להעריך פולינום ב-" + n +
          " שורשי היחידה, מפצלים למקדמים זוגיים <span dir=\"ltr\">a<sup>[0]</sup></span> ואי-זוגיים " +
          "<span dir=\"ltr\">a<sup>[1]</sup></span>, ומעריכים כל חצי רק ב-<b>" + (n / 2) + "</b> הנקודות " +
          "<span dir=\"ltr\">(" + w(n) + "<sup>2</sup>)<sup>k</sup></span> — שהן שורשי היחידה מסדר " + (n / 2) + " (השלב הקודם). " +
          "הריבוע חסך לנו חצי מהנקודות בכל רמה, ומכאן הנסיגה " +
          "<span dir=\"ltr\">T(n) = 2T(n/2) + Θ(n) = Θ(n log n)</span>. " +
          "בעומק הרקורסיה מגיעים ל-<span dir=\"ltr\">n = 1</span> (return a) — מקרה הבסיס.";
      }
    }
  ];

  /* =====================================================================
     render one mount
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-rou-ready") === "1") return;
    mount.setAttribute("data-rou-ready", "1");
    mount.innerHTML = "";

    var state = { n: DEFAULT_N, step: 0, selected: null };
    var autoTimer = null;

    /* ---------- geometry ---------- */
    var W = 460, H = 470;
    var cx = 230, cy = 220, R = 150;
    function px(re) { return cx + R * re; }
    function py(im) { return cy - R * im; } /* SVG y grows downward */

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");
    wrap.style.outline = "none";

    /* ===== n selector ===== */
    var nRow = document.createElement("div");
    nRow.className = "viz-controls";
    nRow.style.marginTop = "0";
    nRow.style.marginBottom = ".7rem";
    var nLbl = document.createElement("span");
    nLbl.innerHTML = "מספר השורשים <span dir=\"ltr\">n</span>:";
    nLbl.style.fontWeight = "700";
    nLbl.style.color = C.ink;
    nLbl.style.fontSize = ".9rem";
    nRow.appendChild(nLbl);
    var nBtns = {};
    N_OPTIONS.forEach(function (n) {
      var b = mkBtn(String(n), function () { setN(n); });
      if (n === DEFAULT_N) b.title = "הדוגמה מההרצאה (עמ' 16)";
      nBtns[n] = b;
      nRow.appendChild(b);
    });
    wrap.appendChild(nRow);

    /* ===== SVG scene ===== */
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H, width: "100%",
      role: "img", direction: "ltr",
      "aria-label": "מעגל היחידה עם שורשי היחידה מסדר n"
    });
    svg.style.display = "block";
    svg.style.maxWidth = W + "px";
    svg.style.margin = "0 auto";

    var defs = el("defs");
    svg.appendChild(defs);
    mkMarker(defs, "rou-arr-mustard", C.mustard);
    mkMarker(defs, "rou-arr-teal", C.tealDk);

    /* static backdrop: axes + unit circle */
    svg.appendChild(el("line", { x1: cx - R - 34, y1: cy, x2: cx + R + 34, y2: cy,
      stroke: C.line, "stroke-width": 1.4 }));
    svg.appendChild(el("line", { x1: cx, y1: cy - R - 34, x2: cx, y2: cy + R + 34,
      stroke: C.line, "stroke-width": 1.4 }));
    svg.appendChild(txt(cx + R + 30, cy - 8, "Re", { "font-size": 11, fill: C.inkSoft, "font-style": "italic" }));
    svg.appendChild(txt(cx + 8, cy - R - 24, "Im", { "font-size": 11, fill: C.inkSoft, "font-style": "italic" }));
    svg.appendChild(el("circle", { cx: cx, cy: cy, r: R, fill: "none",
      stroke: C.line, "stroke-width": 2 }));
    /* axis unit ticks 1, i, -1, -i */
    [["1", cx + R, cy, 14, -8], ["i", cx, cy - R, 12, -10],
     [MINUS + "1", cx - R, cy, -16, -8], [MINUS + "i", cx, cy + R, 12, 20]]
      .forEach(function (t) {
        svg.appendChild(el("circle", { cx: t[1], cy: t[2], r: 2.4, fill: C.inkSoft }));
        svg.appendChild(txt(t[1] + t[3], t[2] + t[4], t[0],
          { "font-size": 11, fill: C.inkSoft, "text-anchor": "middle" }));
      });
    svg.appendChild(el("circle", { cx: cx, cy: cy, r: 3, fill: C.inkSoft }));

    /* dynamic layer (roots + overlays), rebuilt on every draw */
    var layer = el("g");
    svg.appendChild(layer);

    var sceneBox = document.createElement("div");
    sceneBox.style.background = C.surface;
    sceneBox.style.borderRadius = "12px";
    sceneBox.style.padding = "4px";
    sceneBox.appendChild(svg);
    wrap.appendChild(sceneBox);

    /* ===== selected-root readout ===== */
    var readout = document.createElement("div");
    readout.setAttribute("aria-live", "polite");
    readout.style.background = C.surface2;
    readout.style.border = "1px dashed " + C.teal;
    readout.style.borderRadius = "10px";
    readout.style.padding = "9px 12px";
    readout.style.marginTop = "10px";
    readout.style.color = C.ink;
    readout.style.fontSize = ".86rem";
    readout.style.lineHeight = "1.6";
    readout.style.minHeight = "1.2rem";
    wrap.appendChild(readout);

    /* ===== step rail (numbered chips) ===== */
    var rail = document.createElement("div");
    rail.setAttribute("role", "tablist");
    rail.setAttribute("aria-label", "שלבי שורשי היחידה");
    rail.style.display = "flex";
    rail.style.flexWrap = "wrap";
    rail.style.gap = "6px";
    rail.style.margin = "14px 0 4px";
    var chips = STEPS.map(function (s, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn";
      b.setAttribute("role", "tab");
      b.textContent = String(i + 1);
      b.title = s.title;
      b.setAttribute("aria-label", s.title);
      b.style.padding = ".2rem .62rem";
      b.style.fontSize = ".82rem";
      b.style.minWidth = "2rem";
      b.addEventListener("click", function () { stopAuto(); goStep(i); });
      rail.appendChild(b);
      return b;
    });
    wrap.appendChild(rail);

    /* ===== explanation panel ===== */
    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.background = C.surface2;
    panel.style.border = "1px solid " + C.line;
    panel.style.borderRadius = "12px";
    panel.style.padding = "12px 14px";
    panel.style.marginTop = "8px";
    panel.style.minHeight = "96px";
    panel.style.color = C.ink;
    panel.style.lineHeight = "1.68";
    panel.style.fontSize = ".9rem";
    wrap.appendChild(panel);

    /* ===== step controls ===== */
    var controls = document.createElement("div");
    controls.className = "viz-controls";
    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); goStep(state.step - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); goStep(state.step + 1); });
    btnNext.classList.add("primary");
    var btnPlay = mkBtn("▶ הפעל", function () { toggleAuto(); });
    var btnReset = mkBtn("↺ איפוס", function () {
      stopAuto(); state.selected = null; goStep(0);
    });
    controls.appendChild(btnPrev);
    controls.appendChild(btnNext);
    controls.appendChild(btnPlay);
    controls.appendChild(btnReset);
    wrap.appendChild(controls);

    /* ===== bookkeeping table ===== */
    var tableWrap = document.createElement("div");
    tableWrap.style.overflowX = "auto";
    tableWrap.style.marginTop = "12px";
    var table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.fontSize = ".82rem";
    table.style.minWidth = "460px";
    tableWrap.appendChild(table);
    wrap.appendChild(tableWrap);

    mount.appendChild(wrap);

    /* ---------------------------------------------------------------
       helpers
       --------------------------------------------------------------- */
    function mkBtn(label, fn) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn";
      b.innerHTML = label;
      b.addEventListener("click", fn);
      return b;
    }
    function mkMarker(defsEl, id, color) {
      var m = el("marker", { id: id, viewBox: "0 0 10 10", refX: "8", refY: "5",
        markerWidth: "7", markerHeight: "7", orient: "auto" });
      m.appendChild(el("path", { d: "M0 0 L10 5 L0 10 z", fill: color }));
      defsEl.appendChild(m);
    }

    /* ---------------------------------------------------------------
       DRAW — rebuild the dynamic layer from (n, step, selected)
       --------------------------------------------------------------- */
    function draw() {
      while (layer.firstChild) layer.removeChild(layer.firstChild);
      var n = state.n;
      var rs = roots(n);
      var vis = STEPS[state.step].vis;
      var half = n / 2;

      /* --- antipode pairs (Conclusion עמ' 30) --- */
      if (vis.pairs) {
        for (var j = 0; j < half; j++) {
          var a = rs[j], b = rs[j + half];
          layer.appendChild(el("line", {
            x1: px(a.re), y1: py(a.im), x2: px(b.re), y2: py(b.im),
            stroke: C.clay, "stroke-width": 1.3, "stroke-dasharray": "5 4", opacity: 0.7
          }));
        }
      }

      /* --- squaring arrows k -> 2k mod n (Halving Lemma) --- */
      if (vis.square) {
        rs.forEach(function (r) {
          var img = (2 * r.k) % n;
          if (img === r.k) return; /* fixed points (k=0, and k=n/2→0) skip arc */
          drawArc(layer, px(r.re), py(r.im), px(rs[img].re), py(rs[img].im),
            C.mustard, "url(#rou-arr-mustard)", 0.55);
        });
      }

      /* --- primitive-root radius (ωₙ = ω¹) --- */
      if (vis.primitive && n >= 2) {
        var p1 = rs[1 % n];
        layer.appendChild(el("line", {
          x1: cx, y1: cy, x2: px(p1.re), y2: py(p1.im),
          stroke: C.blue, "stroke-width": 2.2
        }));
      }

      /* --- selected root overlays (arrow to square + diameter to antipode) --- */
      if (state.selected != null) {
        var sk = state.selected % n;
        var sr = rs[sk];
        var img2 = (2 * sk) % n;
        var anti = (sk + half) % n;
        /* diameter to antipode */
        layer.appendChild(el("line", {
          x1: px(sr.re), y1: py(sr.im), x2: px(rs[anti].re), y2: py(rs[anti].im),
          stroke: C.clay, "stroke-width": 1.8, "stroke-dasharray": "4 3", opacity: 0.9
        }));
        /* arrow to square */
        if (img2 !== sk) {
          drawArc(layer, px(sr.re), py(sr.im), px(rs[img2].re), py(rs[img2].im),
            C.mustard, "url(#rou-arr-mustard)", 1);
        }
      }

      /* --- the roots themselves (drawn last, on top) --- */
      var showLabels = vis.labels;
      rs.forEach(function (r) {
        var isSel = (state.selected != null && (state.selected % n) === r.k);
        var isNeg1 = vis.neg1 && r.k === half;
        var isPrim = vis.primitive && r.k === (1 % n) && n >= 2;
        var isImage = vis.square && (r.k % 2 === 0); /* squares land on even indices */

        var fill = C.teal, rad = 6.5, stroke = "#fff", sw = 1.6;
        if (isImage) { fill = C.mustard; rad = 7.5; }
        if (isNeg1) { fill = C.clay; rad = 8; }
        if (isPrim) { fill = C.blue; rad = 8; }
        if (isSel) { fill = C.tealDk; rad = 9; stroke = C.mustard; sw = 2.4; }

        /* focusable/clickable group for keyboard + mouse selection */
        var g = el("g", {
          tabindex: "0", role: "button", style: "cursor:pointer",
          "aria-label": "שורש " + w(n) + "^" + r.k + " בזווית " + fracPi(r.k, n)
        });
        var hit = el("circle", { cx: px(r.re), cy: py(r.im), r: 14, fill: "transparent" });
        var dot = el("circle", {
          cx: px(r.re), cy: py(r.im), r: rad, fill: fill,
          stroke: stroke, "stroke-width": sw
        });
        g.appendChild(hit);
        g.appendChild(dot);
        (function (kk) {
          g.addEventListener("click", function () { selectRoot(kk); });
          g.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
              selectRoot(kk); e.preventDefault();
            }
          });
        })(r.k);
        layer.appendChild(g);

        /* exponent label just outside the circle */
        if (showLabels) {
          var lx = cx + (R + 22) * r.re, ly = cy - (R + 22) * r.im;
          var lbl = el("text", {
            x: lx, y: ly + 4, "text-anchor": "middle",
            "font-size": (n >= 16 ? 9.5 : 11), "font-weight": (isSel || isNeg1 || isPrim) ? 800 : 600,
            fill: isNeg1 ? C.clay : (isPrim ? C.blue : (isSel ? C.tealDk : C.inkSoft))
          });
          var base = el("tspan"); base.textContent = "ω";
          var subEl = el("tspan", { "baseline-shift": "sub", "font-size": "72%" });
          subEl.textContent = String(n);
          var sup = el("tspan", { "baseline-shift": "super", "font-size": "72%" });
          sup.textContent = String(r.k);
          lbl.appendChild(base); lbl.appendChild(subEl); lbl.appendChild(sup);
          layer.appendChild(lbl);
        }
      });

      /* caption strip for the squaring step */
      if (vis.square) {
        layer.appendChild(txt(cx, H - 14,
          n + " שורשים  →  " + half + " שורשים  (מיפוי 2‑ל‑1)", {
          "text-anchor": "middle", "font-size": 11, "font-weight": 700,
          fill: C.mustard, direction: "rtl"
        }));
      }
    }

    /* draw a curved arrow (quadratic Bézier bowing toward the centre) */
    function drawArc(parent, x1, y1, x2, y2, color, marker, opacity) {
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      /* control point pulled ~45% toward the circle centre for a nice bow */
      var ctrlX = mx + (cx - mx) * 0.45;
      var ctrlY = my + (cy - my) * 0.45;
      parent.appendChild(el("path", {
        d: "M" + x1 + " " + y1 + " Q" + ctrlX + " " + ctrlY + " " + x2 + " " + y2,
        fill: "none", stroke: color, "stroke-width": 1.6,
        opacity: opacity, "marker-end": marker
      }));
    }

    /* ---------------------------------------------------------------
       selection (click / Enter on a root) — demonstrates halving live
       --------------------------------------------------------------- */
    function selectRoot(k) {
      state.selected = k;
      draw();
      renderReadout();
    }

    function renderReadout() {
      var n = state.n;
      if (state.selected == null) {
        readout.innerHTML = "💡 לחצו על שורש במעגל (או נווטו עם <kbd>Tab</kbd> + <kbd>Enter</kbd>) " +
          "כדי לראות את ערכו, את הריבוע שלו (הלמת החצייה) ואת הנגדי שלו.";
        return;
      }
      var k = state.selected % n;
      var r = roots(n)[k];
      var img = (2 * k) % n;
      var anti = (k + n / 2) % n;
      var half = n / 2;
      readout.innerHTML =
        "<b>נבחר:</b> <span dir=\"ltr\">" + w(n) + "<sup>" + k + "</sup></span> · " +
        "זווית <span dir=\"ltr\">" + fracPi(k, n) + "</span> · " +
        "ערך <span dir=\"ltr\">≈ " + complexStr(r.re, r.im) + "</span><br>" +
        "<span style=\"color:" + C.mustard + ";font-weight:700\">ריבוע:</span> " +
        "<span dir=\"ltr\">(" + w(n) + "<sup>" + k + "</sup>)<sup>2</sup> = " + w(n) + "<sup>" + img +
        "</sup> = " + w(half) + "<sup>" + k % half + "</sup></span> " +
        "(שורש מסדר " + half + ") · " +
        "<span style=\"color:" + C.clay + ";font-weight:700\">נגדי:</span> " +
        "<span dir=\"ltr\">" + w(n) + "<sup>" + anti + "</sup> = " + MINUS + w(n) + "<sup>" + k + "</sup></span>";
    }

    /* ---------------------------------------------------------------
       bookkeeping table
       --------------------------------------------------------------- */
    function renderTable() {
      var n = state.n;
      var rs = roots(n);
      var half = n / 2;
      var head =
        "<thead><tr>" +
        th("k") + th("<span dir=\"ltr\">" + w(n) + "<sup>k</sup></span>") +
        th("זווית θ") + th("Re = cos θ") + th("Im = sin θ") +
        th("<span dir=\"ltr\">(" + w(n) + "<sup>k</sup>)<sup>2</sup></span>") +
        "</tr></thead>";
      var rows = rs.map(function (r) {
        var sel = (state.selected != null && (state.selected % n) === r.k);
        var img = (2 * r.k) % n;
        var bg = sel ? C.surface2 : "transparent";
        var bd = sel ? ("2px solid " + C.teal) : ("1px solid " + C.line);
        var cell = "padding:.3rem .5rem;border-bottom:1px solid " + C.line + ";text-align:center";
        return "<tr style=\"background:" + bg + "\">" +
          "<td style=\"" + cell + ";border-right:" + bd + ";font-weight:700;color:" + C.tealDk + "\">" + r.k + "</td>" +
          "<td style=\"" + cell + "\" dir=\"ltr\">" + complexStr(r.re, r.im) + "</td>" +
          "<td style=\"" + cell + "\" dir=\"ltr\">" + fracPi(r.k, n) + "</td>" +
          "<td style=\"" + cell + "\" dir=\"ltr\">" + fmt3(r.re) + "</td>" +
          "<td style=\"" + cell + "\" dir=\"ltr\">" + fmt3(r.im) + "</td>" +
          "<td style=\"" + cell + ";color:" + C.mustard + ";font-weight:700\" dir=\"ltr\">" +
            w(n) + "<sup>" + img + "</sup></td>" +
        "</tr>";
      }).join("");
      table.innerHTML = head + "<tbody>" + rows + "</tbody>";
    }
    function th(s) {
      return "<th style=\"padding:.35rem .5rem;border-bottom:2px solid " + C.line +
        ";color:" + C.inkSoft + ";font-weight:700;font-size:.78rem\">" + s + "</th>";
    }

    /* ---------------------------------------------------------------
       step / mode wiring
       --------------------------------------------------------------- */
    function renderPanel() {
      var s = STEPS[state.step];
      panel.innerHTML =
        "<div style=\"display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px\">" +
          "<span style=\"background:" + s.color + ";color:#fff;font-weight:700;font-size:.72rem;" +
            "padding:2px 10px;border-radius:99px\" dir=\"ltr\">" + s.badge + "</span>" +
          "<b style=\"font-size:1rem;color:" + C.ink + "\">" + s.title + "</b>" +
        "</div>" +
        "<div>" + s.body(state.n) + "</div>";
    }
    function renderChips() {
      chips.forEach(function (b, i) {
        var active = (i === state.step), done = (i < state.step);
        var col = STEPS[i].color;
        b.setAttribute("aria-selected", active ? "true" : "false");
        if (active) { b.style.background = col; b.style.color = "#fff"; b.style.borderColor = col; }
        else if (done) { b.style.background = C.surface2; b.style.color = C.ink; b.style.borderColor = col; }
        else { b.style.background = C.surface2; b.style.color = C.inkSoft; b.style.borderColor = C.line; }
      });
    }
    function renderNBtns() {
      N_OPTIONS.forEach(function (n) {
        var on = (n === state.n);
        nBtns[n].classList.toggle("primary", on);
        nBtns[n].setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    function goStep(i) {
      state.step = Math.max(0, Math.min(STEPS.length - 1, i));
      draw();
      renderPanel();
      renderChips();
      btnPrev.disabled = (state.step === 0);
      btnNext.disabled = (state.step === STEPS.length - 1);
    }
    function setN(n) {
      stopAuto();
      state.n = n;
      state.selected = null;
      renderNBtns();
      renderReadout();
      renderTable();
      goStep(state.step); /* redraw current step with new n */
    }

    /* ---------------------------------------------------------------
       autoplay
       --------------------------------------------------------------- */
    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      if (state.step >= STEPS.length - 1) goStep(0);
      btnPlay.innerHTML = "⏸ השהה";
      btnPlay.classList.add("primary");
      var delay = reducedMotion() ? 2600 : 3400;
      autoTimer = setInterval(function () {
        if (state.step >= STEPS.length - 1) { stopAuto(); return; }
        goStep(state.step + 1);
      }, delay);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      btnPlay.innerHTML = "▶ הפעל";
      btnPlay.classList.remove("primary");
    }

    /* keyboard: RTL-aware step nav on the wrapper (ignore when a root
       group is focused so Enter/Space still select it) */
    wrap.addEventListener("keydown", function (e) {
      var tag = e.target;
      var onRoot = tag && tag.getAttribute && tag.getAttribute("role") === "button";
      if (onRoot) return;
      if (e.key === "ArrowRight") { stopAuto(); goStep(state.step - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { stopAuto(); goStep(state.step + 1); e.preventDefault(); }
      else if (e.key === "Home") { stopAuto(); goStep(0); e.preventDefault(); }
      else if (e.key === "End") { stopAuto(); goStep(STEPS.length - 1); e.preventDefault(); }
    });

    /* ---- initial paint ---- */
    renderNBtns();
    renderReadout();
    renderTable();
    goStep(0);
  }

  /* =====================================================================
     boot: mount all instances; never throw (graceful if absent)
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
