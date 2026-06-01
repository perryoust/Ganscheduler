const fs = require('fs');
let code = fs.readFileSync('invoices.js', 'utf8');

code = code.replace(
  'window.spScannerFolderLinks[dirHandle.name] = baseUrl;\n            localStorage.setItem(\'spScannerFolderLinks\', JSON.stringify(window.spScannerFolderLinks));',
  'window.spScannerFolderLinks[dirHandle.name] = { sp: baseUrl, local: "" };\n            localStorage.setItem(\'spScannerFolderLinks\', JSON.stringify(window.spScannerFolderLinks));\n            if (typeof window.ghAutoSave === \'function\') window.ghAutoSave(true);'
);

fs.writeFileSync('invoices.js', code);
console.log('Done fixing save logic');