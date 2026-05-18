window.APP_VERSION = '103.41';
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
        ${isCan ? '' : `<button title="ביטול" class="qbtn q-can" onclick="window.openCanQ('${sid}')">❌ ${window.isMobileMode()?'ביטול':''}</button>`}
        ${isNohap ? '' : `<button title="לא התקיים" class="qbtn q-nohap" onclick="window.qSetSt('${sid}','nohap')">⚠️ ${window.isMobileMode()?'לא התקיים':''}</button>`}
        <button title="דחייה" class="qbtn q-post" onclick="window.openPostpone('${sid}')">⏩ ${window.isMobileMode()?'דחייה':''}</button>
        <button title="קביעת השלמה" class="qbtn q-mu" onclick="window.openMakeupSched('${sid}')">📅 ${window.isMobileMode()?'השלמה':''}</button>
      </div>`;
  },

  /**
   * Renders a standardized activity row for tables (8 columns).
   */
  renderActivityRow: function(s, opts = {}) {
    const g = window.G(s.g) || {};
    const supBase = window.supBase(s.a);
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

    if (window.isMobileMode()) {
      return `
        <div class="mob-act-card ${stCls}" onclick="window.openSP('${s.id}')">
          <div class="mob-act-hdr">
            <span class="mob-act-time">${timeStr}</span>
            <span class="mob-act-garden">${g.name}${g.st ? ` <span style="font-size:0.72rem; color:#64748b; font-weight:400; margin-right:6px; display:inline-block">📍 ${g.st}</span>` : ''}</span>
            <span class="mob-act-status">${stLbl}</span>
          </div>
          <div class="mob-act-body">
            <div style="grid-column: span 2">
              👤 <b>${supBase}</b> ${phone ? `<span style="color:var(--c-success);font-weight:600;font-size:0.75rem;margin-right:6px">📞 ${phone}</span>` : ''}
            </div>
            <div style="grid-column: span 2">
              🎨 <b>${supAct}</b> ${evType ? `<span style="color:#78909c;font-size:0.75rem">(${evType})</span>` : ''} ${grpCount ? `<span style="background:#e8eaf6;color:#3f51b5;border-radius:4px;padding:1px 5px;font-size:0.68rem;margin-right:6px;font-weight:700;display:inline-block">${grpCount} קב'</span>` : ''}
            </div>
            ${(s.nt || isM) ? `
              <div style="grid-column: span 2; color:var(--c-error)">
                📝 ${isM ? `<span style="background:#ffe082;color:#b71c1c;border-radius:4px;padding:1px 4px;font-size:0.65rem;font-weight:800;margin-left:4px;display:inline-block">השלמה</span> ` : ''}${s.nt || ''}
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
      </td>`;

    // 3. Time (שעה)
    rowHtml += `
      <td class="p-8 text-center font-bold text-secondary">
        ${timeStr}
      </td>`;

    // 4. Supplier (ספק)
    rowHtml += `
      <td class="p-8 font-600 text-secondary">
        ${supBase} ${phone && context === 'dash' ? `<span class="text-xs text-success mr-2">📞 ${phone}</span>` : ''}
      </td>`;

    // 5. Activity Type (פעילות)
    rowHtml += `
      <td class="p-8" style="color:var(--c-info); font-weight:500">
        <div style="font-size:0.75rem; color:#78909c; margin-bottom:2px">${evType}</div>
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
        ${isM ? '<b style="color:var(--c-warning)">[השלמה]</b> ' : ''}${s.nt || ''}
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
    const weekBtn = `<button class="btn bo bsm font-bold" onclick="event.stopPropagation(); window.calJump('${isSolo ? '' : pair.id}','week','${isSolo ? gids[0] : ''}')">📅 שבוע</button>`;
    const monthBtn = `<button class="btn bo bsm font-bold" onclick="event.stopPropagation(); window.calJump('${isSolo ? '' : pair.id}','month','${isSolo ? gids[0] : ''}')">📅 חודש</button>`;
    const expBtn = `<button class="btn bg bsm font-bold" style="background:#25d366; color:#fff; border:none" onclick="event.stopPropagation(); window._exportPairWA(${JSON.stringify(gids)})">🗒️ הודעה</button>`;

    let tableRows = '';
    
    // Sort events by garden and time
    const sortedEvs = [...evs].sort((a,b) => {
      const gA = window.G(a.g), gB = window.G(b.g);
      return (gA.name||'').localeCompare(gB.name||'', 'he') || (a.t||'99:99').localeCompare(b.t||'99:99');
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
           <span class="icon" style="font-size:1.1rem; margin-left:4px">${isSolo ? '🏡' : '🔗'}</span>
           <span class="title" style="font-size:0.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; padding-left:8px">${pair.name}</span>
           <div style="display:flex; align-items:center; gap:4px; flex-shrink:0">
              <button class="btn bo bsm" style="font-size: 0.62rem !important; height: 22px !important; min-height: 22px !important; line-height: 20px !important; padding: 0 4px !important; border: 1px solid #1e88e5 !important; background: #fff !important; color: #1e88e5 !important; font-weight: 700 !important; border-radius: 4px !important; white-space: nowrap !important; margin: 0 !important; display: inline-flex !important; align-items: center !important; gap: 2px !important;" onclick="event.stopPropagation(); window.calJump('${isSolo ? '' : pair.id}','week','${isSolo ? gids[0] : ''}')">📅 שבוע</button>
              <button class="btn bo bsm" style="font-size: 0.62rem !important; height: 22px !important; min-height: 22px !important; line-height: 20px !important; padding: 0 4px !important; border: 1px solid #1e88e5 !important; background: #fff !important; color: #1e88e5 !important; font-weight: 700 !important; border-radius: 4px !important; white-space: nowrap !important; margin: 0 !important; display: inline-flex !important; align-items: center !important; gap: 2px !important;" onclick="event.stopPropagation(); window.calJump('${isSolo ? '' : pair.id}','month','${isSolo ? gids[0] : ''}')">📅 חודש</button>
              <button class="btn bg bsm" style="background: #25d366 !important; color: #fff !important; border: none !important; height: 22px !important; min-height: 22px !important; line-height: 22px !important; padding: 0 5px !important; font-size: 0.62rem !important; font-weight: 700 !important; border-radius: 4px !important; white-space: nowrap !important; margin: 0 !important; display: inline-flex !important; align-items: center !important; gap: 2px !important;" onclick="event.stopPropagation(); window._exportPairWA(${JSON.stringify(gids)})">📱 הודעה</button>
           </div>
        </summary>
        <div class="mob-content p-4">
           ${tableRows}
        </div>
      </details>`;
    }

    return `
    <div class="card standard-pair-card mb-4" style="border-top:4px solid ${clr.solid}; padding:0; border-radius:10px; overflow:hidden; background:#fff; box-shadow:0 4px 6px rgba(0,0,0,0.05); border:1px solid #e2e8f0; border-top-width:4px">
      <div class="flex-c gap-10 p-12" style="background:${clr.light}; border-bottom:1px solid #e2e8f0">
        <div class="flex-c gap-8">
          <span style="font-size:1.3rem">${isSolo ? '🏡' : '🔗'}</span>
          <div class="font-800 text-primary" style="font-size:var(--fs-card-title)">${pair.name}</div>
        </div>
        <div class="flex-c gap-8 mr-auto">
          ${weekBtn} ${monthBtn} ${expBtn}
        </div>
      </div>
      <div class="tw overflow-auto">
        <table class="w-full" style="border-collapse:collapse; font-size:var(--fs-small)">
          <thead>
          <tr style="background:#f8fafc; border-bottom:1px solid #e2e8f0; color:#64748b; font-weight:700; font-size:var(--fs-small)">
              ${context === 'dash' ? '<th style="width:35px; text-align:center; padding:10px"></th>' : ''}
              <th style="text-align:right; padding:8px 10px">צהרון</th>
              <th style="text-align:center; padding:8px 10px">שעה</th>
              <th style="text-align:right; padding:8px 10px">ספק</th>
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

// renderInvoices and refreshPurchDash moved to invoices.js


// ── Purch Suppliers panel ──────────────────────────────
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
// ── Purch supplier panel helpers (use index to avoid HTML escaping) ──
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
  if(!confirm('זה יאפס את רשימת הספקים הממוזגים ויבנה מחדש את כל הספקים. להמשיך?')) return;
  supEx['__merged_away']=[];
  // Also clear __c to rebuild from scratch
  supEx['__c']=[];
  repairAllSuppliers();
  save();
  setTimeout(()=>{ renderPurchSuppliers(); renderSup(); showToast('✅ ספקים אופסו ונבנו מחדש'); }, 200);
}

function renderPurchSuppliers(){
  const el = document.getElementById('psu-body');
  if(!el) return;
  if(typeof SUPBASE==='undefined'||!Array.isArray(SUPBASE)||SUPBASE.length===0){
    el.innerHTML='<div style="color:#aaa;padding:20px;text-align:center">טוען נתונים...</div>';
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
    el.innerHTML='<div style="color:#aaa;padding:30px;text-align:center">אין ספקים להצגה.<br><button class="btn bg" style="margin-top:10px" onclick="emergencyFixSuppliers()">🔧 בנה מחדש</button></div>';
    return;
  }

  if(_pSupView==='list'){
    // List view
    let h='<table style="width:100%;border-collapse:collapse;font-size:.83rem">'
      +'<thead><tr style="background:#e8eaf6;position:sticky;top:0">'
      +'<th style="padding:7px 10px;text-align:right">ספק</th>'
      +'<th style="padding:7px 8px;text-align:center">פעילויות</th>'
      +'<th style="padding:7px 8px;text-align:right">טלפון</th>'
      +'<th style="padding:7px 8px;text-align:right">סוג</th>'
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
        +`${isActSupplier(base)?' <span style="font-size:.65rem;color:#2e7d32">🎨</span>':''}`
        +`</td>`
        +`<td style="padding:6px 8px;text-align:center;color:#1565c0;font-weight:700">${isActSupplier(base)?cnt:'—'}</td>`
        +`<td style="padding:6px 8px;color:#2e7d32">${phone||'—'}</td>`
        +`<td style="padding:6px 8px;font-size:.76rem;color:#546e7a">${ex.entityType||''}</td>`
        +`<td style="padding:6px 8px;white-space:nowrap" onclick="event.stopPropagation()">`
        +`<button class="btn bp bsm" style="font-size:.65rem" onclick="psupNewInvoice(${idx})">📄 הזמנה</button> `
        +`<button class="btn bo bsm" style="font-size:.65rem" onclick="psupEdit(${idx})">✏️</button>`
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
          📚 ${base}
          ${isAct?'<span class="text-xs text-success rounded-6" style="background:#e8f5e9;padding:1px 5px;margin-right:4px">🎨</span>':''}
        </div>
        ${phone?`<div class="text-success text-sm font-600 mb-2">📞 ${phone}</div>`:''}
        ${acts.length&&isAct?`<div class="mb-2 flex-c flex-wrap gap-3">
          ${acts.map(a=>`<span class="text-xs font-600 text-secondary rounded-10" style="background:#e3f2fd;padding:2px 8px">🎯 ${a}</span>`).join('')}
        </div>`:''}
        ${ex.entityType?`<div class="text-xs mb-1" style="color:#6a1b9a">🏢 ${ex.entityType}</div>`:''}
        ${ex.notes?`<div class="text-xs text-light mb-1">📝 ${ex.notes}</div>`:''}
      </div>
      <div class="flex-c justify-between mt-2 pt-2" style="border-top:1px solid #f0f0f0">
        <span class="text-xs font-bold text-secondary">${isAct?`📅 ${cnt} פעילויות${cntDone?` · ✔️ ${cntDone}`:''}`:''}</span>
        <div class="flex-c gap-2 flex-none" onclick="event.stopPropagation()">
          <button class="btn bp bsm text-xs" onclick="psupNewInvoice(${idx})">📄 הזמנה</button>
          <button class="btn bo bsm text-xs" onclick="psupEdit(${idx})">✏️</button>
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
    // ═══ DIRECT MODE: Excel import was used — SRAWS is irrelevant ═══
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
      _isImported: x._isImported || false
    }));
  } else {
    // ═══ LEGACY MODE: Merge SRAWS with cloud changes ═══
    // 1. Map SRAWS by fuzzy key and ID for merging
    const srawsFuzzy = {};
    const srawsFuzzyById = {};
    const nuclearClean = (val) => {
      if(!val) return '';
      return String(val).replace(/\(.*\)/g, '').replace(/[^א-תa-zA-Z0-9]/g, '').toLowerCase();
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
      // and this SRAWS record didn't match anything above, it's a "Zombie" — skip it.
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
  if(Array.isArray(o.pairs)&&o.pairs.length>0){
    window.pairs = o.pairs.map(p=>({...p,ids:p.ids.map(id=>parseInt(id)).filter(id=>G(id).id)}));
    window.pairs = pairs.filter(p=>p.ids.length>=2);
  } else { initPairs(); }
  window.supEx = o.supEx || {};
  if(o.invoices){
    window.INVOICES = Array.isArray(o.invoices) ? o.invoices : Object.values(o.invoices);
    // ── Migrate invoices with double-VAT bug ──
    // Symptom: ordVatMode missing AND orderTotal ≈ orderAmt * (1 + vat/100)
    // Fix: set ordVatMode='inc', recalculate orderAmt (base) and orderTotal (= entered).
    INVOICES.forEach(inv=>{
      if(inv.ordVatMode) return; // already has mode — skip
      const vat = inv.vat||18;
      if(vat===0) return; // exempt — skip
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
  if(supEx['__gardens_extra']) _GARDENS_EXTRA=supEx['__gardens_extra'];
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
    if(window._fbAppData && typeof INVOICES!=='undefined' && INVOICES.length>0) {
      return; // data already in memory from _processFirebaseLoad
    }
    // Support migration from old Y1 system (ganv5_y_ keys)
    let st = null;
    try{ const meta=JSON.parse(_safeLS.getItem('ganv5_meta')||'null');
         if(meta&&meta.currentYear) st=_safeLS.getItem('ganv5_y_'+meta.currentYear); }catch(_){}
    if(!st) st = _safeLS.get('ganv5');
    if(!st && window._fbAppData) { _applyYearData(window._fbAppData); return; }
    if(st){ _applyYearData(JSON.parse(st)); }
    else { initPairs();window.clusters = JSON.parse(JSON.stringify(INIT_CLUSTERS));activeGardens = null; }
  }catch(e){
    console.warn('load() error:', e);
    if(window._fbAppData){ try{ _applyYearData(window._fbAppData); }catch(e2){} }
    else { initPairs();window.clusters = JSON.parse(JSON.stringify(INIT_CLUSTERS));activeGardens = null; }
  }
}
// ── migratePairsFromAuto — seeds AUTOPAIRS only on first-ever load ──

function migrateGardenPhones(){
  // Force-import all phones from xlsx — overwrite existing unless user manually edited
  // Versioned: if GARDEN_PHONES_VER already applied, skip
  const VER='v2';
  if(supEx.__phonesVer===VER) return;
  let count=0;
  Object.entries(GARDEN_PHONES).forEach(([id,ph])=>{
    const gid=parseInt(id);
    const key='g_'+gid;
    if(!supEx[key]) supEx[key]={};
    const ex=supEx[key];
    if(ex._cophManual) return; // user manually edited — preserve
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
  // No saved pairs — seed from AUTOPAIRS
  initPairs();
  save();
  console.log('Seeded pairs from AUTOPAIRS: '+pairs.length);
}
function resetPairsFromAuto(){
  if(!confirm('האם לרענן את הזוגות מהרשימה המובנית?\nזה ימחק עריכות ידניות שביצעת.')) return;
  initPairs();
  save();
  refresh();
  alert('✅ הזוגות עודכנו! '+pairs.length+' זוגות נטענו.');
}
const HOLIDAYS_RESTORE = [{"canSched":false,"city":"","from":"2026-03-31","id":"h_1774174272522","name":"חופשת פסח","note":"","scope":"all","to":"2026-04-08","type":"vacation"},{"canSched":false,"city":"","from":"2026-04-22","id":"h_1775731003564","name":"יום הזכרון לחללי מערכות ישראל","note":"","scope":"all","to":"2026-04-22","type":"vacation"},{"canSched":false,"city":"","from":"2026-04-23","id":"h_1775731019768","name":"יום העצמאות","note":"","scope":"all","to":"2026-04-23","type":"vacation"},{"canSched":false,"city":"","from":"2026-05-21","id":"h_1775731118232","name":"שבועות","note":"","scope":"all","to":"2026-05-21","type":"vacation"},{"canSched":false,"city":"גבעתיים","from":"2026-05-05","id":"h_1775731199678","name":"ל\"ג בעומר","note":"","scope":"ביה\"ס","to":"2026-05-05","type":"vacation"},{"canSched":true,"city":"","from":"2026-05-05","id":"h_1775731246284","name":"קייטנת ל\"ג בעומר","note":"","scope":"all","to":"2026-05-05","type":"camp"},{"canSched":true,"city":"גבעתיים","from":"2026-05-05","id":"h_1775731264839","name":"קייטנת ל\"ג בעומר","note":"","scope":"גנים","to":"2026-05-05","type":"camp"}];

function restoreMissingHolidays() {
  if (window.holidays && window.holidays.length === 0) {
    window.holidays = HOLIDAYS_RESTORE;
    return true;
  }
  return false;
}
function migrateSupActSplit(){
  // Run on every load — SCHEDULES_JS source data has "supplier - activity" format
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
  if(false){ showToast('⚠️ מצב ארכיון — לא ניתן לשמור שינויים'); return; }
  
  // CRITICAL: Block all saves (including localStorage) until the first Firebase load completes.
  // This prevents startup migrations from creating a "newer" local state that blocks the cloud load.
  if(!window._fbSyncReady && !immediate) {
    console.warn('save: blocked (Firebase not ready yet)');
    return false;
  }
  
  try{
    if(window.DataManager && window.DataManager.applyAutoMakeupMatching) {
      window.DataManager.applyAutoMakeupMatching();
    }
    // Save ALL entries with ALL fields — works with or without SRAWS
    const data={
      ch:(window.SCH||[]).map(s=>({id:s.id,g:s.g,d:s.d,a:s.a,t:s.t,p:s.p,n:s.n,st:s.st,cr:s.cr,cn:s.cn,nt:s.nt,pd:s.pd,pt:s.pt,grp:s.grp,act:s.act||'',_isMakeup:s._isMakeup||false,_makeupFrom:s._makeupFrom||'',_compByMakeup:s._compByMakeup||'',_fromD:s._fromD||''})),
      pairs:window.pairs||[],
      supEx:window.supEx||{},
      clusters:window.clusters||{},
      holidays:window.holidays||[],
      pairBreaks:window.pairBreaks||{},
      managers:window.managers||{},
      blockedDates:window.blockedDates||{},
      gardenBlocks:window.gardenBlocks||{},
      invoices:window.INVOICES||[],
      vatRate:window.VAT_RATE||18,
      activeGardens:window.activeGardens?[...window.activeGardens]:null,
      useSraws: typeof window.useSraws!=='undefined'?window.useSraws:true
    };
    const _json=JSON.stringify(data);
    _safeLS.setItem('ganv5',_json);
    window._mem_ganv5=_json; // ensure in-memory is also up to date
    // Also update year key if meta exists
    try{const _m=JSON.parse(_safeLS.getItem('ganv5_meta')||'null');if(_m&&_m.currentYear)_safeLS.setItem('ganv5_y_'+_m.currentYear,_json);}catch(_){}
    
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
        snaps.unshift({ts:Date.now(),label:'אוטומטי',size:d.length,data:d});
        if(snaps.length>20) snaps.length=20;
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
      name: gs.length > 0 ? gs.map(g => g.name).join(' + ') : 'זוג ללא שם'
    };
  }).filter(p => p.ids.length > 0);
}

// ══════════════════════════════════════════════════════════
// Y1 — Year Management Functions
// ══════════════════════════════════════════════════════════


function G(id){
  const gdns = window.GARDENS || [];
  return gdns.find(g=>Number(g.id)===Number(id)) || {};
}
function gcls(g){
  if (!g || !g.cls) return 'גנים';
  const c = g.cls.trim();
  // Support both standard quotes (") and Hebrew Gershayim (״)
  const isSchool = c.includes('בית') || c.includes('בי"ס') || c.includes('בי״ס') || 
                   c.includes('ביה"ס') || c.includes('ביה״ס') || c.includes('ביהס') || 
                   c.includes('ספר');
  
  if (c.includes('גן')) return 'גנים';
  if (isSchool) return 'ביה"ס';
  return 'גנים';
}
function gByCF(city,cls){return GARDENS.filter(g=>(!city||g.city===city)&&(!cls||gcls(g)===cls));}
function d2s(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');return`${y}-${m}-${dd}`}
function s2d(s){const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function fD(s){if(!s)return'';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`}
function fT(t){return t?t.slice(0,5):''}
function addD(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function addM(d,n){const x=new Date(d);x.setMonth(x.getMonth()+n);return x}
function monStart(d){const x=new Date(d);x.setDate(x.getDate()-x.getDay());x.setHours(0,0,0,0);return x}
function dayN(s){const[y,m,d]=s.split('-').map(Number);return['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][new Date(y,m-1,d).getDay()]}
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


// ── Hebrew Date (via built-in Intl API) ─────────────────────
const _hebFmt = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
  day: 'numeric', month: 'long', timeZone: 'UTC'
});
function toHebDate(ds) {
  try {
    const [y, m, d] = ds.split('-').map(Number);
    return _hebFmt.format(new Date(Date.UTC(y, m-1, d)));
  } catch(e) { return ''; }
}

function hebM(d){return['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'][d.getMonth()]+' '+d.getFullYear()}
function td(){return d2s(new Date())}
function cities(){return[...new Set(GARDENS.map(g=>g.city))].sort()}
function gardenPair(gid){const n=parseInt(gid);return pairs.find(p=>p.ids.map(x=>parseInt(x)).includes(n))||null}
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
  if(s.st==='can') return'<span class="bdg br2">❌ בוטל</span>';
  if(s.st==='done') return'<span class="bdg bg2">✔️ התקיים</span>';
  if(s.st==='post') return`<span class="bdg bor">⏩ נדחה ${s.pd?'→ '+fD(s.pd):''}</span>`;
  if(s.st==='nohap') return'<span class="bdg br2">⚠️ לא התקיים</span>';
  return'<span class="bdg bg2">🏫 מתקיים</span>';
}

// ── renderReadOnlyBanner (stub — no archive mode in this version) ──
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


// ── Dynamic scroll containers ──────────────────────────────────
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

// ── Sync supplier __c list from all data sources ──────────────────
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

// ── One-time migration v2: restore acts for merged suppliers ────
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
  if(fixed>0){ save(true); showToast('✅ שוחזרו פעילויות ל-'+fixed+' ספקים'); }
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

      // Load invoices explicitly — they live at a separate Firebase path
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
    if(calClsEl) calClsEl.value='גנים';
    const gClsEl=document.getElementById('g-cls');
    if(gClsEl) gClsEl.value='גנים';
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
  const cls = (tab === 'g' ? 'גנים' : 'ביה"ס');
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
    if (!g || !g.cls) return 'גנים';
    const c = g.cls.trim();
    if (c.includes('גן')) return 'גנים';
    if (c.includes('בית') || c.includes('בי"ס') || c.includes('ביה"ס') || c.includes('ביהס') || c.includes('ספר')) return 'ביה"ס';
    return 'גנים';
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
    const isHandled = !!(s._compByMakeup && s._compByMakeup !== "false") || !!((s.nt && /הוקדם ל|נדחה ל|הוזז ל|הקדמה ל|דחייה ל|עבר ל|עובר ל|הועבר ל/i.test(s.nt)) || (s.n && /הוקדם ל|נדחה ל|הוזז ל|הקדמה ל|דחייה ל|עבר ל|עובר ל|הועבר ל/i.test(s.n)));
    const isM = !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.nt)) || (s.n && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.n)) || (s.a && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.a)));
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
    const cls = (tab === 'g' ? 'גנים' : 'ביה"ס');
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
    }).map(g=>`<option value='${g.id}'>${prefix?g.city+' · ':''} ${g.name}</option>`).join('');
    
    ['', '-desktop', '-mobile'].forEach(suffix => {
      const el = document.getElementById(id + suffix);
      if (el) el.innerHTML = items;
    });
  }
  fC('dash-city');fC('cal-city');fC('s-city');fC('g-city');fC('apm-city');fC('pairs-city');fC('cl-city');
  // Filter dropdowns (search/filter): show ONLY act suppliers in חוגים views
  getAllSup().filter(s=>isActSupplier(s.name)).forEach(s=>{
    ['dash-sup','cal-sup','s-sup'].forEach(id=>{
      ['', '-desktop', '-mobile'].forEach(suffix => {
        const el = document.getElementById(id + suffix);
        if (el) el.innerHTML += `<option value='${s.name}'>${s.name}</option>`;
      });
    });
  });
  // Scheduling dropdowns: show ONLY act suppliers (isAct=true)
  getAllSup().filter(s=>isActSupplier(s.name)).forEach(s=>{
    ['ns-sup','es-sup'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML+=`<option value='${s.name}'>${s.name}</option>`;});
  });
  fG('cal-g1','כל הצהרונים',true);fG('cal-g2','—',true);fG('cal-g3','—',true);
  fG('s-g1','כל הצהרונים',true);fG('s-g2','—',true);fG('s-g3','—',true);
  fG('apm-g1','בחר צהרון',true);fG('apm-g2','בחר צהרון',true);fG('apm-g3','—',true);
  ['', '-desktop', '-mobile'].forEach(suffix => {
    const el = document.getElementById('cal-dp' + suffix);
    if (el) el.value = td();
  });
  // Default calendar to גנים tab
  ['', '-desktop', '-mobile'].forEach(suffix => {
    const el = document.getElementById('cal-cls' + suffix);
    if (el) el.value = 'גנים';
  });
}

window.TABS=['dash','cal','sched','gardens','pairs','holidays','clusters','sup','managers','admin'];
window.currentTab='dash';

// ─── GLOBAL NAVIGATION SEARCH ────────────────────────────────────────────────
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
      icon: gcls(g)==='ביה"ס'?'🏛️':'🏫',
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
      icon:'🏢',
      label: base,
      sub: isActSupplier(base)?'ספק חוגים':'ספק',
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
        icon:'📅',
        label:`${supBase(s.a)} — ${g?.name||''}`,
        sub: `${fD(s.d)} ${s.t?fT(s.t):''}`,
        action: `switchMode('act');ST('cal');setTimeout(()=>{goDate('${s.d}');setTimeout(()=>openSP('${s.id}'),200);},150);navSearchClose();`
      });
    });
  }

  if(!results.length){
    res.innerHTML='<div style="padding:10px 14px;color:#999;font-size:.82rem">לא נמצאו תוצאות</div>';
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
// ─────────────────────────────────────────────────────────────────────────────

function ST(t){
  currentTab=t;
  // Always close side panel + backdrop when switching tabs (critical for mobile)
  const _spEl=document.getElementById('sp');
  const _bdEl=document.getElementById('sp-backdrop');
  if(_spEl) _spEl.classList.remove('open');
  if(_bdEl) _bdEl.style.display='none';
  selEv=null;
  // Find the correct tab button by matching onclick attribute — not by index
  // (TABS array has hidden tabs like 'pairs','clusters','managers' that have no button)
  document.querySelectorAll('#tabs-act .tab').forEach(btn=>{
    const fn = btn.getAttribute('onclick')||'';
    btn.classList.toggle('active', fn.includes(`'${t}'`) || fn.includes(`"${t}"`));
  });
  // Hide all act panels + admin panel, show only active
  [...TABS, 'admin'].forEach(x=>{
    const panelEl=document.getElementById('p-'+x);
    if(panelEl){
      const isActive = x===t;
      panelEl.classList.toggle('active', isActive);
      // Remove inline display style — let CSS handle it via .panel/.panel.active
      panelEl.style.display='';
    }
  });
  // purch panels are managed by switchMode, not ST
  if(t==='admin'){
    // Hide purch panels (user may be coming from purch mode)
    PURCH_TABS.forEach(x=>{
      const panelEl=document.getElementById('p-'+x);
      if(panelEl){ panelEl.style.display='none'; panelEl.classList.remove('active'); }
    });
    // Switch mode visuals to 'act' mode styling (admin sits in act mode)
    document.body.classList.remove('mode-purch');
    document.getElementById('tabs-act')?.style && (document.getElementById('tabs-act').style.display='');
    document.getElementById('tabs-purch') && (document.getElementById('tabs-purch').style.display='none');
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
  cityEl.innerHTML='<option value="">בחר עיר...</option>';
  cities().forEach(c=>cityEl.innerHTML+=`<option value='${c}'>${c}</option>`);
  const fill=id=>{
    const el=document.getElementById(id);
    el.innerHTML='<option value="">ללא</option>';
    GARDENS.sort((a,b)=>a.name.localeCompare(b.name,'he')).forEach(g=>el.innerHTML+=`<option value='${g.id}'>${g.city} · ${g.name}</option>`);
  };
  fill('addg-partner');fill('addg-partner3');
  const clEl=document.getElementById('addg-cluster');
  clEl.innerHTML='<option value="">ללא אשכול</option><option value="__new__">➕ אשכול חדש...</option>';
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
  if(!name||!city){alert('יש למלא שם ועיר');return;}
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
    pairs.push({id:Date.now()+1,ids,name:pName});
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
  alert('✅ '+name+' נוסף בהצלחה!');
}
let _sucName=null;
// ── Supplier card: tab between activities and documents ─────────────
let _sucTab = 'acts'; // 'acts' | 'docs'

function setSucTab(tab){
  _sucTab = tab;
  document.getElementById('suc-tab-acts')?.classList.toggle('active', tab==='acts');
  document.getElementById('suc-tab-docs')?.classList.toggle('active', tab==='docs');
  document.getElementById('suc-acts-section').style.display = tab==='acts' ? '' : 'none';
  document.getElementById('suc-docs-section').style.display = tab==='docs' ? '' : 'none';
  // suc-body holds the schedule table — hide it when viewing docs
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
    // Pure חוגים: show only acts
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
    el.innerHTML='<div style="color:#aaa;text-align:center;padding:16px;font-size:.8rem">אין מסמכים</div>';
    if(totalEl) totalEl.textContent='';
    return;
  }
  const fmtSt = s=>{const m={order:'📋',tx_invoice:'🧾',tax_invoice:'📑',tax_receipt:'📑🧾',receipt:'📄',cancelled:'❌'};return m[s]||m[_migrateInvStatus(s)]||'📄';};
  const total = invs.reduce((s,i)=>s+(i.orderAmt||i.txAmt||i.amt||0),0);
  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:.78rem">
    <thead><tr style="background:#e8eaf6;position:sticky;top:0">
      <th style="padding:5px 8px;text-align:right">תאריך</th>
      <th style="padding:5px 8px;text-align:right">מסמך</th>
      <th style="padding:5px 8px;text-align:right">פירוט</th>
      <th style="padding:5px 8px;text-align:right;white-space:nowrap">סכום</th>
      <th style="padding:5px 8px;text-align:center">סטטוס</th>
      <th style="padding:5px 8px"></th>
    </tr></thead>
    <tbody>
    ${invs.map(inv=>{
      const d = inv.orderDate||inv.txDate||inv.date||'';
      const docNum = inv.orderNum||inv.txNum||inv.num||'—';
      const amt = inv.orderAmt||inv.txAmt||inv.amt||0;
      const amtStr = amt ? `₪${withVat(amt,inv.vat||18).toLocaleString()}` : '—';
      return `<tr style="border-bottom:1px solid #f0f0f0;cursor:pointer" onclick="CM('sucard-m');openNewInvoice(${inv.id})">
        <td style="padding:5px 8px;white-space:nowrap">${d?fD(d):'—'}</td>
        <td style="padding:5px 8px;font-weight:700;color:#1565c0">${docNum}</td>
        <td style="padding:5px 8px;color:#546e7a;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${inv.orderDesc||''}</td>
        <td style="padding:5px 8px;font-weight:700;color:#2e7d32;white-space:nowrap">${amtStr}</td>
        <td style="padding:5px 8px;text-align:center">${fmtSt(inv.status)}</td>
        <td style="padding:5px 8px" onclick="event.stopPropagation()"><button class="btn bo bsm" style="font-size:.65rem" onclick="CM('sucard-m');openNewInvoice(${inv.id})">✏️</button></td>
      </tr>`;
    }).join('')}
    </tbody></table>`;
  if(totalEl) totalEl.textContent = `${invs.length} מסמכים · סה"כ: ₪${total.toLocaleString()} לפני מע"מ`;
}

function sucOpenNewDoc(){
  CM('sucard-m');
  openNewInvoice(null, _sucName);
}

function sucExportDocs(){
  if(typeof exportSupPurchDocs==='function') exportSupPurchDocs(_sucName);
  else showToast('❌ יצוא לא זמין');
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
  const name=_sucName; // always base name e.g. "חוגות"
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
  if(isAct) sub += `${cnt} פעילויות · ${acts2.length} סוגים`;
  if(isPurch && invCnt>0) sub += (sub?' · ':'')+`${invCnt} מסמכי רכש`;
  (document.getElementById('suc-sub')||{}).textContent = sub||name;
  const typeFlags = [
    isActSupplier(name)?'<span class="sup-flag sup-flag-act">🎨 ספק חוגים</span>':'<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:.68rem;font-weight:700;background:#fce4ec;color:#c62828">🚫 לא מופיע בחוגים</span>',
    isPurchSupplier(name)?'<span class="sup-flag sup-flag-purch">🛒 ספק רכש</span>':'',
    ex.entityType?`<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:.68rem;font-weight:700;background:#f3e5f5;color:#6a1b9a">🏢 ${ex.entityType}</span>`:''
  ].filter(Boolean).join(' ');
  const typeFlagsEl = document.getElementById('suc-type-flags');
  if(typeFlagsEl) typeFlagsEl.innerHTML = typeFlags;
  document.getElementById('suc-info').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:.81rem">
      <div><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">📞 טלפון ראשי</div><div style="font-weight:700">${ex.ph1||s.phone||'—'}</div></div>
      ${ex.ph2?`<div><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">📞 טלפון נוסף</div><div style="font-weight:700">${ex.ph2}</div></div>`:'<div></div>'}
      ${ex.g1?`<div><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">🏛️ ח.פ. / עוסק</div><div style="font-weight:700">${ex.g1}</div></div>`:'<div></div>'}
      ${ex.moeTax?`<div><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">📚 מס' ספק חינוך</div><div style="font-weight:700">${ex.moeTax}</div></div>`:''}
      ${ex.contact?`<div><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">👤 איש קשר</div><div style="font-weight:700">${ex.contact}</div></div>`:''}
      ${ex.addr?`<div style="grid-column:1/-1"><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">📍 כתובת</div><div style="font-weight:700">${ex.addr}</div></div>`:''}
      <div style="grid-column:1/-1;display:${isActSupplier(name)?'block':'none'}">
        <div style="color:#546e7a;font-size:.69rem;margin-bottom:4px">🎯 סוגי פעילויות</div>
        ${acts.length
          ?acts.map(a=>`<span style="background:#e3f2fd;color:#1565c0;border-radius:12px;padding:2px 9px;font-size:.76rem;font-weight:600;margin-left:4px;margin-bottom:3px;display:inline-block">${a}</span>`).join('')
          :'<span style="color:#999;font-size:.76rem">לא הוגדרו פעילויות — לחץ ✏️ ערוך להוספה</span>'
        }
      </div>
      ${ex.notes?`<div style="grid-column:1/-1"><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">📝 הערות</div><div>${ex.notes}</div></div>`:''}
    </div>
    `;  // docs shown in suc-docs-section tab
}
function sucRefreshActFilt(){
  const acts=getSupActs(_sucName);
  const el=document.getElementById('suc-act-filt');
  if(!el) return;
  el.innerHTML='<option value="">הכל</option>'+acts.map(a=>`<option value='${a}'>${a}</option>`).join('');
}
function sucToggleEdit(){
  const ep=document.getElementById('suc-edit-panel');
  const vp=document.getElementById('suc-view');
  const showing=ep.style.display!=='none';
  if(showing){ ep.style.display='none'; vp.style.display='block'; return; }
  const name=_sucName; // base name, e.g. "חוגות"
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
        🎯 ${a}
        <button onclick="sucRemoveAct(${i})" style="background:none;border:none;color:#e53935;cursor:pointer;font-size:.8rem;padding:0;line-height:1" title="הסר פעילות">✕</button>
      </span>`).join('')
    :'<span style="color:#999;font-size:.75rem">לא נמצאו פעילויות — יתמלא אוטומטית מהנתונים</span>';
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
  if (!name) { alert('לא נמצא שם ספק'); return; }

  const activeCount = SCH.filter(s => s.a === name && s.st !== 'can').length;
  const totalCount  = SCH.filter(s => s.a === name).length;

  let msg = `למחוק את הספק "${name}"?\n`;
  if (totalCount > 0) {
    msg += `\nהספק קיים ב-${totalCount} פעילויות — הן יישמרו עם שמו.`;
  }
  msg += '\n\nהספק יוסר מרשימות הספקים אך לא מהפעילויות ההיסטוריות.';
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
  showToast('🗑️ ספק "' + name + '" הוסר — הפעילויות נשמרו');
}

function sucSaveEdit(){
  const nameEl=document.getElementById('suc-edit-name');
  const newBase=nameEl.value.trim(); const origBase=nameEl.dataset.orig;
  if(!newBase){alert('יש להזין שם ספק');return;}
  if(origBase&&origBase!==newBase){
    const affected=SCH.filter(s=>supBase(s.a)===origBase).length;
    if(!confirm(`לשנות שם מ-"${origBase}" ל-"${newBase}"?\n${affected} שיבוצים יעודכנו.`)) return;
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
    el.innerHTML=id==='es-sup'?'<option value="">-- ללא שינוי --</option>':'<option value="">כל הספקים</option>';
    getAllSup().filter(s=>isActSupplier(s.name)).forEach(s=>el.innerHTML+=`<option value='${s.name}'>${s.name}</option>`);
    el.value=cur;
  });
  sucToggleEdit(); sucRefreshInfo(); sucRefreshActFilt();
  alert('✅ פרטי הספק נשמרו!');
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
    const m={order:'📋 הזמנה',tx_invoice:'🧾 חשבונית עסקה',tax_invoice:'📑 חשבונית מס',tax_receipt:'📑🧾 חשבונית מס קבלה',receipt:'📄 קבלה',cancelled:'❌ מבוטל'};
    return m[s]||m[_migrateInvStatus(s)]||s||'—';
  };
  const rows = [...invs].sort((a,b)=>(b.orderDate||b.txDate||b.date||'').localeCompare(a.orderDate||a.txDate||a.date||'')).map(inv=>{
    const dateStr = inv.orderDate||inv.txDate||inv.date||'';
    const baseAmt = inv.orderAmt||inv.txAmt||inv.amt||0;
    const invVat = inv.vat||0;
    const amtStr = baseAmt ? `₪${(invVat>0?withVat(baseAmt,invVat):baseAmt).toLocaleString()}` : '—';
    const docNums = [inv.orderNum&&`📋 ${inv.orderNum}`, inv.txNum&&`🧾 ${inv.txNum}`, inv.num&&`📑 ${inv.num}`].filter(Boolean).join(' · ');
    return `<tr style="border-bottom:1px solid #f0f0f0;cursor:pointer" onclick="CM('sucard-m');openNewInvoice(${inv.id})">
      <td style="padding:5px 8px;font-size:.76rem">${dateStr?fD(dateStr):'—'}</td>
      <td style="padding:5px 8px;font-size:.72rem;color:#546e7a">${docNums||'—'}</td>
      <td style="padding:5px 8px;font-size:.75rem;color:#37474f">${inv.orderDesc||''}</td>
      <td style="padding:5px 8px;font-size:.75rem;font-weight:700;color:#2e7d32;white-space:nowrap">${amtStr}</td>
      <td style="padding:5px 8px;font-size:.72rem">${fmtStatus(inv.status)}</td>
    </tr>`;
  }).join('');
  const total = invs.reduce((s,i)=>s+(i.orderAmt||i.txAmt||i.amt||0),0);
  return `<div style="margin-top:12px;border-top:1.5px solid #e8eaf6;padding-top:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-weight:700;color:#1565c0;font-size:.82rem">📄 מסמכי רכש (${invs.length})</div>
      <div style="display:flex;gap:5px">
        <button class="btn bp bsm" style="font-size:.7rem" onclick="openNewInvoice(null,'${name.replace(/'/g,'\'').replace(/"/g,'&quot;')}')">📄 מסמך חדש</button>
        <button class="btn bg bsm" style="font-size:.7rem" onclick="exportSupPurchDocs('${name.replace(/'/g,'\'').replace(/"/g,'&quot;')}')">📊 יצוא</button>
      </div>
    </div>
    <!-- Search filter -->
    <div style="margin-bottom:6px">
      <input type="text" id="suc-inv-srch" placeholder="חפש במסמכים..." oninput="filterSupCardInvs()" style="width:100%;font-size:.78rem;padding:5px 9px;border-radius:5px;border:1.5px solid #c5cae9">
    </div>
    <div style="overflow-x:auto;max-height:280px;overflow-y:auto">
      <table style="width:100%;border-collapse:collapse;font-size:.8rem">
        <thead style="position:sticky;top:0;background:#e8eaf6">
          <tr>
            <th style="padding:5px 8px;text-align:right">תאריך</th>
            <th style="padding:5px 8px;text-align:right">מסמכים</th>
            <th style="padding:5px 8px;text-align:right">פירוט</th>
            <th style="padding:5px 8px;text-align:right">סכום</th>
            <th style="padding:5px 8px;text-align:right">סטטוס</th>
          </tr>
        </thead>
        <tbody id="suc-inv-tbody">${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:6px;font-size:.72rem;color:#546e7a;text-align:left">
      סה"כ (לפני מע"מ): <b style="color:#1565c0">₪${total.toLocaleString()}</b>
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
  if(!invs.length){ showToast('אין מסמכים לייצוא'); return; }
  const fmtStatus = (s)=>{const m={order:'הזמנה',tx_invoice:'חשבונית עסקה',tax_invoice:'חשבונית מס',tax_receipt:'חשבונית מס קבלה',receipt:'קבלה',cancelled:'מבוטל'};return m[s]||m[_migrateInvStatus(s)]||s||''};
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: All documents ──
  const rows = invs.map(inv=>({
    'ספק': inv.supName||'',
    'עיר': inv.locCity||'',
    'תאריך': inv.orderDate||inv.txDate||inv.date||'',
    'מספר הזמנה': inv.orderNum||'',
    'מספר חשבונית עסקה': inv.txNum||'',
    'מספר חשבונית מס': inv.num||'',
    'פירוט': inv.orderDesc||'',
    'סכום לפני מעמ': inv.orderAmt||inv.txAmt||inv.amt||0,
    'מעמ %': inv.vat||0,
    'סכום מעמ': inv.orderVat||inv.txVat||inv.vatAmt||0,
    'סכום כולל מעמ': inv.orderTotal||inv.txTotal||inv.total||0,
    'סטטוס': fmtStatus(inv.status),
    'הערות': inv.notes||''
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  // Auto column widths
  const cols = [{wch:20},{wch:12},{wch:12},{wch:14},{wch:16},{wch:14},{wch:25},{wch:14},{wch:8},{wch:12},{wch:14},{wch:16},{wch:20}];
  ws['!cols'] = cols;
  XLSX.utils.book_append_sheet(wb, ws, 'מסמכי רכש');

  // ── Sheet 2: Summary by city ──
  const cityMap = {};
  invs.forEach(inv=>{
    const city = inv.locCity || 'לא צוין';
    if(!cityMap[city]) cityMap[city]={count:0, base:0, vatAmt:0, total:0};
    cityMap[city].count++;
    cityMap[city].base  += inv.orderAmt||inv.txAmt||inv.amt||0;
    cityMap[city].vatAmt+= inv.orderVat||inv.txVat||inv.vatAmt||0;
    cityMap[city].total += inv.orderTotal||inv.txTotal||inv.total||0;
  });
  const summaryRows = Object.entries(cityMap)
    .sort((a,b)=>a[0].localeCompare(b[0],'he'))
    .map(([city,d])=>({
      'עיר': city,
      'מספר מסמכים': d.count,
      'סה"כ לפני מעמ': +d.base.toFixed(2),
      'סה"כ מעמ': +d.vatAmt.toFixed(2),
      'סה"כ כולל מעמ': +d.total.toFixed(2)
    }));
  // Grand total row
  const grandBase  = invs.reduce((s,i)=>s+(i.orderAmt||i.txAmt||i.amt||0),0);
  const grandVat   = invs.reduce((s,i)=>s+(i.orderVat||i.txVat||i.vatAmt||0),0);
  const grandTotal = invs.reduce((s,i)=>s+(i.orderTotal||i.txTotal||i.total||0),0);
  summaryRows.push({
    'עיר': '✅ סה"כ כללי',
    'מספר מסמכים': invs.length,
    'סה"כ לפני מעמ': +grandBase.toFixed(2),
    'סה"כ מעמ': +grandVat.toFixed(2),
    'סה"כ כולל מעמ': +grandTotal.toFixed(2)
  });
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{wch:16},{wch:14},{wch:16},{wch:14},{wch:16}];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'סיכום לפי עיר');

  XLSX.writeFile(wb, `${name}_מסמכי_רכש.xlsx`);
  showToast(`📊 יוצא: ${invs.length} מסמכים`);
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
  if(!evs.length){el.innerHTML='<p style="color:#999;text-align:center;padding:20px">אין פעילויות בטווח ובסינון זה</p>';return;}
  const cntDone=evs.filter(s=>s.st==='done').length;
  const cntCan=evs.filter(s=>s.st==='can' && !s._compByMakeup).length;
  const cntPost=evs.filter(s=>s.st==='post' && !s._compByMakeup).length;
  const cntNohap=evs.filter(s=>s.st==='nohap' && !s._compByMakeup).length;
  const cntActive=evs.length-cntDone-cntCan-cntPost-cntNohap;

  let h=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
    <div style="background:#e8f5e9;border-radius:7px;padding:5px 12px;text-align:center;min-width:70px">
      <div style="font-weight:800;color:#2e7d32">${cntDone}</div><div style="font-size:.68rem;color:#546e7a">התקיים</div>
    </div>
    <div style="background:#fff3e0;border-radius:7px;padding:5px 12px;text-align:center;min-width:70px">
      <div style="font-weight:800;color:#e65100">${cntActive+cntPost}</div><div style="font-size:.68rem;color:#546e7a">מתקיים/נדחה</div>
    </div>
    <div style="background:#ffebee;border-radius:7px;padding:5px 12px;text-align:center;min-width:70px">
      <div style="font-weight:800;color:#c62828">${cntCan}</div><div style="font-size:.68rem;color:#546e7a">בוטל</div>
    </div>
    <div style="background:#fce4ec;border-radius:7px;padding:5px 12px;text-align:center;min-width:70px">
      <div style="font-weight:800;color:#e91e63">${cntNohap}</div><div style="font-size:.68rem;color:#546e7a">לא התקיים</div>
    </div>
    <div style="background:#e3f2fd;border-radius:7px;padding:5px 12px;text-align:center;min-width:70px">
      <div style="font-weight:800;color:#1565c0">${evs.length}</div><div style="font-size:.68rem;color:#546e7a">סה"כ</div>
    </div>
  </div>`;

  h+=`<div class="tw"><table><thead><tr>
    <th>תאריך</th><th>יום</th><th>עיר</th><th>צהרון</th><th>שעה</th><th>פעילות</th><th>קב'</th><th>סטטוס</th><th>הערות</th><th></th>
  </tr></thead><tbody>`;
  evs.filter(s => !s._compByMakeup).forEach(s=>{
    const g=G(s.g);
    h+=`<tr class="${stClass(s)}">
      <td>${fD(s.d)}</td>
      <td>יום ${dayN(s.d)}</td>
      <td>${g.city||''}</td>
      <td><div style="font-weight:700">${g.name}</div>${g.st?`<div style="font-size:.67rem;color:#78909c">${g.st}</div>`:''}</td>
      <td>${fT(s.t)}</td>
      <td><span style="background:#e3f2fd;color:#1565c0;border-radius:10px;padding:1px 7px;font-size:.73rem;font-weight:600">${s.act||'—'}</span></td>
      <td style="text-align:center">${s.grp||1}</td>
      <td>${stLabel(s)}</td>
      <td style="max-width:100px;font-size:.71rem">${s.nt||''}</td>
      <td><button class="btn bo bsm" style="font-size:.65rem" onclick="openSP('${s.id}')">✏️</button></td>
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


// ── Quick Cancel Popup ──────────────────────────────────
// Nohap, Cancel, and Postpone modals moved to activity.js
function selNohapReason(btn, reason){
  document.querySelectorAll('.nohap-reason-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  const inp = document.getElementById('nohapq-reason');
  if (reason === 'אחר') inp.focus();
  else inp.placeholder = reason;
}
function saveNohapQ(){
  const sel = document.querySelector('.nohap-reason-btn.sel');
  const mainReason = sel ? (sel.dataset.r || sel.textContent.replace(/^\S+ /,'').trim()) : '';
  const extra = document.getElementById('nohapq-reason').value.trim();
  const fullReason=[mainReason,extra].filter(Boolean).join(' — ');
  if(!mainReason&&!extra){alert('יש לבחור סיבה');return;}
  const scopeEl=document.querySelector('input[name="nohapq-scope"]:checked');
  const forPair=(scopeEl&&scopeEl.value==='pair') || (window._spSyncPartnerNext === true);

  // Read orig BEFORE modifying SCH
  const origEv2=SCH.find(s=>s.id==_nohapQId);
  const origG2=origEv2?origEv2.g:null;
  const origD2=origEv2?origEv2.d:null;

  const markNohap=(evId)=>{
    const i=SCH.findIndex(s=>s.id==evId); if(i<0) return;
    const prev=SCH[i].nt||'';
    const noteAdd='⚠️ לא התקיים: '+fullReason;
    SCH[i].st='nohap';
    SCH[i].cr=fullReason;
    SCH[i].nt=prev?prev+' | '+noteAdd:noteAdd;
  };

  markNohap(_nohapQId);

  if(forPair && origG2 && origD2){
    const origG2n=parseInt(origG2);
    const pair2=gardenPair(origG2n);
    if(pair2){
      pair2.ids
        .map(id=>parseInt(id))
        .filter(gid=>gid!==origG2n)
        .forEach(gid=>{
          const partnerEv = window.findPartnerActivity ? window.findPartnerActivity(gid, origD2, origEv2.a) : null;
          if(partnerEv){
            markNohap(partnerEv.id);
          } else {
            // No scheduled event for partner on this date — create one
            const origEv3=SCH.find(s=>s.id==_nohapQId);
            const newId=Date.now()+gid;
            SCH.push({
              id:newId, g:gid, d:origD2,
              a:origEv3?origEv3.a:'', act:origEv3?origEv3.act:'',
              t:origEv3?origEv3.t:'', grp:origEv3?origEv3.grp:1,
              st:'nohap', cr:fullReason,
              nt: '⚠️ לא התקיים: ' + fullReason + ' (נוצר אוטומטית עם הזוג)',
              sup:origEv3?origEv3.sup:''
            });
          }
        });
    }
  }
  // Save + ask about makeup
  save();
  CM('nohapqm');
  refresh();
  if (window.selEv) window.openSP(window.selEv);
  
  // Prompt for makeup scheduling
  const origEvForMakeup = SCH.find(s => s.id === _nohapQId);
  if (origEvForMakeup) {
    setTimeout(() => {
      window.askYesNo(
        '⚠️ הפעילות סומנה כ"לא התקיים".\n\n' +
        'האם תרצה לשבץ השלמה עכשיו?',
        () => {
          window.openMakeupSched(_nohapQId);
        }
      );
    }, 200);
  }
}

// ─── Blocked Dates ────────────────────────────────────────────
let _blockedEditDate=null;

const BLOCKED_ICONS={'טיול':'🚌','מסיבה':'🎉','אירוע מיוחד':'⭐','יום הורים':'👨‍👩‍👧','אחר':'🚫'};

function getBlockedIcon(reason){
  for(const[k,v] of Object.entries(BLOCKED_ICONS)) if(reason&&reason.includes(k)) return v;
  return '🚫';
}

function getBlockedInfo(ds){return blockedDates[ds]||null;}

// ─── Monthly Excel Export ────────────────────────────────────
function openGcellPopup(gid, ds, e){
  e.stopPropagation();
  _gcellGid=parseInt(gid);
  _gcellDs=ds;
  const g=G(_gcellGid);
  const key=`${_gcellGid}_${ds}`;
  const blk=gardenBlocks[key];
  const popup=document.getElementById('gcell-popup');
  document.getElementById('gcell-popup-title').textContent=`${g.name} · ${fD(ds)} יום ${dayN(ds)}`;
  const blkLbl=document.getElementById('gcell-popup-block-lbl');
  const blockBtn=document.getElementById('gcell-block-btn');
  const unblockBtn=document.getElementById('gcell-unblock-btn');
  if(blk){
    blkLbl.textContent=`${blk.icon||'🚫'} חסום: ${blk.reason}`;
    blkLbl.style.display='block';
    blockBtn.textContent='🚫 ערוך חסימה';
    unblockBtn.style.display='block';
  } else {
    blkLbl.style.display='none';
    blockBtn.textContent='🚫 חסום תאריך לצהרון זה';
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
  if(!confirm('להסיר חסימה זו?')) return;
  delete gardenBlocks[`${_gcellGid}_${_gcellDs}`];
  save(); refresh(); showToast('✅ חסימה הוסרה');
}

function getGardenBlock(gid, ds){ return gardenBlocks[`${parseInt(gid)}_${ds}`]||null; }

// ─── Unified Block Modal ─────────────────────────────────────
// mode: 'date' = whole date block | 'garden' = specific garden+date
let _blockMode='date'; // 'date' | 'garden'

function selBlockReason(btn, reason){
  document.querySelectorAll('.block-reason-btn').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
  const inp=document.getElementById('block-m-reason');
  if(reason!=='אחר') inp.value=reason; else inp.focus();
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
    document.getElementById('block-m-title').textContent=`🚫 חסום צהרון לתאריך`;
    document.getElementById('block-m-subtitle').textContent=`${g.name} · ${fD(ds)} יום ${dayN(ds)}`;
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
    document.getElementById('block-m-title').textContent=`🚫 חסום / ביטול תאריך`;
    document.getElementById('block-m-subtitle').textContent=`📅 ${fD(ds)} — יום ${dayN(ds)}`;
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
        cancelCnt.textContent=cnt>0?`${cnt} פעילויות פעילות ביום זה`:'אין פעילויות פעילות ביום זה';
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
  if(!reason){alert('יש להזין סיבה');return;}
  const note=document.getElementById('block-m-note').value.trim();
  const icon=getBlockedIcon(reason);
  if(_blockMode==='garden'){
    const key=`${_gcellGid}_${_gcellDs}`;
    gardenBlocks[key]={reason,note,icon,gid:_gcellGid,d:_gcellDs};
    saveAndRefresh('block-m'); showToast('🚫 צהרון נחסם לתאריך זה');
  } else {
    blockedDates[_blockedEditDate]={reason,note,icon};
    // Optionally cancel all activities
    const cancelChk=document.getElementById('block-m-cancel-chk');
    if(cancelChk&&cancelChk.checked){
      const toCancel=SCH.filter(s=>s.d===_blockedEditDate&&s.st!=='can');
      if(toCancel.length>0){
        toCancel.forEach(s=>{
          s.st='can'; s.cr=reason; s.cn=note;
          const n='❌ בוטל: '+reason+(note?' — '+note:'');
          s.nt=s.nt?s.nt+' | '+n:n;
        });
        saveAndRefresh('block-m');
        showToast(`🚫 תאריך נחסם + בוטלו ${toCancel.length} פעילויות`);
        return;
      }
    }
    saveAndRefresh('block-m'); showToast('🚫 תאריך סומן כחסום');
  }
}

function deleteBlock(){
  const msg=_blockMode==='garden'?'להסיר את החסימה מגן זה?':'להסיר את החסימה מתאריך זה?';
  if(!confirm(msg)) return;
  if(_blockMode==='garden'){
    delete gardenBlocks[`${_gcellGid}_${_gcellDs}`];
    saveAndRefresh('block-m'); showToast('✅ חסימה הוסרה');
  } else {
    delete blockedDates[_blockedEditDate];
    saveAndRefresh('block-m'); showToast('✅ חסימה הוסרה');
  }
}

let _editMgrId=null;

// ─── Auto-import contacts from garden co field ────────
function importContactsFromGardens(){
  if(Object.keys(managers).length>0) return; // already have managers
  const byContact={};
  [...GARDENS,...(_GARDENS_EXTRA||[])].forEach(g=>{
    if(!g.co) return;
    // Parse "Name – 050-XXXXXXX" or "Name - 050-XXXXXXX" or just "Name"
    const m=g.co.match(/^(.+?)\s*[–\-]\s*(\d[\d\-\s]+)$/);
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

// ── Garden contact helpers ─────────────────────────────────────
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

  (document.getElementById('gedit-title')||{}).textContent =`✏️ ${g.name}`;

  // Badge
  const mgr=getGardenMgr(gid);
  const clr=CITY_COLORS(g.city);
  document.getElementById('gedit-badge').innerHTML=
    `<span style="background:${clr.light};color:${clr.solid};border-radius:12px;padding:2px 10px;font-size:.75rem;font-weight:700">🏙️ ${g.city}</span>`+
    `<span style="background:#e8f5e9;color:#2e7d32;border-radius:12px;padding:2px 10px;font-size:.75rem">${gcls(g)==='ביה"ס'?'🏛️ בית ספר':'🏫 גן/צהרון'}</span>`;

  // Fields — override from supEx if exists
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
    mgrLbl.textContent=`${mgr.role==='manager'?'🏛️ מנהל':'👤 רכז'}: ${mgr.name}${mgr.phone?' 📞 '+mgr.phone:''}`;
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
  showToast('✅ כרטיס הצהרון עודכן');
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
  if(!all.length){el.innerHTML='<p style="color:#999;text-align:center;padding:20px">אין מנהלים/רכזים. לחץ ➕ להוספה.</p>';return;}

  let h='';
  all.forEach(m=>{
    const gs=(m.gardenIds||[]).map(id=>G(id)).filter(x=>x.id)
      .sort((a,b)=>a.city.localeCompare(b.city,'he')||a.name.localeCompare(b.name,'he'));
    const isMgr=m.role==='manager';
    const roleClr=isMgr?'#1a237e':'#2e7d32';
    const roleBg=isMgr?'#e8eaf6':'#e8f5e9';
    const roleLabel=isMgr?'🏛️ מנהל':'👤 רכז';

    // Group gardens by city for display
    const gByCity={};
    gs.forEach(g=>{if(!gByCity[g.city])gByCity[g.city]=[];gByCity[g.city].push(g);});

    h+=`<div class="card" style="padding:0;margin-bottom:12px;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden">
      <!-- Header -->
      <div style="background:${roleClr};padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <span style="font-weight:800;color:#fff;font-size:.9rem">${roleLabel} ${m.name}</span>
          ${m.city?`<span style="font-size:.72rem;color:rgba(255,255,255,.8);margin-right:10px">🏙️ ${m.city}</span>`:''}
        </div>
        <div style="display:flex;gap:5px">
          <button onclick="openMgrModal('${m.id}')" style="background:rgba(255,255,255,.22);border:none;border-radius:6px;padding:3px 9px;cursor:pointer;color:#fff;font-size:.74rem">✏️ ערוך</button>
          <button onclick="exportMgrContact('${m.id}')" style="background:rgba(255,255,255,.15);border:none;border-radius:6px;padding:3px 9px;cursor:pointer;color:#fff;font-size:.74rem">📋 ייצוא</button>
        </div>
      </div>
      <!-- Contact info -->
      <div style="padding:10px 14px;background:${roleBg};display:flex;gap:18px;flex-wrap:wrap">
        ${m.phone?`<span style="font-size:.8rem">📞 <a href="tel:${m.phone}" style="color:${roleClr};font-weight:700">${m.phone}</a></span>`:''}
        ${m.phone2?`<span style="font-size:.8rem">📞 <a href="tel:${m.phone2}" style="color:${roleClr}">${m.phone2}</a></span>`:''}
        ${m.email?`<span style="font-size:.8rem">✉️ <a href="mailto:${m.email}" style="color:${roleClr}">${m.email}</a></span>`:''}
        ${m.notes?`<span style="font-size:.78rem;color:#546e7a;font-style:italic">💬 ${m.notes}</span>`:''}
        ${!m.phone&&!m.email&&!m.notes?'<span style="font-size:.77rem;color:#aaa">אין פרטי קשר</span>':''}
      </div>
      <!-- Gardens list -->
      <div style="padding:10px 14px">
        <div style="font-size:.74rem;font-weight:700;color:#546e7a;margin-bottom:7px">אחראי על ${gs.length} צהרונים:</div>
        ${gs.length?`<div>
          ${Object.keys(gByCity).sort().map(city=>`
            <div style="margin-bottom:6px">
              <div style="font-size:.65rem;color:#78909c;font-weight:700;margin-bottom:3px">📍 ${city}</div>
              <div style="display:flex;flex-wrap:wrap;gap:3px">
                ${gByCity[city].map(g=>`<span style="background:#e8f5e9;color:#1b5e20;border-radius:12px;padding:2px 9px;font-size:.71rem;cursor:pointer" onclick="openGM(${g.id})">${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</span>`).join('')}
              </div>
            </div>`).join('')}
        </div>`:
        `<span style="font-size:.76rem;color:#aaa">לא שויכו גנים עדיין</span>`}
      </div>
    </div>`;
  });
  el.innerHTML=h;
}

function openMgrModal(id){
  _editMgrId=id;
  const m=id?managers[id]:null;
  (document.getElementById('mgrm-title')||{}).textContent =m?`✏️ עריכת ${m.name}`:'➕ הוסף מנהל/רכז';
  document.getElementById('mgr-name').value=m?m.name:'';
  document.getElementById('mgr-role').value=m?(m.role||'coord'):'coord';
  document.getElementById('mgr-phone').value=m?m.phone||'':'';
  document.getElementById('mgr-phone2').value=m?m.phone2||'':'';
  document.getElementById('mgr-email').value=m?m.email||'':'';
  document.getElementById('mgr-notes').value=m?m.notes||'':'';

  const mgrCityEl=document.getElementById('mgr-city');
  mgrCityEl.innerHTML='<option value="">כל הערים</option>';
  cities().forEach(c=>mgrCityEl.innerHTML+=`<option value='${c}'${m&&m.city===c?' selected':''}>${c}</option>`);

  const mgrGCityEl=document.getElementById('mgr-g-city');
  mgrGCityEl.innerHTML='<option value="">כל הערים</option>';
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
    h+=`<div style="padding:4px 6px 2px;font-size:.68rem;font-weight:700;color:#78909c;background:#f5f5f5;border-radius:4px;margin-bottom:2px;margin-top:4px">🏙️ ${c}</div>`;
    byCity[c].forEach(g=>{
      h+=`<label style="display:flex;gap:7px;padding:4px 6px;cursor:pointer;align-items:center;border-radius:5px;transition:background .1s" onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background=''" >
        <input type="checkbox" value="${g.id}" ${checked.has(g.id)?'checked':''} style="min-width:15px;accent-color:#1565c0" onchange="mgrUpdateCount()">
        <span style="flex:1;font-size:.77rem">${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</span>
        ${g.st?`<span style="font-size:.65rem;color:#aaa">${g.st}</span>`:''}
      </label>`;
    });
  });
  document.getElementById('mgr-gardens').innerHTML=h||'<p style="color:#aaa;font-size:.75rem;text-align:center;padding:10px">אין גנים</p>';
  mgrUpdateCount();
}

function mgrUpdateCount(){
  const n=document.querySelectorAll('#mgr-gardens input:checked').length;
  const el=document.getElementById('mgr-gardens-count');
  if(el) el.textContent=n?`✓ נבחרו ${n} גנים`:'';
}

function mgrSelectAllGardens(sel){
  document.querySelectorAll('#mgr-gardens input[type="checkbox"]').forEach(cb=>cb.checked=sel);
  mgrUpdateCount();
}

function saveMgr(){
  const name=document.getElementById('mgr-name').value.trim();
  if(!name){alert('יש להזין שם');return;}
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
  showToast('✅ '+name+' נשמר — הנתונים עודכנו בכל האפליקציה');
}

function deleteMgr(){
  const m=_editMgrId?managers[_editMgrId]:null;
  if(!m) return;
  if(!confirm(`למחוק את ${m.name}?`)) return;
  delete managers[_editMgrId];
  save(); CM('mgrm'); refresh();
  // Refresh all views that show manager/coordinator data
  renderManagers();
  refreshMgrDrops();
  renderGardens();
  if(typeof renderPairs === 'function') renderPairs();
  updCounts();
  showToast('✅ '+name+' נשמר — הנתונים עודכנו בכל האפליקציה');
}

let _exportMgrId=null;
function exportMgrContact(id){
  _exportMgrId=id;
  const m=managers[id]; if(!m) return;
  const gs=(m.gardenIds||[]).map(id=>G(id)).filter(x=>x.id)
    .sort((a,b)=>a.city.localeCompare(b.city,'he')||a.name.localeCompare(b.name,'he'));
  const roleLabel=m.role==='manager'?'מנהל':'רכז';
  let txt='';
  txt+=`👤 ${roleLabel}: ${m.name}\n`;
  if(m.phone) txt+=`📞 ${m.phone}\n`;
  if(m.phone2) txt+=`📞 ${m.phone2}\n`;
  if(m.email) txt+=`✉️ ${m.email}\n`;
  if(m.notes) txt+=`💬 ${m.notes}\n`;
  txt+='\n';
  txt+=`🏫 צהרונים באחריותו (${gs.length}):\n`;
  // group by city
  const byCity={};
  gs.forEach(g=>{if(!byCity[g.city])byCity[g.city]=[];byCity[g.city].push(g);});
  Object.keys(byCity).sort().forEach(city=>{
    txt+=`\n📍 ${city}:\n`;
    byCity[city].forEach(g=>{
      const cr=resolveGardenContact(g);
      txt+=`  ${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}` + '\n';
      if(g.st) txt+='     📍 ' + g.st + '\n';
      if(cr.name) txt+='     👤 ' + cr.name + '\n';
      if(cr.phone) txt+='     📞 ' + cr.phone + '\n';
    });
  });
  (document.getElementById('mgr-export-text')||{}).textContent =txt;
  document.getElementById('mgr-export-m').classList.add('open');
}

function copyMgrExport(){
  const txt=document.getElementById('mgr-export-text').textContent;
  navigator.clipboard.writeText(txt).then(()=>showToast('✅ הועתק!')).catch(()=>{
    const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);showToast('✅ הועתק!');
  });
}

function shareMgrWhatsApp(){
  const txt=document.getElementById('mgr-export-text').textContent;
  window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
}

function refreshMgrDrops(){
  const mgrOptions=()=>{
    let opts='<option value="">הכל</option>';
    Object.values(managers).sort((a,b)=>a.name.localeCompare(b.name,'he'))
      .forEach(m=>opts+=`<option value="${m.id}">${m.role==='manager'?'🏛️':'👤'} ${m.name}</option>`);
    return opts;
  };
  const el=document.getElementById('g-mgr');
  if(el){const c=el.value;el.innerHTML=mgrOptions();el.value=c;}
  const el2=document.getElementById('s-mgr');
  if(el2){const c=el2.value;el2.innerHTML=mgrOptions();el2.value=c;}
  const mf=document.getElementById('mgr-city-filt');
  if(mf){const c=mf.value;mf.innerHTML='<option value="">כל הערים</option>';cities().forEach(city=>mf.innerHTML+=`<option value='${city}'>${city}</option>`);mf.value=c;}
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
  if (gClsEl) gClsEl.value=t==='gan'?'גנים':'ביה"ס';
  renderGardens();
}

// ── Fixed-schedule view ──────────────────────────────────────────
const HEB_DAYS_SHORT=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

function getGardenFixedSched(gardenId, fromDate, toDate){
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
    if(gcls(g)!=='גנים') return false;
    if(cityF&&g.city!==cityF) return false;
    if(srch&&![(g.name||''),(g.city||'')].some(x=>x.toLowerCase().includes(srch))) return false;
    return true;
  });
  const byCity={};
  allG.forEach(g=>{ const c=g.city||'אחר'; if(!byCity[c]) byCity[c]=[]; byCity[c].push(g); });
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
          <span style="font-weight:800; color:#2d3748;">🏙️ ${city} (${gardens.length} גנים)</span>
          <span style="font-size:0.8rem; color:#718096;">לחץ לפירוט</span>
        </div>
      </summary>
      <div class="city-accordion-content">`;

    groups.forEach(group=>{
      if(group.type==='pair'){
        h+=`<div style="background:#f3e5f5;border-radius:6px;padding:3px 10px;margin-bottom:5px;font-size:.72rem;color:#6a1b9a;font-weight:700">🔗 ${group.gardens[0].name} + ${group.gardens[1].name}</div>`;
        group.gardens.forEach(g=>{ h+=_renderGardenFixedRow(g); });
      } else {
        h+=_renderGardenFixedRow(group.gardens[0]);
      }
    });
    h+='</div></details>';
  });

  document.getElementById('g-body').innerHTML=h||'<p style="color:#999;padding:20px">לא נמצאו צהרונים</p>';
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
      const supN=supBase(s.a)||s.a||'ללא שם';
      const actN=s.act||supAct(s.a)||'';
      const time=s.t?s.t.slice(0,5):'—';
      const key = s._recId || `${s.a}_${s.act}_${dow}`;
      
      // Look for partner info
      let partnerInfo = '<span style="color:#90a4ae">—</span>';
      const pair = window.gardenPair(gid);
      if (pair) {
        const partnerId = pair.ids.find(id => Number(id) !== Number(gid));
        if (partnerId) {
          const pg = window.G(partnerId);
          const pev = window.SCH.find(ps => Number(ps.g) === Number(partnerId) && ps.d === s.d && window.supBase(ps.a) === window.supBase(s.a));
          partnerInfo = `<span style="font-weight:700;color:var(--c-secondary)">${pg.name}</span> ${pev ? '<span style="font-size:var(--fs-small);color:var(--c-text-light)">('+window.fT(pev.t)+')</span>' : '<span style="color:var(--c-error);font-size:var(--fs-small)">(לא משובץ)</span>'}`;
        }
      }

      rows+=`<tr style="border-bottom:1px solid #eef0fb">
        <td style="padding:3px 10px;font-weight:600;color:#1a237e;white-space:nowrap">יום ${HEB_DAYS_SHORT[dow]}</td>
        <td style="padding:3px 10px;color:#2e7d32;font-weight:600;white-space:nowrap">${time}</td>
        <td style="padding:3px 10px;color:#222">${supN}${actN?' — '+actN:''}</td>
        <td style="padding:3px 10px;color:var(--c-secondary);font-size:var(--fs-small)">${s.tp||'חוג'}</td>
        <td style="padding:3px 10px;font-size:var(--fs-small)">${partnerInfo}</td>
        <td style="padding:2px 6px;white-space:nowrap">
          <button onclick="event.stopPropagation();openGM(${gid});setTimeout(()=>window.openBulkUpdateRecurring('${key}',${gid}),100)" style="background:#e8eaf6;border:none;border-radius:4px;padding:2px 7px;font-size:.68rem;cursor:pointer;color:#3949ab" title="ערוך שיבוץ קבוע (סדרה)">✏️</button>
          <button onclick="event.stopPropagation();openSP('${s.id}')" style="background:#ffebee;border:none;border-radius:4px;padding:2px 7px;font-size:.68rem;cursor:pointer;color:#c62828;margin-right:2px" title="ביטול/החרגה חד פעמית">❌</button>
        </td>
      </tr>`;
    });
  } else {
    rows=`<tr><td colspan="4" style="padding:5px 10px;color:#bbb;font-size:.72rem;font-style:italic">אין שיבוץ קבוע</td></tr>`;
  }
  return `<div style="display:flex;margin-bottom:7px;border:1px solid #e3e7f5;border-radius:8px;overflow:hidden">
    <div style="background:#f5f7ff;padding:8px 10px;min-width:120px;max-width:140px;display:flex;flex-direction:column;justify-content:space-between;border-left:1px solid #e3e7f5">
      <div style="font-weight:800;color:var(--c-primary);font-size:var(--fs-card-title);margin-bottom:6px">${g.name}</div>
      <div style="display:flex;flex-direction:column;gap:3px;margin-top:4px">
        <button class="btn bp bsm" style="font-size:.62rem;padding:2px 5px" onclick="openGM(${gid})">📂 כרטיס</button>
        <button class="btn bo bsm" style="font-size:.62rem;padding:2px 5px" onclick="_goToGardenSched(${gid})">📅 שיבוצים</button>
      </div>
    </div>
    <div style="flex:1;overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:.78rem">
        <thead><tr style="background:#eef2ff">
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700">יום</th>
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700">שעה</th>
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700">ספק / פעילות</th>
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700">סוג</th>
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700">גן בן-זוג</th>
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
// ─── ADD PLACE ────────────────────────────────────────
function openAddGardenModal(){
  document.getElementById('ap-name').value='';
  document.getElementById('ap-addr').value='';
  document.getElementById('ap-co').value='';
  document.getElementById('ap-coph').value='';
  document.getElementById('ap-notes').value='';
  document.getElementById('ap-cls').value=_gardensTab==='sch'?'ביה"ס':'גנים';
  const apCity=document.getElementById('ap-city');
  apCity.innerHTML='<option value="">בחר עיר...</option>';
  cities().forEach(c=>apCity.innerHTML+=`<option value='${c}'>${c}</option>`);
  (document.getElementById('addplace-title')||{}).textContent ='➕ הוסף '+(_gardensTab==='sch'?'בית ספר':'צהרון / גן');
  document.getElementById('addplace-m').classList.add('open');
}
function saveNewPlace(){
  const name=document.getElementById('ap-name').value.trim();
  const city=document.getElementById('ap-city').value;
  if(!name||!city){alert('יש למלא שם ועיר');return;}
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
  alert('✅ '+name+' נוסף בהצלחה!');
}

// ─── Mobile nav ───────────────────────────────────────
function mobNav(btn){
  document.querySelectorAll('#mob-nav .mob-nav-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
}
function mobNavPurch(btn){
  document.querySelectorAll('#mob-nav-purch .mob-nav-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
}

// ─── Data backup / restore ────────────────────────────
function exportData(){
  const data=_safeLS.getItem('ganv5')||'{}';
  const snaps=_safeLS.getItem('ganv5_snaps')||'[]';
  const blob=new Blob([JSON.stringify({data:JSON.parse(data),snaps:JSON.parse(snaps),ts:Date.now()},null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='kids_backup_'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('✅ גיבוי הורד בהצלחה');
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
        if(!confirm('⚠️ ייבוא יחליף את כל הנתונים הנוכחיים.\nהמשך?')) return;
        _safeLS.setItem('ganv5',JSON.stringify(data));
        if(parsed.snaps) _safeLS.setItem('ganv5_snaps',JSON.stringify(parsed.snaps));
        showToast('✅ הנתונים יובאו. טוען מחדש...');
        setTimeout(()=>location.reload(),1200);
      }catch(err){alert('שגיאה בקובץ הגיבוי: '+err.message);}
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

// ─── PWA Service Worker registration ──────────────────
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



/* ══ Universal filter toggle (desktop + mobile) ══════════════════ */
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
  if(btn){ btn.textContent='🔄 מסנכרן...'; btn.style.background='#e65100'; }
  try{
    // Force token refresh — critical after Rules change
    if(window._fbUser){
      try{ window._cachedToken = await window._fbUser.getIdToken(true); }
      catch(te){ console.warn('Token refresh failed:', te.message); }
    }
    const ok = await loadFromFirebase(false, true);
    await saveToFirebase(false);
    showToast(ok ? '✅ סונכרן עם Firebase' : '⚠️ טעינה נכשלה — בדוק חיבור');
  } catch(e){
    showToast('❌ שגיאת סנכרון: ' + e.message);
    console.error('Sync error:', e);
  }
  _fbUpdateStatus();
}

// ── Invoice status multi-select filter ────────────────────────
const PI_ST_KEY = 'pi_status_filter';

function _getPiStSelected(){
  return [...document.querySelectorAll('.pi-st-cb:checked')].map(c=>c.value);
}

function _setPiStLabel(){
  const sel = _getPiStSelected();
  const lbl = document.getElementById('pi-status-label');
  if(!lbl) return;
  const names = {'order':'הזמנה','tx_invoice':'חשבונית עסקה','tax_invoice':'חשבונית מס','tax_receipt':'חשבונית מס קבלה','receipt':'קבלה','cancelled':'מבוטל'};
  if(!sel.length) lbl.textContent='הכל';
  else if(sel.length===1) lbl.textContent=names[sel[0]]||sel[0];
  else lbl.textContent=`${sel.length} סטטוסים`;
}

function piStChange(){
  // If all 6 checked → show "הכל"
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
      showToast('📂 נסה לפתוח — אם לא נפתח, העתק את הנתיב ופתח ידנית');
    }, 800);
  } else {
    // Popup blocked — copy path and instruct
    _copyToClipboard(p);
    showToast('📋 הנתיב הועתק — פתח סייר קבצים והדבק');
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

// [End of core.js]
