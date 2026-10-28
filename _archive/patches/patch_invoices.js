const fs = require('fs');
let lines = fs.readFileSync('invoices.js', 'utf8').split('\n');
let mod = false;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('if (hasPath && !globalOverwrite)') && lines[i+1] && lines[i+1].includes('score -= 500')) {
    lines[i] = '        if (hasPath && !globalOverwrite) { if (existing.score !== undefined && score > existing.score) { score -= 5; } else { score -= 500; } } // patched';
    lines[i+1] = '';
    mod = true;
  }
  
  if (lines[i].includes('if (hasPath && !globalOverwrite) score -= 500;')) {
    lines[i] = '            if (hasPath && !globalOverwrite) { if (existing.score !== undefined && score > existing.score) { score -= 5; } else { score -= 500; } } // patched';
    mod = true;
  }

  if (lines[i].includes('inv[\'file_\' + matchedType] = { path: file.link, origin: \'sp\' };')) {
    lines[i] = lines[i].replace('origin: \'sp\'', 'origin: \'sp\', score: bestScore');
    mod = true;
  }
  
  if (lines[i].includes('matchedInvoice[\'file_\' + matchedType] = { path: file.link, origin: \'sp\' };')) {
    lines[i] = lines[i].replace('origin: \'sp\'', 'origin: \'sp\', score: bestScore');
    mod = true;
  }
  
  if (lines[i].includes('if (!matchedInvoice[\'file_\' + matchedType] || globalOverwrite) {') && lines[i+1] && lines[i+1].includes('matchedInvoice[\'file_\' + matchedType] =')) {
    lines[i] = lines[i].replace('|| globalOverwrite) {', '|| globalOverwrite || (matchedInvoice[\'file_\' + matchedType].score !== undefined && bestScore > matchedInvoice[\'file_\' + matchedType].score)) {');
    mod = true;
  }
  
  // also the other place
  if (lines[i].includes('if (!inv[\'file_\' + matchedType] || globalOverwrite) {') && lines[i+1] && lines[i+1].includes('inv[\'file_\' + matchedType] =')) {
    lines[i] = lines[i].replace('|| globalOverwrite) {', '|| globalOverwrite || (inv[\'file_\' + matchedType].score !== undefined && bestScore > inv[\'file_\' + matchedType].score)) {');
    mod = true;
  }
}

if (mod) {
  fs.writeFileSync('invoices.js', lines.join('\n'));
  console.log('Patched');
} else {
  console.log('No patch needed or failed to find targets');
}
