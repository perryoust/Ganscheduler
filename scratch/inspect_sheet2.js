const XLSX = require('xlsx');

const filePath = "C:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\חוגים\\תוכנית חוגים תשפ''ו.xlsx";

try {
  const workbook = XLSX.readFile(filePath);
  console.log("SheetNames:", workbook.SheetNames);
  
  workbook.SheetNames.forEach((sheetName, sIdx) => {
    console.log(`\n--- Sheet ${sIdx}: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`Total rows: ${rows.length}`);
    console.log("First 8 rows:");
    rows.slice(0, 8).forEach((r, i) => console.log(`Row ${i}:`, r));
  });
} catch (e) {
  console.error("Error reading file:", e.message);
}
