// visual_excel.js - מחולל אקסל מעוצב ללוח חוגים חודשי

window.doVisualExcelExport = async function() {
  if (typeof window.ExcelJS === 'undefined') {
    try { await window.ensureExcelJSLoaded(); } catch(e) {}
  }
  if (typeof window.ExcelJS === 'undefined') {
    window.spAlert("ספריית האקסל לא נטענה.");
    return;
  }

  const mp = document.getElementById('exp-from-m');
  if (!mp || !mp.value) { window.spAlert('אנא בחר חודש'); return; }
  const fromM = mp.value;
  const [year, month] = fromM.split('-').map(Number);
  
  const fromDate = `${year}-${String(month).padStart(2,'0')}-01`;
  const toDate = `${year}-${String(month).padStart(2,'0')}-${String(new Date(year, month, 0).getDate()).padStart(2,'0')}`;
  
  // Filter Gardens based on current UI selection
  let gList = [];
  const cm = document.getElementById('city-multi');
  const gm = document.getElementById('garden-multi');
  if (!cm || !gm) return;
  
  const selC = Array.from(cm.selectedOptions).map(o=>o.value);
  const selG = Array.from(gm.selectedOptions).map(o=>Number(o.value));
  
  if (selG.includes(0) && selC.includes('all')) {
    gList = window.GARDENS.filter(g => g.active!==false);
  } else if (selG.includes(0)) {
    gList = window.GARDENS.filter(g => selC.includes(g.city) && g.active!==false);
  } else {
    gList = window.GARDENS.filter(g => selG.includes(g.id) && g.active!==false);
  }
  
  if (gList.length === 0) { window.spAlert("לא נבחרו גנים לייצוא"); return; }
  
  const allEvs = window.SCH.filter(s => s.d >= fromDate && s.d <= toDate);
  const showPhones = document.getElementById('exp-phones') ? document.getElementById('exp-phones').checked : true;
  const splitMode = document.getElementById('exp-split').value; // 'city', 'city_single', 'garden'
  
  const HEB_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const monthName = HEB_MONTHS[month - 1];

  let filesExported = 0;

  // Build the Workbooks based on splitMode
  try {
    if (splitMode === 'garden') {
      for (const g of gList) {
        const gEvs = allEvs.filter(s => s.g === g.id);
        if (!gEvs.length) continue;
        const wb = new window.ExcelJS.Workbook();
        _buildVisualSheet(wb, g.name.replace(/[*?:\[\]\/\\]/g,'').slice(0,31) || 'גן', [g], allEvs, year, month, monthName, showPhones);
        const safeName = g.name.replace(/[^\u0590-\u05FF\w\-_.]/gu, '_');
        await _saveExcel(wb, `לוח_מעוצב_${safeName}_${fromM}.xlsx`);
        filesExported++;
      }
    } else {
      const byCity = gList.reduce((acc, g) => { (acc[g.city||''] = acc[g.city||'']||[]).push(g); return acc; }, {});
      for (const [city, gardens] of Object.entries(byCity)) {
        const cityGardens = gardens.filter(g => allEvs.some(s => s.g === g.id));
        if (!cityGardens.length) continue;
        
        const wb = new window.ExcelJS.Workbook();
        if (splitMode === 'city_single') {
          // All gardens in one sheet
          _buildVisualSheet(wb, (city || 'כל הגנים').replace(/[*?:\[\]\/\\]/g,'').slice(0,31), cityGardens, allEvs, year, month, monthName, showPhones);
        } else {
          // One sheet per garden
          cityGardens.sort((a,b) => (a.name||'').localeCompare(b.name||'','he'));
          for (const g of cityGardens) {
            const sheetName = (g.name || `גן${g.id}`).replace(/[*?:\[\]\/\\]/g,'').slice(0,31);
            _buildVisualSheet(wb, sheetName, [g], allEvs, year, month, monthName, showPhones);
          }
        }
        const safeCity = (city || 'כל_העיר').replace(/[^\u0590-\u05FF\w\-_.]/gu, '_');
        await _saveExcel(wb, `לוח_מעוצב_${safeCity}_${fromM}.xlsx`);
        filesExported++;
      }
    }
    
    window.CM('export-m'); // close modal
    if(filesExported > 0) window.showToast(`📊 ${filesExported} קבצי אקסל מעוצבים נוצרו בהצלחה!`);
    else window.spAlert('⚠️ לא נמצאו פעילויות בטווח התאריכים שנבחר לגנים המבוקשים.');
    
  } catch(e) {
    console.error('Visual Excel error:', e);
    window.spAlert('שגיאה ביצירת אקסל מעוצב: ' + e.message);
  }
};

function _buildVisualSheet(wb, sheetName, gardens, allEvs, year, month, monthName, showPhones) {
  const ws = wb.addWorksheet(sheetName, {
    views: [{ rightToLeft: true, showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4 }
    }
  });

  // 5 columns (Sun-Thu)
  for (let c=1; c<=5; c++) {
    ws.getColumn(c).width = 20;
  }

  const FONT_HEADING = { name: 'Arial', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  const FONT_SUB = { name: 'Arial', size: 10, color: { argb: 'FFE0E7FF' } };
  const FONT_TITLE = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  const FONT_REGULAR = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
  const FONT_BOLD = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
  const FONT_NOTE = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } };

  const FILL_PRIMARY = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
  const FILL_CARD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
  const FILL_EVENT = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
  const FILL_VACATION = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  const FILL_DAY_HEAD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  const FILL_EMPTY_DAY = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

  const BORDER_THIN = { style: 'thin', color: { argb: 'FFCBD5E1' } };
  const BOX_BORDER = { left: BORDER_THIN, right: BORDER_THIN, top: BORDER_THIN, bottom: BORDER_THIN };

  let r = 1;

  gardens.forEach((g, idx) => {
    if (idx > 0) {
      ws.addRow([]); // Spacer between gardens if stacked
      ws.getRow(r).height = 40;
      r++;
    }

    const gEvs = allEvs.filter(e => e.g === g.id);
    const clubsMap = new Map();
    
    gEvs.forEach(ev => {
      // skip holidays
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

    const regularClubs = clubs.filter(c => c.events.length >= 2).slice(0, 2); // Max 2 cards

    // Row 1 & 2: Header
    ws.getRow(r).height = 28;
    ws.getRow(r+1).height = 20;
    ws.mergeCells(`A${r}:E${r}`);
    ws.mergeCells(`A${r+1}:E${r+1}`);

    const cellH1 = ws.getCell(`A${r}`);
    cellH1.value = `Kids טומשין • לוח חוגים חודשי - ${g.name || ''}`;
    cellH1.font = FONT_HEADING;
    cellH1.fill = FILL_PRIMARY;
    cellH1.alignment = { horizontal: 'center', vertical: 'middle' };

    const cellH2 = ws.getCell(`A${r+1}`);
    const ageLabel = typeof window.extractGardenAge === 'function' ? window.extractGardenAge(g) : (g.age || '3-4');
    const mgr = typeof window.gardenManager === 'function' ? window.gardenManager(g.id) : null;
    const mgrStr = mgr ? `${mgr.name} ${mgr.phone||''}` : '';
    
    cellH2.value = `חודש: ${monthName} ${year} | גילאים: ${ageLabel} | עיר: ${g.city || ''} ${mgrStr ? '| רכז/ת: '+mgrStr : ''}`;
    cellH2.font = FONT_SUB;
    cellH2.fill = FILL_PRIMARY;
    cellH2.alignment = { horizontal: 'center', vertical: 'middle' };

    r += 2;
    ws.getRow(r).height = 8; // Spacer
    r++;

    // Row 4-6: Cards (only if there are regular clubs)
    if (regularClubs.length > 0) {
      ws.getRow(r).height = 22;
      ws.getRow(r+1).height = 18;
      ws.getRow(r+2).height = 18;

      const c1 = regularClubs[0];
      ws.mergeCells(`A${r}:B${r}`); ws.mergeCells(`A${r+1}:B${r+1}`); ws.mergeCells(`A${r+2}:B${r+2}`);
      ws.getCell(`A${r}`).value = ` חוג 1: ${c1.name}`; ws.getCell(`A${r}`).font = FONT_TITLE;
      ws.getCell(`A${r+1}`).value = `${c1.dayStr} בשעה ${c1.timeStr}`; ws.getCell(`A${r+1}`).font = FONT_REGULAR;
      ws.getCell(`A${r+2}`).value = showPhones ? `מפעיל/טלפון: ${c1.phone}` : ''; ws.getCell(`A${r+2}`).font = FONT_REGULAR;

      if (regularClubs.length > 1) {
        const c2 = regularClubs[1];
        ws.mergeCells(`D${r}:E${r}`); ws.mergeCells(`D${r+1}:E${r+1}`); ws.mergeCells(`D${r+2}:E${r+2}`);
        ws.getCell(`D${r}`).value = ` חוג 2: ${c2.name}`; ws.getCell(`D${r}`).font = FONT_TITLE;
        ws.getCell(`D${r+1}`).value = `${c2.dayStr} בשעה ${c2.timeStr}`; ws.getCell(`D${r+1}`).font = FONT_REGULAR;
        ws.getCell(`D${r+2}`).value = showPhones ? `מפעיל/טלפון: ${c2.phone}` : ''; ws.getCell(`D${r+2}`).font = FONT_REGULAR;
      }

      for (let rx = r; rx <= r+2; rx++) {
        [1,2,4,5].forEach(cx => {
          const cCell = ws.getCell(rx, cx);
          cCell.fill = FILL_CARD;
          cCell.border = BOX_BORDER;
          cCell.alignment = { horizontal: 'right', vertical: 'middle' };
        });
      }
      r += 3;
    }
    
    ws.getRow(r).height = 8; // Spacer
    r++;

    // Calendar Header
    ws.getRow(r).height = 24;
    const daysLabels = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי"];
    daysLabels.forEach((dl, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.value = dl;
      cell.font = FONT_BOLD;
      cell.fill = FILL_DAY_HEAD;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = BOX_BORDER;
    });
    r++;

    // Calendar Grid
    const daysInMonth = new Date(year, month, 0).getDate();
    const weeks = [];
    let curWeek = [null,null,null,null,null];
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month - 1, d).getDay();
      if (dow >= 0 && dow <= 4) {
        curWeek[dow] = d;
      }
      if (dow === 4 || d === daysInMonth) {
        if (curWeek.some(x => x !== null)) weeks.push([...curWeek]);
        curWeek = [null,null,null,null,null];
      }
    }

    weeks.forEach(week => {
      ws.getRow(r).height = 18;
      ws.getRow(r+1).height = 42;

      week.forEach((dayNum, idx) => {
        const c1 = ws.getCell(r, idx + 1);
        const c2 = ws.getCell(r + 1, idx + 1);
        c1.border = BOX_BORDER; c2.border = BOX_BORDER;

        if (dayNum) {
          c1.value = `${dayNum}/${month}`;
          c1.font = FONT_BOLD;
          c1.alignment = { horizontal: 'left', vertical: 'middle' };

          const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
          
          const hol = typeof window.getHolidayInfo === 'function' ? window.getHolidayInfo(dateStr, g.city, typeof window.getGardenClass === 'function' ? window.getGardenClass(g) : g.cls) : null;
          const isCamp = hol && (hol.type === 'camp' || hol.label === 'קייטנה' || hol.canSched);
          const isHoliday = hol && !isCamp;

          const dayEvs = gEvs.filter(e => e.d === dateStr);
          // Sort events by time
          dayEvs.sort((a,b)=>(a.t||'').localeCompare(b.t||''));

          if (isHoliday) {
            c2.value = hol.name || hol.label;
            c2.fill = FILL_VACATION;
            c2.font = FONT_REGULAR;
            c2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          } else if (dayEvs.length > 0) {
            let cellText = [];
            dayEvs.forEach(ev => {
              let actName = ev.act;
              if (!actName && typeof window.supAct === 'function') actName = window.supAct(ev.a);
              if (!actName) actName = 'פעילות';
              cellText.push(`${ev.t||''} ${actName}`);
            });
            c2.value = cellText.join('\n');
            c2.fill = FILL_EVENT;
            c2.font = FONT_BOLD;
            c2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          } else {
            c2.value = "צהרון רגיל";
            c2.fill = FILL_EMPTY_DAY;
            c2.font = FONT_NOTE;
            c2.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        } else {
          c1.fill = FILL_EMPTY_DAY;
          c2.fill = FILL_EMPTY_DAY;
        }
      });
      r += 2;
    });

    const oneOffClubs = clubs.filter(c => !regularClubs.includes(c));
    if (oneOffClubs.length > 0) {
      ws.getRow(r).height = 8; r++; // Spacer
      
      ws.getRow(r).height = 20;
      ws.mergeCells(`A${r}:E${r}`);
      const oHeader = ws.getCell(`A${r}`);
      oHeader.value = "פעילויות מיוחדות / קייטנות";
      oHeader.font = FONT_TITLE;
      oHeader.fill = FILL_DAY_HEAD;
      oHeader.alignment = { horizontal: 'right', vertical: 'middle' };
      r++;

      oneOffClubs.forEach(c => {
         ws.getRow(r).height = 18;
         ws.mergeCells(`A${r}:E${r}`);
         const oCell = ws.getCell(`A${r}`);
         const datesStr = c.events.map(e => {
            const dp = e.d.split('-');
            return `${dp[2]}/${dp[1]}`;
         }).join(', ');
         
         oCell.value = `• ${c.name} | תאריכים: ${datesStr} | שעה: ${c.timeStr}${showPhones && c.phone ? ' | טלפון: '+c.phone : ''}`;
         oCell.font = FONT_REGULAR;
         oCell.alignment = { horizontal: 'right', vertical: 'middle' };
         r++;
      });
    }

    // Footer note
    ws.getRow(r).height = 8; r++; // Spacer
    ws.getRow(r).height = 20;
    ws.mergeCells(`A${r}:E${r}`);
    const noteCell = ws.getCell(`A${r}`);
    noteCell.value = "* שימו לב: ייתכנו שינויים בתוכנית החוגים. הלוח מיועד להורים וילדי הצהרון.";
    noteCell.font = FONT_NOTE;
    noteCell.alignment = { horizontal: 'center', vertical: 'middle' };
    r++;
  });
}

async function _saveExcel(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  let finalBlob;
  try {
    const JZ = window._SafeJSZip;
    if (JZ) {
      const zip = await JZ.loadAsync(buffer);
      const sheetKeys = Object.keys(zip.files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
      for (const sk of sheetKeys) {
        let xml = await zip.files[sk].async('text');
        xml = xml.replace(/<sheetView\b([^>]*?)(\/?>)/g, (m, attrs, close) => {
          const a2 = attrs.includes('view=') ? attrs.replace(/view="[^"]*"/, 'view="pageLayout"') : attrs + ' view="pageLayout"';
          return `<sheetView${a2}${close}`;
        });
        zip.file(sk, xml);
      }
      const patched = await zip.generateAsync({ type:'arraybuffer', compression:'STORE' });
      finalBlob = new Blob([patched], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    } else {
      finalBlob = new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    }
  } catch(e) {
    console.warn('pageLayout patch failed', e);
    finalBlob = new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }

  const a = document.createElement('a');
  a.href = URL.createObjectURL(finalBlob);
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 1000);
}
