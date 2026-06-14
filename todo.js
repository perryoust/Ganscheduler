window.todo = {
  items: [],
  
  init: function() {
    this.load();
    this.render();
    this.makeDraggable();
    setInterval(this.checkReminders.bind(this), 5000); // Check every 5 seconds for immediate response
  },

  load: function() {
    try {
      // Load from global appData if available, else localStorage
      if (window._fbAppData && window._fbAppData.todos) {
        this.items = window._fbAppData.todos;
      } else {
        this.items = JSON.parse(window._safeLS.getItem('ganv5_todos') || '[]');
      }
      if (!Array.isArray(this.items)) this.items = [];
    } catch (e) {
      this.items = [];
    }
  },

  save: function() {
    try {
      window._safeLS.setItem('ganv5_todos', JSON.stringify(this.items));
      // Hook into global save
      if (window.save) {
        window.save(true);
      }
    } catch (e) {
      console.error('Failed to save todos', e);
    }
    this.render();
  },

  render: function() {
    const listEl = document.getElementById('todo-list');
    const archiveEl = document.getElementById('todo-archive-list');
    const badgeEl = document.getElementById('todo-badge');
    const countEl = document.getElementById('todo-archive-count');
    
    if (!listEl || !archiveEl) return;

    let activeHtml = '';
    let archiveHtml = '';
    let activeCount = 0;
    let archiveCount = 0;

    this.items.forEach(item => {
      const remindTimeStr = item.remindAt ? new Date(item.remindAt).toLocaleString('he-IL', {dateStyle:'short', timeStyle:'short'}) : '';
      const bellColor = item.remindAt ? (item.remindTriggered ? '#9e9e9e' : '#1976d2') : '#9e9e9e';
      
      const html = `
        <div class="todo-item ${item.done ? 'done' : ''}" style="display:flex; align-items:flex-start; gap:10px; padding:10px; background:#f9f9f9; border-radius:6px; transition:all 0.3s; ${item.done?'opacity:0.6; text-decoration:line-through':''}">
          <input type="checkbox" class="todo-checkbox" style="width:18px;height:18px;margin-top:2px;cursor:pointer;" 
            ${item.done ? 'checked' : ''} onchange="window.todo.toggleDone('${item.id}')">
          <div style="flex:1; display:flex; flex-direction:column;">
            <div class="todo-text" style="font-size:0.95rem;">${item.text}</div>
            ${item.remindAt && !item.done ? `<div style="font-size:0.75rem; color:${item.remindTriggered?'#999':'#1976d2'}; margin-top:4px;">⏰ ${remindTimeStr}</div>` : ''}
          </div>
          ${!item.done ? `
            <div style="position:relative; display:inline-block; margin-top:2px;">
              <input type="datetime-local" title="הגדר תזכורת" 
                     style="position:absolute; opacity:0; width:24px; height:24px; cursor:pointer; right:0;"
                     onchange="window.todo.setReminder('${item.id}', this.value)"
                     value="${item.remindAt ? new Date(item.remindAt - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16) : ''}">
              <span style="font-size:1.2rem; color:${bellColor}; pointer-events:none; display:inline-block;">🔔</span>
            </div>
          ` : ''}
          <button onclick="window.todo.remove('${item.id}')" style="background:none;border:none;color:#d32f2f;cursor:pointer;font-size:1.1rem;padding:0 5px;">🗑️</button>
        </div>
      `;
      if (item.done) {
        archiveHtml += html;
        archiveCount++;
      } else {
        activeHtml += html;
        activeCount++;
      }
    });

    listEl.innerHTML = activeHtml || '<div style="color:#999; text-align:center; padding:20px;">אין משימות פתוחות 🎉</div>';
    archiveEl.innerHTML = archiveHtml || '<div style="color:#999; text-align:center; padding:10px;">אין משימות בארכיון</div>';
    
    if (badgeEl) {
      badgeEl.innerText = activeCount;
      badgeEl.style.display = activeCount > 0 ? 'flex' : 'none';
    }
    if (countEl) countEl.innerText = archiveCount;
  },

  add: function() {
    const input = document.getElementById('todo-input');
    if (!input) return;
    let text = input.value.trim();
    if (!text) return;

    let remindAt = null;
    const now = new Date();

    // Parse "DD/MM HH:MM" or "DD/MM HHMM" or "DD.MM HHMM"
    const regexDate = /^(\d{1,2})[\/\.](\d{1,2})\s+(\d{1,2}):?(\d{2})\s+(.*)$/;
    // Parse "HH:MM" or "HHMM"
    const regexTime = /^(\d{1,2}):?(\d{2})\s+(.*)$/;

    let m;
    if ((m = text.match(regexDate))) {
      let day = parseInt(m[1], 10);
      let month = parseInt(m[2], 10) - 1;
      let hour = parseInt(m[3], 10);
      let minute = parseInt(m[4], 10);
      text = m[5];

      let targetDate = new Date(now.getFullYear(), month, day, hour, minute, 0, 0);
      if (targetDate.getTime() < now.getTime() - 86400000) {
        targetDate.setFullYear(now.getFullYear() + 1);
      }
      remindAt = targetDate.getTime();
    } else if ((m = text.match(regexTime))) {
      let hour = parseInt(m[1], 10);
      let minute = parseInt(m[2], 10);
      text = m[3];

      let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
      if (targetDate.getTime() <= now.getTime()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      remindAt = targetDate.getTime();
    }

    const newItem = {
      id: 't_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      text: text,
      done: false,
      ts: Date.now()
    };

    if (remindAt) {
      newItem.remindAt = remindAt;
      newItem.remindTriggered = false;
    }

    this.items.unshift(newItem);

    input.value = '';
    this.save();
    if (remindAt) setTimeout(() => this.checkReminders(), 100);
  },

  toggleDone: function(id) {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.done = !item.done;
      this.save();
    }
  },

  remove: function(id) {
    if (!confirm('למחוק משימה זו?')) return;
    this.items = this.items.filter(i => i.id !== id);
    this.save();
  },

  clearArchive: function() {
    if (!confirm('למחוק את כל ההיסטוריה? פעולה זו אינה ניתנת לביטול.')) return;
    this.items = this.items.filter(i => !i.done);
    this.save();
  },

  exportToExcel: function() {
    if (!this.items.length) {
      alert('אין משימות לייצוא');
      return;
    }
    
    // Check if ExcelJS is loaded for true XLSX export
    if (typeof ExcelJS !== 'undefined') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('משימות');
      ws.views = [{ rightToLeft: true }];
      
      ws.columns = [
        { header: 'מזהה', key: 'id', width: 20 },
        { header: 'משימה', key: 'text', width: 50 },
        { header: 'נוצרה ב', key: 'created', width: 20 },
        { header: 'תזכורת', key: 'remind', width: 20 },
        { header: 'הושלמה?', key: 'done', width: 10 }
      ];
      
      // Add styling to headers
      ws.getRow(1).font = { bold: true };
      
      this.items.forEach(item => {
        ws.addRow({
          id: item.id,
          text: item.text,
          created: item.ts ? new Date(item.ts).toLocaleString('he-IL') : '',
          remind: item.remindAt ? new Date(item.remindAt).toLocaleString('he-IL') : '',
          done: item.done ? 'כן' : 'לא'
        });
      });
      
      wb.xlsx.writeBuffer().then(buf => {
        const blob = new Blob([buf], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'משימות_' + new Date().toISOString().slice(0,10) + '.xlsx';
        link.click();
      }).catch(e => {
        console.error('XLSX Export failed, falling back to CSV', e);
        this._fallbackCSVExport();
      });
    } else {
      this._fallbackCSVExport();
    }
  },

  _fallbackCSVExport: function() {
    const rows = [
      ['מזהה', 'משימה', 'נוצרה ב', 'תזכורת', 'הושלמה?']
    ];
    this.items.forEach(item => {
      rows.push([
        item.id,
        item.text,
        item.ts ? new Date(item.ts).toLocaleString('he-IL') : '',
        item.remindAt ? new Date(item.remindAt).toLocaleString('he-IL') : '',
        item.done ? 'כן' : 'לא'
      ]);
    });
    const csvContent = '\uFEFF' + rows.map(e => e.map(cell => '"' + (cell||'').toString().replace(/"/g, '""') + '"').join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'משימות_' + new Date().toISOString().slice(0,10) + '.csv';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  openModal: function() {
    if (this._hasMoved) { this._hasMoved = false; return; }
    const m = document.getElementById('todo-m');
    if(m) {
      m.style.display = 'block';
      setTimeout(() => document.getElementById('todo-input').focus(), 100);
      
      // Close on outside click
      if (!this._clickListenerAdded) {
        document.addEventListener('click', this.handleOutsideClick.bind(this));
        this._clickListenerAdded = true;
      }
    }
  },

  closeModal: function() {
    const m = document.getElementById('todo-m');
    if(m) m.style.display = 'none';
  },

  handleOutsideClick: function(e) {
    const m = document.getElementById('todo-m');
    const fab = document.getElementById('todo-fab');
    if (m && m.style.display === 'block') {
      if (!m.contains(e.target) && !fab.contains(e.target)) {
        this.closeModal();
      }
    }
  },

  toggleArchive: function() {
    const el = document.getElementById('todo-archive-list');
    if (el) {
      el.style.display = el.style.display === 'none' ? 'flex' : 'none';
    }
  },

  setReminder: function(id, val) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    if (!val) {
      delete item.remindAt;
      delete item.remindTriggered;
    } else {
      item.remindAt = new Date(val).getTime();
      item.remindTriggered = false;
    }
    this.save();
    if (val) setTimeout(() => this.checkReminders(), 100);
  },

  checkReminders: function() {
    const now = Date.now();
    let changed = false;
    this.items.forEach(item => {
      if (!item.done && item.remindAt && !item.remindTriggered && item.remindAt <= now) {
        item.remindTriggered = true;
        changed = true;
        this.triggerAlarm(item);
      }
    });
    if (changed) this.save();
  },

  triggerAlarm: function(item) {
    this.playBeep();
    this.showReminderPopup(item);
  },

  playBeep: function() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 800; // 800Hz beep
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch(e) {}
  },

  showReminderPopup: function(item) {
    let container = document.getElementById('todo-reminders-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'todo-reminders-container';
      container.style.position = 'fixed';
      container.style.top = '40px';
      container.style.left = '50%';
      container.style.transform = 'translateX(-50%)';
      container.style.zIndex = '999999';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '15px';
      container.style.maxHeight = '90vh';
      container.style.overflowY = 'auto';
      container.style.padding = '10px';
      document.body.appendChild(container);
    }
    const div = document.createElement('div');
    div.style.background = '#e65100';
    div.style.color = '#fff';
    div.style.padding = '24px';
    div.style.borderRadius = '12px';
    div.style.boxShadow = '0 15px 50px rgba(0,0,0,0.4)';
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.gap = '15px';
    div.style.minWidth = '320px';
    div.style.textAlign = 'center';
    div.style.border = '3px solid #fff';
    
    div.innerHTML = `
      <div style="font-size:2rem;">⏰</div>
      <div style="font-size:1.4rem; font-weight:800;">תזכורת למשימה!</div>
      <div style="font-size:1.2rem; font-weight:600; margin:10px 0; background:rgba(255,255,255,0.1); padding:10px; border-radius:6px;">${item.text}</div>
      <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">
        <div style="display:flex; gap:10px; justify-content:center;">
          <button id="btn-remind-done-${item.id}" style="background:#fff; color:#e65100; border:none; padding:10px 20px; border-radius:6px; font-weight:bold; font-size:1rem; cursor:pointer;">סמן כבוצע</button>
          <button id="btn-remind-close-${item.id}" style="background:none; color:#fff; border:2px solid #fff; padding:10px 20px; border-radius:6px; font-size:1rem; cursor:pointer;" title="משאיר ברשימת המשימות">סגור</button>
        </div>
        <button id="btn-remind-snooze-${item.id}" style="background:none; color:#ffd54f; border:none; padding:5px; text-decoration:underline; cursor:pointer; font-size:0.9rem;">נודניק (הזכר שוב בעוד 15 דקות)</button>
        <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-top:5px; border-top:1px solid rgba(255,255,255,0.3); padding-top:10px;">
           <span style="font-size:0.85rem;">או דחה לשעה:</span>
           <input type="datetime-local" id="input-remind-reschedule-${item.id}" style="padding:4px; border-radius:4px; border:none; outline:none; font-size:0.85rem; color:#333;">
           <button id="btn-remind-reschedule-${item.id}" style="background:#4caf50; color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:0.85rem;">שמור</button>
        </div>
      </div>
    `;
    
    container.appendChild(div);
    
    document.getElementById('btn-remind-done-' + item.id).onclick = () => {
      this.toggleDone(item.id);
      div.remove();
    };
    document.getElementById('btn-remind-close-' + item.id).onclick = () => {
      div.remove();
    };
    document.getElementById('btn-remind-snooze-' + item.id).onclick = () => {
      // Add 15 minutes (900000 ms)
      item.remindAt = Date.now() + 900000;
      item.remindTriggered = false;
      this.save();
      div.remove();
    };
    document.getElementById('btn-remind-reschedule-' + item.id).onclick = () => {
      const val = document.getElementById('input-remind-reschedule-' + item.id).value;
      if (val) {
        item.remindAt = new Date(val).getTime();
        item.remindTriggered = false;
        this.save();
        div.remove();
      }
    };
  },

  makeDraggable: function() {
    const fab = document.getElementById('todo-fab');
    if (!fab) return;
    let isDragging = false;
    let startY, startBottom;

    const onStart = (e) => {
      if (e.target.tagName.toLowerCase() === 'button' || e.target.closest('button')) return;
      isDragging = true;
      this._hasMoved = false;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startY = clientY;
      const computed = window.getComputedStyle(fab);
      startBottom = parseInt(computed.bottom, 10) || 90;
      fab.style.transition = 'none';
    };

    const onMove = (e) => {
      if (!isDragging) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const deltaY = startY - clientY;
      if (Math.abs(deltaY) > 5) {
        this._hasMoved = true;
      }
      if (this._hasMoved) {
        e.preventDefault(); // Prevent scrolling while dragging
        let newBottom = startBottom + deltaY;
        if (newBottom < 20) newBottom = 20;
        const maxBottom = window.innerHeight - 80;
        if (newBottom > maxBottom) newBottom = maxBottom;
        fab.style.bottom = newBottom + 'px';
      }
    };

    const onEnd = (e) => {
      if (!isDragging) return;
      isDragging = false;
      fab.style.transition = '';
      setTimeout(() => { if(this._hasMoved) this._hasMoved = false; }, 50);
    };

    fab.addEventListener('touchstart', onStart, {passive: false});
    document.addEventListener('touchmove', onMove, {passive: false});
    document.addEventListener('touchend', onEnd);
    
    fab.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
  }
};

// Auto-init on load
setTimeout(() => window.todo.init(), 1000);
