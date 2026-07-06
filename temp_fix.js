const fs = require('fs');
let code = fs.readFileSync('invoices.js', 'utf8');
code = code.replace(/sec==='order' && !\/\\d\/\.test\(docNum\)/g, "sec==='order' && !/\\d/.test(docNum) && !String(docNum).includes('קופה')");
fs.writeFileSync('invoices.js', code, 'utf8');
