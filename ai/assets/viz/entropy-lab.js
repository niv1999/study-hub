/* =====================================================================
   entropy-lab.js — Module 14 "למידה מפוקחת ועצי החלטה"
   Grounded in _notes/decision-trees-part1.md (עמ' 22–55) + part2 (עמ' 51–55):

   THE LECTURE DATASET (exact, verbatim) — the restaurant-waiting problem,
   12 training examples (AIMA), 10 attributes, © Russell & Norvig:
     Alt, Bar, Fri/Sat, Hungry, Patrons{None,Some,Full}, Price{$,$$,$$$},
     Raining, Reservation, Type{French,Italian,Thai,Burger},
     WaitEstimate{0–10,10–30,30–60,>60}  →  WillWait (6 Yes / 6 No).

   Formulas reproduced exactly (עמ' 44, 49, 54 / summary עמ' 99):
     I(p/(p+n), n/(p+n)) = −[p/(p+n)]·log2[p/(p+n)] − [n/(p+n)]·log2[n/(p+n)]
     remainder(A)        = Σ_i [(p_i+n_i)/(p+n)] · I(p_i/(p_i+n_i), n_i/(p_i+n_i))
     IG(A)                = I(p/(p+n), n/(p+n)) − remainder(A)

   Verified against the notes' own worked numbers:
     I(6/12,6/12) = 1 bit.
     rem(Patrons) = (2/12)·I(0,1) + (4/12)·I(1,0) + (6/12)·I(1/3,2/3)
                  = 0 + 0 + 0.5·0.918 = 0.459  ⇒  IG(Patrons) = 0.541 bits.
     rem(Type)    = I(1/2,1/2) = 1               ⇒  IG(Type)    = 0 bits.
   All other attributes' IG are computed live by the SAME two formulas —
   never hand-scripted — so the bar chart can never drift from the maths.
   The winner is Patrons, matching the root the lecture actually builds
   (עמ' 55, 82).

   Self-contained IIFE. Vanilla DOM, no SVG needed (bars are styled divs).
   Site tokens only (var(--accent) etc.) — never hardcoded hex, so light/
   dark themes both work. RTL Hebrew chrome; dataset values stay LTR.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "entropy-lab";

  /* =====================================================================
     DATASET — 12 examples × 10 attributes (_notes/decision-trees-part1.md
     עמ' 25, the "Attribute-based Representation" table, verbatim values).
     ===================================================================== */
  var EXAMPLES = [
    { id: "x1", Alt: "Yes", Bar: "No", Fri: "No", Hun: "Yes", Pat: "Some", Price: "$$$", Rain: "No", Res: "Yes", Type: "French", Est: "0–10", wait: true },
    { id: "x2", Alt: "Yes", Bar: "No", Fri: "No", Hun: "Yes", Pat: "Full", Price: "$", Rain: "No", Res: "No", Type: "Thai", Est: "30–60", wait: false },
    { id: "x3", Alt: "No", Bar: "Yes", Fri: "No", Hun: "No", Pat: "Some", Price: "$", Rain: "No", Res: "No", Type: "Burger", Est: "0–10", wait: true },
    { id: "x4", Alt: "Yes", Bar: "No", Fri: "Yes", Hun: "Yes", Pat: "Full", Price: "$", Rain: "Yes", Res: "No", Type: "Thai", Est: "10–30", wait: true },
    { id: "x5", Alt: "Yes", Bar: "No", Fri: "Yes", Hun: "No", Pat: "Full", Price: "$$$", Rain: "No", Res: "Yes", Type: "French", Est: ">60", wait: false },
    { id: "x6", Alt: "No", Bar: "Yes", Fri: "No", Hun: "Yes", Pat: "Some", Price: "$$", Rain: "Yes", Res: "Yes", Type: "Italian", Est: "0–10", wait: true },
    { id: "x7", Alt: "No", Bar: "Yes", Fri: "No", Hun: "No", Pat: "None", Price: "$", Rain: "Yes", Res: "No", Type: "Burger", Est: "0–10", wait: false },
    { id: "x8", Alt: "No", Bar: "No", Fri: "No", Hun: "Yes", Pat: "Some", Price: "$$", Rain: "Yes", Res: "Yes", Type: "Thai", Est: "0–10", wait: true },
    { id: "x9", Alt: "No", Bar: "Yes", Fri: "Yes", Hun: "No", Pat: "Full", Price: "$", Rain: "Yes", Res: "No", Type: "Burger", Est: ">60", wait: false },
    { id: "x10", Alt: "Yes", Bar: "Yes", Fri: "Yes", Hun: "Yes", Pat: "Full", Price: "$$$", Rain: "No", Res: "Yes", Type: "Italian", Est: "10–30", wait: false },
    { id: "x11", Alt: "No", Bar: "No", Fri: "No", Hun: "No", Pat: "None", Price: "$", Rain: "No", Res: "No", Type: "Thai", Est: "0–10", wait: false },
    { id: "x12", Alt: "Yes", Bar: "Yes", Fri: "Yes", Hun: "Yes", Pat: "Full", Price: "$", Rain: "No", Res: "No", Type: "Burger", Est: "30–60", wait: true }
  ];

  var ATTRS = [
    { key: "Pat", en: "Patrons", he: "מס' הסועדים", values: ["None", "Some", "Full"] },
    { key: "Type", en: "Type", he: "סוג המסעדה", values: ["French", "Italian", "Thai", "Burger"] },
    { key: "Hun", en: "Hungry", he: "רעבים?", values: ["Yes", "No"] },
    { key: "Alt", en: "Alternate", he: "מסעדה אחרת קרובה?", values: ["Yes", "No"] },
    { key: "Bar", en: "Bar", he: "יש איזור בר?", values: ["Yes", "No"] },
    { key: "Fri", en: "Fri/Sat", he: "סופ\"ש?", values: ["Yes", "No"] },
    { key: "Price", en: "Price", he: "טווח מחירים", values: ["$", "$$", "$$$"] },
    { key: "Rain", en: "Raining", he: "יורד גשם?", values: ["Yes", "No"] },
    { key: "Res", en: "Reservation", he: "הוזמן מקום?", values: ["Yes", "No"] },
    { key: "Est", en: "WaitEstimate", he: "זמן המתנה משוער", values: ["0–10", "10–30", "30–60", ">60"] }
  ];
  var COLS = ["Alt", "Bar", "Fri", "Hun", "Pat", "Price", "Rain", "Res", "Type", "Est"];
  var GROUP_PALETTE = ["var(--dusty-blue)", "var(--mustard)", "var(--plum)", "var(--teal)"];

  var TOTAL_P = EXAMPLES.filter(function (e) { return e.wait; }).length;
  var TOTAL_N = EXAMPLES.length - TOTAL_P;

  /* =====================================================================
     INFORMATION THEORY — the two formulas, run for real (never hand-typed
     results). fmt() keeps three decimals like the lecture's own rounding.
     ===================================================================== */
  function log2(x) { return Math.log(x) / Math.LN2; }
  /* fixed 3-decimal display (matches the lecture's own rounding, e.g. 0.528,
     0.390, 0.918) — always toFixed, never sliced, so negative log2 values
     (e.g. -2.322) are never truncated into a wrong-looking number. */
  function fmt(n) { return (Math.round(n * 1000) / 1000).toFixed(3); }
  function fracFmt(n) { return (Math.round(n * 1000) / 1000).toString(); }

  function entropyDetail(p, n) {
    var total = p + n;
    if (total === 0 || p === 0 || n === 0) {
      return { p: p, n: n, total: total, value: 0, pure: true };
    }
    var pp = p / total, pn = n / total;
    var lp = log2(pp), ln = log2(pn);
    var tp = -pp * lp, tn = -pn * ln;
    return { p: p, n: n, total: total, pp: pp, pn: pn, lp: lp, ln: ln, tp: tp, tn: tn, value: tp + tn, pure: false };
  }

  var I_TOTAL = entropyDetail(TOTAL_P, TOTAL_N); /* = 1 bit, exactly like עמ' 46 */

  function partitionBy(attrKey) {
    var meta = null;
    for (var i = 0; i < ATTRS.length; i++) if (ATTRS[i].key === attrKey) meta = ATTRS[i];
    var groups = meta.values.map(function (v) {
      var rows = EXAMPLES.filter(function (e) { return e[attrKey] === v; });
      var p = rows.filter(function (e) { return e.wait; }).length;
      var n = rows.length - p;
      return { value: v, rows: rows, p: p, n: n, entropy: entropyDetail(p, n) };
    });
    var remainder = groups.reduce(function (sum, g) {
      return sum + (g.p + g.n) / EXAMPLES.length * g.entropy.value;
    }, 0);
    return { attr: meta, groups: groups, remainder: remainder, ig: I_TOTAL.value - remainder };
  }

  var STATS = {};
  ATTRS.forEach(function (a) { STATS[a.key] = partitionBy(a.key); });
  var WINNER_KEY = ATTRS.reduce(function (best, a) {
    return (best === null || STATS[a.key].ig > STATS[best].ig) ? a.key : best;
  }, null);
  var MAX_IG = STATS[WINNER_KEY].ig;

  /* =====================================================================
     STYLE (scoped, theme tokens only)
     ===================================================================== */
  var STYLE_ID = "el-style";
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      ".viz-entropy-lab{direction:rtl}" +
      ".el-lede{font-size:.88rem;color:var(--ink-soft);margin:0 0 .8rem;line-height:1.6}" +
      ".el-controls{display:flex;flex-wrap:wrap;gap:.6rem 1.1rem;align-items:center;margin-bottom:.9rem}" +
      ".el-controls label{font-weight:700;font-size:.86rem;color:var(--ink)}" +
      ".el-select{font-family:inherit;font-size:.88rem;font-weight:600;color:var(--ink);background:var(--surface-2);" +
      "border:1.5px solid var(--line);border-radius:99px;padding:.4rem 1rem;cursor:pointer;direction:ltr}" +
      ".el-select:focus-visible{outline:2px solid var(--accent);outline-offset:2px}" +
      ".el-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);padding:.85rem 1rem;margin-top:.9rem}" +
      ".el-card h4{margin:0 0 .5rem;font-size:.92rem;color:var(--ink)}" +
      ".el-table-wrap{overflow-x:auto;border-radius:var(--radius-sm)}" +
      ".el-table{border-collapse:collapse;width:100%;min-width:760px;font-size:.78rem;direction:ltr}" +
      ".el-table th,.el-table td{padding:4px 8px;text-align:center;border-bottom:1px solid var(--line);white-space:nowrap}" +
      ".el-table th{color:var(--ink-soft);font-weight:700;font-size:.72rem;position:sticky;top:0;background:var(--surface)}" +
      ".el-table td:first-child,.el-table th:first-child{text-align:right;font-weight:800;color:var(--ink)}" +
      ".el-table th.is-active{color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,var(--surface))}" +
      ".el-table td.is-active{font-weight:700}" +
      ".el-pill{display:inline-block;color:#fff;font-weight:700;font-size:.7rem;padding:1px 9px;border-radius:99px}" +
      ".el-groups{display:flex;flex-wrap:wrap;gap:.7rem;margin-top:.8rem}" +
      ".el-group{flex:1 1 220px;min-width:210px;border-radius:var(--radius-sm);border:1px solid var(--line);" +
      "background:var(--surface-2);padding:.6rem .85rem;border-inline-start:4px solid var(--grp,var(--accent))}" +
      ".el-group .el-grp-head{display:flex;align-items:center;justify-content:space-between;gap:.4rem;margin-bottom:.35rem}" +
      ".el-group .el-grp-val{font-weight:800;color:var(--ink);direction:ltr;font-size:.92rem}" +
      ".el-group .el-grp-count{font-size:.74rem;color:var(--ink-soft)}" +
      ".el-chip-row{display:flex;flex-wrap:wrap;gap:4px;margin:.3rem 0 .5rem;direction:ltr}" +
      ".el-chip{font-family:var(--font-mono);font-size:.68rem;font-weight:700;color:#fff;padding:1px 6px;border-radius:6px}" +
      ".el-formula{font-family:var(--font-mono);direction:ltr;font-size:.8rem;line-height:1.75;white-space:pre-wrap;" +
      "color:var(--ink);background:var(--surface);border:1px dashed var(--line);border-radius:8px;padding:.55rem .7rem;margin-top:.2rem}" +
      ".el-summary-line{font-size:.9rem;color:var(--ink);margin:.25rem 0}" +
      ".el-summary-line b{color:var(--accent)}" +
      ".el-winner-tag{display:inline-flex;align-items:center;gap:.3rem;background:var(--accent);color:#fff;" +
      "font-weight:700;font-size:.76rem;padding:2px 10px;border-radius:99px;margin-inline-start:.5rem}" +
      ".el-bars{display:flex;flex-direction:column;gap:.45rem;margin-top:.6rem}" +
      ".el-bar-btn{display:flex;align-items:center;gap:.7rem;width:100%;background:none;border:none;padding:.15rem;" +
      "cursor:pointer;font-family:inherit;text-align:right}" +
      ".el-bar-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:8px}" +
      ".el-bar-label{flex:0 0 118px;font-size:.8rem;font-weight:700;color:var(--ink);direction:ltr;text-align:left}" +
      ".el-bar-track{flex:1;height:20px;border-radius:6px;background:var(--surface-2);border:1px solid var(--line);" +
      "position:relative;overflow:hidden}" +
      ".el-bar-fill{position:absolute;inset-inline-start:0;top:0;bottom:0;border-radius:6px;background:var(--ink-soft);" +
      "opacity:.55;transition:width .3s ease}" +
      ".el-bar-btn.is-selected .el-bar-track{box-shadow:0 0 0 2px var(--accent)}" +
      ".el-bar-btn.is-winner .el-bar-fill{background:var(--accent);opacity:1}" +
      ".el-bar-val{flex:0 0 56px;font-size:.78rem;font-weight:700;color:var(--ink-soft);direction:ltr;text-align:left}" +
      ".el-bar-btn.is-winner .el-bar-val{color:var(--accent)}" +
      ".el-toggle-btn.primary{background:var(--accent);color:#fff;border-color:var(--accent)}" +
      ".el-pure-note{color:var(--ink-soft);font-size:.8rem}";
    document.head.appendChild(s);
  }

  /* =====================================================================
     small DOM helpers
     ===================================================================== */
  function mk(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function ltr(s) { return '<span dir="ltr">' + s + "</span>"; }

  /* one-branch entropy formula, either the short result or the full log2
     derivation (gated by showFull) */
  function entropyFormula(ent, showFull) {
    if (ent.pure) {
      return ent.total === 0
        ? "I( — ) = 0  (אין דוגמאות בענף זה)"
        : "I(" + ent.p + "/" + ent.total + ", " + ent.n + "/" + ent.total + ") = 0  (ענף טהור — " +
          (ent.p === 0 ? "כולן שליליות" : "כולן חיוביות") + ")";
    }
    if (!showFull) {
      return "I(" + ent.p + "/" + ent.total + ", " + ent.n + "/" + ent.total + ") = " + fmt(ent.value) + " ביט";
    }
    return "I(" + ent.p + "/" + ent.total + ", " + ent.n + "/" + ent.total + ")\n" +
      "= −(" + ent.p + "/" + ent.total + ")·log2(" + ent.p + "/" + ent.total + ") − (" + ent.n + "/" + ent.total +
      ")·log2(" + ent.n + "/" + ent.total + ")\n" +
      "= −(" + fracFmt(ent.pp) + ")·(" + fmt(ent.lp) + ") − (" + fracFmt(ent.pn) + ")·(" + fmt(ent.ln) + ")\n" +
      "= " + fmt(ent.tp) + " + " + fmt(ent.tn) + "\n" +
      "= " + fmt(ent.value) + " ביט";
  }

  /* =====================================================================
     Render one mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-el-ready") === "1") return;
    mount.setAttribute("data-el-ready", "1");
    mount.innerHTML = "";
    ensureStyle();

    var current = "Pat";     /* attribute currently selected */
    var showFull = false;    /* "הצג חישוב מלא" toggle */

    var root = mk("div", "viz-entropy-lab");
    root.setAttribute("tabindex", "0");
    root.style.outline = "none";

    root.appendChild(mk("p", "el-lede",
      "12 הדוגמאות של בעיית ההמתנה במסעדה (© Russell &amp; Norvig, AIMA) — " +
      "6 <b>WillWait=Yes</b> ו-6 <b>WillWait=No</b>. בחרו מאפיין וצפו איך הדוגמאות מתפצלות, " +
      "וכמה מידע (ביטים) עוד יידרש בכל ענף."));

    /* ---- controls: attribute picker + full-arithmetic toggle ---- */
    var controls = mk("div", "el-controls");
    var lbl = mk("label", null, "מאפיין לבדיקה:");
    var selId = "el-attr-" + Math.random().toString(36).slice(2);
    lbl.htmlFor = selId;
    var select = document.createElement("select");
    select.className = "el-select";
    select.id = selId;
    ATTRS.forEach(function (a) {
      var opt = document.createElement("option");
      opt.value = a.key;
      opt.textContent = a.en + " (" + a.he + ")";
      select.appendChild(opt);
    });
    select.value = current;
    select.addEventListener("change", function () { current = select.value; paint(); });
    controls.appendChild(lbl);
    controls.appendChild(select);

    var toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "viz-btn el-toggle-btn";
    toggleBtn.setAttribute("aria-pressed", "false");
    toggleBtn.textContent = "הצג חישוב מלא";
    toggleBtn.addEventListener("click", function () {
      showFull = !showFull;
      toggleBtn.classList.toggle("primary", showFull);
      toggleBtn.setAttribute("aria-pressed", showFull ? "true" : "false");
      paint();
    });
    controls.appendChild(toggleBtn);
    root.appendChild(controls);

    /* ---- dataset table ---- */
    var tableCard = mk("div", "el-card");
    tableCard.appendChild(mk("h4", null, "קבוצת האימון (12 דוגמאות, 10 מאפיינים)"));
    var tableWrap = mk("div", "el-table-wrap");
    var table = document.createElement("table");
    table.className = "el-table";
    var thead = document.createElement("tr");
    thead.appendChild(mk("th", null, "#"));
    COLS.forEach(function (c) { thead.appendChild(mk("th", null, c)); });
    thead.appendChild(mk("th", null, "WillWait"));
    table.appendChild(thead);
    var rowCells = {}; /* id -> {cells:{col:td}, waitTd} */
    EXAMPLES.forEach(function (e) {
      var tr = document.createElement("tr");
      tr.appendChild(mk("td", null, e.id));
      var cells = {};
      COLS.forEach(function (c) {
        var td = mk("td", null, e[c]);
        tr.appendChild(td);
        cells[c] = td;
      });
      var waitTd = document.createElement("td");
      waitTd.innerHTML = '<span class="el-pill" style="background:' +
        (e.wait ? "var(--sage)" : "var(--clay)") + '">' + (e.wait ? "Yes" : "No") + "</span>";
      tr.appendChild(waitTd);
      table.appendChild(tr);
      rowCells[e.id] = { tr: tr, cells: cells };
    });
    tableWrap.appendChild(table);
    tableCard.appendChild(tableWrap);
    root.appendChild(tableCard);

    /* ---- I_total (fixed) ---- */
    var iTotalCard = mk("div", "el-card");
    iTotalCard.innerHTML =
      '<div class="el-summary-line">כמות המידע הכוללת בבעיה (לפני כל פיצול): ' +
      ltr("I(" + TOTAL_P + "/12, " + TOTAL_N + "/12) = I(0.5, 0.5) = <b>1 ביט</b>") +
      " — אי-ודאות מקסימלית, כי הדוגמאות מאוזנות 6/6.</div>";
    root.appendChild(iTotalCard);

    /* ---- groups card (rebuilt per attribute) ---- */
    var groupsCard = mk("div", "el-card");
    root.appendChild(groupsCard);

    /* ---- remainder / IG summary (rebuilt per attribute) ---- */
    var summaryCard = mk("div", "el-card");
    root.appendChild(summaryCard);

    /* ---- IG bar chart across all attributes ---- */
    var barsCard = mk("div", "el-card");
    barsCard.appendChild(mk("h4", null, 'השוואת Information Gain בין כל המאפיינים — IG(A) = I − remainder(A)'));
    var bars = mk("div", "el-bars");
    var barRefs = {};
    ATTRS.forEach(function (a) {
      var st = STATS[a.key];
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "el-bar-btn";
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", function () { current = a.key; select.value = a.key; paint(); });
      var label = mk("span", "el-bar-label", a.en);
      var track = mk("span", "el-bar-track");
      var fill = mk("span", "el-bar-fill");
      track.appendChild(fill);
      var val = mk("span", "el-bar-val", fmt(st.ig));
      btn.appendChild(label); btn.appendChild(track); btn.appendChild(val);
      bars.appendChild(btn);
      barRefs[a.key] = { btn: btn, fill: fill };
    });
    barsCard.appendChild(bars);
    var barsNote = mk("p", "el-pure-note",
      "המאפיין עם ה-IG הגבוה ביותר (מסומן, " + ltr(WINNER_KEY === "Pat" ? "Patrons" : WINNER_KEY) +
      ") הוא בדיוק שורש העץ שההרצאה בונה.");
    barsNote.style.marginTop = ".5rem";
    barsCard.appendChild(barsNote);
    root.appendChild(barsCard);

    mount.appendChild(root);

    /* =================================================================
       paint — pure function of (current, showFull); called on any change.
       ================================================================= */
    function paint() {
      var st = STATS[current];
      var meta = st.attr;

      /* highlight the active attribute's column in the dataset table +
         tint each row by which value-group it falls into ("rows visually
         partition into groups per value") */
      var colorByValue = {};
      meta.values.forEach(function (v, i) { colorByValue[v] = GROUP_PALETTE[i % GROUP_PALETTE.length]; });
      var headCells = thead.children;
      for (var hi = 1; hi <= COLS.length; hi++) {
        headCells[hi].classList.toggle("is-active", COLS[hi - 1] === current);
      }
      EXAMPLES.forEach(function (e) {
        var ref = rowCells[e.id];
        var grp = colorByValue[e[current]];
        ref.tr.style.background = "color-mix(in srgb, " + grp + " 13%, var(--surface))";
        ref.tr.style.borderInlineStart = "3px solid " + grp;
        COLS.forEach(function (c) {
          ref.cells[c].classList.toggle("is-active", c === current);
        });
      });

      /* groups card */
      groupsCard.innerHTML = "";
      groupsCard.appendChild(mk("h4", null,
        "פיצול לפי " + ltr(meta.en) + " (" + meta.he + ") — " + meta.values.length + " ערכים"));
      var groupsWrap = mk("div", "el-groups");
      st.groups.forEach(function (g, i) {
        var color = GROUP_PALETTE[i % GROUP_PALETTE.length];
        var card = mk("div", "el-group");
        card.style.setProperty("--grp", color);
        var head = mk("div", "el-grp-head");
        head.appendChild(mk("span", "el-grp-val", meta.key + " = " + g.value));
        head.appendChild(mk("span", "el-grp-count", g.p + "+ / " + g.n + "− (" + (g.p + g.n) + " דוגמאות)"));
        card.appendChild(head);
        var chipRow = mk("div", "el-chip-row");
        g.rows.forEach(function (r) {
          var chip = mk("span", "el-chip", r.id);
          chip.style.background = r.wait ? "var(--sage)" : "var(--clay)";
          chipRow.appendChild(chip);
        });
        if (!g.rows.length) {
          var none = mk("span", "el-pure-note", "אין דוגמאות עם ערך זה");
          chipRow.appendChild(none);
        }
        card.appendChild(chipRow);
        var formula = mk("div", "el-formula", entropyFormula(g.entropy, showFull));
        card.appendChild(formula);
        groupsWrap.appendChild(card);
      });
      groupsCard.appendChild(groupsWrap);

      /* remainder + IG summary */
      summaryCard.innerHTML = "";
      summaryCard.appendChild(mk("h4", null, "Remainder ו-Information Gain של " + ltr(meta.en)));
      var remLine, igLine;
      if (showFull) {
        var termsShort = st.groups.map(function (g) {
          return "(" + (g.p + g.n) + "/12)·I(" + g.p + "/" + (g.p + g.n) + "," + g.n + "/" + (g.p + g.n) + ")";
        }).join(" + ");
        var termsVal = st.groups.map(function (g) {
          return fracFmt((g.p + g.n) / 12) + "·" + fmt(g.entropy.value);
        }).join(" + ");
        var termsNum = st.groups.map(function (g) {
          return fmt((g.p + g.n) / 12 * g.entropy.value);
        }).join(" + ");
        remLine = mk("div", "el-formula",
          "remainder(" + meta.en + ") = " + termsShort + "\n" +
          "= " + termsVal + "\n" +
          "= " + termsNum + "\n" +
          "= " + fmt(st.remainder));
        igLine = mk("div", "el-formula",
          "IG(" + meta.en + ") = I(6/12, 6/12) − remainder(" + meta.en + ")\n" +
          "= 1 − " + fmt(st.remainder) + "\n" +
          "= " + fmt(st.ig) + " ביט" + (current === WINNER_KEY ? "   ← המקסימלי מבין כל המאפיינים" : ""));
      } else {
        remLine = mk("div", "el-formula", "remainder(" + meta.en + ") = " + fmt(st.remainder) + " ביט");
        igLine = mk("div", "el-formula", "IG(" + meta.en + ") = 1 − " + fmt(st.remainder) + " = " + fmt(st.ig) + " ביט");
      }
      summaryCard.appendChild(remLine);
      summaryCard.appendChild(igLine);
      if (current === WINNER_KEY) {
        var tag = mk("span", "el-winner-tag", "★ IG מקסימלי — שורש העץ בהרצאה");
        summaryCard.appendChild(tag);
      }

      /* bar chart */
      ATTRS.forEach(function (a) {
        var ig = STATS[a.key].ig;
        var ref = barRefs[a.key];
        ref.fill.style.width = (MAX_IG > 0 ? (ig / MAX_IG * 100) : 0) + "%";
        ref.btn.classList.toggle("is-selected", a.key === current);
        ref.btn.classList.toggle("is-winner", a.key === WINNER_KEY);
        ref.btn.setAttribute("aria-pressed", a.key === current ? "true" : "false");
      });
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
