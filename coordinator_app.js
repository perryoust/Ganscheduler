/**
 * coordinator_app.js  v4
 * Uses cal.js render functions directly (SCH-swap pattern).
 * Identical visual output to ADMIN calendar, filtered by coordinator permissions.
 * Action buttons hidden via CSS/JS; collapse (+/-) button preserved.
 * Real-time updates via window.refreshAppUI hook.
 */

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────
function _cd2s(d) {
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
function _cs2d(s) {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}
const _MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const _DAYS_HE   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

// ─────────────────────────────────────────────────────────
// ALLOWED GARDENS — uses window.gcls for proper type-filtering
// ─────────────────────────────────────────────────────────
window.getCoordAllowedGardenIds = function() {
  const allowed = new Set();
  const gardens  = [...(window.GARDENS||[]),...(window._GARDENS_EXTRA||[])];
  const clsScope = (window.coordClsScope||'all').trim();

  (window.coordCities||[]).forEach(rawCity => {
    const city = (rawCity||'').trim();
    gardens.filter(g => (g.city||'').trim() === city).forEach(g => {
      if (clsScope === 'all') {
        allowed.add(Number(g.id));
      } else {
        // Try window.gcls first, fallback to cls field check
        let gClass = typeof window.gcls === 'function' ? window.gcls(g) : null;
        if (!gClass) {
          // Fallback: look at cls/type fields
          const cls = (g.cls||g.type||'').toLowerCase();
          gClass = (cls.includes('ספר') || cls.includes('school') || cls.includes('bs')) ? 'ביה"ס' : 'גנים';
        }
        if (clsScope === 'גן'   && gClass === 'גנים')   allowed.add(Number(g.id));
        else if ((clsScope === 'ביהס' || clsScope === 'ביה"ס') && gClass === 'ביה"ס') allowed.add(Number(g.id));
        else if (clsScope !== 'גן' && clsScope !== 'ביהס' && clsScope !== 'ביה"ס') allowed.add(Number(g.id));
      }
    });
  });

  // Explicit garden-ID permissions
  (window.coordGardenIds||[]).forEach(id => allowed.add(Number(id)));
  return allowed;
};

// ─────────────────────────────────────────────────────────
// SCH SWAP — temporarily replace window.SCH with filtered subset
// Ensures cal.js renderMakeupsTop etc. see only coordinator's events
// ─────────────────────────────────────────────────────────
function _normDs(dStr) {
  if (!dStr) return '';
  let str = String(dStr).trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) return `${parts[0]}-${String(parts[1]).padStart(2,'0')}-${String(parts[2]).padStart(2,'0')}`;
      return `${parts[2]}-${String(parts[1]).padStart(2,'0')}-${String(parts[0]).padStart(2,'0')}`;
    }
  }
  const parts = str.split('-');
  if (parts.length === 3) {
    return `${parts[0]}-${String(parts[1]).padStart(2,'0')}-${String(parts[2]).padStart(2,'0')}`;
  }
  return str;
}

function _withCoordSCH(fn) {
  const allowed    = window.getCoordAllowedGardenIds();
  const gidFilter  = _getCoordGidFilter(); // checked garden IDs (null = all allowed)
  const filteredSCH = (window.SCH||[]).filter(s => {
    const gid = Number(s.g);
    if (!allowed.has(gid)) return false;
    if (gidFilter && !gidFilter.has(gid)) return false;
    return true;
  }).map(s => {
    if (s.d) {
      s = { ...s, d: _normDs(s.d) };
    }
    return s;
  });
  const origSCH  = window.SCH;
  const origMode = window._listGroupMode;
  window.SCH           = filteredSCH;
  window._listGroupMode = window._coordGroupMode || 'pairs';
  try {
    return fn(filteredSCH, gidFilter || allowed);
  } finally {
    window.SCH           = origSCH;
    window._listGroupMode = origMode;
  }
}

// Return Set of checked garden IDs, or null if all selected
function _getCoordGidFilter() {
  const checked = document.querySelectorAll('.coord-g-cb:checked');
  if (!checked.length) return null;
  const s = new Set();
  checked.forEach(cb => s.add(Number(cb.value)));
  return s;
}

// ─────────────────────────────────────────────────────────
// INIT — build DOM once, hook into refreshAppUI
// ─────────────────────────────────────────────────────────
window.initCoordinatorApp = function() {
  if (!document.getElementById('coordinator-app-root')) {
    const div = document.createElement('div');
    div.id = 'coordinator-app-root';
    div.style.cssText = 'display:none;position:fixed;inset:0;background:#f0f4f8;z-index:100000;overflow-y:auto;font-family:\'Segoe UI\',Tahoma,sans-serif;direction:rtl';
    div.innerHTML = `
      <div id="coord-header" style="background:linear-gradient(135deg,#1a5276,#154360);padding:10px 16px 0;position:sticky;top:0;z-index:10;box-shadow:0 2px 8px rgba(0,0,0,0.2)">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding-bottom:8px">
          <div style="display:flex;align-items:center;gap:10px">
            <img src="logo_wide.png" style="height:26px; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));" alt="Logo">
            <span id="coord-user-name" style="color:#fff;font-weight:700;font-size:0.95rem"></span>
          </div>
            <button onclick="window.coordRefreshData()" style="background:rgba(255,255,255,0.15);border:none;border-radius:8px;color:white;padding:5px 11px;font-size:0.78rem;cursor:pointer">🔄 רענן</button>
            <button onclick="window.coordLogout()" style="background:rgba(255,255,255,0.18);border:none;border-radius:8px;color:#fff;font-size:1.2rem;cursor:pointer;padding:4px 10px;display:inline-flex;align-items:center;justify-content:center" title="התנתק">🚪</button>
          </div>
        </div>
        <!-- Navigation -->
        <div style="display:flex;justify-content:center;align-items:center;gap:10px;padding-bottom:8px;color:#fff">
          <button onclick="window.coordNav(-1)" style="background:rgba(255,255,255,0.18);border:none;border-radius:50%;width:34px;height:34px;color:#fff;font-size:1rem;cursor:pointer">▶</button>
          <div id="coord-date-label" style="font-weight:800;font-size:1rem;min-width:200px;text-align:center"></div>
          <button onclick="window.coordNav(1)" style="background:rgba(255,255,255,0.18);border:none;border-radius:50%;width:34px;height:34px;color:#fff;font-size:1rem;cursor:pointer">◀</button>
          <button onclick="window.coordGoToday()" style="background:rgba(255,255,255,0.18);border:none;border-radius:8px;color:#fff;padding:5px 10px;font-size:0.75rem;cursor:pointer">היום</button>
        </div>
        <!-- View toggles -->
        <div style="display:flex;justify-content:center;gap:6px;padding-bottom:8px;flex-wrap:wrap">
          <div style="display:flex;gap:4px;background:rgba(0,0,0,0.25);border-radius:8px;padding:4px">
            <button class="coord-view-btn active" data-v="day"   onclick="window.coordSetView('day',this)"   style="background:rgba(255,255,255,0.35);border:none;border-radius:6px;padding:6px 14px;color:#fff;cursor:pointer;font-size:0.82rem;font-weight:800;min-height:36px;touch-action:manipulation;">יומי</button>
            <button class="coord-view-btn" data-v="week"  onclick="window.coordSetView('week',this)"  style="background:transparent;border:none;border-radius:6px;padding:6px 14px;color:rgba(255,255,255,0.65);cursor:pointer;font-size:0.82rem;min-height:36px;touch-action:manipulation;">שבועי</button>
            <button class="coord-view-btn" data-v="month" onclick="window.coordSetView('month',this)" style="background:transparent;border:none;border-radius:6px;padding:6px 14px;color:rgba(255,255,255,0.65);cursor:pointer;font-size:0.82rem;min-height:36px;touch-action:manipulation;">חודשי</button>
          </div>
          <div style="display:flex;gap:4px;background:rgba(0,0,0,0.25);border-radius:8px;padding:4px">
            <button class="coord-grp-btn active" data-g="pairs"    onclick="window.coordSetGroup('pairs',this)"    style="background:rgba(255,255,255,0.35);border:none;border-radius:6px;padding:6px 14px;color:#fff;cursor:pointer;font-size:0.82rem;font-weight:800;min-height:36px;touch-action:manipulation;">👫 זוגות</button>
            <button class="coord-grp-btn" data-g="clusters" onclick="window.coordSetGroup('clusters',this)" style="background:transparent;border:none;border-radius:6px;padding:6px 14px;color:rgba(255,255,255,0.65);cursor:pointer;font-size:0.82rem;min-height:36px;touch-action:manipulation;">🏘️ אשכולות</button>
          </div>
        </div>
        <!-- Garden multi-select filter -->
        <div style="padding-bottom:10px">
          <details id="coord-garden-panel" style="background:rgba(255,255,255,0.1);border-radius:8px;border:1px solid rgba(255,255,255,0.2)">
            <summary id="coord-garden-summary" style="padding:6px 12px;color:#fff;font-size:0.82rem;font-weight:600;cursor:pointer;list-style:none;display:flex;justify-content:space-between">
              <span id="coord-garden-label">כל הגנים/בתי הספר שלי</span>
              <span style="opacity:0.7">▼ סנן</span>
            </summary>
            <div id="coord-garden-checkboxes" style="padding:10px;background:rgba(0,0,0,0.2);border-top:1px solid rgba(255,255,255,0.15);max-height:220px;overflow-y:auto"></div>
            <div style="padding:8px 10px;display:flex;gap:8px;border-top:1px solid rgba(255,255,255,0.1)">
              <button onclick="window.coordSelectAll()" style="flex:1;background:rgba(255,255,255,0.2);border:none;border-radius:6px;color:#fff;padding:5px;font-size:0.75rem;cursor:pointer">בחר הכל</button>
              <button onclick="window.coordClearFilter()" style="flex:1;background:rgba(255,255,255,0.1);border:none;border-radius:6px;color:#fff;padding:5px;font-size:0.75rem;cursor:pointer">נקה</button>
              <button onclick="window.renderCoordinatorView(); document.getElementById('coord-garden-panel').removeAttribute('open');" style="flex:1;background:rgba(100,200,100,0.3);border:none;border-radius:6px;color:#fff;padding:5px;font-size:0.75rem;cursor:pointer;font-weight:700">הצג</button>
            </div>
          </details>
        </div>
      </div>
      <div id="coord-activities-list" style="padding:12px"></div>
      <div style="text-align:center; padding:20px; font-size:0.75rem; color:#90a4ae; opacity:0.9;">
        &copy; 2026 טומשין-עושים חינוך אחרת בע"מ(חל"צ). כל הזכויות שמורות.
      </div>
    `;
    document.body.appendChild(div);
  }

  // ── Hook into refreshAppUI for real-time updates ──
  const _orig = window.refreshAppUI;
  window.refreshAppUI = function() {
    if (_orig) try { _orig.apply(this, arguments); } catch(e) {}
    const root = document.getElementById('coordinator-app-root');
    if (root && root.style.display !== 'none') {
      try { window.renderCoordinatorView(); } catch(e) {}
    }
  };
};

// ─────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────
window._coordCurrentDate = null;
window._coordView        = 'day';
window._coordGroupMode   = 'pairs';

// ─────────────────────────────────────────────────────────
// ACTIVATION
// ─────────────────────────────────────────────────────────
window.activateCoordinatorApp = function() {
  // Remove non-coordinator DOM elements
  Array.from(document.body.children).forEach(el => {
    const tag = el.tagName.toUpperCase();
    if (tag !== 'SCRIPT' && tag !== 'STYLE' && tag !== 'LINK' && el.id !== 'coordinator-app-root') el.remove();
  });

  // Inject styles
  if (!document.getElementById('coord-styles')) {
    const s = document.createElement('style');
    s.id = 'coord-styles';
    s.innerHTML = `
      body { margin:0; padding:0; background:#f0f4f8; }
      /* ── Hide ALL action buttons inside card area, KEEP the +/- collapse button ── */
      #coord-activities-list button:not([onclick*="getElementById"]):not([onclick*="togglePairCard"]):not(.pair-collapse-btn) { display:none !important; }
      #coord-activities-list .cal-pair-bar { display:none !important; }
      #coord-activities-list .card-hdr-row { cursor: pointer !important; min-height: 40px !important; user-select: none; }
      #coord-activities-list .pair-collapse-btn { display: inline-flex !important; }
      #coord-activities-list .tw { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      #coord-activities-list table { min-width: 100%; border-collapse: collapse; }
      /* ── Garden filter checkboxes ── */
      .coord-g-cb-label { display:flex; align-items:center; gap:6px; color:#fff; font-size:0.78rem; padding:3px 0; cursor:pointer; }
      .coord-g-city-hdr { color:rgba(255,255,255,0.7); font-size:0.7rem; font-weight:800; margin-top:8px; margin-bottom:2px; text-transform:uppercase; }
      /* ── View btn active state ── */
      .coord-view-btn.active { background:rgba(255,255,255,0.3) !important; color:#fff !important; font-weight:800 !important; }
      .coord-grp-btn.active  { background:rgba(255,255,255,0.3) !important; color:#fff !important; font-weight:800 !important; }
      /* ── Cal styles override for coordinator dark bg header ── */
      #coordinator-app-root .dsh { border-radius:8px 8px 0 0; }
      #coordinator-app-root .dsec { border-radius:8px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.1); margin-bottom:12px; }
    `;
    document.head.appendChild(s);
  }

  const now = new Date();
  window._coordCurrentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const app = document.getElementById('coordinator-app-root');
  if (!app) return;
  app.style.display = 'block';

  const nameEl = document.getElementById('coord-user-name');
  if (nameEl) nameEl.textContent = window._fbUser?.displayName || (window._fbUser?.email||'').replace('@ganmanager.app','') || 'רכז';

  _coordBuildGardenFilter();
  window.renderCoordinatorView();
  // Retry once after potential late SCH load
  setTimeout(() => window.renderCoordinatorView(), 1200);
};

// ─────────────────────────────────────────────────────────
// GARDEN FILTER PANEL — build checkboxes
// ─────────────────────────────────────────────────────────
function _coordBuildGardenFilter() {
  const box = document.getElementById('coord-garden-checkboxes');
  if (!box) return;
  const allowed   = window.getCoordAllowedGardenIds();
  const allGardens = [...(window.GARDENS||[]),...(window._GARDENS_EXTRA||[])];
  const myGardens  = allGardens.filter(g => allowed.has(Number(g.id)));
  if (!myGardens.length) { box.innerHTML = '<div style="color:rgba(255,255,255,0.5);font-size:0.75rem">אין גנים בהרשאות</div>'; return; }
  const byCity = {};
  myGardens.forEach(g => { const c = g.city||'אחר'; if(!byCity[c]) byCity[c]=[]; byCity[c].push(g); });
  let h = '';
  Object.keys(byCity).sort((a,b)=>a.localeCompare(b,'he')).forEach(city => {
    h += `<div class="coord-g-city-hdr">📍 ${city}</div>`;
    byCity[city].sort((a,b)=>(a.name||'').localeCompare(b.name||'','he')).forEach(g => {
      h += `<label class="coord-g-cb-label"><input type="checkbox" class="coord-g-cb" value="${g.id}" onchange="window.coordUpdateGardenLabel()"> ${g.name}</label>`;
    });
  });
  box.innerHTML = h;
}

window.coordUpdateGardenLabel = function() {
  const checked = document.querySelectorAll('.coord-g-cb:checked');
  const lbl = document.getElementById('coord-garden-label');
  if (!lbl) return;
  if (!checked.length) { lbl.textContent = 'כל הגנים/בתי הספר שלי'; return; }
  const names = Array.from(checked).map(cb => {
    const allGardens = [...(window.GARDENS||[]),...(window._GARDENS_EXTRA||[])];
    const g = allGardens.find(x => Number(x.id) === Number(cb.value));
    return g?.name || cb.value;
  });
  lbl.textContent = names.length <= 2 ? names.join(', ') : `${names.length} גנים נבחרו`;
};

window.coordSelectAll = function() {
  document.querySelectorAll('.coord-g-cb').forEach(cb => cb.checked = true);
  window.coordUpdateGardenLabel();
};
window.coordClearFilter = function() {
  document.querySelectorAll('.coord-g-cb').forEach(cb => cb.checked = false);
  window.coordUpdateGardenLabel();
};

// ─────────────────────────────────────────────────────────
// VIEW / GROUP TOGGLES
// ─────────────────────────────────────────────────────────
window.coordSetView = function(v, btn) {
  try {
    window._coordView = v;
    document.querySelectorAll('.coord-view-btn').forEach(b => {
      const isThis = (btn && b === btn) || b.dataset.v === v;
      if (isThis) {
        b.classList.add('active');
        b.style.background = 'rgba(255,255,255,0.35)';
        b.style.color = '#ffffff';
        b.style.fontWeight = '800';
      } else {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.color = 'rgba(255,255,255,0.65)';
        b.style.fontWeight = '400';
      }
    });
    window.renderCoordinatorView();
  } catch(e) { console.error('coordSetView error:', e); }
};

window.coordSetGroup = function(g, btn) {
  try {
    window._coordGroupMode = g;
    document.querySelectorAll('.coord-grp-btn').forEach(b => {
      const isThis = (btn && b === btn) || b.dataset.g === g;
      if (isThis) {
        b.classList.add('active');
        b.style.background = 'rgba(255,255,255,0.35)';
        b.style.color = '#ffffff';
        b.style.fontWeight = '800';
      } else {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.color = 'rgba(255,255,255,0.65)';
        b.style.fontWeight = '400';
      }
    });
    // If currently in month view, switch to day view so user immediately sees the grouped cards
    if (window._coordView === 'month') {
      window.coordSetView('day');
      return;
    }
    window.renderCoordinatorView();
  } catch(e) { console.error('coordSetGroup error:', e); }
};

// ─────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────
window.coordNav = function(dir) {
  if (!window._coordCurrentDate) return;
  const d = new Date(window._coordCurrentDate.getTime());
  const v = window._coordView || 'day';
  if (v === 'day')   d.setDate(d.getDate() + dir);
  else if (v === 'week') d.setDate(d.getDate() + dir * 7);
  else                d.setMonth(d.getMonth() + dir);
  window._coordCurrentDate = d;
  window.renderCoordinatorView();
};

window.coordGoToday = function() {
  const now = new Date();
  window._coordCurrentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  window.renderCoordinatorView();
};

// ─────────────────────────────────────────────────────────
// MAIN RENDER
// ─────────────────────────────────────────────────────────
window.renderCoordinatorView = function() {
  const container = document.getElementById('coord-activities-list');
  const root      = document.getElementById('coordinator-app-root');
  if (!container || !root || root.style.display === 'none') return;

  // Ensure date is set
  if (!window._coordCurrentDate) {
    const now = new Date();
    window._coordCurrentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // On first render with data, rebuild garden filter
  if (!window._coordFilterBuilt && window.GARDENS && window.GARDENS.length > 0) {
    _coordBuildGardenFilter();
    window._coordFilterBuilt = true;
  }

  const cd = window._coordCurrentDate;
  const v  = window._coordView || 'day';

  // Update date label
  const lbl = document.getElementById('coord-date-label');
  if (lbl) {
    if (v === 'day') {
      lbl.textContent = `${_DAYS_HE[cd.getDay()]} ${cd.getDate()}/${cd.getMonth()+1}/${cd.getFullYear()}`;
    } else if (v === 'week') {
      const sun = new Date(cd); sun.setDate(cd.getDate() - cd.getDay());
      if (sun.getDay()===5) sun.setDate(sun.getDate()+2);
      else if (sun.getDay()===6) sun.setDate(sun.getDate()+1);
      const thur = new Date(sun); thur.setDate(sun.getDate()+4);
      const ws = _cd2s(sun);
      const we = _cd2s(thur);
      lbl.textContent = `${typeof window.fD==='function'?window.fD(ws):ws} – ${typeof window.fD==='function'?window.fD(we):we}`;
    } else {
      lbl.textContent = `${_MONTHS_HE[cd.getMonth()]} ${cd.getFullYear()}`;
    }
  }

  // No data yet
  if (!window.SCH) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#888">⏳ טוען נתונים...</div>';
    return;
  }

  let html = '';

  _withCoordSCH((coordEvs, allowed) => {
    if (v === 'day') {
      const ds = _cd2s(cd);
      html = _coordFallbackDay(coordEvs, ds);
    } else if (v === 'week') {
      html = _coordFallbackWeek(coordEvs, cd);
    } else {
      // Month
      if (window.calRenderMonth) {
        html = window.calRenderMonth(coordEvs, cd, {});
      } else {
        html = _coordFallbackMonth(coordEvs, cd);
      }
    }
  });

  // Ensure we output the rendered HTML
  container.innerHTML = html;

  // Post-render: ensure action buttons are hidden (safety net in addition to CSS)
  _coordHideActionButtons(container);
};

// ─────────────────────────────────────────────────────────
// POST-RENDER — hide action buttons, keep collapse (+/-) btn
// ─────────────────────────────────────────────────────────
function _coordHideActionButtons(container) {
  if (!container) return;
  container.querySelectorAll('button').forEach(btn => {
    const oc = btn.getAttribute('onclick') || '';
    // Keep the collapse (+/-) button which uses togglePairCard, getElementById, or has pair-collapse-btn class
    if (oc.includes('togglePairCard') || oc.includes('getElementById') || btn.classList.contains('pair-collapse-btn')) return;
    // Hide all other action buttons
    btn.style.setProperty('display','none','important');
  });
  // Also hide WhatsApp/export/edit rows
  container.querySelectorAll('.cal-pair-bar').forEach(el => el.style.setProperty('display','none','important'));
}

// ─────────────────────────────────────────────────────────
// Override jumpToDay for Coordinator View
// ─────────────────────────────────────────────────────────
const _origJumpToDay = window.jumpToDay;
window.jumpToDay = function(ds) {
  const coordApp = document.getElementById('coordinator-app-root');
  if (coordApp && coordApp.style.display !== 'none') {
    window._coordCurrentDate = _cs2d(ds);
    window.coordSetView('day');
    return;
  }
  if (typeof _origJumpToDay === 'function') {
    _origJumpToDay(ds);
  } else if (typeof window.setCalView === 'function') {
    window.calD = _cs2d(ds);
    window.setCalView('day');
    if (window.renderCal) window.renderCal();
  }
};

function _coordFallbackDay(evs, ds) {
  const normTarget = _normDs(ds);
  const dayEvs = evs.filter(s => _normDs(s.d) === normTarget);
  if (!dayEvs.length) {
    const d = _cs2d(ds);
    const dStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    return `<div style="background:#fff;border-radius:10px;padding:24px 16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.05);margin:10px 0;">
      <div style="font-size:1.8rem;margin-bottom:8px">📅</div>
      <div style="font-weight:700;font-size:0.95rem;color:#1e293b;margin-bottom:6px">אין פעילויות רשומות בתאריך ${dStr} (${_DAYS_HE[d.getDay()]})</div>
      <div style="font-size:0.8rem;color:#64748b">ניתן לעבור ליום אחר בעזרת החצים (▶ ◀) או לעבור לתצוגה <b>שבועית</b> / <b>חודשית</b> סביב תאריך זה.</div>
    </div>`;
  }
  return _coordRenderByCity(dayEvs, ds);
}

function _coordFallbackWeek(evs, cd) {
  const sun = new Date(cd);
  sun.setDate(cd.getDate() - cd.getDay());
  if (sun.getDay() === 5) sun.setDate(sun.getDate() + 2);
  else if (sun.getDay() === 6) sun.setDate(sun.getDate() + 1);

  let hasAnyActivities = false;
  let daysHtml = '';

  for (let i = 0; i < 5; i++) {
    const d = new Date(sun);
    d.setDate(sun.getDate() + i);
    const ds = _cd2s(d);
    const normTarget = _normDs(ds);
    const dayEvs = evs.filter(s => _normDs(s.d) === normTarget);
    const hol = window.getHolidayInfo ? window.getHolidayInfo(ds) : null;
    const blk = window.getBlockedInfo ? window.getBlockedInfo(ds) : null;
    
    const dStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`;
    const dayHeader = `📅 ${_DAYS_HE[d.getDay()]} ${dStr}${hol ? ` 🎉 ${hol.name}` : ''}${blk ? ` 🚫 ${blk.reason}` : ''}`;
    
    if (dayEvs.length > 0) {
      hasAnyActivities = true;
      daysHtml += `<div style="margin-bottom:14px;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);border:1px solid #e2e8f0">
        <div style="background:linear-gradient(135deg,#1565c0,#1976d2);color:#fff;padding:8px 14px;font-weight:700;font-size:0.88rem;display:flex;justify-content:space-between;align-items:center">
          <span>${dayHeader}</span>
          <span style="font-size:0.75rem;background:rgba(255,255,255,0.22);padding:2px 10px;border-radius:12px;font-weight:800">${dayEvs.length} פעילויות</span>
        </div>
        <div style="padding:10px 8px">${_coordRenderByCity(dayEvs, ds)}</div>
      </div>`;
    } else {
      daysHtml += `<div style="margin-bottom:8px;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);border:1px solid #f1f5f9">
        <div style="background:#64748b;color:#fff;padding:5px 12px;font-weight:600;font-size:0.8rem;display:flex;justify-content:space-between;align-items:center">
          <span>${dayHeader}</span>
          <span style="font-size:0.7rem;opacity:0.85">אין פעילויות</span>
        </div>
      </div>`;
    }
  }

  if (!hasAnyActivities) {
    return `<div style="background:#fff;border-radius:10px;padding:24px 16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.05);margin:10px 0;">
      <div style="font-size:1.8rem;margin-bottom:8px">📅</div>
      <div style="font-weight:700;font-size:0.95rem;color:#1e293b;margin-bottom:6px">אין פעילויות בשבוע זה</div>
      <div style="font-size:0.8rem;color:#64748b">ניתן להשתמש בחצים (▶ ◀) על מנת לעבור לשבועות אחרים.</div>
    </div>`;
  }

  return daysHtml;
}

function _coordFallbackMonth(evs, cd) {
  const byDate = {};
  evs.forEach(s => { const sd = _normDs(s.d); if(!byDate[sd]) byDate[sd]=[]; byDate[sd].push(s); });
  return Object.keys(byDate).sort().map(ds => {
    const d = _cs2d(ds);
    return `<div style="margin-bottom:14px"><div style="background:#1a5276;color:#fff;padding:7px 12px;border-radius:8px 8px 0 0;font-weight:800">📅 ${_DAYS_HE[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}</div>${_coordRenderByCity(byDate[ds], ds)}</div>`;
  }).join('') || `<div style="background:#fff;border-radius:10px;padding:24px 16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.05);margin:10px 0;">
    <div style="font-size:1.8rem;margin-bottom:8px">📅</div>
    <div style="font-weight:700;font-size:0.95rem;color:#1e293b;margin-bottom:6px">אין פעילויות בחודש זה</div>
    <div style="font-size:0.8rem;color:#64748b">ניתן להשתמש בחצים (▶ ◀) על מנת לעבור לחודשים אחרים.</div>
  </div>`;
}

function _coordRenderByCity(evs, ds) {
  const allGardens = [...(window.GARDENS||[]),...(window._GARDENS_EXTRA||[])];
  const byCity = {};
  evs.forEach(s => {
    const g = typeof window.G==='function' ? window.G(s.g) : allGardens.find(x=>Number(x.id)===Number(s.g));
    if (!g) return;
    const c = g.city||'אחר';
    if (!byCity[c]) byCity[c]=[];
    byCity[c].push(s);
  });

  const isClusterMode = (window._coordGroupMode === 'clusters');

  return Object.keys(byCity).sort((a,b)=>a.localeCompare(b,'he')).map(city => {
    const clr = window.CITY_COLORS ? window.CITY_COLORS(city) : {solid:'#1a237e',light:'#f5f7ff',border:'#e2e8f0'};
    const cityEvs = byCity[city];
    const pairedGids = new Set();
    const pairBlocks = [];
    
    let groupSource = [];
    if (isClusterMode) {
      if (typeof window.getClusters === 'function') {
        const cls = window.getClusters(ds, ds);
        groupSource = (cls && cls.length ? cls : window.getClusters()).map(c => ({ id: c.id, name: c.name, ids: (c.gardenIds || c.ids || []).map(Number) }));
      } else if (window.clusters) {
        groupSource = Object.values(window.clusters).map(c => ({ id: c.id, name: c.name, ids: (c.gardenIds || c.ids || []).map(Number) }));
      }
    } else {
      let prs = (typeof window.getPairs === 'function') ? window.getPairs(ds, ds) : (window.pairs || []);
      if (!prs || !prs.length) prs = window.pairs || [];
      groupSource = (prs || []).map(p => ({ id: p.id, name: p.name, ids: (p.ids || []).map(Number) }));
    }

    groupSource.forEach(grp => {
      if (!isClusterMode && window.isPairBroken && window.isPairBroken(grp.id, ds)) return;
      const pe = cityEvs.filter(s => grp.ids.includes(Number(s.g)));
      if (!pe.length) return;
      grp.ids.forEach(id => pairedGids.add(Number(id)));
      pairBlocks.push({ pair: grp, pe });
    });
    pairBlocks.sort((a,b) => (a.pair.name||'').localeCompare(b.pair.name||'', 'he', { numeric: true }));

    const modeLabel = isClusterMode ? 'אשכולות' : 'זוגות';
    let html = `<details class="city-accordion" open style="margin-bottom:12px">
      <summary style="background:${clr.solid};color:#fff;padding:8px 12px;font-weight:800;border-radius:6px;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center">
        <span>📍 ${city} (${cityEvs.length} פעילויות)</span>
        <span style="font-size:0.75rem;opacity:0.85">${pairBlocks.length} ${modeLabel}</span>
      </summary>
      <div style="padding:6px 0;background:transparent">`;

    if (window.ui && typeof window.ui.renderStandardPairCard === 'function') {
      // 1. Grouped blocks (pairs or clusters)
      pairBlocks.forEach(({ pair, pe }) => {
        html += window.ui.renderStandardPairCard(pair, pe, {
          ds,
          clr,
          context: 'cal',
          isCluster: isClusterMode,
          defaultOpen: true
        });
      });

      // 2. Solo gardens (not in any pair or cluster)
      const soloMap = {};
      cityEvs.filter(s => !pairedGids.has(Number(s.g))).forEach(s => {
        const gid = Number(s.g);
        if (!soloMap[gid]) soloMap[gid] = [];
        soloMap[gid].push(s);
      });
      Object.keys(soloMap).sort((a,b) => {
        const na = (allGardens.find(x => Number(x.id) === Number(a))?.name || '');
        const nb = (allGardens.find(x => Number(x.id) === Number(b))?.name || '');
        return na.localeCompare(nb, 'he', { numeric: true });
      }).forEach(gid => {
        const g = allGardens.find(x => Number(x.id) === Number(gid));
        if (!g) return;
        const gEvs = soloMap[gid];
        html += window.ui.renderStandardPairCard({ id: 'solo_' + gid, name: g.name, ids: [Number(gid)] }, gEvs, {
          ds,
          clr,
          context: 'cal',
          isSolo: true,
          defaultOpen: true
        });
      });
    }
    html += '</div></details>';
    return html;
  }).join('');
}

// ─────────────────────────────────────────────────────────
// REFRESH + LOGOUT
// ─────────────────────────────────────────────────────────
window.coordRefreshData = function() {
  window._coordFilterBuilt = false;
  if (window.loadFromFirebase) {
    window.loadFromFirebase(false, true).then(() => {
      _coordBuildGardenFilter();
      window.renderCoordinatorView();
      _coordToast('✅ נתונים עודכנו');
    }).catch(() => location.reload());
  } else {
    location.reload();
  }
};

window.coordLogout = function() {
  if (typeof window.doLogout === 'function') {
    window.doLogout(false);
  } else {
    if (window._safeLS) window._safeLS.removeItem('ganv5_auth_user');
    if (window._fbSignOut) window._fbSignOut();
    location.reload();
  }
};

function _coordToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#27ae60;color:#fff;padding:8px 20px;border-radius:20px;font-size:0.85rem;font-weight:600;z-index:999999;box-shadow:0 4px 12px rgba(0,0,0,0.3)';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ─────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────
window.initCoordinatorApp();
