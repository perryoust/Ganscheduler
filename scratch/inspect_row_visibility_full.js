const XLSX = require('xlsx');
const filePath = "C:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\חוגים\\תוכנית חוגים תשפ''ו.xlsx";

try {
  const workbook = XLSX.readFile(filePath, { cellStyles: true, cellFormulas: true, cellNF: true, cellDates: true });
  const sheet = workbook.Sheets['חוסרים להשלמה'];
  
  console.log('Row properties (!rows):', sheet['!rows']);
} catch (e) {
  console.error(e);
}
