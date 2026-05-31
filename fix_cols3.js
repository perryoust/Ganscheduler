const fs = require('fs');
let e = fs.readFileSync('export.js', 'utf8');

// The typeSum row has 7 items total, we need 8 items
e = e.replace(/ws\.addRow\(\[\סה"כ \$\{city\} - \$\{type\}: סה"כ  \$\{typeGroups\} קבוצות לתשלום \(לא כולל מבוטלים\)\, '', '', '', '', '', ''\]\);/g, 'ws.addRow([סה"כ  - : סה"כ   קבוצות לתשלום (לא כולל מבוטלים), "", "", "", "", "", "", ""]);');

// The data row
e = e.replace(/const row = ws\.addRow\(\[window\.fD\(s\.d\), g\.name, s\.act \|\| window\.supAct\(s\.a\) \|\| '', s\.t, grpCount, displayStatus, formattedNote\]\);/g, "const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];\n              const dayStr = 'יום ' + dayNames[new Date(s.d).getDay()];\n              const row = ws.addRow([window.fD(s.d), dayStr, g.name, s.act || window.supAct(s.a) || '', s.t, grpCount, displayStatus, formattedNote]);");

fs.writeFileSync('export.js', e);
console.log('done');