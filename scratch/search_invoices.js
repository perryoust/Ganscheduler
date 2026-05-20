const fs = require('fs');

const content = fs.readFileSync('core.js', 'utf8');
const queries = ['INVOICES', 'invoices'];

queries.forEach(query => {
  console.log(`Searching for "${query}" in core.js:`);
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes(query)) {
      console.log(`  Line ${idx + 1}: ${line.trim()}`);
    }
  });
});
