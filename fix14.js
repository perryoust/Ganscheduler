const fs = require('fs');
let content = fs.readFileSync('worker_tasks.js', 'utf8');

const target1 = `        <button onclick="location.reload()" style="background:rgba(255,255,255,0.2); border:none; border-radius:6px; color:white; padding:6px 12px; font-size:0.8rem; cursor:pointer;">רענן 🔄</button>`;
const rep1 = `        <button onclick="if(window.loadFromFirebase) { this.innerText='מרענן...'; window.loadFromFirebase(false, true).then(()=>window.renderWorkerTasksMobile()); } else location.reload();" style="background:rgba(255,255,255,0.2); border:none; border-radius:6px; color:white; padding:6px 12px; font-size:0.8rem; cursor:pointer;">רענן נתונים 🔄</button>`;

if (content.includes(target1)) {
    content = content.replace(target1, rep1);
    fs.writeFileSync('worker_tasks.js', content);
    console.log('worker_tasks.js patched');
} else {
    console.log('worker_tasks.js target not found');
}
