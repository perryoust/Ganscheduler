const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.js') || f.endsWith('.html'));

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('permPurch')) {
      console.log(`${f}:${idx + 1}: ${line.trim()}`);
    }
  });
});
