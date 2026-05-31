const fs = require('fs');
let e = fs.readFileSync('export.js', 'utf8');

e = e.replace(
  "Object.assign(ws.pageSetup, { paperSize: 1, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 });",
  "Object.assign(ws.pageSetup, { paperSize: 1, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1 });"
);

fs.writeFileSync('export.js', e);
console.log('Done');