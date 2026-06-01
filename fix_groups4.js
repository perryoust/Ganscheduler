const fs = require('fs');
let code = fs.readFileSync('activity.js', 'utf8');

code = code.replace(
  '<div class="fg"><label style="font-size:.7rem;font-weight:700">⏰ שעה (${g.name})</label><input type="time" id="rr-time"',
  '<div class="fg"><label style="font-size:.7rem;font-weight:700">קבוצות</label><input type="number" id="rr-grp" value="${s.grp||1}" min="1" max="10" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>\n          <div class="fg"><label style="font-size:.7rem;font-weight:700">⏰ שעה (${g.name})</label><input type="time" id="rr-time"'
);

fs.writeFileSync('activity.js', code);
console.log('Done modifying activity.js again');