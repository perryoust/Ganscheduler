/**
 * GanScheduler - Matzava Module (מצב"ה - מצבת תלמידים, מספרי ילדים ואלרגיות בצהרונים)
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

  function canEditMatzava() {
    const role = window.userRole || window.role || (window._safeLS ? window._safeLS.getItem('gan_user_role') : localStorage.getItem('gan_user_role'));
    const isMgr = role === 'admin' || role === 'manager' || role === 'vp' || window.permAllCities || (window._safeLS ? window._safeLS.getItem('gan_user_role') : localStorage.getItem('gan_user_role')) === 'manager';
    return isMgr || (window.permMatzava === true) || (!window.isReadOnly);
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

  const RTDB_ROOT = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';

  async function getMatzavaAuthHeader() {
    let tok = null;
    if (typeof window._fbGetToken === 'function') {
      try { tok = await window._fbGetToken(); } catch (e) { }
    }
    if (!tok && window._cachedToken) {
      tok = window._cachedToken;
    }
    if (!tok && window._fbUser) {
      try { tok = await window._fbUser.getIdToken(false); } catch (e) { }
    }
    if (!tok && window._fbUser) {
      try { tok = await window._fbUser.getIdToken(true); } catch (e) { }
    }
    return tok ? '?auth=' + tok : '';
  }

  // Load data from Firebase Realtime Database (with instant LocalStorage fallback)
  window.loadMatzavaFromFirebase = async function (force = false) {
    const y = getYearKey();
    if (!force && window.MATZAVA_STATE.loadedYear === y && window.MATZAVA_STATE.records.length > 0) {
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
        }
      }
    } catch(e) {}

    window.MATZAVA_STATE.isLoading = true;
    try {
      const authQ = await getMatzavaAuthHeader();
      const url = `${RTDB_ROOT}/matzava/${y}.json${authQ}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          window.MATZAVA_STATE.records = Array.isArray(data.records) ? data.records : Object.values(data.records || {});
          window.MATZAVA_STATE.nutritionOnly = Array.isArray(data.nutritionOnly) ? data.nutritionOnly : Object.values(data.nutritionOnly || {});
          window.MATZAVA_STATE.schools = Array.isArray(data.schools) ? data.schools : Object.values(data.schools || {});
          window.MATZAVA_STATE.lastSync = data.lastSync || null;
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
        if (force && window.showToast) {
          window.showToast('✅ נתוני מצב"ה עודכנו מהענן בהצלחה');
        }
      } else {
        console.warn('[Matzava] Load returned status:', res.status);
        if (force && window.showToast) {
          window.showToast('⚠️ שגיאה בטעינת נתונים מהענן: ' + res.status);
        }
      }
      window.MATZAVA_STATE.loadedYear = y;
    } catch (e) {
      console.warn('[Matzava] Load error:', e);
      if (force && window.showToast) {
        window.showToast('⚠️ שגיאת רשת בטעינת מצב"ה: ' + e.message);
      }
    } finally {
      window.MATZAVA_STATE.isLoading = false;
    }
  };

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
      if (window.showToast) window.showToast('✅ נתוני מצב"ה נשמרו בענן ובלוקאל בהצלחה');

      // 3. Trigger Version Vault checkpoint check
      if (typeof window.checkVersionVaultSync === 'function') {
        window.checkVersionVaultSync();
      }
      return true;
    } catch (e) {
      console.error('[Matzava] Save error:', e);
      if (window.showToast) window.showToast('❌ שגיאה בשמירת מצב"ה בענן (הנתונים נשמרו מקומית בלבד): ' + e.message);
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
    if (window.showToast) window.showToast('✅ קובץ JSON של מצב"ה הורד בהצלחה');
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
          throw new Error('הקובץ אינו מכיל מבנה נתוני מצב"ה תקין');
        }
        window.MATZAVA_STATE.records = Array.isArray(data.records) ? data.records : [];
        window.MATZAVA_STATE.nutritionOnly = Array.isArray(data.nutritionOnly) ? data.nutritionOnly : [];
        window.MATZAVA_STATE.schools = Array.isArray(data.schools) ? data.schools : [];
        window.MATZAVA_STATE.lastSync = new Date().toISOString();

        await window.saveMatzavaToFirebase();
        window.renderMatzavaTab();
        if (window.showToast) window.showToast('✅ גיבוי JSON של מצב"ה שוחזר ונשמר בהצלחה!');
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

    const cleanFn = (fileName || '').replace(/[\u200E\u200F\uFEFF]/g, '').trim();
    const wb = new window.ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);

    // Prefer worksheet named "הזמנה"
    let ws = wb.getWorksheet('הזמנה') || wb.worksheets[0];
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
    const firstFewRowsText = rawRows.slice(0, 3).map(r => (r || []).join(' ')).join(' ');
    const isSchoolFile = fnLower.includes('בתי ספר') || fnLower.includes('בית ספר') || firstFewRowsText.includes('בתי ספר');

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
            } else if (!secSchool && (val.includes('בית ספר') || val.includes('בי"ס'))) {
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
          const schId = 'sch_' + cleanCity.replace(/[\s"'/\\()]/g, '_') + '_' + cleanSchool.replace(/[\s"'/\\()]/g, '_') + '_' + cleanGroup.replace(/[\s"'/\\()]/g, '_');

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
          kids10: g.k10,
          kids11: g.k11,
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
          const cKids = (c.k10 || c.k11) ? (c.k10 + c.k11) : (c.directKids || 0);
          sum10 += c.k10;
          sum11 += c.k11;
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
            kids10: c.k10,
            kids11: c.k11,
            kidsTotal: cKids,
            address: c.addr,
            notes: c.notes
          };
        });

        // Use cluster explicit rowTotal (if present, e.g. 27 or 35) or the sum of kids
        const explicitTotal = cluster.find(c => c.rowTotal > 0)?.rowTotal;
        const finalTotal = explicitTotal || sumKids;

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
          kids10: sum10,
          kids11: sum11,
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

  // Auto-refresh via File System Access API
  window.autoRefreshMatzava = async function () {
    if (!canEditMatzava()) {
      if (window.showToast) window.showToast('⚠️ רק מנהל או הנהלה יכולים לבצע רענון מצב"ה', 3000);
      return;
    }

    if (!window.showDirectoryPicker) {
      if (typeof window.spAlert === 'function') {
        window.spAlert('הדפדפן אינו תומך בגישה ישירה לתיקיות (File System Access API). אנא השתמש בדפדפן כרום או בייבוא קובץ בודד.');
      } else {
        alert('הדפדפן אינו תומך בגישה ישירה לתיקיות.');
      }
      return;
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
        if (window.showToast) window.showToast('📁 אנא בחר את תיקיית מצב"ה (' + y + ')...', 8000);
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

    if (window.showToast) window.showToast('⏳ סורק קבצי מצב"ה בתיקייה...', 60000);

    const scannedFiles = [];
    try {
      for await (const entry of dirHandle.values()) {
        const cleanName = entry.name.replace(/[\u200E\u200F\uFEFF]/g, '').trim();
        if (entry.kind === 'file' && cleanName.endsWith('.xlsx')) {
          if (cleanName.startsWith('~$')) {
            // Excel temporary lock file, skip
            continue;
          }
          scannedFiles.push(entry);
        }
      }
    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast('❌ שגיאה בסריקת התיקייה: ' + e.message);
      return;
    }

    if (scannedFiles.length === 0) {
      if (window.showToast) window.showToast('⚠️ לא נמצאו קבצי Excel (.xlsx) בתיקייה הנבחרת');
      return;
    }

    let allRecords = [];
    let allNutrition = [];
    let allSchools = [];
    let successCount = 0;
    const failedFiles = [];

    for (let i = 0; i < scannedFiles.length; i++) {
      const entry = scannedFiles[i];
      const cleanName = entry.name.replace(/[\u200E\u200F\uFEFF]/g, '').trim();
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

    const nutMap = new Map();
    allNutrition.forEach(n => {
      const key = (n.city || '') + '__' + (n.name || '');
      nutMap.set(key, n);
    });
    window.MATZAVA_STATE.nutritionOnly = Array.from(nutMap.values());

    const schMap = new Map();
    allSchools.forEach(s => {
      const key = (s.city || '') + '__' + (s.school || '') + '__' + (s.groupName || '');
      schMap.set(key, s);
    });
    window.MATZAVA_STATE.schools = Array.from(schMap.values());

    // Save to Firebase RTDB
    await window.saveMatzavaToFirebase();

    // Re-render
    window.renderMatzavaTab();

    let msg = `✅ רענון מצב"ה הושלם!\nנסרקו בהצלחה ${successCount} מתוך ${scannedFiles.length} קבצים:\n• ${window.MATZAVA_STATE.records.length} צהרונים\n• ${window.MATZAVA_STATE.nutritionOnly.length} קבוצות הזנה בלבד (מוצגות בבחירת העיר שלהן)\n• ${window.MATZAVA_STATE.schools.length} קבוצות בתי ספר`;
    if (failedFiles.length > 0) {
      msg += `\n\n⚠️ לא נקראו ${failedFiles.length} קבצים:\n• ${failedFiles.join('\n• ')}\n\n💡 אם הקובץ פתוח בתוכנת Excel במחשב, נא לסגור אותו וללחוץ שוב על "⚡ רענון אוטומטי".`;
    }

    if (typeof window.spAlert === 'function') {
      window.spAlert(msg);
    } else {
      alert(msg);
    }
  };

  // Single file manual import
  window.importSingleMatzavaFile = function (fileInput) {
    if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
    const file = fileInput.files[0];
    if (window.showToast) window.showToast('⏳ מייבא קובץ מצב"ה: ' + file.name + '...', 30000);

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

        const schMap = new Map(window.MATZAVA_STATE.schools.map(s => [(s.city || '') + '__' + (s.school || '') + '__' + (s.groupName || ''), s]));
        res.schools.forEach(s => schMap.set((s.city || '') + '__' + (s.school || '') + '__' + (s.groupName || ''), s));
        window.MATZAVA_STATE.schools = Array.from(schMap.values());

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
    wb.creator = 'טומשין קידס - מצב"ה';
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
            return `${s.role === 'מארח' ? '[מארח] ' : '[מתארח] '}${sName}: ${s.kidsTotal}`;
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
          hostGarden: r.isMerged ? `🏠 ${cleanHost} (מארח)` : cleanHost,
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
    let list = s.records || [];

    const curRole = window.userRole || window.role || (window._safeLS ? window._safeLS.getItem('gan_user_role') : localStorage.getItem('gan_user_role'));
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
      list = list.filter(r => (r.city || '').trim() === s.selectedCity.trim());
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

    const curRole = window.userRole || window.role || (window._safeLS ? window._safeLS.getItem('gan_user_role') : localStorage.getItem('gan_user_role'));
    const isManagerRole = curRole === 'admin' || curRole === 'manager' || curRole === 'vp' || window.permAllCities || (Array.isArray(window.coordCities) && window.coordCities.includes('ALL'));

    if (!isManagerRole && curRole === 'coordinator') {
      if (Array.isArray(window.coordCities) && window.coordCities.length > 0 && !window.coordCities.includes('ALL')) {
        list = list.filter(sc => window.coordCities.some(c => (sc.city || '').includes(c) || c.includes(sc.city || '')));
      }
    }

    if (s.selectedCity && s.selectedCity !== 'all') {
      list = list.filter(sc => (sc.city || '').trim() === s.selectedCity.trim());
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

    const curRole = window.userRole || window.role || (window._safeLS ? window._safeLS.getItem('gan_user_role') : localStorage.getItem('gan_user_role'));
    const isManagerRole = curRole === 'admin' || curRole === 'manager' || curRole === 'vp' || window.permAllCities || (Array.isArray(window.coordCities) && window.coordCities.includes('ALL'));

    if (!isManagerRole && curRole === 'coordinator') {
      if (Array.isArray(window.coordCities) && window.coordCities.length > 0 && !window.coordCities.includes('ALL')) {
        list = list.filter(n => window.coordCities.some(c => (n.city || '').includes(c) || c.includes(n.city || '')));
      }
    }

    list = list.filter(n => (n.city || '').trim() === s.selectedCity.trim());

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

  // Main UI Render Function
  window.renderMatzavaTab = async function (targetEl) {
    const modalBody = document.getElementById('matzava-modal-body');
    const isModalOpen = modalBody && (modalBody.offsetParent !== null || (document.getElementById('matzava-modal') && document.getElementById('matzava-modal').style.display !== 'none'));
    const container = targetEl || (isModalOpen ? modalBody : null) || document.getElementById('p-matzava') || modalBody;
    if (!container) return;
    if (!container) return;

    if (!window.MATZAVA_STATE.loadedYear) {
      container.innerHTML = `
        <div style="text-align:center; padding:60px 20px;">
          <div style="font-size:2rem; margin-bottom:12px;">⏳</div>
          <div style="font-size:1.1rem; color:#1a237e; font-weight:700;">טוען נתוני מצב"ה מהענן...</div>
        </div>
      `;
      await window.loadMatzavaFromFirebase();
    }

    const s = window.MATZAVA_STATE;
    const canEdit = canEditMatzava();

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
      totalKids += (r.kidsTotal || 0);
      total10 += (r.kids10 || 0);
      total11 += (r.kids11 || 0);
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
      <div class="matzava-wrapper" style="direction:rtl; font-family:'Assistant',sans-serif; padding:12px; max-width:1440px; margin:0 auto;">
        
        <!-- TOP CONTROL BAR -->
        <div style="background:#fff; border-radius:12px; padding:16px; box-shadow:0 2px 12px rgba(0,0,0,0.06); margin-bottom:16px; border:1px solid #e0e0e0;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:1.8rem;">👶</span>
              <div>
                <h2 style="margin:0; font-size:1.3rem; color:#1a237e; font-weight:800; display:flex; align-items:center; gap:8px;">
                  מצב"ה — מספרי ילדים ואלרגיות בצהרונים ובתי ספר
                  <span style="font-size:0.75rem; background:#e8eaf6; color:#283593; padding:2px 8px; border-radius:12px; font-weight:700;">${getYearKey()}</span>
                </h2>
                <div style="font-size:0.8rem; color:#666; margin-top:2px;">
                  ${s.lastSync ? `סנכרון ענן אחרון: ${new Date(s.lastSync).toLocaleString('he-IL')}` : 'טרם נסרקו קבצים'}
                </div>
              </div>
            </div>

            <!-- ACTION BUTTONS -->
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              ${canEdit ? `
                <button class="btn" onclick="window.autoRefreshMatzava()" 
                  style="background:#2e7d32; color:#fff; border-radius:8px; font-weight:700; padding:8px 14px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; border:none; box-shadow:0 2px 6px rgba(46,125,50,0.3);" 
                  title="סריקה אוטומטית של תיקיית המצב''ה במחשב">
                  ⚡ רענון אוטומטי
                </button>
                <label class="btn" style="background:#1565c0; color:#fff; border-radius:8px; font-weight:700; padding:8px 14px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; border:none; margin:0;" title="ייבוא ידני של קובץ אקסל בודד">
                  📂 ייבוא קובץ
                  <input type="file" accept=".xlsx" style="display:none;" onchange="window.importSingleMatzavaFile(this)">
                </label>
              ` : ''}
              
              <button class="btn" onclick="window.exportMatzavaToExcel()" 
                style="background:#00838f; color:#fff; border-radius:8px; font-weight:700; padding:8px 14px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; border:none;" 
                title="ייצוא הדוח לאקסל מעוצב עם כל הטאבים">
                📊 ייצוא לאקסל
              </button>

              <button class="btn" onclick="window.exportMatzavaJSON()" 
                style="background:#6a1b9a; color:#fff; border-radius:8px; font-weight:700; padding:8px 12px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; border:none;" 
                title="הורדת גיבוי JSON מלא של מצב''ה">
                💾 גיבוי JSON
              </button>

              ${canEdit ? `
                <label class="btn" style="background:#4a148c; color:#fff; border-radius:8px; font-weight:700; padding:8px 12px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; border:none; margin:0;" title="שחזור קובץ גיבוי JSON של מצב''ה">
                  📥 שחזור JSON
                  <input type="file" accept=".json" style="display:none;" onchange="window.importMatzavaJSON(this)">
                </label>
              ` : ''}

              <button class="btn" onclick="window.openVersionVaultModal && window.openVersionVaultModal()" 
                style="background:#37474f; color:#fff; border-radius:8px; font-weight:700; padding:8px 12px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; border:none;" 
                title="פתיחת כספת גיבויי נתונים ושחזור לפי גרסאות">
                📦 כספת גיבויים
              </button>

              <button class="btn" onclick="window.loadMatzavaFromFirebase(true).then(()=>window.renderMatzavaTab())" 
                style="background:#f5f5f5; color:#333; border:1px solid #ccc; border-radius:8px; padding:8px 12px; font-size:0.85rem; cursor:pointer;" 
                title="רענן תצוגה מהענן (סנכרון מיידי עם נתוני הצוות)">
                🔄 רענן מהענן
              </button>
            </div>
          </div>

          <!-- FILTERS & SEARCH -->
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; background:#f8fafc; padding:10px 14px; border-radius:8px; border:1px solid #e2e8f0;">
            <!-- City Dropdown -->
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:0.85rem; font-weight:700; color:#1e293b;">עיר:</span>
              <select onchange="window.MATZAVA_STATE.selectedCity=this.value; window.renderMatzavaTab();" 
                style="padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1; background:#fff; font-weight:700; font-size:0.85rem; outline:none; cursor:pointer;">
                <option value="all" ${s.selectedCity === 'all' ? 'selected' : ''}>🌍 כל הערים</option>
                ${availableCities.map(c => `
                  <option value="${c}" ${s.selectedCity === c ? 'selected' : ''}>${c}</option>
                `).join('')}
              </select>
            </div>

            <!-- Free Text Search -->
            <div style="flex:1; min-width:200px; position:relative;">
              <input type="text" placeholder="${s.subTab === 'schools' ? '🔍 חפש בית ספר, כיתה, הערת אלרגיה...' : (s.subTab === 'nutrition' ? '🔍 חפש קבוצה, כתובת, הזנה...' : '🔍 חפש גן, כתובת, הערת אלרגיה...')}" 
                value="${s.searchQuery || ''}" 
                oninput="window.MATZAVA_STATE.searchQuery=this.value; window.renderMatzavaTab();" 
                style="width:100%; padding:6px 12px; border-radius:6px; border:1px solid #ccc; font-size:0.85rem; outline:none; box-sizing:border-box;">
              ${s.searchQuery ? `
                <span onclick="window.MATZAVA_STATE.searchQuery=''; window.renderMatzavaTab();" style="position:absolute; left:8px; top:6px; cursor:pointer; color:#999; font-weight:bold;">✕</span>
              ` : ''}
            </div>

            <!-- Category Pills (relevant to current subTab) -->
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button onclick="window.MATZAVA_STATE.filterType='all'; window.renderMatzavaTab();" 
                style="padding:4px 10px; border-radius:14px; border:none; font-size:0.75rem; font-weight:700; cursor:pointer; background:${s.filterType==='all' ? '#1a237e; color:#fff;' : '#e8eaf6; color:#1a237e;'}">
                הכל
              </button>
              <button onclick="window.MATZAVA_STATE.filterType='sterile'; window.renderMatzavaTab();" 
                style="padding:4px 10px; border-radius:14px; border:none; font-size:0.75rem; font-weight:700; cursor:pointer; background:${s.filterType==='sterile' ? '#c62828; color:#fff;' : '#ffebee; color:#c62828;'}">
                🔴 סטרילי / אלרגיות (${s.subTab === 'schools' ? schSterileCount : sterileCount})
              </button>
              ${s.subTab === 'gardens' ? `
                <button onclick="window.MATZAVA_STATE.filterType='homemeal'; window.renderMatzavaTab();" 
                  style="padding:4px 10px; border-radius:14px; border:none; font-size:0.75rem; font-weight:700; cursor:pointer; background:${s.filterType==='homemeal' ? '#f57f17; color:#fff;' : '#fffde7; color:#f57f17;'}">
                  🟡 מנה מהבית (${homeMealCount})
                </button>
                <button onclick="window.MATZAVA_STATE.filterType='merged'; window.renderMatzavaTab();" 
                  style="padding:4px 10px; border-radius:14px; border:none; font-size:0.75rem; font-weight:700; cursor:pointer; background:${s.filterType==='merged' ? '#6a1b9a; color:#fff;' : '#f3e5f5; color:#6a1b9a;'}">
                  ⚖️ איחודים (${mergedCount})
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- ─────────────────────────────────────────────────────────── -->
        <!-- SECONDARY SMART SUB-TABS BAR -->
        <!-- ─────────────────────────────────────────────────────────── -->
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px; border-bottom:2px solid #e2e8f0; padding-bottom:8px;">
          <button onclick="window.MATZAVA_STATE.subTab='gardens'; window.renderMatzavaTab();" 
            style="padding:8px 16px; border-radius:10px; border:none; font-weight:800; font-size:0.9rem; cursor:pointer; display:inline-flex; align-items:center; gap:8px; transition:all 0.15s; ${s.subTab==='gardens' ? 'background:#1a237e; color:#fff; box-shadow:0 2px 8px rgba(26,35,126,0.3);' : 'background:#f1f5f9; color:#475569;'}">
            <span>🏡 צהרוני גנים</span>
            <span style="font-size:0.75rem; padding:2px 7px; border-radius:12px; font-weight:800; ${s.subTab==='gardens' ? 'background:rgba(255,255,255,0.25); color:#fff;' : 'background:#e2e8f0; color:#334155;'}">${filteredGardens.length}</span>
          </button>

          <button onclick="window.MATZAVA_STATE.subTab='schools'; window.renderMatzavaTab();" 
            style="padding:8px 16px; border-radius:10px; border:none; font-weight:800; font-size:0.9rem; cursor:pointer; display:inline-flex; align-items:center; gap:8px; transition:all 0.15s; ${s.subTab==='schools' ? 'background:#006064; color:#fff; box-shadow:0 2px 8px rgba(0,96,100,0.3);' : 'background:#f1f5f9; color:#475569;'}">
            <span>🏫 בתי ספר</span>
            <span style="font-size:0.75rem; padding:2px 7px; border-radius:12px; font-weight:800; ${s.subTab==='schools' ? 'background:rgba(255,255,255,0.25); color:#fff;' : 'background:#e2e8f0; color:#334155;'}">${filteredSchools.length}</span>
          </button>

          ${isNutritionVisible ? `
            <button onclick="window.MATZAVA_STATE.subTab='nutrition'; window.renderMatzavaTab();" 
              style="padding:8px 16px; border-radius:10px; border:none; font-weight:800; font-size:0.9rem; cursor:pointer; display:inline-flex; align-items:center; gap:8px; transition:all 0.15s; ${s.subTab==='nutrition' ? 'background:#e65100; color:#fff; box-shadow:0 2px 8px rgba(230,81,0,0.3);' : 'background:#f1f5f9; color:#475569;'}">
              <span>🥪 הזנה בלבד</span>
              <span style="font-size:0.75rem; padding:2px 7px; border-radius:12px; font-weight:800; ${s.subTab==='nutrition' ? 'background:rgba(255,255,255,0.25); color:#fff;' : 'background:#e2e8f0; color:#334155;'}">${filteredNutrition.length}</span>
            </button>
          ` : ''}
        </div>

        <!-- ─────────────────────────────────────────────────────────── -->
        <!-- DYNAMIC KPI CARDS (Matches active subTab) -->
        <!-- ─────────────────────────────────────────────────────────── -->
        ${s.subTab === 'gardens' ? `
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:16px;">
            <div style="background:#fff; border-radius:10px; padding:12px 16px; border:1px solid #e0e0e0; box-shadow:0 1px 4px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:0.75rem; color:#666; font-weight:700;">סה"כ ילדים בצהרונים</div>
              <div style="font-size:1.6rem; color:#1a237e; font-weight:800; line-height:1.2;">${totalKids.toLocaleString()}</div>
              <div style="font-size:0.7rem; color:#888;">${total10 ? `${total10} (10ח') + ${total11} (11ח')` : ''}</div>
            </div>

            <div style="background:#fff; border-radius:10px; padding:12px 16px; border:1px solid #e0e0e0; box-shadow:0 1px 4px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:0.75rem; color:#666; font-weight:700;">צהרונים</div>
              <div style="font-size:1.6rem; color:#2e7d32; font-weight:800; line-height:1.2;">${filteredGardens.length}</div>
              <div style="font-size:0.7rem; color:#888;">ממוצע: <b>${avgKids}</b> לצהרון</div>
            </div>

            <div style="background:#fff; border-radius:10px; padding:12px 16px; border:1px solid #e0e0e0; box-shadow:0 1px 4px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:0.75rem; color:#666; font-weight:700;">גנים סטריליים / אלרגיות</div>
              <div style="font-size:1.6rem; color:#c62828; font-weight:800; line-height:1.2;">${sterileCount}</div>
              <div style="font-size:0.7rem; color:#888;">דורשים הקפדה מוחלטת</div>
            </div>

            <div style="background:#fff; border-radius:10px; padding:12px 16px; border:1px solid #e0e0e0; box-shadow:0 1px 4px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:0.75rem; color:#666; font-weight:700;">איחודי גנים</div>
              <div style="font-size:1.6rem; color:#6a1b9a; font-weight:800; line-height:1.2;">${mergedCount}</div>
              <div style="font-size:0.7rem; color:#888;">מוצגים כשורה מאוחדת אחת</div>
            </div>
          </div>
        ` : (s.subTab === 'schools' ? `
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:16px;">
            <div style="background:#fff; border-radius:10px; padding:12px 16px; border:1px solid #e0e0e0; box-shadow:0 1px 4px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:0.75rem; color:#666; font-weight:700;">סה"כ תלמידים בבתי ספר</div>
              <div style="font-size:1.6rem; color:#006064; font-weight:800; line-height:1.2;">${schTotalKids.toLocaleString()}</div>
              <div style="font-size:0.7rem; color:#888;">רשומים בצהרוני בתי ספר</div>
            </div>

            <div style="background:#fff; border-radius:10px; padding:12px 16px; border:1px solid #e0e0e0; box-shadow:0 1px 4px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:0.75rem; color:#666; font-weight:700;">קבוצות / כיתות</div>
              <div style="font-size:1.6rem; color:#00838f; font-weight:800; line-height:1.2;">${filteredSchools.length}</div>
              <div style="font-size:0.7rem; color:#888;">כיתות א'-ג'</div>
            </div>

            <div style="background:#fff; border-radius:10px; padding:12px 16px; border:1px solid #e0e0e0; box-shadow:0 1px 4px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:0.75rem; color:#666; font-weight:700;">בתי ספר פעילים</div>
              <div style="font-size:1.6rem; color:#0277bd; font-weight:800; line-height:1.2;">${schoolsSet.size}</div>
              <div style="font-size:0.7rem; color:#888;">מוסדות חינוך</div>
            </div>

            <div style="background:#fff; border-radius:10px; padding:12px 16px; border:1px solid #e0e0e0; box-shadow:0 1px 4px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:0.75rem; color:#666; font-weight:700;">כיתות סטריליות / אלרגיות</div>
              <div style="font-size:1.6rem; color:#c62828; font-weight:800; line-height:1.2;">${schSterileCount}</div>
              <div style="font-size:0.7rem; color:#888;">התראות אלרגיה</div>
            </div>
          </div>
        ` : `
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:16px;">
            <div style="background:#fff; border-radius:10px; padding:12px 16px; border:1px solid #ffe0b2; box-shadow:0 1px 4px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:0.75rem; color:#666; font-weight:700;">סה"כ מנות מזון (הזנה בלבד)</div>
              <div style="font-size:1.6rem; color:#e65100; font-weight:800; line-height:1.2;">${nutTotalMeals.toLocaleString()}</div>
              <div style="font-size:0.7rem; color:#888;">מנות מוזמנות (אינו נכלל בסה"כ הילדים)</div>
            </div>

            <div style="background:#fff; border-radius:10px; padding:12px 16px; border:1px solid #ffe0b2; box-shadow:0 1px 4px rgba(0,0,0,0.04); text-align:center;">
              <div style="font-size:0.75rem; color:#666; font-weight:700;">קבוצות תקשורת וחנ"מ</div>
              <div style="font-size:1.6rem; color:#bf360c; font-weight:800; line-height:1.2;">${filteredNutrition.length}</div>
              <div style="font-size:0.7rem; color:#888;">הזמנת מזון בלבד</div>
            </div>
          </div>
        `)}

        <!-- ─────────────────────────────────────────────────────────── -->
        <!-- VIEW CONTENT TABLE -->
        <!-- ─────────────────────────────────────────────────────────── -->
        ${s.subTab === 'gardens' ? `
          <!-- KINDERGARTENS TABLE -->
          <div style="background:#fff; border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid #e0e0e0; overflow:hidden;">
            <div style="overflow-x:auto;">
              <table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:right;">
                <thead>
                  <tr style="background:#1a237e; color:#fff; height:42px;">
                    <th style="padding:8px 12px; font-weight:700; width:90px;">עיר</th>
                    <th style="padding:8px 12px; font-weight:700; min-width:140px;">שם הצהרון / גן</th>
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
                  ${filteredGardens.length === 0 ? `
                    <tr>
                      <td colspan="9" style="text-align:center; padding:40px 20px; color:#999;">
                        <div style="font-size:2rem; margin-bottom:8px;">📭</div>
                        <div style="font-weight:700; font-size:1rem; color:#555;">לא נמצאו צהרונים התואמים לחיפוש / סינון</div>
                      </td>
                    </tr>
                  ` : filteredGardens.map((r, idx) => {
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
                        <td style="padding:10px 12px; font-weight:700; color:#37474f; vertical-align:top;">
                          <span style="background:#eceff1; padding:2px 6px; border-radius:4px; font-size:0.75rem;">${r.city}</span>
                        </td>
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
                            <div style="margin-top:6px; background:#faf5ff; border:1px solid #d8b4fe; border-radius:8px; padding:6px 10px; font-size:0.75rem; font-weight:normal; box-shadow:0 1px 3px rgba(106,27,154,0.06); line-height:1.4;">
                              <div style="font-weight:700; color:#6a1b9a; font-size:0.68rem; border-bottom:1px dashed #d8b4fe; padding-bottom:3px; margin-bottom:4px; display:flex; justify-content:space-between;">
                                <span>פירוט גנים שבתוך האיחוד:</span>
                                <span>סה"כ: <b>${r.kidsTotal}</b></span>
                              </div>
                              ${r.subGardens.map(sub => {
                                const safeSubName = (sub.name && sub.name !== '[object Object]' && !String(sub.name).includes('object Object')) ? sub.name : 'גן';
                                return `
                                  <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:2px 0; border-bottom:1px dotted #f3e5f5;">
                                    <span style="${sub.role === 'מארח' ? 'font-weight:700; color:#4a148c;' : 'color:#581c87;'}">
                                      ${sub.role === 'מארח' ? '🏠' : '↳'} ${safeSubName}
                                      <span style="font-size:0.68rem; padding:1px 4px; border-radius:3px; background:${sub.role === 'מארח' ? '#f3e5f5' : '#ede7f6'}; color:${sub.role === 'מארח' ? '#6a1b9a' : '#7e57c2'}; font-weight:700;">${sub.role}</span>
                                    </span>
                                    <span style="font-weight:700; background:#fff; padding:1px 6px; border-radius:4px; border:1px solid #d8b4fe; color:#1a237e; font-size:0.72rem;">
                                      ${sub.kidsTotal} ${sub.kids10 || sub.kids11 ? `<span style="font-size:0.65rem; color:#666;">(${sub.kids10}ח' + ${sub.kids11}ח')</span>` : 'ילדים'}
                                    </span>
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
                        <td style="padding:10px 12px; text-align:center; color:#555; vertical-align:top;">${r.kids10 || '-'}</td>
                        <td style="padding:10px 12px; text-align:center; color:#555; vertical-align:top;">${r.kids11 || '-'}</td>
                        <td style="padding:10px 12px; text-align:center; font-weight:800; font-size:1.05rem; color:#1a237e; background:rgba(40,53,147,0.06); vertical-align:top;">
                          ${r.kidsTotal || 0}
                        </td>
                        <td style="padding:10px 12px; vertical-align:top;">
                          ${r.isMerged ? `
                            <span style="background:#f3e5f5; color:#6a1b9a; padding:4px 8px; border-radius:6px; font-size:0.76rem; font-weight:700; display:inline-flex; align-items:center; gap:4px; border:1px solid #ce93d8;">
                              <span>🏠 ${safeHostGarden} (מארח)</span>
                            </span>
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
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : (s.subTab === 'schools' ? `
          <!-- SCHOOLS TABLE -->
          <div style="background:#fff; border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid #b2ebf2; overflow:hidden;">
            <div style="overflow-x:auto;">
              <table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:right;">
                <thead>
                  <tr style="background:#006064; color:#fff; height:42px;">
                    <th style="padding:8px 12px; font-weight:700; width:90px;">עיר</th>
                    <th style="padding:8px 12px; font-weight:700; min-width:140px;">בית ספר</th>
                    <th style="padding:8px 12px; font-weight:700; min-width:120px;">קבוצה / כיתה</th>
                    <th style="padding:8px 12px; font-weight:700; min-width:140px;">כתובת</th>
                    <th style="padding:8px 12px; font-weight:700; text-align:center; width:85px;">רשומים</th>
                    <th style="padding:8px 12px; font-weight:700; text-align:center; width:95px; background:#00838f;">איחוד לקב'</th>
                    <th style="padding:8px 12px; font-weight:700; min-width:220px;">אלרגיות והערות</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredSchools.length === 0 ? `
                    <tr>
                      <td colspan="7" style="text-align:center; padding:40px 20px; color:#999;">
                        <div style="font-size:2rem; margin-bottom:8px;">🏫</div>
                        <div style="font-weight:700; font-size:1rem; color:#555;">לא נמצאו קבוצות בתי ספר התואמות לחיפוש / סינון</div>
                      </td>
                    </tr>
                  ` : filteredSchools.map((sc, idx) => {
                    const bg = idx % 2 === 0 ? '#fff' : '#f9fbfb';
                    const isSterileBg = sc.isSterile ? 'background:#fff5f5;' : '';
                    return `
                      <tr style="${isSterileBg || `background:${bg};`} border-bottom:1px solid #e0f2f1; transition:background 0.15s;" onmouseover="this.style.background='#e0f7fa'" onmouseout="this.style.background='${sc.isSterile ? '#fff5f5' : bg}'">
                        <td style="padding:10px 12px; font-weight:700; color:#37474f;">
                          <span style="background:#eceff1; padding:2px 6px; border-radius:4px; font-size:0.75rem;">${sc.city}</span>
                        </td>
                        <td style="padding:10px 12px; font-weight:800; color:#006064;">${sc.school || '-'}</td>
                        <td style="padding:10px 12px; font-weight:700; color:#00838f;">
                          <span style="background:#e0f7fa; padding:3px 8px; border-radius:6px; border:1px solid #b2ebf2;">${sc.groupName}</span>
                        </td>
                        <td style="padding:10px 12px; color:#555; font-size:0.8rem;">${sc.address || '-'}</td>
                        <td style="padding:10px 12px; text-align:center; font-weight:800; color:#006064; font-size:0.95rem;">${sc.kids}</td>
                        <td style="padding:10px 12px; text-align:center; font-weight:800; color:#00838f; font-size:0.95rem; background:rgba(0,131,143,0.06);">${sc.mergedKids || sc.kids}</td>
                        <td style="padding:10px 12px;">
                          ${sc.isSterile ? `
                            <div style="background:#ffebee; color:#c62828; padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:700; display:inline-block; border:1px solid #ffcdd2;">
                              🚨 ${sc.notes}
                            </div>
                          ` : (sc.notes ? `
                            <div style="color:#444; font-size:0.78rem;">
                              ${sc.isHomeMeal ? '🟡 ' : ''}${sc.notes}
                            </div>
                          ` : '<span style="color:#bbb;">-</span>')}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : `
          <!-- NUTRITION ONLY TABLE -->
          <div style="background:#fff; border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid #ffe0b2; overflow:hidden;">
            <div style="overflow-x:auto;">
              <table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:right;">
                <thead>
                  <tr style="background:#e65100; color:#fff; height:42px;">
                    <th style="padding:8px 12px; font-weight:700; width:90px;">עיר</th>
                    <th style="padding:8px 12px; font-weight:700; min-width:140px;">שם הקבוצה</th>
                    <th style="padding:8px 12px; font-weight:700; width:130px;">סוג קבוצה</th>
                    <th style="padding:8px 12px; font-weight:700; min-width:140px;">כתובת</th>
                    <th style="padding:8px 12px; font-weight:700; text-align:center; width:95px; background:#bf360c;">מנות מזון</th>
                    <th style="padding:8px 12px; font-weight:700; min-width:220px;">הערות</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredNutrition.length === 0 ? `
                    <tr>
                      <td colspan="6" style="text-align:center; padding:40px 20px; color:#999;">
                        <div style="font-size:2rem; margin-bottom:8px;">🥣</div>
                        <div style="font-weight:700; font-size:1rem; color:#555;">לא נמצאו קבוצות הזנה בלבד לעיר זו</div>
                      </td>
                    </tr>
                  ` : filteredNutrition.map((n, idx) => {
                    const bg = idx % 2 === 0 ? '#fff' : '#fffbf7';
                    return `
                      <tr style="background:${bg}; border-bottom:1px solid #ffe0b2; transition:background 0.15s;" onmouseover="this.style.background='#fff3e0'" onmouseout="this.style.background='${bg}'">
                        <td style="padding:10px 12px; font-weight:700; color:#37474f;">
                          <span style="background:#eceff1; padding:2px 6px; border-radius:4px; font-size:0.75rem;">${n.city}</span>
                        </td>
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
        `)}

      </div>
    `;

    container.innerHTML = html;
  };

  // Switch mode to Matzava
  window.openMatzava = function () {
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
    }
  };

  // Open Matzava as a standalone modal (for Field Coordinators & Isolated App)
  window.openMatzavaModal = async function () {
    let modal = document.getElementById('matzava-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'matzava-modal';
      modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.7); z-index:9999999; display:flex; justify-content:center; align-items:center; padding:12px; box-sizing:border-box; backdrop-filter:blur(3px);';
      modal.innerHTML = `
        <div style="background:#f8fafc; width:100%; max-width:1300px; height:92vh; border-radius:14px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.3); border:1px solid #cbd5e1;">
          <div style="padding:12px 18px; background:#1a237e; color:#fff; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
            <div style="font-weight:800; font-size:1.1rem; display:flex; align-items:center; gap:8px;">
              <span>👶 מצב"ה — מספרי ילדים ואלרגיות בצהרונים</span>
            </div>
            <button onclick="document.getElementById('matzava-modal').style.setProperty('display','none','important')" style="background:rgba(255,255,255,0.15); border:none; color:#fff; font-size:1.1rem; border-radius:6px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="סגור">✕</button>
          </div>
          <div id="matzava-modal-body" style="flex:1; overflow-y:auto; padding:8px;"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('visibility', 'visible', 'important');
    const body = document.getElementById('matzava-modal-body');
    await window.renderMatzavaTab(body);
  };

})();

