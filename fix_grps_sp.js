const fs = require('fs');
let code = fs.readFileSync('activity.js', 'utf8');

// Ensure currentGrpsSP is declared and populated with s.g
code = code.replace(
  /const currentTimesSP = \{\};\s*const partnerInfo = \[\];/g,
  'const currentTimesSP = {};\n    const currentGrpsSP = {};\n    currentTimesSP[s.g] = window.fT(s.t);\n    currentGrpsSP[s.g] = s.grp || 1;\n    const partnerInfo = [];'
);

fs.writeFileSync('activity.js', code);
console.log('Done fixing currentGrpsSP declaration in openSP');