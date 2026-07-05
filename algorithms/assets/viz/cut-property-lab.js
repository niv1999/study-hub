/* =====================================================================
   cut-property-lab.js  —  Module 04 "עץ פורש מינימלי — תכונת החתך (cut property)"
   Grounded in _notes/03-mst-he.md + 03-mst-en.md:
     • הגרף: גרף CLRS הקלאסי של part-1 — 9 קדקודים a..i עם המשקלים
       a-b=4 · a-h=8 · b-c=8 · b-h=11 · c-d=7 · c-i=2 · c-f=4 · d-e=9 ·
       d-f=14 · e-f=10 · f-g=2 · g-h=1 · g-i=6 · h-i=7
       העפ"מ (מודגש טורקיז בשקפים): {a-b(4),a-h(8),g-h(1),f-g(2),c-f(4),
       c-i(2),c-d(7),d-e(9)} — משקל כולל 37.
     • חמש ההגדרות (part-1 עמ' 3-8): cut (S,V-S) · crossing · light · respects · safe.
     • משפט הקשת הבטוחה (part-1): קשת קלה החוצה חתך המכבד את A היא בטוחה עבור A.
     • תרגיל 1 (part-1 עמ' 11-13): קשת בעלת משקל מינימלי (כאן g-h=1) בטוחה
       עבור A=∅ דרך החתך ({u},V\{u}) — בדיוק מצב "חקירה חופשית" כאן.

   המעבדה מדגימה את המשפט ע"י גידול הקבוצה S מהשורש a (זו בדיוק ריצת Prim):
   בכל שלב החתך (S, V-S) מכבד את A (קבוצת הקשתות שכבר נבחרה, שכן S הוא בדיוק
   קדקודי העץ), והקשת הקלה החוצה אותו היא בטוחה — מצטרפת ל-A. אחרי 8 צעדים
   A הוא עפ"מ שלם במשקל 37. בנוסף אפשר ללחוץ על קדקוד ולבנות חתך משלך.

   Self-contained IIFE. Bespoke hand-authored SVG/DOM. Cream design tokens
   hardcoded (CONTRACT §2). RTL Hebrew UI; English/LTR identifiers.
   Keyboard accessible, prefers-reduced-motion respected, graceful no-mount.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "cut-property-lab";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design palette (hardcoded per CONTRACT §2; unit-2 = sage) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",   /* dusty-blue — קדקודי S (הצד הנבחר) */
    sage: "#7C9885",   /* turquoise/green — קשת קלה / קשת בטוחה / עפ"מ */
    sageDk: "#5F7C69",
    clay: "#BE7C5E",
    red: "#C86B5A",    /* red — קשת חוצה חתך */
    mustard: "#C9A24B"
  };

  /* --- הגרף (CLRS) — קואורדינטות פרישה נקייה --- */
  var POS = {
    a: { x: 74, y: 66 }, b: { x: 216, y: 56 }, c: { x: 356, y: 62 },
    d: { x: 498, y: 70 }, e: { x: 578, y: 178 }, f: { x: 410, y: 202 },
    g: { x: 252, y: 264 }, h: { x: 98, y: 188 }, i: { x: 268, y: 152 }
  };
  var VORDER = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  /* קשתות ומשקלים — כלשון ההרצאה */
  var EDGES = [
    ["a", "b", 4], ["a", "h", 8], ["b", "c", 8], ["b", "h", 11],
    ["c", "d", 7], ["c", "i", 2], ["c", "f", 4], ["d", "e", 9],
    ["d", "f", 14], ["e", "f", 10], ["f", "g", 2], ["g", "h", 1],
    ["g", "i", 6], ["h", "i", 7]
  ];
  function ekey(u, v) { return u < v ? u + "-" + v : v + "-" + u; }

  /* --- ריצת Prim מהשורש a: סדר צירוף הקדקודים והקשתות הבטוחות ---
     (נגזר מהעפ"מ של CLRS; שובר תיקו בצעד 2 לטובת a-h=8 כדי לשחזר את העץ) */
  var SEQ_V = ["a", "b", "h", "g", "f", "c", "i", "d", "e"];
  var ADDS = [
    ["a", "b", 4], ["a", "h", 8], ["g", "h", 1], ["f", "g", 2],
    ["c", "f", 4], ["c", "i", 2], ["c", "d", 7], ["d", "e", 9]
  ];
  /* הסבר לכל אחד מ-9 המצבים (state k = k+1 קדקודים ב-S, k קשתות ב-A) */
  var NOTES = [
    'שורש <b>r=a</b>. החתך הוא <span dir="ltr">(S={a}, V∖S)</span>. הקשתות החוצות: ' +
      '<span dir="ltr">a–b=4</span> ו-<span dir="ltr">a–h=8</span>. הקלה ביותר היא ' +
      '<span dir="ltr">a–b=4</span> — לפי משפט הקשת הבטוחה היא <b>בטוחה</b> עבור A=∅. נצרף אותה.',
    'צירפנו <span dir="ltr">a–b=4</span> ל-A. החתך גדל ל-<span dir="ltr">S={a,b}</span> והוא ' +
      '<b>מכבד</b> את A. חוצות: <span dir="ltr">a–h=8, b–c=8, b–h=11</span>. שתי קשתות קלות שקולות ' +
      '(משקל 8) — כל אחת בטוחה; נבחר <span dir="ltr">a–h=8</span> (כדי לשחזר את עץ ההרצאה).',
    'צירפנו <span dir="ltr">a–h=8</span>. <span dir="ltr">S={a,b,h}</span>. חוצות: ' +
      '<span dir="ltr">g–h=1, h–i=7, b–c=8</span>. הקלה: <span dir="ltr">g–h=1</span> ' +
      '(גם הקשת המינימלית בכל הגרף) — בטוחה.',
    'צירפנו <span dir="ltr">g–h=1</span>. <span dir="ltr">S={a,b,g,h}</span>. חוצות: ' +
      '<span dir="ltr">f–g=2, g–i=6, h–i=7, b–c=8</span>. הקלה: <span dir="ltr">f–g=2</span> — בטוחה.',
    'צירפנו <span dir="ltr">f–g=2</span>. <span dir="ltr">S={a,b,f,g,h}</span>. חוצות: ' +
      '<span dir="ltr">c–f=4, g–i=6, h–i=7, b–c=8, e–f=10, d–f=14</span>. הקלה: ' +
      '<span dir="ltr">c–f=4</span> — בטוחה.',
    'צירפנו <span dir="ltr">c–f=4</span>. <span dir="ltr">S={a,b,c,f,g,h}</span>. חוצות: ' +
      '<span dir="ltr">c–i=2, g–i=6, c–d=7, h–i=7, e–f=10, d–f=14</span>. הקלה: ' +
      '<span dir="ltr">c–i=2</span> — בטוחה.',
    'צירפנו <span dir="ltr">c–i=2</span>. <span dir="ltr">S={a,b,c,f,g,h,i}</span>. חוצות: ' +
      '<span dir="ltr">c–d=7, e–f=10, d–f=14</span>. הקלה: <span dir="ltr">c–d=7</span> — בטוחה.',
    'צירפנו <span dir="ltr">c–d=7</span>. <span dir="ltr">S={a,b,c,d,f,g,h,i}</span>. חוצות: ' +
      '<span dir="ltr">d–e=9, e–f=10</span>. הקלה: <span dir="ltr">d–e=9</span> — בטוחה. נותר רק הקדקוד e.',
    'צירפנו <span dir="ltr">d–e=9</span>. <span dir="ltr">S=V</span> — כל הקדקודים בעץ, אין קשתות חוצות. ' +
      'A הוא <b>עפ"מ שלם</b> במשקל <b dir="ltr">37 = 1+2+2+4+4+7+8+9</b>. ∎'
  ];

  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
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

  /* ---------------------------------------------------------------
     render one mount
     --------------------------------------------------------------- */
  function render(mount) {
    if (!mount || mount.getAttribute("data-cpl-ready") === "1") return;
    mount.setAttribute("data-cpl-ready", "1");
    mount.innerHTML = "";

    /* ---- state ----
       S      : Set of vertex ids on the S-side of the cut
       Aset   : Set of edge-keys already chosen (safe edges / tree)
       mode   : "guided" (Prim growth) | "custom" (user-defined cut)
       gidx   : current guided state index 0..8                       */
    var S = new Set(["a"]);
    var Aset = new Set();
    var mode = "guided";
    var gidx = 0;
    var autoTimer = null;

    var W = 660, H = 344, R = 19;

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");

    /* ===== mode toggle row ===== */
    var modeRow = document.createElement("div");
    modeRow.className = "viz-controls";
    modeRow.style.marginTop = "0";
    modeRow.style.marginBottom = ".7rem";
    var mLbl = document.createElement("span");
    mLbl.textContent = "מצב:";
    mLbl.style.fontWeight = "700";
    mLbl.style.color = C.ink;
    mLbl.style.fontSize = ".9rem";
    modeRow.appendChild(mLbl);
    var btnGuided = mkBtn("▷ הדגמה מודרכת (Prim מ-a)", function () { setMode("guided"); });
    var btnCustom = mkBtn("✎ חקירה חופשית", function () { setMode("custom"); });
    modeRow.appendChild(btnGuided);
    modeRow.appendChild(btnCustom);
    wrap.appendChild(modeRow);

    /* ===== scene ===== */
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H, width: "100%",
      role: "img", direction: "ltr",
      "aria-label": "גרף CLRS עם חתך (S, V−S), קשתות חוצות מודגשות אדום והקשת הקלה מודגשת ירוק"
    });
    svg.style.display = "block";
    svg.style.maxWidth = W + "px";
    svg.style.margin = "0 auto";

    var defs = el("defs");
    svg.appendChild(defs);
    /* soft glow for tree / light edges */
    var filt = el("filter", { id: "cpl-glow", x: "-30%", y: "-30%", width: "160%", height: "160%" });
    filt.appendChild(el("feGaussianBlur", { stdDeviation: "2.4", result: "b" }));
    var fm = el("feMerge");
    fm.appendChild(el("feMergeNode", { in: "b" }));
    fm.appendChild(el("feMergeNode", { in: "SourceGraphic" }));
    filt.appendChild(fm);
    defs.appendChild(filt);

    /* background card */
    svg.appendChild(el("rect", { x: 1, y: 1, width: W - 2, height: H - 2, rx: 14,
      fill: C.surface, stroke: C.line, "stroke-width": 1.5 }));

    /* legend (top, LTR row inside svg) */
    var lg = [
      { c: C.blue, t: "S" }, { c: C.surface2, t: "V−S", stroke: C.line },
      { c: C.red, t: "crossing" }, { c: C.sage, t: "light / safe" }, { c: C.sageDk, t: "A (tree)" }
    ];
    var lx = 16;
    lg.forEach(function (it) {
      svg.appendChild(el("rect", { x: lx, y: 12, width: 13, height: 13, rx: 3,
        fill: it.c, stroke: it.stroke || it.c, "stroke-width": 1.2 }));
      svg.appendChild(txt(lx + 18, 23, it.t, { "font-size": 10.5, "font-weight": 700, fill: C.inkSoft }));
      lx += 26 + it.t.length * 6.4;
    });

    /* --- edges (glow underlay + main line + weight chip) --- */
    var edgeEls = {};
    EDGES.forEach(function (e) {
      var u = e[0], v = e[1], w = e[2];
      var p1 = POS[u], p2 = POS[v];
      var glow = el("line", { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
        stroke: C.sage, "stroke-width": 7, "stroke-linecap": "round",
        opacity: 0, filter: "url(#cpl-glow)" });
      var line = el("line", { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
        stroke: C.line, "stroke-width": 2.4, "stroke-linecap": "round" });
      svg.appendChild(glow); svg.appendChild(line);
      var mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      var chip = el("rect", { x: mx - 11, y: my - 10, width: 22, height: 17, rx: 5,
        fill: C.surface, stroke: C.line, "stroke-width": 1 });
      var wl = txt(mx, my, String(w), { "text-anchor": "middle",
        "font-size": 11, "font-weight": 700, fill: C.inkSoft, "dominant-baseline": "central" });
      svg.appendChild(chip); svg.appendChild(wl);
      edgeEls[ekey(u, v)] = { glow: glow, line: line, chip: chip, wl: wl, w: w };
    });

    /* --- vertices (clickable / focusable) --- */
    var vertEls = {};
    VORDER.forEach(function (id) {
      var p = POS[id];
      var g = el("g", { tabindex: "0", role: "button",
        "aria-label": "קדקוד " + id, style: "cursor:pointer" });
      var circ = el("circle", { cx: p.x, cy: p.y, r: R,
        fill: C.surface2, stroke: C.line, "stroke-width": 2.4 });
      var lbl = txt(p.x, p.y, id, { "text-anchor": "middle", "dominant-baseline": "central",
        "font-size": 15, "font-weight": 800, fill: C.ink, style: "pointer-events:none" });
      g.appendChild(circ); g.appendChild(lbl);
      svg.appendChild(g);
      vertEls[id] = { g: g, circ: circ, lbl: lbl };
      g.addEventListener("click", function () { toggleVertex(id); });
      g.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " " || ev.key === "Spacebar") {
          ev.preventDefault(); toggleVertex(id);
        }
      });
    });

    var sceneBox = document.createElement("div");
    sceneBox.style.background = C.surface2;
    sceneBox.style.borderRadius = "12px";
    sceneBox.style.padding = "4px";
    sceneBox.appendChild(svg);
    wrap.appendChild(sceneBox);

    /* ===== explanation line ===== */
    var expl = document.createElement("div");
    expl.setAttribute("aria-live", "polite");
    expl.style.cssText = "background:" + C.surface2 + ";border:1px solid " + C.line +
      ";border-radius:12px;padding:11px 14px;margin-top:11px;color:" + C.ink +
      ";line-height:1.7;font-size:.92rem;min-height:52px";
    wrap.appendChild(expl);

    /* ===== bookkeeping grid (S/V-S + A + crossing table) ===== */
    var book = document.createElement("div");
    book.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:11px";
    var boxSets = mkPanel();
    var boxCross = mkPanel();
    book.appendChild(boxSets);
    book.appendChild(boxCross);
    wrap.appendChild(book);

    /* ===== step controls ===== */
    var controls = document.createElement("div");
    controls.className = "viz-controls";
    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); gotoStep(gidx - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); gotoStep(gidx + 1); });
    btnNext.classList.add("primary");
    var btnPlay = mkBtn("▶ הפעל", function () { toggleAuto(); });
    var btnReset = mkBtn("↺ איפוס", function () { stopAuto(); setMode("guided"); });
    controls.appendChild(btnPrev);
    controls.appendChild(btnNext);
    controls.appendChild(btnPlay);
    controls.appendChild(btnReset);
    wrap.appendChild(controls);

    /* sr-only live status */
    var status = document.createElement("p");
    status.setAttribute("aria-live", "polite");
    status.style.cssText =
      "position:absolute;width:1px;height:1px;margin:-1px;padding:0;" +
      "overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;";
    wrap.appendChild(status);

    mount.appendChild(wrap);

    /* ---------- DOM helpers ---------- */
    function mkBtn(label, fn) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn";
      b.innerHTML = label;
      b.addEventListener("click", fn);
      return b;
    }
    function mkPanel() {
      var d = document.createElement("div");
      d.style.cssText = "background:" + C.surface2 + ";border:1px solid " + C.line +
        ";border-radius:12px;padding:10px 12px;color:" + C.ink + ";font-size:.86rem;line-height:1.6";
      return d;
    }

    /* ---------------------------------------------------------------
       interaction: toggle a vertex → custom mode (A=∅, pure cut)
       --------------------------------------------------------------- */
    function toggleVertex(id) {
      stopAuto();
      mode = "custom";
      if (S.has(id)) S.delete(id); else S.add(id);
      Aset = new Set();
      syncModeButtons();
      recompute(null, null);
      say((S.has(id) ? "הוספת" : "הסרת") + " את " + id + " · |S|=" + S.size);
    }

    /* ---------------------------------------------------------------
       mode + guided navigation
       --------------------------------------------------------------- */
    function setMode(m) {
      mode = m;
      stopAuto();
      if (m === "guided") { gidx = 0; loadGuided(); }
      else { Aset = new Set(); recompute(null, null); }
      syncModeButtons();
    }
    function syncModeButtons() {
      btnGuided.classList.toggle("primary", mode === "guided");
      btnCustom.classList.toggle("primary", mode === "custom");
      btnGuided.setAttribute("aria-pressed", mode === "guided" ? "true" : "false");
      btnCustom.setAttribute("aria-pressed", mode === "custom" ? "true" : "false");
      var guided = (mode === "guided");
      btnPrev.disabled = !guided || gidx === 0;
      btnNext.disabled = !guided || gidx === NOTES.length - 1;
      btnPlay.disabled = !guided;
      btnPlay.style.opacity = guided ? "1" : ".5";
    }

    function loadGuided() {
      S = new Set(SEQ_V.slice(0, gidx + 1));
      Aset = new Set(ADDS.slice(0, gidx).map(function (e) { return ekey(e[0], e[1]); }));
      var chosen = (gidx < ADDS.length) ? ekey(ADDS[gidx][0], ADDS[gidx][1]) : null;
      recompute(NOTES[gidx], chosen);
      btnPrev.disabled = (gidx === 0);
      btnNext.disabled = (gidx === NOTES.length - 1);
    }
    function gotoStep(n) {
      mode = "guided";
      gidx = Math.max(0, Math.min(NOTES.length - 1, n));
      loadGuided();
      syncModeButtons();
      say("שלב " + (gidx + 1) + " מתוך " + NOTES.length);
    }

    /* ---------------------------------------------------------------
       autoplay
       --------------------------------------------------------------- */
    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      if (mode !== "guided") return;
      if (gidx >= NOTES.length - 1) gotoStep(0);
      btnPlay.innerHTML = "⏸ השהה";
      btnPlay.classList.add("primary");
      var delay = reducedMotion() ? 2100 : 2600;
      autoTimer = setInterval(function () {
        if (gidx >= NOTES.length - 1) { stopAuto(); return; }
        gotoStep(gidx + 1);
      }, delay);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      btnPlay.innerHTML = "▶ הפעל";
      btnPlay.classList.remove("primary");
    }
    function say(m) { status.textContent = m; }

    /* ---------------------------------------------------------------
       recompute — classify edges for the current cut, find crossing +
       light edges, repaint scene + bookkeeping.
       --------------------------------------------------------------- */
    function recompute(noteHtml, chosenKey) {
      var inS = function (id) { return S.has(id); };

      var crossing = [];
      EDGES.forEach(function (e) {
        var u = e[0], v = e[1], w = e[2], k = ekey(u, v);
        var isCross = (inS(u) !== inS(v));
        var inA = Aset.has(k);
        var E2 = edgeEls[k];
        if (E2.anim) { try { E2.anim.cancel(); } catch (err) {} E2.anim = null; }
        E2.glow.setAttribute("opacity", 0);
        E2.glow.setAttribute("stroke", C.sage);
        E2.line.setAttribute("opacity", 1);
        if (inA) {
          E2.line.setAttribute("stroke", C.sageDk);
          E2.line.setAttribute("stroke-width", 4.2);
          E2.glow.setAttribute("stroke", C.sageDk);
          E2.glow.setAttribute("opacity", 0.55);
          chipStyle(E2, C.sageDk, "#fff");
        } else if (isCross) {
          E2.line.setAttribute("stroke", C.red);
          E2.line.setAttribute("stroke-width", 3);
          chipStyle(E2, C.red, "#fff");
          crossing.push({ u: u, v: v, w: w, key: k });
        } else {
          E2.line.setAttribute("stroke", C.line);
          E2.line.setAttribute("stroke-width", 2.2);
          E2.line.setAttribute("opacity", 0.85);
          chipStyle(E2, C.surface, C.inkSoft, C.line);
        }
      });

      /* light edges = crossing edges of minimum weight */
      crossing.sort(function (p, q) { return p.w - q.w || (p.key < q.key ? -1 : 1); });
      var minW = crossing.length ? crossing[0].w : null;
      var lightKeys = crossing.filter(function (e) { return e.w === minW; })
        .map(function (e) { return e.key; });

      lightKeys.forEach(function (k) {
        var E2 = edgeEls[k];
        var emphasized = (chosenKey ? (k === chosenKey) : true);
        E2.line.setAttribute("stroke", C.sage);
        E2.line.setAttribute("stroke-width", emphasized ? 4.6 : 3.4);
        E2.glow.setAttribute("stroke", C.sage);
        E2.glow.setAttribute("opacity", emphasized ? 0.9 : 0.5);
        chipStyle(E2, C.sage, "#fff");
        if (emphasized && !reducedMotion() && E2.glow.animate) {
          E2.anim = E2.glow.animate(
            [{ opacity: 0.35 }, { opacity: 0.95 }, { opacity: 0.55 }],
            { duration: 1400, iterations: Infinity });
        }
      });

      /* vertices */
      var lightEnds = {};
      (chosenKey ? [chosenKey] : lightKeys).forEach(function (k) {
        var parts = k.split("-"); lightEnds[parts[0]] = 1; lightEnds[parts[1]] = 1;
      });
      VORDER.forEach(function (id) {
        var ve = vertEls[id], inside = inS(id);
        ve.circ.setAttribute("fill", inside ? C.blue : C.surface2);
        ve.circ.setAttribute("stroke", lightEnds[id] ? C.sageDk : (inside ? "#4E6B7E" : C.line));
        ve.circ.setAttribute("stroke-width", lightEnds[id] ? 3.4 : 2.4);
        ve.lbl.setAttribute("fill", inside ? "#fff" : C.ink);
        ve.g.setAttribute("aria-pressed", inside ? "true" : "false");
        ve.g.setAttribute("aria-label", "קדקוד " + id + " — " + (inside ? "בתוך S" : "מחוץ ל-S"));
      });

      /* explanation */
      if (noteHtml) expl.innerHTML = wrapNote(noteHtml, "משפט הקשת הבטוחה");
      else expl.innerHTML = wrapNote(customNote(crossing, lightKeys, minW), "חקירה חופשית · תרגיל 1");

      renderSets();
      renderCross(crossing, lightKeys, minW, chosenKey);
    }

    function chipStyle(E2, fill, textColor, stroke) {
      E2.chip.setAttribute("fill", fill);
      E2.chip.setAttribute("stroke", stroke || fill);
      E2.wl.setAttribute("fill", textColor);
    }
    function wrapNote(inner, badge) {
      return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">' +
        '<span style="background:' + C.sage + ';color:#fff;font-weight:700;font-size:.72rem;' +
        'padding:2px 10px;border-radius:99px">' + badge + '</span></div><div>' + inner + '</div>';
    }
    function customNote(crossing, lightKeys, minW) {
      if (S.size === 0)
        return 'הקבוצה <span dir="ltr">S</span> ריקה — <b>אין חתך תקין</b>. הוסיפו קדקוד אחד לפחות.';
      if (S.size === VORDER.length)
        return '<span dir="ltr">S = V</span> — <b>אין קשתות חוצות</b>. הזיזו קדקוד ל-<span dir="ltr">V∖S</span> כדי לראות חתך.';
      var lightTxt = lightKeys.map(function (k) { return k.replace("-", "–") + "=" + minW; }).join(", ");
      var many = lightKeys.length > 1;
      return 'בניתם חתך <span dir="ltr">(S, V∖S)</span> עם <b>' + crossing.length + '</b> קשתות חוצות. ' +
        'הקשת הקלה' + (many ? ' (יש ' + lightKeys.length + ' שקולות)' : '') + ': <b dir="ltr">' + lightTxt + '</b>. ' +
        'לפי משפט הקשת הבטוחה (ותרגיל 1) — הקשת הקלה החוצה כל חתך היא <b>בטוחה עבור A=∅</b>, ' +
        'כלומר שייכת לעפ"מ כלשהו של הגרף.';
    }

    function renderSets() {
      var sArr = VORDER.filter(function (id) { return S.has(id); });
      var vsArr = VORDER.filter(function (id) { return !S.has(id); });
      var aEdges = EDGES.filter(function (e) { return Aset.has(ekey(e[0], e[1])); });
      var wA = aEdges.reduce(function (s, e) { return s + e[2]; }, 0);
      var aTxt = aEdges.length
        ? aEdges.map(function (e) { return e[0] + "–" + e[1] + "(" + e[2] + ")"; }).join(", ")
        : "∅";
      boxSets.innerHTML =
        '<div style="font-weight:800;color:' + C.ink + ';margin-bottom:6px">מצב האלגוריתם</div>' +
        setRow("S", '<span dir="ltr">{ ' + (sArr.join(", ") || "∅") + ' }</span>', C.blue) +
        setRow("V−S", '<span dir="ltr">{ ' + (vsArr.join(", ") || "∅") + ' }</span>', C.inkSoft) +
        setRow("A", '<span dir="ltr">' + aTxt + '</span>', C.sageDk) +
        '<div style="margin-top:7px;padding-top:7px;border-top:1px solid ' + C.line + ';font-weight:700">' +
        'W(A) = <b dir="ltr" style="color:' + C.sageDk + '">' + wA + '</b>' +
        (aEdges.length === 8 ? ' &nbsp;<span style="color:' + C.sage + '">← עפ"מ שלם! (37)</span>' : '') +
        '</div>';
    }
    function setRow(k, v, col) {
      return '<div style="display:flex;gap:8px;margin:3px 0"><span dir="ltr" style="min-width:42px;' +
        'font-weight:800;color:' + col + '">' + k + '</span><span>' + v + '</span></div>';
    }

    function renderCross(crossing, lightKeys, minW, chosenKey) {
      var head = '<div style="font-weight:800;color:' + C.ink + ';margin-bottom:6px">' +
        'קשתות החוצות את החתך <span style="font-weight:600;color:' + C.inkSoft +
        '">(ממוינות לפי משקל)</span></div>';
      if (!crossing.length) {
        boxCross.innerHTML = head + '<div style="color:' + C.inkSoft + '">אין קשתות חוצות.</div>';
        return;
      }
      var rows = crossing.map(function (e) {
        var isLight = lightKeys.indexOf(e.key) !== -1;
        var isChosen = chosenKey ? (e.key === chosenKey) : isLight;
        var bg = isChosen ? C.sage : (isLight ? "#EAF0EC" : "transparent");
        var fg = isChosen ? "#fff" : C.ink;
        var tag = isChosen
          ? '<span style="float:left;font-size:.76rem">← קלה · בטוחה</span>'
          : (isLight ? '<span style="float:left;font-size:.76rem;color:' + C.sageDk + '">קלה</span>' : "");
        return '<div style="display:flex;justify-content:space-between;align-items:center;' +
          'background:' + bg + ';color:' + fg + ';border-radius:6px;padding:3px 8px;margin:2px 0">' +
          '<span dir="ltr" style="font-weight:700">' + e.u + "–" + e.v + '</span>' +
          '<span dir="ltr" style="font-weight:800">w=' + e.w + '</span>' + tag + '</div>';
      }).join("");
      boxCross.innerHTML = head + rows +
        '<div style="margin-top:6px;font-size:.8rem;color:' + C.inkSoft + '">' +
        'משקל מינימלי חוצה = <b dir="ltr" style="color:' + C.sageDk + '">' + minW + '</b> ⇐ הקשת הקלה.</div>';
    }

    /* keyboard on the wrap: RTL-aware step nav (guided only) */
    wrap.addEventListener("keydown", function (e) {
      if (mode !== "guided") return;
      if (e.target && e.target.getAttribute && e.target.getAttribute("role") === "button") return;
      if (e.key === "ArrowRight") { stopAuto(); gotoStep(gidx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { stopAuto(); gotoStep(gidx + 1); e.preventDefault(); }
      else if (e.key === "Home") { stopAuto(); gotoStep(0); e.preventDefault(); }
      else if (e.key === "End") { stopAuto(); gotoStep(NOTES.length - 1); e.preventDefault(); }
    });

    /* initial paint */
    syncModeButtons();
    loadGuided();
  }

  /* ---------------------------------------------------------------
     boot: mount all instances (guard). Never throw.
     --------------------------------------------------------------- */
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
