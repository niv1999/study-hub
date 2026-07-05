/* =====================================================================
   quicksort-pivot-race.js  —  Module 13 "אלגוריתמים אקראיים"
   Grounded in _notes/12-randomized.md — Randomized QuickSort.

   THE EXACT LECTURE EXAMPLE (עמ' 10–21):
     S = {7, 5, 2, 8, 9, 1, 4, 6},  n = 8
     Randomized run (the slide's random bits → positions, 0-based):
       100→pos4→pivot 9 ;  010→pos2→pivot 2 ;  001→pos1→pivot 5 ;  00→pos0→pivot 7
       ⇒ pivots in pre-order: 9, 2, 5, 7 ; 19 comparisons ; sorted → {1,2,4,5,6,7,8,9}
     Scheme (עמ' 7): pick pivot y∈S, S₁={x<y}, S₂={x>y}, recurse, return ⟨S₁,y,S₂⟩.
     Comparisons per partition = (size − 1)  (pivot compared to each other element).
     E[#comparisons] = O(n log n)  (עמ' 38).

   THE RACE (heroViz spec):
     Two QuickSort strategies race on the SAME set of 8 numbers:
       • "ציר גרוע קבוע"  — pivot is ALWAYS the first element (deterministic).
       • "ציר אקראי"      — Randomized QuickSort (the lecture's run by default).
     Two inputs let the student expose the lesson of the cluster
     ("No more good or bad inputs, only good or bad luck"):
       • כמו בהרצאה : {7,5,2,8,9,1,4,6}  — the fixed pivot happens to do fine (14).
       • ממוין      : {1,2,4,5,6,7,8,9}  — the fixed pivot degenerates to an O(n²)
                        spine (28 comparisons, depth 8); the random pivot stays O(n log n).
     Live bookkeeping (the pedagogy): #comparisons counter, recursion depth,
     #partitions, and the growing recursion trace per lane, with a race bar.

   Self-contained IIFE. Hand-authored DOM in cream design tokens (CONTRACT §2).
   RTL Hebrew UI; English/LTR identifiers & numbers isolated. Works file:// and
   over a static server. Graceful if no mount; never throws to the console.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "quicksort-pivot-race";

  /* --- design palette (hardcoded per CONTRACT §2) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",
    clay: "#BE7C5E",   /* bad-pivot lane / alert */
    sage: "#7C9885",   /* random lane / success / sorted result */
    mustard: "#C9A24B",
    rose: "#BE7C8F"    /* unit-7 accent (אלגוריתמים אקראיים) — matches --rose token */
  };

  /* --- the lecture data --- */
  var INPUTS = {
    lecture: { arr: [7, 5, 2, 8, 9, 1, 4, 6], label: "כמו בהרצאה" },
    sorted:  { arr: [1, 2, 4, 5, 6, 7, 8, 9], label: "ממוין (worst-case לציר קבוע)" }
  };
  /* default randomized pivots (by value, pre-order):
     lecture = the slide's exact run 9,2,5,7 ; sorted = a balanced example run. */
  var DEFAULT_PICKS = {
    lecture: [9, 2, 5, 7],
    sorted:  [5, 2, 8, 6]
  };

  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function setStr(a) {
    return a.length ? "{" + a.join(", ") + "}" : "∅";
  }

  /* =====================================================================
     Build a full QuickSort run and record every partition node in PRE-ORDER
     (root, then S₁ subtree, then S₂ subtree) — exactly the order the lecture
     grows the recursion tree. chooser(vals) → index of the pivot inside vals.
     Returns { rows, maxDepth, totalComps, sorted }.
     ===================================================================== */
  function buildRun(values, chooser) {
    var rows = [], maxDepth = 0, total = 0, step = 0;

    function rec(vals, depth) {
      if (vals.length <= 1) return vals.slice();       /* leaf (already sorted) */
      var pi = chooser(vals);
      if (pi < 0 || pi >= vals.length) pi = 0;         /* safety clamp */
      var pivot = vals[pi];
      var s1 = vals.filter(function (x) { return x < pivot; });
      var s2 = vals.filter(function (x) { return x > pivot; });
      var comps = vals.length - 1;                      /* pivot vs each other */
      total += comps;
      step += 1;
      if (depth > maxDepth) maxDepth = depth;
      rows.push({
        step: step, depth: depth, values: vals.slice(),
        pivot: pivot, pi: pi, s1: s1, s2: s2, comps: comps, cum: total
      });
      var left = rec(s1, depth + 1);
      var right = rec(s2, depth + 1);
      return left.concat([pivot], right);
    }

    var sorted = rec(values.slice(), 0);
    return { rows: rows, maxDepth: maxDepth, totalComps: total, sorted: sorted };
  }

  /* pivot choosers */
  function chooseFirst(vals) { return 0; }
  function chooseByValues(list) {
    var ptr = 0;
    return function (vals) {
      var v = list[ptr++];
      var idx = vals.indexOf(v);
      return idx === -1 ? Math.floor(vals.length / 2) : idx; /* fallback: median pos */
    };
  }
  function chooseRandom(vals) { return Math.floor(Math.random() * vals.length); }

  /* =====================================================================
     render one mount
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-qpr-ready") === "1") return;
    mount.setAttribute("data-qpr-ready", "1");
    mount.innerHTML = "";

    /* ---- session state ---- */
    var inputKey = "lecture";     /* 'lecture' | 'sorted' */
    var randMode = "default";     /* 'default' | 'random' */
    var idx = 0;                  /* current global step 0..N */
    var N = 0;
    var runBad, runRand;
    var autoTimer = null;

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");
    wrap.style.outline = "none";

    /* ---------- helpers ---------- */
    function mkBtn(html, fn, primary) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn" + (primary ? " primary" : "");
      b.innerHTML = html;
      b.addEventListener("click", fn);
      return b;
    }
    function pulse(node) {
      if (!node || reducedMotion() || !node.animate) return;
      node.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }],
        { duration: 260, easing: "ease-out" }
      );
    }

    /* ========== header ========== */
    var head = document.createElement("div");
    head.style.cssText = "margin-bottom:.7rem";
    head.innerHTML =
      '<div style="font-weight:800;font-size:1.02rem;color:' + C.ink + '">' +
        'מירוץ הצירים — <span dir="ltr">QuickSort</span>: ציר גרוע קבוע מול ציר אקראי' +
      '</div>' +
      '<div style="font-size:.82rem;color:' + C.inkSoft + ';margin-top:2px">' +
        'אותם 8 מספרים, שתי אסטרטגיות ל-<span dir="ltr">pivot</span>. סופרים ' +
        '<b>השוואות</b> ו<b>עומק רקורסיה</b> — "<span dir="ltr">No more good or bad inputs, only good or bad luck</span>".' +
      '</div>';
    wrap.appendChild(head);

    /* ========== top controls: input toggle + reshuffle ========== */
    var topRow = document.createElement("div");
    topRow.className = "viz-controls";
    topRow.style.marginTop = "0";
    var lblIn = document.createElement("span");
    lblIn.textContent = "קלט:";
    lblIn.style.cssText = "font-weight:700;color:" + C.ink + ";font-size:.88rem;align-self:center";
    topRow.appendChild(lblIn);
    var btnLec = mkBtn("כמו בהרצאה", function () { setInput("lecture"); });
    var btnSor = mkBtn("ממוין (worst-case)", function () { setInput("sorted"); });
    var btnShuffle = mkBtn('🎲 הגרל ציר אקראי מחדש', function () { reshuffle(); });
    btnShuffle.style.marginInlineStart = "auto";
    topRow.appendChild(btnLec);
    topRow.appendChild(btnSor);
    topRow.appendChild(btnShuffle);
    wrap.appendChild(topRow);

    /* ========== race bars ========== */
    var raceBox = document.createElement("div");
    raceBox.style.cssText =
      "background:" + C.surface2 + ";border:1px solid " + C.line + ";border-radius:12px;" +
      "padding:10px 14px;margin:.8rem 0";
    raceBox.innerHTML =
      '<div style="font-size:.8rem;font-weight:700;color:' + C.inkSoft +
      ';margin-bottom:6px">מירוץ ההשוואות (Number of Comparisons = X)</div>';
    function mkBar(name, accent) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;margin:5px 0";
      var lab = document.createElement("span");
      lab.innerHTML = name;
      lab.style.cssText = "font-size:.78rem;font-weight:700;color:" + accent +
        ";min-width:96px;text-align:start";
      var track = document.createElement("div");
      track.style.cssText = "flex:1;height:16px;background:" + C.surface +
        ";border:1px solid " + C.line + ";border-radius:8px;overflow:hidden";
      var fill = document.createElement("div");
      fill.style.cssText = "height:100%;width:0%;background:" + accent +
        ";border-radius:8px;transition:width .35s ease";
      track.appendChild(fill);
      var val = document.createElement("span");
      val.textContent = "0";
      val.style.cssText = "font:700 13px monospace;color:" + accent + ";min-width:28px;text-align:end";
      row.appendChild(lab); row.appendChild(track); row.appendChild(val);
      raceBox.appendChild(row);
      return { fill: fill, val: val };
    }
    var barRand = mkBar('ציר אקראי', C.sage);
    var barBad = mkBar('ציר גרוע קבוע', C.clay);
    wrap.appendChild(raceBox);

    /* ========== lanes ========== */
    var lanesRow = document.createElement("div");
    lanesRow.style.cssText =
      "display:flex;flex-wrap:wrap;gap:12px;align-items:stretch";
    wrap.appendChild(lanesRow);

    function mkLane(title, rule, accent) {
      var card = document.createElement("div");
      card.style.cssText =
        "flex:1 1 300px;min-width:270px;background:" + C.surface +
        ";border:1px solid " + C.line + ";border-radius:14px;overflow:hidden;display:flex;flex-direction:column";
      var hd = document.createElement("div");
      hd.style.cssText = "padding:9px 12px;border-bottom:1px solid " + C.line +
        ";background:" + C.surface2;
      hd.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<span style="width:11px;height:11px;border-radius:3px;background:' + accent + ';display:inline-block"></span>' +
          '<b style="color:' + C.ink + ';font-size:.92rem">' + title + '</b>' +
        '</div>' +
        '<div style="font-size:.75rem;color:' + C.inkSoft + ';margin-top:2px">' + rule + '</div>';
      card.appendChild(hd);

      var trace = document.createElement("div");
      trace.style.cssText =
        "padding:8px 10px;min-height:150px;max-height:280px;overflow:auto";
      card.appendChild(trace);

      var result = document.createElement("div");
      result.style.cssText = "padding:0 10px 6px;display:none";
      card.appendChild(result);

      var foot = document.createElement("div");
      foot.style.cssText =
        "margin-top:auto;padding:8px 12px;border-top:1px solid " + C.line +
        ";display:flex;gap:10px;flex-wrap:wrap;align-items:center;background:" + C.surface2;
      function stat(label) {
        var s = document.createElement("div");
        s.style.cssText = "display:flex;flex-direction:column;line-height:1.15";
        var v = document.createElement("span");
        v.style.cssText = "font:800 18px monospace;color:" + accent;
        v.textContent = "0";
        var l = document.createElement("span");
        l.textContent = label;
        l.style.cssText = "font-size:.68rem;color:" + C.inkSoft;
        s.appendChild(v); s.appendChild(l);
        foot.appendChild(s);
        return v;
      }
      var vComps = stat("השוואות");
      var vDepth = stat("עומק רקורסיה");
      var vParts = stat("חלוקות");
      var status = document.createElement("span");
      status.style.cssText =
        "margin-inline-start:auto;font-size:.72rem;font-weight:700;padding:3px 9px;border-radius:99px";
      foot.appendChild(status);
      card.appendChild(foot);

      lanesRow.appendChild(card);
      return {
        card: card, trace: trace, result: result, accent: accent,
        vComps: vComps, vDepth: vDepth, vParts: vParts, status: status,
        rowEls: []
      };
    }
    var laneRand = mkLane("ציר אקראי (Randomized QuickSort)",
      'ה-<span dir="ltr">pivot</span> נבחר <b>אקראית</b> — אלגוריתם Las-Vegas', C.sage);
    var laneBad = mkLane("ציר גרוע קבוע (Deterministic)",
      'ה-<span dir="ltr">pivot</span> הוא תמיד <b>האיבר הראשון</b>', C.clay);

    /* ========== explanation panel ========== */
    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.cssText =
      "background:" + C.surface2 + ";border:1px solid " + C.line + ";border-radius:12px;" +
      "padding:12px 14px;margin-top:.85rem;min-height:96px;color:" + C.ink +
      ";line-height:1.62;font-size:.88rem";
    wrap.appendChild(panel);

    /* ========== step controls ========== */
    var controls = document.createElement("div");
    controls.className = "viz-controls";
    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); go(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); go(idx + 1); }, true);
    var btnPlay = mkBtn("▶ הפעל", function () { toggleAuto(); });
    var btnReset = mkBtn("↺ איפוס", function () { stopAuto(); go(0); });
    var stepTag = document.createElement("span");
    stepTag.style.cssText = "align-self:center;font-size:.8rem;color:" + C.inkSoft +
      ";margin-inline-start:6px";
    controls.appendChild(btnPrev);
    controls.appendChild(btnNext);
    controls.appendChild(btnPlay);
    controls.appendChild(btnReset);
    controls.appendChild(stepTag);
    wrap.appendChild(controls);

    mount.appendChild(wrap);

    /* =====================================================================
       building the two runs + their DOM traces
       ===================================================================== */
    function chip(v, isPivot, accent) {
      var s = document.createElement("span");
      s.textContent = v;
      s.style.cssText =
        "display:inline-block;min-width:19px;text-align:center;padding:1px 5px;margin:0 2px;" +
        "border-radius:6px;font:600 12px/1.5 monospace;";
      if (isPivot) {
        s.style.background = accent; s.style.color = "#fff";
        s.style.boxShadow = "0 1px 3px rgba(0,0,0,.18)";
      } else {
        s.style.background = C.surface; s.style.color = C.ink;
        s.style.border = "1px solid " + C.line;
      }
      return s;
    }
    function buildTrace(lane, run) {
      lane.trace.innerHTML = "";
      lane.rowEls = run.rows.map(function (node) {
        var row = document.createElement("div");
        row.style.cssText =
          "display:flex;align-items:center;gap:4px;margin:4px 0;border-radius:7px;padding:2px 4px;" +
          "opacity:0;transform:translateY(4px);transition:opacity .3s ease, transform .3s ease, background .2s";
        row.style.paddingInlineStart = (8 + node.depth * 20) + "px";
        /* depth guide */
        var badge = document.createElement("span");
        badge.textContent = "d" + node.depth;
        badge.style.cssText = "font:700 10px monospace;color:" + C.inkSoft + ";min-width:19px";
        var chips = document.createElement("span");
        chips.dir = "ltr";
        chips.style.whiteSpace = "nowrap";
        node.values.forEach(function (v) {
          chips.appendChild(chip(v, v === node.pivot, lane.accent));
        });
        var plus = document.createElement("span");
        plus.textContent = "+" + node.comps;
        plus.style.cssText = "font:700 11px monospace;color:" + lane.accent + ";margin-inline-start:4px";
        row.appendChild(badge);
        row.appendChild(chips);
        row.appendChild(plus);
        lane.trace.appendChild(row);
        return row;
      });
      /* sorted result strip (revealed when lane finishes) */
      lane.result.innerHTML = "";
      var lbl = document.createElement("span");
      lbl.innerHTML = "ממוין → ";
      lbl.style.cssText = "font-size:.74rem;color:" + C.inkSoft + ";font-weight:700";
      var rchips = document.createElement("span");
      rchips.dir = "ltr";
      run.sorted.forEach(function (v) {
        var s = document.createElement("span");
        s.textContent = v;
        s.style.cssText =
          "display:inline-block;min-width:19px;text-align:center;padding:1px 5px;margin:0 2px;" +
          "border-radius:6px;font:700 12px/1.5 monospace;background:" + C.sage + ";color:#fff";
        rchips.appendChild(s);
      });
      lane.result.appendChild(lbl);
      lane.result.appendChild(rchips);
    }

    function buildAll() {
      var arr = INPUTS[inputKey].arr;
      runBad = buildRun(arr, chooseFirst);
      runRand = buildRun(arr,
        randMode === "random" ? chooseRandom : chooseByValues(DEFAULT_PICKS[inputKey].slice()));
      N = Math.max(runBad.rows.length, runRand.rows.length);
      buildTrace(laneRand, runRand);
      buildTrace(laneBad, runBad);
      /* toggle button states */
      btnLec.classList.toggle("primary", inputKey === "lecture");
      btnSor.classList.toggle("primary", inputKey === "sorted");
      btnLec.setAttribute("aria-pressed", inputKey === "lecture" ? "true" : "false");
      btnSor.setAttribute("aria-pressed", inputKey === "sorted" ? "true" : "false");
      idx = 0;
      go(0);
    }

    function setInput(k) {
      if (k === inputKey) return;
      stopAuto();
      inputKey = k;
      buildAll();
    }
    function reshuffle() {
      stopAuto();
      randMode = "random";
      buildAll();
    }

    /* =====================================================================
       render current step
       ===================================================================== */
    function laneStateAt(run, s) {
      var cum = 0, depth = -1, parts = 0, lastRow = null;
      run.rows.forEach(function (r) {
        if (r.step <= s) { cum = r.cum; parts += 1; if (r.depth > depth) depth = r.depth; if (r.step === s) lastRow = r; }
      });
      return { cum: cum, depth: depth, parts: parts, done: parts === run.rows.length, lastRow: lastRow };
    }

    function paintLane(lane, run, s, prevCum) {
      lane.rowEls.forEach(function (row, i) {
        var node = run.rows[i];
        var on = node.step <= s;
        row.style.opacity = on ? "1" : "0";
        row.style.transform = on ? "none" : "translateY(4px)";
        var active = node.step === s;
        row.style.background = active ? C.surface2 : "transparent";
        row.style.boxShadow = active ? "inset 2px 0 0 " + lane.accent : "none";
      });
      var st = laneStateAt(run, s);
      lane.vComps.textContent = st.cum;
      lane.vDepth.textContent = st.depth < 0 ? "0" : (st.depth + 1);
      lane.vParts.textContent = st.parts;
      if (st.cum !== prevCum) pulse(lane.vComps);
      /* status chip */
      if (st.parts === 0) {
        lane.status.textContent = "מוכן";
        lane.status.style.background = C.line;
        lane.status.style.color = C.inkSoft;
      } else if (st.done) {
        lane.status.textContent = "✓ הסתיים · " + run.totalComps + " השוואות";
        lane.status.style.background = C.sage;
        lane.status.style.color = "#fff";
      } else {
        lane.status.textContent = "בעבודה…";
        lane.status.style.background = C.mustard;
        lane.status.style.color = "#fff";
      }
      lane.result.style.display = st.done ? "block" : "none";
      /* keep the active row in view */
      if (st.lastRow && !reducedMotion()) {
        var el = lane.rowEls[st.lastRow.step - 1];
        if (el && el.scrollIntoView) {
          try { el.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {}
        }
      }
      return st;
    }

    var prevRand = 0, prevBad = 0;

    function go(n) {
      idx = Math.max(0, Math.min(N, n));
      var sr = paintLane(laneRand, runRand, idx, prevRand);
      var sb = paintLane(laneBad, runBad, idx, prevBad);
      prevRand = sr.cum; prevBad = sb.cum;

      /* race bars */
      var scale = Math.max(runRand.totalComps, runBad.totalComps, 1);
      barRand.fill.style.width = (100 * sr.cum / scale) + "%";
      barBad.fill.style.width = (100 * sb.cum / scale) + "%";
      barRand.val.textContent = sr.cum;
      barBad.val.textContent = sb.cum;

      renderPanel(idx, sr, sb);

      stepTag.textContent = "צעד " + idx + " / " + N;
      btnPrev.disabled = (idx === 0);
      btnNext.disabled = (idx === N);
    }

    function describe(row, isBad) {
      if (!row) return '<span style="color:' + C.inkSoft + '">— (הציר הזה כבר סיים)</span>';
      var rule = isBad ? "האיבר הראשון" : "אקראית";
      return 'נבחר <span dir="ltr">pivot y=<b>' + row.pivot + '</b></span> (' + rule +
        ') מתוך מערך בגודל ' + row.values.length +
        ' → <b>' + row.comps + '</b> השוואות; מחלק ל-<span dir="ltr">S₁=' + setStr(row.s1) +
        '</span> ו-<span dir="ltr">S₂=' + setStr(row.s2) + '</span>.';
    }

    function renderPanel(s, sr, sb) {
      if (s === 0) {
        var arr = INPUTS[inputKey].arr;
        panel.innerHTML =
          '<b style="color:' + C.rose + '">המערך המקורי: </b>' +
          '<span dir="ltr" style="font-family:monospace;font-weight:700">S = {' + arr.join(", ") + '}, n=8</span>. ' +
          'לחצו <b>הבא ←</b> כדי לבחור את ה-<span dir="ltr">pivot</span> הראשון בכל ציר. ' +
          'שני הצירים ממיינים את <b>אותם המספרים</b> — ההבדל הוא רק <b>איך בוחרים את הציר</b>.';
        return;
      }
      var rowR = sr.lastRow, rowB = sb.lastRow;
      var html =
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">' +
          '<span style="background:' + C.rose + ';color:#fff;font-weight:700;font-size:.72rem;' +
            'padding:2px 10px;border-radius:99px">צעד ' + s + '</span>' +
          '<b style="color:' + C.ink + '">מה קרה כרגע בכל ציר</b>' +
        '</div>' +
        '<div style="margin:3px 0"><span style="color:' + C.sage + ';font-weight:800">ציר אקראי: </span>' +
          describe(rowR, false) + '</div>' +
        '<div style="margin:3px 0"><span style="color:' + C.clay + ';font-weight:800">ציר גרוע: </span>' +
          describe(rowB, true) + '</div>';

      if (s === N) {
        var diff = runBad.totalComps - runRand.totalComps;
        var moral;
        if (inputKey === "sorted") {
          moral = 'על קלט <b>ממוין</b> הציר הקבוע קורס ל-<b>"מקל"</b> (spine) בעומק ' +
            (runBad.maxDepth + 1) + ' עם <b>' + runBad.totalComps + '</b> השוואות — זהו ה-worst case ' +
            '<span dir="ltr">Θ(n²)</span>. הציר האקראי נשאר מאוזן (<b>' + runRand.totalComps +
            '</b> השוואות) כי הוא <b>לא תלוי בסדר הקלט</b>.';
        } else {
          moral = 'על קלט זה שני הצירים מסתדרים יפה. אבל לציר הקבוע <b>יש</b> קלט גרוע — נסו את הכפתור ' +
            '<b>"ממוין"</b> וראו אותו מתרסק ל-<span dir="ltr">Θ(n²)</span>. לציר האקראי אין קלט גרוע.';
        }
        html +=
          '<div style="margin-top:9px;padding:9px 11px;border-radius:10px;background:' + C.surface +
            ';border:1px solid ' + C.line + ';border-inline-start:4px solid ' + C.rose + '">' +
            '<b style="color:' + C.rose + '">המסקנה: </b>' + moral +
            '<br><span style="font-size:.82rem;color:' + C.inkSoft + '">תוחלת מספר ההשוואות של ' +
            'Randomized QuickSort היא <span dir="ltr">E[X] = O(n log n)</span> — ' +
            '"<span dir="ltr">No more good or bad inputs, only good or bad luck</span>".</span>' +
          '</div>';
      }
      panel.innerHTML = html;
    }

    /* =====================================================================
       autoplay
       ===================================================================== */
    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      if (idx >= N) go(0);
      btnPlay.innerHTML = "⏸ השהה";
      btnPlay.classList.add("primary");
      var delay = reducedMotion() ? 1500 : 1100;
      autoTimer = setInterval(function () {
        if (idx >= N) { stopAuto(); return; }
        go(idx + 1);
      }, delay);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      btnPlay.innerHTML = "▶ הפעל";
      btnPlay.classList.remove("primary");
    }

    /* keyboard: RTL-aware (Right = prev, Left = next) */
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { stopAuto(); go(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { stopAuto(); go(idx + 1); e.preventDefault(); }
      else if (e.key === "Home") { stopAuto(); go(0); e.preventDefault(); }
      else if (e.key === "End") { stopAuto(); go(N); e.preventDefault(); }
    });

    /* initial build */
    buildAll();
  }

  /* =====================================================================
     boot: mount all instances (guard for already-ready). Never throw.
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
