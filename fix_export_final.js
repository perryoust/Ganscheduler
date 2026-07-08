const fs = require('fs');
let txt = fs.readFileSync('export_v107.js', 'utf8');

// Fix 1: g.addr -> g.st
const rowStr = "const row = isPlacement ? ws.addRow([g.addr || '', g.name, window.fD(s.d), dayStr, s.t, grpCount, displayStatus, formattedNote]) : ws.addRow([window.fD(s.d), dayStr, g.name, window.supBase ? window.supBase(s.a) : s.a, s.act || window.supAct(s.a) || '', s.t, grpCount, displayStatus, formattedNote]);";
const rowRep = "const row = isPlacement ? ws.addRow([g.st || '', g.name, window.fD(s.d), dayStr, s.t, grpCount, displayStatus, formattedNote]) : ws.addRow([window.fD(s.d), dayStr, g.name, window.supBase ? window.supBase(s.a) : s.a, s.act || window.supAct(s.a) || '', s.t, grpCount, displayStatus, formattedNote]);";

if(txt.includes(rowStr)) {
    txt = txt.replace(rowStr, rowRep);
    console.log("Fixed g.addr -> g.st");
} else {
    console.log("Could not find rowStr!");
}

// Fix 2: totalRow merge
const mergeStr = "ws.mergeCells(totalRow.number, 1, totalRow.number, 2);\n            ws.addRow([]); // Blank row before the next type starts";
const mergeRep = "if(!isPlacement) ws.mergeCells(totalRow.number, 1, totalRow.number, 2);\n            ws.addRow([]); // Blank row before the next type starts";

if(txt.includes(mergeStr)) {
    txt = txt.replace(mergeStr, mergeRep);
    console.log("Fixed mergeCells");
} else {
    console.log("Could not find mergeStr!");
}

fs.writeFileSync('export_v107.js', txt, 'utf8');
console.log('Done!');
