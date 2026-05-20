const XLSX = require('xlsx');

// Let's read import_export.js and parse the exact file to see what happens
const fs = require('fs');

// We'll read the code from import_export.js and extract the _parseStatus function
const code = fs.readFileSync('import_export.js', 'utf8');

// Simple eval-like extraction or we can just copy the functions exactly as they are in import_export.js
function _parseStatus(rawGr, notes) {
  const grValue = (rawGr === undefined || rawGr === null) ? '' : String(rawGr).trim();
  const grNum = Number(grValue);
  
  let st = 'ok';
  let grp = 1;
  
  if (grValue === '' || grNum === 0 || isNaN(grNum)) {
    st = 'nohap';
    grp = 0;
  } else {
    st = 'ok';
    grp = Math.max(1, parseInt(grValue) || 1);
  }
  
  if (notes) {
    const lnt = notes.toLowerCase();
    if (/בוטל|מבוטל|מצב בטחוני|סגר|שביתה|מסיבת פורים/.test(lnt)) {
      st = 'can';
      grp = 0;
    }
    else if (/לא התקיים|הוקדם ל|נדחה ל|הוזז ל|עבר ל|עובר ל|חסר מדריך|מדריך חסר|לא הגיע|חוסר מדריך|אין מדריך|לא נשאר|עזב|חולה|נתקע|נתקעה|במחלה|מסיבות אישיות|לא יכול|לא יכל|לא מגיע|לא מרגיש טוב|לא עונה|לא הודיע|טעה ב|טעות ב|השלמה לא התקיימה|יושלם ב|הועבר ל|חשב ש|איחר לא|לא מתקיים/.test(lnt)) {
      st = 'nohap';
      grp = 0;
    }
  }
  
  return { st, grp };
}

const filePath = "C:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\חוגים\\תוכנית חוגים תשפ''ו.xlsx";

try {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets['חוסרים להשלמה'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  const cols = {
    date: 5, garden: 3, city: 1, supplier: 8, groups: 10,
    time: 11, notes: 12, actType: 7, cluster: -1, coordinator: -1,
    street: 2, cls: -1, phone: 9
  };
  
  console.log(`Parsed Rows count: ${rows.length}`);
  const parsedRecords = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 4) continue;
    
    // Check if the row has any content
    const hasContent = row.some(c => c !== null && c !== undefined && String(c).trim() !== '');
    if (!hasContent) continue;
    
    const rawGr = row[cols.groups];
    const notes = String(row[cols.notes] || '').trim();
    const { st, grp } = _parseStatus(rawGr, notes);
    
    parsedRecords.push({
      row: i + 1,
      garden: row[cols.garden],
      supplier: row[cols.supplier],
      notes,
      rawGr,
      parsedStatus: st,
      parsedGrp: grp
    });
  }
  
  console.log(`Total parsed records from sheet: ${parsedRecords.length}`);
  console.log("Records breakdown:");
  parsedRecords.forEach(r => {
    console.log(`Row ${r.row}: "${r.garden}" - "${r.supplier}" - notes: "${r.notes}" - gr: "${r.rawGr}" -> Status: ${r.parsedStatus}, Grp: ${r.parsedGrp}`);
  });
  
} catch (e) {
  console.error(e);
}
