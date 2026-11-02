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
    if (!g) return false;
    const cls = (typeof window.getGardenClass === 'function'
      ? window.getGardenClass(g)
      : (typeof window.gcls === 'function' ? window.gcls(g) : (g.cls || ''))).trim();
    if (cls === 'ביה"ס' || cls === 'בית ספר') return true;
    return /בית ספר|ביה"ס|בי"ס|בי״ס|ביה״ס/i.test(g.name || '') || /בית ספר|ביה"ס|בי"ס|בי״ס|ביה״ס/i.test(g.cls || '');
  }

  function _getGardenPhone(g) {
    if (!g) return '';
    const ex = (window.supEx && window.supEx['g_' + g.id]) || {};
    if (ex.coph && String(ex.coph).trim()) return String(ex.coph).trim();
    if (g.coph && String(g.coph).trim()) return String(g.coph).trim();
    if (g.phone && String(g.phone).trim()) return String(g.phone).trim();
    if (window.GARDEN_PHONES && window.GARDEN_PHONES[String(g.id)] && window.GARDEN_PHONES[String(g.id)].ph1) {
      return String(window.GARDEN_PHONES[String(g.id)].ph1).trim();
    }
    return '';
  }

  function _getCoordinatorLabel(gid) {
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

  function _ensureModalDOM() {
    let modal = document.getElementById('grid-export-m');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'grid-export-m';
    modal.className = 'modal';
    modal.style.zIndex = '10020';
    modal.innerHTML = `
      <div class="mb" style="max-width:680px; width:95%; padding:0; border-radius:14px; overflow:hidden; box-shadow:0 16px 48px rgba(15,23,42,0.28);">
        <div style="background:linear-gradient(135deg, #1a237e 0%, #3949ab 100%); color:#fff; padding:14px 20px; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:1.35rem;">▦</span>
            <div>
              <h3 style="margin:0; font-size:1.1rem; font-weight:800; color:#fff;">ייצוא גריד שבועי / יומי</h3>
              <div id="gexp-open-hint" style="font-size:0.75rem; opacity:0.88; margin-top:1px;">טבלת שיבוצים מרוכזת לפי תאריכים ואשכולות/זוגות</div>
            </div>
          </div>
          <button onclick="window.CM('grid-export-m')" style="background:rgba(255,255,255,0.18); border:none; color:#fff; width:30px; height:30px; border-radius:50%; cursor:pointer; font-size:1rem; font-weight:700;">✕</button>
        </div>

        <div style="padding:16px 20px; max-height:78vh; overflow-y:auto; direction:rtl;">
          <!-- 1. Date Range Picker -->
          <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:12px 14px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
              <label style="font-weight:800; color:#1e293b; font-size:0.88rem;">📅 תאריכי הגריד לייצוא:</label>
              <span id="gexp-days-badge" style="background:#e0e7ff; color:#1e40af; font-weight:700; font-size:0.75rem; padding:2px 9px; border-radius:999px;">5 ימים</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:8px;">
              <div>
                <label style="display:block; font-size:0.76rem; color:#475569; font-weight:700; margin-bottom:3px;">מתאריך:</label>
                <input type="date" id="gexp-from" onchange="window.onGridExpDateChange('from')" style="width:100%; padding:7px 10px; border:1px solid #94a3b8; border-radius:7px; font-size:0.88rem; font-weight:600; box-sizing:border-box;">
              </div>
              <div>
                <label style="display:block; font-size:0.76rem; color:#475569; font-weight:700; margin-bottom:3px;">עד תאריך:</label>
                <input type="date" id="gexp-to" onchange="window.onGridExpDateChange('to')" style="width:100%; padding:7px 10px; border:1px solid #94a3b8; border-radius:7px; font-size:0.88rem; font-weight:600; box-sizing:border-box;">
              </div>
            </div>
            <div id="gexp-date-presets" style="display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-bottom:6px;"></div>
            <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.78rem; color:#334155; cursor:pointer; margin-top:2px;">
              <input type="checkbox" id="gexp-inc-fri" onchange="window.updateGridExportSummary()">
              <span>כלול ימי שישי בטווח התאריכים</span>
            </label>
          </div>

          <!-- 2. Scope & Grouping -->
          <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; margin-bottom:12px;">
            <div style="display:grid; grid-template-columns:1.25fr 1fr; gap:12px; margin-bottom:10px;">
              <div>
                <label style="display:block; font-weight:800; color:#1e293b; font-size:0.84rem; margin-bottom:5px;">🎯 אילו גנים / ערים לייצא?</label>
                <select id="gexp-scope" onchange="window.onGridExpScopeChange()" style="width:100%; padding:7px 10px; border:1px solid #94a3b8; border-radius:7px; font-size:0.84rem; font-weight:700; color:#1e293b; background:#fff;">
                  <option value="open">🖥️ מה שפתוח / מסונן כרגע בטבלה</option>
                  <option value="city">🏙️ בחירת עיר / כל הערים</option>
                </select>
              </div>
              <div>
                <label style="display:block; font-weight:800; color:#1e293b; font-size:0.84rem; margin-bottom:5px;">📦 חלוקת שורות בטבלה:</label>
                <select id="gexp-group-mode" onchange="window.onGridExpGroupModeChange()" style="width:100%; padding:7px 10px; border:1px solid #94a3b8; border-radius:7px; font-size:0.84rem; font-weight:700; color:#1e293b; background:#fff;">
                  <option value="clusters">📦 לפי אשכולות</option>
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

            <!-- Options Checkboxes -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; font-size:0.8rem; color:#334155; padding-top:4px;">
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="gexp-inc-addr" checked onchange="window.updateGridExportSummary()">
                <span>הצג כתובת גן</span>
              </label>
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="gexp-inc-sup-phone" onchange="window.updateGridExportSummary()">
                <span>הצג טלפון ספק בתא</span>
              </label>
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="gexp-inc-empty-gardens" onchange="window.updateGridExportSummary()">
                <span>הצג גם גנים ללא שיבוץ בטווח</span>
              </label>
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="gexp-inc-garden-meta" onchange="window.updateGridExportSummary()">
                <span>הצג רכז/ת וטלפון גן</span>
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

          <!-- 3. Custom Title + Live Summary -->
          <div style="margin-bottom:10px;">
            <label style="display:block; font-size:0.77rem; font-weight:700; color:#475569; margin-bottom:3px;">✏️ כותרת הטבלה בייצוא (מתעדכנת אוטומטית, ניתן לערוך):</label>
            <input type="text" id="gexp-title" oninput="this.dataset.userEdited='1'" style="width:100%; padding:7px 10px; border:1px solid #cbd5e1; border-radius:7px; font-size:0.85rem; font-weight:700; color:#1e293b; box-sizing:border-box;">
          </div>

          <div id="gexp-summary-box" style="background:#eef2ff; border:1px solid #c7d2fe; color:#1e3a8a; border-radius:8px; padding:8px 12px; font-size:0.8rem; font-weight:700; line-height:1.4;"></div>
        </div>

        <!-- Footer Export Actions -->
        <div style="background:#f8fafc; border-top:1px solid #e2e8f0; padding:12px 20px; display:flex; flex-wrap:wrap; gap:8px; justify-content:space-between; align-items:center; direction:rtl;">
          <div style="display:flex; flex-wrap:wrap; gap:8px; flex:1;">
            <button type="button" class="btn bg" onclick="window.doGridExportExcel()" style="background:#15803d; border-color:#166534; color:#fff; font-weight:800; padding:8px 14px; font-size:0.84rem;">📊 אקסל (Excel)</button>
            <button type="button" class="btn bp" onclick="window.doGridExportPDF()" style="background:#1d4ed8; border-color:#1e40af; color:#fff; font-weight:800; padding:8px 14px; font-size:0.84rem;">🖨️ PDF / הדפסה</button>
            <button type="button" class="btn bo" onclick="window.doGridExportImage('download')" style="background:#fdf2f8; border:1px solid #f472b6; color:#9d174d; font-weight:800; padding:8px 12px; font-size:0.82rem;">🖼️ תמונה (JPG)</button>
            <button type="button" class="btn bo" onclick="window.doGridExportImage('copy')" style="background:#ecfdf5; border:1px solid #34d399; color:#065f46; font-weight:800; padding:8px 12px; font-size:0.82rem;" title="מעתיק את הטבלה כתמונה ללוח להדבקה ישירה ב-Ctrl+V בוואטסאפ">📋 העתק לוואטסאפ</button>
          </div>
          <button type="button" class="btn bo" onclick="window.CM('grid-export-m')" style="padding:8px 14px; font-size:0.82rem;">סגור</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
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

    // Populate cities dropdown
    const citySel = document.getElementById('gexp-city');
    const allCities = typeof window.cities === 'function' ? window.cities() : [];
    citySel.innerHTML = '<option value="">-- כל הערים --</option>' +
      allCities.map(c => `<option value="${_esc(c)}">${_esc(c)}</option>`).join('');

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
    modal.classList.add('open');
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
    const incAddr = !!document.getElementById('gexp-inc-addr')?.checked;
    const incSupPhone = !!document.getElementById('gexp-inc-sup-phone')?.checked;
    const incEmptyGardens = !!document.getElementById('gexp-inc-empty-gardens')?.checked;
    const incGardenMeta = !!document.getElementById('gexp-inc-garden-meta')?.checked;
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
        incAddr,
        incSupPhone,
        incEmptyGardens,
        incGardenMeta,
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
})();
