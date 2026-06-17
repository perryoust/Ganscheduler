import os

with open('worker_tasks.js', 'r', encoding='utf-8') as f:
    wt = f.read()

# 1. Rename the button
target_btn = """<button onclick="if(window.loadFromFirebase) { const btn=this; btn.innerText='מרענן...'; window.loadFromFirebase(false, true).then(()=>{btn.innerText='🔄 רענן נתונים מול העובדים'; window.renderWorkerTasksAdmin();}); } else location.reload();" class="wt-no-print" style="background:#e3f2fd; border:1px solid #90caf9; padding:6px 12px; border-radius:20px; cursor:pointer; color:#1565c0; font-weight:bold; display:flex; align-items:center; gap:5px;" title="משוך נתונים מהענן כדי לראות אם העובד סיים משימות">🔄 רענן נתונים מול העובדים</button>"""
rep_btn = """<button onclick="if(window.loadFromFirebase) { const btn=this; btn.innerText='מסנכרן...'; window.loadFromFirebase(false, true).then(()=>{btn.innerText='🔄 סנכרן נתונים'; window.renderWorkerTasksAdmin();}); } else location.reload();" class="wt-no-print" style="background:#e3f2fd; border:1px solid #90caf9; padding:6px 12px; border-radius:20px; cursor:pointer; color:#1565c0; font-weight:bold; display:flex; align-items:center; gap:5px;" title="משוך נתונים מהענן כדי לראות מי העובד שסיים את המשימות">🔄 סנכרן נתונים</button>"""
if target_btn in wt: wt = wt.replace(target_btn, rep_btn)

# 2. Update markTaskDone
target_mtd = """    const tStr = now.toTimeString().split(' ')[0].substring(0, 5);
    task.doneAt = `${dStr} ${tStr}`;"""
rep_mtd = """    const tStr = now.toTimeString().split(' ')[0].substring(0, 5);
    task.doneAt = `${dStr} ${tStr}`;
    task.doneBy = window._fbUser?.displayName || window._fbUser?.email?.replace('@ganmanager.app','') || 'עובד';"""
if target_mtd in wt: wt = wt.replace(target_mtd, rep_mtd)

# 3. Update wtToggleTaskStatus
target_wts = """      const tStr = now.toTimeString().split(' ')[0].substring(0, 5);
      task.doneAt = `${dStr} ${tStr}`;
    }"""
rep_wts = """      const tStr = now.toTimeString().split(' ')[0].substring(0, 5);
      task.doneAt = `${dStr} ${tStr}`;
      task.doneBy = window._fbUser?.displayName || window._fbUser?.email?.replace('@ganmanager.app','') || 'עובד';
    }"""
if target_wts in wt: wt = wt.replace(target_wts, rep_wts)

# 4. Update the display strings
target_ds1 = """${t.doneAt ? `<span>(בוצע: ${t.doneAt})</span>` : ''}"""
rep_ds1 = """${t.doneAt ? `<span style="font-size:0.85rem; color:#8e8e93; font-style:italic;">(סומן ע"י ${t.doneBy || 'עובד'} ב-${t.doneAt})</span>` : ''}"""
if target_ds1 in wt: wt = wt.replace(target_ds1, rep_ds1)

target_ds2 = """<span>&#8226; ${t.doneAt ? t.doneAt.split(' ')[1] || t.doneAt : ''}</span>"""
rep_ds2 = """<span>&#8226; ע"י ${t.doneBy || 'עובד'} (${t.doneAt ? t.doneAt.split(' ')[1] || t.doneAt : ''})</span>"""
if target_ds2 in wt: wt = wt.replace(target_ds2, rep_ds2)

with open('worker_tasks.js', 'w', encoding='utf-8') as f:
    f.write(wt)
print("worker_tasks.js Sync logic patched")
