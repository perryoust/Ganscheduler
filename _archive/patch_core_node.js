const fs = require('fs');
let code = fs.readFileSync('invoices.js', 'utf8');

const anchor1 = "const filesFound = [];";
const p1 = code.indexOf(anchor1);
if (p1 === -1) { console.log('not found 1'); process.exit(1); }

// Find the line start of const filesFound = [];
let start = code.lastIndexOf('\n', p1);
// Wait, we also want to capture the scanDir function. We can just capture from here onwards.
// But we actually need selectedFolders to be passed in.

const anchor2 = "window.parseSharePointBaseUrl =";
const p2 = code.indexOf(anchor2, p1);
if (p2 === -1) { console.log('not found 2'); process.exit(1); }

// Find the end of startSharePointScanner
let end = code.lastIndexOf('\n}', p2);
if (end === -1) {
    // try just }
    end = code.lastIndexOf('}', p2);
}

const coreLogic = code.substring(start, end).trim();

// Now we replace this coreLogic in the original code
let newCode = code.substring(0, start) + \n  await window._runCoreScanner(selectedFolders);\n}\n\nwindow._runCoreScanner = async function(selectedFolders) {\n + coreLogic + \n}\n + code.substring(end + 1);

fs.writeFileSync('invoices.js', newCode);
console.log('Success extracting via Node.js');
