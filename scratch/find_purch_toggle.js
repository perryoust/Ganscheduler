const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.js'));
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, i) => {
    if (l.includes('hdr-purch-stats') || l.includes('modeBtn-purch') || l.includes('tabs-purch')) {
      console.log(`${f}:${i + 1}: ${l.trim()}`);
    }
  });
});
