const fs = require('fs');
let code = fs.readFileSync('invoices.js', 'utf8');

// Replace the setTimeout wrapper for folder scanning
code = code.replace(/setTimeout\(\s*async\s*\(\)\s*=>\s*\{\s*\/\/\s*2\.\s*Scan folders([\s\S]*?)\}\s*,\s*2000\s*\);/, '// 2. Scan folders$1');

fs.writeFileSync('invoices.js', code);
console.log('Replaced via regex successfully');
