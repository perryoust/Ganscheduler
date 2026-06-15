/**
 * Field Worker Tasks Module (worker_tasks.js)
 * Handles both Admin UI (managing tasks) and Worker UI (viewing/completing tasks)
 */

window.initWorkerTasks = function() {
  if (!window.WORKER_TASKS) window.WORKER_TASKS = [];
  
  // Inject the Admin UI container if it doesn't exist
  if (!document.getElementById('c-worker_tasks')) {
    const container = document.createElement('div');
    container.id = 'c-worker_tasks';
    container.className = 'content';
    container.style.display = 'none';
    
    // Add the UI HTML
    container.innerHTML = `
      <div style="max-width:800px; margin:0 auto; padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h2 style="color:#1565c0; margin:0; font-size:1.5rem;">👷 ניהול משימות לשטח</h2>
          <button onclick="window.openNewWorkerTaskModal()" style="background:#4caf50; color:white; border:none; border-radius:8px; padding:10px 16px; font-weight:bold; cursor:pointer;">+ משימה חדשה</button>
        </div>
        
        <div id="worker-tasks-admin-list" style="background:#fff; border-radius:12px; padding:15px; box-shadow:0 4px 15px rgba(0,0,0,0.05);">
          <!-- Admin task list will be rendered here -->
        </div>
      </div>
    `;
    
    // Append to main container (assuming it's body or a specific wrapper)
    const mainContainer = document.querySelector('.content').parentNode;
    mainContainer.appendChild(container);
  }
  
  // Inject the specific Worker App Container (Hidden by default)
  if (!document.getElementById('worker-app-root')) {
    const workerApp = document.createElement('div');
    workerApp.id = 'worker-app-root';
    workerApp.style.display = 'none';
    workerApp.style.position = 'fixed';
    workerApp.style.inset = '0';
    workerApp.style.backgroundColor = '#f5f7ff';
    workerApp.style.zIndex = '100000'; // Above everything else
    workerApp.style.overflowY = 'auto';
    workerApp.innerHTML = `
      <div style="background:linear-gradient(135deg, #1565c0, #1a237e); color:white; padding:15px; text-align:center; position:sticky; top:0; box-shadow:0 2px 10px rgba(0,0,0,0.2); z-index:10; display:flex; justify-content:space-between; align-items:center;">
        <div style="font-weight:bold; font-size:1.2rem;">👷 המשימות שלי</div>
        <button onclick="location.reload()" style="background:rgba(255,255,255,0.2); border:none; border-radius:6px; color:white; padding:6px 12px; font-size:0.8rem; cursor:pointer;">רענן 🔄</button>
      </div>
      <div id="worker-tasks-mobile-list" style="padding:15px; padding-bottom:50px;">
        <!-- Worker list rendered here -->
      </div>
    `;
    document.body.appendChild(workerApp);
  }
};

window.renderWorkerTasksAdmin = function() {
  const container = document.getElementById('worker-tasks-admin-list');
  if (!container) return;
  
  const tasks = window.WORKER_TASKS || [];
  
  if (tasks.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:#666;">אין משימות מוגדרות כרגע.</div>`;
    return;
  }
  
  // Sort tasks by date (newest first) and then by status (pending first)
  const sorted = [...tasks].sort((a,b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    return b.date.localeCompare(a.date);
  });
  
  let html = `<table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
    <thead>
      <tr style="background:#e3f2fd; color:#1565c0; text-align:right;">
        <th style="padding:10px; border-radius:0 8px 8px 0;">תאריך</th>
        <th style="padding:10px;">מיקום / גן</th>
        <th style="padding:10px;">תיאור משימה</th>
        <th style="padding:10px;">סטטוס</th>
        <th style="padding:10px; border-radius:8px 0 0 0;">פעולות</th>
      </tr>
    </thead>
    <tbody>`;
    
  sorted.forEach(t => {
    const gardenName = window.G ? (window.G(t.gardenId)?.name || 'גן לא ידוע') : 'גן לא ידוע';
    const city = window.G ? (window.G(t.gardenId)?.city || '') : '';
    const loc = city ? `${city} - ${gardenName}` : gardenName;
    
    const isDone = t.status === 'done';
    const statusHtml = isDone 
      ? `<span style="background:#c8e6c9; color:#2e7d32; padding:3px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">בוצע (ב-${t.doneAt || ''})</span>`
      : `<span style="background:#fff3e0; color:#e65100; padding:3px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">ממתין לביצוע</span>`;
      
    html += `
      <tr style="border-bottom:1px solid #f0f0f0; ${isDone ? 'opacity:0.7' : ''}">
        <td style="padding:12px 10px;">${window.fD ? window.fD(t.date) : t.date}</td>
        <td style="padding:12px 10px; font-weight:bold;">${loc}</td>
        <td style="padding:12px 10px;">${t.desc}</td>
        <td style="padding:12px 10px;">
          ${statusHtml}
          ${t.workerNote ? `<div style="margin-top:5px; font-size:0.8rem; color:#666; background:#f5f5f5; padding:4px 8px; border-radius:4px; max-width:200px; word-wrap:break-word;">💬 ${t.workerNote.replace(/</g, '&lt;')}</div>` : ''}
        </td>
        <td style="padding:12px 10px;">
          <button onclick="window.deleteWorkerTask('${t.id}')" style="background:#ffebee; color:#c62828; border:1px solid #ffcdd2; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:0.8rem;">מחק</button>
        </td>
      </tr>
    `;
  });
  
  html += `</tbody></table>`;
  container.innerHTML = html;
};

window.openNewWorkerTaskModal = function() {
  const modalHtml = `
    <div style="margin-bottom:15px;">
      <label style="display:block; font-size:0.8rem; color:#666; margin-bottom:5px;">תאריך היעד</label>
      <input type="date" id="wt-date" value="${window.td ? window.td() : ''}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;">
    </div>
    <div style="margin-bottom:15px;">
      <label style="display:block; font-size:0.8rem; color:#666; margin-bottom:5px;">גן / בית ספר (הזן מספר או שם)</label>
      <input type="text" id="wt-garden-search" placeholder="חפש גן..." onkeyup="window.wtSearchGarden(this.value)" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box; margin-bottom:5px;">
      <div id="wt-garden-results" style="max-height:120px; overflow-y:auto; border:1px solid #eee; border-radius:4px; background:#fafafa; padding:5px; display:none;"></div>
      <input type="hidden" id="wt-garden-id" value="">
    </div>
    <div style="margin-bottom:15px;">
      <label style="display:block; font-size:0.8rem; color:#666; margin-bottom:5px;">תיאור המשימה (מה עליו לעשות?)</label>
      <textarea id="wt-desc" rows="3" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box; resize:vertical; font-family:inherit;"></textarea>
    </div>
  `;
  
  if (window.spPromptDialog) {
    window.spPromptDialog('יצירת משימת שטח חדשה', modalHtml, 'שמור משימה', () => {
      const date = document.getElementById('wt-date').value;
      const gardenId = document.getElementById('wt-garden-id').value;
      const desc = document.getElementById('wt-desc').value.trim();
      
      if (!date || !gardenId || !desc) {
        if (window.showToast) window.showToast('נא למלא תאריך, גן ותיאור למשימה', true);
        return false; // Prevent closing
      }
      
      window.WORKER_TASKS.push({
        id: 'wt_' + Date.now(),
        date: date,
        gardenId: parseInt(gardenId),
        desc: desc,
        status: 'pending',
        doneAt: null
      });
      
      if (window.save) window.save(true);
      window.renderWorkerTasksAdmin();
      if (window.showToast) window.showToast('המשימה נוספה בהצלחה');
      return true; // Close dialog
    }, true); // true for wide dialog
  } else {
    // Fallback if spPromptDialog not available
    const date = prompt("תאריך (YYYY-MM-DD):", window.td ? window.td() : '');
    if (!date) return;
    const gardenId = prompt("מזהה הגן (מספר):");
    if (!gardenId) return;
    const desc = prompt("תיאור המשימה:");
    if (!desc) return;
    
    window.WORKER_TASKS.push({
      id: 'wt_' + Date.now(),
      date: date,
      gardenId: parseInt(gardenId),
      desc: desc,
      status: 'pending',
      doneAt: null
    });
    
    if (window.save) window.save(true);
    window.renderWorkerTasksAdmin();
  }
};

window.wtSearchGarden = function(q) {
  const resEl = document.getElementById('wt-garden-results');
  if (!q || q.length < 2) {
    resEl.style.display = 'none';
    return;
  }
  
  const gardens = window.GARDENS || [];
  const results = gardens.filter(g => 
    String(g.id).includes(q) || 
    (g.name && g.name.includes(q)) || 
    (g.city && g.city.includes(q))
  ).slice(0, 10); // Limit to 10
  
  if (results.length === 0) {
    resEl.innerHTML = '<div style="color:#999; font-size:0.8rem; text-align:center;">לא נמצאו גנים</div>';
  } else {
    resEl.innerHTML = results.map(g => `
      <div onclick="document.getElementById('wt-garden-id').value='${g.id}'; document.getElementById('wt-garden-search').value='${g.city||''} - ${g.name}'; document.getElementById('wt-garden-results').style.display='none';" 
           style="padding:6px; border-bottom:1px solid #eee; cursor:pointer; font-size:0.85rem;">
        <b>${g.id}</b> | ${g.city||''} - ${g.name}
      </div>
    `).join('');
  }
  resEl.style.display = 'block';
};

window.deleteWorkerTask = function(id) {
  if (confirm('האם אתה בטוח שברצונך למחוק משימה זו?')) {
    window.WORKER_TASKS = window.WORKER_TASKS.filter(t => t.id !== id);
    if (window.save) window.save(true);
    window.renderWorkerTasksAdmin();
  }
};

// ==========================================
// WORKER APP UI (MOBILE)
// ==========================================

window.activateWorkerApp = function() {
  // Hide main UI
  const mainApp = document.getElementById('main-app') || document.querySelector('.main-app');
  if (mainApp) mainApp.style.display = 'none';
  const header = document.querySelector('header') || document.querySelector('.top-header');
  if (header) header.style.display = 'none';
  
  // Show Worker UI
  const workerApp = document.getElementById('worker-app-root');
  if (workerApp) {
    workerApp.style.display = 'block';
    window.renderWorkerTasksMobile();
  }
};

window.renderWorkerTasksMobile = function() {
  const container = document.getElementById('worker-tasks-mobile-list');
  if (!container) return;
  
  const tasks = window.WORKER_TASKS || [];
  const pending = tasks.filter(t => t.status === 'pending');
  const done = tasks.filter(t => t.status === 'done');
  
  // Sort pending by date
  pending.sort((a,b) => a.date.localeCompare(b.date));
  // Sort done by completion time (newest first)
  done.sort((a,b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
  
  let html = '';
  
  if (pending.length === 0) {
    html += `
      <div style="text-align:center; padding:40px 20px; background:#fff; border-radius:16px; box-shadow:0 4px 15px rgba(0,0,0,0.05); margin-bottom:20px;">
        <div style="font-size:3rem; margin-bottom:10px;">🎉</div>
        <div style="font-size:1.2rem; color:#1565c0; font-weight:bold;">אין משימות פתוחות!</div>
        <div style="color:#666; font-size:0.9rem; margin-top:5px;">כל המשימות שלך הושלמו.</div>
      </div>
    `;
  } else {
    html += `<div style="font-weight:bold; color:#1565c0; margin-bottom:10px; font-size:1.1rem;">ממתין לביצוע (${pending.length})</div>`;
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
            ${t.desc.replace(/\n/g, '<br>')}
          </div>
          
          <textarea id="wt-note-${t.id}" placeholder="הערות לביצוע (אופציונלי)..." style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box; resize:vertical; font-family:inherit; margin-bottom:10px; font-size:0.9rem;"></textarea>

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
        <div style="background:#f8f9fa; border-radius:12px; padding:12px; margin-bottom:10px; opacity:0.8; border:1px solid #eee;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:bold; font-size:0.9rem; color:#2c3e50; text-decoration:line-through;">${city} - ${gardenName}</div>
            <div style="font-size:0.75rem; color:#4caf50; font-weight:bold;">בוצע ב-${t.doneAt.split(' ')[1] || t.doneAt}</div>
          </div>
        </div>
      `;
    });
  }
  
  // Logout button at bottom
  html += `
    <div style="margin-top:40px; text-align:center;">
      <button onclick="window.workerLogout()" style="background:transparent; color:#95a5a6; border:1px solid #ccc; border-radius:20px; padding:8px 20px; font-size:0.9rem;">התנתק מהמערכת</button>
    </div>
  `;
  
  container.innerHTML = html;
};

window.markTaskDone = function(id) {
  const task = (window.WORKER_TASKS || []).find(t => t.id === id);
  if (task) {
    task.status = 'done';
    const noteEl = document.getElementById('wt-note-' + id);
    if (noteEl) {
      task.workerNote = noteEl.value.trim();
    }
    const now = new Date();
    const dStr = window.td ? window.td() : now.toISOString().split('T')[0];
    const tStr = now.toTimeString().split(' ')[0].substring(0, 5);
    task.doneAt = `${dStr} ${tStr}`;
    
    // Play sound or vibration if possible
    if (navigator.vibrate) navigator.vibrate(50);
    
    // Save to Firebase immediately
    if (window.save) {
      window.save(true);
      // Wait a moment for save, then re-render
      setTimeout(() => {
        window.renderWorkerTasksMobile();
        // Also update admin UI if it happens to be open
        if (typeof window.renderWorkerTasksAdmin === 'function') window.renderWorkerTasksAdmin();
      }, 300);
    } else {
      window.renderWorkerTasksMobile();
    }
  }
};

window.workerLogout = function() {
  // Clear remember me
  if (window._safeLS) window._safeLS.removeItem('ganv5_auth_user');
  location.reload();
};

// Hook into ST (Switch Tab) globally
const originalST = window.ST;
window.ST = function(tab) {
  if (tab === 'worker_tasks') {
    // Hide original content wrapper and tab bars
    const c = document.querySelector('.content');
    if (c) c.style.display = 'none';
    document.querySelectorAll('.tabs').forEach(el => el.style.display = 'none');
    
    const wt = document.getElementById('c-worker_tasks');
    if (wt) wt.style.display = 'block';
    
    // Update mode buttons
    document.getElementById('modeBtn-act').classList.remove('active');
    document.getElementById('modeBtn-purch').classList.remove('active');
    const adminBtn = document.getElementById('modeBtn-admin');
    if (adminBtn) adminBtn.classList.remove('active');
    
    const workerBtn = document.getElementById('modeBtn-worker');
    if (workerBtn) workerBtn.classList.add('active');
    
    window.renderWorkerTasksAdmin();
    return;
  }
  
  // If switching to something else, restore content
  const c = document.querySelector('.content');
  if(c) c.style.display = '';
  const wt = document.getElementById('c-worker_tasks');
  if(wt) wt.style.display = 'none';
  
  const workerBtn = document.getElementById('modeBtn-worker');
  if (workerBtn) workerBtn.classList.remove('active');
  
  if (originalST) {
    originalST(tab);
  }
};

// Hook into switchMode
const originalSwitchMode = window.switchMode;
window.switchMode = function(mode) {
  // Restore content
  const c = document.querySelector('.content');
  if(c) c.style.display = '';
  const wt = document.getElementById('c-worker_tasks');
  if(wt) wt.style.display = 'none';
  
  const workerBtn = document.getElementById('modeBtn-worker');
  if (workerBtn) workerBtn.classList.remove('active');

  if (originalSwitchMode) {
    originalSwitchMode(mode);
  }
};

// Wait for DOM to load, then initialize
document.addEventListener('DOMContentLoaded', () => {
  // setTimeout to allow other scripts to load first
  setTimeout(() => {
    window.initWorkerTasks();
  }, 1000);
});
