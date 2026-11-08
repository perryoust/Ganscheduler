if (!window.APP_VERSION) window.APP_VERSION = 'unknown'; // Single source of truth: index.html
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
// ── Data Lookup Helpers ──
window.getSchById = function(id) {
  if (!id) return null;
  const sId = String(id);
  let ev = window._idxSchById ? window._idxSchById.get(sId) : null;
  if (!ev) {
    ev = (window.SCH||[]).find(x => String(x.id) === sId);
    if (ev && window._idxSchById) {
      window._idxSchById.set(sId, ev);
    }
  }
  return ev || null;
};
window.getSchByGardenDate = function(gid, date, excludeCanceled = false) {
  if (!window._idxSchByGardenDate) {
    let evs = (window.SCH||[]).filter(s => String(s.g) === String(gid) && s.d === date);
    if (excludeCanceled) evs = evs.filter(s => s.st !== 'can');
    return evs;
  }
  const key = String(gid) + '_' + date;
  const evs = window._idxSchByGardenDate.get(key) || [];
  return excludeCanceled ? evs.filter(s => s.st !== 'can') : evs;
};

// Click handler for unassigned partner/trio activities
window.handleUnassignedRowClick = function(gid, ds, event) {
  if (event && event.stopPropagation) event.stopPropagation();
  const numGid = Number(gid);
  const targetDate = ds || (window.td ? window.td() : new Date().toISOString().split('T')[0]);

  // 1. Check if any partner in this garden's group (pair, cluster, trio) has an activity on targetDate
  const group = window.getGardenGroup ? window.getGardenGroup(numGid, targetDate) : (window.gardenPair ? window.gardenPair(numGid, targetDate) : null);
  let partnerAct = null;
  if (group && Array.isArray(group.ids)) {
    const partnerIds = group.ids.map(Number).filter(id => id !== numGid);
    for (const pid of partnerIds) {
      const pEvs = (window.SCH || []).filter(x => Number(x.g) === pid && x.d === targetDate && x.st !== 'can');
      if (pEvs.length > 0) {
        partnerAct = pEvs[0];
        break;
      }
    }
  }

  // 2. If a partner has an activity on this date, open that activity modal so user can view/schedule the trio
  if (partnerAct && typeof window.openSP === 'function') {
    return window.openSP(partnerAct.id);
  }

  // 3. Fallback: if no partner has an activity, open cell popup or new schedule modal
  if (typeof window.openGcellPopup === 'function' && event) {
    return window.openGcellPopup(numGid, targetDate, event);
  } else if (typeof window.openNewSched === 'function') {
    return window.openNewSched(numGid, { date: targetDate });
  }
};

// ── core.js — globals, data layer, utilities, init ──────────────
// Load order: firebase.js → invoices.js → suppliers.js → cal.js
//              → activity.js → sched.js → gardens.js → export.js
//              → backup.js → admin.js → core.js (last)

// --- Global State Declarations ---
window.SCH = window.SCH || [];
window.GARDENS = window.GARDENS || [];
window.INVOICES = window.INVOICES || [];
window.ORDERS = window.ORDERS || [];
window.DELIVERIES = window.DELIVERIES || [];
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
window.schoolBudgets = window.schoolBudgets || {};

// ══════════════════════════════════════════════════════════════════
// 🛡️ MASTER DATA REGISTRY & INTEGRITY SHIELD
// Unified single-source-of-truth snapshot for:
// Save to Cloud, Full JSON Export, Version Vault, LocalStorage & Snapshots
// ══════════════════════════════════════════════════════════════════
window.getMasterDataSnapshot = function() {
  return {
    version: 4,
    appVersion: window.APP_VERSION || '113.76',
    exported: new Date().toISOString(),
    currentYear: window.CURRENT_YEAR || 'tashpaz',
    
    // Core Activities & Schedules
    ch: Array.isArray(window.SCH) ? window.SCH : [],
    pairs: Array.isArray(window.pairs) ? window.pairs : [],
    supEx: window.supEx || {},
    clusters: window.clusters || {},
    holidays: Array.isArray(window.holidays) ? window.holidays : [],
    pairBreaks: window.pairBreaks || {},
    managers: window.managers || {},
    blockedDates: window.blockedDates || {},
    gardenBlocks: window.gardenBlocks || {},
    activeGardens: window.activeGardens ? [...window.activeGardens] : null,
    customGardens: Array.isArray(window._GARDENS_EXTRA) ? window._GARDENS_EXTRA : [],
    
    // Purchasing & Logistics
    invoices: Array.isArray(window.INVOICES) ? window.INVOICES : [],
    orders: Array.isArray(window.ORDERS) ? window.ORDERS : [],
    deliveries: Array.isArray(window.DELIVERIES) ? window.DELIVERIES : [],
    schoolBudgets: window.schoolBudgets || {},
    vatRate: window.VAT_RATE || 18,
    purchNotes: window.PURCH_NOTES || null,
    purchOrderers: window.PURCH_ORDERERS || null,
    purchFooter: window.PURCH_FOOTER || null,
    
    // SharePoint & Aliases
    spScannerAliases: window.spScannerAliases || {},
    spScannerFolderLinks: window.spScannerFolderLinks || {},
    
    // Matzava (Kindergartens, Schools, Nutrition)
    matzava: window.MATZAVA_STATE ? {
      records: Array.isArray(window.MATZAVA_STATE.records) ? window.MATZAVA_STATE.records : [],
      nutritionOnly: Array.isArray(window.MATZAVA_STATE.nutritionOnly) ? window.MATZAVA_STATE.nutritionOnly : [],
      schools: Array.isArray(window.MATZAVA_STATE.schools) ? window.MATZAVA_STATE.schools : [],
      lastSync: window.MATZAVA_STATE.lastSync || null
    } : null,

    // Field Worker Tasks (משימות שטח)
    workerTasks: Array.isArray(window.WORKER_TASKS) ? window.WORKER_TASKS : [],

    // Tasks & Todos
    todos: window.todo ? window.todo.items : []
  };
};

// 🛡️ ZERO-DATA SAFETY GUARD
// Checks whether the in-memory data is sufficiently loaded to prevent accidental blank overwrites
window.isDataSafeForExport = function() {
  const schLen = Array.isArray(window.SCH) ? window.SCH.length : 0;
  const invLen = Array.isArray(window.INVOICES) ? window.INVOICES.length : 0;
  const supLen = Object.keys(window.supEx || {}).length;
  // If completely empty in all primary datasets, it is NOT safe to overwrite or export blank
  if (schLen === 0 && invLen === 0 && supLen === 0) {
    return false;
  }
  return true;
};


// Local aliases - we must ensure these are updated when window variables are re-assigned
// or better yet, use window variables directly in functions.

// --- Utilities ---
window.extractGardenAge = function(garden) {
  if (!garden) return '***';
  if (typeof garden === 'number' || (typeof garden === 'string' && /^\d+$/.test(garden))) {
    garden = (typeof window.G === 'function' ? window.G(Number(garden)) : null) || (window.getAllGardens && window.getAllGardens().find(x => Number(x.id) === Number(garden))) || { id: garden };
  }
  const ex = (window.supEx && window.supEx['g_' + garden.id]) || {};
  if (ex.age && String(ex.age).trim()) return String(ex.age).trim();
  if (garden.age && String(garden.age).trim()) return String(garden.age).trim();
  const m = (garden.name||'').match(/(?:גילאי|גיל|כיתה|כיתות|שכבת)\s*([א-ת0-9\-\.\s]+?)(?=\)|$)/);
  return m ? m[1].trim() : '***';
};

window.getGardenAgeTag = function(gardenOrId) {
  if (!gardenOrId) return '';
  let g = gardenOrId;
  if (typeof g === 'number' || (typeof g === 'string' && /^\d+$/.test(g))) {
    g = (typeof window.G === 'function' ? window.G(Number(g)) : null) || (window.getAllGardens && window.getAllGardens().find(x => Number(x.id) === Number(g))) || { id: g };
  }
  const rawAge = typeof window.extractGardenAge === 'function' ? window.extractGardenAge(g) : (g && g.age);
  if (!rawAge || rawAge === '***') return '';
  const cleanAge = String(rawAge).trim();
  if (!cleanAge) return '';
  if (g && g.name && g.name.includes('👶')) return '';
  return `  (${cleanAge}👶)`;
};

// ═════════════════════════════════════════════════════════════════════════════
// UNIFIED WHATSAPP & SCHEDULE EXPORT ENGINE (Single Source of Truth)
// ═════════════════════════════════════════════════════════════════════════════
window.WAExport = {
  KEYS: {
    incCluster: 'gan_inc_cluster',
    incCoord: 'gan_inc_coord',
    incAge: 'gan_inc_age',
    incAddr: 'gan_inc_addr',
    incFreeDays: 'gan_inc_free_days',
    splitMsg: 'gan_split_msg'
  },

  DEFAULTS: {
    incCluster: true,
    incCoord: false,
    incAge: false,
    incAddr: true,
    incFreeDays: false,
    splitMsg: false
  },

  CHECKBOX_IDS: {
    incCluster: ['ex-inc-pair', 'gexp-inc-cluster', 'gexp-inst-inc-cluster'],
    incCoord: ['ex-inc-coord', 'gexp-inc-garden-meta', 'gexp-inst-inc-coord'],
    incAge: ['ex-inc-age', 'gexp-inc-age', 'gexp-inst-inc-age'],
    incAddr: ['ex-inc-addr', 'gexp-inc-addr', 'gexp-inst-inc-addr'],
    incFreeDays: ['ex-inc-free-days', 'gexp-inc-free-days', 'gexp-inst-inc-free-days'],
    splitMsg: ['ex-split-msg', 'gexp-split-msg', 'gexp-inst-split-msg']
  },

  getOption: function(key) {
    try {
      const storageKey = this.KEYS[key];
      if (storageKey) {
        const v = localStorage.getItem(storageKey);
        if (v !== null) return v === 'true';
      }
    } catch(e) {}
    return this.DEFAULTS[key] ?? false;
  },

  setOption: function(key, val) {
    const boolVal = !!val;
    try {
      const storageKey = this.KEYS[key];
      if (storageKey) localStorage.setItem(storageKey, boolVal ? 'true' : 'false');
    } catch(e) {}
    this.syncDOM(key, boolVal);
  },

  syncDOM: function(key, val) {
    const ids = this.CHECKBOX_IDS[key] || [];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.checked !== !!val) el.checked = !!val;
    });
  },

  syncAllFromStorage: function() {
    const self = this;
    Object.keys(this.KEYS).forEach(k => {
      self.syncDOM(k, self.getOption(k));
    });
  },

  getAllOptions: function() {
    return {
      incCluster: this.getOption('incCluster'),
      incCoord: this.getOption('incCoord'),
      incAge: this.getOption('incAge'),
      incAddr: this.getOption('incAddr'),
      incFreeDays: this.getOption('incFreeDays'),
      splitMsg: this.getOption('splitMsg')
    };
  },

  formatGardenName: function(gd, opts = {}) {
    if (!gd) return '';
    const name = (gd.name || '').trimEnd();
    const incAge = (opts.incAge !== undefined) ? opts.incAge : this.getOption('incAge');
    const ageTag = incAge ? (typeof window.getGardenAgeTag === 'function' ? window.getGardenAgeTag(gd) : '') : '';
    return `${name}${ageTag}`;
  },

  getCoordinatorLabel: function(gid) {
    if (typeof window.getGardenCoordinator === 'function') {
      const ci = window.getGardenCoordinator(gid);
      if (ci && ci.name && ci.role !== 'manager' && ci.role !== 'vp') {
        const p = (ci.phone || '').trim();
        return p ? `${ci.name} (${p})` : ci.name;
      }
    }
    const numId = Number(gid);
    const mgr = Object.values(window.managers || {}).find(
      m => m && m.role !== 'manager' && m.role !== 'vp' && Array.isArray(m.gardenIds) && m.gardenIds.map(Number).includes(numId)
    );
    if (mgr && mgr.name) {
      const p = (mgr.phone || '').trim();
      return p ? `${mgr.name} (${p})` : mgr.name;
    }
    return '';
  },

  getFreeDaysText: function(gardenIds, targetDateStr) {
    if (typeof window.getGardenFreeDays !== 'function') return '';
    return window.getGardenFreeDays(gardenIds, targetDateStr) || '';
  },

  formatFreeDaysLine: function(freeDaysStr) {
    if (!freeDaysStr) return '';
    return `*ימים פנויים : ${freeDaysStr}*`;
  },

  groupByConsecutiveAddress: function(items, getAddrFn, opts = {}) {
    const incAddr = (opts.incAddr !== undefined) ? opts.incAddr : this.getOption('incAddr');
    const norm = (st) => String(st || '').trim().replace(/\s+/g, ' ');
    const runs = [];
    (items || []).forEach(item => {
      const rawSt = incAddr ? String(getAddrFn(item) || '').trim() : '';
      const nSt = norm(rawSt);
      const prev = runs[runs.length - 1];
      if (prev && nSt && prev.normAddr === nSt) {
        prev.items.push(item);
      } else {
        runs.push({ normAddr: nSt, displayAddr: rawSt, items: [item] });
      }
    });
    return runs;
  }
};

// Backward compatible sync functions
window.syncExportAgeCheckboxes = function(val) { window.WAExport.setOption('incAge', val); };
window.syncExportCoordCheckboxes = function(val) { window.WAExport.setOption('incCoord', val); };
window.syncExportFreeDaysCheckboxes = function(val) { window.WAExport.setOption('incFreeDays', val); };
window.syncExportSplitCheckboxes = function(val) { window.WAExport.setOption('splitMsg', val); };
window.syncExportClusterCheckboxes = function(val) { window.WAExport.setOption('incCluster', val); };
window.syncExportAddrCheckboxes = function(val) { window.WAExport.setOption('incAddr', val); };

// ═════════════════════════════════════════════════════════════════════════════
// SINGLE SOURCE OF TRUTH: FIELD USER & ROLE DETECTION
// ═════════════════════════════════════════════════════════════════════════════
window.isFieldMode = function() {
  if (window.permCoord) return true;
  if (window.role === 'coordinator' || window.role === 'manager' || window.role === 'vp') return true;
  if (document.body && document.body.classList.contains('coordinator-mode')) return true;
  const root = document.getElementById('coordinator-app-root');
  if (root && root.style.display !== 'none') return true;
  const container = document.getElementById('coordinator-app-container');
  if (container && container.style.display !== 'none') return true;
  return false;
};

// ═════════════════════════════════════════════════════════════════════════════
// SINGLE SOURCE OF TRUTH: PURCHASING & VAT CALCULATIONS
// ═════════════════════════════════════════════════════════════════════════════
window.PurchasingCalc = {
  getVatRate: function(customRate) {
    if (customRate !== undefined && !isNaN(parseFloat(customRate))) return parseFloat(customRate);
    return window.VAT_RATE || 18;
  },

  calcVat: function(amount, vatRate = 18, mode = 'ex') {
    const rate = parseFloat(vatRate) || 0;
    const amt = parseFloat(amount) || 0;
    if (rate <= 0 || amt <= 0) {
      return { base: amt, vat: 0, total: amt };
    }
    if (mode === 'inc') {
      const base = amt / (1 + rate / 100);
      const vat = amt - base;
      return { base: base, vat: vat, total: amt };
    } else {
      const vat = amt * (rate / 100);
      const total = amt + vat;
      return { base: amt, vat: vat, total: total };
    }
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// SINGLE SOURCE OF TRUTH: DATE & TIME FORMATTING
// ═════════════════════════════════════════════════════════════════════════════
window.getNowDateTimeString = function(dateObj = new Date()) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};

// ═════════════════════════════════════════════════════════════════════════════
// SINGLE SOURCE OF TRUTH: GARDEN UNITS, CLUSTERS & PAIRS RESOLUTION
// ═════════════════════════════════════════════════════════════════════════════

window.isSchoolGarden = function(gOrId) {
  if (!gOrId) return false;
  const g = (typeof gOrId === 'object') ? gOrId : (typeof window.G === 'function' ? window.G(gOrId) : null);
  if (!g) return false;
  const cls = (typeof window.getGardenClass === 'function'
    ? window.getGardenClass(g)
    : (typeof window.gcls === 'function' ? window.gcls(g) : (g.cls || ''))).trim();
  if (cls === 'ביה"ס' || cls === 'בית ספר') return true;
  return /בית ספר|ביה"ס|בי"ס|בי״ס|ביה״ס/i.test(g.name || '') || /בית ספר|ביה"ס|בי"ס|בי״ס|ביה״ס/i.test(g.cls || '');
};

window.getGardenPhone = function(gOrId) {
  if (!gOrId) return '';
  const gid = (typeof gOrId === 'object') ? gOrId.id : gOrId;
  const g = (typeof gOrId === 'object') ? gOrId : (typeof window.G === 'function' ? window.G(gid) : null);
  const ex = (window.supEx && window.supEx['g_' + gid]) || {};
  if (ex.coph && String(ex.coph).trim()) return String(ex.coph).trim();
  if (g && g.coph && String(g.coph).trim()) return String(g.coph).trim();
  if (g && g.phone && String(g.phone).trim()) return String(g.phone).trim();
  if (window.GARDEN_PHONES && window.GARDEN_PHONES[String(gid)] && window.GARDEN_PHONES[String(gid)].ph1) {
    return String(window.GARDEN_PHONES[String(gid)].ph1).trim();
  }
  return '';
};

window.isPairBrokenOnDate = function(pairId, dateStr) {
  if (!pairId || !dateStr) return false;
  if (typeof window.isPairBroken === 'function') {
    return !!window.isPairBroken(pairId, dateStr);
  }
  const k = pairId + '_' + dateStr;
  return !!(window.pairBreaks && window.pairBreaks[k]);
};

window.resolveGardenUnit = function(gid, targetDate, opts = {}) {
  const numId = Number(gid);
  const g = typeof window.G === 'function' ? window.G(numId) : null;
  const gName = (g && g.name) ? g.name : `גן ${numId}`;
  const ds = targetDate ? (typeof targetDate === 'string' ? targetDate : (window.d2s ? window.d2s(targetDate) : String(targetDate))) : null;

  // Determine effective grouping mode:
  // Explicitly passed opts.mode ('clusters' | 'pairs') takes precedence.
  // Otherwise, respect active system mode (window._listGroupMode / window._dashTab).
  const isClusterActive = (typeof window !== 'undefined') && (window._listGroupMode === 'clusters' || window._dashTab === 'clusters');
  const effectiveMode = opts.mode || (isClusterActive ? 'clusters' : 'pairs');

  // Helper: check Cluster
  const resolveCluster = () => {
    let cl = null;
    if (ds && typeof window.gardenClusters === 'function') {
      const res = window.gardenClusters(numId, ds);
      if (res && res.length > 0) cl = res[0];
    }
    if (!cl) {
      const clustersList = (ds && typeof window.getClusters === 'function')
        ? window.getClusters(ds, ds)
        : (typeof window.getClusters === 'function' ? window.getClusters() : Object.values(window.clusters || {}));
      cl = (clustersList || []).find(c => (c.gardenIds || []).map(Number).includes(numId)) || null;
    }
    if (cl) {
      const clGids = (cl.gardenIds || []).map(Number);
      return {
        type: 'cluster',
        id: cl.id || cl.name,
        key: `cl_${cl.id || cl.name}`,
        name: cl.name || 'אשכול',
        gids: clGids,
        ids: clGids, // for backward compatibility with getGardenGroup
        partnerGids: clGids.filter(x => x !== numId),
        isSolo: false,
        isBroken: false,
        sortRank: 1,
        raw: cl
      };
    }
    return null;
  };

  // Helper: check School
  const resolveSchool = () => {
    if (window.isSchoolGarden(g)) {
      return {
        type: 'school',
        id: `sch_${numId}`,
        key: `sch_${numId}`,
        name: gName || `בי"ס ${numId}`,
        gids: [numId],
        ids: [numId],
        partnerGids: [],
        isSolo: true,
        isBroken: false,
        sortRank: 2,
        raw: g
      };
    }
    return null;
  };

  // Helper: check Pair
  const resolvePair = () => {
    const pairsList = (ds && typeof window.getPairs === 'function')
      ? window.getPairs(ds, ds)
      : (window.pairs || []);
    const pr = (pairsList || []).find(p => (p.ids || []).map(Number).includes(numId));
    if (pr) {
      const prGids = (pr.ids || []).map(Number);
      const broken = ds ? window.isPairBrokenOnDate(pr.id, ds) : false;
      if (broken) {
        return {
          type: 'pair',
          id: pr.id,
          key: `pr_${pr.id}`,
          name: gName,
          gids: [numId],
          ids: [numId],
          partnerGids: prGids.filter(x => x !== numId),
          isSolo: true,
          isBroken: true,
          sortRank: 3,
          raw: pr
        };
      }
      return {
        type: 'pair',
        id: pr.id,
        key: `pr_${pr.id}`,
        name: pr.name || 'זוג גנים',
        gids: prGids,
        ids: prGids,
        partnerGids: prGids.filter(x => x !== numId),
        isSolo: false,
        isBroken: false,
        sortRank: 3,
        raw: pr
      };
    }
    return null;
  };

  // Prioritize matching based on effectiveMode
  if (effectiveMode === 'clusters') {
    const cl = resolveCluster();
    if (cl) return cl;
    const sch = resolveSchool();
    if (sch) return sch;
    const pr = resolvePair();
    if (pr) return pr;
  } else {
    // effectiveMode === 'pairs'
    const sch = resolveSchool();
    if (sch) return sch;
    const pr = resolvePair();
    if (pr) return pr;
    // Fallback: If not assigned to any pair, check cluster
    const cl = resolveCluster();
    if (cl) return cl;
  }

  // Default: Solo garden
  return {
    type: 'solo',
    id: `solo_${numId}`,
    key: `solo_${numId}`,
    name: gName,
    gids: [numId],
    ids: [numId],
    partnerGids: [],
    isSolo: true,
    isBroken: false,
    sortRank: 4,
    raw: g
  };
};


window.debounce = function(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};

// --- Global UI Helpers ---
window.ui = {
  /**
   * Renders a standardized activity row for tables.
   */
  /**
   * Renders the 5 quick action buttons (V, X, !, Postpone, Calendar).
   */
  renderQuickActionBtns: function(s) {
    if (s.st === 'unassigned' || String(s.id).startsWith('dummy_')) {
      return '';
    }
    const sid = s.id;
    const isDone = s.st === 'done';
    const isCan = s.st === 'can';
    const isNohap = s.st === 'nohap';
    const isPost = s.st === 'post';
    const isException = isNohap || isPost || isCan;
    const isHandled = !!(s._compByMakeup && s._compByMakeup !== 'false');
    const isM = !!(s._isMakeup || s._makeupFrom || (s.nt && !s.nt.includes('השלמה נקבעה ל-') && /השלמה/i.test(s.nt)));

    return `
      <div class="qacts flex-c justify-center gap-3 ${window.isMobileMode()?'mob-ver':''}" onclick="event.stopPropagation()">
        ${isDone ? '' : `<button title="בוצע" class="qbtn q-done" onclick="window.qSetSt('${sid}','done')">✔️ ${window.isMobileMode()?'בוצע':''}</button>`}
        ${isM ? `<button title="ביטול שיבוץ השלמה והחזרה למצב מקורי של לא התקיים" class="qbtn q-undo-mu" style="background:#fff3e0;color:#c62828;border:1px solid #ffb74d;font-weight:800" onclick="window.quickCancelMakeup('${sid}')">↩️ ${window.isMobileMode()?'בטל השלמה':''}</button>` : ''}
        ${(isException && !isHandled) ? `<button title="סיום טיפול" class="qbtn q-handled" onclick="if(window.markCompQuick)window.markCompQuick('${sid}')">✅ ${window.isMobileMode()?'טופל':''}</button>` : ''}
        ${(isException && isHandled) ? `<button title="ביטול טיפול (החזרה לרשימת לטיפול)" class="qbtn q-handled" style="background:#fff3e0;color:#e65100;border:1px solid #ffb74d" onclick="if(window.unmarkCompQuick)window.unmarkCompQuick('${sid}')">↩️ ${window.isMobileMode()?'לא טופל':''}</button>` : ''}
        ${isCan ? '' : `<button title="ביטול" class="qbtn q-can" onclick="window.openCanQ('${sid}')">❌ ${window.isMobileMode()?'ביטול':''}</button>`}
        ${isNohap ? '' : `<button title="לא התקיים" class="qbtn q-nohap" onclick="window.qSetSt('${sid}','nohap')">⚠️ ${window.isMobileMode()?'לא התקיים':''}</button>`}
        <button title="הזזה (דחייה / הקדמה)" class="qbtn q-post" onclick="window.openPostpone('${sid}')">⏩ ${window.isMobileMode()?'הזזה':''}</button>
        <button title="קביעת השלמה" class="qbtn q-mu" onclick="window.openMakeupSched('${sid}')">📅 ${window.isMobileMode()?'השלמה':''}</button>
      </div>`;
  },

  /**
   * Renders a standardized activity row for tables (8 columns).
   */
  renderActivityRow: function(s, opts = {}) {
    const isCoord = window.role === 'coordinator' || window.role === 'manager' || window.role === 'vp' || !!window.isReadOnly;
    const g = window.G(s.g) || {};
    const supBase = s.st === 'unassigned' ? '—' : (window.supNameLabel ? window.supNameLabel(s.a) : window.supBase(s.a));
    const supAct = s.st === 'unassigned' ? '—' : (s.act || window.supAct(s.a) || '—');
    const timeStr = (s.st === 'unassigned' || !s.t) ? '—' : (window.fT ? window.fT(s.t) : s.t);
    const stLbl = window.stLabel ? window.stLabel(s) : s.st;
    const stCls = window.stClass ? window.stClass(s) : '';
    const phone = (s.st !== 'unassigned' && typeof window.getSupPhone === 'function') ? window.getSupPhone(s.a) : '';
    const isM = !!(s._isMakeup || s._makeupFrom || (s.nt && !s.nt.includes('השלמה נקבעה ל-') && /השלמה/i.test(s.nt)));
    const context = opts.context || 'dash'; // dash, cal, sched
    const gClass = window.gcls(g);
    const gIcon = gClass === 'ביה"ס' ? '🏛️' : '🏫';
    const evType = s.st === 'unassigned' ? '—' : (s.tp || (gClass === 'גנים' ? 'חוג' : ''));
    const grpCount = s.st === 'unassigned' ? '—' : (s.grp || (gClass === 'גנים' ? 1 : ''));

    let tagText = '';
    if (s.st === 'can' || (s.nt && /ביטול|בוטל/i.test(s.nt))) tagText = 'ביטול';
    else if (s.st === 'nohap') tagText = ''; // Ensure 'nohap' activities do not get the 'השלמה' tag
    else if (s.nt && /הקדמה|הוקדם/i.test(s.nt)) tagText = 'הקדמה';
    else if (s.nt && /דחי?יה|נדחה/i.test(s.nt)) tagText = 'דחיה';
    else if (isM) tagText = 'השלמה';
    
    const tagMobile = tagText ? `<span style="background:#ffe082;color:#b71c1c;border-radius:4px;padding:1px 4px;font-size:0.65rem;font-weight:800;margin-left:4px;display:inline-block">${tagText}</span> ` : '';
    const tagDesktop = tagText ? `<b style="color:var(--c-warning)">[${tagText}]</b> ` : '';

    const numGid = Number(g.id);
    const coordInfo = typeof window.getGardenCoordinator === 'function' ? window.getGardenCoordinator(numGid) : null;
    const coName = coordInfo ? coordInfo.name : (g.co || '');
    const coDisplay = coName ? `
            <div style="grid-column: span 2; font-size:0.7rem; color:#64748b; font-weight:normal;">
              👤 רכז/ת: ${coName}
            </div>` : '';

    const isUnassigned = s.st === 'unassigned' || String(s.id).startsWith('dummy_');
    const rowClickAction = isUnassigned
      ? `window.handleUnassignedRowClick(${s.g}, '${s.d}', event)`
      : `window.openSP('${s.id}')`;

    if (window.isMobileMode()) {
      return `
        <div class="mob-act-card ${stCls}" onclick="${rowClickAction}">
          <div class="mob-act-hdr">
            <span class="mob-act-time">${timeStr}</span>
            <span class="mob-act-garden" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; display:block;">${g.name}${g.st ? ` <span style="font-size:0.75rem; color:#64748b; font-weight:400; margin-right:6px; display:inline-block">📍 ${g.st}</span>` : ''}</span>
            <span class="mob-act-status">${stLbl}</span>
          </div>
          <div class="mob-act-body">
            <div style="grid-column: span 2">
              👤 <b>${supBase}</b> ${phone ? `<span style="color:var(--c-success);font-weight:600;font-size:0.75rem;margin-right:6px">📞 ${phone}</span>` : ''}
            </div>
            <div style="grid-column: span 2">
              🎨 <b>${supAct}</b> ${evType ? `<span style="color:#78909c;font-size:0.75rem">(${evType})</span>` : ''} ${grpCount ? `<span style="background:#e8eaf6;color:#3f51b5;border-radius:4px;padding:1px 5px;font-size:0.68rem;margin-right:6px;font-weight:700;display:inline-block">${grpCount} קב'</span>` : ''}
            </div>
            ${coDisplay}
            ${(s.nt || tagText) ? `
              <div style="grid-column: span 2; color:var(--c-error)">
                📝 ${tagMobile}${s.nt || ''}
              </div>` : ''}
          </div>
          <div class="mob-act-btns">
            ${window.ui.renderQuickActionBtns(s)}
          </div>
        </div>`;
    }

    let rowHtml = `
      <tr class="${stCls} border-b cursor-pointer" onclick="${rowClickAction}">`;

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
         ${coName ? `<div style="font-size:0.72rem; color:#64748b; font-weight:normal; margin-top:3px;">👤 רכז/ת: ${coName}</div>` : ''}
      </td>`;

    // 3. Time (שעה)
    rowHtml += `
      <td class="p-8 text-center font-bold text-secondary">
        ${timeStr}
      </td>`;

    // 4. Supplier (ספק)
    rowHtml += `
      <td class="p-8 font-600 text-secondary">
        ${supBase} ${phone ? `<span class="text-xs text-success mr-2">📞 ${phone}</span>` : ''}
      </td>`;

    // 5. Type (סוג)
    rowHtml += `
      <td class="p-8" style="color:#78909c; font-weight:500">
        ${evType}
      </td>`;

    // 5.5 Activity (פעילות)
    rowHtml += `
      <td class="p-8" style="color:var(--c-info); font-weight:500">
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
        ${tagDesktop}${s.nt || ''}
      </td>`;

    // 9. Actions (פעולות)
    if (!isCoord) {
      rowHtml += `
        <td class="p-8 text-center" onclick="event.stopPropagation()">
          ${window.ui.renderQuickActionBtns(s)}
        </td>`;
    }

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
    
    const gNamesStr = (!isSolo && gids.length > 0) ? gids.map(id => (window.G(id) || {}).name || '').filter(Boolean).join('/') : '';
    const clusterSuffix = gNamesStr ? ` <span style="font-size:0.75rem; font-weight:normal; opacity:0.8">(גנים ${gNamesStr})</span>` : '';
    const clusterSuffixText = gNamesStr ? ` (גנים ${gNamesStr})` : '';

    // Header Buttons
    const toggleId = 'pair-toggle-' + Math.random().toString(36).substr(2, 9);
    const isCoord = window.role === 'coordinator' || window.role === 'manager' || window.role === 'vp' || !!window.isReadOnly;
    const defaultClosed = opts.defaultOpen ? false : (isCoord ? true : !!opts.isCluster);
    const defaultIcon = defaultClosed ? '+' : '-';
    const defaultDisplay = defaultClosed ? 'none' : 'block';
    const collapseBtn = `<button class="btn bo bsm pair-collapse-btn" onclick="window.togglePairCard('${toggleId}', this.closest('.card-hdr-row'), event)" style="font-size:1.1rem !important; height:28px !important; min-height:28px !important; width:28px !important; padding:0 !important; border:1px solid ${clr.solid} !important; background:#fff !important; color:${clr.solid} !important; font-weight:700 !important; border-radius:4px !important; display:inline-flex !important; align-items:center !important; justify-content:center !important; cursor:pointer;" title="פתח/סגור תצוגה"><span style="font-family:monospace;font-weight:bold;line-height:1;margin-top:-2px">${defaultIcon}</span></button>`;
    
    const weekBtn = `<button class="btn bo bsm" style="font-size:0.65rem !important; height:24px !important; min-height:24px !important; line-height:22px !important; padding:0 6px !important; border:1px solid #1e88e5 !important; background:#fff !important; color:#1e88e5 !important; font-weight:700 !important; border-radius:4px !important; white-space:nowrap !important; display:inline-flex !important; align-items:center !important; gap:2px !important;" onclick="event.stopPropagation(); window.calJump('${isSolo ? '' : pair.id}','week','${isSolo ? gids[0] : ''}')">📅 שבוע</button>`;
    const monthBtn = `<button class="btn bo bsm" style="font-size:0.65rem !important; height:24px !important; min-height:24px !important; line-height:22px !important; padding:0 6px !important; border:1px solid #1e88e5 !important; background:#fff !important; color:#1e88e5 !important; font-weight:700 !important; border-radius:4px !important; white-space:nowrap !important; display:inline-flex !important; align-items:center !important; gap:2px !important;" onclick="event.stopPropagation(); window.calJump('${isSolo ? '' : pair.id}','month','${isSolo ? gids[0] : ''}')">📅 חודש</button>`;
    const exportGids = (pair && Array.isArray(pair.ids) && pair.ids.length > 0) ? pair.ids : ((evs && evs.length > 0) ? Array.from(new Set(evs.map(e => Number(e.g)))) : gids);
    const safeExportGids = (exportGids || []).map(Number).filter(Boolean);
    const targetActDate = ds || (evs && evs[0] ? evs[0].d : '');
    const expBtn = `<button class="btn bg bsm coord-msg-btn" style="background:#25d366 !important; color:#fff !important; border:none !important; height:24px !important; min-height:24px !important; line-height:24px !important; padding:0 7px !important; font-size:0.65rem !important; font-weight:700 !important; border-radius:4px !important; white-space:nowrap !important; display:inline-flex !important; align-items:center !important; gap:2px !important;" onclick="event.stopPropagation(); window._exportPairWA([${safeExportGids.join(',')}], false, null, '${targetActDate}')">📱 הודעה</button>`;
    const jumpBtn = (context === 'dash' && evs.length > 0) ? `<button class="btn bo bsm" style="font-size:0.65rem !important; height:24px !important; min-height:24px !important; line-height:22px !important; padding:0 6px !important; border:1px solid #ff9800 !important; background:#fff !important; color:#ff9800 !important; font-weight:700 !important; border-radius:4px !important; white-space:nowrap !important; display:inline-flex !important; align-items:center !important; gap:2px !important;" onclick="event.stopPropagation(); window.jumpToCalendar('${isSolo ? '' : pair.id}','${isSolo ? gids[0] : ''}', '${ds}', '${evs[0].id}')">👁️ הצג בלוח השנה</button>` : '';
    const editBtn = opts.isCluster ? `<button class="btn bp bsm" onclick="event.stopPropagation();window.openClusterBulkEdit('${pair.id}','${ds}')" style="background:#1e88e5 !important; color:#fff !important; border:none !important; height:24px !important; min-height:24px !important; line-height:24px !important; padding:0 7px !important; font-size:0.65rem !important; font-weight:700 !important; border-radius:4px !important; white-space:nowrap !important; display:inline-flex !important; align-items:center !important; gap:2px !important; margin-left:4px;">✏️ עריכה</button>` : '';

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
        if (window.isMobileMode()) {
          tableRows += `
            <div class="mob-act-card" style="background:${gblk ? '#fff5f5' : '#f8fafc'}; opacity:0.8; cursor:pointer" onclick="${ds ? `window.openGcellPopup(${gid},'${ds}',event)` : ''}">
              <div class="mob-act-hdr" style="justify-content:space-between">
                <span class="mob-act-garden" style="color:var(--c-primary);font-weight:700">🏫 ${g.name}</span>
              </div>
              <div class="mob-act-body">
                <div style="grid-column: span 2; font-size:0.7rem; color:${gblk ? '#c62828' : '#94a3b8'}">
                  ${gblk ? `${gblk.icon || '🚫'} ${gblk.reason}` : 'אין פעילות רשומה ביום זה'}
                </div>
              </div>
            </div>`;
        } else {
          tableRows += `
            <tr style="border-bottom:1px solid #f1f5f9; background:${gblk ? '#fff5f5' : '#fff'}; opacity:0.8; cursor:pointer" onclick="${ds ? `window.openGcellPopup(${gid},'${ds}',event)` : ''}">
              <td style="padding:10px; font-weight:700; color:var(--c-primary)">🏫 ${g.name}</td>
              <td colspan="7" style="padding:10px; font-size:0.7rem; color:${gblk ? '#c62828' : '#94a3b8'}">
                ${gblk ? `${gblk.icon || '🚫'} ${gblk.reason}` : 'אין פעילות רשומה ביום זה'}
              </td>
            </tr>`;
        }
      });
    } else {
      const cancellations = sortedEvs.filter(s => s.st === 'can' || s.st === 'nohap' || s.st === 'post');
      const activeEvs = sortedEvs.filter(s => s.st !== 'can' && s.st !== 'nohap' && s.st !== 'post');
      const hasBoth = cancellations.length > 0 && activeEvs.length > 0;

      if (hasBoth) {
        const isMob = window.isMobileMode();
        
        if (isMob) {
          tableRows += `<div style="background:#fff5f5; border:1px solid #ffd8d8; border-radius:6px; padding:6px 10px; font-weight:800; color:#c62828; font-size:0.72rem; margin-bottom:6px; text-align:right">⚠️ פעילויות שלא התקיימו / בוטלו:</div>`;
        } else {
          tableRows += `<tr style="background:#fff5f5; border-bottom:1px solid #ffd8d8"><td colspan="${context === 'dash' ? 9 : 8}" style="padding:8px 10px; font-weight:800; color:#c62828; font-size:0.75rem; text-align:right">⚠️ פעילויות שלא התקיימו / בוטלו:</td></tr>`;
        }
        
        cancellations.forEach(s => {
          tableRows += window.ui.renderActivityRow(s, { showCheckbox: context === 'dash', context: context });
        });
        
        if (isMob) {
          tableRows += `<div style="background:#f0faf4; border:1px solid #c3f2d7; border-radius:6px; padding:6px 10px; font-weight:800; color:#2e7d32; font-size:0.72rem; margin-bottom:6px; margin-top:8px; text-align:right">🏫 פעילויות השלמה / מתקיימות:</div>`;
        } else {
          tableRows += `<tr style="background:#f0faf4; border-bottom:1px solid #c3f2d7"><td colspan="${context === 'dash' ? 9 : 8}" style="padding:8px 10px; font-weight:800; color:#2e7d32; font-size:0.75rem; text-align:right">🏫 פעילויות השלמה / מתקיימות:</td></tr>`;
        }
        
        activeEvs.forEach(s => {
          tableRows += window.ui.renderActivityRow(s, { showCheckbox: context === 'dash', context: context });
        });
      } else {
        sortedEvs.forEach(s => {
          tableRows += window.ui.renderActivityRow(s, { 
            showCheckbox: context === 'dash',
            context: context
          });
        });
      }
    }

    if (window.isMobileMode()) {
      const modeIcon = opts.isCluster ? '🏘️' : (isSolo ? '🏡' : '👫');
      const actCountBadge = `<span style="font-size:0.7rem; background:${clr.light}; color:${clr.solid}; padding:1px 6px; border-radius:10px; font-weight:700; margin-right:4px">${evs.length}</span>`;
      return `
      <details class="mob-accordion"${defaultClosed ? '' : ' open'} style="border-top: 4px solid ${clr.solid}; margin-bottom:8px">
        <summary class="mob-summary" style="padding: 8px 10px; display:flex; align-items:center; cursor:pointer">
           <span class="icon" style="font-size:1.1rem; margin-left:4px">${modeIcon}</span>
           <span class="title" style="font-size:0.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; padding-left:8px; font-weight:700; color:${clr.solid}">${pair.name}${clusterSuffixText}</span>
           ${actCountBadge}
           <div style="display:flex; align-items:center; gap:4px; flex-shrink:0">
              <button class="btn bo bsm" style="font-size: 0.62rem !important; height: 22px !important; min-height: 22px !important; line-height: 20px !important; padding: 0 4px !important; border: 1px solid #1e88e5 !important; background: #fff !important; color: #1e88e5 !important; font-weight: 700 !important; border-radius: 4px !important; white-space: nowrap !important; margin: 0 !important; display: inline-flex !important; align-items: center !important; gap: 2px !important;" onclick="event.stopPropagation(); window.calJump('${isSolo ? '' : pair.id}','week','${isSolo ? gids[0] : ''}')">📅 שבוע</button>
              <button class="btn bo bsm" style="font-size: 0.62rem !important; height: 22px !important; min-height: 22px !important; line-height: 20px !important; padding: 0 4px !important; border: 1px solid #1e88e5 !important; background: #fff !important; color: #1e88e5 !important; font-weight: 700 !important; border-radius: 4px !important; white-space: nowrap !important; margin: 0 !important; display: inline-flex !important; align-items: center !important; gap: 2px !important;" onclick="event.stopPropagation(); window.calJump('${isSolo ? '' : pair.id}','month','${isSolo ? gids[0] : ''}')">📅 חודש</button>
              <button class="btn bg bsm coord-msg-btn" style="background: #25d366 !important; color: #fff !important; border: none !important; height: 22px !important; min-height: 22px !important; line-height: 22px !important; padding: 0 5px !important; font-size: 0.62rem !important; font-weight: 700 !important; border-radius: 4px !important; white-space: nowrap !important; margin: 0 !important; display: inline-flex !important; align-items: center !important; gap: 2px !important;" onclick="event.stopPropagation(); window._exportPairWA([${safeExportGids.join(',')}], false, null, '${targetActDate}')">📱 הודעה</button>
           </div>
        </summary>
        <div class="mob-content p-4">
           ${tableRows}
        </div>
      </details>`;
    }

    return `
    <div class="card standard-pair-card" style="border-top:3px solid ${clr.solid}; padding:0; border-radius:6px; overflow:hidden; background:#fff; box-shadow:0 2px 4px rgba(0,0,0,0.03); border:1px solid #e2e8f0; border-top-width:3px; margin-bottom:6px !important">
      <div class="flex-c gap-8 card-hdr-row" onclick="window.togglePairCard('${toggleId}', this, event)" style="background:${clr.light}; border-bottom:1px solid #e2e8f0; padding:6px 10px !important; min-height:36px !important; align-items:center !important; cursor:pointer; user-select:none; -webkit-tap-highlight-color:transparent;">
          <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
            ${!isSolo ? collapseBtn : ''}
            <div style="width:24px; height:24px; border-radius:50%; background:${clr.solid}; color:#fff; display:flex; justify-content:center; align-items:center; font-size:0.8rem; flex-shrink:0;">
              <i class="fas ${opts.isCluster ? 'fa-layer-group' : 'fa-link'}"></i>
            </div>
            <h3 style="margin:0; font-size:0.85rem; font-weight:700; color:${clr.solid}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${pair.name || ''}${clusterSuffix}</h3>
          </div>
        <div class="flex-c gap-6 mr-auto" style="align-items:center !important; flex-shrink:0;">
          ${editBtn} ${weekBtn} ${monthBtn} ${expBtn}
        </div>
      </div>
      <div id="${toggleId}" class="tw overflow-auto" style="display:${defaultDisplay}">
        <table class="w-full" style="border-collapse:collapse; font-size:var(--fs-small); width:100%;">
          <thead>
          <tr style="background:#f8fafc; border-bottom:1px solid #e2e8f0; color:#64748b; font-weight:700; font-size:var(--fs-small)">
              ${context === 'dash' ? '<th style="width:35px; text-align:center; padding:10px"></th>' : ''}
              <th style="text-align:right; padding:8px 10px">צהרון</th>
              <th style="text-align:center; padding:8px 10px">שעה</th>
              <th style="text-align:right; padding:8px 10px">ספק</th>
              <th style="text-align:right; padding:8px 10px">סוג</th>
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

window.togglePairCard = function(toggleId, headerEl, evt) {
  if (evt) {
    const target = evt.target;
    if (target) {
      const tag = target.tagName ? target.tagName.toLowerCase() : '';
      if ((tag === 'button' || tag === 'a' || target.closest('button')) && !target.closest('.pair-collapse-btn')) {
        return; // Don't collapse if clicking inner action buttons (but allow the collapse button itself)
      }
    }
    if (typeof evt.stopPropagation === 'function') evt.stopPropagation();
  }
  const t = document.getElementById(toggleId);
  if (!t) return;
  const isHidden = t.style.display === 'none' || getComputedStyle(t).display === 'none';
  t.style.display = isHidden ? 'block' : 'none';
  
  const icon = headerEl ? headerEl.querySelector('.pair-collapse-btn span') : null;
  if (icon) {
    icon.textContent = isHidden ? '-' : '+';
  }
};

window.OM = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
};
window.CM = function(id) {
  if (id === 'spm') window._currentCustomGroup = null;
  if (id === 'sum') {
    try {
      const name = document.getElementById('su-name')?.value?.trim();
      if (name && typeof window.saveSup === 'function') {
        window.saveSup(true);
      }
    } catch(e) { console.error('Error auto-saving supplier on exit:', e); }
  }
  if (id === 'sucard-m') {
    try {
      const ep = document.getElementById('suc-edit-panel');
      if (ep && ep.style.display !== 'none' && typeof window.sucSaveEdit === 'function') {
        window.sucSaveEdit(true);
      }
    } catch(e) { console.error('Error auto-saving supplier card on exit:', e); }
  }
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


window.spAlert = function(msg) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "sp-sys-dialog-overlay";
    overlay.innerHTML = `
      <div class="sp-sys-dialog">
        <div class="sp-sys-dialog-msg">${msg}</div>
        <div class="sp-sys-dialog-btns">
          <button class="sp-sys-btn sp-sys-btn-ok" >אישור</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("show"), 10);
    
    overlay.querySelector(".sp-sys-btn-ok").onclick = () => {
      overlay.classList.remove("show");
      setTimeout(() => { overlay.remove(); resolve(); }, 200);
    };
  });
};

window._spDialogUid = 0;
window.spConfirm = function(msg) {
  return new Promise(resolve => {
    const uid = ++window._spDialogUid;
    const overlay = document.createElement("div");
    overlay.className = "sp-sys-dialog-overlay";
    overlay.innerHTML = `
      <div class="sp-sys-dialog">
        <div class="sp-sys-dialog-msg">${msg}</div>
        <div class="sp-sys-dialog-btns">
          <button class="sp-sys-btn sp-sys-btn-cancel" id="sp-conf-no-${uid}">לא</button>
          <button class="sp-sys-btn sp-sys-btn-ok" id="sp-conf-yes-${uid}">אישור</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("show"), 10);
    
    document.getElementById(`sp-conf-yes-${uid}`).onclick = () => {
      overlay.classList.remove("show");
      setTimeout(() => { overlay.remove(); resolve(true); }, 200);
    };
    document.getElementById(`sp-conf-no-${uid}`).onclick = () => {
      overlay.classList.remove("show");
      setTimeout(() => { overlay.remove(); resolve(false); }, 200);
    };
  });
};
window.spPrompt = function(msg, defaultText = '') {
  return new Promise(resolve => {
    const uid = ++window._spDialogUid;
    const overlay = document.createElement("div");
    const safeDefault = String(defaultText || '').replace(/"/g, '&quot;');
    overlay.className = "sp-sys-dialog-overlay";
    overlay.innerHTML = `
      <div class="sp-sys-dialog">
        <div class="sp-sys-dialog-msg">${msg}</div>
        <input type="text" id="sp-prompt-input-${uid}" value="${safeDefault}" style="width:100%; padding:8px; margin:10px 0; border:1px solid #ccc; border-radius:4px; font-size:1rem; box-sizing:border-box;">
        <div class="sp-sys-dialog-btns">
          <button class="sp-sys-btn sp-sys-btn-cancel" id="sp-prompt-cancel-${uid}">ביטול</button>
          <button class="sp-sys-btn sp-sys-btn-ok" id="sp-prompt-ok-${uid}">אישור</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("show"), 10);
    
    const input = document.getElementById(`sp-prompt-input-${uid}`);
    input.focus();
    
    const finish = (val) => {
      overlay.classList.remove("show");
      setTimeout(() => { overlay.remove(); resolve(val); }, 200);
    };
    
    document.getElementById(`sp-prompt-ok-${uid}`).onclick = () => finish(input.value);
    document.getElementById(`sp-prompt-cancel-${uid}`).onclick = () => finish(null);
    input.onkeydown = (e) => {
      if (e.key === 'Enter') finish(input.value);
      if (e.key === 'Escape') finish(null);
    };
  });
};

/**
 * Custom dialog with arbitrary HTML content, a title, and OK/Cancel buttons.
 * @param {string} title - Dialog title
 * @param {string} htmlContent - Custom HTML to render inside the dialog body
 * @param {string} okText - Text for the OK button (e.g. 'שמור')
 * @param {function} onOk - Callback when OK is clicked. Return true to close, false to keep open.
 * @param {boolean} wide - If true, make dialog wider
 */
window.spPromptDialog = function(title, htmlContent, okText, onOk, wide) {
  const overlay = document.createElement("div");
  overlay.className = "sp-sys-dialog-overlay";
  overlay.innerHTML = `
    <div class="sp-sys-dialog" style="${wide ? 'max-width:500px;' : ''}">
      <div class="sp-sys-dialog-msg" style="font-weight:700; font-size:1.1rem; margin-bottom:12px;">${title}</div>
      <div id="sp-prompt-dialog-body">${htmlContent}</div>
      <div class="sp-sys-dialog-btns" style="margin-top:15px;">
        <button class="sp-sys-btn sp-sys-btn-cancel" id="sp-pdlg-cancel">ביטול</button>
        <button class="sp-sys-btn sp-sys-btn-ok" id="sp-pdlg-ok">${okText || 'אישור'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add("show"), 10);
  
  const close = () => {
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 200);
  };
  
  document.getElementById("sp-pdlg-ok").onclick = () => {
    if (onOk) {
      const result = onOk();
      if (result !== false) close();
    } else {
      close();
    }
  };
  document.getElementById("sp-pdlg-cancel").onclick = close;
};

/**
 * Smart supplier rename confirmation dialog.
 * Asks the user whether to update future schedules only, all schedules, or none.
 * @param {string} origName - Original supplier name
 * @param {string} newName - New supplier name
 * @param {object} counts - { total, future, past }
 * @returns {Promise<'future'|'all'|'none'|null>}
 */
window.promptSupplierRenameScope = function(origName, newName, counts) {
  return new Promise(resolve => {
    const uid = ++window._spDialogUid;
    const overlay = document.createElement("div");
    overlay.className = "sp-sys-dialog-overlay";
    overlay.style.zIndex = "10050";

    const safeOrig = String(origName || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeNew = String(newName || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const total = counts ? (counts.total || 0) : 0;
    const future = counts ? (counts.future || 0) : 0;
    const past = counts ? (counts.past || 0) : 0;

    overlay.innerHTML = `
      <div class="sp-sys-dialog" style="max-width: 520px; width: 92%; padding: 22px; text-align: right; direction: rtl; gap: 14px;">
        <div style="display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;">
          <div style="font-size: 2rem; line-height: 1;">🔄</div>
          <div>
            <div style="font-weight: 700; font-size: 1.15rem; color: #1e293b;">שינוי שם ספק בלוח</div>
            <div style="font-size: 0.88rem; color: #64748b; margin-top: 2px;">
              מעבר מ-<strong>${safeOrig}</strong> ל-<strong>${safeNew}</strong>
            </div>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 0.88rem; line-height: 1.5; color: #334155;">
          <div style="font-weight: 600; margin-bottom: 6px;">נמצאו <strong>${total}</strong> שיבוצים עבור ספק זה בשנת הלימודים הנוכחית:</div>
          <div style="display: flex; flex-wrap: wrap; gap: 14px; margin-top: 4px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #2563eb;"></span>
              <span>שיבוצים עתידיים (מהיום והלאה): <strong>${future}</strong></span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #94a3b8;"></span>
              <span>שיבוצים בעבר (היסטוריה): <strong>${past}</strong></span>
            </div>
          </div>
        </div>

        <div style="font-weight: 600; font-size: 0.95rem; color: #1e293b;">
          כיצד תרצה לעדכן את השיבוצים בלוח?
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button type="button" id="sp-rename-future-${uid}" class="sp-rename-opt-btn" style="
            background: #eff6ff; border: 2px solid #3b82f6; color: #1e3a8a;
          ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 700; font-size: 0.98rem; color: #1d4ed8;">📅 עדכן שיבוצים עתידיים בלבד</span>
              <span style="background: #2563eb; color: #fff; font-size: 0.78rem; font-weight: 700; padding: 2px 8px; border-radius: 999px;">${future} שיבוצים</span>
            </div>
            <div style="font-size: 0.82rem; color: #475569; margin-top: 5px; line-height: 1.4;">
              <strong>מומלץ להחלפת ספק באמצע שנה:</strong> כל השיבוצים שהתקיימו בעבר יישמרו בהיסטוריה ע"ש <strong>${safeOrig}</strong>, ורק השיבוצים מהיום והלאה יועברו ל-<strong>${safeNew}</strong>.
            </div>
          </button>

          <button type="button" id="sp-rename-all-${uid}" class="sp-rename-opt-btn" style="
            background: #faf5ff; border: 1.5px solid #a855f7; color: #581c87;
          ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 700; font-size: 0.98rem; color: #7e22ce;">🔄 עדכן את כל השיבוצים בשנה זו</span>
              <span style="background: #9333ea; color: #fff; font-size: 0.78rem; font-weight: 700; padding: 2px 8px; border-radius: 999px;">כל ${total} השיבוצים</span>
            </div>
            <div style="font-size: 0.82rem; color: #475569; margin-top: 5px; line-height: 1.4;">
              <strong>מתאים לתיקון כתיב / שינוי שם גורף:</strong> יעדכן את כל השיבוצים (עבר ועתיד) בשנת הלימודים הנוכחית לשם החדש.
            </div>
          </button>

          <button type="button" id="sp-rename-none-${uid}" class="sp-rename-opt-btn" style="
            background: #f8fafc; border: 1px solid #cbd5e1; color: #334155;
          ">
            <div style="font-weight: 600; font-size: 0.92rem; color: #334155;">
              📝 שמור פרטי כרטיס ספק בלבד (ללא שינוי שיבוצים)
            </div>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 3px; line-height: 1.35;">
              ישנה את פרטי הכרטיס בלבד. אף שיבוץ בלוח לא יושפע.
            </div>
          </button>
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
          <button type="button" class="sp-sys-btn sp-sys-btn-cancel" id="sp-rename-cancel-${uid}" style="font-size: 0.9rem; padding: 7px 18px;">ביטול</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("show"), 10);

    const finish = (choice) => {
      overlay.classList.remove("show");
      setTimeout(() => { overlay.remove(); resolve(choice); }, 200);
    };

    document.getElementById(`sp-rename-future-${uid}`).onclick = () => finish('future');
    document.getElementById(`sp-rename-all-${uid}`).onclick = () => finish('all');
    document.getElementById(`sp-rename-none-${uid}`).onclick = () => finish('none');
    document.getElementById(`sp-rename-cancel-${uid}`).onclick = () => finish(null);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(null);
    });
  });
};

