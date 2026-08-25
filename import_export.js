/**
 * Bulk Import/Export Schedule Logic
 * v6.0.0 - Complete Overwrite Import (No SRAWS)
 * 
 * FLOW:
 * 1. Stop Firebase polling (prevent overwrite)
 * 2. Parse Excel → records (both sheets)
 * 3. FULL REPLACE of SCH (no SRAWS merging)
 * 4. Set useSraws = false globally
 * 5. Save to localStorage
 * 6. Push to Firebase (with retry)
 * 7. Show import report → user clicks reload
 */

window._processExcelFile = function(file) {
  if (!file) return;

  const statusEl = document.getElementById('bulk-import-status');
  if (statusEl) statusEl.innerHTML = '⏳ מנתח נתונים (v6.0)...';

  // STEP 1: Block Firebase polling immediately
  window._importInProgress = true;
  if (window._fbStopPolling) window._fbStopPolling();
  console.log('[Import v6] Started — Firebase polling stopped');

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      if (!window.XLSX) throw new Error('ספריית XLSX לא נטענה');
      const workbook = window.XLSX.read(data, { type: 'array', cellDates: true });
      
      const baseSups = window.getAllSup ? window.getAllSup() : [];
      const allSups = [];
      baseSups.forEach(s => {
        if (s.fullNames && s.fullNames.length > 0) {
          s.fullNames.forEach(fn => allSups.push({ name: fn }));
        } else {
          allSups.push({ name: s.name });
        }
      });
      const allRecords = [];
      const newClustersMap = {}; // Collect clusters from file
      const report = {
        sheets: [],
        totalRows: 0,
        imported: 0,
        skipped: 0,
        noGarden: [],
        noDate: 0,
        noSupplier: [],
        statusBreakdown: { ok: 0, nohap: 0, can: 0 },
        gardensFound: new Set(),
        suppliersFound: new Set()
      };

      // ═══ PROCESS EACH SHEET ═══
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length < 2) continue;

        const sheetReport = { name: sheetName, rows: 0, imported: 0, skipped: 0 };

        // ── Header Detection ──
        const headerInfo = _detectHeaders(rows);
        if (!headerInfo) {
          console.warn('[Import] Sheet "' + sheetName + '": no valid header found');
          sheetReport.skipped = rows.length;
          report.sheets.push(sheetReport);
          continue;
        }

        const { headerRow, cols } = headerInfo;
        console.log('[Import] Sheet "' + sheetName + '" → Header row ' + headerRow + ':', cols);

        // ── Process Data Rows ──
        for (let i = headerRow + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 4) continue;
          sheetReport.rows++;
          report.totalRows++;

          // 1. DATE PARSING
          const d = _parseDate(row[cols.date]);
          if (!d) { report.noDate++; continue; }

          // 2. GARDEN PARSING
          const gardenName = String(row[cols.garden] || '').trim();
          const city = String(row[cols.city] || '').trim();
          if (!gardenName) continue;
          
          let garden = window.utils.findGarden(gardenName, city);
          
          const age = cols.age !== -1 ? String(row[cols.age] || '').trim() : '';
          const street = cols.street !== -1 ? String(row[cols.street] || '').trim() : '';
          const cls = cols.cls !== -1 ? String(row[cols.cls] || '').trim() : 'גנים';
          const clusterName = cols.cluster !== -1 ? String(row[cols.cluster] || '').trim() : '';
          
          let modified = false;

          if (!garden) {
            // Auto-create garden if not found
            const allG = typeof AG === 'function' ? AG() : [...(window.GARDENS||[]), ...(window._GARDENS_EXTRA||[])];
            const newId = Math.max(...allG.map(g => g.id), 0) + Date.now() % 100000;
            garden = {
              id: newId,
              name: gardenName,
              city: city,
              cls: cls, // Real cls from excel or default 'גנים'
              add: street,
              age: age,
              cluster: clusterName
            };
            modified = true;
            report.newGardensCreated = (report.newGardensCreated || 0) + 1;
            if (!report.newGardensList) report.newGardensList = new Set();
            report.newGardensList.add(`${gardenName} (${city})`);
            console.log(`[Import] Auto-created new garden: ${gardenName} (${city})`);
          } else {
            // Merge new properties if missing
            if (street && !garden.add) { garden.add = street; modified = true; }
            if (age && !garden.age) { garden.age = age; modified = true; }
            if (cls && !garden.cls) { garden.cls = cls; modified = true; }
            if (clusterName && !garden.cluster) { garden.cluster = clusterName; modified = true; }
          }
          
          if (modified) {
            window._GARDENS_EXTRA = window._GARDENS_EXTRA || [];
            // If already in extra, replace it. If not, push it.
            const exIdx = window._GARDENS_EXTRA.findIndex(g => g.id === garden.id);
            if (exIdx >= 0) window._GARDENS_EXTRA[exIdx] = garden;
            else window._GARDENS_EXTRA.push(garden);

            if (Array.isArray(window._GARDENS_ALL)) {
              const allIdx = window._GARDENS_ALL.findIndex(g => g.id === garden.id);
              if (allIdx >= 0) window._GARDENS_ALL[allIdx] = garden;
              else window._GARDENS_ALL.push(garden);
              if (window.activeGardens) window.activeGardens.add(garden.id);
            }
            
            window.supEx = window.supEx || {};
            window.supEx['__gardens_extra'] = window._GARDENS_EXTRA;
          }

          report.gardensFound.add(garden.id);

          // 3. SUPPLIER PARSING  
          const rawSupplier = String(row[cols.supplier] || '').trim();
          if (!rawSupplier || rawSupplier === 'null') { sheetReport.skipped++; report.skipped++; continue; }
          
          const supplier = window.utils.findSupplier(rawSupplier, allSups);
          if (!supplier) {
            // Try a more lenient match - just the first word
            const firstWord = rawSupplier.split(/[\s\-–—]/)[0].trim();
            const lenient = allSups.find(s => window.utils.norm(s.name).startsWith(window.utils.norm(firstWord)));
            if (!lenient) {
              report.noSupplier.push({ name: rawSupplier, garden: gardenName, row: i + 1, sheet: sheetName });
              sheetReport.skipped++; report.skipped++;
              continue;
            }
            
            // Check if user explicitly specified a new activity with a dash
            if (rawSupplier.match(/[-\u2010-\u2015\u2212\u05BE\uFE58\uFE63\uFF0D\/]/)) {
              var supplierName = rawSupplier.trim(); // keep the explicit activity!
            } else {
              // Use lenient match
              var supplierName = lenient.name;
            }
          } else {
            var supplierName = supplier.name;
          }
          report.suppliersFound.add(supplierName);

          // 4. TIME PARSING
          const t = _parseTime(row[cols.time]);

          // 5. GROUPS / STATUS PARSING (CRITICAL!)
          const rawGr = row[cols.groups];
          const notes = String(row[cols.notes] || '').trim();
          const { st, grp } = _parseStatus(rawGr, notes);

          // 6. SPLIT SUPPLIER → Base + Activity
          const sBase = window.supBase ? window.supBase(supplierName) : supplierName;
          const sAct = window.supAct ? window.supAct(supplierName) : '';

          // 7. EXTRA FIELDS
          const actType = cols.actType !== -1 ? String(row[cols.actType] || '').trim() : '';
          const coordinator = cols.coordinator !== -1 ? String(row[cols.coordinator] || '').trim() : '';
          const phone = cols.phone !== -1 ? String(row[cols.phone] || '').trim() : '';

          if (clusterName) {
            if (!newClustersMap[clusterName]) newClustersMap[clusterName] = new Set();
            newClustersMap[clusterName].add(Number(garden.id));
          }

          // 8. BUILD RECORD
          const fId = window.utils.getEventId(d, Number(garden.id), sBase, sAct, t);
          
          allRecords.push({
            id: fId,
            d: d,
            g: garden.id,
            a: sBase,
            t: t,
            st: st,
            nt: notes,
            act: sAct,
            tp: actType || 'חוג',
            grp: grp,
            _isImported: true
          });
          
          sheetReport.imported++;
          report.imported++;
          report.statusBreakdown[st] = (report.statusBreakdown[st] || 0) + 1;
        }
        
        report.sheets.push(sheetReport);
      }

      // ═══ VALIDATION ═══
      if (allRecords.length === 0) {
        throw new Error('לא נמצאו נתונים תקינים לעדכון.\n'
          + 'נסרקו ' + report.sheets.length + ' גיליונות ו-' + report.totalRows + ' שורות.\n'
          + '(חסרו תאריכים: ' + report.noDate + ', גנים לא זוהו: ' + report.noGarden.length + ', ספקים לא זוהו: ' + report.noSupplier.length + ')');
      }

      // ═══ BUILD CONFIRMATION MESSAGE ═══
      let msg = '📊 דוח ייבוא:\n\n';
      msg += '✅ ' + allRecords.length + ' פעילויות נמצאו לעדכון\n';
      msg += '   • מתקיים: ' + (report.statusBreakdown.ok || 0) + '\n';
      msg += '   • לא התקיים: ' + (report.statusBreakdown.nohap || 0) + '\n';
      msg += '   • בוטל: ' + (report.statusBreakdown.can || 0) + '\n';
      msg += '   • גנים שזוהו: ' + report.gardensFound.size + '\n';
      msg += '   • ספקים שזוהו: ' + report.suppliersFound.size + '\n';
      if (Object.keys(newClustersMap).length > 0) {
        msg += '   • אשכולות בקובץ: ' + Object.keys(newClustersMap).length + '\n';
        
        window.clusters = window.clusters || {};
        for (const [cName, gSet] of Object.entries(newClustersMap)) {
           let existingCl = Object.values(window.clusters).find(c => c.name === cName);
           if (!existingCl) {
              const clId = 'c' + Date.now() + Math.floor(Math.random() * 1000);
              window.clusters[clId] = { id: clId, name: cName, gardenIds: Array.from(gSet) };
           } else {
              const merged = new Set([...(existingCl.gardenIds||[]), ...Array.from(gSet)]);
              existingCl.gardenIds = Array.from(merged);
           }
        }
      }
      msg += '\n';

      if (report.newGardensCreated > 0) {
        msg += `✨ נוצרו אוטומטית ${report.newGardensCreated} גנים חדשים שלא היו במערכת:\n`;
        const uniqueNew = [...report.newGardensList];
        uniqueNew.slice(0, 10).forEach(g => { msg += '   • ' + g + '\n'; });
        if (uniqueNew.length > 10) msg += '   • ...ועוד ' + (uniqueNew.length - 10) + '\n';
        msg += '\n';
      }

      if (report.noGarden && report.noGarden.length > 0) {
        msg += '⚠️ ' + report.noGarden.length + ' שורות עם גנים לא מזוהים:\n';
        const uniqueGardens = [...new Set(report.noGarden.map(g => g.name + ' (' + g.city + ')'))];
        uniqueGardens.slice(0, 10).forEach(g => { msg += '   • ' + g + '\n'; });
        if (uniqueGardens.length > 10) msg += '   • ...ועוד ' + (uniqueGardens.length - 10) + '\n';
        msg += '\n';
      }

      if (report.noSupplier.length > 0) {
        msg += '⚠️ ' + report.noSupplier.length + ' שורות עם ספקים לא מזוהים:\n';
        const uniqueSups = [...new Set(report.noSupplier.map(s => s.name))];
        uniqueSups.slice(0, 10).forEach(s => { msg += '   • ' + s + '\n'; });
        if (uniqueSups.length > 10) msg += '   • ...ועוד ' + (uniqueSups.length - 10) + '\n';
        msg += '\n';
      }

      msg += '🔴 פעולה זו תחליף את כל השיבוצים הקיימים!\nלהמשיך?';

      if (!await window.spConfirm(msg)) {
        if (window._fbStartPolling) window._fbStartPolling();
        window._importInProgress = false;
        input.value = '';
        return;
      }

      // ═══ STEP 2: MERGE WITH EXISTING SCH ═══
      window.showCopyToast('⏳ ממזג נתונים...');
      
      const existingMapById = {};
      const existingMapByKey = {};
      if (window.SCH) {
        window.SCH.forEach(s => {
          existingMapById[s.id] = s;
          const normA = window.utils ? window.utils.megaClean(s.a) : s.a;
          const k = s.d + '|' + Number(s.g) + '|' + normA + '|' + s.t;
          existingMapByKey[k] = s;
        });
      }

      // Deduplicate imported records (same Date+Garden+Supplier+Time)
      const seen = {};
      const dedupedRecords = [];
      allRecords.forEach(r => {
        const normA = window.utils ? window.utils.megaClean(r.a) : r.a;
        const k = r.d + '|' + Number(r.g) + '|' + normA + '|' + r.t;
        if (!seen[k]) {
          seen[k] = r;
          dedupedRecords.push(r);
        } else {
          // Keep the more meaningful status
          const existing = seen[k];
          if (r.st !== 'ok' && existing.st === 'ok') existing.st = r.st;
          if (r.grp > existing.grp) existing.grp = r.grp;
          if (r.nt && !existing.nt.includes(r.nt)) existing.nt = (existing.nt ? existing.nt + ' | ' : '') + r.nt;
        }
      });

      const finalRecords = [];
      const processedIds = new Set();
      
      dedupedRecords.forEach(r => {
        const normA = window.utils ? window.utils.megaClean(r.a) : r.a;
        const k = r.d + '|' + Number(r.g) + '|' + normA + '|' + r.t;
        let old = existingMapById[r.id] || existingMapByKey[k];
        
        if (old) {
          // Preserve custom properties
          if (old._compByMakeup !== undefined) r._compByMakeup = old._compByMakeup;
          if (old._isMakeup !== undefined) r._isMakeup = old._isMakeup;
          if (old._makeupFrom !== undefined) r._makeupFrom = old._makeupFrom;
          if (old._postFrom !== undefined) r._postFrom = old._postFrom;
          if (old._isManual !== undefined) r._isManual = old._isManual;
          // Preserve original ID to maintain links
          r.id = old.id;
        }
        finalRecords.push(r);
        processedIds.add(String(r.id));
      });

      // Removed per user request: No longer retaining manually added events (makeups, exceptions) not found in Excel.
      // The Excel file is now the absolute source of truth.

      // CRITICAL: Set useSraws = false BEFORE saving
      window.useSraws = false;
      window.SCH = finalRecords;
      console.log('[Import v6] SCH replaced with ' + window.SCH.length + ' records (merged manual events & states)');

      // Replace clusters if any found in the file
      if (Object.keys(newClustersMap).length > 0) {
        window.clusters = {};
        Object.entries(newClustersMap).forEach(([cName, gidsSet]) => {
          const cid = 'c_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
          window.clusters[cid] = {
            id: cid,
            name: cName,
            gardenIds: Array.from(gidsSet)
          };
        });
        console.log('[Import v6] Replaced clusters with ' + Object.keys(window.clusters).length + ' new clusters from Excel');
      }

      // Apply auto-makeup matching      // Auto-Makeup disabled by user request
      // if (window.DataManager && window.DataManager.applyAutoMakeupMatching) {
      //   window.DataManager.applyAutoMakeupMatching();
      // }

      // CRITICAL SAFEGUARD: Prevent wiping out holidays if Firebase didn't load them in time before import
      if (!window.holidays || window.holidays.length === 0) {
        try {
          const prevLs = JSON.parse(window._safeLS.getItem('ganv5') || '{}');
          if (prevLs.holidays && prevLs.holidays.length > 0) {
            window.holidays = prevLs.holidays;
            console.warn('[Import v6] Recovered holidays from previous localStorage to prevent wipe.');
          }
        } catch(e) {}
      }

      // ═══ STEP 3: Save to localStorage ═══
      const lsData = {
        ch: window.SCH,
        pairs: window.pairs || [],
        supEx: window.supEx || {},
        clusters: window.clusters || {},
        holidays: window.holidays || [],
        pairBreaks: window.pairBreaks || {},
        managers: window.managers || {},
        blockedDates: window.blockedDates || {},
        gardenBlocks: window.gardenBlocks || {},
        invoices: window.INVOICES || [],
        vatRate: window.VAT_RATE || 18,
        activeGardens: window.activeGardens ? [...window.activeGardens] : null,
        useSraws: false  // ← CRITICAL: tells _applyYearData to skip SRAWS on next load
      };
      window._safeLS.setItem('ganv5', JSON.stringify(lsData));
      console.log('[Import v6] Saved to localStorage');

      // ═══ STEP 4: Push to Firebase ═══
      window.showCopyToast('⏳ שומר שינויים לענן...');
      let fbOk = await window.saveToFirebase(true, true);
      
      if (!fbOk) {
        console.error('[Import v6] Firebase save FAILED — retrying...');
        await new Promise(r => setTimeout(r, 1500));
        fbOk = await window.saveToFirebase(true, true);
      }

      // ═══ STEP 5: Show result ═══
      if (fbOk) {
        console.log('[Import v6] Firebase save CONFIRMED');
        _spAlertDialog('✅ הייבוא הושלם בהצלחה!\n\n'
          + window.SCH.length + ' פעילויות נשמרו.\n'
          + 'המערכת תתרענן כעת.');
        location.reload();
      } else {
        _spAlertDialog('⚠️ הנתונים נשמרו מקומית אך השמירה לענן נכשלה.\n'
          + 'לחץ על כפתור הסנכרון ידנית, ואז רענן את הדף.');
        if (window._fbStartPolling) window._fbStartPolling();
        // Refresh UI without reload to show imported data
        if (window.refresh) window.refresh();
      }
    } catch (err) {
      console.error('[Import v6] Error:', err);
      _spAlertDialog('❌ שגיאה: ' + err.message);
      if (window._fbStartPolling) window._fbStartPolling();
    } finally {
      window._importInProgress = false;
      if (input) input.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
};

window.importBulkSchedule = function(input) {
  window._processExcelFile(input.files[0]);
  
  // Save handle if possible
  if (window.showOpenFilePicker && input.files && input.files.length > 0 && input.files[0].handle) {
      _saveSchHandle(input.files[0].handle);
  }
};

// ==============================================
// QUICK SCAN FUNCTIONALITY
// ==============================================
const SCH_DB_NAME = "GanFileHandleDB";
function _getSchDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SCH_DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore("handles");
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}
async function _saveSchHandle(handle) {
  try {
    const db = await _getSchDb();
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").put(handle, "schExcel");
  } catch (e) {
    console.error("Could not save file handle", e);
  }
}
async function _getSchHandle() {
  try {
    const db = await _getSchDb();
    const tx = db.transaction("handles", "readonly");
    return new Promise(resolve => {
      const req = tx.objectStore("handles").get("schExcel");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

window.quickScanSchedule = async function() {
  if (!window.showOpenFilePicker) {
    alert("הדפדפן שלך אינו תומך בסריקה מהירה. אנא השתמש בכפתור העלאת קובץ רגיל.");
    return;
  }
  
  let handle = await _getSchHandle();
  
  try {
    if (!handle) {
      const handles = await window.showOpenFilePicker({
        types: [{ description: 'Excel Files', accept: {'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls']} }],
        multiple: false
      });
      handle = handles[0];
      await _saveSchHandle(handle);
    }
    
    // Verify permission
    if ((await handle.queryPermission({ mode: 'read' })) !== 'granted') {
      if ((await handle.requestPermission({ mode: 'read' })) !== 'granted') {
         alert("לא ניתנה הרשאת גישה לקובץ.");
         return;
      }
    }
    
    const file = await handle.getFile();
    // Re-use import logic (this also saves the handle if successful)
    window._processExcelFile(file);

  } catch(e) {
     console.error(e);
     if (e.name !== 'AbortError') {
       alert("שגיאה בסריקה המהירה: " + e.message + "\n\n(אם הקובץ זז או נמחק, יש לבחור אותו מחדש דרך הכפתור הרגיל)");
       // Clear saved handle so user can try again
       try {
           const db = await _getSchDb();
           db.transaction("handles", "readwrite").objectStore("handles").delete("schExcel");
       } catch(err){}
     }
  }
};


// ═══════════════════════════════════════════════════
// HEADER DETECTION — Smart column mapping
// ═══════════════════════════════════════════════════
function _detectHeaders(rows) {
  // Scan first 50 rows for the best header match
  let bestHeader = null;
  let bestScore = 0;

  for (let i = 0; i < Math.min(50, rows.length); i++) {
    const r = rows[i];
    if (!r || !Array.isArray(r)) continue;

    const cols = {
      date: -1, garden: -1, city: -1, supplier: -1, groups: -1,
      time: -1, notes: -1, actType: -1, cluster: -1, coordinator: -1,
      street: -1, cls: -1, phone: -1, age: -1
    };
    let score = 0;

    r.forEach((c, idx) => {
      if (!c) return;
      const n = String(c).trim().toLowerCase().replace(/['"״׳]/g, '');

      // Date
      if (/^תאריך$|^date$/.test(n)) { cols.date = idx; score += 3; }
      // Garden name
      else if (/שם הצהרון|שם הגן|^גן$|garden/.test(n)) { cols.garden = idx; score += 3; }
      // City
      else if (/^עיר$|^city$/.test(n)) { cols.city = idx; score += 2; }
      // Supplier (שם החוג = supplier – activity)
      else if (/שם החוג|^ספק$|^חוג$|supplier/.test(n)) { cols.supplier = idx; score += 3; }
      // Groups count (קב')
      else if (/^קב|קבוצות|groups/.test(n)) { cols.groups = idx; score += 3; }
      // Time
      else if (/^שעה$|^time$/.test(n)) { cols.time = idx; score += 2; }
      // Notes
      else if (/^הערות$|^notes$/.test(n)) { cols.notes = idx; score += 2; }
      // Activity type (חוג/הפעלה)
      else if (/חוג.*הפעלה|הפעלה|סוג פעילות/.test(n)) { cols.actType = idx; score += 1; }
      // Cluster
      else if (/אשכול/.test(n)) { cols.cluster = idx; score += 1; }
      // Coordinator
      else if (/^רכז$|coordinator/.test(n)) { cols.coordinator = idx; score += 1; }
      // Street
      else if (/^רחוב$|^כתובת$|street/.test(n)) { cols.street = idx; score += 1; }
      // Classification (גן/ביה"ס)
      else if (/^סיווג$|^סוג$/.test(n)) { cols.cls = idx; score += 1; }
      // Phone
      else if (/טלפון|phone/.test(n)) { cols.phone = idx; score += 1; }
      // Age
      else if (/^גיל$|age/.test(n)) { cols.age = idx; score += 1; }
    });

    if (score > bestScore && cols.date !== -1 && cols.garden !== -1) {
      bestScore = score;
      bestHeader = { headerRow: i, cols };
    }
  }

  return bestHeader;
}

// ═══════════════════════════════════════════════════
// DATE PARSING — Handles Date objects, serial numbers, strings
// ═══════════════════════════════════════════════════
function _parseDate(rd) {
  if (!rd) return null;
  let d = '';
  
  if (rd instanceof Date) {
    // Excel Date object — add 12h to avoid timezone issues
    d = new Date(rd.getTime() + 12*3600000).toISOString().slice(0, 10);
  } else if (typeof rd === 'number') {
    // Excel serial date number
    d = new Date(new Date(1899,11,30).getTime() + rd*86400000 + 12*3600000).toISOString().slice(0, 10);
  } else if (typeof rd === 'string') {
    // String formats: dd.mm.yyyy, dd/mm/yyyy, dd-mm-yyyy
    const m = rd.match(/(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})/);
    if (m) d = `${m[3].length===2?'20'+m[3]:m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  }
  
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return d;
}

// ═══════════════════════════════════════════════════
// TIME PARSING — Handles decimal, string, serial
// ═══════════════════════════════════════════════════
function _parseTime(rt) {
  if (!rt) return '14:00';
  
  if (typeof rt === 'number') {
    // Excel time as fraction of day (0.5 = 12:00)
    const mTot = Math.round(rt * 1440);
    return `${Math.floor(mTot/60).toString().padStart(2,'0')}:${(mTot%60).toString().padStart(2,'0')}`;
  }
  
  const tm = String(rt).trim().match(/(\d{1,2}):(\d{1,2})/);
  if (tm) return tm[1].padStart(2,'0') + ':' + tm[2].padStart(2,'0');
  
  return '14:00';
}

// ═══════════════════════════════════════════════════
// STATUS PARSING — Based on groups column + notes
// ═══════════════════════════════════════════════════
function _parseStatus(rawGr, notes) {
  const grValue = (rawGr === undefined || rawGr === null) ? '' : String(rawGr).trim();
  const grNum = Number(grValue);
  
  let st = 'ok';
  let grp = 1;

  const isMovedTo = notes && /הוקדם ל|נדחה ל|הוזז ל|הקדמה ל|דחייה ל|עבר ל|עובר ל|הועבר ל/i.test(notes);
  
  // Rule #1: Groups column is the absolute source of truth (UNLESS explicitly moved to another date)
  if (isMovedTo || grValue === '' || grNum === 0 || isNaN(grNum)) {
    grp = 0;
    st = 'nohap'; // Default for 0 groups or moved to another day
    
    // Check if explicitly cancelled (and not just a makeup that was cancelled)
    if (notes) {
      const lnt = notes.toLowerCase();
      if (lnt.includes('בוטל') && !lnt.includes('נדחה')) {
        st = 'can'; // Cancellation
      }
    }
  } else {
    grp = Math.max(1, parseInt(grValue) || 1);
    st = 'ok'; // Happened
  }
  
  return { st, grp };
}
