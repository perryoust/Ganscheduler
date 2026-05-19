const XLSX = require('xlsx');
const wb = XLSX.readFile('scratch/user_invoices.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

const headerRowIndex = 2;
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
  const oNum = String(item.orderNum || "").trim();
  const oDesc = String(item.orderDesc || "").trim();
  const oTotal = parseFloat(item.orderTotal || 0).toFixed(2);
  const txNum = String(item.txNum || "").trim();
  const num = String(item.num || "").trim();

  // NEW duplicate detection logic (fixed)
  const existingIdx = INVOICES.findIndex(inv => {
    const sameSup = String(inv.supName).trim().toLowerCase() === sName.toLowerCase();
    if (!sameSup) return false;
    if (num && inv.num && String(inv.num).trim() === num) return true;
    if (txNum && inv.txNum && String(inv.txNum).trim() === txNum) return true;
    if (oNum && inv.orderNum && String(inv.orderNum).trim() !== "" && String(inv.orderNum).trim() === oNum) {
      if (String(inv.orderDesc || '').trim() === oDesc || parseFloat(inv.orderTotal || 0).toFixed(2) === oTotal) {
        return true;
      }
    }
    return String(inv.orderDesc).trim() === oDesc &&
           parseFloat(inv.orderTotal || 0).toFixed(2) === oTotal;
  });

  if (existingIdx !== -1) {
    INVOICES[existingIdx] = { ...INVOICES[existingIdx], ...item };
    updated++;
  } else {
    item.id = Date.now() + i;
    INVOICES.push(item);
    added++;
  }
}

console.log('=== FIXED Import Simulation ===');
console.log('Added (new):', added);
console.log('Updated (genuine duplicate):', updated);
console.log('Skipped (no supplier):', skippedNoSup);
console.log('Final INVOICES count:', INVOICES.length);
