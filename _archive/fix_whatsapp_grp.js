const fs = require('fs');
let txt = fs.readFileSync('gardens.js', 'utf8');

const regex = /if\s*\(s\.grp\s*&&\s*String\(s\.grp\)\.trim\(\)\s*&&\s*String\(s\.grp\)\.trim\(\)\s*!==\s*'1'\)\s*\{\s*const\s*sg\s*=\s*String\(s\.grp\)\.trim\(\);\s*grpStr\s*=\s*` \· \$\{sg\.includes\(','\)\s*\?\s*"קב' "\s*\+\s*sg\s*:\s*sg\s*\+\s*" קב'"\}\s*\· ⏰ `;\s*\}/g;

const replacement = `let actualGrp = s.grp ? String(s.grp).trim() : String(window.ggr ? window.ggr(s.gd) || '' : '');
                if (actualGrp && actualGrp !== '1' && actualGrp !== '0') {
                    grpStr = \` · \${actualGrp.includes(',') ? "קב' " + actualGrp : actualGrp + " קב'"} · ⏰ \`;
                }`;

txt = txt.replace(regex, replacement);
fs.writeFileSync('gardens.js', txt);
console.log('Done.');
