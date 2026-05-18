const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const file = path.join(__dirname, '..', 'דוח הזמנות רכש וחשבוניות.xlsx');
if (fs.existsSync(file)) {
  const workbook = XLSX.readFile(file);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Get raw JSON rows
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`Total raw rows: ${rawRows.length}`);
  
  // Print first 5 rows
  console.log('--- FIRST 5 ROWS RAW ---');
  for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
    console.log(`Row ${i}:`, JSON.stringify(rawRows[i], null, 2));
  }
} else {
  console.log('Excel file not found');
}
