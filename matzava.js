/**
 * GanScheduler - Matzava Module (מצבה - מצבת תלמידים, מספרי ילדים ואלרגיות בצהרונים)
 * Completely isolated, modular, and non-intrusive.
 * Plug & play: can be attached or removed without affecting any other core modules.
 */

(function () {
  'use strict';

  // In-memory state for Matzava
  window.MATZAVA_STATE = {
    records: [],          // Kindergarten & After-school program records
    nutritionOnly: [],    // Nutrition only (הזנה בלבד) records
    schools: [],          // School classes & groups
    selectedCity: 'all',  // Active city filter
    searchQuery: '',      // Active search query
    filterType: 'all',    // 'all' | 'sterile' | 'homemeal' | 'merged'
    subTab: 'gardens',    // 'gardens' | 'schools' | 'nutrition'
    lastSync: null,
    isLoading: false,
    loadedYear: null
  };

  function getSafeRole() {
    try {
      if (window.userRole) return window.userRole;
      if (window.role) return window.role;
      if (window._safeLS && typeof window._safeLS.getItem === 'function') {
        const r = window._safeLS.getItem('gan_user_role');
        if (r) return r;
      }
      if (typeof localStorage !== 'undefined') {
        const r = localStorage.getItem('gan_user_role');
        if (r) return r;
      }
    } catch (e) {}
    return 'view';
  }

  function isMatzavaAdmin() {
    const role = getSafeRole();
    const isAdminRole = (role === 'admin');
    const isPerry = (window._fbUser && window._fbUser.uid === 'VW5FCIlBb9VS4Eo1BTKyCxq5xa03') || 
                    (window._fbUser && window._fbUser.email && window._fbUser.email.startsWith('perry@')) ||
                    (window.username === 'perry');
    return isAdminRole || isPerry;
  }

  function canEditMatzava() {
    return isMatzavaAdmin();
  }

  function getYearKey() {
    return window.CURRENT_YEAR || 'tashpaz';
  }

  // Helper to match garden ID using GanScheduler's active gardens
  function matchGarden(name, city) {
    if (!name) return null;
    const clean = (s) => (s || '')
      .replace(/["'״׳`]/g, '')
      .replace(/\s*\(?\s*חמ[״"']?ד\s*\)?\s*/gi, '')
      .replace(/\s*\(?\s*חנ[״"']?מ\s*\)?\s*/gi, '')
      .replace(/\s*\(?\s*מ[״"']?מד\s*\)?\s*/gi, '')
      .replace(/\s*\(?\s*מונטסורי\s*\)?\s*/gi, '')
      .replace(/\s*\(?\s*תורני\s*\)?\s*/gi, '')
      .replace(/\s*\(?\s*הדס\s*\)?\s*/gi, '')
      .replace(/\s*\(?\s*חב[״"']?ד\s*\)?\s*/gi, '')
      .replace(/^גן\s+/g, '')
      .replace(/[-_.,()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const cleanInput = clean(name);
    const cleanCity = clean(city);

    const allGardens = typeof window.AG === 'function' ? window.AG() : (window.GARDENS || []);
    for (const g of allGardens) {
      const gClean = clean(g.name);
      const gCity = clean(g.city);
      const sameCity = !cleanCity || gCity.includes(cleanCity) || cleanCity.includes(gCity) || (cleanCity === 'פתח תקוה' && gCity === 'פת') || (cleanCity === 'פת' && gCity.includes('פתח'));

      if (sameCity && (gClean === cleanInput || gClean.includes(cleanInput) || cleanInput.includes(gClean))) {
        return g;
      }
    }
    return null;
  }

  // Normalizer: ensures 10m/11m/total consistency across all records:
  // 1) For cities without breakdown (באר יעקב, ראש העין), populate all kids to 10-months column (kids10).
  // 2) Enforce strict mathematical consistency: kidsTotal is ALWAYS strictly (kids10 + kids11).
  function normalizeRecordsKids10(records) {
    if (!Array.isArray(records)) return;
    records.forEach(r => {
      if (!r) return;
      const k10 = Number(r.kids10) || 0;
      const k11 = Number(r.kids11) || 0;
      let total = Number(r.kidsTotal) || Number(r.kids) || 0;

      if (k10 === 0 && k11 === 0 && total > 0) {
        r.kids10 = total;
        r.kids11 = 0;
      } else {
        r.kids10 = k10;
        r.kids11 = k11;
      }

      r.kidsTotal = (Number(r.kids10) || 0) + (Number(r.kids11) || 0);

      if (Array.isArray(r.subGardens)) {
        r.subGardens.forEach(sub => {
          if (!sub) return;
          const sk10 = Number(sub.kids10) || 0;
          const sk11 = Number(sub.kids11) || 0;
          let subTot = Number(sub.kidsTotal) || 0;
          if (sk10 === 0 && sk11 === 0 && subTot > 0) {
            sub.kids10 = subTot;
            sub.kids11 = 0;
          } else {
            sub.kids10 = sk10;
            sub.kids11 = sk11;
          }
          sub.kidsTotal = (Number(sub.kids10) || 0) + (Number(sub.kids11) || 0);
        });
      }
    });
  }

  const RTDB_ROOT = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';

  async function getMatzavaAuthHeader() {
    let tok = null;
    if (typeof window._fbGetToken === 'function') {
      try { tok = await window._fbGetToken(); } catch (e) { }
    }
    if (!tok && window._fbUser) {
      try { tok = await window._fbUser.getIdToken(false); } catch (e) { }
    }
    if (!tok && window._cachedToken) {
      tok = window._cachedToken;
    }
    if (!tok && window._fbAuth && window._fbAuth.currentUser) {
      try { tok = await window._fbAuth.currentUser.getIdToken(true); } catch (e) { }
    }
    if (!tok && window._fbUser) {
      try { tok = await window._fbUser.getIdToken(true); } catch (e) { }
    }
    return tok ? '?auth=' + tok : '';
  }

  // Load data from Firebase Realtime Database (with instant LocalStorage fallback)
  window.loadMatzavaFromFirebase = async function (force = false, silent = false) {
    const y = getYearKey();
    if (!force && window.MATZAVA_STATE.loadedYear === y && (window.MATZAVA_STATE.records || []).length > 0 && (window.MATZAVA_STATE.schools || []).length > 0) {
      return;
    }

    // 1. Instant LocalStorage Load (0ms startup resilience)
    try {
      const localCached = window._safeLS ? window._safeLS.getItem('gan_matzava_' + y) : localStorage.getItem('gan_matzava_' + y);
      if (localCached && (!window.MATZAVA_STATE.records || window.MATZAVA_STATE.records.length === 0)) {
        const parsed = JSON.parse(localCached);
        if (parsed) {
          window.MATZAVA_STATE.records = Array.isArray(parsed.records) ? parsed.records : [];
          window.MATZAVA_STATE.nutritionOnly = Array.isArray(parsed.nutritionOnly) ? parsed.nutritionOnly : [];
          window.MATZAVA_STATE.schools = Array.isArray(parsed.schools) ? parsed.schools : [];
          window.MATZAVA_STATE.lastSync = parsed.lastSync || null;
          window.MATZAVA_STATE.loadedYear = y;
          normalizeRecordsKids10(window.MATZAVA_STATE.records);
        }
      }
    } catch(e) {}

    window.MATZAVA_STATE.isLoading = true;
    try {
      const authQ = await getMatzavaAuthHeader();
      const cb = (authQ ? '&' : '?') + 'cb=' + Date.now();
      const url = `${RTDB_ROOT}/matzava/${y}.json${authQ}${cb}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          window.MATZAVA_STATE.records = Array.isArray(data.records) ? data.records : Object.values(data.records || {});
          window.MATZAVA_STATE.nutritionOnly = Array.isArray(data.nutritionOnly) ? data.nutritionOnly : Object.values(data.nutritionOnly || {});
          window.MATZAVA_STATE.schools = Array.isArray(data.schools) ? data.schools : Object.values(data.schools || {});
          window.MATZAVA_STATE.lastSync = data.lastSync || null;
          normalizeRecordsKids10(window.MATZAVA_STATE.records);
          // Mirror to LocalStorage
          try {
            const cacheStr = JSON.stringify({
              records: window.MATZAVA_STATE.records,
              nutritionOnly: window.MATZAVA_STATE.nutritionOnly,
              schools: window.MATZAVA_STATE.schools,
              lastSync: window.MATZAVA_STATE.lastSync
            });
            if (window._safeLS) window._safeLS.setItem('gan_matzava_' + y, cacheStr);
            else localStorage.setItem('gan_matzava_' + y, cacheStr);
          } catch(e) {}
        } else if (!window.MATZAVA_STATE.records || window.MATZAVA_STATE.records.length === 0) {
          window.MATZAVA_STATE.records = [];
          window.MATZAVA_STATE.nutritionOnly = [];
          window.MATZAVA_STATE.schools = [];
          window.MATZAVA_STATE.lastSync = null;
        }
        if (force && !silent && window.showToast) {
          window.showToast('✅ נתוני מצבה עודכנו מהענן בהצלחה');
        }
      } else {
        console.warn('[Matzava] Load returned status:', res.status);
        if (force && !silent && window.showToast) {
          window.showToast('⚠️ שגיאה בטעינת נתונים מהענן: ' + res.status);
        }
      }
      window.MATZAVA_STATE.loadedYear = y;
    } catch (e) {
      console.warn('[Matzava] Load error:', e);
      if (force && !silent && window.showToast) {
        window.showToast('⚠️ שגיאת רשת בטעינת מצבה: ' + e.message);
      }
    } finally {
      window.MATZAVA_STATE.isLoading = false;
    }
  };

  // Automatic silent background cloud fetch on tab click (Stale-While-Revalidate)
  window.triggerSilentMatzavaSync = async function () {
    if (window.MATZAVA_STATE.isSilentSyncing) return;
    
    // Throttle: avoid spamming RTDB if called multiple times within 10 seconds
    const now = Date.now();
    if (window.MATZAVA_STATE._lastSilentSyncTime && (now - window.MATZAVA_STATE._lastSilentSyncTime < 10000)) {
      return;
    }
    
    window.MATZAVA_STATE.isSilentSyncing = true;
    try {
      // Force fetch fresh from RTDB silently (silent=true means 0 popups/toasts)
      await window.loadMatzavaFromFirebase(true, true);
      window.MATZAVA_STATE._lastSilentSyncTime = Date.now();

      // If Matzava view is currently open (modal or main panel), re-render seamlessly
      const modal = document.getElementById('matzava-modal');
      const isModalOpen = modal && modal.style.display !== 'none';
      const pMatzava = document.getElementById('p-matzava');
      const isPanelVisible = pMatzava && pMatzava.style.display !== 'none';

      if (isModalOpen || isPanelVisible) {
        const searchInput = document.getElementById('matzava-search-input');
        const wasSearchFocused = (document.activeElement === searchInput);
        const selStart = searchInput ? searchInput.selectionStart : null;
        const selEnd = searchInput ? searchInput.selectionEnd : null;

        const target = isModalOpen ? document.getElementById('matzava-modal-body') : pMatzava;
        await window.renderMatzavaTab(target);

        if (wasSearchFocused) {
          const newSearchInput = document.getElementById('matzava-search-input');
          if (newSearchInput) {
            newSearchInput.focus();
            if (selStart !== null && selEnd !== null) {
              newSearchInput.setSelectionRange(selStart, selEnd);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Matzava] Silent background sync error:', err);
    } finally {
      window.MATZAVA_STATE.isSilentSyncing = false;
    }
  };

  // Dedicated one-click refresh from cloud with active visual feedback for management and admin
  window.refreshMatzavaFromCloud = async function (btnEl) {
    let origHtml = '';
    if (btnEl) {
      origHtml = btnEl.innerHTML;
      btnEl.disabled = true;
      btnEl.innerHTML = '⏳ מרענן מהענן...';
      btnEl.style.opacity = '0.75';
    }
    if (window.showToast) window.showToast('⏳ מרענן נתוני מצבה מהענן...', 3000);

    try {
      await window.loadMatzavaFromFirebase(true);

      const modal = document.getElementById('matzava-modal');
      const modalBody = document.getElementById('matzava-modal-body');
      const isModalVisible = modal && modal.style.display !== 'none';
      const targetContainer = (isModalVisible && modalBody) ? modalBody : (document.getElementById('p-matzava') || modalBody);

      await window.renderMatzavaTab(targetContainer);

      if (window.showToast) {
        const total = (window.MATZAVA_STATE.records || []).length;
        const sch = (window.MATZAVA_STATE.schools || []).length;
        window.showToast(`✅ נתוני מצבה רועננו בהצלחה (${total} צהרונים, ${sch} קבוצות בתי ספר)`);
      }
    } catch (err) {
      console.error('[Matzava] Refresh error:', err);
      if (window.showToast) window.showToast('❌ שגיאה ברענון מהענן: ' + err.message);
    } finally {
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.innerHTML = origHtml;
        btnEl.style.opacity = '1';
      }
    }
  };

  window.toggleMatzavaAdminMenu = function (e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const dd = document.getElementById('matzava-admin-dropdown');
    if (!dd) return;
    const isShown = dd.style.display === 'block';
    dd.style.display = isShown ? 'none' : 'block';
  };

  document.addEventListener('click', function (e) {
    const wrap = document.getElementById('matzava-admin-tools-wrapper');
    if (wrap && !wrap.contains(e.target)) {
      const dd = document.getElementById('matzava-admin-dropdown');
      if (dd) dd.style.display = 'none';
    }
  });

  // Save data to Firebase Realtime Database (with LocalStorage mirror and Version Vault trigger)
  window.saveMatzavaToFirebase = async function () {
    if (!canEditMatzava()) {
      if (window.showToast) window.showToast('⚠️ מצב צפייה בלבד - אין הרשאת שמירה', 3000);
      return false;
    }
    const y = getYearKey();
    const payload = {
      records: window.MATZAVA_STATE.records,
      nutritionOnly: window.MATZAVA_STATE.nutritionOnly,
      schools: window.MATZAVA_STATE.schools,
      lastSync: new Date().toISOString(),
      updatedBy: (window._fbUser && (window._fbUser.displayName || window._fbUser.email)) || 'user'
    };

    // 1. LocalStorage Mirror Save
    try {
      const cacheStr = JSON.stringify(payload);
      if (window._safeLS) window._safeLS.setItem('gan_matzava_' + y, cacheStr);
      else localStorage.setItem('gan_matzava_' + y, cacheStr);
    } catch(e) {}

    // 2. Firebase RTDB Save
    try {
      const authQ = await getMatzavaAuthHeader();
      const url = `${RTDB_ROOT}/matzava/${y}.json${authQ}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      window.MATZAVA_STATE.lastSync = payload.lastSync;
      if (window.showToast) window.showToast('✅ נתוני מצבה נשמרו בענן ובלוקאל בהצלחה');

      // 3. Trigger Version Vault checkpoint check
      if (typeof window.checkVersionVaultSync === 'function') {
        window.checkVersionVaultSync();
      }
      return true;
    } catch (e) {
      console.error('[Matzava] Save error:', e);
      if (window.showToast) window.showToast('❌ שגיאה בשמירת מצבה בענן (הנתונים נשמרו מקומית בלבד): ' + e.message);
      return false;
    }
  };

  // Download isolated Matzava JSON
  window.exportMatzavaJSON = function () {
    const y = getYearKey();
    const data = {
      module: 'matzava',
      appVersion: window.APP_VERSION,
      year: y,
      exportedAt: new Date().toISOString(),
      records: window.MATZAVA_STATE.records || [],
      nutritionOnly: window.MATZAVA_STATE.nutritionOnly || [],
      schools: window.MATZAVA_STATE.schools || [],
      lastSync: window.MATZAVA_STATE.lastSync || null
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `גיבוי_מצבה_${y}_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    if (window.showToast) window.showToast('✅ קובץ JSON של מצבה הורד בהצלחה');
  };

  // Import isolated Matzava JSON
  window.importMatzavaJSON = function (fileInput) {
    if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async function (e) {
      try {
        const parsed = JSON.parse(e.target.result);
        const data = parsed.matzava || parsed;
        if (!data || (!Array.isArray(data.records) && !Array.isArray(data.schools) && !Array.isArray(data.nutritionOnly))) {
          throw new Error('הקובץ אינו מכיל מבנה נתוני מצבה תקין');
        }
        window.MATZAVA_STATE.records = Array.isArray(data.records) ? data.records : [];
        window.MATZAVA_STATE.nutritionOnly = Array.isArray(data.nutritionOnly) ? data.nutritionOnly : [];
        window.MATZAVA_STATE.schools = Array.isArray(data.schools) ? data.schools : [];
        window.MATZAVA_STATE.lastSync = new Date().toISOString();

        await window.saveMatzavaToFirebase();
        window.renderMatzavaTab();
        if (window.showToast) window.showToast('✅ גיבוי JSON של מצבה שוחזר ונשמר בהצלחה!');
      } catch (err) {
        alert('❌ שגיאה בייבוא JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Bulletproof cell text extractor for ExcelJS: handles RichText, formula results, hyperlinks,
  // shared formulas, errors, and prevents "[object Object]" under all circumstances.
  function extractCleanCellText(cell) {
    if (!cell || cell.value === null || cell.value === undefined) return '';

    function unwrap(val) {
      if (val === null || val === undefined) return '';
      if (typeof val === 'string') {
        const s = val.trim();
        return (s === '[object Object]') ? '' : s;
      }
      if (typeof val === 'number' || typeof val === 'boolean') return String(val).trim();
      if (val instanceof Date) return val.toLocaleDateString('he-IL');

      if (typeof val === 'object') {
        // 1. Result of formula
        if (val.result !== undefined && val.result !== null) {
          const unwrappedResult = unwrap(val.result);
          if (unwrappedResult && unwrappedResult !== '[object Object]') return unwrappedResult;
        }
        // 2. Text / Hyperlink text
        if (val.text !== undefined && val.text !== null) {
          const unwrappedText = unwrap(val.text);
          if (unwrappedText && unwrappedText !== '[object Object]') return unwrappedText;
        }
        // 3. RichText array
        if (Array.isArray(val.richText)) {
          const rt = val.richText.map(t => (t && t.text) ? String(t.text) : '').join('').trim();
          if (rt && rt !== '[object Object]') return rt;
        }
        // 4. Formula or sharedFormula fallback
        if (val.formula || val.sharedFormula) {
          try {
            if (cell.text && typeof cell.text === 'string' && cell.text !== '[object Object]') {
              return cell.text.trim();
            }
          } catch (e) {}
          return '';
        }
        return '';
      }

      const s = String(val).trim();
      return (s === '[object Object]') ? '' : s;
    }

    const res = unwrap(cell.value);
    if (res && res !== '[object Object]') return res;

    try {
      if (cell.text && typeof cell.text === 'string' && cell.text !== '[object Object]') {
        return cell.text.trim();
      }
    } catch (e) {}

    return '';
  }

  // Parse a single XLSX buffer using ExcelJS
  window.parseMatzavaWorkbook = async function (arrayBuffer, fileName) {
    if (typeof window.ensureExcelJSLoaded === 'function' && typeof window.ExcelJS === 'undefined') {
      try { await window.ensureExcelJSLoaded(); } catch (e) {}
    }
    if (typeof window.ExcelJS === 'undefined') {
      throw new Error('ספריית ExcelJS לא נטענה');
    }

    const cleanFn = (fileName || '').replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '').trim();
    const wb = new window.ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);

    // Prefer worksheet named "הזמנה", "בתי ספר", or first sheet
    let ws = wb.getWorksheet('הזמנה') || wb.getWorksheet('בתי ספר') || wb.getWorksheet('בית ספר') || wb.worksheets[0];
    if (!ws) throw new Error('לא נמצא גיליון בקובץ ' + cleanFn);

    const rawRows = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        vals[colNumber - 1] = extractCleanCellText(cell);
      });
      rawRows.push(vals);
    });

    if (rawRows.length === 0) return { records: [], nutritionOnly: [], schools: [] };

    // Detect if this is a School file (by filename or sheet content)
    const fnLower = cleanFn.toLowerCase();
    const sheetNameLower = (ws.name || '').toLowerCase();
    const firstFewRowsText = rawRows.slice(0, 3).map(r => (r || []).join(' ')).join(' ');
    const isSchoolFile = fnLower.includes('בתי ספר') || fnLower.includes('בית ספר') || fnLower.includes('ביהס') || fnLower.includes('ביה"ס') ||
                         sheetNameLower.includes('בתי ספר') || sheetNameLower.includes('בית ספר') || firstFewRowsText.includes('בתי ספר') || firstFewRowsText.includes('בי"ס');

    // ───────────────────────────────────────────────────────────
    // A. SCHOOLS PARSER (Multi-section smart parser)
    // ───────────────────────────────────────────────────────────
    if (isSchoolFile) {
      const schools = [];
      const sectionHeaderIndices = [];
      for (let i = 0; i < rawRows.length; i++) {
        const joined = (rawRows[i] || []).join(' ');
        if (joined.includes('קבוצה') && (joined.includes('רשומים') || joined.includes('עיר'))) {
          sectionHeaderIndices.push(i);
        }
      }

      if (sectionHeaderIndices.length === 0) sectionHeaderIndices.push(0);

      for (let sIdx = 0; sIdx < sectionHeaderIndices.length; sIdx++) {
        const startRow = sectionHeaderIndices[sIdx];
        const endRow = (sIdx + 1 < sectionHeaderIndices.length) ? sectionHeaderIndices[sIdx + 1] : rawRows.length;
        const sectionRows = rawRows.slice(startRow, endRow);
        const header = sectionRows[0] || [];

        const colMap = { city: 0, addr: 1, name: 2, kids: 3, host: 4, notes: 6 };
        header.forEach((h, idx) => {
          if (!h) return;
          if (['קבוצה', 'כיתה'].some(k => h.includes(k))) colMap.name = idx;
          else if (h.includes('כתובת')) colMap.addr = idx;
          else if (h.includes('עיר')) colMap.city = idx;
          else if (h.includes('רשומים') && colMap.kids === undefined) colMap.kids = idx;
          else if (h.includes('איחוד')) colMap.host = idx;
          else if (['הערות', 'אלרגיות', 'רגישויות'].some(k => h.includes(k))) colMap.notes = idx;
        });

        // Scan Section metadata from Column A / B across section rows
        let secCity = '';
        let secSchool = '';
        let secAddr = '';

        for (const row of sectionRows) {
          const colA = (row[0] || '').trim();
          const colB = (row[1] || '').trim();
          for (const val of [colA, colB]) {
            if (!val) continue;
            if (!secCity && ['פ"ת', 'פתח תקווה', 'נס ציונה', 'ראש העין', 'גבעתיים', 'באר יעקב'].some(c => val.includes(c))) {
              secCity = val;
            } else if (!secSchool && (val.includes('בית ספר') || val.includes('בי"ס') || val.includes('ביהס') || val.includes('ביה"ס'))) {
              secSchool = val;
            } else if (!secAddr && (val.includes("רח'") || val.includes('רחוב') || val.includes('שד'))) {
              secAddr = val;
            }
          }
        }

        // Extract class / group rows
        for (let r = 1; r < sectionRows.length; r++) {
          const row = sectionRows[r];
          if (!row || row.length === 0) continue;
          const groupName = (row[colMap.name] || '').trim();
          if (!groupName) continue;
          if (['סה"כ', 'קבוצה', 'ממוצע', 'מס קב', 'בתי ספר'].some(k => groupName.includes(k))) continue;

          const kCount = parseInt(row[colMap.kids] || row[3], 10) || 0;
          const mCount = parseInt(row[colMap.host] || row[4], 10) || kCount;
          const sNotes = (row[colMap.notes] || row[6] || '').trim();

          const cleanCity = (secCity || 'בתי ספר').trim();
          const cleanSchool = (secSchool || 'בית ספר').trim();
          const cleanGroup = (groupName || 'קבוצה').trim();
          const schId = 'sch_' + cleanCity.replace(/[\s"'/\\()]/g, '_') + '_' + cleanSchool.replace(/[\s"'/\\()]/g, '_') + '_' + cleanGroup.replace(/[\s"'/\\()]/g, '_') + '_' + (startRow + r);

          schools.push({
            id: schId,
            city: cleanCity,
            school: cleanSchool,
            address: secAddr || '',
            groupName: cleanGroup,
            kids: kCount,
            mergedKids: mCount,
            notes: sNotes,
            isSterile: sNotes.includes('סטרילי') || sNotes.includes('שומשום') || sNotes.includes('אלרג'),
            isHomeMeal: sNotes.includes('מהבית'),
            sourceFile: cleanFn
          });
        }
      }

      return { records: [], nutritionOnly: [], schools };
    }

    // ───────────────────────────────────────────────────────────
    // B. KINDERGARTENS & NUTRITION ONLY PARSER
    // ───────────────────────────────────────────────────────────
    let city = '';
    if (fnLower.includes('גבעתיים')) city = 'גבעתיים';
    else if (fnLower.includes('פתח תקוו') || fnLower.includes('פ"ת')) city = 'פ"ת';
    else if (fnLower.includes('באר יעקב')) city = 'באר יעקב';
    else if (fnLower.includes('ראש העין')) city = 'ראש העין';

    let headerIdx = -1;
    const colMap = {};
    for (let i = 0; i < Math.min(rawRows.length, 7); i++) {
      const joined = (rawRows[i] || []).join(' ');
      if (['שם הגן', 'שם הצהרון', 'קבוצה', '10 חודשים', 'רשומים', 'רגישויות'].some(k => joined.includes(k))) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) {
      throw new Error('לא זוהתה שורת כותרת מתאימה ב-' + cleanFn);
    }

    const headers = rawRows[headerIdx];
    headers.forEach((h, idx) => {
      if (!h) return;
      if (h.includes('מס') && !h.includes('שם') && !h.includes('גן') && !h.includes('צהרון')) colMap.idx = idx;
      else if (['שם הגן', 'שם הצהרון', 'שם גן'].some(k => h.includes(k))) colMap.name = idx;
      else if (colMap.name === undefined && h.includes('קבוצה')) colMap.name = idx;
      else if (h.includes('כתובת') || h.includes('רחוב')) colMap.addr = idx;
      else if (h.includes('גיל')) colMap.age = idx;
      else if (h.includes('10 חודש')) colMap.kids10 = idx;
      else if (h.includes('11 חודש')) colMap.kids11 = idx;
      else if (h.includes('רשומים') && colMap.kids === undefined) colMap.kids = idx;
      else if (['סה"כ', 'סהכ', 'סך הכל'].some(k => h.includes(k))) colMap.total = idx;
      else if (h.includes('מתקיים ב') || h.includes('איחוד')) colMap.host = idx;
      else if (['הערות', 'רגישויות', 'אלרגיות'].some(k => h.includes(k))) colMap.notes = idx;
      else if (h.includes('עיר')) colMap.city = idx;
    });

    const rawGardenItems = [];
    const nutritionOnly = [];
    let isNutritionMode = false;

    for (let r = headerIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;
      const joined = row.join(' ');

      // Check for nutrition section header or explicit meal ordering row
      if (joined.includes('הזנה בלבד') && !joined.includes('הזמנת מזון') && !joined.includes('פטל') && !joined.includes('מורן')) {
        isNutritionMode = true;
        continue;
      }
      if (joined.includes('סה"כ ילדים') || joined.includes('סהכ ילדים') || joined.includes('ממוצע ל-') || joined.includes('שינויים במספרי')) {
        continue;
      }

      const isNutRow = isNutritionMode || joined.includes('הזמנת מזון') || joined.includes('מזון בלבד') || joined.includes('הזנה בלבד');

      // Handle Nutrition Only Mode (הזנה / תקשורת - מנות מזון בלבד, אינו נכלל בסה"כ ילדים)
      if (isNutRow) {
        let nutName = colMap.name !== undefined ? (row[colMap.name] || '') : '';
        if (!nutName || nutName === '[object Object]' || nutName.includes('object Object')) {
          const matchNut = row.find(c => ['פטל', 'מורן', 'רותם', 'צבעוני', 'ארז', 'תדהר'].some(k => (c || '').includes(k)));
          if (matchNut) nutName = matchNut;
        }
        if (nutName && nutName !== '[object Object]') {
          let count = 0;
          row.forEach(c => {
            const num = parseInt(c, 10);
            if (!isNaN(num) && num > 0 && num < 100) count = num;
          });
          const nutNotes = row.find(c => (c || '').includes('הזמנת מזון') || (c || '').includes('מזון') || (c || '').includes('צמחוני')) || '';
          const nutAddr = colMap.addr !== undefined ? (row[colMap.addr] || '') : (row[1] || '');
          const nutType = row.find(c => (c || '').includes('תקשורת') || (c || '').includes('חנ"מ') || (c || '').includes('חנמ')) || 'תקשורת / חנ"מ';

          nutritionOnly.push({
            id: 'nut_' + city + '_' + nutName.replace(/\s+/g, '_'),
            city: city,
            name: nutName,
            groupType: nutType,
            address: nutAddr,
            kidsTotal: count,
            notes: nutNotes,
            sourceFile: cleanFn
          });
        }
        continue;
      }

      // Kindergarten / After-School Garden
      let gName = colMap.name !== undefined ? (row[colMap.name] || '') : '';
      if (!gName || gName === '[object Object]' || gName.includes('object Object')) gName = '';
      if (!gName || gName.includes('סה"כ') || gName.includes('ממוצע')) continue;

      let rowSeq = colMap.idx !== undefined ? (row[colMap.idx] || '') : '';
      let gAddr = colMap.addr !== undefined ? (row[colMap.addr] || '') : '';
      let gAge = colMap.age !== undefined ? (row[colMap.age] || '') : '';
      let k10 = colMap.kids10 !== undefined ? (parseInt(row[colMap.kids10], 10) || 0) : 0;
      let k11 = colMap.kids11 !== undefined ? (parseInt(row[colMap.kids11], 10) || 0) : 0;
      let directKids = colMap.kids !== undefined ? (parseInt(row[colMap.kids], 10) || 0) : 0;
      let rowTotal = colMap.total !== undefined ? (parseInt(row[colMap.total], 10) || 0) : 0;

      // In cities where registration is not divided into 10 and 11 months (e.g. באר יעקב, ראש העין):
      // Assign the registered count into the 10-months column (kids10)
      if (colMap.kids10 === undefined && colMap.kids11 === undefined) {
        k10 = directKids || rowTotal || 0;
        k11 = 0;
      }
      let host = colMap.host !== undefined ? (row[colMap.host] || '') : '';
      let notes = colMap.notes !== undefined ? (row[colMap.notes] || '') : '';

      if (host === '[object Object]' || host.includes('object Object')) host = '';
      if (notes === '[object Object]' || notes.includes('object Object')) notes = '';

      // Defense: Ensure any food meal ordering or nutrition group never slips into regular kindergartens
      if (notes.includes('הזמנת מזון') || notes.includes('מזון בלבד') || gName.includes('הזנה בלבד')) {
        nutritionOnly.push({
          id: 'nut_' + city + '_' + (gName || 'קבוצה').replace(/\s+/g, '_'),
          city: city,
          name: gName,
          groupType: 'תקשורת / חנ"מ',
          address: gAddr,
          kidsTotal: (k10 + k11) || directKids || rowTotal,
          notes: notes,
          sourceFile: cleanFn
        });
        continue;
      }

      rawGardenItems.push({
        rowNum: r,
        seq: rowSeq,
        name: gName,
        addr: gAddr,
        age: gAge,
        k10: k10,
        k11: k11,
        directKids: directKids,
        rowTotal: rowTotal,
        host: host,
        notes: notes
      });
    }

    // Cluster raw gardens into unified classes (איחוד גנים) or standalone classes
    const records = [];
    const processedIndices = new Set();

    for (let i = 0; i < rawGardenItems.length; i++) {
      if (processedIndices.has(i)) continue;
      const item = rawGardenItems[i];

      const cluster = [item];
      processedIndices.add(i);

      // Check matching seq (same index in column A, e.g. 1, 5, 24)
      if (item.seq && /^\d+$/.test(item.seq)) {
        for (let j = i + 1; j < rawGardenItems.length; j++) {
          if (!processedIndices.has(j) && rawGardenItems[j].seq === item.seq) {
            cluster.push(rawGardenItems[j]);
            processedIndices.add(j);
          }
        }
      }

      // Check adjacent row when seq is blank but host references connect them
      for (let j = i + 1; j < rawGardenItems.length; j++) {
        if (processedIndices.has(j)) continue;
        const other = rawGardenItems[j];
        if (j === i + cluster.length) {
          const hostMatch = (other.host && item.name && other.host.includes(item.name)) ||
                            (item.host && other.name && item.host.includes(other.name)) ||
                            (other.host && item.host && other.host === item.host && (other.host.includes('איחוד') || other.host.length > 2));
          if (hostMatch) {
            cluster.push(other);
            processedIndices.add(j);
          }
        }
      }

      if (cluster.length === 1) {
        // Standalone independent garden
        const g = cluster[0];
        const kids = (g.k10 || g.k11) ? (g.k10 + g.k11) : (g.directKids || g.rowTotal);
        const finalKids10 = (g.k10 || g.k11) ? g.k10 : kids;
        const finalKids11 = g.k11 || 0;
        const isSterile = g.notes.includes('סטרילי') || g.notes.includes('אין להכניס') || g.notes.includes('שומשום') || g.notes.includes('אלרג');
        const isHomeMeal = g.notes.includes('מהבית');
        const matchedG = matchGarden(g.name, city);

        const safeName = (g.name && g.name !== '[object Object]' && !String(g.name).includes('object Object'))
          ? g.name
          : (matchedG ? matchedG.name : (g.host && g.host !== '[object Object]' ? g.host : 'גן'));

        records.push({
          id: 'mat_' + city + '_' + safeName.replace(/\s+/g, '_'),
          gardenId: matchedG ? matchedG.id : null,
          city: city,
          name: safeName,
          matchedName: matchedG ? matchedG.name : safeName,
          address: g.addr || (matchedG ? matchedG.st : ''),
          age: g.age || (matchedG ? matchedG.age : ''),
          kids10: finalKids10,
          kids11: finalKids11,
          kidsTotal: kids,
          hostGarden: (g.host && g.host !== '[object Object]' && !String(g.host).includes('object Object')) ? g.host : safeName,
          isMerged: false,
          subGardens: [],
          notes: g.notes,
          isSterile: isSterile,
          isHomeMeal: isHomeMeal,
          sourceFile: cleanFn,
          updatedAt: new Date().toISOString()
        });
      } else {
        // Multi-garden Unified Class (איחוד גנים - מוצג כשורה אחת ברורה עם פירוט הגנים שבאיחוד)
        let hostName = cluster.find(c => c.host && c.host !== '[object Object]' && !c.host.includes('object Object') && cluster.some(other => other.name && other.name.includes(c.host)))?.host || '';
        if (!hostName || hostName === '[object Object]' || hostName.includes('object Object')) {
          const foundHost = cluster.find(c => cluster.some(other => other.host && other.host !== '[object Object]' && other.host.includes(c.name)));
          if (foundHost) hostName = foundHost.name;
        }
        if (!hostName || hostName === '[object Object]' || hostName.includes('object Object')) {
          hostName = cluster.find(c => c.name && c.name !== '[object Object]')?.name || cluster[0].name;
        }

        const hostItem = cluster.find(c => c.name && c.name !== '[object Object]' && (c.name.includes(hostName) || hostName.includes(c.name))) || cluster[0];

        let sum10 = 0;
        let sum11 = 0;
        let sumKids = 0;
        const combinedNotes = [];
        let isSterile = false;
        let isHomeMeal = false;

        const subGardens = cluster.map(c => {
          let c10 = c.k10;
          let c11 = c.k11;
          const cKids = (c10 || c11) ? (c10 + c11) : (c.directKids || 0);
          if (!c10 && !c11 && cKids > 0) {
            c10 = cKids;
          }
          sum10 += c10;
          sum11 += c11;
          sumKids += cKids;
          const subSafeName = (c.name && c.name !== '[object Object]' && !String(c.name).includes('object Object')) ? c.name : 'גן';
          if (c.notes) {
            combinedNotes.push(`[${subSafeName}]: ${c.notes}`);
            if (c.notes.includes('סטרילי') || c.notes.includes('אין להכניס') || c.notes.includes('שומשום') || c.notes.includes('אלרג')) isSterile = true;
            if (c.notes.includes('מהבית')) isHomeMeal = true;
          }
          const matchedSub = matchGarden(subSafeName, city);
          return {
            name: subSafeName,
            role: (c.name === hostItem.name) ? 'מארח' : 'מתארח',
            gardenId: matchedSub ? matchedSub.id : null,
            kids10: c10,
            kids11: c11,
            kidsTotal: cKids,
            address: c.addr,
            notes: c.notes
          };
        });

        // Use cluster explicit rowTotal (if present, e.g. 27 or 35) or the sum of kids
        const explicitTotal = cluster.find(c => c.rowTotal > 0)?.rowTotal;
        const finalTotal = explicitTotal || sumKids;

        let cluster10 = sum10;
        let cluster11 = sum11;
        if (cluster11 === 0 && finalTotal > 0 && cluster10 < finalTotal) {
          cluster10 = finalTotal;
        }

        const safeHostItemName = (hostItem.name && hostItem.name !== '[object Object]' && !String(hostItem.name).includes('object Object')) 
          ? hostItem.name 
          : (cluster.find(c => c.name && c.name !== '[object Object]')?.name || 'איחוד גנים');

        const matchedG = matchGarden(safeHostItemName, city);

        records.push({
          id: 'mat_' + city + '_' + safeHostItemName.replace(/\s+/g, '_'),
          gardenId: matchedG ? matchedG.id : null,
          city: city,
          name: safeHostItemName,
          matchedName: matchedG ? matchedG.name : safeHostItemName,
          address: hostItem.addr || (matchedG ? matchedG.st : '') || cluster[0].addr,
          age: hostItem.age || (matchedG ? matchedG.age : '') || cluster[0].age,
          kids10: cluster10,
          kids11: cluster11,
          kidsTotal: finalTotal,
          hostGarden: safeHostItemName,
          isMerged: true,
          subGardens: subGardens,
          notes: combinedNotes.join(' | '),
          isSterile: isSterile,
          isHomeMeal: isHomeMeal,
          sourceFile: cleanFn,
          updatedAt: new Date().toISOString()
        });
      }
    }

    return { records, nutritionOnly, schools: [] };
  };

  // ───────────────────────────────────────────────────────────
  // FOLDER SCAN & REFRESH LOGIC (REUSABLE FOR LOCAL & REMOTE)
  // ───────────────────────────────────────────────────────────
  window.executeMatzavaFolderScan = async function (dirHandle, y, isRemote = false) {
    if (!dirHandle) throw new Error('Missing directory handle');
    if (window.showToast) {
      window.showToast(isRemote ? '📱 מבצע סריקת קבצים לפי פקודה מהסלולרי...' : '⏳ סורק קבצי מצבה בתיקייה...', 60000);
    }

    const scannedFiles = [];
    async function scanDirectory(handle) {
      for await (const entry of handle.values()) {
        const cleanName = entry.name.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '').trim();
        if (entry.kind === 'file' && cleanName.endsWith('.xlsx')) {
          if (!cleanName.startsWith('~$')) {
            scannedFiles.push(entry);
          }
        } else if (entry.kind === 'directory') {
          try {
            await scanDirectory(entry);
          } catch (eDir) {}
        }
      }
    }
    await scanDirectory(dirHandle);

    if (scannedFiles.length === 0) {
      if (window.showToast) window.showToast('⚠️ לא נמצאו קבצי Excel (.xlsx) בתיקייה הנבחרת');
      return { count: 0, totalFiles: 0, failedFiles: [] };
    }

    let allRecords = [];
    let allNutrition = [];
    let allSchools = [];
    let successCount = 0;
    const failedFiles = [];

    for (let i = 0; i < scannedFiles.length; i++) {
      const entry = scannedFiles[i];
      const cleanName = entry.name.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '').trim();
      if (window.showToast) {
        window.showToast(`⏳ קורא (${i + 1}/${scannedFiles.length}): ${cleanName}`, 30000);
      }
      try {
        const file = await entry.getFile();
        const buf = await file.arrayBuffer();
        const res = await window.parseMatzavaWorkbook(buf, entry.name);
        allRecords = allRecords.concat(res.records || []);
        allNutrition = allNutrition.concat(res.nutritionOnly || []);
        allSchools = allSchools.concat(res.schools || []);
        successCount++;
      } catch (err) {
        console.error(`[Matzava] Failed parsing ${entry.name}:`, err);
        let reason = err.message || 'שגיאה לא ידועה';
        if (err.name === 'NotReadableError' || reason.includes('could not be read') || reason.includes('locked')) {
          reason = 'הקובץ נעול (פתוח כעת ב-Excel במחשב)';
        }
        failedFiles.push(`${cleanName} (${reason})`);
      }
    }

    // Deduplicate records by city + name
    const recMap = new Map();
    allRecords.forEach(r => {
      const key = (r.city || '').trim() + '__' + (r.name || '').trim();
      recMap.set(key, r);
    });
    // Purge hosted sub-gardens so they never appear as separate standalone rows
    allRecords.forEach(r => {
      if (r.isMerged && Array.isArray(r.subGardens)) {
        r.subGardens.forEach(sub => {
          if (sub.name && sub.name !== r.name) {
            recMap.delete((r.city || '').trim() + '__' + (sub.name || '').trim());
          }
        });
      }
    });
    window.MATZAVA_STATE.records = Array.from(recMap.values());
    normalizeRecordsKids10(window.MATZAVA_STATE.records);

    const nutMap = new Map();
    allNutrition.forEach(n => {
      const key = (n.city || '') + '__' + (n.name || '');
      nutMap.set(key, n);
    });
    window.MATZAVA_STATE.nutritionOnly = Array.from(nutMap.values());

    const schMap = new Map();
    allSchools.forEach(s => {
      const key = (s.city || '') + '__' + (s.school || '') + '__' + (s.groupName || '') + '__' + (s.kids || 0) + '__' + (s.mergedKids || 0) + '__' + (s.notes || '');
      schMap.set(key, s);
    });
    window.MATZAVA_STATE.schools = Array.from(schMap.values());

    // Save to Firebase RTDB
    await window.saveMatzavaToFirebase();

    // Re-render local UI
    window.renderMatzavaTab();

    return {
      count: successCount,
      totalFiles: scannedFiles.length,
      failedFiles: failedFiles
    };
  };

  // Auto-refresh via File System Access API
  window.autoRefreshMatzava = async function () {
    if (!canEditMatzava()) {
      if (window.showToast) window.showToast('⚠️ רק מנהל או הנהלה יכולים לבצע רענון מצבה', 3000);
      return;
    }

    // If mobile or File System Access API is not available, automatically request refresh from PC!
    if (!window.showDirectoryPicker) {
      return window.requestMatzavaRefreshFromPC();
    }

    const y = getYearKey();
    const handleKey = 'matzavaDirHandle_' + y;
    let dirHandle = null;

    if (typeof window._spIdbGet === 'function') {
      try {
        dirHandle = await window._spIdbGet(handleKey);
      } catch (e) {}
    }

    // Check permissions or prompt
    let needPrompt = !dirHandle;
    if (dirHandle) {
      try {
        if ((await dirHandle.queryPermission({ mode: 'read' })) !== 'granted') {
          if ((await dirHandle.requestPermission({ mode: 'read' })) !== 'granted') {
            needPrompt = true;
          }
        }
      } catch (e) {
        needPrompt = true;
      }
    }

    if (needPrompt) {
      try {
        if (window.showToast) window.showToast('📁 אנא בחר את תיקיית מצבה (' + y + ')...', 8000);
        dirHandle = await window.showDirectoryPicker({
          id: 'matzava_picker_' + y,
          startIn: 'documents'
        });
        if (typeof window._spIdbSet === 'function') {
          await window._spIdbSet(handleKey, dirHandle);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error(err);
          if (window.showToast) window.showToast('❌ שגיאה בבחירת התיקייה: ' + err.message);
        }
        return;
      }
    }

    try {
      const res = await window.executeMatzavaFolderScan(dirHandle, y, false);
      if (!res) return;

      let msg = `✅ רענון מצבה הושלם!\nנסרקו בהצלחה ${res.count} מתוך ${res.totalFiles} קבצים:\n• ${window.MATZAVA_STATE.records.length} צהרונים\n• ${window.MATZAVA_STATE.nutritionOnly.length} קבוצות הזנה בלבד (מוצגות בבחירת העיר שלהן)\n• ${window.MATZAVA_STATE.schools.length} קבוצות בתי ספר`;
      if (res.failedFiles && res.failedFiles.length > 0) {
        msg += `\n\n⚠️ לא נקראו ${res.failedFiles.length} קבצים:\n• ${res.failedFiles.join('\n• ')}\n\n💡 אם הקובץ פתוח בתוכנת Excel במחשב, נא לסגור אותו וללחוץ שוב על "⚡ רענון אוטומטי".`;
      }

      if (typeof window.spAlert === 'function') {
        window.spAlert(msg);
      } else {
        alert(msg);
      }
    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast('❌ שגיאה בסריקת התיקייה: ' + e.message);
    }
  };

  // ───────────────────────────────────────────────────────────
  // MOBILE-TO-PC REMOTE REFRESH COMMAND CHANNEL
  // ───────────────────────────────────────────────────────────
  let _remotePollTimer = null;

  function renderRemoteSyncModal(cmdId) {
    let modal = document.getElementById('matzava-remote-sync-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'matzava-remote-sync-modal';
      document.body.appendChild(modal);
    }
    modal.style.cssText = 'position:fixed; inset:0; z-index:999999; background:rgba(15,23,42,0.7); display:flex; align-items:center; justify-content:center; padding:16px; direction:rtl; font-family:Assistant,sans-serif; backdrop-filter:blur(3px);';
    modal.innerHTML = `
      <div style="background:#fff; border-radius:16px; width:100%; max-width:380px; box-shadow:0 20px 40px rgba(0,0,0,0.3); overflow:hidden; border:1px solid #e2e8f0; text-align:center; padding:24px 20px;">
        <div id="mrsm-icon" style="font-size:3rem; margin-bottom:10px; animation:pulse 1.5s infinite;">📡</div>
        <h3 id="mrsm-title" style="margin:0 0 8px 0; color:#1a237e; font-size:1.15rem; font-weight:800;">בקשת רענון נשלחה למחשב</h3>
        <p id="mrsm-desc" style="font-size:0.88rem; color:#475569; margin:0 0 18px 0; line-height:1.4;">
          ממתין לתגובת אתר GanScheduler הפתוח במחשב המשרדי...
        </p>
        <div id="mrsm-progress" style="width:100%; height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden; margin-bottom:18px;">
          <div style="width:30%; height:100%; background:linear-gradient(90deg, #1a237e, #3949ab); border-radius:3px; animation:indeterminate 1.8s infinite ease-in-out;"></div>
        </div>
        <button id="mrsm-cancel-btn" onclick="window.closeRemoteSyncModal()" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; border-radius:8px; padding:8px 20px; font-size:0.85rem; font-weight:700; cursor:pointer;">
          ביטול
        </button>
      </div>
      <style>
        @keyframes indeterminate {
          0% { margin-right: 0%; width: 20%; }
          50% { margin-right: 40%; width: 50%; }
          100% { margin-right: 80%; width: 20%; }
        }
      </style>
    `;
  }

  window.closeRemoteSyncModal = function () {
    if (_remotePollTimer) {
      clearInterval(_remotePollTimer);
      _remotePollTimer = null;
    }
    const modal = document.getElementById('matzava-remote-sync-modal');
    if (modal) modal.remove();
  };

  function updateRemoteSyncModal(type, title, desc) {
    const iconEl = document.getElementById('mrsm-icon');
    const titleEl = document.getElementById('mrsm-title');
    const descEl = document.getElementById('mrsm-desc');
    const progEl = document.getElementById('mrsm-progress');
    const cancelBtn = document.getElementById('mrsm-cancel-btn');
    if (!titleEl) return;

    if (type === 'processing') {
      if (iconEl) iconEl.innerText = '🔄';
      titleEl.innerText = title || 'המחשב סורק קבצים...';
      if (descEl) descEl.innerText = desc || 'המחשב מעבד כעת את קבצי האקסל מהתיקייה המקומית.';
    } else if (type === 'completed') {
      if (iconEl) {
        iconEl.innerText = '✅';
        iconEl.style.animation = 'none';
      }
      titleEl.innerText = title || 'הרענון הושלם בהצלחה!';
      titleEl.style.color = '#2e7d32';
      if (descEl) descEl.innerText = desc || 'הנתונים החדשים נשמרו בענן ונטענים למסך כעת.';
      if (progEl) progEl.style.display = 'none';
      if (cancelBtn) cancelBtn.style.display = 'none';
      setTimeout(() => {
        window.closeRemoteSyncModal();
        if (window.showToast) window.showToast('✅ מצבה עודכנה בהצלחה מהמחשב!');
      }, 2000);
    } else if (type === 'error') {
      if (iconEl) {
        iconEl.innerText = '⚠️';
        iconEl.style.animation = 'none';
      }
      titleEl.innerText = title || 'לא התקבלה תגובה מהמחשב';
      titleEl.style.color = '#c62828';
      if (descEl) descEl.innerText = desc || 'וודא שהאתר פתוח בלשונית במחשב עם הרשאה לתיקיית המצבה.';
      if (progEl) progEl.style.display = 'none';
      if (cancelBtn) {
        cancelBtn.innerText = 'סגור';
        cancelBtn.style.background = '#1a237e';
        cancelBtn.style.color = '#fff';
      }
    }
  }

  function pollRemoteSyncStatus(cmdId, y) {
    if (_remotePollTimer) clearInterval(_remotePollTimer);
    let attempts = 0;
    const maxAttempts = 22; // ~44 seconds total

    _remotePollTimer = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(_remotePollTimer);
        _remotePollTimer = null;
        updateRemoteSyncModal('error', 'פסק זמן - המחשב לא הגיב', 'נא לוודא שאתר GanScheduler פתוח בלשונית פעילה במחשב המשרדי.');
        return;
      }

      try {
        const authQ = await getMatzavaAuthHeader();
        const cb = (authQ ? '&' : '?') + 'cb=' + Date.now();
        const url = `${RTDB_ROOT}/matzava/${y}/sync_command.json${authQ}${cb}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const cmd = await res.json();
        if (!cmd || cmd.id !== cmdId) return;

        if (cmd.status === 'processing') {
          updateRemoteSyncModal('processing', 'המחשב סורק קבצי Excel...', 'הסריקה מתבצעת כעת במחשב המשרדי.');
        } else if (cmd.status === 'completed') {
          clearInterval(_remotePollTimer);
          _remotePollTimer = null;
          updateRemoteSyncModal('completed', 'סריקת הקבצים הושלמה!', `נסרקו בהצלחה ${cmd.count || ''} קבצים והנתונים עלו לענן.`);
          // Reload fresh data from Firebase and re-render!
          await window.loadMatzavaFromFirebase(true, true);
          window.renderMatzavaTab();
        } else if (cmd.status === 'failed') {
          clearInterval(_remotePollTimer);
          _remotePollTimer = null;
          updateRemoteSyncModal('error', 'הסריקה במחשב נכשלה', cmd.error || 'אירעה שגיאה בקריאת הקבצים במחשב.');
        }
      } catch (e) {}
    }, 2000);
  }

  window.requestMatzavaRefreshFromPC = async function () {
    if (!canEditMatzava()) {
      if (window.showToast) window.showToast('⚠️ רק מנהל יכול לשלוח פקודת רענון למחשב', 3000);
      return;
    }
    const y = getYearKey();
    const cmdId = 'cmd_' + Date.now();
    const cmd = {
      id: cmdId,
      action: 'refresh',
      status: 'pending',
      requestedAt: Date.now(),
      requestedBy: (window._fbUser && (window._fbUser.displayName || window._fbUser.email)) || window.username || 'admin',
      year: y
    };

    renderRemoteSyncModal(cmdId);

    try {
      const authQ = await getMatzavaAuthHeader();
      const url = `${RTDB_ROOT}/matzava/${y}/sync_command.json${authQ}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
    } catch (e) {
      updateRemoteSyncModal('error', 'שגיאה בשליחת הפקודה', e.message);
      return;
    }

    pollRemoteSyncStatus(cmdId, y);
  };

  // ───────────────────────────────────────────────────────────
  // DESKTOP PC BACKGROUND LISTENER & EXECUTOR
  // ───────────────────────────────────────────────────────────
  let _lastHandledCmdId = null;
  let _pcRemoteListenerTimer = null;

  function showPcPermissionBanner(cmd, y) {
    let el = document.getElementById('matzava-pc-sync-banner');
    if (el) el.remove();

    el = document.createElement('div');
    el.id = 'matzava-pc-sync-banner';
    el.style.cssText = 'position:fixed; top:24px; left:50%; transform:translateX(-50%); z-index:9999999; background:linear-gradient(135deg, #1a237e, #283593); color:#fff; padding:16px 24px; border-radius:14px; box-shadow:0 10px 35px rgba(0,0,0,0.35); direction:rtl; text-align:right; font-family:Assistant,sans-serif; display:flex; align-items:center; gap:16px; border:2px solid #5c6bc0; animation:slideDown 0.3s ease;';
    el.innerHTML = `
      <div style="font-size:2rem;">📱</div>
      <div>
        <div style="font-weight:800; font-size:1.05rem;">התקבלה בקשת רענון מצבה מהטלפון שלך!</div>
        <div style="font-size:0.82rem; opacity:0.9; margin-top:2px;">לחץ כאן כדי לאשר קריאת קבצים מתיקיית המחשב והעלאה לענן:</div>
      </div>
      <button id="matzava-confirm-pc-btn" style="background:#4caf50; color:#fff; border:none; padding:10px 18px; border-radius:8px; font-weight:800; font-size:0.9rem; cursor:pointer; box-shadow:0 3px 8px rgba(76,175,80,0.3); white-space:nowrap;">
        ⚡ אשר סריקה כעת
      </button>
      <button onclick="document.getElementById('matzava-pc-sync-banner').remove()" style="background:transparent; border:none; color:#fff; opacity:0.7; font-size:1.1rem; cursor:pointer; padding:4px;">✕</button>
    `;
    document.body.appendChild(el);

    document.getElementById('matzava-confirm-pc-btn').onclick = async function () {
      this.disabled = true;
      this.innerText = '⏳ סורק...';
      try {
        await window.autoRefreshMatzava();
        const authQ = await getMatzavaAuthHeader();
        const url = `${RTDB_ROOT}/matzava/${y}/sync_command.json${authQ}`;
        await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed', completedAt: Date.now() })
        });
        if (el) el.remove();
      } catch (err) {
        alert('שגיאה בסריקה: ' + err.message);
      }
    };
  }

  async function handleRemoteRefreshOnPC(cmd, y) {
    console.log('[Matzava Remote PC] Received refresh command from mobile:', cmd);
    const authQ = await getMatzavaAuthHeader();
    const url = `${RTDB_ROOT}/matzava/${y}/sync_command.json${authQ}`;

    try {
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'processing', pickedUpAt: Date.now() })
      });
    } catch (e) {}

    if (window.showToast) {
      window.showToast('📱 התקבלה בקשת רענון מהסלולרי! מתחיל סריקה...', 5000);
    }

    const handleKey = 'matzavaDirHandle_' + y;
    let dirHandle = null;
    if (typeof window._spIdbGet === 'function') {
      try { dirHandle = await window._spIdbGet(handleKey); } catch (e) {}
    }

    let isGranted = false;
    if (dirHandle) {
      try {
        isGranted = (await dirHandle.queryPermission({ mode: 'read' })) === 'granted';
      } catch (e) {}
    }

    if (dirHandle && isGranted) {
      try {
        const res = await window.executeMatzavaFolderScan(dirHandle, y, true);
        await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'completed',
            completedAt: Date.now(),
            count: res.count || 0
          })
        });
        if (window.showToast) {
          window.showToast(`✅ רענון מהסלולרי הושלם בהצלחה (${res.count} קבצים)!`, 5000);
        }
      } catch (err) {
        console.error('[Matzava Remote PC] Error executing scan:', err);
        await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'failed', error: err.message })
        });
      }
    } else {
      showPcPermissionBanner(cmd, y);
    }
  }

  window.initMatzavaRemoteListener = function () {
    // Only desktop browsers with showDirectoryPicker support act as host scanners
    if (typeof window === 'undefined' || !window.showDirectoryPicker) return;
    if (_pcRemoteListenerTimer) return;

    const checkCommand = async () => {
      if (!canEditMatzava()) return;
      const y = getYearKey();
      try {
        const authQ = await getMatzavaAuthHeader();
        const cb = (authQ ? '&' : '?') + 'cb=' + Date.now();
        const url = `${RTDB_ROOT}/matzava/${y}/sync_command.json${authQ}${cb}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const cmd = await res.json();
        if (!cmd || cmd.status !== 'pending' || !cmd.id) return;
        if (cmd.id === _lastHandledCmdId) return;
        if (Date.now() - cmd.requestedAt > 120000) return;

        _lastHandledCmdId = cmd.id;
        handleRemoteRefreshOnPC(cmd, y);
      } catch (e) {}
    };

    _pcRemoteListenerTimer = setInterval(checkCommand, 5000);
    window.addEventListener('focus', checkCommand);
  };

  // Single file manual import
  window.importSingleMatzavaFile = function (fileInput) {
    if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
    const file = fileInput.files[0];
    if (window.showToast) window.showToast('⏳ מייבא קובץ מצבה: ' + file.name + '...', 30000);

    const reader = new FileReader();
    reader.onload = async function (e) {
      try {
        const res = await window.parseMatzavaWorkbook(e.target.result, file.name);

        // Merge with existing state
        const recMap = new Map(window.MATZAVA_STATE.records.map(r => [(r.city || '') + '__' + (r.name || ''), r]));
        res.records.forEach(r => {
          recMap.set((r.city || '') + '__' + (r.name || ''), r);
          // If this record is a merged group, clean up any hosted sub-gardens so they do not remain as duplicate standalone rows
          if (r.isMerged && Array.isArray(r.subGardens)) {
            r.subGardens.forEach(sub => {
              if (sub.name !== r.name) {
                recMap.delete((r.city || '') + '__' + sub.name);
              }
            });
          }
        });
        window.MATZAVA_STATE.records = Array.from(recMap.values());

        const nutMap = new Map(window.MATZAVA_STATE.nutritionOnly.map(n => [(n.city || '') + '__' + (n.name || ''), n]));
        res.nutritionOnly.forEach(n => nutMap.set((n.city || '') + '__' + (n.name || ''), n));
        window.MATZAVA_STATE.nutritionOnly = Array.from(nutMap.values());

        const schMap = new Map(window.MATZAVA_STATE.schools.map(s => [
          (s.city || '') + '__' + (s.school || '') + '__' + (s.groupName || '') + '__' + (s.kids || 0) + '__' + (s.mergedKids || 0) + '__' + (s.notes || ''),
          s
        ]));
        res.schools.forEach(s => {
          const key = (s.city || '') + '__' + (s.school || '') + '__' + (s.groupName || '') + '__' + (s.kids || 0) + '__' + (s.mergedKids || 0) + '__' + (s.notes || '');
          schMap.set(key, s);
        });
        window.MATZAVA_STATE.schools = Array.from(schMap.values());

        // Auto-switch to schools subTab if school file was imported
        if (res.schools.length > 0 && res.records.length === 0) {
          window.MATZAVA_STATE.subTab = 'schools';
        }

        await window.saveMatzavaToFirebase();
        window.renderMatzavaTab();

        if (window.showToast) {
          const parts = [];
          if (res.records.length > 0) parts.push(`${res.records.length} צהרונים`);
          if (res.nutritionOnly.length > 0) parts.push(`${res.nutritionOnly.length} הזנה בלבד`);
          if (res.schools.length > 0) parts.push(`${res.schools.length} קבוצות בתי ספר`);
          window.showToast(`✅ יובאו בהצלחה מ-${file.name}: ${parts.join(', ') || 'נתונים'}`);
        }
      } catch (err) {
        console.error(err);
        alert('שגיאה בקריאת הקובץ: ' + err.message);
      } finally {
        fileInput.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Export view to Excel with ExcelJS (RTL compliant, multi-tab support)
  window.exportMatzavaToExcel = async function () {
    if (typeof window.ExcelJS === 'undefined') {
      alert('ExcelJS לא נטען. נסה שוב בעוד מספר שניות.');
      return;
    }

    const filteredGardens = window.getFilteredMatzavaRecords();
    const filteredSchools = window.getFilteredSchoolsRecords();
    const filteredNutrition = window.getFilteredNutritionRecords();

    const wb = new window.ExcelJS.Workbook();
    wb.creator = 'טומשין קידס - מצבה';
    wb.created = new Date();

    // 1. Kindergarten Worksheet
    if (filteredGardens.length > 0) {
      const ws = wb.addWorksheet('צהרונים', {
        views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
      });

      ws.columns = [
        { header: 'עיר', key: 'city', width: 14 },
        { header: 'שם הצהרון / גן', key: 'name', width: 24 },
        { header: 'כתובת', key: 'address', width: 25 },
        { header: 'גיל', key: 'age', width: 10 },
        { header: '10 חודשים', key: 'kids10', width: 12 },
        { header: '11 חודשים', key: 'kids11', width: 12 },
        { header: 'סה"כ ילדים', key: 'kidsTotal', width: 14 },
        { header: 'מתקיים ב-', key: 'hostGarden', width: 20 },
        { header: 'סטטוס איחוד', key: 'mergedStatus', width: 15 },
        { header: 'הערות ואלרגיות', key: 'notes', width: 35 }
      ];

      const headerRow = ws.getRow(1);
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } };
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rightToLeft' };
      });

      let total10 = 0;
      let total11 = 0;
      let totalKids = 0;

      filteredGardens.forEach((r) => {
        total10 += (r.kids10 || 0);
        total11 += (r.kids11 || 0);
        totalKids += (r.kidsTotal || 0);

        const cleanBaseName = (r.name && r.name !== '[object Object]' && !String(r.name).includes('object Object'))
          ? r.name
          : (r.matchedName || r.hostGarden || 'צהרון');
        let nameDisplay = cleanBaseName;
        let statusDisplay = 'עצמאי';
        if (r.isMerged && Array.isArray(r.subGardens) && r.subGardens.length > 0) {
          statusDisplay = `מאוחד (${r.subGardens.length} גנים) ⚖️`;
          const breakdown = r.subGardens.map(s => {
            const sName = (s.name && s.name !== '[object Object]' && !String(s.name).includes('object Object')) ? s.name : 'גן';
            return `${s.role === 'מארח' ? '' : '↳ '}${sName}: ${s.kidsTotal}`;
          }).join(' | ');
          nameDisplay = `${cleanBaseName}\n(${breakdown})`;
        }

        const cleanHost = (r.hostGarden && r.hostGarden !== '[object Object]' && !String(r.hostGarden).includes('object Object')) ? r.hostGarden : cleanBaseName;

        const row = ws.addRow({
          city: r.city,
          name: nameDisplay,
          address: r.address || '',
          age: r.age || '',
          kids10: r.kids10 || '',
          kids11: r.kids11 || '',
          kidsTotal: r.kidsTotal || 0,
          hostGarden: r.isMerged ? `🏠 ${cleanHost}` : cleanHost,
          mergedStatus: statusDisplay,
          notes: r.notes || ''
        });

        row.eachCell((cell, colNum) => {
          cell.alignment = { horizontal: (colNum >= 5 && colNum <= 7) ? 'center' : 'right', vertical: 'middle', readingOrder: 'rightToLeft' };
          if (r.isSterile && colNum === 10) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
            cell.font = { color: { argb: 'FFC62828' }, bold: true };
          }
        });
      });

      const sumRow = ws.addRow({
        city: 'סה"כ',
        name: `${filteredGardens.length} גנים`,
        kids10: total10,
        kids11: total11,
        kidsTotal: totalKids
      });
      sumRow.height = 24;
      sumRow.eachCell((cell) => {
        cell.font = { bold: true, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rightToLeft' };
      });
    }

    // 2. Schools Worksheet
    if (filteredSchools.length > 0) {
      const wsSch = wb.addWorksheet('בתי ספר', {
        views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
      });

      wsSch.columns = [
        { header: 'עיר', key: 'city', width: 14 },
        { header: 'בית ספר', key: 'school', width: 22 },
        { header: 'קבוצה / כיתה', key: 'groupName', width: 20 },
        { header: 'כתובת', key: 'address', width: 25 },
        { header: 'רשומים', key: 'kids', width: 12 },
        { header: 'איחוד לקבוצה', key: 'mergedKids', width: 14 },
        { header: 'אלרגיות והערות', key: 'notes', width: 35 }
      ];

      const headerRowSch = wsSch.getRow(1);
      headerRowSch.height = 26;
      headerRowSch.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006064' } };
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rightToLeft' };
      });

      let schTotalKids = 0;
      filteredSchools.forEach((s) => {
        schTotalKids += (s.kids || 0);
        const row = wsSch.addRow({
          city: s.city,
          school: s.school || '',
          groupName: s.groupName || '',
          address: s.address || '',
          kids: s.kids || 0,
          mergedKids: s.mergedKids || s.kids || 0,
          notes: s.notes || ''
        });

        row.eachCell((cell, colNum) => {
          cell.alignment = { horizontal: (colNum >= 5 && colNum <= 6) ? 'center' : 'right', vertical: 'middle', readingOrder: 'rightToLeft' };
          if (s.isSterile && colNum === 7) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
            cell.font = { color: { argb: 'FFC62828' }, bold: true };
          }
        });
      });

      const schSumRow = wsSch.addRow({
        city: 'סה"כ',
        school: `${filteredSchools.length} קבוצות`,
        kids: schTotalKids
      });
      schSumRow.height = 24;
      schSumRow.eachCell((cell) => {
        cell.font = { bold: true, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F7FA' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rightToLeft' };
      });
    }

    // 3. Nutrition Worksheet (Scoped strictly to its specific city)
    if (s.selectedCity !== 'all' && filteredNutrition.length > 0) {
      const wsNut = wb.addWorksheet('הזנה בלבד', {
        views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
      });

      wsNut.columns = [
        { header: 'עיר', key: 'city', width: 14 },
        { header: 'שם הקבוצה', key: 'name', width: 22 },
        { header: 'סוג', key: 'groupType', width: 18 },
        { header: 'כתובת', key: 'address', width: 25 },
        { header: 'מנות מזון', key: 'kidsTotal', width: 14 },
        { header: 'הערות', key: 'notes', width: 35 }
      ];

      const headerRowNut = wsNut.getRow(1);
      headerRowNut.height = 26;
      headerRowNut.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE65100' } };
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rightToLeft' };
      });

      let nutTotalMeals = 0;
      filteredNutrition.forEach((n) => {
        nutTotalMeals += (n.kidsTotal || 0);
        const row = wsNut.addRow({
          city: n.city,
          name: n.name,
          groupType: n.groupType,
          address: n.address || '',
          kidsTotal: n.kidsTotal || 0,
          notes: n.notes || ''
        });

        row.eachCell((cell, colNum) => {
          cell.alignment = { horizontal: (colNum === 5) ? 'center' : 'right', vertical: 'middle', readingOrder: 'rightToLeft' };
        });
      });

      const nutSumRow = wsNut.addRow({
        city: 'סה"כ',
        name: `${filteredNutrition.length} קבוצות`,
        kidsTotal: nutTotalMeals
      });
      nutSumRow.height = 24;
      nutSumRow.eachCell((cell) => {
        cell.font = { bold: true, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rightToLeft' };
      });
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `מצבה_טומשין_${getYearKey()}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Filter logic for Kindergartens
  window.getFilteredMatzavaRecords = function () {
    const s = window.MATZAVA_STATE;
    normalizeRecordsKids10(s.records);
    let list = s.records || [];

    const curRole = getSafeRole();
    const isManagerRole = curRole === 'admin' || curRole === 'manager' || curRole === 'vp' || window.permAllCities || (Array.isArray(window.coordCities) && window.coordCities.includes('ALL'));

    if (!isManagerRole && curRole === 'coordinator') {
      // Coordinator view restriction by cities
      if (Array.isArray(window.coordCities) && window.coordCities.length > 0 && !window.coordCities.includes('ALL')) {
        list = list.filter(r => window.coordCities.some(c => (r.city || '').includes(c) || c.includes(r.city || '')));
      }

      // Coordinator view restriction by garden IDs (supports matching hosted sub-gardens)
      if (Array.isArray(window.coordGardenIds) && window.coordGardenIds.length > 0) {
        const gIds = window.coordGardenIds.map(String);
        list = list.filter(r => {
          if (r.gardenId && gIds.includes(String(r.gardenId))) return true;
          if (Array.isArray(r.subGardens) && r.subGardens.length > 0) {
            return r.subGardens.some(sub => sub.gardenId && gIds.includes(String(sub.gardenId)));
          }
          return false;
        });
      }
    }

    if (s.selectedCity && s.selectedCity !== 'all') {
      list = list.filter(r => {
        const c1 = (r.city || '').trim();
        const c2 = s.selectedCity.trim();
        if (c1 === c2) return true;
        if ((c1 === 'פ"ת' && c2.includes('פתח')) || (c1.includes('פתח') && c2 === 'פ"ת')) return true;
        return false;
      });
    }

    if (s.searchQuery) {
      const q = s.searchQuery.toLowerCase().trim();
      list = list.filter(r =>
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.address && r.address.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q)) ||
        (r.hostGarden && r.hostGarden.toLowerCase().includes(q)) ||
        (Array.isArray(r.subGardens) && r.subGardens.some(sub => sub.name && sub.name.toLowerCase().includes(q)))
      );
    }

    if (s.filterType === 'sterile') {
      list = list.filter(r => r.isSterile);
    } else if (s.filterType === 'homemeal') {
      list = list.filter(r => r.isHomeMeal);
    } else if (s.filterType === 'merged') {
      list = list.filter(r => r.isMerged);
    }

    return list;
  };

  // Filter logic for Schools
  window.getFilteredSchoolsRecords = function () {
    const s = window.MATZAVA_STATE;
    let list = s.schools || [];

    const curRole = getSafeRole();
    const isManagerRole = curRole === 'admin' || curRole === 'manager' || curRole === 'vp' || window.permAllCities || (Array.isArray(window.coordCities) && window.coordCities.includes('ALL'));

    if (!isManagerRole && curRole === 'coordinator') {
      if (Array.isArray(window.coordCities) && window.coordCities.length > 0 && !window.coordCities.includes('ALL')) {
        list = list.filter(sc => window.coordCities.some(c => (sc.city || '').includes(c) || c.includes(sc.city || '')));
      }
    }

    if (s.selectedCity && s.selectedCity !== 'all') {
      list = list.filter(sc => {
        const c1 = (sc.city || '').trim();
        const c2 = s.selectedCity.trim();
        if (c1 === c2) return true;
        if ((c1 === 'פ"ת' && c2.includes('פתח')) || (c1.includes('פתח') && c2 === 'פ"ת')) return true;
        return false;
      });
    }

    if (s.searchQuery) {
      const q = s.searchQuery.toLowerCase().trim();
      list = list.filter(sc =>
        (sc.school && sc.school.toLowerCase().includes(q)) ||
        (sc.groupName && sc.groupName.toLowerCase().includes(q)) ||
        (sc.address && sc.address.toLowerCase().includes(q)) ||
        (sc.notes && sc.notes.toLowerCase().includes(q)) ||
        (sc.city && sc.city.toLowerCase().includes(q))
      );
    }

    if (s.filterType === 'sterile') {
      list = list.filter(sc => sc.isSterile);
    } else if (s.filterType === 'homemeal') {
      list = list.filter(sc => sc.isHomeMeal);
    }

    return list;
  };

  // Filter logic for Nutrition Only (הזנה בלבד / תקשורת)
  // RULE: גני הזנה ותקשורת מוצגים אך ורק בעיר שלהם, ולעולם לא בסינון 'כל הערים'
  window.getFilteredNutritionRecords = function () {
    const s = window.MATZAVA_STATE;
    if (!s.selectedCity || s.selectedCity === 'all') {
      return [];
    }

    let list = s.nutritionOnly || [];

    const curRole = getSafeRole();
    const isManagerRole = curRole === 'admin' || curRole === 'manager' || curRole === 'vp' || window.permAllCities || (Array.isArray(window.coordCities) && window.coordCities.includes('ALL'));

    if (!isManagerRole && curRole === 'coordinator') {
      if (Array.isArray(window.coordCities) && window.coordCities.length > 0 && !window.coordCities.includes('ALL')) {
        list = list.filter(n => window.coordCities.some(c => (n.city || '').includes(c) || c.includes(n.city || '')));
      }
    }

    list = list.filter(n => {
      const c1 = (n.city || '').trim();
      const c2 = s.selectedCity.trim();
      if (c1 === c2) return true;
      if ((c1 === 'פ"ת' && c2.includes('פתח')) || (c1.includes('פתח') && c2 === 'פ"ת')) return true;
      return false;
    });

    if (s.searchQuery) {
      const q = s.searchQuery.toLowerCase().trim();
      list = list.filter(n =>
        (n.name && n.name.toLowerCase().includes(q)) ||
        (n.groupType && n.groupType.toLowerCase().includes(q)) ||
        (n.address && n.address.toLowerCase().includes(q)) ||
        (n.notes && n.notes.toLowerCase().includes(q)) ||
        (n.city && n.city.toLowerCase().includes(q))
      );
    }

    return list;
  };

  // ───────────────────────────────────────────────────────────
  // MOBILE CARDS RENDERERS (Clean, High-Density, Zero-Scroll)
  // ───────────────────────────────────────────────────────────
  function renderSingleGardenCardMobile(r) {
    const safeRowName = (r.name && r.name !== '[object Object]' && !String(r.name).includes('object Object')) 
      ? r.name 
      : (r.matchedName || r.hostGarden || 'צהרון');
    const safeHostGarden = (r.hostGarden && r.hostGarden !== '[object Object]' && !String(r.hostGarden).includes('object Object')) 
      ? r.hostGarden 
      : safeRowName;

    return `
      <div style="background:#fff; border-radius:10px; padding:10px 12px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.04); ${r.isMerged ? 'border-right:4px solid #8e24aa;' : (r.isSterile ? 'border-right:4px solid #ef4444;' : '')}">
        <!-- Top Row: Badges + Total Kids Pill -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap; margin-bottom:3px;">
              ${r.age ? `<span style="background:#e3f2fd; color:#1565c0; padding:1px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;">גיל ${r.age}</span>` : ''}
              ${r.isMerged ? `<span style="background:#f3e5f5; color:#6a1b9a; padding:1px 6px; border-radius:10px; font-size:0.68rem; font-weight:800;">⚖️ איחוד (${(r.subGardens || []).length})</span>` : ''}
              ${r.gardenId ? `<span title="קיים במאגר" style="font-size:0.72rem; color:#4caf50;">✓</span>` : ''}
            </div>
            <div style="font-size:1rem; font-weight:800; color:#1a237e; word-break:break-word; line-height:1.25;">
              ${safeRowName}
            </div>
          </div>

          <!-- Total Kids Badge -->
          <div style="background:${r.isMerged ? '#f3e5f5' : '#e8eaf6'}; border:1px solid ${r.isMerged ? '#ce93d8' : '#c5cae9'}; border-radius:8px; padding:4px 8px; text-align:center; min-width:50px; flex-shrink:0;">
            <div style="font-size:1.2rem; font-weight:900; color:${r.isMerged ? '#6a1b9a' : '#1a237e'}; line-height:1;">${(Number(r.kids10) || 0) + (Number(r.kids11) || 0)}</div>
            <div style="font-size:0.62rem; color:#555; font-weight:700;">ילדים</div>
          </div>
        </div>

        <!-- Address -->
        ${r.address ? `
          <div style="font-size:0.75rem; color:#64748b; margin-top:5px; line-height:1.3;">
            <span>📍 ${r.address}</span>
          </div>
        ` : ''}

        <!-- Merged Sub-gardens in Purple (if any) -->
        ${r.isMerged && Array.isArray(r.subGardens) && r.subGardens.length > 0 ? `
          <div style="margin-top:6px; padding:6px 8px; background:#faf5ff; border:1px dashed #d8b4fe; border-radius:6px; display:flex; flex-direction:column; gap:3px;">
            <div style="font-size:0.68rem; font-weight:700; color:#6a1b9a;">פירוט גנים באיחוד:</div>
            ${r.subGardens.map(sub => `
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#6a1b9a;">
                <span>${sub.role === 'מארח' ? '🏠' : '↳'} <b>${sub.name}</b></span>
                <span style="font-weight:700; color:#4a148c;">${sub.kidsTotal} ילדים</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Allergy Alert Banner / Notes -->
        ${r.isSterile ? `
          <div style="background:#ffebee; color:#c62828; border:1px solid #ffcdd2; border-radius:6px; padding:5px 8px; font-size:0.75rem; font-weight:700; line-height:1.35; margin-top:6px;">
            🚨 ${r.notes}
          </div>
        ` : (r.notes ? `
          <div style="background:#f8fafc; color:#475569; border-radius:6px; padding:4px 8px; font-size:0.74rem; margin-top:5px; line-height:1.3;">
            ${r.isHomeMeal ? '🟡 מנה מהבית | ' : '📝 '}${r.notes}
          </div>
        ` : '')}

      </div>
    `;
  }

  function renderGardensMobile(filteredGardens) {
    if (filteredGardens.length === 0) {
      return `
        <div style="background:#fff; border-radius:10px; padding:30px 15px; text-align:center; color:#999; border:1px solid #e2e8f0;">
          <div style="font-size:2rem; margin-bottom:6px;">📭</div>
          <div style="font-weight:700; font-size:0.95rem; color:#555;">לא נמצאו צהרונים התואמים לחיפוש / סינון</div>
        </div>
      `;
    }

    const cityMap = new Map();
    filteredGardens.forEach(r => {
      const cName = (r.city || 'כללי').trim();
      if (!cityMap.has(cName)) cityMap.set(cName, []);
      cityMap.get(cName).push(r);
    });

    const isSearching = !!(window.MATZAVA_STATE.searchQuery && window.MATZAVA_STATE.searchQuery.trim());
    const isSingleCitySelected = window.MATZAVA_STATE.selectedCity !== 'all';
    const shouldOpen = isSearching || (isSingleCitySelected && cityMap.size === 1);

    const toolbar = cityMap.size > 1 ? `
      <div style="display:flex; gap:8px; margin-bottom:10px; justify-content:flex-start; flex-wrap:wrap;">
        <button class="btn bg" onclick="document.querySelectorAll('.matzava-city-accordion').forEach(el=>el.setAttribute('open',''))" style="font-size:0.75rem; padding:4px 10px; font-weight:700; background:#1a237e; color:#fff; border:none; border-radius:6px; cursor:pointer;">🔽 פרוס הכל</button>
        <button class="btn" onclick="document.querySelectorAll('.matzava-city-accordion').forEach(el=>el.removeAttribute('open'))" style="font-size:0.75rem; padding:4px 10px; font-weight:700; background:#fff; border:1px solid #cbd5e1; color:#475569; border-radius:6px; cursor:pointer;">🔼 כווץ הכל</button>
      </div>
    ` : '';

    const sortedCities = Array.from(cityMap.keys()).sort((a,b) => a.localeCompare('he'));

    const content = sortedCities.map(cityName => {
      const cityGardens = cityMap.get(cityName);
      let cityKidsTotal = 0;
      let cityMerged = 0;
      let citySterile = 0;
      cityGardens.forEach(r => {
        cityKidsTotal += ((Number(r.kids10) || 0) + (Number(r.kids11) || 0));
        if (r.isMerged) cityMerged++;
        if (r.isSterile) citySterile++;
      });

      return `
        <details class="city-accordion matzava-city-accordion" ${shouldOpen ? 'open' : ''} style="margin-bottom:10px; border:1px solid #cbd5e1; border-radius:10px; overflow:hidden; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,0.03);">
          <summary style="padding:10px 14px; background:#f8fafc; cursor:pointer; list-style:none; display:flex; justify-content:space-between; align-items:center; user-select:none; border-bottom:1px solid #e2e8f0;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex:1; margin-left:10px; flex-wrap:wrap; gap:6px;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:1.1rem;">🏙️</span>
                <span style="font-size:0.98rem; font-weight:800; color:#1a237e;">${cityName}</span>
                <span style="font-size:0.72rem; background:#e0e7ff; color:#3730a3; padding:1px 6px; border-radius:10px; font-weight:700;">${cityGardens.length} צהרונים</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px; font-size:0.75rem;">
                <span style="background:#e8eaf6; color:#1a237e; padding:2px 8px; border-radius:6px; font-weight:800;"><b>${cityKidsTotal.toLocaleString()}</b> ילדים</span>
                ${cityMerged > 0 ? `<span style="background:#f3e5f5; color:#6a1b9a; padding:2px 6px; border-radius:6px; font-weight:700;">⚖️ ${cityMerged}</span>` : ''}
                ${citySterile > 0 ? `<span style="background:#fee2e2; color:#b91c1c; padding:2px 6px; border-radius:6px; font-weight:800;">🚨 ${citySterile}</span>` : ''}
              </div>
            </div>
          </summary>
          <div class="city-accordion-content" style="padding:8px; display:flex; flex-direction:column; gap:8px; background:#f8fafc;">
            ${cityGardens.map(r => renderSingleGardenCardMobile(r)).join('')}
          </div>
        </details>
      `;
    }).join('');

    return toolbar + content;
  }

  function renderSchoolsMobile(filteredSchools) {
    if (filteredSchools.length === 0) {
      return `
        <div style="background:#fff; border-radius:10px; padding:30px 15px; text-align:center; color:#999; border:1px solid #b2ebf2;">
          <div style="font-size:2rem; margin-bottom:6px;">🏫</div>
          <div style="font-weight:700; font-size:0.95rem; color:#006064;">לא נמצאו קבוצות בתי ספר התואמות לחיפוש / סינון</div>
        </div>
      `;
    }

    const cityMap = new Map();
    filteredSchools.forEach(sc => {
      const cName = (sc.city || 'כללי').trim();
      if (!cityMap.has(cName)) cityMap.set(cName, new Map());
      const sMap = cityMap.get(cName);
      const schName = (sc.school || 'בית ספר').trim();
      if (!sMap.has(schName)) sMap.set(schName, []);
      sMap.get(schName).push(sc);
    });

    const isSearching = !!(window.MATZAVA_STATE.searchQuery && window.MATZAVA_STATE.searchQuery.trim());
    const isSingleCitySelected = window.MATZAVA_STATE.selectedCity !== 'all';
    const shouldOpen = isSearching || (isSingleCitySelected && cityMap.size === 1);

    const toolbar = cityMap.size > 1 ? `
      <div style="display:flex; gap:8px; margin-bottom:10px; justify-content:flex-start; flex-wrap:wrap;">
        <button class="btn bg" onclick="document.querySelectorAll('.matzava-city-accordion').forEach(el=>el.setAttribute('open',''))" style="font-size:0.75rem; padding:4px 10px; font-weight:700; background:#004d40; color:#fff; border:none; border-radius:6px; cursor:pointer;">🔽 פרוס הכל</button>
        <button class="btn" onclick="document.querySelectorAll('.matzava-city-accordion').forEach(el=>el.removeAttribute('open'))" style="font-size:0.75rem; padding:4px 10px; font-weight:700; background:#fff; border:1px solid #cbd5e1; color:#475569; border-radius:6px; cursor:pointer;">🔼 כווץ הכל</button>
      </div>
    ` : '';

    const content = Array.from(cityMap.entries()).map(([cityName, schObjMap]) => {
      let cityKids = 0;
      let cityMerged = 0;
      let cityClasses = 0;
      let citySterile = 0;
      schObjMap.forEach(classes => {
        classes.forEach(sc => {
          cityKids += (sc.kids || 0);
          cityMerged += (sc.mergedKids || sc.kids || 0);
          cityClasses++;
          if (sc.isSterile) citySterile++;
        });
      });

      return `
        <details class="city-accordion matzava-city-accordion" ${shouldOpen ? 'open' : ''} style="margin-bottom:10px; border:1px solid #cbd5e1; border-radius:10px; overflow:hidden; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,0.03);">
          
          <!-- Compact City Header -->
          <summary style="padding:10px 14px; background:#f4fbfb; cursor:pointer; list-style:none; display:flex; justify-content:space-between; align-items:center; user-select:none; border-bottom:1px solid #e0f2f1;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex:1; margin-left:10px; flex-wrap:wrap; gap:6px;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:1.15rem;">🏙️</span>
                <span style="font-size:0.98rem; font-weight:800; color:#004d40;">${cityName}</span>
                <span style="font-size:0.68rem; background:#e0f2f1; color:#004d40; padding:1px 6px; border-radius:8px; font-weight:700;">${schObjMap.size} מוסדות</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px; font-size:0.75rem;">
                <span style="background:#e0f2f1; color:#004d40; padding:2px 8px; border-radius:6px; font-weight:700;">
                  <b>${cityKids}</b> רשומים (${cityMerged} באיחוד)
                </span>
                ${citySterile > 0 ? `<span style="background:#ef5350; color:#fff; padding:2px 6px; border-radius:6px; font-weight:800; font-size:0.7rem;">🚨 ${citySterile}</span>` : ''}
              </div>
            </div>
          </summary>

          <!-- Schools List in City -->
          <div class="city-accordion-content" style="padding:8px; display:flex; flex-direction:column; gap:8px; background:#f8fafc;">
            ${Array.from(schObjMap.entries()).map(([schoolName, classes]) => {
              let schKidsTotal = 0;
              let schMergedTotal = 0;
              let schSterile = 0;
              let schAddress = '';

              classes.forEach(c => {
                schKidsTotal += (c.kids || 0);
                schMergedTotal += (c.mergedKids || c.kids || 0);
                if (c.isSterile) schSterile++;
                if (!schAddress && c.address) schAddress = c.address;
              });

              return `
                <div style="background:#fff; border-radius:8px; border:1px solid #b2dfdb; padding:8px 10px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                  
                  <!-- School Card Header -->
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px; margin-bottom:6px; padding-bottom:5px; border-bottom:1px solid #e0f2f1;">
                    <div>
                      <div style="font-size:0.92rem; font-weight:800; color:#004d40;">🏫 ${schoolName}</div>
                      ${schAddress ? `<div style="font-size:0.7rem; color:#64748b; margin-top:1px;">📍 ${schAddress}</div>` : ''}
                    </div>
                    <div style="background:#004d40; color:#fff; border-radius:6px; padding:2px 8px; text-align:center; flex-shrink:0;">
                      <div style="font-size:0.95rem; font-weight:900; color:#80cbc4; line-height:1;">${schKidsTotal}</div>
                      <div style="font-size:0.58rem; opacity:0.85;">(${schMergedTotal} באיחוד)</div>
                    </div>
                  </div>

                  <!-- Classes List -->
                  <div style="display:flex; flex-direction:column; gap:3px;">
                    ${classes.map(sc => `
                      <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 6px; border-radius:4px; font-size:0.76rem; background:${sc.isSterile ? '#fff5f5' : '#f8fafc'};">
                        <div style="display:flex; align-items:center; gap:5px; min-width:0; flex:1;">
                          <span style="font-weight:700; color:#004d40; background:#e0f2f1; padding:1px 5px; border-radius:4px; font-size:0.72rem;">${sc.groupName}</span>
                          ${sc.isSterile ? `<span style="color:#c62828; font-weight:700; font-size:0.68rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">🚨 ${sc.notes}</span>` : (sc.notes ? `<span style="color:#64748b; font-size:0.68rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sc.notes}</span>` : '')}
                        </div>
                        <div style="font-weight:700; color:#263238; font-size:0.8rem; margin-right:6px; white-space:nowrap;">
                          <b>${sc.kids}</b> <span style="font-size:0.68rem; color:#00695c;">(${sc.mergedKids || sc.kids})</span>
                        </div>
                      </div>
                    `).join('')}
                  </div>

                  <!-- School Footer Subtotal -->
                  <div style="margin-top:5px; padding-top:4px; border-top:1px dashed #b2dfdb; display:flex; justify-content:space-between; align-items:center; font-size:0.72rem; font-weight:800; color:#004d40;">
                    <span>סה"כ ${schoolName}:</span>
                    <span>${schKidsTotal} רשומים (${classes.length} כיתות) ${schSterile > 0 ? `<span style="color:#c62828;">(🚨 ${schSterile} אלרגיות)</span>` : ''}</span>
                  </div>

                </div>
              `;
            }).join('')}
          </div>

        </details>
      `;
    }).join('');

    return toolbar + content;
  }

  function renderNutritionMobile(filteredNutrition) {
    if (filteredNutrition.length === 0) {
      return `
        <div style="background:#fff; border-radius:10px; padding:30px 15px; text-align:center; color:#999; border:1px solid #ffe0b2;">
          <div style="font-size:2rem; margin-bottom:6px;">🥣</div>
          <div style="font-weight:700; font-size:0.95rem; color:#555;">לא נמצאו קבוצות הזנה בלבד לעיר זו</div>
        </div>
      `;
    }

    const cityMap = new Map();
    filteredNutrition.forEach(n => {
      const cName = (n.city || 'כללי').trim();
      if (!cityMap.has(cName)) cityMap.set(cName, []);
      cityMap.get(cName).push(n);
    });

    const isSearching = !!(window.MATZAVA_STATE.searchQuery && window.MATZAVA_STATE.searchQuery.trim());
    const isSingleCitySelected = window.MATZAVA_STATE.selectedCity !== 'all';
    const shouldOpen = isSearching || (isSingleCitySelected && cityMap.size === 1);

    const toolbar = cityMap.size > 1 ? `
      <div style="display:flex; gap:8px; margin-bottom:10px; justify-content:flex-start; flex-wrap:wrap;">
        <button class="btn bg" onclick="document.querySelectorAll('.matzava-city-accordion').forEach(el=>el.setAttribute('open',''))" style="font-size:0.75rem; padding:4px 10px; font-weight:700; background:#e65100; color:#fff; border:none; border-radius:6px; cursor:pointer;">🔽 פרוס הכל</button>
        <button class="btn" onclick="document.querySelectorAll('.matzava-city-accordion').forEach(el=>el.removeAttribute('open'))" style="font-size:0.75rem; padding:4px 10px; font-weight:700; background:#fff; border:1px solid #cbd5e1; color:#475569; border-radius:6px; cursor:pointer;">🔼 כווץ הכל</button>
      </div>
    ` : '';

    const content = Array.from(cityMap.entries()).map(([cityName, list]) => {
      let cityMealsTotal = 0;
      list.forEach(n => { cityMealsTotal += (n.kidsTotal || 0); });

      return `
        <details class="city-accordion matzava-city-accordion" ${shouldOpen ? 'open' : ''} style="margin-bottom:10px; border:1px solid #ffe0b2; border-radius:10px; overflow:hidden; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,0.03);">
          <summary style="padding:10px 14px; background:#fff8e1; cursor:pointer; list-style:none; display:flex; justify-content:space-between; align-items:center; user-select:none; border-bottom:1px solid #ffe0b2;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex:1; margin-left:10px; flex-wrap:wrap; gap:6px;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:1.15rem;">🥣</span>
                <span style="font-size:0.98rem; font-weight:800; color:#e65100;">${cityName}</span>
                <span style="font-size:0.68rem; background:#fff3e0; color:#e65100; padding:1px 6px; border-radius:8px; font-weight:700; border:1px solid #ffcc80;">${list.length} קבוצות</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px; font-size:0.75rem;">
                <span style="background:#fff3e0; color:#bf360c; padding:2px 8px; border-radius:6px; font-weight:800; border:1px solid #ffcc80;">
                  <b>${cityMealsTotal.toLocaleString()}</b> מנות
                </span>
              </div>
            </div>
          </summary>
          <div class="city-accordion-content" style="padding:8px; display:flex; flex-direction:column; gap:8px; background:#f8fafc;">
            ${list.map(n => `
              <div style="background:#fff; border-radius:10px; padding:10px 12px; border:1px solid #ffe0b2; box-shadow:0 1px 3px rgba(0,0,0,0.04); border-right:4px solid #e65100;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                  <div>
                    <div style="display:flex; align-items:center; gap:5px; margin-bottom:3px;">
                      <span style="background:#fff3e0; color:#e65100; border:1px solid #ffcc80; padding:1px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;">${n.groupType}</span>
                    </div>
                    <div style="font-size:0.95rem; font-weight:800; color:#e65100;">${n.name}</div>
                  </div>
                  <div style="background:#fff3e0; border:1px solid #ffcc80; border-radius:8px; padding:4px 8px; text-align:center; min-width:50px; flex-shrink:0;">
                    <div style="font-size:1.2rem; font-weight:900; color:#bf360c; line-height:1;">${n.kidsTotal}</div>
                    <div style="font-size:0.62rem; color:#e65100; font-weight:700;">מנות</div>
                  </div>
                </div>
                ${n.address ? `<div style="font-size:0.74rem; color:#64748b; margin-top:4px;">📍 ${n.address}</div>` : ''}
                ${n.notes ? `<div style="font-size:0.74rem; color:#475569; margin-top:4px; background:#fff8e1; padding:4px 8px; border-radius:4px;">📝 ${n.notes}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </details>
      `;
    }).join('');

    return toolbar + content;
  }

  // Desktop Table Renderers
  function renderSingleGardenRowDesktop(r, idx) {
    const bg = idx % 2 === 0 ? '#fff' : '#fcfcfc';
    const isSterileBg = r.isSterile ? 'background:#fff5f5;' : '';
    const rowBorder = r.isMerged ? 'border-right:4px solid #8e24aa;' : '';
    const safeRowName = (r.name && r.name !== '[object Object]' && !String(r.name).includes('object Object')) 
      ? r.name 
      : (r.matchedName || r.hostGarden || 'צהרון');
    const safeHostGarden = (r.hostGarden && r.hostGarden !== '[object Object]' && !String(r.hostGarden).includes('object Object')) 
      ? r.hostGarden 
      : safeRowName;

    return `
      <tr style="${isSterileBg || `background:${bg};`} ${rowBorder} border-bottom:1px solid #eee; transition:background 0.15s;" onmouseover="this.style.background='#f0f4c3'" onmouseout="this.style.background='${r.isSterile ? '#fff5f5' : bg}'">
        <td style="padding:10px 12px; font-weight:700; color:#1a237e; vertical-align:top;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span style="font-size:0.92rem; font-weight:800; color:#1a237e;">${safeRowName}</span>
            ${r.isMerged ? `
              <span style="background:#f3e5f5; color:#6a1b9a; border:1px solid #ce93d8; font-size:0.7rem; padding:1px 6px; border-radius:12px; font-weight:800; display:inline-flex; align-items:center; gap:3px;">
                ⚖️ איחוד (${(r.subGardens || []).length} גנים)
              </span>
            ` : ''}
            ${r.gardenId ? `<span title="מקושר למאגר צהרונים קיים (#${r.gardenId})" style="cursor:help; font-size:0.75rem; color:#4caf50;">✓</span>` : ''}
          </div>

          ${r.isMerged && Array.isArray(r.subGardens) && r.subGardens.length > 0 ? `
            <div style="margin-top:5px; display:flex; flex-direction:column; gap:3px;">
              ${r.subGardens.map(sub => {
                const safeSubName = (sub.name && sub.name !== '[object Object]' && !String(sub.name).includes('object Object')) ? sub.name : 'גן';
                const isHost = sub.role === 'מארח';
                return `
                  <div style="font-size:0.78rem; color:#6a1b9a; line-height:1.4; display:flex; align-items:center; gap:6px;">
                    <span style="font-size:0.75rem; opacity:0.8;">${isHost ? '🏠' : '↳'}</span>
                    <span style="font-weight:${isHost ? '700' : '600'}; color:#4a148c;">${safeSubName}</span>
                    <span style="font-weight:700; color:#6a1b9a; margin-right:auto;">${sub.kidsTotal} ילדים</span>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}
        </td>
        <td style="padding:10px 12px; color:#555; font-size:0.8rem; vertical-align:top;">${r.address || '-'}</td>
        <td style="padding:10px 12px; text-align:center; vertical-align:top;">
          <span style="background:#e3f2fd; color:#1565c0; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:bold;">${r.age || '-'}</span>
        </td>
        <td style="padding:10px 12px; text-align:center; color:#555; vertical-align:top;">${r.kids10 ? r.kids10 : '-'}</td>
        <td style="padding:10px 12px; text-align:center; color:#555; vertical-align:top;">${r.kids11 ? r.kids11 : '-'}</td>
        <td style="padding:10px 12px; text-align:center; font-weight:800; font-size:1.05rem; color:#1a237e; background:rgba(40,53,147,0.06); vertical-align:top;">
          ${(Number(r.kids10) || 0) + (Number(r.kids11) || 0)}
        </td>
        <td style="padding:10px 12px; vertical-align:top;">
          ${r.isMerged ? `
            <div style="color:#6a1b9a; font-size:0.82rem; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
              <span>🏠</span>
              <span>${safeHostGarden}</span>
            </div>
          ` : `<span style="color:#777; font-size:0.8rem;">${safeHostGarden}</span>`}
        </td>
        <td style="padding:10px 12px; vertical-align:top;">
          ${r.isSterile ? `
            <div style="background:#ffebee; color:#c62828; padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:700; margin-bottom:3px; display:inline-block; border:1px solid #ffcdd2; line-height:1.4;">
              🚨 ${r.notes}
            </div>
          ` : (r.notes ? `
            <div style="color:#444; font-size:0.78rem; line-height:1.4;">
              ${r.isHomeMeal ? '🟡 ' : ''}${r.notes}
            </div>
          ` : '<span style="color:#bbb;">-</span>')}
        </td>
      </tr>
    `;
  }

  function renderGardensDesktop(filteredGardens) {
    if (filteredGardens.length === 0) {
      return `
        <!-- KINDERGARTENS EMPTY TABLE -->
        <div style="background:#fff; border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid #e0e0e0; padding:50px 20px; text-align:center;">
          <div style="font-size:2.5rem; margin-bottom:8px;">📭</div>
          <div style="font-weight:700; font-size:1.1rem; color:#555;">לא נמצאו צהרונים התואמים לחיפוש / סינון</div>
        </div>
      `;
    }

    const cityMap = new Map();
    filteredGardens.forEach(r => {
      const cName = (r.city || 'כללי').trim();
      if (!cityMap.has(cName)) cityMap.set(cName, []);
      cityMap.get(cName).push(r);
    });

    const isSearching = !!(window.MATZAVA_STATE.searchQuery && window.MATZAVA_STATE.searchQuery.trim());
    const isSingleCitySelected = window.MATZAVA_STATE.selectedCity !== 'all';
    const shouldOpen = isSearching || (isSingleCitySelected && cityMap.size === 1);

    const toolbar = cityMap.size > 1 ? `
      <div style="display:flex; gap:8px; margin-bottom:12px; justify-content:flex-start; flex-wrap:wrap;">
        <button class="btn bg" onclick="document.querySelectorAll('.matzava-city-accordion').forEach(el=>el.setAttribute('open',''))" style="font-size:0.78rem; padding:6px 14px; font-weight:700; background:#1a237e; color:#fff; border:none; border-radius:6px; cursor:pointer;">🔽 פרוס הכל</button>
        <button class="btn" onclick="document.querySelectorAll('.matzava-city-accordion').forEach(el=>el.removeAttribute('open'))" style="font-size:0.78rem; padding:6px 14px; font-weight:700; background:#fff; border:1px solid #cbd5e1; color:#475569; border-radius:6px; cursor:pointer;">🔼 כווץ הכל</button>
      </div>
    ` : '';

    const sortedCities = Array.from(cityMap.keys()).sort((a,b) => a.localeCompare('he'));

    const content = sortedCities.map(cityName => {
      const cityGardens = cityMap.get(cityName);
      let sumCol10 = 0;
      let sumCol11 = 0;
      let sumColTotal = 0;
      let cityMerged = 0;
      let citySterile = 0;

      cityGardens.forEach(r => {
        const k10 = Number(r.kids10) || 0;
        const k11 = Number(r.kids11) || 0;
        sumCol10 += k10;
        sumCol11 += k11;
        sumColTotal += (k10 + k11);
        if (r.isMerged) cityMerged++;
        if (r.isSterile) citySterile++;
      });

      return `
        <details class="city-accordion matzava-city-accordion" ${shouldOpen ? 'open' : ''} style="margin-bottom:14px; border:1px solid #cbd5e1; border-radius:12px; overflow:hidden; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
          <summary style="padding:12px 18px; background:#f8fafc; cursor:pointer; list-style:none; display:flex; justify-content:space-between; align-items:center; user-select:none; border-bottom:1px solid #e2e8f0;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex:1; margin-left:14px; flex-wrap:wrap; gap:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:1.25rem;">🏙️</span>
                <span style="font-size:1.1rem; font-weight:800; color:#1a237e;">${cityName}</span>
                <span style="font-size:0.75rem; background:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-weight:700;">${cityGardens.length} צהרונים</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px; font-size:0.82rem; flex-wrap:wrap;">
                <span style="background:#e8eaf6; color:#1a237e; padding:3px 10px; border-radius:6px; font-weight:800;">סה"כ בעיר: <b>${sumColTotal.toLocaleString()}</b> ילדים</span>
                ${cityMerged > 0 ? `<span style="background:#f3e5f5; color:#6a1b9a; padding:3px 8px; border-radius:6px; font-weight:700;">⚖️ ${cityMerged} איחודים</span>` : ''}
                ${citySterile > 0 ? `<span style="background:#fee2e2; color:#b91c1c; padding:3px 8px; border-radius:6px; font-weight:800;">🚨 ${citySterile} אלרגיות</span>` : ''}
              </div>
            </div>
          </summary>
          <div class="city-accordion-content" style="padding:0; background:#fff;">
            <div style="overflow-x:auto;">
              <table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:right;">
                <thead>
                  <tr style="background:#1a237e; color:#fff; height:40px;">
                    <th style="padding:8px 12px; font-weight:700; min-width:160px;">שם הצהרון / גן</th>
                    <th style="padding:8px 12px; font-weight:700; min-width:140px;">כתובת</th>
                    <th style="padding:8px 12px; font-weight:700; text-align:center; width:60px;">גיל</th>
                    <th style="padding:8px 12px; font-weight:700; text-align:center; width:75px;">10 ח'</th>
                    <th style="padding:8px 12px; font-weight:700; text-align:center; width:75px;">11 ח'</th>
                    <th style="padding:8px 12px; font-weight:700; text-align:center; width:85px; background:#283593;">סה"כ</th>
                    <th style="padding:8px 12px; font-weight:700; min-width:130px;">מתקיים ב-</th>
                    <th style="padding:8px 12px; font-weight:700; min-width:220px;">הערות ואלרגיות</th>
                  </tr>
                </thead>
                <tbody>
                  ${cityGardens.map((r, idx) => renderSingleGardenRowDesktop(r, idx)).join('')}
                </tbody>
                <tfoot>
                  <tr style="background:#e8eaf6; font-weight:800; border-top:2px solid #1a237e; color:#1a237e; height:38px;">
                    <td style="padding:8px 12px; font-weight:800;" colspan="3">סה"כ בעיר ${cityName}: ${cityGardens.length} צהרונים</td>
                    <td style="padding:8px 12px; text-align:center; font-size:0.95rem; font-weight:800;">${sumCol10.toLocaleString()}</td>
                    <td style="padding:8px 12px; text-align:center; font-size:0.95rem; font-weight:800;">${sumCol11.toLocaleString()}</td>
                    <td style="padding:8px 12px; text-align:center; font-size:1.1rem; font-weight:900; color:#1a237e; background:rgba(40,53,147,0.12);">
                      ${sumColTotal.toLocaleString()}
                    </td>
                    <td style="padding:8px 12px;" colspan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </details>
      `;
    }).join('');

    return toolbar + content;
  }

  function renderSchoolsDesktop(filteredSchools) {
    if (filteredSchools.length === 0) {
      return `
        <div style="background:#fff; border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid #b2ebf2; padding:50px 20px; text-align:center;">
          <div style="font-size:2.5rem; margin-bottom:8px;">🏫</div>
          <div style="font-weight:700; font-size:1.1rem; color:#006064;">לא נמצאו קבוצות בתי ספר התואמות לחיפוש / סינון</div>
        </div>
      `;
    }

    const cityMap = new Map();
    filteredSchools.forEach(sc => {
      const cName = (sc.city || 'כללי').trim();
      if (!cityMap.has(cName)) cityMap.set(cName, new Map());
      const sMap = cityMap.get(cName);
      const schName = (sc.school || 'בית ספר').trim();
      if (!sMap.has(schName)) sMap.set(schName, []);
      sMap.get(schName).push(sc);
    });

    const isSearching = !!(window.MATZAVA_STATE.searchQuery && window.MATZAVA_STATE.searchQuery.trim());
    const isSingleCitySelected = window.MATZAVA_STATE.selectedCity !== 'all';
    const shouldOpen = isSearching || (isSingleCitySelected && cityMap.size === 1);

    const toolbar = cityMap.size > 1 ? `
      <div style="display:flex; gap:8px; margin-bottom:12px; justify-content:flex-start; flex-wrap:wrap;">
        <button class="btn bg" onclick="document.querySelectorAll('.matzava-city-accordion').forEach(el=>el.setAttribute('open',''))" style="font-size:0.78rem; padding:6px 14px; font-weight:700; background:#004d40; color:#fff; border:none; border-radius:6px; cursor:pointer;">🔽 פרוס הכל</button>
        <button class="btn" onclick="document.querySelectorAll('.matzava-city-accordion').forEach(el=>el.removeAttribute('open'))" style="font-size:0.78rem; padding:6px 14px; font-weight:700; background:#fff; border:1px solid #cbd5e1; color:#475569; border-radius:6px; cursor:pointer;">🔼 כווץ הכל</button>
      </div>
    ` : '';

    const content = Array.from(cityMap.entries()).map(([cityName, schObjMap]) => {
      let cityKids = 0;
      let cityMerged = 0;
      let cityClasses = 0;
      let citySterile = 0;
      schObjMap.forEach(classes => {
        classes.forEach(sc => {
          cityKids += (sc.kids || 0);
          cityMerged += (sc.mergedKids || sc.kids || 0);
          cityClasses++;
          if (sc.isSterile) citySterile++;
        });
      });

      return `
        <details class="city-accordion matzava-city-accordion" ${shouldOpen ? 'open' : ''} style="margin-bottom:16px; border:1px solid #cbd5e1; border-radius:12px; overflow:hidden; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
          
          <!-- CITY ACCENT HEADER -->
          <summary style="padding:12px 18px; background:#f4fbfb; cursor:pointer; list-style:none; display:flex; justify-content:space-between; align-items:center; user-select:none; border-bottom:1px solid #e0f2f1;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex:1; margin-left:14px; flex-wrap:wrap; gap:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:1.25rem;">🏙️</span>
                <span style="font-size:1.1rem; font-weight:800; color:#004d40;">${cityName}</span>
                <span style="font-size:0.75rem; background:#e0f2f1; color:#004d40; padding:2px 8px; border-radius:12px; font-weight:700;">
                  ${schObjMap.size} מוסדות חינוך
                </span>
              </div>
              <div style="display:flex; align-items:center; gap:8px; font-size:0.82rem; flex-wrap:wrap;">
                <span style="background:#e0f2f1; color:#004d40; padding:3px 10px; border-radius:6px; font-weight:800;">
                  סה"כ בעיר: <b style="font-size:0.95rem;">${cityKids.toLocaleString()}</b> רשומים (${cityMerged.toLocaleString()} באיחוד)
                </span>
                <span style="background:#fff; color:#004d40; border:1px solid #b2dfdb; padding:3px 8px; border-radius:6px; font-weight:700;">
                  ${cityClasses} כיתות
                </span>
                ${citySterile > 0 ? `
                  <span style="background:#fee2e2; color:#b91c1c; padding:3px 8px; border-radius:6px; font-weight:800;">
                    🚨 ${citySterile} אלרגיות
                  </span>
                ` : ''}
              </div>
            </div>
          </summary>

          <!-- SCHOOLS LIST WITHIN CITY -->
          <div class="city-accordion-content" style="padding:14px; display:flex; flex-direction:column; gap:14px; background:#f8fafc;">
            ${Array.from(schObjMap.entries()).map(([schoolName, classes]) => {
              let schKidsTotal = 0;
              let schMergedTotal = 0;
              let schSterile = 0;
              let schAddress = '';

              classes.forEach(c => {
                schKidsTotal += (c.kids || 0);
                schMergedTotal += (c.mergedKids || c.kids || 0);
                if (c.isSterile) schSterile++;
                if (!schAddress && c.address) schAddress = c.address;
              });

              return `
                <div style="background:#fff; border-radius:10px; border:1px solid #b2dfdb; box-shadow:0 2px 8px rgba(0,0,0,0.03); overflow:hidden;">
                  
                  <!-- School Card Header -->
                  <div style="background:#e0f2f1; padding:10px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-bottom:1px solid #b2dfdb;">
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span style="font-size:1.3rem;">🏫</span>
                      <div>
                        <span style="font-size:1.05rem; font-weight:800; color:#004d40;">${schoolName}</span>
                        ${schAddress ? `<span style="font-size:0.75rem; color:#546e7a; margin-right:8px; background:#fff; padding:2px 8px; border-radius:4px; border:1px solid #cfd8dc;">📍 ${schAddress}</span>` : ''}
                      </div>
                    </div>

                    <!-- School Totals Pills -->
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                      <div style="background:#004d40; color:#fff; padding:4px 12px; border-radius:6px; font-size:0.82rem; font-weight:700;">
                        סה"כ תלמידים: <b style="font-size:1.05rem; color:#80cbc4;">${schKidsTotal}</b>
                      </div>
                      <div style="background:#00695c; color:#fff; padding:4px 12px; border-radius:6px; font-size:0.82rem; font-weight:700;">
                        באיחוד: <b style="font-size:1.05rem; color:#b2dfdb;">${schMergedTotal}</b>
                      </div>
                      <div style="background:#fff; color:#004d40; border:1px solid #80cbc4; padding:4px 10px; border-radius:6px; font-size:0.82rem; font-weight:700;">
                        <b>${classes.length}</b> כיתות
                      </div>
                      ${schSterile > 0 ? `
                        <div style="background:#ffebee; color:#c62828; border:1px solid #ffcdd2; padding:4px 10px; border-radius:6px; font-size:0.8rem; font-weight:800;">
                          🚨 ${schSterile} אלרגיות
                        </div>
                      ` : ''}
                    </div>
                  </div>

                  <!-- School Classes Table -->
                  <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:right;">
                      <thead>
                        <tr style="background:#f4fbfb; color:#37474f; height:34px; border-bottom:1px solid #e0f2f1; font-size:0.8rem;">
                          <th style="padding:6px 14px; font-weight:700; width:180px;">קבוצה / כיתה</th>
                          <th style="padding:6px 14px; font-weight:700; text-align:center; width:110px;">רשומים בצהרון</th>
                          <th style="padding:6px 14px; font-weight:700; text-align:center; width:120px; background:rgba(0,105,92,0.06);">איחוד לקבוצה</th>
                          <th style="padding:6px 14px; font-weight:700;">אלרגיות והערות</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${classes.map((sc, idx) => {
                          const rowBg = idx % 2 === 0 ? '#fff' : '#fafafa';
                          const sterileStyle = sc.isSterile ? 'background:#fff5f5;' : `background:${rowBg};`;
                          return `
                            <tr style="${sterileStyle} border-bottom:1px solid #eef2f6; transition:background 0.15s;" onmouseover="this.style.background='#e0f2f1'" onmouseout="this.style.background='${sc.isSterile ? '#fff5f5' : rowBg}'">
                              <td style="padding:8px 14px; font-weight:700; color:#004d40;">
                                <span style="background:#e0f2f1; color:#004d40; padding:3px 8px; border-radius:5px; border:1px solid #b2dfdb; font-size:0.82rem;">
                                  ${sc.groupName}
                                </span>
                              </td>
                              <td style="padding:8px 14px; text-align:center; font-weight:800; font-size:0.95rem; color:#263238;">
                                ${sc.kids}
                              </td>
                              <td style="padding:8px 14px; text-align:center; font-weight:800; font-size:0.95rem; color:#00695c; background:rgba(0,105,92,0.04);">
                                ${sc.mergedKids || sc.kids}
                              </td>
                              <td style="padding:8px 14px;">
                                ${sc.isSterile ? `
                                  <div style="background:#ffebee; color:#c62828; padding:3px 8px; border-radius:5px; font-size:0.75rem; font-weight:700; display:inline-block; border:1px solid #ffcdd2;">
                                    🚨 ${sc.notes}
                                  </div>
                                ` : (sc.notes ? `
                                  <div style="color:#455a64; font-size:0.78rem;">
                                    ${sc.isHomeMeal ? '🟡 ' : ''}${sc.notes}
                                  </div>
                                ` : '<span style="color:#cfd8dc;">-</span>')}
                              </td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                      <tfoot>
                        <tr style="background:#f1f8f7; font-weight:800; border-top:2px solid #b2dfdb;">
                          <td style="padding:8px 14px; color:#004d40;">
                            סה"כ ${schoolName}:
                          </td>
                          <td style="padding:8px 14px; text-align:center; color:#004d40; font-size:1.05rem;">
                            ${schKidsTotal}
                          </td>
                          <td style="padding:8px 14px; text-align:center; color:#00695c; font-size:1.05rem; background:rgba(0,105,92,0.08);">
                            ${schMergedTotal}
                          </td>
                          <td style="padding:8px 14px; font-size:0.75rem; color:#546e7a;">
                            ${schSterile > 0 ? `⚠️ כולל ${schSterile} כיתות אלרגיה` : '✓ ללא התראות אלרגיה'}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </details>
      `;
    }).join('');

    return toolbar + content;
  }

  function renderNutritionDesktop(filteredNutrition) {
    if (filteredNutrition.length === 0) {
      return `
        <!-- NUTRITION ONLY TABLE -->
        <div style="background:#fff; border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid #ffe0b2; padding:50px 20px; text-align:center;">
          <div style="font-size:2.5rem; margin-bottom:8px;">🥣</div>
          <div style="font-weight:700; font-size:1.1rem; color:#555;">לא נמצאו קבוצות הזנה בלבד לעיר זו</div>
        </div>
      `;
    }

    const cityMap = new Map();
    filteredNutrition.forEach(n => {
      const cName = (n.city || 'כללי').trim();
      if (!cityMap.has(cName)) cityMap.set(cName, []);
      cityMap.get(cName).push(n);
    });

    const isSearching = !!(window.MATZAVA_STATE.searchQuery && window.MATZAVA_STATE.searchQuery.trim());
    const isSingleCitySelected = window.MATZAVA_STATE.selectedCity !== 'all';
    const shouldOpen = isSearching || (isSingleCitySelected && cityMap.size === 1);

    const toolbar = cityMap.size > 1 ? `
      <div style="display:flex; gap:8px; margin-bottom:12px; justify-content:flex-start; flex-wrap:wrap;">
        <button class="btn bg" onclick="document.querySelectorAll('.matzava-city-accordion').forEach(el=>el.setAttribute('open',''))" style="font-size:0.78rem; padding:6px 14px; font-weight:700; background:#e65100; color:#fff; border:none; border-radius:6px; cursor:pointer;">🔽 פרוס הכל</button>
        <button class="btn" onclick="document.querySelectorAll('.matzava-city-accordion').forEach(el=>el.removeAttribute('open'))" style="font-size:0.78rem; padding:6px 14px; font-weight:700; background:#fff; border:1px solid #cbd5e1; color:#475569; border-radius:6px; cursor:pointer;">🔼 כווץ הכל</button>
      </div>
    ` : '';

    const content = Array.from(cityMap.entries()).map(([cityName, list]) => {
      let cityMealsTotal = 0;
      list.forEach(n => { cityMealsTotal += (n.kidsTotal || 0); });

      return `
        <details class="city-accordion matzava-city-accordion" ${shouldOpen ? 'open' : ''} style="margin-bottom:14px; border:1px solid #ffe0b2; border-radius:12px; overflow:hidden; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
          <summary style="padding:12px 18px; background:#fff8e1; cursor:pointer; list-style:none; display:flex; justify-content:space-between; align-items:center; user-select:none; border-bottom:1px solid #ffe0b2;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex:1; margin-left:14px; flex-wrap:wrap; gap:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:1.25rem;">🥣</span>
                <span style="font-size:1.1rem; font-weight:800; color:#e65100;">${cityName}</span>
                <span style="font-size:0.75rem; background:#fff3e0; color:#e65100; padding:2px 8px; border-radius:12px; font-weight:700; border:1px solid #ffcc80;">
                  ${list.length} קבוצות
                </span>
              </div>
              <div style="display:flex; align-items:center; gap:8px; font-size:0.82rem;">
                <span style="background:#fff3e0; color:#bf360c; padding:3px 10px; border-radius:6px; font-weight:800; border:1px solid #ffcc80;">
                  סה"כ בעיר: <b>${cityMealsTotal.toLocaleString()}</b> מנות
                </span>
              </div>
            </div>
          </summary>
          <div class="city-accordion-content" style="padding:0; background:#fff;">
            <div style="overflow-x:auto;">
              <table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:right;">
                <thead>
                  <tr style="background:#e65100; color:#fff; height:40px;">
                    <th style="padding:8px 12px; font-weight:700; min-width:160px;">שם הקבוצה</th>
                    <th style="padding:8px 12px; font-weight:700; width:130px;">סוג קבוצה</th>
                    <th style="padding:8px 12px; font-weight:700; min-width:140px;">כתובת</th>
                    <th style="padding:8px 12px; font-weight:700; text-align:center; width:95px; background:#bf360c;">מנות מזון</th>
                    <th style="padding:8px 12px; font-weight:700; min-width:220px;">הערות</th>
                  </tr>
                </thead>
                <tbody>
                  ${list.map((n, idx) => {
                    const bg = idx % 2 === 0 ? '#fff' : '#fffbf7';
                    return `
                      <tr style="background:${bg}; border-bottom:1px solid #ffe0b2; transition:background 0.15s;" onmouseover="this.style.background='#fff3e0'" onmouseout="this.style.background='${bg}'">
                        <td style="padding:10px 12px; font-weight:800; color:#e65100;">${n.name}</td>
                        <td style="padding:10px 12px; color:#555;">
                          <span style="background:#fff3e0; color:#e65100; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:700; border:1px solid #ffcc80;">${n.groupType}</span>
                        </td>
                        <td style="padding:10px 12px; color:#555; font-size:0.8rem;">${n.address || '-'}</td>
                        <td style="padding:10px 12px; text-align:center; font-weight:800; font-size:1.05rem; color:#bf360c; background:rgba(230,81,0,0.06);">${n.kidsTotal}</td>
                        <td style="padding:10px 12px; color:#555; font-size:0.8rem;">${n.notes || '-'}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      `;
    }).join('');

    return toolbar + content;
  }

  // Main UI Render Function
  window.renderMatzavaTab = async function (targetEl) {
    if (window.permMatzava === false && window.role !== 'admin') {
      const container = targetEl || document.getElementById('matzava-modal-body') || document.getElementById('p-matzava');
      if (container) {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;font-size:1.1rem;font-weight:700">⛔ אין לך הרשאה לצפייה במצבה</div>';
      }
      return;
    }
    const modalBody = document.getElementById('matzava-modal-body');
    const isModalOpen = modalBody && (modalBody.offsetParent !== null || (document.getElementById('matzava-modal') && document.getElementById('matzava-modal').style.display !== 'none'));
    const container = targetEl || (isModalOpen ? modalBody : null) || document.getElementById('p-matzava') || modalBody;
    if (!container) return;

    if (!window.MATZAVA_STATE.loadedYear) {
      const y = getYearKey();
      try {
        const localCached = window._safeLS ? window._safeLS.getItem('gan_matzava_' + y) : localStorage.getItem('gan_matzava_' + y);
        if (localCached) {
          const parsed = JSON.parse(localCached);
          if (parsed && (parsed.records || parsed.schools)) {
            window.MATZAVA_STATE.records = Array.isArray(parsed.records) ? parsed.records : [];
            window.MATZAVA_STATE.nutritionOnly = Array.isArray(parsed.nutritionOnly) ? parsed.nutritionOnly : [];
            window.MATZAVA_STATE.schools = Array.isArray(parsed.schools) ? parsed.schools : [];
            window.MATZAVA_STATE.lastSync = parsed.lastSync || null;
            window.MATZAVA_STATE.loadedYear = y;
          }
        }
      } catch(e) {}
    }

    if (!window.MATZAVA_STATE.loadedYear) {
      container.innerHTML = `
        <div style="text-align:center; padding:60px 20px;">
          <div style="font-size:2rem; margin-bottom:12px;">⏳</div>
          <div style="font-size:1.1rem; color:#1a237e; font-weight:700;">טוען נתוני מצבה מהענן...</div>
        </div>
      `;
      await window.loadMatzavaFromFirebase(false, true);
    }

    const s = window.MATZAVA_STATE;
    const canEdit = canEditMatzava();
    const isMob = (typeof window.isMobileMode === 'function' ? window.isMobileMode() : (window.innerWidth <= 768));

    // Compute datasets
    const filteredGardens = window.getFilteredMatzavaRecords();
    const filteredSchools = window.getFilteredSchoolsRecords();
    const filteredNutrition = window.getFilteredNutritionRecords();

    // Scoped Nutrition Logic: nutrition/communication is strictly visible only for its specific city
    const isNutritionVisible = (s.selectedCity !== 'all' && filteredNutrition.length > 0);
    if (!isNutritionVisible && s.subTab === 'nutrition') {
      s.subTab = 'gardens';
    }
    if (!s.subTab) s.subTab = 'gardens';

    // Compute Gardens stats
    let totalKids = 0;
    let total10 = 0;
    let total11 = 0;
    let sterileCount = 0;
    let homeMealCount = 0;
    let mergedCount = 0;
    filteredGardens.forEach(r => {
      const k10 = Number(r.kids10) || 0;
      const k11 = Number(r.kids11) || 0;
      const rowSum = k10 + k11;
      r.kidsTotal = rowSum;
      totalKids += rowSum;
      total10 += k10;
      total11 += k11;
      if (r.isSterile) sterileCount++;
      if (r.isHomeMeal) homeMealCount++;
      if (r.isMerged) mergedCount++;
    });
    const avgKids = filteredGardens.length > 0 ? (totalKids / filteredGardens.length).toFixed(1) : 0;

    // Compute Schools stats
    let schTotalKids = 0;
    let schSterileCount = 0;
    const schoolsSet = new Set();
    filteredSchools.forEach(sc => {
      schTotalKids += (sc.kids || 0);
      if (sc.isSterile) schSterileCount++;
      if (sc.school) schoolsSet.add(sc.school);
    });

    // Compute Nutrition stats
    let nutTotalMeals = 0;
    filteredNutrition.forEach(n => {
      nutTotalMeals += (n.kidsTotal || 0);
    });

    // Available cities list from all 3 datasets
    const citiesSet = new Set();
    (s.records || []).forEach(r => { if (r.city) citiesSet.add(r.city.trim()); });
    (s.schools || []).forEach(sc => { if (sc.city) citiesSet.add(sc.city.trim()); });
    (s.nutritionOnly || []).forEach(n => { if (n.city) citiesSet.add(n.city.trim()); });
    const availableCities = Array.from(citiesSet).filter(Boolean).sort();

    let html = `
      <div class="matzava-wrapper" style="direction:rtl; font-family:'Assistant',sans-serif; padding:${isMob ? '6px 4px 85px 4px' : '12px'}; max-width:1440px; margin:0 auto; box-sizing:border-box; overflow-x:hidden;">
        
        <!-- TOP CONTROL BAR -->
        <div style="background:#fff; border-radius:${isMob ? '10px' : '12px'}; padding:${isMob ? '10px 12px' : '16px'}; box-shadow:0 2px 10px rgba(0,0,0,0.05); margin-bottom:${isMob ? '10px' : '16px'}; border:1px solid #e0e0e0;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:${isMob ? '8px' : '12px'}; margin-bottom:${isMob ? '8px' : '14px'};">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:${isMob ? '1.4rem' : '1.8rem'};">👶</span>
              <div>
                <h2 style="margin:0; font-size:${isMob ? '1.05rem' : '1.3rem'}; color:#1a237e; font-weight:800; display:flex; align-items:center; gap:6px;">
                  מצבה — מספרי ילדים ואלרגיות
                  <span style="font-size:0.7rem; background:#e8eaf6; color:#283593; padding:1px 6px; border-radius:10px; font-weight:700;">${getYearKey()}</span>
                </h2>
                <div style="font-size:0.72rem; color:#666; margin-top:2px;">
                  ${s.lastSync ? `סנכרון: ${new Date(s.lastSync).toLocaleDateString('he-IL')} ${new Date(s.lastSync).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}` : 'טרם נסרקו קבצים'}
                </div>
              </div>
            </div>

            <!-- ACTION BUTTONS -->
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              ${canEdit ? `
                <!-- ADMIN: DESKTOP VS MOBILE TAILORED CONTROLS -->
                ${!isMob ? `
                  <!-- DESKTOP ADMIN: DEDICATED PC FOLDER SCAN BUTTON + CLOUD REFRESH -->
                  <button class="btn" onclick="window.autoRefreshMatzava()" 
                    style="background:linear-gradient(135deg, #1b5e20, #2e7d32); color:#fff; border:none; border-radius:8px; font-weight:700; padding:8px 14px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; box-shadow:0 2px 6px rgba(46,125,50,0.25);" 
                    title="סריקת תיקיית קבצי המצבה המקומית במחשב ועדכון הענן">
                    ⚡ סריקת קבצים (מחשב)
                  </button>

                  <button class="btn" onclick="window.refreshMatzavaFromCloud(this)" 
                    style="background:#f1f5f9; color:#1e293b; border:1px solid #cbd5e1; border-radius:8px; font-weight:700; padding:8px 14px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer;" 
                    title="רענן תצוגה מהענן (סנכרון מיידי)">
                    🔄 רענן מהענן
                  </button>
                ` : `
                  <!-- MOBILE ADMIN: SINGLE UNIFIED REFRESH BUTTON -->
                  <button class="btn" onclick="window.refreshMatzavaFromCloud(this)" 
                    style="background:linear-gradient(135deg, #1565c0, #0d47a1); color:#fff; border:none; border-radius:8px; font-weight:700; padding:6px 12px; font-size:0.8rem; display:inline-flex; align-items:center; gap:5px; cursor:pointer; box-shadow:0 2px 6px rgba(21,101,192,0.25);" 
                    title="רענן נתוני מצבה מהענן">
                    🔄 רענן
                  </button>
                `}

                <!-- ADMIN TOOLS DROPDOWN -->
                <div style="position:relative; display:inline-block;" id="matzava-admin-tools-wrapper">
                  <button class="btn" onclick="window.toggleMatzavaAdminMenu(event)" 
                    style="background:#475569; color:#fff; border:none; border-radius:8px; font-weight:700; padding:${isMob ? '6px 10px' : '8px 14px'}; font-size:${isMob ? '0.78rem' : '0.85rem'}; display:inline-flex; align-items:center; gap:4px; cursor:pointer; box-shadow:0 2px 6px rgba(71,85,105,0.25);"
                    title="כלי ניהול">
                    ⚙️ כלים <span style="font-size:0.7rem;">▼</span>
                  </button>
                  <div id="matzava-admin-dropdown" style="display:none; position:absolute; left:0; top:calc(100% + 6px); background:#fff; border-radius:10px; box-shadow:0 8px 30px rgba(0,0,0,0.18); border:1px solid #cbd5e1; min-width:220px; z-index:99999; padding:6px; direction:rtl; text-align:right;">
                    
                    ${isMob ? `
                      <button onclick="window.toggleMatzavaAdminMenu(); window.requestMatzavaRefreshFromPC();" 
                        style="width:100%; text-align:right; background:transparent; border:none; padding:10px 12px; border-radius:6px; font-size:0.85rem; font-weight:700; color:#1a237e; display:flex; align-items:center; gap:8px; cursor:pointer;" 
                        onmouseover="this.style.background='#e8eaf6'" onmouseout="this.style.background='transparent'">
                        📡 בקש סריקת קבצים מהמחשב
                      </button>
                      <div style="height:1px; background:#e2e8f0; margin:4px 0;"></div>
                    ` : ''}

                    <label style="width:100%; text-align:right; background:transparent; border:none; padding:10px 12px; border-radius:6px; font-size:0.85rem; font-weight:700; color:#1565c0; display:flex; align-items:center; gap:8px; cursor:pointer; box-sizing:border-box; margin:0;" 
                      onmouseover="this.style.background='#e3f2fd'" onmouseout="this.style.background='transparent'">
                      📂 ייבוא קובץ אקסל
                      <input type="file" accept=".xlsx" style="display:none;" onchange="window.toggleMatzavaAdminMenu(); window.importSingleMatzavaFile(this);">
                    </label>

                    <div style="height:1px; background:#e2e8f0; margin:4px 0;"></div>

                    <button onclick="window.toggleMatzavaAdminMenu(); window.exportMatzavaToExcel();" 
                      style="width:100%; text-align:right; background:transparent; border:none; padding:10px 12px; border-radius:6px; font-size:0.85rem; font-weight:700; color:#00838f; display:flex; align-items:center; gap:8px; cursor:pointer;" 
                      onmouseover="this.style.background='#e0f7fa'" onmouseout="this.style.background='transparent'">
                      📊 ייצוא לאקסל מעוצב
                    </button>
                  </div>
                </div>
              ` : `
                <!-- FIELD & MANAGEMENT (NON-ADMIN): ONLY REFRESH BUTTON (+ EXCEL ON DESKTOP) -->
                <button class="btn" onclick="window.refreshMatzavaFromCloud(this)" 
                  style="background:linear-gradient(135deg, #1565c0, #0d47a1); color:#fff; border:none; border-radius:8px; font-weight:700; padding:${isMob ? '6px 12px' : '8px 16px'}; font-size:${isMob ? '0.8rem' : '0.85rem'}; display:inline-flex; align-items:center; gap:6px; cursor:pointer; box-shadow:0 2px 8px rgba(21,101,192,0.3); transition:all 0.2s;" 
                  title="רענן תצוגה מיידית מהענן">
                  🔄 רענן
                </button>
                ${!isMob ? `
                  <button class="btn" onclick="window.exportMatzavaToExcel()" 
                    style="background:#f1f5f9; color:#00838f; border:1px solid #cbd5e1; border-radius:8px; font-weight:700; padding:8px 14px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer;" 
                    title="ייצוא לאקסל מעוצב">
                    📊 ייצוא לאקסל
                  </button>
                ` : ''}
              `}
            </div>
          </div>

          <!-- FILTERS & SEARCH -->
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; background:#f8fafc; padding:${isMob ? '8px 10px' : '10px 14px'}; border-radius:8px; border:1px solid #e2e8f0;">
            <!-- City Dropdown -->
            <div style="display:flex; align-items:center; gap:5px; ${isMob ? 'flex:1; min-width:130px;' : ''}">
              <span style="font-size:0.8rem; font-weight:700; color:#1e293b;">עיר:</span>
              <select onchange="window.MATZAVA_STATE.selectedCity=this.value; window.renderMatzavaTab();" 
                style="width:100%; padding:${isMob ? '5px 8px' : '6px 10px'}; border-radius:6px; border:1px solid #cbd5e1; background:#fff; font-weight:700; font-size:0.82rem; outline:none; cursor:pointer;">
                <option value="all" ${s.selectedCity === 'all' ? 'selected' : ''}>🌍 כל הערים</option>
                ${availableCities.map(c => `
                  <option value="${c}" ${s.selectedCity === c ? 'selected' : ''}>${c}</option>
                `).join('')}
              </select>
            </div>

            <!-- Free Text Search -->
            <div style="flex:${isMob ? '1 1 100%' : '1'}; min-width:${isMob ? '100%' : '200px'}; position:relative;">
              <input type="text" id="matzava-search-input" placeholder="${s.subTab === 'schools' ? '🔍 חפש בית ספר, כיתה, אלרגיה...' : (s.subTab === 'nutrition' ? '🔍 חפש קבוצה, כתובת...' : '🔍 חפש גן, כתובת, אלרגיה...')}" 
                value="${s.searchQuery || ''}" 
                oninput="window.MATZAVA_STATE.searchQuery=this.value; window.renderMatzavaTab();" 
                style="width:100%; padding:6px 12px; border-radius:6px; border:1px solid #ccc; font-size:0.82rem; outline:none; box-sizing:border-box;">
              ${s.searchQuery ? `
                <span onclick="window.MATZAVA_STATE.searchQuery=''; window.renderMatzavaTab();" style="position:absolute; left:8px; top:6px; cursor:pointer; color:#999; font-weight:bold;">✕</span>
              ` : ''}
            </div>

            <!-- Category Pills (Horizontally scrollable on mobile to eliminate dead space!) -->
            <div style="display:flex; gap:6px; ${isMob ? 'width:100%; overflow-x:auto; white-space:nowrap; -webkit-overflow-scrolling:touch; padding:2px 0;' : 'flex-wrap:wrap;'}">
              <button onclick="window.MATZAVA_STATE.filterType='all'; window.renderMatzavaTab();" 
                style="padding:4px 10px; border-radius:14px; border:none; font-size:0.75rem; font-weight:700; cursor:pointer; flex-shrink:0; background:${s.filterType==='all' ? '#1a237e; color:#fff;' : '#e8eaf6; color:#1a237e;'}">
                הכל
              </button>
              <button onclick="window.MATZAVA_STATE.filterType='sterile'; window.renderMatzavaTab();" 
                style="padding:4px 10px; border-radius:14px; border:none; font-size:0.75rem; font-weight:700; cursor:pointer; flex-shrink:0; background:${s.filterType==='sterile' ? '#c62828; color:#fff;' : '#ffebee; color:#c62828;'}">
                🔴 סטרילי / אלרגיות (${s.subTab === 'schools' ? schSterileCount : sterileCount})
              </button>
              ${s.subTab === 'gardens' ? `
                <button onclick="window.MATZAVA_STATE.filterType='homemeal'; window.renderMatzavaTab();" 
                  style="padding:4px 10px; border-radius:14px; border:none; font-size:0.75rem; font-weight:700; cursor:pointer; flex-shrink:0; background:${s.filterType==='homemeal' ? '#f57f17; color:#fff;' : '#fffde7; color:#f57f17;'}">
                  🟡 מנה מהבית (${homeMealCount})
                </button>
                <button onclick="window.MATZAVA_STATE.filterType='merged'; window.renderMatzavaTab();" 
                  style="padding:4px 10px; border-radius:14px; border:none; font-size:0.75rem; font-weight:700; cursor:pointer; flex-shrink:0; background:${s.filterType==='merged' ? '#6a1b9a; color:#fff;' : '#f3e5f5; color:#6a1b9a;'}">
                  ⚖️ איחודים (${mergedCount})
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- ─────────────────────────────────────────────────────────── -->
        <!-- SECONDARY SMART SUB-TABS BAR -->
        <!-- ─────────────────────────────────────────────────────────── -->
        <div style="display:flex; align-items:center; gap:${isMob ? '4px' : '8px'}; margin-bottom:${isMob ? '10px' : '14px'}; border-bottom:2px solid #e2e8f0; padding-bottom:6px;">
          <button onclick="window.MATZAVA_STATE.subTab='gardens'; window.renderMatzavaTab();" 
            style="${isMob ? 'flex:1;' : ''} padding:${isMob ? '6px 8px' : '8px 16px'}; border-radius:8px; border:none; font-weight:800; font-size:${isMob ? '0.8rem' : '0.9rem'}; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:6px; transition:all 0.15s; ${s.subTab==='gardens' ? 'background:#1a237e; color:#fff; box-shadow:0 2px 6px rgba(26,35,126,0.3);' : 'background:#f1f5f9; color:#475569;'}">
            <span>🏡 צהרוני גנים</span>
            <span style="font-size:0.72rem; padding:1px 6px; border-radius:10px; font-weight:800; ${s.subTab==='gardens' ? 'background:rgba(255,255,255,0.25); color:#fff;' : 'background:#e2e8f0; color:#334155;'}">${filteredGardens.length}</span>
          </button>

          <button onclick="window.MATZAVA_STATE.subTab='schools'; window.renderMatzavaTab();" 
            style="${isMob ? 'flex:1;' : ''} padding:${isMob ? '6px 8px' : '8px 16px'}; border-radius:8px; border:none; font-weight:800; font-size:${isMob ? '0.8rem' : '0.9rem'}; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:6px; transition:all 0.15s; ${s.subTab==='schools' ? 'background:#006064; color:#fff; box-shadow:0 2px 6px rgba(0,96,100,0.3);' : 'background:#f1f5f9; color:#475569;'}">
            <span>🏫 בתי ספר</span>
            <span style="font-size:0.72rem; padding:1px 6px; border-radius:10px; font-weight:800; ${s.subTab==='schools' ? 'background:rgba(255,255,255,0.25); color:#fff;' : 'background:#e2e8f0; color:#334155;'}">${filteredSchools.length}</span>
          </button>

          ${isNutritionVisible ? `
            <button onclick="window.MATZAVA_STATE.subTab='nutrition'; window.renderMatzavaTab();" 
              style="${isMob ? 'flex:1;' : ''} padding:${isMob ? '6px 8px' : '8px 16px'}; border-radius:8px; border:none; font-weight:800; font-size:${isMob ? '0.8rem' : '0.9rem'}; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:6px; transition:all 0.15s; ${s.subTab==='nutrition' ? 'background:#e65100; color:#fff; box-shadow:0 2px 6px rgba(230,81,0,0.3);' : 'background:#f1f5f9; color:#475569;'}">
              <span>🥪 הזנה</span>
              <span style="font-size:0.72rem; padding:1px 6px; border-radius:10px; font-weight:800; ${s.subTab==='nutrition' ? 'background:rgba(255,255,255,0.25); color:#fff;' : 'background:#e2e8f0; color:#334155;'}">${filteredNutrition.length}</span>
            </button>
          ` : ''}
        </div>

        <!-- ─────────────────────────────────────────────────────────── -->
        <!-- DYNAMIC KPI CARDS (2x2 Grid on Mobile to eliminate dead space) -->
        <!-- ─────────────────────────────────────────────────────────── -->
        ${s.subTab === 'gardens' ? `
          <div style="display:grid; grid-template-columns:${isMob ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(160px, 1fr))'}; gap:${isMob ? '6px' : '12px'}; margin-bottom:${isMob ? '10px' : '16px'};">
            <div style="background:#fff; border-radius:${isMob ? '8px' : '10px'}; padding:${isMob ? '6px 8px' : '12px 16px'}; border:1px solid #e0e0e0; box-shadow:0 1px 3px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:${isMob ? '0.68rem' : '0.75rem'}; color:#666; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">סה"כ ילדים</div>
              <div style="font-size:${isMob ? '1.25rem' : '1.6rem'}; color:#1a237e; font-weight:800; line-height:1.15;">${totalKids.toLocaleString()}</div>
              <div style="font-size:${isMob ? '0.62rem' : '0.7rem'}; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">רשומים בצהרונים</div>
            </div>

            <div style="background:#fff; border-radius:${isMob ? '8px' : '10px'}; padding:${isMob ? '6px 8px' : '12px 16px'}; border:1px solid #e0e0e0; box-shadow:0 1px 3px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:${isMob ? '0.68rem' : '0.75rem'}; color:#666; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">צהרונים</div>
              <div style="font-size:${isMob ? '1.25rem' : '1.6rem'}; color:#2e7d32; font-weight:800; line-height:1.15;">${filteredGardens.length}</div>
              <div style="font-size:${isMob ? '0.62rem' : '0.7rem'}; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">ממוצע: <b>${avgKids}</b> לצהרון</div>
            </div>

            <div style="background:#fff; border-radius:${isMob ? '8px' : '10px'}; padding:${isMob ? '6px 8px' : '12px 16px'}; border:1px solid #e0e0e0; box-shadow:0 1px 3px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:${isMob ? '0.68rem' : '0.75rem'}; color:#666; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">סטרילי / אלרגיות</div>
              <div style="font-size:${isMob ? '1.25rem' : '1.6rem'}; color:#c62828; font-weight:800; line-height:1.15;">${sterileCount}</div>
              <div style="font-size:${isMob ? '0.62rem' : '0.7rem'}; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">הקפדה מוחלטת</div>
            </div>

            <div style="background:#fff; border-radius:${isMob ? '8px' : '10px'}; padding:${isMob ? '6px 8px' : '12px 16px'}; border:1px solid #e0e0e0; box-shadow:0 1px 3px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:${isMob ? '0.68rem' : '0.75rem'}; color:#666; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">איחודי גנים</div>
              <div style="font-size:${isMob ? '1.25rem' : '1.6rem'}; color:#6a1b9a; font-weight:800; line-height:1.15;">${mergedCount}</div>
              <div style="font-size:${isMob ? '0.62rem' : '0.7rem'}; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">שורה מאוחדת</div>
            </div>
          </div>
        ` : (s.subTab === 'schools' ? `
          <div style="display:grid; grid-template-columns:${isMob ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(160px, 1fr))'}; gap:${isMob ? '6px' : '12px'}; margin-bottom:${isMob ? '10px' : '16px'};">
            <div style="background:#fff; border-radius:${isMob ? '8px' : '10px'}; padding:${isMob ? '6px 8px' : '12px 16px'}; border:1px solid #e0e0e0; box-shadow:0 1px 3px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:${isMob ? '0.68rem' : '0.75rem'}; color:#666; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">סה"כ תלמידים</div>
              <div style="font-size:${isMob ? '1.25rem' : '1.6rem'}; color:#006064; font-weight:800; line-height:1.15;">${schTotalKids.toLocaleString()}</div>
              <div style="font-size:${isMob ? '0.62rem' : '0.7rem'}; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">רשומים בצהרונים</div>
            </div>

            <div style="background:#fff; border-radius:${isMob ? '8px' : '10px'}; padding:${isMob ? '6px 8px' : '12px 16px'}; border:1px solid #e0e0e0; box-shadow:0 1px 3px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:${isMob ? '0.68rem' : '0.75rem'}; color:#666; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">קבוצות / כיתות</div>
              <div style="font-size:${isMob ? '1.25rem' : '1.6rem'}; color:#00838f; font-weight:800; line-height:1.15;">${filteredSchools.length}</div>
              <div style="font-size:${isMob ? '0.62rem' : '0.7rem'}; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">כיתות א'-ג'</div>
            </div>

            <div style="background:#fff; border-radius:${isMob ? '8px' : '10px'}; padding:${isMob ? '6px 8px' : '12px 16px'}; border:1px solid #e0e0e0; box-shadow:0 1px 3px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:${isMob ? '0.68rem' : '0.75rem'}; color:#666; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">בתי ספר פעילים</div>
              <div style="font-size:${isMob ? '1.25rem' : '1.6rem'}; color:#0277bd; font-weight:800; line-height:1.15;">${schoolsSet.size}</div>
              <div style="font-size:${isMob ? '0.62rem' : '0.7rem'}; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">מוסדות חינוך</div>
            </div>

            <div style="background:#fff; border-radius:${isMob ? '8px' : '10px'}; padding:${isMob ? '6px 8px' : '12px 16px'}; border:1px solid #e0e0e0; box-shadow:0 1px 3px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:${isMob ? '0.68rem' : '0.75rem'}; color:#666; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">אלרגיות / סטרילי</div>
              <div style="font-size:${isMob ? '1.25rem' : '1.6rem'}; color:#c62828; font-weight:800; line-height:1.15;">${schSterileCount}</div>
              <div style="font-size:${isMob ? '0.62rem' : '0.7rem'}; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">התראות אלרגיה</div>
            </div>
          </div>
        ` : `
          <div style="display:grid; grid-template-columns:${isMob ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))'}; gap:${isMob ? '6px' : '12px'}; margin-bottom:${isMob ? '10px' : '16px'};">
            <div style="background:#fff; border-radius:${isMob ? '8px' : '10px'}; padding:${isMob ? '6px 8px' : '12px 16px'}; border:1px solid #ffe0b2; box-shadow:0 1px 3px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:${isMob ? '0.68rem' : '0.75rem'}; color:#666; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">סה"כ מנות מזון</div>
              <div style="font-size:${isMob ? '1.25rem' : '1.6rem'}; color:#e65100; font-weight:800; line-height:1.15;">${nutTotalMeals.toLocaleString()}</div>
              <div style="font-size:${isMob ? '0.62rem' : '0.7rem'}; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">מנות מוזמנות</div>
            </div>

            <div style="background:#fff; border-radius:${isMob ? '8px' : '10px'}; padding:${isMob ? '6px 8px' : '12px 16px'}; border:1px solid #ffe0b2; box-shadow:0 1px 3px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:${isMob ? '0.68rem' : '0.75rem'}; color:#666; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">קבוצות תקשורת וחנ"מ</div>
              <div style="font-size:${isMob ? '1.25rem' : '1.6rem'}; color:#bf360c; font-weight:800; line-height:1.15;">${filteredNutrition.length}</div>
              <div style="font-size:${isMob ? '0.62rem' : '0.7rem'}; color:#888; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">הזנה בלבד</div>
            </div>
          </div>
        `)}

        <!-- ─────────────────────────────────────────────────────────── -->
        <!-- VIEW CONTENT (Responsive: Mobile Cards vs Desktop Table) -->
        <!-- ─────────────────────────────────────────────────────────── -->
        ${s.subTab === 'gardens' ? (
          isMob ? renderGardensMobile(filteredGardens) : renderGardensDesktop(filteredGardens)
        ) : (s.subTab === 'schools' ? (
          isMob ? renderSchoolsMobile(filteredSchools) : renderSchoolsDesktop(filteredSchools)
        ) : (
          isMob ? renderNutritionMobile(filteredNutrition) : renderNutritionDesktop(filteredNutrition)
        ))}

      </div>
    `;

    container.innerHTML = html;
  };

  // Switch mode to Matzava
  window.openMatzava = function () {
    if (window.permMatzava === false && window.role !== 'admin') {
      if (typeof window.showToast === 'function') window.showToast('אין לך הרשאה לצפייה במצבה', 'warn');
      return;
    }
    if (typeof window.switchMode === 'function') {
      window.switchMode('matzava');
    } else {
      // Fallback direct mode activation
      document.body.classList.remove('mode-purch');
      const tAct = document.getElementById('tabs-act');
      if (tAct) tAct.style.display = 'none';
      const tPurch = document.getElementById('tabs-purch');
      if (tPurch) tPurch.style.display = 'none';

      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      const mBtn = document.getElementById('modeBtn-matzava');
      if (mBtn) mBtn.classList.add('active');

      document.querySelectorAll('.content').forEach(p => { p.style.display = 'none'; });
      const p = document.getElementById('p-matzava');
      if (p) p.style.display = 'block';

      window.renderMatzavaTab();
      if (typeof window.triggerSilentMatzavaSync === 'function') {
        window.triggerSilentMatzavaSync();
      }
    }
  };

  // Open Matzava as a standalone modal (for Field Coordinators & Isolated App)
  window.openMatzavaModal = async function () {
    if (window.permMatzava === false && window.role !== 'admin') {
      if (typeof window.showToast === 'function') window.showToast('אין לך הרשאה לצפייה במצבה', 'warn');
      return;
    }
    const isMob = (typeof window.isMobileMode === 'function' ? window.isMobileMode() : (window.innerWidth <= 768));
    let modal = document.getElementById('matzava-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'matzava-modal';
      document.body.appendChild(modal);
    }
    modal.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.7); z-index:9999999; display:flex; justify-content:center; align-items:center; padding:${isMob ? '0' : '12px'}; box-sizing:border-box; backdrop-filter:blur(3px);`;
    modal.innerHTML = `
      <div style="background:#f8fafc; width:100%; max-width:1300px; height:${isMob ? '100vh' : '92vh'}; border-radius:${isMob ? '0' : '14px'}; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.3); border:${isMob ? 'none' : '1px solid #cbd5e1'};">
        <div style="padding:${isMob ? '10px 14px' : '12px 18px'}; background:#1a237e; color:#fff; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
          <div style="font-weight:800; font-size:${isMob ? '0.95rem' : '1.1rem'}; display:flex; align-items:center; gap:8px;">
            <span>👶 מצבה — מספרי ילדים ואלרגיות</span>
          </div>
          <button onclick="document.getElementById('matzava-modal').style.setProperty('display','none','important')" style="background:rgba(255,255,255,0.15); border:none; color:#fff; font-size:1.1rem; border-radius:6px; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="סגור">✕</button>
        </div>
        <div id="matzava-modal-body" style="flex:1; overflow-y:auto; padding:${isMob ? '4px 6px' : '8px'}; -webkit-overflow-scrolling:touch;"></div>
      </div>
    `;
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('visibility', 'visible', 'important');
    const body = document.getElementById('matzava-modal-body');

    // 1. Instant synchronous cache check
    if (!window.MATZAVA_STATE.loadedYear) {
      try {
        const y = getYearKey();
        const localCached = window._safeLS ? window._safeLS.getItem('gan_matzava_' + y) : localStorage.getItem('gan_matzava_' + y);
        if (localCached) {
          const parsed = JSON.parse(localCached);
          if (parsed && (parsed.records || parsed.schools)) {
            window.MATZAVA_STATE.records = Array.isArray(parsed.records) ? parsed.records : [];
            window.MATZAVA_STATE.nutritionOnly = Array.isArray(parsed.nutritionOnly) ? parsed.nutritionOnly : [];
            window.MATZAVA_STATE.schools = Array.isArray(parsed.schools) ? parsed.schools : [];
            window.MATZAVA_STATE.lastSync = parsed.lastSync || null;
            window.MATZAVA_STATE.loadedYear = y;
          }
        }
      } catch(e) {}
    }

    // Only if completely empty on first launch
    if (!window.MATZAVA_STATE.loadedYear || (((window.MATZAVA_STATE.records || []).length === 0) && ((window.MATZAVA_STATE.schools || []).length === 0))) {
      body.innerHTML = `
        <div style="text-align:center; padding:60px 20px;">
          <div style="font-size:2rem; margin-bottom:12px;">⏳</div>
          <div style="font-size:1.1rem; color:#1a237e; font-weight:700;">טוען נתוני מצבה עדכניים מהענן...</div>
        </div>
      `;
      await window.loadMatzavaFromFirebase(false, true);
    }

    // Render immediately from cache (0ms waiting!)
    await window.renderMatzavaTab(body);

    // Automatic silent background cloud fetch to guarantee freshest data!
    if (typeof window.triggerSilentMatzavaSync === 'function') {
      window.triggerSilentMatzavaSync();
    }
  };

  // Window resize re-render to switch smoothly between mobile cards & desktop table
  window.addEventListener('resize', () => {
    const pMatzava = document.getElementById('p-matzava');
    const isTabOpen = pMatzava && pMatzava.style.display !== 'none';
    const modal = document.getElementById('matzava-modal');
    const isModalOpen = modal && modal.style.display !== 'none';
    if (isTabOpen || isModalOpen) {
      clearTimeout(window._matzavaResizeTimer);
      window._matzavaResizeTimer = setTimeout(() => {
        window.renderMatzavaTab();
      }, 250);
    }
  });

  // Automatically initialize background remote command listener on PC host
  setTimeout(() => {
    try {
      if (typeof window.initMatzavaRemoteListener === 'function') {
        window.initMatzavaRemoteListener();
      }
    } catch(e) {}
  }, 3500);

  // Synchronize visibility on startup
  if (typeof window.applyMatzavaPermissionVisibility === 'function') {
    window.applyMatzavaPermissionVisibility();
  }
})();

