import os

with open('worker_tasks.js', 'r', encoding='utf-8') as f:
    wt = f.read()

# Replace display strings
t1 = "`<div style=\"margin-top:6px; font-size:0.85rem; color:#1565c0; background:#e3f2fd; padding:6px 10px; border-radius:6px; border-right:3px solid #64b5f6;\">💬 פתק עובד: ${t.workerNote.replace(/</g, '&lt;')}</div>`"
r1 = "`<div style=\"margin-top:6px; font-size:0.85rem; color:#1565c0; background:#e3f2fd; padding:6px 10px; border-radius:6px; border-right:3px solid #64b5f6;\">💬 הערות ${t.workerName || 'עובד'}: ${t.workerNote.replace(/</g, '&lt;')}</div>`"

t2 = "`<div style=\"margin-top:6px; font-size:0.85rem; color:#1565c0; background:#e3f2fd; padding:6px 10px; border-radius:6px;\">💬 פתק עובד: ${t.workerNote.replace(/</g, '&lt;')}</div>`"
r2 = "`<div style=\"margin-top:6px; font-size:0.85rem; color:#1565c0; background:#e3f2fd; padding:6px 10px; border-radius:6px;\">💬 הערות ${t.workerName || 'עובד'}: ${t.workerNote.replace(/</g, '&lt;')}</div>`"

if t1 in wt: wt = wt.replace(t1, r1)
if t2 in wt: wt = wt.replace(t2, r2)

# Update wtAddNote
t3 = """  if (newNote !== null) {
    task.workerNote = newNote.trim();
    if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else window.save(true);
    window.renderWorkerTasksAdmin();
  }"""
r3 = """  if (newNote !== null) {
    task.workerNote = newNote.trim();
    task.workerName = window._fbUser?.displayName || window._fbUser?.email?.replace('@ganmanager.app','') || 'עובד';
    if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else window.save(true);
    window.renderWorkerTasksAdmin();
  }"""

if t3 in wt: wt = wt.replace(t3, r3)

# Update wtSaveNote
t4 = """  if (task && task.workerNote !== val) {
    task.workerNote = val.trim();
    if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else window.save(true);
  }"""
r4 = """  if (task && task.workerNote !== val) {
    task.workerNote = val.trim();
    task.workerName = window._fbUser?.displayName || window._fbUser?.email?.replace('@ganmanager.app','') || 'עובד';
    if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else window.save(true);
  }"""

if t4 in wt: wt = wt.replace(t4, r4)

with open('worker_tasks.js', 'w', encoding='utf-8') as f:
    f.write(wt)
print("Updated worker_tasks.js with worker name feature")
