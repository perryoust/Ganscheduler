const fs = require('fs');

const pt1 = '\\u05E4"\\u05EA'; // פ"ת
const pt2 = "\\u05E4'\\u05EA"; // פ'ת
const pt3 = "\\u05E4\\u05EA\\u05D7 \\u05EA\\u05E7\\u05D5\\u05D4"; // פתח תקוה
const ptFinal = "\\u05E4\\u05EA\\u05D7 \\u05EA\\u05E7\\u05D5\\u05D5\\u05D4"; // פתח תקווה

let cd = fs.readFileSync('core_data.js', 'utf8');
if (!cd.includes('// Migrate PT')) {
  cd = cd.replace(
    'window.GARDENS = o.gardens || [];',
    'window.GARDENS = o.gardens || [];\n  // Migrate PT\n  window.GARDENS.forEach(g => {\n    if(g.city === \'' + pt1 + '\' || g.city === \'' + pt2 + '\' || g.city === \'' + pt3 + '\') {\n      g.city = \'' + ptFinal + '\';\n    }\n  });'
  );
  fs.writeFileSync('core_data.js', cd);
  console.log('Fixed core_data.js');
}

let tc = fs.readFileSync('temp_core.js', 'utf8');
if (!tc.includes('// Migrate PT')) {
  tc = tc.replace(
    'window.GARDENS = o.gardens || [];',
    'window.GARDENS = o.gardens || [];\n  // Migrate PT\n  window.GARDENS.forEach(g => {\n    if(g.city === \'' + pt1 + '\' || g.city === \'' + pt2 + '\' || g.city === \'' + pt3 + '\') {\n      g.city = \'' + ptFinal + '\';\n    }\n  });'
  );
  fs.writeFileSync('temp_core.js', tc);
  console.log('Fixed temp_core.js');
}

let bm = fs.readFileSync('core_backup_monolith.js', 'utf8');
if (!bm.includes('// Migrate PT')) {
  bm = bm.replace(
    'window.GARDENS = window.GARDENS || [];',
    'window.GARDENS = window.GARDENS || [];\n  // Migrate PT\n  window.GARDENS.forEach(g => {\n    if(g.city === \'' + pt1 + '\' || g.city === \'' + pt2 + '\' || g.city === \'' + pt3 + '\') {\n      g.city = \'' + ptFinal + '\';\n    }\n  });'
  );
  fs.writeFileSync('core_backup_monolith.js', bm);
  console.log('Fixed core_backup_monolith.js');
}

let wt = fs.readFileSync('worker_tasks.js', 'utf8');
wt = wt.replace(
  "const gardenId = document.getElementById('wt-inline-garden-id').value;",
  "let gardenId = document.getElementById('wt-inline-garden-id').value;\n  if (!gardenId && document.getElementById('wt-inline-garden').value) {\n    const gName = document.getElementById('wt-inline-garden').value.trim();\n    const gardens = typeof AG === 'function' ? AG() : [...(window.GARDENS||[]), ...(window._GARDENS_EXTRA||[])];\n    const match = gardens.find(g => g.name === gName);\n    if(match) gardenId = match.id;\n  }"
);
fs.writeFileSync('worker_tasks.js', wt);
console.log('Fixed worker_tasks.js auto-select');

let ut = fs.readFileSync('utils.js', 'utf8');
ut = ut.replace("'\\u05E4\\u05EA\\u05D7 \\u05EA\\u05E7\\u05D5\\u05D5\\u05D4': '\\u05E4\"\\u05EA',", "'\\u05E4\"\\u05EA': '\\u05E4\\u05EA\\u05D7 \\u05EA\\u05E7\\u05D5\\u05D5\\u05D4',");
ut = ut.replace("'\\u05E4\\u05EA\\u05D7 \\u05EA\\u05E7\\u05D5\\u05D4': '\\u05E4\"\\u05EA',", "'\\u05E4\\u05EA\\u05D7 \\u05EA\\u05E7\\u05D5\\u05D4': '\\u05E4\\u05EA\\u05D7 \\u05EA\\u05E7\\u05D5\\u05D5\\u05D4',");
fs.writeFileSync('utils.js', ut);
console.log('Fixed utils.js');
