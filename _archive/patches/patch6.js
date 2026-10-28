const fs = require('fs');
let data = fs.readFileSync('invoices.js', 'utf8');

data = data.replace(
    /!\['tax_receipt', 'receipt'\]\.includes\(inv\.status\)/g,
    "inv.status !== 'receipt'"
);

data = data.replace(
    /!\['tax_receipt', 'receipt'\]\.includes\(matchedInvoice\.status\)/g,
    "matchedInvoice.status !== 'receipt'"
);

fs.writeFileSync('invoices.js', data);
console.log('patched tx_invoice downgrade restriction for tax_receipt');
