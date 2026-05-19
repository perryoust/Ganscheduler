const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/Perry/רשת תיכוני טומשין בע מ (חל ץ)/צהרונים - מסמכים/פרי/רכש/דוח הזמנות רכש וחשבוניות.xlsx');
const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

let headerRowIndex = 0;
let isComplexFormat = false;
for (let i = 0; i < Math.min(5, rawRows.length); i++) {
  const rowCells = rawRows[i].filter(c => c !== null && c !== undefined && c !== '').length;
  if (rowCells > 5 && rawRows[i].some(c => String(c).includes('ספק'))) {
    headerRowIndex = i;
    const headerStrs = rawRows[i].map(x => String(x || '').trim());
    if (headerStrs.filter(x => x === 'הערות').length > 1 || headerStrs.filter(x => x.includes('מע"מ')).length > 2) {
      isComplexFormat = true;
    }
    break;
  }
}

let added = 0;
for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
  const row = rawRows[i];
  if (!row || row.length === 0) continue;

  const item = {};
  if (isComplexFormat) {
    const colMapping = [
      null, 'orderNum', 'orderDate', 'supName', 'orderDesc', 'orderType', 'orderAssign', 'orderMonth', 'locCity', 'locType', 'locName', 'orderTotal', 'orderNotes', 'txNum', 'txDate', 'txAmt', 'txTotal', 'num', 'date', 'amt', 'total', 'notes'
    ];
    colMapping.forEach((key, colIdx) => {
      if (key) item[key] = row[colIdx];
    });
  }
  if (!item.supName) continue;
  added++;
}
console.log('headerRowIndex:', headerRowIndex);
console.log('isComplexFormat:', isComplexFormat);
console.log('Added:', added);
