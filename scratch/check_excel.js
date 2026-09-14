const XLSX = require('xlsx');
const fs = require('fs');

function checkFile(filename) {
  if (!fs.existsSync(filename)) {
    console.log(`File ${filename} does not exist.`);
    return;
  }
  const wb = XLSX.readFile(filename);
  console.log(`\n=== File: ${filename} ===`);
  console.log(`Sheets: ${wb.SheetNames.join(', ')}`);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  console.log(`Total rows: ${data.length}`);
  if (data.length > 0) {
    console.log('Row 0:', data[0]?.slice(0, 5));
    console.log('Row 1:', data[1]?.slice(0, 5));
    console.log('Row 2 (header):', data[2]?.slice(0, 5));
    const lastRow = data[data.length - 1];
    console.log('Last row:', lastRow?.slice(0, 5));
    // Find highest serialNum in column 0 or 1
    let maxSerial = 0;
    for (let i = 3; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;
      const s0 = parseInt(row[0], 10);
      const s1 = parseInt(row[1], 10);
      if (!isNaN(s0) && s0 > maxSerial) maxSerial = s0;
      if (!isNaN(s1) && s1 > maxSerial) maxSerial = s1;
    }
    console.log(`Max serial number detected: ${maxSerial}`);
  }
}

checkFile('דוח הזמנות רכש וחשבוניות.xlsx');
checkFile('invoices.xlsx');
