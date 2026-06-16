import os

with open('worker_tasks.js', 'r', encoding='utf-8') as f:
    wt = f.read()

target = """    html += `<div style="font-weight:bold; color:#1565c0; margin-bottom:10px; font-size:1.1rem;">ממתין לביצוע (${pending.length})</div>`;
    pending.forEach(t => {
      const gardenName = window.G ? (window.G(t.gardenId)?.name || 'גן לא ידוע') : 'גן לא ידוע';
      const city = window.G ? (window.G(t.gardenId)?.city || '') : '';
      const address = window.G ? (window.G(t.gardenId)?.address || '') : '';
      
      const dateStr = window.fD ? window.fD(t.date) : t.date;
      
      html += `
        <div style="background:#fff; border-radius:16px; padding:16px; margin-bottom:15px; box-shadow:0 4px 12px rgba(0,0,0,0.06); border-right:5px solid #ff9800; position:relative;">
          <div style="font-size:0.8rem; color:#666; margin-bottom:5px;">📅 ${dateStr}</div>
          <div style="font-size:1.1rem; font-weight:bold; color:#2c3e50; margin-bottom:4px;">${city} - ${gardenName}</div>
          ${address ? `<div style="font-size:0.85rem; color:#7f8c8d; margin-bottom:10px;">📍 ${address}</div>` : ''}
          
          <div style="background:#f8f9fa; padding:10px; border-radius:8px; font-size:0.95rem; color:#34495e; border:1px solid #eee; margin-bottom:15px;">
            ${t.desc.replace(/\\n/g, '<br>')}
          </div>
          
          <textarea id="wt-note-${t.id}" onchange="window.wtSaveNote('${t.id}', this.value)" placeholder="הערות למשימה (אופציונלי)... נשמר אוטומטית" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box; resize:vertical; font-family:inherit; margin-bottom:10px; font-size:0.9rem;">${t.workerNote || ''}</textarea>

          <button onclick="window.markTaskDone('${t.id}')" style="width:100%; background:linear-gradient(135deg, #4caf50, #2e7d32); color:white; border:none; border-radius:10px; padding:12px; font-size:1.1rem; font-weight:bold; cursor:pointer; box-shadow:0 4px 10px rgba(76,175,80,0.3); display:flex; justify-content:center; align-items:center; gap:8px;">
            <span>סיים משימה</span> <span style="font-size:1.2rem">✅</span>
          </button>
        </div>
      `;
    });
  }
  
  if (done.length > 0) {
    html += `<div style="font-weight:bold; color:#7f8c8d; margin-top:30px; margin-bottom:10px; font-size:1rem;">משימות שהושלמו לאחרונה</div>`;
    // Only show last 10 done tasks
    done.slice(0, 10).forEach(t => {
      const gardenName = window.G ? (window.G(t.gardenId)?.name || '') : '';
      const city = window.G ? (window.G(t.gardenId)?.city || '') : '';
      html += `
        <div style="background:#f8f9fa; border-radius:12px; padding:12px; margin-bottom:10px; opacity:0.8; border:1px solid #eee; border-right:4px solid #4caf50;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:bold; font-size:0.9rem; color:#2c3e50; text-decoration:line-through;">${city} - ${gardenName}</div>
            <div style="font-size:0.75rem; color:#4caf50; font-weight:bold;">${t.doneAt ? t.doneAt.split(' ')[1] || t.doneAt : ''} ✅</div>
          </div>
          ${t.workerNote ? `<div style="margin-top:8px; font-size:0.85rem; color:#1565c0; background:#e3f2fd; padding:6px 10px; border-radius:6px;">💬 ${t.workerNote.replace(/</g, '&lt;')}</div>` : ''}
        </div>
      `;
    });
  }"""

rep = """    html += `<div style="font-weight:bold; color:#fff; margin-bottom:10px; font-size:1.8rem; text-shadow:0 1px 2px rgba(0,0,0,0.2);">המשימות שלי</div>`;
    pending.forEach(t => {
      const gardenName = window.G ? (window.G(t.gardenId)?.name || 'גן לא ידוע') : 'גן לא ידוע';
      const city = window.G ? (window.G(t.gardenId)?.city || '') : '';
      const address = window.G ? (window.G(t.gardenId)?.address || '') : '';
      
      html += `
        <div style="background:#fff; border-radius:8px; padding:12px; margin-bottom:8px; box-shadow:0 1px 3px rgba(0,0,0,0.15);">
          <div style="display:flex; align-items:flex-start; gap:12px;">
            <!-- Circle Checkbox -->
            <div onclick="window.markTaskDone('${t.id}')" style="width:26px; height:26px; margin-top:2px; border:2px solid #8e8e93; border-radius:50%; flex-shrink:0; cursor:pointer; box-sizing:border-box;"></div>
            
            <!-- Task Text -->
            <div style="flex:1;">
              <div style="font-size:1.1rem; color:#1c1c1e; margin-bottom:2px; line-height:1.3;">
                ${gardenName} - ${t.desc.replace(/\\n/g, ' ')}
              </div>
              <div style="font-size:0.85rem; color:#8e8e93; display:flex; gap:8px;">
                <span>${city}</span>
                ${address ? `<span>&#8226; 📍 ${address}</span>` : ''}
              </div>
              <textarea id="wt-note-${t.id}" onchange="window.wtSaveNote('${t.id}', this.value)" placeholder="הוסף הערה..." style="width:100%; padding:4px 0; border:none; border-bottom:1px solid #f0f0f0; background:transparent; box-sizing:border-box; resize:none; font-family:inherit; margin-top:6px; font-size:0.9rem; color:#1565c0;">${t.workerNote || ''}</textarea>
            </div>
            
            <!-- Star Icon -->
            <div style="color:#d1d1d6; font-size:1.4rem; padding-top:2px;">&#9734;</div>
          </div>
        </div>
      `;
    });
  }
  
  if (done.length > 0) {
    html += `
      <div style="margin-top:20px; margin-bottom:10px;">
        <div style="display:inline-flex; align-items:center; background:rgba(255,255,255,0.2); padding:4px 10px; border-radius:6px; font-size:0.9rem; color:#fff; font-weight:bold; cursor:pointer;" onclick="const d=document.getElementById('wt-completed'); d.style.display=d.style.display==='none'?'block':'none';">
          <span style="transform:rotate(90deg); margin-left:6px;">&#10095;</span> הושלמו (${done.length})
        </div>
      </div>
      <div id="wt-completed" style="display:none;">
    `;
    // Only show last 20 done tasks
    done.slice(0, 20).forEach(t => {
      const gardenName = window.G ? (window.G(t.gardenId)?.name || '') : '';
      const city = window.G ? (window.G(t.gardenId)?.city || '') : '';
      html += `
        <div style="background:#fff; border-radius:8px; padding:12px; margin-bottom:8px; opacity:0.8; box-shadow:0 1px 2px rgba(0,0,0,0.1);">
          <div style="display:flex; align-items:flex-start; gap:12px;">
            <!-- Checked Circle -->
            <div onclick="window.wtToggleTaskStatus('${t.id}')" style="width:26px; height:26px; margin-top:2px; background:#1565c0; border:2px solid #1565c0; border-radius:50%; flex-shrink:0; cursor:pointer; box-sizing:border-box; display:flex; justify-content:center; align-items:center; color:white; font-size:14px;">&#10003;</div>
            
            <div style="flex:1;">
              <div style="font-size:1.1rem; color:#8e8e93; text-decoration:line-through; margin-bottom:2px; line-height:1.3;">
                ${gardenName} - ${t.desc.replace(/\\n/g, ' ')}
              </div>
              <div style="font-size:0.85rem; color:#8e8e93; display:flex; gap:8px;">
                <span>${city}</span>
                <span>&#8226; ${t.doneAt ? t.doneAt.split(' ')[1] || t.doneAt : ''}</span>
              </div>
              ${t.workerNote ? `<div style="margin-top:4px; font-size:0.85rem; color:#1565c0;">💬 ${t.workerNote.replace(/</g, '&lt;')}</div>` : ''}
            </div>
            
            <div style="color:#d1d1d6; font-size:1.4rem; padding-top:2px;">&#9734;</div>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }"""

if target in wt:
    wt = wt.replace(target, rep)
    with open('worker_tasks.js', 'w', encoding='utf-8') as f:
        f.write(wt)
    print("worker_tasks.js patched successfully")
else:
    print("Target block not found in worker_tasks.js")
