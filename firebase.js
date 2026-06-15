// ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•
// Firebase Realtime Database Sync - v3.0 (Robust)
// ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•
function getFirebaseDbUrl() {
  const base = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';
  if (window.CURRENT_YEAR && window.CURRENT_YEAR !== 'tashpav') {
    return `${base}/years/${window.CURRENT_YEAR}/data.json`;
  }
  return `${base}/data.json`;
}

function getFirebaseInvoicesUrl() {
  const base = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';
  return `${base}/data/invoices.json`;
}
const FIREBASE_POLL_INTERVAL = 30000;

let _localSeq = parseInt(window._safeLS.getItem('_fbSeq') || '0');
let _lastSyncTs = 0;
let _isLocked = false;
let _syncTimer = null;
let _fbSyncing = false;
let _fbLastError = null;
window._fbSyncReady = false;
window._importInProgress = false; // Global flag: blocks polling during import

// ג”€ג”€ State Update ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
function _setSyncState(seq, ts, error = null, isLoad = false) {
  if (seq) {
    _localSeq = seq;
    window._safeLS.setItem('_fbSeq', String(seq));
  }
  if (ts) {
    _lastSyncTs = ts;
    if (isLoad) {
      window._fbLastLoadTs = ts;
      const el = document.getElementById('info-fb-load');
      if (el) el.textContent = new Date(ts).toLocaleTimeString('he-IL');
    } else {
      window._fbLastSaveTs = ts;
      const el = document.getElementById('info-fb-save');
      if (el) el.textContent = new Date(ts).toLocaleTimeString('he-IL');
    }
  }
  _fbLastError = error;
  _fbUpdateStatus();
}

// ג”€ג”€ Status UI ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
function _fbUpdateStatus() {
  const btn = document.getElementById('od-btn');
  if (!btn) return;

  if (_fbSyncing) {
    btn.innerHTML = 'נ”„ ׳׳¡׳ ׳›׳¨׳...';
    btn.style.background = '#e65100';
    return;
  }

  if (_fbLastError) {
    btn.innerHTML = 'ג ׳©׳’׳™׳׳× ׳¡׳ ׳›׳¨׳•׳<br><span style="font-size:.6rem">' + _fbLastError + '</span>';
    btn.style.background = '#c62828';
    return;
  }

  const ageSec = Math.floor((Date.now() - _lastSyncTs) / 1000);
  if (_lastSyncTs && ageSec < 120) {
    btn.innerHTML = 'ג˜ן¸ ׳׳¢׳•׳“׳›׳ ג“<br><span style="font-size:.6rem">׳”׳¨׳’׳¢</span>';
    btn.style.background = '#2e7d32';
  } else if (_lastSyncTs) {
    const mins = Math.floor(ageSec / 60);
    btn.innerHTML = `ג˜ן¸ ׳¡׳•׳ ׳›׳¨׳ ׳׳₪׳ ׳™ ${mins}׳“'<br><span style="font-size:.6rem">v${_localSeq}</span>`;
    btn.style.background = mins > 10 ? '#e65100' : '#2e7d32';
  } else {
    btn.innerHTML = 'ג˜ן¸ ׳׳×׳—׳‘׳¨...';
  }
}

// ג”€ג”€ Authentication ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
async function doLogin() {
  const u = (document.getElementById('auth-username').value || '').trim().toLowerCase();
  const p = (document.getElementById('auth-password').value || '');
  if (!u || !p) { window.spAlert('׳ ׳ ׳׳׳׳ ׳©׳ ׳׳©׳×׳׳© ׳•׳¡׳™׳¡׳׳”'); return; }

  try {
    const btn = document.getElementById('auth-login-btn');
    btn.disabled = true; btn.textContent = '׳׳×׳—׳‘׳¨...';
    await window._fbSignIn(u, p, document.getElementById('auth-remember').checked);
  } catch (e) {
    window.spAlert('׳©׳’׳™׳׳× ׳”׳×׳—׳‘׳¨׳•׳×: ' + e.message);
    location.reload();
  }
}

// Helper to sanitize supplier names for Firebase Database keys (removes . $ # [ ] /)
window.cleanSupplierNamesBeforeSave = function () {
  if (typeof window.supEx === 'undefined') return;
  const clean = (s) => String(s || '').replace(/[.$#[\]/]/g, '').trim();

  // 1. Clean window.supEx keys
  const oldKeys = Object.keys(window.supEx);
  for (const key of oldKeys) {
    if (key === '__c' || key === '__merged_away') continue;
    const cleanedKey = clean(key);
    if (cleanedKey !== key) {
      console.log(`[Clean] Renaming supEx key "${key}" -> "${cleanedKey}"`);
      window.supEx[cleanedKey] = { ...(window.supEx[cleanedKey] || {}), ...window.supEx[key] };
      delete window.supEx[key];
    }
  }

  // 2. Clean names inside window.supEx['__c']
  if (Array.isArray(window.supEx['__c'])) {
    window.supEx['__c'].forEach(s => {
      if (s.name) {
        const cleanedName = clean(s.name);
        if (cleanedName !== s.name) {
          console.log(`[Clean] Renaming supEx.__c name "${s.name}" -> "${cleanedName}"`);
          s.name = cleanedName;
        }
      }
    });
  }

  // 3. Clean names inside window.supEx['__merged_away']
  if (Array.isArray(window.supEx['__merged_away'])) {
    window.supEx['__merged_away'] = window.supEx['__merged_away'].map(name => {
      const cleanedName = clean(name);
      if (cleanedName !== name) {
        console.log(`[Clean] Renaming supEx.__merged_away name "${name}" -> "${cleanedName}"`);
      }
      return cleanedName;
    });
  }

  // 4. Clean names inside window.INVOICES
  if (Array.isArray(window.INVOICES)) {
    window.INVOICES.forEach(inv => {
      if (inv.supName) {
        const cleanedName = clean(inv.supName);
        if (cleanedName !== inv.supName) {
          inv.supName = cleanedName;
        }
      }
    });
  }

  // 5. Clean names inside window.SCH
  if (Array.isArray(window.SCH)) {
    window.SCH.forEach(s => {
      if (s.a) {
        const cleanedName = clean(s.a);
        if (cleanedName !== s.a) {
          s.a = cleanedName;
        }
      }
    });
  }
  // 6. Clean keys in window.spScannerAliases to prevent Firebase errors
  if (typeof window.spScannerAliases === 'object' && window.spScannerAliases !== null) {
    const oldAliasKeys = Object.keys(window.spScannerAliases);
    for (const key of oldAliasKeys) {
      const cleanedKey = clean(key);
      if (cleanedKey !== key) {
        if (cleanedKey) {
          console.log(`[Clean] Renaming spScannerAliases key "${key}" -> "${cleanedKey}"`);
          window.spScannerAliases[cleanedKey] = window.spScannerAliases[key];
        } else {
          console.log(`[Clean] Removing invalid spScannerAliases key "${key}"`);
        }
        delete window.spScannerAliases[key];
      }
    }
  }
};

// ג”€ג”€ Core Sync Logic ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
async function saveToFirebase(silent = false, force = false) {
  if (_isLocked && !force) return false;
  _isLocked = true;
  _fbSyncing = true;
  _fbUpdateStatus();

  try {
    // Sanitize supplier names before save to prevent PUT 400 Bad Request
    window.cleanSupplierNamesBeforeSave();

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
      useSraws: typeof window.useSraws !== 'undefined' ? window.useSraws : true,
      spScannerAliases: window.spScannerAliases || {},
      spScannerFolderLinks: window.spScannerFolderLinks || {},
      todos: window.todo ? window.todo.items : []
    };

    // Increment Sequence
    const newSeq = _localSeq + 1;
    const payload = { data: liveData, ts: Date.now(), seq: newSeq, version: '3.0' };

    let tok = await window._fbUser?.getIdToken(false);
    const url = getFirebaseDbUrl() + (tok ? '?auth=' + tok : '');

    // Quick check: has the cloud advanced while we were asleep?
    if (window._fbSyncReady && _localSeq > 0) {
      try {
        const seqUrl = getFirebaseDbUrl().replace('.json', '/seq.json') + (tok ? '?auth=' + tok : '');
        const seqRes = await fetch(seqUrl + (seqUrl.includes('?') ? '&' : '?') + 'cb=' + Date.now());
        if (seqRes.ok) {
          const cloudSeq = await seqRes.json();
          if (cloudSeq > _localSeq && !force) {
            console.warn(`[Sync] BLOCKED: Dirty Write Detected. Local: ${_localSeq}, Cloud: ${cloudSeq}`);
            _fbSyncing = false;
            _isLocked = false;
            await window.spAlert("\u26A0\uFE0F \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA \u05D6\u05D9\u05D4\u05EA\u05D4 \u05E9\u05D1\u05D5\u05E6\u05E2 \u05E9\u05D9\u05E0\u05D5\u05D9 \u05DE\u05DE\u05DB\u05E9\u05D9\u05E8 \u05D0\u05D7\u05E8!\n\u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05D4\u05D7\u05D3\u05E9\u05D9\u05DD \u05E0\u05D8\u05E2\u05E0\u05D9\u05DD \u05DB\u05E2\u05EA \u05DB\u05D3\u05D9 \u05DC\u05DE\u05E0\u05D5\u05E2 \u05DE\u05D7\u05D9\u05E7\u05EA \u05DE\u05D9\u05D3\u05E2 \u05D7\u05E9\u05D5\u05D1.\n\n\u05D0\u05E0\u05D0 \u05D4\u05DE\u05EA\u05DF \u05E9\u05E0\u05D9\u05D9\u05D4 \u05D5\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1 \u05D0\u05EA \u05D4\u05E4\u05E2\u05D5\u05DC\u05D4 \u05E9\u05E2\u05E9\u05D9\u05EA.");
            loadFromFirebase(true); // Force load
            return false;
          }
        }
      } catch(e) { console.warn('[Sync] Failed to verify sequence before save:', e); }
    }

    // CRITICAL: Use PATCH instead of PUT to prevent deleting sibling paths under /data (like invoices)
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!r.ok) throw new Error('HTTP ' + r.status);

    // Save Invoices Separately ג€” always save if we have invoice data (no _fbSyncReady gate)
    if (Array.isArray(window.INVOICES) && window.INVOICES.length > 0) {
      const invUrl = getFirebaseInvoicesUrl() + (tok ? '?auth=' + tok : '');
      const invResp = await fetch(invUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(window.INVOICES) });
      if (!invResp.ok) {
        console.error('[Sync] ג Invoices save FAILED:', invResp.status, invResp.statusText);
        window.showToast?.('ג ן¸ ׳©׳’׳™׳׳” ׳‘׳©׳׳™׳¨׳× ׳—׳©׳‘׳•׳ ׳™׳•׳× ׳׳¢׳ ׳! (' + invResp.status + ')');
      } else {
        console.log('[Sync] Invoices saved:', window.INVOICES.length);
      }
    }

    _setSyncState(newSeq, Date.now(), null, false);
    console.log('[Sync] Saved v' + newSeq + ' (' + (liveData.ch?.length || 0) + ' records)');

    // Trigger daily backup automatically on first save of the day
    if (typeof window._runDailyBackupIfNeeded === 'function') {
      window._runDailyBackupIfNeeded(liveData, tok).catch(e => console.warn('Auto daily backup error:', e));
    }

    return true;
  } catch (e) {
    _setSyncState(null, null, e.message, false);
    console.error('[Sync] Save failed:', e.message);
    return false;
  } finally {
    _fbSyncing = false;
    _isLocked = false;
    _fbUpdateStatus();
  }
}

async function loadFromFirebase(silent = false, force = false) {
  // CRITICAL: Never load from Firebase during an import ג€” it would overwrite the imported data
  if (window._importInProgress) {
    console.warn('[Sync] Load blocked ג€” import in progress');
    return true;
  }
  if (_isLocked && !force) return false;
  _fbSyncing = true;
  _fbUpdateStatus();

  try {
    let tok = await window._fbUser?.getIdToken(false);
    const url = getFirebaseDbUrl() + (tok ? '?auth=' + tok : '');

    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'cb=' + Date.now());
    if (!r.ok) throw new Error('HTTP ' + r.status);

    const cloud = await r.json();
    if (!cloud || !cloud.seq) return true;

    if (!force && cloud.seq <= _localSeq && window._fbSyncReady) {
      _setSyncState(cloud.seq, Date.now(), null, true);
      return true;
    }

    // Load Invoices Separately ג€” merge file links from local copy to avoid losing them
    const invUrl = getFirebaseInvoicesUrl() + (tok ? '?auth=' + tok : '');
    const ir = await fetch(invUrl);
    if (!ir.ok) throw new Error('Invoices HTTP ' + ir.status);
    const invs = await ir.json();
    let cloudInvs = Array.isArray(invs) ? invs : Object.values(invs || {});

    // Merge: preserve local file links (file_order, file_tx, file_tax) that may not be in cloud yet
    if (Array.isArray(window.INVOICES) && window.INVOICES.length > 0) {
      const localById = {};
      window.INVOICES.forEach(inv => { if (inv.id) localById[inv.id] = inv; });
      cloudInvs = cloudInvs.map(ci => {
        const local = localById[ci.id];
        if (!local) return ci;
        // Preserve file links from local if cloud doesn't have them
        ['file_order', 'file_tx', 'file_tax'].forEach(fk => {
          if (local[fk] && local[fk].path && (!ci[fk] || !ci[fk].path)) {
            ci[fk] = local[fk];
          }
        });
        return ci;
      });
    }
    cloud.data.invoices = cloudInvs;

    window._fbAppData = cloud.data;

    // Restore scanner metadata
    window.spScannerAliases = cloud.data.spScannerAliases || {};
    window.spScannerFolderLinks = cloud.data.spScannerFolderLinks || {};

    if (window._applyYearData) {
      window._applyYearData(cloud.data);
    }
    
    // Sync todos from cloud if available
    if (cloud.data.todos && window.todo) {
      window.todo.items = cloud.data.todos;
      window.todo.render();
    }

    _setSyncState(cloud.seq, Date.now(), null, true);
    
    // Auto-refresh view after loading from cloud
    // Ensure we don't interrupt the user if they have a modal open
    if (!window._fbSyncReady || !document.querySelector('.sp-modal-content, .modal.open, .sp-popup')) {
       if (typeof window.refresh === 'function') {
         setTimeout(() => window.refresh(), 100);
       }
    }
    
    window._fbSyncReady = true;
    return true;
  } catch (e) {
    _setSyncState(null, null, e.message, true);
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

// ג”€ג”€ PUBLIC API ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
// CRITICAL: ghAutoSave is called by core.js save() to push data to Firebase.
// Without this alias, Firebase never gets updated!
window.ghAutoSave = saveToFirebase;
window.save = saveToFirebase;
window.load = loadFromFirebase;
window.saveToFirebase = saveToFirebase;
window.loadFromFirebase = loadFromFirebase;
window._fbStartPolling = _fbStartPolling;
window._fbStopPolling = _fbStopPolling;

// Sync immediately when app comes to foreground (Crucial for Mobile/PWAs)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && window._fbSyncReady && !window._importInProgress) {
    console.log('[Sync] App became visible, checking Firebase...');
    loadFromFirebase(true);
  }
});

window._onAuthReady = async function () {
  // Sync years/periods metadata first
  try {
    let tok = await window._fbUser?.getIdToken(false);
    const base = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';
    const r = await fetch(`${base}/years_meta.json${tok ? '?auth=' + tok : ''}`);
    if (r.ok) {
      const cloudMeta = await r.json();
      if (cloudMeta && cloudMeta.years) {
        const localMetaStr = window._safeLS.getItem('ganv5_meta');
        let localMeta = localMetaStr ? JSON.parse(localMetaStr) : { currentYear: 'tashpav', years: {} };
        // Merge cloud years into local
        localMeta.years = { ...localMeta.years, ...cloudMeta.years };
        if (cloudMeta.currentYear && !localMeta.years[localMeta.currentYear]) {
          localMeta.currentYear = cloudMeta.currentYear;
        }
        window._safeLS.setItem('ganv5_meta', JSON.stringify(localMeta));
        if (window.initYearSelector) window.initYearSelector();
      }
    }
  } catch (e) {
    console.warn('Failed to load years metadata from Firebase:', e);
  }

  await loadFromFirebase();
  _fbStartPolling();
};
