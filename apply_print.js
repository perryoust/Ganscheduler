const fs = require('fs');
let t = fs.readFileSync('worker_tasks.js', 'utf8');

t = t.replace(/let html = \`\n    <div style="max-width:850px; margin:0 auto; padding:20px;">/g, 
`let html = \`
<style>
@media print {
  body * { visibility: hidden; }
  #c-worker_tasks, #c-worker_tasks * { visibility: visible; }
  #c-worker_tasks { position: absolute; left: 0; top: 0; width: 100%; padding:0 !important; margin:0 !important; }
  .wt-no-print { display: none !important; }
  #mode-bar, #mob-nav, #mob-nav-purch { display: none !important; }
}
</style>
<div style="max-width:850px; margin:0 auto; padding:20px;" class="wt-print-container">`);

t = t.replace(/<div style="display:flex; gap:10px; flex-wrap:wrap;">/g, 
`<div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button onclick="window.print()" class="wt-no-print" style="background:#fff; border:1px solid #ccc; padding:6px 12px; border-radius:20px; cursor:pointer; color:#1565c0; font-weight:bold; display:flex; align-items:center; gap:5px;" title="הדפס את דף המשימות">🖨️ הדפס משימות</button>`);

// Add wt-no-print to the Navigation bar
t = t.replace(/<!-- Calendar Navigation Bar -->\n      <div style="background:#fff;/g, '<!-- Calendar Navigation Bar -->\n      <div class="wt-no-print" style="background:#fff;');

// Add wt-no-print to the Chat Input Area
t = t.replace(/<!-- Chat Input Area \(WhatsApp style\) -->\n      <div style="/g, '<!-- Chat Input Area (WhatsApp style) -->\n      <div class="wt-no-print" style="');

fs.writeFileSync('worker_tasks.js', t);
console.log('Added Print CSS and Button');
