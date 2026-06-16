const fs = require('fs');

let todo = fs.readFileSync('todo.js', 'utf8');

const tSnooze = `div.querySelector('#btn-remind-snooze-' + item.id).onclick = () => {
      // Add 15 minutes (900000 ms)
      item.remindAt = Date.now() + 900000;
      item.remindTriggered = false;
      this.save();
      div.remove();
    };`;

const rSnooze = `div.querySelector('#btn-remind-snooze-' + item.id).onclick = () => {
      const realItem = this.items.find(i => i.id === item.id) || item;
      realItem.remindAt = Date.now() + 900000;
      realItem.remindTriggered = false;
      this.save();
      div.remove();
    };`;

const tReschedule = `div.querySelector('#btn-remind-reschedule-' + item.id).onclick = () => {
      const val = div.querySelector('#input-remind-reschedule-' + item.id).value;
      if (val) {
        item.remindAt = new Date(val).getTime();
        item.remindTriggered = false;
        this.save();
        div.remove();
      }
    };`;

const rReschedule = `div.querySelector('#btn-remind-reschedule-' + item.id).onclick = () => {
      const val = div.querySelector('#input-remind-reschedule-' + item.id).value;
      if (val) {
        const realItem = this.items.find(i => i.id === item.id) || item;
        realItem.remindAt = new Date(val).getTime();
        realItem.remindTriggered = false;
        this.save();
        div.remove();
      }
    };`;

const tDone = `div.querySelector('#btn-remind-done-' + item.id).onclick = () => {
      this.toggleDone(item.id);
      div.remove();
    };`;
    
const rDone = `div.querySelector('#btn-remind-done-' + item.id).onclick = () => {
      const realItem = this.items.find(i => i.id === item.id) || item;
      realItem.done = true;
      realItem.remindTriggered = true;
      this.save();
      div.remove();
    };`;


if (todo.includes(tSnooze)) {
    todo = todo.replace(tSnooze, rSnooze);
    todo = todo.replace(tReschedule, rReschedule);
    todo = todo.replace(tDone, rDone);
    fs.writeFileSync('todo.js', todo);
    console.log('Patched todo.js snooze successfully');
} else {
    console.log('Could not find snooze pattern');
}
