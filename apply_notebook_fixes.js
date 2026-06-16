const fs = require('fs');
let text = fs.readFileSync('worker_tasks.js', 'utf8');

// 1. Fix the RTL margin line and padding for the notebook
const oldDiaryView = `      <!-- Diary View -->
      <div style="background-color:#fdf8e4; background-image: repeating-linear-gradient(transparent, transparent 39px, #e0e0e0 39px, #e0e0e0 40px); background-attachment: local; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.08); padding:20px 40px; min-height:400px; position:relative; border-right:2px solid #e57373; line-height: 40px;">
        <!-- Left red margin line -->
        <div style="position:absolute; left:40px; top:0; bottom:0; width:1px; background-color:#e57373; opacity:0.5;"></div>`;

const newDiaryView = `      <!-- Diary View -->
      <div style="background-color:#fdf8e4; background-image: repeating-linear-gradient(transparent, transparent 39px, #e0e0e0 39px, #e0e0e0 40px); background-attachment: local; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.08); padding:20px 20px 20px 20px; padding-right:60px; min-height:400px; position:relative; border-right:2px solid #e57373; line-height: 40px;">
        <!-- Right red margin line (RTL Notebook) -->
        <div style="position:absolute; right:45px; top:0; bottom:0; width:1px; background-color:#e57373; opacity:0.5;"></div>`;

text = text.replace(oldDiaryView, newDiaryView);

// 2. Add print button to the header
const oldHeader = `        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <div style="position:relative;">
            <input type="text" placeholder="חיפוש משימות..." value="\${window.wtSearchQuery}" onkeyup="window.wtDoSearch(this.value)" style="padding:8px 12px; padding-right:30px; border:1px solid #ccc; border-radius:20px; width:180px; font-size:0.9rem;">
            <span style="position:absolute; right:10px; top:8px; opacity:0.5;">🔍</span>
          </div>
          
        </div>`;

const newHeader = `        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button onclick="window.print()" class="wt-no-print" style="background:#fff; border:1px solid #ccc; padding:6px 12px; border-radius:20px; cursor:pointer; color:#1565c0; font-weight:bold; display:flex; align-items:center; gap:5px;" title="הדפס את דף המשימות">🖨️ הדפס משימות</button>
          <div style="position:relative;" class="wt-no-print">
            <input type="text" placeholder="חיפוש משימות..." value="\${window.wtSearchQuery}" onkeyup="window.wtDoSearch(this.value)" style="padding:8px 12px; padding-right:30px; border:1px solid #ccc; border-radius:20px; width:180px; font-size:0.9rem;">
            <span style="position:absolute; right:10px; top:8px; opacity:0.5;">🔍</span>
          </div>
          
        </div>`;

text = text.replace(oldHeader, newHeader);

// 3. Inject @media print style at the top of the container HTML
const styleInjectPoint = `  let html = \`
    <div style="max-width:850px; margin:0 auto; padding:20px;">`;

const styleInjected = `  let html = \`
    <style>
      @media print {
        body * { visibility: hidden; }
        #c-worker_tasks, #c-worker_tasks * { visibility: visible; }
        #c-worker_tasks { position: absolute; left: 0; top: 0; width: 100%; padding:0 !important; margin:0 !important; }
        .wt-no-print { display: none !important; }
        #mode-bar, #mob-nav, #mob-nav-purch { display: none !important; }
      }
    </style>
    <div style="max-width:850px; margin:0 auto; padding:20px;" class="wt-print-container">`;

text = text.replace(styleInjectPoint, styleInjected);

// Add class="wt-no-print" to the Calendar Navigation Bar
const oldNavBar = `      <!-- Calendar Navigation Bar -->
      <div style="background:#fff; border-radius:12px; padding:10px 15px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 8px rgba(0,0,0,0.05);">`;

const newNavBar = `      <!-- Calendar Navigation Bar -->
      <div class="wt-no-print" style="background:#fff; border-radius:12px; padding:10px 15px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 8px rgba(0,0,0,0.05);">`;

text = text.replace(oldNavBar, newNavBar);

// Add class="wt-no-print" to the Chat Input Area
const oldInputArea = `      <!-- Chat Input Area (WhatsApp style) -->
      <div style="position:absolute; bottom:0; left:0; right:0; background:#f0f0f0; padding:10px; display:flex; align-items:center; gap:8px; border-radius:0 0 8px 8px; border-top:1px solid #e0e0e0;">`;

const newInputArea = `      <!-- Chat Input Area (WhatsApp style) -->
      <div class="wt-no-print" style="position:absolute; bottom:0; left:0; right:0; background:#f0f0f0; padding:10px; display:flex; align-items:center; gap:8px; border-radius:0 0 8px 8px; border-top:1px solid #e0e0e0;">`;

text = text.replace(oldInputArea, newInputArea);

fs.writeFileSync('worker_tasks.js', text);
console.log('Applied notebook fixes and print functionality');
