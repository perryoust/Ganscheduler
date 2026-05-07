/**
 * Bulk Import/Export Schedule Logic
 */

window.exportBulkSchedule = async function() {
  if (typeof window.ExcelJS === 'undefined') {
    alert('שגיאה: ספריית ExcelJS לא נטענה');
    return;
  }

  try {
    const workbook = new window.ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Schedule');
    ws.views = [{ rightToLeft: true }];

    // Define columns
    ws.columns = [
      { header: 'Event ID', key: 'id', width: 15 },
      { header: 'תאריך (YYYY-MM-DD)', key: 'd', width: 15 },
      { header: 'מזהה גן (ID)', key: 'g', width: 10 },
      { header: 'שם הגן', key: 'garden_name', width: 20 },
      { header: 'עיר', key: 'city', width: 15 },
      { header: 'ספק', key: 'a', width: 20 },
      { header: 'פעילות', key: 'act', width: 20 },
      { header: 'שעה (HH:MM)', key: 't', width: 10 },
      { header: 'קבוצה', key: 'grp', width: 10 },
      { header: 'סטטוס', key: 'st', width: 10 },
      { header: 'טלפון', key: 'p', width: 15 },
      { header: 'הערות', key: 'n', width: 30 }
    ];

    // Style header
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).alignment = { horizontal: 'center' };

    // Add data
    const sch = [...(window.SCH || [])].sort((a,b)=>{
      const ds = (a.d||'').localeCompare(b.d||'');
      if(ds !== 0) return ds;
      const ga = window.G(a.g), gb = window.G(b.g);
      const cs = (ga.city||'').localeCompare(gb.city||'','he');
      if(cs !== 0) return cs;
      const pA = window.gardenPair(a.g), pB = window.gardenPair(b.g);
      const nA = pA ? pA.name : (ga.name||'');
      const nB = pB ? pB.name : (gb.name||'');
      const ns = nA.localeCompare(nB, 'he');
      if(ns !== 0) return ns;
      return (a.t||'99:99').localeCompare(b.t||'99:99');
    });
    sch.forEach(s => {
      const g = window.G(s.g);
      ws.addRow({
        id: s.id,
        d: s.d,
        g: s.g,
        garden_name: g ? g.name : '',
        city: g ? g.city : '',
        a: s.a || '',
        act: s.act || '',
        t: s.t || '',
        grp: s.grp || 1,
        st: s.st || 'ok',
        p: s.p || '',
        n: s.n || ''
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kids_Schedule_Bulk_${new Date().toISOString().slice(0,10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    window.showToast('✅ לוח זמנים יוצא בהצלחה');
  } catch (err) {
    console.error('Export error:', err);
    alert('שגיאה בייצוא: ' + err.message);
  }
};

window.importBulkSchedule = function(input) {
  const file = input.files[0];
  if (!file) return;

  alert('גרסת ייבוא מתקדמת (v3) - מופעלת! מתחיל לקרוא את הקובץ...');

  const statusEl = document.getElementById('bulk-import-status');
  if (statusEl) statusEl.innerHTML = '⏳ מנתח נתונים ומאחד זוגות גנים...';

  if (!window.GARDENS || window.GARDENS.length === 0) {
    alert('שגיאה: רשימת הגנים לא נטענה. אנא רענן את הדף (F5) ונסה שוב.');
    return;
  }

  window._importInProgress = true;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      if (!window.XLSX) {
        throw new Error('ספריית XLSX (SheetJS) לא נטענה. אנא רענן את הדף (F5).');
      }
      const workbook = window.XLSX.read(data, { type: 'array', cellDates: true });

      const schMap = {};
      const gardenMap = {};
      const gardenMapClean = {};
      
      const cleanStr = (s) => String(s || '').replace(/[^\u0590-\u05FFa-zA-Z0-9]/g, '').trim();
      const prefixes = ['גן', 'צהרון', 'ביהס', 'ביס', 'ביתספר', 'ביהס'];
      const megaClean = (s) => {
        let str = cleanStr(s);
        for (let p of prefixes) { if (str.startsWith(p)) { str = str.substring(p.length); break; } }
        return str;
      };

      window.GARDENS.forEach(g => { 
        const name = String(g.name || '').trim();
        const city = String(g.city || '').trim();
        gardenMap[name] = g.id;
        gardenMapClean[cleanStr(name)] = g.id;
        gardenMapClean[megaClean(name)] = g.id;
        
        if (city) {
          gardenMap[name + '|' + city] = g.id;
          gardenMapClean[cleanStr(name) + '|' + cleanStr(city)] = g.id;
          gardenMapClean[megaClean(name) + '|' + cleanStr(city)] = g.id;
        }
      });

      const stats = { sheets: 0, rows: 0, imported: 0, skippedGarden: new Set(), skippedDate: 0, skippedEmpty: 0 };

      const now = Date.now();
      const sheetNames = workbook.SheetNames.slice().sort((a, b) => {
        const getPrio = (name) => {
          if (name.includes('השלמה') || name.includes('השלמות')) return 3; // Makeups win (processed last)
          if (name.includes('חוסר') || name.includes('חוסרים') || name.includes('לא התקיים') || name.includes('לא התקיימו')) return 2; // Missing sheets
          return 1; // Default sheets
        };
        return getPrio(a) - getPrio(b);
      });
      console.log('[Import] Sheets order:', sheetNames);

      sheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`[Import] Processing sheet: "${sheetName}" (${rows.length} rows)`);

        const isMakeupSheet = sheetName.includes('השלמה') || sheetName.includes('השלמות');
        const isMissingSheet = sheetName.includes('חוסר') || sheetName.includes('חוסרים') || sheetName.includes('לא התקיים') || sheetName.includes('לא התקיימו');
        
        let headers = {};
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(15, rows.length); i++) {
          const row = rows[i];
          if (!row || !Array.isArray(row)) continue;
          let foundCount = 0;
          row.forEach(cell => {
            const val = cleanStr(cell);
            if (val === 'תאריך' || val.includes('תאריך') || val === 'יום') foundCount++;
            if (val.includes('גן') || val.includes('צהרון') || val === 'הצהרון') foundCount++;
            if (val.includes('חוג') || val.includes('ספק') || val.includes('פעילות')) foundCount++;
          });
          if (foundCount >= 2) {
            headerRowIdx = i;
            row.forEach((cell, colIdx) => {
              if (cell) headers[String(cell).trim()] = colIdx;
            });
            break;
          }
        }

        if (headerRowIdx === -1) {
          console.warn(`[Import] Could not find header in sheet "${sheetName}"`);
          // If it's not a known "trash" sheet, maybe alert the user
          if (rows.length > 5 && !sheetName.includes('Sheet')) {
            alert(`גיליון "${sheetName}" דולג: לא נמצאו עמודות 'תאריך', 'גן' או 'חוג'.\nאנא ודאו שהכותרות נמצאות ב-15 השורות הראשונות.`);
          }
          return;
        }

        const findCol = (possibleNames) => {
          for (let name of possibleNames) {
            if (headers[name] !== undefined) return headers[name];
            for (let h in headers) { if (h === name || h.includes(name)) return headers[h]; }
          }
          return null;
        };

        const colDate = findCol(['תאריך', 'יום', 'Date']);
        const colGname = findCol(['שם הצהרון', 'שם צהרון', 'גן', 'הצהרון', 'Garden']);
        const colCity = findCol(['עיר', 'ישוב', 'יישוב', 'City']);
        const colSupAct = findCol(['שם החוג', 'שם חוג', 'ספק', 'חוג', 'Activity', 'Supplier']);
        const colTime = findCol(['שעה', 'זמן', 'Time']);
        const colGrp = findCol(['קב', 'קבוצה', 'Group']);
        const colNote = findCol(['הערות', 'הערה', 'Notes']);
        const colStatus = findCol(['סטטוס', 'מצב', 'Status']);

        if (colDate === null || colGname === null || colSupAct === null) {
          console.warn(`[Import] Missing critical columns in sheet "${sheetName}"`);
          return;
        }
        stats.sheets++;

        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every(c => !c)) { stats.skippedEmpty++; continue; }
          stats.rows++;

          const getV = (idx) => (idx !== null && row[idx] !== undefined) ? row[idx] : null;

          let formattedDate = '';
          const rawDate = getV(colDate);
          if (rawDate instanceof Date) {
            const safeDate = new Date(rawDate.getTime() + 12 * 60 * 60 * 1000);
            formattedDate = safeDate.toISOString().slice(0, 10);
          } else if (typeof rawDate === 'number') {
            const safeDate = new Date(Math.round((rawDate - 25569) * 86400) * 1000 + 12 * 60 * 60 * 1000);
            formattedDate = safeDate.toISOString().slice(0, 10);
          } else if (typeof rawDate === 'string') {
            const parts = rawDate.split(/[\/\-\.]/);
            if (parts.length === 3) {
              if (parts[0].length === 4) {
                formattedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              } else {
                let d = parts[0].padStart(2, '0'), m = parts[1].padStart(2, '0'), y = parts[2];
                if (y.length === 2) y = '20' + y;
                formattedDate = `${y}-${m}-${d}`;
              }
            }
          }
          if (!formattedDate || !formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            stats.skippedDate++;
            continue;
          }
          
          if (!window._debugDatesShown) window._debugDatesShown = [];
          if (window._debugDatesShown.length < 5) {
             window._debugDatesShown.push(`מקור: ${rawDate} -> תורגם: ${formattedDate}`);
          }

          const gnameRaw = String(getV(colGname) || '').trim();
          const cityRaw = String(getV(colCity) || '').trim();
          
          let gid = null;
          if (cityRaw) {
            gid = gardenMap[gnameRaw + '|' + cityRaw] || 
                  gardenMapClean[cleanStr(gnameRaw) + '|' + cleanStr(cityRaw)] || 
                  gardenMapClean[megaClean(gnameRaw) + '|' + cleanStr(cityRaw)];
          }
          if (!gid) {
            gid = gardenMap[gnameRaw] || gardenMapClean[cleanStr(gnameRaw)] || gardenMapClean[megaClean(gnameRaw)];
          }
          
          if (!gid) {
            if (gnameRaw) stats.skippedGarden.add(gnameRaw);
            continue;
          }

          const fullSup = String(getV(colSupAct) || '').trim();
          if (!fullSup) continue;
          let supplier = fullSup, activity = '';
          if (fullSup.includes(' - ')) {
            const parts = fullSup.split(' - ');
            supplier = parts[0].trim();
            activity = parts[1].trim();
          }

          let time = '';
          const timeRaw = getV(colTime);
          if (timeRaw && typeof timeRaw === 'number') {
            const totalMinutes = Math.round(timeRaw * 24 * 60);
            const h = Math.floor(totalMinutes / 60);
            const m = totalMinutes % 60;
            time = h.toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0');
          } else if (timeRaw && timeRaw instanceof Date) {
            time = timeRaw.getHours().toString().padStart(2, '0') + ':' + timeRaw.getMinutes().toString().padStart(2, '0');
          } else if (timeRaw) {
            time = String(timeRaw).trim().replace(/[^\d:]/g, '').slice(0, 5);
            if (time.includes(':')) {
              const p = time.split(':');
              time = p[0].padStart(2, '0') + ':' + p[1].padStart(2, '0');
            }
          }

          const notes = String(getV(colNote) || '').trim();
          const grpRaw = getV(colGrp);
          
          const isMakeupNote = notes.includes('השלמה');
          const isActualMakeup = isMakeupSheet || isMakeupNote;

          // --- STATUS LOGIC (SMART IMPORT) ---
          let status = 'ok';
          if (isMissingSheet) status = 'nohap';
          
          const rawSt = String(getV(colStatus) || '').toLowerCase();
          const lowerNotes = notes.toLowerCase();
          
          // Keywords lists
          const canWords = ['בוטל', 'מבוטל', 'מצב בטחוני', 'סגר', 'שביתה', 'מסיבת פורים', 'מסיבות אישיות'];
          const nohapWords = ['חסר מדריך', 'חוסר מדריך', 'אין מדריך', 'לא התקיים', 'לא הגיע', 'חולה', 'נתקע', 'לא נשאר', 'עזב', 'לא התקיימה', 'לא מרגיש טוב', 'לא עונה', 'טעה ביום', 'טעות בשיבוץ', 'לא מצא חניה', 'איחר לא העביר'];
          
          // 1. Check Status Column
          if (rawSt.includes('בוטל') || rawSt.includes('ביטול') || rawSt === 'can') status = 'can';
          else if (rawSt.includes('נדחה') || rawSt.includes('הזזה') || rawSt === 'post') status = 'post';
          else if (rawSt.includes('לא התקיים') || rawSt.includes('לא בוצע') || rawSt === 'nohap') status = 'nohap';
          else if (rawSt.includes('בוצע') || rawSt.includes('התקיים') || rawSt.includes('הושלם') || rawSt === 'done') status = 'done';
          
          // 2. Smart Override from Notes (if status is still 'ok')
          if (status === 'ok') {
            const isMovedFrom = lowerNotes.includes('נדחה מ') || lowerNotes.includes('הוזז מ') || lowerNotes.includes('הזזה מ') || lowerNotes.includes('הוקדם מ') || lowerNotes.includes('עבר מ') || lowerNotes.includes('עובר מ');
            const isMovedTo = lowerNotes.includes('נדחה ל') || lowerNotes.includes('הוזז ל') || lowerNotes.includes('הזזה ל') || lowerNotes.includes('הוקדם ל') || lowerNotes.includes('עבר ל') || lowerNotes.includes('עובר ל');
            const isPos = lowerNotes.includes('השלמה') || isMovedFrom || (lowerNotes.includes('נדחה') && !isMovedTo);

            if (!isPos) {
              if (canWords.some(w => lowerNotes.includes(w)) || isMovedTo) status = 'can';
              else if (nohapWords.some(w => lowerNotes.includes(w))) status = 'nohap';
              else if (lowerNotes.includes('הושלם') || lowerNotes.includes('התקיים') || lowerNotes.includes('בוצע')) status = 'done';
            }
          }

          let makeupFrom = '';
          if (isActualMakeup) {
            const dateMatch = notes.match(/(\d{1,2})[\.\/](\d{1,2})/);
            if (dateMatch) {
              const d = dateMatch[1].padStart(2, '0');
              const m = dateMatch[2].padStart(2, '0');
              const y = formattedDate.split('-')[0];
              makeupFrom = `${y}-${m}-${d}`;
            }
          }

          // --- KEY / DEDUPLICATION LOGIC ---
          // Use date, garden ID, supplier AND activity to ensure different
          // lessons from the same supplier on the same day are not merged.
          const key = `${formattedDate}|${gid}|${cleanStr(supplier)}|${cleanStr(activity)}`;
          
          // Deterministic ID generation based on the key
          // This ensures that the same row in Excel always maps to the same ID in the system.
          const deterministicId = 'IMP_' + btoa(unescape(encodeURIComponent(key))).replace(/=/g, '').slice(0, 32);

          const existing = schMap[key];
          // Overwrite if:
          // 1. It's the first time we see this activity
          // 2. OR the current row has a non-standard status (missing/makeup)
          // 3. OR the existing one was 'ok' and this one is also 'ok' (latest win)
          const shouldOverwrite = !existing || status !== 'ok' || existing.st === 'ok';

          if (shouldOverwrite) {
            schMap[key] = {
              id: deterministicId,
              d: formattedDate,
              g: gid,
              a: supplier,
              act: activity,
              t: time,
              st: status,
              nt: notes,
              grp: (status === 'can' || status === 'nohap') ? 0 : (grpRaw || 1),
              _makeupFrom: makeupFrom,
              _isImported: true,
              _isMakeup: isActualMakeup || undefined
            };
            stats.imported++;
          }
        }
      });

      console.log('[Import] Finished processing sheets. Map size:', Object.keys(schMap).length);

      const newSCH = [];
      for (const k in schMap) newSCH.push(schMap[k]);

      if (newSCH.length === 0) {
        window._importInProgress = false;
        let msg = 'לא נמצאו נתונים תקינים לעדכון.';
        if (stats.skippedGarden.size > 0) {
          msg += '\n\nגנים שלא זוהו:\n' + [...stats.skippedGarden].slice(0, 10).join(', ') + (stats.skippedGarden.size > 10 ? '...' : '');
        }
        
        // Show the debug dates to the user!
        if (window._debugDatesShown && window._debugDatesShown.length > 0) {
          alert("נתוני חקירה מהיבוא (אנא צלם מסך ושלח לי):\n\n" + window._debugDatesShown.join("\n"));
          window._debugDatesShown = [];
        }

        throw new Error(msg);
      }
      
      // Show the debug dates to the user!
      if (window._debugDatesShown && window._debugDatesShown.length > 0) {
        alert("נתוני חקירה מהיבוא (אנא צלם מסך ושלח לי):\n\n" + window._debugDatesShown.join("\n"));
        window._debugDatesShown = [];
      }

      let summary = `✅ נמצאו ${newSCH.length} פעילויות לעדכון מתוך ${stats.rows} שורות.`;
      if (stats.skippedGarden.size > 0) summary += `\n⚠️ ${stats.skippedGarden.size} גנים לא זוהו ודולגו.`;
      if (stats.skippedDate > 0) summary += `\n⚠️ ${stats.skippedDate} שורות דולגו בגלל תאריך לא תקין.`;
      
      const firstFew = newSCH.slice(0, 3).map(x => `${x.d}: ${window.G(x.g).name} - ${x.a}`).join('\n');
      if (confirm(`${summary}\n\nדוגמא לנתונים:\n${firstFew}\n\nשימו לב: פעולה זו תחליף את כל השיבוצים הקיימים בנתונים מהקובץ.\nהאם להמשיך?`)) {
        if (statusEl) statusEl.innerHTML = '⏳ מסנכרן לבסיס הנתונים...';
        window.SCH = newSCH;
        window.useSraws = false; // Disable merging with static sraws.json
        
        // Force Firebase to see this as a "fresh" change by clearing the comparison cache
        window._fbLastSavedRaw = null;

        console.log('[Import] Saving new schedule...', { count: newSCH.length });
        let saveOk = false;
        try {
          // Use window.save(true) to update BOTH LocalStorage and Firebase
          // This prevents the "revert to old data" bug on page reload.
          saveOk = await window.save(true);
          console.log('[Import] save result:', saveOk);
        } catch (err) {
          console.error('[Import] save failed:', err);
          throw new Error('שגיאה בשמירה: ' + err.message);
        }

        if (saveOk) {
          if (typeof window.showToast === 'function') window.showToast('✅ הייבוא הושלם בהצלחה! מרענן...', 3000);
          else if (statusEl) statusEl.innerHTML = '✅ העדכון הושלם בהצלחה! מרענן דף...';
          
          // CRITICAL: We DO NOT set window._importInProgress = false here.
          // We keep it true to block background syncs until the reload happens.
          
          setTimeout(() => { 
            console.log('[Import] Reloading page...');
            location.reload(); 
          }, 2500);
        } else {
          const detailedErr = window._fbLastError ? `\nפירוט: ${window._fbLastError}` : '';
          throw new Error('השמירה ל-Firebase נכשלה. בדוק חיבור לאינטרנט.' + detailedErr);
        }
      }
    } catch (err) {
      console.error('[Import] Fatal error:', err);
      window._importInProgress = false;
      alert('❌ שגיאה בייבוא: ' + err.message);
      if (statusEl) statusEl.innerHTML = '❌ שגיאה';
    } finally {
      input.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
};
