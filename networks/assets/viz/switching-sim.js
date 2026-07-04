/* switching-sim.js — Packet switching vs Circuit switching, side by side.
 * Grounds the EXACT lecturer model from _notes/intro-layering.md §B6 (L01-2 v2, slides 35–37):
 *   - packet switching [= מיתוג מנות] = THE information-transfer method of computer networks.
 *     A large message is split into packets (each < 2000 bytes) that travel independently
 *     through channels + communication devices; the link is SHARED (packets interleave).
 *   - circuit switching [= מיתוג מעגלים] = the wired telephone network method (🎓 extension,
 *     cap-marked, NOT for exam). The stream is NOT split — it travels "as a whole" (כמכלול)
 *     over a dedicated circuit reserved end-to-end for the whole call.
 * Self-contained IIFE. No external libs. Cream design tokens hardcoded. RTL-aware.
 */
(function () {
  'use strict';

  var VIZ_ID = 'switching-sim';

  // --- design palette (hardcoded from CONTRACT §2) ---
  var C = {
    bg: '#FBF7F0', surface: '#FFFDF8', surface2: '#FBF5EA',
    ink: '#33302B', inkSoft: '#6B655C', line: '#E7DECF',
    blue: '#6E8CA0', clay: '#BE7C5E', sage: '#7C9885', mustard: '#C9A24B'
  };

  var SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { reduceMotion = false; }

  // Geometry: 4 nodes in a row — Source S, two comm-devices R1/R2, Dest D.
  // Two "lanes": top = packet switching, bottom = circuit switching.
  var W = 720, H = 420;
  var NODE_X = [70, 270, 470, 650];   // S, R1, R2, D
  var LANE_Y = { pkt: 150, ckt: 330 }; // vertical center of each lane's link line
  var NODE_R = 26;

  // ---------------------------------------------------------------------------
  function render(mount) {
    if (!mount || mount.getAttribute('data-viz') !== VIZ_ID) return;
    if (mount.__switchingSimDone) return;
    mount.__switchingSimDone = true;
    mount.innerHTML = '';

    // ---- state ----
    var state = {
      messageBytes: 6000,   // total payload to move (drives packet count)
      packetMax: 2000,      // "each packet < 2000 bytes" (lecturer)
      competing: false,     // a 2nd flow sharing the same links
      playing: false,
      t: 0,                 // simulation clock (arbitrary units)
      raf: null,
      lastTs: 0,
      packets: [],          // packet-switching units in flight
      circuit: null         // circuit-switching stream object
    };

    function packetCount() {
      return Math.max(1, Math.ceil(state.messageBytes / state.packetMax));
    }

    // ===================== DOM SHELL =====================
    var root = el('div', 'ss-root');
    root.setAttribute('dir', 'rtl');
    root.setAttribute('lang', 'he');

    var head = el('div', 'ss-head');
    var title = el('div', 'ss-title', 'מיתוג מנות מול מיתוג מעגלים');
    var sub = el('div', 'ss-sub');
    sub.appendChild(document.createTextNode('שתי שיטות להעברת מידע דרך הרשת — '));
    var subEn = el('span', 'ss-en', 'packet switching vs circuit switching');
    subEn.setAttribute('dir', 'ltr');
    sub.appendChild(subEn);
    head.appendChild(title);
    head.appendChild(sub);
    root.appendChild(head);

    // ===================== SVG STAGE =====================
    var svgEl = svg('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      width: '100%', role: 'img',
      'aria-label': 'סימולציית מיתוג מנות מול מיתוג מעגלים משדר S ליעד D דרך שני התקני תקשורת'
    });
    svgEl.style.display = 'block';
    svgEl.style.maxWidth = '100%';
    root.appendChild(svgEl);

    // defs — soft drop shadow for nodes
    var defs = svg('defs');
    var f = svg('filter', { id: 'ss-shadow', x: '-30%', y: '-30%', width: '160%', height: '160%' });
    var fe = svg('feDropShadow', { dx: '0', dy: '1.5', stdDeviation: '2.2', 'flood-color': '#78644680', 'flood-opacity': '0.5' });
    f.appendChild(fe);
    defs.appendChild(f);
    svgEl.appendChild(defs);

    // ---- Lane backdrops + labels ----
    function laneBackdrop(y, tint, labelHe, labelEn, capMark) {
      var g = svg('g');
      var band = svg('rect', {
        x: 20, y: y - 78, width: W - 40, height: 156, rx: 16,
        fill: tint, stroke: C.line, 'stroke-width': 1
      });
      g.appendChild(band);
      // Hebrew lane title (top-right for RTL)
      var t = svg('text', {
        x: W - 34, y: y - 56, 'text-anchor': 'end',
        'font-family': 'Heebo, Assistant, sans-serif', 'font-size': 16,
        'font-weight': 700, fill: C.ink
      });
      t.textContent = labelHe;
      g.appendChild(t);
      // English technical label (LTR, left side)
      var te = svg('text', {
        x: 40, y: y - 56, 'text-anchor': 'start', direction: 'ltr',
        'font-family': 'JetBrains Mono, monospace', 'font-size': 12.5,
        'font-weight': 600, fill: C.inkSoft
      });
      te.textContent = labelEn;
      g.appendChild(te);
      if (capMark) {
        var cap = svg('text', {
          x: W - 34, y: y - 36, 'text-anchor': 'end',
          'font-family': 'Heebo, sans-serif', 'font-size': 11.5, fill: C.inkSoft
        });
        cap.textContent = '🎓 הרחבה — לא נדרש למבחן';
        g.appendChild(cap);
      }
      return g;
    }
    svgEl.appendChild(laneBackdrop(LANE_Y.pkt, C.surface,
      'מיתוג מנות — רשת מחשבים', 'packet switching', false));
    svgEl.appendChild(laneBackdrop(LANE_Y.ckt, C.surface2,
      'מיתוג מעגלים — רשת הטלפון', 'circuit switching', true));

    // ---- Links (shared physical channels) per lane ----
    // Each lane draws 3 hops: S-R1, R1-R2, R2-D. Circuit lane can show a reserved
    // dedicated circuit overlay when a call is active.
    var circuitReserveEls = [];
    function drawLinks(y, laneKey) {
      for (var i = 0; i < NODE_X.length - 1; i++) {
        var x1 = NODE_X[i] + NODE_R, x2 = NODE_X[i + 1] - NODE_R;
        var base = svg('line', {
          x1: x1, y1: y, x2: x2, y2: y,
          stroke: C.line, 'stroke-width': 8, 'stroke-linecap': 'round'
        });
        svgEl.appendChild(base);
        if (laneKey === 'ckt') {
          // reserved-circuit overlay (hidden until a call is active)
          var res = svg('line', {
            x1: x1, y1: y, x2: x2, y2: y,
            stroke: C.mustard, 'stroke-width': 8, 'stroke-linecap': 'round',
            opacity: 0
          });
          svgEl.appendChild(res);
          circuitReserveEls.push(res);
        }
      }
    }
    drawLinks(LANE_Y.pkt, 'pkt');
    drawLinks(LANE_Y.ckt, 'ckt');

    // ---- Nodes ----
    var nodeLabelsHe = ['מקור', 'התקן', 'התקן', 'יעד'];
    var nodeLabelsEn = ['S', 'R1', 'R2', 'D'];
    var nodeSubEn = ['host', 'device', 'device', 'host'];
    function drawNodes(y) {
      for (var i = 0; i < NODE_X.length; i++) {
        var isHost = (i === 0 || i === NODE_X.length - 1);
        var fill = isHost ? C.blue : C.surface;
        var stroke = isHost ? C.blue : C.line;
        var g = svg('g');
        var c = svg('circle', {
          cx: NODE_X[i], cy: y, r: NODE_R, fill: fill,
          stroke: stroke, 'stroke-width': 2, filter: 'url(#ss-shadow)'
        });
        g.appendChild(c);
        var lbl = svg('text', {
          x: NODE_X[i], y: y + 5, 'text-anchor': 'middle', direction: 'ltr',
          'font-family': 'JetBrains Mono, monospace', 'font-size': 15,
          'font-weight': 700, fill: isHost ? '#fff' : C.ink
        });
        lbl.textContent = nodeLabelsEn[i];
        g.appendChild(lbl);
        var sub2 = svg('text', {
          x: NODE_X[i], y: y + NODE_R + 16, 'text-anchor': 'middle',
          'font-family': 'Heebo, sans-serif', 'font-size': 11.5, fill: C.inkSoft
        });
        sub2.textContent = nodeLabelsHe[i];
        g.appendChild(sub2);
        var sub3 = svg('text', {
          x: NODE_X[i], y: y + NODE_R + 29, 'text-anchor': 'middle', direction: 'ltr',
          'font-family': 'JetBrains Mono, monospace', 'font-size': 9.5, fill: C.inkSoft
        });
        sub3.textContent = nodeSubEn[i];
        g.appendChild(sub3);
        svgEl.appendChild(g);
      }
    }
    drawNodes(LANE_Y.pkt);
    drawNodes(LANE_Y.ckt);

    // Moving-object layer (drawn last, above links/nodes)
    var moveLayer = svg('g');
    svgEl.appendChild(moveLayer);

    // Setup phase caption for circuit lane
    var ckSetupText = svg('text', {
      x: W / 2, y: LANE_Y.ckt + 62, 'text-anchor': 'middle',
      'font-family': 'Heebo, sans-serif', 'font-size': 12, fill: C.clay, opacity: 0
    });
    svgEl.appendChild(ckSetupText);

    var pktDoneText = svg('text', {
      x: W / 2, y: LANE_Y.pkt + 62, 'text-anchor': 'middle',
      'font-family': 'Heebo, sans-serif', 'font-size': 12, fill: C.sage, opacity: 0
    });
    svgEl.appendChild(pktDoneText);

    // ===================== SIMULATION MODEL =====================
    // Path length (x from first link start to last link end)
    var PATH_START = NODE_X[0] + NODE_R;
    var PATH_END = NODE_X[NODE_X.length - 1] - NODE_R;
    var PATH_LEN = PATH_END - PATH_START;

    // Colors: our flow vs competing flow
    var FLOW_A = C.blue, FLOW_B = C.clay;

    function buildSim() {
      // clear any moving els
      while (moveLayer.firstChild) moveLayer.removeChild(moveLayer.firstChild);
      state.packets = [];
      state.circuit = null;
      state.t = 0;
      circuitReserveEls.forEach(function (r) { r.setAttribute('opacity', 0); });
      ckSetupText.setAttribute('opacity', 0);
      pktDoneText.setAttribute('opacity', 0);

      // ---- packet-switching flow(s): N independent packets, released staggered ----
      var n = packetCount();
      var flows = state.competing ? [{ color: FLOW_A, off: 0 }, { color: FLOW_B, off: 0.5 }]
                                  : [{ color: FLOW_A, off: 0 }];
      var seq = 0;
      flows.forEach(function (fl, fi) {
        for (var i = 0; i < n; i++) {
          // stagger release so packets share the link (interleave when 2 flows).
          var release = i * 0.9 + fl.off;
          var pktEl = svg('g', { opacity: 0 });
          var box = svg('rect', {
            x: -13, y: -10, width: 26, height: 20, rx: 5,
            fill: fl.color, stroke: '#ffffffcc', 'stroke-width': 1.5,
            filter: 'url(#ss-shadow)'
          });
          pktEl.appendChild(box);
          var num = svg('text', {
            x: 0, y: 4, 'text-anchor': 'middle', direction: 'ltr',
            'font-family': 'JetBrains Mono, monospace', 'font-size': 10,
            'font-weight': 700, fill: '#fff'
          });
          num.textContent = String(i + 1);
          pktEl.appendChild(num);
          moveLayer.appendChild(pktEl);
          state.packets.push({
            el: pktEl, box: box, flow: fi, release: release,
            speed: 2.9, progress: 0, done: false, active: false,
            // small vertical jitter so 2 flows are visually distinct on shared link
            yoff: state.competing ? (fi === 0 ? -7 : 7) : 0
          });
          seq++;
        }
      });

      // ---- circuit-switching flow: ONE undivided stream, but a setup delay first ----
      // Model: (1) call setup reserves the circuit end-to-end (delay), then
      // (2) the whole voice stream flows as one continuous block ("as a whole").
      var streamEl = svg('g', { opacity: 0 });
      var pill = svg('rect', {
        x: -46, y: -13, width: 92, height: 26, rx: 13,
        fill: C.mustard, stroke: '#ffffffcc', 'stroke-width': 1.5,
        filter: 'url(#ss-shadow)'
      });
      streamEl.appendChild(pill);
      var pillTxt = svg('text', {
        x: 0, y: 4, 'text-anchor': 'middle', direction: 'ltr',
        'font-family': 'JetBrains Mono, monospace', 'font-size': 10.5,
        'font-weight': 700, fill: '#4a3a12'
      });
      pillTxt.textContent = 'voice ▶';
      streamEl.appendChild(pillTxt);
      moveLayer.appendChild(streamEl);
      state.circuit = {
        el: streamEl, phase: 'setup', setupT: 0,
        setupDur: 22, progress: 0, speed: 2.2, done: false
      };
    }

    function xAt(progress) { return PATH_START + PATH_LEN * progress; }

    function stepSim(dt) {
      state.t += dt;
      var allPktDone = true;

      // packet lane
      state.packets.forEach(function (p) {
        if (p.done) return;
        allPktDone = false;
        if (state.t < p.release) { p.el.setAttribute('opacity', 0); return; }
        if (!p.active) { p.active = true; p.el.setAttribute('opacity', 1); }
        p.progress += (p.speed / PATH_LEN) * dt * 60;
        if (p.progress >= 1) {
          p.progress = 1; p.done = true;
          p.el.setAttribute('opacity', 0.25);
        }
        var x = xAt(p.progress);
        var y = LANE_Y.pkt + p.yoff;
        p.el.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')');
      });
      if (allPktDone && state.packets.length) {
        pktDoneText.textContent = 'כל ה-packets הגיעו (עברו דרך התקני התקשורת באופן עצמאי)';
        pktDoneText.setAttribute('opacity', 1);
      }

      // circuit lane
      var ck = state.circuit;
      var ckDone = true;
      if (ck && !ck.done) {
        ckDone = false;
        if (ck.phase === 'setup') {
          ck.setupT += dt * 60;
          // light up reserved circuit progressively during setup
          var frac = Math.min(1, ck.setupT / ck.setupDur);
          var lit = Math.floor(frac * circuitReserveEls.length + 0.001);
          circuitReserveEls.forEach(function (r, i) {
            r.setAttribute('opacity', i < lit ? 1 : (i === lit ? frac : 0));
          });
          ckSetupText.textContent = 'שלב הקמת מעגל: שמורים ערוצים לכל אורך המסלול…';
          ckSetupText.setAttribute('opacity', 1);
          ck.el.setAttribute('opacity', 0);
          if (ck.setupT >= ck.setupDur) {
            ck.phase = 'stream';
            circuitReserveEls.forEach(function (r) { r.setAttribute('opacity', 1); });
            ckSetupText.setAttribute('opacity', 0);
            ck.el.setAttribute('opacity', 1);
          }
        } else if (ck.phase === 'stream') {
          ck.progress += (ck.speed / PATH_LEN) * dt * 60;
          if (ck.progress >= 1) { ck.progress = 1; ck.done = true; }
          var cx = xAt(ck.progress);
          ck.el.setAttribute('transform', 'translate(' + cx.toFixed(1) + ',' + LANE_Y.ckt + ')');
        }
      }
      if (ck && ck.done) {
        ckSetupText.textContent = 'הזרם עבר כמכלול על גבי מעגל ייעודי שנשמר לכל שיחה';
        ckSetupText.setAttribute('opacity', 1);
      }

      return allPktDone && ckDone;
    }

    // ===================== RENDER LOOP =====================
    function frame(ts) {
      if (!state.playing) return;
      if (!state.lastTs) state.lastTs = ts;
      var dt = Math.min(0.05, (ts - state.lastTs) / 1000);
      state.lastTs = ts;
      var done = stepSim(dt);
      updateReadout();
      if (done) { state.playing = false; setPlayLabel(); return; }
      state.raf = requestAnimationFrame(frame);
    }

    function play() {
      if (state.playing) return;
      // if everything already finished, reset first
      var pktAll = state.packets.length && state.packets.every(function (p) { return p.done; });
      var ckAll = state.circuit && state.circuit.done;
      if (pktAll && ckAll) buildSim();
      state.playing = true;
      state.lastTs = 0;
      setPlayLabel();
      if (reduceMotion) {
        // reduced motion: jump straight to a settled end-state, no animation frames
        for (var i = 0; i < 600 && !stepSim(0.05); i++) {}
        stepSim(0.05);
        state.playing = false;
        setPlayLabel();
        updateReadout();
      } else {
        state.raf = requestAnimationFrame(frame);
      }
    }
    function pause() {
      state.playing = false;
      if (state.raf) cancelAnimationFrame(state.raf);
      setPlayLabel();
    }
    function reset() {
      pause();
      buildSim();
      updateReadout();
    }
    // Step: advance the simulation by a fixed slice without continuous play.
    function stepOnce() {
      if (state.playing) pause();
      var pktAll = state.packets.length && state.packets.every(function (p) { return p.done; });
      var ckAll = state.circuit && state.circuit.done;
      if (pktAll && ckAll) buildSim();
      // advance ~1/6 s of sim time in a few sub-steps for stability
      for (var i = 0; i < 10; i++) stepSim(0.017);
      updateReadout();
    }

    // ===================== CONTROLS =====================
    var controls = el('div', 'viz-controls');

    var playBtn = el('button', 'viz-btn primary');
    playBtn.type = 'button';
    function setPlayLabel() {
      playBtn.textContent = state.playing ? '⏸ השהה' : '▶ הפעל';
      playBtn.setAttribute('aria-pressed', state.playing ? 'true' : 'false');
    }
    setPlayLabel();
    playBtn.addEventListener('click', function () {
      if (state.playing) pause(); else play();
    });

    var stepBtn = el('button', 'viz-btn');
    stepBtn.type = 'button';
    stepBtn.textContent = '⏭ צעד';
    stepBtn.addEventListener('click', stepOnce);

    var resetBtn = el('button', 'viz-btn');
    resetBtn.type = 'button';
    resetBtn.textContent = '↺ אפס';
    resetBtn.addEventListener('click', reset);

    var compBtn = el('button', 'viz-btn');
    compBtn.type = 'button';
    function setCompLabel() {
      compBtn.textContent = state.competing ? '✓ זרם מתחרה נוסף' : '＋ הוסף זרם מתחרה';
      compBtn.setAttribute('aria-pressed', state.competing ? 'true' : 'false');
    }
    setCompLabel();
    compBtn.addEventListener('click', function () {
      state.competing = !state.competing;
      setCompLabel();
      reset();
    });

    controls.appendChild(playBtn);
    controls.appendChild(stepBtn);
    controls.appendChild(resetBtn);
    controls.appendChild(compBtn);
    root.appendChild(controls);

    // --- slider row: message size (drives packet count) ---
    var sliderRow = el('div', 'ss-slider-row');
    var sliderLabel = el('label', 'ss-slider-label');
    sliderLabel.setAttribute('for', mount.id ? mount.id + '-size' : 'ss-size');
    var slId = (mount.id || 'ss') + '-size-' + Math.random().toString(36).slice(2, 7);
    sliderLabel.setAttribute('for', slId);
    var slLead = el('span', null, 'גודל ההודעה: ');
    var slVal = el('span', 'ss-slider-val');
    slVal.setAttribute('dir', 'ltr');
    sliderLabel.appendChild(slLead);
    sliderLabel.appendChild(slVal);

    var slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '1000';
    slider.max = '16000';
    slider.step = '1000';
    slider.value = String(state.messageBytes);
    slider.id = slId;
    slider.className = 'ss-slider';
    slider.setAttribute('aria-label', 'גודל ההודעה בבתים');
    slider.addEventListener('input', function () {
      state.messageBytes = parseInt(slider.value, 10);
      updateReadout();
      reset();
    });
    sliderRow.appendChild(sliderLabel);
    sliderRow.appendChild(slider);
    root.appendChild(sliderRow);

    // ===================== READOUT / EXPLAINER =====================
    var readout = el('div', 'ss-readout');
    var cardPkt = el('div', 'ss-card ss-card-pkt');
    var cardCkt = el('div', 'ss-card ss-card-ckt');
    readout.appendChild(cardPkt);
    readout.appendChild(cardCkt);
    root.appendChild(readout);

    function chip(txt, ltr) {
      var s = el('span', 'ss-chip', txt);
      if (ltr) s.setAttribute('dir', 'ltr');
      return s;
    }

    function updateReadout() {
      var n = packetCount();
      slVal.textContent = state.messageBytes.toLocaleString('en-US') + ' bytes';

      // packet card
      cardPkt.innerHTML = '';
      var h1 = el('div', 'ss-card-h');
      h1.appendChild(document.createTextNode('מיתוג מנות '));
      var e1 = el('span', 'ss-en', 'packet switching'); e1.setAttribute('dir', 'ltr');
      h1.appendChild(e1);
      cardPkt.appendChild(h1);
      var p1 = el('p', 'ss-card-p');
      p1.appendChild(document.createTextNode('ההודעה מפוצלת ל-'));
      p1.appendChild(chip(n + ' packets', true));
      p1.appendChild(document.createTextNode(' — כל packet קטן מ-'));
      p1.appendChild(chip('2000 bytes', true));
      p1.appendChild(document.createTextNode('. ה-packets נעים עצמאית דרך הערוצים והתקני התקשורת, וחולקים את הקו.'));
      cardPkt.appendChild(p1);
      var calc = el('p', 'ss-card-calc');
      calc.setAttribute('dir', 'ltr');
      calc.textContent = 'ceil(' + state.messageBytes + ' / ' + state.packetMax + ') = ' + n + ' packets';
      cardPkt.appendChild(calc);
      cardPkt.appendChild(el('p', 'ss-card-note', 'זו שיטת ההעברה של רשתות המחשבים.'));

      // circuit card
      cardCkt.innerHTML = '';
      var h2 = el('div', 'ss-card-h');
      h2.appendChild(document.createTextNode('מיתוג מעגלים '));
      var e2 = el('span', 'ss-en', 'circuit switching'); e2.setAttribute('dir', 'ltr');
      h2.appendChild(e2);
      var cap = el('span', 'ss-cap', ' 🎓');
      h2.appendChild(cap);
      cardCkt.appendChild(h2);
      var p2 = el('p', 'ss-card-p');
      p2.appendChild(document.createTextNode('קודם '));
      p2.appendChild(chip('הקמת מעגל'));
      p2.appendChild(document.createTextNode(' ששומר ערוץ ייעודי לכל אורך המסלול, ואז הזרם עובר '));
      var whole = el('strong', null, 'כמכלול');
      p2.appendChild(whole);
      p2.appendChild(document.createTextNode(' — לא מפוצל ל-packets.'));
      cardCkt.appendChild(p2);
      cardCkt.appendChild(el('p', 'ss-card-note',
        'שיטת רשת הטלפון הקווית. הרחבה — לא נדרש למבחן.'));
    }

    // ===================== MOUNT & STYLES =====================
    injectStyles();
    mount.appendChild(root);
    buildSim();
    updateReadout();

    // keyboard: space toggles play when focus is inside the viz
    root.addEventListener('keydown', function (ev) {
      if (ev.key === ' ' && document.activeElement &&
          document.activeElement.classList &&
          document.activeElement.classList.contains('viz-btn')) {
        // let the button handle its own activation
        return;
      }
    });

    // pause when scrolled off-screen / tab hidden (avoid runaway rAF)
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && state.playing) pause();
    });
  }

  // ---------------------------------------------------------------------------
  var STYLE_ID = 'ss-styles-' + VIZ_ID;
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '.ss-root{font-family:Heebo,Assistant,sans-serif;color:#33302B;}',
      '.ss-head{margin-bottom:.6rem;}',
      '.ss-title{font-size:1.05rem;font-weight:700;color:#33302B;}',
      '.ss-sub{font-size:.85rem;color:#6B655C;margin-top:.15rem;}',
      '.ss-en{font-family:"JetBrains Mono",monospace;font-size:.86em;color:#6B655C;}',
      '.ss-slider-row{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;margin:.9rem 0 .2rem;}',
      '.ss-slider-label{font-size:.86rem;color:#6B655C;}',
      '.ss-slider-val{font-family:"JetBrains Mono",monospace;font-weight:700;color:#33302B;}',
      '.ss-slider{flex:1;min-width:160px;max-width:340px;accent-color:#6E8CA0;height:4px;cursor:pointer;}',
      '.ss-readout{display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-top:1rem;}',
      '@media(max-width:560px){.ss-readout{grid-template-columns:1fr;}}',
      '.ss-card{background:#FBF5EA;border:1px solid #E7DECF;border-radius:9px;padding:.8rem .9rem;}',
      '.ss-card-pkt{border-inline-start:4px solid #6E8CA0;}',
      '.ss-card-ckt{border-inline-start:4px solid #C9A24B;}',
      '.ss-card-h{font-weight:700;font-size:.95rem;margin-bottom:.35rem;}',
      '.ss-card-p{font-size:.83rem;line-height:1.55;color:#33302B;margin:0 0 .4rem;}',
      '.ss-card-calc{font-family:"JetBrains Mono",monospace;font-size:.8rem;color:#6E8CA0;background:#FFFDF8;border:1px solid #E7DECF;border-radius:6px;padding:.25rem .5rem;margin:0 0 .4rem;display:inline-block;}',
      '.ss-card-note{font-size:.78rem;color:#6B655C;margin:0;font-style:italic;}',
      '.ss-chip{display:inline-block;font-family:"JetBrains Mono",monospace;font-size:.78em;font-weight:600;background:#FFFDF8;border:1px solid #E7DECF;border-radius:5px;padding:.02rem .32rem;margin:0 .12rem;color:#33302B;}',
      '.ss-cap{font-size:.85em;}',
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
        if (window.console && console.warn) console.warn('[switching-sim] render failed:', err);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
