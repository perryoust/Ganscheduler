// grid_export.js — ייצוא גריד שבועי / יומי (Excel, PDF להדפסה, תמונת JPG והעתקה לוואטסאפ)

(function () {
  'use strict';

  function _esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Mandatory Bidi/RTL text isolation for html2canvas rendering (per AGENTS.md)
  function _rtlFix(str) {
    if (!str) return '';
    let escaped = String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    escaped = escaped.replace(/([\u0590-\u05FF])(מע"מ|מעמ|בע"מ|בעמ)/g, '$1 $2');
    escaped = escaped.replace(/([\u0590-\u05FF]+['".,:;)(]+)(\s|$)/g, '$1&rlm;$2');
    escaped = escaped.replace(/\n/g, ' <br> ');

    const tokens = escaped.split(' ');
    const fixedTokens = tokens.map(token => {
      if (!token.includes('&') && !token.includes('<') && !token.includes('>')) {
        if (/[a-zA-Z0-9]/.test(token) && /^[a-zA-Z0-9\-_.,:;/'"()]+$/.test(token)) {
          return `<span style="display:inline-block;direction:ltr;">${token}</span>`;
        }
      }
      return token;
    });

    return fixedTokens
      .join('___SPACE___')
      .replace(/___SPACE___<br>___SPACE___/g, '<br>')
      .replace(/___SPACE___/g, '<span style="display:inline-block; width:0.25em;"> </span>');
  }

  function _resolveSupplierAlias(nameOrFull) {
    if (!nameOrFull) return '';
    if (typeof window._getSupplierAliasOrName === 'function') {
      return window._getSupplierAliasOrName(nameOrFull);
    }
    const raw = String(nameOrFull).trim();
    const base = typeof window.supBase === 'function' ? window.supBase(raw) : raw;
    const ex = (window.supEx && (window.supEx[base] || window.supEx[raw])) || {};
    if (ex && ex.alias && ex.alias.trim()) return ex.alias.trim();
    if (typeof window.supDisplayName === 'function') {
      const d = window.supDisplayName(raw);
      if (d && d.trim()) return d.trim();
    }
    return base || raw;
  }

  function _isSchoolGarden(g) {
    return typeof window.isSchoolGarden === 'function' ? window.isSchoolGarden(g) : false;
  }

  function _getGardenPhone(g) {
    return typeof window.getGardenPhone === 'function' ? window.getGardenPhone(g) : '';
  }

  function _getCoordinatorLabel(gid) {
    if (window.WAExport && typeof window.WAExport.getCoordinatorLabel === 'function') {
      return window.WAExport.getCoordinatorLabel(gid);
    }
    if (typeof window.getGardenCoordinator === 'function') {
      const ci = window.getGardenCoordinator(gid);
      if (ci && ci.name) return ci.phone ? `${ci.name} (${ci.phone})` : ci.name;
    }
    const numId = Number(gid);
    const mgr = Object.values(window.managers || {}).find(
      m => m && m.role !== 'manager' && m.role !== 'vp' && Array.isArray(m.gardenIds) && m.gardenIds.map(Number).includes(numId)
    );
    if (mgr && mgr.name) return mgr.phone ? `${mgr.name} (${mgr.phone})` : mgr.name;
    return '';
  }

  function _getAllActiveGardens() {
    const raw = typeof window.AG === 'function'
      ? window.AG()
      : (typeof window.getAllGardens === 'function' ? window.getAllGardens() : (window.GARDENS || []));
    const map = new Map();
    (raw || []).forEach(g => {
      if (!g || g.id == null || g.active === false || g.isClosed) return;
      map.set(Number(g.id), g);
    });
    return Array.from(map.values());
  }

  // Resolve exact dates currently open on the Calendar table
  function _getOpenCalendarDates() {
    const baseD = (window.calD instanceof Date && !isNaN(window.calD)) ? new Date(window.calD) : new Date();
    baseD.setHours(0, 0, 0, 0);

    const viewSelEl = (window.isMobileMode && window.isMobileMode())
      ? (document.getElementById('cal-view-select-mobile') || document.getElementById('cal-view-select-desktop'))
      : (document.getElementById('cal-view-select-desktop') || document.getElementById('cal-view-select-mobile'));
    const viewVal = viewSelEl ? viewSelEl.value : '';
    const vMode = window.calV || '';

    // 1. Range view
    if (vMode === 'range') {
      const rf = document.getElementById('cal-range-from')?.value || window.d2s(baseD);
      const rt = document.getElementById('cal-range-to')?.value || rf;
      const fromDs = rf <= rt ? rf : rt;
      const toDs = rf <= rt ? rt : rf;
      return { fromDs, toDs, mode: fromDs === toDs ? 'day' : 'range', label: `${window.fD(fromDs)} – ${window.fD(toDs)}` };
    }

    // 2. Daily views (day-grid or day-list)
    if (viewVal === 'day-grid' || viewVal === 'day-list' || vMode === 'day') {
      const ds = window.d2s(baseD);
      return { fromDs: ds, toDs: ds, mode: 'day', label: `יומי (${window.fD(ds)})` };
    }

    // 3. Month-table with checked date filters
    if (viewVal === 'month-table' || vMode === 'month-table') {
      const checkedDates = Array.from(document.querySelectorAll('.mtf-date-cb:checked'))
        .map(cb => cb.value)
        .map(v => {
          const parts = String(v).split('/');
          if (parts.length === 3) {
            const yr = parts[2].length === 2 ? '20' + parts[2] : parts[2];
            return `${yr}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
          }
          return '';
        })
        .filter(Boolean)
        .sort();
      if (checkedDates.length > 0) {
        const fromDs = checkedDates[0];
        const toDs = checkedDates[checkedDates.length - 1];
        return { fromDs, toDs, mode: fromDs === toDs ? 'day' : 'week', label: `${window.fD(fromDs)}${fromDs !== toDs ? ' – ' + window.fD(toDs) : ''}` };
      }
    }

    // 4. Weekly views (week-grid / week-list) & fallback: 5 working days from calD (exact match to renderCal)
    const ws = new Date(baseD);
    ws.setHours(0, 0, 0, 0);
    if (ws.getDay() === 5) ws.setDate(ws.getDate() + 2);
    else if (ws.getDay() === 6) ws.setDate(ws.getDate() + 1);
    const days = typeof window.getNextWorkDays === 'function'
      ? window.getNextWorkDays(ws, 5)
      : [0, 1, 2, 3, 4].map(n => window.addD(ws, n));
    const fromDs = window.d2s(days[0]);
    const toDs = window.d2s(days[days.length - 1]);
    return { fromDs, toDs, mode: 'week', label: `${window.fD(fromDs)} – ${window.fD(toDs)}` };
  }

  // Scan nearby dates for contiguous camp/holiday ranges (e.g., קייטנת חנוכה, קייטנת פסח)
  function _detectNearbyHolidayRanges(anchorFromDs, cityHint) {
    if (typeof window.getHolidayInfo !== 'function' || !anchorFromDs) return [];
    const anchor = window.s2d(anchorFromDs);
    const startScan = window.addD(anchor, -12);
    const ranges = [];
    let current = null;

    for (let i = 0; i <= 34; i++) {
      const d = window.addD(startScan, i);
      const dow = d.getDay();
      const ds = window.d2s(d);
      const hol = window.getHolidayInfo(ds, cityHint || null, null);
      if (hol && hol.name) {
        const cleanName = typeof window.cleanHolName === 'function' ? window.cleanHolName(hol.name) : hol.name.trim();
        if (current && current.name === cleanName) {
          current.toDs = ds;
        } else {
          if (current) ranges.push(current);
          current = {
            name: cleanName,
            rawName: hol.name,
            emoji: hol.emoji || '🟣',
            fromDs: ds,
            toDs: ds
          };
        }
      } else if (current && (dow === 5 || dow === 6)) {
        // Keep bridging over Fri/Sat weekend if the same camp continues on Sunday
      } else if (current) {
        ranges.push(current);
        current = null;
      }
    }
    if (current) ranges.push(current);
    return ranges;
  }

  // Inspect what cities / clusters / filters are currently open in the Calendar UI
  function _getOpenTableViewState() {
    if (typeof window._loadCalState === 'function') window._loadCalState();
    const f = typeof window.getCalF === 'function' ? window.getCalF() : {
      gids: typeof window.getCalGids === 'function' ? (window.getCalGids().length ? window.getCalGids() : null) : null,
      cities: typeof window.getCalCity === 'function' ? window.getCalCity() : [],
      cls: window.getEl ? (window.getEl('cal-cls')?.value || '') : '',
      clusters: typeof window.getCalCl === 'function' ? window.getCalCl() : [],
      sups: typeof window.getCalSup === 'function' ? window.getCalSup() : []
    };

    const openCities = [];
    const calBody = document.getElementById('cal-body');
    if (calBody && window.calV === 'week') {
      const hdrs = calBody.querySelectorAll('tr.city-header-row');
      hdrs.forEach(hdr => {
        const onclickAttr = hdr.getAttribute('onclick') || '';
        const m = onclickAttr.match(/toggleTableCity\('([^']+)'\)/);
        if (!m) return;
        const cityId = m[1];
        const rows = calBody.querySelectorAll(`.city-row-${cityId}`);
        const isVisible = Array.from(rows).some(r => r.style.display !== 'none');
        if (isVisible) {
          let cName = hdr.dataset.city || '';
          if (!cName) {
            const cityTextSpan = hdr.querySelector('span');
            if (cityTextSpan) {
              const rawTxt = cityTextSpan.childNodes[0] ? cityTextSpan.childNodes[0].textContent : '';
              cName = rawTxt.replace('🏙️', '').trim();
            }
          }
          if (cName) openCities.push({ city: cName, cityId });
        }
      });
    } else if (calBody) {
      const accordions = Array.from(calBody.querySelectorAll('details.city-accordion'));
      if (accordions.length > 1) {
        const openAccs = accordions.filter(acc => acc.open);
        if (openAccs.length > 0 && openAccs.length < accordions.length) {
          openAccs.forEach(acc => {
            const cName = acc.dataset.city || '';
            if (cName) openCities.push({ city: cName, cityId: 'city-' + cName.replace(/\s+/g, '-') });
          });
        }
      }
    }

    const hasExplicitFilter = !!(
      (f.gids && f.gids.length > 0) ||
      (f.cities && f.cities.length > 0) ||
      (f.clusters && f.clusters.length > 0) ||
      (f.sups && f.sups.length > 0)
    );

    return {
      calFilter: f,
      openCities,
      hasOpenCities: openCities.length > 0,
      hasExplicitFilter,
      groupMode: window._listGroupMode === 'clusters' ? 'clusters' : 'pairs'
    };
  }

  function _buildDaysArray(fromDs, toDs, includeFriday) {
    if (!fromDs || !toDs) return [];
    const start = window.s2d(fromDs <= toDs ? fromDs : toDs);
    const end = window.s2d(fromDs <= toDs ? toDs : fromDs);
    const isSingle = fromDs === toDs;
    const days = [];
    let cur = new Date(start);
    let guard = 0;
    while (cur <= end && guard < 45) {
      const dow = cur.getDay();
      if (isSingle) {
        days.push(window.d2s(cur));
      } else if (dow !== 6 && (dow !== 5 || includeFriday)) {
        days.push(window.d2s(cur));
      }
      cur = window.addD(cur, 1);
      guard++;
    }
    return days;
  }

  let _activeTab = 'grid'; // 'grid' | 'instructors' | 'gaps'

  function _ensureModalDOM() {
    let modal = document.getElementById('grid-export-m');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'grid-export-m';
    modal.className = 'modal';
    modal.style.zIndex = '10020';
    modal.innerHTML = `
      <div class="mb" style="max-width:900px; width:96%; padding:0; border-radius:14px; overflow:hidden; box-shadow:0 18px 50px rgba(15,23,42,0.3);">
        <!-- Top Header -->
        <div style="background:linear-gradient(135deg, #1a237e 0%, #3949ab 100%); color:#fff; padding:12px 20px; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span id="gexp-hdr-icon" style="font-size:1.3rem;">▦</span>
            <div>
              <h3 id="gexp-hdr-title" style="margin:0; font-size:1.05rem; font-weight:800; color:#fff;">מרכז ייצוא גריד והיערכות מדריכים</h3>
              <div id="gexp-open-hint" style="font-size:0.73rem; opacity:0.88; margin-top:1px;">טבלת שיבוצים, מדריכים לספקים ובקרת שלמות אשכולות</div>
            </div>
          </div>
          <button onclick="window.CM('grid-export-m')" style="background:rgba(255,255,255,0.18); border:none; color:#fff; width:30px; height:30px; border-radius:50%; cursor:pointer; font-size:1rem; font-weight:700;">✕</button>
        </div>

        <!-- Clean 3-Tab Navigation -->
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; background:#eef2ff; border-bottom:1px solid #c7d2fe; direction:rtl;">
          <button type="button" id="gexp-tab-btn-grid" onclick="window.setGridExportTab('grid')" style="padding:10px 10px; border:none; border-bottom:3px solid #1a237e; background:#ffffff; color:#1a237e; font-weight:800; font-size:0.84rem; cursor:pointer; transition:all 0.15s;">
            ▦ גריד שיבוצים (יומי / שבועי)
          </button>
          <button type="button" id="gexp-tab-btn-instructors" onclick="window.setGridExportTab('instructors')" style="padding:10px 10px; border:none; border-bottom:3px solid transparent; background:transparent; color:#475569; font-weight:800; font-size:0.84rem; cursor:pointer; transition:all 0.15s;">
            🧑‍🏫 מדריכים לספקים ועומסים
          </button>
          <button type="button" id="gexp-tab-btn-gaps" onclick="window.setGridExportTab('gaps')" style="padding:10px 10px; border:none; border-bottom:3px solid transparent; background:transparent; color:#475569; font-weight:800; font-size:0.84rem; cursor:pointer; transition:all 0.15s; display:inline-flex; align-items:center; justify-content:center; gap:5px;">
            <span>🔍 בקרת אשכולות וחוסרים</span>
            <span id="gexp-gaps-badge"></span>
          </button>
        </div>

        <!-- Compact Pinned Date Strip (Shared across all 3 tabs) -->
        <div style="background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:9px 18px; direction:rtl;">
          <div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px;">
            <span style="font-weight:800; color:#1e293b; font-size:0.82rem;">📅 תאריכים:</span>
            <input type="date" id="gexp-from" onchange="window.onGridExpDateChange('from')" style="padding:4px 8px; border:1px solid #94a3b8; border-radius:6px; font-size:0.82rem; font-weight:700; background:#fff;">
            <span style="font-size:0.78rem; color:#64748b; font-weight:700;">עד</span>
            <input type="date" id="gexp-to" onchange="window.onGridExpDateChange('to')" style="padding:4px 8px; border:1px solid #94a3b8; border-radius:6px; font-size:0.82rem; font-weight:700; background:#fff;">
            <label style="display:inline-flex; align-items:center; gap:5px; font-size:0.76rem; color:#334155; font-weight:600; cursor:pointer; margin-right:4px;">
              <input type="checkbox" id="gexp-inc-fri" onchange="window.updateGridExportSummary()">
              <span>כלול שישי</span>
            </label>
            <span id="gexp-days-badge" style="margin-right:auto; background:#e0e7ff; color:#1e40af; font-weight:800; font-size:0.74rem; padding:2px 10px; border-radius:999px;">5 ימי פעילות</span>
          </div>
          <div id="gexp-date-presets" style="display:flex; flex-wrap:wrap; gap:5px; align-items:center; margin-top:6px;"></div>
        </div>

        <!-- Tab Panes Body -->
        <div style="padding:14px 18px; max-height:64vh; overflow-y:auto; direction:rtl;">
          <!-- ═══ TAB 1: GARDEN / CLUSTER MATRIX GRID ═══ -->
          <div id="gexp-pane-grid">
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; margin-bottom:12px;">
              <div style="display:grid; grid-template-columns:1.25fr 1fr; gap:12px; margin-bottom:10px;">
                <div>
                  <label style="display:block; font-weight:800; color:#1e293b; font-size:0.83rem; margin-bottom:4px;">🎯 אילו גנים / ערים לייצא?</label>
                  <select id="gexp-scope" onchange="window.onGridExpScopeChange()" style="width:100%; padding:7px 10px; border:1px solid #94a3b8; border-radius:7px; font-size:0.83rem; font-weight:700; color:#1e293b; background:#fff;">
                    <option value="open">🖥️ מה שפתוח / מסונן כרגע בטבלה</option>
                    <option value="city">🏙️ בחירת עיר / כל הערים</option>
                  </select>
                </div>
                <div>
                  <label style="display:block; font-weight:800; color:#1e293b; font-size:0.83rem; margin-bottom:4px;">📦 חלוקת שורות בטבלה:</label>
                  <select id="gexp-group-mode" onchange="window.onGridExpGroupModeChange()" style="width:100%; padding:7px 10px; border:1px solid #94a3b8; border-radius:7px; font-size:0.83rem; font-weight:700; color:#1e293b; background:#fff;">
                    <option value="clusters">📦 לפי אשכולות (מפורט לפי גנים)</option>
                    <option value="cluster_matrix">🏢 מרוכז לפי אשכולות (מס' מדריכים ליום)</option>
                    <option value="pairs">⚖️ לפי זוגות</option>
                    <option value="flat">📋 רשימה לפי עיר (ללא קבוצות)</option>
                  </select>
                </div>
              </div>

              <!-- City & Clusters Picker (shown when scope === 'city') -->
              <div id="gexp-city-panel" style="display:none; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px; padding:10px; margin-bottom:8px;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:8px;">
                  <div>
                    <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">עיר:</label>
                    <select id="gexp-city" onchange="window.onGridExpCityChange()" style="width:100%; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.83rem; background:#fff;"></select>
                  </div>
                  <div>
                    <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">סוג מוסדות:</label>
                    <select id="gexp-cls" onchange="window.onGridExpCityChange()" style="width:100%; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.83rem; background:#fff;">
                      <option value="gan">🏡 גני ילדים בלבד</option>
                      <option value="sch">🏫 בתי ספר בלבד</option>
                      <option value="all">הכל (גנים + בתי ספר)</option>
                    </select>
                  </div>
                </div>
                <div id="gexp-clusters-wrap" style="display:none;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span id="gexp-clusters-lbl" style="font-size:0.75rem; font-weight:700; color:#334155;">סינון אשכולות בעיר:</span>
                    <div style="display:flex; gap:8px;">
                      <button type="button" onclick="window.toggleAllGridExpClusters(true)" style="background:none; border:none; color:#1d4ed8; font-size:0.73rem; font-weight:700; cursor:pointer; padding:0;">בחר הכל</button>
                      <button type="button" onclick="window.toggleAllGridExpClusters(false)" style="background:none; border:none; color:#dc2626; font-size:0.73rem; font-weight:700; cursor:pointer; padding:0;">נקה</button>
                    </div>
                  </div>
                  <div id="gexp-clusters-list" style="display:flex; flex-wrap:wrap; gap:6px; max-height:110px; overflow-y:auto; padding:4px; background:#fff; border:1px solid #e2e8f0; border-radius:6px;"></div>
                </div>
              </div>

              <!-- Dedicated WhatsApp Message Options Box (Matching Regular Export) -->
              <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:8px 12px; margin-top:8px; margin-bottom:8px;">
                <div style="font-size:0.77rem; font-weight:800; color:#166534; margin-bottom:6px; display:flex; align-items:center; gap:5px;">
                  <span>📱 אפשרויות להודעת וואטסאפ (בדיוק כמו בהודעה רגילה):</span>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; font-size:0.79rem; font-weight:600; color:#1e293b;">
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="gexp-inc-cluster" checked onchange="if(window.syncExportClusterCheckboxes) window.syncExportClusterCheckboxes(this.checked); window.updateGridExportSummary();">
                    <span>כלול זוג / אשכול גנים</span>
                  </label>
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="gexp-inc-garden-meta" onchange="if(window.syncExportCoordCheckboxes) window.syncExportCoordCheckboxes(this.checked); window.updateGridExportSummary();">
                    <span>הוסף שם וטלפון רכז להודעה</span>
                  </label>
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="gexp-inc-age" onchange="if(window.syncExportAgeCheckboxes) window.syncExportAgeCheckboxes(this.checked); window.updateGridExportSummary();">
                    <span>הוסף גיל ילדים להודעה (👶)</span>
                  </label>
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="gexp-inc-addr" checked onchange="if(window.syncExportAddrCheckboxes) window.syncExportAddrCheckboxes(this.checked); window.updateGridExportSummary();">
                    <span>הצג כתובת גן ומתחם (📍)</span>
                  </label>
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="gexp-inc-free-days" onchange="if(window.syncExportFreeDaysCheckboxes) window.syncExportFreeDaysCheckboxes(this.checked); window.updateGridExportSummary();">
                    <span>הוסף ימים פנויים להשלמה</span>
                  </label>
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="gexp-split-msg" onchange="if(window.syncExportSplitCheckboxes) window.syncExportSplitCheckboxes(this.checked); window.updateGridExportSummary();">
                    <span>פיצול - הודעה נפרדת לכל גן</span>
                  </label>
                </div>
              </div>

              <!-- General Table & Print Options -->
              <div style="display:flex; flex-wrap:wrap; gap:12px; font-size:0.77rem; color:#475569; padding-top:2px;">
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                  <input type="checkbox" id="gexp-inc-sup-phone" onchange="window.updateGridExportSummary()">
                  <span>הצג טלפון ספק בתא</span>
                </label>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                  <input type="checkbox" id="gexp-inc-empty-gardens" onchange="window.updateGridExportSummary()">
                  <span>הצג גם גנים ללא שיבוץ בטווח</span>
                </label>
                <label id="gexp-split-sheets-wrap" style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                  <input type="checkbox" id="gexp-split-sheets" checked>
                  <span>אקסל: גיליון נפרד לכל עיר</span>
                </label>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                  <input type="checkbox" id="gexp-bw-mode">
                  <span>PDF/תמונה: מצב שחור-לבן (חיסכון בדיו)</span>
                </label>
              </div>
            </div>

            <div style="margin-bottom:10px;">
              <label style="display:block; font-size:0.77rem; font-weight:700; color:#475569; margin-bottom:3px;">✏️ כותרת הטבלה בייצוא (מתעדכנת אוטומטית, ניתן לערוך):</label>
              <input type="text" id="gexp-title" oninput="this.dataset.userEdited='1'" style="width:100%; padding:7px 10px; border:1px solid #cbd5e1; border-radius:7px; font-size:0.85rem; font-weight:700; color:#1e293b; box-sizing:border-box;">
            </div>

            <div id="gexp-summary-box" style="background:#eef2ff; border:1px solid #c7d2fe; color:#1e3a8a; border-radius:8px; padding:8px 12px; font-size:0.8rem; font-weight:700; line-height:1.4;"></div>
          </div>

          <!-- ═══ TAB 2: INSTRUCTORS PER DAY & SUPPLIER LOAD CONTROL ═══ -->
          <div id="gexp-pane-instructors" style="display:none;">
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:10px 14px; margin-bottom:9px;">
              <div style="display:grid; grid-template-columns:1.5fr 1fr 1fr; gap:10px; margin-bottom:7px;">
                <div>
                  <label style="display:block; font-size:0.75rem; font-weight:800; color:#1e293b; margin-bottom:3px;">🎯 ספק (לייצוא או בקרת כלל הספקים):</label>
                  <select id="gexp-inst-sup" onchange="window.onInstFilterChange()" style="width:100%; padding:6px 9px; border:1.5px solid #6366f1; border-radius:7px; font-size:0.82rem; font-weight:700; color:#1e293b; background:#fff;"></select>
                </div>
                <div>
                  <label style="display:block; font-size:0.75rem; font-weight:800; color:#1e293b; margin-bottom:3px;">🏙️ סינון עיר:</label>
                  <select id="gexp-inst-city" onchange="window.onInstCityChange(this.value)" style="width:100%; padding:6px 9px; border:1px solid #cbd5e1; border-radius:7px; font-size:0.82rem; font-weight:600; background:#fff;"></select>
                </div>
                <div id="gexp-inst-status-wrap">
                  <label style="display:block; font-size:0.75rem; font-weight:800; color:#1e293b; margin-bottom:3px;">⚖️ סינון עומס / חוסרים:</label>
                  <select id="gexp-inst-status" onchange="window.onInstFilterChange(true)" style="width:100%; padding:6px 9px; border:1px solid #cbd5e1; border-radius:7px; font-size:0.81rem; font-weight:700; background:#fff;">
                    <option value="all">📋 כל הספקים (כולל 0 שיבוצים)</option>
                    <option value="active">🟢 ספקים עם שיבוץ בלבד</option>
                    <option value="zero">🔴 ללא שיבוץ כלל (0)</option>
                    <option value="low">🟡 מעט שיבוצים (1–2 ימי מדריך)</option>
                    <option value="high">🔥 עומס גבוה (3+ מדריכים ביום)</option>
                  </select>
                </div>
              </div>
              <!-- General Instructors Table Options -->
              <div style="display:flex; flex-wrap:wrap; gap:14px; font-size:0.77rem; color:#334155; padding-top:4px; border-top:1px dashed #e2e8f0;">
                <label style="display:inline-flex; align-items:center; gap:5px; cursor:pointer;">
                  <input type="checkbox" id="gexp-inst-inc-daily-tot" checked onchange="window.onInstFilterChange(true)">
                  <span>הצג סיכום סה"כ מדריכים ליום (כל הערים יחד)</span>
                </label>
                <label style="display:inline-flex; align-items:center; gap:5px; cursor:pointer;">
                  <input type="checkbox" id="gexp-inst-inc-units" onchange="window.onInstFilterChange(true)">
                  <span>הצג פירוט שמות אשכולות / בתי ספר בסוגריים</span>
                </label>
              </div>

              <!-- Dedicated WhatsApp Message & Full Schedule Options Box (Matching Regular Export) -->
              <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:8px 12px; margin-top:8px;">
                <div style="font-size:0.77rem; font-weight:800; color:#166534; margin-bottom:6px; display:flex; align-items:center; gap:5px;">
                  <span>📱 אפשרויות להודעת וואטסאפ ולו"ז מלא (בדיוק כמו בהודעה רגילה):</span>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; font-size:0.79rem; font-weight:600; color:#1e293b;">
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="gexp-inst-inc-cluster" checked onchange="if(window.syncExportClusterCheckboxes) window.syncExportClusterCheckboxes(this.checked); window.onInstFilterChange(true);">
                    <span>כלול זוג / אשכול גנים</span>
                  </label>
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="gexp-inst-inc-coord" onchange="if(window.syncExportCoordCheckboxes) window.syncExportCoordCheckboxes(this.checked); window.onInstFilterChange(true);">
                    <span>הוסף שם וטלפון רכז להודעה</span>
                  </label>
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="gexp-inst-inc-age" onchange="if(window.syncExportAgeCheckboxes) window.syncExportAgeCheckboxes(this.checked); window.onInstFilterChange(true);">
                    <span>הוסף גיל ילדים להודעה (👶)</span>
                  </label>
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="gexp-inst-inc-addr" checked onchange="if(window.syncExportAddrCheckboxes) window.syncExportAddrCheckboxes(this.checked); window.onInstFilterChange(true);">
                    <span>הצג כתובת גן ומתחם (📍)</span>
                  </label>
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="gexp-inst-inc-free-days" onchange="if(window.syncExportFreeDaysCheckboxes) window.syncExportFreeDaysCheckboxes(this.checked); window.onInstFilterChange(true);">
                    <span>הוסף ימים פנויים להשלמה</span>
                  </label>
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="gexp-inst-split-msg" onchange="if(window.syncExportSplitCheckboxes) window.syncExportSplitCheckboxes(this.checked); window.onInstFilterChange(true);">
                    <span>פיצול - הודעה נפרדת לכל גן</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Compact 1-Line Callout (only shown if unclustered or missed cluster gardens exist) -->
            <div id="gexp-inst-gap-banner" style="display:none; margin-bottom:9px;"></div>

            <!-- Spacious Live Preview: Per-Supplier Schedule OR All-Suppliers Balance Table -->
            <div id="gexp-inst-preview"></div>
          </div>

          <!-- ═══ TAB 3: CLUSTER COMPLETENESS & UNCLUSTERED GARDENS CONTROL ═══ -->
          <div id="gexp-pane-gaps" style="display:none;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:9px 14px; margin-bottom:10px;">
              <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:200px;">
                <label style="font-size:0.8rem; font-weight:800; color:#1e293b; white-space:nowrap;">🏙️ סינון עיר לבקרה:</label>
                <select id="gexp-gaps-city" onchange="window.onInstCityChange(this.value)" style="padding:5px 10px; border:1px solid #cbd5e1; border-radius:7px; font-size:0.82rem; font-weight:700; background:#fff; min-width:170px;"></select>
              </div>
              <button type="button" onclick="window.instOpenClustersMgmt()" style="background:#eef2ff; border:1px solid #a5b4fc; color:#1e3a8a; border-radius:7px; padding:6px 12px; font-size:0.78rem; font-weight:800; cursor:pointer;">🔗 פתיחת מסך ניהול אשכולות</button>
            </div>
            <div id="gexp-gaps-body"></div>
          </div>
        </div>

        <!-- Footer Export Actions (Tab 1: Grid) -->
        <div id="gexp-footer-grid" style="background:#f8fafc; border-top:1px solid #e2e8f0; padding:11px 18px; display:flex; flex-wrap:wrap; gap:8px; justify-content:space-between; align-items:center; direction:rtl;">
          <div style="display:flex; flex-wrap:wrap; gap:7px; flex:1;">
            <button type="button" class="btn bg" data-tip="העתק הודעת טקסט מפורטת לוואטסאפ של כל הלו״ז המלא בטווח ובסינון שנבחרו" onclick="window.doGridExportWhatsAppText()" style="background:#0d9488; border-color:#0f766e; color:#fff; font-weight:800; padding:7px 12px; font-size:0.81rem;">📲 העתק לו"ז מלא בהודעה</button>
            <button type="button" class="btn bg" data-tip="הורד דוח שבועי מרוכז של אשכולות ומדריכים (בדיוק כמו בתמונה: מס' מדריכים ליום)" onclick="window.doClusterMatrixExportExcel()" style="background:#0284c7; border-color:#0369a1; color:#fff; font-weight:800; padding:7px 12px; font-size:0.81rem;">📑 מס' מדריכים (אשכולות)</button>
            <button type="button" class="btn bg" data-tip="הורד קובץ אקסל מעוצב (RTL) של טבלת השיבוצים בטווח שנבחר" onclick="window.doGridExportExcel()" style="background:#15803d; border-color:#166534; color:#fff; font-weight:800; padding:7px 12px; font-size:0.81rem;">📊 אקסל (Excel)</button>
            <button type="button" class="btn bp" data-tip="פתח תצוגת הדפסה ושמירה ל-PDF מותאמת לרוחב עמוד A4" onclick="window.doGridExportPDF()" style="background:#1d4ed8; border-color:#1e40af; color:#fff; font-weight:800; padding:7px 12px; font-size:0.81rem;">🖨️ PDF / הדפסה</button>
            <button type="button" class="btn bo" data-tip="הורד את טבלת השיבוצים כתמונת JPG (או קובץ ZIP למספר ערים)" onclick="window.doGridExportImage('download')" style="background:#fdf2f8; border:1px solid #f472b6; color:#9d174d; font-weight:800; padding:7px 11px; font-size:0.8rem;">🖼️ תמונה (JPG)</button>
            <button type="button" class="btn bo" data-tip="העתק את הטבלה כתמונה ללוח להדבקה ישירה (Ctrl+V) בוואטסאפ" onclick="window.doGridExportImage('copy')" style="background:#ecfdf5; border:1px solid #34d399; color:#065f46; font-weight:800; padding:7px 11px; font-size:0.8rem;">📋 העתק תמונה</button>
          </div>
          <button type="button" class="btn bo" onclick="window.CM('grid-export-m')" style="padding:7px 13px; font-size:0.81rem;">סגור</button>
        </div>

        <!-- Footer Export Actions (Tab 2: Instructors) -->
        <div id="gexp-footer-instructors" style="display:none; background:#f8fafc; border-top:1px solid #e2e8f0; padding:11px 18px; flex-wrap:wrap; gap:8px; justify-content:space-between; align-items:center; direction:rtl;">
          <div style="display:flex; flex-wrap:wrap; gap:6px; flex:1;">
            <button type="button" class="btn bg" data-tip="העתק הודעת טקסט מוכנה לוואטסאפ עם הלו״ז המלא והמפורט לספק (תאריכים, ערים, אשכולות, גנים, כתובות ושעות)" onclick="window.doInstExportFullScheduleWA()" style="background:#0d9488; border-color:#0f766e; color:#fff; font-weight:800; padding:7px 12px; font-size:0.81rem;">📲 העתק לו"ז מלא בהודעה</button>
            <button type="button" class="btn bg" data-tip="העתק הודעת טקסט מרוכזת לוואטסאפ עם כמות המדריכים הנדרשת ליום לפי עיר" onclick="window.doInstExportWhatsAppText()" style="background:#16a34a; border-color:#15803d; color:#fff; font-weight:800; padding:7px 12px; font-size:0.81rem;">💬 הודעת כמות מדריכים</button>
            <button type="button" class="btn bg" data-tip="הורד דוח שבועי מרוכז של אשכולות ומדריכים (בדיוק כמו בתמונה: מס' מדריכים ליום)" onclick="window.doClusterMatrixExportExcel()" style="background:#0284c7; border-color:#0369a1; color:#fff; font-weight:800; padding:7px 11px; font-size:0.8rem;">📑 מס' מדריכים (אשכולות)</button>
            <button type="button" class="btn bg" data-tip="הורד קובץ אקסל מלא (3 גיליונות: מדריכים לפי ערים, בקרת עומסים וחוסרים)" onclick="window.doInstExportExcel()" style="background:#15803d; border-color:#166534; color:#fff; font-weight:800; padding:7px 11px; font-size:0.8rem;">📊 אקסל מדריכים ובקרה</button>
            <button type="button" class="btn bp" data-tip="פתח דוח היערכות מדריכים להדפסה או שמירה כ-PDF" onclick="window.doInstExportPDF()" style="background:#1d4ed8; border-color:#1e40af; color:#fff; font-weight:800; padding:7px 11px; font-size:0.8rem;">🖨️ PDF / הדפסה</button>
            <button type="button" class="btn bo" data-tip="הורד כרטיס תמונה מעוצב (JPG) של היערכות המדריכים" onclick="window.doInstExportImage('download')" style="background:#fdf2f8; border:1px solid #f472b6; color:#9d174d; font-weight:800; padding:7px 10px; font-size:0.79rem;">🖼️ תמונה (JPG)</button>
            <button type="button" class="btn bo" data-tip="העתק כרטיס היערכות מדריכים כתמונה ללוח להדבקה ב-Ctrl+V בוואטסאפ" onclick="window.doInstExportImage('copy')" style="background:#ecfdf5; border:1px solid #34d399; color:#065f46; font-weight:800; padding:7px 10px; font-size:0.79rem;">📋 העתק תמונה</button>
          </div>
          <button type="button" class="btn bo" onclick="window.CM('grid-export-m')" style="padding:7px 13px; font-size:0.81rem;">סגור</button>
        </div>

        <!-- Footer Export Actions (Tab 3: Clusters & Gaps Control) -->
        <div id="gexp-footer-gaps" style="display:none; background:#f8fafc; border-top:1px solid #e2e8f0; padding:11px 18px; flex-wrap:wrap; gap:8px; justify-content:space-between; align-items:center; direction:rtl;">
          <div style="display:flex; flex-wrap:wrap; gap:8px; flex:1;">
            <button type="button" class="btn bg" data-tip="הורד לאקסל את דוח הבקרה המלא כולל גנים ללא אשכול ופספוסי שיבוץ" onclick="window.doInstExportExcel()" style="background:#15803d; border-color:#166534; color:#fff; font-weight:800; padding:8px 14px; font-size:0.83rem;">📊 ייצוא דוח בקרה וחוסרים (Excel)</button>
            <button type="button" class="btn bo" onclick="window.setGridExportTab('instructors')" style="background:#eef2ff; border:1px solid #a5b4fc; color:#1e3a8a; font-weight:800; padding:8px 13px; font-size:0.82rem;">🧑‍🏫 מעבר למדריכים לספקים</button>
          </div>
          <button type="button" class="btn bo" onclick="window.CM('grid-export-m')" style="padding:8px 14px; font-size:0.82rem;">סגור</button>
        </div>
      </div>
      <!-- Instant Floating Tooltip (zero clipping, 0ms delay) -->
      <div id="gexp-floating-tip" style="display:none; position:fixed; z-index:100090; pointer-events:none; background:#0f172a; color:#ffffff; padding:6px 11px; border-radius:7px; font-size:0.76rem; font-weight:700; line-height:1.35; max-width:265px; text-align:right; direction:rtl; box-shadow:0 8px 22px rgba(15,23,42,0.34); border:1px solid rgba(255,255,255,0.16);"></div>
    `;
    document.body.appendChild(modal);

    // Bind instant floating tooltip delegation on modal
    const tipEl = modal.querySelector('#gexp-floating-tip');
    let activeTipTarget = null;
    const hideTip = () => {
      activeTipTarget = null;
      if (tipEl) tipEl.style.display = 'none';
    };
    modal.addEventListener('mouseover', (e) => {
      const target = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
      if (!target || !tipEl) return;
      const txt = target.getAttribute('data-tip');
      if (!txt) return;
      activeTipTarget = target;
      tipEl.textContent = txt;
      tipEl.style.display = 'block';
      const r = target.getBoundingClientRect();
      const tr = tipEl.getBoundingClientRect();
      let left = r.left + (r.width / 2) - (tr.width / 2);
      if (left < 10) left = 10;
      if (left + tr.width > window.innerWidth - 10) left = window.innerWidth - tr.width - 10;
      let top = r.top - tr.height - 8;
      if (top < 10) top = r.bottom + 8;
      tipEl.style.left = Math.round(left) + 'px';
      tipEl.style.top = Math.round(top) + 'px';
    });
    modal.addEventListener('mouseout', (e) => {
      if (!activeTipTarget) return;
      if (!e.relatedTarget || !activeTipTarget.contains(e.relatedTarget)) {
        hideTip();
      }
    });
    modal.addEventListener('click', hideTip);
    modal.addEventListener('scroll', hideTip, true);

    return modal;
  }

  let _openSnapshot = null;

  window.openGridExportModal = function (opts = {}) {
    const modal = _ensureModalDOM();
    const openDates = _getOpenCalendarDates();
    const viewState = _getOpenTableViewState();
    _openSnapshot = { openDates, viewState, opts: opts || {} };

    const fromInput = document.getElementById('gexp-from');
    const toInput = document.getElementById('gexp-to');
    const initFrom = opts.from || openDates.fromDs;
    const initTo = opts.to || openDates.toDs;
    fromInput.value = initFrom;
    toInput.value = initTo;

    // Auto-check Friday if single day is Friday or scheduled events exist on a Friday in range
    const incFriEl = document.getElementById('gexp-inc-fri');
    const hasFriEvs = (window.SCH || []).some(s => {
      if (!s.d || s.d < initFrom || s.d > initTo || s.st === 'can' || s.st === 'post') return false;
      return window.s2d(s.d).getDay() === 5;
    });
    incFriEl.checked = (initFrom === initTo && window.s2d(initFrom).getDay() === 5) || hasFriEvs;

    // Populate cities dropdowns (Grid + Instructors + Gaps)
    const citySel = document.getElementById('gexp-city');
    const instCitySel = document.getElementById('gexp-inst-city');
    const gapsCitySel = document.getElementById('gexp-gaps-city');
    const allCities = typeof window.cities === 'function' ? window.cities() : [];
    const citiesOptsHtml = '<option value="">-- כל הערים --</option>' +
      allCities.map(c => `<option value="${_esc(c)}">${_esc(c)}</option>`).join('');
    citySel.innerHTML = citiesOptsHtml;
    const defaultInstCity = opts.city || (viewState.calFilter?.cities?.length === 1 ? viewState.calFilter.cities[0] : '');
    if (instCitySel) {
      instCitySel.innerHTML = citiesOptsHtml;
      instCitySel.value = defaultInstCity;
    }
    if (gapsCitySel) {
      gapsCitySel.innerHTML = citiesOptsHtml;
      gapsCitySel.value = defaultInstCity;
    }

    // Group mode defaults to current open calendar toggle
    const grpSel = document.getElementById('gexp-group-mode');
    grpSel.value = opts.groupMode || viewState.groupMode || 'clusters';

    // Scope selection
    const scopeSel = document.getElementById('gexp-scope');
    if (opts.city || opts.clusterId) {
      scopeSel.value = 'city';
      let targetCity = opts.city || '';
      if (!targetCity && opts.clusterId) {
        if (grpSel.value === 'pairs') {
          const allPrs = typeof window.getPairs === 'function' ? window.getPairs() : (window.pairs || []);
          const foundPr = allPrs.find(p => String(p.id) === String(opts.clusterId) || String(p.name) === String(opts.clusterId));
          if (foundPr && foundPr.ids && foundPr.ids.length) {
            targetCity = window.G(foundPr.ids[0])?.city || '';
          }
        } else {
          const allCls = typeof window.getClusters === 'function' ? window.getClusters() : Object.values(window.clusters || {});
          const foundCl = allCls.find(c => String(c.id) === String(opts.clusterId) || String(c.name) === String(opts.clusterId));
          if (foundCl && foundCl.gardenIds && foundCl.gardenIds.length) {
            targetCity = window.G(foundCl.gardenIds[0])?.city || '';
          }
        }
      }
      citySel.value = targetCity;
    } else if (viewState.hasOpenCities || viewState.hasExplicitFilter) {
      scopeSel.value = 'open';
      if (viewState.openCities.length === 1) {
        citySel.value = viewState.openCities[0].city;
      }
    } else {
      scopeSel.value = 'city';
      citySel.value = '';
    }

    const titleEl = document.getElementById('gexp-title');
    if (titleEl) delete titleEl.dataset.userEdited;

    const hintEl = document.getElementById('gexp-open-hint');
    if (hintEl) {
      hintEl.textContent = `ברירת מחדל מהטבלה הפתוחה: ${openDates.label}`;
    }

    _renderDatePresetPills();
    window.onGridExpScopeChange(opts.clusterId || null);

    // Pre-populate supplier filter in Instructors tab if passed or single supplier filtered on calendar
    const preSup = opts.supplier || (viewState.calFilter?.sups?.length === 1 ? viewState.calFilter.sups[0] : '');
    _refreshInstructorsTab(false, preSup);

    const reqTab = (opts.tab === 'instructors' || opts.tab === 'gaps') ? opts.tab : 'grid';
    window.setGridExportTab(reqTab);
    if (window.WAExport) window.WAExport.syncAllFromStorage();
    modal.classList.add('open');
  };

  window.setGridExportTab = function (tab) {
    _activeTab = (tab === 'instructors' || tab === 'gaps') ? tab : 'grid';

    const tabs = ['grid', 'instructors', 'gaps'];
    tabs.forEach(t => {
      const isCur = _activeTab === t;
      const pane = document.getElementById('gexp-pane-' + t);
      const ftr = document.getElementById('gexp-footer-' + t);
      const btn = document.getElementById('gexp-tab-btn-' + t);
      if (pane) pane.style.display = isCur ? 'block' : 'none';
      if (ftr) ftr.style.display = isCur ? 'flex' : 'none';
      if (btn) {
        btn.style.background = isCur ? '#ffffff' : 'transparent';
        btn.style.color = isCur ? '#1a237e' : '#475569';
        btn.style.borderBottom = isCur ? '3px solid #1a237e' : '3px solid transparent';
      }
    });

    if (_activeTab === 'instructors' || _activeTab === 'gaps') {
      _refreshInstructorsTab(true);
    } else {
      window.updateGridExportSummary();
    }
  };

  function _renderDatePresetPills() {
    const wrap = document.getElementById('gexp-date-presets');
    if (!wrap || !_openSnapshot) return;
    const { openDates, viewState } = _openSnapshot;
    const cityHint = document.getElementById('gexp-city')?.value ||
      (viewState.openCities.length === 1 ? viewState.openCities[0].city : '');

    const curFrom = document.getElementById('gexp-from')?.value || openDates.fromDs;
    const holRanges = _detectNearbyHolidayRanges(curFrom, cityHint);

    let html = `<span style="font-size:0.73rem; color:#64748b; font-weight:700;">בחירה מהירה:</span>`;
    html += `<button type="button" onclick="window.setGridExpDates('${openDates.fromDs}','${openDates.toDs}')" style="background:#e0e7ff; color:#1e3a8a; border:1px solid #a5b4fc; border-radius:999px; padding:2px 9px; font-size:0.73rem; font-weight:700; cursor:pointer;">📌 התאריכים הפתוחים (${window.fD(openDates.fromDs)}${openDates.fromDs !== openDates.toDs ? ' – ' + window.fD(openDates.toDs) : ''})</button>`;
    html += `<button type="button" onclick="window.setGridExpSingleDay()" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; border-radius:999px; padding:2px 9px; font-size:0.73rem; font-weight:700; cursor:pointer;">1️⃣ יומי (יום בודד)</button>`;
    html += `<button type="button" onclick="window.setGridExpFiveDays()" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; border-radius:999px; padding:2px 9px; font-size:0.73rem; font-weight:700; cursor:pointer;">5️⃣ 5 ימי עבודה</button>`;

    holRanges.forEach(hr => {
      const fShort = window.fD(hr.fromDs).slice(0, 5);
      const tShort = window.fD(hr.toDs).slice(0, 5);
      const rangeLbl = hr.fromDs === hr.toDs ? fShort : `${fShort} – ${tShort}`;
      html += `<button type="button" onclick="window.setGridExpDates('${hr.fromDs}','${hr.toDs}')" style="background:#f3e8ff; color:#6b21a8; border:1px solid #d8b4fe; border-radius:999px; padding:2px 10px; font-size:0.73rem; font-weight:800; cursor:pointer;">${hr.emoji} כל ${ _esc(hr.name) } (${rangeLbl})</button>`;
    });

    wrap.innerHTML = html;
  }

  window.setGridExpDates = function (fromDs, toDs) {
    const fEl = document.getElementById('gexp-from');
    const tEl = document.getElementById('gexp-to');
    if (fEl) fEl.value = fromDs;
    if (tEl) tEl.value = toDs;
    window.updateGridExportSummary();
  };

  window.setGridExpSingleDay = function () {
    const fEl = document.getElementById('gexp-from');
    const tEl = document.getElementById('gexp-to');
    if (fEl && tEl && fEl.value) {
      tEl.value = fEl.value;
      if (window.s2d(fEl.value).getDay() === 5) {
        const incFri = document.getElementById('gexp-inc-fri');
        if (incFri) incFri.checked = true;
      }
      window.updateGridExportSummary();
    }
  };

  window.setGridExpFiveDays = function () {
    const fEl = document.getElementById('gexp-from');
    const tEl = document.getElementById('gexp-to');
    if (!fEl || !tEl || !fEl.value) return;
    const ws = window.s2d(fEl.value);
    if (ws.getDay() === 5) ws.setDate(ws.getDate() + 2);
    else if (ws.getDay() === 6) ws.setDate(ws.getDate() + 1);
    const days = window.getNextWorkDays(ws, 5);
    fEl.value = window.d2s(days[0]);
    tEl.value = window.d2s(days[days.length - 1]);
    window.updateGridExportSummary();
  };

  window.onGridExpDateChange = function (which) {
    const fEl = document.getElementById('gexp-from');
    const tEl = document.getElementById('gexp-to');
    if (!fEl || !tEl) return;
    if (which === 'from' && fEl.value && tEl.value && fEl.value > tEl.value) {
      tEl.value = fEl.value;
    } else if (which === 'to' && fEl.value && tEl.value && tEl.value < fEl.value) {
      fEl.value = tEl.value;
    }
    _renderDatePresetPills();
    window.updateGridExportSummary();
  };

  window.onGridExpScopeChange = function (onlyClusterId) {
    const scope = document.getElementById('gexp-scope')?.value || 'open';
    const cityPanel = document.getElementById('gexp-city-panel');
    if (cityPanel) cityPanel.style.display = scope === 'city' ? 'block' : 'none';
    window.onGridExpCityChange(onlyClusterId);
  };

  window.onGridExpGroupModeChange = function () {
    window.onGridExpCityChange();
  };

  window.onGridExpCityChange = function (onlyClusterId) {
    const scope = document.getElementById('gexp-scope')?.value || 'open';
    const city = document.getElementById('gexp-city')?.value || '';
    const groupMode = document.getElementById('gexp-group-mode')?.value || 'clusters';
    const wrap = document.getElementById('gexp-clusters-wrap');
    const list = document.getElementById('gexp-clusters-list');

    if (wrap && list) {
      if (scope === 'city' && city && (groupMode === 'clusters' || groupMode === 'pairs')) {
        const fromDs = document.getElementById('gexp-from')?.value || window.td();
        const toDs = document.getElementById('gexp-to')?.value || fromDs;
        const lblEl = document.getElementById('gexp-clusters-lbl');
        if (lblEl) lblEl.textContent = groupMode === 'clusters' ? 'סינון אשכולות בעיר:' : 'סינון זוגות בעיר:';

        let rawGroups = [];
        if (groupMode === 'clusters') {
          const allCls = typeof window.getClusters === 'function'
            ? window.getClusters(fromDs, toDs)
            : Object.values(window.clusters || {});
          rawGroups = allCls.map(c => ({ id: c.id, name: c.name, ids: c.gardenIds || [] }));
        } else {
          const allPrs = typeof window.getPairs === 'function'
            ? window.getPairs(fromDs, toDs)
            : (window.pairs || []);
          rawGroups = allPrs.map(p => ({ id: p.id, name: p.name, ids: p.ids || [] }));
        }

        const cityGroups = rawGroups
          .filter(grp => grp.ids.some(gid => (window.G(gid)?.city || '') === city))
          .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he', { numeric: true }));

        if (cityGroups.length > 0) {
          wrap.style.display = 'block';
          list.innerHTML = cityGroups.map(grp => {
            const isChecked = onlyClusterId
              ? (String(grp.id) === String(onlyClusterId) || String(grp.name) === String(onlyClusterId))
              : true;
            return `<label style="display:inline-flex; align-items:center; gap:4px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:3px 8px; font-size:0.76rem; font-weight:600; cursor:pointer;">
              <input type="checkbox" class="gexp-cl-cb" value="${_esc(grp.id)}" ${isChecked ? 'checked' : ''} onchange="window.updateGridExportSummary()">
              <span>${_esc(grp.name)}</span>
            </label>`;
          }).join('');
        } else {
          wrap.style.display = 'none';
          list.innerHTML = '';
        }
      } else {
        wrap.style.display = 'none';
        list.innerHTML = '';
      }
    }
    _renderDatePresetPills();
    window.updateGridExportSummary();
  };

  window.toggleAllGridExpClusters = function (checked) {
    document.querySelectorAll('#gexp-clusters-list .gexp-cl-cb').forEach(cb => { cb.checked = !!checked; });
    window.updateGridExportSummary();
  };

  // Core data collector used by Preview Summary + Excel + PDF + Image exports
  function _collectGridData() {
    const fromDs = document.getElementById('gexp-from')?.value || window.td();
    const toDs = document.getElementById('gexp-to')?.value || fromDs;
    const incFri = !!document.getElementById('gexp-inc-fri')?.checked;
    const scope = document.getElementById('gexp-scope')?.value || 'open';
    const groupMode = document.getElementById('gexp-group-mode')?.value || 'clusters';
    const cityFilter = document.getElementById('gexp-city')?.value || '';
    const clsFilter = document.getElementById('gexp-cls')?.value || 'gan';
    const waOpts = window.WAExport ? window.WAExport.getAllOptions() : {};
    const incCluster = document.getElementById('gexp-inc-cluster')
      ? !!document.getElementById('gexp-inc-cluster').checked
      : (waOpts.incCluster !== false);
    const incAddr = document.getElementById('gexp-inc-addr')
      ? !!document.getElementById('gexp-inc-addr').checked
      : (waOpts.incAddr !== false);
    const incSupPhone = !!document.getElementById('gexp-inc-sup-phone')?.checked;
    const incEmptyGardens = !!document.getElementById('gexp-inc-empty-gardens')?.checked;
    const incGardenMeta = !!document.getElementById('gexp-inc-garden-meta')?.checked;
    const incAge = document.getElementById('gexp-inc-age')
      ? !!document.getElementById('gexp-inc-age').checked
      : !!waOpts.incAge;
    const incFreeDays = document.getElementById('gexp-inc-free-days')
      ? !!document.getElementById('gexp-inc-free-days').checked
      : !!waOpts.incFreeDays;
    const splitMsg = document.getElementById('gexp-split-msg')
      ? !!document.getElementById('gexp-split-msg').checked
      : !!waOpts.splitMsg;
    const splitSheets = !!document.getElementById('gexp-split-sheets')?.checked;
    const bwMode = !!document.getElementById('gexp-bw-mode')?.checked;

    const days = _buildDaysArray(fromDs, toDs, incFri);
    const minDs = days.length ? days[0] : fromDs;
    const maxDs = days.length ? days[days.length - 1] : toDs;
    const daysSet = new Set(days);

    const viewState = _openSnapshot ? _openSnapshot.viewState : _getOpenTableViewState();
    const calF = viewState.calFilter || {};

    // Filter valid scheduled activities within days
    const rawEvs = (window.SCH || []).filter(s => {
      if (!s.d || !daysSet.has(s.d)) return false;
      if (s.st === 'can' || s.st === 'post' || s.st === 'nohap') return false;
      if (scope === 'open' && calF.sups && calF.sups.length > 0) {
        const sb = window.supBase ? window.supBase(s.a) : s.a;
        if (!calF.sups.includes(sb) && !calF.sups.includes(s.a)) return false;
      }
      return true;
    });

    const allActiveGardens = _getAllActiveGardens();
    const activeMap = new Map();
    allActiveGardens.forEach(g => activeMap.set(Number(g.id), g));

    // Candidate gardens
    let candidateGardens = allActiveGardens.filter(g => {
      const gid = Number(g.id);
      const explicitlyPicked = scope === 'open' && calF.gids && calF.gids.map(Number).includes(gid);
      if (!explicitlyPicked && typeof window.isMorningDaycareGarden === 'function' && window.isMorningDaycareGarden(gid)) {
        return false;
      }

      if (scope === 'open') {
        if (calF.gids && calF.gids.length > 0 && !calF.gids.map(Number).includes(gid)) return false;
        if (calF.cities && calF.cities.length > 0 && !calF.cities.includes(g.city)) return false;
        if (calF.cls && window.gcls && window.gcls(g) !== calF.cls) return false;
        if (calF.clusters && calF.clusters.length > 0) {
          const allCls = typeof window.getClusters === 'function' ? window.getClusters(minDs, maxDs) : Object.values(window.clusters || {});
          let ok = false;
          for (const clName of calF.clusters) {
            if (clName === '__all__') {
              if (allCls.some(c => (c.gardenIds || []).map(Number).includes(gid))) { ok = true; break; }
            } else {
              const cl = allCls.find(c => c.name === clName);
              if (cl && (cl.gardenIds || []).map(Number).includes(gid)) { ok = true; break; }
            }
          }
          if (!ok) return false;
        }
        // If specific cities are expanded in Weekly Grid, restrict to those open cities!
        if (viewState.openCities && viewState.openCities.length > 0) {
          const openCityNames = new Set(viewState.openCities.map(x => x.city));
          if (!openCityNames.has(g.city || 'אחר')) return false;
        }
      } else {
        if (cityFilter && g.city !== cityFilter) return false;
        if (clsFilter === 'gan' && _isSchoolGarden(g)) return false;
        if (clsFilter === 'sch' && !_isSchoolGarden(g)) return false;
      }
      return true;
    });

    // Selected cluster checkboxes (when scope === 'city' and cluster checkboxes rendered)
    const clCheckboxes = Array.from(document.querySelectorAll('#gexp-clusters-list .gexp-cl-cb'));
    const checkedClusterIds = clCheckboxes.length > 0
      ? new Set(clCheckboxes.filter(cb => cb.checked).map(cb => String(cb.value)))
      : null;

    if (scope === 'city' && checkedClusterIds && (groupMode === 'clusters' || groupMode === 'pairs')) {
      const allowedGids = new Set();
      if (groupMode === 'clusters') {
        const allCls = typeof window.getClusters === 'function' ? window.getClusters(minDs, maxDs) : Object.values(window.clusters || {});
        allCls.forEach(c => {
          if (checkedClusterIds.has(String(c.id))) {
            (c.gardenIds || []).forEach(id => allowedGids.add(Number(id)));
          }
        });
      } else {
        const allPrs = typeof window.getPairs === 'function' ? window.getPairs(minDs, maxDs) : (window.pairs || []);
        allPrs.forEach(p => {
          if (checkedClusterIds.has(String(p.id))) {
            (p.ids || []).forEach(id => allowedGids.add(Number(id)));
          }
        });
      }
      candidateGardens = candidateGardens.filter(g => allowedGids.has(Number(g.id)));
    }

    // Unless incEmptyGardens is checked (or explicit single-garden filter), keep gardens that have at least 1 event in the date range
    const scheduledGids = new Set(rawEvs.map(s => Number(s.g)));
    const hasExplicitGids = scope === 'open' && calF.gids && calF.gids.length > 0;
    if (!incEmptyGardens && !hasExplicitGids) {
      candidateGardens = candidateGardens.filter(g => scheduledGids.has(Number(g.id)));
    }

    // Build events lookup: gid_ds -> sorted events
    const allowedGidSet = new Set(candidateGardens.map(g => Number(g.id)));
    const evsByCell = new Map();
    rawEvs.forEach(s => {
      const gid = Number(s.g);
      if (!allowedGidSet.has(gid)) return;
      const key = `${gid}_${s.d}`;
      if (!evsByCell.has(key)) evsByCell.set(key, []);
      evsByCell.get(key).push(s);
    });
    evsByCell.forEach(arr => {
      arr.sort((a, b) => (typeof window.compareActivities === 'function' ? window.compareActivities(a, b) : (a.t || '99:99').localeCompare(b.t || '99:99')));
    });

    // Group candidate gardens by City -> Clusters / Pairs / Flat
    let groupSource = [];
    if (groupMode === 'clusters') {
      const rawCls = typeof window.getClusters === 'function'
        ? window.getClusters(minDs, maxDs)
        : Object.values(window.clusters || {});
      groupSource = rawCls.map(c => ({ id: c.id, name: c.name, ids: (c.gardenIds || []).map(Number) }));
    } else if (groupMode === 'pairs') {
      const rawPairs = typeof window.getPairs === 'function'
        ? window.getPairs(minDs, maxDs)
        : (window.pairs || []);
      groupSource = rawPairs.map(p => ({ id: p.id, name: p.name, ids: (p.ids || []).map(Number) }));
    }

    const byCity = new Map();
    const ensureCity = c => {
      if (!byCity.has(c)) byCity.set(c, { city: c, groups: [], solos: [] });
      return byCity.get(c);
    };

    const usedGids = new Set();
    if (groupMode !== 'flat') {
      groupSource.forEach(grp => {
        // In 'open' scope, skip clusters explicitly collapsed in Weekly Grid
        if (scope === 'open' && viewState.hasOpenCities && window._calClusterState) {
          const pIdStr = `pair-${grp.id}`;
          if (window._calClusterState[pIdStr] === 'closed') return;
        }
        const myGardens = grp.ids
          .filter(gid => allowedGidSet.has(gid) && !usedGids.has(gid))
          .map(gid => activeMap.get(gid))
          .filter(Boolean)
          .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he', { numeric: true }));
        if (!myGardens.length) return;
        myGardens.forEach(g => usedGids.add(Number(g.id)));
        const city = myGardens[0].city || 'אחר';
        ensureCity(city).groups.push({
          id: grp.id,
          name: grp.name,
          gardens: myGardens
        });
      });
    }

    candidateGardens.forEach(g => {
      const gid = Number(g.id);
      if (usedGids.has(gid)) return;
      const city = g.city || 'אחר';
      ensureCity(city).solos.push(g);
    });

    const citiesData = Array.from(byCity.values()).sort((a, b) => a.city.localeCompare(b.city, 'he'));
    citiesData.forEach(cd => {
      cd.groups.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he', { numeric: true }));
      cd.solos.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he', { numeric: true }));
    });

    // Detect holiday/camp name in selected days for automatic title
    const sampleCity = citiesData.length === 1 ? citiesData[0].city : (cityFilter || null);
    let detectedHolName = '';
    for (const ds of days) {
      const hol = typeof window.getHolidayInfo === 'function' ? window.getHolidayInfo(ds, sampleCity, null) : null;
      if (hol && hol.name) {
        detectedHolName = typeof window.cleanHolName === 'function' ? window.cleanHolName(hol.name) : hol.name;
        break;
      }
    }

    const cityTitlePart = citiesData.length === 1
      ? ` — ${citiesData[0].city}`
      : (cityFilter ? ` — ${cityFilter}` : '');
    const dateRangePart = days.length === 1
      ? `יום ${window.dayN(days[0])} ${window.fD(days[0])}`
      : `${window.fD(minDs)} – ${window.fD(maxDs)}`;
    const autoTitle = detectedHolName
      ? `לוח פעילויות מרוכז – ${detectedHolName}${cityTitlePart}`
      : `לוח שיבוצים ${days.length === 1 ? 'יומי' : 'שבועי'}${cityTitlePart}`;

    const titleInput = document.getElementById('gexp-title');
    if (titleInput && !titleInput.dataset.userEdited) {
      titleInput.value = autoTitle;
    }
    const finalTitle = (titleInput && titleInput.value.trim()) ? titleInput.value.trim() : autoTitle;

    const totalGardens = citiesData.reduce(
      (acc, cd) => acc + cd.groups.reduce((s, g) => s + g.gardens.length, 0) + cd.solos.length,
      0
    );
    const totalGroups = citiesData.reduce((acc, cd) => acc + cd.groups.length, 0);

    return {
      days,
      minDs,
      maxDs,
      dateRangePart,
      detectedHolName,
      title: finalTitle,
      citiesData,
      evsByCell,
      totalGardens,
      totalGroups,
      opts: {
        groupMode,
        incCluster,
        incAddr,
        incSupPhone,
        incEmptyGardens,
        incGardenMeta,
        incAge,
        incFreeDays,
        splitMsg,
        splitSheets,
        bwMode
      }
    };
  }

  window.updateGridExportSummary = function () {
    const data = _collectGridData();
    const daysBadge = document.getElementById('gexp-days-badge');
    if (daysBadge) {
      daysBadge.textContent = data.days.length === 1 ? 'גריד יומי (יום אחד)' : `${data.days.length} ימי פעילות`;
    }
    if (_activeTab === 'instructors' || _activeTab === 'gaps') {
      _refreshInstructorsTab(true);
    } else {
      _updateGapsBadge(_collectInstructorsData(''));
    }

    const splitWrap = document.getElementById('gexp-split-sheets-wrap');
    if (splitWrap) {
      splitWrap.style.opacity = data.citiesData.length > 1 ? '1' : '0.5';
    }

    const sumBox = document.getElementById('gexp-summary-box');
    if (!sumBox) return;

    if (data.days.length === 0) {
      sumBox.style.background = '#fef2f2';
      sumBox.style.borderColor = '#fecaca';
      sumBox.style.color = '#991b1b';
      sumBox.innerHTML = '⚠️ אין ימי פעילות בטווח שנבחר (בדוק את התאריכים או סמן "כלול ימי שישי").';
      return;
    }

    if (data.totalGardens === 0) {
      sumBox.style.background = '#fffbeb';
      sumBox.style.borderColor = '#fde68a';
      sumBox.style.color = '#92400e';
      sumBox.innerHTML = '⚠️ לא נמצאו גנים עם שיבוצים בטווח זה עבור הסינון הנוכחי. ניתן לסמן <b>"הצג גם גנים ללא שיבוץ בטווח"</b> או לבחור עיר.';
      return;
    }

    sumBox.style.background = '#eef2ff';
    sumBox.style.borderColor = '#c7d2fe';
    sumBox.style.color = '#1e3a8a';
    const cityNames = data.citiesData.map(c => c.city).join(', ');
    const grpWord = data.opts.groupMode === 'clusters' ? 'אשכולות' : (data.opts.groupMode === 'pairs' ? 'זוגות' : '');
    const grpStr = grpWord && data.totalGroups > 0 ? ` · ${data.totalGroups} ${grpWord}` : '';
    sumBox.innerHTML = `✅ <b>מוכן לייצוא:</b> ${_esc(cityNames)} (${data.totalGardens} צהרונים/גנים${grpStr}) · <b>${data.days.length} עמודות ימים</b> (${_esc(data.dateRangePart)})`;
  };

  // ════════════════════════════════════════════════════════════════════
  // 1. EXCEL MATRIX EXPORT (.xlsx via ExcelJS + CSV Fallback)
  // ════════════════════════════════════════════════════════════════════
  window.doGridExportExcel = async function () {
    if (document.getElementById('gexp-group-mode')?.value === 'cluster_matrix') {
      return window.doClusterMatrixExportExcel();
    }
    const data = _collectGridData();
    if (!data.days.length || !data.totalGardens) {
      window.spAlert('לא נמצאו נתונים לייצוא בטווח שנבחר.');
      return;
    }

    if (typeof window.ExcelJS === 'undefined') {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js';
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      } catch (e) {
        _exportGridCSVFallback(data);
        return;
      }
    }

    try {
      const wb = new window.ExcelJS.Workbook();
      wb.creator = 'טומשין קידס';
      wb.created = new Date();

      const useSeparateSheets = data.citiesData.length > 1 && data.opts.splitSheets;
      const targets = useSeparateSheets
        ? data.citiesData.map(cd => ({ sheetName: cd.city, cities: [cd] }))
        : [{
            sheetName: data.citiesData.length === 1 ? data.citiesData[0].city : 'טבלת שיבוצים',
            cities: data.citiesData
          }];

      const usedNames = new Set();
      targets.forEach((target, idx) => {
        let sName = String(target.sheetName || `גיליון_${idx + 1}`).replace(/[*?:[\]/\\]/g, '').trim().slice(0, 28) || `גיליון_${idx + 1}`;
        if (usedNames.has(sName)) sName = `${sName}_${idx + 1}`;
        usedNames.add(sName);
        _populateExcelGridSheet(wb, sName, target.cities, data);
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const safeTitle = data.title.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ').trim();
      const fileName = `${safeTitle} (${data.minDs}${data.minDs !== data.maxDs ? '_' + data.maxDs : ''}).xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      window.CM('grid-export-m');
      if (typeof window.showToast === 'function') {
        window.showToast(`📊 קובץ האקסל הורד בהצלחה: ${fileName}`);
      }
    } catch (err) {
      console.error('[GridExport Excel]', err);
      window.spAlert('שגיאה בייצוא לאקסל: ' + err.message);
    }
  };

  function _populateExcelGridSheet(wb, sheetName, citiesSlice, data) {
    const { days, evsByCell, opts, dateRangePart } = data;
    const metaCols = opts.incGardenMeta ? 1 : 0;
    const totalCols = 1 + metaCols + days.length;

    const ws = wb.addWorksheet(sheetName, {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 2, xSplit: 1 + metaCols }],
      pageSetup: {
        paperSize: 9, // A4
        orientation: days.length >= 2 ? 'landscape' : 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        horizontalCentered: true,
        margins: { left: 0.28, right: 0.28, top: 0.35, bottom: 0.35, header: 0.2, footer: 0.2 }
      }
    });

    // Column widths
    const dayColWidth = days.length === 1 ? 40 : (days.length <= 5 ? 24 : 19);
    ws.getColumn(1).width = 27;
    if (metaCols) ws.getColumn(2).width = 22;
    for (let i = 0; i < days.length; i++) {
      ws.getColumn(1 + metaCols + 1 + i).width = dayColWidth;
    }

    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };

    // Row 1: Title Banner
    const sheetTitle = citiesSlice.length === 1 && data.citiesData.length > 1
      ? `${data.title} — ${citiesSlice[0].city} (${dateRangePart})`
      : `${data.title} (${dateRangePart})`;
    const titleRow = ws.addRow([sheetTitle]);
    titleRow.height = 30;
    ws.mergeCells(1, 1, 1, totalCols);
    const tCell = titleRow.getCell(1);
    tCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } };
    tCell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rightToLeft' };

    // Row 2: Column Headers
    const hdrVals = ['צהרון / גן'];
    if (metaCols) hdrVals.push('רכז/ת וטלפון גן');
    const cityRef = citiesSlice.length === 1 ? citiesSlice[0].city : null;
    days.forEach(ds => {
      const hol = typeof window.getHolidayInfo === 'function' ? window.getHolidayInfo(ds, cityRef, null) : null;
      const holClean = hol && hol.name ? (typeof window.cleanHolName === 'function' ? window.cleanHolName(hol.name) : hol.name) : '';
      const hebStr = typeof window.toHebDate === 'function' ? window.toHebDate(ds) : '';
      let lbl = `יום ${window.dayN(ds)}\n${window.fD(ds)}`;
      if (holClean) lbl += `\n${holClean}`;
      else if (hebStr) lbl += `\n${hebStr}`;
      hdrVals.push(lbl);
    });

    const hdrRow = ws.addRow(hdrVals);
    hdrRow.height = 40;
    for (let c = 1; c <= totalCols; c++) {
      const cell = hdrRow.getCell(c);
      const isDateCol = c > 1 + metaCols;
      const ds = isDateCol ? days[c - (2 + metaCols)] : null;
      const hol = ds && typeof window.getHolidayInfo === 'function' ? window.getHolidayInfo(ds, cityRef, null) : null;
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: hol ? 'FF581C87' : 'FF1E3A8A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hol ? 'FFF3E8FF' : 'FFE8EAF6' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder: 'rightToLeft' };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF9FA8DA' } },
        bottom: { style: 'medium', color: { argb: 'FF7986CB' } },
        left: { style: 'thin', color: { argb: 'FFC5CAE9' } },
        right: { style: 'thin', color: { argb: 'FFC5CAE9' } }
      };
    }

    const addSectionBar = (label, argbBg, fontSize = 11) => {
      const r = ws.addRow([label]);
      r.height = 23;
      ws.mergeCells(r.number, 1, r.number, totalCols);
      const c1 = r.getCell(1);
      c1.font = { name: 'Arial', size: fontSize, bold: true, color: { argb: 'FFFFFFFF' } };
      c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argbBg } };
      c1.alignment = { horizontal: 'right', vertical: 'middle', readingOrder: 'rightToLeft', indent: 1 };
    };

    const addGardenRow = (g) => {
      const gid = Number(g.id);
      const rowValues = new Array(totalCols).fill('');
      const r = ws.addRow(rowValues);

      // Col 1: Garden Name + Address
      const gCell = r.getCell(1);
      if (opts.incAddr && g.st) {
        gCell.value = {
          richText: [
            { text: g.name || '', font: { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF1E293B' } } },
            { text: `\n📍 ${g.st}`, font: { name: 'Arial', size: 8.5, color: { argb: 'FF64748B' } } }
          ]
        };
      } else {
        gCell.value = g.name || '';
        gCell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF1E293B' } };
      }
      gCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFBFF' } };
      gCell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true, readingOrder: 'rightToLeft' };
      gCell.border = thinBorder;

      // Optional Col 2: Coordinator & Garden Phone
      if (metaCols) {
        const mCell = r.getCell(2);
        const coord = _getCoordinatorLabel(gid);
        const gPh = _getGardenPhone(g);
        const metaParts = [];
        if (coord) metaParts.push(coord);
        if (gPh) metaParts.push(`גן: ${gPh}`);
        mCell.value = metaParts.join('\n');
        mCell.font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
        mCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        mCell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true, readingOrder: 'rightToLeft' };
        mCell.border = thinBorder;
      }

      let maxLines = opts.incAddr && g.st ? 2 : 1;

      days.forEach((ds, idx) => {
        const colIdx = 1 + metaCols + 1 + idx;
        const cell = r.getCell(colIdx);
        const gBlk = typeof window.getGardenBlock === 'function' ? window.getGardenBlock(gid, ds) : null;
        const wBlk = typeof window.getBlockedInfo === 'function' ? window.getBlockedInfo(ds) : null;
        const blk = gBlk || wBlk;
        const cellEvs = evsByCell.get(`${gid}_${ds}`) || [];

        if (cellEvs.length > 0) {
          const rich = [];
          let linesCount = 0;
          cellEvs.forEach((ev, evIdx) => {
            if (evIdx > 0) {
              rich.push({ text: '\n────────\n', font: { name: 'Arial', size: 7, color: { argb: 'FF94A3B8' } } });
              linesCount += 1;
            }
            const sup = _resolveSupplierAlias(ev.a);
            const act = ev.act || (typeof window.supAct === 'function' ? window.supAct(ev.a) : '') || '';
            const tStr = ev.t ? ev.t.slice(0, 5) : '';
            const grpNum = ev.grp && Number(ev.grp) > 1 ? ` · ${ev.grp} קב'` : '';
            const supPh = opts.incSupPhone
              ? ((typeof window.getSupPhone === 'function' ? window.getSupPhone(ev.a, ev) : '') || ev.p || '')
              : '';

            rich.push({ text: sup, font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1565C0' } } });
            linesCount += 1;
            if (act && act !== sup) {
              rich.push({ text: `\n${act}`, font: { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } } });
              linesCount += 1;
            }
            if (tStr || grpNum) {
              rich.push({ text: `\n⏰ ${tStr}${grpNum}`, font: { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFB91C1C' } } });
              linesCount += 1;
            }
            if (supPh) {
              rich.push({ text: `\n📞 ${supPh}`, font: { name: 'Arial', size: 8.5, color: { argb: 'FF15803D' } } });
              linesCount += 1;
            }
          });
          cell.value = { richText: rich };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7FF' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder: 'rightToLeft' };
          if (linesCount > maxLines) maxLines = linesCount;
        } else if (blk) {
          cell.value = `🚫 ${blk.reason || 'חסום'}`;
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFC62828' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF5F5' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder: 'rightToLeft' };
        } else {
          cell.value = '';
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rightToLeft' };
        }
        cell.border = thinBorder;
      });

      r.height = Math.max(36, maxLines * 14 + 10);
    };

    citiesSlice.forEach(cd => {
      if (citiesSlice.length > 1) {
        addSectionBar(`🏙️ ${cd.city}`, 'FF1A237E', 11.5);
      }
      cd.groups.forEach(grp => {
        const icon = opts.groupMode === 'clusters' ? '🔗' : '⚖️';
        addSectionBar(`${icon} ${grp.name}`, 'FF283593', 10.5);
        grp.gardens.forEach(g => addGardenRow(g));
      });
      if (cd.solos.length > 0) {
        if (cd.groups.length > 0) {
          addSectionBar(`🏡 צהרונים נוספים — ${cd.city}`, 'FF455A64', 10);
        }
        cd.solos.forEach(g => addGardenRow(g));
      }
    });
  }

  function _exportGridCSVFallback(data) {
    const headers = ['עיר', 'אשכול / קבוצה', 'צהרון / גן', 'כתובת', ...data.days.map(ds => `יום ${window.dayN(ds)} ${window.fD(ds)}`)];
    const rows = [];
    data.citiesData.forEach(cd => {
      const pushRow = (grpName, g) => {
        const gid = Number(g.id);
        const dayCols = data.days.map(ds => {
          const evs = data.evsByCell.get(`${gid}_${ds}`) || [];
          return evs.map(ev => {
            const sup = _resolveSupplierAlias(ev.a);
            const act = ev.act || (window.supAct ? window.supAct(ev.a) : '') || '';
            const t = ev.t ? ev.t.slice(0, 5) : '';
            return [sup, act, t].filter(Boolean).join(' - ');
          }).join(' | ');
        });
        rows.push([cd.city, grpName, g.name || '', g.st || '', ...dayCols]);
      };
      cd.groups.forEach(grp => grp.gardens.forEach(g => pushRow(grp.name, g)));
      cd.solos.forEach(g => pushRow('', g));
    });
    const bom = '\uFEFF';
    const csv = bom + [headers, ...rows]
      .map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title.replace(/[/\\?%*:|"<>]/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ════════════════════════════════════════════════════════════════════
  // SHARED VISUAL TABLE BUILDER (for Print/PDF & JPG/WhatsApp Image)
  // ════════════════════════════════════════════════════════════════════
  function _getVisualGridStyles(isLandscape, compactCols) {
    const cellFont = compactCols ? '10px' : '11.5px';
    const supFont = compactCols ? '10.5px' : '12px';
    return `<style>
      .gx-page {
        background: #ffffff;
        color: #1e293b;
        font-family: 'Assistant', Arial, sans-serif;
        direction: rtl;
        box-sizing: border-box;
        padding: 14px 16px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .gx-page + .gx-page {
        page-break-before: always;
        break-before: page;
      }
      .gx-hdr {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, #1a237e 0%, #3949ab 100%);
        color: #ffffff;
        border-radius: 10px;
        padding: 10px 16px;
        margin-bottom: 10px;
      }
      .gx-hdr-title {
        font-size: 18px;
        font-weight: 800;
        line-height: 1.25;
      }
      .gx-hdr-sub {
        font-size: 12.5px;
        opacity: 0.92;
        margin-top: 2px;
        font-weight: 600;
      }
      .gx-logo-box {
        background: #ffffff;
        border-radius: 8px;
        padding: 4px 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .gx-logo-box img {
        height: 36px;
        width: auto;
        object-fit: contain;
        display: block;
      }
      .gx-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        border: 1.5px solid #94a3b8;
      }
      .gx-table th {
        background: #e8eaf6;
        color: #1e3a8a;
        border: 1px solid #94a3b8;
        padding: 5px 4px;
        font-size: ${cellFont};
        font-weight: 800;
        text-align: center;
        line-height: 1.25;
      }
      .gx-table th.gx-th-hol {
        background: #f3e8ff;
        color: #581c87;
      }
      .gx-group-row td {
        background: #283593;
        color: #ffffff;
        font-weight: 800;
        font-size: 12.5px;
        padding: 5px 10px;
        border: 1px solid #1a237e;
        text-align: right;
      }
      .gx-garden-td {
        background: #fafbff;
        border: 1px solid #cbd5e1;
        border-right: 3.5px solid #1a237e;
        padding: 5px 7px;
        vertical-align: middle;
        text-align: right;
        word-wrap: break-word;
      }
      .gx-gname {
        font-weight: 800;
        font-size: ${supFont};
        color: #0f172a;
        line-height: 1.2;
      }
      .gx-gaddr {
        font-size: 10px;
        color: #475569;
        margin-top: 2px;
        line-height: 1.2;
      }
      .gx-cell {
        border: 1px solid #cbd5e1;
        padding: 4px;
        vertical-align: top;
        background: #ffffff;
      }
      .gx-cell-hol {
        background: #faf5ff;
      }
      .gx-ev-card {
        background: #f0f7ff;
        border: 1px solid #bfdbfe;
        border-right: 3.5px solid #1565c0;
        border-radius: 5px;
        padding: 3px 5px;
        margin-bottom: 3px;
        text-align: right;
        line-height: 1.22;
      }
      .gx-ev-card:last-child { margin-bottom: 0; }
      .gx-ev-sup {
        font-weight: 800;
        font-size: ${supFont};
        color: #1565c0;
      }
      .gx-ev-act {
        font-size: ${cellFont};
        color: #334155;
        font-weight: 600;
      }
      .gx-ev-time {
        font-size: ${cellFont};
        color: #b91c1c;
        font-weight: 800;
        margin-top: 1px;
      }
      .gx-ev-ph {
        font-size: 9.5px;
        color: #15803d;
        font-weight: 700;
      }
      .gx-ftr {
        margin-top: 7px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 10.5px;
        color: #64748b;
        font-weight: 700;
      }
      .gx-page.gx-bw, .gx-page.gx-bw * {
        -webkit-filter: grayscale(100%) !important;
        filter: grayscale(100%) !important;
      }
      .gx-page.gx-bw .gx-hdr {
        background: #ffffff !important;
        color: #000000 !important;
        border: 2px solid #000000 !important;
      }
      .gx-page.gx-bw .gx-group-row td {
        background: #18181b !important;
        color: #ffffff !important;
      }
      .gx-page.gx-bw .gx-ev-card {
        background: #ffffff !important;
        border: 1.2px solid #000000 !important;
        border-right: 3.5px solid #000000 !important;
      }
      .gx-page.gx-bw .gx-ev-sup,
      .gx-page.gx-bw .gx-ev-act,
      .gx-page.gx-bw .gx-ev-time {
        color: #000000 !important;
      }
    </style>`;
  }

  function _buildCityVisualPageHtml(cd, data, forCanvas) {
    const { days, evsByCell, opts, dateRangePart } = data;
    const tx = forCanvas ? _rtlFix : _esc;
    const metaCols = opts.incGardenMeta ? 1 : 0;
    const totalCols = 1 + metaCols + days.length;
    const gColPct = days.length === 1 ? 28 : (days.length <= 5 ? 18 : 15);
    const mColPct = metaCols ? 13 : 0;
    const dColPct = ((100 - gColPct - mColPct) / Math.max(1, days.length)).toFixed(2);

    const pageTitle = data.citiesData.length > 1 ? `${data.title} — ${cd.city}` : data.title;

    let colgroup = `<colgroup><col style="width:${gColPct}%">`;
    if (metaCols) colgroup += `<col style="width:${mColPct}%">`;
    days.forEach(() => { colgroup += `<col style="width:${dColPct}%">`; });
    colgroup += `</colgroup>`;

    let thead = `<thead><tr><th>${tx('צהרון / גן')}</th>`;
    if (metaCols) thead += `<th>${tx('רכז/ת וטלפון')}</th>`;
    days.forEach(ds => {
      const hol = typeof window.getHolidayInfo === 'function' ? window.getHolidayInfo(ds, cd.city, null) : null;
      const holClean = hol && hol.name ? (typeof window.cleanHolName === 'function' ? window.cleanHolName(hol.name) : hol.name) : '';
      const fDateShort = window.fD(ds).slice(0, 5);
      thead += `<th class="${holClean ? 'gx-th-hol' : ''}">
        <div>${tx('יום ' + window.dayN(ds))} ${tx(fDateShort)}</div>
        ${holClean ? `<div style="font-size:9.5px; margin-top:1px;">${hol.emoji || '🟣'} ${tx(holClean)}</div>` : ''}
      </th>`;
    });
    thead += `</tr></thead>`;

    const renderGardenTr = (g) => {
      const gid = Number(g.id);
      const coord = opts.incGardenMeta ? _getCoordinatorLabel(gid) : '';
      const gPh = opts.incGardenMeta ? _getGardenPhone(g) : '';

      let tr = `<tr><td class="gx-garden-td">
        <div class="gx-gname">${tx(g.name || '')}</div>
        ${opts.incAddr && g.st ? `<div class="gx-gaddr">📍 ${tx(g.st)}</div>` : ''}
      </td>`;

      if (metaCols) {
        tr += `<td class="gx-garden-td" style="border-right:1px solid #cbd5e1; font-size:10px;">
          ${coord ? `<div style="font-weight:700;">${tx(coord)}</div>` : ''}
          ${gPh ? `<div style="color:#334155;">📞 <span dir="ltr">${_esc(gPh)}</span></div>` : ''}
        </td>`;
      }

      days.forEach(ds => {
        const hol = typeof window.getHolidayInfo === 'function' ? window.getHolidayInfo(ds, cd.city, null) : null;
        const gBlk = typeof window.getGardenBlock === 'function' ? window.getGardenBlock(gid, ds) : null;
        const wBlk = typeof window.getBlockedInfo === 'function' ? window.getBlockedInfo(ds) : null;
        const blk = gBlk || wBlk;
        const cellEvs = evsByCell.get(`${gid}_${ds}`) || [];

        let inner = '';
        if (cellEvs.length > 0) {
          cellEvs.forEach(ev => {
            const sup = _resolveSupplierAlias(ev.a);
            const act = ev.act || (typeof window.supAct === 'function' ? window.supAct(ev.a) : '') || '';
            const tStr = ev.t ? ev.t.slice(0, 5) : '';
            const grpStr = ev.grp && Number(ev.grp) > 1 ? ` · ${ev.grp} קב'` : '';
            const supPh = opts.incSupPhone
              ? ((typeof window.getSupPhone === 'function' ? window.getSupPhone(ev.a, ev) : '') || ev.p || '')
              : '';
            inner += `<div class="gx-ev-card">
              <div class="gx-ev-sup">${tx(sup)}</div>
              ${act && act !== sup ? `<div class="gx-ev-act">${tx(act)}</div>` : ''}
              ${(tStr || grpStr) ? `<div class="gx-ev-time">⏰ <span dir="ltr">${_esc(tStr)}</span>${grpStr ? tx(grpStr) : ''}</div>` : ''}
              ${supPh ? `<div class="gx-ev-ph">📞 <span dir="ltr">${_esc(supPh)}</span></div>` : ''}
            </div>`;
          });
        } else if (blk) {
          inner = `<div style="font-size:10px; color:#c62828; font-weight:700; text-align:center; padding-top:4px;">🚫 ${tx(blk.reason || 'חסום')}</div>`;
        }

        tr += `<td class="gx-cell ${hol ? 'gx-cell-hol' : ''}">${inner}</td>`;
      });

      tr += `</tr>`;
      return tr;
    };

    let tbody = '<tbody>';
    cd.groups.forEach(grp => {
      const icon = opts.groupMode === 'clusters' ? '🔗' : '⚖️';
      tbody += `<tr class="gx-group-row"><td colspan="${totalCols}">${icon} ${tx(grp.name)}</td></tr>`;
      grp.gardens.forEach(g => { tbody += renderGardenTr(g); });
    });
    if (cd.solos.length > 0) {
      if (cd.groups.length > 0) {
        tbody += `<tr class="gx-group-row"><td colspan="${totalCols}" style="background:#475569;">🏡 ${tx('צהרונים נוספים — ' + cd.city)}</td></tr>`;
      }
      cd.solos.forEach(g => { tbody += renderGardenTr(g); });
    }
    tbody += '</tbody>';

    return `<div class="gx-page ${opts.bwMode ? 'gx-bw' : ''}">
      <div class="gx-hdr">
        <div>
          <div class="gx-hdr-title">${tx(pageTitle)}</div>
          <div class="gx-hdr-sub">📅 ${tx(dateRangePart)} · 🏙️ ${tx(cd.city)}</div>
        </div>
        <div class="gx-logo-box">
          <img src="logo_wide.png" alt="טומשין" onerror="this.parentElement.style.display='none'">
        </div>
      </div>
      <table class="gx-table">${colgroup}${thead}${tbody}</table>
      <div class="gx-ftr">
        <span>${tx('* שימו לב: ייתכנו שינויים בלוח הפעילויות')}</span>
        <span>${tx('טומשין קידס – ניהול ושיבוץ')}</span>
      </div>
    </div>`;
  }

  // ════════════════════════════════════════════════════════════════════
  // 2. PRINT / PDF EXPORT (Crisp Vector Landscape Print Window)
  // ════════════════════════════════════════════════════════════════════
  window.doGridExportPDF = function () {
    const data = _collectGridData();
    if (!data.days.length || !data.totalGardens) {
      window.spAlert('לא נמצאו נתונים לייצוא בטווח שנבחר.');
      return;
    }

    const printWin = window.open('', '_blank', 'width=1180,height=840');
    if (!printWin) {
      window.spAlert('אנא אפשר חלונות קופצים (Popups) בדפדפן כדי להפיק PDF.');
      return;
    }

    const isLandscape = data.days.length >= 2;
    const compactCols = data.days.length >= 7;
    const baseUrl = window.location.href.split('?')[0].replace(/[^/]*$/, '');
    const styles = _getVisualGridStyles(isLandscape, compactCols);
    const pagesHtml = data.citiesData.map(cd => _buildCityVisualPageHtml(cd, data, false)).join('');

    printWin.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <base href="${baseUrl}">
  <title>${_esc(data.title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&display=swap" rel="stylesheet">
  ${styles}
  <style>
    @page { size: A4 ${isLandscape ? 'landscape' : 'portrait'}; margin: 7mm; }
    body { margin: 0; padding: 18px; background: #e2e8f0; }
    .gx-page { max-width: ${isLandscape ? '1080px' : '780px'}; margin: 0 auto 18px auto; border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
    .gx-toolbar {
      position: sticky; top: 10px; z-index: 9999; display: flex; gap: 10px; justify-content: center; margin-bottom: 14px;
    }
    .gx-btn {
      padding: 10px 22px; border: none; border-radius: 8px; font-family: 'Assistant', Arial, sans-serif;
      font-size: 15px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .gx-toolbar { display: none !important; }
      .gx-page { max-width: none; margin: 0; border-radius: 0; box-shadow: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="gx-toolbar">
    <button class="gx-btn" style="background:#2563eb; color:#fff;" onclick="window.print()">🖨️ הדפס / שמור כ-PDF</button>
    <button class="gx-btn" style="background:#334155; color:#fff;" onclick="document.querySelectorAll('.gx-page').forEach(p=>p.classList.toggle('gx-bw'))">⚫⚪ החלף צבעוני / שחור-לבן</button>
  </div>
  ${pagesHtml}
</body>
</html>`);
    printWin.document.close();
    window.CM('grid-export-m');
  };

  // ════════════════════════════════════════════════════════════════════
  // 3. IMAGE EXPORT (Download JPG / Copy Image to WhatsApp Clipboard)
  // ════════════════════════════════════════════════════════════════════
  async function _ensureHtml2Canvas() {
    if (window.html2canvas) return window.html2canvas;
    if (window.html2pdf && typeof window.html2pdf === 'function') {
      try {
        const fn = window.html2pdf().html2canvas;
        if (fn) return fn;
      } catch (e) {}
    }
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return window.html2canvas;
  }

  window.doGridExportImage = async function (action = 'download') {
    const data = _collectGridData();
    if (!data.days.length || !data.totalGardens) {
      window.spAlert('לא נמצאו נתונים לייצוא בטווח שנבחר.');
      return;
    }

    let h2c;
    try {
      h2c = await _ensureHtml2Canvas();
    } catch (e) {
      window.spAlert('שגיאה בטעינת ספריית התמונות: ' + e.message);
      return;
    }

    // Strict adherence to AGENTS.md off-screen container rule:
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute; top:-99999px; left:-99999px; width:850px; background:#fff; direction:rtl; font-family:Arial, sans-serif;';
    document.body.appendChild(container);

    const prevScrollX = window.scrollX || window.pageXOffset || 0;
    const prevScrollY = window.scrollY || window.pageYOffset || 0;

    try {
      const compactCols = data.days.length >= 6;
      const styles = _getVisualGridStyles(true, compactCols);

      if (action === 'copy') {
        // Render all selected cities stacked cleanly into a single clipboard image
        const allHtml = data.citiesData.map(cd => _buildCityVisualPageHtml(cd, data, true)).join('');
        container.innerHTML = styles + `<div id="gx-capture-root" style="background:#ffffff;">${allHtml}</div>`;
        await new Promise(r => setTimeout(r, 80));

        const targetEl = container.querySelector('#gx-capture-root') || container;
        window.scrollTo(0, 0);
        const canvas = await h2c(targetEl, { scale: 2, useCORS: true, logging: false });
        window.scrollTo(prevScrollX, prevScrollY);

        const pngBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': pngBlob })]);
          window.CM('grid-export-m');
          if (typeof window.showToast === 'function') {
            window.showToast('✅ תמונת הטבלה הועתקה ללוח! עבור לוואטסאפ והדבק (Ctrl+V)');
          }
          return;
        }
        // Fallback to download if clipboard API blocked
      }

      const rendered = [];
      for (let i = 0; i < data.citiesData.length; i++) {
        const cd = data.citiesData[i];
        container.innerHTML = styles + _buildCityVisualPageHtml(cd, data, true);
        await new Promise(r => setTimeout(r, 70));

        const pageEl = container.querySelector('.gx-page') || container;
        window.scrollTo(0, 0);
        const canvas = await h2c(pageEl, { scale: 2, useCORS: true, logging: false });
        window.scrollTo(prevScrollX, prevScrollY);

        const jpgBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.95));
        const safeCity = String(cd.city || 'עיר').replace(/[/\\?%*:|"<>]/g, '_');
        const safeBase = data.title.replace(/[/\\?%*:|"<>]/g, '_').trim();
        const fName = data.citiesData.length > 1
          ? `${safeBase} - ${safeCity} (${data.minDs}).jpg`
          : `${safeBase} (${data.minDs}).jpg`;
        rendered.push({ blob: jpgBlob, fileName: fName });
      }

      if (rendered.length === 1) {
        const url = URL.createObjectURL(rendered[0].blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = rendered[0].fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        window.showToast?.(`🖼️ תמונת הטבלה הורדה: ${rendered[0].fileName}`);
      } else if (rendered.length > 1) {
        const JZ = window._SafeJSZip || window.JSZip;
        if (JZ) {
          const zip = new JZ();
          rendered.forEach(item => zip.file(item.fileName, item.blob));
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          const url = URL.createObjectURL(zipBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${data.title.replace(/[/\\?%*:|"<>]/g, '_')} (${data.minDs}).zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          window.showToast?.(`🖼️ הורד קובץ ZIP עם ${rendered.length} תמונות טבלה!`);
        } else {
          for (const item of rendered) {
            const url = URL.createObjectURL(item.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = item.fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            await new Promise(r => setTimeout(r, 300));
          }
        }
      }
      window.CM('grid-export-m');
    } catch (err) {
      console.error('[GridExport Image]', err);
      window.spAlert('שגיאה בהפקת תמונת הטבלה: ' + err.message);
    } finally {
      window.scrollTo(prevScrollX, prevScrollY);
      if (container.parentNode) container.parentNode.removeChild(container);
    }
  };

  // ════════════════════════════════════════════════════════════════════
  // TAB 1: FULL SCHEDULE WHATSAPP TEXT EXPORT
  // ════════════════════════════════════════════════════════════════════
  window.doGridExportWhatsAppText = async function () {
    const data = _collectGridData();
    if (!data.days.length || !data.totalGardens) {
      window.spAlert('לא נמצאו נתוני שיבוצים להעתקה בטווח ובסינון שנבחרו.');
      return;
    }

    const { days, citiesData, evsByCell, opts, title, dateRangePart } = data;
    const RLM = '\u200F';
    const lines = [];
    lines.push(`${RLM}📅 *${title}*`);
    lines.push(`${RLM}🗓️ *תאריכים: ${dateRangePart}*`);
    lines.push('');

    let totalPrinted = 0;

    days.forEach(ds => {
      const dayHasEvs = citiesData.some(cd => {
        const gids = [
          ...cd.groups.flatMap(grp => grp.gardens.map(g => Number(g.id))),
          ...cd.solos.map(g => Number(g.id))
        ];
        return gids.some(gid => (evsByCell.get(`${gid}_${ds}`) || []).length > 0);
      });
      if (!dayHasEvs) return;

      lines.push('━━━━━━━━━━━━━━━━━━━━');
      const fullDayName = typeof window.dayN === 'function' ? `יום ${window.dayN(ds)}` : _shortDay(ds);
      lines.push(`${RLM}🗓️ *${fullDayName} | ${window.fD(ds)}*`);

      citiesData.forEach(cd => {
        const cityHasEvs = [
          ...cd.groups.flatMap(grp => grp.gardens.map(g => Number(g.id))),
          ...cd.solos.map(g => Number(g.id))
        ].some(gid => (evsByCell.get(`${gid}_${ds}`) || []).length > 0);
        if (!cityHasEvs) return;

        lines.push(`${RLM}🏙️ *${cd.city}*`);

        const normAddr = (st) => String(st || '').trim().replace(/\s+/g, ' ');
        const groupGardensByConsecutiveAddr = (gardensArr) => {
          const runs = [];
          gardensArr.forEach(g => {
            const rawSt = (opts.incAddr !== false) ? String(g.st || '').trim() : '';
            const nSt = normAddr(rawSt);
            const prev = runs[runs.length - 1];
            if (prev && nSt && prev.normAddr === nSt) {
              prev.gardens.push(g);
            } else {
              runs.push({ normAddr: nSt, displayAddr: rawSt, gardens: [g] });
            }
          });
          return runs;
        };

        const formatEvLinesForGarden = (g, indent, suppressAddr) => {
          const gid = Number(g.id);
          const evs = evsByCell.get(`${gid}_${ds}`) || [];
          if (!evs.length) return;
          evs.forEach(ev => {
            totalPrinted++;
            const supAlias = _resolveSupplierAlias(ev.a);
            const actName = ev.act || (typeof window.supAct === 'function' ? window.supAct(ev.a) : '') || '';
            const actPart = actName && actName !== supAlias ? ` (${actName})` : '';
            const supPhone = opts.incSupPhone
              ? (typeof window.getSupPhone === 'function' ? window.getSupPhone(ev.a, ev) : (ev.p || ''))
              : '';
            const phonePart = supPhone ? ` · 📞 ${supPhone}` : '';

            let actualGrp = ev.grp ? String(ev.grp).trim() : String(window.ggr ? window.ggr(g) || '' : '');
            const grpPart = (actualGrp && actualGrp !== '1' && actualGrp !== '0')
              ? ` · ${actualGrp.includes(',') ? "קב' " + actualGrp : actualGrp + " קב'"}`
              : '';

            const timeVal = ev.t ? (typeof window.fT === 'function' ? window.fT(ev.t) : ev.t) : '';
            const timePart = timeVal ? ` · ⏰ ${timeVal}` : (ev.flexNote ? ` · ℹ️ ${ev.flexNote}` : '');
            const addrPart = (!suppressAddr && opts.incAddr !== false && g.st) ? ` · 📍 ${g.st}` : '';
            const gNameFormatted = (window.WAExport && window.WAExport.formatGardenName)
              ? window.WAExport.formatGardenName(g, { incAge: opts.incAge })
              : `${(g.name || '').trimEnd()}${opts.incAge ? (window.getGardenAgeTag?.(g) || '') : ''}`;

            lines.push(`${RLM}${indent}🏫 *${gNameFormatted}* – 📚 ${supAlias}${actPart}${grpPart}${timePart}${addrPart}${phonePart}`);

            if (opts.incGardenMeta) {
              const coord = _getCoordinatorLabel(gid);
              const gPh = _getGardenPhone(g);
              const metaParts = [];
              if (coord) metaParts.push(`👤 רכז/ת: ${coord}`);
              if (gPh) metaParts.push(`☎️ גן: ${gPh}`);
              if (metaParts.length) {
                lines.push(`${RLM}${indent}   ${metaParts.join(' · ')}`);
              }
            }
          });
        };

        if (opts.splitMsg) {
          const allActiveCityGardens = [
            ...cd.groups.flatMap(grp => grp.gardens),
            ...cd.solos
          ].filter(g => (evsByCell.get(`${Number(g.id)}_${ds}`) || []).length > 0);
          allActiveCityGardens.sort((ga, gb) => (ga.name || '').localeCompare(gb.name || '', 'he', { numeric: true }));

          allActiveCityGardens.forEach(g => {
            const gid = Number(g.id);
            if (opts.incAddr !== false && g.st) {
              lines.push(`${RLM}📍 ${g.st}`);
            }
            formatEvLinesForGarden(g, '', true);
            if (opts.incFreeDays) {
              const freeDaysStr = (window.WAExport && window.WAExport.getFreeDaysText)
                ? window.WAExport.getFreeDaysText(gid, ds)
                : (typeof window.getGardenFreeDays === 'function' ? window.getGardenFreeDays(gid, ds) : '');
              if (freeDaysStr) lines.push(`${RLM}*ימים פנויים : ${freeDaysStr}*`);
            }
            lines.push('');
          });
          return;
        }

        cd.groups.forEach(grp => {
          const activeGardens = grp.gardens.filter(g => (evsByCell.get(`${Number(g.id)}_${ds}`) || []).length > 0);
          if (!activeGardens.length) return;
          // Sort gardens inside group by earliest event time on this day, then garden name
          activeGardens.sort((ga, gb) => {
            const tA = (evsByCell.get(`${Number(ga.id)}_${ds}`) || [])[0]?.t || '99:99';
            const tB = (evsByCell.get(`${Number(gb.id)}_${ds}`) || [])[0]?.t || '99:99';
            if (tA !== tB) return tA.localeCompare(tB);
            return (ga.name || '').localeCompare(gb.name || '', 'he', { numeric: true });
          });
          const grpIcon = opts.groupMode === 'pairs' ? '⚖️' : '📦';
          if (opts.incCluster !== false) {
            lines.push(`${RLM}${grpIcon} *${grp.name}:*`);
          }
          const baseIndent = (opts.incCluster !== false) ? '  ' : '';
          const runs = groupGardensByConsecutiveAddr(activeGardens);
          runs.forEach(run => {
            if (opts.incAddr !== false && run.normAddr && run.gardens.length > 1) {
              const addrPrefix = (runs.length === 1 && opts.incCluster !== false) ? '' : baseIndent;
              const gIndent = (runs.length === 1 && opts.incCluster !== false) ? baseIndent : (baseIndent + '  ');
              lines.push(`${RLM}${addrPrefix}📍 ${run.displayAddr}`);
              run.gardens.forEach(g => formatEvLinesForGarden(g, gIndent, true));
            } else {
              run.gardens.forEach(g => formatEvLinesForGarden(g, baseIndent, false));
            }
          });

          if (opts.incFreeDays) {
            const grpGids = activeGardens.map(g => Number(g.id));
            const freeDaysStr = (window.WAExport && window.WAExport.getFreeDaysText)
              ? window.WAExport.getFreeDaysText(grpGids, ds)
              : (typeof window.getGardenFreeDays === 'function' ? window.getGardenFreeDays(grpGids, ds) : '');
            if (freeDaysStr) lines.push(`${RLM}${baseIndent}*ימים פנויים : ${freeDaysStr}*`);
          }
        });

        const activeSolos = cd.solos.filter(g => (evsByCell.get(`${Number(g.id)}_${ds}`) || []).length > 0);
        if (activeSolos.length) {
          activeSolos.sort((ga, gb) => {
            const tA = (evsByCell.get(`${Number(ga.id)}_${ds}`) || [])[0]?.t || '99:99';
            const tB = (evsByCell.get(`${Number(gb.id)}_${ds}`) || [])[0]?.t || '99:99';
            if (tA !== tB) return tA.localeCompare(tB);
            return (ga.name || '').localeCompare(gb.name || '', 'he', { numeric: true });
          });
          const soloRuns = groupGardensByConsecutiveAddr(activeSolos);
          soloRuns.forEach(run => {
            if (opts.incAddr !== false && run.normAddr && run.gardens.length > 1) {
              lines.push(`${RLM}📍 ${run.displayAddr}`);
              run.gardens.forEach(g => formatEvLinesForGarden(g, '  ', true));
            } else {
              run.gardens.forEach(g => formatEvLinesForGarden(g, '', false));
            }
          });

          if (opts.incFreeDays) {
            const soloGids = activeSolos.map(g => Number(g.id));
            const freeDaysStr = (window.WAExport && window.WAExport.getFreeDaysText)
              ? window.WAExport.getFreeDaysText(soloGids, ds)
              : (typeof window.getGardenFreeDays === 'function' ? window.getGardenFreeDays(soloGids, ds) : '');
            if (freeDaysStr) lines.push(`${RLM}*ימים פנויים : ${freeDaysStr}*`);
          }
        }
        lines.push('');
      });
    });

    if (totalPrinted === 0) {
      window.spAlert('לא נמצאו שיבוצים פעילים בטווח ובסינון שנבחרו.');
      return;
    }

    const text = lines.join('\n').trim();
    try {
      await navigator.clipboard.writeText(text);
      window.showToast?.(`📲 הלו"ז המלא (${totalPrinted} שיבוצים) הועתק לוואטסאפ!`);
    } catch (e) {
      window.spAlert(text);
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // TAB 2: INSTRUCTORS PER DAY FOR SUPPLIERS & CLUSTER/LOAD SANITY CONTROL
  // ════════════════════════════════════════════════════════════════════════
  const _HEB_DAYS_SHORT = ["יום א'", "יום ב'", "יום ג'", "יום ד'", "יום ה'", "יום ו'", 'שבת'];
  let _instSubView = 'summary'; // 'summary' | 'full_sched'

  window.setInstSubView = function (mode) {
    _instSubView = mode === 'full_sched' ? 'full_sched' : 'summary';
    _refreshInstructorsTab(true);
  };

  function _shortDay(ds) {
    const d = window.s2d(ds);
    return _HEB_DAYS_SHORT[d.getDay()] || '';
  }

  function _shortDate(ds) {
    return window.fD(ds).slice(0, 5);
  }

  function _fmtInstructors(n) {
    return n === 1 ? 'מדריך 1' : `${n} מדריכים`;
  }

  function _resolveGardenCluster(gid, ds, allClusters) {
    if (typeof window.resolveGardenUnit === 'function') {
      const u = window.resolveGardenUnit(gid, ds);
      if (u && u.type === 'cluster' && u.raw) return u.raw;
    }
    if (typeof window.gardenClusters === 'function') {
      const res = window.gardenClusters(gid, ds);
      if (res && res.length > 0) return res[0];
    }
    const numId = Number(gid);
    return (allClusters || []).find(c => (c.gardenIds || []).map(Number).includes(numId)) || null;
  }

  let _instSupList = []; // Indexed array of supplier objects for safe inline onclicks

  function _collectInstructorsData(overrideSupBase) {
    const fromDs = document.getElementById('gexp-from')?.value || window.td();
    const toDs = document.getElementById('gexp-to')?.value || fromDs;
    const incFri = !!document.getElementById('gexp-inc-fri')?.checked;
    const supFilter = overrideSupBase !== undefined
      ? overrideSupBase
      : (document.getElementById('gexp-inst-sup')?.value || '');
    const cityFilter = document.getElementById('gexp-inst-city')?.value || '';
    const statusFilter = document.getElementById('gexp-inst-status')?.value || 'all';
    const waOpts = window.WAExport ? window.WAExport.getAllOptions() : {};
    const incDailyTot = document.getElementById('gexp-inst-inc-daily-tot') ? !!document.getElementById('gexp-inst-inc-daily-tot').checked : true;
    const incUnits = !!document.getElementById('gexp-inst-inc-units')?.checked;
    const incCluster = document.getElementById('gexp-inst-inc-cluster')
      ? !!document.getElementById('gexp-inst-inc-cluster').checked
      : (waOpts.incCluster !== false);
    const incCoord = !!document.getElementById('gexp-inst-inc-coord')?.checked;
    const incAge = document.getElementById('gexp-inst-inc-age')
      ? !!document.getElementById('gexp-inst-inc-age').checked
      : !!waOpts.incAge;
    const incAddr = document.getElementById('gexp-inst-inc-addr')
      ? !!document.getElementById('gexp-inst-inc-addr').checked
      : (waOpts.incAddr !== false);
    const incFreeDays = document.getElementById('gexp-inst-inc-free-days')
      ? !!document.getElementById('gexp-inst-inc-free-days').checked
      : !!waOpts.incFreeDays;
    const splitMsg = document.getElementById('gexp-inst-split-msg')
      ? !!document.getElementById('gexp-inst-split-msg').checked
      : !!waOpts.splitMsg;
    const bwMode = !!document.getElementById('gexp-bw-mode')?.checked;

    const days = _buildDaysArray(fromDs, toDs, incFri);
    const minDs = days.length ? days[0] : fromDs;
    const maxDs = days.length ? days[days.length - 1] : toDs;
    const daysSet = new Set(days);

    const allActiveGardens = _getAllActiveGardens();
    const activeMap = new Map();
    allActiveGardens.forEach(g => activeMap.set(Number(g.id), g));

    const allClusters = typeof window.getClusters === 'function'
      ? window.getClusters(minDs, maxDs)
      : Object.values(window.clusters || {});

    // 1. Seed all active activity suppliers (so 0-placement suppliers are visible for control!)
    const mergedAway = new Set((window.supEx && window.supEx['__merged_away']) || []);
    const suppliersMap = new Map();

    const ensureSupplier = (rawName) => {
      if (!rawName) return null;
      const base = (typeof window.supBase === 'function' ? window.supBase(rawName) : String(rawName)).trim();
      if (!base || mergedAway.has(base)) return null;
      if (!suppliersMap.has(base)) {
        const disp = _resolveSupplierAlias(rawName) || _resolveSupplierAlias(base) || base;
        suppliersMap.set(base, {
          base,
          dispName: disp,
          citiesMap: new Map(), // city -> { city, daysMap: Map(ds -> { unitsMap: Map }), unclustered: [] }
          dailyTotals: new Map(), // ds -> count
          totalInstructorDays: 0,
          peakDayCount: 0,
          peakDayDs: '',
          unclusteredCount: 0
        });
      }
      return suppliersMap.get(base);
    };

    const sysSups = typeof window.getAllSup === 'function' ? window.getAllSup() : [];
    sysSups.forEach(s => {
      if (!s || !s.name) return;
      if (typeof window.isActSupplier === 'function' && !window.isActSupplier(s.name)) return;
      ensureSupplier(s.name);
    });

    // 2. Scan valid events in range
    const scheduledByGidDay = new Map(); // "${gid}_${ds}" -> [ev, ...]
    const scheduledDaysByGid = new Map(); // gid -> Set<ds>
    const unclusteredGardensMap = new Map(); // gid -> { g, city, items: [] }

    (window.SCH || []).forEach(s => {
      if (!s || !s.d || !daysSet.has(s.d)) return;
      if (s.st === 'can' || s.st === 'post' || s.st === 'nohap') return;

      const gid = Number(s.g);
      if (typeof window.isMorningDaycareGarden === 'function' && window.isMorningDaycareGarden(gid)) return;
      const g = activeMap.get(gid) || (typeof window.G === 'function' ? window.G(gid) : null);
      if (!g || g.isClosed || g.active === false) return;

      const city = g.city || 'אחר';
      const cellKey = `${gid}_${s.d}`;
      if (!scheduledByGidDay.has(cellKey)) scheduledByGidDay.set(cellKey, []);
      scheduledByGidDay.get(cellKey).push(s);
      if (!scheduledDaysByGid.has(gid)) scheduledDaysByGid.set(gid, new Set());
      scheduledDaysByGid.get(gid).add(s.d);

      if (cityFilter && city !== cityFilter) return;

      const supObj = ensureSupplier(s.a);
      if (!supObj) return;
      // Prefer explicit event-level alias if nicer
      const evAlias = _resolveSupplierAlias(s.a);
      if (evAlias && supObj.dispName === supObj.base && evAlias !== supObj.base) {
        supObj.dispName = evAlias;
      }

      const isSchool = _isSchoolGarden(g);
      const cl = _resolveGardenCluster(gid, s.d, allClusters);

      if (cl) {
        // Cluster (gardens OR schools like בתי ספר ראש העין) => 1 instructor per cluster for this supplier on this day
        if (!supObj.citiesMap.has(city)) {
          supObj.citiesMap.set(city, { city, daysMap: new Map(), unclustered: [] });
        }
        const cityBucket = supObj.citiesMap.get(city);
        if (!cityBucket.daysMap.has(s.d)) {
          cityBucket.daysMap.set(s.d, new Map());
        }
        const unitsMap = cityBucket.daysMap.get(s.d);
        const unitKey = `cl_${cl.id}`;
        if (!unitsMap.has(unitKey)) {
          unitsMap.set(unitKey, { key: unitKey, type: 'cluster', name: cl.name, gids: new Set() });
        }
        unitsMap.get(unitKey).gids.add(gid);
      } else if (isSchool) {
        // Standalone school (not in any cluster) => 1 instructor per school
        if (!supObj.citiesMap.has(city)) {
          supObj.citiesMap.set(city, { city, daysMap: new Map(), unclustered: [] });
        }
        const cityBucket = supObj.citiesMap.get(city);
        if (!cityBucket.daysMap.has(s.d)) {
          cityBucket.daysMap.set(s.d, new Map());
        }
        const unitsMap = cityBucket.daysMap.get(s.d);
        const unitKey = `sch_${gid}`;
        if (!unitsMap.has(unitKey)) {
          unitsMap.set(unitKey, { key: unitKey, type: 'school', name: g.name || `בי"ס ${gid}`, gids: new Set([gid]) });
        }
      } else {
        // Kindergarten NOT in any cluster => Route to dedicated Unclustered Gardens box!
        supObj.unclusteredCount += 1;
        if (!unclusteredGardensMap.has(gid)) {
          unclusteredGardensMap.set(gid, { g, gid, city, items: [] });
        }
        unclusteredGardensMap.get(gid).items.push({
          ds: s.d,
          supDisp: supObj.dispName,
          supBase: supObj.base,
          t: s.t || '',
          act: s.act || ''
        });
      }
    });

    // 3. Finalize per-supplier totals & sorted city structures
    const allSuppliers = Array.from(suppliersMap.values()).map(sup => {
      let totalInstructorDays = 0;
      const dailyTotals = new Map();
      days.forEach(ds => dailyTotals.set(ds, 0));

      const citiesArr = Array.from(sup.citiesMap.values())
        .sort((a, b) => a.city.localeCompare(b.city, 'he'))
        .map(cb => {
          let cityTotal = 0;
          const activeDays = [];
          days.forEach(ds => {
            const unitsMap = cb.daysMap.get(ds);
            const count = unitsMap ? unitsMap.size : 0;
            if (count > 0) {
              const units = Array.from(unitsMap.values()).sort((u1, u2) =>
                (u1.name || '').localeCompare(u2.name || '', 'he', { numeric: true })
              );
              activeDays.push({ ds, count, units });
              cityTotal += count;
              totalInstructorDays += count;
              dailyTotals.set(ds, (dailyTotals.get(ds) || 0) + count);
            }
          });
          return {
            city: cb.city,
            activeDays,
            daysMap: cb.daysMap,
            cityTotal
          };
        })
        .filter(c => c.cityTotal > 0);

      let peakDayCount = 0;
      let peakDayDs = '';
      days.forEach(ds => {
        const cnt = dailyTotals.get(ds) || 0;
        if (cnt > peakDayCount) {
          peakDayCount = cnt;
          peakDayDs = ds;
        }
      });

      return {
        base: sup.base,
        dispName: sup.dispName,
        cities: citiesArr,
        dailyTotals,
        totalInstructorDays,
        peakDayCount,
        peakDayDs,
        unclusteredCount: sup.unclusteredCount
      };
    });

    // Sort: active suppliers by dispName, or when viewing control table we sort active high->low then 0-suppliers alphabetically
    allSuppliers.sort((a, b) => {
      if (a.totalInstructorDays > 0 && b.totalInstructorDays === 0) return -1;
      if (b.totalInstructorDays > 0 && a.totalInstructorDays === 0) return 1;
      if (b.totalInstructorDays !== a.totalInstructorDays) return b.totalInstructorDays - a.totalInstructorDays;
      return a.dispName.localeCompare(b.dispName, 'he');
    });

    // 4. Detect Cluster Completeness & Quantitative Parity Gaps (חוגי בוקר וצהרון כמותית!)
    const imbalancedClusters = []; // Clusters where member gardens have unequal morning or afternoon counts
    const zeroInActiveClusters = []; // Specific member garden(s) have 0 schedules in range while cluster is active
    const emptyClusters = []; // Entire cluster has 0 schedules in range

    const _isMorningAct = (ev) => {
      if (!ev) return false;
      if (ev.tp === 'חוג בוקר') return true;
      if (ev.nt && /חוג בוקר|שעת בוקר/i.test(ev.nt)) return true;
      if (ev.t && parseInt(ev.t) < 13) return true;
      return false;
    };

    allClusters.forEach(cl => {
      const members = (cl.gardenIds || [])
        .map(id => activeMap.get(Number(id)))
        .filter(g => g && !(typeof window.isMorningDaycareGarden === 'function' && window.isMorningDaycareGarden(g.id)));
      if (!members.length) return;

      const clCity = members[0].city || 'אחר';
      if (cityFilter && clCity !== cityFilter) return;

      const memberStats = members.map(g => {
        const gid = Number(g.id);
        let mCount = 0;
        let tCount = 0;
        const activeDays = new Set();
        days.forEach(ds => {
          const evs = (scheduledByGidDay.get(`${gid}_${ds}`) || []).filter(ev => {
            if (supFilter) {
              const b = typeof window.supBase === 'function' ? window.supBase(ev.a) : ev.a;
              return b === supFilter;
            }
            return true;
          });
          evs.forEach(ev => {
            activeDays.add(ds);
            if (_isMorningAct(ev)) mCount++;
            else tCount++;
          });
        });
        return {
          g,
          gid,
          name: (g.name || '').replace(/\s*\([^)]*\)/g, '').trim(),
          fullName: g.name || '',
          mCount,
          tCount,
          total: mCount + tCount,
          activeDays: Array.from(activeDays)
        };
      });

      const totalClusterEvents = memberStats.reduce((s, m) => s + m.total, 0);
      if (totalClusterEvents === 0) {
        emptyClusters.push({ cl, city: clCity, membersCount: members.length });
        return;
      }

      const maxMorning = Math.max(...memberStats.map(m => m.mCount));
      const maxTzaharon = Math.max(...memberStats.map(m => m.tCount));

      // Check if any garden has 0 total in this active cluster
      const zeroMembers = memberStats.filter(m => m.total === 0);
      if (zeroMembers.length > 0 && !supFilter) {
        zeroInActiveClusters.push({
          city: clCity,
          clId: cl.id,
          clName: cl.name,
          scheduledCount: members.length - zeroMembers.length,
          totalMembers: members.length,
          missedGardens: zeroMembers.map(zm => zm.g)
        });
      }

      // Check for quantitative parity gaps across gardens in cluster
      const gaps = [];
      memberStats.forEach(m => {
        const diffM = maxMorning - m.mCount;
        const diffT = maxTzaharon - m.tCount;
        if (diffM > 0 || diffT > 0) {
          gaps.push({
            gid: m.gid,
            gardenName: m.name,
            fullName: m.fullName,
            mCount: m.mCount,
            tCount: m.tCount,
            diffM,
            diffT,
            isZero: m.total === 0
          });
        }
      });

      if (gaps.length > 0) {
        imbalancedClusters.push({
          city: clCity,
          clId: cl.id,
          clName: cl.name,
          maxMorning,
          maxTzaharon,
          totalMembers: members.length,
          memberStats,
          gaps
        });
      }
    });

    const unclusteredGardens = Array.from(unclusteredGardensMap.values())
      .filter(u => !supFilter || u.items.some(it => it.supBase === supFilter))
      .sort((a, b) => a.city.localeCompare(b.city, 'he') || (a.g.name || '').localeCompare(b.g.name || '', 'he'));

    // Apply supplier / status filter for display
    let filteredSuppliers = allSuppliers;
    if (supFilter) {
      filteredSuppliers = allSuppliers.filter(s => s.base === supFilter);
    } else if (statusFilter === 'active') {
      filteredSuppliers = allSuppliers.filter(s => s.totalInstructorDays > 0);
    } else if (statusFilter === 'zero') {
      filteredSuppliers = allSuppliers.filter(s => s.totalInstructorDays === 0);
    } else if (statusFilter === 'low') {
      filteredSuppliers = allSuppliers.filter(s => s.totalInstructorDays >= 1 && s.totalInstructorDays <= 2);
    } else if (statusFilter === 'high') {
      filteredSuppliers = allSuppliers.filter(s => s.peakDayCount >= 3);
    }

    // Detect holiday/camp title
    let detectedHolName = '';
    for (const ds of days) {
      const hol = typeof window.getHolidayInfo === 'function' ? window.getHolidayInfo(ds, cityFilter || null, null) : null;
      if (hol && hol.name) {
        detectedHolName = typeof window.cleanHolName === 'function' ? window.cleanHolName(hol.name) : hol.name;
        break;
      }
    }
    const dateRangePart = days.length === 1
      ? `${window.fD(days[0])} (${_shortDay(days[0])})`
      : `${window.fD(minDs)} – ${window.fD(maxDs)}`;

    return {
      days,
      minDs,
      maxDs,
      dateRangePart,
      detectedHolName,
      supFilter,
      cityFilter,
      statusFilter,
      incDailyTot,
      incUnits,
      incCluster,
      incCoord,
      incAge,
      incAddr,
      incFreeDays,
      splitMsg,
      bwMode,
      allSuppliers,
      filteredSuppliers,
      unclusteredGardens,
      imbalancedClusters,
      zeroInActiveClusters,
      emptyClusters
    };
  }

  function _refreshInstructorsTab(keepSelection, forceSupValue) {
    const sel = document.getElementById('gexp-inst-sup');
    const prevVal = forceSupValue !== undefined ? forceSupValue : (keepSelection && sel ? sel.value : '');

    // First collect without supplier filter to populate dropdown counts accurately
    const fullData = _collectInstructorsData('');
    _instSupList = fullData.allSuppliers;

    if (sel) {
      let optsHtml = `<option value="">-- כל הספקים (בקרת עומסים וריכוז: ${fullData.allSuppliers.filter(s => s.totalInstructorDays > 0).length} פעילים / ${fullData.allSuppliers.filter(s => s.totalInstructorDays === 0).length} ללא שיבוץ) --</option>`;
      fullData.allSuppliers.forEach(s => {
        const icon = s.totalInstructorDays === 0 ? '🔴' : (s.peakDayCount >= 3 ? '🔥' : '🟢');
        const info = s.totalInstructorDays === 0
          ? '0 – ללא שיבוץ בטווח'
          : `${s.totalInstructorDays} ימי מדריך · ${s.cities.length} ערים`;
        optsHtml += `<option value="${_esc(s.base)}">${icon} ${_esc(s.dispName)} (${info})</option>`;
      });
      sel.innerHTML = optsHtml;
      if (prevVal && Array.from(sel.options).some(o => o.value === prevVal)) {
        sel.value = prevVal;
      } else {
        sel.value = '';
      }
    }

    const statusWrap = document.getElementById('gexp-inst-status-wrap');
    const activeSupVal = sel ? sel.value : '';
    if (statusWrap) statusWrap.style.opacity = activeSupVal ? '0.45' : '1';

    const viewData = activeSupVal ? _collectInstructorsData(activeSupVal) : fullData;
    _updateGapsBadge(fullData);
    _renderInstructorsGapBanner(viewData);
    _renderInstructorsPreview(viewData);
    _renderGapsTab(fullData);
  }

  window.onInstCityChange = function (cityVal) {
    const c1 = document.getElementById('gexp-inst-city');
    const c2 = document.getElementById('gexp-gaps-city');
    if (c1 && c1.value !== cityVal) c1.value = cityVal;
    if (c2 && c2.value !== cityVal) c2.value = cityVal;
    _refreshInstructorsTab(true);
  };

  window.onInstFilterChange = function () {
    _refreshInstructorsTab(true);
  };

  window.selectInstSupplierByIdx = function (idx) {
    const sup = _instSupList[idx];
    if (!sup) return;
    const sel = document.getElementById('gexp-inst-sup');
    if (sel) {
      sel.value = sup.base;
      _refreshInstructorsTab(true);
    }
  };

  window.instResetToAllSups = function () {
    const sel = document.getElementById('gexp-inst-sup');
    if (sel) {
      sel.value = '';
      _refreshInstructorsTab(true);
    }
  };

  window.instJumpToGarden = function (gid, ds) {
    window.CM('grid-export-m');
    if (ds && typeof window.goDate === 'function') window.goDate(ds);
    if (typeof window.calJump === 'function') window.calJump('', 'week', String(gid));
  };

  window.instOpenClustersMgmt = function () {
    window.CM('grid-export-m');
    if (typeof window.ST === 'function') window.ST('gardens');
    if (typeof window.setGardensTab === 'function') window.setGardensTab('clusters');
  };

  window.instScheduleMissed = function (clId, gid, ds) {
    window.CM('grid-export-m');
    if (typeof window.openNewSched === 'function') {
      if (clId) {
        window.openNewSched(null, { grpId: 'cl_' + clId, date: ds, focusGid: gid });
      } else {
        window.openNewSched(gid, { date: ds });
      }
    }
  };

  function _countGapIssues(data) {
    const unclusteredCnt = (data.unclusteredGardens || []).length;
    const imbalancedClCnt = (data.imbalancedClusters || []).length;
    const totalGapsCnt = (data.imbalancedClusters || []).reduce((s, c) => s + (c.gaps ? c.gaps.length : 0), 0);
    const zeroActiveGidCnt = (data.zeroInActiveClusters || []).reduce((s, x) => s + (x.missedGardens ? x.missedGardens.length : 0), 0);
    return {
      unclusteredCnt,
      imbalancedClCnt,
      totalGapsCnt,
      zeroActiveGidCnt,
      emptyClCnt: (data.emptyClusters || []).length,
      urgentTotal: unclusteredCnt + totalGapsCnt
    };
  }

  function _updateGapsBadge(data) {
    const badge = document.getElementById('gexp-gaps-badge');
    if (!badge || !data) return;
    const counts = _countGapIssues(data);
    if (counts.urgentTotal > 0) {
      badge.innerHTML = `<span style="background:#dc2626; color:#fff; border-radius:999px; padding:1px 7px; font-size:0.71rem; font-weight:800;">${counts.urgentTotal}</span>`;
    } else {
      badge.innerHTML = `<span style="background:#dcfce7; color:#166534; border-radius:999px; padding:1px 7px; font-size:0.7rem; font-weight:800;">✓</span>`;
    }
  }

  function _renderInstructorsGapBanner(data) {
    const banner = document.getElementById('gexp-inst-gap-banner');
    if (!banner) return;
    const counts = _countGapIssues(data);
    if (counts.urgentTotal === 0) {
      banner.style.display = 'none';
      banner.innerHTML = '';
      return;
    }

    const parts = [];
    if (counts.unclusteredCnt > 0) parts.push(`${counts.unclusteredCnt} גנים ללא אשכול`);
    if (counts.imbalancedClCnt > 0) parts.push(`${counts.imbalancedClCnt} אשכולות עם פערי כמות`);
    if (counts.zeroActiveGidCnt > 0) parts.push(`${counts.zeroActiveGidCnt} גנים ללא שיבוץ`);

    banner.style.display = 'block';
    banner.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; background:#fffbeb; border:1px solid #f59e0b; border-right:4px solid #d97706; border-radius:8px; padding:7px 12px; font-size:0.79rem;">
        <span style="color:#92400e; font-weight:800;">⚠️ שימו לב בבקרת האשכולות: ${parts.join(' · ')}</span>
        <button type="button" onclick="window.setGridExportTab('gaps')" style="background:#d97706; color:#fff; border:none; border-radius:6px; padding:4px 11px; font-size:0.74rem; font-weight:800; cursor:pointer; white-space:nowrap;">🔍 מעבר לבדיקה וטיפול ⬅️</button>
      </div>`;
  }

  function _renderGapsTab(data) {
    const wrap = document.getElementById('gexp-gaps-body');
    if (!wrap) return;

    if (!data.days.length) {
      wrap.innerHTML = `<div style="background:#fef2f2; border:1px solid #fecaca; color:#991b1b; padding:12px; border-radius:8px; font-weight:700; font-size:0.82rem;">⚠️ אין ימי פעילות בטווח התאריכים שנבחר.</div>`;
      return;
    }

    const counts = _countGapIssues(data);
    const kpisHtml = `
      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-bottom:12px;">
        <div style="background:${counts.unclusteredCnt > 0 ? '#fffbeb' : '#f8fafc'}; border:1px solid ${counts.unclusteredCnt > 0 ? '#fde68a' : '#e2e8f0'}; border-radius:8px; padding:8px; text-align:center;">
          <div style="font-size:1.1rem; font-weight:800; color:${counts.unclusteredCnt > 0 ? '#b45309' : '#64748b'};">${counts.unclusteredCnt}</div>
          <div style="font-size:0.72rem; font-weight:700; color:#475569;">גנים משובצים ללא אשכול</div>
        </div>
        <div style="background:${counts.imbalancedClCnt > 0 ? '#fef2f2' : '#f8fafc'}; border:1px solid ${counts.imbalancedClCnt > 0 ? '#fecaca' : '#e2e8f0'}; border-radius:8px; padding:8px; text-align:center;">
          <div style="font-size:1.1rem; font-weight:800; color:${counts.imbalancedClCnt > 0 ? '#dc2626' : '#64748b'};">${counts.imbalancedClCnt}</div>
          <div style="font-size:0.72rem; font-weight:700; color:#475569;">אשכולות עם פערי כמות</div>
        </div>
        <div style="background:${counts.zeroActiveGidCnt > 0 ? '#fff7ed' : '#f8fafc'}; border:1px solid ${counts.zeroActiveGidCnt > 0 ? '#fed7aa' : '#e2e8f0'}; border-radius:8px; padding:8px; text-align:center;">
          <div style="font-size:1.1rem; font-weight:800; color:${counts.zeroActiveGidCnt > 0 ? '#ea580c' : '#64748b'};">${counts.zeroActiveGidCnt}</div>
          <div style="font-size:0.72rem; font-weight:700; color:#475569;">גנים ללא שיבוץ באשכול פעיל</div>
        </div>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px; text-align:center;">
          <div style="font-size:1.1rem; font-weight:800; color:#475569;">${counts.emptyClCnt}</div>
          <div style="font-size:0.72rem; font-weight:700; color:#64748b;">אשכולות ללא שיבוץ בטווח</div>
        </div>
      </div>`;

    let sectionsHtml = '';

    // 1. Unclustered Scheduled Gardens
    if (data.unclusteredGardens && data.unclusteredGardens.length > 0) {
      sectionsHtml += `
        <div style="background:#fffbeb; border:1px solid #f59e0b; border-radius:10px; padding:10px 14px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
            <span style="font-weight:800; color:#b45309; font-size:0.85rem;">⚠️ גנים משובצים שאינם משויכים לאשכול (${data.unclusteredGardens.length} גנים – לא נספרו במדריכים עד לשיוך)</span>
            <button type="button" onclick="window.instOpenClustersMgmt()" style="background:#d97706; color:#fff; border:none; border-radius:6px; padding:4px 10px; font-size:0.74rem; font-weight:800; cursor:pointer;">🔗 שייך בניהול אשכולות</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${data.unclusteredGardens.map(u => {
              const datesSummary = u.items.map(it => `${_shortDate(it.ds)} (${_esc(it.supDisp)}${it.t ? ' ' + _esc(it.t.slice(0, 5)) : ''})`).join(' · ');
              const firstDs = u.items[0]?.ds || data.minDs;
              return `<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; background:#ffffff; border:1px solid #fde68a; border-radius:7px; padding:6px 10px; font-size:0.79rem;">
                <div>
                  <b style="color:#92400e;">${_esc(u.city)} – ${_esc(u.g.name)}</b>
                  <span style="color:#475569; margin-right:6px;">${datesSummary}</span>
                </div>
                <button type="button" onclick="window.instJumpToGarden(${u.gid}, '${firstDs}')" style="background:#fef3c7; border:1px solid #f59e0b; color:#92400e; border-radius:5px; padding:3px 9px; font-size:0.73rem; font-weight:700; cursor:pointer; white-space:nowrap;">📅 הצג בלוח</button>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    }

    // 2. Imbalanced Clusters (Quantitative check: morning & afternoon clubs parity)
    if (data.imbalancedClusters && data.imbalancedClusters.length > 0) {
      sectionsHtml += `
        <div style="background:#fef2f2; border:1px solid #fca5a5; border-radius:10px; padding:10px 14px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
            <div style="font-weight:800; color:#b91c1c; font-size:0.85rem;">
              🔴 בקרת כמות באשכולות – פערי שיבוץ בין גנים באותו אשכול (${data.imbalancedClusters.length} אשכולות)
            </div>
            <span style="font-size:0.73rem; color:#64748b;">בדיקה כמותית של חוגי בוקר וחוגי צהרון</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${data.imbalancedClusters.map(ic => `
              <div style="background:#ffffff; border:1px solid #fecaca; border-right:4px solid #dc2626; border-radius:8px; padding:8px 12px; font-size:0.8rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
                  <div>
                    <b style="font-size:0.85rem; color:#1e293b;">${_esc(ic.city)} · ${_esc(ic.clName)}</b>
                    <span style="color:#475569; font-size:0.75rem; margin-right:8px;">(${ic.totalMembers} גנים באשכול · יעד מקסימלי שנרשם: <b>${ic.maxMorning} בוקר</b>, <b>${ic.maxTzaharon} צהרון</b>)</span>
                  </div>
                  <span style="background:#fee2e2; color:#b91c1c; font-weight:800; font-size:0.72rem; border-radius:999px; padding:2px 8px;">${ic.gaps.length} גנים בחסר</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:6px;">
                  ${ic.memberStats.map(m => {
                    const isBalanced = m.mCount === ic.maxMorning && m.tCount === ic.maxTzaharon;
                    const diffM = ic.maxMorning - m.mCount;
                    const diffT = ic.maxTzaharon - m.tCount;
                    return `
                      <div style="background:${isBalanced ? '#f0fdf4' : '#fff5f5'}; border:1px solid ${isBalanced ? '#bbf7d0' : '#fecaca'}; border-radius:6px; padding:6px 9px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                          <div style="font-weight:700; color:${isBalanced ? '#166534' : '#991b1b'};">${_esc(m.name)}</div>
                          <div style="font-size:0.73rem; color:#475569;">
                            בוקר: <b>${m.mCount}</b> · צהרון: <b>${m.tCount}</b> (סה"כ ${m.total})
                          </div>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:2px;">
                          ${isBalanced ? `<span style="color:#16a34a; font-size:0.72rem; font-weight:800;">🟢 תקין</span>` : `
                            ${diffM > 0 ? `<span style="background:#fee2e2; color:#b91c1c; font-size:0.69rem; font-weight:800; padding:1px 5px; border-radius:4px;">חסר ${diffM} בוקר</span>` : ''}
                            ${diffT > 0 ? `<span style="background:#ffedd5; color:#c2410c; font-size:0.69rem; font-weight:800; padding:1px 5px; border-radius:4px;">חסר ${diffT} צהרון</span>` : ''}
                            <button type="button" onclick="window.instJumpToGarden(${m.gid}, '${data.minDs}')" style="background:#fff; border:1px solid #cbd5e1; color:#475569; border-radius:4px; padding:1px 6px; font-size:0.68rem; font-weight:700; cursor:pointer; margin-top:2px;">📅 לוח</button>
                          `}
                        </div>
                      </div>`;
                  }).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>`;
    }

    // 3. Gardens with 0 Schedules inside an Otherwise Active Cluster
    if (data.zeroInActiveClusters && data.zeroInActiveClusters.length > 0) {
      sectionsHtml += `
        <div style="background:#fff7ed; border:1px solid #fdba74; border-radius:10px; padding:10px 14px; margin-bottom:10px;">
          <div style="font-weight:800; color:#c2410c; font-size:0.85rem; margin-bottom:8px;">🟠 גנים ללא אף שיבוץ בטווח בתוך אשכול פעיל</div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${data.zeroInActiveClusters.map(zc => `
              <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; background:#ffffff; border:1px solid #fed7aa; border-right:4px solid #ea580c; border-radius:7px; padding:6px 10px; font-size:0.79rem;">
                <div>
                  <b>${_esc(zc.city)} · ${_esc(zc.clName)}:</b>
                  <span style="color:#1e293b; font-weight:700;"> ${zc.missedGardens.map(g => _esc(g.name)).join(', ')}</span>
                  <span style="color:#64748b; font-size:0.73rem;"> (${zc.scheduledCount}/${zc.totalMembers} גנים אחרים באשכול שובצו)</span>
                </div>
                <button type="button" data-clid="${_esc(zc.clId)}" onclick="window.instScheduleMissed(this.dataset.clid, ${zc.missedGardens[0].id}, '${data.minDs}')" style="background:#ea580c; color:#fff; border:none; border-radius:6px; padding:4px 10px; font-size:0.73rem; font-weight:800; cursor:pointer; white-space:nowrap;">➕ שבץ לאשכול</button>
              </div>
            `).join('')}
          </div>
        </div>`;
    }

    // Healthy state banner when urgentTotal === 0
    if (counts.urgentTotal === 0) {
      sectionsHtml += `
        <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:10px; padding:16px; text-align:center; margin-bottom:10px;">
          <div style="font-size:1.3rem; margin-bottom:4px;">✅</div>
          <div style="font-weight:800; color:#166534; font-size:0.9rem;">בקרת האשכולות תקינה לחלוטין בטווח זה!</div>
          <div style="font-size:0.78rem; color:#15803d; margin-top:2px;">כל הגנים המשובצים משויכים לאשכולות, וכל הגנים בכל אשכול שובצו שווה בשווה לחוגי בוקר ולחוגי צהרון.</div>
        </div>`;
    }

    // 4. Empty Clusters Info Box
    if (data.emptyClusters && data.emptyClusters.length > 0) {
      sectionsHtml += `
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:9px; padding:9px 12px; font-size:0.77rem; color:#475569;">
          <div style="font-weight:800; color:#334155; margin-bottom:5px;">⚪ אשכולות ללא שיבוץ כלל בטווח (${data.emptyClusters.length}):</div>
          <div style="display:flex; flex-wrap:wrap; gap:5px;">
            ${data.emptyClusters.map(ec => `<span style="background:#ffffff; border:1px solid #cbd5e1; border-radius:999px; padding:2px 9px; font-size:0.73rem; font-weight:600;">${_esc(ec.city)} – ${_esc(ec.cl.name)}</span>`).join('')}
          </div>
        </div>`;
    }

    wrap.innerHTML = kpisHtml + sectionsHtml;
  }

  // Collect full chronological schedule (gardens, addresses, hours, clusters) for a single supplier
  function _collectSupplierFullSchedule(supBaseName, data) {
    const days = data.days || [];
    const daysSet = new Set(days);
    const minDs = data.minDs || (days[0] || '');
    const maxDs = data.maxDs || (days[days.length - 1] || '');
    const allActiveGardens = _getAllActiveGardens();
    const activeMap = new Map();
    allActiveGardens.forEach(g => activeMap.set(Number(g.id), g));

    const allClusters = typeof window.getClusters === 'function'
      ? window.getClusters(minDs, maxDs)
      : Object.values(window.clusters || {});

    const byDayMap = new Map(); // ds -> Map(city -> Map(unitKey -> unitObj))
    let totalEvents = 0;

    (window.SCH || []).forEach(s => {
      if (!s || !s.d || !daysSet.has(s.d)) return;
      if (s.st === 'can' || s.st === 'post' || s.st === 'nohap') return;
      const evBase = (typeof window.supBase === 'function' ? window.supBase(s.a) : String(s.a || '')).trim();
      if (evBase !== supBaseName) return;

      const gid = Number(s.g);
      if (typeof window.isMorningDaycareGarden === 'function' && window.isMorningDaycareGarden(gid)) return;
      const g = activeMap.get(gid) || (typeof window.G === 'function' ? window.G(gid) : null);
      if (!g || g.isClosed || g.active === false) return;

      const city = g.city || 'אחר';
      if (data.cityFilter && city !== data.cityFilter) return;

      if (!byDayMap.has(s.d)) byDayMap.set(s.d, new Map());
      const citiesMap = byDayMap.get(s.d);
      if (!citiesMap.has(city)) citiesMap.set(city, new Map());
      const unitsMap = citiesMap.get(city);

      const unit = (typeof window.resolveGardenUnit === 'function')
        ? window.resolveGardenUnit(gid, s.d)
        : null;

      const unitKey = unit ? unit.key : `solo_${gid}`;
      const unitType = unit ? unit.type : 'solo';
      const unitName = unit ? unit.name : (g.name || '');
      const orderIds = unit ? unit.gids : [gid];
      const sortRank = unit ? unit.sortRank : 4;

      if (!unitsMap.has(unitKey)) {
        unitsMap.set(unitKey, {
          key: unitKey,
          type: unitType,
          name: unitName,
          orderIds,
          sortRank,
          events: []
        });
      }
      unitsMap.get(unitKey).events.push({ ...s, gd: g, gid });
      totalEvents++;
    });

    const daysList = [];
    days.forEach(ds => {
      const citiesMap = byDayMap.get(ds);
      if (!citiesMap || citiesMap.size === 0) return;

      const citiesList = Array.from(citiesMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0], 'he'))
        .map(([city, unitsMap]) => {
          const units = Array.from(unitsMap.values()).sort((u1, u2) => {
            if (u1.sortRank !== u2.sortRank) return u1.sortRank - u2.sortRank;
            return (u1.name || '').localeCompare(u2.name || '', 'he', { numeric: true });
          });
          units.forEach(u => {
            u.events.sort((a, b) => {
              const tA = a.t || '99:99';
              const tB = b.t || '99:99';
              if (tA !== tB) return tA.localeCompare(tB);
              const idxA = u.orderIds.indexOf(a.gid);
              const idxB = u.orderIds.indexOf(b.gid);
              if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB;
              return (a.gd.name || '').localeCompare(b.gd.name || '', 'he', { numeric: true });
            });
          });
          const instCount = units.filter(u => u.type === 'cluster' || u.type === 'school').length;
          return { city, units, instCount };
        });

      daysList.push({ ds, cities: citiesList });
    });

    return { daysList, totalEvents };
  }

  function _renderInstructorsPreview(data) {
    const wrap = document.getElementById('gexp-inst-preview');
    if (!wrap) return;

    if (!data.days.length) {
      wrap.innerHTML = `<div style="background:#fef2f2; border:1px solid #fecaca; color:#991b1b; padding:12px; border-radius:8px; font-weight:700; font-size:0.82rem;">⚠️ אין ימי פעילות בטווח התאריכים שנבחר.</div>`;
      return;
    }

    // SINGLE SUPPLIER VIEW
    if (data.supFilter) {
      const sup = data.filteredSuppliers[0];
      const fullSched = sup ? _collectSupplierFullSchedule(sup.base, data) : { daysList: [], totalEvents: 0 };
      if (!sup || (sup.totalInstructorDays === 0 && fullSched.totalEvents === 0)) {
        wrap.innerHTML = `
          <div style="background:#fffbeb; border:1px solid #fde68a; color:#92400e; padding:14px; border-radius:9px; display:flex; justify-content:space-between; align-items:center;">
            <span>⚠️ לספק שנבחר אין שיבוצים פעילים בטווח התאריכים הזה.</span>
            <button type="button" onclick="window.instResetToAllSups()" class="btn bo bsm">חזרה לכל הספקים</button>
          </div>`;
        return;
      }

      const isFullSchedView = _instSubView === 'full_sched';
      const subViewToggleHtml = `
        <div style="display:inline-flex; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:7px; padding:2px; gap:2px;">
          <button type="button" onclick="window.setInstSubView('summary')" style="border:none; border-radius:5px; padding:4px 9px; font-size:0.75rem; font-weight:800; cursor:pointer; background:${!isFullSchedView ? '#1a237e' : 'transparent'}; color:${!isFullSchedView ? '#ffffff' : '#475569'};">🧑‍🏫 כמות מדריכים</button>
          <button type="button" onclick="window.setInstSubView('full_sched')" style="border:none; border-radius:5px; padding:4px 9px; font-size:0.75rem; font-weight:800; cursor:pointer; background:${isFullSchedView ? '#0d9488' : 'transparent'}; color:${isFullSchedView ? '#ffffff' : '#475569'};">📅 לו"ז מלא (${fullSched.totalEvents})</button>
        </div>`;

      let bodyContentHtml = '';

      if (isFullSchedView) {
        const dayBlocksHtml = fullSched.daysList.map(dayObj => {
          const fullDay = typeof window.dayN === 'function' ? `יום ${window.dayN(dayObj.ds)}` : _shortDay(dayObj.ds);
          const citiesBlocks = dayObj.cities.map(cObj => {
            const unitsBlocks = cObj.units.map(u => {
              const unitHdr = (data.incCluster !== false) ? (u.type === 'cluster'
                ? `<div style="font-size:0.76rem; font-weight:800; color:#1e40af; background:#eff6ff; border-radius:5px; padding:3px 8px; margin-bottom:4px; display:inline-block;">📦 אשכול: ${_esc(u.name)}</div>`
                : (u.type === 'pair'
                  ? `<div style="font-size:0.75rem; font-weight:800; color:#0f766e; background:#f0fdfa; border-radius:5px; padding:2px 8px; margin-bottom:4px; display:inline-block;">⚖️ זוג: ${_esc(u.name)}</div>`
                  : '')) : '';

              // Group consecutive events sharing the same address
              const normAddr = (st) => String(st || '').trim().replace(/\s+/g, ' ');
              const addrRuns = [];
              u.events.forEach(ev => {
                const rawSt = (data.incAddr !== false) ? String(ev.gd.st || '').trim() : '';
                const nSt = normAddr(rawSt);
                const prev = addrRuns[addrRuns.length - 1];
                if (prev && nSt && prev.normAddr === nSt) {
                  prev.events.push(ev);
                } else {
                  addrRuns.push({ normAddr: nSt, displayAddr: rawSt, events: [ev] });
                }
              });

              const evRunsHtml = addrRuns.map(run => {
                const isSharedAddr = data.incAddr !== false && !!(run.normAddr && run.events.length > 1);
                const sharedAddrHdr = isSharedAddr
                  ? `<div style="font-size:0.76rem; font-weight:700; color:#334155; padding:2px 6px 2px 0;">📍 ${_esc(run.displayAddr)}</div>`
                  : '';
                const rows = run.events.map(ev => {
                  const timeStr = ev.t ? (typeof window.fT === 'function' ? window.fT(ev.t) : ev.t) : '';
                  const actName = ev.act || (typeof window.supAct === 'function' ? window.supAct(ev.a) : '') || '';
                  let actualGrp = ev.grp ? String(ev.grp).trim() : String(window.ggr ? window.ggr(ev.gd) || '' : '');
                  const grpBadge = (actualGrp && actualGrp !== '1' && actualGrp !== '0')
                    ? `<span style="background:#fef3c7; color:#92400e; font-size:0.7rem; font-weight:800; padding:1px 6px; border-radius:4px;">${_esc(actualGrp.includes(',') ? "קב' " + actualGrp : actualGrp + " קב'")}</span>`
                    : '';
                  const coordLbl = data.incCoord ? _getCoordinatorLabel(ev.gid) : '';
                  const ageTag = data.incAge ? (typeof window.getGardenAgeTag === 'function' ? window.getGardenAgeTag(ev.gd) : '') : '';
                  const ageBadge = ageTag ? `<span style="background:#e0f2f1; color:#00796b; font-size:0.72rem; font-weight:800; padding:1px 6px; border-radius:4px;">${_esc(ageTag.trim())}</span>` : '';

                  return `<div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px; padding:4px 6px; ${isSharedAddr ? 'padding-right:16px;' : ''} border-bottom:1px dashed #e2e8f0; font-size:0.8rem;">
                    ${timeStr ? `<span style="background:#dbeafe; color:#1e3a8a; font-weight:800; font-size:0.74rem; padding:1px 6px; border-radius:4px; direction:ltr;">⏰ ${_esc(timeStr)}</span>` : ''}
                    <b style="color:#0f172a;">🏫 ${_esc(ev.gd.name)}</b>${ageBadge ? ' ' + ageBadge : ''}
                    ${actName ? `<span style="color:#0369a1; font-size:0.74rem; font-weight:700;">(${_esc(actName)})</span>` : ''}
                    ${grpBadge}
                    ${(!isSharedAddr && data.incAddr !== false && ev.gd.st) ? `<span style="color:#475569; font-size:0.75rem;">📍 ${_esc(ev.gd.st)}</span>` : ''}
                    ${coordLbl ? `<span style="color:#0f766e; font-size:0.73rem; font-weight:700;">👤 ${_esc(coordLbl)}</span>` : ''}
                  </div>`;
                }).join('');
                return `${sharedAddrHdr}${rows}`;
              }).join('');

              const freeDaysStr = (data.incFreeDays && typeof window.getGardenFreeDays === 'function')
                ? window.getGardenFreeDays(u.orderIds || u.events.map(ev => ev.gid), dayObj.ds)
                : '';
              const freeDaysHtml = freeDaysStr
                ? `<div style="font-size:0.73rem; font-weight:700; color:#059669; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:5px; padding:2px 8px; margin-top:4px;">🗓️ ימים פנויים : ${_esc(freeDaysStr)}</div>`
                : '';

              return `<div style="margin-bottom:6px;">${unitHdr}${evRunsHtml}${freeDaysHtml}</div>`;
            }).join('');

            return `<div style="margin-top:6px; padding-right:4px;">
              <div style="font-weight:800; color:#1a237e; font-size:0.83rem; margin-bottom:4px;">
                🏙️ ${_esc(cObj.city)} ${cObj.instCount > 0 ? `<span style="font-size:0.73rem; color:#475569; font-weight:700;">(${_fmtInstructors(cObj.instCount)})</span>` : ''}
              </div>
              ${unitsBlocks}
            </div>`;
          }).join('');

          return `<div style="background:#f8fafc; border:1px solid #cbd5e1; border-right:4px solid #0d9488; border-radius:8px; padding:8px 12px; margin-bottom:8px;">
            <div style="font-weight:800; color:#0f766e; font-size:0.86rem; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
              🗓️ ${_esc(fullDay)} – ${window.fD(dayObj.ds)}
            </div>
            ${citiesBlocks}
          </div>`;
        }).join('');

        bodyContentHtml = `
          <div style="max-height:335px; overflow-y:auto; padding-left:2px;">
            ${dayBlocksHtml}
          </div>`;
      } else {
        let citiesHtml = sup.cities.map(cb => {
          const lines = cb.activeDays.map(ad => {
            const unitsTxt = data.incUnits ? ` <span style="color:#64748b; font-size:0.75rem;">(${ad.units.map(u => _esc(u.name)).join(', ')})</span>` : '';
            return `<div style="padding:3px 0; font-size:0.83rem; color:#1e293b; border-bottom:1px dashed #f1f5f9;">
              <b>${_esc(cb.city)} ${_shortDate(ad.ds)}</b> <span style="color:#475569;">(${_shortDay(ad.ds)})</span> – <span style="color:#1565c0; font-weight:800;">${_fmtInstructors(ad.count)}</span>${unitsTxt}
            </div>`;
          }).join('');
          return `<div style="background:#f8fafc; border:1px solid #e2e8f0; border-right:4px solid #1a237e; border-radius:8px; padding:8px 12px;">
            <div style="font-weight:800; color:#1a237e; font-size:0.88rem; margin-bottom:4px; display:flex; justify-content:space-between;">
              <span>🏙️ ${_esc(cb.city)}</span>
              <span style="font-size:0.74rem; color:#475569;">סה"כ ${cb.cityTotal} ימי מדריך בעיר</span>
            </div>
            ${lines}
          </div>`;
        }).join('');

        let dailySummaryHtml = '';
        if (data.incDailyTot) {
          const activeTotals = data.days
            .map(ds => ({ ds, cnt: sup.dailyTotals.get(ds) || 0 }))
            .filter(x => x.cnt > 0);
          dailySummaryHtml = `
            <div style="background:#eef2ff; border:1px solid #c7d2fe; border-radius:8px; padding:8px 12px; margin-top:8px;">
              <div style="font-weight:800; color:#1e3a8a; font-size:0.82rem; margin-bottom:5px;">📊 סה"כ מדריכים נדרשים ליום (כל הערים יחד):</div>
              <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${activeTotals.map(x => `<span style="background:#ffffff; border:1px solid #a5b4fc; color:#1e3a8a; border-radius:6px; padding:3px 9px; font-size:0.78rem; font-weight:800;">${_shortDate(x.ds)} (${_shortDay(x.ds)}): ${_fmtInstructors(x.cnt)}</span>`).join('')}
              </div>
            </div>`;
        }

        bodyContentHtml = `
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:8px; max-height:330px; overflow-y:auto;">
            ${citiesHtml}
          </div>
          ${dailySummaryHtml}`;
      }

      wrap.innerHTML = `
        <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
            <div>
              <span style="font-size:0.98rem; font-weight:800; color:#1a237e;">🧑‍🏫 ${_esc(sup.dispName)}</span>
              <span style="background:#dbeafe; color:#1e40af; font-weight:800; font-size:0.75rem; padding:2px 8px; border-radius:999px; margin-right:6px;">סה"כ ${sup.totalInstructorDays} ימי מדריך · שיא יומי: ${_fmtInstructors(sup.peakDayCount)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              ${subViewToggleHtml}
              <button type="button" onclick="window.instResetToAllSups()" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#334155; border-radius:6px; padding:4px 10px; font-size:0.75rem; font-weight:700; cursor:pointer;">⬅️ חזרה לבקרת כל הספקים</button>
            </div>
          </div>
          ${bodyContentHtml}
        </div>`;
      return;
    }

    // ALL SUPPLIERS MANAGEMENT CONTROL VIEW
    const activeCount = data.allSuppliers.filter(s => s.totalInstructorDays > 0).length;
    const zeroCount = data.allSuppliers.filter(s => s.totalInstructorDays === 0).length;
    const highCount = data.allSuppliers.filter(s => s.peakDayCount >= 3).length;
    const grandTotalInstDays = data.allSuppliers.reduce((acc, s) => acc + s.totalInstructorDays, 0);

    const kpisHtml = `
      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-bottom:9px;">
        <div data-tip="לחץ לסינון והצגת ספקים עם שיבוץ בלבד" style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:6px 8px; text-align:center; cursor:pointer;" onclick="document.getElementById('gexp-inst-status').value = document.getElementById('gexp-inst-status').value==='active'?'all':'active'; window.onInstFilterChange();">
          <div style="font-size:1.05rem; font-weight:800; color:#15803d;">${activeCount}</div>
          <div style="font-size:0.71rem; color:#166534; font-weight:700;">ספקים משובצים</div>
        </div>
        <div data-tip="לחץ לסינון ספקים שלא שובצו כלל בטווח התאריכים" style="background:${zeroCount > 0 ? '#fef2f2' : '#f8fafc'}; border:1px solid ${zeroCount > 0 ? '#fecaca' : '#e2e8f0'}; border-radius:8px; padding:6px 8px; text-align:center; cursor:pointer;" onclick="document.getElementById('gexp-inst-status').value = document.getElementById('gexp-inst-status').value==='zero'?'all':'zero'; window.onInstFilterChange();">
          <div style="font-size:1.05rem; font-weight:800; color:${zeroCount > 0 ? '#dc2626' : '#64748b'};">${zeroCount}</div>
          <div style="font-size:0.71rem; color:${zeroCount > 0 ? '#991b1b' : '#64748b'}; font-weight:700;">ללא שיבוץ כלל (0)</div>
        </div>
        <div data-tip="לחץ לסינון ספקים עם שיא של 3 מדריכים ומעלה ביום אחד" style="background:${highCount > 0 ? '#fff7ed' : '#f8fafc'}; border:1px solid ${highCount > 0 ? '#fed7aa' : '#e2e8f0'}; border-radius:8px; padding:6px 8px; text-align:center; cursor:pointer;" onclick="document.getElementById('gexp-inst-status').value = document.getElementById('gexp-inst-status').value==='high'?'all':'high'; window.onInstFilterChange();">
          <div style="font-size:1.05rem; font-weight:800; color:${highCount > 0 ? '#ea580c' : '#64748b'};">${highCount}</div>
          <div style="font-size:0.71rem; color:${highCount > 0 ? '#9a3412' : '#64748b'}; font-weight:700;">עומס (3+ מדריכים ביום)</div>
        </div>
        <div style="background:#eef2ff; border:1px solid #c7d2fe; border-radius:8px; padding:6px 8px; text-align:center;">
          <div style="font-size:1.05rem; font-weight:800; color:#1d4ed8;">${grandTotalInstDays}</div>
          <div style="font-size:0.71rem; color:#1e3a8a; font-weight:700;">סה"כ ימי מדריך בטווח</div>
        </div>
      </div>`;

    const rowsHtml = data.filteredSuppliers.map(sup => {
      const idx = _instSupList.findIndex(x => x.base === sup.base);
      const isZero = sup.totalInstructorDays === 0 && (sup.unclusteredCount || 0) === 0;
      const isHigh = sup.peakDayCount >= 3;
      const rowBg = isZero ? '#fff5f5' : (isHigh ? '#fffaf5' : '#ffffff');

      const citiesBreakdown = sup.totalInstructorDays === 0
        ? `<span style="color:#dc2626; font-weight:700; font-size:0.76rem;">🔴 לא שובץ באשכולות בטווח התאריכים</span>`
        : sup.cities.map(cb => {
            const daysPills = cb.activeDays.map(ad => {
              const uStr = data.incUnits ? ` [${ad.units.map(u => _esc(u.name)).join(', ')}]` : '';
              return `${_shortDate(ad.ds)}: <b>${ad.count}</b>${uStr}`;
            }).join(' · ');
            return `<div style="margin-bottom:2px; font-size:0.76rem;"><b style="color:#1e293b;">${_esc(cb.city)}:</b> <span style="color:#334155;">${daysPills}</span></div>`;
          }).join('');

      const peakBadge = sup.totalInstructorDays === 0
        ? '—'
        : `<span style="background:${isHigh ? '#ffedd5' : '#e0f2fe'}; color:${isHigh ? '#c2410c' : '#0369a1'}; border:1px solid ${isHigh ? '#fdba74' : '#bae6fd'}; border-radius:6px; padding:2px 6px; font-size:0.73rem; font-weight:800; white-space:nowrap;">${isHigh ? '🔥 ' : ''}${sup.peakDayCount} (${_shortDate(sup.peakDayDs)})</span>`;

      const quickBtns = isZero
        ? ''
        : `<div style="display:flex; gap:3px; justify-content:center; flex-wrap:nowrap;">
            <button type="button" onclick="window.selectInstSupplierByIdx(${idx})" data-tip="הצג פירוט מלא ולו״ז שיבוצים של הספק" aria-label="הצג פירוט מלא לספק" style="background:#eef2ff; border:1px solid #c7d2fe; color:#1e3a8a; border-radius:5px; padding:3px 6px; font-size:0.72rem; font-weight:700; cursor:pointer;">👁️</button>
            <button type="button" onclick="window.doInstQuickFullWA(${idx})" data-tip="העתק לו״ז שיבוצים מלא בהודעה לוואטסאפ (גנים, כתובות ושעות) עבור ספק זה" aria-label="העתק לו״ז מלא בהודעה" style="background:#ccfbf1; border:1px solid #5eead4; color:#0f766e; border-radius:5px; padding:3px 6px; font-size:0.72rem; font-weight:800; cursor:pointer;">📲</button>
            <button type="button" onclick="window.doInstQuickWA(${idx})" data-tip="העתק הודעת כמות מדריכים ליום לוואטסאפ עבור ספק זה" aria-label="העתק הודעת כמות מדריכים" style="background:#dcfce7; border:1px solid #86efac; color:#166534; border-radius:5px; padding:3px 6px; font-size:0.72rem; font-weight:800; cursor:pointer;">💬</button>
            <button type="button" onclick="window.doInstQuickImage(${idx})" data-tip="העתק כרטיס תמונה מעוצב של לו״ז המדריכים לספק זה (להדבקה ב-Ctrl+V בוואטסאפ)" aria-label="העתק כרטיס תמונה לוואטסאפ" style="background:#fdf2f8; border:1px solid #f9a8d4; color:#9d174d; border-radius:5px; padding:3px 6px; font-size:0.72rem; font-weight:800; cursor:pointer;">🖼️</button>
          </div>`;

      return `<tr style="background:${rowBg}; border-bottom:1px solid #e2e8f0;">
        <td style="padding:6px 8px; font-weight:800; color:#0f172a; font-size:0.81rem;">
          ${_esc(sup.dispName)}
          ${sup.unclusteredCount > 0 ? `<div onclick="window.setGridExportTab('gaps')" style="font-size:0.68rem; color:#b45309; font-weight:700; cursor:pointer; text-decoration:underline;">⚠️ +${sup.unclusteredCount} גנים ללא אשכול</div>` : ''}
        </td>
        <td style="padding:6px 6px; text-align:center; font-weight:800; font-size:0.84rem; color:${isZero ? '#dc2626' : '#15803d'};">${sup.totalInstructorDays}</td>
        <td style="padding:6px 6px; text-align:center;">${peakBadge}</td>
        <td style="padding:6px 8px;">${citiesBreakdown}</td>
        <td style="padding:6px 6px; text-align:center;">${quickBtns}</td>
      </tr>`;
    }).join('');

    wrap.innerHTML = `
      ${kpisHtml}
      <div style="border:1px solid #cbd5e1; border-radius:9px; overflow:hidden; background:#fff;">
        <div style="max-height:345px; overflow-y:auto;">
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="background:#e8eaf6; color:#1e3a8a; position:sticky; top:0; z-index:2; font-size:0.76rem;">
                <th style="padding:6px 8px; text-align:right; width:21%;">מפעיל / ספק</th>
                <th style="padding:6px 6px; text-align:center; width:10%;">ימי מדריך</th>
                <th style="padding:6px 6px; text-align:center; width:14%;">שיא ליום</th>
                <th style="padding:6px 8px; text-align:right;">פירוט ערים ומס' מדריכים ליום</th>
                <th style="padding:6px 6px; text-align:center; width:18%;">לספק</th>
              </tr>
            </thead>
            <tbody>${rowsHtml || '<tr><td colspan="5" style="text-align:center; padding:14px; color:#64748b;">אין ספקים להצגה בסינון זה</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
  }

  // Build formatted WhatsApp text for one supplier (instructor count summary)
  function _buildSingleSupplierWAText(sup, data) {
    const titlePrefix = data.detectedHolName ? `${data.detectedHolName} – ` : '';
    let lines = [];
    lines.push(`📋 *היערכות מדריכים – ${titlePrefix}${sup.dispName}*`);
    lines.push(`📅 *תאריכים: ${data.dateRangePart}*`);
    lines.push('');

    sup.cities.forEach(cb => {
      lines.push(`🏙️ *${cb.city}:*`);
      cb.activeDays.forEach(ad => {
        const uTxt = data.incUnits ? ` (${ad.units.map(u => u.name).join(', ')})` : '';
        lines.push(`${cb.city} ${_shortDate(ad.ds)} (${_shortDay(ad.ds)}) - ${_fmtInstructors(ad.count)}${uTxt}`);
      });
      lines.push('');
    });

    if (data.incDailyTot && sup.cities.length > 0) {
      lines.push(`📊 *סה"כ מדריכים ליום (כל הערים יחד):*`);
      data.days.forEach(ds => {
        const cnt = sup.dailyTotals.get(ds) || 0;
        if (cnt > 0) {
          lines.push(`• ${_shortDate(ds)} (${_shortDay(ds)}) - ${_fmtInstructors(cnt)}`);
        }
      });
    }

    return lines.join('\n').trim();
  }

  // Build FULL detailed schedule WhatsApp text for one supplier (dates, cities, clusters, gardens, addresses, hours)
  function _buildSupplierFullScheduleWAText(sup, sched, data) {
    const RLM = '\u200F';
    const titlePrefix = data.detectedHolName ? `${data.detectedHolName} – ` : '';
    const lines = [];
    lines.push(`${RLM}📅 *לו"ז שיבוצים מלא – ${titlePrefix}${sup.dispName}*`);
    lines.push(`${RLM}🗓️ *תאריכים: ${data.dateRangePart}*`);
    lines.push('');

    sched.daysList.forEach(dayObj => {
      const fullDay = typeof window.dayN === 'function' ? `יום ${window.dayN(dayObj.ds)}` : _shortDay(dayObj.ds);
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push(`${RLM}🗓️ *${fullDay} | ${window.fD(dayObj.ds)}*`);

      dayObj.cities.forEach(cObj => {
        const instTag = cObj.instCount > 0 ? ` (${_fmtInstructors(cObj.instCount)})` : '';
        lines.push(`${RLM}🏙️ *${cObj.city}*${instTag}`);

        cObj.units.forEach(u => {
          if (data.splitMsg) {
            u.events.forEach(ev => {
              if (data.incCluster !== false) {
                if (u.type === 'cluster') lines.push(`${RLM}📦 *אשכול: ${u.name}*`);
                else if (u.type === 'pair') lines.push(`${RLM}⚖️ *זוג: ${u.name}*`);
              }
              if (data.incAddr !== false && ev.gd.st) {
                lines.push(`${RLM}📍 ${ev.gd.st}`);
              }
              const actName = ev.act || (typeof window.supAct === 'function' ? window.supAct(ev.a) : '') || '';
              const actPart = actName && actName !== sup.dispName && actName !== sup.base ? ` (${actName})` : '';

              let actualGrp = ev.grp ? String(ev.grp).trim() : String(window.ggr ? window.ggr(ev.gd) || '' : '');
              const grpPart = (actualGrp && actualGrp !== '1' && actualGrp !== '0')
                ? ` · ${actualGrp.includes(',') ? "קב' " + actualGrp : actualGrp + " קב'"}`
                : '';

              const timeVal = ev.t ? (typeof window.fT === 'function' ? window.fT(ev.t) : ev.t) : '';
              const timePart = timeVal ? ` · ⏰ ${timeVal}` : (ev.flexNote ? ` · ℹ️ ${ev.flexNote}` : '');
              const gNameFormatted = (window.WAExport && window.WAExport.formatGardenName)
                ? window.WAExport.formatGardenName(ev.gd, { incAge: data.incAge })
                : `${(ev.gd.name || '').trimEnd()}${data.incAge ? (window.getGardenAgeTag?.(ev.gd) || '') : ''}`;

              lines.push(`${RLM}🏫 *${gNameFormatted}*${actPart}${grpPart}${timePart}`);

              if (data.incCoord) {
                const cLbl = _getCoordinatorLabel(ev.gid);
                if (cLbl) lines.push(`${RLM}   👤 רכז/ת: ${cLbl}`);
              }
              if (data.incFreeDays) {
                const freeDaysStr = (window.WAExport && window.WAExport.getFreeDaysText)
                  ? window.WAExport.getFreeDaysText(ev.gid, dayObj.ds)
                  : (typeof window.getGardenFreeDays === 'function' ? window.getGardenFreeDays(ev.gid, dayObj.ds) : '');
                if (freeDaysStr) lines.push(`${RLM}*ימים פנויים : ${freeDaysStr}*`);
              }
              lines.push('');
            });
            return;
          }

          if (data.incCluster !== false) {
            if (u.type === 'cluster') {
              lines.push(`${RLM}📦 *אשכול: ${u.name}*`);
            } else if (u.type === 'pair') {
              lines.push(`${RLM}⚖️ *זוג: ${u.name}*`);
            }
          }

          const unitCoords = data.incCoord
            ? Array.from(new Set(u.events.map(ev => _getCoordinatorLabel(ev.gid)).filter(Boolean)))
            : [];
          const sharedUnitCoord = (u.events.length > 1 && unitCoords.length === 1) ? unitCoords[0] : '';

          // Group consecutive events that share the same normalized street address
          const normAddr = (st) => String(st || '').trim().replace(/\s+/g, ' ');
          const addrRuns = [];
          u.events.forEach(ev => {
            const rawSt = (data.incAddr !== false) ? String(ev.gd.st || '').trim() : '';
            const nSt = normAddr(rawSt);
            const prev = addrRuns[addrRuns.length - 1];
            if (prev && nSt && prev.normAddr === nSt) {
              prev.events.push(ev);
            } else {
              addrRuns.push({ normAddr: nSt, displayAddr: rawSt, events: [ev] });
            }
          });

          const baseIndent = (data.incCluster !== false && (u.type === 'cluster' || u.type === 'pair')) ? '  ' : '';

          addrRuns.forEach(run => {
            const isSharedAddr = data.incAddr !== false && !!(run.normAddr && run.events.length > 1);
            let evIndent = baseIndent;
            if (isSharedAddr) {
              // If the entire cluster/pair shares one address, print 📍 right under the cluster header; otherwise indent slightly
              const addrHeaderIndent = addrRuns.length === 1 ? '' : baseIndent;
              evIndent = addrRuns.length === 1 ? (baseIndent || '  ') : (baseIndent + '  ');
              lines.push(`${RLM}${addrHeaderIndent}📍 ${run.displayAddr}`);
            }

            run.events.forEach(ev => {
              const actName = ev.act || (typeof window.supAct === 'function' ? window.supAct(ev.a) : '') || '';
              const actPart = actName && actName !== sup.dispName && actName !== sup.base ? ` (${actName})` : '';

              let actualGrp = ev.grp ? String(ev.grp).trim() : String(window.ggr ? window.ggr(ev.gd) || '' : '');
              const grpPart = (actualGrp && actualGrp !== '1' && actualGrp !== '0')
                ? ` · ${actualGrp.includes(',') ? "קב' " + actualGrp : actualGrp + " קב'"}`
                : '';

              const timeVal = ev.t ? (typeof window.fT === 'function' ? window.fT(ev.t) : ev.t) : '';
              const timePart = timeVal ? ` · ⏰ ${timeVal}` : (ev.flexNote ? ` · ℹ️ ${ev.flexNote}` : '');
              const addrPart = (data.incAddr !== false && !isSharedAddr && ev.gd.st) ? ` · 📍 ${ev.gd.st}` : '';
              const gNameFormatted = (window.WAExport && window.WAExport.formatGardenName)
                ? window.WAExport.formatGardenName(ev.gd, { incAge: data.incAge })
                : `${(ev.gd.name || '').trimEnd()}${data.incAge ? (window.getGardenAgeTag?.(ev.gd) || '') : ''}`;

              lines.push(`${RLM}${evIndent}🏫 *${gNameFormatted}*${actPart}${grpPart}${timePart}${addrPart}`);

              if (data.incCoord && !sharedUnitCoord) {
                const cLbl = _getCoordinatorLabel(ev.gid);
                if (cLbl) {
                  lines.push(`${RLM}${evIndent}   👤 רכז/ת: ${cLbl}`);
                }
              }
            });
          });

          if (data.incCoord && sharedUnitCoord) {
            lines.push(`${RLM}   👤 רכז/ת: ${sharedUnitCoord}`);
          }

          if (data.incFreeDays) {
            const unitGids = u.events.map(ev => ev.gid);
            const freeDaysStr = (window.WAExport && window.WAExport.getFreeDaysText)
              ? window.WAExport.getFreeDaysText(unitGids, dayObj.ds)
              : (typeof window.getGardenFreeDays === 'function' ? window.getGardenFreeDays(unitGids, dayObj.ds) : '');
            if (freeDaysStr) {
              lines.push(`${RLM}${baseIndent}*ימים פנויים : ${freeDaysStr}*`);
            }
          }
        });
        lines.push('');
      });
    });

    if (data.incDailyTot && sup.cities && sup.cities.length > 0 && sched.daysList.length > 1) {
      lines.push(`${RLM}📊 *סיכום מדריכים ליום:*`);
      data.days.forEach(ds => {
        const cnt = sup.dailyTotals.get(ds) || 0;
        if (cnt > 0) {
          lines.push(`${RLM}• ${_shortDate(ds)} (${_shortDay(ds)}) – ${_fmtInstructors(cnt)}`);
        }
      });
    }

    return lines.join('\n').trim();
  }

  window.doInstQuickWA = async function (idx) {
    const sup = _instSupList[idx];
    if (!sup) return;
    const data = _collectInstructorsData(sup.base);
    const targetSup = data.filteredSuppliers[0];
    if (!targetSup || targetSup.totalInstructorDays === 0) return;
    const text = _buildSingleSupplierWAText(targetSup, data);
    try {
      await navigator.clipboard.writeText(text);
      window.showToast?.(`💬 הודעת היערכות מדריכים עבור "${targetSup.dispName}" הועתקה ללוח!`);
    } catch (e) {
      window.spAlert(text);
    }
  };

  window.doInstQuickFullWA = async function (idx) {
    const sup = _instSupList[idx];
    if (!sup) return;
    const data = _collectInstructorsData(sup.base);
    const targetSup = data.filteredSuppliers[0] || sup;
    const sched = _collectSupplierFullSchedule(sup.base, data);
    if (!sched.totalEvents) {
      window.spAlert('לא נמצאו שיבוצים פעילים לספק זה בטווח שנבחר.');
      return;
    }
    const text = _buildSupplierFullScheduleWAText(targetSup, sched, data);
    try {
      await navigator.clipboard.writeText(text);
      window.showToast?.(`📲 הלו"ז המלא (${sched.totalEvents} שיבוצים) עבור "${targetSup.dispName}" הועתק לוואטסאפ!`);
    } catch (e) {
      window.spAlert(text);
    }
  };

  window.doInstExportWhatsAppText = async function () {
    const data = _collectInstructorsData();
    const activeSups = data.filteredSuppliers.filter(s => s.totalInstructorDays > 0);
    if (!activeSups.length) {
      window.spAlert('אין ספקים עם שיבוצים להעתקה בטווח שנבחר.');
      return;
    }

    const text = activeSups.map(sup => _buildSingleSupplierWAText(sup, data)).join('\n\n────────────────────\n\n');
    try {
      await navigator.clipboard.writeText(text);
      window.showToast?.(activeSups.length === 1
        ? `💬 הודעת כמות מדריכים עבור "${activeSups[0].dispName}" הועתקה לוואטסאפ!`
        : `💬 הועתק פירוט מדריכים עבור ${activeSups.length} ספקים!`);
    } catch (e) {
      window.spAlert(text);
    }
  };

  window.doInstExportFullScheduleWA = async function () {
    const data = _collectInstructorsData();
    const blocks = [];
    let totalEvsCount = 0;

    data.filteredSuppliers.forEach(sup => {
      const sched = _collectSupplierFullSchedule(sup.base, data);
      if (sched.totalEvents > 0) {
        totalEvsCount += sched.totalEvents;
        blocks.push({ sup, text: _buildSupplierFullScheduleWAText(sup, sched, data) });
      }
    });

    if (!blocks.length) {
      window.spAlert('אין שיבוצים פעילים להעתקת לו"ז מלא בטווח ובסינון שנבחרו.');
      return;
    }

    const text = blocks.map(b => b.text).join('\n\n════════════════════\n\n');
    try {
      await navigator.clipboard.writeText(text);
      window.showToast?.(blocks.length === 1
        ? `📲 הלו"ז המלא של "${blocks[0].sup.dispName}" (${totalEvsCount} שיבוצים) הועתק לוואטסאפ!`
        : `📲 הועתק הלו"ז המלא עבור ${blocks.length} ספקים (${totalEvsCount} שיבוצים)!`);
    } catch (e) {
      window.spAlert(text);
    }
  };

  // ════════════════════════════════════════════════════════════════════
  // INSTRUCTORS EXCEL EXPORT (.xlsx: Per-City Matrix + Load Control + Gaps)
  // ════════════════════════════════════════════════════════════════════
  window.doInstExportExcel = async function () {
    const data = _collectInstructorsData();
    if (!data.days.length) {
      window.spAlert('לא נמצאו ימי פעילות בטווח התאריכים.');
      return;
    }

    if (typeof window.ExcelJS === 'undefined') {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js';
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      } catch (e) {
        window.spAlert('שגיאה בטעינת ספריית האקסל.');
        return;
      }
    }

    try {
      const wb = new window.ExcelJS.Workbook();
      wb.creator = 'טומשין קידס';
      wb.created = new Date();

      const thinBorder = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };

      const titlePrefix = data.detectedHolName ? `${data.detectedHolName} - ` : '';

      // ── CASE A: SINGLE SUPPLIER PERSONAL EXCEL ──
      if (data.supFilter) {
        const sup = data.filteredSuppliers[0];
        if (!sup || sup.totalInstructorDays === 0) {
          window.spAlert('לספק זה אין שיבוצים בטווח שנבחר.');
          return;
        }
        const sName = String(sup.dispName).replace(/[*?:[\]/\\]/g, '').trim().slice(0, 28) || 'ספק';
        const ws = wb.addWorksheet(sName, {
          views: [{ rightToLeft: true, state: 'frozen', ySplit: 2, xSplit: 1 }],
          pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
        });

        const totalCols = 1 + data.days.length + 1;
        ws.getColumn(1).width = 22;
        data.days.forEach((_, i) => { ws.getColumn(2 + i).width = 16; });
        ws.getColumn(totalCols).width = 16;

        const r1 = ws.addRow([`היערכות מדריכים – ${titlePrefix}${sup.dispName} (${data.dateRangePart})`]);
        r1.height = 28;
        ws.mergeCells(1, 1, 1, totalCols);
        r1.getCell(1).font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
        r1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } };
        r1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rightToLeft' };

        const hdrs = ['עיר', ...data.days.map(ds => `${_shortDay(ds)}\n${window.fD(ds)}`), 'סה"כ בעיר'];
        const r2 = ws.addRow(hdrs);
        r2.height = 34;
        for (let c = 1; c <= totalCols; c++) {
          const cell = r2.getCell(c);
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E3A8A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder: 'rightToLeft' };
          cell.border = thinBorder;
        }

        sup.cities.forEach(cb => {
          const vals = [cb.city];
          data.days.forEach(ds => {
            const uMap = cb.daysMap.get(ds);
            const cnt = uMap ? uMap.size : 0;
            if (!cnt) {
              vals.push('');
            } else if (data.incUnits) {
              const uNames = Array.from(uMap.values()).map(u => u.name).join(', ');
              vals.push(`${_fmtInstructors(cnt)}\n(${uNames})`);
            } else {
              vals.push(cnt);
            }
          });
          vals.push(cb.cityTotal);
          const row = ws.addRow(vals);
          row.height = data.incUnits ? 34 : 24;
          for (let c = 1; c <= totalCols; c++) {
            const cell = row.getCell(c);
            cell.font = { name: 'Arial', size: 10, bold: c === 1 || c === totalCols };
            cell.alignment = { horizontal: c === 1 ? 'right' : 'center', vertical: 'middle', wrapText: true, readingOrder: 'rightToLeft' };
            if (c > 1 && c < totalCols && cell.value) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7FF' } };
            }
            cell.border = thinBorder;
          }
        });

        // Daily Totals Row
        const totVals = ['סה"כ מדריכים ליום'];
        data.days.forEach(ds => totVals.push(sup.dailyTotals.get(ds) || 0));
        totVals.push(sup.totalInstructorDays);
        const totRow = ws.addRow(totVals);
        totRow.height = 26;
        for (let c = 1; c <= totalCols; c++) {
          const cell = totRow.getCell(c);
          cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF1E3A8A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
          cell.alignment = { horizontal: c === 1 ? 'right' : 'center', vertical: 'middle', readingOrder: 'rightToLeft' };
          cell.border = thinBorder;
        }

        // Detailed text list below matrix
        ws.addRow([]);
        const detHdr = ws.addRow(['פירוט ימי פעילות לפי עיר (ימים פעילים בלבד):']);
        detHdr.getCell(1).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1A237E' } };
        detHdr.getCell(1).alignment = { horizontal: 'right', readingOrder: 'rightToLeft' };
        ws.mergeCells(detHdr.number, 1, detHdr.number, totalCols);

        sup.cities.forEach(cb => {
          cb.activeDays.forEach(ad => {
            const uTxt = data.incUnits ? ` (${ad.units.map(u => u.name).join(', ')})` : '';
            const lr = ws.addRow([cb.city, `${_shortDate(ad.ds)} (${_shortDay(ad.ds)})`, _fmtInstructors(ad.count) + uTxt]);
            for (let c = 1; c <= 3; c++) {
              lr.getCell(c).font = { name: 'Arial', size: 10, bold: c === 1 || c === 3 };
              lr.getCell(c).alignment = { horizontal: 'right', readingOrder: 'rightToLeft' };
            }
          });
        });

        const buf = await wb.xlsx.writeBuffer();
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const fName = `היערכות מדריכים - ${sup.dispName.replace(/[/\\?%*:|"<>]/g, '_')} (${data.minDs}).xlsx`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fName; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        window.showToast?.(`📊 קובץ האקסל לספק הורד: ${fName}`);
        return;
      }

      // ── CASE B: ALL SUPPLIERS MASTER WORKBOOK (2–3 SHEETS) ──
      // Sheet 1: ריכוז מדריכים לפי עיר ויום (Upgraded version of user's screenshot!)
      const ws1 = wb.addWorksheet('ריכוז מדריכים לפי עיר ויום', {
        views: [{ rightToLeft: true, state: 'frozen', ySplit: 2, xSplit: 2 }],
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
      });

      const cols1 = 2 + data.days.length + 2; // שם המפעיל | עיר | ימים... | סה"כ | הערות
      ws1.getColumn(1).width = 23;
      ws1.getColumn(2).width = 16;
      data.days.forEach((_, i) => { ws1.getColumn(3 + i).width = 14; });
      ws1.getColumn(3 + data.days.length).width = 12;
      ws1.getColumn(cols1).width = 28;

      const tRow1 = ws1.addRow([`${titlePrefix}ריכוז מפעילי חוגים ומס' מדריכים לפי ערים וימים (${data.dateRangePart})`]);
      tRow1.height = 28;
      ws1.mergeCells(1, 1, 1, cols1);
      tRow1.getCell(1).font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      tRow1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } };
      tRow1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rightToLeft' };

      const hRow1 = ws1.addRow(['שם המפעיל', 'עיר', ...data.days.map(ds => `${_shortDay(ds)}\n${window.fD(ds)}`), 'סה"כ', 'הערות / פירוט']);
      hRow1.height = 34;
      for (let c = 1; c <= cols1; c++) {
        const cell = hRow1.getCell(c);
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E3A8A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder: 'rightToLeft' };
        cell.border = thinBorder;
      }

      const activeSupsSorted = [...data.allSuppliers]
        .filter(s => s.totalInstructorDays > 0)
        .sort((a, b) => a.dispName.localeCompare(b.dispName, 'he'));

      const grandByDay = new Map();
      data.days.forEach(ds => grandByDay.set(ds, 0));
      let grandAll = 0;

      activeSupsSorted.forEach(sup => {
        sup.cities.forEach(cb => {
          const rowVals = [sup.dispName, cb.city];
          const unitNotes = new Set();
          data.days.forEach(ds => {
            const uMap = cb.daysMap.get(ds);
            const cnt = uMap ? uMap.size : 0;
            rowVals.push(cnt > 0 ? cnt : '');
            if (cnt > 0) {
              grandByDay.set(ds, (grandByDay.get(ds) || 0) + cnt);
              grandAll += cnt;
              uMap.forEach(u => unitNotes.add(u.name));
            }
          });
          rowVals.push(cb.cityTotal);
          rowVals.push(data.incUnits ? Array.from(unitNotes).join(', ') : '');
          const r = ws1.addRow(rowVals);
          r.height = 22;
          for (let c = 1; c <= cols1; c++) {
            const cell = r.getCell(c);
            cell.font = { name: 'Arial', size: 10, bold: c === 1 || c === cols1 - 1 };
            cell.alignment = {
              horizontal: (c <= 2 || c === cols1) ? 'right' : 'center',
              vertical: 'middle',
              wrapText: true,
              readingOrder: 'rightToLeft'
            };
            if (c >= 3 && c < cols1 - 1 && cell.value) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7FF' } };
            }
            cell.border = thinBorder;
          }
        });
      });

      const sumRow1 = ws1.addRow(['סה"כ מדריכים ביום', '', ...data.days.map(ds => grandByDay.get(ds) || 0), grandAll, '']);
      sumRow1.height = 25;
      for (let c = 1; c <= cols1; c++) {
        const cell = sumRow1.getCell(c);
        cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF1E3A8A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
        cell.alignment = { horizontal: c <= 2 ? 'right' : 'center', vertical: 'middle', readingOrder: 'rightToLeft' };
        cell.border = thinBorder;
      }

      ws1.autoFilter = { from: { row: 2, column: 1 }, to: { row: Math.max(2, sumRow1.number - 1), column: cols1 } };

      // Sheet 2: בקרת עומסים וחוסרי שיבוץ (Includes 0-placement suppliers!)
      const ws2 = wb.addWorksheet('בקרת עומסים וחוסרי שיבוץ', {
        views: [{ rightToLeft: true, state: 'frozen', ySplit: 2 }],
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
      });
      ws2.columns = [
        { width: 25 }, { width: 18 }, { width: 15 }, { width: 18 }, { width: 12 }, { width: 38 }, { width: 26 }
      ];
      const tRow2 = ws2.addRow([`בקרת הקצאת ספקים, עומסים וספקים ללא שיבוץ (${data.dateRangePart})`]);
      tRow2.height = 28;
      ws2.mergeCells(1, 1, 1, 7);
      tRow2.getCell(1).font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      tRow2.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      tRow2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rightToLeft' };

      const hRow2 = ws2.addRow(['שם המפעיל', 'סטטוס בטווח', 'סה"כ ימי מדריך', 'שיא מדריכים ביום', 'מס\' ערים', 'פירוט ערים', 'התראות']);
      hRow2.height = 28;
      for (let c = 1; c <= 7; c++) {
        const cell = hRow2.getCell(c);
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E3A8A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rightToLeft' };
        cell.border = thinBorder;
      }

      data.allSuppliers.forEach(sup => {
        const isZero = sup.totalInstructorDays === 0;
        const isLow = sup.totalInstructorDays >= 1 && sup.totalInstructorDays <= 2;
        const isHigh = sup.peakDayCount >= 3;
        const statusLbl = isZero ? 'ללא שיבוץ (0)' : (isHigh ? 'עומס גבוה' : (isLow ? 'מעט שיבוצים' : 'משובץ תקין'));
        const peakLbl = isZero ? '0' : `${sup.peakDayCount} (${_shortDate(sup.peakDayDs)})`;
        const citiesStr = sup.cities.map(c => `${c.city} (${c.cityTotal})`).join(', ');
        const warnStr = sup.unclusteredCount > 0 ? `${sup.unclusteredCount} גנים ללא אשכול` : '';

        const r = ws2.addRow([sup.dispName, statusLbl, sup.totalInstructorDays, peakLbl, sup.cities.length, citiesStr, warnStr]);
        r.height = 22;
        const bgArgb = isZero ? 'FFFEF2F2' : (isHigh ? 'FFFFF7ED' : (isLow ? 'FFFEFCE8' : 'FFFFFFFF'));
        for (let c = 1; c <= 7; c++) {
          const cell = r.getCell(c);
          cell.font = {
            name: 'Arial',
            size: 10,
            bold: c === 1 || c === 2 || c === 3,
            color: { argb: isZero && c <= 3 ? 'FFB91C1C' : 'FF1E293B' }
          };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
          cell.alignment = { horizontal: (c === 1 || c >= 6) ? 'right' : 'center', vertical: 'middle', readingOrder: 'rightToLeft' };
          cell.border = thinBorder;
        }
      });

      // Sheet 3 (if gaps exist): חריגים וגנים לטיפול
      if ((data.unclusteredGardens && data.unclusteredGardens.length > 0) || (data.imbalancedClusters && data.imbalancedClusters.length > 0) || (data.zeroInActiveClusters && data.zeroInActiveClusters.length > 0)) {
        const ws3 = wb.addWorksheet('גנים לטיפול והשלמת שיבוץ', {
          views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
        });
        ws3.columns = [{ width: 26 }, { width: 16 }, { width: 20 }, { width: 24 }, { width: 36 }];
        const hr3 = ws3.addRow(['סוג חריג', 'עיר', 'אשכול', 'שם הגן', 'פירוט']);
        hr3.height = 26;
        for (let c = 1; c <= 5; c++) {
          hr3.getCell(c).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          hr3.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB45309' } };
          hr3.getCell(c).alignment = { horizontal: 'right', vertical: 'middle', readingOrder: 'rightToLeft' };
        }
        (data.unclusteredGardens || []).forEach(u => {
          const det = u.items.map(it => `${_shortDate(it.ds)} ${it.supDisp}`).join(' | ');
          const r = ws3.addRow(['גן משובץ ללא אשכול', u.city, '— ללא אשכול —', u.g.name, det]);
          for (let c = 1; c <= 5; c++) r.getCell(c).alignment = { horizontal: 'right', readingOrder: 'rightToLeft' };
        });
        (data.imbalancedClusters || []).forEach(ic => {
          ic.gaps.forEach(g => {
            const gapDesc = [];
            if (g.diffM > 0) gapDesc.push(`חסר ${g.diffM} חוג בוקר (שובצו ${g.mCount}/${ic.maxMorning})`);
            if (g.diffT > 0) gapDesc.push(`חסר ${g.diffT} חוג צהרון (שובצו ${g.tCount}/${ic.maxTzaharon})`);
            const r = ws3.addRow(['פער כמותי באשכול', ic.city, ic.clName, g.fullName, gapDesc.join(' | ')]);
            for (let c = 1; c <= 5; c++) r.getCell(c).alignment = { horizontal: 'right', readingOrder: 'rightToLeft' };
          });
        });
        (data.zeroInActiveClusters || []).forEach(zc => {
          zc.missedGardens.forEach(mg => {
            const r = ws3.addRow(['0 שיבוצים בטווח באשכול פעיל', zc.city, zc.clName, mg.name, `${zc.scheduledCount}/${zc.totalMembers} גנים אחרים באשכול שובצו`]);
            for (let c = 1; c <= 5; c++) r.getCell(c).alignment = { horizontal: 'right', readingOrder: 'rightToLeft' };
          });
        });
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const fName = `${titlePrefix}ריכוז מדריכים ובקרת ספקים (${data.minDs}${data.minDs !== data.maxDs ? '_' + data.maxDs : ''}).xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fName; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.showToast?.(`📊 דוח האקסל המרוכז הורד: ${fName}`);
    } catch (err) {
      console.error('[InstExport Excel]', err);
      window.spAlert('שגיאה בייצוא לאקסל: ' + err.message);
    }
  };

  // ════════════════════════════════════════════════════════════════════
  // VISUAL HTML BUILDER FOR INSTRUCTORS (PDF & JPG / WhatsApp Image)
  // ════════════════════════════════════════════════════════════════════
  function _buildInstVisualCardHtml(supOrNull, data, forCanvas) {
    const tx = forCanvas ? _rtlFix : _esc;
    const titlePrefix = data.detectedHolName ? `${data.detectedHolName} – ` : '';

    // Single Supplier Visual Preparation Sheet
    if (supOrNull) {
      const sup = supOrNull;
      let thead = `<thead><tr><th style="width:20%; text-align:right; padding-right:8px;">${tx('עיר')}</th>`;
      data.days.forEach(ds => {
        thead += `<th><div>${tx(_shortDay(ds))}</div><div>${tx(_shortDate(ds))}</div></th>`;
      });
      thead += `<th style="width:12%;">${tx('סה"כ')}</th></tr></thead>`;

      let tbody = '<tbody>';
      sup.cities.forEach(cb => {
        tbody += `<tr><td class="gx-garden-td"><div class="gx-gname">${tx(cb.city)}</div></td>`;
        data.days.forEach(ds => {
          const uMap = cb.daysMap.get(ds);
          const cnt = uMap ? uMap.size : 0;
          if (cnt > 0) {
            const uNames = data.incUnits ? `<div style="font-size:9px; color:#475569; margin-top:2px;">${tx(Array.from(uMap.values()).map(u => u.name).join(', '))}</div>` : '';
            tbody += `<td class="gx-cell" style="background:#f0f7ff; text-align:center; vertical-align:middle;"><div style="font-weight:800; color:#1565c0; font-size:12px;">${tx(_fmtInstructors(cnt))}</div>${uNames}</td>`;
          } else {
            tbody += `<td class="gx-cell" style="text-align:center; vertical-align:middle; color:#cbd5e1;">—</td>`;
          }
        });
        tbody += `<td class="gx-cell" style="background:#f8fafc; text-align:center; vertical-align:middle; font-weight:800; color:#0f172a;">${cb.cityTotal}</td></tr>`;
      });

      if (data.incDailyTot) {
        tbody += `<tr class="gx-group-row"><td style="text-align:right; padding-right:8px;">${tx('סה"כ מדריכים ליום')}</td>`;
        data.days.forEach(ds => {
          const cnt = sup.dailyTotals.get(ds) || 0;
          tbody += `<td style="text-align:center;">${cnt > 0 ? tx(_fmtInstructors(cnt)) : '—'}</td>`;
        });
        tbody += `<td style="text-align:center;">${sup.totalInstructorDays}</td></tr>`;
      }
      tbody += '</tbody>';

      const cityCards = sup.cities.map(cb => {
        const rows = cb.activeDays.map(ad => {
          const uStr = data.incUnits ? ` (${ad.units.map(u => u.name).join(', ')})` : '';
          return `<div style="font-size:11.5px; padding:2px 0; border-bottom:1px dashed #e2e8f0; color:#1e293b;">
            <b>${tx(cb.city)} ${tx(_shortDate(ad.ds))}</b> (${tx(_shortDay(ad.ds))}) – <b style="color:#1565c0;">${tx(_fmtInstructors(ad.count))}</b>${uStr ? tx(uStr) : ''}
          </div>`;
        }).join('');
        return `<div style="border:1px solid #cbd5e1; border-right:4px solid #1a237e; border-radius:7px; padding:7px 10px; background:#f8fafc;">
          <div style="font-weight:800; font-size:13px; color:#1a237e; margin-bottom:3px;">🏙️ ${tx(cb.city)}</div>
          ${rows}
        </div>`;
      }).join('');

      return `<div class="gx-page ${data.bwMode ? 'gx-bw' : ''}">
        <div class="gx-hdr">
          <div>
            <div class="gx-hdr-title">${tx('היערכות מדריכים – ' + titlePrefix + sup.dispName)}</div>
            <div class="gx-hdr-sub">📅 ${tx(data.dateRangePart)} · ${tx('ריכוז כמות מדריכים נדרשת לפי עיר ויום')}</div>
          </div>
          <div class="gx-logo-box"><img src="logo_wide.png" alt="טומשין" onerror="this.parentElement.style.display='none'"></div>
        </div>
        <table class="gx-table" style="margin-bottom:12px;">${thead}${tbody}</table>
        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px;">${cityCards}</div>
        <div class="gx-ftr">
          <span>${tx('* הלו"ז מציג כמות מדריכים כללית להיערכות לפי עיר ויום (ייתכנו התאמות)')}</span>
          <span>${tx('טומשין קידס – ניהול ושיבוץ')}</span>
        </div>
      </div>`;
    }

    // All Suppliers Visual Matrix
    const activeSups = data.filteredSuppliers.filter(s => s.totalInstructorDays > 0);
    const zeroSups = data.allSuppliers.filter(s => s.totalInstructorDays === 0);

    let thead = `<thead><tr><th style="width:18%; text-align:right; padding-right:6px;">${tx('שם המפעיל')}</th><th style="width:13%; text-align:right; padding-right:6px;">${tx('עיר')}</th>`;
    data.days.forEach(ds => {
      thead += `<th><div>${tx(_shortDay(ds))}</div><div>${tx(_shortDate(ds))}</div></th>`;
    });
    thead += `<th style="width:9%;">${tx('סה"כ')}</th></tr></thead>`;

    let tbody = '<tbody>';
    const grandDay = new Map();
    data.days.forEach(ds => grandDay.set(ds, 0));
    let grandTot = 0;

    activeSups.forEach(sup => {
      sup.cities.forEach(cb => {
        tbody += `<tr>
          <td class="gx-garden-td"><div class="gx-gname">${tx(sup.dispName)}</div></td>
          <td class="gx-cell" style="font-weight:700; text-align:right; padding-right:6px;">${tx(cb.city)}</td>`;
        data.days.forEach(ds => {
          const cnt = cb.daysMap.get(ds)?.size || 0;
          if (cnt > 0) {
            grandDay.set(ds, (grandDay.get(ds) || 0) + cnt);
            grandTot += cnt;
          }
          tbody += `<td class="gx-cell" style="text-align:center; vertical-align:middle; font-weight:800; color:#1565c0; background:${cnt > 0 ? '#f0f7ff' : '#fff'};">${cnt > 0 ? cnt : ''}</td>`;
        });
        tbody += `<td class="gx-cell" style="text-align:center; vertical-align:middle; font-weight:800; background:#f8fafc;">${cb.cityTotal}</td></tr>`;
      });
    });

    tbody += `<tr class="gx-group-row"><td colspan="2" style="text-align:right; padding-right:8px;">${tx('סה"כ מדריכים ביום')}</td>`;
    data.days.forEach(ds => {
      tbody += `<td style="text-align:center;">${grandDay.get(ds) || 0}</td>`;
    });
    tbody += `<td style="text-align:center;">${grandTot}</td></tr></tbody>`;

    const zeroBlock = zeroSups.length > 0 ? `
      <div style="margin-top:10px; padding:7px 10px; background:#fef2f2; border:1px solid #fecaca; border-radius:7px; font-size:11px; color:#991b1b;">
        <b>${tx(`ספקים פעילים ללא שיבוץ בטווח (${zeroSups.length}):`)}</b> ${tx(zeroSups.map(z => z.dispName).join(' · '))}
      </div>` : '';

    return `<div class="gx-page ${data.bwMode ? 'gx-bw' : ''}">
      <div class="gx-hdr">
        <div>
          <div class="gx-hdr-title">${tx(titlePrefix + 'ריכוז מפעילי חוגים ומדריכים לפי ערים וימים')}</div>
          <div class="gx-hdr-sub">📅 ${tx(data.dateRangePart)} · ${tx(`${activeSups.length} מפעילים משובצים · סה"כ ${grandTot} ימי מדריך`)}</div>
        </div>
        <div class="gx-logo-box"><img src="logo_wide.png" alt="טומשין" onerror="this.parentElement.style.display='none'"></div>
      </div>
      <table class="gx-table">${thead}${tbody}</table>
      ${zeroBlock}
      <div class="gx-ftr">
        <span>${tx('בקרה פנימית – טומשין קידס')}</span>
        <span>${tx(data.dateRangePart)}</span>
      </div>
    </div>`;
  }

  window.doInstExportPDF = function () {
    const data = _collectInstructorsData();
    const targetSup = data.supFilter ? data.filteredSuppliers[0] : null;
    if (!data.days.length || (data.supFilter && (!targetSup || targetSup.totalInstructorDays === 0))) {
      window.spAlert('אין נתונים להדפסה בטווח שנבחר.');
      return;
    }

    const printWin = window.open('', '_blank', 'width=1160,height=840');
    if (!printWin) {
      window.spAlert('אנא אפשר חלונות קופצים בדפדפן.');
      return;
    }

    const baseUrl = window.location.href.split('?')[0].replace(/[^/]*$/, '');
    const styles = _getVisualGridStyles(true, data.days.length >= 7);
    const pageHtml = _buildInstVisualCardHtml(targetSup, data, false);
    const docTitle = targetSup ? `היערכות מדריכים - ${targetSup.dispName}` : 'ריכוז מדריכים ובקרת ספקים';

    printWin.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <base href="${baseUrl}">
  <title>${_esc(docTitle)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&display=swap" rel="stylesheet">
  ${styles}
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    body { margin: 0; padding: 18px; background: #e2e8f0; }
    .gx-page { max-width: 1060px; margin: 0 auto; border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
    .gx-toolbar { position: sticky; top: 10px; z-index: 9999; display: flex; gap: 10px; justify-content: center; margin-bottom: 14px; }
    .gx-btn { padding: 10px 22px; border: none; border-radius: 8px; font-family: 'Assistant', Arial, sans-serif; font-size: 15px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    @media print {
      body { background: #ffffff; padding: 0; }
      .gx-toolbar { display: none !important; }
      .gx-page { max-width: none; margin: 0; border-radius: 0; box-shadow: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="gx-toolbar">
    <button class="gx-btn" style="background:#2563eb; color:#fff;" onclick="window.print()">🖨️ הדפס / שמור כ-PDF</button>
    <button class="gx-btn" style="background:#334155; color:#fff;" onclick="document.querySelectorAll('.gx-page').forEach(p=>p.classList.toggle('gx-bw'))">⚫⚪ החלף צבעוני / שחור-לבן</button>
  </div>
  ${pageHtml}
</body>
</html>`);
    printWin.document.close();
  };

  window.doInstQuickImage = async function (idx) {
    const sup = _instSupList[idx];
    if (!sup) return;
    await _exportInstImageInternal('copy', sup.base);
  };

  window.doInstExportImage = async function (action = 'download') {
    await _exportInstImageInternal(action, undefined);
  };

  async function _exportInstImageInternal(action, overrideSupBase) {
    const data = _collectInstructorsData(overrideSupBase);
    const targetSup = data.supFilter ? data.filteredSuppliers[0] : null;
    if (!data.days.length || (data.supFilter && (!targetSup || targetSup.totalInstructorDays === 0))) {
      window.spAlert('אין נתונים להפקת תמונה בטווח שנבחר.');
      return;
    }

    let h2c;
    try {
      h2c = await _ensureHtml2Canvas();
    } catch (e) {
      window.spAlert('שגיאה בטעינת ספריית התמונות: ' + e.message);
      return;
    }

    // Strict adherence to AGENTS.md off-screen container rule:
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute; top:-99999px; left:-99999px; width:850px; background:#fff; direction:rtl; font-family:Arial, sans-serif;';
    document.body.appendChild(container);

    const prevScrollX = window.scrollX || window.pageXOffset || 0;
    const prevScrollY = window.scrollY || window.pageYOffset || 0;

    try {
      const styles = _getVisualGridStyles(true, data.days.length >= 6);
      container.innerHTML = styles + _buildInstVisualCardHtml(targetSup, data, true);
      await new Promise(r => setTimeout(r, 80));

      const pageEl = container.querySelector('.gx-page') || container;
      window.scrollTo(0, 0);
      const canvas = await h2c(pageEl, { scale: 2, useCORS: true, logging: false });
      window.scrollTo(prevScrollX, prevScrollY);

      if (action === 'copy' && navigator.clipboard && window.ClipboardItem) {
        const pngBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': pngBlob })]);
        window.showToast?.(targetSup
          ? `✅ כרטיס המדריכים של "${targetSup.dispName}" הועתק! הדבק (Ctrl+V) בוואטסאפ`
          : '✅ תמונת ריכוז המדריכים הועתקה ללוח! הדבק (Ctrl+V) בוואטסאפ');
        return;
      }

      const jpgBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.95));
      const baseTitle = targetSup ? `היערכות מדריכים - ${targetSup.dispName}` : 'ריכוז מדריכים ובקרת ספקים';
      const fName = `${baseTitle.replace(/[/\\?%*:|"<>]/g, '_')} (${data.minDs}).jpg`;
      const url = URL.createObjectURL(jpgBlob);
      const a = document.createElement('a');
      a.href = url; a.download = fName; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.showToast?.(`🖼️ התמונה הורדה: ${fName}`);
    } catch (err) {
      console.error('[InstExport Image]', err);
      window.spAlert('שגיאה בהפקת תמונה: ' + err.message);
    } finally {
      window.scrollTo(prevScrollX, prevScrollY);
      if (container.parentNode) container.parentNode.removeChild(container);
    }
  }

  // ── EXPORT CLUSTER INSTRUCTORS MATRIX (מס' מדריכים ליום) ──
  window.doClusterMatrixExportExcel = async function () {
    const fromEl = document.getElementById('gexp-from');
    const toEl = document.getElementById('gexp-to');
    const baseD = (window.calD instanceof Date && !isNaN(window.calD)) ? new Date(window.calD) : new Date();
    const fromDs = fromEl?.value || window.d2s(baseD);
    const toDs = toEl?.value || fromDs;

    const minDs = fromDs <= toDs ? fromDs : toDs;
    const maxDs = fromDs <= toDs ? toDs : fromDs;

    // Build list of days
    const days = [];
    const incFri = !!document.getElementById('gexp-inc-fri')?.checked;
    let curr = window.s2d(minDs);
    const end = window.s2d(maxDs);
    while (curr <= end) {
      const dow = curr.getDay();
      if (dow !== 6 && (incFri || dow !== 5)) {
        days.push(window.d2s(curr));
      }
      curr = window.addD(curr, 1);
    }
    if (!days.length) {
      window.spAlert('נא לבחור טווח תאריכים תקין.');
      return;
    }

    if (typeof window.ExcelJS === 'undefined') {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js';
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      } catch (e) {
        window.spAlert('שגיאה בטעינת ExcelJS');
        return;
      }
    }

    try {
      const wb = new window.ExcelJS.Workbook();
      wb.creator = 'טומשין קידס';
      wb.created = new Date();

      const ws = wb.addWorksheet("מס' מדריכים ליום", {
        views: [{ rightToLeft: true, state: 'frozen', ySplit: 2, xSplit: 1 }],
        pageSetup: {
          paperSize: 9,
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0
        }
      });

      const totalCols = 1 + days.length + 1; // אשכול | ימים... | הערות
      ws.getColumn(1).width = 22; // אשכול
      days.forEach((_, i) => { ws.getColumn(2 + i).width = 26; });
      ws.getColumn(totalCols).width = 22; // הערות

      const thinBorder = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };

      // Row 1: Title (מס' מדריכים ליום')
      const tRow = ws.addRow(["מס' מדריכים ליום'"]);
      tRow.height = 28;
      ws.mergeCells(1, 1, 1, totalCols);
      const tCell = tRow.getCell(1);
      tCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF000000' } };
      tCell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rightToLeft' };
      tCell.border = thinBorder;

      // Row 2: Headers (אשכול | יום א' D/M ... | הערות)
      const dayHeaders = days.map(ds => {
        const dObj = window.s2d(ds);
        const dayLetter = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'][dObj.getDay()] || '';
        const dayOfMonth = dObj.getDate();
        const monthNum = dObj.getMonth() + 1;
        return `יום ${dayLetter}' ${dayOfMonth}/${monthNum}`;
      });
      const hRow = ws.addRow(['אשכול', ...dayHeaders, 'הערות']);
      hRow.height = 24;
      for (let c = 1; c <= totalCols; c++) {
        const cell = hRow.getCell(c);
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rightToLeft' };
        cell.border = thinBorder;
      }

      // Collect all clusters in the system
      const allClusters = typeof window.getClusters === 'function' ? window.getClusters(minDs, maxDs) : Object.values(window.clusters || {});

      // Group clusters by City
      const cityOrder = ['גבעתיים', 'פתח תקווה', 'ראש העין', 'באר יעקב', 'נס ציונה'];
      const clustersByCity = new Map();
      allClusters.forEach(cl => {
        const cCity = cl.city || (cl.gardenIds && cl.gardenIds[0] ? (window.G(cl.gardenIds[0])||{}).city : '') || 'אחר';
        if (!clustersByCity.has(cCity)) clustersByCity.set(cCity, []);
        clustersByCity.get(cCity).push(cl);
      });

      // Sort cities by cityOrder, then alphabetically
      const sortedCities = Array.from(clustersByCity.keys()).sort((a, b) => {
        const idxA = cityOrder.indexOf(a);
        const idxB = cityOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b, 'he');
      });

      let lastRowIndex = 2;

      sortedCities.forEach((city, cityIdx) => {
        const cList = clustersByCity.get(city) || [];
        cList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he', { numeric: true }));

        cList.forEach(cl => {
          let clDisp = cl.name || '';
          if (/^(.+)\s+(\d+)$/.test(clDisp)) clDisp = clDisp.replace(/^(.+)\s+(\d+)$/, '$1 - $2');

          const topRowVals = [clDisp];
          const botRowVals = [''];
          const cellStyles = [];

          days.forEach(ds => {
            const gids = (cl.gardenIds || []).map(Number);
            const evs = (window.SCH || []).filter(s => gids.includes(Number(s.g)) && s.d === ds && s.st !== 'can');

            if (!evs.length) {
              topRowVals.push('');
              botRowVals.push('');
              cellStyles.push({ type: 'empty' });
              return;
            }

            // Helper to clean garden name (stripping parentheses like (חב"ד) to save space)
            const cleanGardenName = (id) => {
              const nm = (window.G(id) || {}).name || '';
              return nm.replace(/\s*\([^)]*\)/g, '').trim();
            };

            // Parse each event in this cluster/day slot
            const parsedEvs = evs.map(ev => {
              const rawSup = ev.a ? String(ev.a).trim() : '';
              const rawNt = ev.nt ? String(ev.nt).trim() : '';
              const rawTp = ev.tp ? String(ev.tp).trim() : '';
              const hour = ev.t ? parseInt(ev.t) : 0;

              const isIdea = !rawSup || 
                rawSup === 'בוקר' || rawSup === '* בוקר' || 
                rawSup === 'צהריים' || rawSup === '* צהריים' || rawSup === 'צהרון' ||
                rawSup.startsWith('*') || 
                /רעיון|הצעה|\*/i.test(rawNt);

              let isMorning = false;
              let isTzaharon = false;

              if (rawTp === 'חוג בוקר' || rawTp.includes('בוקר')) {
                isMorning = true;
              } else if (rawTp === 'חוג צהרון' || rawTp.includes('צהרון')) {
                isTzaharon = true;
              } else if (/צהרון|צהריים/.test(rawNt)) {
                isTzaharon = true;
              } else if (/בוקר/.test(rawNt)) {
                isMorning = true;
              } else if (hour > 0 && hour < 13) {
                isMorning = true;
              } else if (hour >= 13) {
                isTzaharon = true;
              } else {
                if (/בוקר/.test(rawSup)) isMorning = true;
                else isTzaharon = true;
              }

              const dispSup = _resolveSupplierAlias(rawSup) || (window.supBase ? window.supBase(rawSup) : rawSup);
              const gid = Number(ev.g);
              const gName = cleanGardenName(gid);

              return { ev, gid, gName, rawSup, dispSup, rawNt, rawTp, hour, isIdea, isMorning, isTzaharon };
            });

            const mList = parsedEvs.filter(p => p.isMorning);
            const aList = parsedEvs.filter(p => !p.isMorning && p.isTzaharon);

            // ── Case A: SPLIT (Cluster has BOTH Morning and Afternoon activities!) ──
            if (mList.length > 0 && aList.length > 0) {
              const mGNames = [...new Set(mList.map(p => p.gName).filter(Boolean))].join('/');
              const aGNames = [...new Set(aList.map(p => p.gName).filter(Boolean))].join('/');

              const mAllIdea = mList.every(p => p.isIdea);
              const mSups = [...new Set(mList.filter(p => !p.isIdea).map(p => p.dispSup).filter(Boolean))];
              const mSupName = mAllIdea ? '* בוקר' : (mSups.join(' + ') || 'בוקר');

              const aAllIdea = aList.every(p => p.isIdea);
              const aSups = [...new Set(aList.filter(p => !p.isIdea).map(p => p.dispSup).filter(Boolean))];
              const aSupName = aAllIdea ? '* צהריים' : (aSups.join(' + ') || 'צהרון');

              let plainTop = '';
              const topRich = [];

              if (mAllIdea && aAllIdea) {
                plainTop = '* בוקר + * צהריים';
                topRich.push(
                  { text: '* בוקר', font: { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF000000' } } },
                  { text: ' + ', font: { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF000000' } } },
                  { text: '* צהריים', font: { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF000000' } } }
                );
              } else if (mSupName === aSupName) {
                // Format: תלתן בוקר + צהרון (בוקר בכחול, צהרון באדום)
                plainTop = `${mSupName} בוקר + צהרון`;
                topRich.push(
                  { text: `${mSupName} בוקר`, font: { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF002060' } } },
                  { text: ' + ', font: { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF000000' } } },
                  { text: 'צהרון', font: { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFC00000' } } }
                );
              } else {
                plainTop = `${mSupName} בוקר + ${aSupName} צהרון`;
                topRich.push(
                  { text: `${mSupName} בוקר`, font: { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF002060' } } },
                  { text: ' + ', font: { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF000000' } } },
                  { text: `${aSupName} צהרון`, font: { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFC00000' } } }
                );
              }

              const plainBot = `${mGNames} / ${aGNames}`;
              const botRich = [
                { text: mGNames, font: { name: 'Arial', size: 6, bold: true, color: { argb: 'FF002060' } } },
                { text: ' / ', font: { name: 'Arial', size: 6, bold: true, color: { argb: 'FF555555' } } },
                { text: aGNames, font: { name: 'Arial', size: 6, bold: true, color: { argb: 'FFC00000' } } }
              ];

              topRowVals.push(plainTop);
              botRowVals.push(plainBot);
              cellStyles.push({ type: 'split', topRich, botRich, isAllIdea: (mAllIdea && aAllIdea) });
              return;
            }

            // ── Case B: ONLY MORNING ──
            if (mList.length > 0) {
              const mGNames = [...new Set(mList.map(p => p.gName).filter(Boolean))].join('/') || (cl.gardenIds || []).map(cleanGardenName).join('/');
              const mAllIdea = mList.every(p => p.isIdea);

              if (mAllIdea) {
                topRowVals.push('* בוקר');
                botRowVals.push(mGNames);
                cellStyles.push({ type: 'idea', text: '* בוקר', gNames: mGNames });
              } else {
                const mSups = [...new Set(mList.filter(p => !p.isIdea).map(p => p.dispSup).filter(Boolean))];
                const mSupName = mSups.join(' + ') || 'בוקר';
                const cellText = `${mSupName} - בוקר`;
                topRowVals.push(cellText);
                botRowVals.push(mGNames);
                cellStyles.push({ type: 'scheduled', color: 'blue', text: cellText, gNames: mGNames });
              }
              return;
            }

            // ── Case C: ONLY AFTERNOON (צהרון) ──
            const aGNames = [...new Set(aList.map(p => p.gName).filter(Boolean))].join('/') || (cl.gardenIds || []).map(cleanGardenName).join('/');
            const aAllIdea = aList.every(p => p.isIdea);

            if (aAllIdea) {
              topRowVals.push('* צהריים');
              botRowVals.push(aGNames);
              cellStyles.push({ type: 'idea', text: '* צהריים', gNames: aGNames });
            } else {
              const aSups = [...new Set(aList.filter(p => !p.isIdea).map(p => p.dispSup).filter(Boolean))];
              const aSupName = aSups.join(' + ') || 'צהריים';
              const hasPlus = aList.some(p => p.rawNt.includes('+ צהרון'));
              const cellText = hasPlus ? `${aSupName} + צהרון` : `${aSupName} - צהריים`;
              topRowVals.push(cellText);
              botRowVals.push(aGNames);
              cellStyles.push({ type: 'scheduled', color: 'red', text: cellText, gNames: aGNames });
            }
          });

          // Empty notes column
          topRowVals.push('');
          botRowVals.push('');

          const rTop = ws.addRow(topRowVals);
          const rBot = ws.addRow(botRowVals);
          rTop.height = 19;
          rBot.height = 14;
          lastRowIndex = rBot.number;

          // Merge Column 1 (אשכול) across both rows
          ws.mergeCells(rTop.number, 1, rBot.number, 1);
          const cCell = rTop.getCell(1);
          cCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
          cCell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rightToLeft' };
          cCell.border = thinBorder;
          rBot.getCell(1).border = thinBorder;

          // Merge Column totalCols (הערות) across both rows
          ws.mergeCells(rTop.number, totalCols, rBot.number, totalCols);
          rTop.getCell(totalCols).border = thinBorder;
          rBot.getCell(totalCols).border = thinBorder;

          // Style day cells
          cellStyles.forEach((st, idx) => {
            const cTop = rTop.getCell(2 + idx);
            const cBot = rBot.getCell(2 + idx);
            cTop.border = thinBorder;
            cBot.border = thinBorder;
            cTop.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder: 'rightToLeft' };
            cBot.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder: 'rightToLeft' };

            if (st.type === 'split') {
              cTop.value = { richText: st.topRich };
              cBot.value = { richText: st.botRich };
              if (st.isAllIdea) {
                cTop.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
                cBot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
              }
            } else if (st.type === 'idea') {
              cTop.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
              cTop.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
              cBot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
              cBot.font = { name: 'Arial', size: 6, bold: true, color: { argb: 'FF000000' } };
            } else if (st.type === 'scheduled') {
              const fontArgb = st.color === 'red' ? 'FFC00000' : 'FF002060';
              cTop.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: fontArgb } };
              cBot.font = { name: 'Arial', size: 6, bold: true, color: { argb: fontArgb } };
            }
          });
        });

        // Add blank separator row between cities (except after the last city)
        if (cityIdx < sortedCities.length - 1) {
          const sepRow = ws.addRow(new Array(totalCols).fill(''));
          sepRow.height = 14;
          for (let c = 1; c <= totalCols; c++) {
            sepRow.getCell(c).border = {
              top: { style: 'thin', color: { argb: 'FF000000' } },
              bottom: { style: 'thin', color: { argb: 'FF000000' } }
            };
          }
          lastRowIndex = sepRow.number;
        }
      });

      // Set autofilter on header row
      ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: Math.max(2, lastRowIndex), column: totalCols } };

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const fName = `מס_מדריכים_ליום_אשכולות (${minDs}${minDs !== maxDs ? '_' + maxDs : ''}).xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fName; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (window.showToast) window.showToast(`📊 דוח מס' מדריכים ליום הורד בהצלחה: ${fName}`);
    } catch (err) {
      console.error('[ClusterMatrix Excel]', err);
      window.spAlert('שגיאה בייצוא לאקסל: ' + err.message);
    }
  };
})();
