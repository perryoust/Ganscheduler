const fs = require('fs');
let data = fs.readFileSync('invoices.js', 'utf8');

const migrationCode = `
  // Auto-fix statuses broken by the 0.00 bug
  if (Array.isArray(window.INVOICES)) {
    let fixedAny = false;
    const isValidStr = (val) => val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '-' && String(val).trim() !== '0' && String(val).trim() !== '0.0' && String(val).trim() !== '0.00';
    const isNonZeroRaw = (val) => isValidStr(val) && val !== 0;
    
    window.INVOICES.forEach(inv => {
      if (inv.status === 'tax_receipt' || inv.status === 'tax_invoice') {
        const hasTax = !!(isValidStr(inv.num) || isValidStr(inv.date) || isNonZeroRaw(inv.total) || isNonZeroRaw(inv.amt));
        const hasTx = !!(isValidStr(inv.txNum) || isValidStr(inv.txDate) || isNonZeroRaw(inv.txTotal) || isNonZeroRaw(inv.txAmt));
        if (!hasTax && hasTx) {
          inv.status = 'tx_invoice';
          fixedAny = true;
        }
      }
    });
    if (fixedAny && typeof window.saveInvoices === 'function') {
      window.saveInvoices(true); // save silently
    }
  }
`;

data = data.replace(
    /function renderInvoices\(\) \{/,
    "function renderInvoices() {\n" + migrationCode
);

fs.writeFileSync('invoices.js', data);
console.log('patched renderInvoices with migration code');
