import os

with open('worker_tasks.js', 'r', encoding='utf-8') as f:
    wt = f.read()

target = """window.renderWorkerTasksForCal = function(ds) {
  const tasks = (window.WORKER_TASKS || []).filter(t => !t.isAdminOnly && t.date === ds);
  if (tasks.length === 0) return '';
  
  let html = `<div style="margin-top:20px; background-color:#e3f2fd; border:2px dashed #90caf9; border-radius:8px; padding:15px; margin-bottom:20px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
    <h3 style="color:#1565c0; margin:0 0 10px 0; font-size:1.1rem;">👷 משימות שטח ליום זה (${tasks.length})</h3>`;
    
  tasks.forEach(t => {
    const gardenName = window.G ? (window.G(t.gardenId)?.name || '') : '';
    const city = window.G ? (window.G(t.gardenId)?.city || '') : '';
    const isDone = t.status === 'done';
    
    html += `
      <div style="background:#fff; border-radius:6px; padding:10px; margin-bottom:8px; border-right:4px solid ${isDone ? '#4caf50' : '#ff9800'}; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <strong style="font-size:0.95rem; ${isDone?'text-decoration:line-through;color:#888':''}"><span style="font-size:0.8rem; background:#f0f0f0; padding:2px 6px; border-radius:4px; margin-left:5px;">${city}</span> ${gardenName}</strong>
          <span style="font-size:0.8rem; font-weight:bold; color:${isDone ? '#4caf50' : '#ff9800'};">${isDone ? '✅ בוצע' : '⏳ ממתין'}</span>
        </div>
        <div style="font-size:0.9rem; color:#444; ${isDone?'text-decoration:line-through;opacity:0.7':''}">${t.desc.replace(/\n/g, '<br>')}</div>
        ${t.workerNote ? `<div style="margin-top:6px; font-size:0.8rem; background:#f5f7ff; color:#1565c0; padding:4px 8px; border-radius:4px;">💬 ${t.workerNote}</div>` : ''}
      </div>
    `;
  });
  
  html += `</div>`;
  return html;
};"""

rep = """window.wtExportWord = function(ds) {
  const tasks = (window.WORKER_TASKS || []).filter(t => !t.isAdminOnly && t.date === ds);
  let htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head>
    <meta charset='utf-8'>
    <title>משימות שטח</title>
    <style>
      @page WordSection1 { size: 148.5mm 210mm; margin: 15mm; }
      div.WordSection1 { page: WordSection1; direction: rtl; font-family: Arial, sans-serif; }
      h2 { color: #1565c0; text-align: center; }
      .task { border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 10px; display: flex; align-items: center; }
      .task-title { font-weight: bold; font-size: 14pt; margin-bottom: 5px; }
    </style>
  </head>
  <body>
    <div class='WordSection1'>
      <h2>משימות שטח - ${window.fD ? window.fD(ds) : ds}</h2>`;
      
  tasks.forEach(t => {
    const gardenName = window.G ? (window.G(t.gardenId)?.name || '') : '';
    htmlContent += `
      <div class="task">
        <div class="task-title">&#x25A2; ${gardenName} - ${t.desc.replace(/\n/g, ' ')}</div>
        ${t.workerNote ? `<div style="margin-top:5px; color:#444; font-size:12pt;">הערות: ${t.workerNote}</div>` : ''}
      </div>`;
  });
  
  htmlContent += `</div></body></html>`;
  
  const blob = new Blob(['\\ufeff', htmlContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `משימות_שטח_${ds}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

window.renderWorkerTasksForCal = function(ds) {
  const tasks = (window.WORKER_TASKS || []).filter(t => !t.isAdminOnly && t.date === ds);
  if (tasks.length === 0) return '';
  
  let html = `<div style="margin-top:20px; background-color:#e3f2fd; border:2px dashed #90caf9; border-radius:8px; padding:15px; margin-bottom:20px; box-shadow:0 2px 8px rgba(0,0,0,0.05);" class="no-print">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <h3 style="color:#1565c0; margin:0; font-size:1.1rem;">👷 משימות שטח ליום זה (${tasks.length})</h3>
      <button onclick="window.wtExportWord('${ds}')" class="btn" style="background:#2b579a; color:white; font-size:0.8rem; padding:4px 8px; border:none; border-radius:4px; cursor:pointer;">📥 הורד ל-Word (A5)</button>
    </div>`;
    
  tasks.forEach(t => {
    const gardenName = window.G ? (window.G(t.gardenId)?.name || '') : '';
    const isDone = t.status === 'done';
    
    html += `
      <div style="background:#fff; border-radius:6px; padding:10px; margin-bottom:8px; border-right:4px solid ${isDone ? '#4caf50' : '#ff9800'}; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:0.95rem; color:#444; ${isDone?'text-decoration:line-through;opacity:0.7':''}">
            <strong>${gardenName}</strong> - ${t.desc.replace(/\\n/g, ' ')}
          </div>
          <span style="font-size:0.8rem; font-weight:bold; color:${isDone ? '#4caf50' : '#ff9800'}; margin-right:10px; white-space:nowrap;">${isDone ? '✅ בוצע' : '⏳ ממתין'}</span>
        </div>
        ${t.workerNote ? `<div style="margin-top:6px; font-size:0.8rem; background:#f5f7ff; color:#1565c0; padding:4px 8px; border-radius:4px;">💬 ${t.workerNote}</div>` : ''}
      </div>
    `;
  });
  
  html += `</div>`;
  return html;
};"""

if target in wt:
    wt = wt.replace(target, rep)
    with open('worker_tasks.js', 'w', encoding='utf-8') as f:
        f.write(wt)
    print("worker_tasks.js patched successfully")
else:
    print("Target block not found in worker_tasks.js")
