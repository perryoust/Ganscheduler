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
  if (statusEl) statusEl.innerHTML = '⏳ סורק קובץ...';

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = new window.ExcelJS.Workbook();
      await workbook.xlsx.load(data);

      const newSCH = [];
      const gardenMap = {};
      const gardenMapClean = {};
      
      const cleanStr = (s) => String(s || '').replace(/[^\u0590-\u05FFa-zA-Z0-9]/g, '').trim();

      window.GARDENS.forEach(g => { 
        const name = String(g.name || '').trim();
        gardenMap[name] = g.id;
        gardenMapClean[cleanStr(name)] = g.id;
      });

      const now = Date.now();
      let debugInfo = [];

      workbook.eachSheet((ws, sheetId) => {
        const sheetName = ws.name || '';
        const isMakeupSheet = sheetName.includes('השלמה') || sheetName.includes('השלמות');
        
        let headers = {};
        let headerRowIdx = -1;

        // Search for header row in the first 10 rows
        for (let i = 1; i <= 10; i++) {
          const row = ws.getRow(i);
          let foundCount = 0;
          row.eachCell((cell) => {
            const val = cleanStr(cell.value);
            if (val.includes('תאריך') || val.includes('גן') || val.includes('חוג') || val.includes('ספק')) foundCount++;
          });
          if (foundCount >= 2) {
            headerRowIdx = i;
            row.eachCell((cell, colNumber) => {
              headers[String(cell.value || '').trim()] = colNumber;
            });
            break;
          }
        }

        const findCol = (possibleNames) => {
          for (let name of possibleNames) {
            if (headers[name]) return headers[name];
            for (let h in headers) { if (h.includes(name) || name.includes(h)) return headers[h]; }
          }
          return null;
        };

        const colDate = findCol(['תאריך', 'date', 'יום']);
        const colGname = findCol(['שם הצהרון', 'גן', 'garden', 'שם הגן']);
        const colSupAct = findCol(['שם החוג', 'חוג', 'ספק', 'פעילות']);
        const colTime = findCol(['שעה', 'time']);
        const colNote = findCol(['הערות', 'note']);
        const colGrp = findCol(['ק.', 'קבוצה']);
        const colPhone = findCol(['טלפון', 'phone']);

        if (!colDate || !colGname || !colSupAct) {
          debugInfo.push(`גיליון "${sheetName}": חסרות עמודות (תאריך:${!!colDate}, גן:${!!colGname}, חוג:${!!colSupAct})`);
          return;
        }

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

          let time = getV(colTime);
          if (time instanceof Date) {
            time = time.getHours().toString().padStart(2,'0') + ':' + time.getMinutes().toString().padStart(2,'0');
          } else if (typeof time === 'object' && time !== null && time.hours !== undefined) {
            time = time.hours.toString().padStart(2,'0') + ':' + (time.minutes || 0).toString().padStart(2,'0');
          } else {
            time = String(time || '').trim().slice(0, 5);
          }

          const notes = String(getV(colNote) || '');
          newSCH.push({
            id: now + '_' + sheetId + '_' + rowNumber,
            d: formattedDate,
            g: gid,
            a: supplier,
            act: activity,
            t: time,
            st: 'ok',
            n: isMakeupSheet ? (notes ? 'השלמה: ' + notes : 'השלמה') : notes,
            p: String(getV(colPhone) || ''),
            grp: parseInt(getV(colGrp)) || 1,
            _isMakeup: isMakeupSheet
          });
        });
      });

      if (newSCH.length === 0) {
        let errorMsg = 'לא נמצאו נתונים תקינים.\n' + debugInfo.join('\n');
        throw new Error(errorMsg);
      }

      if (confirm(`✅ הצלחתי לקרוא ${newSCH.length} שיבוצים.\nהאם לעדכן את המערכת?`)) {
        window.SCH = newSCH;
        window.save();
        if (statusEl) statusEl.innerHTML = `✅ הצלחה! ${newSCH.length} שיבוצים עודכנו.`;
        setTimeout(() => location.reload(), 1500);
      }

    } catch (err) {
      console.error('Import error:', err);
      alert('שגיאה בייבוא:\n' + err.message);
      if (statusEl) statusEl.innerHTML = '❌ שגיאה בייבוא';
    } finally {
      input.value = '';
    }
  };

  reader.readAsArrayBuffer(file);
};
