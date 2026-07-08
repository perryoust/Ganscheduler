const fs=require('fs');
let txt=fs.readFileSync('gardens.js','utf8');
txt=txt.split('const gC = parseInt(s.grp, 10) || 0 || 0;\n      const gS = gC > 0 ? ` · ${gC} קב\'` : \'\';').join(`let gS = '';
      if(s.grp&&String(s.grp).trim()&&String(s.grp).trim()!=='1'){
        const sg=String(s.grp).trim();
        gS=\` · \${sg.includes(',')?"קב' "+sg:sg+" קב'"}\`;
      }`);
fs.writeFileSync('gardens.js',txt);
