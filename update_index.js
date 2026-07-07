const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');
c = c.replace(
  '<button class="btn bo" style="width:100%; justify-content:flex-start; background:#fff; color:#333; font-size:0.8rem" onclick="exportShortagesToExcel(); closeExportMenu();">📥 דוח חוסרים</button>',
  '<button class="btn bo" style="width:100%; justify-content:flex-start; background:#fff; color:#333; font-size:0.8rem" onclick="exportShortagesToExcel(); closeExportMenu();">📥 דוח חוסרים</button>\n                  <div style="height:1px; background:#e0e0e0; margin:4px 0;"></div>\n                  <button class="btn bo" style="width:100%; justify-content:flex-start; background:#f5f7ff; color:#283593; border-color:#c5cae9; font-size:0.8rem" onclick="if(typeof openSupExport === \'function\'){openSupExport(null);}else{window.spAlert(\'שגיאה: חסר קובץ ספקים\');} closeExportMenu();">📊 יצוא דוח ספק</button>'
);
fs.writeFileSync('index.html', c);
