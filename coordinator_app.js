/**
 * Coordinator App Module (coordinator_app.js)
 * Provides a read-only, mobile-first view of activities for field coordinators.
 * Coordinators can only see gardens/cities they have been assigned.
 * Security: DOM is cleared on activation (identical pattern to worker_tasks.js).
 */

// ── Initialization ──────────────────────────────────────
window.initCoordinatorApp = function() {
  // Inject the coordinator-app-root container if it doesn't exist
  if (!document.getElementById('coordinator-app-root')) {
    const coordApp = document.createElement('div');
    coordApp.id = 'coordinator-app-root';
    coordApp.style.display = 'none';
    coordApp.style.position = 'fixed';
    coordApp.style.inset = '0';
    coordApp.style.background = 'linear-gradient(180deg, #1a5276, #154360)';
    coordApp.style.zIndex = '100000';
    coordApp.style.overflowY = 'auto';
    coordApp.style.fontFamily = "'Segoe UI', Tahoma, sans-serif";
    coordApp.style.direction = 'rtl';
    coordApp.innerHTML = `
      <div id="coord-header" style="padding:16px 20px 0;display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:1.4rem">📋</span>
          <span id="coord-user-name" style="color:#fff;font-weight:700;font-size:1rem"></span>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button onclick="window.coordRefreshData()" style="background:rgba(255,255,255,0.15);border:none;border-radius:8px;color:white;padding:6px 12px;font-size:0.8rem;cursor:pointer">🔄 רענן</button>
          <button onclick="window.coordLogout()" style="background:transparent;color:#fff;border:none;font-size:1.3rem;cursor:pointer;opacity:0.8" title="התנתק">🚪</button>
        </div>
      </div>
      <!-- Month Navigation -->
      <div id="coord-month-nav" style="display:flex;justify-content:center;align-items:center;gap:16px;padding:12px 20px;color:#fff">
        <button onclick="window.coordNavMonth(-1)" style="background:rgba(255,255,255,0.15);border:none;border-radius:50%;width:36px;height:36px;color:#fff;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center">▶</button>
        <div id="coord-month-label" style="font-weight:800;font-size:1.15rem;min-width:180px;text-align:center"></div>
        <button onclick="window.coordNavMonth(1)" style="background:rgba(255,255,255,0.15);border:none;border-radius:50%;width:36px;height:36px;color:#fff;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center">◀</button>
      </div>
      <!-- Time View Toggle -->
      <div id="coord-time-view-toggle" style="display:flex;justify-content:center;gap:6px;padding:0 20px 8px">
        <button class="coord-time-btn" data-view="day" onclick="window.coordSetTimeView('day',this)" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:6px 14px;color:rgba(255,255,255,0.7);cursor:pointer;font-size:0.8rem;font-weight:600;flex:1">יומי</button>
        <button class="coord-time-btn" data-view="week" onclick="window.coordSetTimeView('week',this)" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:6px 14px;color:rgba(255,255,255,0.7);cursor:pointer;font-size:0.8rem;font-weight:600;flex:1">שבועי</button>
        <button class="coord-time-btn active" data-view="month" onclick="window.coordSetTimeView('month',this)" style="background:rgba(255,255,255,0.25);border:1px solid rgba(255,255,255,0.4);border-radius:8px;padding:6px 14px;color:#fff;cursor:pointer;font-size:0.8rem;font-weight:600;flex:1">חודשי</button>
      </div>
      <!-- Group Mode Toggle Removed -->
      <!-- City Filter (if multiple cities) -->
      <div id="coord-city-filter" style="display:none;padding:0 20px 8px">
        <select id="coord-city-select" onchange="window.renderCoordinatorView()" style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.12);color:#fff;font-size:0.85rem;font-weight:600">
          <option value="">כל הערים שלי</option>
        </select>
      </div>
      <!-- Activities List -->
      <div id="coord-activities-list" style="padding:8px 16px 80px">
        <!-- Rendered dynamically -->
      </div>
    `;
    document.body.appendChild(coordApp);
  }
};

// ── Coordinator state ──────────────────────────────────
window._coordCurrentDate = null; // will be set on activation (defaults to today)
window._coordTimeView = 'day'; // default to day view
window._coordGroupMode = 'pairs';

// ── Secure Activation ──────────────────────────────────
window.activateCoordinatorApp = function() {
  // SECURE DOM CLEARING: identical pattern to activateWorkerApp()
  Array.from(document.body.children).forEach(el => {
    const tag = el.tagName.toUpperCase();
    if (tag !== 'SCRIPT' && tag !== 'STYLE' && tag !== 'LINK' && el.id !== 'coordinator-app-root') {
      el.remove();
    }
  });

  // Create minimal stylesheet
  if (!document.getElementById('coord-styles')) {
    const style = document.createElement('style');
    style.id = 'coord-styles';
    style.innerHTML = `
      body { margin: 0; padding: 0; background: #154360; font-family: 'Segoe UI', Tahoma, sans-serif; }
      .coord-city-section { margin-bottom: 16px; }
      .coord-city-header {
        background: rgba(255,255,255,0.12); border-radius: 10px; padding: 10px 14px;
        color: #fff; font-weight: 800; font-size: 0.95rem; margin-bottom: 8px;
        display: flex; justify-content: space-between; align-items: center; cursor: pointer;
      }
      .coord-city-header:active { background: rgba(255,255,255,0.18); }
      .coord-group-card {
        background: #fff; border-radius: 12px; margin-bottom: 10px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15); overflow: hidden;
      }
      .coord-group-header {
        background: linear-gradient(135deg, #2980b9, #3498db); color: #fff;
        padding: 10px 14px; font-weight: 700; font-size: 0.88rem;
        display: flex; justify-content: space-between; align-items: center;
      }
      .coord-day-header {
        background: #f0f4f8; padding: 6px 14px; font-weight: 700; font-size: 0.78rem;
        color: #34495e; border-bottom: 1px solid #e0e6ed; display: flex; align-items: center; gap: 6px;
      }
      .coord-activity-row {
        display: flex; align-items: center; gap: 10px; padding: 8px 14px;
        border-bottom: 1px solid #f0f0f0; font-size: 0.82rem;
      }
      .coord-activity-row:last-child { border-bottom: none; }
      .coord-act-time { font-weight: 700; color: #2c3e50; min-width: 45px; font-size: 0.82rem; }
      .coord-act-name { flex: 1; color: #34495e; }
      .coord-act-status { font-size: 0.85rem; min-width: 22px; text-align: center; }
      .coord-act-supplier { font-size: 0.72rem; color: #7f8c8d; }
      .coord-empty {
        text-align: center; padding: 40px 20px; background: rgba(255,255,255,0.08);
        border-radius: 16px; margin: 20px 0;
      }
      .coord-empty-icon { font-size: 3rem; margin-bottom: 10px; }
      .coord-empty-text { font-size: 1.1rem; color: rgba(255,255,255,0.8); font-weight: 600; }
      .coord-stats-bar {
        display: flex; gap: 8px; padding: 0 20px 10px; flex-wrap: wrap; justify-content: center;
      }
      .coord-stat {
        background: rgba(255,255,255,0.12); border-radius: 10px; padding: 8px 14px;
        text-align: center; min-width: 70px;
      }
      .coord-stat-num { font-size: 1.3rem; font-weight: 800; color: #fff; }
      .coord-stat-label { font-size: 0.68rem; color: rgba(255,255,255,0.65); }
      .coord-grp-btn.active {
        background: rgba(255,255,255,0.25) !important;
        border-color: rgba(255,255,255,0.4) !important;
        color: #fff !important;
      }
      .coord-time-btn.active {
        background: rgba(255,255,255,0.25) !important;
        border-color: rgba(255,255,255,0.4) !important;
        color: #fff !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Init current date to today (ignoring hours/mins)
  const now = new Date();
  window._coordCurrentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Show Coordinator UI
  const coordApp = document.getElementById('coordinator-app-root');
  if (coordApp) {
    coordApp.style.display = 'block';
    // Set user name
    const nameEl = document.getElementById('coord-user-name');
    if (nameEl) {
      const uname = window._fbUser?.displayName || window._fbUser?.email?.replace('@ganmanager.app', '') || 'רכז';
      nameEl.textContent = uname;
    }
    // Wait for data to load, then render
    setTimeout(() => {
      window.renderCoordinatorView();
    }, 500);
  }
};

// ── Time View Mode ──────────────────────────────────────
window.coordSetTimeView = function(view, btn) {
  window._coordTimeView = view;
  document.querySelectorAll('.coord-time-btn').forEach(b => {
    b.classList.remove('active');
    b.style.background = 'rgba(255,255,255,0.08)';
    b.style.borderColor = 'rgba(255,255,255,0.2)';
    b.style.color = 'rgba(255,255,255,0.7)';
  });
  if (btn) {
    btn.classList.add('active');
    btn.style.background = 'rgba(255,255,255,0.25)';
    btn.style.borderColor = 'rgba(255,255,255,0.4)';
    btn.style.color = '#fff';
  }
  window.renderCoordinatorView();
};

// ── Navigation ─────────────────────────────────────────
window.coordNavMonth = function(dir) {
  if (!window._coordCurrentDate) return;
  const view = window._coordTimeView || 'day';
  
  let newDate = new Date(window._coordCurrentDate.getTime());
  
  if (view === 'day') {
    newDate.setDate(newDate.getDate() + dir);
  } else if (view === 'week') {
    newDate.setDate(newDate.getDate() + (dir * 7));
  } else if (view === 'month') {
    newDate.setMonth(newDate.getMonth() + dir);
  }
  
  // Apply permission restrictions
  const scope = window.coordTimeScope || 'month';
  const now = new Date();
  
  if (scope === 'day') {
    if(typeof showToast === 'function') showToast('הרשאתך מוגבלת ליום הנוכחי בלבד');
    return;
  }

  const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const curMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  if (scope === 'month') {
    if (newDate < curMonthStart || newDate > curMonthEnd) {
      if(typeof showToast === 'function') showToast('אין לך הרשאה לצפות במועדים אחרים');
      return;
    }
  } else if (scope === 'year') {
    if (window.SCH && window.SCH.length > 0) {
      const allowed = window.getCoordAllowedGardenIds();
      const mySch = window.SCH.filter(s => allowed.has(Number(s.g)) && s.d).map(s => s.d).sort();
      if (mySch.length > 0) {
        const firstDate = new Date(mySch[0]);
        const lastDate = new Date(mySch[mySch.length - 1]);
        if (newDate < new Date(firstDate.getFullYear(), firstDate.getMonth(), 1) || newDate > new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 0)) {
          if(typeof showToast === 'function') showToast('אין פעילויות מעבר לשנת הפעילות הנוכחית');
          return;
        }
      }
    }
  }

  window._coordCurrentDate = newDate;
  window.renderCoordinatorView();
};

// ── Group Mode (Removed) ──────────────────────────────────────────
// window.coordSetGroupMode is obsolete, we show both naturally.
window.coordSetGroupMode = function(mode, btn) {};

// ── Data Filtering ──────────────────────────────────────
window.getCoordAllowedGardenIds = function() {
  const allowed = new Set();
  const gardens = [...(window.GARDENS || []), ...(window._GARDENS_EXTRA || [])];

  const clsScope = window.coordClsScope || 'all';

  // 1. Add all gardens from allowed cities, filtering by clsScope
  (window.coordCities || []).forEach(city => {
    const cityClean = (city || '').trim();
    gardens.filter(g => (g.city || '').trim() === cityClean).forEach(g => {
      const cls = (g.cls || '').trim();
      if (clsScope === 'all') {
        allowed.add(Number(g.id));
      } else if (clsScope === 'גן' && (cls === 'גן' || cls === 'גנים' || !cls.includes('ספר'))) {
        allowed.add(Number(g.id));
      } else if ((clsScope === 'ביהס' || clsScope === 'ביה"ס') && (cls.includes('ספר') || cls.includes('ביה'))) {
        allowed.add(Number(g.id));
      }
    });
  });

  // 2. Add specific garden IDs (assume these override the clsScope as they were specifically picked)
  (window.coordGardenIds || []).forEach(id => allowed.add(Number(id)));

  return allowed;
};

window.getCoordFilteredSCH = function() {
  const allowed = window.getCoordAllowedGardenIds();
  if (!allowed.size) return [];

  const baseDate = window._coordCurrentDate;
  if (!baseDate) return [];

  const view = window._coordTimeView || 'day';
  
  let startStr, endStr;
  
  if (view === 'day') {
    startStr = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`;
    endStr = startStr;
  } else if (view === 'week') {
    // Week starts on Sunday
    const startOfWeek = new Date(baseDate);
    startOfWeek.setDate(baseDate.getDate() - baseDate.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    startStr = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
    endStr = `${endOfWeek.getFullYear()}-${String(endOfWeek.getMonth() + 1).padStart(2, '0')}-${String(endOfWeek.getDate()).padStart(2, '0')}`;
  } else if (view === 'month') {
    startStr = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-01`;
    const nextMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
    const lastDay = new Date(nextMonth.getTime() - 86400000);
    endStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
  }

  const scope = window.coordTimeScope || 'month';
  let allowedTodayStr = null;
  if (scope === 'day') {
    const d = new Date();
    allowedTodayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return (window.SCH || []).filter(s => {
    if (!allowed.has(Number(s.g))) return false;
    if (!s.d) return false;
    // Filter by the selected view range
    if (s.d < startStr || s.d > endStr) return false;
    // If strict daily permission is enforced from backend
    if (scope === 'day' && s.d !== allowedTodayStr) return false;
    return true;
  });
};

// ── Get groups naturally ────────────────────────
window._getCoordGroups = function() {
  const allowed = window.getCoordAllowedGardenIds();

  const clusters = (typeof window.getClusters === 'function' ? window.getClusters() : [])
    .map(cl => ({ id: cl.id || cl.name, name: cl.name, ids: (cl.gardenIds || []).map(Number), type: 'cluster' }))
    .filter(g => g.ids.some(id => allowed.has(id)));

  const clusterIds = new Set();
  clusters.forEach(c => c.ids.forEach(id => clusterIds.add(id)));

  const pairs = (window.pairs || [])
    .map(p => ({ ...p, ids: p.ids.map(Number), type: 'pair' }))
    .filter(p => p.ids.some(id => allowed.has(id) && !clusterIds.has(id)));

  return [...clusters, ...pairs];
};

// ── Day names helper ──────────────────────────────────
const _COORD_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const _COORD_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

function _coordStatusIcon(st) {
  switch (st) {
    case 'ok': return '✅';
    case 'cancelled': case 'can': return '❌';
    case 'postponed': case 'post': return '↗️';
    case 'nohap': return '🚫';
    case 'makeup': return '🔄';
    default: return '⏳';
  }
}

function _coordStatusColor(st) {
  switch (st) {
    case 'ok': return '#27ae60';
    case 'cancelled': case 'can': return '#e74c3c';
    case 'postponed': case 'post': return '#f39c12';
    case 'nohap': return '#95a5a6';
    default: return '#3498db';
  }
}

// ── Main Render ─────────────────────────────────────────
window.renderCoordinatorView = function() {
  const container = document.getElementById('coord-activities-list');
  if (!container) return;

  // Auto-jump logic: runs once when data is loaded
  if (!window._coordMonthInitJumpDone && window.SCH && window.SCH.length > 0) {
    const allSch = window.SCH.filter(s => s.d).map(s => s.d).sort();
    if (allSch.length > 0) {
      const now = new Date();
      const firstDate = new Date(allSch[0]);
      const lastDate = new Date(allSch[allSch.length - 1]);
      const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      
      if (todayStr < allSch[0]) {
        window._coordCurrentDate = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate());
      } else if (todayStr > allSch[allSch.length - 1]) {
        window._coordCurrentDate = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
      } else {
        // We are within range, stick to today's date
        window._coordCurrentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }
      window._coordMonthInitJumpDone = true;
    }
  }

  const m = { year: window._coordCurrentDate.getFullYear(), month: window._coordCurrentDate.getMonth() };

  // Update month label
  const monthLabel = document.getElementById('coord-month-label');
  if (monthLabel) {
    const view = window._coordTimeView || 'day';
    const cd = window._coordCurrentDate;
    if (view === 'day') {
      monthLabel.textContent = `${String(cd.getDate()).padStart(2,'0')}/${String(cd.getMonth()+1).padStart(2,'0')}/${cd.getFullYear()}`;
    } else if (view === 'week') {
      const startOfWeek = new Date(cd);
      startOfWeek.setDate(cd.getDate() - cd.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      monthLabel.textContent = `${startOfWeek.getDate()}/${startOfWeek.getMonth()+1} - ${endOfWeek.getDate()}/${endOfWeek.getMonth()+1}`;
    } else {
      monthLabel.textContent = `${_COORD_MONTHS[m.month]} ${m.year}`;
    }
  }

  // Get filtered data
  const filtered = window.getCoordFilteredSCH();
  const allowed = window.getCoordAllowedGardenIds();
  const allGardens = [...(window.GARDENS || []), ...(window._GARDENS_EXTRA || [])];
  const myGardens = allGardens.filter(g => allowed.has(Number(g.id)));

  // Populate city filter
  const cityFilterWrap = document.getElementById('coord-city-filter');
  const citySelect = document.getElementById('coord-city-select');
  const myCities = [...new Set(myGardens.map(g => g.city || 'אחר'))].sort();
  if (myCities.length > 1 && cityFilterWrap && citySelect) {
    cityFilterWrap.style.display = 'block';
    const currentVal = citySelect.value;
    citySelect.innerHTML = '<option value="">כל הערים שלי</option>';
    myCities.forEach(c => {
      citySelect.innerHTML += `<option value="${c}" ${c === currentVal ? 'selected' : ''}>${c}</option>`;
    });
  } else if (cityFilterWrap) {
    cityFilterWrap.style.display = 'none';
  }

  const selectedCity = citySelect ? citySelect.value : '';

  // Build stats
  const totalActivities = filtered.length;
  const makeupCount = filtered.filter(s => s.st === 'makeup').length;
  const postCount = filtered.filter(s => s.st === 'postponed' || s.st === 'post').length;
  const gardenCount = window.getCoordAllowedGardenIds().size;

  // Get groups
  const groups = window._getCoordGroups();

  // Track which gardens are in groups
  const groupedGardenIds = new Set();
  groups.forEach(g => g.ids.forEach(id => groupedGardenIds.add(Number(id))));

  // Find ungrouped gardens (gardens that aren't in any pair/cluster)
  const ungroupedGardens = myGardens.filter(g => !groupedGardenIds.has(Number(g.id)));

  // Organize by Date -> Group
  const byDate = {};

  filtered.forEach(ev => {
    let targetGroup = null;
    let targetCity = 'אחר';
    
    // Check if in grouped gardens
    const gId = Number(ev.g);
    const grp = groups.find(g => g.ids.includes(gId));
    if (grp) {
      targetGroup = grp;
      const firstGarden = allGardens.find(g => grp.ids.includes(Number(g.id)));
      if (firstGarden && firstGarden.city) targetCity = firstGarden.city;
    } else {
      const gObj = myGardens.find(g => Number(g.id) === gId);
      if (gObj) {
        targetGroup = { id: `solo_${gObj.id}`, name: gObj.name, ids: [Number(gObj.id)] };
        if (gObj.city) targetCity = gObj.city;
      }
    }
    
    if (!targetGroup) return; // shouldn't happen if filtered properly
    if (selectedCity && targetCity !== selectedCity) return;
    
    const dateKey = ev.d || 'ללא תאריך';
    if (!byDate[dateKey]) byDate[dateKey] = {};
    if (!byDate[dateKey][targetGroup.id]) byDate[dateKey][targetGroup.id] = { group: targetGroup, city: targetCity, events: [] };
    byDate[dateKey][targetGroup.id].events.push(ev);
  });

  // Render
  let html = '';

  // Stats bar
  html += `<div class="coord-stats-bar">
    <div class="coord-stat"><div class="coord-stat-num">${gardenCount}</div><div class="coord-stat-label">צהרונים</div></div>
    <div class="coord-stat"><div class="coord-stat-num">${totalActivities}</div><div class="coord-stat-label">חוגים</div></div>
    <div class="coord-stat"><div class="coord-stat-num" style="color:#2ecc71">${makeupCount}</div><div class="coord-stat-label">השלמות</div></div>
    <div class="coord-stat"><div class="coord-stat-num" style="color:#f39c12">${postCount}</div><div class="coord-stat-label">שינויים</div></div>
  </div>`;

  const sortedDates = Object.keys(byDate).sort();

  if (sortedDates.length === 0) {
    html += `<div class="coord-empty">
      <div class="coord-empty-icon">📋</div>
      <div class="coord-empty-text">אין חוגים להצגה בחודש זה</div>
      <div style="color:rgba(255,255,255,0.5);font-size:0.85rem;margin-top:6px">נסה לנווט לחודש אחר או ליצור קשר עם המנהל</div>
    </div>`;
    container.innerHTML = html;
    return;
  }

  // Render by Date -> Group
  sortedDates.forEach(ds => {
    let dayLabel = ds;
    if (ds !== 'ללא תאריך') {
      const d = new Date(ds);
      const dayIdx = d.getDay();
      const dayName = _COORD_DAYS[dayIdx] || ds;
      const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
      dayLabel = `${dayName} ${dateStr}`;
    }

    html += `<div class="coord-date-section" style="margin-bottom:20px;">
      <div class="coord-day-header" style="background:rgba(255,255,255,0.15);color:#fff;font-size:1.05rem;padding:10px 14px;border-radius:10px;margin-bottom:10px;display:flex;justify-content:space-between;border:1px solid rgba(255,255,255,0.2);">
        <span>📅 ${dayLabel}</span>
      </div>`;

    const dateGroupsObj = byDate[ds];
    // Sort groups by city, then by name
    const sortedGroupKeys = Object.keys(dateGroupsObj).sort((a,b) => {
      const gA = dateGroupsObj[a];
      const gB = dateGroupsObj[b];
      if (gA.city !== gB.city) return gA.city.localeCompare(gB.city);
      return gA.group.name.localeCompare(gB.group.name);
    });

    sortedGroupKeys.forEach(gk => {
      const { group, city, events } = dateGroupsObj[gk];
      const gardenNames = group.ids
        .map(id => allGardens.find(g => Number(g.id) === id))
        .filter(Boolean)
        .map(g => g.name)
        .join(' + ');

      // To render "Supplier -> Gardens" like the admin UI, we take the primary supplier of the group
      // (assuming all events in a pair share the same supplier, which is GanScheduler standard)
      const firstEv = events[0] || {};
      const supName = typeof window.supNameLabel === 'function' ? window.supNameLabel(firstEv.a) : (typeof window.supBase === 'function' ? window.supBase(firstEv.a) : (firstEv.p || firstEv.a || 'ספק לא ידוע'));
      const phone = typeof window.getSupPhone === 'function' ? window.getSupPhone(firstEv.a) : '';
      const activityName = firstEv.act || (typeof window.supAct === 'function' ? window.supAct(firstEv.a) : '') || 'פעילות';

      html += `<div class="coord-group-card" style="margin-bottom:12px; border-right:4px solid #3498db; background:#fff; border-radius:6px; box-shadow:0 2px 4px rgba(0,0,0,0.05); overflow:hidden;">
        <div class="coord-group-header" style="background:linear-gradient(to right, #f8fafc, #eff6ff);color:#1e293b;border-bottom:2px solid #e2e8f0;padding:10px 14px;display:flex;flex-direction:column;gap:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
             <span style="font-weight:800;font-size:1rem;color:#0f172a;">🧑‍🏫 ${supName} ${firstEv.n ? `(${firstEv.n})` : ''} - ${activityName}</span>
             <span style="font-size:0.75rem;background:#3b82f6;color:#fff;padding:2px 8px;border-radius:10px;">${events.length} פ'</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:#475569;">
             <span>📍 ${city} | 🏡 ${group.type === 'cluster' ? 'אשכול: ' + group.name : 'זוג: ' + group.name}</span>
             ${phone ? `<a href="tel:${phone}" style="color:#2563eb;text-decoration:none;font-weight:600;">📞 ${phone}</a>` : ''}
          </div>
        </div>
        <div class="coord-group-events" style="padding:0;">`;

      events.sort((a,b) => (a.t||'').localeCompare(b.t||'')).forEach(ev => {
        const statusIcon = _coordStatusIcon(ev.st);
        const statusColor = _coordStatusColor(ev.st);
        const gardenObj = allGardens.find(g => Number(g.id) === Number(ev.g));
        const gardenName = gardenObj ? gardenObj.name : 'גן לא ידוע';
        
        // Is it a standalone event or pair?
        const isStandalone = group.ids.length === 1;

        html += `<div class="coord-activity-row" style="display:flex; align-items:center; padding:10px 14px; border-bottom:1px solid #f1f5f9; gap:12px;">
          <div class="coord-act-time" style="font-weight:700; font-size:0.9rem; color:#334155; min-width:45px;">${ev.t || '--:--'}</div>
          <div class="coord-act-name" style="flex:1;">
            <div style="font-weight:700; color:#0f172a; font-size:0.95rem;">🏡 ${gardenName}</div>
            ${isStandalone && ev.act && ev.act !== activityName ? `<span style="font-size:0.75rem;color:#64748b;display:block;">${ev.act}</span>` : ''}
            ${(ev.n && (ev.st === 'makeup' || ev.st === 'postponed' || ev.st === 'post')) ? `<div style="font-size:0.75rem;color:#e67e22;margin-top:2px;font-weight:600">📝 ${ev.n}</div>` : ''}
          </div>
          <div class="coord-act-status" style="color:${statusColor}; font-size:1.1rem; background:rgba(255,255,255,0.5); width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:1px solid ${statusColor}40;">${statusIcon}</div>
        </div>`;
      });
      html += `</div></div>`; // close group events & group card
    });
    html += `</div>`; // close date section
  });

  container.innerHTML = html;
};

// ── Refresh data ────────────────────────────────────────
window.coordRefreshData = function() {
  if (window.loadFromFirebase) {
    window.loadFromFirebase(false, true).then(() => {
      window.renderCoordinatorView();
      // Simple toast
      const t = document.createElement('div');
      t.textContent = '✅ נתונים עודכנו';
      t.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#27ae60;color:#fff;padding:8px 20px;border-radius:20px;font-size:0.85rem;font-weight:600;z-index:999999;box-shadow:0 4px 12px rgba(0,0,0,0.3)';
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 2500);
    });
  } else {
    location.reload();
  }
};

// ── Logout ──────────────────────────────────────────────
window.coordLogout = function() {
  if (window._safeLS) window._safeLS.removeItem('ganv5_auth_user');
  location.reload();
};

// ── Admin-side: Coordinator tab in admin panel ──────────
// Hook into ST for admin view of coordinator management
window.initCoordinatorApp();
