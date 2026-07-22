import os

with open('worker_tasks.js', 'r', encoding='utf-8') as f:
    wt = f.read()

target1 = """  // FILTER OUT ADMIN ONLY TASKS AND ONLY SHOW TODAY'S TASKS
  const today = window.td ? window.td() : new Date().toISOString().split('T')[0];
  const tasks = (window.WORKER_TASKS || []).filter(t => !t.isAdminOnly && t.date === today);"""

rep1 = """  // FILTER OUT ADMIN ONLY TASKS AND ONLY SHOW TODAY'S TASKS (or older pending)
  const today = window.td ? window.td() : new Date().toISOString().split('T')[0];
  const tasks = (window.WORKER_TASKS || []).filter(t => {
    if (t.isAdminOnly) return false;
    if (t.status === 'pending') return t.date <= today; // Show past pending tasks!
    return t.date === today; // Only show today's completed tasks
  });"""

if target1 in wt: wt = wt.replace(target1, rep1)

target2 = """    html += `<div style="font-weight:bold; color:#fff; margin-bottom:10px; font-size:1.8rem; text-shadow:0 1px 2px rgba(0,0,0,0.2);">המשימות שלי</div>`;"""
rep2 = """    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <div style="font-weight:bold; color:#fff; font-size:1.8rem; text-shadow:0 1px 2px rgba(0,0,0,0.2);">המשימות שלי</div>
        <button onclick="if(window.loadFromFirebase){ const b=this; b.innerText='מרענן...'; window.loadFromFirebase(false,true).then(()=>{b.innerText='🔄 רענן'; window.renderWorkerTasksMobile();}); }else location.reload();" style="background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.5); border-radius:20px; padding:4px 12px; color:#fff; cursor:pointer; display:flex; align-items:center; gap:5px; font-weight:bold;">🔄 רענן</button>
      </div>
    `;"""

if target2 in wt: wt = wt.replace(target2, rep2)

target3 = """  if (pending.length === 0) {
    html += `
      <div style="text-align:center; padding:40px 20px; background:#fff; border-radius:16px; box-shadow:0 4px 15px rgba(0,0,0,0.05); margin-bottom:20px;">"""
rep3 = """  if (pending.length === 0) {
    html += `
      <div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
        <button onclick="if(window.loadFromFirebase){ const b=this; b.innerText='מרענן...'; window.loadFromFirebase(false,true).then(()=>{b.innerText='🔄 רענן'; window.renderWorkerTasksMobile();}); }else location.reload();" style="background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.5); border-radius:20px; padding:4px 12px; color:#fff; cursor:pointer; display:flex; align-items:center; gap:5px; font-weight:bold;">🔄 רענן</button>
      </div>
      <div style="text-align:center; padding:40px 20px; background:#fff; border-radius:16px; box-shadow:0 4px 15px rgba(0,0,0,0.05); margin-bottom:20px;">"""

if target3 in wt: wt = wt.replace(target3, rep3)

with open('worker_tasks.js', 'w', encoding='utf-8') as f:
    f.write(wt)
print("worker_tasks.js mobile refresh patched")
