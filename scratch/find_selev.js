const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.js'));
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, i) => {
    if (/\bselEv\b/.test(l) && (l.includes('selEv=') || l.includes('selEv =') || l.includes('let selEv') || l.includes('var selEv') || l.includes('window.selEv'))) {
      console.log(`${f}:${i + 1}: ${l.trim()}`);
    }
  });
});
