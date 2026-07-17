/* =====================================================================
   alphabeta-stepper.js — Module 09 "משחקים — Minimax ואלפא-בטא"
   Grounded in _notes/games1.md + games2.md — the EXACT worked game tree
   (AIMA Fig. 5.2 / the lecturer's classroom exercise), reused by BOTH
   decks so a single tree supports both modes here:

     Root A (MAX) — three actions a1,a2,a3 — to three MIN children:
       B (a1): leaves b1,b2,b3 = 3, 12, 8
       C (a2): leaves c1,c2,c3 = 2, 4, 6
       D (a3): leaves d1,d2,d3 = 14, 5, 2

     MINIMAX mode reproduces games1.md עמ' 19–21 (the classroom exercise):
       B=min(3,12,8)=3 · C=min(2,4,6)=2 · D=min(14,5,2)=2 · A=max(3,2,2)=3.
       (Notes ran it right-to-left; the value is order-independent, so we
       traverse left-to-right here to match the α-β trace exactly.)

     ALPHA-BETA mode reproduces games2.md עמ' 9–14 (the classic worked
     pruning example, left-to-right):
       B fully explored ⇒ 3, root α=3.
       C: first leaf c1=2 ⇒ v=2, β=2 ≤ α=3 ⇒ PRUNE c2=4, c3=6 ("This node
       is worse for MAX" — עמ' 11). C returns 2, root α stays 3.
       D: all three leaves examined (14→5→2); the final β≤α condition is
       met only on the LAST leaf, so nothing is left to prune (עמ' 14).
       Root = max(3,2,2) = 3 — identical to full Minimax; 2 of 9 leaves
       (c2,c3) were never visited.

   This IS the real recursive alpha-beta algorithm (pseudocode verbatim
   from games2.md עמ' 17), parameterized by a `pruning` flag — running it
   with pruning=false gives the Minimax mode, so the two modes can never
   drift out of sync with each other or with the lecture trace.

   Self-contained IIFE. Hand-authored SVG + DOM. No external deps. Colors
   ONLY via the site's CSS custom properties (var(--accent) etc.) plus
   color-mix() tints, so both themes work. RTL Hebrew UI; LTR tree (node
   ids are English/alphanumeric).
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "alphabeta-stepper";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* =====================================================================
     THE GAME TREE (exact lecture values, see header)
     ===================================================================== */
  var NODES = {
    A: { type: "max", x: 370, y: 100, children: ["B", "C", "D"] },
    B: { type: "min", x: 130, y: 225, children: ["B1", "B2", "B3"] },
    C: { type: "min", x: 370, y: 225, children: ["C1", "C2", "C3"] },
    D: { type: "min", x: 610, y: 225, children: ["D1", "D2", "D3"] },
    B1: { type: "leaf", x: 70, y: 350, value: 3 },
    B2: { type: "leaf", x: 130, y: 350, value: 12 },
    B3: { type: "leaf", x: 190, y: 350, value: 8 },
    C1: { type: "leaf", x: 310, y: 350, value: 2 },
    C2: { type: "leaf", x: 370, y: 350, value: 4 },
    C3: { type: "leaf", x: 430, y: 350, value: 6 },
    D1: { type: "leaf", x: 550, y: 350, value: 14 },
    D2: { type: "leaf", x: 610, y: 350, value: 5 },
    D3: { type: "leaf", x: 670, y: 350, value: 2 }
  };
  var ROOT = "A";
  var EDGE_LIST = [];
  Object.keys(NODES).forEach(function (id) {
    var n = NODES[id];
    if (n.children) n.children.forEach(function (cid) { EDGE_LIST.push([id, cid]); });
  });

  function fmt(v) { return v === Infinity ? "∞" : v === -Infinity ? "−∞" : String(v); }
  function ltr(s) { return '<span dir="ltr">' + s + "</span>"; }
  function clone(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }
  function cloneAB(ab) {
    var r = {};
    for (var k in ab) r[k] = ab[k] ? { alpha: ab[k].alpha, beta: ab[k].beta } : null;
    return r;
  }
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

  /* =====================================================================
     STEP ENGINE — real recursive alpha-beta (pruning=false ⇒ Minimax).
     Pseudocode reproduced verbatim from games2.md עמ' 17:
       MaxValue: val=max{val,MinValue(s,α,β)}; α=max{α,val}; if α≥β return.
       MinValue: val=min{val,MaxValue(s,α,β)}; β=min{β,val}; if β≤α return.
     ===================================================================== */
  function runSteps(pruning) {
    var val = {}, status = {}, ab = {}, pruneReasons = {};
    Object.keys(NODES).forEach(function (id) {
      var n = NODES[id];
      val[id] = n.type === "leaf" ? n.value : null;
      status[id] = "idle";
      ab[id] = null;
    });
    var steps = [];
    function snap(extra) {
      var s = {
        val: clone(val), status: clone(status), ab: cloneAB(ab),
        pruneReasons: clone(pruneReasons), mode: pruning ? "alphabeta" : "minimax"
      };
      for (var k in extra) s[k] = extra[k];
      steps.push(s);
    }

    function evalNode(id, alpha, beta) {
      var n = NODES[id];
      if (n.type === "leaf") {
        status[id] = "done";
        snap({
          activeId: id, kind: "leaf", childId: null,
          title: "עלה " + id + " — v=" + n.value,
          body: "מגיעים לעלה <b>" + ltr(id) + "</b> — מצב סיום עם " + ltr("Utility") +
            " קבוע: <b>" + n.value + "</b>. אין רקורסיה מתחת לעלה — הערך מוחזר ישר להורה."
        });
        return n.value;
      }
      var isMax = n.type === "max";
      status[id] = "active";
      val[id] = isMax ? -Infinity : Infinity;
      if (pruning) ab[id] = { alpha: alpha, beta: beta };
      snap({
        activeId: id, kind: "enter", childId: null,
        title: "נכנסים ל-" + id + " (" + (isMax ? "MAX" : "MIN") + ")",
        body: "צומת <b>" + ltr(id) + "</b> הוא " + ltr(isMax ? "MAX" : "MIN") + " — " +
          (isMax ? "ממקסם" : "ממזער") + " את ערכי בניו. מאתחלים " +
          ltr("v = " + (isMax ? "−∞" : "∞")) +
          (pruning ? " ומקבלים מההורה את החלון " + ltr("α=" + fmt(alpha) + ", β=" + fmt(beta)) + "." : ".")
      });

      var children = n.children;
      for (var i = 0; i < children.length; i++) {
        var cid = children[i];
        var cval = evalNode(cid, alpha, beta);
        var oldv = val[id];
        val[id] = isMax ? Math.max(val[id], cval) : Math.min(val[id], cval);
        var op = isMax ? "max" : "min";
        var updBody = "הבן <b>" + ltr(cid) + "</b> החזיר <b>" + cval + "</b>. מעדכנים ב-" + ltr(id) + ": " +
          ltr("v = " + op + "(" + fmt(oldv) + ", " + cval + ") = " + fmt(val[id])) + ".";
        if (pruning) {
          if (isMax) alpha = Math.max(alpha, val[id]); else beta = Math.min(beta, val[id]);
          ab[id] = { alpha: alpha, beta: beta };
          updBody += " " + (isMax ? ltr("α") : ltr("β")) + " מתעדכן יחד עם v: " +
            ltr((isMax ? "α=" : "β=") + fmt(isMax ? alpha : beta)) + ".";
        }
        var cutoff = pruning && (isMax ? alpha >= beta : beta <= alpha);
        var isLast = i === children.length - 1;
        if (cutoff && isLast) {
          updBody += " (התנאי " + ltr(isMax ? "α ≥ β" : "β ≤ α") +
            " מתקיים גם כאן — אבל זה הבן האחרון, אין יותר מה לגזום.)";
        }
        snap({ activeId: id, kind: "update", childId: cid, title: "עדכון " + id + " אחרי " + cid, body: updBody });

        if (cutoff && !isLast) {
          var rest = children.slice(i + 1);
          var cond = isMax ? ("α=" + fmt(alpha) + " ≥ β=" + fmt(beta))
                            : ("β=" + fmt(beta) + " ≤ α=" + fmt(alpha));
          var reason = cond + " — אין טעם להמשיך";
          var whyBody = isMax
            ? ("ה-MIN שמעל " + ltr(id) + " כבר לא ייתן ל-MAX ערך גדול יותר מ-" + ltr("β") +
               "; אין טעם ש-" + ltr(id) + " ימשיך לחפש ערך גבוה עוד יותר.")
            : ("ה-MAX שמעל " + ltr(id) + " כבר מובטח ב-" + ltr("α=" + fmt(alpha)) + " מענף קודם; " +
               ltr(id) + " כבר לא יכול להציע יותר מ-" + ltr("β=" + fmt(beta)) +
               ", אז זה בטוח לא ישפר את הבחירה של אביו.");
          rest.forEach(function (pid) { status[pid] = "pruned"; pruneReasons[pid] = reason; });
          snap({
            activeId: id, kind: "prune", childId: null, prunedIds: rest.slice(),
            title: "✂ גיזום מתחת ל-" + id,
            body: '<b style="color:var(--err)">גיזום!</b> ב-' + ltr(id) + ": " + ltr(cond) + " — אין טעם להמשיך. " +
              whyBody + " העלים <b>" + rest.map(function (r) { return ltr(r); }).join(", ") +
              "</b> נגזמים (✂) ולא נבדקים כלל."
          });
          break;
        }
      }
      status[id] = "done";
      snap({
        activeId: id, kind: "finalize", childId: null,
        title: "סיום " + id + " — v=" + fmt(val[id]),
        body: "כל בני <b>" + ltr(id) + "</b> נבדקו (או נגזמו) — הערך הסופי ננעל: " +
          ltr("v(" + id + ")=" + fmt(val[id])) + (id === ROOT ? "." : " מוחזר להורה.")
      });
      return val[id];
    }

    var rootVal = evalNode(ROOT, -Infinity, Infinity);
    var bestChild = NODES[ROOT].children.filter(function (c) { return val[c] === rootVal; })[0];
    var visitedLeaves = Object.keys(NODES).filter(function (id) { return NODES[id].type === "leaf" && status[id] === "done"; }).length;
    snap({
      activeId: null, kind: "done", childId: null,
      title: "האלגוריתם סיים",
      body: "התוצאה הסופית: " + ltr("Minimax(A) = " + fmt(rootVal)) + " — Max יבחר לעבור ל-<b>" +
        ltr(bestChild) + "</b>. " + (pruning
          ? ("נבדקו רק <b>" + visitedLeaves + "</b> מתוך 9 עלים (שניים — " + ltr("C2, C3") +
             " — נגזמו ולעולם לא נבדקו) — והתוצאה זהה במדויק ל-Minimax המלא.")
          : ("כל תשעת העלים נבדקו — במצב Minimax אין גיזום."))
    });
    return steps;
  }

  /* =====================================================================
     SCENE — hand-authored tree SVG (▲ MAX · ▽ MIN · ▢ leaf).
     ===================================================================== */
  var R = 30, LR = 22;
  function pointsUp(cx, cy) { return (cx) + "," + (cy - R) + " " + (cx - R * .9) + "," + (cy + R * .6) + " " + (cx + R * .9) + "," + (cy + R * .6); }
  function pointsDown(cx, cy) { return (cx) + "," + (cy + R) + " " + (cx - R * .9) + "," + (cy - R * .6) + " " + (cx + R * .9) + "," + (cy - R * .6); }

  function buildScene() {
    var W = 740, H = 420;
    var svg = se("svg", {
      viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", direction: "ltr",
      "aria-label": "עץ המשחק: שורש A (MAX) עם שלושה בני MIN B, C, D, כל אחד עם שלושה עלים"
    }, null);
    svg.style.cssText = "display:block;max-width:" + W + "px;margin:0 auto";

    var edgeRefs = {};
    EDGE_LIST.forEach(function (e) {
      var a = NODES[e[0]], b = NODES[e[1]];
      var line = se("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: "var(--line)", "stroke-width": 2, "stroke-linecap": "round" }, svg);
      edgeRefs[e[1]] = { line: line };
    });

    var nodeRefs = {};
    Object.keys(NODES).forEach(function (id) {
      var n = NODES[id];
      var g = se("g", {}, svg);
      var shape;
      if (n.type === "leaf") {
        shape = se("rect", { x: n.x - LR, y: n.y - LR, width: LR * 2, height: LR * 2, rx: 6, fill: "var(--surface)", stroke: "var(--line)", "stroke-width": 2 }, g);
      } else {
        var pts = n.type === "max" ? pointsUp(n.x, n.y) : pointsDown(n.x, n.y);
        shape = se("polygon", { points: pts, fill: "var(--surface)", stroke: "var(--line)", "stroke-width": 2, "stroke-linejoin": "round" }, g);
      }
      var idText = se("text", { x: n.x, y: n.y - (n.type === "leaf" ? 6 : 3), "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: "var(--ink-soft)" }, g);
      idText.textContent = id;
      var valText = se("text", { x: n.x, y: n.y + (n.type === "leaf" ? 13 : 16), "text-anchor": "middle", "font-size": n.type === "leaf" ? 15 : 14, "font-weight": 800, fill: "var(--ink)" }, g);
      valText.textContent = n.type === "leaf" ? String(n.value) : "?";

      var scissors = null, titleEl = null;
      if (n.type === "leaf") {
        scissors = se("text", { x: n.x + LR - 4, y: n.y - LR + 12, "text-anchor": "middle", "font-size": 15, fill: "var(--err)", opacity: 0 }, g);
        scissors.textContent = "✂";
        titleEl = se("title", {}, g);
      }
      var abChip = null;
      if (n.type !== "leaf") {
        var chipY = n.y - R - 16;
        var chipG = se("g", { opacity: 0 }, g);
        se("rect", { x: n.x - 40, y: chipY - 11, width: 80, height: 20, rx: 10, fill: "var(--surface-2)", stroke: "var(--line)" }, chipG);
        var chipText = se("text", { x: n.x, y: chipY + 4, "text-anchor": "middle", "font-size": 10.5, "font-weight": 700, fill: "var(--ink-soft)", direction: "ltr" }, chipG);
        abChip = { g: chipG, text: chipText };
      }
      nodeRefs[id] = { shape: shape, idText: idText, valText: valText, scissors: scissors, titleEl: titleEl, abChip: abChip };
    });
    return { svg: svg, nodeRefs: nodeRefs, edgeRefs: edgeRefs };
  }

  function applyScene(scene, step) {
    Object.keys(scene.edgeRefs).forEach(function (childId) {
      var er = scene.edgeRefs[childId];
      var st = step.status[childId];
      var color = "var(--line)", width = 2, dash = "none", opacity = 1;
      if (st === "done") { color = "color-mix(in srgb, var(--accent) 45%, var(--line))"; width = 2.4; }
      if (st === "pruned") { color = "var(--ink-soft)"; opacity = .38; dash = "4 3"; }
      if (step.activeId === childId || (step.kind === "update" && step.childId === childId)) { color = "var(--accent)"; width = 3; opacity = 1; }
      er.line.setAttribute("stroke", color);
      er.line.setAttribute("stroke-width", width);
      er.line.setAttribute("stroke-dasharray", dash);
      er.line.setAttribute("opacity", opacity);
    });
    Object.keys(NODES).forEach(function (id) {
      var n = NODES[id], ref = scene.nodeRefs[id], st = step.status[id];
      var fill = "var(--surface)", stroke = "var(--line)", sw = 2, opacity = 1;
      if (st === "active") { stroke = "var(--accent)"; sw = 3; fill = "color-mix(in srgb, var(--accent) 12%, var(--surface))"; }
      else if (st === "done") { stroke = "color-mix(in srgb, var(--accent) 50%, var(--line))"; }
      else if (st === "pruned") { stroke = "var(--ink-soft)"; fill = "color-mix(in srgb, var(--ink-soft) 14%, var(--surface))"; opacity = .5; }
      if (step.activeId === id) { stroke = "var(--accent)"; sw = 3.4; }
      ref.shape.setAttribute("fill", fill);
      ref.shape.setAttribute("stroke", stroke);
      ref.shape.setAttribute("stroke-width", sw);
      ref.shape.setAttribute("opacity", opacity);
      var v = step.val[id];
      ref.valText.textContent = n.type === "leaf" ? String(n.value) : (v == null ? "?" : fmt(v));
      ref.valText.setAttribute("fill", st === "pruned" ? "var(--ink-soft)" : (n.type !== "leaf" && st === "done" ? "var(--accent)" : "var(--ink)"));
      ref.valText.style.textDecoration = st === "pruned" ? "line-through" : "none";
      if (ref.scissors) ref.scissors.setAttribute("opacity", st === "pruned" ? 1 : 0);
      if (ref.titleEl) ref.titleEl.textContent = st === "pruned" ? ("נגזם: " + (step.pruneReasons[id] || "")) : "";
      if (ref.abChip) {
        var showAB = step.mode === "alphabeta" && n.type !== "leaf" && step.ab[id];
        ref.abChip.g.setAttribute("opacity", showAB ? 1 : 0);
        if (showAB) ref.abChip.text.textContent = "α=" + fmt(step.ab[id].alpha) + "  β=" + fmt(step.ab[id].beta);
      }
    });
  }

  var KIND_LABEL = { enter: "כניסה", leaf: "עלה", update: "עדכון", prune: "גיזום", finalize: "סיום צומת", done: "סיום" };
  var KIND_COLOR = { enter: "var(--accent)", leaf: "var(--ink-soft)", update: "var(--accent)", prune: "var(--err)", finalize: "var(--accent)", done: "var(--ok)" };

  /* =====================================================================
     Render one mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-abs-ready") === "1") return;
    mount.setAttribute("data-abs-ready", "1");
    mount.innerHTML = "";

    var wrap = ce("div", "viz-alphabeta-stepper", null);
    wrap.setAttribute("tabindex", "0");

    var modeRow = ce("div", "viz-controls abs-mode", wrap);
    var modeLbl = ce("span", "abs-mode-lbl", modeRow, "מצב:");
    var btnMM = mkBtn("Minimax (ללא גיזום)", function () { setMode("minimax"); });
    var btnAB = mkBtn("Alpha-Beta (עם גיזום)", function () { setMode("alphabeta"); });
    modeRow.appendChild(btnMM); modeRow.appendChild(btnAB);

    var sceneBox = ce("div", "abs-scene", wrap);
    var scene = buildScene();
    sceneBox.appendChild(scene.svg);

    var legend = ce("div", "abs-legend", wrap);
    legend.innerHTML =
      "<span>▲ MAX (מקסום)</span><span>▽ MIN (מזעור)</span><span>▢ עלה — Utility קבוע</span>" +
      '<span><b style="color:var(--accent)">מסגרת מודגשת</b> = הצומת הפעיל</span>' +
      '<span style="color:var(--ink-soft)">אפור מעומעם + ✂</span> = נגזם (Alpha-Beta בלבד)' +
      '<span>α/β מוצגים מעל הצומת (Alpha-Beta בלבד)</span>';

    var panel = ce("div", "abs-panel", wrap);
    panel.setAttribute("aria-live", "polite");

    var controls = ce("div", "viz-controls", wrap);
    var btnPrev = mkBtn("→ הקודם", function () { go(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { go(idx + 1); }); btnNext.classList.add("primary");
    var btnReset = mkBtn("↺ אתחול", function () { go(0); });
    controls.appendChild(btnPrev); controls.appendChild(btnNext); controls.appendChild(btnReset);
    var counter = ce("span", null, controls);
    counter.style.cssText = "margin-inline-start:auto;font-weight:700;color:var(--ink-soft);font-size:.85rem;align-self:center";

    mount.appendChild(wrap);

    function mkBtn(label, fn) {
      var b = ce("button", "viz-btn", null, label);
      b.type = "button";
      b.addEventListener("click", fn);
      return b;
    }

    var mode = "minimax", STEPS = [], idx = 0;

    function updatePanel(step) {
      panel.innerHTML =
        '<span class="abs-badge" style="background:' + KIND_COLOR[step.kind] + '">' + KIND_LABEL[step.kind] + "</span>" +
        "<b>" + step.title + "</b><div style='margin-top:6px'>" + step.body + "</div>";
    }
    function go(n) {
      idx = Math.max(0, Math.min(STEPS.length - 1, n));
      var step = STEPS[idx];
      applyScene(scene, step);
      updatePanel(step);
      counter.textContent = "שלב " + (idx + 1) + " / " + STEPS.length;
      btnPrev.disabled = idx === 0;
      btnNext.disabled = idx === STEPS.length - 1;
    }
    function setMode(m) {
      mode = m;
      STEPS = runSteps(m === "alphabeta");
      idx = 0;
      btnMM.classList.toggle("primary", m === "minimax");
      btnAB.classList.toggle("primary", m === "alphabeta");
      btnMM.setAttribute("aria-pressed", m === "minimax" ? "true" : "false");
      btnAB.setAttribute("aria-pressed", m === "alphabeta" ? "true" : "false");
      go(0);
    }

    wrap.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { go(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { go(idx + 1); e.preventDefault(); }
      else if (e.key === "Home") { go(0); e.preventDefault(); }
      else if (e.key === "End") { go(STEPS.length - 1); e.preventDefault(); }
    });

    setMode("minimax");
  }

  /* =====================================================================
     Scoped stylesheet — colours ONLY via CSS custom properties.
     ===================================================================== */
  function injectStyle() {
    var css =
      ".viz-alphabeta-stepper{direction:rtl}" +
      ".viz-alphabeta-stepper .abs-mode-lbl{font-weight:700;color:var(--ink);font-size:.85rem;align-self:center;margin-inline-end:.2rem}" +
      ".viz-alphabeta-stepper .abs-scene{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:8px 4px;margin-top:.4rem}" +
      ".viz-alphabeta-stepper .abs-legend{display:flex;flex-wrap:wrap;gap:.4rem 1.1rem;justify-content:center;margin-top:8px;font-size:.74rem;color:var(--ink-soft)}" +
      ".viz-alphabeta-stepper .abs-panel{margin-top:12px;background:var(--surface-2);border:1px solid var(--line);border-radius:var(--radius);" +
      "padding:12px 14px;min-height:96px;line-height:1.7;font-size:.9rem;color:var(--ink)}" +
      ".viz-alphabeta-stepper .abs-badge{display:inline-block;color:#fff;font-weight:700;font-size:.72rem;padding:2px 10px;border-radius:99px;margin-inline-end:8px}";
    var style = document.createElement("style");
    style.setAttribute("data-abs-style", "1");
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* =====================================================================
     boot — mount all instances; never throw; graceful if absent.
     ===================================================================== */
  function boot() {
    try {
      var mounts = document.querySelectorAll('[data-viz="' + VIZ_ID + '"]');
      if (!mounts || !mounts.length) return;
      if (!document.querySelector("style[data-abs-style]")) injectStyle();
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
