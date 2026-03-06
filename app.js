// ══════════════════════════════════════════════
// Firebase Realtime Database Sync - v10.2
// ══════════════════════════════════════════════
const FIREBASE_DB_URL = 'https://tomshin-kids-default-rtdb.europe-west1.firebasedatabase.app/data.json';
const FIREBASE_PASS = '1234';
const FIREBASE_POLL_INTERVAL = 60000; // בדיקה כל 60 שניות

let _fbLastSaveTs = 0;      // timestamp שנשמר בענן
let _fbLastLoadTs = 0;      // מתי טענו לאחרון
let _fbPollTimer = null;
let _fbTimer = null;
let _fbSyncing = false;

// ── Password check ────────────────────────────
function checkPassword() {
  return localStorage.getItem('kids_auth') === 'ok';
}

function showPasswordOverlay() {
  const el = document.getElementById('auth-overlay');
  if (el) el.style.display = 'flex';
}

function hidePasswordOverlay() {
  const el = document.getElementById('auth-overlay');
  if (el) el.style.display = 'none';
}

function submitPassword() {
  const inp = document.getElementById('auth-pass-input');
  const err = document.getElementById('auth-err');
  if (inp && inp.value === FIREBASE_PASS) {
    localStorage.setItem('kids_auth', 'ok');
    hidePasswordOverlay();
  } else {
    if (err) err.textContent = 'קוד שגוי, נסה שוב';
    if (inp) inp.value = '';
  }
}

// ── Format timestamp ──────────────────────────
function _fmtTs(ts) {
  if (!ts) return 'אף פעם';
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return pad(d.getDate()) + '/' + pad(d.getMonth()+1) + '/' + d.getFullYear() +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

// ── Update Firebase status UI ─────────────────
function _fbUpdateStatus() {
  const btn = document.getElementById('od-btn');
  if (btn) {
    if (_fbSyncing) {
      btn.textContent = '🔄 מסנכרן...';
      btn.style.background = '#e65100';
    } else if (_fbLastSaveTs) {
      btn.textContent = '☁️ ' + _fmtTs(_fbLastSaveTs);
      btn.style.background = '#2e7d32';
    } else {
      btn.textContent = '☁️ Firebase';
      btn.style.background = '#2e7d32';
    }
  }
  // update Firebase modal
  const el = document.getElementById('fb-last-save');
  if (el) el.textContent = _fmtTs(_fbLastSaveTs);
  const el2 = document.getElementById('fb-last-load');
  if (el2) el2.textContent = _fmtTs(_fbLastLoadTs);
  // update info modal
  const el3 = document.getElementById('info-fb-save');
  if (el3) el3.textContent = _fbLastSaveTs ? _fmtTs(_fbLastSaveTs) : '—';
  const el4 = document.getElementById('info-fb-load');
  if (el4) el4.textContent = _fbLastLoadTs ? _fmtTs(_fbLastLoadTs) : '—';
}

// ── Load from Firebase ────────────────────────
async function loadFromFirebase(silent) {
  try {
    if (!silent) { _fbSyncing = true; _fbUpdateStatus(); }
    const r = await fetch(FIREBASE_DB_URL + '?ts=' + Date.now()); // bust cache
    if (!r.ok) { console.warn('Firebase load failed: ' + r.status); return false; }
    const cloudData = await r.json();
    if (!cloudData || typeof cloudData !== 'object') return false;

    const cloudTs = cloudData.ts || 0;
    const appData = cloudData.data || cloudData;

    if (appData && Object.keys(appData).length > 0) {
      // Only overwrite if cloud is newer than what we loaded last time
      if (cloudTs > _fbLastSaveTs || _fbLastSaveTs === 0) {
        localStorage.setItem('ganv5', JSON.stringify(appData));
        _fbLastLoadTs = Date.now();
        _fbLastSaveTs = cloudTs;
        console.log('Firebase: loaded, cloud ts=' + new Date(cloudTs).toLocaleTimeString());
        if (!silent) _fbUpdateStatus();
        return true;
      } else {
        console.log('Firebase: local is up to date');
      }
    }
    return false;
  } catch(e) {
    console.warn('Firebase load error:', e.message);
    return false;
  } finally {
    _fbSyncing = false;
    _fbUpdateStatus();
  }
}

// ── Save to Firebase ──────────────────────────
async function saveToFirebase(silent) {
  try {
    const raw = localStorage.getItem('ganv5');
    if (!raw) return false;
    _fbSyncing = true;
    _fbUpdateStatus();
    const nowTs = Date.now();
    const payload = { data: JSON.parse(raw), ts: nowTs, version: '10.2' };
    const r = await fetch(FIREBASE_DB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (r.ok) {
      _fbLastSaveTs = nowTs;
      if (!silent) showToast('✅ סונכרן ל-Firebase ' + _fmtTs(nowTs));
      return true;
    }
    if (!silent) showToast('❌ שגיאת סנכרון Firebase');
    return false;
  } catch(e) {
    if (!silent) showToast('❌ Firebase: ' + e.message);
    return false;
  } finally {
    _fbSyncing = false;
    _fbUpdateStatus();
  }
}

// ── Auto-save debounce ────────────────────────
function firebaseAutoSave() {
  clearTimeout(_fbTimer);
  _fbTimer = setTimeout(() => saveToFirebase(true), 3000);
}

// ── Polling — detects changes from other devices ──
function _fbStartPolling() {
  clearInterval(_fbPollTimer);
  _fbPollTimer = setInterval(async () => {
    try {
      // Check only the timestamp first (lightweight)
      const r = await fetch(FIREBASE_DB_URL + '?ts=' + Date.now());
      if (!r.ok) return;
      const d = await r.json();
      const cloudTs = d && d.ts ? d.ts : 0;
      if (cloudTs > _fbLastSaveTs && cloudTs > 0) {
        console.log('Firebase: remote change detected, reloading...');
        // Apply new data without page reload
        const appData = d.data || d;
        if (appData && Object.keys(appData).length > 0) {
          localStorage.setItem('ganv5', JSON.stringify(appData));
          _fbLastSaveTs = cloudTs;
          _fbLastLoadTs = Date.now();
          // Re-apply data to live state
          try {
            const parsed = typeof appData === 'string' ? JSON.parse(appData) : appData;
            if (typeof _applyYearData === 'function') _applyYearData(parsed);
            if (typeof renderDash === 'function') renderDash();
            if (typeof renderCal === 'function') renderCal();
            if (typeof updCounts === 'function') updCounts();
            showToast('🔄 נתונים עודכנו ממכשיר אחר');
          } catch(e2) { console.warn('Apply remote data error:', e2); }
          _fbUpdateStatus();
        }
      }
    } catch(e) { /* ignore polling errors */ }
  }, FIREBASE_POLL_INTERVAL);
}

// ── UI helpers ────────────────────────────────
function odUpdateUI() { _fbUpdateStatus(); }

function odToggle() {
  _fbUpdateStatus();
  const modal = document.getElementById('od-modal');
  if (modal) modal.classList.toggle('open');
}

async function fbSyncNow() {
  await saveToFirebase(false);
}

async function fbLoadNow() {
  const ok = await loadFromFirebase(false);
  if (ok) {
    try {
      const st = localStorage.getItem('ganv5');
      if (st && typeof _applyYearData === 'function') {
        _applyYearData(JSON.parse(st));
        if (typeof renderDash === 'function') renderDash();
        if (typeof renderCal === 'function') renderCal();
        if (typeof updCounts === 'function') updCounts();
        showToast('✅ נטען מ-Firebase');
      }
    } catch(e) { console.warn(e); }
  } else {
    showToast('⚠️ אין נתונים חדשים ב-Firebase');
  }
}

function ghAutoSave() { firebaseAutoSave(); }
// ══════════════════════════════════════════════


// ── PROCUREMENT MODULE - v9.0 ────────────────────────────────

let _appMode = 'act'; // 'act' | 'purch'
let _purchTab = 'pdash';
const PURCH_TABS = ['pdash','pinvoices','psup'];

// ── Mode switcher ──────────────────────────────────────
function switchMode(mode){
  _appMode = mode;
  // Toggle body class for CSS theming
  document.body.classList.toggle('mode-purch', mode==='purch');
  // Show/hide tab bars
  document.getElementById('tabs-act').style.display = mode==='act' ? '' : 'none';
  document.getElementById('tabs-purch').style.display = mode==='purch' ? '' : 'none';
  // Toggle mode buttons
  document.getElementById('modeBtn-act').classList.toggle('active', mode==='act');
  document.getElementById('modeBtn-purch').classList.toggle('active', mode==='purch');
  // Show panels
  if(mode==='act'){
    // Hide all purch panels
    PURCH_TABS.forEach(t=>{ const el=document.getElementById('p-'+t); if(el) el.style.display='none'; });
    ST(typeof currentTab!=='undefined' ? currentTab : 'dash');
  } else {
    // Hide all act panels
    TABS.forEach(t=>{ const el=document.getElementById('p-'+t); if(el) el.classList.remove('active'); });
    SPT(_purchTab);
    refreshPurchDash();
  }
}

function SPT(t){
  _purchTab = t;
  PURCH_TABS.forEach((x,i)=>{
    const tabEl = document.querySelectorAll('#tabs-purch .tab')[i];
    if(tabEl) tabEl.classList.toggle('active', x===t);
    const panelEl = document.getElementById('p-'+x);
    if(panelEl) panelEl.style.display = x===t ? 'block' : 'none';
  });
  if(t==='pinvoices'){ fillPiSupFilter(); renderInvoices(); }
  if(t==='psup') renderPurchSuppliers();
  if(t==='pdash') refreshPurchDash();
}

// INVOICES DATA
let INVOICES = [];
let VAT_RATE = 18; // Default VAT % — editable by user in invoice settings

// ════════════════════════════════════════════════════════
// FILE PATH STORAGE — user saves file locally, app stores the path only.
// Each invoice stores: file_order, file_tx, file_tax = {name, path}
// "path" here = the string the user types/pastes after saving the file.
// ════════════════════════════════════════════════════════

// Pending path inputs per section before invoice is saved
let _pendingFiles = {order:null, tx:null, tax:null};

// Called when user picks a file via <input type="file"> — we only keep the filename
function invFilePickerChange(section){
  const input = document.getElementById('inv-file-'+section);
  if(!input||!input.files[0]) return;
  const file = input.files[0];
  _pendingFiles[section] = {name: file.name, path: ''};
  // Show the filename in the label
  const lbl = document.getElementById('inv-file-lbl-'+section);
  if(lbl){ lbl.textContent = '📎 '+file.name; lbl.style.color='#2e7d32'; }
  // Show the path-input row so user can type/paste the saved location
  const row = document.getElementById('inv-path-row-'+section);
  if(row) row.style.display='flex';
  const pi = document.getElementById('inv-path-'+section);
  if(pi){ pi.value=''; pi.focus(); }
}

// Called when user types/pastes path
function invPathChange(section){
  const pi = document.getElementById('inv-path-'+section);
  if(!pi) return;
  if(!_pendingFiles[section]) _pendingFiles[section]={name:'',path:''};
  _pendingFiles[section].path = pi.value.trim();
  const lbl = document.getElementById('inv-file-lbl-'+section);
  if(lbl && _pendingFiles[section].name)
    lbl.textContent = '📎 '+_pendingFiles[section].name;
  // Show open-button only when a path exists
  const btn = document.getElementById('inv-file-open-'+section);
  if(btn) btn.style.display = pi.value.trim() ? 'inline' : 'none';
}

// Open file: try window.open with file:// path
function invOpenFile(invId, section){
  const inv = INVOICES.find(i=>i.id===invId);
  if(!inv) return;
  const meta = inv['file_'+section];
  if(!meta || (!meta.path && !meta.name)){
    showToast('❌ אין קובץ שמור עבור מסמך זה'); return;
  }
  if(!meta.path){
    showToast('⚠️ נתיב קובץ לא נשמר — רק שם: '+meta.name); return;
  }
  // Attempt to open local file path
  try {
    const url = meta.path.startsWith('file://') ? meta.path : 'file:///'+meta.path.replace(/\\/g,'/');
    window.open(url, '_blank');
  } catch(e) {
    showToast('⚠️ לא ניתן לפתוח אוטומטית — נתיב: '+meta.path);
  }
}

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
  const ex = (typeof supEx!=='undefined'?supEx:{})[name]||{};
  return ex.isAct !== false; // default true for backward compat
}
function isPurchSupplier(name){ 
  const ex = (typeof supEx!=='undefined'?supEx:{})[name]||{};
  return !!ex.isPurch;
}
function getAllSupNames(){
  if(typeof getAllSup==='function') return getAllSup().map(s=>s.name);
  return [];
}
function getPurchSuppliers(){ 
  return getAllSupNames().filter(name=>isPurchSupplier(name)).map(name=>{
    const ex=(typeof supEx!=='undefined'?supEx:{})[name]||{};
    const base=(typeof SUPBASE!=='undefined'?SUPBASE:[]).find(s=>s.name===name)||{};
    return {id: base.id||name, name, phone: ex.ph1||base.phone||'', tax:ex.g1||'', email:ex.email||''};
  });
}
function sucTypeChg(){
  const isAct = document.getElementById('suc-edit-is-act')?.checked;
  const warnEl = document.getElementById('suc-type-warn');
  if(warnEl) warnEl.style.display = !isAct ? 'block' : 'none';
}

// ── Invoice modal ──────────────────────────────────────
let _editInvId = null;

// ── VAT helpers ────────────────────────────────────────
function getVatRate(){ return VAT_RATE||18; }
function vatAmt(base, rate){ return +(base * rate / 100).toFixed(2); }
function withVat(base, rate){ return +(base * (1 + rate/100)).toFixed(2); }

function openNewInvoice(id){
  _editInvId = id || null;
  const inv = id ? INVOICES.find(i=>i.id===id) : null;
  document.getElementById('inv-m-title').textContent = id ? '✏️ עריכת מסמך' : '📄 מסמך חדש';
  // Supplier dropdown
  const sel = document.getElementById('inv-sup');
  sel.innerHTML = '<option value="">-- בחר ספק --</option>';
  getPurchSuppliers().forEach(s=>{
    const ex = supEx[s.name]||{};
    const tag = ex.entityType ? ` [${ex.entityType}]` : '';
    sel.innerHTML += `<option value="${s.name}"${inv&&inv.supName===s.name?' selected':''}>${s.name}${tag}</option>`;
  });
  sel.innerHTML += '<option value="__new__">➕ ספק חדש...</option>';
  document.getElementById('inv-new-sup-wrap').style.display='none';
  // Supplier entity type — update tax-invoice section visibility
  invUpdateEntityType(inv ? (supEx[inv.supName]||{}).entityType||'' : '');
  // VAT rate
  document.getElementById('inv-vat').value = inv ? (inv.vat||getVatRate()) : getVatRate();
  onVatChange();
  // Order section
  document.getElementById('inv-order-num').value   = inv ? (inv.orderNum||'')   : '';
  document.getElementById('inv-order-date').value  = inv ? (inv.orderDate||'')  : '';
  document.getElementById('inv-order-desc').value  = inv ? (inv.orderDesc||'')  : '';
  document.getElementById('inv-order-amt').value   = inv ? (inv.orderAmt||'')   : '';
  document.getElementById('inv-order-notes').value = inv ? (inv.orderNotes||'') : '';
  calcOrderVat();
  // Transaction invoice section
  document.getElementById('inv-tx-num').value  = inv ? (inv.txNum||'')  : '';
  document.getElementById('inv-tx-date').value = inv ? (inv.txDate||'') : '';
  document.getElementById('inv-tx-amt').value  = inv ? (inv.txAmt||'')  : '';
  calcTxVat();
  // Tax invoice / receipt section
  document.getElementById('inv-num').value  = inv ? (inv.num||'')  : '';
  document.getElementById('inv-date').value = inv ? (inv.date||'') : '';
  document.getElementById('inv-amt').value  = inv ? (inv.amt||'')  : '';
  calcInvTotal();
  // Other fields
  document.getElementById('inv-recv').value   = inv ? (inv.recv||'')   : new Date().toISOString().slice(0,10);
  document.getElementById('inv-status').value = inv ? (inv.status||'active') : 'active';
  document.getElementById('inv-notes').value  = inv ? (inv.notes||'')  : '';
  // VAT settings row hidden by default
  const vsRow = document.getElementById('vat-settings-row');
  if(vsRow) vsRow.style.display='none';
  // Reset file pickers & show existing file names + open buttons
  _pendingFiles = {order:null, tx:null, tax:null};
  ['order','tx','tax'].forEach(sec=>{
    const fi   = document.getElementById('inv-file-'+sec);
    const lbl  = document.getElementById('inv-file-lbl-'+sec);
    const btn  = document.getElementById('inv-file-open-'+sec);
    const row  = document.getElementById('inv-path-row-'+sec);
    const pi   = document.getElementById('inv-path-'+sec);
    if(fi) fi.value='';
    const meta = inv && inv['file_'+sec];
    if(lbl){
      lbl.textContent = meta ? '📎 '+meta.name : 'צרף קובץ...';
      lbl.style.color = meta ? '#2e7d32' : '#999';
    }
    // Show path row + existing path if editing
    if(row) row.style.display = meta ? 'flex' : 'none';
    if(pi)  pi.value = meta ? (meta.path||'') : '';
    // Show open button only if there's a path
    if(btn) btn.style.display = (meta && meta.path) ? 'inline' : 'none';
  });
  // Open modal
  document.getElementById('invoice-m').classList.add('open');
}

// Update tax-invoice section title and note based on supplier entity type
function invUpdateEntityType(entityType){
  const taxSection = document.getElementById('inv-tax-section');
  const taxTitle   = document.getElementById('inv-tax-section-title');
  const taxNote    = document.getElementById('inv-tax-section-note');
  if(!taxSection) return;
  const isExempt = entityType==='עוסק פטור'||entityType==='עמותה';
  if(taxTitle){
    taxTitle.textContent = isExempt
      ? '📑 קבלה (עוסק פטור / עמותה — אין חשבונית מס)'
      : '📑 חשבונית מס / קבלה';
  }
  if(taxNote){
    taxNote.style.display = isExempt ? 'block' : 'none';
  }
  // Update placeholder on invoice number field
  const numEl = document.getElementById('inv-num');
  if(numEl) numEl.placeholder = isExempt ? 'מס\' קבלה' : 'מס\' חשבונית מס';
}

function invSupChg(){
  const val = document.getElementById('inv-sup').value;
  document.getElementById('inv-new-sup-wrap').style.display = val==='__new__' ? 'block' : 'none';
  if(val && val!=='__new__'){
    const ex = supEx[val]||{};
    invUpdateEntityType(ex.entityType||'');
  }
}

function invEntityTypeChg(){
  const et = document.getElementById('inv-ns-entity')?.value||'';
  invUpdateEntityType(et);
}

function calcOrderVat(){
  const amt = parseFloat(document.getElementById('inv-order-amt').value)||0;
  const vat = parseFloat(document.getElementById('inv-vat').value)||getVatRate();
  const el = id => document.getElementById(id);
  if(el('inv-order-base'))    el('inv-order-base').textContent    = amt ? '₪'+amt.toLocaleString() : '—';
  if(el('inv-order-vat-amt')) el('inv-order-vat-amt').textContent = amt ? '₪'+vatAmt(amt,vat).toLocaleString() : '—';
  if(el('inv-order-total'))   el('inv-order-total').textContent   = amt ? '₪'+withVat(amt,vat).toLocaleString() : '—';
}

function calcTxVat(){
  const amt = parseFloat(document.getElementById('inv-tx-amt').value)||0;
  const vat = parseFloat(document.getElementById('inv-vat').value)||getVatRate();
  const el = id => document.getElementById(id);
  if(el('inv-tx-base'))    el('inv-tx-base').textContent    = amt ? '₪'+amt.toLocaleString() : '—';
  if(el('inv-tx-vat-amt')) el('inv-tx-vat-amt').textContent = amt ? '₪'+vatAmt(amt,vat).toLocaleString() : '—';
  if(el('inv-tx-total'))   el('inv-tx-total').textContent   = amt ? '₪'+withVat(amt,vat).toLocaleString() : '—';
}

function calcInvTotal(){
  const amt = parseFloat(document.getElementById('inv-amt').value)||0;
  const vat = parseFloat(document.getElementById('inv-vat').value)||getVatRate();
  const el = id => document.getElementById(id);
  if(el('inv-base-disp')) el('inv-base-disp').textContent = amt ? '₪'+amt.toLocaleString() : '—';
  if(el('inv-vat-amt'))   el('inv-vat-amt').textContent   = amt ? '₪'+vatAmt(amt,vat).toLocaleString() : '—';
  if(el('inv-total'))     el('inv-total').textContent     = amt ? '₪'+withVat(amt,vat).toLocaleString() : '—';
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
  if(isNaN(v)||v<0||v>100){ alert('יש להזין אחוז תקין (0–100)'); return; }
  VAT_RATE = v;
  document.getElementById('inv-vat').value = v;
  onVatChange();
  save();
  showNotice('✅ שיעור מע"מ עודכן ל-'+v+'%');
  document.getElementById('vat-settings-row').style.display='none';
}

async function saveInvoice(){
  let supName = document.getElementById('inv-sup').value;
  if(supName==='__new__'){
    const nsName = document.getElementById('inv-ns-name').value.trim();
    if(!nsName){ alert('יש להזין שם ספק'); return; }
    const entityType = document.getElementById('inv-ns-entity')?.value||'';
    if(typeof supEx !== 'undefined'){
      if(!supEx['__c']) supEx['__c']=[];
      if(!supEx['__c'].find(s=>s.name===nsName))
        supEx['__c'].push({id:Date.now(),name:nsName,phone:document.getElementById('inv-ns-phone').value.trim()});
      supEx[nsName]={...(supEx[nsName]||{}),
        ph1:document.getElementById('inv-ns-phone').value.trim(),
        email:document.getElementById('inv-ns-email').value.trim(),
        g1:document.getElementById('inv-ns-tax').value.trim(),
        entityType,
        isAct:document.getElementById('inv-ns-acts').checked, isPurch:true};
    }
    supName = nsName;
  }
  if(!supName){ alert('יש לבחור ספק'); return; }
  const num      = document.getElementById('inv-num').value.trim();
  const txNum    = document.getElementById('inv-tx-num').value.trim();
  const orderNum = document.getElementById('inv-order-num').value.trim();
  if(!orderNum && !txNum && !num){
    alert('יש להזין לפחות מספר הזמנה, מספר חשבונית עסקה, או מספר חשבונית מס'); return;
  }
  const vat      = parseFloat(document.getElementById('inv-vat').value)||getVatRate();
  const orderAmt = parseFloat(document.getElementById('inv-order-amt').value)||0;
  const txAmt    = parseFloat(document.getElementById('inv-tx-amt').value)||0;
  const amt      = parseFloat(document.getElementById('inv-amt').value)||0;
  const invId    = _editInvId || Date.now();

  // Preserve existing file meta if editing and no new file chosen
  const existingInv = _editInvId ? INVOICES.find(i=>i.id===_editInvId) : null;
  const fileMeta = {};
  for(const sec of ['order','tx','tax']){
    if(_pendingFiles[sec]){
      // Read path from path input field
      const pathEl = document.getElementById('inv-path-'+sec);
      fileMeta['file_'+sec] = {
        name: _pendingFiles[sec].name,
        path: pathEl ? pathEl.value.trim() : ''
      };
    } else {
      fileMeta['file_'+sec] = (existingInv && existingInv['file_'+sec]) || null;
    }
  }

  const inv = {
    id:invId, supName, vat,
    orderNum, orderDate:document.getElementById('inv-order-date').value,
    orderDesc:document.getElementById('inv-order-desc').value.trim(),
    orderAmt, orderVat:vatAmt(orderAmt,vat), orderTotal:withVat(orderAmt,vat),
    orderNotes:document.getElementById('inv-order-notes').value.trim(),
    txNum, txDate:document.getElementById('inv-tx-date').value,
    txAmt, txVat:vatAmt(txAmt,vat), txTotal:withVat(txAmt,vat),
    num, date:document.getElementById('inv-date').value,
    amt, vatAmt:vatAmt(amt,vat), total:withVat(amt,vat),
    recv:document.getElementById('inv-recv').value,
    status:document.getElementById('inv-status').value,
    notes:document.getElementById('inv-notes').value.trim(),
    ...fileMeta,
    ts:Date.now()
  };
  if(_editInvId){
    const idx=INVOICES.findIndex(i=>i.id===_editInvId);
    if(idx>=0) INVOICES[idx]=inv;
  } else {
    INVOICES.push(inv);
  }
  save();
  // Save pending file paths (path is already in fileMeta, nothing async needed)
  try { await invSaveFiles(invId); } catch(e){ showToast('⚠️ שגיאה בשמירת קובץ: '+e.message); }
  CM('invoice-m');
  if(typeof _purchTab!=='undefined'){
    if(_purchTab==='pinvoices') renderInvoices();
    if(_purchTab==='pdash') refreshPurchDash();
  }
  showNotice('✅ חשבונית נשמרה בהצלחה');
}

function deleteInvoice(id){
  if(!confirm('למחוק חשבונית זו?')) return;
  INVOICES=INVOICES.filter(i=>i.id!==id);
  // Remove file meta from invoice data
  ['order','tx','tax'].forEach(sec => fileDelete(fileKey(id,sec)).catch(()=>{}));
  save(); renderInvoices(); refreshPurchDash();
}

// ── Render invoices table ──────────────────────────────
const INV_STATUS_LABELS = {
  // new statuses
  active:'🟢 פעיל', in_progress:'🟡 בביצוע', closed:'✅ סגור',
  // legacy backward compat
  new:'ממתינה', ok:'אושרה', partial:'חלקית', issue:'הערות'
};
const INV_STATUS_CLS = {
  active:'inv-s-active', in_progress:'inv-s-in_progress', closed:'inv-s-closed',
  new:'inv-s-new', ok:'inv-s-ok', partial:'inv-s-partial', issue:'inv-s-issue'
};

function fillPiSupFilter(){
  const sel = document.getElementById('pi-sup');
  if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">כל הספקים</option>';
  getPurchSuppliers().forEach(s=>{
    sel.innerHTML += `<option value="${s.name}">${s.name}</option>`;
  });
  sel.value = cur;
}

function getSupName(supRef){
  // supRef can be a name string directly
  if(typeof supRef === 'string') return supRef;
  if(typeof SUPBASE==='undefined') return String(supRef);
  const s = SUPBASE.find(x=>x.id===parseInt(supRef));
  return s ? s.name : String(supRef);
}

function renderInvoices(){
  const tbody = document.getElementById('pi-tbody');
  if(!tbody) return;
  const srch = (document.getElementById('pi-srch')?.value||'').toLowerCase();
  const stf  = document.getElementById('pi-status')?.value||'';
  const supf = document.getElementById('pi-sup')?.value||'';
  const from = document.getElementById('pi-from')?.value||'';
  const to   = document.getElementById('pi-to')?.value||'';
  let list = [...INVOICES];
  if(srch) list = list.filter(i=>
    (i.supName||'').toLowerCase().includes(srch)||
    (i.num||'').toLowerCase().includes(srch)||
    (i.orderNum||'').toLowerCase().includes(srch)||
    (i.txNum||'').toLowerCase().includes(srch)||
    (i.orderDesc||'').toLowerCase().includes(srch)
  );
  if(stf)  list = list.filter(i=>i.status===stf);
  if(supf) list = list.filter(i=>i.supName===supf);
  if(from) list = list.filter(i=>(i.orderDate||i.txDate||i.date||'')>=from);
  if(to)   list = list.filter(i=>(i.orderDate||i.txDate||i.date||'')<=to);
  list.sort((a,b)=>(b.orderDate||b.txDate||b.date||'').localeCompare(a.orderDate||a.txDate||a.date||''));
  const fmtAmt = (n, vat, exempt)=>{
    if(!n) return '<span style="color:#ccc">—</span>';
    if(exempt) return `<b style="color:#2e7d32">₪${n.toLocaleString()}</b>`;
    return `<span style="color:#546e7a">₪${n.toLocaleString()}</span> <span style="font-size:.67rem;color:#e65100">+מע"מ</span> <b style="color:#2e7d32">₪${withVat(n,vat).toLocaleString()}</b>`;
  };
  const statusStepper = (st)=>{
    const stages = [{k:'active',l:'פעיל'},{k:'in_progress',l:'בביצוע'},{k:'closed',l:'סגור'}];
    const cur = stages.findIndex(s=>s.k===st);
    return `<div style="display:flex;gap:3px;align-items:center">` +
      stages.map((s,i)=>{
        const done = cur>i, active = cur===i;
        const bg = done?'#2e7d32':active?'#1565c0':'#e0e0e0';
        const col = (done||active)?'#fff':'#aaa';
        return `<div style="background:${bg};color:${col};border-radius:10px;padding:2px 7px;font-size:.65rem;font-weight:700;white-space:nowrap">${s.l}</div>${i<2?`<div style="width:10px;height:1.5px;background:${done?'#2e7d32':'#e0e0e0'}"></div>`:''}`;
      }).join('') + `</div>`;
  };
  if(!list.length){
    tbody.innerHTML='<tr><td colspan="7" style="text-align:center;color:#aaa;padding:25px">אין חשבוניות</td></tr>'; return;
  }
  tbody.innerHTML = list.map(inv=>{
    const vat = inv.vat||getVatRate();
    const isExempt = (supEx[inv.supName]||{}).entityType==='עוסק פטור'||(supEx[inv.supName]||{}).entityType==='עמותה' || inv.docType==='receipt';
    const hasOrder = inv.orderNum;
    const hasTx    = inv.txNum;
    const hasTax   = inv.num;
    const mkFileBtn = (sec, meta) => meta&&meta.path
      ? `<button onclick="event.stopPropagation();invOpenFile(${inv.id},'${sec}')" style="background:none;border:1px solid #90caf9;border-radius:4px;cursor:pointer;font-size:.68rem;color:#1565c0;padding:1px 5px" title="${meta.name||'פתח קובץ'}">📎 פתח</button>`
      : (meta&&meta.name ? `<span style="font-size:.67rem;color:#aaa" title="${meta.name}">📎 ${meta.name.slice(0,12)}...</span>` : '');
    return `<tr class="inv-row-clickable" onclick="openNewInvoice(${inv.id})">
      <td style="min-width:120px;padding:8px">
        <div style="font-weight:700;color:#1a237e;font-size:.83rem">${inv.supName||''}</div>
        <div style="font-size:.67rem;color:#999;margin-top:2px">${(supEx[inv.supName]||{}).entityType||''}</div>
      </td>
      <td style="font-size:.75rem;line-height:1.8;padding:8px">
        ${hasOrder?`<div><span style="font-size:.65rem;background:#e8eaf6;color:#1a237e;border-radius:4px;padding:1px 5px;font-weight:700">הזמנה</span> <b>${inv.orderNum}</b>${inv.orderDate?' · '+fD(inv.orderDate):''} ${mkFileBtn('order',inv.file_order)}</div>`:''}
        ${hasTx?`<div><span style="font-size:.65rem;background:#e8f5e9;color:#2e7d32;border-radius:4px;padding:1px 5px;font-weight:700">עסקה</span> <b>${inv.txNum}</b>${inv.txDate?' · '+fD(inv.txDate):''} ${mkFileBtn('tx',inv.file_tx)}</div>`:''}
        ${hasTax?`<div><span style="font-size:.65rem;background:#fff8e1;color:#e65100;border-radius:4px;padding:1px 5px;font-weight:700">${inv.docType==='receipt'?'קבלה':inv.docType==='tax_receipt'?'מס/קבלה':'חשבונית מס'}</span> <b>${inv.num}</b>${inv.date?' · '+fD(inv.date):''} ${mkFileBtn('tax',inv.file_tax)}</div>`:''}
      </td>
      <td style="font-size:.75rem;max-width:130px;color:#37474f;padding:8px">${inv.orderDesc||''}</td>
      <td style="font-size:.75rem;padding:8px;white-space:nowrap">
        ${hasOrder?`<div style="margin-bottom:3px"><span style="font-size:.63rem;color:#546e7a">הזמנה: </span>${fmtAmt(inv.orderAmt,vat,isExempt)}</div>`:''}
        ${hasTx?`<div style="margin-bottom:3px"><span style="font-size:.63rem;color:#546e7a">עסקה: </span>${fmtAmt(inv.txAmt,vat,isExempt)}</div>`:''}
        ${hasTax?`<div><span style="font-size:.63rem;color:#546e7a">מסמך: </span>${fmtAmt(inv.amt,vat,isExempt)}</div>`:''}
      </td>
      <td style="padding:8px">${statusStepper(inv.status||'active')}</td>
      <td style="font-size:.72rem;color:#78909c;max-width:120px;padding:8px">${inv.notes||''}</td>
      <td style="padding:8px;white-space:nowrap" onclick="event.stopPropagation()">
        <button class="btn bsm bo" onclick="openNewInvoice(${inv.id})">✏️</button>
        <button class="btn bsm br" onclick="deleteInvoice(${inv.id})">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

// ── Procurement Dashboard ──────────────────────────────
function refreshPurchDash(){
  const invs = INVOICES;
  const active     = invs.filter(i=>i.status==='active'||i.status==='new').length;
  const inProgress = invs.filter(i=>i.status==='in_progress'||i.status==='partial').length;
  const closed     = invs.filter(i=>i.status==='closed'||i.status==='ok').length;
  document.getElementById('ps-invoices').textContent = invs.length;
  document.getElementById('ps-suppliers').textContent = getPurchSuppliers().length;
  document.getElementById('ps-open').textContent = active;
  document.getElementById('ps-issues').textContent = inProgress;
  // Recent 5 — sorted by creation timestamp
  const rec = [...invs].sort((a,b)=>b.ts-a.ts).slice(0,5);
  const el = document.getElementById('pdash-recent-invoices');
  if(!el) return;
  if(!rec.length){ el.innerHTML='<div style="color:#aaa;font-size:.8rem;text-align:center;padding:20px">אין חשבוניות עדיין</div>'; return; }
  const stageDot = st=>{
    const m={active:'🟢',in_progress:'🟡',closed:'✅',new:'🟢',ok:'✅',partial:'🟡',issue:'🔴'};
    const l={active:'פעיל',in_progress:'בביצוע',closed:'סגור',new:'פעיל',ok:'סגור',partial:'בביצוע',issue:'עם הערות'};
    return `<span style="font-size:.72rem">${m[st]||'⚪'} ${l[st]||st}</span>`;
  };
  el.innerHTML = `<table style="width:100%;font-size:.8rem;border-collapse:collapse">
    <thead><tr style="background:#e8f5e9">
      <th style="padding:5px 8px;text-align:right">מס' הזמנה</th>
      <th style="padding:5px 8px;text-align:right">ספק</th>
      <th style="padding:5px 8px;text-align:right">תאריך הזמנה</th>
      <th style="padding:5px 8px;text-align:left">סה"כ</th>
      <th style="padding:5px 8px">סטטוס</th>
    </tr></thead>
    <tbody>${rec.map(i=>`<tr onclick="openNewInvoice(${i.id})" class="inv-row-clickable">
      <td style="padding:5px 8px"><b>${i.orderNum||i.num||'—'}</b></td>
      <td style="padding:5px 8px">${i.supName||''}</td>
      <td style="padding:5px 8px">${i.orderDate||i.date||''}</td>
      <td style="padding:5px 8px;font-weight:700;color:#2e7d32">${(i.orderTotal||i.total)?'₪'+(i.orderTotal||i.total).toFixed(2):''}</td>
      <td style="padding:5px 8px">${stageDot(i.status||'active')}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

// ── Purch Suppliers panel ──────────────────────────────
function renderPurchSuppliers(){
  const el = document.getElementById('psu-body');
  if(!el) return;
  const srch = (document.getElementById('psu-srch')?.value||'').toLowerCase();
  let list = getPurchSuppliers().filter(s=>!srch||s.name.toLowerCase().includes(srch));
  if(!list.length){ el.innerHTML='<div style="color:#aaa;padding:20px;text-align:center">אין ספקי רכש.<br><span style="font-size:.8rem">סמן ספקים כ"ספק רכש" בטאב ספקים ← ניהול חוגים.</span></div>'; return; }
  el.innerHTML = list.map(s=>{
    const invCount = INVOICES.filter(i=>(i.supName||String(i.supId))===s.name).length;
    const safeN = s.name.replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/'/g,"\\'");
    return `<div class="card" style="margin-bottom:8px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:150px">
        <div style="font-weight:700;color:#1a237e">${s.name}</div>
        <div style="font-size:.72rem;color:#78909c">${s.tax?'ח.פ: '+s.tax:''} ${s.phone?'· '+s.phone:''}</div>
      </div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
        ${isActSupplier(s.name)?'<span class="sup-flag sup-flag-act">🎨 חוגים</span>':''}
        <span class="sup-flag sup-flag-purch">🛒 רכש</span>
      </div>
      <div style="font-size:.78rem;color:#546e7a">${invCount} חשבוניות</div>
      <div style="display:flex;gap:5px">
        <button class="btn bsm bp" title="פתח כרטיס ספק" onclick="switchMode('act');setTimeout(()=>{ST('sup');setTimeout(()=>openSupCard('${safeN}'),100);},120)">📋 כרטיס ספק</button>
        <button class="btn bsm bo" onclick="switchMode('act');setTimeout(()=>{ST('sup');setTimeout(()=>{openSupCard('${safeN}');setTimeout(sucToggleEdit,150);},100);},120)">✏️ ערוך</button>
      </div>
    </div>`;
  }).join('');
}



function _applyYearData(o){
  if(o.ch){
    if(SRAWS.length>0){
      // SRAWS loaded: merge SRAWS base data with saved changes
      const m={};o.ch.forEach(x=>m[x.id]=x);
      SCH=SRAWS.map(s=>{const x=m[s.id];return x?{...s,...x}:s;});
      // Include user-created schedules (not in SRAWS) that have full data
      const srawsIds=new Set(SRAWS.map(s=>s.id));
      SCH.push(...o.ch.filter(x=>!srawsIds.has(x.id)&&x.g&&x.d&&x.a));
    } else {
      // SRAWS not loaded: preserve ALL ch entries with defaults for missing fields
      SCH=o.ch.map(x=>({g:0,d:'',a:'',t:'',p:'',n:'',st:'ok',cr:'',cn:'',nt:'',pd:'',pt:'',grp:1,...x}))
             .filter(x=>x.g>0&&x.d);
    }
  }
  else SCH=SRAWS.map(s=>({...s,st:'ok',cr:'',cn:'',nt:s.n||'',pd:'',pt:'',grp:1}));
  if(Array.isArray(o.pairs)&&o.pairs.length>0){
    pairs=o.pairs.map(p=>({...p,ids:p.ids.map(id=>parseInt(id)).filter(id=>G(id).id)}));
    pairs=pairs.filter(p=>p.ids.length>=2);
  } else { initPairs(); }
  supEx = o.supEx||{};
  if(Array.isArray(o.invoices)) INVOICES=o.invoices;
  if(typeof o.vatRate==='number') VAT_RATE=o.vatRate;
  clusters=o.clusters&&Object.keys(o.clusters).length?o.clusters:JSON.parse(JSON.stringify(INIT_CLUSTERS));
  holidays=o.holidays||[];
  if(supEx['__gardens_extra']) _GARDENS_EXTRA=supEx['__gardens_extra'];
  pairBreaks=o.pairBreaks||{};
  blockedDates=o.blockedDates||{};
  gardenBlocks=o.gardenBlocks||{};
  managers=o.managers||{};
  activeGardens=Array.isArray(o.activeGardens)?new Set(o.activeGardens):null;
}

function load(){
  try{
    // Support migration from old Y1 system (ganv5_y_ keys)
    const meta=JSON.parse(localStorage.getItem('ganv5_meta')||'null');
    let st=null;
    if(meta&&meta.currentYear) st=localStorage.getItem('ganv5_y_'+meta.currentYear);
    if(!st) st=localStorage.getItem('ganv5');
    if(st){ _applyYearData(JSON.parse(st)); }
    else { initPairs();clusters=JSON.parse(JSON.stringify(INIT_CLUSTERS));activeGardens=null; }
  }catch(e){initPairs();clusters=JSON.parse(JSON.stringify(INIT_CLUSTERS));activeGardens=null;}
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
  const st=localStorage.getItem('ganv5');
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
  if(changed>0){ save(); console.log('migrateSupAct: fixed '+changed); }
}
function save(){
  if(false){ showToast('⚠️ מצב ארכיון — לא ניתן לשמור שינויים'); return; }
  try{
    // Save ALL entries with ALL fields — works with or without SRAWS
    const data={
      ch:SCH.map(s=>({id:s.id,g:s.g,d:s.d,a:s.a,t:s.t,p:s.p,n:s.n,st:s.st,cr:s.cr,cn:s.cn,nt:s.nt,pd:s.pd,pt:s.pt,grp:s.grp,act:s.act||''})),
      pairs,supEx,clusters,holidays,pairBreaks,managers,blockedDates,gardenBlocks,
      invoices:INVOICES,vatRate:VAT_RATE,
      activeGardens:activeGardens?[...activeGardens]:null
    };
    const _json=JSON.stringify(data);
    localStorage.setItem('ganv5',_json);
    // Also update year key if meta exists
    try{const _m=JSON.parse(localStorage.getItem('ganv5_meta')||'null');if(_m&&_m.currentYear)localStorage.setItem('ganv5_y_'+_m.currentYear,_json);}catch(_){}
    try{ghAutoSave();}catch(_){}
    save._cnt=(save._cnt||0)+1;
    if(save._cnt%30===0){
      try{
        const snaps=JSON.parse(localStorage.getItem('ganv5_snaps')||'[]');
        const d=_json;
        snaps.unshift({ts:Date.now(),label:'אוטומטי',size:d.length,data:d});
        if(snaps.length>20) snaps.length=20;
        localStorage.setItem('ganv5_snaps',JSON.stringify(snaps));
      }catch(e2){}
    }
  }catch(e){}
}
function initPairs(){
  pairs=AUTOPAIRS.map((arr,i)=>{
    const gs=arr.map(id=>G(id)).filter(x=>x.id);
    return{id:i+1,ids:arr,name:gs.map(g=>g.name).join(' + ')};
  });
}

// ══════════════════════════════════════════════════════════
// Y1 — Year Management Functions
// ══════════════════════════════════════════════════════════


function G(id){return GARDENS.find(g=>g.id===id)||{}}
function gcls(g){return g.cls||'גנים'}
function gByCF(city,cls){return GARDENS.filter(g=>(!city||g.city===city)&&(!cls||gcls(g)===cls));}
function d2s(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');return`${y}-${m}-${dd}`}
function s2d(s){const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function fD(s){if(!s)return'';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`}
function fT(t){return t?t.slice(0,5):''}
function addD(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function addM(d,n){const x=new Date(d);x.setMonth(x.getMonth()+n);return x}
function monStart(d){const x=new Date(d);x.setDate(x.getDate()-x.getDay());x.setHours(0,0,0,0);return x}
function dayN(s){const[y,m,d]=s.split('-').map(Number);return['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][new Date(y,m-1,d).getDay()]}
function hebM(d){return['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'][d.getMonth()]+' '+d.getFullYear()}
function td(){return d2s(new Date())}
function cities(){return[...new Set(GARDENS.map(g=>g.city))].sort()}
function gardenPair(gid){const n=parseInt(gid);return pairs.find(p=>p.ids.map(x=>parseInt(x)).includes(n))||null}
function stLabel(s){
  if(s.st==='can') return'<span class="bdg br2">❌ בוטל</span>';
  if(s.st==='done') return'<span class="bdg bg2">✔️ התקיים</span>';
  if(s.st==='post') return`<span class="bdg bor">⏩ נדחה ${s.pd?'→ '+fD(s.pd):''}</span>`;
  if(s.st==='nohap') return'<span class="bdg br2">⚠️ לא התקיים</span>';
  return'<span class="bdg bg2">📅 מתקיים</span>';
}
function stClass(s){
  if(s.st==='can') return'st-can-row';
  if(s.st==='post') return'st-post-row';
  if(s.st==='nohap') return'st-nohap-row';
  if(s.st==='done') return'st-done-row';
  return'';
}

window.onload=async function(){
  // Password check
  if (!checkPassword()) {
    showPasswordOverlay();
    // Wait until auth
    await new Promise(resolve => {
      const check = setInterval(() => {
        if (localStorage.getItem('kids_auth') === 'ok') {
          clearInterval(check);
          resolve();
        }
      }, 300);
    });
  }
  // Load from Firebase into localStorage, then native load() reads it
  await Promise.all([_srawsReady, loadFromFirebase()]);
  load();
  migratePairsFromAuto();
  migrateSupActSplit();
  importContactsFromGardens();
  migrateGardenPhones();
  initDrops();
  initHolDrops();
  refreshClusterDrops();
  refreshMgrDrops();
  document.getElementById('dash-date').value=td();
  // Clear search fields on load (prevent browser autofill from filtering results)
  ['dash-srch','s-srch','g-srch','su-srch'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const sfrom=document.getElementById('s-from');if(sfrom) sfrom.value=td();
  const sto=document.getElementById('s-to');if(sto) sto.value=td();
  const calClsEl=document.getElementById('cal-cls');
  if(calClsEl) calClsEl.value='גנים';
  const gClsEl=document.getElementById('g-cls');
  if(gClsEl) gClsEl.value='גנים';
  
  renderReadOnlyBanner();
  renderDash();
  renderCal();
  renderClusters();
  renderSup();
  renderManagers();
  updCounts();
  odUpdateUI();
  _fbStartPolling(); // poll for changes from other devices
};

function updCounts(){
  const can=SCH.filter(s=>s.st==='can').length;
  const post=SCH.filter(s=>s.st==='post').length;
  const nohap=SCH.filter(s=>s.st==='nohap').length;
  const todayCnt=SCH.filter(s=>s.d===td()&&s.st!=='can').length;
  const setEl=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  // Activity stats
  setEl('h-pairs',pairs.length);
  setEl('h-can',can);setEl('h-post',post);setEl('h-nohap',nohap);
  setEl('h-sched',SCH.length.toLocaleString());
  setEl('h-gardens',GARDENS.length+(_GARDENS_EXTRA||[]).length);
  setEl('d-pairs',pairs.length);
  setEl('d-can',can);setEl('d-post',post);setEl('d-nohap',nohap);
  setEl('d-gardens',GARDENS.length+(_GARDENS_EXTRA||[]).length);
  setEl('d-total',SCH.length.toLocaleString());
  setEl('d-today-cnt',todayCnt||0);
  // Procurement stats in header
  setEl('h-inv', INVOICES.length);
  setEl('h-inv-active', INVOICES.filter(i=>i.status==='active'||i.status==='new').length);
  setEl('h-inv-prog', INVOICES.filter(i=>i.status==='in_progress'||i.status==='partial').length);
}

function initDrops(){
  const cs=cities();
  function fC(id){cs.forEach(c=>document.getElementById(id).innerHTML+=`<option value='${c}'>${c}</option>`);}
  function fG(id,first,prefix){
    const el=document.getElementById(id);
    el.innerHTML=`<option value="">${first}</option>`;
    GARDENS.forEach(g=>el.innerHTML+=`<option value='${g.id}'>${prefix?g.city+' · ':''} ${g.name}</option>`);
  }
  fC('dash-city');fC('cal-city');fC('s-city');fC('g-city');fC('apm-city');fC('pairs-city');fC('cl-city');
  // Filter dropdowns (search/filter): show ALL suppliers
  getAllSup().forEach(s=>{
    ['dash-sup','cal-sup','s-sup'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML+=`<option value='${s.name}'>${s.name}</option>`;});
  });
  // Scheduling dropdowns: show ONLY act suppliers (isAct=true)
  getAllSup().filter(s=>isActSupplier(s.name)).forEach(s=>{
    ['ns-sup','es-sup'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML+=`<option value='${s.name}'>${s.name}</option>`;});
  });
  fG('cal-g1','כל הגנים',true);fG('cal-g2','—',true);fG('cal-g3','—',true);
  fG('s-g1','כל הגנים',true);fG('s-g2','—',true);fG('s-g3','—',true);
  fG('apm-g1','בחר גן',true);fG('apm-g2','בחר גן',true);fG('apm-g3','—',true);
  document.getElementById('cal-dp').value=td();
  // Default calendar to גנים tab
  const calClsInit=document.getElementById('cal-cls');
  if(calClsInit) calClsInit.value='גנים';
}

const TABS=['dash','cal','sched','gardens','pairs','holidays','clusters','sup','managers'];
let currentTab='dash';
function ST(t){
  currentTab=t;
  TABS.forEach((x,i)=>{
    document.querySelectorAll('.tab')[i].classList.toggle('active',x===t);
    document.getElementById('p-'+x).classList.toggle('active',x===t);
  });
  if(t==='sched') renderSched();
  if(t==='gardens'){renderGardens();refreshMgrDrops();}
  if(t==='cal') renderCal();
  if(t==='pairs') renderPairs();
  if(t==='holidays'){initHolDrops();renderHolidays();}
  if(t==='clusters') renderClusters();
  if(t==='managers'){renderManagers();refreshMgrDrops();}
}

function calRefG(){
  // Ensure cal-cls matches the active tab
  const clsSel=document.getElementById('cal-cls');
  if(clsSel&&_calTab) clsSel.value=_calTab==='g'?'גנים':'ביה"ס';
  const city=document.getElementById('cal-city').value;
  const cls=document.getElementById('cal-cls').value;
  const gs=gByCF(city,cls).sort((a,b)=>a.name.localeCompare(b.name,'he'));
  ['cal-g1','cal-g2','cal-g3'].forEach((id,i)=>{
    const sel=document.getElementById(id);
    sel.innerHTML=i===0?'<option value="">כל הגנים</option>':'<option value="">—</option>';
    gs.forEach(g=>sel.innerHTML+=`<option value="${g.id}">${city?g.name:g.city+' · '+g.name}</option>`);
  });
  renderCal();
}
function getCalGids(){
  return[parseInt(document.getElementById('cal-g1').value)||null,parseInt(document.getElementById('cal-g2').value)||null,parseInt(document.getElementById('cal-g3').value)||null].filter(Boolean);
}
function getCalF(){
  const gids=getCalGids();
  return{gids:gids.length?gids:null,city:document.getElementById('cal-city').value,cls:document.getElementById('cal-cls').value,cluster:document.getElementById('cal-cl').value,sup:document.getElementById('cal-sup').value};
}
function filterE(f,from,to){
  const all=SCH.filter(s=>{
    if(s.d<from||s.d>to) return false;
    const g=G(s.g);
    if(f.city&&g.city!==f.city) return false;
    if(f.cluster){
      if(f.cluster==='__all__'){
        // only show gardens that belong to at least one cluster
        const allClusterGids=new Set(getClusters().flatMap(c=>c.gardenIds||[]));
        if(!allClusterGids.has(s.g)) return false;
      } else {
        const cl=getClusters().find(c=>c.name===f.cluster);
        if(!cl||(!(cl.gardenIds||[]).includes(s.g))) return false;
      }
    }
    if(f.cls&&gcls(g)!==f.cls) return false;
    if(f.gids&&!f.gids.includes(s.g)) return false;
    if(f.sup&&s.a!==f.sup) return false;
    return true;
  });
  const posted=SCH.filter(s=>{
    if(s.st!=='post'||!s.pd||s.pd<from||s.pd>to) return false;
    const g=G(s.g);
    if(f.city&&g.city!==f.city) return false;
    if(f.gids&&!f.gids.includes(s.g)) return false;
    return true;
  }).map(s=>({...s,d:s.pd,_isPostponed:true}));
  return [...all,...posted];
}
function setView(v){
  calV=v;
  ['day','week','month','list','range'].forEach(x=>{
    const el=document.getElementById('vb-'+x);
    if(el) el.classList.toggle('active',x===v);
  });
  // Show/hide nav buttons and range pickers
  const rangeRow=document.getElementById('cal-range-row');
  const navBtns=document.querySelectorAll('[onclick="navCal(-1)"],[onclick="navCal(1)"]');
  if(v==='range'){
    if(rangeRow) rangeRow.style.display='flex';
    navBtns.forEach(b=>b.style.display='none');
    // Init range to current week if empty
    const f=document.getElementById('cal-range-from');
    const t=document.getElementById('cal-range-to');
    if(f&&!f.value) f.value=d2s(monStart(calD));
    if(t&&!t.value) t.value=d2s(addD(monStart(calD),6));
  } else {
    if(rangeRow) rangeRow.style.display='none';
    navBtns.forEach(b=>b.style.display='');
  }
  renderCal();
}
function navCal(d){
  if(calV==='day') calD=addD(calD,d);
  else if(calV==='week') calD=addD(calD,d*7);
  else calD=addM(calD,d);
  renderCal();
}
function goToday(){calD=new Date();document.getElementById('cal-dp').value=td();renderCal();}
function goDate(s){if(s){calD=s2d(s);renderCal();}}
function jumpToDay(ds){calD=s2d(ds);setView('day');}
function clearCal(){
  ['cal-city','cal-cls','cal-cl','cal-sup'].forEach(id=>document.getElementById(id).value='');
  ['cal-g1','cal-g2','cal-g3'].forEach((id,i)=>{
    const el=document.getElementById(id);
    el.innerHTML=i===0?'<option value="">כל הגנים</option>':'<option value="">—</option>';
    GARDENS.forEach(g=>el.innerHTML+=`<option value="${g.id}">${g.city} · ${g.name}</option>`);
  });
  document.getElementById('cal-pair-bar').classList.remove('show');
  renderCal();
}
function clearCalPair(){
  document.getElementById('cal-g1').value='';
  document.getElementById('cal-g2').value='';
  document.getElementById('cal-g3').value='';
  document.getElementById('cal-pair-bar').classList.remove('show');
  renderCal();
}
// Unified pair save — called from calendar, schedule, and garden modal
function addPair(gids){
  if(!gids||gids.length<2){alert('יש לבחור לפחות 2 גנים');return;}
  checkDupePairAndSave(gids);
}
function addPairFromCal(){
  addPair(getCalGids());
}
function addPairFromSched(){
  const ids=[parseInt(document.getElementById('s-g1').value)||null,
             parseInt(document.getElementById('s-g2').value)||null,
             parseInt(document.getElementById('s-g3').value)||null].filter(Boolean);
  addPair(ids);
}
function savePairFromGarden(){
  const g2=parseInt(document.getElementById('gm-pg2').value)||null;
  const g3=parseInt(document.getElementById('gm-pg3').value)||null;
  if(!g2){alert('יש לבחור לפחות גן שני');return;}
  addPair([gmGid,g2,g3].filter(Boolean));
  openGM(gmGid);
}
function checkDupePairAndSave(gids){
  const dupe=gids.map(gid=>{const p=gardenPair(gid);return p?`${G(gid).name} כבר בזוג "${p.name}"`:null}).filter(Boolean);
  if(dupe.length){if(!confirm(`⚠️ שים לב:\n${dupe.join('\n')}\n\nבכל זאת להמשיך?`)) return;}
  const name=gids.map(id=>G(id).name||'').join(' + ');
  const nm=prompt('שם לזוג:',name);
  if(nm===null) return;
  pairs.push({id:Date.now(),ids:gids,name:nm||name});
  save(); refresh();
  alert(`✅ הזוג "${nm||name}" נשמר!`);
}

function renderCal(){
  const gids=getCalGids();
  const bar=document.getElementById('cal-pair-bar');
  if(gids.length>=2){
    bar.classList.add('show');
    (document.getElementById('cal-pair-lbl')||{}).textContent =gids.map(id=>G(id).name||'').join(' + ');
  } else {
    bar.classList.remove('show');
  }

  const f=getCalF();
  let displayGids=null;
  if(f.gids&&f.gids.length>=2){
    displayGids=f.gids;
  } else if(f.gids&&f.gids.length===1){
    const p=gardenPair(f.gids[0]);
    if(p) displayGids=p.ids;
  }

  let html='';
  if(calV==='day'){
    const ds=d2s(calD);
    (document.getElementById('cal-title')||{}).textContent =`${fD(ds)} - יום ${dayN(ds)}`;
    const evs=filterE(f,ds,ds).sort((a,b)=>(a.t||'').localeCompare(b.t||''));
    if(displayGids) html=renderPairDay(evs,displayGids);
    else if(f.cluster) html=renderClusterDay(evs,ds,f.cluster);
    else html=renderNormalDay(evs,ds);
  } else if(calV==='week'){
    const ws=monStart(calD),we=addD(ws,5);
    const wsS=d2s(ws),weS=d2s(we);
    (document.getElementById('cal-title')||{}).textContent =`${fD(wsS)} – ${fD(weS)}`;
    const evs=filterE(f,wsS,weS);
    if(displayGids) html=renderPairWeek(evs,monStart(calD),displayGids);
    else if(f.cluster) html=renderClusterWeek(evs,monStart(calD),f.cluster);
    else html=renderNormalWeek(evs,monStart(calD),f);
  } else if(calV==='range'){
    const from=document.getElementById('cal-range-from')?.value||d2s(calD);
    const to=document.getElementById('cal-range-to')?.value||from;
    const fromD=from<=to?from:to, toD=from<=to?to:from; // safety: swap if reversed
    (document.getElementById('cal-title')||{}).textContent=`${fD(fromD)} – ${fD(toD)}`;
    const evs=filterE(f,fromD,toD);
    html=renderRangeView(evs,fromD,toD,f,displayGids);
  } else if(calV==='list'){
    const y=calD.getFullYear(),m=calD.getMonth();
    (document.getElementById('cal-title')||{}).textContent ='📋 רשימה — '+hebM(calD);
    const evs=filterE(f,d2s(new Date(y,m,1)),d2s(new Date(y,m+1,0)));
    html=renderCalList(evs,calD);
  } else {
    const y=calD.getFullYear(),m=calD.getMonth();
    (document.getElementById('cal-title')||{}).textContent =hebM(calD);
    const evs=filterE(f,d2s(new Date(y,m,1)),d2s(new Date(y,m+1,0)));
    html=renderMonth(evs,calD);
  }
  document.getElementById('cal-body').innerHTML=html;
}
function isPairBroken(pairId,ds){return !!pairBreaks[pairId+'_'+ds];}
function setPairBreak(pairId,ds,broken){
  const k=pairId+'_'+ds;
  if(broken) pairBreaks[k]=true; else delete pairBreaks[k];
  save(); refresh();
}

// City-based color map for calendar
const CITY_COLORS=(()=>{
  // Neutral palette — one color per city, readable and clean
  const palette=[
    {solid:'#37474f',light:'#eceff1',border:'#b0bec5',text:'#37474f'},
    {solid:'#1565c0',light:'#e3f2fd',border:'#90caf9',text:'#1565c0'},
    {solid:'#2e7d32',light:'#e8f5e9',border:'#a5d6a7',text:'#2e7d32'},
    {solid:'#6a1b9a',light:'#f3e5f5',border:'#ce93d8',text:'#6a1b9a'},
    {solid:'#c62828',light:'#ffebee',border:'#ef9a9a',text:'#c62828'},
    {solid:'#00695c',light:'#e0f2f1',border:'#80cbc4',text:'#00695c'},
    {solid:'#e65100',light:'#fff3e0',border:'#ffcc80',text:'#e65100'},
  ];
  const map={};let idx=0;
  return(city)=>{
    if(!city) return palette[0];
    if(!map[city]) map[city]=palette[idx++%palette.length];
    return map[city];
  };
})();
// ─── Range View — day-by-day between two dates ───────────────────
function renderRangeView(evs, fromDs, toDs, f, displayGids){
  let html='';
  let cur=s2d(fromDs);
  const end=s2d(toDs);
  let dayCount=0;
  while(cur<=end && dayCount<62){
    const ds=d2s(cur);
    const dayEvs=evs.filter(s=>s.d===ds);
    const hol=getHolidayInfo(ds,f&&f.city||null,f&&f.cls||null);
    const blk=getBlockedInfo(ds);
    const isFri=cur.getDay()===5, isSat=cur.getDay()===6;
    const hdrStyle=isSat?'background:linear-gradient(135deg,#546e7a,#78909c)':isFri?'background:linear-gradient(135deg,#e65100,#f4511e)':'';
    html+=`<div class="dsec" style="margin-bottom:10px">
      <div class="dsh gan" style="${hdrStyle}">
        ${fD(ds)} — יום ${dayN(ds)}
        ${hol?`<span style="background:rgba(255,255,255,.2);border-radius:4px;padding:1px 7px;font-size:.72rem">${hol.emoji} ${hol.name}</span>`:''}
        ${dayEvs.length?`<span style="margin-right:auto;font-size:.72rem;opacity:.8">${dayEvs.length} פעילויות</span>`:'<span style="margin-right:auto;font-size:.72rem;opacity:.6">אין פעילויות</span>'}
        <button onclick="openBlockedDate('${ds}')" style="background:rgba(255,255,255,.15);border:none;border-radius:4px;padding:1px 7px;cursor:pointer;font-size:.68rem;color:#fff">🚫</button>
        <button onclick="calD=s2d('${ds}');setView('day')" style="background:rgba(255,255,255,.15);border:none;border-radius:4px;padding:1px 7px;cursor:pointer;font-size:.68rem;color:#fff">📋 יומי</button>
      </div>`;
    if(blk) html+=`<div style="padding:5px 12px;background:#ffebee;font-size:.75rem;color:#c62828;font-weight:700">${blk.icon||'🚫'} ${blk.reason}${blk.note?' — '+blk.note:''}</div>`;

    if(!dayEvs.length){
      html+=`<div style="padding:10px;text-align:center;color:#bbb;font-size:.76rem;background:#fff">אין פעילויות</div>`;

    } else if(f&&f.cluster){
      // ── אשכול: לפי שעה ──
      html+=`<div style="background:#fff;padding:8px">${renderClusterDay(dayEvs,ds,f.cluster)}</div>`;

    } else if(displayGids){
      // ── זוג/שלישייה ספציפי ──
      html+=`<div style="background:#fff;padding:8px">${renderPairDay(dayEvs,displayGids)}</div>`;

    } else {
      // ── תצוגה כללית: עיר → זוגות לפי שעה → גנים בודדים לפי שעה ──
      const cityFilter=f&&f.city||'';
      const allCities=cityFilter
        ? [cityFilter]
        : [...new Set(dayEvs.map(s=>G(s.g).city||'אחר'))].sort((a,b)=>a.localeCompare(b,'he'));

      allCities.forEach(city=>{
        const cityEvs=dayEvs.filter(s=>(G(s.g).city||'אחר')===city);
        if(!cityEvs.length) return;
        const clr=CITY_COLORS(city);
        html+=`<div style="margin:0 0 10px 0">`;
        if(!cityFilter){
          html+=`<div style="display:flex;align-items:center;gap:8px;padding:4px 8px;background:${clr.light};border-right:3px solid ${clr.solid};border-radius:5px;margin-bottom:6px">
            <span style="font-weight:800;color:${clr.solid};font-size:.8rem">🏙️ ${city}</span>
            <span style="font-size:.7rem;color:#78909c">${cityEvs.length} פעילויות</span>
          </div>`;
        }

        // --- זוגות: מיון לפי שעה הכי מוקדמת בזוג ---
        const pairedGids=new Set();
        const pairBlocks=[];
        pairs.forEach(pair=>{
          if(isPairBroken(pair.id,ds)) return;
          const pairEvs=cityEvs.filter(s=>pair.ids.includes(s.g));
          if(!pairEvs.length) return;
          pair.ids.forEach(id=>pairedGids.add(id));
          const earliest=pairEvs.map(s=>s.t||'99:99').sort()[0];
          pairBlocks.push({pair,pairEvs,earliest});
        });
        // sort pair blocks by earliest event time
        pairBlocks.sort((a,b)=>a.earliest.localeCompare(b.earliest));
        if(pairBlocks.length){
          html+=`<div class="pairs-4col" style="margin-bottom:8px">`;
          pairBlocks.forEach(({pair,pairEvs})=>{
            html+=renderPairCard(pair,pairEvs,{ds,clr,showEdit:true,showExport:true});
          });
          html+=`</div>`;
        }

        // --- גנים בודדים: לפי שעה ---
        const soloEvs=cityEvs
          .filter(s=>!pairedGids.has(s.g))
          .sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
        if(soloEvs.length){
          html+=`<div style="display:flex;flex-wrap:wrap;gap:6px">`;
          soloEvs.forEach(s=>{
            const g=G(s.g);
            const stc=s.st!=='ok'?'st-'+s.st:'';
            html+=`<div style="min-width:160px;flex:1;max-width:260px;border:1.5px solid ${clr.border};border-radius:7px;padding:7px;cursor:pointer;background:${clr.light};border-right:3px solid ${clr.solid}" onclick="openSP(${s.id})" class="${stc}">
              ${s.t?`<div style="font-size:.8rem;font-weight:800;color:${clr.solid};margin-bottom:2px">⏰ ${fT(s.t)}</div>`:''}
              <div style="font-weight:700;font-size:.78rem;color:#1a237e">${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</div>
              <div style="font-size:.72rem;color:#546e7a;margin-top:1px">${supBase(s.a)}${(s.act||supAct(s.a))?` · ${s.act||supAct(s.a)}`:''}</div>
              <div style="font-size:.68rem;font-weight:700;margin-top:2px">${stLabel(s)}</div>
            </div>`;
          });
          html+=`</div>`;
        }
        html+=`</div>`; // end city block
      });
    }

    html+=`</div>`; // end day
    cur=addD(cur,1);
    dayCount++;
  }
  if(dayCount>=62) html+=`<div style="background:#fff3e0;padding:10px;text-align:center;border-radius:7px;color:#e65100;font-size:.8rem">⚠️ הטווח המקסימלי הוא 62 ימים</div>`;
  return html||`<div class="card" style="text-align:center;color:#999;padding:25px">בחר טווח תאריכים</div>`;
}

// ─── Cluster Day View — sorted by time ─────────────────────────
function renderClusterDay(evs, ds, clusterName){
  let html='';
  const hol=getHolidayInfo(ds,null,null);
  if(hol) html+=`<div class="hol-banner ${hol.type||'vacation'}" style="margin-bottom:8px;font-size:.82rem">${hol.emoji} <b>${hol.name}</b>${hol.note?' — '+hol.note:''}</div>`;
  const blk=getBlockedInfo(ds);
  if(blk) html+=`<div style="background:#fce4ec;border:2px solid #e91e63;border-radius:9px;padding:9px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
    <span style="font-size:.85rem;font-weight:700;color:#c62828">${blk.icon||'🚫'} <b>${blk.reason}</b>${blk.note?' — '+blk.note:''}</span>
    <button onclick="openBlockedDate('${ds}')" style="background:none;border:1.5px solid #e91e63;color:#c62828;border-radius:5px;padding:2px 8px;cursor:pointer;font-size:.72rem">✏️ ערוך</button>
  </div>`;
  const isAll = clusterName==='__all__';
  html+=`<div style="background:#e8eaf6;border-radius:7px;padding:6px 12px;margin-bottom:10px;display:flex;align-items:center;gap:8px;font-size:.78rem;font-weight:700;color:#1a237e">
    🔢 ${isAll?'כל האשכולות':('אשכול: '+clusterName)} <span style="font-weight:400;color:#546e7a">${evs.length} פעילויות</span>
  </div>`;
  if(!evs.length) return html+`<div class="card" style="text-align:center;color:#999;padding:25px">אין פעילויות</div>`;

  if(isAll){
    // ── כל האשכולות: עיר → אשכול → שעה ──
    const allCities=[...new Set(evs.map(s=>G(s.g).city||'אחר'))].sort((a,b)=>a.localeCompare(b,'he'));
    allCities.forEach(city=>{
      const cityEvs=evs.filter(s=>(G(s.g).city||'אחר')===city);
      if(!cityEvs.length) return;
      const clrCity=CITY_COLORS(city);
      html+=`<div style="margin-bottom:14px">
        <div style="padding:5px 10px;background:${clrCity.solid};color:#fff;border-radius:6px;font-size:.82rem;font-weight:800;margin-bottom:8px">🏙️ ${city}</div>`;
      // Group by cluster within city
      const clusterMap={};
      cityEvs.forEach(s=>{
        const gClusters=gardenClusters(s.g);
        const clKey=gClusters.length?gClusters[0].name:'ללא אשכול';
        (clusterMap[clKey]=clusterMap[clKey]||[]).push(s);
      });
      Object.entries(clusterMap).sort((a,b)=>a[0].localeCompare(b[0],'he')).forEach(([clName,clEvs])=>{
        const sorted=[...clEvs].sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
        html+=`<div style="margin-bottom:10px">
          <div style="padding:3px 10px;background:${clrCity.light};border-right:3px solid ${clrCity.solid};border-radius:4px;font-size:.74rem;font-weight:700;color:${clrCity.solid};margin-bottom:5px">🔢 ${clName} — ${sorted.length} פעילויות</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">`;
        sorted.forEach(s=>{
          const g=G(s.g);
          const stc=s.st!=='ok'?'st-'+s.st:'';
          html+=`<div style="min-width:160px;flex:1;max-width:260px;border:1.5px solid ${clrCity.border};border-radius:7px;padding:7px;cursor:pointer;background:#fff;border-right:3px solid ${clrCity.solid}" onclick="openSP(${s.id})" class="${stc}">
            ${s.t?`<div style="font-size:.8rem;font-weight:800;color:${clrCity.solid};margin-bottom:2px">⏰ ${fT(s.t)}</div>`:'<div style="font-size:.7rem;color:#aaa">ללא שעה</div>'}
            <div style="font-weight:700;font-size:.78rem;color:#1a237e">${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</div>
            <div style="font-size:.72rem;color:#546e7a;margin-top:1px">${supBase(s.a)}${(s.act||supAct(s.a))?` · ${s.act||supAct(s.a)}`:''}</div>
            <div style="font-size:.68rem;font-weight:700;margin-top:2px">${stLabel(s)}</div>
            <div class="qacts" onclick="event.stopPropagation()">
              ${s.st==='done'?'':`<button title="התקיים" onclick="qSetSt(${s.id},'done')">✔️</button>`}
              ${s.st==='can'?'':`<button title="בטל" onclick="qSetSt(${s.id},'can')">❌</button>`}
              <button title="דחה" onclick="openPostpone(${s.id})">⏩</button>
            </div>
          </div>`;
        });
        html+=`</div></div>`;
      });
      html+=`</div>`;
    });
  } else {
    // ── אשכול בודד: לפי שעה ──
    const sorted=[...evs].sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
    sorted.forEach(s=>{
      const g=G(s.g);
      const stc=s.st!=='ok'?'st-'+s.st:'';
      const clrCity=CITY_COLORS(g.city||'');
      html+=`<div class="city-block" style="margin-bottom:8px">
        <div class="city-block-hdr" style="background:${clrCity.solid};font-size:.76rem">
          ${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}
          ${g.st?`<span style="font-size:.65rem;font-weight:400;opacity:.8">${g.st}</span>`:''}
          <span style="font-size:.65rem;opacity:.75;font-weight:400;margin-right:auto">📍 ${g.city||''}</span>
        </div>
        <div style="background:#fff;padding:7px">
          <div class="pslot ${stc}" style="border-right:3px solid ${clrCity.solid};background:${clrCity.light}" onclick="openSP(${s.id})">
            ${s.t?`<div class="pt" style="font-size:.82rem;font-weight:800;color:${clrCity.solid}">⏰ ${fT(s.t)}</div>`:'<div class="pt" style="color:#aaa">ללא שעה</div>'}
            <div class="pn">${supBase(s.a)}</div>
            ${(s.act||supAct(s.a))?`<div style="font-size:.69rem;color:${clrCity.solid};font-weight:600">🎯 ${s.act||supAct(s.a)}</div>`:''}
            ${s.grp>1?`<div style="font-size:.68rem;color:#546e7a">👥 ${s.grp} קבוצות</div>`:''}
            <div class="pst">${stLabel(s)}</div>
            ${s.nt?`<div style="font-size:.68rem;color:#78909c">📝 ${s.nt}</div>`:''}
            <div class="qacts" onclick="event.stopPropagation()">
              ${s.st==='done'?'':`<button title="התקיים" onclick="qSetSt(${s.id},'done')">✔️</button>`}
              ${s.st==='can'?'':`<button title="בטל" onclick="qSetSt(${s.id},'can')">❌</button>`}
              ${s.st==='nohap'?'':`<button title="לא התקיים" onclick="qSetSt(${s.id},'nohap')">⚠️</button>`}
              <button title="דחה" onclick="openPostpone(${s.id})">⏩</button>
            </div>
          </div>
        </div>
      </div>`;
    });
  }
  return html;
}

// ─── Cluster Week View — each day sorted by time ─────────────────
function renderClusterWeek(evs, weekStart, clusterName){
  const isAll=clusterName==='__all__';
  let html=`<div style="background:#e8eaf6;border-radius:7px;padding:5px 12px;margin-bottom:10px;font-size:.77rem;font-weight:700;color:#1a237e">🔢 ${isAll?'כל האשכולות':('אשכול: '+clusterName)} — תצוגה שבועית לפי שעה</div>`;
  for(let i=0;i<6;i++){
    const d=addD(weekStart,i);
    const ds=d2s(d);
    const dayEvs=evs.filter(s=>s.d===ds).sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
    const hol=getHolidayInfo(ds,null,null);
    const blk=getBlockedInfo(ds);
    html+=`<div class="dsec" style="margin-bottom:10px">
      <div class="dsh gan">${fD(ds)} — יום ${dayN(ds)}${hol?` 🎉 ${hol.name}`:''}</div>`;
    if(blk) html+=`<div style="padding:5px 12px;background:#ffebee;font-size:.75rem;color:#c62828;font-weight:700">${blk.icon||'🚫'} ${blk.reason}</div>`;
    if(!dayEvs.length){
      html+=`<div style="padding:12px;text-align:center;color:#bbb;font-size:.76rem;background:#fff">אין פעילויות</div>`;
    } else if(isAll){
      // עיר → אשכול → שעה
      const allCities=[...new Set(dayEvs.map(s=>G(s.g).city||'אחר'))].sort((a,b)=>a.localeCompare(b,'he'));
      html+=`<div style="background:#fff;padding:8px">`;
      allCities.forEach(city=>{
        const cityEvs=dayEvs.filter(s=>(G(s.g).city||'אחר')===city);
        if(!cityEvs.length) return;
        const clrCity=CITY_COLORS(city);
        html+=`<div style="margin-bottom:8px">
          <div style="padding:3px 8px;background:${clrCity.solid};color:#fff;border-radius:4px;font-size:.73rem;font-weight:700;margin-bottom:4px">🏙️ ${city}</div>`;
        const clusterMap={};
        cityEvs.forEach(s=>{
          const clKey=(gardenClusters(s.g)[0]||{}).name||'ללא אשכול';
          (clusterMap[clKey]=clusterMap[clKey]||[]).push(s);
        });
        Object.entries(clusterMap).sort((a,b)=>a[0].localeCompare(b[0],'he')).forEach(([clName,clEvs])=>{
          html+=`<div style="font-size:.68rem;font-weight:700;color:${clrCity.solid};background:${clrCity.light};padding:2px 7px;border-radius:3px;margin-bottom:3px">🔢 ${clName}</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:5px">`;
          [...clEvs].sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99')).forEach(s=>{
            const g=G(s.g);
            const stc=s.st!=='ok'?'st-'+s.st:'';
            html+=`<div style="min-width:150px;flex:1;max-width:240px;border:1.5px solid ${clrCity.border};border-right:3px solid ${clrCity.solid};border-radius:6px;padding:6px;cursor:pointer;background:#fff" onclick="openSP(${s.id})" class="${stc}">
              ${s.t?`<div style="font-size:.8rem;font-weight:800;color:${clrCity.solid}">⏰ ${fT(s.t)}</div>`:''}
              <div style="font-weight:700;font-size:.76rem;color:#1a237e">${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</div>
              <div style="font-size:.7rem;color:#546e7a">${supBase(s.a)}${(s.act||supAct(s.a))?` · ${s.act||supAct(s.a)}`:''}</div>
              <div style="font-size:.67rem;margin-top:2px">${stLabel(s)}</div>
            </div>`;
          });
          html+=`</div>`;
        });
        html+=`</div>`;
      });
      html+=`</div>`;
    } else {
      html+=`<div style="background:#fff;padding:8px;display:flex;flex-wrap:wrap;gap:6px">`;
      dayEvs.forEach(s=>{
        const g=G(s.g);
        const stc=s.st!=='ok'?'st-'+s.st:'';
        const clrCity=CITY_COLORS(g.city||'');
        const clBadge=isAll?(gardenClusters(g.id)[0]||{}).name||'':'';
        html+=`<div style="min-width:180px;flex:1;border:1.5px solid ${clrCity.border};border-radius:7px;padding:7px;cursor:pointer;background:${clrCity.light}" onclick="openSP(${s.id})" class="${stc}">
          ${s.t?`<div style="font-size:.82rem;font-weight:800;color:${clrCity.solid};margin-bottom:2px">⏰ ${fT(s.t)}</div>`:''}
          <div style="font-weight:700;font-size:.78rem;color:#1a237e">${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</div>
          ${clBadge?`<div style="font-size:.66rem;color:#546e7a">🔢 ${clBadge}</div>`:''}
          <div style="font-size:.73rem;color:#546e7a">${supBase(s.a)}${(s.act||supAct(s.a))?` · ${s.act||supAct(s.a)}`:''}</div>
          <div style="font-size:.68rem;font-weight:700;margin-top:2px">${stLabel(s)}</div>
        </div>`;
      });
      html+=`</div>`;
    }
    html+=`</div>`;
  }
  return html;
}

function renderNormalDay(evs,ds){
  const calCity=document.getElementById('cal-city').value;
  const calCls=document.getElementById('cal-cls').value;
  const hol=getHolidayInfo(ds,calCity||null,calCls||null);
  let topHtml='';
  if(hol) topHtml=`<div class="hol-banner ${hol.type||'vacation'}" style="margin-bottom:8px;font-size:.82rem">${hol.emoji} <b>${hol.name}</b>${hol.note?' — '+hol.note:''}</div>`;
  const blk=getBlockedInfo(ds);
  if(blk) topHtml+=`<div style="background:#fce4ec;border:2px solid #e91e63;border-radius:9px;padding:9px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
    <span style="font-size:.85rem;font-weight:700;color:#c62828">${blk.icon||'🚫'} <b>${blk.reason}</b>${blk.note?' — '+blk.note:''}</span>
    <button onclick="openBlockedDate('${ds}')" style="background:none;border:1.5px solid #e91e63;color:#c62828;border-radius:5px;padding:2px 8px;cursor:pointer;font-size:.72rem">✏️ ערוך</button>
  </div>`;
  const activeGids=new Set(evs.map(s=>s.g));
  const pairedGids=new Set();
  const pairRowsHtml=[]; // rendered pair rows
  // Group pairs by city for unified color display
  const pairsByCity={};
  pairs.forEach(pair=>{
    if(isPairBroken(pair.id,ds)) return;
    const pairEvs=evs.filter(s=>pair.ids.includes(s.g));
    if(!pairEvs.length) return;
    const city=G(pair.ids[0]).city||'אחר';
    if(!pairsByCity[city]) pairsByCity[city]=[];
    pairsByCity[city].push({pair,pairEvs});
    pair.ids.forEach(id=>pairedGids.add(id));
  });
  Object.keys(pairsByCity).sort().forEach(city=>{
    const clr=CITY_COLORS(city);
    const cityPairs=pairsByCity[city];
    cityPairs.forEach(({pair,pairEvs})=>{
      pairRowsHtml.push(renderPairCard(pair,pairEvs,{ds,clr,showEdit:true,showExport:true}));
    });
  });
  const unpairedEvs=evs.filter(s=>!pairedGids.has(s.g));
  const cityMap={};
  unpairedEvs.forEach(s=>{
    const g=G(s.g);
    const c=g.city||'אחר';
    const cl=gcls(g);
    if(!cityMap[c]) cityMap[c]={};
    if(!cityMap[c][cl]) cityMap[c][cl]=[];
    cityMap[c][cl].push({...s,gd:g});
  });
  pairs.forEach(pair=>{
    if(!isPairBroken(pair.id,ds)) return;
    const pairEvs=evs.filter(s=>pair.ids.includes(s.g));
    if(!pairEvs.length) return;
    pairEvs.forEach(s=>{
      if(pairedGids.has(s.g)) return; // already handled
      const g=G(s.g);
      const c=g.city||'אחר';
      const cl=gcls(g);
      if(!cityMap[c]) cityMap[c]={};
      if(!cityMap[c][cl]) cityMap[c][cl]=[];
      if(!cityMap[c][cl].find(x=>x.id===s.id)) cityMap[c][cl].push({...s,gd:g});
    });
  });

  let html=topHtml;
  if(pairRowsHtml.length){
    // Group pair cards by city with headers
    const pairCardsByCity={};
    Object.keys(pairsByCity).sort().forEach(city=>{
      pairCardsByCity[city]=[];
    });
    // Re-assign cards to cities (in order)
    let cardIdx=0;
    Object.keys(pairsByCity).sort().forEach(city=>{
      const clr=CITY_COLORS(city);
      pairsByCity[city].forEach(({pair,pairEvs})=>{
        if(!pairCardsByCity[city]) pairCardsByCity[city]=[];
        pairCardsByCity[city].push(renderPairCard(pair,pairEvs,{ds,clr,showEdit:true,showExport:true}));
      });
    });
    Object.keys(pairCardsByCity).sort().forEach(city=>{
      const cards=pairCardsByCity[city];
      if(!cards||!cards.length) return;
      html+=`<div style="margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div style="flex:1;height:2px;background:${CITY_COLORS(city).solid};opacity:.3"></div>
          <span style="font-size:.75rem;font-weight:800;color:${CITY_COLORS(city).solid};white-space:nowrap">🏙️ ${city} (${cards.length} זוגות)</span>
          <div style="flex:1;height:2px;background:${CITY_COLORS(city).solid};opacity:.3"></div>
        </div>
        <div class="pairs-4col">${cards.join('')}</div>
      </div>`;
    });
  }
  const allSoloEvs=[];
  unpairedEvs.forEach(s=>allSoloEvs.push({...s,gd:G(s.g)}));
  pairs.forEach(pair=>{
    if(!isPairBroken(pair.id,ds)) return;
    evs.filter(s=>pair.ids.includes(s.g)).forEach(s=>{
      if(!allSoloEvs.find(x=>x.id===s.id))
        allSoloEvs.push({...s,gd:G(s.g),_broken:pair});
    });
  });

  if(allSoloEvs.length){
    const byCitySolo={};
    allSoloEvs.forEach(s=>{
      const c=s.gd.city||'אחר';
      if(!byCitySolo[c]) byCitySolo[c]=[];
      byCitySolo[c].push(s);
    });
    Object.keys(byCitySolo).sort().forEach(city=>{
      const clr=CITY_COLORS(city);
      html+=`<div style="margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div style="flex:1;height:2px;background:${clr.solid};opacity:.3"></div>
          <span style="font-size:.75rem;font-weight:800;color:${clr.solid};white-space:nowrap">🏙️ ${city} — גנים ללא זוג</span>
          <div style="flex:1;height:2px;background:${clr.solid};opacity:.3"></div>
        </div>
        <div class="pairs-4col">`;
      byCitySolo[city].sort((a,b)=>{
        const clA=(gardenClusters(a.g)[0]||{}).name||'ת';
        const clB=(gardenClusters(b.g)[0]||{}).name||'ת';
        return clA.localeCompare(clB,'he')||(a.t||'99:99').localeCompare(b.t||'99:99');
      }).forEach(s=>{
        const stc=s.st!=='ok'?'st-'+s.st:'';
        const brokenBadge=s._broken?`<span style="font-size:.62rem;background:#fff3e0;color:#e65100;padding:1px 5px;border-radius:3px;font-weight:700">⚡ זוג פורק</span>`:'';
        html+=`<div class="city-block" style="margin-bottom:0">
          <div class="city-block-hdr" style="background:${clr.solid};font-size:.76rem">
            ${gcls(s.gd)==='ביה"ס'?'🏛️':'🏫'} ${s.gd.name}
            ${s.gd.st?`<span style="font-size:.65rem;font-weight:400;opacity:.8">${s.gd.st}</span>`:''}
            ${brokenBadge}
            <span style="font-size:.65rem;opacity:.75;font-weight:400;margin-right:auto">📍 ${city}</span>
            <button onclick="event.stopPropagation();quickAddPartner(${s.g})" style="background:rgba(255,255,255,.22);border:none;border-radius:3px;padding:1px 6px;cursor:pointer;font-size:.66rem;color:#fff">➕ בן זוג</button>
          </div>
          <div style="background:#fff;padding:7px">
            <div class="pslot ${stc}" style="border-right:3px solid ${clr.solid};background:${clr.light}" onclick="openSP(${s.id})">
              ${s._fromD?`<div style="font-size:.67rem;color:#e65100;font-weight:700;background:#fff3e0;padding:1px 5px;border-radius:3px;margin-bottom:2px">↩️ הועבר מ-${fD(s._fromD)}</div>`:''}
              ${s.t?`<div class="pt">⏰ ${fT(s.t)}</div>`:''}
              <div class="pn">${supBase(s.a)}</div>
              ${(s.act||supAct(s.a))?`<div style="font-size:.69rem;color:${clr.solid};font-weight:600">🎯 ${s.act||supAct(s.a)}</div>`:''}
              ${s.p?`<div class="pp">📞 ${s.p}</div>`:''}
              ${s.grp>1?`<div style="font-size:.68rem;color:#546e7a">👥 ${s.grp} קבוצות</div>`:''}
              <div class="pst">${stLabel(s)}</div>
              ${s.nt?`<div style="font-size:.68rem;color:#78909c">📝 ${s.nt}</div>`:''}
              <div class="qacts" onclick="event.stopPropagation()">
                ${s.st==='done'?'':`<button title="התקיים" onclick="qSetSt(${s.id},'done')">✔️</button>`}
                ${s.st==='can'?'':`<button title="בטל" onclick="qSetSt(${s.id},'can')">❌</button>`}
                ${s.st==='nohap'?'':`<button title="לא התקיים" onclick="qSetSt(${s.id},'nohap')">⚠️</button>`}
                <button title="דחה" onclick="openPostpone(${s.id})">⏩</button>
              </div>
            </div>
          </div>
        </div>`;
      });
      html+='</div></div>'; // end city solo group
    });
  }

  if(!html||html===topHtml) html+=`<div class="card" style="text-align:center;color:#999;padding:25px">אין פעילויות ביום זה</div>`;
  return html;
}

// ─── Unified pair card renderer ─────────────────────────
// Used in both calendar day view AND dashboard
// Layout: pair name label (left) | shared supplier info (top) + garden rows (stacked)
function renderPairCard(pair, pairEvs, opts){
  // opts: {ds, clr, showEdit, showExport}
  const ds=opts&&opts.ds||'';
  const clr=(opts&&opts.clr)||{solid:'#37474f',light:'#eceff1',border:'#b0bec5',text:'#37474f'};
  const showEdit=opts&&opts.showEdit!==false;
  const showExport=opts&&opts.showExport!==false;

  // Derive shared supplier info (use first event's data)
  const firstEv=pairEvs[0]||{};
  const supName=firstEv.a||'';
  const supPhone=firstEv.p||(()=>{
    const ex=supBaseEx(supBase(supName));
    return ex&&ex.ph1?ex.ph1:'';
  })();
  const actName=firstEv.act||supAct(supName)||'';

  // Buttons
  const editBtn=showEdit&&ds
    ?`<button onclick="openPairQuickEdit('${pair.id}','${ds}')" style="background:rgba(255,255,255,.25);border:none;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:.65rem;color:#fff" title="ערוך">✏️</button>`
    :'';
  const expBtn=showExport&&ds
    ?`<button onclick="exportPairRow('${pair.id}','${ds}')" style="background:rgba(255,255,255,.25);border:none;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:.65rem;color:#fff" title="יצוא">📋</button>`
    :'';

  let html=`<div class="pair-card">
    <div class="pair-card-hdr" style="background:${clr.solid}">
      🔗 ${pair.name}
      <span style="font-size:.68rem;font-weight:400;opacity:.8;margin-right:auto">${G(pair.ids[0]).city||''}</span>
      ${expBtn}${editBtn}
    </div>
    <div class="pair-card-body">
      <div class="pair-card-label" style="background:${clr.light}">
        <span class="pcl-name" style="color:${clr.text}">${pair.name}</span>
        ${showEdit&&ds?`<div class="pcl-btns">
          <button onclick="openPairQuickEdit('${pair.id}','${ds}')" style="background:${clr.solid};border:none;border-radius:3px;padding:1px 5px;cursor:pointer;font-size:.62rem;color:#fff">✏️</button>
          ${showExport?`<button onclick="exportPairRow('${pair.id}','${ds}')" style="background:${clr.solid};border:none;border-radius:3px;padding:1px 5px;cursor:pointer;font-size:.62rem;color:#fff">📋</button>`:''}
        </div>`:''}
      </div>
      <div class="pair-card-content">
        <div class="pair-card-shared">
          ${supName?`<span class="pcs-item">📚 <b>${supBase(supName)}</b></span>`:''}
          ${supPhone?`<span class="pcs-item">📞 ${supPhone}</span>`:''}
          ${actName?`<span class="pcs-item">🎯 ${actName}</span>`:''}
        </div>
        <div class="pair-gardens">`;

  // One row per garden
  pair.ids.filter(Boolean).forEach(gid=>{
    const g=G(gid);
    const ev=pairEvs.find(s=>s.g===gid);
    const stc=ev&&ev.st!=='ok'?'st-'+ev.st:'';
    if(!ev){
      const gblkNone=ds?getGardenBlock(gid,ds):null;
      html+=`<div class="pair-garden-row" style="opacity:${gblkNone?1:.5};${gblkNone?'background:#fce4ec;border-right:3px solid #e91e63;':''}" onclick="${ds?`openGcellPopup(${gid},'${ds}',event)`:''}" style="cursor:${ds?'pointer':'default'}">
        <div class="pgr-left">
          <div class="pgr-name">${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</div>
          ${g.st?`<div class="pgr-addr">📍 ${g.st}</div>`:''}
          ${gblkNone
            ?`<div class="pgr-status" style="color:#c62828">${gblkNone.icon||'🚫'} ${gblkNone.reason}</div>`
            :`<div class="pgr-status" style="color:#999;font-size:.67rem">אין פעילות — לחץ להוסיף</div>`}
        </div>
      </div>`;
    } else {
      const gblkEv=ds?getGardenBlock(gid,ds):null;
      html+=`<div class="pair-garden-row ${stc}" style="${gblkEv?'border-right:3px solid #e91e63;':''}" onclick="openSP(${ev.id})">
        <div class="pgr-left">
          <div class="pgr-name">${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</div>
          ${g.st?`<div class="pgr-addr">📍 ${g.st}</div>`:''}
          ${ev.t?`<div class="pgr-time">⏰ ${fT(ev.t)}</div>`:''}
          ${gblkEv?`<div style="font-size:.67rem;color:#c62828">${gblkEv.icon||'🚫'} ${gblkEv.reason}</div>`:''}
          <div class="pgr-status" style="color:${stc?'#c62828':'#2e7d32'}">${stLabel(ev)}</div>
        </div>
        <div class="pgr-right">
          <div class="pgr-qacts" onclick="event.stopPropagation()">
            ${ev.st==='done'?'':`<button title="התקיים" onclick="qSetSt(${ev.id},'done')">✔️</button>`}
            ${ev.st==='can'?'':`<button title="בטל" onclick="qSetSt(${ev.id},'can')">❌</button>`}
            <button title="דחה שוב" onclick="openPostpone(${ev.id})">⏩</button>
            ${ev.st==='nohap'?'':`<button title="לא התקיים" onclick="openNohapQ(${ev.id})" style="color:#e91e63">⚠️</button>`}
          </div>
        </div>
      </div>`;
    }
  });

  html+='</div></div></div></div>';
  return html;
}
function renderGardenCols(evs,gids,clr){
  const cols=gids.filter(Boolean);
  let html='';
  cols.forEach((gid,i)=>{
    const g=G(gid);
    const ge=evs.filter(s=>s.g===gid).sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
    html+=`<div class="garden-col" style="border-right:${i>0?'1px solid rgba(0,0,0,.06)':'none'}">
      <div class="garden-col-hdr" style="color:${clr.text}">
        ${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}
      </div>`;
    if(!ge.length){
      html+='<div style="color:#ccc;font-size:.7rem;text-align:center;padding:10px 0">—</div>';
    } else {
      ge.forEach(s=>{
        const stc=s.st!=='ok'?'st-'+s.st:'';
        html+=`<div class="pslot ${stc}" style="border-right:3px solid ${clr.solid}" onclick="openSP(${s.id})">
          ${s._fromD?`<div style="font-size:.67rem;color:#e65100;font-weight:700;background:#fff3e0;padding:1px 5px;border-radius:3px;margin-bottom:2px">↩️ הועבר מ-${fD(s._fromD)}</div>`:''}
          ${s.t?`<div class="pt">⏰ ${fT(s.t)}</div>`:''}
          <div class="pn">${supBase(s.a)}</div>
          ${(s.act||supAct(s.a))?`<div style="font-size:.69rem;color:${clr.solid};font-weight:600;margin-top:1px">🎯 ${s.act||supAct(s.a)}</div>`:''}
          ${s.p?`<div class="pp">📞 ${s.p}</div>`:''}
          <div class="pst">${stLabel(s)}</div>
          <div class="qacts" onclick="event.stopPropagation()">
            ${s.st==='done'?'':`<button title="התקיים" onclick="qSetSt(${s.id},'done')">✔️</button>`}
            ${s.st==='can'?'':`<button title="בטל" onclick="qSetSt(${s.id},'can')">❌</button>`}
            ${s.st==='nohap'?'':`<button title="לא התקיים" onclick="qSetSt(${s.id},'nohap')">⚠️</button>`}
            <button title="דחה" onclick="openPostpone(${s.id})">⏩</button>
          </div>
        </div>`;
      });
    }
    html+='</div>';
  });
  // Pad with empty col if only 2 gardens (for 3-col alignment)
  if(cols.length===2){
    html+=`<div class="garden-col" style="border-right:none;background:#fafafa">
      <div style="text-align:center;color:#ddd;padding:20px 0;font-size:.8rem">—</div>
    </div>`;
  }
  return html;
}
function renderPairColsHTML(evs,gids,pairId){
  const cols=[gids[0]||null,gids[1]||null,gids[2]||null];
  const nCols=cols.filter(Boolean).length||1;
  const colsTpl=nCols===1?'1fr':nCols===2?'1fr 1fr':'1fr 1fr 1fr';
  let html=`<div class="pair-cols" style="grid-template-columns:${colsTpl}">`;
  cols.forEach((gid,i)=>{
    if(!gid){
      html+=`<div class="pcol"><div class="pch cx">—</div><div class="pcb"><div class="pempty">—</div></div></div>`;
      return;
    }
    const g=G(gid);
    const ge=evs.filter(s=>s.g===gid).sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
    html+=`<div class="pcol">
      <div style="font-size:.66rem;font-weight:700;text-align:center;padding:2px 6px;background:rgba(0,0,0,.12);color:#fff">${g.city}</div>
      <div class="pch"><span>${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</span></div>
      <div class="pcb">`;
    if(!ge.length) html+='<div class="pempty">אין פעילויות</div>';
    else ge.forEach(s=>html+=`<div class="pslot ${s.st!=='ok'?'st-'+s.st:''}" onclick="openSP(${s.id})">
      ${s.t?`<div class="pt">⏰ ${fT(s.t)}</div>`:''}
      ${s.act?`<div style="font-size:.68rem;color:#1565c0;font-weight:600">${s.act}</div>`:''}
      <div class="pn">${s.a}</div>
      ${s.p?`<div class="pp">📞 ${s.p}</div>`:''}
      <div class="pst">${stLabel(s)}</div>
      <div class="qacts" onclick="event.stopPropagation()">
        ${s.st==='done'?'':`<button title="התקיים" onclick="qSetSt(${s.id},'done')">✔️</button>`}
        ${s.st==='can'?'':`<button title="בטל" onclick="qSetSt(${s.id},'can')">❌</button>`}
        ${s.st==='nohap'?'':`<button title="לא התקיים" onclick="qSetSt(${s.id},'nohap')">⚠️</button>`}
        <button title="דחה" onclick="openPostpone(${s.id})">⏩</button>
      </div>
    </div>`);
    html+='</div></div>';
  });
  return html+'</div>';
}

function renderPairDay(evs,gids){
  const pclr=pairClrClass(gids[0]?gardenPair(gids[0])?.id:0)||'pc0';
  return`<div class="pair-row ${pclr}"><div class="pair-row-label ${pclr}">🔗 ${gids.map(id=>G(id).name||'').join(' + ')}</div>${renderPairColsHTML(evs,gids)}</div>`;
}

function renderNormalWeek(evs,ws,f){
  const days=[],dn=['ראשון','שני','שלישי','רביעי','חמישי','שישי'],tday=td();
  for(let i=0;i<6;i++) days.push(addD(ws,i));
  let gids=[...new Set(evs.map(s=>s.g))];
  if(f.gids&&f.gids.length) gids=f.gids;
  if(!gids.length) return'<div class="card" style="text-align:center;color:#999;padding:25px">אין פעילויות</div>';
  const usedGids=new Set();
  const pairGroups=[]; // {type:'pair',pair,gids} | {type:'solo',gid,city,cls}
  pairs.forEach(pair=>{
    const myGids=pair.ids.filter(gid=>gids.includes(gid));
    if(!myGids.length) return;
    myGids.forEach(gid=>usedGids.add(gid));
    pairGroups.push({type:'pair',pair,gids:myGids});
  });
  gids.filter(gid=>!usedGids.has(gid)).forEach(gid=>{
    const g=G(gid);
    pairGroups.push({type:'solo',gid,city:g.city||'אחר',cls:gcls(g)});
  });
  const weekEvGids=new Set(evs.map(s=>s.g));
  pairGroups.sort((a,b)=>{
    const aAct=a.type==='pair'?a.gids.some(id=>weekEvGids.has(id)):weekEvGids.has(a.gid);
    const bAct=b.type==='pair'?b.gids.some(id=>weekEvGids.has(id)):weekEvGids.has(b.gid);
    if(aAct&&!bAct) return -1; if(!aAct&&bAct) return 1;
    const aName=a.type==='pair'?a.pair.name:G(a.gid).name;
    const bName=b.type==='pair'?b.pair.name:G(b.gid).name;
    return aName.localeCompare(bName,'he');
  });
  let html='<div class="tw" style="overflow-x:auto"><table style="min-width:600px"><thead><tr>';
  html+='<th style="min-width:130px;background:#e8eaf6;color:#283593">גן / זוג</th>';
  days.forEach((d,i)=>{
    const ds=d2s(d);
    const hol=getHolidayInfo(ds);
    const blkWk=getBlockedInfo(ds);
    const bg=ds===tday?'#1565c0':blkWk?'#fce4ec':hol?hol.bg:'#e8eaf6';
    const col=ds===tday?'#fff':blkWk?'#c62828':hol?hol.color:'#283593';
    const border=blkWk?'border-bottom:3px solid #e91e63;':'';
    html+=`<th style="background:${bg};color:${col};padding:5px 4px;text-align:center;font-size:.74rem;${border}" onclick="jumpToDay('${ds}')">${dn[i]}<br><span style="font-size:.64rem;font-weight:400">${fD(ds)}</span>
      ${blkWk?`<br><span style="font-size:.6rem;cursor:pointer" onclick="event.stopPropagation();openBlockedDate('${ds}')">${blkWk.icon||'🚫'} ${blkWk.reason}</span>`:`<br><span style="font-size:.58rem;opacity:.4;cursor:pointer" onclick="event.stopPropagation();openBlockedDate('${ds}')" title="חסום תאריך">🚫</span>`}
    </th>`;
  });
  html+='</tr></thead><tbody>';
  pairGroups.forEach(grp=>{
    if(grp.type==='pair'){
      const clr=pairWeekColors?pairWeekColors(grp.pair.id):{solid:'#e65100',light:'#fff3e0'};
      html+=`<tr><td colspan="7" style="background:${clr.solid};color:#fff;padding:4px 8px;font-size:.75rem;font-weight:700">
        🔗 ${grp.pair.name}
      </td></tr>`;
      grp.gids.forEach(gid=>{
        const g=G(gid);
        html+=`<tr><td style="background:${clr.light};font-size:.73rem;padding:4px 7px;color:#333;font-weight:600;border-right:3px solid ${clr.solid}">${g.name}<br><span style="font-size:.66rem;color:#78909c">${g.city}</span></td>`;
        days.forEach(d=>{
          const ds=d2s(d);
          const hol=getHolidayInfo(ds,g.city,gcls(g));
          const de=evs.filter(s=>s.g===gid&&s.d===ds).sort((a,b)=>(a.t||'').localeCompare(b.t||''));
          const cellBg=hol?hol.bg:(clr.light);
          const gBlk=getGardenBlock(gid,ds);
          html+=`<td style="background:${gBlk?'#fce4ec':cellBg};padding:2px;${gBlk?'border:1.5px solid #e91e63;':''}" onclick="openGcellPopup(${gid},'${ds}',event)">${de.length
            ?de.map(ev=>`<div style="border-radius:4px;padding:3px 5px;margin:1px;cursor:pointer;font-size:.71rem;background:${clr.light};border-right:2px solid ${clr.solid};${ev.st==='can'?'opacity:.45;text-decoration:line-through;':ev.st==='post'?'background:#fff8e1;':''}" onclick="event.stopPropagation();openSP(${ev.id})">
              <div style="font-weight:700;color:#1a237e">${ev.a}${ev.act?'<span style="color:#1565c0;font-size:.64rem"> · '+ev.act+'</span>':''}</div>
              ${ev.t?'<div style="font-size:.67rem;color:#546e7a">⏰ '+fT(ev.t)+'</div>':''}
              <div style="font-size:.64rem">${stLabel(ev)}</div>
            </div>`).join('')+(gBlk?`<div style="font-size:.62rem;color:#c62828;padding:2px 4px">${gBlk.icon||'🚫'} ${gBlk.reason}</div>`:'')
            :gBlk?`<div style="font-size:.68rem;color:#c62828;padding:4px;text-align:center;cursor:pointer">${gBlk.icon||'🚫'} ${gBlk.reason}</div>`
            :hol?`<span style="font-size:.66rem;color:${hol.color}">${hol.emoji}</span>`
            :'<span style="color:#ccc;font-size:.8rem;cursor:pointer">+</span>'
          }</td>`;
        });
        html+='</tr>';
      });
    } else {
      const gid=grp.gid; const g=G(gid);
      html+=`<tr><td style="background:#f5f7ff;font-size:.73rem;padding:4px 7px;color:#333;font-weight:600">${g.name}<br><span style="font-size:.66rem;color:#78909c">${g.city}</span></td>`;
      days.forEach(d=>{
        const ds=d2s(d);
        const hol=getHolidayInfo(ds,g.city,gcls(g));
        const de=evs.filter(s=>s.g===gid&&s.d===ds).sort((a,b)=>(a.t||'').localeCompare(b.t||''));
        const soloBlk=getGardenBlock(gid,ds);
        html+=`<td style="${soloBlk?'background:#fce4ec;border:1.5px solid #e91e63;':hol?'background:'+hol.bg+';':''}" onclick="openGcellPopup(${gid},'${ds}',event)">${de.length
          ?de.map(ev=>`<div style="border-radius:4px;padding:3px 5px;margin:1px;cursor:pointer;font-size:.71rem;background:#e3f2fd;border-right:2px solid #1565c0;${ev.st==='can'?'opacity:.45;text-decoration:line-through;':''}" onclick="event.stopPropagation();openSP(${ev.id})">
            <div style="font-weight:700;color:#1a237e">${ev.a}${ev.act?'<span style="color:#1565c0;font-size:.64rem"> · '+ev.act+'</span>':''}</div>
            ${ev.t?'<div style="font-size:.67rem;color:#546e7a">⏰ '+fT(ev.t)+'</div>':''}
          </div>`).join('')+(soloBlk?`<div style="font-size:.62rem;color:#c62828;padding:2px 4px">${soloBlk.icon||'🚫'} ${soloBlk.reason}</div>`:'')
          :soloBlk?`<div style="font-size:.68rem;color:#c62828;padding:4px;text-align:center;cursor:pointer">${soloBlk.icon||'🚫'} ${soloBlk.reason}</div>`
          :hol?`<span style="font-size:.66rem;color:${hol.color}">${hol.emoji}</span>`
          :'<span style="color:#ccc;font-size:.8rem;cursor:pointer">+</span>'
        }</td>`;
      });
      html+='</tr>';
    }
  });
  return html+'</tbody></table></div>';
}

function renderPairWeek(evs,ws,gids){
  const days=[],dn=['ראשון','שני','שלישי','רביעי','חמישי','שישי'],tday=td();
  for(let i=0;i<6;i++) days.push(addD(ws,i));
  const cols=[gids[0]||null,gids[1]||null,gids[2]||null];
  const pair=gids[0]?gardenPair(gids[0]):null;
  const clr=pair?pairWeekColors(pair.id):{solid:'#1565c0',light:'#e3f2fd'};
  let html='<div class="tw"><table class="wpt"><thead><tr><th class="dth" style="min-width:75px">יום</th>';
  cols.forEach((gid,i)=>{
    if(!gid){html+=`<th class="thx">—</th>`;return;}
    const g=G(gid);
    html+=`<th style="background:${clr.solid};color:#fff;padding:6px 7px;text-align:center;border:1px solid #c5cae9">🏫 ${g.name}<br><span style="font-size:.66rem;font-weight:400;opacity:.9">${g.city}</span></th>`;
  });
  html+='</tr></thead><tbody>';
  days.forEach((d,i)=>{
    const ds=d2s(d);
    const hol=getHolidayInfo(ds);
    const holStyle=hol?`background:${hol.bg};`:'';
    html+=`<tr><td class="dth" style="${ds===tday?'background:#1565c0;color:#fff;':holStyle} text-align:center;white-space:nowrap;font-weight:700">${dn[i]}<br><span style="font-size:.66rem;font-weight:400">${fD(ds)}</span>${hol?`<br><span style="font-size:.64rem;color:${hol.color}">${hol.name}</span>`:''}</td>`;
    cols.forEach((gid,ci)=>{
      if(!gid){html+=`<td style="background:#f5f5f5"></td>`;return;}
      const de=evs.filter(s=>s.g===gid&&s.d===ds).sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
      const cellBg=hol?hol.bg:'#fff';
      const pwBlk=getGardenBlock(gid,ds);
      html+=`<td style="background:${pwBlk?'#fce4ec':cellBg};${pwBlk?'border:1.5px solid #e91e63;':''}" onclick="openGcellPopup(${gid},'${ds}',event)">${de.length?de.map(ev=>`<div style="border-radius:4px;padding:4px 6px;margin-bottom:3px;cursor:pointer;font-size:.72rem;background:${clr.light};border-right:2px solid ${clr.solid};" onclick="event.stopPropagation();openSP(${ev.id})"><div style="font-weight:700;color:#1a237e">${ev.a}</div>${ev.t?`<div style="font-size:.68rem;color:#546e7a">⏰ ${fT(ev.t)}</div>`:''}</div>`).join('')+(pwBlk?`<div style="font-size:.62rem;color:#c62828">${pwBlk.icon||'🚫'} ${pwBlk.reason}</div>`:'')
        :pwBlk?`<div style="font-size:.68rem;color:#c62828;padding:4px;text-align:center">${pwBlk.icon||'🚫'} ${pwBlk.reason}</div>`
        :'<span style="color:#ccc;font-size:.8rem;cursor:pointer">+</span>'}</td>`;
    });
    html+='</tr>';
  });
  return html+'</tbody></table></div>';
}

function renderCalList(evs, mDate){
  const y=mDate.getFullYear(),m=mDate.getMonth();
  const tday=td();
  // Group by date
  const byDate={};
  evs.filter(s=>s.st!=='can').forEach(s=>{
    const dk=s._isPostponed?s.pd:s.d;
    if(!byDate[dk]) byDate[dk]=[];
    byDate[dk].push(s);
  });
  const dates=Object.keys(byDate).sort();
  if(!dates.length) return '<div class="card" style="text-align:center;color:#999;padding:25px">אין פעילויות בחודש זה</div>';

  let h='<div class="card" style="padding:0;overflow:hidden">';
  dates.forEach(ds=>{
    const dayEvs=byDate[ds].sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
    const isToday=ds===tday;
    const hol=getHolidayInfo(ds);
    const blk=getBlockedInfo(ds);
    h+=`<div style="border-bottom:1px solid #e0e0e0">
      <div style="background:${isToday?'#1565c0':hol?hol.bg:blk?'#fce4ec':'#e8eaf6'};color:${isToday?'#fff':hol?hol.color:blk?'#c62828':'#283593'};padding:6px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="jumpToDay('${ds}')">
        <span style="font-weight:700;font-size:.82rem">📅 ${dayN(ds)} ${fD(ds)}</span>
        <span style="display:flex;gap:8px;align-items:center">
          ${hol?`<span style="font-size:.7rem">${hol.emoji} ${hol.name}</span>`:''}
          ${blk?`<span style="font-size:.7rem;cursor:pointer" onclick="event.stopPropagation();openBlockedDate('${ds}')">${blk.icon} ${blk.reason} ✏️</span>`:`<span style="font-size:.65rem;opacity:.4;cursor:pointer" onclick="event.stopPropagation();openBlockedDate('${ds}')" title="חסום תאריך">🚫</span>`}
          <span style="font-size:.72rem;opacity:.8">${dayEvs.length} פעילויות</span>
        </span>
      </div>`;
    h+='<div style="padding:4px 8px">';
    dayEvs.forEach(s=>{
      const g=G(s.g);
      const clr=CITY_COLORS(g.city);
      const stC=s.st==='nohap'?'#c62828':s.st==='post'?'#e65100':s.st==='done'?'#2e7d32':'#333';
      h+=`<div style="display:grid;grid-template-columns:130px 1fr auto auto;align-items:center;gap:6px;padding:4px 6px;border-radius:5px;margin-bottom:3px;background:${clr.light};border-right:3px solid ${clr.solid};cursor:pointer" onclick="openSP(${s.id})">
        <div>
          <div style="font-weight:700;font-size:.76rem;color:#1a237e">${g.name}</div>
          <div style="font-size:.67rem;color:#78909c">${g.city}</div>
        </div>
        <div>
          <div style="font-size:.76rem;font-weight:600;color:#1565c0">${supBase(s.a)}${s.act?' · <span style="color:#546e7a">'+s.act+'</span>':''}</div>
          ${s.nt?`<div style="font-size:.67rem;color:#78909c">📝 ${s.nt.slice(0,50)}${s.nt.length>50?'…':''}</div>`:''}
        </div>
        <div style="font-size:.72rem;color:#546e7a;text-align:center">${s.t?'⏰ '+fT(s.t):''}</div>
        <div style="font-size:.72rem;font-weight:700;color:${stC}">${stLabel(s).replace(/<[^>]+>/g,'')}</div>
      </div>`;
    });
    h+='</div></div>';
  });
  return h+'</div>';
}

function renderMonth(evs,mDate){
  const y=mDate.getFullYear(),m=mDate.getMonth(),tday=td();
  const fd=new Date(y,m,1),ld=new Date(y,m+1,0);
  const cnt={};evs.forEach(s=>{const dk=s._isPostponed?s.pd:s.d;if(!cnt[dk])cnt[dk]={t:0,c:0};cnt[dk].t++;if(s.st==='can')cnt[dk].c++;});
  let html='<div class="card"><div class="mgrid">';
  ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'].forEach(d=>html+=`<div class="mdh">${d}</div>`);
  for(let i=0;i<fd.getDay();i++) html+='<div class="md om"></div>';
  for(let d=1;d<=ld.getDate();d++){
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const c=cnt[ds];
    const hol=getHolidayInfo(ds);
    const blkM=getBlockedInfo(ds);
    const holStyle=hol?`background:${hol.bg};border-top:3px solid ${hol.border};`:(blkM?'background:#fce4ec;border-top:3px solid #e91e63;':'');
    html+=`<div class="md ${ds===tday?'tdy':''} ${c?'hev':''}" style="${holStyle}" onclick="jumpToDay('${ds}')">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="dnum" style="${blkM?'color:#c62828':''}">${d}</div>
        <span style="font-size:.55rem;opacity:${blkM?1:.25};cursor:pointer;color:${blkM?'#c62828':'#999'}" onclick="event.stopPropagation();openBlockedDate('${ds}')" title="${blkM?'ערוך חסימה':'חסום תאריך'}">${blkM?blkM.icon||'🚫':'🚫'}</span>
      </div>
      ${hol?`<div style="font-size:.65rem;color:${hol.color};font-weight:700">${hol.emoji} ${hol.name}</div>`:''}
      ${blkM?`<div style="font-size:.62rem;color:#c62828;font-weight:700">${blkM.reason}${blkM.note?' — '+blkM.note:''}</div>`:''}
      ${c?`<div class="mcnt">${c.t} פעילויות</div>`:''}
    </div>`;
  }
  const e=ld.getDay();for(let i=e+1;i<7;i++) html+='<div class="md om"></div>';
  return html+'</div></div>';
}

let _calTab='g'; // 'g'=גנים 's'=בתי ספר
function setCalTab(t){
  _calTab=t;
  document.getElementById('cal-tab-g').classList.toggle('active',t==='g');
  document.getElementById('cal-tab-s').classList.toggle('active',t==='s');
  // Sync the hidden cal-cls select so existing filter logic still works
  const clsSel=document.getElementById('cal-cls');
  if(clsSel) clsSel.value=t==='g'?'גנים':'ביה"ס';
  // Reset garden selectors when switching
  ['cal-g1','cal-g2','cal-g3'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value='';
  });
  calRefG();
}
let _dashTab='g'; // 'g'=גנים 's'=בתי ספר
function setDashTab(t){
  _dashTab=t;
  document.getElementById('dash-tab-g').classList.toggle('active',t==='g');
  document.getElementById('dash-tab-s').classList.toggle('active',t==='s');
  renderDash();
}
function renderDash(){
  const date=document.getElementById('dash-date').value||td();
  const city=document.getElementById('dash-city').value;
  const sup=document.getElementById('dash-sup').value;
  const st=document.getElementById('dash-st').value;
  const clsFilter=_dashTab==='g'?'גנים':'ביה"ס';
  const srch=(document.getElementById('dash-srch')||{value:''}).value.toLowerCase();
  const evs=SCH.filter(s=>{
    if(s.d!==date) return false;
    const g=G(s.g);
    if(gcls(g)!==clsFilter) return false;
    if(city&&g.city!==city) return false;
    if(sup&&supBase(s.a)!==sup&&s.a!==sup) return false;
    if(st&&s.st!==st) return false;
    if(srch&&![g.name,g.city,s.a,g.st,s.act].some(v=>(v||'')
      .toLowerCase().includes(srch))) return false;
    return true;
  }).sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
  const bySup={};
  evs.forEach(s=>{
    const g=G(s.g);
    if(!bySup[s.a]) bySup[s.a]={name:s.a,ph:s.p||'',evs:[]};
    bySup[s.a].evs.push({...s,gd:g});
    if(s.p&&!bySup[s.a].ph) bySup[s.a].ph=s.p;
  });

  if(!Object.keys(bySup).length){
    document.getElementById('dash-body').innerHTML='<p style="color:#999;font-size:.81rem">אין פעילויות ביום זה</p>';
  } else {
    let h='';
    Object.values(bySup).sort((a,b)=>a.name.localeCompare(b.name,'he')).forEach(supData=>{
      const byCity={};
      supData.evs.forEach(s=>{
        const c=s.gd.city||'אחר';
        if(!byCity[c]) byCity[c]=[];
        byCity[c].push(s);
      });
      h+=`<div class="card" style="margin-bottom:10px;padding:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-weight:800;color:#1a237e;font-size:.9rem">📚 ${supBase(supData.name)}</div>
          ${supAct(supData.name)?`<div style="font-size:.75rem;color:#1565c0;font-weight:600">🎯 ${supAct(supData.name)}</div>`:''}
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            ${supData.ph?`<span style="font-size:.75rem;color:#546e7a">📞 ${supData.ph}</span>`:''}
            <span class="bdg bb" style="font-size:.7rem">${supData.evs.length} גנים</span>
            <button class="btn bp bsm" style="font-size:.68rem;padding:2px 7px" onclick="openSupExport('${supData.name}')">📊 יצוא לאקסל</button>
          </div>
        </div>`;
      Object.keys(byCity).sort().forEach(c=>{
        const ce=byCity[c];
        h+=`<div style="margin-bottom:8px">
          <div class="dcity" style="margin-bottom:5px">🏙️ ${c} (${ce.length})</div>`;
        const usedIds=new Set();
        const rows=[]; // {type:'pair',pair,evs:[]} | {type:'solo',ev}
        pairs.forEach(pair=>{
          const pairEvs=ce.filter(s=>pair.ids.includes(s.g));
          if(!pairEvs.length) return;
          pairEvs.forEach(s=>usedIds.add(s.id));
          rows.push({type:'pair',pair,evs:pairEvs});
        });
        ce.filter(s=>!usedIds.has(s.id)).forEach(s=>rows.push({type:'solo',ev:s}));
        rows.sort((a,b)=>{
          const nameA=a.type==='pair'?a.pair.name:G(a.ev.g).name;
          const nameB=b.type==='pair'?b.pair.name:G(b.ev.g).name;
          return nameA.localeCompare(nameB,'he');
        });

        let _pairCards='',_soloCards='';
        rows.forEach(row=>{
          if(row.type==='pair'){
            const _dashClr=CITY_COLORS(G(row.pair.ids[0]).city);
            _pairCards+=renderPairCard(row.pair,row.evs,{ds:date,clr:_dashClr,showEdit:true,showExport:false});
          } else {
            const s=row.ev;
            const stc=s.st!=='ok'?'st-'+s.st:'';
            const _sc=CITY_COLORS(G(s.g).city);
            h+=`<div class="city-block" style="margin-bottom:7px">
              <div class="city-block-hdr" style="background:${_sc.solid};font-size:.76rem">
                🏫 ${s.gd.name}
                <span style="font-size:.67rem;opacity:.8;font-weight:400;margin-right:auto">📍 ${G(s.g).city}</span>
                <button onclick="event.stopPropagation();quickAddPartner(${s.g})"
                  style="background:rgba(255,255,255,.22);border:none;border-radius:4px;padding:1px 7px;cursor:pointer;font-size:.67rem;color:#fff">➕ הוסף בן זוג</button>
              </div>
              <div style="background:#fff;padding:7px">
                <div class="ev ${stc}" onclick="openSP(${s.id})" style="border-radius:5px;border:none;border-right:3px solid ${_sc.solid};background:${_sc.light};margin:0">
                  <span class="est">${stLabel(s)}</span>
                  <div class="eg">${s.gd.name}</div>
                  ${s.gd.st?`<div style="font-size:.67rem;color:#78909c">📍 ${s.gd.st}</div>`:''}
                  ${s.act?`<div style="font-size:.67rem;font-weight:600;color:${_sc.solid}">🎯 ${s.act}</div>`:''}
                  ${s.t?`<div class="et">⏰ ${fT(s.t)}</div>`:''}
                  ${s.grp>1?`<div style="font-size:.67rem;color:#546e7a">👥 ${s.grp}</div>`:''}
                </div>
              </div>
            </div>`;
          }
        });
        if(_pairCards) h+='<div class="pairs-4col">'+_pairCards+'</div>';
        h+='</div>';
      });
      h+='</div>';
    });
    document.getElementById('dash-body').innerHTML=h;
  }

  // Nohap list — all events that didn't happen, sorted by date desc
  const nohapEvs=SCH.filter(s=>s.st==='nohap').sort((a,b)=>b.d.localeCompare(a.d));
  // Can+post list — last 20
  const canEvs=SCH.filter(s=>s.st==='can'||s.st==='post').sort((a,b)=>b.d.localeCompare(a.d)).slice(0,20);
  const allEvs=[...nohapEvs,...canEvs].sort((a,b)=>b.d.localeCompare(a.d));

  let ch='';
  if(!allEvs.length) ch='<p style="color:#999;font-size:.79rem">אין ביטולים/דחיות</p>';
  else{
    ch='<div class="tw"><table><thead><tr><th>תאריך</th><th>עיר</th><th>גן</th><th>ספק</th><th>סטטוס</th><th>סיבה</th></tr></thead><tbody>';
    allEvs.forEach(s=>{
      const g=G(s.g);
      ch+=`<tr onclick="openSP(${s.id})" class="${stClass(s)}"><td>${fD(s.d)}</td><td>${g.city||''}</td><td>${g.name||''}</td><td>${s.a}</td><td>${stLabel(s)}</td><td>${s.cr||''}${s.cn?' ('+s.cn+')':''}</td></tr>`;
    });
    ch+='</tbody></table></div>';
  }
  document.getElementById('dash-can-body').innerHTML=ch;
}

function openSP(id){
  selEv=id;
  const s=SCH.find(x=>x.id===id);if(!s)return;
  const g=G(s.g);
  const isS=gcls(g)==='ביה"ס';
  let h=`<div style="background:#f5f7ff;border-radius:7px;padding:9px;margin-bottom:10px">
    <div class="ir"><span class="il">📅 תאריך:</span><span style="font-weight:700">${fD(s.d)} יום ${dayN(s.d)}</span></div>
    <div class="ir"><span class="il">🏫 גן:</span><span style="font-weight:700">${g.name}</span></div>
    <div class="ir"><span class="il">🏙️ עיר:</span><span>${g.city}</span></div>
    ${g.st?`<div class="ir"><span class="il">📍 כתובת:</span><span><a href="https://maps.google.com/?q=${encodeURIComponent(g.st+' '+g.city)}" target="_blank" style="color:#1565c0">${g.st}</a></span></div>`:''}
    ${s.t?`<div class="ir"><span class="il">⏰ שעה:</span><span style="font-weight:700;font-size:.9rem">${fT(s.t)}</span></div>`:''}
    <div class="ir"><span class="il">📚 ספק:</span><span style="font-weight:700">${supBase(s.a)}</span></div>
    ${supAct(s.a)?`<div class="ir"><span class="il">🎯 פעילות:</span><span style="color:#1565c0;font-weight:700">${supAct(s.a)}</span></div>`:''}
    ${s.p?`<div class="ir"><span class="il">📞 טלפון:</span><span>${s.p}</span></div>`:''}
    ${(s.act&&s.act!==supAct(s.a))?`<div class="ir"><span class="il">🎯 סוג פעילות:</span><span style="font-weight:700;color:#1565c0">${s.act}</span></div>`:''}
    ${isS&&s.grp>1?`<div class="ir"><span class="il">👥 קבוצות:</span><span>${s.grp}</span></div>`:''}
    ${s.st==='post'?`<div class="ir"><span class="il">⏩ נדחה ל:</span><span style="color:#e65100;font-weight:700">${fD(s.pd)} ${s.pt?fT(s.pt):''}</span></div>`:''}
    ${s._fromD?`<div class="ir"><span class="il">↩️ הועבר מ:</span><span style="color:#e65100;font-weight:700">${fD(s._fromD)}</span></div>`:''}
    <div class="ir"><span class="il">📌 סטטוס:</span><span>${stLabel(s)}</span></div>
  </div>`;
  const spPairForNt=gardenPair(s.g);
  h+=`<div style="margin-bottom:9px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
      <label style="font-size:.74rem;font-weight:700;color:#546e7a">📝 הערות לפעילות זו</label>
      <div style="display:flex;gap:8px;align-items:center">
        ${spPairForNt?`<label style="font-size:.7rem;display:flex;align-items:center;gap:3px;cursor:pointer;color:#e65100">
          <input type="checkbox" id="sp-nt-pair"> לכל הזוג
        </label>`:''}
        <label style="font-size:.7rem;display:flex;align-items:center;gap:3px;cursor:pointer;color:#1565c0" title="הערה שתישמר לכל הפעילויות הבאות של גן זה">
          <input type="checkbox" id="sp-nt-perm" ${s.ntPerm?'checked':''}> הערה קבועה
        </label>
      </div>
    </div>
    <textarea id="sp-nt" rows="2" style="width:100%;font-size:.8rem;border-radius:6px;border:1.5px solid ${s.ntPerm?'#1565c0':'#e0e0e0'};padding:5px">${s.nt||''}</textarea>
    ${s.ntPerm?'<div style="font-size:.67rem;color:#1565c0;margin-top:2px">📌 הערה קבועה — מוצגת בכל הפעילויות של גן זה</div>':''}
    <button class="btn bp bsm" style="width:100%;margin-top:5px" onclick="saveNt()">💾 שמור הערה</button>
  </div>`;
  const spPair=gardenPair(s.g);
  h+=`<div style="margin-bottom:10px">
    <div style="font-size:.8rem;font-weight:700;color:#1a237e;margin-bottom:6px">עדכון סטטוס:</div>
    ${spPair?`<div style="background:#fff3e0;border-radius:6px;padding:5px 9px;margin-bottom:7px;font-size:.75rem;display:flex;align-items:center;gap:8px">
      <span>🔗 ${spPair.name}</span>
      <label style="display:flex;align-items:center;gap:4px;cursor:pointer;margin-right:auto">
        <input type="checkbox" id="sp-pair-chk" style="accent-color:#e65100"> עדכן לכל הזוג
      </label>
    </div>`:''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
      <button class="btn bg bsm" onclick="setStatus('done')" ${s.st==='done'?'style="opacity:.5"':''}>✔️ התקיים</button>
      <button class="btn bo bsm" onclick="setStatus('ok')" ${s.st==='ok'?'style="opacity:.5"':''}>🔄 שחזר למתקיים</button>
    </div>
  </div>`;
  if(s.st!=='can')h+=`<div style="border:1.5px solid #ffcdd2;border-radius:7px;padding:8px;margin-bottom:8px">
    <div style="font-size:.8rem;font-weight:700;color:#c62828;margin-bottom:5px">❌ ביטול</div>
    <div class="copts">
      <div class="copt" onclick="selCO(this,'חג/חופשה')">🎉 חג/חופשה</div>
      <div class="copt" onclick="selCO(this,'מחלה')">🤒 מחלה</div>
      <div class="copt" onclick="selCO(this,'מזג אוויר')">🌧️ מזג אוויר</div>
      <div class="copt" onclick="selCO(this,'ביטול ספק')">🏢 ביטול ספק</div>
    </div>
    <input type="text" id="sp-cn" placeholder="הערה" style="width:100%;margin-bottom:5px">
    <button class="btn br bsm" style="width:100%" onclick="cancelEv()">❌ בטל</button>
  </div>`;
  h+=`<button class="btn borange bsm" style="width:100%;margin-bottom:7px" onclick="openPostpone(${s.id})">${s.st==='post'?'⏩ דחה שוב':'⏩ דחה לתאריך אחר'}</button>`;
  // Inline edit section — supplier, activity, time
  const spActs=getSupActs(s.a);
  const spAllSups=getAllSup();
  const spPairForEdit=gardenPair(s.g);
  h+=`<div style="border:1.5px solid #b3c6e7;border-radius:7px;padding:9px;margin-bottom:8px;background:#f8fbff">
    <div style="font-size:.8rem;font-weight:700;color:#1a237e;margin-bottom:7px">✏️ עריכת שיבוץ</div>
    <div style="display:grid;gap:6px">
      <div><label style="font-size:.72rem;color:#546e7a;font-weight:700">📚 ספק</label>
        <select id="sp-edit-sup" onchange="spEditSupChg()" style="width:100%;font-size:.8rem">
          ${spAllSups.map(s2=>`<option value="${s2.name}"${s2.name===s.a?' selected':''}>${s2.name}</option>`).join('')}
        </select>
      </div>
      <div><label style="font-size:.72rem;color:#546e7a;font-weight:700">🎯 סוג פעילות</label>
        <select id="sp-edit-act" onchange="spEditActChg()" style="width:100%;font-size:.8rem">
          <option value="">— ללא שינוי —</option>
          ${spActs.map(a=>`<option value="${a}"${a===s.act?' selected':''}>${a}</option>`).join('')}
          <option value="__new__">➕ פעילות חדשה...</option>
        </select>
      </div>
      <div id="sp-edit-act-new-wrap" style="display:none">
        <input type="text" id="sp-edit-act-new" placeholder="שם פעילות חדשה" style="width:100%;font-size:.8rem">
      </div>
      <div><label style="font-size:.72rem;color:#546e7a;font-weight:700">⏰ שעה</label>
        <input type="time" id="sp-edit-time" value="${s.t||''}" style="width:100%;font-size:.8rem">
      </div>
      ${spPairForEdit?`<label style="font-size:.75rem;display:flex;align-items:center;gap:6px;cursor:pointer;color:#e65100">
        <input type="checkbox" id="sp-edit-pair-chk"> עדכן לכל הזוג (${spPairForEdit.name})
      </label>`:''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px">
      <button class="btn bp bsm" onclick="spEditSave()">💾 שמור שינויים</button>
      <button class="btn bo bsm" onclick="openEditSched(${s.id})">🖊 עריכה מלאה</button>
    </div>
  </div>`;
  if(s.st==='nohap')h+=`<button class="btn bp bsm" style="width:100%;margin-bottom:7px" onclick="openMakeupSched(${s.id})">📅 שיבוץ השלמה לתאריך חדש</button>`;
  if(s.st!=='nohap')h+=`<div style="border:1.5px solid #f48fb1;border-radius:7px;padding:8px;margin-bottom:8px">
    <div style="font-size:.8rem;font-weight:700;color:#e91e63;margin-bottom:5px">⚠️ לא התקיים</div>
    <div class="copts">
      <div class="copt" onclick="selNO(this,'ספק לא הגיע')">🚫 מדריך לא הגיע</div>
      <div class="copt" onclick="selNO(this,'גן סגור')">🤒 מדריך חולה</div>
      <div class="copt" onclick="selNO(this,'אין ילדים')">👤 חסר מדריך</div>
      <div class="copt" onclick="selNO(this,'אחר')">📝 אחר</div>
    </div>
    <input type="text" id="sp-nn" placeholder="הסבר" style="width:100%;margin-bottom:5px">
    <button class="btn bpurple bsm" style="width:100%" onclick="markNoHap()">⚠️ סמן לא התקיים</button>
  </div>`;

  h+=`<button class="btn bp bsm" style="width:100%" onclick="saveNt()">💾 שמור הערה</button>`;
  document.getElementById('sp-body').innerHTML=h;
  document.getElementById('sp').classList.add('open');
}

function spEditSupChg(){
  const sup=document.getElementById('sp-edit-sup').value;
  const actSel=document.getElementById('sp-edit-act');
  const s=SCH.find(x=>x.id===selEv);
  const acts=getSupActs(sup);
  actSel.innerHTML='<option value="">— ללא שינוי —</option>'+
    acts.map(a=>`<option value="${a}"${s&&s.act===a?' selected':''}>${a}</option>`).join('')+
    '<option value="__new__">➕ פעילות חדשה...</option>';
}
function spEditActChg(){
  const v=document.getElementById('sp-edit-act').value;
  const wrap=document.getElementById('sp-edit-act-new-wrap');
  if(wrap) wrap.style.display=v==='__new__'?'block':'none';
}
function spEditSave(){
  const s=SCH.find(x=>x.id===selEv); if(!s) return;
  const newSup=document.getElementById('sp-edit-sup').value;
  const actVal=document.getElementById('sp-edit-act').value;
  const newAct=actVal==='__new__'
    ?(document.getElementById('sp-edit-act-new')||{}).value||''
    :actVal;
  const newTime=document.getElementById('sp-edit-time').value;
  const forPair=(document.getElementById('sp-edit-pair-chk')||{}).checked;
  const updates={};
  if(newSup&&newSup!==s.a) updates.a=newSup;
  if(newAct&&newAct!=='__new__') updates.act=newAct;
  if(newTime&&newTime!==s.t) updates.t=newTime;
  // Always include notes in update
  const newNt2=(document.getElementById('sp-nt')||{}).value;
  if(newNt2!==undefined) updates.nt=newNt2;
  if(!Object.keys(updates).filter(k=>k!=='nt').length&&updates.nt===s.nt){alert('לא בוצע שינוי');return;}
  const pair=gardenPair(s.g);
  if(forPair&&pair){
    SCH.filter(x=>pair.ids.includes(x.g)&&x.d===s.d&&x.id!==selEv)
      .forEach(x=>Object.assign(x,updates));
  }
  Object.assign(s,updates);
  save(); closeSP(); refresh();
  alert('✅ שינויים נשמרו!');
}
function selCO(el,r){document.querySelectorAll('.copt:not([onclick*=selNO])').forEach(o=>o.classList.remove('sel'));el.classList.add('sel');el.dataset.r=r;}
function selNO(el,r){document.querySelectorAll('.copt[onclick*=selNO]').forEach(o=>o.classList.remove('sel'));el.classList.add('sel');el.dataset.r=r;}
function cancelEv(){
  const sel=document.querySelector('.copt.sel');
  if(!sel||!sel.dataset.r||['ספק לא הגיע','גן סגור','אין ילדים','אחר'].includes(sel.dataset.r)){alert('בחר סיבת ביטול');return;}
  const pairChk=document.getElementById('sp-pair-chk');
  const cr=sel.dataset.r; const cn=document.getElementById('sp-cn').value;
  const fields={st:'can',cr,cn};
  if(pairChk&&pairChk.checked){
    const s=SCH.find(x=>x.id===selEv);
    const pair=s&&gardenPair(s.g);
    if(pair) SCH.filter(x=>pair.ids.includes(x.g)&&x.d===s.d&&x.id!==selEv)
      .forEach(x=>Object.assign(x,fields));
  }
  const main=SCH.find(x=>x.id===selEv);
  if(main) Object.assign(main,fields);
  save(); closeSP(); refresh();
}
function markNoHap(){
  const sel=document.querySelector('.copt.sel');
  const r=sel?sel.dataset.r:'';
  const note=document.getElementById('sp-nn').value;
  const pairChk=document.getElementById('sp-pair-chk');
  const fields={st:'nohap',cr:r||'לא התקיים',cn:note};
  if(pairChk&&pairChk.checked){
    const s=SCH.find(x=>x.id===selEv);
    const pair=s&&gardenPair(s.g);
    if(pair) SCH.filter(x=>pair.ids.includes(x.g)&&x.d===s.d&&x.id!==selEv)
      .forEach(x=>Object.assign(x,fields));
  }
  const main=SCH.find(x=>x.id===selEv);
  if(main) Object.assign(main,fields);
  save(); closeSP(); refresh();
}
function setStatus(st){
  const pairChk=document.getElementById('sp-pair-chk');
  const forPair=pairChk&&pairChk.checked;
  const fields={st,cr:st==='ok'?'':undefined,cn:st==='ok'?'':undefined};
  if(forPair){
    const s=SCH.find(x=>x.id===selEv); if(!s) return;
    const pair=gardenPair(s.g);
    if(pair){
      SCH.filter(x=>pair.ids.includes(x.g)&&x.d===s.d&&x.id!==selEv)
        .forEach(x=>Object.assign(x,fields));
    }
  }
  const main=SCH.find(x=>x.id===selEv);
  if(main) Object.assign(main,fields);
  save(); closeSP(); refresh();
}
function saveNt(){
  const s=SCH.find(x=>x.id===selEv); if(!s) return;
  const newNt=document.getElementById('sp-nt').value||'';
  const pairChk=document.getElementById('sp-nt-pair');  // use the NOTES pair checkbox
  const forPair=pairChk&&pairChk.checked;
  const isPermanent=(document.getElementById('sp-nt-perm')||{}).checked;
  // Save to main event
  s.nt=newNt;
  if(isPermanent) s.ntPerm=true; else delete s.ntPerm;
  // Save to pair if requested
  if(forPair){
    const pair=gardenPair(s.g);
    if(pair){
      SCH.filter(x=>pair.ids.map(id=>parseInt(id)).includes(parseInt(x.g))&&x.d===s.d&&x.id!==selEv)
        .forEach(x=>{ x.nt=newNt; if(isPermanent) x.ntPerm=true; else delete x.ntPerm; });
    }
  }
  save(); closeSP(); refresh();
}
function upd(id,fields){
  const i=SCH.findIndex(s=>s.id===id);
  if(i>=0) Object.assign(SCH[i],fields);
}
function updAndRefresh(id,fields){
  upd(id,fields);save(); closeSP(); refresh();
}
function closeSP(){
  document.getElementById('sp').classList.remove('open');
  selEv=null;
}
// Close SP when tapping overlay on mobile
document.addEventListener('DOMContentLoaded',()=>{
  const sp=document.getElementById('sp');
  if(!sp) return;
  // Add close button visible on mobile
  const closeBtn=document.createElement('button');
  closeBtn.innerHTML='✕ סגור';
  closeBtn.style.cssText='display:none;width:100%;padding:10px;margin-bottom:10px;background:#f5f5f5;border:none;border-radius:8px;font-size:.85rem;cursor:pointer';
  closeBtn.onclick=closeSP;
  closeBtn.id='sp-close-btn';
  sp.insertBefore(closeBtn,sp.firstChild);
  // Show close btn on mobile
  if(window.innerWidth<=768) closeBtn.style.display='block';
  window.addEventListener('resize',()=>{
    closeBtn.style.display=window.innerWidth<=768?'block':'none';
  });
});
function refresh(){
  // Single source of truth for all post-save re-rendering
  updCounts();
  renderDash();
  renderCal();
  const t=currentTab||'';
  if(t==='sched') renderSched();
  if(t==='sup') renderSup();
  if(t==='managers') renderManagers();
  if(t==='gardens') renderGardens();
  if(t==='pairs') renderPairs();
  if(t==='clusters') renderClusters();
  if(t==='holidays') renderHolidays();
  // Sync garden modal if open
  if(document.getElementById('gm')&&document.getElementById('gm').classList.contains('open')) renderGmCal();
}

// Unified save+close+refresh — call this after every data mutation
function saveAndRefresh(modalId){
  save();
  if(modalId) CM(modalId);
  if(modalId==='sp'||modalId===null) closeSP();
  refresh();
}

function qSetSt(id,st){
  const s=SCH.find(x=>x.id===id); if(!s) return;
  s.st=st; save(); refresh();
}

function openEditSched(id){
  const s=SCH.find(x=>x.id===id); if(!s) return;
  const g=G(s.g);
  selEv=id;
  (document.getElementById('es-info')||{}).textContent =g.name+' · '+fD(s.d);
  document.getElementById('es-sup').value=s.a||'';
  esSupChg();
  setTimeout(()=>{
    const atSel=document.getElementById('es-act');
    if(atSel&&s.act) atSel.value=s.act;
  },80);
  document.getElementById('es-time').value=s.t||'';
  document.getElementById('es-for-pair').checked=false;
  document.getElementById('es-pair-note').style.display='none';
  const pair=gardenPair(s.g);
  document.getElementById('es-pair-row').style.display=pair?'flex':'none';
  if(pair) (document.getElementById('es-pair-lbl')||{}).textContent =pair.name;
  document.getElementById('esm').classList.add('open');
}
function esSupChg(){
  const sup=document.getElementById('es-sup').value;
  const acts=getSupActs(sup);
  const atSel=document.getElementById('es-act');
  atSel.innerHTML='<option value="">-- אותו סוג פעילות --</option>'+
    acts.map(a=>`<option value='${a}'>${a}</option>`).join('')+
    '<option value="__new__">➕ חדש...</option>';
}
function saveEditSched(){
  const s=SCH.find(x=>x.id===selEv); if(!s) return;
  const newSup=document.getElementById('es-sup').value;
  const newAct=document.getElementById('es-act').value==='__new__'
    ?document.getElementById('es-act-new').value.trim()
    :document.getElementById('es-act').value;
  const newTime=document.getElementById('es-time').value;
  const forPair=document.getElementById('es-for-pair').checked;
  const updates={};
  if(newSup) updates.a=newSup;
  if(newAct&&newAct!=='__new__') updates.act=newAct;
  if(newTime) updates.t=newTime;
  if(forPair){
    const pair=gardenPair(s.g);
    if(pair) SCH.filter(x=>pair.ids.includes(x.g)&&x.d===s.d&&x.id!==selEv)
      .forEach(x=>upd(x.id,{...updates}));
  }
  upd(selEv,updates);
  save(); CM('esm'); closeSP(); refresh();
}
function openMakeupSched(origId){
  const orig=SCH.find(x=>x.id===origId); if(!orig) return;
  _makeupOrigId=origId;
  const d=new Date(s2d(orig.d)); d.setDate(d.getDate()+1);
  openNewSched(orig.g, {date:d2s(d), tab:'makeup', makeupFrom:orig.d});
  setTimeout(()=>{
    document.getElementById('ns-sup').value=orig.a||'';
    nsSupChg();
    if(orig.act){const atSel=document.getElementById('ns-act-type');if(atSel)atSel.value=orig.act;}
    document.getElementById('ns-notes').value='השלמה מ-'+fD(orig.d);
  },120);
}
let _makeupOrigId=null;
function openPostpone(id){
  selEvPost=id;
  const s=SCH.find(x=>x.id===id); if(!s) return;
  const g=G(s.g);
  document.getElementById('post-ev-info').innerHTML=
    `<b>${g.name}</b> · ${g.city} · <span style="color:#1565c0">${s.a}</span>${s.act?' · '+s.act:''}<br>
     תאריך מקורי: <b>${fD(s.d)} יום ${dayN(s.d)}</b> ${s.t?'⏰ '+fT(s.t):''}`;
  document.getElementById('post-date').value='';
  document.getElementById('post-time').value=s.t?fT(s.t):'';
  document.getElementById('post-reason').value='';
  document.getElementById('post-conflict-warn').style.display='none';
  // Populate supplier dropdown
  const postSupEl=document.getElementById('post-sup');
  if(postSupEl){
    postSupEl.innerHTML='<option value="">— אותו ספק —</option>';
    getAllSup().forEach(sup=>postSupEl.innerHTML+=`<option value="${sup.name}"${sup.name===s.a?' selected':''}>${sup.name}</option>`);
    postSupChg();
  }
  postShowFreeDays(s);
  // Show partner checkbox if garden is in a pair
  const postPair=gardenPair(s.g);
  const pairWrap=document.getElementById('post-pair-wrap');
  if(postPair&&pairWrap){
    const partnerIds=postPair.ids.filter(id=>id!==s.g);
    const partnerNames=partnerIds.map(id=>G(id).name).filter(Boolean).join(', ');
    (document.getElementById('post-pair-name')||{}).textContent =partnerNames;
    pairWrap.style.display='block';
    document.getElementById('post-pair-chk').checked=true; // default: postpone partner too
  } else if(pairWrap){
    pairWrap.style.display='none';
  }
  document.getElementById('postm').classList.add('open');
}

function postSupChg(){
  const supEl=document.getElementById('post-sup');
  const actEl=document.getElementById('post-act');
  if(!supEl||!actEl) return;
  const supName=supEl.value;
  const s=SCH.find(x=>x.id===selEvPost);
  const srcName=supName||( s?s.a:'');
  const acts=getSupActs(srcName);
  actEl.innerHTML='<option value="">— אותה פעילות —</option>'+
    acts.map(a=>`<option value="${a}"${s&&s.act===a?' selected':''}>${a}</option>`).join('');
}
function postShowFreeDays(s){
  const gid=s.g;
  const g=G(gid);
  const fromD=s2d(s.d);fromD.setDate(fromD.getDate()+1);
  const DAY_HEB=['ראשון','שני','שלישי','רביעי','חמישי'];
  const busyDates=new Set(SCH.filter(x=>x.g===gid&&x.st!=='can').map(x=>x.d));
  const free=[]; let d=new Date(fromD);
  for(let i=0;i<21;i++){
    const dow=d.getDay();
    if(dow>=0&&dow<=4){ // sun-thu (0=sun,4=thu) skip fri(5)+sat(6)
      const ds=d2s(d);
      const hol=getHolidayInfo(ds,g.city,gcls(g));
      if(!busyDates.has(ds)&&!hol){
        free.push({ds,lbl:DAY_HEB[dow]+' '+fD(ds)});
      }
    }
    d.setDate(d.getDate()+1);
  }
  const wrap=document.getElementById('post-free-wrap');
  const fd=document.getElementById('post-free-days');
  if(free.length){
    fd.innerHTML='<div style="font-size:.74rem;font-weight:700;color:#2e7d32;margin-bottom:5px">ימים פנויים (אין פעילות) — לחץ לבחירה:</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:4px">'+
      free.map(f=>`<button class="btn bg bsm" style="font-size:.72rem;padding:3px 9px" onclick="postPickFree('${f.ds}')">${f.lbl}</button>`).join('')+
      '</div>'+
      '<div style="font-size:.71rem;color:#546e7a;margin-top:5px">* שישי ושבת אינם מוצגים</div>';
    wrap.style.display='block';
  } else {
    fd.innerHTML='<div style="color:#e65100;font-size:.75rem">אין ימים פנויים ב-21 יום הקרובים</div>';
    wrap.style.display='block';
  }
}
function postPickFree(ds){
  document.getElementById('post-date').value=ds;
  postDateChg();
}
function postDateChg(){
  const nd=document.getElementById('post-date').value;
  if(!nd){document.getElementById('post-conflict-warn').style.display='none';return;}
  const s=SCH.find(x=>x.id===selEvPost);
  if(!s) return;
  const conflict=SCH.some(x=>x.g===s.g&&x.d===nd&&x.id!==s.id&&x.st!=='can');
  // Also check partner conflict
  const pairChk=document.getElementById('post-pair-chk');
  let partnerConflict=false;
  if(pairChk&&pairChk.checked){
    const pair=gardenPair(s.g);
    if(pair){
      const partnerIds=pair.ids.filter(id=>id!==s.g);
      partnerConflict=partnerIds.some(pid=>SCH.some(x=>x.g===pid&&x.d===nd&&x.st!=='can'));
    }
  }
  const warnEl=document.getElementById('post-conflict-warn');
  warnEl.style.display=(conflict||partnerConflict)?'block':'none';
  if(partnerConflict&&!conflict) warnEl.textContent='⚠️ לגן הבן זוג כבר קיימת פעילות בתאריך שנבחר!';
  else warnEl.textContent='⚠️ לגן זה כבר קיימת פעילות בתאריך שנבחר!';
}
function doPostpone(){
  const nd=document.getElementById('post-date').value;
  if(!nd){alert('יש לבחור תאריך חדש');return;}
  const dow=s2d(nd).getDay();
  if(dow===6||dow===0){alert('לא ניתן לשבץ בשישי או שבת');return;}
  const nt=document.getElementById('post-time').value;
  const nr=document.getElementById('post-reason').value;
  const postSupEl=document.getElementById('post-sup');
  const postActEl=document.getElementById('post-act');
  const newSup=postSupEl&&postSupEl.value?postSupEl.value:null;
  const newAct=postActEl&&postActEl.value?postActEl.value:null;
  const postponeOne=(srcId,isPartner)=>{
    const idx=SCH.findIndex(s=>s.id===srcId);
    if(idx<0) return;
    const orig=SCH[idx];
    const origDate=orig.d;
    // Mark original as postponed
    Object.assign(SCH[idx],{st:'post',cr:nr||'נדחה',pd:nd,pt:nt||orig.t});
    // New entry on new date — note says "from [orig date]"
    const newEntry={...orig,id:Date.now()+(isPartner?1:0),d:nd,
      t:nt||orig.t,st:'ok',cr:'',pd:'',pt:'',
      _fromD:origDate,
      nt:'(הועבר מ-'+fD(origDate)+')'};
    if(!isPartner&&newSup) newEntry.a=newSup;
    if(!isPartner&&newAct) newEntry.act=newAct;
    SCH.push(newEntry);
  };
  const orig=SCH.find(s=>s.id===selEvPost);
  if(orig){
    postponeOne(selEvPost,false);
    // Also postpone partner if checkbox checked
    const pairChk=document.getElementById('post-pair-chk');
    if(pairChk&&pairChk.checked){
      const pair=gardenPair(orig.g);
      if(pair){
        const partnerIds=pair.ids.filter(id=>id!==orig.g);
        partnerIds.forEach(pid=>{
          // Find partner's event on the same date
          const partnerEv=SCH.find(s=>s.g===pid&&s.d===orig.d&&s.st!=='can');
          if(partnerEv) postponeOne(partnerEv.id,true);
        });
      }
    }
  }
  save();CM('postm');closeSP();refresh();
}

let _nsmTab='once'; // 'once'|'recur'|'makeup'

function nsSetTab(tab){
  _nsmTab=tab;
  ['once','recur','makeup'].forEach(t=>{
    const btn=document.getElementById('ns-tab-'+t);
    const wrap=document.getElementById('ns-'+t+'-wrap');
    if(btn){
      btn.style.background=t===tab?'#1a237e':'transparent';
      btn.style.color=t===tab?'#fff':'#1a237e';
      btn.style.borderRadius='6px';
    }
    if(wrap) wrap.style.display=t===tab?'block':'none';
  });
  // Once-wrap contains shared ns-date/ns-time — show for both once and makeup
  const onceWrap=document.getElementById('ns-once-wrap');
  if(onceWrap) onceWrap.style.display=(tab==='once'||tab==='makeup')?'block':'none';
  // Update title
  const titles={once:'📅 שיבוץ חדש',recur:'🔁 שיבוץ קבוע',makeup:'↩️ שיבוץ השלמה'};
  (document.getElementById('nsm-title')||{}).textContent=titles[tab]||'➕ שיבוץ חדש';
}

function nsGChg(){
  const gid=parseInt(document.getElementById('ns-g').value)||null;
  nsCheckPair(gid);
}

function openNewSched(gid, opts={}){
  // opts: {date, tab, makeupFrom}
  newSchedForGarden=gid||null;
  _nsmTab='once';
  (document.getElementById('nsm-title')||{}).textContent='➕ שיבוץ חדש';

  // Reset all fields
  const ns_date=document.getElementById('ns-date');
  if(ns_date) ns_date.value=opts.date||d2s(calD);
  document.getElementById('ns-time').value='';
  document.getElementById('ns-ph').value='';
  document.getElementById('ns-notes').value='';
  document.getElementById('ns-grp').value='1';
  const atSel=document.getElementById('ns-act-type');
  if(atSel){atSel.innerHTML='<option value="">בחר סוג פעילות...</option>';atSel.value='';}
  const atNew=document.getElementById('ns-act-type-new');
  if(atNew){atNew.style.display='none';atNew.value='';}
  document.getElementById('ns-warn').style.display='none';

  // Recur fields
  const today=td();
  const recurFrom=document.getElementById('ns-recur-from');
  const recurTo=document.getElementById('ns-recur-to');
  if(recurFrom) recurFrom.value=opts.date||today;
  if(recurTo){
    // Default end: end of current school year
    const y=new Date().getFullYear();
    const m=new Date().getMonth();
    recurTo.value=`${m>=8?y+1:y}-06-30`;
  }
  document.querySelectorAll('.ns-day-chk').forEach(c=>c.checked=false);
  // Pre-check day of selected date
  if(opts.date){
    const dObj=new Date(opts.date.replace(/-/g,'/'));
    const dayChk=document.querySelector(`.ns-day-chk[value="${dObj.getDay()}"]`);
    if(dayChk) dayChk.checked=true;
  }
  document.getElementById('ns-recur-preview').textContent='';

  // Makeup
  const makeupOrig=document.getElementById('ns-makeup-orig');
  if(makeupOrig) makeupOrig.value=opts.makeupFrom||'';

  // City/garden dropdowns
  const cityEl=document.getElementById('ns-city');
  cityEl.innerHTML='<option value="">בחר עיר</option>';
  cities().forEach(c=>cityEl.innerHTML+=`<option value='${c}'>${c}</option>`);

  if(gid){
    const g=G(gid);
    cityEl.value=g.city||'';
    nsRefG();
    setTimeout(()=>{
      document.getElementById('ns-g').value=gid;
      nsCheckPair(gid);
    },50);
  } else {
    document.getElementById('ns-g').innerHTML='<option value="">בחר עיר תחילה</option>';
    document.getElementById('ns-g2-wrap').style.display='none';
    document.getElementById('ns-grp-wrap').style.display='none';
  }

  // Set tab
  nsSetTab(opts.tab||'once');

  // ns-sup is populated globally on load

  document.getElementById('nsm').classList.add('open');
}

function nsPreviewRecur(){
  const from=document.getElementById('ns-recur-from').value;
  const to=document.getElementById('ns-recur-to').value;
  const days=[...document.querySelectorAll('.ns-day-chk:checked')].map(c=>parseInt(c.value));
  if(!from||!to||!days.length){
    document.getElementById('ns-recur-preview').textContent='';
    return;
  }
  let count=0, cur=new Date(from.replace(/-/g,'/'));
  const end=new Date(to.replace(/-/g,'/'));
  while(cur<=end&&count<200){
    if(days.includes(cur.getDay())) count++;
    cur.setDate(cur.getDate()+1);
  }
  const dn=['ראשון','שני','שלישי','רביעי','חמישי'];
  const dayNames=days.map(d=>dn[d]).join(', ');
  document.getElementById('ns-recur-preview').textContent=`📅 יימצאו ${count} פעילויות (ימים: ${dayNames}, ${fD(from)}–${fD(to)})`;
}
function nsRefG(){
  const city=document.getElementById('ns-city').value;
  const gs=gByCF(city,'').sort((a,b)=>a.name.localeCompare(b.name,'he'));
  const sel=document.getElementById('ns-g');
  sel.innerHTML='<option value="">בחר גן</option>';
  gs.forEach(g=>sel.innerHTML+=`<option value="${g.id}">${g.name}</option>`);
  document.getElementById('ns-g2-wrap').style.display='none';
  document.getElementById('ns-grp-wrap').style.display='none';
  sel.onchange=function(){nsCheckPair(parseInt(this.value)||null);};
}
function nsCheckPair(gid){
  if(!gid) return;
  const g=G(gid);
  const isS=gcls(g)==='ביה"ס';
  document.getElementById('ns-grp-wrap').style.display='block';
  const pair=gardenPair(gid);
  const w2=document.getElementById('ns-g2-wrap');
  if(pair&&pair.ids.length>=2){
    const partnerId=pair.ids.find(id=>id!==gid);
    if(partnerId){
      const partG=G(partnerId);
      w2.style.display='block';
      w2.querySelector('label').textContent=`גן בן זוג: ${partG.name}?`;
      document.getElementById('ns-g2').innerHTML=`<option value="">לא - רק ל${g.name}</option><option value="${partnerId}" selected>כן - גם ל${partG.name}</option>`;
    }
  } else w2.style.display='none';
}
function nsSupChg(){
  const sup=document.getElementById('ns-sup').value;
  if(!sup) return;
  const ex=supEx[sup]||{};
  const ph=ex.ph1||(SUPBASE.find(s=>s.name===sup)||{}).phone||'';
  document.getElementById('ns-ph').value=ph;
  document.getElementById('ns-grp-wrap').style.display='block';
  const actSel=document.getElementById('ns-act-type');
  if(!actSel) return;
  const acts=getSupActs(sup);
  actSel.innerHTML='<option value="">בחר סוג פעילות...</option>'+
    acts.map(a=>`<option value='${a}'>${a}</option>`).join('')+
    '<option value="__new__">➕ הוסף פעילות חדשה...</option>';
}
function nsActTypeChg(){
  const v=document.getElementById('ns-act-type').value;
  const newInp=document.getElementById('ns-act-type-new');
  if(newInp) newInp.style.display=v==='__new__'?'inline-block':'none';
}
function saveNewSched(){
  const gid=parseInt(document.getElementById('ns-g').value)||null;
  const g2id=parseInt(document.getElementById('ns-g2').value)||null;
  const date=document.getElementById('ns-date').value;
  const time=document.getElementById('ns-time').value;
  const sup=document.getElementById('ns-sup').value;
  if(date&&gid){
    const _g=G(gid);
    const _hol=getHolidayInfo(date,_g.city||null,gcls(_g)||null);
    if(_hol&&(_hol.type==='noact'||_hol.type==='vacation'||_hol.type==='camp')){
      if(!confirm('⚠️ יש '+_hol.emoji+' '+_hol.name+' ביום זה.\nבכל זאת לשבץ?')) return;
    }
  }
  const ph=document.getElementById('ns-ph').value;
  const notes=document.getElementById('ns-notes').value;
  const grp=parseInt(document.getElementById('ns-grp').value)||1;
  let actType=document.getElementById('ns-act-type').value;
  if(actType==='__new__'){actType=document.getElementById('ns-act-type-new').value.trim();}
  if(actType&&actType!=='__new__'){
    if(!supEx[sup]) supEx[sup]={};
    if(!Array.isArray(supEx[sup].acts)) supEx[sup].acts=getSupActs(sup);
    if(!supEx[sup].acts.includes(actType)) supEx[sup].acts.push(actType);
  }
  if(!gid||!date||!sup){alert('יש למלא: גן, תאריך, ספק');return;}
  const g=G(gid);
  if(gcls(g)==='גנים'&&time){
    const h=parseInt(time.split(':')[0]);
    const period=h<13?'morning':'afternoon';
    const conflict=SCH.find(s=>s.g===gid&&s.d===date&&s.st!=='can'&&s.t&&(parseInt(s.t.split(':')[0])<13?'morning':'afternoon')===period&&s.id!==undefined);
    if(conflict){
      document.getElementById('ns-warn').style.display='block';
      (document.getElementById('ns-warn')||{}).textContent =`⚠️ כבר קיימת פעילות ב${period==='morning'?'בוקר':'אחה"צ'}: ${conflict.a} ב-${fT(conflict.t)}`;
      return;
    }
  }
  const newId=Date.now();

  if(_nsmTab==='recur'){
    // Recurring schedule — generate all matching dates
    const recurFrom=document.getElementById('ns-recur-from').value;
    const recurTo=document.getElementById('ns-recur-to').value;
    const selDays=[...document.querySelectorAll('.ns-day-chk:checked')].map(c=>parseInt(c.value));
    const recurTime=document.getElementById('ns-recur-time').value||time;
    if(!recurFrom||!recurTo||!selDays.length){alert('שיבוץ קבוע: יש לבחור תאריך התחלה, סיום, וימים');return;}
    let count=0, cur=new Date(recurFrom.replace(/-/g,'/'));
    const endD=new Date(recurTo.replace(/-/g,'/'));
    const recurring_id=Date.now();
    while(cur<=endD&&count<365){
      if(selDays.includes(cur.getDay())){
        const ds=d2s(cur);
        const _hol2=getHolidayInfo(ds,G(gid).city||null,gcls(G(gid))||null);
        if(!_hol2||_hol2.type==='info'){
          const eid=recurring_id+count;
          const ev={id:eid,g:gid,d:ds,a:sup,act:actType,t:recurTime,p:ph,n:notes,st:'ok',cr:'',cn:'',nt:notes,pd:'',pt:'',grp,_recId:recurring_id};
          SCH.push(ev);
          if(g2id) SCH.push({...ev,id:eid+1000,g:g2id});
          count++;
        }
      }
      cur.setDate(cur.getDate()+1);
    }
    saveAndRefresh('nsm');
    showToast(`✅ נוצרו ${count} פעילויות קבועות`);
    return;
  }

  if(_nsmTab==='makeup'){
    // Makeup schedule
    const makeupOrig=document.getElementById('ns-makeup-orig').value;
    const newSched={id:newId,g:gid,d:date,a:sup,act:actType,t:time,p:ph,n:notes,st:'ok',cr:'',cn:'',nt:notes?notes:'השלמה'+(makeupOrig?' מ-'+fD(makeupOrig):''),pd:'',pt:'',grp,_makeupFrom:makeupOrig||''};
    SCH.push(newSched);
    if(g2id) SCH.push({...newSched,id:newId+1,g:g2id});
    saveAndRefresh('nsm');
    showToast('✅ שיבוץ השלמה נשמר');
    return;
  }

  // One-time
  const newSched={id:newId,g:gid,d:date,a:sup,act:actType,t:time,p:ph,n:notes,st:'ok',cr:'',cn:'',nt:notes,pd:'',pt:'',grp};
  SCH.push(newSched);
  if(g2id){
    SCH.push({...newSched,id:newId+1,g:g2id,nt:notes});
  }
  saveAndRefresh('nsm');
  showToast('✅ שיבוץ נשמר');
}

function sRefG(){
  const city=document.getElementById('s-city').value;
  const cls=document.getElementById('s-cls').value;
  const gs=gByCF(city,cls).sort((a,b)=>a.name.localeCompare(b.name,'he'));
  ['s-g1','s-g2','s-g3'].forEach((id,i)=>{
    const sel=document.getElementById(id);
    sel.innerHTML=i===0?'<option value="">כל הגנים</option>':'<option value="">—</option>';
    gs.forEach(g=>sel.innerHTML+=`<option value="${g.id}">${city?g.name:g.city+' · '+g.name}</option>`);
  });
  sPage=1;renderSched();
}
function getFiltSched(){
  const city=document.getElementById('s-city').value;
  const cls=document.getElementById('s-cls').value;
  const g1=parseInt(document.getElementById('s-g1').value)||null;
  const g2=parseInt(document.getElementById('s-g2').value)||null;
  const g3=parseInt(document.getElementById('s-g3').value)||null;
  const sup=document.getElementById('s-sup').value;
  const th=document.getElementById('s-th').value;
  const tt=document.getElementById('s-tt').value;
  const from=document.getElementById('s-from').value;
  const to=document.getElementById('s-to').value;
  const st=document.getElementById('s-st').value;
  const srch=document.getElementById('s-srch').value.toLowerCase();
  const gids=[g1,g2,g3].filter(Boolean);
  return SCH.filter(s=>{
    const g=G(s.g);
    if(city&&g.city!==city) return false;
    if(cls&&gcls(g)!==cls) return false;
    if(gids.length&&!gids.includes(s.g)) return false;
    if(sup&&supBase(s.a)!==sup&&s.a!==sup) return false;
    if(th&&s.t&&s.t<th) return false;
    if(tt&&s.t&&s.t>tt) return false;
    if(from&&s.d<from) return false;
    if(to&&s.d>to) return false;
    if(st&&s.st!==st) return false;
    if(srch&&![(g.name||''),(g.city||''),(s.a||''),(s.nt||'')].some(x=>x.toLowerCase().includes(srch))) return false;
    return true;
  }).sort((a,b)=>a.d.localeCompare(b.d)||(a.t||'').localeCompare(b.t||''));
}
function renderSched(){
  const all=getFiltSched();
  const hasFilter=['s-city','s-cls','s-sup','s-th','s-tt','s-from','s-to','s-st','s-srch'].some(id=>{const el=document.getElementById(id);return el&&el.value;});
  const todayDate=document.getElementById('s-from').value||document.getElementById('s-to').value;
  const pages=Math.ceil(all.length/PG);
  if(sPage>pages&&pages>0) sPage=1;
  const data=all.slice((sPage-1)*PG,sPage*PG);
  (document.getElementById('s-info')||{}).textContent =`מציג ${data.length} מתוך ${all.length.toLocaleString()} פעילויות`;
  const byDate={};
  data.forEach(s=>{
    const dk=s._isPostponed?s.pd:s.d;
    if(!byDate[dk]) byDate[dk]={};
    const g=G(s.g);
    const c=g.city||'אחר';
    const cl=gcls(g);
    if(!byDate[dk][c]) byDate[dk][c]={gan:[],sch:[]};
    if(cl==='ביה"ס') byDate[dk][c].sch.push({...s,gd:g});
    else byDate[dk][c].gan.push({...s,gd:g});
  });

  let h='';
  Object.keys(byDate).sort().forEach(dateKey=>{
    h+=`<div style="font-weight:800;color:#1a237e;font-size:.83rem;padding:6px 10px;background:#e8eaf6;border-radius:6px;margin-bottom:6px;margin-top:10px">
      📅 ${fD(dateKey)} יום ${dayN(dateKey)}
    </div>`;
    Object.keys(byDate[dateKey]).sort().forEach(city=>{
      const cityData=byDate[dateKey][city];
      h+=`<div style="margin-bottom:8px">
        <div style="font-size:.75rem;font-weight:700;color:#546e7a;padding:3px 8px;background:#eceff1;border-radius:4px;margin-bottom:4px">🏙️ ${city}</div>`;
      [{arr:cityData.gan,lbl:'🏫 גנים',cls:'gan'},{arr:cityData.sch,lbl:'🏛️ בתי ספר',cls:'sch'}].forEach(sec=>{
        if(!sec.arr.length) return;
        h+=`<div class="dsh ${sec.cls}" style="font-size:.7rem;margin-bottom:3px">${sec.lbl}</div>
          <div class="tw"><table style="margin-bottom:6px"><thead><tr>
            <th>גן</th><th>ספק</th><th>שעה</th><th>קב'</th><th>סטטוס</th><th>הערות</th>
          </tr></thead><tbody>`;
        sec.arr.sort((a,b)=>{
          // Sort by pair name first, then time — matches calendar order
          const pA=gardenPair(a.g),pB=gardenPair(b.g);
          const pnA=pA?pA.name:G(a.g).name;
          const pnB=pB?pB.name:G(b.g).name;
          return pnA.localeCompare(pnB,'he')||(a.t||'99:99').localeCompare(b.t||'99:99');
        }).forEach(s=>{
          h+=`<tr onclick="openSP(${s.id})" class="${stClass(s)}">
            <td><div style="font-weight:700">${s.gd.name}</div>${s.gd.st?`<div style="font-size:.68rem;color:#78909c">${s.gd.st}</div>`:''}</td>
            <td><div style="font-weight:700">${supBase(s.a)}</div>${supAct(s.a)?`<div style="font-size:.7rem;color:#1565c0">🎯 ${supAct(s.a)}</div>`:''}<span style="font-size:.68rem;color:#78909c">${s.p||''}</span></td>
            <td>${fT(s.t)}</td>
            <td>${s.grp>1?s.grp:''}</td>
            <td>${stLabel(s)}</td>
            <td style="max-width:90px;font-size:.72rem">${s.nt||''}</td>
          </tr>`;
        });
        h+='</tbody></table></div>';
      });
      h+='</div>';
    });
  });
  if(!h) h='<p style="color:#999;text-align:center;padding:20px">אין פעילויות</p>';
  document.getElementById('s-body').innerHTML=h;
  let pg='';
  if(pages>1){
    const st=Math.max(1,sPage-3),en=Math.min(pages,sPage+3);
    if(st>1) pg+=`<button class="pgbtn" onclick="goPg(1)">1</button>`;
    if(st>2) pg+='<span>…</span>';
    for(let p=st;p<=en;p++) pg+=`<button class="pgbtn ${p===sPage?'active':''}" onclick="goPg(${p})">${p}</button>`;
    if(en<pages-1) pg+='<span>…</span>';
    if(en<pages) pg+=`<button class="pgbtn" onclick="goPg(${pages})">${pages}</button>`;
  }
  document.getElementById('s-pag').innerHTML=pg;
}
function goPg(p){sPage=p;renderSched();}
function clearSched(){
  ['s-city','s-cls','s-sup','s-th','s-tt','s-from','s-to','s-st','s-srch'].forEach(id=>document.getElementById(id).value='');
  sRefG();
}

function renderGardens(){
  // Sync g-cls from active tab if not overridden
  const gClsEl=document.getElementById('g-cls');
  if(gClsEl&&!gClsEl.value) gClsEl.value=_gardensTab==='sch'?'ביה"ס':'גנים';
  const city=document.getElementById('g-city').value;
  const cls=document.getElementById('g-cls').value;
  const cl=document.getElementById('g-cl').value;
  const srch=document.getElementById('g-srch').value.toLowerCase();
  const mgrF=(document.getElementById('g-mgr')||{}).value||'';
  const f=[...GARDENS,..._GARDENS_EXTRA].filter(g=>{
    if(city&&g.city!==city) return false;
    if(cls&&gcls(g)!==cls) return false;
    if(cl){const clObj=getClusters().find(c=>c.name===cl);if(!clObj||(!(clObj.gardenIds||[]).includes(g.id))) return false;}
    if(mgrF){const m=managers[mgrF];if(!m||(!(m.gardenIds||[]).includes(g.id))) return false;}
    if(srch&&![(g.name||''),(g.city||''),(g.st||''),(g.co||'')].some(x=>x.toLowerCase().includes(srch))) return false;
    return true;
  }).sort((a,b)=>a.name.localeCompare(b.name,'he'));
  (document.getElementById('g-info')||{}).textContent =`${f.length} ${cls==='ביה"ס'?'בתי ספר':'צהרונים/גנים'}`;
  const byCity={};
  f.forEach(g=>{
    const c=g.city||'אחר';
    if(!byCity[c]) byCity[c]={gan:[],sch:[]};
    if(gcls(g)==='ביה"ס') byCity[c].sch.push(g);
    else byCity[c].gan.push(g);
  });

  let h='';
  Object.keys(byCity).sort().forEach(cityKey=>{
    h+=`<div style="margin-bottom:16px">
      <div style="font-weight:800;color:#1a237e;font-size:.85rem;padding:6px 10px;background:#e8eaf6;border-radius:6px;margin-bottom:8px">🏙️ ${cityKey}</div>`;
    [{arr:byCity[cityKey].gan,lbl:'🏫 גני ילדים',cls:'gan'},{arr:byCity[cityKey].sch,lbl:'🏛️ בתי ספר',cls:'sch'}].forEach(sec=>{
      if(!sec.arr.length) return;
      h+=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;margin-top:${sec.cls==='sch'?'14px':'0'}"><div style="height:2px;flex:1;background:${sec.cls==='sch'?'#1565c0':'#2e7d32'};opacity:.25"></div><span class="dsh ${sec.cls}" style="font-size:.76rem;font-weight:800;padding:3px 12px;border-radius:10px">${sec.lbl} (${sec.arr.length})</span><div style="height:2px;flex:1;background:${sec.cls==='sch'?'#1565c0':'#2e7d32'};opacity:.25"></div></div>
        <div class="evgrid" style="margin-bottom:8px">`;
      sec.arr.forEach(g=>{
        const cnt=SCH.filter(s=>s.g===g.id).length;
        const pair=gardenPair(g.id);
        const mgr=getGardenMgr(g.id);
        const gd=getGardenData(g.id);
        h+=`<div class="gc" onclick="openGM(${g.id})">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div style="font-weight:700;color:#1a237e;margin-bottom:3px;flex:1">${gd.name||g.name}</div>
            <button onclick="event.stopPropagation();openGardenEdit(${g.id})" style="background:none;border:none;cursor:pointer;font-size:.7rem;color:#90a4ae;padding:0 2px" title="ערוך כרטיס גן">✏️</button>
          </div>
          ${(gd.st||g.st)?`<div style="font-size:.73rem;color:#666" onclick="event.stopPropagation()">📍 <a href="https://maps.google.com/?q=${encodeURIComponent((gd.st||g.st)+' '+g.city)}" target="_blank" style="color:#1565c0;text-decoration:underline">${gd.st||g.st}</a></div>`:''}
          ${gd.phone?`<div style="font-size:.72rem;color:#2e7d32;font-weight:600">📞 ${gd.phone}</div>`:''}
          ${mgr?`<div style="font-size:.7rem;color:#1565c0;border-top:1px solid #e8eaf6;margin-top:4px;padding-top:3px">${mgr.role==='manager'?'🏛️':'👤'} ${mgr.name}${mgr.phone?' · 📞 '+mgr.phone:''}</div>`:''}
          ${gardenClusters(g.id).length?`<div style="font-size:.71rem;color:#6a1b9a">🔢 ${gardenClusters(g.id).map(c=>c.name).join(', ')}</div>`:''}
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:5px">
            ${pair
              ?`<span style="font-size:.7rem;color:#2e7d32;font-weight:700">🔗 ${pair.name}</span>`
              :`<button class="btn bg bsm" style="font-size:.63rem;padding:1px 6px" onclick="event.stopPropagation();quickAddPartner(${g.id})">➕ בן זוג</button>`
            }
            <span style="font-size:.7rem;color:#1565c0">📅 ${cnt}</span>
          </div>
        </div>`;
      });
      h+='</div>';
    });
    h+='</div>';
  });
  document.getElementById('g-body').innerHTML=h||'<p style="color:#999">לא נמצאו גנים</p>';
}

function openGM(gid){
  gmGid=gid;gmV='week';gmD=new Date();
  const g=GARDENS.find(x=>x.id===gid)||{};
  (document.getElementById('gm-title')||{}).textContent =`${g.city} · ${g.name}`;
  document.getElementById('gm-det').innerHTML=[g.st?`🏠 ${g.st}`:'',g.co?`👤 ${g.co}`:'',gardenClusters(gid).length?`🔢 ${gardenClusters(gid).map(c=>c.name).join(', ')}`:''].filter(Boolean).join(' | ');
  const pair=gardenPair(gid);
  document.getElementById('gm-pair-current').innerHTML=pair?`<span class="bdg bg2">🔗 כרגע: ${pair.name}</span>`:'<span style="color:#999">לא משויך לזוג</span>';
  document.getElementById('gm-del-pair-btn').style.display=pair?'inline-block':'none';
  const allOther=GARDENS.filter(x=>x.id!==gid).sort((a,b)=>a.name.localeCompare(b.name,'he'));
  ['gm-pg2','gm-pg3'].forEach((id,i)=>{
    const sel=document.getElementById(id);
    sel.innerHTML='<option value="">—</option>';
    allOther.forEach(x=>sel.innerHTML+=`<option value="${x.id}">${x.city} · ${x.name}</option>`);
    if(pair&&pair.ids[i+1]) sel.value=pair.ids[i+1];
  });
  renderGM();
  document.getElementById('gm').classList.add('open');
}
function delPairFromGarden(){
  const pair=gardenPair(gmGid);
  if(!pair) return;
  if(!confirm(`למחוק את הזוג "${pair.name}"?`)) return;
  const idx=pairs.findIndex(p=>p.id===pair.id);
  if(idx>=0) pairs.splice(idx,1);
  save(); refresh();
  openGM(gmGid);
}
function setGmView(v){
  gmV=v;
  ['day','week','month'].forEach(x=>document.getElementById('gvb-'+x).classList.toggle('active',x===v));
  renderGM();
}
function gmNav(d){
  if(gmV==='day') gmD=addD(gmD,d);
  else if(gmV==='week') gmD=addD(gmD,d*7);
  else gmD=addM(gmD,d);
  renderGM();
}
function renderGmCal(){ renderGM(); }

function renderGM(){
  const gid=gmGid;let from,to,title;
  if(gmV==='day'){from=to=d2s(gmD);title=`${fD(from)} - יום ${dayN(from)}`;}
  else if(gmV==='week'){const ws=monStart(gmD);from=d2s(ws);to=d2s(addD(ws,5));title=`${fD(from)} – ${fD(to)}`;}
  else{const y=gmD.getFullYear(),m=gmD.getMonth();from=d2s(new Date(y,m,1));to=d2s(new Date(y,m+1,0));title=hebM(gmD);}
  (document.getElementById('gm-per')||{}).textContent =title;
  const evs=SCH.filter(s=>s.g===gid&&s.d>=from&&s.d<=to).sort((a,b)=>a.d.localeCompare(b.d)||(a.t||'').localeCompare(b.t||''));
  if(!evs.length){document.getElementById('gm-cal').innerHTML='<p style="color:#999;text-align:center;padding:18px">אין פעילויות</p>';return;}
  if(gmV==='month'){document.getElementById('gm-cal').innerHTML=renderMonth(evs,gmD);return;}
  let h='<div class="tw"><table><thead><tr><th>תאריך</th><th>יום</th><th>ספק</th><th>שעה</th><th>הערות</th><th>סטטוס</th></tr></thead><tbody>';
  evs.forEach(s=>{
    const g=G(s.g);
    const gblk=getGardenBlock(s.g,s.d);
    h+=`<tr onclick="openSP(${s.id})" class="${stClass(s)}"><td>${fD(s.d)}</td><td>יום ${dayN(s.d)}</td><td>${s.a}</td><td>${fT(s.t)}</td><td>${gblk?`<span style="color:#c62828;font-size:.72rem">${gblk.icon||'🚫'} ${gblk.reason}</span>${s.nt?' | '+s.nt:''}`:s.nt||''}</td><td>${stLabel(s)}</td></tr>`;
  });
  document.getElementById('gm-cal').innerHTML=h+'</tbody></table></div>';
}
function quickAddPartner(gid){
  const idx=pairs.findIndex(p=>p.ids.includes(gid));
  if(idx>=0){ openAddPair(idx); return; }
  editPairIdx=null;
  const g=G(gid);
  (document.getElementById('apm-title')||{}).textContent ='➕ הוסף זוג — '+g.name;
  document.getElementById('apm-name').value='';
  document.getElementById('apm-city').value=g.city||'';
  document.getElementById('apm-warn').style.display='none';
  const gs=gByCF(g.city,'').sort((a,b)=>a.name.localeCompare(b.name,'he'));
  ['apm-g1','apm-g2','apm-g3'].forEach((id,i)=>{
    const sel=document.getElementById(id);
    sel.innerHTML=i===2?'<option value="">—</option>':'<option value="">בחר גן</option>';
    gs.forEach(x=>sel.innerHTML+=`<option value='${x.id}'>${x.name}</option>`);
    if(i===0) sel.value=gid;
  });
  document.getElementById('apm').classList.add('open');
}
let _pqmId=null,_pqmDs=null;

function openPairQuickEdit(pairId,ds){
  _pqmId=pairId;
  _pqmDs=ds;
  const pair=pairs.find(p=>String(p.id)===String(pairId));
  if(!pair) return;
  const gs=pair.ids.map(id=>G(id)).filter(x=>x.id);
  const broken=isPairBroken(pairId,ds);
  (document.getElementById('pqm-title')||{}).textContent =`🔗 ${pair.name}`;
  document.getElementById('pqm-info').innerHTML=`
    <div style="font-weight:700;color:#1a237e;margin-bottom:5px">${pair.name}</div>
    <div style="color:#546e7a">גנים: ${gs.map(g=>g.name).join(' + ')}</div>
    <div style="color:#546e7a">תאריך: ${fD(ds)}</div>
    ${broken?'<div style="margin-top:5px"><span class="bdg bor">⚡ הזוג פורק להיום</span></div>':''}
  `;
  document.getElementById('pqm-break-btn').style.display=broken?'none':'block';
  document.getElementById('pqm-restore-btn').style.display=broken?'block':'none';
  document.getElementById('pqm').classList.add('open');
}

function pqmEdit(){
  CM('pqm');
  const idx=pairs.findIndex(p=>String(p.id)===String(_pqmId));
  if(idx>=0) openAddPair(idx);
}

function pqmBreakToday(){
  const pair=pairs.find(p=>String(p.id)===String(_pqmId));
  if(!pair) return;
  if(!confirm(`לפרק את הזוג "${pair.name}" רק להיום (${fD(_pqmDs)})?
הגנים יוצגו בנפרד ביום זה בלבד.`)) return;
  setPairBreak(_pqmId,_pqmDs,true);
  CM('pqm');
}

function pqmRestoreToday(){
  const pair=pairs.find(p=>String(p.id)===String(_pqmId));
  if(!pair) return;
  setPairBreak(_pqmId,_pqmDs,false);
  CM('pqm');
}

function pqmBreakPermanent(){
  const pair=pairs.find(p=>String(p.id)===String(_pqmId));
  if(!pair) return;
  if(!confirm(`למחוק לצמיתות את הזוג "${pair.name}"?
הגנים יוצגו בנפרד בכל הלוח. פעולה זו אינה ניתנת לביטול.`)) return;
  const idx=pairs.findIndex(p=>String(p.id)===String(_pqmId));
  if(idx>=0) pairs.splice(idx,1);
  Object.keys(pairBreaks).forEach(k=>{if(k.startsWith(_pqmId+'_')) delete pairBreaks[k];});
  save(); CM('pqm'); refresh();
}

function renderPairs(){
  const cityFilt=(document.getElementById('pairs-city')||{}).value||'';
  const f=pairs.filter(p=>{
    if(!cityFilt) return true;
    return p.ids.some(id=>G(id).city===cityFilt);
  });
  const el=document.getElementById('pairs-count');
  if(el) el.textContent='('+f.length+')';

  // ── Sidebar: gardens with no pair ───────────────────────
  const pairedGids=new Set(pairs.flatMap(p=>p.ids));
  const soloGardens=GARDENS.filter(g=>!pairedGids.has(g.id)&&gcls(g)==='גנים')
    .sort((a,b)=>a.city.localeCompare(b.city,'he')||a.name.localeCompare(b.name,'he'));
  const bySoloCity={};
  soloGardens.forEach(g=>{if(!bySoloCity[g.city])bySoloCity[g.city]=[];bySoloCity[g.city].push(g);});
  let sideHtml='';
  if(soloGardens.length){
    sideHtml+=`<div style="background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:10px;margin-bottom:10px">
      <div style="font-size:.76rem;font-weight:800;color:#f57f17;margin-bottom:8px">⚠️ גנים ללא זוג (${soloGardens.length})</div>`;
    Object.keys(bySoloCity).sort().forEach(city=>{
      sideHtml+=`<div style="margin-bottom:7px">
        <div style="font-size:.69rem;font-weight:700;color:#78909c;margin-bottom:4px">🏙️ ${city}</div>`;
      bySoloCity[city].forEach(g=>{
        sideHtml+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #fff3cd;font-size:.74rem">
          <span>🏫 ${g.name}</span>
          <button class="btn bp bsm" style="font-size:.62rem;padding:1px 6px" onclick="quickAddPartner(${g.id})">➕</button>
        </div>`;
      });
      sideHtml+='</div>';
    });
    sideHtml+='</div>';
  } else {
    sideHtml='<div style="font-size:.75rem;color:#2e7d32;background:#e8f5e9;border-radius:7px;padding:8px 10px">✅ כל הגנים משובצים בזוג</div>';
  }
  document.getElementById('pairs-solo').innerHTML=sideHtml;

  // ── Main: pairs list grouped by city ────────────────────
  if(!f.length){
    document.getElementById('pairs-main').innerHTML='<p style="color:#999">לא נמצאו זוגות</p>';
    return;
  }
  const byCity={};
  f.forEach(p=>{
    const city=G(p.ids[0]).city||'אחר';
    if(!byCity[city]) byCity[city]=[];
    byCity[city].push(p);
  });

  let h='';
  Object.keys(byCity).sort().forEach(city=>{
    const clr=CITY_COLORS(city);
    h+=`<div style="margin-bottom:18px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:7px 11px;background:${clr.light};border-radius:8px;border-right:3px solid ${clr.solid}">
        <span style="font-weight:800;color:${clr.solid};font-size:.85rem">🏙️ ${city}</span>
        <span style="font-size:.72rem;color:${clr.solid};opacity:.75">${byCity[city].length} זוגות/שלישיות</span>
      </div>`;
    byCity[city].forEach(p=>{
      const idx=pairs.indexOf(p);
      const gs=p.ids.map(id=>G(id)).filter(x=>x.id);
      // Always 3 columns — empty cell if only 2 gardens
      h+=`<div class="pair-row" style="border-right:3px solid ${clr.solid};margin-bottom:10px">
        <div class="pair-row-label" style="background:${clr.solid};display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:800;font-size:.8rem">${p.name||gs.map(g=>g.name).join(' + ')}</span>
          <div style="display:flex;gap:4px">
            <button class="btn bsm" style="background:rgba(255,255,255,.22);border:none;color:#fff;font-size:.68rem;padding:2px 7px;border-radius:4px;cursor:pointer" onclick="openAddPair(${idx})">✏️ ערוך</button>
            <button class="btn bsm" style="background:rgba(255,255,255,.15);border:none;color:#fff;font-size:.68rem;padding:2px 7px;border-radius:4px;cursor:pointer" onclick="delPair(${idx})">🗑️</button>
            <button class="btn bsm" style="background:rgba(255,255,255,.15);border:none;color:#fff;font-size:.68rem;padding:2px 7px;border-radius:4px;cursor:pointer" onclick="exportPairNow(${idx})">📤</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:#e8eaf6">`;
      gs.forEach(g=>{
        const cnt=SCH.filter(s=>s.g===g.id&&s.st!=='can').length;
        const last=SCH.filter(s=>s.g===g.id&&s.st!=='can').sort((a,b)=>b.d.localeCompare(a.d))[0];
        const mgr=getGardenMgr(g.id);
        h+=`<div style="background:#fff;padding:9px 11px">
          <div style="font-weight:800;color:#1a237e;font-size:.82rem;margin-bottom:3px">${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</div>
          ${g.st?`<div style="font-size:.69rem;color:#78909c;margin-bottom:2px">📍 ${g.st}</div>`:''}
          ${mgr?`<div style="font-size:.68rem;color:#1565c0">${mgr.role==='manager'?'🏛️':'👤'} ${mgr.name}</div>`:''}
          <div style="font-size:.68rem;color:#78909c;margin-top:3px">📅 ${cnt} פעילויות${last?' | '+fD(last.d):''}</div>
        </div>`;
      });
      // Always 3 cols — add empty left cell for pairs (not triples)
      if(gs.length<3) h+=`<div style="background:#fafafa;border-right:1px solid #e8eaf6;display:flex;align-items:center;justify-content:center"><span style="color:#d0d0d0;font-size:.8rem">—</span></div>`;
      h+='</div></div>';
    });
    h+='</div>';
  });
  document.getElementById('pairs-main').innerHTML=h;
}

function exportPairNow(idx){_exGids=pairs[idx].ids;openExport();}
function delPair(idx){
  const pair=pairs[idx];
  if(!pair) return;
  if(!confirm('למחוק את הזוג "'+pair.name+'"?\nהפעילויות ישארו אך הגנים לא יהיו מקושרים יותר.')) return;
  pairs.splice(idx,1);
  save();refresh();
  alert('✅ הזוג נמחק');
}
function openAddPair(idx){
  editPairIdx=idx;
  const pair=idx!==null&&idx!==undefined?pairs[idx]:null;
  (document.getElementById('apm-title')||{}).textContent =pair?'✏️ עריכת זוג':'➕ הוסף זוג/שלישיה';
  document.getElementById('apm-name').value=pair?pair.name:'';
  document.getElementById('apm-city').value='';
  document.getElementById('apm-warn').style.display='none';
  ['apm-g1','apm-g2','apm-g3'].forEach((id,i)=>{
    const sel=document.getElementById(id);
    sel.innerHTML=i===2?'<option value="">—</option>':'<option value="">בחר גן</option>';
    GARDENS.sort((a,b)=>a.name.localeCompare(b.name,'he')).forEach(g=>sel.innerHTML+=`<option value="${g.id}">${g.city} · ${g.name}</option>`);
    if(pair&&pair.ids[i]) sel.value=pair.ids[i];
  });
  document.getElementById('apm').classList.add('open');
}
function apmCity(){
  const city=document.getElementById('apm-city').value;
  const gs=gByCF(city,'').sort((a,b)=>a.name.localeCompare(b.name,'he'));
  ['apm-g1','apm-g2','apm-g3'].forEach((id,i)=>{
    const sel=document.getElementById(id);
    const cur=sel.value;
    sel.innerHTML=i===2?'<option value="">—</option>':'<option value="">בחר גן</option>';
    gs.forEach(g=>sel.innerHTML+=`<option value='${g.id}'>${city?g.name:g.city+' · '+g.name}</option>`);
    if(cur) sel.value=cur;
  });
}
function savePairModal(){
  const g1=parseInt(document.getElementById('apm-g1').value)||null;
  const g2=parseInt(document.getElementById('apm-g2').value)||null;
  const g3=parseInt(document.getElementById('apm-g3').value)||null;
  if(!g1){alert('יש לבחור לפחות גן אחד');return;}
  const ids=[g1,g2,g3].filter(Boolean);
  const warnEl=document.getElementById('apm-warn');
  const dupe=ids.map(gid=>{
    const p=gardenPair(gid);
    const isCurrentPair=editPairIdx!==null&&p&&p.id===pairs[editPairIdx]?.id;
    return p&&!isCurrentPair?`${G(gid).name} כבר בזוג "${p.name}"`:null;
  }).filter(Boolean);
  if(dupe.length){
    warnEl.style.display='block';
    warnEl.textContent='⚠️ '+dupe.join(' | ');
    if(!confirm('גנים כבר בזוגות אחרים. בכל זאת להמשיך?')) return;
  }
  const nm=document.getElementById('apm-name').value||ids.map(id=>G(id).name||'').join(' + ');
  const isEdit=editPairIdx!==null&&editPairIdx!==undefined;
  if(isEdit){
    pairs[editPairIdx]={...pairs[editPairIdx],ids,name:nm};
  } else {
    pairs.push({id:Date.now(),ids,name:nm});
  }
  save();CM('apm');refresh();
  if(currentTab==='managers') renderManagers();
  alert('✅ '+(isEdit?'הזוג עודכן':'הזוג נשמר')+': '+nm);
}

const HOL_TYPES={
  vacation:{label:'חופשה',emoji:'🟡',bg:'#fffde7',color:'#f57f17',border:'#f9a825'},
  camp:    {label:'קייטנה',emoji:'🟣',bg:'#f3e5f5',color:'#6a1b9a',border:'#ce93d8'},
  event:   {label:'אירוע',emoji:'🟢',bg:'#e8f5e9',color:'#2e7d32',border:'#a5d6a7'},
  noact:   {label:'אין פעילות',emoji:'🔴',bg:'#ffebee',color:'#c62828',border:'#ef9a9a'}
};
function getHolidayInfo(ds,city,scope){
  const h=holidays.find(h=>{
    if(h.from>ds||h.to<ds) return false;
    if(h.city&&city&&h.city!==city) return false;
    if(h.scope&&h.scope!=='all'&&scope&&h.scope!==scope) return false;
    return true;
  });
  if(!h) return null;
  const t=HOL_TYPES[h.type]||HOL_TYPES.vacation;
  return{...t,name:h.name,note:h.note,id:h.id};
}

function initHolDrops(){
  const filtCity=document.getElementById('hol-filt-city');
  filtCity.innerHTML='<option value="">כל הערים</option>';
  cities().forEach(c=>filtCity.innerHTML+=`<option value='${c}'>${c}</option>`);
  const wrap=document.getElementById('hol-city-checks');
  if(wrap) wrap.innerHTML=cities().map(c=>`<label style="display:flex;gap:5px;align-items:center;padding:2px 4px;cursor:pointer"><input type="checkbox" class="hol-city-cb" value='${c}'> ${c}</label>`).join('');
}
function holToggleAll(cb){document.querySelectorAll('.hol-city-cb').forEach(x=>x.checked=cb.checked);}
function getHolCities(){
  const allCb=document.getElementById('hol-city-all');
  if(allCb&&allCb.checked) return '';
  return [...document.querySelectorAll('.hol-city-cb:checked')].map(x=>x.value);
}

function renderHolidays(){
  const fc=document.getElementById('hol-filt-city').value;
  const ft=document.getElementById('hol-filt-type').value;
  const list=holidays
    .filter(h=>(!fc||(h.city===fc||!h.city))&&(!ft||h.type===ft))
    .sort((a,b)=>a.from.localeCompare(b.from));
  let h='';
  if(!list.length){document.getElementById('holidays-body').innerHTML='<p style="color:#999">אין חופשות מוגדרות. לחץ "הוסף".</p>';return;}
  h='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:11px">';
  list.forEach(hol=>{
    const t=HOL_TYPES[hol.type]||HOL_TYPES.vacation;
    const single=hol.from===hol.to;
    const dateStr=single?fD(hol.from):`${fD(hol.from)} – ${fD(hol.to)}`;
    h+=`<div style="background:#fff;border-radius:10px;padding:12px;box-shadow:0 2px 8px rgba(0,0,0,.06);border-right:4px solid ${t.border}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <span style="font-size:.72rem;font-weight:700;padding:2px 7px;border-radius:20px;background:${t.bg};color:${t.color}">${t.emoji} ${t.label}</span>
          <div style="font-weight:700;color:#1a237e;font-size:.88rem;margin-top:4px">${hol.name}</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn bo bsm" onclick="openAddHoliday('${hol.id}')">✏️</button>
          <button class="btn br bsm" onclick="deleteHoliday('${hol.id}')">🗑️</button>
        </div>
      </div>
      <div style="font-size:.8rem;color:#546e7a">📅 ${dateStr}</div>
      <div style="font-size:.78rem;color:#546e7a;margin-top:3px">
        🏙️ ${hol.city||'כל הערים'} &nbsp;|&nbsp; ${hol.scope==='all'||!hol.scope?'גנים ובתי ספר':hol.scope}
      </div>
      ${hol.note?`<div style="font-size:.74rem;color:#78909c;margin-top:3px">📝 ${hol.note}</div>`:''}
    </div>`;
  });
  document.getElementById('holidays-body').innerHTML=h+'</div>';
}

let _editHolId=null;
function openAddHoliday(id){
  _editHolId=id;
  const hol=id?holidays.find(h=>h.id===id):null;
  (document.getElementById('holm-title')||{}).textContent =hol?'✏️ עריכת חופשה':'➕ הוסף חופשה/אירוע';
  document.getElementById('hol-name').value=hol?hol.name:'';
  document.getElementById('hol-from').value=hol?hol.from:d2s(calD);
  document.getElementById('hol-to').value=hol?hol.to:d2s(calD);
  document.getElementById('hol-type').value=hol?hol.type:'vacation';
  const allCb=document.getElementById('hol-city-all');
  const cbs=document.querySelectorAll('.hol-city-cb');
  if(hol&&hol.city){
    if(allCb) allCb.checked=false;
    cbs.forEach(cb=>cb.checked=cb.value===hol.city);
  } else {
    if(allCb) allCb.checked=true;
    cbs.forEach(cb=>cb.checked=false);
  }
  document.getElementById('hol-scope').value=hol?hol.scope||'all':'all';
  document.getElementById('hol-note').value=hol?hol.note||'':'';
  document.getElementById('holm').classList.add('open');
}
function saveHoliday(){
  const name=document.getElementById('hol-name').value.trim();
  const from=document.getElementById('hol-from').value;
  const to=document.getElementById('hol-to').value;
  if(!name||!from||!to){alert('יש למלא שם ותאריכים');return;}
  if(from>to){alert('תאריך התחלה חייב להיות לפני סיום');return;}
  const selCities=getHolCities();
  const cityList=Array.isArray(selCities)&&selCities.length?selCities:[''];
  const baseId=_editHolId||('h_'+Date.now());
  if(_editHolId) holidays=holidays.filter(h=>h.id!==_editHolId&&!h.id.startsWith(_editHolId+'_'));
  cityList.forEach((city,idx)=>{
    const hol={
      id:cityList.length>1?baseId+'_'+idx:baseId,
      name,from,to,
      type:document.getElementById('hol-type').value,
      city:city,
      scope:document.getElementById('hol-scope').value,
      note:document.getElementById('hol-note').value.trim()
    };
    holidays.push(hol);
  });
  save();CM('holm');refresh();
}
function deleteHoliday(id){
  if(!confirm('למחוק?')) return;
  holidays=holidays.filter(h=>h.id!==id);
  save(); refresh();
}
function getClusters(){return Object.values(clusters||{}).sort((a,b)=>a.name.localeCompare(b.name,'he'));}
function gardenClusters(gid){return getClusters().filter(cl=>(cl.gardenIds||[]).includes(gid));}
const PAIR_COLORS=['#1565c0','#2e7d32','#6a1b9a','#00695c','#c62828','#e65100','#37474f','#4527a0'];
function pairColorIdx(pairId){
  const idx=pairs.findIndex(p=>p.id===pairId);
  return idx>=0?idx%8:0;
}
function pairClrClass(pairId){return 'pc'+pairColorIdx(pairId);}
function pairWeekColors(pairId){
  const c=['#1565c0','#2e7d32','#6a1b9a','#00695c','#c62828','#e65100','#37474f','#4527a0'];
  const bg=['#e3f2fd','#e8f5e9','#f3e5f5','#e0f2f1','#ffebee','#fff3e0','#eceff1','#ede7f6'];
  const i=pairColorIdx(pairId);
  return{solid:c[i],light:bg[i]};
}
function refreshClusterDrops(){
  ['cal-cl','g-cl'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.innerHTML='<option value="">הכל</option><option value="__all__">🔢 כל האשכולות</option>';
    getClusters().forEach(cl=>el.innerHTML+=`<option value='${cl.name}'>${cl.name}</option>`);
  });
  const pairEl=document.getElementById('cal-pair');
  if(!pairEl) return;
  pairEl.innerHTML='<option value="">בחר זוג מוגדר...</option>';
  const byCity={};
  pairs.forEach((p,idx)=>{
    const city=G(p.ids[0]).city||'אחר';
    if(!byCity[city]) byCity[city]=[];
    byCity[city].push({p,idx});
  });
  Object.keys(byCity).sort().forEach(city=>{
    const gan=byCity[city].filter(({p})=>gcls(G(p.ids[0]))==='גנים');
    const sch=byCity[city].filter(({p})=>gcls(G(p.ids[0]))==='ביה"ס');
    if(gan.length){
      const og=document.createElement('optgroup');
      og.label=`🏙️ ${city} — גנים`;
      gan.forEach(({p})=>og.innerHTML+=`<option value='${p.id}'>${p.name}</option>`);
      pairEl.appendChild(og);
    }
    if(sch.length){
      const os=document.createElement('optgroup');
      os.label=`🏙️ ${city} — בתי ספר`;
      sch.forEach(({p})=>os.innerHTML+=`<option value='${p.id}'>${p.name}</option>`);
      pairEl.appendChild(os);
    }
  });
}
function calSelectPair(){
  const pairId=parseInt(document.getElementById('cal-pair').value)||null;
  if(!pairId){document.getElementById('cal-g1').value='';document.getElementById('cal-g2').value='';document.getElementById('cal-g3').value='';renderCal();return;}
  const pair=pairs.find(p=>p.id===pairId);
  if(!pair) return;
  document.getElementById('cal-g1').value=pair.ids[0]||'';
  document.getElementById('cal-g2').value=pair.ids[1]||'';
  document.getElementById('cal-g3').value=pair.ids[2]||'';
  renderCal();
}

let _clustersView='grid';
function setClustersView(v){
  _clustersView=v;
  document.getElementById('cl-view-grid').className=v==='grid'?'btn bp bsm':'btn bo bsm';
  document.getElementById('cl-view-list').className=v==='list'?'btn bp bsm':'btn bo bsm';
  renderClusters();
}

function renderClusters(){
  const all=getClusters();
  const body=document.getElementById('clusters-body');
  const byCity={};
  all.forEach(cl=>{
    const firstG=(cl.gardenIds||[]).map(id=>G(id)).find(g=>g.id);
    const city=firstG?firstG.city:'אחר';
    if(!byCity[city]) byCity[city]={gan:[],sch:[]};
    const hasSch=(cl.gardenIds||[]).some(id=>gcls(G(id))==='ביה"ס');
    const hasGan=(cl.gardenIds||[]).some(id=>gcls(G(id))==='גנים');
    if(hasSch) byCity[city].sch.push(cl);
    if(hasGan&&!hasSch) byCity[city].gan.push(cl);
    if(hasGan&&hasSch) byCity[city].gan.push(cl); // mixed
  });
  const allClusterGids=new Set(all.flatMap(cl=>cl.gardenIds||[]));
  const noCluster=GARDENS.filter(g=>!allClusterGids.has(g.id)&&gcls(g)==='גנים');

  const isGrid=_clustersView!=='list';
  let h='';

  if(!isGrid){
    // ═══ תצוגת רשימה ═══
    h+=`<table style="width:100%;border-collapse:collapse;font-size:.8rem">
      <thead>
        <tr style="background:#e8eaf6;color:#1a237e;font-weight:700;font-size:.78rem">
          <th style="padding:7px 8px;text-align:right;border-bottom:2px solid #c5cae9">אשכול</th>
          <th style="padding:7px 8px;text-align:right;border-bottom:2px solid #c5cae9">עיר</th>
          <th style="padding:7px 8px;text-align:center;border-bottom:2px solid #c5cae9">גנים</th>
          <th style="padding:7px 8px;text-align:right;border-bottom:2px solid #c5cae9">שיבוץ אחרון</th>
          <th style="padding:7px 8px;text-align:center;border-bottom:2px solid #c5cae9">פעולות</th>
        </tr>
      </thead><tbody>`;
    Object.keys(byCity).sort().forEach(city=>{
      [...(byCity[city].gan||[]),...(byCity[city].sch||[])].forEach((cl,i)=>{
        const gs=(cl.gardenIds||[]).map(id=>G(id)).filter(x=>x.id);
        const hist=SCH.filter(s=>(cl.gardenIds||[]).includes(s.g)).map(s=>s.d).sort().slice(-1);
        const lastDate=hist.length?fD(hist[0]):'—';
        const ganCount=gs.filter(g=>gcls(g)==='גנים').length;
        const schCount=gs.filter(g=>gcls(g)==='ביה"ס').length;
        const bg=i%2===0?'#fff':'#f8f9ff';
        h+=`<tr style="background:${bg};border-bottom:1px solid #e8eaf6">
          <td style="padding:7px 8px;font-weight:700;color:#1a237e">🔢 ${cl.name}</td>
          <td style="padding:7px 8px;color:#546e7a">🏙️ ${city}</td>
          <td style="padding:7px 8px;text-align:center;color:#37474f">
            ${ganCount?`<span title="גנים">🏫${ganCount}</span> `:''}${schCount?`<span title="בתי ספר">🏛️${schCount}</span>`:''}
          </td>
          <td style="padding:7px 8px;color:#78909c;font-size:.76rem">${lastDate}</td>
          <td style="padding:7px 8px;text-align:center;white-space:nowrap">
            <button class="btn bp bsm" onclick="openClusterSchedule('${cl.id}')" title="שיבוץ פעילות לאשכול">📅 שיבוץ</button>
            <button class="btn bo bsm" onclick="openEditCluster('${cl.id}')" title="עריכת הגדרות האשכול">✏️ עריכה</button>
            <button class="btn br bsm" onclick="deleteCluster('${cl.id}')" title="מחק אשכול">🗑️</button>
          </td>
        </tr>`;
      });
    });
    h+='</tbody></table>';

    // גנים ללא אשכול (רשימה מתקפלת)
    if(noCluster.length){
      h+=`<div style="margin-top:12px;border-top:2px dashed #ffe082;padding-top:8px">
        <div style="font-weight:800;color:#f57f17;font-size:.82rem;margin-bottom:6px">⚠️ גנים ללא אשכול (${noCluster.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">`;
      noCluster.forEach(g=>{
        h+=`<span style="background:#fffde7;border:1px dashed #ffe082;border-radius:5px;padding:3px 7px;font-size:.74rem;display:inline-flex;align-items:center;gap:4px">
          🏫 ${g.city} · ${g.name}
          <button class="btn bp bsm" style="font-size:.62rem;padding:1px 5px" onclick="openEditCluster(null,'${g.id}')">➕</button>
        </span>`;
      });
      h+='</div></div>';
    }

  } else {
    // ═══ תצוגת כרטיסים (מקורית) ═══
    Object.keys(byCity).sort().forEach(city=>{
      h+=`<div style="margin-bottom:16px">
        <div style="font-weight:800;color:#1a237e;font-size:.85rem;padding:6px 10px;background:#e8eaf6;border-radius:6px;margin-bottom:8px">🏙️ ${city}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px">`;
      [...(byCity[city].gan||[]),...(byCity[city].sch||[])].forEach(cl=>{
        const gs=(cl.gardenIds||[]).map(id=>G(id)).filter(x=>x.id).sort((a,b)=>a.name.localeCompare(b.name,'he'));
        const ganGs=gs.filter(g=>gcls(g)==='גנים');
        const schGs=gs.filter(g=>gcls(g)==='ביה"ס');
        const hist=SCH.filter(s=>(cl.gardenIds||[]).includes(s.g)).map(s=>s.d).sort().slice(-1);
        const lastDate=hist.length?hist[0]:'';
        h+=`<div class="card" style="padding:10px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
            <div style="font-weight:700;color:#1a237e;font-size:.85rem">🔢 ${cl.name}</div>
            <div style="display:flex;gap:3px">
              <button class="btn bo bsm" onclick="openEditCluster('${cl.id}')">✏️</button>
              <button class="btn br bsm" onclick="deleteCluster('${cl.id}')">🗑️</button>
            </div>
          </div>
          <div style="font-size:.74rem;color:#546e7a;margin-bottom:6px">
            ${ganGs.length?`🏫 ${ganGs.length} גנים`:''} ${schGs.length?`🏛️ ${schGs.length} בתי ספר`:''}
            ${lastDate?`<span style="color:#78909c"> | אחרון: ${fD(lastDate)}</span>`:''}
          </div>
          <div style="max-height:100px;overflow-y:auto;margin-bottom:7px">`;
        gs.forEach(g=>h+=`<div style="font-size:.73rem;padding:2px 0;border-bottom:1px solid #f5f5f5">
          ${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}${g.st?` <span style="color:#aaa">${g.st}</span>`:''}
        </div>`);
        h+=`</div>
          <button class="btn bp bsm" style="width:100%" onclick="openClusterSchedule('${cl.id}')">📅 שבץ לאשכול</button>
        </div>`;
      });
      h+='</div></div>';
    });
    // גנים ללא אשכול — תצוגת כרטיסים
    if(noCluster.length){
      const noByCityMap={};
      noCluster.forEach(g=>{const c=g.city||'אחר';if(!noByCityMap[c])noByCityMap[c]=[];noByCityMap[c].push(g);});
      h+=`<div style="margin-top:14px;border-top:2px dashed #ffe082;padding-top:10px">
        <div style="font-weight:800;color:#f57f17;font-size:.83rem;margin-bottom:8px">⚠️ גנים ללא אשכול (${noCluster.length})</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:7px">`;
      Object.keys(noByCityMap).sort().forEach(city=>{
        h+=`<div style="background:#fffde7;border:1px dashed #ffe082;border-radius:7px;padding:8px">
          <div style="font-size:.72rem;font-weight:700;color:#f57f17;margin-bottom:4px">🏙️ ${city}</div>`;
        noByCityMap[city].forEach(g=>{
          h+=`<div style="font-size:.75rem;display:flex;justify-content:space-between;align-items:center;padding:2px 0">
            <span>${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</span>
            <button class="btn bp bsm" style="font-size:.63rem;padding:1px 5px" onclick="openEditCluster(null,'${g.id}')">➕</button>
          </div>`;
        });
        h+='</div>';
      });
      h+='</div></div>';
    }
  } // end else grid

  if(!h) h='<p style="color:#999">אין אשכולות.</p>';
  body.innerHTML=h;
}

function openEditCluster(clId,preSelectGid){
  const cl=clId?clusters[clId]:null;
  (document.getElementById('clm-title')||{}).textContent =cl?`✏️ עריכת אשכול: ${cl.name}`:'➕ אשכול חדש';
  document.getElementById('cl-name').value=cl?cl.name:'';
  document.getElementById('cl-desc').value=cl?cl.desc||'':'';
  document.getElementById('cl-name').dataset.editId=clId||'';
  const cityEl=document.getElementById('cl-city');
  cityEl.innerHTML='<option value="">כל הערים</option>';
  cities().forEach(c=>cityEl.innerHTML+=`<option value='${c}'>${c}</option>`);
  clFillGardens(cl);
  if(preSelectGid){const cb=document.querySelector('#cl-gardens input[value="'+preSelectGid+'"]');if(cb)cb.checked=true;}
  document.getElementById('clm').classList.add('open');
}
function clFillGardens(cl){
  const city=document.getElementById('cl-city').value;
  // Schools don't need clusters
  const gs=GARDENS.filter(g=>(!city||g.city===city)&&gcls(g)==='גנים').sort((a,b)=>a.name.localeCompare(b.name,'he'));
  const checked=new Set(cl?cl.gardenIds||[]:[]);
  document.getElementById('cl-gardens').innerHTML=gs.map(g=>`<label style="display:flex;gap:6px;padding:5px 4px;cursor:pointer;align-items:center;border-bottom:1px solid #f5f5f5">
    <input type="checkbox" value="${g.id}" ${checked.has(g.id)?'checked':''} style="min-width:14px">
    <span style="flex:1">${g.city} · ${g.name}</span>
    ${Object.values(clusters||{}).filter(c=>c.id!==cl?.id&&(c.gardenIds||[]).includes(g.id)).map(c=>`<span class="bdg bgray" style="font-size:.63rem">${c.name}</span>`).join('')}
  </label>`).join('');
}
function clFilterCity(){
  const clId=document.getElementById('cl-name').dataset.editId;
  const cl=clId?clusters[clId]:null;
  clFillGardens(cl);
}
function saveClusterModal(){
  const name=document.getElementById('cl-name').value.trim();
  if(!name){alert('יש להזין שם אשכול');return;}
  const editId=document.getElementById('cl-name').dataset.editId;
  const gardenIds=[...document.querySelectorAll('#cl-gardens input:checked')].map(cb=>parseInt(cb.value));
  const id=editId||('cl_'+Date.now());
  clusters[id]={id,name,desc:document.getElementById('cl-desc').value.trim(),gardenIds};
  save();CM('clm');refresh();refreshClusterDrops();
}
function deleteCluster(clId){
  if(!confirm('למחוק אשכול זה?')) return;
  delete clusters[clId];
  save(); refresh();
}

let _clsId=null;
function openClusterSchedule(clId){
  _clsId=clId;
  const cl=clusters[clId];
  if(!cl){return;}
  (document.getElementById('clsm-title')||{}).textContent =`📅 שיבוץ לאשכול: ${cl.name}`;
  document.getElementById('cls-date').value=d2s(calD);
  document.getElementById('cls-sup').innerHTML='<option value="">בחר ספק</option>';
  [...new Set(SCH.map(s=>s.a))].sort().forEach(n=>document.getElementById('cls-sup').innerHTML+=`<option value="${n}">${n}</option>`);
  SUPBASE.forEach(s=>{if(!document.querySelector(`#cls-sup option[value="${s.name}"]`)) document.getElementById('cls-sup').innerHTML+=`<option value="${s.name}">${s.name}</option>`;});
  document.getElementById('cls-ph').value='';
  document.getElementById('cls-warn').style.display='none';
  document.getElementById('cls-autotime-row').style.display='none';
  clsBuildGardenList(cl);
  document.getElementById('cls-sup').onchange=function(){
    const s=SCH.find(x=>x.a===this.value&&x.p);
    if(s) document.getElementById('cls-ph').value=s.p;
  };
  document.getElementById('clsm').classList.add('open');
}
function clsBuildGardenList(cl){
  const gs=(cl.gardenIds||[]).map(id=>G(id)).filter(x=>x.id).sort((a,b)=>a.name.localeCompare(b.name,'he'));
  let h='';
  gs.forEach((g,i)=>{
    const lastSched=SCH.filter(s=>s.g===g.id).sort((a,b)=>b.d.localeCompare(a.d))[0];
    const lastT=lastSched?fT(lastSched.t):'';
    h+=`<div style="display:grid;grid-template-columns:auto 1fr 1fr auto;gap:8px;align-items:center;padding:7px 5px;border-bottom:1px solid #f0f0f0">
      <span class="bdg bb" style="font-size:.67rem;white-space:nowrap">${g.city}</span>
      <span style="font-weight:600;font-size:.8rem">${g.name}</span>
      <div class="fg">
        <label style="font-size:.66rem;color:#888">שעה</label>
        <input type="time" id="cls-t-${g.id}" value="${lastT}" style="min-width:90px;padding:4px 6px">
      </div>
      <label style="display:flex;align-items:center;gap:4px;font-size:.74rem;cursor:pointer">
        <input type="checkbox" id="cls-inc-${g.id}" checked>
        כלול
      </label>
    </div>`;
  });
  document.getElementById('cls-gardens-list').innerHTML=h||'<p style="color:#999;padding:10px">לא הוגדרו גנים לאשכול זה</p>';
}
function clsAutoTime(){
  const row=document.getElementById('cls-autotime-row');
  row.style.display=row.style.display==='none'?'block':'none';
}
function applyUniTime(){
  const t=document.getElementById('cls-uni-time').value;
  if(!t) return;
  const cl=clusters[_clsId];
  (cl.gardenIds||[]).forEach(gid=>{
    const el=document.getElementById(`cls-t-${gid}`);
    if(el) el.value=t;
  });
  document.getElementById('cls-autotime-row').style.display='none';
}
function saveClusterSchedule(){
  const date=document.getElementById('cls-date').value;
  const sup=document.getElementById('cls-sup').value;
  const ph=document.getElementById('cls-ph').value;
  if(!date||!sup){alert('יש לבחור תאריך וספק');return;}
  const cl=clusters[_clsId];
  const gs=(cl.gardenIds||[]).map(id=>G(id)).filter(x=>x.id);
  const warns=[];let saved=0;
  gs.forEach(g=>{
    const inc=document.getElementById(`cls-inc-${g.id}`);
    if(!inc||!inc.checked) return;
    const t=document.getElementById(`cls-t-${g.id}`)?.value||'';
    if(gcls(g)==='גנים'&&t){
      const h=parseInt(t.split(':')[0]);
      const per=h<13?'morning':'afternoon';
      const con=SCH.find(s=>s.g===g.id&&s.d===date&&s.st!=='can'&&s.t&&(parseInt(s.t.split(':')[0])<13?'morning':'afternoon')===per);
      if(con) warns.push(`${g.name}: כבר קיים ${con.a} ב-${fT(con.t)}`);
    }
    const newId=Date.now()+Math.random();
    SCH.push({id:newId,g:g.id,d:date,a:sup,t,p:ph,n:'',st:'ok',cr:'',cn:'',nt:'',pd:'',pt:'',grp:1});
    saved++;
  });
  if(warns.length){
    document.getElementById('cls-warn').style.display='block';
    document.getElementById('cls-warn').innerHTML='⚠️ התראות התנגשות שעות:<br>'+warns.join('<br>');
  }
  save();
  if(saved>0){
    alert(`✅ שובצו ${saved} פעילויות לתאריך ${fD(date)}`);
    CM('clsm');refresh();
  }
}

function exportPairRow(pairId,ds){
  const pair=pairs.find(p=>String(p.id)===String(pairId));
  if(!pair) return;
  const evs=SCH.filter(s=>pair.ids.includes(s.g)&&s.d===ds&&s.st!=='can')
    .sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
  if(!evs.length){showCopyToast('אין פעילויות לייצוא');return;}
  let text=`📅 ${fD(ds)} יום ${dayN(ds)}\n`;
  const firstEv=evs[0];
  const anyPost=evs.some(s=>s.st==='post');
  if(anyPost){
    const origEv=evs.find(s=>s.st==='post');
    if(origEv&&origEv.pd) text+=`📌 הפעילות עברה מ-${fD(ds)} ל-${fD(origEv.pd)}\n`;
  }
  text+=firstEv.a;
  if(firstEv.act) text+=` (${firstEv.act})`;
  if(firstEv.p) text+=` 📞 ${firstEv.p}`;
  text+=`\n`;
  const sortedEvs=[...evs].sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
  const seen=new Set();
  sortedEvs.forEach(s=>{
    if(seen.has(s.g)) return; seen.add(s.g);
    const g=G(s.g);if(!g.id) return;
    text+=(g.st?g.st+' ':'')+g.name;
    if(s.t) text+=` ${fT(s.t)}`;
    text+=`\n`;
  });
  const copy=t=>{
    navigator.clipboard.writeText(t)
      .then(()=>showCopyToast())
      .catch(()=>{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);showCopyToast();});
  };
  copy(text);
}
function showCopyToast(msg){
  let t=document.getElementById('copy-toast');
  if(!t){t=document.createElement('div');t.id='copy-toast';t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1b5e20;color:#fff;padding:9px 22px;border-radius:24px;font-size:.85rem;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);transition:opacity .4s';document.body.appendChild(t);}
  t.textContent=msg||'✅ ההודעה הועתקה ללוח!';t.style.opacity='1';
  clearTimeout(t._to);t._to=setTimeout(()=>t.style.opacity='0',2200);
}

function openExport(){
  document.getElementById('ex-d1').value=d2s(calD);
  document.getElementById('ex-d2').value='';
  const f=getCalF();
  const gids=_exGids||f.gids;
  let ctx=`תאריך: ${fD(d2s(calD))}`;
  if(gids&&gids.length) ctx+=` | גנים: ${gids.map(id=>G(id).name||'').join(' + ')}`;
  (document.getElementById('ex-ctx')||{}).textContent =ctx;
  document.getElementById('exm').classList.add('open');
}
function genExport(){
  const from=document.getElementById('ex-d1').value;
  const to=document.getElementById('ex-d2').value||from;
  const fmt=document.getElementById('ex-fmt').value;
  if(!from){alert('בחר תאריך');return;}
  const f=getCalF();
  const gids=_exGids||f.gids;
  _exGids=null;
  const rel=SCH.filter(s=>s.st!=='can'&&s.d>=from&&s.d<=to&&(!gids||gids.includes(s.g)))
    .sort((a,b)=>a.d.localeCompare(b.d)||(a.t||'99').localeCompare(b.t||'99'));
  if(!rel.length){(document.getElementById('ex-prev')||{}).textContent ='אין פעילויות';return;}
  const byDate={};rel.forEach(s=>{if(!byDate[s.d])byDate[s.d]=[];byDate[s.d].push(s);});
  let text='';
  Object.keys(byDate).sort().forEach(date=>{
    text+=`📅 ${fD(date)} - יום ${dayN(date)}\n━━━━━━━━━━━━━━━━\n`;
    const byCity={};byDate[date].forEach(s=>{const g=G(s.g);const c=g.city||'';if(!byCity[c])byCity[c]=[];byCity[c].push({...s,gd:g});});
    Object.keys(byCity).sort().forEach(c=>{
      if(fmt==='full') text+=`\n🏙️ ${c}\n`;
      byCity[c].forEach(s=>{
        if(fmt==='full'){
          const waAddr=s.gd.st?'https://wa.me/?text='+encodeURIComponent(s.gd.st+' '+s.gd.city):'';
          text+=`  🏫 ${s.gd.st||''} · ${s.gd.name}${s.t?' · ⏰ '+fT(s.t):''}${waAddr?'\n  🗺️ '+waAddr:''}\n  📚 ${s.a}${s.p?' · 📞 '+s.p:''}\n`;
        }
        else text+=`${s.gd.name}${s.t?' '+fT(s.t):''} - ${s.a}\n`;
      });
    });
    text+='\n';
  });
  (document.getElementById('ex-prev')||{}).textContent =text;
}
function copyExport(){
  const t=document.getElementById('ex-prev').textContent;
  if(!t||t.startsWith('לחץ')) return;
  navigator.clipboard.writeText(t).then(()=>alert('✅ הועתק!')).catch(()=>{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);alert('✅ הועתק!');});
}

// [backup system unified — see createSnapshot/openBackup above]
let _supExName=null;
function openSupExport(supName){
  _supExName=supName;
  (document.getElementById('supexm-title')||{}).textContent =supName?`📊 יצוא: ${supName}`:'📊 יצוא דוח ספקים';
  const now=new Date();
  document.getElementById('supex-from').value=d2s(new Date(now.getFullYear(),now.getMonth(),1));
  document.getElementById('supex-to').value=d2s(new Date(now.getFullYear(),now.getMonth()+1,0));
  document.getElementById('supex-prev').style.display='none';
  document.getElementById('supexm').classList.add('open');
}
function doSupExport(){
  const from=document.getElementById('supex-from').value;
  const to=document.getElementById('supex-to').value;
  if(!from||!to){alert('בחר תאריכים');return;}

  // Get supplier phone for header
  const _supBase=_supExName?supBase(_supExName):'';
  const _supExData=_supBase?supEx[_supBase]||{}:{};
  const _supObj=_supExName?Object.values(SUPBASE||{}).find(s=>supBase(s.name)===_supBase)||null:null;
  const supPhone=_supExData.phone||(_supObj&&_supObj.phone)||(_supExName?SCH.find(s=>supBase(s.a)===_supBase&&s.p)?.p||'':'');

  const evs=SCH.filter(s=>{
    if(s.d<from||s.d>to) return false;
    if(s.st==='can') return false;
    if(_supExName&&supBase(s.a)!==supBase(_supExName)) return false;
    return true;
  }).sort((a,b)=>{
    const ga=G(a.g),gb=G(b.g);
    return (ga.city||'').localeCompare(gb.city||'','he')
      ||a.d.localeCompare(b.d)
      ||(ga.name||'').localeCompare(gb.name||'','he')
      ||(a.t||'').localeCompare(b.t||'');
  });
  if(!evs.length){alert('אין פעילויות בטווח זה');return;}

  const stMap={ok:'מתקיים',done:'התקיים',can:'בוטל',post:'נדחה',nohap:'לא התקיים'};
  const bom='\uFEFF';
  const q=c=>`"${String(c==null?'':c).replace(/"/g,'""')}"`;
  const lines=[];

  // Header block
  if(_supExName){
    lines.push([q('ספק:'),q(_supExName),'','','','','','','',''].join(','));
    lines.push([q('טלפון:'),q(supPhone),'','','','','','','',''].join(','));
    lines.push([q('תקופה:'),q(fD(from)+' – '+fD(to)),'','','','','','','',''].join(','));
    lines.push('');
  }

  // Column headers: city → garden → address → date → day → time → activity → groups → status → notes
  lines.push(['עיר','תאריך','יום','כתובת','שם גן','שעה','פעילות','קבוצות','סטטוס','הערות'].map(q).join(','));

  evs.forEach(s=>{
    const g=G(s.g);
    const actName=supAct(s.a)||s.a;
    lines.push([
      q(g.city||''),q(fD(s.d)),q(dayN(s.d)),
      q(g.st||''),q(g.name||''),q(fT(s.t)),
      q(actName),q(s.grp>1?s.grp:''),
      q(stMap[s.st]||'מתקיים'),q(s.nt||'')
    ].join(','));
  });

  const csv=bom+lines.join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`דוח_ספק_${_supExName||'כל_הספקים'}_${from}_${to}.csv`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(url);
  CM('supexm');
}
function exportExcel(){
  const f=getCalF();
  const y=calD.getFullYear(),m=calD.getMonth();
  const from=d2s(new Date(y,m,1)),to=d2s(new Date(y,m+1,0));
  const rel=SCH.filter(s=>s.d>=from&&s.d<=to&&(!f.gids||f.gids.includes(s.g))).sort((a,b)=>a.d.localeCompare(b.d));
  downloadCSV(rel,`פעילויות_${hebM(calD)}`);
}
function exportExcelSched(){
  const rel=getFiltSched();
  downloadCSV(rel,'לוח_זמנים');
}
function downloadCSV(data,fname){
  const headers=['תאריך','יום','עיר','שם הגן','כתובת','ספק','שעה','קבוצות','סטטוס','סיבה','הערות','תאריך דחייה'];
  const rows=data.map(s=>{
    const g=G(s.g);
    const stMap={ok:'מתקיים',done:'התקיים',can:'בוטל',post:'נדחה',nohap:'לא התקיים'};
    return[fD(s.d),`יום ${dayN(s.d)}`,g.city||'',g.name||'',g.st||'',s.a,fT(s.t),s.grp>1?s.grp:'',stMap[s.st]||s.st,s.cr||'',s.nt||'',s.pd?fD(s.pd):''];
  });
  const bom='\uFEFF';
  const csv=bom+[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download=fname+'.csv';
  a.click();
}

function getAllSup(){
  // Returns base supplier objects (deduped by base name)
  return getAllBaseSups();
}
function getSupActs(name){
  if(!name) return[];
  const base=supBase(name);
  // 1. Saved explicitly in supEx
  const ex=supEx[base]||{};
  if(Array.isArray(ex.acts)&&ex.acts.length) return ex.acts;
  // 2. Auto-derive from schedule data ("חוגות - ניצני רפואה" → "ניצני רפואה")
  const fromSch=new Set();
  SCH.forEach(s=>{ if(supBase(s.a)===base){const a=supAct(s.a);if(a)fromSch.add(a);} });
  SUPBASE.forEach(s=>{ if(supBase(s.name)===base){const a=supAct(s.name);if(a)fromSch.add(a);} });
  return [...fromSch].sort((a,b)=>a.localeCompare(b,'he'));
}
function renderSup(){
  const srch=(document.getElementById('su-srch').value||'').toLowerCase();
  const sortMode=(document.getElementById('su-sort')||{value:'name'}).value;
  let all=getAllSup().filter(s=>!srch||(s.name||'').toLowerCase().includes(srch));
  if(sortMode==='cnt') all=[...all].sort((a,b)=>supBaseCnt(b.name)-supBaseCnt(a.name));
  let h='';
  all.forEach(s=>{
    const base=s.name; // already a base name from getAllBaseSups
    const ex=supBaseEx(base);
    const cnt=supBaseCnt(base);
    const acts=getSupActs(base);
    const phone=ex.ph1||s.phone||'';
    const safeBase=base.replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/'/g,"\\'");
    const cntDone=SCH.filter(sc=>supBase(sc.a)===base&&sc.st==='done').length;
    const cntCan=SCH.filter(sc=>supBase(sc.a)===base&&sc.st==='can').length;
    h+=`<div class="sucard" style="cursor:pointer" onclick="openSupCard('${safeBase}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div style="font-weight:800;color:#1a237e;font-size:.9rem;flex:1">📚 ${base}</div>
        <div style="display:flex;gap:3px;flex-wrap:wrap;align-items:center">
          ${isActSupplier(base)?'<span class="sup-flag sup-flag-act" title="ספק חוגים פעיל">🎨</span>':'<span style="display:inline-block;padding:1px 5px;border-radius:10px;font-size:.64px;background:#fce4ec;color:#c62828;font-weight:700" title="לא מוצג בחוגים">🚫</span>'}
          ${isPurchSupplier(base)?'<span class="sup-flag sup-flag-purch" title="ספק רכש">🛒</span>':''}
          ${ex.entityType?`<span style="display:inline-block;padding:1px 6px;border-radius:10px;font-size:.66rem;background:#f3e5f5;color:#6a1b9a;font-weight:700" title="סוג ישות">🏢 ${ex.entityType}</span>`:''}
          <button class="btn bp bsm" style="font-size:.65rem" onclick="event.stopPropagation();openSupExport('${safeBase}')">📊</button>
          <button class="btn bo bsm" style="font-size:.65rem" onclick="event.stopPropagation();openSupCard('${safeBase}');setTimeout(sucToggleEdit,120)">✏️</button>
        </div>
      </div>
      ${phone?`<div style="color:#2e7d32;font-size:.78rem;font-weight:600;margin-bottom:5px">📞 ${phone}</div>`:''}
      ${acts.length?`<div style="margin-bottom:6px;display:flex;flex-wrap:wrap;gap:3px">
        ${acts.map(a=>`<span style="background:#e3f2fd;color:#1565c0;border-radius:10px;padding:2px 8px;font-size:.71rem;font-weight:600">🎯 ${a}</span>`).join('')}
      </div>`:''}
      ${ex.notes?`<div style="font-size:.68rem;color:#78909c;margin-bottom:4px">📝 ${ex.notes}</div>`:''}
      <div style="display:flex;gap:6px;font-size:.72rem;margin-top:4px">
        <span style="color:#1565c0;font-weight:700">📅 ${cnt} פעילויות</span>
        ${cntDone?`<span style="color:#2e7d32">✔️ ${cntDone}</span>`:''}
        ${cntCan?`<span style="color:#c62828">❌ ${cntCan}</span>`:''}
      </div>
    </div>`;
  });
  document.getElementById('su-body').innerHTML=h||'<p style="color:#999">לא נמצאו</p>';
}
function openSupModal(name){
  editingSup=name||null;
  (document.getElementById('sum-title')||{}).textContent =name?'✏️ עריכת ספק':'➕ הוסף ספק';
  const s=name?SUPBASE.find(x=>x.name===name)||{}:{};
  const ex=name?supEx[name]||{}:{};
  const nameInput=document.getElementById('su-name');
  nameInput.value=name||'';
  nameInput.disabled=false; // always allow rename
  nameInput.dataset.orig=name||'';
  const warnEl=document.getElementById('su-name-warn');
  if(warnEl) warnEl.style.display='none';
  nameInput.oninput=()=>{
    const orig=nameInput.dataset.orig;
    if(warnEl) warnEl.style.display=(orig&&nameInput.value!==orig)?'block':'none';
  };
  document.getElementById('su-ph1').value=ex.ph1||s.phone||'';
  document.getElementById('su-ph2').value=ex.ph2||'';
  document.getElementById('su-gov1').value=ex.g1||'';
  document.getElementById('su-gov2').value=ex.g2||'';
  document.getElementById('su-notes').value=ex.notes||'';
  // supplier type flags
  const suIsAct = document.getElementById('su-is-act');
  const suIsPurch = document.getElementById('su-is-purch');
  if(suIsAct) suIsAct.checked = ex.isAct !== false; // default true for backward compat
  if(suIsPurch) suIsPurch.checked = !!ex.isPurch;
  const suEntityType = document.getElementById('su-entity-type');
  if(suEntityType) suEntityType.value = ex.entityType||'';
  renderSupActsList(name);
  document.getElementById('su-act-new').value='';
  document.getElementById('sum').classList.add('open');
}
function renderSupActsList(name){
  const acts=name?getSupActs(name):[];
  const el=document.getElementById('su-acts-list');
  if(!el) return;
  if(!acts.length){el.innerHTML='<p style="color:#999;font-size:.75rem">אין פעילויות מוגדרות</p>';return;}
  el.innerHTML=acts.map((a,i)=>`
    <div style="display:flex;gap:6px;align-items:center;padding:3px 0;border-bottom:1px solid #f0f0f0">
      <span style="flex:1;font-size:.8rem">🎯 ${a}</span>
      <button class="btn br bsm" style="font-size:.65rem;padding:1px 5px" onclick="removeSupAct(${i})">✕</button>
    </div>`).join('');
}
function addSupAct(){
  const inp=document.getElementById('su-act-new');
  const val=inp.value.trim();
  if(!val) return;
  const name=document.getElementById('su-name').dataset.orig||document.getElementById('su-name').value;
  if(!supEx[name]) supEx[name]={};
  if(!Array.isArray(supEx[name].acts)) supEx[name].acts=getSupActs(name);
  if(!supEx[name].acts.includes(val)) supEx[name].acts.push(val);
  inp.value='';
  renderSupActsList(name);
}
function removeSupAct(idx){
  const name=document.getElementById('su-name').dataset.orig||document.getElementById('su-name').value;
  const acts=getSupActs(name);
  acts.splice(idx,1);
  if(!supEx[name]) supEx[name]={};
  supEx[name].acts=acts;
  renderSupActsList(name);
}
function saveSup(){
  const nameEl=document.getElementById('su-name');
  const name=nameEl.value.trim();
  const origName=nameEl.dataset.orig;
  if(!name){alert('יש להזין שם');return;}
  if(origName&&origName!==name){
    if(!confirm(`לשנות את שם הספק מ-"${origName}" ל-"${name}"?
כל השיבוצים יעודכנו אוטומטית.`)) return;
    SCH.forEach(s=>{if(s.a===origName)s.a=name;});
    if(supEx[origName]) supEx[name]={...supEx[origName]};
    delete supEx[origName];
    if(supEx['__c']) supEx['__c']=supEx['__c'].map(s=>s.name===origName?{...s,name}:s);
  }
  const existActs=Array.isArray((supEx[name]||{}).acts)?(supEx[name].acts):getSupActs(name);
  supEx[name]={
    ...(supEx[name]||{}),
    ph1:document.getElementById('su-ph1').value.trim(),
    ph2:document.getElementById('su-ph2').value.trim(),
    g1:document.getElementById('su-gov1').value.trim(),
    g2:document.getElementById('su-gov2').value.trim(),
    notes:document.getElementById('su-notes').value.trim(),
    acts:existActs,
    isAct: document.getElementById('su-is-act')?.checked !== false,
    isPurch: !!document.getElementById('su-is-purch')?.checked,
    entityType: document.getElementById('su-entity-type')?.value||''
  };
  if(!origName&&!SUPBASE.find(s=>s.name===name)){
    if(!supEx['__c']) supEx['__c']=[];
    if(!supEx['__c'].find(s=>s.name===name)) supEx['__c'].push({id:Date.now(),name,phone:supEx[name].ph1});
  }
  save();CM('sum');refresh();
  if(_appMode==='purch') { try{ renderPurchSuppliers(); }catch(e){} }
  ['dash-sup','cal-sup','s-sup','ns-sup'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const cur=el.value;
    el.innerHTML='<option value="">כל הספקים</option>';
    getAllSup().forEach(s=>el.innerHTML+=`<option value='${s.name}'>${s.name}</option>`);
    el.value=cur;
  });
}
function openMerge(){
  const all=getAllSup();
  const mm=document.getElementById('mrg-main');
  mm.innerHTML='<option value="">בחר ספק ראשי...</option>';
  all.forEach(s=>mm.innerHTML+=`<option value="${s.name}">${s.name}</option>`);
  document.getElementById('mrg-list').innerHTML=all.map(s=>`<label style="display:flex;gap:6px;padding:4px;cursor:pointer;align-items:center"><input type="checkbox" value="${s.name}"><span>${s.name} <span style="color:#999;font-size:.7rem">(${SCH.filter(sc=>sc.a===s.name).length})</span></span></label>`).join('');
  document.getElementById('mrgm').classList.add('open');
}
function doMerge(){
  const main=document.getElementById('mrg-main').value;
  if(!main){alert('בחר ספק ראשי');return;}
  const toMrg=[...document.querySelectorAll('#mrg-list input[type=checkbox]:checked')].map(c=>c.value).filter(n=>n!==main);
  if(!toMrg.length){alert('בחר ספקים למיזוג');return;}
  if(!confirm(`לאחד ${toMrg.length} ספקים אל "${main}"?`)) return;
  let changed=0;
  // Track merged-away base names so they're hidden from all lists (SUPBASE is hardcoded)
  const mergedAway = new Set(supEx['__merged_away']||[]);
  toMrg.forEach(old=>{
    // Replace in schedules — match by base name, preserve activity suffix
    SCH.forEach(s=>{
      if(supBase(s.a)===old){
        const act=supAct(s.a);
        s.a = act ? `${main} - ${act}` : main;
        changed++;
      }
    });
    // Merge supEx data into main
    const ex=supEx[old]||{};
    const mex=supEx[main]||{};
    if(!mex.ph1&&ex.ph1) mex.ph1=ex.ph1;
    if(!mex.ph2&&ex.ph2) mex.ph2=ex.ph2;
    if(!mex.notes&&ex.notes) mex.notes=ex.notes;
    if(!mex.email&&ex.email) mex.email=ex.email;
    if(Array.isArray(ex.acts)){
      mex.acts=[...new Set([...(mex.acts||[]),...ex.acts])];
    }
    supEx[main]={...mex};
    // Remove old from supEx (all variants)
    delete supEx[old];
    Object.keys(supEx).forEach(k=>{if(k!=='__merged_away'&&supBase(k)===old) delete supEx[k];});
    // Remove from custom list
    if(supEx['__c']) supEx['__c']=supEx['__c'].filter(s=>s.name!==old&&supBase(s.name)!==old);
    // Mark as merged-away so it's hidden even from hardcoded SUPBASE
    mergedAway.add(old);
  });
  supEx['__merged_away']=[...mergedAway];
  save();CM('mrgm');refresh();
  showNotice(`✅ אוחדו ${toMrg.length} ספקים → "${main}" — עודכנו ${changed} שיבוצים`);
}

let _GARDENS_EXTRA=[]; // user-added gardens stored in localStorage
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
function openSupCard(name){
  _sucName=supBase(name); // normalize to base name
  document.getElementById('suc-edit-panel').style.display='none';
  document.getElementById('suc-view').style.display='block';
  sucRefreshInfo();
  const now=new Date();
  const sfrom=document.getElementById('suc-from');
  const sto=document.getElementById('suc-to');
  if(!sfrom.value) sfrom.value=d2s(new Date(now.getFullYear(),now.getMonth(),1));
  if(!sto.value) sto.value=d2s(new Date(now.getFullYear(),now.getMonth()+1,0));
  document.getElementById('suc-st').value='';
  sucRefreshActFilt();
  renderSupCard();
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
  (document.getElementById('suc-sub')||{}).textContent =`${cnt} פעילויות · ${acts2.length} סוגים`;
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
      ${ex.g1?`<div><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">🏛️ ח.פ. / מס' ספק</div><div style="font-weight:700">${ex.g1}</div></div>`:'<div></div>'}
      <div style="grid-column:1/-1">
        <div style="color:#546e7a;font-size:.69rem;margin-bottom:4px">🎯 סוגי פעילויות</div>
        ${acts.length
          ?acts.map(a=>`<span style="background:#e3f2fd;color:#1565c0;border-radius:12px;padding:2px 9px;font-size:.76rem;font-weight:600;margin-left:4px;margin-bottom:3px;display:inline-block">${a}</span>`).join('')
          :'<span style="color:#999;font-size:.76rem">לא הוגדרו פעילויות — לחץ ✏️ ערוך להוספה</span>'
        }
      </div>
      ${ex.notes?`<div style="grid-column:1/-1"><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">📝 הערות</div><div>${ex.notes}</div></div>`:''}
    </div>`;
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
  document.getElementById('suc-edit-ph2').value=ex.ph2||'';
  document.getElementById('suc-edit-g1').value=ex.g1||'';
  document.getElementById('suc-edit-notes').value=ex.notes||'';
  // supplier type flags
  const editIsAct=document.getElementById('suc-edit-is-act');
  const editIsPurch=document.getElementById('suc-edit-is-purch');
  if(editIsAct) editIsAct.checked = ex.isAct !== false;
  if(editIsPurch) editIsPurch.checked = !!ex.isPurch;
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
  const acts=[...getSupActs(_sucName)]; acts.splice(idx,1);
  if(!supEx[_sucName]) supEx[_sucName]={};
  supEx[_sucName].acts=acts; sucRefreshActsList(); save();
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
  supEx[_sucName].isAct = document.getElementById('suc-edit-is-act')?.checked !== false;
  supEx[_sucName].isPurch = !!document.getElementById('suc-edit-is-purch')?.checked;
  const actTags=document.querySelectorAll('#suc-acts-list .suc-act-tag');
  const savedActs=[...actTags].map(el=>el.dataset.act).filter(Boolean);
  if(savedActs.length) supEx[_sucName].acts=savedActs;
  save(); refresh();
  if(_appMode==='purch') renderPurchSuppliers();
  ['dash-sup','cal-sup','s-sup','ns-sup','es-sup'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    const cur=el.value;
    el.innerHTML=id==='es-sup'?'<option value="">-- ללא שינוי --</option>':'<option value="">כל הספקים</option>';
    getAllSup().forEach(s=>el.innerHTML+=`<option value='${s.name}'>${s.name}</option>`);
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
function renderSupCard(){
  if(!_sucName) return;
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
  const cntCan=evs.filter(s=>s.st==='can').length;
  const cntPost=evs.filter(s=>s.st==='post').length;
  const cntNohap=evs.filter(s=>s.st==='nohap').length;
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
    <th>תאריך</th><th>יום</th><th>עיר</th><th>גן</th><th>פעילות</th><th>שעה</th><th>קב'</th><th>סטטוס</th><th>הערות</th><th></th>
  </tr></thead><tbody>`;
  evs.forEach(s=>{
    const g=G(s.g);
    h+=`<tr class="${stClass(s)}">
      <td>${fD(s.d)}</td>
      <td>יום ${dayN(s.d)}</td>
      <td>${g.city||''}</td>
      <td><div style="font-weight:700">${g.name}</div>${g.st?`<div style="font-size:.67rem;color:#78909c">${g.st}</div>`:''}</td>
      <td><span style="background:#e3f2fd;color:#1565c0;border-radius:10px;padding:1px 7px;font-size:.73rem;font-weight:600">${s.act||'—'}</span></td>
      <td>${fT(s.t)}</td>
      <td style="text-align:center">${s.grp>1?s.grp:''}</td>
      <td>${stLabel(s)}</td>
      <td style="max-width:100px;font-size:.71rem">${s.nt||''}</td>
      <td><button class="btn bo bsm" style="font-size:.65rem" onclick="openSP(${s.id})">✏️</button></td>
    </tr>`;
  });
  h+='</tbody></table></div>';
  el.innerHTML=h;
}
function openSupExportFromCard(){
  if(!_sucName) return;
  CM('sucard-m');
  openSupExport(_sucName);
}

function goToTodayCal(){
  ST('cal');
  setTimeout(()=>{
    document.getElementById('cal-pair').value='';
    document.getElementById('cal-g1').value='';
    document.getElementById('cal-g2').value='';
    document.getElementById('cal-g3').value='';
    document.getElementById('cal-city').value='';
    document.getElementById('cal-cls').value='';
    calD=new Date();calV='day';
    setView('day');renderCal();
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
function getSnapshots(){try{return JSON.parse(localStorage.getItem('ganv5_snaps')||'[]');}catch{return [];}}
function saveSnapshots(snaps){try{localStorage.setItem('ganv5_snaps',JSON.stringify(snaps));}catch(e){}}
function createSnapshot(label){
  const snaps=getSnapshots();
  const data=localStorage.getItem('ganv5')||'{}';
  snaps.unshift({ts:Date.now(),label:label||'ידני',size:data.length,data});
  if(snaps.length>MAX_SNAPSHOTS) snaps.length=MAX_SNAPSHOTS;
  saveSnapshots(snaps);
  const quiet=label==='שעתי'||label==='סגירה';
  if(!quiet) showCopyToast('✅ גרסה נשמרה: '+new Date().toLocaleTimeString('he-IL'));
  if(document.getElementById('backup-list')&&document.getElementById('backup-list').innerHTML) renderBackupList();
}
function openBackup(){renderBackupList();document.getElementById('backupm').classList.add('open');}
function renderBackupList(){
  const snaps=getSnapshots();
  const el=document.getElementById('backup-list');if(!el)return;
  const stored=localStorage.getItem('ganv5')||'';
  (document.getElementById('backup-storage-info')||{}).textContent =
    'נתונים: '+(stored.length/1024).toFixed(1)+'KB | גרסאות: '+snaps.length+'/'+MAX_SNAPSHOTS;
  if(!snaps.length){el.innerHTML='<p style="color:#999">אין גרסאות שמורות עדיין</p>';return;}
  el.innerHTML='<div style="display:flex;flex-direction:column;gap:6px">'+
    snaps.map((s,i)=>`<div style="background:#f5f7ff;border-radius:7px;padding:8px 11px;display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-weight:700;font-size:.82rem">${s.label} <span style="font-size:.69rem;color:#78909c">${new Date(s.ts).toLocaleString('he-IL')}</span></div>
      <div style="font-size:.71rem;color:#546e7a">${(s.size/1024).toFixed(1)}KB</div></div>
      <div style="display:flex;gap:5px">
        <button class="btn bp bsm" onclick="restoreSnapshot(${i})">🔄 שחזר</button>
        <button class="btn br bsm" onclick="deleteSnapshot(${i})">🗑️</button>
      </div></div>`).join('')+'</div>';
}
function restoreSnapshot(i){
  const snaps=getSnapshots();const snap=snaps[i];if(!snap)return;
  if(!confirm('לשחזר לגרסה מ-'+new Date(snap.ts).toLocaleString('he-IL')+'?\nהנתונים הנוכחיים יישמרו אוטומטית לפני שחזור.')) return;
  createSnapshot('לפני שחזור');
  localStorage.setItem('ganv5',snap.data);
  showCopyToast('✅ שוחזר! טוען מחדש...');
  setTimeout(()=>location.reload(),1200);
}
function deleteSnapshot(i){const snaps=getSnapshots();snaps.splice(i,1);saveSnapshots(snaps);renderBackupList();}
function updateAppFromHTML(input){
  const file=input.files[0]; if(!file) return;
  if(!confirm('האפליקציה תתעדכן לגרסה החדשה. הנתונים הקיימים יישמרו. להמשיך?')) return;
  // Save current data first
  const currentData=localStorage.getItem('ganv5');
  const currentCfg=localStorage.getItem('autoBackupCfg');
  const r=new FileReader();
  r.onload=e=>{
    try{
      const newHTML=e.target.result;
      if(!newHTML.includes('ganv5')&&!newHTML.includes('מנהל גנים')) throw new Error('קובץ לא נראה כאפליקציה תקינה');
      // Write new HTML to a blob and navigate
      const blob=new Blob([newHTML],{type:'text/html'});
      const url=URL.createObjectURL(blob);
      // Store data to restore after load
      sessionStorage.setItem('_restore_data',currentData||'');
      sessionStorage.setItem('_restore_cfg',currentCfg||'');
      sessionStorage.setItem('_pending_restore','1');
      window.location.href=url;
    }catch(err){alert('שגיאה: '+err.message);}
  };
  r.readAsText(file,'utf-8');
}
// On load: restore data if flagged
(function(){
  if(sessionStorage.getItem('_pending_restore')==='1'){
    sessionStorage.removeItem('_pending_restore');
    const d=sessionStorage.getItem('_restore_data');
    const c=sessionStorage.getItem('_restore_cfg');
    sessionStorage.removeItem('_restore_data');
    sessionStorage.removeItem('_restore_cfg');
    if(d) localStorage.setItem('ganv5',d);
    if(c) localStorage.setItem('autoBackupCfg',c);
    setTimeout(()=>showToast('✅ האפליקציה עודכנה! הנתונים שוחזרו.'),1500);
  }
})();

function importBackup(input){
  const file=input.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(!data.ch&&!data.pairs) throw new Error('פורמט לא תקין');
      createSnapshot('לפני ייבוא');
      const sd={ch:data.ch||[],pairs:data.pairs||[],supEx:data.supEx||{},
        clusters:data.clusters||{},holidays:data.holidays||[],pairBreaks:data.pairBreaks||{},
        invoices:data.invoices||[]};
      const json=JSON.stringify(sd);
      localStorage.setItem('ganv5',json);
      // Init meta if missing, write to year key
      let meta=JSON.parse(localStorage.getItem('ganv5_meta')||'null');
      if(!meta){
        const yr={key:'תשפו'};
        meta={currentYear:yr.key,years:[yr.key]};
        localStorage.setItem('ganv5_meta',JSON.stringify(meta));
      }
      localStorage.setItem('ganv5_y_'+meta.currentYear,json);
      showCopyToast('✅ ייבוא הצליח! טוען מחדש...');
      setTimeout(()=>location.reload(),1400);
    }catch(err){alert('שגיאה בקובץ: '+err.message);}
  };
  r.readAsText(file);
}
setInterval(()=>createSnapshot('שעתי'),60*60*1000);
window.addEventListener('beforeunload',()=>createSnapshot('סגירה'));

// ── Auto-backup scheduler ──────────────────────────────
let _autoBackupTimer=null;
function loadAutoBackupSettings(){
  return JSON.parse(localStorage.getItem('autoBackupCfg')||'null');
}
function saveAutoBackupSettings(cfg){
  localStorage.setItem('autoBackupCfg',JSON.stringify(cfg));
}
function startAutoBackup(){
  if(_autoBackupTimer) clearInterval(_autoBackupTimer);
  const cfg=loadAutoBackupSettings();
  if(!cfg||!cfg.enabled) return;
  const ms=cfg.freq==='daily'?24*60*60*1000:7*24*60*60*1000;
  _autoBackupTimer=setInterval(()=>{ triggerAutoBackup(); },ms);
  // Check if overdue
  if(cfg.lastBackup){
    const diff=Date.now()-new Date(cfg.lastBackup).getTime();
    if(diff>ms) triggerAutoBackup();
  }
}
function triggerAutoBackup(){
  const cfg=loadAutoBackupSettings()||{};
  exportFullBackup();
  cfg.lastBackup=new Date().toISOString();
  saveAutoBackupSettings(cfg);
  showToast('💾 גיבוי אוטומטי הורד');
}
function openAutoBackupSettings(){
  const cfg=loadAutoBackupSettings()||{enabled:false,freq:'daily',hour:'08:00'};
  document.getElementById('ab-enabled').checked=cfg.enabled||false;
  document.getElementById('ab-freq').value=cfg.freq||'daily';
  document.getElementById('ab-hour').value=cfg.hour||'08:00';
  (document.getElementById('ab-last')||{}).textContent =cfg.lastBackup?'גיבוי אחרון: '+new Date(cfg.lastBackup).toLocaleString('he-IL'):'לא בוצע גיבוי עדיין';
  document.getElementById('autobackup-m').classList.add('open');
}
function saveAutoBackupCfg(){
  const cfg={
    enabled:document.getElementById('ab-enabled').checked,
    freq:document.getElementById('ab-freq').value,
    hour:document.getElementById('ab-hour').value,
    lastBackup:(loadAutoBackupSettings()||{}).lastBackup||null
  };
  saveAutoBackupSettings(cfg);
  startAutoBackup();
  CM('autobackup-m');
  showToast(cfg.enabled?'✅ גיבוי אוטומטי הופעל':'⏸️ גיבוי אוטומטי כובה');
}
// Start on load
setTimeout(startAutoBackup,3000);

function openInfoModal(){
  const used=JSON.stringify(localStorage.getItem('ganv5')||'').length;
  const kb=(used/1024).toFixed(1);
  document.getElementById('info-storage-stats').innerHTML=
    `<div>נתונים שמורים: <b>${kb} KB</b> / ~5,000 KB אחסון מקסימלי</div>
     <div>גנים: ${GARDENS.length} | פעילויות: ${SCH.length.toLocaleString()} | זוגות: ${pairs.length}</div>
     <div>אשכולות: ${Object.keys(clusters||{}).length} | ספקים: ${getAllSup().length}</div>`;
  document.getElementById('infom').classList.add('open');
}
function exportFullBackup(){
  // Use live in-memory data — most reliable source of truth
  const data={
    version:2,
    exported:new Date().toISOString(),
    ch:SCH.map(s=>({id:s.id,g:s.g,d:s.d,a:s.a,t:s.t,p:s.p,n:s.n,st:s.st,cr:s.cr,cn:s.cn,nt:s.nt,pd:s.pd,pt:s.pt,grp:s.grp,act:s.act||''})),
    pairs,supEx,clusters,holidays,pairBreaks,invoices:INVOICES
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const now=new Date();
  const timeStr=now.getHours().toString().padStart(2,'0')+'-'+now.getMinutes().toString().padStart(2,'0');
  a.href=url;a.download='גיבוי_מנהל_גנים_'+td()+'_'+timeStr+'.json';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
}
function goToCancelled(){
  ST('sched');
  setTimeout(()=>{
    ['s-city','s-cls','s-sup','s-th','s-tt','s-from','s-to','s-srch'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('s-st').value='can';
    sPage=1;renderSched();
  },50);
}
function goToPostponed(){
  ST('sched');
  setTimeout(()=>{
    ['s-city','s-cls','s-sup','s-th','s-tt','s-from','s-to','s-srch'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('s-st').value='post';
    sPage=1;renderSched();
  },50);
}
function goToNoHap(){
  ST('sched');
  setTimeout(()=>{
    ['s-city','s-cls','s-sup','s-th','s-tt','s-from','s-to','s-srch'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('s-st').value='nohap';
    sPage=1;renderSched();
  },50);
}
function CM(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.modal').forEach(m=>{m.onclick=e=>{if(e.target===m) m.classList.remove('open');};});

let _nohapQId=null;
function openNohapQ(id){
  _nohapQId=id;
  const s=SCH.find(x=>x.id===id); if(!s) return;
  const g=G(s.g);
  document.getElementById('nohapq-info').innerHTML=
    `<b>${g.name}</b> · ${g.city} · ${s.a}${s.act?' · '+s.act:''}<br>📅 ${fD(s.d)} ${s.t?'⏰ '+fT(s.t):''}`;
  document.getElementById('nohapq-reason').value='';
  document.querySelectorAll('.nohap-reason-btn').forEach(b=>b.classList.remove('sel'));

  // Build scope options — this garden + pair partners
  const pair=gardenPair(s.g);
  const scopeWrap=document.getElementById('nohapq-scope-wrap');
  const scopeBtns=document.getElementById('nohapq-scope-btns');
  if(pair){
    const partners=pair.ids.filter(gid=>gid!==s.g).map(gid=>G(gid)).filter(x=>x.id);
    const partnerEvs=partners.map(pg=>SCH.find(ps=>ps.g===pg.id&&ps.d===s.d&&ps.st!=='can')).filter(Boolean);
    scopeBtns.innerHTML='';
    // Option: this garden only
    scopeBtns.innerHTML+=`<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.8rem;padding:4px 6px;border-radius:5px;border:1.5px solid #e0e0e0;background:#fff">
      <input type="radio" name="nohapq-scope" value="solo" checked style="accent-color:#e91e63">
      <span>🏫 <b>${g.name}</b> בלבד</span>
    </label>`;
    // Option: full pair
    const allNames=[g,...partners].map(x=>x.name).join(' + ');
    scopeBtns.innerHTML+=`<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.8rem;padding:4px 6px;border-radius:5px;border:1.5px solid #e0e0e0;background:#fff">
      <input type="radio" name="nohapq-scope" value="pair" style="accent-color:#e91e63">
      <span>🔗 כל הזוג — <b>${allNames}</b></span>
    </label>`;
    scopeWrap.style.display='block';
  } else {
    scopeWrap.style.display='none';
  }
  document.getElementById('nohapqm').classList.add('open');
}
function selNohapReason(btn,reason){
  document.querySelectorAll('.nohap-reason-btn').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
  const inp=document.getElementById('nohapq-reason');
  if(reason==='אחר') inp.focus();
  else inp.placeholder=reason;
}
function saveNohapQ(){
  const sel=document.querySelector('.nohap-reason-btn.sel');
  const mainReason=sel?sel.textContent.replace(/^\S+ /,'').trim():'';
  const extra=document.getElementById('nohapq-reason').value.trim();
  const fullReason=[mainReason,extra].filter(Boolean).join(' — ');
  if(!mainReason&&!extra){alert('יש לבחור סיבה');return;}
  const scopeEl=document.querySelector('input[name="nohapq-scope"]:checked');
  const forPair=scopeEl&&scopeEl.value==='pair';

  // Read orig BEFORE modifying SCH
  const origEv2=SCH.find(s=>s.id===_nohapQId);
  const origG2=origEv2?origEv2.g:null;
  const origD2=origEv2?origEv2.d:null;

  const markNohap=(evId)=>{
    const i=SCH.findIndex(s=>s.id===evId); if(i<0) return;
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
    console.log('nohap pair: origG='+origG2n+' origD='+origD2+' pair='+JSON.stringify(pair2));
    if(pair2){
      pair2.ids
        .map(id=>parseInt(id))
        .filter(gid=>gid!==origG2n)
        .forEach(gid=>{
          const partnerEv=SCH.find(ps=>parseInt(ps.g)===gid&&ps.d===origD2&&ps.st!=='can');
          console.log('nohap partner gid='+gid+' found='+!!(partnerEv)+(partnerEv?' st='+partnerEv.st:''));
          if(partnerEv){
            markNohap(partnerEv.id);
          } else {
            // No scheduled event for partner on this date — create one
            const origEv3=SCH.find(s=>s.id===_nohapQId);
            const newId=Date.now()+gid;
            SCH.push({
              id:newId, g:gid, d:origD2,
              a:origEv3?origEv3.a:'', act:origEv3?origEv3.act:'',
              t:origEv3?origEv3.t:'', grp:origEv3?origEv3.grp:1,
              st:'nohap', cr:fullReason,
              nt:'⚠️ לא התקיים: '+fullReason+' (נוצר אוטומטית עם הזוג)',
              sup:origEv3?origEv3.sup:''
            });
            console.log('nohap: created new event for partner gid='+gid);
          }
        });
    } else {
      console.warn('nohap: gardenPair not found for gid='+origG2n+', pairs count='+pairs.length);
    }
  }
  saveAndRefresh('nohapqm');
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
function openMonthlyExport(){
  // Set defaults: current month to next month
  const now=new Date();
  const y=now.getFullYear(), m=String(now.getMonth()+1).padStart(2,'0');
  document.getElementById('exp-from').value=`${y}-${m}`;
  document.getElementById('exp-to').value=`${y}-${m}`;
  // Populate city dropdown
  const citySel=document.getElementById('exp-city');
  citySel.innerHTML='<option value="">-- כל הערים --</option>';
  cities().forEach(c=>{ const o=document.createElement('option');o.value=c;o.textContent=c;citySel.appendChild(o); });
  // Populate manager dropdown
  const mgrSel=document.getElementById('exp-mgr');
  mgrSel.innerHTML='<option value="">-- כל הרכזים --</option>';
  Object.values(managers).forEach(m=>{ const o=document.createElement('option');o.value=m.id;o.textContent=m.name;mgrSel.appendChild(o); });
  document.getElementById('export-m').classList.add('open');
}

function expModeChg(){
  const mode=document.querySelector('input[name="exp-mode"]:checked').value;
  document.getElementById('exp-city-wrap').style.display=mode==='city'?'block':'none';
  document.getElementById('exp-mgr-wrap').style.display=mode==='manager'?'block':'none';
}

function doMonthlyExport(){
  const fromM=document.getElementById('exp-from').value;
  const toM=document.getElementById('exp-to').value;
  if(!fromM||!toM){alert('יש לבחור תקופה');return;}
  const mode=document.querySelector('input[name="exp-mode"]:checked').value;
  const cityFilter=document.getElementById('exp-city').value;
  const mgrFilter=document.getElementById('exp-mgr').value;
  const splitBy=document.getElementById('exp-split').value;

  // Build date range
  const [fy,fm]=fromM.split('-').map(Number);
  const [ty,tm]=toM.split('-').map(Number);
  const fromDate=`${fy}-${String(fm).padStart(2,'0')}-01`;
  const toDate=d2s(new Date(ty,tm,0)); // last day of toM

  // Filter events
  let evs=SCH.filter(s=>s.d>=fromDate&&s.d<=toDate&&s.st!=='can');

  // Filter gardens
  let gList=GARDENS.concat(_GARDENS_EXTRA||[]);
  if(mode==='city'&&cityFilter) gList=gList.filter(g=>g.city===cityFilter);
  if(mode==='manager'&&mgrFilter){
    const mgrObj=managers[mgrFilter];
    if(mgrObj&&mgrObj.gardenIds) gList=gList.filter(g=>mgrObj.gardenIds.includes(g.id));
  }

  // Build per-city groups
  const byCity={};
  gList.forEach(g=>{
    if(!byCity[g.city]) byCity[g.city]=[];
    byCity[g.city].push(g);
  });

  let filesExported=0;
  if(splitBy==='garden'){
    gList.forEach(g=>{
      const gEvs=evs.filter(s=>s.g===g.id);
      if(!gEvs.length) return;
      const wb=buildGardenWB(g, gEvs, fromDate, toDate);
      downloadWB(wb, `לוח_חוגים_${g.name}_${fromM}.xlsx`);
      filesExported++;
    });
  } else {
    Object.entries(byCity).forEach(([city,gardens])=>{
      const cityGardens=gardens.filter(g=>evs.some(s=>s.g===g.id));
      if(!cityGardens.length) return;
      const wb=buildCityWB(city, cityGardens, evs, fromDate, toDate);
      downloadWB(wb, `לוח_חוגים_${city}_${fromM}.xlsx`);
      filesExported++;
    });
  }
  CM('export-m');
  if(filesExported>0){
    showToast(`📊 ${filesExported} קבצי Excel נוצרו בהצלחה!`);
  } else {
    alert('⚠️ לא נמצאו פעילויות בטווח התאריכים שנבחר. אנא בדוק את הפילטרים.');
  }
}

function buildCityWB(city, gardens, allEvs, fromDate, toDate){
  // Build workbook with one sheet per garden
  const wb={sheets:[], city};
  gardens.forEach(g=>{
    const gEvs=allEvs.filter(s=>s.g===g.id);
    wb.sheets.push({garden:g, evs:gEvs});
  });
  return wb;
}

function buildGardenWB(garden, evs, fromDate, toDate){
  return {sheets:[{garden, evs}], city:garden.city};
}

function downloadWB(wb, filename){
  // Safe filename — strip chars that break downloads
  const safeFile = filename.replace(/[^\u0590-\u05FF\w\-_.]/gu, '_');
  if(typeof XLSX!=='undefined'){
    try{
      const workbook=XLSX.utils.book_new();
      wb.sheets.forEach(({garden,evs})=>{
        const sheetData=buildSheetData(garden, evs);
        const ws=XLSX.utils.aoa_to_sheet(sheetData.rows);
        ws['!cols']=[{wch:14},{wch:6},{wch:12},{wch:10},{wch:12},{wch:28},{wch:14},{wch:5},{wch:8}];
        XLSX.utils.book_append_sheet(workbook, ws, garden.name.slice(0,28));
      });
      XLSX.writeFile(workbook, safeFile);
      return;
    }catch(e){ console.warn('XLSX error, falling back to CSV:',e); }
  }
  // Fallback: CSV — must append anchor to DOM for download to trigger
  const csvParts=[];
  wb.sheets.forEach(({garden,evs})=>{
    csvParts.push(`=== ${garden.name} ===`);
    const {rows}=buildSheetData(garden,evs);
    rows.forEach(r=>csvParts.push(r.map(c=>c==null?'':String(c).replace(/,/g,'،')).join(',')));
    csvParts.push('');
  });
  const blob=new Blob(['\uFEFF'+csvParts.join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=safeFile.replace('.xlsx','.csv');
  a.style.display='none';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 1000);
}

function buildSheetData(garden, evs){
  const gEx=supEx['g_'+garden.id]||{};
  const gardenName=gEx.name||garden.name;
  const gardenCity=garden.city||'';
  const gardenAddr=gEx.st||garden.st||'';
  const gardenPhone=gEx.coph||'';

  const rows=[];
  // Row 1: Title
  rows.push(['לוז חוגים',null,null,null,null,null,null,null,null]);
  // Row 2: Garden name + city
  rows.push([` צהרון: ${gardenName}`,null,null,null,null,` עיר : ${gardenCity}`,null,null,null]);
  // Row 3: Headers
  rows.push(['שם הצהרון','גיל','תאריך','יום',"חוג/הפעלה",'שם החוג','טלפון',"קב'",'שעה']);

  // Build all dates in range covered by this garden's events
  if(!evs.length){
    rows.push([null,null,null,null,'אין פעילויות',null,null,null,null]);
    return {rows};
  }

  // Group events by date
  const byDate={};
  evs.forEach(s=>{
    if(!byDate[s.d]) byDate[s.d]=[];
    byDate[s.d].push(s);
  });

  // Find date range from events
  const dates=Object.keys(byDate).sort();
  if(!dates.length) return {rows};
  const firstD=dates[0], lastD=dates[dates.length-1];
  // Generate all dates in range
  const allDates=[];
  let cur=new Date(firstD.replace(/-/g,'/'));
  const end=new Date(lastD.replace(/-/g,'/'));
  while(cur<=end){ allDates.push(d2s(cur)); cur.setDate(cur.getDate()+1); }

  const dayNames=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

  // Group into months, each month a separate block
  const months={};
  allDates.forEach(ds=>{
    const [y,m]=ds.split('-');
    const mk=`${y}-${m}`;
    if(!months[mk]) months[mk]=[];
    months[mk].push(ds);
  });

  let firstMonth=true;
  Object.entries(months).sort().forEach(([mk, mDates])=>{
    // Month separator
    if(!firstMonth) rows.push([null,null,null,null,null,null,null,null,null]);
    firstMonth=false;
    const [y,m]=mk.split('-').map(Number);
    const monthNames=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
    rows.push([null,null,null,`${monthNames[m-1]} ${y}`,null,null,null,null,null]);

    mDates.forEach(ds=>{
      const dayEvs=(byDate[ds]||[]).sort((a,b)=>(a.t||'').localeCompare(b.t||''));
      const hol=getHolidayInfo(ds);
      const blk=getBlockedInfo(ds);
      const [dy,dm,dd]=ds.split('-').map(Number);
      const dateObj=new Date(dy,dm-1,dd);
      const dayName=`יום\u00a0${dayNames[dateObj.getDay()]}`;
      const dateVal=ds; // store as string YYYY-MM-DD

      if(!dayEvs.length){
        // Empty day or holiday/blocked
        const note=hol?hol.name:blk?`🚫 ${blk.reason}`:'';
        rows.push([null,null,dateVal,dayName,note||null,null,null,null,null]);
      } else {
        dayEvs.forEach((s,i)=>{
          const sup=supBase(s.a);
          const act=s.act||supAct(s.a)||'חוג';
          const phone=s.p||'';
          const grp=s.grp||1;
          const timeStr=s.t?s.t.slice(0,5):'';
          rows.push([
            i===0?gardenName:null,  // שם הצהרון only on first row
            null,                    // גיל
            i===0?dateVal:null,      // תאריך
            i===0?dayName:null,      // יום
            act,                     // חוג/הפעלה
            sup,                     // שם החוג
            phone,                   // טלפון
            grp,                     // קב'
            timeStr                  // שעה
          ]);
        });
      }
    });
  });

  return {rows};
}

// ─── Garden Cell Popup ────────────────────────────────────────
let _gcellGid=null, _gcellDs=null;

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
    blockBtn.textContent='🚫 חסום תאריך לגן זה';
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
  if(mode==='garden'){
    _gcellGid=parseInt(gid); _gcellDs=ds;
    const g=G(_gcellGid);
    const key=`${_gcellGid}_${ds}`;
    const blk=gardenBlocks[key];
    document.getElementById('block-m-title').textContent=`🚫 חסום גן לתאריך`;
    document.getElementById('block-m-subtitle').textContent=`${g.name} · ${fD(ds)} יום ${dayN(ds)}`;
    document.getElementById('block-m-reason').value=blk?blk.reason:'';
    document.getElementById('block-m-note').value=blk?blk.note||'':'';
    document.getElementById('block-m-del').style.display=blk?'inline-flex':'none';
    document.querySelectorAll('.block-reason-btn').forEach(b=>{
      b.classList.toggle('sel', blk&&b.textContent.trim().includes(blk.reason));
    });
  } else {
    // mode === 'date'
    _blockedEditDate=ds;
    const blk=blockedDates[ds];
    document.getElementById('block-m-title').textContent=`🚫 חסום תאריך`;
    document.getElementById('block-m-subtitle').textContent=`📅 ${fD(ds)} — יום ${dayN(ds)}`;
    document.getElementById('block-m-reason').value=blk?blk.reason:'';
    document.getElementById('block-m-note').value=blk?blk.note||'':'';
    document.getElementById('block-m-del').style.display=blk?'inline-flex':'none';
    document.querySelectorAll('.block-reason-btn').forEach(b=>{
      b.classList.toggle('sel', blk&&b.textContent.trim().includes(blk.reason));
    });
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
    saveAndRefresh('block-m'); showToast('🚫 גן נחסם לתאריך זה');
  } else {
    blockedDates[_blockedEditDate]={reason,note,icon};
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
  showToast('✅ כרטיס הגן עודכן');
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
        <div style="font-size:.74rem;font-weight:700;color:#546e7a;margin-bottom:7px">אחראי על ${gs.length} גנים/צהרונים:</div>
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
  if(typeof renderPairs==='function') renderPairs();
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
  if(typeof renderPairs==='function') renderPairs();
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
  txt+=`🏫 גנים באחריותו (${gs.length}):\n`;
  txt+='━━━━━━━━━━━━━━━━━━━━━━\n';
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
  _gardensTab=t;
  document.getElementById('g-tab-gan').classList.toggle('active',t==='gan');
  document.getElementById('g-tab-sch').classList.toggle('active',t==='sch');
  document.getElementById('g-cls').value=t==='gan'?'גנים':'ביה"ס';
  renderGardens();
}
let _gardensTab='gan';
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
  document.querySelectorAll('.mob-nav-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
}

// ─── Data backup / restore ────────────────────────────
function exportData(){
  const data=localStorage.getItem('ganv5')||'{}';
  const snaps=localStorage.getItem('ganv5_snaps')||'[]';
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
        localStorage.setItem('ganv5',JSON.stringify(data));
        if(parsed.snaps) localStorage.setItem('ganv5_snaps',JSON.stringify(parsed.snaps));
        showToast('✅ הנתונים יובאו. טוען מחדש...');
        setTimeout(()=>location.reload(),1200);
      }catch(err){alert('שגיאה בקובץ הגיבוי: '+err.message);}
    };
    reader.readAsText(file);
  };
  inp.click();
}

// Show mobile backup row on small screens
window.addEventListener('resize',()=>{
  const r=document.getElementById('mob-backup-row');
  if(r) r.style.display=window.innerWidth<=768?'flex':'none';
});
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

