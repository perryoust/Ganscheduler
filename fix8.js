const fs = require('fs');

let fbi = fs.readFileSync('firebase_init.js', 'utf8');

// 1. In firebase_init.js, add strict worker role isolation
const roleCheck = `
    window.permPurch = permPurch;
    window.permAct = permAct;
    window.role = role;

    // Strict Worker Role Isolation
    if (role === 'worker') {
      const authOverlay = document.getElementById('auth-overlay');
      if (authOverlay) authOverlay.style.display = 'none';
      if (typeof window.activateWorkerApp === 'function') {
        window.activateWorkerApp();
      }
      return;
    }
`;
fbi = fbi.replace(
  "    window.permPurch = permPurch;\n    window.permAct = permAct;\n    window.role = role;",
  roleCheck
);
fs.writeFileSync('firebase_init.js', fbi);
console.log('firebase_init.js fixed');

// 2. In firebase.js, add workerTasks to liveData
let fb = fs.readFileSync('firebase.js', 'utf8');
const liveDataTarget = `
      spScannerFolderLinks: window.spScannerFolderLinks || {},
      todos: window.todo ? window.todo.items : []
    };`;
const liveDataReplace = `
      spScannerFolderLinks: window.spScannerFolderLinks || {},
      todos: window.todo ? window.todo.items : [],
      workerTasks: window.WORKER_TASKS || []
    };`;
fb = fb.replace(liveDataTarget, liveDataReplace);
fs.writeFileSync('firebase.js', fb);
console.log('firebase.js fixed');

// 3. Update worker_tasks.js to support the new logout logic
let wt = fs.readFileSync('worker_tasks.js', 'utf8');
wt = wt.replace(
  "window.workerLogout = function() {\n  // Clear remember me\n  if (window._safeLS) window._safeLS.removeItem('ganv5_auth_user');\n  location.reload();\n};",
  "window.workerLogout = function() {\n  if (window._fbSignOut) window._fbSignOut();\n  if (window._safeLS) window._safeLS.removeItem('ganv5_auth_user');\n  location.reload();\n};"
);
fs.writeFileSync('worker_tasks.js', wt);
console.log('worker_tasks.js fixed');
