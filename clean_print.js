const fs = require('fs');
let t = fs.readFileSync('worker_tasks.js', 'utf8');
t = t.replace(/<style>[\s\S]*?<\/style>\n/, '');
fs.writeFileSync('worker_tasks.js', t);
console.log('Removed old print CSS from JS');
