const fs = require('fs');

// 1. Modify index.html
let html = fs.readFileSync('index.html', 'utf8');

// Remove from tabs-act
html = html.replace(/<div class="tab" onclick="ST\('worker_tasks'\)"[^>]*>👷 משימות שטח<\/div>\s*/g, '');

// Remove from mob-nav
html = html.replace(/<button class="mob-nav-btn" onclick="ST\('worker_tasks'\);mobNav\(this\)" data-tab="worker_tasks">.*?<\/button>\s*/g, '');

// Add to mode-bar (before modeBtn-admin)
if (!html.includes('id="modeBtn-worker"')) {
  html = html.replace(
    '<button class="mode-btn" id="modeBtn-admin"',
    '<button class="mode-btn" id="modeBtn-worker" onclick="ST(\'worker_tasks\')" title="ניהול משימות שטח">👷 משימות שטח</button>\n    <button class="mode-btn" id="modeBtn-admin"'
  );
}

// Add to mobile mode-bar? (Wait, in mobile, mode bar is actually the same, the CSS just displays it differently)

// Cache buster
html = html.replace(/worker_tasks\.js(\?v=\d+(\.\d+)?)?/g, 'worker_tasks.js?v=' + Date.now());

fs.writeFileSync('index.html', html);
console.log('index.html patched');

// 2. Modify worker_tasks.js
let js = fs.readFileSync('worker_tasks.js', 'utf8');

const oldSTHook = `// Hook into ST (Switch Tab) globally
const originalST = window.ST;
window.ST = function(tab) {
  if (tab === 'worker_tasks') {
    // Hide all tabs
    document.querySelectorAll('.content, .tabs').forEach(el => el.style.display = 'none');
    document.getElementById('c-worker_tasks').style.display = 'block';
    
    // Update active tab buttons
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    
    // Find the worker_tasks tab and make it active
    const wtab = Array.from(document.querySelectorAll('.tab')).find(el => el.getAttribute('onclick') === "ST('worker_tasks')");
    if (wtab) wtab.classList.add('active');
    
    window.renderWorkerTasksAdmin();
    return;
  }
  
  if (originalST) {
    originalST(tab);
  }
};`;

const newHooks = `// Hook into ST (Switch Tab) globally
const originalST = window.ST;
window.ST = function(tab) {
  if (tab === 'worker_tasks') {
    // Hide original content wrapper and tab bars
    const c = document.querySelector('.content');
    if (c) c.style.display = 'none';
    document.querySelectorAll('.tabs').forEach(el => el.style.display = 'none');
    
    const wt = document.getElementById('c-worker_tasks');
    if (wt) wt.style.display = 'block';
    
    // Update mode buttons
    document.getElementById('modeBtn-act').classList.remove('active');
    document.getElementById('modeBtn-purch').classList.remove('active');
    const adminBtn = document.getElementById('modeBtn-admin');
    if (adminBtn) adminBtn.classList.remove('active');
    
    const workerBtn = document.getElementById('modeBtn-worker');
    if (workerBtn) workerBtn.classList.add('active');
    
    window.renderWorkerTasksAdmin();
    return;
  }
  
  // If switching to something else, restore content
  const c = document.querySelector('.content');
  if(c) c.style.display = '';
  const wt = document.getElementById('c-worker_tasks');
  if(wt) wt.style.display = 'none';
  
  const workerBtn = document.getElementById('modeBtn-worker');
  if (workerBtn) workerBtn.classList.remove('active');
  
  if (originalST) {
    originalST(tab);
  }
};

// Hook into switchMode
const originalSwitchMode = window.switchMode;
window.switchMode = function(mode) {
  // Restore content
  const c = document.querySelector('.content');
  if(c) c.style.display = '';
  const wt = document.getElementById('c-worker_tasks');
  if(wt) wt.style.display = 'none';
  
  const workerBtn = document.getElementById('modeBtn-worker');
  if (workerBtn) workerBtn.classList.remove('active');

  if (originalSwitchMode) {
    originalSwitchMode(mode);
  }
};`;

if (js.includes('originalST = window.ST;')) {
  js = js.replace(oldSTHook, newHooks);
}

fs.writeFileSync('worker_tasks.js', js);
console.log('worker_tasks.js patched');
