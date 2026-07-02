const fs = require('fs');
let lines = fs.readFileSync('invoices.js', 'utf8').split('\n');
let newLines = [];
let foundStart = false;
let foundEnd = false;

for (let i=0; i<lines.length; i++) {
  let line = lines[i];
  if (!foundStart && line.includes('// Reset for next run')) {
    newLines.push(line);
    // skip the next line if it is /*
    if (i+1 < lines.length && lines[i+1].trim() === '/*') {
      i++;
    }
    foundStart = true;
    continue;
  }
  
  if (foundStart && !foundEnd && line.trim() === '*/') {
    // Check if the previous lines were the end of the dialog
    if (lines[i-1].includes('  }')) {
       foundEnd = true;
       continue; // skip the */
    }
  }
  
  newLines.push(line);
}
fs.writeFileSync('invoices.js', newLines.join('\n'));
