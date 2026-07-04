/* mss-mtu-calculator.js — MSS / MTU calculator + segmentation counter.
 * Grounds the EXACT lecturer model from _notes/sockets-transport-intro.md §12
 * ("MSS, MTU, segmentation math (worked)"), sourced from L05 (1).pdf:
 *
 *   MSS = MTU − (IP header) − (TCP header)      ["the leftover after subtracting
 *                                                 all headers from the MTU"]
 *   IPv4:  1500 − 20 (IP)  − 20 (TCP) = 1460    ["the magic point" — fills a full
 *                                                 Ethernet frame without fragmentation]
 *   IPv6:  1500 − 40 (IPv6)− 20 (TCP) = 1440    (IPv6 base header 40 B, 128-bit addrs)
 *   TCP Timestamps option (+12 B) ⇒ TCP header 32 B ⇒ eMSS 1448 (v4) / 1428 (v6)
 *
 *   Segments = ceil(payload / MSS)  →  N-1 "full" segments of MSS bytes
 *              + 1 "remainder" segment carrying (payload mod MSS) bytes.
 *   Worked Example B: 2500 B, IPv4 ⇒ 2 segments (1460 + 1040);
 *                     IPv6 ⇒ 2 segments (1440 + 1060). Seg-2 seq = X + MSS.
 *   Each packet on the wire = MSS(carried) + TCP hdr + IP hdr ≤ MTU (1500).
 *
 * Larger than MSS → Fragmentation (slowness); smaller → header Overhead.
 * Self-contained IIFE. No external libs. Cream design tokens hardcoded. RTL-aware,
 * English technical labels kept LTR. prefers-reduced-motion respected.
 */
(function () {
  'use strict';

  var VIZ_ID = 'mss-mtu-calculator';

  // --- design palette (hardcoded from CONTRACT §2) ---
  var C = {
    bg: '#FBF7F0', surface: '#FFFDF8', surface2: '#FBF5EA',
    ink: '#33302B', inkSoft: '#6B655C', line: '#E7DECF',
    blue: '#6E8CA0', clay: '#BE7C5E', sage: '#7C9885', mustard: '#C9A24B'
  };

  var SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function ltr(node) { node.setAttribute('dir', 'ltr'); return node; }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }

  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { reduceMotion = false; }

  // ---------------------------------------------------------------------------
  function render(mount) {
    if (!mount || mount.getAttribute('data-viz') !== VIZ_ID) return;
    if (mount.__mssDone) return;
    mount.__mssDone = true;
    mount.innerHTML = '';

    var uid = (mount.id || 'mss') + '-' + Math.random().toString(36).slice(2, 7);

    // ---- state (all header sizes are the lecturer's exact byte values) ----
    var state = {
      ipv: 4,            // 4 | 6
      mtu: 1500,         // Ethernet MTU (the "lowest common denominator")
      timestamps: false, // TCP Timestamps option (+12 B → TCP header 32 B)
      payload: 2500      // application-data bytes (Worked Example B default)
    };

    // Header sizes per the notes.
    function ipHdr() { return state.ipv === 6 ? 40 : 20; }        // IPv6 base = 40 B
    function tcpHdr() { return 20 + (state.timestamps ? 12 : 0); } // Timestamps +12 B
    function mss() { return state.mtu - ipHdr() - tcpHdr(); }      // MSS = MTU − IP − TCP
    function segCount() { return Math.max(1, Math.ceil(state.payload / mss())); }
    function remainder() {
      var r = state.payload % mss();
      return r === 0 ? mss() : r;
    }

    // ===================== DOM SHELL =====================
    var root = el('div', 'mss-root');
    root.setAttribute('dir', 'rtl');
    root.setAttribute('lang', 'he');

    var head = el('div', 'mss-head');
    head.appendChild(el('div', 'mss-title', 'מחשבון MSS / MTU וסופר Segmentation'));
    var sub = el('div', 'mss-sub');
    sub.appendChild(document.createTextNode('כמה '));
    sub.appendChild(ltr(el('span', 'mss-en', 'segments')));
    sub.appendChild(document.createTextNode(' נדרשים ל-payload נתון — לפי הנוסחה '));
    var f = ltr(el('span', 'mss-formula', 'MSS = MTU − IP − TCP'));
    sub.appendChild(f);
    head.appendChild(sub);
    root.appendChild(head);

    // ===================== CONTROLS (viz-controls / viz-btn) =====================
    var controls = el('div', 'viz-controls');

    // IPv4 / IPv6 segmented toggle (two real buttons)
    var ipGroup = el('div', 'mss-seg');
    ipGroup.setAttribute('role', 'group');
    ipGroup.setAttribute('aria-label', 'גרסת פרוטוקול IP');
    var ipv4Btn = el('button', 'viz-btn', 'IPv4');
    var ipv6Btn = el('button', 'viz-btn', 'IPv6');
    ipv4Btn.type = ipv6Btn.type = 'button';
    ltr(ipv4Btn); ltr(ipv6Btn);
    function setIp(v) {
      state.ipv = v;
      ipv4Btn.classList.toggle('primary', v === 4);
      ipv6Btn.classList.toggle('primary', v === 6);
      ipv4Btn.setAttribute('aria-pressed', v === 4 ? 'true' : 'false');
      ipv6Btn.setAttribute('aria-pressed', v === 6 ? 'true' : 'false');
      update();
    }
    ipv4Btn.addEventListener('click', function () { setIp(4); });
    ipv6Btn.addEventListener('click', function () { setIp(6); });
    ipGroup.appendChild(ipv4Btn);
    ipGroup.appendChild(ipv6Btn);
    controls.appendChild(ipGroup);

    // TCP Timestamps option toggle
    var tsBtn = el('button', 'viz-btn');
    tsBtn.type = 'button';
    function setTsLabel() {
      tsBtn.textContent = (state.timestamps ? '✓ ' : '＋ ') + 'TCP Timestamps (+12B)';
      tsBtn.classList.toggle('primary', state.timestamps);
      tsBtn.setAttribute('aria-pressed', state.timestamps ? 'true' : 'false');
    }
    tsBtn.addEventListener('click', function () {
      state.timestamps = !state.timestamps;
      setTsLabel();
      update();
    });
    setTsLabel();
    controls.appendChild(tsBtn);

    // Preset: Worked Example B (2500 bytes)
    var exBtn = el('button', 'viz-btn', 'דוגמה B: 2500 bytes');
    exBtn.type = 'button';
    exBtn.addEventListener('click', function () {
      state.payload = 2500; state.mtu = 1500; state.timestamps = false;
      setTsLabel();
      payloadSlider.value = '2500';
      mtuSlider.value = '1500';
      update();
    });
    controls.appendChild(exBtn);

    root.appendChild(controls);

    // ---- sliders (payload + MTU) ----
    var sliders = el('div', 'mss-sliders');

    // payload slider
    var pRow = el('div', 'mss-srow');
    var pLab = el('label', 'mss-slabel');
    pLab.setAttribute('for', uid + '-pl');
    pLab.appendChild(document.createTextNode('גודל ה-payload: '));
    var pVal = ltr(el('span', 'mss-sval'));
    pLab.appendChild(pVal);
    var payloadSlider = document.createElement('input');
    payloadSlider.type = 'range';
    payloadSlider.id = uid + '-pl';
    payloadSlider.className = 'mss-slider';
    payloadSlider.min = '1';
    payloadSlider.max = '20000';
    payloadSlider.step = '20';
    payloadSlider.value = String(state.payload);
    payloadSlider.setAttribute('aria-label', 'גודל ה-payload בבתים');
    payloadSlider.addEventListener('input', function () {
      state.payload = parseInt(payloadSlider.value, 10) || 1;
      update();
    });
    pRow.appendChild(pLab);
    pRow.appendChild(payloadSlider);
    sliders.appendChild(pRow);

    // MTU slider
    var mRow = el('div', 'mss-srow');
    var mLab = el('label', 'mss-slabel');
    mLab.setAttribute('for', uid + '-mtu');
    mLab.appendChild(document.createTextNode('MTU (מגבלת שכבה-2): '));
    var mVal = ltr(el('span', 'mss-sval'));
    mLab.appendChild(mVal);
    var mtuSlider = document.createElement('input');
    mtuSlider.type = 'range';
    mtuSlider.id = uid + '-mtu';
    mtuSlider.className = 'mss-slider';
    mtuSlider.min = '576';   // classic IPv4 minimum path MTU
    mtuSlider.max = '9000';  // jumbo frame
    mtuSlider.step = '4';
    mtuSlider.value = String(state.mtu);
    mtuSlider.setAttribute('aria-label', 'MTU בבתים');
    mtuSlider.addEventListener('input', function () {
      state.mtu = parseInt(mtuSlider.value, 10) || 1500;
      update();
    });
    mRow.appendChild(mLab);
    mRow.appendChild(mtuSlider);
    sliders.appendChild(mRow);

    root.appendChild(sliders);

    // ===================== MTU BUDGET BAR (one packet on the wire) =====================
    var budget = el('div', 'mss-budget');
    var budgetHead = el('div', 'mss-budget-head');
    budgetHead.appendChild(document.createTextNode('תקציב הבתים בחבילה אחת על הקו '));
    budgetHead.appendChild(ltr(el('span', 'mss-en', '(one packet ≤ MTU)')));
    budget.appendChild(budgetHead);

    var barW = 640, barH = 46;
    var budgetSvg = svg('svg', {
      viewBox: '0 0 ' + barW + ' ' + (barH + 26),
      width: '100%', role: 'img',
      'aria-label': 'פירוק הבתים בחבילה: כותרת IP, כותרת TCP, ו-MSS של נתוני היישום'
    });
    budgetSvg.style.display = 'block';
    budgetSvg.style.maxWidth = '100%';
    var budgetG = svg('g');
    budgetSvg.appendChild(budgetG);
    budget.appendChild(budgetSvg);
    root.appendChild(budget);

    // ===================== SEGMENTATION STAGE (the split payload) =====================
    var stage = el('div', 'mss-stage');
    var stageHead = el('div', 'mss-stage-head');
    stageHead.appendChild(document.createTextNode('פיצול ה-payload ל-'));
    var stageCount = ltr(el('span', 'mss-count-badge'));
    stageHead.appendChild(stageCount);
    stage.appendChild(stageHead);

    var segSvg = svg('svg', {
      width: '100%', role: 'img',
      'aria-label': 'ערמת ה-segments — כל segment נושא עד MSS בתים, האחרון נושא את השארית'
    });
    segSvg.style.display = 'block';
    segSvg.style.maxWidth = '100%';
    var segG = svg('g');
    segSvg.appendChild(segG);
    stage.appendChild(segSvg);
    root.appendChild(stage);

    // ===================== READOUT (formula + calc) =====================
    var readout = el('div', 'mss-readout');
    var cardMss = el('div', 'mss-card mss-card-mss');
    var cardSeg = el('div', 'mss-card mss-card-seg');
    readout.appendChild(cardMss);
    readout.appendChild(cardSeg);
    root.appendChild(readout);

    // fidelity note
    var note = el('p', 'mss-note');
    note.appendChild(document.createTextNode('1460 = '));
    note.appendChild(el('strong', null, '"הנקודה הקסומה"'));
    note.appendChild(document.createTextNode(
      ' שממלאת frame אתרנט שלם (1500) בלי fragmentation. גדול מ-MSS → פיצול (איטיות); קטן → יותר overhead של כותרות.'));
    root.appendChild(note);

    var src = el('p', 'mss-src', 'מקור: L05 (1).pdf — §MSS/MTU/segmentation');
    root.appendChild(src);

    // ===================== DRAW: budget bar =====================
    function drawBudget() {
      while (budgetG.firstChild) budgetG.removeChild(budgetG.firstChild);
      var ip = ipHdr(), tcp = tcpHdr(), m = mss();
      var total = state.mtu;
      // guard: if MSS <= 0 (MTU too small), clamp visual to headers only
      var carried = Math.max(0, m);
      var parts = [
        { w: ip, fill: C.mustard, label: 'IP', bytes: ip, txt: '#4a3a12' },
        { w: tcp, fill: C.sage, label: 'TCP', bytes: tcp, txt: '#22362b' },
        { w: carried, fill: C.blue, label: 'MSS · data', bytes: carried, txt: '#ffffff' }
      ];
      var x = 0;
      var scale = barW / total;
      parts.forEach(function (p, i) {
        var w = p.w * scale;
        var rect = svg('rect', {
          x: x, y: 0, width: Math.max(0, w), height: barH,
          fill: p.fill, stroke: C.surface, 'stroke-width': 1.5,
          rx: 4
        });
        if (!reduceMotion) {
          rect.style.transition = 'width .28s ease, x .28s ease';
        }
        budgetG.appendChild(rect);
        // label only if wide enough
        if (w > 34) {
          var t1 = svg('text', {
            x: x + w / 2, y: barH / 2 - 2, 'text-anchor': 'middle',
            direction: 'ltr', 'font-family': 'JetBrains Mono, monospace',
            'font-size': 11.5, 'font-weight': 700, fill: p.txt
          });
          t1.textContent = p.label;
          budgetG.appendChild(t1);
          var t2 = svg('text', {
            x: x + w / 2, y: barH / 2 + 13, 'text-anchor': 'middle',
            direction: 'ltr', 'font-family': 'JetBrains Mono, monospace',
            'font-size': 10.5, fill: p.txt, opacity: 0.9
          });
          t2.textContent = p.bytes + ' B';
          budgetG.appendChild(t2);
        }
        x += w;
      });
      // total MTU bracket label
      var tot = svg('text', {
        x: barW, y: barH + 18, 'text-anchor': 'end', direction: 'ltr',
        'font-family': 'JetBrains Mono, monospace', 'font-size': 11,
        'font-weight': 700, fill: C.inkSoft
      });
      tot.textContent = 'MTU = ' + fmt(total) + ' B';
      budgetG.appendChild(tot);
      var lead = svg('text', {
        x: 0, y: barH + 18, 'text-anchor': 'start', direction: 'ltr',
        'font-family': 'JetBrains Mono, monospace', 'font-size': 11, fill: C.inkSoft
      });
      lead.textContent = 'IPv' + state.ipv;
      budgetG.appendChild(lead);
    }

    // ===================== DRAW: segmentation stack =====================
    // Bars scaled so a full-MSS segment = fixed max width; remainder proportional.
    function drawSegments() {
      while (segG.firstChild) segG.removeChild(segG.firstChild);
      var n = segCount();
      var m = mss();
      var rem = remainder();

      // Display cap: show up to CAP bars individually, then an ellipsis summary.
      var CAP = 8;
      var showN = Math.min(n, CAP);
      var rowH = 30, gap = 8, padX = 4;
      var maxBarW = 560;
      var labelColW = 70;
      var extraRow = n > CAP ? 1 : 0;
      var totalRows = showN + extraRow;
      var svgH = totalRows * (rowH + gap) + 24;
      segSvg.setAttribute('viewBox', '0 0 640 ' + svgH);

      function segBar(idx, bytes, isRemainder, yRow) {
        var g = svg('g');
        var wFrac = m > 0 ? bytes / m : 0;
        var w = Math.max(10, maxBarW * wFrac);
        var y = yRow * (rowH + gap) + 4;
        // seq number label (right side for RTL layout but LTR text)
        var seqLbl = svg('text', {
          x: 636, y: y + rowH / 2 + 4, 'text-anchor': 'end', direction: 'ltr',
          'font-family': 'JetBrains Mono, monospace', 'font-size': 11,
          'font-weight': 700, fill: C.inkSoft
        });
        seqLbl.textContent = '#' + (idx + 1);
        g.appendChild(seqLbl);

        var rect = svg('rect', {
          x: padX, y: y, width: w, height: rowH, rx: 6,
          fill: isRemainder ? C.clay : C.blue,
          stroke: C.surface, 'stroke-width': 1.5, opacity: 0
        });
        g.appendChild(rect);

        var bLbl = svg('text', {
          x: padX + Math.max(w / 2, 32), y: y + rowH / 2 + 4, 'text-anchor': 'middle',
          direction: 'ltr', 'font-family': 'JetBrains Mono, monospace',
          'font-size': 11.5, 'font-weight': 700, fill: '#fff', opacity: 0
        });
        bLbl.textContent = fmt(bytes) + ' B';
        g.appendChild(bLbl);

        // tag: "full" vs "remainder"
        var tag = svg('text', {
          x: padX + w + 8, y: y + rowH / 2 + 4, 'text-anchor': 'start',
          direction: 'ltr', 'font-family': 'Heebo, sans-serif',
          'font-size': 10.5, fill: isRemainder ? C.clay : C.sage
        });
        tag.textContent = isRemainder ? 'remainder' : 'full MSS';
        g.appendChild(tag);

        segG.appendChild(g);

        // entrance animation (staggered), respects reduced motion
        if (reduceMotion) {
          rect.setAttribute('opacity', 1);
          bLbl.setAttribute('opacity', w > 44 ? 1 : 0);
        } else {
          rect.style.transition = 'opacity .25s ease, width .28s ease';
          bLbl.style.transition = 'opacity .25s ease';
          var delay = Math.min(idx, showN) * 45;
          window.setTimeout(function () {
            rect.setAttribute('opacity', 1);
            bLbl.setAttribute('opacity', w > 44 ? 1 : 0);
          }, delay);
        }
      }

      // Which indices to render as full bars
      var row = 0;
      for (var i = 0; i < showN; i++) {
        var isLast = (i === n - 1);
        // when capped, the visible bars 0..showN-1 are all "full" unless n<=CAP
        var bytes, isRem;
        if (n <= CAP) {
          isRem = isLast;
          bytes = isLast ? rem : m;
        } else {
          isRem = false;
          bytes = m;
        }
        segBar(i, bytes, isRem, row);
        row++;
      }

      if (n > CAP) {
        // summary row: "… + (n-CAP) more, last = remainder"
        var y = row * (rowH + gap) + 4;
        var g = svg('g');
        var box = svg('rect', {
          x: padX, y: y, width: 560, height: rowH, rx: 6,
          fill: C.surface2, stroke: C.line, 'stroke-width': 1.5
        });
        g.appendChild(box);
        var t = svg('text', {
          x: padX + 12, y: y + rowH / 2 + 4, 'text-anchor': 'start',
          'font-family': 'Heebo, sans-serif', 'font-size': 12, fill: C.ink
        });
        t.appendChild(document.createTextNode('… ועוד ' + fmt(n - CAP) + ' segments — האחרון (#' + fmt(n) + ') = ' + fmt(rem) + ' B '));
        g.appendChild(t);
        var t2 = svg('text', {
          x: 632, y: y + rowH / 2 + 4, 'text-anchor': 'end', direction: 'ltr',
          'font-family': 'JetBrains Mono, monospace', 'font-size': 11,
          fill: C.clay, 'font-weight': 700
        });
        t2.textContent = 'remainder';
        g.appendChild(t2);
        segG.appendChild(g);
      }
    }

    // ===================== READOUT text =====================
    function chip(txt, isLtr) {
      var s = el('span', 'mss-chip', txt);
      if (isLtr) ltr(s);
      return s;
    }

    function drawReadout() {
      var ip = ipHdr(), tcp = tcpHdr(), m = mss();
      var n = segCount(), rem = remainder();

      // MSS card
      cardMss.innerHTML = '';
      var h1 = el('div', 'mss-card-h');
      h1.appendChild(document.createTextNode('חישוב ה-'));
      h1.appendChild(ltr(el('span', 'mss-en', 'MSS')));
      cardMss.appendChild(h1);

      var calc1 = ltr(el('p', 'mss-calc'));
      calc1.textContent = 'MSS = ' + fmt(state.mtu) + ' − ' + ip + ' (IP) − ' +
        tcp + ' (TCP) = ' + fmt(m) + ' B';
      cardMss.appendChild(calc1);

      var p1 = el('p', 'mss-card-p');
      p1.appendChild(document.createTextNode('כותרת IP = '));
      p1.appendChild(chip(ip + ' B', true));
      p1.appendChild(document.createTextNode(state.ipv === 6 ?
        ' (IPv6 base — כתובות 128-bit) · ' : ' (IPv4) · '));
      p1.appendChild(document.createTextNode('כותרת TCP = '));
      p1.appendChild(chip(tcp + ' B', true));
      if (state.timestamps) {
        p1.appendChild(document.createTextNode(' (20 + 12 עם '));
        p1.appendChild(ltr(el('span', 'mss-en', 'Timestamps')));
        p1.appendChild(document.createTextNode(')'));
      }
      p1.appendChild(document.createTextNode('.'));
      cardMss.appendChild(p1);

      // highlight the canonical values
      if (m === 1460 && state.mtu === 1500) {
        cardMss.appendChild(el('p', 'mss-hi', 'MSS = 1460 — ברירת המחדל של Windows / Linux / macOS על אתרנט.'));
      } else if (m === 1440 && state.ipv === 6 && state.mtu === 1500) {
        cardMss.appendChild(el('p', 'mss-hi', 'MSS = 1440 — IPv6 על אתרנט.'));
      } else if (m === 1448 && state.timestamps) {
        cardMss.appendChild(el('p', 'mss-hi', 'eMSS = 1448 — עם Timestamps, כדי שהחבילה תישאר ≤ 1500.'));
      }

      // Segments card
      cardSeg.innerHTML = '';
      var h2 = el('div', 'mss-card-h');
      h2.appendChild(document.createTextNode('סופר ה-'));
      h2.appendChild(ltr(el('span', 'mss-en', 'Segmentation')));
      cardSeg.appendChild(h2);

      var calc2 = ltr(el('p', 'mss-calc'));
      calc2.textContent = 'ceil(' + fmt(state.payload) + ' / ' + fmt(m) + ') = ' + fmt(n) +
        (n === 1 ? ' segment' : ' segments');
      cardSeg.appendChild(calc2);

      var p2 = el('p', 'mss-card-p');
      if (n === 1) {
        p2.appendChild(document.createTextNode('ה-payload נכנס ב-'));
        p2.appendChild(el('strong', null, 'segment יחיד'));
        p2.appendChild(document.createTextNode(' של '));
        p2.appendChild(chip(fmt(rem) + ' B', true));
        p2.appendChild(document.createTextNode('.'));
      } else {
        p2.appendChild(el('strong', null, fmt(n - 1)));
        p2.appendChild(document.createTextNode(' segments מלאים של '));
        p2.appendChild(chip(fmt(m) + ' B', true));
        p2.appendChild(document.createTextNode(' + segment שארית אחד של '));
        p2.appendChild(chip(fmt(rem) + ' B', true));
        p2.appendChild(document.createTextNode('.'));
      }
      cardSeg.appendChild(p2);

      // seq-number teaching point (Worked Example B: seg-2 seq = X + MSS)
      if (n >= 2) {
        var seqP = ltr(el('p', 'mss-seq'));
        seqP.textContent = 'Sequence Number של segment #2 = X + ' + fmt(m);
        cardSeg.appendChild(seqP);
      }

      // wire-size sanity: each full packet on the wire
      var wire = ltr(el('p', 'mss-wire'));
      var full = m + ip + tcp;
      wire.textContent = 'על הקו: ' + fmt(m) + ' + ' + tcp + ' (TCP) + ' + ip +
        ' (IP) = ' + fmt(full) + ' B ≤ ' + fmt(state.mtu) + ' (MTU)';
      cardSeg.appendChild(wire);
    }

    // ===================== UPDATE (single source of truth) =====================
    function update() {
      // guard against MTU too small to hold headers (keep viz sane)
      var minMtu = ipHdr() + tcpHdr() + 1;
      if (state.mtu < minMtu) { state.mtu = minMtu; mtuSlider.value = String(minMtu); }

      pVal.textContent = fmt(state.payload) + ' bytes';
      mVal.textContent = fmt(state.mtu) + ' bytes';
      var n = segCount();
      stageCount.textContent = fmt(n) + (n === 1 ? ' segment' : ' segments');

      drawBudget();
      drawSegments();
      drawReadout();
    }

    // ===================== MOUNT =====================
    injectStyles();
    mount.appendChild(root);
    setIp(state.ipv);   // sets pressed state + triggers first full update

    // pause any pending stagger timers if tab hidden (nothing heavy, but tidy)
  }

  // ---------------------------------------------------------------------------
  var STYLE_ID = 'mss-styles-' + VIZ_ID;
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '.mss-root{font-family:Heebo,Assistant,sans-serif;color:#33302B;}',
      '.mss-head{margin-bottom:.5rem;}',
      '.mss-title{font-size:1.05rem;font-weight:700;color:#33302B;}',
      '.mss-sub{font-size:.85rem;color:#6B655C;margin-top:.15rem;line-height:1.5;}',
      '.mss-en{font-family:"JetBrains Mono",monospace;font-size:.86em;color:#6B655C;}',
      '.mss-formula{font-family:"JetBrains Mono",monospace;font-size:.82em;font-weight:700;color:#6E8CA0;background:#FBF5EA;border:1px solid #E7DECF;border-radius:5px;padding:.02rem .34rem;}',
      // segmented IP group
      '.mss-seg{display:inline-flex;gap:.35rem;padding:.15rem;background:#FBF5EA;border:1px solid #E7DECF;border-radius:99px;}',
      '.mss-seg .viz-btn{padding:.3rem .85rem;}',
      // sliders
      '.mss-sliders{margin:.9rem 0 .3rem;display:grid;gap:.55rem;}',
      '.mss-srow{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;}',
      '.mss-slabel{font-size:.85rem;color:#6B655C;min-width:150px;}',
      '.mss-sval{font-family:"JetBrains Mono",monospace;font-weight:700;color:#33302B;}',
      '.mss-slider{flex:1;min-width:170px;max-width:360px;accent-color:#6E8CA0;height:4px;cursor:pointer;}',
      // budget bar
      '.mss-budget{margin-top:1rem;background:#FFFDF8;border:1px solid #E7DECF;border-radius:9px;padding:.7rem .8rem;}',
      '.mss-budget-head{font-size:.85rem;color:#6B655C;margin-bottom:.5rem;font-weight:600;}',
      // segmentation stage
      '.mss-stage{margin-top:1rem;}',
      '.mss-stage-head{font-size:.9rem;color:#33302B;font-weight:600;margin-bottom:.45rem;display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;}',
      '.mss-count-badge{font-family:"JetBrains Mono",monospace;font-weight:700;font-size:.82rem;color:#fff;background:#6E8CA0;border-radius:99px;padding:.1rem .6rem;}',
      // readout cards
      '.mss-readout{display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-top:1rem;}',
      '@media(max-width:560px){.mss-readout{grid-template-columns:1fr;}.mss-slabel{min-width:0;}}',
      '.mss-card{background:#FBF5EA;border:1px solid #E7DECF;border-radius:9px;padding:.8rem .9rem;}',
      '.mss-card-mss{border-inline-start:4px solid #C9A24B;}',
      '.mss-card-seg{border-inline-start:4px solid #6E8CA0;}',
      '.mss-card-h{font-weight:700;font-size:.95rem;margin-bottom:.4rem;}',
      '.mss-calc{font-family:"JetBrains Mono",monospace;font-size:.82rem;color:#33302B;background:#FFFDF8;border:1px solid #E7DECF;border-radius:6px;padding:.3rem .55rem;margin:0 0 .45rem;display:block;}',
      '.mss-card-p{font-size:.83rem;line-height:1.6;color:#33302B;margin:0 0 .4rem;}',
      '.mss-hi{font-size:.8rem;color:#7C9885;font-weight:600;margin:.2rem 0 0;}',
      '.mss-seq{font-family:"JetBrains Mono",monospace;font-size:.78rem;color:#BE7C5E;margin:.1rem 0 .35rem;}',
      '.mss-wire{font-family:"JetBrains Mono",monospace;font-size:.76rem;color:#6B655C;margin:.35rem 0 0;padding-top:.35rem;border-top:1px dashed #E7DECF;}',
      '.mss-chip{display:inline-block;font-family:"JetBrains Mono",monospace;font-size:.78em;font-weight:600;background:#FFFDF8;border:1px solid #E7DECF;border-radius:5px;padding:.02rem .32rem;margin:0 .1rem;color:#33302B;}',
      '.mss-note{font-size:.8rem;color:#6B655C;line-height:1.6;margin:1rem 0 .3rem;}',
      '.mss-src{font-size:.74rem;color:#6B655C;font-style:italic;margin:.3rem 0 0;}',
      '.viz-btn[aria-pressed="true"]:not(.primary){border-color:#6E8CA0;background:#FBF5EA;}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------------------
  function boot() {
    var mounts = document.querySelectorAll('[data-viz="' + VIZ_ID + '"]');
    if (!mounts || !mounts.length) return; // degrade gracefully if absent
    mounts.forEach(function (m) {
      try { render(m); } catch (err) {
        if (window.console && console.warn) console.warn('[mss-mtu-calculator] render failed:', err);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
