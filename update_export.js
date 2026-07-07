const fs = require('fs');
let c = fs.readFileSync('export_v107.js', 'utf8');

// I need to change:
// const isSupplierExport = opts.type === 'supplier';
// to:
// const isSupplierExport = opts.type === 'supplier' || opts.type === 'supplier_placement';
// const isPlacement = opts.type === 'supplier_placement';

c = c.replace(
  "const isSupplierExport = opts.type === 'supplier';",
  "const isSupplierExport = opts.type === 'supplier' || opts.type === 'supplier_placement';\n      const isPlacement = opts.type === 'supplier_placement';"
);

c = c.replace(
  "const titleRow = ws.addRow([`${window._supExName || 'כל הספקים'} - ${city} - ${type}`]);",
  "const actualName = opts.title && opts.title.includes('דו\"ח שיבוץ לספק - ') ? opts.title.split('-')[1].split('(טווח')[0].trim() : (window._supExName || 'כל הספקים');\n            const titleRow = ws.addRow([`${actualName} - ${city} - ${type}`]);"
);

c = c.replace(
  "const headRow = ws.addRow(['תאריך', 'יום', 'גן/בי\"ס', 'שם ספק החוגים', 'פעילות', 'שעה', 'קבוצות', 'סטטוס', 'הערות']);",
  "const headRow = isPlacement ? ws.addRow(['רחוב', 'גן/בי\"ס', 'תאריך', 'יום', 'שעה', 'קבוצות', 'סטטוס', 'הערות']) : ws.addRow(['תאריך', 'יום', 'גן/בי\"ס', 'שם ספק החוגים', 'פעילות', 'שעה', 'קבוצות', 'סטטוס', 'הערות']);"
);

c = c.replace(
  "const row = ws.addRow([window.fD(s.d), dayStr, g.name, window.supBase ? window.supBase(s.a) : s.a, s.act || window.supAct(s.a) || '', s.t, grpCount, displayStatus, formattedNote]);",
  "const row = isPlacement ? ws.addRow([g.addr || '', g.name, window.fD(s.d), dayStr, s.t, grpCount, displayStatus, formattedNote]) : ws.addRow([window.fD(s.d), dayStr, g.name, window.supBase ? window.supBase(s.a) : s.a, s.act || window.supAct(s.a) || '', s.t, grpCount, displayStatus, formattedNote]);"
);

c = c.replace(
  "const totalRow = ws.addRow(['₪ סה\"כ קבוצות לתשלום (כללי)', '', typeGlobalGroups]);",
  "const totalRow = isPlacement ? ws.addRow(['סה\"כ קבוצות בדו\"ח', typeGlobalGroups]) : ws.addRow(['₪ סה\"כ קבוצות לתשלום (כללי)', '', typeGlobalGroups]);"
);

// We also need to fix `summaryRows.forEach` to output two columns if isPlacement.
c = c.replace(
  "const row = ws.addRow([sr.label, `בוצעו ${sr.grp} פעילויות`, '']);",
  "const row = isPlacement ? ws.addRow([sr.label, `${sr.grp} פעילויות`]) : ws.addRow([sr.label, `בוצעו ${sr.grp} פעילויות`, '']);"
);

// And we merge 8 cells instead of 9 for placement:
c = c.replace(
  "ws.mergeCells(1, 1, 1, 8);",
  "ws.mergeCells(1, 1, 1, isPlacement ? 8 : 9);"
);

c = c.replace(
  "ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, 9);",
  "ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, isPlacement ? 8 : 9);"
);

c = c.replace(
  "const typeSum = ws.addRow([`📌 ${city} - ${type}: בוצעו ${typeGroups} פעילויות (כולל השלמות)`, '', '', '', '', '', '', '', '']);",
  "const typeSum = isPlacement ? ws.addRow([`📌 ${city} - ${type}: בוצעו ${typeGroups} פעילויות (כולל השלמות)`, '', '', '', '', '', '', '']) : ws.addRow([`📌 ${city} - ${type}: בוצעו ${typeGroups} פעילויות (כולל השלמות)`, '', '', '', '', '', '', '', '']);"
);

c = c.replace(
  "const sumHead = ws.addRow([finalTitleStr, '', '', '', '', '', '', '', '']);",
  "const sumHead = isPlacement ? ws.addRow([finalTitleStr, '', '', '', '', '', '', '']) : ws.addRow([finalTitleStr, '', '', '', '', '', '', '', '']);"
);

c = c.replace(
  "ws.mergeCells(sumHead.number, 1, sumHead.number, 9);",
  "ws.mergeCells(sumHead.number, 1, sumHead.number, isPlacement ? 8 : 9);"
);

fs.writeFileSync('export_v107.js', c);
