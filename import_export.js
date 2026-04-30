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
  if (statusEl) statusEl.innerHTML = '⏳ סורק את כל הגיליונות בקובץ... המתן לסיום';

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = new window.ExcelJS.Workbook();
      await workbook.xlsx.load(data);

      const newSCH = [];
      const gardenMap = {};
      window.GARDENS.forEach(g => { gardenMap[g.name.trim()] = g.id; });
      const now = Date.now();
      let totalProcessed = 0;
      let skipCount = 0;

      // Iterate through ALL worksheets
      workbook.eachSheet((ws, sheetId) => {
        const sheetName = ws.name || '';
        const isMakeupSheet = sheetName.includes('השלמה') || sheetName.includes('השלמות');
        
        const headers = {};
        ws.getRow(1).eachCell((cell, colNumber) => {
          const h = String(cell.value || '').trim();
          headers[h] = colNumber;
        });

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
        const colTime = findCol(['שעה', 'time']);
        const colNote = findCol(['הערות', 'note']);
        const colGrp = findCol(['ק.', 'קבוצה']);
        const colPhone = findCol(['טלפון', 'phone']);

        // Skip sheets that don't look like schedule sheets
        if (!colDate || !colGname || !colSupAct) return;

        ws.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          totalProcessed++;

          const getV = (colIdx) => {
            if (!colIdx) return '';
            const cell = row.getCell(colIdx);
            if (!cell) return '';
            let val = cell.value;
            if (val && typeof val === 'object' && 'result' in val) val = val.result;
            return val;
          };

          // Date Parsing
          const rawDate = getV(colDate);
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

          if (!formattedDate || !formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) { skipCount++; return; }

          const gname = String(getV(colGname) || '').trim();
          const gid = gardenMap[gname];
          if (!gid) { skipCount++; return; }

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
          }
          time = String(time || '').slice(0, 5);

          const notes = String(getV(colNote) || '');
          const entry = {
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
            _isMakeup: isMakeupSheet // Internal flag for UI highlighting if needed
          };

          newSCH.push(entry);
        });
      });

      if (newSCH.length === 0) {
        throw new Error('לא נמצאו נתונים תקינים באף אחד מהגיליונות. וודא שמות הגנים והתאריכים תקינים.');
      }

      if (confirm(`🚀 נמצאו ${newSCH.length} שיבוצים ב-${workbook.worksheets.length} גיליונות.\nהאם להחליף את כל לוח הזמנים הקיים?`)) {
        window.SCH = newSCH;
        window.save();
        if (statusEl) statusEl.innerHTML = `✅ הצלחה! ${newSCH.length} שיבוצים עודכנו מכל הגיליונות.`;
        setTimeout(() => location.reload(), 1500);
      } else {
        if (statusEl) statusEl.innerHTML = '❌ בוטל';
      }

    } catch (err) {
      console.error('Import error:', err);
      alert('שגיאה: ' + err.message);
      if (statusEl) statusEl.innerHTML = '❌ שגיאה: ' + err.message;
    } finally {
      input.value = '';
    }
  };

  reader.readAsArrayBuffer(file);
};
