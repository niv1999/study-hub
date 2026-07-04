/* triple-dance-gauges.js — Triple Dance: cwnd × rwnd → Effective Window
   Self-contained IIFE. Mounts on [data-viz="triple-dance-gauges"].
   Design palette: cream theme from CONTRACT.md §2.
   Source model: congestion-rdt.md §3, window-flow.md §3 (SendW.pdf + flow.pdf)
*/
(function () {
  'use strict';

  /* ── Palette (hardcoded from CONTRACT §2) ── */
  const C = {
    bg: '#FBF7F0',
    surface: '#FFFDF8',
    surface2: '#FBF5EA',
    ink: '#33302B',
    inkSoft: '#6B655C',
    line: '#E7DECF',
    blue: '#6E8CA0',   // dusty-blue  → cwnd (network)
    clay: '#BE7C5E',   // clay        → rwnd (receiver)
    sage: '#7C9885',   // sage        → effective window (result)
    mustard: '#C9A24B',
  };

  /* ── prefers-reduced-motion ── */
  const reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ANIM_MS = reducedMotion ? 0 : 280;

  /* ── Main render function ── */
  function render(mount) {
    /* Safety */
    if (!mount) return;

    /* State (in MSS units, max 64) */
    const state = { cwnd: 20, rwnd: 32, maxMSS: 64 };

    /* ── Build DOM ── */
    mount.innerHTML = '';
    mount.style.cssText = `
      font-family: Heebo, Arial, sans-serif;
      direction: rtl;
      background: ${C.bg};
      border-radius: 16px;
      padding: 20px 16px 16px;
      box-sizing: border-box;
      user-select: none;
    `;

    /* Title bar */
    const titleBar = el('div', {
      style: `display:flex;align-items:center;gap:10px;margin-bottom:18px;`
    });
    titleBar.appendChild(el('span', {
      style: `font-size:1.15rem;font-weight:700;color:${C.ink};`,
      text: 'הריקוד המשולש'
    }));
    titleBar.appendChild(el('span', {
      style: `font-size:.82rem;color:${C.inkSoft};font-weight:400;direction:ltr;`,
      text: 'Effective Window = min(cwnd, rwnd)'
    }));
    mount.appendChild(titleBar);

    /* Three-column panel */
    const panel = el('div', {
      style: `display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:start;`
    });

    /* ─ LEFT: cwnd gauge ─ */
    const cwnPanel = makeGaugePanel({
      label: 'cwnd',
      sublabel: 'בקרת עומסים (רשת)',
      color: C.blue,
      value: state.cwnd,
      max: state.maxMSS,
      onInput: v => { state.cwnd = v; update(); },
      id: 'tdg-cwnd-' + randomId(),
    });

    /* ─ MIDDLE: result ─ */
    const midPanel = el('div', {
      style: `display:flex;flex-direction:column;align-items:center;justify-content:center;padding-top:40px;gap:4px;`
    });
    const eqLabel = el('div', {
      style: `font-size:.75rem;color:${C.inkSoft};direction:ltr;font-weight:500;letter-spacing:.02em;margin-bottom:6px;`,
      text: 'min(cwnd, rwnd)'
    });
    const arrowSVG = svgArrow(C.sage);
    const resultBox = el('div', {
      style: `
        background:${C.surface};
        border:2px solid ${C.sage};
        border-radius:14px;
        padding:12px 18px;
        text-align:center;
        box-shadow:0 2px 10px rgba(120,100,70,.08),0 1px 3px rgba(120,100,70,.06);
        min-width:88px;
      `
    });
    const resultLabel = el('div', {
      style: `font-size:.72rem;color:${C.inkSoft};margin-bottom:4px;font-weight:500;`,
      text: 'חלון אפקטיבי'
    });
    const resultValue = el('div', {
      style: `font-size:1.9rem;font-weight:800;color:${C.sage};line-height:1;`,
      text: '—'
    });
    const resultUnit = el('div', {
      style: `font-size:.72rem;color:${C.inkSoft};margin-top:3px;direction:ltr;`,
      text: 'MSS'
    });
    resultBox.appendChild(resultLabel);
    resultBox.appendChild(resultValue);
    resultBox.appendChild(resultUnit);
    midPanel.appendChild(eqLabel);
    midPanel.appendChild(arrowSVG);
    midPanel.appendChild(resultBox);

    /* bottleneck label */
    const bottleneckLabel = el('div', {
      style: `font-size:.7rem;margin-top:8px;color:${C.inkSoft};text-align:center;min-height:1.2em;`
    });
    midPanel.appendChild(bottleneckLabel);

    /* ─ RIGHT: rwnd gauge ─ */
    const rwndPanel = makeGaugePanel({
      label: 'rwnd',
      sublabel: 'בקרת זרימה (נמען)',
      color: C.clay,
      value: state.rwnd,
      max: state.maxMSS,
      onInput: v => { state.rwnd = v; update(); },
      id: 'tdg-rwnd-' + randomId(),
    });

    panel.appendChild(cwnPanel.root);
    panel.appendChild(midPanel);
    panel.appendChild(rwndPanel.root);
    mount.appendChild(panel);

    /* ── Controls bar ── */
    const ctrlBar = el('div', { className: 'viz-controls' });
    ctrlBar.style.cssText = `
      display:flex;align-items:center;gap:8px;flex-wrap:wrap;
      margin-top:16px;padding-top:14px;
      border-top:1px solid ${C.line};
      justify-content:center;
    `;

    const presets = [
      { label: 'התחלת חיבור', cwnd: 10, rwnd: 45 },
      { label: 'עומס ברשת',   cwnd: 8,  rwnd: 45 },
      { label: 'נמען איטי',   cwnd: 40, rwnd: 6  },
      { label: 'איזון',       cwnd: 24, rwnd: 24 },
    ];

    presets.forEach(p => {
      const btn = el('button', {
        className: 'viz-btn',
        text: p.label,
      });
      btn.setAttribute('type', 'button');
      styleBtn(btn);
      btn.addEventListener('click', () => {
        state.cwnd = p.cwnd;
        state.rwnd = p.rwnd;
        cwnPanel.setValue(p.cwnd);
        rwndPanel.setValue(p.rwnd);
        update();
      });
      ctrlBar.appendChild(btn);
    });
    mount.appendChild(ctrlBar);

    /* ── hint ── */
    const hint = el('p', {
      style: `text-align:center;font-size:.72rem;color:${C.inkSoft};margin:10px 0 0;`,
      text: 'הזיזו את המחוונים או לחצו על תרחיש להדגמה'
    });
    mount.appendChild(hint);

    /* ── Update function ── */
    let _animFrame = null;
    function update() {
      const eff = Math.min(state.cwnd, state.rwnd);
      resultValue.textContent = eff;

      /* Bottleneck label */
      if (state.cwnd < state.rwnd) {
        bottleneckLabel.textContent = '← צוואר בקבוק: הרשת (cwnd)';
        bottleneckLabel.style.color = C.blue;
      } else if (state.rwnd < state.cwnd) {
        bottleneckLabel.textContent = 'צוואר בקבוק: הנמען (rwnd) ←';
        bottleneckLabel.style.color = C.clay;
      } else {
        bottleneckLabel.textContent = 'איזון מושלם ✓';
        bottleneckLabel.style.color = C.sage;
      }

      cwnPanel.update(state.cwnd);
      rwndPanel.update(state.rwnd);
      highlightResult(eff);
    }

    function highlightResult(eff) {
      if (ANIM_MS === 0) return;
      resultBox.style.transition = `box-shadow ${ANIM_MS}ms ease`;
      resultBox.style.boxShadow = `0 0 0 3px ${C.sage}55`;
      clearTimeout(_animFrame);
      _animFrame = setTimeout(() => {
        resultBox.style.boxShadow = `0 2px 10px rgba(120,100,70,.08),0 1px 3px rgba(120,100,70,.06)`;
      }, ANIM_MS * 1.5);
    }

    /* Initial render */
    update();

    /* ─────────────────────────────────────────────────────
       makeGaugePanel: creates one gauge column
       ───────────────────────────────────────────────────── */
    function makeGaugePanel({ label, sublabel, color, value, max, onInput, id }) {
      const root = el('div', {
        style: `display:flex;flex-direction:column;align-items:center;gap:10px;`
      });

      /* Header */
      const hdr = el('div', { style: `text-align:center;` });
      hdr.appendChild(el('div', {
        style: `font-size:1.1rem;font-weight:700;color:${color};direction:ltr;`,
        text: label
      }));
      hdr.appendChild(el('div', {
        style: `font-size:.72rem;color:${C.inkSoft};margin-top:2px;`,
        text: sublabel
      }));
      root.appendChild(hdr);

      /* Circular gauge SVG */
      const R = 52, stroke = 10, cx = 68, cy = 68;
      const circ = 2 * Math.PI * R;
      const svgNS = 'http://www.w3.org/2000/svg';

      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', '136');
      svg.setAttribute('height', '136');
      svg.setAttribute('viewBox', '0 0 136 136');
      svg.setAttribute('aria-hidden', 'true');

      /* Track circle */
      const track = document.createElementNS(svgNS, 'circle');
      track.setAttribute('cx', cx); track.setAttribute('cy', cy);
      track.setAttribute('r', R);
      track.setAttribute('fill', 'none');
      track.setAttribute('stroke', C.line);
      track.setAttribute('stroke-width', stroke);
      svg.appendChild(track);

      /* Progress arc */
      const arc = document.createElementNS(svgNS, 'circle');
      arc.setAttribute('cx', cx); arc.setAttribute('cy', cy);
      arc.setAttribute('r', R);
      arc.setAttribute('fill', 'none');
      arc.setAttribute('stroke', color);
      arc.setAttribute('stroke-width', stroke);
      arc.setAttribute('stroke-linecap', 'round');
      arc.setAttribute('stroke-dasharray', circ);
      arc.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
      if (!reducedMotion) {
        arc.style.transition = `stroke-dashoffset ${ANIM_MS}ms ease`;
      }
      svg.appendChild(arc);

      /* Center text: value */
      const cText = document.createElementNS(svgNS, 'text');
      cText.setAttribute('x', cx); cText.setAttribute('y', cy - 6);
      cText.setAttribute('text-anchor', 'middle');
      cText.setAttribute('dominant-baseline', 'auto');
      cText.setAttribute('font-size', '26');
      cText.setAttribute('font-weight', '700');
      cText.setAttribute('fill', color);
      cText.setAttribute('font-family', 'Heebo, Arial, sans-serif');
      svg.appendChild(cText);

      /* Center text: unit */
      const uText = document.createElementNS(svgNS, 'text');
      uText.setAttribute('x', cx); uText.setAttribute('y', cy + 14);
      uText.setAttribute('text-anchor', 'middle');
      uText.setAttribute('font-size', '11');
      uText.setAttribute('fill', C.inkSoft);
      uText.setAttribute('font-family', 'Heebo, Arial, sans-serif');
      uText.textContent = 'MSS';
      svg.appendChild(uText);

      root.appendChild(svg);

      /* Slider */
      const sliderWrap = el('div', { style: `width:100%;padding:0 8px;box-sizing:border-box;` });

      const sliderLabel = el('label', {
        style: `display:block;font-size:.7rem;color:${C.inkSoft};margin-bottom:4px;text-align:center;direction:ltr;`,
        text: `${label}: 1–${max} MSS`,
      });
      sliderLabel.setAttribute('for', id);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.id = id;
      slider.min = 1;
      slider.max = max;
      slider.value = value;
      slider.setAttribute('aria-label', `${label} בגדלי MSS`);
      styleSlider(slider, color);

      slider.addEventListener('input', () => {
        const v = parseInt(slider.value, 10);
        onInput(v);
      });

      sliderWrap.appendChild(sliderLabel);
      sliderWrap.appendChild(slider);
      root.appendChild(sliderWrap);

      /* Public interface */
      function setArc(v) {
        const pct = Math.max(0, Math.min(v / max, 1));
        const dash = circ * pct;
        arc.setAttribute('stroke-dashoffset', circ - dash);
        cText.textContent = v;
      }

      setArc(value);

      return {
        root,
        update(v) { setArc(v); },
        setValue(v) {
          slider.value = v;
          setArc(v);
        }
      };
    }
  } /* end render() */

  /* ── Utility: create element ── */
  function el(tag, { style, className, text, id } = {}) {
    const e = document.createElement(tag);
    if (style) e.style.cssText = style;
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    if (id) e.id = id;
    return e;
  }

  function randomId() {
    return Math.random().toString(36).slice(2, 8);
  }

  /* ── Arrow SVG in the middle ── */
  function svgArrow(color) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(svgNS, 'svg');
    s.setAttribute('width', '28'); s.setAttribute('height', '28');
    s.setAttribute('viewBox', '0 0 28 28');
    s.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M14 3 L14 20 M7 13 L14 21 L21 13');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('fill', 'none');
    s.appendChild(path);
    return s;
  }

  /* ── Style helpers ── */
  function styleBtn(btn) {
    btn.style.cssText = `
      font-family:Heebo,Arial,sans-serif;
      font-size:.78rem;
      font-weight:600;
      background:${C.surface2};
      color:${C.ink};
      border:1px solid ${C.line};
      border-radius:8px;
      padding:5px 12px;
      cursor:pointer;
      transition:background 150ms, box-shadow 150ms;
      outline:none;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = C.line;
      btn.style.boxShadow = '0 2px 6px rgba(120,100,70,.10)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = C.surface2;
      btn.style.boxShadow = 'none';
    });
    btn.addEventListener('focus', () => {
      btn.style.boxShadow = `0 0 0 3px ${C.blue}44`;
    });
    btn.addEventListener('blur', () => {
      btn.style.boxShadow = 'none';
    });
  }

  function styleSlider(slider, accentColor) {
    /* Inject per-slider style via a <style> tag unique to this element */
    const sid = 'tdg-slider-' + randomId();
    slider.classList.add(sid);
    const css = `
      input[type=range].${sid} {
        -webkit-appearance:none;
        appearance:none;
        width:100%;
        height:6px;
        border-radius:4px;
        background:${C.line};
        outline:none;
        cursor:pointer;
        direction:ltr;
      }
      input[type=range].${sid}::-webkit-slider-thumb {
        -webkit-appearance:none;
        appearance:none;
        width:18px;height:18px;
        border-radius:50%;
        background:${accentColor};
        border:2px solid #fff;
        box-shadow:0 1px 4px rgba(0,0,0,.15);
        cursor:pointer;
        transition:transform 120ms;
      }
      input[type=range].${sid}::-webkit-slider-thumb:hover {
        transform:scale(1.15);
      }
      input[type=range].${sid}:focus {
        box-shadow:0 0 0 3px ${accentColor}44;
        border-radius:4px;
      }
      input[type=range].${sid}::-moz-range-thumb {
        width:16px;height:16px;
        border-radius:50%;
        background:${accentColor};
        border:2px solid #fff;
        cursor:pointer;
      }
    `;
    const styleTag = document.createElement('style');
    styleTag.textContent = css;
    document.head.appendChild(styleTag);
  }

  /* ── Bootstrap ── */
  function init() {
    document.querySelectorAll('[data-viz="triple-dance-gauges"]').forEach(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
