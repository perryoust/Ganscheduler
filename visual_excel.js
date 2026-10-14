// visual_excel.js - מחולל לוח חוגים חודשי מעוצב (PDF ו-JPG)

window.doVisualExcelExport = async function(format = 'pdf') {
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
  const showPhones = document.getElementById('exp-phones') ? document.getElementById('exp-phones').checked : false;
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
      const gEvs = allEvs.filter(s => Number(s.g) === Number(g.id) || String(s.g) === String(g.id));
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

    if (format === 'jpg') {
      await _exportJPG(gList, allEvs, year, month, monthName, hebYearStr, showPhones);
    } else {
      await _exportPDF(pagesHtml, title, month);
      window.showToast(`📊 ${count} לוחות מעוצבים נפתחו בהצלחה!`);
    }
    window.CM('export-m'); // close modal
  } catch(e) {
    console.error('Visual PDF error:', e);
    window.spAlert('שגיאה ביצירת PDF מעוצב: ' + e.message);
  }
};

function _buildGardenPage(g, gEvs, year, month, monthName, hebYearStr, showPhones) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const fromDate = `${year}-${String(month).padStart(2,'0')}-01`;
  const toDate = `${year}-${String(month).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;

  // Helper to detect makeup / rescheduled event
  function isMakeupEv(s) {
    if (!s) return false;
    if (s._isMakeup || s._makeupFrom || s._postFrom) return true;
    const isMText = (str) => str && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(str) && !str.includes('השלמה נקבעה ל-');
    return !!(isMText(s.nt) || isMText(s.n) || isMText(s.a));
  }

  // Compute regular clubs using fixed schedule (from core_dash.js) with month boundary
  const fixedSched = typeof window.getGardenFixedSched === 'function' ? (window.getGardenFixedSched(g.id, fromDate, toDate) || []) : [];
  const regularClubs = [];
  const daysHe = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  function addClubToRegular(s) {
    if (!s || isMakeupEv(s)) return;
    let actName = s.act || (typeof window.supAct === 'function' ? window.supAct(s.a) : '');
    if (!actName) actName = 'פעילות';

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
      if (!phone && s.p && String(s.p).trim()) {
        phone = String(s.p).trim();
      }
      if (!phone && Array.isArray(gEvs)) {
        const evWithPhone = gEvs.find(e => (!e.st || e.st === 'ok') && (window.supBase ? window.supBase(e.a) === baseA : e.a === s.a) && e.p && String(e.p).trim());
        if (evWithPhone) phone = String(evWithPhone.p).trim();
      }
      if (!phone) {
        const ex = (window.supEx && (window.supEx[baseA] || window.supEx[s.a])) || {};
        phone = ex.ph1 || ex.ph2 || '';
      }
      if (!phone && Array.isArray(window.SUPBASE)) {
        const sb = window.SUPBASE.find(x => x.name === s.a || (window.supBase && window.supBase(x.name) === baseA));
        if (sb && sb.phone) phone = sb.phone;
      }
    }
    
    let cleanSupName = supName;
    if (cleanSupName && typeof window.supBase === 'function') {
      cleanSupName = window.supBase(cleanSupName);
    }

    const dow = s.d ? new Date(s.d).getDay() : 0;
    const dayStr = 'יום ' + (daysHe[dow] || 'ראשון');
    const timeStr = s.t ? s.t.slice(0,5) : '';

    // Check occurrences in this month (excluding makeups)
    const occsInMonth = (gEvs || []).filter(ev => 
      (!ev.st || ev.st === 'ok') && 
      !isMakeupEv(ev) &&
      (window.supBase ? window.supBase(ev.a) === baseA : ev.a === s.a)
    ).length;

    // Check future occurrences after this month
    const hasFutureAfterMonth = (window.SCH || []).some(ev => 
      Number(ev.g) === Number(g.id) && 
      ev.d > toDate && 
      (!ev.st || ev.st === 'ok') &&
      !isMakeupEv(ev) &&
      (window.supBase ? window.supBase(ev.a) === baseA : ev.a === s.a)
    );

    // Filter out one-time activities that do not repeat and have no future schedule
    const hasEventsInMonth = (gEvs || []).length > 0;
    if (hasEventsInMonth) {
      const isRegularFrequency = occsInMonth >= 2 || (occsInMonth >= 1 && hasFutureAfterMonth);
      if (!isRegularFrequency) {
        return;
      }
    }

    // Check if regularClubs already has this supplier base - NEVER create duplicate cards for the same supplier
    const existingIdx = regularClubs.findIndex(c => 
      c.supplierId && baseA && (
        (window.supBase ? window.supBase(c.supplierId) === baseA : c.supplierId === s.a) ||
        (cleanSupName && c.supName && cleanSupName === c.supName)
      )
    );

    if (existingIdx >= 0) {
      const existingClub = regularClubs[existingIdx];
      // Compare occurrences on s's day of week vs existing club's day of week to find dominant regular day
      const thisDayCount = (gEvs || []).filter(ev => 
        (!ev.st || ev.st === 'ok') && 
        !isMakeupEv(ev) && 
        (window.supBase ? window.supBase(ev.a) === baseA : ev.a === s.a) && 
        new Date(ev.d).getDay() === dow
      ).length;

      const existingDow = daysHe.findIndex(dh => existingClub.dayStr === 'יום ' + dh);
      const existingDayCount = (gEvs || []).filter(ev => 
        (!ev.st || ev.st === 'ok') && 
        !isMakeupEv(ev) && 
        (window.supBase ? window.supBase(ev.a) === baseA : ev.a === s.a) && 
        new Date(ev.d).getDay() === existingDow
      ).length;

      if (thisDayCount > existingDayCount) {
        const sEx = (window.supEx && (window.supEx[baseA] || window.supEx[s.a])) || {};
        const flexNote = s.flexNote || (sEx.flexSched ? (sEx.flexNote || 'הימים והשעות עלולים להשתנות') : '');
        regularClubs[existingIdx] = {
          name: actName,
          supName: cleanSupName !== actName ? cleanSupName : '',
          dayStr: dayStr,
          timeStr: timeStr,
          phone: phone || regularClubs[existingIdx].phone || '',
          supplierId: s.a || '',
          flexNote: flexNote,
          tp: s.tp || ''
        };
      } else if (!regularClubs[existingIdx].phone && phone) {
        regularClubs[existingIdx].phone = phone;
      }
      return;
    }

    // If another club already exists for this day of the week, check if this candidate ended earlier
    const sameDayClub = regularClubs.find(c => c.dayStr === dayStr);
    if (sameDayClub) {
      const thisMaxDate = (gEvs || []).filter(ev => (!ev.st || ev.st === 'ok') && (window.supBase ? window.supBase(ev.a) === baseA : ev.a === s.a)).reduce((max, ev) => ev.d > max ? ev.d : max, s.d || '');
      const existingMaxDate = (gEvs || []).filter(ev => (!ev.st || ev.st === 'ok') && (window.supBase ? window.supBase(ev.a) === window.supBase(sameDayClub.supplierId) : ev.a === sameDayClub.supplierId)).reduce((max, ev) => ev.d > max ? ev.d : max, '');
      if (thisMaxDate < existingMaxDate) return;
    }

    // Check duplicate by activity name on same day/time
    const isDup = regularClubs.some(c => 
      (c.name === actName && c.dayStr === dayStr && (!timeStr || c.timeStr === timeStr))
    );
    if (isDup) return;

    const sEx = (window.supEx && (window.supEx[baseA] || window.supEx[s.a])) || {};
    const flexNote = s.flexNote || (sEx.flexSched ? (sEx.flexNote || 'הימים והשעות עלולים להשתנות') : '');

    regularClubs.push({
      name: actName,
      supName: cleanSupName !== actName ? cleanSupName : '',
      dayStr: dayStr,
      timeStr: timeStr,
      phone: phone,
      supplierId: s.a || '',
      flexNote: flexNote,
      tp: s.tp || ''
    });
  }

  // 1. Filter discontinued series from fixedSched that were replaced on the same day of the week
  const activeFixedSched = fixedSched.filter(s => {
    if (isMakeupEv(s)) return false;

    const dow = s.d ? new Date(s.d).getDay() : 0;
    const sameDowClubs = fixedSched.filter(o => o !== s && !isMakeupEv(o) && o.d && new Date(o.d).getDay() === dow);
    if (sameDowClubs.length > 0) {
      // Check if another club on this day has later occurrences in the month
      const hasLaterOnSameDay = sameDowClubs.some(o => o.d > s.d);

      // Check if this club has any future occurrences in SCH after this month
      const hasFutureAfterMonth = (window.SCH || []).some(ev => 
        Number(ev.g) === Number(g.id) && 
        ev.d > toDate && 
        (!ev.st || ev.st === 'ok') &&
        !isMakeupEv(ev) &&
        (s._recId ? ev._recId === s._recId : (window.supBase ? window.supBase(ev.a) === window.supBase(s.a) : ev.a === s.a))
      );

      // Check occurrences in this month
      const monthOccurrences = (gEvs || []).filter(ev => 
        (!ev.st || ev.st === 'ok') &&
        !isMakeupEv(ev) &&
        (s._recId ? ev._recId === s._recId : (window.supBase ? window.supBase(ev.a) === window.supBase(s.a) : ev.a === s.a))
      ).length;

      // If another club on this day has later occurrences in the month, and this club does not continue into future months (or only occurred once), it was replaced!
      if (hasLaterOnSameDay && (!hasFutureAfterMonth || monthOccurrences <= 1)) {
        return false;
      }
    }
    return true;
  });

  // Sort Sunday to Thursday
  activeFixedSched.sort((a, b) => {
    const da = a.d ? new Date(a.d).getDay() : 0;
    const db = b.d ? new Date(b.d).getDay() : 0;
    if (da !== db) return da - db;
    return (a.t || '').localeCompare(b.t || '');
  });

  // Add from activeFixedSched
  activeFixedSched.forEach(s => addClubToRegular(s));

  // 2. Also inspect gEvs for any additional active clubs in this month (up to 3)
  if (regularClubs.length < 3 && Array.isArray(gEvs)) {
    const validEvs = gEvs.filter(s => (!s.st || s.st === 'ok') && !isMakeupEv(s)).sort((a, b) => (b.d || '').localeCompare(a.d || ''));
    validEvs.forEach(s => {
      if (regularClubs.length < 3) {
        addClubToRegular(s);
      }
    });
  }

  // Limit to max 3 regular clubs for the UI cards
  const regularClubsList = regularClubs.slice(0, 3);
  
  // Garden metadata
  const ageLabel = typeof window.extractGardenAge === 'function' ? window.extractGardenAge(g) : (g.age || '3-4');
  const mgr = typeof window.gardenManager === 'function' ? window.gardenManager(g.id) : null;
  const mgrStr = mgr ? `${mgr.name}${mgr.phone ? ' · ' + mgr.phone : ''}` : '';

  // Build calendar weeks (Sun-Thu only)
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

  // Card colors (supports up to 3 cards)
  const CARD_COLORS = ['#1d4ed8', '#047857', '#7c3aed']; // Darker blue, green and purple
  const CARD_BG = ['#eff6ff', '#ecfdf5', '#f5f3ff'];
  const CARD_BORDER = ['#1e3a8a', '#064e3b', '#5b21b6'];

  // Build cards HTML
  let cardsHtml = '';
  if (regularClubsList.length > 0) {
    cardsHtml = `<div class="vp-cards-grid ${regularClubsList.length === 3 ? 'three' : ''}">`;
    regularClubsList.forEach((club, i) => {
      const color = CARD_COLORS[i] || CARD_COLORS[0];
      const bg = CARD_BG[i] || CARD_BG[0];
      const border = CARD_BORDER[i] || CARD_BORDER[0];
      cardsHtml += `
        <div class="vp-activity-card" style="border-right-color:${color}; background:${bg}; border-color:${border}; border-right-color:${color};">
          <div class="vp-card-badge" style="background:${color};">${club.tp === 'חוג פנימי' ? 'חוג פנימי' : 'חוג צהרון'}</div>
          <h3>${club.supName ? _esc(club.supName) + ' - ' : ''}${_esc(club.name)}</h3>
          <p>📅 ${_esc(club.dayStr)} &nbsp; 🕐 ${_esc(club.timeStr)}</p>
          ${club.flexNote ? `<p style="font-weight:700; color:#0369a1; font-size:11px; margin-top:2px;">ℹ️ ${_esc(club.flexNote)}</p>` : ''}
          ${showPhones && club.phone ? `<p style="font-weight:700; color:#1e293b; margin-top:3px; font-size:11.5px;" dir="ltr"><span dir="rtl">📞 </span>${_esc(club.phone)}</p>` : ''}
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
      
      // Determine events for this day:
      // Priority 1: Actual events scheduled for this specific date in gEvs
      let dayEvs = [];
      const actualEvs = (gEvs || []).filter(s => s.d === dateStr && (!s.st || s.st === 'ok'));
      if (actualEvs.length > 0) {
        dayEvs = actualEvs.sort((a,b) => (a.t||'').localeCompare(b.t||''));
      } else if ((!gEvs || gEvs.length === 0) && fixedSched.length > 0) {
        // Fallback ONLY when this month has no scheduled events at all: use recurring weekday template
        dayEvs = fixedSched.filter(fs => new Date(fs.d).getDay() === currentDow).sort((a,b) => (a.t||'').localeCompare(b.t||''));
      }

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

          const evBase = window.supBase ? window.supBase(ev.a) : ev.a;
          const isMakeup = isMakeupEv(ev);

          const clubIdx = regularClubsList.findIndex(rc => 
            (rc.supplierId && ev.a && (rc.supplierId === ev.a || (window.supBase && window.supBase(rc.supplierId) === evBase))) ||
            (rc.name === actName)
          );
          const isRegular = !isMakeup && clubIdx >= 0;

          // Check if one-time activity (not makeup, not in regular clubs, occurs <= 1 in month without future recurrence)
          const totalOccsInMonth = (gEvs || []).filter(e => (!e.st || e.st === 'ok') && !isMakeupEv(e) && (window.supBase ? window.supBase(e.a) === evBase : e.a === ev.a)).length;
          const hasFuture = (window.SCH || []).some(e => Number(e.g) === Number(g.id) && e.d > toDate && (!e.st || e.st === 'ok') && !isMakeupEv(e) && (window.supBase ? window.supBase(e.a) === evBase : e.a === ev.a));
          const isOneTime = !isMakeup && !isRegular && totalOccsInMonth <= 1 && !hasFuture && !ev._recId;

          let pillColor = isRegular ? CARD_BORDER[clubIdx] : '#312e81';
          let pillBg = isRegular ? CARD_BG[clubIdx] : '#eef2ff';

          let badgeHtml = '';
          if (isMakeup) {
            pillColor = '#92400e';
            pillBg = '#fef3c7';
            badgeHtml = `<div style="margin-bottom:2px;"><span style="background:#fffbeb; color:#b45309; border:1px solid #f59e0b; padding:1px 5px; border-radius:4px; font-size:9.5px; font-weight:800; display:inline-block;">🔄 השלמה</span></div>`;
          } else if (isOneTime) {
            pillColor = '#6b21a8';
            pillBg = '#f5f3ff';
            badgeHtml = `<div style="margin-bottom:2px;"><span style="background:#ede9fe; color:#6b21a8; border:1px solid #c084fc; padding:1px 5px; border-radius:4px; font-size:9.5px; font-weight:800; display:inline-block;">⭐ חד-פעמי</span></div>`;
          }

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
            if (!supPhone && ev.p && String(ev.p).trim()) {
              supPhone = String(ev.p).trim();
            }
            if (!supPhone) {
              const ex = (window.supEx && (window.supEx[evBase] || window.supEx[ev.a])) || {};
              supPhone = ex.ph1 || ex.ph2 || '';
            }
            if (!supPhone && Array.isArray(window.SUPBASE)) {
              const sb = window.SUPBASE.find(x => x.name === ev.a || (window.supBase && window.supBase(x.name) === evBase));
              if (sb && sb.phone) supPhone = sb.phone;
            }
          }
          
          let pillText = `${badgeHtml}${ev.t ? '(' + ev.t + ') ' : ''}${cleanSupName && cleanSupName !== actName ? _esc(cleanSupName) + ' - ' : ''}${_esc(actName)}`;
          const evEx = (window.supEx && (window.supEx[evBase] || window.supEx[ev.a])) || {};
          const evFlexNote = ev.flexNote || (evEx.flexSched ? (evEx.flexNote || 'הימים והשעות עלולים להשתנות') : '');
          if (evFlexNote) {
              pillText += `<br><span style="font-size:9px; font-weight:700; color:#0369a1;">ℹ️ ${_esc(evFlexNote)}</span>`;
          }
          if (showPhones && supPhone) {
              pillText += `<br><span style="font-size:9.5px; font-weight:700;" dir="ltr"><span dir="rtl">📞 </span>${_esc(supPhone)}</span>`;
          }

          cellContent += `<div class="vp-event-pill" style="background:${pillBg}; color:${pillColor}; border:1px solid ${pillColor}33;">${pillText}</div>`;
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
          ${(() => {
            if (!mgrStr) return '';
            const isSchool = (typeof window.gcls === 'function' ? window.gcls(g) === 'ביה"ס' : false) || (g.name || '').includes('ביה"ס') || (g.cls || '').includes('ביה"ס');
            const coordLabel = isSchool ? 'רכז/ת ביה"ס' : 'רכז/ת';
            return `👩‍💼 ${coordLabel}: ${_esc(mgrStr)}`;
          })()}
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

async function _exportJPG(gList, allEvs, year, month, monthName, hebYearStr, showPhones) {
  // Ensure html2canvas is ready
  let h2c = window.html2canvas;
  if (!h2c) {
    if (window.html2pdf && typeof window.html2pdf === 'function') {
      try { h2c = window.html2pdf().html2canvas; } catch (e) {}
    }
  }
  if (!h2c) {
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = () => { h2c = window.html2canvas; resolve(); };
        s.onerror = reject;
        document.head.appendChild(s);
      });
    } catch (e) {
      window.spAlert('שגיאה בטעינת ספריית יצירת תמונות: ' + e.message);
      return;
    }
  }

  // Ensure JSZip is ready for multiple files
  if (gList.length > 1 && !window.JSZip) {
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    } catch (e) { console.warn('Could not load JSZip:', e); }
  }

  // Progress overlay
  let overlay = document.getElementById('jpg-export-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'jpg-export-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.75);backdrop-filter:blur(3px);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:Assistant,sans-serif;direction:rtl;';
    overlay.innerHTML = `
      <div style="background:#fff; color:#1e293b; padding:24px 32px; border-radius:14px; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.3); max-width:420px; width:90%;">
        <div style="font-size:2.5rem; margin-bottom:10px;">🖼️</div>
        <div style="font-weight:800; font-size:1.15rem; color:#be185d; margin-bottom:6px;">מייצר תמונות JPG איכותיות (פוסטרים)</div>
        <div id="jpg-export-status" style="font-size:0.88rem; color:#64748b;">מתחיל בעיבוד...</div>
        <div style="margin-top:14px; width:100%; height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;">
          <div id="jpg-export-bar" style="width:0%; height:100%; background:#be185d; transition:width 0.2s;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
  const statusEl = document.getElementById('jpg-export-status');
  const barEl = document.getElementById('jpg-export-bar');

  // Adhere strictly to AGENTS.md PDF/canvas generation rules
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute; top:-99999px; left:-99999px; width:850px; background:#fff; direction:rtl; font-family:Arial, sans-serif;';
  document.body.appendChild(container);

  const styles = _getStyles(month);
  const images = [];

  try {
    for (let i = 0; i < gList.length; i++) {
      const g = gList[i];
      if (statusEl) statusEl.textContent = `מעבד: ${g.name || 'גן'} (${i + 1} מתוך ${gList.length})...`;
      if (barEl) barEl.style.width = `${Math.round(((i + 1) / gList.length) * 100)}%`;

      const gEvs = allEvs.filter(s => Number(s.g) === Number(g.id) || String(s.g) === String(g.id));
      const pageHtml = _buildGardenPage(g, gEvs, year, month, monthName, hebYearStr, showPhones);

      container.innerHTML = styles.css + pageHtml;

      // Small pause for layout
      await new Promise(r => setTimeout(r, 60));

      const pageEl = container.querySelector('.vp-page') || container;

      // Reset scroll position as mandated by AGENTS.md
      const prevScrollY = window.scrollY;
      const prevScrollX = window.scrollX;
      window.scrollTo(0, 0);

      const canvas = await h2c(pageEl, {
        scale: 2,
        useCORS: true,
        logging: false
      });

      window.scrollTo(prevScrollX, prevScrollY);

      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.95));

      const safeGarden = String(g.name || 'גן').replace(/[/\\?%*:|"<>]/g, '_').trim();
      const safeCity = String(g.city || '').replace(/[/\\?%*:|"<>]/g, '_').trim();
      const fileName = `לוח חוגים - ${safeGarden} ${safeCity} - ${monthName} ${year}.jpg`.replace(/\s+/g, ' ');

      images.push({ blob, fileName });
    }

    if (images.length === 1) {
      const img = images[0];
      const url = URL.createObjectURL(img.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = img.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.showToast?.(`✅ תמונת JPG הורדה בהצלחה: ${img.fileName}`);
    } else if (images.length > 1) {
      if (window.JSZip) {
        if (statusEl) statusEl.textContent = 'אורז קובץ ZIP עם כל התמונות...';
        const zip = new window.JSZip();
        images.forEach(img => {
          zip.file(img.fileName, img.blob);
        });
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipUrl = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = zipUrl;
        a.download = `לוחות חוגים מעוצבים JPG - ${monthName} ${year}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(zipUrl);
        window.showToast?.(`✅ קובץ ZIP הורד בהצלחה עם ${images.length} תמונות JPG!`);
      } else {
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          const url = URL.createObjectURL(img.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = img.fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          await new Promise(r => setTimeout(r, 350));
        }
        window.showToast?.(`✅ הורדו ${images.length} תמונות JPG!`);
      }
    }

  } catch (err) {
    console.error('[VisualExcel] Error exporting JPG:', err);
    window.spAlert('שגיאה ביצירת קובץ JPG: ' + err.message);
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container);
    if (overlay) overlay.style.display = 'none';
  }
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
    .vp-cards-grid.three {
      gap: 8px;
    }
    .vp-cards-grid.three .vp-activity-card {
      padding: 6px 9px;
    }
    .vp-cards-grid.three .vp-activity-card h3 {
      font-size: 13.5px;
      margin: 1px 0 3px;
    }
    .vp-cards-grid.three .vp-activity-card p {
      font-size: 11px;
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
