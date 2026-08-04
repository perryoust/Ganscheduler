const window = {
  INVOICES: [
    {
      id: 1,
      supName: "עליזה קריבושי",
      txNum: 40554,
      num: 40555, // The UI rendered 40555 with 📑, so it must be num!
      status: "tax_receipt"
    },
    {
      id: 2,
      supName: "חיים",
      txNum: 40198,
      num: 40199,
      status: "tax_receipt"
    }
  ]
};

let fixedAny = false;
const isValidStr = (val) => val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '-' && String(val).trim() !== '0' && String(val).trim() !== '0.0' && String(val).trim() !== '0.00';
const isNonZeroRaw = (val) => isValidStr(val) && val !== 0;

window.INVOICES.forEach(inv => {
  if (inv.status !== 'cancelled') {
    const hasTax = !!(isValidStr(inv.num) || isValidStr(inv.date) || isNonZeroRaw(inv.total) || isNonZeroRaw(inv.amt));
    const hasTx = !!(isValidStr(inv.txNum) || isValidStr(inv.txDate) || isNonZeroRaw(inv.txTotal) || isNonZeroRaw(inv.txAmt));
    if (!hasTax && hasTx) {
      if (inv.status !== 'tx_invoice') {
        inv.status = 'tx_invoice';
        fixedAny = true;
      }
    } else if (!hasTax && !hasTx) {
      if (inv.status !== 'order' && inv.status !== 'cancelled') {
        inv.status = 'order';
        fixedAny = true;
      }
    }
  }
});

console.log(window.INVOICES);
