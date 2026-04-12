function openMonthlyExport(){
  const now=new Date();
  const y=now.getFullYear(), m=String(now.getMonth()+1).padStart(2,'0');
  document.getElementById('exp-from').value=`${y}-${m}`;
  document.getElementById('exp-to').value=`${y}-${m}`;
  // Cities
  const citySel=document.getElementById('exp-city');
  citySel.innerHTML='<option value="">-- כל הערים --</option>';
  cities().forEach(c=>{ const o=document.createElement('option');o.value=c;o.textContent=c;citySel.appendChild(o); });
  // Managers
  const mgrSel=document.getElementById('exp-mgr');
  mgrSel.innerHTML='<option value="">-- כל הרכזים --</option>';
  Object.values(managers).forEach(mg=>{ const o=document.createElement('option');o.value=mg.id;o.textContent=mg.name;mgrSel.appendChild(o); });
  // Gardens
  const ganSel=document.getElementById('exp-garden');
  ganSel.innerHTML='<option value="">-- בחר צהרון --</option>';
  const allGans=GARDENS.concat(_GARDENS_EXTRA||[]).sort((a,b)=>(a.city||'').localeCompare(b.city||'','he')||(a.name||'').localeCompare(b.name||'','he'));
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
  return Object.values(managers).find(m=>(m.gardenIds||[]).includes(gardenId))||null;
}

function doMonthlyExport(){
  const fromM=document.getElementById('exp-from').value;
  const toM=document.getElementById('exp-to').value;
  if(!fromM||!toM){alert('יש לבחור תקופה');return;}
  const mode=document.querySelector('input[name="exp-mode"]:checked').value;
  const cityFilter=document.getElementById('exp-city').value;
  const mgrFilter=document.getElementById('exp-mgr').value;
  const gardenFilter=parseInt(document.getElementById('exp-garden').value)||0;
  const splitBy=document.getElementById('exp-split').value;

  const [fy,fm]=fromM.split('-').map(Number);
  const [ty,tm]=toM.split('-').map(Number);
  const fromDate=`${fy}-${String(fm).padStart(2,'0')}-01`;
  const toDate=d2s(new Date(ty,tm,0));

  let evs=SCH.filter(s=>s.d>=fromDate&&s.d<=toDate); // include cancelled for export
  let gList=GARDENS.concat(_GARDENS_EXTRA||[]);

  if(mode==='city'&&cityFilter)   gList=gList.filter(g=>g.city===cityFilter);
  if(mode==='manager'&&mgrFilter){ const mgrObj=managers[mgrFilter]; if(mgrObj?.gardenIds) gList=gList.filter(g=>mgrObj.gardenIds.includes(g.id)); }
  if(mode==='garden'&&gardenFilter){ gList=gList.filter(g=>g.id===gardenFilter); }

  // For single-garden mode: always export as one file
  const effectiveSplit = (mode==='garden') ? 'garden' : splitBy;

  const byCity={};
  gList.forEach(g=>{ if(!byCity[g.city]) byCity[g.city]=[]; byCity[g.city].push(g); });

  let filesExported=0;
  if(effectiveSplit==='garden'){
    gList.forEach(g=>{
      const gEvs=evs.filter(s=>s.g===g.id);
      if(!gEvs.length){ if(mode==='garden') alert(`אין פעילויות לגן "${g.name}" בתקופה שנבחרה`); return; }
      downloadWB(buildGardenWB(g, gEvs, fromDate, toDate), `לוח_חוגים_${g.name}_${fromM}.xlsx`, fromM);
      filesExported++;
    });
  } else {
    Object.entries(byCity).forEach(([city,gardens])=>{
      const cityGardens=gardens.filter(g=>evs.some(s=>s.g===g.id));
      if(!cityGardens.length) return;
      downloadWB(buildCityWB(city, cityGardens, evs, fromDate, toDate), `לוח_חוגים_${city}_${fromM}.xlsx`, fromM);
      filesExported++;
    });
  }
  CM('export-m');
  if(filesExported>0) showToast(`📊 ${filesExported} קבצי Excel נוצרו בהצלחה!`);
  else if(mode!=='garden') alert('⚠️ לא נמצאו פעילויות בטווח התאריכים שנבחר.');
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

function downloadWB(wb, filename, fromM) {
  const safeFile = filename.replace(/[^\u0590-\u05FF\w\-_.]/gu, '_');
  const gardens = wb.sheets.map(s => s.garden);
  const allEvs  = wb.sheets.reduce((acc, s) => acc.concat(s.evs), []);
  if (!gardens.length) return;
  // Prefer explicit fromM param; fallback to first event date
  let fy, fm;
  if (fromM) {
    [fy, fm] = fromM.split('-').map(Number);
  } else {
    const firstDs = allEvs.length ? [...allEvs].sort((a,b)=>a.d.localeCompare(b.d))[0].d : d2s(new Date());
    [fy, fm] = firstDs.split('-').map(Number);
  }

  // Try ExcelJS first (supports images + RTL)
  if (typeof ExcelJS !== 'undefined' && !window._excelJSFailed) {
    console.log('📊 Using ExcelJS for export:', safeFile, 'year:', fy, 'month:', fm);
    _downloadWBExcelJS(gardens, allEvs, fy, fm - 1, safeFile);
    return;
  }
  // Fallback: SheetJS (no images)
  if (typeof XLSX !== 'undefined') {
    try {
      console.log('📊 Using SheetJS fallback for export');
      const workbook = XLSX.utils.book_new();
      const ws = buildStyledSheet(gardens, allEvs, fy, fm - 1);
      XLSX.utils.book_append_sheet(workbook, ws, 'לוח חוגים');
      XLSX.writeFile(workbook, safeFile);
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
    const workbook = new ExcelJS.Workbook();

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
    if (typeof LOGO_B64 !== 'undefined' && LOGO_B64)
      logoImgId = workbook.addImage({ base64: LOGO_B64, extension: 'png' });

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

    // ── one worksheet per garden ─────────────────────────────
    gardens.forEach((garden) => {
      const sheetName = garden.name.replace(/[*?:\[\]\/\\]/g,'').slice(0,31) || `גן${garden.id}`;
      const ws = workbook.addWorksheet(sheetName);

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

      const mgr = typeof managers !== 'undefined'
        ? Object.values(managers).find(m => (m.gardenIds||[]).includes(garden.id))
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

      let r = 0;

      // ── Excel Page Header: month+year top-right ─────────
      {
        const headerRight = `&"Arial,Bold"&18${monthTitle}`;
        ws.headerFooter.differentOddEven = false;
        ws.headerFooter.oddHeader  = `&R${headerRight}`;
        ws.headerFooter.evenHeader = `&R${headerRight}`;
      }

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
        const blk     = typeof blockedDates!=='undefined' ? blockedDates[ds] : null;
        const hol     = typeof getHolidayInfo==='function' ? getHolidayInfo(ds) : null;
        const dayName = `יום\u00a0${HEB_DAYS[dow]}`;
        const dateStr = `${day}/${month+1}/${String(year).slice(-2)}`;

        const dayEvs  = (byDate[ds]||[]).sort((a,b)=>(a.t||'').localeCompare(b.t||''));
        const specialNote = '';
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

          const supName = ev ? ((typeof supBase==='function'?supBase(ev.a):ev.a)||ev.a||'') : '';
          const evTpLabel = ev ? (ev.tp||'חוג') : '';
          const actName  = ev ? (ev.act||(typeof supAct==='function'?supAct(ev.a):'')||'') : '';
          const colF     = ev ? (actName?supName+' - '+actName:supName) : '';
          const phone    = ev ? (ev.p||(typeof supEx!=='undefined'&&supEx[supName]?.ph1)||'') : '';
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
    }); // end gardens.forEach

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
    showToast('📊 קובץ Excel נוצר!');
  } catch(e) {
    console.error('ExcelJS error:', e);
    alert('שגיאה ביצירת Excel: ' + e.message + '\n\nבדוק את ה-console לפרטים');
    _csvFallback({sheets: gardens.map(g => ({garden:g, evs:allEvs.filter(s=>s.g===g.id)}))}, filename);
  }
}

function _csvFallback(wb, filename) {
  const csvParts = [];
  wb.sheets.forEach(({garden, evs}) => {
    csvParts.push(`=== ${garden.name} ===`);
    const {rows} = buildSheetData(garden, evs);
    rows.forEach(r => csvParts.push(r.map(c => c==null?'':String(c).replace(/,/g,'،')).join(',')));
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
    const addr = XLSX.utils.encode_cell({r: row, c: col});
    const t = typeof value === 'number' ? 'n' : value instanceof Date ? 'd' : 's';
    ws[addr] = {v: value != null ? value : '', t: value != null ? t : 's', s: style || {}};
  }

  function dataRow(row, fillRgb, isLeftBorder) {
    // Apply full-row style with borders for all 9 columns
    for (let c = 0; c < 9; c++) {
      const addr = XLSX.utils.encode_cell({r: row, c});
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
      const blk    = blockedDates ? blockedDates[ds] : null;
      const hol    = typeof getHolidayInfo === 'function' ? getHolidayInfo(ds) : null;
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
          const supName = supBase(ev.a) || ev.a || '';
          const actType = ev.tp || 'חוג';
          const supData = SUPBASE ? SUPBASE.find(s=>(typeof supBase==='function'?supBase(s.name):s.name)===supName) : null;
          const phone   = ev.p || (supData&&supData.phone) || (supEx&&supEx[supName]&&supEx[supName].ph1) || '';
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

  ws['!ref']       = XLSX.utils.encode_range({s:{r:0,c:0},e:{r:r-1,c:8}});
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
      const supName = supBase(s.a)||s.a;
      rows.push([i===0?garden.name:null, null, i===0?ds:null, i===0?dayName:null,
        s.act||(typeof supAct==='function'?supAct(s.a):'')||'חוג',
        supName, s.p||'', s.grp||1, s.t?s.t.slice(0,5):''
      ]);
    });
  });
  return {rows};
}



// ─── Garden Cell Popup ────────────────────────────────────────
let _gcellGid=null, _gcellDs=null;

