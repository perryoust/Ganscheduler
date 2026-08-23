// ══════════════════════════════════════════════


// ── PROCUREMENT MODULE - v9.0 ────────────────────────────────

let _appMode = 'act'; // 'act' | 'purch'
let _purchTab = 'pdash';
const PURCH_TABS = ['pdash','pinvoices','porders','pdeliveries','psup'];

// --- Debounced rendering for performance ---
window.debouncedRenderInvoices = window.debounce ? window.debounce(() => {
  if(typeof window.renderInvoices === 'function') window.renderInvoices();
}, 250) : () => { if(typeof window.renderInvoices === 'function') window.renderInvoices(); };

window.debouncedRenderPurchSuppliers = window.debounce ? window.debounce(() => {
  if(typeof window.renderPurchSuppliers === 'function') window.renderPurchSuppliers();
}, 250) : () => { if(typeof window.renderPurchSuppliers === 'function') window.renderPurchSuppliers(); };

// ── Mode switcher ──────────────────────────────────────
async function switchMode(mode){
  _appMode = mode;
  window._appMode = mode;
  if (typeof _safeLS !== 'undefined') _safeLS.setItem('activeAppMode', mode);

  // Lazy load purchasing data if switching to purch mode
  if (mode === 'purch' && !window._purchasingDataLoaded && typeof window.loadPurchasingDataFromFirebase === 'function') {
    if (window.showToast) window.showToast('טוען נתוני רכש...');
    await window.loadPurchasingDataFromFirebase();
  }

  // Always close side panel + backdrop when switching modes (critical for mobile)
  const _spEl=document.getElementById('sp');
  const _bdEl=document.getElementById('sp-backdrop');
  if(_spEl) _spEl.classList.remove('open');
  if(_bdEl) _bdEl.style.display='none';
  window.selEv=null;
  // Toggle body class for CSS theming
  document.body.classList.toggle('mode-purch', mode==='purch');
  // Show/hide tab bars
  const tAct = document.getElementById('tabs-act');
  if(tAct) tAct.style.display = mode==='act' ? '' : 'none';
  
  const tPurch = document.getElementById('tabs-purch');
  if(tPurch) tPurch.style.display = mode==='purch' ? '' : 'none';
  
  // Toggle mode buttons
  const mAct = document.getElementById('modeBtn-act');
  if(mAct) mAct.classList.toggle('active', mode==='act');
  
  const mPurch = document.getElementById('modeBtn-purch');
  if(mPurch) mPurch.classList.toggle('active', mode==='purch');
  // Mobile nav: show correct bar
  // Mobile nav — only manipulate on mobile screens (CSS handles desktop hide)
  const mnPurch = document.getElementById('mob-nav-purch');
  const mnAct = document.getElementById('mob-nav');
  if (mode === 'purch') {
    if(mnPurch) mnPurch.style.display = 'block';
    if(mnAct) mnAct.style.display = 'none';
  } else {
    if(mnPurch) mnPurch.style.display = 'none';
    if(mnAct) mnAct.style.display = ''; // let CSS decide: hidden on desktop, block on mobile
  }
  // Show panels
  if(mode==='act'){
    // Hide all purch panels
    PURCH_TABS.forEach(t=>{ const el=document.getElementById('p-'+t); if(el) el.style.display='none'; });
    // Force to 'cal' when switching to 'act' mode
    const _targetTab = 'cal';
    if(typeof window.ST === 'function') window.ST(_targetTab);
  } else {
    // Hide all act panels (use both class removal and display:none to be safe)
    if(Array.isArray(window.TABS)){
      window.TABS.forEach(t=>{ const el=document.getElementById('p-'+t); if(el){ el.classList.remove('active'); el.style.display='none'; } });
    }
    if(typeof SPT === 'function') SPT(_purchTab);
    if(typeof refreshPurchDash === 'function') refreshPurchDash();
    // Ensure supplier list is fresh
    try{ if(_purchTab==='psup' && typeof renderPurchSuppliers === 'function') renderPurchSuppliers(); }catch(e){}
  }
}

function SPT(t){
  _purchTab = t;
  // Always close side panel + backdrop when switching tabs (critical for mobile)
  const _spEl=document.getElementById('sp');
  const _bdEl=document.getElementById('sp-backdrop');
  if(_spEl) _spEl.classList.remove('open');
  if(_bdEl) _bdEl.style.display='none';
  window.selEv=null;
  PURCH_TABS.forEach((x,i)=>{
    const tabEl = document.querySelectorAll('#tabs-purch .tab')[i];
    if(tabEl) tabEl.classList.toggle('active', x===t);
    const panelEl = document.getElementById('p-'+x);
    if(panelEl) panelEl.style.display = x===t ? 'block' : 'none';
  });
  if(t==='pinvoices'){
    fillPiSupFilter(); _fillPiCityFilter(); renderInvoices();
  }
  if(t==='psup'){
    setTimeout(renderPurchSuppliers, 50);
  }
  if(t==='pdash') refreshPurchDash();
  if(t==='porders' && typeof window.renderPurchOrders === 'function') window.renderPurchOrders();
  if(t==='pdeliveries' && typeof window.renderPurchDeliveries === 'function') window.renderPurchDeliveries();
}
window.SPT = SPT;

// --- Helper to normalize and accurately classify invoice status based on workspace business rules ---
window.normalizeInvoiceStatus = function(inv) {
  if (!inv) return 'order';
  const rawSt = typeof inv === 'string' ? _migrateInvStatus(inv) : _migrateInvStatus(inv.status);
  if (rawSt === 'cancelled') return 'cancelled';
  if (typeof inv === 'string') return rawSt;

  // 1. File Name Priorities: 'חשבונית מס' wins, followed by 'חשבון עסקה'
  const fTax = String(inv.file_tax?.name || inv.file_tax?.path || '');
  const fTx = String(inv.file_tx?.name || inv.file_tx?.path || '');
  const fOrder = String(inv.file_order?.name || inv.file_order?.path || '');
  const allFiles = fTax + ' ' + fTx + ' ' + fOrder;

  if (allFiles.includes('חשבונית מס')) {
    return 'tax_invoice';
  }
  if (allFiles.includes('חשבון עסקה') && rawSt !== 'receipt') {
    return 'tx_invoice';
  }

  // 2. Details Parsing (strictly treating 0, 0.0, 0.00, ₪0 etc as empty/invalid)
  const isPosNum = (val) => {
    if (val === undefined || val === null) return false;
    const clean = String(val).replace(/[^\d.-]/g, '').trim();
    if (clean === '' || clean === '-' || clean === '.' || isNaN(parseFloat(clean))) return false;
    return parseFloat(clean) > 0;
  };
  const isValTxt = (val) => {
    if (val === undefined || val === null) return false;
    const s = String(val).trim();
    if (s === '' || s === '-' || s === '0' || s === '0.0' || s === '0.00' || s.startsWith('₪ 0') || s.startsWith('₪0')) return false;
    return true;
  };

  const hasTaxDetails = !!(isValTxt(inv.num) || isValTxt(inv.date) || isPosNum(inv.total) || isPosNum(inv.amt) || (inv.file_tax && inv.file_tax.path));
  const hasTxDetails = !!(isValTxt(inv.txNum) || isValTxt(inv.txDate) || isPosNum(inv.txTotal) || isPosNum(inv.txAmt) || (inv.file_tx && inv.file_tx.path));

  // 3. Classification
  if (hasTaxDetails) {
    const isExempt = (window.supEx && window.supEx[inv.supName] && (window.supEx[inv.supName].entityType==='עוסק פטור'||window.supEx[inv.supName].entityType==='עמותה'));
    return isExempt ? 'receipt' : (hasTxDetails ? 'tax_receipt' : 'tax_invoice');
  }
  if (hasTxDetails) {
    return 'tx_invoice';
  }
  return 'order';
};

function renderMobileInvoiceCard(inv, opts = {}) {
  if(!inv || !inv.supName) return '';
  const vat = inv.vat !== undefined ? inv.vat : (window.getVatRate ? window.getVatRate() : 18);
  const isExempt = vat===0 || (window.supEx && window.supEx[inv.supName] && (window.supEx[inv.supName].entityType==='עוסק פטור'||window.supEx[inv.supName].entityType==='עמותה'));
  const hasOrder = inv.orderNum;
  const hasTx    = inv.txNum;
  const hasTax   = inv.num;
  const st = window.normalizeInvoiceStatus ? window.normalizeInvoiceStatus(inv) : _migrateInvStatus(inv.status);

  // Status badge class
  let stClass = 'active';
  if (st === 'cancelled') stClass = 'cancelled';
  else if (st === 'order') stClass = 'order';
  else if (st === 'tx_invoice') stClass = 'tx_invoice';
  else if (['tax_invoice', 'tax_receipt', 'receipt'].includes(st)) stClass = 'tax_invoice';

  const mkFileBtn = (sec, docNum) => {
    if(!docNum || (sec==='order' && !/\d/.test(docNum) && !String(docNum).includes('קופה'))) return '';
    let meta = inv['file_'+sec];
    let actualSec = sec;

    // Fallback if the user attached the file to a different section and left its number blank
    if (!meta || !meta.path) {
      if (sec === 'order' && !inv.num && !inv.txNum) {
        if (inv.file_tax && inv.file_tax.path) { meta = inv.file_tax; actualSec = 'tax'; }
        else if (inv.file_tx && inv.file_tx.path) { meta = inv.file_tx; actualSec = 'tx'; }
      } else if (sec === 'tx' && !inv.orderNum && !inv.num) {
        if (inv.file_tax && inv.file_tax.path) { meta = inv.file_tax; actualSec = 'tax'; }
        else if (inv.file_order && inv.file_order.path) { meta = inv.file_order; actualSec = 'order'; }
      } else if (sec === 'tax') {
        // Always fall back to any available file when no file_tax exists
        if (inv.file_order && inv.file_order.path) { meta = inv.file_order; actualSec = 'order'; }
        else if (inv.file_tx && inv.file_tx.path) { meta = inv.file_tx; actualSec = 'tx'; }
      }
    }

    if(meta && meta.path){
      const name = (window._extractNameFromUrl ? window._extractNameFromUrl(meta.path) : '') || meta.name || 'פתח';
      return `<span style="display:inline-flex;align-items:center;gap:3px;background:#e8f5e9;border:1px solid #a5d6a7;border-radius:4px;padding:2px 7px;font-size:.7rem;color:#2e7d32;cursor:pointer;font-weight:600" onclick="event.stopPropagation();invOpenFile('${inv.id || inv.serialNum}','${actualSec}')" title="${name}">📎 ${name} ↗</span>`;
    }
    // Only show "עדכן קישור" if no file exists for ANY of the related document types to prevent clutter
    const hasAnyFile = (inv.file_order && inv.file_order.path) || 
                       (inv.file_tx && inv.file_tx.path) || 
                       (inv.file_tax && inv.file_tax.path);
    if(/\d/.test(docNum) && !hasAnyFile){
      return `<span style="display:inline-flex;align-items:center;gap:2px;background:#fff8e1;border:1px solid #ffe082;border-radius:4px;padding:1px 6px;font-size:.67rem;color:#e65100;cursor:pointer" onclick="event.stopPropagation();openNewInvoice('${inv.id || inv.serialNum}')" title="עדכן קישור">📎 עדכן קישור</span>`;
    }
    return '';
  };

  const fmtAmt = (n, vat, exempt)=>{
    if(!n) return '<span style="color:#ccc">—</span>';
    if(exempt||vat===0) return `<b style="color:#2e7d32" title="פטור ממע&quot;מ">₪${n.toLocaleString()} <span style="font-size:.63rem;color:#2e7d32">(פטור)</span></b>`;
    const vatA = +(n*vat/100).toFixed(2);
    const totalVal = +(n*(1+vat/100)).toFixed(2);
    return `<span style="color:#546e7a;font-size:.75rem">₪${n.toLocaleString()}</span>`+
           `<span style="font-size:.65rem;color:#e65100;margin:0 2px">+מע"מ ₪${vatA.toLocaleString()}</span>`+
           `<b style="color:#2e7d32"> = ₪${totalVal.toLocaleString()}</b>`;
  };

  const statusLabel = {
    order: '📋 הזמנה',
    tx_invoice: '🧾 עסקה',
    tax_invoice: '📑 חשבונית מס',
    tax_receipt: '📑🧾 מס קבלה',
    receipt: '🧾 קבלה',
    cancelled: '❌ מבוטל'
  }[st] || st;

  const dateStr = inv.orderDate||inv.txDate||inv.date||'';

  let docsHtml = '';
  if (hasOrder) {
    docsHtml += `<div class="mob-inv-doc-row"><span style="font-size:.65rem;background:#e8eaf6;color:#1a237e;border-radius:4px;padding:1px 5px;font-weight:700">📋</span> <b>הזמנה:</b> <b style="cursor:pointer;color:#1565c0;text-decoration:underline" onclick="event.stopPropagation();openNewInvoice('${inv.id || inv.serialNum}')">${inv.orderNum}</b> ${inv.orderDate?`<span style="color:#888">(${window.fD ? window.fD(inv.orderDate) : inv.orderDate})</span>`:''} ${mkFileBtn('order',inv.orderNum)}</div>`;
  }
  if (hasTx) {
    docsHtml += `<div class="mob-inv-doc-row"><span style="font-size:.65rem;background:#e8f5e9;color:#2e7d32;border-radius:4px;padding:1px 5px;font-weight:700">🧾</span> <b>עסקה:</b> <b style="cursor:pointer;color:#1565c0;text-decoration:underline" onclick="event.stopPropagation();openNewInvoice('${inv.id || inv.serialNum}')">${inv.txNum}</b> ${inv.txDate?`<span style="color:#888">(${window.fD ? window.fD(inv.txDate) : inv.txDate})</span>`:''} ${mkFileBtn('tx',inv.txNum)}</div>`;
  }
  if (hasTax) {
    docsHtml += `<div class="mob-inv-doc-row"><span style="font-size:.65rem;background:#fff8e1;color:#e65100;border-radius:4px;padding:1px 5px;font-weight:700">📑</span> <b>מסמך:</b> <b style="cursor:pointer;color:#1565c0;text-decoration:underline" onclick="event.stopPropagation();openNewInvoice('${inv.id || inv.serialNum}')">${inv.num}</b> ${inv.date?`<span style="color:#888">(${window.fD ? window.fD(inv.date) : inv.date})</span>`:''} ${mkFileBtn('tax',inv.num)}</div>`;
  }

  let amountsHtml = '';
  if (hasOrder) {
    amountsHtml += `<div class="mob-inv-amt-row"><span style="font-size:.65rem;color:#546e7a">הזמנה:</span> <span>${fmtAmt(inv.orderAmt,vat,isExempt)}</span></div>`;
  }
  if (hasTx) {
    amountsHtml += `<div class="mob-inv-amt-row"><span style="font-size:.65rem;color:#546e7a">עסקה:</span> <span>${fmtAmt(inv.txAmt,vat,isExempt)}</span></div>`;
  }
  if (hasTax) {
    amountsHtml += `<div class="mob-inv-amt-row"><span style="font-size:.65rem;color:#546e7a">מסמך:</span> <span>${fmtAmt(inv.amt,vat,isExempt)}</span></div>`;
  }

  const categoryName = {enrichment:'🎨 העשרה',operations:'🔧 תפעול',breakfast:'🍞 ארוחות בוקר',transport:'🚌 נסיעות',other:'📦 אחר'}[inv.orderType] || '';
  const cityLoc = [inv.locCity, inv.locName].filter(Boolean).join(' · ');

  return `
    <div class="mob-inv-card ${stClass}" onclick="openNewInvoice('${inv.id || inv.serialNum}')">
      <div class="mob-inv-hdr">
        <div>
          <div class="mob-inv-sup">${inv.supName}</div>
          <div class="mob-inv-entity">${(window.supEx && window.supEx[inv.supName] && window.supEx[inv.supName].entityType) || ''} ${dateStr ? `· 📅 ${window.fD ? window.fD(dateStr) : dateStr}` : ''}</div>
        </div>
        <div class="mob-inv-status">
          <span class="inv-status inv-s-${st}">${statusLabel}</span>
        </div>
      </div>
      <div class="mob-inv-body">
        <div class="mob-inv-docs">
          ${docsHtml || '<div style="color:#aaa;font-size:0.75rem">טרם צורפו מסמכים</div>'}
        </div>
        ${(inv.orderDesc || categoryName || cityLoc) ? `
          <div class="mob-inv-desc">
            ${inv.orderDesc ? `<div style="font-weight:700;margin-bottom:2px">${inv.orderDesc}</div>` : ''}
            <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:#78909c">
              <span>${categoryName}</span>
              ${cityLoc ? `<span>📍 ${cityLoc}</span>` : ''}
            </div>
            ${inv.cancelReason ? `<div style="color:var(--c-error);font-weight:700;margin-top:2px">ביטול סיבת ביטול: ${inv.cancelReason}</div>` : ''}
          </div>
        ` : ''}
        ${amountsHtml ? `
          <div class="mob-inv-amounts">
            ${amountsHtml}
          </div>
        ` : ''}
      </div>
      ${!opts.compact ? `
        <div class="mob-inv-footer" onclick="event.stopPropagation()">
          <div class="mob-inv-notes" title="${inv.notes||'אין הערות'}">
            📝 ${inv.notes || 'אין הערות'}
          </div>
          <div class="mob-inv-btns">
            <button class="btn bsm bo" onclick="openNewInvoice('${inv.id || inv.serialNum}')">✏️ ערוך</button>
            <button class="btn bsm br" onclick="deleteInvoice('${inv.id || inv.serialNum}')">🗑️ מחק</button>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}
window.renderMobileInvoiceCard = renderMobileInvoiceCard;

function renderInvoices(){
  if(window.showInfoNotice) {
    window.showInfoNotice('invoices-info-wrap', '<b>ניהול רכש וחשבוניות:</b> כאן ניתן לעקוב אחר סטטוס התשלומים והמסמכים מול הספקים.', 'info', '📄');
  }
  if (Array.isArray(window.INVOICES)) {
    window.INVOICES.forEach((inv, idx) => {
      if (!inv.id && inv.id !== 0) {
        inv.id = inv.serialNum ? String(inv.serialNum) : ('inv_' + (Date.now() + idx));
      }
    });
  }
  const tbody = document.getElementById('pi-tbody');
  const mobList = document.getElementById('pi-mobile-list');
  if(!tbody) return;
  const srch = (document.getElementById('pi-srch')?.value||'').toLowerCase();
  // Multi-select status filter
  const stfArr = (typeof _getPiStSelected === 'function') ? _getPiStSelected() : [];
  const from = document.getElementById('pi-from')?.value||'';
  const to   = document.getElementById('pi-to')?.value||'';
  
  window._invSortCol = window._invSortCol || 'serialNum';
  window._invSortAsc = window._invSortAsc || false;

  let list = [...INVOICES];
  if(typeof _dupFilterActive !== 'undefined' && _dupFilterActive){ const _dids=_getDupIds(); list=list.filter(i=>_dids.has(i.id)); }
  if(srch) list = list.filter(i=>
    (i.supName||'').toLowerCase().includes(srch)||
    (i.num||'').toLowerCase().includes(srch)||
    (i.orderNum||'').toLowerCase().includes(srch)||
    (i.txNum||'').toLowerCase().includes(srch)||
    (i.orderDesc||'').toLowerCase().includes(srch)||
    (i.cancelReason||'').toLowerCase().includes(srch)
  );
  const advType   = document.getElementById('pi-type')?.value||'';
  const advAssign = document.getElementById('pi-assign')?.value||'';
  const advMonth  = document.getElementById('pi-month')?.value||'';
  const advCity   = document.getElementById('pi-city')?.value||'';
  const advLocType= document.getElementById('pi-loctype')?.value||'';
  if(advType)    list = list.filter(i=>i.orderType===advType);
  if(advAssign)  list = list.filter(i=>i.assignment===advAssign);
  if(advMonth)   list = list.filter(i=>i.actMonth===advMonth);
  if(advCity)    list = list.filter(i=>(i.locCity||'').toLowerCase()===advCity.toLowerCase());
  if(advLocType) list = list.filter(i=>i.locType===advLocType);
  if(stfArr.length){
    list = list.filter(i=>{
      const st = _migrateInvStatus(i.status);
      return stfArr.some(f=> f==='tax_receipt' ? i.status==='tax_receipt' : st===f);
    });
  }
  
  // Parse to timestamp for accurate chronological sorting
  const parseSortDate = (dStr) => {
    if (!dStr) return 0;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return new Date(dStr).getTime();
    const parts = dStr.split(/[\/\-.]/);
    if (parts.length === 3) {
      let d = parseInt(parts[0], 10), m = parseInt(parts[1], 10), y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;
      if (d > 1000) { y = d; d = parseInt(parts[2], 10); } // Handle YYYY-MM-DD that split weirdly
      if (m > 12) { const t = d; d = m; m = t; } // Handle MM/DD/YYYY format
      return new Date(y, m - 1, d).getTime();
    }
    return new Date(dStr).getTime() || 0;
  };

  if(from) {
    const fromTime = parseSortDate(from);
    list = list.filter(i=>parseSortDate(i.orderDate||i.txDate||i.date||'')>=fromTime);
  }
  if(to) {
    const toTime = parseSortDate(to);
    list = list.filter(i=>parseSortDate(i.orderDate||i.txDate||i.date||'')<=toTime);
  }
  
  const sortCol = window._invSortCol || 'serialNum';
  const isAsc = window._invSortAsc;
  
  list.sort((a,b)=>{
    if (sortCol === 'date') {
      const da = a.orderDate||a.txDate||a.date||'', db = b.orderDate||b.txDate||b.date||'';
      const timeA = parseSortDate(da);
      const timeB = parseSortDate(db);
      if (timeA !== timeB) return isAsc ? timeA - timeB : timeB - timeA;
    }
    else if (sortCol === 'supName') {
      const vA = (a.supName||'').toLowerCase();
      const vB = (b.supName||'').toLowerCase();
      if(vA!==vB) return isAsc ? vA.localeCompare(vB) : vB.localeCompare(vA);
    }
    else if (sortCol === 'docNum') {
      const vA = String(a.orderNum||a.txNum||a.num||'');
      const vB = String(b.orderNum||b.txNum||b.num||'');
      if(vA!==vB) return isAsc ? vA.localeCompare(vB, undefined, {numeric: true}) : vB.localeCompare(vA, undefined, {numeric: true});
    }
    else if (sortCol === 'serialNum') {
      const vA = String(a.serialNum||'');
      const vB = String(b.serialNum||'');
      if(vA!==vB) return isAsc ? vA.localeCompare(vB, undefined, {numeric: true}) : vB.localeCompare(vA, undefined, {numeric: true});
    }
    else if (sortCol === 'sumBase') {
      const vA = Number(a.orderAmt||a.txAmt||a.amt||0);
      const vB = Number(b.orderAmt||b.txAmt||b.amt||0);
      if(vA!==vB) return isAsc ? vA - vB : vB - vA;
    }
    else if (sortCol === 'status') {
      const vA = window.normalizeInvoiceStatus ? window.normalizeInvoiceStatus(a) : _migrateInvStatus(a.status);
      const vB = window.normalizeInvoiceStatus ? window.normalizeInvoiceStatus(b) : _migrateInvStatus(b.status);
      if(vA!==vB) return isAsc ? vA.localeCompare(vB) : vB.localeCompare(vA);
    }
    else if (sortCol === 'orderDesc') {
      const vA = (a.orderDesc||'').toLowerCase();
      const vB = (b.orderDesc||'').toLowerCase();
      if(vA!==vB) return isAsc ? vA.localeCompare(vB) : vB.localeCompare(vA);
    }
    return isAsc ? (a.id - b.id) : (b.id - a.id);
  });
  const fmtAmt = (n, vat, exempt)=>{
    if(!n) return '<span style="color:#ccc">—</span>';
    if(exempt||vat===0) return `<b style="color:#2e7d32" title="פטור ממע&quot;מ">₪${n.toLocaleString()} <span style="font-size:.63rem;color:#2e7d32">(פטור)</span></b>`;
    const vatA = +(n*vat/100).toFixed(2);
    const tot  = +(n*(1+vat/100)).toFixed(2);
    return `<span style="color:#546e7a;font-size:.75rem">₪${n.toLocaleString()}</span>`+
           `<span style="font-size:.65rem;color:#e65100;margin:0 2px">+מע"מ ₪${vatA.toLocaleString()}</span>`+
           `<b style="color:#2e7d32"> = ₪${tot.toLocaleString()}</b>`;
  };
  const statusStepper = (stRaw, invRef)=>{
    const invObj = (typeof stRaw === 'object' && stRaw !== null) ? stRaw : invRef;
    const st = invObj ? (window.normalizeInvoiceStatus ? window.normalizeInvoiceStatus(invObj) : _migrateInvStatus(invObj.status)) : _migrateInvStatus(stRaw);
    if(st==='tax_receipt') return `<span style="background:#1b5e20;color:#fff;border-radius:10px;padding:2px 8px;font-size:.63rem;font-weight:700">📑🧾 חשבונית מס קבלה</span>`;
    const stages = [
      {k:'order',l:'הזמנה',c:'#1565c0'},
      {k:'tx_invoice',l:'עסקה',c:'#6a1b9a'},
      {k:'tax_invoice',l:'חשבונית מס',c:'#2e7d32'},
      {k:'receipt',l:'קבלה',c:'#2e7d32'}
    ];
    if(st==='cancelled') return `<span style="background:#ffcdd2;color:#c62828;border-radius:10px;padding:2px 8px;font-size:.65rem;font-weight:700">❌ מבוטל</span>`;
    const cur = stages.findIndex(s=>s.k===st);
    if(cur<0) return `<span style="color:#888;font-size:.65rem">${st}</span>`;
    return `<div style="display:flex;gap:2px;align-items:center;flex-wrap:wrap">` +
      stages.slice(0,cur+1).map((s,i)=>{
        const isLast = i===cur;
        const bg = isLast?s.c:'#e0e0e0';
        const col = isLast?'#fff':'#999';
        return `<div style="background:${bg};color:${col};border-radius:10px;padding:2px 7px;font-size:.63rem;font-weight:700;white-space:nowrap">${s.l}</div>`;
      }).join('') + `</div>`;
  };

  const MAX_RENDER = 150;
  const isCapped = list.length > MAX_RENDER;
  const renderList = isCapped ? list.slice(0, MAX_RENDER) : list;
  let cappedMsg = isCapped ? `<div style="text-align:center;color:#888;padding:15px;font-size:0.8rem">מציג ${MAX_RENDER} תוצאות מתוך ${list.length}. השתמש בחיפוש למיקוד...</div>` : '';
  
  if (window._invoicesPartialLoad) {
    cappedMsg += `<div style="text-align:center;padding:12px">
       <button class="btn bo" onclick="loadMoreInvoices()" style="font-size:0.8rem;padding:6px 18px">
         📥 טען את כל החשבוניות (${INVOICES.length} נטענו מתוך הכל)
       </button>
     </div>`;
  }

  if (window.isMobileMode()) {
    if(!renderList.length){
      if (mobList) mobList.innerHTML = '<div style="text-align:center;color:#aaa;padding:25px">אין חשבוניות תואמות לסינון</div>';
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#aaa;padding:25px">אין חשבוניות תואמות לסינון</td></tr>';
      return;
    }
    if (mobList) {
      mobList.innerHTML = renderList.map(inv => renderMobileInvoiceCard(inv)).join('');
      if(isCapped) mobList.innerHTML += cappedMsg;
    }
    tbody.innerHTML = '';
  } else {
    
    if(!list.length){
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#aaa;padding:25px">אין חשבוניות תואמות לסינון</td></tr>';
      if (mobList) mobList.innerHTML = '';
      return;
    }
    tbody.innerHTML = renderList.map(inv=>{
      if(!inv.supName) return '';
      const vat = inv.vat||getVatRate();
      const isExempt = vat===0 || (supEx[inv.supName]||{}).entityType==='עוסק פטור'||(supEx[inv.supName]||{}).entityType==='עמותה';
      const hasOrder = inv.orderNum;
      const hasTx    = inv.txNum;
      const hasTax   = inv.num;
      const mkFileBtn = (sec, docNum) => {
        if(!docNum || (sec==='order' && !/\d/.test(docNum) && !String(docNum).includes('קופה'))) return '';
        let meta = inv['file_'+sec];
        let actualSec = sec;

        // Fallback if the user attached the file to a different section and left its number blank
        if (!meta || !meta.path) {
          if (sec === 'order' && !inv.num && !inv.txNum) {
            if (inv.file_tax && inv.file_tax.path) { meta = inv.file_tax; actualSec = 'tax'; }
            else if (inv.file_tx && inv.file_tx.path) { meta = inv.file_tx; actualSec = 'tx'; }
          } else if (sec === 'tx' && !inv.orderNum && !inv.num) {
            if (inv.file_tax && inv.file_tax.path) { meta = inv.file_tax; actualSec = 'tax'; }
            else if (inv.file_order && inv.file_order.path) { meta = inv.file_order; actualSec = 'order'; }
          } else if (sec === 'tax') {
            // Always fall back to any available file when no file_tax exists
            if (inv.file_order && inv.file_order.path) { meta = inv.file_order; actualSec = 'order'; }
            else if (inv.file_tx && inv.file_tx.path) { meta = inv.file_tx; actualSec = 'tx'; }
          }
        }

        if(meta && meta.path){
          const name = _extractNameFromUrl(meta.path)||meta.name||'פתח';
          return `<span style="display:inline-flex;align-items:center;gap:3px;background:#e8f5e9;border:1px solid #a5d6a7;border-radius:4px;padding:2px 7px;font-size:.7rem;color:#2e7d32;cursor:pointer;font-weight:600" onclick="event.stopPropagation();invOpenFile('${inv.id || inv.serialNum}','${actualSec}')" title="${name}">📎 ${name} ↗</span>`;
        }
        const hasAnyFile = (inv.file_order && inv.file_order.path) || 
                           (inv.file_tx && inv.file_tx.path) || 
                           (inv.file_tax && inv.file_tax.path);
        if(/\d/.test(docNum) && !hasAnyFile){
          return `<span style="display:inline-flex;align-items:center;gap:2px;background:#fff8e1;border:1px solid #ffe082;border-radius:4px;padding:1px 6px;font-size:.67rem;color:#e65100;cursor:pointer" onclick="event.stopPropagation();openNewInvoice('${inv.id || inv.serialNum}')" title="עדכן קישור לקובץ">📎 עדכן קישור</span>`;
        }
        return '';
      };
      const _isDup = (typeof _dupFilterActive !== 'undefined' && _dupFilterActive);
      return `<tr class="inv-row-clickable" style="${_isDup?'background:#fce4ec;border-right:3px solid #c62828;':''}" onclick="openNewInvoice('${inv.id || inv.serialNum}')">
        <td style="font-size:.75rem;padding:8px;font-weight:600;color:#546e7a">
          ${inv.serialNum||''}
        </td>
        <td style="min-width:120px;padding:8px;cursor:pointer" onclick="event.stopPropagation(); if(window.openSupCard) window.openSupCard('${(inv.supName||'').replace(/'/g,"\\'").replace(/"/g,"&quot;")}'); else if(window.openSupModal) window.openSupModal('${(inv.supName||'').replace(/'/g,"\\'").replace(/"/g,"&quot;")}');">
          <div style="font-weight:700;color:#1a237e;font-size:.83rem;text-decoration:underline">${inv.supName||''}</div>
          <div style="font-size:.67rem;color:#999;margin-top:2px;text-decoration:none">${(supEx[inv.supName]||{}).entityType||''}</div>
        </td>
        <td style="font-size:.75rem;line-height:2;padding:8px">
          ${hasOrder?`<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap"><span style="font-size:.65rem;background:#e8eaf6;color:#1a237e;border-radius:4px;padding:1px 5px;font-weight:700">📋</span> <b style="cursor:pointer;color:#1565c0;text-decoration:underline" onclick="event.stopPropagation();openNewInvoice('${inv.id || inv.serialNum}')">${inv.orderNum}</b>${inv.orderDate?'<span style="color:#999"> · '+fD(inv.orderDate)+'</span>':''} ${mkFileBtn('order',inv.orderNum)}</div>`:''}
          ${hasTx?`<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap"><span style="font-size:.65rem;background:#e8f5e9;color:#2e7d32;border-radius:4px;padding:1px 5px;font-weight:700">🧾</span> <b style="cursor:pointer;color:#1565c0;text-decoration:underline" onclick="event.stopPropagation();openNewInvoice('${inv.id || inv.serialNum}')">${inv.txNum}</b>${inv.txDate?'<span style="color:#999"> · '+fD(inv.txDate)+'</span>':''} ${mkFileBtn('tx',inv.txNum)}</div>`:''}
          ${hasTax?`<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap"><span style="font-size:.65rem;background:#fff8e1;color:#e65100;border-radius:4px;padding:1px 5px;font-weight:700">📑</span> <b style="cursor:pointer;color:#1565c0;text-decoration:underline" onclick="event.stopPropagation();openNewInvoice('${inv.id || inv.serialNum}')">${inv.num}</b>${inv.date?'<span style="color:#999"> · '+fD(inv.date)+'</span>':''} ${mkFileBtn('tax',inv.num)}</div>`:''}
        </td>
        <td style="font-size:.75rem;color:#37474f;padding:8px">
          ${inv.orderDesc||''}
          ${inv.orderType?`<div style="font-size:.65rem;color:#1565c0">${{enrichment:'🎨 העשרה',operations:'🔧 תפעול',breakfast:'🍞 ארוחות בוקר',transport:'🚌 נסיעות',other:'📦 אחר'}[inv.orderType]||''}</div>`:''}
          ${inv.locCity||inv.locName?`<div style="font-size:.65rem;color:#546e7a">📍 ${[inv.locCity,inv.locName].filter(Boolean).join(' · ')}</div>`:''}
          ${inv.cancelReason?`<div style="font-size:.64rem;color:#c62828">❌ ${inv.cancelReason}</div>`:''}
        </td>
        <td style="font-size:.75rem;padding:8px;white-space:nowrap">
          ${hasOrder?`<div style="margin-bottom:3px"><span style="font-size:.63rem;color:#546e7a">הזמנה: </span>${fmtAmt(inv.orderAmt,vat,isExempt)}</div>`:''}
          ${hasTx?`<div style="margin-bottom:3px"><span style="font-size:.63rem;color:#546e7a">עסקה: </span>${fmtAmt(inv.txAmt,vat,isExempt)}</div>`:''}
          ${hasTax?`<div><span style="font-size:.63rem;color:#546e7a">מסמך: </span>${fmtAmt(inv.amt,vat,isExempt)}</div>`:''}
        </td>
        <td style="padding:8px">${statusStepper(inv)}</td>
        <td style="font-size:.72rem;color:#78909c;max-width:120px;padding:8px">${inv.notes||'אין הערות'}</td>
        <td style="padding:8px;white-space:nowrap" onclick="event.stopPropagation()">
          <button class="btn bsm bo" onclick="openNewInvoice('${inv.id || inv.serialNum}')">✏️</button>
          <button class="btn bsm br" onclick="deleteInvoice('${inv.id || inv.serialNum}')">🗑️</button>
        </td>
      </tr>`;
    }).join('');
    if(isCapped){
      tbody.innerHTML += `<tr><td colspan="8">${cappedMsg}</td></tr>`;
    }
    if (mobList) mobList.innerHTML = '';
  }
  let qaRow = document.getElementById('qa-tr-row') || document.getElementById('qa-tr-container');
  if (qaRow && window.renderQuickAddRowHtml) {
    qaRow.outerHTML = window.renderQuickAddRowHtml();
  }
  
  // --- Update header UI to show active filters ---
  document.querySelectorAll('#pi-table th').forEach(th => {
    const btn = th.querySelector('.col-filter-btn');
    if (btn) { btn.style.color = '#7986cb'; btn.style.fontWeight = 'normal'; }
  });
  
  if (window._invColFilters) {
    for (const col of Object.keys(window._invColFilters)) {
      const btn = document.querySelector(`th[onclick*="'${col}'"] .col-filter-btn`);
      if (btn) {
        btn.style.color = '#e65100'; // Highlight color for active filter
        btn.style.fontWeight = 'bold';
      }
    }
  }
}

window.loadMoreInvoices = async function() {
  if (window.showToast) window.showToast('טוען חשבוניות נוספות...');
  const all = await window.loadAllInvoices();
  if (all && all.length > 0) {
    window.INVOICES = all;
    window._invoicesPartialLoad = false;
    renderInvoices();
    refreshPurchDash();
    if (window.showToast) window.showToast(`נטענו ${all.length} חשבוניות`);
  }
};

function refreshPurchDash(){
  const invs = INVOICES;
  const partialEl = document.getElementById('ps-partial-note');
  if (partialEl) {
    partialEl.style.display = window._invoicesPartialLoad ? 'block' : 'none';
    partialEl.innerHTML = window._invoicesPartialLoad 
      ? `<span style="font-size:.7rem;color:#e65100">⚠️ מציג ${invs.length} חשבוניות אחרונות בלבד. <a href="#" onclick="loadMoreInvoices();return false" style="color:#1565c0">טען הכל</a></span>` 
      : '';
  }
  const byStatus = st => invs.filter(i=>(window.normalizeInvoiceStatus ? window.normalizeInvoiceStatus(i) : _migrateInvStatus(i.status))===st).length;
  const totalOrders = byStatus('order');
  const totalTx = byStatus('tx_invoice');
  const totalTax = byStatus('tax_invoice') + byStatus('receipt') + invs.filter(i=>(window.normalizeInvoiceStatus ? window.normalizeInvoiceStatus(i) : i.status)==='tax_receipt').length;
  const totalCancelled = byStatus('cancelled');
  const invEl = document.getElementById('ps-invoices'); if(invEl) invEl.textContent = invs.length;
  const supEl = document.getElementById('ps-suppliers'); if(supEl) supEl.textContent = getPurchSuppliers().length;
  const openEl = document.getElementById('ps-open'); if(openEl) openEl.textContent = totalOrders + totalTx;
  const issEl = document.getElementById('ps-issues'); if(issEl) issEl.textContent = totalTax;
  
  const activeInvs = invs.filter(i=>(window.normalizeInvoiceStatus ? window.normalizeInvoiceStatus(i) : _migrateInvStatus(i.status))!=='cancelled');
  const sumBase  = activeInvs.reduce((s,i)=>s+(i.orderAmt||i.txAmt||i.amt||0),0);
  const sumTotal = activeInvs.reduce((s,i)=>s+(i.orderTotal||i.txTotal||i.total||0),0);
  const vatSumEl = document.getElementById('ps-vat-summary');
  if(vatSumEl && activeInvs.length){
    vatSumEl.innerHTML =
      `<span style="color:#546e7a">לפני מע"מ: <b>₪${sumBase.toLocaleString('he-IL',{maximumFractionDigits:0})}</b></span>`+
      `<span style="margin:0 10px;color:#c5cae9">|</span>`+
      `<span style="color:#2e7d32">כולל מע"מ: <b style="font-size:.9rem">₪${sumTotal.toLocaleString('he-IL',{maximumFractionDigits:0})}</b></span>`;
  } else if(vatSumEl){ vatSumEl.innerHTML=''; }
  
  const ACTIVE_ST = new Set(['order','tx_invoice']);
  const rec = [...invs]
    .filter(i=>ACTIVE_ST.has(window.normalizeInvoiceStatus ? window.normalizeInvoiceStatus(i) : _migrateInvStatus(i.status)))
    .sort((a,b)=> (a.id||0) - (b.id||0)) // Sort oldest to newest
    .slice(0,10);
  const el = document.getElementById('pdash-recent-invoices');
  if(!el) return;
  if(!rec.length){ el.innerHTML='<div style="color:#aaa;font-size:.8rem;text-align:center;padding:20px">אין הזמנות או חשבוניות עסקה פתוחות</div>'; return; }
  
  if (window.isMobileMode()) {
    el.innerHTML = rec.map(i => renderMobileInvoiceCard(i, { compact: true })).join('');
  } else {
    const fmtAmt2=(base,total,vat)=>{
      if(!base&&!total) return '—';
      if(vat===0) return `<span style="color:#2e7d32">₪${base.toLocaleString()}</span> <span style="font-size:.62rem;color:#888">(פטור)</span>`;
      const t=total||base;
      return `<span style="color:#546e7a;font-size:.73rem">₪${base.toLocaleString()}</span><b style="color:#2e7d32"> = ₪${t.toLocaleString()}</b>`;
    };
    const stLabel={order:'📋 הזמנה',tx_invoice:'🧾 חשבונית עסקה'};
    el.innerHTML=`<table style="width:100%;font-size:.78rem;border-collapse:collapse">
      <thead><tr style="background:#e8f5e9;position:sticky;top:0">
        <th style="padding:5px 8px;text-align:right">ספק</th>
        <th style="padding:5px 8px;text-align:right">מסמכים</th>
        <th style="padding:5px 8px;text-align:right">פירוט</th>
        <th style="padding:5px 8px;text-align:left">סכומים</th>
        <th style="padding:5px 8px">סטטוס</th>
        <th style="padding:5px 8px;text-align:right">הערות</th>
      </tr></thead>
      <tbody>${rec.map(i=>{
        const st=window.normalizeInvoiceStatus ? window.normalizeInvoiceStatus(i) : _migrateInvStatus(i.status);
        const base=i.orderAmt||i.txAmt||i.amt||0;
        const total=i.orderTotal||i.txTotal||i.total||0;
        const dateStr=i.orderDate||i.txDate||i.date||'';
        const mkDashDoc = (icon, docNum, sec) => {
          if(!docNum) return '';
          const showBadge = !(sec==='order' && !/\d/.test(docNum));
          let meta = i['file_'+sec];
          let actualSec = sec;
          // Fallback: if no file in this section, use any available file
          if (!meta || !meta.path) {
            if (sec === 'tax') {
              if (i.file_order && i.file_order.path) { meta = i.file_order; actualSec = 'order'; }
              else if (i.file_tx && i.file_tx.path) { meta = i.file_tx; actualSec = 'tx'; }
            } else if (sec === 'order' && !i.num && !i.txNum) {
              if (i.file_tax && i.file_tax.path) { meta = i.file_tax; actualSec = 'tax'; }
              else if (i.file_tx && i.file_tx.path) { meta = i.file_tx; actualSec = 'tx'; }
            }
          }
          const hasAnyFile = (i.file_order && i.file_order.path) || 
                             (i.file_tx && i.file_tx.path) || 
                             (i.file_tax && i.file_tax.path);
          let badge = '';
          if(showBadge){
            if(meta && meta.path){
              const name = _extractNameFromUrl(meta.path)||meta.name||'פתח';
              badge = `<span style="display:inline-flex;align-items:center;gap:2px;background:#e8f5e9;border:1px solid #a5d6a7;border-radius:4px;padding:1px 5px;font-size:.63rem;color:#2e7d32;cursor:pointer;font-weight:600" onclick="event.stopPropagation();invOpenFile(${i.id},'${actualSec}')" title="${name}">📎 ${name} ↗</span>`;
            } else if(/\d/.test(docNum) && !hasAnyFile){
              badge = `<span style="display:inline-flex;align-items:center;background:#fff8e1;border:1px solid #ffe082;border-radius:3px;padding:1px 5px;font-size:.63rem;color:#e65100;cursor:pointer" onclick="event.stopPropagation();openNewInvoice(${i.id})">📎 עדכן קישור</span>`;
            }
          }
          return `<div style="display:flex;align-items:center;gap:4px;white-space:nowrap">${icon} ${docNum} ${badge}</div>`;
        };
        const docs = [
          mkDashDoc('📋',i.orderNum,'order'),
          mkDashDoc('🧾',i.txNum,'tx'),
          mkDashDoc('📑',i.num,'tax')
        ].filter(Boolean).join('');
        return '<tr onclick="openNewInvoice('+i.id+')" class="inv-row-clickable" style="border-bottom:1px solid #f0f4f8">'+
          '<td style="padding:5px 8px;font-weight:700;color:#1a237e">'+i.supName+'<br><span style="font-weight:400;color:#888;font-size:.7rem">'+dateStr+'</span></td>'+
          '<td style="padding:5px 8px;font-size:.72rem">'+(docs||'—')+'</td>'+
          '<td style="padding:5px 8px;max-width:130px;font-size:.72rem;color:#444">'+(i.orderDesc||'').slice(0,35)+'</td>'+
          '<td style="padding:5px 8px;white-space:nowrap">'+fmtAmt2(base,total,i.vat||0)+'</td>'+
          '<td style="padding:5px 8px"><span style="font-size:.72rem">'+(stLabel[st]||st)+'</span></td>'+
          '<td style="padding:5px 8px;font-size:.7rem;color:#666;max-width:110px">'+(i.notes ? i.notes.slice(0,25) : 'אין הערות')+'</td>'+
          '</tr>';
      }).join('')}</tbody>
    </table>`;
  }
}

// INVOICES DATA
window.INVOICES = [];
var VAT_RATE = 18; // Default VAT % — editable by user in invoice settings

// ════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════
// FILE LINK STORAGE — stores OneDrive/SharePoint URLs or local paths
// ════════════════════════════════════════════════════════
let _pendingFiles = {order:null, tx:null, tax:null};

// Classify what kind of path/URL we have
function _classifyPath(p) {
  const s = (p||'').trim();
  if(!s) return {type:'empty'};
  // Direct web URL (SharePoint, OneDrive web, any https)
  if(/^https?:\/\//i.test(s)) return {type:'url', url:s};
  // Local path containing OneDrive in it
  if(/OneDrive/i.test(s)) return {type:'onedrive_local', raw:s};
  // UNC network path
  if(s.startsWith('\\\\') || s.startsWith('//')) return {type:'unc', raw:s};
  // Any other local path
  return {type:'local', raw:s};
}

function _copyToClipboard(text) {
  navigator.clipboard?.writeText(text).then(()=>window.showToast('📋 הועתק!')).catch(()=>{
    const ta=document.createElement('textarea');
    ta.value=text; ta.style.cssText='position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta); ta.select();
    try{document.execCommand('copy');}catch(e){}
    document.body.removeChild(ta);
    window.showToast('📋 הועתק!');
  });
}

function _removeOverlay(id) { document.getElementById(id)?.remove(); }

// Called when user picks a file via <input type="file">
// Extract a readable filename from a URL
function _extractNameFromUrl(url){
  if(!url) return '';
  try {
    const u = new URL(url);
    // OneDrive/SharePoint: look for "sourcedoc" or last path segment
    const src = u.searchParams.get('file') || u.searchParams.get('sourcedoc') || '';
    if(src) return decodeURIComponent(src.replace(/.*[/\\]/,''));
    const parts = u.pathname.split('/').filter(Boolean);
    const last = decodeURIComponent(parts[parts.length-1]||'');
    // Strip query-like suffixes and known share tokens
    if(last && !/^[A-Za-z0-9_-]{20,}$/.test(last)) return last;
  } catch(e){}
  return 'קובץ מצורף';
}
// Show the link pill (hides the input row)
function _invShowPill(section){
  const pi       = document.getElementById('inv-path-'+section);
  const inputRow = document.getElementById('inv-path-input-row-'+section);
  const pill     = document.getElementById('inv-path-pill-'+section);
  const pillName = document.getElementById('inv-path-pill-name-'+section);
  const hint     = document.getElementById('inv-path-hint-'+section);
  const delBtn   = document.getElementById('inv-file-del-'+section);
  const val      = pi ? pi.value.trim() : '';
  const displayName = _extractNameFromUrl(val);
  if(pillName) pillName.textContent = displayName;
  if(inputRow) inputRow.style.display = 'none';
  if(pill)     pill.style.display = 'flex';
  if(hint)     hint.textContent = '';
  if(delBtn)   delBtn.style.display = 'inline';
}

// "ערוך" — switch back to input row
function invEditLink(section){
  const inputRow = document.getElementById('inv-path-input-row-'+section);
  const pill     = document.getElementById('inv-path-pill-'+section);
  const pi       = document.getElementById('inv-path-'+section);
  if(inputRow) inputRow.style.display = 'flex';
  if(pill)     pill.style.display = 'none';
  if(pi)       { pi.focus(); pi.select(); }
}

// Called when user types/pastes a link
function invPathChange(section){
  const pi = document.getElementById('inv-path-'+section);
  if(!pi) return;
  if(!_pendingFiles[section]) _pendingFiles[section]={name:'',path:''};
  _pendingFiles[section].path = pi.value.trim();
  const val = pi.value.trim();
  const hint = document.getElementById('inv-path-hint-'+section);
  if(!val){
    pi.style.borderColor='#c5cae9';
    if(hint) hint.textContent='';
    return;
  }
  const c = _classifyPath(val);
  if(c.type==='url'){
    pi.style.borderColor='#2e7d32';
    if(hint){ hint.textContent='✅ קישור תקין'; hint.style.color='#2e7d32'; }
    // After short delay, collapse into pill
    clearTimeout(pi._pillTimer);
    pi._pillTimer = setTimeout(()=>_invShowPill(section), 800);
  } else if(c.type==='onedrive_local' || c.type==='unc'){
    pi.style.borderColor='#e65100';
    if(hint){ hint.textContent='⚠️ נתיב מקומי — השתמש בקישור OneDrive (שתף → העתק קישור)'; hint.style.color='#e65100'; }
  } else {
    pi.style.borderColor='#b0bec5';
    if(hint){ hint.textContent='❓ לא מזוהה כקישור תקין'; hint.style.color='#9e9e9e'; }
  }
}

// Main open function
function invOpenFile(invId, section){
  const inv = window.INVOICES.find(i=>i.id===invId);
  if(!inv) return;
  const meta = inv['file_'+section];
  if(!meta){ window.showToast('❌ לא צורף קובץ לסעיף זה'); return; }
  if(!meta.path){
    _showPathDialog(invId, section, meta);
    return;
  }
  _invTryOpen(meta.path, invId, section, meta);
}

function _invTryOpen(p, invId, section, meta){
  let fixedUrl = p || '';
  try {
    const decodedUrl = decodeURI(fixedUrl);
    if (decodedUrl.includes('sharepoint.com') && decodedUrl.includes('צהרונים - מסמכים')) {
      fixedUrl = decodedUrl.replace('צהרונים - מסמכים', 'Shared Documents');
    }
  } catch(e) {}
  
  const c = _classifyPath(fixedUrl);

  // ✅ Direct URL (SharePoint, OneDrive web) — opens immediately
  if(c.type==='url'){
    window.open(c.url, '_blank');
    return;
  }

  // ⚠️ Local OneDrive path — browser CANNOT open file:// — show guidance
  if(c.type==='onedrive_local' || c.type==='local' || c.type==='unc'){
    _showLocalPathHelp(p, invId, section, meta, c.type);
    return;
  }
}

// Dialog: user hasn't set a path yet
function _showPathDialog(invId, section, meta){
  const name = meta?.name || '';
  const secLabel = {order:'הזמנה',tx:'חשבונית עסקה',tax:'חשבונית מס'}[section]||section;
  const div = document.createElement('div');
  div.id = 'path-dlg-overlay';
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  div.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:22px;max-width:500px;width:94%;box-shadow:0 8px 32px rgba(0,0,0,.25);direction:rtl">
      <div style="font-weight:800;color:#1a237e;font-size:.95rem;margin-bottom:10px">🔗 קישור לקובץ — ${secLabel}</div>
      ${name?`<div style="font-size:.75rem;color:#2e7d32;margin-bottom:10px">📎 שם קובץ: <b>${name}</b></div>`:''}
      <div style="background:#e3f2fd;border-radius:8px;padding:10px 13px;font-size:.78rem;color:#0d47a1;margin-bottom:14px;line-height:1.8">
        <b>איך לקבל קישור מ-OneDrive עסקי:</b><br>
        1. פתח את OneDrive / סייר הקבצים<br>
        2. קליק ימני על הקובץ → <b>שתף</b> (Share)<br>
        3. לחץ <b>העתק קישור</b> (Copy link)<br>
        4. הדבק כאן 👇
      </div>
      <input type="text" id="path-dlg-input"
        placeholder="הדבק כאן קישור OneDrive / SharePoint..."
        style="width:100%;font-size:.8rem;border-radius:6px;border:1.5px solid #90caf9;padding:8px 10px;box-sizing:border-box;direction:ltr;text-align:left;margin-bottom:6px">
      <div id="path-dlg-hint" style="font-size:.7rem;color:#888;margin-bottom:12px;min-height:18px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="_pd-cancel" class="btn bs bsm">ביטול</button>
        <button id="_pd-save"   class="btn bp bsm">💾 שמור קישור</button>
        <button id="_pd-open"   class="btn borange bsm">🔗 שמור ופתח</button>
      </div>
    </div>`;
  document.body.appendChild(div);
  div.querySelector('#_pd-cancel').addEventListener('click', ()=>_removeOverlay('path-dlg-overlay'));
  div.querySelector('#_pd-save').addEventListener('click',   ()=>_pathDlgSave(invId, section));
  div.querySelector('#_pd-open').addEventListener('click',   ()=>_pathDlgOpen(invId, section));
  const inp = document.getElementById('path-dlg-input');
  inp.focus();
  inp.addEventListener('input', ()=>{
    const v = inp.value.trim();
    const hint = document.getElementById('path-dlg-hint');
    const c = _classifyPath(v);
    if(c.type==='url') hint.innerHTML = '✅ קישור תקין — ייפתח ישירות';
    else if(c.type==='onedrive_local') hint.innerHTML = '⚠️ זה נתיב מקומי. דפדפן לא יכול לפתוח אותו. השתמש בקישור OneDrive.';
    else if(v) hint.innerHTML = '⚠️ לא מזוהה כקישור תקין';
    else hint.innerHTML = '';
  });
}
function _pathDlgSave(invId, section){
  const val = document.getElementById('path-dlg-input')?.value.trim();
  if(!val) return;
  const inv = window.INVOICES.find(i=>i.id===invId);
  if(inv){
    const meta = inv['file_'+section]||{name:''};
    inv['file_'+section] = {...meta, path:val};
    window.save();
    const pi = document.getElementById('inv-path-'+section);
    if(pi){pi.value=val; invPathChange(section);}
    window.showToast('✅ קישור נשמר');
  }
  _removeOverlay('path-dlg-overlay');
}
function _pathDlgOpen(invId, section){
  _pathDlgSave(invId, section);
  const inv = INVOICES.find(i=>i.id===invId);
  if(inv && inv['file_'+section]?.path) _invTryOpen(inv['file_'+section].path, invId, section, inv['file_'+section]);
}

// Dialog: user has a local path (can't open in browser)
function _showLocalPathHelp(p, invId, section, meta, pathType){
  const isOD = pathType==='onedrive_local';
  const div = document.createElement('div');
  div.id = 'localhelp-overlay';
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  div.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:22px;max-width:480px;width:94%;box-shadow:0 8px 32px rgba(0,0,0,.25);direction:rtl">
      <div style="font-weight:800;color:#e65100;font-size:.92rem;margin-bottom:10px">
        ${isOD?'☁️ נתיב OneDrive מקומי':'📁 נתיב מקומי'}
      </div>
      <div style="background:#fff3e0;border-radius:8px;padding:10px 13px;font-size:.78rem;color:#bf360c;margin-bottom:12px;line-height:1.8">
        הדפדפן <b>לא יכול לפתוח קבצים מקומיים</b> מסיבות אבטחה.<br>
        ${isOD?'<b>הפתרון:</b> השתמש בקישור OneDrive (לא נתיב מקומי).':''}
      </div>
      ${isOD?`
      <div style="background:#e3f2fd;border-radius:8px;padding:10px 13px;font-size:.78rem;color:#0d47a1;margin-bottom:14px;line-height:1.8">
        <b>כיצד לקבל קישור שיעבוד:</b><br>
        1. קליק ימני על הקובץ ב-OneDrive / סייר קבצים<br>
        2. <b>שתף → העתק קישור</b><br>
        3. חזור כאן ולחץ "עדכן קישור" למטה
      </div>`:''}
      <div style="background:#f5f5f5;border-radius:6px;padding:8px 10px;font-size:.7rem;font-family:monospace;direction:ltr;text-align:left;word-break:break-all;margin-bottom:14px;color:#555"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
        <button id="_lh-close" class="btn bs bsm">סגור</button>
        <button id="_lh-copy"  class="btn bo bsm">📋 העתק נתיב</button>
        <button id="_lh-open"  class="btn bg bsm">📂 נסה לפתוח</button>
        <button id="_lh-edit"  class="btn bp bsm">🔗 עדכן קישור</button>
      </div>
    </div>`;
  // Set path text safely (no innerHTML injection)
  div.querySelector('div[style*="monospace"]').textContent = p;
  document.body.appendChild(div);
  // Wire buttons via addEventListener — avoids quote/backslash issues in onclick attrs
  div.querySelector('#_lh-close').addEventListener('click', () => _removeOverlay('localhelp-overlay'));
  div.querySelector('#_lh-copy').addEventListener('click', () => {
    _copyToClipboard(p); window.showToast('✅ נתיב הועתק'); _removeOverlay('localhelp-overlay');
  });
  div.querySelector('#_lh-open').addEventListener('click', () => _tryOpenLocalFile(p));
  div.querySelector('#_lh-edit').addEventListener('click', () => {
    _removeOverlay('localhelp-overlay'); _showPathDialog(invId, section, meta);
  });
}

window.openInvoiceFile = function(url, invId) {
  let fixedUrl = url || '';
  try {
    const decodedUrl = decodeURI(fixedUrl);
    if (decodedUrl.includes('sharepoint.com') && decodedUrl.includes('צהרונים - מסמכים')) {
      fixedUrl = decodedUrl.replace('צהרונים - מסמכים', 'Shared Documents');
    }
  } catch(e) {}
  const c = _classifyPath(fixedUrl);
  if (c.type === 'url') {
    window.open(c.url, '_blank');
  } else {
    _showLocalPathHelp(fixedUrl, invId, 'file', { name: _extractNameFromUrl(fixedUrl) || 'קובץ סרוק' }, c.type);
  }
};

function invOpenFileFromModal(section){
  if(_editInvId) invOpenFile(_editInvId, section);
}

// No async needed — nothing to save to IndexedDB
function invSaveFiles(invId){ return Promise.resolve(); }



// Invoices saved via main save() function

// ── Suppliers: add purchaseSupplier flag ───────────────
// Each supplier in SUPS[] now has: actSupplier (bool), purchSupplier (bool)
// actSupplier = shows in חוגים tab; purchSupplier = shows in רכש tab
// For backward compat: if neither field exists, assume actSupplier=true

// Supplier helpers using the real data model (SUPBASE + supEx)
function isActSupplier(name){ 
  if (typeof window.supEx === 'undefined') return true;
  const base = typeof window.supBase === 'function' ? window.supBase(name) : name;
  const ex = window.supEx[name] || window.supEx[base] || {};
  return ex.isAct !== false; // default true for backward compat
}
window.isActSupplier = isActSupplier;
function isPurchSupplier(name){ 
  if (typeof window.supEx === 'undefined') return true;
  const base = typeof window.supBase === 'function' ? window.supBase(name) : name;
  const ex = window.supEx[name] || window.supEx[base] || {};
  return ex.isPurch !== false;
}
window.isPurchSupplier = isPurchSupplier;
function getAllSupNames(){
  const names = new Set();
  if(typeof window.getAllSup==='function') {
    window.getAllSup().forEach(s => names.add(s.name));
  }
  if(Array.isArray(window.INVOICES)) {
    window.INVOICES.forEach(inv => {
      if(inv.supName) names.add(window.supBase ? window.supBase(inv.supName) : inv.supName);
    });
  }
  return Array.from(names);
}
function rebuildMergedSupplierActs(){
  // After merges, some supEx entries may have stale empty acts arrays
  // Clear them so auto-derive from SCH kicks in
  Object.keys(window.supEx).forEach(name=>{
    const ex = window.supEx[name];
    if(Array.isArray(ex.acts) && ex.acts.length===0){
      delete ex.acts; // Let getSupActs auto-derive from SCH
    }
  });
  window.save();
}

function getPurchSuppliers(){ 
  const baseMap = new Map();
  if(typeof window.SUPBASE !== 'undefined') {
    window.SUPBASE.forEach(s => baseMap.set(s.name, s));
  }
  return getAllSupNames().filter(name=>isPurchSupplier(name)).map(name=>{
    const ex=(typeof window.supEx!=='undefined'?window.supEx:{})[name]||{};
    const base=baseMap.get(name)||{};
    return {id: base.id||name, name, phone: ex.ph1||base.phone||'', tax:ex.g1||'', email:ex.email||''};
  });
}
function suTypeChg(){
  const isAct = document.getElementById('su-is-act')?.checked;
  const isPurch = document.getElementById('su-is-purch');
  // Acts visible only if חוגים
  const actsWrap = document.getElementById('su-acts-wrap');
  if(actsWrap) actsWrap.style.display = isAct ? 'block' : 'none';
  // If acts supplier, must also be purch
  if(isAct && isPurch && !isPurch.checked) isPurch.checked = true;
}
function sucTypeChg(){
  const isActEl = document.getElementById('suc-edit-is-act');
  const isPurchEl = document.getElementById('suc-edit-is-purch');
  const isAct = isActEl?.checked;
  const warnEl = document.getElementById('suc-type-warn');
  if(warnEl) warnEl.style.display = !isAct ? 'block' : 'none';
  // Activity supplier must also be a purchase supplier
  if(isAct && isPurchEl) isPurchEl.checked = true;
  // Show/hide acts section
  const actsWrap = document.getElementById('suc-acts-wrap');
  if(actsWrap) actsWrap.style.display = isAct ? 'block' : 'none';
}

// ── Invoice modal ──────────────────────────────────────
let _editInvId = null;

// ── VAT helpers ────────────────────────────────────────
function getVatRate(){ return window.VAT_RATE||18; }
function vatAmt(base, rate){ return +(base * rate / 100).toFixed(2); }
function withVat(base, rate){ return +(base * (1 + rate/100)).toFixed(2); }

function openNewInvoiceForSupplier(supName){
  switchMode('purch');
  SPT('pinvoices');
  setTimeout(()=>{ openNewInvoice(null, supName); }, 100);
}
function autoUpdateInvStatus(){
  const hasOrder = !!(document.getElementById('inv-order-num')?.value?.trim());
  const hasTx    = !!(document.getElementById('inv-tx-num')?.value?.trim());
  const hasInv   = !!(document.getElementById('inv-num')?.value?.trim());
  const stEl = document.getElementById('inv-status');
  if(!stEl || stEl.value === 'cancelled') return;
  const isExempt = (document.getElementById('inv-tax-section-note')?.style.display !== 'none');
  if(hasInv){
    const newSt = isExempt ? 'receipt' : (hasTx ? 'tax_receipt' : 'tax_invoice');
    stEl.value = newSt;
    // Sync doc-type buttons
    if(['tax_invoice','tax_receipt','receipt'].includes(newSt)) setInvDocType(newSt);
  } else if(hasTx) stEl.value = 'tx_invoice';
  else if(hasOrder) stEl.value = 'order';
}
function invStatusChg(){
  const st = document.getElementById('inv-status')?.value;
  const wrap = document.getElementById('inv-cancel-reason-wrap');
  if(wrap) wrap.style.display = st==='cancelled' ? 'block' : 'none';
}
function setTxVatMode(m){
  document.getElementById('vat-tx-ex')?.classList.toggle('active',m==='ex');
  document.getElementById('vat-tx-inc')?.classList.toggle('active',m==='inc');
  window._txVatMode = m;
  calcTxVat();
}
// Populate city dropdown from GARDENS data
function _fillInvCityDropdown(currentCity){
  const sel = document.getElementById('inv-loc-city');
  const otherInp = document.getElementById('inv-loc-city-other');
  if(!sel) return;
  const cities = [...new Set(window.GARDENS.map(g=>g.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'he'));
  sel.innerHTML = '<option value="">-- בחר עיר --</option>' +
    cities.map(c=>`<option value="${c}">${c}</option>`).join('') +
    '<option value="__other__">אחר (הכנס ידנית)</option>';
  if(currentCity){
    if(cities.includes(currentCity)){
      sel.value = currentCity;
      if(otherInp) otherInp.style.display='none';
    } else {
      sel.value = '__other__';
      if(otherInp){ otherInp.style.display='block'; otherInp.value=currentCity; }
    }
  } else {
    sel.value = '';
    if(otherInp) otherInp.style.display='none';
  }
}

function invAssignChange(sel){
  const other = document.getElementById('inv-assignment-other');
  if(!other) return;
  if(sel.value==='__other__'){ other.style.display='block'; other.focus(); }
  else { other.style.display='none'; other.value=''; }
}
function _getInvAssignment(){
  const sel = document.getElementById('inv-assignment');
  if(!sel) return '';
  if(sel.value==='__other__') return document.getElementById('inv-assignment-other')?.value.trim()||'';
  return sel.value;
}

function invLocCityChange(sel){
  const otherInp = document.getElementById('inv-loc-city-other');
  if(!otherInp) return;
  if(sel.value==='__other__'){
    otherInp.style.display='block'; otherInp.focus();
  } else {
    otherInp.style.display='none'; otherInp.value='';
  }
}
function _getInvLocCity(){
  const sel = document.getElementById('inv-loc-city');
  if(!sel) return '';
  if(sel.value==='__other__'){
    return document.getElementById('inv-loc-city-other')?.value.trim()||'';
  }
  return sel.value;
}

function invClearFile(sec){
  const openBtn  = document.getElementById('inv-file-open-'+sec);
  const delBtn   = document.getElementById('inv-file-del-'+sec);
  const pathInp  = document.getElementById('inv-path-'+sec);
  const hint     = document.getElementById('inv-path-hint-'+sec);
  const inputRow = document.getElementById('inv-path-input-row-'+sec);
  const pill     = document.getElementById('inv-path-pill-'+sec);
  if(openBtn)  openBtn.style.display='none';
  if(delBtn)   delBtn.style.display='none';
  if(pathInp){ pathInp.value=''; pathInp.style.borderColor='#c5cae9'; }
  if(hint)     hint.textContent='';
  if(inputRow) inputRow.style.display='flex';
  if(pill)     pill.style.display='none';
  // Clear saved data too if editing existing invoice
  if(_editInvId){
    const inv = window.INVOICES.find(i=>i.id===_editInvId);
    if(inv){ inv['file_'+sec]=null; window.save(); }
  }
  _pendingFiles[sec]=null;
}
async function deleteInvoiceFromModal(){
  if(!_editInvId) return;
  if(!await window.spConfirm('למחוק מסמך זה לגמרי?')) return;
  window.INVOICES = window.INVOICES.filter(i=>i.id!==_editInvId);
  window.deleteInvoiceFromFirebase(_editInvId);
  window.save(true); window.CM('invoice-m'); renderInvoices(); refreshPurchDash();
  window.showToast('🗑️ המסמך נמחק');
}
function resetInvFilter(){
  const ids = ['pi-srch','pi-from','pi-to','pi-type','pi-assign','pi-month','pi-city','pi-loctype'];
  ids.forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.querySelectorAll('.pi-st-cb').forEach(cb=>cb.checked=false);
  const allCb=document.getElementById('pi-st-all'); if(allCb) allCb.checked=false;
  _setPiStLabel();
  try{ window._safeLS.removeItem(window.PI_ST_KEY); }catch(e){}
  const sortEl=document.getElementById('pi-sort'); if(sortEl) sortEl.value='desc';
  renderInvoices();
}
function openNewInvoice(id, presetSup){
  _editInvId = (id !== null && id !== undefined && id !== '') ? id : null;
  const inv = _editInvId ? window.INVOICES.find(i => String(i.id) === String(_editInvId) || (i.serialNum && String(i.serialNum) === String(_editInvId))) : null;
  if (inv) _editInvId = inv.id;
  document.getElementById('inv-m-title').textContent = inv ? '✏️ עריכת מסמך' : '📄 מסמך חדש';
  // Supplier autocomplete datalist
  const dl = document.getElementById('inv-sup-datalist');
  if(dl){
    // Use getAllSup so merged supplier names are up-to-date
    dl.innerHTML = window.getAllSup().map(s=>{
      const ex=window.supEx[s.name]||{};
      // Escape quotes in name for HTML attribute
      const safeVal = s.name.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
      return `<option value="${safeVal}">${s.name}${ex.entityType?' ['+ex.entityType+']':''}`;
    }).join('');
  }
  // Fill supplier text input
  const supTxt = document.getElementById('inv-sup-text');
  if(supTxt){
    supTxt.value = inv ? (inv.supName||'') : (presetSup||'');
    // If preset or existing, trigger entity type update
    const supName = supTxt.value;
    if(supName) invUpdateEntityType((window.supEx[supName]||{}).entityType||'');
  }
  document.getElementById('inv-new-sup-wrap').style.display='none';
  // Clear new supplier fields (fix 18 - don't keep old supplier data)
  ['inv-ns-name','inv-ns-tax','inv-ns-phone','inv-ns-contact','inv-ns-email','inv-ns-addr'].forEach(fid=>{
    const el=document.getElementById(fid); if(el) el.value='';
  });
  const nsEntity=document.getElementById('inv-ns-entity'); if(nsEntity) nsEntity.value='';
  const nsActs=document.getElementById('inv-ns-acts'); if(nsActs) nsActs.checked=false;
  // VAT rate
  document.getElementById('inv-vat').value = inv ? (inv.vat||getVatRate()) : getVatRate();
  const effectiveVatCalc = _getEffectiveVat();
  onVatChange();
  // Order section
  document.getElementById('inv-serial-num').value  = inv ? (inv.serialNum||'')  : '';
  document.getElementById('inv-order-num').value   = inv ? (inv.orderNum||'')   : '';
  document.getElementById('inv-order-date').value  = inv ? (inv.orderDate||'')  : '';
  document.getElementById('inv-order-desc').value  = inv ? (inv.orderDesc||'')  : '';
  // Restore order VAT mode (so editing doesn't recalculate wrong)
  const ordVatModeR = inv ? (inv.ordVatMode||'ex') : 'ex';
  window._ordVatMode = ordVatModeR;
  document.getElementById('vat-ord-ex')?.classList.toggle('active', ordVatModeR==='ex');
  document.getElementById('vat-ord-inc')?.classList.toggle('active', ordVatModeR==='inc');
  document.getElementById('inv-order-amt').value   = inv ? (ordVatModeR==='inc' && inv.orderAmt ? withVat(inv.orderAmt, effectiveVatCalc) : (inv.orderAmt||''))   : '';
  document.getElementById('inv-order-notes').value = inv ? (inv.orderNotes||'') : '';
  const ordType = document.getElementById('inv-order-type'); if(ordType) ordType.value=inv?(inv.orderType||''):'';
  // Load assignment — handle free text case
  const assignEl = document.getElementById('inv-assignment');
  const assignOther = document.getElementById('inv-assignment-other');
  if(assignEl){
    const knownAssign = ['shared','daycare','chanuka','pesach','longday','summer','general',''];
    const savedAssign = inv?(inv.assignment||''):'';
    if(knownAssign.includes(savedAssign)){
      assignEl.value = savedAssign;
      if(assignOther){ assignOther.style.display='none'; assignOther.value=''; }
    } else {
      assignEl.value = '__other__';
      if(assignOther){ assignOther.style.display='block'; assignOther.value=savedAssign; }
    }
  }
  const actMonthEl = document.getElementById('inv-act-month'); if(actMonthEl) actMonthEl.value=inv?(inv.actMonth||''):'';
  // Location fields (25)
  _fillInvCityDropdown(inv ? (inv.locCity||'') : '');
  const locType=document.getElementById('inv-loc-type'); if(locType) locType.value=inv?(inv.locType||''):'';
  const locName=document.getElementById('inv-loc-name'); if(locName) locName.value=inv?(inv.locName||''):'';
  calcOrderVat();
  // TX section
  document.getElementById('inv-tx-num').value  = inv ? (inv.txNum||'')  : '';
  document.getElementById('inv-tx-date').value = inv ? (inv.txDate||'') : '';
  document.getElementById('inv-tx-amt').value  = inv ? (inv.txAmt||'')  : '';
  // TX VAT mode
  const txMode = inv ? (inv.txVatMode||'ex') : 'ex';
  window._txVatMode = txMode;
  document.getElementById('vat-tx-ex')?.classList.toggle('active', txMode==='ex');
  document.getElementById('vat-tx-inc')?.classList.toggle('active', txMode==='inc');
  calcTxVat();
  // Tax invoice section
  document.getElementById('inv-num').value  = inv ? (inv.num||'')  : '';
  document.getElementById('inv-date').value = inv ? (inv.date||'') : '';
  document.getElementById('inv-amt').value  = inv ? (inv.amt||'')  : '';
  // Restore inv VAT mode
  const invVatModeR = inv ? (inv.invVatMode||'ex') : 'ex';
  window._invVatMode = invVatModeR;
  document.getElementById('vat-inv-ex')?.classList.toggle('active', invVatModeR==='ex');
  document.getElementById('vat-inv-inc')?.classList.toggle('active', invVatModeR==='inc');
  calcInvTotal();
  // Status - use new values, migrate old
  const st = inv ? _migrateInvStatus(inv.status) : 'order';
  const stEl = document.getElementById('inv-status');
  if(stEl) stEl.value = st;
  invStatusChg();
  // Sync doc-type buttons to match saved status
  if(['tax_invoice','tax_receipt','receipt'].includes(st)){
    setInvDocType(st);
  } else {
    setInvDocType('tax_invoice'); // default
  }
  // Cancel reason
  const crEl = document.getElementById('inv-cancel-reason'); if(crEl) crEl.value=inv?(inv.cancelReason||''):'';
  // Recv date (relabeled to "תאריך טיפול")
  // תאריך טיפול: תמיד עדכן להיום, אלא אם המשתמש הכניס תאריך שונה ידנית
  const _today = new Date().toISOString().slice(0,10);
  const _savedRecv = inv ? (inv.recv||'') : '';
  const _savedTs   = inv ? (inv.ts   ? new Date(inv.ts).toISOString().slice(0,10) : '') : '';
  // If saved date equals last-save date (i.e. was auto-set), replace with today
  document.getElementById('inv-recv').value = (_savedRecv && _savedRecv !== _savedTs) ? _savedRecv : _today;
  document.getElementById('inv-notes').value = inv ? (inv.notes||'')  : '';
  const _txNotesEl = document.getElementById('inv-tx-notes');
  if(_txNotesEl) _txNotesEl.value = inv ? (inv.txNotes||'') : '';
  const _notDupEl = document.getElementById('inv-not-dup');
  if(_notDupEl) _notDupEl.checked = inv ? (inv.notDup||false) : false;
  // VAT settings row hidden by default
  const vsRow = document.getElementById('vat-settings-row');
  if(vsRow) vsRow.style.display='none';
  // Delete button - show only when editing
  const delBtn = document.getElementById('inv-del-btn');
  if(delBtn) delBtn.style.display = id ? 'inline' : 'none';
  // Reset new supplier form
  const nsWrap=document.getElementById('inv-new-sup-wrap');
  if(nsWrap) nsWrap.style.display='none';
  const supTxtEl=document.getElementById('inv-sup-text');
  // Don't reset if presetSup is being used (already set above)
  ['inv-ns-name','inv-ns-tax','inv-ns-phone','inv-ns-contact','inv-ns-email','inv-ns-addr'].forEach(fid=>{
    const el=document.getElementById(fid); if(el) el.value='';
  });
  const nsEntity2=document.getElementById('inv-ns-entity'); if(nsEntity2) nsEntity2.value='';
  const nsActsChk = document.getElementById('inv-ns-acts');
  if(nsActsChk) nsActsChk.checked=false;
  const nsActsFields = document.getElementById('inv-ns-acts-fields');
  if(nsActsFields) nsActsFields.style.display='none';
  // Reset file fields & populate from existing invoice data
  _pendingFiles = {order:null, tx:null, tax:null};
  ['order','tx','tax'].forEach(sec=>{
    const pi          = document.getElementById('inv-path-'+sec);
    const openBtn     = document.getElementById('inv-file-open-'+sec);
    const delBtn      = document.getElementById('inv-file-del-'+sec);
    const pathOpenBtn = document.getElementById('inv-path-open-'+sec);
    const hint        = document.getElementById('inv-path-hint-'+sec);
    const meta = inv && inv['file_'+sec];
    // Populate path field
    if(pi)     pi.value = (meta && meta.path) ? meta.path : '';
    // Show/hide open+delete buttons
    const hasPath = !!(meta && meta.path);
    if(openBtn) openBtn.style.display = hasPath ? 'inline' : 'none';
    if(delBtn)  delBtn.style.display  = hasPath ? 'inline' : 'none';
    // Validate path color + hint
    if(hasPath){
      // Show as pill immediately when loading existing data
      setTimeout(()=>_invShowPill(sec), 0);
    } else {
      const inputRow = document.getElementById('inv-path-input-row-'+sec);
      const pill     = document.getElementById('inv-path-pill-'+sec);
      if(inputRow) inputRow.style.display = 'flex';
      if(pill)     pill.style.display = 'none';
      if(pathOpenBtn) pathOpenBtn.style.display='none';
      if(pi) pi.style.borderColor='#c5cae9';
      if(hint) hint.textContent='';
    }
  });
  document.getElementById('invoice-m').classList.add('open');
}
function _migrateInvStatus(st){
  if(!st) return 'order';
  const map = {active:'order',new:'order',in_progress:'tx_invoice',partial:'tx_invoice',closed:'tax_invoice',ok:'tax_invoice'};
  return map[st]||st;
}
// Label/emoji for each status
function _statusLabel(st){
  const m = {
    order:{l:'הזמנה',e:'📋'},
    tx_invoice:{l:'חשבונית עסקה',e:'🧾'},
    tax_invoice:{l:'חשבונית מס',e:'📑'},
    tax_receipt:{l:'חשבונית מס קבלה',e:'📑🧾'},
    receipt:{l:'קבלה',e:'📄'},
    cancelled:{l:'מבוטל',e:'❌'}
  };
  return m[_migrateInvStatus(st)]||{l:st,e:'⚪'};
}
// Update tax-invoice section title and note based on supplier entity type
function setInvDocType(type){
  // Update the 3-button toggle inside the tax section
  const map = {tax_invoice:'inv-doc-tax', tax_receipt:'inv-doc-taxrec', receipt:'inv-doc-rec'};
  ['tax_invoice','tax_receipt','receipt'].forEach(t=>{
    document.getElementById(map[t])?.classList.toggle('active', t===type);
  });
  // Sync the status select — only change if already a final-doc status
  const stEl = document.getElementById('inv-status');
  if(stEl && ['tax_invoice','tax_receipt','receipt'].includes(stEl.value)){
    stEl.value = type;
  }
}

function invUpdateEntityType(entityType){
  const taxSection = document.getElementById('inv-tax-section');
  const taxTitle   = document.getElementById('inv-tax-section-title');
  const taxNote    = document.getElementById('inv-tax-section-note');
  if(!taxSection) return;
  const isExempt = entityType==='עוסק פטור'||entityType==='עמותה';
  if(taxTitle){
    taxTitle.textContent = isExempt
      ? '📑 קבלה (עוסק פטור / עמותה)'
      : '📑 חשבונית מס / קבלה';
  }
  if(taxNote) taxNote.style.display = isExempt ? 'block' : 'none';
  // Show/hide doc-type buttons based on exempt status
  const docTax    = document.getElementById('inv-doc-tax');
  const docTaxRec = document.getElementById('inv-doc-taxrec');
  const docRec    = document.getElementById('inv-doc-rec');
  if(isExempt){
    if(docTax)    { docTax.style.display='none';    docTax.classList.remove('active'); }
    if(docTaxRec) { docTaxRec.style.display='none'; docTaxRec.classList.remove('active'); }
    if(docRec)    { docRec.style.display='';        docRec.classList.add('active'); }
    // Force status to receipt for exempt
    const stEl=document.getElementById('inv-status');
    if(stEl && ['tax_invoice','tax_receipt'].includes(stEl.value)) stEl.value='receipt';
  } else {
    if(docTax)    docTax.style.display='';
    if(docTaxRec) docTaxRec.style.display='';
    if(docRec)    docRec.style.display='';
    // Default to חשבונית מס for regular suppliers if coming from exempt
    if(docRec && !docTax?.classList.contains('active') && !docTaxRec?.classList.contains('active')){
      docTax?.classList.add('active');
      docRec?.classList.remove('active');
    }
  }
  const numEl = document.getElementById('inv-num');
  if(numEl) numEl.placeholder = isExempt ? "מס' קבלה" : "מס' חשבונית מס";
  if(typeof onVatChange === 'function') onVatChange();
}


function invNsActsChg(){
  const checked = document.getElementById('inv-ns-acts')?.checked;
  const wrap = document.getElementById('inv-ns-acts-fields');
  if(wrap) wrap.style.display = checked ? 'block' : 'none';
}
function invSupTextChg(){
  const val = document.getElementById('inv-sup-text')?.value||'';
  const showNew = val==='__new__';
  document.getElementById('inv-new-sup-wrap').style.display = showNew ? 'block' : 'none';
  if(showNew){
    // Clear new supplier form
    ['inv-ns-name','inv-ns-tax','inv-ns-phone','inv-ns-contact','inv-ns-email','inv-ns-addr'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.value='';
    });
    const nsE=document.getElementById('inv-ns-entity'); if(nsE) nsE.value='';
    const nsA=document.getElementById('inv-ns-acts'); if(nsA){ nsA.checked=false; invNsActsChg(); }
    setTimeout(()=>document.getElementById('inv-ns-name')?.focus(),50);
  } else if(val && val!=='__new__'){
    const ex = supEx[val]||{};
    invUpdateEntityType(ex.entityType||'');
  }
}

function invEntityTypeChg(){
  const et = document.getElementById('inv-ns-entity')?.value||'';
  invUpdateEntityType(et);
}

window._ordVatMode='ex'; window._invVatMode='ex';
function setOrderVatMode(m){
  window._ordVatMode=m;
  document.getElementById('vat-ord-ex')?.classList.toggle('active',m==='ex');
  document.getElementById('vat-ord-inc')?.classList.toggle('active',m==='inc');
  calcOrderVat();
}
function setInvVatMode(m){
  window._invVatMode=m;
  document.getElementById('vat-inv-ex')?.classList.toggle('active',m==='ex');
  document.getElementById('vat-inv-inc')?.classList.toggle('active',m==='inc');
  calcInvTotal();
}
function _getEffectiveVat(){
  // Returns 0 for exempt suppliers, otherwise the configured VAT rate
  const supName = document.getElementById('inv-sup-text')?.value?.trim()||'';
  const base = window.supBase(supName);
  const entityType = (window.supEx[supName]||window.supEx[base]||{}).entityType||
    document.getElementById('inv-ns-entity')?.value||'';
  if(entityType==='עוסק פטור'||entityType==='עמותה') return 0;
  return parseFloat(document.getElementById('inv-vat')?.value)||getVatRate();
}
function calcOrderVat(){
  const raw = parseFloat(document.getElementById('inv-order-amt').value)||0;
  const vat = _getEffectiveVat();
  const vr = vat/100;
  const amt = window._ordVatMode==='inc' ? +(raw/(1+vr)).toFixed(2) : raw;
  const lbl=document.getElementById('inv-order-vat-lbl');
  if(vat===0){
    if(lbl&&raw) lbl.textContent='פטור ממע"מ';
    else if(lbl) lbl.textContent='';
  } else {
    if(lbl&&raw) lbl.textContent=window._ordVatMode==='inc'?`→ לפני מע"מ: ₪${amt.toFixed(2)}`:`→ כולל מע"מ: ₪${(amt*(1+vr)).toFixed(2)}`;
    else if(lbl) lbl.textContent='';
  }
  const el = id => document.getElementById(id);
  if(el('inv-order-base'))    el('inv-order-base').textContent    = amt ? '₪'+amt.toLocaleString() : '—';
  if(el('inv-order-vat-amt')) el('inv-order-vat-amt').textContent = amt ? (vat===0?'₪0 (פטור)':'₪'+vatAmt(amt,vat).toLocaleString()) : '—';
  if(el('inv-order-total'))   el('inv-order-total').textContent   = amt ? '₪'+(vat===0?amt:withVat(amt,vat)).toLocaleString() : '—';
}

function calcTxVat(){
  const raw = parseFloat(document.getElementById('inv-tx-amt').value)||0;
  const txMode = window._txVatMode||'ex';
  const vat = _getEffectiveVat();
  const amt = txMode==='inc' ? +(raw/(1+vat/100)).toFixed(2) : raw;
  const el = id => document.getElementById(id);
  if(el('inv-tx-base'))    el('inv-tx-base').textContent    = amt ? '₪'+amt.toLocaleString() : '—';
  if(el('inv-tx-vat-amt')) el('inv-tx-vat-amt').textContent = amt ? (vat===0?'₪0 (פטור)':'₪'+vatAmt(amt,vat).toLocaleString()) : '—';
  if(el('inv-tx-total'))   el('inv-tx-total').textContent   = amt ? '₪'+(vat===0?amt:withVat(amt,vat)).toLocaleString() : '—';
}

function calcInvTotal(){
  const raw2 = parseFloat(document.getElementById('inv-amt').value)||0;
  const vat = _getEffectiveVat();
  const vr2 = vat/100;
  const amt = window._invVatMode==='inc' ? +(raw2/(1+vr2)).toFixed(2) : raw2;
  const lbl2=document.getElementById('inv-amt-vat-lbl');
  if(vat===0){
    if(lbl2&&raw2) lbl2.textContent='פטור ממע"מ';
    else if(lbl2) lbl2.textContent='';
  } else {
    if(lbl2&&raw2) lbl2.textContent=window._invVatMode==='inc'?`→ לפני מע"מ: ₪${amt.toFixed(2)}`:`→ כולל מע"מ: ₪${(amt*(1+vr2)).toFixed(2)}`;
    else if(lbl2) lbl2.textContent='';
  }
  const el = id => document.getElementById(id);
  if(el('inv-base-disp')) el('inv-base-disp').textContent = amt ? '₪'+amt.toLocaleString() : '—';
  if(el('inv-vat-amt'))   el('inv-vat-amt').textContent   = amt ? (vat===0?'₪0 (פטור)':'₪'+vatAmt(amt,vat).toLocaleString()) : '—';
  if(el('inv-total'))     el('inv-total').textContent     = amt ? '₪'+(vat===0?amt:withVat(amt,vat)).toLocaleString() : '—';
}

function onVatChange(){
  calcOrderVat(); calcTxVat(); calcInvTotal();
}

function toggleVatSettings(){
  const row = document.getElementById('vat-settings-row');
  if(!row) return;
  if(row.style.display==='none'){
    document.getElementById('vat-rate-input').value = document.getElementById('inv-vat').value || getVatRate();
    row.style.display='flex';
  } else {
    row.style.display='none';
  }
}

function saveVatRate(){
  const v = parseFloat(document.getElementById('vat-rate-input').value);
  if(isNaN(v)||v<0||v>100){ _spAlertDialog('יש להזין אחוז תקין (0–100)'); return; }
  window.VAT_RATE = v;
  document.getElementById('inv-vat').value = v;
  onVatChange();
  window.save();
  window.showToast('✅ שיעור מע"מ עודכן ל-'+v+'%');
  document.getElementById('vat-settings-row').style.display='none';
}

async function saveInvoice(){
  // Get supplier — from text input (autocomplete) or new supplier form
  let supName = (document.getElementById('inv-sup-text')?.value||'').trim();
  if(supName==='__new__') supName=''; // will be set from ns-name below
  const isNewSup = !supName || (!getPurchSuppliers().find(s=>s.name===supName) && !getAllSup().find(s=>s.name===supName));
  const nsWrap = document.getElementById('inv-new-sup-wrap');
  const nsName = document.getElementById('inv-ns-name')?.value.trim();
  if(nsWrap && nsWrap.style.display!=='none' && nsName){
    // New supplier form is open — nsName already read above
    if(!nsName){ _spAlertDialog('יש להזין שם ספק'); return; }
    const entityType = document.getElementById('inv-ns-entity')?.value||'';
    if(typeof window.supEx !== 'undefined'){
      if(!window.supEx['__c']) window.supEx['__c']=[];
      if(!window.supEx['__c'].find(s=>s.name===nsName))
        window.supEx['__c'].push({id:Date.now(),name:nsName,phone:document.getElementById('inv-ns-phone')?.value.trim()});
      const nsIsAct = document.getElementById('inv-ns-acts')?.checked||false;
    window.supEx[nsName]={...(window.supEx[nsName]||{}),
        ph1:document.getElementById('inv-ns-phone')?.value.trim(),
        email:document.getElementById('inv-ns-email')?.value.trim(),
        contact:document.getElementById('inv-ns-contact')?.value.trim(),
        addr:document.getElementById('inv-ns-addr')?.value.trim(),
        g1:document.getElementById('inv-ns-tax')?.value.trim(),
        alias:nsIsAct?(document.getElementById('inv-ns-alias')?.value.trim()||''):'',
        entityType,
        isAct:nsIsAct, isPurch:true};
    }
    supName = nsName;
    // Update the text input to show the new supplier name
    const stEl=document.getElementById('inv-sup-text');
    if(stEl) stEl.value=nsName;
    // Hide new supplier form
    if(nsWrap) nsWrap.style.display='none';
  }
  if(!supName){ _spAlertDialog('יש לבחור ספק'); return; }
  const num      = document.getElementById('inv-num').value.trim();
  const txNum    = document.getElementById('inv-tx-num').value.trim();
  const orderNum = document.getElementById('inv-order-num').value.trim();
  if(!orderNum && !txNum && !num){
    _spAlertDialog('יש להזין לפחות מספר הזמנה, מספר חשבונית עסקה, או מספר חשבונית מס'); return;
  }
  // Check duplicate order number — only for purely numeric numbers (letters/mixed = internal codes, skip)
  if(orderNum && /^\d+$/.test(orderNum)){
    const dup = window.INVOICES.find(i=>i.orderNum===orderNum && i.id!==_editInvId);
    if(dup && !await window.spConfirm(`⚠️ מספר הזמנה ${orderNum} כבר קיים אצל "${dup.supName}". לשמור בכל זאת?`)) return;
  }
  const vat      = parseFloat(document.getElementById('inv-vat').value)||getVatRate();
  const ordMode  = window._ordVatMode||'ex';
  const txMode   = window._txVatMode||'ex';
  const invMode  = window._invVatMode||'ex';
  const rawOrder = parseFloat(document.getElementById('inv-order-amt').value)||0;
  const rawTx    = parseFloat(document.getElementById('inv-tx-amt').value)||0;
  const rawAmt   = parseFloat(document.getElementById('inv-amt').value)||0;
  // Exempt suppliers (עוסק פטור / עמותה) — no VAT
  const _supEntityType = (window.supEx[supName]||window.supEx[window.supBase(supName)]||{}).entityType||'';
  const isExemptSave = _supEntityType==='עוסק פטור' || _supEntityType==='עמותה';
  const effectiveVat = isExemptSave ? 0 : vat;
  const orderAmt = ordMode==='inc' ? +(rawOrder/(1+effectiveVat/100)).toFixed(2) : rawOrder;
  const txAmt    = txMode==='inc'  ? +(rawTx/(1+effectiveVat/100)).toFixed(2)   : rawTx;
  const amt      = invMode==='inc' ? +(rawAmt/(1+effectiveVat/100)).toFixed(2)  : rawAmt;
  const invId    = _editInvId || Date.now();

  const existingInv = _editInvId ? window.INVOICES.find(i=>i.id===_editInvId) : null;
  const fileMeta = {};
  for(const sec of ['order','tx','tax']){
    const pathEl = document.getElementById('inv-path-'+sec);
    const path = pathEl ? pathEl.value.trim() : '';
    const name = path ? _extractNameFromUrl(path) : '';
    fileMeta['file_'+sec] = path ? {name, path} : null;
  }
  // Warn if order number filled but no file attached (30)
  // Warn about missing file only for numeric order numbers (letters = internal codes, no file needed)
  if(orderNum && /^\d+$/.test(orderNum) && !fileMeta.file_order && !await window.spConfirm('⚠️ לא צורף קובץ הזמנה. לשמור בכל זאת?')) return;

  const status = document.getElementById('inv-status')?.value||'order';
  const inv = {
    id:invId, supName, vat: effectiveVat,
    serialNum:document.getElementById('inv-serial-num')?.value.trim()||'',
    orderNum, orderDate:document.getElementById('inv-order-date').value,
    orderDesc:document.getElementById('inv-order-desc').value.trim(),
    orderType:document.getElementById('inv-order-type')?.value||'',
    assignment:_getInvAssignment(),
    actMonth:document.getElementById('inv-act-month')?.value||'',
    orderAmt, orderVat:vatAmt(orderAmt,effectiveVat), orderTotal:withVat(orderAmt,effectiveVat),
    ordVatMode: ordMode,
    orderNotes:document.getElementById('inv-order-notes').value.trim(),
    locCity:_getInvLocCity(),
    locType:document.getElementById('inv-loc-type')?.value||'',
    locName:document.getElementById('inv-loc-name')?.value.trim()||'',
    txNum, txDate:document.getElementById('inv-tx-date').value,
    txAmt, txVat:vatAmt(txAmt,effectiveVat), txTotal:withVat(txAmt,effectiveVat),
    txVatMode: txMode,
    num, date:document.getElementById('inv-date').value,
    amt, vatAmt:vatAmt(amt,effectiveVat), total:withVat(amt,effectiveVat),
    invVatMode: invMode,
    recv:document.getElementById('inv-recv').value,
    status,
    cancelReason: status==='cancelled' ? (document.getElementById('inv-cancel-reason')?.value.trim()||'') : '',
    notes:document.getElementById('inv-notes').value.trim(),
    txNotes:document.getElementById('inv-tx-notes')?.value.trim()||'',
    notDup: document.getElementById('inv-not-dup')?.checked||false,
    ...fileMeta,
    ts: existingInv?.ts || Date.now()
  };
  if(_editInvId){
    const idx=window.INVOICES.findIndex(i=>i.id===_editInvId);
    if(idx>=0) window.INVOICES[idx]=inv;
  } else {
    window.INVOICES.push(inv);
  }
  // Auto-create supplier card if not exists — must be in supEx['__c'] to appear in list
  if(supName && supName!=='__new__'){
    const inSupbase = (typeof window.SUPBASE!=='undefined') && window.SUPBASE.some(s=>window.supBase(s.name)===supName);
    if(!window.supEx[supName]) window.supEx[supName]={};
    if(window.supEx[supName].isPurch===undefined) window.supEx[supName].isPurch=true;
    if(!inSupbase){
      if(!window.supEx['__c']) window.supEx['__c']=[];
      if(!window.supEx['__c'].find(s=>window.supBase(s.name)===supName)){
        window.supEx['__c'].push({id:Date.now(),name:supName,phone:window.supEx[supName].ph1||''});
      }
      // Invoice-created suppliers are purch-only by default (not חוגים)
      if(window.supEx[supName].isAct===undefined) window.supEx[supName].isAct=false;
    }
  }
  window.saveInvoiceToFirebase(inv);
  window.save();
  try { await invSaveFiles(invId); } catch(e){ window.showToast('⚠️ שגיאה בשמירת קובץ: '+e.message); }
  window.CM('invoice-m');
  renderInvoices(); refreshPurchDash();
  window.showToast('✅ מסמך נשמר בהצלחה');
}

// ── Create supplier cards for all existing invoices (run once) ──
function createMissingSupCards(){
  // Ensure every supplier in invoices/SCH appears in the supplier list
  const inSupbase = new Set(window.SUPBASE.map(s=>window.supBase(s.name)));
  if(!window.supEx['__c']) window.supEx['__c']=[];
  let created=0;
  // 1. From INVOICES
  window.INVOICES.forEach(inv=>{
    const name=inv.supName;
    if(!name) return;
    const base=window.supBase(name);
    if(!window.supEx[base]) window.supEx[base]={};
    if(window.supEx[base].isPurch===undefined) window.supEx[base].isPurch=true;
    // Add to __c if not in SUPBASE and not already in __c
    if(!inSupbase.has(base) && !window.supEx['__c'].find(s=>window.supBase(s.name)===base)){
      window.supEx['__c'].push({id:Date.now()+Math.random(),name:base,phone:window.supEx[base].ph1||''});
      created++;
    }
  });

  // 2. From SCH (any supplier in schedules should have a card)
  if(typeof window.SCH!=='undefined') window.SCH.forEach(s=>{
    if(!s.a) return;
    const base=window.supBase(s.a);
    if(!base) return;
    if(!window.supEx[base]) window.supEx[base]={};
    if(!inSupbase.has(base) && !window.supEx['__c'].find(c=>window.supBase(c.name)===base)){
      window.supEx['__c'].push({id:Date.now()+Math.random(),name:base,phone:''});
      created++;
    }
  });

  if(created>0){ window.save(); console.log(`✅ נוצרו ${created} כרטיסי ספק חסרים`); }
}
async function deleteInvoice(id){
  if(!await window.spConfirm('למחוק חשבונית זו?')) return;
  window.INVOICES=window.INVOICES.filter(i=>i.id!==id);
  window.deleteInvoiceFromFirebase(id);
  window.save(true); renderInvoices(); refreshPurchDash(); // immediate=true → saves to Firebase now
}

// ── Render invoices table ──────────────────────────────
const INV_STATUS_LABELS = {
  order:'📋 הזמנה', tx_invoice:'🧾 חשבונית עסקה', tax_invoice:'📑 חשבונית מס',
  tax_receipt:'📑🧾 חשבונית מס קבלה',
  receipt:'📄 קבלה', cancelled:'❌ מבוטל',
  // legacy compat
  active:'📋 הזמנה', in_progress:'🧾 חשבונית עסקה', closed:'📑 חשבונית מס',
  new:'📋 הזמנה', ok:'📑 חשבונית מס', partial:'🧾 חשבונית עסקה'
};


function toggleAdvFilter(){
  const div = document.getElementById('pi-adv-flt');
  const btn = document.getElementById('pi-adv-btn');
  const open = div.style.display==='none';
  div.style.display = open ? 'block' : 'none';
  if(btn) btn.textContent = (open?'▴':'▾') + ' סינון מתקדם';
}

function _fillPiCityFilter(){
  const sel = document.getElementById('pi-city');
  if(!sel) return;
  const cities = [...new Set(window.INVOICES.map(i=>i.locCity||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'he'));
  const cur = sel.value;
  sel.innerHTML = '<option value="">הכל</option>' + cities.map(c=>`<option value="${c}">${c}</option>`).join('');
  if(cur) sel.value = cur;
}

function fillPiSupFilter(){
  const dl = document.getElementById('pi-sup-list');
  if(!dl) return;
  dl.innerHTML = getPurchSuppliers().map(s=>`<option value='${s.name.replace(/'/g, '&#39;')}'>`).join('');
}

function getSupName(supRef){
  if(typeof supRef === 'string') return supRef;
  if(typeof window.SUPBASE==='undefined') return String(supRef);
  const s = window.SUPBASE.find(x=>x.id===parseInt(supRef));
  return s ? s.name : String(supRef);
}



// ==========================================
// EXCEL-LIKE COLUMN FILTERS
// ==========================================
window._invColFilters = window._invColFilters || {};
window._currentFilterCol = null;

window.openColFilter = function(colId, element) {
  window._currentFilterCol = colId;
  const menu = document.getElementById('excel-col-filter');
  const searchInput = document.getElementById('excel-col-search');
  
  // Calculate distinct values
  const distinctVals = new Set();
  window.INVOICES.forEach(i => {
    let val = '';
    if (colId === 'docNum') val = String(i.orderNum || i.txNum || i.num || '');
    else if (colId === 'sumBase') val = String(i.orderAmt || i.txAmt || i.amt || 0);
    else val = String(i[colId] || '');
    distinctVals.add(val);
  });
  
  const sortedVals = Array.from(distinctVals).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
  
  // Store them globally for rendering
  window._currentFilterDistinctVals = sortedVals;
  
  // Render list
  searchInput.value = '';
  window.filterColChecklist(); // Renders the initial full list
  
  // Position the menu below the header element
  const rect = element.parentElement.getBoundingClientRect();
  menu.style.display = 'block';
  menu.style.top = (rect.bottom + window.scrollY + 2) + 'px';
  
  // Try to align right of menu with right of header (RTL)
  let rightPos = document.body.clientWidth - rect.right;
  if (rightPos < 0) rightPos = 0;
  menu.style.right = rightPos + 'px';
  menu.style.left = 'auto';
  
  // Click outside to close
  window._closeColFilterListener = function(e) {
    if (!menu.contains(e.target) && !element.contains(e.target)) {
      window.closeColFilter();
    }
  };
  setTimeout(() => document.addEventListener('click', window._closeColFilterListener), 10);
};

window.closeColFilter = function() {
  const menu = document.getElementById('excel-col-filter');
  if (menu) menu.style.display = 'none';
  if (window._closeColFilterListener) {
    document.removeEventListener('click', window._closeColFilterListener);
    window._closeColFilterListener = null;
  }
};

window.filterColChecklist = function() {
  const listEl = document.getElementById('excel-col-list');
  const term = (document.getElementById('excel-col-search').value || '').toLowerCase();
  
  const allowed = window._invColFilters[window._currentFilterCol];
  const isAllSelected = !allowed;
  
  let html = '';
  window._currentFilterDistinctVals.forEach(val => {
    if (val.toLowerCase().includes(term)) {
      const isChecked = isAllSelected || allowed.includes(val);
      const displayVal = val === '' ? '(ריק)' : val;
      html += `
        <label style="display:block; padding:2px 0; cursor:pointer">
          <input type="checkbox" class="excel-col-cb" value="${val.replace(/"/g, '&quot;')}" ${isChecked ? 'checked' : ''}>
          <span style="font-size:0.8rem">${displayVal}</span>
        </label>
      `;
    }
  });
  
  if (!html) html = '<div style="color:#aaa;text-align:center">לא נמצאו ערכים</div>';
  listEl.innerHTML = html;
  
  // Update "Select All" checkbox state
  document.getElementById('excel-col-select-all').checked = isAllSelected || (listEl.querySelectorAll('.excel-col-cb:not(:checked)').length === 0);
};

window.toggleColSelectAll = function(cb) {
  const checkboxes = document.querySelectorAll('#excel-col-list .excel-col-cb');
  checkboxes.forEach(c => c.checked = cb.checked);
};

window.applyColFilter = function() {
  const checkboxes = document.querySelectorAll('#excel-col-list .excel-col-cb');
  const allChecked = Array.from(checkboxes).every(c => c.checked);
  
  if (allChecked && !document.getElementById('excel-col-search').value) {
    // Everything is selected, meaning no filter
    delete window._invColFilters[window._currentFilterCol];
  } else {
    // Only save what's visible and checked
    const selected = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
    window._invColFilters[window._currentFilterCol] = selected;
  }
  
  window.closeColFilter();
  if (typeof window.renderInvoices === 'function') window.renderInvoices();
  
  // Update header UI to show active filter
  document.querySelectorAll('#pi-table th').forEach(th => {
    const btn = th.querySelector('.col-filter-btn');
    if (btn) btn.style.color = '#7986cb'; // reset color
  });
  
  for (const col of Object.keys(window._invColFilters)) {
    const btn = document.querySelector(`th[onclick*="'${col}'"] .col-filter-btn`);
    if (btn) {
      btn.style.color = '#e65100'; // Highlight color for active filter
      btn.style.fontWeight = 'bold';
    }
  }
};


// ==========================================
// QUICK-ADD INLINE ROW
// ==========================================
window.renderQuickAddRowHtml = function() {
  // We use the exact same datalist 'inv-sup-datalist' that is populated for the main modal
  return `
    <tr id="qa-tr-row" style="background:#e3f2fd; border-bottom:2px solid #90caf9">
      <td style="padding:4px; max-width: 60px; min-width: 40px;"><input type="text" id="qa-serialNum" placeholder='מס"ד' style="width:100%;padding:4px;box-sizing:border-box" onkeydown="if(event.key==='Enter') window.saveQuickAddRow()"></td>
      <td style="padding:4px"><input type="text" id="qa-supName" list="inv-sup-datalist" placeholder='ספק...' style="width:100%;padding:4px;box-sizing:border-box" onkeydown="if(event.key==='Enter') window.saveQuickAddRow()"></td>
      <td style="padding:4px;vertical-align:top">
        <input type="text" id="qa-orderNum" placeholder="הזמנה" style="width:100%;padding:2px 4px;margin-bottom:2px;box-sizing:border-box;font-size:0.75rem" onkeydown="if(event.key==='Enter') window.saveQuickAddRow()">
        <input type="text" id="qa-txNum" placeholder="ח. עסקה" style="width:100%;padding:2px 4px;margin-bottom:2px;box-sizing:border-box;font-size:0.75rem" onkeydown="if(event.key==='Enter') window.saveQuickAddRow()">
        <input type="text" id="qa-num" placeholder="חשבונית/קבלה" style="width:100%;padding:2px 4px;box-sizing:border-box;font-size:0.75rem" onkeydown="if(event.key==='Enter') window.saveQuickAddRow()">
      </td>
      <td style="padding:4px;vertical-align:top"><input type="text" id="qa-orderDesc" placeholder='פירוט' style="width:100%;padding:4px;box-sizing:border-box" onkeydown="if(event.key==='Enter') window.saveQuickAddRow()"></td>
      <td style="padding:4px;vertical-align:top"><input type="number" id="qa-amt" placeholder='סכום (כולל מע"מ)' style="width:100%;padding:4px;box-sizing:border-box" onkeydown="if(event.key==='Enter') window.saveQuickAddRow()"></td>
      <td style="padding:4px;vertical-align:top"><select id="qa-status" style="width:100%;padding:4px;box-sizing:border-box;font-size:0.75rem" onkeydown="if(event.key==='Enter') window.saveQuickAddRow()"><option value="auto">אוטומטי</option><option value="order">📋 הזמנה</option><option value="tx_invoice">🧾 חשבון עסקה</option><option value="tax_invoice">📑 חשבונית מס או קבלה</option></select></td>
      <td style="padding:4px"><input type="text" id="qa-notes" placeholder='הערות' style="width:100%;padding:4px;box-sizing:border-box" onkeydown="if(event.key==='Enter') window.saveQuickAddRow()"></td>
      <td style="padding:4px;text-align:center"><button class="btn bg bsm" onclick="window.saveQuickAddRow()" title="שמור והוסף" style="width:100%;padding:4px">➕ הוסף</button></td>
    </tr>
  `;
};

window.saveQuickAddRow = async function() {
  const serialNum = document.getElementById('qa-serialNum').value.trim();
  const supName = document.getElementById('qa-supName').value.trim();
  
  const orderNum = document.getElementById('qa-orderNum').value.trim();
  const txNum = document.getElementById('qa-txNum').value.trim();
  const num = document.getElementById('qa-num').value.trim();
  
  const orderDesc = document.getElementById('qa-orderDesc').value.trim();
  const amt = parseFloat(document.getElementById('qa-amt').value) || 0;
  let status = document.getElementById('qa-status').value;
  const notes = document.getElementById('qa-notes').value.trim();

  if (!supName) {
    _spAlertDialog('יש להזין שם ספק בשורת ההוספה המהירה');
    return;
  }
  
  if (!orderNum && !txNum && !num) {
    _spAlertDialog('יש להזין לפחות מספר מסמך אחד (הזמנה / ח. עסקה / חשבונית)');
    return;
  }

  // Calculate VAT (defaulting to 17% included since this is quick add, or reading current default)
  const defaultVat = (typeof getVatRate === 'function') ? getVatRate() : 18;
  const rawAmt = amt / (1 + defaultVat/100);
  const vatAmt = amt - rawAmt;
  
  const supInfo = window.supEx[supName] || {};
  const isExempt = (defaultVat===0 || supInfo.entityType==='עוסק פטור' || supInfo.entityType==='עמותה');

  if (status === 'auto') {
    if (num) {
      status = isExempt ? 'receipt' : (txNum ? 'tax_receipt' : 'tax_invoice');
    } else if (txNum) {
      status = 'tax_wait';
    } else {
      status = 'order';
    }
  }

  const inv = {
    id: Date.now(),
    ts: Date.now(),
    serialNum,
    supName,
    orderNum,
    txNum,
    num,
    orderDesc,
    orderAmt: rawAmt.toFixed(2),
    orderVat: vatAmt.toFixed(2),
    orderTotal: amt.toFixed(2),
    ordVatMode: 'inc', // user typed total amount
    status,
    notes,
    vat: defaultVat
  };

  window.INVOICES.push(inv);
  
  // Auto-create supplier if not exists
  if(!window.supEx[supName]) window.supEx[supName] = { isPurch: true, isAct: false };

  window.showToast('✅ נוסף בהצלחה (הזנה מהירה)');
  
  if(window._safeLS) window._safeLS.setItem('ganv5_invoices', JSON.stringify(window.INVOICES));
  if(typeof window.saveToFirebase === 'function') await window.saveToFirebase(true, true);
  else if(typeof window.save === 'function') await window.save(true);
  
  window.renderInvoices();
  
  // Keep focus on the serial number field of the new empty quick add row
  setTimeout(() => {
    const nextInput = document.getElementById('qa-serialNum');
    if (nextInput) nextInput.focus();
  }, 100);
};

﻿
