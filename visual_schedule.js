function doVisualExport() {
  const fromM = document.getElementById('exp-from').value;
  const toM = document.getElementById('exp-to').value;
  if (!fromM || !toM) { window.spAlert('יש לבחור תקופה'); return; }
  if (fromM !== toM) { window.spAlert('בלוח המעוצב ניתן להפיק חודש אחד בכל פעם. אנא בחר טווח של חודש בודד.'); return; }
  
  const mode = document.querySelector('input[name="exp-mode"]:checked').value;
  const cityFilter = document.getElementById('exp-city').value;
  const mgrFilter = document.getElementById('exp-mgr').value;
  const gardenFilter = parseInt(document.getElementById('exp-garden').value) || 0;
  const showPhones = document.getElementById('exp-phones').checked;

  const [fy, fm] = fromM.split('-').map(Number);
  const fromDate = `${fy}-${String(fm).padStart(2, '0')}-01`;
  const toDate = window.d2s(new Date(fy, fm, 0)); // last day of month

  let evs = window.SCH.filter(s => s.d >= fromDate && s.d <= toDate && s.status !== 'cancelled' && s.status !== 'postponed'); // maybe skip cancelled?
  
  const rawList = typeof AG === 'function' ? AG() : [...(window.GARDENS||[]), ...(window._GARDENS_EXTRA||[])];
  const gMap = new Map();
  rawList.forEach(g => gMap.set(Number(g.id), g));
  let gList = Array.from(gMap.values()).sort((a,b) => (a.city||'').localeCompare(b.city||'','he') || (a.name||'').localeCompare(b.name||'','he'));
  
  if(mode==='city' && cityFilter)   gList = gList.filter(g => g.city === cityFilter);
  if(mode==='manager' && mgrFilter) { 
    const mgrObj = window.managers[mgrFilter]; 
    if(mgrObj?.gardenIds) gList = gList.filter(g => mgrObj.gardenIds.includes(g.id)); 
  }
  if(mode==='garden') { 
    if(!gardenFilter){ window.spAlert('יש לבחור צהרון מהרשימה'); return; } 
    gList = gList.filter(g => g.id === gardenFilter); 
  }

  // filter only gardens that actually have events, unless it's a specific garden selected
  if (mode !== 'garden') {
    gList = gList.filter(g => evs.some(e => e.g === g.id));
  }

  if (!gList.length) {
    window.spAlert('לא נמצאו נתונים להפקה לפי הסינון שנבחר.');
    return;
  }

  generatePrintableHTML(gList, evs, fy, fm, showPhones);
}

function generatePrintableHTML(gardens, allEvs, year, month, showPhones) {
  // 1. Calculate calendar structure (Sunday-Thursday only)
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthWeeks = [];
  let currentWeek = [null, null, null, null, null];
  
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dateObj.getDay(); // 0=Sun, ..., 4=Thu, 5=Fri, 6=Sat
    
    if (dayOfWeek >= 0 && dayOfWeek <= 4) {
      currentWeek[dayOfWeek] = d;
    }
    
    // If Thursday or last day of month, push week (only if it has any days)
    if (dayOfWeek === 4 || d === daysInMonth) {
      if (currentWeek.some(day => day !== null)) {
        monthWeeks.push([...currentWeek]);
      }
      currentWeek = [null, null, null, null, null];
    }
  }

  // Predefined color themes for activity cards
  const colorThemes = [
    { type: 'card-theater', icon: 'fa-masks-theater', dotColor: '#FF6B6B', badgeClass: 'badge-theater', tdClass: 'td-theater', tagBg: '#FEE2E2', tagCol: '#DC2626' },
    { type: 'card-movement', icon: 'fa-person-running', dotColor: '#10B981', badgeClass: 'badge-movement', tdClass: 'td-movement', tagBg: '#DCFCE7', tagCol: '#16A34A' },
    { type: 'card-music', icon: 'fa-music', dotColor: '#9D4EDD', badgeClass: 'badge-music', tdClass: 'td-music', tagBg: '#F3E8FF', tagCol: '#9333EA' },
    { type: 'card-leadership', icon: 'fa-lightbulb', dotColor: '#FFB703', badgeClass: 'badge-leadership', tdClass: 'td-leadership', tagBg: '#FEF3C7', tagCol: '#D97706' },
    { type: 'card-art', icon: 'fa-palette', dotColor: '#0EA5E9', badgeClass: 'badge-art', tdClass: 'td-art', tagBg: '#E0F2FE', tagCol: '#0284C7' },
    { type: 'card-science', icon: 'fa-flask', dotColor: '#EC4899', badgeClass: 'badge-science', tdClass: 'td-science', tagBg: '#FCE7F3', tagCol: '#DB2777' }
  ];

  const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
  const monthName = monthNames[month - 1];

  let pagesHtml = '';

  gardens.forEach(g => {
    const gEvs = allEvs.filter(e => e.g === g.id);
    
    // Identify unique clubs/activities
    const clubsMap = new Map();
    gEvs.forEach(ev => {
      // Skip holidays if they somehow get into gEvs (they usually don't, but just in case)
      if (ev.desc && (ev.desc.includes('חופש') || ev.desc.includes('חג') || ev.desc.includes('מועד'))) return;
      
      let actName = ev.act;
      if (!actName && typeof window.supAct === 'function') {
        actName = window.supAct(ev.a);
      }
      if (!actName) actName = 'פעילות';

      const clubName = actName;
      if (!clubsMap.has(clubName)) {
        clubsMap.set(clubName, {
          name: clubName,
          events: [],
          phone: '',
          supplierId: ev.a || ''
        });
      }
      clubsMap.get(clubName).events.push(ev);
    });

    const clubs = Array.from(clubsMap.values());
    
    // Assign themes
    clubs.forEach((club, idx) => {
      club.theme = colorThemes[idx % colorThemes.length];
      // Try to find supplier phone
      // Try to find supplier phone (ev.a usually has the id or name)
      if (club.supplierId && window.SUPPLIERS) {
        // Compare as string since sometimes it's numeric ID and sometimes name
        const sup = window.SUPPLIERS.find(s => String(s.id) === String(club.supplierId) || s.name === club.supplierId);
        if (sup && sup.phone) club.phone = sup.phone;
      }
      
      // Determine day and time from the first event
      if (club.events.length > 0) {
        const firstEv = club.events[0];
        const dObj = new Date(firstEv.d);
        const daysHe = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
        club.dayStr = 'יום ' + daysHe[dObj.getDay()];
        club.timeStr = firstEv.t || '14:00';
      }
    });

    const regularClubs = clubs.filter(c => c.events.length >= 2);
    const oneOffClubs = clubs.filter(c => c.events.length < 2);

    // Coordinator
    const mgr = window.gardenManager ? window.gardenManager(g.id) : null;
    const coordinatorStr = mgr ? `${mgr.name} • ${mgr.phone || ''}` : 'מוקד צהרונים';

    // Build Cards HTML (Only for regular clubs)
    let cardsHtml = '';
    regularClubs.forEach(club => {
      const shortName = club.name.includes('-') ? club.name.split('-')[1].trim() : club.name.split(' ')[0];
      const phoneHtml = (showPhones && club.phone) 
        ? `<a href="tel:${club.phone.replace(/[^0-9]/g, '')}"><i class="fa-solid fa-phone"></i> ${club.phone}</a>`
        : `<span>&nbsp;</span>`;

      cardsHtml += `
        <div class="activity-card ${club.theme.type}">
          <div>
            <div class="card-top">
              <span class="activity-type-tag" style="background:${club.theme.tagBg}; color:${club.theme.tagCol}">חוג קבוע</span>
              <div class="activity-icon-bubble" style="background:${club.theme.tagBg}; color:${club.theme.tagCol}">
                <i class="fa-solid ${club.theme.icon}"></i>
              </div>
            </div>
            <div class="card-body">
              <h4>${club.name}</h4>
              <div class="card-schedule-pills">
                <span class="sched-pill">
                  <i class="fa-regular fa-clock" style="color: ${club.theme.dotColor};"></i> ${club.dayStr}
                </span>
                <span class="sched-pill">
                  <i class="fa-solid fa-hourglass-half" style="color: ${club.theme.dotColor};"></i> ${club.timeStr}
                </span>
              </div>
            </div>
          </div>
          <div class="card-footer-info">
            <span>${(showPhones && club.phone) ? 'מפעיל / פרטים:' : '&nbsp;'}</span>
            ${phoneHtml}
          </div>
        </div>
      `;
    });

    // Calendar HTML
    let calendarHtml = '';
    monthWeeks.forEach(week => {
      calendarHtml += `<tr>`;
      week.forEach(day => {
        if (day === null) {
          calendarHtml += `<td style="background: #F9FAFB; border: none;"></td>`;
        } else {
          // Find event for this day
          const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const dayEvs = gEvs.filter(e => e.d === dateStr);
          
          let cellContent = `<span class="day-num">${day}</span>`;
          let tdClass = '';
          
          const hol = typeof window.getHolidayInfo === 'function' ? window.getHolidayInfo(dateStr, g.city, typeof window.getGardenClass === 'function' ? window.getGardenClass(g) : g.cls) : null;
          const isCamp = hol && (hol.type === 'camp' || hol.label === 'קייטנה' || hol.canSched);
          const isHoliday = hol && !isCamp;

          if (isHoliday) {
            tdClass = 'td-holiday';
            cellContent += `<span class="event-badge badge-holiday" title="${hol.name || hol.label}">${hol.name || hol.label}</span>`;
          }
          
          dayEvs.forEach(ev => {
            let actName = ev.act;
            if (!actName && typeof window.supAct === 'function') actName = window.supAct(ev.a);
            if (!actName) actName = 'פעילות';

            const club = clubs.find(c => c.name === actName);
            if (club && regularClubs.includes(club)) {
              tdClass = club.theme.tdClass;
              const shortLabel = club.name.includes('-') ? club.name.split('-')[1].trim() : club.name.split(' ')[0];
              cellContent += `<span class="event-badge ${club.theme.badgeClass}" title="${club.name}">${shortLabel} (${ev.t || ''})</span>`;
            } else {
              // one-off event or camp event
              cellContent += `<span class="event-badge" style="background:#E2E8F0; color:#475569" title="${actName}">${actName} (${ev.t || ''})</span>`;
            }
          });
          
          calendarHtml += `<td class="${tdClass}">${cellContent}</td>`;
        }
      });
      calendarHtml += `</tr>`;
    });

    let legendsHtml = '';
    regularClubs.forEach(club => {
      const shortName = club.name.includes('-') ? club.name.split('-')[1].trim() : club.name.split(' ')[0];
      legendsHtml += `
        <div class="legend-item">
          <span class="legend-dot" style="background: ${club.theme.dotColor};"></span>
          <span>${shortName}</span>
        </div>
      `;
    });

    // Handle variable grid columns
    let gridCols = '1fr';
    if (regularClubs.length === 2) gridCols = '1fr 1fr';
    if (regularClubs.length >= 3) gridCols = '1fr 1fr 1fr';

    pagesHtml += `
      <div class="schedule-canvas">
        <div class="decor-circle decor-1"></div>
        <div class="decor-circle decor-2"></div>
        <div class="decor-circle decor-3"></div>

        <div class="schedule-content">
          <div class="header-bar">
            <div class="brand-area">
              <img src="logo_wide.png" alt="Logo" style="height: 50px; object-fit: contain; margin-left: 15px;" onerror="this.style.display='none'">
              <div class="brand-text">
                <h2>${g.city || 'עיר כללית'}</h2>
                <span>תוכנית העשרה ופעילויות לצהרון</span>
              </div>
            </div>
            <div class="meta-badges">
              <span class="month-pill">
                <i class="fa-regular fa-calendar"></i> ${monthName} ${year}
              </span>
            </div>
          </div>

          <div class="kindergarten-hero">
            <div class="kindergarten-info">
              <h3><i class="fa-solid fa-shapes"></i> <span>${g.name || 'צהרון'}</span></h3>
              <p>תוכנית העשרה ופעילויות חודשית</p>
            </div>
            <div class="age-badge">
               ${g.symbol ? 'סמל מוסד: ' + g.symbol : ''}
            </div>
          </div>

          ${regularClubs.length > 0 ? `
          <div class="section-headline">
            <i class="fa-solid fa-star" style="color: #FFB703;"></i> החוגים הקבועים שלנו החודש
          </div>
          <div class="activities-grid" style="grid-template-columns: ${gridCols};">
            ${cardsHtml}
          </div>
          ` : ''}

          <div class="calendar-wrapper">
            <div class="cal-header-row">
              <div class="section-headline" style="margin-bottom: 0;">
                <i class="fa-solid fa-calendar-days" style="color: #4D96FF;"></i> לוח מועדים חודשי (ימים א'-ה')
              </div>
              <div class="cal-legend">
                ${legendsHtml}
                <div class="legend-item">
                  <span class="legend-dot" style="background: #9CA3AF;"></span>
                  <span>חג / אירוע</span>
                </div>
              </div>
            </div>

            <table class="table-container">
              <thead>
                <tr>
                  <th>ראשון</th><th>שני</th><th>שלישי</th><th>רביעי</th><th>חמישי</th>
                </tr>
              </thead>
              <tbody>
                ${calendarHtml}
              </tbody>
            </table>
          </div>

          ${oneOffClubs.length > 0 ? `
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px;">
            <div class="section-headline" style="margin-bottom: 10px; font-size: 15px;">
              <i class="fa-solid fa-bolt" style="color: #F59E0B;"></i> פירוט ימי שיא והפעלות קייטנה החודש
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${oneOffClubs.map(c => `
                <div style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                  <span style="background: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 6px; padding: 3px 8px; font-weight: 700; color: #475569;">
                    ${c.events[0].d.split('-').reverse().join('/')}
                  </span>
                  <strong style="color: #1F2937;">${c.name}</strong>
                  ${showPhones && c.phone ? `<span style="color: #64748B; margin-right: 4px;">(מפעיל: ${c.phone})</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <div class="schedule-footer">
            <div class="contact-bubble">
              <i class="fa-solid fa-headset"></i>
              <span>לשאלות ובירורים:</span>
              <span style="direction: ltr; font-weight: 800;">${coordinatorStr}</span>
            </div>
            <div class="disclaimer-note">
              <i class="fa-solid fa-circle-info"></i>
              <span>* שימו לב: ייתכנו שינויים בתוכנית החוגים</span>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>לוח חוגים חודשי</title>
      <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;600;700;800&family=Rubik:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
      <style>
        :root {
          --primary: #FF6B6B;
          --primary-light: #FFE3E3;
          --secondary: #4D96FF;
          --secondary-light: #E1EFFF;
          --accent-purple: #9D4EDD;
          --accent-purple-light: #F3E8FF;
          --accent-green: #38B000;
          --accent-green-light: #EBFEE7;
          --accent-yellow: #FFB703;
          --accent-yellow-light: #FFF8E5;
          --dark: #2B2D42;
          --text-muted: #6C757D;
          --shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.03);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Assistant', sans-serif; background-color: #F1F4F9; color: var(--dark); padding: 24px; line-height: 1.5; margin:0; }
        
        /* A4 Canvas */
        .schedule-canvas {
          width: 210mm; height: 297mm; margin: 0 auto 40px auto; background: #FFFFFF; border-radius: 20px;
          padding: 22mm 18mm 16mm 18mm; box-shadow: var(--shadow); display: flex; flex-direction: column;
          justify-content: space-between; position: relative; overflow: hidden; page-break-after: always;
        }
        .decor-circle { position: absolute; border-radius: 50%; pointer-events: none; z-index: 0; opacity: 0.55; }
        .decor-1 { width: 140px; height: 140px; background: #FFF1F2; top: -40px; right: -40px; }
        .decor-2 { width: 160px; height: 160px; background: #EFF6FF; bottom: -50px; left: -50px; }
        .decor-3 { width: 80px; height: 80px; background: #FEF3C7; top: 120px; left: -30px; }
        
        .schedule-content { position: relative; z-index: 1; height: 100%; display: flex; flex-direction: column; }
        
        .header-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #F3F4F6; padding-bottom: 16px; margin-bottom: 20px; }
        .brand-area { display: flex; align-items: center; gap: 14px; }
        .brand-text h2 { font-family: 'Rubik', sans-serif; font-size: 22px; font-weight: 800; color: #111827; letter-spacing: -0.5px; line-height: 1.1; margin-bottom:2px; }
        .brand-text span { font-size: 13px; color: var(--text-muted); font-weight: 600; }
        .month-pill { background: #F3F4F6; color: #374151; padding: 5px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
        
        .kindergarten-hero { background: linear-gradient(135deg, #4D96FF 0%, #3B82F6 100%); color: white; border-radius: 16px; padding: 16px 22px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; flex-shrink: 0; }
        .kindergarten-info h3 { font-family: 'Rubik', sans-serif; font-size: 26px; font-weight: 800; display: flex; align-items: center; gap: 10px; margin-bottom: 2px; }
        .kindergarten-info p { font-size: 15px; opacity: 0.92; font-weight: 500; }
        .age-badge { background: rgba(255,255,255,0.22); backdrop-filter: blur(4px); padding: 7px 16px; border-radius: 12px; font-size: 15px; font-weight: 700; border: 1px solid rgba(255,255,255,0.4); }
        
        .section-headline { font-family: 'Rubik', sans-serif; font-size: 17px; font-weight: 700; color: #374151; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .activities-grid { display: grid; gap: 16px; margin-bottom: 24px; flex-shrink: 0; }
        .activity-card { border-radius: 16px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; border: 2px solid transparent; min-height:120px; }
        
        .card-theater { background: #FFF4F4; border-color: #FED7D7; }
        .card-movement { background: #F0FDF4; border-color: #BBF7D0; }
        .card-music { background: #FAF5FF; border-color: #E9D5FF; }
        .card-leadership { background: #FFFBEB; border-color: #FDE68A; }
        .card-art { background: #F0F9FF; border-color: #BAE6FD; }
        .card-science { background: #FDF2F8; border-color: #FBCFE8; }
        
        .card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
        .activity-type-tag { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 8px; text-transform: uppercase; }
        .activity-icon-bubble { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
        
        .card-body h4 { font-family: 'Rubik', sans-serif; font-size: 17px; font-weight: 800; color: #1F2937; margin-bottom: 8px; line-height: 1.1; }
        .card-schedule-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
        .sched-pill { font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; background: #FFFFFF; border: 1px solid #E5E7EB; color: #374151; }
        .card-footer-info { border-top: 1px dashed rgba(0,0,0,0.08); padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #4B5563; }
        .card-footer-info a { color: inherit; text-decoration: none; font-weight: 600; display: flex; align-items: center; gap: 4px; direction: ltr; }
        
        /* Calendar */
        .calendar-wrapper { background: #FFFFFF; border: 1.5px solid #F3F4F6; border-radius: 16px; padding: 16px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); flex-grow: 1; display:flex; flex-direction:column; }
        .cal-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-shrink: 0; }
        .cal-legend { display: flex; gap: 12px; font-size: 12px; font-weight: 600; flex-wrap: wrap; }
        .legend-item { display: flex; align-items: center; gap: 4px; }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
        
        .table-container { width: 100%; border-collapse: separate; border-spacing: 5px; flex-grow: 1; }
        .table-container th { font-size: 13px; font-weight: 700; color: #6B7280; text-align: center; padding-bottom: 4px; }
        .table-container td { width: 20%; height: auto; border-radius: 10px; border: 1px solid #F1F5F9; background: #FAFAFA; vertical-align: top; padding: 6px; font-size: 12px; }
        .day-num { font-size: 13px; font-weight: 700; color: #374151; display: block; margin-bottom: 2px; }
        
        .td-holiday { background-color: #F3F4F6 !important; border: 1px dashed #CBD5E1 !important; }
        .td-theater { background-color: #FFF1F2 !important; border-color: #FECDD3 !important; }
        .td-movement { background-color: #F0FDF4 !important; border-color: #BBF7D0 !important; }
        .td-music { background-color: #FAF5FF !important; border-color: #E9D5FF !important; }
        .td-leadership { background-color: #FFFBEB !important; border-color: #FDE68A !important; }
        .td-art { background-color: #F0F9FF !important; border-color: #BAE6FD !important; }
        .td-science { background-color: #FDF2F8 !important; border-color: #FBCFE8 !important; }
        
        .event-badge { display: block; font-size: 11px; font-weight: 700; border-radius: 4px; padding: 2px 4px; line-height: 1.1; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .badge-holiday { background: #E5E7EB; color: #4B5563; }
        .badge-theater { background: #FFE4E6; color: #E11D48; }
        .badge-movement { background: #DCFCE7; color: #15803D; }
        .badge-music { background: #F3E8FF; color: #7E22CE; }
        .badge-leadership { background: #FEF3C7; color: #B45309; }
        .badge-art { background: #E0F2FE; color: #0284C7; }
        .badge-science { background: #FCE7F3; color: #DB2777; }
        
        .schedule-footer { border-top: 1.5px solid #F3F4F6; padding-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #4B5563; flex-shrink: 0; }
        .contact-bubble { display: flex; align-items: center; gap: 8px; font-weight: 700; color: #1F2937; }
        .contact-bubble i { color: #10B981; }
        .disclaimer-note { font-size: 12px; color: #9CA3AF; display: flex; align-items: center; gap: 5px; }
        
        .print-btn-float {
          position: fixed; top: 20px; left: 20px; background: #4D96FF; color: white; border: none; padding: 12px 24px;
          border-radius: 30px; font-family: inherit; font-size: 16px; font-weight: bold; cursor: pointer;
          box-shadow: 0 4px 15px rgba(77,150,255,0.4); z-index: 1000; display: flex; align-items: center; gap: 8px;
        }
        
        @media print {
          body { background: transparent !important; padding: 0 !important; }
          .print-btn-float { display: none !important; }
          .schedule-canvas { box-shadow: none !important; border-radius: 0 !important; padding: 12mm 14mm 10mm 14mm !important; width: 100% !important; height: 100vh !important; margin: 0 !important; page-break-after: always; }
          .decor-circle { display: block !important; }
        }
      </style>
    </head>
    <body>
      <button class="print-btn-float" onclick="window.print()"><i class="fa-solid fa-print"></i> הדפסה / שמירה כ-PDF</button>
      ${pagesHtml}
    </body>
    </html>
  `;

  const newWin = window.open('', '_blank');
  if (newWin) {
    newWin.document.write(fullHtml);
    newWin.document.close();
  } else {
    window.spAlert('פתיחת חלון נחסמה. אנא אפשר פופ-אפים לאתר זה.');
  }
}

window.doVisualExport = doVisualExport;
