const fs = require('fs');

const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('modeBtn-') || line.includes('switchMode') || line.includes('tabs-purch')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
