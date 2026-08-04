const fs = require('fs');
let data = fs.readFileSync('invoices.js', 'utf8');

const target2790 = `        // Auto-infer invoice status (use pre-coercion flags to avoid 0-amount false negatives)
        let status = 'order';
        const hasTaxDetails = _rawHasTax || !!(item.num || item.date || item.total > 0 || item.amt > 0);
        const hasTxDetails  = _rawHasTx  || !!(item.txNum || item.txDate || item.txTotal > 0 || item.txAmt > 0);`;

const replacement2790 = `        // Auto-infer invoice status (use pre-coercion flags to avoid 0-amount false negatives)
        let status = 'order';
        const isValidStr = (val) => val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '-' && String(val).trim() !== '0' && String(val).trim() !== '0.0' && String(val).trim() !== '0.00';
        const hasTaxDetails = _rawHasTax || !!(isValidStr(item.num) || isValidStr(item.date) || item.total > 0 || item.amt > 0);
        const hasTxDetails  = _rawHasTx  || !!(isValidStr(item.txNum) || isValidStr(item.txDate) || item.txTotal > 0 || item.txAmt > 0);`;

data = data.replace(target2790, replacement2790);

const target2702 = `        const _rawHasTax = !!(item.num || item.date || isNonZeroRaw(item.total) || isNonZeroRaw(item.amt));
        const _rawHasTx = !!(item.txNum || item.txDate || isNonZeroRaw(item.txTotal) || isNonZeroRaw(item.txAmt));`;

const replacement2702 = `        const _rawHasTax = !!(isValidStr(item.num) || isValidStr(item.date) || isNonZeroRaw(item.total) || isNonZeroRaw(item.amt));
        const _rawHasTx = !!(isValidStr(item.txNum) || isValidStr(item.txDate) || isNonZeroRaw(item.txTotal) || isNonZeroRaw(item.txAmt));`;

// we must define isValidStr earlier too
const target2700 = `        // Capture raw presence of tax/tx fields BEFORE numeric coercion turns empty cells into 0
        const isNonZeroRaw = (val) => val !== undefined && val !== null && val !== '' && val !== 0 && String(val).trim() !== '0' && String(val).trim() !== '0.0' && String(val).trim() !== '0.00';`;

const replacement2700 = `        // Capture raw presence of tax/tx fields BEFORE numeric coercion turns empty cells into 0
        const isValidStr = (val) => val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '-' && String(val).trim() !== '0' && String(val).trim() !== '0.0' && String(val).trim() !== '0.00';
        const isNonZeroRaw = (val) => isValidStr(val) && val !== 0;`;

data = data.replace(target2700, replacement2700);
data = data.replace(target2702, replacement2702);

fs.writeFileSync('invoices.js', data);
console.log('patched');
