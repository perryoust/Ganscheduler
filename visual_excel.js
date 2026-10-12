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
  const gardenFilters = Array.from(document.querySelectorAll('input[name="exp-garden-cb"]:checked')).map(cb => parseInt(cb.value));
  
  const rawList = typeof AG === 'function' ? AG() : (typeof getAllGardens === 'function' ? getAllGardens() : [...(window.GARDENS || []), ...(window._GARDENS_EXTRA || [])]);
  const gMap = new Map();
  (rawList || []).forEach(g => {
    if (g && g.id != null && g.active !== false) {
      gMap.set(Number(g.id), g);
    }
  });
  let gList = Array.from(gMap.values());

  if (mode === 'city') {
    if (cityFilter && cityFilter !== 'all') gList = gList.filter(g => g.city === cityFilter);
  } else if (mode === 'manager') {
    if (mgrFilter && mgrFilter !== 'all') {
      const mgrObj = window.managers && window.managers[mgrFilter];
      if (mgrObj?.gardenIds) {
        gList = gList.filter(g => mgrObj.gardenIds.includes(g.id));
      } else {
        gList = gList.filter(g => {
          const mgr = typeof window.gardenManager === 'function' ? window.gardenManager(g.id) : null;
          return mgr && (mgr.name === mgrFilter || mgr.id === mgrFilter);
        });
      }
    }
  } else if (mode === 'schools') {
    gList = gList.filter(g => (typeof window.getGardenClass === 'function' ? window.getGardenClass(g) : (typeof gcls === 'function' ? gcls(g) : g.cls)) === 'ביה"ס');
  } else if (mode === 'garden') {
    if (gardenFilters.length === 0) {
      window.spAlert("לא נבחרו גנים / בתי ספר לייצוא");
      return;
    }
    gList = gList.filter(g => gardenFilters.includes(Number(g.id)));
  }

  if (gList.length === 0) { window.spAlert("לא נבחרו גנים / בתי ספר לייצוא"); return; }
  
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
    let pagesHtml = '';
    let count = 0;
    for (const g of gList) {
      const gEvs = allEvs.filter(s => s.g === g.id);
      pagesHtml += _buildGardenPage(g, gEvs, year, month, monthName, hebYearStr, showPhones);
      count++;
    }
    if (count === 0) {
      window.spAlert('לא נמצאו מוסדות לייצוא');
      return;
    }
    
    let title = `לוחות חוגים מעוצבים - ${monthName} ${year}.pdf`;
    if (gList.length === 1) {
      title = `לוח חוגים - ${gList[0].name} ${gList[0].city || ''} - ${monthName} ${year}.pdf`;
    } else if (mode === 'schools') {
      title = `לוחות חוגים - כל בתי הספר - ${monthName} ${year}.pdf`;
    } else if (mode === 'city' && cityFilter && cityFilter !== 'all') {
      title = `לוחות חוגים - ${cityFilter} - ${monthName} ${year}.pdf`;
    }

    await _exportPDF(pagesHtml, title, month);
    window.showToast(`📊 ${count} לוחות מעוצבים נפתחו בהצלחה!`);
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
    if (s.a) {
      if (typeof window.supDisplayName === 'function') {
        supName = window.supDisplayName(s.a);
      } else if (typeof window.supBase === 'function') {
        supName = window.supBase(s.a);
      } else {
        supName = String(s.a);
      }
      if (typeof window.getSupPhone === 'function') {
        phone = window.getSupPhone(s.a, s);
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

      const currentDow = new Date(dateStr).getDay();
      const dayEvs = fixedSched.filter(fs => new Date(fs.d).getDay() === currentDow).sort((a,b) => (a.t||'').localeCompare(b.t||''));

      let cellContent = '';
      let cellClass = 'vp-day-cell';

      let dayHeaderHtml = `
        <div class="vp-day-header-row">
          <span class="vp-day-event-text"></span>
          <span class="vp-day-date" dir="ltr">${dayNum}/${month}</span>
        </div>`;

      if (isCamp) {
        cellClass += ' vp-day-camp';
        dayHeaderHtml = `
          <div class="vp-day-header-row">
            <span class="vp-day-event-text vp-camp-text">${_esc(hol.name || hol.label)}</span>
            <span class="vp-day-date" dir="ltr">${dayNum}/${month}</span>
          </div>`;
      } else if (isHoliday) {
        cellClass += ' vp-day-holiday';
        dayHeaderHtml = `
          <div class="vp-day-header-row">
            <span class="vp-day-event-text vp-holiday-text">${_esc(hol.name || hol.label)}</span>
            <span class="vp-day-date" dir="ltr">${dayNum}/${month}</span>
          </div>`;
        let insideText = 'אין פעילות';
        const hName = hol.name || hol.label || '';
        if (hName.includes('שבתון') || hName.includes('בחירות')) {
           insideText = hName;
        }
        cellContent = `<div class="vp-event-pill vp-event-holiday">${_esc(insideText)}</div>`;
      }

      if (dayEvs.length > 0 && !isHoliday) {
        dayEvs.forEach(ev => {
          let actName = ev.act;
          if (!actName && typeof window.supAct === 'function') actName = window.supAct(ev.a);
          if (!actName) actName = 'פעילות';

          const clubIdx = regularClubsList.findIndex(rc => rc.name === actName);
          const isRegular = clubIdx >= 0;
          const pillColor = isRegular ? CARD_BORDER[clubIdx] : '#312e81';
          const pillBg = isRegular ? CARD_BG[clubIdx] : '#eef2ff';

          let cleanSupName = '';
          let supPhone = '';
          if (ev.a) {
            if (typeof window.supDisplayName === 'function') {
              cleanSupName = window.supDisplayName(ev.a);
            } else if (typeof window.supBase === 'function') {
              cleanSupName = window.supBase(ev.a);
            } else {
              cleanSupName = String(ev.a);
            }
            if (typeof window.getSupPhone === 'function') {
              supPhone = window.getSupPhone(ev.a, ev);
            }
          }
          
          let pillText = `${ev.t ? '(' + ev.t + ') ' : ''}${cleanSupName && cleanSupName !== actName ? _esc(cleanSupName) + ' - ' : ''}${_esc(actName)}`;
          if (showPhones && supPhone) {
              pillText += `<br><span style="font-size:9.5px; font-weight:700;">📞 ${_esc(supPhone)}</span>`;
          }

          cellContent += `<div class="vp-event-pill" style="background:${pillBg}; color:${pillColor}; border:1px solid ${pillColor}20;">${pillText}</div>`;
        });
      }

      calendarRows += `
        <div class="${cellClass}">
          ${dayHeaderHtml}
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
          <img src="logo_wide.png" style="height:65px;" alt="Kids טומשין">
        </div>
        <div class="vp-header-left">
          <div class="vp-month-badge">📅 ${_esc(monthName)} ${year} - ${hebYearStr}</div>
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
          <div class="vp-watermark"><img src="img/bg_${month}.jpg" alt="" /></div>
          <div class="vp-days-header">
            <div>ראשון</div><div>שני</div><div>שלישי</div><div>רביעי</div><div>חמישי</div>
          </div>
          <div class="vp-calendar-body">
            ${calendarRows}
          </div>
        </div>
      </div>

      <div style="margin-top: auto; padding-top: 4px; border-top: 2px solid #e2e8f0;">
        <div style="font-size: 13.5px; font-weight: 700; color: #334155; text-align: right; line-height: 1.2;">
          ${mgrStr ? `👩‍💼 רכז/ת: ${_esc(mgrStr)}` : ''}
        </div>
        <div style="text-align: center; margin-top: 4px;">
          <div class="vp-footer">* שימו לב: ייתכנו שינויים בתוכנית החוגים</div>
        </div>
      </div>
    </div>`;
}

function _esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function _exportPDF(htmlContent, filename, month) {
  // Open print window with the rendered content
  const printWindow = window.open('', '_blank', 'width=850,height=1100');
  if (!printWindow) {
    window.spAlert('אנא אפשר חלונות קופצים (popups) בדפדפן כדי לייצא PDF');
    return;
  }

  const baseUrl = window.location.href.split('?')[0].replace(/[^/]*$/, '');
  
  const styles = _getStyles(month);
  printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <base href="${baseUrl}">
  <title>${filename}</title>
  <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;600;700;800&display=swap" rel="stylesheet">
  ${styles.css}
  <style>
    @media print {
      @page { size: A4 portrait; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      .vp-page { 
        width: 100% !important;
        height: 100vh !important;
        max-height: 100vh !important;
        break-after: page !important; 
        page-break-after: always !important; 
        margin: 0 !important; 
        padding: 5mm 7mm !important; 
        box-sizing: border-box !important;
        overflow: hidden !important;
      }
      .vp-page:last-child { 
        break-after: auto !important; 
        page-break-after: auto !important; 
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

function _getStyles(month) {
  return {
    css: `<style>
    .vp-page {
      display: flex;
      flex-direction: column;
      width: 794px;
      height: 1120px; /* A4 height at 96dpi */
      box-sizing: border-box;
      padding: 7mm 10mm;
      margin: 0 auto;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-family: 'Assistant', Arial, sans-serif;
      direction: rtl;
      page-break-after: always;
      break-after: page;
      color: #1e293b;
      position: relative;
    }
    .vp-watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 440px;
      height: 440px;
      max-width: 85%;
      max-height: 85%;
      opacity: 0.16;
      pointer-events: none;
      z-index: 1;
    }
    .vp-watermark img { 
      width: 100%; 
      height: 100%; 
      object-fit: contain; 
      display: block;
    }

    /* Header */
    .vp-header {
      background-color: #edd9ba;
      background-image: 
        radial-gradient(rgba(180, 135, 82, 0.28) 1.5px, transparent 0),
        radial-gradient(rgba(138, 97, 52, 0.22) 1px, transparent 0),
        linear-gradient(135deg, #f8eedc 0%, #edd4af 50%, #e0c192 100%);
      background-size: 14px 14px, 22px 22px, 100% 100%;
      background-position: 0 0, 8px 11px, 0 0;
      border: 2px solid #c9a674;
      box-shadow: inset 0 1px 3px rgba(120, 80, 30, 0.12), 0 3px 10px rgba(130, 90, 40, 0.12);
      color: #3e2712;
      padding: 8px 16px;
      border-radius: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .vp-header-sub { font-size: 13px; font-weight:600; color: #44403c; margin-top: 2px; }
    .vp-month-badge {
      background: rgba(255, 255, 255, 0.94);
      padding: 4px 14px;
      border-radius: 16px;
      font-size: 15px;
      font-weight: 800;
      color: #452a12;
      border: 1.5px solid #cbaf86;
      box-shadow: 0 2px 5px rgba(0,0,0,0.06);
      white-space: nowrap;
    }

    /* Garden Bar */
    .vp-garden-bar {
      background: linear-gradient(135deg, #047857, #059669);
      color: white;
      padding: 8px 16px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 6px;
      position: relative;
      border: 1px solid #065f46;
    }
    .vp-garden-name { font-size: 19px; font-weight: 800; }

    /* Section Title */
    .vp-section-title {
      font-size: 15px;
      font-weight: 800;
      color: #1e293b;
      margin: 4px 0 4px;
      text-align: right;
    }

    /* Activity Cards */
    .vp-cards-grid {
      display: flex;
      gap: 12px;
      margin-bottom: 6px;
    }
    .vp-activity-card {
      flex: 1;
      border: 2px solid #475569;
      background: #fff;
      border-right: 6px solid #3b82f6;
      border-radius: 10px;
      padding: 7px 12px;
      position: relative;
    }
    .vp-card-badge {
      position: absolute;
      top: -2px;
      left: 12px;
      padding: 2px 10px;
      border-radius: 0 0 6px 6px;
      color: white;
      font-size: 10.5px;
      font-weight: 700;
    }
    .vp-activity-card h3 {
      margin: 2px 0 4px;
      font-size: 15px;
      font-weight: 800;
      color: #1e293b;
    }
    .vp-activity-card p {
      margin: 1px 0;
      font-size: 12px;
      font-weight: 600;
      color: #334155;
    }

    /* Calendar */
    .vp-calendar-section { 
      margin-top: 4px; 
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .vp-calendar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .vp-calendar-title {
      font-size: 15px;
      font-weight: 800;
      color: #1e293b;
    }
    .vp-legend {
      display: flex;
      gap: 12px;
      font-size: 12px;
      font-weight: 700;
      color: #334155;
    }
    .vp-legend-item { display: flex; align-items: center; gap: 5px; }
    .vp-legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }

    .vp-calendar-container {
      position: relative;
      flex: 1;
      display: flex;
      flex-direction: column;
      border: 2px solid #94a3b8;
      border-radius: 10px;
      overflow: hidden;
      min-height: 0;
    }
    .vp-days-header {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      background: #f1f5f9;
      text-align: center;
      font-weight: 800;
      font-size: 13px;
      color: #334155;
      padding: 4px 0;
      border-bottom: 2px solid #94a3b8;
    }
    .vp-calendar-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #e2e8f0; /* grid lines */
      min-height: 0;
    }
    .vp-calendar-row {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 2px;
      min-height: 0;
    }
    .vp-calendar-row + .vp-calendar-row {
      border-top: 2px solid #e2e8f0;
    }
    .vp-day-cell {
      background: #ffffff;
      padding: 3px 5px;
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow: hidden;
    }
    .vp-day-empty { background: #f8fafc; }
    .vp-day-holiday { background: #fef9c3; }
    .vp-day-camp { background: #e0f2fe; }
    .vp-day-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2px;
      padding-bottom: 2px;
      border-bottom: 1.5px solid #e2e8f0;
      color: #000;
      font-weight: 800;
      font-size: 14px;
    }
    .vp-day-date {
      white-space: nowrap;
      color: #000;
    }
    .vp-day-event-text {
      flex: 1;
      text-align: right;
      padding-left: 6px;
      line-height: 1.1;
      font-size: 13px;
    }

    /* Event Pills */
    .vp-event-pill {
      padding: 2.5px 4px;
      border-radius: 6px;
      font-size: 11px;
      line-height: 1.25;
      text-align: center;
      margin-top: 2.5px;
      font-weight: 800;
      border-style: solid;
      border-width: 1.5px;
      word-break: break-word;
      overflow-wrap: break-word;
      white-space: normal;
    }
    .vp-event-holiday {
      background: #e2e8f0 !important; /* Light gray */
      color: #000 !important;
      border: 1.5px solid #000 !important;
      font-weight: 800;
    }
    .vp-holiday-text {
      color: #b45309;
    }
    .vp-camp-text {
      color: #0284c7;
    }

    /* Footer */
    .vp-footer {
      display: inline-block;
      font-size: 13px;
      font-weight: 800;
      color: #dc2626;
      background: #fee2e2;
      padding: 3px 20px;
      border-radius: 9999px;
      border: 1.5px solid #f87171;
    }

    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .vp-page {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>`
  };
}
