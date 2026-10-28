const fs = require('fs');
let data = fs.readFileSync('invoices.js', 'utf8');

data = data.replace(
    /!\['tax_invoice', 'tax_receipt', 'receipt'\]\.includes\(inv\.status\)/g,
    "!['tax_receipt', 'receipt'].includes(inv.status)"
);

data = data.replace(
    /!\['tax_invoice', 'tax_receipt', 'receipt'\]\.includes\(matchedInvoice\.status\)/g,
    "!['tax_receipt', 'receipt'].includes(matchedInvoice.status)"
);

fs.writeFileSync('invoices.js', data);
console.log('patched tx_invoice downgrade restriction');
