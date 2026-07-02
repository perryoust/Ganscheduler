const fs = require('fs');
let content = fs.readFileSync('invoices.js', 'utf8');
content = content.replace(/"מס\\\"ד": "serialNum",\s*"מסד": "serialNum"/g, '"מס\\\"ד": "serialNum", "מס\'\'ד": "serialNum", "מס\'ד": "serialNum", "מס׳׳ד": "serialNum", "מסד": "serialNum"');
fs.writeFileSync('invoices.js', content, 'utf8');
