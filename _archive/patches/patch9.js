const fs = require('fs');
let data = fs.readFileSync('invoices.js', 'utf8');

data = data.replace(
  /const hasTaxDetails = _rawHasTax \|\| !!\(isValidStr\(item\.num\) \|\| isValidStr\(item\.date\) \|\| item\.total > 0 \|\| item\.amt > 0\);/g,
  "const hasTaxDetails = !!(isValidStr(item.num) || isValidStr(item.date) || isNonZeroRaw(item.total) || isNonZeroRaw(item.amt));"
);

data = data.replace(
  /const hasTxDetails\s*=\s*_rawHasTx\s*\|\|\s*!!\(isValidStr\(item\.txNum\) \|\| isValidStr\(item\.txDate\) \|\| item\.txTotal > 0 \|\| item\.txAmt > 0\);/g,
  "const hasTxDetails  = !!(isValidStr(item.txNum) || isValidStr(item.txDate) || isNonZeroRaw(item.txTotal) || isNonZeroRaw(item.txAmt));"
);

// We also need to add isNonZeroRaw helper right before it, if it's not there. But it's not there!
// Let's replace the block with the helper included.
const replacement = `
        const isValidStr = (val) => val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '-' && String(val).trim() !== '0' && String(val).trim() !== '0.0' && String(val).trim() !== '0.00';
        const isNonZeroRaw = (val) => isValidStr(val) && val !== 0;

        const hasTaxDetails = !!(isValidStr(item.num) || isValidStr(item.date) || isNonZeroRaw(item.total) || isNonZeroRaw(item.amt));
        const hasTxDetails  = !!(isValidStr(item.txNum) || isValidStr(item.txDate) || isNonZeroRaw(item.txTotal) || isNonZeroRaw(item.txAmt));
`;

data = data.replace(
  /const hasTaxDetails = _rawHasTax[\s\S]*?item\.txAmt > 0\);/,
  replacement.trim()
);

fs.writeFileSync('invoices.js', data);
console.log('patched importInvoices logic');
