const fs = require('fs');
let content = fs.readFileSync('firebase_init.js', 'utf8');

const targetStr = `window.role = role;

    const authOverlay = document.getElementById('auth-overlay');
    if (authOverlay) authOverlay.style.display = 'none';
    const uname = document.getElementById('auth-user-name');
    if (uname) uname.textContent = '👤 ' + user.email.replace('@ganmanager.app', '');`;

const workerLogic = `
    if (role === 'worker') {
      if (typeof window.activateWorkerApp === 'function') {
        window.activateWorkerApp();
      }
      return;
    }
`;

content = content.replace(targetStr, targetStr + workerLogic);
fs.writeFileSync('firebase_init.js', content);
console.log('patched firebase_init.js');
