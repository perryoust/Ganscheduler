import os

with open('worker_tasks.js', 'r', encoding='utf-8') as f:
    wt = f.read()

target = """      <!-- Diary View -->
      <div style="background-color:#fdf8e4; background-image: repeating-linear-gradient(transparent, transparent 39px, #e0e0e0 39px, #e0e0e0 40px); background-attachment: local; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.08); padding:20px 20px 80px 20px; padding-right:60px; min-height:400px; position:relative; border-right:2px solid #e57373; line-height: 40px;">
        <!-- Left red margin line -->
        <div style="position:absolute; right:45px; top:0; bottom:0; width:1px; background-color:#e57373; opacity:0.5;"></div>
        
        `;

  if (isSearch) {
    html += `<div style="color:#666; margin-bottom:15px; font-weight:bold;">🔍 תוצאות חיפוש עבור: "${window.wtSearchQuery}" (${displayTasks.length} תוצאות)</div>`;
  }

  if (displayTasks.length === 0) {
    html += `
      <div style="text-align:center; padding:50px; color:#999; font-size:1.2rem; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-style:italic;">
        דף חלק... אין משימות ${isSearch ? 'שתואמות לחיפוש' : 'ליום זה'}.
      </div>
    `;
  } else {
    displayTasks.forEach(t => {
      const gardenName = window.G ? (window.G(t.gardenId)?.name || 'גן לא ידוע') : 'גן לא ידוע';
      const city = window.G ? (window.G(t.gardenId)?.city || '') : '';
      const loc = city ? `${city} - ${gardenName}` : gardenName;
      
      const isDone = t.status === 'done';
      const isPriv = t.isAdminOnly;
      
      html += `
        <!-- Task Row -->
        <div style="display:flex; align-items:flex-start; padding:12px 0; border-bottom:1px solid #b3e5fc; position:relative;">
          <!-- Right Checkbox -->
          <div style="margin-left:15px; padding-top:2px;">
            <div onclick="window.wtToggleTaskStatus('${t.id}')" style="width:24px; height:24px; border:2px solid ${isDone ? '#4caf50' : '#999'}; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; background:${isDone ? '#e8f5e9' : 'white'};">
              ${isDone ? '<span style="color:#4caf50; font-weight:bold; font-size:1.1rem;">✓</span>' : ''}
            </div>
          </div>
          
          <!-- Content -->
          <div style="flex:1; ${isDone ? 'opacity:0.6; text-decoration:line-through;' : ''}">
            ${isSearch ? `<div style="font-size:0.75rem; color:#888; margin-bottom:2px;">${window.fD ? window.fD(t.date) : t.date}</div>` : ''}
            <div style="font-size:1.1rem; color:#333; font-family:sans-serif; margin-bottom:4px; line-height:1.4;">
              <strong>${loc}</strong> - ${t.desc.replace(/\\n/g, ' ')}
            </div>
            <div style="display:flex; align-items:center; gap:10px; font-size:0.85rem; color:#555;">
              ${isPriv ? '<span style="background:#ffe0b2; color:#e65100; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">🔒 אישי למנהל</span>' : ''}
              ${isDone && t.doneAt ? `<span style="color:#4caf50;">(בוצע: ${t.doneAt})</span>` : ''}
            </div>
            ${t.workerNote ? `<div style="margin-top:6px; font-size:0.85rem; color:#1565c0; background:rgba(227,242,253,0.5); padding:6px 10px; border-radius:6px; border-right:3px solid #64b5f6;">💬 פתק עובד: ${t.workerNote.replace(/</g, '&lt;')}</div>` : ''}
          </div>
          
          <!-- Left Actions -->
          <div style="margin-right:15px; padding-top:2px; z-index:10; display:flex; gap:8px;">
            <button onclick="window.wtAddNote('${t.id}')" style="background:transparent; color:#f57c00; border:none; cursor:pointer; font-size:1.1rem; opacity:0.8;" title="הוסף הערה">💬</button>
            <button onclick="window.wtMoveTaskDate('${t.id}')" style="background:transparent; color:#1565c0; border:none; cursor:pointer; font-size:1.1rem; opacity:0.7;" title="העבר תאריך">📅</button>
            <button onclick="window.deleteWorkerTask('${t.id}')" style="background:transparent; color:#ef5350; border:none; cursor:pointer; font-size:1.1rem; opacity:0.6;" title="מחק משימה">🗑️</button>
          </div>
        </div>
      `;
    });
  }"""

rep = """      <!-- To Do List View -->
      <div style="background-color:#fafafa; border-radius:8px; padding:20px; padding-bottom:80px; min-height:400px; position:relative; box-shadow:inset 0 2px 4px rgba(0,0,0,0.02);">
        
        `;

  if (isSearch) {
    html += `<div style="color:#666; margin-bottom:15px; font-weight:bold;">🔍 תוצאות חיפוש עבור: "${window.wtSearchQuery}" (${displayTasks.length} תוצאות)</div>`;
  }

  if (displayTasks.length === 0) {
    html += `
      <div style="text-align:center; padding:50px; color:#999; font-size:1.2rem; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        אין משימות ${isSearch ? 'שתואמות לחיפוש' : 'ליום זה'}.
      </div>
    `;
  } else {
    // Split into pending and done
    const pending = displayTasks.filter(t => t.status !== 'done');
    const doneTasks = displayTasks.filter(t => t.status === 'done');
    
    // Render Pending
    pending.forEach(t => {
      const gardenName = window.G ? (window.G(t.gardenId)?.name || 'גן לא ידוע') : 'גן לא ידוע';
      const city = window.G ? (window.G(t.gardenId)?.city || '') : '';
      const loc = city ? `${city} - ${gardenName}` : gardenName;
      const isPriv = t.isAdminOnly;
      
      html += `
        <!-- Task Row -->
        <div style="background:#fff; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.08); margin-bottom:10px; display:flex; align-items:flex-start; padding:12px; position:relative;">
          <!-- Right Checkbox -->
          <div style="margin-left:15px; padding-top:2px;">
            <div onclick="window.wtToggleTaskStatus('${t.id}')" style="width:26px; height:26px; border:2px solid #8e8e93; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; background:white; box-sizing:border-box;"></div>
          </div>
          
          <!-- Content -->
          <div style="flex:1;">
            ${isSearch ? `<div style="font-size:0.75rem; color:#888; margin-bottom:2px;">${window.fD ? window.fD(t.date) : t.date}</div>` : ''}
            <div style="font-size:1.1rem; color:#1c1c1e; line-height:1.3; margin-bottom:4px;">
              <strong>${loc}</strong> - ${t.desc.replace(/\\n/g, ' ')}
            </div>
            <div style="display:flex; align-items:center; gap:10px; font-size:0.85rem; color:#8e8e93;">
              ${isPriv ? '<span style="background:#ffe0b2; color:#e65100; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">🔒 אישי למנהל</span>' : ''}
            </div>
            ${t.workerNote ? `<div style="margin-top:6px; font-size:0.85rem; color:#1565c0; background:#e3f2fd; padding:6px 10px; border-radius:6px; border-right:3px solid #64b5f6;">💬 פתק עובד: ${t.workerNote.replace(/</g, '&lt;')}</div>` : ''}
          </div>
          
          <!-- Left Actions -->
          <div style="margin-right:15px; padding-top:2px; z-index:10; display:flex; gap:8px;">
            <button onclick="window.wtAddNote('${t.id}')" style="background:transparent; color:#f57c00; border:none; cursor:pointer; font-size:1.1rem; opacity:0.8;" title="הוסף הערה">💬</button>
            <button onclick="window.wtMoveTaskDate('${t.id}')" style="background:transparent; color:#1565c0; border:none; cursor:pointer; font-size:1.1rem; opacity:0.7;" title="העבר תאריך">📅</button>
            <button onclick="window.deleteWorkerTask('${t.id}')" style="background:transparent; color:#ef5350; border:none; cursor:pointer; font-size:1.1rem; opacity:0.6;" title="מחק משימה">🗑️</button>
          </div>
        </div>
      `;
    });
    
    // Render Done
    if (doneTasks.length > 0) {
      html += `
        <div style="margin-top:25px; margin-bottom:10px; display:inline-flex; align-items:center; background:#e0e0e0; padding:4px 12px; border-radius:12px; font-size:0.9rem; color:#555; font-weight:bold; cursor:pointer;" onclick="const d=document.getElementById('wt-admin-completed'); d.style.display=d.style.display==='none'?'block':'none';">
          <span style="transform:rotate(90deg); margin-left:6px;">&#10095;</span> הושלמו (${doneTasks.length})
        </div>
        <div id="wt-admin-completed" style="display:none;">
      `;
      doneTasks.forEach(t => {
        const gardenName = window.G ? (window.G(t.gardenId)?.name || 'גן לא ידוע') : 'גן לא ידוע';
        const city = window.G ? (window.G(t.gardenId)?.city || '') : '';
        const loc = city ? `${city} - ${gardenName}` : gardenName;
        const isPriv = t.isAdminOnly;
        html += `
          <div style="background:#fff; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05); margin-bottom:10px; display:flex; align-items:flex-start; padding:12px; position:relative; opacity:0.7;">
            <div style="margin-left:15px; padding-top:2px;">
              <div onclick="window.wtToggleTaskStatus('${t.id}')" style="width:26px; height:26px; border:2px solid #1565c0; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; background:#1565c0; box-sizing:border-box;">
                <span style="color:white; font-weight:bold; font-size:0.9rem;">✓</span>
              </div>
            </div>
            
            <div style="flex:1;">
              ${isSearch ? `<div style="font-size:0.75rem; color:#888; margin-bottom:2px;">${window.fD ? window.fD(t.date) : t.date}</div>` : ''}
              <div style="font-size:1.1rem; color:#8e8e93; text-decoration:line-through; line-height:1.3; margin-bottom:4px;">
                <strong>${loc}</strong> - ${t.desc.replace(/\\n/g, ' ')}
              </div>
              <div style="display:flex; align-items:center; gap:10px; font-size:0.85rem; color:#8e8e93;">
                ${isPriv ? '<span style="background:#ffe0b2; color:#e65100; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">🔒 אישי למנהל</span>' : ''}
                ${t.doneAt ? `<span>(בוצע: ${t.doneAt})</span>` : ''}
              </div>
              ${t.workerNote ? `<div style="margin-top:6px; font-size:0.85rem; color:#1565c0; background:#e3f2fd; padding:6px 10px; border-radius:6px;">💬 פתק עובד: ${t.workerNote.replace(/</g, '&lt;')}</div>` : ''}
            </div>
            
            <div style="margin-right:15px; padding-top:2px; z-index:10; display:flex; gap:8px;">
              <button onclick="window.deleteWorkerTask('${t.id}')" style="background:transparent; color:#ef5350; border:none; cursor:pointer; font-size:1.1rem; opacity:0.6;" title="מחק משימה">🗑️</button>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }
  }"""

if target in wt:
    wt = wt.replace(target, rep)
    with open('worker_tasks.js', 'w', encoding='utf-8') as f:
        f.write(wt)
    print("worker_tasks.js Admin UI patched to Microsoft To-Do style")
else:
    print("Target block not found in worker_tasks.js")
