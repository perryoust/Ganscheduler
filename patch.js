const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

const target = `<div class="tab" onclick="ST('sup')"
      title="ניהול רשימת ספקי החוגים, פרטי קשר, תחומי פעילות והערות">👥 ספקים</div>`;
      
const replacement = target + `
    <div class="tab" onclick="ST('worker_tasks')"
      title="ניהול משימות שטח לעובדים">👷 משימות שטח</div>`;

content = content.replace(target, replacement);
fs.writeFileSync('index.html', content);
console.log('patched index.html');
