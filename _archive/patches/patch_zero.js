const fs = require('fs');
let data = fs.readFileSync('invoices.js', 'utf8');

const target = `        // Capture raw presence of tax/tx fields BEFORE numeric coercion turns empty cells into 0
        const _rawHasTax = !!(item.num || item.date ||
          (item.total !== undefined && item.total !== null && item.total !== '' && item.total !== 0) ||
          (item.amt !== undefined && item.amt !== null && item.amt !== '' && item.amt !== 0));
        const _rawHasTx = !!(item.txNum || item.txDate ||
          (item.txTotal !== undefined && item.txTotal !== null && item.txTotal !== '' && item.txTotal !== 0) ||
          (item.txAmt !== undefined && item.txAmt !== null && item.txAmt !== '' && item.txAmt !== 0));`;

const replacement = `        // Capture raw presence of tax/tx fields BEFORE numeric coercion turns empty cells into 0
        const isNonZeroRaw = (val) => val !== undefined && val !== null && val !== '' && val !== 0 && String(val).trim() !== '0' && String(val).trim() !== '0.0' && String(val).trim() !== '0.00';
        const _rawHasTax = !!(item.num || item.date || isNonZeroRaw(item.total) || isNonZeroRaw(item.amt));
        const _rawHasTx = !!(item.txNum || item.txDate || isNonZeroRaw(item.txTotal) || isNonZeroRaw(item.txAmt));`;

data = data.replace(target, replacement);
fs.writeFileSync('invoices.js', data);
console.log('patched');
