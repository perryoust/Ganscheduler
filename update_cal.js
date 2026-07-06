const fs = require('fs');
let c = fs.readFileSync('cal.js', 'utf8');
c = c.replace(/renderCal\(\);\r?\n\}/, 'renderCal();\n  if (window.currentTab === "dash" && typeof window.renderDash === "function") window.renderDash();\n}');
fs.writeFileSync('cal.js', c);
