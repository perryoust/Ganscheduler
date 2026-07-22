const fs = require('fs');

let wt = fs.readFileSync('worker_tasks.js', 'utf8');

// Fix the dropdown quotes bug
wt = wt.replace(
  "onclick=\"document.getElementById('wt-inline-garden').value='${g.name.replace(/'/g, \"\\\\'\") }'",
  "onclick=\"document.getElementById('wt-inline-garden').value='${g.name.replace(/'/g, \"\\\\'\").replace(/\"/g, '&quot;') }'"
);

fs.writeFileSync('worker_tasks.js', wt);
console.log('Fixed worker_tasks.js');
