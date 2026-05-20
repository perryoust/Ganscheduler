const fs = require('fs');
const content = fs.readFileSync('invoices.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('supEx')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
