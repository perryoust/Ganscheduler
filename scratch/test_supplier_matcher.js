const fs = require('fs');

const utils = {
  norm: function(s) {
    if (!s) return '';
    let str = s.toString()
      .trim()
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
      .replace(/["'״׳]/g, '')
      .replace(/\s+/g, ' ')
      .toLowerCase();
    return str;
  },
  megaClean: function(s) {
    if (!s) return '';
    let str = this.norm(s);
    str = str.replace(/\([^)]*\)/g, '').trim();
    const prefixes = ['גן', 'צהרון', 'ביהס', 'ביס', 'ביתספר', 'בית ספר'];
    for (let p of prefixes) {
      if (str.startsWith(p)) {
        str = str.substring(p.length).trim();
        break;
      }
    }
    str = str.split(' - ')[0].split(' / ')[0].split('-')[0].trim();
    return str;
  }
};

const isSupplierNameMatch = (fileName, supName) => {
  if (!supName) return false;
  
  const normFile = utils.norm(fileName);
  const normSup = utils.norm(supName);
  
  // 1. Direct inclusion both ways
  if (normFile.includes(normSup) || normSup.includes(normFile)) return true;
  
  // 2. Split by dash/slash and check parts
  const fileParts = fileName.split(/[-\u2013\u2014\/]/).map(p => utils.norm(p).trim()).filter(Boolean);
  const supParts = supName.split(/[-\u2013\u2014\/]/).map(p => utils.norm(p).trim()).filter(Boolean);
  
  for (const fPart of fileParts) {
    if (fPart.length < 3) continue;
    for (const sPart of supParts) {
      if (sPart.length < 3) continue;
      if (fPart.includes(sPart) || sPart.includes(fPart)) return true;
    }
  }
  
  // 3. MegaClean comparison
  const mcFile = utils.megaClean(fileName);
  const mcSup = utils.megaClean(supName);
  if (mcFile && mcSup) {
    if (mcFile.includes(mcSup) || mcSup.includes(mcFile)) return true;
  }
  
  // 4. Check if the supplier name and file name share a significant unique word (length >= 4)
  const genericWords = ['חוגים', 'צהרונים', 'פעילות', 'בעמ', 'מכון', 'מרכז', 'קבוצת', 'חברת', 'גנים', 'ילדים', 'תקציב', 'אפריל', 'פברואר', 'ינואר', 'מרץ', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const supWords = normSup.split(/[\s\-–—/()]/).map(w => w.trim()).filter(w => w.length >= 4);
  for (const word of supWords) {
    if (genericWords.includes(word)) continue;
    if (normFile.includes(word)) return true;
  }
  
  return false;
};

// Test cases
const testCases = [
  { file: "דרך הספורט - גנים - פברואר 2026 - חשבון עסקה 113 חשבונית מס 10616.pdf", sup: "דרך הספורט", expected: true },
  { file: "פמיליסקול - גני ילדים - מאי 2025 - דרישת תשלום 1016 חשבונית מס 10046.pdf", sup: "אורנה בכור - הקסם של אורנה", expected: false },
  { file: "אורנה בכור - חוגים - גני ילדים - אפריל 2026 - קבלה 0328.pdf", sup: "אורנה בכור - הקסם של אורנה", expected: true },
  { file: "פמיליסקול - גני ילדים - מאי 2025 - דרישת תשלום 1016 חשבונית מס 10046.pdf", sup: "פמיליסקול", expected: true },
  { file: "מוראל אייזנברג - חשבון עסקה 123.pdf", sup: "בלאק אנד וויט - מוראל אייזנברג", expected: true },
  { file: "דרך הספורט - גנים - פברואר 2026 - חשבון עסקה 113.pdf", sup: "אלעד דרך הספורט", expected: true }
];

testCases.forEach((tc, idx) => {
  const result = isSupplierNameMatch(tc.file, tc.sup);
  console.log(`Test ${idx + 1}: File "${tc.file}" vs Supplier "${tc.sup}" => Result: ${result} (Expected: ${tc.expected}) - ${result === tc.expected ? '✅ PASS' : '❌ FAIL'}`);
});
