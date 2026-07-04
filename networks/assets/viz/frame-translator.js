/* frame-translator.js — 802.11 ⇄ 802.3 Frame Translation at the AP
   Self-contained IIFE. Mounts on [data-viz="frame-translator"].
   Based on wifi-lan.md PART D + DIAGRAMS D2/D3.
   Palette from CONTRACT.md §2 (hardcoded hexes).
*/
(function () {
  'use strict';

  /* ─── palette ──────────────────────────────────────────────── */
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
  };

  /* ─── field definitions ─────────────────────────────────────── */
  const WIFI_FIELDS = [
    { id: 'fc',      label: 'Frame Control',       bytes: '2B',  color: C.blue,    dim: false,
      heLabel: 'בקרת מסגרת',
      desc: 'Type = Data, ToDS=1 / FromDS=0 → מ-myLaptop לתחנת הבסיס (AP). מגדיר את סוג הפריים ומיקומו בטופולוגיה.' },
    { id: 'dur',     label: 'Duration / NAV',       bytes: '2B',  color: C.clay,   dim: true,
      heLabel: 'משך / NAV',
      desc: 'שדה NAV — Network Allocation Vector. מציין כמה זמן הפריים יתפוס את האוויר. ה-AP מסיר אותו בעת התרגום כי לאתרנט אין מדיה משותפת.' },
    { id: 'a1',      label: 'Addr 1 — AP (Rx)',     bytes: '6B',  color: C.mustard, dim: false,
      heLabel: 'כתובת 1 — AP (מקלט)',
      desc: 'כתובת ה-MAC של ה-AP עצמו — המקלט הישיר באוויר. בתרגום לאתרנט השדה הזה לא ממופה ישירות: האינפורמציה כבר הגיעה לאוויר.' },
    { id: 'a2',      label: 'Addr 2 — myLaptop (Tx)', bytes: '6B', color: C.sage,  dim: false,
      heLabel: 'כתובת 2 — myLaptop (משדר)',
      desc: 'כתובת ה-MAC של myLaptop — המשדר בפועל. ה-AP ממפה אותה ל-Source MAC של מסגרת האתרנט שנשלחת לרשת הקווית.' },
    { id: 'a3',      label: 'Addr 3 — Gateway (Dst)', bytes: '6B', color: C.blue,  dim: false,
      heLabel: 'כתובת 3 — Gateway (יעד)',
      desc: 'כתובת ה-MAC של שער ברירת המחדל (Core Router). ה-AP ממפה אותה ל-Destination MAC של מסגרת האתרנט.' },
    { id: 'sc',      label: 'Sequence Control',     bytes: '2B',  color: C.clay,   dim: true,
      heLabel: 'בקרת רצף',
      desc: 'מספר פנימי של כרטיס ה-WiFi ב-Windows 11 Kernel. מסייע ל-AP לזהות שידורים כפולים (retransmissions) באוויר. ה-AP מסיר אותו בתרגום.' },
    { id: 'qos',     label: 'QoS Control',          bytes: '2B',  color: C.clay,   dim: true,
      heLabel: 'בקרת QoS',
      desc: 'מציין עדיפות התנועה — HTTP גבוה מהורדות ברקע. ה-AP מסיר אותו אחרי שמחיל QoS על המסגרת הקווית (CoS).' },
    { id: 'ccmp',    label: 'CCMP / PN Header',     bytes: '8B',  color: '#A07890', dim: false,
      heLabel: 'כותרת הצפנה CCMP',
      desc: 'כותרת אבטחה ב-WPA2/WPA3. כולל PN (Packet Number) — מונה 48-ביט שמונע מתקפות Replay. נשמר בתוך ה-Payload המוצפן.' },
    { id: 'pay',     label: 'Payload (Encrypted)',  bytes: '≤1480B', color: C.sage,  dim: false,
      heLabel: 'מטען — מוצפן',
      desc: 'ה-IP Datagram המוצפן: 20B IP + 20B TCP + נתונים (1440B במסגרת 1, 1020B במסגרת 2). MIC 8B בסוף. נשמר כמעט ללא שינוי.' },
    { id: 'fcs',     label: 'FCS (Wi-Fi)',           bytes: '4B',  color: '#9090A0', dim: true,
      heLabel: 'FCS — WiFi',
      desc: 'Frame Check Sequence של ה-WiFi. ה-AP מחשב FCS ובודק תקינות. אם יש שגיאה — זורק את הפריים ולא שולח ACK, ו-myLaptop ישדר מחדש. ה-AP מסיר FCS ישן ומחשב חדש לאתרנט.' },
  ];

  const ETH_FIELDS = [
    { id: 'dst',     label: 'Dst MAC (Gateway)',    bytes: '6B',  color: C.blue,    srcId: 'a3',
      heLabel: 'כתובת יעד — Gateway',
      desc: 'ממופה מ-Addr 3 של ה-WiFi — כתובת ה-MAC של ה-Core Router / Default Gateway.' },
    { id: 'src',     label: 'Src MAC (myLaptop)',   bytes: '6B',  color: C.sage,    srcId: 'a2',
      heLabel: 'כתובת מקור — myLaptop',
      desc: 'ממופה מ-Addr 2 של ה-WiFi — כתובת ה-MAC של myLaptop. Switch ב-Access Switch ילמד כתובת זו ב-Port 12.' },
    { id: 'vlan',    label: '802.1Q Tag (VLAN 20)', bytes: '4B',  color: C.mustard, srcId: null,
      heLabel: 'תג VLAN 20',
      desc: 'נוסף על-ידי ה-AP! ה-AP מחבר ל-Trunk Port ומוסיף תג 802.1Q עם VLAN 20 ("WiFi-Faculty"). ב-WiFi אין שדה כזה.' },
    { id: 'et',      label: 'EtherType 0x0800',     bytes: '2B',  color: C.clay,    srcId: null,
      heLabel: 'EtherType — IPv4',
      desc: 'ה-AP שומר את ה-EtherType המקורי (0x0800 = IPv4). ה-Core Router ידע לפענח את ה-IP Datagram בהמשך.' },
    { id: 'epay',    label: 'Payload',               bytes: '≤1480B', color: C.sage, srcId: 'pay',
      heLabel: 'מטען',
      desc: 'אותו IP Datagram מוצפן שהגיע ב-WiFi. ה-AP לא מפענח את ההצפנה — הוא מעביר אותה כמות שהיא.' },
    { id: 'efcs',    label: 'FCS (Ethernet)',        bytes: '4B',  color: '#9090A0', srcId: null,
      heLabel: 'FCS — Ethernet',
      desc: 'ה-AP מחשב FCS חדש עבור מסגרת האתרנט החדשה שיוצרת. לא זהה ל-FCS של ה-WiFi.' },
  ];

  const REMOVED_IDS = new Set(['dur', 'sc', 'qos', 'a1', 'fcs']);

  /* ─── render ────────────────────────────────────────────────── */
  function render(mount) {
    mount.style.fontFamily = 'Heebo, Assistant, sans-serif';
    mount.style.direction  = 'rtl';
    mount.style.color      = C.ink;

    /* ── outer shell ── */
    const root = document.createElement('div');
    root.style.cssText = `background:${C.bg};border-radius:14px;padding:20px 16px 16px;box-sizing:border-box;max-width:900px;margin:0 auto;`;
    mount.appendChild(root);

    /* ── title bar ── */
    const titleBar = el('div', `display:flex;align-items:center;gap:12px;margin-bottom:6px;flex-wrap:wrap;`);
    const titleTxt = el('h3', `margin:0;font-size:1.05rem;font-weight:700;color:${C.ink};flex:1;`);
    titleTxt.textContent = 'תרגום מסגרת 802.11 ⇄ 802.3 — ה-AP כגשר שפות';
    titleBar.appendChild(titleTxt);
    root.appendChild(titleBar);

    const subtitle = el('p', `margin:0 0 14px;font-size:0.82rem;color:${C.inkSoft};`);
    subtitle.textContent = 'לחצו על שדה כדי לראות הסבר • שדות מודגשים נמחקים או מוספים בתרגום';
    root.appendChild(subtitle);

    /* ── controls ── */
    const controls = el('div');
    controls.className = 'viz-controls';
    controls.style.cssText = `display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;align-items:center;`;

    const btnReset = makeBtn('איפוס הדגשה', C.blue);
    const btnAMSDU = makeBtn('A-MSDU: פיצול 5 מסגרות', C.mustard);
    const btnDir   = makeBtn('802.11 → 802.3', C.sage);
    btnDir._mode = '11to3';

    controls.appendChild(btnDir);
    controls.appendChild(btnAMSDU);
    controls.appendChild(btnReset);
    root.appendChild(controls);

    /* ── legend ── */
    const legend = el('div', `display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px;font-size:0.75rem;color:${C.inkSoft};`);
    legend.innerHTML = `
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:16px;height:10px;background:${C.clay};border-radius:3px;opacity:.55;display:inline-block;"></span> נמחק בתרגום</span>
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:16px;height:10px;background:${C.mustard};border-radius:3px;display:inline-block;"></span> נוסף בתרגום</span>
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:16px;height:10px;background:${C.sage};border-radius:3px;display:inline-block;"></span> ממופה / נשמר</span>
    `;
    root.appendChild(legend);

    /* ── main layout: wifi | ap-box | eth ── */
    const layout = el('div', `display:flex;gap:0;align-items:stretch;`);
    root.appendChild(layout);

    /* WiFi column */
    const wifiCol = el('div', `flex:1;min-width:0;`);
    const wifiTitle = el('div', `font-size:0.78rem;font-weight:700;color:${C.blue};text-align:center;margin-bottom:8px;letter-spacing:.04em;`);
    wifiTitle.textContent = '802.11 Wi-Fi Frame';
    wifiCol.appendChild(wifiTitle);
    const wifiStack = el('div', `display:flex;flex-direction:column;gap:3px;`);
    wifiCol.appendChild(wifiStack);
    layout.appendChild(wifiCol);

    /* AP bridge column */
    const apCol = el('div', `width:90px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 6px;`);
    const apBox = el('div', `background:${C.surface2};border:1.5px solid ${C.line};border-radius:10px;padding:10px 6px;text-align:center;font-size:0.72rem;color:${C.ink};font-weight:700;`);
    apBox.innerHTML = `<div style="font-size:1.3rem;margin-bottom:4px;">📡</div>AP<br><span style="font-weight:400;color:${C.inkSoft};">גשר</span><br><span style="font-weight:400;color:${C.inkSoft};font-size:0.65rem;">Bridge</span>`;
    apCol.appendChild(apBox);

    /* animated arrow */
    const arrowArea = el('div', `margin-top:8px;text-align:center;font-size:1.1rem;color:${C.blue};`);
    arrowArea.setAttribute('aria-hidden', 'true');
    arrowArea.innerHTML = '&#8594;';
    apCol.appendChild(arrowArea);
    layout.appendChild(apCol);

    /* Eth column */
    const ethCol = el('div', `flex:1;min-width:0;`);
    const ethTitle = el('div', `font-size:0.78rem;font-weight:700;color:${C.sage};text-align:center;margin-bottom:8px;letter-spacing:.04em;`);
    ethTitle.textContent = '802.3 Ethernet Frame';
    ethCol.appendChild(ethTitle);
    const ethStack = el('div', `display:flex;flex-direction:column;gap:3px;`);
    ethCol.appendChild(ethStack);
    layout.appendChild(ethCol);

    /* ── tooltip panel ── */
    const tooltip = el('div', `background:${C.surface};border:1px solid ${C.line};border-radius:10px;padding:12px 14px;margin-top:14px;min-height:64px;transition:opacity .2s;font-size:0.82rem;line-height:1.55;`);
    tooltip.setAttribute('role', 'status');
    tooltip.setAttribute('aria-live', 'polite');
    tooltip.innerHTML = `<span style="color:${C.inkSoft};">בחרו שדה לפרטים נוספים…</span>`;
    root.appendChild(tooltip);

    /* ── header size comparison bar ── */
    const sizeBar = el('div', `margin-top:12px;display:flex;gap:12px;flex-wrap:wrap;font-size:0.78rem;`);
    const wifiSize = el('div', `display:flex;align-items:center;gap:6px;`);
    wifiSize.innerHTML = `<span style="background:${C.blue};width:48px;height:8px;border-radius:4px;display:inline-block;"></span>WiFi כותרת ≈24–30B`;
    const ethSize = el('div', `display:flex;align-items:center;gap:6px;`);
    ethSize.innerHTML = `<span style="background:${C.sage};width:20px;height:8px;border-radius:4px;display:inline-block;"></span>Ethernet כותרת = 14B`;
    sizeBar.appendChild(wifiSize);
    sizeBar.appendChild(ethSize);
    root.appendChild(sizeBar);

    /* ── AMSDU overlay ── */
    const aMSDUPanel = el('div', `display:none;margin-top:14px;background:${C.surface2};border:1px solid ${C.line};border-radius:10px;padding:12px;font-size:0.8rem;`);
    aMSDUPanel.innerHTML = `
      <strong style="color:${C.mustard};">A-MSDU Aggregation — פיצול מסגרות</strong>
      <p style="margin:6px 0 10px;color:${C.inkSoft};">myLaptop שלח מסגרת WiFi אחת גדולה המכילה 5 IP packets (A-MSDU). ה-AP מפרק אותה ל-5 מסגרות אתרנט נפרדות.</p>
      <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
        <div style="background:${C.blue};color:#fff;border-radius:6px;padding:4px 10px;font-weight:700;font-size:0.75rem;">WiFi A-MSDU</div>
        <div style="font-size:1.1rem;color:${C.clay};">→</div>
        ${[1,2,3,4,5].map(i=>`<div style="background:${C.sage};color:#fff;border-radius:6px;padding:4px 8px;font-size:0.73rem;">ETH ${i}</div>`).join('<span style="color:#aaa;">|</span>')}
      </div>
      <p style="margin:8px 0 0;font-size:0.75rem;color:${C.inkSoft};">כל מסגרת אתרנט יוצאת <em>בנפרד</em> לכיוון ה-Switch. מכאן ואילך — Full-Duplex, אין CSMA/CA, אין Backoff.</p>
    `;
    root.appendChild(aMSDUPanel);

    /* ── build field cards ── */
    let activeFieldId = null;

    function buildFieldCard(field, isWifi) {
      const isDim = isWifi && REMOVED_IDS.has(field.id);
      const isNew = !isWifi && field.srcId === null;
      const isMapped = !isWifi && field.srcId !== null;

      const card = el('div');
      card.dataset.fieldId = field.id;
      card.style.cssText = `
        background:${field.color};
        border-radius:6px;
        padding:5px 8px;
        cursor:pointer;
        border:2px solid transparent;
        transition:opacity .18s,border-color .18s,transform .12s;
        opacity:${isDim ? '0.45' : '1'};
        position:relative;
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:4px;
        user-select:none;
      `;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `שדה: ${field.label} — ${field.bytes}. לחץ לפרטים.`);

      const labelEl = el('span', `font-size:0.71rem;font-weight:600;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;`);
      labelEl.textContent = field.label;
      card.appendChild(labelEl);

      const bytesEl = el('span', `font-size:0.65rem;color:rgba(255,255,255,.85);white-space:nowrap;flex-shrink:0;`);
      bytesEl.textContent = field.bytes;
      card.appendChild(bytesEl);

      /* badges */
      if (isDim) {
        const badge = el('span', `position:absolute;top:-5px;right:-5px;background:${C.clay};color:#fff;border-radius:999px;font-size:0.58rem;padding:1px 5px;font-weight:700;`);
        badge.textContent = '✕ נמחק';
        badge.setAttribute('aria-hidden', 'true');
        card.appendChild(badge);
      }
      if (isNew) {
        const badge = el('span', `position:absolute;top:-5px;right:-5px;background:${C.mustard};color:#fff;border-radius:999px;font-size:0.58rem;padding:1px 5px;font-weight:700;`);
        badge.textContent = '+ חדש';
        badge.setAttribute('aria-hidden', 'true');
        card.appendChild(badge);
      }
      if (isMapped) {
        const badge = el('span', `position:absolute;top:-5px;right:-5px;background:${C.sage};color:#fff;border-radius:999px;font-size:0.58rem;padding:1px 4px;font-weight:700;`);
        badge.textContent = '⇄';
        badge.setAttribute('aria-hidden', 'true');
        card.appendChild(badge);
      }

      /* mapping connector line logic (handled in activate) */
      card._fieldDef = field;
      card._isWifi = isWifi;

      function activate() {
        if (activeFieldId === field.id) {
          deactivateAll();
          return;
        }
        deactivateAll();
        activeFieldId = field.id;

        /* highlight this card */
        card.style.borderColor = C.ink;
        card.style.transform = 'scale(1.03)';

        /* if wifi field has a matching eth field, highlight it */
        if (isWifi) {
          ethStack.querySelectorAll('[data-field-id]').forEach(ec => {
            const fd = ec._fieldDef;
            if (fd && fd.srcId === field.id) {
              ec.style.borderColor = C.ink;
              ec.style.transform = 'scale(1.03)';
            }
          });
        } else if (field.srcId) {
          /* eth field — highlight corresponding wifi field */
          wifiStack.querySelectorAll('[data-field-id]').forEach(wc => {
            if (wc.dataset.fieldId === field.srcId) {
              wc.style.borderColor = C.ink;
              wc.style.transform = 'scale(1.03)';
            }
          });
        }

        /* update tooltip */
        const motionOk = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (motionOk) {
          tooltip.style.opacity = '0';
          setTimeout(() => {
            fillTooltip(field, isWifi);
            tooltip.style.opacity = '1';
          }, 80);
        } else {
          fillTooltip(field, isWifi);
        }
      }

      card.addEventListener('click', activate);
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });

      return card;
    }

    function fillTooltip(field, isWifi) {
      const isDim = isWifi && REMOVED_IDS.has(field.id);
      const isNew = !isWifi && field.srcId === null;
      let badge = '';
      if (isDim) badge = `<span style="background:${C.clay};color:#fff;border-radius:5px;padding:1px 7px;font-size:0.72rem;margin-right:6px;">נמחק בתרגום</span>`;
      else if (isNew) badge = `<span style="background:${C.mustard};color:#fff;border-radius:5px;padding:1px 7px;font-size:0.72rem;margin-right:6px;">נוסף על-ידי ה-AP</span>`;
      else badge = `<span style="background:${C.sage};color:#fff;border-radius:5px;padding:1px 7px;font-size:0.72rem;margin-right:6px;">ממופה / נשמר</span>`;

      tooltip.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
          <strong style="color:${field.color};font-size:0.88rem;">${field.label}</strong>
          <span style="color:${C.inkSoft};font-size:0.78rem;">(${field.bytes})</span>
          ${badge}
        </div>
        <div style="color:${C.inkSoft};font-size:0.8rem;">${field.heLabel}</div>
        <div style="margin-top:5px;color:${C.ink};font-size:0.82rem;line-height:1.6;">${field.desc}</div>
      `;
    }

    function deactivateAll() {
      activeFieldId = null;
      wifiStack.querySelectorAll('[data-field-id]').forEach(c => {
        c.style.borderColor = 'transparent';
        c.style.transform = 'scale(1)';
      });
      ethStack.querySelectorAll('[data-field-id]').forEach(c => {
        c.style.borderColor = 'transparent';
        c.style.transform = 'scale(1)';
      });
    }

    /* build wifi cards */
    WIFI_FIELDS.forEach(f => {
      const card = buildFieldCard(f, true);
      wifiStack.appendChild(card);
    });

    /* build eth cards */
    ETH_FIELDS.forEach(f => {
      const card = buildFieldCard(f, false);
      ethStack.appendChild(card);
    });

    /* ── button logic ── */

    /* reset */
    btnReset.addEventListener('click', () => {
      deactivateAll();
      tooltip.innerHTML = `<span style="color:${C.inkSoft};">בחרו שדה לפרטים נוספים…</span>`;
    });

    /* A-MSDU toggle */
    let aMSDUOpen = false;
    btnAMSDU.addEventListener('click', () => {
      aMSDUOpen = !aMSDUOpen;
      aMSDUPanel.style.display = aMSDUOpen ? 'block' : 'none';
      btnAMSDU.textContent = aMSDUOpen ? 'סגור A-MSDU' : 'A-MSDU: פיצול 5 מסגרות';
    });

    /* direction swap — swap which side is "source" */
    btnDir.addEventListener('click', () => {
      if (btnDir._mode === '11to3') {
        btnDir._mode = '3to11';
        btnDir.textContent = '802.3 → 802.11';
        /* reverse arrow */
        arrowArea.innerHTML = '&#8592;';
        /* swap column labels */
        wifiTitle.textContent = '802.11 ← מקבל';
        ethTitle.textContent = '802.3 ← שולח';
        /* dim eth removed fields (same concept: show what gets added when going back) */
        ethStack.querySelectorAll('[data-field-id]').forEach(c => {
          const fd = c._fieldDef;
          if (fd && fd.srcId === null) {
            c.style.opacity = '0.45';
          }
        });
        wifiStack.querySelectorAll('[data-field-id]').forEach(c => {
          const fd = c._fieldDef;
          if (fd && REMOVED_IDS.has(fd.id)) {
            c.style.opacity = '1';
          } else if (fd) {
            c.style.opacity = '1';
          }
        });
        tooltip.innerHTML = `<span style="color:${C.inkSoft};">מצב 802.3→802.11: ה-AP מוסיף שדות ניהול מדיה ובקרת רצף חזרה לפורמט WiFi.</span>`;
      } else {
        btnDir._mode = '11to3';
        btnDir.textContent = '802.11 → 802.3';
        arrowArea.innerHTML = '&#8594;';
        wifiTitle.textContent = '802.11 Wi-Fi Frame';
        ethTitle.textContent = '802.3 Ethernet Frame';
        /* restore opacity */
        wifiStack.querySelectorAll('[data-field-id]').forEach(c => {
          const fd = c._fieldDef;
          c.style.opacity = fd && REMOVED_IDS.has(fd.id) ? '0.45' : '1';
        });
        ethStack.querySelectorAll('[data-field-id]').forEach(c => {
          c.style.opacity = '1';
        });
        tooltip.innerHTML = `<span style="color:${C.inkSoft};">בחרו שדה לפרטים נוספים…</span>`;
      }
      deactivateAll();
    });

    /* ── reduce-motion: disable transitions if needed ── */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      [wifiStack, ethStack].forEach(s => {
        s.querySelectorAll('[data-field-id]').forEach(c => {
          c.style.transition = 'none';
        });
      });
      tooltip.style.transition = 'none';
    }
  }

  /* ─── helpers ────────────────────────────────────────────────── */
  function el(tag, css) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    return e;
  }

  function makeBtn(text, color) {
    const b = document.createElement('button');
    b.className = 'viz-btn';
    b.textContent = text;
    b.style.cssText = `
      background:${color};color:#fff;border:none;border-radius:8px;
      padding:6px 14px;font-size:0.78rem;font-weight:600;cursor:pointer;
      font-family:inherit;transition:opacity .15s,transform .1s;
    `;
    b.addEventListener('mouseenter', () => { b.style.opacity = '0.85'; });
    b.addEventListener('mouseleave', () => { b.style.opacity = '1'; });
    b.addEventListener('mousedown', () => { b.style.transform = 'scale(0.97)'; });
    b.addEventListener('mouseup', () => { b.style.transform = 'scale(1)'; });
    return b;
  }

  /* ─── init ───────────────────────────────────────────────────── */
  function init() {
    document.querySelectorAll('[data-viz="frame-translator"]').forEach(mount => {
      try { render(mount); }
      catch (err) { console.error('[frame-translator]', err); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
