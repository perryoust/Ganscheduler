const fs = require('fs');
let code = fs.readFileSync('activity.js', 'utf8');

// Update spEditSave
code = code.replace(
  'if(newGrp && newGrp > 0) pEv.grp=newGrp;',
  'if(syn.grp) pEv.grp = syn.grp; else if(newGrp && newGrp > 0) pEv.grp = newGrp;'
);

// Update doPostpone
code = code.replace(
  /const newPtEv = \{\.\.\.s, id:Date\.now\(\) \+ idx \+ 1, g:syn\.g, d:newDate, t:syn\.t \|\| primaryTime \|\| s\.t, st:'ok', pd:'', pt:'', cr:'', cn:''\};/g,
  'const newPtEv = {...s, id:Date.now() + idx + 1, g:syn.g, d:newDate, t:syn.t || primaryTime || s.t, st:\'ok\', pd:\'\', pt:\'\', cr:\'\', cn:\'\', grp: syn.grp || s.grp || 1};'
);
// Wait, is doPostpone using newPtEv? I think that was doCopy. 
// Let's replace anything that creates a new event from syn.
code = code.replace(
  'const newPtEv = {...s, id:Date.now() + idx + 1, g:syn.g, d:newDate, t:syn.t || primaryTime || s.t, st:\'ok\', pd:\'\', pt:\'\', cr:\'\', cn:\'\'};',
  'const newPtEv = {...s, id:Date.now() + idx + 1, g:syn.g, d:newDate, t:syn.t || primaryTime || s.t, st:\'ok\', pd:\'\', pt:\'\', cr:\'\', cn:\'\', grp: syn.grp || s.grp || 1};'
);

// Any other place?
fs.writeFileSync('activity.js', code);
console.log('Done mapping syn.grp');