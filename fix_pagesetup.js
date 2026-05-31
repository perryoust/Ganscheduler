const fs = require('fs');
let e = fs.readFileSync('export.js', 'utf8');

e = e.replace(
  "ws.pageSetup.margins = { left: 0.3/2.54, right: 0.3/2.54, top: 0.4/2.54, bottom: 0.4/2.54, header: 0.8/2.54, footer: 0.8/2.54 };",
  "ws.pageSetup.margins = { left: 0.3/2.54, right: 0.3/2.54, top: 0.4/2.54, bottom: 0.4/2.54, header: 0.8/2.54, footer: 0.8/2.54 };\n        Object.assign(ws.pageSetup, { paperSize: 1, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 });"
);

fs.writeFileSync('export.js', e);
console.log('Done');