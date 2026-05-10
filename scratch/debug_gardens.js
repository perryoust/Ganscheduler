const XLSX = require('./xlsx.js');
const fs = require('fs');
const data = fs.readFileSync('../GAN.xlsx');
const workbook = XLSX.read(data, { type: 'buffer' });

workbook.SheetNames.forEach(n => {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[n], { header: 1 });
  rows.forEach((r, i) => {
    const s = JSON.stringify(r);
    if (s.includes('רוזמרין') || s.includes('צלף') || s.includes('שדמית') || s.includes('יונה')) {
      console.log(`Sheet: ${n}, Row ${i}: ${s}`);
    }
  });
});
