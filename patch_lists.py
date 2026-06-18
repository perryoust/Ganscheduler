import os

with open('worker_tasks.js', 'r', encoding='utf-8') as f:
    content = f.read()

# For renderWorkerTasksAdmin
admin_pending_render_start = """    // Render Pending
    pending.forEach(t => {"""

admin_render_replacement = """    // Render Pending then Done together
    const allSortedTasks = [...pending, ...doneTasks];
    allSortedTasks.forEach(t => {
      const isDone = t.status === 'done';
      const gardenName = t.gardenId ? (window.G ? (window.G(t.gardenId)?.name || '') : '') : '';
      const city = t.gardenId ? (window.G ? (window.G(t.gardenId)?.city || '') : '') : (t.city || '');
      const loc = t.gardenId ? (city ? `${city} - ${gardenName}` : gardenName) : (city || 'משימה כללית');
      const isPriv = t.isAdminOnly;
      
      html += `
        <!-- Task Row -->
        <div draggable="true" 
             ondragstart="event.dataTransfer.setData('text/plain', '${t.id}'); this.style.opacity='0.4';" 
             ondragend="this.style.opacity='1';"
             ondragover="event.preventDefault(); this.style.borderTop='2px dashed #1565c0';" 
             ondragleave="this.style.borderTop='none';" 
             ondrop="event.preventDefault(); this.style.borderTop='none'; const draggedId=event.dataTransfer.getData('text/plain'); if(window.wtOnDropTask) window.wtOnDropTask(draggedId, '${t.id}');"
             style="background:#fff; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.08); margin-bottom:10px; display:flex; align-items:flex-start; padding:12px; position:relative; cursor:grab; transition: border 0.2s; ${isDone ? 'opacity:0.85;' : ''}">
          
          <!-- Drag Handle -->
          <div style="margin-left:10px; padding-top:4px; color:#ccc; cursor:grab; font-size:1.2rem;" title="גרור כדי לשנות סדר">
            ☰
          </div>

          <!-- Right Checkbox -->
          <div style="margin-left:15px; padding-top:2px;">
            <div onclick="window.wtToggleTaskStatus('${t.id}')" style="width:26px; height:26px; border:2px solid ${isDone ? '#4caf50' : '#8e8e93'}; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; background:white; box-sizing:border-box;">
              ${isDone ? '<span style="color:#4caf50; font-weight:bold; font-size:1.1rem;">✓</span>' : ''}
            </div>
          </div>
          
          <!-- Content -->
          <div style="flex:1;">
            ${isSearch ? `<div style="font-size:0.75rem; color:#888; margin-bottom:2px;">${window.fD ? window.fD(t.date) : t.date}</div>` : ''}
            <div style="font-size:1.1rem; color:${isDone ? '#666' : '#1c1c1e'}; line-height:1.3; margin-bottom:4px;">
              <strong>${loc}</strong> - ${t.desc.replace(/\\n/g, ' ')}
            </div>
            <div style="display:flex; align-items:center; gap:10px; font-size:0.85rem; color:#8e8e93;">
              ${isPriv ? '<span style="background:#ffe0b2; color:#e65100; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">🔒 אישי למנהל</span>' : ''}
              ${isDone && t.doneAt ? `<span style="font-size:0.85rem; color:#4caf50; font-weight:bold;">(בוצע ע"י ${t.doneBy || 'עובד'} ב-${t.doneAt})</span>` : ''}
            </div>
            ${t.workerNote ? `<div style="margin-top:6px; font-size:0.85rem; color:#1565c0; background:#e3f2fd; padding:6px 10px; border-radius:6px; border-right:3px solid #64b5f6;">💬 הערות ${t.workerName || 'עובד'}: ${t.workerNote.replace(/</g, '&lt;')}</div>` : ''}
          </div>
          
          <!-- Left Actions -->
          <div style="margin-right:15px; padding-top:2px; z-index:10; display:flex; flex-direction:column; gap:4px; justify-content:flex-start;">
            <div style="display:flex; gap:8px; justify-content:flex-end;">
              <button onclick="window.wtEditTaskDesc('${t.id}')" style="background:transparent; color:#8e24aa; border:none; cursor:pointer; font-size:1.1rem; opacity:0.8;" title="ערוך משימה">✏️</button>
              <button onclick="window.wtAddNote('${t.id}')" style="background:transparent; color:#f57c00; border:none; cursor:pointer; font-size:1.1rem; opacity:0.8;" title="הוסף הערה">💬</button>
              <button onclick="window.wtMoveTaskDate('${t.id}')" style="background:transparent; color:#1565c0; border:none; cursor:pointer; font-size:1.1rem; opacity:0.7;" title="העבר תאריך">📅</button>
              <button onclick="window.deleteWorkerTask('${t.id}')" style="background:transparent; color:#ef5350; border:none; cursor:pointer; font-size:1.1rem; opacity:0.6;" title="מחק משימה">🗑️</button>
            </div>
          </div>
        </div>
      `;
    });"""

# We need to find where `// Render Done` starts, and remove it up to the end of `renderWorkerTasksAdmin`.
# Let's use regex or split.
start_idx = content.find("    // Render Pending\n    pending.forEach(t => {")
end_idx = content.find("  document.getElementById('main-content').innerHTML = html;")

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + admin_render_replacement + '\n    ' + content[end_idx:]


# For renderWorkerTasksMobile
mobile_pending_render_start = """    pending.forEach(t => {"""
mobile_render_replacement = """    const allSortedTasks = [...pending, ...done];
    allSortedTasks.forEach(t => {
      const isDone = t.status === 'done';
      const gardenName = t.gardenId ? (window.G ? (window.G(t.gardenId)?.name || '') : '') : (t.city ? t.city : 'משימה כללית');
      const city = window.G ? (window.G(t.gardenId)?.city || '') : '';
      const address = window.G ? (window.G(t.gardenId)?.address || '') : '';
      
      html += `
        <div style="background:#fff; border-radius:8px; padding:12px; margin-bottom:8px; box-shadow:0 1px 3px rgba(0,0,0,0.15); ${isDone ? 'opacity:0.85;' : ''}">
          <div style="display:flex; align-items:flex-start; gap:12px;">
            <!-- Circle Checkbox -->
            <div onclick="${isDone ? 'window.wtToggleTaskStatus(\\'' + t.id + '\\')' : 'window.markTaskDone(\\'' + t.id + '\\')'}" style="width:26px; height:26px; margin-top:2px; border:2px solid ${isDone ? '#4caf50' : '#8e8e93'}; border-radius:50%; flex-shrink:0; cursor:pointer; box-sizing:border-box; display:flex; align-items:center; justify-content:center; background:white;">
               ${isDone ? '<span style="color:#4caf50; font-weight:bold; font-size:1.1rem;">✓</span>' : ''}
            </div>
            
            <!-- Task Text -->
            <div style="flex:1;">
              <div style="font-size:1.1rem; color:${isDone ? '#666' : '#1c1c1e'}; margin-bottom:2px; line-height:1.3;">
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
    });"""

start_idx_mob = content.find("    pending.forEach(t => {\n      const gardenName")
end_idx_mob = content.find("  document.getElementById('mobile-app').innerHTML = html;")

if start_idx_mob != -1 and end_idx_mob != -1:
    content = content[:start_idx_mob] + mobile_render_replacement + '\n    ' + content[end_idx_mob:]

with open('worker_tasks.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
