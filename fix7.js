const fs = require('fs');

let t = fs.readFileSync('todo.js', 'utf8');

// 1. Prevent duplicate popups for the same item
t = t.replace(
  "showReminderPopup: function(item) {\n    let container = document.getElementById('todo-reminders-container');",
  "showReminderPopup: function(item) {\n    if (document.getElementById('todo-popup-' + item.id)) return;\n    let container = document.getElementById('todo-reminders-container');"
);

// 2. Add id to the popup div
t = t.replace(
  "const div = document.createElement('div');\n    div.style.background = '#e65100';",
  "const div = document.createElement('div');\n    div.id = 'todo-popup-' + item.id;\n    div.style.background = '#e65100';"
);

// 3. Fix button queries to be scoped to the popup to avoid ID collisions
t = t.replace(/document\.getElementById\('btn-remind-/g, "div.querySelector('#btn-remind-");

// 4. Fix input query
t = t.replace(/document\.getElementById\('input-remind-/g, "div.querySelector('#input-remind-");

fs.writeFileSync('todo.js', t);
console.log('Fixed todo popup logic');
