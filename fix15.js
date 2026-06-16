const fs = require('fs');

// 1. Fix worker_tasks.js
let wt = fs.readFileSync('worker_tasks.js', 'utf8');

const target1 = `res.innerHTML = list.map(g => \`<div style="padding:5px; cursor:pointer; font-size:0.85rem; border-bottom:1px solid #eee;" onclick="document.getElementById('wt-inline-garden').value='\${g.name.replace(/'/g, "\\\\'").replace(/"/g, '&quot;') }'; document.getElementById('wt-inline-garden-id').value='\${g.id}'; document.getElementById('wt-inline-garden-results').style.display='none';">\${g.name} (\${g.city||'אחר'})</div>\`).join('');`;
const rep1 = `res.innerHTML = list.map(g => \`<div style="padding:5px; cursor:pointer; font-size:0.85rem; border-bottom:1px solid #eee;" data-id="\${g.id}" data-name="\${(g.name||'').replace(/"/g, '&quot;')}" onclick="document.getElementById('wt-inline-garden').value=this.dataset.name; document.getElementById('wt-inline-garden-id').value=this.dataset.id; document.getElementById('wt-inline-garden-results').style.display='none';">\${g.name} (\${g.city||'אחר'})</div>\`).join('');`;

if (wt.includes(target1)) {
    wt = wt.replace(target1, rep1);
} else {
    // try a more generic replacement
    wt = wt.replace(/res\.innerHTML = list\.map\(g => `\<div[\s\S]*?<\/div>`\)\.join\(''\);/, rep1);
}

// Ensure window.renderWorkerTasksForCal is defined
if (!wt.includes('window.renderWorkerTasksForCal')) {
    wt += `\n
window.renderWorkerTasksForCal = function(ds) {
  const tasks = (window.WORKER_TASKS || []).filter(t => !t.isAdminOnly && t.date === ds);
  if (tasks.length === 0) return '';
  
  let html = \`<div style="margin-top:20px; background-color:#e3f2fd; border:2px dashed #90caf9; border-radius:8px; padding:15px; margin-bottom:20px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
    <h3 style="color:#1565c0; margin:0 0 10px 0; font-size:1.1rem;">👷 משימות שטח ליום זה (\${tasks.length})</h3>\`;
    
  tasks.forEach(t => {
    const gardenName = window.G ? (window.G(t.gardenId)?.name || '') : '';
    const city = window.G ? (window.G(t.gardenId)?.city || '') : '';
    const isDone = t.status === 'done';
    
    html += \`
      <div style="background:#fff; border-radius:6px; padding:10px; margin-bottom:8px; border-right:4px solid \${isDone ? '#4caf50' : '#ff9800'}; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <strong style="font-size:0.95rem; \${isDone?'text-decoration:line-through;color:#888':''}"><span style="font-size:0.8rem; background:#f0f0f0; padding:2px 6px; border-radius:4px; margin-left:5px;">\${city}</span> \${gardenName}</strong>
          <span style="font-size:0.8rem; font-weight:bold; color:\${isDone ? '#4caf50' : '#ff9800'};">\${isDone ? '✅ בוצע' : '⏳ ממתין'}</span>
        </div>
        <div style="font-size:0.9rem; color:#444; \${isDone?'text-decoration:line-through;opacity:0.7':''}">\${t.desc.replace(/\\n/g, '<br>')}</div>
        \${t.workerNote ? \`<div style="margin-top:6px; font-size:0.8rem; background:#f5f7ff; color:#1565c0; padding:4px 8px; border-radius:4px;">💬 \${t.workerNote}</div>\` : ''}
      </div>
    \`;
  });
  
  html += \`</div>\`;
  return html;
};
`;
}
fs.writeFileSync('worker_tasks.js', wt);
console.log('worker_tasks.js patched');

// 2. Fix cal.js
let cal = fs.readFileSync('cal.js', 'utf8');
const target2 = `document.getElementById('cal-body').innerHTML=html;`;
const rep2 = `
    if(calV === 'day' && typeof window.renderWorkerTasksForCal === 'function') {
      try {
        const ds=window.d2s(calD);
        html += window.renderWorkerTasksForCal(ds);
      } catch(e) { console.error('Error rendering worker tasks', e); }
    }
    document.getElementById('cal-body').innerHTML=html;`;

if (cal.includes(target2) && !cal.includes('renderWorkerTasksForCal')) {
    cal = cal.replace(target2, rep2);
    fs.writeFileSync('cal.js', cal);
    console.log('cal.js patched');
} else {
    console.log('cal.js target not found or already patched');
}
