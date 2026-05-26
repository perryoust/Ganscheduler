const fs = require('fs');
let code = fs.readFileSync('invoices.js', 'utf8');

const hasCRLF = code.includes('\r\n');
if (hasCRLF) {
  code = code.replace(/\r\n/g, '\n');
}

const target = `  const numEl = document.getElementById('inv-num');
  if(numEl) numEl.placeholder = isExempt ? "מס' קבלה" : "מס' חשבונית מס";
}`;

const replacement = `  const numEl = document.getElementById('inv-num');
  if(numEl) numEl.placeholder = isExempt ? "מס' קבלה" : "מס' חשבונית מס";
  if(typeof onVatChange === 'function') onVatChange();
}`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  if (hasCRLF) {
    code = code.replace(/\n/g, '\r\n');
  }
  fs.writeFileSync('invoices.js', code, 'utf8');
  console.log('Successfully updated invoices.js to trigger onVatChange');
} else {
  console.log('Target content not found in invoices.js');
}
