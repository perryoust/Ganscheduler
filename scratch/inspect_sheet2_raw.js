const XLSX = require('xlsx');
const filePath = "C:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\חוגים\\תוכנית חוגים תשפ''ו.xlsx";

try {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets['חוסרים להשלמה'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // Print headers
  console.log('Headers (Row 1):', rows[0]);
  
  // Print rows 1 to 15
  for (let i = 1; i < Math.min(rows.length, 16); i++) {
    console.log(`Excel Row ${i + 1}:`, rows[i]);
  }
} catch (e) {
  console.error(e);
}
