const fs = require('fs');
const path = require('path');

// We can check if xlsx package or exceljs package is available or just try to run it.
// Ganscheduler has window.XLSX loaded in the browser. In node, let's see if we can load it.
try {
  const file = path.join(__dirname, '..', 'דוח הזמנות רכש וחשבוניות.xlsx');
  if (fs.existsSync(file)) {
    console.log(`Excel file found: ${file}`);
    const stats = fs.statSync(file);
    console.log(`Size: ${stats.size} bytes`);
    
    // Let's try importing xlsx in node if it is installed
    try {
      const XLSX = require('xlsx');
      const workbook = XLSX.readFile(file);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet);
      console.log(`Successfully parsed with xlsx!`);
      console.log(`Sheet name: ${sheetName}`);
      console.log(`Number of rows: ${rows.length}`);
      if (rows.length > 0) {
        console.log('Sample row:', JSON.stringify(rows[0], null, 2));
      }
    } catch(err) {
      console.log(`Could not parse in Node (xlsx library might not be in node_modules): ${err.message}`);
    }
  } else {
    console.log(`Excel file NOT found at: ${file}`);
  }
} catch(e) {
  console.log(`Error: ${e.message}`);
}
