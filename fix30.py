import os

with open('firebase.js', 'r', encoding='utf-8') as f:
    fb = f.read()

target = """    // Load Global Worker Tasks Separately
    try {
      const wtUrl = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/global_worker_tasks.json' + (tok ? '?auth=' + tok : '');
      const wtRes = await fetch(wtUrl + (wtUrl.includes('?') ? '&' : '?') + 'cb=' + Date.now());
      if (wtRes.ok) {
        const wtData = await wtRes.json();
        window.WORKER_TASKS = Array.isArray(wtData) ? wtData : Object.values(wtData || {});
        if (cloud.data && cloud.data.workerTasks) delete cloud.data.workerTasks; // Prevent overwrite from mega-blob
      }
    } catch(e) { console.warn('Failed to load global worker tasks', e); }"""

rep = """    // Load Global Worker Tasks Separately
    try {
      const wtUrl = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/global_worker_tasks.json' + (tok ? '?auth=' + tok : '');
      const wtRes = await fetch(wtUrl + (wtUrl.includes('?') ? '&' : '?') + 'cb=' + Date.now());
      if (wtRes.ok) {
        const wtData = await wtRes.json();
        if (wtData) {
            window.WORKER_TASKS = Array.isArray(wtData) ? wtData : Object.values(wtData || {});
        } else if (cloud.data && cloud.data.workerTasks) {
            window.WORKER_TASKS = cloud.data.workerTasks;
            if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase();
        } else {
            window.WORKER_TASKS = [];
        }
        if (cloud.data && cloud.data.workerTasks) delete cloud.data.workerTasks; // Prevent overwrite from mega-blob
      }
    } catch(e) { console.warn('Failed to load global worker tasks', e); }"""

if target in fb:
    fb = fb.replace(target, rep)
    with open('firebase.js', 'w', encoding='utf-8') as f:
        f.write(fb)
    print("Migration added to firebase.js")
else:
    print("Target not found for migration")
