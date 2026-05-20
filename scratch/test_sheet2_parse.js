const XLSX = require('xlsx');

// Mock a minimal environment to run the exact logic
const utils = {
  findGarden(gardenName, city) {
    // Return a dummy garden so we don't fail garden checks for now, or just return true-ish
    return { id: 100, name: gardenName, city };
  },
  findSupplier(rawSupplier, allSups) {
    return { name: rawSupplier };
  },
  norm(s) {
    return (s || '').toLowerCase().trim();
  },
  getEventId(d, g, sBase, sAct, t) {
    return `${d}|${g}|${sBase}|${t}`;
  }
};

const _detectHeaders = (rows) => {
  let bestHeader = null;
  let bestScore = 0;

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const r = rows[i];
    if (!r || !Array.isArray(r)) continue;

    const cols = {
      date: -1, garden: -1, city: -1, supplier: -1, groups: -1,
      time: -1, notes: -1, actType: -1, cluster: -1, coordinator: -1,
      street: -1, cls: -1, phone: -1
    };
    let score = 0;

    r.forEach((c, idx) => {
      if (!c) return;
      const n = String(c).trim().toLowerCase().replace(/['"״׳]/g, '');

      if (/^תאריך$|^date$/.test(n)) { cols.date = idx; score += 3; }
      else if (/שם הצהרון|שם הגן|^גן$|garden/.test(n)) { cols.garden = idx; score += 3; }
      else if (/^עיר$|^city$/.test(n)) { cols.city = idx; score += 2; }
      else if (/שם החוג|^ספק$|^חוג$|supplier/.test(n)) { cols.supplier = idx; score += 3; }
      else if (/^קב|קבוצות|groups/.test(n)) { cols.groups = idx; score += 3; }
      else if (/^שעה$|^time$/.test(n)) { cols.time = idx; score += 2; }
      else if (/^הערות$|^notes$/.test(n)) { cols.notes = idx; score += 2; }
      else if (/חוג.*הפעלה|הפעלה|סוג פעילות/.test(n)) { cols.actType = idx; score += 1; }
      else if (/אשכול/.test(n)) { cols.cluster = idx; score += 1; }
      else if (/^רכז$|coordinator/.test(n)) { cols.coordinator = idx; score += 1; }
      else if (/^רחוב$|^כתובת$|street/.test(n)) { cols.street = idx; score += 1; }
      else if (/^סיווג$|^סוג$/.test(n)) { cols.cls = idx; score += 1; }
      else if (/טלפון|phone/.test(n)) { cols.phone = idx; score += 1; }
    });

    if (score > bestScore && cols.date !== -1 && cols.garden !== -1) {
      bestScore = score;
      bestHeader = { headerRow: i, cols };
    }
  }
  return bestHeader;
};

const _parseDate = (rd) => {
  if (!rd) return null;
  let d = '';
  if (rd instanceof Date) {
    d = new Date(rd.getTime() + 12*3600000).toISOString().slice(0, 10);
  } else if (typeof rd === 'number') {
    d = new Date(new Date(1899,11,30).getTime() + rd*86400000 + 12*3600000).toISOString().slice(0, 10);
  } else if (typeof rd === 'string') {
    const m = rd.match(/(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})/);
    if (m) d = `${m[3].length===2?'20'+m[3]:m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return d;
};

const _parseTime = (rt) => {
  if (!rt) return '14:00';
  if (typeof rt === 'number') {
    const mTot = Math.round(rt * 1440);
    return `${Math.floor(mTot/60).toString().padStart(2,'0')}:${(mTot%60).toString().padStart(2,'0')}`;
  }
  const tm = String(rt).trim().match(/(\d{1,2}):(\d{1,2})/);
  if (tm) return tm[1].padStart(2,'0') + ':' + tm[2].padStart(2,'0');
  return '14:00';
};

const _parseStatus = (rawGr, notes) => {
  let st = 'ok';
  let grp = 1;
  const nStr = (notes || '').trim();

  // Try to extract group count
  if (rawGr !== undefined && rawGr !== null && rawGr !== '') {
    const parsed = parseInt(rawGr, 10);
    if (!isNaN(parsed)) grp = parsed;
  } else {
    // Look for patterns like "2 קבוצות" or "3 קב'" in notes
    const grMatch = nStr.match(/(\d+)\s*(קבוצות|קבוצה|קב['״׳]?)/);
    if (grMatch) grp = parseInt(grMatch[1], 10);
  }

  // Parse status based on notes/labels
  if (nStr) {
    const low = nStr.toLowerCase();
    if (low.includes('לא התקיים') || low.includes('לא יתקיים') || low.includes('מבוטל') || low.includes('בוטל') || low.includes('אין חוג')) {
      st = 'nohap';
    } else if (low.includes('השלמה') || low.includes('יושלם') || low.includes('הושלם')) {
      st = 'ok'; // or keep as ok/makeup
    }
  }
  return { st, grp };
};

const filePath = "C:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\חוגים\\תוכנית חוגים תשפ''ו.xlsx";

try {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets['חוסרים להשלמה'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const headerInfo = _detectHeaders(rows);
  console.log("Header info:", headerInfo);
  
  if (headerInfo) {
    const { headerRow, cols } = headerInfo;
    const parsedRows = [];
    let noDateCount = 0;
    
    for (let i = headerRow + 1; i < Math.min(rows.length, 100); i++) {
      const row = rows[i];
      if (!row || row.length < 4) continue;
      const d = _parseDate(row[cols.date]);
      if (!d) { noDateCount++; continue; }
      
      const gardenName = String(row[cols.garden] || '').trim();
      const city = String(row[cols.city] || '').trim();
      const rawSupplier = String(row[cols.supplier] || '').trim();
      const t = _parseTime(row[cols.time]);
      const rawGr = row[cols.groups];
      const notes = String(row[cols.notes] || '').trim();
      const { st, grp } = _parseStatus(rawGr, notes);
      
      parsedRows.push({
        row: i + 1,
        date: d,
        gardenName,
        city,
        supplier: rawSupplier,
        time: t,
        notes,
        status: st,
        groups: grp
      });
    }
    
    console.log(`Parsed ${parsedRows.length} rows out of first 100 rows. NoDateCount: ${noDateCount}`);
    console.log("Sample parsed rows:", parsedRows.slice(0, 10));
  }
} catch (e) {
  console.error(e);
}
