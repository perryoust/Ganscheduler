const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

c = c.replace(
  '<div class="mb" style="max-width:500px">\n      <h2 id="supexm-title">',
  '<div class="mb" style="max-width:650px; height:80vh; display:flex; flex-direction:column;">\n      <h2 id="supexm-title">'
);

c = c.replace(
  '<div id="supex-act-opts">',
  '<div id="supex-act-opts" style="flex:1; display:flex; flex-direction:column; min-height:0;">'
);

c = c.replace(
  '<div class="fg custom-multi-wrap" id="supex-garden-multi-wrap">',
  '<div class="fg custom-multi-wrap" id="supex-garden-multi-wrap" style="flex:1; display:flex; flex-direction:column; min-height:0;">'
);

c = c.replace(
  '<div class="custom-multi-dropdown" id="supex-garden-multi-list" style="width:100%">',
  '<div class="custom-multi-dropdown" id="supex-garden-multi-list" style="width:100%; display:flex; flex-direction:column; flex:1; position:relative; min-height:300px;">'
);

c = c.replace(
  '<div id="supex-garden-multi-items" style="max-height:400px;overflow-y:auto;background:#fff;border:1px solid #ddd;border-top:none;"></div>',
  '<div id="supex-garden-multi-items" style="flex:1; overflow-y:auto; background:#fff; border:1px solid #ddd; border-top:none;"></div>'
);

fs.writeFileSync('index.html', c);
