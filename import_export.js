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
      const workbook = new window.ExcelJS.Workbook();
      await workbook.xlsx.load(data);

      const schMap = {};
      const gardenMap = {};
      const gardenMapClean = {};
      
      const cleanStr = (s) => String(s || '').replace(/[^\u0590-\u05FFa-zA-Z0-9]/g, '').trim();
      window.GARDENS.forEach(g => { 
        const name = String(g.name || '').trim();
        gardenMap[name] = g.id;
        gardenMapClean[cleanStr(name)] = g.id;
      });

      // Create a pair mapping: gardenId -> pairKey (e.g. "12_45")
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
      const sortedSheets = [];
      workbook.eachSheet(s => sortedSheets.push(s));
      sortedSheets.sort((a, b) => {
        const getPrio = (name) => {
          if (name.includes('חוסר') || name.includes('חוסרים')) return 3;
          if (name.includes('השלמה') || name.includes('השלמות')) return 2;
          return 1;
        };
        return getPrio(a.name) - getPrio(b.name);
      });

      sortedSheets.forEach((ws, sheetId) => {
        const sheetName = ws.name || '';
        console.log(`[Import] Processing sheet: "${sheetName}"`);
        const isMakeupSheet = sheetName.includes('השלמה') || sheetName.includes('השלמות');
        const isMissingSheet = sheetName.includes('חוסר') || sheetName.includes('חוסרים') || sheetName.includes('לא התקיים');
        
        let headers = {};
        let headerRowIdx = -1;
        for (let i = 1; i <= 10; i++) {
          const row = ws.getRow(i);
          let foundCount = 0;
          row.eachCell((cell) => {
            const val = cleanStr(cell.value);
            if (val === 'תאריך' || val === 'שםהצהרון' || val === 'שםהחוג') foundCount++;
          });
          if (foundCount >= 2) {
            headerRowIdx = i;
            row.eachCell((cell, colNumber) => { headers[String(cell.value || '').trim()] = colNumber; });
            break;
          }
        }

        const findCol = (possibleNames) => {
          for (let name of possibleNames) {
            if (headers[name]) return headers[name];
            for (let h in headers) { if (h === name || h.includes(name)) return headers[h]; }
          }
          return null;
        };

        const colDate = findCol(['תאריך', 'date']);
        const colGname = findCol(['שם הצהרון', 'גן', 'garden']);
        const colSupAct = findCol(['שם החוג', 'חוג', 'ספק']);
        const colTime = findCol(['שעה', 'time', 'שע']);
        const colNote = findCol(['הערות', 'note']);
        const colGrp = findCol(['ק.', 'קבוצה']);
        const colPhone = findCol(['טלפון', 'phone']);

        if (!colDate || !colGname || !colSupAct) return;

        ws.eachRow((row, rowNumber) => {
          if (rowNumber <= headerRowIdx) return;

          const getV = (colIdx) => {
            if (!colIdx) return '';
            const cell = row.getCell(colIdx);
            if (!cell) return '';
            let val = cell.value;
            if (val && typeof val === 'object' && 'result' in val) val = val.result;
            return val;
          };

          const rawDate = getV(colDate);
          if (!rawDate) return;

          let formattedDate = '';
          if (rawDate instanceof Date) {
            formattedDate = rawDate.toISOString().slice(0,10);
          } else if (typeof rawDate === 'number') {
            const dateObj = new Date((rawDate - 25569) * 86400 * 1000);
            formattedDate = dateObj.toISOString().slice(0,10);
          } else if (typeof rawDate === 'string') {
            const parts = rawDate.split(/[\/\-\.]/);
            if (parts.length === 3) {
              let d = parts[0].padStart(2, '0'), m = parts[1].padStart(2, '0'), y = parts[2];
              if (y.length === 2) y = '20' + y;
              formattedDate = `${y}-${m}-${d}`;
            }
          }
          if (!formattedDate || !formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) return;

          const gnameRaw = String(getV(colGname) || '').trim();
          let gid = gardenMap[gnameRaw] || gardenMapClean[cleanStr(gnameRaw)];
          if (!gid) return;

          const fullSup = String(getV(colSupAct) || '').trim();
          let supplier = fullSup, activity = '';
          if (fullSup.includes(' - ')) {
            const parts = fullSup.split(' - ');
            supplier = parts[0].trim();
            activity = parts[1].trim();
          }

          let timeRaw = getV(colTime);
          let time = '';
          if (timeRaw && typeof timeRaw === 'number') {
            const totalMinutes = Math.round(timeRaw * 24 * 60);
            const h = Math.floor(totalMinutes / 60);
            const m = totalMinutes % 60;
            time = h.toString().padStart(2,'0') + ':' + m.toString().padStart(2,'0');
          } else if (timeRaw && timeRaw instanceof Date) {
            time = timeRaw.getHours().toString().padStart(2,'0') + ':' + timeRaw.getMinutes().toString().padStart(2,'0');
          } else if (timeRaw) {
            time = String(timeRaw).trim().replace(/[^\d:]/g, '').slice(0, 5);
            if (time.includes(':') && time.split(':')[0].length < 2) {
              const p = time.split(':');
              time = p[0].padStart(2,'0') + ':' + p[1].padStart(2,'0');
            }
          }

          const notes = String(getV(colNote) || '').trim();
          const grpRaw = getV(colGrp);
          
          const isMakeupNote = notes.includes('השלמה');
          const isActualMakeup = isMakeupSheet || isMakeupNote;

          // New logic: if Group column is empty, it's a lack (nohap)
          let status = 'ok';
          if (grpRaw === '' || grpRaw === null || grpRaw === undefined) {
            status = 'nohap';
          }
          if (isMissingSheet) status = 'nohap';

          let makeupFrom = '';
          if (isActualMakeup) {
            // Try to extract date from notes like "השלמה לתאריך 1.9"
            const dateMatch = notes.match(/(\d{1,2})[\.\/](\d{1,2})/);
            if (dateMatch) {
              const d = dateMatch[1].padStart(2, '0');
              const m = dateMatch[2].padStart(2, '0');
              // Guess year based on formattedDate
              const y = formattedDate.split('-')[0];
              makeupFrom = `${y}-${m}-${d}`;
            }
          }

          const locKey = pairMap[gid] || gid;
          const key = `${formattedDate}|${locKey}|${cleanStr(supplier)}|${time}`;
          
          schMap[key] = {
            id: now + '_' + sheetId + '_' + rowNumber,
            d: formattedDate,
            g: gid,
            a: supplier,
            act: activity,
            t: time,
            st: status,
            n: (isMakeupSheet ? 'השלמה: ' : '') + (isMissingSheet ? 'חוסר: ' : '') + notes,
            p: String(getV(colPhone) || ''),
            grp: parseInt(grpRaw) || 0,
            _isMakeup: isActualMakeup,
            _makeupFrom: makeupFrom
          };
        });
      });

      const newSCH = Object.values(schMap);
      if (newSCH.length === 0) {
        window._importInProgress = false;
        throw new Error('לא נמצאו נתונים תקינים.');
      }

      if (confirm(`✅ נמצאו ${newSCH.length} פעילויות ייחודיות (מאוחדות לפי זוגות וגיליונות).\nהאם לעדכן את המערכת?`)) {
        if (statusEl) statusEl.innerHTML = '⏳ שומר נתונים...';
        window.SCH = newSCH;
        if (typeof window.saveToFirebase === 'function') {
          await window.saveToFirebase(false);
        } else {
          window.save();
          await new Promise(r => setTimeout(r, 4000));
        }
        if (statusEl) statusEl.innerHTML = '✅ סיום! המערכת תתרענן.';
        setTimeout(() => { window._importInProgress = false; location.reload(); }, 1000);
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
