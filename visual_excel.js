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

  let gList = window.GARDENS.filter(g => g.active !== false);
  
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
  
  const allEvs = window.SCH.filter(s => s.d >= fromDate && s.d <= toDate);
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
  // Compute clubs
  const clubsMap = new Map();
  gEvs.forEach(ev => {
    if (ev.desc && (ev.desc.includes('חופש') || ev.desc.includes('חג') || ev.desc.includes('מועד'))) return;
    let actName = ev.act;
    if (!actName && typeof window.supAct === 'function') actName = window.supAct(ev.a);
    if (!actName) actName = 'פעילות';
    if (!clubsMap.has(actName)) {
      clubsMap.set(actName, { name: actName, events: [], phone: '', supplierId: ev.a || '' });
    }
    clubsMap.get(actName).events.push(ev);
  });

  const clubs = Array.from(clubsMap.values());
  clubs.forEach(club => {
    if (club.supplierId && window.SUPPLIERS) {
      const sup = window.SUPPLIERS.find(s => String(s.id) === String(club.supplierId) || s.name === club.supplierId);
      if (sup && sup.phone) club.phone = sup.phone;
    }
    if (club.events.length > 0) {
      const firstEv = club.events[0];
      const dObj = new Date(firstEv.d);
      const daysHe = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
      club.dayStr = 'יום ' + daysHe[dObj.getDay()];
      club.timeStr = firstEv.t || '';
    }
  });

  const regularClubs = clubs.filter(c => c.events.length >= 2).slice(0, 2);
  
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
  const CARD_COLORS = ['#3b82f6', '#059669'];
  const CARD_BG = ['#eff6ff', '#ecfdf5'];
  const CARD_BORDER = ['#bfdbfe', '#a7f3d0'];

  // Build cards HTML
  let cardsHtml = '';
  if (regularClubs.length > 0) {
    cardsHtml = '<div class="vp-cards-grid">';
    regularClubs.forEach((club, i) => {
      const color = CARD_COLORS[i] || CARD_COLORS[0];
      const bg = CARD_BG[i] || CARD_BG[0];
      const border = CARD_BORDER[i] || CARD_BORDER[0];
      cardsHtml += `
        <div class="vp-activity-card" style="border-right-color:${color}; background:${bg}; border-color:${border}; border-right-color:${color};">
          <div class="vp-card-badge" style="background:${color};">חוג צהרון</div>
          <h3>${_esc(club.name)}</h3>
          <p>📅 ${_esc(club.dayStr)} &nbsp; 🕐 ${_esc(club.timeStr)}</p>
          ${showPhones && club.phone ? `<p>📞 מפעיל / פרטים: ${_esc(club.phone)}</p>` : ''}
        </div>`;
    });
    cardsHtml += '</div>';
  }

  // Build legend
  let legendHtml = '<div class="vp-legend">';
  regularClubs.forEach((club, i) => {
    const color = CARD_COLORS[i] || CARD_COLORS[0];
    legendHtml += `<span class="vp-legend-item"><span class="vp-legend-dot" style="background:${color};"></span>${_esc(club.name)}</span>`;
  });
  legendHtml += '<span class="vp-legend-item"><span class="vp-legend-dot" style="background:#f59e0b;"></span>חג / אירוע</span>';
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

      const dayEvs = gEvs.filter(e => e.d === dateStr).sort((a,b) => (a.t||'').localeCompare(b.t||''));

      let cellContent = '';
      let cellClass = 'vp-day-cell';

      if (isHoliday) {
        cellClass += ' vp-day-holiday';
        cellContent = `<div class="vp-event-pill vp-event-holiday">${_esc(hol.name || hol.label)}</div>`;
      } else if (dayEvs.length > 0) {
        dayEvs.forEach(ev => {
          let actName = ev.act;
          if (!actName && typeof window.supAct === 'function') actName = window.supAct(ev.a);
          if (!actName) actName = 'פעילות';

          const clubIdx = regularClubs.findIndex(rc => rc.name === actName);
          const isRegular = clubIdx >= 0;
          const pillColor = isRegular ? CARD_COLORS[clubIdx] : '#6366f1';
          const pillBg = isRegular ? CARD_BG[clubIdx] : '#eef2ff';

          let pillText = `${ev.t ? '(' + ev.t + ')' : ''}<br>${_esc(actName)}`;
          
          if (!isRegular && showPhones && ev.a && window.SUPPLIERS) {
            const sup = window.SUPPLIERS.find(s => String(s.id) === String(ev.a) || s.name === ev.a);
            if (sup && sup.phone) pillText += `<br><small>📞 ${_esc(sup.phone)}</small>`;
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

  // Assemble full page
  return `
    <div class="vp-page">
      <!-- Header Banner -->
      <div class="vp-header">
        <div class="vp-header-right">
          <div class="vp-logo-text">Kids טומשין</div>
          <div class="vp-header-sub">רשת צהרונים וקייטנות ארצית · עיר: ${_esc(g.city || '')}</div>
        </div>
        <div class="vp-header-left">
          <div class="vp-month-badge">📅 ${_esc(monthName)} ${year} · ${hebYearStr}</div>
        </div>
      </div>

      <!-- Garden Name Bar -->
      <div class="vp-garden-bar">
        <div class="vp-garden-name">🏠 ${_esc(g.name || 'גן')}</div>
        <div class="vp-garden-sub">תוכנית ההעשרה ופעילויות צהרון חודשית</div>
        <div class="vp-age-badge">גילאי ${_esc(ageLabel)}</div>
      </div>

      ${mgrStr ? `<div class="vp-mgr-line">👩‍💼 רכז/ת: ${_esc(mgrStr)}</div>` : ''}

      <!-- Club Cards -->
      ${regularClubs.length > 0 ? `
        <div class="vp-section-title">⭐ החוגים הקבועים שלנו החודש</div>
        ${cardsHtml}
      ` : ''}

      <!-- Legend + Calendar -->
      <div class="vp-calendar-section">
        <div class="vp-calendar-header">
          <div class="vp-calendar-title">📅 לוח מועדים חודשי (ימים א׳-ה׳)</div>
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

      <div class="vp-footer">* שימו לב: ייתכנו שינויים בתוכנית החוגים. הלוח מיועד להורים וילדי הצהרון.</div>
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

  printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <title>${filename}</title>
  <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;600;700;800&display=swap" rel="stylesheet">
  ${_getStyles()}
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .vp-page { page-break-after: always; margin: 0; padding: 10mm 12mm; }
      .vp-page:last-child { page-break-after: auto; }
      .vp-no-print { display: none !important; }
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
      width: 794px;
      min-height: 1100px;
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
    .vp-logo-text { font-size: 24px; font-weight: 700; color: #0f172a; }
    .vp-header-sub { font-size: 12px; color: #44403c; margin-top: 2px; }
    .vp-month-badge {
      background: rgba(255,255,255,0.5);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
    }

    /* Garden Bar */
    .vp-garden-bar {
      background: linear-gradient(135deg, #059669, #10b981);
      color: white;
      padding: 12px 20px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 8px;
      position: relative;
    }
    .vp-garden-name { font-size: 20px; font-weight: 700; }
    .vp-garden-sub { font-size: 12px; opacity: 0.9; flex: 1; }
    .vp-age-badge {
      background: rgba(255,255,255,0.25);
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
    }

    .vp-mgr-line {
      text-align: left;
      font-size: 12px;
      color: #64748b;
      margin-bottom: 8px;
      padding: 0 4px;
    }

    /* Section Title */
    .vp-section-title {
      font-size: 15px;
      font-weight: 700;
      color: #1e293b;
      margin: 8px 0 6px;
      text-align: right;
    }

    /* Activity Cards */
    .vp-cards-grid {
      display: flex;
      gap: 12px;
      margin-bottom: 10px;
    }
    .vp-activity-card {
      flex: 1;
      border: 1px solid #e2e8f0;
      border-right: 5px solid #3b82f6;
      border-radius: 10px;
      padding: 10px 14px;
      position: relative;
    }
    .vp-card-badge {
      position: absolute;
      top: -1px;
      left: 10px;
      padding: 2px 10px;
      border-radius: 0 0 8px 8px;
      color: white;
      font-size: 10px;
      font-weight: 600;
    }
    .vp-activity-card h3 {
      margin: 4px 0 6px;
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
    }
    .vp-activity-card p {
      margin: 2px 0;
      font-size: 11px;
      color: #64748b;
    }

    /* Calendar */
    .vp-calendar-section { margin-top: 6px; }
    .vp-calendar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .vp-calendar-title {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
    }
    .vp-legend {
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: #64748b;
    }
    .vp-legend-item { display: flex; align-items: center; gap: 4px; }
    .vp-legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }

    .vp-calendar-container {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }
    .vp-days-header {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      background: #f1f5f9;
      text-align: center;
      font-weight: 700;
      font-size: 12px;
      color: #334155;
      padding: 8px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .vp-calendar-body {
      background: #e2e8f0;
    }
    .vp-calendar-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 1px;
    }
    .vp-calendar-row + .vp-calendar-row {
      border-top: 1px solid #e2e8f0;
    }
    .vp-day-cell {
      background: #ffffff;
      padding: 6px;
      min-height: 68px;
      display: flex;
      flex-direction: column;
    }
    .vp-day-empty { background: #f8fafc; }
    .vp-day-holiday { background: #fffbeb; }
    .vp-day-number {
      font-size: 13px;
      font-weight: 700;
      color: #94a3b8;
      margin-bottom: 4px;
    }

    /* Event Pills */
    .vp-event-pill {
      padding: 3px 6px;
      border-radius: 6px;
      font-size: 10px;
      line-height: 1.3;
      text-align: center;
      margin-top: 2px;
      font-weight: 600;
    }
    .vp-event-holiday {
      background: #fef3c7 !important;
      color: #92400e !important;
      border: 1px solid #fcd34d !important;
      font-weight: 500;
    }

    /* Footer */
    .vp-footer {
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid #f1f5f9;
    }
  </style>`;
}
