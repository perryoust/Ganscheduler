window.todo = {
  items: [],
  
  init: function() {
    this.load();
    this.render();
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
      const html = `
        <div class="todo-item ${item.done ? 'done' : ''}" style="display:flex; align-items:flex-start; gap:10px; padding:10px; background:#f9f9f9; border-radius:6px; transition:all 0.3s; ${item.done?'opacity:0.6; text-decoration:line-through':''}">
          <input type="checkbox" class="todo-checkbox" style="width:18px;height:18px;margin-top:2px;cursor:pointer;" 
            ${item.done ? 'checked' : ''} onchange="window.todo.toggleDone('${item.id}')">
          <div class="todo-text" style="flex:1; font-size:0.95rem;">${item.text}</div>
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
    const text = input.value.trim();
    if (!text) return;

    this.items.unshift({
      id: 't_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      text: text,
      done: false,
      ts: Date.now()
    });

    input.value = '';
    this.save();
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

  openModal: function() {
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
  }
};

// Auto-init on load
setTimeout(() => window.todo.init(), 1000);
