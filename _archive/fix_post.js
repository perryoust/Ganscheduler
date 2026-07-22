const fs=require('fs');
let files = ['export_v107.js', 'export_v107_dump.js'];
files.forEach(file => {
  let c = fs.readFileSync(file, 'utf8');
  let search = '} else if (ev.st === \'can\') {\n               statusNote = \'בוטל\';\n               finalGrp = 0;\n             }';
  let replace = '} else if (ev.st === \'can\') {\n               statusNote = \'בוטל\';\n               finalGrp = 0;\n             } else if (ev.st === \'post\') {\n               const linkedNext = (window.SCH || []).find(x => x.g === ev.g && x.a === ev.a && (x._postFrom === ev.d || x._makeupFrom === ev.d));\n               let toDateStr = \'\';\n               if (linkedNext && linkedNext.d) {\n                 const pts = linkedNext.d.split(\'-\');\n                 if (pts.length === 3) toDateStr = pts[2]+\'/\'+pts[1]+\'/\'+pts[0];\n               }\n               statusNote = toDateStr ? \'נדחה ל-\'+toDateStr : \'נדחה\';\n               finalGrp = 0;\n             }';
  
  if (c.includes('statusNote = \'בוטל\';')) {
    c = c.replace(search, replace);
    fs.writeFileSync(file, c, 'utf8');
    console.log('Fixed ' + file);
  } else {
    console.log('String not found in ' + file);
  }
});
