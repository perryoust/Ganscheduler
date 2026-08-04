const fs = require('fs');
let data = fs.readFileSync('invoices.js', 'utf8');

data = data.replace(
    /const hasTaxDetails = _rawHasTax \|\| !!\(item\.num \|\| item\.date \|\| item\.total > 0 \|\| item\.amt > 0\);/g,
    "const hasTaxDetails = _rawHasTax || !!(isValidStr(item.num) || isValidStr(item.date) || item.total > 0 || item.amt > 0);"
);

data = data.replace(
    /const hasTxDetails  = _rawHasTx  \|\| !!\(item\.txNum \|\| item\.txDate \|\| item\.txTotal > 0 \|\| item\.txAmt > 0\);/g,
    "const hasTxDetails  = _rawHasTx  || !!(isValidStr(item.txNum) || isValidStr(item.txDate) || item.txTotal > 0 || item.txAmt > 0);"
);

data = data.replace(
    /inv\['file_' \+ matchedType\] = \{ path: file\.link, origin: 'sp' \};\s*matchCount\+\+;/g,
    "inv['file_' + matchedType] = { path: file.link, origin: 'sp' };\n" +
    "              const fName = String(file.name || '');\n" +
    "              if (fName.includes('חשבונית מס')) {\n" +
    "                  inv.status = 'tax_invoice';\n" +
    "              } else if (fName.includes('חשבון עסקה') && !['tax_invoice', 'tax_receipt', 'receipt'].includes(inv.status)) {\n" +
    "                  inv.status = 'tx_invoice';\n" +
    "              }\n" +
    "             matchCount++;"
);

data = data.replace(
    /matchedInvoice\['file_' \+ matchedType\] = \{ path: file\.link, origin: 'sp' \};\s*resultsData\.push/g,
    "matchedInvoice['file_' + matchedType] = { path: file.link, origin: 'sp' };\n" +
    "              const fName = String(file.name || '');\n" +
    "              if (fName.includes('חשבונית מס')) {\n" +
    "                  matchedInvoice.status = 'tax_invoice';\n" +
    "              } else if (fName.includes('חשבון עסקה') && !['tax_invoice', 'tax_receipt', 'receipt'].includes(matchedInvoice.status)) {\n" +
    "                  matchedInvoice.status = 'tx_invoice';\n" +
    "              }\n" +
    "             resultsData.push"
);

fs.writeFileSync('invoices.js', data);
console.log('regex patch applied');
