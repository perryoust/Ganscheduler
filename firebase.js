// ══════════════════════════════════════════════
// Firebase Realtime Database Sync - v3.0 (Robust)
// ══════════════════════════════════════════════
const FIREBASE_DB_URL = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data.json';
const FIREBASE_POLL_INTERVAL = 30000;

let _localSeq = parseInt(window._safeLS.get('_fbSeq') || '0');
let _lastSyncTs = 0;
let _isLocked = false;
let _syncTimer = null;
let _fbSyncing = false;
let _fbLastError = null;
window._fbSyncReady = false;
window._importInProgress = false; // Global flag: blocks polling during import

// ── State Update ─────────────────────────────
function _setSyncState(seq, ts, error = null) {
  if (seq) {
    _localSeq = seq;
    window._safeLS.setItem('_fbSeq', String(seq));
  }
  if (ts) _lastSyncTs = ts;
  _fbLastError = error;
  _fbUpdateStatus();
}

// ── Status UI ────────────────────────────────
function _fbUpdateStatus() {
  const btn = document.getElementById('od-btn');
  if (!btn) return;
  
  if (_fbSyncing) {
    btn.innerHTML = '🔄 מסנכרן...';
    btn.style.background = '#e65100';
    return;
  }
  
  if (_fbLastError) {
    btn.innerHTML = '❌ שגיאת סנכרון<br><span style="font-size:.6rem">' + _fbLastError + '</span>';
    btn.style.background = '#c62828';
    return;
  }
  
  const ageSec = Math.floor((Date.now() - _lastSyncTs) / 1000);
  if (_lastSyncTs && ageSec < 120) {
    btn.innerHTML = '☁️ מעודכן ✓<br><span style="font-size:.6rem">הרגע</span>';
    btn.style.background = '#2e7d32';
  } else if (_lastSyncTs) {
    const mins = Math.floor(ageSec / 60);
    btn.innerHTML = `☁️ סונכרן לפני ${mins}ד'<br><span style="font-size:.6rem">v${_localSeq}</span>`;
    btn.style.background = mins > 10 ? '#e65100' : '#2e7d32';
  } else {
    btn.innerHTML = '☁️ מתחבר...';
  }
}

// ── Authentication ────────────────────────────
async function doLogin() {
  const u = (document.getElementById('auth-username').value || '').trim().toLowerCase();
  const p = (document.getElementById('auth-password').value || '');
  if (!u || !p) { alert('נא למלא שם משתמש וסיסמה'); return; }
  
  try {
    const btn = document.getElementById('auth-login-btn');
    btn.disabled = true; btn.textContent = 'מתחבר...';
    await window._fbSignIn(u, p, document.getElementById('auth-remember').checked);
  } catch(e) {
    alert('שגיאת התחברות: ' + e.message);
    location.reload();
  }
}

// ── Core Sync Logic ──────────────────────────
async function saveToFirebase(silent = false, force = false) {
  if (_isLocked && !force) return false;
  _isLocked = true;
  _fbSyncing = true;
  _fbUpdateStatus();

  try {
    const liveData = {
      ch: window.SCH || [],
      pairs: window.pairs || [],
      supEx: window.supEx || {},
      clusters: window.clusters || {},
      holidays: window.holidays || [],
      pairBreaks: window.pairBreaks || {},
      managers: window.managers || {},
      blockedDates: window.blockedDates || {},
      gardenBlocks: window.gardenBlocks || {},
      vatRate: window.VAT_RATE || 18,
      activeGardens: window.activeGardens ? [...window.activeGardens] : null,
      useSraws: typeof window.useSraws !== 'undefined' ? window.useSraws : true
    };

    // Increment Sequence
    const newSeq = _localSeq + 1;
    const payload = { data: liveData, ts: Date.now(), seq: newSeq, version: '3.0' };
    
    let tok = await window._fbUser?.getIdToken(true);
    const url = FIREBASE_DB_URL + (tok ? '?auth=' + tok : '');
    
    const r = await fetch(url, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });

    if (!r.ok) throw new Error('HTTP ' + r.status);
    
    // Save Invoices Separately
    if (window.INVOICES && window.INVOICES.length > 0) {
      const invUrl = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data/invoices.json' + (tok ? '?auth=' + tok : '');
      await fetch(invUrl, { method: 'PUT', body: JSON.stringify(window.INVOICES) });
    }

    _setSyncState(newSeq, Date.now());
    console.log('[Sync] Saved v' + newSeq + ' (' + (liveData.ch?.length || 0) + ' records)');
    return true;
  } catch(e) {
    _setSyncState(null, null, e.message);
    console.error('[Sync] Save failed:', e.message);
    return false;
  } finally {
    _fbSyncing = false;
    _isLocked = false;
    _fbUpdateStatus();
  }
}

async function loadFromFirebase(silent = false, force = false) {
  // CRITICAL: Never load from Firebase during an import — it would overwrite the imported data
  if (window._importInProgress) {
    console.warn('[Sync] Load blocked — import in progress');
    return true;
  }
  if (_isLocked && !force) return false;
  _fbSyncing = true;
  _fbUpdateStatus();

  try {
    let tok = await window._fbUser?.getIdToken(false);
    const url = FIREBASE_DB_URL + (tok ? '?auth=' + tok : '');
    
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'cb=' + Date.now());
    if (!r.ok) throw new Error('HTTP ' + r.status);
    
    const cloud = await r.json();
    if (!cloud || !cloud.seq) return true;

    if (!force && cloud.seq <= _localSeq && window._fbSyncReady) {
      _setSyncState(cloud.seq, Date.now());
      return true;
    }

    // Load Invoices Separately
    const invUrl = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data/invoices.json' + (tok ? '?auth=' + tok : '');
    const ir = await fetch(invUrl);
    if (ir.ok) {
      const invs = await ir.json();
      cloud.data.invoices = Array.isArray(invs) ? invs : Object.values(invs || {});
    }

    window._fbAppData = cloud.data;

    if (window._applyYearData) {
      window._applyYearData(cloud.data);
    }
    
    _setSyncState(cloud.seq, Date.now());
    window._fbSyncReady = true;
    return true;
  } catch(e) {
    _setSyncState(null, null, e.message);
    return false;
  } finally {
    _fbSyncing = false;
    _fbUpdateStatus();
  }
}

function _fbStartPolling() {
  if (_syncTimer) clearInterval(_syncTimer);
  _syncTimer = setInterval(() => loadFromFirebase(true), FIREBASE_POLL_INTERVAL);
}

function _fbStopPolling() {
  if (_syncTimer) { clearInterval(_syncTimer); _syncTimer = null; }
  console.log('[Sync] Polling stopped');
}

// ── PUBLIC API ───────────────────────────────
// CRITICAL: ghAutoSave is called by core.js save() to push data to Firebase.
// Without this alias, Firebase never gets updated!
window.ghAutoSave = saveToFirebase;
window.save = saveToFirebase;
window.load = loadFromFirebase;
window.saveToFirebase = saveToFirebase;
window.loadFromFirebase = loadFromFirebase;
window._fbStartPolling = _fbStartPolling;
window._fbStopPolling = _fbStopPolling;

window._onAuthReady = async function() {
  await loadFromFirebase();
  _fbStartPolling();
};
