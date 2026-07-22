const fs = require('fs');

let s = fs.readFileSync('suppliers.js', 'utf8');
s = s.replace(
  "    title: title\n  });", 
  "    title: title,\n    summaryTitle: window._supExName ? \ריכוז פעילות לספק: \ (טווח: \ - \)\ : \ריכוז פעילות כל הספקים (טווח: \ - \)\\n  });"
);
fs.writeFileSync('suppliers.js', s);

let e = fs.readFileSync('export.js', 'utf8');
e = e.replace(
  "const sumHead = ws.addRow(['📊 ריכוז פעילות סופי', '', '']);",
  "const summaryTitleStr = opts.summaryTitle || '📊 ריכוז פעילות סופי';\n        const sumHead = ws.addRow([summaryTitleStr, '', '']);"
);
e = e.replace(
  "const totalRow = ws.addRow(['💰 סה\"כ קבוצות לתשלום (כללי)', '', totalGroups]);",
  "const totalRow = ws.addRow(['₪ סה\"כ קבוצות לתשלום (כללי)', '', totalGroups]);"
);
fs.writeFileSync('export.js', e);