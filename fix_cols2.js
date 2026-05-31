const fs = require('fs');
let e = fs.readFileSync('export.js', 'utf8');

// Update main title merge
e = e.replace(/ws\.mergeCells\(1, 1, 1, 7\);/g, "ws.mergeCells(1, 1, 1, 8);");

// Update section title merge
e = e.replace(/ws\.mergeCells\(ws\.lastRow\.number, 1, ws\.lastRow\.number, 7\);/g, "ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, 8);");

// Update typeSum merge
e = e.replace(/ws\.mergeCells\(typeSum\.number, 1, typeSum\.number, 7\);/g, "ws.mergeCells(typeSum.number, 1, typeSum.number, 8);");

// Update headers (base64 to avoid encoding issues)
const oldHead = Buffer.from('Y29uc3QgaGVhZFJvdyA9IHdzLmFkZFJvdyhbJ9Cq15DXqNeZ15onLCAn15LXny/XkSLeidC0JywgJ9ek16LXmdeo15XXqicsICfXqdec15QnLCAn16fXkdeV16bXldeXJywgJ9eh15jXmNdeV16gJywgJ9eU16LXqNeV16onXSk7', 'base64').toString('utf8');
const newHead = Buffer.from('Y29uc3QgaGVhZFJvdyA9IHdzLmFkZFJvdyhbJ9Cq15DXqNeZ15onLCAn15nXldedJywgJ9eS158v15Ei3onQtCcsICfXpNei15nXp9eV16onLCAn16nXnNeUJywgJ9en15HXldem15XXlycsICfXodeY15jXXldeoJywgJ9el16LXqNeV16onXSk7', 'base64').toString('utf8');
// Base64 decoded: const headRow = ws.addRow(['תאריך', 'יום', 'גן/בי"ס', 'פעילות', 'שעה', 'קבוצות', 'סטטוס', 'הערות']);
e = e.replace(oldHead, newHead);

// We'll also just replace the array directly if base64 doesn't match:
e = e.replace("const headRow = ws.addRow(['תאריך', 'גן/בי\"ס', 'פעילות', 'שעה', 'קבוצות', 'סטטוס', 'הערות']);", "const headRow = ws.addRow(['תאריך', 'יום', 'גן/בי\"ס', 'פעילות', 'שעה', 'קבוצות', 'סטטוס', 'הערות']);");

// Update data row
e = e.replace(
  "const formattedNote = typeof window.formatNoteWithTag === 'function' ? window.formatNoteWithTag(s) : (s.nt || '');\n              const row = ws.addRow([window.fD(s.d), g.name, s.act || window.supAct(s.a) || '', s.t, grpCount, displayStatus, formattedNote]);",
  "const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];\n              const dayStr = 'יום ' + dayNames[new Date(s.d).getDay()];\n              const formattedNote = typeof window.formatNoteWithTag === 'function' ? window.formatNoteWithTag(s) : (s.nt || '');\n              const row = ws.addRow([window.fD(s.d), dayStr, g.name, s.act || window.supAct(s.a) || '', s.t, grpCount, displayStatus, formattedNote]);"
);

// Update typeSum row which has 7 empty cells
e = e.replace(
  "const typeSum = ws.addRow([סה\"כ  - : סה\"כ   קבוצות לתשלום (לא כולל מבוטלים), '', '', '', '', '', '']);",
  "const typeSum = ws.addRow([סה\"כ  - : סה\"כ   קבוצות לתשלום (לא כולל מבוטלים), '', '', '', '', '', '', '']);"
);

fs.writeFileSync('export.js', e);
console.log('done');