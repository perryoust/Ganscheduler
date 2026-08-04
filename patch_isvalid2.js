const fs = require('fs');
let data = fs.readFileSync('invoices.js', 'utf8');

const regex = /let status = 'order';\s*const hasTaxDetails = !!\(isValidStr/;

if (regex.test(data)) {
  data = data.replace(regex, "const isValidStr = (val) => val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '-' && String(val).trim() !== '0' && String(val).trim() !== '0.0' && String(val).trim() !== '0.00';\n        const isNonZeroRaw = (val) => isValidStr(val) && val !== 0;\n        let status = 'order';\n        const hasTaxDetails = !!(isValidStr");
  fs.writeFileSync('invoices.js', data);
  console.log('patched');
} else {
  console.log('not found');
}
