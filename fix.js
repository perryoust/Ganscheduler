const fs = require('fs');
let text = fs.readFileSync('worker_tasks.js', 'utf8');

text = text.replace(/\\`/g, '`');
text = text.replace(/\\\$/g, '$');

fs.writeFileSync('worker_tasks.js', text);
console.log('Fixed syntax');
