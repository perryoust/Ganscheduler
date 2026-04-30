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
  if (statusEl) statusEl.innerHTML = '⏳ מעבד קובץ...';

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = new window.ExcelJS.Workbook();
      await workbook.xlsx.load(data);
      const ws = workbook.getWorksheet(1); // First sheet

      const newSCH = [];
      const headers = {};
      
      // Map headers
      ws.getRow(1).eachCell((cell, colNumber) => {
        headers[cell.value] = colNumber;
      });

      // Simple validation of required headers (Date, Garden ID, Supplier)
      const required = ['תאריך (YYYY-MM-DD)', 'מזהה גן (ID)', 'ספק'];
      const missing = required.filter(h => !headers[h]);
      if (missing.length > 0) {
        throw new Error('חסרות עמודות חובה: ' + missing.join(', '));
      }

      // Iterate rows (skip header)
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const getVal = (header) => {
          const cell = row.getCell(headers[header]);
          if (!cell) return '';
          let val = cell.value;
          if (val && typeof val === 'object' && 'result' in val) val = val.result;
          return val;
        };

        const gardenId = parseInt(getVal('מזהה גן (ID)'));
        if (isNaN(gardenId)) return; // Skip invalid rows

        const eventDate = getVal('תאריך (YYYY-MM-DD)');
        // Basic date format validation
        let formattedDate = '';
        if (eventDate instanceof Date) {
          formattedDate = eventDate.toISOString().slice(0,10);
        } else if (typeof eventDate === 'string' && eventDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          formattedDate = eventDate;
        } else if (typeof eventDate === 'number') {
          // Handle Excel serial date
          const dateObj = new Date((eventDate - 25569) * 86400 * 1000);
          formattedDate = dateObj.toISOString().slice(0,10);
        } else {
          console.warn('Invalid date at row', rowNumber, eventDate);
          return; 
        }

        const entry = {
          id: getVal('Event ID') || Date.now() + Math.random().toString(36).substr(2, 5),
          d: formattedDate,
          g: gardenId,
          a: getVal('ספק'),
          act: getVal('פעילות') || '',
          t: String(getVal('שעה (HH:MM)') || '').slice(0, 5),
          grp: parseInt(getVal('קבוצה')) || 1,
          st: getVal('סטטוס') || 'ok',
          p: String(getVal('טלפון') || ''),
          n: String(getVal('הערות') || '')
        };

        newSCH.push(entry);
      });

      if (newSCH.length === 0) {
        throw new Error('לא נמצאו נתונים תקינים לייבוא');
      }

      const msg = `⚠️ נמצאו ${newSCH.length} שיבוצים לייבוא.\nפעולה זו תחליף את כל לוח הזמנים הקיים (${window.SCH.length} שיבוצים).\n\nהאם להמשיך?`;
      if (confirm(msg)) {
        window.SCH = newSCH;
        window.save();
        window.showToast('✅ לוח זמנים עודכן בהצלחה! טוען מחדש...');
        if (statusEl) statusEl.innerHTML = `✅ יובאו ${newSCH.length} שיבוצים.`;
        setTimeout(() => location.reload(), 1500);
      } else {
        if (statusEl) statusEl.innerHTML = '❌ הייבוא בוטל על ידי המשתמש';
      }

    } catch (err) {
      console.error('Import error:', err);
      alert('שגיאה בייבוא: ' + err.message);
      if (statusEl) statusEl.innerHTML = '❌ שגיאה: ' + err.message;
    } finally {
      input.value = ''; // Reset input
    }
  };

  reader.readAsArrayBuffer(file);
};
