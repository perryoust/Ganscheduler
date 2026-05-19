const XLSX = require('xlsx');
const wb = XLSX.readFile('scratch/user_invoices.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

const headerRowIndex = 2;

// Strategy: unique key = supplier + description + orderTotal + orderMonth
// This ensures consolidated invoices (same num, different desc) are kept separate
// But true duplicates (exact same row imported twice) are merged

const INVOICES = [];
let added = 0, updated = 0, skippedNoSup = 0;

for (let i = headerRowIndex + 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length === 0) continue;

  const item = {};
  const colMapping = [
    null, "orderNum", "orderDate", "supName", "orderDesc",
    "orderType", "orderAssign", "orderMonth",
    "locCity", "locType", "locName", "orderTotal",
    "orderNotes", "txNum", "txDate", "txAmt",
    "txTotal", "num", "date", "amt", "total", "notes"
  ];
  colMapping.forEach((key, colIdx) => { if (key) item[key] = row[colIdx]; });
  if (!item.supName) { skippedNoSup++; continue; }

  ["orderTotal", "txAmt", "txTotal", "amt", "total"].forEach(nk => {
    if (item[nk] !== undefined && item[nk] !== null) {
      if (typeof item[nk] === 'string') {
        const parsed = parseFloat(item[nk].replace(/[^\d.-]/g, ''));
        item[nk] = isNaN(parsed) ? 0 : parsed;
      }
    } else { item[nk] = 0; }
  });

  const sName = String(item.supName || "").trim().replace(/[.$#[\]/]/g, '');
  item.supName = sName;
  const oDesc = String(item.orderDesc || "").trim();
  const oTotal = parseFloat(item.orderTotal || 0).toFixed(2);
  const oMonth = String(item.orderMonth || "").trim();

  // ONLY match on supplier + description + amount + month
  // This is the most conservative approach that still prevents true re-import duplicates
  const existingIdx = INVOICES.findIndex(inv => {
    const sameSup = String(inv.supName).trim().toLowerCase() === sName.toLowerCase();
    if (!sameSup) return false;
    const sameDesc = String(inv.orderDesc || '').trim() === oDesc;
    const sameTotal = parseFloat(inv.orderTotal || 0).toFixed(2) === oTotal;
    const sameMonth = String(inv.orderMonth || '').trim() === oMonth;
    return sameDesc && sameTotal && sameMonth;
  });

  if (existingIdx !== -1) {
    // Merge: preserve existing fields (like fileUrl), update with new data
    INVOICES[existingIdx] = { ...INVOICES[existingIdx], ...item };
    updated++;
  } else {
    item.id = Date.now() + i;
    INVOICES.push(item);
    added++;
  }
}

console.log('=== Conservative Import (sup+desc+total+month) ===');
console.log('Total data rows:', rows.length - headerRowIndex - 1);
console.log('Added (unique):', added);
console.log('Updated (genuine duplicate):', updated);
console.log('Skipped (no supplier):', skippedNoSup);
console.log('✅ Final INVOICES count:', INVOICES.length);

// Now simulate re-import to verify idempotency
console.log('\n=== Simulating RE-IMPORT of same file ===');
// Add fake fileUrl to some records to verify preservation
INVOICES.slice(0, 10).forEach(inv => { inv.fileUrl = 'https://sharepoint.example.com/doc/' + inv.id; });
INVOICES.slice(0, 10).forEach(inv => { inv.customNote = 'user added note'; });

let reAdded = 0, reUpdated = 0, linksPreserved = 0;
for (let i = headerRowIndex + 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length === 0) continue;
  const item = {};
  const colMapping = [
    null, "orderNum", "orderDate", "supName", "orderDesc",
    "orderType", "orderAssign", "orderMonth",
    "locCity", "locType", "locName", "orderTotal",
    "orderNotes", "txNum", "txDate", "txAmt",
    "txTotal", "num", "date", "amt", "total", "notes"
  ];
  colMapping.forEach((key, colIdx) => { if (key) item[key] = row[colIdx]; });
  if (!item.supName) continue;
  ["orderTotal", "txAmt", "txTotal", "amt", "total"].forEach(nk => {
    if (item[nk] !== undefined && item[nk] !== null) {
      if (typeof item[nk] === 'string') { item[nk] = parseFloat(item[nk].replace(/[^\d.-]/g, '')) || 0; }
    } else { item[nk] = 0; }
  });
  const sName = String(item.supName || "").trim().replace(/[.$#[\]/]/g, '');
  item.supName = sName;
  const oDesc = String(item.orderDesc || "").trim();
  const oTotal = parseFloat(item.orderTotal || 0).toFixed(2);
  const oMonth = String(item.orderMonth || "").trim();

  const existingIdx = INVOICES.findIndex(inv => {
    const sameSup = String(inv.supName).trim().toLowerCase() === sName.toLowerCase();
    if (!sameSup) return false;
    return String(inv.orderDesc || '').trim() === oDesc &&
           parseFloat(inv.orderTotal || 0).toFixed(2) === oTotal &&
           String(inv.orderMonth || '').trim() === oMonth;
  });

  if (existingIdx !== -1) {
    const hadLink = !!INVOICES[existingIdx].fileUrl;
    INVOICES[existingIdx] = { ...INVOICES[existingIdx], ...item };
    if (hadLink && INVOICES[existingIdx].fileUrl) linksPreserved++;
    reUpdated++;
  } else {
    item.id = Date.now() + i + 100000;
    INVOICES.push(item);
    reAdded++;
  }
}

console.log('Re-import added:', reAdded, '(should be 0)');
console.log('Re-import updated:', reUpdated, '(should match first import)');
console.log('Links preserved:', linksPreserved, '/ 10');
console.log('Final count after re-import:', INVOICES.length, '(should be same as first import)');

// Verify fileUrl preserved
const withLinks = INVOICES.filter(inv => inv.fileUrl);
const withNotes = INVOICES.filter(inv => inv.customNote);
console.log('Records with fileUrl preserved:', withLinks.length);
console.log('Records with customNote preserved:', withNotes.length);
