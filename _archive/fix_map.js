const fs = require('fs');
let code = fs.readFileSync('invoices.js', 'utf8');
code = code.replace('"מס\\"ד": "serialNum",\n        "מסד": "serialNum"', '"מס\\"ד": "serialNum",\n        "מס\'ד": "serialNum",\n        "מס׳ד": "serialNum",\n        "מסד": "serialNum"');
fs.writeFileSync('invoices.js', code);
