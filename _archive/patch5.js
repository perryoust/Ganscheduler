const fs = require('fs');
let text = fs.readFileSync('index.html', 'utf8');
text = text.replace(
  '<select id="pi-sort" onchange="window.setInvSort(\'date\', this.value)">\n              <option value="desc">׳ž׳”׳—׳“׳© ׳œ׳™׳©׳Ÿ</option>\n              <option value="asc">׳ž׳”׳™׳©׳Ÿ ׳œ׳—׳“׳©</option>\n            </select>',
  '<select id="pi-sort" onchange="const v=this.value.split(\',\'); window.setInvSort(v[0], v[1])">\n              <option value="date,desc">תאריך: מהחדש לישן</option>\n              <option value="date,asc">תאריך: מהישן לחדש</option>\n              <option value="sumBase,desc">סכום: מהגבוה לנמוך</option>\n              <option value="sumBase,asc">סכום: מהנמוך לגבוה</option>\n              <option value="supName,asc">ספק: א-ת</option>\n              <option value="supName,desc">ספק: ת-א</option>\n              <option value="status,asc">סטטוס</option>\n            </select>'
);
fs.writeFileSync('index.html', text, 'utf8');
