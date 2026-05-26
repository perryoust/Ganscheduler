const fs = require('fs');
let code = fs.readFileSync('invoices.js', 'utf8');

const target1 = `        const sName = String(item.supName || "").trim().replace(/[.$#[\\]/]/g, '');
        item.supName = sName;
        const oDesc = String(item.orderDesc || "").trim();`;

const replacement1 = `        const sName = String(item.supName || "").trim().replace(/[.$#[\\]/]/g, '');
        item.supName = sName;
        
        // Auto-compute base amounts (orderAmt, txAmt, amt) from totals if they are missing
        const vatRate = typeof window !== 'undefined' && window.VAT_RATE !== undefined ? window.VAT_RATE : 17;
        const et = (typeof window !== 'undefined' && window.supEx && window.supEx[sName]) ? window.supEx[sName].entityType : '';
        const isExempt = et==='עוסק פטור' || et==='עמותה';
        const effectiveVat = isExempt ? 0 : vatRate;
        
        if (item.orderTotal && !item.orderAmt) item.orderAmt = +(item.orderTotal / (1+effectiveVat/100)).toFixed(2);
        if (item.txTotal && !item.txAmt) item.txAmt = +(item.txTotal / (1+effectiveVat/100)).toFixed(2);
        if (item.total && !item.amt) item.amt = +(item.total / (1+effectiveVat/100)).toFixed(2);

        const oDesc = String(item.orderDesc || "").trim();`;

code = code.replace(target1, replacement1);

if (!code.includes('autoFixInvoicesVAT')) {
  code += `\nwindow.autoFixInvoicesVAT = async function() {
  let fixed = 0;
  window.INVOICES.forEach(inv => {
    const vat = inv.vat || window.VAT_RATE || 17;
    const supName = inv.supName || '';
    const et = (window.supEx && window.supEx[supName]) ? window.supEx[supName].entityType : '';
    const isExempt = et==='עוסק פטור' || et==='עמותה';
    const effectiveVat = isExempt ? 0 : vat;

    let changed = false;
    if (inv.orderTotal) {
      const expectedAmt = +(inv.orderTotal / (1 + effectiveVat/100)).toFixed(2);
      if (!inv.orderAmt || Math.abs(inv.orderAmt - expectedAmt) > 0.05) {
        inv.orderAmt = expectedAmt;
        changed = true;
      }
    }
    if (inv.txTotal) {
      const expectedAmt = +(inv.txTotal / (1 + effectiveVat/100)).toFixed(2);
      if (!inv.txAmt || Math.abs(inv.txAmt - expectedAmt) > 0.05) {
        inv.txAmt = expectedAmt;
        changed = true;
      }
    }
    if (inv.total) {
      const expectedAmt = +(inv.total / (1 + effectiveVat/100)).toFixed(2);
      if (!inv.amt || Math.abs(inv.amt - expectedAmt) > 0.05) {
        inv.amt = expectedAmt;
        changed = true;
      }
    }
    if (changed) fixed++;
  });

  if (fixed > 0) {
    console.log("Fixed VAT for " + fixed + " invoices.");
    if (typeof window.save === 'function') window.save(true);
    if(window.renderInvoices) window.renderInvoices();
    if(window.refreshPurchDash) window.refreshPurchDash();
    alert('תוקנו סכומים של ' + fixed + ' חשבוניות לפי המע"מ הנכון!');
  } else {
    alert('לא נמצאו חשבוניות הדורשות תיקון סכומים.');
  }
};\n`;
}

fs.writeFileSync('invoices.js', code, 'utf8');
console.log('Injected replacements');
