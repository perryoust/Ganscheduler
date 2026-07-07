const fs = require('fs');
let txt = fs.readFileSync('gardens.js', 'utf8');

const regex = /const grpCount = s\.grp \? parseInt\(s\.grp\) : 1;\s*const grpStr = grpCount > 1 \? ` · \$\{grpCount\}קב' ·⏰ ` : ' · ⏰ ';/g;

const repl = `let grpStr = ' · ⏰ ';
                if (s.grp && String(s.grp).trim() && String(s.grp).trim() !== '1') {
                    const sg = String(s.grp).trim();
                    grpStr = \` · \${sg.includes(',') ? "קב' " + sg : sg + " קב'"} · ⏰ \`;
                }`;

txt = txt.replace(regex, repl);

// Also fix the title to be bold!
txt = txt.replace(/text\+=\`\$\{dayIcon\} \$\{fD\(date\)\} - יום \$\{dayN\(date\)\}\\n\`;/g, 'text+=`${dayIcon} *${fD(date)} - יום ${dayN(date)}*\\n`;');

fs.writeFileSync('gardens.js', txt);
console.log('Fixed gardens.js export formatting');
