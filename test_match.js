const inv = {
  supName: "עליזה קריבושי",
  orderDesc: "חוגים - גנים",
  date: "2/8/26",
  txNum: "40554",
  status: "tax_receipt"
};

const fileName = "עליזה קריבושי - חוגים - גנים - יוני 2026 - חשבון עסקה 40554.pdf";

const cleanNumStr = "40554";
let type = 'tax';

if (inv.num && String(inv.num).replace(/\D/g, '').replace(/^0+/, '') === cleanNumStr) {
  type = 'tax';
} else if (inv.txNum && String(inv.txNum).replace(/\D/g, '').replace(/^0+/, '') === cleanNumStr) {
  type = 'tx';
} else if (inv.orderNum && String(inv.orderNum).replace(/\D/g, '').replace(/^0+/, '') === cleanNumStr) {
  type = 'order';
}

console.log("type is", type);

// simulate what patch did:
if (fileName.includes('חשבונית מס')) {
  inv.status = 'tax_invoice';
} else if (fileName.includes('חשבון עסקה') && inv.status !== 'receipt') {
  inv.status = 'tx_invoice';
}

console.log("new status is", inv.status);
