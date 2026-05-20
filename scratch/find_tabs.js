const fs = require('fs');
const content = fs.readFileSync('core.js', 'utf8');
const lines = content.split('\n');

// Find where TABS is defined
lines.forEach((l, i) => {
  if (/\bTABS\b/.test(l) && (l.includes('TABS=') || l.includes('TABS =') || l.includes('window.TABS'))) {
    console.log((i + 1) + ': ' + l.trim());
  }
});
