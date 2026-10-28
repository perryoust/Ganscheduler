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
    filterType: 'all',    // 'all' | 'sterile' | 'homemeal' | 'nutrition' | 'schools'
    lastSync: null,
    isLoading: false,
    loadedYear: null
  };

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

  // Load data from Firebase Realtime Database
  window.loadMatzavaFromFirebase = async function (force = false) {
    const y = getYearKey();
    if (!force && window.MATZAVA_STATE.loadedYear === y && window.MATZAVA_STATE.records.length > 0) {
      return;
    }

    window.MATZAVA_STATE.isLoading = true;
    try {
      if (typeof window.fbGet === 'function') {
        const data = await window.fbGet(`/matzava/${y}`);
        if (data) {
          window.MATZAVA_STATE.records = Array.isArray(data.records) ? data.records : Object.values(data.records || {});
          window.MATZAVA_STATE.nutritionOnly = Array.isArray(data.nutritionOnly) ? data.nutritionOnly : Object.values(data.nutritionOnly || {});
          window.MATZAVA_STATE.schools = Array.isArray(data.schools) ? data.schools : Object.values(data.schools || {});
          window.MATZAVA_STATE.lastSync = data.lastSync || null;
        } else {
          window.MATZAVA_STATE.records = [];
          window.MATZAVA_STATE.nutritionOnly = [];
          window.MATZAVA_STATE.schools = [];
          window.MATZAVA_STATE.lastSync = null;
        }
      }
      window.MATZAVA_STATE.loadedYear = y;
    } catch (e) {
      console.warn('[Matzava] Load error:', e);
    } finally {
      window.MATZAVA_STATE.isLoading = false;
    }
  };

  // Save data to Firebase Realtime Database
  window.saveMatzavaToFirebase = async function () {
    if (window.isReadOnly) {
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

    try {
      if (typeof window.fbSet === 'function') {
        await window.fbSet(`/matzava/${y}`, payload);
      } else if (typeof window.fbPatch === 'function') {
        await window.fbPatch(`/matzava/${y}`, payload);
      }
      window.MATZAVA_STATE.lastSync = payload.lastSync;
      if (window.showToast) window.showToast('✅ נתוני מצב"ה נשמרו בענן בהצלחה');
      return true;
    } catch (e) {
      console.error('[Matzava] Save error:', e);
      if (window.showToast) window.showToast('❌ שגיאה בשמירת מצב"ה: ' + e.message);
      return false;
    }
  };

  // Parse a single XLSX buffer using ExcelJS
  window.parseMatzavaWorkbook = async function (arrayBuffer, fileName) {
    if (typeof window.ExcelJS === 'undefined') {
      throw new Error('ספריית ExcelJS לא נטענה');
    }

    const wb = new window.ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);

    // Prefer worksheet named "הזמנה"
    let ws = wb.getWorksheet('הזמנה');
    if (!ws) ws = wb.worksheets[0];
    if (!ws) throw new Error('לא נמצא גיליון בקובץ ' + fileName);

    // Detect city from filename or header
    let city = '';
    const fn = fileName.toLowerCase();
    if (fn.includes('גבעתיים')) city = 'גבעתיים';
    else if (fn.includes('פתח תקוו') || fn.includes('פ"ת')) city = 'פ"ת';
    else if (fn.includes('באר יעקב')) city = 'באר יעקב';
    else if (fn.includes('ראש העין')) city = 'ראש העין';
    else if (fn.includes('בתי ספר')) city = 'בתי ספר';

    const rawRows = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        let text = '';
        if (cell.value !== null && cell.value !== undefined) {
          if (typeof cell.value === 'object' && cell.value.result !== undefined) {
            text = String(cell.value.result);
          } else if (typeof cell.value === 'object' && cell.value.text !== undefined) {
            text = String(cell.value.text);
          } else {
            text = String(cell.value);
          }
        }
        vals[colNumber - 1] = text.trim();
      });
      rawRows.push(vals);
    });

    if (rawRows.length === 0) return { records: [], nutritionOnly: [], schools: [] };

    // Find header row in first 7 rows
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
      throw new Error('לא זוהתה שורת כותרת מתאימה ב-' + fileName);
    }

    const headers = rawRows[headerIdx];
    headers.forEach((h, idx) => {
      if (!h) return;
      if (['שם הגן', 'שם הצהרון', 'שם גן', 'קבוצה'].some(k => h.includes(k))) colMap.name = idx;
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

    const records = [];
    const nutritionOnly = [];
    const schools = [];
    let isNutritionMode = false;

    for (let r = headerIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;
      const joined = row.join(' ');

      if (joined.includes('הזנה בלבד')) {
        isNutritionMode = true;
        continue;
      }
      if (joined.includes('סה"כ ילדים') || joined.includes('סהכ ילדים') || joined.includes('ממוצע ל-') || joined.includes('שינויים במספרי')) {
        continue;
      }

      // Handle Nutrition Only Mode
      if (isNutritionMode) {
        let nutName = colMap.name !== undefined ? (row[colMap.name] || '') : '';
        if (!nutName) {
          const matchNut = row.find(c => ['פטל', 'מורן', 'רותם', 'צבעוני', 'ארז', 'תדהר'].some(k => (c || '').includes(k)));
          if (matchNut) nutName = matchNut;
        }
        if (nutName) {
          let count = 0;
          row.forEach(c => {
            const num = parseInt(c, 10);
            if (!isNaN(num) && num > 0 && num < 100) count = num;
          });
          const nutNotes = row.find(c => (c || '').includes('הזמנת מזון') || (c || '').includes('צמחוני')) || '';
          const nutAddr = colMap.addr !== undefined ? (row[colMap.addr] || '') : (row[1] || '');

          nutritionOnly.push({
            id: 'nut_' + city + '_' + nutName.replace(/\s+/g, '_'),
            city: city,
            name: nutName,
            groupType: 'תקשורת / חנ"מ',
            address: nutAddr,
            kidsTotal: count,
            notes: nutNotes,
            sourceFile: fileName
          });
        }
        continue;
      }

      // Handle Schools vs Kindergartens
      if (city === 'בתי ספר') {
        const groupName = colMap.name !== undefined ? (row[colMap.name] || '') : '';
        if (!groupName || groupName.includes('סה"כ')) continue;

        const schoolCity = colMap.city !== undefined ? (row[colMap.city] || '') : (row[0] || '');
        const schoolAddr = colMap.addr !== undefined ? (row[colMap.addr] || '') : (row[1] || '');
        const kCount = parseInt(colMap.kids !== undefined ? row[colMap.kids] : row[3], 10) || 0;
        const mCount = parseInt(colMap.host !== undefined ? row[colMap.host] : row[4], 10) || kCount;
        const sNotes = colMap.notes !== undefined ? (row[colMap.notes] || '') : (row[6] || '');

        schools.push({
          id: 'sch_' + (schoolCity || 'all') + '_' + (groupName || '').replace(/\s+/g, '_') + '_' + r,
          city: schoolCity || 'בתי ספר',
          address: schoolAddr,
          groupName: groupName,
          kids: kCount,
          mergedKids: mCount,
          notes: sNotes,
          isSterile: sNotes.includes('סטרילי') || sNotes.includes('שומשום') || sNotes.includes('אלרג'),
          isHomeMeal: sNotes.includes('מהבית'),
          sourceFile: fileName
        });
        continue;
      }

      // Kindergarten / After-School Garden
      const gName = colMap.name !== undefined ? (row[colMap.name] || '') : '';
      if (!gName || gName.includes('סה"כ') || gName.includes('ממוצע')) continue;

      const gAddr = colMap.addr !== undefined ? (row[colMap.addr] || '') : '';
      const gAge = colMap.age !== undefined ? (row[colMap.age] || '') : '';
      const k10 = colMap.kids10 !== undefined ? (parseInt(row[colMap.kids10], 10) || 0) : 0;
      const k11 = colMap.kids11 !== undefined ? (parseInt(row[colMap.kids11], 10) || 0) : 0;
      const directKids = colMap.kids !== undefined ? (parseInt(row[colMap.kids], 10) || 0) : 0;

      let tot = 0;
      if (colMap.total !== undefined && row[colMap.total]) {
        tot = parseInt(row[colMap.total], 10) || 0;
      }
      if (!tot) {
        tot = (k10 || k11) ? (k10 + k11) : directKids;
      }

      const host = colMap.host !== undefined ? (row[colMap.host] || '') : '';
      const notes = colMap.notes !== undefined ? (row[colMap.notes] || '') : '';
      const isSterile = notes.includes('סטרילי') || notes.includes('אין להכניס') || notes.includes('אלרג');
      const isHomeMeal = notes.includes('מהבית');

      const matchedG = matchGarden(gName, city);

      records.push({
        id: 'mat_' + city + '_' + gName.replace(/\s+/g, '_'),
        gardenId: matchedG ? matchedG.id : null,
        city: city,
        name: gName,
        matchedName: matchedG ? matchedG.name : gName,
        address: gAddr || (matchedG ? matchedG.st : ''),
        age: gAge || (matchedG ? matchedG.age : ''),
        kids10: k10,
        kids11: k11,
        kidsTotal: tot,
        hostGarden: host || gName,
        isMerged: host && host.trim() !== gName.trim(),
        notes: notes,
        isSterile: isSterile,
        isHomeMeal: isHomeMeal,
        sourceFile: fileName,
        updatedAt: new Date().toISOString()
      });
    }

    return { records, nutritionOnly, schools };
  };

  // Auto-refresh via File System Access API
  window.autoRefreshMatzava = async function () {
    if (window.isReadOnly) {
      if (window.showToast) window.showToast('⚠️ מצב צפייה בלבד - לא ניתן לבצע רענון', 3000);
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
        if (entry.kind === 'file' && entry.name.endsWith('.xlsx') && !entry.name.startsWith('~$')) {
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

    for (let i = 0; i < scannedFiles.length; i++) {
      const entry = scannedFiles[i];
      if (window.showToast) {
        window.showToast(`⏳ קורא (${i + 1}/${scannedFiles.length}): ${entry.name}`, 30000);
      }
      try {
        const file = await entry.getFile();
        const buf = await file.arrayBuffer();
        const res = await window.parseMatzavaWorkbook(buf, entry.name);
        allRecords = allRecords.concat(res.records);
        allNutrition = allNutrition.concat(res.nutritionOnly);
        allSchools = allSchools.concat(res.schools);
        successCount++;
      } catch (err) {
        console.warn(`[Matzava] Failed parsing ${entry.name}:`, err);
      }
    }

    // Deduplicate records by city + name
    const recMap = new Map();
    allRecords.forEach(r => {
      const key = (r.city || '') + '__' + (r.name || '');
      recMap.set(key, r);
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
      const key = (s.city || '') + '__' + (s.groupName || '') + '__' + (s.address || '');
      schMap.set(key, s);
    });
    window.MATZAVA_STATE.schools = Array.from(schMap.values());

    // Save to Firebase RTDB
    await window.saveMatzavaToFirebase();

    // Re-render
    window.renderMatzavaTab();

    const msg = `✅ רענון מצב"ה הושלם בהצלחה!\nנסרקו ${successCount} קבצים:\n• ${window.MATZAVA_STATE.records.length} צהרונים\n• ${window.MATZAVA_STATE.nutritionOnly.length} קבוצות הזנה בלבד\n• ${window.MATZAVA_STATE.schools.length} קבוצות בתי ספר`;
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
        res.records.forEach(r => recMap.set((r.city || '') + '__' + (r.name || ''), r));
        window.MATZAVA_STATE.records = Array.from(recMap.values());

        const nutMap = new Map(window.MATZAVA_STATE.nutritionOnly.map(n => [(n.city || '') + '__' + (n.name || ''), n]));
        res.nutritionOnly.forEach(n => nutMap.set((n.city || '') + '__' + (n.name || ''), n));
        window.MATZAVA_STATE.nutritionOnly = Array.from(nutMap.values());

        const schMap = new Map(window.MATZAVA_STATE.schools.map(s => [(s.city || '') + '__' + (s.groupName || '') + '__' + (s.address || ''), s]));
        res.schools.forEach(s => schMap.set((s.city || '') + '__' + (s.groupName || '') + '__' + (s.address || ''), s));
        window.MATZAVA_STATE.schools = Array.from(schMap.values());

        await window.saveMatzavaToFirebase();
        window.renderMatzavaTab();

        if (window.showToast) {
          window.showToast(`✅ יובאו בהצלחה ${res.records.length} צהרונים מ-${file.name}`);
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

  // Export current view to Excel with ExcelJS (RTL compliant)
  window.exportMatzavaToExcel = async function () {
    if (typeof window.ExcelJS === 'undefined') {
      alert('ExcelJS לא נטען. נסה שוב בעוד מספר שניות.');
      return;
    }

    const filtered = window.getFilteredMatzavaRecords();
    const wb = new window.ExcelJS.Workbook();
    wb.creator = 'טומשין קידס - מצב"ה';
    wb.created = new Date();

    const ws = wb.addWorksheet('מצבה', {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
    });

    ws.columns = [
      { header: 'עיר', key: 'city', width: 14 },
      { header: 'שם הצהרון / גן', key: 'name', width: 22 },
      { header: 'כתובת', key: 'address', width: 25 },
      { header: 'גיל', key: 'age', width: 10 },
      { header: '10 חודשים', key: 'kids10', width: 12 },
      { header: '11 חודשים', key: 'kids11', width: 12 },
      { header: 'סה"כ ילדים', key: 'kidsTotal', width: 14 },
      { header: 'מתקיים ב-', key: 'hostGarden', width: 20 },
      { header: 'סטטוס איחוד', key: 'mergedStatus', width: 15 },
      { header: 'הערות ואלרגיות', key: 'notes', width: 35 }
    ];

    // Style Header Row
    const headerRow = ws.getRow(1);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A237E' }
      };
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rightToLeft' };
    });

    let total10 = 0;
    let total11 = 0;
    let totalKids = 0;

    filtered.forEach((r) => {
      total10 += (r.kids10 || 0);
      total11 += (r.kids11 || 0);
      totalKids += (r.kidsTotal || 0);

      const row = ws.addRow({
        city: r.city,
        name: r.name,
        address: r.address || '',
        age: r.age || '',
        kids10: r.kids10 || '',
        kids11: r.kids11 || '',
        kidsTotal: r.kidsTotal || 0,
        hostGarden: r.hostGarden || r.name,
        mergedStatus: r.isMerged ? 'מאוחד ⚠️' : 'עצמאי',
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

    // Summary Row
    const sumRow = ws.addRow({
      city: 'סה"כ',
      name: `${filtered.length} גנים`,
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

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `מצבה_טומשין_${getYearKey()}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Filter logic
  window.getFilteredMatzavaRecords = function () {
    const s = window.MATZAVA_STATE;
    let list = s.records || [];

    // Coordinator view restriction
    if (window.userRole === 'coordinator' && Array.isArray(window.coordCities) && window.coordCities.length > 0) {
      list = list.filter(r => window.coordCities.some(c => (r.city || '').includes(c) || c.includes(r.city || '')));
    }

    if (s.selectedCity && s.selectedCity !== 'all') {
      list = list.filter(r => r.city === s.selectedCity);
    }

    if (s.searchQuery) {
      const q = s.searchQuery.toLowerCase().trim();
      list = list.filter(r =>
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.address && r.address.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q)) ||
        (r.hostGarden && r.hostGarden.toLowerCase().includes(q))
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

  // Main UI Render Function
  window.renderMatzavaTab = async function (targetEl) {
    const container = targetEl || document.getElementById('p-matzava');
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
    const records = window.getFilteredMatzavaRecords();
    const isCoord = (window.userRole === 'coordinator' || window.userRole === 'view' || window.isReadOnly);

    // Compute stats
    let totalKids = 0;
    let total10 = 0;
    let total11 = 0;
    let sterileCount = 0;
    let homeMealCount = 0;
    let mergedCount = 0;

    records.forEach(r => {
      totalKids += (r.kidsTotal || 0);
      total10 += (r.kids10 || 0);
      total11 += (r.kids11 || 0);
      if (r.isSterile) sterileCount++;
      if (r.isHomeMeal) homeMealCount++;
      if (r.isMerged) mergedCount++;
    });

    const avgKids = records.length > 0 ? (totalKids / records.length).toFixed(1) : 0;
    const nutCount = s.nutritionOnly.length;
    const schCount = s.schools.length;

    // Available cities list
    const citiesSet = new Set();
    (s.records || []).forEach(r => { if (r.city) citiesSet.add(r.city); });
    const availableCities = Array.from(citiesSet);

    let html = `
      <div class="matzava-wrapper" style="direction:rtl; font-family:'Assistant',sans-serif; padding:12px; max-width:1440px; margin:0 auto;">
        
        <!-- TOP CONTROL BAR -->
        <div style="background:#fff; border-radius:12px; padding:16px; box-shadow:0 2px 12px rgba(0,0,0,0.06); margin-bottom:16px; border:1px solid #e0e0e0;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:1.8rem;">👶</span>
              <div>
                <h2 style="margin:0; font-size:1.3rem; color:#1a237e; font-weight:800; display:flex; align-items:center; gap:8px;">
                  מצב"ה — מספרי ילדים ואלרגיות בצהרונים
                  <span style="font-size:0.75rem; background:#e8eaf6; color:#283593; padding:2px 8px; border-radius:12px; font-weight:700;">${getYearKey()}</span>
                </h2>
                <div style="font-size:0.8rem; color:#666; margin-top:2px;">
                  ${s.lastSync ? `סנכרון אחרון: ${new Date(s.lastSync).toLocaleString('he-IL')}` : 'טרם נסרקו קבצים'}
                </div>
              </div>
            </div>

            <!-- ACTION BUTTONS -->
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              ${!isCoord ? `
                <button class="btn" onclick="window.autoRefreshMatzava()" 
                  style="background:#2e7d32; color:#fff; border-radius:8px; font-weight:700; padding:8px 14px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; border:none; box-shadow:0 2px 6px rgba(46,125,50,0.3);" 
                  title="סריקה אוטומטית של תיקיית המצב''ה">
                  ⚡ רענון אוטומטי
                </button>
                <label class="btn" style="background:#1565c0; color:#fff; border-radius:8px; font-weight:700; padding:8px 14px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; border:none; margin:0;" title="ייבוא ידני של קובץ אקסל בודד">
                  📂 ייבוא קובץ
                  <input type="file" accept=".xlsx" style="display:none;" onchange="window.importSingleMatzavaFile(this)">
                </label>
              ` : ''}
              
              <button class="btn" onclick="window.exportMatzavaToExcel()" 
                style="background:#00838f; color:#fff; border-radius:8px; font-weight:700; padding:8px 14px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; border:none;" 
                title="ייצוא הדוח לאקסל מעוצב">
                📊 ייצוא לאקסל
              </button>

              <button class="btn" onclick="window.loadMatzavaFromFirebase(true).then(()=>window.renderMatzavaTab())" 
                style="background:#f5f5f5; color:#333; border:1px solid #ccc; border-radius:8px; padding:8px 12px; font-size:0.85rem; cursor:pointer;" 
                title="רענן תצוגה מהענן">
                🔄
              </button>
            </div>
          </div>

          <!-- FILTERS & SEARCH -->
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; background:#f9fbe7; padding:10px 14px; border-radius:8px; border:1px solid #e6ee9c;">
            <!-- City Dropdown -->
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:0.85rem; font-weight:700; color:#33691e;">עיר:</span>
              <select onchange="window.MATZAVA_STATE.selectedCity=this.value; window.renderMatzavaTab();" 
                style="padding:6px 10px; border-radius:6px; border:1px solid #c0ca33; background:#fff; font-weight:700; font-size:0.85rem; outline:none; cursor:pointer;">
                <option value="all" ${s.selectedCity === 'all' ? 'selected' : ''}>🌍 כל הערים (${s.records.length})</option>
                ${availableCities.map(c => `
                  <option value="${c}" ${s.selectedCity === c ? 'selected' : ''}>${c}</option>
                `).join('')}
              </select>
            </div>

            <!-- Free Text Search -->
            <div style="flex:1; min-width:200px; position:relative;">
              <input type="text" placeholder="🔍 חפש גן, כתובת, הערת אלרגיה..." 
                value="${s.searchQuery || ''}" 
                oninput="window.MATZAVA_STATE.searchQuery=this.value; window.renderMatzavaTab();" 
                style="width:100%; padding:6px 12px; border-radius:6px; border:1px solid #ccc; font-size:0.85rem; outline:none; box-sizing:border-box;">
              ${s.searchQuery ? `
                <span onclick="window.MATZAVA_STATE.searchQuery=''; window.renderMatzavaTab();" style="position:absolute; left:8px; top:6px; cursor:pointer; color:#999; font-weight:bold;">✕</span>
              ` : ''}
            </div>

            <!-- Category Pills -->
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button onclick="window.MATZAVA_STATE.filterType='all'; window.renderMatzavaTab();" 
                style="padding:4px 10px; border-radius:14px; border:none; font-size:0.75rem; font-weight:700; cursor:pointer; background:${s.filterType==='all' ? '#2e7d32; color:#fff;' : '#e8f5e9; color:#2e7d32;'}">
                הכל
              </button>
              <button onclick="window.MATZAVA_STATE.filterType='sterile'; window.renderMatzavaTab();" 
                style="padding:4px 10px; border-radius:14px; border:none; font-size:0.75rem; font-weight:700; cursor:pointer; background:${s.filterType==='sterile' ? '#c62828; color:#fff;' : '#ffebee; color:#c62828;'}">
                🔴 סטרילי בלבד (${sterileCount})
              </button>
              <button onclick="window.MATZAVA_STATE.filterType='homemeal'; window.renderMatzavaTab();" 
                style="padding:4px 10px; border-radius:14px; border:none; font-size:0.75rem; font-weight:700; cursor:pointer; background:${s.filterType==='homemeal' ? '#f57f17; color:#fff;' : '#fffde7; color:#f57f17;'}">
                🟡 מנה מהבית (${homeMealCount})
              </button>
              <button onclick="window.MATZAVA_STATE.filterType='merged'; window.renderMatzavaTab();" 
                style="padding:4px 10px; border-radius:14px; border:none; font-size:0.75rem; font-weight:700; cursor:pointer; background:${s.filterType==='merged' ? '#6a1b9a; color:#fff;' : '#f3e5f5; color:#6a1b9a;'}">
                ⚖️ איחודים (${mergedCount})
              </button>
            </div>
          </div>
        </div>

        <!-- KPI SUMMARY CARDS -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:16px;">
          <div style="background:#fff; border-radius:10px; padding:12px 16px; border:1px solid #e0e0e0; box-shadow:0 1px 4px rgba(0,0,0,0.04); text-align:center;">
            <div style="font-size:0.75rem; color:#666; font-weight:700;">סה"כ ילדים</div>
            <div style="font-size:1.6rem; color:#1a237e; font-weight:800; line-height:1.2;">${totalKids.toLocaleString()}</div>
            <div style="font-size:0.7rem; color:#888;">${total10 ? `${total10} (10ח') + ${total11} (11ח')` : ''}</div>
          </div>

          <div style="background:#fff; border-radius:10px; padding:12px 16px; border:1px solid #e0e0e0; box-shadow:0 1px 4px rgba(0,0,0,0.04); text-align:center;">
            <div style="font-size:0.75rem; color:#666; font-weight:700;">צהרונים</div>
            <div style="font-size:1.6rem; color:#2e7d32; font-weight:800; line-height:1.2;">${records.length}</div>
            <div style="font-size:0.7rem; color:#888;">ממוצע: <b>${avgKids}</b> לצהרון</div>
          </div>

          <div style="background:#fff; border-radius:10px; padding:12px 16px; border:1px solid #e0e0e0; box-shadow:0 1px 4px rgba(0,0,0,0.04); text-align:center;">
            <div style="font-size:0.75rem; color:#666; font-weight:700;">גנים סטריליים / אלרגיות</div>
            <div style="font-size:1.6rem; color:#c62828; font-weight:800; line-height:1.2;">${sterileCount}</div>
            <div style="font-size:0.7rem; color:#888;">דורשים הקפדה מוחלטת</div>
          </div>

          <div style="background:#fff; border-radius:10px; padding:12px 16px; border:1px solid #e0e0e0; box-shadow:0 1px 4px rgba(0,0,0,0.04); text-align:center;">
            <div style="font-size:0.75rem; color:#666; font-weight:700;">הזנה בלבד (תקשורת)</div>
            <div style="font-size:1.6rem; color:#e65100; font-weight:800; line-height:1.2;">${nutCount}</div>
            <div style="font-size:0.7rem; color:#888;">הזמנת מזון בלבד</div>
          </div>

          <div style="background:#fff; border-radius:10px; padding:12px 16px; border:1px solid #e0e0e0; box-shadow:0 1px 4px rgba(0,0,0,0.04); text-align:center;">
            <div style="font-size:0.75rem; color:#666; font-weight:700;">קבוצות בתי ספר</div>
            <div style="font-size:1.6rem; color:#00838f; font-weight:800; line-height:1.2;">${schCount}</div>
            <div style="font-size:0.7rem; color:#888;">כיתות א'-ג'</div>
          </div>
        </div>

        <!-- MAIN TABLE -->
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
                ${records.length === 0 ? `
                  <tr>
                    <td colspan="9" style="text-align:center; padding:40px 20px; color:#999;">
                      <div style="font-size:2rem; margin-bottom:8px;">📭</div>
                      <div style="font-weight:700; font-size:1rem; color:#555;">לא נמצאו רשומות מצב"ה</div>
                      <div style="font-size:0.8rem; margin-top:4px;">לחץ על "⚡ רענון אוטומטי" כדי לסרוק את תיקיית הקבצים של שנה זו.</div>
                    </td>
                  </tr>
                ` : records.map((r, idx) => {
                  const bg = idx % 2 === 0 ? '#fff' : '#fcfcfc';
                  const isSterileBg = r.isSterile ? 'background:#fff5f5;' : '';
                  return `
                    <tr style="${isSterileBg || `background:${bg};`} border-bottom:1px solid #eee; transition:background 0.15s;" onmouseover="this.style.background='#f0f4c3'" onmouseout="this.style.background='${r.isSterile ? '#fff5f5' : bg}'">
                      <td style="padding:8px 12px; font-weight:700; color:#37474f;">
                        <span style="background:#eceff1; padding:2px 6px; border-radius:4px; font-size:0.75rem;">${r.city}</span>
                      </td>
                      <td style="padding:8px 12px; font-weight:700; color:#1a237e;">
                        ${r.name}
                        ${r.gardenId ? `<span title="מקושר למאגר צהרונים קיים (#${r.gardenId})" style="cursor:help; font-size:0.7rem; color:#4caf50; margin-right:4px;">✓</span>` : ''}
                      </td>
                      <td style="padding:8px 12px; color:#555; font-size:0.8rem;">${r.address || '-'}</td>
                      <td style="padding:8px 12px; text-align:center;">
                        <span style="background:#e3f2fd; color:#1565c0; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:bold;">${r.age || '-'}</span>
                      </td>
                      <td style="padding:8px 12px; text-align:center; color:#555;">${r.kids10 || '-'}</td>
                      <td style="padding:8px 12px; text-align:center; color:#555;">${r.kids11 || '-'}</td>
                      <td style="padding:8px 12px; text-align:center; font-weight:800; font-size:0.95rem; color:#1a237e; background:rgba(40,53,147,0.06);">
                        ${r.kidsTotal || 0}
                      </td>
                      <td style="padding:8px 12px;">
                        ${r.isMerged ? `
                          <span style="background:#f3e5f5; color:#6a1b9a; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
                            <span>⚖️ ${r.hostGarden}</span>
                          </span>
                        ` : `<span style="color:#777; font-size:0.8rem;">${r.hostGarden || r.name}</span>`}
                      </td>
                      <td style="padding:8px 12px;">
                        ${r.isSterile ? `
                          <div style="background:#ffebee; color:#c62828; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:700; margin-bottom:2px; display:inline-block; border:1px solid #ffcdd2;">
                            🚨 ${r.notes}
                          </div>
                        ` : (r.notes ? `
                          <div style="color:#444; font-size:0.78rem;">
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

        <!-- OPTIONAL NUTRITION ONLY ACCORDION -->
        ${nutCount > 0 ? `
          <div style="margin-top:20px; background:#fff; border-radius:12px; border:1px solid #ffe0b2; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="background:#fff3e0; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="const el=document.getElementById('mat-nut-body'); el.style.display=el.style.display==='none'?'block':'none';">
              <div style="font-weight:800; color:#e65100; font-size:0.95rem; display:flex; align-items:center; gap:8px;">
                <span>🥣 הזנה בלבד — קבוצות תקשורת וחנ"מ (${nutCount})</span>
              </div>
              <span style="font-size:0.8rem; color:#e65100; font-weight:700;">לחץ להצגה / הסתרה ▼</span>
            </div>
            <div id="mat-nut-body" style="padding:12px; display:none;">
              <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
                <thead>
                  <tr style="background:#ffe0b2; color:#bf360c;">
                    <th style="padding:6px 10px;">עיר</th>
                    <th style="padding:6px 10px;">שם הקבוצה</th>
                    <th style="padding:6px 10px;">סוג</th>
                    <th style="padding:6px 10px;">כתובת</th>
                    <th style="padding:6px 10px; text-align:center;">מנות מזון</th>
                    <th style="padding:6px 10px;">הערות</th>
                  </tr>
                </thead>
                <tbody>
                  ${s.nutritionOnly.map(n => `
                    <tr style="border-bottom:1px solid #ffe0b2;">
                      <td style="padding:6px 10px; font-weight:bold;">${n.city}</td>
                      <td style="padding:6px 10px; font-weight:bold; color:#e65100;">${n.name}</td>
                      <td style="padding:6px 10px;">${n.groupType}</td>
                      <td style="padding:6px 10px;">${n.address}</td>
                      <td style="padding:6px 10px; text-align:center; font-weight:bold; color:#bf360c;">${n.kidsTotal}</td>
                      <td style="padding:6px 10px; color:#555;">${n.notes || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        <!-- OPTIONAL SCHOOLS ACCORDION -->
        ${schCount > 0 ? `
          <div style="margin-top:14px; background:#fff; border-radius:12px; border:1px solid #b2ebf2; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="background:#e0f7fa; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="const el=document.getElementById('mat-sch-body'); el.style.display=el.style.display==='none'?'block':'none';">
              <div style="font-weight:800; color:#006064; font-size:0.95rem; display:flex; align-items:center; gap:8px;">
                <span>🏫 בתי ספר — כיתות וקבוצות (${schCount})</span>
              </div>
              <span style="font-size:0.8rem; color:#006064; font-weight:700;">לחץ להצגה / הסתרה ▼</span>
            </div>
            <div id="mat-sch-body" style="padding:12px; display:none;">
              <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
                <thead>
                  <tr style="background:#b2ebf2; color:#006064;">
                    <th style="padding:6px 10px;">עיר</th>
                    <th style="padding:6px 10px;">קבוצה / כיתה</th>
                    <th style="padding:6px 10px;">כתובת / מוסד</th>
                    <th style="padding:6px 10px; text-align:center;">רשומים</th>
                    <th style="padding:6px 10px; text-align:center;">איחוד לקב'</th>
                    <th style="padding:6px 10px;">אלרגיות והערות</th>
                  </tr>
                </thead>
                <tbody>
                  ${s.schools.map(sc => `
                    <tr style="border-bottom:1px solid #e0f7fa;">
                      <td style="padding:6px 10px; font-weight:bold;">${sc.city}</td>
                      <td style="padding:6px 10px; font-weight:bold; color:#00838f;">${sc.groupName}</td>
                      <td style="padding:6px 10px;">${sc.address}</td>
                      <td style="padding:6px 10px; text-align:center; font-weight:bold;">${sc.kids}</td>
                      <td style="padding:6px 10px; text-align:center;">${sc.mergedKids || sc.kids}</td>
                      <td style="padding:6px 10px; color:${sc.isSterile ? '#c62828' : '#555'}; font-weight:${sc.isSterile ? 'bold' : 'normal'};">${sc.notes || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

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
            <button onclick="document.getElementById('matzava-modal').style.display='none'" style="background:rgba(255,255,255,0.15); border:none; color:#fff; font-size:1.1rem; border-radius:6px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="סגור">✕</button>
          </div>
          <div id="matzava-modal-body" style="flex:1; overflow-y:auto; padding:8px;"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    const body = document.getElementById('matzava-modal-body');
    await window.renderMatzavaTab(body);
  };

})();

