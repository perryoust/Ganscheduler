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

  // ── All Cities Mode for Manager / VP / Executive Roles ──
  const isAllCities = window.role === 'manager' || window.role === 'vp' || window.permAllCities || (window.coordCities||[]).includes('ALL');
  if (isAllCities) {
    gardens.forEach(g => {
      if (clsScope === 'all') {
        allowed.add(Number(g.id));
      } else {
        let gClass = typeof window.gcls === 'function' ? window.gcls(g) : null;
        if (!gClass) {
          const cls = (g.cls||g.type||'').toLowerCase();
          gClass = (cls.includes('ספר') || cls.includes('school') || cls.includes('bs')) ? 'ביה"ס' : 'גנים';
        }
        if (clsScope === 'גן'   && gClass === 'גנים')   allowed.add(Number(g.id));
        else if ((clsScope === 'ביהס' || clsScope === 'ביה"ס') && gClass === 'ביה"ס') allowed.add(Number(g.id));
        else if (clsScope !== 'גן' && clsScope !== 'ביהס' && clsScope !== 'ביה"ס') allowed.add(Number(g.id));
      }
    });
    return allowed;
  }

  // ── Field Coordinator: Strict Garden-Level Isolation ──
  // A field coordinator MUST see ONLY their own assigned gardens!
  const explicitGardenIds = new Set();
  if (window.coordManagerId && window.managers && window.managers[window.coordManagerId]) {
    const mgrObj = window.managers[window.coordManagerId];
    if (Array.isArray(mgrObj.gardenIds) && mgrObj.gardenIds.length > 0) {
      mgrObj.gardenIds.forEach(id => explicitGardenIds.add(Number(id)));
    }
  }
  (window.coordGardenIds||[]).forEach(id => explicitGardenIds.add(Number(id)));

  // If coordinator has explicitly assigned gardens, STRICTLY restrict them to those gardens only!
  if (explicitGardenIds.size > 0) {
    explicitGardenIds.forEach(id => {
      const g = gardens.find(x => Number(x.id) === Number(id));
      if (!g) {
        allowed.add(id);
        return;
      }
      if (clsScope === 'all') {
        allowed.add(id);
      } else {
        let gClass = typeof window.gcls === 'function' ? window.gcls(g) : null;
        if (!gClass) {
          const cls = (g.cls||g.type||'').toLowerCase();
          gClass = (cls.includes('ספר') || cls.includes('school') || cls.includes('bs')) ? 'ביה"ס' : 'גנים';
        }
        if (clsScope === 'גן'   && gClass === 'גנים')   allowed.add(id);
        else if ((clsScope === 'ביהס' || clsScope === 'ביה"ס') && gClass === 'ביה"ס') allowed.add(id);
        else if (clsScope !== 'גן' && clsScope !== 'ביהס' && clsScope !== 'ביה"ס') allowed.add(id);
      }
    });
    return allowed;
  }

  // Fallback ONLY for coordinators with NO individual garden assignments at all:
  (window.coordCities||[]).forEach(rawCity => {
    const city = (rawCity||'').trim();
    if (!city || city === 'ALL') return;
    gardens.filter(g => (g.city||'').trim() === city).forEach(g => {
      if (clsScope === 'all') {
        allowed.add(Number(g.id));
      } else {
        let gClass = typeof window.gcls === 'function' ? window.gcls(g) : null;
        if (!gClass) {
          const cls = (g.cls||g.type||'').toLowerCase();
          gClass = (cls.includes('ספר') || cls.includes('school') || cls.includes('bs')) ? 'ביה"ס' : 'גנים';
        }
        if (clsScope === 'גן'   && gClass === 'גנים')   allowed.add(Number(g.id));
        else if ((clsScope === 'ביהס' || clsScope === 'ביה"ס') && gClass === 'ביה"ס') allowed.add(Number(g.id));
        else if (clsScope !== 'גן' && clsScope !== 'ביהס' && clsScope !== 'ביה"ס') allowed.add(Number(g.id));
      }
    });
  });

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
  const q          = (window._coordSearchQuery || '').trim().toLowerCase();
  const allGardens = [...(window.GARDENS||[]),...(window._GARDENS_EXTRA||[])];

  const filteredSCH = (window.SCH||[]).filter(s => {
    const gid = Number(s.g);
    if (!allowed.has(gid)) return false;
    if (gidFilter && !gidFilter.has(gid)) return false;
    if (q) {
      const g = allGardens.find(x => Number(x.id) === gid);
      const gName = (g?.name || '').toLowerCase();
      const gCity = (g?.city || '').toLowerCase();
      const act = (s.act || '').toLowerCase();
      const sup = (s.a || '').toLowerCase();
      const supLbl = (typeof window.supNameLabel === 'function' ? window.supNameLabel(s.a) : (typeof window.supBase === 'function' ? window.supBase(s.a) : '')).toLowerCase();
      const nt = (s.nt || '').toLowerCase();
      const match = gName.includes(q) || gCity.includes(q) || act.includes(q) || sup.includes(q) || supLbl.includes(q) || nt.includes(q);
      if (!match) return false;
    }
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
          <div style="display:flex;align-items:center;gap:6px">
            <button class="coord-msg-btn" onclick="window.coordExportCurrentView()" style="background:#25d366;border:none;border-radius:8px;color:#fff;padding:5px 12px;font-size:0.78rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px" title="ייצוא כל פעילויות היום להודעה">📱 הודעה יומית</button>
            <button id="coord-back-admin-btn" onclick="window.closeCoordPreview()" style="display:none;background:#f59e0b;border:none;border-radius:8px;color:#1e293b;padding:5px 11px;font-size:0.78rem;font-weight:800;cursor:pointer">🔙 חזור למערכת</button>
            <button onclick="window.coordRefreshData()" style="background:rgba(255,255,255,0.15);border:none;border-radius:8px;color:white;padding:5px 11px;font-size:0.78rem;cursor:pointer">🔄 רענן</button>
            <button onclick="window.coordLogout()" style="background:rgba(255,255,255,0.18);border:none;border-radius:8px;color:#fff;font-size:1.2rem;cursor:pointer;padding:4px 10px;display:inline-flex;align-items:center;justify-content:center" title="התנתק">🚪</button>
          </div>
        </div>
        <!-- Navigation -->
        <div style="display:flex;justify-content:center;align-items:center;gap:6px;padding-bottom:8px;color:#fff;flex-wrap:wrap">
          <button id="coord-nav-prev" onclick="window.coordNav(-1)" style="background:rgba(255,255,255,0.18);border:none;border-radius:8px;padding:5px 12px;color:#fff;font-size:0.82rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px" title="אתמול / קודם">▶ <span id="coord-nav-prev-lbl">אתמול</span></button>
          <div style="display:inline-flex;align-items:center;gap:4px;background:rgba(0,0,0,0.2);padding:3px 8px;border-radius:8px;position:relative">
            <div id="coord-date-label" onclick="window.coordTriggerDatePicker()" style="font-weight:800;font-size:0.92rem;min-width:140px;text-align:center;cursor:pointer;user-select:none" title="לחץ לבחירת תאריך מהיומן"></div>
            <input type="date" id="coord-hidden-datepicker" style="position:absolute;opacity:0;pointer-events:none;width:0;height:0" onchange="window.coordOnPickDate(this.value)">
            <button onclick="window.coordTriggerDatePicker()" style="background:none;border:none;color:#fff;cursor:pointer;font-size:0.95rem;padding:2px" title="בחר תאריך מהלוח">📆</button>
          </div>
          <button id="coord-nav-next" onclick="window.coordNav(1)" style="background:rgba(255,255,255,0.18);border:none;border-radius:8px;padding:5px 12px;color:#fff;font-size:0.82rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px" title="מחר / הבא"><span id="coord-nav-next-lbl">מחר</span> ◀</button>
          <button onclick="window.coordGoToday()" style="background:rgba(255,255,255,0.22);border:none;border-radius:8px;color:#fff;padding:5px 11px;font-size:0.75rem;cursor:pointer;font-weight:700">היום</button>
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
        <!-- Live Instant Search Bar -->
        <div style="padding-bottom:8px">
          <div style="position:relative;display:flex;align-items:center">
            <input type="text" id="coord-live-search" placeholder="🔍 חיפוש מהיר: שם גן, ספק, פעילות או עיר..." 
              oninput="window.coordOnSearch(this.value)" 
              style="width:100%;box-sizing:border-box;padding:8px 34px 8px 12px;border-radius:8px;border:none;background:#fff;color:#1e293b;font-size:0.85rem;box-shadow:0 1px 4px rgba(0,0,0,0.15);outline:none">
            <button id="coord-search-clear" onclick="window.coordClearSearch()" 
              style="position:absolute;left:8px;background:none;border:none;font-size:0.95rem;color:#78909c;cursor:pointer;display:none" title="נקה חיפוש">✕</button>
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
      <!-- Control Subbar: Activity Counter & Accordion Collapse/Expand -->
      <div id="coord-subbar" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px 4px;max-width:1200px;margin:0 auto">
        <div id="coord-summary-count" style="font-size:0.82rem;font-weight:700;color:#334155"></div>
        <div style="display:flex;gap:6px">
          <button onclick="window.coordToggleAllCities(false)" style="font-size:0.75rem;background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:3px 9px;cursor:pointer;color:#334155;font-weight:600;display:inline-flex;align-items:center;gap:3px" title="כווץ את כל ערי האקורדיון">📁 כווץ הכל</button>
          <button onclick="window.coordToggleAllCities(true)" style="font-size:0.75rem;background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:3px 9px;cursor:pointer;color:#334155;font-weight:600;display:inline-flex;align-items:center;gap:3px" title="פתח את כל ערי האקורדיון">📖 פתח הכל</button>
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
// ACTIVATION & EXPORT VIEW
// ─────────────────────────────────────────────────────────
window.coordExportCurrentView = function() {
  const cd = window._coordCurrentDate || new Date();
  const ds = _cd2s(cd);
  let gids = [];
  _withCoordSCH((coordEvs) => {
    const dayEvs = coordEvs.filter(s => _normDs(s.d) === _normDs(ds));
    gids = Array.from(new Set(dayEvs.map(s => Number(s.g)).filter(Boolean)));
  });
  if (!gids.length) {
    if (typeof _coordToast === 'function') _coordToast('אין פעילויות לייצוא בתאריך זה');
    else alert('אין פעילויות לייצוא בתאריך זה');
    return;
  }
  if (typeof window._exportPairWA === 'function') {
    window._exportPairWA(gids, false, null, ds);
  }
};

window.activateCoordinatorApp = function() {
  // Remove non-coordinator DOM elements (preserve loading overlay until fade-out, AND modals like #exm / #toast-msg)
  Array.from(document.body.children).forEach(el => {
    const tag = el.tagName.toUpperCase();
    if (tag !== 'SCRIPT' && tag !== 'STYLE' && tag !== 'LINK' && el.id !== 'coordinator-app-root' && el.id !== 'system-loading-overlay' && el.id !== 'exm' && el.id !== 'toast-msg' && el.id !== 'copy-toast') el.remove();
  });

  // Inject styles
  if (!document.getElementById('coord-styles')) {
    const s = document.createElement('style');
    s.id = 'coord-styles';
    s.innerHTML = `
      body { margin:0; padding:0; background:#f0f4f8; }
      /* ── Hide edit/shift/cancel action buttons inside card area, KEEP collapse (+/-) and message (הודעה) buttons ── */
      #coord-activities-list button:not([onclick*="getElementById"]):not([onclick*="togglePairCard"]):not(.pair-collapse-btn):not(.coord-msg-btn):not([onclick*="_export"]):not([onclick*="openExport"]) { display:none !important; }
      #coord-activities-list .cal-pair-bar { display:none !important; }
      #coord-activities-list .card-hdr-row { cursor: pointer !important; min-height: 40px !important; user-select: none; }
      #coord-activities-list .pair-collapse-btn { display: inline-flex !important; }
      #coord-activities-list .coord-msg-btn { display: inline-flex !important; }
      #coord-activities-list .tw { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      #coord-activities-list table { min-width: 100%; border-collapse: collapse; }
      /* ── Modal overlay stacking above coordinator view ── */
      #exm { z-index: 100050 !important; }
      #exm.open { z-index: 100050 !important; display: flex !important; }
      #toast-msg, #copy-toast { z-index: 100060 !important; }
      .coord-exceptions-accordion summary::-webkit-details-marker { display:none !important; }
      .coord-exceptions-accordion summary { list-style:none !important; }
      /* ── Garden filter checkboxes ── */
      .coord-g-cb-label { display:flex; align-items:center; gap:6px; color:#fff; font-size:0.78rem; padding:3px 0; cursor:pointer; }
      .coord-g-city-hdr { color:rgba(255,255,255,0.7); font-size:0.7rem; font-weight:800; margin-top:8px; margin-bottom:2px; text-transform:uppercase; }
      /* ── View btn active state ── */
      .coord-view-btn.active { background:rgba(255,255,255,0.3) !important; color:#fff !important; font-weight:800 !important; }
      .coord-grp-btn.active  { background:rgba(255,255,255,0.3) !important; color:#fff !important; font-weight:800 !important; }
      /* ── Cal styles override for coordinator dark bg header ── */
      #coordinator-app-root .dsh { border-radius:8px 8px 0 0; }
      #coordinator-app-root .dsec { border-radius:8px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.1); margin-bottom:12px; }
      /* ── City accordion styling ── */
      .city-accordion summary { user-select:none; transition:opacity 0.15s; }
      .city-accordion summary:hover { opacity:0.92; }
      .city-accordion summary .city-chevron { transition:transform 0.2s ease; display:inline-block; font-size:0.7rem; }
      .city-accordion:not([open]) summary .city-chevron { transform:rotate(-90deg); }
    `;
    document.head.appendChild(s);
  }

  // Strict Active Year Lock: Ensure coordinators and VPs always operate exclusively in the active school year
  try {
    const metaStr = (window._safeLS && window._safeLS.getItem('ganv5_meta')) || localStorage.getItem('ganv5_meta');
    if (metaStr) {
      const meta = JSON.parse(metaStr);
      if (meta.currentYear) {
        window.CURRENT_YEAR = meta.currentYear;
      }
    }
  } catch(e) {}
  if (!window.CURRENT_YEAR || window.CURRENT_YEAR === 'tashpav') {
    window.CURRENT_YEAR = 'tashpaz';
  }

  const now = new Date();
  window._coordCurrentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const app = document.getElementById('coordinator-app-root');
  if (!app) return;
  app.style.display = 'block';

  // Strict Read-Only Guard
  window.isReadOnly = true;

  const isManager = window.role === 'manager' || window.role === 'vp' || window.permAllCities;
  const nameEl = document.getElementById('coord-user-name');
  if (nameEl) {
    const roleIcon = isManager ? '👔 ' : '👤 ';
    const defaultLabel = isManager ? 'סמנכ"ל / הנהלה' : 'רכז';
    nameEl.textContent = roleIcon + (window._fbUser?.displayName || (window._fbUser?.email||'').replace('@ganmanager.app','') || defaultLabel);
  }

  const defaultGardenLabel = isManager ? 'כל הגנים והערים (הנהלה)' : 'כל הגנים/בתי הספר שלי';
  const gSummaryLabel = document.getElementById('coord-garden-label');
  if (gSummaryLabel) gSummaryLabel.textContent = defaultGardenLabel;

  _coordBuildGardenFilter();
  if (typeof window._coordEnsureYearPairs === 'function') {
    window._coordEnsureYearPairs().then(() => {
      window.renderCoordinatorView();
    });
  } else {
    window.renderCoordinatorView();
  }
  // Retry once after potential late SCH load
  setTimeout(() => {
    if (typeof window._coordEnsureYearPairs === 'function') window._coordEnsureYearPairs();
    window.renderCoordinatorView();
  }, 1200);
};

// ─────────────────────────────────────────────────────────
// ENSURE CURRENT YEAR PAIRS
// ─────────────────────────────────────────────────────────
window._coordEnsureYearPairs = async function() {
  const curY = window.CURRENT_YEAR || 'tashpaz';
  const isLegacyAutopairs = Array.isArray(window.pairs) && window.pairs.some(p => {
    const ids = (p.ids || []).map(Number);
    return (ids.includes(9) && ids.includes(21)) || (ids.includes(17) && ids.includes(79) && ids.includes(115));
  });

  const needsSync = !Array.isArray(window.pairs) || 
                    window.pairs.length === 0 || 
                    (curY !== 'tashpav' && isLegacyAutopairs);

  if (needsSync) {
    if (window._fbAppData && window._fbAppData.pairs) {
      const raw = window._fbAppData.pairs;
      const arr = Array.isArray(raw) ? raw : Object.values(raw);
      window.pairs = arr.map(p => ({
        ...p,
        ids: (p.ids || []).map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0)
      })).filter(p => p.ids.length >= 2);
      console.log('[_coordEnsureYearPairs] Synced ' + window.pairs.length + ' pairs from _fbAppData for ' + curY);
    } else {
      try {
        let tok = await window._fbUser?.getIdToken(false);
        const authQ = tok ? '?auth=' + tok : '';
        const base = typeof FB_ROOT !== 'undefined' ? FB_ROOT : 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';
        const url = (curY === 'tashpav') ? `${base}/data/pairs.json${authQ}` : `${base}/years/${curY}/config/pairs.json${authQ}${authQ ? '&' : '?'}cb=${Date.now()}`;
        const res = await fetch(url);
        if (res.ok) {
          const cloudP = await res.json();
          if (cloudP) {
            const arr = Array.isArray(cloudP) ? cloudP : Object.values(cloudP);
            window.pairs = arr.map(p => ({
              ...p,
              ids: (p.ids || []).map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0)
            })).filter(p => p.ids.length >= 2);
            console.log('[_coordEnsureYearPairs] Directly loaded ' + window.pairs.length + ' pairs from Firebase for ' + curY);
            if (typeof window.renderCoordinatorView === 'function') window.renderCoordinatorView();
          }
        }
      } catch(e) {
        console.warn('[_coordEnsureYearPairs] Error fetching pairs:', e);
      }
    }
  }
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
  const isManager = window.role === 'manager' || window.role === 'vp' || window.permAllCities;
  if (!checked.length) { 
    lbl.textContent = isManager ? 'כל הגנים והערים (הנהלה)' : 'כל הגנים/בתי הספר שלי'; 
    return; 
  }
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

// ── Live Search & Accordion Helpers ──
window._coordSearchQuery = '';
window.coordOnSearch = function(val) {
  window._coordSearchQuery = (val || '').trim();
  const clr = document.getElementById('coord-search-clear');
  if (clr) clr.style.display = window._coordSearchQuery ? 'block' : 'none';
  window.renderCoordinatorView();
};
window.coordClearSearch = function() {
  const inp = document.getElementById('coord-live-search');
  if (inp) inp.value = '';
  window.coordOnSearch('');
};
window.coordToggleAllCities = function(open) {
  document.querySelectorAll('.city-accordion').forEach(d => {
    d.open = open;
  });
  document.querySelectorAll('#coord-activities-list .mob-accordion').forEach(d => {
    d.open = open;
  });
  document.querySelectorAll('#coord-activities-list .standard-pair-card .card-hdr-row').forEach(hdr => {
    const tableDiv = hdr.nextElementSibling;
    if (tableDiv && tableDiv.id && tableDiv.id.startsWith('pair-toggle-')) {
      tableDiv.style.display = open ? 'block' : 'none';
      const btnIcon = hdr.querySelector('.pair-collapse-btn span');
      if (btnIcon) btnIcon.textContent = open ? '-' : '+';
    }
  });
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

  // Active School Year Date Boundary Protection
  // Prevents field coordinators and VPs from wandering into past school years
  const curY = window.CURRENT_YEAR || 'tashpaz';
  let yearStart = null;
  let yearEnd = null;
  try {
    const metaStr = (window._safeLS && window._safeLS.getItem('ganv5_meta')) || localStorage.getItem('ganv5_meta');
    if (metaStr) {
      const meta = JSON.parse(metaStr);
      const yInfo = meta.years && meta.years[curY];
      if (yInfo) {
        if (yInfo.start) yearStart = new Date(yInfo.start + 'T00:00:00');
        if (yInfo.end)   yearEnd   = new Date(yInfo.end + 'T23:59:59');
      }
    }
  } catch(e) {}

  if (!yearStart) yearStart = new Date('2026-09-01T00:00:00');
  if (!yearEnd)   yearEnd   = new Date('2027-08-31T23:59:59');

  if (d < yearStart) {
    if (typeof _coordToast === 'function') {
      _coordToast('📅 שנת הלימודים הנוכחית מתחילה ב-' + (yearStart.toLocaleDateString('he-IL')));
    }
    window._coordCurrentDate = yearStart;
    window.renderCoordinatorView();
    return;
  }
  if (d > yearEnd) {
    if (typeof _coordToast === 'function') {
      _coordToast('📅 שנת הלימודים הנוכחית מסתיימת ב-' + (yearEnd.toLocaleDateString('he-IL')));
    }
    window._coordCurrentDate = yearEnd;
    window.renderCoordinatorView();
    return;
  }

  window._coordCurrentDate = d;
  window.renderCoordinatorView();
};

window.coordGoToday = function() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const curY = window.CURRENT_YEAR || 'tashpaz';
  let yearStart = null;
  let yearEnd = null;
  try {
    const metaStr = (window._safeLS && window._safeLS.getItem('ganv5_meta')) || localStorage.getItem('ganv5_meta');
    if (metaStr) {
      const meta = JSON.parse(metaStr);
      const yInfo = meta.years && meta.years[curY];
      if (yInfo) {
        if (yInfo.start) yearStart = new Date(yInfo.start + 'T00:00:00');
        if (yInfo.end)   yearEnd   = new Date(yInfo.end + 'T23:59:59');
      }
    }
  } catch(e) {}
  if (!yearStart) yearStart = new Date('2026-09-01T00:00:00');
  if (!yearEnd)   yearEnd   = new Date('2027-08-31T23:59:59');

  if (d < yearStart) window._coordCurrentDate = yearStart;
  else if (d > yearEnd) window._coordCurrentDate = yearEnd;
  else window._coordCurrentDate = d;

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

  // Update date label & nav button labels
  const lbl = document.getElementById('coord-date-label');
  const prevLbl = document.getElementById('coord-nav-prev-lbl');
  const nextLbl = document.getElementById('coord-nav-next-lbl');
  if (prevLbl && nextLbl) {
    if (v === 'day') {
      const prevD = new Date(cd); prevD.setDate(cd.getDate() - 1);
      const nextD = new Date(cd); nextD.setDate(cd.getDate() + 1);
      prevLbl.textContent = `אתמול (${_DAYS_HE[prevD.getDay()]})`;
      nextLbl.textContent = `מחר (${_DAYS_HE[nextD.getDay()]})`;
    } else if (v === 'week') {
      prevLbl.textContent = 'שבוע קודם';
      nextLbl.textContent = 'שבוע הבא';
    } else {
      prevLbl.textContent = 'חודש קודם';
      nextLbl.textContent = 'חודש הבא';
    }
  }
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
      // Month — dedicated coordinator mobile-first card list
      html = _coordFallbackMonth(coordEvs, cd);
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
    const txt = (btn.textContent || '').trim();
    // Keep collapse (+/-) button, navigation buttons, and message export buttons
    if (
      oc.includes('togglePairCard') || 
      oc.includes('getElementById') || 
      oc.includes('coordNav') || 
      oc.includes('coordGoToday') || 
      oc.includes('_export') || 
      oc.includes('openExport') || 
      txt.includes('הודעה') || 
      btn.classList.contains('pair-collapse-btn') || 
      btn.classList.contains('coord-nav-btn') || 
      btn.classList.contains('coord-msg-btn')
    ) {
      if (btn.classList.contains('coord-msg-btn') || oc.includes('_export') || txt.includes('הודעה')) {
        btn.style.setProperty('display', 'inline-flex', 'important');
      }
      return;
    }
    // Hide all other action buttons (edit, cancel, shift, delete, etc.)
    btn.style.setProperty('display','none','important');
  });
  // Also hide edit rows
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

// ─────────────────────────────────────────────────────────
// EXCEPTIONS & MAKEUPS BOX (קוביה של שינויים והשלמות)
// ─────────────────────────────────────────────────────────
function _coordGetExceptionType(s) {
  if (s.st === 'nohap') {
    return { type: 'nohap', label: 'לא התקיים', badgeBg: '#fee2e2', badgeBorder: '#ef4444', badgeColor: '#b91c1c', borderColor: '#ef4444', icon: '⚠️' };
  }
  if (s.st === 'can') {
    return { type: 'can', label: 'בוטל', badgeBg: '#fee2e2', badgeBorder: '#f87171', badgeColor: '#b91c1c', borderColor: '#ef4444', icon: '❌' };
  }
  if (s.st === 'post' || s.pd) {
    return { type: 'post', label: 'נדחה', badgeBg: '#fef3c7', badgeBorder: '#f59e0b', badgeColor: '#92400e', borderColor: '#f59e0b', icon: '🕒' };
  }
  if (s._isMakeup || s._makeupFrom || (s.nt && /השלמה/i.test(s.nt)) || (s.n && /השלמה/i.test(s.n))) {
    return { type: 'makeup', label: 'השלמה', badgeBg: '#dcfce7', badgeBorder: '#22c55e', badgeColor: '#15803d', borderColor: '#22c55e', icon: '🔄' };
  }
  if ((s.nt && /הוקדם/i.test(s.nt)) || (s.n && /הוקדם/i.test(s.n))) {
    return { type: 'advance', label: 'הוקדם', badgeBg: '#e0f2fe', badgeBorder: '#0ea5e9', badgeColor: '#0369a1', borderColor: '#0ea5e9', icon: '⚡' };
  }
  if (s._postFrom || (s.nt && /הוזז|הועבר/i.test(s.nt))) {
    return { type: 'shift', label: 'הוזז', badgeBg: '#f3e8ff', badgeBorder: '#a855f7', badgeColor: '#7e22ce', borderColor: '#a855f7', icon: '🔄' };
  }
  if (typeof window.isGlobalMakeup === 'function' && window.isGlobalMakeup(s)) {
    return { type: 'makeup', label: 'שינוי/השלמה', badgeBg: '#fef3c7', badgeBorder: '#f59e0b', badgeColor: '#92400e', borderColor: '#f59e0b', icon: '🔄' };
  }
  return null;
}

function _coordRenderExceptionsBox(evs, ds, isWeek = false) {
  if (!evs || !evs.length) return '';
  const allowed = typeof window.getCoordAllowedGardenIds === 'function' ? window.getCoordAllowedGardenIds() : null;
  const gidFilter = typeof _getCoordGidFilter === 'function' ? _getCoordGidFilter() : null;
  const allGardens = [...(window.GARDENS||[]),...(window._GARDENS_EXTRA||[])];
  const items = [];
  
  evs.forEach(s => {
    const gid = Number(s.g);
    // Strict Garden-Level Isolation: ONLY coordinator's own assigned gardens
    if (allowed && !allowed.has(gid)) return;
    if (gidFilter && !gidFilter.has(gid)) return;
    const info = _coordGetExceptionType(s);
    if (!info) return;
    const g = typeof window.G === 'function' ? window.G(gid) : allGardens.find(x => Number(x.id) === gid);
    if (!g) return;
    items.push({ s, g, info });
  });

  if (!items.length) {
    if (isWeek) return '';
    return `
      <div class="coord-exceptions-box" style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:10px 16px; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:1.15rem">✅</span>
          <span style="font-weight:700; color:#166534; font-size:0.85rem">כל הפעילויות מתקיימות כסדרן</span>
          <span style="font-size:0.75rem; color:#15803d; opacity:0.85">(אין שינויים, השלמות או ביטולים להיום)</span>
        </div>
      </div>
    `;
  }

  const typeOrder = { nohap: 1, can: 2, post: 3, advance: 4, makeup: 5, shift: 6 };
  items.sort((a,b) => {
    const ordA = typeOrder[a.info.type] || 9;
    const ordB = typeOrder[b.info.type] || 9;
    if (ordA !== ordB) return ordA - ordB;
    const dA = a.s.d || '';
    const dB = b.s.d || '';
    if (dA !== dB) return dA.localeCompare(dB);
    const tA = a.s.t || '99:99';
    const tB = b.s.t || '99:99';
    if (tA !== tB) return tA.localeCompare(tB);
    return (a.g.name||'').localeCompare(b.g.name||'', 'he');
  });

  const missedCount = items.filter(x => x.info.type === 'nohap' || x.info.type === 'can' || x.info.type === 'post').length;
  const makeupsCount = items.filter(x => x.info.type === 'makeup' || x.info.type === 'advance' || x.info.type === 'shift').length;
  const titleText = isWeek ? `שינויים והשלמות בשבוע זה (${items.length})` : `שינויים והשלמות להיום (${items.length})`;

  let cardsHtml = '';
  items.forEach(({ s, g, info }) => {
    const supBase = typeof window.supBase === 'function' ? window.supBase(s.a) : (s.a || '');
    const supAct = typeof window.supAct === 'function' ? window.supAct(s.a) : (s.act || '');
    const phone = typeof window.getSupPhone === 'function' ? window.getSupPhone(supBase) : '';
    const timeStr = typeof window.fT === 'function' ? window.fT(s.t) : (s.t || 'ללא שעה');
    const noteText = (s.nt || s.n || '').trim();
    const actDate = s.d || ds;
    
    let datePrefix = '';
    if (isWeek && s.d) {
      const itemD = _cs2d(s.d);
      datePrefix = `📅 ${_DAYS_HE[itemD.getDay()]} ${itemD.getDate()}/${itemD.getMonth()+1} · `;
    }

    let postponeDetail = '';
    if (s.pd) {
      const pdFormatted = typeof window.fD === 'function' ? window.fD(s.pd) : s.pd;
      postponeDetail = `נדחה לתאריך: ${pdFormatted}`;
    } else if (s._postFrom) {
      const pfFormatted = typeof window.fD === 'function' ? window.fD(s._postFrom) : s._postFrom;
      postponeDetail = `נדחה מתאריך: ${pfFormatted}`;
    }

    cardsHtml += `
      <div style="background:#fff; border:1px solid #e2e8f0; border-right:4px solid ${info.borderColor}; border-radius:8px; padding:10px 12px; margin-bottom:8px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:6px;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="background:${info.badgeBg}; color:${info.badgeColor}; border:1px solid ${info.badgeBorder}; border-radius:6px; padding:2px 8px; font-weight:800; font-size:0.75rem;">
              ${info.icon} ${info.label}
            </span>
            <span style="font-weight:800; font-size:0.88rem; color:#0f172a;">
              🏫 ${g.name} ${g.city ? `<span style="font-weight:600; color:#64748b; font-size:0.78rem;">(${g.city})</span>` : ''}
            </span>
            <span style="font-size:0.78rem; font-weight:700; color:#475569;">
              ${datePrefix}⏰ ${timeStr}
            </span>
          </div>
          <div>
            <button class="btn bg bsm coord-msg-btn" style="background:#25d366 !important; color:#fff !important; border:none !important; height:24px !important; line-height:24px !important; padding:0 8px !important; font-size:0.68rem !important; font-weight:700 !important; border-radius:4px !important; display:inline-flex !important; align-items:center !important; gap:2px !important; cursor:pointer;" onclick="event.stopPropagation(); window._exportPairWA([${s.g}], false, ${s.g}, '${actDate}')">📱 הודעה</button>
          </div>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:12px; font-size:0.78rem; color:#334155; line-height:1.4;">
          <div>👤 <b>ספק:</b> ${supBase} ${phone ? `<span style="color:#16a34a; font-weight:600; margin-right:4px;">(📞 ${phone})</span>` : ''}</div>
          <div>🎨 <b>פעילות:</b> ${supAct}</div>
          ${postponeDetail ? `<div style="color:#d97706; font-weight:700;">🕒 ${postponeDetail}</div>` : ''}
        </div>
        ${noteText ? `<div style="margin-top:6px; font-size:0.76rem; color:#b91c1c; background:#fff5f5; border:1px dashed #fca5a5; border-radius:6px; padding:4px 8px; font-weight:600;">📝 סיבה / הערה: ${noteText}</div>` : ''}
      </div>
    `;
  });

  return `
    <details class="coord-exceptions-accordion" open style="background:#fff; border:1.5px solid #f87171; border-radius:10px; margin-bottom:14px; overflow:hidden; box-shadow:0 3px 10px rgba(239,68,68,0.08);">
      <summary style="background:linear-gradient(135deg, #fef2f2, #fee2e2); padding:10px 14px; cursor:pointer; list-style:none; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #fecaca; user-select:none;">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span style="font-size:1.15rem">⚠️</span>
          <span style="font-weight:800; font-size:0.92rem; color:#991b1b;">${titleText}</span>
          <div style="display:flex; gap:6px;">
            ${missedCount ? `<span style="background:#fff; color:#b91c1c; border:1px solid #fca5a5; border-radius:12px; padding:2px 8px; font-size:0.72rem; font-weight:800">⚠️ ${missedCount} אי-קיום / ביטול</span>` : ''}
            ${makeupsCount ? `<span style="background:#fff; color:#15803d; border:1px solid #86efac; border-radius:12px; padding:2px 8px; font-size:0.72rem; font-weight:800">🔄 ${makeupsCount} השלמות</span>` : ''}
          </div>
        </div>
        <span style="font-size:0.72rem; color:#991b1b; font-weight:700;">▼ פתח/סגור</span>
      </summary>
      <div style="padding:10px 12px; background:#fafafa;">
        ${cardsHtml}
      </div>
    </details>
  `;
}

function _coordFallbackDay(evs, ds) {
  const cd = _cs2d(ds);
  const prevD = new Date(cd); prevD.setDate(cd.getDate() - 1);
  const nextD = new Date(cd); nextD.setDate(cd.getDate() + 1);
  const prevDayHeb = _DAYS_HE[prevD.getDay()];
  const nextDayHeb = _DAYS_HE[nextD.getDay()];
  const curDayHeb = _DAYS_HE[cd.getDay()];
  const curDateFormatted = `${cd.getDate().toString().padStart(2,'0')}/${(cd.getMonth()+1).toString().padStart(2,'0')}/${cd.getFullYear()}`;
  
  const now = new Date();
  const isToday = cd.getFullYear() === now.getFullYear() && cd.getMonth() === now.getMonth() && cd.getDate() === now.getDate();

  const dayNavBar = `
    <div class="coord-day-nav-bar" style="background:#fff;border-radius:10px;padding:9px 14px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06);display:flex;justify-content:space-between;align-items:center;border:1px solid #cbd5e1;flex-wrap:wrap;gap:8px">
      <button class="coord-nav-btn" onclick="window.coordNav(-1)" style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:6px 14px;color:#1e293b;font-weight:700;font-size:0.83rem;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:background 0.15s">
        <span>▶</span>
        <span>אתמול (${prevDayHeb})</span>
      </button>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-weight:800;font-size:0.95rem;color:#0f172a">📅 ${curDayHeb} ${curDateFormatted}</span>
        ${isToday ? '<span style="background:#dcfce7;color:#15803d;font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:12px">היום</span>' : '<button class="coord-nav-btn" onclick="window.coordGoToday()" style="background:#e0f2fe;border:1px solid #bae6fd;border-radius:6px;padding:2px 7px;font-size:0.72rem;color:#0369a1;font-weight:700;cursor:pointer">חזור להיום</button>'}
      </div>
      <button class="coord-nav-btn" onclick="window.coordNav(1)" style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:6px 14px;color:#1e293b;font-weight:700;font-size:0.83rem;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:background 0.15s">
        <span>מחר (${nextDayHeb})</span>
        <span>◀</span>
      </button>
    </div>
  `;

  const normTarget = _normDs(ds);
  const dayEvs = evs.filter(s => _normDs(s.d) === normTarget);
  if (!dayEvs.length) {
    const normDsList = Array.from(new Set(evs.map(s => _normDs(s.d)))).filter(Boolean).sort();
    const prevActDs = normDsList.filter(d => d < normTarget).pop();
    const nextActDs = normDsList.find(d => d > normTarget);
    
    let smartJumpHtml = '';
    if (nextActDs || prevActDs) {
      smartJumpHtml = '<div style="display:flex;justify-content:center;gap:10px;margin-top:14px;flex-wrap:wrap">';
      if (prevActDs) {
        const pd = _cs2d(prevActDs);
        const pDayHeb = _DAYS_HE[pd.getDay()];
        const pFormatted = `${pd.getDate().toString().padStart(2,'0')}/${(pd.getMonth()+1).toString().padStart(2,'0')}`;
        smartJumpHtml += `<button class="coord-nav-btn" onclick="window.jumpToDay('${prevActDs}')" style="background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;border-radius:8px;padding:8px 14px;font-weight:700;font-size:0.82rem;cursor:pointer;display:inline-flex;align-items:center;gap:6px"><span>▶</span><span>פעילות קודמת: ${pDayHeb} ${pFormatted}</span></button>`;
      }
      if (nextActDs) {
        const nd = _cs2d(nextActDs);
        const nDayHeb = _DAYS_HE[nd.getDay()];
        const nFormatted = `${nd.getDate().toString().padStart(2,'0')}/${(nd.getMonth()+1).toString().padStart(2,'0')}`;
        smartJumpHtml += `<button class="coord-nav-btn" onclick="window.jumpToDay('${nextActDs}')" style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-weight:700;font-size:0.82rem;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(22,163,74,0.3)"><span>פעילות הבאה: ${nDayHeb} ${nFormatted}</span><span>◀</span></button>`;
      }
      smartJumpHtml += '</div>';
    }

    return dayNavBar + `<div style="background:#fff;border-radius:10px;padding:28px 16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.05);margin:10px 0;border:1px solid #e2e8f0">
      <div style="font-size:2rem;margin-bottom:8px">📅</div>
      <div style="font-weight:700;font-size:1rem;color:#1e293b;margin-bottom:6px">אין פעילויות רשומות בתאריך ${curDateFormatted} (${curDayHeb})</div>
      <div style="font-size:0.82rem;color:#64748b;margin-bottom:12px">ניתן לעבור ליום אחר בעזרת כפתורי הניווט (אתמול / מחר) או לקפוץ ליום הפעילות הבא.</div>
      ${smartJumpHtml}
      <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:12px">
        <button class="coord-nav-btn" onclick="window.coordNav(-1)" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;border-radius:8px;padding:6px 12px;font-weight:600;font-size:0.8rem;cursor:pointer;display:inline-flex;align-items:center;gap:4px">
          <span>▶</span>
          <span>עבור לאתמול (${prevDayHeb})</span>
        </button>
        ${!isToday ? `<button class="coord-nav-btn" onclick="window.coordGoToday()" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;border-radius:8px;padding:6px 12px;font-weight:600;font-size:0.8rem;cursor:pointer">📅 חזור להיום</button>` : ''}
        <button class="coord-nav-btn" onclick="window.coordNav(1)" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;border-radius:8px;padding:6px 12px;font-weight:600;font-size:0.8rem;cursor:pointer;display:inline-flex;align-items:center;gap:4px">
          <span>עבור למחר (${nextDayHeb})</span>
          <span>◀</span>
        </button>
      </div>
    </div>`;
  }
  return dayNavBar + _coordRenderExceptionsBox(dayEvs, ds, false) + _coordRenderByCity(dayEvs, ds);
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

  const weekExceptionsBox = _coordRenderExceptionsBox(evs, '', true);
  return weekExceptionsBox + daysHtml;
}

function _coordFallbackMonth(evs, cd) {
  const curY = cd.getFullYear();
  const curM = cd.getMonth(); // 0-11
  const monthEvs = evs.filter(s => {
    const sd = _normDs(s.d);
    if (!sd) return false;
    const d = _cs2d(sd);
    return d.getFullYear() === curY && d.getMonth() === curM;
  });

  const byDate = {};
  monthEvs.forEach(s => {
    const sd = _normDs(s.d);
    if (!byDate[sd]) byDate[sd] = [];
    byDate[sd].push(s);
  });

  const sortedDates = Object.keys(byDate).sort();

  if (!sortedDates.length) {
    return `<div style="background:#fff;border-radius:10px;padding:28px 16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.05);margin:10px 0;border:1px solid #e2e8f0">
      <div style="font-size:2rem;margin-bottom:8px">📅</div>
      <div style="font-weight:700;font-size:1rem;color:#1e293b;margin-bottom:6px">אין פעילויות בחודש ${_MONTHS_HE[curM]} ${curY}</div>
      <div style="font-size:0.82rem;color:#64748b;margin-bottom:14px">ניתן להשתמש בחצים (חודש קודם / חודש הבא) על מנת לעבור לחודשים אחרים.</div>
      <div style="display:flex;justify-content:center;gap:10px">
        <button class="coord-nav-btn" onclick="window.coordNav(-1)" style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:6px 14px;color:#334155;font-weight:700;font-size:0.82rem;cursor:pointer">▶ חודש קודם</button>
        <button class="coord-nav-btn" onclick="window.coordGoToday()" style="background:#e0f2fe;border:1px solid #bae6fd;border-radius:8px;padding:6px 14px;color:#0369a1;font-weight:700;font-size:0.82rem;cursor:pointer">חזור להיום</button>
        <button class="coord-nav-btn" onclick="window.coordNav(1)" style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:6px 14px;color:#334155;font-weight:700;font-size:0.82rem;cursor:pointer">חודש הבא ◀</button>
      </div>
    </div>`;
  }

  return sortedDates.map(ds => {
    const d = _cs2d(ds);
    const dayHeb = _DAYS_HE[d.getDay()];
    const dStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    const dayEvs = byDate[ds];
    return `<div style="margin-bottom:14px;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);border:1px solid #e2e8f0">
      <div style="background:linear-gradient(135deg,#1a5276,#154360);color:#fff;padding:8px 14px;font-weight:700;font-size:0.88rem;display:flex;justify-content:space-between;align-items:center">
        <span>📅 ${dayHeb} ${dStr}</span>
        <span style="font-size:0.75rem;background:rgba(255,255,255,0.22);padding:2px 10px;border-radius:12px;font-weight:800">${dayEvs.length} פעילויות</span>
      </div>
      <div style="padding:10px 8px">${_coordRenderByCity(dayEvs, ds)}</div>
    </div>`;
  }).join('');
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

  // Update summary count subbar
  const countEl = document.getElementById('coord-summary-count');
  if (countEl) {
    const isSearch = !!window._coordSearchQuery;
    countEl.textContent = isSearch 
      ? `🔍 נמצאו ${evs.length} פעילויות עבור "${window._coordSearchQuery}"` 
      : `סה"כ ${evs.length} פעילויות ב-${Object.keys(byCity).length} ערים`;
  }

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
      const curY = window.CURRENT_YEAR || 'tashpaz';
      if (curY !== 'tashpav' && prs.some(p => (p.ids||[]).includes(9) && (p.ids||[]).includes(21))) {
        if (window._fbAppData && window._fbAppData.pairs) {
          const raw = window._fbAppData.pairs;
          prs = (Array.isArray(raw) ? raw : Object.values(raw)).map(p => ({
            ...p,
            ids: (p.ids || []).map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0)
          })).filter(p => p.ids.length >= 2);
          window.pairs = prs;
        }
      }
      groupSource = (prs || []).map(p => ({
        id: p.id,
        name: p.name || (p.ids || []).map(id => (window.G(id)||{}).name || '').filter(Boolean).join(' + '),
        ids: (p.ids || []).map(Number)
      }));
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
    const isManagerRole = window.role === 'manager' || window.role === 'vp' || window.permAllCities;
    const isSearching = !!(window._coordSearchQuery && window._coordSearchQuery.length > 0);
    const shouldOpenCity = isSearching || !isManagerRole;

    let html = `<details class="city-accordion" ${shouldOpenCity ? 'open' : ''} style="margin-bottom:12px">
      <summary style="background:${clr.solid};color:#fff;padding:8px 12px;font-weight:800;border-radius:6px;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center">
        <span style="display:flex;align-items:center;gap:6px">
          <span class="city-chevron">▼</span>
          <span>📍 ${city} (${cityEvs.length} פעילויות)</span>
        </span>
        <span style="font-size:0.75rem;opacity:0.85;background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:10px">${pairBlocks.length} ${modeLabel}</span>
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
          defaultOpen: isSearching
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
          defaultOpen: isSearching
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
    window.loadFromFirebase(false, true).then(async () => {
      if (typeof window._coordEnsureYearPairs === 'function') {
        await window._coordEnsureYearPairs();
      }
      _coordBuildGardenFilter();
      window.renderCoordinatorView();
      _coordToast('✅ נתונים עודכנו');
    }).catch(() => location.reload());
  } else {
    location.reload();
  }
};

window.coordLogout = function() {
  try {
    localStorage.removeItem('gan_app_mode');
    localStorage.removeItem('gan_user_role');
    document.documentElement.classList.remove('isolated-mode');
  } catch(e) {}
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

// ── Date Picker Navigation ──
window.coordTriggerDatePicker = function() {
  const inp = document.getElementById('coord-hidden-datepicker');
  if (!inp) return;
  if (window._coordCurrentDate) {
    inp.value = _cd2s(window._coordCurrentDate);
  }
  if (typeof inp.showPicker === 'function') {
    try { inp.showPicker(); return; } catch(e) {}
  }
  inp.click();
};

window.coordOnPickDate = function(val) {
  if (!val) return;
  window._coordCurrentDate = _cs2d(val);
  window.renderCoordinatorView();
};

// ─────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────
window.initCoordinatorApp();
