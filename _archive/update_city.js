const fs = require('fs');

let c = fs.readFileSync('suppliers.js', 'utf8');

const splitToken = 'window._supexSelectedGardens = new Set();';
const parts = c.split(splitToken);

if (parts.length > 1) {
  let newBottom = `window._supexSelectedGardens = new Set();
window.toggleSupExGardenMulti = function() {
  document.getElementById('supex-garden-multi-list').classList.toggle('open');
};

window.filterSupExGardenMulti = function() {
  const q = document.getElementById('supex-garden-multi-search').value.toLowerCase();
  const cities = document.querySelectorAll('.supex-city-group');
  cities.forEach(cityDiv => {
    let cityMatch = cityDiv.querySelector('.supex-city-name').textContent.toLowerCase().includes(q);
    let hasVisibleChild = false;
    const items = cityDiv.querySelectorAll('.supex-garden-item');
    items.forEach(el => {
      const match = el.textContent.toLowerCase().includes(q);
      el.style.display = match || cityMatch ? 'flex' : 'none';
      if(match || cityMatch) hasVisibleChild = true;
    });
    cityDiv.style.display = hasVisibleChild || cityMatch ? 'block' : 'none';
    
    const itemsContainer = cityDiv.querySelector('.supex-city-items');
    const toggleSpan = cityDiv.querySelector('.supex-city-toggle');
    if(q) {
       itemsContainer.style.display = 'block';
       if(toggleSpan) toggleSpan.textContent = '➖';
    } else {
       itemsContainer.style.display = 'none';
       if(toggleSpan) toggleSpan.textContent = '➕';
    }
  });
};

window.renderSupExGardenMultiItems = function() {
  const container = document.getElementById('supex-garden-multi-items');
  if(!container) return;
  const rawList = window.GARDENS.concat(window._GARDENS_EXTRA||[]);
  const gMap = new Map();
  rawList.forEach(g => gMap.set(g.id, g));
  const allGans = Array.from(gMap.values()).sort((a,b)=>(a.city||'').localeCompare(b.city||'','he')||(a.name||'').localeCompare(b.name||'','he'));
  
  const cityGroups = {};
  allGans.forEach(g => {
    const c = g.city || 'ללא עיר';
    if(!cityGroups[c]) cityGroups[c] = [];
    cityGroups[c].push(g);
  });
  
  // Re-apply open states
  const openStates = {};
  document.querySelectorAll('.supex-city-group').forEach(cg => {
    const cNameMatch = cg.querySelector('.supex-city-name').textContent.match(/^(.*?)\\s+\\(\\d+\\)$/);
    if(cNameMatch && cg.querySelector('.supex-city-items').style.display === 'block') {
      openStates[cNameMatch[1].trim()] = true;
    }
  });
  
  let html = '';
  Object.keys(cityGroups).sort((a,b)=>a.localeCompare(b,'he')).forEach(city => {
    const gans = cityGroups[city];
    const allChecked = gans.every(g => window._supexSelectedGardens.has(g.id.toString()));
    const someChecked = gans.some(g => window._supexSelectedGardens.has(g.id.toString()));
    const isOpen = openStates[city] ? 'block' : 'none';
    const toggleChar = isOpen === 'block' ? '➖' : '➕';
    
    const cityIdStr = gans.map(g=>g.id).join(',');
    
    html += \`
      <div class="supex-city-group" style="border-bottom:1px solid #ddd;">
        <div style="display:flex;align-items:center;padding:5px 8px;background:#f5f5f5;font-weight:bold;cursor:pointer;" onclick="window.toggleSupExCityItems(this)">
          <span style="width:20px;text-align:center;font-size:0.8rem" class="supex-city-toggle">\${toggleChar}</span>
          <input type="checkbox" style="margin-left:8px;" class="supex-city-cb" \${allChecked?'checked':''} \${someChecked&&!allChecked?'data-indeterminate="true"':''} onclick="event.stopPropagation(); window.toggleSupExCity('\${cityIdStr}', this)">
          <span style="font-size:0.85rem;flex:1" class="supex-city-name">\${city} (\${gans.length})</span>
        </div>
        <div class="supex-city-items" style="display:\${isOpen};background:#fafafa;">
    \`;
    
    gans.forEach(g => {
      const isChecked = window._supexSelectedGardens.has(g.id.toString());
      html += \`
          <div class="supex-garden-item" style="display:flex;align-items:center;padding:5px 8px 5px 24px;cursor:pointer;border-bottom:1px solid #eee;" onclick="window.toggleSupExGardenItem('\${g.id}', event)">
            <input type="checkbox" style="margin-left:8px;" class="supex-g-cb" data-id="\${g.id}" \${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); window.toggleSupExGardenItem('\${g.id}', event)">
            <span style="font-size:0.8rem">\${g.name}</span>
          </div>
      \`;
    });
    
    html += \`</div></div>\`;
  });
  
  container.innerHTML = html;
  
  container.querySelectorAll('.supex-city-cb').forEach(cb => {
    if(cb.getAttribute('data-indeterminate')==='true') cb.indeterminate = true;
  });
  
  window.updateSupExGardenMultiLabel();
};

window.toggleSupExCityItems = function(el) {
  const itemsContainer = el.nextElementSibling;
  const toggleSpan = el.querySelector('.supex-city-toggle');
  if(itemsContainer.style.display === 'none') {
    itemsContainer.style.display = 'block';
    if(toggleSpan) toggleSpan.textContent = '➖';
  } else {
    itemsContainer.style.display = 'none';
    if(toggleSpan) toggleSpan.textContent = '➕';
  }
};

window.toggleSupExCity = function(cityIdsStr, cbEl) {
  const isChecked = cbEl.checked;
  const ids = cityIdsStr.split(',');
  ids.forEach(id => {
    if(isChecked) window._supexSelectedGardens.add(id);
    else window._supexSelectedGardens.delete(id);
  });
  window.renderSupExGardenMultiItems();
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
  window.renderSupExGardenMultiItems();
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

  const finalContent = parts[0] + newBottom;
  fs.writeFileSync('suppliers.js', finalContent);
}
