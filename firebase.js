// ══════════════════════════════════════════════
// Firebase Realtime Database Sync - v3.0 (Robust)
// ══════════════════════════════════════════════
function getFirebaseDbUrl() {
  const base = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';
  if (window.CURRENT_YEAR && window.CURRENT_YEAR !== 'tashpav') {
    return `${base}/years/${window.CURRENT_YEAR}/data.json`;
  }
  return `${base}/data.json`;
}

function getFirebaseInvoicesUrl() {
  const base = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';
  return `${base}/invoices.json`;
}
function getFirebaseOrdersUrl() {
  const base = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';
  return `${base}/orders.json`;
}
function getFirebaseDeliveriesUrl() {
  const base = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';
  return `${base}/deliveries.json`;
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

// ── State Update ─────────────────────────────
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
  if (!u || !p) { _spAlertDialog('נא למלא שם משתמש וסיסמה'); return; }

  // Worker Login — authenticate through Firebase Auth (real token needed for DB access)
  if (u === 'worker' && p === 'worker123') {
    try {
      const btn = document.getElementById('auth-login-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'מתחבר...'; }
      if (window._safeLS) window._safeLS.setItem('ganv5_auth_user', 'worker');
      // Sign in with real Firebase Auth — onAuthStateChanged in firebase_init.js
      // will detect worker role and activate worker app automatically
      await window._fbSignIn('worker', p, true);
    } catch (e) {
      // If the worker account doesn't exist yet, create it
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        try {
          await window._fbCreateUser('worker', p);
          // Now set the user's role to 'worker' in the database
          const tok = await window._fbGetToken();
          if (tok) {
            // We need the admin to set this, but for now just sign in
            console.log('[Worker] Created worker account, signing in...');
          }
          await window._fbSignIn('worker', p, true);
        } catch (e2) {
          console.error('[Worker] Failed to create/login worker:', e2);
          // Fallback: activate worker app without auth (limited functionality)
          document.getElementById('auth-overlay').style.display = 'none';
          if (typeof window.activateWorkerApp === 'function') {
            window.activateWorkerApp();
          }
        }
      } else {
        console.error('[Worker] Login failed:', e);
        document.getElementById('auth-overlay').style.display = 'none';
        if (typeof window.activateWorkerApp === 'function') {
          window.activateWorkerApp();
        }
      }
    }
    return;
  }


  try {
    const btn = document.getElementById('auth-login-btn');
    btn.disabled = true; btn.textContent = 'מתחבר...';
    await window._fbSignIn(u, p, document.getElementById('auth-remember').checked);
  } catch (e) {
    _spAlertDialog('שגיאת התחברות: ' + e.message);
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

// ── Core Sync Logic ──────────────────────────
window.mergeWorkerTasksLocally = function(cloudData) {
  if (!cloudData) return;
  const cloudTasks = (Array.isArray(cloudData) ? cloudData : Object.values(cloudData || {})).filter(Boolean);
  if (cloudTasks.length === 0) return;
  
  const localMap = {};
  (window.WORKER_TASKS || []).forEach(t => localMap[t.id] = t);
  
  let mergedTasks = [];
  cloudTasks.forEach(ct => {
    const merged = { ...ct };
    const t = localMap[ct.id];
    
    if (t) {
      // Worker clicked done locally but cloud still says pending
      if (t.status === 'done' && ct.status === 'pending') {
        merged.status = 'done';
        merged.doneAt = t.doneAt;
        merged.doneBy = t.doneBy;
      }
      
      // Worker typed a note locally that is longer/newer
      if (t.workerNote && !ct.workerNote) {
        merged.workerNote = t.workerNote;
      } else if (t.workerNote && ct.workerNote && t.workerNote.length > ct.workerNote.length) {
        merged.workerNote = t.workerNote;
      }
      
      if (t.workerName && !ct.workerName) merged.workerName = t.workerName;
      if (t.doneBy && !ct.doneBy) merged.doneBy = t.doneBy;
      
      delete localMap[ct.id];
    }
    
    mergedTasks.push(merged);
  });
  
  // Add any local tasks not in cloud (e.g. worker just added a free note and it hasn't synced)
  Object.values(localMap).forEach(t => {
    mergedTasks.push(t);
  });
  
  window.WORKER_TASKS = mergedTasks;
  if (window.renderWorkerTasksAdmin) window.renderWorkerTasksAdmin();
  if (window.renderWorkerTasksMobile) window.renderWorkerTasksMobile();
};

window.saveWorkerTasksToFirebase = async function(skipMerge = false) {
  try {
    let tok = await window._fbUser?.getIdToken(false);
    if (!tok) return;
    const base = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';
    const url = `${base}/data/global_worker_tasks.json?auth=${tok}`;
    
    if (!skipMerge) {
      try {
        const getRes = await fetch(url + '&cb=' + Date.now());
        if (getRes.ok) {
          const cloudData = await getRes.json();
          window.mergeWorkerTasksLocally(cloudData);
        }
      } catch(e) {
        console.warn('Merge fetch failed', e);
      }
    }

    const r = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify((window.WORKER_TASKS || []).filter(Boolean))
    });
    if (!r.ok) console.warn('[Sync] Failed to save worker tasks:', r.status);
    else console.log('[Sync] Worker tasks saved successfully');
  } catch (e) {
    console.error('[Sync] Error saving worker tasks', e);
  }
};


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
      purchNotes: window.PURCH_NOTES || null,
      purchOrderers: window.PURCH_ORDERERS || null,
      purchFooter: window.PURCH_FOOTER || null,
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
            await _spAlertDialog("\u26A0\uFE0F \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA \u05D6\u05D9\u05D4\u05EA\u05D4 \u05E9\u05D1\u05D5\u05E6\u05E2 \u05E9\u05D9\u05E0\u05D5\u05D9 \u05DE\u05DE\u05DB\u05E9\u05D9\u05E8 \u05D0\u05D7\u05E8!\n\u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05D4\u05D7\u05D3\u05E9\u05D9\u05DD \u05E0\u05D8\u05E2\u05E0\u05D9\u05DD \u05DB\u05E2\u05EA \u05DB\u05D3\u05D9 \u05DC\u05DE\u05E0\u05D5\u05E2 \u05DE\u05D7\u05D9\u05E7\u05EA \u05DE\u05D9\u05D3\u05E2 \u05D7\u05E9\u05D5\u05D1.\n\n\u05D0\u05E0\u05D0 \u05D4\u05DE\u05EA\u05DF \u05E9\u05E0\u05D9\u05D9\u05D4 \u05D5\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1 \u05D0\u05EA \u05D4\u05E4\u05E2\u05D5\u05DC\u05D4 \u05E9\u05E2\u05E9\u05D9\u05EA.");
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

    // Save Invoices Separately — always save if we have invoice data (no _fbSyncReady gate)
    if (Array.isArray(window.INVOICES) && window.INVOICES.length > 0) {
      const invUrl = getFirebaseInvoicesUrl() + (tok ? '?auth=' + tok : '');
      const invResp = await fetch(invUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(window.INVOICES) });
      if (!invResp.ok) {
        console.error('[Sync] ❌ Invoices save FAILED:', invResp.status, invResp.statusText);
        window.showToast?.('⚠️ שגיאה בשמירת חשבוניות לענן! (' + invResp.status + ')');
      } else {
        console.log('[Sync] Invoices saved:', window.INVOICES.length);
      }
    }
    
    // Save Orders Separately
    if (Array.isArray(window.ORDERS) && window.ORDERS.length > 0) {
      const ordUrl = getFirebaseOrdersUrl() + (tok ? '?auth=' + tok : '');
      await fetch(ordUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(window.ORDERS) });
    }
    
    // Save Deliveries Separately
    if (Array.isArray(window.DELIVERIES) && window.DELIVERIES.length > 0) {
      const delUrl = getFirebaseDeliveriesUrl() + (tok ? '?auth=' + tok : '');
      await fetch(delUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(window.DELIVERIES) });
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

  // Worker Optimization: If user is ONLY a worker, DO NOT fetch the heavy database.
  // Instead, just sync global worker tasks and finish!
  const isWorkerOnlyMode = window.role === 'worker' || (window.permWorker && !window.permPurch && !window.permAct && window.role !== 'admin');
  if (isWorkerOnlyMode) {
      console.log('[Sync] Worker mode detected. Skipping heavy db load.');
      _fbSyncing = false;
      try {
        let tok = await window._fbUser?.getIdToken(false);
        const wtUrl = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data/global_worker_tasks.json' + (tok ? '?auth=' + tok : '');
        const wtRes = await fetch(wtUrl + (wtUrl.includes('?') ? '&' : '?') + 'cb=' + Date.now());
        if (wtRes.ok) {
           const wtData = await wtRes.json();
           if (wtData && window.mergeWorkerTasksLocally) {
               window.mergeWorkerTasksLocally(wtData);
           }
        }
      } catch (e) {
        console.error('[Sync] Worker tasks fetch error:', e);
      }
      return true;
  }
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
    const url = getFirebaseDbUrl() + (tok ? '?auth=' + tok : '');

    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'cb=' + Date.now());
    if (!r.ok) throw new Error('HTTP ' + r.status);

    const cloud = await r.json();
    if (!cloud || !cloud.seq) return true;

    if (!force && cloud.seq <= _localSeq && window._fbSyncReady) {
      _setSyncState(cloud.seq, Date.now(), null, true);
      if (cloud.ts) window._fbLastSaveTs = cloud.ts;
      return true;
    }

    // Load Global Worker Tasks Separately
    try {
      const wtUrl = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data/global_worker_tasks.json' + (tok ? '?auth=' + tok : '');
      const wtRes = await fetch(wtUrl + (wtUrl.includes('?') ? '&' : '?') + 'cb=' + Date.now());
      if (wtRes.ok) {
        const wtData = await wtRes.json();
        if (wtData) {
            if (!window.WORKER_TASKS || window.WORKER_TASKS.length === 0) {
              window.WORKER_TASKS = (Array.isArray(wtData) ? wtData : Object.values(wtData || {})).filter(Boolean);
            } else {
              window.mergeWorkerTasksLocally(wtData);
            }
        } else if (cloud.data && cloud.data.workerTasks && cloud.data.workerTasks.length > 0) {
            window.WORKER_TASKS = cloud.data.workerTasks;
            if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase();
        } else {
            try {
              let recovered = false;
              const keys = [];
              for(let i=0; i<localStorage.length; i++) keys.push(localStorage.key(i));
              keys.sort().reverse(); // Newest first
              for(const k of keys) {
                if (k && k.startsWith('ganv5_backup_')) {
                  const bkStr = localStorage.getItem(k);
                  const bkObj = JSON.parse(bkStr);
                  if (bkObj && bkObj.workerTasks && bkObj.workerTasks.length > 0) {
                    window.WORKER_TASKS = bkObj.workerTasks;
                    if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase();
                    recovered = true;
                    console.log('[Recovery] Restored worker tasks from local backup ' + k);
                    break;
                  }
                }
              }
              if (!recovered) window.WORKER_TASKS = [];
            } catch(e) { window.WORKER_TASKS = []; }
        }
        if (cloud.data && cloud.data.workerTasks) delete cloud.data.workerTasks; // Prevent overwrite from mega-blob
      }
    } catch(e) { console.warn('Failed to load global worker tasks', e); }

    // --- AUTO MIGRATION: Flatten Database Structure ---
    if (cloud.data && cloud.data.invoices) {
      console.log('[Migration] Moving invoices to root...');
      const invUrl = getFirebaseInvoicesUrl() + (tok ? '?auth=' + tok : '');
      await fetch(invUrl, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(cloud.data.invoices) });
      const oldUrl = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data/invoices.json' + (tok ? '?auth=' + tok : '');
      await fetch(oldUrl, { method: 'DELETE' });
      delete cloud.data.invoices; // Remove from memory to save space
    }
    if (cloud.data && cloud.data.orders) {
      console.log('[Migration] Moving orders to root...');
      const ordUrl = getFirebaseOrdersUrl() + (tok ? '?auth=' + tok : '');
      await fetch(ordUrl, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(cloud.data.orders) });
      const oldUrl = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data/orders.json' + (tok ? '?auth=' + tok : '');
      await fetch(oldUrl, { method: 'DELETE' });
      delete cloud.data.orders;
    }
    if (cloud.data && cloud.data.deliveries) {
      console.log('[Migration] Moving deliveries to root...');
      const delUrl = getFirebaseDeliveriesUrl() + (tok ? '?auth=' + tok : '');
      await fetch(delUrl, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(cloud.data.deliveries) });
      const oldUrl = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data/deliveries.json' + (tok ? '?auth=' + tok : '');
      await fetch(oldUrl, { method: 'DELETE' });
      delete cloud.data.deliveries;
    }
    // --------------------------------------------------

    window._fbAppData = cloud.data;

    // Restore scanner metadata
    window.spScannerAliases = cloud.data.spScannerAliases || {};
    window.spScannerFolderLinks = cloud.data.spScannerFolderLinks || {};
    window.PURCH_NOTES = cloud.data.purchNotes || null;
    window.PURCH_ORDERERS = cloud.data.purchOrderers || null;
    window.PURCH_FOOTER = cloud.data.purchFooter || null;

    if (window._applyYearData) {
      window._applyYearData(cloud.data);
    }
    
    // Sync todos from cloud if available
    if (cloud.data.todos && window.todo) {
      window.todo.items = cloud.data.todos;
      if (window._safeLS) window._safeLS.setItem('ganv5_todos', JSON.stringify(cloud.data.todos));
      window.todo.render();
    }
    
    // NOTE: workerTasks are loaded from /data/global_worker_tasks.json (lines 405-443)
    // Do NOT overwrite from cloud.data.workerTasks — that path is stale and causes sync conflicts

    _setSyncState(cloud.seq, Date.now(), null, true);
    if (cloud.ts) window._fbLastSaveTs = cloud.ts;
    
    // Auto-refresh view after loading from cloud
    // Ensure we don't interrupt the user if they have a modal open
    if (!window._fbSyncReady || !document.querySelector('.sp-modal-content, .modal.open, .sp-popup')) {
       if (typeof window.refresh === 'function') {
         setTimeout(() => window.refresh(), 100);
       }
       if (typeof window.renderCoordinatorView === 'function') {
         setTimeout(() => window.renderCoordinatorView(), 100);
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
  _syncTimer = setInterval(() => {
    // DO NOT SYNC IF A MODAL IS OPEN (prevents UI resets/re-renders while user is typing)
    if (document.querySelector('.modal.open, .sp-popup, .sp-modal-content')) return;
    const orderModal = document.getElementById('order-modal');
    if (orderModal && orderModal.style.display !== 'none' && orderModal.style.display !== '') return;
    
    loadFromFirebase(true);
  }, FIREBASE_POLL_INTERVAL);
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

// Sync immediately when app comes to foreground (Crucial for Mobile/PWAs)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && window._fbSyncReady && !window._importInProgress) {
    console.log('[Sync] App became visible, checking Firebase...');
    loadFromFirebase(true);
  }
});

// _onAuthReady is defined in core_app.js — do NOT redefine here.
// Just ensure loadFromFirebase and polling are accessible via window.
// core_app.js calls loadFromFirebase() and _fbStartPolling() after years_meta sync.

// --- Lazy Load Purchasing Data ---
window.loadPurchasingDataFromFirebase = async function() {
  if (window._purchasingDataLoaded) return;
  
  let tok = window._cachedToken || null;
  if (window._fbUser) {
    try { tok = await window._fbUser.getIdToken(); }
    catch(e) { console.warn('Failed to get token for purchasing data', e); }
  }
  
  if (!tok) return;

  const invUrl = getFirebaseInvoicesUrl() + '?auth=' + tok + '&cb=' + Date.now();
  const ordUrl = getFirebaseOrdersUrl() + '?auth=' + tok + '&cb=' + Date.now();
  const delUrl = getFirebaseDeliveriesUrl() + '?auth=' + tok + '&cb=' + Date.now();

  try {
    const [ir, or, dr] = await Promise.all([
      fetch(invUrl).catch(() => ({ok: false})),
      fetch(ordUrl).catch(() => ({ok: false})),
      fetch(delUrl).catch(() => ({ok: false}))
    ]);

    if (ir.ok) {
      let cloudInvs = await ir.json();
      cloudInvs = Array.isArray(cloudInvs) ? cloudInvs : Object.values(cloudInvs || {});
      if (Array.isArray(window.INVOICES) && window.INVOICES.length > 0) {
        const localById = {};
        window.INVOICES.forEach(inv => { if (inv.id) localById[inv.id] = inv; });
        cloudInvs = cloudInvs.map(ci => {
          const local = localById[ci.id];
          if (!local) return ci;
          ['file_order', 'file_tx', 'file_tax'].forEach(fk => {
            if (local[fk] && local[fk].path && (!ci[fk] || !ci[fk].path)) {
              ci[fk] = local[fk];
            }
          });
          return ci;
        });
      }
      window.INVOICES = cloudInvs;
    }

    if (or.ok) {
      let cloudOrd = await or.json();
      window.ORDERS = Array.isArray(cloudOrd) ? cloudOrd : Object.values(cloudOrd || {});
    }

    if (dr.ok) {
      let cloudDel = await dr.json();
      window.DELIVERIES = Array.isArray(cloudDel) ? cloudDel : Object.values(cloudDel || {});
    }

    window._purchasingDataLoaded = true;
    console.log('[Purchasing] Data loaded successfully from root nodes');
  } catch(e) {
    console.error('Failed to lazy load purchasing data', e);
  }
};

