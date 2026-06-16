import os

with open('todo.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix duplicates
target1 = """    const div = document.createElement('div');
    div.style.background = '#e65100';"""
rep1 = """    if (document.getElementById('todo-popup-' + item.id)) return; // Prevent duplicates
    const div = document.createElement('div');
    div.id = 'todo-popup-' + item.id;
    div.style.background = '#e65100';"""

content = content.replace(target1, rep1)

# Fix click handlers
target2 = """    div.querySelector('#btn-remind-done-' + item.id).onclick = () => {
      this.toggleDone(item.id);
      div.remove();
    };
    div.querySelector('#btn-remind-close-' + item.id).onclick = () => {
      div.remove();
    };
    div.querySelector('#btn-remind-snooze-' + item.id).onclick = () => {
      // Add 15 minutes (900000 ms)
      item.remindAt = Date.now() + 900000;
      item.remindTriggered = false;
      this.save();
      div.remove();
    };
    div.querySelector('#btn-remind-reschedule-' + item.id).onclick = () => {
      const val = div.querySelector('#input-remind-reschedule-' + item.id).value;
      if (val) {
        item.remindAt = new Date(val).getTime();
        item.remindTriggered = false;
        this.save();
        div.remove();
      }
    };"""

rep2 = """    div.querySelector('#btn-remind-done-' + item.id).onclick = () => {
      const realItem = this.items.find(i => i.id === item.id) || item;
      realItem.done = true;
      realItem.remindTriggered = true;
      this.save();
      div.remove();
    };
    div.querySelector('#btn-remind-close-' + item.id).onclick = () => {
      div.remove();
    };
    div.querySelector('#btn-remind-snooze-' + item.id).onclick = () => {
      // Add 15 minutes (900000 ms)
      const realItem = this.items.find(i => i.id === item.id) || item;
      realItem.remindAt = Date.now() + 900000;
      realItem.remindTriggered = false;
      this.save();
      div.remove();
    };
    div.querySelector('#btn-remind-reschedule-' + item.id).onclick = () => {
      const val = div.querySelector('#input-remind-reschedule-' + item.id).value;
      if (val) {
        const realItem = this.items.find(i => i.id === item.id) || item;
        realItem.remindAt = new Date(val).getTime();
        realItem.remindTriggered = false;
        this.save();
        div.remove();
      }
    };"""

content = content.replace(target2, rep2)

with open('todo.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("todo.js patched successfully")
