const fs = require('fs');

let c = fs.readFileSync('suppliers.js', 'utf8');

// 1. Modify openSupExport
c = c.replace(
  "if(document.getElementById('supex-garden-filter')) document.getElementById('supex-garden-filter').value = '';",
  "if(window._supexSelectedGardens) window._supexSelectedGardens.clear();\n  if(document.getElementById('supex-garden-multi-search')) document.getElementById('supex-garden-multi-search').value = '';\n  if(typeof window.renderSupExGardenMultiItems === 'function') window.renderSupExGardenMultiItems();"
);

// 2. Modify doSupExport Filtering Logic
c = c.replace(
  /const gardenFilter = \(document\.getElementById\('supex-garden-filter'\)\?\.value \|\| ''\)\.toLowerCase\(\)\.trim\(\);\s*const filterTerms = gardenFilter \? gardenFilter\.split\(','\)\.map\(x => x\.trim\(\)\)\.filter\(x => x\) : \[\];/,
  ""
);

c = c.replace(
  /if \(filterTerms\.length > 0\) \{[\s\S]*?if \(!match\) return false;\s*\}/,
  "if (window._supexSelectedGardens && window._supexSelectedGardens.size > 0) {\n       const gidStr = s.g.toString();\n       if (!window._supexSelectedGardens.has(gidStr)) return false;\n    }"
);

// 3. Append helper functions
c += `

window._supexSelectedGardens = new Set();
window.toggleSupExGardenMulti = function() {
  document.getElementById('supex-garden-multi-list').classList.toggle('open');
};

window.filterSupExGardenMulti = function() {
  const q = document.getElementById('supex-garden-multi-search').value.toLowerCase();
  const items = document.querySelectorAll('#supex-garden-multi-items > div');
  items.forEach(el => {
    el.style.display = el.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
  });
};

window.renderSupExGardenMultiItems = function() {
  const container = document.getElementById('supex-garden-multi-items');
  if(!container) return;
  const rawList = window.GARDENS.concat(window._GARDENS_EXTRA||[]);
  const gMap = new Map();
  rawList.forEach(g => gMap.set(g.id, g));
  const allGans = Array.from(gMap.values()).sort((a,b)=>(a.city||'').localeCompare(b.city||'','he')||(a.name||'').localeCompare(b.name||'','he'));
  
  let html = '';
  allGans.forEach(g => {
    const isChecked = window._supexSelectedGardens.has(g.id.toString());
    html += \`
      <div style="display:flex;align-items:center;padding:5px 8px;cursor:pointer;border-bottom:1px solid #eee;" onclick="window.toggleSupExGardenItem('\${g.id}', event)">
        <input type="checkbox" style="margin-left:8px;" \${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); window.toggleSupExGardenItem('\${g.id}', event)">
        <span style="font-size:0.8rem">\${g.name} (\${g.city || ''})</span>
      </div>
    \`;
  });
  container.innerHTML = html;
  window.updateSupExGardenMultiLabel();
};

window.toggleSupExGardenItem = function(gid, e) {
  if (e && e.target.tagName !== 'INPUT') {
    const cb = e.currentTarget.querySelector('input[type="checkbox"]');
    if(cb) cb.checked = !cb.checked;
  }
  gid = gid.toString();
  if (window._supexSelectedGardens.has(gid)) {
    window._supexSelectedGardens.delete(gid);
  } else {
    window._supexSelectedGardens.add(gid);
  }
  window.updateSupExGardenMultiLabel();
};

window.updateSupExGardenMultiLabel = function() {
  const lbl = document.getElementById('supex-garden-multi-label');
  if(!lbl) return;
  if(window._supexSelectedGardens.size === 0) {
    lbl.textContent = 'כל הגנים (בחר כדי לסנן)';
  } else {
    lbl.textContent = window._supexSelectedGardens.size + ' גנים נבחרו';
  }
};

document.addEventListener('click', e => {
  if(!e.target.closest('#supex-garden-multi-wrap')){
    const list = document.getElementById('supex-garden-multi-list');
    if(list) list.classList.remove('open');
  }
});
`;

fs.writeFileSync('suppliers.js', c);
