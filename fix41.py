import os

with open('worker_tasks.js', 'r', encoding='utf-8') as f:
    wt = f.read()

# Add wtHardRefresh function
hard_refresh_func = """
window.wtHardRefresh = async function() {
  if (confirm('האם אתה בטוח שברצונך לבצע רענון קשיח? זה ימחק כל שינוי מקומי שלא נשמר וימשוך מחדש הכל מהענן.')) {
    // Clear local backups
    for(let i=localStorage.length-1; i>=0; i--) {
      const k = localStorage.key(i);
      if(k && k.startsWith('ganv5_backup_')) localStorage.removeItem(k);
    }
    window.WORKER_TASKS = [];
    if (window.loadFromFirebase) {
      await window.loadFromFirebase(false, true);
    } else {
      location.reload(true);
      return;
    }
    if (window.renderWorkerTasksAdmin) window.renderWorkerTasksAdmin();
    if (window.renderWorkerTasksMobile) window.renderWorkerTasksMobile();
  }
};
"""

# Inject before window.wtExportWord
idx = wt.find("window.wtExportWord =")
if idx != -1:
    wt = wt[:idx] + hard_refresh_func + wt[idx:]
else:
    wt += hard_refresh_func

# Add to Admin View
target_admin = """<button onclick="if(window.loadFromFirebase) { const btn=this; btn.innerText='מסנכרן...'; window.loadFromFirebase(false, true).then(()=>{btn.innerText='🔄 סנכרן נתונים'; window.renderWorkerTasksAdmin();}); } else location.reload();" class="wt-no-print" style="background:#e3f2fd; border:1px solid #90caf9; padding:6px 12px; border-radius:20px; cursor:pointer; color:#1565c0; font-weight:bold; display:flex; align-items:center; gap:5px;" title="משוך נתונים מהענן כדי לראות מי העובד שסיים את המשימות">🔄 סנכרן נתונים</button>"""
rep_admin = """<button onclick="if(window.loadFromFirebase) { const btn=this; btn.innerText='מסנכרן...'; window.loadFromFirebase(false, true).then(()=>{btn.innerText='🔄 סנכרן נתונים'; window.renderWorkerTasksAdmin();}); } else location.reload();" class="wt-no-print" style="background:#e3f2fd; border:1px solid #90caf9; padding:6px 12px; border-radius:20px; cursor:pointer; color:#1565c0; font-weight:bold; display:flex; align-items:center; gap:5px;" title="משוך נתונים מהענן כדי לראות מי העובד שסיים את המשימות">🔄 סנכרן נתונים</button>
          <button onclick="window.wtHardRefresh()" class="wt-no-print" style="background:#ffebee; border:1px solid #ef9a9a; padding:6px 12px; border-radius:20px; cursor:pointer; color:#c62828; font-weight:bold; display:flex; align-items:center; gap:5px;" title="מחיקת הזיכרון המקומי ומשיכה מחדש (עוקף זכרון פנימי)">⚠️ רענון קשיח</button>"""
if target_admin in wt: wt = wt.replace(target_admin, rep_admin)

# Add to Mobile View
target_mobile = """<button onclick="if(window.loadFromFirebase){ const b=this; b.innerText='מרענן...'; window.loadFromFirebase(false,true).then(()=>{b.innerText='🔄 רענן'; window.renderWorkerTasksMobile();}); }else location.reload();" style="background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.5); border-radius:20px; padding:4px 12px; color:#fff; cursor:pointer; display:flex; align-items:center; gap:5px; font-weight:bold;">🔄 רענן</button>"""
rep_mobile = """<button onclick="if(window.loadFromFirebase){ const b=this; b.innerText='מרענן...'; window.loadFromFirebase(false,true).then(()=>{b.innerText='🔄 רענן'; window.renderWorkerTasksMobile();}); }else location.reload();" style="background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.5); border-radius:20px; padding:4px 12px; color:#fff; cursor:pointer; display:flex; align-items:center; gap:5px; font-weight:bold;">🔄 רענן</button>
        <button onclick="window.wtHardRefresh()" style="background:rgba(255,0,0,0.2); border:1px solid rgba(255,100,100,0.5); border-radius:20px; padding:4px 12px; color:#ffcccc; cursor:pointer; display:flex; align-items:center; gap:5px; font-weight:bold;" title="רענון קשיח">⚠️</button>"""
if target_mobile in wt: wt = wt.replace(target_mobile, rep_mobile)

with open('worker_tasks.js', 'w', encoding='utf-8') as f:
    f.write(wt)
print("worker_tasks.js Hard Refresh patched")
