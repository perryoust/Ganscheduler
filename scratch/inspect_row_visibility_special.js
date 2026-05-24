const XLSX = require('xlsx');
const filePath = "C:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\חוגים\\תוכנית חוגים תשפ''ו.xlsx";

try {
  const workbook = XLSX.readFile(filePath, { cellStyles: true, cellFormulas: true, cellNF: true, cellDates: true });
  const sheet = workbook.Sheets['חוסרים להשלמה'];
  const rows = sheet['!rows'] || [];
  
  rows.forEach((r, idx) => {
    // Print if it has any property other than just hpt/hpx, or if hidden is true, or if height is 0
    if (r.hidden || r.hpt === 0 || r.hpx === 0 || Object.keys(r).length > 2) {
      console.log(`Excel Row ${idx + 1} has special properties:`, r);
    }
  });
  
  console.log('Total rows in !rows:', rows.length);
} catch (e) {
  console.error(e);
}
