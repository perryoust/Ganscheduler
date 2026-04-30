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
    const sch = window.SCH || [];
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

  const statusEl = document.getElementById('bulk-import-status');
  if (statusEl) statusEl.innerHTML = '⏳ מנתח נתונים ומאחד זוגות גנים...';

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
      window.GARDENS.forEach(g => { 
        const name = String(g.name || '').trim();
        gardenMap[name] = g.id;
        gardenMapClean[cleanStr(name)] = g.id;
      });

      const pairMap = {};
      if (window.pairs && Array.isArray(window.pairs)) {
        window.pairs.forEach(p => {
          if (p && p.ids && Array.isArray(p.ids)) {
            const arr = [...p.ids];
            const key = arr.sort((a,b)=>a-b).join('_');
            arr.forEach(id => { pairMap[id] = key; });
          }
        });
      }

      const now = Date.now();
      const sheetNames = workbook.SheetNames.slice().sort((a, b) => {
        const getPrio = (name) => {
          if (name.includes('חוסר') || name.includes('חוסרים')) return 3;
          if (name.includes('השלמה') || name.includes('השלמות')) return 2;
          return 1;
        };
        return getPrio(a) - getPrio(b);
      });

      sheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`[Import] Processing sheet: "${sheetName}" (${rows.length} rows)`);

        const isMakeupSheet = sheetName.includes('השלמה') || sheetName.includes('השלמות');
        const isMissingSheet = sheetName.includes('חוסר') || sheetName.includes('חוסרים') || sheetName.includes('לא התקיים');
        
        let headers = {};
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const row = rows[i];
          if (!row) continue;
          let foundCount = 0;
          row.forEach(cell => {
            const val = cleanStr(cell);
            if (val === 'תאריך' || val === 'שםהצהרון' || val === 'שםהחוג') foundCount++;
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
        const colSupAct = findCol(['שם החוג', 'שם חוג', 'ספק', 'חוג', 'Activity', 'Supplier']);
        const colTime = findCol(['שעה', 'זמן', 'Time']);
        const colGrp = findCol(['קב', 'קבוצה', 'Group']);
        const colNote = findCol(['הערות', 'הערה', 'Notes']);
        const colStatus = findCol(['סטטוס', 'מצב', 'Status']);

        if (colDate === null || colGname === null || colSupAct === null) {
          console.warn(`[Import] Missing critical columns in sheet "${sheetName}"`);
          return;
        }

        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[colDate]) continue;

          const getV = (idx) => (idx !== null && row[idx] !== undefined) ? row[idx] : null;

          let formattedDate = '';
          const rawDate = getV(colDate);
          if (rawDate instanceof Date) {
            formattedDate = rawDate.toISOString().slice(0, 10);
          } else if (typeof rawDate === 'number') {
            const dateObj = new Date((rawDate - 25569) * 86400 * 1000);
            formattedDate = dateObj.toISOString().slice(0, 10);
          } else if (typeof rawDate === 'string') {
            const parts = rawDate.split(/[\/\-\.]/);
            if (parts.length === 3) {
              let d = parts[0].padStart(2, '0'), m = parts[1].padStart(2, '0'), y = parts[2];
              if (y.length === 2) y = '20' + y;
              formattedDate = `${y}-${m}-${d}`;
            }
          }
          if (!formattedDate || !formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

          const gnameRaw = String(getV(colGname) || '').trim();
          let gid = gardenMap[gnameRaw] || gardenMapClean[cleanStr(gnameRaw)];
          if (!gid) continue;

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

          // --- STATUS LOGIC ---
          // Default is 'ok'. Only set nohap if explicitly a "missing" sheet
          // OR if the status column says so. Never infer nohap from empty group.
          let status = 'ok';
          if (isMissingSheet) status = 'nohap';
          
          const rawSt = String(getV(colStatus) || '').toLowerCase();
          if (rawSt.includes('בוטל') || rawSt === 'can') status = 'can';
          else if (rawSt.includes('נדחה') || rawSt === 'post') status = 'post';
          else if (rawSt.includes('לא התקיים') || rawSt === 'nohap') status = 'nohap';
          else if (rawSt.includes('בוצע') || rawSt === 'done') status = 'done';

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
          // Each garden (gid) gets its own unique record so BOTH gardens in
          // a pair are stored in SCH. We simply deduplicate same-garden,
          // same-date, same-supplier entries that appear across multiple sheets
          // (e.g. regular sheet + makeup sheet).
          const key = `${formattedDate}|${gid}|${cleanStr(supplier)}`;
          
          // Accept the new record if: no existing record, OR new status is
          // 'ok' (prefer positive status), OR existing is nohap and new isn't.
          const existing = schMap[key];
          const shouldOverwrite = !existing ||
            (status === 'ok' && existing.st !== 'ok') ||
            (existing.st === 'nohap' && status !== 'nohap');

          if (shouldOverwrite) {
            schMap[key] = {
              id: `ID_${now}_${i}_${Math.floor(Math.random()*1000)}`,
              d: formattedDate,
              g: gid,
              gd: window.G(gid),
              a: supplier,
              act: activity,
              t: time,
              st: status,
              nt: notes,
              grp: grpRaw || 1,
              _makeupFrom: makeupFrom,
              _isImported: true,
              _isMakeup: isActualMakeup || undefined
            };
          }
        }
      });

      const newSCH = [];
      for (const k in schMap) newSCH.push(schMap[k]);

      if (newSCH.length === 0) {
        window._importInProgress = false;
        throw new Error('לא נמצאו נתונים תקינים.');
      }

      if (confirm(`✅ נמצאו ${newSCH.length} פעילויות ייחודיות (מאוחדות לפי זוגות וגיליונות).\nהאם לעדכן את המערכת?`)) {
        if (statusEl) statusEl.innerHTML = '⏳ שומר נתונים...';
        window.SCH = newSCH;
        // CRITICAL: Must clear import flag BEFORE save, otherwise
        // saveToFirebase() will skip because _importInProgress is true
        window._importInProgress = false;
        if (typeof window.saveToFirebase === 'function') {
          await window.saveToFirebase(false);
        } else {
          window.save();
          await new Promise(r => setTimeout(r, 4000));
        }
        if (statusEl) statusEl.innerHTML = '✅ סיום! המערכת תתרענן.';
        setTimeout(() => { location.reload(); }, 1500);
      } else {
        window._importInProgress = false;
        if (statusEl) statusEl.innerHTML = '❌ בוטל';
      }
    } catch (err) {
      window._importInProgress = false;
      alert('שגיאה: ' + err.message);
      if (statusEl) statusEl.innerHTML = '❌ שגיאה';
    } finally {
      input.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
};
