const XLSX = require('xlsx');
const wb = XLSX.readFile('scratch/user_invoices.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

const headerRowIndex = 2;

// Simulate the full import into an empty INVOICES array
const INVOICES = [];
let added = 0, updated = 0, skippedNoSup = 0, skippedEmpty = 0;

for (let i = headerRowIndex + 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length === 0) { skippedEmpty++; continue; }

  const item = {};
  const colMapping = [
    null, "orderNum", "orderDate", "supName", "orderDesc",
    "orderType", "orderAssign", "orderMonth",
    "locCity", "locType", "locName", "orderTotal",
    "orderNotes", "txNum", "txDate", "txAmt",
    "txTotal", "num", "date", "amt", "total", "notes"
  ];
  colMapping.forEach((key, colIdx) => {
    if (key) item[key] = row[colIdx];
  });

  if (!item.supName) { skippedNoSup++; continue; }

  // Format dates
  ["orderDate", "txDate", "date"].forEach(dk => {
    if (typeof item[dk] === "number") {
      const d = new Date(Math.round((item[dk] - 25569) * 86400 * 1000));
      item[dk] = d.toISOString().slice(0, 10);
    }
  });

  // Numeric fields
  ["orderTotal", "txAmt", "txTotal", "amt", "total"].forEach(nk => {
    if (item[nk] !== undefined && item[nk] !== null) {
      if (typeof item[nk] === 'string') {
        const parsed = parseFloat(item[nk].replace(/[^\d.-]/g, ''));
        item[nk] = isNaN(parsed) ? 0 : parsed;
      }
    } else {
      item[nk] = 0;
    }
  });

  const sName = String(item.supName || "").trim().replace(/[.$#[\]/]/g, '');
  item.supName = sName;
  const oNum = String(item.orderNum || "").trim();
  const oDesc = String(item.orderDesc || "").trim();
  const oTotal = parseFloat(item.orderTotal || 0).toFixed(2);
  const txNum = String(item.txNum || "").trim();
  const num = String(item.num || "").trim();

  // Duplicate check (same as importInvoices)
  const existingIdx = INVOICES.findIndex(inv => {
    if (num && inv.num && String(inv.num).trim() === num && String(inv.supName).trim().toLowerCase() === sName.toLowerCase()) return true;
    if (txNum && inv.txNum && String(inv.txNum).trim() === txNum && String(inv.supName).trim().toLowerCase() === sName.toLowerCase()) return true;
    if (oNum && inv.orderNum && String(inv.orderNum).trim() !== "" && String(inv.orderNum).trim() === oNum && String(inv.supName).trim().toLowerCase() === sName.toLowerCase()) return true;
    return String(inv.supName).trim().toLowerCase() === sName.toLowerCase() &&
           String(inv.orderDesc).trim() === oDesc &&
           parseFloat(inv.orderTotal || 0).toFixed(2) === oTotal;
  });

  if (existingIdx !== -1) {
    INVOICES[existingIdx] = { ...INVOICES[existingIdx], ...item };
    updated++;
  } else {
    item.id = Date.now() + Math.floor(Math.random() * 10000);
    INVOICES.push(item);
    added++;
  }
}

console.log('=== Import Simulation Results ===');
console.log('Total rows (after header):', rows.length - headerRowIndex - 1);
console.log('Added (new):', added);
console.log('Updated (duplicate):', updated);
console.log('Skipped (no supplier):', skippedNoSup);
console.log('Skipped (empty):', skippedEmpty);
console.log('Final INVOICES count:', INVOICES.length);

// Show what duplicates matched on
console.log('\n=== Duplicate analysis ===');
// Re-run but track why duplicates happen
const inv2 = [];
let dupByNum = 0, dupByTxNum = 0, dupByOrderNum = 0, dupByDescAmt = 0;

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
      if (typeof item[nk] === 'string') {
        const parsed = parseFloat(item[nk].replace(/[^\d.-]/g, ''));
        item[nk] = isNaN(parsed) ? 0 : parsed;
      }
    } else { item[nk] = 0; }
  });

  const sName = String(item.supName || "").trim().replace(/[.$#[\]/]/g, '');
  item.supName = sName;
  const oNum = String(item.orderNum || "").trim();
  const oDesc = String(item.orderDesc || "").trim();
  const oTotal = parseFloat(item.orderTotal || 0).toFixed(2);
  const txNum = String(item.txNum || "").trim();
  const num = String(item.num || "").trim();

  let reason = null;
  const existingIdx = inv2.findIndex(inv => {
    if (num && inv.num && String(inv.num).trim() === num && String(inv.supName).trim().toLowerCase() === sName.toLowerCase()) { reason = 'num'; return true; }
    if (txNum && inv.txNum && String(inv.txNum).trim() === txNum && String(inv.supName).trim().toLowerCase() === sName.toLowerCase()) { reason = 'txNum'; return true; }
    if (oNum && inv.orderNum && String(inv.orderNum).trim() !== "" && String(inv.orderNum).trim() === oNum && String(inv.supName).trim().toLowerCase() === sName.toLowerCase()) { reason = 'orderNum'; return true; }
    if (String(inv.supName).trim().toLowerCase() === sName.toLowerCase() &&
        String(inv.orderDesc).trim() === oDesc &&
        parseFloat(inv.orderTotal || 0).toFixed(2) === oTotal) { reason = 'desc+amt'; return true; }
    return false;
  });

  if (existingIdx !== -1) {
    if (reason === 'num') dupByNum++;
    else if (reason === 'txNum') dupByTxNum++;
    else if (reason === 'orderNum') dupByOrderNum++;
    else if (reason === 'desc+amt') dupByDescAmt++;
    inv2[existingIdx] = { ...inv2[existingIdx], ...item };
  } else {
    item.id = Date.now() + i;
    inv2.push(item);
  }
}

console.log('Duplicates matched by invoice num:', dupByNum);
console.log('Duplicates matched by txNum:', dupByTxNum);
console.log('Duplicates matched by orderNum:', dupByOrderNum);
console.log('Duplicates matched by desc+amount:', dupByDescAmt);
console.log('Total duplicates:', dupByNum + dupByTxNum + dupByOrderNum + dupByDescAmt);
