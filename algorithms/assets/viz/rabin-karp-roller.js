/* =====================================================================
   rabin-karp-roller.js  —  Module 10 "התאמת מחרוזות — Rabin-Karp"
   Grounded in _notes/09-string-matching.md  §"האלגוריתמים / Rabin-Karp"
   and the Rabin-Karp-Matcher pseudocode (lec-string-matching.pdf עמ' 17).

   LECTURE EXAMPLE (the core "theory-deck" instance the students saw):
     T = a b a b b a b b a b   (T[1..10], n = 10)
     P = a b b a               (P[1..4],  m = 4)
     Valid shifts:  s = 2  and  s = 5   (both T[..]=abba)

   Hashing constants (OUR choice — "דוגמה שלנו"; the notes give T,P but not
   d,q). We map letters to digits a→1, b→2, radix d = 10, prime modulus
   q = 17.  This choice is deliberate: it makes the pattern fingerprint a
   readable decimal number (p = 1221 mod 17 = 14) AND produces two genuine
   SPURIOUS HITS at s = 1 and s = 4 (window = "babb", value 2122 ≡ 14 (mod 17)
   — same residue as P, yet the char-by-char check rejects them). That is the
   central Rabin-Karp lesson: equal hash ⇒ must still verify (line 11).

   Rolling recurrence (verbatim, notes / lec p.17):
     h    = d^(m-1) mod q                                   = 10³ mod 17 = 14
     p    = fingerprint(P)                                  = 1221 mod 17 = 14
     t₀   = fingerprint(T[1..m])                            = 1212 mod 17 = 5
     t_{s+1} = ( d·(t_s − T[s+1]·h) + T[s+m+1] ) mod q      (O(1) per shift)

   Self-contained IIFE. Hand-authored SVG + DOM. No external deps.
   Cream design tokens hardcoded (CONTRACT §2); unit-5 plum accent.
   RTL Hebrew captions; English/LTR for algorithm identifiers & math.
   Graceful no-mount, zero console errors, prefers-reduced-motion honoured.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "rabin-karp-roller";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* --- design palette (hardcoded per CONTRACT §2) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    plum: "#8E6A86",     /* unit-5 accent — pattern / current window */
    plumTint: "#F1E8EF", /* soft plum wash behind the active window */
    sage: "#7C9885",     /* valid shift / char match */
    clay: "#BE7C5E",     /* spurious hit / char mismatch */
    mustard: "#C9A24B",  /* hash / fingerprint values */
    blue: "#6E8CA0"      /* neutral / rejected-by-hash */
  };

  /* --- model (the lecture example) --- */
  var T = "ababbabbab";     /* T[1..10] */
  var P = "abba";           /* P[1..4]  */
  var n = T.length;         /* 10 */
  var m = P.length;         /* 4  */
  var d = 10;               /* radix */
  var q = 17;               /* prime modulus */
  var VAL = { a: 1, b: 2 }; /* letter → digit */

  function mod(a) { return ((a % q) + q) % q; }
  function rawVal(str) { var v = 0; for (var i = 0; i < str.length; i++) v = v * d + VAL[str[i]]; return v; }
  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* =====================================================================
     STEP ENGINE — actually SIMULATE Rabin-Karp-Matcher and record a
     micro-step snapshot per pseudocode action. Each snapshot is a pure,
     self-contained description the renderer paints (idempotent).
     ===================================================================== */
  function buildSteps() {
    var steps = [];

    /* running bookkeeping shared across snapshots */
    var shiftInfo = [];
    for (var s = 0; s <= n - m; s++) {
      shiftInfo.push({ s: s, t: null, status: "pending", sub: T.substr(s, m) });
    }
    var pHash = null, hVal = null, curWindow = null, patternAt = null, curT = null;

    function snap(o) {
      var base = {
        shiftInfo: shiftInfo.map(function (x) {
          return { s: x.s, t: x.t, status: x.status, sub: x.sub };
        }),
        pHash: pHash, hVal: hVal, curWindow: curWindow, patternAt: patternAt, curT: curT,
        activeS: (o.activeS != null ? o.activeS : null),
        verify: null, roll: null,
        badge: "", color: C.blue, title: "", body: ""
      };
      for (var k in o) base[k] = o[k];
      steps.push(base);
    }

    /* ---- preprocessing (pseudocode lines 3–8) ---- */
    hVal = 1;
    for (var i = 1; i < m; i++) hVal = mod(hVal * d);   /* h = d^(m-1) mod q = 14 */
    snap({
      badge: "Preprocessing · h",
      color: C.blue,
      title: "עיבוד מקדים — מקדם ההזזה h",
      body:
        "ממירים אותיות לספרות: <span dir=\"ltr\">a→1, b→2</span>, בבסיס " +
        "<span dir=\"ltr\">d = 10</span> ומודולו הראשוני <span dir=\"ltr\">q = 17</span>. " +
        "מחשבים את מקדם ההזזה <span dir=\"ltr\">h = d<sup>m−1</sup> mod q = 10<sup>3</sup> mod 17 = " +
        "<b>" + hVal + "</b></span>. " +
        "ה-<span dir=\"ltr\">h</span> ישמש בהמשך כדי „לקלף” את הספרה הבכירה בעת הגלגול."
    });

    var pRaw = rawVal(P);
    pHash = mod(pRaw);
    snap({
      badge: "Preprocessing · p",
      color: C.blue,
      title: "עיבוד מקדים — טביעת האצבע של התבנית p",
      body:
        "ממירים את <span dir=\"ltr\">P = abba</span> למספר בשיטת הורנר עם <span dir=\"ltr\">mod</span> " +
        "בכל צעד: <span dir=\"ltr\">1·10³ + 2·10² + 2·10 + 1 = " + pRaw + "</span>, ולכן " +
        "<span dir=\"ltr\">p = " + pRaw + " mod 17 = <b>" + pHash + "</b></span>. " +
        "זהו ה-<span dir=\"ltr\">fingerprint</span> הקבוע של התבנית — מחושב פעם אחת."
    });

    var t0Raw = rawVal(T.substr(0, m));
    curT = mod(t0Raw);
    shiftInfo[0].t = curT;
    curWindow = 0; patternAt = 0;
    snap({
      activeS: 0,
      badge: "Preprocessing · t₀",
      color: C.blue,
      title: "עיבוד מקדים — hash של החלון הראשון t₀",
      body:
        "אותה המרה על החלון הראשון <span dir=\"ltr\">T[1..4] = abab</span>: " +
        "<span dir=\"ltr\">" + t0Raw + "</span>, ולכן <span dir=\"ltr\">t<sub>0</sub> = " + t0Raw +
        " mod 17 = <b>" + curT + "</b></span>. " +
        "מכאן נגלגל את הערך קדימה ב-<span dir=\"ltr\">O(1)</span> לכל היסט — בלי לחשב מחדש את החלון."
    });

    /* ---- main loop (pseudocode lines 9–14) ---- */
    for (var sh = 0; sh <= n - m; sh++) {
      var win = T.substr(sh, m);
      var hashMatch = (pHash === curT);
      curWindow = sh; patternAt = sh;
      shiftInfo[sh].status = hashMatch ? "active" : "hashno";

      /* line 10: if p = t_s */
      snap({
        activeS: sh,
        badge: hashMatch ? "line 10 · hash =" : "line 10 · hash ≠",
        color: hashMatch ? C.mustard : C.blue,
        title: "היסט s=" + sh + " — השוואת ה-hash",
        body: hashMatch
          ? ("משווים <span dir=\"ltr\">t<sub>" + sh + "</sub> = " + curT + "</span> מול " +
             "<span dir=\"ltr\">p = " + pHash + "</span> → <b style=\"color:" + C.mustard + "\">שווים!</b> " +
             "יש התאמת <span dir=\"ltr\">hash</span>. אבל ייתכן שזו התנגשות (<span dir=\"ltr\">spurious hit</span>) — " +
             "לכן חובה לוודא תו-תו (שורה 11) לפני שמכריזים על היסט חוקי.")
          : ("משווים <span dir=\"ltr\">t<sub>" + sh + "</sub> = " + curT + "</span> מול " +
             "<span dir=\"ltr\">p = " + pHash + "</span> → <b>שונים</b>. אין התאמת <span dir=\"ltr\">hash</span>, " +
             "לכן פוסלים את ההיסט <b>מיד</b> ב-<span dir=\"ltr\">O(1)</span> — בלי אפילו להסתכל על התווים.")
      });

      /* line 11: char-by-char verification (only when hash matched) */
      if (hashMatch) {
        var isValid = (win === P);
        var firstMis = -1;
        for (var j = 0; j < m; j++) { if (win[j] !== P[j]) { firstMis = j; break; } }
        var compared = isValid ? m : (firstMis + 1);
        shiftInfo[sh].status = isValid ? "valid" : "spurious";
        snap({
          activeS: sh,
          verify: { isValid: isValid, firstMismatch: firstMis, compared: compared },
          badge: isValid ? "line 11–12 · valid ✓" : "line 11 · spurious hit",
          color: isValid ? C.sage : C.clay,
          title: "היסט s=" + sh + " — אימות תו-תו",
          body: isValid
            ? ("ה-<span dir=\"ltr\">hash</span> שווה, ועכשיו משווים <span dir=\"ltr\">P</span> מול " +
               "<span dir=\"ltr\">T[" + (sh + 1) + ".." + (sh + m) + "]</span> אות-אות: " +
               "<span dir=\"ltr\">abba = abba</span> ✓. <b style=\"color:" + C.sage + "\">היסט חוקי!</b> " +
               "מדפיסים <span dir=\"ltr\">\"Pattern occurs with shift " + sh + "\"</span> (שורה 12).")
            : ("ה-<span dir=\"ltr\">hash</span> שווה (" + curT + "), אך ההשוואה תו-תו נכשלת כבר בתו הראשון: " +
               "<span dir=\"ltr\">T[" + (sh + 1) + "] = b ≠ a = P[1]</span>. זו " +
               "<b style=\"color:" + C.clay + "\">פגיעת שווא (spurious hit)</b> — ה-<span dir=\"ltr\">hash</span> " +
               "התנגש אך המחרוזות שונות. ההיסט נפסל. מספר פגיעות השווא חסום ב-<span dir=\"ltr\">n/q</span>.")
        });
      }

      /* line 13–14: roll to next window (unless last shift) */
      if (sh < n - m) {
        var leaveIdx = sh, enterIdx = sh + m;
        var leaveC = T[leaveIdx], enterC = T[enterIdx];
        var tOld = curT;
        var tNew = mod(d * (tOld - VAL[leaveC] * hVal) + VAL[enterC]);
        curT = tNew;
        shiftInfo[sh + 1].t = tNew;
        curWindow = sh + 1; patternAt = sh + 1;
        snap({
          activeS: sh + 1,
          roll: { leaveIdx: leaveIdx, enterIdx: enterIdx },
          badge: "line 14 · rolling hash",
          color: C.plum,
          title: "גלגול ה-hash להיסט הבא (s=" + (sh + 1) + ")",
          body:
            "מגלגלים ב-<span dir=\"ltr\">O(1)</span>: מסירים את התו היוצא " +
            "<span dir=\"ltr\">T[" + (leaveIdx + 1) + "] = " + leaveC + " (" + VAL[leaveC] + ")</span> " +
            "(מחסירים <span dir=\"ltr\">" + leaveC + "·h</span>), מזיזים ספרה שמאלה (<span dir=\"ltr\">×d</span>), " +
            "ומוסיפים את התו הנכנס <span dir=\"ltr\">T[" + (enterIdx + 1) + "] = " + enterC + " (" + VAL[enterC] + ")</span>:<br>" +
            "<span dir=\"ltr\">t<sub>" + (sh + 1) + "</sub> = (10·(" + tOld + " − " + VAL[leaveC] + "·" + hVal + ") + " +
            VAL[enterC] + ") mod 17 = <b>" + tNew + "</b></span>. זהו הלב של Rabin-Karp — חלון מחליק בזמן קבוע."
        });
      }
    }

    /* ---- summary ---- */
    curWindow = null; patternAt = null;
    snap({
      badge: "done · Θ(n) + O(m(v + n/q))",
      color: C.sage,
      title: "סיום — כל ההיסטים החוקיים",
      body:
        "ההיסטים החוקיים הם <b style=\"color:" + C.sage + "\">s = 2</b> ו-" +
        "<b style=\"color:" + C.sage + "\">s = 5</b> (<span dir=\"ltr\">abba</span>) — בדיוק כמו בנאיבי, " +
        "אבל בלי לחשב חלונות מחדש. בדרך היו שתי <b style=\"color:" + C.clay + "\">פגיעות שווא</b> " +
        "(<span dir=\"ltr\">s = 1, 4</span>) שבהן ה-<span dir=\"ltr\">hash</span> התנגש (14) אך האימות תו-תו פסל אותן. " +
        "עלות: <span dir=\"ltr\">Θ(n) + O(m·(v + n/q))</span> — עם <span dir=\"ltr\">q > m</span> ומספר קבוע " +
        "של התאמות זה <span dir=\"ltr\">O(n + m)</span>."
    });

    return steps;
  }

  /* =====================================================================
     SVG scene builder — the text row (10 cells), the sliding pattern row
     (4 cells), and a plum window wash. Drawn LTR (index 1 on the left),
     which is the natural reading order for the strings; captions are RTL.
     ===================================================================== */
  function el(tag, attrs) {
    var node = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }
  function txt(x, y, s, attrs) {
    var t = el("text", attrs || {});
    t.setAttribute("x", x); t.setAttribute("y", y);
    t.textContent = s;
    return t;
  }

  var PAD_L = 40, CELL_W = 52, GAP = 6, PITCH = CELL_W + GAP;
  var W = PAD_L * 2 + n * PITCH - GAP;      /* 40*2 + 10*58 - 6 = 654 */
  var IDX_Y = 40;
  var TEXT_TOP = 50, CELL_H = 50;
  var PAT_TOP = 128;
  var WIN_TOP = TEXT_TOP - 6, WIN_H = (PAT_TOP + CELL_H) - WIN_TOP + 6;
  var H = 210;

  function xCell(i) { return PAD_L + i * PITCH; }

  function buildScene() {
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H, width: "100%",
      role: "img", direction: "ltr",
      "aria-label": "חלון מחליק של Rabin-Karp על הטקסט ababbabbab והתבנית abba"
    });
    svg.style.display = "block";
    svg.style.maxWidth = W + "px";
    svg.style.margin = "0 auto";

    var g = { textCells: [], patCells: [] };

    /* window wash (behind everything) */
    g.win = el("rect", {
      x: 0, y: WIN_TOP, width: m * PITCH - GAP + 6, height: WIN_H, rx: 12,
      fill: C.plumTint, stroke: C.plum, "stroke-width": 2, opacity: 0
    });
    svg.appendChild(g.win);

    /* row labels (RTL Hebrew, placed at the left edge) */
    svg.appendChild(txt(PAD_L - 12, TEXT_TOP + CELL_H / 2 + 4, "T", {
      "text-anchor": "end", "font-size": 14, "font-weight": 800, fill: C.inkSoft
    }));
    svg.appendChild(txt(PAD_L - 12, PAT_TOP + CELL_H / 2 + 4, "P", {
      "text-anchor": "end", "font-size": 14, "font-weight": 800, fill: C.plum
    }));

    /* ---- text cells T[1..n] ---- */
    for (var i = 0; i < n; i++) {
      var x = xCell(i);
      /* index above */
      svg.appendChild(txt(x + CELL_W / 2, IDX_Y, String(i + 1), {
        "text-anchor": "middle", "font-size": 10.5, fill: C.inkSoft
      }));
      var rect = el("rect", {
        x: x, y: TEXT_TOP, width: CELL_W, height: CELL_H, rx: 8,
        fill: C.surface, stroke: C.line, "stroke-width": 1.6
      });
      svg.appendChild(rect);
      var letter = txt(x + CELL_W / 2, TEXT_TOP + 27, T[i], {
        "text-anchor": "middle", "font-size": 21, "font-weight": 800, fill: C.ink
      });
      svg.appendChild(letter);
      var digit = txt(x + CELL_W - 7, TEXT_TOP + CELL_H - 7, String(VAL[T[i]]), {
        "text-anchor": "end", "font-size": 10, "font-weight": 700, fill: C.mustard
      });
      svg.appendChild(digit);
      g.textCells.push({ rect: rect, letter: letter, digit: digit });
    }

    /* ---- pattern group P[1..m] (slides horizontally) ---- */
    g.patG = el("g", { opacity: 0 });
    for (var j = 0; j < m; j++) {
      var px = xCell(j);
      var prect = el("rect", {
        x: px, y: PAT_TOP, width: CELL_W, height: CELL_H, rx: 8,
        fill: C.surface, stroke: C.plum, "stroke-width": 1.8
      });
      g.patG.appendChild(prect);
      var pletter = txt(px + CELL_W / 2, PAT_TOP + 27, P[j], {
        "text-anchor": "middle", "font-size": 21, "font-weight": 800, fill: C.plum
      });
      g.patG.appendChild(pletter);
      var pdigit = txt(px + CELL_W - 7, PAT_TOP + CELL_H - 7, String(VAL[P[j]]), {
        "text-anchor": "end", "font-size": 10, "font-weight": 700, fill: C.mustard
      });
      g.patG.appendChild(pdigit);
      g.patCells.push({ rect: prect, letter: pletter, digit: pdigit });
    }
    svg.appendChild(g.patG);

    return { svg: svg, g: g };
  }

  /* =====================================================================
     Paint a snapshot onto the scene (idempotent).
     ===================================================================== */
  function applyStep(scene, st, animate) {
    var g = scene.g;

    /* reset all text/pattern cells to neutral */
    g.textCells.forEach(function (c) {
      c.rect.setAttribute("fill", C.surface);
      c.rect.setAttribute("stroke", C.line);
      c.rect.setAttribute("stroke-width", 1.6);
      c.rect.setAttribute("stroke-dasharray", "");
      c.letter.setAttribute("fill", C.ink);
    });
    g.patCells.forEach(function (c) {
      c.rect.setAttribute("fill", C.surface);
      c.rect.setAttribute("stroke", C.plum);
      c.letter.setAttribute("fill", C.plum);
    });

    /* window wash + pattern position */
    if (st.curWindow != null) {
      g.win.setAttribute("opacity", 1);
      g.win.setAttribute("x", xCell(st.curWindow) - 3);
      g.patG.setAttribute("opacity", 1);
      var tx = st.patternAt * PITCH;
      if (reducedMotion() || !animate) g.patG.style.transition = "none";
      else g.patG.style.transition = "transform .38s cubic-bezier(.4,0,.2,1)";
      g.patG.setAttribute("transform", "translate(" + tx + ",0)");
      /* highlight the window's text cells with plum tint */
      for (var w = 0; w < m; w++) {
        var tc = g.textCells[st.curWindow + w];
        if (tc) { tc.rect.setAttribute("stroke", C.plum); tc.rect.setAttribute("stroke-width", 1.8); }
      }
    } else {
      g.win.setAttribute("opacity", 0);
      g.patG.setAttribute("opacity", 0);
    }

    /* roll: mark the leaving (clay) and entering (sage) chars */
    if (st.roll) {
      var lv = g.textCells[st.roll.leaveIdx];
      if (lv) { lv.rect.setAttribute("stroke", C.clay); lv.rect.setAttribute("stroke-width", 2.4); lv.rect.setAttribute("stroke-dasharray", "5 3"); }
      var en = g.textCells[st.roll.enterIdx];
      if (en) { en.rect.setAttribute("stroke", C.sage); en.rect.setAttribute("stroke-width", 2.4); }
    }

    /* verify: colour each compared char green(match)/clay(mismatch) */
    if (st.verify && st.curWindow != null) {
      for (var v = 0; v < st.verify.compared; v++) {
        var isMis = (!st.verify.isValid && v === st.verify.firstMismatch);
        var col = isMis ? C.clay : C.sage;
        var t2 = g.textCells[st.curWindow + v];
        var p2 = g.patCells[v];
        if (t2) { t2.rect.setAttribute("fill", isMis ? "#F4E5DC" : "#E7EFE8"); t2.rect.setAttribute("stroke", col); t2.rect.setAttribute("stroke-width", 2.4); t2.letter.setAttribute("fill", col); }
        if (p2) { p2.rect.setAttribute("fill", isMis ? "#F4E5DC" : "#E7EFE8"); p2.rect.setAttribute("stroke", col); p2.rect.setAttribute("stroke-width", 2.4); p2.letter.setAttribute("fill", col); }
      }
    }
  }

  /* =====================================================================
     Bookkeeping (HTML): hash chips + the per-shift residue table.
     ===================================================================== */
  function statusChip(status) {
    var map = {
      pending: { t: "—", bg: C.surface2, fg: C.inkSoft, bd: C.line },
      active: { t: "בודק…", bg: "#FBF1DA", fg: "#8A6D20", bd: C.mustard },
      hashno: { t: "hash ≠", bg: "#EEF2F4", fg: "#4C6472", bd: C.blue },
      spurious: { t: "spurious", bg: "#F4E5DC", fg: "#8A4E30", bd: C.clay },
      valid: { t: "✓ חוקי", bg: "#E7EFE8", fg: "#3F6650", bd: C.sage }
    };
    var s = map[status] || map.pending;
    return '<span style="display:inline-block;padding:1px 9px;border-radius:99px;font-size:.74rem;' +
      'font-weight:700;background:' + s.bg + ';color:' + s.fg + ';border:1px solid ' + s.bd + '" dir="ltr">' +
      s.t + '</span>';
  }

  function renderHashBar(st) {
    function chip(label, val, col, strong) {
      return '<span style="display:inline-flex;align-items:baseline;gap:5px;background:' + C.surface2 +
        ';border:1px solid ' + (strong ? col : C.line) + ';border-radius:10px;padding:4px 11px" dir="ltr">' +
        '<span style="font-size:.72rem;color:' + C.inkSoft + '">' + label + '</span>' +
        '<b style="font-size:1rem;color:' + col + '">' + (val == null ? "—" : val) + '</b></span>';
    }
    return chip("d", d, C.inkSoft) +
      chip("q", q, C.inkSoft) +
      chip("h", st.hVal, C.blue, st.hVal != null) +
      chip("p", st.pHash, C.mustard, st.pHash != null) +
      chip("t_s", (st.activeS != null && st.curT != null ? st.curT : "—"), C.plum, st.activeS != null);
  }

  function renderTable(st) {
    var rows = st.shiftInfo.map(function (r) {
      var isAct = (st.activeS === r.s);
      var tCell = (r.t == null ? '<span style="color:' + C.inkSoft + '">—</span>'
        : '<b style="color:' + C.plum + '">' + r.t + '</b>');
      var eq = (r.t == null) ? "" :
        (r.t === st.pHash
          ? '<span style="color:' + C.mustard + ';font-weight:700">=</span>'
          : '<span style="color:' + C.inkSoft + '">≠</span>');
      return '<tr style="background:' + (isAct ? C.plumTint : "transparent") + '">' +
        '<td style="padding:4px 8px;font-weight:700;color:' + C.ink + '" dir="ltr">' + r.s + '</td>' +
        '<td style="padding:4px 8px;font-family:monospace;letter-spacing:1px;color:' + C.ink + '" dir="ltr">' + r.sub + '</td>' +
        '<td style="padding:4px 8px;text-align:center" dir="ltr">' + tCell + '</td>' +
        '<td style="padding:4px 8px;text-align:center">' + eq + '</td>' +
        '<td style="padding:4px 8px;text-align:center">' + statusChip(r.status) + '</td>' +
        '</tr>';
    }).join("");
    return '<table style="width:100%;border-collapse:collapse;font-size:.82rem">' +
      '<thead><tr style="color:' + C.inkSoft + ';font-size:.72rem;text-align:center">' +
      '<th style="padding:2px 8px;text-align:center" dir="ltr">s</th>' +
      '<th style="padding:2px 8px;text-align:center" dir="ltr">T[s+1..s+m]</th>' +
      '<th style="padding:2px 8px" dir="ltr">t_s</th>' +
      '<th style="padding:2px 8px">= p ?</th>' +
      '<th style="padding:2px 8px" dir="rtl">תוצאה</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  /* =====================================================================
     Render into a mount.
     ===================================================================== */
  function render(mount) {
    if (!mount || mount.getAttribute("data-rk-ready") === "1") return;
    mount.setAttribute("data-rk-ready", "1");
    mount.innerHTML = "";

    var STEPS = buildSteps();
    var idx = 0;
    var autoTimer = null;

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");
    wrap.style.outline = "none";

    /* intro line */
    var intro = document.createElement("div");
    intro.style.cssText = "background:" + C.surface2 + ";border:1px solid " + C.line +
      ";border-radius:10px;padding:8px 12px;margin-bottom:10px;color:" + C.ink +
      ";font-size:.84rem;line-height:1.6";
    intro.innerHTML =
      'דוגמת ההרצאה: <span dir="ltr">T = ababbabbab</span> (<span dir="ltr">n=10</span>), ' +
      '<span dir="ltr">P = abba</span> (<span dir="ltr">m=4</span>). ' +
      'ה-<span dir="ltr">hash</span> ממפה <span dir="ltr">a→1, b→2</span> בבסיס ' +
      '<span dir="ltr">d=10</span> ומודולו <span dir="ltr">q=17</span> ' +
      '<span style="color:' + C.inkSoft + '">(דוגמה שלנו — הבחירה מדגימה שתי פגיעות שווא)</span>.';
    wrap.appendChild(intro);

    /* scene */
    var scene = buildScene();
    var sceneBox = document.createElement("div");
    sceneBox.style.cssText = "background:" + C.surface + ";border-radius:12px;padding:6px 4px;border:1px solid " + C.line;
    sceneBox.appendChild(scene.svg);
    wrap.appendChild(sceneBox);

    /* hash chips bar */
    var hashBar = document.createElement("div");
    hashBar.setAttribute("aria-live", "polite");
    hashBar.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 10px;justify-content:center";
    wrap.appendChild(hashBar);

    /* two-column: table + explanation */
    var grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;align-items:start";

    var tableBox = document.createElement("div");
    tableBox.style.cssText = "background:" + C.surface + ";border:1px solid " + C.line +
      ";border-radius:12px;padding:8px 10px;overflow-x:auto";
    grid.appendChild(tableBox);

    var panel = document.createElement("div");
    panel.setAttribute("aria-live", "polite");
    panel.style.cssText = "background:" + C.surface2 + ";border:1px solid " + C.line +
      ";border-radius:12px;padding:12px 14px;color:" + C.ink + ";line-height:1.7;font-size:.9rem;min-height:150px";
    grid.appendChild(panel);
    wrap.appendChild(grid);

    /* progress line */
    var prog = document.createElement("div");
    prog.style.cssText = "text-align:center;color:" + C.inkSoft + ";font-size:.8rem;margin-top:10px";
    wrap.appendChild(prog);

    /* controls */
    var controls = document.createElement("div");
    controls.className = "viz-controls";
    controls.style.justifyContent = "center";

    function mkBtn(label, fn, primary) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn" + (primary ? " primary" : "");
      b.innerHTML = label;
      b.addEventListener("click", fn);
      return b;
    }
    var btnPrev = mkBtn("→ הקודם", function () { stopAuto(); go(idx - 1); });
    var btnNext = mkBtn("הבא ←", function () { stopAuto(); go(idx + 1); }, true);
    var btnPlay = mkBtn("▶ הפעל", function () { toggleAuto(); });
    var btnReset = mkBtn("↺ איפוס", function () { stopAuto(); go(0); });
    controls.appendChild(btnPrev);
    controls.appendChild(btnNext);
    controls.appendChild(btnPlay);
    controls.appendChild(btnReset);
    wrap.appendChild(controls);

    /* SR-only live status */
    var status = document.createElement("p");
    status.setAttribute("aria-live", "polite");
    status.style.cssText = "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;" +
      "clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;";
    wrap.appendChild(status);

    mount.appendChild(wrap);

    /* ---- navigation ---- */
    function go(n2, animate) {
      idx = Math.max(0, Math.min(STEPS.length - 1, n2));
      var st = STEPS[idx];
      applyStep(scene, st, animate !== false);
      hashBar.innerHTML = renderHashBar(st);
      tableBox.innerHTML = renderTable(st);
      panel.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
        '<span style="background:' + st.color + ';color:#fff;font-weight:700;font-size:.72rem;' +
        'padding:2px 10px;border-radius:99px" dir="ltr">' + st.badge + '</span>' +
        '<b style="font-size:1rem;color:' + C.ink + '">' + st.title + '</b></div>' +
        '<div>' + st.body + '</div>';
      prog.textContent = "שלב " + (idx + 1) + " מתוך " + STEPS.length;
      status.textContent = st.title + ". " + st.body.replace(/<[^>]+>/g, "");
      btnPrev.disabled = (idx === 0);
      btnNext.disabled = (idx === STEPS.length - 1);
    }

    /* ---- autoplay ---- */
    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }
    function startAuto() {
      if (idx >= STEPS.length - 1) go(0);
      btnPlay.innerHTML = "⏸ השהה";
      btnPlay.classList.add("primary");
      var delay = reducedMotion() ? 2100 : 2600;
      autoTimer = setInterval(function () {
        if (idx >= STEPS.length - 1) { stopAuto(); return; }
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
      else if (e.key === "End") { stopAuto(); go(STEPS.length - 1); e.preventDefault(); }
      else if (e.key === " ") { toggleAuto(); e.preventDefault(); }
    });

    /* initial paint (no slide animation) */
    go(0, false);
  }

  /* =====================================================================
     boot: mount all instances; never throw.
     ===================================================================== */
  function boot() {
    try {
      var mounts = document.querySelectorAll('[data-viz="' + VIZ_ID + '"]');
      if (!mounts || !mounts.length) return;
      Array.prototype.forEach.call(mounts, function (m2) { render(m2); });
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
