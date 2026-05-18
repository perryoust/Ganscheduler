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

window.importBulkSchedule = function(input) {
  const file = input.files[0];
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
      
      const allSups = (window.getAllSup ? window.getAllSup() : []);
      const allRecords = [];
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
          const garden = window.utils.findGarden(gardenName, city);
          if (!garden) {
            report.noGarden.push({ name: gardenName, city, row: i + 1, sheet: sheetName });
            continue;
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
            // Use lenient match
            var supplierName = lenient.name;
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
          const cluster = cols.cluster !== -1 ? String(row[cols.cluster] || '').trim() : '';
          const coordinator = cols.coordinator !== -1 ? String(row[cols.coordinator] || '').trim() : '';
          const street = cols.street !== -1 ? String(row[cols.street] || '').trim() : '';
          const cls = cols.cls !== -1 ? String(row[cols.cls] || '').trim() : '';
          const phone = cols.phone !== -1 ? String(row[cols.phone] || '').trim() : '';

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
      msg += '   • ספקים שזוהו: ' + report.suppliersFound.size + '\n\n';

      if (report.noGarden.length > 0) {
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

      if (!confirm(msg)) {
        if (window._fbStartPolling) window._fbStartPolling();
        window._importInProgress = false;
        input.value = '';
        return;
      }

      // ═══ STEP 2: FULL REPLACE SCH ═══
      window.showCopyToast('⏳ מחליף נתונים...');
      
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

      // CRITICAL: Set useSraws = false BEFORE saving
      window.useSraws = false;
      window.SCH = dedupedRecords;
      console.log('[Import v6] SCH replaced with ' + window.SCH.length + ' records (useSraws=false)');

      // Apply auto-makeup matching
      if (window.DataManager && window.DataManager.applyAutoMakeupMatching) {
        window.DataManager.applyAutoMakeupMatching();
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
        alert('✅ הייבוא הושלם בהצלחה!\n\n'
          + window.SCH.length + ' פעילויות נשמרו.\n'
          + 'המערכת תתרענן כעת.');
        location.reload();
      } else {
        alert('⚠️ הנתונים נשמרו מקומית אך השמירה לענן נכשלה.\n'
          + 'לחץ על כפתור הסנכרון ידנית, ואז רענן את הדף.');
        if (window._fbStartPolling) window._fbStartPolling();
        // Refresh UI without reload to show imported data
        if (window.refresh) window.refresh();
      }
    } catch (err) {
      console.error('[Import v6] Error:', err);
      alert('❌ שגיאה: ' + err.message);
      if (window._fbStartPolling) window._fbStartPolling();
    } finally {
      window._importInProgress = false;
      input.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
};

// ═══════════════════════════════════════════════════
// HEADER DETECTION — Smart column mapping
// ═══════════════════════════════════════════════════
function _detectHeaders(rows) {
  // Scan first 10 rows for the best header match
  let bestHeader = null;
  let bestScore = 0;

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const r = rows[i];
    if (!r || !Array.isArray(r)) continue;

    const cols = {
      date: -1, garden: -1, city: -1, supplier: -1, groups: -1,
      time: -1, notes: -1, actType: -1, cluster: -1, coordinator: -1,
      street: -1, cls: -1, phone: -1
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
  // Step 1: Determine base status from Groups column
  const grValue = (rawGr === undefined || rawGr === null) ? '' : String(rawGr).trim();
  const grNum = Number(grValue);
  
  let st = 'ok';
  let grp = 1;
  
  if (grValue === '' || grNum === 0 || isNaN(grNum)) {
    // Groups column is empty or zero → NOT OCCURRED
    st = 'nohap';
    grp = 0;
  } else {
    st = 'ok';
    grp = Math.max(1, parseInt(grValue) || 1);
  }
  
  // Step 2: Refine status based on notes
  if (notes) {
    const lnt = notes.toLowerCase();
    
    // CANCELLED patterns (override everything)
    if (/בוטל|מבוטל|מצב בטחוני|סגר|שביתה|מסיבת פורים/.test(lnt)) {
      st = 'can';
      grp = 0;
    }
    // NOT OCCURRED patterns (forces status to nohap even if groups was not empty!)
    else if (/לא התקיים|הוקדם ל|נדחה ל|הוזז ל|עבר ל|עובר ל|חסר מדריך|מדריך חסר|לא הגיע|חוסר מדריך|אין מדריך|לא נשאר|עזב|חולה|נתקע|נתקעה|במחלה|מסיבות אישיות|לא יכול|לא יכל|לא מגיע|לא מרגיש טוב|לא עונה|לא הודיע|טעה ב|טעות ב|השלמה לא התקיימה|יושלם ב|הועבר ל|חשב ש|איחר לא|לא מתקיים/.test(lnt)) {
      st = 'nohap';
      grp = 0;
    }
    // MAKEUP / OCCURRED patterns — ONLY if groups column has a value
    else if (st === 'ok' && /הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|השלמה|במקום|התקיים|הושלם|הוחלף|הצלבת|החלפה|מדריך מחליף|מדריך משלים|מדריך השלים/.test(lnt)) {
      // Already ok — keep it
    }
    
    // KEY RULE: If groups column is empty (nohap), NEVER flip back to 'ok' based on notes alone.
    // The groups column is the source of truth for whether an activity occurred.
  }
  
  return { st, grp };
}
