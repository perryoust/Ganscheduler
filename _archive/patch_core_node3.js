const fs = require('fs');
let code = fs.readFileSync('invoices.js', 'utf8');

const anchor1 = "const filesFound = [];";
const p1 = code.indexOf(anchor1);
if (p1 === -1) { console.log('not found 1'); process.exit(1); }

let start = code.lastIndexOf('// ─── Step 4: Scan all selected folders', p1);
if (start === -1) {
    start = code.lastIndexOf('\n', p1);
}

const anchor2 = "window.openColFilter = function";
const p2 = code.indexOf(anchor2, p1);
if (p2 === -1) { console.log('not found 2'); process.exit(1); }

let end = code.lastIndexOf('\n};', p2);
if (end === -1) end = code.lastIndexOf('};', p2);

const coreLogic = code.substring(start, end).trim();

let newCode = code.substring(0, start) + '\n  await window._runCoreScanner(selectedFolders);\n}\n\nwindow._runCoreScanner = async function(selectedFolders) {\n' + coreLogic + '\n}\n\n' + code.substring(end + 2);

fs.writeFileSync('invoices.js', newCode);
console.log('Success extracting via Node.js');
