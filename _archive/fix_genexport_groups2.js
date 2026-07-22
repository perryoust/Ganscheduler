const fs = require('fs');
let txt = fs.readFileSync('gardens.js', 'utf8');

// Fix 1: SolosSameAddr
let match1 = "const rawCoord = getCoordStr(s.g);\n                const coordText = rawCoord ? `\\n     ${rawCoord.trim()}` : '';\n                text+=`     ${stIcon}${mTag}${s.gd.name}${statusTag}${s.t?' · ⏰ '+fT(s.t):''}${coordText}\\n`;";
let rep1 = "const rawCoord = getCoordStr(s.g);\n                const coordText = rawCoord ? `\\n     ${rawCoord.trim()}` : '';\n                let grpStr = ' · ⏰ ';\n                let actualGrp = s.grp ? String(s.grp).trim() : String(window.ggr ? window.ggr(s.gd) || '' : '');\n                if (actualGrp && actualGrp !== '1' && actualGrp !== '0') {\n                    grpStr = ` · ${actualGrp.includes(',') ? \"קב' \" + actualGrp : actualGrp + \" קב'\"} · ⏰ `;\n                }\n                const timeStr = s.t ? grpStr + fT(s.t) : '';\n                text+=`     ${stIcon}${mTag}${s.gd.name}${statusTag}${timeStr}${coordText}\\n`;";

if (txt.includes(match1)) {
    txt = txt.replace(match1, rep1);
    console.log("Fixed 1");
}

// Fix 2: SolosDiffAddr
let match2 = "const rawCoord = getCoordStr(s.g);\n                const coordText = rawCoord ? `\\n  ${rawCoord.trim()}` : '';\n                text+=`  ${stIcon}${mTag}${addr}${s.gd.name}${statusTag}${s.t?' · ⏰ '+fT(s.t):''}${coordText}\\n`;";
let rep2 = "const rawCoord = getCoordStr(s.g);\n                const coordText = rawCoord ? `\\n  ${rawCoord.trim()}` : '';\n                let grpStr = ' · ⏰ ';\n                let actualGrp = s.grp ? String(s.grp).trim() : String(window.ggr ? window.ggr(s.gd) || '' : '');\n                if (actualGrp && actualGrp !== '1' && actualGrp !== '0') {\n                    grpStr = ` · ${actualGrp.includes(',') ? \"קב' \" + actualGrp : actualGrp + \" קב'\"} · ⏰ `;\n                }\n                const timeStr = s.t ? grpStr + fT(s.t) : '';\n                text+=`  ${stIcon}${mTag}${addr}${s.gd.name}${statusTag}${timeStr}${coordText}\\n`;";

if (txt.includes(match2)) {
    txt = txt.replace(match2, rep2);
    console.log("Fixed 2");
}

// Fix 3: FmtSum
let match3 = "const rawCoord = getCoordStr(s.g);\n          const coordText = rawCoord ? `\\n${rawCoord.trim()}` : '';\n          text+=`${stIcon}${mTag}${s.gd.name}${statusTag} - ${s.a}${s.t?' · ⏰ '+fT(s.t):''}${coordText}\\n`;";
let rep3 = "const rawCoord = getCoordStr(s.g);\n          const coordText = rawCoord ? `\\n${rawCoord.trim()}` : '';\n          let grpStr = ' · ⏰ ';\n          let actualGrp = s.grp ? String(s.grp).trim() : String(window.ggr ? window.ggr(s.gd) || '' : '');\n          if (actualGrp && actualGrp !== '1' && actualGrp !== '0') {\n              grpStr = ` · ${actualGrp.includes(',') ? \"קב' \" + actualGrp : actualGrp + \" קב'\"} · ⏰ `;\n          }\n          const timeStr = s.t ? grpStr + fT(s.t) : '';\n          text+=`${stIcon}${mTag}${s.gd.name}${statusTag} - ${s.a}${timeStr}${coordText}\\n`;";

if (txt.includes(match3)) {
    txt = txt.replace(match3, rep3);
    console.log("Fixed 3");
}

fs.writeFileSync('gardens.js', txt, 'utf8');
console.log('done!');
