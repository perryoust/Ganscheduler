// visual_excel.js - מחולל PDF מעוצב ללוח חוגים חודשי (html2pdf)

window.doVisualExcelExport = async function() {
  const mp = document.getElementById('exp-from');
  if (!mp || !mp.value) { window.spAlert('אנא בחר חודש'); return; }
  const fromM = mp.value;
  const [year, month] = fromM.split('-').map(Number);
  
  const fromDate = `${year}-${String(month).padStart(2,'0')}-01`;
  const toDate = `${year}-${String(month).padStart(2,'0')}-${String(new Date(year, month, 0).getDate()).padStart(2,'0')}`;
  
  // Filter Gardens based on current UI selection
  const modeNode = document.querySelector('input[name="exp-mode"]:checked');
  if (!modeNode) return;
  const mode = modeNode.value;
  const cityFilter = document.getElementById('exp-city').value;
  const mgrFilter = document.getElementById('exp-mgr').value;
  const gardenFilter = parseInt(document.getElementById('exp-garden').value) || 0;
  
  const allGardensSource = typeof AG === 'function' ? AG() : (typeof getAllGardens === 'function' ? getAllGardens() : window.GARDENS || []);
  
  let gList = allGardensSource.filter(g => {
    if (!g || !g.id) return false;
    if (g.active === false) return false;
    const cls = typeof window.getGardenClass === 'function' ? window.getGardenClass(g) : (typeof gcls === 'function' ? gcls(g) : g.cls);
    if (cls && cls !== 'גנים' && cls !== 'צהרונים') return false;
    return true;
  });

  if (mode === 'city') {
    if (cityFilter !== 'all') gList = gList.filter(g => g.city === cityFilter);
  } else if (mode === 'manager') {
    if (mgrFilter !== 'all') {
      gList = gList.filter(g => {
        const mgr = typeof window.gardenManager === 'function' ? window.gardenManager(g.id) : null;
        return mgr && mgr.name === mgrFilter;
      });
    }
  } else if (mode === 'garden') {
    if (gardenFilter) gList = gList.filter(g => g.id === gardenFilter);
  }

  if (gList.length === 0) { window.spAlert("לא נבחרו גנים לייצוא"); return; }
  
  const allEvs = window.SCH.filter(s => s.d >= fromDate && s.d <= toDate && (!s.st || s.st === 'ok'));
  const showPhones = document.getElementById('exp-phones') ? document.getElementById('exp-phones').checked : true;
  const splitMode = document.getElementById('exp-split').value;
  
  const HEB_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const monthName = HEB_MONTHS[month - 1];

  // Hebrew year
  function hebYear(y, m) {
    const base = y + 3760 + (m >= 8 ? 1 : 0);
    let n = base % 1000, s = '';
    const L = {400:'ת',300:'ש',200:'ר',100:'ק',90:'צ',80:'פ',70:'ע',60:'ס',50:'נ',40:'מ',30:'ל',20:'כ',10:'י',9:'ט',8:'ח',7:'ז',6:'ו',5:'ה',4:'ד',3:'ג',2:'ב',1:'א'};
    for (const v of [400,300,200,100,90,80,70,60,50,40,30,20,10,9,8,7,6,5,4,3,2,1])
      while(n>=v){s+=L[v];n-=v;}
    return s.length===1 ? s+"'" : s.slice(0,-1)+'"'+s.slice(-1);
  }
  const hebYearStr = hebYear(year, month - 1);

  // Sort gardens
  gList.sort((a,b) => (a.city||'').localeCompare(b.city||'','he') || (a.name||'').localeCompare(b.name||'','he'));

  try {
    if (splitMode === 'garden') {
      // One PDF per garden
      let filesExported = 0;
      for (const g of gList) {
        const gEvs = allEvs.filter(s => s.g === g.id);
        if (!gEvs.length) continue;
        const html = _buildGardenPage(g, gEvs, year, month, monthName, hebYearStr, showPhones);
        await _exportPDF(html, `לוח_מעוצב_${g.name}_${fromM}.pdf`);
        filesExported++;
      }
      if (filesExported > 0) window.showToast(`📊 ${filesExported} קבצי PDF מעוצבים נוצרו בהצלחה!`);
      else window.spAlert('⚠️ לא נמצאו פעילויות בטווח התאריכים שנבחר.');
    } else {
      // Group by city
      const byCity = gList.reduce((acc, g) => { (acc[g.city||''] = acc[g.city||'']||[]).push(g); return acc; }, {});
      let filesExported = 0;
      for (const [city, gardens] of Object.entries(byCity)) {
        const cityGardens = gardens.filter(g => allEvs.some(s => s.g === g.id));
        if (!cityGardens.length) continue;
        
        let pagesHtml = '';
        for (const g of cityGardens) {
          const gEvs = allEvs.filter(s => s.g === g.id);
          pagesHtml += _buildGardenPage(g, gEvs, year, month, monthName, hebYearStr, showPhones);
        }
        await _exportPDF(pagesHtml, `לוח_מעוצב_${city||'כל_הגנים'}_${fromM}.pdf`);
        filesExported++;
      }
      if (filesExported > 0) window.showToast(`📊 ${filesExported} קבצי PDF מעוצבים נוצרו בהצלחה!`);
      else window.spAlert('⚠️ לא נמצאו פעילויות בטווח התאריכים שנבחר.');
    }
    window.CM('export-m'); // close modal
  } catch(e) {
    console.error('Visual PDF error:', e);
    window.spAlert('שגיאה ביצירת PDF מעוצב: ' + e.message);
  }
};

function _buildGardenPage(g, gEvs, year, month, monthName, hebYearStr, showPhones) {
  // Compute regular clubs using fixed schedule (from core_dash.js)
  const fixedSched = typeof window.getGardenFixedSched === 'function' ? window.getGardenFixedSched(g.id) : [];
  const regularClubs = [];
  
  fixedSched.forEach(s => {
    let actName = s.act || (typeof window.supAct === 'function' ? window.supAct(s.a) : '');
    if (!actName) actName = 'פעילות';
    
    // Prevent duplicates
    if (regularClubs.some(c => c.name === actName)) return;
    
    const dow = new Date(s.d).getDay();
    const daysHe = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    
    let phone = '';
    let supName = '';
    if (s.a && window.SUPBASE) {
      const sup = window.SUPBASE.find(x => String(x.id) === String(s.a) || x.name === s.a || (typeof window.supBase === 'function' && window.supBase(x.name) === window.supBase(s.a)));
      if (sup) {
          if (sup.phone) phone = sup.phone;
          if (sup.name) supName = sup.name;
          
          if (!phone && window.supBaseEx && window.supBaseEx(sup.name).ph1) {
             phone = window.supBaseEx(sup.name).ph1;
          }
      }
    }
    
    let cleanSupName = supName;
    if (cleanSupName && typeof window.supBase === 'function') {
        cleanSupName = window.supBase(cleanSupName);
    }
    
    regularClubs.push({
      name: actName,
      supName: cleanSupName !== actName ? cleanSupName : '',
      dayStr: 'יום ' + daysHe[dow],
      timeStr: s.t ? s.t.slice(0,5) : '',
      phone: phone,
      supplierId: s.a || ''
    });
  });

  // Limit to max 2 regular clubs for the UI cards
  const regularClubsList = regularClubs.slice(0, 2);
  
  // Garden metadata
  const ageLabel = typeof window.extractGardenAge === 'function' ? window.extractGardenAge(g) : (g.age || '3-4');
  const mgr = typeof window.gardenManager === 'function' ? window.gardenManager(g.id) : null;
  const mgrStr = mgr ? `${mgr.name}${mgr.phone ? ' · ' + mgr.phone : ''}` : '';

  // Build calendar weeks (Sun-Thu only)
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks = [];
  let curWeek = [null,null,null,null,null];
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow >= 0 && dow <= 4) curWeek[dow] = d;
    if (dow === 4 || d === daysInMonth) {
      if (curWeek.some(x => x !== null)) weeks.push([...curWeek]);
      curWeek = [null,null,null,null,null];
    }
  }

  // Card colors
  const CARD_COLORS = ['#1d4ed8', '#047857']; // Darker blue and green for B&W contrast
  const CARD_BG = ['#eff6ff', '#ecfdf5'];
  const CARD_BORDER = ['#1e3a8a', '#064e3b'];

  // Build cards HTML
  let cardsHtml = '';
  if (regularClubsList.length > 0) {
    cardsHtml = '<div class="vp-cards-grid">';
    regularClubsList.forEach((club, i) => {
      const color = CARD_COLORS[i] || CARD_COLORS[0];
      const bg = CARD_BG[i] || CARD_BG[0];
      const border = CARD_BORDER[i] || CARD_BORDER[0];
      cardsHtml += `
        <div class="vp-activity-card" style="border-right-color:${color}; background:${bg}; border-color:${border}; border-right-color:${color};">
          <div class="vp-card-badge" style="background:${color};">חוג צהרון</div>
          <h3>${club.supName ? _esc(club.supName) + ' - ' : ''}${_esc(club.name)}</h3>
          <p>📅 ${_esc(club.dayStr)} &nbsp; 🕐 ${_esc(club.timeStr)}</p>
          ${showPhones && club.phone ? `<p style="font-weight:700;">📞 ${_esc(club.phone)}</p>` : ''}
        </div>`;
    });
    cardsHtml += '</div>';
  }

  // Build legend
  let legendHtml = '<div class="vp-legend">';
  regularClubsList.forEach((club, i) => {
    const color = CARD_COLORS[i] || CARD_COLORS[0];
    legendHtml += `<span class="vp-legend-item"><span class="vp-legend-dot" style="background:${color};"></span>${_esc(club.name)}</span>`;
  });
  legendHtml += '<span class="vp-legend-item"><span class="vp-legend-dot" style="background:#f59e0b;"></span>חג / קייטנה</span>';
  legendHtml += '</div>';

  // Build calendar rows
  let calendarRows = '';
  weeks.forEach(week => {
    calendarRows += '<div class="vp-calendar-row">';
    week.forEach((dayNum, idx) => {
      if (!dayNum) {
        calendarRows += '<div class="vp-day-cell vp-day-empty"></div>';
        return;
      }
      
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
      const hol = typeof window.getHolidayInfo === 'function' 
        ? window.getHolidayInfo(dateStr, g.city, typeof window.getGardenClass === 'function' ? window.getGardenClass(g) : g.cls) 
        : null;
      const isCamp = hol && (hol.type === 'camp' || hol.label === 'קייטנה' || hol.canSched);
      const isHoliday = hol && !isCamp;

      const dayEvs = gEvs.filter(e => e.d === dateStr && (!e.st || e.st === 'ok')).sort((a,b) => (a.t||'').localeCompare(b.t||''));

      let cellContent = '';
      let cellClass = 'vp-day-cell';

      if (isCamp) {
        cellClass += ' vp-day-camp';
      }

      if (isHoliday) {
        cellClass += ' vp-day-holiday';
        cellContent = `<div class="vp-event-pill vp-event-holiday">${_esc(hol.name || hol.label)}</div>`;
      } else if (dayEvs.length > 0) {
        dayEvs.forEach(ev => {
          let actName = ev.act;
          if (!actName && typeof window.supAct === 'function') actName = window.supAct(ev.a);
          if (!actName) actName = 'פעילות';

          const clubIdx = regularClubsList.findIndex(rc => rc.name === actName);
          const isRegular = clubIdx >= 0;
          const pillColor = isRegular ? CARD_BORDER[clubIdx] : '#312e81';
          const pillBg = isRegular ? CARD_BG[clubIdx] : '#eef2ff';

          let supName = '';
          let supPhone = '';
          if (ev.a && window.SUPBASE) {
            const sup = window.SUPBASE.find(s => String(s.id) === String(ev.a) || s.name === ev.a || (typeof window.supBase === 'function' && window.supBase(s.name) === window.supBase(ev.a)));
            if (sup) {
                if (sup.name) supName = sup.name;
                if (sup.phone) supPhone = sup.phone;
                
                if (!supPhone && window.supBaseEx && window.supBaseEx(sup.name).ph1) {
                   supPhone = window.supBaseEx(sup.name).ph1;
                }
            }
          }
          let cleanSupName = supName;
          if (cleanSupName && typeof window.supBase === 'function') {
              cleanSupName = window.supBase(cleanSupName);
          }
          
          let pillText = `${ev.t ? '(' + ev.t + ') ' : ''}${cleanSupName && cleanSupName !== actName ? _esc(cleanSupName) + ' - ' : ''}${_esc(actName)}`;
          if (showPhones && supPhone) {
              pillText += `<br><span style="font-size:10px; font-weight:700;">📞 ${_esc(supPhone)}</span>`;
          }

          cellContent += `<div class="vp-event-pill" style="background:${pillBg}; color:${pillColor}; border:1px solid ${pillColor}20;">${pillText}</div>`;
        });
      }

      calendarRows += `
        <div class="${cellClass}">
          <div class="vp-day-number">${dayNum}</div>
          ${cellContent}
        </div>`;
    });
    calendarRows += '</div>';
  });

  return `
    <div class="vp-page">
      <!-- Header Banner -->
      <div class="vp-header">
        <div class="vp-header-right" style="display:flex; align-items:center; gap:12px;">
          <img src="logo_wide.png" style="height:56px;" alt="Kids טומשין">
          <div class="vp-header-sub">רשת צהרונים וקייטנות ארצית</div>
        </div>
        <div class="vp-header-left">
          <div class="vp-month-badge">📅 ${_esc(monthName)} ${year} · ${hebYearStr}</div>
        </div>
      </div>

      <!-- Garden Name Bar -->
      <div class="vp-garden-bar">
        <div class="vp-garden-name">🏠 ${_esc(g.name || 'גן')} ${g.city ? '- ' + _esc(g.city) : ''}</div>
      </div>

      <!-- Club Cards -->
      ${regularClubsList.length > 0 ? `
        <div class="vp-section-title">⭐ החוגים הקבועים שלנו החודש</div>
        ${cardsHtml}
      ` : ''}

      <!-- Legend + Calendar -->
      <div class="vp-calendar-section">
        <div class="vp-calendar-header">
          <div class="vp-calendar-title">📅 ${_esc(monthName)} ${year} - לוח מועדים חודשי (ימים א׳-ה׳)</div>
          ${legendHtml}
        </div>
        <div class="vp-calendar-container">
          <div class="vp-days-header">
            <div>ראשון</div><div>שני</div><div>שלישי</div><div>רביעי</div><div>חמישי</div>
          </div>
          <div class="vp-calendar-body">
            ${calendarRows}
          </div>
        </div>
      </div>

      <div style="margin-top: auto; padding-top: 10px; border-top: 2px solid #e2e8f0;">
        <div style="font-size: 15px; font-weight: 700; color: #334155; text-align: right; line-height: 1.2;">
          ${mgrStr ? `👩‍💼 רכז/ת: ${_esc(mgrStr)}` : ''}
        </div>
        <div class="vp-footer" style="margin: 4px 0 0 0; padding: 0; border: none;">* שימו לב: ייתכנו שינויים בתוכנית החוגים</div>
      </div>
    </div>`;
}

function _esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function _exportPDF(htmlContent, filename) {
  // Open print window with the rendered content
  const printWindow = window.open('', '_blank', 'width=850,height=1100');
  if (!printWindow) {
    window.spAlert('אנא אפשר חלונות קופצים (popups) בדפדפן כדי לייצא PDF');
    return;
  }

  const baseUrl = window.location.href.split('?')[0].replace(/[^/]*$/, '');
  
  printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <base href="${baseUrl}">
  <title>${filename}</title>
  <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;600;700;800&display=swap" rel="stylesheet">
  ${_getStyles()}
  <style>
    @media print {
      body { margin: 0; padding: 0; background: #fff; }
      .vp-page { 
        break-after: page; 
        page-break-after: always; 
        margin: 0; 
        padding: 10mm 12mm; 
        height: 100vh;
      }
      .vp-page:last-child { 
        break-after: auto; 
        page-break-after: auto; 
      }
      .vp-no-print { display: none !important; }
      .vp-footer { margin-top: auto; }
    }
    @page { size: A4 portrait; margin: 0; }
    body { margin: 0; padding: 0; background: #e5e7eb; }
    .vp-print-btn {
      position: fixed; top: 20px; left: 20px; z-index: 99999;
      padding: 12px 28px; background: #3b82f6; color: white;
      border: none; border-radius: 10px; font-size: 16px; font-weight: 700;
      cursor: pointer; font-family: 'Assistant', Arial, sans-serif;
      box-shadow: 0 4px 12px rgba(59,130,246,0.4);
    }
    .vp-print-btn:hover { background: #2563eb; }
  </style>
</head>
<body>
  <button class="vp-print-btn vp-no-print" onclick="window.print()">🖨️ הדפס / שמור כ-PDF</button>
  ${htmlContent}
</body>
</html>`);
  printWindow.document.close();
}

function _getStyles() {
  return `<style>
    .vp-page {
      display: flex;
      flex-direction: column;
      width: 794px;
      height: 1122px; /* A4 height at 96dpi (297mm) */
      box-sizing: border-box;
      padding: 10mm 12mm;
      margin: 0 auto;
      background: #ffffff;
      font-family: 'Assistant', Arial, sans-serif;
      direction: rtl;
      page-break-after: always;
      color: #1e293b;
    }

    /* Header */
    .vp-header {
      background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
      color: #1e293b;
      padding: 14px 20px;
      border-radius: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .vp-header-sub { font-size: 14px; font-weight:600; color: #44403c; margin-top: 2px; }
    .vp-month-badge {
      background: rgba(255,255,255,0.7);
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 16px;
      font-weight: 700;
      color: #000;
      border: 1px solid rgba(0,0,0,0.1);
    }

    /* Garden Bar */
    .vp-garden-bar {
      background: linear-gradient(135deg, #047857, #059669);
      color: white;
      padding: 12px 20px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 8px;
      position: relative;
      border: 1px solid #065f46;
    }
    .vp-garden-name { font-size: 22px; font-weight: 800; }

    .vp-mgr-line {
      text-align: left;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 8px;
      padding: 0 4px;
    }

    /* Section Title */
    .vp-section-title {
      font-size: 18px;
      font-weight: 800;
      color: #1e293b;
      margin: 8px 0 6px;
      text-align: right;
    }

    /* Activity Cards */
    .vp-cards-grid {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
    }
    .vp-activity-card {
      flex: 1;
      border: 2px solid #475569;
      background: #fff;
      border-right: 6px solid #3b82f6;
      border-radius: 12px;
      padding: 12px 16px;
      position: relative;
    }
    .vp-card-badge {
      position: absolute;
      top: -2px;
      left: 12px;
      padding: 3px 12px;
      border-radius: 0 0 8px 8px;
      color: white;
      font-size: 11px;
      font-weight: 700;
    }
    .vp-activity-card h3 {
      margin: 4px 0 6px;
      font-size: 18px;
      font-weight: 800;
      color: #1e293b;
    }
    .vp-activity-card p {
      margin: 2px 0;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
    }

    /* Calendar */
    .vp-calendar-section { 
      margin-top: 6px; 
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .vp-calendar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .vp-calendar-title {
      font-size: 16px;
      font-weight: 800;
      color: #1e293b;
    }
    .vp-legend {
      display: flex;
      gap: 16px;
      font-size: 13px;
      font-weight: 700;
      color: #334155;
    }
    .vp-legend-item { display: flex; align-items: center; gap: 6px; }
    .vp-legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      display: inline-block;
    }

    .vp-calendar-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      border: 2px solid #94a3b8;
      border-radius: 12px;
      overflow: hidden;
    }
    .vp-days-header {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      background: #f1f5f9;
      text-align: center;
      font-weight: 800;
      font-size: 14px;
      color: #334155;
      padding: 8px 0;
      border-bottom: 2px solid #94a3b8;
    }
    .vp-calendar-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #e2e8f0; /* grid lines */
    }
    .vp-calendar-row {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 2px;
    }
    .vp-calendar-row + .vp-calendar-row {
      border-top: 2px solid #e2e8f0;
    }
    .vp-day-cell {
      background: #ffffff;
      padding: 8px;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .vp-day-empty { background: #f8fafc; }
    .vp-day-holiday { background: #fef9c3; }
    .vp-day-camp { background: #e0f2fe; }
    .vp-day-number {
      font-size: 16px;
      font-weight: 800;
      color: #000;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 2px solid #e2e8f0;
      text-align: left;
    }

    /* Event Pills */
    .vp-event-pill {
      padding: 4px 6px;
      border-radius: 8px;
      font-size: 12px;
      line-height: 1.3;
      text-align: center;
      margin-top: 4px;
      font-weight: 800;
      border-style: solid;
      border-width: 2px;
      word-break: break-word;
      overflow-wrap: break-word;
      white-space: normal;
    }
    .vp-event-holiday {
      background: #e2e8f0 !important; /* Light gray */
      color: #000 !important;
      border: 2px solid #000 !important;
      font-weight: 800;
    }

    /* Footer */
    .vp-footer {
      text-align: center;
      font-size: 18px;
      font-weight: 800;
      color: #ef4444; /* prominent red */
      margin-top: 12px;
      padding-top: 10px;
      border-top: 2px solid #e2e8f0;
    }
  </style>`;
}
