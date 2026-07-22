const fs = require('fs');
let c = fs.readFileSync('activity.js', 'utf8');
c = c.replace(
  /\/\/ Pairs within this date\r?\n\s+\(window\.pairs \|\| \[\]\)\.forEach\(p => \{/,
  '// Groups within this date\n      const groupList = (window._listGroupMode === "clusters" && typeof window.getClusters === "function") ? window.getClusters().map(cl => ({...cl, ids: cl.gardenIds})) : (window.pairs || []);\n      groupList.forEach(p => {'
);
fs.writeFileSync('activity.js', c);
