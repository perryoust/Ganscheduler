window.APP_VERSION = '106.10';
console.log('Ganscheduler Core: v' + window.APP_VERSION + ' Initializing...');

// ── Platform Detection ──
window.isMobileMode = () => window.innerWidth <= 768;
let _lastMode = window.isMobileMode();
window.addEventListener('resize', () => {
  const currentMode = window.isMobileMode();
  if (currentMode !== _lastMode) {
    _lastMode = currentMode;
    console.log('Platform mode changed to:', currentMode ? 'Mobile' : 'Desktop');
    if (window.refresh) window.refresh();
  }
});

// ── core.js — globals, data layer, utilities, init ──────────────
// Load order: firebase.js → invoices.js → suppliers.js → cal.js
//              → activity.js → sched.js → gardens.js → export.js
//              → backup.js → admin.js → core.js (last)

// --- Global State Declarations ---
window.SCH = window.SCH || [];
window.GARDENS = window.GARDENS || [];
window.INVOICES = window.INVOICES || [];
window.supEx = window.supEx || {};
window.pairs = window.pairs || [];
window.clusters = window.clusters || {};
window.holidays = window.holidays || [];
window.activeGardens = window.activeGardens || null;
window.blockedDates = window.blockedDates || {};
window.gardenBlocks = window.gardenBlocks || {};
window.managers = window.managers || {};
window.pairBreaks = window.pairBreaks || {};
window.VAT_RATE = window.VAT_RATE || 18;

// Local aliases - we must ensure these are updated when window variables are re-assigned
// or better yet, use window variables directly in functions.

// --- Utilities ---
window.debounce = function(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};

// --- Global UI Helpers ---
window.ui = {
  /**
   * Renders a standardized activity row for tables.
   */
  /**
   * Renders the 5 quick action buttons (V, X, !, Postpone, Calendar).
   */
  renderQuickActionBtns: function(s) {
    const sid = s.id;
    const isDone = s.st === 'done';
    const isCan = s.st === 'can';
    const isNohap = s.st === 'nohap';
    const isPost = s.st === 'post';
    const isException = isNohap || isPost || isCan;
    const isHandled = !!(s._compByMakeup && s._compByMakeup !== 'false');

    return `
      <div class="qacts flex-c justify-center gap-3 ${window.isMobileMode()?'mob-ver':''}" onclick="event.stopPropagation()">
        ${isDone ? '' : `<button title="בוצע" class="qbtn q-done" onclick="window.qSetSt('${sid}','done')">✔️ ${window.isMobileMode()?'בוצע':''}</button>`}
        ${(isException && !isHandled) ? `<button title="סיום טיפול" class="qbtn q-handled" onclick="if(window.markCompQuick)window.markCompQuick('${sid}')">✅ ${window.isMobileMode()?'טופל':''}</button>` : ''}
        ${(isException && isHandled) ? `<button title="ביטול טיפול (החזרה לרשימת לטיפול)" class="qbtn q-handled" style="background:#fff3e0;color:#e65100;border:1px solid #ffb74d" onclick="if(window.unmarkCompQuick)window.unmarkCompQuick('${sid}')">↩️ ${window.isMobileMode()?'לא טופל':''}</button>` : ''}
        ${isCan ? '' : `<button title="ביטול" class="qbtn q-can" onclick="window.openCanQ('${sid}')">❌ ${window.isMobileMode()?'ביטול':''}</button>`}
        ${isNohap ? '' : `<button title="לא התקיים" class="qbtn q-nohap" onclick="window.qSetSt('${sid}','nohap')">⚠️ ${window.isMobileMode()?'לא התקיים':''}</button>`}
        <button title="הזזה (דחייה / הקדמה)" class="qbtn q-post" onclick="window.openPostpone('${sid}')">⏩ ${window.isMobileMode()?'הזזה':''}</button>
        <button title="קביעת השלמה" class="qbtn q-mu" onclick="window.openMakeupSched('${sid}')">📅 ${window.isMobileMode()?'השלמה':''}</button>
      </div>`;
  },

  /**
   * Renders a standardized activity row for tables (8 columns).
   */
  renderActivityRow: function(s, opts = {}) {
    const g = window.G(s.g) || {};
    const supBase = window.supNameLabel ? window.supNameLabel(s.a) : window.supBase(s.a);
    const supAct = s.act || window.supAct(s.a) || '—';
    const timeStr = window.fT ? window.fT(s.t) : s.t;
    const stLbl = window.stLabel ? window.stLabel(s) : s.st;
    const stCls = window.stClass ? window.stClass(s) : '';
    const phone = (typeof window.getSupPhone === 'function') ? window.getSupPhone(s.a) : '';
    const isM = !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה/i.test(s.nt)));
    const context = opts.context || 'dash'; // dash, cal, sched
    const gClass = window.gcls(g);
    const gIcon = gClass === 'ביה"ס' ? '🏛️' : '🏫';
    const evType = s.tp || (gClass === 'גנים' ? 'חוג' : '');
    const grpCount = s.grp || (gClass === 'גנים' ? 1 : '');

    let tagText = '';
    if (s.st === 'can' || (s.nt && /ביטול|בוטל/i.test(s.nt))) tagText = 'ביטול';
    else if (s.st === 'nohap') tagText = ''; // Ensure 'nohap' activities do not get the 'השלמה' tag
    else if (s.nt && /הקדמה|הוקדם/i.test(s.nt)) tagText = 'הקדמה';
    else if (s.nt && /דחי?יה|נדחה/i.test(s.nt)) tagText = 'דחיה';
    else if (isM || (s.nt && /השלמה/i.test(s.nt))) tagText = 'השלמה';
    
    const tagMobile = tagText ? `<span style="background:#ffe082;color:#b71c1c;border-radius:4px;padding:1px 4px;font-size:0.65rem;font-weight:800;margin-left:4px;display:inline-block">${tagText}</span> ` : '';
    const tagDesktop = tagText ? `<b style="color:var(--c-warning)">[${tagText}]</b> ` : '';

    const mgr = window.managers ? Object.values(window.managers).find(m => (m.gardenIds || []).includes(g.id)) : null;
    const coName = mgr ? mgr.name : g.co;
    const coDisplay = coName ? `
            <div style="grid-column: span 2; font-size:0.7rem; color:#64748b; font-weight:normal;">
              👤 רכז/ת: ${coName}
            </div>` : '';

    if (window.isMobileMode()) {
      return `
        <div class="mob-act-card ${stCls}" onclick="window.openSP('${s.id}')">
          <div class="mob-act-hdr">
            <span class="mob-act-time">${timeStr}</span>
            <span class="mob-act-garden" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; display:block;">${g.name}${g.st ? ` <span style="font-size:0.75rem; color:#64748b; font-weight:400; margin-right:6px; display:inline-block">📍 ${g.st}</span>` : ''}</span>
            <span class="mob-act-status">${stLbl}</span>
          </div>
          <div class="mob-act-body">
            <div style="grid-column: span 2">
              👤 <b>${supBase}</b> ${phone ? `<span style="color:var(--c-success);font-weight:600;font-size:0.75rem;margin-right:6px">📞 ${phone}</span>` : ''}
            </div>
            <div style="grid-column: span 2">
              🎨 <b>${supAct}</b> ${evType ? `<span style="color:#78909c;font-size:0.75rem">(${evType})</span>` : ''} ${grpCount ? `<span style="background:#e8eaf6;color:#3f51b5;border-radius:4px;padding:1px 5px;font-size:0.68rem;margin-right:6px;font-weight:700;display:inline-block">${grpCount} קב'</span>` : ''}
            </div>
            ${coDisplay}
            ${(s.nt || tagText) ? `
              <div style="grid-column: span 2; color:var(--c-error)">
                📝 ${tagMobile}${s.nt || ''}
              </div>` : ''}
          </div>
          <div class="mob-act-btns">
            ${window.ui.renderQuickActionBtns(s)}
          </div>
        </div>`;
    }

    let rowHtml = `
      <tr class="${stCls} border-b cursor-pointer" onclick="window.openSP('${s.id}')">`;

    // 1. Checkbox Column (Dashboard only)
    if (opts.showCheckbox) {
      rowHtml += `
        <td class="dash-check-col" onclick="event.stopPropagation()">
          <input type="checkbox" class="dash-row-chk" value="${s.id}" onclick="window.dashUpdateBulkBar()">
        </td>`;
    }

    // 2. Garden Name (צהרון)
    rowHtml += `
      <td class="p-8 font-bold text-primary" style="line-height:1.2">
         ${gIcon} ${g.name}${g.st ? ` <span style="font-size:0.75rem; color:#64748b; font-weight:400; margin-right:6px; display:inline-block">📍 ${g.st}</span>` : ''}
         ${coName ? `<div style="font-size:0.72rem; color:#64748b; font-weight:normal; margin-top:3px;">👤 רכז/ת: ${coName}</div>` : ''}
      </td>`;

    // 3. Time (שעה)
    rowHtml += `
      <td class="p-8 text-center font-bold text-secondary">
        ${timeStr}
      </td>`;

    // 4. Supplier (ספק)
    rowHtml += `
      <td class="p-8 font-600 text-secondary">
        ${supBase} ${phone ? `<span class="text-xs text-success mr-2">📞 ${phone}</span>` : ''}
      </td>`;

    // 5. Type (סוג)
    rowHtml += `
      <td class="p-8" style="color:#78909c; font-weight:500">
        ${evType}
      </td>`;

    // 5.5 Activity (פעילות)
    rowHtml += `
      <td class="p-8" style="color:var(--c-info); font-weight:500">
        ${supAct}
      </td>`;

    // 6. Groups (קבוצות)
    rowHtml += `
      <td class="p-8 text-center" style="font-weight:700; color:#5c6bc0">
        ${grpCount}
      </td>`;

    // 7. Status (סטטוס)
    rowHtml += `
      <td class="p-8 text-center">
        ${stLbl}
      </td>`;

    // 8. Notes (הערות)
    rowHtml += `
      <td class="p-8 text-xs text-error">
        ${tagDesktop}${s.nt || ''}
      </td>`;

    // 9. Actions (פעולות)
    rowHtml += `
      <td class="p-8 text-center" onclick="event.stopPropagation()">
        ${window.ui.renderQuickActionBtns(s)}
      </td>`;

    rowHtml += `</tr>`;
    return rowHtml;
  },

  /**
   * Renders a standardized pair card with header and table.
   */
  renderStandardPairCard: function(pair, evs, opts = {}) {
    const ds = opts.ds || '';
    const clr = opts.clr || { solid: '#1a237e', light: '#f8fafc', border: '#e2e8f0' };
    const context = opts.context || 'dash';
    const isSolo = !!opts.isSolo;
    const gids = pair.ids || [];

    // Header Buttons
    const toggleId = 'pair-toggle-' + Math.random().toString(36).substr(2, 9);
    const collapseBtn = `<button class="btn bo bsm" onclick="event.stopPropagation(); const t = document.getElementById('${toggleId}'); const icon = this.querySelector('span'); if(t.style.display==='none'){t.style.display='block';icon.textContent='-';}else{t.style.display='none';icon.textContent='+';}" style="font-size:1.1rem !important; height:24px !important; min-height:24px !important; width:24px !important; padding:0 !important; border:1px solid ${clr.solid} !important; background:#fff !important; color:${clr.solid} !important; font-weight:700 !important; border-radius:4px !important; display:inline-flex !important; align-items:center !important; justify-content:center !important;" title="פתח/סגור תצוגה"><span style="font-family:monospace;font-weight:bold;line-height:1;margin-top:-2px">-</span></button>`;
    
    const weekBtn = `<button class="btn bo bsm" style="font-size:0.65rem !important; height:24px !important; min-height:24px !important; line-height:22px !important; padding:0 6px !important; border:1px solid #1e88e5 !important; background:#fff !important; color:#1e88e5 !important; font-weight:700 !important; border-radius:4px !important; white-space:nowrap !important; display:inline-flex !important; align-items:center !important; gap:2px !important;" onclick="event.stopPropagation(); window.calJump('${isSolo ? '' : pair.id}','week','${isSolo ? gids[0] : ''}')">📅 שבוע</button>`;
    const monthBtn = `<button class="btn bo bsm" style="font-size:0.65rem !important; height:24px !important; min-height:24px !important; line-height:22px !important; padding:0 6px !important; border:1px solid #1e88e5 !important; background:#fff !important; color:#1e88e5 !important; font-weight:700 !important; border-radius:4px !important; white-space:nowrap !important; display:inline-flex !important; align-items:center !important; gap:2px !important;" onclick="event.stopPropagation(); window.calJump('${isSolo ? '' : pair.id}','month','${isSolo ? gids[0] : ''}')">📅 חודש</button>`;
    const exportGids = (evs && evs.length > 0) ? Array.from(new Set(evs.map(e => Number(e.g)))) : gids;
    const expBtn = `<button class="btn bg bsm" style="background:#25d366 !important; color:#fff !important; border:none !important; height:24px !important; min-height:24px !important; line-height:24px !important; padding:0 7px !important; font-size:0.65rem !important; font-weight:700 !important; border-radius:4px !important; white-space:nowrap !important; display:inline-flex !important; align-items:center !important; gap:2px !important;" onclick="event.stopPropagation(); window._exportPairWA(${JSON.stringify(exportGids)})">📱 הודעה</button>`;
    const jumpBtn = (context === 'dash' && evs.length > 0) ? `<button class="btn bo bsm" style="font-size:0.65rem !important; height:24px !important; min-height:24px !important; line-height:22px !important; padding:0 6px !important; border:1px solid #ff9800 !important; background:#fff !important; color:#ff9800 !important; font-weight:700 !important; border-radius:4px !important; white-space:nowrap !important; display:inline-flex !important; align-items:center !important; gap:2px !important;" onclick="event.stopPropagation(); window.jumpToCalendar('${isSolo ? '' : pair.id}','${isSolo ? gids[0] : ''}', '${ds}', '${evs[0].id}')">👁️ הצג בלוח השנה</button>` : '';
    const editBtn = opts.isCluster ? `<button class="btn bp bsm" onclick="event.stopPropagation();window.openClusterBulkEdit('${pair.id}','${ds}')" style="background:#1e88e5 !important; color:#fff !important; border:none !important; height:24px !important; min-height:24px !important; line-height:24px !important; padding:0 7px !important; font-size:0.65rem !important; font-weight:700 !important; border-radius:4px !important; white-space:nowrap !important; display:inline-flex !important; align-items:center !important; gap:2px !important; margin-left:4px;">✏️ עריכה</button>` : '';

    let tableRows = '';
    
    // Sort events primarily by time and secondarily by garden name
    const sortedEvs = [...evs].sort((a,b) => {
      const tA = a.t || '99:99', tB = b.t || '99:99';
      if (tA !== tB) return tA.localeCompare(tB);
      const gA = window.G(a.g), gB = window.G(b.g);
      return (gA.name||'').localeCompare(gB.name||'', 'he');
    });

    if (sortedEvs.length === 0) {
      // Handle empty pair (mostly for calendar view)
      gids.forEach(gid => {
        const g = window.G(gid);
        if(!g) return;
        const gblk = ds ? window.getGardenBlock(gid, ds) : null;
        tableRows += `
          <tr style="border-bottom:1px solid #f1f5f9; background:${gblk ? '#fff5f5' : '#fff'}; opacity:0.8; cursor:pointer" onclick="${ds ? `window.openGcellPopup(${gid},'${ds}',event)` : ''}">
            <td style="padding:10px; font-weight:700; color:var(--c-primary)">🏫 ${g.name}</td>
            <td colspan="7" style="padding:10px; font-size:0.7rem; color:${gblk ? '#c62828' : '#94a3b8'}">
              ${gblk ? `${gblk.icon || '🚫'} ${gblk.reason}` : 'אין פעילות רשומה ביום זה'}
            </td>
          </tr>`;
      });
    } else {
      const cancellations = sortedEvs.filter(s => s.st === 'can' || s.st === 'nohap' || s.st === 'post');
      const activeEvs = sortedEvs.filter(s => s.st !== 'can' && s.st !== 'nohap' && s.st !== 'post');
      const hasBoth = cancellations.length > 0 && activeEvs.length > 0;

      if (hasBoth) {
        const isMob = window.isMobileMode();
        
        if (isMob) {
          tableRows += `<div style="background:#fff5f5; border:1px solid #ffd8d8; border-radius:6px; padding:6px 10px; font-weight:800; color:#c62828; font-size:0.72rem; margin-bottom:6px; text-align:right">⚠️ פעילויות שלא התקיימו / בוטלו:</div>`;
        } else {
          tableRows += `<tr style="background:#fff5f5; border-bottom:1px solid #ffd8d8"><td colspan="${context === 'dash' ? 9 : 8}" style="padding:8px 10px; font-weight:800; color:#c62828; font-size:0.75rem; text-align:right">⚠️ פעילויות שלא התקיימו / בוטלו:</td></tr>`;
        }
        
        cancellations.forEach(s => {
          tableRows += window.ui.renderActivityRow(s, { showCheckbox: context === 'dash', context: context });
        });
        
        if (isMob) {
          tableRows += `<div style="background:#f0faf4; border:1px solid #c3f2d7; border-radius:6px; padding:6px 10px; font-weight:800; color:#2e7d32; font-size:0.72rem; margin-bottom:6px; margin-top:8px; text-align:right">🏫 פעילויות השלמה / מתקיימות:</div>`;
        } else {
          tableRows += `<tr style="background:#f0faf4; border-bottom:1px solid #c3f2d7"><td colspan="${context === 'dash' ? 9 : 8}" style="padding:8px 10px; font-weight:800; color:#2e7d32; font-size:0.75rem; text-align:right">🏫 פעילויות השלמה / מתקיימות:</td></tr>`;
        }
        
        activeEvs.forEach(s => {
          tableRows += window.ui.renderActivityRow(s, { showCheckbox: context === 'dash', context: context });
        });
      } else {
        sortedEvs.forEach(s => {
          tableRows += window.ui.renderActivityRow(s, { 
            showCheckbox: context === 'dash',
            context: context
          });
        });
      }
    }

    if (window.isMobileMode()) {
      return `
      <details class="mob-accordion" style="border-top: 4px solid ${clr.solid}">
        <summary class="mob-summary" style="padding: 8px 10px">
           <span class="icon" style="font-size:1.1rem; margin-left:4px">${isSolo ? '🏡' : '🔗'}</span>
           <span class="title" style="font-size:0.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; padding-left:8px">${pair.name}</span>
           <div style="display:flex; align-items:center; gap:4px; flex-shrink:0">
              <button class="btn bo bsm" style="font-size: 0.62rem !important; height: 22px !important; min-height: 22px !important; line-height: 20px !important; padding: 0 4px !important; border: 1px solid #1e88e5 !important; background: #fff !important; color: #1e88e5 !important; font-weight: 700 !important; border-radius: 4px !important; white-space: nowrap !important; margin: 0 !important; display: inline-flex !important; align-items: center !important; gap: 2px !important;" onclick="event.stopPropagation(); window.calJump('${isSolo ? '' : pair.id}','week','${isSolo ? gids[0] : ''}')">📅 שבוע</button>
              <button class="btn bo bsm" style="font-size: 0.62rem !important; height: 22px !important; min-height: 22px !important; line-height: 20px !important; padding: 0 4px !important; border: 1px solid #1e88e5 !important; background: #fff !important; color: #1e88e5 !important; font-weight: 700 !important; border-radius: 4px !important; white-space: nowrap !important; margin: 0 !important; display: inline-flex !important; align-items: center !important; gap: 2px !important;" onclick="event.stopPropagation(); window.calJump('${isSolo ? '' : pair.id}','month','${isSolo ? gids[0] : ''}')">📅 חודש</button>
              <button class="btn bg bsm" style="background: #25d366 !important; color: #fff !important; border: none !important; height: 22px !important; min-height: 22px !important; line-height: 22px !important; padding: 0 5px !important; font-size: 0.62rem !important; font-weight: 700 !important; border-radius: 4px !important; white-space: nowrap !important; margin: 0 !important; display: inline-flex !important; align-items: center !important; gap: 2px !important;" onclick="event.stopPropagation(); window._exportPairWA(${JSON.stringify(exportGids)})">📱 הודעה</button>
           </div>
        </summary>
        <div class="mob-content p-4">
           ${tableRows}
        </div>
      </details>`;
    }

    return `
    <div class="card standard-pair-card" style="border-top:3px solid ${clr.solid}; padding:0; border-radius:6px; overflow:hidden; background:#fff; box-shadow:0 2px 4px rgba(0,0,0,0.03); border:1px solid #e2e8f0; border-top-width:3px; margin-bottom:6px !important">
      <div class="flex-c gap-8" style="background:${clr.light}; border-bottom:1px solid #e2e8f0; padding:4px 8px !important; min-height:30px !important; align-items:center !important">
          <div style="display:flex; align-items:center; gap:8px;">
            ${!isSolo ? collapseBtn : ''}
            <div style="width:24px; height:24px; border-radius:50%; background:${clr.solid}; color:#fff; display:flex; justify-content:center; align-items:center; font-size:0.8rem;">
              <i class="fas ${opts.isCluster ? 'fa-layer-group' : 'fa-link'}"></i>
            </div>
            <h3 style="margin:0; font-size:0.85rem; font-weight:700; color:${clr.solid};">${pair.name || ''}</h3>
          </div>
        <div class="flex-c gap-6 mr-auto" style="align-items:center !important">
          ${editBtn} ${weekBtn} ${monthBtn} ${expBtn}
        </div>
      </div>
      <div id="${toggleId}" class="tw overflow-auto">
        <table class="w-full" style="border-collapse:collapse; font-size:var(--fs-small)">
          <thead>
          <tr style="background:#f8fafc; border-bottom:1px solid #e2e8f0; color:#64748b; font-weight:700; font-size:var(--fs-small)">
              ${context === 'dash' ? '<th style="width:35px; text-align:center; padding:10px"></th>' : ''}
              <th style="text-align:right; padding:8px 10px">צהרון</th>
              <th style="text-align:center; padding:8px 10px">שעה</th>
              <th style="text-align:right; padding:8px 10px">ספק</th>
              <th style="text-align:right; padding:8px 10px">סוג</th>
              <th style="text-align:right; padding:8px 10px">פעילות</th>
              <th style="text-align:center; padding:8px 10px">קבוצות</th>
              <th style="text-align:center; padding:8px 10px">סטטוס</th>
              <th style="text-align:right; padding:8px 10px">הערות</th>
              <th style="width:140px; text-align:center; padding:8px 10px">פעולות</th>
            </tr>
          </thead>
          <tbody style="font-size:var(--fs-small)">
            ${tableRows}
          </tbody>
        </table>
      </div>
    </div>`;
  }
};

window.OM = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
};
window.CM = function(id) {
  if (id === 'spm') window._currentCustomGroup = null;
  const el = document.getElementById(id);
  if (el) {
    if (el._fromDup) { el.style.zIndex = ''; el._fromDup = false; }
    el.classList.remove('open');
  }
};
/**
 * Injects a standard info-notice box into a container.
 * @param {string} containerId - The ID of the container element.
 * @param {string} msg - The message (HTML) to display.
 * @param {string} type - 'info' (default) or 'warning'.
 * @param {string} icon - Emoji icon (default ℹ️).
 */
window.showInfoNotice = function(containerId, msg, type = 'info', icon = 'ℹ️') {
  // Check for dual containers
  const desktopEl = document.getElementById(containerId + '-desktop');
  const mobileEl = document.getElementById(containerId + '-mobile');
  const fallbackEl = document.getElementById(containerId);
  
  const html = `
    <div class="info-notice ${type==='warning'?'warning':''}">
      <span class="icon">${icon}</span>
      <div>${msg}</div>
    </div>
  `;
  
  if (desktopEl) { desktopEl.innerHTML = html; desktopEl.style.display = 'block'; }
  if (mobileEl) { mobileEl.innerHTML = html; mobileEl.style.display = 'block'; }
  if (fallbackEl) { fallbackEl.innerHTML = html; fallbackEl.style.display = 'block'; }
};
var OM = window.OM;
var CM = window.CM;


window.spAlert = function(msg) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "sp-sys-dialog-overlay";
    overlay.innerHTML = `
      <div class="sp-sys-dialog">
        <div class="sp-sys-dialog-msg">${msg}</div>
        <div class="sp-sys-dialog-btns">
          <button class="sp-sys-btn sp-sys-btn-ok" >אישור</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("show"), 10);
    
    overlay.querySelector(".sp-sys-btn-ok").onclick = () => {
      overlay.classList.remove("show");
      setTimeout(() => { overlay.remove(); resolve(); }, 200);
    };
  });
};

window._spDialogUid = 0;
window.spConfirm = function(msg) {
  return new Promise(resolve => {
    const uid = ++window._spDialogUid;
    const overlay = document.createElement("div");
    overlay.className = "sp-sys-dialog-overlay";
    overlay.innerHTML = `
      <div class="sp-sys-dialog">
        <div class="sp-sys-dialog-msg">${msg}</div>
        <div class="sp-sys-dialog-btns">
          <button class="sp-sys-btn sp-sys-btn-cancel" id="sp-conf-no-${uid}">ביטול</button>
          <button class="sp-sys-btn sp-sys-btn-ok" id="sp-conf-yes-${uid}">אישור</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("show"), 10);
    
    document.getElementById(`sp-conf-yes-${uid}`).onclick = () => {
      overlay.classList.remove("show");
      setTimeout(() => { overlay.remove(); resolve(true); }, 200);
    };
    document.getElementById(`sp-conf-no-${uid}`).onclick = () => {
      overlay.classList.remove("show");
      setTimeout(() => { overlay.remove(); resolve(false); }, 200);
    };
  });
};
window.spPrompt = function(msg, defaultText = '') {
  return new Promise(resolve => {
    const uid = ++window._spDialogUid;
    const overlay = document.createElement("div");
    const safeDefault = String(defaultText || '').replace(/"/g, '&quot;');
    overlay.className = "sp-sys-dialog-overlay";
    overlay.innerHTML = `
      <div class="sp-sys-dialog">
        <div class="sp-sys-dialog-msg">${msg}</div>
        <input type="text" id="sp-prompt-input-${uid}" value="${safeDefault}" style="width:100%; padding:8px; margin:10px 0; border:1px solid #ccc; border-radius:4px; font-size:1rem; box-sizing:border-box;">
        <div class="sp-sys-dialog-btns">
          <button class="sp-sys-btn sp-sys-btn-cancel" id="sp-prompt-cancel-${uid}">ביטול</button>
          <button class="sp-sys-btn sp-sys-btn-ok" id="sp-prompt-ok-${uid}">אישור</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("show"), 10);
    
    const input = document.getElementById(`sp-prompt-input-${uid}`);
    input.focus();
    
    const finish = (val) => {
      overlay.classList.remove("show");
      setTimeout(() => { overlay.remove(); resolve(val); }, 200);
    };
    
    document.getElementById(`sp-prompt-ok-${uid}`).onclick = () => finish(input.value);
    document.getElementById(`sp-prompt-cancel-${uid}`).onclick = () => finish(null);
    input.onkeydown = (e) => {
      if (e.key === 'Enter') finish(input.value);
      if (e.key === 'Escape') finish(null);
    };
  });
};

/**
 * Custom dialog with arbitrary HTML content, a title, and OK/Cancel buttons.
 * @param {string} title - Dialog title
 * @param {string} htmlContent - Custom HTML to render inside the dialog body
 * @param {string} okText - Text for the OK button (e.g. 'שמור')
 * @param {function} onOk - Callback when OK is clicked. Return true to close, false to keep open.
 * @param {boolean} wide - If true, make dialog wider
 */
window.spPromptDialog = function(title, htmlContent, okText, onOk, wide) {
  const overlay = document.createElement("div");
  overlay.className = "sp-sys-dialog-overlay";
  overlay.innerHTML = `
    <div class="sp-sys-dialog" style="${wide ? 'max-width:500px;' : ''}">
      <div class="sp-sys-dialog-msg" style="font-weight:700; font-size:1.1rem; margin-bottom:12px;">${title}</div>
      <div id="sp-prompt-dialog-body">${htmlContent}</div>
      <div class="sp-sys-dialog-btns" style="margin-top:15px;">
        <button class="sp-sys-btn sp-sys-btn-cancel" id="sp-pdlg-cancel">ביטול</button>
        <button class="sp-sys-btn sp-sys-btn-ok" id="sp-pdlg-ok">${okText || 'אישור'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add("show"), 10);
  
  const close = () => {
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 200);
  };
  
  document.getElementById("sp-pdlg-ok").onclick = () => {
    if (onOk) {
      const result = onOk();
      if (result !== false) close();
    } else {
      close();
    }
  };
  document.getElementById("sp-pdlg-cancel").onclick = close;
};
