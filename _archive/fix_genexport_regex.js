const fs = require('fs');
let txt = fs.readFileSync('gardens.js', 'utf8');

let count = 0;

txt = txt.replace(/text\+=\`\s+\$\{stIcon\}\$\{mTag\}\$\{s\.gd\.name\}\$\{statusTag\}\$\{s\.t\?' · ⏰ '\+fT\(s\.t\):''\}\$\{coordText\}\\n\`;/g, (match) => {
    count++;
    let indent = match.match(/^\s*/)[0];
    let rep = `let grpStr = ' · ⏰ ';
let actualGrp = s.grp ? String(s.grp).trim() : String(window.ggr ? window.ggr(s.gd) || '' : '');
if (actualGrp && actualGrp !== '1' && actualGrp !== '0') {
    grpStr = \` · \${actualGrp.includes(',') ? "קב' " + actualGrp : actualGrp + " קב'"}\` + ' · ⏰ ';
}
const timeStr = s.t ? grpStr + fT(s.t) : '';
text+=\`     \${stIcon}\${mTag}\${s.gd.name}\${statusTag}\${timeStr}\${coordText}\\n\`;`;
    return rep.replace(/^/gm, indent).trimStart();
});

txt = txt.replace(/text\+=\`\s+\$\{stIcon\}\$\{mTag\}\$\{addr\}\$\{s\.gd\.name\}\$\{statusTag\}\$\{s\.t\?' · ⏰ '\+fT\(s\.t\):''\}\$\{coordText\}\\n\`;/g, (match) => {
    count++;
    let indent = match.match(/^\s*/)[0];
    let rep = `let grpStr = ' · ⏰ ';
let actualGrp = s.grp ? String(s.grp).trim() : String(window.ggr ? window.ggr(s.gd) || '' : '');
if (actualGrp && actualGrp !== '1' && actualGrp !== '0') {
    grpStr = \` · \${actualGrp.includes(',') ? "קב' " + actualGrp : actualGrp + " קב'"}\` + ' · ⏰ ';
}
const timeStr = s.t ? grpStr + fT(s.t) : '';
text+=\`  \${stIcon}\${mTag}\${addr}\${s.gd.name}\${statusTag}\${timeStr}\${coordText}\\n\`;`;
    return rep.replace(/^/gm, indent).trimStart();
});

txt = txt.replace(/text\+=\`\$\{stIcon\}\$\{mTag\}\$\{s\.gd\.name\}\$\{statusTag\} - \$\{s\.a\}\$\{s\.t\?' · ⏰ '\+fT\(s\.t\):''\}\$\{coordText\}\\n\`;/g, (match) => {
    count++;
    let indent = match.match(/^\s*/)[0];
    let rep = `let grpStr = ' · ⏰ ';
let actualGrp = s.grp ? String(s.grp).trim() : String(window.ggr ? window.ggr(s.gd) || '' : '');
if (actualGrp && actualGrp !== '1' && actualGrp !== '0') {
    grpStr = \` · \${actualGrp.includes(',') ? "קב' " + actualGrp : actualGrp + " קב'"}\` + ' · ⏰ ';
}
const timeStr = s.t ? grpStr + fT(s.t) : '';
text+=\`\${stIcon}\${mTag}\${s.gd.name}\${statusTag} - \${s.a}\${timeStr}\${coordText}\\n\`;`;
    return rep.replace(/^/gm, indent).trimStart();
});

fs.writeFileSync('gardens.js', txt, 'utf8');
console.log('done, matched: ' + count);
