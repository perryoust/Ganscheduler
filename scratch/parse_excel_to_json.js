const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const file = path.join(__dirname, '..', 'דוח הזמנות רכש וחשבוניות.xlsx');
if (!fs.existsSync(file)) {
  console.error(`Excel file not found at: ${file}`);
  process.exit(1);
}

const workbook = XLSX.readFile(file);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Get raw rows as array of arrays
const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
console.log(`Loaded ${rawRows.length} raw rows.`);

// The columns (Row 1) mapped to internal keys
const map = [
  null, // index 0 is "מס"ד"
  "orderNum", // index 1
  "orderDate", // index 2
  "supName", // index 3
  "orderDesc", // index 4
  "orderType", // index 5 (סיווג)
  "orderAssign", // index 6 (שיוך)
  "orderMonth", // index 7 (חודש פעילות)
  "locCity", // index 8
  "locType", // index 9
  "locName", // index 10
  "orderTotal", // index 11
  "orderNotes", // index 12
  "txNum", // index 13
  "txDate", // index 14
  "txAmt", // index 15
  "txTotal", // index 16
  "num", // index 17
  "date", // index 18
  "amt", // index 19
  "total", // index 20
  "notes" // index 21
];

function excelDateToString(val) {
  if (!val) return '';
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  return String(val).trim();
}

function cleanString(val) {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

function cleanNumber(val) {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val).replace(/[^\d.-]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

const invoices = [];
let idCounter = 1;

// Row 2 is the first data row (index 2)
for (let i = 2; i < rawRows.length; i++) {
  const row = rawRows[i];
  if (!row || row.length === 0) continue;

  const item = {
    id: Date.now() + idCounter++
  };

  // Map each column using the defined map
  map.forEach((key, colIndex) => {
    if (!key) return;
    const rawVal = row[colIndex];
    
    if (key.endsWith('Date') || key === 'date') {
      item[key] = excelDateToString(rawVal);
    } else if (key.endsWith('Total') || key.endsWith('Amt') || key === 'amt' || key === 'total') {
      item[key] = cleanNumber(rawVal);
    } else {
      item[key] = cleanString(rawVal);
    }
  });

  // Skip rows with no supplier name
  if (!item.supName) continue;

  // Infer status
  let status = 'order';
  if (item.num) {
    status = 'tax_invoice';
  } else if (item.txNum) {
    status = 'tx_invoice';
  }
  item.status = status;

  invoices.push(item);
}

console.log(`Parsed and mapped ${invoices.length} invoices successfully.`);

const outputPath = path.join(__dirname, 'restored_invoices.json');
fs.writeFileSync(outputPath, JSON.stringify(invoices, null, 2), 'utf8');
console.log(`Saved clean invoices JSON to: ${outputPath}`);
