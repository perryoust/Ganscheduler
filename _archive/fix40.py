import os

with open('firebase.js', 'r', encoding='utf-8') as f:
    fb = f.read()

# 1. We need to add the merge function and update saveWorkerTasksToFirebase
merge_logic = """window.mergeWorkerTasksLocally = function(cloudData) {
  if (!cloudData) return;
  const cloudTasks = Array.isArray(cloudData) ? cloudData : Object.values(cloudData || {});
  if (cloudTasks.length === 0) return;
  
  const cloudMap = {};
  cloudTasks.forEach(t => cloudMap[t.id] = t);
  
  let mergedTasks = [];
  (window.WORKER_TASKS || []).forEach(t => {
    const ct = cloudMap[t.id];
    if (ct) {
      // Merge Status
      if (ct.status === 'done' && t.status === 'pending') {
        t.status = 'done';
        t.doneAt = ct.doneAt;
        t.doneBy = ct.doneBy;
      }
      // Note: If both are done, we could compare doneAt, but keeping local is fine if local just did it.
      
      // Merge Notes
      if (ct.workerNote && !t.workerNote) t.workerNote = ct.workerNote;
      else if (ct.workerNote && t.workerNote && ct.workerNote.length > t.workerNote.length) t.workerNote = ct.workerNote;
      
      // Merge Names
      if (ct.workerName && !t.workerName) t.workerName = ct.workerName;
      if (ct.doneBy && !t.doneBy) t.doneBy = ct.doneBy;
      
      delete cloudMap[t.id];
    }
    mergedTasks.push(t);
  });
  
  // Add any new tasks from cloud
  Object.values(cloudMap).forEach(ct => {
    mergedTasks.push(ct);
  });
  
  window.WORKER_TASKS = mergedTasks;
  if (window.renderWorkerTasksAdmin) window.renderWorkerTasksAdmin();
  if (window.renderWorkerTasksMobile) window.renderWorkerTasksMobile();
};

window.saveWorkerTasksToFirebase = async function(skipMerge = false) {
  try {
    let tok = await window._fbUser?.getIdToken(false);
    if (!tok) return;
    const base = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';
    const url = `${base}/data/global_worker_tasks.json?auth=${tok}`;
    
    if (!skipMerge) {
      try {
        const getRes = await fetch(url + '&cb=' + Date.now());
        if (getRes.ok) {
          const cloudData = await getRes.json();
          window.mergeWorkerTasksLocally(cloudData);
        }
      } catch(e) {
        console.warn('Merge fetch failed', e);
      }
    }

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
"""

target_save = """window.saveWorkerTasksToFirebase = async function() {
  try {
    let tok = await window._fbUser?.getIdToken(false);
    if (!tok) return;
    const base = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';
    const url = `${base}/data/global_worker_tasks.json?auth=${tok}`;
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
};"""

if target_save in fb: fb = fb.replace(target_save, merge_logic)

target_load = """      if (wtRes.ok) {
        const wtData = await wtRes.json();
        if (wtData) {
            window.WORKER_TASKS = Array.isArray(wtData) ? wtData : Object.values(wtData || {});
        } else if (cloud.data && cloud.data.workerTasks && cloud.data.workerTasks.length > 0) {"""

rep_load = """      if (wtRes.ok) {
        const wtData = await wtRes.json();
        if (wtData) {
            if (!window.WORKER_TASKS || window.WORKER_TASKS.length === 0) {
              window.WORKER_TASKS = Array.isArray(wtData) ? wtData : Object.values(wtData || {});
            } else {
              window.mergeWorkerTasksLocally(wtData);
            }
        } else if (cloud.data && cloud.data.workerTasks && cloud.data.workerTasks.length > 0) {"""

if target_load in fb: fb = fb.replace(target_load, rep_load)

with open('firebase.js', 'w', encoding='utf-8') as f:
    f.write(fb)
print("firebase.js true merge logic patched")
