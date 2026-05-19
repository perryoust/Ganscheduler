const XLSX = require('xlsx');
const wb = XLSX.readFile('scratch/user_invoices.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

const headerRowIndex = 2;
const INVOICES = [];
let added = 0, updated = 0, skippedNoSup = 0;
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
  const oNum = String(item.orderNum || "").trim();
  const oDesc = String(item.orderDesc || "").trim();
  const oTotal = parseFloat(item.orderTotal || 0).toFixed(2);
  const txNum = String(item.txNum || "").trim();
  const num = String(item.num || "").trim();

  // FINAL fixed duplicate detection
  let reason = null;
  const existingIdx = INVOICES.findIndex(inv => {
    const sameSup = String(inv.supName).trim().toLowerCase() === sName.toLowerCase();
    if (!sameSup) return false;
    if (num && inv.num && String(inv.num).trim() === num) { reason = 'num'; return true; }
    if (txNum && inv.txNum && String(inv.txNum).trim() === txNum) { reason = 'txNum'; return true; }
    if (oNum && inv.orderNum && String(inv.orderNum).trim() === oNum && /^\d/.test(oNum)) {
      if (String(inv.orderDesc || '').trim() === oDesc) { reason = 'orderNum'; return true; }
    }
    if (String(inv.orderDesc).trim() === oDesc && parseFloat(inv.orderTotal || 0).toFixed(2) === oTotal) {
      reason = 'descAmt'; return true;
    }
    return false;
  });

  if (existingIdx !== -1) {
    if (reason === 'num') dupByNum++;
    else if (reason === 'txNum') dupByTxNum++;
    else if (reason === 'orderNum') dupByOrderNum++;
    else if (reason === 'descAmt') dupByDescAmt++;
    INVOICES[existingIdx] = { ...INVOICES[existingIdx], ...item };
    updated++;
  } else {
    item.id = Date.now() + i;
    INVOICES.push(item);
    added++;
  }
}

console.log('=== FINAL FIXED Import Simulation ===');
console.log('Total data rows:', rows.length - headerRowIndex - 1);
console.log('Added (new):', added);
console.log('Updated (dup):', updated);
console.log('  - by invoice num:', dupByNum);
console.log('  - by txNum:', dupByTxNum);
console.log('  - by orderNum+desc:', dupByOrderNum);
console.log('  - by desc+amount:', dupByDescAmt);
console.log('Skipped (no supplier):', skippedNoSup);
console.log('');
console.log('✅ Final INVOICES count:', INVOICES.length);
console.log('   (was 901 before fix, now', INVOICES.length, ')');
