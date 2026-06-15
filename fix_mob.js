const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const target = '<button id="mob-admin-btn"';
const newBtn = `<button class="mob-nav-btn" onclick="ST('worker_tasks');mobNav(this)" data-tab="worker_tasks">
        <span class="mnb-ico">👷</span><span>משימות</span>
      </button>
      <button id="mob-admin-btn"`;

html = html.replace(target, newBtn);

fs.writeFileSync('index.html', html);
console.log('Mobile nav updated');
