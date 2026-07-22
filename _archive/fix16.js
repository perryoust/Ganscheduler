const fs = require('fs');

// 1. Fix todo.js snooze behavior
let todo = fs.readFileSync('todo.js', 'utf8');

const targetPopup = `    const div = document.createElement('div');
    div.style.background = '#e65100';`;

const repPopup = `    if (document.getElementById('todo-popup-' + item.id)) return; // Prevent duplicates
    const div = document.createElement('div');
    div.id = 'todo-popup-' + item.id;
    div.style.background = '#e65100';`;

if (todo.includes(targetPopup)) {
  todo = todo.replace(targetPopup, repPopup);
}

const targetSnooze = `    div.querySelector('#btn-remind-snooze-' + item.id).onclick = () => {
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
    };`;

const repSnooze = `    div.querySelector('#btn-remind-snooze-' + item.id).onclick = () => {
      // Find the real item in case firebase sync replaced the items array
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
    };`;

if (todo.includes(targetSnooze)) {
  todo = todo.replace(targetSnooze, repSnooze);
  fs.writeFileSync('todo.js', todo);
  console.log('todo.js patched');
} else {
  console.log('Target snooze not found in todo.js');
}

// 2. Fix the Petah Tikva issue
// Replace 'פ"ת' with 'פתח תקווה'
// The user wants "פ"ת" to be "פתח תקווה" across the system, especially in the calendar filter.
// In core_app.js / cal.js, maybe there's a reference to "פ\"ת"?
// "כלל שינוי אוטומטי" - Let's add a global sanitization rule in database load or in AG()?

let dataManager = fs.readFileSync('data_manager.js', 'utf8');
if (!dataManager.includes('replacePT')) {
  const targetDM = `    if(window._fbAppData) {
      if(window._fbAppData.gardens) {`;
  
  const repDM = `    if(window._fbAppData) {
      if(window._fbAppData.gardens) {
        // Fix פ"ת -> פתח תקווה globally
        window._fbAppData.gardens.forEach(g => {
          if (g.city === 'פ"ת') g.city = 'פתח תקווה';
        });`;
        
  if (dataManager.includes(targetDM)) {
    dataManager = dataManager.replace(targetDM, repDM);
    fs.writeFileSync('data_manager.js', dataManager);
    console.log('data_manager.js patched');
  }
}

// Also let's patch the gardens array in memory if needed
let gardensjs = fs.readFileSync('gardens.js', 'utf8');
let gardensjsChanged = false;
if (gardensjs.includes('פ"ת')) {
  gardensjs = gardensjs.replace(/city:\s*['"]פ"ת['"]/g, "city: 'פתח תקווה'");
  fs.writeFileSync('gardens.js', gardensjs);
  console.log('gardens.js patched');
}

