const fs = require('fs');

const replacementScanner = `  // ── Step 4: Scan all selected folders
  window.showToast('⏳ סורק קבצים... נא להמתין', 60000);
  const filesFound = [];

  async function scanDir(handle, currentPath, cleanBase) {
    for await (const entry of handle.values()) {
      if (entry.kind === 'file') {
        if (!entry.name.startsWith('.') && !entry.name.startsWith('~')) {
          filesFound.push({
            name: entry.name,
            link: cleanBase + currentPath + '/' + encodeURIComponent(entry.name) + '?web=1'
          });
        }
      } else if (entry.kind === 'directory') {
        await scanDir(entry, currentPath + '/' + encodeURIComponent(entry.name), cleanBase);
      }
    }
  }

  try {
    for (const folder of selectedFolders) {
      await scanDir(folder.handle, '', folder.cleanBase);
    }
  } catch (scanErr) {
    window.spAlert('❌ שגיאה בסריקת הקבצים:\\n' + scanErr.message);
    return;
  }

  // ── Step 5: Match logic
  const globalOverwrite = selectedFolders.some(f => f.overwrite);
  let matchCount = 0;
  let skippedCount = 0;
  const resultsData = [['שם קובץ', 'חשבונית שויכה', 'ציון התאמה', 'סטטוס שיוך']];

  const hebMonths = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const isYear = (val) => { const num = parseInt(val, 10); return num >= 2020 && num <= 2030; };

  for (const file of filesFound) {
    const numbersInName = file.name.match(/\\d+/g) || [];
    const hasOnlyYearNumbers = numbersInName.filter(n => !isYear(n)).length === 0;
    const link = file.link;

    let bestInvoice = null;
    let bestType = null;
    let bestScore = -1000;

    for (const numStr of numbersInName) {
      if (numStr.length < 3) continue;
      
      const cleanNumStr = numStr.replace(/\\D/g, '').replace(/^0+/, '');
      const potentialMatches = window.INVOICES.filter(inv => 
        (inv.num && String(inv.num).replace(/\\D/g, '').replace(/^0+/, '') === cleanNumStr) ||
        (inv.txNum && String(inv.txNum).replace(/\\D/g, '').replace(/^0+/, '') === cleanNumStr) ||
        (inv.orderNum && String(inv.orderNum).replace(/\\D/g, '').replace(/^0+/, '') === cleanNumStr)
      );

      for (const inv of potentialMatches) {
        let type = null;
        if (inv.num && String(inv.num).replace(/\\D/g, '').replace(/^0+/, '') === cleanNumStr) type = 'tax';
        else if (inv.txNum && String(inv.txNum).replace(/\\D/g, '').replace(/^0+/, '') === cleanNumStr) type = 'tx';
        else if (inv.orderNum && String(inv.orderNum).replace(/\\D/g, '').replace(/^0+/, '') === cleanNumStr) type = 'order';

        let score = 50;
        
        if (inv.supName) {
          const supWords = String(inv.supName).split(/\\s+/).filter(w => w.length > 2);
          for (const word of supWords) {
            if (file.name.includes(word)) score += 20;
          }
        }

        if (type === 'tax' && (file.name.includes('מס') || file.name.toLowerCase().includes('tax'))) score += 5;
        if (type === 'tx' && (file.name.includes('קבלה') || file.name.toLowerCase().includes('tx'))) score += 5;
        if (type === 'order' && (file.name.includes('הזמנה') || file.name.includes('דרישה'))) score += 5;

        const existing = inv['file_' + type];
        const hasPath = !!(existing && existing.path);
        
        if (hasPath && !globalOverwrite) {
          score -= 500;
        }

        if (score > bestScore) {
          bestScore = score;
          bestInvoice = inv;
          bestType = type;
        }
      }
    }

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
            if (hasPath && !globalOverwrite) score -= 500;
            
            if (score > bestScore) {
              bestScore = score;
              bestInvoice = inv;
              bestType = type;
            }
          }
        }
      }
    }

    let matchedInvoice = bestScore > -200 ? bestInvoice : null;
    let matchedType = bestScore > -200 ? bestType : null;

    if (matchedInvoice) {
      if (bestScore < 0) {
         resultsData.push([file.name, \`\${matchedInvoice.orderDesc || matchedInvoice.supName}\`, bestScore, 'דלג (קישור קיים)']);
         skippedCount++;
      } else {
         matchedInvoice['file_' + matchedType] = { path: file.link, origin: 'sp' };
         resultsData.push([file.name, \`\${matchedInvoice.orderDesc || matchedInvoice.supName} (\${matchedType})\`, bestScore, 'שויך']);
         matchCount++;
      }
    } else {
      resultsData.push([file.name, '---', bestScore, 'לא נמצאה התאמה']);
    }
  }

`;

let content = fs.readFileSync('invoices.js', 'utf8');
const startStr = '  // ── Step 4: Scan all selected folders';
const endStr = '  // ── Step 6: Save & render';
const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.slice(0, startIndex) + replacementScanner + '\\n' + content.slice(endIndex);
  fs.writeFileSync('invoices.js', content, 'utf8');
  console.log('Successfully patched invoices.js!');
} else {
  console.log('Failed to find boundaries in invoices.js!');
}
