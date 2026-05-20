const fs = require('fs');
const path = require('path');

const dir = '.';
const query = '_applyYearData';

const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes(query)) {
    console.log(`Found "${query}" in ${f}`);
    // Print lines with match
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes(query)) {
        console.log(`  Line ${idx + 1}: ${line.trim()}`);
      }
    });
  }
});
