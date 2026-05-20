const XLSX = require('xlsx');

const filePath = "C:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\חוגים\\תוכנית חוגים תשפ''ו.xlsx";

try {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['חוסרים להשלמה'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  let totalWithCompleted = 0;
  rows.forEach((r, idx) => {
    if (idx === 0) return;
    const completedVal = r[13];
    if (completedVal !== undefined && completedVal !== null && String(completedVal).trim() !== '') {
      totalWithCompleted++;
      if (totalWithCompleted < 10) {
        console.log(`Row ${idx} has completed value:`, completedVal, "Row content:", r);
      }
    }
  });
  console.log(`Total rows with completed column populated: ${totalWithCompleted}`);
} catch (e) {
  console.error(e);
}
