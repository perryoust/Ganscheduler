const fs = require('fs');
let code = fs.readFileSync('activity.js', 'utf8');

// Update openSP
code = code.replace(
  'const currentTimesSP = {};\n    const currentGrpsSP = {};',
  'const currentTimesSP = {};\n    const currentGrpsSP = {};\n    currentTimesSP[s.g] = window.fT(s.t);\n    currentGrpsSP[s.g] = s.grp || 1;'
);

// Update openPostpone and openCopy
code = code.replace(
  /const currentTimes = \{\};\n      const currentGrps = \{\};/g,
  'const currentTimes = {};\n      const currentGrps = {};\n      currentTimes[s.g] = window.fT(s.t);\n      currentGrps[s.g] = s.grp || 1;'
);

fs.writeFileSync('activity.js', code);
console.log('Done injecting main event data to synergy box');