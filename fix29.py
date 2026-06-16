import os

# --- PATCH FIREBASE.JS ---
with open('firebase.js', 'r', encoding='utf-8') as f:
    fb = f.read()

# Remove workerTasks from liveData
target_liveData = """      activeGardens: window.activeGardens ? [...window.activeGardens] : null,
      workerTasks: window.WORKER_TASKS || [],
      useSraws: typeof window.useSraws !== 'undefined' ? window.useSraws : true,"""
rep_liveData = """      activeGardens: window.activeGardens ? [...window.activeGardens] : null,
      useSraws: typeof window.useSraws !== 'undefined' ? window.useSraws : true,"""
if target_liveData in fb:
    fb = fb.replace(target_liveData, rep_liveData)
else:
    print("WARNING: target_liveData not found in firebase.js")

# Add saveWorkerTasksToFirebase
target_saveFn = """async function saveToFirebase(silent = false, force = false) {"""
rep_saveFn = """window.saveWorkerTasksToFirebase = async function() {
  try {
    let tok = await window._fbUser?.getIdToken(false);
    if (!tok) return;
    const base = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';
    const url = `${base}/global_worker_tasks.json?auth=${tok}`;
    const r = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(window.WORKER_TASKS || [])
    });
    if (!r.ok) console.warn('[Sync] Failed to save worker tasks:', r.status);
    else console.log('[Sync] Worker tasks saved successfully');
  } catch (e) {
    console.error('[Sync] Error saving worker tasks', e);
  }
};

async function saveToFirebase(silent = false, force = false) {"""
if target_saveFn in fb:
    fb = fb.replace(target_saveFn, rep_saveFn)
else:
    print("WARNING: target_saveFn not found in firebase.js")

# Add load worker tasks
target_load = """    // Load Invoices Separately — merge file links from local copy to avoid losing them"""
rep_load = """    // Load Global Worker Tasks Separately
    try {
      const wtUrl = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/global_worker_tasks.json' + (tok ? '?auth=' + tok : '');
      const wtRes = await fetch(wtUrl + (wtUrl.includes('?') ? '&' : '?') + 'cb=' + Date.now());
      if (wtRes.ok) {
        const wtData = await wtRes.json();
        window.WORKER_TASKS = Array.isArray(wtData) ? wtData : Object.values(wtData || {});
        if (cloud.data && cloud.data.workerTasks) delete cloud.data.workerTasks; // Prevent overwrite from mega-blob
      }
    } catch(e) { console.warn('Failed to load global worker tasks', e); }

    // Load Invoices Separately — merge file links from local copy to avoid losing them"""
if target_load in fb:
    fb = fb.replace(target_load, rep_load)
else:
    print("WARNING: target_load not found in firebase.js")

with open('firebase.js', 'w', encoding='utf-8') as f:
    f.write(fb)
print("firebase.js patched.")


# --- PATCH WORKER_TASKS.JS ---
with open('worker_tasks.js', 'r', encoding='utf-8') as f:
    wt = f.read()

wt = wt.replace("if (window.save) window.save(true);", "if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else if (window.save) window.save(true);")
wt = wt.replace("window.save(true);", "if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(); else window.save(true);")

# Wait, check if there are any `window.save(true)` without `if`
with open('worker_tasks.js', 'w', encoding='utf-8') as f:
    f.write(wt)
print("worker_tasks.js patched.")

