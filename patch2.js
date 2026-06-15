const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const targetDesktop = `<div class="tab" onclick="ST('gardens')"`;
const targetMobile = `<button class="mob-nav-btn" onclick="ST('gardens');mobNav(this)" data-tab="gardens">`;

if (!html.includes(`ST('worker_tasks')`)) {
  html = html.replace(targetDesktop, `<div class="tab" onclick="ST('worker_tasks')" title="ניהול משימות והערות לעובדי שטח">👷 משימות שטח</div>\n    ` + targetDesktop);
}

if (!html.includes(`data-tab="worker_tasks"`)) {
  html = html.replace(targetMobile, `<button class="mob-nav-btn" onclick="ST('worker_tasks');mobNav(this)" data-tab="worker_tasks"><span class="mnb-ico">👷</span><span>משימות</span></button>\n      ` + targetMobile);
}

html = html.replace(/worker_tasks\.js(\?v=\d+(\.\d+)?)?/g, 'worker_tasks.js?v=' + Date.now());

fs.writeFileSync('index.html', html);
console.log("Patched successfully");
