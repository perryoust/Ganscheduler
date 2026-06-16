import os

with open('worker_tasks.js', 'r', encoding='utf-8') as f:
    wt = f.read()

target = """    workerApp.style.backgroundColor = '#f5f7ff';
    workerApp.style.zIndex = '100000'; // Above everything else
    workerApp.style.overflowY = 'auto';
    workerApp.innerHTML = `
      <div style="background:linear-gradient(135deg, #1565c0, #1a237e); color:white; padding:15px; text-align:center; position:sticky; top:0; box-shadow:0 2px 10px rgba(0,0,0,0.2); z-index:10; display:flex; justify-content:space-between; align-items:center;">
        <div style="font-weight:bold; font-size:1.2rem;">👷 המשימות שלי</div>
        <button onclick="if(window.loadFromFirebase) { this.innerText='מרענן...'; window.loadFromFirebase(false, true).then(()=>window.renderWorkerTasksMobile()); } else location.reload();" style="background:rgba(255,255,255,0.2); border:none; border-radius:6px; color:white; padding:6px 12px; font-size:0.8rem; cursor:pointer;">רענן נתונים 🔄</button>
      </div>
      <div id="worker-tasks-mobile-list" style="padding:15px; padding-bottom:50px;">
        <!-- Worker list rendered here -->
      </div>
    `;"""

rep = """    workerApp.style.background = 'linear-gradient(180deg, #5b6ed1, #485ab9)';
    workerApp.style.zIndex = '100000'; // Above everything else
    workerApp.style.overflowY = 'auto';
    workerApp.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:20px 20px 0 20px;">
        <button onclick="if(window.loadFromFirebase) { this.innerText='מרענן...'; window.loadFromFirebase(false, true).then(()=>{this.innerText='רענן נתונים 🔄'; window.renderWorkerTasksMobile();}); } else location.reload();" style="background:rgba(255,255,255,0.2); border:none; border-radius:8px; color:white; padding:6px 12px; font-size:0.8rem; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.1);">רענן נתונים 🔄</button>
        <button onclick="window.workerLogout()" style="background:transparent; color:#fff; border:none; font-size:1.5rem; cursor:pointer; opacity:0.8;" title="התנתק">🚪</button>
      </div>
      <div id="worker-tasks-mobile-list" style="padding:15px; padding-bottom:50px;">
        <!-- Worker list rendered here -->
      </div>
    `;"""

# Also remove the duplicate logout button from renderWorkerTasksMobile
target_logout = """  // Logout button at bottom
  html += `
    <div style="margin-top:40px; text-align:center;">
      <button onclick="window.workerLogout()" style="background:transparent; color:#95a5a6; border:1px solid #ccc; border-radius:20px; padding:8px 20px; font-size:0.9rem;">התנתק מהמערכת</button>
    </div>
  `;"""

rep_logout = """"""

if target in wt:
    wt = wt.replace(target, rep)
    wt = wt.replace(target_logout, rep_logout)
    with open('worker_tasks.js', 'w', encoding='utf-8') as f:
        f.write(wt)
    print("worker_tasks.js header and background patched")
else:
    print("Target block not found in worker_tasks.js")
