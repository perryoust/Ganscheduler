const fs = require('fs');
let lines = fs.readFileSync('suppliers.js', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('summaryTitle: window._supExName ? ')) {
    lines[i] = '    summaryTitle: window._supExName ? ריכוז פעילות לספק:  (טווח:  - ) : ריכוז פעילות כל הספקים (טווח:  - )';
  }
}
fs.writeFileSync('suppliers.js', lines.join('\n'));
console.log('Fixed');