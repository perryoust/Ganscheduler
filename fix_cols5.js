const fs = require('fs');
let e = fs.readFileSync('export.js', 'utf8');

// Find the line that has "const typeSum = ws.addRow" and replace it
const lines = e.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const typeSum = ws.addRow([')) {
    // If it has 6 empty string comma separations, let's just make it 7.
    if(lines[i].match(/''/g) && lines[i].match(/''/g).length === 6) {
       lines[i] = lines[i].replace("'', ''", "'', '', ''");
    }
  }
}

fs.writeFileSync('export.js', lines.join('\n'));
console.log('done replacing typeSum');