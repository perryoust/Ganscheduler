const fs = require('fs');
let content = fs.readFileSync('invoices.js', 'utf8');

// 1. Fix the `potentialMatches` check
const oldCheck = `      const potentialMatches = window.INVOICES.filter(inv => 
        (inv.num && String(inv.num).trim() === numStr) ||
        (inv.txNum && String(inv.txNum).trim() === numStr) ||
        (inv.orderNum && String(inv.orderNum).trim() === numStr)
      );

      for (const inv of potentialMatches) {
        let type = null;
        if (inv.num && String(inv.num).trim() === numStr) type = 'tax';
        else if (inv.txNum && String(inv.txNum).trim() === numStr) type = 'tx';
        else if (inv.orderNum && String(inv.orderNum).trim() === numStr) type = 'order';`;

const newCheck = `      const cleanNumStr = numStr.replace(/\\D/g, '').replace(/^0+/, '');
      const potentialMatches = window.INVOICES.filter(inv => 
        (inv.num && String(inv.num).replace(/\\D/g, '').replace(/^0+/, '') === cleanNumStr) ||
        (inv.txNum && String(inv.txNum).replace(/\\D/g, '').replace(/^0+/, '') === cleanNumStr) ||
        (inv.orderNum && String(inv.orderNum).replace(/\\D/g, '').replace(/^0+/, '') === cleanNumStr)
      );

      for (const inv of potentialMatches) {
        let type = null;
        if (inv.num && String(inv.num).replace(/\\D/g, '').replace(/^0+/, '') === cleanNumStr) type = 'tax';
        else if (inv.txNum && String(inv.txNum).replace(/\\D/g, '').replace(/^0+/, '') === cleanNumStr) type = 'tx';
        else if (inv.orderNum && String(inv.orderNum).replace(/\\D/g, '').replace(/^0+/, '') === cleanNumStr) type = 'order';`;

content = content.replace(oldCheck, newCheck);

// 2. Fix bestScore and matchedInvoice negative threshold
content = content.replace('let bestScore = -1;', 'let bestScore = -1000;');
content = content.replace('let matchedInvoice = bestScore > 0 ? bestInvoice : null;', 'let matchedInvoice = bestScore > -500 ? bestInvoice : null;');
content = content.replace('let matchedInvoice = bestScore > -50 ? bestInvoice : null;', 'let matchedInvoice = bestScore > -500 ? bestInvoice : null;');
content = content.replace('let matchedType = bestScore > 0 ? bestType : null;', 'let matchedType = bestScore > -500 ? bestType : null;');
content = content.replace('let matchedType = bestScore > -50 ? bestType : null;', 'let matchedType = bestScore > -500 ? bestType : null;');

// 3. Inject the month/year fallback match right before the matchedInvoice evaluation
const endStr = '    let matchedInvoice = bestScore > -500 ? bestInvoice : null;';
const fallbackBlock = fs.readFileSync('scratch_scanner.js', 'utf8').match(/if \(bestScore < 0\) \{[\s\S]*?(?=    let matchedInvoice)/)[0];

const endIndex = content.indexOf(endStr);
if (endIndex !== -1) {
  content = content.slice(0, endIndex) + fallbackBlock + content.slice(endIndex);
} else {
  console.log('Failed to find endStr for fallback block');
}

fs.writeFileSync('invoices.js', content, 'utf8');
console.log('invoices.js patched successfully');
