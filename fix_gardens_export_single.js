const fs = require('fs');
let txt = fs.readFileSync('gardens.js', 'utf8');

const regex2 = /let text = `🗓️ יום \$\{dayName\}\\n`;/g;
txt = txt.replace(regex2, 'let text = `🗓️ *${window.fD(s.d)} - יום ${dayName}*\\n`;');

const regex3 = /let gS = '';\s*if\(x\.grp\){\s*gS = ` · קב' \$\{x\.grp\}`;\s*} else {\s*const gC = window\.ggr\(gd\)\|\|0;\s*if\(gC>0\) gS = ` · \$\{gC\} קב'`;\s*}/g;

const repl3 = `let gS = '';
      if(x.grp && String(x.grp).trim() && String(x.grp).trim() !== '1'){
        const sg = String(x.grp).trim();
        gS = \` · \${sg.includes(',') ? "קב' " + sg : sg + " קב'"}\`;
      } else {
        const gC = window.ggr(gd)||0;
        if(gC>1) gS = \` · \${gC} קב'\`;
      }`;

txt = txt.replace(regex3, repl3);

fs.writeFileSync('gardens.js', txt);
console.log('Fixed exportSingleRecurringWA');
