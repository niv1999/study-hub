/* sifs-ack-timeline.js — IIFE, self-contained, no external deps
   Model: WiFi (1).pdf עמ' 9-10 — TX→SIFS→ACK timeline with retransmission + Block ACK
   Palette: cream design system (#FBF7F0 bg, #6E8CA0 dusty-blue, #BE7C5E clay, #7C9885 sage, #C9A24B mustard)
*/
(function () {
  'use strict';

  /* ── palette (hardcoded from CONTRACT.md §2) ── */
  const C = {
    bg:        '#FBF7F0',
    surface:   '#FFFDF8',
    surface2:  '#FBF5EA',
    ink:       '#33302B',
    inkSoft:   '#6B655C',
    line:      '#E7DECF',
    blue:      '#6E8CA0',
    clay:      '#BE7C5E',
    sage:      '#7C9885',
    mustard:   '#C9A24B',
    red:       '#C0392B',
    white:     '#FFFDF8',
  };

  /* ── animation helpers ── */
  const prefersReduced = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ──────────────────────────────────────────────
     RENDER  — one call per mount element
  ────────────────────────────────────────────── */
  function render(mount) {
    if (!mount) return;

    /* ── state ── */
    const state = {
      mode: 'success',   // 'success' | 'retry' | 'blockack'
      animating: false,
      rafId: null,
      progress: 0,       // 0..1 animation progress
    };

    /* ── build DOM skeleton ── */
    mount.style.cssText = `
      font-family: Heebo, Assistant, sans-serif;
      background: ${C.bg};
      border-radius: 14px;
      border: 1px solid ${C.line};
      padding: 0;
      overflow: hidden;
      user-select: none;
    `;

    const header = el('div', {
      style: `
        background: ${C.surface};
        border-bottom: 1px solid ${C.line};
        padding: 14px 20px 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
      `,
    });

    const title = el('div', { style: `color:${C.ink}; font-weight:700; font-size:1rem; line-height:1.3;` });
    title.innerHTML = `<span dir="ltr" style="font-size:.85em; color:${C.inkSoft};">802.11</span> ציר זמן: <span dir="ltr">TX → SIFS → ACK</span>`;

    const controls = el('div', { className: 'viz-controls', style: 'display:flex; gap:8px; flex-wrap:wrap;' });

    const btnSuccess  = makeBtn('מצב רגיל',        'success');
    const btnRetry    = makeBtn('אובדן ACK / Retry', 'retry');
    const btnBlockAck = makeBtn('Block ACK',        'blockack');

    controls.append(btnSuccess, btnRetry, btnBlockAck);
    header.append(title, controls);

    /* ── canvas area ── */
    const canvasWrap = el('div', { style: `padding: 16px 20px 20px; position:relative;` });
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block; width:100%; border-radius:9px;';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'ציר זמן 802.11: שידור פריים, SIFS, ACK ו-Retry');
    canvasWrap.appendChild(canvas);

    /* ── legend / tooltip area ── */
    const legend = el('div', {
      style: `
        margin: 0 20px 16px;
        padding: 10px 14px;
        background: ${C.surface};
        border: 1px solid ${C.line};
        border-radius: 9px;
        font-size: .82rem;
        color: ${C.inkSoft};
        line-height: 1.6;
        min-height: 48px;
      `,
    });
    legend.setAttribute('aria-live', 'polite');

    /* ── play/pause button ── */
    const btnPlay = el('button', {
      className: 'viz-btn',
      style: `
        display:block;
        margin: 0 20px 18px auto;
        padding: 6px 18px;
        background: ${C.blue};
        color: #fff;
        border: none;
        border-radius: 9px;
        font-family: inherit;
        font-size: .85rem;
        font-weight: 600;
        cursor: pointer;
        transition: background .15s;
      `,
    });
    btnPlay.textContent = '▶ הפעל אנימציה';
    btnPlay.setAttribute('aria-label', 'הפעל / השהה אנימציה');

    mount.append(header, canvasWrap, btnPlay, legend);

    /* ── resize / DPR ── */
    const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
    function sizeCanvas() {
      const w = canvasWrap.clientWidth - 40;
      const h = Math.max(220, Math.round(w * 0.36));
      canvas.width  = Math.round(w * dpr());
      canvas.height = Math.round(h * dpr());
      canvas.style.width  = w + 'px';
      canvas.style.height = h + 'px';
    }

    const ro = new ResizeObserver(() => { sizeCanvas(); drawFrame(state.progress); });
    ro.observe(canvasWrap);
    sizeCanvas();

    /* ── button logic ── */
    function makeBtn(label, mode) {
      const b = el('button', { className: 'viz-btn' });
      b.textContent = label;
      b.setAttribute('aria-pressed', mode === 'success' ? 'true' : 'false');
      b.style.cssText = `
        padding: 5px 12px;
        border-radius: 8px;
        border: 1.5px solid ${C.line};
        background: ${C.surface};
        color: ${C.inkSoft};
        font-family: inherit;
        font-size: .8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all .15s;
      `;
      b.addEventListener('click', () => selectMode(mode));
      b.addEventListener('mouseover', () => { if (state.mode !== mode) b.style.background = C.surface2; });
      b.addEventListener('mouseout',  () => { if (state.mode !== mode) b.style.background = C.surface; });
      return b;
    }

    const modeBtns = { success: btnSuccess, retry: btnRetry, blockack: btnBlockAck };

    function selectMode(mode) {
      stopAnim();
      state.mode = mode;
      state.progress = 0;
      Object.entries(modeBtns).forEach(([m, b]) => {
        const active = m === mode;
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
        b.style.background   = active ? C.blue  : C.surface;
        b.style.color        = active ? '#fff'  : C.inkSoft;
        b.style.borderColor  = active ? C.blue  : C.line;
      });
      drawFrame(0);
      updateLegend(0);
      btnPlay.textContent = '▶ הפעל אנימציה';
    }

    selectMode('success');  // initial state

    /* ── play/pause ── */
    btnPlay.addEventListener('click', () => {
      if (state.animating) {
        stopAnim();
        btnPlay.textContent = '▶ הפעל אנימציה';
      } else {
        if (state.progress >= 1) state.progress = 0;
        startAnim();
        btnPlay.textContent = '⏸ השהה';
      }
    });

    function startAnim() {
      if (prefersReduced()) {
        state.progress = 1;
        drawFrame(1);
        updateLegend(1);
        return;
      }
      state.animating = true;
      let last = null;
      const duration = state.mode === 'retry' ? 3400 : state.mode === 'blockack' ? 2800 : 2200;
      function tick(ts) {
        if (!last) last = ts;
        const dt = ts - last;
        last = ts;
        state.progress = Math.min(1, state.progress + dt / duration);
        drawFrame(state.progress);
        updateLegend(state.progress);
        if (state.progress < 1) {
          state.rafId = requestAnimationFrame(tick);
        } else {
          state.animating = false;
          btnPlay.textContent = '↺ הפעל שוב';
        }
      }
      state.rafId = requestAnimationFrame(tick);
    }

    function stopAnim() {
      state.animating = false;
      if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
    }

    /* ══════════════════════════════════════════
       DRAWING  ENGINE
    ══════════════════════════════════════════ */
    function drawFrame(t) {
      const ctx = canvas.getContext('2d');
      const W = canvas.width;
      const H = canvas.height;
      const d = dpr();

      ctx.clearRect(0, 0, W, H);

      // background
      ctx.fillStyle = C.surface;
      roundRect(ctx, 0, 0, W, H, 9 * d);
      ctx.fill();

      if (state.mode === 'success')  drawSuccess(ctx, W, H, d, t);
      if (state.mode === 'retry')    drawRetry(ctx, W, H, d, t);
      if (state.mode === 'blockack') drawBlockAck(ctx, W, H, d, t);
    }

    /* ── shared layout helpers ── */
    function timelineLayout(W, H, d) {
      const PAD_L = 18 * d;
      const PAD_R = 18 * d;
      const PAD_T = 32 * d;
      const PAD_B = 44 * d;
      const rowH  = (H - PAD_T - PAD_B) / 2;

      return {
        PAD_L, PAD_R, PAD_T, PAD_B, rowH,
        TRACK_W: W - PAD_L - PAD_R,
        ROW_LAPTOP: PAD_T + rowH * 0.25,
        ROW_AP:     PAD_T + rowH * 1.15,
        AXIS_Y:     H - PAD_B + 10 * d,
      };
    }

    /* ─ SUCCESS mode: Frame → SIFS → ACK ─ */
    function drawSuccess(ctx, W, H, d, t) {
      const L = timelineLayout(W, H, d);
      const { PAD_L, PAD_T, PAD_B, TRACK_W, ROW_LAPTOP, ROW_AP, AXIS_Y } = L;

      // time axis
      drawAxis(ctx, PAD_L, AXIS_Y, PAD_L + TRACK_W, d);
      drawAxisLabel(ctx, PAD_L + TRACK_W / 2, AXIS_Y + 14 * d, 'זמן (µs)', d);

      // row labels
      rowLabel(ctx, PAD_L - 8 * d, ROW_LAPTOP, 'myLaptop', d, 'right');
      rowLabel(ctx, PAD_L - 8 * d, ROW_AP,     'AP',       d, 'right');

      // timeline segments:  [--TX Frame 1--] [SIFS] [--ACK--]
      // proportions: TX=0.42, SIFS=0.08, ACK=0.18, rest = silence
      const seg = segLayout(PAD_L, TRACK_W, [0.42, 0.08, 0.18, 0.32]);

      const boxH   = 24 * d;
      const ackH   = 18 * d;
      const halfBH = boxH / 2;

      // TX Frame 1 (laptop row)
      if (t > 0) {
        const progTx = Math.min(1, t / 0.45);
        drawBlock(ctx, seg[0].x, ROW_LAPTOP - halfBH, seg[0].w * progTx, boxH, C.blue, 'Frame 1', d, progTx, C.white);
        // send beam down
        if (progTx >= 1) {
          const beamAlpha = Math.min(1, (t - 0.45) / 0.1);
          drawBeam(ctx, seg[0].x + seg[0].w, ROW_LAPTOP + halfBH, seg[0].x + seg[0].w, ROW_AP - ackH / 2, C.blue, beamAlpha * 0.4, d);
        }
      }

      // SIFS gap bracket
      if (t > 0.5) {
        const a = Math.min(1, (t - 0.5) / 0.08);
        drawSIFS(ctx, seg[1].x, AXIS_Y - 4 * d, seg[1].w, '16 µs\nSIFS', d, a, C.mustard);
      }

      // ACK block (AP row)
      if (t > 0.58) {
        const progAck = Math.min(1, (t - 0.58) / 0.2);
        const aw = seg[2].w * progAck;
        drawBlock(ctx, seg[2].x, ROW_AP - ackH / 2, aw, ackH, C.sage, 'ACK ✓', d, progAck, C.white);
        // receive beam up
        if (progAck >= 1) {
          const a2 = Math.min(1, (t - 0.78) / 0.08);
          drawBeam(ctx, seg[2].x, ROW_AP - ackH / 2, seg[2].x, ROW_LAPTOP + halfBH + 2 * d, C.sage, a2 * 0.4, d);
        }
      }

      // "✓ הצלחה" label
      if (t > 0.88) {
        const a = Math.min(1, (t - 0.88) / 0.12);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = `bold ${13 * d}px Heebo, sans-serif`;
        ctx.fillStyle = C.sage;
        ctx.textAlign = 'center';
        ctx.fillText('הקרנל מקבל אישור ✓', PAD_L + TRACK_W * 0.78, ROW_LAPTOP - halfBH - 10 * d);
        ctx.restore();
      }

      // No-other-station annotation
      if (t > 0.52) {
        const a = Math.min(1, (t - 0.52) / 0.1);
        ctx.save();
        ctx.globalAlpha = a * 0.75;
        ctx.font = `${9.5 * d}px Heebo, sans-serif`;
        ctx.fillStyle = C.mustard;
        ctx.textAlign = 'center';
        ctx.fillText('אף תחנה אחרת לא יכולה לתפוס את התדר', PAD_L + seg[1].x + seg[1].w / 2 - PAD_L, AXIS_Y - 18 * d);
        ctx.restore();
      }
    }

    /* ─ RETRY mode: TX → (no ACK within timeout) → Retransmit → SIFS → ACK ─ */
    function drawRetry(ctx, W, H, d, t) {
      const L = timelineLayout(W, H, d);
      const { PAD_L, TRACK_W, ROW_LAPTOP, ROW_AP, AXIS_Y } = L;

      drawAxis(ctx, PAD_L, AXIS_Y, PAD_L + TRACK_W, d);
      drawAxisLabel(ctx, PAD_L + TRACK_W / 2, AXIS_Y + 14 * d, 'זמן (µs) — אובדן ACK → Retry', d);

      rowLabel(ctx, PAD_L - 8 * d, ROW_LAPTOP, 'myLaptop', d, 'right');
      rowLabel(ctx, PAD_L - 8 * d, ROW_AP,     'AP',       d, 'right');

      // segments: TX1=0.28, SIFS1=0.06, (ACK lost)=0.10, Timeout=0.12, TX2=0.25, SIFS2=0.06, ACK=0.13
      const seg = segLayout(PAD_L, TRACK_W, [0.28, 0.06, 0.10, 0.12, 0.25, 0.06, 0.13]);

      const boxH = 24 * d;
      const ackH = 18 * d;
      const hb   = boxH / 2;

      // TX Frame 1
      if (t > 0) {
        const p = Math.min(1, t / 0.28);
        drawBlock(ctx, seg[0].x, ROW_LAPTOP - hb, seg[0].w * p, boxH, C.blue, 'Frame 1', d, p, C.white);
      }

      // SIFS1
      if (t > 0.30) {
        const a = Math.min(1, (t - 0.30) / 0.06);
        drawSIFS(ctx, seg[1].x, AXIS_Y - 4 * d, seg[1].w, '16 µs\nSIFS', d, a, C.mustard);
      }

      // ACK — shown as dotted / lost
      if (t > 0.36) {
        const p = Math.min(1, (t - 0.36) / 0.10);
        const aw = seg[2].w * p;
        ctx.save();
        ctx.globalAlpha = 0.35;
        drawBlock(ctx, seg[2].x, ROW_AP - ackH / 2, aw, ackH, C.clay, 'ACK ✗', d, p, C.white);
        ctx.restore();
        // cross it out
        if (p >= 0.9) {
          const a = Math.min(1, (t - 0.46) / 0.06);
          ctx.save();
          ctx.globalAlpha = a;
          ctx.strokeStyle = C.clay;
          ctx.lineWidth = 2.5 * d;
          ctx.beginPath();
          ctx.moveTo(seg[2].x, ROW_AP - ackH / 2);
          ctx.lineTo(seg[2].x + aw, ROW_AP + ackH / 2);
          ctx.moveTo(seg[2].x + aw, ROW_AP - ackH / 2);
          ctx.lineTo(seg[2].x, ROW_AP + ackH / 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // ACK Timeout bracket
      if (t > 0.46) {
        const a = Math.min(1, (t - 0.46) / 0.10);
        drawTimeoutBracket(ctx, seg[3].x, ROW_LAPTOP - hb - 16 * d, seg[3].w, 'ACK Timeout', d, a);
      }

      // Rate adaptation note
      if (t > 0.56) {
        const a = Math.min(1, (t - 0.56) / 0.10);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = `${9 * d}px Heebo, sans-serif`;
        ctx.fillStyle = C.clay;
        ctx.textAlign = 'center';
        ctx.fillText('Rate Adaptation: 256-QAM → 64-QAM', PAD_L + TRACK_W * 0.5, ROW_AP + ackH / 2 + 12 * d);
        ctx.restore();
      }

      // Retransmit (TX2) — with Retry Counter badge
      if (t > 0.58) {
        const p = Math.min(1, (t - 0.58) / 0.22);
        drawBlock(ctx, seg[4].x, ROW_LAPTOP - hb, seg[4].w * p, boxH, C.clay, 'Frame 1 (Retry)', d, p, C.white);
        // Retry counter badge
        if (p > 0.3) {
          const ba = Math.min(1, (t - 0.62) / 0.06);
          ctx.save();
          ctx.globalAlpha = ba;
          ctx.fillStyle = C.clay;
          ctx.font = `bold ${8.5 * d}px Heebo, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('Retry Count++', seg[4].x + seg[4].w * 0.5, ROW_LAPTOP - hb - 8 * d);
          ctx.restore();
        }
      }

      // SIFS2
      if (t > 0.82) {
        const a = Math.min(1, (t - 0.82) / 0.06);
        drawSIFS(ctx, seg[5].x, AXIS_Y - 4 * d, seg[5].w, 'SIFS', d, a, C.mustard);
      }

      // ACK2 success
      if (t > 0.88) {
        const p = Math.min(1, (t - 0.88) / 0.12);
        drawBlock(ctx, seg[6].x, ROW_AP - ackH / 2, seg[6].w * p, ackH, C.sage, 'ACK ✓', d, p, C.white);
      }

      if (t >= 1) {
        ctx.save();
        ctx.font = `bold ${12 * d}px Heebo, sans-serif`;
        ctx.fillStyle = C.sage;
        ctx.textAlign = 'right';
        ctx.fillText('✓ Frame נשלח בהצלחה (לאחר Retry)', PAD_L + TRACK_W, ROW_LAPTOP - hb - 8 * d);
        ctx.restore();
      }
    }

    /* ─ BLOCK ACK mode: Frame1+Frame2 burst → one Block ACK ─ */
    function drawBlockAck(ctx, W, H, d, t) {
      const L = timelineLayout(W, H, d);
      const { PAD_L, TRACK_W, ROW_LAPTOP, ROW_AP, AXIS_Y } = L;

      drawAxis(ctx, PAD_L, AXIS_Y, PAD_L + TRACK_W, d);
      drawAxisLabel(ctx, PAD_L + TRACK_W / 2, AXIS_Y + 14 * d, 'Block ACK — 802.11n/ac/ax', d);

      rowLabel(ctx, PAD_L - 8 * d, ROW_LAPTOP, 'myLaptop', d, 'right');
      rowLabel(ctx, PAD_L - 8 * d, ROW_AP,     'AP',       d, 'right');

      // segments: TX1=0.22, gap(SIFS between agg)=0.04, TX2=0.22, SIFS=0.08, BlockACK=0.22, rest
      const seg = segLayout(PAD_L, TRACK_W, [0.22, 0.04, 0.22, 0.08, 0.22, 0.22]);
      const boxH = 24 * d;
      const ackH = 22 * d;
      const hb   = boxH / 2;

      // TX Frame 1
      if (t > 0) {
        const p = Math.min(1, t / 0.22);
        drawBlock(ctx, seg[0].x, ROW_LAPTOP - hb, seg[0].w * p, boxH, C.blue, 'Frame 1', d, p, C.white);
      }

      // tiny aggregation gap (RIFS/AIFS between A-MPDU sub-frames)
      if (t > 0.23) {
        const a = Math.min(1, (t - 0.23) / 0.04);
        ctx.save();
        ctx.globalAlpha = a * 0.5;
        ctx.setLineDash([2 * d, 2 * d]);
        ctx.strokeStyle = C.inkSoft;
        ctx.lineWidth = d;
        ctx.beginPath();
        ctx.moveTo(seg[1].x, ROW_LAPTOP - hb);
        ctx.lineTo(seg[1].x + seg[1].w, ROW_LAPTOP + hb);
        ctx.stroke();
        ctx.restore();
      }

      // TX Frame 2
      if (t > 0.27) {
        const p = Math.min(1, (t - 0.27) / 0.22);
        drawBlock(ctx, seg[2].x, ROW_LAPTOP - hb, seg[2].w * p, boxH, C.blue, 'Frame 2', d, p, C.white);
      }

      // "A-MPDU" brace above the two TX blocks
      if (t > 0.35) {
        const a = Math.min(1, (t - 0.35) / 0.1);
        drawBrace(ctx, seg[0].x, seg[2].x + seg[2].w, ROW_LAPTOP - hb - 18 * d, 'A-MPDU Bundle', d, a, C.blue);
      }

      // SIFS
      if (t > 0.52) {
        const a = Math.min(1, (t - 0.52) / 0.08);
        drawSIFS(ctx, seg[3].x, AXIS_Y - 4 * d, seg[3].w, '16 µs\nSIFS', d, a, C.mustard);
      }

      // Block ACK (wider, different color)
      if (t > 0.62) {
        const p = Math.min(1, (t - 0.62) / 0.22);
        drawBlock(ctx, seg[4].x, ROW_AP - ackH / 2, seg[4].w * p, ackH, C.sage, 'Block ACK', d, p, C.white);
      }

      // savings annotation
      if (t > 0.84) {
        const a = Math.min(1, (t - 0.84) / 0.12);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = `${9.5 * d}px Heebo, sans-serif`;
        ctx.fillStyle = C.inkSoft;
        ctx.textAlign = 'center';
        ctx.fillText('Block ACK חוסך SIFS+ACK נפרד לכל Frame', PAD_L + TRACK_W * 0.75, ROW_AP + ackH / 2 + 12 * d);
        ctx.restore();
      }

      if (t >= 1) {
        ctx.save();
        ctx.font = `bold ${12 * d}px Heebo, sans-serif`;
        ctx.fillStyle = C.sage;
        ctx.textAlign = 'right';
        ctx.fillText('✓ שני Frames אושרו ב-Block ACK אחד', PAD_L + TRACK_W, ROW_LAPTOP - hb - 8 * d);
        ctx.restore();
      }
    }

    /* ══ legend text per progress ══ */
    function updateLegend(t) {
      const texts = {
        success: [
          [0,    0.45, '<b>myLaptop שולח Frame 1.</b> הכרטיס המטוטת מחכה ל-CSMA/CA ולוקח את ה-medium.'],
          [0.45, 0.58, '<b>SIFS — 16 µs (5 GHz).</b> ה-AP ממתין את זמן ה-SIFS הקצר ביותר בפרוטוקול — <em>אף תחנה מ-100 הסטודנטים לא יכולה "לגנוב" את התדר.</em>'],
          [0.58, 0.85, '<b>AP שולח ACK.</b> פריים קטן (ללא Payload) עם Dest MAC של myLaptop בלבד. ✓'],
          [0.85, 1.01, '<b>הצלחה.</b> הקרנל של Windows 11 מקבל אישור: "הפקטות נשלחו בהצלחה."'],
        ],
        retry: [
          [0,    0.30, '<b>myLaptop שולח Frame 1.</b>'],
          [0.30, 0.46, '<b>SIFS → AP שולח ACK — אבל הוא אבד (רעש/ריבוי).</b>'],
          [0.46, 0.58, '<b>ACK Timeout.</b> myLaptop לא שמע ACK בזמן הקצוב → מכריז על Retry. Rate Adaptation: מוריד מ-256-QAM ל-64-QAM כדי לשפר עמידות.'],
          [0.58, 0.88, '<b>Retry — Frame 1 נשלח שוב</b> עם Retry Counter++.'],
          [0.88, 1.01, '<b>הפעם ה-ACK מגיע.</b> הקרנל מקבל אישור.'],
        ],
        blockack: [
          [0,    0.27, '<b>Frame 1 נשלח.</b>'],
          [0.27, 0.52, '<b>Frame 2 נשלח מיד אחריו (A-MPDU).</b> שני הפריימים "מאוגדים" לצרור אחד.'],
          [0.52, 0.62, '<b>SIFS 16 µs</b> — AP מכין Block ACK.'],
          [0.62, 1.01, '<b>Block ACK אחד</b> מאשר את שני הפריימים. חיסכון: מונע SIFS+ACK נפרד לכל Frame. 802.11n/ac/ax.'],
        ],
      };

      const steps = texts[state.mode] || [];
      const active = steps.find(([from, to]) => t >= from && t < to);
      if (active) {
        legend.innerHTML = active[2];
      } else if (t === 0) {
        legend.innerHTML = 'לחץ <b>הפעל אנימציה</b> כדי לצפות בציר הזמן.';
      }
    }

    /* ── initial legend ── */
    updateLegend(0);
    legend.innerHTML = 'לחץ <b>הפעל אנימציה</b> כדי לצפות בציר הזמן.';
    drawFrame(0);

    /* ── keyboard support ── */
    mount.setAttribute('tabindex', '-1');
  } // end render()


  /* ════════════════════════════════════════════
     DRAWING PRIMITIVES
  ════════════════════════════════════════════ */

  function drawBlock(ctx, x, y, w, h, color, label, d, alpha, textColor) {
    if (w <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = color;
    roundRect(ctx, x, y, w, h, 5 * d);
    ctx.fill();
    if (alpha > 0.5 && w > 28 * d) {
      ctx.globalAlpha = Math.min(1, (alpha - 0.5) * 2);
      ctx.fillStyle = textColor || '#fff';
      ctx.font = `bold ${Math.max(8, 10) * d}px Heebo, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // clip label to block width
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 2 * d, y, w - 4 * d, h);
      ctx.clip();
      ctx.fillText(label, x + w / 2, y + h / 2);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawAxis(ctx, x1, y, x2, d) {
    ctx.save();
    ctx.strokeStyle = '#C9B9A0';
    ctx.lineWidth = d;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    // arrow
    ctx.fillStyle = '#C9B9A0';
    ctx.beginPath();
    ctx.moveTo(x2, y);
    ctx.lineTo(x2 - 6 * d, y - 3 * d);
    ctx.lineTo(x2 - 6 * d, y + 3 * d);
    ctx.fill();
    ctx.restore();
  }

  function drawAxisLabel(ctx, x, y, text, d) {
    ctx.save();
    ctx.font = `${9 * d}px Heebo, sans-serif`;
    ctx.fillStyle = '#9E9080';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function rowLabel(ctx, x, y, text, d, align) {
    ctx.save();
    ctx.font = `bold ${10 * d}px Heebo, sans-serif`;
    ctx.fillStyle = '#6B655C';
    ctx.textAlign = align || 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawSIFS(ctx, x, y, w, label, d, alpha, color) {
    if (w <= 0 || alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    // bracket
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * d;
    const bH = 6 * d;
    ctx.beginPath();
    ctx.moveTo(x, y - bH);
    ctx.lineTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y - bH);
    ctx.stroke();
    // shaded fill
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha * 0.12;
    ctx.fillRect(x, y - 60 * d, w, 60 * d);
    // label
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${8.5 * d}px Heebo, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const lines = label.split('\n');
    lines.forEach((ln, i) => ctx.fillText(ln, x + w / 2, y - bH - (lines.length - 1 - i) * 10 * d));
    ctx.restore();
  }

  function drawBeam(ctx, x1, y1, x2, y2, color, alpha, d) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = d;
    ctx.setLineDash([4 * d, 3 * d]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawTimeoutBracket(ctx, x, y, w, label, d, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = C.clay;
    ctx.lineWidth = 1.5 * d;
    ctx.setLineDash([3 * d, 2 * d]);
    const bH = 6 * d;
    ctx.beginPath();
    ctx.moveTo(x, y + bH);
    ctx.lineTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + bH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `${8.5 * d}px Heebo, sans-serif`;
    ctx.fillStyle = C.clay;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, x + w / 2, y - 2 * d);
    ctx.restore();
  }

  function drawBrace(ctx, x1, x2, y, label, d, alpha, color) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * d;
    const h = 5 * d;
    ctx.beginPath();
    ctx.moveTo(x1, y + h);
    ctx.lineTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.lineTo(x2, y + h);
    ctx.stroke();
    ctx.font = `bold ${9 * d}px Heebo, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, (x1 + x2) / 2, y - 2 * d);
    ctx.restore();
  }

  /* ── compute segment x/w from proportions ── */
  function segLayout(startX, totalW, proportions) {
    const segs = [];
    let x = startX;
    for (const p of proportions) {
      const w = totalW * p;
      segs.push({ x, w });
      x += w;
    }
    return segs;
  }

  /* ── roundRect polyfill ── */
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  /* ── DOM helper ── */
  function el(tag, props) {
    const e = document.createElement(tag);
    if (props) Object.assign(e, props);
    return e;
  }

  /* ── Boot ── */
  function boot() {
    document.querySelectorAll('[data-viz="sifs-ack-timeline"]').forEach(mount => render(mount));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
