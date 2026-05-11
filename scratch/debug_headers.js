const XLSX = require('xlsx');
const wb = XLSX.readFile('GAN.xlsx', { cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

let bestHeader = { idx: -1, count: 0, map: {} };
for (let i = 0; i < Math.min(10, rows.length); i++) {
  const r = rows[i];
  if (!r || !Array.isArray(r)) continue;
  let cF = 0, cM = {};
  r.forEach((c, idx) => {
    if (!c) return;
    const n = String(c).replace(/\(.*\)/g, '').replace(/[\"\']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    cM[n] = idx;
    if (/תאריך|date|יום/.test(n)) cF++;
    if (/גן|garden|צהרון/.test(n)) cF++;
    if (/חוג|ספק|activity|שם החוג/.test(n)) cF++;
  });
  if (cF > bestHeader.count) {
    bestHeader = { idx: i, count: cF, map: cM };
  }
}
console.log(bestHeader.map);
