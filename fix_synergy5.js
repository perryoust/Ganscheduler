const fs = require('fs');
let code = fs.readFileSync('activity.js', 'utf8');

code = code.replace(
  'const partners = pair.ids.filter(id => Number(id) !== Number(gid));',
  'const partners = pair.ids;'
);

fs.writeFileSync('activity.js', code);
console.log('Done showing both gardens in synergy');