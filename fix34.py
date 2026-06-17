import os

with open('firebase.js', 'r', encoding='utf-8') as f:
    fb = f.read()

target = """              for(let i=0; i<localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('ganv5_backup_')) {
                  const bkStr = localStorage.getItem(k);
                  const bkObj = JSON.parse(bkStr);
                  if (bkObj && bkObj.workerTasks && bkObj.workerTasks.length > 0) {
                    window.WORKER_TASKS = bkObj.workerTasks;
                    if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase();
                    recovered = true;
                    console.log('[Recovery] Restored worker tasks from local backup');
                    break;
                  }
                }
              }"""

rep = """              const keys = [];
              for(let i=0; i<localStorage.length; i++) keys.push(localStorage.key(i));
              keys.sort().reverse(); // Newest first
              for(const k of keys) {
                if (k && k.startsWith('ganv5_backup_')) {
                  const bkStr = localStorage.getItem(k);
                  const bkObj = JSON.parse(bkStr);
                  if (bkObj && bkObj.workerTasks && bkObj.workerTasks.length > 0) {
                    window.WORKER_TASKS = bkObj.workerTasks;
                    if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase();
                    recovered = true;
                    console.log('[Recovery] Restored worker tasks from local backup ' + k);
                    break;
                  }
                }
              }"""

if target in fb:
    fb = fb.replace(target, rep)
    with open('firebase.js', 'w', encoding='utf-8') as f:
        f.write(fb)
    print("firebase.js recovery loop fixed")
else:
    print("Target not found in firebase.js")
