const fs = require('fs');
let content = fs.readFileSync('invoices.js', 'utf8');

const fallbackBlock = `
    if (bestScore < 0) {
      let explicitMonthFound = false;
      let targetMonth = -1;
      let targetYear = -1;
      
      const decodedLink = decodeURIComponent(link);
      const matchHebName = file.name.match(/(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\\s*(\\d{4})?/) || 
                           decodedLink.match(/(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\\s*(\\d{4})?/);
                           
      if (matchHebName) {
        targetMonth = hebMonths.indexOf(matchHebName[1]);
        if (matchHebName[2]) targetYear = parseInt(matchHebName[2]);
        explicitMonthFound = true;
      }
      
      const isPettyCash = file.name.includes('קופה קטנה');
      const isGett = file.name.includes('גט') && file.name.includes('טקסי');
      
      if (isPettyCash || isGett || (hasOnlyYearNumbers && explicitMonthFound)) {
        if (targetYear === -1) {
          const yearMatch = file.name.match(/\\b(202\\d)\\b/) || decodedLink.match(/\\b(202\\d)\\b/);
          targetYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
        }
        
        for (const inv of window.INVOICES) {
          const isInvPettyCash = inv.orderNum === 'קופה קטנה' || String(inv.notes||'').includes('קופה קטנה') || String(inv.txNum||'').includes('קופה קטנה') || String(inv.orderDesc||'').includes('קופה קטנה');
          if (isPettyCash && !isInvPettyCash) continue;
          
          let supplierScore = 0;
          if (inv.supName) {
             const baseName = window.supBase ? window.supBase(inv.supName) : inv.supName;
             if (file.name.includes(baseName) || file.name.includes(inv.supName)) supplierScore = 20;
             else {
               const firstWord = String(inv.supName).split(/\\s+/).filter(w=>w.length>2)[0];
               if (firstWord && file.name.includes(firstWord)) supplierScore = 10;
             }
          }
          if (isPettyCash && supplierScore === 0) supplierScore = 10;
          if (isGett && supplierScore === 0) supplierScore = 10;

          if (supplierScore === 0) continue; 
          
          let invMonth = -1;
          let invYear = -1;
          
          if (inv.date) {
            let invDate = new Date(inv.date);
            const dStr = String(inv.date);
            if (dStr.includes('/')) {
              const parts = dStr.split('/');
              if (parts.length === 3) invDate = new Date(\`\${parts[2]}-\${parts[1]}-\${parts[0]}\`);
            }
            if (!isNaN(invDate.getMonth())) {
              invMonth = invDate.getMonth();
              invYear = invDate.getFullYear();
            }
          }
          if (invMonth === -1) {
            const matchHebDesc = String(inv.orderDesc||'').match(/(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)/);
            if (matchHebDesc) invMonth = hebMonths.indexOf(matchHebDesc[1]);
          }
          
          let monthDiff = (invMonth !== -1 && targetMonth !== -1) ? Math.abs(invMonth - targetMonth) : 99;
          
          if (invYear === targetYear || targetYear === -1 || invYear === -1) {
            let score = 20 + supplierScore;
            if (monthDiff === 0) score += 30;
            else if (monthDiff <= 1) score += 10;
            else score -= 20;
            
            let type = 'order';
            if (inv.orderNum) type = 'order';
            else if (inv.num) type = 'tax';
            else if (inv.txNum) type = 'tx';
            
            const existing = inv['file_' + type];
            const hasPath = !!(existing && existing.path);
            if (hasPath && !globalOverwrite) score -= 100;
            
            if (score > bestScore) {
              bestScore = score;
              bestInvoice = inv;
              bestType = type;
            }
          }
        }
      }
    }
`;

const endStr = '    let matchedInvoice = bestScore > -500 ? bestInvoice : null;';

const endIndex = content.indexOf(endStr);
if (endIndex !== -1) {
  content = content.slice(0, endIndex) + fallbackBlock + '\n' + content.slice(endIndex);
} else {
  console.log('Failed to find endStr for fallback block');
}

fs.writeFileSync('invoices.js', content, 'utf8');
console.log('invoices.js patched successfully again');
