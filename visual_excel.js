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
        await _exportPDF(html, `לוח_מעוצב_${g.name}_${fromM}.pdf`, month);
        filesExported++;
        // short delay to allow browser to handle multiple popups
        await new Promise(r => setTimeout(r, 800));
      }
      if (filesExported === 0) window.spAlert('לא נמצאו פעילויות לייצוא');
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
        await _exportPDF(pagesHtml, `לוח_מעוצב_${city||'כל_הגנים'}_${fromM}.pdf`, month);
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
          <img src="logo_wide.png" style="height:80px;" alt="Kids טומשין">
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
        <div style="text-align: center; margin-top: 12px;">
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
  ${htmlContent.replace(/<div class="vp-page">/g, `<div class="vp-page"><div class="vp-watermark">${styles.watermarkSVG}<\/div>`)}
</body>
</html>`);
  printWindow.document.close();
}

function _getStyles(month) {
  // Rich seasonal SVG watermarks - injected inline for reliable print rendering
  const seasonMap = {
    1: 'winter', 2: 'winter', 12: 'winter',
    3: 'spring', 4: 'spring', 5: 'spring',
    6: 'summer', 7: 'summer', 8: 'summer',
    9: 'autumn', 10: 'autumn', 11: 'autumn'
  };
  const season = seasonMap[month] || 'summer';

  // Each SVG is designed with fills and strokes - grayscale-compatible
  const watermarkSVGs = {
    winter: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
      <!-- Snowflake -->
      <g transform="translate(150,150)" stroke="#1e3a5f" stroke-linecap="round" fill="none">
        <line x1="0" y1="-130" x2="0" y2="130" stroke-width="10"/>
        <line x1="-130" y1="0" x2="130" y2="0" stroke-width="10"/>
        <line x1="-92" y1="-92" x2="92" y2="92" stroke-width="10"/>
        <line x1="92" y1="-92" x2="-92" y2="92" stroke-width="10"/>
        <line x1="-30" y1="-110" x2="0" y2="-130"/><line x1="30" y1="-110" x2="0" y2="-130"/>
        <line x1="-30" y1="110" x2="0" y2="130"/><line x1="30" y1="110" x2="0" y2="130"/>
        <line x1="-110" y1="-30" x2="-130" y2="0"/><line x1="-110" y1="30" x2="-130" y2="0"/>
        <line x1="110" y1="-30" x2="130" y2="0"/><line x1="110" y1="30" x2="130" y2="0"/>
        <line x1="-65" y1="-112" x2="-78" y2="-92"/><line x1="-65" y1="-72" x2="-78" y2="-92"/>
        <line x1="65" y1="-112" x2="78" y2="-92"/><line x1="65" y1="-72" x2="78" y2="-92"/>
        <circle cx="0" cy="0" r="20" stroke-width="8" fill="#d6eaf8"/>
        <circle cx="0" cy="-130" r="8" fill="#1e3a5f"/>
        <circle cx="0" cy="130" r="8" fill="#1e3a5f"/>
        <circle cx="-130" cy="0" r="8" fill="#1e3a5f"/>
        <circle cx="130" cy="0" r="8" fill="#1e3a5f"/>
      </g>
    </svg>`,

    spring: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
      <!-- Large bloom flower -->
      <g transform="translate(150,150)">
        <ellipse cx="0" cy="-65" rx="22" ry="55" fill="#f9a8d4" stroke="#be185d" stroke-width="3"/>
        <ellipse cx="0" cy="-65" rx="22" ry="55" fill="#f9a8d4" stroke="#be185d" stroke-width="3" transform="rotate(45)"/>
        <ellipse cx="0" cy="-65" rx="22" ry="55" fill="#fde68a" stroke="#d97706" stroke-width="3" transform="rotate(90)"/>
        <ellipse cx="0" cy="-65" rx="22" ry="55" fill="#fde68a" stroke="#d97706" stroke-width="3" transform="rotate(135)"/>
        <ellipse cx="0" cy="-65" rx="22" ry="55" fill="#f9a8d4" stroke="#be185d" stroke-width="3" transform="rotate(180)"/>
        <ellipse cx="0" cy="-65" rx="22" ry="55" fill="#f9a8d4" stroke="#be185d" stroke-width="3" transform="rotate(225)"/>
        <ellipse cx="0" cy="-65" rx="22" ry="55" fill="#fde68a" stroke="#d97706" stroke-width="3" transform="rotate(270)"/>
        <ellipse cx="0" cy="-65" rx="22" ry="55" fill="#fde68a" stroke="#d97706" stroke-width="3" transform="rotate(315)"/>
        <circle cx="0" cy="0" r="30" fill="#fbbf24" stroke="#92400e" stroke-width="4"/>
        <circle cx="0" cy="0" r="15" fill="#f59e0b" stroke="#78350f" stroke-width="2"/>
        <!-- Stem -->
        <line x1="0" y1="30" x2="0" y2="110" stroke="#15803d" stroke-width="8" stroke-linecap="round"/>
        <!-- Leaves -->
        <ellipse cx="-25" cy="75" rx="22" ry="10" fill="#16a34a" stroke="#15803d" stroke-width="2" transform="rotate(-30 -25 75)"/>
        <ellipse cx="25" cy="90" rx="22" ry="10" fill="#16a34a" stroke="#15803d" stroke-width="2" transform="rotate(30 25 90)"/>
      </g>
    </svg>`,

    summer: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
      <!-- Bright sun -->
      <g transform="translate(150,150)">
        <!-- Rays -->
        <g stroke="#f59e0b" stroke-width="8" stroke-linecap="round">
          <line x1="0" y1="-60" x2="0" y2="-120"/>
          <line x1="0" y1="60" x2="0" y2="120"/>
          <line x1="-60" y1="0" x2="-120" y2="0"/>
          <line x1="60" y1="0" x2="120" y2="0"/>
          <line x1="-42" y1="-42" x2="-85" y2="-85"/>
          <line x1="42" y1="-42" x2="85" y2="-85"/>
          <line x1="-42" y1="42" x2="-85" y2="85"/>
          <line x1="42" y1="42" x2="85" y2="85"/>
          <!-- Short rays between -->
          <line x1="-25" y1="-55" x2="-45" y2="-100"/>
          <line x1="25" y1="-55" x2="45" y2="-100"/>
          <line x1="-55" y1="-25" x2="-100" y2="-45"/>
          <line x1="-55" y1="25" x2="-100" y2="45"/>
          <line x1="55" y1="-25" x2="100" y2="-45"/>
          <line x1="55" y1="25" x2="100" y2="45"/>
          <line x1="-25" y1="55" x2="-45" y2="100"/>
          <line x1="25" y1="55" x2="45" y2="100"/>
        </g>
        <!-- Sun body -->
        <circle cx="0" cy="0" r="55" fill="#fde68a" stroke="#f59e0b" stroke-width="6"/>
        <circle cx="0" cy="0" r="42" fill="#fbbf24" stroke="#d97706" stroke-width="3"/>
        <!-- Face -->
        <circle cx="-16" cy="-10" r="6" fill="#92400e"/>
        <circle cx="16" cy="-10" r="6" fill="#92400e"/>
        <path d="M -18 12 Q 0 28 18 12" stroke="#92400e" stroke-width="4" fill="none" stroke-linecap="round"/>
      </g>
    </svg>`,

    autumn: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
      <!-- Tree with autumn leaves -->
      <!-- Trunk -->
      <rect x="135" y="200" width="30" height="80" rx="6" fill="#78350f" stroke="#451a03" stroke-width="2"/>
      <!-- Branches -->
      <line x1="150" y1="220" x2="90" y2="160" stroke="#92400e" stroke-width="8" stroke-linecap="round"/>
      <line x1="150" y1="220" x2="210" y2="165" stroke="#92400e" stroke-width="8" stroke-linecap="round"/>
      <line x1="150" y1="200" x2="150" y2="130" stroke="#92400e" stroke-width="10" stroke-linecap="round"/>
      <!-- Leaf clusters -->
      <ellipse cx="150" cy="110" rx="55" ry="50" fill="#f97316" stroke="#ea580c" stroke-width="2" opacity="0.9"/>
      <ellipse cx="95" cy="140" rx="45" ry="40" fill="#eab308" stroke="#ca8a04" stroke-width="2" opacity="0.9"/>
      <ellipse cx="205" cy="145" rx="45" ry="38" fill="#dc2626" stroke="#b91c1c" stroke-width="2" opacity="0.9"/>
      <ellipse cx="150" cy="120" rx="35" ry="30" fill="#fdba74" stroke="#f97316" stroke-width="2" opacity="0.7"/>
      <!-- Falling leaves -->
      <ellipse cx="55" cy="200" rx="12" ry="7" fill="#f97316" stroke="#ea580c" stroke-width="1.5" transform="rotate(-30 55 200)"/>
      <ellipse cx="240" cy="185" rx="10" ry="6" fill="#eab308" stroke="#ca8a04" stroke-width="1.5" transform="rotate(20 240 185)"/>
      <ellipse cx="70" cy="240" rx="9" ry="5" fill="#dc2626" stroke="#b91c1c" stroke-width="1.5" transform="rotate(-45 70 240)"/>
      <ellipse cx="230" cy="240" rx="11" ry="6" fill="#f97316" stroke="#ea580c" stroke-width="1.5" transform="rotate(35 230 240)"/>
    </svg>`
  };

  const watermarkSVG = watermarkSVGs[season];

  return {
    css: `<style>
    .vp-page {
      display: flex;
      flex-direction: column;
      width: 794px;
      height: 1122px; /* A4 height at 96dpi (297mm) */
      box-sizing: border-box;
      padding: 10mm 12mm;
      margin: 0 auto;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-family: 'Assistant', Arial, sans-serif;
      direction: rtl;
      page-break-after: always;
      color: #1e293b;
      position: relative;
    }
    .vp-watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 380px;
      height: 380px;
      opacity: 0.10;
      pointer-events: none;
      z-index: 0;
    }
    .vp-watermark svg { width: 100%; height: 100%; }

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
      white-space: nowrap;
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
      overflow: visible;
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
    .vp-day-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 2px solid #e2e8f0;
      color: #000;
      font-weight: 800;
      font-size: 16px;
    }
    .vp-day-date {
      white-space: nowrap;
      color: #000;
    }
    .vp-day-event-text {
      flex: 1;
      text-align: right;
      padding-left: 8px;
      line-height: 1.1;
      font-size: 14px;
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
    .vp-holiday-text {
      color: #b45309;
    }
    .vp-camp-text {
      color: #0284c7;
    }

    /* Footer */
    .vp-footer {
      display: inline-block;
      font-size: 22px;
      font-weight: 800;
      color: #dc2626;
      background: #fee2e2;
      padding: 6px 24px;
      border-radius: 9999px;
      border: 2px solid #f87171;
    }

    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .vp-page {
        background-image: var(--wm) !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Print B&W Overrides */
      .vp-header { background: #fff !important; color: #000 !important; border: 2px solid #000 !important; }
      .vp-header-sub, .vp-month-badge { color: #000 !important; border: 2px solid #000 !important; background: #fff !important; }
      .vp-garden-bar { background: #fff !important; color: #000 !important; border: 2px solid #000 !important; }
      .vp-garden-name, .vp-mgr-line { color: #000 !important; font-weight: 800 !important; }
      
      .vp-activity-card { border: 2px solid #000 !important; border-right: 6px solid #000 !important; background: #fff !important; }
      .vp-card-badge { background: #fff !important; color: #000 !important; border: 2px solid #000 !important; border-top: none !important; font-weight: 800 !important; }
      .vp-activity-card h3, .vp-activity-card p { color: #000 !important; }
      
      .vp-legend-dot { background: #fff !important; border: 2px solid #000 !important; }
      .vp-legend { color: #000 !important; font-weight: 800 !important; }
      
      .vp-calendar-container { border: 2px solid #000 !important; border-radius: 0 !important; }
      .vp-days-header { background: #fff !important; color: #000 !important; border-bottom: 2px solid #000 !important; border-top: none !important; border-left: none !important; border-right: none !important; }
      .vp-days-header > div { border-left: 2px solid #000 !important; }
      .vp-days-header > div:last-child { border-left: none !important; }
      
      .vp-calendar-body { background: transparent !important; }
      .vp-calendar-row { gap: 0 !important; border-bottom: 2px solid #000 !important; }
      .vp-calendar-row:last-child { border-bottom: none !important; }
      .vp-day-cell { border-left: 2px solid #000 !important; }
      .vp-day-cell:last-child { border-left: none !important; }
      
      .vp-day-empty { background: #f8fafc !important; }
      .vp-day-holiday { background: #f1f5f9 !important; }
      .vp-day-camp { background: #e2e8f0 !important; }
      .vp-day-header-row { color: #000 !important; border-bottom: 2px solid #000 !important; }
      .vp-day-date, .vp-day-event-text { color: #000 !important; }
      
      .vp-event-pill { background: #fff !important; color: #000 !important; border: 2px solid #000 !important; }
      .vp-event-holiday { background: #e2e8f0 !important; color: #000 !important; border: 2px solid #000 !important; }
      .vp-holiday-text, .vp-camp-text { color: #000 !important; }
      
      .vp-footer { 
        background: #f1f5f9 !important; 
        color: #000 !important; 
        border: 2px solid #000 !important; 
      }
    }
  </style>`,
    watermarkSVG: watermarkSVG
  };
}
