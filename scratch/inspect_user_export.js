const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, "תוכנית חוגים תשפ''ו.xlsx");

try {
  const wb = XLSX.readFile(filePath, { cellStyles: true });
  console.log("=== WORKBOOK INFO ===");
  console.log("Sheet names:", wb.SheetNames);
  
  // Inspect the first sheet
  const firstSheetName = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheetName];
  
  console.log(`\n=== SHEET: ${firstSheetName} ===`);
  const range = XLSX.utils.decode_range(ws['!ref']);
  console.log(`Rows: ${range.e.r - range.s.r + 1}, Cols: ${range.e.c - range.s.c + 1}`);
  
  // Get first 15 rows
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log("\nFirst 15 rows:");
  for (let i = 0; i < Math.min(15, data.length); i++) {
    console.log(`Row ${i + 1}:`, data[i]);
  }
} catch (e) {
  console.error("Error reading file:", e);
}
