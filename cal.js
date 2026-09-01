// cal.js v102 - Unified City+Garden Filter
function calRefG(){
  // Ensure cal-cls matches the active tab
  const clsSel = window.getEl('cal-cls');
  if(clsSel && typeof _calTab !== 'undefined') clsSel.value = (_calTab === 'g' ? 'גנים' : 'ביה"ס');
  const cls = (window.getEl('cal-cls')?.value || '');
  const allGs = window.gByCF ? window.gByCF('', cls) : (typeof AG === 'function' ? AG() : (window.GARDENS||[])).filter(g=>!cls||window.getGardenClass(g)===cls);
  // No longer filter by city - unified filter shows ALL gardens grouped by city
  const gs = allGs;
  
  gs.sort((a,b)=>{
    const cc=(a.city||'').localeCompare(b.city||'','he');if(cc)return cc;
    return (a.name||'').localeCompare(b.name||'','he');
  });

  // Group gardens by city
  const cityMap = new Map();
  gs.forEach(g => {
    const city = g.city || 'ללא עיר';
    if(!cityMap.has(city)) cityMap.set(city, []);
    cityMap.get(city).push(g);
  });
  
  ['desktop', 'mobile'].forEach(plat => {
    const listEl = document.getElementById('cal-g-multi-items-' + plat);
    if(!listEl) return;
    let html = `
      <label class="custom-multi-item" style="font-weight:bold; border-bottom:1px solid #ccc; position:sticky; top:0; background:#fff; z-index:2;">
        <input type="checkbox" id="cal-g-multi-all-${plat}" onchange="window.toggleAllCalGMulti('${plat}')">
        <span>(בחר הכל / נקה הכל)</span>
      </label>
    `;
    cityMap.forEach((cityGs, city) => {
      const safeCity = city.replace(/"/g, '&quot;');
      const cityId = 'cal-city-grp-' + plat + '-' + safeCity.replace(/\s/g,'_');
      const gardensId = 'cal-city-gardens-' + plat + '-' + safeCity.replace(/\s/g,'_');
      // City header with count and select-all for city
      html += `<div class="cal-city-group" data-city="${safeCity}">
        <div class="custom-multi-item cal-city-header" style="font-weight:bold; background:#fafafa; border-bottom:1px solid #e0e0e0; padding:8px 10px; display:flex; align-items:center; gap:8px;">
          <span style="flex:1; cursor:pointer; font-size:0.95rem; color:#333;" onclick="window.toggleCityAccordion('${gardensId}', this)">${city} (${cityGs.length})</span>
          <input type="checkbox" class="cal-city-chk" data-city="${safeCity}" id="${cityId}" onchange="window.toggleCityGardens('${plat}', this)" style="width:16px; height:16px; cursor:pointer; margin:0;">
          <span class="city-toggle-icon" onclick="window.toggleCityAccordion('${gardensId}', this.parentElement.querySelector('span'))" style="cursor:pointer; display:flex; align-items:center; justify-content:center; width:20px; height:20px; font-size:1.2rem; font-weight:bold; color:#555;">➕</span>
        </div>
        <div id="${gardensId}" class="cal-city-gardens" style="display:none; padding-right:10px; background:#fff; border-bottom:1px solid #eee;">`;
      cityGs.forEach(g => {
        let tooltip = g.name;
        let partnerNote = '';
        if(window.gardenPair) {
          const pair = window.gardenPair(g.id);
          if(pair) {
            const otherIds = pair.ids.filter(id => Number(id) !== Number(g.id));
            const otherNames = otherIds.map(id => window.G(id)?.name).filter(Boolean).join(' + ');
            if(otherNames) {
              tooltip = `${g.name}\n🔗 שותף לזוג: ${otherNames}`;
              partnerNote = `<span style="font-size:0.65rem; color:#888; margin-right:auto;">(זוג: ${otherNames})</span>`;
            }
          }
        }
        html += `<label class="custom-multi-item cal-g-multi-real-item" data-city="${safeCity}" title="${tooltip}" style="padding:6px 8px; border-bottom:1px solid #f5f5f5;">
          <input type="checkbox" value="${g.id}" class="cal-g-multi-chk" onchange="window.calMultiGChanged('${plat}')" style="margin:0;">
          <span>${g.name}</span>
          ${partnerNote}
        </label>`;
      });
      html += `</div></div>`;
    });
    listEl.innerHTML = html;
    if(window.calMultiGChanged) window.calMultiGChanged(plat); // Sync button state
  });
  renderCal();
  if (window.currentTab === "dash" && typeof window.renderDash === "function") window.renderDash();
}
function getCalGids(){
  const plat = window.innerWidth > 768 ? 'desktop' : 'mobile';
  const listEl = document.getElementById('cal-g-multi-items-' + plat) || document.getElementById('cal-g-multi-items-desktop');
  if(!listEl) return [];
  return Array.from(listEl.querySelectorAll('.cal-g-multi-chk:checked')).map(el => parseInt(el.value));
}

window.toggleCalGMulti = function(plat) {
  const list = document.getElementById('cal-g-multi-list-' + plat);
  if(list) list.classList.toggle('open');
};

window.toggleCityAccordion = function(gardensId, spanEl) {
  const gardensDiv = document.getElementById(gardensId);
  const iconEl = spanEl.parentElement.querySelector('.city-toggle-icon');
  if(gardensDiv) {
    if(gardensDiv.style.display === 'none') {
      gardensDiv.style.display = 'block';
      if(iconEl) iconEl.innerText = '➖';
    } else {
      gardensDiv.style.display = 'none';
      if(iconEl) iconEl.innerText = '➕';
    }
  }
};

// Toggle all gardens in a specific city
window.toggleCityGardens = function(plat, cityChk) {
  const city = cityChk.dataset.city;
  const isChecked = cityChk.checked;
  const list = document.getElementById('cal-g-multi-items-' + plat);
  if(!list) return;
  list.querySelectorAll('.cal-g-multi-real-item[data-city="' + city + '"] .cal-g-multi-chk').forEach(el => {
    el.checked = isChecked;
  });
  window.calMultiGChanged(plat);
};

window.filterCalGMulti = function(plat) {
  const input = document.getElementById('cal-g-multi-search-' + plat);
  if(!input) return;
  const filter = input.value.toLowerCase();
  const list = document.getElementById('cal-g-multi-items-' + plat);
  if(!list) return;
  // Show/hide both city headers and garden items
  const cityGroups = list.querySelectorAll('.cal-city-group');
  if(cityGroups.length > 0) {
    cityGroups.forEach(grp => {
      const items = grp.querySelectorAll('.cal-g-multi-real-item');
      let anyVisible = false;
      items.forEach(item => {
        const text = item.textContent.trim().toLowerCase();
        if(text.startsWith(filter) || text.includes(' ' + filter)) { item.style.display = ''; anyVisible = true; }
        else item.style.display = 'none';
      });
      const header = grp.querySelector('.cal-city-header');
      if(header) {
        if(filter && !anyVisible) header.style.display = 'none';
        else header.style.display = '';
      }
      grp.style.display = (filter && !anyVisible) ? 'none' : '';
    });
  } else {
    list.querySelectorAll('.custom-multi-item').forEach(item => {
      const text = item.textContent.trim().toLowerCase();
      if(text.startsWith(filter) || text.includes(' ' + filter)) item.style.display = '';
      else item.style.display = 'none';
    });
  }
};

window.toggleAllCalGMulti = function(plat) {
  const allChk = document.getElementById('cal-g-multi-all-' + plat);
  if(!allChk) return;
  const isChecked = allChk.checked;
  const list = document.getElementById('cal-g-multi-items-' + plat);
  if(list) {
    list.querySelectorAll('.cal-g-multi-chk').forEach(el => {
      // Only toggle visible items if there's a filter, or all if no filter
      if(el.closest('label').style.display !== 'none') {
        el.checked = isChecked;
      }
    });
  }
  window.calMultiGChanged(plat);
};

window.calMultiGChanged = function(sourcePlat) {
  const sourceList = document.getElementById('cal-g-multi-items-' + sourcePlat);
  if(!sourceList) return;
  const chks = Array.from(sourceList.querySelectorAll('.cal-g-multi-chk'));
  const checked = chks.filter(el => el.checked).map(el => el.value);
  
  // Sync 'Select All' checkbox state
  const allChk = document.getElementById('cal-g-multi-all-' + sourcePlat);
  if(allChk) {
    const visibleChks = chks.filter(el => el.closest('label').style.display !== 'none');
    const allVisibleChecked = visibleChks.length > 0 && visibleChks.every(el => el.checked);
    const someVisibleChecked = visibleChks.some(el => el.checked);
    allChk.checked = allVisibleChecked;
    allChk.indeterminate = !allVisibleChecked && someVisibleChecked;
  }
  
  const otherPlat = sourcePlat === 'desktop' ? 'mobile' : 'desktop';
  const otherList = document.getElementById('cal-g-multi-items-' + otherPlat);
  if(otherList) {
    otherList.querySelectorAll('.cal-g-multi-chk').forEach(el => {
      el.checked = checked.includes(el.value);
    });
    const otherAllChk = document.getElementById('cal-g-multi-all-' + otherPlat);
    if(otherAllChk && allChk) {
      otherAllChk.checked = allChk.checked;
      otherAllChk.indeterminate = allChk.indeterminate;
    }
  }

  // Sync city-level checkboxes
  ['desktop', 'mobile'].forEach(plat => {
    const listEl = document.getElementById('cal-g-multi-items-' + plat);
    if(!listEl) return;
    listEl.querySelectorAll('.cal-city-group').forEach(grp => {
      const cityChk = grp.querySelector('.cal-city-chk');
      if(!cityChk) return;
      const gardenChks = Array.from(grp.querySelectorAll('.cal-g-multi-chk'));
      const allChecked = gardenChks.length > 0 && gardenChks.every(el => el.checked);
      const someChecked = gardenChks.some(el => el.checked);
      cityChk.checked = allChecked;
      cityChk.indeterminate = !allChecked && someChecked;
    });

    const btn = document.getElementById('cal-g-multi-btn-' + plat);
    if(btn) {
      if(checked.length === 0) {
        btn.innerHTML = '<span>כל הגנים</span> <span style="font-size:0.6rem">▼</span>';
      } else if (checked.length === 1) {
        const gObj = window.G(checked[0]);
        btn.innerHTML = `<span>${gObj?gObj.name:'גן'}</span> <span style="font-size:0.6rem">▼</span>`;
      } else {
        btn.innerHTML = `<span>נבחרו ${checked.length} גנים</span> <span style="font-size:0.6rem">▼</span>`;
      }
    }
  });
  renderCal();
};

window.clearCalGMulti = function(plat) {
  const list = document.getElementById('cal-g-multi-items-' + plat);
  if(list) list.querySelectorAll('input').forEach(el => el.checked = false);
  if(window.calMultiGChanged) window.calMultiGChanged(plat);
  const input = document.getElementById('cal-g-multi-search-' + plat);
  if(input) input.value = '';
  window.filterCalGMulti(plat);
};

window.initCalMultiSelect = function(type, items, getLabelFn) {
  ['desktop', 'mobile'].forEach(plat => {
    const listEl = document.getElementById(`cal-${type}-multi-items-${plat}`);
    if(!listEl) return;
    listEl.innerHTML = `
      <label class="custom-multi-item" style="font-weight:bold; border-bottom:1px solid #ccc; position:sticky; top:0; background:#fff; z-index:2;">
        <input type="checkbox" id="cal-${type}-multi-all-${plat}" onchange="window.toggleAllCalMulti('${type}', '${plat}')">
        <span>(בחר הכל / נקה הכל)</span>
      </label>
    `;
    items.forEach(item => {
      const val = typeof item === 'object' ? item.id : item;
      const safeVal = String(val).replace(/"/g, '&quot;');
      const lbl = getLabelFn(item);
      listEl.innerHTML += `<label class="custom-multi-item cal-${type}-multi-real-item" title="${lbl}">
        <input type="checkbox" value="${safeVal}" class="cal-${type}-multi-chk" onchange="window.calMultiChanged('${type}', '${plat}')">
        <span>${lbl}</span>
      </label>`;
    });
    if(window.calMultiChanged) window.calMultiChanged(type, plat);
  });
};

window.toggleCalMulti = function(type, plat) {
  const list = document.getElementById(`cal-${type}-multi-list-${plat}`);
  if(list) list.classList.toggle('open');
};

window.filterCalMulti = function(type, plat) {
  const input = document.getElementById(`cal-${type}-multi-search-${plat}`);
  if(!input) return;
  const filter = input.value.toLowerCase();
  const list = document.getElementById(`cal-${type}-multi-items-${plat}`);
  if(!list) return;
  const items = list.querySelectorAll('.custom-multi-item');
  items.forEach(item => {
    const text = item.textContent.trim().toLowerCase();
    if(text.startsWith(filter) || text.includes(' ' + filter)) item.style.display = '';
    else item.style.display = 'none';
  });
};

window.toggleAllCalMulti = function(type, plat) {
  const allChk = document.getElementById(`cal-${type}-multi-all-${plat}`);
  if(!allChk) return;
  const isChecked = allChk.checked;
  const list = document.getElementById(`cal-${type}-multi-items-${plat}`);
  if(list) {
    list.querySelectorAll(`.cal-${type}-multi-chk`).forEach(el => {
      if(el.closest('label').style.display !== 'none') el.checked = isChecked;
    });
  }
  window.calMultiChanged(type, plat);
};

window.calMultiChanged = function(type, sourcePlat) {
  const sourceList = document.getElementById(`cal-${type}-multi-items-${sourcePlat}`);
  if(!sourceList) return;
  const chks = Array.from(sourceList.querySelectorAll(`.cal-${type}-multi-chk`));
  const checked = chks.filter(el => el.checked).map(el => el.value);
  
  const allChk = document.getElementById(`cal-${type}-multi-all-${sourcePlat}`);
  if(allChk) {
    const visibleChks = chks.filter(el => el.closest('label').style.display !== 'none');
    const allVisibleChecked = visibleChks.length > 0 && visibleChks.every(el => el.checked);
    const someVisibleChecked = visibleChks.some(el => el.checked);
    allChk.checked = allVisibleChecked;
    allChk.indeterminate = !allVisibleChecked && someVisibleChecked;
  }
  
  const otherPlat = sourcePlat === 'desktop' ? 'mobile' : 'desktop';
  const otherList = document.getElementById(`cal-${type}-multi-items-${otherPlat}`);
  if(otherList) {
    otherList.querySelectorAll(`.cal-${type}-multi-chk`).forEach(el => {
      el.checked = checked.includes(el.value);
    });
    const otherAllChk = document.getElementById(`cal-${type}-multi-all-${otherPlat}`);
    if(otherAllChk && allChk) {
      otherAllChk.checked = allChk.checked;
      otherAllChk.indeterminate = allChk.indeterminate;
    }
  }

  ['desktop', 'mobile'].forEach(plat => {
    const btn = document.getElementById(`cal-${type}-multi-btn-${plat}`);
    if(btn) {
      let typeLabel = 'כל הספקים';
      if(type==='city') typeLabel='כל הערים';
      else if(type==='cl') typeLabel='כל האשכולות';
      else if(type==='class') typeLabel='כל הכיתות';
      if(checked.length === 0) {
        btn.innerHTML = `<span>${typeLabel}</span> <span style="font-size:0.6rem">▼</span>`;
      } else if (checked.length === 1) {
        let lbl = checked[0];
        if(type === 'sup' && window.supNameLabel) lbl = window.supNameLabel(lbl);
        btn.innerHTML = `<span>${lbl}</span> <span style="font-size:0.6rem">▼</span>`;
      } else {
        let noun = 'ספקים';
        if(type==='city') noun='ערים';
        else if(type==='cl') noun='אשכולות';
        else if(type==='class') noun='כיתות';
        btn.innerHTML = `<span>נבחרו ${checked.length} ${noun}</span> <span style="font-size:0.6rem">▼</span>`;
      }
    }
  });
  
  if (type === 'city') calRefG();
  else renderCal();
};

window.clearCalMulti = function(type, plat) {
  const list = document.getElementById(`cal-${type}-multi-items-${plat}`);
  if(list) list.querySelectorAll('input').forEach(el => el.checked = false);
  if(window.calMultiChanged) window.calMultiChanged(type, plat);
  const searchInput = document.getElementById(`cal-${type}-multi-search-${plat}`);
  if(searchInput) searchInput.value = '';
  window.filterCalMulti(type, plat);
};

window.toggleCalCityMulti = plat => window.toggleCalMulti('city', plat);
window.filterCalCityMulti = plat => window.filterCalMulti('city', plat);
window.clearCalCityMulti = plat => window.clearCalMulti('city', plat);

window.toggleCalSupMulti = plat => window.toggleCalMulti('sup', plat);
window.filterCalSupMulti = plat => window.filterCalMulti('sup', plat);
window.clearCalSupMulti = plat => window.clearCalMulti('sup', plat);

window.toggleCalClMulti = plat => window.toggleCalMulti('cl', plat);
window.filterCalClMulti = plat => window.filterCalMulti('cl', plat);
window.clearCalClMulti = plat => window.clearCalMulti('cl', plat);

window.getCalCity = function() {
  const plat = window.innerWidth > 768 ? 'desktop' : 'mobile';
  const listEl = document.getElementById('cal-city-multi-items-' + plat) || document.getElementById('cal-city-multi-items-desktop');
  if(!listEl) return [];
  return Array.from(listEl.querySelectorAll('.cal-city-multi-chk:checked')).map(el => el.value);
};

window.getCalSup = function() {
  const plat = window.innerWidth > 768 ? 'desktop' : 'mobile';
  const listEl = document.getElementById('cal-sup-multi-items-' + plat) || document.getElementById('cal-sup-multi-items-desktop');
  if(!listEl) return [];
  return Array.from(listEl.querySelectorAll('.cal-sup-multi-chk:checked')).map(el => el.value);
};

window.calRefCity = function() {
  const cities = [...new Set((typeof AG === 'function' ? AG() : (window.GARDENS||[])).map(g=>g.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'he'));
  window.initCalMultiSelect('city', cities, city => city);
};

window.calRefSup = function() {
  const sups = [...new Set((window.SCH||[]).map(s=>window.supBase(s.a)))].filter(Boolean).sort((a,b)=>a.localeCompare(b,'he'));
  window.initCalMultiSelect('sup', sups, sup => window.supNameLabel ? window.supNameLabel(sup) : sup);
};

window.calRefCl = function() {
  const clsItems = [{id: '__all__', name: '— הכל (גנים באשכולות) —'}, ...window.getClusters().map(c => ({id: c.name, name: c.name}))].sort((a,b)=>a.name.localeCompare(b.name, 'he', { numeric: true }));
  window.initCalMultiSelect('cl', clsItems, item => item.name);
};

window.getCalCl = function() {
  const plat = window.innerWidth > 768 ? 'desktop' : 'mobile';
  const listEl = document.getElementById('cal-cl-multi-items-' + plat) || document.getElementById('cal-cl-multi-items-desktop');
  if(!listEl) return [];
  return Array.from(listEl.querySelectorAll('.cal-cl-multi-chk:checked')).map(el => el.value);
};

window.initCalFilters = function() {
  window.calRefCity();
  window.calRefSup();
  window.calRefCl();
  window.calRefG();
};

document.addEventListener('click', function(e) {
  ['desktop', 'mobile'].forEach(plat => {
    ['g', 'city', 'sup', 'cl'].forEach(type => {
      const wrap = document.getElementById(`cal-${type}-multi-wrap-${plat}`) || document.getElementById(`cal-unified-multi-wrap-${plat}`);
      const list = document.getElementById(`cal-${type}-multi-list-${plat}`);
      if(wrap && list && !wrap.contains(e.target)) list.classList.remove('open');
    });
  });
});
function getCalF(){
  const gids = getCalGids();
  return {
    gids: gids.length ? gids : null,
    cities: window.getCalCity ? window.getCalCity() : [],
    cls: window.getEl('cal-cls')?.value || '',
    clusters: window.getCalCl ? window.getCalCl() : [],
    sups: window.getCalSup ? window.getCalSup() : [],
    st: window.getEl('cal-st')?.value || ''
  };
}
function filterE(f,from,to){
  const all=window.SCH.filter(s=>{
    if(s.d<from||s.d>to) return false;
    const g=window.G(s.g);
    
    if(f.cities && f.cities.length > 0 && !f.cities.includes(g.city)) return false;
    
    if(f.clusters && f.clusters.length > 0){
      let hasMatch = false;
      for (const clName of f.clusters) {
        if(clName==='__all__'){
          const allClusterGids=new Set(window.getClusters().flatMap(c=>c.gardenIds||[]).map(Number));
          if(allClusterGids.has(Number(s.g))) { hasMatch = true; break; }
        } else {
          const cl=window.getClusters().find(c=>c.name===clName);
          if(cl && (cl.gardenIds||[]).map(Number).includes(Number(s.g))) { hasMatch = true; break; }
        }
      }
      if(!hasMatch) return false;
    }
    
    if(f.cls&&window.gcls(g)!==f.cls) return false;
    
    if(f.gids&&!f.gids.map(Number).includes(Number(s.g))) return false;
    
    const supBase = window.supBase ? window.supBase(s.a) : s.a;
    if(f.sups && f.sups.length > 0 && !f.sups.includes(supBase) && !f.sups.includes(s.a)) return false;
    
    // Status Filter 
    if(s.st==='nohap') return true; // Always show nohap in calendar
     
    if(f.st==='todo'){
       if(s.st==='can') return false; 
       const isM = !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.nt)) || (s.n && /השלמה|הוקדם מ/i.test(s.n)));
       const isHandled = !!(s._compByMakeup && s._compByMakeup !== "false");
       if(!(s.st==='nohap' || s.st==='post' || isM || isHandled)) return false;
    } else if(!f.st){
       // No status filter
    } else if(f.st && s.st!==f.st) return false;

    return true;
  });
  return all;
}
let _rangeSubView = 'list'; // Default to list view per user request
let _listSubView='day'; // Default to daily list
let _calTab = 'g'; // 'g'|'s' (gardens vs schools)
window._listGroupMode = 'pairs'; // Default to pairs grouping

function setCalTab(t){
  _calTab = t;
  document.querySelectorAll('[id^="cal-tab-"]').forEach(btn => {
    const btnTab = btn.id.replace('cal-tab-', '').replace('-desktop', '').replace('-mobile', '');
    btn.classList.toggle('active', btnTab === t);
  });
  calRefG();
}

window.updateCalNavButtons = function() {
  let activeId = '';
  if (calV === 'list' && _listSubView === 'day') activeId = 'day-list';
  else if (calV === 'list' && _listSubView === 'week') activeId = 'week-list';
  else if (calV === 'week') activeId = 'week-grid';
  else if (calV === 'day') activeId = 'day-grid';
  else if (calV === 'month') activeId = 'month';
  else if (calV === 'month-table') activeId = 'month-table';

  if (activeId) {
    const desktopSel = document.getElementById('cal-view-select-desktop');
    const mobileSel = document.getElementById('cal-view-select-mobile');
    if (desktopSel) desktopSel.value = activeId;
    if (mobileSel) mobileSel.value = activeId;
  }
};

window.handleViewSelect = function(val) {
  if (val === 'day-list') { window.setView('list'); window.setListSubView('day'); }
  else if (val === 'day-grid') { window.setView('day'); }
  else if (val === 'week-list') { window.setView('list'); window.setListSubView('week'); }
  else if (val === 'week-grid') { window.setView('week'); }
  else if (val === 'month') { window.setView('month'); }
  else if (val === 'month-table') { window.setView('month-table'); }
  
  const isTable = val === 'month-table';
  document.querySelectorAll('[id^="vlb-group-"]').forEach(btn => {
    const btnV = btn.id.replace('vlb-group-', '').replace('-desktop', '').replace('-mobile', '').replace('-dash', '');
    if (isTable) {
       btn.classList.toggle('active', btnV === 'table');
    } else {
       btn.classList.toggle('active', btnV === window._listGroupMode);
    }
  });
};

function setListSubView(v){
  _listSubView=v;
  window.updateCalNavButtons();
  renderCal();
}

function setRangeSubView(v){
  _rangeSubView = v;
  document.querySelectorAll('[id^="vb-range-"]').forEach(btn => {
    const btnV = btn.id.replace('vb-range-', '').replace('-desktop', '').replace('-mobile', '');
    btn.classList.toggle('active', btnV === v);
  });
  renderCal();
}

function setView(v){
  calV=v;
  _rangeSubView='cal';
  const rangeRow = document.getElementById('cal-range-row');
  const navBtns  = document.querySelectorAll('[onclick*="navCal(-1)"],[onclick*="navCal(1)"]');
  if(v==='range'){
    if(rangeRow) rangeRow.style.display='flex';
    navBtns.forEach(b=>b.style.display='none');
    const f=document.getElementById('cal-range-from');
    const t=document.getElementById('cal-range-to');
    if(f&&!f.value) f.value=window.d2s(window.monStart(window.calD));
    if(t&&!t.value) t.value=window.d2s(window.addD(window.monStart(window.calD),6));
  } else {
    if(rangeRow) rangeRow.style.display='none';
    navBtns.forEach(b=>b.style.display='');
  }
  window.updateCalNavButtons();
  renderCal();
}
function navCal(d){
  if(calV==='day') calD=addD(calD,d);
  else if(calV==='week') calD=addD(calD,d); // Jump 1 day at a time
  else if(calV==='list'){
    const lsv=_listSubView||'week';
    if(lsv==='day') calD=addD(calD,d);
    else if(lsv==='week') calD=addD(calD,d); // Jump 1 day at a time
    else calD=addM(calD,d);
  }
  else calD=addM(calD,d);

  // Sync datepickers
  const dpD = document.getElementById('cal-dp-desktop');
  const dpM = document.getElementById('cal-dp-mobile');
  if(dpD) dpD.value=window.d2s(calD);
  if(dpM) dpM.value=window.d2s(calD);

  renderCal();
}
function goToday(){
  calD=new Date();
  const dpD = document.getElementById('cal-dp-desktop');
  const dpM = document.getElementById('cal-dp-mobile');
  if(dpD) dpD.value=window.td();
  if(dpM) dpM.value=window.td();
  renderCal();
}
function goDate(s){
  if(s){
    calD=window.s2d(s);
    // Sync other datepicker
    const dpD = document.getElementById('cal-dp-desktop');
    const dpM = document.getElementById('cal-dp-mobile');
    if(dpD && dpD.value !== s) dpD.value = s;
    if(dpM && dpM.value !== s) dpM.value = s;
    renderCal();
  }
}
function jumpToDay(ds){
  calD=s2d(ds);
  // Sync datepickers
  const dpD = document.getElementById('cal-dp-desktop');
  const dpM = document.getElementById('cal-dp-mobile');
  if(dpD) dpD.value=ds;
  if(dpM) dpM.value=ds;
  setListSubView('day');
  setView('list');
}
window.calJump = function(pairId, view, gardenId, clusterName) {
  // 1. Switch to Calendar Mode
  if (window.ST) window.ST('cal');
  else if (window.setMode) window.setMode('cal');

  // 2. Clear previous filters
  if (window.clearCal) window.clearCal();

  // 3. Apply target filter
  if (clusterName) {
    ['desktop', 'mobile'].forEach(plat => {
      const clSel = document.getElementById('cal-cl-' + plat);
      if (clSel) {
        clSel.value = clusterName;
      }
    });
  } else if (pairId) {
    const pair = (window.pairs || []).find(p => Number(p.id) === Number(pairId));
    if (pair) {
      ['desktop', 'mobile'].forEach(plat => {
        const list = document.getElementById('cal-g-multi-items-' + plat);
        if(list) {
          list.querySelectorAll('input').forEach(el => {
            el.checked = pair.ids.map(Number).includes(Number(el.value));
          });
        }
        if(window.calMultiGChanged) window.calMultiGChanged(plat);
      });
    }
  } else if (gardenId) {
    ['desktop', 'mobile'].forEach(plat => {
      const list = document.getElementById('cal-g-multi-items-' + plat);
      if(list) {
        list.querySelectorAll('input').forEach(el => {
          el.checked = (Number(el.value) === Number(gardenId));
        });
      }
      if(window.calMultiGChanged) window.calMultiGChanged(plat);
    });
  }

  // 4. Set View
  if (view === 'week') window.setView('week');
  else if (view === 'month') window.setView('month');

  // 5. Refresh
  if (window.renderCal) window.renderCal();
};
function clearCal(){
  ['desktop', 'mobile'].forEach(plat => {
    if (window.clearCalCityMulti) window.clearCalCityMulti(plat);
    if (window.clearCalClsMulti) window.clearCalClsMulti(plat);
    if (window.clearCalClMulti) window.clearCalClMulti(plat);
    if (window.clearCalSupMulti) window.clearCalSupMulti(plat);
    
    ['cal-city','cal-cls','cal-cl','cal-sup'].forEach(id=>{
      const el = document.getElementById(id + '-' + plat);
      if (el) el.value = '';
    });
  });
  ['desktop', 'mobile'].forEach(plat => {
    const list = document.getElementById('cal-g-multi-items-' + plat);
    if(list) list.querySelectorAll('input').forEach(el => el.checked = false);
    if(window.calMultiGChanged) window.calMultiGChanged(plat);
  });
  const bar = window.getEl('cal-pair-bar');
  if (bar) bar.style.display = 'none';
  
  if (window.setView) {
    if (window.setListSubView) window.setListSubView('day');
    window.setView('list');
  } else {
    renderCal();
  }
}
function clearCalPair(){
  ['desktop', 'mobile'].forEach(plat => {
    const list = document.getElementById('cal-g-multi-items-' + plat);
    if(list) list.querySelectorAll('input').forEach(el => el.checked = false);
    if(window.calMultiGChanged) window.calMultiGChanged(plat);
  });
  const bar = window.getEl('cal-pair-bar');
  if (bar) bar.style.display = 'none';
  renderCal();
}
// Unified pair save — called from calendar, schedule, and garden modal
function addPair(gids){
  if(!gids||gids.length<2){_spAlertDialog('יש לבחור לפחות 2 צהרונים');return;}
  checkDupePairAndSave(gids);
}
function addPairFromCal(){
  addPair(getCalGids());
}
window.addPairFromCal = addPairFromCal; // Export it

window.addClusterFromCal = async function(){
  const gids = getCalGids();
  if(!gids || gids.length < 2) return;

  if (typeof window.ST === 'function') window.ST('gardens');
  if (typeof window.setGardensTab === 'function') window.setGardensTab('clusters');
  if (typeof window.openEditCluster === 'function') window.openEditCluster(null, null, { gardenIds: gids });

  const calModal = document.getElementById('cal-modal-mng');
  if(calModal) calModal.classList.remove('open');
};
window.addPairFromCal = addPairFromCal;
window.saveCalPair = addPairFromCal;
function addPairFromSched(){
  const ids=[parseInt(document.getElementById('s-g1')?.value)||null,
             parseInt(document.getElementById('s-g2')?.value)||null,
             parseInt(document.getElementById('s-g3')?.value)||null].filter(Boolean);
  addPair(ids);
}
function savePairFromGarden(){
  const g2=parseInt(document.getElementById('gm-pg2')?.value)||null;
  const g3=parseInt(document.getElementById('gm-pg3')?.value)||null;
  if(!g2){_spAlertDialog('יש לבחור לפחות צהרון שני');return;}
  addPair([window.gmGid,g2,g3].filter(Boolean));
  window.openGM(window.gmGid);
}
async function checkDupePairAndSave(gids){
  const dupe=gids.map(gid=>{const p=window.gardenPair(gid);return p?`${window.G(gid).name} כבר בזוג "${p.name}"`:null}).filter(Boolean);
  if(dupe.length){if(!(await window.spConfirm(`⚠️ שים לב:\n${dupe.join('\n')}\n\nבכל זאת להמשיך?`))) return;}
  const name=gids.map(id=>window.G(id).name||'').join(' + ');
  const nm=prompt('שם לזוג:',name);
  if(nm===null) return;
  const targetId = Date.now();
  window.pairs.push({id:targetId,ids:gids,name:nm||name});
  // Cleanup duplicates from other pairs
  window.pairs = window.pairs.map(p => {
    if (p.id === targetId) return p;
    return { ...p, ids: p.ids.filter(id => !gids.map(Number).includes(Number(id))) };
  }).filter(p => p.ids.length >= 2);
  window.save(); window.refresh();
  _spAlertDialog(`✅ הזוג "${nm||name}" נשמר!`);
}

function renderCal(){
  try {
    if (!document.getElementById('cal-body')) return;
    const gids=getCalGids();
    const bar = window.getEl('cal-pair-bar');
    if (bar) {
      const isAlreadyPair = gids.length >= 2 && (window.pairs || []).some(p => {
        if (p.ids.length !== gids.length) return false;
        return gids.every(id => p.ids.map(Number).includes(Number(id)));
      });
      if(gids.length>=2 && !isAlreadyPair){
        bar.style.display = 'flex';
        const lbl = window.getEl('cal-pair-lbl');
        if (lbl) lbl.textContent = gids.map(id=>window.G(id).name||'').join(' + ');
        
        const btn = bar.querySelector('button');
        if (btn) {
           if (gids.length <= 3) {
             btn.textContent = '💾 שמור כזוג קבוע';
             btn.onclick = window.addPairFromCal;
           } else {
             btn.textContent = '💾 שמור כאשכול';
             btn.onclick = window.addClusterFromCal;
           }
        }
      } else {
        bar.style.display = 'none';
      }
    }

    const f=getCalF();
    let displayGids=null;
    if(f.gids&&f.gids.length>=2){
      displayGids=f.gids;
    } else if(f.gids&&f.gids.length===1){
      const p=window.gardenPair(f.gids[0]);
      if(p) displayGids=p.ids;
    }

    let html='';
    if(calV==='week'){
      // Show rolling 5 working days from calD
      let ws=new Date(calD); ws.setHours(0,0,0,0);
      // If on Fri(5) or Sat(6), snap to next Sunday to find first work day
      if(ws.getDay()===5) ws.setDate(ws.getDate()+2);
      else if(ws.getDay()===6) ws.setDate(ws.getDate()+1);
      
      const days=window.getNextWorkDays(ws, 5);
      const wsS=window.d2s(days[0]), weS=window.d2s(days[4]);
      (document.getElementById('cal-title')||{}).textContent=`${window.fD(wsS)} – ${window.fD(weS)} (5 ימי עבודה)`;
      const evs=filterE(f,wsS,weS);
      if(f.clusters && f.clusters.length === 1) html=renderClusterWeek(evs,ws,f.clusters[0]);
      else html=renderNormalWeek(evs,ws,f);

    } else if(calV==='range'){
      const from=document.getElementById('cal-range-from')?.value||window.d2s(calD);
      const to=document.getElementById('cal-range-to')?.value||from;
      const fromD=from<=to?from:to, toD=from<=to?to:from;
      const viewLbl=(_rangeSubView==='list')?'📋 רשימה — ':'';
      (document.getElementById('cal-title')||{}).textContent=`${viewLbl}${window.fD(fromD)} – ${window.fD(toD)}`;
      const evs=filterE(f,fromD,toD);
      html=(_rangeSubView==='list') ? renderRangeListView(evs,fromD,toD) : renderRangeView(evs,fromD,toD,f);
    } else if(calV==='list'){
      let fromDs, toDs, titleStr;
      const lsv = _listSubView||'week';
      if(lsv==='day'){
        fromDs=toDs=window.d2s(calD);
        titleStr='📋 רשימה — '+window.fD(fromDs)+' '+window.dayN(fromDs);
      } else if(lsv==='week'){
        // rolling 5 work days from calD — skip Fri(5)/Sat(6)
        let _ws=new Date(calD); _ws.setHours(0,0,0,0);
        if(_ws.getDay()===5) _ws.setDate(_ws.getDate()+2); // Fri → Sun
        else if(_ws.getDay()===6) _ws.setDate(_ws.getDate()+1); // Sat → Sun
        
        const _days=window.getNextWorkDays(_ws, 5);
        fromDs=window.d2s(_days[0]); toDs=window.d2s(_days[4]);
        titleStr='📋 רשימה — חמישה ימים '+window.fD(fromDs)+' – '+window.fD(toDs);

      } else { // month
        const y2=window.calD.getFullYear(),m2=window.calD.getMonth();
        fromDs=window.d2s(new Date(y2,m2,1)); toDs=window.d2s(new Date(y2,m2+1,0));
        titleStr='📋 רשימה — '+window.hebM(window.calD);
      }
      (document.getElementById('cal-title')||{}).textContent=titleStr;
      const evs=filterE(f,fromDs,toDs);
      html=renderRangeListView(evs,fromDs,toDs);
    } else if(calV==='month-table'){
      const y=calD.getFullYear(),m=calD.getMonth();
      (document.getElementById('cal-title')||{}).textContent ='טבלה — ' + window.hebM(calD);
      const evs=filterE(f,window.d2s(new Date(y,m,1)),window.d2s(new Date(y,m+1,0)));
      html=renderMonthTable(evs,calD,f);
    } else {
      const y=calD.getFullYear(),m=calD.getMonth();
      (document.getElementById('cal-title')||{}).textContent =window.hebM(calD);
      const evs=filterE(f,window.d2s(new Date(y,m,1)),window.d2s(new Date(y,m+1,0)));
      html=renderMonth(evs,calD,f);
    }
    
    if(calV === 'day' && typeof window.renderWorkerTasksForCal === 'function') {
      try {
        const ds=window.d2s(calD);
        html += window.renderWorkerTasksForCal(ds);
      } catch(e) { console.error('Error rendering worker tasks', e); }
    }
    document.getElementById('cal-body').innerHTML=html;
  } catch (e) {
    console.error("renderCal error:", e);
    document.getElementById('cal-body').innerHTML = `<div style="padding:20px; color:#c62828; text-align:center;">שגיאה בטעינת לוח השנה: ${e.message}</div>`;
  }
}
function isPairBroken(pairId,ds){return !!pairBreaks[pairId+'_'+ds];}
function setPairBreak(pairId,ds,broken){
  const k=pairId+'_'+ds;
  if(broken) window.pairBreaks[k]=true; else delete window.pairBreaks[k];
  window.save(); window.refresh();
}

// City-based color map - updated to a uniform light blue theme for all cities
window.CITY_COLORS=(()=>{
  const uniformTheme = {
    solid: '#1a237e',   // Dark blue for badges/accents
    light: '#f5f7ff',   // Very light blue for backgrounds
    border: '#dbe3ff',  // Border color
    text: '#1a237e'     // Text color
  };
  
  const norm = (c) => {
    if(!c) return '';
    let n = c.trim().replace(/"/g,"'");
    if(n==='פ\'ת' || n==='פ"ת' || n==='פתח תקוה') return 'פתח תקווה';
    return n;
  };

  return(city)=>{
    // Always return the same uniform theme for a consistent look
    return uniformTheme;
  };
})();
var CITY_COLORS=window.CITY_COLORS;

// ─── Shared Helper: Render global makeups for a day (ignores filters) ───
// ─── Shared Helper: Makeups are now handled within regular grouping logic ───
function renderMakeupsTop(ds, cityFilter='', clsFilter='', collapseAll=false){
  const f={city:cityFilter, cls:clsFilter};
  const evs = (typeof filterE === 'function' ? filterE(f, ds, ds) : []).filter(s => {
    return !!(s.st === 'can' || s.st === 'nohap' || s.st === 'post' || s._postFrom || s.pd || s._isMakeup || s._makeupFrom || (s.nt && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.nt)) || (s.n && /השלמה|הוקדם מ/i.test(s.n)));
  });
  if(!evs.length) return '';

  // Group by city
  const byCity = {};
  evs.forEach(s => {
    const g = window.G(s.g);
    if (!g) return;
    const city = g.city || 'אחר';
    if (!byCity[city]) byCity[city] = [];
    byCity[city].push(s);
  });

  let h = '';
  if (collapseAll) {
    h = `<details class="makeups-accordion" open style="margin-bottom:8px; border:1px solid #90caf9; border-radius:6px; background:#e3f2fd; overflow:hidden">
      <summary style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; list-style:none; outline:none; font-weight:800; color:#1565c0; font-size:0.75rem; padding:4px 8px; user-select:none">
        <div style="display:flex; align-items:center; gap:6px">
          <span style="font-size:0.9rem">🔄</span>
          <span>השלמות ושינויים (${evs.length})</span>
        </div>
        <span style="font-size:0.65rem; color:#1565c0; font-weight:700">▼ לחץ לפירוט</span>
      </summary>
      <div style="background:#fff; border-top:1px solid #90caf9; padding:8px 8px 4px">`;
  } else {
    h = `<div style="background:linear-gradient(135deg, #f0f7ff, #ffffff); border:2px solid var(--c-secondary, #1565c0); border-radius:var(--br, 10px); padding:12px 14px 8px; margin-bottom:15px; box-shadow:0 6px 16px rgba(21,101,192,0.08);">
      <div style="font-weight:800; color:var(--c-primary, #1a237e); margin-bottom:10px; display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:0.92rem; padding:0 2px">
        <div style="display:flex; align-items:center; gap:8px">
          <span style="font-size:1.2rem">📅</span>
          <span>השלמות ושינויים להיום</span>
        </div>
        <span style="font-size:0.7rem; color:var(--c-text-light, #546e7a); font-weight:600; background:rgba(21,101,192,0.08); padding:2px 8px; border-radius:12px">${window.fD(ds)}</span>
      </div>`;
  }

  Object.keys(byCity).sort().forEach(city => {
    const clr = window.CITY_COLORS ? window.CITY_COLORS(city) : { solid: '#1a237e', light: '#f5f7ff' };
    const cityEvs = byCity[city];
    
    h += `<details class="city-accordion" style="margin-bottom:6px; border-color:rgba(21,101,192,0.2)">
      <summary style="padding:10px 14px; background:#fff">
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <span style="font-weight:800; color:var(--c-primary, #1a237e); font-size:0.86rem">🏙️ ${city} <span style="font-weight:400; font-size:0.75rem; color:#666; margin-right:6px">(${cityEvs.length} השלמות/שינויים)</span></span>
        </div>
      </summary>
      <div class="city-accordion-content" style="padding:8px">`;

    // --- Pairs/Clusters: Only intact groups ---
    const pairedGids=new Set();
    const pairBlocks=[];
    const isClusterMode = (window._listGroupMode === "clusters");
    let groupList = typeof window.getPairs === 'function' ? window.getPairs(ds, ds) : (window.pairs || []);
    if (isClusterMode) {
      if (typeof window.getClusters === 'function') {
        groupList = window.getClusters(ds, ds).map(cl => ({...cl, ids: cl.gardenIds}));
      } else if (typeof getClusters === 'function') {
        groupList = getClusters(ds, ds).map(cl => ({...cl, ids: cl.gardenIds}));
      } else if (window.clusters) {
        groupList = Object.values(window.clusters).sort((a,b)=>a.name.localeCompare(b.name, 'he', { numeric: true })).map(cl => ({...cl, ids: cl.gardenIds}));
      }
    }
    groupList.forEach(pair=>{
      if(!isClusterMode && window.isPairBroken(pair.id,ds)) return;
      const pairEvs=cityEvs.filter(s => {
         if(!pair.ids.map(Number).includes(Number(s.g))) return false;
         if(isClusterMode && typeof window.gardenClusters === 'function') {
             const myCls = window.gardenClusters(s.g, ds);
             if(myCls && myCls.length > 0) return myCls[0].id === pair.id;
         }
         return true;
      });
      if(!pairEvs.length) return;
      pairEvs.sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
      pair.ids.forEach(id=>pairedGids.add(id));
      const earliest=pairEvs.map(s=>s.t||'99:99').sort()[0];
      pairBlocks.push({pair,pairEvs,earliest});
    });
    // sort pair blocks by name alphabetically
    pairBlocks.sort((a,b)=>a.pair.name.localeCompare(b.pair.name, 'he', { numeric: true }));
    if(pairBlocks.length){
      h+=`<div class="pairs-list-layout" style="margin-bottom:8px">`;
      pairBlocks.forEach(({pair,pairEvs})=>{
        h+=window.ui.renderStandardPairCard(pair,pairEvs,{ds,clr,context:'cal', isCluster: isClusterMode});
      });
      h+=`</div>`;
    }

    // --- גנים בודדים ---
    const soloEvs=cityEvs.filter(s=>!pairedGids.has(s.g) && !pairedGids.has(String(s.g)) && !pairedGids.has(Number(s.g)))
      .sort((a,b)=>{
        const na=window.G(a.g).name||'', nb=window.G(b.g).name||'';
        return na.localeCompare(nb,'he')||(a.t||'99:99').localeCompare(b.t||'99:99');
      });
      
    if(soloEvs.length){
      h+=`<div class="pairs-list-layout">`;
      soloEvs.forEach(s=>{
        const g=window.G(s.g);
        h+=window.ui.renderStandardPairCard({id:'solo_'+s.id, name:g.name, ids:[s.g]}, [s], {ds,clr,context:'cal',isSolo:true});
      });
      h+=`</div>`;
    }

    h += `</div></details>`;
  });

  if (collapseAll) {
    h += `</div></details>`;
  } else {
    h += `</div>`;
  }
  return h;
}

// ─── Range View — day-by-day between two dates ───────────────────
function renderRangeView(evs, fromDs, toDs, f, displayGids){
  let html='';
  let cur=s2d(fromDs);
  const end=s2d(toDs);
  let dayCount=0;
  while(cur<=end && dayCount<62){
    const ds=window.d2s(cur);
    const dayEvs=evs.filter(s=>s.d===ds);
    const hol=window.getHolidayInfo(ds,f&&f.city||null,f&&f.cls||null);
    const blk=window.getBlockedInfo(ds);
    const isFri=cur.getDay()===5, isSat=cur.getDay()===6;
    const hdrStyle=isSat?'background:linear-gradient(135deg,#546e7a,#78909c)':isFri?'background:linear-gradient(135deg,#e65100,#f4511e)':'';
    html+=`<div class="dsec" style="margin-bottom:10px">
      <div class="dsh gan" style="${hdrStyle}">
        ${window.fD(ds)} — יום ${window.dayN(ds)}
        ${hol?`<span style="background:rgba(255,255,255,.2);border-radius:4px;padding:1px 7px;font-size:.72rem">${hol.emoji} ${hol.name}</span>`:''}
        ${dayEvs.length?`<span style="margin-right:auto;font-size:.72rem;opacity:.8">${dayEvs.length} פעילויות</span>`:'<span style="margin-right:auto;font-size:.72rem;opacity:.6">אין פעילויות</span>'}
        <button onclick="openBlockedDate('${ds}')" style="background:rgba(255,255,255,.15);border:none;border-radius:4px;padding:1px 7px;cursor:pointer;font-size:.68rem;color:#fff">🚫</button>
        <button onclick="calD=s2d('${ds}');setView('day')" style="background:rgba(255,255,255,.15);border:none;border-radius:4px;padding:1px 7px;cursor:pointer;font-size:.68rem;color:#fff">📋 יומי</button>
      </div>`;
    if(blk) html+=`<div style="padding:5px 12px;background:#ffebee;font-size:.75rem;color:#c62828;font-weight:700">${blk.icon||'🚫'} ${blk.reason}${blk.note?' — '+blk.note:''}</div>`;
  
    // Global Makeups at Top
    html += renderMakeupsTop(ds, f&&f.city, f&&f.cls, true);

    if(!dayEvs.length){
      html+=`<div style="padding:10px;text-align:center;color:#bbb;font-size:.76rem;background:#fff">אין פעילויות</div>`;

    } else if(f&&f.cluster){
      // ── אשכול: לפי שעה ──
      html+=`<div style="background:#fff;padding:8px">${renderClusterDay(dayEvs,ds,f.cluster)}</div>`;

    } else if(displayGids){
      // ── זוג/שלישייה ספציפי ──
      html+=`<div style="background:#fff;padding:8px">${renderPairDay(dayEvs,displayGids)}</div>`;

    } else {
      // ── תצוגה כללית: עיר → זוגות לפי שעה → צהרונים בודדים לפי שעה ──
      const cityFilter=f&&f.city||'';
      const allCities=cityFilter
        ? [cityFilter]
        : [...new Set(dayEvs.map(s=>window.G(s.g).city||'אחר'))].sort((a,b)=>a.localeCompare(b,'he'));

      allCities.forEach(city=>{
        const cityEvs=dayEvs.filter(s=>(window.G(s.g).city||'אחר')===city);
        if(!cityEvs.length) return;

        ['גנים', 'ביה"ס'].forEach(gClass => {
          const typeEvs = cityEvs.filter(s => window.gcls(window.G(s.g)) === gClass);
          if(!typeEvs.length) return;
          
          const clr=window.CITY_COLORS(city);
          const typeName = gClass === 'ביה"ס' ? 'בתי ספר' : 'צהרוני גנים';
          const typeIcon = gClass === 'ביה"ס' ? '🏛️' : '🏫';
          const dateUsedIds = new Set();

          html+=`<details class="city-accordion">
            <summary>
              <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                <span style="font-weight:800; color:#2d3748;">${typeIcon} ${city} - ${typeName} (${typeEvs.length})</span>
              </div>
            </summary>
            <div class="city-accordion-content">`;

          // --- זוגות: מיון לפי שם ואז לפי שעה ---
          const pairedGids=new Set();
          const pairBlocks=[];

          const isClusterMode = (window._listGroupMode === "clusters");
          if(!window._disableGrouping){
            let groupList = (typeof window.getPairs === 'function' ? window.getPairs(ds, ds) : (window.pairs||[]));
            if (isClusterMode) {
              if (typeof window.getClusters === 'function') {
                groupList = window.getClusters(ds, ds).map(cl => ({...cl, ids: cl.gardenIds}));
              } else if (typeof getClusters === 'function') {
                groupList = getClusters(ds, ds).map(cl => ({...cl, ids: cl.gardenIds}));
              } else if (window.clusters) {
                groupList = Object.values(window.clusters).sort((a,b)=>a.name.localeCompare(b.name, 'he', { numeric: true })).map(cl => ({...cl, ids: cl.gardenIds}));
              }
            }
            groupList.forEach(pair=>{
              if(!isClusterMode && window.isPairBroken(pair.id,ds)) return;
              const pairEvs=typeEvs.filter(s=>pair.ids.map(Number).includes(Number(s.g)));
              if(!pairEvs.length) return;
              pairEvs.forEach(s => dateUsedIds.add(String(s.id)));
              pairEvs.sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
              pair.ids.forEach(id=>pairedGids.add(id));
              const earliest=pairEvs.map(s=>s.t||'99:99').sort()[0];
              pairBlocks.push({pair,pairEvs,earliest});
            });
          }
          // sort pair blocks by name alphabetically
          pairBlocks.sort((a,b)=>a.pair.name.localeCompare(b.pair.name, 'he', { numeric: true }));
          if(pairBlocks.length){
            html+=`<div class="pairs-list-layout" style="margin-bottom:8px">`;
            pairBlocks.forEach(({pair,pairEvs})=>{
              html+=window.ui.renderStandardPairCard(pair,pairEvs,{ds,clr,context:'cal', isCluster: isClusterMode});
            });
            html+=`</div>`;
          }

          // --- גנים בודדים ---
          const soloEvs=typeEvs.filter(s=>!pairedGids.has(s.g) && !pairedGids.has(String(s.g)) && !pairedGids.has(Number(s.g)))
            .sort((a,b)=>{
              const na=window.G(s.g).name||'', nb=window.G(b.g).name||'';
              return na.localeCompare(nb,'he')||(a.t||'99:99').localeCompare(b.t||'99:99');
            });
            
          if(soloEvs.length){
            html+=`<div class="pairs-list-layout">`;
            soloEvs.forEach(s=>{
              const g=window.G(s.g);
              html+=window.ui.renderStandardPairCard({id:'solo_'+s.id, name:g.name, ids:[s.g]}, [s], {ds,clr,context:'cal',isSolo:true});
            });
            html+=`</div>`;
          }
          html+=`</div></details>`; // end city type accordion
        });
      });
    }

    html+=`</div>`; // end day
    cur=addD(cur,1);
    dayCount++;
  }
  if(dayCount>=62) html+=`<div style="background:#fff3e0;padding:10px;text-align:center;border-radius:7px;color:#e65100;font-size:.8rem">⚠️ הטווח המקסימלי הוא 62 ימים</div>`;
  return html||`<div class="card" style="text-align:center;color:#999;padding:25px">בחר טווח תאריכים</div>`;
}

// ─── Cluster Day View — sorted by time ─────────────────────────
function renderClusterDay(evs, ds, clusterName){
  let html='';
  const hol=window.getHolidayInfo(ds,null,null);
  if(hol) html+=`<div class="hol-banner ${hol.type||'vacation'}" style="margin-bottom:8px;font-size:.82rem">${hol.emoji} <b>${hol.name}</b>${hol.note?' — '+hol.note:''}</div>`;
  const blk=window.getBlockedInfo(ds);
  if(blk) html+=`<div style="background:#fce4ec;border:2px solid #e91e63;border-radius:9px;padding:9px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
    <span style="font-size:.85rem;font-weight:700;color:#c62828">${blk.icon||'🚫'} <b>${blk.reason}</b>${blk.note?' — '+blk.note:''}</span>
    <button onclick="openBlockedDate('${ds}')" style="background:none;border:1.5px solid #e91e63;color:#c62828;border-radius:5px;padding:2px 8px;cursor:pointer;font-size:.72rem">✏️ ערוך</button>
  </div>`;
  const isAll = clusterName==='__all__';
  const clObjD=!isAll&&window.getClusters().find(cl=>cl.name===clusterName);
  const clGidsD=clObjD?(clObjD.gardenIds||[]):evs.map(s=>s.g).filter((v,i,a)=>a.indexOf(v)===i);
  html+=`<div style="background:#e8eaf6;border-radius:7px;padding:6px 12px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;font-size:.78rem;font-weight:700;color:#1a237e">
    <span>🔢 ${isAll?'כל האשכולות':('אשכול: '+clusterName)} <span style="font-weight:400;color:#546e7a">${evs.length} פעילויות</span></span>
    <div style="display:flex;gap:6px">
      ${!isAll && clObjD ? `<button class="btn bp bsm" onclick="event.stopPropagation();window.openClusterBulkEdit('${clObjD.id}','${ds}')" style="font-size:.68rem;padding:2px 8px">✏️ עריכה מרוכזת</button>` : ''}
      <button class="btn bg bsm" onclick="event.stopPropagation();window._exportPairWA(${JSON.stringify(clGidsD)})" style="font-size:.68rem;padding:2px 8px">📋 הודעה</button>
    </div>
  </div>`;
  const calCls = window.getEl ? (window.getEl('cal-cls')?.value || '') : (document.getElementById('cal-cls')?.value || '');
  const calCity = window.getEl ? (window.getEl('cal-city')?.value || '') : (document.getElementById('cal-city')?.value || '');
  // Global Makeups at Top (Removed here because the orchestrator already renders them)
  // html += renderMakeupsTop(ds, calCity, calCls, true);

  // Filter out makeups and cancellations from the regular section to avoid duplication
  const others = evs.filter(s => !(s.st === 'can' || s.st === 'nohap' || s._isMakeup || s._makeupFrom || (s.nt && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.nt)) || (s.n && /השלמה|הוקדם מ/i.test(s.n))));

  if (isAll) {
    const allCities=[...new Set(others.map(s=>window.G(s.g).city||'אחר'))].sort((a,b)=>a.localeCompare(b,'he'));
      allCities.forEach(city=>{
        const cityEvs=others.filter(s=>(window.G(s.g).city||'אחר')===city);
        if(!cityEvs.length) return;

        ['גנים', 'ביה"ס'].forEach(gClass => {
          const typeEvs = cityEvs.filter(s => window.gcls(window.G(s.g)) === gClass);
          if(!typeEvs.length) return;

          const clrCity=window.CITY_COLORS(city);
          const typeName = gClass === 'ביה"ס' ? 'בתי ספר' : 'צהרוני גנים';
          const typeIcon = gClass === 'ביה"ס' ? '🏛️' : '🏫';

          html+=`<details class="city-accordion">
            <summary>
              <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                <span style="font-weight:800; color:#2d3748;">${typeIcon} ${city} - ${typeName} (${typeEvs.length})</span>
              </div>
            </summary>
            <div class="city-accordion-content">`;
        // Group by cluster within city type
        const clusterMap={};
        typeEvs.forEach(s=>{
          const gClusters=window.gardenClusters(s.g, ds);
          const clKey=gClusters.length?gClusters[0].name:'ללא אשכול';
          (clusterMap[clKey]=clusterMap[clKey]||[]).push(s);
        });
        Object.entries(clusterMap).sort((a,b)=>a[0].localeCompare(b[0], 'he', { numeric: true })).forEach(([clName,clEvs])=>{
          const sorted=[...clEvs].sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
          const clObj = clName !== 'ללא אשכול' ? window.getClusters().find(c => c.name.trim() === clName.trim()) : null;
          const clGids = clEvs.map(s => s.g);
          
          html+=`<div style="margin-bottom:10px">
            <div style="padding:3px 10px;background:${clrCity.light};border-right:3px solid ${clrCity.solid};border-radius:4px;font-size:.74rem;font-weight:700;color:${clrCity.solid};margin-bottom:5px;display:flex;justify-content:space-between;align-items:center">
              <span>🔢 ${clName} — ${sorted.length} פעילויות</span>
              <div style="display:flex;gap:4px">
                ${clObj ? `<button class="btn bp bsm" onclick="event.stopPropagation();window.openClusterBulkEdit('${clObj.id}','${ds}')" style="font-size:.62rem;padding:1px 6px">✏️ עריכה</button>` : ''}
                ${clGids.length ? `<button class="btn bg bsm" onclick="event.stopPropagation();window._exportPairWA(${JSON.stringify(clGids)})" style="font-size:.62rem;padding:1px 6px">📋 הודעה</button>` : ''}
              </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">`;
            
            sorted.forEach(s => {
              html += window.ui.renderStandardPairCard({id:'solo_'+s.id, name:window.G(s.g).name, ids:[s.g]}, [s], {
                ds: s.d,
                clr: clrCity,
                context: 'cal',
                isSolo: true
              });
            });
            html+=`</div></div>`;
          });
          html+=`</div></details>`;
        });
      });
  } else {
    // ── אשכול בודד: עיר → גן → שעה ──
    const others=evs.filter(s=> s.d===ds);
    const citiesInCluster = [...new Set(others.map(s => window.G(s.g).city || 'אחר'))].sort();
    
    citiesInCluster.forEach(city => {
      const cityEvs = others.filter(s => (window.G(s.g).city || 'אחר') === city);
      const clrCity = window.CITY_COLORS(city);
      
      html += `<details class="city-accordion" open>
        <summary>
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <span style="font-weight:800; color:#2d3748;">🏙️ ${city} (${cityEvs.length})</span>
          </div>
        </summary>
        <div class="city-accordion-content">`;

      cityEvs.sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99')).forEach(s=>{
        const g=window.G(s.g);
        html += window.ui.renderStandardPairCard({id:'solo_'+s.id, name:g.name, ids:[s.g]}, [s], {
          ds: s.d,
          clr: clrCity,
          context: 'cal',
          isSolo: true
        });
      });
      html += `</div></details>`;
    });
    }


  return html;
}

// ─── Cluster Week View — each day sorted by time ─────────────────
function renderClusterWeek(evs, weekStart, clusterName){
  const isAll=clusterName==='__all__';
  const clObj=!isAll&&getClusters().find(cl=>cl.name===clusterName);
  const clGids=clObj?(clObj.gardenIds||[]):evs.map(s=>s.g).filter((v,i,a)=>a.indexOf(v)===i);
  const waBtn=`<button onclick="event.stopPropagation();_exportPairWA(${JSON.stringify(clGids)})" style="background:#25d366;border:none;border-radius:4px;color:#fff;font-size:.65rem;padding:2px 8px;cursor:pointer;margin-right:8px">📋 הודעה</button>`;
  let html=`<div style="background:#e8eaf6;border-radius:7px;padding:5px 12px;margin-bottom:10px;font-size:.77rem;font-weight:700;color:#1a237e;display:flex;align-items:center;justify-content:space-between">
    <span>🔢 ${isAll?'כל האשכולות':('אשכול: '+clusterName)} — תצוגה שבועית (5 ימי עבודה)</span>
    ${waBtn}
  </div>`;
  const days = window.getNextWorkDays(weekStart, 5);
  days.forEach(d=>{
    const ds=window.d2s(d);

    const hol=window.getHolidayInfo(ds,null,null);
    const blk=window.getBlockedInfo(ds);
    const calClsW = window.getEl ? (window.getEl('cal-cls')?.value || '') : (document.getElementById('cal-cls')?.value || '');
    const calCityW = window.getEl ? (window.getEl('cal-city')?.value || '') : (document.getElementById('cal-city')?.value || '');
    
    // Global Makeups at Top
    html += renderMakeupsTop(ds, calCityW, calClsW, true);
    
    // Filter out makeups and cancellations from the regular section to avoid duplication
    const dayEvs = evs.filter(s => s.d === ds && !(s.st === 'can' || s.st === 'nohap' || s._isMakeup || s._makeupFrom || (s.nt && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.nt)) || (s.n && /השלמה|הוקדם מ/i.test(s.n))))
                    .sort((a,b) => (a.t||'99:99').localeCompare(b.t||'99:99'));
    const editBtn = (!isAll && clObj) ? `<button onclick="event.stopPropagation();window.openClusterBulkEdit('${clObj.id}','${ds}')" style="background: linear-gradient(135deg, #1565c0, #1e88e5); border:none; border-radius:4px; color:#fff; font-size:.7rem; font-weight:700; padding:3px 10px; cursor:pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">✏️ עריכה מרוכזת</button>` : '';
    html+=`<div class="dsec" style="margin-bottom:10px">
      <div class="dsh gan" style="display:flex;align-items:center; justify-content:space-between">
        <span>${window.fD(ds)} — יום ${window.dayN(ds)}${hol?` 🎉 ${hol.name}`:''}</span>
        ${editBtn}
      </div>`;
    if(blk) html+=`<div style="padding:5px 12px;background:#ffebee;font-size:.75rem;color:#c62828;font-weight:700">${blk.icon||'🚫'} ${blk.reason}</div>`;

    if(!dayEvs.length){
      html+=`<div style="padding:12px;text-align:center;color:#bbb;font-size:.76rem;background:#fff">אין פעילויות</div>`;
    } else if(isAll){
      // עיר → אשכול → שעה
      const allCities=[...new Set(dayEvs.map(s=>window.G(s.g).city||'אחר'))].sort((a,b)=>a.localeCompare(b,'he'));
      html+=`<div style="background:#fff;padding:8px">`;
      allCities.forEach(city=>{
        const cityEvs=dayEvs.filter(s=>(window.G(s.g).city||'אחר')===city);
        if(!cityEvs.length) return;
        const clrCity=window.CITY_COLORS(city);
        html+=`<details class="city-accordion">
          <summary>
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
              <span style="font-weight:800; color:#2d3748;">🏙️ ${city} (${cityEvs.length})</span>
            </div>
          </summary>
          <div class="city-accordion-content">`;
        const clusterMap={};
        cityEvs.forEach(s=>{
          const clKey=(window.gardenClusters(s.g, ws)[0]||{}).name||'ללא אשכול';
          (clusterMap[clKey]=clusterMap[clKey]||[]).push(s);
        });
        Object.entries(clusterMap).sort((a,b)=>a[0].localeCompare(b[0], 'he', { numeric: true })).forEach(([clName,clEvs])=>{
          const clObj = clName !== 'ללא אשכול' ? window.getClusters().find(c => c.name.trim() === clName.trim()) : null;
          const clGids = clEvs.map(s => s.g);
          
          html+=`<div style="font-size:.68rem;font-weight:700;color:${clrCity.solid};background:${clrCity.light};padding:2px 7px;border-radius:3px;margin-bottom:3px;display:flex;justify-content:space-between;align-items:center">
            <span>🔢 ${clName}</span>
            <div style="display:flex;gap:4px">
              ${clObj ? `<button class="btn bp bsm" onclick="event.stopPropagation();window.openClusterBulkEdit('${clObj.id}','${ds}')" style="font-size:.62rem;padding:1px 6px">✏️ עריכה</button>` : ''}
              ${clGids.length ? `<button class="btn bg bsm" onclick="event.stopPropagation();window._exportPairWA(${JSON.stringify(clGids)})" style="font-size:.62rem;padding:1px 6px">📋 הודעה</button>` : ''}
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:5px">`;
          [...clEvs].sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99')).forEach(s=>{
            html += window.ui.renderStandardPairCard({id:'solo_'+s.id, name:window.G(s.g).name, ids:[s.g]}, [s], {
              ds: s.d,
              clr: clrCity,
              context: 'cal',
              isSolo: true
            });
          });
          html+=`</div>`;
        });
        html+=`</div>`;
      });
      html+=`</div>`;
    } else {
      html+=`<div style="background:#fff;padding:8px;display:flex;flex-wrap:wrap;gap:6px">`;
      dayEvs.forEach(s=>{
        html += window.ui.renderStandardPairCard({id:'solo_'+s.id, name:window.G(s.g).name, ids:[s.g]}, [s], {
          ds: s.d,
          clr: window.CITY_COLORS(window.G(s.g).city||''),
          context: 'cal',
          isSolo: true
        });
      });
      html+=`</div>`;
    }
    html+=`</div>`;
  });
  return html;
}


function renderNormalDay(evs,ds){
  const calCls = window.getEl ? (window.getEl('cal-cls')?.value || '') : (document.getElementById('cal-cls')?.value || '');
  const calCity = window.getEl ? (window.getEl('cal-city')?.value || '') : (document.getElementById('cal-city')?.value || '');
  const hol=window.getHolidayInfo ? window.getHolidayInfo(ds,calCity||null,calCls||null) : null;
  let topHtml='';
  if(hol) topHtml=`<div class="hol-banner ${hol.type||'vacation'}" style="margin-bottom:8px;font-size:.82rem">${hol.emoji} <b>${hol.name}</b>${hol.note?' — '+hol.note:''}</div>`;
  const blk=window.getBlockedInfo ? window.getBlockedInfo(ds) : null;
  if(blk) topHtml+=`<div style="background:#fce4ec;border:2px solid #e91e63;border-radius:9px;padding:9px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
    <span style="font-size:.85rem;font-weight:700;color:#c62828">${blk.icon||'🚫'} <b>${blk.reason}</b>${blk.note?' — '+blk.note:''}</span>
    <button onclick="window.openBlockedDate('${ds}')" style="background:none;border:1.5px solid #e91e63;color:#c62828;border-radius:5px;padding:2px 8px;cursor:pointer;font-size:.72rem">✏️ ערוך</button>
  </div>`;
  // Global Makeups at Top (Removed here because the orchestrator already renders them)
  // topHtml += renderMakeupsTop(ds, calCity, calCls);
  
  const isM = s => !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.nt)) || (s.n && /השלמה|הוקדם מ/i.test(s.n)));
  // Filter out makeups from the regular section to avoid duplication
  const others = evs.filter(s => !isM(s)); 
  const pairedGids=new Set();
  const pairsByCity={};

  const isClusterMode = (window._listGroupMode === "clusters");
  let groupList = (typeof window.getPairs === 'function' ? window.getPairs(ds, ds) : (window.pairs||[]));
  if (isClusterMode) {
    if (typeof window.getClusters === 'function') {
      groupList = window.getClusters(ds, ds).map(cl => ({...cl, ids: cl.gardenIds}));
    } else if (typeof getClusters === 'function') {
      groupList = getClusters(ds, ds).map(cl => ({...cl, ids: cl.gardenIds}));
    } else if (window.clusters) {
      groupList = Object.values(window.clusters).sort((a,b)=>a.name.localeCompare(b.name, 'he', { numeric: true })).map(cl => ({...cl, ids: cl.gardenIds}));
    }
  }

  groupList.forEach(pair=>{
    if(!isClusterMode && window.isPairBroken(pair.id,ds)) return;
    const pairEvs=others.filter(s => {
       if(!pair.ids.map(Number).includes(Number(s.g))) return false;
       if(isClusterMode && typeof window.gardenClusters === 'function') {
           const myCls = window.gardenClusters(s.g, ds);
           if(myCls && myCls.length > 0) return myCls[0].id === pair.id;
       }
       return true;
    });
    if(!pairEvs.length) return;
    
    // Mark ALL ids in this pair as paired, even if they don't have activities today
    // to prevent them from showing up in the solo list below
    pair.ids.forEach(id => pairedGids.add(Number(id)));
    
    const city=window.G(pair.ids[0]).city||'אחר';
    if(!pairsByCity[city]) pairsByCity[city]=[];
    pairsByCity[city].push({pair,pairEvs});
  });

  const allSoloEvs = others.filter(s => !pairedGids.has(Number(s.g)));

  groupList.forEach(pair=>{
    if(!isClusterMode && window.isPairBroken(pair.id,ds)) return;
    const pairEvs=others.filter(s=>pair.ids.map(Number).includes(Number(s.g)));
    if(!pairEvs.length) return;
    pairEvs.forEach(s=>{
      if(pairedGids.has(s.g)) return;
      if(!allSoloEvs.find(x=>x.id===s.id))
        allSoloEvs.push({...s,_broken:pair});
    });
  });

  let html=topHtml;

  if(allSoloEvs.length || Object.keys(pairsByCity).length > 0){
    const cardsByCity={};
    const cityCards={};
    Object.keys(pairsByCity).sort().forEach(city=>{
      const clr=window.CITY_COLORS(city);
      if(!cityCards[city]) cityCards[city]=[];
      pairsByCity[city].forEach(({pair,pairEvs})=>{
        pairEvs.sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
        const ch = window.ui.renderStandardPairCard(pair,pairEvs,{ds,clr,context:'cal', isCluster: isClusterMode});
        cityCards[city].push({name:pair.name, html:ch});
      });
    });
    allSoloEvs.forEach(s=>{
      const g=window.G(s.g);
      const city=g.city||'אחר';
      const clr=window.CITY_COLORS(city);
      if(!cityCards[city]) cityCards[city]=[];
      const ch = window.ui.renderStandardPairCard({id:'solo_'+s.id, name:g.name, ids:[s.g]}, [s], {ds,clr,context:'cal',isSolo:true});
      cityCards[city].push({name:g.name, html:ch});
    });

    Object.keys(cityCards).sort().forEach(city=>{
      cityCards[city].sort((a,b)=>a.name.localeCompare(b.name, 'he', { numeric: true }));
      const cards = cityCards[city].map(c=>c.html);
      if(!cards || !cards.length) return;
      html += `<details class="city-accordion">
        <summary>
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <span style="font-weight:800; color:#2d3748;">🏙️ ${city} (${cards.length})</span>
          </div>
        </summary>
        <div class="city-accordion-content">
          <div class="pairs-list-layout">${cards.join('')}</div>
        </div>
      </details>`;
    });
  }
  if(!html||html===topHtml) html+=`<div class="card" style="text-align:center;color:#999;padding:25px">אין פעילויות ביום זה</div>`;
  return html;
}

// Unified rendering functions moved to core.js window.ui

function renderPairDay(evs,gids){
  const pclr=window.pairClrClass ? window.pairClrClass(gids[0]?window.gardenPair(gids[0])?.id:0) : 'pc0';
  const pairIds = gids.filter(Boolean);
  return`<div class="pair-row ${pclr}">
    <div class="pair-row-label ${pclr}" style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:0.92rem; font-weight:800">🔗 ${gids.map(id=>window.G(id).name||'').join(' + ')}</span>
      <button onclick="event.stopPropagation();window._exportPairWA([${pairIds.join(',')}])" style="background:rgba(255,255,255,.25);border:none;border-radius:4px;color:#fff;font-size:.65rem;padding:1px 6px;cursor:pointer">📋 הודעה</button>
    </div>
    ${window.renderPairColsHTML ? window.renderPairColsHTML(evs,gids) : ''}</div>`;
}

function renderNormalWeek(evs, ws, f){
  const tday=window.td();
  const days=window.getNextWorkDays(ws, 5);
  const we = days[days.length - 1];

  let gids=[...new Set(evs.map(s=>s.g))];
  if(f.gids&&f.gids.length) gids=f.gids;
  if(!gids.length) return'<div class="card" style="text-align:center;color:#999;padding:25px">אין פעילויות</div>';

  const usedGids = new Set();
  const byCity = {};
  function ensureCity(city){ if(!byCity[city]) byCity[city]={pairs:[],solos:[]}; }

  const isClusterMode = window._listGroupMode === 'clusters';
  let groupSource = (typeof window.getPairs === 'function' ? window.getPairs(window.d2s(ws), window.d2s(we)) : (window.pairs||[]));
  if (isClusterMode) {
    if (typeof window.getClusters === 'function') {
      groupSource = window.getClusters(window.d2s(ws), window.d2s(we)).map(c => ({ id: c.id, name: c.name, ids: c.gardenIds || [] }));
    } else if (typeof getClusters === 'function') {
      groupSource = getClusters(window.d2s(ws), window.d2s(we)).map(c => ({ id: c.id, name: c.name, ids: c.gardenIds || [] }));
    } else if (window.clusters) {
      groupSource = Object.values(window.clusters).sort((a,b)=>a.name.localeCompare(b.name, 'he', { numeric: true })).map(c => ({ id: c.id, name: c.name, ids: c.gardenIds || [] }));
    }
  }

  groupSource.forEach(pair=>{
    const myGids=pair.ids.filter(gid=>gids.map(Number).includes(Number(gid)));
    if(!myGids.length) return;
    const city=window.G(myGids[0]).city||'אחר';
    ensureCity(city);
    myGids.forEach(gid=>usedGids.add(gid));
    byCity[city].pairs.push({pair,gids:myGids});
  });
  gids.filter(gid=>!usedGids.has(gid)).forEach(gid=>{
    const g=window.G(gid); const city=g.city||'אחר';
    ensureCity(city);
    byCity[city].solos.push(gid);
  });

  const sortedCities=Object.keys(byCity).sort((a,b)=>a.localeCompare(b,'he'));
  sortedCities.forEach(city=>{
    byCity[city].pairs.sort((a,b)=>a.pair.name.localeCompare(b.pair.name, 'he', { numeric: true }));
    byCity[city].solos.sort((a,b)=>(window.G(a).name||'').localeCompare(window.G(b).name||'','he'));
  });
  let html = '<div class="tw-sticky">'
          +'<table style="min-width:950px;width:100%"><thead><tr>';

  html+=`<th style="min-width:140px;background:#e8eaf6;color:#283593;padding:6px 8px;
    border-bottom:2px solid #9fa8da;border-left:1px solid #c5cae9;
    position:sticky;top:0;z-index:3;font-size:.76rem">צהרון / זוג</th>`;

  days.forEach((d,i)=>{
    const ds=window.d2s(d);
    const hol=window.getHolidayInfo ? window.getHolidayInfo(ds) : null;
    const blkWk=window.getBlockedInfo ? window.getBlockedInfo(ds) : null;
    const isToday=ds===tday;
    const bg=isToday?'#1565c0':blkWk?'#fce4ec':hol?hol.bg:'#e8eaf6';
    const col=isToday?'#fff':blkWk?'#c62828':hol?hol.color:'#283593';
    const bottomBorder=blkWk?'border-bottom:3px solid #e91e63':'border-bottom:2px solid #9fa8da';
    html+=`<th style="background:${bg};color:${col};padding:3px 4px;text-align:center;font-size:.76rem;min-width:132px;
      ${bottomBorder};border-left:1px solid ${isToday?'rgba(255,255,255,.3)':'#c5cae9'};
      position:sticky;top:0;z-index:3;white-space:nowrap;line-height:1.3" onclick="window.jumpToDay('${ds}')">
      <span style="font-weight:700">${window.dayN(ds)}</span> <span style="font-size:.64rem;font-weight:400">${window.fD(ds)}</span>

      <br><span style="font-size:.56rem;font-weight:400;opacity:.7">${window.toHebDate ? window.toHebDate(ds) : ''}</span>
      ${blkWk?`<span style="font-size:.58rem;cursor:pointer;display:block" onclick="event.stopPropagation();window.openBlockedDate('${ds}')">${blkWk.icon||'🚫'} ${blkWk.reason}</span>`:''}
    </th>`;
  });

  html+='</tr></thead><tbody>';

  sortedCities.forEach(city=>{
    const clr=window.CITY_COLORS(city);

    // City header row - added toggle function for weekly table
    const cityId = `city-${city.replace(/\s+/g,'-')}`;
    const groupLabel = window._listGroupMode === 'clusters' ? 'אשכולות' : 'זוגות';
    html+=`<tr onclick="toggleTableCity('${cityId}')" style="cursor:pointer" class="city-header-row">
      <td colspan="6" style="background:${clr.solid};color:#fff;padding:7px 12px;font-size:.9rem;font-weight:800;
        border-bottom:1px solid rgba(255,255,255,.2);position:sticky;right:0;z-index:9">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span>🏙️ ${city} <span style="font-weight:400;font-size:.75rem;opacity:.85;margin-right:8px">${byCity[city].pairs.length} ${groupLabel} · ${byCity[city].solos.length} צהרונים בודדים</span></span>
          <span style="font-size:0.7rem; font-weight:400; opacity:0.8;">לחץ לכיווץ/הרחבה ↕️</span>
        </div>
      </td>
    </tr>`;

    // Wrapper for rows of this city
    const cityRowClass = `city-row-${cityId}`;

    function makeCell(gid, ds, de, blk, hol, clrObj){
      const isToday=ds===tday;
      const cellBg=blk?'#fff5f5':isToday?'#f8faff':hol?hol.bg+'22':'#fff';
      const borderColor=isToday?'var(--c-primary)':'#e2e8f0';
      let inner='';
      if(de.length){
        de.forEach(ev=>{
          const isM = !!(ev._isMakeup || ev._makeupFrom || (ev.nt && /השלמה/i.test(ev.nt)));
          const imported = !!ev._isImported;
          const bgCol = isM ? '#fff9c4' : imported ? '#f1f5f9' : '#fff';
          const borderCol = isM ? '#fbc02d' : '#e2e8f0';
          const stC = ev.st==='can'?'st-can':ev.st==='done'?'st-done':ev.st==='nohap'?'st-nohap':ev.st==='post'?'st-post':'';
          inner+=`<div class="pslot ${stC}" style="border-radius:6px; padding:6px 8px; margin:3px 0; font-size:var(--fs-xs);
            background:${bgCol}; border:1px solid ${borderCol}; border-right:3px solid ${clrObj.solid}; box-shadow:0 1px 2px rgba(0,0,0,0.03); cursor:pointer"
            onclick="event.stopPropagation();window.openSP('${ev.id}')">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:4px">
              <div style="flex:1; min-width:0">
                <div style="font-weight:800; color:var(--c-secondary); font-size:var(--fs-small); line-height:1.2">${ev.n || window.supBase(ev.a)}</div>
                ${ev.act ? `<div style="color:var(--c-info); font-size:var(--fs-xs); margin-top:1px">${ev.act}</div>` : ''}
                ${ev.t ? `<div style="font-size:var(--fs-xs); color:#64748b; margin-top:2px">⏰ ${window.fT(ev.t)}</div>` : ''}
                ${isM ? `<div style="display:inline-block; background:#ffe082; color:#b71c1c; border-radius:4px; padding:1px 5px; font-size:0.6rem; font-weight:800; border:1px solid #ffca28; margin-top:3px">📅 השלמה</div>`:''}
              </div>
              <div style="display:flex; flex-direction:column; gap:3px; flex-shrink:0" onclick="event.stopPropagation()">
                ${window.ui.renderQuickActionBtns(ev)}
              </div>
            </div>
          </div>`;
        });
        if(blk) inner+=`<div style="font-size:var(--fs-xs); color:var(--c-error); padding:4px; font-weight:700">${blk.icon||'🚫'} ${blk.reason}</div>`;
      } else if(blk){
        inner=`<div style="font-size:var(--fs-xs); color:var(--c-error); padding:6px; text-align:center; font-weight:700">${blk.icon||'🚫'} ${blk.reason}</div>`;
      } else if(hol){
        inner=`<div style="font-size:var(--fs-xs); color:${hol.color}; font-weight:700; padding:4px; text-align:center">${hol.emoji} ${hol.name}</div>`;
      } else {
        inner=`<div style="color:#cbd5e1; font-size:1.2rem; font-weight:300; text-align:center; padding:8px 0; cursor:pointer">+</div>`;
      }
      const jumpBtn = `<button onclick="event.stopPropagation(); window.calJump('','week','${gid}')" 
        style="position:absolute; top:4px; left:4px; background:white; border:1px solid #e2e8f0;
        border-radius:4px; color:#64748b; font-size:10px; padding:2px 5px; cursor:pointer; opacity:0; transition:all 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.1)" class="cell-jump-btn">📅</button>`;

      return `<td style="background:${cellBg}; position:relative; border-bottom:1px solid ${borderColor}; border-left:1px solid ${borderColor};
        padding:5px; vertical-align:top; min-width:140px"
        onmouseover="this.querySelector('.cell-jump-btn').style.opacity=1"
        onmouseout="this.querySelector('.cell-jump-btn').style.opacity=0"
        onclick="window.openGcellPopup(${gid},'${ds}',event)">${jumpBtn}${inner}</td>`;
    }

    // window.pairs or clusters
    byCity[city].pairs.forEach(({pair,gids:pGids})=>{
      const pairGidList = pGids.join(',');
      const pIdStr = `pair-${pair.id}`;
      html+=`<tr class="${cityRowClass} pair-hdr-${cityId}" onclick="window.toggleTableCluster('${pIdStr}')" style="display:none;cursor:pointer">
        <td colspan="6" style="background:${clr.solid};color:#fff;padding:5px 12px;
          font-size:.92rem;font-weight:800;border-bottom:1px solid rgba(255,255,255,.2)">
          <div style="display:flex;align-items:center;gap:8px">
            <span id="icon-${pIdStr}" style="width:18px;text-align:center;font-size:1.1rem;user-select:none">➖</span>
            <button onclick="event.stopPropagation();window._exportPairWA([${pairGidList}])"
              style="background:rgba(255,255,255,.22);border:none;border-radius:5px;color:#fff;
                font-size:.72rem;padding:3px 10px;cursor:pointer;white-space:nowrap;flex-shrink:0">📋 הודעה</button>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🔗 ${pair.name}</span>
          </div>
        </td>
      </tr>`;
      pGids.forEach(gid=>{
        const g=window.G(gid);
        html+=`<tr class="${cityRowClass} pair-row-${pIdStr} pair-child-${cityId}" style="display:none;"><td style="background:#fafbff; font-size:var(--fs-small); padding:6px 10px; color:var(--c-primary); font-weight:700;
          border-right:3px solid ${clr.solid}; border-bottom:1px solid #dde1f0; border-left:1px solid #dde1f0;
          position:sticky; right:0; z-index:1; white-space:nowrap; max-width:180px; overflow:hidden; text-overflow:ellipsis; line-height:1.2">
          ${g.name}<br><span style="font-size:var(--fs-xs); color:#64748b; font-weight:400">${g.st ? '📍 ' + g.st : g.city}</span>
        </td>`;
        days.forEach(d=>{
          const ds=d2s(d);
          const hol=getHolidayInfo(ds,g.city,window.gcls(g));
          const gBlk=window.getGardenBlock(gid,ds);
          const de=evs.filter(s=>s.g===gid&&s.d===ds).sort((a,b)=>window.compareActivities(a, b));
          html+=makeCell(gid,ds,de,gBlk,hol,clr);
        });
        html+='</tr>';
      });
    });

    // Solo GARDENS
    byCity[city].solos.forEach(gid=>{
      const g=window.G(gid);
      html+=`<tr class="${cityRowClass}" style="display:none;"><td style="background:#fafbff;font-size:14px;padding:6px 10px;color:#333;font-weight:700;
        border-right:3px solid ${clr.solid};border-bottom:1px solid #dde1f0;border-left:1px solid #dde1f0;
        position:sticky;right:0;z-index:1;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis">
        ${g.name}<br><span style="font-size:12px;color:#78909c;font-weight:400">${g.city}</span>
      </td>`;
      days.forEach(d=>{
        const ds=d2s(d);
        const hol=getHolidayInfo(ds,g.city,window.gcls(g));
        const soloBlk=window.getGardenBlock(gid,ds);
        const de=evs.filter(s=>s.g===gid&&s.d===ds).sort((a,b)=>window.compareActivities(a, b));
        html+=makeCell(gid,ds,de,soloBlk,hol,clr);
      });
      html+='</tr>';
    });
  });

  return html+'</tbody></table></div>';
}

function renderPairWeek(evs,ws,gids){
  const days=window.getNextWorkDays(ws, 5), tday=td();
  const cols=[gids[0]||null,gids[1]||null,gids[2]||null];
  const pair=gids[0]?gardenPair(gids[0]):null;
  const clr=pair?pairWeekColors(pair.id):{solid:'#1565c0',light:'#e3f2fd'};
  let html='<div class="tw"><table class="wpt"><thead><tr><th class="dth" style="min-width:75px">יום</th>';

  cols.forEach((gid,i)=>{
    if(!gid){html+=`<th class="thx">—</th>`;return;}
    const g=window.G(gid);
    html+=`<th style="background:${clr.solid};color:#fff;padding:6px 7px;text-align:center;border:1px solid #c5cae9">🏫 ${g.name}<br><span style="font-size:.66rem;font-weight:400;opacity:.9">${g.city}</span></th>`;
  });
  html+='</tr></thead><tbody>';
  days.forEach((d,i)=>{
    const ds=d2s(d);
    const hol=getHolidayInfo(ds);
    const holStyle=hol?`background:${hol.bg};`:'';
    html+=`<tr><td class="dth" style="${ds===tday?'background:#1565c0;color:#fff;':holStyle} text-align:center;white-space:nowrap;font-weight:700">${window.dayN(ds)}<br><span style="font-size:.66rem;font-weight:400">${window.fD(ds)}</span><br><span style="font-size:.58rem;font-weight:400;opacity:.8">${toHebDate(ds)}</span>${hol?`<br><span style="font-size:.64rem;color:${hol.color}">${hol.name}</span>`:''}</td>`;

    cols.forEach((gid,ci)=>{
      if(!gid){html+=`<td style="background:#f5f5f5"></td>`;return;}
      const de=evs.filter(s=>s.g===gid&&s.d===ds).sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
      const cellBg=hol?hol.bg:'#fff';
      const pwBlk=window.getGardenBlock(gid,ds);
      // Deduplicate by supplier
      const supMap = {};
      de.forEach(ev => {
        if (!supMap[ev.a]) supMap[ev.a] = ev;
        else if (ev.st === 'ok') supMap[ev.a] = ev;
      });
      const uniqueDe = [];
      for (const k in supMap) uniqueDe.push(supMap[k]);

      html+=`<td style="background:${pwBlk?'#fce4ec':cellBg};${pwBlk?'border:1.5px solid #e91e63;':''}" onclick="openGcellPopup(${gid},'${ds}',event)">${uniqueDe.length?uniqueDe.map(ev=>`<div style="border-radius:4px;padding:2px 6px;margin-bottom:2px;cursor:pointer;font-size:.7rem;background:${clr.light};border-right:2px solid ${clr.solid};overflow:hidden;white-space:nowrap;text-overflow:ellipsis;" onclick="event.stopPropagation();openSP('${ev.id}')"><div style="font-weight:700;color:#1a237e">${ev.a}</div>${ev.t?`<div style="font-size:.65rem;color:#546e7a">⏰ ${window.fT(ev.t)}</div>`:''}</div>`).join('')+(pwBlk?`<div style="font-size:.62rem;color:#c62828">${pwBlk.icon||'🚫'} ${pwBlk.reason}</div>`:'')
        :pwBlk?`<div style="font-size:.68rem;color:#c62828;padding:4px;text-align:center">${pwBlk.icon||'🚫'} ${pwBlk.reason}</div>`
        :'<span style="color:#ccc;font-size:.8rem;cursor:pointer">+</span>'}</td>`;
    });
    html+='</tr>';
  });
  return html+'</tbody></table></div>';
}

// Quick action buttons for list/weekly views
function _quickActionBtns(s){
  const sid=s.id;
  const isDone=s.st==='done', isCan=s.st==='can', isNohap=s.st==='nohap', isPost=s.st==='post';
  const isException = isNohap || isPost || isCan;
  const isHandled = !!(s._compByMakeup && s._compByMakeup !== 'false');

  return `<div class="qacts" style="opacity:1;display:flex;gap:3px;flex-shrink:0" onclick="event.stopPropagation()">
    ${isDone?'':`<button title="בוצע" style="background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7;border-radius:4px;padding:2px 5px;font-size:.72rem;cursor:pointer;line-height:1"
      onclick="window.qSetSt('${sid}','done')">✔️</button>`}
    ${(isException && !isHandled) ? `<button title="סיום טיפול (הסרה מהלוח)" style="background:#fff9c4;color:#f57f17;border:1px solid #fff176;border-radius:4px;padding:2px 5px;font-size:.72rem;cursor:pointer;line-height:1;font-weight:800"
      onclick="if(window.markCompQuick)window.markCompQuick('${sid}')">✅ טופל</button>` : ''}
    ${isCan?'':`<button title="ביטול" style="background:#ffebee;color:#c62828;border:1px solid #ef9a9a;border-radius:4px;padding:2px 5px;font-size:.72rem;cursor:pointer;line-height:1"
      onclick="window.openCanQ('${sid}')">❌</button>`}
    ${isNohap?'':`<button title="לא התקיים" style="background:#f3e5f5;color:#6a1b9a;border:1px solid #ce93d8;border-radius:4px;padding:2px 5px;font-size:.72rem;cursor:pointer;line-height:1"
      onclick="window.qSetSt('${sid}','nohap')">⚠️</button>`}
    <button title="הזזה (דחייה / הקדמה)" style="background:#fff3e0;color:#e65100;border:1px solid #ffcc80;border-radius:4px;padding:2px 5px;font-size:.72rem;cursor:pointer;line-height:1"
      onclick="window.openPostpone('${sid}')">⏩</button>
    <button title="קביעת השלמה" class="btn-makeup" style="background:#e3f2fd;color:#1565c0;border:1px solid #90caf9;border-radius:4px;padding:2px 5px;font-size:.72rem;cursor:pointer;line-height:1"
      onclick="window.openMakeupSched('${sid}')">📅</button>
  </div>`;
}

// List view for a date range (used when range sub-view = list)

function renderCalList(evs, mDate){
  const y=mDate.getFullYear(),m=mDate.getMonth();
  const tday=td();
  const byDate={};
  evs.forEach(s=>{
    const dk=s._isPostponed?s.pd:s.d;
    if(!byDate[dk]) byDate[dk]=[];
    byDate[dk].push(s);
  });
  const dates=Object.keys(byDate).sort();
  if(!dates.length) return '<div class="card" style="text-align:center;color:#999;padding:25px">אין פעילויות בחודש זה</div>';

  let h='<div class="card" style="padding:0;overflow:hidden">';
  const isM = s => !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.nt)) || (s.n && /השלמה|הוקדם מ/i.test(s.n)));
  dates.forEach(ds=>{
    const dayEvs=byDate[ds].sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
    const isToday=ds===tday;
    const hol=getHolidayInfo(ds);
    const blk=getBlockedInfo(ds);

    // Day header
    h+=`<div style="border-bottom:2px solid #c5cae9">
      <div style="background:${isToday?'#1565c0':hol?hol.bg:blk?'#fce4ec':'#e8eaf6'};color:${isToday?'#fff':hol?hol.color:blk?'#c62828':'#283593'};padding:6px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="jumpToDay('${ds}')">
        <span style="font-weight:700;font-size:.82rem">📅 ${window.dayN(ds)} ${window.fD(ds)}</span>
        <span style="display:flex;gap:8px;align-items:center">
          ${hol?`<span style="font-size:.7rem">${hol.emoji} ${hol.name}</span>`:''}
          ${blk?`<span style="font-size:.7rem;cursor:pointer" onclick="event.stopPropagation();openBlockedDate('${ds}')">${blk.icon} ${blk.reason} ✏️</span>`:`<span style="font-size:.65rem;opacity:.4;cursor:pointer" onclick="event.stopPropagation();openBlockedDate('${ds}')" title="חסום תאריך">🚫</span>`}
          <span style="font-size:.72rem;opacity:.8">${dayEvs.length} פעילויות</span>
        </span>
      </div>`;

    h+='<div style="padding:6px 8px">';

    // Global Makeups at Top
    const f=getCalF();
    h += renderMakeupsTop(ds, f.city, f.cls, true);

    // Group by city → sort cities
    const dayEvsNonM = dayEvs.filter(s => !(s._isMakeup || s._makeupFrom || (s.nt && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.nt)) || (s.n && /השלמה|הוקדם מ/i.test(s.n))));
    const allCities=[...new Set(dayEvsNonM.map(s=>window.G(s.g).city||'אחר'))].sort((a,b)=>a.localeCompare(b,'he'));

    allCities.forEach(city=>{
      const cityEvs=dayEvsNonM.filter(s=>(window.G(s.g).city||'אחר')===city);
      if(!cityEvs.length) return;
      const clr=window.CITY_COLORS(city);

      h+=`<div style="margin-bottom:8px">`;
      // City header with dropdown toggle
      h+=`<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 10px;margin-bottom:5px;background:${clr.light};border-right:4px solid ${clr.solid};border-radius:6px;cursor:pointer" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-weight:800;color:${clr.solid};font-size:.88rem">🏙️ ${city}</span>
          <span style="font-size:.72rem;color:#78909c">${cityEvs.length} פעילויות</span>
        </div>
        <span style="font-size:.7rem;opacity:.5;color:${clr.solid}">▼</span>
      </div>
      <div style="display:block">`;

      // ── Group mode: _listGroupMode controls window.pairs vs window.clusters priority ──
      const _gmode2 = typeof _listGroupMode!=='undefined' ? _listGroupMode : 'window.pairs';
      const pairedGids=new Set();
      const clusteredGidsC=new Set();

      const _renderCluster2=(cl)=>{
        const clEvs=cityEvs.filter(s=>(cl.gardenIds||[]).map(Number).includes(Number(s.g))&&!pairedGids.has(Number(s.g))&&!clusteredGidsC.has(Number(s.g)))
          .sort((a,b)=>window.compareActivities(a, b));
        if(!clEvs.length) return;
        clEvs.forEach(s=>clusteredGidsC.add(Number(s.g)));
        const clGids2=clEvs.map(s=>s.g);
        
        // Use a standard card for the cluster but with a cluster-specific header style if needed, 
        // or just use renderStandardPairCard with a generated pair object.
        h += window.ui.renderStandardPairCard({id:'cl_'+cl.id, name:'🔢 '+cl.name, ids:cl.gardenIds}, clEvs, {
          ds: ds,
          clr: clr,
          context: 'cal'
        });
      };
      const clAll=(typeof getClusters==='function'?getClusters(ds, ds):[]).filter(cl=>
        (cl.gardenIds||[]).some(gid=>cityEvs.some(s=>s.g===parseInt(gid))));

      if(_gmode2==='window.clusters'){
        // window.clusters first
        clAll.forEach(cl=>_renderCluster2(cl));
      }

      // window.pairs (skip already-clustered if window.clusters-first mode)
      const pairGroups=[];
      const isClusterMode2 = (_gmode2 === 'clusters' || _gmode2 === 'window.clusters');
      let groupListMonth = (typeof window.getPairs === 'function' ? window.getPairs(ds, ds) : (window.pairs||[]));
      if (isClusterMode2) {
        if (typeof window.getClusters === 'function') {
          groupListMonth = window.getClusters(ds, ds).map(cl => ({...cl, ids: cl.gardenIds}));
        } else if (typeof getClusters === 'function') {
          groupListMonth = getClusters(ds, ds).map(cl => ({...cl, ids: cl.gardenIds}));
        } else if (window.clusters) {
          groupListMonth = Object.values(window.clusters).sort((a,b)=>a.name.localeCompare(b.name, 'he', { numeric: true })).map(cl => ({...cl, ids: cl.gardenIds}));
        }
      }

      groupListMonth.forEach(pair=>{
        if(!isClusterMode2 && isPairBroken&&isPairBroken(pair.id,ds)) return;
        const isM = s => !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.nt)) || (s.n && /השלמה|הוקדם מ/i.test(s.n)));
        const pairEvs=cityEvs.filter(s=>pair.ids.map(Number).includes(Number(s.g))&&!clusteredGidsC.has(Number(s.g)));
        if(!pairEvs.length) return;
        pairEvs.forEach(s=>pairedGids.add(Number(s.g)));
        pairGroups.push({pair,pairEvs});
      });
      pairGroups.sort((a,b)=>(a.pair.name||'').localeCompare(b.pair.name||'','he'));

      if(_gmode2==='window.pairs'){
        // window.clusters second (skip paired)
        clAll.forEach(cl=>_renderCluster2(cl));
      }

      // ── Render window.pairs ──
      pairGroups.sort((a,b)=>(a.pair.name||'').localeCompare(b.pair.name||'','he'));

      pairGroups.forEach(({pair,pairEvs})=>{
        h += window.ui.renderStandardPairCard(pair, pairEvs, {
          ds: ds,
          clr: clr,
          context: 'cal',
          isCluster: isClusterMode2
        });
      });

      // Solos — sorted by garden name (not in pair or cluster)
      const soloEvs=cityEvs
        .filter(s=>!pairedGids.has(s.g)&&!clusteredGidsC.has(s.g))
        .sort((a,b)=>window.compareActivities(a, b));
      
      soloEvs.forEach(s=>{
        const g = window.G(s.g);
        h += window.ui.renderStandardPairCard({id:'solo_'+s.id, name:g.name, ids:[s.g]}, [s], {
          ds: ds,
          clr: clr,
          context: 'cal',
          isSolo: true
        });
      });

      h+=`</div></div>`; // end city inner + outer
    });

    h+='</div></div>';
  });
  return h+'</div>';
}


window.mtf = function() {
  const ids = ['city', 'garden', 'age', 'date', 'day', 'type', 'act', 'grp', 'time', 'note', 'cluster'];
  let sortId = null;
  let sortDir = null;

  ids.forEach(id => {
    const el = document.getElementById('mtf-' + id);
    if (el && el.tagName === 'SELECT' && el.value.startsWith('__SORT')) {
      sortId = id;
      sortDir = el.value === '__SORT_ASC__' ? 1 : -1;
      el.value = ''; 
    }
  });

  const dateSort = document.getElementById('mtf-date-sort');
  if (dateSort && dateSort.value) {
    sortId = 'date';
    sortDir = dateSort.value === '__SORT_ASC__' ? 1 : -1;
    dateSort.value = '';
  }

  const vals = {};
  ids.forEach(id => {
    if (id === 'garden' || id === 'date') {
      const cbs = document.querySelectorAll('.mtf-' + id + '-cb:checked');
      vals[id] = Array.from(cbs).map(cb => cb.value);
    } else {
      const el = document.getElementById('mtf-' + id);
      vals[id] = el ? el.value : '';
    }
  });

  const validVals = {};
  ids.forEach(id => {
    validVals[id] = new Set();
  });

  const tbody = document.querySelector('.mt-row') ? document.querySelector('.mt-row').parentNode : null;
  if (!tbody) return;

  const rows = Array.from(document.querySelectorAll('.mt-row'));

  rows.forEach(r => {
    ids.forEach(targetId => {
      let match = true;
      ids.forEach(id => {
         if (id === targetId) return;
         const v = vals[id];
         const rowVal = r.getAttribute('data-' + id);
         if (id === 'garden' || id === 'date') {
            if (v && v.length > 0 && !v.includes(rowVal)) match = false;
         } else {
            if (v && rowVal !== v) match = false;
         }
      });
      if (match) {
         validVals[targetId].add(r.getAttribute('data-' + targetId));
      }
    });
  });

  ids.forEach(id => {
    if (id === 'garden' || id === 'date') {
       const items = document.querySelectorAll('.mtf-' + id + '-item');
       items.forEach(item => {
          if (validVals[id].has(item.getAttribute('data-val'))) {
             item.style.display = '';
          } else {
             item.style.display = 'none';
          }
       });
    } else {
       const select = document.getElementById('mtf-' + id);
       if (select) {
         Array.from(select.options).forEach(opt => {
            if (opt.value === '' || opt.value.startsWith('__SORT')) return;
            if (validVals[id].has(opt.value)) {
               opt.disabled = false;
               opt.hidden = false;
            } else {
               opt.disabled = true;
               opt.hidden = true;
            }
         });
       }
    }
  });
  
  if (sortId) {
     rows.sort((a, b) => {
        let valA = a.getAttribute('data-' + sortId) || '';
        let valB = b.getAttribute('data-' + sortId) || '';
        if (sortId === 'date') {
           const p = v => {
             const parts = v.split('/');
             return parts.length === 3 ? new Date('20' + parts[2], parts[1]-1, parts[0]).getTime() : 0;
           };
           return sortDir * (p(valA) - p(valB));
        }
        return sortDir * valA.localeCompare(valB, 'he', {numeric: true});
     });
     rows.forEach(r => tbody.appendChild(r));
  }

  rows.forEach(r => {
    let match = true;
    ids.forEach(id => {
      const v = vals[id];
      const rowVal = r.getAttribute('data-' + id);
      if (id === 'garden' || id === 'date') {
        if (v && v.length > 0 && !v.includes(rowVal)) match = false;
      } else {
        if (v && rowVal !== v) match = false;
      }
    });
    r.style.display = match ? '' : 'none';
  });
};

window.renderMonthTable = function(evs, mDate, f) {
  const y = mDate.getFullYear();
  const m = mDate.getMonth(); // 0-11
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const byDate = {};
  evs.forEach(e => {
    if (!byDate[e.d]) byDate[e.d] = [];
    byDate[e.d].push(e);
  });

  const sets = {
    city: new Set(), garden: new Set(), age: new Set(), date: new Set(), 
    day: new Set(), type: new Set(), act: new Set(), 
    grp: new Set(), time: new Set(), note: new Set(), cluster: new Set()
  };

  let rowsHtml = '';

  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = window.d2s(new Date(y, m, d));
    const dayObj = new Date(y, m, d);
    const wDay = dayObj.getDay(); // 0=Sun, 5=Fri, 6=Sat
    const hol = window.getHol && window.getHol(dStr);
    const dayEvs = byDate[dStr] || [];

    let gids = f.gids || [];
    if (!gids.length && f.clusters && f.clusters.length === 1) {
      gids = window.clusters[f.clusters[0]] ? (window.clusters[f.clusters[0]].gardenIds || []) : [];
    }
    const hasFilter = gids.length > 0;
    if (!hasFilter && dayEvs.length) {
      gids = [...new Set(dayEvs.map(e => e.g))];
    }
    if (!gids.length) continue;

    const mode = window._listGroupMode || 'pairs';
    let groupSource = [];
    if (mode === 'clusters') {
      groupSource = Object.values(window.clusters || {}).map(c => ({ id: c.id, name: c.name, ids: c.gardenIds || [] }));
    } else {
      groupSource = window.pairs || [];
    }

    const getGroupId = (gid) => {
      const gStr = String(gid);
      const grpIndex = groupSource.findIndex(g => g.ids && g.ids.map(String).includes(gStr));
      return grpIndex === -1 ? 999999 : grpIndex;
    };

    const getMinTime = (gid) => {
       const gEvents = dayEvs.filter(e => String(e.g) === String(gid));
       if (!gEvents.length) return '99:99';
       let minTime = '99:99';
       gEvents.forEach(e => {
         if (e.t && e.t < minTime) minTime = e.t;
       });
       return minTime;
    };

    const getGroupCity = (grpIndex) => {
       if (grpIndex === 999999) return 'תתתת';
       const grp = groupSource[grpIndex];
       if (!grp || !grp.ids || !grp.ids.length) return '';
       const firstGarden = window.G(grp.ids[0]);
       return firstGarden ? (firstGarden.city || '') : '';
    };

    gids.sort((a, b) => {
       const gA = getGroupId(a);
       const gB = getGroupId(b);
       if (gA !== gB) {
           const cA = getGroupCity(gA);
           const cB = getGroupCity(gB);
           if (cA !== cB) return cA.localeCompare(cB, 'he');
           return gA - gB;
       }
       const tA = getMinTime(a);
       const tB = getMinTime(b);
       if (tA !== tB) return tA.localeCompare(tB);
       return 0;
    });

    gids.forEach(gid => {
      const garden = window.G(gid);
      if (!garden) return;
      const gEvents = dayEvs.filter(e => e.g == gid);
      
      const isWeekend = (wDay === 5 || wDay === 6);
      const rowHolName = hol ? (hol.name || hol.nm) : '';
      const clsRaw = garden.cls || 'גנים';
      const age = window.extractGardenAge(garden);
      const city = garden.city || '';
      
      const gName = garden.name||'';
      const fDate = `${parseInt(dStr.slice(8,10))}/${parseInt(dStr.slice(5,7))}/${dStr.slice(2,4)}`;
      const fDay = window.dayN(dStr);

      let clusterName = '';
      if (window.clusters) {
        const foundCl = Object.values(window.clusters).find(c => c.gardenIds && c.gardenIds.map(String).includes(String(gid)));
        if (foundCl) clusterName = foundCl.name;
      }

      const gardenCellHtml = `<td style="border:1px solid #000; padding:4px; font-weight:bold; text-align:right; cursor:pointer; color:#1565c0; text-decoration:underline;" onclick="window.openGcellPopup(${gid},'${dStr}',event)" title="לחץ לפתיחת פרטי פעילות / חסימה">${gName}</td>`;

      if (gEvents.length === 0) {
        let bg = 'inherit';
        if (wDay === 6 || (wDay === 5 && !rowHolName)) bg = '#ff0000';
        else if (rowHolName) bg = '#ffff00';
        else if (clsRaw.includes('צהרון')) bg = '#b4c6e7';
        else bg = '#d9e1f2';

        sets.city.add(city);
        sets.garden.add(gName);
        sets.age.add(age);
        sets.date.add(fDate);
        sets.day.add(fDay);
        if (rowHolName) sets.type.add(rowHolName);
        sets.cluster.add(clusterName);

        rowsHtml += `<tr class="mt-row" style="background-color:${bg}; border-bottom:1px solid #000;" 
          data-city="${city}" data-garden="${gName}" data-age="${age}" data-date="${fDate}" data-day="${fDay}" data-type="${rowHolName}" data-act="" data-phone="" data-grp="" data-time="" data-note="" data-cluster="${clusterName}">
          <td style="border:1px solid #000; padding:4px; font-weight:bold; text-align:right;">${city}</td>
          ${gardenCellHtml}
          <td style="border:1px solid #000; padding:4px; text-align:center;">${age}</td>
          <td style="border:1px solid #000; padding:4px; font-weight:bold; text-align:center;">${fDate}</td>
          <td style="border:1px solid #000; padding:4px; font-weight:bold; text-align:center;">${fDay}</td>
          <td style="border:1px solid #000; padding:4px; font-weight:bold; text-align:center;">${rowHolName}</td>
          <td style="border:1px solid #000; padding:4px;"></td>
          <td style="border:1px solid #000; padding:4px;"></td>
          <td style="border:1px solid #000; padding:4px;"></td>
          <td style="border:1px solid #000; padding:4px;"></td>
          <td style="border:1px solid #000; padding:4px;"></td>
          <td style="border:1px solid #000; padding:4px; text-align:center; font-weight:bold;">${clusterName}</td>
        </tr>`;
      } else {
        gEvents.forEach(ev => {
          let actType = ev.tp || 'חוג';
          if (actType === 'חוג') {
            if (clsRaw.includes('צהרון')) actType = 'חוג צהרון';
            else actType = 'חוג בוקר';
          }
          if (actType === 'חוג' && rowHolName) actType = rowHolName;
          
          const fActType = rowHolName ? rowHolName : actType;

          let bg = 'inherit';
          if (wDay === 6 || (wDay === 5 && !rowHolName)) bg = '#ff0000';
          else if (rowHolName) bg = '#ffff00';
          else if (actType.includes('בוקר')) bg = '#d9e1f2';
          else if (actType.includes('צהרון') || clsRaw.includes('צהרון')) bg = '#b4c6e7';
          else bg = '#ffffff';

          const fullActName = ev.act ? (ev.a + ' - ' + ev.act) : (ev.a || '');
          let phone = typeof window.getSupPhone === 'function' ? window.getSupPhone(ev.a, ev) : (ev.p || '');
          const supName = window.supBase ? window.supBase(ev.a) : (ev.a || '');
          if (!phone && window.supEx && window.supEx[supName] && window.supEx[supName].ph1) {
            phone = window.supEx[supName].ph1;
          }
          if (!phone && window.SUPBASE) {
            const sObj = window.SUPBASE.find(s => (window.supBase ? window.supBase(s.name) : s.name) === supName);
            if (sObj && sObj.phone) phone = sObj.phone;
          }
          const grp = String(ev.grp||1);
          const tTime = ev.t ? ev.t.slice(0,5) : '';
          const note = ev.n || '';

          sets.city.add(city);
          sets.garden.add(gName);
          sets.age.add(age);
          sets.date.add(fDate);
          sets.day.add(fDay);
          sets.type.add(fActType);
          sets.act.add(fullActName);
          sets.act.add(fullActName);
          sets.grp.add(grp);
          sets.time.add(tTime);
          sets.note.add(note);
          sets.cluster.add(clusterName);
          
          rowsHtml += `<tr class="mt-row" style="background-color:${bg}; border-bottom:1px solid #000;"
            data-city="${city}" data-garden="${gName}" data-age="${age}" data-date="${fDate}" data-day="${fDay}" data-type="${fActType}" data-act="${fullActName}" data-grp="${grp}" data-time="${tTime}" data-note="${note}" data-cluster="${clusterName}">
            <td style="border:1px solid #000; padding:4px; font-weight:bold; text-align:right;">${city}</td>
            ${gardenCellHtml}
            <td style="border:1px solid #000; padding:4px; text-align:center; white-space:nowrap;">${age}</td>
            <td style="border:1px solid #000; padding:4px; font-weight:bold; text-align:center; white-space:nowrap;">${fDate}</td>
            <td style="border:1px solid #000; padding:4px; font-weight:bold; text-align:center; white-space:nowrap;">${fDay}</td>
            <td style="border:1px solid #000; padding:4px; font-weight:bold; text-align:center;">${fActType}</td>
            <td style="border:1px solid #000; padding:4px; font-weight:bold; text-align:right;">${fullActName}</td>
            <td style="border:1px solid #000; padding:4px; text-align:center; font-weight:bold; white-space:nowrap;">${grp}</td>
            <td style="border:1px solid #000; padding:4px; font-weight:bold; text-align:center; white-space:nowrap;">${tTime}</td>
            <td style="border:1px solid #000; padding:4px; text-align:right; max-width:200px; word-wrap:break-word;">${note}</td>
            <td style="border:1px solid #000; padding:4px; text-align:center; font-weight:bold; white-space:nowrap;">${clusterName}</td>
          </tr>`;
        });
      }
    });
  }

  const parseD = (v) => {
    const parts = v.split('/');
    if (parts.length === 3) return new Date('20' + parts[2], parts[1]-1, parts[0]).getTime();
    return 0;
  };

  const getOpts = (set, isDate, colId) => {
    let arr = [...set].filter(Boolean);
    if (isDate) {
      arr.sort((a,b) => parseD(a) - parseD(b));
    } else {
      arr.sort((a,b)=>a.localeCompare(b, 'he', {numeric:true}));
    }
    let sortOptions = '';
    if (colId) {
      if (isDate || colId === 'time') {
         sortOptions = '<option value="__SORT_ASC__">⬇️ מוקדם למאוחר</option><option value="__SORT_DESC__">⬆️ מאוחר למוקדם</option>';
      } else {
         sortOptions = '<option value="__SORT_ASC__">⬇️ מיין א-ת</option><option value="__SORT_DESC__">⬆️ מיין ת-א</option>';
      }
    }
    return '<option value="">הכל</option>' + sortOptions + arr.map(v=>`<option value="${v}">${v}</option>`).join('');
  };

  const getGardenMultiOpts = (set) => {
    let arr = [...set].filter(Boolean);
    arr.sort((a,b)=>a.localeCompare(b, 'he', {numeric:true}));
    const checks = arr.map(v => `<div class="mtf-garden-item" data-val="${v}" style="padding:2px 4px; border-bottom:1px solid #eee;"><label style="display:flex; align-items:center; cursor:pointer;"><input type="checkbox" class="mtf-garden-cb" value="${v}" onchange="window.mtf()" style="margin:0 0 0 5px;">${v}</label></div>`).join('');
    
    if (!window.mtfGardenClick) {
      window.mtfGardenClick = function(e) {
        const wrap = document.getElementById('mtf-garden-wrap');
        const list = document.getElementById('mtf-garden-list');
        if (wrap && list && list.style.display !== 'none' && !wrap.contains(e.target)) {
          list.style.display = 'none';
        }
      };
      document.addEventListener('click', window.mtfGardenClick);
    }

    return `
      <div id="mtf-garden-wrap" style="position:relative;">
        <div onclick="const d = document.getElementById('mtf-garden-list'); d.style.display = d.style.display === 'none' ? 'block' : 'none';" style="background:#fff; border:1px solid #767676; border-radius:2px; font-weight:normal; font-size:0.75rem; padding:1px 2px; cursor:pointer; text-align:right;">
          בחר... ▼
        </div>
        <div id="mtf-garden-list" style="display:none; position:absolute; top:100%; right:0; background:#fff; border:1px solid #ccc; max-height:350px; overflow-y:auto; z-index:9999; min-width:140px; box-shadow:0 2px 5px rgba(0,0,0,0.2); font-weight:normal; font-size:0.85rem; text-align:right;">
           ${checks}
        </div>
      </div>
    `;
  };

  const getDateMultiOpts = (set) => {
    let arr = [...set].filter(Boolean);
    arr.sort((a,b) => parseD(a) - parseD(b));
    const checks = arr.map(v => `<div class="mtf-date-item" data-val="${v}" style="padding:2px 4px; border-bottom:1px solid #eee;"><label style="display:flex; align-items:center; cursor:pointer;"><input type="checkbox" class="mtf-date-cb" value="${v}" onchange="window.mtf()" style="margin:0 0 0 5px;">${v}</label></div>`).join('');
    
    if (!window.mtfDateClick) {
      window.mtfDateClick = function(e) {
        const wrap = document.getElementById('mtf-date-wrap');
        const list = document.getElementById('mtf-date-list');
        if (wrap && list && list.style.display !== 'none' && !wrap.contains(e.target)) {
          list.style.display = 'none';
        }
      };
      document.addEventListener('click', window.mtfDateClick);
    }

    const sortOptions = `
      <div style="padding:4px; border-bottom:1px solid #ccc; display:flex; gap:5px; flex-direction:column; background:#f9f9f9;">
        <button class="btn bo bsm" style="width:100%; justify-content:center;" onclick="document.getElementById('mtf-date-sort').value='__SORT_ASC__'; window.mtf(); document.getElementById('mtf-date-list').style.display='none';">⬇️ מוקדם למאוחר</button>
        <button class="btn bo bsm" style="width:100%; justify-content:center;" onclick="document.getElementById('mtf-date-sort').value='__SORT_DESC__'; window.mtf(); document.getElementById('mtf-date-list').style.display='none';">⬆️ מאוחר למוקדם</button>
      </div>
    `;

    return `
      <div id="mtf-date-wrap" style="position:relative;">
        <input type="hidden" id="mtf-date-sort" value="">
        <div onclick="const d = document.getElementById('mtf-date-list'); d.style.display = d.style.display === 'none' ? 'block' : 'none';" style="background:#fff; border:1px solid #767676; border-radius:2px; font-weight:normal; font-size:0.75rem; padding:1px 2px; cursor:pointer; text-align:right;">
          בחר... ▼
        </div>
        <div id="mtf-date-list" style="display:none; position:absolute; top:100%; right:0; background:#fff; border:1px solid #ccc; max-height:350px; overflow-y:auto; z-index:9999; min-width:140px; box-shadow:0 2px 5px rgba(0,0,0,0.2); font-weight:normal; font-size:0.85rem; text-align:right;">
           ${sortOptions}
           ${checks}
        </div>
      </div>
    `;
  };

  let html = `<div style="overflow-x:auto; padding:0 10px 20px 10px;">
    <table style="width:100%; border-collapse:collapse; min-width:800px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,0.1); font-size:0.85rem;" dir="rtl">
      <thead>
        <tr style="background-color:#e0e0e0; border:2px solid #000;">
          <th style="position:sticky; top:0; z-index:10; background-color:#e0e0e0; border:1px solid #000; padding:6px; font-weight:bold;">עיר<br><select id="mtf-city" onchange="window.mtf()" style="width:100%; min-width:0; padding:1px; box-sizing:border-box; font-size:0.75rem;">${getOpts(sets.city, false, 'city')}</select></th>
          <th style="position:sticky; top:0; z-index:10; background-color:#e0e0e0; border:1px solid #000; padding:6px; font-weight:bold; min-width:120px; overflow:visible;">שם הצהרון<br>${getGardenMultiOpts(sets.garden)}</th>
          <th style="position:sticky; top:0; z-index:10; background-color:#e0e0e0; border:1px solid #000; padding:6px; font-weight:bold; width:60px; min-width:60px; max-width:60px;">גיל<br><select id="mtf-age" onchange="window.mtf()" style="width:100%; min-width:0; padding:1px; box-sizing:border-box; font-size:0.75rem; text-overflow:ellipsis;">${getOpts(sets.age, false, 'age')}</select></th>
          <th style="position:sticky; top:0; z-index:10; background-color:#e0e0e0; border:1px solid #000; padding:6px; font-weight:bold; width:75px; min-width:75px; max-width:75px; overflow:visible;">תאריך<br>${getDateMultiOpts(sets.date)}</th>
          <th style="position:sticky; top:0; z-index:10; background-color:#e0e0e0; border:1px solid #000; padding:6px; font-weight:bold; width:60px; min-width:60px; max-width:60px;">יום<br><select id="mtf-day" onchange="window.mtf()" style="width:100%; min-width:0; padding:1px; box-sizing:border-box; font-size:0.75rem; text-overflow:ellipsis;">${getOpts(sets.day, false, 'day')}</select></th>
          <th style="position:sticky; top:0; z-index:10; background-color:#e0e0e0; border:1px solid #000; padding:6px; font-weight:bold; width:80px;">חוג/הפעלה<br><select id="mtf-type" onchange="window.mtf()" style="width:100%; min-width:0; padding:1px; box-sizing:border-box; font-size:0.75rem;">${getOpts(sets.type, false, 'type')}</select></th>
          <th style="position:sticky; top:0; z-index:10; background-color:#e0e0e0; border:1px solid #000; padding:6px; font-weight:bold; min-width:180px;">שם החוג<br><select id="mtf-act" onchange="window.mtf()" style="width:100%; min-width:0; padding:1px; box-sizing:border-box; font-size:0.75rem;">${getOpts(sets.act, false, 'act')}</select></th>
          <th style="position:sticky; top:0; z-index:10; background-color:#e0e0e0; border:1px solid #000; padding:6px; font-weight:bold; width:50px;">קב'<br><select id="mtf-grp" onchange="window.mtf()" style="width:100%; min-width:0; padding:1px; box-sizing:border-box; font-size:0.75rem;">${getOpts(sets.grp, false, 'grp')}</select></th>
          <th style="position:sticky; top:0; z-index:10; background-color:#e0e0e0; border:1px solid #000; padding:6px; font-weight:bold; width:50px;">שעה<br><select id="mtf-time" onchange="window.mtf()" style="width:100%; min-width:0; padding:1px; box-sizing:border-box; font-size:0.75rem;">${getOpts(sets.time, false, 'time')}</select></th>
          <th style="position:sticky; top:0; z-index:10; background-color:#e0e0e0; border:1px solid #000; padding:6px; font-weight:bold;">הערות<br><select id="mtf-note" onchange="window.mtf()" style="width:100%; min-width:0; padding:1px; box-sizing:border-box; font-size:0.75rem;">${getOpts(sets.note, false, 'note')}</select></th>
          <th style="position:sticky; top:0; z-index:10; background-color:#e0e0e0; border:1px solid #000; padding:6px; font-weight:bold; min-width:120px; width:1%; white-space:nowrap;">אשכול<br><select id="mtf-cluster" onchange="window.mtf()" style="width:100%; min-width:0; padding:1px; box-sizing:border-box; font-size:0.75rem;">${getOpts(sets.cluster, false, 'cluster')}</select></th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>`;
  
  setTimeout(() => {
    const nd = new Date();
    const realToday = `${nd.getDate()}/${nd.getMonth()+1}/${String(nd.getFullYear()).slice(2)}`;
    if (!window._listFilterObj || Object.keys(window._listFilterObj).length === 0) {
       const dateCb = document.querySelector(`.mtf-date-cb[value="${realToday}"]`);
       if (dateCb && !dateCb.checked) {
          dateCb.checked = true;
          window.mtf();
       }
    }
  }, 50);

  return html;
};

function renderMonth(evs,mDate,f){
  const y=mDate.getFullYear(),m=mDate.getMonth(),tday=window.td();
  const fd=new Date(y,m,1),ld=new Date(y,m+1,0);
  
  // Group events by date for monthly cell lookup
  const evsByDate = {};
  evs.forEach(s => {
    const dk = s._isPostponed ? s.pd : s.d;
    if(!evsByDate[dk]) evsByDate[dk] = [];
    evsByDate[dk].push(s);
  });

  const isFocused = f && (f.gids || f.city || f.sup);

  let html='<div class="card" style="padding:0; overflow:hidden; border-radius:12px;"><div class="mgrid">';
  ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'].forEach(d=>html+=`<div class="mdh">${d}</div>`);
  for(let i=0;i<fd.getDay();i++) html+='<div class="md om"></div>';
  for(let d=1;d<=ld.getDate();d++){
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const hol=window.getHolidayInfo ? window.getHolidayInfo(ds) : null;
    const blkM=window.getBlockedInfo ? window.getBlockedInfo(ds) : null;
    const holStyle=hol?`background:${hol.bg};border-top:3px solid ${hol.border};`:(blkM?'background:#fce4ec;border-top:3px solid #e91e63;':'');

    let cellContent = '';
    const dayEvs = evsByDate[ds];
    if(dayEvs && dayEvs.length > 0){
      // Show details if filtered (isFocused) OR if there are only few activities (<=10 when focused, <=3 otherwise)
      const detailLimit = isFocused ? 12 : 4;
      if(dayEvs.length <= detailLimit){
        // Detailed view
        cellContent = '<div style="margin-top:2px; display:flex; flex-direction:column; gap:1.5px;">';
        dayEvs.sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99')).forEach(s => {
          const sup = s.n || window.supBase(s.a);
          const act = s.act || (window.supAct ? window.supAct(s.a) : '') || '';
          
          let stColor = '#1565c0';
          let stBg = s._isImported ? '#f1f5f9' : 'rgba(0,0,0,0.03)';
          let isCan = false;
          let isMakeup = !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה/i.test(s.nt)));

          if (s.st === 'can') {
             stColor = '#c62828'; stBg = '#ffebee'; isCan = true;
          } else if (s.st === 'nohap') {
             stColor = '#6a1b9a'; stBg = '#f3e5f5';
          } else if (s.st === 'post') {
             stColor = '#e65100'; stBg = '#fff3e0';
          } else if (s.st === 'done') {
             stColor = '#2e7d32'; stBg = '#e8f5e9';
          } else if (isMakeup) {
             stColor = '#b71c1c'; stBg = '#fff9c4';
          }

          cellContent += `<div style="font-size:0.62rem; line-height:1.2; color:${stColor}; border-right:3px solid ${stColor}; padding:3px 5px; margin-bottom:3px; background:${stBg}; border-radius:4px; ${isCan?'text-decoration:line-through;opacity:0.7':''}">
            <b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sup}</b>
            <span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.58rem;opacity:0.85">${act}</span>
          </div>`;
        });
        cellContent += '</div>';
      } else {
        // Simple count view for busy days
        cellContent = `<div class="mcnt" style="background:#e8eaf6; color:#1a237e; font-weight:800; border-radius:4px; padding:2px 4px; font-size:0.65rem; text-align:center; margin-top:4px;">${dayEvs.length} פעילויות</div>`;
      }
    }

    html+=`<div class="md ${ds===tday?'tdy':''} ${dayEvs?'hev':''}" style="${holStyle}" onclick="window.jumpToDay('${ds}')">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div class="dnum" style="${blkM?'color:#c62828':''}">${d}</div>
          <div style="font-size:.6rem;color:#9e9e9e;line-height:1;margin-top:1px">${window.toHebDate ? window.toHebDate(ds) : ''}</div>
        </div>
        <span style="font-size:.65rem;opacity:${blkM?1:.25};cursor:pointer;color:${blkM?'#c62828':'#999'}" onclick="event.stopPropagation();window.openBlockedDate('${ds}')" title="${blkM?'ערוך חסימה':'חסום תאריך'}">${blkM?blkM.icon||'🚫':'🚫'}</span>
      </div>
      ${hol?`<div style="font-size:.68rem;color:${hol.color};font-weight:800;margin-top:2px">${hol.emoji} ${hol.name}</div>`:''}
      ${blkM?`<div style="font-size:.62rem;color:#c62828;font-weight:700;margin-top:1px">${blkM.reason}${blkM.note?' — '+blkM.note:''}</div>`:''}
      ${cellContent}
    </div>`;
  }
  const e=ld.getDay();for(let i=e+1;i<7;i++) html+='<div class="md om"></div>';
  return html+'</div></div>';
}

function setListGroupMode(m){
  window._listGroupMode = m;
  document.querySelectorAll('[id^="vlb-group-"]').forEach(btn => {
    const btnV = btn.id.replace('vlb-group-', '').replace('-desktop', '').replace('-mobile', '').replace('-dash', '');
    if (['pairs', 'clusters', 'table'].includes(btnV)) {
      btn.classList.toggle('active', btnV === m);
    }
  });
  if (typeof renderCal === 'function') renderCal();
  if (typeof window.renderDash === 'function') window.renderDash();
}

function renderRangeListView(evs, fromDs, toDs){
  const tday = window.td();
  const byDate = {};
  evs.forEach(s => {
    const dk = s._isPostponed ? s.pd : s.d;
    if(!byDate[dk]) byDate[dk] = [];
    byDate[dk].push(s);
  });
  const dates = Object.keys(byDate).sort();
  if(fromDs === toDs && !dates.includes(fromDs)) {
    dates.push(fromDs);
    byDate[fromDs] = [];
  }
  if(!dates.length) return '<div class="card" style="text-align:center;color:#999;padding:25px">אין פעילויות בטווח זה</div>';

  let h = '<div class="card" style="padding:0;overflow:hidden">';
  const isM = s => !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.nt)) || (s.n && /השלמה|הוקדם מ/i.test(s.n)));
  const f = getCalF();
  
  dates.forEach(ds => {
    const dayEvs = byDate[ds].sort((a,b) => (a.t||'99:99').localeCompare(b.t||'99:99'));
    const isToday = ds === tday;
    const hol = window.getHolidayInfo ? window.getHolidayInfo(ds) : null;
    const blk = window.getBlockedInfo ? window.getBlockedInfo(ds) : null;

    h += `<div style="border-bottom:2px solid #c5cae9">
      <div style="background:${isToday?'#1565c0':hol?hol.bg:blk?'#fce4ec':'#e8eaf6'};color:${isToday?'#fff':hol?hol.color:blk?'#c62828':'#283593'};padding:6px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="window.jumpToDay('${ds}')">
        <span style="font-weight:700;font-size:.82rem">📅 ${window.dayN(ds)} ${window.fD(ds)}</span>
        <span style="display:flex;gap:8px;align-items:center">
          ${hol ? `<span style="font-size:.7rem">${hol.emoji} ${hol.name}</span>` : ''}
          ${blk ? `<span style="font-size:.7rem;cursor:pointer" onclick="event.stopPropagation();window.openBlockedDate('${ds}')">${blk.icon} ${blk.reason} ✏️</span>` : `<span style="font-size:.65rem;opacity:.4;cursor:pointer" onclick="event.stopPropagation();window.openBlockedDate('${ds}')" title="חסום תאריך">🚫</span>`}
          <span style="font-size: .72rem; opacity: .8">${dayEvs.length} פעילויות</span>
        </span>
      </div>`;

    h += '<div style="padding:6px 8px">';
    h += renderMakeupsTop(ds, f.city, f.cls, true);

    const dayEvsNonM = dayEvs.filter(s => !(s._isMakeup || s._makeupFrom || (s.nt && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.nt)) || (s.n && /השלמה|הוקדם מ/i.test(s.n))));
    const _gmode = _listGroupMode === 'clusters' ? 'window.clusters' : 'window.pairs';
    const isSingleDay = (fromDs === toDs);
    
    let allCitiesSet = new Set(dayEvsNonM.map(s => window.G(s.g).city || 'אחר'));
    const allCities = [...allCitiesSet].sort((a,b) => a.localeCompare(b, 'he'));

    allCities.forEach(city => {
      const cityEvs = dayEvsNonM.filter(s => (window.G(s.g).city || 'אחר') === city);
      const clr = window.CITY_COLORS(city);

      h += `<details class="city-accordion">
        <summary>
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <span style="font-weight:800; color:#2d3748;">🏙️ ${city} (${cityEvs.length} פעילויות)</span>
          </div>
        </summary>
        <div class="city-accordion-content">`;
      const firstUsedGids = new Set();
      
      const _renderCl = (cl) => {
        const clCity = cl.gardenIds && cl.gardenIds.length ? (window.G(cl.gardenIds[0])?.city || 'אחר') : 'אחר';
        if (clCity !== city) return;

        const clEvs = cityEvs.filter(s => {
          if (!(cl.gardenIds || []).map(Number).includes(Number(s.g))) return false;
          if (firstUsedGids.has(Number(s.g))) return false;
          if (typeof window.gardenClusters === 'function') {
             const myCls = window.gardenClusters(s.g, ds);
             if (myCls && myCls.length > 0) return myCls[0].id === cl.id;
          }
          return true;
        }).sort((a,b) => window.compareActivities(a, b));
        
        if (!clEvs.length) return;
        
        clEvs.forEach(s => firstUsedGids.add(Number(s.g)));
        const clGids = cl.gardenIds || [];

        const clPair = { id: cl.id, name: cl.name, ids: clGids };
        const gardenActivities = new Map();
        clEvs.forEach(s => {
          if(!gardenActivities.has(s.g)) gardenActivities.set(s.g, []);
          gardenActivities.get(s.g).push(s);
        });
        
        const finalEvs = [];
        clPair.ids.forEach(gid => {
          if(gardenActivities.has(gid)) {
            finalEvs.push(...gardenActivities.get(gid));
          } else {
            finalEvs.push({ id: 'dummy_'+gid, g: gid, st: 'unassigned', d: ds, t: '', act: '' });
          }
        });
        const sorted = finalEvs.sort((a,b) => window.compareActivities(a, b));
        h += `<div style="margin-bottom:12px;">` + window.ui.renderStandardPairCard(clPair, sorted, { ds, clr, context: 'cal', isCluster: true }) + `</div>`;
      };

      if(_gmode === 'window.clusters'){
        (typeof getClusters === 'function' ? getClusters(ds, ds) : []).forEach(cl => _renderCl(cl));
      } else {
        const pairGroups = [];
        window.pairs.forEach(pair => {
          const pCity = pair.ids && pair.ids.length ? (window.G(pair.ids[0])?.city || 'אחר') : 'אחר';
          if (pCity !== city) return;
          
          if(isPairBroken && isPairBroken(pair.id, ds)) return;
          const pairEvs = cityEvs.filter(s => pair.ids.map(Number).includes(Number(s.g)) && !firstUsedGids.has(Number(s.g)));
          
          if (!pairEvs.length) return;
          
          pairEvs.forEach(s => firstUsedGids.add(Number(s.g)));
          pairGroups.push({pair, pairEvs});
        });
        pairGroups.sort((a,b) => (a.pair.name||'').localeCompare(b.pair.name||'', 'he'));
        pairGroups.forEach(({pair, pairEvs}) => {
          const gardenActivities = new Map();
          pairEvs.forEach(s => {
            if(!gardenActivities.has(s.g)) gardenActivities.set(s.g, []);
            gardenActivities.get(s.g).push(s);
          });
          
          const finalEvs = [];
          pair.ids.forEach(gid => {
            if(gardenActivities.has(gid)) {
              finalEvs.push(...gardenActivities.get(gid));
            } else {
              finalEvs.push({ id: 'dummy_'+gid, g: gid, st: 'unassigned', d: ds, t: '', act: '' });
            }
          });
          const sorted = finalEvs.sort((a,b) => window.compareActivities(a, b));
          h += window.ui.renderStandardPairCard(pair, sorted, { ds, clr, context: 'cal' });
        });
      }

      cityEvs.filter(s => !firstUsedGids.has(Number(s.g)))
        .sort((a,b) => window.compareActivities(a, b))
        .forEach(s => { 
          h += window.ui.renderStandardPairCard({id:'solo_'+s.id, name:window.G(s.g).name, ids:[s.g]}, [s], {
            ds, clr, context: 'cal', isSolo: true
          });
        });

      h += `</div></details>`;
    });
    h += '</div></div>';
  });
  return h + '</div>';
}

// [Global Bridge moved to index.html final script tag]
function jumpToPairWeeklySchedule(pairId, ds, soloGid){
  const pair = pairId ? (window.pairs.find(p=>p.id==pairId) || window.pairs.find(p=>p.name==pairId)) : null;
  const gids = pair ? pair.ids : (soloGid ? [soloGid] : []);
  if(!gids.length) return;

  // 1. Switch to Schedule tab
  if(window.switchMode) window.switchMode('act');
  if(window.ST) window.ST('sched');

  // 2. Set dates to the week of ds
  const sf = document.getElementById('s-from');
  if(sf) {
    sf.value = ds;
    if(window.setSchedView) window.setSchedView('week');
  }

  // 3. Clear existing garden filters and set new ones
  ['s-g1','s-g2','s-g3'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  gids.forEach((gid, i) => {
    const el = document.getElementById('s-g'+(i+1));
    if(el) el.value = gid;
  });

  // 4. Trigger render
  if(window.renderSched) window.renderSched();
  
  window.showToast('📅 עובר ללוח שבועי של ' + (pair ? pair.name : window.G(soloGid).name));
}

// Attach to window for accessibility
window.jumpToPairWeeklySchedule = jumpToPairWeeklySchedule;

function jumpToPairMonthlySchedule(pairId, ds, soloGid){
  const pair = pairId ? (window.pairs.find(p=>p.id==pairId) || window.pairs.find(p=>p.name==pairId)) : null;
  const gids = pair ? pair.ids : (soloGid ? [soloGid] : []);
  if(!gids.length) return;

  // 1. Switch to Calendar tab
  if(window.ST) window.ST('cal');

  // 2. Set filters
  const f1 = window.getEl('cal-g1');
  const f2 = window.getEl('cal-g2');
  const f3 = window.getEl('cal-g3');
  if(f1) f1.value = gids[0] || '';
  if(f2) f2.value = gids[1] || '';
  if(f3) f3.value = gids[2] || '';

  // 3. Set date and view
  if(window.goDate) window.goDate(ds);
  if(window.setView) window.setView('month');
  
  window.showToast('🗓️ עובר ללוח חודשי של ' + (pair ? pair.name : window.G(soloGid).name));
}
window.jumpToPairMonthlySchedule = jumpToPairMonthlySchedule;
window.toggleTableCluster = function(pIdStr) {
  const isHidden = document.querySelector(`.pair-row-${pIdStr}`)?.style.display === 'none';
  document.querySelectorAll(`.pair-row-${pIdStr}`).forEach(el => {
    el.style.display = isHidden ? 'table-row' : 'none';
  });
  const icon = document.getElementById(`icon-${pIdStr}`);
  if (icon) icon.textContent = isHidden ? '➖' : '➕';
};

function toggleTableCity(cityId) {
  const isCityHidden = document.querySelector(`.city-row-${cityId}`)?.style.display === 'none';
  if (isCityHidden) {
    document.querySelectorAll(`.city-row-${cityId}:not(.pair-hdr-${cityId}):not(.pair-child-${cityId})`).forEach(r => r.style.display = 'table-row');
    document.querySelectorAll(`.pair-hdr-${cityId}`).forEach(r => r.style.display = 'table-row');
    document.querySelectorAll(`.pair-hdr-${cityId}`).forEach(h => {
       const onclickAttr = h.getAttribute('onclick') || '';
       const match = onclickAttr.match(/'(pair-[^']+)'/);
       if (match) {
         const pIdStr = match[1];
         const icon = document.getElementById(`icon-${pIdStr}`);
         if (icon && icon.textContent === '➖') {
            document.querySelectorAll(`.pair-row-${pIdStr}`).forEach(r => r.style.display = 'table-row');
         }
       }
    });
  } else {
    document.querySelectorAll(`.city-row-${cityId}`).forEach(r => r.style.display = 'none');
  }
}
window.toggleTableCity = toggleTableCity;

window.setListSubView = setListSubView;
window.setRangeSubView = setRangeSubView;
window.setView = setView;
window.navCal = navCal;
window.goToday = goToday;
window.calRefG = calRefG;
window.goDate = goDate;
window.jumpToDay = jumpToDay;
window.clearCal = clearCal;
window.renderCal = renderCal;

// Expose internal render functions for coordinator_app.js
window.calRenderMakeupsTop  = renderMakeupsTop;
window.calRenderRangeView   = renderRangeView;
window.calRenderNormalWeek  = renderNormalWeek;
window.calRenderMonth       = renderMonth;
window.calRenderNormalDay   = renderNormalDay;
window.calFilterEvs         = (f, fromDs, toDs) => {
  // Minimal re-implementation of filterE for coordinator use
  return (window.SCH||[]).filter(s=>{
    if(!s.d||!s.g) return false;
    if(s.d < fromDs || s.d > toDs) return false;
    if(f && f.gids && f.gids.length && !f.gids.map(Number).includes(Number(s.g))) return false;
    return true;
  });
};
