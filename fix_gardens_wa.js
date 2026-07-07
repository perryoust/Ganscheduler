const fs = require('fs');
let txt = fs.readFileSync('gardens.js', 'utf8');

const regex1 = /const gC = parseInt\(x\.grp, 10\) \|\| window\.ggr\(gd\) \|\| 0;\s*const gS = gC > 0 \? ` · \$\{gC\} קב'` : '';/g;
txt = txt.replace(regex1, `let gS = '';\n      if(x.grp){\n        gS = \` · קב' \${x.grp}\`;\n      } else {\n        const gC = window.ggr(gd)||0;\n        if(gC>0) gS = \` · \${gC} קב'\`;\n      }`);

fs.writeFileSync('gardens.js', txt);
console.log('Fixed gardens.js groups text');
