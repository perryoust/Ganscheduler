// ══════════════════════════════════════════════
// Firebase Realtime Database Sync - v4.0 (Split Architecture)
// ══════════════════════════════════════════════
const FB_ROOT = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';

// Returns the root URL (without .json) for the current year context
function getFirebaseRootUrl() {
  if (window.CURRENT_YEAR && window.CURRENT_YEAR !== 'tashpav') {
    return `${FB_ROOT}/years/${window.CURRENT_YEAR}`;
  }
  return FB_ROOT;
}

// ── Split-path URL helpers (v4.0) ───────────────
function getFirebaseSchedulesUrl() { return `${getFirebaseRootUrl()}/schedules.json`; }
function getFirebaseSuppliersUrl() { return `${getFirebaseRootUrl()}/suppliers.json`; }
function getFirebaseConfigUrl()    { return `${getFirebaseRootUrl()}/config.json`; }
function getFirebaseMetaUrl()      { return `${getFirebaseRootUrl()}/meta.json`; }
function getFirebaseSeqUrl()       { return `${getFirebaseRootUrl()}/meta/seq.json`; }

// ── Legacy URL helpers (kept for backward compat) ─
function getFirebaseDbUrl() {
  if (window.CURRENT_YEAR && window.CURRENT_YEAR !== 'tashpav') {
    return `${FB_ROOT}/years/${window.CURRENT_YEAR}/data.json`;
  }
  return `${FB_ROOT}/data.json`;
}
function getFirebaseInvoicesUrl()   { return `${FB_ROOT}/invoices.json`; }
function getFirebaseOrdersUrl()     { return `${FB_ROOT}/orders.json`; }
function getFirebaseDeliveriesUrl() { return `${FB_ROOT}/deliveries.json`; }

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
window.mergeWorkerTasksLocally = function (cloudData) {
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

window.saveWorkerTasksToFirebase = async function (skipMerge = false) {
  try {
    let tok = await window._fbUser?.getIdToken(false);
    if (!tok) return;
    const url = `${FB_ROOT}/data/global_worker_tasks.json?auth=${tok}`;

    if (!skipMerge) {
      try {
        const getRes = await fetch(url + '&cb=' + Date.now());
        if (getRes.ok) {
          const cloudData = await getRes.json();
          window.mergeWorkerTasksLocally(cloudData);
        }
      } catch (e) {
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

    // ── Build split data payloads ──────────────────
    const schedulesData = window.SCH || [];
    const suppliersData = window.supEx || {};
    const configData = {
      pairs: window.pairs || [],
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
    const metaData = { seq: newSeq, ts: Date.now(), version: '4.0' };

    let tok = await window._fbUser?.getIdToken(false);
    const authQ = tok ? '?auth=' + tok : '';

    // Quick check: has the cloud advanced while we were asleep?
    if (window._fbSyncReady && _localSeq > 0) {
      try {
        const seqUrl = getFirebaseSeqUrl() + authQ + (authQ ? '&' : '?') + 'cb=' + Date.now();
        const seqRes = await fetch(seqUrl);
        if (seqRes.ok) {
          const cloudSeq = await seqRes.json();
          if (cloudSeq > _localSeq && !force) {
            console.warn(`[Sync] BLOCKED: Dirty Write Detected. Local: ${_localSeq}, Cloud: ${cloudSeq}`);
            _fbSyncing = false;
            _isLocked = false;

            const userWantsToReload = confirm(
              "⚠️ המערכת זיהתה שבוצע שינוי בענן על ידי משתמש אחר!\n\n" +
              "האם תרצה למשוך את הנתונים החדשים מהענן, או לדרוס את הענן עם הנתונים שלך (השינויים של המשתמש השני יאבדו)?\n\n" +
              "[אישור / OK] = משוך נתונים מהענן (מומלץ, השינויים האחרונים שלך יאבדו)\n" +
              "[ביטול / Cancel] = אני רוצה לדרוס את הענן (Force Save)"
            );

            if (userWantsToReload) {
              loadFromFirebase(true);
              return false;
            } else {
              if (confirm("האם אתה בטוח שברצונך לדרוס את הנתונים בענן? פעולה זו תמחק את עבודתו של המשתמש השני!")) {
                console.warn("[Sync] User opted for FORCE SAVE.");
                return await saveToFirebase(silent, true);
              } else {
                return false;
              }
            }
          }
        }
      } catch (e) { console.warn('[Sync] Failed to verify sequence before save:', e); }
    }

    // ── Save split paths in parallel ──────────────
    const saves = [
      fetch(getFirebaseSchedulesUrl() + authQ, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedulesData)
      }),
      fetch(getFirebaseSuppliersUrl() + authQ, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suppliersData)
      }),
      fetch(getFirebaseConfigUrl() + authQ, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      }),
      fetch(getFirebaseMetaUrl() + authQ, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metaData)
      })
    ];
    const results = await Promise.all(saves);
    for (const r of results) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' on ' + r.url);
    }

    // Save Invoices Separately
    if (!window._invoicesKeyedMode && Array.isArray(window.INVOICES) && window.INVOICES.length > 0) {
      const invUrl = getFirebaseInvoicesUrl() + authQ;
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
      const ordUrl = getFirebaseOrdersUrl() + authQ;
      await fetch(ordUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(window.ORDERS) });
    }

    // Save Deliveries Separately
    if (Array.isArray(window.DELIVERIES) && window.DELIVERIES.length > 0) {
      const delUrl = getFirebaseDeliveriesUrl() + authQ;
      await fetch(delUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(window.DELIVERIES) });
    }

    _setSyncState(newSeq, Date.now(), null, false);
    console.log('[Sync] Saved v' + newSeq + ' (split: ' + schedulesData.length + ' schedules, ' + Object.keys(suppliersData).length + ' suppliers)');

    // Trigger daily backup automatically on first save of the day
    if (typeof window._runDailyBackupIfNeeded === 'function') {
      const liveData = { ch: schedulesData, ...configData, supEx: suppliersData };
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
  const isWorkerOnlyMode = window.role === 'worker' || (window.permWorker && !window.permPurch && !window.permAct && window.role !== 'admin');
  if (isWorkerOnlyMode) {
    console.log('[Sync] Worker mode detected. Skipping heavy db load.');
    _fbSyncing = false;
    try {
      let tok = await window._fbUser?.getIdToken(false);
      const wtUrl = FB_ROOT + '/data/global_worker_tasks.json' + (tok ? '?auth=' + tok : '');
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
    const authQ = tok ? '?auth=' + tok : '';
    const cb = '&cb=' + Date.now();

    // ── Step 1: Check meta/seq to see if we need to load ──
    let cloudMeta = null;
    try {
      const metaRes = await fetch(getFirebaseMetaUrl() + authQ + (authQ ? cb : '?cb=' + Date.now()));
      if (metaRes.ok) cloudMeta = await metaRes.json();
    } catch (e) { console.warn('[Sync] Meta fetch failed:', e); }

    // ── Step 2: If meta exists → new split architecture ──
    if (cloudMeta && cloudMeta.seq) {
      // Skip if already up-to-date
      if (!force && cloudMeta.seq <= _localSeq && window._fbSyncReady) {
        _setSyncState(cloudMeta.seq, Date.now(), null, true);
        if (cloudMeta.ts) window._fbLastSaveTs = cloudMeta.ts;
        return true;
      }

      // Load split data in parallel
      console.log('[Sync] Loading split data (v4.0)...');
      const [schRes, supRes, cfgRes] = await Promise.all([
        fetch(getFirebaseSchedulesUrl() + authQ + (authQ ? cb : '?cb=' + Date.now())),
        fetch(getFirebaseSuppliersUrl() + authQ + (authQ ? cb : '?cb=' + Date.now())),
        fetch(getFirebaseConfigUrl() + authQ + (authQ ? cb : '?cb=' + Date.now()))
      ]);

      let cloudSchedules = schRes.ok ? await schRes.json() : null;
      let cloudSuppliers = supRes.ok ? await supRes.json() : null;
      let cloudConfig = cfgRes.ok ? await cfgRes.json() : null;

      // Normalize arrays (Firebase converts sparse arrays to objects)
      if (cloudSchedules && !Array.isArray(cloudSchedules)) {
        cloudSchedules = Object.values(cloudSchedules);
      }

      // Reconstruct the unified data object that _applyYearData expects
      const data = {
        ch: cloudSchedules || [],
        supEx: cloudSuppliers || {},
        ...(cloudConfig || {})
      };

      // Load Worker Tasks separately
      await _loadWorkerTasks(tok, data);

      // Set app data
      window._fbAppData = data;
      window.spScannerAliases = data.spScannerAliases || {};
      window.spScannerFolderLinks = data.spScannerFolderLinks || {};
      window.PURCH_NOTES = data.purchNotes || null;
      window.PURCH_ORDERERS = data.purchOrderers || null;
      window.PURCH_FOOTER = data.purchFooter || null;

      if (window._applyYearData) window._applyYearData(data);

      // Sync todos
      if (data.todos && window.todo) {
        window.todo.items = data.todos;
        if (window._safeLS) window._safeLS.setItem('ganv5_todos', JSON.stringify(data.todos));
        window.todo.render();
      }

      _setSyncState(cloudMeta.seq, Date.now(), null, true);
      if (cloudMeta.ts) window._fbLastSaveTs = cloudMeta.ts;

      console.log('[Sync] Loaded v' + cloudMeta.seq + ' (split: ' + (cloudSchedules?.length || 0) + ' schedules)');

    } else {
      // ── Step 3: Fallback to old monolithic data.json (pre-v4.0) ──
      console.log('[Sync] No split meta found, trying legacy data.json...');
      const url = getFirebaseDbUrl() + authQ + (authQ ? cb : '?cb=' + Date.now());
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);

      const cloud = await r.json();
      if (!cloud || !cloud.seq) return true;

      if (!force && cloud.seq <= _localSeq && window._fbSyncReady) {
        _setSyncState(cloud.seq, Date.now(), null, true);
        if (cloud.ts) window._fbLastSaveTs = cloud.ts;
        return true;
      }

      // Load Worker Tasks
      await _loadWorkerTasks(tok, cloud.data || {});

      // Legacy invoice/order/delivery migration (move out of data blob)
      if (cloud.data && cloud.data.invoices) {
        console.log('[Migration] Moving invoices to root...');
        await fetch(getFirebaseInvoicesUrl() + authQ, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cloud.data.invoices) });
        await fetch(FB_ROOT + '/data/invoices.json' + authQ, { method: 'DELETE' });
        delete cloud.data.invoices;
      }
      if (cloud.data && cloud.data.orders) {
        console.log('[Migration] Moving orders to root...');
        await fetch(getFirebaseOrdersUrl() + authQ, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cloud.data.orders) });
        await fetch(FB_ROOT + '/data/orders.json' + authQ, { method: 'DELETE' });
        delete cloud.data.orders;
      }
      if (cloud.data && cloud.data.deliveries) {
        console.log('[Migration] Moving deliveries to root...');
        await fetch(getFirebaseDeliveriesUrl() + authQ, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cloud.data.deliveries) });
        await fetch(FB_ROOT + '/data/deliveries.json' + authQ, { method: 'DELETE' });
        delete cloud.data.deliveries;
      }

      window._fbAppData = cloud.data;
      window.spScannerAliases = cloud.data.spScannerAliases || {};
      window.spScannerFolderLinks = cloud.data.spScannerFolderLinks || {};
      window.PURCH_NOTES = cloud.data.purchNotes || null;
      window.PURCH_ORDERERS = cloud.data.purchOrderers || null;
      window.PURCH_FOOTER = cloud.data.purchFooter || null;

      if (window._applyYearData) window._applyYearData(cloud.data);

      if (cloud.data.todos && window.todo) {
        window.todo.items = cloud.data.todos;
        if (window._safeLS) window._safeLS.setItem('ganv5_todos', JSON.stringify(cloud.data.todos));
        window.todo.render();
      }

      _setSyncState(cloud.seq, Date.now(), null, true);
      if (cloud.ts) window._fbLastSaveTs = cloud.ts;

      // ── AUTO MIGRATION: Split old blob into new paths ──
      console.log('[Migration] Migrating monolithic data.json → split architecture...');
      try {
        const schData = cloud.data.ch || [];
        const supData = cloud.data.supEx || {};
        const cfgData = {};
        // Copy all config fields except ch, supEx, workerTasks (already split)
        for (const key of Object.keys(cloud.data)) {
          if (!['ch', 'supEx', 'workerTasks', 'invoices', 'orders', 'deliveries', 'spScannerAliases', 'spScannerFolderLinks'].includes(key)) {
            cfgData[key] = cloud.data[key];
          }
        }
        // Include scanner data in config
        cfgData.spScannerAliases = cloud.data.spScannerAliases || {};
        cfgData.spScannerFolderLinks = cloud.data.spScannerFolderLinks || {};

        const metaPayload = { seq: cloud.seq, ts: cloud.ts || Date.now(), version: '4.0' };

        await Promise.all([
          fetch(getFirebaseSchedulesUrl() + authQ, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(schData) }),
          fetch(getFirebaseSuppliersUrl() + authQ, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(supData) }),
          fetch(getFirebaseConfigUrl() + authQ, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfgData) }),
          fetch(getFirebaseMetaUrl() + authQ, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metaPayload) })
        ]);

        // Delete the old monolithic blob (but keep sibling paths like global_worker_tasks under /data/)
        await fetch(FB_ROOT + '/data/data.json' + authQ, { method: 'DELETE' });
        // Clean old seq/ts/version from /data/ root
        await Promise.all([
          fetch(FB_ROOT + '/data/seq.json' + authQ, { method: 'DELETE' }),
          fetch(FB_ROOT + '/data/ts.json' + authQ, { method: 'DELETE' }),
          fetch(FB_ROOT + '/data/version.json' + authQ, { method: 'DELETE' })
        ]);
        console.log('[Migration] ✅ Successfully migrated to split architecture!');
      } catch (migErr) {
        console.error('[Migration] ❌ Migration failed (will retry next load):', migErr);
      }
    }

    // Auto-refresh view after loading from cloud
    if (!window._fbSyncReady || !document.querySelector('.sp-modal-content, .modal.open, .sp-popup')) {
      if (typeof window.refresh === 'function') setTimeout(() => window.refresh(), 100);
      if (typeof window.renderCoordinatorView === 'function') setTimeout(() => window.renderCoordinatorView(), 100);
    }

    window._fbSyncReady = true;

    // Silent Daily Auto-Backup to Google Drive for Managers/Admins
    try {
      if (window.role !== 'worker' && typeof window.backupToGoogleDrive === 'function') {
        const today = new Date().toDateString();
        const lastBackup = window._safeLS.getItem('lastGDriveBackupDate');
        if (lastBackup !== today) {
          console.log('[AutoBackup] Triggering daily silent backup to Google Drive...');
          window._safeLS.setItem('lastGDriveBackupDate', today);
          setTimeout(() => window.backupToGoogleDrive(true), 3000);
        }
      }
    } catch (e) { console.warn('[AutoBackup] Failed to trigger auto backup:', e); }

    return true;
  } catch (e) {
    _setSyncState(null, null, e.message, true);
    return false;
  } finally {
    _fbSyncing = false;
    _fbUpdateStatus();
  }
}

// ── Helper: Load worker tasks from dedicated path ──
async function _loadWorkerTasks(tok, data) {
  try {
    const authQ = tok ? '?auth=' + tok : '';
    const wtUrl = FB_ROOT + '/data/global_worker_tasks.json' + authQ + (authQ ? '&' : '?') + 'cb=' + Date.now();
    const wtRes = await fetch(wtUrl);
    if (wtRes.ok) {
      const wtData = await wtRes.json();
      if (wtData) {
        if (!window.WORKER_TASKS || window.WORKER_TASKS.length === 0) {
          window.WORKER_TASKS = (Array.isArray(wtData) ? wtData : Object.values(wtData || {})).filter(Boolean);
        } else {
          window.mergeWorkerTasksLocally(wtData);
        }
      } else if (data && data.workerTasks && data.workerTasks.length > 0) {
        window.WORKER_TASKS = data.workerTasks;
        if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase();
      } else {
        try {
          let recovered = false;
          const keys = [];
          for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
          keys.sort().reverse();
          for (const k of keys) {
            if (k && k.startsWith('ganv5_backup_')) {
              const bkObj = JSON.parse(localStorage.getItem(k));
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
        } catch (e) { window.WORKER_TASKS = []; }
      }
      if (data && data.workerTasks) delete data.workerTasks;
    }
  } catch (e) { console.warn('Failed to load global worker tasks', e); }
}


function _fbStartPolling() {
  if (_syncTimer) clearInterval(_syncTimer);
  _syncTimer = setInterval(async () => {
    // DO NOT SYNC IF A MODAL IS OPEN (prevents UI resets/re-renders while user is typing)
    if (document.querySelector('.modal.open, .sp-popup, .sp-modal-content')) return;
    const orderModal = document.getElementById('order-modal');
    if (orderModal && orderModal.style.display !== 'none' && orderModal.style.display !== '') return;
    if (_fbSyncing || _isLocked || window._importInProgress) return;

    // ── Smart Polling: Check only seq, not the full database ──
    try {
      let tok = window._cachedToken || null;
      if (window._fbUser) {
        try { tok = await window._fbUser.getIdToken(false); } catch(e) {}
      }
      const authQ = tok ? '?auth=' + tok : '';
      const seqUrl = getFirebaseSeqUrl() + authQ + (authQ ? '&' : '?') + 'cb=' + Date.now();
      const seqRes = await fetch(seqUrl);
      if (!seqRes.ok) return;
      const cloudSeq = await seqRes.json();

      if (cloudSeq && cloudSeq > _localSeq) {
        console.log(`[Sync] Polling detected change: local=${_localSeq}, cloud=${cloudSeq}`);
        loadFromFirebase(true);
      }
    } catch (e) {
      // Fallback: if seq check fails, try full load
      console.warn('[Sync] Smart poll failed, falling back to full load:', e.message);
      loadFromFirebase(true);
    }
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
window.getFirebaseDbUrl = getFirebaseDbUrl;
window.getFirebaseRootUrl = getFirebaseRootUrl;

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
window.loadPurchasingDataFromFirebase = async function (forceReload) {
  if (window._purchasingDataLoaded && !forceReload) return;

  let tok = window._cachedToken || null;
  if (window._fbUser) {
    try { tok = await window._fbUser.getIdToken(); }
    catch (e) { console.warn('Failed to get token for purchasing data', e); }
  }

  if (!tok) {
    console.warn('[Purchasing] No auth token available — will retry on next switchMode');
    return;
  }

  const invUrl = `${FB_ROOT}/invoices.json?auth=${tok}&orderBy="$key"&limitToLast=150&cb=${Date.now()}`;
  window._invoicesPartialLoad = true;
  const ordUrl = getFirebaseOrdersUrl() + '?auth=' + tok + '&cb=' + Date.now();
  const delUrl = getFirebaseDeliveriesUrl() + '?auth=' + tok + '&cb=' + Date.now();

  let anySuccess = false;
  try {
    const [ir, or, dr] = await Promise.all([
      fetch(invUrl).catch(() => ({ ok: false })),
      fetch(ordUrl).catch(() => ({ ok: false })),
      fetch(delUrl).catch(() => ({ ok: false }))
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
      anySuccess = true;
      
      // One-time migration to keyed format
      if (!window._invoicesMigrated) {
        window._invoicesMigrated = true;
        window._migrateInvoicesToKeyed?.();
      }
    }

    if (or.ok) {
      let cloudOrd = await or.json();
      window.ORDERS = Array.isArray(cloudOrd) ? cloudOrd : Object.values(cloudOrd || {});
      anySuccess = true;
      console.log('[Purchasing] Orders loaded:', window.ORDERS.length);
    } else {
      console.warn('[Purchasing] Failed to load orders — response not OK');
    }

    if (dr.ok) {
      let cloudDel = await dr.json();
      window.DELIVERIES = Array.isArray(cloudDel) ? cloudDel : Object.values(cloudDel || {});
      anySuccess = true;
    }

    // Only mark as loaded if at least one endpoint succeeded (network is working)
    if (anySuccess) {
      window._purchasingDataLoaded = true;
      console.log('[Purchasing] Data loaded successfully from root nodes');
    } else {
      console.warn('[Purchasing] All fetches failed — will retry on next attempt');
    }
  } catch (e) {
    console.error('Failed to lazy load purchasing data', e);
    // Do NOT set _purchasingDataLoaded = true on error, so it retries
  }
};

// One-time migration: convert /invoices from array to keyed object
window._migrateInvoicesToKeyed = async function() {
  const tok = await window._fbUser?.getIdToken(false);
  if (!tok) return;
  const url = getFirebaseInvoicesUrl() + '?auth=' + tok + '&cb=' + Date.now();
  const r = await fetch(url);
  if (!r.ok) return;
  const data = await r.json();
  if (!data) return;
  
  // Check if already keyed (first key is NOT a number)
  const keys = Object.keys(data);
  if (keys.length > 0 && isNaN(keys[0])) {
    console.log('[Migration] Invoices already keyed. Skipping.');
    return;
  }
  
  // Convert array to keyed object
  const keyed = {};
  const arr = Array.isArray(data) ? data : Object.values(data);
  arr.forEach(inv => {
    if (inv && inv.id) keyed[inv.id] = inv;
  });
  
  // Write back as keyed object
  const putUrl = getFirebaseInvoicesUrl() + '?auth=' + tok;
  const resp = await fetch(putUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(keyed)
  });
  
  if (resp.ok) {
    console.log('[Migration] ✅ Invoices migrated to keyed format:', Object.keys(keyed).length, 'records');
  } else {
    console.error('[Migration] ❌ Failed to migrate invoices');
  }
};

// Save a single invoice to Firebase (keyed by id)
window.saveInvoiceToFirebase = async function(inv) {
  if (!inv || !inv.id) return false;
  const tok = await window._fbUser?.getIdToken(false);
  if (!tok) return false;
  const url = `${FB_ROOT}/invoices/${inv.id}.json?auth=${tok}`;
  try {
    const r = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inv)
    });
    if (r.ok) console.log('[Sync] Invoice saved:', inv.id);
    return r.ok;
  } catch (e) {
    console.error('[Sync] Failed to save invoice:', e);
    return false;
  }
};

// Delete a single invoice from Firebase
window.deleteInvoiceFromFirebase = async function(invId) {
  const tok = await window._fbUser?.getIdToken(false);
  if (!tok) return false;
  const url = `${FB_ROOT}/invoices/${invId}.json?auth=${tok}`;
  try {
    const r = await fetch(url, { method: 'DELETE' });
    return r.ok;
  } catch (e) {
    console.error('[Sync] Failed to delete invoice:', e);
    return false;
  }
};

// Load recent invoices (last N by key, which is the id/timestamp)
window.loadRecentInvoices = async function(limit = 150) {
  const tok = await window._fbUser?.getIdToken(false);
  if (!tok) return [];
  const url = `${FB_ROOT}/invoices.json?auth=${tok}&orderBy="$key"&limitToLast=${limit}&cb=${Date.now()}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    return data ? Object.values(data) : [];
  } catch (e) {
    console.error('[Sync] Failed to load recent invoices:', e);
    return [];
  }
};

// Load ALL invoices (for scanner/export only)
window.loadAllInvoices = async function() {
  const tok = await window._fbUser?.getIdToken(false);
  if (!tok) return [];
  const url = getFirebaseInvoicesUrl() + '?auth=' + tok + '&cb=' + Date.now();
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    return data ? Object.values(data) : [];
  } catch (e) {
    console.error('[Sync] Failed to load all invoices:', e);
    return [];
  }
};
