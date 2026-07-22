import os

with open('worker_tasks.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update wtOpenNewTaskDialog HTML to include hidden city input
content = content.replace(
    '<input type="hidden" id="wt-garden-id" value="">',
    '<input type="hidden" id="wt-garden-id" value="">\n      <input type="hidden" id="wt-city-name" value="">'
)

# 2. Update task creation push
push_old = """      window.WORKER_TASKS.push({
        id: 'wt_' + Date.now(),
        date: date,
        gardenId: gardenId ? parseInt(gardenId) : 0,
        desc: desc,
        status: 'pending',
        doneAt: null,
        isAdminOnly: isAdminOnly
      });"""
      
push_new = """      const cityName = document.getElementById('wt-city-name') ? document.getElementById('wt-city-name').value : '';
      window.WORKER_TASKS.push({
        id: 'wt_' + Date.now(),
        date: date,
        gardenId: gardenId ? parseInt(gardenId) : 0,
        city: cityName || '',
        desc: desc,
        status: 'pending',
        doneAt: null,
        isAdminOnly: isAdminOnly
      });"""
content = content.replace(push_old, push_new)

# 3. Update wtSearchGarden
search_old = """  if (results.length === 0) {
    resEl.innerHTML = '<div style="color:#999; font-size:0.8rem; text-align:center;">לא נמצאו גנים</div>';
  } else {
    resEl.innerHTML = results.map(g => `
      <div onclick="document.getElementById('wt-garden-id').value='${g.id}'; document.getElementById('wt-garden-search').value='${g.city||''} - ${g.name}'; document.getElementById('wt-garden-results').style.display='none';" 
           style="padding:6px; border-bottom:1px solid #eee; cursor:pointer; font-size:0.85rem;">
        <b>${g.id}</b> | ${g.city||''} - ${g.name}
      </div>
    `).join('');
  }"""
  
search_new = """  let html = '';
  const matchingCities = [...new Set(gardens.filter(g => g.city && g.city.includes(q)).map(g => g.city))];
  
  matchingCities.slice(0, 3).forEach(c => {
    html += `
      <div onclick="document.getElementById('wt-garden-id').value=''; if(document.getElementById('wt-city-name')) document.getElementById('wt-city-name').value='${c}'; document.getElementById('wt-garden-search').value='${c}'; document.getElementById('wt-garden-results').style.display='none';" 
           style="padding:6px; border-bottom:1px solid #eee; cursor:pointer; font-size:0.85rem; background:#e3f2fd; color:#1565c0; font-weight:bold;">
        🏙️ משימה לעיר: ${c}
      </div>
    `;
  });

  if (results.length === 0 && matchingCities.length === 0) {
    html = '<div style="color:#999; font-size:0.8rem; text-align:center;">לא נמצאו תוצאות</div>';
  } else {
    html += results.map(g => `
      <div onclick="document.getElementById('wt-garden-id').value='${g.id}'; if(document.getElementById('wt-city-name')) document.getElementById('wt-city-name').value=''; document.getElementById('wt-garden-search').value='${g.city||''} - ${g.name}'; document.getElementById('wt-garden-results').style.display='none';" 
           style="padding:6px; border-bottom:1px solid #eee; cursor:pointer; font-size:0.85rem;">
        <b>${g.id}</b> | ${g.city||''} - ${g.name}
      </div>
    `).join('');
  }
  resEl.innerHTML = html;"""
content = content.replace(search_old, search_new)

# 4. Update fallback prompt
prompt_old = """    const gardenId = prompt("מזהה הגן (מספר, או השאר ריק למשימה כללית):");
    const desc = prompt("תיאור המשימה:");
    if (!desc) return;
    
    window.WORKER_TASKS.push({
      id: 'wt_' + Date.now(),
      date: date,
      gardenId: gardenId ? parseInt(gardenId) : 0,
      desc: desc,
      status: 'pending',
      doneAt: null,
      isAdminOnly: false
    });"""

prompt_new = """    const gardenId = prompt("מזהה הגן (מספר, או השאר ריק למשימה כללית):");
    let cityName = '';
    if (!gardenId) {
      cityName = prompt("האם המשימה שייכת לעיר ספציפית? (הזן שם עיר או השאר ריק):") || '';
    }
    const desc = prompt("תיאור המשימה:");
    if (!desc) return;
    
    window.WORKER_TASKS.push({
      id: 'wt_' + Date.now(),
      date: date,
      gardenId: gardenId ? parseInt(gardenId) : 0,
      city: cityName,
      desc: desc,
      status: 'pending',
      doneAt: null,
      isAdminOnly: false
    });"""
content = content.replace(prompt_old, prompt_new)


# 5. Update renderWorkerTasksAdmin logic (pending and completed)
render_old1 = """        const gardenName = t.gardenId ? (window.G ? (window.G(t.gardenId)?.name || '') : '') : '';
        const city = window.G ? (window.G(t.gardenId)?.city || '') : '';
        const loc = city ? `${city} - ${gardenName}` : gardenName;"""
        
render_new1 = """        const gardenName = t.gardenId ? (window.G ? (window.G(t.gardenId)?.name || '') : '') : '';
        const city = t.gardenId ? (window.G ? (window.G(t.gardenId)?.city || '') : '') : (t.city || '');
        const loc = t.gardenId ? (city ? `${city} - ${gardenName}` : gardenName) : (city ? city : 'משימה כללית');"""

# It appears twice (pending and completed)
content = content.replace(render_old1, render_new1)

# 6. Update wtPrintTasks and wtExportWord HTML generation
print_old = """    const gardenName = t.gardenId ? (window.G ? (window.G(t.gardenId)?.name || '') : '') : '';"""
print_new = """    const gardenName = t.gardenId ? (window.G ? (window.G(t.gardenId)?.name || '') : '') : (t.city ? t.city : 'משימה כללית');"""
content = content.replace(print_old, print_new)

with open('worker_tasks.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
