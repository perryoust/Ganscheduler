const fs = require('fs');
let code = fs.readFileSync('invoices.js', 'utf8');
const oldLine = /const isInvPettyCash = .*?;/g;
const newLine = `const supKws = (window.supEx && window.supEx[inv.supName]) ? window.supEx[inv.supName].keywords || '' : ''; const isInvPettyCash = inv.orderNum === 'קופה קטנה' || String(inv.notes||'').includes('קופה קטנה') || String(inv.txNum||'').includes('קופה קטנה') || String(inv.orderDesc||'').includes('קופה קטנה') || String(inv.supName||'').includes('קופה קטנה') || String(supKws).includes('קופה קטנה');`;
code = code.replace(oldLine, newLine);
fs.writeFileSync('invoices.js', code, 'utf8');
