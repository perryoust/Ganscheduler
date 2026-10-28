const fs = require('fs');
let data = fs.readFileSync('invoices.js', 'utf8');

data = data.replace(
  /if \(\!hasTax && hasTx\) \{[\s\S]*?fixedAny = true;\n\s*\}/,
  `if (!hasTax && hasTx) {
          if (inv.status !== 'tx_invoice') {
            inv.status = 'tx_invoice';
            fixedAny = true;
          }
        } else if (!hasTax && !hasTx) {
          if (inv.status !== 'order' && inv.status !== 'cancelled') {
            inv.status = 'order';
            fixedAny = true;
          }
        }`
);

// also we need to allow the migration to run on ALL statuses, not just tax_receipt / tax_invoice
data = data.replace(
  /if \(inv\.status === 'tax_receipt' \|\| inv\.status === 'tax_invoice'\) \{/g,
  `if (inv.status !== 'cancelled') {`
);

fs.writeFileSync('invoices.js', data);
console.log('patched migration code to handle orders');
