const fs = require('fs');
let code = fs.readFileSync('invoices.js', 'utf8');
code = code.replace('supplierScore = 0;\\n          if (isGett && supplierScore === 0) supplierScore = 10;', 'supplierScore = 0;\n          if (isGett && supplierScore === 0) supplierScore = 10;');
fs.writeFileSync('invoices.js', code, 'utf8');
