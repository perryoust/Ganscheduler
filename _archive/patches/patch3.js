const fs = require('fs');
let data = fs.readFileSync('invoices.js', 'utf8');

// 1. Fix the `hasTaxDetails` and `hasTxDetails` lines which failed to replace earlier
const target2790 = `        // Auto-infer invoice status (use pre-coercion flags to avoid 0-amount false negatives)
        let status = 'order';
        const hasTaxDetails = _rawHasTax || !!(item.num || item.date || item.total > 0 || item.amt > 0);
        const hasTxDetails  = _rawHasTx  || !!(item.txNum || item.txDate || item.txTotal > 0 || item.txAmt > 0);`;

const replacement2790 = `        // Auto-infer invoice status (use pre-coercion flags to avoid 0-amount false negatives)
        let status = 'order';
        const hasTaxDetails = _rawHasTax || !!(isValidStr(item.num) || isValidStr(item.date) || item.total > 0 || item.amt > 0);
        const hasTxDetails  = _rawHasTx  || !!(isValidStr(item.txNum) || isValidStr(item.txDate) || item.txTotal > 0 || item.txAmt > 0);`;

if (data.includes(target2790)) {
    data = data.replace(target2790, replacement2790);
    console.log('Fixed hasTaxDetails');
} else {
    console.log('Could not find hasTaxDetails target block exactly!');
}

// 2. Add filename logic in pullGdriveInvoices
const targetMatchLogic = `          matchedInvoice.forEach(inv => {
           if (!inv['file_' + matchedType] || globalOverwrite) {
              inv['file_' + matchedType] = { path: file.link, origin: 'sp' };
             matchCount++;
             linkedLines++;
           }
         });`;

const replacementMatchLogic = `          matchedInvoice.forEach(inv => {
           if (!inv['file_' + matchedType] || globalOverwrite) {
              inv['file_' + matchedType] = { path: file.link, origin: 'sp' };
              // --- Update status based on filename ---
              const fName = String(file.name || '');
              if (fName.includes('חשבונית מס')) {
                  inv.status = 'tax_invoice';
              } else if (fName.includes('חשבון עסקה') && !['tax_invoice', 'tax_receipt', 'receipt'].includes(inv.status)) {
                  inv.status = 'tx_invoice';
              } else if (fName.includes('הזמנה') && inv.status === 'order') {
                  // Keep as order
              }
              // ---------------------------------------
             matchCount++;
             linkedLines++;
           }
         });`;

if (data.includes(targetMatchLogic)) {
    data = data.replace(targetMatchLogic, replacementMatchLogic);
    console.log('Patched multi-match logic');
}

const targetSingleMatchLogic = `           if (!matchedInvoice['file_' + matchedType] || globalOverwrite) {
              matchedInvoice['file_' + matchedType] = { path: file.link, origin: 'sp' };
             resultsData.push([file.name, \`\${matchedInvoice.orderDesc || matchedInvoice.supName} (\${matchedType})\`, bestScore, 'שויך']);
             matchCount++;
           }`;

const replacementSingleMatchLogic = `           if (!matchedInvoice['file_' + matchedType] || globalOverwrite) {
              matchedInvoice['file_' + matchedType] = { path: file.link, origin: 'sp' };
              // --- Update status based on filename ---
              const fName = String(file.name || '');
              if (fName.includes('חשבונית מס')) {
                  matchedInvoice.status = 'tax_invoice';
              } else if (fName.includes('חשבון עסקה') && !['tax_invoice', 'tax_receipt', 'receipt'].includes(matchedInvoice.status)) {
                  matchedInvoice.status = 'tx_invoice';
              }
              // ---------------------------------------
             resultsData.push([file.name, \`\${matchedInvoice.orderDesc || matchedInvoice.supName} (\${matchedType})\`, bestScore, 'שויך']);
             matchCount++;
           }`;

if (data.includes(targetSingleMatchLogic)) {
    data = data.replace(targetSingleMatchLogic, replacementSingleMatchLogic);
    console.log('Patched single-match logic');
}

fs.writeFileSync('invoices.js', data);
