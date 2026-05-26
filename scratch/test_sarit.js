const INVOICES = [
  { id: 1, supName: "שרית פילוסוף - בן צבי", orderDesc: "תקציב אפריל - נקודת חן", orderNum: "קופה קטנה" },
  { id: 2, supName: "שרית פילוסוף - בן צבי", orderDesc: "תקציב אפריל - סופר כרמים", orderNum: "קופה קטנה" },
  { id: 3, supName: "שרית פילוסוף - בן צבי", orderDesc: "תקציב מאי 2026 - נקודת חן", orderNum: "קופה קטנה" }
];

const file = {
  name: "קופה קטנה - שרית פילוסוף - בן צבי.pdf",
  path: "/04 אפריל 2026/קופה קטנה - שרית פילוסוף - בן צבי.pdf"
};

const numbersInName = file.name.match(/\d+/g) || [];
const isYear = (val) => { const num = parseInt(val, 10); return num >= 2010 && num <= 2035; };

const hasOnlyYearNumbers = numbersInName.filter(n => !isYear(n)).length === 0;
const isPettyCash = file.name.includes('קופה קטנה');

let explicitMonthFound = false;
let targetMonth = -1;
let targetYear = -1;
const hebMonths = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

const decodedPath = decodeURIComponent(file.path);
const matchHebPath = decodedPath.match(/(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s*(\d{4})?/);
if (matchHebPath) {
  targetMonth = hebMonths.indexOf(matchHebPath[1]);
  if (matchHebPath[2]) targetYear = parseInt(matchHebPath[2]);
  explicitMonthFound = true;
}

const cleanFileBase = file.name.replace(/[-_.]/g, ' ');

const getSupplierScore = (inv) => {
  let score = 0;
  const supplierBase = inv.supName;
  const ignoreWords = ['חוגים', 'סדנאות', 'הפעלות', 'תוכניות', 'גן', 'גני', 'בית', 'ספר', 'צהרון', 'צהרונים', 'מוסיקה', 'ספורט', 'תנועה', 'תיאטרון', 'תאטרון', 'חוג', 'פעילות', 'מחול', 'ריתמיקה'];
  const supplierWords = (supplierBase||'').split(/\s+/).filter(w => w.length > 2 && !ignoreWords.includes(w));
  
  if (cleanFileBase.includes(inv.supName)) return 4;
  if (cleanFileBase.includes(supplierBase)) return 3;
  if (supplierWords.length > 0 && supplierWords.some(w => cleanFileBase.includes(w))) return 1;
  return 0;
};

const matchedInfos = [];
let fileMatched = false;

if (isPettyCash) {
  INVOICES.forEach(inv => {
    const isInvPettyCash = inv.orderNum === 'קופה קטנה';
    if (!isInvPettyCash) return;
    
    const score = getSupplierScore(inv);
    if (score > 0) {
      let invMonth = -1;
      let invYear = -1;
      const matchHebDesc = String(inv.orderDesc||'').match(/(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)/);
      if (matchHebDesc) invMonth = hebMonths.indexOf(matchHebDesc[1]);
      
      console.log(`Evaluating ${inv.orderDesc}: invMonth=${invMonth}, targetMonth=${targetMonth}, score=${score}`);
      if (invMonth === targetMonth && (invYear === targetYear || targetYear === -1 || invYear === -1)) {
        matchedInfos.push({ inv, sec: 'tax', score: score + 10 });
        fileMatched = true;
      }
    }
  });
}

console.log("Matched Infos:", matchedInfos.length);
if (matchedInfos.length > 0) {
  const maxScore = Math.max(...matchedInfos.map(m => m.score));
  let bestMatches = matchedInfos.filter(m => m.score === maxScore);
  console.log("Best Matches:", bestMatches.length);
  const uniqueSuppliers = new Set(bestMatches.map(m => m.inv.supName));
  console.log("Unique Suppliers:", uniqueSuppliers.size);
}
