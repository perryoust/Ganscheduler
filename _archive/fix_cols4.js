const fs = require('fs');
let e = fs.readFileSync('export.js', 'utf8');

e = e.replace(/const typeSum = ws\.addRow\(\[\סה"כ \$\{city\} - \$\{type\}: סה"כ  \$\{typeGroups\} קבוצות לתשלום \(לא כולל מבוטלים\)\, '', '', '', '', '', ''\]\);/g, 'const typeSum = ws.addRow([סה"כ  - : סה"כ   קבוצות לתשלום (לא כולל מבוטלים), "", "", "", "", "", "", ""]);');

fs.writeFileSync('export.js', e);
console.log('done');