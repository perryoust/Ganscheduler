// ══════════════════════════════════════════════
// Firebase Realtime Database Sync - v10.2
// ══════════════════════════════════════════════
const FIREBASE_DB_URL = 'https://ganmanage-default-rtdb.europe-west1.firebasedatabase.app/data.json';
const FIREBASE_POLL_INTERVAL = 10000;

// (Global _safeLS is now defined in data.js)
let _fbLastSaveTs = parseInt(window._safeLS.get('_fbLastSaveTs')||'0');
let _fbLastLoadTs = parseInt(window._safeLS.get('_fbLastLoadTs')||'0');

let _fbLastOwnSaveTs = 0; // timestamp of OUR last successful save (not from load)
function _setFbSaveTs(ts){ _fbLastSaveTs=ts; window._safeLS.setItem('_fbLastSaveTs',String(ts)); _fbUpdateStatus(); }
function _setFbLoadTs(ts){ _fbLastLoadTs=ts; window._safeLS.setItem('_fbLastLoadTs',String(ts)); _fbUpdateStatus(); }
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
  window._safeLS.setItem('ganv5', jsonStr);
  window._safeLS.setItem('ganv5_local_ts', String(cloudTs));
  window._fbAppData = appData; // in-memory reference, no JSON needed

  // Load invoices from separate /data/invoices path
  try {
    const _iTok = window._cachedToken || (window._fbUser ? await window._fbUser.getIdToken(false) : null);
    if(_iTok){
      const _iR = await fetch(
        'https://ganmanage-default-rtdb.europe-west1.firebasedatabase.app/data/invoices.json?auth='+_iTok
      );
      if(_iR.ok){
        const _iD = await _iR.json();
        if(_iD && typeof _iD==='object'){
          appData.invoices = Array.isArray(_iD) ? _iD : Object.values(_iD);
          console.log('Invoices loaded from separate path:', appData.invoices.length);
        }
      }
    }
  } catch(e){ console.warn('Separate invoices load:', e); }

  // Apply data DIRECTLY to memory — does NOT rely on localStorage
  if (typeof window._applyYearData === 'function') {
    try {
      window._applyYearData(appData);
    } catch(e) { console.error('_applyYearData failed', e); }
  }
  window._fbLastKnownInvoiceCount = Math.max(
    window._fbLastKnownInvoiceCount||0,
    (typeof window.INVOICES!=='undefined'?window.INVOICES.length:0)
  );

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

// Sanitize Firebase keys (forbidden: . $ # [ ] /)
function _fbSanitizeKey(k){ return k.replace(/\./g,'｡').replace(/\$/g,'＄').replace(/#/g,'＃').replace(/\[/g,'［').replace(/\]/g,'］').replace(/\//g,'∕'); }
function _fbRestoreKey(k){ return k.replace(/｡/g,'.').replace(/＄/g,'$').replace(/＃/g,'#').replace(/［/g,'[').replace(/］/g,']').replace(/∕/g,'/'); }
function _sanitizeSupEx(obj){
  if(!obj) return {};
  const out={};
  Object.entries(obj).forEach(([k,v])=>{ out[_fbSanitizeKey(k)]=v; });
  return out;
}
function _restoreSupEx(obj){
  if(!obj) return {};
  const out={};
  Object.entries(obj).forEach(([k,v])=>{ out[_fbRestoreKey(k)]=v; });
  return out;
}

async function saveToFirebase(silent) {
  if(window._importInProgress) return; // blocked during import
  // Safety: don't save in first 2 seconds after page load (initialization window)
  if(Date.now() - (window._appStartTime||0) < 2000){
    console.warn('saveToFirebase: skipped (within startup window)');
    return false;
  }
  try {
    // Prefer in-memory data (most up-to-date) over stored
    const liveData = {
      ch: typeof window.SCH!=='undefined'?window.SCH:[],
      pairs: typeof window.pairs!=='undefined'?window.pairs:[],
      supEx: (()=>{ if(typeof window.supEx==='undefined') return {};
        const _s={...window.supEx}; delete _s['__c']; return _sanitizeSupEx(_s); })(),
      clusters: typeof window.clusters!=='undefined'?window.clusters:{},
      holidays: typeof window.holidays!=='undefined'?window.holidays:[],
      pairBreaks: typeof window.pairBreaks!=='undefined'?window.pairBreaks:{},
      managers: typeof window.managers!=='undefined'?window.managers:{},
      blockedDates: typeof window.blockedDates!=='undefined'?window.blockedDates:{},
      gardenBlocks: typeof window.gardenBlocks!=='undefined'?window.gardenBlocks:{},
      // invoices saved separately to /data/invoices (too large for main payload)
      autoBackupCfg: window.loadAutoBackupSettings()||undefined,
      piStatusFilter: (()=>{ try{ const s=window._safeLS.getItem(window.PI_ST_KEY); return s?JSON.parse(s):undefined; }catch(e){ return undefined; } })(),
      vatRate: typeof window.VAT_RATE!=='undefined'?window.VAT_RATE:18,
      activeGardens: typeof window.activeGardens!=='undefined'&&window.activeGardens?[...window.activeGardens]:null
    };
    // Validate: don't overwrite with significantly less data
    const raw = JSON.stringify(liveData);
    if(!raw || raw.length < 100) { console.warn('Save aborted: data too small'); return false; }

    _fbSyncing = true;
    _fbUpdateStatus();
    const nowTs = Date.now();
    const payload = { data: JSON.parse(raw), ts: nowTs, version: '10.2' };
    console.log('Saving to Firebase: SCH=', JSON.parse(raw).ch?.length, '| invoices saved separately');
    // Always refresh token before saving (prevents 401 on mobile)
    let _saveTok = null;
    if(window._fbUser){ try{ _saveTok = await window._fbUser.getIdToken(false); }catch(te){ try{ _saveTok = await window._fbUser.getIdToken(true); }catch(te2){} } }
    if(!_saveTok && window._fbGetToken) _saveTok = await window._fbGetToken();
    const _saveQ   = _saveTok ? '?auth=' + _saveTok : '';
    // ── Conflict guard: detect if another device saved since our last load ──
    try {
      const _tsUrl = 'https://ganmanage-default-rtdb.europe-west1.firebasedatabase.app/data/ts.json';
      const _cR = await fetch(_tsUrl + (_saveTok ? '?auth='+_saveTok : ''));
      if (_cR.ok) {
        const _remoteTs = await _cR.json();
        const _myLastTs = _fbLastOwnSaveTs || _fbLastSaveTs || 0;
        if (_remoteTs && typeof _remoteTs === 'number' && _remoteTs > _myLastTs) {
          if (!silent) {
            const _proceed = confirm('⚠️ מכשיר אחר שמר נתונים ב-' + _fmtTs(_remoteTs) + '\nהמשך ידרוס את השינויים שלו.\nלחץ אישור להמשך, ביטול לטעינת הגרסה החדשה.');
            if (!_proceed) {
              _fbSyncing = false;
              _fbUpdateStatus();
              await loadFromFirebase(false, true);
              return false;
            }
          }
        }
      }
    } catch(_ce) { /* if conflict check fails, proceed with save */ }
    // ── End conflict guard ──
    const r = await fetch(FIREBASE_DB_URL + _saveQ, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (r.ok) {
      _setFbSaveTs(nowTs);
      window._safeLS.setItem('ganv5_local_ts', String(nowTs));
      _fbLastError = null;
      _fbLastOwnSaveTs = nowTs; // track our own saves
      // Show save indicator (small flash)
      const _bi=document.getElementById('backup-ind');
      if(_bi){_bi.textContent='☁️ נשמר';_bi.classList.add('show');clearTimeout(_bi._to);_bi._to=setTimeout(()=>_bi.classList.remove('show'),1500);}
      if (!silent) showToast('✅ סונכרן ל-Firebase ' + _fmtTs(nowTs));

      // Save invoices separately to /data/invoices (different path = no overwrite conflict)
      if(typeof window.INVOICES!=='undefined' && window.INVOICES.length > 0 && _saveTok){
        const _invObj = {};
        window.INVOICES.forEach(i=>{ if(i&&i.id) _invObj[i.id]=i; });
        fetch('https://ganmanage-default-rtdb.europe-west1.firebasedatabase.app/data/invoices.json?auth='+_saveTok, {
          method: 'PUT',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(_invObj)
        }).catch(e=>console.warn('Invoice separate save failed:',e));
      }
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
        if(r2.ok){ _setFbSaveTs(nowTs); window._safeLS.setItem('ganv5_local_ts',String(nowTs)); return true; }
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
  window._safeLS.setItem('ganv5', JSON.stringify(appData));
  _setFbSaveTs(cloudTs);
  _setFbLoadTs(Date.now());
  try {
    const d = typeof appData==='string' ? JSON.parse(appData) : appData;
    if(typeof window._applyYearData==='function') window._applyYearData(d);
    window._fbLastKnownInvoiceCount = Math.max(window._fbLastKnownInvoiceCount||0, d.invoices?.length||0);
    if(typeof window.syncSupplierList==='function') window.syncSupplierList();
    try{ if(typeof window.renderDash==='function') window.renderDash(); }catch(e){}
    try{ if(typeof window.renderCal==='function') window.renderCal(); }catch(e){}
    try{ if(typeof window.renderInvoices==='function') window.renderInvoices(); }catch(e){}
    try{ if(typeof window.refreshPurchDash==='function') window.refreshPurchDash(); }catch(e){}
    try{ if(typeof window.updCounts==='function') window.updCounts(); }catch(e){}
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
      if(typeof window.renderDash==='function') try{window.renderDash();}catch(e){}
      if(typeof window.renderCal==='function') try{window.renderCal();}catch(e){}
      if(typeof window.renderInvoices==='function') try{window.renderInvoices();}catch(e){}
      if(typeof window.refreshPurchDash==='function') try{window.refreshPurchDash();}catch(e){}
      if(typeof window.updCounts==='function') try{window.updCounts();}catch(e){}
      window.showToast('✅ נטענו נתונים מ-Firebase');
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
