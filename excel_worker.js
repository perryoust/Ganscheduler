importScripts('https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js');

onmessage = async function(e) {
  const { invoices, suppliers, vat, from, to, supF, typeF, assignF, cityF, filename } = e.data;

  // Filter invoices exactly as before
  let list = [...invoices];
  if(from)   list = list.filter(i=>(i.orderDate||i.txDate||i.date||'')>=from);
  if(to)     list = list.filter(i=>(i.orderDate||i.txDate||i.date||'')<=to);
  if(supF)   list = list.filter(i=>(i.supName||'').toLowerCase().includes(supF));
  if(typeF)  list = list.filter(i=>i.orderType===typeF);
  if(assignF)list = list.filter(i=>i.assignment===assignF);
  if(cityF)  list = list.filter(i=>(i.locCity||'').toLowerCase().includes(cityF));

  const _INV_ASSIGN_LABELS = {
    shared:'משותף', daycare:'צהרונים', chanuka:'חנוכה', pesach:'פסח',
    longday:'יום ארוך', summer:'קייטנת קיץ', general:'כללי'
  };
  const _INV_TYPE_LABELS = {
    enrichment:'העשרה', operations:'תפעול', breakfast:'ארוחות בוקר',
    transport:'נסיעות', other:'אחר'
  };
  const _INV_LOC_LABELS = {
    garden:'גנים', school:'בתי ספר', joint:'משותף', office:'משרדים'
  };
  const _MONTH_LABELS = {
    '01':'ינואר','02':'פברואר','03':'מרץ','04':'אפריל','05':'מאי','06':'יוני',
    '07':'יולי','08':'אוגוסט','09':'ספטמבר','10':'אוקטובר','11':'נובמבר','12':'דצמבר'
  };

  const rows = list.map(i=>{
    const v = i.vat || vat;
    const isExempt = v === 0 || (suppliers[i.supName] || {}).entityType === 'עוסק פטור' || (suppliers[i.supName] || {}).entityType === 'עמותה';
    const calcTot = (base) => base ? (isExempt ? base : +(base * (1 + v / 100)).toFixed(2)) : '';
    const orderTot = i.orderTotal || calcTot(i.orderAmt) || '';
    const txBase   = i.txAmt  || '';
    const txTot    = i.txTotal  || calcTot(i.txAmt)  || '';
    const taxBase  = i.amt    || '';
    const taxTot   = i.total   || calcTot(i.amt)   || '';
    return {
      'מספר הזמנה':          i.orderNum||'',
      'תאריך הזמנה':         i.orderDate||'',
      'שם הספק':             i.supName||'',
      'פירוט':               i.orderDesc||'',
      'סיווג הרכישה':        _INV_TYPE_LABELS[i.orderType]||'',
      'שיוך הרכישה':         _INV_ASSIGN_LABELS[i.assignment]||i.assignment||'',
      'חודש פעילות':         _MONTH_LABELS[i.actMonth]||'',
      'עיר':                 i.locCity||'',
      'סוג מוסד':            _INV_LOC_LABELS[i.locType]||'',
      'שם גן-ביהס':          i.locName||'',
      'סהכ הזמנה כולל מעמ':  orderTot,
      'הערות הזמנה':         i.orderNotes||'',
      'מס חשבון עסקה':        i.txNum||'',
      'תאריך חשבון עסקה':    i.txDate||'',
      'סכום עסקה לפני מעמ':  txBase,
      'סכום עסקה כולל מעמ':  txTot,
      'מס חשבונית / קבלה':   i.num||'',
      'תאריך חשבונית':       i.date||'',
      'סכום חשבונית לפני מעמ':  taxBase,
      'סכום חשבונית כולל מעמ':  taxTot,
      'הערות':               i.notes||''
    };
  });

  if(!rows.length) {
    postMessage({ error: 'אין נתונים לייצוא' });
    return;
  }

  const dataKeys = Object.keys(rows[0]);
  const headers  = ['#', ...dataKeys];
  const colWidths = {
    '#':5,
    'מספר הזמנה':16,'תאריך הזמנה':14,'שם הספק':22,'פירוט':30,
    'סיווג הרכישה':15,'שיוך הרכישה':17,'חודש פעילות':14,'עיר':13,
    'סוג מוסד':13,'שם גן-ביהס':22,'סהכ הזמנה כולל מעמ':17,
    'הערות הזמנה':22,'מס חשבון עסקה':16,'תאריך חשבון עסקה':14,
    'סכום עסקה לפני מעמ':17,'סכום עסקה כולל מעמ':17,
    'מס חשבונית / קבלה':16,'תאריך חשבונית':14,
    'סכום חשבונית לפני מעמ':18,'סכום חשבונית כולל מעמ':18,'הערות':22
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'GanManager';
  const ws = wb.addWorksheet('חשבוניות', {
    views:[{rightToLeft:true, state:'frozen', ySplit:1, activeCell:'A2'}],
    properties:{defaultRowHeight:18}
  });

  ws.columns = headers.map(h=>({key:h, width:colWidths[h]||14}));

  ws.addTable({
    name: 'InvoicesTable',
    ref:  'A1',
    headerRow: true,
    totalsRow: false,
    style: {theme:'TableStyleMedium2', showRowStripes:true},
    columns: headers.map(h=>({name:h, filterButton:true})),
    rows: rows.map((r,idx)=>[idx+1, ...dataKeys.map(k=>r[k]??'')])
  });

  const hRow = ws.getRow(1);
  hRow.height = 22;
  hRow.eachCell({includeEmpty:true}, cell=>{
    cell.font      = {bold:true, color:{argb:'FFFFFFFF'}, size:10, name:'Arial'};
    cell.fill      = {type:'pattern', pattern:'solid', fgColor:{argb:'FF1A237E'}};
    cell.alignment = {horizontal:'right', vertical:'middle', readingOrder:'rightToLeft'};
    cell.border    = {
      top:{style:'thin',color:{argb:'FF9E9E9E'}},
      bottom:{style:'medium',color:{argb:'FF9E9E9E'}},
      left:{style:'thin',color:{argb:'FF9E9E9E'}},
      right:{style:'thin',color:{argb:'FF9E9E9E'}}
    };
  });

  for(let i=0; i<rows.length; i++){
    const dRow = ws.getRow(i+2);
    dRow.eachCell({includeEmpty:true}, cell=>{
      cell.alignment = {horizontal:'right', vertical:'middle', readingOrder:'rightToLeft'};
      cell.font = {size:9.5, name:'Arial'};
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  postMessage({ buffer: buf, filename });
};
