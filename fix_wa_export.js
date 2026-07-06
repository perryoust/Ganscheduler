const fs = require('fs');

let gardens = fs.readFileSync('gardens.js', 'utf8');

const r1 = `  if (sameAddr && addrs[0]) {
    text += \`  📍 \${addrs[0]}\\n\`;
    rel.forEach(x => {
      const gd = window.G(x.g);
      const gardenName = gd.name;
      const gC = window.ggr(gd) || 0;
      const gS = gC > 0 ? \` · \${gC} קב'\` : '';
      let tS = x.t ? ' ⏰ ' + window.fT(x.t) : '';
      if(!gS && tS) tS = ' ·' + tS;
      text += \`     🏫 \${gardenName}\${gS}\${tS}\\n\`;
    });
  } else {
    rel.forEach(x => {
      const gd = window.G(x.g);
      const addr = gd.st ? \`📍 \${gd.st} · \` : '';
      const gC = window.ggr(gd) || 0;
      const gS = gC > 0 ? \` · \${gC} קב'\` : '';
      let tS = x.t ? ' ⏰ ' + window.fT(x.t) : '';
      if(!gS && tS) tS = ' ·' + tS;
      text += \`  🏫 \${addr}\${gd.name}\${gS}\${tS}\\n\`;
    });
  }`;

gardens = gardens.replace(/if\s*\(sameAddr\s*&&\s*addrs\[0\]\)\s*\{\s*text\s*\+=\s*`\s*📍\s*\$\{addrs\[0\]\}\\n`;\s*rel\.forEach\(x\s*=>\s*\{\s*const\s*gardenName\s*=\s*window\.G\(x\.g\)\.name;\s*text\s*\+=\s*`\s*🏫\s*\$\{gardenName\}\$\{x\.t\s*\?\s*' · ⏰ '\s*\+\s*window\.fT\(x\.t\)\s*:\s*''\}\\n`;\s*\}\);\s*\}\s*else\s*\{\s*rel\.forEach\(x\s*=>\s*\{\s*const\s*gd\s*=\s*window\.G\(x\.g\);\s*const\s*addr\s*=\s*gd\.st\s*\?\s*`📍\s*\$\{gd\.st\}\s*·\s*`\s*:\s*'';\s*text\s*\+=\s*`\s*🏫\s*\$\{addr\}\$\{gd\.name\}\$\{x\.t\s*\?\s*' · ⏰ '\s*\+\s*window\.fT\(x\.t\)\s*:\s*''\}\\n`;\s*\}\);\s*\}/g, r1);


const r2 = `  if (sameAddr && addrs[0]) {
    text += \`  📍 \${addrs[0]}\\n\`;
    group.forEach(s => {
      const gC = window.ggr(s.gd) || 0;
      const gS = gC > 0 ? \` · \${gC} קב'\` : '';
      let tS = s.t ? ' ⏰ ' + window.fT(s.t) : '';
      if(!gS && tS) tS = ' ·' + tS;
      text += \`     🏫 \${s.gd.name}\${gS}\${tS}\\n\`;
    });
  } else {
    group.forEach(s => {
      const addr = s.gd.st ? \`📍 \${s.gd.st} · \` : '';
      const gC = window.ggr(s.gd) || 0;
      const gS = gC > 0 ? \` · \${gC} קב'\` : '';
      let tS = s.t ? ' ⏰ ' + window.fT(s.t) : '';
      if(!gS && tS) tS = ' ·' + tS;
      text += \`  🏫 \${addr}\${s.gd.name}\${gS}\${tS}\\n\`;
    });
  }`;
  
gardens = gardens.replace(/if\s*\(sameAddr\s*&&\s*addrs\[0\]\)\s*\{\s*text\s*\+=\s*`\s*📍\s*\$\{addrs\[0\]\}\\n`;\s*group\.forEach\(s\s*=>\s*\{\s*text\s*\+=\s*`\s*🏫\s*\$\{s\.gd\.name\}\$\{s\.t\s*\?\s*' · ⏰ '\s*\+\s*window\.fT\(s\.t\)\s*:\s*''\}\\n`;\s*\}\);\s*\}\s*else\s*\{\s*group\.forEach\(s\s*=>\s*\{\s*const\s*addr\s*=\s*s\.gd\.st\s*\?\s*`📍\s*\$\{s\.gd\.st\}\s*·\s*`\s*:\s*'';\s*text\s*\+=\s*`\s*🏫\s*\$\{addr\}\$\{s\.gd\.name\}\$\{s\.t\s*\?\s*' · ⏰ '\s*\+\s*window\.fT\(s\.t\)\s*:\s*''\}\\n`;\s*\}\);\s*\}/g, r2);

fs.writeFileSync('gardens.js', gardens);
console.log('Regex replace attempted');
