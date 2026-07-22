const fs = require('fs');
let c = fs.readFileSync('core.js', 'utf8');
c = c.replace(/const exIsAct = supEx\[name\]\?\.isAct;[\s\S]*?const isPurch = exIsPurch===true \|\| hasInvoices \|\| \(exIsPurch===undefined && !hasSchEntries\);/, 'const isAct = isActSupplier(name);\n    const isPurch = isPurchSupplier(name);');
fs.writeFileSync('core.js', c);