const fs = require('fs');
let code = fs.readFileSync('activity.js', 'utf8');

code = code.replace(
  "const targets = [{ g: origEv.g, t: time }, ...window.getSynergyData('sp-mu').map(tgt => ({ g: tgt.g, t: tgt.t || time }yak;",
  "const targets = [{ g: origEv.g, t: time }, ...window.getSynergyData('sp-mu').map(tgt => ({ g: tgt.g, t: tgt.t || time, grp: tgt.grp }yak;"
);
// wait, my replace string has 'yak;' ? Let's use regex
code = code.replace(
  /const targets = \[\{ g: origEv\.g, t: time \}, \.\.\.window\.getSynergyData\('sp-mu'\)\.map\(tgt => \(\{ g: tgt\.g, t: tgt\.t \|\| time \}\)\)\];/g,
  'const targets = [{ g: origEv.g, t: time }, ...window.getSynergyData(\'sp-mu\').map(tgt => ({ g: tgt.g, t: tgt.t || time, grp: tgt.grp }))];'
);

fs.writeFileSync('activity.js', code);
console.log('Done mapping makeup targets');