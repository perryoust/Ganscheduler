const fs = require('fs');
let code = fs.readFileSync('invoices.js', 'utf8');
code = code.replace(/\/\/ ── Step 6\.5.*?\n.*?\n.*?\/\*/, '// —— Step 6.5: Batch alias suggestions\n  const pending = window._pendingAliasSuggestions || [];\n  window._pendingAliasSuggestions = []; // Reset for next run');
code = code.replace(/      \}, 50\);\n    \}\);\n  \}\n  \*\//, '      }, 50);\n    });\n  }');
fs.writeFileSync('invoices.js', code);
