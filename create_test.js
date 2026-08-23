const fs = require('fs');
let code = fs.readFileSync('scanner_worker.js', 'utf8');

code = code.replace(/self\.onmessage\s*=\s*async\s*function\(e\)\s*\{/, 'async function runScanner(e) {');
code = code + '\n\n' + `
const invoices = [
  { id: 2074, num: '0253702035989', supName: 'אלה זינו' },
  { id: 2014, num: '001', supName: 'אמנות' }
];
const filesFound = [
  { name: 'אלה זינו חשבונית 0253702035989 28 07 2026.pdf', link: 'test_link_1' },
  { name: 'אמנות 001.pdf', link: 'test_link_2' }
];

const mockEvent = {
  data: {
    type: 'start',
    invoices: invoices,
    filesFound: filesFound,
    supEx: {},
    spScannerAliases: {}
  }
};

self = {
  postMessage: function(msg) {
    console.log('Worker sent:', JSON.stringify(msg, null, 2));
  }
};

runScanner(mockEvent);
`;

fs.writeFileSync('test_scanner.js', code);
