const XLSX = require('xlsx');
const filePath = "C:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\חוגים\\תוכנית חוגים תשפ''ו.xlsx";

try {
  const workbook = XLSX.readFile(filePath, { cellStyles: true, cellFormulas: true, cellNF: true, cellDates: true });
  const sheet = workbook.Sheets['חוסרים להשלמה'];
  const rows = sheet['!rows'] || [];
  
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    console.log(`Row index ${i} (Excel Row ${i + 1}):`, rows[i]);
  }
} catch (e) {
  console.error(e);
}
