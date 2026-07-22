const fs = require('fs');

// Fix firebase_init.js
let init = fs.readFileSync('firebase_init.js', 'utf8');

const target1 = `    if (isStrictWorker) {
      const authOverlay = document.getElementById('auth-overlay');
      if (authOverlay) authOverlay.style.display = 'none';
      if (typeof window.activateWorkerApp === 'function') {
        window.activateWorkerApp();
      }`;

const rep1 = `    if (isStrictWorker) {
      const authOverlay = document.getElementById('auth-overlay');
      if (authOverlay) authOverlay.style.display = 'none';
      if (typeof window.activateWorkerApp === 'function') {
        window.activateWorkerApp();
      }
      if (typeof window._onAuthReady === 'function') window._onAuthReady();`;

if (init.includes(target1) && !init.includes('window._onAuthReady();` within isStrictWorker block')) { // using a dummy check for idempotency
  init = init.replace(target1, rep1);
  fs.writeFileSync('firebase_init.js', init);
  console.log('Patched firebase_init.js');
} else {
  console.log('firebase_init.js target not found or already patched.');
}

// Fix worker_tasks.js to add a refresh button
let wt = fs.readFileSync('worker_tasks.js', 'utf8');

const target2 = `        <button onclick="window.workerLogout()" style="background:transparent;border:1px solid rgba(255,255,255,0.4);color:white;padding:4px 8px;border-radius:4px;font-size:0.8rem">התנתק</button>
      </div>`;

const rep2 = `        <button onclick="if(window.loadFromFirebase) window.loadFromFirebase(false, true).then(()=>window.renderWorkerTasksMobile());" style="background:transparent;border:1px solid rgba(255,255,255,0.4);color:white;padding:4px 8px;border-radius:4px;font-size:0.8rem;margin-left:5px">🔄 רענן</button>
        <button onclick="window.workerLogout()" style="background:transparent;border:1px solid rgba(255,255,255,0.4);color:white;padding:4px 8px;border-radius:4px;font-size:0.8rem">התנתק</button>
      </div>`;

if (wt.includes(target2)) {
  wt = wt.replace(target2, rep2);
  fs.writeFileSync('worker_tasks.js', wt);
  console.log('Patched worker_tasks.js');
} else {
  console.log('worker_tasks.js target not found.');
}
