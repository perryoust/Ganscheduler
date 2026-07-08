const fs = require('fs');
let txt = fs.readFileSync('gardens.js', 'utf8');

const regex = /let grpStr = ' · ⏰ ';\s*if \(s\.grp && String\(s\.grp\)\.trim\(\) && String\(s\.grp\)\.trim\(\) !== '1'\) {\s*const sg = String\(s\.grp\)\.trim\(\);\s*grpStr = ` · \$\{sg\.includes\(','\) \? "קב' " \+ sg : sg \+ " קב'"\} · ⏰ `;\s*}/g;

const repl = `let grpStr = ' · ⏰ ';
                if (s.grp && String(s.grp).trim() && String(s.grp).trim() !== '1') {
                    const sg = String(s.grp).trim();
                    grpStr = \` · \${sg.includes(',') ? "קב' " + sg : sg + " קב'"} · ⏰ \`;
                } else if (!s.grp) {
                    const gC = window.ggr(s.gd) || 0;
                    if (gC > 1) grpStr = \` · \${gC} קב' · ⏰ \`;
                }`;

txt = txt.replace(regex, repl);
fs.writeFileSync('gardens.js', txt);
console.log('Fixed exportDayWA missing fallback');
