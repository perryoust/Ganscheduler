const XLSX = require('xlsx');
const filePath = "C:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\חוגים\\תוכנית חוגים תשפ''ו.xlsx";

try {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['חוסרים להשלמה'];
  
  console.log('Row properties (!rows):', sheet['!rows'] ? sheet['!rows'].slice(0, 20) : 'none');
  
  // Let's inspect rows 0 to 15 (which correspond to row numbers 1 to 16 in Excel)
  if (sheet['!rows']) {
    sheet['!rows'].forEach((r, idx) => {
      console.log(`Row index ${idx} (Excel Row ${idx + 1}):`, r);
    });
  }
} catch (e) {
  console.error(e);
}
