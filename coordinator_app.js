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
      <!-- Group Mode Toggle -->
      <div id="coord-group-toggle" style="display:flex;justify-content:center;gap:6px;padding:0 20px 12px">
        <button class="coord-grp-btn active" data-mode="pairs" onclick="window.coordSetGroupMode('pairs',this)" style="background:rgba(255,255,255,0.25);border:1px solid rgba(255,255,255,0.4);border-radius:20px;padding:5px 16px;color:#fff;cursor:pointer;font-size:0.8rem;font-weight:600">👫 זוגות</button>
        <button class="coord-grp-btn" data-mode="triplets" onclick="window.coordSetGroupMode('triplets',this)" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:5px 16px;color:rgba(255,255,255,0.7);cursor:pointer;font-size:0.8rem;font-weight:600">👥 שלישיות</button>
        <button class="coord-grp-btn" data-mode="clusters" onclick="window.coordSetGroupMode('clusters',this)" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:5px 16px;color:rgba(255,255,255,0.7);cursor:pointer;font-size:0.8rem;font-weight:600">🏘️ אשכולות</button>
      </div>
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
window._coordMonth = null; // will be set on activation
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
    `;
    document.head.appendChild(style);
  }

  // Init month to current
  const now = new Date();
  window._coordMonth = { year: now.getFullYear(), month: now.getMonth() };

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

// ── Month Navigation ──────────────────────────────────
window.coordNavMonth = function(dir) {
  if (!window._coordMonth) return;
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();

  let newMonth = window._coordMonth.month + dir;
  let newYear = window._coordMonth.year;
  if (newMonth < 0) { newMonth = 11; newYear--; }
  if (newMonth > 11) { newMonth = 0; newYear++; }

  const scope = window.coordTimeScope || 'month';
  if (scope === 'day' || scope === 'month') {
    if (newYear !== curYear || newMonth !== curMonth) {
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
        const targetAbs = newYear * 12 + newMonth;
        const minAbs = firstDate.getFullYear() * 12 + firstDate.getMonth();
        const maxAbs = lastDate.getFullYear() * 12 + lastDate.getMonth();
        if (targetAbs < minAbs || targetAbs > maxAbs) {
          if(typeof showToast === 'function') showToast('אין פעילויות מעבר לשנת הפעילות הנוכחית');
          return;
        }
      }
    }
  }

  window._coordMonth = { year: newYear, month: newMonth };
  window.renderCoordinatorView();
};

// ── Group Mode ──────────────────────────────────────────
window.coordSetGroupMode = function(mode, btn) {
  window._coordGroupMode = mode;
  document.querySelectorAll('.coord-grp-btn').forEach(b => {
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

// ── Data Filtering ──────────────────────────────────────
window.getCoordAllowedGardenIds = function() {
  const allowed = new Set();
  const gardens = [...(window.GARDENS || []), ...(window._GARDENS_EXTRA || [])];

  // 1. Add all gardens from allowed cities
  (window.coordCities || []).forEach(city => {
    gardens.filter(g => g.city === city).forEach(g => allowed.add(Number(g.id)));
  });

  // 2. Add specific garden IDs
  (window.coordGardenIds || []).forEach(id => allowed.add(Number(id)));

  return allowed;
};

window.getCoordFilteredSCH = function() {
  const allowed = window.getCoordAllowedGardenIds();
  if (!allowed.size) return [];

  const m = window._coordMonth;
  if (!m) return [];

  // Build date range for the selected month
  const monthStart = `${m.year}-${String(m.month + 1).padStart(2, '0')}-01`;
  const nextMonth = new Date(m.year, m.month + 1, 1);
  const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

  const scope = window.coordTimeScope || 'month';
  let todayStr = null;
  if (scope === 'day') {
    const d = new Date();
    todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return (window.SCH || []).filter(s => {
    if (!allowed.has(Number(s.g))) return false;
    // Date filtering for selected month
    if (s.d && (s.d < monthStart || s.d >= monthEnd)) return false;
    if (scope === 'day' && s.d !== todayStr) return false;
    return true;
  });
};

// ── Get groups for current mode ────────────────────────
window._getCoordGroups = function() {
  const mode = window._coordGroupMode || 'pairs';
  const allowed = window.getCoordAllowedGardenIds();

  if (mode === 'clusters' && typeof window.getClusters === 'function') {
    return window.getClusters()
      .map(cl => ({ id: cl.id || cl.name, name: cl.name, ids: (cl.gardenIds || []).map(Number) }))
      .filter(g => g.ids.some(id => allowed.has(id)));
  }

  // pairs or triplets - filter pairs that have at least one allowed garden
  const pairs = (window.pairs || []);
  if (mode === 'triplets') {
    return pairs.filter(p => p.ids.length >= 3 && p.ids.some(id => allowed.has(Number(id))))
      .map(p => ({ ...p, ids: p.ids.map(Number) }));
  }

  return pairs.filter(p => p.ids.some(id => allowed.has(Number(id))))
    .map(p => ({ ...p, ids: p.ids.map(Number) }));
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
        window._coordMonth = { year: firstDate.getFullYear(), month: firstDate.getMonth() };
      } else if (todayStr > allSch[allSch.length - 1]) {
        window._coordMonth = { year: lastDate.getFullYear(), month: lastDate.getMonth() };
      }
      window._coordMonthInitJumpDone = true;
    }
  }

  const m = window._coordMonth;
  if (!m) return;

  // Update month label
  const monthLabel = document.getElementById('coord-month-label');
  if (monthLabel) {
    const scope = window.coordTimeScope || 'month';
    if (scope === 'day') {
      const d = new Date();
      monthLabel.textContent = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
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
  const okCount = filtered.filter(s => s.st === 'ok').length;
  const cancelledCount = filtered.filter(s => s.st === 'can' || s.st === 'cancelled').length;
  const gardenCount = new Set(filtered.map(s => s.g)).size;

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
    <div class="coord-stat"><div class="coord-stat-num" style="color:#2ecc71">${okCount}</div><div class="coord-stat-label">תקינים</div></div>
    <div class="coord-stat"><div class="coord-stat-num" style="color:#e74c3c">${cancelledCount}</div><div class="coord-stat-label">בוטלו</div></div>
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

      html += `<div class="coord-group-card" style="margin-bottom:12px; border-right:4px solid #3498db;">
        <div class="coord-group-header" style="background:#f0f4f8;color:#2c3e50;border-bottom:1px solid #e0e6ed;">
          <span>📍 ${city} | 🏡 ${gardenNames || group.name}</span>
          <span style="font-size:0.75rem;background:#3498db;color:#fff;padding:2px 8px;border-radius:10px;">${events.length} חוגים</span>
        </div>
        <div class="coord-group-events">`;

      events.sort((a,b) => (a.t||'').localeCompare(b.t||'')).forEach(ev => {
        const statusIcon = _coordStatusIcon(ev.st);
        const statusColor = _coordStatusColor(ev.st);
        const gardenObj = allGardens.find(g => Number(g.id) === Number(ev.g));
        const gardenName = gardenObj ? gardenObj.name : '';
        const showGardenTag = group.ids.length > 1;

        const activityName = ev.act || (typeof window.supAct === 'function' ? window.supAct(ev.a) : '') || 'פעילות';
        const supName = typeof window.supNameLabel === 'function' ? window.supNameLabel(ev.a) : (typeof window.supBase === 'function' ? window.supBase(ev.a) : (ev.p || ev.a));
        const phone = typeof window.getSupPhone === 'function' ? window.getSupPhone(ev.a) : '';

        html += `<div class="coord-activity-row">
          <div class="coord-act-time">${ev.t || '--:--'}</div>
          <div class="coord-act-name">
            <div style="font-weight:700">${activityName}</div>
            ${showGardenTag ? `<span style="font-size:0.68rem;color:#7f8c8d;display:block">${gardenName}</span>` : ''}
            <span class="coord-act-supplier" style="display:block;margin-top:2px;">
              ${supName} ${ev.n ? `(${ev.n})` : ''}
              ${phone ? `&nbsp; 📞 <a href="tel:${phone}" style="color:#3498db;text-decoration:none">${phone}</a>` : ''}
            </span>
          </div>
          <div class="coord-act-status" style="color:${statusColor}">${statusIcon}</div>
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
