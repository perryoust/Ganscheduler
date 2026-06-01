const fs = require('fs');
let code = fs.readFileSync('activity.js', 'utf8');

code = code.replace(
  /const grpCount = customGrp \|\| \(targetOrigEv \? targetOrigEv\.grp : origEv\.grp\) \|\| 1;/g,
  'const grpCount = customGrp || tgt.grp || (targetOrigEv ? targetOrigEv.grp : origEv.grp) || 1;'
);

fs.writeFileSync('activity.js', code);
console.log('Done mapping grpCount');