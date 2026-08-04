const fs = require('fs');
let data = fs.readFileSync('invoices.js', 'utf8');

const targetStr = `        // Auto-infer invoice status (use pre-coercion flags to avoid 0-amount false negatives)
        let status = 'order';
        const hasTaxDetails = !!(isValidStr(item.num) || isValidStr(item.date) || isNonZeroRaw(item.total) || isNonZeroRaw(item.amt));
        const hasTxDetails  = !!(isValidStr(item.txNum) || isValidStr(item.txDate) || isNonZeroRaw(item.txTotal) || isNonZeroRaw(item.txAmt));`;

const replacement = `        // Auto-infer invoice status (use pre-coercion flags to avoid 0-amount false negatives)
        const isValidStr = (val) => val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '-' && String(val).trim() !== '0' && String(val).trim() !== '0.0' && String(val).trim() !== '0.00';
        const isNonZeroRaw = (val) => isValidStr(val) && val !== 0;
        let status = 'order';
        const hasTaxDetails = !!(isValidStr(item.num) || isValidStr(item.date) || isNonZeroRaw(item.total) || isNonZeroRaw(item.amt));
        const hasTxDetails  = !!(isValidStr(item.txNum) || isValidStr(item.txDate) || isNonZeroRaw(item.txTotal) || isNonZeroRaw(item.txAmt));`;

data = data.replace(targetStr, replacement);
fs.writeFileSync('invoices.js', data);
console.log('patched');
