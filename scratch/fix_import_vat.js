const fs = require('fs');
let code = fs.readFileSync('invoices.js', 'utf8');

// Normalize line endings to LF for matching, then replace, then restore CRLF if needed
const hasCRLF = code.includes('\r\n');
if (hasCRLF) {
  code = code.replace(/\r\n/g, '\n');
}

const target = `    // Assign fresh ID
    inv.id = Date.now() + added + Math.floor(Math.random()*1000);
    inv.recv = inv.recv || new Date().toISOString().slice(0,10);
    newInvoices.push(inv);
    existingOrderNums.add(inv.orderNum||'');
    added++;`;

const replacement = `    // Assign fresh ID
    inv.id = Date.now() + added + Math.floor(Math.random()*1000);
    inv.recv = inv.recv || new Date().toISOString().slice(0,10);

    // Auto-fix/recalculate VAT for imported invoice based on supplier entity type
    const vat = inv.vat || window.VAT_RATE || 17;
    const supName = inv.supName || '';
    const et = (window.supEx && window.supEx[supName]) ? window.supEx[supName].entityType : '';
    const isExempt = et==='עוסק פטור' || et==='עמותה';
    const effectiveVat = isExempt ? 0 : vat;
    inv.vat = effectiveVat;

    if (inv.orderTotal) {
      inv.orderAmt = +(inv.orderTotal / (1 + effectiveVat/100)).toFixed(2);
      inv.orderVat = +(inv.orderTotal - inv.orderAmt).toFixed(2);
    }
    if (inv.txTotal) {
      inv.txAmt = +(inv.txTotal / (1 + effectiveVat/100)).toFixed(2);
      inv.txVat = +(inv.txTotal - inv.txAmt).toFixed(2);
    }
    if (inv.total) {
      inv.amt = +(inv.total / (1 + effectiveVat/100)).toFixed(2);
      inv.vatAmt = +(inv.total - inv.amt).toFixed(2);
    }

    newInvoices.push(inv);
    existingOrderNums.add(inv.orderNum||'');
    added++;`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  if (hasCRLF) {
    code = code.replace(/\n/g, '\r\n');
  }
  fs.writeFileSync('invoices.js', code, 'utf8');
  console.log('Successfully updated invoices.js');
} else {
  console.log('Target content not found in normalized invoices.js');
}
