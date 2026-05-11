/**
 * Bulk Import/Export Schedule Logic
 * v5.0.0 - Robust Import with Firebase Sync
 * 
 * FLOW:
 * 1. Stop Firebase polling (prevent overwrite)
 * 2. Parse Excel → records
 * 3. DataManager.importBulk() → overwrite SCH
 * 4. Save to localStorage
 * 5. Push to Firebase (direct call)
 * 6. Verify Firebase responded OK
 * 7. ONLY THEN reload the page
 */

window.importBulkSchedule = function(input) {
  const file = input.files[0];
  if (!file) return;

  const statusEl = document.getElementById('bulk-import-status');
  if (statusEl) statusEl.innerHTML = '⏳ מנתח נתונים (v5.0)...';

  // STEP 1: Block Firebase polling immediately
  window._importInProgress = true;
  if (window._fbStopPolling) window._fbStopPolling();
  console.log('[Import] Started — Firebase polling stopped');

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      if (!window.XLSX) throw new Error('ספריית XLSX לא נטענה');
      const workbook = window.XLSX.read(data, { type: 'array', cellDates: true });
      
      // Prioritize sheets: "חוגים" (General) -> "חוסרים להשלמה" (Exceptions)
      const sheetNames = workbook.SheetNames.sort((a, b) => {
        if (a.includes('חוגים')) return -1;
        if (b.includes('חוגים')) return 1;
        return 0;
      });

      const recordsToUpsert = [];
      const coveredDateGardens = new Set();
      const allSups = (window.getAllSup ? window.getAllSup() : []);
      const stats = { sheets: 0, rows: 0, imported: 0, skipped: 0, noGarden: 0, noDate: 0, nohap: 0 };
      
      for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length < 2) continue;

        // Header detection (Best Match)
        let bestHeader = { idx: -1, count: 0, map: {} };
        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const r = rows[i];
          if (!r || !Array.isArray(r)) continue;
          let currentFound = 0, currentMap = {};
          r.forEach((c, idx) => {
            if (!c) return;
            const n = window.utils.norm(c);
            currentMap[n] = idx;
            if (/תאריך|date|יום/.test(n)) currentFound++;
            if (/גן|garden|צהרון/.test(n)) currentFound++;
            if (/חוג|ספק|activity|שם החוג/.test(n)) currentFound++;
          });
          if (currentFound > bestHeader.count) {
            bestHeader = { idx: i, count: currentFound, map: currentMap };
          }
        }

        let col = bestHeader.map;
        const getC = (names, fallback) => {
          for (let n of names) {
            const normN = window.utils.norm(n);
            if (col[normN] !== undefined) return col[normN];
            for (let k in col) if (k.includes(normN)) return col[k];
          }
          return fallback;
        };

        const idxD = getC(['תאריך'], 5);
        const idxG = getC(['שם הצהרון', 'גן'], 3);
        const idxC = getC(['עיר'], 1);
        const idxA = getC(['שם החוג', 'ספק', 'חוג'], 8);
        const idxGr = getC(['קבוצות', 'קב'], 10);
        const idxT = getC(['שעה'], 11);
        const idxN = getC(['הערות'], 12);

        console.log(`[Import] Sheet: ${sheetName}, HeaderRow: ${bestHeader.idx}, Indices: D=${idxD}, G=${idxG}, A=${idxA}, Gr=${idxGr}, N=${idxN}`);
        stats.sheets++;

        for (let i = (bestHeader.idx === -1 ? 1 : bestHeader.idx + 1); i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 5) continue;
          stats.rows++;

          // Date Parsing
          let d = '';
          const rd = row[idxD];
          if (rd instanceof Date) {
            d = new Date(rd.getTime() + 12*3600000).toISOString().slice(0, 10);
          } else if (typeof rd === 'number') {
            d = new Date(new Date(1899,11,30).getTime() + rd*86400000 + 12*3600000).toISOString().slice(0, 10);
          } else if (typeof rd === 'string') {
            const m = rd.match(/(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})/);
            if (m) d = `${m[3].length===2?'20'+m[3]:m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
          }
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { stats.noDate++; continue; }

          // Garden Parsing
          const gn = String(row[idxG] || '').trim();
          const city = String(row[idxC] || '').trim();
          if (!gn) continue;
          const garden = window.utils.findGarden(gn, city);
          if (!garden) { stats.noGarden++; continue; }

          coveredDateGardens.add(`${d}|${Number(garden.id)}`);

          // Supplier Parsing
          const rawA = String(row[idxA] || '').trim();
          if (!rawA || rawA === 'null') { stats.skipped++; continue; }
          const supplier = window.utils.findSupplier(rawA, allSups);
          if (!supplier) { stats.skipped++; continue; }

          // Time Parsing
          let t = '14:00';
          const rt = row[idxT];
          if (typeof rt === 'number') {
            const mTot = Math.round(rt * 1440);
            t = `${Math.floor(mTot/60).toString().padStart(2,'0')}:${(mTot%60).toString().padStart(2,'0')}`;
          } else if (rt) {
            const tm = String(rt).trim().match(/(\d{1,2}):(\d{1,2})/);
            if (tm) t = tm[1].padStart(2,'0') + ':' + tm[2].padStart(2,'0');
          }

          // STATUS PARSING — CRITICAL LOGIC
          // Rule: If "קבוצות" column is empty/0/undefined → activity did not occur (nohap)
          const rawGr = row[idxGr];
          const nt = String(row[idxN] || '').trim();
          let st = 'ok';
          
          // Check groups column — empty means "לא התקיים"
          const grValue = (rawGr === undefined || rawGr === null) ? '' : String(rawGr).trim();
          const grNum = Number(grValue);
          
          if (grValue === '' || grNum === 0 || isNaN(grNum)) {
            // Groups is empty or zero — mark as not occurred
            st = 'nohap';
            stats.nohap++;
          }
          
          // Override with note-based detection (Takes precedence over groups column, with ONE exception)
          // EXCEPTION: If groups column was empty (st === 'nohap'), we NEVER change it back to 'ok' (מתקיים).
          // We only allow an empty group column to be upgraded to 'can' (בוטל).
          if (nt) {
            const lnt = nt.toLowerCase();
            let newSt = st;

            if (/בוטל|מבוטל|מצב בטחוני|סגר|שביתה|מסיבת פורים/.test(lnt)) {
              newSt = 'can';
            } else if (/לא התקיים|הוקדם ל|נדחה ל|הוזז ל|עבר ל|עובר ל|חסר מדריך|מדריך חסר|לא הגיע|חוסר מדריך|אין מדריך|לא נשאר|עזב|חולה|נתקע|נתקעה|במחלה|מסיבות אישיות|לא יכול|לא יכל|לא מגיע|לא מרגיש טוב|לא עונה|לא הודיע|טעה ב|טעות ב|השלמה לא התקיימה|יושלם ב|הועבר ל|חשב ש|איחר לא|לא מתקיים/.test(lnt)) {
              newSt = 'nohap';
            } else if (/הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|השלמה|במקום|התקיים|הושלם|הוחלף|הצלבת|החלפה|מדריך מחליף|מדריך משלים|מדריך השלים/.test(lnt)) {
              newSt = 'ok';
            }
            
            if (st !== newSt) {
               // Rule: If groups column is empty (st is nohap), we NEVER allow notes to mark it as 'ok'.
               if (st === 'nohap' && newSt === 'ok') {
                 // Ignore note. Empty groups column means it did NOT occur.
               } else {
                 if (st === 'nohap') stats.nohap--;
                 if (newSt === 'nohap') stats.nohap++;
                 st = newSt;
               }
            }
          }

          // Split supplier name into base + activity (e.g. "דרך הספורט - התעמלות")
          const sBase = window.supBase ? window.supBase(supplier.name) : supplier.name;
          const sAct = window.supAct ? window.supAct(supplier.name) : '';

          const normA = window.utils.megaClean(sBase);
          const sKey = `${d}|${Number(garden.id)}|${normA}|${t}`;
          const fId = window.utils.getEventId(d, Number(garden.id), sBase, sAct, t);

          recordsToUpsert.push({
            id: fId, d, g: garden.id, a: sBase, t, st, nt,
            act: sAct, // Activity name stored separately
            grp: (st === 'can' || st === 'nohap') ? 0 : (parseInt(grValue) || 1),
            _isImported: true
          });
          stats.imported++;
        }
      }

      if (recordsToUpsert.length === 0) {
        throw new Error(`לא נמצאו נתונים תקינים לעדכון.\nנסרקו ${stats.sheets} גיליונות ו- ${stats.rows} שורות.\n(חסרו תאריכים: ${stats.noDate}, גנים לא זוהו: ${stats.noGarden}, שורות ריקות: ${stats.skipped})`);
      }

      const msg = `✅ נמצאו ${recordsToUpsert.length} פעילויות לעדכון.\n`
        + `מתוכן ${stats.nohap} סומנו כ"לא התקיים".\n\n`
        + `האם להמשיך?\nשים לב: הפעולה תדרוס את לוח הזמנים הקיים.`;

      if (confirm(msg)) {
        // STEP 2: Overwrite SCH
        window.showCopyToast('⏳ מייבא נתונים ודורס ישנים...');
        window.DataManager.importBulk(recordsToUpsert, coveredDateGardens);
        console.log('[Import] SCH replaced. New count:', window.SCH.length);

        // STEP 3: Save to localStorage first
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
          activeGardens: window.activeGardens ? [...window.activeGardens] : null
        };
        window._safeLS.setItem('ganv5', JSON.stringify(lsData));
        console.log('[Import] Saved to localStorage');

        // STEP 4: Push directly to Firebase (bypass core.js save which has issues)
        window.showCopyToast('⏳ שומר שינויים לענן...');
        const fbOk = await window.saveToFirebase(true, true);
        
        if (fbOk) {
          console.log('[Import] Firebase save CONFIRMED');
          alert('✅ הייבוא הושלם בהצלחה!\n' + window.SCH.length + ' פעילויות נשמרו.\nהמערכת תתרענן כעת.');
          location.reload();
        } else {
          // Firebase failed but localStorage is saved — retry
          console.error('[Import] Firebase save FAILED — retrying...');
          const retry = await window.saveToFirebase(true, true);
          if (retry) {
            alert('✅ הייבוא הושלם (ניסיון שני הצליח).\nהמערכת תתרענן כעת.');
            location.reload();
          } else {
            alert('⚠️ הנתונים נשמרו מקומית אך השמירה לענן נכשלה.\nנסה ללחוץ על כפתור הסנכרון ידנית.');
            // Restart polling even on failure
            if (window._fbStartPolling) window._fbStartPolling();
          }
        }
      } else {
        // User cancelled
        if (window._fbStartPolling) window._fbStartPolling();
      }
    } catch (err) {
      console.error('[Import] Error:', err);
      alert('❌ שגיאה: ' + err.message);
      // Restart polling on error
      if (window._fbStartPolling) window._fbStartPolling();
    } finally {
      window._importInProgress = false;
      input.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
};
