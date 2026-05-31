const fs = require('fs');

let e = fs.readFileSync('export.js', 'utf8');
e = e.replace(
  "const ws = workbook.addWorksheet('Sheet1', { views: [{ rightToLeft: true }] });",
  "const ws = workbook.addWorksheet('Sheet1', { views: [{ rightToLeft: true }] });\n      ws.pageSetup.margins = { left: 0.3/2.54, right: 0.3/2.54, top: 0.4/2.54, bottom: 0.4/2.54, header: 0.8/2.54, footer: 0.8/2.54 };"
);
fs.writeFileSync('export.js', e);