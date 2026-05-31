const fs = require('fs');
let e = fs.readFileSync('export.js', 'utf8');

// The headers in Hebrew encoded as utf8
const oldHeaders = "['תאריך', 'גן/בי\"ס', 'פעילות', 'שעה', 'קבוצות', 'סטטוס', 'הערות']";
const newHeaders = "['תאריך', 'יום', 'גן/בי\"ס', 'פעילות', 'שעה', 'קבוצות', 'סטטוס', 'הערות']";

// Fix mergeCells from 7 to 8 for the title row
e = e.replace("ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, 7);", "ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, 8);");

// Fix headers
e = e.replace("const headRow = ws.addRow(['תאריך', 'גן/בי\"ס', 'פעילות', 'שעה', 'קבוצות', 'סטטוס', 'הערות']);", "const headRow = ws.addRow(['תאריך', 'יום', 'גן/בי\"ס', 'פעילות', 'שעה', 'קבוצות', 'סטטוס', 'הערות']);");
// Wait, the file might use a slightly different string for headers. Let's do it with regex or careful replace.
// Let's use base64 for old and new strings just to be sure we match.