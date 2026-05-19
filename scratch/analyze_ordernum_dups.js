const XLSX = require('xlsx');
const wb = XLSX.readFile('scratch/user_invoices.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

// Find pairs of rows that share the same orderNum
const headerRowIndex = 2;
const byOrderNum = {};

for (let i = headerRowIndex + 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row) continue;
  const supName = String(row[3] || '').trim();
  const orderNum = String(row[1] || '').trim();
  if (!supName || !orderNum) continue;
  
  if (!byOrderNum[orderNum + '|' + supName.toLowerCase()]) {
    byOrderNum[orderNum + '|' + supName.toLowerCase()] = [];
  }
  byOrderNum[orderNum + '|' + supName.toLowerCase()].push({ row: i, data: row });
}

// Show some examples of orderNums with multiple rows
let shown = 0;
console.log('=== orderNums that appear multiple times (causing "duplicate" detection) ===\n');
for (const [key, entries] of Object.entries(byOrderNum)) {
  if (entries.length > 1 && shown < 5) {
    console.log(`orderNum|sup: "${key}" appears ${entries.length} times:`);
    for (const e of entries) {
      const r = e.data;
      // Show: orderNum, supName, orderDesc, orderTotal, txNum, num(invoice#)
      console.log(`  Row ${e.row}: orderNum=${r[1]}, date=${r[2]}, sup="${String(r[3]).substring(0,30)}", desc="${String(r[4]||'').substring(0,30)}", orderTotal=${r[11]}, txNum=${r[13]}, invNum=${r[17]}`);
    }
    console.log('');
    shown++;
  }
}

// Count total rows that are "second occurrence" of an orderNum
let totalDups = 0;
for (const entries of Object.values(byOrderNum)) {
  if (entries.length > 1) totalDups += entries.length - 1;
}
console.log('Total rows that share an orderNum with another row (same supplier):', totalDups);

// Check: are these actually DIFFERENT records (different invoice nums, different amounts)?
let genuinelyDifferent = 0;
for (const entries of Object.values(byOrderNum)) {
  if (entries.length <= 1) continue;
  for (let j = 1; j < entries.length; j++) {
    const r0 = entries[0].data;
    const rj = entries[j].data;
    // Different invoice number or different amount = genuinely different record
    if ((r0[17] !== rj[17]) || (r0[11] !== rj[11]) || (r0[4] !== rj[4])) {
      genuinelyDifferent++;
    }
  }
}
console.log('Of those, genuinely different records (diff desc/amount/invNum):', genuinelyDifferent);
