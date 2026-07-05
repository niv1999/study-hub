/* =====================================================================
   complexity-flashcards.js  —  Module 14 "הכנה למבחן" (unit-8, slate)
   Grounded in _notes/01-intro.md (course-booklet pseudo-code inventory:
   BFS, DFS, SCC, Prim, Kruskal, Dijkstra, Bellman-Ford, Floyd-Warshall,
   Ford-Fulkerson, Naive/Rabin-Karp/KMP/prefix-function, RECURSIVE-FFT)
   and _notes/13-exam.md (tirgul-13 randomized algorithms: Las-Vegas vs
   Monte-Carlo, randomized Quicksort, Freivalds O(n^2), Karger, uniform
   sampling E[bits]=O(log n), create_fair_coin E[flips]=1/(P(1-P))).

   The complexities themselves are NOT written in the booklet (the notes say
   so explicitly) — they are the classic, well-documented CLRS values that
   the course teaches, and the brief asks for a "טבלת סיבוכיות מסכמת לכל
   האלגוריתמים". Per CONTRACT's grounding EXCEPTION they clarify what the
   course already teaches; no algorithm/topic beyond the syllabus is added.

   A self-test flash-card deck: flip each card (click / Enter / Space) to
   reveal its time-complexity + main idea. Two modes — לימוד (browse) and
   בוחן (random self-graded quiz). Live bookkeeping = deck position, per-unit
   composition, and the quiz scoreboard (ידעתי / לא ידעתי / נותרו) + a
   per-unit breakdown of misses at the end — that is the pedagogy.

   Self-contained IIFE, no globals, no external deps. Works on a static
   server AND file://. Cream design tokens hardcoded (CONTRACT §2). RTL
   Hebrew UI; algorithm identifiers stay English/LTR. prefers-reduced-motion
   respected; keyboard accessible; zero console errors; graceful if no mount.
   ===================================================================== */
(function () {
  "use strict";

  var VIZ_ID = "complexity-flashcards";

  /* --- design palette (hardcoded per CONTRACT §2, matched to style.css) --- */
  var C = {
    bg: "#FBF7F0",
    surface: "#FFFDF8",
    surface2: "#FBF5EA",
    ink: "#33302B",
    inkSoft: "#6B655C",
    line: "#E7DECF",
    blue: "#6E8CA0",   /* unit-1 dusty-blue */
    sage: "#7C9885",   /* unit-2 sage */
    clay: "#BE7C5E",   /* unit-3 clay */
    mustard: "#C9A24B",/* unit-4 mustard */
    plum: "#9B7E9E",   /* unit-5 plum */
    teal: "#69A297",   /* unit-6 teal */
    rose: "#BE7C8F",   /* unit-7 rose */
    slate: "#7E8CA0"   /* unit-8 slate (page accent) */
  };

  /* --- categories (mapped to the 8 syllabus units + accent colour) --- */
  var CAT = {
    g:    { he: "יסודות וגרפים",      color: C.blue },
    mst:  { he: "עצים פורשים",         color: C.sage },
    sp:   { he: "מסלולים קצרים",       color: C.clay },
    flow: { he: "רשתות זרימה",         color: C.mustard },
    str:  { he: "התאמת מחרוזות",       color: C.plum },
    fft:  { he: "FFT",                 color: C.teal },
    rand: { he: "אלגוריתמים אקראיים",  color: C.rose }
  };
  var CAT_ORDER = ["g", "mst", "sp", "flow", "str", "fft", "rand"];

  /* --- the deck. big = the tested headline (mostly complexity, LTR).
     idea/tech = the "main idea" side. All grounded in the notes inventory. --- */
  var CARDS = [
    { cat: "g", name: "BFS", he: "חיפוש לרוחב",
      big: "Θ(V + E)",
      idea: "סורק את הגרף לפי מרחק עולה מהמקור s — גל־אחר־גל.",
      tech: 'תור <span dir="ltr">FIFO</span>; <span dir="ltr">color/d[u]/π[u]</span>; כל קדקוד וכל קשת נבדקים פעם אחת.',
      src: "01-intro · חוברת עמ' 2 (Fig 22.3)" },

    { cat: "g", name: "DFS", he: "חיפוש לעומק",
      big: "Θ(V + E)",
      idea: "צולל לעומק רקורסיבית וחוזר לאחור; מסמן חותמות זמן גילוי וסיום.",
      tech: 'מחסנית רקורסיה; <span dir="ltr">d[u]</span>=discovery, <span dir="ltr">f[u]</span>=finish; משפט הסוגריים.',
      src: "01-intro · חוברת עמ' 4 (Fig 22.4)" },

    { cat: "g", name: "SCC", he: "רכיבים קשירים היטב",
      big: "Θ(V + E)",
      idea: "שתי ריצות DFS: על G לפי סדר, ואז על הטרנספוז Gᵀ בסדר finish יורד.",
      tech: 'DFS + טרנספוז <span dir="ltr">Gᵀ</span>; הרכיבים = עצי היער השני.',
      src: "01-intro · חוברת עמ' 7 (Fig 22.9)" },

    { cat: "mst", name: "MST-Prim", he: "פרים",
      big: "O(E log V)",
      sub: 'עם מערך: <span dir="ltr">O(V²)</span> · ערימת פיבונאצ\'י: <span dir="ltr">O(E + V log V)</span>',
      idea: "חמדן: מגדל עץ יחיד — בכל צעד מוסיף את הקשת הקלה ביותר היוצאת מהעץ.",
      tech: 'תור עדיפויות מינימום; <span dir="ltr">key[u]</span> = משקל הקשת הקלה המחברת את u לעץ.',
      src: "01-intro · חוברת עמ' 10 (Fig 23.5)" },

    { cat: "mst", name: "MST-Kruskal", he: "קרוסקל",
      big: "O(E log V)",
      sub: 'נשלט ע"י מיון הקשתות: <span dir="ltr">O(E log E) = O(E log V)</span>',
      idea: "חמדן: ממיין את הקשתות בסדר עולה ומוסיף קשת רק אם אינה סוגרת מעגל.",
      tech: 'מבנה Union-Find: <span dir="ltr">MAKE-SET / FIND-SET / UNION</span>.',
      src: "01-intro · חוברת עמ' 12 (Fig 23.4)" },

    { cat: "mst", name: "Union-Find", he: "קבוצות זרות",
      big: "≈ O(α(n))",
      sub: "לפעולה, משוערך (amortized)",
      idea: "מנהל קבוצות זרות; בודק אם שני קדקודים באותו רכיב ומאחד רכיבים.",
      tech: 'איחוד לפי דרגה (union by rank) + כיווץ מסלול (path compression) → כמעט קבוע.',
      src: "01-intro · חוברת עמ' 12 (בשירות Kruskal)" },

    { cat: "sp", name: "Dijkstra", he: "דייקסטרה",
      big: "O(E log V)",
      sub: 'עם מערך: <span dir="ltr">O(V²)</span> · דורש משקלים ≥ 0',
      idea: "חמדן: מוציא כל פעם את הקדקוד עם אומדן d מינימלי ומקיל (relax) את שכניו.",
      tech: 'תור עדיפויות מינימום; <span dir="ltr">RELAX(u,v,w)</span>; קדקוד סגור לא נפתח שוב.',
      src: "01-intro · חוברת עמ' 15 (Fig 24.6)" },

    { cat: "sp", name: "Bellman-Ford", he: "בלמן־פורד",
      big: "O(V · E)",
      sub: "משקלים ב-ℝ · מזהה מעגל שלילי",
      idea: "מבצע |V|−1 סבבים של relaxation על כל הקשתות; מעבר נוסף מגלה מעגל שלילי.",
      tech: 'הקלה חוזרת על כל הקשתות; מחזיר <span dir="ltr">FALSE</span> אם עוד ניתן להקל.',
      src: "01-intro · חוברת עמ' 16 (Fig 24.4)" },

    { cat: "sp", name: "Floyd-Warshall", he: "פלויד־וורשאל",
      big: "Θ(V³)",
      sub: "כל הזוגות (all-pairs) · תכנון דינמי",
      idea: "מתיר בהדרגה קדקודי־ביניים מ־{1..k} וממזער דרך k.",
      tech: 'נוסחה: <span dir="ltr">d_ij^(k) = min(d_ij^(k−1), d_ik^(k−1) + d_kj^(k−1))</span>.',
      src: "01-intro · חוברת עמ' 19 (Fig 25.4)" },

    { cat: "sp", name: "Difference constraints", he: "אילוצי הפרשים",
      big: "O(V · E)",
      sub: "רדוקציה ל-Bellman-Ford",
      idea: "מערכת אי־שוויונות xᵢ − xⱼ ≤ bₖ הופכת לגרף אילוצים; פתרון = מסלול קצר.",
      tech: 'קשת <span dir="ltr">(vⱼ→vᵢ)</span> במשקל bₖ; פתרון <span dir="ltr">xᵢ = δ(v₀, vᵢ)</span>.',
      src: "01-intro · חוברת עמ' 17-18 (Fig 24.8)" },

    { cat: "flow", name: "Ford-Fulkerson", he: "פורד־פלקרסון",
      big: "O(E · |f*|)",
      sub: 'קיבולים שלמים · <span dir="ltr">Edmonds-Karp</span>: <span dir="ltr">O(V·E²)</span>',
      idea: "מגדיל זרימה לאורך מסלול משפר (augmenting path) ברשת השיורית עד שאין כזה.",
      tech: 'רשת שיורית <span dir="ltr">G_f</span>, קיבול שיורי; חתך מינימלי = זרימה מקסימלית.',
      src: "01-intro · חוברת עמ' 21 (Fig 26.5)" },

    { cat: "str", name: "Naive matcher", he: "התאמה נאיבית",
      big: "O((n−m+1)·m)",
      idea: "בודק כל הזזה s אפשרית ומשווה תו־תו את התבנית מול הטקסט.",
      tech: 'ללא עיבוד מקדים; במקרה הגרוע כל הזזה עולה <span dir="ltr">Θ(m)</span>.',
      src: "01-intro · חוברת עמ' 22" },

    { cat: "str", name: "Rabin-Karp", he: "רבין־קרפ",
      big: "O(n + m)",
      sub: 'בממוצע · במקרה הגרוע <span dir="ltr">O((n−m+1)·m)</span>',
      idea: "ממיר חלון למספר (hash) מתגלגל mod q; בדיקה מלאה רק על התנגשויות.",
      tech: 'hash מתגלגל בזמן קבוע לחלון; <span dir="ltr">spurious hit</span> = ערכים שווים אך מחרוזות שונות.',
      src: "01-intro · חוברת עמ' 22-23 (Fig 32.5)" },

    { cat: "str", name: "KMP", he: "קנות'־מוריס־פראט",
      big: "O(n + m)",
      idea: "סורק את הטקסט בלי לחזור אחורה — מדלג בעזרת פונקציית הרישא.",
      tech: 'פונקציית הרישא <span dir="ltr">π</span>; בכישלון קופץ ל-<span dir="ltr">q ← π[q]</span>.',
      src: "01-intro · חוברת עמ' 25 (Fig 32.10)" },

    { cat: "str", name: "Compute-prefix-function", he: "פונקציית הרישא",
      big: "Θ(m)",
      idea: "מחשב לכל q את אורך הרישא הארוכה ביותר של P שהיא גם סיפא נאותה של P[1..q].",
      tech: 'עיבוד מקדים ל-KMP; <span dir="ltr">π[ababababca] = [0,0,1,2,3,4,5,6,0,1]</span>.',
      src: "01-intro · חוברת עמ' 24-25" },

    { cat: "str", name: "Matching via convolution", he: "התאמה בקונבולוציה",
      big: "O(n log n)",
      sub: "מבוסס FFT",
      idea: "מנסח התאמת מחרוזות כקונבולוציה ומחשב אותה מהר עם FFT.",
      tech: "מוזכר בסיכום הסמסטר לצד רבין־קרפ ו-KMP.",
      src: "13-exam · תרגול 13 עמ' 33" },

    { cat: "fft", name: "RECURSIVE-FFT", he: "התמרת פורייה מהירה",
      big: "Θ(n log n)",
      idea: "הפרד־ומשול: מפצל למקדמים זוגיים/אי־זוגיים ומאחד בשורשי היחידה.",
      tech: 'שורש יחידה <span dir="ltr">ω_n = e^(2πi/n)</span>; n חזקה של 2; פרפר (butterfly).',
      src: "01-intro · חוברת עמ' 26" },

    { cat: "fft", name: "Polynomial multiplication", he: "כפל פולינומים",
      big: "Θ(n log n)",
      sub: 'כפל רגיל (מקדם־מקדם): <span dir="ltr">Θ(n²)</span>',
      idea: "מעבר לייצוג נקודה־ערך, כפל נקודתי זול, וחזרה למקדמים.",
      tech: 'Evaluation + Interpolation ב-<span dir="ltr">Θ(n log n)</span>, Pointwise ב-<span dir="ltr">Θ(n)</span>.',
      src: "01-intro · חוברת עמ' 26 (Fig 30.1)" },

    { cat: "rand", name: "Las Vegas vs Monte Carlo", he: "שני סוגי אלגוריתמים אקראיים",
      big: "תוצאה מול משאבים",
      idea: "Las Vegas — תמיד תשובה נכונה, מהמר רק על זמן הריצה. Monte Carlo — זמן חסום, אך התוצאה עלולה להיות שגויה.",
      tech: 'דוגמאות: <span dir="ltr">Las Vegas</span> = randomized Quicksort · <span dir="ltr">Monte Carlo</span> = Freivalds, Karger.',
      src: "13-exam · תרגול 13 עמ' 2" },

    { cat: "rand", name: "Randomized Quicksort", he: "מיון מהיר אקראי",
      big: "O(n log n)",
      sub: 'בתוחלת · גרוע <span dir="ltr">O(n²)</span> · Las Vegas',
      idea: "בוחר ציר (pivot) אקראי — התוצאה תמיד ממוינת, רק זמן הריצה אקראי.",
      tech: "מהמר על משאבים (זמן), לא על נכונות → Las Vegas.",
      src: "13-exam · תרגול 13 עמ' 2" },

    { cat: "rand", name: "Freivalds", he: "אימות כפל מטריצות",
      big: "O(n²)",
      sub: 'לעומת כפל נאיבי <span dir="ltr">O(n³)</span> · Monte Carlo',
      idea: "מאמת AB=C ע\"י כפל בוקטור בוליאני אקראי v: משווה A(Bv) ל-Cv.",
      tech: 'שלושה כפלי מטריצה־וקטור <span dir="ltr">O(n²)</span>; הסתברות טעות ≤ ½, מוקטנת ל-<span dir="ltr">1/2ˣ</span> ב-x ריצות.',
      src: "13-exam · תרגול 13 עמ' 11-20" },

    { cat: "rand", name: "Karger", he: "חתך מינימלי אקראי",
      big: "Monte Carlo",
      idea: "מכווץ קשת אקראית שוב ושוב עד שנותרו שני קדקודים — הקשתות שנותרו הן חתך.",
      tech: "מחזיר חתך מינימלי בהסתברות; דוגמה קלאסית לאלגוריתם מונטה־קרלו.",
      src: "13-exam · תרגול 13 עמ' 33" },

    { cat: "rand", name: "Uniform sampling", he: "דגימה אחידה מ־{0..n−1}",
      big: "E[bits] = O(log n)",
      idea: "מגריל ⌈log n⌉ ביטים; אם המספר מחוץ לתחום — מגריל שוב (דחייה).",
      tech: 'N = 2^⌈log n⌉; <span dir="ltr">P(x=k | x<n) = (1/N)/(n/N) = 1/n</span>; תוחלת נסיונות N/n < 2.',
      src: "13-exam · תרגול 13 עמ' 5-8" },

    { cat: "rand", name: "create_fair_coin", he: "מטבע הוגן ממטבע מוטה",
      big: "E[flips] = 1 / (P(1−P))",
      idea: "מטיל זוגות; זורק (0,0)/(1,1) ומחזיר כשהזוג שונה — טריק פון־נוימן.",
      tech: 'P(שונים)=2P(1−P); <span dir="ltr">P(פלי) = P(1−P)/2P(1−P) = ½</span>; משתנה גאומטרי.',
      src: "13-exam · תרגול 13 עמ' 25-31" }
  ];

  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function shuffle(a) {           /* Fisher-Yates (in place) */
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* inject the (once-only) stylesheet needed for the 3-D flip + backface */
  function ensureStyle() {
    if (document.getElementById("cf-style")) return;
    var s = document.createElement("style");
    s.id = "cf-style";
    s.textContent =
      ".cf-card{perspective:1400px;}" +
      ".cf-inner{position:relative;width:100%;height:100%;" +
        "transition:transform .55s cubic-bezier(.4,.15,.2,1);transform-style:preserve-3d;}" +
      ".cf-inner.flip{transform:rotateY(180deg);}" +
      ".cf-face{position:absolute;inset:0;-webkit-backface-visibility:hidden;" +
        "backface-visibility:hidden;display:flex;flex-direction:column;" +
        "border-radius:18px;overflow:auto;box-sizing:border-box;}" +
      ".cf-back{transform:rotateY(180deg);}" +
      ".cf-card:focus-visible{outline:none;}" +
      ".cf-card:focus-visible .cf-inner{box-shadow:0 0 0 3px " + C.slate + "55;border-radius:18px;}" +
      "@media (prefers-reduced-motion: reduce){.cf-inner{transition:none;}}";
    document.head.appendChild(s);
  }

  /* ---------------------------------------------------------------
     render one mount
     --------------------------------------------------------------- */
  function render(mount) {
    if (!mount || mount.getAttribute("data-cf-ready") === "1") return;
    mount.setAttribute("data-cf-ready", "1");
    mount.innerHTML = "";
    ensureStyle();

    /* ---- state ---- */
    var st = {
      mode: "study",     /* "study" | "quiz" */
      filter: "all",     /* "all" | category key */
      deck: [],          /* array of card objects (filtered, maybe shuffled) */
      pos: 0,
      flipped: false,
      results: {},       /* name -> true(ידעתי)/false(לא ידעתי) in quiz */
      finished: false
    };
    var autoTimer = null;  /* study-mode auto-play (slideshow) interval id */
    var autoPhase = 0;     /* 0 = front showing (about to flip), 1 = back showing (about to advance) */

    var wrap = document.createElement("div");
    wrap.style.direction = "rtl";
    wrap.setAttribute("tabindex", "0");
    wrap.style.outline = "none";

    /* ===== mode toggle ===== */
    var modeRow = document.createElement("div");
    modeRow.className = "viz-controls";
    modeRow.style.marginTop = "0";
    modeRow.style.marginBottom = ".7rem";
    var modeLbl = document.createElement("span");
    modeLbl.textContent = "מצב:";
    modeLbl.style.cssText = "font-weight:700;color:" + C.ink + ";font-size:.9rem;";
    modeRow.appendChild(modeLbl);
    var btnStudy = mkBtn("📖 לימוד", function () { setMode("study"); });
    var btnQuiz = mkBtn("🎯 בוחן אקראי", function () { setMode("quiz"); });
    modeRow.appendChild(btnStudy);
    modeRow.appendChild(btnQuiz);
    wrap.appendChild(modeRow);

    /* ===== category filter chips ===== */
    var filterRow = document.createElement("div");
    filterRow.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-bottom:.85rem;";
    var filterChips = [];
    function mkChip(key, label, color) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn";
      b.textContent = label;
      b.style.cssText = "padding:.24rem .6rem;font-size:.78rem;border-radius:99px;";
      b.setAttribute("data-key", key);
      b.addEventListener("click", function () { setFilter(key); });
      filterRow.appendChild(b);
      filterChips.push({ b: b, key: key, color: color });
      return b;
    }
    mkChip("all", "כל האלגוריתמים", C.slate);
    CAT_ORDER.forEach(function (k) { mkChip(k, CAT[k].he, CAT[k].color); });
    wrap.appendChild(filterRow);

    /* ===== the flash card ===== */
    var cardBox = document.createElement("div");
    cardBox.className = "cf-card";
    cardBox.style.cssText =
      "height:340px;max-width:560px;margin:0 auto;cursor:pointer;";
    cardBox.setAttribute("tabindex", "0");
    cardBox.setAttribute("role", "button");
    cardBox.setAttribute("aria-label", "כרטיסיית סיבוכיות — לחצו להפיכה");

    var inner = document.createElement("div");
    inner.className = "cf-inner";
    var faceFront = document.createElement("div");
    faceFront.className = "cf-face cf-front";
    var faceBack = document.createElement("div");
    faceBack.className = "cf-face cf-back";
    inner.appendChild(faceFront);
    inner.appendChild(faceBack);
    cardBox.appendChild(inner);
    wrap.appendChild(cardBox);

    cardBox.addEventListener("click", function () { doFlip(); });
    cardBox.addEventListener("keydown", function (e) {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); doFlip(); }
    });

    /* ===== quiz self-grade row (shown only in quiz after a flip) ===== */
    var gradeRow = document.createElement("div");
    gradeRow.className = "viz-controls";
    gradeRow.style.justifyContent = "center";
    gradeRow.style.marginTop = ".7rem";
    var btnKnew = mkBtn("✓ ידעתי", function () { grade(true); }, true);
    var btnMissed = mkBtn("✗ לא ידעתי", function () { grade(false); });
    btnKnew.style.background = C.sage; btnKnew.style.borderColor = C.sage; btnKnew.style.color = "#fff";
    btnMissed.style.background = C.clay; btnMissed.style.borderColor = C.clay; btnMissed.style.color = "#fff";
    gradeRow.appendChild(btnKnew);
    gradeRow.appendChild(btnMissed);
    wrap.appendChild(gradeRow);

    /* ===== navigation controls ===== */
    var controls = document.createElement("div");
    controls.className = "viz-controls";
    controls.style.marginTop = ".7rem";
    var btnPrev = mkBtn("→ הקודם", function () { go(st.pos - 1); });
    var btnNext = mkBtn("הבא ←", function () { go(st.pos + 1); }, true);
    var btnPlay = mkBtn("▶ הפעל", function () { toggleAuto(); });
    var btnShuffle = mkBtn("🔀 ערבב", function () { doShuffle(); });
    var btnReset = mkBtn("↺ איפוס", function () { resetDeck(true); });
    controls.appendChild(btnPrev);
    controls.appendChild(btnNext);
    controls.appendChild(btnPlay);
    controls.appendChild(btnShuffle);
    controls.appendChild(btnReset);
    wrap.appendChild(controls);

    /* ===== explanation line (per-step Hebrew narration) ===== */
    var note = document.createElement("p");
    note.setAttribute("aria-live", "polite");
    note.style.cssText =
      "margin:.7rem 0 0;padding:.55rem .7rem;border-radius:10px;font-size:.85rem;" +
      "background:" + C.surface2 + ";border:1px solid " + C.line + ";color:" + C.ink +
      ";line-height:1.6;min-height:1.2em;";
    wrap.appendChild(note);

    /* ===== live bookkeeping panel (deck state / quiz scoreboard) ===== */
    var book = document.createElement("div");
    book.style.cssText =
      "margin-top:.7rem;padding:.6rem .7rem;border-radius:12px;background:" +
      C.surface + ";border:1px solid " + C.line + ";";
    wrap.appendChild(book);

    mount.appendChild(wrap);

    /* ---------------------------------------------------------------
       helpers
       --------------------------------------------------------------- */
    function mkBtn(label, fn, primary) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "viz-btn" + (primary ? " primary" : "");
      b.innerHTML = label;
      b.addEventListener("click", fn);
      return b;
    }

    function buildDeck() {
      var list = CARDS.filter(function (c) {
        return st.filter === "all" || c.cat === st.filter;
      });
      if (st.mode === "quiz") shuffle(list);
      st.deck = list;
      st.pos = 0;
      st.flipped = false;
      st.results = {};
      st.finished = false;
    }

    function faceHTML(card) {
      var cat = CAT[card.cat];
      /* --- FRONT (question) --- */
      faceFront.style.cssText +=
        ";background:" + C.surface +
        ";border:2px solid " + cat.color +
        ";padding:22px 20px;align-items:center;justify-content:center;text-align:center;";
      faceFront.innerHTML =
        '<div style="align-self:flex-start;background:' + cat.color + ';color:#fff;' +
          'font-weight:700;font-size:.72rem;padding:3px 11px;border-radius:99px;">' +
          cat.he + '</div>' +
        '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;">' +
          '<div dir="ltr" style="font-size:1.7rem;font-weight:800;color:' + C.ink +
            ';font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:.5px;">' +
            card.name + '</div>' +
          '<div style="font-size:1rem;color:' + C.inkSoft + ';font-weight:600;">' + card.he + '</div>' +
          '<div style="font-size:2.4rem;color:' + cat.color + ';opacity:.5;font-weight:800;margin-top:4px;">?</div>' +
        '</div>' +
        '<div style="font-size:.76rem;color:' + C.inkSoft + ';">נסו להיזכר בסיבוכיות וברעיון — ואז הפכו את הכרטיס</div>';

      /* --- BACK (answer) --- */
      var subHtml = card.sub
        ? '<div dir="ltr" style="font-size:.82rem;color:' + C.inkSoft + ';margin-top:2px;">' + card.sub + '</div>'
        : "";
      faceBack.style.cssText +=
        ";background:" + C.surface2 +
        ";border:2px solid " + cat.color +
        ";border-top:6px solid " + cat.color +
        ";padding:18px 20px;text-align:right;";
      faceBack.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
          '<span dir="ltr" style="font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:800;' +
            'font-size:1.05rem;color:' + C.ink + ';">' + card.name + '</span>' +
          '<span style="background:' + cat.color + ';color:#fff;font-weight:700;font-size:.68rem;' +
            'padding:3px 10px;border-radius:99px;">' + cat.he + '</span>' +
        '</div>' +
        '<div style="margin-top:12px;">' +
          '<div style="font-size:.72rem;color:' + C.inkSoft + ';font-weight:700;">סיבוכיות</div>' +
          '<div dir="ltr" style="font-size:1.5rem;font-weight:800;color:' + cat.color +
            ';font-family:ui-monospace,Menlo,Consolas,monospace;">' + card.big + '</div>' +
          subHtml +
        '</div>' +
        '<div style="height:1px;background:' + C.line + ';margin:12px 0;"></div>' +
        '<div style="font-size:.9rem;color:' + C.ink + ';line-height:1.65;">' +
          '<b style="color:' + cat.color + ';">הרעיון: </b>' + card.idea + '</div>' +
        '<div style="font-size:.86rem;color:' + C.inkSoft + ';line-height:1.6;margin-top:8px;">' +
          '<b>מבנה / טכניקה: </b>' + card.tech + '</div>' +
        '<div style="margin-top:auto;padding-top:10px;font-size:.72rem;color:' + C.inkSoft +
          ';opacity:.85;">מקור: ' + card.src + '</div>';
    }

    /* apply the flip visual for the current st.flipped */
    function applyFlip() {
      if (st.flipped) inner.classList.add("flip");
      else inner.classList.remove("flip");
      cardBox.setAttribute("aria-pressed", st.flipped ? "true" : "false");
    }

    function doFlip() {
      if (st.finished) return;
      stopAuto();
      st.flipped = !st.flipped;
      applyFlip();
      updateGradeRow();
      var card = st.deck[st.pos];
      if (st.flipped) {
        say("הפכת את הכרטיס — <span dir=\"ltr\">" + card.name + "</span>: הסיבוכיות היא <b dir=\"ltr\">" +
          card.big + "</b>." + (st.mode === "quiz" ? " סמנו אם ידעתם." : ""));
      } else {
        say("חזרת לצד השאלה של <span dir=\"ltr\">" + card.name + "</span>.");
      }
    }

    function go(n) {
      if (st.finished) return;
      stopAuto();
      var len = st.deck.length;
      if (len === 0) return;
      /* in quiz mode you must grade before leaving a card via "next" */
      var clamped = Math.max(0, Math.min(len - 1, n));
      if (clamped === st.pos && n !== st.pos) {
        /* hit an edge */
        say(n < 0 ? "זה הכרטיס הראשון בחפיסה." : "זה הכרטיס האחרון בחפיסה.");
        return;
      }
      st.pos = clamped;
      st.flipped = false;
      applyFlip();
      showCard();
      var card = st.deck[st.pos];
      say("כרטיס " + (st.pos + 1) + " מתוך " + len + " — <span dir=\"ltr\">" +
        card.name + "</span> (" + CAT[card.cat].he + ").");
    }

    function doShuffle() {
      if (st.deck.length === 0) return;
      stopAuto();
      shuffle(st.deck);
      st.pos = 0;
      st.flipped = false;
      st.results = {};
      st.finished = false;
      applyFlip();
      showCard();
      say("ערבבת את החפיסה — סדר חדש של " + st.deck.length + " כרטיסים.");
    }

    /* ---------------------------------------------------------------
       auto-play (study-mode slideshow): reveals each card then advances,
       hands-free revision. Alternating phase on a fixed interval; stops at
       the last card. prefers-reduced-motion → the CSS already drops the flip
       transition, we only lengthen the dwell a touch. Any manual action
       (flip / nav / shuffle / reset / mode / filter) halts it.
       --------------------------------------------------------------- */
    function autoTick() {
      if (st.mode !== "study" || st.finished || st.deck.length === 0) { stopAuto(); return; }
      if (autoPhase === 0) {
        if (!st.flipped) {
          st.flipped = true;
          applyFlip();
          var card = st.deck[st.pos];
          say("הצגה אוטומטית — <span dir=\"ltr\">" + card.name + "</span>: הסיבוכיות היא <b dir=\"ltr\">" +
            card.big + "</b>.");
        }
        autoPhase = 1;
      } else {
        if (st.pos >= st.deck.length - 1) {
          stopAuto();
          say("ההצגה האוטומטית הסתיימה — זה הכרטיס האחרון בחפיסה.");
          return;
        }
        st.pos += 1;
        st.flipped = false;
        applyFlip();
        showCard();
        autoPhase = 0;
      }
    }
    function startAuto() {
      if (st.mode !== "study" || st.finished || st.deck.length === 0 || autoTimer) return;
      st.flipped = false;
      applyFlip();
      showCard();
      autoPhase = 0;
      btnPlay.innerHTML = "⏸ עצור";
      btnPlay.classList.add("primary");
      btnPlay.setAttribute("aria-pressed", "true");
      autoTimer = setInterval(autoTick, reducedMotion() ? 1900 : 1700);
      say("הצגה אוטומטית פועלת — הכרטיסים נהפכים ומתקדמים לבד. לחצו „עצור” בכל רגע.");
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      btnPlay.innerHTML = "▶ הפעל";
      btnPlay.classList.remove("primary");
      btnPlay.setAttribute("aria-pressed", "false");
    }
    function toggleAuto() { if (autoTimer) stopAuto(); else startAuto(); }

    /* quiz self-grading */
    function grade(knew) {
      if (st.mode !== "quiz" || !st.flipped || st.finished) return;
      var card = st.deck[st.pos];
      st.results[card.name] = knew;
      say((knew ? "✓ סימנת \"ידעתי\"" : "✗ סימנת \"לא ידעתי\"") +
        " עבור <span dir=\"ltr\">" + card.name + "</span>.");
      /* advance to next ungraded/next card, or finish */
      if (st.pos >= st.deck.length - 1) {
        st.finished = true;
        renderFinished();
        renderBook();
        updateGradeRow();
        renderControls();
        return;
      }
      st.pos += 1;
      st.flipped = false;
      applyFlip();
      showCard();
    }

    function resetDeck(narrate) {
      stopAuto();
      buildDeck();
      applyFlip();
      showCard();
      renderControls();
      if (narrate) {
        say(st.mode === "quiz"
          ? "בוחן חדש — " + st.deck.length + " כרטיסים בסדר אקראי. הפכו כל כרטיס וסמנו אם ידעתם."
          : "החפיסה אופסה — " + st.deck.length + " כרטיסים.");
      }
    }

    function setMode(m) {
      if (st.mode === m) return;
      stopAuto();
      st.mode = m;
      btnStudy.classList.toggle("primary", m === "study");
      btnQuiz.classList.toggle("primary", m === "quiz");
      btnStudy.setAttribute("aria-pressed", m === "study" ? "true" : "false");
      btnQuiz.setAttribute("aria-pressed", m === "quiz" ? "true" : "false");
      resetDeck(false);
      say(m === "quiz"
        ? "עברת למצב בוחן: " + st.deck.length + " כרטיסים אקראיים, סמנו ידעתי / לא ידעתי אחרי כל הפיכה."
        : "עברת למצב לימוד: דפדפו בחופשיות והפכו כרטיסים כרצונכם.");
    }

    function setFilter(key) {
      stopAuto();
      st.filter = key;
      filterChips.forEach(function (fc) {
        var on = fc.key === key;
        fc.b.style.background = on ? fc.color : C.surface2;
        fc.b.style.color = on ? "#fff" : C.ink;
        fc.b.style.borderColor = on ? fc.color : C.line;
        fc.b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      resetDeck(false);
      var label = key === "all" ? "כל האלגוריתמים" : CAT[key].he;
      say("סוננת לנושא: " + label + " — " + st.deck.length + " כרטיסים.");
    }

    /* ---------------------------------------------------------------
       rendering
       --------------------------------------------------------------- */
    function showCard() {
      if (st.finished) { renderFinished(); renderBook(); updateGradeRow(); return; }
      var card = st.deck[st.pos];
      if (!card) return;
      cardBox.style.display = "";
      /* reset inline cssText baselines so faceHTML can append cleanly */
      faceFront.style.cssText = "";
      faceBack.style.cssText = "";
      faceFront.className = "cf-face cf-front";
      faceBack.className = "cf-face cf-back";
      faceHTML(card);
      renderBook();
      updateGradeRow();
      renderControls();
    }

    function renderFinished() {
      cardBox.style.display = "none";
    }

    function updateGradeRow() {
      var show = (st.mode === "quiz" && st.flipped && !st.finished);
      gradeRow.style.display = show ? "" : "none";
    }

    function renderControls() {
      var len = st.deck.length;
      btnPrev.style.display = st.mode === "quiz" ? "none" : "";
      btnNext.style.display = st.mode === "quiz" ? "none" : "";
      btnPlay.style.display = st.mode === "study" ? "" : "none";
      btnShuffle.style.display = st.mode === "study" ? "" : "none";
      btnPrev.disabled = (st.pos <= 0);
      btnNext.disabled = (st.pos >= len - 1);
      btnReset.innerHTML = st.mode === "quiz" ? "↺ בוחן חדש" : "↺ איפוס";
    }

    function countByCat(list) {
      var m = {};
      CAT_ORDER.forEach(function (k) { m[k] = 0; });
      list.forEach(function (c) { m[c.cat] += 1; });
      return m;
    }

    function renderBook() {
      var len = st.deck.length;
      if (st.mode === "study") {
        var counts = countByCat(st.deck);
        var legend = CAT_ORDER.filter(function (k) { return counts[k] > 0; })
          .map(function (k) {
            return '<span style="display:inline-flex;align-items:center;gap:5px;">' +
              '<span style="width:11px;height:11px;border-radius:3px;background:' + CAT[k].color + ';"></span>' +
              CAT[k].he + ' <b>' + counts[k] + '</b></span>';
          }).join('<span style="color:' + C.line + '">·</span> ');
        book.innerHTML =
          '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:baseline;">' +
            '<b style="color:' + C.ink + ';font-size:.9rem;">כרטיס ' + (len ? st.pos + 1 : 0) +
              ' מתוך ' + len + '</b>' +
            '<span style="font-size:.78rem;color:' + C.inkSoft + ';">מצב לימוד — דפדוף חופשי</span>' +
          '</div>' +
          '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px 12px;font-size:.78rem;color:' +
            C.ink + ';">' + legend + '</div>';
        return;
      }
      /* quiz scoreboard */
      var graded = Object.keys(st.results);
      var knew = graded.filter(function (n) { return st.results[n]; }).length;
      var missed = graded.length - knew;
      var remaining = len - graded.length;
      var pct = len ? Math.round((graded.length / len) * 100) : 0;

      if (st.finished) {
        /* per-cat breakdown of misses */
        var missCards = st.deck.filter(function (c) { return st.results[c.name] === false; });
        var missByCat = countByCat(missCards);
        var breakdown = CAT_ORDER.filter(function (k) { return missByCat[k] > 0; })
          .map(function (k) {
            return '<span style="display:inline-flex;align-items:center;gap:5px;">' +
              '<span style="width:11px;height:11px;border-radius:3px;background:' + CAT[k].color + ';"></span>' +
              CAT[k].he + ' <b>' + missByCat[k] + '</b></span>';
          }).join('<span style="color:' + C.line + '">·</span> ');
        var grade100 = len ? Math.round((knew / len) * 100) : 0;
        book.innerHTML =
          '<div style="text-align:center;">' +
            '<div style="font-size:1.05rem;font-weight:800;color:' + C.ink + ';">סיימת את הבוחן! 🎓</div>' +
            '<div style="font-size:2rem;font-weight:800;color:' + C.sage + ';margin:4px 0;">' +
              knew + ' / ' + len + '</div>' +
            '<div style="font-size:.85rem;color:' + C.inkSoft + ';">ידעת ' + grade100 + '% מהאלגוריתמים</div>' +
            (breakdown
              ? '<div style="margin-top:10px;font-size:.78rem;color:' + C.ink + ';">' +
                  '<div style="font-weight:700;margin-bottom:4px;">לחזור עליהם (' + missed + '):</div>' +
                  '<div style="display:flex;flex-wrap:wrap;gap:6px 12px;justify-content:center;">' + breakdown + '</div>' +
                '</div>'
              : '<div style="margin-top:8px;font-size:.82rem;color:' + C.sage + ';font-weight:700;">מושלם — ידעת הכול! 💪</div>') +
            '<div style="margin-top:10px;"><button type="button" class="viz-btn primary" ' +
              'style="background:' + C.slate + ';border-color:' + C.slate + ';" id="cf-again">↺ בוחן חדש</button></div>' +
          '</div>';
        var again = book.querySelector("#cf-again");
        if (again) again.addEventListener("click", function () { resetDeck(true); });
        return;
      }

      book.innerHTML =
        '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:baseline;">' +
          '<b style="color:' + C.ink + ';font-size:.9rem;">כרטיס ' + (st.pos + 1) + ' מתוך ' + len + '</b>' +
          '<span style="font-size:.82rem;">' +
            '<b style="color:' + C.sage + ';">✓ ' + knew + '</b> · ' +
            '<b style="color:' + C.clay + ';">✗ ' + missed + '</b> · ' +
            '<span style="color:' + C.inkSoft + ';">נותרו ' + remaining + '</span>' +
          '</span>' +
        '</div>' +
        '<div style="margin-top:8px;height:9px;border-radius:99px;background:' + C.line +
          ';overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:' + C.slate +
          ';transition:width .3s;"></div></div>';
    }

    function say(html) { note.innerHTML = html; }

    /* keyboard: RTL-aware (Right = prev, Left = next); study mode only for nav */
    wrap.addEventListener("keydown", function (e) {
      if (e.target === cardBox) return; /* let the card handle Space/Enter */
      if (st.mode === "study") {
        if (e.key === "ArrowRight") { go(st.pos - 1); e.preventDefault(); }
        else if (e.key === "ArrowLeft") { go(st.pos + 1); e.preventDefault(); }
        else if (e.key === "Home") { go(0); e.preventDefault(); }
        else if (e.key === "End") { go(st.deck.length - 1); e.preventDefault(); }
      }
    });

    /* ---- initial paint ---- */
    setFilter("all");
    btnStudy.classList.add("primary");
    btnStudy.setAttribute("aria-pressed", "true");
    say("בחרו כרטיס, נסו להיזכר בסיבוכיות — ואז לחצו כדי להפוך. עברו למצב בוחן לבדיקה עצמית.");
  }

  /* ---------------------------------------------------------------
     boot: mount all instances (guard for already-ready). Never throw.
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
