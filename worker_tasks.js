/**
 * Field Worker Tasks Module (worker_tasks.js)
 * Handles both Admin UI (managing tasks) and Worker UI (viewing/completing tasks)
 */

window.initWorkerTasks = function() {
  if (!window.WORKER_TASKS) window.WORKER_TASKS = [];
  window.wtCurrentDate = window.wtCurrentDate || (window.td ? window.td() : new Date().toISOString().split('T')[0]);
  window.wtSearchQuery = window.wtSearchQuery || '';

  // Inject the Admin UI container if it doesn't exist
  if (!document.getElementById('c-worker_tasks')) {
    const container = document.createElement('div');
    container.id = 'c-worker_tasks';
    container.className = 'content';
    container.style.display = 'none';
    
    // Append to main container
    const mainContainer = document.querySelector('.content')?.parentNode;
    if(mainContainer) mainContainer.appendChild(container);
  }
  
  // Inject the specific Worker App Container
  if (!document.getElementById('worker-app-root')) {
    const workerApp = document.createElement('div');
    workerApp.id = 'worker-app-root';
    workerApp.style.display = 'none';
    workerApp.style.position = 'fixed';
    workerApp.style.inset = '0';
    workerApp.style.background = 'linear-gradient(180deg, #5b6ed1, #485ab9)';
    workerApp.style.zIndex = '100000'; // Above everything else
    workerApp.style.overflowY = 'auto';
    workerApp.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:20px 20px 0 20px;">
        <button onclick="if(window.loadFromFirebase) { this.innerText='מרענן...'; window.loadFromFirebase(false, true).then(()=>{this.innerText='רענן נתונים 🔄'; window.renderWorkerTasksMobile();}); } else location.reload();" style="background:rgba(255,255,255,0.2); border:none; border-radius:8px; color:white; padding:6px 12px; font-size:0.8rem; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.1);">רענן נתונים 🔄</button>
        <button onclick="window.workerLogout()" style="background:transparent; color:#fff; border:none; font-size:1.5rem; cursor:pointer; opacity:0.8;" title="התנתק">🚪</button>
      </div>
      <div id="worker-tasks-mobile-list" style="padding:15px; padding-bottom:50px;">
        <!-- Worker list rendered here -->
      </div>
    `;
    document.body.appendChild(workerApp);
  }
};

window.wtChangeDate = function(days) {
  const d = new Date(window.wtCurrentDate);
  d.setDate(d.getDate() + days);
  window.wtCurrentDate = d.toISOString().split('T')[0];
  window.wtSearchQuery = '';
  window.renderWorkerTasksAdmin();
};

window.wtSetToday = function() {
  window.wtCurrentDate = window.td ? window.td() : new Date().toISOString().split('T')[0];
  window.wtSearchQuery = '';
  window.renderWorkerTasksAdmin();
};

window.wtDoSearch = function(val) {
  window.wtSearchQuery = val.trim().toLowerCase();
  window.renderWorkerTasksAdmin();
};

window.wtToggleTaskStatus = function(id) {
  const task = (window.WORKER_TASKS || []).find(t => t.id === id);
  if (task) {
    if (task.status === 'done') {
      task.status = 'pending';
      task.doneAt = null;
    } else {
      task.status = 'done';
      const now = new Date();
      const dStr = window.td ? window.td() : now.toISOString().split('T')[0];
      const tStr = now.toTimeString().split(' ')[0].substring(0, 5);
      task.doneAt = `${dStr} ${tStr}`;
    }
    if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else window.save(true);
    window.renderWorkerTasksAdmin();
    // Also re-render mobile if open
    if(document.getElementById('worker-app-root')?.style.display === 'block') {
      window.renderWorkerTasksMobile();
    }
  }
};

window.renderWorkerTasksAdmin = function() {
  const container = document.getElementById('c-worker_tasks');
  if (!container) return;
  
  const tasks = window.WORKER_TASKS || [];
  const isSearch = window.wtSearchQuery.length > 0;
  
  let displayTasks = [];
  if (isSearch) {
    displayTasks = tasks.filter(t => {
      const gName = window.G ? (window.G(t.gardenId)?.name || '') : '';
      const cName = window.G ? (window.G(t.gardenId)?.city || '') : '';
      const txt = (t.desc + ' ' + gName + ' ' + cName).toLowerCase();
      return txt.includes(window.wtSearchQuery);
    });
    displayTasks.sort((a,b) => b.date.localeCompare(a.date)); // Newest first for search
  } else {
    displayTasks = tasks.filter(t => t.date === window.wtCurrentDate);
    // Sort: pending first, then by creation
    displayTasks.sort((a,b) => {
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
      return 0; // maintain order
    });
  }

  const dateDisp = window.fD ? window.fD(window.wtCurrentDate) : window.wtCurrentDate;

  let html = `
    <div style="max-width:850px; margin:0 auto; padding:20px;">
      <!-- Header Area -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px; margin-bottom:20px;">
        <h2 style="color:#1565c0; margin:0; font-size:1.6rem; display:flex; align-items:center; gap:8px;">
          👷 ניהול משימות 
        </h2>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button onclick="if(window.loadFromFirebase) { const btn=this; btn.innerText='מרענן...'; window.loadFromFirebase(false, true).then(()=>{btn.innerText='🔄 רענן נתונים מול העובדים'; window.renderWorkerTasksAdmin();}); } else location.reload();" class="wt-no-print" style="background:#e3f2fd; border:1px solid #90caf9; padding:6px 12px; border-radius:20px; cursor:pointer; color:#1565c0; font-weight:bold; display:flex; align-items:center; gap:5px;" title="משוך נתונים מהענן כדי לראות אם העובד סיים משימות">🔄 רענן נתונים מול העובדים</button>
          <button onclick="window.wtPrintTasks(window.wtCurrentDate)" class="wt-no-print" style="background:#fff; border:1px solid #ccc; padding:6px 12px; border-radius:20px; cursor:pointer; color:#1565c0; font-weight:bold; display:flex; align-items:center; gap:5px;" title="הדפס את דף המשימות">🖨️ הדפס משימות</button>
          <div style="position:relative;">
            <input type="text" placeholder="חיפוש משימות..." value="${window.wtSearchQuery}" onkeyup="window.wtDoSearch(this.value)" style="padding:8px 12px; padding-right:30px; border:1px solid #ccc; border-radius:20px; width:180px; font-size:0.9rem;">
            <span style="position:absolute; right:10px; top:8px; opacity:0.5;">🔍</span>
          </div>
          
        </div>
      </div>

      <!-- Calendar Navigation Bar -->
      <div style="background:#fff; border-radius:12px; padding:10px 15px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <button onclick="window.wtChangeDate(-1)" style="background:#f0f0f0; border:none; border-radius:50%; width:36px; height:36px; cursor:pointer; font-size:1.2rem; display:flex; align-items:center; justify-content:center;">&gt;</button>
        <div style="display:flex; align-items:center; gap:15px;">
          <h3 style="margin:0; font-size:1.2rem; color:#333;">📅 יומן משימות: <span style="color:#1565c0;">${dateDisp}</span></h3>
          <button onclick="window.wtSetToday()" style="background:#e3f2fd; color:#1565c0; border:1px solid #bbdefb; border-radius:6px; padding:4px 10px; font-size:0.8rem; cursor:pointer; font-weight:bold;">היום</button>
        </div>
        <button onclick="window.wtChangeDate(1)" style="background:#f0f0f0; border:none; border-radius:50%; width:36px; height:36px; cursor:pointer; font-size:1.2rem; display:flex; align-items:center; justify-content:center;">&lt;</button>
      </div>

      <!-- To Do List View -->
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
              <strong>${loc}</strong> - ${t.desc.replace(/\n/g, ' ')}
            </div>
            <div style="display:flex; align-items:center; gap:10px; font-size:0.85rem; color:#8e8e93;">
              ${isPriv ? '<span style="background:#ffe0b2; color:#e65100; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">🔒 אישי למנהל</span>' : ''}
            </div>
            ${t.workerNote ? `<div style="margin-top:6px; font-size:0.85rem; color:#1565c0; background:#e3f2fd; padding:6px 10px; border-radius:6px; border-right:3px solid #64b5f6;">💬 הערות ${t.workerName || 'עובד'}: ${t.workerNote.replace(/</g, '&lt;')}</div>` : ''}
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
                <strong>${loc}</strong> - ${t.desc.replace(/\n/g, ' ')}
              </div>
              <div style="display:flex; align-items:center; gap:10px; font-size:0.85rem; color:#8e8e93;">
                ${isPriv ? '<span style="background:#ffe0b2; color:#e65100; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">🔒 אישי למנהל</span>' : ''}
                ${t.doneAt ? `<span>(בוצע: ${t.doneAt})</span>` : ''}
              </div>
              ${t.workerNote ? `<div style="margin-top:6px; font-size:0.85rem; color:#1565c0; background:#e3f2fd; padding:6px 10px; border-radius:6px;">💬 הערות ${t.workerName || 'עובד'}: ${t.workerNote.replace(/</g, '&lt;')}</div>` : ''}
            </div>
            
            <div style="margin-right:15px; padding-top:2px; z-index:10; display:flex; gap:8px;">
              <button onclick="window.deleteWorkerTask('${t.id}')" style="background:transparent; color:#ef5350; border:none; cursor:pointer; font-size:1.1rem; opacity:0.6;" title="מחק משימה">🗑️</button>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }
  }

  html += `
      </div>
  `;
  if (!isSearch) {
    html += `
      <!-- Chat Input Area (WhatsApp style) -->
      <div class="wt-no-print" style="position:relative; width:100%; background:#f0f0f0; padding:10px; display:flex; align-items:center; gap:8px; border-radius:0 0 8px 8px; border-top:1px solid #e0e0e0;">
        
        <div style="flex:1; background:#ffffff; border-radius:24px; display:flex; align-items:center; padding:4px 15px; gap:8px; box-shadow:0 1px 2px rgba(0,0,0,0.1);">
          <div style="position:relative; width:130px; border-left:1px solid #eee; padding-left:8px;">
            <input type="text" id="wt-inline-garden" placeholder="📍 חפש גן..." onkeyup="window.wtSearchGardenInline(this.value)" style="width:100%; border:none; background:transparent; outline:none; font-size:0.9rem; color:#075e54; font-weight:bold;">
            <div id="wt-inline-garden-results" style="position:absolute; bottom:110%; right:0; width:200px; max-height:150px; overflow-y:auto; background:#fff; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.2); z-index:100; display:none; line-height:1.2;"></div>
            <input type="hidden" id="wt-inline-garden-id">
          </div>
          
          <input type="text" id="wt-inline-desc" placeholder="הקלד הודעה/משימה..." onkeydown="if(event.key==='Enter') window.wtAddInlineTask()" style="flex:1; border:none; background:transparent; outline:none; font-size:1rem; color:#333;">
          
          <label style="display:flex; align-items:center; cursor:pointer;" title="משימה אישית (לא תיראה לעובד)">
            <input type="checkbox" id="wt-inline-admin" style="margin:0;">
            <span style="font-size:1.1rem; margin-right:4px; opacity:0.8;">🔒</span>
          </label>
        </div>
        
        <button onclick="window.wtAddInlineTask()" style="background:#00a884; color:white; border:none; border-radius:50%; width:44px; height:44px; display:flex; justify-content:center; align-items:center; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.2); flex-shrink:0;" title="שלח משימה">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" style="transform:translateX(-2px) rotate(180deg);"><path d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path></svg>
        </button>
        
      </div>
    `;
  }

  html += `</div>`; // Close max-width wrapper
  container.innerHTML = html;
};

window.openNewWorkerTaskModal = function() {
  const modalHtml = `
    <div style="margin-bottom:15px;">
      <label style="display:block; font-size:0.8rem; color:#666; margin-bottom:5px;">תאריך היעד</label>
      <input type="date" id="wt-date" value="${window.wtCurrentDate || (window.td ? window.td() : '')}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;">
    </div>
    <div style="margin-bottom:15px;">
      <label style="display:block; font-size:0.8rem; color:#666; margin-bottom:5px;">גן / בית ספר (הזן מספר או שם)</label>
      <input type="text" id="wt-garden-search" placeholder="חפש גן..." onkeyup="window.wtSearchGarden(this.value)" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box; margin-bottom:5px;">
      <div id="wt-garden-results" style="max-height:120px; overflow-y:auto; border:1px solid #eee; border-radius:4px; background:#fafafa; padding:5px; display:none;"></div>
      <input type="hidden" id="wt-garden-id" value="">
    </div>
    <div style="margin-bottom:15px;">
      <label style="display:block; font-size:0.8rem; color:#666; margin-bottom:5px;">תיאור המשימה (מה לעשות?)</label>
      <textarea id="wt-desc" rows="3" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box; resize:vertical; font-family:inherit;"></textarea>
    </div>
    <div style="margin-bottom:15px; padding:10px; background:#fff8e1; border:1px solid #ffe082; border-radius:6px;">
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
        <input type="checkbox" id="wt-admin-only" style="width:18px; height:18px;">
        <span style="font-weight:bold; color:#e65100;">משימה אישית שלי (לא מוצג לעובד השטח) 🔒</span>
      </label>
    </div>
  `;
  
  if (window.spPromptDialog) {
    window.spPromptDialog('יצירת משימה חדשה ביומן', modalHtml, 'שמור משימה', () => {
      const date = document.getElementById('wt-date').value;
      const gardenId = document.getElementById('wt-garden-id').value;
      const desc = document.getElementById('wt-desc').value.trim();
      const isAdminOnly = document.getElementById('wt-admin-only').checked;
      
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
        doneAt: null,
        isAdminOnly: isAdminOnly
      });
      
      if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else window.save(true);
      window.wtCurrentDate = date; // Jump to the date where task was added
      window.wtSearchQuery = '';
      window.renderWorkerTasksAdmin();
      if (window.showToast) window.showToast('המשימה נוספה בהצלחה ליומן');
      return true; // Close dialog
    }, true); 
  } else {
    // Fallback if spPromptDialog not available
    const date = prompt("תאריך (YYYY-MM-DD):", window.wtCurrentDate || (window.td ? window.td() : ''));
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
      doneAt: null,
      isAdminOnly: false
    });
    
    if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else window.save(true);
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
    if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else window.save(true);
    window.renderWorkerTasksAdmin();
  }
};

window.wtMoveTaskDate = function(id) {
  const task = (window.WORKER_TASKS || []).find(t => t.id === id);
  if (!task) return;
  
  if (window.spPromptDialog) {
    const html = `<div style="margin-bottom:10px; font-size:0.9rem; color:#666;">בחר תאריך חדש למשימה:</div>
                  <input type="date" id="wt-move-date" value="${task.date}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;">`;
    window.spPromptDialog('העברת משימה לתאריך אחר', html, 'שמור', () => {
      const nd = document.getElementById('wt-move-date').value;
      if (!nd) return false;
      task.date = nd;
      if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else window.save(true);
      window.renderWorkerTasksAdmin();
      if (window.showToast) window.showToast('המשימה הועברה בהצלחה!');
      return true;
    });
  } else {
    const newDate = prompt("הזן תאריך חדש למשימה (YYYY-MM-DD):", task.date);
    if (newDate && newDate !== task.date) {
      task.date = newDate;
      if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else window.save(true);
      window.renderWorkerTasksAdmin();
    }
  }
};

window.wtAddNote = function(id) {
  const task = (window.WORKER_TASKS || []).find(t => t.id === id);
  if (!task) return;
  const currentNote = task.workerNote || '';
  const newNote = prompt("ערוך הערות למשימה (ניתן גם לכתוב פה ולמחוק אם רוצים להסיר):", currentNote);
  if (newNote !== null) {
    task.workerNote = newNote.trim();
    task.workerName = window._fbUser?.displayName || window._fbUser?.email?.replace('@ganmanager.app','') || 'עובד';
    if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else window.save(true);
    window.renderWorkerTasksAdmin();
  }
};

window.wtSaveNote = function(id, val) {
  const task = (window.WORKER_TASKS || []).find(t => t.id === id);
  if (task && task.workerNote !== val) {
    task.workerNote = val.trim();
    task.workerName = window._fbUser?.displayName || window._fbUser?.email?.replace('@ganmanager.app','') || 'עובד';
    if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else window.save(true);
  }
};

// ==========================================
// WORKER APP UI (MOBILE)
// ==========================================

window.activateWorkerApp = function() {
  // SECURE DOM CLEARING: Remove everything except essential resources and the worker app
  Array.from(document.body.children).forEach(el => {
    const tag = el.tagName.toUpperCase();
    if (tag !== 'SCRIPT' && tag !== 'STYLE' && tag !== 'LINK' && el.id !== 'worker-app-root') {
      el.remove();
    }
  });
  
  // Create minimal stylesheet if main was destroyed
  if (!document.getElementById('worker-styles')) {
    const style = document.createElement('style');
    style.id = 'worker-styles';
    style.innerHTML = 'body { margin: 0; padding: 0; background: #f5f7ff; font-family: sans-serif; }';
    document.head.appendChild(style);
  }
  
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
  
  // FILTER OUT ADMIN ONLY TASKS AND ONLY SHOW TODAY'S TASKS
  const today = window.td ? window.td() : new Date().toISOString().split('T')[0];
  const tasks = (window.WORKER_TASKS || []).filter(t => !t.isAdminOnly && t.date === today);
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
    html += `<div style="font-weight:bold; color:#fff; margin-bottom:10px; font-size:1.8rem; text-shadow:0 1px 2px rgba(0,0,0,0.2);">המשימות שלי</div>`;
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
                ${gardenName} - ${t.desc.replace(/\n/g, ' ')}
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
                ${gardenName} - ${t.desc.replace(/\n/g, ' ')}
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
  }
  

  
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
      if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else window.save(true);
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
    const actBtn = document.getElementById('modeBtn-act');
    if(actBtn) actBtn.classList.remove('active');
    const purchBtn = document.getElementById('modeBtn-purch');
    if(purchBtn) purchBtn.classList.remove('active');
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
  setTimeout(() => {
    window.initWorkerTasks();
  }, 1000);
});

window.wtSearchGardenInline = function(q) {
  const res = document.getElementById('wt-inline-garden-results');
  if(!q) { res.style.display='none'; return; }
  const gardens = typeof AG === 'function' ? AG() : [...(window.GARDENS||[]), ...(window._GARDENS_EXTRA||[])];
  const list = gardens.filter(g => (g.name||'').includes(q) || (g.city||'').includes(q) || String(g.id).includes(q)).slice(0,10);
  if(!list.length) { res.innerHTML='<div style="padding:5px; color:#999; font-size:0.8rem;">לא נמצא...</div>'; res.style.display='block'; return; }
  res.innerHTML = list.map(g => `<div style="padding:5px; cursor:pointer; font-size:0.85rem; border-bottom:1px solid #eee;" data-id="${g.id}" data-name="${(g.name||'').replace(/"/g, '&quot;')}" onclick="document.getElementById('wt-inline-garden').value=this.dataset.name; document.getElementById('wt-inline-garden-id').value=this.dataset.id; document.getElementById('wt-inline-garden-results').style.display='none';">${g.name} (${g.city||'אחר'})</div>`).join('');
  res.style.display='block';
};

window.wtAddInlineTask = function() {
  let gardenId = document.getElementById('wt-inline-garden-id').value;
  if (!gardenId && document.getElementById('wt-inline-garden').value) {
    const gName = document.getElementById('wt-inline-garden').value.trim();
    const gardens = typeof AG === 'function' ? AG() : [...(window.GARDENS||[]), ...(window._GARDENS_EXTRA||[])];
    const match = gardens.find(g => g.name === gName);
    if(match) gardenId = match.id;
  }
  const gardenName = document.getElementById('wt-inline-garden').value;
  const desc = document.getElementById('wt-inline-desc').value.trim();
  const isAdminOnly = document.getElementById('wt-inline-admin').checked;
  
  if (!gardenId && gardenName) {
     if(window.showToast) window.showToast('יש לבחור גן מתוך הרשימה', true);
     return;
  }
  if (!gardenId || !desc) {
     if(window.showToast) window.showToast('נא לבחור גן ולכתוב תיאור למשימה', true);
     return;
  }
  
  window.WORKER_TASKS.push({
    id: 'wt_' + Date.now(),
    date: window.wtCurrentDate,
    gardenId: parseInt(gardenId),
    desc: desc,
    status: 'pending',
    doneAt: null,
    isAdminOnly: isAdminOnly
  });
  
  if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else window.save(true);
  window.renderWorkerTasksAdmin();
  if (window.showToast) window.showToast('המשימה נוספה בהצלחה ליומן');
};




window.wtExportWord = function(ds) {
  const tasks = (window.WORKER_TASKS || []).filter(t => !t.isAdminOnly && t.date === ds);
  
  const dObj = new Date(ds);
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const dayName = days[dObj.getDay()];
  const dateDisp = window.fD ? window.fD(ds) : ds;
  const titleStr = `יום ${dayName} | ${dateDisp}`;

  let htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head>
    <meta charset='utf-8'>
    <title>משימות שטח</title>
    <style>
      @page WordSection1 { size: 148.5mm 210mm; margin: 15mm; }
      div.WordSection1 { page: WordSection1; direction: rtl; font-family: Arial, sans-serif; }
      h1 { color: #1565c0; text-align: center; font-size: 20pt; margin-bottom: 5px; }
      h2 { color: #555; text-align: center; font-size: 14pt; margin-top: 0; margin-bottom: 20px; font-weight: normal; }
      .task { margin-bottom: 15px; font-size: 14pt; line-height: 1.5; }
      .task-text { display: inline; }
      .checkbox { font-family: 'Segoe UI Symbol', Arial; font-size: 16pt; margin-left: 8px; color: #333; }
      .notes { margin-top: 4px; font-size: 11pt; color: #666; margin-right: 25px; font-style: italic; }
    </style>
  </head>
  <body>
    <div class='WordSection1'>
      <h1>משימות שטח</h1>
      <h2>${titleStr}</h2>`;
      
  tasks.forEach(t => {
    const gardenName = window.G ? (window.G(t.gardenId)?.name || '') : '';
    const isDone = t.status === 'done';
    const box = isDone ? '&#x2611;' : '&#x25A2;';
    
    htmlContent += `
      <div class="task">
        <span class="checkbox">${box}</span>
        <span class="task-text"><b>${gardenName}</b> - ${t.desc.replace(/\n/g, ' ')}</span>
        ${t.workerNote ? `<div class="notes">הערות ${t.workerName || 'עובד'}: ${t.workerNote}</div>` : ''}
      </div>`;
  });
  
  htmlContent += `</div></body></html>`;
  
  const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `משימות_${ds}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

window.wtPrintTasks = function(ds) {
  const tasks = (window.WORKER_TASKS || []).filter(t => !t.isAdminOnly && t.date === ds);
  
  const dObj = new Date(ds);
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const dayName = days[dObj.getDay()];
  const dateDisp = window.fD ? window.fD(ds) : ds;
  const titleStr = `יום ${dayName} | ${dateDisp}`;

  let htmlContent = `
  <!DOCTYPE html>
  <html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8">
    <title>הדפסת משימות</title>
    <style>
      @page { size: A5; margin: 15mm; }
      body { font-family: Arial, sans-serif; direction: rtl; padding: 0; margin: 0; color: #000; }
      h1 { text-align: center; font-size: 24px; margin-bottom: 5px; color: #000; }
      h2 { text-align: center; font-size: 16px; margin-top: 0; margin-bottom: 25px; font-weight: normal; color: #444; }
      .task { margin-bottom: 16px; font-size: 16px; line-height: 1.4; display: flex; align-items: flex-start; }
      .checkbox { border: 1px solid #000; width: 16px; height: 16px; display: inline-block; margin-left: 10px; border-radius: 3px; margin-top: 3px; flex-shrink: 0; }
      .task-content { flex: 1; }
      .task-text { display: inline; }
      .notes { margin-top: 4px; font-size: 13px; color: #555; font-style: italic; }
      .done-check { text-align: center; line-height: 16px; font-size: 14px; font-weight: bold; }
    </style>
  </head>
  <body>
    <h1>משימות שטח</h1>
    <h2>${titleStr}</h2>
    <div>`;
      
  tasks.forEach(t => {
    const gardenName = window.G ? (window.G(t.gardenId)?.name || '') : '';
    const isDone = t.status === 'done';
    const checkHTML = isDone ? '&#10003;' : '';
    
    htmlContent += `
      <div class="task">
        <div class="checkbox"><div class="done-check">${checkHTML}</div></div>
        <div class="task-content">
          <div class="task-text"><b>${gardenName}</b> - ${t.desc.replace(/\n/g, ' ')}</div>
          ${t.workerNote ? `<div class="notes">הערות ${t.workerName || 'עובד'}: ${t.workerNote}</div>` : ''}
        </div>
      </div>`;
  });
  
  htmlContent += `</div>
    <script>
      window.onload = function() { window.print(); window.close(); }
    </script>
  </body></html>`;

  const printWin = window.open('', '_blank');
  printWin.document.open();
  printWin.document.write(htmlContent);
  printWin.document.close();
};
