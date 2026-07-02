const fs = require('fs');
let code = fs.readFileSync('invoices.js', 'utf8');
code = code.replace(/window\.VAT_RATE \|\| 17/g, 'window.VAT_RATE || 18');
code = code.replace(/\? getVatRate\(\) : 17/g, '? getVatRate() : 18');
fs.writeFileSync('invoices.js', code);
