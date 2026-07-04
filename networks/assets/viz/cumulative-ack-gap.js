/* cumulative-ack-gap.js
 * Simulator: Cumulative ACK with out-of-order "holes" (gaps).
 * Grounded in: tcp.md §3.5, congestion-rdt.md §15
 * Self-contained IIFE — mounts on [data-viz="cumulative-ack-gap"]
 */
(function () {
  'use strict';

  /* ── palette (CONTRACT.md §2) ─────────────────────────────────── */
  const C = {
    bg:       '#FBF7F0',
    surface:  '#FFFDF8',
    surface2: '#FBF5EA',
    ink:      '#33302B',
    inkSoft:  '#6B655C',
    line:     '#E7DECF',
    blue:     '#6E8CA0',
    clay:     '#BE7C5E',
    sage:     '#7C9885',
    mustard:  '#C9A24B',
  };

  /* ── motion preference ─────────────────────────────────────────── */
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ANIM_MS = reducedMotion ? 0 : 420;

  /* ── model constants ───────────────────────────────────────────── */
  const ISN      = 1_000_000;   // from congestion-rdt.md §10
  const MSS      = 1460;        // from congestion-rdt.md §12
  const N_SEGS   = 6;           // number of segments in the demo window

  /* ─────────────────────────────────────────────────────────────── *
   * State
   * ─────────────────────────────────────────────────────────────── */
  function makeState() {
    // Each segment: { seq, len, status: 'unsent'|'transit'|'received'|'lost' }
    const segs = Array.from({ length: N_SEGS }, (_, i) => ({
      id:     i,
      seq:    ISN + 1 + i * MSS,
      len:    MSS,
      status: 'unsent',   // unsent → transit → received | lost
      dropped: false,
    }));
    return {
      segs,
      sendPtr: 0,          // next segment index to send
      rcvNxt: ISN + 1,     // byte the receiver next expects
      ackNum: ISN + 1,     // last ACK sent by receiver
      history: [],         // log entries
      animating: false,
    };
  }

  /* ─────────────────────────────────────────────────────────────── *
   * Mount / render
   * ─────────────────────────────────────────────────────────────── */
  function render(mount) {
    if (!mount) return;

    let state = makeState();

    /* ── outer shell ──────────────────────────────────────────────── */
    mount.style.cssText = `
      font-family: 'Heebo', 'Segoe UI', sans-serif;
      direction: rtl;
      background: ${C.bg};
      border-radius: 14px;
      padding: 0;
      overflow: hidden;
      user-select: none;
    `;

    mount.innerHTML = `
      <div class="cag-wrap" style="display:flex;flex-direction:column;gap:0;">
        <!-- title bar -->
        <div class="cag-title" style="
          background:${C.surface2};
          border-bottom:1px solid ${C.line};
          padding:14px 20px 12px;
          display:flex;align-items:center;gap:10px;">
          <span style="font-size:1.15rem;font-weight:700;color:${C.ink};">Cumulative ACK עם חורים</span>
          <span style="font-size:.82rem;color:${C.inkSoft};margin-right:auto;">out-of-order segments</span>
        </div>

        <!-- legend -->
        <div class="cag-legend" style="
          display:flex;flex-wrap:wrap;gap:10px;
          padding:10px 20px 0;
          direction:ltr;">
        </div>

        <!-- main canvas area -->
        <div class="cag-main" style="padding:18px 20px 4px;display:flex;flex-direction:column;gap:14px;">

          <!-- sender row -->
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="cag-label" style="width:72px;text-align:right;font-size:.8rem;color:${C.inkSoft};flex-shrink:0;">Sender</div>
            <div class="cag-sender-buf" style="
              flex:1;display:flex;gap:4px;
              background:${C.surface};
              border:1px solid ${C.line};
              border-radius:9px;
              padding:8px 10px;
              min-height:54px;
              align-items:center;
              overflow:hidden;
            "></div>
          </div>

          <!-- arrow area -->
          <div class="cag-arrow-area" style="
            position:relative;
            height:52px;
            margin:0 82px;
          ">
            <canvas class="cag-arrows-canvas" style="position:absolute;inset:0;width:100%;height:100%;"></canvas>
            <div class="cag-in-flight" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:6px;"></div>
          </div>

          <!-- receiver row -->
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="cag-label" style="width:72px;text-align:right;font-size:.8rem;color:${C.inkSoft};flex-shrink:0;">Receiver</div>
            <div class="cag-recv-buf" style="
              flex:1;display:flex;gap:4px;
              background:${C.surface};
              border:1px solid ${C.line};
              border-radius:9px;
              padding:8px 10px;
              min-height:54px;
              align-items:center;
              overflow:hidden;
            "></div>
          </div>

          <!-- ACK display -->
          <div class="cag-ack-row" style="
            display:flex;align-items:center;gap:16px;
            background:${C.surface2};
            border:1px solid ${C.line};
            border-radius:9px;
            padding:10px 16px;
            margin-top:2px;
          ">
            <span style="font-size:.8rem;color:${C.inkSoft};flex-shrink:0;">ACK שנשלח:</span>
            <span class="cag-ack-val" style="
              font-family:'JetBrains Mono',monospace;
              font-size:.95rem;
              font-weight:700;
              color:${C.blue};
              letter-spacing:.5px;
            ">${fmtSeq(ISN + 1)}</span>
            <span class="cag-ack-meaning" style="font-size:.78rem;color:${C.inkSoft};margin-right:6px;"></span>
            <div class="cag-ack-arrow" style="
              flex:1;height:2px;
              background:linear-gradient(to left,${C.blue} 0%,transparent 100%);
              border-radius:2px;
              position:relative;
              opacity:.5;
            ">
              <span style="
                position:absolute;left:-2px;top:-4px;
                color:${C.blue};font-size:1rem;line-height:1;
              ">←</span>
            </div>
          </div>

          <!-- rcvNxt indicator -->
          <div style="display:flex;align-items:center;gap:8px;padding:0 0 2px;">
            <span style="font-size:.78rem;color:${C.inkSoft};">RCV.NXT =</span>
            <span class="cag-rcvnxt" style="
              font-family:'JetBrains Mono',monospace;
              font-size:.85rem;color:${C.sage};font-weight:600;
            ">${fmtSeq(ISN + 1)}</span>
            <span style="font-size:.78rem;color:${C.inkSoft};">— הבית הבא הצפוי</span>
          </div>
        </div>

        <!-- event log -->
        <div class="cag-log-wrap" style="
          background:${C.surface};
          border-top:1px solid ${C.line};
          margin-top:10px;
          max-height:130px;
          overflow-y:auto;
          padding:8px 20px 10px;
        ">
          <div class="cag-log" style="
            display:flex;flex-direction:column;gap:3px;
          "></div>
        </div>

        <!-- controls -->
        <div class="viz-controls" style="
          display:flex;flex-wrap:wrap;gap:8px;
          padding:12px 20px 16px;
          border-top:1px solid ${C.line};
          background:${C.surface2};
          direction:rtl;
        ">
          <button class="viz-btn cag-send" aria-label="שלח סגמנט" style="${btnStyle(C.blue)}">
            שלח סגמנט ▶
          </button>
          <button class="viz-btn cag-drop-next" aria-label="שלח ואבד" style="${btnStyle(C.clay)}">
            שלח (אבד!) 💀
          </button>
          <button class="viz-btn cag-deliver" aria-label="מסור סגמנטים" style="${btnStyle(C.sage)}">
            מסור ל-Receiver ✓
          </button>
          <button class="viz-btn cag-reset" aria-label="אפס" style="${btnStyle(C.inkSoft)}">
            אפס ↺
          </button>
        </div>
      </div>
    `;

    /* ── legend ──────────────────────────────────────────────────── */
    const legendEl = mount.querySelector('.cag-legend');
    [
      { color: C.blue,    label: 'בתהליך שליחה (in-flight)' },
      { color: C.sage,    label: 'התקבל ✓ (in-order)' },
      { color: C.mustard, label: 'התקבל — out-of-order (חור)' },
      { color: C.clay,    label: 'אבד ✗' },
      { color: C.line,    label: 'טרם נשלח' },
    ].forEach(({ color, label }) => {
      const el = document.createElement('div');
      el.style.cssText = `display:flex;align-items:center;gap:5px;font-size:.72rem;color:${C.inkSoft};`;
      el.innerHTML = `<span style="
        width:12px;height:12px;border-radius:3px;
        background:${color};border:1px solid ${C.line};
        flex-shrink:0;display:inline-block;
      "></span>${label}`;
      legendEl.appendChild(el);
    });

    /* ── DOM refs ────────────────────────────────────────────────── */
    const senderBuf  = mount.querySelector('.cag-sender-buf');
    const recvBuf    = mount.querySelector('.cag-recv-buf');
    const ackVal     = mount.querySelector('.cag-ack-val');
    const ackMeaning = mount.querySelector('.cag-ack-meaning');
    const rcvNxtEl   = mount.querySelector('.cag-rcvnxt');
    const logEl      = mount.querySelector('.cag-log');
    const btnSend    = mount.querySelector('.cag-send');
    const btnDrop    = mount.querySelector('.cag-drop-next');
    const btnDeliver = mount.querySelector('.cag-deliver');
    const btnReset   = mount.querySelector('.cag-reset');

    /* ── draw buffers ─────────────────────────────────────────────── */
    function drawBuffers() {
      /* sender */
      senderBuf.innerHTML = '';
      state.segs.forEach(seg => {
        const box = segBox(seg, 'send');
        senderBuf.appendChild(box);
      });

      /* receiver: show slots, fill with status */
      recvBuf.innerHTML = '';
      state.segs.forEach(seg => {
        const box = segBox(seg, 'recv');
        recvBuf.appendChild(box);
      });

      /* ACK */
      const ack = state.ackNum;
      ackVal.textContent = fmtSeq(ack);
      const meaning = ack === ISN + 1
        ? '(sem inicial — nenhum dado recebido)'
        : `(espero byte ${fmtSeq(ack)})`;
      // Hebrew meaning:
      ackMeaning.textContent = ack === ISN + 1
        ? '(טרם התקבל מידע)'
        : `(מצפה לבית ${fmtSeq(ack)})`;

      /* RCV.NXT */
      rcvNxtEl.textContent = fmtSeq(state.rcvNxt);

      /* buttons */
      const allSent = state.sendPtr >= N_SEGS;
      btnSend.disabled  = allSent || state.animating;
      btnDrop.disabled  = allSent || state.animating;
      const hasTransit = state.segs.some(s => s.status === 'transit' && !s.dropped);
      btnDeliver.disabled = !hasTransit || state.animating;
    }

    function segBox(seg, side) {
      const div = document.createElement('div');
      div.setAttribute('data-id', seg.id);

      let bg, border, textColor, label;
      if (side === 'send') {
        if (seg.status === 'unsent') {
          bg = C.surface2; border = C.line; textColor = C.inkSoft;
        } else if (seg.status === 'transit') {
          bg = seg.dropped ? C.clay : C.blue;
          border = seg.dropped ? C.clay : C.blue;
          textColor = '#fff';
        } else if (seg.status === 'received') {
          bg = C.sage; border = C.sage; textColor = '#fff';
        } else {
          bg = C.clay + '44'; border = C.clay; textColor = C.clay;
        }
        label = `S${seg.id + 1}`;
      } else {
        /* receiver side */
        if (seg.status === 'received') {
          /* check if in-order or out-of-order */
          const expectedByte = ISN + 1 + seg.id * MSS;
          const isInOrder = seg.seq <= state.rcvNxt && seg.status === 'received';
          /* simplified: use ackNum to determine contiguous */
          const contiguous = seg.seq < state.ackNum;
          bg = contiguous ? C.sage : C.mustard;
          border = bg; textColor = '#fff';
          label = contiguous ? `S${seg.id + 1} ✓` : `S${seg.id + 1} ⚠`;
        } else {
          bg = C.surface2; border = C.line; textColor = C.inkSoft;
          label = `S${seg.id + 1}`;
        }
      }

      div.style.cssText = `
        flex:1;min-width:38px;max-width:70px;
        height:40px;
        border-radius:7px;
        background:${bg};
        border:2px solid ${border};
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        gap:1px;
        transition:${reducedMotion ? 'none' : 'background 0.3s,border 0.3s'};
        cursor:default;
      `;
      const seqShort = `…${String(seg.seq).slice(-4)}`;
      div.innerHTML = `
        <span style="font-size:.68rem;font-weight:700;color:${textColor};">${label}</span>
        <span style="font-size:.58rem;color:${textColor};opacity:.8;font-family:monospace;">${seqShort}</span>
      `;
      div.setAttribute('title', `Seq=${seg.seq}, ${MSS} bytes`);
      div.setAttribute('role', 'img');
      div.setAttribute('aria-label', `סגמנט ${seg.id + 1}, seq ${seg.seq}`);
      return div;
    }

    /* ── log helper ───────────────────────────────────────────────── */
    function addLog(msg, color) {
      const entry = document.createElement('div');
      entry.style.cssText = `
        font-size:.74rem;
        color:${color || C.inkSoft};
        font-family:'JetBrains Mono',monospace;
        padding:1px 0;
        border-bottom:1px solid ${C.line}22;
        direction:ltr;
        text-align:left;
      `;
      entry.textContent = msg;
      logEl.prepend(entry);
      state.history.push(msg);
    }

    /* ── send action ──────────────────────────────────────────────── */
    function doSend(drop) {
      if (state.sendPtr >= N_SEGS || state.animating) return;
      const seg = state.segs[state.sendPtr];
      seg.status  = 'transit';
      seg.dropped = drop;
      state.sendPtr++;

      const verb = drop ? 'SENT (will be LOST)' : 'SENT';
      addLog(
        `→ Seg ${seg.id + 1} [seq=${seg.seq}, len=${seg.len}] ${verb}`,
        drop ? C.clay : C.blue
      );

      drawBuffers();
    }

    /* ── deliver action ───────────────────────────────────────────── */
    function doDeliver() {
      /* Find all transit segments not yet dropped; deliver them */
      const toDeliver = state.segs.filter(
        s => s.status === 'transit' && !s.dropped
      );
      const toLose = state.segs.filter(
        s => s.status === 'transit' && s.dropped
      );

      /* Mark dropped as lost */
      toLose.forEach(s => { s.status = 'lost'; });

      /* Mark received */
      toDeliver.forEach(s => { s.status = 'received'; });

      /* Compute new ackNum = smallest missing byte after ISN+1 */
      let expected = ISN + 1;
      for (let i = 0; i < N_SEGS; i++) {
        const s = state.segs[i];
        if (s.status === 'received' && s.seq === expected) {
          expected += s.len;
        } else {
          break;
        }
      }
      state.ackNum = expected;
      state.rcvNxt = expected;

      /* Log per delivered/lost */
      toDeliver.forEach(s => {
        const inOrder = s.seq < expected;
        if (inOrder) {
          addLog(
            `✓ Seg ${s.id + 1} [seq=${s.seq}] received IN-ORDER → ACK ${state.ackNum}`,
            C.sage
          );
        } else {
          addLog(
            `⚠ Seg ${s.id + 1} [seq=${s.seq}] received OUT-OF-ORDER (hole!) → ACK still ${state.ackNum}`,
            C.mustard
          );
        }
      });
      toLose.forEach(s => {
        addLog(
          `✗ Seg ${s.id + 1} [seq=${s.seq}] LOST — receiver sends duplicate ACK ${state.ackNum}`,
          C.clay
        );
      });

      drawBuffers();
    }

    /* ── reset ────────────────────────────────────────────────────── */
    function doReset() {
      state = makeState();
      logEl.innerHTML = '';
      drawBuffers();
    }

    /* ── button wiring ────────────────────────────────────────────── */
    btnSend.addEventListener('click', () => doSend(false));
    btnDrop.addEventListener('click', () => doSend(true));
    btnDeliver.addEventListener('click', doDeliver);
    btnReset.addEventListener('click', doReset);

    /* keyboard: s=send, d=drop+send, enter=deliver, r=reset */
    mount.setAttribute('tabindex', '0');
    mount.addEventListener('keydown', e => {
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); doSend(false); }
      if (e.key === 'd' || e.key === 'D') { e.preventDefault(); doSend(true); }
      if (e.key === 'Enter')              { e.preventDefault(); doDeliver(); }
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); doReset(); }
    });

    /* initial draw */
    drawBuffers();

    /* add initial hint log */
    addLog('— הדמיה: לחץ "שלח סגמנט" או "שלח (אבד!)" ואחר "מסור ל-Receiver" —', C.inkSoft);
    addLog(`ISN = ${ISN} | MSS = ${MSS} bytes | ${N_SEGS} segments`, C.inkSoft);
  }

  /* ── helpers ──────────────────────────────────────────────────── */
  function fmtSeq(n) {
    return n.toLocaleString('en-US').replace(/,/g, ',');
  }

  function btnStyle(color) {
    return `
      background:${color};
      color:#fff;
      border:none;
      border-radius:8px;
      padding:8px 14px;
      font-size:.82rem;
      font-family:'Heebo','Segoe UI',sans-serif;
      font-weight:600;
      cursor:pointer;
      transition:opacity .15s;
    `;
  }

  /* ── DOMContentLoaded entrypoint ─────────────────────────────── */
  function init() {
    document.querySelectorAll('[data-viz="cumulative-ack-gap"]').forEach(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
