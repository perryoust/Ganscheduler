/**
 * Field Worker Tasks Module (worker_tasks.js)
 * Handles both Admin UI (managing tasks) and Worker UI (viewing/completing tasks)
 */

window.initWorkerTasks = function() {
  if (!window.WORKER_TASKS) window.WORKER_TASKS = [];
  window.WORKER_TASKS = window.WORKER_TASKS.filter(Boolean);
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
        <img src="logo_wide.png" style="height:32px; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));" alt="Logo">
        <div style="display:flex; gap:10px;">
          <button onclick="if(window.loadFromFirebase) { this.innerText='מרענן...'; window.loadFromFirebase(false, true).then(()=>{this.innerText='רענן נתונים 🔄'; window.renderWorkerTasksMobile();}); } else location.reload();" style="background:rgba(255,255,255,0.2); border:none; border-radius:8px; color:white; padding:6px 12px; font-size:0.8rem; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.1);">רענן 🔄</button>
          <button onclick="window.workerLogout()" style="background:transparent; color:#fff; border:none; font-size:1.5rem; cursor:pointer; opacity:0.8;" title="התנתק">🚪</button>
        </div>
      </div>
      <div id="worker-tasks-mobile-list" style="padding:15px; padding-bottom:20px;">
        <!-- Worker list rendered here -->
      </div>
      <div style="text-align:center; padding:10px 15px 30px; font-size:0.75rem; color:rgba(255,255,255,0.6);">
        &copy; 2026 טומשין-עושים חינוך אחרת בע"מ(חל"צ). כל הזכויות שמורות.
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

let _wtSearchTimer = null;
window.wtDoSearch = function(val) {
  window.wtSearchQuery = (val || '').trim().toLowerCase();
  clearTimeout(_wtSearchTimer);
  _wtSearchTimer = setTimeout(() => {
    window.renderWorkerTasksAdmin();
  }, 250);
};

window.wtToggleTaskStatus = function(id) {
  const task = (window.WORKER_TASKS || []).find(t => t.id === id);
  if (task) {
    if (task.status === 'done') {
      const doneDate = task.doneAt ? task.doneAt.split(' ')[0] : task.date;
      if (window.wtCurrentDate !== doneDate && window.wtCurrentDate === task.date) {
         if(window._spAlertDialog) window._spAlertDialog(`משימה זו סומנה שבוצעה ב-${window.fD ? window.fD(doneDate) : doneDate}. כדי לבטל ביצוע, יש לעבור לתאריך הביצוע.`);
         else alert(`משימה זו סומנה שבוצעה ב-${doneDate}.`);
         return;
      }
      task.status = 'pending';
      task.doneAt = null;
      // Jump to today so the un-completed task appears in the pending list
      // (past pending tasks are only shown when viewing today or future)
      const today = window.td ? window.td() : new Date().toISOString().split('T')[0];
      if (window.wtCurrentDate < today) {
        window.wtCurrentDate = today;
      }
    } else {
      const today = window.td ? window.td() : new Date().toISOString().split('T')[0];
      let dStr = today;
      let tStr = new Date().toTimeString().split(' ')[0].substring(0, 5);
      
      // If the task was originally scheduled for a past date, ask the user when it was done (Admins only)
      if (task.date && task.date < today && window.role === 'admin') {
        const dispDate = window.fD ? window.fD(task.date) : task.date;
        if(await window.spConfirm(`המשימה הייתה מתוכננת ל-${dispDate}. האם בוצעה בתאריך המקורי?\n\n[אישור] = בוצעה ב-${dispDate}\n[ביטול] = בוצעה היום (${window.fD ? window.fD(today) : today})`)) {
          dStr = task.date;
          tStr = "23:59"; // Just a default time for past completions
        }
      }

      task.status = 'done';
      task.doneAt = `${dStr} ${tStr}`;
      task.doneBy = window._fbUser?.displayName || window._fbUser?.email?.replace('@ganmanager.app','') || 'עובד';
    }
    if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else window.save(true);
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

  const searchInputBefore = document.getElementById('wt-tasks-search-input');
  const isSearchFocused = searchInputBefore && document.activeElement === searchInputBefore;
  const cursorPos = isSearchFocused ? searchInputBefore.selectionStart : null;
  
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
    const today = window.td ? window.td() : new Date().toISOString().split('T')[0];
    displayTasks = tasks.reduce((acc, t) => {
      // 1. Logic for original date
      if (t.date === window.wtCurrentDate) {
        if (t.status === 'done' && t.doneAt && t.doneAt.split(' ')[0] !== t.date) {
           acc.push({ ...t, status: 'pending', doneAt: null, doneBy: null, _isGhost: true });
        } else {
           acc.push(t);
        }
      }
      
      // 2. Logic for pulling forward to today
      if (window.wtCurrentDate === today && t.status === 'pending' && t.date < today) {
        acc.push(t);
      }
      
      // 3. Logic for the done date (if done on a different date)
      if (t.status === 'done' && t.doneAt) {
        const doneDate = t.doneAt.split(' ')[0];
        if (window.wtCurrentDate === doneDate && doneDate !== t.date) {
           acc.push(t);
        }
      }
      
      return acc;
    }, []);
    // Sort: pending first, then by creation
    displayTasks.sort((a,b) => {
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
      return 0; // maintain order
    });
  }

  const dayName = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][new Date(window.wtCurrentDate).getDay()];
  const dateDisp = "יום " + dayName + " " + (window.fD ? window.fD(window.wtCurrentDate) : window.wtCurrentDate);

  let html = `
    <div style="max-width:850px; margin:0 auto; padding:20px;">
      <!-- Header Area -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px; margin-bottom:20px;">
        <h2 style="color:#1565c0; margin:0; font-size:1.6rem; display:flex; align-items:center; gap:8px;">
          👷 ניהול משימות 
        </h2>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button onclick="if(window.loadFromFirebase) { const btn=this; btn.innerText='מסנכרן...'; window.loadFromFirebase(false, true).then(()=>{btn.innerText='🔄 סנכרן נתונים'; window.renderWorkerTasksAdmin();}); } else location.reload();" class="wt-no-print" style="background:#e3f2fd; border:1px solid #90caf9; padding:6px 12px; border-radius:20px; cursor:pointer; color:#1565c0; font-weight:bold; display:flex; align-items:center; gap:5px;" title="משוך נתונים מהענן כדי לראות מי העובד שסיים את המשימות">🔄 סנכרן נתונים</button>

          <button onclick="window.wtExportWord(window.wtCurrentDate)" class="wt-no-print" style="background:#fff; border:1px solid #ccc; padding:6px 12px; border-radius:20px; cursor:pointer; color:#1565c0; font-weight:bold; display:flex; align-items:center; gap:5px;" title="ייצוא משימות לקובץ Word">📄 ייצוא ל-Word</button>
          <button onclick="window.wtPrintTasks(window.wtCurrentDate)" class="wt-no-print" style="background:#fff; border:1px solid #ccc; padding:6px 12px; border-radius:20px; cursor:pointer; color:#1565c0; font-weight:bold; display:flex; align-items:center; gap:5px;" title="הדפס את דף המשימות">🖨️ הדפס משימות</button>
          <div style="position:relative;">
            <input type="text" id="wt-tasks-search-input" placeholder="חיפוש משימות..." value="${window.wtSearchQuery}" oninput="window.wtDoSearch(this.value)" style="padding:8px 12px; padding-right:30px; border:1px solid #ccc; border-radius:20px; width:180px; font-size:0.9rem;">
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
    
    // Render Pending then Done together
    const allSortedTasks = [...pending, ...doneTasks];
    allSortedTasks.forEach(t => {
      const isDone = t.status === 'done';
      const gardenName = t.gardenId ? (window.G ? (window.G(t.gardenId)?.name || '') : '') : '';
      const city = t.gardenId ? (window.G ? (window.G(t.gardenId)?.city || '') : '') : (t.city || '');
      const loc = t.gardenId ? (city ? `${city} - ${gardenName}` : gardenName) : (city || '');
      const isPriv = t.isAdminOnly;
      
      html += `
        <!-- Task Row -->
        <div draggable="true" 
             ondragstart="event.dataTransfer.setData('text/plain', '${t.id}'); this.style.opacity='0.4';" 
             ondragend="this.style.opacity='1';"
             ondragover="event.preventDefault(); this.style.borderTop='2px dashed #1565c0';" 
             ondragleave="this.style.borderTop='none';" 
             ondrop="event.preventDefault(); this.style.borderTop='none'; const draggedId=event.dataTransfer.getData('text/plain'); if(window.wtOnDropTask) window.wtOnDropTask(draggedId, '${t.id}');"
             style="background:#fff; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.08); margin-bottom:10px; display:flex; align-items:flex-start; flex-wrap:wrap; padding:12px; position:relative; cursor:grab; transition: border 0.2s; ${isDone ? 'opacity:0.85;' : ''}">
          
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
          <div style="flex: 1 1 150px; min-width: 120px;">
            ${isSearch ? `<div style="font-size:0.75rem; color:#888; margin-bottom:2px;">${window.fD ? window.fD(t.date) : t.date}</div>` : ''}
            <div style="font-size:1.1rem; color:${isDone ? '#666' : '#1c1c1e'}; line-height:1.3; margin-bottom:4px;">
              ${loc ? `<strong>${loc}</strong> - ` : ''}${t.desc.replace(/\n/g, ' ')}
            </div>
            <div style="display:flex; align-items:center; gap:10px; font-size:0.85rem; color:#8e8e93; flex-wrap:wrap;">
              ${isPriv ? '<span style="background:#ffe0b2; color:#e65100; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">🔒 אישי למנהל</span>' : ''}
              ${isDone && t.doneAt ? `<span style="font-size:0.85rem; color:#4caf50; font-weight:bold;">(בוצע ע"י ${t.doneBy || 'עובד'} ב-${t.doneAt})</span>` : ''}
            </div>
            ${t.workerNote ? `<div style="margin-top:6px; font-size:0.85rem; color:#1565c0; background:#e3f2fd; padding:6px 10px; border-radius:6px; border-right:3px solid #64b5f6;">💬 הערות ${t.workerName || 'עובד'}: ${t.workerNote.replace(/</g, '&lt;')}</div>` : ''}
          </div>
          
          <!-- Left Actions -->
          <div style="flex: 0 1 auto; margin-right:auto; padding-top:6px; z-index:10; display:flex; flex-direction:column; gap:4px; justify-content:flex-end; align-items:flex-end;">
            <div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
              <button onclick="window.wtShiftTaskDate('${t.id}', -1)" style="background:transparent; color:#1565c0; border:none; cursor:pointer; font-size:1.1rem; opacity:0.8;" title="הקדם ליום הקודם">⏩</button>
              <button onclick="window.wtShiftTaskDate('${t.id}', 1)" style="background:transparent; color:#1565c0; border:none; cursor:pointer; font-size:1.1rem; opacity:0.8;" title="דחה ליום המחרת">⏪</button>
              <button onclick="window.wtEditTaskDesc('${t.id}')" style="background:transparent; color:#8e24aa; border:none; cursor:pointer; font-size:1.1rem; opacity:0.8;" title="ערוך משימה">✏️</button>
              <button onclick="window.wtAddNote('${t.id}')" style="background:transparent; color:#f57c00; border:none; cursor:pointer; font-size:1.1rem; opacity:0.8;" title="הוסף הערה">💬</button>
              <button onclick="window.wtMoveTaskDate('${t.id}')" style="background:transparent; color:#1565c0; border:none; cursor:pointer; font-size:1.1rem; opacity:0.7;" title="העבר תאריך">📅</button>
              <button onclick="window.deleteWorkerTask('${t.id}')" style="background:transparent; color:#ef5350; border:none; cursor:pointer; font-size:1.1rem; opacity:0.6;" title="מחק משימה">🗑️</button>
            </div>
          </div>
        </div>
      `;
    });
  }

  html += `
      </div>
  `;
  if (!isSearch) {
    html += `
      <!-- Chat Input Area (WhatsApp style) -->
      <div class="wt-no-print" style="position:relative; width:100%; background:#f0f0f0; padding:8px; display:flex; align-items:flex-end; gap:6px; border-radius:0 0 8px 8px; border-top:1px solid #e0e0e0;">
        
        <div style="flex:1; background:#ffffff; border-radius:12px; display:flex; flex-direction:column; padding:6px 10px; gap:4px; box-shadow:0 1px 2px rgba(0,0,0,0.1);">
          <div style="display:flex; align-items:center; border-bottom:1px solid #f0f0f0; padding-bottom:4px;">
            <div style="position:relative; flex:1;">
              <input type="text" id="wt-inline-garden" placeholder="📍 שיוך לגן (אופציונלי)..." onkeyup="window.wtSearchGardenInline(this.value)" style="width:100%; border:none; background:transparent; outline:none; font-size:0.85rem; color:#075e54; font-weight:bold; text-overflow: ellipsis;">
              <div id="wt-inline-garden-results" style="position:absolute; bottom:110%; right:0; width:220px; max-height:150px; overflow-y:auto; background:#fff; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.2); z-index:100; display:none; line-height:1.2;"></div>
              <input type="hidden" id="wt-inline-garden-id">
              <input type="hidden" id="wt-inline-city-name">
            </div>
            <label style="display:flex; align-items:center; cursor:pointer; margin-right:8px; padding-right:8px; border-right:1px solid #f0f0f0;" title="משימה אישית (לא תיראה לעובד)">
              <input type="checkbox" id="wt-inline-admin" style="margin:0 0 0 4px; width:16px; height:16px;">
              <span style="font-size:0.85rem; opacity:0.8; font-weight:bold; color:#e65100">🔒 אישי למנהל</span>
            </label>
          </div>
          
          <div style="display:flex; align-items:center;">
            <input type="text" id="wt-inline-desc" placeholder="הקלד משימה חדשה..." onkeydown="if(event.key==='Enter') window.wtAddInlineTask()" style="flex:1; border:none; background:transparent; outline:none; font-size:1rem; color:#333; padding:4px 0;">
          </div>
        </div>
        
        <button onclick="window.openNewWorkerTaskModal()" style="background:#e3f2fd; color:#1565c0; border:1px solid #90caf9; border-radius:50%; width:40px; height:40px; display:flex; justify-content:center; align-items:center; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.1); flex-shrink:0;" title="משימה קבועה / אפשרויות נוספות">
          <span style="font-size:1.2rem;">🔄</span>
        </button>

        <button onclick="window.wtAddInlineTask()" style="background:#00a884; color:white; border:none; border-radius:50%; width:40px; height:40px; display:flex; justify-content:center; align-items:center; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.2); flex-shrink:0;" title="שלח משימה">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="transform:translateX(-2px) rotate(180deg);"><path d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path></svg>
        </button>
        
      </div>
    `;
  }

  html += `</div>`; // Close max-width wrapper
  container.innerHTML = html;

  if (isSearchFocused) {
    const searchInputAfter = document.getElementById('wt-tasks-search-input');
    if (searchInputAfter) {
      searchInputAfter.focus();
      if (cursorPos !== null) {
        searchInputAfter.setSelectionRange(cursorPos, cursorPos);
      }
    }
  }
};

window.openNewWorkerTaskModal = function() {
  let inlineDesc = '';
  let inlineGardenName = '';
  let inlineAdmin = false;
  
  if (document.getElementById('wt-inline-desc')) {
    inlineDesc = document.getElementById('wt-inline-desc').value.replace(/"/g, '&quot;');
    inlineGardenName = document.getElementById('wt-inline-garden').value.replace(/"/g, '&quot;');
    inlineAdmin = document.getElementById('wt-inline-admin').checked;
  }

  const modalHtml = `
    <div style="margin-bottom:15px;">
      <label style="display:block; font-size:0.8rem; color:#666; margin-bottom:5px;">תאריך היעד</label>
      <input type="date" id="wt-date" value="${window.wtCurrentDate || (window.td ? window.td() : '')}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;">
    </div>
    <div style="margin-bottom:15px;">
      <label style="display:block; font-size:0.8rem; color:#666; margin-bottom:5px;">גן / בית ספר (הזן מספר או שם)</label>
      <input type="text" id="wt-garden-search" value="${inlineGardenName}" placeholder="חפש גן..." onkeyup="window.wtSearchGarden(this.value)" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box; margin-bottom:5px;">
      <div id="wt-garden-results" style="max-height:120px; overflow-y:auto; border:1px solid #eee; border-radius:4px; background:#fafafa; padding:5px; display:none;"></div>
      <input type="hidden" id="wt-garden-id" value="">
      <input type="hidden" id="wt-city-name" value="">
    </div>
    <div style="margin-bottom:15px;">
      <label style="display:block; font-size:0.8rem; color:#666; margin-bottom:5px;">תיאור המשימה (מה לעשות?)</label>
      <textarea id="wt-desc" rows="3" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box; resize:vertical; font-family:inherit;">${inlineDesc}</textarea>
    </div>
    <div style="margin-bottom:15px; padding:10px; background:#fff8e1; border:1px solid #ffe082; border-radius:6px;">
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
        <input type="checkbox" id="wt-admin-only" style="width:18px; height:18px;" ${inlineAdmin ? 'checked' : ''}>
        <span style="font-weight:bold; color:#e65100;">משימה אישית שלי (לא מוצג לעובד השטח) 🔒</span>
      </label>
    </div>
    <div style="margin-bottom:15px;">
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
        <input type="checkbox" id="wt-is-recurring" style="width:18px; height:18px;" onchange="document.getElementById('wt-recur-container').style.display = this.checked ? 'block' : 'none';">
        <span style="font-weight:bold; color:#1565c0;">הגדר כמשימה קבועה (חוזרת) 🔄</span>
      </label>
    </div>
    <div id="wt-recur-container" style="margin-bottom:15px; display:none; padding:10px; border:1px solid #bbdefb; border-radius:6px; background:#e3f2fd;">
      <label style="display:block; font-size:0.85rem; color:#1565c0; margin-bottom:5px; font-weight:bold;">תדירות:</label>
      <select id="wt-recur" style="width:100%; padding:8px; border:1px solid #90caf9; border-radius:6px; box-sizing:border-box; margin-bottom:10px;">
        <option value="daily">יומי</option>
        <option value="weekly">שבועי</option>
        <option value="monthly">חודשי</option>
      </select>
      <label style="display:block; font-size:0.85rem; color:#1565c0; margin-bottom:5px; font-weight:bold;">חזור עד תאריך (כולל):</label>
      <input type="date" id="wt-recur-end" style="width:100%; padding:8px; border:1px solid #90caf9; border-radius:6px; box-sizing:border-box;">
    </div>
  `;
  
  if (window.spPromptDialog) {
    window.spPromptDialog('יצירת משימה חדשה ביומן', modalHtml, 'שמור משימה', () => {
      const date = document.getElementById('wt-date').value;
      const gardenId = document.getElementById('wt-garden-id').value;
      const desc = document.getElementById('wt-desc').value.trim();
      const isAdminOnly = document.getElementById('wt-admin-only').checked;
      let cityName = document.getElementById('wt-city-name') ? document.getElementById('wt-city-name').value : '';
      const gardenSearchText = document.getElementById('wt-garden-search') ? document.getElementById('wt-garden-search').value.trim() : '';
      
      if (!gardenId && !cityName && gardenSearchText) {
        cityName = gardenSearchText;
      }
      
      if (!date || (!gardenId && !cityName) || !desc) {
        if (window.spAlert) window.spAlert('נא למלא תאריך, גן/עיר/רכז ותיאור למשימה', true);
        return false; // Prevent closing
      }
      
      const isRecurring = document.getElementById('wt-is-recurring') ? document.getElementById('wt-is-recurring').checked : false;
      const recur = document.getElementById('wt-recur') ? document.getElementById('wt-recur').value : 'daily';
      const recurEnd = document.getElementById('wt-recur-end') ? document.getElementById('wt-recur-end').value : '';
      
      let datesToCreate = [date];
      
      if (isRecurring) {
        if (!recurEnd) {
          if (window.spAlert) window.spAlert('נא לבחור תאריך סיום למשימה הקבועה', true);
          return false;
        }
        const startD = new Date(date);
        const endD = new Date(recurEnd);
        if (endD < startD) {
          if (window.spAlert) window.spAlert('תאריך הסיום חייב להיות אחרי תאריך ההתחלה', true);
          return false;
        }
        
        datesToCreate = []; // Rebuild
        let current = new Date(startD);
        let failsafe = 0;
        
        while (current <= endD && failsafe < 365) {
          datesToCreate.push(current.toISOString().split('T')[0]);
          if (recur === 'daily') {
            current.setDate(current.getDate() + 1);
          } else if (recur === 'weekly') {
            current.setDate(current.getDate() + 7);
          } else if (recur === 'monthly') {
            current.setMonth(current.getMonth() + 1);
          }
          failsafe++;
        }
        if (failsafe >= 365 && window.spAlert) {
          window.spAlert('שים לב: המשימה הקבועה הוגבלה ל-365 מופעים כדי למנוע עומס על המערכת.');
        }
      }
      
      const baseId = Date.now();
      datesToCreate.forEach((dStr, idx) => {
        window.WORKER_TASKS.push({
          id: 'wt_' + baseId + '_' + idx,
          date: dStr,
          gardenId: gardenId ? parseInt(gardenId) : 0,
          city: cityName || '',
          desc: desc,
          status: 'pending',
          doneAt: null,
          isAdminOnly: isAdminOnly
        });
      });
      
      if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else window.save(true);
      window.wtCurrentDate = date; // Jump to the date where task was added
      window.wtSearchQuery = '';
      window.renderWorkerTasksAdmin();
      return true; // Close dialog
    }, true); 
  } else {
    // Fallback if spPromptDialog not available
    const date = prompt("תאריך (YYYY-MM-DD):", window.wtCurrentDate || (window.td ? window.td() : ''));
    if (!date) return;
    const gardenId = prompt("מזהה הגן (מספר, או השאר ריק למשימה כללית):");
    let cityName = '';
    if (!gardenId) {
      cityName = prompt("האם המשימה שייכת לעיר ספציפית? (הזן שם עיר או השאר ריק):") || '';
    }
    const desc = prompt("תיאור המשימה:");
    if (!desc) return;
    
    let recur = prompt("תדירות: 0=חד פעמי, 1=יומי, 2=שבועי, 3=חודשי", "0");
    let datesToCreate = [date];
    
    if (recur === "1" || recur === "2" || recur === "3") {
      let recurMap = {"1":"daily", "2":"weekly", "3":"monthly"};
      let recurType = recurMap[recur];
      let recurEnd = prompt("חזור עד תאריך (YYYY-MM-DD):");
      if (recurEnd) {
        const startD = new Date(date);
        const endD = new Date(recurEnd);
        if (endD >= startD) {
          datesToCreate = [];
          let current = new Date(startD);
          let failsafe = 0;
          while (current <= endD && failsafe < 365) {
            datesToCreate.push(current.toISOString().split('T')[0]);
            if (recurType === 'daily') current.setDate(current.getDate() + 1);
            else if (recurType === 'weekly') current.setDate(current.getDate() + 7);
            else if (recurType === 'monthly') current.setMonth(current.getMonth() + 1);
            failsafe++;
          }
        }
      }
    }
    
    const baseId = Date.now();
    datesToCreate.forEach((dStr, idx) => {
      window.WORKER_TASKS.push({
        id: 'wt_' + baseId + '_' + idx,
        date: dStr,
        gardenId: gardenId ? parseInt(gardenId) : 0,
        city: cityName,
        desc: desc,
        status: 'pending',
        doneAt: null,
        isAdminOnly: false
      });
    });
    
    if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else window.save(true);
    window.renderWorkerTasksAdmin();
  }
};

window.wtSearchGarden = function(q) {
  const resEl = document.getElementById('wt-garden-results');
  if (!q || q.length < 2) {
    resEl.style.display = 'none';
    return;
  }
  
  const allGardens = typeof AG === 'function' ? AG() : [...(window.GARDENS||[]), ...(window._GARDENS_EXTRA||[])];
  
  const gardens = [];
  const seen = new Set();
  for (let g of allGardens) {
    if (g.name) {
      const normalizedKey = g.name.trim().replace(/\s+/g, ' ') + '|' + (g.city || '').trim();
      if (!seen.has(normalizedKey)) {
        seen.add(normalizedKey);
        gardens.push(g);
      }
    }
  }

  const results = gardens.filter(g => 
    String(g.id).includes(q) || 
    (g.name && g.name.includes(q)) || 
    (g.city && g.city.includes(q))
  ).slice(0, 30); // Limit to 30
  
  let html = '';
  const matchingCities = [...new Set(gardens.filter(g => g.city && g.city.includes(q)).map(g => g.city))];
  
  matchingCities.slice(0, 3).forEach(c => {
    html += `
      <div onclick="document.getElementById('wt-garden-id').value=''; if(document.getElementById('wt-city-name')) document.getElementById('wt-city-name').value='${c}'; document.getElementById('wt-garden-search').value='${c}'; document.getElementById('wt-garden-results').style.display='none';" 
           style="padding:6px; border-bottom:1px solid #eee; cursor:pointer; font-size:0.85rem; background:#e3f2fd; color:#1565c0; font-weight:bold;">
        🏙️ משימה לעיר: ${c}
      </div>
    `;
  });

  if (results.length === 0 && matchingCities.length === 0) {
    html = '<div style="color:#999; font-size:0.8rem; text-align:center;">לא נמצאו תוצאות</div>';
  } else {
    html += results.map(g => `
      <div onclick="document.getElementById('wt-garden-id').value='${g.id}'; if(document.getElementById('wt-city-name')) document.getElementById('wt-city-name').value=''; document.getElementById('wt-garden-search').value='${g.city||''} - ${g.name}'; document.getElementById('wt-garden-results').style.display='none';" 
           style="padding:6px; border-bottom:1px solid #eee; cursor:pointer; font-size:0.85rem;">
        <b>${g.id}</b> | ${g.city||''} - ${g.name}
      </div>
    `).join('');
  }
  resEl.innerHTML = html;
  resEl.style.display = 'block';
};

window.deleteWorkerTask = async function(id) {
  if (await window.spConfirm('האם אתה בטוח שברצונך למחוק משימה זו?')) {
    window.WORKER_TASKS = window.WORKER_TASKS.filter(t => t.id !== id);
    if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else window.save(true);
    window.renderWorkerTasksAdmin();
  }
};

window.wtShiftTaskDate = function(id, days) {
  const task = (window.WORKER_TASKS || []).find(t => t.id === id);
  if (!task || !task.date) return;
  
  const d = new Date(task.date);
  if (isNaN(d.getTime())) return;
  
  d.setDate(d.getDate() + days);
  task.date = d.toISOString().slice(0, 10);
  
  if (window.saveWorkerTasksToFirebase) {
    window.saveWorkerTasksToFirebase(true);
  } else if (window.save) {
    window.save(true);
  }
  
  window.renderWorkerTasksAdmin();
  if (window.spAlert) window.spAlert('המשימה הוזזה ל-' + window.fD(task.date));
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
      if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else window.save(true);
      window.renderWorkerTasksAdmin();
      if (window.spAlert) window.spAlert('המשימה הועברה בהצלחה!');
      return true;
    });
  } else {
    const newDate = prompt("הזן תאריך חדש למשימה (YYYY-MM-DD):", task.date);
    if (newDate && newDate !== task.date) {
      task.date = newDate;
      if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else window.save(true);
      window.renderWorkerTasksAdmin();
    }
  }
};

window.wtOnDropTask = function(draggedId, droppedOnId) {
  if (draggedId === droppedOnId) return;
  const tasks = window.WORKER_TASKS || [];
  const dragIdx = tasks.findIndex(t => t.id === draggedId);
  const dropIdx = tasks.findIndex(t => t.id === droppedOnId);
  if (dragIdx === -1 || dropIdx === -1) return;
  
  const draggedTask = tasks[dragIdx];
  const isDraggingDown = dragIdx < dropIdx;
  
  tasks.splice(dragIdx, 1);
  
  // Re-find dropIdx after removal
  let newDropIdx = tasks.findIndex(t => t.id === droppedOnId);
  
  // If dragging down, insert AFTER the dropped-on task so it actually moves past it
  if (isDraggingDown) {
    newDropIdx++;
  }
  
  // Insert the dropped task
  tasks.splice(newDropIdx, 0, draggedTask);
  
  if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else if (window.save) window.save(true);
  window.renderWorkerTasksAdmin();
};

window.wtEditTaskDesc = async function(id) {
  const task = (window.WORKER_TASKS || []).find(t => t.id === id);
  if (!task) return;
  const newDesc = await window.spPrompt("ערוך תיאור משימה:", task.desc);
  if (newDesc !== null && newDesc.trim() !== '') {
    task.desc = newDesc.trim();
    if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else if (window.save) window.save(true);
    window.renderWorkerTasksAdmin();
  }
};

window.wtAddNote = async function(id) {
  const task = (window.WORKER_TASKS || []).find(t => t.id === id);
  if (!task) return;
  const currentNote = task.workerNote || '';
  const newNote = await window.spPrompt("ערוך הערות למשימה (ניתן גם לכתוב פה ולמחוק אם רוצים להסיר):", currentNote);
  if (newNote !== null) {
    task.workerNote = newNote.trim();
    task.workerName = window._fbUser?.displayName || window._fbUser?.email?.replace('@ganmanager.app','') || 'עובד';
    if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else window.save(true);
    window.renderWorkerTasksAdmin();
  }
};

window.wtSaveNote = function(id, val) {
  const task = (window.WORKER_TASKS || []).find(t => t.id === id);
  if (task && task.workerNote !== val) {
    task.workerNote = val.trim();
    task.workerName = window._fbUser?.displayName || window._fbUser?.email?.replace('@ganmanager.app','') || 'עובד';
    if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else window.save(true);
  }
};

// ==========================================
// WORKER APP UI (MOBILE)
// ==========================================

window.activateWorkerApp = function() {
  // First ensure the worker app container exists (initWorkerTasks creates it)
  if (typeof window.initWorkerTasks === 'function') {
    window.initWorkerTasks();
  }

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
  
  // FILTER OUT ADMIN ONLY TASKS AND ONLY SHOW TODAY'S TASKS (or older pending)
  const today = window.td ? window.td() : new Date().toISOString().split('T')[0];
  const tasks = (window.WORKER_TASKS || []).reduce((acc, t) => {
    if (t.isAdminOnly) return acc;
    if (t.status === 'pending' && (!t.date || t.date <= today)) {
       acc.push(t);
    } else if (t.status === 'done') {
       const doneDate = t.doneAt ? t.doneAt.split(' ')[0] : t.date;
       if (doneDate === today) acc.push(t);
    }
    return acc;
  }, []);
  const pending = tasks.filter(t => t.status === 'pending');
  const done = tasks.filter(t => t.status === 'done');
  
  // Keep the pending tasks in the original array order (which respects drag-and-drop)
  // Sort done by completion time (newest first)
  done.sort((a,b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
  
  let html = '';
  
  if (pending.length === 0) {
    html += `
      <div style="display:flex; justify-content:center; margin-bottom:20px;">
        <button onclick="if(window.loadFromFirebase){ const b=this; b.innerHTML='<span class=\'spin-icon\'>🔄</span> מסנכרן...'; window.loadFromFirebase(false,true).then(()=>{b.innerHTML='🔄 סנכרן נתונים'; window.renderWorkerTasksMobile();}); }else location.reload();" style="background:#1565c0; border:none; border-radius:20px; padding:10px 24px; color:#fff; cursor:pointer; display:flex; align-items:center; gap:8px; font-weight:bold; font-size:1.1rem; box-shadow:0 4px 10px rgba(21,101,192,0.3);">🔄 סנכרן נתונים</button>
      </div>
      <div style="text-align:center; padding:40px 20px; background:#fff; border-radius:16px; box-shadow:0 4px 15px rgba(0,0,0,0.05); margin-bottom:20px;">
        <div style="font-size:3rem; margin-bottom:10px;">🎉</div>
        <div style="font-size:1.2rem; color:#1565c0; font-weight:bold;">אין משימות פתוחות!</div>
        <div style="color:#666; font-size:0.9rem; margin-top:5px;">כל המשימות שלך הושלמו.</div>
      </div>
    `;
  } else {
    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:5px;">
        <div style="font-weight:bold; color:#fff; font-size:1.8rem; text-shadow:0 1px 2px rgba(0,0,0,0.2);">המשימות שלי</div>
        <div style="display:flex; gap:5px;">
          <button onclick="window.wtWorkerAddFreeNote()" style="background:#4caf50; border:1px solid #388e3c; border-radius:20px; padding:4px 12px; color:#fff; cursor:pointer; display:flex; align-items:center; gap:5px; font-weight:bold;" title="הודעה חופשית">💬 הודעה</button>
          <button onclick="if(window.loadFromFirebase){ const b=this; b.innerText='מרענן...'; window.loadFromFirebase(false,true).then(()=>{b.innerText='🔄 רענן'; window.renderWorkerTasksMobile();}); }else location.reload();" style="background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.5); border-radius:20px; padding:4px 12px; color:#fff; cursor:pointer; display:flex; align-items:center; gap:5px; font-weight:bold;">🔄 רענן</button>

        </div>
      </div>
    `;
    const allSortedTasks = [...pending, ...done];
    allSortedTasks.forEach(t => {
      const isDone = t.status === 'done';
      const gardenName = t.gardenId ? (window.G ? (window.G(t.gardenId)?.name || '') : '') : (t.city || '');
      const city = window.G ? (window.G(t.gardenId)?.city || '') : '';
      const address = window.G ? (window.G(t.gardenId)?.address || '') : '';
      
      html += `
        <div style="background:#fff; border-radius:8px; padding:12px; margin-bottom:8px; box-shadow:0 1px 3px rgba(0,0,0,0.15); ${isDone ? 'opacity:0.85;' : ''}">
          <div style="display:flex; align-items:flex-start; gap:12px;">
            <!-- Circle Checkbox -->
            <div onclick="${isDone ? `window.wtToggleTaskStatus('${t.id}')` : `window.markTaskDone('${t.id}')`}" style="width:26px; height:26px; margin-top:2px; border:2px solid ${isDone ? '#4caf50' : '#8e8e93'}; border-radius:50%; flex-shrink:0; cursor:pointer; box-sizing:border-box; display:flex; align-items:center; justify-content:center; background:white;">
               ${isDone ? '<span style="color:#4caf50; font-weight:bold; font-size:1.1rem;">✓</span>' : ''}
            </div>
            
            <!-- Task Text -->
            <div style="flex:1;">
              <div style="font-size:1.1rem; color:${isDone ? '#666' : '#1c1c1e'}; margin-bottom:2px; line-height:1.3;">
                ${gardenName ? `${gardenName} - ` : ''}${t.desc.replace(/\n/g, ' ')}
              </div>
              <div style="font-size:0.85rem; color:#8e8e93; display:flex; flex-direction:column; gap:4px;">
                <div style="display:flex; gap:8px;">
                  <span>${city}</span>
                  ${address ? `<span>&#8226; 📍 ${address}</span>` : ''}
                </div>
                ${isDone && t.doneAt ? `<span style="color:#4caf50; font-weight:bold;">(בוצע ע"י ${t.doneBy || 'עובד'} ב-${t.doneAt.split(' ')[1] || t.doneAt})</span>` : ''}
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
    
    const today = window.td ? window.td() : new Date().toISOString().split('T')[0];
    let dStr = today;
    let tStr = new Date().toTimeString().split(' ')[0].substring(0, 5);
    
    if (task.date && task.date < today && window.role === 'admin') {
      const dispDate = window.fD ? window.fD(task.date) : task.date;
      if(await window.spConfirm(`המשימה הייתה מתוכננת ל-${dispDate}. האם בוצעה בתאריך המקורי?\n\n[אישור] = בוצעה ב-${dispDate}\n[ביטול] = בוצעה היום (${window.fD ? window.fD(today) : today})`)) {
        dStr = task.date;
        tStr = "23:59";
      }
    }
    
    task.doneAt = `${dStr} ${tStr}`;
    task.doneBy = window._fbUser?.displayName || window._fbUser?.email?.replace('@ganmanager.app','') || 'עובד';
    
    // Play sound or vibration if possible
    if (navigator.vibrate) navigator.vibrate(50);
    
    // Save to Firebase immediately
    if (window.save) {
      if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else window.save(true);
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
    
    // Explicitly hide all panels just in case
    document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
    
    // Clear mode-purch class to fix backgrounds and mobile nav
    document.body.classList.remove('mode-purch');
    const mnPurch = document.getElementById('mob-nav-purch');
    if(mnPurch) mnPurch.style.display = 'none';
    const mnAct = document.getElementById('mob-nav');
    if(mnAct) mnAct.style.display = ''; // let CSS show it on mobile

    
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
  const allGardens = typeof AG === 'function' ? AG() : [...(window.GARDENS||[]), ...(window._GARDENS_EXTRA||[])];
  
  const gardens = [];
  const seen = new Set();
  for (let g of allGardens) {
    if (g.name) {
      const normalizedKey = g.name.trim().replace(/\s+/g, ' ') + '|' + (g.city || '').trim();
      if (!seen.has(normalizedKey)) {
        seen.add(normalizedKey);
        gardens.push(g);
      }
    }
  }

  const list = gardens.filter(g => (g.name||'').includes(q) || (g.city||'').includes(q) || String(g.id).includes(q)).slice(0,30);
  
  let html = '';
  // City options first
  const matchingCities = [...new Set(gardens.filter(g => g.city && g.city.includes(q)).map(g => g.city))];
  matchingCities.slice(0, 3).forEach(c => {
    html += `<div style="padding:5px; cursor:pointer; font-size:0.85rem; border-bottom:1px solid #eee; background:#e3f2fd; color:#1565c0; font-weight:bold;" onclick="document.getElementById('wt-inline-garden').value='${c}'; document.getElementById('wt-inline-garden-id').value=''; document.getElementById('wt-inline-city-name').value='${c}'; document.getElementById('wt-inline-garden-results').style.display='none';">🏙️ משימה לעיר: ${c}</div>`;
  });
  
  if(!list.length && !matchingCities.length) { res.innerHTML='<div style="padding:5px; color:#999; font-size:0.8rem;">לא נמצא...</div>'; res.style.display='block'; return; }
  html += list.map(g => `<div style="padding:5px; cursor:pointer; font-size:0.85rem; border-bottom:1px solid #eee;" data-id="${g.id}" data-name="${(g.name||'').replace(/"/g, '&quot;')}" onclick="document.getElementById('wt-inline-garden').value=this.dataset.name; document.getElementById('wt-inline-garden-id').value=this.dataset.id; document.getElementById('wt-inline-city-name').value=''; document.getElementById('wt-inline-garden-results').style.display='none';">${g.name} (${g.city||'אחר'})</div>`).join('');
  res.innerHTML = html;
  res.style.display='block';
};

window.wtAddInlineTask = function() {
  let gardenId = document.getElementById('wt-inline-garden-id').value;
  let cityName = document.getElementById('wt-inline-city-name') ? document.getElementById('wt-inline-city-name').value : '';
  const gNameInput = document.getElementById('wt-inline-garden').value.trim();
  
  if (!gardenId && !cityName && gNameInput) {
    const gardens = typeof AG === 'function' ? AG() : [...(window.GARDENS||[]), ...(window._GARDENS_EXTRA||[])];
    let match = gardens.find(g => g.name === gNameInput);
    if (!match) match = gardens.find(g => g.name.includes(gNameInput) || String(g.id) === gNameInput);
    if (match) {
      gardenId = match.id;
    } else {
      cityName = gNameInput;
    }
  }
  const desc = document.getElementById('wt-inline-desc').value.trim();
  const isAdminOnly = document.getElementById('wt-inline-admin').checked;
  
  if (!desc) {
     if(window.spAlert) window.spAlert('נא לכתוב תיאור למשימה', true);
     return;
  }
  
  window.WORKER_TASKS.push({
    id: 'wt_' + Date.now(),
    date: window.wtCurrentDate,
    gardenId: gardenId ? parseInt(gardenId) : 0,
    city: cityName || '',
    desc: desc,
    status: 'pending',
    doneAt: null,
    isAdminOnly: isAdminOnly
  });
  
  if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else window.save(true);
  window.renderWorkerTasksAdmin();
};

window.wtWorkerAddFreeNote = async function() {
  const note = await window.spPrompt("הקלד את ההודעה שלך מטה (תישמר כמשימה שבוצעה עם ההערה שלך):");
  if (!note) return;
  
  window.WORKER_TASKS.push({
    id: 'wt_note_' + Date.now(),
    date: window.wtCurrentDate || (window.td ? window.td() : new Date().toISOString().split('T')[0]),
    gardenId: 0,
    desc: 'הודעה כללית מהעובד',
    status: 'done',
    workerNote: note.trim(),
    workerName: window._fbUser?.displayName || window._fbUser?.email?.replace('@ganmanager.app','') || 'עובד',
    doneAt: (window.td ? window.td() : new Date().toISOString().split('T')[0]) + ' ' + new Date().toTimeString().split(' ')[0].substring(0, 5),
    doneBy: window._fbUser?.displayName || window._fbUser?.email?.replace('@ganmanager.app','') || 'עובד',
    isAdminOnly: false
  });
  
  if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else window.save(true);
  window.renderWorkerTasksMobile();
  if (window.spAlert) window.spAlert("ההודעה נשלחה בהצלחה!");
};





window.wtHardRefresh = async function() {
  if (await window.spConfirm('האם אתה בטוח שברצונך לבצע רענון קשיח? זה ימחק כל שינוי מקומי שלא נשמר וימשוך מחדש הכל מהענן.')) {
    // Clear local backups
    for(let i=localStorage.length-1; i>=0; i--) {
      const k = localStorage.key(i);
      if(k && k.startsWith('ganv5_backup_')) localStorage.removeItem(k);
    }
    window.WORKER_TASKS = [];
    if (window.loadFromFirebase) {
      await window.loadFromFirebase(false, true);
    } else {
      location.reload(true);
      return;
    }
    if (window.renderWorkerTasksAdmin) window.renderWorkerTasksAdmin();
    if (window.renderWorkerTasksMobile) window.renderWorkerTasksMobile();
  }
};
window.wtExportWord = async function(ds) {
  if (document.activeElement) document.activeElement.blur();
  if (window.loadFromFirebase) await window.loadFromFirebase(false, true);

  const includeDone = await window.spConfirm('האם לכלול משימות שכבר בוצעו בייצוא?');
  const today = window.td ? window.td() : new Date().toISOString().split('T')[0];
  const tasks = (window.WORKER_TASKS || []).filter(t => {
    if (t.isAdminOnly) return false;
    if (!includeDone && t.status === 'done') return false;
    if (t.date === ds) return true;
    if (ds === today && t.status === 'pending' && t.date < today) return true;
    return false;
  });
  
  // Sort to match UI
  tasks.sort((a,b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    return 0;
  });
  
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
      @page WordSection1 { size: 210mm 297mm; margin: 15mm; }
      div.WordSection1 { page: WordSection1; direction: rtl; font-family: Arial, sans-serif; }
      h1 { color: #1565c0; text-align: center; font-size: 20pt; margin-bottom: 5px; }
      h2 { color: #555; text-align: center; font-size: 14pt; margin-top: 0; margin-bottom: 20px; font-weight: normal; }
      .task { margin-bottom: 15px; font-size: 14pt; line-height: 1.5; }
      .task-text { display: inline; }
      .checkbox { font-family: 'Segoe UI Symbol', Arial; font-size: 16pt; margin-left: 8px; color: #333; }
      .notes { margin-top: 4px; font-size: 11pt; color: #666; margin-right: 25px; font-style: italic; }
      .print-line { border-bottom: 1pt solid #aaa; margin-top: 25pt; width: 100%; }
    </style>
  </head>
  <body>
    <div class='WordSection1'>
      <h1>משימות שטח</h1>
      <h2>${titleStr}</h2>`;
      
  tasks.forEach(t => {
    const gardenName = t.gardenId ? (window.G ? (window.G(t.gardenId)?.name || '') : '') : (t.city || '');
    const isDone = t.status === 'done';
    const box = isDone ? '&#x2611;' : '&#x25A2;';
    
    htmlContent += `
      <div class="task">
        <span class="checkbox">${box}</span>
        <span class="task-text">${gardenName ? `<b>${gardenName}</b> - ` : ''}${t.desc.replace(/\n/g, ' ')}</span>
        ${t.workerNote ? `<div class="notes">הערות ${t.workerName || 'עובד'}: ${t.workerNote}</div>` : ''}
      </div>`;
  });
  
  htmlContent += `
      <div style="margin-top:40pt; font-weight:bold; font-size:14pt; margin-bottom: 10pt;">הערות נוספות:</div>
      <div class="print-line"></div>
      <div class="print-line"></div>
      <div class="print-line"></div>
      <div class="print-line"></div>
      <div class="print-line"></div>
      <div class="print-line"></div>
    </div></body></html>`;
  
  const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `משימות_${ds}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

window.wtPrintTasks = async function(ds) {
  if (document.activeElement) document.activeElement.blur();
  if (window.loadFromFirebase) await window.loadFromFirebase(false, true);

  const today = window.td ? window.td() : new Date().toISOString().split('T')[0];
  const todayTasks = (window.WORKER_TASKS || []).filter(t => {
    if (t.isAdminOnly) return false;
    if (t.date === ds) return true;
    if (ds === today && t.status === 'pending' && t.date < today) return true;
    return false;
  });
  
  // Sort to match UI
  todayTasks.sort((a,b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    return 0;
  });

  if (todayTasks.length === 0) {
    if (window.spAlert) window.spAlert('אין משימות להדפסה ביום זה');
    else alert('אין משימות להדפסה ביום זה');
    return;
  }
  
  const tasks = todayTasks;
  
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
      @page { margin: 5mm 10mm; }
      body { font-family: Arial, sans-serif; direction: rtl; padding: 0; margin: 0; color: #000; text-align: right; }
      h1 { text-align: center; font-size: 22px; margin-top: 0; margin-bottom: 3px; color: #000; }
      h2 { text-align: center; font-size: 16px; margin-top: 0; margin-bottom: 25px; font-weight: normal; color: #444; }
      .task { margin-bottom: 12px; font-size: 14px; line-height: 1.4; overflow: hidden; }
      .checkbox { border: 1px solid #000; width: 14px; height: 14px; float: right; margin-left: 10px; border-radius: 3px; margin-top: 3px; }
      .task-content { display: block; margin-right: 30px; text-align: right; }
      .task-text { display: inline; }
      .notes { margin-top: 4px; font-size: 13px; color: #555; font-style: italic; }
      .done-check { text-align: center; line-height: 16px; font-size: 14px; font-weight: bold; }
      .free-text-section { page-break-inside: avoid; }
      .print-line { border-bottom: 1px solid #aaa; margin-top: 25px; width: 100%; }
    </style>
  </head>
  <body>
    <h1>משימות שטח</h1>
    <h2>${titleStr}</h2>
    <div>`;
      
  tasks.forEach(t => {
    let gardenName = '';
    if (t.city && !t.gardenId) {
      gardenName = t.city;
    } else if (t.gardenId !== -1 && window.G) {
      const gObj = window.G(t.gardenId);
      if (gObj) {
        gardenName = (gObj.city ? gObj.city + ' - ' : '') + (gObj.name || '');
      }
    }
    const isDone = t.status === 'done';
    const checkHTML = isDone ? '&#10003;' : '';
    
    htmlContent += `
      <div class="task">
        <div class="checkbox"><div class="done-check">${checkHTML}</div></div>
        <div class="task-content">
          <div class="task-text">${gardenName ? `<b>${gardenName}</b> - ` : ''}${t.desc.replace(/\n/g, ' ')}</div>
          ${t.workerNote ? `<div class="notes">הערות ${t.workerName || 'עובד'}: ${t.workerNote}</div>` : ''}
        </div>
      </div>`;
  });
  
  htmlContent += `</div>
    <div class="free-text-section">
      <div style="margin-top:40px; font-weight:bold; font-size:16px; margin-bottom: 10px;">הערות נוספות:</div>
      <div class="print-line"></div>
      <div class="print-line"></div>
      <div class="print-line"></div>
      <div class="print-line"></div>
      <div class="print-line"></div>
      <div class="print-line"></div>
    </div>
    <script>
      window.onload = function() { window.print(); window.close(); }
    </script>
  </body></html>`;

  const printWin = window.open('', '_blank');
  printWin.document.open();
  printWin.document.write(htmlContent);
  printWin.document.close();
};
