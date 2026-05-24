const XLSX = require('xlsx');
const filePath = "C:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\חוגים\\תוכנית חוגים תשפ''ו.xlsx";

try {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['חוסרים להשלמה'];
  
  console.log('Autofilter properties:', sheet['!autofilter']);
} catch (e) {
  console.error(e);
}
