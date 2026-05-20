const XLSX = require('xlsx');

const filePath = "C:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\חוגים\\תוכנית חוגים תשפ''ו.xlsx";

try {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['חוסרים להשלמה'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  let populatedRows = 0;
  let nonGardenRows = 0;
  
  rows.forEach((r, idx) => {
    const hasContent = r && r.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
    if (hasContent) {
      populatedRows++;
      if (idx > 0) {
        // Log some populated rows
        if (populatedRows < 15) {
          console.log(`Populated Row ${idx}:`, r);
        }
      }
    }
  });
  console.log(`Total rows in Sheet: ${rows.length}`);
  console.log(`Populated rows: ${populatedRows}`);
} catch (e) {
  console.error(e);
}
