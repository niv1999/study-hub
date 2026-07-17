/* =====================================================================
   map-coloring-lab.js — Module 07-csp "בעיות סיפוק אילוצים — ניסוח ו-Backtracking"
   Grounded in _notes/csp1-part1.md (עמ' 4,7,8,31-35), csp1-part2.md
   (עמ' 48-52 Forward Checking) and csp2.md — the LECTURER'S exact map:

     Variables : WA, NT, Q, SA, NSW, V, T   (Western Australia … Tasmania)
     Domain    : {red, green, blue}  per variable
     Constraints (9, exactly the deck's list):
       WA≠NT, WA≠SA, NT≠SA, NT≠Q, SA≠Q, SA≠NSW, SA≠V, Q≠NSW, NSW≠V
     T (Tasmania) is an isolated vertex — no constraints at all (עמ' 335/561).
     Canonical solution (עמ' 8): WA=red, NT=green, Q=red, NSW=green, V=red,
     SA=blue, T=green.

   AUTO MODE — a single generic backtracking engine (variable order fixed
   as WA,NT,Q,SA,NSW,V,T — SA right after Q, exactly so the dead-end lands
   on SA the way the deck's trace does) reproduces BOTH:
     • plain Backtracking (עמ' 31-35): WA=red → NT=green → Q=blue is tried
       first and only fails once we reach SA (its domain has no legal
       colour left) → backtrack → Q=red → clean run to the canonical
       solution.
     • Forward Checking (עמ' 48-52 idea): the SAME Q=blue wrong turn is
       caught the instant Q is assigned — pruning empties SA's domain
       right there, one full level earlier than plain backtracking finds
       out. Toggling the FC checkbox re-runs the identical search and lets
       students see FC "fail faster" on the exact same mistake.
   Both traces are produced by actually RUNNING the algorithm (see
   buildTrace), never hand-scripted, so the UI can never drift from the
   semantics — matching bfs-dfs-explorer.js / dijkstra-stepper.js house
   style. Colours are mapped onto the site's own accent tokens (never
   hardcoded hex): clay≈red, sage≈green, dusty-blue≈blue.

   MANUAL MODE: click a region to cycle ∅→red→green→blue→∅; conflicting
   neighbours (same colour, sharing a constraint) pulse red immediately.

   Self-contained IIFE. Vanilla DOM + inline SVG (edges only — regions are
   real <button> elements for keyboard access). Never throws; no-op if no
   mount. RTL Hebrew chrome, LTR map/labels inside.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "map-coloring-lab";
  var SVGNS = "http://www.w3.org/2000/svg";

  var VARS = ["WA", "NT", "Q", "SA", "NSW", "V", "T"];
  var FULL_HE = {
    WA: "אוסטרליה המערבית", NT: "הטריטוריה הצפונית", Q: "קווינסלנד",
    SA: "אוסטרליה הדרומית", NSW: "ניו סאות' ויילס", V: "ויקטוריה", T: "טסמניה"
  };
  var ADJ = {
    WA: ["NT", "SA"], NT: ["WA", "SA", "Q"], Q: ["NT", "SA", "NSW"],
    SA: ["WA", "NT", "Q", "NSW", "V"], NSW: ["SA", "Q", "V"],
    V: ["SA", "NSW"], T: []
  };
  var EDGES = [
    ["WA", "NT"], ["WA", "SA"], ["NT", "SA"], ["NT", "Q"], ["SA", "Q"],
    ["SA", "NSW"], ["SA", "V"], ["Q", "NSW"], ["NSW", "V"]
  ];
  /* selection order for backtracking — SA immediately after Q so the dead
     end lands exactly where the deck's trace shows it (עמ' 34) */
  var ORDER = ["WA", "NT", "Q", "SA", "NSW", "V", "T"];
  /* per-variable value TRY order. Q tries blue before red on purpose —
     that's the deck's illustrated wrong turn; everyone else is R,G,B;
     T (unconstrained) tries green first to land on the deck's own
     solution (T=green) at the end. */
  var TRY_ORDER = {
    WA: ["R", "G", "B"], NT: ["R", "G", "B"], Q: ["B", "R", "G"],
    SA: ["R", "G", "B"], NSW: ["R", "G", "B"], V: ["R", "G", "B"],
    T: ["G", "R", "B"]
  };
  var FULL = ["R", "G", "B"];
  var COLOR_VAR = { R: "var(--clay)", G: "var(--sage)", B: "var(--dusty-blue)" };
  var COLOR_HE = { R: "אדום", G: "ירוק", B: "כחול" };

  /* schematic layout (viewBox units) — loosely mirrors real AU geography,
     which is exactly why the constraint list above matches real borders */
  var POS = {
    WA: { x: 20, y: 50, w: 160, h: 280 }, NT: { x: 200, y: 20, w: 140, h: 150 },
    Q: { x: 360, y: 10, w: 130, h: 210 }, SA: { x: 200, y: 190, w: 140, h: 150 },
    NSW: { x: 360, y: 240, w: 130, h: 150 }, V: { x: 250, y: 400, w: 180, h: 60 },
    T: { x: 305, y: 475, w: 90, h: 35 }
  };
  var VBW = 500, VBH = 520;

  function el(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function centroid(v) { var p = POS[v]; return [p.x + p.w / 2, p.y + p.h / 2]; }
  function pct(v, total) { return (v / total * 100).toFixed(2) + "%"; }

  /* =====================================================================
     STEP ENGINE — really runs Backtracking (+ optional Forward Checking).
     ===================================================================== */
  function buildTrace(fc) {
    var assign = {}, domains = {};
    VARS.forEach(function (v) { assign[v] = null; domains[v] = { R: true, G: true, B: true }; });
    var steps = [];

    function snap(extra) {
      var a = {}, d = {};
      VARS.forEach(function (v) {
        a[v] = assign[v];
        d[v] = { R: domains[v].R, G: domains[v].G, B: domains[v].B };
      });
      var s = { assign: a, domains: d };
      for (var k in extra) s[k] = extra[k];
      steps.push(s);
    }
    function consistent(v, color) {
      return ADJ[v].every(function (n) { return assign[n] !== color; });
    }
    function prune(v, color) {
      var removed = [];
      ADJ[v].forEach(function (n) {
        if (assign[n] == null && domains[n][color]) { domains[n][color] = false; removed.push(n); }
      });
      return removed;
    }
    function restore(removed, color) { removed.forEach(function (n) { domains[n][color] = true; }); }
    function wipeoutNeighbor(v) {
      var found = null;
      ADJ[v].some(function (n) {
        if (assign[n] == null && !domains[n].R && !domains[n].G && !domains[n].B) { found = n; return true; }
        return false;
      });
      return found;
    }

    snap({ type: "init" });

    function backtrack(i) {
      if (i === ORDER.length) { snap({ type: "solution" }); return true; }
      var v = ORDER[i];
      var cands = TRY_ORDER[v].filter(function (c) { return domains[v][c]; });
      if (!cands.length) { snap({ type: "nodomain", v: v }); return false; }
      for (var ci = 0; ci < cands.length; ci++) {
        var color = cands[ci];
        if (!consistent(v, color)) { snap({ type: "reject", v: v, color: color }); continue; }
        assign[v] = color;
        var removed = fc ? prune(v, color) : [];
        snap({ type: "assign", v: v, color: color });
        var wv = fc ? wipeoutNeighbor(v) : null;
        if (wv) {
          snap({ type: "wipeout", v: v, color: color, neighbor: wv });
          restore(removed, color);
          assign[v] = null;
          snap({ type: "backtrack", v: v, color: color });
          continue;
        }
        if (backtrack(i + 1)) return true;
        if (fc) restore(removed, color);
        assign[v] = null;
        snap({ type: "backtrack", v: v, color: color });
      }
      snap({ type: "deadend", v: v });
      return false;
    }
    backtrack(0);
    return steps;
  }

  /* =====================================================================
     Narration per step (Hebrew, references the real pseudocode terms).
     ===================================================================== */
  function narrate(step) {
    var v = step.v, color = step.color, badge = "", badgeVar = "var(--accent)", title = "", body = "";
    if (step.type === "init") {
      badge = "התחלה"; title = "אתחול — השמה ריקה";
      body = "כל שבעת המשתנים (<span dir=\"ltr\">WA, NT, Q, SA, NSW, V, T</span>) עדיין ללא ערך. " +
        "תחום כל אחד: <span dir=\"ltr\">{red, green, blue}</span>. הבחירה הבאה: <b dir=\"ltr\">" + ORDER[0] + "</b>.";
    } else if (step.type === "assign") {
      badge = "השמה"; badgeVar = "var(--sage)";
      title = v + " = " + COLOR_HE[color];
      body = "בוחרים את <b dir=\"ltr\">" + v + "</b> (המשתנה הבא, <span dir=\"ltr\">SelectUnassignedVariable</span>) " +
        "ומנסים <b>" + COLOR_HE[color] + "</b> — עקבי מול כל השכנים שכבר הושמו." +
        (step.fc ? " מפעילים <span dir=\"ltr\">Forward Checking</span>: מוחקים " + COLOR_HE[color] +
          " מתחומי השכנים שטרם הושמו." : "");
    } else if (step.type === "reject") {
      badgeVar = "var(--err)"; badge = "קונפליקט";
      var who = ADJ[v].filter(function (n) { return step.assign[n] === color; });
      title = v + " ≠ " + COLOR_HE[color];
      body = "הערך <b>" + COLOR_HE[color] + "</b> עבור <b dir=\"ltr\">" + v + "</b> מפר אילוץ שכנות מול <b dir=\"ltr\">" +
        who.join(", ") + "</b> (שכבר קיבל/ו אותו צבע) — עוברים לערך הבא בתחום.";
    } else if (step.type === "wipeout") {
      badgeVar = "var(--err)"; badge = "תחום התרוקן!";
      title = "Forward Checking מזהה כישלון מוקדם";
      body = "אחרי השמת <b dir=\"ltr\">" + v + " = " + color + "</b>, התחום של <b dir=\"ltr\">" + step.neighbor +
        "</b> התרוקן לגמרי (∅) — לא נותר לו אף ערך חוקי. נסוגים <u>מיד</u>, בלי אפילו לנסות להשים ל-" +
        "<span dir=\"ltr\">" + step.neighbor + "</span>.";
    } else if (step.type === "backtrack") {
      badgeVar = "var(--clay)"; badge = "נסיגה";
      title = "Backtrack — מבטלים " + v + "=" + COLOR_HE[color];
      body = "מסירים את ההשמה <span dir=\"ltr\">" + v + "=" + color + "</span>" +
        (step.fc ? " ומשחזרים את התחומים שנמחקו" : "") + ", וממשיכים לנסות ערך אחר עבור <b dir=\"ltr\">" + v + "</b>.";
    } else if (step.type === "deadend" || step.type === "nodomain") {
      badgeVar = "var(--err)"; badge = "מבוי סתום";
      title = "כל הערכים של " + v + " נכשלו";
      body = "אף ערך בתחום של <b dir=\"ltr\">" + v + "</b> אינו עקבי עם ההשמה הנוכחית — נסוגים למשתנה הקודם.";
    } else if (step.type === "solution") {
      badgeVar = "var(--ok)"; badge = "פתרון!";
      title = "השמה מלאה וחוקית";
      var parts = VARS.map(function (x) { return x + "=" + step.assign[x]; });
      body = "כל שבעת המשתנים קיבלו ערך ואף אילוץ לא מופר: <span dir=\"ltr\">" + parts.join(", ") +
        "</span>. זו בדיוק ההשמה מהשקף (עמ' 8), עד כדי הצבע של <span dir=\"ltr\">T</span> (שאינה מוגבלת בכלל).";
    }
    return { badge: badge, badgeVar: badgeVar, title: title, body: body };
  }

  /* =====================================================================
     STYLE (scoped, theme tokens only)
     ===================================================================== */
  var STYLE_ID = "mcl-style";
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      ".viz-map-coloring-lab{direction:rtl}" +
      ".mcl-legend{display:flex;flex-wrap:wrap;gap:.6rem 1.1rem;align-items:center;margin-bottom:.8rem;font-size:.82rem;color:var(--ink-soft)}" +
      ".mcl-swatch{width:13px;height:13px;border-radius:4px;display:inline-block;margin-inline-end:.3rem;vertical-align:-2px;border:1px solid var(--line)}" +
      ".mcl-hint{font-size:.85rem;color:var(--ink-soft);margin:.3rem 0 .8rem}" +
      ".mcl-mapwrap{position:relative;width:100%;max-width:480px;margin:0 auto;aspect-ratio:" + VBW + "/" + VBH + ";direction:ltr}" +
      ".mcl-edges{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}" +
      ".mcl-region{position:absolute;box-sizing:border-box;border:2px solid var(--line);border-radius:16px;background:var(--surface-2);" +
      "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;font-family:inherit;padding:2px;" +
      "transition:background .25s ease,border-color .2s ease,box-shadow .2s ease,opacity .2s ease}" +
      ".mcl-region:disabled{cursor:default}" +
      ".mcl-region .abbr{font-weight:800;font-size:clamp(.68rem,3.4vw,1.05rem);direction:ltr;line-height:1}" +
      ".mcl-region.is-current{box-shadow:0 0 0 3px var(--accent)}" +
      ".mcl-region.is-conflict,.mcl-region.is-wipeout{animation:mcl-flash .5s ease 2;border-color:var(--err)}" +
      ".mcl-region.is-backtrack{opacity:.55}" +
      ".mcl-region.is-solved{box-shadow:0 0 0 3px var(--ok)}" +
      "@keyframes mcl-flash{0%,100%{box-shadow:0 0 0 3px var(--err)}50%{box-shadow:0 0 0 6px var(--err)}}" +
      ".mcl-dots{display:flex;gap:3px}" +
      ".mcl-dot{width:8px;height:8px;border-radius:50%;border:1px solid var(--line);transition:opacity .2s ease}" +
      ".mcl-dot.removed{opacity:.12}" +
      ".mcl-names{font-size:.76rem;color:var(--ink-soft);margin-top:.7rem;line-height:1.6}" +
      ".mcl-status{margin-top:.8rem;background:var(--surface-2);border:1px solid var(--line);border-radius:var(--radius-sm);padding:.6rem .9rem;font-size:.88rem;color:var(--ink)}" +
      ".mcl-status.is-solved{border-color:var(--ok);color:var(--ok);font-weight:700}" +
      ".mcl-panel{margin-top:.9rem;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);padding:.9rem 1rem;min-height:88px;line-height:1.65;font-size:.9rem;color:var(--ink)}" +
      ".mcl-panel .badge{display:inline-block;color:#fff;font-weight:700;font-size:.72rem;padding:2px 10px;border-radius:99px;margin-inline-end:8px}" +
      ".mcl-fc-row{display:flex;align-items:center;gap:.5rem;margin-top:.7rem;font-size:.88rem;color:var(--ink)}" +
      ".mcl-fc-row input{width:17px;height:17px;accent-color:var(--accent)}";
    document.head.appendChild(s);
  }

  /* =====================================================================
     Render one mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-mcl-ready") === "1") return;
    mount.setAttribute("data-mcl-ready", "1");
    mount.innerHTML = "";
    ensureStyle();

    var mode = "manual";      /* "manual" | "auto" */
    var fcOn = false;
    var manualAssign = {}; VARS.forEach(function (v) { manualAssign[v] = null; });
    var cycle = [null, "R", "G", "B"];
    var traces = { plain: buildTrace(false), fc: buildTrace(true) };
    traces.fc.forEach(function (s) { s.fc = true; });
    var idx = 0;

    var root = document.createElement("div");
    root.className = "viz-map-coloring-lab";
    root.setAttribute("tabindex", "0");
    root.style.outline = "none";

    /* legend */
    var legend = document.createElement("div");
    legend.className = "mcl-legend";
    legend.innerHTML =
      "<span><b>7 משתנים</b> · תחום <span dir=\"ltr\">{red, green, blue}</span> · 9 אילוצי שכנות</span>" +
      FULL.map(function (c) {
        return '<span><span class="mcl-swatch" style="background:' + COLOR_VAR[c] + '"></span>' + COLOR_HE[c] + "</span>";
      }).join("");
    root.appendChild(legend);

    /* mode toggle */
    var modeRow = document.createElement("div");
    modeRow.className = "viz-controls";
    var btnManual = mkBtn("✋ ידני — צביעה עצמית", function () { setMode("manual"); });
    var btnAuto = mkBtn("⚙ אוטומטי — Backtracking", function () { setMode("auto"); });
    modeRow.appendChild(btnManual); modeRow.appendChild(btnAuto);
    root.appendChild(modeRow);

    var hint = document.createElement("p");
    hint.className = "mcl-hint";
    root.appendChild(hint);

    /* map */
    var mapWrap = document.createElement("div");
    mapWrap.className = "mcl-mapwrap";
    var svg = el("svg", { viewBox: "0 0 " + VBW + " " + VBH, class: "mcl-edges", role: "presentation" });
    var edgeRefs = {};
    EDGES.forEach(function (e) {
      var c1 = centroid(e[0]), c2 = centroid(e[1]);
      var line = el("line", { x1: c1[0], y1: c1[1], x2: c2[0], y2: c2[1], stroke: "var(--line)", "stroke-width": 2 });
      svg.appendChild(line);
      edgeRefs[e[0] + "-" + e[1]] = line;
    });
    mapWrap.appendChild(svg);

    var regionRefs = {};
    VARS.forEach(function (v) {
      var p = POS[v];
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mcl-region";
      btn.style.left = pct(p.x, VBW); btn.style.top = pct(p.y, VBH);
      btn.style.width = pct(p.w, VBW); btn.style.height = pct(p.h, VBH);
      var abbr = document.createElement("span");
      abbr.className = "abbr"; abbr.textContent = v;
      var dots = document.createElement("span");
      dots.className = "mcl-dots";
      FULL.forEach(function (c) {
        var d = document.createElement("span");
        d.className = "mcl-dot"; d.style.background = COLOR_VAR[c];
        dots.appendChild(d);
      });
      btn.appendChild(abbr); btn.appendChild(dots);
      btn.addEventListener("click", function () { onRegionClick(v); });
      mapWrap.appendChild(btn);
      regionRefs[v] = { btn: btn, dots: dots.children };
    });
    root.appendChild(mapWrap);

    var names = document.createElement("p");
    names.className = "mcl-names";
    names.innerHTML = VARS.map(function (v) { return '<span dir="ltr">' + v + "</span>=" + FULL_HE[v]; }).join(" · ") +
      ". <span dir=\"ltr\">T</span> (טסמניה) אינה מופיעה באף אילוץ — מנותקת לגמרי.";
    root.appendChild(names);

    /* manual status */
    var status = document.createElement("div");
    status.className = "mcl-status";
    root.appendChild(status);

    /* FC checkbox (auto mode only) */
    var fcRow = document.createElement("label");
    fcRow.className = "mcl-fc-row";
    var fcInput = document.createElement("input");
    fcInput.type = "checkbox"; fcInput.id = "mcl-fc-" + Math.random().toString(36).slice(2);
    fcInput.addEventListener("change", function () { fcOn = fcInput.checked; idx = 0; renderAuto(); });
    var fcTxt = document.createElement("span");
    fcTxt.textContent = "Forward Checking — צמצום תחומים בזמן אמת";
    fcRow.appendChild(fcInput); fcRow.appendChild(fcTxt);
    fcRow.htmlFor = fcInput.id;
    root.appendChild(fcRow);

    /* step panel (auto mode) */
    var panel = document.createElement("div");
    panel.className = "mcl-panel";
    panel.setAttribute("aria-live", "polite");
    root.appendChild(panel);

    /* stepper controls (auto mode) */
    var stepRow = document.createElement("div");
    stepRow.className = "viz-controls";
    var btnPrev = mkBtn("→ הקודם", function () { go(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { go(idx + 1); });
    btnNext.classList.add("primary");
    var counter = document.createElement("span");
    counter.style.cssText = "margin-inline-start:auto;font-size:.82rem;font-weight:700;color:var(--ink-soft);align-self:center";
    stepRow.appendChild(btnPrev); stepRow.appendChild(btnNext); stepRow.appendChild(counter);
    root.appendChild(stepRow);

    /* reset (both modes) */
    var resetRow = document.createElement("div");
    resetRow.className = "viz-controls";
    var btnReset = mkBtn("↺ אתחול", function () { if (mode === "manual") resetManual(); else go(0); });
    resetRow.appendChild(btnReset);
    root.appendChild(resetRow);

    mount.appendChild(root);

    function mkBtn(label, fn) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "viz-btn";
      b.textContent = label;
      b.addEventListener("click", fn);
      return b;
    }

    /* ---------------- manual mode ---------------- */
    function onRegionClick(v) {
      if (mode !== "manual") return;
      var cur = cycle.indexOf(manualAssign[v]);
      manualAssign[v] = cycle[(cur + 1) % cycle.length];
      applyManual();
    }
    function resetManual() {
      VARS.forEach(function (v) { manualAssign[v] = null; });
      applyManual();
    }
    function applyManual() {
      var conflictSet = {};
      EDGES.forEach(function (e) {
        var a = e[0], b = e[1];
        var bad = manualAssign[a] && manualAssign[a] === manualAssign[b];
        edgeRefs[a + "-" + b].setAttribute("stroke", bad ? "var(--err)" : "var(--line)");
        edgeRefs[a + "-" + b].setAttribute("stroke-width", bad ? 3.5 : 2);
        if (bad) { conflictSet[a] = true; conflictSet[b] = true; }
      });
      var colored = 0;
      VARS.forEach(function (v) {
        var ref = regionRefs[v], color = manualAssign[v];
        ref.btn.classList.remove("is-conflict");
        if (color) colored++;
        ref.btn.style.background = color ? COLOR_VAR[color] : "var(--surface-2)";
        ref.btn.style.color = color ? "#fff" : "var(--ink)";
        if (ref.dots.length) ref.dots[0].parentElement.style.display = "none"; /* dots hidden in manual mode */
        ref.btn.setAttribute("aria-label", FULL_HE[v] + " — " + (color ? COLOR_HE[color] : "לא צבוע"));
        if (conflictSet[v]) {
          ref.btn.classList.remove("is-conflict"); void ref.btn.offsetWidth;
          ref.btn.classList.add("is-conflict");
        }
      });
      var nConflict = Object.keys(conflictSet).length;
      if (colored === VARS.length && nConflict === 0) {
        status.className = "mcl-status is-solved";
        status.textContent = "✓ כל 7 האזורים צבועים ואף אילוץ לא מופר — פתרון תקין!";
      } else {
        status.className = "mcl-status";
        status.textContent = colored + "/7 אזורים צבועים" + (nConflict ? " · " + nConflict + " בקונפליקט" : "") +
          " — לחצו על אזור כדי לצבוע אותו (∅→אדום→ירוק→כחול→∅).";
      }
    }

    /* ---------------- auto mode ---------------- */
    function currentTrace() { return fcOn ? traces.fc : traces.plain; }

    function renderAuto() {
      var steps = currentTrace();
      idx = Math.max(0, Math.min(idx, steps.length - 1));
      go(idx);
    }

    function go(n) {
      var steps = currentTrace();
      idx = Math.max(0, Math.min(steps.length - 1, n));
      var step = steps[idx];
      applyAuto(step);
      counter.textContent = "צעד " + (idx + 1) + " / " + steps.length;
      btnPrev.disabled = idx === 0;
      btnNext.disabled = idx === steps.length - 1;
    }

    function edgeAutoColor(a, b, step) {
      if (step.type === "reject" && (a === step.v || b === step.v)) {
        var other = a === step.v ? b : a;
        if (step.assign[other] === step.color) return "var(--err)";
      }
      if (step.type === "wipeout") {
        if ((a === step.v && b === step.neighbor) || (b === step.v && a === step.neighbor)) return "var(--err)";
      }
      if (step.assign[a] && step.assign[a] === step.assign[b]) return "var(--err)";
      return "var(--line)";
    }

    function applyAuto(step) {
      EDGES.forEach(function (e) {
        var a = e[0], b = e[1], col = edgeAutoColor(a, b, step);
        var line = edgeRefs[a + "-" + b];
        line.setAttribute("stroke", col);
        line.setAttribute("stroke-width", col === "var(--line)" ? 2 : 3.5);
      });
      VARS.forEach(function (v) {
        var ref = regionRefs[v], color = step.assign[v];
        ref.btn.classList.remove("is-current", "is-conflict", "is-wipeout", "is-backtrack", "is-solved");
        ref.btn.style.background = color ? COLOR_VAR[color] : "var(--surface-2)";
        ref.btn.style.color = color ? "#fff" : "var(--ink)";
        var dotsWrap = ref.dots.length ? ref.dots[0].parentElement : null;
        if (dotsWrap) {
          if (fcOn && !color) {
            dotsWrap.style.display = "flex";
            FULL.forEach(function (c, i) {
              var d = ref.dots[i];
              d.style.background = COLOR_VAR[c];
              d.classList.toggle("removed", !step.domains[v][c]);
            });
          } else {
            dotsWrap.style.display = "none";
          }
        }
        if (v === step.v) {
          ref.btn.classList.add("is-current");
          if (step.type === "reject") { void ref.btn.offsetWidth; ref.btn.classList.add("is-conflict"); }
          if (step.type === "backtrack") ref.btn.classList.add("is-backtrack");
        }
        if (step.type === "wipeout" && v === step.neighbor) {
          void ref.btn.offsetWidth; ref.btn.classList.add("is-wipeout");
        }
        if (step.type === "solution") ref.btn.classList.add("is-solved");
        ref.btn.setAttribute("aria-label", FULL_HE[v] + " — " + (color ? COLOR_HE[color] : "לא צבוע"));
      });
      var n = narrate(step);
      panel.innerHTML = '<span class="badge" style="background:' + n.badgeVar + '">' + n.badge + "</span>" +
        "<b>" + n.title + "</b><div style=\"margin-top:.4rem\">" + n.body + "</div>";
    }

    /* ---------------- mode switch ---------------- */
    function setMode(m) {
      mode = m;
      btnManual.classList.toggle("primary", m === "manual");
      btnAuto.classList.toggle("primary", m === "auto");
      btnManual.setAttribute("aria-pressed", m === "manual" ? "true" : "false");
      btnAuto.setAttribute("aria-pressed", m === "auto" ? "true" : "false");
      var isAuto = m === "auto";
      fcRow.style.display = isAuto ? "flex" : "none";
      panel.style.display = isAuto ? "block" : "none";
      stepRow.style.display = isAuto ? "flex" : "none";
      status.style.display = isAuto ? "none" : "block";
      hint.textContent = isAuto
        ? "צפו ב-Backtracking צועד-צעד על מפת הדוגמה מההרצאה; סמנו את התיבה כדי לראות איך Forward Checking תופס את אותה טעות מוקדם יותר."
        : "לחצו על אזור במפה כדי לצבוע אותו (∅→אדום→ירוק→כחול→∅). שני אזורים שכנים באותו צבע יהבהבו באדום.";
      VARS.forEach(function (v) {
        regionRefs[v].btn.tabIndex = 0;
        regionRefs[v].btn.style.cursor = isAuto ? "default" : "pointer";
      });
      if (isAuto) { idx = 0; go(0); } else { resetManual(); }
    }

    /* keyboard: RTL-aware (Right = prev, Left = next), auto mode only */
    root.addEventListener("keydown", function (e) {
      if (mode !== "auto") return;
      if (e.key === "ArrowRight") { go(idx - 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { go(idx + 1); e.preventDefault(); }
      else if (e.key === "Home") { go(0); e.preventDefault(); }
      else if (e.key === "End") { go(currentTrace().length - 1); e.preventDefault(); }
    });

    /* initial */
    setMode("manual");
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
