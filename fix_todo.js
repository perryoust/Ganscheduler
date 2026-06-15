const fs = require('fs');
let code = fs.readFileSync('todo.js', 'utf8');

code = code.replace(/await window\.spConfirm\([^)]+\)/g, (match) => {
  if(match.includes('clearArchive') || match.includes('?????-? ?  ???x ?>??')) return 'האם למחוק את כל המשימות שהושלמו?\\nפעולה זו אינה ניתנת לביטול.';
  return wait window.spConfirm('למחוק משימה זו?');
});

code = code.replace(wait window.spConfirm('האם למחוק את כל המשימות שהושלמו?\\nפעולה זו אינה ניתנת לביטול.'), wait window.spConfirm('האם למחוק את כל המשימות שהושלמו?\\nפעולה זו אינה ניתנת לביטול.'));

code = code.replace(/await window\.spAlert\([^)]+\)/g, wait window.spAlert('אין משימות לייצוא'));

fs.writeFileSync('todo.js', code, 'utf8');

