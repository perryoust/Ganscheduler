const fs = require('fs');
const path = require('path');

const dir = '.';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') || f.endsWith('.html'));

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('firebasedatabase.app') || line.includes('fetch(')) {
      console.log(`${f}:${idx + 1}: ${line.trim()}`);
    }
  });
});
