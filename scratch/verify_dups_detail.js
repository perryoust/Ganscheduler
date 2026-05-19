const XLSX = require('xlsx');
const wb = XLSX.readFile('scratch/user_invoices.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

const headerRowIndex = 2;

// Check the remaining 299 "duplicates" - are they really the same?
const INVOICES = [];
let dupByNum = 0, dupByTxNum = 0, dupByOrderNumDesc = 0, dupByDescAmt = 0;
const dupExamples = { num: [], txNum: [], orderNumDesc: [], descAmt: [] };

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
  const existingIdx = INVOICES.findIndex(inv => {
    const sameSup = String(inv.supName).trim().toLowerCase() === sName.toLowerCase();
    if (!sameSup) return false;
    if (num && inv.num && String(inv.num).trim() === num) { reason = 'num'; return true; }
    if (txNum && inv.txNum && String(inv.txNum).trim() === txNum) { reason = 'txNum'; return true; }
    if (oNum && inv.orderNum && String(inv.orderNum).trim() !== "" && String(inv.orderNum).trim() === oNum) {
      if (String(inv.orderDesc || '').trim() === oDesc || parseFloat(inv.orderTotal || 0).toFixed(2) === oTotal) {
        reason = 'orderNumDesc'; return true;
      }
    }
    if (String(inv.orderDesc).trim() === oDesc && parseFloat(inv.orderTotal || 0).toFixed(2) === oTotal) {
      reason = 'descAmt'; return true;
    }
    return false;
  });

  if (existingIdx !== -1) {
    if (reason === 'num') { dupByNum++; if (dupExamples.num.length < 3) dupExamples.num.push({ row: i, existing: existingIdx, item, existing_item: INVOICES[existingIdx] }); }
    else if (reason === 'txNum') { dupByTxNum++; }
    else if (reason === 'orderNumDesc') { dupByOrderNumDesc++; if (dupExamples.orderNumDesc.length < 3) dupExamples.orderNumDesc.push({ row: i, existing: existingIdx, new_oNum: oNum, new_desc: oDesc.substring(0,40), existing_desc: String(INVOICES[existingIdx].orderDesc||'').substring(0,40), new_total: oTotal, existing_total: parseFloat(INVOICES[existingIdx].orderTotal||0).toFixed(2) }); }
    else if (reason === 'descAmt') { dupByDescAmt++; if (dupExamples.descAmt.length < 3) dupExamples.descAmt.push({ row: i, existing: existingIdx, sup: sName, desc: oDesc.substring(0,40), total: oTotal }); }
    INVOICES[existingIdx] = { ...INVOICES[existingIdx], ...item };
  } else {
    item.id = Date.now() + i;
    INVOICES.push(item);
  }
}

console.log('Dup by invoice num:', dupByNum);
console.log('Dup by txNum:', dupByTxNum);
console.log('Dup by orderNum+desc/total:', dupByOrderNumDesc);
console.log('Dup by desc+amount:', dupByDescAmt);

if (dupExamples.num.length) {
  console.log('\nExamples of num-based dups:');
  dupExamples.num.forEach(d => console.log(`  Row ${d.row}: num=${d.item.num}, sup="${d.item.supName}", desc="${String(d.item.orderDesc||'').substring(0,40)}"`));
}

if (dupExamples.orderNumDesc.length) {
  console.log('\nExamples of orderNum+desc/total dups:');
  dupExamples.orderNumDesc.forEach(d => console.log(`  Row ${d.row}: oNum=${d.new_oNum}, new_desc="${d.new_desc}", existing_desc="${d.existing_desc}", new_total=${d.new_total}, existing_total=${d.existing_total}`));
}

if (dupExamples.descAmt.length) {
  console.log('\nExamples of desc+amount dups:');
  dupExamples.descAmt.forEach(d => console.log(`  Row ${d.row}: sup="${d.sup}", desc="${d.desc}", total=${d.total}`));
}

console.log('\nFinal count:', INVOICES.length);
