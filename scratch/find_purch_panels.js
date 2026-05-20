const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

// Search for procurement panel divs
lines.forEach((l, i) => {
  if (l.includes('pdash') || l.includes('pinvoices') || l.includes('psup')) {
    console.log((i + 1) + ': ' + l.trim());
  }
});
