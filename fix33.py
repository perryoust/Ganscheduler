import os

# --- PATCH FIREBASE.JS (Recovery) ---
with open('firebase.js', 'r', encoding='utf-8') as f:
    fb = f.read()

target_fb = """        } else if (cloud.data && cloud.data.workerTasks) {
            window.WORKER_TASKS = cloud.data.workerTasks;
            if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase();
        } else {
            window.WORKER_TASKS = [];
        }"""
rep_fb = """        } else if (cloud.data && cloud.data.workerTasks && cloud.data.workerTasks.length > 0) {
            window.WORKER_TASKS = cloud.data.workerTasks;
            if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase();
        } else {
            try {
              let recovered = false;
              for(let i=0; i<localStorage.length; i++) {
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
              }
              if (!recovered) window.WORKER_TASKS = [];
            } catch(e) { window.WORKER_TASKS = []; }
        }"""
if target_fb in fb:
    fb = fb.replace(target_fb, rep_fb)
    with open('firebase.js', 'w', encoding='utf-8') as f:
        f.write(fb)
    print("firebase.js patched for recovery")
else:
    print("Target not found in firebase.js")

# --- PATCH WORKER_TASKS.JS (UI width) ---
with open('worker_tasks.js', 'r', encoding='utf-8') as f:
    wt = f.read()

target_wt = """  html += `
      </div>
    </div>
  `;
    if (!isSearch) {
    html += `
      <!-- Chat Input Area (WhatsApp style) -->
      <div class="wt-no-print" style="position:relative; width:100%; background:#f0f0f0; padding:10px; display:flex; align-items:center; gap:8px; border-radius:0 0 8px 8px; border-top:1px solid #e0e0e0;">"""
rep_wt = """  html += `
      </div>
  `;
  if (!isSearch) {
    html += `
      <!-- Chat Input Area (WhatsApp style) -->
      <div class="wt-no-print" style="position:relative; width:100%; background:#f0f0f0; padding:10px; display:flex; align-items:center; gap:8px; border-radius:0 0 8px 8px; border-top:1px solid #e0e0e0;">"""
if target_wt in wt:
    wt = wt.replace(target_wt, rep_wt)
else:
    print("Target 1 not found in worker_tasks.js")

# And we must add the second closing div AFTER the chat input!
target_wt2 = """        </button>
        
      </div>
    `;
  }

  container.innerHTML = html;
};"""
rep_wt2 = """        </button>
        
      </div>
    `;
  }

  html += `</div>`; // Close max-width wrapper
  container.innerHTML = html;
};"""
if target_wt2 in wt:
    wt = wt.replace(target_wt2, rep_wt2)
else:
    print("Target 2 not found in worker_tasks.js")

with open('worker_tasks.js', 'w', encoding='utf-8') as f:
    f.write(wt)
print("worker_tasks.js UI width patched")
