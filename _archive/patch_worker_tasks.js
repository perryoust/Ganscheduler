const fs = require('fs');
let content = fs.readFileSync('worker_tasks.js', 'utf8');

// 1. Update Admin UI to show worker note
content = content.replace(
  '<th style="padding:10px;">סטטוס</th>',
  '<th style="padding:10px;">סטטוס / הערות עובד</th>'
);

content = content.replace(
  'const statusHtml = isDone',
  'const noteHtml = t.workerNote ? `<div style="margin-top:5px; font-size:0.8rem; color:#666; background:#f5f5f5; padding:4px 8px; border-radius:4px;">💬 ${t.workerNote}</div>` : "";\n    const statusHtml = isDone'
);

content = content.replace(
  '<td style="padding:12px 10px;">${statusHtml}</td>',
  '<td style="padding:12px 10px;">${statusHtml}${noteHtml}</td>'
);

// 2. Update Worker UI to show a text area for notes before clicking "Done"
content = content.replace(
  '<button onclick="window.markTaskDone(\\'${t.id}\\')"',
  '<textarea id="wt-note-${t.id}" placeholder="הערות לביצוע (אופציונלי)..." style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box; resize:vertical; font-family:inherit; margin-bottom:10px; font-size:0.9rem;"></textarea>\\n          <button onclick="window.markTaskDone(\\'${t.id}\\')"'
);

// 3. Update markTaskDone function to read the note
content = content.replace(
  "task.status = 'done';",
  "task.status = 'done';\\n    const noteEl = document.getElementById('wt-note-' + id);\\n    if (noteEl) task.workerNote = noteEl.value.trim();"
);

fs.writeFileSync('worker_tasks.js', content);
console.log('patched worker_tasks.js');
