window.APP_VERSION = '104.00';
console.log('Ganscheduler Core: v' + window.APP_VERSION + ' Initializing...');

// ΓפאΓפא Platform Detection ΓפאΓפא
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

// ΓפאΓפא core.js Γאפ globals, data layer, utilities, init ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא
// Load order: firebase.js Γזע invoices.js Γזע suppliers.js Γזע cal.js
//              Γזע activity.js Γזע sched.js Γזע gardens.js Γזע export.js
//              Γזע backup.js Γזע admin.js Γזע core.js (last)

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
        ${isDone ? '' : `<button title="╫ס╫ץ╫ª╫ó" class="qbtn q-done" onclick="window.qSetSt('${sid}','done')">Γ£פ∩╕ן ${window.isMobileMode()?'╫ס╫ץ╫ª╫ó':''}</button>`}
        ${(isException && !isHandled) ? `<button title="סיום טיפול" class="qbtn q-handled" onclick="if(window.markCompQuick)window.markCompQuick('${sid}')">✅ ${window.isMobileMode()?'טופל':''}</button>` : ''}
        ${(isException && isHandled) ? `<button title="ביטול טיפול (החזרה לרשימת לטיפול)" class="qbtn q-handled" style="background:#fff3e0;color:#e65100;border:1px solid #ffb74d" onclick="if(window.unmarkCompQuick)window.unmarkCompQuick('${sid}')">↩️ ${window.isMobileMode()?'לא טופל':''}</button>` : ''}
        ${isCan ? '' : `<button title="╫ס╫ש╫ר╫ץ╫£" class="qbtn q-can" onclick="window.openCanQ('${sid}')">Γ¥ל ${window.isMobileMode()?'╫ס╫ש╫ר╫ץ╫£':''}</button>`}
        ${isNohap ? '' : `<button title="╫£╫נ ╫פ╫¬╫º╫ש╫ש╫¥" class="qbtn q-nohap" onclick="window.qSetSt('${sid}','nohap')">Γתá∩╕ן ${window.isMobileMode()?'╫£╫נ ╫פ╫¬╫º╫ש╫ש╫¥':''}</button>`}
        <button title="╫פ╫צ╫צ╫פ (╫ף╫ק╫ש╫ש╫פ / ╫פ╫º╫ף╫₧╫פ)" class="qbtn q-post" onclick="window.openPostpone('${sid}')">Γן⌐ ${window.isMobileMode()?'╫פ╫צ╫צ╫פ':''}</button>
        <button title="╫º╫ס╫ש╫ó╫¬ ╫פ╫⌐╫£╫₧╫פ" class="qbtn q-mu" onclick="window.openMakeupSched('${sid}')">≡ƒףו ${window.isMobileMode()?'╫פ╫⌐╫£╫₧╫פ':''}</button>
      </div>`;
  },

  /**
   * Renders a standardized activity row for tables (8 columns).
   */
  renderActivityRow: function(s, opts = {}) {
    const g = window.G(s.g) || {};
    const supBase = window.supBase(s.a);
    const supAct = s.act || window.supAct(s.a) || 'Γאפ';
    const timeStr = window.fT ? window.fT(s.t) : s.t;
    const stLbl = window.stLabel ? window.stLabel(s) : s.st;
    const stCls = window.stClass ? window.stClass(s) : '';
    const phone = (typeof window.getSupPhone === 'function') ? window.getSupPhone(s.a) : '';
    const isM = !!(s._isMakeup || s._makeupFrom || (s.nt && /╫פ╫⌐╫£╫₧╫פ/i.test(s.nt)));
    const context = opts.context || 'dash'; // dash, cal, sched
    const gClass = window.gcls(g);
    const gIcon = gClass === '╫ס╫ש╫פ"╫í' ? '≡ƒן¢∩╕ן' : '≡ƒן½';
    const evType = s.tp || (gClass === '╫ע╫á╫ש╫¥' ? '╫ק╫ץ╫ע' : '');
    const grpCount = s.grp || (gClass === '╫ע╫á╫ש╫¥' ? 1 : '');

    let tagText = '';
    if (s.st === 'can' || (s.nt && /╫ס╫ש╫ר╫ץ╫£|╫ס╫ץ╫ר╫£/i.test(s.nt))) tagText = '╫ס╫ש╫ר╫ץ╫£';
    else if (s.nt && /╫פ╫º╫ף╫₧╫פ|╫פ╫ץ╫º╫ף╫¥/i.test(s.nt)) tagText = '╫פ╫º╫ף╫₧╫פ';
    else if (s.nt && /╫ף╫ק╫ש?╫ש╫פ|╫á╫ף╫ק╫פ/i.test(s.nt)) tagText = '╫ף╫ק╫ש╫פ';
    else if (isM || (s.nt && /╫פ╫⌐╫£╫₧╫פ/i.test(s.nt))) tagText = '╫פ╫⌐╫£╫₧╫פ';
    
    const tagMobile = tagText ? `<span style="background:#ffe082;color:#b71c1c;border-radius:4px;padding:1px 4px;font-size:0.65rem;font-weight:800;margin-left:4px;display:inline-block">${tagText}</span> ` : '';
    const tagDesktop = tagText ? `<b style="color:var(--c-warning)">[${tagText}]</b> ` : '';

    if (window.isMobileMode()) {
      return `
        <div class="mob-act-card ${stCls}" onclick="window.openSP('${s.id}')">
          <div class="mob-act-hdr">
            <span class="mob-act-time">${timeStr}</span>
            <span class="mob-act-garden">${g.name}${g.st ? ` <span style="font-size:0.72rem; color:#64748b; font-weight:400; margin-right:6px; display:inline-block">≡ƒףם ${g.st}</span>` : ''}</span>
            <span class="mob-act-status">${stLbl}</span>
          </div>
          <div class="mob-act-body">
            <div style="grid-column: span 2">
              ≡ƒסñ <b>${supBase}</b> ${phone ? `<span style="color:var(--c-success);font-weight:600;font-size:0.75rem;margin-right:6px">≡ƒף₧ ${phone}</span>` : ''}
            </div>
            <div style="grid-column: span 2">
              ≡ƒמ¿ <b>${supAct}</b> ${evType ? `<span style="color:#78909c;font-size:0.75rem">(${evType})</span>` : ''} ${grpCount ? `<span style="background:#e8eaf6;color:#3f51b5;border-radius:4px;padding:1px 5px;font-size:0.68rem;margin-right:6px;font-weight:700;display:inline-block">${grpCount} ╫º╫ס'</span>` : ''}
            </div>
            ${(s.nt || tagText) ? `
              <div style="grid-column: span 2; color:var(--c-error)">
                ≡ƒף¥ ${tagMobile}${s.nt || ''}
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

    // 2. Garden Name (╫ª╫פ╫¿╫ץ╫ƒ)
    rowHtml += `
      <td class="p-8 font-bold text-primary" style="line-height:1.2">
         ${gIcon} ${g.name}${g.st ? ` <span style="font-size:0.75rem; color:#64748b; font-weight:400; margin-right:6px; display:inline-block">≡ƒףם ${g.st}</span>` : ''}
      </td>`;

    // 3. Time (╫⌐╫ó╫פ)
    rowHtml += `
      <td class="p-8 text-center font-bold text-secondary">
        ${timeStr}
      </td>`;

    // 4. Supplier (╫í╫ñ╫º)
    rowHtml += `
      <td class="p-8 font-600 text-secondary">
        ${supBase} ${phone && context === 'dash' ? `<span class="text-xs text-success mr-2">≡ƒף₧ ${phone}</span>` : ''}
      </td>`;

    // 5. Activity Type (╫ñ╫ó╫ש╫£╫ץ╫¬)
    rowHtml += `
      <td class="p-8" style="color:var(--c-info); font-weight:500">
        <div style="font-size:0.75rem; color:#78909c; margin-bottom:2px">${evType}</div>
        ${supAct}
      </td>`;

    // 6. Groups (╫º╫ס╫ץ╫ª╫ץ╫¬)
    rowHtml += `
      <td class="p-8 text-center" style="font-weight:700; color:#5c6bc0">
        ${grpCount}
      </td>`;

    // 7. Status (╫í╫ר╫ר╫ץ╫í)
    rowHtml += `
      <td class="p-8 text-center">
        ${stLbl}
      </td>`;

    // 8. Notes (╫פ╫ó╫¿╫ץ╫¬)
    rowHtml += `
      <td class="p-8 text-xs text-error">
        ${tagDesktop}${s.nt || ''}
      </td>`;

    // 9. Actions (╫ñ╫ó╫ץ╫£╫ץ╫¬)
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
    const weekBtn = `<button class="btn bo bsm" style="font-size:0.65rem !important; height:24px !important; min-height:24px !important; line-height:22px !important; padding:0 6px !important; border:1px solid #1e88e5 !important; background:#fff !important; color:#1e88e5 !important; font-weight:700 !important; border-radius:4px !important; white-space:nowrap !important; display:inline-flex !important; align-items:center !important; gap:2px !important;" onclick="event.stopPropagation(); window.calJump('${isSolo ? '' : pair.id}','week','${isSolo ? gids[0] : ''}')">≡ƒףו ╫⌐╫ס╫ץ╫ó</button>`;
    const monthBtn = `<button class="btn bo bsm" style="font-size:0.65rem !important; height:24px !important; min-height:24px !important; line-height:22px !important; padding:0 6px !important; border:1px solid #1e88e5 !important; background:#fff !important; color:#1e88e5 !important; font-weight:700 !important; border-radius:4px !important; white-space:nowrap !important; display:inline-flex !important; align-items:center !important; gap:2px !important;" onclick="event.stopPropagation(); window.calJump('${isSolo ? '' : pair.id}','month','${isSolo ? gids[0] : ''}')">≡ƒףו ╫ק╫ץ╫ף╫⌐</button>`;
    const expBtn = `<button class="btn bg bsm" style="background:#25d366 !important; color:#fff !important; border:none !important; height:24px !important; min-height:24px !important; line-height:24px !important; padding:0 7px !important; font-size:0.65rem !important; font-weight:700 !important; border-radius:4px !important; white-space:nowrap !important; display:inline-flex !important; align-items:center !important; gap:2px !important;" onclick="event.stopPropagation(); window._exportPairWA(${JSON.stringify(gids)})">≡ƒף▒ ╫פ╫ץ╫ף╫ó╫פ</button>`;

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
            <td style="padding:10px; font-weight:700; color:var(--c-primary)">≡ƒן½ ${g.name}</td>
            <td colspan="7" style="padding:10px; font-size:0.7rem; color:${gblk ? '#c62828' : '#94a3b8'}">
              ${gblk ? `${gblk.icon || '≡ƒת½'} ${gblk.reason}` : '╫נ╫ש╫ƒ ╫ñ╫ó╫ש╫£╫ץ╫¬ ╫¿╫⌐╫ץ╫₧╫פ ╫ס╫ש╫ץ╫¥ ╫צ╫פ'}
            </td>
          </tr>`;
      });
    } else {
      sortedEvs.forEach(s => {
        tableRows += window.ui.renderActivityRow(s, { 
          showCheckbox: context === 'dash',
          context: context
        });
      });
    }

    if (window.isMobileMode()) {
      return `
      <details class="mob-accordion" style="border-top: 4px solid ${clr.solid}">
        <summary class="mob-summary" style="padding: 8px 10px">
           <span class="icon" style="font-size:1.1rem; margin-left:4px">${isSolo ? '≡ƒןí' : '≡ƒפק'}</span>
           <span class="title" style="font-size:0.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; padding-left:8px">${pair.name}</span>
           <div style="display:flex; align-items:center; gap:4px; flex-shrink:0">
              <button class="btn bo bsm" style="font-size: 0.62rem !important; height: 22px !important; min-height: 22px !important; line-height: 20px !important; padding: 0 4px !important; border: 1px solid #1e88e5 !important; background: #fff !important; color: #1e88e5 !important; font-weight: 700 !important; border-radius: 4px !important; white-space: nowrap !important; margin: 0 !important; display: inline-flex !important; align-items: center !important; gap: 2px !important;" onclick="event.stopPropagation(); window.calJump('${isSolo ? '' : pair.id}','week','${isSolo ? gids[0] : ''}')">≡ƒףו ╫⌐╫ס╫ץ╫ó</button>
              <button class="btn bo bsm" style="font-size: 0.62rem !important; height: 22px !important; min-height: 22px !important; line-height: 20px !important; padding: 0 4px !important; border: 1px solid #1e88e5 !important; background: #fff !important; color: #1e88e5 !important; font-weight: 700 !important; border-radius: 4px !important; white-space: nowrap !important; margin: 0 !important; display: inline-flex !important; align-items: center !important; gap: 2px !important;" onclick="event.stopPropagation(); window.calJump('${isSolo ? '' : pair.id}','month','${isSolo ? gids[0] : ''}')">≡ƒףו ╫ק╫ץ╫ף╫⌐</button>
              <button class="btn bg bsm" style="background: #25d366 !important; color: #fff !important; border: none !important; height: 22px !important; min-height: 22px !important; line-height: 22px !important; padding: 0 5px !important; font-size: 0.62rem !important; font-weight: 700 !important; border-radius: 4px !important; white-space: nowrap !important; margin: 0 !important; display: inline-flex !important; align-items: center !important; gap: 2px !important;" onclick="event.stopPropagation(); window._exportPairWA(${JSON.stringify(gids)})">≡ƒף▒ ╫פ╫ץ╫ף╫ó╫פ</button>
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
        <div class="flex-c gap-6" style="align-items:center !important">
          <span style="font-size:1.0rem; display:inline-flex; align-items:center">${isSolo ? '≡ƒןí' : '≡ƒפק'}</span>
          <div class="font-800 text-primary" style="font-size:0.75rem !important; line-height:1.2">${pair.name}</div>
        </div>
        <div class="flex-c gap-6 mr-auto" style="align-items:center !important">
          ${weekBtn} ${monthBtn} ${expBtn}
        </div>
      </div>
      <div class="tw overflow-auto">
        <table class="w-full" style="border-collapse:collapse; font-size:var(--fs-small)">
          <thead>
          <tr style="background:#f8fafc; border-bottom:1px solid #e2e8f0; color:#64748b; font-weight:700; font-size:var(--fs-small)">
              ${context === 'dash' ? '<th style="width:35px; text-align:center; padding:10px"></th>' : ''}
              <th style="text-align:right; padding:8px 10px">╫ª╫פ╫¿╫ץ╫ƒ</th>
              <th style="text-align:center; padding:8px 10px">╫⌐╫ó╫פ</th>
              <th style="text-align:right; padding:8px 10px">╫í╫ñ╫º</th>
              <th style="text-align:right; padding:8px 10px">╫ñ╫ó╫ש╫£╫ץ╫¬</th>
              <th style="text-align:center; padding:8px 10px">╫º╫ס╫ץ╫ª╫ץ╫¬</th>
              <th style="text-align:center; padding:8px 10px">╫í╫ר╫ר╫ץ╫í</th>
              <th style="text-align:right; padding:8px 10px">╫פ╫ó╫¿╫ץ╫¬</th>
              <th style="width:140px; text-align:center; padding:8px 10px">╫ñ╫ó╫ץ╫£╫ץ╫¬</th>
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
 * @param {string} icon - Emoji icon (default Γה╣∩╕ן).
 */
window.showInfoNotice = function(containerId, msg, type = 'info', icon = 'Γה╣∩╕ן') {
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

// renderInvoices and refreshPurchDash moved to invoices.js


// ΓפאΓפא Purch Suppliers panel ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא
let _pSupTab='all', _pSupView='cards';
function setPSupTab(t){
  _pSupTab=t;
  ['all','act','purch'].forEach(x=>{
    const b=document.getElementById('psup-tab-'+x);
    if(b) b.classList.toggle('active',x===t);
  });
  renderPurchSuppliers();
}
function setPSupView(v){
  _pSupView=v;
  document.getElementById('psu-view-cards')?.classList.toggle('active',v==='cards');
  document.getElementById('psu-view-list')?.classList.toggle('active',v==='list');
  renderPurchSuppliers();
}
// ΓפאΓפא Purch supplier panel helpers (use index to avoid HTML escaping) ΓפאΓפא
let _psupCurrentList = []; // set by renderPurchSuppliers
function psupOpen(idx){ const n=_psupCurrentList[idx]?.name||''; if(n) openSupCard(n); }
function psupEdit(idx){ 
  const n=_psupCurrentList[idx]?.name||''; 
  if(!n) return;
  openSupCard(n); 
  setTimeout(sucToggleEdit,250); 
}
function psupNewInvoice(idx){ openNewInvoice(null, _psupCurrentList[idx]?.name||''); }

// Emergency: clear corrupt mergedAway and rebuild supplier list
function emergencyFixSuppliers(){
  if(!confirm('╫צ╫פ ╫ש╫נ╫ñ╫í ╫נ╫¬ ╫¿╫⌐╫ש╫₧╫¬ ╫פ╫í╫ñ╫º╫ש╫¥ ╫פ╫₧╫₧╫ץ╫צ╫ע╫ש╫¥ ╫ץ╫ש╫ס╫á╫פ ╫₧╫ק╫ף╫⌐ ╫נ╫¬ ╫¢╫£ ╫פ╫í╫ñ╫º╫ש╫¥. ╫£╫פ╫₧╫⌐╫ש╫ת?')) return;
  supEx['__merged_away']=[];
  // Also clear __c to rebuild from scratch
  supEx['__c']=[];
  repairAllSuppliers();
  save();
  setTimeout(()=>{ renderPurchSuppliers(); renderSup(); showToast('Γ£ו ╫í╫ñ╫º╫ש╫¥ ╫נ╫ץ╫ñ╫í╫ץ ╫ץ╫á╫ס╫á╫ץ ╫₧╫ק╫ף╫⌐'); }, 200);
}

function renderPurchSuppliers(){
  const el = document.getElementById('psu-body');
  if(!el) return;
  if(typeof SUPBASE==='undefined'||!Array.isArray(SUPBASE)||SUPBASE.length===0){
    el.innerHTML='<div style="color:#aaa;padding:20px;text-align:center">╫ר╫ץ╫ó╫ƒ ╫á╫¬╫ץ╫á╫ש╫¥...</div>';
    setTimeout(renderPurchSuppliers, 500);
    return;
  }
  const srch = (document.getElementById('psu-srch')?.value||'').toLowerCase();
  const sortMode = document.getElementById('psu-sort')?.value||'name';
  const allSups = getAllSup();
  console.log('renderPurchSuppliers: getAllSup returned', allSups.length, ', SUPBASE:', SUPBASE.length);
  let list = allSups.filter(s=>{
    const base=s.name||'';
    if(srch && !base.toLowerCase().includes(srch)) return false;
    if(_pSupTab==='act') return isActSupplier(base);
    if(_pSupTab==='purch') return !isActSupplier(base);
    return true; // all
  });
  list = [...list].sort((a,b)=>(a.name||'').localeCompare(b.name||'','he'));
  if(sortMode==='cnt') list=[...list].sort((a,b)=>supBaseCnt(b.name)-supBaseCnt(a.name));
  _psupCurrentList = list; // save for index-based onclick helpers

  if(!list.length){
    // Show debug info to help diagnose the empty list
    el.innerHTML='<div style="color:#aaa;padding:30px;text-align:center">╫נ╫ש╫ƒ ╫í╫ñ╫º╫ש╫¥ ╫£╫פ╫ª╫ע╫פ.<br><button class="btn bg" style="margin-top:10px" onclick="emergencyFixSuppliers()">≡ƒפº ╫ס╫á╫פ ╫₧╫ק╫ף╫⌐</button></div>';
    return;
  }

  if(_pSupView==='list'){
    // List view
    let h='<table style="width:100%;border-collapse:collapse;font-size:.83rem">'
      +'<thead><tr style="background:#e8eaf6;position:sticky;top:0">'
      +'<th style="padding:7px 10px;text-align:right">╫í╫ñ╫º</th>'
      +'<th style="padding:7px 8px;text-align:center">╫ñ╫ó╫ש╫£╫ץ╫ש╫ץ╫¬</th>'
      +'<th style="padding:7px 8px;text-align:right">╫ר╫£╫ñ╫ץ╫ƒ</th>'
      +'<th style="padding:7px 8px;text-align:right">╫í╫ץ╫ע</th>'
      +'<th style="padding:7px 8px"></th>'
      +'</tr></thead><tbody>';
    list.forEach((s,idx)=>{
      const base=s.name;
      const ex=supBaseEx(base);
      const cnt=supBaseCnt(base);
      const phone=ex.ph1||s.phone||'';
      // Use data-idx to avoid HTML attribute escaping issues with special chars
      const bg=idx%2===0?'#fff':'#f8f9ff';
      h+=`<tr style="background:${bg};cursor:pointer;border-bottom:2px solid #e8eaf6" onclick="psupOpen(${idx})">`
        +`<td style="padding:6px 10px;font-weight:700;color:#1a237e">${base}`
        +`${isActSupplier(base)?' <span style="font-size:.65rem;color:#2e7d32">≡ƒמ¿</span>':''}`
        +`</td>`
        +`<td style="padding:6px 8px;text-align:center;color:#1565c0;font-weight:700">${isActSupplier(base)?cnt:'Γאפ'}</td>`
        +`<td style="padding:6px 8px;color:#2e7d32">${phone||'Γאפ'}</td>`
        +`<td style="padding:6px 8px;font-size:.76rem;color:#546e7a">${ex.entityType||''}</td>`
        +`<td style="padding:6px 8px;white-space:nowrap" onclick="event.stopPropagation()">`
        +`<button class="btn bp bsm" style="font-size:.65rem" onclick="psupNewInvoice(${idx})">≡ƒףה ╫פ╫צ╫₧╫á╫פ</button> `
        +`<button class="btn bo bsm" style="font-size:.65rem" onclick="psupEdit(${idx})">Γ£ן∩╕ן</button>`
        +`</td></tr>`;
    });
    h+='</tbody></table>';
    el.innerHTML=h;
    return;
  }

  // Cards view
  const _cardsHtml=list.map((s,idx)=>{
    const base=s.name;
    const ex=supBaseEx(base);
    const cnt=supBaseCnt(base);
    const acts=getSupActs(base);
    const phone=ex.ph1||s.phone||'';
    const cntDone=SCH.filter(sc=>supBase(sc.a)===base&&sc.st==='done').length;
    const isAct = isActSupplier(base);
    return `<div class="sucard" style="cursor:pointer;display:flex;flex-direction:column;justify-content:space-between" onclick="psupOpen(${idx})">
      <div>
        <div class="font-800 text-primary text-base mb-2 break-word" style="line-height:1.35">
          ≡ƒףת ${base}
          ${isAct?'<span class="text-xs text-success rounded-6" style="background:#e8f5e9;padding:1px 5px;margin-right:4px">≡ƒמ¿</span>':''}
        </div>
        ${phone?`<div class="text-success text-sm font-600 mb-2">≡ƒף₧ ${phone}</div>`:''}
        ${acts.length&&isAct?`<div class="mb-2 flex-c flex-wrap gap-3">
          ${acts.map(a=>`<span class="text-xs font-600 text-secondary rounded-10" style="background:#e3f2fd;padding:2px 8px">≡ƒמ» ${a}</span>`).join('')}
        </div>`:''}
        ${ex.entityType?`<div class="text-xs mb-1" style="color:#6a1b9a">≡ƒןó ${ex.entityType}</div>`:''}
        ${ex.notes?`<div class="text-xs text-light mb-1">≡ƒף¥ ${ex.notes}</div>`:''}
      </div>
      <div class="flex-c justify-between mt-2 pt-2" style="border-top:1px solid #f0f0f0">
        <span class="text-xs font-bold text-secondary">${isAct?`≡ƒףו ${cnt} ╫ñ╫ó╫ש╫£╫ץ╫ש╫ץ╫¬${cntDone?` ┬╖ Γ£פ∩╕ן ${cntDone}`:''}`:''}</span>
        <div class="flex-c gap-2 flex-none" onclick="event.stopPropagation()">
          <button class="btn bp bsm text-xs" onclick="psupNewInvoice(${idx})">≡ƒףה ╫פ╫צ╫₧╫á╫פ</button>
          <button class="btn bo bsm text-xs" onclick="psupEdit(${idx})">Γ£ן∩╕ן</button>
        </div>
      </div>
    </div>`;
  }).join('');
  el.innerHTML=`<div class="sugrid">${_cardsHtml}</div>`;
}

function openNewPurchSupplier(){
  // Set text to __new__ to show inline form within invoice modal
  const txt = document.getElementById('inv-sup-text');
  if(txt){ txt.value='__new__'; invSupTextChg(); }
}
function openSupCardFromPurch(name){
  switchMode('act');
  setTimeout(()=>{ST('sup');setTimeout(()=>{openSupCard(name);setTimeout(sucToggleEdit,150);},100);},120);
}





function _applyYearData(o){
  if(!o || !o.ch){
    window.SCH = SRAWS.map(s=>({...s,st:'ok',nt:s.n||'',grp:1}));
  } else if(o.useSraws === false) {
    // ΓץנΓץנΓץנ DIRECT MODE: Excel import was used Γאפ SRAWS is irrelevant ΓץנΓץנΓץנ
    // The ch array IS the complete schedule. No merging needed.
    console.log('[_applyYearData] Direct mode (useSraws=false): using ' + o.ch.length + ' records directly');
    window.useSraws = false;
    window.SCH = o.ch.map(x => ({
      id: x.id,
      g: x.g,
      d: x.d,
      a: x.a || '',
      t: x.t || '',
      p: x.p || '',
      n: x.n || '',
      st: x.st || 'ok',
      cr: x.cr || '',
      cn: x.cn || '',
      nt: x.nt || '',
      pd: x.pd || '',
      pt: x.pt || '',
      grp: x.grp || 1,
      act: x.act || '',
      tp: x.tp || '',
      _isMakeup: x._isMakeup || false,
      _makeupFrom: x._makeupFrom || '',
      _compByMakeup: x._compByMakeup || '',
      _fromD: x._fromD || '',
      _postFrom: x._postFrom || '',
      _isImported: x._isImported || false
    }));
  } else {
    // ΓץנΓץנΓץנ LEGACY MODE: Merge SRAWS with cloud changes ΓץנΓץנΓץנ
    // 1. Map SRAWS by fuzzy key and ID for merging
    const srawsFuzzy = {};
    const srawsFuzzyById = {};
    const nuclearClean = (val) => {
      if(!val) return '';
      return String(val).replace(/\(.*\)/g, '').replace(/[^╫נ-╫¬a-zA-Z0-9]/g, '').toLowerCase();
    };
    const nuclearTime = (t) => {
      if(!t) return '00:00';
      let m = String(t).match(/(\d{1,2}):(\d{1,2})/);
      if(!m) return '00:00';
      return m[1].padStart(2,'0') + ':' + m[2].padStart(2,'0');
    };
    
    SRAWS.forEach(s => {
      const k = `${s.d}|${Number(s.g)}|${nuclearClean(s.a)}|${nuclearTime(s.t)}`;
      srawsFuzzy[k] = s;
      srawsFuzzyById[s.id] = s;
    });

    // 2. Process changes from cloud/backup
    const m = {}; // SRAWS ID -> Final Object
    const manual = []; // Non-SRAWS manual/imported records
    const coveredDateGardens = new Set();
    
    o.ch.forEach(x => {
      if(!x.d || !x.g) return;
      
      coveredDateGardens.add(`${x.d}|${Number(x.g)}`);
      
      const isManualId = String(x.id).startsWith('e_');
      const k = `${x.d}|${Number(x.g)}|${nuclearClean(x.a)}|${nuclearTime(x.t)}`;
      
      if (srawsFuzzy[k]) {
        const s = srawsFuzzy[k];
        m[s.id] = {...s, ...(m[s.id]||{}), ...x, id: s.id};
      } else if (!isManualId && srawsFuzzyById[x.id]) {
        m[x.id] = {...srawsFuzzyById[x.id], ...(m[x.id]||{}), ...x};
      } else {
        manual.push(x);
      }
    });

    // 3. Assemble SCH: SRAWS (merged) + remaining Manual
    const delIds = (o.supEx && o.supEx['__deleted_sraws_ids']) || [];
    window.SCH = SRAWS.map(s => {
      if (delIds.includes(s.id)) return null;
      const x = m[s.id];
      if (x) return {...s, ...x};
      
      // If this Date+Garden is already covered by the incoming data, 
      // and this SRAWS record didn't match anything above, it's a "Zombie" Γאפ skip it.
      if (coveredDateGardens.has(`${s.d}|${Number(s.g)}`)) {
        return null;
      }
      return s;
    }).filter(Boolean);
    
    // Merge manual records (deduplicated by fuzzy key)
    const manualSeen = {};
    manual.forEach(x => {
      const k = `${x.d}|${Number(x.g)}|${nuclearClean(x.a)}|${nuclearTime(x.t)}`;
      if(!manualSeen[k]) {
        manualSeen[k] = x;
        window.SCH.push(x);
      } else {
        if(x.st !== 'ok') manualSeen[k].st = x.st;
        if(x.nt) manualSeen[k].nt = (manualSeen[k].nt ? manualSeen[k].nt + ' | ' + x.nt : x.nt);
      }
    });
  }

  if(window.DataManager) {
    if(window.DataManager.cleanupDuplicates) window.DataManager.cleanupDuplicates();
    if(window.DataManager.applyAutoMakeupMatching) window.DataManager.applyAutoMakeupMatching();
  }

  // REST OF THE FUNCTION (Pairs, Invoices, etc.)
  window.supEx = o.supEx || {};
  if(window.supEx['__gardens_extra']) window._GARDENS_EXTRA = window.supEx['__gardens_extra'];
  // For new years: load the full garden list from the year's data
  if(Array.isArray(window.supEx['__gardens_all']) && window.supEx['__gardens_all'].length > 0) {
    window._GARDENS_ALL = window.supEx['__gardens_all'];
  } else {
    window._GARDENS_ALL = null; // Fall back to GARDENS + _GARDENS_EXTRA
  }
  window.spScannerAliases = o.spScannerAliases || {};

  if(Array.isArray(o.pairs)&&o.pairs.length>0){
    window.pairs = o.pairs.map(p=>({...p,ids:p.ids.map(id=>parseInt(id)).filter(id=>G(id).id)}));
    window.pairs = pairs.filter(p=>p.ids.length>=2);
  } else { initPairs(); }
  const localVat = window._safeLS.getItem('ganv5_vat');
  if (localVat) try { window.VAT_RATE = JSON.parse(localVat); } catch(e){}
  else window.VAT_RATE = o.vatRate || 18;

  const localInvs = window._safeLS.getItem('ganv5_invoices');
  let loadedInvs = null;
  if (localInvs) try { loadedInvs = JSON.parse(localInvs); } catch(e){}
  if (!loadedInvs && o.invoices) loadedInvs = o.invoices;

  if (loadedInvs) {
    window.INVOICES = Array.isArray(loadedInvs) ? loadedInvs : Object.values(loadedInvs);
    
    // Deduplicate identical invoices created by accident
    const uniqueInvs = [];
    const invMap = new Map();
    window.INVOICES.forEach(inv => {
      // Create a unique key based on supplier name and whatever number is present
      const numKey = inv.num || inv.txNum || inv.orderNum || '';
      if (!numKey) {
        uniqueInvs.push(inv); // Keep invoices without any numbers
        return;
      }
      const key = `${window.supBase ? window.supBase(inv.supName) : inv.supName}_${numKey}`;
      
      if (!invMap.has(key)) {
        invMap.set(key, inv);
      } else {
        // We have a duplicate. Keep the one that has more file links or details!
        const existing = invMap.get(key);
        const existingScore = (existing.file_tax ? 1 : 0) + (existing.file_tx ? 1 : 0) + (existing.file_order ? 1 : 0);
        const newScore = (inv.file_tax ? 1 : 0) + (inv.file_tx ? 1 : 0) + (inv.file_order ? 1 : 0);
        
        if (newScore > existingScore) {
          invMap.set(key, inv); // replace with the better one
        } else if (newScore === existingScore) {
           // Merge file links if they have different ones
           if (!existing.file_tax && inv.file_tax) existing.file_tax = inv.file_tax;
           if (!existing.file_tx && inv.file_tx) existing.file_tx = inv.file_tx;
           if (!existing.file_order && inv.file_order) existing.file_order = inv.file_order;
        }
      }
    });
    window.INVOICES = Array.from(invMap.values()).concat(uniqueInvs);

    // Auto-cancel invoices if "╫ס╫ץ╫ר╫£" is in the notes, date, or orderDesc
    window.INVOICES.forEach(inv => {
      if (inv.status !== 'cancelled') {
        const notesStr = String(inv.notes || '').toLowerCase();
        const dateStr = String(inv.date || '').toLowerCase();
        const descStr = String(inv.orderDesc || '').toLowerCase();
        if (['╫ס╫ץ╫ר╫£', '╫₧╫ס╫ץ╫ר╫£'].some(w => notesStr.includes(w) || dateStr.includes(w) || descStr.includes(w))) {
          inv.status = 'cancelled';
        }
      }
    });

    // ΓפאΓפא Migrate invoices with double-VAT bug ΓפאΓפא
    // Symptom: ordVatMode missing AND orderTotal Γיט orderAmt * (1 + vat/100)
    // Fix: set ordVatMode='inc', recalculate orderAmt (base) and orderTotal (= entered).
    INVOICES.forEach(inv=>{
      if(inv.ordVatMode) return; // already has mode Γאפ skip
      const vat = inv.vat||18;
      if(vat===0) return; // exempt Γאפ skip
      // Check order section
      if(inv.orderAmt && inv.orderTotal){
        const expectedTotal = +(inv.orderAmt*(1+vat/100)).toFixed(2);
        if(Math.abs(inv.orderTotal - expectedTotal) < 0.05){
          // orderAmt was entered as inclusive amount, orderTotal is wrong
          const rawInc = inv.orderAmt; // what user entered (includes VAT)
          inv.orderAmt   = +(rawInc/(1+vat/100)).toFixed(2);
          inv.orderVat   = +(inv.orderAmt*vat/100).toFixed(2);
          inv.orderTotal = rawInc; // the correct total IS what user entered
          inv.ordVatMode = 'inc';
        } else {
          inv.ordVatMode = 'ex'; // amounts look correct, just stamp the mode
        }
      }
      // Same for tx section
      if(inv.txAmt && inv.txTotal && !inv.txVatMode){
        const expTx = +(inv.txAmt*(1+vat/100)).toFixed(2);
        if(Math.abs(inv.txTotal - expTx) < 0.05){
          const rawTx = inv.txAmt;
          inv.txAmt   = +(rawTx/(1+vat/100)).toFixed(2);
          inv.txVat   = +(inv.txAmt*vat/100).toFixed(2);
          inv.txTotal = rawTx;
          inv.txVatMode = 'inc';
        } else {
          inv.txVatMode = 'ex';
        }
      }
      // Same for tax/receipt section
      if(inv.amt && inv.total && !inv.invVatMode){
        const expAmt = +(inv.amt*(1+vat/100)).toFixed(2);
        if(Math.abs(inv.total - expAmt) < 0.05){
          const rawAmt = inv.amt;
          inv.amt      = +(rawAmt/(1+vat/100)).toFixed(2);
          inv.vatAmt   = +(inv.amt*vat/100).toFixed(2);
          inv.total    = rawAmt;
          inv.invVatMode = 'inc';
        } else {
          inv.invVatMode = 'ex';
        }
      }
    });
  }
  if(typeof o.vatRate==='number') VAT_RATE=o.vatRate;
  // Sync settings from Firebase to localStorage
  if(o.autoBackupCfg){ _safeLS.setItem('autoBackupCfg',JSON.stringify(o.autoBackupCfg)); if(window._fbAppData) window._fbAppData.autoBackupCfg=o.autoBackupCfg; }
  if(o.piStatusFilter){ try{ _safeLS.setItem(PI_ST_KEY,JSON.stringify(o.piStatusFilter)); }catch(e){} }
  window.clusters = o.clusters&&Object.keys(o.clusters).length?o.clusters:JSON.parse(JSON.stringify(INIT_CLUSTERS));
  window.holidays = o.holidays||[];
  // _GARDENS_EXTRA already populated above
  window.pairBreaks = o.pairBreaks||{};
  window.blockedDates = o.blockedDates||{};
  window.gardenBlocks = o.gardenBlocks||{};
  window.managers = o.managers||{};
  activeGardens = Array.isArray(o.activeGardens)?new Set(o.activeGardens):null;
  if(window.DataManager && window.DataManager.cleanupDuplicates) {
    window.DataManager.cleanupDuplicates();
  }
}

function load(){
  try{
    // If Firebase already applied data directly, skip re-loading
    if(window._fbAppData) {
      return; // data already in memory from Firebase
    }
    // Support migration from old Y1 system (ganv5_y_ keys)
    let st = null;
    const yearKey = 'ganv5_y_' + (window.CURRENT_YEAR || 'tashpav');
    st = _safeLS.getItem(yearKey);
    if(!st && (!window.CURRENT_YEAR || window.CURRENT_YEAR === 'tashpav')) {
      st = _safeLS.getItem('ganv5');
    }
    if(!st && window._fbAppData) { _applyYearData(window._fbAppData); return; }
    if(st){ _applyYearData(JSON.parse(st)); }
    else { initPairs();window.clusters = JSON.parse(JSON.stringify(INIT_CLUSTERS));activeGardens = null; }
  }catch(e){
    console.warn('load() error:', e);
    if(window._fbAppData){ try{ _applyYearData(window._fbAppData); }catch(e2){} }
    else { initPairs();window.clusters = JSON.parse(JSON.stringify(INIT_CLUSTERS));activeGardens = null; }
  }
}
// ΓפאΓפא migratePairsFromAuto Γאפ seeds AUTOPAIRS only on first-ever load ΓפאΓפא

function migrateGardenPhones(){
  // Force-import all phones from xlsx Γאפ overwrite existing unless user manually edited
  // Versioned: if GARDEN_PHONES_VER already applied, skip
  const VER='v2';
  if(supEx.__phonesVer===VER) return;
  let count=0;
  Object.entries(GARDEN_PHONES).forEach(([id,ph])=>{
    const gid=parseInt(id);
    const key='g_'+gid;
    if(!supEx[key]) supEx[key]={};
    const ex=supEx[key];
    if(ex._cophManual) return; // user manually edited Γאפ preserve
    if(ph.ph1){ ex.coph=ph.ph1; count++; }
    if(ph.ph2) ex.coph2=ph.ph2;
  });
  supEx.__phonesVer=VER;
  save();
  console.log('migrateGardenPhones: imported '+count+' phones ('+VER+')');
}

function migratePairsFromAuto(){
  // Only run if localStorage has NO saved pairs yet (brand new user)
  const st=_safeLS.getItem('ganv5');
  if(st){
    try{
      const o=JSON.parse(st);
      if(Array.isArray(o.pairs)&&o.pairs.length>0) return; // already has saved pairs, don't override
    }catch(e){}
  }
  // No saved pairs Γאפ seed from AUTOPAIRS
  initPairs();
  save();
  console.log('Seeded pairs from AUTOPAIRS: '+pairs.length);
}
function resetPairsFromAuto(){
  if(!confirm('╫פ╫נ╫¥ ╫£╫¿╫ó╫á╫ƒ ╫נ╫¬ ╫פ╫צ╫ץ╫ע╫ץ╫¬ ╫₧╫פ╫¿╫⌐╫ש╫₧╫פ ╫פ╫₧╫ץ╫ס╫á╫ש╫¬?\n╫צ╫פ ╫ש╫₧╫ק╫º ╫ó╫¿╫ש╫¢╫ץ╫¬ ╫ש╫ף╫á╫ש╫ץ╫¬ ╫⌐╫ס╫ש╫ª╫ó╫¬.')) return;
  initPairs();
  save();
  refresh();
  window.spAlert('Γ£ו ╫פ╫צ╫ץ╫ע╫ץ╫¬ ╫ó╫ץ╫ף╫¢╫á╫ץ! '+pairs.length+' ╫צ╫ץ╫ע╫ץ╫¬ ╫á╫ר╫ó╫á╫ץ.');
}
const HOLIDAYS_RESTORE = [{"canSched":false,"city":"","from":"2026-03-31","id":"h_1774174272522","name":"╫ק╫ץ╫ñ╫⌐╫¬ ╫ñ╫í╫ק","note":"","scope":"all","to":"2026-04-08","type":"vacation"},{"canSched":false,"city":"","from":"2026-04-22","id":"h_1775731003564","name":"╫ש╫ץ╫¥ ╫פ╫צ╫¢╫¿╫ץ╫ƒ ╫£╫ק╫£╫£╫ש ╫₧╫ó╫¿╫¢╫ץ╫¬ ╫ש╫⌐╫¿╫נ╫£","note":"","scope":"all","to":"2026-04-22","type":"vacation"},{"canSched":false,"city":"","from":"2026-04-23","id":"h_1775731019768","name":"╫ש╫ץ╫¥ ╫פ╫ó╫ª╫₧╫נ╫ץ╫¬","note":"","scope":"all","to":"2026-04-23","type":"vacation"},{"canSched":false,"city":"","from":"2026-05-21","id":"h_1775731118232","name":"╫⌐╫ס╫ץ╫ó╫ץ╫¬","note":"","scope":"all","to":"2026-05-21","type":"vacation"},{"canSched":false,"city":"╫ע╫ס╫ó╫¬╫ש╫ש╫¥","from":"2026-05-05","id":"h_1775731199678","name":"╫£\"╫ע ╫ס╫ó╫ץ╫₧╫¿","note":"","scope":"╫ס╫ש╫פ\"╫í","to":"2026-05-05","type":"vacation"},{"canSched":true,"city":"","from":"2026-05-05","id":"h_1775731246284","name":"╫º╫ש╫ש╫ר╫á╫¬ ╫£\"╫ע ╫ס╫ó╫ץ╫₧╫¿","note":"","scope":"all","to":"2026-05-05","type":"camp"},{"canSched":true,"city":"╫ע╫ס╫ó╫¬╫ש╫ש╫¥","from":"2026-05-05","id":"h_1775731264839","name":"╫º╫ש╫ש╫ר╫á╫¬ ╫£\"╫ע ╫ס╫ó╫ץ╫₧╫¿","note":"","scope":"╫ע╫á╫ש╫¥","to":"2026-05-05","type":"camp"}];

function restoreMissingHolidays() {
  if (window.holidays && window.holidays.length === 0) {
    window.holidays = HOLIDAYS_RESTORE;
    return true;
  }
  return false;
}
function migrateSupActSplit(){
  // Run on every load Γאפ SCHEDULES_JS source data has "supplier - activity" format
  let changed=0;
  SCH.forEach(s=>{
    const act=supAct(s.a);
    if(act){
      if(!s.act) s.act=act;
      s.a=supBase(s.a);
      changed++;
    }
  });
  if(changed>0){ 
    console.log('migrateSupAct: fixed '+changed); 
    if(window._fbSyncReady) {
      save(); 
    } else {
      console.warn('migrateSupAct: skip auto-save (Firebase not ready)');
    }
  }
}
async function save(immediate){
  if(false){ showToast('Γתá∩╕ן ╫₧╫ª╫ס ╫נ╫¿╫¢╫ש╫ץ╫ƒ Γאפ ╫£╫נ ╫á╫ש╫¬╫ƒ ╫£╫⌐╫₧╫ץ╫¿ ╫⌐╫ש╫á╫ץ╫ש╫ש╫¥'); return; }
  
  // CRITICAL: Block all saves (including localStorage) until the first Firebase load completes.
  // This prevents startup migrations from creating a "newer" local state that blocks the cloud load.
  if(!window._fbSyncReady && !immediate) {
    console.warn('save: blocked (Firebase not ready yet)');
    return false;
  }
  
  try{
    if (typeof window.cleanSupplierNamesBeforeSave === 'function') {
      window.cleanSupplierNamesBeforeSave();
    }
    if(window.DataManager && window.DataManager.applyAutoMakeupMatching) {
      window.DataManager.applyAutoMakeupMatching();
    }
    // Save ALL entries with ALL fields Γאפ works with or without SRAWS
    // Persist year-specific garden list into supEx before saving
    if (Array.isArray(window._GARDENS_ALL) && window._GARDENS_ALL.length > 0) {
      (window.supEx || {}).__gardens_all = window._GARDENS_ALL;
    }
    const data={
      ch:(window.SCH||[]).map(s=>({id:s.id,g:s.g,d:s.d,a:s.a,t:s.t,p:s.p,n:s.n,st:s.st,cr:s.cr,cn:s.cn,nt:s.nt,pd:s.pd,pt:s.pt,grp:s.grp,act:s.act||'',_isMakeup:s._isMakeup||false,_makeupFrom:s._makeupFrom||'',_compByMakeup:s._compByMakeup||'',_fromD:s._fromD||'',_postFrom:s._postFrom||''})),
      pairs:window.pairs||[],
      supEx:window.supEx||{},
      clusters:window.clusters||{},
      holidays:window.holidays||[],
      pairBreaks:window.pairBreaks||{},
      managers:window.managers||{},
      blockedDates:window.blockedDates||{},
      gardenBlocks:window.gardenBlocks||{},
      activeGardens:window.activeGardens?[...window.activeGardens]:null,
      useSraws: typeof window.useSraws!=='undefined'?window.useSraws:true
    };
    const _json=JSON.stringify(data);
    const yearKey = 'ganv5_y_' + (window.CURRENT_YEAR || 'tashpav');
    _safeLS.setItem(yearKey, _json);
    
    // Save invoices globally
    _safeLS.setItem('ganv5_invoices', JSON.stringify(window.INVOICES||[]));
    _safeLS.setItem('ganv5_vat', JSON.stringify(window.VAT_RATE||18));
    
    if (!window.CURRENT_YEAR || window.CURRENT_YEAR === 'tashpav') {
      _safeLS.setItem('ganv5', _json);
    }
    window['_mem_' + yearKey] = _json;
    
    let res = true;
    if (typeof ghAutoSave === 'function') {
      try {
        // CRITICAL: await the Firebase sync if immediate=true
        res = await ghAutoSave(immediate === true);
      } catch(e) { console.error('Firebase save failed', e); res = false; }
    }
    
    save._cnt=(save._cnt||0)+1;
    if(save._cnt%30===0){
      try{
        const snaps=JSON.parse(_safeLS.getItem('ganv5_snaps')||'[]');
        const d=_json;
        snaps.unshift({ts:Date.now(),label:'╫נ╫ץ╫ר╫ץ╫₧╫ר╫ש',size:d.length,data:d});
        if(snaps.length>5) snaps.length=5;
        _safeLS.setItem('ganv5_snaps',JSON.stringify(snaps));
      }catch(e2){}
    }
    return res;
  }catch(e){ console.error('Save fatal error', e); return false; }
}
function initPairs(){
  // Initialize pairs from AUTOPAIRS constant
  const gdns = window.GARDENS || [];
  if(!gdns.length) return;

  window.pairs = AUTOPAIRS.map((arr,i)=>{
    const ids = arr.map(id => Number(id));
    const gs = ids.map(id => window.G(id)).filter(x => x && x.id);
    return {
      id: i + 1, 
      ids: ids, 
      name: gs.length > 0 ? gs.map(g => g.name).join(' + ') : '╫צ╫ץ╫ע ╫£╫£╫נ ╫⌐╫¥'
    };
  }).filter(p => p.ids.length > 0);
}

// ΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנ
// Y1 Γאפ Year Management Functions
// ΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנ


function G(id){
  const gdns = window.GARDENS || [];
  const extra = window._GARDENS_EXTRA || [];
  return gdns.find(g=>Number(g.id)===Number(id)) || extra.find(g=>Number(g.id)===Number(id)) || {};
}
function gcls(g){
  if (!g || !g.cls) return '╫ע╫á╫ש╫¥';
  const c = g.cls.trim();
  // Support both standard quotes (") and Hebrew Gershayim (╫┤)
  const isSchool = c.includes('╫ס╫ש╫¬') || c.includes('╫ס╫ש"╫í') || c.includes('╫ס╫ש╫┤╫í') || 
                   c.includes('╫ס╫ש╫פ"╫í') || c.includes('╫ס╫ש╫פ╫┤╫í') || c.includes('╫ס╫ש╫פ╫í') || 
                   c.includes('╫í╫ñ╫¿');
  
  if (c.includes('╫ע╫ƒ')) return '╫ע╫á╫ש╫¥';
  if (isSchool) return '╫ס╫ש╫פ"╫í';
  return '╫ע╫á╫ש╫¥';
}
function gByCF(city,cls){return GARDENS.filter(g=>(!city||g.city===city)&&(!cls||gcls(g)===cls));}
function d2s(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');return`${y}-${m}-${dd}`}
function s2d(s){const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function fD(s){if(!s)return '';if(typeof s !== 'string')return s;if(s.includes('/') && !s.includes('-'))return s;const parts=s.split('-');if(parts.length===3){const[y,m,d]=parts;return`${d}/${m}/${y}`}return s}
function fT(t){return t?t.slice(0,5):''}
function addD(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function addM(d,n){const x=new Date(d);x.setMonth(x.getMonth()+n);return x}
function monStart(d){const x=new Date(d);x.setDate(x.getDate()-x.getDay());x.setHours(0,0,0,0);return x}
function dayN(s){const[y,m,d]=s.split('-').map(Number);return['╫¿╫נ╫⌐╫ץ╫ƒ','╫⌐╫á╫ש','╫⌐╫£╫ש╫⌐╫ש','╫¿╫ס╫ש╫ó╫ש','╫ק╫₧╫ש╫⌐╫ש','╫⌐╫ש╫⌐╫ש','╫⌐╫ס╫¬'][new Date(y,m-1,d).getDay()]}
function getNextWorkDays(start, count){
  let d = new Date(start);
  let days = [];
  while(days.length < count){
    const dow = d.getDay();
    if(dow !== 5 && dow !== 6) days.push(new Date(d));
    d = addD(d, 1);
  }
  return days;
}
window.getNextWorkDays = getNextWorkDays;


// ΓפאΓפא Hebrew Date (via built-in Intl API) ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא
const _hebFmt = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
  day: 'numeric', month: 'long', timeZone: 'UTC'
});
function toHebDate(ds) {
  try {
    const [y, m, d] = ds.split('-').map(Number);
    return _hebFmt.format(new Date(Date.UTC(y, m-1, d)));
  } catch(e) { return ''; }
}

function hebM(d){return['╫ש╫á╫ץ╫נ╫¿','╫ñ╫ס╫¿╫ץ╫נ╫¿','╫₧╫¿╫Ñ','╫נ╫ñ╫¿╫ש╫£','╫₧╫נ╫ש','╫ש╫ץ╫á╫ש','╫ש╫ץ╫£╫ש','╫נ╫ץ╫ע╫ץ╫í╫ר','╫í╫ñ╫ר╫₧╫ס╫¿','╫נ╫ץ╫º╫ר╫ץ╫ס╫¿','╫á╫ץ╫ס╫₧╫ס╫¿','╫ף╫ª╫₧╫ס╫¿'][d.getMonth()]+' '+d.getFullYear()}
function td(){return d2s(new Date())}
function cities(){return[...new Set(GARDENS.map(g=>g.city))].sort()}
function gardenPair(gid){
  const n=parseInt(gid);
  if (window._listGroupMode === 'clusters' && typeof window.getClusters === 'function') {
    const cls = window.getClusters();
    const cl = cls.find(c => (c.gardenIds || []).map(x=>parseInt(x)).includes(n));
    if (cl) return { id: cl.id, name: cl.name, ids: cl.gardenIds.map(x=>parseInt(x)) };
  }
  return pairs.find(p=>p.ids.map(x=>parseInt(x)).includes(n))||null;
}
window.getGardenGroup = function(gid) {
  const n = parseInt(gid);
  const pair = (window.pairs || []).find(p => p.ids.map(x => parseInt(x)).includes(n));
  if (pair) return { type: 'pair', ...pair };
  const clusters = window.clusters || {};
  for (const cid in clusters) {
    const cl = clusters[cid];
    if ((cl.gardenIds || []).map(x => parseInt(x)).includes(n)) {
      return { type: 'cluster', id: cid, ids: cl.gardenIds.map(x => parseInt(x)), name: cl.name };
    }
  }
  return null;
};
window.compareActivities = function(a, b) {
  // Normalize time: extract HH:mm and pad
  const getT = (t) => {
    if (!t) return '99:99';
    const parts = t.split(':');
    if (parts.length < 2) return t.padStart(5, '0');
    return parts[0].padStart(2, '0') + ':' + parts[1].padStart(2, '0');
  };
  const tA = getT(a.t);
  const tB = getT(b.t);
  if (tA !== tB) return tA.localeCompare(tB);
  
  const gA = window.G(a.g)?.name || '';
  const gB = window.G(b.g)?.name || '';
  return gA.localeCompare(gB, 'he');
};

function stLabel(s){
  if(s.st==='can') return'<span class="bdg br2">Γ¥ל ╫ס╫ץ╫ר╫£</span>';
  if(s.st==='done') return'<span class="bdg bg2">Γ£פ∩╕ן ╫פ╫¬╫º╫ש╫ש╫¥</span>';
  if(s.st==='post') {
    let isAdv = false;
    if (s.pd && s.d) {
      const parseDate = (str) => {
        if (!str) return null;
        const parts = str.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          }
          return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        }
        return new Date(str);
      };
      const pdObj = parseDate(s.pd);
      const dObj = parseDate(s.d);
      if (pdObj && dObj) {
        isAdv = pdObj < dObj;
      }
    }
    return `<span class="bdg bor">${isAdv ? 'Γן¬ ╫פ╫ץ╫º╫ף╫¥' : 'Γן⌐ ╫á╫ף╫ק╫פ'} ${s.pd?'╫£-'+fD(s.pd):''}</span>`;
  }
  if(s.st==='nohap') return'<span class="bdg br2">Γתá∩╕ן ╫£╫נ ╫פ╫¬╫º╫ש╫ש╫¥</span>';
  return'<span class="bdg bg2">≡ƒן½ ╫₧╫¬╫º╫ש╫ש╫¥</span>';
}

// ΓפאΓפא renderReadOnlyBanner (stub Γאפ no archive mode in this version) ΓפאΓפא
function renderReadOnlyBanner() {
  const el = document.getElementById('readonly-banner');
  if (el) el.style.display = 'none';
}

function stClass(s){
  if(s.st==='can') return'st-can-row';
  if(s.st==='post') return'st-post-row';
  if(s.st==='nohap') return'st-nohap-row';
  if(s.st==='done') return'st-done-row';
  return'';
}


// ΓפאΓפא Dynamic scroll containers ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא
function _fitScrollAreas(){
  const BOTTOM_PAD = 16; // px from bottom of viewport
  document.querySelectorAll('.scroll-area').forEach(el=>{
    // Only adjust visible elements
    if(!el.offsetParent) return;
    const top = el.getBoundingClientRect().top;
    const available = window.innerHeight - top - BOTTOM_PAD;
    if(available > 100){
      el.style.maxHeight = available + 'px';
    }
  });
}

// Run on load, resize, and tab switch
window.addEventListener('resize', _fitScrollAreas);

// ΓפאΓפא Sync supplier __c list from all data sources ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא
// Runs after every Firebase load to ensure supplier list is complete
function syncSupplierList(){
  if(!supEx) window.supEx = {};
  if(!supEx['__c']) supEx['__c']=[];
  const existing = new Set(supEx['__c'].map(s=>supBase(s.name)));
  const inSupbase = new Set(SUPBASE.map(s=>supBase(s.name)));
  let added=0;

  // Add suppliers from SCH
  SCH.forEach(s=>{
    const base=supBase(s.a||'');
    if(!base||inSupbase.has(base)||existing.has(base)) return;
    supEx['__c'].push({id:Date.now()+Math.random(),name:base,phone:supEx[base]?.ph1||''});
    if(!supEx[base]) supEx[base]={isPurch:true,isAct:true};
    existing.add(base); added++;
  });

  // Add suppliers from INVOICES (purch-only by default)
  INVOICES.forEach(inv=>{
    const base=supBase(inv.supName||'');
    if(!base||inSupbase.has(base)||existing.has(base)) return;
    supEx['__c'].push({id:Date.now()+Math.random(),name:base,phone:supEx[base]?.ph1||''});
    if(!supEx[base]) supEx[base]={isPurch:true,isAct:false};
    existing.add(base); added++;
  });

  // Remove duplicate __c entries
  const seen=new Set();
  supEx['__c']=supEx['__c'].filter(s=>{
    const b=supBase(s.name);
    if(seen.has(b)) return false;
    seen.add(b); return true;
  });

  if(added>0){ console.log(`syncSupplierList: added ${added} suppliers`); }
  return added;
}

// ΓפאΓפא One-time migration v2: restore acts for merged suppliers ΓפאΓפאΓפאΓפא
function restoreSupplierActs(){
  if(supEx.__actsRestored_v2) return;
  let fixed=0;
  
  // Build act map from SCH and SUPBASE (by base name)
  const baseActMap = {};
  const addAct = (base,act) => { if(!baseActMap[base]) baseActMap[base]=new Set(); if(act) baseActMap[base].add(act); };
  SCH.forEach(s=>{ if(s.a){ addAct(supBase(s.a),supAct(s.a)); }});
  SUPBASE.forEach(s=>{ addAct(supBase(s.name),supAct(s.name)); });

  // Also get acts from mergedAway items' original bases
  // Map: each supEx entry that has no acts but HAS SCH entries (without act suffix)
  Object.keys(supEx).forEach(key=>{
    if(key.startsWith('__')) return;
    const ex = supEx[key];
    if(Array.isArray(ex.acts) && ex.acts.length>0) return; // already has acts
    // Check SCH for this key
    const hasSCH = SCH.some(s=>supBase(s.a)===key || s.a===key);
    if(!hasSCH) return;
    // Look for acts in mergedAway that share partial name or _mergedFrom
    const mergedFrom = ex._mergedFrom||[];
    const actsForKey = new Set(baseActMap[key]||[]);
    mergedFrom.forEach(oldBase=>{ (baseActMap[oldBase]||new Set()).forEach(a=>actsForKey.add(a)); });
    // Heuristic: SUPBASE entries where base is substring of key or key is substring of base
    SUPBASE.forEach(s=>{
      const sb=supBase(s.name); const sa=supAct(s.name);
      if(!sa) return;
      if(sb===key||key.includes(sb)||sb.includes(key)||(key.split(' ')[0]===sb.split(' ')[0]&&key.split(' ').length>=2)){
        actsForKey.add(sa);
      }
    });
    if(actsForKey.size>0){
      supEx[key].acts = [...actsForKey].sort((a,b)=>a.localeCompare(b,'he'));
      supEx[key].isAct = true;
      fixed++;
    }
  });

  supEx.__actsRestored_v2 = true;
  if(fixed>0){ save(true); showToast('Γ£ו ╫⌐╫ץ╫ק╫צ╫¿╫ץ ╫ñ╫ó╫ש╫£╫ץ╫ש╫ץ╫¬ ╫£-'+fixed+' ╫í╫ñ╫º╫ש╫¥'); }
  console.log('restoreSupplierActs v2: fixed',fixed,'suppliers');
}

window.onload = function(){
  window._appStartTime = Date.now(); // startup window for save protection
  // Auth is handled by onAuthStateChanged in index.html (Firebase module)
  // _onAuthReady is called once user is authenticated
  window._onAuthReady = async function(){
    try{
      // Step 1: Always get a fresh token before loading
      if(window._fbUser){
        try{ window._cachedToken = await window._fbUser.getIdToken(true); }
        catch(te){ console.warn('Token refresh failed:', te); }
      }
      // Step 2: Wait for static data (SRAWS) and Firebase data in parallel
      await _srawsReady;
      const fbOk = await loadFromFirebase(false, true); // force=true to always load
      if(!fbOk) console.warn('Firebase load returned false, using local data');

      // Load invoices explicitly Γאפ they live at a separate Firebase path
      // and need the token that is now guaranteed to be fresh
      try {
        if(window._cachedToken){
          const _iR = await fetch(
            'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data/invoices.json?auth='+window._cachedToken
          );
          if(_iR.ok){
            const _iD = await _iR.json();
            if(_iD && typeof _iD==='object'){
              window.INVOICES = Array.isArray(_iD) ? _iD : Object.values(_iD);
              console.log('Invoices loaded explicitly:', INVOICES.length);
            }
          }
        }
      } catch(ie){ console.warn('Explicit invoices load failed:', ie); }

    }catch(initErr){ console.warn('Init error:', initErr); }
    load();
    restoreMissingHolidays();
    syncSupplierList(); // supEx is now populated from load()
    migratePairsFromAuto();
    migrateSupActSplit();
    importContactsFromGardens();
    migrateGardenPhones();
    initDrops();
    initHolDrops();
    refreshClusterDrops();
    refreshMgrDrops();
    // dash-date now defaults to empty (All Dates)
    const dashDateEl=document.getElementById('dash-date'); 
    if(dashDateEl) dashDateEl.value='';
    ['dash-srch','s-srch','g-srch','su-srch'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const sfrom=document.getElementById('s-from');if(sfrom&&!sfrom.value) sfrom.value=td();
    const sto=document.getElementById('s-to');if(sto&&!sto.value) sto.value=td();
    const calClsEl=document.getElementById('cal-cls');
    if(calClsEl) calClsEl.value='╫ע╫á╫ש╫¥';
    const gClsEl=document.getElementById('g-cls');
    if(gClsEl) gClsEl.value='╫ע╫á╫ש╫¥';
    renderReadOnlyBanner();
    // Always run supplier repair on load to ensure cards exist
    repairAllSuppliers();
    syncSupplierList(); // re-sync after repair
    try{ renderDash(); }catch(e){}
    try{ renderCal(); }catch(e){}
    try{ renderClusters(); }catch(e){}
    try{ renderSup(); }catch(e){}
    try{ renderManagers(); }catch(e){}
    try{ updCounts(); }catch(e){}
    try{ odUpdateUI(); }catch(e){}
    try{ refreshPurchDash(); }catch(e){}
    try{ renderPurchSuppliers(); }catch(e){}
    try{ renderInvoices(); }catch(e){}
    const _inv = typeof INVOICES!=='undefined'?INVOICES.length:0;
    const _sch = typeof SCH!=='undefined'?SCH.length:0;
    // AUTO-CLEANUP if duplicated (20k records detected)
    if (_sch > 15000 && window.DataManager && window.DataManager.cleanupDuplicates) {
      console.warn('[Core] Data bloat detected! Cleaning duplicates...');
      window.DataManager.cleanupDuplicates();
      window.save(true); // Persist cleanup
    }
    console.log('App fully ready: SCH = ',window.SCH.length,'INVOICES = ',_inv);
    
    // Restore last active mode if permitted, otherwise cleanly default to 'act'
    const savedMode = (typeof _safeLS !== 'undefined' ? _safeLS.getItem('activeAppMode') : null) || 'act';
    if (savedMode === 'purch' && window.permPurch && typeof window.switchMode === 'function') {
      window.switchMode('purch');
    } else if (typeof window.switchMode === 'function') {
      window.switchMode('act');
    }

    _fbStartPolling();
    setTimeout(_fitScrollAreas, 100);
    try{ _ensureAdminProfile(); }catch(e){}
  }; 
  if(window._fbUser) window._onAuthReady();
};

function td(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
window.td = td;

function refreshAppUI(){
  try { if(typeof window.updCounts === 'function') window.updCounts(); } catch(e){ console.error("updCounts failed", e); }
  try { if(typeof window.renderDash === 'function') window.renderDash(); } catch(e){ console.error("renderDash failed", e); }
  try { if(typeof window.renderSched === 'function') window.renderSched(); } catch(e){ console.error("renderSched failed", e); }
  try { if(typeof window.renderCal === 'function') window.renderCal(); } catch(e){ console.error("renderCal failed", e); }
  try { if(typeof window.renderGardens === 'function') window.renderGardens(); } catch(e){ console.error("renderGardens failed", e); }
}
window.refreshAppUI = refreshAppUI;

function calculateStats() {
  const tab = (typeof window._dashTab !== 'undefined' ? window._dashTab : 'g');
  const cls = (tab === 'g' ? '╫ע╫á╫ש╫¥' : '╫ס╫ש╫פ"╫í');
  const sch = window.SCH || [];
  const gdns = window.GARDENS || [];

  // Read Dashboard Filters
  const date = (window.getEl('dash-date')||{}).value || '';
  const city = (window.getEl('dash-city')||{}).value || '';
  const sup = (window.getEl('dash-sup')||{}).value || '';
  const from = (window.getEl('dash-from')||{}).value || '';
  const to = (window.getEl('dash-to')||{}).value || '';
  const srch = ((window.getEl('dash-srch')||{}).value || '').toLowerCase();

  // Helper logic for classification
  const getGcls = (g) => {
    if (typeof window.gcls === 'function') return window.gcls(g);
    if (!g || !g.cls) return '╫ע╫á╫ש╫¥';
    const c = g.cls.trim();
    if (c.includes('╫ע╫ƒ')) return '╫ע╫á╫ש╫¥';
    if (c.includes('╫ס╫ש╫¬') || c.includes('╫ס╫ש"╫í') || c.includes('╫ס╫ש╫פ"╫í') || c.includes('╫ס╫ש╫פ╫í') || c.includes('╫í╫ñ╫¿')) return '╫ס╫ש╫פ"╫í';
    return '╫ע╫á╫ש╫¥';
  };

  const baseSch = sch.filter(s => {
    const g = window.G(s.g);
    if (!g) return false;
    
    if (city && g.city !== city) return false;
    if (sup && window.supBase(s.a) !== sup) return false;
    if (srch && ![(g.name||''), (g.city||''), s.a, s.act, s.nt].some(v=>(v||'').toLowerCase().includes(srch))) return false;
    
    if (from && s.d < from) return false;
    if (to && s.d > to) return false;
    
    return true;
  });

  // 2. Calculate Stats
  const today = td();
  const stats = baseSch.reduce((acc, s) => {
    const isHandled = !!(s._compByMakeup && s._compByMakeup !== "false") || !!((s.nt && /╫פ╫ץ╫º╫ף╫¥ ╫£|╫á╫ף╫ק╫פ ╫£|╫פ╫ץ╫צ╫צ ╫£|╫פ╫º╫ף╫₧╫פ ╫£|╫ף╫ק╫ש╫ש╫פ ╫£|╫ó╫ס╫¿ ╫£|╫ó╫ץ╫ס╫¿ ╫£|╫פ╫ץ╫ó╫ס╫¿ ╫£/i.test(s.nt)) || (s.n && /╫פ╫ץ╫º╫ף╫¥ ╫£|╫á╫ף╫ק╫פ ╫£|╫פ╫ץ╫צ╫צ ╫£|╫פ╫º╫ף╫₧╫פ ╫£|╫ף╫ק╫ש╫ש╫פ ╫£|╫ó╫ס╫¿ ╫£|╫ó╫ץ╫ס╫¿ ╫£|╫פ╫ץ╫ó╫ס╫¿ ╫£/i.test(s.n)));
    const isM = !!(s._isMakeup || s._makeupFrom || (s.nt && /╫פ╫⌐╫£╫₧╫פ|╫פ╫ץ╫º╫ף╫¥ ╫₧|╫á╫ף╫ק╫פ ╫₧|╫פ╫ץ╫צ╫צ ╫₧|╫ó╫ס╫¿ ╫₧|╫ó╫ץ╫ס╫¿ ╫₧|╫פ╫ץ╫ó╫ס╫¿ ╫₧/i.test(s.nt)) || (s.n && /╫פ╫⌐╫£╫₧╫פ|╫פ╫ץ╫º╫ף╫¥ ╫₧|╫á╫ף╫ק╫פ ╫₧|╫פ╫ץ╫צ╫צ ╫₧|╫ó╫ס╫¿ ╫₧|╫ó╫ץ╫ס╫¿ ╫₧|╫פ╫ץ╫ó╫ס╫¿ ╫₧/i.test(s.n)) || (s.a && /╫פ╫⌐╫£╫₧╫פ|╫פ╫ץ╫º╫ף╫¥ ╫₧|╫á╫ף╫ק╫פ ╫₧|╫פ╫ץ╫צ╫צ ╫₧|╫ó╫ס╫¿ ╫₧|╫ó╫ץ╫ס╫¿ ╫₧|╫פ╫ץ╫ó╫ס╫¿ ╫₧/i.test(s.a)));
    const isException = (s.st === 'nohap' || s.st === 'post') && !isHandled;
    const isMakeupBacklog = isM && s.st !== 'can' && s.st !== 'done' && s.d >= today;
    
    const onSelectedDate = (!from && !to && date) ? (s.d === date) : true;

    // Backlog counts (Ignore date filter)
    if (isException) {
      if (s.st === 'nohap') acc.nohap++;
      if (s.st === 'post') acc.post++;
      if (!isM) acc.todo++;
    }
    if (isMakeupBacklog) acc.makeups++;

    // Date-respecting counts (Respect date filter)
    if (onSelectedDate) {
      acc.all++;
      if (s.st === 'can') acc.can++;
      if (isHandled || s.st === 'done' || (isM && s.st !== 'can' && s.d < today)) {
        acc.handled++;
      }
    }

    return acc;
  }, { todo: 0, can: 0, post: 0, nohap: 0, makeups: 0, handled: 0, all: 0 });
  return stats;
}
window.getDashStats = calculateStats;

function updUIStats() {
  const stats = calculateStats();
  const setEl = (id, v) => { 
    const m = document.getElementById(id + '-mobile');
    const d = document.getElementById(id + '-desktop');
    const r = document.getElementById(id);
    if (m) m.textContent = v;
    if (d) d.textContent = v;
    if (r) r.textContent = v;
    
    // Also try legacy header IDs
    const hId = 'h-' + id.replace('d-', '').replace('dvp-cnt-', '').replace('-cnt', '');
    const hm = document.getElementById(hId + '-mobile');
    const hd = document.getElementById(hId + '-desktop');
    const hr = document.getElementById(hId);
    if (hm) hm.textContent = v;
    if (hd) hd.textContent = v;
    if (hr) hr.textContent = v;
  };
  
  // Dashboard Boxes (Quick Stats)
  setEl('d-todo-cnt', stats.todo);
  setEl('d-can', stats.can);
  setEl('d-post', stats.post);
  setEl('d-nohap', stats.nohap);
  setEl('d-makeups', stats.makeups);
  setEl('d-handled', stats.handled);
  setEl('d-total', stats.all.toLocaleString());

  // Header Stats (Desktop/Mobile sync)
  const hPairs = window.getEl('h-pairs');
  if(hPairs) hPairs.textContent = (window.pairs || []).length;
  
  const hGardens = window.getEl('h-gardens');
  if(hGardens) {
    const tab = (typeof window._dashTab !== 'undefined' ? window._dashTab : 'g');
    const cls = (tab === 'g' ? '╫ע╫á╫ש╫¥' : '╫ס╫ש╫פ"╫í');
    const gardenCount = (window.GARDENS || []).filter(g => window.gcls(g) === cls).length + (window._GARDENS_EXTRA || []).filter(g => window.gcls(g) === cls).length;
    hGardens.textContent = gardenCount;
  }

  // Invoices
  if (typeof window.INVOICES !== 'undefined') {
    setEl('h-inv', window.INVOICES.length);
    if (typeof _migrateInvStatus === 'function') {
      setEl('h-inv-active', window.INVOICES.filter(i => _migrateInvStatus(i.status) === 'order').length);
      setEl('h-inv-prog', window.INVOICES.filter(i => _migrateInvStatus(i.status) === 'tx_invoice').length);
    }
  }

  // Dashboard Pill Badges (Desktop/Mobile sync via getEl)
  setEl('dvp-cnt-todo', stats.todo);
  setEl('dvp-cnt-nohap', stats.nohap);
  setEl('dvp-cnt-post', stats.post);
  setEl('dvp-cnt-handled', stats.handled);
  setEl('dvp-cnt-all', stats.all.toLocaleString());
  setEl('dvp-cnt-can', stats.can);
  setEl('dvp-cnt-makeups', stats.makeups);
}
window.updCounts = updUIStats;


function initDrops(){
  const cs=cities();
  function fC(id){
    const items = cs.map(c => `<option value='${c}'>${c}</option>`).join('');
    ['', '-desktop', '-mobile'].forEach(suffix => {
      const el = document.getElementById(id + suffix);
      if (el) el.innerHTML += items;
    });
  }
  function fG(id,first,prefix){
    const items = `<option value="">${first}</option>` + [...GARDENS].sort((a,b)=>{
      const cc=(a.city||'').localeCompare(b.city||'','he');
      return cc||((a.name||'').localeCompare(b.name||'','he'));
    }).map(g=>`<option value='${g.id}'>${prefix?g.city+' ┬╖ ':''} ${g.name}</option>`).join('');
    
    ['', '-desktop', '-mobile'].forEach(suffix => {
      const el = document.getElementById(id + suffix);
      if (el) el.innerHTML = items;
    });
  }
  fC('dash-city');fC('cal-city');fC('s-city');fC('g-city');fC('apm-city');fC('pairs-city');fC('cl-city');
  // Filter dropdowns (search/filter): show ONLY act suppliers in ╫ק╫ץ╫ע╫ש╫¥ views
  getAllSup().filter(s=>isActSupplier(s.name)).forEach(s=>{
    const disp = window.supNameLabel(s.name) !== s.name ? window.supNameLabel(s.name) + ' (' + s.name + ')' : s.name;
    ['dash-sup','cal-sup','s-sup'].forEach(id=>{
      ['', '-desktop', '-mobile'].forEach(suffix => {
        const el = document.getElementById(id + suffix);
        if (el) el.innerHTML += `<option value='${s.name}'>${disp}</option>`;
      });
    });
  });
  // Scheduling dropdowns: show ONLY act suppliers (isAct=true)
  getAllSup().filter(s=>isActSupplier(s.name)).forEach(s=>{
    const disp = window.supNameLabel(s.name) !== s.name ? window.supNameLabel(s.name) + ' (' + s.name + ')' : s.name;
    ['ns-sup','es-sup'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML+=`<option value='${s.name}'>${disp}</option>`;});
  });
  fG('cal-g1','╫¢╫£ ╫פ╫ª╫פ╫¿╫ץ╫á╫ש╫¥',true);fG('cal-g2','Γאפ',true);fG('cal-g3','Γאפ',true);
  fG('s-g1','╫¢╫£ ╫פ╫ª╫פ╫¿╫ץ╫á╫ש╫¥',true);fG('s-g2','Γאפ',true);fG('s-g3','Γאפ',true);
  fG('apm-g1','╫ס╫ק╫¿ ╫ª╫פ╫¿╫ץ╫ƒ',true);fG('apm-g2','╫ס╫ק╫¿ ╫ª╫פ╫¿╫ץ╫ƒ',true);fG('apm-g3','Γאפ',true);
  ['', '-desktop', '-mobile'].forEach(suffix => {
    const el = document.getElementById('cal-dp' + suffix);
    if (el) el.value = td();
  });
  // Default calendar to ╫ע╫á╫ש╫¥ tab
  ['', '-desktop', '-mobile'].forEach(suffix => {
    const el = document.getElementById('cal-cls' + suffix);
    if (el) el.value = '╫ע╫á╫ש╫¥';
  });
}

window.TABS=['dash','cal','sched','gardens','pairs','holidays','clusters','sup','managers','admin'];
window.currentTab='cal';

// ΓפאΓפאΓפא GLOBAL NAVIGATION SEARCH ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא
function navSearchInput(val){
  const res=document.getElementById('nav-search-results');
  if(!res) return;
  const q=(val||'').trim().toLowerCase();
  if(!q){ res.style.display='none'; return; }

  const results=[];

  // Search gardens
  const allG=[...GARDENS,...(_GARDENS_EXTRA||[])];
  allG.forEach(g=>{
    if(!(g.name||'').toLowerCase().includes(q)&&!(g.city||'').toLowerCase().includes(q)) return;
    results.push({
      icon: gcls(g)==='╫ס╫ש╫פ"╫í'?'≡ƒן¢∩╕ן':'≡ƒן½',
      label: `${g.name}`,
      sub: g.city||'',
      action: `switchMode('act');ST('gardens');setTimeout(()=>openGM(${g.id}),200);navSearchClose();`
    });
  });

  // Search suppliers
  getAllSup().forEach(s=>{
    const base=supBase(s.name);
    if(!base.toLowerCase().includes(q)) return;
    results.push({
      icon:'≡ƒןó',
      label: base,
      sub: isActSupplier(base)?'╫í╫ñ╫º ╫ק╫ץ╫ע╫ש╫¥':'╫í╫ñ╫º',
      action: `switchMode('act');ST('sup');setTimeout(()=>openSupCard('${base.replace(/'/g,"\\'")}'),200);navSearchClose();`
    });
  });

  // Search events (by supplier name or garden)
  if(q.length>=2){
    const evMatches=SCH.filter(s=>{
      if(s.st==='can') return false;
      return (s.a||'').toLowerCase().includes(q)||(G(s.g)?.name||'').toLowerCase().includes(q);
    }).slice(0,5);
    evMatches.forEach(s=>{
      const g=G(s.g);
      results.push({
        icon:'≡ƒףו',
        label:`${supBase(s.a)} Γאפ ${g?.name||''}`,
        sub: `${fD(s.d)} ${s.t?fT(s.t):''}`,
        action: `switchMode('act');ST('cal');setTimeout(()=>{goDate('${s.d}');setTimeout(()=>openSP('${s.id}'),200);},150);navSearchClose();`
      });
    });
  }

  if(!results.length){
    res.innerHTML='<div style="padding:10px 14px;color:#999;font-size:.82rem">╫£╫נ ╫á╫₧╫ª╫נ╫ץ ╫¬╫ץ╫ª╫נ╫ץ╫¬</div>';
    res.style.display='block'; return;
  }

  res.innerHTML='';
  results.slice(0,12).forEach(r=>{
    const el=document.createElement('div');
    el.style.cssText='padding:8px 12px;cursor:pointer;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:10px';
    el.innerHTML=`
      <span style="font-size:1.1rem;flex-shrink:0">${r.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:.82rem;color:#1a237e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.label}</div>
        ${r.sub?`<div style="font-size:.72rem;color:#78909c">${r.sub}</div>`:''}
      </div>`;
    el.addEventListener('mouseover',()=>el.style.background='#f5f7ff');
    el.addEventListener('mouseout', ()=>el.style.background='');
    el.addEventListener('click', new Function(r.action));
    res.appendChild(el);
  });
  res.style.display='block';
}

function navSearchClose(){
  const res=document.getElementById('nav-search-results');
  if(res) res.style.display='none';
  const inp=document.getElementById('nav-search-input');
  if(inp) inp.value='';
}
// ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא

function ST(t){
  currentTab=t;
  // Always close side panel + backdrop when switching tabs (critical for mobile)
  const _spEl=document.getElementById('sp');
  const _bdEl=document.getElementById('sp-backdrop');
  if(_spEl) _spEl.classList.remove('open');
  if(_bdEl) _bdEl.style.display='none';
  selEv=null;
  // Find the correct tab button by matching onclick attribute Γאפ not by index
  // (TABS array has hidden tabs like 'pairs','clusters','managers' that have no button)
  document.querySelectorAll('#tabs-act .tab').forEach(btn=>{
    const fn = btn.getAttribute('onclick')||'';
    btn.classList.toggle('active', fn.includes(`'${t}'`) || fn.includes(`"${t}"`));
  });
  
  // Hide all act panels + admin panel + purch panels, show only active
  const allPanels = [...TABS, 'admin', 'pdash', 'pinvoices', 'psup'];
  allPanels.forEach(x=>{
    const panelEl=document.getElementById('p-'+x);
    if(panelEl){
      const isActive = x===t;
      if(isActive) panelEl.style.display='block';
      else panelEl.style.display='none';
    }
  });

  // purch panels are managed by switchMode, not ST
  if(t==='admin'){
    document.getElementById('mode-bar').scrollIntoView();
    // Refresh log stats periodically while admin is open
    if(window._admInt) clearInterval(window._admInt);
    window._admInt=setInterval(()=>{if(currentTab==='admin'&&typeof updateLogStats==='function')updateLogStats()},3000);
    // Switch mode visuals to 'admin' mode styling
    document.body.classList.remove('mode-purch');
    document.getElementById('tabs-act').style.display='none';
    document.getElementById('tabs-purch').style.display='none';
    document.getElementById('modeBtn-act').classList.remove('active');
    document.getElementById('modeBtn-purch').classList.remove('active');
    const adminBtn = document.getElementById('modeBtn-admin');
    if(adminBtn) adminBtn.classList.add('active');
    
    // Load admin data
    if(typeof loadUsersList==='function') setTimeout(loadUsersList,300);
    if(typeof loadActivityLog==='function') setTimeout(()=>loadActivityLog(document.getElementById('log-filter')?.value||'week'),500);
  }
  if(t==='sched') { if(window.renderSched) window.renderSched(); }
  if(t==='gardens'){ if(window.renderGardens) window.renderGardens(); if(window.refreshMgrDrops) window.refreshMgrDrops(); }
  if(t==='cal'){
    // Restore nav buttons in case they were hidden by range view
    if(window.calV!=='range'){
      document.querySelectorAll('[onclick*="navCal(-1)"],[onclick*="navCal(1)"]').forEach(b=>b.style.display='');
    }
    if(window.renderCal) window.renderCal();
  }
  if(t==='pairs') { if(window.renderPairs) window.renderPairs(); }
  if(t==='holidays'){ if(window.initHolDrops) window.initHolDrops(); if(window.renderHolidays) window.renderHolidays(); }
  if(t==='clusters') { if(window.renderClusters) window.renderClusters(); }
  if(t==='managers'){ if(window.renderManagers) window.renderManagers(); if(window.refreshMgrDrops) window.refreshMgrDrops(); }
  if(t==='sup') { if(window.renderSup) window.renderSup(); }
  setTimeout(window._fitScrollAreas, 120);
}

function getAllGardens(){return [...GARDENS,..._GARDENS_EXTRA];}
function openAddGarden(){
  document.getElementById('addg-name').value='';
  document.getElementById('addg-st').value='';
  document.getElementById('addg-co').value='';
  document.getElementById('addg-dfrom').value='';
  document.getElementById('addg-dto').value='';
  const cityEl=document.getElementById('addg-city');
  cityEl.innerHTML='<option value="">╫ס╫ק╫¿ ╫ó╫ש╫¿...</option>';
  cities().forEach(c=>cityEl.innerHTML+=`<option value='${c}'>${c}</option>`);
  const fill=id=>{
    const el=document.getElementById(id);
    el.innerHTML='<option value="">╫£╫£╫נ</option>';
    GARDENS.sort((a,b)=>a.name.localeCompare(b.name,'he')).forEach(g=>el.innerHTML+=`<option value='${g.id}'>${g.city} ┬╖ ${g.name}</option>`);
  };
  fill('addg-partner');fill('addg-partner3');
  const clEl=document.getElementById('addg-cluster');
  clEl.innerHTML='<option value="">╫£╫£╫נ ╫נ╫⌐╫¢╫ץ╫£</option><option value="__new__">Γ₧ץ ╫נ╫⌐╫¢╫ץ╫£ ╫ק╫ף╫⌐...</option>';
  getClusters().forEach(cl=>clEl.innerHTML+=`<option value='${cl.id}'>${cl.name}</option>`);
  clEl.onchange=()=>{
    document.getElementById('addg-cluster-new-wrap').style.display=clEl.value==='__new__'?'block':'none';
  };
  document.getElementById('addgm').classList.add('open');
}
function saveNewGarden(){
  const name=document.getElementById('addg-name').value.trim();
  const city=document.getElementById('addg-city').value;
  const cls=document.getElementById('addg-cls').value;
  if(!name||!city){window.spAlert('╫ש╫⌐ ╫£╫₧╫£╫נ ╫⌐╫¥ ╫ץ╫ó╫ש╫¿');return;}
  const newId=Date.now();
  const newG={id:newId,name,city,
    st:document.getElementById('addg-st').value.trim(),
    co:document.getElementById('addg-co').value.trim(),
    cls,
    dfrom:document.getElementById('addg-dfrom').value,
    dto:document.getElementById('addg-dto').value
  };
  _GARDENS_EXTRA.push(newG);
  const partnerId=parseInt(document.getElementById('addg-partner').value)||null;
  const partner3Id=parseInt(document.getElementById('addg-partner3').value)||null;
  if(partnerId){
    const ids=[newId,partnerId,partner3Id].filter(Boolean);
    const pName=ids.map(id=>{const g=GARDENS.find(x=>x.id===id)||_GARDENS_EXTRA.find(x=>x.id===id);return g?g.name:'';}).join(' + ');
    const targetId = Date.now()+1;
    pairs.push({id:targetId,ids,name:pName});
    // Cleanup duplicates from other pairs
    window.pairs = window.pairs.map(p => {
      if (p.id === targetId) return p;
      return { ...p, ids: p.ids.filter(id => !ids.map(Number).includes(Number(id))) };
    }).filter(p => p.ids.length >= 2);
  }
  const clVal=document.getElementById('addg-cluster').value;
  if(clVal&&clVal!=='__new__'){
    if(clusters[clVal]&&!clusters[clVal].gardenIds.includes(newId)) clusters[clVal].gardenIds.push(newId);
  } else if(clVal==='__new__'){
    const clName=document.getElementById('addg-cluster-new').value.trim();
    if(clName){
      const clId='cl_'+Date.now();
      clusters[clId]={id:clId,name:clName,desc:'',gardenIds:[newId]};
    }
  }
  if(!supEx['__gardens_extra']) supEx['__gardens_extra']=[];
  supEx['__gardens_extra'].push(newG);
  save();CM('addgm');refresh();refreshClusterDrops();
  window.spAlert('Γ£ו '+name+' ╫á╫ץ╫í╫ú ╫ס╫פ╫ª╫£╫ק╫פ!');
}
let _sucName=null;
// ΓפאΓפא Supplier card: tab between activities and documents ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא
let _sucTab = 'acts'; // 'acts' | 'docs'

function setSucTab(tab){
  _sucTab = tab;
  document.getElementById('suc-tab-acts')?.classList.toggle('active', tab==='acts');
  document.getElementById('suc-tab-docs')?.classList.toggle('active', tab==='docs');
  document.getElementById('suc-acts-section').style.display = tab==='acts' ? '' : 'none';
  document.getElementById('suc-docs-section').style.display = tab==='docs' ? '' : 'none';
  // suc-body holds the schedule table Γאפ hide it when viewing docs
  const sucBody = document.getElementById('suc-body');
  if(sucBody) sucBody.style.display = tab==='acts' ? '' : 'none';
  if(tab==='docs') renderSupDocs();
  else renderSupCard();
}

function initSucTabs(){
  const name = _sucName;
  // Determine supplier type based on explicit flags AND actual data
  const exIsAct = supEx[name]?.isAct;
  const exIsPurch = supEx[name]?.isPurch;
  const hasSchEntries = SCH.some(s=>supBase(s.a)===name);
  const hasInvoices = INVOICES.some(i=>supBase(i.supName||'')===name);
  // isAct = explicitly marked OR (not explicitly marked purch-only AND has schedule entries)
  const isAct = exIsAct===true || (exIsAct===undefined && hasSchEntries && !hasInvoices);
  // isPurch = explicitly marked OR has invoices OR default (but SUPBASE-only suppliers treated as act)
  const isPurch = exIsPurch===true || hasInvoices || (exIsPurch===undefined && !hasSchEntries);
  const tabsDiv = document.getElementById('suc-section-tabs');
  const actsDiv = document.getElementById('suc-acts-section');
  const docsDiv = document.getElementById('suc-docs-section');
  if(!tabsDiv||!actsDiv||!docsDiv) return;

  if(isAct && isPurch){
    // Show tabs, default based on mode
    tabsDiv.style.display = 'block';
    const isModePurch = (typeof _appMode!=='undefined' && _appMode==='purch');
    setSucTab(isModePurch ? 'docs' : 'acts');
  } else if(isPurch && !isAct){
    // Pure purch: show only docs
    tabsDiv.style.display = 'none';
    actsDiv.style.display = 'none';
    docsDiv.style.display = '';
    _sucTab='docs';
    renderSupDocs();
  } else {
    // Pure ╫ק╫ץ╫ע╫ש╫¥: show only acts
    tabsDiv.style.display = 'none';
    actsDiv.style.display = '';
    docsDiv.style.display = 'none';
    _sucTab='acts';
  }
}

function renderSupDocs(){
  const el = document.getElementById('suc-docs-body');
  const totalEl = document.getElementById('suc-docs-total');
  if(!el) return;
  const srch = (document.getElementById('suc-doc-srch')?.value||'').toLowerCase();
  const stf = document.getElementById('suc-doc-status')?.value||'';
  let invs = INVOICES.filter(i=>supBase(i.supName||'')===_sucName);
  if(srch) invs = invs.filter(i=>
    (i.orderNum||'').toLowerCase().includes(srch)||
    (i.txNum||'').toLowerCase().includes(srch)||
    (i.num||'').toLowerCase().includes(srch)||
    (i.orderDesc||'').toLowerCase().includes(srch)
  );
  if(stf) invs = invs.filter(i=>_migrateInvStatus(i.status)===stf);
  invs = [...invs].sort((a,b)=>(b.orderDate||b.txDate||b.date||'').localeCompare(a.orderDate||a.txDate||a.date||''));

  if(!invs.length){
    el.innerHTML='<div style="color:#aaa;text-align:center;padding:16px;font-size:.8rem">╫נ╫ש╫ƒ ╫₧╫í╫₧╫¢╫ש╫¥</div>';
    if(totalEl) totalEl.textContent='';
    return;
  }
  const fmtSt = s=>{const m={order:'≡ƒףכ',tx_invoice:'≡ƒº╛',tax_invoice:'≡ƒףס',tax_receipt:'≡ƒףס≡ƒº╛',receipt:'≡ƒףה',cancelled:'Γ¥ל'};return m[s]||m[_migrateInvStatus(s)]||'≡ƒףה';};
  const total = invs.reduce((s,i)=>s+(i.orderAmt||i.txAmt||i.amt||0),0);
  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:.78rem">
    <thead><tr style="background:#e8eaf6;position:sticky;top:0">
      <th style="padding:5px 8px;text-align:right">╫¬╫נ╫¿╫ש╫ת</th>
      <th style="padding:5px 8px;text-align:right">╫₧╫í╫₧╫ת</th>
      <th style="padding:5px 8px;text-align:right">╫ñ╫ש╫¿╫ץ╫ר</th>
      <th style="padding:5px 8px;text-align:right;white-space:nowrap">╫í╫¢╫ץ╫¥</th>
      <th style="padding:5px 8px;text-align:center">╫í╫ר╫ר╫ץ╫í</th>
      <th style="padding:5px 8px"></th>
    </tr></thead>
    <tbody>
    ${invs.map(inv=>{
      const d = inv.orderDate||inv.txDate||inv.date||'';
      const docNum = inv.orderNum||inv.txNum||inv.num||'Γאפ';
      const amt = inv.orderAmt||inv.txAmt||inv.amt||0;
      const amtStr = amt ? `Γג¬${withVat(amt,inv.vat||18).toLocaleString()}` : 'Γאפ';
      return `<tr style="border-bottom:1px solid #f0f0f0;cursor:pointer" onclick="CM('sucard-m');openNewInvoice(${inv.id})">
        <td style="padding:5px 8px;white-space:nowrap">${d?fD(d):'Γאפ'}</td>
        <td style="padding:5px 8px;font-weight:700;color:#1565c0">${docNum}</td>
        <td style="padding:5px 8px;color:#546e7a;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${inv.orderDesc||''}</td>
        <td style="padding:5px 8px;font-weight:700;color:#2e7d32;white-space:nowrap">${amtStr}</td>
        <td style="padding:5px 8px;text-align:center">${fmtSt(inv.status)}</td>
        <td style="padding:5px 8px" onclick="event.stopPropagation()"><button class="btn bo bsm" style="font-size:.65rem" onclick="CM('sucard-m');openNewInvoice(${inv.id})">Γ£ן∩╕ן</button></td>
      </tr>`;
    }).join('')}
    </tbody></table>`;
  if(totalEl) totalEl.textContent = `${invs.length} ╫₧╫í╫₧╫¢╫ש╫¥ ┬╖ ╫í╫פ"╫¢: Γג¬${total.toLocaleString()} ╫£╫ñ╫á╫ש ╫₧╫ó"╫₧`;
}

function sucOpenNewDoc(){
  CM('sucard-m');
  openNewInvoice(null, _sucName);
}

function sucExportDocs(){
  if(typeof exportSupPurchDocs==='function') exportSupPurchDocs(_sucName);
  else showToast('Γ¥ל ╫ש╫ª╫ץ╫נ ╫£╫נ ╫צ╫₧╫ש╫ƒ');
}

function openSupCard(name){
  _sucName=supBase(name); // normalize to base name
  // Clear previous content first
  const body=document.getElementById('suc-body');
  if(body) body.innerHTML='';
  document.getElementById('suc-edit-panel').style.display='none';
  document.getElementById('suc-view').style.display='block';
  sucRefreshInfo();
  initSucTabs(); // set correct tab (acts vs docs) based on supplier type
  const now=new Date();
  const sfrom=document.getElementById('suc-from');
  const sto=document.getElementById('suc-to');
  sfrom.value=d2s(new Date(now.getFullYear(),now.getMonth(),1));
  sto.value=d2s(new Date(now.getFullYear(),now.getMonth()+1,0));
  document.getElementById('suc-st').value='';
  sucRefreshActFilt();
  // Only render activities if supplier has actual schedule entries
  const _hasSchEntries = SCH.some(s=>supBase(s.a)===_sucName);
  if(_hasSchEntries) renderSupCard();
  document.getElementById('sucard-m').classList.add('open');
}
function sucRefreshInfo(){
  const name=_sucName; // always base name e.g. "╫ק╫ץ╫ע╫ץ╫¬"
  const ex=supBaseEx(name);
  const s=SUPBASE.find(x=>supBase(x.name)===name)||{};
  const acts=getSupActs(name);
  const cnt=SCH.filter(sc=>supBase(sc.a)===name).length;
  const acts2=getSupActs(name);
  (document.getElementById('suc-title')||{}).textContent =name;
  const invCnt = (typeof INVOICES!=='undefined') ? INVOICES.filter(i=>supBase(i.supName||'')===name).length : 0;
  const isPurch = isPurchSupplier(name);
  const isAct = isActSupplier(name);
  let sub = '';
  if(isAct) sub += `${cnt} ╫ñ╫ó╫ש╫£╫ץ╫ש╫ץ╫¬ ┬╖ ${acts2.length} ╫í╫ץ╫ע╫ש╫¥`;
  if(isPurch && invCnt>0) sub += (sub?' ┬╖ ':'')+`${invCnt} ╫₧╫í╫₧╫¢╫ש ╫¿╫¢╫⌐`;
  (document.getElementById('suc-sub')||{}).textContent = sub||name;
  const typeFlags = [
    isActSupplier(name)?'<span class="sup-flag sup-flag-act">≡ƒמ¿ ╫í╫ñ╫º ╫ק╫ץ╫ע╫ש╫¥</span>':'<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:.68rem;font-weight:700;background:#fce4ec;color:#c62828">≡ƒת½ ╫£╫נ ╫₧╫ץ╫ñ╫ש╫ó ╫ס╫ק╫ץ╫ע╫ש╫¥</span>',
    isPurchSupplier(name)?'<span class="sup-flag sup-flag-purch">≡ƒ¢ע ╫í╫ñ╫º ╫¿╫¢╫⌐</span>':'',
    ex.entityType?`<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:.68rem;font-weight:700;background:#f3e5f5;color:#6a1b9a">≡ƒןó ${ex.entityType}</span>`:''
  ].filter(Boolean).join(' ');
  const typeFlagsEl = document.getElementById('suc-type-flags');
  if(typeFlagsEl) typeFlagsEl.innerHTML = typeFlags;
  document.getElementById('suc-info').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:.81rem">
      <div><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">≡ƒף₧ ╫ר╫£╫ñ╫ץ╫ƒ ╫¿╫נ╫⌐╫ש</div><div style="font-weight:700">${ex.ph1||s.phone||'Γאפ'}</div></div>
      ${ex.ph2?`<div><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">≡ƒף₧ ╫ר╫£╫ñ╫ץ╫ƒ ╫á╫ץ╫í╫ú</div><div style="font-weight:700">${ex.ph2}</div></div>`:'<div></div>'}
      ${ex.g1?`<div><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">≡ƒן¢∩╕ן ╫ק.╫ñ. / ╫ó╫ץ╫í╫º</div><div style="font-weight:700">${ex.g1}</div></div>`:'<div></div>'}
      ${ex.moeTax?`<div><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">≡ƒףת ╫₧╫í' ╫í╫ñ╫º ╫ק╫ש╫á╫ץ╫ת</div><div style="font-weight:700">${ex.moeTax}</div></div>`:''}
      ${ex.contact?`<div><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">≡ƒסñ ╫נ╫ש╫⌐ ╫º╫⌐╫¿</div><div style="font-weight:700">${ex.contact}</div></div>`:''}
      ${ex.addr?`<div style="grid-column:1/-1"><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">≡ƒףם ╫¢╫¬╫ץ╫ס╫¬</div><div style="font-weight:700">${ex.addr}</div></div>`:''}
      <div style="grid-column:1/-1;display:${isActSupplier(name)?'block':'none'}">
        <div style="color:#546e7a;font-size:.69rem;margin-bottom:4px">≡ƒמ» ╫í╫ץ╫ע╫ש ╫ñ╫ó╫ש╫£╫ץ╫ש╫ץ╫¬</div>
        ${acts.length
          ?acts.map(a=>`<span style="background:#e3f2fd;color:#1565c0;border-radius:12px;padding:2px 9px;font-size:.76rem;font-weight:600;margin-left:4px;margin-bottom:3px;display:inline-block">${a}</span>`).join('')
          :'<span style="color:#999;font-size:.76rem">╫£╫נ ╫פ╫ץ╫ע╫ף╫¿╫ץ ╫ñ╫ó╫ש╫£╫ץ╫ש╫ץ╫¬ Γאפ ╫£╫ק╫Ñ Γ£ן∩╕ן ╫ó╫¿╫ץ╫ת ╫£╫פ╫ץ╫í╫ñ╫פ</span>'
        }
      </div>
      ${ex.notes?`<div style="grid-column:1/-1"><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">≡ƒף¥ ╫פ╫ó╫¿╫ץ╫¬</div><div>${ex.notes}</div></div>`:''}
    </div>
    `;  // docs shown in suc-docs-section tab
}
function sucRefreshActFilt(){
  const acts=getSupActs(_sucName);
  const el=document.getElementById('suc-act-filt');
  if(!el) return;
  el.innerHTML='<option value="">╫פ╫¢╫£</option>'+acts.map(a=>`<option value='${a}'>${a}</option>`).join('');
}
function sucToggleEdit(){
  const ep=document.getElementById('suc-edit-panel');
  const vp=document.getElementById('suc-view');
  const showing=ep.style.display!=='none';
  if(showing){ ep.style.display='none'; vp.style.display='block'; return; }
  const name=_sucName; // base name, e.g. "╫ק╫ץ╫ע╫ץ╫¬"
  const ex=supBaseEx(name);
  const s=SUPBASE.find(x=>supBase(x.name)===name)||{};
  document.getElementById('suc-edit-name').value=name;
  document.getElementById('suc-edit-name').dataset.orig=name;
  document.getElementById('suc-edit-ph1').value=ex.ph1||s.phone||'';
  const aliasEl=document.getElementById('suc-edit-alias');
  if(aliasEl) aliasEl.value=ex.alias||'';
  const schedPhEl=document.getElementById('suc-edit-sched-phone');
  if(schedPhEl) schedPhEl.value=ex.schedPhone||'ph1';
  const moeEl=document.getElementById('suc-edit-moe');
  if(moeEl) moeEl.value=ex.moeTax||'';
  const contactEl2=document.getElementById('suc-edit-contact');
  if(contactEl2) contactEl2.value=ex.contact||'';
  const addrEl2=document.getElementById('suc-edit-addr');
  if(addrEl2) addrEl2.value=ex.addr||'';
  // Show/hide acts section based on isAct flag
  const actsWrap=document.getElementById('suc-acts-wrap');
  if(actsWrap) actsWrap.style.display = (ex.isAct!==false)?'block':'none';
  document.getElementById('suc-edit-ph2').value=ex.ph2||'';
  document.getElementById('suc-edit-g1').value=ex.g1||'';
  document.getElementById('suc-edit-notes').value=ex.notes||'';
  // supplier type flags
  const editIsAct=document.getElementById('suc-edit-is-act');
  const editIsPurch=document.getElementById('suc-edit-is-purch');
  if(editIsAct) editIsAct.checked = ex.isAct !== false;
  if(editIsPurch) editIsPurch.checked = ex.isPurch !== false;
  document.getElementById('suc-edit-warn').style.display='none';
  document.getElementById('suc-edit-name').oninput=function(){
    document.getElementById('suc-edit-warn').style.display=this.value!==this.dataset.orig?'block':'none';
  };
  sucRefreshActsList();
  document.getElementById('suc-act-new-inp').value='';
  ep.style.display='block'; vp.style.display='none';
}
function sucRefreshActsList(){
  const acts=getSupActs(_sucName); // derives from schedule data + supEx
  const el=document.getElementById('suc-acts-list');
  if(!el) return;
  el.innerHTML=acts.length
    ?acts.map((a,i)=>`<span class="suc-act-tag" data-act="${a.replace(/"/g,'&quot;')}" style="background:#e3f2fd;border-radius:12px;padding:3px 9px;font-size:.76rem;margin:2px;display:inline-flex;align-items:center;gap:5px">
        ≡ƒמ» ${a}
        <button onclick="sucRemoveAct(${i})" style="background:none;border:none;color:#e53935;cursor:pointer;font-size:.8rem;padding:0;line-height:1" title="╫פ╫í╫¿ ╫ñ╫ó╫ש╫£╫ץ╫¬">Γ£ץ</button>
      </span>`).join('')
    :'<span style="color:#999;font-size:.75rem">╫£╫נ ╫á╫₧╫ª╫נ╫ץ ╫ñ╫ó╫ש╫£╫ץ╫ש╫ץ╫¬ Γאפ ╫ש╫¬╫₧╫£╫נ ╫נ╫ץ╫ר╫ץ╫₧╫ר╫ש╫¬ ╫₧╫פ╫á╫¬╫ץ╫á╫ש╫¥</span>';
}
function sucAddAct(){
  const inp=document.getElementById('suc-act-new-inp');
  const val=inp.value.trim(); if(!val) return;
  if(!supEx[_sucName]) supEx[_sucName]={};
  if(!Array.isArray(supEx[_sucName].acts)) supEx[_sucName].acts=[...getSupActs(_sucName)];
  if(!supEx[_sucName].acts.includes(val)) supEx[_sucName].acts.push(val);
  inp.value=''; sucRefreshActsList(); save();
}
function sucRemoveAct(idx){
  const acts=getSupActs(_sucName); 
  const actToRemove = acts[idx];
  if(!supEx[_sucName]) supEx[_sucName]={};
  if(!supEx[_sucName].hiddenActs) supEx[_sucName].hiddenActs=[];
  if(!supEx[_sucName].hiddenActs.includes(actToRemove)) supEx[_sucName].hiddenActs.push(actToRemove);

  if(Array.isArray(supEx[_sucName].acts)) {
    supEx[_sucName].acts = supEx[_sucName].acts.filter(a => a !== actToRemove);
  }
  sucRefreshActsList(); save();
}
function deleteSupFromCard() {
  // Use _sucName (set by openSupCard) as the reliable source
  const name = _sucName || (document.getElementById('suc-edit-name') && document.getElementById('suc-edit-name').dataset.orig);
  if (!name) { window.spAlert('╫£╫נ ╫á╫₧╫ª╫נ ╫⌐╫¥ ╫í╫ñ╫º'); return; }

  const activeCount = SCH.filter(s => s.a === name && s.st !== 'can').length;
  const totalCount  = SCH.filter(s => s.a === name).length;

  let msg = `╫£╫₧╫ק╫ץ╫º ╫נ╫¬ ╫פ╫í╫ñ╫º "${name}"?\n`;
  if (totalCount > 0) {
    msg += `\n╫פ╫í╫ñ╫º ╫º╫ש╫ש╫¥ ╫ס-${totalCount} ╫ñ╫ó╫ש╫£╫ץ╫ש╫ץ╫¬ Γאפ ╫פ╫ƒ ╫ש╫ש╫⌐╫₧╫¿╫ץ ╫ó╫¥ ╫⌐╫₧╫ץ.`;
  }
  msg += '\n\n╫פ╫í╫ñ╫º ╫ש╫ץ╫í╫¿ ╫₧╫¿╫⌐╫ש╫₧╫ץ╫¬ ╫פ╫í╫ñ╫º╫ש╫¥ ╫נ╫ת ╫£╫נ ╫₧╫פ╫ñ╫ó╫ש╫£╫ץ╫ש╫ץ╫¬ ╫פ╫פ╫ש╫í╫ר╫ץ╫¿╫ש╫ץ╫¬.';
  if (!confirm(msg)) return;

  // Remove from supEx
  delete supEx[name];

  // Remove from custom suppliers list
  if (supEx['__c']) supEx['__c'] = supEx['__c'].filter(s => s.name !== name);

  // Hide from SUPBASE-based suppliers
  if (!supEx['__merged_away']) supEx['__merged_away'] = [];
  if (!supEx['__merged_away'].includes(name)) supEx['__merged_away'].push(name);

  save();
  CM('sucard-m');
  if (typeof renderSup === 'function') renderSup();
  if (typeof renderPurchSuppliers === 'function') try { renderPurchSuppliers(); } catch(e) {}
  showToast('≡ƒקס∩╕ן ╫í╫ñ╫º "' + name + '" ╫פ╫ץ╫í╫¿ Γאפ ╫פ╫ñ╫ó╫ש╫£╫ץ╫ש╫ץ╫¬ ╫á╫⌐╫₧╫¿╫ץ');
}

function sucSaveEdit(){
  const nameEl=document.getElementById('suc-edit-name');
  const newBase=nameEl.value.trim(); const origBase=nameEl.dataset.orig;
  if(!newBase){window.spAlert('╫ש╫⌐ ╫£╫פ╫צ╫ש╫ƒ ╫⌐╫¥ ╫í╫ñ╫º');return;}
  if(origBase&&origBase!==newBase){
    const affected=SCH.filter(s=>supBase(s.a)===origBase).length;
    if(!confirm(`╫£╫⌐╫á╫ץ╫¬ ╫⌐╫¥ ╫₧-"${origBase}" ╫£-"${newBase}"?\n${affected} ╫⌐╫ש╫ס╫ץ╫ª╫ש╫¥ ╫ש╫ó╫ץ╫ף╫¢╫á╫ץ.`)) return;
    SCH.forEach(s=>{
      if(supBase(s.a)===origBase){
        const act=supAct(s.a);
        s.a=act?(newBase+' - '+act):newBase;
      }
    });
    if(supEx[origBase]){supEx[newBase]={...supEx[origBase]};delete supEx[origBase];}
    _sucName=newBase;
  }
  if(!supEx[_sucName]) supEx[_sucName]={};
  supEx[_sucName].ph1=document.getElementById('suc-edit-ph1').value.trim();
  supEx[_sucName].ph2=document.getElementById('suc-edit-ph2').value.trim();
  supEx[_sucName].g1=document.getElementById('suc-edit-g1').value.trim();
  supEx[_sucName].notes=document.getElementById('suc-edit-notes').value.trim();
  const aliasInp=document.getElementById('suc-edit-alias');
  if(aliasInp) supEx[_sucName].alias=aliasInp.value.trim();
  const schedPhInp=document.getElementById('suc-edit-sched-phone');
  if(schedPhInp) supEx[_sucName].schedPhone=schedPhInp.value;
  const moeInp=document.getElementById('suc-edit-moe');
  if(moeInp) supEx[_sucName].moeTax=moeInp.value.trim();
  const contactInp2=document.getElementById('suc-edit-contact');
  if(contactInp2) supEx[_sucName].contact=contactInp2.value.trim();
  const addrInp2=document.getElementById('suc-edit-addr');
  if(addrInp2) supEx[_sucName].addr=addrInp2.value.trim();
  supEx[_sucName].isAct = document.getElementById('suc-edit-is-act')?.checked !== false;
  supEx[_sucName].isPurch = !!document.getElementById('suc-edit-is-purch')?.checked;
  const actTags=document.querySelectorAll('#suc-acts-list .suc-act-tag');
  const savedActs=[...actTags].map(el=>el.dataset.act).filter(Boolean);
  if(savedActs.length) supEx[_sucName].acts=savedActs;
  save(); renderDash(); renderCal(); updCounts();
  if(_appMode==='purch') renderPurchSuppliers();
  ['dash-sup','cal-sup','s-sup','ns-sup','es-sup'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    const cur=el.value;
    el.innerHTML=id==='es-sup'?'<option value="">-- ╫£╫£╫נ ╫⌐╫ש╫á╫ץ╫ש --</option>':'<option value="">╫¢╫£ ╫פ╫í╫ñ╫º╫ש╫¥</option>';
    getAllSup().filter(s=>isActSupplier(s.name)).forEach(s=>{
      const disp = window.supNameLabel(s.name) !== s.name ? window.supNameLabel(s.name) + ' (' + s.name + ')' : s.name;
      el.innerHTML+=`<option value='${s.name}'>${disp}</option>`;
    });
    el.value=cur;
  });
  sucToggleEdit(); sucRefreshInfo(); sucRefreshActFilt();
  window.spAlert('Γ£ו ╫ñ╫¿╫ר╫ש ╫פ╫í╫ñ╫º ╫á╫⌐╫₧╫¿╫ץ!');
}
function clearSupCardFilter(){
  document.getElementById('suc-from').value='';
  document.getElementById('suc-to').value='';
  document.getElementById('suc-st').value='';
  renderSupCard();
}
function renderSupPurchDocsSection(name){
  const invs = INVOICES.filter(i=>supBase(i.supName||'')===name);
  if(!invs.length) return '';
  const fmtStatus = (s)=>{
    const m={order:'≡ƒףכ ╫פ╫צ╫₧╫á╫פ',tx_invoice:'≡ƒº╛ ╫ק╫⌐╫ס╫ץ╫á╫ש╫¬ ╫ó╫í╫º╫פ',tax_invoice:'≡ƒףס ╫ק╫⌐╫ס╫ץ╫á╫ש╫¬ ╫₧╫í',tax_receipt:'≡ƒףס≡ƒº╛ ╫ק╫⌐╫ס╫ץ╫á╫ש╫¬ ╫₧╫í ╫º╫ס╫£╫פ',receipt:'≡ƒףה ╫º╫ס╫£╫פ',cancelled:'Γ¥ל ╫₧╫ס╫ץ╫ר╫£'};
    return m[s]||m[_migrateInvStatus(s)]||s||'Γאפ';
  };
  const rows = [...invs].sort((a,b)=>(b.orderDate||b.txDate||b.date||'').localeCompare(a.orderDate||a.txDate||a.date||'')).map(inv=>{
    const dateStr = inv.orderDate||inv.txDate||inv.date||'';
    const baseAmt = inv.orderAmt||inv.txAmt||inv.amt||0;
    const invVat = inv.vat||0;
    const amtStr = baseAmt ? `Γג¬${(invVat>0?withVat(baseAmt,invVat):baseAmt).toLocaleString()}` : 'Γאפ';
    const docNums = [inv.orderNum&&`≡ƒףכ ${inv.orderNum}`, inv.txNum&&`≡ƒº╛ ${inv.txNum}`, inv.num&&`≡ƒףס ${inv.num}`].filter(Boolean).join(' ┬╖ ');
    return `<tr style="border-bottom:1px solid #f0f0f0;cursor:pointer" onclick="CM('sucard-m');openNewInvoice(${inv.id})">
      <td style="padding:5px 8px;font-size:.76rem">${dateStr?fD(dateStr):'Γאפ'}</td>
      <td style="padding:5px 8px;font-size:.72rem;color:#546e7a">${docNums||'Γאפ'}</td>
      <td style="padding:5px 8px;font-size:.75rem;color:#37474f">${inv.orderDesc||''}</td>
      <td style="padding:5px 8px;font-size:.75rem;font-weight:700;color:#2e7d32;white-space:nowrap">${amtStr}</td>
      <td style="padding:5px 8px;font-size:.72rem">${fmtStatus(inv.status)}</td>
    </tr>`;
  }).join('');
  const total = invs.reduce((s,i)=>s+(i.orderAmt||i.txAmt||i.amt||0),0);
  return `<div style="margin-top:12px;border-top:1.5px solid #e8eaf6;padding-top:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-weight:700;color:#1565c0;font-size:.82rem">≡ƒףה ╫₧╫í╫₧╫¢╫ש ╫¿╫¢╫⌐ (${invs.length})</div>
      <div style="display:flex;gap:5px">
        <button class="btn bp bsm" style="font-size:.7rem" onclick="openNewInvoice(null,'${name.replace(/'/g,'\'').replace(/"/g,'&quot;')}')">≡ƒףה ╫₧╫í╫₧╫ת ╫ק╫ף╫⌐</button>
        <button class="btn bg bsm" style="font-size:.7rem" onclick="exportSupPurchDocs('${name.replace(/'/g,'\'').replace(/"/g,'&quot;')}')">≡ƒףך ╫ש╫ª╫ץ╫נ</button>
      </div>
    </div>
    <!-- Search filter -->
    <div style="margin-bottom:6px">
      <input type="text" id="suc-inv-srch" placeholder="╫ק╫ñ╫⌐ ╫ס╫₧╫í╫₧╫¢╫ש╫¥..." oninput="filterSupCardInvs()" style="width:100%;font-size:.78rem;padding:5px 9px;border-radius:5px;border:1.5px solid #c5cae9">
    </div>
    <div style="overflow-x:auto;max-height:280px;overflow-y:auto">
      <table style="width:100%;border-collapse:collapse;font-size:.8rem">
        <thead style="position:sticky;top:0;background:#e8eaf6">
          <tr>
            <th style="padding:5px 8px;text-align:right">╫¬╫נ╫¿╫ש╫ת</th>
            <th style="padding:5px 8px;text-align:right">╫₧╫í╫₧╫¢╫ש╫¥</th>
            <th style="padding:5px 8px;text-align:right">╫ñ╫ש╫¿╫ץ╫ר</th>
            <th style="padding:5px 8px;text-align:right">╫í╫¢╫ץ╫¥</th>
            <th style="padding:5px 8px;text-align:right">╫í╫ר╫ר╫ץ╫í</th>
          </tr>
        </thead>
        <tbody id="suc-inv-tbody">${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:6px;font-size:.72rem;color:#546e7a;text-align:left">
      ╫í╫פ"╫¢ (╫£╫ñ╫á╫ש ╫₧╫ó"╫₧): <b style="color:#1565c0">Γג¬${total.toLocaleString()}</b>
    </div>
  </div>`;
}

function filterSupCardInvs(){
  const srch = (document.getElementById('suc-inv-srch')?.value||'').toLowerCase();
  const rows = document.querySelectorAll('#suc-inv-tbody tr');
  rows.forEach(r=>{ r.style.display=!srch||r.textContent.toLowerCase().includes(srch)?'':'none'; });
}

function exportSupPurchDocs(name){
  const invs = INVOICES.filter(i=>supBase(i.supName||'')===name && _migrateInvStatus(i.status)!=='cancelled');
  if(!invs.length){ showToast('╫נ╫ש╫ƒ ╫₧╫í╫₧╫¢╫ש╫¥ ╫£╫ש╫ש╫ª╫ץ╫נ'); return; }
  const fmtStatus = (s)=>{const m={order:'╫פ╫צ╫₧╫á╫פ',tx_invoice:'╫ק╫⌐╫ס╫ץ╫á╫ש╫¬ ╫ó╫í╫º╫פ',tax_invoice:'╫ק╫⌐╫ס╫ץ╫á╫ש╫¬ ╫₧╫í',tax_receipt:'╫ק╫⌐╫ס╫ץ╫á╫ש╫¬ ╫₧╫í ╫º╫ס╫£╫פ',receipt:'╫º╫ס╫£╫פ',cancelled:'╫₧╫ס╫ץ╫ר╫£'};return m[s]||m[_migrateInvStatus(s)]||s||''};
  const wb = XLSX.utils.book_new();

  // ΓפאΓפא Sheet 1: All documents ΓפאΓפא
  const rows = invs.map(inv=>({
    '╫í╫ñ╫º': inv.supName||'',
    '╫ó╫ש╫¿': inv.locCity||'',
    '╫¬╫נ╫¿╫ש╫ת': inv.orderDate||inv.txDate||inv.date||'',
    '╫₧╫í╫ñ╫¿ ╫פ╫צ╫₧╫á╫פ': inv.orderNum||'',
    '╫₧╫í╫ñ╫¿ ╫ק╫⌐╫ס╫ץ╫á╫ש╫¬ ╫ó╫í╫º╫פ': inv.txNum||'',
    '╫₧╫í╫ñ╫¿ ╫ק╫⌐╫ס╫ץ╫á╫ש╫¬ ╫₧╫í': inv.num||'',
    '╫ñ╫ש╫¿╫ץ╫ר': inv.orderDesc||'',
    '╫í╫¢╫ץ╫¥ ╫£╫ñ╫á╫ש ╫₧╫ó╫₧': inv.orderAmt||inv.txAmt||inv.amt||0,
    '╫₧╫ó╫₧ %': inv.vat||0,
    '╫í╫¢╫ץ╫¥ ╫₧╫ó╫₧': inv.orderVat||inv.txVat||inv.vatAmt||0,
    '╫í╫¢╫ץ╫¥ ╫¢╫ץ╫£╫£ ╫₧╫ó╫₧': inv.orderTotal||inv.txTotal||inv.total||0,
    '╫í╫ר╫ר╫ץ╫í': fmtStatus(inv.status),
    '╫פ╫ó╫¿╫ץ╫¬': inv.notes||''
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  // Auto column widths
  const cols = [{wch:20},{wch:12},{wch:12},{wch:14},{wch:16},{wch:14},{wch:25},{wch:14},{wch:8},{wch:12},{wch:14},{wch:16},{wch:20}];
  ws['!cols'] = cols;
  XLSX.utils.book_append_sheet(wb, ws, '╫₧╫í╫₧╫¢╫ש ╫¿╫¢╫⌐');

  // ΓפאΓפא Sheet 2: Summary by city ΓפאΓפא
  const cityMap = {};
  invs.forEach(inv=>{
    const city = inv.locCity || '╫£╫נ ╫ª╫ץ╫ש╫ƒ';
    if(!cityMap[city]) cityMap[city]={count:0, base:0, vatAmt:0, total:0};
    cityMap[city].count++;
    cityMap[city].base  += inv.orderAmt||inv.txAmt||inv.amt||0;
    cityMap[city].vatAmt+= inv.orderVat||inv.txVat||inv.vatAmt||0;
    cityMap[city].total += inv.orderTotal||inv.txTotal||inv.total||0;
  });
  const summaryRows = Object.entries(cityMap)
    .sort((a,b)=>a[0].localeCompare(b[0],'he'))
    .map(([city,d])=>({
      '╫ó╫ש╫¿': city,
      '╫₧╫í╫ñ╫¿ ╫₧╫í╫₧╫¢╫ש╫¥': d.count,
      '╫í╫פ"╫¢ ╫£╫ñ╫á╫ש ╫₧╫ó╫₧': +d.base.toFixed(2),
      '╫í╫פ"╫¢ ╫₧╫ó╫₧': +d.vatAmt.toFixed(2),
      '╫í╫פ"╫¢ ╫¢╫ץ╫£╫£ ╫₧╫ó╫₧': +d.total.toFixed(2)
    }));
  // Grand total row
  const grandBase  = invs.reduce((s,i)=>s+(i.orderAmt||i.txAmt||i.amt||0),0);
  const grandVat   = invs.reduce((s,i)=>s+(i.orderVat||i.txVat||i.vatAmt||0),0);
  const grandTotal = invs.reduce((s,i)=>s+(i.orderTotal||i.txTotal||i.total||0),0);
  summaryRows.push({
    '╫ó╫ש╫¿': 'Γ£ו ╫í╫פ"╫¢ ╫¢╫£╫£╫ש',
    '╫₧╫í╫ñ╫¿ ╫₧╫í╫₧╫¢╫ש╫¥': invs.length,
    '╫í╫פ"╫¢ ╫£╫ñ╫á╫ש ╫₧╫ó╫₧': +grandBase.toFixed(2),
    '╫í╫פ"╫¢ ╫₧╫ó╫₧': +grandVat.toFixed(2),
    '╫í╫פ"╫¢ ╫¢╫ץ╫£╫£ ╫₧╫ó╫₧': +grandTotal.toFixed(2)
  });
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{wch:16},{wch:14},{wch:16},{wch:14},{wch:16}];
  XLSX.utils.book_append_sheet(wb, wsSummary, '╫í╫ש╫¢╫ץ╫¥ ╫£╫ñ╫ש ╫ó╫ש╫¿');

  XLSX.writeFile(wb, `${name}_╫₧╫í╫₧╫¢╫ש_╫¿╫¢╫⌐.xlsx`);
  showToast(`≡ƒףך ╫ש╫ץ╫ª╫נ: ${invs.length} ╫₧╫í╫₧╫¢╫ש╫¥`);
}

function renderSupCard(){
  if(!_sucName) return;
  // Only render activities if supplier has schedule entries
  const hasSchData = SCH.some(s=>supBase(s.a)===_sucName);
  if(!hasSchData) { 
    const el=document.getElementById('suc-body'); 
    if(el) el.innerHTML=''; 
    return; 
  }
  const from=document.getElementById('suc-from').value;
  const to=document.getElementById('suc-to').value;
  const st=document.getElementById('suc-st').value;
  const actFilt=document.getElementById('suc-act-filt')?document.getElementById('suc-act-filt').value:'';
  const evs=SCH.filter(s=>{
    if(supBase(s.a)!==_sucName) return false;
    if(from&&s.d<from) return false;
    if(to&&s.d>to) return false;
    if(st&&s.st!==st) return false;
    if(actFilt&&supAct(s.a)!==actFilt&&s.act!==actFilt) return false;
    return true;
  }).sort((a,b)=>a.d.localeCompare(b.d)||(a.t||'').localeCompare(b.t||''));
  const el=document.getElementById('suc-body');
  if(!evs.length){el.innerHTML='<p style="color:#999;text-align:center;padding:20px">╫נ╫ש╫ƒ ╫ñ╫ó╫ש╫£╫ץ╫ש╫ץ╫¬ ╫ס╫ר╫ץ╫ץ╫ק ╫ץ╫ס╫í╫ש╫á╫ץ╫ƒ ╫צ╫פ</p>';return;}
  const cntDone=evs.filter(s=>s.st==='done').length;
  const cntCan=evs.filter(s=>s.st==='can' && !s._compByMakeup).length;
  const cntPost=evs.filter(s=>s.st==='post' && !s._compByMakeup).length;
  const cntNohap=evs.filter(s=>s.st==='nohap' && !s._compByMakeup).length;
  const cntActive=evs.length-cntDone-cntCan-cntPost-cntNohap;

  let h=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
    <div style="background:#e8f5e9;border-radius:7px;padding:5px 12px;text-align:center;min-width:70px">
      <div style="font-weight:800;color:#2e7d32">${cntDone}</div><div style="font-size:.68rem;color:#546e7a">╫פ╫¬╫º╫ש╫ש╫¥</div>
    </div>
    <div style="background:#fff3e0;border-radius:7px;padding:5px 12px;text-align:center;min-width:70px">
      <div style="font-weight:800;color:#e65100">${cntActive+cntPost}</div><div style="font-size:.68rem;color:#546e7a">╫₧╫¬╫º╫ש╫ש╫¥/╫á╫ף╫ק╫פ</div>
    </div>
    <div style="background:#ffebee;border-radius:7px;padding:5px 12px;text-align:center;min-width:70px">
      <div style="font-weight:800;color:#c62828">${cntCan}</div><div style="font-size:.68rem;color:#546e7a">╫ס╫ץ╫ר╫£</div>
    </div>
    <div style="background:#fce4ec;border-radius:7px;padding:5px 12px;text-align:center;min-width:70px">
      <div style="font-weight:800;color:#e91e63">${cntNohap}</div><div style="font-size:.68rem;color:#546e7a">╫£╫נ ╫פ╫¬╫º╫ש╫ש╫¥</div>
    </div>
    <div style="background:#e3f2fd;border-radius:7px;padding:5px 12px;text-align:center;min-width:70px">
      <div style="font-weight:800;color:#1565c0">${evs.length}</div><div style="font-size:.68rem;color:#546e7a">╫í╫פ"╫¢</div>
    </div>
  </div>`;

  h+=`<div class="tw"><table><thead><tr>
    <th>╫¬╫נ╫¿╫ש╫ת</th><th>╫ש╫ץ╫¥</th><th>╫ó╫ש╫¿</th><th>╫ª╫פ╫¿╫ץ╫ƒ</th><th>╫⌐╫ó╫פ</th><th>╫ñ╫ó╫ש╫£╫ץ╫¬</th><th>╫º╫ס'</th><th>╫í╫ר╫ר╫ץ╫í</th><th>╫פ╫ó╫¿╫ץ╫¬</th><th></th>
  </tr></thead><tbody>`;
  evs.filter(s => !s._compByMakeup).forEach(s=>{
    const g=G(s.g);
    h+=`<tr class="${stClass(s)}">
      <td>${fD(s.d)}</td>
      <td>╫ש╫ץ╫¥ ${dayN(s.d)}</td>
      <td>${g.city||''}</td>
      <td><div style="font-weight:700">${g.name}</div>${g.st?`<div style="font-size:.67rem;color:#78909c">${g.st}</div>`:''}</td>
      <td>${fT(s.t)}</td>
      <td><span style="background:#e3f2fd;color:#1565c0;border-radius:10px;padding:1px 7px;font-size:.73rem;font-weight:600">${s.act||'Γאפ'}</span></td>
      <td style="text-align:center">${s.grp||1}</td>
      <td>${stLabel(s)}</td>
      <td style="max-width:100px;font-size:.71rem">${s.nt||''}</td>
      <td><button class="btn bo bsm" style="font-size:.65rem" onclick="openSP('${s.id}')">Γ£ן∩╕ן</button></td>
    </tr>`;
  });
  h+='</tbody></table></div>';
  el.innerHTML=h;
}
function openSupExportFromCard(){
  if(!_sucName) return;
  const f = document.getElementById('suc-from')?.value;
  const t = document.getElementById('suc-to')?.value;
  CM('sucard-m');
  openSupExport(_sucName);
  // Re-apply captured dates to the export modal if they exist
  if(f) document.getElementById('supex-from').value = f;
  if(t) document.getElementById('supex-to').value = t;
}

function goToTodayCal(){
  ST('cal');
  setTimeout(()=>{
    ['cal-pair', 'cal-g1', 'cal-g2', 'cal-g3', 'cal-city', 'cal-cls'].forEach(id => {
      const el = window.getEl ? window.getEl(id) : document.getElementById(id);
      if (el) el.value = '';
    });
    calD=new Date();calV='list';
    setListSubView('day');setView('list');renderCal();
  },50);
}
function goToTodayActivities(){
  ST('sched');
  setTimeout(()=>{
    ['s-city','s-cls','s-sup','s-th','s-tt','s-st','s-srch'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('s-from').value=td();
    document.getElementById('s-to').value=td();
    sPage=1;renderSched();
  },50);
}

const MAX_SNAPSHOTS=20;
document.querySelectorAll('.modal').forEach(m=>{m.onclick=e=>{if(e.target===m) m.classList.remove('open');};});


// ΓפאΓפא Quick Cancel Popup ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא
// Nohap, Cancel, and Postpone modals moved to activity.js


// ΓפאΓפאΓפא Blocked Dates ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא
let _blockedEditDate=null;

const BLOCKED_ICONS={'╫ר╫ש╫ץ╫£':'≡ƒתל','╫₧╫í╫ש╫ס╫פ':'≡ƒמי','╫נ╫ש╫¿╫ץ╫ó ╫₧╫ש╫ץ╫ק╫ף':'Γ¡נ','╫ש╫ץ╫¥ ╫פ╫ץ╫¿╫ש╫¥':'≡ƒס¿Γאם≡ƒס⌐Γאם≡ƒסº','╫נ╫ק╫¿':'≡ƒת½'};

function getBlockedIcon(reason){
  for(const[k,v] of Object.entries(BLOCKED_ICONS)) if(reason&&reason.includes(k)) return v;
  return '≡ƒת½';
}

function getBlockedInfo(ds){return blockedDates[ds]||null;}

// ΓפאΓפאΓפא Monthly Excel Export ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא
function openGcellPopup(gid, ds, e){
  e.stopPropagation();
  _gcellGid=parseInt(gid);
  _gcellDs=ds;
  const g=G(_gcellGid);
  const key=`${_gcellGid}_${ds}`;
  const blk=gardenBlocks[key];
  const popup=document.getElementById('gcell-popup');
  document.getElementById('gcell-popup-title').textContent=`${g.name} ┬╖ ${fD(ds)} ╫ש╫ץ╫¥ ${dayN(ds)}`;
  const blkLbl=document.getElementById('gcell-popup-block-lbl');
  const blockBtn=document.getElementById('gcell-block-btn');
  const unblockBtn=document.getElementById('gcell-unblock-btn');
  if(blk){
    blkLbl.textContent=`${blk.icon||'≡ƒת½'} ╫ק╫í╫ץ╫¥: ${blk.reason}`;
    blkLbl.style.display='block';
    blockBtn.textContent='≡ƒת½ ╫ó╫¿╫ץ╫ת ╫ק╫í╫ש╫₧╫פ';
    unblockBtn.style.display='block';
  } else {
    blkLbl.style.display='none';
    blockBtn.textContent='≡ƒת½ ╫ק╫í╫ץ╫¥ ╫¬╫נ╫¿╫ש╫ת ╫£╫ª╫פ╫¿╫ץ╫ƒ ╫צ╫פ';
    unblockBtn.style.display='none';
  }
  // Position near click
  const x=Math.min(e.clientX, window.innerWidth-230);
  const y=Math.min(e.clientY, window.innerHeight-220);
  popup.style.left=x+'px';
  popup.style.top=y+'px';
  popup.style.display='block';
  document.getElementById('gcell-popup-overlay').style.display='block';
}

function closeGcellPopup(){
  document.getElementById('gcell-popup').style.display='none';
  document.getElementById('gcell-popup-overlay').style.display='none';
}

function gcellNewSched(){
  closeGcellPopup();
  openNewSched(_gcellGid, {date:_gcellDs});
}

function gcellUnblock(){
  closeGcellPopup();
  _blockMode='garden';
  if(!confirm('╫£╫פ╫í╫ש╫¿ ╫ק╫í╫ש╫₧╫פ ╫צ╫ץ?')) return;
  delete gardenBlocks[`${_gcellGid}_${_gcellDs}`];
  save(); refresh(); showToast('Γ£ו ╫ק╫í╫ש╫₧╫פ ╫פ╫ץ╫í╫¿╫פ');
}

function getGardenBlock(gid, ds){ return gardenBlocks[`${parseInt(gid)}_${ds}`]||null; }

// ΓפאΓפאΓפא Unified Block Modal ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא
// mode: 'date' = whole date block | 'garden' = specific garden+date
let _blockMode='date'; // 'date' | 'garden'

function selBlockReason(btn, reason){
  document.querySelectorAll('.block-reason-btn').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
  const inp=document.getElementById('block-m-reason');
  if(reason!=='╫נ╫ק╫¿') inp.value=reason; else inp.focus();
}

function openBlockModal(mode, gid, ds){
  _blockMode=mode;
  const cancelWrap = document.getElementById('block-m-cancel-wrap');
  const cancelChk  = document.getElementById('block-m-cancel-chk');
  const cancelCnt  = document.getElementById('block-m-cancel-cnt');
  if(mode==='garden'){
    _gcellGid=parseInt(gid); _gcellDs=ds;
    const g=G(_gcellGid);
    const key=`${_gcellGid}_${ds}`;
    const blk=gardenBlocks[key];
    document.getElementById('block-m-title').textContent=`≡ƒת½ ╫ק╫í╫ץ╫¥ ╫ª╫פ╫¿╫ץ╫ƒ ╫£╫¬╫נ╫¿╫ש╫ת`;
    document.getElementById('block-m-subtitle').textContent=`${g.name} ┬╖ ${fD(ds)} ╫ש╫ץ╫¥ ${dayN(ds)}`;
    document.getElementById('block-m-reason').value=blk?blk.reason:'';
    document.getElementById('block-m-note').value=blk?blk.note||'':'';
    document.getElementById('block-m-del').style.display=blk?'inline-flex':'none';
    document.querySelectorAll('.block-reason-btn').forEach(b=>{
      b.classList.toggle('sel', blk&&b.textContent.trim().includes(blk.reason));
    });
    if(cancelWrap) cancelWrap.style.display='none';
  } else {
    _blockedEditDate=ds;
    const blk=blockedDates[ds];
    document.getElementById('block-m-title').textContent=`≡ƒת½ ╫ק╫í╫ץ╫¥ / ╫ס╫ש╫ר╫ץ╫£ ╫¬╫נ╫¿╫ש╫ת`;
    document.getElementById('block-m-subtitle').textContent=`≡ƒףו ${fD(ds)} Γאפ ╫ש╫ץ╫¥ ${dayN(ds)}`;
    document.getElementById('block-m-reason').value=blk?blk.reason:'';
    document.getElementById('block-m-note').value=blk?blk.note||'':'';
    document.getElementById('block-m-del').style.display=blk?'inline-flex':'none';
    document.querySelectorAll('.block-reason-btn').forEach(b=>{
      b.classList.toggle('sel', blk&&b.textContent.trim().includes(blk.reason));
    });
    // Show cancel-activities option with count
    if(cancelWrap){
      cancelWrap.style.display='block';
      if(cancelChk) cancelChk.checked=false;
      const cnt=SCH.filter(s=>s.d===ds&&s.st!=='can').length;
      if(cancelCnt){
        cancelCnt.textContent=cnt>0?`${cnt} ╫ñ╫ó╫ש╫£╫ץ╫ש╫ץ╫¬ ╫ñ╫ó╫ש╫£╫ץ╫¬ ╫ס╫ש╫ץ╫¥ ╫צ╫פ`:'╫נ╫ש╫ƒ ╫ñ╫ó╫ש╫£╫ץ╫ש╫ץ╫¬ ╫ñ╫ó╫ש╫£╫ץ╫¬ ╫ס╫ש╫ץ╫¥ ╫צ╫פ';
        cancelCnt.style.color=cnt>0?'#c62828':'#888';
      }
    }
  }
  document.getElementById('block-m').classList.add('open');
}

// Keep openBlockedDate as it's called from HTML
function openBlockedDate(ds){ openBlockModal('date', null, ds); }
function gcellBlock(){ openBlockModal('garden', _gcellGid, _gcellDs); }

function saveBlock(){
  const reason=document.getElementById('block-m-reason').value.trim();
  if(!reason){window.spAlert('╫ש╫⌐ ╫£╫פ╫צ╫ש╫ƒ ╫í╫ש╫ס╫פ');return;}
  const note=document.getElementById('block-m-note').value.trim();
  const icon=getBlockedIcon(reason);
  if(_blockMode==='garden'){
    const key=`${_gcellGid}_${_gcellDs}`;
    gardenBlocks[key]={reason,note,icon,gid:_gcellGid,d:_gcellDs};
    saveAndRefresh('block-m'); showToast('≡ƒת½ ╫ª╫פ╫¿╫ץ╫ƒ ╫á╫ק╫í╫¥ ╫£╫¬╫נ╫¿╫ש╫ת ╫צ╫פ');
  } else {
    blockedDates[_blockedEditDate]={reason,note,icon};
    // Optionally cancel all activities
    const cancelChk=document.getElementById('block-m-cancel-chk');
    if(cancelChk&&cancelChk.checked){
      const toCancel=SCH.filter(s=>s.d===_blockedEditDate&&s.st!=='can');
      if(toCancel.length>0){
        toCancel.forEach(s=>{
          s.st='can'; s.cr=reason; s.cn=note;
          const n='Γ¥ל ╫ס╫ץ╫ר╫£: '+reason+(note?' Γאפ '+note:'');
          s.nt=s.nt?s.nt+' | '+n:n;
        });
        saveAndRefresh('block-m');
        showToast(`≡ƒת½ ╫¬╫נ╫¿╫ש╫ת ╫á╫ק╫í╫¥ + ╫ס╫ץ╫ר╫£╫ץ ${toCancel.length} ╫ñ╫ó╫ש╫£╫ץ╫ש╫ץ╫¬`);
        return;
      }
    }
    saveAndRefresh('block-m'); showToast('≡ƒת½ ╫¬╫נ╫¿╫ש╫ת ╫í╫ץ╫₧╫ƒ ╫¢╫ק╫í╫ץ╫¥');
  }
}

function deleteBlock(){
  const msg=_blockMode==='garden'?'╫£╫פ╫í╫ש╫¿ ╫נ╫¬ ╫פ╫ק╫í╫ש╫₧╫פ ╫₧╫ע╫ƒ ╫צ╫פ?':'╫£╫פ╫í╫ש╫¿ ╫נ╫¬ ╫פ╫ק╫í╫ש╫₧╫פ ╫₧╫¬╫נ╫¿╫ש╫ת ╫צ╫פ?';
  if(!confirm(msg)) return;
  if(_blockMode==='garden'){
    delete gardenBlocks[`${_gcellGid}_${_gcellDs}`];
    saveAndRefresh('block-m'); showToast('Γ£ו ╫ק╫í╫ש╫₧╫פ ╫פ╫ץ╫í╫¿╫פ');
  } else {
    delete blockedDates[_blockedEditDate];
    saveAndRefresh('block-m'); showToast('Γ£ו ╫ק╫í╫ש╫₧╫פ ╫פ╫ץ╫í╫¿╫פ');
  }
}

let _editMgrId=null;

// ΓפאΓפאΓפא Auto-import contacts from garden co field ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא
function importContactsFromGardens(){
  if(Object.keys(managers).length>0) return; // already have managers
  const byContact={};
  [...GARDENS,...(_GARDENS_EXTRA||[])].forEach(g=>{
    if(!g.co) return;
    // Parse "Name Γאף 050-XXXXXXX" or "Name - 050-XXXXXXX" or just "Name"
    const m=g.co.match(/^(.+?)\s*[Γאף\-]\s*(\d[\d\-\s]+)$/);
    const name=m?m[1].trim():g.co.trim();
    const phone=m?m[2].trim():'';
    const key=name.toLowerCase();
    if(!byContact[key]) byContact[key]={name,phone,gardenIds:[],city:g.city};
    byContact[key].gardenIds.push(g.id);
    // If gardens span multiple cities, clear city
    if(byContact[key].city!==g.city) byContact[key].city='';
  });
  Object.values(byContact).forEach(c=>{
    const id='mgr_auto_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
    managers[id]={id,name:c.name,phone:c.phone,role:'coord',city:c.city,gardenIds:c.gardenIds};
  });
  if(Object.keys(managers).length>0){
    save();
    console.log('Auto-imported '+Object.keys(managers).length+' contacts from gardens');
  }
}

// ΓפאΓפא Garden contact helpers ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא
// Resolves garden contact: splits old "name - phone" format OR uses separate fields
function resolveGardenContact(g){
  // Only return data that was EXPLICITLY entered by the user in supEx
  // Never auto-extract from old co field (those are coordinator phones, not garden phones)
  const ex=supEx['g_'+g.id]||{};
  return {
    name:  ex.co   || '',
    phone: ex.coph || ''
  };
}

// Get merged garden data (base + supEx overrides)
function getGardenData(gid){
  const g=getAllGardens().find(x=>x.id===gid)||{};
  const ex=supEx['g_'+gid]||{};
  const contact=resolveGardenContact({...g, ...ex});
  return {
    ...g,
    name:  ex.name||g.name||'',         // garden name (never contact name)
    st:    ex.st!==undefined?ex.st:g.st||'',
    notes: ex.notes||g.notes||'',
    coName:  contact.name,              // contact person name
    phone:   contact.phone              // garden phone
  };
}

let _geditGid=null;
function openGardenEdit(gid){
  _geditGid=gid;
  const g=getAllGardens().find(x=>x.id===gid)||{};
  const ex=supEx['g_'+gid]||{};
  const resolved=resolveGardenContact(g);

  (document.getElementById('gedit-title')||{}).textContent =`Γ£ן∩╕ן ${g.name}`;

  // Badge
  const mgr=getGardenMgr(gid);
  const clr=CITY_COLORS(g.city);
  document.getElementById('gedit-badge').innerHTML=
    `<span style="background:${clr.light};color:${clr.solid};border-radius:12px;padding:2px 10px;font-size:.75rem;font-weight:700">≡ƒןש∩╕ן ${g.city}</span>`+
    `<span style="background:#e8f5e9;color:#2e7d32;border-radius:12px;padding:2px 10px;font-size:.75rem">${gcls(g)==='╫ס╫ש╫פ"╫í'?'≡ƒן¢∩╕ן ╫ª╫פ╫¿╫ץ╫ƒ ╫ס╫ש╫¬ ╫í╫ñ╫¿':'≡ƒן½ ╫ª╫פ╫¿╫ץ╫ƒ ╫ע╫ƒ'}</span>`;

  // Fields Γאפ override from supEx if exists
  document.getElementById('gedit-name').value=ex.name||g.name||'';
  document.getElementById('gedit-st').value=ex.st!==undefined?ex.st:(g.st||'');
  document.getElementById('gedit-co').value=ex.co!==undefined?ex.co:resolved.name;
  document.getElementById('gedit-coph').value=ex.coph!==undefined?ex.coph:resolved.phone;
  document.getElementById('gedit-notes').value=ex.notes||g.notes||'';

  // Manager row
  const mgrRow=document.getElementById('gedit-mgr-row');
  const mgrLbl=document.getElementById('gedit-mgr-lbl');
  if(mgr){
    mgrRow.style.display='block';
    mgrLbl.textContent=`${mgr.role==='manager'?'≡ƒן¢∩╕ן ╫₧╫á╫פ╫£':'≡ƒסñ ╫¿╫¢╫צ'}: ${mgr.name}${mgr.phone?' ≡ƒף₧ '+mgr.phone:''}`;
  } else {
    mgrRow.style.display='none';
  }

  document.getElementById('gedit-m').classList.add('open');
}

function saveGardenCard(){
  if(!_geditGid) return;
  if(!supEx['g_'+_geditGid]) supEx['g_'+_geditGid]={};
  const ex=supEx['g_'+_geditGid];
  ex.name =document.getElementById('gedit-name').value.trim();
  ex.st   =document.getElementById('gedit-st').value.trim();
  ex.co   =document.getElementById('gedit-co').value.trim();
  ex.coph =document.getElementById('gedit-coph').value.trim();
  if(ex.coph) ex._cophManual=true; // mark as manually edited
  ex.notes=document.getElementById('gedit-notes').value.trim();
  save();
  CM('gedit-m');
  renderGardens();
  // Refresh other views that show garden data
  if(currentTab==='managers') renderManagers();
  showToast('Γ£ו ╫¢╫¿╫ר╫ש╫í ╫פ╫ª╫פ╫¿╫ץ╫ƒ ╫ó╫ץ╫ף╫¢╫ƒ');
}

function renderManagers(){
  const cityF=(document.getElementById('mgr-city-filt')||{}).value||'';
  const roleF=(document.getElementById('mgr-role-filt')||{}).value||'';
  const all=Object.values(managers).filter(m=>{
    if(cityF&&m.city&&m.city!==cityF) return false;
    if(roleF&&m.role!==roleF) return false;
    return true;
  }).sort((a,b)=>(a.role==='manager'?0:1)-(b.role==='manager'?0:1)||a.name.localeCompare(b.name,'he'));

  const el=document.getElementById('mgr-body');
  if(!all.length){el.innerHTML='<p style="color:#999;text-align:center;padding:20px">╫נ╫ש╫ƒ ╫₧╫á╫פ╫£╫ש╫¥/╫¿╫¢╫צ╫ש╫¥. ╫£╫ק╫Ñ Γ₧ץ ╫£╫פ╫ץ╫í╫ñ╫פ.</p>';return;}

  let h='';
  all.forEach(m=>{
    const gs=(m.gardenIds||[]).map(id=>G(id)).filter(x=>x.id)
      .sort((a,b)=>a.city.localeCompare(b.city,'he')||a.name.localeCompare(b.name,'he'));
    const isMgr=m.role==='manager';
    const roleClr=isMgr?'#1a237e':'#2e7d32';
    const roleBg=isMgr?'#e8eaf6':'#e8f5e9';
    const roleLabel=isMgr?'≡ƒן¢∩╕ן ╫₧╫á╫פ╫£':'≡ƒסñ ╫¿╫¢╫צ';

    // Group gardens by city for display
    const gByCity={};
    gs.forEach(g=>{if(!gByCity[g.city])gByCity[g.city]=[];gByCity[g.city].push(g);});

    h+=`<div class="card" style="padding:0;margin-bottom:12px;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden">
      <!-- Header -->
      <div style="background:${roleClr};padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <span style="font-weight:800;color:#fff;font-size:.9rem">${roleLabel} ${m.name}</span>
          ${m.city?`<span style="font-size:.72rem;color:rgba(255,255,255,.8);margin-right:10px">≡ƒןש∩╕ן ${m.city}</span>`:''}
        </div>
        <div style="display:flex;gap:5px">
          <button onclick="openMgrModal('${m.id}')" style="background:rgba(255,255,255,.22);border:none;border-radius:6px;padding:3px 9px;cursor:pointer;color:#fff;font-size:.74rem">Γ£ן∩╕ן ╫ó╫¿╫ץ╫ת</button>
          <button onclick="exportMgrContact('${m.id}')" style="background:rgba(255,255,255,.15);border:none;border-radius:6px;padding:3px 9px;cursor:pointer;color:#fff;font-size:.74rem">≡ƒףכ ╫ש╫ש╫ª╫ץ╫נ</button>
        </div>
      </div>
      <!-- Contact info -->
      <div style="padding:10px 14px;background:${roleBg};display:flex;gap:18px;flex-wrap:wrap">
        ${m.phone?`<span style="font-size:.8rem">≡ƒף₧ <a href="tel:${m.phone}" style="color:${roleClr};font-weight:700">${m.phone}</a></span>`:''}
        ${m.phone2?`<span style="font-size:.8rem">≡ƒף₧ <a href="tel:${m.phone2}" style="color:${roleClr}">${m.phone2}</a></span>`:''}
        ${m.email?`<span style="font-size:.8rem">Γ£י∩╕ן <a href="mailto:${m.email}" style="color:${roleClr}">${m.email}</a></span>`:''}
        ${m.notes?`<span style="font-size:.78rem;color:#546e7a;font-style:italic">≡ƒע¼ ${m.notes}</span>`:''}
        ${!m.phone&&!m.email&&!m.notes?'<span style="font-size:.77rem;color:#aaa">╫נ╫ש╫ƒ ╫ñ╫¿╫ר╫ש ╫º╫⌐╫¿</span>':''}
      </div>
      <!-- Gardens list -->
      <div style="padding:10px 14px">
        <div style="font-size:.74rem;font-weight:700;color:#546e7a;margin-bottom:7px">╫נ╫ק╫¿╫נ╫ש ╫ó╫£ ${gs.length} ╫ª╫פ╫¿╫ץ╫á╫ש╫¥:</div>
        ${gs.length?`<div>
          ${Object.keys(gByCity).sort().map(city=>`
            <div style="margin-bottom:6px">
              <div style="font-size:.65rem;color:#78909c;font-weight:700;margin-bottom:3px">≡ƒףם ${city}</div>
              <div style="display:flex;flex-wrap:wrap;gap:3px">
                ${gByCity[city].map(g=>`<span style="background:#e8f5e9;color:#1b5e20;border-radius:12px;padding:2px 9px;font-size:.71rem;cursor:pointer" onclick="openGM(${g.id})">${gcls(g)==='╫ס╫ש╫פ"╫í'?'≡ƒן¢∩╕ן':'≡ƒן½'} ${g.name}</span>`).join('')}
              </div>
            </div>`).join('')}
        </div>`:
        `<span style="font-size:.76rem;color:#aaa">╫£╫נ ╫⌐╫ץ╫ש╫¢╫ץ ╫ע╫á╫ש╫¥ ╫ó╫ף╫ש╫ש╫ƒ</span>`}
      </div>
    </div>`;
  });
  el.innerHTML=h;
}

function openMgrModal(id){
  _editMgrId=id;
  const m=id?managers[id]:null;
  (document.getElementById('mgrm-title')||{}).textContent =m?`Γ£ן∩╕ן ╫ó╫¿╫ש╫¢╫¬ ${m.name}`:'Γ₧ץ ╫פ╫ץ╫í╫ú ╫₧╫á╫פ╫£/╫¿╫¢╫צ';
  document.getElementById('mgr-name').value=m?m.name:'';
  document.getElementById('mgr-role').value=m?(m.role||'coord'):'coord';
  document.getElementById('mgr-phone').value=m?m.phone||'':'';
  document.getElementById('mgr-phone2').value=m?m.phone2||'':'';
  document.getElementById('mgr-email').value=m?m.email||'':'';
  document.getElementById('mgr-notes').value=m?m.notes||'':'';

  const mgrCityEl=document.getElementById('mgr-city');
  mgrCityEl.innerHTML='<option value="">╫¢╫£ ╫פ╫ó╫¿╫ש╫¥</option>';
  cities().forEach(c=>mgrCityEl.innerHTML+=`<option value='${c}'${m&&m.city===c?' selected':''}>${c}</option>`);

  const mgrGCityEl=document.getElementById('mgr-g-city');
  mgrGCityEl.innerHTML='<option value="">╫¢╫£ ╫פ╫ó╫¿╫ש╫¥</option>';
  cities().forEach(c=>mgrGCityEl.innerHTML+=`<option value='${c}'>${c}</option>`);
  if(m&&m.city) mgrGCityEl.value=m.city;

  mgrFillGardens();
  document.getElementById('mgr-del-btn').style.display=id?'block':'none';
  document.getElementById('mgrm').classList.add('open');
}

function mgrFillGardens(){
  const m=_editMgrId?managers[_editMgrId]:null;
  const city=document.getElementById('mgr-g-city').value;
  const gs=GARDENS.filter(g=>!city||g.city===city)
    .sort((a,b)=>a.city.localeCompare(b.city,'he')||a.name.localeCompare(b.name,'he'));
  const checked=new Set(m?m.gardenIds||[]:[]);

  // Group by city for easier reading
  const byCity={};
  gs.forEach(g=>{if(!byCity[g.city])byCity[g.city]=[];byCity[g.city].push(g);});

  let h='';
  Object.keys(byCity).sort().forEach(c=>{
    h+=`<div style="padding:4px 6px 2px;font-size:.68rem;font-weight:700;color:#78909c;background:#f5f5f5;border-radius:4px;margin-bottom:2px;margin-top:4px">≡ƒןש∩╕ן ${c}</div>`;
    byCity[c].forEach(g=>{
      h+=`<label style="display:flex;gap:7px;padding:4px 6px;cursor:pointer;align-items:center;border-radius:5px;transition:background .1s" onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background=''" >
        <input type="checkbox" value="${g.id}" ${checked.has(g.id)?'checked':''} style="min-width:15px;accent-color:#1565c0" onchange="mgrUpdateCount()">
        <span style="flex:1;font-size:.77rem">${gcls(g)==='╫ס╫ש╫פ"╫í'?'≡ƒן¢∩╕ן':'≡ƒן½'} ${g.name}</span>
        ${g.st?`<span style="font-size:.65rem;color:#aaa">${g.st}</span>`:''}
      </label>`;
    });
  });
  document.getElementById('mgr-gardens').innerHTML=h||'<p style="color:#aaa;font-size:.75rem;text-align:center;padding:10px">╫נ╫ש╫ƒ ╫ע╫á╫ש╫¥</p>';
  mgrUpdateCount();
}

function mgrUpdateCount(){
  const n=document.querySelectorAll('#mgr-gardens input:checked').length;
  const el=document.getElementById('mgr-gardens-count');
  if(el) el.textContent=n?`Γ£ף ╫á╫ס╫ק╫¿╫ץ ${n} ╫ע╫á╫ש╫¥`:'';
}

function mgrSelectAllGardens(sel){
  document.querySelectorAll('#mgr-gardens input[type="checkbox"]').forEach(cb=>cb.checked=sel);
  mgrUpdateCount();
}

function saveMgr(){
  const name=document.getElementById('mgr-name').value.trim();
  if(!name){window.spAlert('╫ש╫⌐ ╫£╫פ╫צ╫ש╫ƒ ╫⌐╫¥');return;}
  const id=_editMgrId||('mgr_'+Date.now());
  const gardenIds=[...document.querySelectorAll('#mgr-gardens input:checked')].map(cb=>parseInt(cb.value));
  managers[id]={
    id,name,
    role:document.getElementById('mgr-role').value,
    phone:document.getElementById('mgr-phone').value.trim(),
    phone2:document.getElementById('mgr-phone2').value.trim(),
    email:document.getElementById('mgr-email').value.trim(),
    notes:document.getElementById('mgr-notes').value.trim(),
    city:document.getElementById('mgr-city').value,
    gardenIds
  };
  save(); CM('mgrm'); refresh();
  // Refresh all views that show manager/coordinator data
  renderManagers();
  refreshMgrDrops();
  renderGardens();
  if(typeof renderPairs === 'function') renderPairs();
  updCounts();
  showToast('Γ£ו '+name+' ╫á╫⌐╫₧╫¿ Γאפ ╫פ╫á╫¬╫ץ╫á╫ש╫¥ ╫ó╫ץ╫ף╫¢╫á╫ץ ╫ס╫¢╫£ ╫פ╫נ╫ñ╫£╫ש╫º╫ª╫ש╫פ');
}

function deleteMgr(){
  const m=_editMgrId?managers[_editMgrId]:null;
  if(!m) return;
  if(!confirm(`╫£╫₧╫ק╫ץ╫º ╫נ╫¬ ${m.name}?`)) return;
  delete managers[_editMgrId];
  save(); CM('mgrm'); refresh();
  // Refresh all views that show manager/coordinator data
  renderManagers();
  refreshMgrDrops();
  renderGardens();
  if(typeof renderPairs === 'function') renderPairs();
  updCounts();
  showToast('Γ£ו '+name+' ╫á╫⌐╫₧╫¿ Γאפ ╫פ╫á╫¬╫ץ╫á╫ש╫¥ ╫ó╫ץ╫ף╫¢╫á╫ץ ╫ס╫¢╫£ ╫פ╫נ╫ñ╫£╫ש╫º╫ª╫ש╫פ');
}

let _exportMgrId=null;
function exportMgrContact(id){
  _exportMgrId=id;
  const m=managers[id]; if(!m) return;
  const gs=(m.gardenIds||[]).map(id=>G(id)).filter(x=>x.id)
    .sort((a,b)=>a.city.localeCompare(b.city,'he')||a.name.localeCompare(b.name,'he'));
  const roleLabel=m.role==='manager'?'╫₧╫á╫פ╫£':'╫¿╫¢╫צ';
  let txt='';
  txt+=`≡ƒסñ ${roleLabel}: ${m.name}\n`;
  if(m.phone) txt+=`≡ƒף₧ ${m.phone}\n`;
  if(m.phone2) txt+=`≡ƒף₧ ${m.phone2}\n`;
  if(m.email) txt+=`Γ£י∩╕ן ${m.email}\n`;
  if(m.notes) txt+=`≡ƒע¼ ${m.notes}\n`;
  txt+='\n';
  txt+=`≡ƒן½ ╫ª╫פ╫¿╫ץ╫á╫ש╫¥ ╫ס╫נ╫ק╫¿╫ש╫ץ╫¬╫ץ (${gs.length}):\n`;
  // group by city
  const byCity={};
  gs.forEach(g=>{if(!byCity[g.city])byCity[g.city]=[];byCity[g.city].push(g);});
  Object.keys(byCity).sort().forEach(city=>{
    txt+=`\n≡ƒףם ${city}:\n`;
    byCity[city].forEach(g=>{
      const cr=resolveGardenContact(g);
      txt+=`  ${gcls(g)==='╫ס╫ש╫פ"╫í'?'≡ƒן¢∩╕ן':'≡ƒן½'} ${g.name}` + '\n';
      if(g.st) txt+='     ≡ƒףם ' + g.st + '\n';
      if(cr.name) txt+='     ≡ƒסñ ' + cr.name + '\n';
      if(cr.phone) txt+='     ≡ƒף₧ ' + cr.phone + '\n';
    });
  });
  (document.getElementById('mgr-export-text')||{}).textContent =txt;
  document.getElementById('mgr-export-m').classList.add('open');
}

function copyMgrExport(){
  const txt=document.getElementById('mgr-export-text').textContent;
  navigator.clipboard.writeText(txt).then(()=>showToast('Γ£ו ╫פ╫ץ╫ó╫¬╫º!')).catch(()=>{
    const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);showToast('Γ£ו ╫פ╫ץ╫ó╫¬╫º!');
  });
}

function shareMgrWhatsApp(){
  const txt=document.getElementById('mgr-export-text').textContent;
  window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
}

function refreshMgrDrops(){
  const mgrOptions=()=>{
    let opts='<option value="">╫פ╫¢╫£</option>';
    Object.values(managers).sort((a,b)=>a.name.localeCompare(b.name,'he'))
      .forEach(m=>opts+=`<option value="${m.id}">${m.role==='manager'?'≡ƒן¢∩╕ן':'≡ƒסñ'} ${m.name}</option>`);
    return opts;
  };
  const el=document.getElementById('g-mgr');
  if(el){const c=el.value;el.innerHTML=mgrOptions();el.value=c;}
  const el2=document.getElementById('s-mgr');
  if(el2){const c=el2.value;el2.innerHTML=mgrOptions();el2.value=c;}
  const mf=document.getElementById('mgr-city-filt');
  if(mf){const c=mf.value;mf.innerHTML='<option value="">╫¢╫£ ╫פ╫ó╫¿╫ש╫¥</option>';cities().forEach(city=>mf.innerHTML+=`<option value='${city}'>${city}</option>`);mf.value=c;}
}

function getGardenMgr(gid){
  return Object.values(managers).find(m=>(m.gardenIds||[]).includes(gid))||null;
}
function setGardensTab(t){
  _gardensTab = t;
  document.querySelectorAll('[id^="g-tab-"]').forEach(btn => {
    const btnT = btn.id.replace('g-tab-', '').replace('-desktop', '').replace('-mobile', '');
    btn.classList.toggle('active', btnT === t);
  });

  const gBody = document.getElementById('g-body');
  const gToolsD = document.getElementById('gardens-tools-desktop');
  const gToolsM = document.getElementById('gardens-tools-mobile');
  const fixedCtrl = document.getElementById('g-fixed-controls');
  const addBtns = document.querySelectorAll('#p-gardens .btn.bp');

  const isG = ['gan','sch'].includes(t);
  if(gToolsD) gToolsD.style.display = isG ? '' : 'none';
  if(gToolsM) gToolsM.style.display = isG ? '' : 'none';
  if(fixedCtrl) fixedCtrl.style.display = t==='fixed' ? '' : 'none';
  const gInfo = document.getElementById('g-info');
  if(gInfo) gInfo.style.display = t==='fixed' ? 'none' : '';
  addBtns.forEach(btn => btn.style.display = isG ? '' : 'none');

  if(t==='pairs'){
    gBody.className='scroll-area';
    gBody.innerHTML='';
    const src=document.querySelector('#p-pairs .card');
    if(src){ gBody.innerHTML=src.innerHTML; }
    if(typeof renderPairs === 'function') renderPairs();
    return;
  }
  if(t==='clusters'){
    gBody.className='scroll-area';
    gBody.innerHTML='';
    const src=document.querySelector('#p-clusters .card');
    if(src){ gBody.innerHTML=src.innerHTML; }
    if(typeof renderClusters === 'function') renderClusters();
    return;
  }
  if(t==='managers'){
    gBody.className='scroll-area';
    gBody.innerHTML='';
    const src=document.querySelector('#p-managers .card');
    if(src){ gBody.innerHTML=src.innerHTML; }
    renderManagers(); refreshMgrDrops();
    return;
  }
  if(t==='fixed'){
    gBody.className='scroll-area';
    const now=new Date();
    const mFrom=document.getElementById('g-fixed-from');
    const mTo=document.getElementById('g-fixed-to');
    if(mFrom&&!mFrom.value)
      mFrom.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    if(mTo&&!mTo.value){
      const lastDay=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
      mTo.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    }
    renderGardensFixed();
    setTimeout(_fitScrollAreas,50);
    return;
  }
  // gan / sch
  gBody.className='ggrid scroll-area';
  const gClsEl = window.getEl ? window.getEl('g-cls') : document.getElementById('g-cls');
  if (gClsEl) gClsEl.value=t==='gan'?'╫ע╫á╫ש╫¥':'╫ס╫ש╫פ"╫í';
  renderGardens();
}

// ΓפאΓפא Fixed-schedule view ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא
const HEB_DAYS_SHORT=['╫¿╫נ╫⌐╫ץ╫ƒ','╫⌐╫á╫ש','╫⌐╫£╫ש╫⌐╫ש','╫¿╫ס╫ש╫ó╫ש','╫ק╫₧╫ש╫⌐╫ש','╫⌐╫ש╫⌐╫ש','╫⌐╫ס╫¬'];

function getGardenFixedSched(gardenId, fromDate, toDate){
  if(!confirm('האם לשחזר נתונים מקובץ גיבוי זה?\nהפעולה תדרוס את כל הנתונים המקומיים.')) return;
  _safeLS.setItem('ganv5',JSON.stringify(data));
  if(parsed.snaps) _safeLS.setItem('ganv5_snaps',JSON.stringify(parsed.snaps));
  if(parsed.todos) _safeLS.setItem('ganv5_todos',JSON.stringify(parsed.todos));
  showToast('✅ הנתונים שוחזרו. מרענן...');
  const gardenEvs = SCH.filter(s=>{
    if(s.g!==gardenId) return false;
    if(s.st&&s.st!=='ok') return false;
    if(fromDate && s.d < fromDate) return false;
    if(toDate   && s.d > toDate)   return false;
    return true;
  });
  // Strategy 1: use _recId groups (take latest occurrence per series)
  const byRecId = {};
  gardenEvs.filter(s=>s._recId).forEach(s=>{
    if(!byRecId[s._recId] || s.d > byRecId[s._recId].d) byRecId[s._recId]=s;
  });
  const fromRecurring = Object.values(byRecId);
  // Strategy 2: if no _recId, find entries that repeat same dow+supplier+time
  const fromRepeat = [];
  if(fromRecurring.length===0){
    const slotCount = {};
    gardenEvs.forEach(s=>{
      const dow = new Date(s.d).getDay();
      const key = `${dow}|${supBase(s.a)||s.a}|${(s.t||'').slice(0,5)}`;
      if(!slotCount[key]) slotCount[key]={count:0, latest:s};
      slotCount[key].count++;
      if(s.d > slotCount[key].latest.d) slotCount[key].latest=s;
    });
    Object.values(slotCount).filter(v=>v.count>=2).forEach(v=>fromRepeat.push(v.latest));
  }
  const result = fromRecurring.length>0 ? fromRecurring : fromRepeat;
  return result.sort((a,b)=>{
    const da=new Date(a.d).getDay(), db=new Date(b.d).getDay();
    if(da!==db) return da-db;
    return (a.t||'').localeCompare(b.t||'');
  });
}

function renderGardensFixed(){
  const cityF=(document.getElementById('g-city')||{}).value||'';
  const srch=((document.getElementById('g-srch')||{}).value||'').toLowerCase();
  const fixedFromEl=document.getElementById('g-fixed-from');
  const fixedToEl=document.getElementById('g-fixed-to');
  const fixedFrom=fixedFromEl?fixedFromEl.value:'';
  const fixedTo=fixedToEl?fixedToEl.value:'';
  const allG=[...GARDENS,...(_GARDENS_EXTRA||[])].filter(g=>{
    if(gcls(g)!=='╫ע╫á╫ש╫¥') return false;
    if(cityF&&g.city!==cityF) return false;
    if(srch&&![(g.name||''),(g.city||'')].some(x=>x.toLowerCase().includes(srch))) return false;
    return true;
  });
  const byCity={};
  allG.forEach(g=>{ const c=g.city||'╫נ╫ק╫¿'; if(!byCity[c]) byCity[c]=[]; byCity[c].push(g); });
  const sortedCities=Object.keys(byCity).sort((a,b)=>a.localeCompare(b,'he'));

  let h='';
  sortedCities.forEach(city=>{
    const gardens = byCity[city];
    const paired=new Set(), groups=[];
    [...gardens].sort((a,b)=>(a.name||'').localeCompare(b.name||'','he')).forEach(g=>{
      if(paired.has(g.id)) return;
      const pid=gardenPair(g.id);
      const partner=pid?allG.find(x=>x.id===pid):null;
      if(partner){ paired.add(g.id); paired.add(partner.id); groups.push({type:'pair',gardens:[g,partner]}); }
      else groups.push({type:'solo',gardens:[g]});
    });

    h+=`<details class="city-accordion">
      <summary>
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <span style="font-weight:800; color:#2d3748;">≡ƒןש∩╕ן ${city} (${gardens.length} ╫ע╫á╫ש╫¥)</span>
          <span style="font-size:0.8rem; color:#718096;">╫£╫ק╫Ñ ╫£╫ñ╫ש╫¿╫ץ╫ר</span>
        </div>
      </summary>
      <div class="city-accordion-content">`;

    groups.forEach(group=>{
      if(group.type==='pair'){
        h+=`<div style="background:#f3e5f5;border-radius:6px;padding:3px 10px;margin-bottom:5px;font-size:.72rem;color:#6a1b9a;font-weight:700">≡ƒפק ${group.gardens[0].name} + ${group.gardens[1].name}</div>`;
        group.gardens.forEach(g=>{ h+=_renderGardenFixedRow(g); });
      } else {
        h+=_renderGardenFixedRow(group.gardens[0]);
      }
    });
    h+='</div></details>';
  });

  document.getElementById('g-body').innerHTML=h||'<p style="color:#999;padding:20px">╫£╫נ ╫á╫₧╫ª╫נ╫ץ ╫ª╫פ╫¿╫ץ╫á╫ש╫¥</p>';
}

function _renderGardenFixedRow(g){
  const _fFrom=(document.getElementById('g-fixed-from')||{}).value||'';
  const _fTo=(document.getElementById('g-fixed-to')||{}).value||'';
  const fixedEvs=getGardenFixedSched(g.id, _fFrom, _fTo);
  const gid=g.id;
  let rows='';
  if(fixedEvs.length){
    fixedEvs.forEach(s=>{
      const dow=new Date(s.d).getDay();
      const supN=supBase(s.a)||s.a||'╫£╫£╫נ ╫⌐╫¥';
      const actN=s.act||supAct(s.a)||'';
      const time=s.t?s.t.slice(0,5):'Γאפ';
      const key = s._recId || `${s.a}_${s.act}_${dow}`;
      
      // Look for partner info
      let partnerInfo = '<span style="color:#90a4ae">Γאפ</span>';
      const pair = window.gardenPair(gid);
      if (pair) {
        const partnerId = pair.ids.find(id => Number(id) !== Number(gid));
        if (partnerId) {
          const pg = window.G(partnerId);
          const pev = window.SCH.find(ps => Number(ps.g) === Number(partnerId) && ps.d === s.d && window.supBase(ps.a) === window.supBase(s.a));
          partnerInfo = `<span style="font-weight:700;color:var(--c-secondary)">${pg.name}</span> ${pev ? '<span style="font-size:var(--fs-small);color:var(--c-text-light)">('+window.fT(pev.t)+')</span>' : '<span style="color:var(--c-error);font-size:var(--fs-small)">(╫£╫נ ╫₧╫⌐╫ץ╫ס╫Ñ)</span>'}`;
        }
      }

      rows+=`<tr style="border-bottom:1px solid #eef0fb">
        <td style="padding:3px 10px;font-weight:600;color:#1a237e;white-space:nowrap">╫ש╫ץ╫¥ ${HEB_DAYS_SHORT[dow]}</td>
        <td style="padding:3px 10px;color:#2e7d32;font-weight:600;white-space:nowrap">${time}</td>
        <td style="padding:3px 10px;color:#222">${supN}${actN?' Γאפ '+actN:''}</td>
        <td style="padding:3px 10px;color:var(--c-secondary);font-size:var(--fs-small)">${s.tp||'╫ק╫ץ╫ע'}</td>
        <td style="padding:3px 10px;font-size:var(--fs-small)">${partnerInfo}</td>
        <td style="padding:2px 6px;white-space:nowrap">
          <button onclick="event.stopPropagation();openGM(${gid});setTimeout(()=>window.openBulkUpdateRecurring('${key}',${gid}),100)" style="background:#e8eaf6;border:none;border-radius:4px;padding:2px 7px;font-size:.68rem;cursor:pointer;color:#3949ab" title="╫ó╫¿╫ץ╫ת ╫⌐╫ש╫ס╫ץ╫Ñ ╫º╫ס╫ץ╫ó (╫í╫ף╫¿╫פ)">Γ£ן∩╕ן</button>
          <button onclick="event.stopPropagation();openSP('${s.id}')" style="background:#ffebee;border:none;border-radius:4px;padding:2px 7px;font-size:.68rem;cursor:pointer;color:#c62828;margin-right:2px" title="╫ס╫ש╫ר╫ץ╫£/╫פ╫ק╫¿╫ע╫פ ╫ק╫ף ╫ñ╫ó╫₧╫ש╫¬">Γ¥ל</button>
        </td>
      </tr>`;
    });
  } else {
    rows=`<tr><td colspan="4" style="padding:5px 10px;color:#bbb;font-size:.72rem;font-style:italic">╫נ╫ש╫ƒ ╫⌐╫ש╫ס╫ץ╫Ñ ╫º╫ס╫ץ╫ó</td></tr>`;
  }
  return `<div style="display:flex;margin-bottom:7px;border:1px solid #e3e7f5;border-radius:8px;overflow:hidden">
    <div style="background:#f5f7ff;padding:8px 10px;min-width:120px;max-width:140px;display:flex;flex-direction:column;justify-content:space-between;border-left:1px solid #e3e7f5">
      <div style="font-weight:800;color:var(--c-primary);font-size:var(--fs-card-title);margin-bottom:6px">${g.name}</div>
      <div style="display:flex;flex-direction:column;gap:3px;margin-top:4px">
        <button class="btn bp bsm" style="font-size:.62rem;padding:2px 5px" onclick="openGM(${gid})">≡ƒףג ╫¢╫¿╫ר╫ש╫í</button>
        <button class="btn bo bsm" style="font-size:.62rem;padding:2px 5px" onclick="_goToGardenSched(${gid})">≡ƒףו ╫⌐╫ש╫ס╫ץ╫ª╫ש╫¥</button>
      </div>
    </div>
    <div style="flex:1;overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:.78rem">
        <thead><tr style="background:#eef2ff">
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700">╫ש╫ץ╫¥</th>
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700">╫⌐╫ó╫פ</th>
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700">╫í╫ñ╫º / ╫ñ╫ó╫ש╫£╫ץ╫¬</th>
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700">╫í╫ץ╫ע</th>
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700">╫ע╫ƒ ╫ס╫ƒ-╫צ╫ץ╫ע</th>
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700"></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function _goToGardenSched(gardenId){
  ST('sched');
  setTimeout(()=>{
    const sel=document.getElementById('s-g1');
    if(sel){ sel.value=gardenId; renderSched(); }
  },250);
}
var _gardensTab='gan';
// ΓפאΓפאΓפא ADD PLACE ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא
function openAddGardenModal(){
  document.getElementById('ap-name').value='';
  document.getElementById('ap-addr').value='';
  document.getElementById('ap-co').value='';
  document.getElementById('ap-coph').value='';
  document.getElementById('ap-notes').value='';
  document.getElementById('ap-cls').value=_gardensTab==='sch'?'╫ס╫ש╫פ"╫í':'╫ע╫á╫ש╫¥';
  const apCity=document.getElementById('ap-city');
  apCity.innerHTML='<option value="">╫ס╫ק╫¿ ╫ó╫ש╫¿...</option>';
  cities().forEach(c=>apCity.innerHTML+=`<option value='${c}'>${c}</option>`);
  (document.getElementById('addplace-title')||{}).textContent ='Γ₧ץ ╫פ╫ץ╫í╫ú '+(_gardensTab==='sch'?'╫ס╫ש╫¬ ╫í╫ñ╫¿':'╫ª╫פ╫¿╫ץ╫ƒ / ╫ע╫ƒ');
  document.getElementById('addplace-m').classList.add('open');
}
function saveNewPlace(){
  const name=document.getElementById('ap-name').value.trim();
  const city=document.getElementById('ap-city').value;
  if(!name||!city){window.spAlert('╫ש╫⌐ ╫£╫₧╫£╫נ ╫⌐╫¥ ╫ץ╫ó╫ש╫¿');return;}
  const newId=Math.max(...GARDENS.map(g=>g.id),0)+Date.now()%100000;
  const newG={
    id:newId,
    name,
    city,
    st:document.getElementById('ap-addr').value.trim(),
    co:document.getElementById('ap-co').value.trim(),
    coph:document.getElementById('ap-coph').value.trim(),
    notes:document.getElementById('ap-notes').value.trim(),
    cls:document.getElementById('ap-cls').value
  };
  _GARDENS_EXTRA.push(newG);
  if(!supEx['__gardens_extra']) supEx['__gardens_extra']=[];
  supEx['__gardens_extra']=_GARDENS_EXTRA;
  save();CM('addplace-m');refresh();
  window.spAlert('Γ£ו '+name+' ╫á╫ץ╫í╫ú ╫ס╫פ╫ª╫£╫ק╫פ!');
}

// ΓפאΓפאΓפא Mobile nav ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא
function mobNav(btn){
  document.querySelectorAll('#mob-nav .mob-nav-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
}
function mobNavPurch(btn){
  document.querySelectorAll('#mob-nav-purch .mob-nav-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
}

// ΓפאΓפאΓפא Data backup / restore ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא
function exportData(){
  const data=_safeLS.getItem('ganv5')||'{}';
  const snaps=_safeLS.getItem('ganv5_snaps')||'[]';
  const todos=_safeLS.getItem('ganv5_todos')||'[]';
  const blob=new Blob([JSON.stringify({data:JSON.parse(data),snaps:JSON.parse(snaps),todos:JSON.parse(todos),ts:Date.now()},null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='kids_backup_'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Γ£ו ╫ע╫ש╫ס╫ץ╫ש ╫פ╫ץ╫¿╫ף ╫ס╫פ╫ª╫£╫ק╫פ');
}
function importData(){
  const inp=document.createElement('input');
  inp.type='file';inp.accept='.json';
  inp.onchange=e=>{
    const file=e.target.files[0];if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const parsed=JSON.parse(ev.target.result);
        const data=parsed.data||parsed; // support both formats
        if(!confirm('Γתá∩╕ן ╫ש╫ש╫ס╫ץ╫נ ╫ש╫ק╫£╫ש╫ú ╫נ╫¬ ╫¢╫£ ╫פ╫á╫¬╫ץ╫á╫ש╫¥ ╫פ╫á╫ץ╫¢╫ק╫ש╫ש╫¥.\n╫פ╫₧╫⌐╫ת?')) return;
        _safeLS.setItem('ganv5',JSON.stringify(data));
        if(parsed.snaps) _safeLS.setItem('ganv5_snaps',JSON.stringify(parsed.snaps));
        if(parsed.todos) _safeLS.setItem('ganv5_todos',JSON.stringify(parsed.todos));
        showToast('Γ£ו ╫פ╫á╫¬╫ץ╫á╫ש╫¥ ╫ש╫ץ╫ס╫נ╫ץ. ╫ר╫ץ╫ó╫ƒ ╫₧╫ק╫ף╫⌐...');
        setTimeout(()=>location.reload(),1200);
      }catch(err){window.spAlert('╫⌐╫ע╫ש╫נ╫פ ╫ס╫º╫ץ╫ס╫Ñ ╫פ╫ע╫ש╫ס╫ץ╫ש: '+err.message);}
    };
    reader.readAsText(file);
  };
  inp.click();
}


function showToast(msg,ms=2500){
  let t=document.getElementById('toast-msg');
  if(!t){t=document.createElement('div');t.id='toast-msg';
    t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(30,30,30,.92);color:#fff;padding:9px 20px;border-radius:20px;font-size:.82rem;z-index:9999;pointer-events:none;transition:opacity .3s;white-space:nowrap';
    document.body.appendChild(t);}
  t.textContent=msg;t.style.opacity='1';
  clearTimeout(t._t);t._t=setTimeout(()=>t.style.opacity='0',ms);
}

// ΓפאΓפאΓפא PWA Service Worker registration ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא
if('serviceWorker' in navigator){
  const swCode=`
const CACHE='kids-v1';
const ASSETS=[location.pathname];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('fetch',e=>e.respondWith(
  caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
    if(res.ok){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));}
    return res;
  }).catch(()=>caches.match(e.request)))
));
self.addEventListener('activate',e=>e.waitUntil(
  caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
));`;
  try{
    const blob=new Blob([swCode],{type:'application/javascript'});
    const swUrl=URL.createObjectURL(blob);
    navigator.serviceWorker.register(swUrl).catch(()=>{});
  }catch(e){}
}



/* ΓץנΓץנ Universal filter toggle (desktop + mobile) ΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנΓץנ */
window.fltToggle = function(wrapId, btnId) {
  const wrap = document.getElementById(wrapId);
  const btn  = document.getElementById(btnId);
  if (!wrap) return;
  const open = wrap.classList.toggle('open');
  if (btn) btn.classList.toggle('open', open);
};
/* Legacy alias */
window.mobToggleFilters = function(id) { window.fltToggle(id, id+'-btn'); };
// Get the phone number to display in schedule for a supplier
function getSupPhone(name){
  const base=supBase(name);
  const ex=supBaseEx(base);
  const schedPhone=ex.schedPhone||'ph1';
  if(schedPhone==='ph2'&&ex.ph2) return ex.ph2;
  const s=SUPBASE.find(x=>supBase(x.name)===base)||{};
  return ex.ph1||s.phone||'';
}


function togglePiFlt(){
  const body=document.getElementById('pi-flt-body');
  const arrow=document.getElementById('pi-flt-arrow');
  if(!body) return;
  const isOpen=body.classList.toggle('open');
  if(arrow) arrow.classList.toggle('open',isOpen);
}
// On desktop: always show filter, on mobile default collapsed
(function(){
  function initPiFlt(){
    const body=document.getElementById('pi-flt-body');
    const header=document.getElementById('pi-flt-header');
    if(!body) return;
    if(window.innerWidth>768){
      body.style.display='flex';
      if(header) header.style.cursor='default';
      const arrow=document.getElementById('pi-flt-arrow');
      if(arrow) arrow.style.display='none';
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initPiFlt);
  else initPiFlt();
  window.addEventListener('resize',()=>{
    const body=document.getElementById('pi-flt-body');
    const arrow=document.getElementById('pi-flt-arrow');
    if(!body) return;
    if(window.innerWidth>768){ body.style.display='flex'; if(arrow) arrow.style.display='none'; }
    else { if(!body.classList.contains('open')) body.style.display=''; if(arrow) arrow.style.display=''; }
  });
})();

// Mobile: tap Firebase button = immediate sync + show modal
async function mobileQuickSync(){
  const btn = document.getElementById('od-btn');
  if(btn){ btn.textContent='≡ƒפה ╫₧╫í╫á╫¢╫¿╫ƒ...'; btn.style.background='#e65100'; }
  try{
    // Force token refresh Γאפ critical after Rules change
    if(window._fbUser){
      try{ window._cachedToken = await window._fbUser.getIdToken(true); }
      catch(te){ console.warn('Token refresh failed:', te.message); }
    }
    const ok = await loadFromFirebase(false, true);
    await saveToFirebase(false);
    showToast(ok ? 'Γ£ו ╫í╫ץ╫á╫¢╫¿╫ƒ ╫ó╫¥ Firebase' : 'Γתá∩╕ן ╫ר╫ó╫ש╫á╫פ ╫á╫¢╫⌐╫£╫פ Γאפ ╫ס╫ף╫ץ╫º ╫ק╫ש╫ס╫ץ╫¿');
  } catch(e){
    showToast('Γ¥ל ╫⌐╫ע╫ש╫נ╫¬ ╫í╫á╫¢╫¿╫ץ╫ƒ: ' + e.message);
    console.error('Sync error:', e);
  }
  _fbUpdateStatus();
}

// ΓפאΓפא Invoice status multi-select filter ΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפאΓפא
const PI_ST_KEY = 'pi_status_filter';

function _getPiStSelected(){
  return [...document.querySelectorAll('.pi-st-cb:checked')].map(c=>c.value);
}

function _setPiStLabel(){
  const sel = _getPiStSelected();
  const lbl = document.getElementById('pi-status-label');
  if(!lbl) return;
  const names = {'order':'╫פ╫צ╫₧╫á╫פ','tx_invoice':'╫ק╫⌐╫ס╫ץ╫á╫ש╫¬ ╫ó╫í╫º╫פ','tax_invoice':'╫ק╫⌐╫ס╫ץ╫á╫ש╫¬ ╫₧╫í','tax_receipt':'╫ק╫⌐╫ס╫ץ╫á╫ש╫¬ ╫₧╫í ╫º╫ס╫£╫פ','receipt':'╫º╫ס╫£╫פ','cancelled':'╫₧╫ס╫ץ╫ר╫£'};
  if(!sel.length) lbl.textContent='╫פ╫¢╫£';
  else if(sel.length===1) lbl.textContent=names[sel[0]]||sel[0];
  else lbl.textContent=`${sel.length} ╫í╫ר╫ר╫ץ╫í╫ש╫¥`;
}

function piStChange(){
  // If all 6 checked Γזע show "╫פ╫¢╫£"
  const all = document.querySelectorAll('.pi-st-cb');
  const checked = document.querySelectorAll('.pi-st-cb:checked');
  const allCb = document.getElementById('pi-st-all');
  if(allCb) allCb.checked = checked.length === all.length;
  _setPiStLabel();
  // Save to localStorage
  try{
    const _piSt = JSON.stringify(_getPiStSelected());
    _safeLS.setItem(PI_ST_KEY, _piSt);
    const _tok = window._cachedToken;
    if(_tok) fetch('https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data/piStatusFilter.json?auth='+_tok,{
      method:'PUT', headers:{'Content-Type':'application/json'}, body:_piSt
    }).catch(()=>{});
  }catch(e){}
  renderInvoices();
}

function piStAll(cb){
  document.querySelectorAll('.pi-st-cb').forEach(c=>c.checked=cb.checked);
  _setPiStLabel();
  try{
    const _piStC = JSON.stringify(cb.checked?[]:[]);
    _safeLS.setItem(PI_ST_KEY, _piStC);
    const _tok2 = window._cachedToken;
    if(_tok2) fetch('https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data/piStatusFilter.json?auth='+_tok2,{
      method:'PUT', headers:{'Content-Type':'application/json'}, body:_piStC
    }).catch(()=>{});
  }catch(e){}
  renderInvoices();
}

function togglePiStatusMenu(){
  const menu = document.getElementById('pi-status-menu');
  if(!menu) return;
  const isOpen = menu.style.display !== 'none';
  if(isOpen){ menu.style.display='none'; return; }
  menu.style.display='block';
  // Close on outside click
  setTimeout(()=>{
    function close(e){
      const btn=document.getElementById('pi-status-btn');
      if(!menu.contains(e.target)&&!btn?.contains(e.target)){
        menu.style.display='none';
        document.removeEventListener('click',close);
      }
    }
    document.addEventListener('click',close);
  },10);
}

function initPiStatusFilter(){
  // Load saved selection
  try{
    // Load from Firebase first, fallback to localStorage
    const _fbPiSt = window._fbAppData && window._fbAppData.piStatusFilter;
    const saved = _fbPiSt || JSON.parse(_safeLS.getItem(PI_ST_KEY)||'null');
    if(_fbPiSt) _safeLS.setItem(PI_ST_KEY, JSON.stringify(_fbPiSt)); // sync to local
    if(saved && Array.isArray(saved) && saved.length>0){
      document.querySelectorAll('.pi-st-cb').forEach(cb=>{
        cb.checked = saved.includes(cb.value);
      });
    } else {
      // Default: all unchecked = show all
    }
  }catch(e){}
  _setPiStLabel();
}

// Call after DOM ready
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', initPiStatusFilter);
} else { initPiStatusFilter(); }

window.getEl = function(id) {
  if (window.isMobileMode()) {
    return document.getElementById(id + '-mobile') || document.getElementById(id + '-desktop') || document.getElementById(id);
  }
  return document.getElementById(id + '-desktop') || document.getElementById(id + '-mobile') || document.getElementById(id);
};

window.syncDashDate = function(val) {
  const d = document.getElementById('dash-date-desktop');
  const m = document.getElementById('dash-date-mobile');
  if (d) d.value = val;
  if (m) m.value = val;
};

function dashNavDate(d){
  const el = window.getEl('dash-date');
  if(!el) return;
  let newVal = '';
  if(d===0){ newVal = window.td(); }
  else if(d===999){ newVal = ''; }
  else {
    const cur = el.value ? window.s2d(el.value) : new Date();
    newVal = window.d2s(window.addD(cur, d));
  }
  window.syncDashDate(newVal);
  if(window.renderDash) window.renderDash();
}

// _listGroupMode handled globally in data.js / cal.js

function _tryOpenLocalFile(p){
  // Try multiple methods to open a local path
  // Method 1: file:// URL (works in some browsers with local file access)
  const fileUrl = p.startsWith('\\\\') 
    ? 'file:' + p.replace(/\\/g,'/') 
    : p.replace(/\\/g,'/').replace(/^([A-Za-z]):/, 'file:///$1:');
  
  // Method 2: Try window.open with file://
  const w = window.open(fileUrl, '_blank');
  if(w){
    setTimeout(()=>{
      // If nothing happened (blocked), show instructions
      showToast('≡ƒףג ╫á╫í╫פ ╫£╫ñ╫¬╫ץ╫ק Γאפ ╫נ╫¥ ╫£╫נ ╫á╫ñ╫¬╫ק, ╫פ╫ó╫¬╫º ╫נ╫¬ ╫פ╫á╫¬╫ש╫ס ╫ץ╫ñ╫¬╫ק ╫ש╫ף╫á╫ש╫¬');
    }, 800);
  } else {
    // Popup blocked Γאפ copy path and instruct
    _copyToClipboard(p);
    showToast('≡ƒףכ ╫פ╫á╫¬╫ש╫ס ╫פ╫ץ╫ó╫¬╫º Γאפ ╫ñ╫¬╫ק ╫í╫ש╫ש╫¿ ╫º╫ס╫ª╫ש╫¥ ╫ץ╫פ╫ף╫ס╫º');
  }
}

// Global Bridge for core helpers
window.G = G;
window.gcls = gcls;
window.d2s = d2s;
window.s2d = s2d;
window.fD = fD;
window.fT = fT;
window.addD = addD;
window.monStart = monStart;
window.dayN = dayN;
window.td = td;
window.stLabel = stLabel;
window.stClass = stClass;
window.gardenPair = gardenPair;
window.showToast = showToast;
window.ST = ST;
window.askYesNo = (msg, onYes) => {
  const m = document.getElementById('askm');
  if(!m) return;
  document.getElementById('ask-msg').innerText = msg;
  const y = document.getElementById('ask-yes');
  const n = document.getElementById('ask-no');
  y.onclick = () => { CM('askm'); if(onYes) onYes(); };
  n.onclick = () => { CM('askm'); };
  m.classList.add('open');
};

window.getBlockedInfo = getBlockedInfo;
window.openSP = window.openSP || (()=>{});
// qSetSt removed - use the one in activity.js

window.getGardenBlock = getGardenBlock;

// ΓפאΓפא Year Management ΓפאΓפא
window.initYearSelector = function() {
  const sel = document.getElementById('year-selector');
  if (!sel) return;
  try {
    const metaStr = window._safeLS.getItem('ganv5_meta');
    if (metaStr) {
      const meta = JSON.parse(metaStr);
      const yearKeys = Object.keys(meta.years || {});
      sel.innerHTML = '';
      yearKeys.forEach(k => {
        const v = meta.years[k];
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = v.name || k;
        if (k === window.CURRENT_YEAR) opt.selected = true;
        sel.appendChild(opt);
      });
      // Only show selector if more than 1 year exists
      sel.style.display = yearKeys.length > 1 ? '' : 'none';
    }
  } catch(e) {}
  
  // Show archive warning banner if viewing a non-latest year
  _showArchiveBanner();
};

function _showArchiveBanner() {
  // Remove existing banner if any
  const existing = document.getElementById('archive-year-banner');
  if (existing) existing.remove();
  
  try {
    const metaStr = window._safeLS.getItem('ganv5_meta');
    if (!metaStr) return;
    const meta = JSON.parse(metaStr);
    const yearKeys = Object.keys(meta.years || {});
    if (yearKeys.length <= 1) return; // Only one year Γאפ no banner needed
    
    // Find the "latest" year (last in the order)
    const latestYear = yearKeys[yearKeys.length - 1];
    if (window.CURRENT_YEAR === latestYear) return; // We're on the latest Γאפ no banner
    
    const yearName = (meta.years[window.CURRENT_YEAR] || {}).name || window.CURRENT_YEAR;
    const banner = document.createElement('div');
    banner.id = 'archive-year-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(135deg,#fff3e0,#ffe0b2);border-bottom:3px solid #e65100;padding:8px 16px;display:flex;align-items:center;justify-content:center;gap:10px;font-size:.82rem;font-weight:700;color:#bf360c;box-shadow:0 2px 8px rgba(0,0,0,.15)';
    banner.innerHTML = `Γתá∩╕ן ╫נ╫¬╫פ ╫ª╫ץ╫ñ╫פ/╫ó╫ץ╫¿╫ת ╫נ╫¬ <span style="background:#e65100;color:#fff;border-radius:6px;padding:2px 8px;font-size:.78rem">${yearName}</span> Γאפ ╫⌐╫á╫פ ╫נ╫¿╫¢╫ש╫ץ╫á╫ש╫¬. ╫⌐╫ש╫á╫ץ╫ש╫ש╫¥ ╫ש╫ש╫⌐╫₧╫¿╫ץ ╫¿╫º ╫£╫⌐╫á╫פ ╫צ╫ץ.`;
    document.body.prepend(banner);
    // Push content down
    document.body.style.paddingTop = (banner.offsetHeight + 2) + 'px';
  } catch(e) {}
}

window.changeCurrentYear = function(year) {
  if (year === window.CURRENT_YEAR) return;
  try {
    const metaStr = window._safeLS.getItem('ganv5_meta');
    if (metaStr) {
      const meta = JSON.parse(metaStr);
      meta.currentYear = year;
      window._safeLS.setItem('ganv5_meta', JSON.stringify(meta));
      window.location.reload();
    }
  } catch(e) {}
};

document.addEventListener('DOMContentLoaded', window.initYearSelector);

// [End of core.js]
