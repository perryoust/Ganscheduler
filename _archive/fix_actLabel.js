const fs = require('fs');

let txt = fs.readFileSync('gardens.js', 'utf8');

// Fix actLabel preference
txt = txt.replace(/const actLabel = s\.act \|\| window\.supAct\(s\.a\) \|\| '';/g, "const actLabel = window.supAct(s.a) || s.act || '';");
txt = txt.replace(/const actLabel=s0\.act\|\|supAct\(s0\.a\)\|\|'';/g, "const actLabel=supAct(s0.a)||s0.act||'';");

// Also check export_v107.js
if (fs.existsSync('export_v107.js')) {
    let expTxt = fs.readFileSync('export_v107.js', 'utf8');
    expTxt = expTxt.replace(/s\.act \|\| window\.supAct\(s\.a\) \|\| ''/g, "window.supAct(s.a) || s.act || ''");
    fs.writeFileSync('export_v107.js', expTxt);
}

fs.writeFileSync('gardens.js', txt);
console.log('Fixed actLabel preference');
