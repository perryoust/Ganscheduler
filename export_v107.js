function openMonthlyExport(){
  const now=new Date();
  const y=now.getFullYear(), m=String(now.getMonth()+1).padStart(2,'0');
  document.getElementById('exp-from').value=`${y}-${m}`;
  document.getElementById('exp-to').value=`${y}-${m}`;
  // Cities
  const citySel=document.getElementById('exp-city');
  citySel.innerHTML='<option value="">-- כל הערים --</option>';
  window.cities().forEach(c=>{ const o=document.createElement('option');o.value=c;o.textContent=c;citySel.appendChild(o); });
  // Managers
  const mgrSel=document.getElementById('exp-mgr');
  mgrSel.innerHTML='<option value="">-- כל הרכזים --</option>';
  Object.values(window.managers).forEach(mg=>{ const o=document.createElement('option');o.value=mg.id;o.textContent=mg.name;mgrSel.appendChild(o); });
  // Gardens
  const ganSel=document.getElementById('exp-garden');
  ganSel.innerHTML='<option value="">-- בחר צהרון --</option>';
  const rawGans = typeof AG === 'function' ? AG() : [...(window.GARDENS||[]), ...(window._GARDENS_EXTRA||[])];
  const map = new Map();
  rawGans.forEach(g => map.set(g.id, g));
  const allGans = Array.from(map.values()).sort((a,b)=>(a.city||'').localeCompare(b.city||'','he')||(a.name||'').localeCompare(b.name||'','he'));
  allGans.forEach(g=>{ const o=document.createElement('option');o.value=g.id;o.textContent=`${g.name} (${g.city})`;ganSel.appendChild(o); });
  document.getElementById('export-m').classList.add('open');
}

function expModeChg(){
  const mode=document.querySelector('input[name="exp-mode"]:checked').value;
  document.getElementById('exp-city-wrap').style.display=mode==='city'?'block':'none';
  document.getElementById('exp-mgr-wrap').style.display=mode==='manager'?'block':'none';
  document.getElementById('exp-garden-wrap').style.display=mode==='garden'?'block':'none';
}

// Helper: find manager assigned to a garden
function gardenManager(gardenId){
  return Object.values(window.managers).find(m=>(m.gardenIds||[]).includes(gardenId))||null;
}

async function doMonthlyExport(){
  if (window.loadFromFirebase) {
    window.showToast('מסנכרן נתונים אחרונים מול השרת...', 3000);
    await window.loadFromFirebase(true);
  }
  const fromM=document.getElementById('exp-from').value;
  const toM=document.getElementById('exp-to').value;
  if(!fromM||!toM){window.spAlert('יש לבחור תקופה');return;}
  const mode=document.querySelector('input[name="exp-mode"]:checked').value;
  const cityFilter=document.getElementById('exp-city').value;
  const mgrFilter=document.getElementById('exp-mgr').value;
  const gardenFilter=parseInt(document.getElementById('exp-garden').value)||0;
  const splitBy=document.getElementById('exp-split').value;

  const [fy,fm]=fromM.split('-').map(Number);
  const [ty,tm]=toM.split('-').map(Number);
  const fromDate=`${fy}-${String(fm).padStart(2,'0')}-01`;
  const toDate=window.d2s(new Date(ty,tm,0));
  let evs=window.SCH.filter(s=>s.d>=fromDate&&s.d<=toDate); // include cancelled for export
  const rawList = typeof AG === 'function' ? AG() : [...(window.GARDENS||[]), ...(window._GARDENS_EXTRA||[])];
  const gMap = new Map();
  rawList.forEach(g => gMap.set(Number(g.id), g));
  let gList = Array.from(gMap.values());
  if(mode==='city'&&cityFilter)   gList=gList.filter(g=>g.city===cityFilter);
  if(mode==='manager'&&mgrFilter){ const mgrObj=window.managers[mgrFilter]; if(mgrObj?.gardenIds) gList=gList.filter(g=>mgrObj.gardenIds.includes(g.id)); }
  if(mode==='garden'){ if(!gardenFilter){ window.spAlert('יש לבחור צהרון מהרשימה'); return; } gList=gList.filter(g=>g.id===gardenFilter); }

  // For single-garden mode: always export as one file
  const effectiveSplit = (mode==='garden') ? 'garden' : splitBy;

  const byCity={};
  gList.forEach(g=>{ if(!byCity[g.city]) byCity[g.city]=[]; byCity[g.city].push(g); });

  let filesExported=0;
  if(effectiveSplit==='garden'){
    gList.forEach(g=>{
      const gEvs=evs.filter(s=>s.g===g.id);
      if(!gEvs.length){ if(mode==='garden') window.spAlert(`אין פעילויות לגן "${g.name}" בתקופה שנבחרה`); return; }
      downloadWB(buildGardenWB(g, gEvs, fromDate, toDate), `לוח_חוגים_${g.name}_${fromM}.xlsx`, fromM);
      filesExported++;
    });
  } else {
    Object.entries(byCity).forEach(([city,gardens])=>{
      const cityGardens=gardens.filter(g=>evs.some(s=>s.g===g.id));
      if(!cityGardens.length) return;
      const singleSheet = (effectiveSplit === 'city_single');
      downloadWB(buildCityWB(city, cityGardens, evs, fromDate, toDate), `לוח_חוגים_${city}_${fromM}.xlsx`, fromM, singleSheet);
      filesExported++;
    });
  }
  window.CM('export-m');
  if(filesExported>0) window.showToast(`📊 ${filesExported} קבצי Excel נוצרו בהצלחה!`);
  else if(mode!=='garden') window.spAlert('⚠️ לא נמצאו פעילויות בטווח התאריכים שנבחר.');
}

function buildCityWB(city, gardens, allEvs, fromDate, toDate){
  // Build workbook with one sheet per garden
  const wb={sheets:[], city};
  gardens.forEach(g=>{
    const gEvs=allEvs.filter(s=>s.g===g.id);
    wb.sheets.push({garden:g, evs:gEvs});
  });
  return wb;
}

function buildGardenWB(garden, evs, fromDate, toDate){
  return {sheets:[{garden, evs}], city:garden.city};
}

async function downloadWB(wb, filename, fromM, singleSheet = false) {
  const safeFile = filename.replace(/[^\u0590-\u05FF\w\-_.]/gu, '_');
  const gardens = wb.sheets.map(s => s.garden);
  const allEvs  = wb.sheets.reduce((acc, s) => acc.concat(s.evs), []);
  if (!gardens.length) return;
  // Prefer explicit fromM param; fallback to first event date
  let fy, fm;
  if (fromM) {
    [fy, fm] = fromM.split('-').map(Number);
  } else {
    const firstDs = allEvs.length ? [...allEvs].sort((a,b)=>a.d.localeCompare(b.d))[0].d : window.d2s(new Date());
    [fy, fm] = firstDs.split('-').map(Number);
  }

  // Try ExcelJS first (supports images + RTL)
  try { await window.ensureExcelJSLoaded(); } catch(e) {}
  if (typeof window.ExcelJS !== 'undefined' && !window._excelJSFailed) {
    console.log('📊 Using ExcelJS for export:', safeFile, 'year:', fy, 'month:', fm);
    _downloadWBExcelJS(gardens, allEvs, fy, fm - 1, safeFile, singleSheet);
    return;
  }
  // Fallback: SheetJS (no images)
  if (typeof window.XLSX !== 'undefined') {
    try {
      console.log('📊 Using SheetJS fallback for export');
      const workbook = window.XLSX.utils.book_new();
      const ws = buildStyledSheet(gardens, allEvs, fy, fm - 1);
      window.XLSX.utils.book_append_sheet(workbook, ws, 'לוח חוגים');
      window.XLSX.writeFile(workbook, safeFile);
      return;
    } catch(e) {
      console.error('XLSX error:', e);
    }
  }
  // Last resort: CSV
  console.warn('📊 No Excel library found, falling back to CSV');
  _csvFallback(wb, safeFile);
}

async function _downloadWBExcelJS(gardens, allEvs, year, month, filename) {
  try {
    const workbook = new window.ExcelJS.Workbook();

    const HEB_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
    const HEB_DAYS   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
    function hebYear(y, m) {
      const base = y + 3760 + (m >= 8 ? 1 : 0);
      let n = base % 1000, s = '';
      const L = {400:'ת',300:'ש',200:'ר',100:'ק',90:'צ',80:'פ',70:'ע',60:'ס',50:'נ',40:'מ',30:'ל',20:'כ',10:'י',9:'ט',8:'ח',7:'ז',6:'ו',5:'ה',4:'ד',3:'ג',2:'ב',1:'א'};
      for (const v of [400,300,200,100,90,80,70,60,50,40,30,20,10,9,8,7,6,5,4,3,2,1])
        while(n>=v){s+=L[v];n-=v;}
      return s.length===1 ? s+"'" : s.slice(0,-1)+'"'+s.slice(-1);
    }
    const monthTitle  = `${HEB_MONTHS[month]} ${year} ${hebYear(year, month)}`;
    const daysInMonth = new Date(year, month+1, 0).getDate();

    const CLR = {
      BLUE:   'FFB8CCE4', RED:  'FFFF0000',
      YELLOW: 'FFFFC7CE', GOLD: 'FFFF9999', PINK: 'FFE6B8B7',
    };

    let logoImgId = null;
    if (typeof window.LOGO_B64 !== 'undefined' && window.LOGO_B64)
      logoImgId = workbook.addImage({ base64: window.LOGO_B64, extension: 'png' });

    function applyStyle(cell, {fill, sz, bold, align, valign, bt, bb, bl, br}={}) {
      if (fill) cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:fill} };
      cell.font      = { name:'Arial', size:sz||11, bold:bold!==false };
      cell.alignment = { horizontal:align||'center', vertical:valign||'middle', readingOrder:'rightToLeft', wrapText:false };
      const brd = {};
      if (bt) brd.top    = {style:bt};
      if (bb) brd.bottom = {style:bb};
      if (bl) brd.left   = {style:bl};
      if (br) brd.right  = {style:br};
      if (Object.keys(brd).length) cell.border = brd;
    }
    function styleDataRow(row, fill, fillABC) {
      // fillABC: override for cols A,B,C (name/age/date) — always BLUE unless Fri/Sat
      const colABCfill = fillABC !== undefined ? fillABC : (fill===CLR.RED ? CLR.RED : CLR.BLUE);
      for (let i=1; i<=9; i++) {
        const cellFill = i<=3 ? colABCfill : fill;
        applyStyle(row.getCell(i), {
          fill:cellFill, sz:(i===6||i===7)?10:11, align:i===1?'right':'center',
          bt:'thin', bb:'thin', bl:i===1?'medium':'thin', br:i===9?'medium':'thin'
        });
      }
    }

    function setupWorksheet(ws, title) {
      ws.views = [{ state:'pageLayout', rightToLeft:true, showGridLines:true }];
      ws.pageSetup = {
        paperSize: 9, orientation: 'portrait',
        fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        horizontalCentered: true,
        margins: { left:0.08, right:0.20, top:0.55, bottom:0.20, header:0.31, footer:0.20 }
      };
      ws.columns = [
        {width:14.4},{width:3.6},{width:8.75},{width:9.25},
        {width:8.9},{width:24.6},{width:12.4},{width:4.25},{width:6.1}
      ];
      const headerRight = `&"Arial,Bold"&18${title}`;
      ws.headerFooter.differentOddEven = false;
      ws.headerFooter.oddHeader  = `&R${headerRight}`;
      ws.headerFooter.evenHeader = `&R${headerRight}`;
    }

    function _appendGardenToSheet(ws, r, garden, allEvs, year, month, daysInMonth, HEB_DAYS, CLR, applyStyle, styleDataRow) {
      const mgr = typeof window.managers !== 'undefined'
        ? Object.values(window.managers).find(m => (m.gardenIds||[]).includes(garden.id))
        : null;
      const mgrText = mgr
        ? `שם הרכז: ${mgr.name}${mgr.phone ? ' · ' + mgr.phone : ''}`
        : 'שם הרכז בגן: _______________';

      const gardenEvs = allEvs.filter(s => {
        const [ey,em] = s.d.split('-').map(Number);
        return s.g===garden.id && ey===year && em===month+1;
      });
      const byDate = {};
      gardenEvs.forEach(s => { if(!byDate[s.d]) byDate[s.d]=[]; byDate[s.d].push(s); });

      // ── Row 1: blank spacer ───────────────────────────────
      { const row=ws.addRow([]); row.height=8; r++; }

      // ── Row 2: לוח חוגים title (font 14) ──────────────────
      {
        const row = ws.addRow(['לוח חוגים','','','','','','','','']);
        row.height = 20;
        applyStyle(row.getCell(1), {sz:14, bold:true, align:'center', valign:'middle'});
        for (let c=2;c<=9;c++) {
          row.getCell(c).font={name:'Arial',size:14,bold:true};
          row.getCell(c).alignment={horizontal:'center',vertical:'middle',readingOrder:'rightToLeft'};
        }
        ws.mergeCells(r+1,1,r+1,9);
        r++;
      }

      // ── Row 3: blank spacer ───────────────────────────────
      { const row=ws.addRow([]); row.height=8; r++; }

      // ── Row 4: Garden name + City ─────────────────────────
      {
        const row = ws.addRow([`צהרון: ${garden.name}`,'','','','',`עיר: ${garden.city}`,'','','']);
        row.height = 18;
        [1,2,3,4,5].forEach(c => {
          const cell = row.getCell(c);
          applyStyle(cell, {sz:14,bold:true,align:'center',valign:'middle'});
          cell.alignment = {horizontal:'center',vertical:'middle',readingOrder:'rightToLeft'};
        });
        [6,7,8,9].forEach(c => {
          const cell = row.getCell(c);
          applyStyle(cell, {sz:14,bold:true,align:'center',valign:'middle'});
          cell.alignment = {horizontal:'center',vertical:'middle',readingOrder:'rightToLeft'};
        });
        ws.mergeCells(r+1,1,r+1,5);
        ws.mergeCells(r+1,6,r+1,9);
        r++;
      }

      // ── Column headers ────────────────────────────────────
      {
        const hdrs = ['שם הצהרון','גיל','תאריך','יום','סוג','שם החוג','טלפון',"קב'",'שעה'];
        const row  = ws.addRow(hdrs);
        row.height = 18.6;
        hdrs.forEach((_, i) => {
          applyStyle(row.getCell(i+1), {
            sz:(i===5||i===6)?10:11, bold:true,
            align:i===0?'right':'center', valign:'top',
            bt:'medium', bb:'thin', bl:i===0?'medium':'thin', br:i===8?'medium':'thin'
          });
        });
        r++;
      }

      // ── Data rows — every calendar day ───────────────────
      for (let day=1; day<=daysInMonth; day++) {
        const date    = new Date(year, month, day);
        const dow     = date.getDay();
        const ds      = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const isFri   = dow===5, isSat=dow===6;
        const blk     = typeof window.blockedDates!=='undefined' ? window.blockedDates[ds] : null;
        const hol     = typeof window.getHolidayInfo==='function' ? window.getHolidayInfo(ds) : null;
        const dayName = `יום\u00a0${HEB_DAYS[dow]}`;
        const dateStr = `${day}/${month+1}/${String(year).slice(-2)}`;

        const dayEvs  = (byDate[ds]||[]).sort((a,b)=>(a.t||'').localeCompare(b.t||''));
        const rowCount = dayEvs.length || 1;

        for (let ei=0; ei<rowCount; ei++) {
          const ev      = dayEvs[ei] || null;
          const isFirst = ei===0;
          const isCan   = ev && (ev.st==='can'||ev.st==='nohap');

          const holType = hol ? (hol.type||'vacation') : null;
          let fill = CLR.BLUE;
          if (isFri||isSat)               fill = CLR.RED;
          else if (holType==='camp')       fill = CLR.GOLD;
          else if (holType)               fill = CLR.YELLOW;

          const supName = ev ? ((typeof window.supBase==='function'?window.supBase(ev.a):ev.a)||ev.a||'') : '';
          let evTpLabel = ev ? (ev.tp||'חוג') : '';
          if (evTpLabel === 'חוג') {
            const rawCls = garden.cls || '';
            if (rawCls.includes('צהרון')) evTpLabel = 'חוג צהרון';
            else evTpLabel = 'חוג בוקר';
          }
          const actName  = ev ? (ev.act||(typeof window.supAct==='function'?window.supAct(ev.a):'')||'') : '';
          const colF     = ev ? (actName?supName+' - '+actName:supName) : '';
          const phone    = ev ? (ev.p||(typeof window.supEx!=='undefined'&&window.supEx[supName]?.ph1)||'') : '';
          const grp      = ev ? (isCan ? 0 : (ev.grp||1)) : '';

          const vals = [
            garden.name, '',
            isFirst ? dateStr : '',
            isFirst ? dayName : '',
            ev ? (hol ? hol.name : evTpLabel) : (isFirst&&hol ? hol.name : ''),
            ev ? colF : '',
            ev ? phone    : '',
            ev ? grp      : '',
            ev ? (ev.t?ev.t.slice(0,5):'') : ''
          ];

          const row = ws.addRow(vals);
          row.height = 19.35;
          styleDataRow(row, fill);
          // Col E: uniform font size 9 for all holiday/camp names
          if(hol && hol.name) {
            const ce = row.getCell(5);
            ce.font = {...(ce.font||{}), name:'Arial', size: 9};
          }
          r++;
        }
      }

      // ── Footer ────────────────────────────────────────────
      // 5 blank spacer rows to push footer down
      for(let sp=0;sp<5;sp++){
        const blank=ws.addRow(['','','','','','','','','']);
        blank.height=19.35;
        r++;
      }
      // Manager row - right-aligned
      {
        const row = ws.addRow([mgrText,'','','','','','','','']);
        row.height = 18;
        applyStyle(row.getCell(1), {sz:11, bold:false, align:'right'});
        ws.mergeCells(r+1,1,r+1,9);
        r++;
      }
      // Main notice row — thick outer border box, 1.48cm height
      {
        const row = ws.addRow(['ייתכנו שינויים בלוח החוגים','','','','','','','','']);
        row.height = 42; // 1.48cm ≈ 42pt
        const thickBorder = {style:'thick'};
        applyStyle(row.getCell(1), {sz:22, bold:true, align:'center', valign:'middle'});
        row.getCell(1).border = {top:thickBorder, bottom:thickBorder, right:thickBorder};
        for (let c=2;c<=8;c++) {
          row.getCell(c).font={name:'Arial',size:22,bold:true};
          row.getCell(c).alignment={horizontal:'center',vertical:'middle',readingOrder:'rightToLeft'};
          row.getCell(c).border={top:thickBorder, bottom:thickBorder};
        }
        row.getCell(9).font={name:'Arial',size:22,bold:true};
        row.getCell(9).alignment={horizontal:'center',vertical:'middle',readingOrder:'rightToLeft'};
        row.getCell(9).border={top:thickBorder, bottom:thickBorder, left:thickBorder};
        ws.mergeCells(r+1,1,r+1,9);
        r++;
      }
      return r;
    }

    if (singleSheet) {
      const sheetName = (gardens.length > 0 && gardens[0].city) ? gardens[0].city.replace(/[*?:\[\]\/\\]/g,'').slice(0,31) : 'כל הגנים';
      const ws = workbook.addWorksheet(sheetName);
      setupWorksheet(ws, monthTitle);
      let r = 0;
      gardens.forEach((garden, gIdx) => {
        if (gIdx > 0) {
          const spacer = ws.addRow([]); spacer.height = 30; r++;
        }
        r = _appendGardenToSheet(ws, r, garden, allEvs, year, month, daysInMonth, HEB_DAYS, CLR, applyStyle, styleDataRow);
      });
    } else {
      gardens.forEach((garden) => {
        const sheetName = garden.name.replace(/[*?:\[\]\/\\]/g,'').slice(0,31) || `גן${garden.id}`;
        const ws = workbook.addWorksheet(sheetName);
        setupWorksheet(ws, monthTitle);
        let r = 0;
        r = _appendGardenToSheet(ws, r, garden, allEvs, year, month, daysInMonth, HEB_DAYS, CLR, applyStyle, styleDataRow);
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    // ── Post-process: inject pageLayout into sheetView XML ──────────────
    let finalBlob;
    try {
      // Use _SafeJSZip saved at page load (before ExcelJS could overwrite window.JSZip)
      const JZ = window._SafeJSZip;
      if (!JZ) throw new Error('_SafeJSZip not available');
      const zip = await JZ.loadAsync(buffer);
      const sheetKeys = Object.keys(zip.files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
      for (const sk of sheetKeys) {
        let xml = await zip.files[sk].async('text');
        // 1. Inject view="pageLayout" into <sheetView>
        xml = xml.replace(/<sheetView\b([^>]*?)(\/?>)/g, (m, attrs, close) => {
          const a2 = attrs.includes('view=')
            ? attrs.replace(/view="[^"]*"/, 'view="pageLayout"')
            : attrs + ' view="pageLayout"';
          return `<sheetView${a2}${close}`;
        });
        // 2. Inject header directly into XML
        const hdrText = `&amp;R&amp;&quot;Arial,Bold&quot;&amp;18${monthTitle}`;
        if (!xml.includes('<headerFooter')) {
          xml = xml.replace(/<\/sheetData>/, `</sheetData><headerFooter scaleWithDoc="0"><oddHeader>${hdrText}</oddHeader><evenHeader>${hdrText}</evenHeader></headerFooter>`);
        } else {
          xml = xml.replace(/<headerFooter[^>]*>[\s\S]*?<\/headerFooter>/,
            `<headerFooter scaleWithDoc="0"><oddHeader>${hdrText}</oddHeader><evenHeader>${hdrText}</evenHeader></headerFooter>`);
        }
        zip.file(sk, xml);
      }
      // STORE compression — DEFLATE corrupts binary parts of xlsx
      const patched = await zip.generateAsync({ type:'arraybuffer', compression:'STORE' });
      finalBlob = new Blob([patched], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    } catch(pErr) {
      console.warn('pageLayout patch failed, using raw buffer:', pErr);
      finalBlob = new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    }
        const a = document.createElement('a');
    a.href  = URL.createObjectURL(finalBlob);
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 1000);
    window.showToast('📊 קובץ Excel נוצר!');
  } catch(e) {
    console.error('ExcelJS error:', e);
    window.spAlert('שגיאה ביצירת Excel: ' + e.message + '\n\nבדוק את ה-console לפרטים');
    _csvFallback({sheets: gardens.map(g => ({garden:g, evs:allEvs.filter(s=>s.g===g.id)}))}, filename);
  }
}

function _csvFallback(wb, filename) {
  const csvParts = [];
  wb.sheets.forEach(({garden, evs}) => {
    csvParts.push(`=== ${garden.name} ===`);
    const {rows} = buildSheetData(garden, evs);
    rows.forEach(r => csvParts.push(r.map(c => c==null?'':String(c).replace(/,/g,'，')).join(',')));
    csvParts.push('');
  });
  const blob = new Blob(['\uFEFF'+csvParts.join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.replace('.xlsx','.csv');
  a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 1000);
}


function buildStyledSheet(gardens, allEvs, year, month) {
  const ws = {};
  const merges = [];
  const rowBreaks = [];
  let r = 0;

  const HEB_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const HEB_DAYS   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

  // Hebrew year calculation
  function _hebYear(y, m) {
    // m is 0-indexed. Rosh Hashana shifts Sep onwards to new year.
    const baseYear = y + 3760;
    const adjusted = m >= 8 ? baseYear + 1 : baseYear; // Sep(8)+ = new year
    // Convert to Hebrew letter notation תשפ"ו etc.
    const HEB_LETTERS = {
      1:'א',2:'ב',3:'ג',4:'ד',5:'ה',6:'ו',7:'ז',8:'ח',9:'ט',
      10:'י',20:'כ',30:'ל',40:'מ',50:'נ',60:'ס',70:'ע',80:'פ',90:'צ',
      100:'ק',200:'ר',300:'ש',400:'ת'
    };
    let n = adjusted % 1000; // e.g. 786 for תשפ"ו
    let result = '';
    const vals = [400,300,200,100,90,80,70,60,50,40,30,20,10,9,8,7,6,5,4,3,2,1];
    for (const v of vals) {
      while (n >= v) { result += HEB_LETTERS[v]; n -= v; }
    }
    // Insert geresh/gershayim
    if (result.length === 1) return result + "'";
    return result.slice(0,-1) + '"' + result.slice(-1);
  }

  const hebYearStr = _hebYear(year, month);
  const monthStr = `${HEB_MONTHS[month]} ${year} ${hebYearStr}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function fill(rgb) { return rgb ? {patternType:'solid',fgColor:{rgb}} : {patternType:'none'}; }
  function font(sz, bold) { return {name:'Arial', sz, bold:!!bold}; }
  function border(t, b, l, ri) {
    const s = st => st ? {style:st,color:{rgb:'FF000000'}} : undefined;
    const o = {};
    if (s(t)) o.top = s(t);
    if (s(b)) o.bottom = s(b);
    if (s(l)) o.left = s(l);
    if (s(ri)) o.right = s(ri);
    return o;
  }
  function align(h) { return {horizontal:h, vertical:'center', readingOrder:2}; }

  function sc(row, col, value, style) {
    const addr = window.XLSX.utils.encode_cell({r: row, c: col});
    const t = typeof value === 'number' ? 'n' : value instanceof Date ? 'd' : 's';
    ws[addr] = {v: value != null ? value : '', t: value != null ? t : 's', s: style || {}};
  }

  function dataRow(row, fillRgb, isLeftBorder) {
    // Apply full-row style with borders for all 9 columns
    for (let c = 0; c < 9; c++) {
      const addr = window.XLSX.utils.encode_cell({r: row, c});
      if (!ws[addr]) ws[addr] = {v: '', t: 's', s: {}};
      ws[addr].s = {
        ...ws[addr].s,
        fill: fill(fillRgb),
        font: font(c === 5 || c === 6 ? 10 : 11, true),
        border: border('thin','thin', c===0?'medium':'thin', c===8?'medium':'thin'),
        alignment: align(c===0?'right':'center')
      };
    }
  }

  gardens.forEach((garden, gIdx) => {
    // ── ROW 1: Title ──────────────────────────────────
    sc(r, 0, 'לוז חוגים', {font:font(14,true), alignment:align('center')});
    sc(r, 5, monthStr,     {font:font(14,true), alignment:align('center')});
    for (let c=1;c<5;c++) sc(r,c,'',{font:font(14,true)});
    for (let c=6;c<9;c++) sc(r,c,'',{font:font(14,true)});
    merges.push({s:{r,c:0},e:{r,c:4}});
    merges.push({s:{r,c:5},e:{r,c:8}});
    r++;

    // ── ROWS 2-3: Garden name + City ─────────────────
    sc(r,   0, ` צהרון: ${garden.name}`, {font:font(14,true), alignment:align('center')});
    sc(r,   5, ` עיר : ${garden.city}`,  {font:font(14,true), alignment:align('center')});
    for (let c=1;c<5;c++) sc(r,  c,'',{font:font(14,true)});
    for (let c=6;c<9;c++) sc(r,  c,'',{font:font(14,true)});
    for (let c=0;c<9;c++) sc(r+1,c,'',{font:font(14,true)});
    merges.push({s:{r,c:0},e:{r:r+1,c:4}});
    merges.push({s:{r,c:5},e:{r:r+1,c:8}});
    r += 2;

    // ── ROW 4: empty ─────────────────────────────────
    r++;

    // ── ROW 5: Column headers ─────────────────────────
    const hdrs  = ['שם הצהרון','גיל','תאריך','יום','חוג/הפעלה','שם החוג','טלפון',"קב'",'שעה'];
    const hAlgn = ['right','center','center','center','center','center','center','center','center'];
    const hSz   = [11,11,11,11,11,10,10,11,11];
    hdrs.forEach((h, c) => {
      sc(r, c, h, {
        font: font(hSz[c], true),
        alignment: {...align(hAlgn[c])},
        fill: fill(null),
        border: border('medium','thin', c===0?'medium':'thin', c===8?'medium':'thin')
      });
    });
    r++;

    // ── Data rows: one per day ────────────────────────
    const byDate = {};
    allEvs.filter(s => {
      const [ey,em] = s.d.split('-').map(Number);
      return s.g === garden.id && ey === year && em === month + 1;
    }).forEach(s => {
      if (!byDate[s.d]) byDate[s.d] = [];
      byDate[s.d].push(s);
    });

    for (let day = 1; day <= daysInMonth; day++) {
      const date   = new Date(year, month, day);
      const dow    = date.getDay();
      const ds     = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const isFri  = dow === 5;
      const isSat  = dow === 6;
      const blk    = window.blockedDates ? window.blockedDates[ds] : null;
      const hol    = typeof window.getHolidayInfo === 'function' ? window.getHolidayInfo(ds) : null;
      const holType2 = hol ? (hol.type||'vacation') : null;
      const fillRgb = (isFri||isSat) ? 'FFFF0000' : holType2==='camp' ? 'FFFF9999' : holType2 ? 'FFFFFF00' : null;
      const dayName = `יום\u00a0${HEB_DAYS[dow]}`;
      const dayEvs  = (byDate[ds]||[]).sort((a,b)=>(a.t||'').localeCompare(b.t||''));
      const specialNote = '';
      const rows = dayEvs.length || 1;

      for (let ei = 0; ei < rows; ei++) {
        const ev      = dayEvs[ei] || null;
        const isFirst = ei === 0;
        const isCan   = ev && (ev.st==='can'||ev.st==='nohap');
        // row fill: cancelled = light red, else as day color
        const rowFill = fillRgb;
        // Paint full row first
        dataRow(r + ei, rowFill);
        // Then fill values
        if (isFirst) {
          sc(r+ei, 0, garden.name, null); // always show garden name
          sc(r+ei, 2, ds,          null);
          sc(r+ei, 3, dayName,     null);
        }
        if (ev) {
          const supName = window.supBase(ev.a) || ev.a || '';
          let actType = ev.tp || 'חוג';
          if (actType === 'חוג') {
            const rawCls = garden.cls || '';
            if (rawCls.includes('צהרון')) actType = 'חוג צהרון';
            else actType = 'חוג בוקר';
          }
          const supData = window.SUPBASE ? window.SUPBASE.find(s=>(typeof window.supBase==='function'?window.supBase(s.name):s.name)===supName) : null;
          const phone   = ev.p || (supData&&supData.phone) || (window.supEx&&window.supEx[supName]&&window.supEx[supName].ph1) || '';
          const holObj = hol || null;
          sc(r+ei, 4, holObj ? (holObj.name||actType) : actType, null);
          sc(r+ei, 5, supName,         null);
          sc(r+ei, 6, phone,           null);
          sc(r+ei, 7, isCan ? 0 : (ev.grp||1), null);
          sc(r+ei, 8, ev.t ? ev.t.slice(0,5) : '', null);
        } else if (false) {
        }
      }
      r += rows;
    }

    // ── Footer ────────────────────────────────────────
    r += 3; // empty rows

    // "שם הרכז בגן" line with medium bottom border
    for (let c=0;c<9;c++) {
      sc(r, c, c===0?'שם הרכז בגן':'', {
        font: font(11,true),
        border: border(null,'medium',null,null),
        alignment: align(c===0?'right':'center')
      });
    }
    r++;

    // Footer note merged A:I over 2 rows
    sc(r, 0, '* שימו לב -  ייתכנו שינויים בתוכנית החוגים', {
      font: font(11,true),
      border: border('medium','medium',null,null),
      alignment: align('right')
    });
    for (let c=1;c<9;c++) sc(r,c,'',{border:border('medium',null,null,null)});
    for (let c=0;c<9;c++) sc(r+1,c,'',{border:border(null,'medium',null,null)});
    merges.push({s:{r,c:0},e:{r:r+1,c:8}});
    r += 2;

    // Page break after each garden except last
    if (gIdx < gardens.length - 1) {
      rowBreaks.push(r - 1);
      r++; // spacing row between gardens
    }
  });

  ws['!ref']       = window.XLSX.utils.encode_range({s:{r:0,c:0},e:{r:r-1,c:8}});
  ws['!merges']    = merges;
  ws['!rowbreaks'] = rowBreaks;
  ws['!cols']      = [{wch:14.4},{wch:3.6},{wch:8.75},{wch:9.25},{wch:8.9},{wch:24.6},{wch:12.4},{wch:4.25},{wch:6.1}];
  ws['!sheetView'] = [{rightToLeft: true}];
  return ws;
}

function buildSheetData(garden, evs) {
  // Legacy fallback — kept for CSV export
  const rows = [];
  const HEB_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const HEB_DAYS = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  rows.push(['לוז חוגים',null,null,null,null,null,null,null,null]);
  rows.push([` צהרון: ${garden.name}`,null,null,null,null,` עיר : ${garden.city}`,null,null,null]);
  rows.push(['שם הצהרון','גיל','תאריך','יום','חוג/הפעלה','שם החוג','טלפון',"קב'",'שעה']);
  if (!evs.length) { rows.push([null,null,null,null,'אין פעילויות',null,null,null,null]); return {rows}; }
  const byDate = {};
  evs.forEach(s => { if(!byDate[s.d]) byDate[s.d]=[]; byDate[s.d].push(s); });
  const dates = Object.keys(byDate).sort();
  dates.forEach(ds => {
    const dayEvs = (byDate[ds]||[]).sort((a,b)=>(a.t||'').localeCompare(b.t||''));
    const date = new Date(ds.replace(/-/g,'/'));
    const dayName = `יום\u00a0${HEB_DAYS[date.getDay()]}`;
    if (!dayEvs.length) { rows.push([null,null,ds,dayName,null,null,null,null,null]); return; }
    dayEvs.forEach((s,i) => {
      const supName = window.supBase(s.a)||s.a;
      rows.push([i===0?garden.name:null, null, i===0?ds:null, i===0?dayName:null,
        s.act||(typeof window.supAct==='function'?window.supAct(s.a):'')||'חוג',
        supName, s.p||'', s.grp||1, s.t?s.t.slice(0,5):''
      ]);
    });
  });
  return {rows};
}



async function exportToExcel(data, filename, opts = {}) {
  console.log('Export Engine v97.8');
  if (!data || !data.length) { window.spAlert('אין נתונים לייצוא'); return; }
  
  const excelLoaded = await (window.ensureExcelJSLoaded ? window.ensureExcelJSLoaded() : Promise.resolve(typeof window.ExcelJS !== 'undefined'));
  if (excelLoaded && typeof window.ExcelJS !== 'undefined') {
    try {
      const workbook = new window.ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Sheet1', { 
        views: [{ rightToLeft: true, state: 'frozen', xSplit: 0, ySplit: 1 }] 
      });
      ws.pageSetup = {
        paperSize: 9, // A4
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.3/2.54, right: 0.3/2.54, top: 0.4/2.54, bottom: 0.4/2.54, header: 0.8/2.54, footer: 0.8/2.54 }
      };
      
      if(opts.title){
        const titleRow = ws.addRow([opts.title]);
        titleRow.font = { name: 'Arial', size: 16, bold: true };
        ws.mergeCells(1, 1, 1, opts.type === 'supplier_placement' ? 8 : 9);
        ws.pageSetup.printTitlesRow = '1:1';
      }

      const isSupplierExport = opts.type === 'supplier' || opts.type === 'supplier_placement';
      const isPlacement = opts.type === 'supplier_placement';
      let totalOk = 0, totalNo = 0, totalGroups = 0;

      if(isSupplierExport){
        const byType = {};
        data.forEach(s => {
          const t = window.gcls(window.G(s.g));
          if(!byType[t]) byType[t] = [];
          byType[t].push(s);
        });

        // Ensure "גנים" comes first, then everything else
        const types = Object.keys(byType).sort((a,b) => a === 'גנים' ? -1 : (b === 'גנים' ? 1 : a.localeCompare(b)));
        
        types.forEach(type => {
          const summaryRows = [];
          let typeGlobalGroups = 0;
          
          const typeEvsAll = byType[type];
          const byCity = {};
          typeEvsAll.forEach(s => {
            const c = window.G(s.g).city || 'אחר';
            if(!byCity[c]) byCity[c] = [];
            byCity[c].push(s);
          });
          
          const cities = Object.keys(byCity).sort();
          cities.forEach(city => {
            let typeOk = 0, typeNo = 0, typeGroups = 0, typeGroupsNo = 0;
            const typeEvs = byCity[city].sort((a,b) => {
              const ds = a.d.localeCompare(b.d);
              if(ds !== 0) return ds;
              
              // Sort by Pair Name BEFORE Time so pairs stay together
              const pA = window.gardenPair(a.g), pB = window.gardenPair(b.g);
              const nA = pA ? pA.name : window.G(a.g).name;
              const nB = pB ? pB.name : window.G(b.g).name;
              const ns = nA.localeCompare(nB, 'he');
              if(ns !== 0) return ns;
              
              // Fallback to Time if same pair
              return (a.t || '99:99').localeCompare(b.t || '99:99');
            });

            let actualName = window._supExName || 'כל הספקים';
            if (opts.title) {
                if (opts.title.includes('דו"ח פעילות לספק:')) {
                    actualName = opts.title.split('דו"ח פעילות לספק:')[1].split('(טווח')[0].trim();
                } else if (opts.title.includes('דו"ח שיבוצים לספק:')) {
                    actualName = opts.title.split('דו"ח שיבוצים לספק:')[1].split('(טווח')[0].trim();
                } else if (opts.title.includes('דו"ח שיבוץ לספק - ')) {
                    actualName = opts.title.split('-')[1].split('(טווח')[0].trim();
                }
            }
            const titleRow = ws.addRow([`${actualName} - ${city} - ${type}`]);
            titleRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.font = { name: 'Arial', bold: true, size: 14 };
                if (colNumber <= (isPlacement ? 8 : 9)) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };
                }
            });
            titleRow.alignment = { horizontal: 'right' };
            ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, isPlacement ? 8 : 9);

            const headRow = isPlacement ? ws.addRow(['רחוב', 'גן/בי"ס', 'תאריך', 'יום', 'שעה', 'קבוצות', 'סטטוס', 'הערות']) : ws.addRow(['תאריך', 'יום', 'גן/בי"ס', 'שם ספק החוגים', 'פעילות', 'שעה', 'קבוצות', 'סטטוס', 'הערות']);
            headRow.font = { bold: true };
            headRow.eachCell(cell => {
               cell.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
               cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D9E6' } };
               cell.alignment = { horizontal: 'right' };
            });

            const schoolStats = {};
            typeEvs.forEach(s => {
              const statusLabel = (window.stLabel ? window.stLabel(s) : s.st).replace(/<[^>]*>/g, '');
              const g = window.G(s.g);
              const isSchool = window.gcls(g) === 'ביה"ס';
              const note = (s.nt || '').toLowerCase();
              
              if(!schoolStats[g.name]) schoolStats[g.name] = { ok: 0, grp: 0 };
              
              // Report is faithful to site, but has safety overrides for notes
              const isMakeup = note.includes('השלמה');
              const isMovedFrom = note.includes('נדחה מ') || note.includes('הוזז מ') || note.includes('הזזה מ') || note.includes('הוקדם מ');
              const isMovedTo = note.includes('נדחה ל') || note.includes('הוזז ל') || note.includes('הזזה ל') || note.includes('הוקדם ל');
              const isPositive = isMakeup || isMovedFrom || ((note.includes('נדחה') || note.includes('הוקדם')) && !isMovedTo);

              let isOk = s.st === 'ok' || s.st === 'done';
              
              if(isOk) {
                const canWords = ['בוטל', 'מבוטל', 'מצב בטחוני', 'סגר', 'שביתה'];
                const nohapWords = ['חסר מדריך', 'חוסר מדריך', 'אין מדריך', 'לא התקיים', 'לא הגיע', 'חולה', 'נתקע', 'לא נשאר', 'עזב', 'לא התקיימה'];
                const isManualCancel = [...canWords, ...nohapWords].some(w => note.includes(w));
                if((isManualCancel || isMovedTo) && !isPositive) {
                   isOk = false;
                }
              }

              // Always show real group count from data, default to 1 if ok
              let grpCount = isOk ? (s.grp || 1) : 0;
              
              if(isOk) { typeOk++; totalOk++; schoolStats[g.name].ok++; } else { typeNo++; totalNo++; typeGroupsNo += (s.grp || 1); }
              typeGroups += grpCount;
              totalGroups += grpCount;
              schoolStats[g.name].grp += grpCount;

              // Clean up status label: show failure if not ok
              let displayStatus = statusLabel;
              if(!isOk) {
                const lower = note.toLowerCase();
                const canWords = ['בוטל', 'מבוטל', 'מצב בטחוני', 'סגר', 'שביתה'];
                if(canWords.some(w => lower.includes(w)) || s.st === 'can') {
                  displayStatus = '❌ בוטל';
                } else {
                  displayStatus = isPositive ? '⚠️ השלמה לא התקיימה' : '⚠️ לא התקיים';
                }
              } else if (statusLabel === 'מתקיים' || s.st === 'ok' || s.st === 'done') {
                 displayStatus = ''; 
              }
              
              let formattedNote = typeof window.formatNoteWithTag === 'function' ? window.formatNoteWithTag(s) : (s.nt || '');
              formattedNote = formattedNote.replace(/(✅|☑️)?\s*טופל:\s*טופל(\s*\|\s*)?/g, '').trim();
              formattedNote = formattedNote.replace(/^\|\s*|\s*\|$/g, '').trim();
              
              const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
              const dayStr = 'יום ' + dayNames[new Date(s.d).getDay()];
              const row = isPlacement ? ws.addRow([(g.add || g.st) || '', g.name, window.fD(s.d), dayStr, s.t, grpCount, displayStatus, formattedNote]) : ws.addRow([window.fD(s.d), dayStr, g.name, window.supBase ? window.supBase(s.a) : s.a, s.act || window.supAct(s.a) || '', s.t, grpCount, displayStatus, formattedNote]);
              row.eachCell(cell => {
                 cell.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
                 cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
              });
            });

            typeGlobalGroups += typeGroups;

            // Section Sub-Summary
            const typeSum = isPlacement ? ws.addRow([`📌 ${city} - ${type}: ${typeGroups} פעילויות לביצוע (כולל השלמות)`, '', '', '', '', '', '', '']) : ws.addRow([`📌 ${city} - ${type}: בוצעו ${typeGroups} פעילויות (כולל השלמות)`, '', '', '', '', '', '', '', '']);
            typeSum.font = { bold: true, size: 12, color: { argb: 'FF1A237E' } };
            typeSum.eachCell((cell) => {
              cell.alignment = { horizontal: 'right' };
            });
            ws.mergeCells(typeSum.number, 1, typeSum.number, isPlacement ? 8 : 9);

            if (typeGroupsNo > 0 && !isPlacement) {
              const typeSumNo = ws.addRow([`❌ ${city} - ${type}: לא בוצעו ${typeGroupsNo} פעילויות (כולל השלמות)`, '', '', '', '', '', '', '', '']);
              typeSumNo.font = { bold: true, size: 12, color: { argb: 'FFD32F2F' } };
              typeSumNo.eachCell((cell) => { cell.alignment = { horizontal: 'right' }; });
              ws.mergeCells(typeSumNo.number, 1, typeSumNo.number, 9);
            }
            ws.addRow([]);
            
            if (type === 'ביה"ס' || type === 'בתי ספר') {
              Object.keys(schoolStats).sort().forEach(sName => {
                if (schoolStats[sName].grp > 0) {
                  summaryRows.push({ label: sName, ok: schoolStats[sName].ok, grp: schoolStats[sName].grp });
                }
              });
            } else {
              if (typeGroups > 0) {
                summaryRows.push({ label: `${city} - ${type}`, ok: typeOk, grp: typeGroups });
              }
            }
          });
          
          // Print Summary Table for TYPE
          if (typeGlobalGroups > 0) {
            ws.addRow([]);
            let summaryTitleStr = opts.summaryTitle || '📊 ריכוז פעילות סופי';
            if (isPlacement && summaryTitleStr.includes('סה"כ פעילויות לביצוע:')) {
                summaryTitleStr = summaryTitleStr.replace('סה"כ פעילויות לביצוע:', 'ריכוז פעילות לספק:');
            }
            // Try to add the Type name to the summary title if it doesn't have it
            let finalTitleStr = summaryTitleStr;
            if (!finalTitleStr.includes(type)) {
               finalTitleStr = finalTitleStr.replace('סופי', `- ${type}`);
            }
            const sumHead = isPlacement ? ws.addRow([finalTitleStr, '', '', '', '', '', '', '']) : ws.addRow([finalTitleStr, '', '', '', '', '', '', '', '']);
            sumHead.font = { bold: true, size: 12 };
            sumHead.alignment = { horizontal: 'right' };
            ws.mergeCells(sumHead.number, 1, sumHead.number, isPlacement ? 8 : 9);

            summaryRows.forEach(sr => {
              const row = isPlacement ? ws.addRow([sr.label, `${sr.grp} פעילויות`]) : ws.addRow([sr.label, `בוצעו ${sr.grp} פעילויות`, '']);
              row.eachCell(cell => {
                cell.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
                cell.alignment = { horizontal: 'right' };
              });
            });

            const totalRow = isPlacement ? ws.addRow(['סה"כ קבוצות בדו"ח', typeGlobalGroups]) : ws.addRow(['₪ סה"כ קבוצות לתשלום (כללי)', '', typeGlobalGroups]);
            totalRow.font = { bold: true };
            totalRow.eachCell(cell => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
              cell.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
              cell.alignment = { horizontal: 'right' };
            });
            if(!isPlacement) ws.mergeCells(totalRow.number, 1, totalRow.number, 2);
            ws.addRow([]); // Blank row before the next type starts
          }
        });
      } else {
        const keys = Object.keys(data[0]);
        ws.addRow(keys).font = { bold: true };
        data.forEach(item => ws.addRow(Object.values(item)));
      }

      ws.columns.forEach(col => {
        let maxLength = 0;
        col.eachCell({ includeEmpty: true }, cell => {
          if (cell.isMerged) return; // Skip merged cells like titles
          const columnLength = cell.value ? cell.value.toString().length : 0;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        // Add padding, minimum width 10, maximum width 60
        col.width = Math.min(Math.max(maxLength + 2, 10), 60);
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (filename || 'export') + ".xlsx";
      a.click();
      return;
    } catch (e) {
      console.error('Advanced export failed:', e);
    }
  }

  // CSV fallback with UTF-8 BOM if ExcelJS is not available
  if (data && data.length) {
    let csv = '\uFEFF';
    const keys = Object.keys(data[0]);
    csv += keys.map(k => `"${k}"`).join(',') + '\n';
    data.forEach(item => {
      csv += keys.map(k => `"${String(item[k] || '').replace(/"/g, '""')}"`).join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (filename || 'export') + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

async function exportShortagesToExcel() {
  if (window.loadFromFirebase) {
    window.showToast('מסנכרן נתונים אחרונים מול השרת...', 3000);
    await window.loadFromFirebase(true);
  }
  await (window.ensureExcelJSLoaded ? window.ensureExcelJSLoaded() : Promise.resolve());
  if (typeof window.ExcelJS === 'undefined') {
    window.spAlert('ExcelJS is not loaded yet. Please wait a moment and try again.');
    return;
  }

  const wb = new window.ExcelJS.Workbook();
  const ws = wb.addWorksheet('חוסרים להשלמה');
  ws.views = [{ rightToLeft: true }];

  ws.columns = [
    { header: 'עש/סוג', key: 'type', width: 10 },
    { header: 'עיר', key: 'city', width: 15 },
    { header: 'רחוב', key: 'street', width: 25 },
    { header: 'שם המוסד/גן', key: 'name', width: 25 },
    { header: 'גיל', key: 'age', width: 10 },
    { header: 'תאריך', key: 'date', width: 15 },
    { header: 'יום', key: 'day', width: 15 },
    { header: 'חוג/פעולה', key: 'actType', width: 15 },
    { header: 'שם החוג', key: 'sup', width: 30 },
    { header: 'טלפון', key: 'supPhone', width: 15 },
    { header: 'קבוצות', key: 'groups', width: 10 },
    { header: 'שעה', key: 'time', width: 10 },
    { header: 'הערות', key: 'notes', width: 30 },
    { header: 'הושלם', key: 'makeup', width: 30 },
    { header: 'טלפון מפעיל/רכז', key: 'operator', width: 20 }
  ];

  ws.getRow(1).eachCell(cell => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    cell.alignment = { horizontal: 'center' };
  });

  const HEB_DAYS = ['יום ראשון','יום שני','יום שלישי','יום רביעי','יום חמישי','יום שישי','שבת'];

  const shortages = (window.SCH || []).filter(s => {
    if (!s) return false;
    const isHandled = !!(s._compByMakeup && s._compByMakeup !== "false") || !!((s.nt && /הושלם|במקום זה|במקום פעילות|השלמה עבור/i.test(s.nt)) || (s.n && /הושלם|במקום זה|במקום פעילות|השלמה עבור/i.test(s.n)));
    const isMText = (str) => str && /השלמה|במקום/i.test(str) && !str.includes('השלמה נקבעה ל-');
    const isM = !!(s._isMakeup || s._makeupFrom || isMText(s.nt) || isMText(s.n) || isMText(s.a));
    
    if (s.st !== 'nohap' && s.st !== 'post') return false;
    if (s.st === 'can' || isM || isHandled) return false;
    return true;
  });

  shortages.forEach(s => {
    const g = window.G(s.g) || {};
    const city = g.city || '';
    const type = window.gcls ? window.gcls(g) : (g.name && g.name.startsWith('ביה"ס') ? 'ביה"ס' : 'גנים');
    
    let dateStr = s.d;
    let dayStr = '';
    if (dateStr) {
      const parts = dateStr.split('-');
      if (parts.length === 3) dateStr = `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`;
      try {
        const dObj = new Date(s.d);
        if (!isNaN(dObj)) dayStr = HEB_DAYS[dObj.getDay()];
      } catch(e){}
    }
    
    let supPhone = '';
    if (window.getAllSup) {
      const allSups = window.getAllSup();
      const sObj = allSups.find(x => x.name === s.a || (window.supBase && window.supBase(x.name) === window.supBase(s.a)));
      if (sObj && sObj.phone) supPhone = sObj.phone;
    }
    
    let operatorStr = g.operator || g.opPhone || '';
    if (g.operator && g.opPhone) operatorStr = `${g.operator} - ${g.opPhone}`;

    ws.addRow({
      type: type,
      city: city,
      street: g.address || '',
      name: g.name || '',
      age: window.extractGardenAge(g),
      date: dateStr,
      day: dayStr,
      actType: 'חוג',
      sup: s.a + (s.act ? ` - ${s.act}` : ''),
      supPhone: supPhone,
      groups: s.gr || '',
      time: window.fT ? window.fT(s.t) : s.t || '',
      notes: s.nt || s.n || 'לא התקיים',
      makeup: '', 
      operator: operatorStr
    });
  });

  try {
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `דוח_חוסרים_${window.td().split('-').reverse().join('-')}.xlsx`;
    a.click();
  } catch (e) {
    console.error('Shortages export failed:', e);
    window.spAlert('שגיאה בייצוא הדוח');
  }
}



window.openMonthlyExport = openMonthlyExport;
window.doMonthlyExport = doMonthlyExport;
window.exportToExcel = exportToExcel;
window.exportShortagesToExcel = exportShortagesToExcel;
window.downloadWB = downloadWB;
window.buildCityWB = buildCityWB;
window.buildGardenWB = buildGardenWB;
window.generateChangesExcelReport = async function(isAuto = false) {
  await (window.ensureExcelJSLoaded ? window.ensureExcelJSLoaded() : Promise.resolve());
  if (typeof window.ExcelJS === 'undefined') {
    if (!isAuto) window.spAlert('ExcelJS is not loaded yet. Please wait a moment and try again.');
    return;
  }

  const normalizeDateInput = (val) => {
    if (!val) return '';
    let v = val;
    // Strip time portion if any (e.g. T00:00:00)
    if (v.length > 10 && v.includes('T')) v = v.split('T')[0];

    const convert = (p) => {
      let y = p[2];
      if (y.length === 2) y = '20' + y;
      return `${y}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
    };

    if (v.includes('/')) {
      const p = v.split('/');
      if (p[0].length === 4) return `${p[0]}-${p[1].padStart(2,'0')}-${p[2].padStart(2,'0')}`;
      if (p.length === 3) return convert(p);
    }
    if (v.includes('-')) {
      const p = v.split('-');
      if (p[0].length !== 4) return convert(p);
    }
    if (v.includes('.')) {
      const p = v.split('.');
      if (p[0].length !== 4) return convert(p);
    }
    return v;
  };

  const fromStr = normalizeDateInput(document.getElementById('exc-from').value);
  const toStr = normalizeDateInput(document.getElementById('exc-to').value);
  
  if (!fromStr || !toStr) {
    if (!isAuto) window.spAlert('נא לבחור טווח תאריכים מלא (מתאריך ועד תאריך).');
    return;
  }

  const changes = (window.SCH || []).filter(s => {
    if (!s || !s.d) return false;
    const sDateStr = normalizeDateInput(s.d);
    if (sDateStr < fromStr || sDateStr > toStr) return false;

    // Is it a changed status?
    if (['nohap', 'can', 'post'].includes(s.st)) return true;
    
    // Is it a makeup / preponed?
    const isMText = (str) => str && /השלמה|במקום/i.test(str) && !str.includes('השלמה נקבעה ל-');
    const isM = !!(s._isMakeup || s._makeupFrom || isMText(s.nt) || isMText(s.n) || isMText(s.a));
    if (isM) return true;
    
    return false;
  });

  if (changes.length === 0) {
    if (!isAuto) window.spAlert('לא נמצאו פעילויות חריגות (שינויים) בטווח התאריכים הנבחר.');
    return;
  }

  const wb = new window.ExcelJS.Workbook();
  const ws = wb.addWorksheet('דוח שינויים');
  ws.views = [{ rightToLeft: true }];

  ws.columns = [
    { header: 'תאריך', key: 'date', width: 15 },
    { header: 'יום', key: 'day', width: 12 },
    { header: 'עיר', key: 'city', width: 15 },
    { header: 'שם הצהרון/בי"ס', key: 'name', width: 25 },
    { header: 'חוג/ספק', key: 'sup', width: 25 },
    { header: 'שעה מקורית', key: 'time', width: 12 },
    { header: 'סוג חריגה', key: 'changeType', width: 18 },
    { header: 'הערות (סיבה/פירוט)', key: 'notes', width: 40 },
    { header: 'סטטוס מערכת', key: 'status', width: 15 }
  ];

  ws.getRow(1).eachCell(cell => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB2EBF2' } };
    cell.alignment = { horizontal: 'center' };
  });

  const HEB_DAYS = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

  changes.sort((a,b) => {
    const dA = normalizeDateInput(a.d);
    const dB = normalizeDateInput(b.d);
    const ds = dA.localeCompare(dB);
    if(ds !== 0) return ds;
    const gA = window.G(a.g) || {};
    const gB = window.G(b.g) || {};
    return (gA.name||'').localeCompare(gB.name||'');
  });

  changes.forEach(s => {
    const g = window.G(s.g) || {};
    let dayStr = '';
    let fDate = s.d;
    try {
      const dObj = new Date(s.d);
      if (!isNaN(dObj)) {
        dayStr = 'יום ' + HEB_DAYS[dObj.getDay()];
        const parts = s.d.split('-');
        if (parts.length === 3) fDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    } catch(e){}

    const isMText = (str) => str && /השלמה|במקום/i.test(str) && !str.includes('השלמה נקבעה ל-');
    const isM = !!(s._isMakeup || s._makeupFrom || isMText(s.nt) || isMText(s.n) || isMText(s.a));
    
    let changeType = '';
    let extraNotes = '';
    
    // Check if there's a makeup or postponement linked to this activity
    const linkedNext = (window.SCH || []).find(x => x.g === s.g && x.a === s.a && (x._postFrom === s.d || x._makeupFrom === s.d));
    let linkedDateStr = '';
    if (linkedNext) {
      let pDate = linkedNext.d;
      try { pDate = `${pDate.split('-')[2]}/${pDate.split('-')[1]}/${pDate.split('-')[0]}`; } catch(e){}
      linkedDateStr = pDate;
    }

    if (s.st === 'can') {
      changeType = '❌ ביטול';
      if (linkedDateStr) extraNotes = `הושלם ב-${linkedDateStr}`;
    }
    else if (s.st === 'nohap') {
      changeType = isM ? '⚠️ השלמה לא התקיימה' : '⚠️ לא התקיים';
      if (linkedDateStr) extraNotes = `הושלם ב-${linkedDateStr}`;
    }
    else if (s.st === 'post') {
      changeType = '⏩ דחייה';
      if (linkedDateStr) extraNotes = `נדחה ל-${linkedDateStr}`;
    }
    else if (isM) {
      changeType = '🔄 השלמה / הקדמה';
    }

    let finalNotes = s.nt || s.n || '';
    if (extraNotes) {
      finalNotes = finalNotes ? `${finalNotes} (${extraNotes})` : extraNotes;
    }

    ws.addRow({
      date: fDate,
      day: dayStr,
      city: g.city || '',
      name: g.name || '',
      sup: s.a + (s.act ? ` - ${s.act}` : ''),
      time: window.fT ? window.fT(s.t) : s.t || '',
      changeType: changeType,
      notes: finalNotes,
      status: s.st
    });
  });

  try {
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `דוח_שינויים_${fromStr}_עד_${toStr}${isAuto ? '_אוטומטי' : ''}.xlsx`;
    a.click();
    if(window.CM) window.CM('export-changes-m');
    if(isAuto && window.showToast) window.showToast('✅ הדוח ירד בהצלחה (אוטומטי)');
  } catch (e) {
    console.error('Changes export failed:', e);
    if (!isAuto) window.spAlert('שגיאה בייצוא הדוח');
  }
};

window.initAutoExportSettingsModal = function() {
  const confStr = window._safeLS.getItem('autoExportChangesConf');
  if(confStr) {
    try {
      const conf = JSON.parse(confStr);
      document.getElementById('auto-exc-status').value = conf.status || 'off';
      document.getElementById('auto-exc-freq').value = conf.freq || 'daily';
      document.getElementById('auto-exc-day').value = conf.day || '0';
      document.getElementById('auto-exc-time').value = conf.time || '17:00';
      document.getElementById('auto-exc-day-wrap').style.display = conf.freq === 'weekly' ? 'block' : 'none';
    } catch(e){}
  }
};

window.saveAutoExportSettings = function() {
  const conf = {
    status: document.getElementById('auto-exc-status').value,
    freq: document.getElementById('auto-exc-freq').value,
    day: document.getElementById('auto-exc-day').value,
    time: document.getElementById('auto-exc-time').value
  };
  window._safeLS.setItem('autoExportChangesConf', JSON.stringify(conf));
  window.CM('auto-export-changes-m');
  if (window.showToast) window.showToast('✅ הגדרות ייצוא אוטומטי נשמרו!');
  window.checkAutoExport();
};

window.checkAutoExport = function() {
  const confStr = window._safeLS.getItem('autoExportChangesConf');
  if(!confStr) return;
  try {
    const conf = JSON.parse(confStr);
    if (conf.status !== 'on') return;
    
    const now = new Date();
    const [h, m] = conf.time.split(':').map(Number);
    
    let targetTime = new Date(now);
    targetTime.setHours(h, m, 0, 0);

    if (conf.freq === 'daily') {
      if (now < targetTime) {
        targetTime.setDate(targetTime.getDate() - 1);
      }
    } else if (conf.freq === 'weekly') {
      const targetDay = Number(conf.day);
      let diff = now.getDay() - targetDay;
      if (diff < 0) diff += 7;
      if (diff === 0 && now < targetTime) {
        diff = 7;
      }
      targetTime.setDate(targetTime.getDate() - diff);
    }
    
    const lastExportStr = window._safeLS.getItem('lastAutoExportTime');
    const targetTimeStr = targetTime.getTime().toString();
    
    if (lastExportStr !== targetTimeStr) {
      window._safeLS.setItem('lastAutoExportTime', targetTimeStr);
      
      if (conf.freq === 'daily') {
        const td = window.d2s(targetTime);
        document.getElementById('exc-from').value = td;
        document.getElementById('exc-to').value = td;
      } else {
        const past = new Date(targetTime);
        past.setDate(past.getDate() - 6);
        document.getElementById('exc-from').value = window.d2s(past);
        document.getElementById('exc-to').value = window.d2s(targetTime);
      }
      
      if (window.showToast) window.showToast('📥 מוריד דוח שינויים אוטומטי...');
      setTimeout(() => {
        window.generateChangesExcelReport(true);
      }, 500);
    }
  } catch(e) {
    console.error('Auto export error', e);
  }
};

// Check periodically every minute
setInterval(() => {
  if (typeof window.checkAutoExport === 'function') window.checkAutoExport();
}, 60000);


setTimeout(() => {
  if (typeof window.checkAutoExport === 'function') window.checkAutoExport();
}, 3000);

// ═══════════════════════════════════════════════════
// BULK ANNUAL SCHEDULE EXPORT (IMPORT COMPATIBLE)
// ═══════════════════════════════════════════════════
window.exportBulkAnnualSchedule = async function() {
  if (window.loadFromFirebase) {
    window.showToast('מסנכרן נתונים אחרונים מול השרת...', 3000);
    await window.loadFromFirebase(true);
  }
  await (window.ensureExcelJSLoaded ? window.ensureExcelJSLoaded() : Promise.resolve());
  if (typeof window.ExcelJS === 'undefined') {
    window.spAlert('ExcelJS library not loaded. Please wait or reload.');
    return;
  }

  window.showToast('מכין ייצוא מעוצב... פעולה זו עשויה לקחת כדקה, נא להמתין', 20000);
  await new Promise(r => setTimeout(r, 200));

  let currentYearStr = window.CURRENT_YEAR || 'tashpav';
  
  let startYear = new Date().getFullYear();
  let startDate = null;
  let endDate = null;

  const metaStr = window._safeLS.getItem('ganv5_meta');
  const meta = metaStr ? JSON.parse(metaStr) : {};

  if (meta && meta.years && meta.years[currentYearStr]) {
    const yObj = meta.years[currentYearStr];
    if (yObj.start && yObj.end) {
      startDate = new Date(yObj.start);
      endDate = new Date(yObj.end);
      startYear = startDate.getFullYear();
    } else {
      const yName = yObj.name || currentYearStr;
      const match = yName.match(/\((\d{4})-(\d{4})\)/);
      if (match) startYear = parseInt(match[1]);
    }
  } else {
    if (currentYearStr === 'tashpav') startYear = 2025;
    else if (currentYearStr === 'tashpaz') startYear = 2026;
    else if (currentYearStr === 'tashpach') startYear = 2027;
    else if (currentYearStr === 'tashpat') startYear = 2028;
    else {
      startYear = new Date().getFullYear();
      if (new Date().getMonth() < 8) startYear -= 1;
    }
  }
  
  if (currentYearStr === 'tashpav' && startYear !== 2025) {
    startYear = 2025; startDate = new Date(2025, 8, 1); endDate = new Date(2026, 7, 31);
  } else if (currentYearStr === 'tashpaz' && startYear !== 2026) {
    startYear = 2026; startDate = new Date(2026, 8, 1); endDate = new Date(2027, 7, 31);
  } else if (currentYearStr === 'tashpach' && startYear !== 2027) {
    startYear = 2027; startDate = new Date(2027, 8, 1); endDate = new Date(2028, 7, 31);
  } else if (currentYearStr === 'tashpat' && startYear !== 2028) {
    startYear = 2028; startDate = new Date(2028, 8, 1); endDate = new Date(2029, 7, 31);
  }

  if (!startDate || !endDate) {
    startDate = new Date(startYear, 8, 1); // Sep 1
    endDate = new Date(startYear + 1, 7, 31); // Aug 31
  }

  const rawAllGans = typeof AG === 'function' ? AG() : [...(window.GARDENS||[]), ...(window._GARDENS_EXTRA||[])];
  
  // Deduplicate by ID, prioritizing _GARDENS_EXTRA (which come later in the array) to keep merged info like 'age'
  const ganMap = new Map();
  rawAllGans.forEach(g => ganMap.set(Number(g.id), g));
  const allGans = Array.from(ganMap.values());

  // Group events by date and garden for quick lookup
  const schByDateAndGan = {};
  window.SCH.forEach(s => {
    if (!schByDateAndGan[s.d]) schByDateAndGan[s.d] = {};
    if (!schByDateAndGan[s.d][s.g]) schByDateAndGan[s.d][s.g] = [];
    schByDateAndGan[s.d][s.g].push(s);
  });

  // Pre-calculate coordinator names (with phone) for each garden
  const mgrByGan = {};
  if (window.managers) {
    Object.values(window.managers).forEach(m => {
      if (m.gardenIds) {
        const mStr = m.name + (m.phone ? ' - ' + m.phone : '');
        m.gardenIds.forEach(gid => mgrByGan[gid] = mStr);
      }
    });
  }

  // Removed static clusterByGan pre-calculation here to support temporary clusters per date

  const HEB_DAYS = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

  const wb = new window.ExcelJS.Workbook();
  const headers = ['סיווג', 'עיר', 'רחוב', 'שם הצהרון', 'גיל', 'תאריך', 'יום', 'חוג/הפעלה', 'שם החוג', 'טלפון', "קב'", 'שעה', 'הערות', "אשכול מס'", 'רכז'];

  function _applyRowStyle(row, isWeekend, tp, name, cls, finalGrp, holName) {
    let eventColor = 'FFD9E1F2'; // Light blue default
    
    const holidayWords = ['חופש', 'חג', 'ראש השנה', 'כיפור', 'סוכות', 'פסח', 'שבועות', 'פורים', 'חנוכה', 'זיכרון', 'עצמאות', 'תשעה באב', 'תענית', 'ל"ג בעומר'];
    const campWords = ['קייטנת', 'קייטנה', 'בוקרון', 'יום ארוך'];
    
    const isHoliday = holidayWords.some(w => tp.includes(w) || (holName && holName.includes(w)));
    const isCamp = campWords.some(w => tp.includes(w) || name.includes(w) || (holName && holName.includes(w)));

    if (isWeekend) eventColor = 'FFFF0000'; // Red
    else if (isCamp) eventColor = 'FFF8CBAD'; // Orange
    else if (isHoliday && finalGrp === 0) eventColor = 'FFFFFF00'; // Yellow ONLY for holidays without activity

    let idColor = 'FFFCE4D6'; // Light Orange for Schools
    if (cls && cls.includes('גנים')) {
       idColor = 'FFE2EFDA'; // Light Green for Kindergartens
    }

    row.eachCell({ includeEmpty: true }, (c, colNum) => {
      c.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      if (colNum <= 3) {
         // Columns 1-3 (סיווג, עיר, רחוב)
         c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idColor } }; 
      } else if (colNum === 4 || colNum === 5) {
         // Columns 4-5 (שם הצהרון, גיל) are ALWAYS light blue regardless of weekend/holiday
         c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
      } else {
         // Columns 6+ change color based on day type (weekend, holiday, camp)
         if (eventColor) {
           c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: eventColor } };
         }
      }
    });
  }

  // Pre-compute all suppliers ONCE to prevent O(N^3) performance freeze inside the nested loops
  const allSupsPrecomputed = typeof window.getAllSup === 'function' ? window.getAllSup() : [];

  const rowsData = []; // Array to collect all rows for sorting

  // Iterate over every day in the year
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = window.d2s(d);
    
    const clusterByGanForDate = {};
    const dayClusters = typeof window.getClusters === 'function' ? window.getClusters(dateStr, dateStr) : Object.values(window.clusters || {});
    dayClusters.forEach(cl => {
      if (cl.gardenIds) {
        cl.gardenIds.forEach(gid => {
          if (!clusterByGanForDate[gid]) {
            clusterByGanForDate[gid] = cl.name;
          }
        });
      }
    });

    // Format date as Excel Date object to enable hierarchical date filtering
    const formattedDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0); 
    const dayName = `יום ${HEB_DAYS[d.getDay()]}`;
    const isWeekend = (d.getDay() === 5 || d.getDay() === 6);
    
    allGans.forEach(g => {
      const gEvs = (schByDateAndGan[dateStr] && schByDateAndGan[dateStr][g.id]) || [];
      const mgrName = mgrByGan[g.id] || '';
      const cls = g.cls || 'גנים';
      
      const hol = typeof window.getHolidayInfo === 'function' ? window.getHolidayInfo(dateStr, g.city, window.getGardenClass ? window.getGardenClass(g) : cls) : null;
      const holName = hol ? hol.name : '';

      if (gEvs.length > 0) {
        gEvs.forEach(ev => {
           const supName = (typeof window.supBase === 'function' ? window.supBase(ev.a) : ev.a) || ev.a || '';
           
           let phone = ev.p || '';
           if (!phone && window.supEx && window.supEx[supName] && window.supEx[supName].ph1) {
             phone = window.supEx[supName].ph1;
           }
           if (!phone && allSupsPrecomputed.length > 0) {
             const sObj = allSupsPrecomputed.find(s => s.name === supName || (s.fullNames && (s.fullNames.has ? s.fullNames.has(supName) : (s.fullNames.includes && s.fullNames.includes(supName)))));
             if (sObj && sObj.phone) phone = sObj.phone;
           }

           const cName = clusterByGanForDate[g.id] || g.cluster || '';
           
           let finalTp = ev.tp || 'חוג';
           if (finalTp === 'חוג') {
             if (cls && cls.includes('צהרון')) finalTp = 'חוג צהרון';
             else finalTp = 'חוג בוקר';
           }
           let fullActName = ev.a || '';
           if (ev.act && ev.act.trim()) {
             fullActName += ' - ' + ev.act.trim();
           }

           // Extract 'יום ארוך' or 'קייטנה' if it was mashed into the supplier name
           const mashedMatch = fullActName.match(/^(יום ארוך[\s\S]*?|קייטנת[\s\S]*?|קייטנה[\s\S]*?)(?=\s|-|מעשיותאטרון|פמיליסקיול|חוגות|תלתן|עליזה|חיים בתנועה|תל"ן|סל תרבות|$)/);
           if (mashedMatch) {
             finalTp = mashedMatch[1].trim();
             fullActName = fullActName.replace(mashedMatch[1], '').replace(/^-/, '').trim();
           }
           
           if (!fullActName) fullActName = finalTp; // fallback if it was entirely just 'יום ארוך'

           // User request: If it's a holiday and it was marked as 'חוג', override it to the holiday name
           if (finalTp === 'חוג' && holName) {
             finalTp = holName;
           }

           // Status logic mapping
           let statusNote = '';
           let finalGrp = parseInt(ev.grp) || 1;
           if (ev.st === 'nohap') {
             statusNote = 'לא התקיים';
             finalGrp = 0;
           } else if (ev.st === 'can') {
             statusNote = 'בוטל';
             finalGrp = 0;
           } else if (ev.st === 'post') {
             const linkedNext = (window.SCH || []).find(x => x.g === ev.g && x.a === ev.a && (x._postFrom === ev.d || x._makeupFrom === ev.d));
             let toDateStr = '';
             if (linkedNext && linkedNext.d) {
               const pts = linkedNext.d.split('-');
               if (pts.length === 3) toDateStr = `${pts[2]}/${pts[1]}/${pts[0]}`;
             }
             let verb = "נדחה";
              if (linkedNext && linkedNext.d && ev.d && linkedNext.d < ev.d) verb = "הוקדם";
              statusNote = toDateStr ? `${verb} ל-${toDateStr}` : verb;
             finalGrp = 0;
           }

           let finalNotes = (ev.nt || ev.n) ? String(ev.nt || ev.n).trim() : '';
           const isHandled = !!(ev._compByMakeup && ev._compByMakeup !== "false") || !!((ev.nt && /הוקדם ל|נדחה ל|הוזז ל|הקדמה ל|דחייה ל|עבר ל|עובר ל|הועבר ל|טופל/i.test(ev.nt)) || (ev.n && /הוקדם ל|נדחה ל|הוזז ל|הקדמה ל|דחייה ל|עבר ל|עובר ל|הועבר ל|טופל/i.test(ev.n)));
           if (statusNote) {
             // Avoid doubling the status note if the manual note already starts with a similar phrase
             if (finalNotes.includes('לא התקיים') || finalNotes.includes('בוטל')) {
               // Do not prepend statusNote if finalNotes already has the emoji/text from activity.js
             } else {
               finalNotes = finalNotes ? `${statusNote} - ${finalNotes}` : statusNote;
             }
           }
           
           const rVals = [
               cls, g.city || '', (g.add || g.st) || '', g.name || '', window.extractGardenAge(g),
               formattedDate, dayName, finalTp, fullActName, phone, finalGrp, ev.t || '', finalNotes,
               cName, mgrName
             ].map(v => v === '' ? null : v);
             
           rowsData.push({
             rowValues: rVals,
             dateObj: formattedDate,
             city: g.city || '',
             operator: fullActName,
             street: (g.add || g.st) || '',
             time: ev.t || '',
             isWeekend, finalTp, cls, finalGrp, holName,
             status: ev.st || '',
             isHandled: isHandled
           });
        });
      } else {
        const cName = clusterByGanForDate[g.id] || g.cluster || '';
        const rVals = [
            cls, g.city || '', (g.add || g.st) || '', g.name || '', window.extractGardenAge(g),
            formattedDate, dayName, holName || '', '', '', '', '', '', cName, mgrName
          ].map(v => v === '' ? null : v);
          
        rowsData.push({
          rowValues: rVals,
          dateObj: formattedDate,
          city: g.city || '',
          operator: '',
          street: (g.add || g.st) || '',
          time: '',
          isWeekend, finalTp: '', cls, finalGrp: 0, holName,
          status: ''
        });
      }
    });
  }

  // Helper to sort strings, pushing empty strings to the bottom
  const cmp = (valA, valB) => {
    if (valA === valB) return 0;
    if (!valA) return 1;
    if (!valB) return -1;
    return valA.localeCompare(valB, 'he');
  };

  // Sort rows per user requirement: Date -> City -> Operator -> Street -> Time
  rowsData.sort((a, b) => {
    if (a.dateObj.getTime() !== b.dateObj.getTime()) return a.dateObj.getTime() - b.dateObj.getTime();
    
    let r = cmp(a.city, b.city); if (r !== 0) return r;
    r = cmp(a.operator, b.operator); if (r !== 0) return r;
    r = cmp(a.street, b.street); if (r !== 0) return r;
    r = cmp(a.time, b.time); if (r !== 0) return r;
    
    return 0;
  });

  // Helper to generate a sheet
  function createSheet(sheetName, dataToRender) {
    const ws = wb.addWorksheet(sheetName, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });

    // Add headers
    ws.addRow(headers);
    ws.getColumn(6).numFmt = 'dd/mm/yy';

    const headerRow = ws.getRow(1);
    headerRow.eachCell(c => {
      c.font = { bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6E0B4' } }; // Light green
      c.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    });
    ws.autoFilter = 'A1:O1';
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    // Add rows
    dataToRender.forEach(data => {
      const r = ws.addRow(data.rowValues);
      _applyRowStyle(r, data.isWeekend, data.finalTp, data.operator, data.cls, data.finalGrp, data.holName);
    });

    // Exact column widths extracted from user's provided Excel file
    const colWidths = [
      5.125, 9, 31.125, 14.375, 9.375, 12, 9.25, 15, 27.125, 12.375, 5.125, 7.125, 30.25, 16, 16.75
    ];

    for (let i = 1; i <= headers.length; i++) {
      ws.getColumn(i).width = colWidths[i - 1] || 15;
    }
  }

  // 1. Create Main Sheet
  createSheet('תוכנית שנתית', rowsData);

  // 2. Create Shortages Sheet
  const shortagesData = rowsData.filter(d => {
    return d.status === 'nohap' && !d.isHandled;
  });
  createSheet('חוסרים להשלמה', shortagesData);

  try {
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const todayStr = window.d2s(new Date());
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `תוכנית_חוגים_${startYear}-${startYear+1}_${todayStr}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    window.showToast('✅ קובץ התוכנית השנתית יוצא בהצלחה!', 3000);
  } catch(e) {
    console.error(e);
    window.spAlert('שגיאה ביצירת קובץ אקסל');
  }
};

window._mrSelectedGardens = new Set();

window.toggleMrGardenMulti = function() {
  const list = document.getElementById('mr-garden-multi-list');
  if(!list) return;
  if(list.style.display === 'none' || !list.style.display) {
    list.style.display = 'block';
    window.renderMrGardenMultiItems();
  } else {
    list.style.display = 'none';
  }
};

window.renderMrGardenMultiItems = function() {
  const container = document.getElementById('mr-garden-multi-items');
  if(!container) return;
  const rawList = typeof AG === 'function' ? AG() : [...(window.GARDENS||[]), ...(window._GARDENS_EXTRA||[])];
  const gMap = new Map();
  rawList.forEach(g => gMap.set(String(g.id), g));
  const allGans = Array.from(gMap.values()).sort((a,b)=>(a.city||'').localeCompare(b.city||'','he') || (a.name||'').localeCompare(b.name||'','he'));
  
  const q = (document.getElementById('mr-garden-multi-search')?.value || '').trim().toLowerCase();
  
  // Preserve open states of cities before re-rendering
  const openStates = {};
  document.querySelectorAll('.mr-city-group').forEach(cg => {
    const cNameEl = cg.querySelector('.mr-city-name');
    const itemsEl = cg.querySelector('.mr-city-items');
    if(cNameEl && itemsEl && itemsEl.style.display === 'block') {
      const cityText = cNameEl.textContent.replace(/\s*\(\d+\)$/, '').trim();
      openStates[cityText] = true;
    }
  });
  
  const cityGroups = {};
  allGans.forEach(g => {
    const c = g.city || 'ללא עיר';
    const gName = (g.name||'').toLowerCase();
    const cName = c.toLowerCase();
    if(q && !gName.includes(q) && !cName.includes(q)) return;
    
    if(!cityGroups[c]) cityGroups[c] = [];
    cityGroups[c].push(g);
  });
  
  let html = '';
  Object.keys(cityGroups).sort((a,b)=>a.localeCompare(b,'he')).forEach(city => {
    const gans = cityGroups[city];
    const allChecked = gans.every(g => window._mrSelectedGardens.has(String(g.id)));
    const someChecked = gans.some(g => window._mrSelectedGardens.has(String(g.id)));
    const cityIdStr = gans.map(g=>g.id).join(',');
    
    const isOpen = q ? true : !!openStates[city];
    const displayStyle = isOpen ? 'block' : 'none';
    const toggleChar = isOpen ? '➖' : '➕';
    
    html += `
      <div class="mr-city-group" style="border-bottom:1px solid #e0e0e0;">
        <div style="display:flex;align-items:center;padding:6px 10px;background:#f0f4c3;font-weight:bold;cursor:pointer;" onclick="window.toggleMrCityItems(this)">
          <span style="width:20px;text-align:center;font-size:0.8rem" class="mr-city-toggle">${toggleChar}</span>
          <input type="checkbox" style="margin-left:8px;width:16px;height:16px;accent-color:#2e7d32" class="mr-city-cb" ${allChecked?'checked':''} ${someChecked&&!allChecked?'data-indeterminate="true"':''} onclick="event.stopPropagation(); window.toggleMrCity('${cityIdStr}', this)">
          <span style="font-size:0.85rem;flex:1;color:#1b5e20" class="mr-city-name">${city} (${gans.length})</span>
        </div>
        <div class="mr-city-items" style="display:${displayStyle};background:#fff;">
    `;
    
    gans.forEach(g => {
      const gId = String(g.id);
      const isChecked = window._mrSelectedGardens.has(gId);
      html += `
          <div class="mr-garden-item" style="display:flex;align-items:center;padding:5px 10px 5px 28px;cursor:pointer;border-bottom:1px solid #f5f5f5;" onclick="window.toggleMrGardenItem('${gId}', event)">
            <input type="checkbox" style="margin-left:8px;width:15px;height:15px;accent-color:#2e7d32" class="mr-g-cb" data-id="${gId}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); window.toggleMrGardenItem('${gId}', event)">
            <span style="font-size:0.82rem;color:#333">${g.name}</span>
          </div>
      `;
    });
    
    html += `</div></div>`;
  });
  
  if(!html) html = '<div style="padding:12px;text-align:center;color:#888;font-size:0.8rem">לא נמצאו גנים</div>';
  
  container.innerHTML = html;
  
  container.querySelectorAll('.mr-city-cb').forEach(cb => {
    if(cb.getAttribute('data-indeterminate')==='true') cb.indeterminate = true;
  });
  
  window.updateMrGardenMultiLabel();
};

window.toggleMrCityItems = function(el) {
  const itemsContainer = el.nextElementSibling;
  const toggleSpan = el.querySelector('.mr-city-toggle');
  if(itemsContainer.style.display === 'none') {
    itemsContainer.style.display = 'block';
    if(toggleSpan) toggleSpan.textContent = '➖';
  } else {
    itemsContainer.style.display = 'none';
    if(toggleSpan) toggleSpan.textContent = '➕';
  }
};

window.toggleMrCity = function(cityIdsStr, cbEl) {
  const isChecked = cbEl.checked;
  const ids = cityIdsStr.split(',');
  ids.forEach(id => {
    if(isChecked) window._mrSelectedGardens.add(String(id));
    else window._mrSelectedGardens.delete(String(id));
  });
  window.renderMrGardenMultiItems();
};

window.toggleMrGardenItem = function(gid, e) {
  if (e && e.target.tagName !== 'INPUT') {
    const cb = e.currentTarget.querySelector('input[type="checkbox"]');
    if(cb) cb.checked = !cb.checked;
  }
  gid = String(gid);
  if (window._mrSelectedGardens.has(gid)) {
    window._mrSelectedGardens.delete(gid);
  } else {
    window._mrSelectedGardens.add(gid);
  }
  window.renderMrGardenMultiItems();
};

window.filterMrGardenMulti = function() {
  window.renderMrGardenMultiItems();
};

window.clearMrGardenMulti = function() {
  window._mrSelectedGardens.clear();
  if(document.getElementById('mr-garden-multi-search')) {
    document.getElementById('mr-garden-multi-search').value = '';
  }
  window.renderMrGardenMultiItems();
};

window.updateMrGardenMultiLabel = function() {
  const lbl = document.getElementById('mr-garden-multi-label');
  if(!lbl) return;
  if(window._mrSelectedGardens.size === 0) {
    lbl.textContent = 'כל הגנים (השאר ריק עבור הכל)';
  } else {
    lbl.textContent = window._mrSelectedGardens.size + ' גנים נבחרו';
  }
};

document.addEventListener('click', e => {
  if(!e.target.closest('#mr-garden-multi-wrap')){
    const list = document.getElementById('mr-garden-multi-list');
    if(list) list.style.display = 'none';
  }
});

window.openMonthlyReportModal = function() {
  window._mrSelectedGardens.clear();
  if(document.getElementById('mr-garden-multi-search')) {
    document.getElementById('mr-garden-multi-search').value = '';
  }
  window.updateMrGardenMultiLabel();
  
  const today = new Date();
  const fst = new Date(today.getFullYear(), today.getMonth(), 1);
  const lst = new Date(today.getFullYear(), today.getMonth()+1, 0);
  if(document.getElementById('mr-from')) document.getElementById('mr-from').value = window.d2s(fst).replace(/\//g,'-');
  if(document.getElementById('mr-to')) document.getElementById('mr-to').value = window.d2s(lst).replace(/\//g,'-');
  
  window.OM('mr-m');
};

window.generateMonthlyReport = async function() {
  try {
    const fromEl = document.getElementById('mr-from');
    const toEl = document.getElementById('mr-to');
    if(!fromEl || !toEl || !fromEl.value || !toEl.value) {
      window.spAlert('יש לבחור טווח תאריכים');
      return;
    }
    
    const normD = (val) => {
      if (!val) return '';
      let v = String(val).trim();
      if (v.includes('T')) v = v.split('T')[0];
      const parts = v.split(/[\/\-\.]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) { // YYYY-MM-DD
          return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
        } else if (parts[2].length === 4) { // DD/MM/YYYY
          return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
      }
      return v;
    };
    
    const fromStr = normD(fromEl.value);
    const toStr = normD(toEl.value);
    const selG = Array.from(window._mrSelectedGardens || []).map(String);
    const incSup = document.getElementById('mr-inc-sup')?.checked || false;
    
    if(!fromStr || !toStr || fromStr > toStr) {
      window.spAlert('טווח תאריכים לא חוקי');
      return;
    }
    
    const evs = (window.SCH || []).filter(s => {
      if(selG.length > 0 && !selG.includes(String(s.g))) return false;
      if(!s.d) return false;
      const sd = normD(s.d);
      return sd >= fromStr && sd <= toStr;
    });
    
    if(!evs.length) {
      window.spAlert('לא נמצאו שיבוצים בטווח תאריכים זה במערכת');
      return;
    }
    
    const agg = {};
    evs.forEach(s => {
      const sd = normD(s.d);
      const parts = sd.split('-');
      const mKey = parts[0] + '-' + parts[1];
      const gKey = String(s.g) + '_' + mKey;
      if(!agg[gKey]) {
        let gName = String(s.g);
        let gCity = '';
        if(typeof window.G === 'function') {
          const gObj = window.G(s.g);
          if(gObj) {
            gName = gObj.name || gName;
            gCity = gObj.city || '';
          }
        }
        if(!gCity) {
          const found = window.G(s.g);
          if(found && found.id) {
            gName = found.name || gName;
            gCity = found.city || '';
          }
        }
        agg[gKey] = {
          gId: s.g,
          gName: gName,
          city: gCity,
          month: mKey,
          ok: 0,
          no: 0,
          sups: {}
        };
      }
      
      const st = s.st || 'ok';
      const isOk = st === 'ok' || st === 'done';
      if(isOk) {
        agg[gKey].ok++;
      } else {
        agg[gKey].no++;
      }
      
      if(incSup && s.a) {
        const supB = typeof window.supBase === 'function' ? window.supBase(s.a) : s.a;
        if(!agg[gKey].sups[supB]) agg[gKey].sups[supB] = 0;
        agg[gKey].sups[supB]++;
      }
    });
    
    const res = Object.values(agg).sort((a,b) => {
      if(a.city !== b.city) return (a.city||'').localeCompare(b.city||'', 'he');
      if(a.gName !== b.gName) return (a.gName||'').localeCompare(b.gName||'', 'he');
      return a.month.localeCompare(b.month);
    });
    
    const formatMonth = (mStr) => {
      const [y, m] = mStr.split('-');
      const hNames = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
      return `${hNames[parseInt(m,10)-1]} ${y}`;
    };
    
    const formatFDate = (str) => {
      const parts = normD(str).split('-');
      if(parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
      return String(str||'').replace(/[\/\.]/g,'-');
    };
    
    const dFrom = formatFDate(fromEl.value);
    const dTo = formatFDate(toEl.value);
    const excelLoaded = await (window.ensureExcelJSLoaded ? window.ensureExcelJSLoaded() : Promise.resolve(typeof window.ExcelJS !== 'undefined'));
    const fileNameBase = `דוח_סיכום_חודשי_${dFrom}_עד_${dTo}`;
    const reportTitle = `דו"ח סיכום פעילויות לתקופה ${dFrom.replace(/-/g,'/')} - ${dTo.replace(/-/g,'/')} עבור הגנים/בתי הספר`;
    
    const headers = ['עיר', 'גן', 'חודש', 'התקיים', 'לא התקיים', 'סה"כ שיבוצים'];
    if(incSup) headers.push('פירוט ספקים ופעילויות');
    
    if (excelLoaded && typeof window.ExcelJS !== 'undefined') {
      const workbook = new window.ExcelJS.Workbook();
      const ws = workbook.addWorksheet('דוח חודשי', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 3 }] });
      
      // Title row
      const titleRow = ws.addRow([reportTitle]);
      titleRow.font = { bold: true, size: 14, color: { argb: 'FF1B5E20' } };
      ws.mergeCells(1, 1, 1, incSup ? 7 : 6);
      titleRow.height = 30;
      titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
      
      // Empty spacer row
      ws.addRow([]);
      
      // Table headers row
      const headerRow = ws.addRow(headers);
      headerRow.font = { bold: true, size: 11 };
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      });
      headerRow.height = 24;
      
      res.forEach(r => {
        const row = [r.city, r.gName, formatMonth(r.month), r.ok, r.no, r.ok + r.no];
        if(incSup) {
          const supStrs = Object.keys(r.sups).map(k => `${r.sups[k]} ${k}`);
          row.push(supStrs.join(', ') || 'ללא ספק');
        }
        ws.addRow(row);
      });
      
      ws.columns.forEach((c, idx) => c.width = (idx === 5 && incSup) ? 50 : 18);
      
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${fileNameBase}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // Automatic CSV Fallback with UTF-8 BOM for Microsoft Excel Hebrew support
      let csv = '\uFEFF';
      csv += `"${reportTitle.replace(/"/g, '""')}"\n\n`;
      csv += headers.map(h => `"${h}"`).join(',') + '\n';
      res.forEach(r => {
        const row = [r.city, r.gName, formatMonth(r.month), r.ok, r.no, r.ok + r.no];
        if(incSup) {
          const supStrs = Object.keys(r.sups).map(k => `${r.sups[k]} ${k}`);
          row.push(supStrs.join(', ') || 'ללא ספק');
        }
        csv += row.map(v => `"${String(v||'').replace(/"/g, '""')}"`).join(',') + '\n';
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${fileNameBase}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    window.CM('mr-m');
  } catch(e) {
    console.error('Monthly report generation failed:', e);
    window.spAlert('שגיאה בהפקת הדוח: ' + e.message);
  }
};

window.ensureExcelJSLoaded = function() {
  if (typeof window.ExcelJS !== 'undefined') return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js';
    s.onload = () => resolve(typeof window.ExcelJS !== 'undefined');
    s.onerror = () => {
      const s2 = document.createElement('script');
      s2.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js';
      s2.onload = () => resolve(typeof window.ExcelJS !== 'undefined');
      s2.onerror = () => resolve(false);
      document.head.appendChild(s2);
    };
    document.head.appendChild(s);
  });
};
