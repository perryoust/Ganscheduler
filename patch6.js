const fs = require('fs');
let text = fs.readFileSync('invoices.js', 'utf8');
text = text.replace(
  '  // Sync the date dropdown if it was a date sort\n  const sel = document.getElementById(\'pi-sort\');\n  if(sel && col === \'date\') {\n    sel.value = window._invSortAsc ? \'asc\' : \'desc\';\n  } else if (sel && col !== \'date\') {\n    // maybe disable or just leave it\n  }',
  '  // Sync the sort dropdown\n  const sel = document.getElementById(\'pi-sort\');\n  if (sel) {\n    sel.value = col + \',\' + (window._invSortAsc ? \'asc\' : \'desc\');\n  }'
);
fs.writeFileSync('invoices.js', text, 'utf8');
