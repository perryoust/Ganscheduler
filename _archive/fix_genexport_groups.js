const fs = require('fs');
let txt = fs.readFileSync('gardens.js', 'utf8');

const strSolosSameAddr = `              group.forEach(s=>{ 
                const mTag = skipInlineMTag ? '' : getRowTag(s);
                const isNohapRow = isNohapFunc(s);
                const stIcon = isNohapRow ? '❌ ' : '🏫 ';
                const statusTag = (!skipInlineNohap && isNohapRow && !isAllCan && !isAllNohap && !isAllPreponedOut) ? ' *(לא התקיים)*' : '';
                const rawCoord = isPairWithSameMgr ? '' : getCoordStr(s.g);
                const coordText = rawCoord ? \`\\n     \${rawCoord.trim()}\` : '';
                text+=\`     \${stIcon}\${mTag}\${s.gd.name}\${statusTag}\${s.t?' · ⏰ '+fT(s.t):''}\${coordText}\\n\`; 
              });`;

const repSolosSameAddr = `              group.forEach(s=>{ 
                const mTag = skipInlineMTag ? '' : getRowTag(s);
                const isNohapRow = isNohapFunc(s);
                const stIcon = isNohapRow ? '❌ ' : '🏫 ';
                const statusTag = (!skipInlineNohap && isNohapRow && !isAllCan && !isAllNohap && !isAllPreponedOut) ? ' *(לא התקיים)*' : '';
                const rawCoord = isPairWithSameMgr ? '' : getCoordStr(s.g);
                const coordText = rawCoord ? \`\\n     \${rawCoord.trim()}\` : '';
                let grpStr = ' · ⏰ ';
                let actualGrp = s.grp ? String(s.grp).trim() : String(window.ggr ? window.ggr(s.gd) || '' : '');
                if (actualGrp && actualGrp !== '1' && actualGrp !== '0') {
                    grpStr = \` · \${actualGrp.includes(',') ? "קב' " + actualGrp : actualGrp + " קב'"}\` + ' · ⏰ ';
                }
                const timeStr = s.t ? grpStr + fT(s.t) : '';
                text+=\`     \${stIcon}\${mTag}\${s.gd.name}\${statusTag}\${timeStr}\${coordText}\\n\`; 
              });`;

if(txt.includes(strSolosSameAddr)) {
    txt = txt.replace(strSolosSameAddr, repSolosSameAddr);
    console.log("Replaced SolosSameAddr");
} else {
    console.log("Could not find SolosSameAddr! Searching for similar...");
}

const strSolosDiffAddr = `              group.forEach(s=>{
                const mTag = skipInlineMTag ? '' : getRowTag(s);
                const isNohapRow = isNohapFunc(s);
                const stIcon = isNohapRow ? '❌ ' : '🏫 ';
                const addr=s.gd.st?\`📍 \${s.gd.st} · \`:'';
                const statusTag = (!skipInlineNohap && isNohapRow && !isAllCan && !isAllNohap && !isAllPreponedOut) ? ' *(לא התקיים)*' : '';
                const rawCoord = getCoordStr(s.g);
                const coordText = rawCoord ? \`\\n  \${rawCoord.trim()}\` : '';
                text+=\`  \${stIcon}\${mTag}\${addr}\${s.gd.name}\${statusTag}\${s.t?' · ⏰ '+fT(s.t):''}\${coordText}\\n\`;
              });`;

const repSolosDiffAddr = `              group.forEach(s=>{
                const mTag = skipInlineMTag ? '' : getRowTag(s);
                const isNohapRow = isNohapFunc(s);
                const stIcon = isNohapRow ? '❌ ' : '🏫 ';
                const addr=s.gd.st?\`📍 \${s.gd.st} · \`:'';
                const statusTag = (!skipInlineNohap && isNohapRow && !isAllCan && !isAllNohap && !isAllPreponedOut) ? ' *(לא התקיים)*' : '';
                const rawCoord = getCoordStr(s.g);
                const coordText = rawCoord ? \`\\n  \${rawCoord.trim()}\` : '';
                let grpStr = ' · ⏰ ';
                let actualGrp = s.grp ? String(s.grp).trim() : String(window.ggr ? window.ggr(s.gd) || '' : '');
                if (actualGrp && actualGrp !== '1' && actualGrp !== '0') {
                    grpStr = \` · \${actualGrp.includes(',') ? "קב' " + actualGrp : actualGrp + " קב'"}\` + ' · ⏰ ';
                }
                const timeStr = s.t ? grpStr + fT(s.t) : '';
                text+=\`  \${stIcon}\${mTag}\${addr}\${s.gd.name}\${statusTag}\${timeStr}\${coordText}\\n\`;
              });`;

if(txt.includes(strSolosDiffAddr)) {
    txt = txt.replace(strSolosDiffAddr, repSolosDiffAddr);
    console.log("Replaced SolosDiffAddr");
} else {
    console.log("Could not find SolosDiffAddr!");
}

const strFmtSum = `        byCity[c].forEach(s=>{
          const mTag = getRowTag(s);
          const isNohapRow = s.st === 'can' || s.st === 'nohap';
          const stIcon = isNohapRow ? '❌ ' : '🏫 ';
          const statusTag = (isNohapRow && !isAllCan && !isAllNohap && !isAllPreponedOut) ? ' *(לא התקיים)*' : '';
          const rawCoord = getCoordStr(s.g);
          const coordText = rawCoord ? \`\\n\${rawCoord.trim()}\` : '';
          text+=\`\${stIcon}\${mTag}\${s.gd.name}\${statusTag} - \${s.a}\${s.t?' · ⏰ '+fT(s.t):''}\${coordText}\\n\`;
        });`;

const repFmtSum = `        byCity[c].forEach(s=>{
          const mTag = getRowTag(s);
          const isNohapRow = s.st === 'can' || s.st === 'nohap';
          const stIcon = isNohapRow ? '❌ ' : '🏫 ';
          const statusTag = (isNohapRow && !isAllCan && !isAllNohap && !isAllPreponedOut) ? ' *(לא התקיים)*' : '';
          const rawCoord = getCoordStr(s.g);
          const coordText = rawCoord ? \`\\n\${rawCoord.trim()}\` : '';
          let grpStr = ' · ⏰ ';
          let actualGrp = s.grp ? String(s.grp).trim() : String(window.ggr ? window.ggr(s.gd) || '' : '');
          if (actualGrp && actualGrp !== '1' && actualGrp !== '0') {
              grpStr = \` · \${actualGrp.includes(',') ? "קב' " + actualGrp : actualGrp + " קב'"}\` + ' · ⏰ ';
          }
          const timeStr = s.t ? grpStr + fT(s.t) : '';
          text+=\`\${stIcon}\${mTag}\${s.gd.name}\${statusTag} - \${s.a}\${timeStr}\${coordText}\\n\`;
        });`;

if(txt.includes(strFmtSum)) {
    txt = txt.replace(strFmtSum, repFmtSum);
    console.log("Replaced FmtSum");
} else {
    console.log("Could not find FmtSum!");
}

fs.writeFileSync('gardens.js', txt, 'utf8');
console.log('done!');
