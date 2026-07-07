const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');
c = c.replace(
  '<div id="supex-garden-multi-items" style="max-height:200px;overflow-y:auto;background:#fff;border:1px solid #ddd;border-top:none;"></div>',
  '<div id="supex-garden-multi-items" style="max-height:400px;overflow-y:auto;background:#fff;border:1px solid #ddd;border-top:none;"></div>'
);
fs.writeFileSync('index.html', c);
