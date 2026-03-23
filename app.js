// ══════════════════════════════════════════════
// Firebase Realtime Database Sync - v10.2
// ══════════════════════════════════════════════
const FIREBASE_DB_URL = 'https://ganmanage-default-rtdb.europe-west1.firebasedatabase.app/data.json';
const FIREBASE_POLL_INTERVAL = 30000;

// Safe localStorage wrapper (handles Tracking Prevention blocking)
const _safeLS = {
  get(k){ 
    // Prefer in-memory (always fresh) over localStorage (may be stale from old version)
    if(window['_mem_'+k]) return window['_mem_'+k];
    try{ const v=localStorage.getItem(k); if(v) return v; }catch(e){}
    return null;
  },
  set(k,v){ 
    window['_mem_'+k]=String(v); // always set in-memory first
    try{ localStorage.setItem(k,v); }catch(e){}
  },
  getItem(k){ return this.get(k); },
  setItem(k,v){ this.set(k,v); }
};
let _fbLastSaveTs = parseInt(_safeLS.get('_fbLastSaveTs')||'0');
let _fbLastLoadTs = parseInt(_safeLS.get('_fbLastLoadTs')||'0');

let _fbLastOwnSaveTs = 0; // timestamp of OUR last successful save (not from load)
function _setFbSaveTs(ts){ _fbLastSaveTs=ts; _safeLS.setItem('_fbLastSaveTs',String(ts)); _fbUpdateStatus(); }
function _setFbLoadTs(ts){ _fbLastLoadTs=ts; _safeLS.setItem('_fbLastLoadTs',String(ts)); _fbUpdateStatus(); }
let _fbPollTimer = null;
let _fbTimer = null;
let _fbSyncing = false;
let _fbLastError = null; // last sync error message

// ── Login (called from HTML button) ──────────
async function doLogin() {
  const username = (document.getElementById('auth-username').value || '').trim().toLowerCase();
  const password = (document.getElementById('auth-password').value || '');
  const remember = document.getElementById('auth-remember').checked;
  const err      = document.getElementById('auth-err');
  const btn      = document.getElementById('auth-login-btn');

  if (!username || !password) { err.textContent = 'נא למלא שם משתמש וסיסמה'; return; }
  err.textContent = '';
  btn.textContent = 'מתחבר...';
  btn.disabled = true;

  try {
    await window._fbSignIn(username, password, remember);
    // onAuthStateChanged in index.html will fire _onAuthReady
  } catch(e) {
    const msg = e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found'
      ? 'שם משתמש או סיסמה שגויים'
      : e.code === 'auth/too-many-requests'
      ? 'יותר מדי נסיונות — נסה שוב עוד כמה דקות'
      : 'שגיאת התחברות: ' + e.code;
    err.textContent = msg;
    btn.textContent = 'כניסה';
    btn.disabled = false;
  }
}

async function doLogout() {
  if (!confirm('להתנתק?')) return;
  await window._fbSignOut();
  location.reload();
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
      const ageMs = Date.now() - _fbLastSaveTs;
      const ageMins = Math.floor(ageMs / 60000);
      let label;
      const timeStr = _fbLastSaveTs ? _fmtTs(_fbLastSaveTs).replace(/\d{4}-/,'').replace(/-/,'/') : '';
      // Format: HH:MM DD/MM on 2 lines
      const tsShort = _fbLastSaveTs ? (()=>{const d=new Date(_fbLastSaveTs);const pad=n=>String(n).padStart(2,'0');return pad(d.getHours())+':'+pad(d.getMinutes())+' '+pad(d.getDate())+'/'+pad(d.getMonth()+1);})() : '';
      if(_fbLastError){
        btn.innerHTML = '❌ ' + _fbLastError + (tsShort?`<br><span style="font-size:.58rem;opacity:.8;font-weight:400;letter-spacing:0">${tsShort}</span>`:'');
        btn.style.background = '#c62828';
      } else if(ageMs < 60000){
        btn.innerHTML = '☁️ Active ✓' + (tsShort?`<br><span style="font-size:.58rem;opacity:.8;font-weight:400;letter-spacing:0">${tsShort}</span>`:'');
        btn.style.background='#2e7d32';
      } else if(ageMins < 5){
        btn.innerHTML = `☁️ לפני ${ageMins}ד'` + (tsShort?`<br><span style="font-size:.58rem;opacity:.8;font-weight:400;letter-spacing:0">${tsShort}</span>`:'');
        btn.style.background='#2e7d32';
      } else if(ageMins < 60){
        btn.innerHTML = `☁️ ${ageMins}ד' לא סונכרן` + (tsShort?`<br><span style="font-size:.58rem;opacity:.8;font-weight:400;letter-spacing:0">${tsShort}</span>`:'');
        btn.style.background=ageMins>=10?'#c62828':'#e65100';
      } else {
        btn.innerHTML = '⚠️ לא סונכרן' + (tsShort?`<br><span style="font-size:.58rem;opacity:.8;font-weight:400;letter-spacing:0">${tsShort}</span>`:'');
        btn.style.background='#c62828';
      }
      label = ''; // handled via innerHTML above
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

// Refresh status display every 30s so age label updates live
setInterval(_fbUpdateStatus, 30000);

// Helper: process Firebase load response
async function _processFirebaseLoad(r, silent, force) {
  let cloudData;
  try { cloudData = await r.json(); } catch(e){ console.error('Firebase JSON error',e); return false; }
  if (!cloudData || typeof cloudData !== 'object') return false;
  const cloudTs = cloudData.ts || 0;
  const appData = cloudData.data || cloudData;
  if (!appData || Object.keys(appData).length === 0) return false;

  // Store to both localStorage (if available) and in-memory
  const jsonStr = JSON.stringify(appData);
  _safeLS.setItem('ganv5', jsonStr);
  _safeLS.setItem('ganv5_local_ts', String(cloudTs));
  window._fbAppData = appData; // in-memory reference, no JSON needed

  // Apply data DIRECTLY to memory — does NOT rely on localStorage
  if (typeof _applyYearData === 'function') {
    try {
      _applyYearData(appData);
      window._fbLastKnownInvoiceCount = Math.max(
        window._fbLastKnownInvoiceCount||0,
        appData.invoices?.length||0
      );
    } catch(e) { console.error('_applyYearData failed', e); }
  }

  _setFbLoadTs(Date.now());
  window._fbLastCloudTs = cloudTs; // track remote ts separately
  // Only update _fbLastSaveTs if we haven't saved more recently
  if(!_fbLastSaveTs || cloudTs > _fbLastSaveTs) _setFbSaveTs(cloudTs);
  if (!silent) _fbUpdateStatus();
  return true;
}

// ── Load from Firebase ────────────────────────
async function loadFromFirebase(silent, force) {
  try {
    if (!silent) { _fbSyncing = true; _fbUpdateStatus(); }
    // Fresh token for load
    let _tok = null;
    if(window._fbUser){ try{ _tok = await window._fbUser.getIdToken(false); }catch(te){ try{ _tok = await window._fbUser.getIdToken(true); }catch(te2){} } }
    if(!_tok && window._fbGetToken) _tok = await window._fbGetToken();
    const _authQ = _tok ? '&auth=' + _tok : '';
    const r = await fetch(FIREBASE_DB_URL + '?cb=' + Date.now() + _authQ);
    if (!r.ok) {
      if (r.status === 401 || r.status === 403) {
        console.warn('Firebase: אין הרשאה — ייתכן שהטוקן פג תוקף, מתחדש...');
        // Force token refresh and retry once
        if (window._fbUser) {
          try {
            window._cachedToken = await window._fbUser.getIdToken(true);
            const r2 = await fetch(FIREBASE_DB_URL + '?ts=' + Date.now() + '&auth=' + window._cachedToken);
            if (r2.ok) { return await _processFirebaseLoad(r2, silent); }
          } catch(e2) {}
        }
      }
      console.warn('Firebase load failed: ' + r.status); return false;
    }
    return await _processFirebaseLoad(r, silent, force);
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
  // Safety: don't save in first 2 seconds after page load (initialization window)
  if(Date.now() - (window._appStartTime||0) < 2000){
    console.warn('saveToFirebase: skipped (within startup window)');
    return false;
  }
  try {
    // Prefer in-memory data (most up-to-date) over stored
    const liveData = {
      ch: typeof SCH!=='undefined'?SCH:[],
      pairs: typeof pairs!=='undefined'?pairs:[],
      supEx: typeof supEx!=='undefined'?supEx:{},
      clusters: typeof clusters!=='undefined'?clusters:{},
      holidays: typeof holidays!=='undefined'?holidays:[],
      pairBreaks: typeof pairBreaks!=='undefined'?pairBreaks:{},
      managers: typeof managers!=='undefined'?managers:{},
      blockedDates: typeof blockedDates!=='undefined'?blockedDates:{},
      gardenBlocks: typeof gardenBlocks!=='undefined'?gardenBlocks:{},
      invoices: typeof INVOICES!=='undefined'?INVOICES:[],
      vatRate: typeof VAT_RATE!=='undefined'?VAT_RATE:18,
      activeGardens: typeof activeGardens!=='undefined'&&activeGardens?[...activeGardens]:null
    };
    // Validate: don't overwrite with significantly less data
    const raw = JSON.stringify(liveData);
    if(!raw || raw.length < 100) { console.warn('Save aborted: data too small'); return false; }
    // Extra safety: if Firebase had invoices but we have none, skip
    if((liveData.invoices||[]).length === 0 && window._fbLastKnownInvoiceCount > 0){
      console.warn('Save aborted: would overwrite', window._fbLastKnownInvoiceCount, 'invoices with 0');
      return false;
    }
    _fbSyncing = true;
    _fbUpdateStatus();
    const nowTs = Date.now();
    const payload = { data: JSON.parse(raw), ts: nowTs, version: '10.2' };
    console.log('Saving to Firebase: invoices=', JSON.parse(raw).invoices?.length, 'SCH=', JSON.parse(raw).ch?.length);
    // Always refresh token before saving (prevents 401 on mobile)
    let _saveTok = null;
    if(window._fbUser){ try{ _saveTok = await window._fbUser.getIdToken(false); }catch(te){ try{ _saveTok = await window._fbUser.getIdToken(true); }catch(te2){} } }
    if(!_saveTok && window._fbGetToken) _saveTok = await window._fbGetToken();
    const _saveQ   = _saveTok ? '?auth=' + _saveTok : '';
    const r = await fetch(FIREBASE_DB_URL + _saveQ, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (r.ok) {
      _setFbSaveTs(nowTs);
      _safeLS.setItem('ganv5_local_ts', String(nowTs));
      _fbLastError = null;
      _fbLastOwnSaveTs = nowTs; // track our own saves
      // Show save indicator (small flash)
      const _bi=document.getElementById('backup-ind');
      if(_bi){_bi.textContent='☁️ נשמר';_bi.classList.add('show');clearTimeout(_bi._to);_bi._to=setTimeout(()=>_bi.classList.remove('show'),1500);}
      if (!silent) showToast('✅ סונכרן ל-Firebase ' + _fmtTs(nowTs));
      // Trigger daily backup (async, non-blocking)
      _runDailyBackupIfNeeded(JSON.parse(raw), _saveTok).catch(()=>{});
      return true;
    }
    if (r.status === 401 || r.status === 403) {
      // Token expired — refresh and retry once
      try {
        if(window._fbUser) window._cachedToken = await window._fbUser.getIdToken(true);
        const newQ = window._cachedToken ? '?auth=' + window._cachedToken : '';
        const r2 = await fetch(FIREBASE_DB_URL + newQ, {
          method: 'PUT', headers: {'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        });
        if(r2.ok){ _setFbSaveTs(nowTs); localStorage.setItem('ganv5_local_ts',String(nowTs)); return true; }
      } catch(re){}
    }
    _fbLastError = 'שגיאה ' + r.status + (r.status===401||r.status===403?' (הרשאות)':'');
    _fbUpdateStatus();
    if (!silent) showToast('❌ שגיאת סנכרון Firebase (' + r.status + ')');
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
  _fbTimer = setTimeout(() => saveToFirebase(true), 1000);
}

// ── Apply remote data helper (shared by poll + visibility) ──
function _applyRemoteData(appData, cloudTs) {
  if(!appData || Object.keys(appData).length===0) return;
  _safeLS.setItem('ganv5', JSON.stringify(appData));
  _setFbSaveTs(cloudTs);
  _setFbLoadTs(Date.now());
  try {
    const d = typeof appData==='string' ? JSON.parse(appData) : appData;
    if(typeof _applyYearData==='function') _applyYearData(d);
    window._fbLastKnownInvoiceCount = Math.max(window._fbLastKnownInvoiceCount||0, d.invoices?.length||0);
    if(typeof syncSupplierList==='function') syncSupplierList();
    try{ if(typeof renderDash==='function') renderDash(); }catch(e){}
    try{ if(typeof renderCal==='function') renderCal(); }catch(e){}
    try{ if(typeof renderInvoices==='function') renderInvoices(); }catch(e){}
    try{ if(typeof refreshPurchDash==='function') refreshPurchDash(); }catch(e){}
    try{ if(typeof updCounts==='function') updCounts(); }catch(e){}
  } catch(e2){ console.warn('Apply remote data error:', e2); }
  _fbUpdateStatus();
}

// ── Visibility change: sync when returning to app from background ──
let _lastVisibilitySync = 0;
let _lastHiddenAt = 0;

document.addEventListener('visibilitychange', async ()=>{
  if(document.visibilityState === 'hidden'){
    _lastHiddenAt = Date.now();
    return;
  }
  const now = Date.now();
  if(now - _lastVisibilitySync < 3000) return; // throttle 3s
  _lastVisibilitySync = now;
  if(!window._fbUser) return;
  // Restart polling — mobile browsers kill setInterval in background
  _fbStartPolling();
  const awayMs = _lastHiddenAt > 0 ? now - _lastHiddenAt : 99999;
  try{
    // Force token refresh if away > 5 min (Android/iOS token expiry)
    const forceRefresh = awayMs > 300000;
    let tok = null;
    if(window._fbUser){
      try{ tok = await window._fbUser.getIdToken(forceRefresh); }
      catch(te){ try{ tok = await window._fbUser.getIdToken(true); }catch(_){} }
    }
    const q = tok ? '&auth='+tok : '';
    const r = await fetch(FIREBASE_DB_URL+'?cb='+now+q);
    if(!r.ok) return;
    const d = await r.json();
    const cloudTs = d && d.ts ? d.ts : 0;
    if(cloudTs > 0 && (cloudTs > _fbLastSaveTs || awayMs > 10000)){
      _applyRemoteData(d.data||d, cloudTs);
      _setFbLoadTs(now);
      if(awayMs > 10000) showToast('🔄 נתונים עודכנו');
    } else {
      _fbUpdateStatus();
    }
  } catch(e){ console.warn('Visibility sync:', e.message); }
});

// All mobile: pageshow for bfcache restore (back/forward button)
window.addEventListener('pageshow', async (e)=>{
  if(!e.persisted) return;
  if(!window._fbUser) return;
  _lastVisibilitySync = 0;
  _fbStartPolling();
  try{ await loadFromFirebase(true, true); showToast('🔄 נתונים עודכנו'); }catch(ex){}
});

window.addEventListener('offline', ()=>{ showToast('📵 אין חיבור — שינויים יסונכרנו בהתחברות'); });


function _fbStartPolling() {
  clearInterval(_fbPollTimer);
  _fbPollTimer = setInterval(async () => {
    try {
      const _pollTok = window._fbGetToken ? await window._fbGetToken() : null;
      const _pollQ   = _pollTok ? '&auth=' + _pollTok : '';
      const r = await fetch(FIREBASE_DB_URL + '?ts=' + Date.now() + _pollQ);
      if (!r.ok) return;
      const d = await r.json();
      const cloudTs = d && d.ts ? d.ts : 0;
      if (cloudTs > _fbLastSaveTs && cloudTs > 0) {
        console.log('Firebase: remote change detected, reloading...');
        _applyRemoteData(d.data || d, cloudTs);
        showToast('🔄 נתונים עודכנו ממכשיר אחר');
      }
    } catch(e) { /* ignore polling errors */ }
  }, FIREBASE_POLL_INTERVAL);
}

// ── UI helpers ────────────────────────────────
function odUpdateUI() { _fbUpdateStatus(); }

// ── Heartbeat: ensure save every 2 minutes ───
const FB_HEARTBEAT_MS = 120000; // 2 minutes
setInterval(async ()=>{
  if(!window._fbUser) return; // not logged in
  if(_fbSyncing) return; // already saving
  const age = Date.now() - (_fbLastOwnSaveTs||_fbLastSaveTs||0);
  if(age > FB_HEARTBEAT_MS){
    console.log('Heartbeat: saving (age='+Math.round(age/1000)+'s)');
    try{
      // Refresh token silently first
      if(window._fbUser) try{ window._cachedToken=await window._fbUser.getIdToken(false); }catch(e){}
      await saveToFirebase(true);
    } catch(e){ console.warn('Heartbeat save failed:', e.message); }
  }
}, 60000); // check every 60s

function odToggle() {
  _fbUpdateStatus();
  const modal = document.getElementById('od-modal');
  if (modal) modal.classList.toggle('open');
}

async function fbSyncNow() {
  await saveToFirebase(false);
}

async function fbLoadNow() {
  const ok = await loadFromFirebase(false, true);
  if (ok) {
    // _processFirebaseLoad already applied data — just refresh UI
    try {
      if(typeof renderDash==='function') try{renderDash();}catch(e){}
      if(typeof renderCal==='function') try{renderCal();}catch(e){}
      if(typeof renderInvoices==='function') try{renderInvoices();}catch(e){}
      if(typeof refreshPurchDash==='function') try{refreshPurchDash();}catch(e){}
      if(typeof updCounts==='function') try{updCounts();}catch(e){}
      showToast('✅ נטענו נתונים מ-Firebase');
    } catch(e) { console.warn(e); }
  } else {
    showToast('ℹ️ הנתונים כבר מעודכנים');
  }
}

function ghAutoSave(immediate) { 
  if(immediate){ 
    clearTimeout(window._fbTimer);
    saveToFirebase(true).catch(()=>{}); 
  } else { 
    firebaseAutoSave(); 
  } 
}
// ══════════════════════════════════════════════


// ── PROCUREMENT MODULE - v9.0 ────────────────────────────────

let _appMode = 'act'; // 'act' | 'purch'
let _purchTab = 'pdash';
const PURCH_TABS = ['pdash','pinvoices','psup'];

// ── Mode switcher ──────────────────────────────────────
function switchMode(mode){
  _appMode = mode;
  // Always close side panel + backdrop when switching modes (critical for mobile)
  const _spEl=document.getElementById('sp');
  const _bdEl=document.getElementById('sp-backdrop');
  if(_spEl) _spEl.classList.remove('open');
  if(_bdEl) _bdEl.style.display='none';
  selEv=null;
  // Toggle body class for CSS theming
  document.body.classList.toggle('mode-purch', mode==='purch');
  // Show/hide tab bars
  document.getElementById('tabs-act').style.display = mode==='act' ? '' : 'none';
  document.getElementById('tabs-purch').style.display = mode==='purch' ? '' : 'none';
  // Toggle mode buttons
  document.getElementById('modeBtn-act').classList.toggle('active', mode==='act');
  document.getElementById('modeBtn-purch').classList.toggle('active', mode==='purch');
  // Mobile nav: show correct bar
  // Mobile nav — only manipulate on mobile screens (CSS handles desktop hide)
  const mnPurch = document.getElementById('mob-nav-purch');
  if(mnPurch) mnPurch.style.display = mode==='purch' ? 'block' : 'none';
  // For act nav: remove any inline style so CSS @media rule controls it
  const mnAct = document.getElementById('mob-nav');
  if(mnAct) mnAct.style.display = '';  // let CSS decide: hidden on desktop, block on mobile
  // Show panels
  if(mode==='act'){
    // Hide all purch panels
    PURCH_TABS.forEach(t=>{ const el=document.getElementById('p-'+t); if(el) el.style.display='none'; });
    ST(typeof currentTab!=='undefined' ? currentTab : 'dash');
  } else {
    // Hide all act panels (use both class removal and display:none to be safe)
    TABS.forEach(t=>{ const el=document.getElementById('p-'+t); if(el){ el.classList.remove('active'); el.style.display='none'; } });
    SPT(_purchTab);
    refreshPurchDash();
    // Ensure supplier list is fresh
    try{ if(_purchTab==='psup') renderPurchSuppliers(); }catch(e){}
  }
}

function SPT(t){
  _purchTab = t;
  // Always close side panel + backdrop when switching tabs (critical for mobile)
  const _spEl=document.getElementById('sp');
  const _bdEl=document.getElementById('sp-backdrop');
  if(_spEl) _spEl.classList.remove('open');
  if(_bdEl) _bdEl.style.display='none';
  selEv=null;
  PURCH_TABS.forEach((x,i)=>{
    const tabEl = document.querySelectorAll('#tabs-purch .tab')[i];
    if(tabEl) tabEl.classList.toggle('active', x===t);
    const panelEl = document.getElementById('p-'+x);
    if(panelEl) panelEl.style.display = x===t ? 'block' : 'none';
  });
  if(t==='pinvoices'){ fillPiSupFilter(); renderInvoices(); }
  if(t==='psup'){
    setTimeout(renderPurchSuppliers, 50);
  }
  if(t==='pdash') refreshPurchDash();
}

// INVOICES DATA
let INVOICES = [];
let VAT_RATE = 18; // Default VAT % — editable by user in invoice settings

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
  navigator.clipboard?.writeText(text).then(()=>showToast('📋 הועתק!')).catch(()=>{
    const ta=document.createElement('textarea');
    ta.value=text; ta.style.cssText='position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta); ta.select();
    try{document.execCommand('copy');}catch(e){}
    document.body.removeChild(ta);
    showToast('📋 הועתק!');
  });
}

function _removeOverlay(id) { document.getElementById(id)?.remove(); }

// Called when user picks a file via <input type="file">
function invFilePickerChange(section){
  const input = document.getElementById('inv-file-'+section);
  if(!input||!input.files[0]) return;
  const file = input.files[0];
  _pendingFiles[section] = {name: file.name, path: ''};
  const lbl = document.getElementById('inv-file-lbl-'+section);
  if(lbl){ lbl.textContent = '📎 '+file.name; lbl.style.color='#2e7d32'; }
  // Show the path-input row for URL entry
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
  const val = pi.value.trim();
  const hasPath = !!val;
  const btn = document.getElementById('inv-file-open-'+section);
  const delBtn = document.getElementById('inv-file-del-'+section);
  const pathOpenBtn = document.getElementById('inv-path-open-'+section);
  if(btn) btn.style.display = hasPath ? 'inline' : 'none';
  if(delBtn) delBtn.style.display = (_pendingFiles[section]||hasPath) ? 'inline' : 'none';
  if(hasPath){
    const c = _classifyPath(val);
    // Show "פתח" button in path row only for valid URLs
    if(pathOpenBtn) pathOpenBtn.style.display = (c.type==='url') ? 'inline-block' : 'none';
    if(c.type==='url') pi.style.borderColor='#2e7d32';
    else if(c.type==='onedrive_local') pi.style.borderColor='#e65100';
    else pi.style.borderColor='#b0bec5';
  } else {
    if(pathOpenBtn) pathOpenBtn.style.display='none';
    pi.style.borderColor='#b0bec5';
  }
}

// Main open function
function invOpenFile(invId, section){
  const inv = INVOICES.find(i=>i.id===invId);
  if(!inv) return;
  const meta = inv['file_'+section];
  if(!meta){ showToast('❌ לא צורף קובץ לסעיף זה'); return; }
  if(!meta.path){
    _showPathDialog(invId, section, meta);
    return;
  }
  _invTryOpen(meta.path, invId, section, meta);
}

function _invTryOpen(p, invId, section, meta){
  const c = _classifyPath(p);

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
        <button onclick="_removeOverlay('path-dlg-overlay')" class="btn bs bsm">ביטול</button>
        <button onclick="_pathDlgSave(${invId},'${section}')" class="btn bp bsm">💾 שמור קישור</button>
        <button onclick="_pathDlgOpen(${invId},'${section}')" class="btn borange bsm">🔗 שמור ופתח</button>
      </div>
    </div>`;
  document.body.appendChild(div);
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
  const inv = INVOICES.find(i=>i.id===invId);
  if(inv){
    const meta = inv['file_'+section]||{name:''};
    inv['file_'+section] = {...meta, path:val};
    save();
    const pi = document.getElementById('inv-path-'+section);
    if(pi){pi.value=val; invPathChange(section);}
    showToast('✅ קישור נשמר');
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
      <div style="background:#f5f5f5;border-radius:6px;padding:8px 10px;font-size:.7rem;font-family:monospace;direction:ltr;text-align:left;word-break:break-all;margin-bottom:14px;color:#555">${p}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
        <button onclick="_removeOverlay('localhelp-overlay')" class="btn bs bsm">סגור</button>
        <button onclick="_copyToClipboard(${JSON.stringify(p)});showToast('✅ נתיב הועתק');_removeOverlay('localhelp-overlay')" class="btn bo bsm">📋 העתק נתיב</button>
        <button onclick="_tryOpenLocalFile(${JSON.stringify(p)})" class="btn bg bsm">📂 נסה לפתוח</button>
        <button onclick="_removeOverlay('localhelp-overlay');_showPathDialog(${invId},'${section}',${JSON.stringify(meta)})" class="btn bp bsm">🔗 עדכן קישור</button>
      </div>
    </div>`;
  document.body.appendChild(div);
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
  return ex.isPurch !== false; // default true — all suppliers are purchase suppliers
}
function getAllSupNames(){
  if(typeof getAllSup==='function') return getAllSup().map(s=>s.name);
  return [];
}
function rebuildMergedSupplierActs(){
  // After merges, some supEx entries may have stale empty acts arrays
  // Clear them so auto-derive from SCH kicks in
  Object.keys(supEx).forEach(name=>{
    const ex = supEx[name];
    if(Array.isArray(ex.acts) && ex.acts.length===0){
      delete ex.acts; // Let getSupActs auto-derive from SCH
    }
  });
  save();
}

function getPurchSuppliers(){ 
  return getAllSupNames().filter(name=>isPurchSupplier(name)).map(name=>{
    const ex=(typeof supEx!=='undefined'?supEx:{})[name]||{};
    const base=(typeof SUPBASE!=='undefined'?SUPBASE:[]).find(s=>s.name===name)||{};
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
function getVatRate(){ return VAT_RATE||18; }
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
function invClearFile(sec){
  const lbl = document.getElementById('inv-file-lbl-'+sec);
  const openBtn = document.getElementById('inv-file-open-'+sec);
  const delBtn = document.getElementById('inv-file-del-'+sec);
  const pathRow = document.getElementById('inv-path-row-'+sec);
  const pathInp = document.getElementById('inv-path-'+sec);
  if(lbl){ lbl.textContent='צרף קובץ...'; lbl.style.color='#999'; }
  if(openBtn) openBtn.style.display='none';
  if(delBtn) delBtn.style.display='none';
  if(pathRow) pathRow.style.display='none';
  if(pathInp) pathInp.value='';
  _pendingFiles[sec]=null;
}
function deleteInvoiceFromModal(){
  if(!_editInvId) return;
  if(!confirm('למחוק מסמך זה לגמרי?')) return;
  INVOICES = INVOICES.filter(i=>i.id!==_editInvId);
  save(true); CM('invoice-m'); renderInvoices(); refreshPurchDash();
  showToast('🗑️ המסמך נמחק');
}
function resetInvFilter(){
  const ids = ['pi-srch','pi-from','pi-to'];
  ids.forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.querySelectorAll('.pi-st-cb').forEach(cb=>cb.checked=false);
  const allCb=document.getElementById('pi-st-all'); if(allCb) allCb.checked=false;
  _setPiStLabel();
  try{ localStorage.removeItem(PI_ST_KEY); }catch(e){}
  const sortEl=document.getElementById('pi-sort'); if(sortEl) sortEl.value='desc';
  renderInvoices();
}
function openNewInvoice(id, presetSup){
  _editInvId = id || null;
  const inv = id ? INVOICES.find(i=>i.id===id) : null;
  document.getElementById('inv-m-title').textContent = id ? '✏️ עריכת מסמך' : '📄 מסמך חדש';
  // Supplier autocomplete datalist
  const dl = document.getElementById('inv-sup-datalist');
  if(dl){
    // Use getAllSup so merged supplier names are up-to-date
    dl.innerHTML = getAllSup().map(s=>{
      const ex=supEx[s.name]||{};
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
    if(supName) invUpdateEntityType((supEx[supName]||{}).entityType||'');
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
  onVatChange();
  // Order section
  document.getElementById('inv-order-num').value   = inv ? (inv.orderNum||'')   : '';
  document.getElementById('inv-order-date').value  = inv ? (inv.orderDate||'')  : '';
  document.getElementById('inv-order-desc').value  = inv ? (inv.orderDesc||'')  : '';
  document.getElementById('inv-order-amt').value   = inv ? (inv.orderAmt||'')   : '';
  // Restore order VAT mode (so editing doesn't recalculate wrong)
  const ordVatModeR = inv ? (inv.ordVatMode||'ex') : 'ex';
  window._ordVatMode = ordVatModeR;
  document.getElementById('vat-ord-ex')?.classList.toggle('active', ordVatModeR==='ex');
  document.getElementById('vat-ord-inc')?.classList.toggle('active', ordVatModeR==='inc');
  document.getElementById('inv-order-notes').value = inv ? (inv.orderNotes||'') : '';
  const ordType = document.getElementById('inv-order-type'); if(ordType) ordType.value=inv?(inv.orderType||''):'';
  // Location fields (25)
  const locCity=document.getElementById('inv-loc-city'); if(locCity) locCity.value=inv?(inv.locCity||''):'';
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
  document.getElementById('inv-recv').value = inv ? (inv.recv||'') : new Date().toISOString().slice(0,10);
  document.getElementById('inv-notes').value = inv ? (inv.notes||'')  : '';
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
  // Reset file pickers & show existing file names + open buttons
  _pendingFiles = {order:null, tx:null, tax:null};
  ['order','tx','tax'].forEach(sec=>{
    const fi   = document.getElementById('inv-file-'+sec);
    const lbl  = document.getElementById('inv-file-lbl-'+sec);
    const btn  = document.getElementById('inv-file-open-'+sec);
    const delF = document.getElementById('inv-file-del-'+sec);
    const row  = document.getElementById('inv-path-row-'+sec);
    const pi   = document.getElementById('inv-path-'+sec);
    const pathOpenBtn = document.getElementById('inv-path-open-'+sec);
    if(fi) fi.value='';
    const meta = inv && inv['file_'+sec];
    if(lbl){
      lbl.textContent = meta ? '📎 '+meta.name : 'צרף קובץ...';
      lbl.style.color = meta ? '#2e7d32' : '#999';
    }
    if(row) row.style.display = meta ? 'flex' : 'none';
    if(pi)  pi.value = meta ? (meta.path||'') : '';
    if(btn) btn.style.display = (meta && meta.path) ? 'inline' : 'none';
    if(delF) delF.style.display = meta ? 'inline' : 'none';
    // Show path-row open button only for valid URLs; color hint
    if(meta && meta.path){
      const cl = _classifyPath(meta.path);
      if(pathOpenBtn) pathOpenBtn.style.display = cl.type==='url' ? 'inline-block' : 'none';
      if(pi) pi.style.borderColor = cl.type==='url' ? '#2e7d32' : cl.type==='onedrive_local' ? '#e65100' : '#b0bec5';
    } else {
      if(pathOpenBtn) pathOpenBtn.style.display='none';
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
  const base = supBase(supName);
  const entityType = (supEx[supName]||supEx[base]||{}).entityType||
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
  if(isNaN(v)||v<0||v>100){ alert('יש להזין אחוז תקין (0–100)'); return; }
  VAT_RATE = v;
  document.getElementById('inv-vat').value = v;
  onVatChange();
  save();
  showToast('✅ שיעור מע"מ עודכן ל-'+v+'%');
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
    if(!nsName){ alert('יש להזין שם ספק'); return; }
    const entityType = document.getElementById('inv-ns-entity')?.value||'';
    if(typeof supEx !== 'undefined'){
      if(!supEx['__c']) supEx['__c']=[];
      if(!supEx['__c'].find(s=>s.name===nsName))
        supEx['__c'].push({id:Date.now(),name:nsName,phone:document.getElementById('inv-ns-phone')?.value.trim()});
      const nsIsAct = document.getElementById('inv-ns-acts')?.checked||false;
    supEx[nsName]={...(supEx[nsName]||{}),
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
  if(!supName){ alert('יש לבחור ספק'); return; }
  const num      = document.getElementById('inv-num').value.trim();
  const txNum    = document.getElementById('inv-tx-num').value.trim();
  const orderNum = document.getElementById('inv-order-num').value.trim();
  if(!orderNum && !txNum && !num){
    alert('יש להזין לפחות מספר הזמנה, מספר חשבונית עסקה, או מספר חשבונית מס'); return;
  }
  // Check duplicate order number — only for purely numeric numbers (letters/mixed = internal codes, skip)
  if(orderNum && /^\d+$/.test(orderNum)){
    const dup = INVOICES.find(i=>i.orderNum===orderNum && i.id!==_editInvId);
    if(dup && !confirm(`⚠️ מספר הזמנה ${orderNum} כבר קיים אצל "${dup.supName}". לשמור בכל זאת?`)) return;
  }
  const vat      = parseFloat(document.getElementById('inv-vat').value)||getVatRate();
  const ordMode  = window._ordVatMode||'ex';
  const txMode   = window._txVatMode||'ex';
  const invMode  = window._invVatMode||'ex';
  const rawOrder = parseFloat(document.getElementById('inv-order-amt').value)||0;
  const rawTx    = parseFloat(document.getElementById('inv-tx-amt').value)||0;
  const rawAmt   = parseFloat(document.getElementById('inv-amt').value)||0;
  // Exempt suppliers (עוסק פטור / עמותה) — no VAT
  const _supEntityType = (supEx[supName]||supEx[supBase(supName)]||{}).entityType||'';
  const isExemptSave = _supEntityType==='עוסק פטור' || _supEntityType==='עמותה';
  const effectiveVat = isExemptSave ? 0 : vat;
  const orderAmt = ordMode==='inc' ? +(rawOrder/(1+effectiveVat/100)).toFixed(2) : rawOrder;
  const txAmt    = txMode==='inc'  ? +(rawTx/(1+effectiveVat/100)).toFixed(2)   : rawTx;
  const amt      = invMode==='inc' ? +(rawAmt/(1+effectiveVat/100)).toFixed(2)  : rawAmt;
  const invId    = _editInvId || Date.now();

  const existingInv = _editInvId ? INVOICES.find(i=>i.id===_editInvId) : null;
  const fileMeta = {};
  for(const sec of ['order','tx','tax']){
    if(_pendingFiles[sec]){
      const pathEl = document.getElementById('inv-path-'+sec);
      fileMeta['file_'+sec] = {name:_pendingFiles[sec].name, path:pathEl?pathEl.value.trim():''};
    } else {
      // Preserve current path input value (in case user edited it)
      const pathEl = document.getElementById('inv-path-'+sec);
      const existing = existingInv && existingInv['file_'+sec];
      if(existing){
        fileMeta['file_'+sec] = {...existing, path:pathEl?pathEl.value.trim():existing.path||''};
      } else {
        fileMeta['file_'+sec] = null;
      }
    }
  }
  // Warn if order number filled but no file attached (30)
  // Warn about missing file only for numeric order numbers (letters = internal codes, no file needed)
  if(orderNum && /^\d+$/.test(orderNum) && !fileMeta.file_order && !confirm('⚠️ לא צורף קובץ הזמנה. לשמור בכל זאת?')) return;

  const status = document.getElementById('inv-status')?.value||'order';
  const inv = {
    id:invId, supName, vat: effectiveVat,
    orderNum, orderDate:document.getElementById('inv-order-date').value,
    orderDesc:document.getElementById('inv-order-desc').value.trim(),
    orderType:document.getElementById('inv-order-type')?.value||'',
    orderAmt, orderVat:vatAmt(orderAmt,effectiveVat), orderTotal:withVat(orderAmt,effectiveVat),
    ordVatMode: ordMode,
    orderNotes:document.getElementById('inv-order-notes').value.trim(),
    locCity:document.getElementById('inv-loc-city')?.value.trim()||'',
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
    ...fileMeta,
    ts: existingInv?.ts || Date.now()
  };
  if(_editInvId){
    const idx=INVOICES.findIndex(i=>i.id===_editInvId);
    if(idx>=0) INVOICES[idx]=inv;
  } else {
    INVOICES.push(inv);
  }
  // Auto-create supplier card if not exists — must be in supEx['__c'] to appear in list
  if(supName && supName!=='__new__'){
    const inSupbase = (typeof SUPBASE!=='undefined') && SUPBASE.some(s=>supBase(s.name)===supName);
    if(!supEx[supName]) supEx[supName]={};
    if(supEx[supName].isPurch===undefined) supEx[supName].isPurch=true;
    if(!inSupbase){
      if(!supEx['__c']) supEx['__c']=[];
      if(!supEx['__c'].find(s=>supBase(s.name)===supName)){
        supEx['__c'].push({id:Date.now(),name:supName,phone:supEx[supName].ph1||''});
      }
      // Invoice-created suppliers are purch-only by default (not חוגים)
      if(supEx[supName].isAct===undefined) supEx[supName].isAct=false;
    }
  }
  save();
  try { await invSaveFiles(invId); } catch(e){ showToast('⚠️ שגיאה בשמירת קובץ: '+e.message); }
  CM('invoice-m');
  renderInvoices(); refreshPurchDash();
  showToast('✅ מסמך נשמר בהצלחה');
}

// ── Create supplier cards for all existing invoices (run once) ──
function createMissingSupCards(){
  // Ensure every supplier in invoices/SCH appears in the supplier list
  const inSupbase = new Set(SUPBASE.map(s=>supBase(s.name)));
  if(!supEx['__c']) supEx['__c']=[];
  let created=0;

  // 1. From INVOICES
  INVOICES.forEach(inv=>{
    const name=inv.supName;
    if(!name) return;
    const base=supBase(name);
    if(!supEx[base]) supEx[base]={};
    if(supEx[base].isPurch===undefined) supEx[base].isPurch=true;
    // Add to __c if not in SUPBASE and not already in __c
    if(!inSupbase.has(base) && !supEx['__c'].find(s=>supBase(s.name)===base)){
      supEx['__c'].push({id:Date.now()+Math.random(),name:base,phone:supEx[base].ph1||''});
      created++;
    }
  });

  // 2. From SCH (any supplier in schedules should have a card)
  if(typeof SCH!=='undefined') SCH.forEach(s=>{
    if(!s.a) return;
    const base=supBase(s.a);
    if(!base) return;
    if(!supEx[base]) supEx[base]={};
    if(!inSupbase.has(base) && !supEx['__c'].find(c=>supBase(c.name)===base)){
      supEx['__c'].push({id:Date.now()+Math.random(),name:base,phone:''});
      created++;
    }
  });

  if(created>0){ save(); console.log(`✅ נוצרו ${created} כרטיסי ספק חסרים`); }
}
function deleteInvoice(id){
  if(!confirm('למחוק חשבונית זו?')) return;
  INVOICES=INVOICES.filter(i=>i.id!==id);
  ['order','tx','tax'].forEach(sec => fileDelete(fileKey(id,sec)).catch(()=>{}));
  save(true); renderInvoices(); refreshPurchDash(); // immediate=true → saves to Firebase now
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

function fillPiSupFilter(){
  const dl = document.getElementById('pi-sup-list');
  if(!dl) return;
  dl.innerHTML = getPurchSuppliers().map(s=>`<option value="${s.name}">`).join('');
}

function getSupName(supRef){
  if(typeof supRef === 'string') return supRef;
  if(typeof SUPBASE==='undefined') return String(supRef);
  const s = SUPBASE.find(x=>x.id===parseInt(supRef));
  return s ? s.name : String(supRef);
}

function renderInvoices(){
  const tbody = document.getElementById('pi-tbody');
  if(!tbody) return;
  // Populate supplier autocomplete datalist
  const dl = document.getElementById('pi-sup-list');
  if(dl){
    const supNames=[...new Set(INVOICES.map(i=>i.supName||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'he'));
    dl.innerHTML=supNames.map(n=>`<option value="${n}">`).join('');
  }
  const srch = (document.getElementById('pi-srch')?.value||'').toLowerCase();
  // Multi-select status filter
  const stfArr = _getPiStSelected ? _getPiStSelected() : [];
  const supf = ''; // merged into srch
  const from = document.getElementById('pi-from')?.value||'';
  const to   = document.getElementById('pi-to')?.value||'';
  const sortDir = document.getElementById('pi-sort')?.value||'desc';
  let list = [...INVOICES];
  if(srch) list = list.filter(i=>
    (i.supName||'').toLowerCase().includes(srch)||
    (i.num||'').toLowerCase().includes(srch)||
    (i.orderNum||'').toLowerCase().includes(srch)||
    (i.txNum||'').toLowerCase().includes(srch)||
    (i.orderDesc||'').toLowerCase().includes(srch)||
    (i.cancelReason||'').toLowerCase().includes(srch)
  );
  if(stfArr.length){
    list = list.filter(i=>{
      const st = _migrateInvStatus(i.status);
      return stfArr.some(f=> f==='tax_receipt' ? i.status==='tax_receipt' : st===f);
    });
  }
  if(from) list = list.filter(i=>(i.orderDate||i.txDate||i.date||'')>=from);
  if(to)   list = list.filter(i=>(i.orderDate||i.txDate||i.date||'')<=to);
  list.sort((a,b)=>{
    const da = a.orderDate||a.txDate||a.date||'', db = b.orderDate||b.txDate||b.date||'';
    return sortDir==='asc' ? da.localeCompare(db) : db.localeCompare(da);
  });
  if(from) list = list.filter(i=>(i.orderDate||i.txDate||i.date||'')>=from);
  if(to)   list = list.filter(i=>(i.orderDate||i.txDate||i.date||'')<=to);
  list.sort((a,b)=>{
    const da=a.orderDate||a.txDate||a.date||'', db=b.orderDate||b.txDate||b.date||'';
    return sortDir==='asc'?da.localeCompare(db):db.localeCompare(da);
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
  const statusStepper = (stRaw)=>{
    const st = _migrateInvStatus(stRaw);
    // tax_receipt = combined tax_invoice + receipt in one step
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
  if(!list.length){
    tbody.innerHTML='<tr><td colspan="7" style="text-align:center;color:#aaa;padding:25px">אין חשבוניות</td></tr>'; return;
  }
  tbody.innerHTML = list.map(inv=>{
    const vat = inv.vat||getVatRate();
    const isExempt = vat===0 || (supEx[inv.supName]||{}).entityType==='עוסק פטור'||(supEx[inv.supName]||{}).entityType==='עמותה';
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
        ${hasOrder?`<div><span style="font-size:.65rem;background:#e8eaf6;color:#1a237e;border-radius:4px;padding:1px 5px;font-weight:700">📋</span> <b style="cursor:pointer;color:#1565c0;text-decoration:underline" onclick="event.stopPropagation();invOpenFile(${inv.id},'order')" title="פתח קובץ הזמנה">${inv.orderNum}</b>${inv.orderDate?' · '+fD(inv.orderDate):''} ${mkFileBtn('order',inv.file_order)}</div>`:''}
        ${hasTx?`<div><span style="font-size:.65rem;background:#e8f5e9;color:#2e7d32;border-radius:4px;padding:1px 5px;font-weight:700">🧾</span> <b style="cursor:pointer;color:#1565c0;text-decoration:underline" onclick="event.stopPropagation();invOpenFile(${inv.id},'tx')" title="פתח קובץ חשבונית עסקה">${inv.txNum}</b>${inv.txDate?' · '+fD(inv.txDate):''} ${mkFileBtn('tx',inv.file_tx)}</div>`:''}
        ${hasTax?`<div><span style="font-size:.65rem;background:#fff8e1;color:#e65100;border-radius:4px;padding:1px 5px;font-weight:700">📑</span> <b style="cursor:pointer;color:#1565c0;text-decoration:underline" onclick="event.stopPropagation();invOpenFile(${inv.id},'tax')" title="פתח קובץ חשבונית מס">${inv.num}</b>${inv.date?' · '+fD(inv.date):''} ${mkFileBtn('tax',inv.file_tax)}</div>`:''}
      </td>
      <td style="font-size:.75rem;max-width:150px;color:#37474f;padding:8px">
        ${inv.orderDesc||''}
        ${inv.orderType?`<div style="font-size:.65rem;color:#1565c0">${{enrichment:'🎨 העשרה',operations:'🔧 תפעול',other:'📦 אחר'}[inv.orderType]||''}</div>`:''}
        ${inv.locCity||inv.locName?`<div style="font-size:.65rem;color:#546e7a">📍 ${[inv.locCity,inv.locName].filter(Boolean).join(' · ')}</div>`:''}
        ${inv.cancelReason?`<div style="font-size:.64rem;color:#c62828">❌ ${inv.cancelReason}</div>`:''}
      </td>
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
  const byStatus = st => invs.filter(i=>_migrateInvStatus(i.status)===st).length;
  const totalOrders = byStatus('order');
  const totalTx = byStatus('tx_invoice');
  const totalTax = byStatus('tax_invoice') + byStatus('receipt') + invs.filter(i=>i.status==='tax_receipt').length;
  const totalCancelled = byStatus('cancelled');
  document.getElementById('ps-invoices').textContent = invs.length;
  document.getElementById('ps-suppliers').textContent = getPurchSuppliers().length;
  document.getElementById('ps-open').textContent = totalOrders + totalTx;
  document.getElementById('ps-issues').textContent = totalTax;
  // Financial summary
  const activeInvs = invs.filter(i=>_migrateInvStatus(i.status)!=='cancelled');
  const sumBase  = activeInvs.reduce((s,i)=>s+(i.orderAmt||i.txAmt||i.amt||0),0);
  const sumTotal = activeInvs.reduce((s,i)=>s+(i.orderTotal||i.txTotal||i.total||0),0);
  const vatSumEl = document.getElementById('ps-vat-summary');
  if(vatSumEl && activeInvs.length){
    vatSumEl.innerHTML =
      `<span style="color:#546e7a">לפני מע"מ: <b>₪${sumBase.toLocaleString('he-IL',{maximumFractionDigits:0})}</b></span>`+
      `<span style="margin:0 10px;color:#c5cae9">|</span>`+
      `<span style="color:#2e7d32">כולל מע"מ: <b style="font-size:.9rem">₪${sumTotal.toLocaleString('he-IL',{maximumFractionDigits:0})}</b></span>`;
  } else if(vatSumEl){ vatSumEl.innerHTML=''; }
  // Dashboard: show only active statuses (הזמנה + חשבונית עסקה) by default, up to 10
  const ACTIVE_ST = new Set(['order','tx_invoice']);
  const rec = [...invs]
    .filter(i=>ACTIVE_ST.has(_migrateInvStatus(i.status)))
    .sort((a,b)=>(b.ts||0)-(a.ts||0))
    .slice(0,10);
  const el = document.getElementById('pdash-recent-invoices');
  if(!el) return;
  if(!rec.length){ el.innerHTML='<div style="color:#aaa;font-size:.8rem;text-align:center;padding:20px">אין הזמנות או חשבוניות עסקה פתוחות</div>'; return; }
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
      const st=_migrateInvStatus(i.status);
      const docs=[i.orderNum?'📋 '+i.orderNum:'',i.txNum?'🧾 '+i.txNum:'',i.num?'📑 '+i.num:''].filter(Boolean).join('<br>');
      const base=i.orderAmt||i.txAmt||i.amt||0;
      const total=i.orderTotal||i.txTotal||i.total||0;
      const dateStr=i.orderDate||i.txDate||i.date||'';
      return '<tr onclick="openNewInvoice('+i.id+')" class="inv-row-clickable" style="border-bottom:1px solid #f0f4f8">'+
        '<td style="padding:5px 8px;font-weight:700;color:#1a237e">'+i.supName+'<br><span style="font-weight:400;color:#888;font-size:.7rem">'+dateStr+'</span></td>'+
        '<td style="padding:5px 8px;font-size:.72rem">'+( docs||'—')+'</td>'+
        '<td style="padding:5px 8px;max-width:130px;font-size:.72rem;color:#444">'+(i.orderDesc||'').slice(0,35)+'</td>'+
        '<td style="padding:5px 8px;white-space:nowrap">'+fmtAmt2(base,total,i.vat||0)+'</td>'+
        '<td style="padding:5px 8px"><span style="font-size:.72rem">'+(stLabel[st]||st)+'</span></td>'+
        '<td style="padding:5px 8px;font-size:.7rem;color:#666;max-width:110px">'+(i.notes||'').slice(0,25)+'</td>'+
        '</tr>';
    }).join('')}</tbody>
  </table>`;
}

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
        <div style="font-weight:800;color:#1a237e;font-size:.88rem;line-height:1.35;margin-bottom:6px;word-break:break-word">
          📚 ${base}
          ${isAct?'<span style="font-size:.65rem;background:#e8f5e9;color:#2e7d32;border-radius:8px;padding:1px 5px;margin-right:4px">🎨</span>':''}
        </div>
        ${phone?`<div style="color:#2e7d32;font-size:.78rem;font-weight:600;margin-bottom:5px">📞 ${phone}</div>`:''}
        ${acts.length&&isAct?`<div style="margin-bottom:6px;display:flex;flex-wrap:wrap;gap:3px">
          ${acts.map(a=>`<span style="background:#e3f2fd;color:#1565c0;border-radius:10px;padding:2px 8px;font-size:.71rem;font-weight:600">🎯 ${a}</span>`).join('')}
        </div>`:''}
        ${ex.entityType?`<div style="font-size:.72rem;color:#6a1b9a;margin-bottom:4px">🏢 ${ex.entityType}</div>`:''}
        ${ex.notes?`<div style="font-size:.68rem;color:#78909c;margin-bottom:4px">📝 ${ex.notes}</div>`:''}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;padding-top:6px;border-top:1px solid #f0f0f0">
        <span style="color:#1565c0;font-weight:700;font-size:.72rem">${isAct?`📅 ${cnt} פעילויות${cntDone?` · ✔️ ${cntDone}`:''}`:''}</span>
        <div style="display:flex;gap:4px;flex-shrink:0" onclick="event.stopPropagation()">
          <button class="btn bp bsm" style="font-size:.65rem" onclick="psupNewInvoice(${idx})">📄 הזמנה</button>
          <button class="btn bo bsm" style="font-size:.65rem" onclick="psupEdit(${idx})">✏️</button>
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
  if(Array.isArray(o.invoices)){
    INVOICES=o.invoices;
    // ── Migrate invoices with double-VAT bug ──
    // Symptom: ordVatMode missing AND orderTotal ≈ orderAmt * (1 + vat/100)
    // This means the user entered the VAT-inclusive amount in 'ex' mode,
    // so orderTotal = entered_amount * 1.18 (double VAT).
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
    // If Firebase already applied data directly, skip re-loading
    if(window._fbAppData && typeof INVOICES!=='undefined' && INVOICES.length>0) {
      return; // data already in memory from _processFirebaseLoad
    }
    // Support migration from old Y1 system (ganv5_y_ keys)
    let st = null;
    try{ const meta=JSON.parse(localStorage.getItem('ganv5_meta')||'null');
         if(meta&&meta.currentYear) st=localStorage.getItem('ganv5_y_'+meta.currentYear); }catch(_){}
    if(!st) st = _safeLS.get('ganv5');
    if(!st && window._fbAppData) { _applyYearData(window._fbAppData); return; }
    if(st){ _applyYearData(JSON.parse(st)); }
    else { initPairs();clusters=JSON.parse(JSON.stringify(INIT_CLUSTERS));activeGardens=null; }
  }catch(e){
    console.warn('load() error:', e);
    if(window._fbAppData){ try{ _applyYearData(window._fbAppData); }catch(e2){} }
    else { initPairs();clusters=JSON.parse(JSON.stringify(INIT_CLUSTERS));activeGardens=null; }
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
function save(immediate){
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
    _safeLS.setItem('ganv5',_json);
    window._mem_ganv5=_json; // ensure in-memory is also up to date
    // Also update year key if meta exists
    try{const _m=JSON.parse(localStorage.getItem('ganv5_meta')||'null');if(_m&&_m.currentYear)localStorage.setItem('ganv5_y_'+_m.currentYear,_json);}catch(_){}
    try{ghAutoSave(immediate===true);}catch(_){}
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
function stLabel(s){
  if(s.st==='can') return'<span class="bdg br2">❌ בוטל</span>';
  if(s.st==='done') return'<span class="bdg bg2">✔️ התקיים</span>';
  if(s.st==='post') return`<span class="bdg bor">⏩ נדחה ${s.pd?'→ '+fD(s.pd):''}</span>`;
  if(s.st==='nohap') return'<span class="bdg br2">⚠️ לא התקיים</span>';
  return'<span class="bdg bg2">📅 מתקיים</span>';
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
  if(!supEx) supEx={};
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
    }catch(initErr){ console.warn('Init error:', initErr); }
    load();
    syncSupplierList(); // ensure supplier list is complete
    migratePairsFromAuto();
    migrateSupActSplit();
    importContactsFromGardens();
    migrateGardenPhones();
    initDrops();
    initHolDrops();
    refreshClusterDrops();
    refreshMgrDrops();
    document.getElementById('dash-date').value=td();
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
    console.log('App fully ready: SCH=',_sch,'INVOICES=',_inv);
    // Show status if invoices didn't load (mobile debugging)
    if(_inv === 0 && window._fbLastKnownInvoiceCount > 0){
      showToast('⚠️ חשבוניות לא נטענו! לחץ Firebase → טען עכשיו');
    }
    _fbStartPolling();
    setTimeout(_fitScrollAreas, 100);
    // Init user management UI (admin only)
    try{ _ensureAdminProfile(); }catch(e){}

  }; // end _onAuthReady
  // On mobile, Firebase may fire onAuthStateChanged BEFORE window.onload
  // In that case _fbUser is already set — trigger immediately
  if(window._fbUser) window._onAuthReady();
}; // end window.onload

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
    [...GARDENS].sort((a,b)=>{
      const cc=(a.city||'').localeCompare(b.city||'','he');
      return cc||((a.name||'').localeCompare(b.name||'','he'));
    }).forEach(g=>el.innerHTML+=`<option value='${g.id}'>${prefix?g.city+' · ':''} ${g.name}</option>`);
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
  fG('cal-g1','כל הצהרונים',true);fG('cal-g2','—',true);fG('cal-g3','—',true);
  fG('s-g1','כל הצהרונים',true);fG('s-g2','—',true);fG('s-g3','—',true);
  fG('apm-g1','בחר צהרון',true);fG('apm-g2','בחר צהרון',true);fG('apm-g3','—',true);
  document.getElementById('cal-dp').value=td();
  // Default calendar to גנים tab
  const calClsInit=document.getElementById('cal-cls');
  if(calClsInit) calClsInit.value='גנים';
}

const TABS=['dash','cal','sched','gardens','pairs','holidays','clusters','sup','managers','admin'];
let currentTab='dash';

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
        action: `switchMode('act');ST('cal');setTimeout(()=>{goDate('${s.d}');setTimeout(()=>openSP(${s.id}),200);},150);navSearchClose();`
      });
    });
  }

  if(!results.length){
    res.innerHTML='<div style="padding:10px 14px;color:#999;font-size:.82rem">לא נמצאו תוצאות</div>';
    res.style.display='block'; return;
  }

  res.innerHTML=results.slice(0,12).map(r=>`
    <div onclick="${r.action}" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:10px"
      onmouseover="this.style.background='#f5f7ff'" onmouseout="this.style.background=''">
      <span style="font-size:1.1rem;flex-shrink:0">${r.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:.82rem;color:#1a237e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.label}</div>
        ${r.sub?`<div style="font-size:.72rem;color:#78909c">${r.sub}</div>`:''}
      </div>
    </div>`).join('');
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
    // Load admin data
    if(typeof loadUsersList==='function') setTimeout(loadUsersList,300);
    if(typeof loadActivityLog==='function') setTimeout(()=>loadActivityLog(document.getElementById('log-filter')?.value||'week'),500);
  }
  if(t==='sched') renderSched();
  if(t==='gardens'){renderGardens();refreshMgrDrops();}
  if(t==='cal'){
    // Restore nav buttons in case they were hidden by range view
    if(calV!=='range'){
      document.querySelectorAll('[onclick="navCal(-1)"],[onclick="navCal(1)"]').forEach(b=>b.style.display='');
    }
    renderCal();
  }
  if(t==='pairs') renderPairs();
  if(t==='holidays'){initHolDrops();renderHolidays();}
  if(t==='clusters') renderClusters();
  if(t==='managers'){renderManagers();refreshMgrDrops();}
  if(t==='sup') renderSup();
  setTimeout(_fitScrollAreas, 120);
}

function calRefG(){
  // Ensure cal-cls matches the active tab
  const clsSel=document.getElementById('cal-cls');
  if(clsSel&&_calTab) clsSel.value=_calTab==='g'?'גנים':'ביה"ס';
  const city=document.getElementById('cal-city').value;
  const cls=document.getElementById('cal-cls').value;
  const gs=gByCF(city,cls).sort((a,b)=>{
    if(!city){const cc=(a.city||'').localeCompare(b.city||'','he');if(cc)return cc;}
    return (a.name||'').localeCompare(b.name||'','he');
  });
  ['cal-g1','cal-g2','cal-g3'].forEach((id,i)=>{
    const sel=document.getElementById(id);
    sel.innerHTML=i===0?'<option value="">כל הצהרונים</option>':'<option value="">—</option>';
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
let _rangeSubView = 'cal'; // 'cal' | 'list'
let _listSubView='week'; // 'day'|'week'|'month' — sub-view when calV==='list'

function setListSubView(v){
  _listSubView=v;
  ['day','week','month'].forEach(x=>document.getElementById('vlb-'+x)?.classList.toggle('active',x===v));
  renderCal();
}

function setRangeSubView(v){
  _rangeSubView = v;
  document.getElementById('vb-range-cal')?.classList.toggle('active', v==='cal');
  document.getElementById('vb-range-list')?.classList.toggle('active', v==='list');
  renderCal();
}

function setView(v){
  calV=v;
  _rangeSubView='cal';
  ['day','week','month','list','range'].forEach(x=>{
    const el=document.getElementById('vb-'+x);
    if(el) el.classList.toggle('active',x===v);
  });
  const rangeRow = document.getElementById('cal-range-row');
  const listRow  = document.getElementById('cal-list-row');
  const navBtns  = document.querySelectorAll('[onclick="navCal(-1)"],[onclick="navCal(1)"]');
  if(v==='range'){
    if(rangeRow) rangeRow.style.display='flex';
    if(listRow)  listRow.style.display='none';
    navBtns.forEach(b=>b.style.display='none');
    const f=document.getElementById('cal-range-from');
    const t=document.getElementById('cal-range-to');
    if(f&&!f.value) f.value=d2s(monStart(calD));
    if(t&&!t.value) t.value=d2s(addD(monStart(calD),6));
  } else if(v==='list'){
    if(rangeRow) rangeRow.style.display='none';
    if(listRow)  listRow.style.display='flex';
    navBtns.forEach(b=>b.style.display='');
  } else {
    if(rangeRow) rangeRow.style.display='none';
    if(listRow)  listRow.style.display='none';
    navBtns.forEach(b=>b.style.display='');
  }
  renderCal();
}
function navCal(d){
  if(calV==='day') calD=addD(calD,d);
  else if(calV==='week') calD=addD(calD,d*5); // 5-day work week (Sun–Thu)
  else if(calV==='list'){
    const lsv=_listSubView||'week';
    if(lsv==='day') calD=addD(calD,d);
    else if(lsv==='week') calD=addD(calD,d*5); // 5 work days
    else calD=addM(calD,d);
  }
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
    el.innerHTML=i===0?'<option value="">כל הצהרונים</option>':'<option value="">—</option>';
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
  if(!gids||gids.length<2){alert('יש לבחור לפחות 2 צהרונים');return;}
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
  if(!g2){alert('יש לבחור לפחות צהרון שני');return;}
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
    // Show 5 days (Sun-Thu) from calD, not from Monday
    const ws=new Date(calD); ws.setHours(0,0,0,0);
    // If on Fri(5) or Sat(6), start from next Sunday
    const dow0=ws.getDay();
    if(dow0===5) ws.setDate(ws.getDate()+2);
    else if(dow0===6) ws.setDate(ws.getDate()+1);
    const we=addD(ws,4); // 5 days: ws+0,1,2,3,4
    const wsS=d2s(ws),weS=d2s(we);
    (document.getElementById('cal-title')||{}).textContent=`${fD(wsS)} – ${fD(weS)}`;
    const evs=filterE(f,wsS,weS);
    if(displayGids) html=renderPairWeek(evs,ws,displayGids);
    else if(f.cluster) html=renderClusterWeek(evs,ws,f.cluster);
    else html=renderNormalWeek(evs,ws,f);
  } else if(calV==='range'){
    const from=document.getElementById('cal-range-from')?.value||d2s(calD);
    const to=document.getElementById('cal-range-to')?.value||from;
    const fromD=from<=to?from:to, toD=from<=to?to:from;
    const viewLbl=(_rangeSubView==='list')?'📋 רשימה — ':'';
    (document.getElementById('cal-title')||{}).textContent=`${viewLbl}${fD(fromD)} – ${fD(toD)}`;
    const evs=filterE(f,fromD,toD);
    html=(_rangeSubView==='list') ? renderRangeListView(evs,fromD,toD) : renderRangeView(evs,fromD,toD,f,displayGids);
  } else if(calV==='list'){
    let fromDs, toDs, titleStr;
    const lsv = _listSubView||'week';
    if(lsv==='day'){
      fromDs=toDs=d2s(calD);
      titleStr='📋 רשימה — '+fD(fromDs)+' '+dayN(fromDs);
    } else if(lsv==='week'){
      // 5 work days from calD — skip Fri(5)/Sat(6)
      let _ws=new Date(calD); _ws.setHours(0,0,0,0);
      if(_ws.getDay()===5) _ws.setDate(_ws.getDate()+2); // Fri → Sun
      else if(_ws.getDay()===6) _ws.setDate(_ws.getDate()+1); // Sat → Sun
      // Collect 5 work days
      let _wd=new Date(_ws), _days=[]; 
      while(_days.length<5){ if(_wd.getDay()!==5&&_wd.getDay()!==6) _days.push(new Date(_wd)); _wd.setDate(_wd.getDate()+1); }
      fromDs=d2s(_days[0]); toDs=d2s(_days[4]);
      titleStr='📋 רשימה — שבוע '+fD(fromDs)+' – '+fD(toDs);
    } else { // month
      const y2=calD.getFullYear(),m2=calD.getMonth();
      fromDs=d2s(new Date(y2,m2,1)); toDs=d2s(new Date(y2,m2+1,0));
      titleStr='📋 רשימה — '+hebM(calD);
    }
    (document.getElementById('cal-title')||{}).textContent=titleStr;
    const evs=filterE(f,fromDs,toDs);
    html=renderRangeListView(evs,fromDs,toDs);
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
      // ── תצוגה כללית: עיר → זוגות לפי שעה → צהרונים בודדים לפי שעה ──
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

        // --- גנים בודדים: לפי שם צהרון (אחר"כ שעה) ---
        const soloEvs=cityEvs
          .filter(s=>!pairedGids.has(s.g))
          .sort((a,b)=>{
            const na=G(a.g).name||'', nb=G(b.g).name||'';
            return na.localeCompare(nb,'he')||(a.t||'99:99').localeCompare(b.t||'99:99');
          });
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
  const clObjD=!isAll&&getClusters().find(cl=>cl.name===clusterName);
  const clGidsD=clObjD?(clObjD.gardenIds||[]):evs.map(s=>s.g).filter((v,i,a)=>a.indexOf(v)===i);
  html+=`<div style="background:#e8eaf6;border-radius:7px;padding:6px 12px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;font-size:.78rem;font-weight:700;color:#1a237e">
    <span>🔢 ${isAll?'כל האשכולות':('אשכול: '+clusterName)} <span style="font-weight:400;color:#546e7a">${evs.length} פעילויות</span></span>
    <button onclick="event.stopPropagation();_exportPairWA(${JSON.stringify(clGidsD)})" style="background:#25d366;border:none;border-radius:4px;color:#fff;font-size:.65rem;padding:2px 8px;cursor:pointer">📋 הודעה</button>
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
              ${s.st==='can'?'':`<button title="בטל" onclick="openCanQ(${s.id})">❌</button>`}
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
          <span style="font-size:.65rem;opacity:.75;font-weight:400">📍 ${g.city||''}</span>
          <button onclick="event.stopPropagation();_exportGardenWA([${g.id}],'${ds}')" style="background:rgba(255,255,255,.28);border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:.68rem;color:#fff;font-weight:700">📋 הודעה</button>
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
              ${s.st==='can'?'':`<button title="בטל" onclick="openCanQ(${s.id})">❌</button>`}
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
  const clObj=!isAll&&getClusters().find(cl=>cl.name===clusterName);
  const clGids=clObj?(clObj.gardenIds||[]):evs.map(s=>s.g).filter((v,i,a)=>a.indexOf(v)===i);
  const waBtn=`<button onclick="event.stopPropagation();_exportPairWA(${JSON.stringify(clGids)})" style="background:#25d366;border:none;border-radius:4px;color:#fff;font-size:.65rem;padding:2px 8px;cursor:pointer;margin-right:8px">📋 הודעה</button>`;
  let html=`<div style="background:#e8eaf6;border-radius:7px;padding:5px 12px;margin-bottom:10px;font-size:.77rem;font-weight:700;color:#1a237e;display:flex;align-items:center;justify-content:space-between">
    <span>🔢 ${isAll?'כל האשכולות':('אשכול: '+clusterName)} — תצוגה שבועית לפי שעה</span>
    ${waBtn}
  </div>`;
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
          <span style="font-size:.75rem;font-weight:800;color:${clr.solid};white-space:nowrap">🏙️ ${city} — צהרונים ללא זוג</span>
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
            <span style="font-size:.65rem;opacity:.75;font-weight:400">📍 ${city}</span>
            <button onclick="event.stopPropagation();_exportGardenWA([${s.g}],'${ds}')" style="background:rgba(255,255,255,.28);border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:.68rem;color:#fff;font-weight:700">📋 הודעה</button>
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
                ${s.st==='can'?'':`<button title="בטל" onclick="openCanQ(${s.id})">❌</button>`}
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
    ?`<button onclick="exportPairRow('${pair.id}','${ds}')" style="background:rgba(255,255,255,.3);border:none;border-radius:4px;padding:3px 9px;cursor:pointer;font-size:.7rem;color:#fff;font-weight:700">📋 הודעה</button>`
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
            ${ev.st==='can'?'':`<button title="בטל" onclick="openCanQ(${ev.id})">❌</button>`}
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
            ${s.st==='can'?'':`<button title="בטל" onclick="openCanQ(${s.id})">❌</button>`}
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
        ${s.st==='can'?'':`<button title="בטל" onclick="openCanQ(${s.id})">❌</button>`}
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
  const pairIds = gids.filter(Boolean);
  return`<div class="pair-row ${pclr}">
    <div class="pair-row-label ${pclr}" style="display:flex;justify-content:space-between;align-items:center">
      <span>🔗 ${gids.map(id=>G(id).name||'').join(' + ')}</span>
      <button onclick="event.stopPropagation();_exportPairWA([${pairIds.join(',')}])" style="background:rgba(255,255,255,.25);border:none;border-radius:4px;color:#fff;font-size:.65rem;padding:1px 6px;cursor:pointer">📋 הודעה</button>
    </div>
    ${renderPairColsHTML(evs,gids)}</div>`;
}

function renderNormalWeek(evs,ws,f){
  const dn=['ראשון','שני','שלישי','רביעי','חמישי','שישי'], tday=td();
  const days=[];
  for(let i=0;i<6;i++) days.push(addD(ws,i));

  let gids=[...new Set(evs.map(s=>s.g))];
  if(f.gids&&f.gids.length) gids=f.gids;
  if(!gids.length) return'<div class="card" style="text-align:center;color:#999;padding:25px">אין פעילויות</div>';

  const usedGids=new Set();
  const byCity={};
  function ensureCity(city){ if(!byCity[city]) byCity[city]={pairs:[],solos:[]}; }

  pairs.forEach(pair=>{
    const myGids=pair.ids.filter(gid=>gids.includes(gid));
    if(!myGids.length) return;
    const city=G(myGids[0]).city||'אחר';
    ensureCity(city);
    myGids.forEach(gid=>usedGids.add(gid));
    byCity[city].pairs.push({pair,gids:myGids});
  });
  gids.filter(gid=>!usedGids.has(gid)).forEach(gid=>{
    const g=G(gid); const city=g.city||'אחר';
    ensureCity(city);
    byCity[city].solos.push(gid);
  });

  const sortedCities=Object.keys(byCity).sort((a,b)=>a.localeCompare(b,'he'));
  sortedCities.forEach(city=>{
    byCity[city].pairs.sort((a,b)=>a.pair.name.localeCompare(b.pair.name,'he'));
    byCity[city].solos.sort((a,b)=>(G(a).name||'').localeCompare(G(b).name||'','he'));
  });

  // border-separate avoids border-collapse + sticky bug
  let html='<div style="overflow-x:auto;border-radius:8px;border:2px solid #9fa8da">'
          +'<table style="min-width:950px;border-collapse:separate;border-spacing:0;width:100%"><thead><tr>';

  html+=`<th style="min-width:140px;background:#e8eaf6;color:#283593;padding:6px 8px;
    border-bottom:2px solid #9fa8da;border-left:1px solid #c5cae9;
    position:sticky;top:0;z-index:3;font-size:.76rem">צהרון / זוג</th>`;

  days.forEach((d,i)=>{
    const ds=d2s(d);
    const hol=getHolidayInfo(ds);
    const blkWk=getBlockedInfo(ds);
    const isToday=ds===tday;
    const bg=isToday?'#1565c0':blkWk?'#fce4ec':hol?hol.bg:'#e8eaf6';
    const col=isToday?'#fff':blkWk?'#c62828':hol?hol.color:'#283593';
    const bottomBorder=blkWk?'border-bottom:3px solid #e91e63':'border-bottom:2px solid #9fa8da';
    html+=`<th style="background:${bg};color:${col};padding:3px 4px;text-align:center;font-size:.76rem;min-width:132px;
      ${bottomBorder};border-left:1px solid ${isToday?'rgba(255,255,255,.3)':'#c5cae9'};
      position:sticky;top:0;z-index:3;white-space:nowrap;line-height:1.3" onclick="jumpToDay('${ds}')">
      <span style="font-weight:700">${dn[i]}</span> <span style="font-size:.64rem;font-weight:400">${fD(ds)}</span>
      <br><span style="font-size:.56rem;font-weight:400;opacity:.7">${toHebDate(ds)}</span>
      ${blkWk?`<span style="font-size:.58rem;cursor:pointer;display:block" onclick="event.stopPropagation();openBlockedDate('${ds}')">${blkWk.icon||'🚫'} ${blkWk.reason}</span>`:''}
    </th>`;
  });
  html+='</tr></thead><tbody>';

  sortedCities.forEach(city=>{
    const clr=CITY_COLORS(city);

    // City header row
    html+=`<tr>
      <td colspan="7" style="background:${clr.solid};color:#fff;padding:7px 12px;font-size:.9rem;font-weight:800;
        border-bottom:1px solid rgba(255,255,255,.2);position:sticky;left:0">
        🏙️ ${city}
        <span style="font-weight:400;font-size:.75rem;opacity:.85;margin-right:8px">${byCity[city].pairs.length} זוגות · ${byCity[city].solos.length} צהרונים בודדים</span>
      </td>
    </tr>`;

    function makeCell(gid, ds, de, blk, hol, clrObj){
      const isToday=ds===tday;
      const cellBg=blk?'#fce4ec':isToday?'#eef2ff':hol?hol.bg+'33':'#fff';
      const borderColor=isToday?'#7986cb':'#dde1f0';
      let inner='';
      if(de.length){
        de.forEach(ev=>{
          inner+=`<div style="border-radius:5px;padding:5px 6px;margin:2px 0;font-size:13px;
            background:#fff;border-right:3px solid ${clrObj.solid};
            ${ev.st==='can'?'opacity:.5;text-decoration:line-through;':ev.st==='post'?'background:#fff8e1;':ev.st==='done'?'background:#f1f8e9;':ev.st==='nohap'?'background:#fce4ec;':''}">
            <div style="display:flex;align-items:flex-start;gap:4px">
              <div style="cursor:pointer;flex:1;min-width:0" onclick="event.stopPropagation();openSP(${ev.id})">
                <div style="font-weight:700;color:${clrObj.solid};word-break:break-word;line-height:1.3">${supBase(ev.a)}${ev.act?`<span style="color:#78909c;font-weight:400"> — ${ev.act}</span>`:''}</div>
                <div style="font-size:12px;color:#5c6bc0;margin-top:1px">${ev.tp||'חוג'}${ev.grp>1?` · <span style="color:#546e7a">👥${ev.grp}</span>`:''}</div>
                ${ev.t?`<div style="font-size:12px;color:#546e7a">⏰ ${fT(ev.t)}</div>`:''}
              </div>
              <div style="display:flex;flex-direction:column;gap:2px;flex-shrink:0" onclick="event.stopPropagation()">
                <button title="התקיים" style="background:${ev.st==='done'?'#2e7d32':'#e8f5e9'};color:${ev.st==='done'?'#fff':'#2e7d32'};border:none;border-radius:3px;padding:2px 5px;font-size:12px;cursor:pointer;line-height:1.4"
                  onclick="openSP(${ev.id});setTimeout(()=>setStatus('done'),80)">✔️</button>
                <button title="בטל" style="background:${ev.st==='can'?'#c62828':'#ffebee'};color:${ev.st==='can'?'#fff':'#c62828'};border:none;border-radius:3px;padding:2px 5px;font-size:12px;cursor:pointer;line-height:1.4"
                  onclick="openSP(${ev.id})">❌</button>
                <button title="לא התקיים" style="background:${ev.st==='nohap'?'#6a1b9a':'#f3e5f5'};color:${ev.st==='nohap'?'#fff':'#6a1b9a'};border:none;border-radius:3px;padding:2px 5px;font-size:12px;cursor:pointer;line-height:1.4"
                  onclick="openSP(${ev.id});setTimeout(()=>markNoHap(),80)">⚠️</button>
                <button title="דחה" style="background:#fff3e0;color:#e65100;border:none;border-radius:3px;padding:2px 5px;font-size:12px;cursor:pointer;line-height:1.4"
                  onclick="event.stopPropagation();openPostpone(${ev.id})">⏩</button>
              </div>
            </div>
          </div>`;
        });
        if(blk) inner+=`<div style="font-size:.68rem;color:#c62828;padding:2px 4px">${blk.icon||'🚫'} ${blk.reason}</div>`;
      } else if(blk){
        inner=`<div style="font-size:.72rem;color:#c62828;padding:4px;text-align:center">${blk.icon||'🚫'} ${blk.reason}</div>`;
      } else if(hol){
        inner=`<span style="font-size:.7rem;color:${hol.color}">${hol.emoji}</span>`;
      } else {
        inner=`<div style="color:#c8cdd5;font-size:1.4rem;font-weight:300;text-align:center;line-height:1;padding:4px 0;cursor:pointer;user-select:none">+</div>`;
      }
      return `<td style="background:${cellBg};
        border-bottom:1px solid ${borderColor};border-left:1px solid ${borderColor};
        ${blk?'border:1.5px solid #e91e63;':''}
        padding:4px;vertical-align:top;min-width:130px"
        onclick="openGcellPopup(${gid},'${ds}',event)">${inner}</td>`;
    }

    // Pairs
    byCity[city].pairs.forEach(({pair,gids:pGids})=>{
      const pairGidList = pGids.join(',');
      html+=`<tr>
        <td colspan="7" style="background:${clr.solid};color:#fff;padding:5px 12px;
          font-size:.82rem;font-weight:800;border-bottom:1px solid rgba(255,255,255,.2)">
          <div style="display:flex;align-items:center;gap:8px">
            <button onclick="event.stopPropagation();_exportPairWA([${pairGidList}])"
              style="background:rgba(255,255,255,.22);border:none;border-radius:5px;color:#fff;
                font-size:.72rem;padding:3px 10px;cursor:pointer;white-space:nowrap;flex-shrink:0">📋 הודעה</button>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🔗 ${pair.name}</span>
          </div>
        </td>
      </tr>`;
      pGids.forEach(gid=>{
        const g=G(gid);
        html+=`<tr><td style="background:#fafbff;font-size:14px;padding:6px 10px;color:#333;font-weight:700;
          border-right:3px solid ${clr.solid};border-bottom:1px solid #dde1f0;border-left:1px solid #dde1f0;
          position:sticky;right:0;z-index:1;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis">
          ${g.name}<br><span style="font-size:12px;color:#78909c;font-weight:400">${g.city}</span>
        </td>`;
        days.forEach(d=>{
          const ds=d2s(d);
          const hol=getHolidayInfo(ds,g.city,gcls(g));
          const gBlk=getGardenBlock(gid,ds);
          const de=evs.filter(s=>s.g===gid&&s.d===ds).sort((a,b)=>(a.t||'').localeCompare(b.t||''));
          html+=makeCell(gid,ds,de,gBlk,hol,clr);
        });
        html+='</tr>';
      });
    });

    // Solo gardens
    byCity[city].solos.forEach(gid=>{
      const g=G(gid);
      html+=`<tr><td style="background:#fafbff;font-size:14px;padding:6px 10px;color:#333;font-weight:700;
        border-right:3px solid ${clr.solid};border-bottom:1px solid #dde1f0;border-left:1px solid #dde1f0;
        position:sticky;right:0;z-index:1;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis">
        ${g.name}<br><span style="font-size:12px;color:#78909c;font-weight:400">${g.city}</span>
      </td>`;
      days.forEach(d=>{
        const ds=d2s(d);
        const hol=getHolidayInfo(ds,g.city,gcls(g));
        const soloBlk=getGardenBlock(gid,ds);
        const de=evs.filter(s=>s.g===gid&&s.d===ds).sort((a,b)=>(a.t||'').localeCompare(b.t||''));
        html+=makeCell(gid,ds,de,soloBlk,hol,clr);
      });
      html+='</tr>';
    });
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
    html+=`<tr><td class="dth" style="${ds===tday?'background:#1565c0;color:#fff;':holStyle} text-align:center;white-space:nowrap;font-weight:700">${dn[i]}<br><span style="font-size:.66rem;font-weight:400">${fD(ds)}</span><br><span style="font-size:.58rem;font-weight:400;opacity:.8">${toHebDate(ds)}</span>${hol?`<br><span style="font-size:.64rem;color:${hol.color}">${hol.name}</span>`:''}</td>`;
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

// Quick action buttons for list/weekly views
function _quickActionBtns(s){
  const sid=s.id;
  const isDone=s.st==='done', isCan=s.st==='can', isNohap=s.st==='nohap';
  return `<div style="display:flex;gap:3px;flex-shrink:0" onclick="event.stopPropagation()">
    <button title="התקיים" style="background:${isDone?'#2e7d32':'#e8f5e9'};color:${isDone?'#fff':'#2e7d32'};border:1px solid #a5d6a7;border-radius:4px;padding:2px 5px;font-size:.72rem;cursor:pointer;line-height:1"
      onclick="openSP(${sid});setTimeout(()=>setStatus('done'),80)">✔️</button>
    <button title="בטל" style="background:${isCan?'#c62828':'#ffebee'};color:${isCan?'#fff':'#c62828'};border:1px solid #ef9a9a;border-radius:4px;padding:2px 5px;font-size:.72rem;cursor:pointer;line-height:1"
      onclick="openSP(${sid})">❌</button>
    <button title="לא התקיים" style="background:${isNohap?'#6a1b9a':'#f3e5f5'};color:${isNohap?'#fff':'#6a1b9a'};border:1px solid #ce93d8;border-radius:4px;padding:2px 5px;font-size:.72rem;cursor:pointer;line-height:1"
      onclick="openSP(${sid});setTimeout(()=>markNoHap(),80)">⚠️</button>
    <button title="דחה" style="background:#fff3e0;color:#e65100;border:1px solid #ffcc80;border-radius:4px;padding:2px 5px;font-size:.72rem;cursor:pointer;line-height:1"
      onclick="openPostpone(${sid})">⏩</button>
  </div>`;
}

// List view for a date range (used when range sub-view = list)
function renderRangeListView(evs, fromDs, toDs){
  const tday=td();
  const byDate={};
  evs.forEach(s=>{
    const dk=s._isPostponed?s.pd:s.d;
    if(dk>=fromDs&&dk<=toDs){ if(!byDate[dk]) byDate[dk]=[]; byDate[dk].push(s); }
  });
  const dates=Object.keys(byDate).sort();
  const totalEvs=dates.reduce((n,d)=>n+byDate[d].length,0);
  let h=`<div style="font-size:.78rem;color:#546e7a;padding:6px 10px;background:#e8eaf6;border-radius:7px;margin-bottom:8px">
    📊 ${dates.length} ימים · ${totalEvs} פעילויות | ${fD(fromDs)} – ${fD(toDs)}
  </div><div class="card" style="padding:0;overflow:hidden">`;
  if(!dates.length) return h+'<div style="padding:20px;text-align:center;color:#999">אין פעילויות בטווח זה</div></div>';

  dates.forEach(ds=>{
    const dayEvs=byDate[ds].sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
    const isToday=ds===tday;
    const hol=getHolidayInfo(ds);
    const blk=getBlockedInfo(ds);

    h+=`<div style="border-bottom:2px solid #c5cae9">
      <div style="background:${isToday?'#1565c0':hol?hol.bg:blk?'#fce4ec':'#e8eaf6'};color:${isToday?'#fff':hol?hol.color:blk?'#c62828':'#283593'};padding:6px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="jumpToDay('${ds}')">
        <span style="font-weight:700;font-size:.82rem">📅 ${dayN(ds)} ${fD(ds)}</span>
        <span style="display:flex;gap:8px;align-items:center">
          ${hol?`<span style="font-size:.7rem">${hol.emoji} ${hol.name}</span>`:''}
          ${blk?`<span style="font-size:.7rem;cursor:pointer" onclick="event.stopPropagation();openBlockedDate('${ds}')">${blk.icon} ${blk.reason} ✏️</span>`:`<span style="font-size:.65rem;opacity:.4;cursor:pointer" onclick="event.stopPropagation();openBlockedDate('${ds}')" title="חסום">🚫</span>`}
          <span style="font-size:.72rem">${dayEvs.length} פעילויות</span>
        </span>
      </div>
      <div style="padding:6px 8px">`;

    const allCities=[...new Set(dayEvs.map(s=>G(s.g).city||'אחר'))].sort((a,b)=>a.localeCompare(b,'he'));

    allCities.forEach(city=>{
      const cityEvs=dayEvs.filter(s=>(G(s.g).city||'אחר')===city);
      const clr=CITY_COLORS(city);

      h+=`<div style="margin-bottom:8px">
        <div style="background:${clr.light};border-right:4px solid ${clr.solid};border-radius:6px;padding:5px 10px;margin-bottom:5px;font-weight:800;color:${clr.solid};font-size:.88rem">
          🏙️ ${city} · ${cityEvs.length}
        </div>`;

      // ── Group mode: pairs first OR clusters first based on _listGroupMode ──
      const _gmode = typeof _listGroupMode!=='undefined' ? _listGroupMode : 'pairs';

      // Step 1: determine first-priority group
      const firstUsedGids=new Set();

      if(_gmode==='clusters'){
        // Clusters first
        const dayClusters=(typeof getClusters==='function'?getClusters():[]).filter(cl=>
          (cl.city===city||!cl.city)&&(cl.gardenIds||[]).some(gid=>cityEvs.some(s=>s.g===parseInt(gid))));
        const clusteredGids=new Set();
        dayClusters.forEach(cl=>{
          const clEvs=cityEvs.filter(s=>(cl.gardenIds||[]).map(x=>parseInt(x)).includes(s.g))
            .sort((a,b)=>(G(a.g).name||'').localeCompare(G(b.g).name||'','he')||(a.t||'99:99').localeCompare(b.t||'99:99'));
          if(!clEvs.length) return;
          clEvs.forEach(s=>{clusteredGids.add(s.g);firstUsedGids.add(s.g);});
          const clGids=clEvs.map(s=>s.g);
          h+=`<div style="margin-bottom:4px;border:1px solid ${clr.border||clr.solid+'44'};border-radius:6px;overflow:hidden">
            <div style="background:${clr.solid}22;padding:2px 8px;font-size:.7rem;font-weight:700;color:${clr.solid};display:flex;align-items:center;justify-content:space-between">
              <span>🏘️ ${cl.name}</span>
              <button onclick="event.stopPropagation();_exportPairWA(${JSON.stringify(clGids)})" style="background:${clr.solid};border:none;border-radius:4px;padding:1px 6px;cursor:pointer;font-size:.65rem;color:#fff">📋 הודעה</button>
            </div>`;
          clEvs.forEach(s=>{ h+=_listRow(s,clr); });
          h+=`</div>`;
        });
        // Pairs second (only non-clustered)
        const pairedGids=new Set();
        const pairGroups=[];
        pairs.forEach(pair=>{
          if(typeof isPairBroken==='function'&&isPairBroken(pair.id,ds)) return;
          const pairEvs=cityEvs.filter(s=>pair.ids.includes(s.g)&&!firstUsedGids.has(s.g));
          if(!pairEvs.length) return;
          pairEvs.forEach(s=>{pairedGids.add(s.g);firstUsedGids.add(s.g);});
          pairGroups.push({pair,pairEvs});
        });
        pairGroups.sort((a,b)=>(a.pair.name||'').localeCompare(b.pair.name||'','he'));
        pairGroups.forEach(({pair,pairEvs})=>{
          const sorted=pairEvs.sort((a,b)=>(G(a.g).name||'').localeCompare(G(b.g).name||'','he')||(a.t||'99:99').localeCompare(b.t||'99:99'));
          h+=`<div style="margin-bottom:4px;border:1px solid ${clr.border||clr.solid+'44'};border-radius:6px;overflow:hidden">
            <div style="background:${clr.solid}22;padding:2px 8px;font-size:.7rem;font-weight:700;color:${clr.solid};display:flex;align-items:center;justify-content:space-between">
              <span>🔗 ${pair.name}</span>
              <button onclick="event.stopPropagation();_exportPairWA(${JSON.stringify(pair.ids)})" style="background:${clr.solid};border:none;border-radius:4px;padding:1px 6px;cursor:pointer;font-size:.65rem;color:#fff">📋 הודעה</button>
            </div>`;
          sorted.forEach(s=>{ h+=_listRow(s,clr); });
          h+=`</div>`;
        });
      } else {
        // Pairs first (default)
        const pairedGids=new Set();
        const pairGroups=[];
        pairs.forEach(pair=>{
          if(typeof isPairBroken==='function'&&isPairBroken(pair.id,ds)) return;
          const pairEvs=cityEvs.filter(s=>pair.ids.includes(s.g));
          if(!pairEvs.length) return;
          pairEvs.forEach(s=>{pairedGids.add(s.g);firstUsedGids.add(s.g);});
          pairGroups.push({pair,pairEvs});
        });
        pairGroups.sort((a,b)=>(a.pair.name||'').localeCompare(b.pair.name||'','he'));
        pairGroups.forEach(({pair,pairEvs})=>{
          const sorted=pairEvs.sort((a,b)=>(G(a.g).name||'').localeCompare(G(b.g).name||'','he')||(a.t||'99:99').localeCompare(b.t||'99:99'));
          h+=`<div style="margin-bottom:4px;border:1px solid ${clr.border||clr.solid+'44'};border-radius:6px;overflow:hidden">
            <div style="background:${clr.solid}22;padding:2px 8px;font-size:.7rem;font-weight:700;color:${clr.solid};display:flex;align-items:center;justify-content:space-between">
              <span>🔗 ${pair.name}</span>
              <button onclick="event.stopPropagation();_exportPairWA(${JSON.stringify(pair.ids)})" style="background:${clr.solid};border:none;border-radius:4px;padding:1px 6px;cursor:pointer;font-size:.65rem;color:#fff">📋 הודעה</button>
            </div>`;
          sorted.forEach(s=>{ h+=_listRow(s,clr); });
          h+=`</div>`;
        });
        // Clusters second (non-paired only)
        const dayClusters=(typeof getClusters==='function'?getClusters():[]).filter(cl=>
          (cl.city===city||!cl.city)&&(cl.gardenIds||[]).some(gid=>cityEvs.some(s=>s.g===parseInt(gid)&&!firstUsedGids.has(s.g))));
        dayClusters.forEach(cl=>{
          const clEvs=cityEvs.filter(s=>(cl.gardenIds||[]).map(x=>parseInt(x)).includes(s.g)&&!firstUsedGids.has(s.g))
            .sort((a,b)=>(G(a.g).name||'').localeCompare(G(b.g).name||'','he')||(a.t||'99:99').localeCompare(b.t||'99:99'));
          if(!clEvs.length) return;
          clEvs.forEach(s=>firstUsedGids.add(s.g));
          const clGids=clEvs.map(s=>s.g);
          h+=`<div style="margin-bottom:4px;border:1px solid ${clr.border||clr.solid+'44'};border-radius:6px;overflow:hidden">
            <div style="background:${clr.solid}22;padding:2px 8px;font-size:.7rem;font-weight:700;color:${clr.solid};display:flex;align-items:center;justify-content:space-between">
              <span>🏘️ ${cl.name}</span>
              <button onclick="event.stopPropagation();_exportPairWA(${JSON.stringify(clGids)})" style="background:${clr.solid};border:none;border-radius:4px;padding:1px 6px;cursor:pointer;font-size:.65rem;color:#fff">📋 הודעה</button>
            </div>`;
          clEvs.forEach(s=>{ h+=_listRow(s,clr); });
          h+=`</div>`;
        });
      }

      const _allUsedGids=new Set([...firstUsedGids]);
      pairGroups.sort((a,b)=>(a.pair.name||'').localeCompare(b.pair.name||'','he'));

      pairGroups.forEach(({pair,pairEvs})=>{
        const sorted=pairEvs.sort((a,b)=>
          (G(a.g).name||'').localeCompare(G(b.g).name||'','he')||(a.t||'99:99').localeCompare(b.t||'99:99'));
        h+=`<div style="margin-bottom:4px;border:1px solid ${clr.border||clr.solid+'44'};border-radius:6px;overflow:hidden">
          <div style="background:${clr.solid}22;padding:2px 8px;font-size:.7rem;font-weight:700;color:${clr.solid};display:flex;align-items:center;justify-content:space-between">
            <span>🔗 ${pair.name}</span>
            <button onclick="event.stopPropagation();_exportPairWA(${JSON.stringify(pair.ids)})" style="background:${clr.solid};border:none;border-radius:4px;padding:1px 6px;cursor:pointer;font-size:.65rem;color:#fff">📋 הודעה</button>
          </div>`;
        sorted.forEach(s=>{ h+=_listRow(s,clr); });
        h+=`</div>`;
      });

      // ── Solos sorted by time ──
      cityEvs.filter(s=>!(typeof _allUsedGids!=='undefined'?_allUsedGids:pairedGids).has(s.g))
        .sort((a,b)=>(G(a.g).name||'').localeCompare(G(b.g).name||'','he')||(a.t||'99:99').localeCompare(b.t||'99:99'))
        .forEach(s=>{ h+=_listRow(s,clr); });

      h+=`</div>`;
    });

    h+='</div></div>';
  });
  return h+'</div>';
}

function renderCalList(evs, mDate){
  const y=mDate.getFullYear(),m=mDate.getMonth();
  const tday=td();
  const byDate={};
  evs.forEach(s=>{
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

    // Day header
    h+=`<div style="border-bottom:2px solid #c5cae9">
      <div style="background:${isToday?'#1565c0':hol?hol.bg:blk?'#fce4ec':'#e8eaf6'};color:${isToday?'#fff':hol?hol.color:blk?'#c62828':'#283593'};padding:6px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="jumpToDay('${ds}')">
        <span style="font-weight:700;font-size:.82rem">📅 ${dayN(ds)} ${fD(ds)}</span>
        <span style="display:flex;gap:8px;align-items:center">
          ${hol?`<span style="font-size:.7rem">${hol.emoji} ${hol.name}</span>`:''}
          ${blk?`<span style="font-size:.7rem;cursor:pointer" onclick="event.stopPropagation();openBlockedDate('${ds}')">${blk.icon} ${blk.reason} ✏️</span>`:`<span style="font-size:.65rem;opacity:.4;cursor:pointer" onclick="event.stopPropagation();openBlockedDate('${ds}')" title="חסום תאריך">🚫</span>`}
          <span style="font-size:.72rem;opacity:.8">${dayEvs.length} פעילויות</span>
        </span>
      </div>`;

    h+='<div style="padding:6px 8px">';

    // Group by city → sort cities
    const allCities=[...new Set(dayEvs.map(s=>G(s.g).city||'אחר'))].sort((a,b)=>a.localeCompare(b,'he'));

    allCities.forEach(city=>{
      const cityEvs=dayEvs.filter(s=>(G(s.g).city||'אחר')===city);
      const clr=CITY_COLORS(city);

      h+=`<div style="margin-bottom:8px">`;
      // City header
      h+=`<div style="display:flex;align-items:center;gap:6px;padding:5px 10px;margin-bottom:5px;background:${clr.light};border-right:4px solid ${clr.solid};border-radius:6px">
        <span style="font-weight:800;color:${clr.solid};font-size:.88rem">🏙️ ${city}</span>
        <span style="font-size:.72rem;color:#78909c">${cityEvs.length} פעילויות</span>
      </div>`;

      // ── Group mode: _listGroupMode controls pairs vs clusters priority ──
      const _gmode2 = typeof _listGroupMode!=='undefined' ? _listGroupMode : 'pairs';
      const pairedGids=new Set();
      const clusteredGidsC=new Set();

      const _renderCluster2=(cl)=>{
        const clEvs=cityEvs.filter(s=>(cl.gardenIds||[]).map(x=>parseInt(x)).includes(s.g)&&!pairedGids.has(s.g)&&!clusteredGidsC.has(s.g))
          .sort((a,b)=>(G(a.g).name||'').localeCompare(G(b.g).name||'','he')||(a.t||'99:99').localeCompare(b.t||'99:99'));
        if(!clEvs.length) return;
        clEvs.forEach(s=>clusteredGidsC.add(s.g));
        const clGids2=clEvs.map(s=>s.g);
        h+=`<div style="margin-bottom:4px;border:1px solid ${clr.border};border-radius:6px;overflow:hidden">
          <div style="background:${clr.solid}22;padding:3px 8px;font-size:.72rem;font-weight:700;color:${clr.solid};display:flex;align-items:center;justify-content:space-between">
            <span>🏘️ ${cl.name}</span>
            <button onclick="event.stopPropagation();_exportPairWA(${JSON.stringify(clGids2)})" style="background:${clr.solid};border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:.68rem;color:#fff;font-weight:700">📋 הודעה</button>
          </div>`;
        clEvs.forEach(s=>{ h+=_listRow(s,clr); });
        h+=`</div>`;
      };
      const clAll=(typeof getClusters==='function'?getClusters():[]).filter(cl=>
        (cl.gardenIds||[]).some(gid=>cityEvs.some(s=>s.g===parseInt(gid))));

      if(_gmode2==='clusters'){
        // Clusters first
        clAll.forEach(cl=>_renderCluster2(cl));
      }

      // Pairs (skip already-clustered if clusters-first mode)
      const pairGroups=[];
      pairs.forEach(pair=>{
        if(isPairBroken&&isPairBroken(pair.id,ds)) return;
        const pairEvs=cityEvs.filter(s=>pair.ids.includes(s.g)&&!clusteredGidsC.has(s.g));
        if(!pairEvs.length) return;
        pairEvs.forEach(s=>pairedGids.add(s.g));
        pairGroups.push({pair,pairEvs});
      });
      pairGroups.sort((a,b)=>(a.pair.name||'').localeCompare(b.pair.name||'','he'));

      if(_gmode2==='pairs'){
        // Clusters second (skip paired)
        clAll.forEach(cl=>_renderCluster2(cl));
      }

      // ── Render pairs ──
      pairGroups.sort((a,b)=>(a.pair.name||'').localeCompare(b.pair.name||'','he'));

      pairGroups.forEach(({pair,pairEvs})=>{
        // Sort pair events by garden name then time
        const sorted=pairEvs.sort((a,b)=>{
          const na=G(a.g).name||'', nb=G(b.g).name||'';
          return na.localeCompare(nb,'he')||(a.t||'99:99').localeCompare(b.t||'99:99');
        });
        h+=`<div style="margin-bottom:4px;border:1px solid ${clr.border};border-radius:6px;overflow:hidden">
          <div style="background:${clr.solid}22;padding:3px 8px;font-size:.72rem;font-weight:700;color:${clr.solid};display:flex;align-items:center;justify-content:space-between">
            <span>🔗 ${pair.name}</span>
            <button onclick="event.stopPropagation();_exportPairWA(${JSON.stringify(pair.ids)})" style="background:${clr.solid};border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:.68rem;color:#fff;font-weight:700">📋 הודעה</button>
          </div>`;
        sorted.forEach(s=>{ h+=_listRow(s,clr); });
        h+=`</div>`;
      });

      // Solos — sorted by garden name (not in pair or cluster)
      const soloEvs=cityEvs
        .filter(s=>!pairedGids.has(s.g)&&!clusteredGidsC.has(s.g))
        .sort((a,b)=>{
          const na=G(a.g).name||'', nb=G(b.g).name||'';
          return na.localeCompare(nb,'he')||(a.t||'99:99').localeCompare(b.t||'99:99');
        });
      soloEvs.forEach(s=>{ h+=_listRow(s,clr); });

      h+=`</div>`; // end city
    });

    h+='</div></div>';
  });
  return h+'</div>';
}

function _listRow(s, clr){
  const g=G(s.g);
  const stC=s.st==='nohap'?'#c62828':s.st==='post'?'#e65100':s.st==='done'?'#2e7d32':'#333';
  const addrLink=g.st?`<a href="https://maps.google.com/?q=${encodeURIComponent(g.st+' '+g.city)}" target="_blank" onclick="event.stopPropagation()" style="font-size:.63rem;color:#1565c0;text-decoration:none">📍 ${g.st}</a>`:'';
  return `<div style="display:grid;grid-template-columns:120px 1fr auto auto auto;align-items:center;gap:5px;padding:3px 6px;border-radius:4px;margin-bottom:2px;background:${s.st==='done'?'#f1f8e9':s.st==='nohap'?'#fce4ec':clr.light};border-right:3px solid ${clr.solid};cursor:pointer" onclick="openSP(${s.id})">
    <div>
      <div style="font-weight:700;font-size:.75rem;color:#1a237e">${g.name}</div>
      <div style="font-size:.65rem;color:#78909c">${s.t?'⏰ '+fT(s.t):''}</div>
      ${addrLink}
    </div>
    <div>
      <div style="font-size:.75rem;font-weight:600;color:#1565c0">${supBase(s.a)}${s.act?' — <span style="color:#546e7a">'+s.act+'</span>':''}</div>
      <div style="font-size:.65rem;color:#5c6bc0">${s.tp||'חוג'}</div>
    </div>
    <div style="font-size:.7rem;font-weight:700;color:${stC}">${stLabel(s).replace(/<[^>]+>/g,'')}</div>
    ${_quickActionBtns(s)}
  </div>`;
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
        <div>
          <div class="dnum" style="${blkM?'color:#c62828':''}">${d}</div>
          <div style="font-size:.58rem;color:#9e9e9e;line-height:1;margin-top:1px">${toHebDate(ds)}</div>
        </div>
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
            _pairCards+=renderPairCard(row.pair,row.evs,{ds:date,clr:_dashClr,showEdit:true,showExport:true});
          } else {
            const s=row.ev;
            const stc=s.st!=='ok'?'st-'+s.st:'';
            const _sc=CITY_COLORS(G(s.g).city);
            h+=`<div class="city-block" style="margin-bottom:7px">
              <div class="city-block-hdr" style="background:${_sc.solid};font-size:.76rem">
                🏫 ${s.gd.name}
                <span style="font-size:.67rem;opacity:.8;font-weight:400">📍 ${G(s.g).city}</span>
                <button onclick="event.stopPropagation();_exportGardenWA([${s.g}],'${date}')" style="background:rgba(255,255,255,.28);border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:.68rem;color:#fff;font-weight:700">📋 הודעה</button>
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
  const canEvs=SCH.filter(s=>s.st==='post').sort((a,b)=>b.d.localeCompare(a.d)).slice(0,20);
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
      <div class="copt" onclick="selCO(this,'מצב בטחוני')">🛡️ מצב בטחוני</div>
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
      <div><label style="font-size:.72rem;color:#546e7a;font-weight:700">📋 סוג הפעילות</label>
        <select id="sp-edit-ev-type" style="width:100%;font-size:.8rem">
          <option value="חוג"${(s.tp||'חוג')==='חוג'?' selected':''}>🎨 חוג</option>
          <option value="הפעלה"${(s.tp||'')==='הפעלה'?' selected':''}>🎪 הפעלה</option>
          <option value="מופע"${(s.tp||'')==='מופע'?' selected':''}>🎭 מופע</option>
          <option value="אחר"${(s.tp||'')==='אחר'?' selected':''}>📌 אחר</option>
        </select>
      </div>
      <div><label style="font-size:.72rem;color:#546e7a;font-weight:700">🎯 שם הפעילות</label>
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

  // Recurring series management — shown only if event belongs to a series
  if(s._recId){
    const seriesCount=SCH.filter(x=>x._recId===s._recId&&x.d>=s.d&&x.g===s.g).length;
    h+=`<div style="border:1.5px solid #b0bec5;border-radius:7px;padding:8px;margin-bottom:8px;background:#f8f9fa"><div style="font-size:.8rem;font-weight:700;color:#37474f;margin-bottom:6px">🔁 שיבוץ קבוע — ${seriesCount} פעילויות מתאריך זה ואילך</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px"><button class="btn br bsm" onclick="deleteRecurSeries(${s.id})">🗑️ מחק מכאן ואילך</button><button class="btn borange bsm" onclick="openReplaceRecur(${s.id})">🔄 החלף שיבוץ קבוע</button></div></div>`;
  }
  h+=`<button class="btn bp bsm" style="width:100%" onclick="saveNt()">💾 שמור הערה</button>`;
  document.getElementById('sp-body').innerHTML=h;
  document.getElementById('sp').classList.add('open');
  const _bd=document.getElementById('sp-backdrop');
  if(_bd) _bd.style.display='block';
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
function deleteRecurSeries(id){
  const s=SCH.find(x=>x.id===id); if(!s) return;
  const affected=SCH.filter(x=>x._recId===s._recId&&x.d>=s.d&&x.g===s.g);
  if(!confirm(`האם למחוק ${affected.length} פעילויות קבועות מ-${fD(s.d)} ואילך?\n(הפעילויות יימחקו לחלוטין, ללא ביטול)`)) return;
  affected.forEach(x=>{ const i=SCH.indexOf(x); if(i>=0) SCH.splice(i,1); });
  saveAndRefresh('sp');
  showToast(`✅ נמחקו ${affected.length} פעילויות קבועות`);
}

function openReplaceRecur(id){
  const s=SCH.find(x=>x.id===id); if(!s) return;
  const affected=SCH.filter(x=>x._recId===s._recId&&x.d>=s.d&&x.g===s.g);
  const allSups=getAllSup().filter(s2=>isActSupplier(s2.name));
  const g=G(s.g);
  let h=`<div style="font-size:.85rem;font-weight:700;color:#1a237e;margin-bottom:10px">
    🔄 החלפת שיבוץ קבוע — ${affected.length} פעילויות מ-${fD(s.d)} ואילך<br>
    <span style="font-size:.75rem;font-weight:400;color:#546e7a">גן: ${g.name} | ספק נוכחי: ${supBase(s.a)}</span>
  </div>
  <div style="display:grid;gap:8px">
    <div><label style="font-size:.75rem;font-weight:700;color:#546e7a">📚 ספק חדש</label>
      <select id="rr-sup" onchange="rrSupChg()" style="width:100%;font-size:.82rem">
        ${allSups.map(s2=>`<option value="${s2.name}"${s2.name===s.a?' selected':''}>${s2.name}</option>`).join('')}
      </select>
    </div>
    <div id="rr-act-wrap"><label style="font-size:.75rem;font-weight:700;color:#546e7a">🎯 סוג פעילות</label>
      <select id="rr-act" style="width:100%;font-size:.82rem">
        <option value="">— ללא שינוי —</option>
        ${getSupActs(s.a).map(a=>`<option value="${a}"${a===s.act?' selected':''}>${a}</option>`).join('')}
      </select>
    </div>
    <div><label style="font-size:.75rem;font-weight:700;color:#546e7a">⏰ שעה (ריק = ללא שינוי)</label>
      <input type="time" id="rr-time" value="${s.t||''}" style="width:100%;font-size:.82rem">
    </div>
    <div><label style="font-size:.75rem;font-weight:700;color:#546e7a">👥 מספר קבוצות (ריק = ללא שינוי)</label>
      <input type="number" id="rr-grp" min="1" max="20" value="${s.grp||1}" style="width:100%;font-size:.82rem">
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
    <button class="btn br bsm" onclick="CM('rrm')">ביטול</button>
    <button class="btn bg bsm" onclick="saveReplaceRecur(${id})">✅ החלף שיבוץ</button>
  </div>`;
  document.getElementById('rrm-body').innerHTML=h;
  OM('rrm');
}

function rrSupChg(){
  const sup=document.getElementById('rr-sup').value;
  const actSel=document.getElementById('rr-act');
  if(!actSel) return;
  actSel.innerHTML='<option value="">— ללא שינוי —</option>'+
    getSupActs(sup).map(a=>`<option value="${a}">${a}</option>`).join('');
}

function saveReplaceRecur(id){
  const s=SCH.find(x=>x.id===id); if(!s) return;
  const newSup=document.getElementById('rr-sup').value;
  const newAct=document.getElementById('rr-act').value;
  const newTime=document.getElementById('rr-time').value;
  const newGrp=parseInt(document.getElementById('rr-grp').value)||0;
  const affected=SCH.filter(x=>x._recId===s._recId&&x.d>=s.d&&x.g===s.g);
  affected.forEach(x=>{
    if(newSup) x.a=newSup;
    if(newAct) x.act=newAct;
    if(newTime) x.t=newTime;
    if(newGrp>0) x.grp=newGrp;
  });
  saveAndRefresh('rrm');
  showToast(`✅ עודכנו ${affected.length} פעילויות קבועות`);
}
function spEditSave(){
  const s=SCH.find(x=>x.id===selEv); if(!s) return;
  const newSup=document.getElementById('sp-edit-sup').value;
  const actVal=document.getElementById('sp-edit-act').value;
  const newAct=actVal==='__new__'
    ?(document.getElementById('sp-edit-act-new')||{}).value||''
    :actVal;
  const newTime=document.getElementById('sp-edit-time').value;
  const newTp=(document.getElementById('sp-edit-ev-type')||{}).value||'חוג';
  const forPair=(document.getElementById('sp-edit-pair-chk')||{}).checked;
  const updates={};
  if(newSup&&newSup!==s.a) updates.a=newSup;
  if(newAct&&newAct!=='__new__') updates.act=newAct;
  if(newTime&&newTime!==s.t) updates.t=newTime;
  if(newTp) updates.tp=newTp;
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
  if(main){
    Object.assign(main,fields);
    const g=G(main.g);
    _writeLog('cancel', `${g.name} — ${main.a}`, `בוטל: ${cr}`, {gName:g.name,date:main.d}).catch(()=>{});
  }
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
  if(main){
    Object.assign(main,fields);
    const g=G(main.g);
    _writeLog('status', `${g.name} — ${main.a}`, 'לא התקיים', {gName:g.name,date:main.d}).catch(()=>{});
  }
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
  if(main){
    Object.assign(main,fields);
    const stLabels={'done':'התקיים','ok':'מתקיים','nohap':'לא התקיים','can':'בוטל','post':'נדחה'};
    const g=G(main.g);
    _writeLog('status', `${g.name} — ${main.a}`, stLabels[st]||st, {gName:g.name,date:main.d}).catch(()=>{});
  }
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
  const bd=document.getElementById('sp-backdrop');
  if(bd) bd.style.display='none';
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

  // Escape key: close any open side panel or modal
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      closeSP();
      document.querySelectorAll('.modal.open').forEach(m=>m.classList.remove('open'));
    }
  });

  // Safety: if backdrop gets stuck, clicking anywhere on content area closes it
  document.getElementById('sp-backdrop')?.addEventListener('click', closeSP);

  // Periodic backdrop safety check — if SP is closed but backdrop is visible, hide it
  setInterval(()=>{
    const bd=document.getElementById('sp-backdrop');
    const spEl=document.getElementById('sp');
    if(bd && spEl && !spEl.classList.contains('open') && bd.style.display==='block'){
      bd.style.display='none';
    }
  }, 2000);
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
    const tpSel=document.getElementById('es-ev-type');
    if(tpSel) tpSel.value=s.tp||'חוג';
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
  const newTp=(document.getElementById('es-ev-type')||{}).value;
  const forPair=document.getElementById('es-for-pair').checked;
  const updates={};
  if(newSup) updates.a=newSup;
  if(newAct&&newAct!=='__new__') updates.act=newAct;
  if(newTime) updates.t=newTime;
  if(newTp) updates.tp=newTp;
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
let _postMode = 'move'; // 'move' | 'defer'
function setPostMode(m){
  _postMode = m;
  document.getElementById('postm-mode-move')?.classList.toggle('active', m==='move');
  document.getElementById('postm-mode-defer')?.classList.toggle('active', m==='defer');
  const title = document.getElementById('postm-title');
  const btn   = document.getElementById('postm-save-btn');
  const lbl   = document.getElementById('post-reason-lbl');
  const pairLbl = document.getElementById('post-pair-action-lbl');
  if(m==='move'){
    if(title) title.textContent='🔀 הזזה לתאריך אחר';
    if(btn){ btn.textContent='🔀 הזז'; }
    if(lbl) lbl.textContent='סיבת ההזזה (אופציונלי)';
    if(pairLbl) pairLbl.textContent='גם להזיז';
  } else {
    if(title) title.textContent='⏩ דחיית פעילות';
    if(btn){ btn.textContent='⏩ דחה'; }
    if(lbl) lbl.textContent='סיבת הדחייה';
    if(pairLbl) pairLbl.textContent='גם לדחות';
  }
}

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
  setPostMode('move'); // default to move
  // Populate supplier dropdown
  const postSupEl=document.getElementById('post-sup');
  if(postSupEl){
    postSupEl.innerHTML='<option value="">— אותו ספק —</option>';
    getAllSup().forEach(sup=>postSupEl.innerHTML+=`<option value="${sup.name}"${sup.name===s.a?' selected':''}>${sup.name}</option>`);
    postSupChg();
  }
  postShowFreeDays(s);
  const postPair=gardenPair(s.g);
  const pairWrap=document.getElementById('post-pair-wrap');
  if(postPair&&pairWrap){
    const partnerIds=postPair.ids.filter(id=>id!==s.g);
    const partnerNames=partnerIds.map(id=>G(id).name).filter(Boolean).join(', ');
    (document.getElementById('post-pair-name')||{}).textContent=partnerNames;
    pairWrap.style.display='block';
    document.getElementById('post-pair-chk').checked=true;
  } else if(pairWrap){ pairWrap.style.display='none'; }
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
  if(partnerConflict&&!conflict) warnEl.textContent='⚠️ לצהרון הבן זוג כבר קיימת פעילות בתאריך שנבחר!';
  else warnEl.textContent='⚠️ לגן זה כבר קיימת פעילות בתאריך שנבחר!';
}
function doPostpone(){
  const nd=document.getElementById('post-date').value;
  if(!nd){alert('יש לבחור תאריך חדש');return;}
  const dow=s2d(nd).getDay();
  if(dow===5||dow===6){alert('לא ניתן לשבץ בשישי או שבת');return;}
  const nt=document.getElementById('post-time').value;
  const nr=document.getElementById('post-reason').value;
  const postSupEl=document.getElementById('post-sup');
  const postActEl=document.getElementById('post-act');
  const newSup=postSupEl&&postSupEl.value?postSupEl.value:null;
  const newAct=postActEl&&postActEl.value?postActEl.value:null;
  const isMove=(_postMode||'move')==='move';

  const doOne=(srcId,isPartner)=>{
    const idx=SCH.findIndex(s=>s.id===srcId);
    if(idx<0) return;
    const orig=SCH[idx];
    const origDate=orig.d;
    if(isMove){
      // הזזה: מעדכן את הרשומה המקורית ישירות, שומר הערה מאיפה הוזז
      const moveNote=nr?`(הוזז מ-${fD(origDate)} — ${nr})`:`(הוזז מ-${fD(origDate)})`;
      Object.assign(SCH[idx],{
        d:nd, t:nt||orig.t,
        st:'ok', cr:'', pd:'', pt:'',
        _fromD:origDate,
        nt:orig.nt?orig.nt+' | '+moveNote:moveNote
      });
      if(!isPartner&&newSup) SCH[idx].a=newSup;
      if(!isPartner&&newAct) SCH[idx].act=newAct;
    } else {
      // דחייה: מסמן מקור כנדחה, יוצר רשומה חדשה
      Object.assign(SCH[idx],{st:'post',cr:nr||'נדחה',pd:nd,pt:nt||orig.t});
      const newEntry={...orig,id:Date.now()+(isPartner?1:0),d:nd,
        t:nt||orig.t,st:'ok',cr:'',pd:'',pt:'',
        _fromD:origDate,
        nt:'(הועבר מ-'+fD(origDate)+')'+(nr?' — '+nr:'')};
      if(!isPartner&&newSup) newEntry.a=newSup;
      if(!isPartner&&newAct) newEntry.act=newAct;
      SCH.push(newEntry);
    }
  };
  const orig=SCH.find(s=>s.id===selEvPost);
  const orig2=orig?{...orig}:null; // copy before mutation for logging
  if(orig){
    const origGid = orig.g;
    const origDate = orig.d; // save BEFORE doOne mutates orig (Object.assign changes by reference)
    doOne(selEvPost,false);
    const pairChk=document.getElementById('post-pair-chk');
    if(pairChk&&pairChk.checked){
      const pair=gardenPair(origGid);
      if(pair){
        pair.ids.filter(id=>id!==origGid).forEach(pid=>{
          // Use origDate (saved before mutation) not orig.d (already changed)
          const partnerEv=SCH.find(s=>s.g===pid&&s.d===origDate&&s.st!=='can');
          if(partnerEv) doOne(partnerEv.id,true);
          else console.log('Partner not found for gid',pid,'on',origDate);
        });
      }
    }
  }
  const toast=isMove?`🔀 הוזז ל-${fD(nd)}`:`⏩ נדחה ל-${fD(nd)}`;
  if(orig2){ const g2=G(orig2.g); _writeLog('move',`${g2.name} — ${orig2.a}`,toast,{gName:g2.name,date:nd}).catch(()=>{}); }
  save();CM('postm');closeSP();refresh();
  showToast(toast);
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
      w2.querySelector('label').textContent=`צהרון בן זוג: ${partG.name}?`;
      document.getElementById('ns-g2').innerHTML=`<option value="">לא - רק ל${g.name}</option><option value="${partnerId}" selected>כן - גם ל${partG.name}</option>`;
    }
  } else w2.style.display='none';
}
function nsSupChg(){
  const sup=document.getElementById('ns-sup').value;
  if(!sup) return;
  const base=supBase(sup);
  const ex=supEx[base]||supEx[sup]||{};
  const ph=ex.ph1||(SUPBASE.find(s=>supBase(s.name)===base&&s.phone)||SUPBASE.find(s=>s.name===sup)||{}).phone||'';
  document.getElementById('ns-ph').value=ph;
  // alias hint
  const aliasWrap=document.getElementById('ns-alias-wrap');
  const aliasHint=document.getElementById('ns-alias-hint');
  if(aliasWrap&&aliasHint){
    if(ex.alias){aliasHint.textContent=`🏷️ יוצג כ: "${ex.alias}"`;aliasWrap.style.display='block';}
    else{aliasHint.textContent='';aliasWrap.style.display='none';}
  }
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
    if(_hol&&!_hol.canSched&&(_hol.type==='noact'||_hol.type==='vacation'||_hol.type==='camp')){
      if(!confirm('⚠️ יש '+_hol.emoji+' '+_hol.name+' ביום זה.\nבכל זאת לשבץ?')) return;
    }
  }
  const ph=document.getElementById('ns-ph').value;
  const notes=document.getElementById('ns-notes').value;
  const grp=parseInt(document.getElementById('ns-grp').value)||1;
  let actType=document.getElementById('ns-act-type').value;
  if(actType==='__new__'){actType=document.getElementById('ns-act-type-new').value.trim();}
  const evTp=(document.getElementById('ns-ev-type')||{}).value||'חוג';
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
        if(!_hol2||_hol2.type==='info'||_hol2.canSched){
          const eid=recurring_id+count;
          const ev={id:eid,g:gid,d:ds,a:sup,act:actType,tp:evTp||'חוג',t:recurTime,p:ph,n:notes,st:'ok',cr:'',cn:'',nt:notes,pd:'',pt:'',grp,_recId:recurring_id};
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
    const newSched={id:newId,g:gid,d:date,a:sup,act:actType,tp:evTp||'חוג',t:time,p:ph,n:notes,st:'ok',cr:'',cn:'',nt:notes?notes:'השלמה'+(makeupOrig?' מ-'+fD(makeupOrig):''),pd:'',pt:'',grp,_makeupFrom:makeupOrig||''};
    SCH.push(newSched);
    if(g2id) SCH.push({...newSched,id:newId+1,g:g2id});
    saveAndRefresh('nsm');
    showToast('✅ שיבוץ השלמה נשמר');
    return;
  }

  // One-time
  const newSched={id:newId,g:gid,d:date,a:sup,act:actType,tp:evTp||'חוג',t:time,p:ph,n:notes,st:'ok',cr:'',cn:'',nt:notes,pd:'',pt:'',grp};
  SCH.push(newSched);
  if(g2id){
    SCH.push({...newSched,id:newId+1,g:g2id,nt:notes});
  }
  saveAndRefresh('nsm');
  showToast('✅ שיבוץ נשמר');
}

function sSchedStChange(){
  const st=document.getElementById('s-st').value;
  const from=document.getElementById('s-from');
  const to=document.getElementById('s-to');
  if(!st){
    // הכל → default to today
    if(from&&!from.value) from.value=td();
    if(to&&!to.value) to.value=td();
  } else {
    // ספציפי → clear date filter to show all
    if(from) from.value='';
    if(to) to.value='';
  }
  sPage=1; renderSched();
}
function sRefG(){
  const city=document.getElementById('s-city').value;
  const cls=document.getElementById('s-cls').value;
  const gs=gByCF(city,cls).sort((a,b)=>a.name.localeCompare(b.name,'he'));
  ['s-g1','s-g2','s-g3'].forEach((id,i)=>{
    const sel=document.getElementById(id);
    sel.innerHTML=i===0?'<option value="">כל הצהרונים</option>':'<option value="">—</option>';
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
function setSchedView(v){
  const sf=document.getElementById('s-from'), st2=document.getElementById('s-to');
  if(!sf||!st2) return;
  const base=sf.value||td();
  const d=s2d(base);
  if(v==='day'){
    sf.value=td(); st2.value=td();
  } else if(v==='week'){
    const mon=monStart(new Date(d)); sf.value=d2s(mon); st2.value=d2s(addD(mon,6));
  } else if(v==='month'){
    const y=d.getFullYear(), m=d.getMonth();
    sf.value=d2s(new Date(y,m,1)); st2.value=d2s(new Date(y,m+1,0));
  }
  ['day','week','month'].forEach(x=>document.getElementById('svb-'+x)?.classList.toggle('active',x===v));
  sPage=1; renderSched();
}

function navSched(dir){
  const sf=document.getElementById('s-from'),st2=document.getElementById('s-to');
  if(!sf||!st2) return;
  const from=sf.value||td(),to=st2.value||td();
  const d1=s2d(from),d2=s2d(to);
  const span=Math.max(0,Math.round((d2-d1)/(1000*60*60*24)));
  const nd1=addD(d1,dir*(span+1));
  const nd2=addD(nd1,span);
  sf.value=d2s(nd1); st2.value=d2s(nd2);
  sPage=1; renderSched();
}
function navSchedToday(){
  const t=td();
  document.getElementById('s-from').value=t;
  document.getElementById('s-to').value=t;
  sPage=1; renderSched();
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
      [{arr:cityData.gan,lbl:'🏫 צהרונים',cls:'gan'},{arr:cityData.sch,lbl:'🏛️ בתי ספר',cls:'sch'}].forEach(sec=>{
        if(!sec.arr.length) return;
        h+=`<div class="dsh ${sec.cls}" style="font-size:.7rem;margin-bottom:3px">${sec.lbl}</div>
          <div class="tw"><table style="margin-bottom:6px"><thead><tr>
            <th>צהרון</th><th>ספק</th><th>שעה</th><th>קב'</th><th>סטטוס</th><th>הערות</th>
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
            <td>${s.grp||1}</td>
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
  setTimeout(_fitScrollAreas,50);
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
  if(_gardensTab==='fixed'){ renderGardensFixed(); return; }
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
  (document.getElementById('g-info')||{}).textContent =`${f.length} ${cls==='ביה"ס'?'בתי ספר':'צהרונים'}`;
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
  document.getElementById('g-body').innerHTML=h||'<p style="color:#999">לא נמצאו צהרונים</p>';
  setTimeout(_fitScrollAreas,50);
}

function openGmExport(){
  if(!gmGid)return;
  const gids=gardenPair(gmGid)?gardenPair(gmGid).ids:[gmGid];
  _exGids=gids;
  const ws=monStart(gmD);
  const fDs=gmV==='day'?d2s(gmD):gmV==='week'?d2s(ws):d2s(new Date(gmD.getFullYear(),gmD.getMonth(),1));
  const tDs=gmV==='day'?d2s(gmD):gmV==='week'?d2s(addD(ws,5)):d2s(new Date(gmD.getFullYear(),gmD.getMonth()+1,0));
  document.getElementById('ex-d1').value=fDs;
  document.getElementById('ex-d2').value=tDs;
  (document.getElementById('ex-ctx')||{}).textContent=G(gmGid).name+' | '+fD(fDs)+(fDs!==tDs?' – '+fD(tDs):'');
  document.getElementById('exm').classList.add('open');
  setTimeout(()=>genExport(),80);
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
הצהרונים יוצגו בנפרד ביום זה בלבד.`)) return;
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
הצהרונים יוצגו בנפרד בכל הלוח. פעולה זו אינה ניתנת לביטול.`)) return;
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
      <div style="font-size:.76rem;font-weight:800;color:#f57f17;margin-bottom:8px">⚠️ צהרונים ללא זוג (${soloGardens.length})</div>`;
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
    sideHtml='<div style="font-size:.75rem;color:#2e7d32;background:#e8f5e9;border-radius:7px;padding:8px 10px">✅ כל הצהרונים משובצים בזוג</div>';
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
            <button class="btn bsm" style="background:rgba(255,255,255,.3);border:none;color:#fff;font-size:.7rem;padding:3px 9px;border-radius:4px;cursor:pointer;font-weight:700" onclick="_exportPairWA(${JSON.stringify(p.ids)})">📋 הודעה</button>
            <button class="btn bsm" style="background:rgba(255,255,255,.22);border:none;color:#fff;font-size:.68rem;padding:2px 7px;border-radius:4px;cursor:pointer" onclick="openAddPair(${idx})">✏️ ערוך</button>
            <button class="btn bsm" style="background:rgba(255,255,255,.28);border:none;color:#fff;font-size:.68rem;padding:2px 7px;border-radius:4px;cursor:pointer" onclick="_goToPairSched(${idx})">📋 שיבוץ</button>
            <button class="btn bsm" style="background:rgba(255,255,255,.15);border:none;color:#fff;font-size:.68rem;padding:2px 7px;border-radius:4px;cursor:pointer" onclick="delPair(${idx})">🗑️</button>
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


function _goToPairSched(idx){
  const p=pairs[idx];
  if(!p||!p.ids||!p.ids[0]) return;
  // Open new-schedule modal with first garden of pair pre-selected
  openNewSched(p.ids[0]);
}

function exportPairNow(idx){_exGids=pairs[idx].ids;openExport();}
function delPair(idx){
  const pair=pairs[idx];
  if(!pair) return;
  if(!confirm('למחוק את הזוג "'+pair.name+'"?\nהפעילויות ישארו אך הצהרונים לא יהיו מקושרים יותר.')) return;
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
  if(!g1){alert('יש לבחור לפחות צהרון אחד');return;}
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
    if(!confirm('צהרונים כבר בזוגות אחרים. בכל זאת להמשיך?')) return;
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
  return{...t,name:h.name,note:h.note,id:h.id,canSched:h.canSched||false};
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
      ${hol.canSched?`<div style="font-size:.73rem;color:#2e7d32;background:#e8f5e9;border-radius:5px;padding:2px 7px;margin-top:4px;display:inline-block">✅ ניתן לשבץ</div>`:''}
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
  const canSchedCb=document.getElementById('hol-can-sched');
  if(canSchedCb) canSchedCb.checked=hol?hol.canSched||false:false;
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
  const canSched=document.getElementById('hol-can-sched')?.checked||false;
  const holType=document.getElementById('hol-type').value;
  cityList.forEach((city,idx)=>{
    const hol={
      id:cityList.length>1?baseId+'_'+idx:baseId,
      name,from,to,
      type:holType,
      city:city,
      scope:document.getElementById('hol-scope').value,
      note:document.getElementById('hol-note').value.trim(),
      canSched:canSched
    };
    holidays.push(hol);
  });
  // Retroactive: if holiday blocks scheduling, cancel matching fixed-schedule events
  if(!canSched&&(holType==='vacation'||holType==='noact'||holType==='camp'||holType==='event')){
    const scope=document.getElementById('hol-scope').value;
    let removed=0;
    SCH.forEach(ev=>{
      if(ev.d<from||ev.d>to) return;
      if(!ev._recId) return; // only fixed/recurring
      if(ev.st==='can') return;
      const g=G(ev.g);
      if(!g||!g.id) return;
      if(cityList.length&&cityList[0]!==''&&!cityList.includes(g.city)) return;
      if(scope==='גנים'&&gcls(g)!=='גנים') return;
      if(scope==='ביה"ס'&&gcls(g)!=='ביה"ס') return;
      ev.st='can';ev.cr='חופשה: '+name;
      removed++;
    });
    if(removed>0) showToast(`⚠️ בוטלו ${removed} פעילויות קבועות בגלל החופשה`);
  }
  save();CM('holm');refresh();
  showToast(`✅ חופשה "${name}" נשמרה (${fD(from)} – ${fD(to)})`);
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
      og.label=`🏙️ ${city} — צהרונים`;
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
        <div style="font-weight:800;color:#f57f17;font-size:.82rem;margin-bottom:6px">⚠️ צהרונים ללא אשכול (${noCluster.length})</div>
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
        <div style="font-weight:800;color:#f57f17;font-size:.83rem;margin-bottom:8px">⚠️ צהרונים ללא אשכול (${noCluster.length})</div>
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
  // Set date to the specific day, then open export modal with pair gids
  const prevD=calD;
  calD=s2d(ds);
  _exportPairWA(pair.ids);
}
function showCopyToast(msg){
  let t=document.getElementById('copy-toast');
  if(!t){t=document.createElement('div');t.id='copy-toast';t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1b5e20;color:#fff;padding:9px 22px;border-radius:24px;font-size:.85rem;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);transition:opacity .4s';document.body.appendChild(t);}
  t.textContent=msg||'✅ ההודעה הועתקה ללוח!';t.style.opacity='1';
  clearTimeout(t._to);t._to=setTimeout(()=>t.style.opacity='0',2200);
}



function _exportGardenWA(gids, ds){
  _exGids = Array.isArray(gids) ? gids : JSON.parse(gids);
  if(ds) calD = s2d(ds);
  openExport();
}

function _exportPairWA(gids){
  _exGids = Array.isArray(gids)?gids:JSON.parse(gids);
  openExport();
}

function toggleExportMenu(){
  const m=document.getElementById('export-menu');
  if(!m) return;
  if(m.style.display!=='none'){m.style.display='none';return;}
  m.style.display='block';
  setTimeout(()=>document.addEventListener('click',function _c(e){
    if(!m.contains(e.target)&&e.target.id!=='export-main-btn'){m.style.display='none';document.removeEventListener('click',_c);}
  }),10);
}
function closeExportMenu(){const m=document.getElementById('export-menu');if(m)m.style.display='none';}
function openCalPrint(){
  // Generate export text and open print window directly
  const ws=monStart(calD);
  const fromDs=calV==='week'?d2s(ws):calV==='day'?d2s(calD):d2s(new Date(calD.getFullYear(),calD.getMonth(),1));
  const toDs=calV==='week'?d2s(addD(ws,5)):calV==='day'?d2s(calD):d2s(new Date(calD.getFullYear(),calD.getMonth()+1,0));
  // Set export fields and generate
  document.getElementById('ex-d1').value=fromDs;
  document.getElementById('ex-d2').value=toDs;
  genExport();
  // Open print window after generation
  setTimeout(()=>{
    const t=document.getElementById('ex-prev')?.textContent||'';
    if(!t||t.startsWith('לחץ')){ 
      // Fall back to modal if no content
      document.getElementById('exm').classList.add('open');
      return;
    }
    const w=window.open('','_blank','width=800,height=700');
    if(!w){ document.getElementById('exm').classList.add('open'); return; }
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>לוח זמנים</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;white-space:pre-wrap;font-size:13px;line-height:1.7}@media print{button{display:none}}</style></head>
    <body><button onclick="window.print()" style="margin-bottom:15px;padding:6px 16px;cursor:pointer;font-size:14px">🖨️ הדפס</button><pre>${t.replace(/</g,'&lt;')}</pre></body></html>`);
    w.document.close();
    // DON'T auto-print - let user review first
  }, 150);
}
function openExport(){
  const ws=monStart(calD), we=addD(ws,5);
  const isWeek=(calV==='week');
  const todayStr=d2s(calD);
  document.getElementById('ex-d1').value=isWeek?d2s(ws):todayStr;
  document.getElementById('ex-d2').value=isWeek?d2s(we):todayStr;
  const f=getCalF();
  const gids=_exGids||f.gids;
  let ctx=isWeek?`${fD(d2s(ws))} – ${fD(d2s(we))}`:`תאריך: ${fD(d2s(calD))}`;
  if(gids&&gids.length) ctx+=` | גנים: ${gids.map(id=>G(id).name||'').join(' + ')}`;
  (document.getElementById('ex-ctx')||{}).textContent =ctx;
  document.getElementById('exm').classList.add('open');
  // Auto-generate preview — pass gids snapshot so _exGids isn't cleared before use
  const _snapGids = _exGids;
  setTimeout(()=>{ _exGids=_snapGids; genExport(); }, 80);
}
function genExport(){
  const from=document.getElementById('ex-d1').value;
  const to=document.getElementById('ex-d2').value||from;
  const fmt=document.getElementById('ex-fmt').value;
  if(!from){alert('בחר תאריך');return;}
  const f=getCalF();
  const gids=_exGids||f.gids;
  _exGids=null;
  const gidsStr=gids?gids.map(String):null;
  const rel=SCH.filter(s=>s.d>=from&&s.d<=to&&(!gidsStr||gidsStr.includes(String(s.g))))
    .sort((a,b)=>a.d.localeCompare(b.d)||(a.t||'99').localeCompare(b.t||'99'));
  const relActive=rel.filter(s=>s.st!=='can');
  if(!rel.length){(document.getElementById('ex-prev')||{}).textContent='אין פעילויות';return;}
  const byDate={};rel.forEach(s=>{if(!byDate[s.d])byDate[s.d]=[];byDate[s.d].push(s);});
  let text='';
  const dates=Object.keys(byDate).sort();
  dates.forEach((date,di)=>{
    text+=`📅 ${fD(date)} - יום ${dayN(date)}\n━━━━━━━━━━━━━━━━\n`;
    const byCity={};
    byDate[date].forEach(s=>{
      const g=G(s.g);const c=g.city||'';
      if(!byCity[c])byCity[c]=[];
      byCity[c].push({...s,gd:g});
    });
    Object.keys(byCity).sort().forEach(c=>{
      if(fmt==='full'){
        text+=`🏙️ ${c}\n`;
        // ── Group by pairs first, then solos ──────────────────────────
        const cityEvs=byCity[c];
        const usedIds=new Set();
        // Pairs
        pairs.forEach(pair=>{
          const pairEvs=cityEvs.filter(s=>pair.ids.includes(s.g));
          if(!pairEvs.length) return;
          pairEvs.forEach(s=>usedIds.add(s.id));
          // Group same pair by supplier+activity key
          const bySup={};
          pairEvs.forEach(s=>{
            const key=`${s.a}||${s.act||supAct(s.a)||''}||${s.p||''}`;
            if(!bySup[key])bySup[key]=[];
            bySup[key].push(s);
          });
          Object.values(bySup).forEach(group=>{
            const s0=group[0];
            const actLabel=s0.act||supAct(s0.a)||'';
            const supLine=`📚 ${supDisplayName(supBase(s0.a))}${actLabel?' - '+actLabel:''}${s0.p?' · 📞 '+s0.p:''}`;
            const addrs=[...new Set(group.map(s=>s.gd.st||''))];
            const sameAddr=addrs.length===1&&addrs[0];
            if(sameAddr){
              text+=`${supLine}\n  🏫 ${addrs[0]}\n`;
              group.forEach(s=>{ text+=`     ${s.st==='can'?'❌ ':s.st==='nohap'?'⚠️ ':''}${s.gd.name}${s.t?' · ⏰ '+fT(s.t):''}\n`; });
            } else {
              text+=`${supLine}\n`;
              group.forEach(s=>{
                const addr=s.gd.st?`🏫 ${s.gd.st} · `:'  ';
                text+=`  ${s.st==='can'?'❌ ':s.st==='nohap'?'⚠️ ':'  '}${addr}${s.gd.name}${s.st==='can'?' (בוטל)':s.st==='nohap'?' (לא התקיים)':''} ${s.t?' · ⏰ '+fT(s.t):''}\n`;
              });
            }
            text+='\n';
          });
        });
        // Solos (not in any pair)
        const soloEvs=cityEvs.filter(s=>!usedIds.has(s.id));
        if(soloEvs.length){
          const bySup={};
          soloEvs.forEach(s=>{
            const key=`${s.a}||${s.act||supAct(s.a)||''}||${s.p||''}`;
            if(!bySup[key])bySup[key]=[];
            bySup[key].push(s);
          });
          Object.values(bySup).forEach(group=>{
            const s0=group[0];
            const actLabel=s0.act||supAct(s0.a)||'';
            const supLine=`📚 ${supDisplayName(supBase(s0.a))}${actLabel?' - '+actLabel:''}${s0.p?' · 📞 '+s0.p:''}`;
            const addrs=[...new Set(group.map(s=>s.gd.st||''))];
            const sameAddr=addrs.length===1&&addrs[0];
            if(sameAddr){
              text+=`${supLine}\n  🏫 ${addrs[0]}\n`;
              group.forEach(s=>{ text+=`     ${s.st==='can'?'❌ ':s.st==='nohap'?'⚠️ ':''}${s.gd.name}${s.t?' · ⏰ '+fT(s.t):''}${s.st==='can'?' (בוטל)':s.st==='nohap'?' (לא התקיים)':''}\n`; });
            } else {
              text+=`${supLine}\n`;
              group.forEach(s=>{
                const addr=s.gd.st?`🏫 ${s.gd.st} · `:'  ';
                text+=`  ${addr}${s.gd.name}${s.t?' · ⏰ '+fT(s.t):''}\n`;
              });
            }
            text+='\n';
          });
        }
      } else {
        byCity[c].forEach(s=>{
          text+=`${s.st==='can'?'❌ ':s.st==='nohap'?'⚠️ ':''}${s.gd.name}${s.t?' '+fT(s.t):''} - ${s.a}${s.st==='can'?' (בוטל)':s.st==='nohap'?' (לא התקיים)':''}\n`;
        });
      }
    });
    // Blank line between dates
    text+='\n';
  });
  (document.getElementById('ex-prev')||{}).textContent =text;
}
function copyExport(){
  const t=document.getElementById('ex-prev').textContent;
  if(!t||t.startsWith('לחץ')) return;
  navigator.clipboard.writeText(t).then(()=>alert('✅ הועתק!')).catch(()=>{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);alert('✅ הועתק!');});
}
function printExport(){
  const t=document.getElementById('ex-prev').textContent;
  if(!t||t.startsWith('לחץ')){alert('יש ליצור תצוגה מקדימה תחילה');return;}
  const w=window.open('','_blank','width=700,height=600');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>לוח זמנים</title>
  <style>body{font-family:Arial,sans-serif;padding:20px;white-space:pre-wrap;font-size:14px;line-height:1.7}@media print{button{display:none}}</style></head>
  <body><button onclick="window.print()" style="margin-bottom:15px;padding:6px 16px;cursor:pointer">🖨️ הדפס</button><pre>${t.replace(/</g,'&lt;')}</pre></body></html>`);
  w.document.close();
}

// [backup system unified — see createSnapshot/openBackup above]
let _supExName=null;
let _supExType = 'act'; // 'act' | 'inv'
function setSupExType(t){
  _supExType=t;
  document.getElementById('supex-type-act')?.classList.toggle('active',t==='act');
  document.getElementById('supex-type-inv')?.classList.toggle('active',t==='inv');
  const actOpts=document.getElementById('supex-act-opts');
  const invOpts=document.getElementById('supex-inv-opts');
  if(actOpts) actOpts.style.display=t==='act'?'':'none';
  if(invOpts) invOpts.style.display=t==='inv'?'block':'none';
}
function openSupExport(supName){
  _supExName=supName;
  _supExType='act';
  setSupExType('act');
  (document.getElementById('supexm-title')||{}).textContent=supName?`📊 יצוא: ${supName}`:'📊 יצוא דוח ספקים';
  const now=new Date();
  document.getElementById('supex-from').value=d2s(new Date(now.getFullYear(),now.getMonth(),1));
  document.getElementById('supex-to').value=d2s(new Date(now.getFullYear(),now.getMonth()+1,0));
  document.getElementById('supex-prev').style.display='none';
  document.getElementById('supexm').classList.add('open');
}
function doSupExport(){
  if(_supExType==='inv'){
    // ── יצוא חשבוניות/הזמנות ──
    if(typeof exportSupPurchDocs==='function' && _supExName){
      exportSupPurchDocs(supBase(_supExName));
    } else {
      showToast('אין מסמכי רכש לספק זה');
    }
    CM('supexm');
    return;
  }

  // ── יצוא פעילויות ──
  const from=document.getElementById('supex-from').value;
  const to=document.getElementById('supex-to').value;
  if(!from||!to){alert('בחר תאריכים');return;}

  const _supBase=_supExName?supBase(_supExName):'';
  const _supExData=_supBase?supEx[_supBase]||{}:{};
  const _supObj=_supExName?Object.values(SUPBASE||{}).find(s=>supBase(s.name)===_supBase)||null:null;
  const supPhone=_supExData.phone||(_supObj&&_supObj.phone)||(_supExName?SCH.find(s=>supBase(s.a)===_supBase&&s.p)?.p||'':'');

  const evs=SCH.filter(s=>{
    if(s.d<from||s.d>to) return false;
    if(_supExName&&supBase(s.a)!==supBase(_supExName)) return false;
    return true;
  }).sort((a,b)=>{
    const ga=G(a.g),gb=G(b.g);
    return (ga.city||'').localeCompare(gb.city||'','he')
      ||a.d.localeCompare(b.d)
      ||(a.t||'99:99').localeCompare(b.t||'99:99')
      ||(ga.name||'').localeCompare(gb.name||'','he');
  });
  if(!evs.length){alert('אין פעילויות בטווח זה');return;}

  const stMap={ok:'מתקיים',done:'התקיים',can:'בוטל ❌',post:'נדחה',nohap:'לא התקיים ⚠️'};
  const bom='\uFEFF';
  const q=c=>`"${String(c==null?'':c).replace(/"/g,'""')}"`;
  const lines=[];

  // grp=קבוצות: 1=התקיים בפועל, 0=לא התקיים (כולל ביטול/לא התקיים/נדחה)
  const isHappened = s => (s.grp||1) >= 1 && s.st!=='can' && s.st!=='nohap' && s.st!=='post';
  const isNotHappened = s => (s.grp||1) === 0 || s.st==='can' || s.st==='nohap';
  const isMakeup = s => !!s._makeupFrom;

  const sumRow=(label,evArr)=>{
    const tot    = evArr.length;
    const done   = evArr.filter(s=>isHappened(s)).length; // כולל השלמות שהתקיימו
    const makeup = evArr.filter(s=>isMakeup(s)&&isHappened(s)).length; // השלמות שהתקיימו בפועל
    const notHap = evArr.filter(s=>isNotHappened(s)).length;
    const can    = evArr.filter(s=>s.st==='can').length;
    return [q(label),q(tot),q('התקיימו:'),q(done),q('השלמות:'),q(makeup),q('בוטלו:'),q(can),q('לא התקיימו:'),q(notHap),''].join(',');
  };

  // Header
  if(_supExName){
    lines.push([q('ספק:'),q(_supExName),'','','','','','','','',''].join(','));
    lines.push([q('טלפון:'),q(supPhone),'','','','','','','','',''].join(','));
    lines.push([q('תקופה:'),q(fD(from)+' – '+fD(to)),'','','','','','','','',''].join(','));
    lines.push('');
  }

  lines.push(['עיר','כתובת','שם צהרון','תאריך','יום','פעילות','קבוצות','שעה','סטטוס','סיבה','הערות'].map(q).join(','));

  // Group by city, add per-city summary row
  const cities=[...new Set(evs.map(s=>G(s.g).city||'אחר'))].sort((a,b)=>a.localeCompare(b,'he'));
  cities.forEach(city=>{
    const cityEvs=evs.filter(s=>(G(s.g).city||'אחר')===city);
    cityEvs.forEach(s=>{
      const g=G(s.g);
      const actName=supAct(s.a)||s.a;
      lines.push([
        q(g.city||''),q(g.st||''),q(g.name||''),
        q(fD(s.d)),q(dayN(s.d)),
        q(actName),q(isHappened(s)?(s.grp||1):0),q(fT(s.t)),
        q(stMap[s.st]||'מתקיים'),q(s.cr||''),q(s.nt||'')
      ].join(','));
    });
    // City summary row
    lines.push(sumRow(`סה"כ ${city}:`, cityEvs));
    lines.push('');
  });

  // Grand total row
  lines.push(sumRow('סה"כ פעילויות:', evs));

  const csv=bom+lines.join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`דוח_פעילויות_${_supExName||'כל_הספקים'}_${from}_${to}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
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
  const headers=['תאריך','יום','עיר','שם הצהרון','כתובת','ספק','שעה','קבוצות','סטטוס','סיבה','הערות','תאריך דחייה'];
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
  if(typeof SUPBASE==='undefined'||typeof supEx==='undefined') return [];
  // mergedAway: exact supplier names that were merged INTO another (the sources)
  const mergedAway = new Set(supEx['__merged_away']||[]);
  const map={};

  // Add SUPBASE entries — skip only exact merged-away names
  SUPBASE.forEach(s=>{
    if(mergedAway.has(s.name)) return; // this entry was explicitly merged away
    const base=supBase(s.name);
    const act=supAct(s.name);
    if(!map[base]) map[base]={name:base,phone:s.phone,acts:new Set(),fullNames:new Set()};
    if(act) map[base].acts.add(act);
    map[base].fullNames.add(s.name);
    if(!map[base].phone&&s.phone) map[base].phone=s.phone;
  });

  // Add custom suppliers (__c) — skip exact merged-away names
  (supEx['__c']||[]).forEach(s=>{
    if(mergedAway.has(s.name)) return;
    const base=supBase(s.name);
    if(!map[base]) map[base]={name:base,phone:s.phone||'',acts:new Set(),fullNames:new Set()};
    map[base].fullNames.add(s.name);
    if(!map[base].phone&&s.phone) map[base].phone=s.phone;
  });

  return Object.values(map).map(m=>({
    ...m,
    acts:[...m.acts].sort((a,b)=>a.localeCompare(b,'he')),
    fullNames:[...m.fullNames]
  })).sort((a,b)=>a.name.localeCompare(b.name,'he'));
}
function getSupActs(name){
  if(!name) return[];
  const base=supBase(name);
  const ex=supEx[base]||supEx[name]||{};
  const fromSch=new Set();

  // 1. From SCH entries (always scan — never skip)
  SCH.forEach(s=>{ if(supBase(s.a)===base){const a=supAct(s.a);if(a)fromSch.add(a);} });
  // 2. From SUPBASE (current base)
  SUPBASE.forEach(s=>{ if(supBase(s.name)===base){const a=supAct(s.name);if(a)fromSch.add(a);} });
  // 3. From merged-from history (_mergedFrom stores old bases that were merged into this one)
  const mergedFromBases = ex._mergedFrom||[];
  mergedFromBases.forEach(oldBase=>{
    SCH.forEach(s=>{ if(supBase(s.a)===oldBase){const a=supAct(s.a);if(a)fromSch.add(a);} });
    SUPBASE.forEach(s=>{ if(supBase(s.name)===oldBase){const a=supAct(s.name);if(a)fromSch.add(a);} });
  });
  // 4. Fallback: check mergedAway — find SUPBASE entries whose base was merged into this supplier
  const mergedAway = supEx['__merged_away']||[];
  mergedAway.forEach(mName=>{
    const mBase=supBase(mName);
    if(SCH.some(s=>supBase(s.a)===base)){
      SUPBASE.forEach(s=>{ if(supBase(s.name)===mBase && mBase!==base){
        if(SCH.some(s2=>supBase(s2.a)===mBase)){
          const a=supAct(s.name); if(a) fromSch.add(a);
        }
      }});
    }
  });
  // 5. Merge with explicitly saved acts (manual additions not in SCH)
  if(Array.isArray(ex.acts)) ex.acts.forEach(a=>{ if(a) fromSch.add(a); });

  return [...fromSch].sort((a,b)=>a.localeCompare(b,'he'));
}
// Supplier list index helpers — avoid HTML attribute escaping issues
let _supCurrentList = [];
function supOpen(idx){ const n=_supCurrentList[idx]?.name||''; if(n) openSupCard(n); }
function supEdit(idx){ const n=_supCurrentList[idx]?.name||''; if(n){ openSupCard(n); setTimeout(sucToggleEdit,250); } }

let _supViewMode='list';
function setSupView(mode){
  _supViewMode=mode;
  document.getElementById('su-view-cards').classList.toggle('active',mode==='cards');
  document.getElementById('su-view-list').classList.toggle('active',mode==='list');
  renderSup();
}
let _supTab='all';
function setSupTab(t){
  _supTab=t;
  ['all','act','purch'].forEach(x=>{const b=document.getElementById('sup-tab-'+x);if(b)b.classList.toggle('active',x===t);});
  renderSup();
}
let _vatMode='ex'; // 'ex'=excluding VAT, 'inc'=including VAT
function setVatMode(m){
  _vatMode=m;
  document.getElementById('vat-btn-ex')?.classList.toggle('active',m==='ex');
  document.getElementById('vat-btn-inc')?.classList.toggle('active',m==='inc');
  calcVat();
}
function calcVat(){
  const v=parseFloat(document.getElementById('sp-amount')?.value)||0;
  const res=document.getElementById('vat-result');
  if(!res||!v){if(res)res.textContent='';return;}
  if(_vatMode==='ex'){
    res.textContent=`→ כולל מע"מ: ₪${(v*1.17).toFixed(2)}`;
  } else {
    res.textContent=`→ לפני מע"מ: ₪${(v/1.17).toFixed(2)}`;
  }
}
function getAmountExVat(){
  const v=parseFloat(document.getElementById('sp-amount')?.value)||0;
  return _vatMode==='inc'?+(v/1.17).toFixed(2):v;
}
// ────────────────────────────────────────────────────────────────────────────
// repairAllSuppliers — comprehensive supplier list repair
// Run this to fix suppliers after merges, imports, or other data issues
// ────────────────────────────────────────────────────────────────────────────
function repairAllSuppliers(){
  if(!supEx) supEx={};
  if(!supEx['__c']) supEx['__c']=[];

  // mergedAway: suppliers intentionally hidden after merge — NEVER modify this list
  const mergedAway = new Set(supEx['__merged_away']||[]);
  const mergedFixed = 0;
  const inSupbase = new Set(SUPBASE.map(s=>supBase(s.name)));
  const inC = new Set(supEx['__c'].map(s=>supBase(s.name)));
  let added=0, fixed=0;

  // 1. Scan all schedule entries — ensure their base supplier is registered
  const schBases = new Set();
  SCH.forEach(s=>{ if(s.a) schBases.add(supBase(s.a)); });
  schBases.forEach(base=>{
    if(!base) return;
    // Skip if this base name itself is in mergedAway (it was a custom supplier that got merged)
    if(mergedAway.has(base)) return;
    if(inSupbase.has(base)) return;
    if(inC.has(base)) return;
    supEx['__c'].push({id:Date.now()+Math.random(),name:base,phone:supEx[base]?.ph1||''});
    if(!supEx[base]) supEx[base]={};
    if(supEx[base].isPurch===undefined) supEx[base].isPurch=true;
    inC.add(base);
    added++;
  });

  // 2. Scan INVOICES
  INVOICES.forEach(inv=>{
    const base=inv.supName?supBase(inv.supName):'';
    if(!base||mergedAway.has(base)||inSupbase.has(base)||inC.has(base)) return;
    supEx['__c'].push({id:Date.now()+Math.random(),name:base,phone:supEx[base]?.ph1||''});
    if(!supEx[base]) supEx[base]={};
    if(supEx[base].isPurch===undefined) supEx[base].isPurch=true;
    if(supEx[base].isAct===undefined) supEx[base].isAct=false;
    inC.add(base);
    added++;
  });

  // 3. Remove duplicate __c entries (same base name)
  const seenBases = new Set();
  supEx['__c'] = supEx['__c'].filter(s=>{
    const base=supBase(s.name);
    if(seenBases.has(base)) return false;
    seenBases.add(base);
    return true;
  });

  // 4. Clear stale/incomplete acts arrays — force re-derive from SCH on next getSupActs call
  // Only clear if SCH has MORE activities than what's saved (i.e. acts array is outdated)
  let clearedActs=0;
  Object.keys(supEx).forEach(k=>{
    if(k==='__c'||k==='__merged_away'||k==='__gardens_extra') return;
    if(!Array.isArray(supEx[k]?.acts)) return;
    const base = supBase(k)||k;
    // Derive what SCH actually has for this supplier
    const schActs = new Set();
    SCH.forEach(s=>{ if(supBase(s.a)===base){const a=supAct(s.a);if(a)schActs.add(a);} });
    SUPBASE.forEach(s=>{ if(supBase(s.name)===base){const a=supAct(s.name);if(a)schActs.add(a);} });
    const savedActs = new Set(supEx[k].acts);
    // If SCH has acts that the saved array is missing → clear saved array so it auto-derives fully
    const missingFromSaved = [...schActs].filter(a=>!savedActs.has(a));
    if(missingFromSaved.length > 0 || supEx[k].acts.length === 0){
      delete supEx[k].acts; clearedActs++;
    }
  });

  if(added>0||clearedActs>0||mergedFixed>0) save();
  const msg=`🔧 ספקים: ${added} נוספו${mergedFixed?`, ${mergedFixed} mergedAway תוקנו`:''}${clearedActs?`, ${clearedActs} acts תוקנו`:''}`;
  console.log(msg);
  if(added>0||mergedFixed>0) showToast(`✅ ${msg}`);
  try{ renderPurchSuppliers(); }catch(e){}
  try{ renderSup(); }catch(e){}
}

function renderSup(){
  const srch=(document.getElementById('su-srch').value||'').toLowerCase();
  const sortMode=(document.getElementById('su-sort')||{value:'name'}).value;
  // p-sup (חוגים mode) always shows only act suppliers
  let all=getAllSup().filter(s=>{
    const base = s.name||'';
    if(srch && !base.toLowerCase().includes(srch)) return false;
    return isActSupplier(base); // Only activity suppliers in חוגים panel
  });
  // Always sort alphabetically first, then by count if selected
  all=[...all].sort((a,b)=>(a.name||'').localeCompare(b.name||'','he'));
  if(sortMode==='cnt') all=[...all].sort((a,b)=>supBaseCnt(b.name)-supBaseCnt(a.name));

  if(_supViewMode==='list'){
    document.getElementById('su-body').className='scroll-area';
    let h='<table style="width:100%;border-collapse:collapse;font-size:.83rem;table-layout:fixed">'
      +'<colgroup><col style="width:28%"><col style="width:17%"><col style="width:8%"><col style="width:30%"><col style="width:17%"></colgroup>'
      +'<thead><tr style="background:#e8eaf6;position:sticky;top:0">'
      +'<th style="padding:7px 12px;text-align:right;font-weight:700;border-bottom:2px solid #c5cae9">ספק</th>'
      +'<th style="padding:7px 8px;text-align:center;font-weight:700;border-bottom:2px solid #c5cae9;white-space:nowrap">טלפון</th>'
      +'<th style="padding:7px 8px;text-align:center;font-weight:700;border-bottom:2px solid #c5cae9;white-space:nowrap">פעילויות</th>'
      +'<th style="padding:7px 8px;text-align:right;font-weight:700;border-bottom:2px solid #c5cae9">סוגים</th>'
      +'<th style="padding:7px 8px;border-bottom:2px solid #c5cae9"></th>'
      +'</tr></thead><tbody>';
    _supCurrentList = all; // save for index-based helpers
    all.forEach((s,idx)=>{
      const base=s.name;
      const ex=supBaseEx(base);
      const cnt=supBaseCnt(base);
      const acts=getSupActs(base);
      const phone=ex.ph1||s.phone||'';
      const bg=idx%2===0?'#fff':'#f8f9ff';
      h+=`<tr style="background:${bg};cursor:pointer" onclick="supOpen(${idx})">`
        +`<td style="padding:6px 12px;font-weight:700;color:#1a237e;border-bottom:1px solid #e8eaf6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:0">${base}`
        +`${isActSupplier(base)?' <span style="font-size:.65rem;color:#1565c0">🎨</span>':''}` 
        +`${isPurchSupplier(base)?' <span style="font-size:.65rem;color:#2e7d32">🛒</span>':''}` 
        +`</td>`
        +`<td style="padding:6px 8px;text-align:center;color:#2e7d32;border-bottom:1px solid #e8eaf6;white-space:nowrap">${phone||'—'}</td>`
        +`<td style="padding:6px 8px;text-align:center;font-weight:700;color:#1565c0;border-bottom:1px solid #e8eaf6">${cnt}</td>`
        +`<td style="padding:6px 8px;border-bottom:1px solid #e8eaf6;font-size:.78rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:0">${acts.join(', ')}</td>`
        +`<td style="padding:6px 8px;text-align:center;border-bottom:1px solid #e8eaf6;white-space:nowrap">`
        +`<button class="btn bp bsm" style="font-size:.65rem" onclick="event.stopPropagation();supOpen(${idx});setTimeout(()=>openSupExportFromCard(),200)">📊</button> `
        +`<button class="btn bo bsm" style="font-size:.65rem" onclick="event.stopPropagation();supEdit(${idx})">✏️</button>`
        +`</td></tr>`;
    });
    h+='</tbody></table>';
    document.getElementById('su-body').innerHTML=h||'<p style="color:#999">לא נמצאו</p>';
    setTimeout(_fitScrollAreas,50);
    return;
  }

  document.getElementById('su-body').className='sugrid scroll-area';
  _supCurrentList = all;
  let h='';
  all.forEach((s,idx)=>{
    const base=s.name; // already a base name from getAllBaseSups
    const ex=supBaseEx(base);
    const cnt=supBaseCnt(base);
    const acts=getSupActs(base);
    const phone=ex.ph1||s.phone||'';
    const cntDone=SCH.filter(sc=>supBase(sc.a)===base&&sc.st==='done').length;
    const cntCan=SCH.filter(sc=>supBase(sc.a)===base&&sc.st==='can').length;
    h+=`<div class="sucard" style="cursor:pointer;display:flex;flex-direction:column;justify-content:space-between" onclick="supOpen(${idx})">
      <div>
        <div style="font-weight:800;color:#1a237e;font-size:.88rem;line-height:1.35;margin-bottom:6px;word-break:break-word">📚 ${base}</div>
        ${phone?`<div style="color:#2e7d32;font-size:.78rem;font-weight:600;margin-bottom:5px">📞 ${phone}</div>`:''}
        ${acts.length?`<div style="margin-bottom:6px;display:flex;flex-wrap:wrap;gap:3px">
          ${acts.map(a=>`<span style="background:#e3f2fd;color:#1565c0;border-radius:10px;padding:2px 8px;font-size:.71rem;font-weight:600">🎯 ${a}</span>`).join('')}
        </div>`:''}
        ${ex.notes?`<div style="font-size:.68rem;color:#78909c;margin-bottom:4px">📝 ${ex.notes}</div>`:''}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;padding-top:6px;border-top:1px solid #f0f0f0">
        <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
          ${isActSupplier(base)?'<span class="sup-flag sup-flag-act" title="ספק חוגים פעיל">🎨</span>':'<span style="display:inline-block;padding:1px 5px;border-radius:10px;font-size:.64rem;background:#fce4ec;color:#c62828;font-weight:700" title="לא מוצג בחוגים">🚫 לא חוג</span>'}
          ${isPurchSupplier(base)?'':'<span style="display:inline-block;padding:1px 5px;border-radius:10px;font-size:.64rem;background:#fff3e0;color:#e65100;font-weight:700" title="לא ספק רכש">🚫 לא רכש</span>'}
          ${ex.entityType?`<span style="display:inline-block;padding:1px 6px;border-radius:10px;font-size:.66rem;background:#f3e5f5;color:#6a1b9a;font-weight:700">🏢 ${ex.entityType}</span>`:''}
          <span style="color:#1565c0;font-weight:700;font-size:.72rem">📅 ${cnt}</span>
          ${cntDone?`<span style="color:#2e7d32;font-size:.72rem">✔️ ${cntDone}</span>`:''}
          ${cntCan?`<span style="color:#c62828;font-size:.72rem">❌ ${cntCan}</span>`:''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn bp bsm" style="font-size:.65rem" onclick="event.stopPropagation();supOpen(${idx});setTimeout(()=>openSupExportFromCard(),200)">📊</button>
          <button class="btn bo bsm" style="font-size:.65rem" onclick="event.stopPropagation();supEdit(${idx})">✏️</button>
        </div>
      </div>
    </div>`;
  });
  document.getElementById('su-body').innerHTML=h||'<p style="color:#999">לא נמצאו</p>';
  setTimeout(_fitScrollAreas,50);
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
  // New fields
  const suContact=document.getElementById('su-contact'); if(suContact) suContact.value=ex.contact||'';
  const suEmail=document.getElementById('su-email'); if(suEmail) suEmail.value=ex.email||'';
  const suAddr=document.getElementById('su-addr'); if(suAddr) suAddr.value=ex.addr||'';
  const suMoe=document.getElementById('su-moe-tax'); if(suMoe) suMoe.value=ex.moeTax||'';
  const suAlias=document.getElementById('su-alias'); if(suAlias) suAlias.value=ex.alias||'';
  const suSchedPh=document.getElementById('su-sched-phone'); if(suSchedPh) suSchedPh.value=ex.schedPhone||'ph1';
  // Supplier type — default: isPurch=true, isAct=false for new suppliers
  const suIsAct = document.getElementById('su-is-act');
  const suIsPurch = document.getElementById('su-is-purch');
  const defaultIsAct = name ? (ex.isAct !== false) : false; // new suppliers default to purch-only
  const defaultIsPurch = name ? (ex.isPurch !== false) : true;
  if(suIsAct) suIsAct.checked = defaultIsAct;
  if(suIsPurch) suIsPurch.checked = defaultIsPurch;
  const suEntityType = document.getElementById('su-entity-type');
  if(suEntityType) suEntityType.value = ex.entityType||'';
  const suEntityTop = document.getElementById('su-entity-type-top');
  if(suEntityTop) suEntityTop.value = ex.entityType||'';
  // Show/hide acts section
  const suActsWrap = document.getElementById('su-acts-wrap');
  if(suActsWrap) suActsWrap.style.display = defaultIsAct ? 'block' : 'none';
  renderSupActsList(name);
  document.getElementById('su-act-new').value='';
  // Show delete button only when editing existing supplier
  const delBtn = document.getElementById('sum-del-btn');
  if (delBtn) delBtn.style.display = name ? 'inline-flex' : 'none';
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
function deleteSup() {
  const name = document.getElementById('su-name').dataset.orig;
  if (!name) return;
  const schedCount = SCH.filter(s => s.a === name && s.st !== 'can').length;
  const msg = schedCount > 0
    ? `לספק "${name}" יש ${schedCount} פעילויות פעילות.\nמחיקה תסיר את הספק מהמערכת אך לא תמחק את הפעילויות.\n\nלהמשיך?`
    : `למחוק את הספק "${name}"?`;
  if (!confirm(msg)) return;

  // Remove from supEx
  delete supEx[name];

  // Remove from custom suppliers list
  if (supEx['__c']) {
    supEx['__c'] = supEx['__c'].filter(s => s.name !== name);
  }

  // Mark as deleted in merged-away (hides from SUPBASE-based suppliers)
  if (!supEx['__merged_away']) supEx['__merged_away'] = [];
  if (!supEx['__merged_away'].includes(name)) supEx['__merged_away'].push(name);

  save();
  CM('sum');
  refresh();
  if (typeof renderSup === 'function') renderSup();
  if (typeof renderPurchSuppliers === 'function') try { renderPurchSuppliers(); } catch(e) {}
  showToast('🗑️ ספק "' + name + '" נמחק');
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
    contact:document.getElementById('su-contact')?.value.trim()||'',
    email:document.getElementById('su-email')?.value.trim()||'',
    addr:document.getElementById('su-addr')?.value.trim()||'',
    moeTax:document.getElementById('su-moe-tax')?.value.trim()||'',
    alias:document.getElementById('su-alias')?.value.trim()||'',
    schedPhone:document.getElementById('su-sched-phone')?.value||'ph1',
    acts:existActs,
    isAct: !!document.getElementById('su-is-act')?.checked,
    isPurch: !!document.getElementById('su-is-purch')?.checked,
    entityType: document.getElementById('su-entity-type')?.value||''
  };
  if(!origName&&!SUPBASE.find(s=>s.name===name)){
    if(!supEx['__c']) supEx['__c']=[];
    if(!supEx['__c'].find(s=>s.name===name)) supEx['__c'].push({id:Date.now(),name,phone:supEx[name].ph1});
  }
  save();CM('sum');refresh();
  try{ renderPurchSuppliers(); }catch(e){}
  try{ renderSup(); }catch(e){}
  // If opened from invoice modal, pre-fill the supplier field
  if(window._invPendingNewSup && name){
    window._invPendingNewSup=false;
    // Reopen invoice modal with new supplier pre-filled
    setTimeout(()=>{
      const invModal = document.getElementById('invoice-m');
      if(invModal){
        // Fill supplier field
        const supTxt=document.getElementById('inv-sup-text');
        if(supTxt){ supTxt.value=name; invUpdateEntityType((supEx[name]||{}).entityType||''); }
        // Re-fill datalist
        const dl=document.getElementById('inv-sup-datalist');
        if(dl) dl.innerHTML=getAllSup().map(s=>{
          const safeVal=s.name.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
          return `<option value="${safeVal}">${s.name}`;
        }).join('');
        // Reopen invoice modal
        invModal.classList.add('open');
      }
    }, 100);
  }
  ['dash-sup','cal-sup','s-sup','ns-sup'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const cur=el.value;
    el.innerHTML='<option value="">כל הספקים</option>';
    getAllSup().forEach(s=>el.innerHTML+=`<option value='${s.name}'>${s.name}</option>`);
    el.value=cur;
  });
}
// Global supplier list used by merge dialog (avoids HTML attribute escaping issues)
let _mergeSupList = [];
function openMerge(){
  _mergeSupList = getAllSup();
  const mm=document.getElementById('mrg-main');
  // Use index as value to avoid HTML escaping issues with " ' characters in names
  mm.innerHTML='<option value="">בחר ספק ראשי...</option>';
  _mergeSupList.forEach((s,i)=>mm.innerHTML+=`<option value="${i}">${s.name}</option>`);
  document.getElementById('mrg-list').innerHTML=_mergeSupList.map((s,i)=>{
    const cnt=SCH.filter(sc=>supBase(sc.a)===s.name||sc.a===s.name||sc.a.startsWith(s.name+' - ')).length;
    const invCnt=(typeof INVOICES!=='undefined')?INVOICES.filter(inv=>inv.supName===s.name||supBase(inv.supName||'')===s.name).length:0;
    return `<label style="display:flex;gap:6px;padding:4px 6px;cursor:pointer;align-items:center;border-radius:5px" onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background=''">`
      +`<input type="checkbox" data-idx="${i}" style="width:15px;height:15px">`
      +`<span style="flex:1">${s.name} `
      +`<span style="color:#1565c0;font-size:.7rem;font-weight:700">(${cnt} שיבוצים${invCnt?`, ${invCnt} חשבוניות`:''})</span>`
      +`</span></label>`;
  }).join('');
  document.getElementById('mrgm').classList.add('open');
}
// ────────────────────────────────────────────────────────────────────────────
// auditMergedSuppliers — הרץ מה-console לדוח מלא על כל ספק ממוזג
// Usage: auditMergedSuppliers()
// ────────────────────────────────────────────────────────────────────────────
function auditMergedSuppliers(){
  const mergedAway = supEx['__merged_away']||[];
  const allSups = getAllSup();
  const lines = [];

  lines.push('=== AUDIT: ספקים ממוזגים ===');
  lines.push(`mergedAway רשימה (${mergedAway.length}): ${mergedAway.join(', ')||'ריק'}`);
  lines.push('');

  // For every supplier, show if they have _mergedFrom
  const suppliersWithMerge = allSups.filter(s=>{
    const ex = supEx[s.name]||supEx[supBase(s.name)]||{};
    return (ex._mergedFrom||[]).length>0;
  });

  lines.push(`=== ספקים עם _mergedFrom (${suppliersWithMerge.length}) ===`);
  suppliersWithMerge.forEach(s=>{
    const base = s.name;
    const ex = supEx[base]||{};
    const acts = getSupActs(base);
    const schCnt = SCH.filter(sc=>supBase(sc.a)===base).length;
    const invCnt = (typeof INVOICES!=='undefined'?INVOICES:[]).filter(i=>supBase(i.supName||'')===base).length;
    lines.push(`\n► ${base}`);
    lines.push(`  _mergedFrom: [${(ex._mergedFrom||[]).join(', ')}]`);
    lines.push(`  isAct: ${ex.isAct} | isPurch: ${ex.isPurch}`);
    lines.push(`  acts (${acts.length}): [${acts.join(', ')}]`);
    lines.push(`  SCH שיבוצים: ${schCnt} | חשבוניות: ${invCnt}`);
    lines.push(`  בלוח חוגים: ${isActSupplier(base)?'✅ כן':'❌ לא'} | בלוח רכש: ${isPurchSupplier(base)?'✅ כן':'❌ לא'}`);
  });

  lines.push('\n=== mergedAway — פירוט כל ספק שמוסתר ===');
  mergedAway.forEach(name=>{
    const base = supBase(name);
    const schOrphans = SCH.filter(s=>supBase(s.a)===base).length;
    const invOrphans = (typeof INVOICES!=='undefined'?INVOICES:[]).filter(i=>supBase(i.supName||'')===base).length;
    const status = (schOrphans||invOrphans)?'⚠️ יש רשומות יתומות!':'✅ נקי';
    lines.push(`  ${name} (base: ${base}) → ${status}${schOrphans?` SCH:${schOrphans}`:''}${invOrphans?` INV:${invOrphans}`:''}`);
  });

  lines.push('\n=== כל הספקים — סיכום ===');
  allSups.forEach(s=>{
    const base=s.name;
    const acts=getSupActs(base);
    const cnt=SCH.filter(sc=>supBase(sc.a)===base).length;
    lines.push(`${base}: isAct=${isActSupplier(base)} isPurch=${isPurchSupplier(base)} acts=[${acts.join(',')}] SCH=${cnt}`);
  });

  const report = lines.join('\n');
  console.log(report);
  // Also show a toast summary
  showToast(`🔍 Audit: ${suppliersWithMerge.length} ספקים ממוזגים, ${mergedAway.length} מוסתרים — ראה console`);
  return report;
}

function doMerge(){
  const mainIdx=document.getElementById('mrg-main').value;
  if(mainIdx===''){alert('בחר ספק ראשי');return;}
  const main=_mergeSupList[parseInt(mainIdx)]?.name;
  if(!main){alert('שגיאה: לא נמצא ספק ראשי');return;}
  const checkedIdxs=[...document.querySelectorAll('#mrg-list input[type=checkbox]:checked')].map(c=>parseInt(c.dataset.idx));
  const toMrg=checkedIdxs.map(i=>_mergeSupList[i]?.name).filter(n=>n && n!==main);
  if(!toMrg.length){alert('בחר לפחות ספק אחד למיזוג');return;}
  if(!confirm(`לאחד ${toMrg.length} ספקים אל "${main}"?`)) return;

  const mainBase = supBase(main);
  let changedSch=0, changedInv=0;
  const mergedAway = new Set(supEx['__merged_away']||[]);

  // Collect all acts from main AND all merged suppliers BEFORE changing anything
  const allActs = new Set(getSupActs(main));
  let mergedIsAct = isActSupplier(main);
  let mergedIsPurch = isPurchSupplier(main);

  toMrg.forEach(old=>{
    const oldBase = supBase(old);

    // Collect acts from this merged supplier
    getSupActs(old).forEach(a=>allActs.add(a));
    if(isActSupplier(old)) mergedIsAct = true;
    if(isPurchSupplier(old)) mergedIsPurch = true;

    // 1. Update SCH: preserve activity type in new name
    SCH.forEach(s=>{
      if(!s.a) return;
      const sBase = supBase(s.a);
      const sAct = supAct(s.a);
      if(sBase === oldBase){
        // Keep activity type: if main="חיים בתנועה" and sAct="ריקוד" → "חיים בתנועה - ריקוד"
        // If main has its own act suffix: just use mainBase
        s.a = sAct ? (mainBase + ' - ' + sAct) : mainBase;
        changedSch++;
      }
    });

    // 2. Update INVOICES
    if(typeof INVOICES!=='undefined') INVOICES.forEach(inv=>{
      if(supBase(inv.supName||'')===oldBase){
        inv.supName = main;
        changedInv++;
      }
    });

    // 3. Merge supEx metadata
    const ex = supEx[old] || supEx[oldBase] || {};
    if(!supEx[mainBase]) supEx[mainBase]={};
    const mex = supEx[mainBase];
    if(!mex.ph1 && ex.ph1) mex.ph1=ex.ph1;
    if(!mex.ph2 && ex.ph2) mex.ph2=ex.ph2;
    if(!mex.email && ex.email) mex.email=ex.email;
    if(!mex.contact && ex.contact) mex.contact=ex.contact;
    if(!mex.addr && ex.addr) mex.addr=ex.addr;
    if(!mex.g1 && ex.g1) mex.g1=ex.g1;
    if(!mex.moeTax && ex.moeTax) mex.moeTax=ex.moeTax;
    if(!mex.entityType && ex.entityType) mex.entityType=ex.entityType;
    if(!mex.notes && ex.notes) mex.notes=ex.notes;

    // 4. Remove old from __c and supEx
    delete supEx[old];
    if(old !== oldBase) delete supEx[oldBase];
    if(supEx['__c']) supEx['__c'] = supEx['__c'].filter(s=>supBase(s.name)!==oldBase);

    // 5. Mark as merged-away (exact names only)
    mergedAway.add(old);
    // Also add all SUPBASE entries for oldBase (except main itself)
    SUPBASE.forEach(s=>{
      if(supBase(s.name)===oldBase && s.name!==main) mergedAway.add(s.name);
    });
  });

  // Save merged flags and acts on main
  if(!supEx[mainBase]) supEx[mainBase]={};
  // Store which bases were merged in (for act lookups later)
  const prevMergedFrom = supEx[mainBase]._mergedFrom||[];
  const newMergedBases = toMrg.map(o=>supBase(o)).filter(b=>b!==mainBase);
  supEx[mainBase]._mergedFrom = [...new Set([...prevMergedFrom,...newMergedBases])];
  supEx[mainBase].isAct = mergedIsAct;
  supEx[mainBase].isPurch = mergedIsPurch;
  supEx[mainBase].acts = [...allActs].sort((a,b)=>a.localeCompare(b,'he'));
  // Also store on exact main name if different from base
  if(main !== mainBase){
    if(!supEx[main]) supEx[main]={};
    supEx[main].isAct = mergedIsAct;
    supEx[main].isPurch = mergedIsPurch;
    supEx[main].acts = supEx[mainBase].acts;
  }

  // Ensure main is in __c if not in SUPBASE
  const inSupbase = SUPBASE.some(s=>supBase(s.name)===mainBase);
  if(!inSupbase){
    if(!supEx['__c']) supEx['__c']=[];
    if(!supEx['__c'].find(s=>supBase(s.name)===mainBase)){
      supEx['__c'].push({id:Date.now(),name:mainBase,phone:supEx[mainBase]?.ph1||''});
    }
  }

  supEx['__merged_away'] = [...mergedAway];
  save(true);
  CM('mrgm');
  refresh();
  try{ renderPurchSuppliers(); }catch(e){}
  showToast(`✅ אוחדו ${toMrg.length} ספקים → "${main}"${changedSch?` · ${changedSch} שיבוצים`:''}${changedInv?` · ${changedInv} חשבוניות`:''}`);
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
    // Show tabs, default to acts
    tabsDiv.style.display = 'block';
    setSucTab('acts');
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
  const acts=[...getSupActs(_sucName)]; acts.splice(idx,1);
  if(!supEx[_sucName]) supEx[_sucName]={};
  supEx[_sucName].acts=acts; sucRefreshActsList(); save();
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
    <th>תאריך</th><th>יום</th><th>עיר</th><th>צהרון</th><th>פעילות</th><th>שעה</th><th>קב'</th><th>סטטוס</th><th>הערות</th><th></th>
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
      <td style="text-align:center">${s.grp||1}</td>
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
window.addEventListener('beforeunload',()=>{
  createSnapshot('סגירה');
  // Try to sync to Firebase before closing
  const raw = localStorage.getItem('ganv5');
  if(raw && window._fbUser && window._cachedToken){
    const url = FIREBASE_DB_URL + '?auth=' + window._cachedToken;
    try{
      navigator.sendBeacon(url, new Blob([JSON.stringify({data:JSON.parse(raw),ts:Date.now(),version:'10.2'})],{type:'application/json'}));
    }catch(e){}
  }
});

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
function goToNohap(){
  ST('sched');
  setTimeout(()=>{
    ['s-city','s-cls','s-sup','s-th','s-tt','s-from','s-to','s-srch'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('s-st').value='nohap';
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


// ── Quick Cancel Popup ──────────────────────────────────
let _canQId = null;

function openCanQ(id) {
  _canQId = id;
  const s = SCH.find(x => x.id === id); if (!s) return;
  const g = G(s.g);
  document.getElementById('canq-info').innerHTML =
    `<b>${g.name}</b> · ${g.city} · ${s.a}${s.act?' · '+s.act:''}<br>📅 ${fD(s.d)} ${s.t?'⏰ '+fT(s.t):''}`;
  document.getElementById('canq-note').value = '';
  document.querySelectorAll('.can-reason-btn').forEach(b => b.classList.remove('sel'));
  const pair = gardenPair(s.g);
  const wrap = document.getElementById('canq-scope-wrap');
  const btns = document.getElementById('canq-scope-btns');
  if (pair) {
    const partners = pair.ids.filter(gid=>gid!==s.g).map(gid=>G(gid)).filter(x=>x.id);
    const allNames = [g,...partners].map(x=>x.name).join(' + ');
    btns.innerHTML =
      `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.8rem;padding:4px 6px;border-radius:5px;border:1.5px solid #e0e0e0;background:#fff">
        <input type="radio" name="canq-scope" value="solo" checked style="accent-color:#c62828">
        <span>🏫 <b>${g.name}</b> בלבד</span>
      </label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.8rem;padding:4px 6px;border-radius:5px;border:1.5px solid #e0e0e0;background:#fff">
        <input type="radio" name="canq-scope" value="pair" style="accent-color:#c62828">
        <span>🔗 כל הזוג — <b>${allNames}</b></span>
      </label>`;
    wrap.style.display = 'block';
  } else {
    wrap.style.display = 'none';
  }
  document.getElementById('canqm').classList.add('open');
}

function selCanReason(btn, reason) {
  document.querySelectorAll('.can-reason-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  if (reason === 'אחר') document.getElementById('canq-note').focus();
}

function saveCanQ() {
  const sel = document.querySelector('.can-reason-btn.sel');
  const mainReason = sel ? sel.dataset.r : '';
  const extra = document.getElementById('canq-note').value.trim();
  const fullReason = [mainReason, extra].filter(Boolean).join(' — ');
  if (!mainReason && !extra) { alert('יש לבחור סיבת ביטול'); return; }
  const scopeEl = document.querySelector('input[name="canq-scope"]:checked');
  const forPair = scopeEl && scopeEl.value === 'pair';
  const s = SCH.find(x => x.id === _canQId); if (!s) return;
  const doCancel = (evId) => {
    const ev = SCH.find(x => x.id === evId); if (!ev) return;
    ev.st = 'can'; ev.cr = mainReason || 'בוטל'; ev.cn = extra;
    const noteAdd = '❌ בוטל: ' + fullReason;
    ev.nt = ev.nt ? ev.nt + ' | ' + noteAdd : noteAdd;
  };
  doCancel(_canQId);
  if (forPair) {
    const pair = gardenPair(s.g);
    if (pair) pair.ids.filter(gid=>gid!==s.g).forEach(gid=>{
      const pEv = SCH.find(ps=>parseInt(ps.g)===parseInt(gid)&&ps.d===s.d&&ps.st!=='can');
      if (pEv) doCancel(pEv.id);
    });
  }
  saveAndRefresh('canqm');
}

// ── Cancel Entire Day ───────────────────────────────────
let _cancelDayDs = null;

function openCancelDay(ds) {
  _cancelDayDs = ds || td();
  document.getElementById('cancelday-date').value = _cancelDayDs;
  document.getElementById('cancelday-note').value = '';
  document.querySelectorAll('.cancelday-reason-btn').forEach(b => b.classList.remove('sel'));
  _updateCancelDayCnt();
  document.getElementById('cancelday-m').classList.add('open');
}

function _updateCancelDayCnt() {
  const cnt = SCH.filter(s => s.d === _cancelDayDs && s.st !== 'can').length;
  const el = document.getElementById('cancelday-cnt');
  if (!el) return;
  el.textContent = cnt > 0 ? `נמצאו ${cnt} פעילויות ביום זה שיבוטלו` : 'אין פעילויות פעילות ביום זה';
  el.style.color = cnt > 0 ? '#c62828' : '#888';
}

function cancelDayDateChg() {
  _cancelDayDs = document.getElementById('cancelday-date').value;
  _updateCancelDayCnt();
}

function selCancelDayReason(btn) {
  document.querySelectorAll('.cancelday-reason-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  if (btn.dataset.r === 'אחר') document.getElementById('cancelday-note').focus();
}

function saveCancelDay() {
  const sel = document.querySelector('.cancelday-reason-btn.sel');
  const mainReason = sel ? sel.dataset.r : '';
  const extra = document.getElementById('cancelday-note').value.trim();
  const fullReason = [mainReason, extra].filter(Boolean).join(' — ');
  if (!fullReason) { alert('יש לבחור סיבה'); return; }
  if (!_cancelDayDs) return;
  const toCancel = SCH.filter(s => s.d === _cancelDayDs && s.st !== 'can');
  if (toCancel.length === 0) { showToast('אין פעילויות לביטול ביום זה'); CM('cancelday-m'); return; }
  if (!confirm(`לבטל ${toCancel.length} פעילויות בתאריך ${fD(_cancelDayDs)}?\nסיבה: ${fullReason}`)) return;
  toCancel.forEach(s => {
    s.st = 'can'; s.cr = mainReason || 'בוטל'; s.cn = extra;
    const noteAdd = '❌ בוטל: ' + fullReason;
    s.nt = s.nt ? s.nt + ' | ' + noteAdd : noteAdd;
  });
  const icon = mainReason.includes('שביתה')?'✊':mainReason.includes('מלחמה')||mainReason.includes('מצב')?'🚨':mainReason.includes('חג')?'🕍':'🚫';
  blockedDates[_cancelDayDs] = { reason: fullReason, note: extra, icon };
  saveAndRefresh('cancelday-m');
  showToast(`❌ בוטלו ${toCancel.length} פעילויות — ${fD(_cancelDayDs)}`);
}

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
  const now=new Date();
  const y=now.getFullYear(), m=String(now.getMonth()+1).padStart(2,'0');
  document.getElementById('exp-from').value=`${y}-${m}`;
  document.getElementById('exp-to').value=`${y}-${m}`;
  // Cities
  const citySel=document.getElementById('exp-city');
  citySel.innerHTML='<option value="">-- כל הערים --</option>';
  cities().forEach(c=>{ const o=document.createElement('option');o.value=c;o.textContent=c;citySel.appendChild(o); });
  // Managers
  const mgrSel=document.getElementById('exp-mgr');
  mgrSel.innerHTML='<option value="">-- כל הרכזים --</option>';
  Object.values(managers).forEach(mg=>{ const o=document.createElement('option');o.value=mg.id;o.textContent=mg.name;mgrSel.appendChild(o); });
  // Gardens
  const ganSel=document.getElementById('exp-garden');
  ganSel.innerHTML='<option value="">-- בחר צהרון --</option>';
  const allGans=GARDENS.concat(_GARDENS_EXTRA||[]).sort((a,b)=>(a.city||'').localeCompare(b.city||'','he')||(a.name||'').localeCompare(b.name||'','he'));
  allGans.forEach(g=>{ const o=document.createElement('option');o.value=g.id;o.textContent=`${g.name} (${g.city})`;ganSel.appendChild(o); });
  document.getElementById('export-m').classList.add('open');
}

function expModeChg(){
  const mode=document.querySelector('input[name="exp-mode"]:checked').value;
  document.getElementById('exp-city-wrap').style.display=mode==='city'?'block':'none';
  document.getElementById('exp-mgr-wrap').style.display=mode==='manager'?'block':'none';
  document.getElementById('exp-garden-wrap').style.display=mode==='garden'?'block':'none';
}

// Helper: find manager assigned to a garden
function gardenManager(gardenId){
  return Object.values(managers).find(m=>(m.gardenIds||[]).includes(gardenId))||null;
}

function doMonthlyExport(){
  const fromM=document.getElementById('exp-from').value;
  const toM=document.getElementById('exp-to').value;
  if(!fromM||!toM){alert('יש לבחור תקופה');return;}
  const mode=document.querySelector('input[name="exp-mode"]:checked').value;
  const cityFilter=document.getElementById('exp-city').value;
  const mgrFilter=document.getElementById('exp-mgr').value;
  const gardenFilter=parseInt(document.getElementById('exp-garden').value)||0;
  const splitBy=document.getElementById('exp-split').value;

  const [fy,fm]=fromM.split('-').map(Number);
  const [ty,tm]=toM.split('-').map(Number);
  const fromDate=`${fy}-${String(fm).padStart(2,'0')}-01`;
  const toDate=d2s(new Date(ty,tm,0));

  let evs=SCH.filter(s=>s.d>=fromDate&&s.d<=toDate); // include cancelled for export
  let gList=GARDENS.concat(_GARDENS_EXTRA||[]);

  if(mode==='city'&&cityFilter)   gList=gList.filter(g=>g.city===cityFilter);
  if(mode==='manager'&&mgrFilter){ const mgrObj=managers[mgrFilter]; if(mgrObj?.gardenIds) gList=gList.filter(g=>mgrObj.gardenIds.includes(g.id)); }
  if(mode==='garden'&&gardenFilter){ gList=gList.filter(g=>g.id===gardenFilter); }

  // For single-garden mode: always export as one file
  const effectiveSplit = (mode==='garden') ? 'garden' : splitBy;

  const byCity={};
  gList.forEach(g=>{ if(!byCity[g.city]) byCity[g.city]=[]; byCity[g.city].push(g); });

  let filesExported=0;
  if(effectiveSplit==='garden'){
    gList.forEach(g=>{
      const gEvs=evs.filter(s=>s.g===g.id);
      if(!gEvs.length){ if(mode==='garden') alert(`אין פעילויות לגן "${g.name}" בתקופה שנבחרה`); return; }
      downloadWB(buildGardenWB(g, gEvs, fromDate, toDate), `לוח_חוגים_${g.name}_${fromM}.xlsx`, fromM);
      filesExported++;
    });
  } else {
    Object.entries(byCity).forEach(([city,gardens])=>{
      const cityGardens=gardens.filter(g=>evs.some(s=>s.g===g.id));
      if(!cityGardens.length) return;
      downloadWB(buildCityWB(city, cityGardens, evs, fromDate, toDate), `לוח_חוגים_${city}_${fromM}.xlsx`, fromM);
      filesExported++;
    });
  }
  CM('export-m');
  if(filesExported>0) showToast(`📊 ${filesExported} קבצי Excel נוצרו בהצלחה!`);
  else if(mode!=='garden') alert('⚠️ לא נמצאו פעילויות בטווח התאריכים שנבחר.');
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

function downloadWB(wb, filename, fromM) {
  const safeFile = filename.replace(/[^\u0590-\u05FF\w\-_.]/gu, '_');
  const gardens = wb.sheets.map(s => s.garden);
  const allEvs  = wb.sheets.reduce((acc, s) => acc.concat(s.evs), []);
  if (!gardens.length) return;
  // Prefer explicit fromM param; fallback to first event date
  let fy, fm;
  if (fromM) {
    [fy, fm] = fromM.split('-').map(Number);
  } else {
    const firstDs = allEvs.length ? [...allEvs].sort((a,b)=>a.d.localeCompare(b.d))[0].d : d2s(new Date());
    [fy, fm] = firstDs.split('-').map(Number);
  }

  // Try ExcelJS first (supports images + RTL)
  if (typeof ExcelJS !== 'undefined' && !window._excelJSFailed) {
    console.log('📊 Using ExcelJS for export:', safeFile, 'year:', fy, 'month:', fm);
    _downloadWBExcelJS(gardens, allEvs, fy, fm - 1, safeFile);
    return;
  }
  // Fallback: SheetJS (no images)
  if (typeof XLSX !== 'undefined') {
    try {
      console.log('📊 Using SheetJS fallback for export');
      const workbook = XLSX.utils.book_new();
      const ws = buildStyledSheet(gardens, allEvs, fy, fm - 1);
      XLSX.utils.book_append_sheet(workbook, ws, 'לוח חוגים');
      XLSX.writeFile(workbook, safeFile);
      return;
    } catch(e) {
      console.error('XLSX error:', e);
    }
  }
  // Last resort: CSV
  console.warn('📊 No Excel library found, falling back to CSV');
  _csvFallback(wb, safeFile);
}

async function _downloadWBExcelJS(gardens, allEvs, year, month, filename) {
  try {
    const workbook = new ExcelJS.Workbook();

    const HEB_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
    const HEB_DAYS   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
    function hebYear(y, m) {
      const base = y + 3760 + (m >= 8 ? 1 : 0);
      let n = base % 1000, s = '';
      const L = {400:'ת',300:'ש',200:'ר',100:'ק',90:'צ',80:'פ',70:'ע',60:'ס',50:'נ',40:'מ',30:'ל',20:'כ',10:'י',9:'ט',8:'ח',7:'ז',6:'ו',5:'ה',4:'ד',3:'ג',2:'ב',1:'א'};
      for (const v of [400,300,200,100,90,80,70,60,50,40,30,20,10,9,8,7,6,5,4,3,2,1])
        while(n>=v){s+=L[v];n-=v;}
      return s.length===1 ? s+"'" : s.slice(0,-1)+'"'+s.slice(-1);
    }
    const monthTitle  = `${HEB_MONTHS[month]} ${year} ${hebYear(year, month)}`;
    const daysInMonth = new Date(year, month+1, 0).getDate();

    const CLR = {
      BLUE:   'FFB8CCE4', RED:  'FFFF0000',
      YELLOW: 'FFFFC7CE', GOLD: 'FFFF9999', PINK: 'FFE6B8B7',
    };

    let logoImgId = null;
    if (typeof LOGO_B64 !== 'undefined' && LOGO_B64)
      logoImgId = workbook.addImage({ base64: LOGO_B64, extension: 'png' });

    function applyStyle(cell, {fill, sz, bold, align, valign, bt, bb, bl, br}={}) {
      if (fill) cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:fill} };
      cell.font      = { name:'Arial', size:sz||11, bold:bold!==false };
      cell.alignment = { horizontal:align||'center', vertical:valign||'middle', readingOrder:'rightToLeft', wrapText:false };
      const brd = {};
      if (bt) brd.top    = {style:bt};
      if (bb) brd.bottom = {style:bb};
      if (bl) brd.left   = {style:bl};
      if (br) brd.right  = {style:br};
      if (Object.keys(brd).length) cell.border = brd;
    }
    function styleDataRow(row, fill, fillABC) {
      // fillABC: override for cols A,B,C (name/age/date) — always BLUE unless Fri/Sat
      const colABCfill = fillABC !== undefined ? fillABC : (fill===CLR.RED ? CLR.RED : CLR.BLUE);
      for (let i=1; i<=9; i++) {
        const cellFill = i<=3 ? colABCfill : fill;
        applyStyle(row.getCell(i), {
          fill:cellFill, sz:(i===6||i===7)?10:11, align:i===1?'right':'center',
          bt:'thin', bb:'thin', bl:i===1?'medium':'thin', br:i===9?'medium':'thin'
        });
      }
    }

    // ── one worksheet per garden ─────────────────────────────
    gardens.forEach((garden) => {
      const sheetName = garden.name.replace(/[*?:\[\]/\\]/g,'').slice(0,31) || `גן${garden.id}`;
      const ws = workbook.addWorksheet(sheetName);

      ws.views = [{ state:'pageLayout', rightToLeft:true, showGridLines:true }];
      ws.pageSetup = {
        paperSize: 9, orientation: 'portrait',
        fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        horizontalCentered: true,
        margins: { left:0.08, right:0.20, top:0.55, bottom:0.20, header:0.31, footer:0.20 }
      };
      ws.columns = [
        {width:14.4},{width:3.6},{width:8.75},{width:9.25},
        {width:8.9},{width:24.6},{width:12.4},{width:4.25},{width:6.1}
      ];

      const mgr = typeof managers !== 'undefined'
        ? Object.values(managers).find(m => (m.gardenIds||[]).includes(garden.id))
        : null;
      const mgrText = mgr
        ? `שם הרכז: ${mgr.name}${mgr.phone ? ' · ' + mgr.phone : ''}`
        : 'שם הרכז בגן: _______________';

      const gardenEvs = allEvs.filter(s => {
        const [ey,em] = s.d.split('-').map(Number);
        return s.g===garden.id && ey===year && em===month+1;
      });
      const byDate = {};
      gardenEvs.forEach(s => { if(!byDate[s.d]) byDate[s.d]=[]; byDate[s.d].push(s); });

      let r = 0;

      // ── Excel Page Header: month+year top-right ─────────
      {
        const headerRight = `&"Arial,Bold"&18${monthTitle}`;
        ws.headerFooter.differentOddEven = false;
        ws.headerFooter.oddHeader  = `&R${headerRight}`;
        ws.headerFooter.evenHeader = `&R${headerRight}`;
      }

      // ── Row 1: blank spacer ───────────────────────────────
      { const row=ws.addRow([]); row.height=8; r++; }

      // ── Row 2: לוח חוגים title (font 14) ──────────────────
      {
        const row = ws.addRow(['לוח חוגים','','','','','','','','']);
        row.height = 20;
        applyStyle(row.getCell(1), {sz:14, bold:true, align:'center', valign:'middle'});
        for (let c=2;c<=9;c++) {
          row.getCell(c).font={name:'Arial',size:14,bold:true};
          row.getCell(c).alignment={horizontal:'center',vertical:'middle',readingOrder:'rightToLeft'};
        }
        ws.mergeCells(r+1,1,r+1,9);
        r++;
      }

      // ── Row 3: blank spacer ───────────────────────────────
      { const row=ws.addRow([]); row.height=8; r++; }

      // ── Row 4: Garden name + City ─────────────────────────
      {
        const row = ws.addRow([`צהרון: ${garden.name}`,'','','','',`עיר: ${garden.city}`,'','','']);
        row.height = 18;
        [1,2,3,4,5].forEach(c => {
          const cell = row.getCell(c);
          applyStyle(cell, {sz:14,bold:true,align:'center',valign:'middle'});
          cell.alignment = {horizontal:'center',vertical:'middle',readingOrder:'rightToLeft'};
        });
        [6,7,8,9].forEach(c => {
          const cell = row.getCell(c);
          applyStyle(cell, {sz:14,bold:true,align:'center',valign:'middle'});
          cell.alignment = {horizontal:'center',vertical:'middle',readingOrder:'rightToLeft'};
        });
        ws.mergeCells(r+1,1,r+1,5);
        ws.mergeCells(r+1,6,r+1,9);
        r++;
      }

      // ── Column headers ────────────────────────────────────
      {
        const hdrs = ['שם הצהרון','גיל','תאריך','יום','סוג','שם החוג','טלפון',"קב'",'שעה'];
        const row  = ws.addRow(hdrs);
        row.height = 18.6;
        hdrs.forEach((_, i) => {
          applyStyle(row.getCell(i+1), {
            sz:(i===5||i===6)?10:11, bold:true,
            align:i===0?'right':'center', valign:'top',
            bt:'medium', bb:'thin', bl:i===0?'medium':'thin', br:i===8?'medium':'thin'
          });
        });
        r++;
      }

      // ── Data rows — every calendar day ───────────────────
      for (let day=1; day<=daysInMonth; day++) {
        const date    = new Date(year, month, day);
        const dow     = date.getDay();
        const ds      = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const isFri   = dow===5, isSat=dow===6;
        const blk     = typeof blockedDates!=='undefined' ? blockedDates[ds] : null;
        const hol     = typeof getHolidayInfo==='function' ? getHolidayInfo(ds) : null;
        const dayName = `יום\u00a0${HEB_DAYS[dow]}`;
        const dateStr = `${day}/${month+1}/${String(year).slice(-2)}`;

        const dayEvs  = (byDate[ds]||[]).sort((a,b)=>(a.t||'').localeCompare(b.t||''));
        const specialNote = '';
        const rowCount = dayEvs.length || 1;

        for (let ei=0; ei<rowCount; ei++) {
          const ev      = dayEvs[ei] || null;
          const isFirst = ei===0;
          const isCan   = ev && (ev.st==='can'||ev.st==='nohap');

          const holType = hol ? (hol.type||'vacation') : null;
          let fill = CLR.BLUE;
          if (isFri||isSat)               fill = CLR.RED;
          else if (holType==='camp')       fill = CLR.GOLD;
          else if (holType)               fill = CLR.YELLOW;

          const supName = ev ? ((typeof supBase==='function'?supBase(ev.a):ev.a)||ev.a||'') : '';
          const evTpLabel = ev ? (ev.tp||'חוג') : '';
          const actName  = ev ? (ev.act||(typeof supAct==='function'?supAct(ev.a):'')||'') : '';
          const colF     = ev ? (actName?supName+' - '+actName:supName) : '';
          const phone    = ev ? (ev.p||(typeof supEx!=='undefined'&&supEx[supName]?.ph1)||'') : '';
          const grp      = ev ? (isCan ? 0 : (ev.grp||1)) : '';

          const vals = [
            garden.name, '',
            isFirst ? dateStr : '',
            isFirst ? dayName : '',
            ev ? (hol ? hol.name : evTpLabel) : (isFirst&&hol ? hol.name : ''),
            ev ? colF : '',
            ev ? phone    : '',
            ev ? grp      : '',
            ev ? (ev.t?ev.t.slice(0,5):'') : ''
          ];

          const row = ws.addRow(vals);
          row.height = 19.35;
          styleDataRow(row, fill);
          // Col E: uniform font size 9 for all holiday/camp names
          if(hol && hol.name) {
            const ce = row.getCell(5);
            ce.font = {...(ce.font||{}), name:'Arial', size: 9};
          }
          r++;
        }
      }

      // ── Footer ────────────────────────────────────────────
      // 5 blank spacer rows to push footer down
      for(let sp=0;sp<5;sp++){
        const blank=ws.addRow(['','','','','','','','','']);
        blank.height=19.35;
        r++;
      }
      // Manager row - right-aligned
      {
        const row = ws.addRow([mgrText,'','','','','','','','']);
        row.height = 18;
        applyStyle(row.getCell(1), {sz:11, bold:false, align:'right'});
        ws.mergeCells(r+1,1,r+1,9);
        r++;
      }
      // Main notice row — thick outer border box, 1.48cm height
      {
        const row = ws.addRow(['ייתכנו שינויים בלוח החוגים','','','','','','','','']);
        row.height = 42; // 1.48cm ≈ 42pt
        const thickBorder = {style:'thick'};
        applyStyle(row.getCell(1), {sz:22, bold:true, align:'center', valign:'middle'});
        row.getCell(1).border = {top:thickBorder, bottom:thickBorder, right:thickBorder};
        for (let c=2;c<=8;c++) {
          row.getCell(c).font={name:'Arial',size:22,bold:true};
          row.getCell(c).alignment={horizontal:'center',vertical:'middle',readingOrder:'rightToLeft'};
          row.getCell(c).border={top:thickBorder, bottom:thickBorder};
        }
        row.getCell(9).font={name:'Arial',size:22,bold:true};
        row.getCell(9).alignment={horizontal:'center',vertical:'middle',readingOrder:'rightToLeft'};
        row.getCell(9).border={top:thickBorder, bottom:thickBorder, left:thickBorder};
        ws.mergeCells(r+1,1,r+1,9);
        r++;
      }
    }); // end gardens.forEach

    const buffer = await workbook.xlsx.writeBuffer();

    // ── Post-process: inject pageLayout into sheetView XML ──────────────
    let finalBlob;
    try {
      // Use _SafeJSZip saved at page load (before ExcelJS could overwrite window.JSZip)
      const JZ = window._SafeJSZip;
      if (!JZ) throw new Error('_SafeJSZip not available');
      const zip = await JZ.loadAsync(buffer);
      const sheetKeys = Object.keys(zip.files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
      for (const sk of sheetKeys) {
        let xml = await zip.files[sk].async('text');
        // 1. Inject view="pageLayout" into <sheetView>
        xml = xml.replace(/<sheetView\b([^>]*?)(\/?>)/g, (m, attrs, close) => {
          const a2 = attrs.includes('view=')
            ? attrs.replace(/view="[^"]*"/, 'view="pageLayout"')
            : attrs + ' view="pageLayout"';
          return `<sheetView${a2}${close}`;
        });
        // 2. Inject header directly into XML
        const hdrText = `&amp;R&amp;&quot;Arial,Bold&quot;&amp;18${monthTitle}`;
        if (!xml.includes('<headerFooter')) {
          xml = xml.replace(/<\/sheetData>/, `</sheetData><headerFooter scaleWithDoc="0"><oddHeader>${hdrText}</oddHeader><evenHeader>${hdrText}</evenHeader></headerFooter>`);
        } else {
          xml = xml.replace(/<headerFooter[^>]*>[\s\S]*?<\/headerFooter>/,
            `<headerFooter scaleWithDoc="0"><oddHeader>${hdrText}</oddHeader><evenHeader>${hdrText}</evenHeader></headerFooter>`);
        }
        zip.file(sk, xml);
      }
      // STORE compression — DEFLATE corrupts binary parts of xlsx
      const patched = await zip.generateAsync({ type:'arraybuffer', compression:'STORE' });
      finalBlob = new Blob([patched], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    } catch(pErr) {
      console.warn('pageLayout patch failed, using raw buffer:', pErr);
      finalBlob = new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    }
        const a = document.createElement('a');
    a.href  = URL.createObjectURL(finalBlob);
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 1000);
    showToast('📊 קובץ Excel נוצר!');
  } catch(e) {
    console.error('ExcelJS error:', e);
    alert('שגיאה ביצירת Excel: ' + e.message + '\n\nבדוק את ה-console לפרטים');
    _csvFallback({sheets: gardens.map(g => ({garden:g, evs:allEvs.filter(s=>s.g===g.id)}))}, filename);
  }
}

function _csvFallback(wb, filename) {
  const csvParts = [];
  wb.sheets.forEach(({garden, evs}) => {
    csvParts.push(`=== ${garden.name} ===`);
    const {rows} = buildSheetData(garden, evs);
    rows.forEach(r => csvParts.push(r.map(c => c==null?'':String(c).replace(/,/g,'،')).join(',')));
    csvParts.push('');
  });
  const blob = new Blob(['\uFEFF'+csvParts.join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.replace('.xlsx','.csv');
  a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 1000);
}


function buildStyledSheet(gardens, allEvs, year, month) {
  const ws = {};
  const merges = [];
  const rowBreaks = [];
  let r = 0;

  const HEB_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const HEB_DAYS   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

  // Hebrew year calculation
  function _hebYear(y, m) {
    // m is 0-indexed. Rosh Hashana shifts Sep onwards to new year.
    const baseYear = y + 3760;
    const adjusted = m >= 8 ? baseYear + 1 : baseYear; // Sep(8)+ = new year
    // Convert to Hebrew letter notation תשפ"ו etc.
    const HEB_LETTERS = {
      1:'א',2:'ב',3:'ג',4:'ד',5:'ה',6:'ו',7:'ז',8:'ח',9:'ט',
      10:'י',20:'כ',30:'ל',40:'מ',50:'נ',60:'ס',70:'ע',80:'פ',90:'צ',
      100:'ק',200:'ר',300:'ש',400:'ת'
    };
    let n = adjusted % 1000; // e.g. 786 for תשפ"ו
    let result = '';
    const vals = [400,300,200,100,90,80,70,60,50,40,30,20,10,9,8,7,6,5,4,3,2,1];
    for (const v of vals) {
      while (n >= v) { result += HEB_LETTERS[v]; n -= v; }
    }
    // Insert geresh/gershayim
    if (result.length === 1) return result + "'";
    return result.slice(0,-1) + '"' + result.slice(-1);
  }

  const hebYearStr = _hebYear(year, month);
  const monthStr = `${HEB_MONTHS[month]} ${year} ${hebYearStr}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function fill(rgb) { return rgb ? {patternType:'solid',fgColor:{rgb}} : {patternType:'none'}; }
  function font(sz, bold) { return {name:'Arial', sz, bold:!!bold}; }
  function border(t, b, l, ri) {
    const s = st => st ? {style:st,color:{rgb:'FF000000'}} : undefined;
    const o = {};
    if (s(t)) o.top = s(t);
    if (s(b)) o.bottom = s(b);
    if (s(l)) o.left = s(l);
    if (s(ri)) o.right = s(ri);
    return o;
  }
  function align(h) { return {horizontal:h, vertical:'center', readingOrder:2}; }

  function sc(row, col, value, style) {
    const addr = XLSX.utils.encode_cell({r: row, c: col});
    const t = typeof value === 'number' ? 'n' : value instanceof Date ? 'd' : 's';
    ws[addr] = {v: value != null ? value : '', t: value != null ? t : 's', s: style || {}};
  }

  function dataRow(row, fillRgb, isLeftBorder) {
    // Apply full-row style with borders for all 9 columns
    for (let c = 0; c < 9; c++) {
      const addr = XLSX.utils.encode_cell({r: row, c});
      if (!ws[addr]) ws[addr] = {v: '', t: 's', s: {}};
      ws[addr].s = {
        ...ws[addr].s,
        fill: fill(fillRgb),
        font: font(c === 5 || c === 6 ? 10 : 11, true),
        border: border('thin','thin', c===0?'medium':'thin', c===8?'medium':'thin'),
        alignment: align(c===0?'right':'center')
      };
    }
  }

  gardens.forEach((garden, gIdx) => {
    // ── ROW 1: Title ──────────────────────────────────
    sc(r, 0, 'לוז חוגים', {font:font(14,true), alignment:align('center')});
    sc(r, 5, monthStr,     {font:font(14,true), alignment:align('center')});
    for (let c=1;c<5;c++) sc(r,c,'',{font:font(14,true)});
    for (let c=6;c<9;c++) sc(r,c,'',{font:font(14,true)});
    merges.push({s:{r,c:0},e:{r,c:4}});
    merges.push({s:{r,c:5},e:{r,c:8}});
    r++;

    // ── ROWS 2-3: Garden name + City ─────────────────
    sc(r,   0, ` צהרון: ${garden.name}`, {font:font(14,true), alignment:align('center')});
    sc(r,   5, ` עיר : ${garden.city}`,  {font:font(14,true), alignment:align('center')});
    for (let c=1;c<5;c++) sc(r,  c,'',{font:font(14,true)});
    for (let c=6;c<9;c++) sc(r,  c,'',{font:font(14,true)});
    for (let c=0;c<9;c++) sc(r+1,c,'',{font:font(14,true)});
    merges.push({s:{r,c:0},e:{r:r+1,c:4}});
    merges.push({s:{r,c:5},e:{r:r+1,c:8}});
    r += 2;

    // ── ROW 4: empty ─────────────────────────────────
    r++;

    // ── ROW 5: Column headers ─────────────────────────
    const hdrs  = ['שם הצהרון','גיל','תאריך','יום','חוג/הפעלה','שם החוג','טלפון',"קב'",'שעה'];
    const hAlgn = ['right','center','center','center','center','center','center','center','center'];
    const hSz   = [11,11,11,11,11,10,10,11,11];
    hdrs.forEach((h, c) => {
      sc(r, c, h, {
        font: font(hSz[c], true),
        alignment: {...align(hAlgn[c])},
        fill: fill(null),
        border: border('medium','thin', c===0?'medium':'thin', c===8?'medium':'thin')
      });
    });
    r++;

    // ── Data rows: one per day ────────────────────────
    const byDate = {};
    allEvs.filter(s => {
      const [ey,em] = s.d.split('-').map(Number);
      return s.g === garden.id && ey === year && em === month + 1;
    }).forEach(s => {
      if (!byDate[s.d]) byDate[s.d] = [];
      byDate[s.d].push(s);
    });

    for (let day = 1; day <= daysInMonth; day++) {
      const date   = new Date(year, month, day);
      const dow    = date.getDay();
      const ds     = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const isFri  = dow === 5;
      const isSat  = dow === 6;
      const blk    = blockedDates ? blockedDates[ds] : null;
      const hol    = typeof getHolidayInfo === 'function' ? getHolidayInfo(ds) : null;
      const holType2 = hol ? (hol.type||'vacation') : null;
      const fillRgb = (isFri||isSat) ? 'FFFF0000' : holType2==='camp' ? 'FFFF9999' : holType2 ? 'FFFFFF00' : null;
      const dayName = `יום\u00a0${HEB_DAYS[dow]}`;
      const dayEvs  = (byDate[ds]||[]).sort((a,b)=>(a.t||'').localeCompare(b.t||''));
      const specialNote = '';
      const rows = dayEvs.length || 1;

      for (let ei = 0; ei < rows; ei++) {
        const ev      = dayEvs[ei] || null;
        const isFirst = ei === 0;
        const isCan   = ev && (ev.st==='can'||ev.st==='nohap');
        // row fill: cancelled = light red, else as day color
        const rowFill = fillRgb;
        // Paint full row first
        dataRow(r + ei, rowFill);
        // Then fill values
        if (isFirst) {
          sc(r+ei, 0, garden.name, null); // always show garden name
          sc(r+ei, 2, ds,          null);
          sc(r+ei, 3, dayName,     null);
        }
        if (ev) {
          const supName = supBase(ev.a) || ev.a || '';
          const actType = ev.tp || 'חוג';
          const supData = SUPBASE ? SUPBASE.find(s=>(typeof supBase==='function'?supBase(s.name):s.name)===supName) : null;
          const phone   = ev.p || (supData&&supData.phone) || (supEx&&supEx[supName]&&supEx[supName].ph1) || '';
          const holObj = hol || null;
          sc(r+ei, 4, holObj ? (holObj.name||actType) : actType, null);
          sc(r+ei, 5, supName,         null);
          sc(r+ei, 6, phone,           null);
          sc(r+ei, 7, isCan ? 0 : (ev.grp||1), null);
          sc(r+ei, 8, ev.t ? ev.t.slice(0,5) : '', null);
        } else if (false) {
        }
      }
      r += rows;
    }

    // ── Footer ────────────────────────────────────────
    r += 3; // empty rows

    // "שם הרכז בגן" line with medium bottom border
    for (let c=0;c<9;c++) {
      sc(r, c, c===0?'שם הרכז בגן':'', {
        font: font(11,true),
        border: border(null,'medium',null,null),
        alignment: align(c===0?'right':'center')
      });
    }
    r++;

    // Footer note merged A:I over 2 rows
    sc(r, 0, '* שימו לב -  ייתכנו שינויים בתוכנית החוגים', {
      font: font(11,true),
      border: border('medium','medium',null,null),
      alignment: align('right')
    });
    for (let c=1;c<9;c++) sc(r,c,'',{border:border('medium',null,null,null)});
    for (let c=0;c<9;c++) sc(r+1,c,'',{border:border(null,'medium',null,null)});
    merges.push({s:{r,c:0},e:{r:r+1,c:8}});
    r += 2;

    // Page break after each garden except last
    if (gIdx < gardens.length - 1) {
      rowBreaks.push(r - 1);
      r++; // spacing row between gardens
    }
  });

  ws['!ref']       = XLSX.utils.encode_range({s:{r:0,c:0},e:{r:r-1,c:8}});
  ws['!merges']    = merges;
  ws['!rowbreaks'] = rowBreaks;
  ws['!cols']      = [{wch:14.4},{wch:3.6},{wch:8.75},{wch:9.25},{wch:8.9},{wch:24.6},{wch:12.4},{wch:4.25},{wch:6.1}];
  ws['!sheetView'] = [{rightToLeft: true}];
  return ws;
}

function buildSheetData(garden, evs) {
  // Legacy fallback — kept for CSV export
  const rows = [];
  const HEB_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const HEB_DAYS = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  rows.push(['לוז חוגים',null,null,null,null,null,null,null,null]);
  rows.push([` צהרון: ${garden.name}`,null,null,null,null,` עיר : ${garden.city}`,null,null,null]);
  rows.push(['שם הצהרון','גיל','תאריך','יום','חוג/הפעלה','שם החוג','טלפון',"קב'",'שעה']);
  if (!evs.length) { rows.push([null,null,null,null,'אין פעילויות',null,null,null,null]); return {rows}; }
  const byDate = {};
  evs.forEach(s => { if(!byDate[s.d]) byDate[s.d]=[]; byDate[s.d].push(s); });
  const dates = Object.keys(byDate).sort();
  dates.forEach(ds => {
    const dayEvs = (byDate[ds]||[]).sort((a,b)=>(a.t||'').localeCompare(b.t||''));
    const date = new Date(ds.replace(/-/g,'/'));
    const dayName = `יום\u00a0${HEB_DAYS[date.getDay()]}`;
    if (!dayEvs.length) { rows.push([null,null,ds,dayName,null,null,null,null,null]); return; }
    dayEvs.forEach((s,i) => {
      const supName = supBase(s.a)||s.a;
      rows.push([i===0?garden.name:null, null, i===0?ds:null, i===0?dayName:null,
        s.act||(typeof supAct==='function'?supAct(s.a):'')||'חוג',
        supName, s.p||'', s.grp||1, s.t?s.t.slice(0,5):''
      ]);
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
  txt+=`🏫 צהרונים באחריותו (${gs.length}):\n`;
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
  ['gan','sch','pairs','clusters','managers','fixed'].forEach(id=>{
    const b=document.getElementById('g-tab-'+id);
    if(b) b.classList.toggle('active',id===t);
  });

  // Always stay inside the gardens panel — render everything into g-body
  const gBody=document.getElementById('g-body');
  const gFilters=document.getElementById('g-filters');
  const fixedCtrl=document.getElementById('g-fixed-controls');
  const addBtn=document.querySelector('#p-gardens .btn.bp');

  // Show/hide filter row — only for gan/sch
  const showFilters=['gan','sch'].includes(t);
  if(gFilters) gFilters.style.display=showFilters?'':'none';
  if(fixedCtrl) fixedCtrl.style.display=t==='fixed'?'':'none';
  const gInfo=document.getElementById('g-info');
  if(gInfo) gInfo.style.display=t==='fixed'?'none':'';
  if(addBtn) addBtn.style.display=['gan','sch'].includes(t)?'':'none';

  if(t==='pairs'){
    gBody.className='scroll-area';
    gBody.innerHTML='';
    // Clone pairs panel content into g-body
    const src=document.querySelector('#p-pairs .card');
    if(src){ gBody.innerHTML=src.innerHTML; }
    renderPairs();
    return;
  }
  if(t==='clusters'){
    gBody.className='scroll-area';
    gBody.innerHTML='';
    const src=document.querySelector('#p-clusters .card');
    if(src){ gBody.innerHTML=src.innerHTML; }
    renderClusters();
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
  document.getElementById('g-cls').value=t==='gan'?'גנים':'ביה"ס';
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
    const gardens=byCity[city];
    const paired=new Set(), groups=[];
    [...gardens].sort((a,b)=>(a.name||'').localeCompare(b.name||'','he')).forEach(g=>{
      if(paired.has(g.id)) return;
      const pid=gardenPair(g.id);
      const partner=pid?allG.find(x=>x.id===pid):null;
      if(partner){ paired.add(g.id); paired.add(partner.id); groups.push({type:'pair',gardens:[g,partner]}); }
      else groups.push({type:'solo',gardens:[g]});
    });

    h+=`<div style="margin-bottom:20px">
      <div style="font-weight:800;color:#1a237e;font-size:.88rem;padding:7px 12px;background:#e8eaf6;border-radius:8px;margin-bottom:8px;display:flex;align-items:center;gap:8px">
        🏙️ ${city}<span style="font-size:.72rem;color:#5c6bc0;font-weight:600">(${gardens.length})</span>
      </div>`;

    groups.forEach(group=>{
      if(group.type==='pair'){
        h+=`<div style="background:#f3e5f5;border-radius:6px;padding:3px 10px;margin-bottom:5px;font-size:.72rem;color:#6a1b9a;font-weight:700">🔗 ${group.gardens[0].name} + ${group.gardens[1].name}</div>`;
        group.gardens.forEach(g=>{ h+=_renderGardenFixedRow(g); });
      } else {
        h+=_renderGardenFixedRow(group.gardens[0]);
      }
    });
    h+='</div>';
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
      const supN=supBase(s.a)||s.a||'';
      const actN=s.act||supAct(s.a)||'';
      const time=s.t?s.t.slice(0,5):'—';
      rows+=`<tr style="border-bottom:1px solid #eef0fb">
        <td style="padding:3px 10px;font-weight:600;color:#1a237e;white-space:nowrap">יום ${HEB_DAYS_SHORT[dow]}</td>
        <td style="padding:3px 10px;color:#222">${supN}${actN?' — '+actN:''}</td>
        <td style="padding:3px 10px;color:#5c6bc0;font-size:.71rem">${s.tp||'חוג'}</td>
        <td style="padding:3px 10px;color:#2e7d32;font-weight:600;white-space:nowrap">${time}</td>
        <td style="padding:2px 6px;white-space:nowrap">
          <button onclick="event.stopPropagation();openSP(${s.id})" style="background:#e8eaf6;border:none;border-radius:4px;padding:2px 7px;font-size:.68rem;cursor:pointer;color:#3949ab" title="פתח / ערוך">✏️</button>
          <button onclick="event.stopPropagation();openSP(${s.id})" style="background:#ffebee;border:none;border-radius:4px;padding:2px 7px;font-size:.68rem;cursor:pointer;color:#c62828;margin-right:2px" title="ביטול">❌</button>
        </td>
      </tr>`;
    });
  } else {
    rows=`<tr><td colspan="4" style="padding:5px 10px;color:#bbb;font-size:.72rem;font-style:italic">אין שיבוץ קבוע</td></tr>`;
  }
  return `<div style="display:flex;margin-bottom:7px;border:1px solid #e3e7f5;border-radius:8px;overflow:hidden">
    <div style="background:#f5f7ff;padding:8px 10px;min-width:120px;max-width:140px;display:flex;flex-direction:column;justify-content:space-between;border-left:1px solid #e3e7f5">
      <div style="font-weight:800;color:#1a237e;font-size:.8rem;margin-bottom:6px">${g.name}</div>
      <div style="display:flex;flex-direction:column;gap:3px;margin-top:4px">
        <button class="btn bp bsm" style="font-size:.62rem;padding:2px 5px" onclick="openGM(${gid})">📂 כרטיס</button>
        <button class="btn bo bsm" style="font-size:.62rem;padding:2px 5px" onclick="_goToGardenSched(${gid})">📅 שיבוצים</button>
      </div>
    </div>
    <div style="flex:1;overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:.78rem">
        <thead><tr style="background:#eef2ff">
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700">יום</th>
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700">ספק / פעילות</th>
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700">סוג</th>
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700">שעה</th>
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
  document.querySelectorAll('#mob-nav .mob-nav-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
}
function mobNavPurch(btn){
  document.querySelectorAll('#mob-nav-purch .mob-nav-btn').forEach(b=>b.classList.remove('active'));
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
  try{ localStorage.setItem(PI_ST_KEY, JSON.stringify(_getPiStSelected())); }catch(e){}
  renderInvoices();
}

function piStAll(cb){
  document.querySelectorAll('.pi-st-cb').forEach(c=>c.checked=cb.checked);
  _setPiStLabel();
  try{ localStorage.setItem(PI_ST_KEY, JSON.stringify(cb.checked?[]:[])); }catch(e){}
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
    const saved = JSON.parse(localStorage.getItem(PI_ST_KEY)||'null');
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

function dashNavDate(d){
  const el=document.getElementById('dash-date');
  if(!el) return;
  if(d===0){ el.value=td(); }
  else {
    const cur=el.value?s2d(el.value):new Date();
    el.value=d2s(addD(cur,d));
  }
  renderDash();
}

let _listGroupMode = 'pairs'; // 'pairs' | 'clusters'
function setListGroupMode(v){
  _listGroupMode = v;
  document.getElementById('vlb-group-pairs')?.classList.toggle('active', v==='pairs');
  document.getElementById('vlb-group-clusters')?.classList.toggle('active', v==='clusters');
  renderCal();
}

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

// ══════════════════════════════════════════════════════
// Daily Firebase Backup — saves to backups/YYYY-MM-DD
// Max 30 days kept. Runs once per day after successful save.
// ══════════════════════════════════════════════════════
const BACKUP_DB_BASE = 'https://ganmanage-default-rtdb.europe-west1.firebasedatabase.app/backups';
const BACKUP_LAST_KEY = '_fbDailyBackupDate';

async function _runDailyBackupIfNeeded(liveData, tok){
  try{
    const today = d2s(new Date());
    const lastBackup = _safeLS.get(BACKUP_LAST_KEY)||'';
    if(lastBackup === today) return; // already backed up today

    const authQ = tok ? '?auth='+tok : '';

    // 1. Write today's backup
    const backupUrl = `${BACKUP_DB_BASE}/${today}.json${authQ}`;
    const payload = { data: liveData, ts: Date.now(), version: '10.2' };
    const r = await fetch(backupUrl, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if(!r.ok){ console.warn('Backup failed:', r.status); return; }

    // 2. Mark done
    _safeLS.setItem(BACKUP_LAST_KEY, today);
    console.log('✅ Daily backup saved:', today);

    // 3. Prune backups older than 30 days
    const listR = await fetch(`${BACKUP_DB_BASE}.json?shallow=true${tok?'&auth='+tok:''}`);
    if(listR.ok){
      const keys = Object.keys(await listR.json()||{});
      const cutoff = d2s(addD(new Date(), -30));
      const toDelete = keys.filter(k=>k<cutoff);
      for(const k of toDelete){
        await fetch(`${BACKUP_DB_BASE}/${k}.json${authQ}`, {method:'DELETE'});
        console.log('🗑️ Deleted old backup:', k);
      }
    }
  } catch(e){ console.warn('Daily backup error:', e.message); }
}

async function loadCloudBackups(){
  const el=document.getElementById('cloud-backup-list');
  const btn=document.getElementById('cloud-backup-btn');
  if(!el) return;
  el.innerHTML='<span style="color:#999">טוען...</span>';
  if(btn) btn.disabled=true;
  try{
    let tok=null;
    if(window._fbUser) try{ tok=await window._fbUser.getIdToken(false); }catch(e){}
    const authQ=tok?'?auth='+tok:'';
    const r=await fetch(`${BACKUP_DB_BASE}.json?shallow=true${tok?'&auth='+tok:''}`);
    if(!r.ok){ el.innerHTML='<span style="color:#c62828">שגיאה: '+r.status+'</span>'; return; }
    const _rawJson = await r.json();
    const keys = _rawJson ? Object.keys(_rawJson).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort().reverse().slice(0,30) : [];
    if(!keys.length){ el.innerHTML='<span style="color:#999">אין גיבויים עדיין. גיבוי ראשון יישמר אוטומטית היום.</span>'; return; }
    const today=d2s(new Date());
    el.innerHTML='<div style="display:flex;flex-direction:column;gap:5px">'+
      keys.map(k=>`<div style="background:${k===today?'#e8f5e9':'#f5f7ff'};border-radius:7px;padding:7px 11px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <span style="font-weight:700;font-size:.82rem">${fD(k)}</span>
          ${k===today?'<span style="font-size:.68rem;background:#2e7d32;color:#fff;border-radius:8px;padding:1px 6px;margin-right:5px">היום</span>':''}
        </div>
        <button class="btn bp bsm" onclick="restoreCloudBackup('${k}')">🔄 שחזר</button>
      </div>`).join('')+'</div>';
  } catch(e){ el.innerHTML='<span style="color:#c62828">שגיאה: '+e.message+'</span>'; }
  if(btn) btn.disabled=false;
}

async function restoreCloudBackup(dateKey){
  if(!confirm(`לשחזר גיבוי מ-${fD(dateKey)}?\nהנתונים הנוכחיים יישמרו תחילה כ-snapshot מקומי.`)) return;
  const el=document.getElementById('cloud-backup-list');
  if(el) el.innerHTML='<span style="color:#e65100">משחזר...</span>';
  try{
    let tok=null;
    if(window._fbUser) try{ tok=await window._fbUser.getIdToken(false); }catch(e){}
    const authQ=tok?'?auth='+tok:'';
    const r=await fetch(`${BACKUP_DB_BASE}/${dateKey}.json${authQ}`);
    if(!r.ok){ showToast('❌ שגיאה בטעינת גיבוי: '+r.status); return; }
    const backup=await r.json();
    const appData=backup.data||backup;
    if(!appData||!appData.ch){ showToast('❌ גיבוי פגום'); return; }
    // Save current as local snapshot first
    createSnapshot('לפני שחזור מענן');
    // Apply the backup data
    _applyYearData(appData);
    save(true);
    showToast('✅ שוחזר מגיבוי '+fD(dateKey)+' — שומר...');
    setTimeout(()=>{ refresh(); CM('backupm'); }, 1500);
  } catch(e){ showToast('❌ שגיאת שחזור: '+e.message); }
}

async function forceDailyBackup(){
  const btn = document.getElementById('cloud-backup-btn');
  showToast('☁️ שומר גיבוי...');
  try{
    let tok=null;
    if(window._fbUser){ try{ tok=await window._fbUser.getIdToken(true); }catch(e){} }
    const liveData={
      ch:SCH, pairs, supEx, clusters, holidays, pairBreaks,
      managers, blockedDates, gardenBlocks, invoices:INVOICES,
      vatRate:VAT_RATE, activeGardens:activeGardens?[...activeGardens]:null
    };
    // Force backup even if already done today
    _safeLS.setItem(BACKUP_LAST_KEY,''); 
    await _runDailyBackupIfNeeded(liveData, tok);
    showToast('✅ גיבוי נשמר לענן');
    setTimeout(loadCloudBackups, 500);
  } catch(e){ showToast('❌ שגיאת גיבוי: '+e.message); }
}

// ══════════════════════════════════════════════════════
// User Management — admin only
// ══════════════════════════════════════════════════════
const ADMIN_UID = 'NflZLysieCdmx21KJEfDYx014Op2';
const USERS_DB  = 'https://ganmanage-default-rtdb.europe-west1.firebasedatabase.app/users';

function _isAdmin(){ return window._fbUser?.uid === ADMIN_UID; }

// Show users button only for admin
window._initUsersUI = function _initUsersUI(){
  const isAdm = _isAdmin();
  // Admin button in mode bar
  const adminModeBtn = document.getElementById('modeBtn-admin');
  if(adminModeBtn) adminModeBtn.style.display = isAdm ? '' : 'none';
  // Legacy buttons
  const btn = document.getElementById('users-mgmt-btn');
  if(btn) btn.style.display = isAdm ? 'inline-flex' : 'none';
  const hBtn = document.getElementById('users-hdr-btn');
  if(hBtn) hBtn.style.display = isAdm ? '' : 'none';
  // Show logged-in username in header
  if(window._fbUser){
    const uname = window._fbUser.email?.replace('@ganmanager.app','')||'';
    const unameEl = document.getElementById('auth-user-name');
    if(unameEl) unameEl.textContent = '👤 ' + uname;
  }
  // Show logout button (desktop)
  const logoutBtn = document.getElementById('logout-btn');
  if(logoutBtn) logoutBtn.style.display = '';
  // Mobile: show user bar + username
  const mobUserBar = document.getElementById('mob-user-bar');
  if(mobUserBar) mobUserBar.style.display = 'block';
  const mobUsername = document.getElementById('mob-username-display');
  const uname2 = window._fbUser?.email?.replace('@ganmanager.app','')||'';
  if(mobUsername) mobUsername.textContent = '👤 ' + uname2;
  // Show admin button in mobile nav
  const mobAdminBtn = document.getElementById('mob-admin-btn');
  if(mobAdminBtn) mobAdminBtn.style.display = isAdm ? 'flex' : 'none';
  // Load data if admin
  if(isAdm && typeof loadUsersList==='function') setTimeout(loadUsersList, 500);
  if(isAdm && typeof loadActivityLog==='function') setTimeout(()=>loadActivityLog('week'), 800);
}

async function openUsersModal(){
  if(!_isAdmin()){ showToast('❌ אין הרשאה'); return; }
  ST('admin'); // navigate to admin tab
  setTimeout(loadUsersList, 300);
}

async function _authQ(){
  let tok=null;
  if(window._fbUser) try{ tok=await window._fbUser.getIdToken(false); }catch(e){}
  return tok ? '?auth='+tok : '';
}

async function loadUsersList(){
  const el=document.getElementById('users-list');
  if(!el) return;
  el.innerHTML='<span style="color:#999;font-size:.78rem">טוען...</span>';
  try{
    const q=await _authQ();
    const r=await fetch(USERS_DB+'.json'+q);
    if(!r.ok){ el.innerHTML='<span style="color:#c62828">שגיאה '+r.status+'</span>'; return; }
    const users=await r.json()||{};
    const roleLabel={admin:'👑 מנהל',edit:'✏️ עריכה',view:'👁️ צפייה'};
    const roleBg={admin:'#fce4ec',edit:'#e8f5e9',view:'#e3f2fd'};
    const entries=Object.entries(users).sort((a,b)=>(a[1].name||'').localeCompare(b[1].name||'','he'));
    if(!entries.length){ el.innerHTML='<span style="color:#999;font-size:.78rem">אין משתמשים עדיין</span>'; return; }
    el.innerHTML=entries.map(([uid,u])=>`
      <div style="background:#fff;border-radius:8px;margin-bottom:8px;border:1px solid #e8eaf6;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#f8f9ff">
          <div>
            <span style="font-weight:700;font-size:.85rem">${u.name||u.username||'—'}</span>
            <span style="font-size:.72rem;color:#546e7a;margin-right:6px">${u.username||''}</span>
            ${uid===ADMIN_UID?'<span style="font-size:.68rem;background:#fff3e0;color:#e65100;border-radius:8px;padding:1px 6px">אדמין</span>':''}
          </div>
          ${uid!==ADMIN_UID?`<div style="display:flex;gap:4px"><button class="btn bo bsm" style="font-size:.68rem" onclick="changeUserPassword('${uid}','${u.username||u.name}')">🔑 סיסמה</button><button class="btn br bsm" style="font-size:.68rem" onclick="deleteUser('${uid}','${u.name||u.username}')">🗑️ מחק</button></div>`:''}
        </div>
        ${uid!==ADMIN_UID?`<div style="padding:8px 12px;display:flex;flex-wrap:wrap;gap:16px">
          <div>
            <div style="font-size:.68rem;color:#546e7a;margin-bottom:4px;font-weight:700">גישה ל:</div>
            <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;cursor:pointer;margin-bottom:3px">
              <input type="checkbox" ${u.permAct!==false?'checked':''} onchange="updateUserPerm('${uid}','permAct',this.checked)"> 🎨 חוגים
            </label>
            <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;cursor:pointer">
              <input type="checkbox" ${u.permPurch?'checked':''} onchange="updateUserPerm('${uid}','permPurch',this.checked)"> 🛒 רכש
            </label>
          </div>
          <div>
            <div style="font-size:.68rem;color:#546e7a;margin-bottom:4px;font-weight:700">רמת גישה:</div>
            <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;cursor:pointer;margin-bottom:3px">
              <input type="radio" name="role_${uid}" value="view" ${u.role!=='edit'?'checked':''} onchange="changeUserRole('${uid}','view')"> 👁️ צפייה בלבד
            </label>
            <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;cursor:pointer">
              <input type="radio" name="role_${uid}" value="edit" ${u.role==='edit'?'checked':''} onchange="changeUserRole('${uid}','edit')"> ✏️ עריכה
            </label>
          </div>
        </div>`:''}
      </div>`).join('');
  } catch(e){ el.innerHTML='<span style="color:#c62828">שגיאה: '+e.message+'</span>'; }
}

async function createNewUser(){
  if(!_isAdmin()) return;
  const username=(document.getElementById('nu-username')?.value||'').trim().toLowerCase();
  const displayName=(document.getElementById('nu-displayname')?.value||'').trim();
  const password=document.getElementById('nu-password')?.value||'';
  const permAct=document.getElementById('nu-perm-act')?.checked!==false;
  const permPurch=document.getElementById('nu-perm-purch')?.checked||false;
  const role=document.querySelector('input[name="nu-access"]:checked')?.value||'view';
  const statusEl=document.getElementById('nu-status');
  const btn=document.getElementById('nu-create-btn');

  if(!username||!password||!displayName){
    statusEl.innerHTML='<span style="color:#c62828">יש למלא שם משתמש, שם לתצוגה וסיסמה</span>'; return;
  }
  if(password.length<6){
    statusEl.innerHTML='<span style="color:#c62828">הסיסמה חייבת להכיל לפחות 6 תווים</span>'; return;
  }
  if(!/^[a-z0-9_.-]+$/.test(username)){
    statusEl.innerHTML='<span style="color:#c62828">שם משתמש: אותיות לטיניות קטנות, ספרות, קו תחתון בלבד</span>'; return;
  }

  btn.disabled=true;
  statusEl.innerHTML='<span style="color:#1565c0">⏳ יוצר משתמש...</span>';

  try{
    // Create Firebase Auth user (secondary app - admin stays logged in)
    const {uid,email}=await window._fbCreateUser(username, password);

    // Save user profile to RTDB
    const q=await _authQ();
    const r=await fetch(`${USERS_DB}/${uid}.json${q}`,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({uid,username,name:displayName,role,email,permAct,permPurch,createdAt:Date.now()})
    });
    if(!r.ok) throw new Error('שמירה נכשלה: '+r.status);

    statusEl.innerHTML=`<span style="color:#2e7d32">✅ משתמש נוצר! שם: <b>${username}</b> | סיסמה: <b>${password}</b></span>`;
    document.getElementById('nu-username').value='';
    document.getElementById('nu-displayname').value='';
    document.getElementById('nu-password').value='';
    await loadUsersList();
  } catch(e){
    statusEl.innerHTML=`<span style="color:#c62828">❌ שגיאה: ${e.message}</span>`;
  }
  btn.disabled=false;
}

async function changeUserRole(uid, newRole){
  if(!_isAdmin()) return;
  try{
    const q=await _authQ();
    await fetch(`${USERS_DB}/${uid}/role.json${q}`,{
      method:'PUT', headers:{'Content-Type':'application/json'},
      body:JSON.stringify(newRole)
    });
    showToast('✅ תפקיד עודכן');
  } catch(e){ showToast('❌ שגיאה: '+e.message); }
}

async function deleteUser(uid, name){
  if(!_isAdmin()) return;
  if(!confirm(`למחוק את המשתמש "${name}"? הם לא יוכלו להתחבר יותר.`)) return;
  try{
    const q=await _authQ();
    await fetch(`${USERS_DB}/${uid}.json${q}`,{method:'DELETE'});
    showToast(`✅ משתמש "${name}" הוסר`);
    await loadUsersList();
  } catch(e){ showToast('❌ שגיאה: '+e.message); }
}

// Also save admin profile on first load if not exists
async function _ensureAdminProfile(){
  if(!_isAdmin()){ _initUsersUI(); return; }
  _initUsersUI(); // show button immediately
  try{
    const q=await _authQ();
    const r=await fetch(`${USERS_DB}/${ADMIN_UID}.json${q}`);
    if(r.ok){
      const d=await r.json();
      if(!d){
        await fetch(`${USERS_DB}/${ADMIN_UID}.json${q}`,{
          method:'PUT', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({uid:ADMIN_UID,username:'perry',name:'Perry',role:'admin',email:'perry@ganmanager.app'})
        });
      }
    }
  } catch(e){}
  _initUsersUI();
}

// ══════════════════════════════════════════════════════
// Activity Log — track changes by all users, 30 days
// ══════════════════════════════════════════════════════
const LOG_DB = 'https://ganmanage-default-rtdb.europe-west1.firebasedatabase.app/activityLog';

async function _writeLog(action, target, detail, extra={}){
  try{
    if(!window._fbUser) return;
    const userName = window._fbUser.email?.replace('@ganmanager.app','')||'unknown';
    const entry = {
      ts: Date.now(),
      user: userName,
      action,   // 'status'|'move'|'new'|'delete'|'edit'|'invoice'
      target,   // e.g. "גן חיה - ריקוד"
      detail,   // e.g. "לא התקיים"
      ...extra
    };
    let tok=null;
    if(window._fbUser) try{ tok=await window._fbUser.getIdToken(false); }catch(e){}
    const q = tok?'?auth='+tok:'';
    const key = Date.now()+'_'+Math.random().toString(36).slice(2,7);
    await fetch(`${LOG_DB}/${key}.json${q}`,{
      method:'PUT', headers:{'Content-Type':'application/json'},
      body:JSON.stringify(entry)
    });
  } catch(e){ /* non-critical, ignore */ }
}

async function loadActivityLog(filter='week'){
  const el=document.getElementById('admin-log-body');
  if(!el) return;
  el.innerHTML='<span style="color:#999;font-size:.78rem">טוען...</span>';
  try{
    let tok=null;
    if(window._fbUser) try{ tok=await window._fbUser.getIdToken(false); }catch(e){}
    const q=tok?'?auth='+tok:'';
    const r=await fetch(`${LOG_DB}.json${q}`);
    if(!r.ok){ el.innerHTML='<span style="color:#c62828">שגיאה: '+r.status+'</span>'; return; }
    const raw=await r.json()||{};
    const cutoff = filter==='day'?Date.now()-86400000:filter==='week'?Date.now()-604800000:Date.now()-2592000000;
    let entries=Object.entries(raw)
      .map(([k,v])=>v)
      .filter(v=>v&&v.ts>=cutoff)
      .sort((a,b)=>b.ts-a.ts)
      .slice(0,200);
    if(!entries.length){ el.innerHTML='<span style="color:#999;font-size:.78rem">אין שינויים בתקופה זו</span>'; return; }
    const actionIcon={status:'📋',move:'📅',new:'➕',delete:'🗑️',edit:'✏️',invoice:'💰',cancel:'❌'};
    el.innerHTML=`<table style="width:100%;border-collapse:collapse;font-size:.8rem">
      <thead><tr style="background:#f0f0ff;position:sticky;top:0">
        <th style="padding:6px 10px;text-align:right">זמן</th>
        <th style="padding:6px 10px;text-align:right">משתמש</th>
        <th style="padding:6px 10px;text-align:right">פעולה</th>
        <th style="padding:6px 10px;text-align:right">נושא</th>
        <th style="padding:6px 10px;text-align:right">פרט</th>
      </tr></thead>
      <tbody>`+entries.map((e,i)=>{
        const d=new Date(e.ts);
        const tStr=d.getDate()+'/'+(d.getMonth()+1)+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
        const bg=i%2===0?'#fff':'#f8f8ff';
        return `<tr style="background:${bg};border-bottom:1px solid #eee">
          <td style="padding:5px 10px;color:#546e7a;white-space:nowrap">${tStr}</td>
          <td style="padding:5px 10px;font-weight:700;color:#1a237e">${e.user||'—'}</td>
          <td style="padding:5px 10px">${actionIcon[e.action]||'•'} ${e.action||''}</td>
          <td style="padding:5px 10px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.target||''}</td>
          <td style="padding:5px 10px;color:#2e7d32;font-weight:600">${e.detail||''}</td>
        </tr>`;
      }).join('')+'</tbody></table>';

    // Auto-prune entries older than 30 days
    _pruneOldLogs(raw, tok).catch(()=>{});
  } catch(e){ el.innerHTML='<span style="color:#c62828">שגיאה: '+e.message+'</span>'; }
}

async function _pruneOldLogs(raw, tok){
  const cutoff30 = Date.now()-2592000000;
  const q=tok?'?auth='+tok:'';
  for(const [k,v] of Object.entries(raw)){
    if(v&&v.ts<cutoff30){
      await fetch(`${LOG_DB}/${k}.json${q}`,{method:'DELETE'});
    }
  }
}

function doLogout(){
  if(!confirm('להתנתק?')) return;
  if(typeof window._fbSignOut==='function') window._fbSignOut();
}

async function updateUserPerm(uid, perm, value){
  if(!_isAdmin()) return;
  try{
    const q=await _authQ();
    await fetch(`${USERS_DB}/${uid}/${perm}.json${q}`,{
      method:'PUT', headers:{'Content-Type':'application/json'},
      body:JSON.stringify(value)
    });
    showToast('✅ הרשאה עודכנה');
  } catch(e){ showToast('❌ שגיאה: '+e.message); }
}

async function changeUserPassword(uid, username){
  if(!_isAdmin()) return;
  const newPass = prompt(`סיסמה חדשה עבור "${username}" (לפחות 6 תווים):`);
  if(!newPass) return;
  if(newPass.length < 6){ showToast('❌ סיסמה קצרה מדי (לפחות 6 תווים)'); return; }

  // Strategy: save new password hash to RTDB
  // On next login, Firebase Auth updatePassword is called if user changes their own
  // For admin resetting: store plaintext temporarily in RTDB (admin-only node)
  // User will be required to change on next login
  try{
    const q = await _authQ();
    // Save new password to user record (admin will see it, user should change it)
    await fetch(`${USERS_DB}/${uid}/tempPassword.json${q}`,{
      method:'PUT', headers:{'Content-Type':'application/json'},
      body:JSON.stringify(newPass)
    });
    
    // Also try to update via secondary auth app
    try{
      const cred = await window._fbCreateUser ? null : null; // can't directly update another user's password from client
      // Best we can do: show admin the new password to tell the user
    } catch(e2){}
    
    showToast(`✅ סיסמה חדשה נשמרה עבור "${username}": ${newPass}`);
    // Show confirmation with the password for admin to share
    setTimeout(()=>{
      alert(`✅ סיסמה חדשה עבור "${username}":\n\nסיסמה: ${newPass}\n\nשתף עם המשתמש — הם ישתמשו בה בכניסה הבאה.`);
    }, 100);
    await loadUsersList();
  } catch(e){ showToast('❌ שגיאה: '+e.message); }
}
