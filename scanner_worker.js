onmessage = function(e) {
  const { filesFound, invoices, supEx, globalOverwrite, spScannerAliases, currentYear } = e.data;

  let matchCount = 0;
  let skippedCount = 0;
  const resultsData = [['שם קובץ', 'חשבונית שויכה', 'ציון התאמה', 'סטטוס שיוך']];
  const matchedInvoicesToUpdate = [];

  const hebMonths = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

  const cleanSupText = (str) => {
    return String(str || '').toLowerCase()
      .replace(/["'״׳`]/g, '')
      .replace(/\s*\(?\s*בע[\s.]*מ\s*\)?\s*/gi, ' ')
      .replace(/\s*\(?\s*ltd\.?\s*\)?\s*/gi, ' ')
      .replace(/[-_.,()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  for (let i = 0; i < filesFound.length; i++) {
    const file = filesFound[i];
    
    // Post progress
    if (i % 5 === 0) {
      postMessage({ type: 'progress', percent: Math.round((i / filesFound.length) * 100) });
    }
    
    const decodedLink = decodeURIComponent(file.link);
    const fullText = file.name + ' ' + decodedLink;
    const cleanFull = cleanSupText(fullText);

    // Ignore non-invoice generic files (stickers, address lists, logo sheets, etc.)
    const isGenericNonInvoice = ['רשימת כתובות', 'מדבקות', 'מדבקת', 'לוגו', 'מערכת שעות', 'סידור עבודה', 'נוכחות'].some(ign => cleanFull.includes(ign));
    if (isGenericNonInvoice && !cleanFull.includes('חשבונית') && !cleanFull.includes('עסקה') && !cleanFull.includes('קבלה') && !cleanFull.includes('הזמנ')) {
      continue;
    }
    
    const extractedNumbers = [];
    const addNum = (str, ctx) => {
      if (!str) return;
      const clean = str.replace(/\D/g, '').replace(/^0+/, '') || '0';
      if (!extractedNumbers.some(n => n.clean === clean && n.context === ctx)) {
        extractedNumbers.push({ raw: str, clean: clean, context: ctx });
      }
    };

    const taxMatch = fullText.match(/(?:חשבונית\s*מס|חשבונית|קבלה|tax)[^\d]*([\d][\d\-_/]*)/gi);
    if (taxMatch) taxMatch.forEach(m => { 
      const d = m.match(/[\d][\d\-_/]*/); 
      if(d) {
        addNum(d[0], 'tax');
        const parts = d[0].split(/[\-_/]/);
        if (parts.length > 1) {
          parts.forEach(p => { if (p) addNum(p, 'tax'); });
        }
      } 
    });

    const txMatch = fullText.match(/(?:חשבונית\s*עסקה|חשבון\s*עסקה|דרישה|דרישת\s*תשלום|tx)[^\d]*([\d][\d\-_/]*)/gi);
    if (txMatch) txMatch.forEach(m => { 
      const d = m.match(/[\d][\d\-_/]*/); 
      if(d) {
        addNum(d[0], 'tx');
        const parts = d[0].split(/[\-_/]/);
        if (parts.length > 1) {
          parts.forEach(p => { if (p) addNum(p, 'tx'); });
        }
      } 
    });

    const orderMatch = fullText.match(/(?:הזמנה|הזמנת\s*רכש|הזמנת\s*עבודה)[^\d]*([\d][\d\-_/]*)/gi);
    if (orderMatch) orderMatch.forEach(m => { 
      const d = m.match(/[\d][\d\-_/]*/); 
      if(d) {
        addNum(d[0], 'order');
        const parts = d[0].split(/[\-_/]/);
        if (parts.length > 1) {
          parts.forEach(p => { if (p) addNum(p, 'order'); });
        }
      } 
    });

    // Match continuous long numbers (6-15 digits like 0123082026, 10030071960, 0410306007453)
    const longDigitMatch = fullText.match(/\d{6,15}/g);
    if (longDigitMatch) longDigitMatch.forEach(m => addNum(m, 'order'));

    const allNums = file.name.match(/\d+/g) || [];
    allNums.forEach(num => {
       const clean = num.replace(/\D/g, '').replace(/^0+/, '') || '0';
       if (!extractedNumbers.some(n => n.clean === clean)) {
         addNum(num, 'any');
       }
    });

    const hyphenatedNums = file.name.match(/[\d]+(?:[-/][\d]+)+/g) || [];
    hyphenatedNums.forEach(num => {
       const clean = num.replace(/\D/g, '').replace(/^0+/, '') || '0';
       if (!extractedNumbers.some(n => n.clean === clean)) {
         addNum(num, 'any');
       }
       const parts = num.split(/[-/]/);
       parts.forEach(p => {
         const pClean = p.replace(/\D/g, '').replace(/^0+/, '') || '0';
         if (!extractedNumbers.some(n => n.clean === pClean)) {
           addNum(p, 'any');
         }
       });
    });

    const isYear = (val) => { const num = parseInt(val, 10); return num >= 2020 && num <= 2035; };
    const hasOnlyYearNumbers = extractedNumbers.filter(n => !isYear(n.clean)).length === 0;

    let bestInvoice = null;
    let bestType = null;
    let bestScore = -1000;

    const BUILTIN_ALIASES = {
      'חנה בית הלחמי': 'חוגות',
      'בית הלחמי': 'חוגות',
      'עדי קייטרינג': 'עדי מ קייטרינג בע"מ',
      'עדי קייטרינג בע"מ': 'עדי מ קייטרינג בע"מ',
      'גטאקסי': 'ג\'יט גטאקסי סרוויסס ישראל בע"מ',
      'גט טקסי': 'ג\'יט גטאקסי סרוויסס ישראל בע"מ',
      'גט': 'ג\'יט גטאקסי סרוויסס ישראל בע"מ',
      'gett': 'ג\'יט גטאקסי סרוויסס ישראל בע"מ',
      'שחר חוויות': 'שחר חוויות חינוכיות בע"מ',
      'שחר': 'שחר חוויות חינוכיות בע"מ',
      'רוזי עמית': 'קידו התעמלות רוזי עמית',
      'קידו': 'קידו התעמלות רוזי עמית',
      'קידו התעמלות': 'קידו התעמלות רוזי עמית',
      'מקס סטוק': 'קרנית רייזל',
      'זול סטוק': 'דנית שאול',
      'עולם הגלידה': 'קרנית רייזל',
      'טל עולם הגלידה': 'דנית שאול'
    };

    for (const numObj of extractedNumbers) {
      const cleanNumStr = numObj.clean;
      if (!cleanNumStr) continue;
      // Critical fix: NEVER match calendar years (2020..2035) as document or order numbers!
      if (isYear(cleanNumStr)) continue;
      
      const potentialMatches = invoices.filter(inv => {
        const cleanInvNum = inv.num ? (String(inv.num).replace(/\D/g, '').replace(/^0+/, '') || '0') : '';
        const cleanInvTx = inv.txNum ? (String(inv.txNum).replace(/\D/g, '').replace(/^0+/, '') || '0') : '';
        const cleanInvOrder = inv.orderNum ? (String(inv.orderNum).replace(/\D/g, '').replace(/^0+/, '') || '0') : '';

        // Exact match
        if (cleanInvNum && cleanInvNum === cleanNumStr) return true;
        if (cleanInvTx && cleanInvTx === cleanNumStr) return true;
        if (cleanInvOrder && cleanInvOrder.length >= 4 && cleanInvOrder === cleanNumStr) return true;

        // Suffix/prefix match for branch codes (e.g. 08-800028 vs 800028)
        if (cleanNumStr.length >= 5) {
          if (cleanInvNum && cleanInvNum.length >= 5 && (cleanInvNum.endsWith(cleanNumStr) || cleanNumStr.endsWith(cleanInvNum))) return true;
          if (cleanInvTx && cleanInvTx.length >= 5 && (cleanInvTx.endsWith(cleanNumStr) || cleanNumStr.endsWith(cleanInvTx))) return true;
          if (cleanInvOrder && cleanInvOrder.length >= 5 && (cleanInvOrder.endsWith(cleanNumStr) || cleanInvOrder.endsWith(cleanInvOrder))) return true;
        }
        return false;
      });

      for (const inv of potentialMatches) {
        let type = null;
        let contextBonus = 0;

        const cleanInvNum = inv.num ? (String(inv.num).replace(/\D/g, '').replace(/^0+/, '') || '0') : '';
        const cleanInvTx = inv.txNum ? (String(inv.txNum).replace(/\D/g, '').replace(/^0+/, '') || '0') : '';
        const cleanInvOrder = inv.orderNum ? (String(inv.orderNum).replace(/\D/g, '').replace(/^0+/, '') || '0') : '';

        if (cleanInvNum && (cleanInvNum === cleanNumStr || (cleanNumStr.length >= 5 && cleanInvNum.endsWith(cleanNumStr)))) {
           type = 'tax';
           if (numObj.context === 'tax') contextBonus = 50;
        } else if (cleanInvTx && (cleanInvTx === cleanNumStr || (cleanNumStr.length >= 5 && cleanInvTx.endsWith(cleanNumStr)))) {
           type = 'tx';
           if (numObj.context === 'tx') contextBonus = 50;
        } else if (cleanInvOrder && cleanInvOrder.length >= 4 && (cleanInvOrder === cleanNumStr || (cleanNumStr.length >= 5 && cleanInvOrder.endsWith(cleanNumStr)))) {
           type = 'order';
           if (numObj.context === 'order') contextBonus = 50;
        }

        if (!type) continue;
        
        if (type === 'order') {
            if (file.name.includes('חשבונית מס') || file.name.includes('קבלה') || file.name.toLowerCase().includes('tax')) {
                type = 'tax';
                contextBonus += 50;
            } else if (file.name.includes('חשבון עסקה') || file.name.includes('חשבונית עסקה') || file.name.toLowerCase().includes('tx')) {
                type = 'tx';
                contextBonus += 50;
            }
        }

        let score = (cleanNumStr.length < 3) ? 10 : 50;
        score += contextBonus;

        // Exact document number match gets huge bonus!
        if ((type === 'tax' && cleanInvNum === cleanNumStr) ||
            (type === 'tx' && cleanInvTx === cleanNumStr) ||
            (type === 'order' && cleanInvOrder === cleanNumStr)) {
          score += 250;
        }
        
        let supplierMatched = false;
        let supplierWordsMatched = 0;
        const baseName = inv.supName ? String(inv.supName).trim().replace(/[.$#[\]/]/g, '') : '';
        const exData = supEx ? (supEx[inv.supName] || supEx[baseName]) : null;
        const keywords = exData ? exData.keywords : (inv.keywords || '');
        
        if (inv.supName) {
          const cleanSup = cleanSupText(inv.supName);
          if (cleanSup.length >= 2 && cleanFull.includes(cleanSup)) {
             supplierMatched = true;
             supplierWordsMatched += 3;
          }

          const supWords = cleanSup.split(/\s+/).filter(w => w.length >= 2 && !['של','עם','על','את','אל','מן','זה','או','כי','אם','גן','צהרון'].includes(w));
          for (const word of supWords) {
            if (cleanFull.includes(word)) {
              supplierWordsMatched++;
              supplierMatched = true;
            }
          }

          // Check Aliases (built-in + dynamic)
          const allAliases = { ...BUILTIN_ALIASES, ...(spScannerAliases || {}) };
          for (const alias in allAliases) {
            const aliasClean = cleanSupText(alias);
            const targetClean = cleanSupText(allAliases[alias]);
            if (targetClean === cleanSup || allAliases[alias] === inv.supName || allAliases[alias] === baseName) {
              if (cleanFull.includes(aliasClean)) {
                supplierMatched = true;
                supplierWordsMatched += 3;
                break;
              }
            }
          }

          if (keywords) {
             const kwds = keywords.split(',').map(k => cleanSupText(k)).filter(Boolean);
             if (kwds.some(k => cleanFull.includes(k))) {
                supplierMatched = true;
                supplierWordsMatched += 2;
             }
          }

          // Match words from order description (e.g. "שופרסל", "שקלנד", "גלידוש", "מקס סטוק")
          if (inv.orderDesc) {
            const cleanDesc = cleanSupText(inv.orderDesc);
            const descWords = cleanDesc.split(/\s+/).filter(w => w.length >= 3 && !['של','עם','על','את','אל','מן','זה','או','כי','אם','גן','צהרון','ביהס','חופש','גדול','קייטנת'].includes(w));
            for (const word of descWords) {
              if (cleanFull.includes(word)) {
                supplierWordsMatched++;
                supplierMatched = true;
              }
            }
          }

          // Match words from location / notes
          if (inv.locName) {
            const cleanLoc = cleanSupText(inv.locName);
            if (cleanLoc.length >= 3 && cleanFull.includes(cleanLoc)) {
              supplierWordsMatched++;
              supplierMatched = true;
            }
          }
          if (inv.locCity) {
            const cleanCity = cleanSupText(inv.locCity);
            if (cleanCity.length >= 3 && cleanFull.includes(cleanCity)) {
              supplierWordsMatched++;
              supplierMatched = true;
            }
          }

          score += (supplierWordsMatched * 100);
        }

        // Long document numbers (6+ digits like receipts/invoices) are virtually unique
        if (cleanNumStr.length >= 6) {
          score += 150;
        }

        if (numObj.context === 'any' && cleanNumStr.length <= 4) {
            if (!supplierMatched) score -= 60;
        }

        let monthMatched = false;
        const matchHebName = fullText.match(/(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s*(\d{4})?/);
                             
        if (matchHebName) {
          const targetMonth = hebMonths.indexOf(matchHebName[1]);
          if (inv.orderMonth || inv.actMonth) {
             const oMonthStr = String(inv.orderMonth || inv.actMonth);
             const invMonthMatch = oMonthStr.match(/(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)/);
             if (invMonthMatch) {
               if (hebMonths.indexOf(invMonthMatch[1]) === targetMonth) {
                 score += 30;
                 monthMatched = true;
               } else {
                 if (numObj.context === 'any') score -= 30;
               }
             } else {
               const mStr1 = '/' + (targetMonth + 1) + '/';
               const mStr2 = '/' + String(targetMonth + 1).padStart(2, '0') + '/';
               const mStr3 = (targetMonth + 1) + '/';
               const mStr4 = String(targetMonth + 1).padStart(2, '0') + '/';
               const mStr5 = '.' + (targetMonth + 1) + '.';
               const mStr6 = '.' + String(targetMonth + 1).padStart(2, '0') + '.';
               if (oMonthStr.includes(mStr1) || oMonthStr.includes(mStr2) || oMonthStr.startsWith(mStr3) || oMonthStr.startsWith(mStr4) || oMonthStr.includes(mStr5) || oMonthStr.includes(mStr6)) {
                 score += 30;
                 monthMatched = true;
               } else if (oMonthStr.match(/\d/) && numObj.context === 'any') {
                 score -= 10;
               }
             }
          }
        }

        if (type === 'tax' && (file.name.includes('חשבונית מס') || file.name.includes('קבלה'))) score += 100;
        if (type === 'tx' && (file.name.includes('חשבון עסקה') || file.name.includes('חשבונית עסקה') || file.name.includes('דרישת תשלום') || file.name.includes('דרישה') || file.name.includes('קבלה'))) score += 100;

        const existing = inv['file_' + type];
        // Treat null, undefined, or objects without .path as "no file"
        const hasPath = !!(existing && existing.path);
        
        if (hasPath && !globalOverwrite) { 
            if (existing.path === file.link) {
                // Exact same file: reaffirm match
                score += 10;
            } else if (existing.origin === 'manual') { 
                score -= 500; 
            } else if (existing.score !== undefined && score <= existing.score) {
                score -= 100;
            } else {
                score -= 5;
            }
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
      
      const matchHebName = file.name.match(/(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s*(\d{4})?/) || 
                           decodedLink.match(/(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s*(\d{4})?/);
                           
      if (matchHebName) {
        targetMonth = hebMonths.indexOf(matchHebName[1]);
        if (matchHebName[2]) targetYear = parseInt(matchHebName[2]);
        explicitMonthFound = true;
      }
      
      const isPettyCash = cleanFull.includes('קופה קטנה');
      const isGett = cleanFull.includes('גט') || cleanFull.includes('טאקסי') || cleanFull.includes('טקסי') || cleanFull.includes('gett') || cleanFull.includes('הסעות');
      
      if (true) {
        if (targetYear === -1) {
          const yearMatch = file.name.match(/\b(202\d)\b/) || decodedLink.match(/\b(202\d)\b/);
          targetYear = yearMatch ? parseInt(yearMatch[1]) : (currentYear || new Date().getFullYear());
        }
        
        for (const inv of invoices) {
          const baseName = inv.supName ? String(inv.supName).trim().replace(/[.$#[\]/]/g, '') : '';
          const supKws = (supEx && (supEx[inv.supName] || supEx[baseName])) ? (supEx[inv.supName] || supEx[baseName]).keywords || '' : ''; 
          const isInvPettyCash = inv.orderNum === 'קופה קטנה' || inv.orderType === 'petty' || String(inv.notes||'').includes('קופה קטנה') || String(inv.txNum||'').includes('קופה קטנה') || String(inv.orderDesc||'').includes('קופה קטנה') || String(inv.supName||'').includes('קופה קטנה') || String(supKws).includes('קופה קטנה');
          if (isPettyCash && !isInvPettyCash) continue;
          
          const isInvGett = String(inv.supName||'').toLowerCase().includes('gett') || String(inv.supName||'').includes('גט') || String(inv.supName||'').includes('טאקסי') || String(inv.supName||'').includes('טקסי') || String(inv.orderNum||'').includes('הסעות') || String(inv.notes||'').includes('גט') || String(inv.orderDesc||'').includes('גט') || String(inv.orderDesc||'').includes('הסעות');
          if (isGett && !isInvGett) continue;
          
          let supplierScore = 0;
          if (isGett && isInvGett) supplierScore = 35;
          if (inv.supName) {
             const cleanSup = cleanSupText(inv.supName);
             if (cleanSup.length >= 3 && cleanFull.includes(cleanSup)) {
               supplierScore = Math.max(supplierScore, 40);
             } else {
                let foundAlias = false;
                const allAliases = { ...BUILTIN_ALIASES, ...(spScannerAliases || {}) };
                for (const alias in allAliases) {
                  const aliasClean = cleanSupText(alias);
                  const targetClean = cleanSupText(allAliases[alias]);
                  if (targetClean === cleanSup || allAliases[alias] === inv.supName || allAliases[alias] === baseName) {
                    if (cleanFull.includes(aliasClean)) {
                      supplierScore = Math.max(supplierScore, 35);
                      foundAlias = true;
                      break;
                    }
                  }
                }
               
               if (!foundAlias && supEx) {
                 const exData = supEx[baseName] || supEx[inv.supName];
                 if (exData && exData.keywords) {
                   const kws = exData.keywords.split(',').map(k => cleanSupText(k)).filter(Boolean);
                   if (kws.some(k => k.length >= 3 && cleanFull.includes(k))) {
                     supplierScore = Math.max(supplierScore, 30);
                     foundAlias = true;
                   }
                 }
               }
             }
          }
          
          if (isPettyCash && supplierScore === 0) supplierScore = 20;
          if (isGett && isInvGett && supplierScore === 0) supplierScore = 35;

          if (supplierScore === 0) continue; 
          
          let invMonth = -1;
          let invYear = -1;
          
          if (inv.date) {
            let invDate = new Date(inv.date);
            const dStr = String(inv.date).trim();
            if (dStr.includes('/')) {
              const parts = dStr.split('/');
              if (parts.length === 3) {
                 if (parts[2].length === 4) {
                     invDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                     invYear = parseInt(parts[2], 10);
                 } else if (parts[0].length === 4) {
                     invYear = parseInt(parts[0], 10);
                 }
              }
            } else if (dStr.length >= 4) {
               const parsedYear = parseInt(dStr.substring(0,4), 10);
               if (!isNaN(parsedYear) && parsedYear > 2000) invYear = parsedYear;
            }
            if (!isNaN(invDate.getMonth())) {
              invMonth = invDate.getMonth();
              if (invYear === -1) invYear = invDate.getFullYear();
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
            
            let type = 'tax';
            if (inv.num) type = 'tax';
            else if (inv.txNum) type = 'tx';
            else if (inv.orderNum && inv.orderNum !== 'קופה קטנה') type = 'order';
            else type = 'tax';
            
            if (file.name.includes('חשבון עסקה') || file.name.includes('חשבונית עסקה') || file.name.toLowerCase().includes('tx')) {
              type = 'tx';
            } else if (file.name.includes('חשבונית') || file.name.includes('חשבונית מס') || file.name.includes('קבלה') || file.name.toLowerCase().includes('tax')) {
              type = 'tax';
            } else if (file.name.includes('הזמנה') || file.name.includes('דרישה')) {
              type = 'order';
            }
            
            const existing = inv['file_' + type];
            const hasPath = !!(existing && existing.path);
            if (hasPath && !globalOverwrite) { if (existing.origin !== 'manual' && (existing.score === undefined || score > existing.score)) { score -= 5; } else { score -= 500; } } 
            
            if (isPettyCash) {
              if (score > 0) {
                if (!bestInvoice) bestInvoice = [];
                if (!Array.isArray(bestInvoice)) bestInvoice = [bestInvoice];
                bestInvoice.push(inv);
                bestType = type;
                if (score > bestScore) bestScore = score;
              }
            } else {
              if (score > bestScore) {
                bestScore = score;
                bestInvoice = inv;
                bestType = type;
              }
            }
          }
        }
      }
    }

    let matchedInvoice = bestScore > -200 ? bestInvoice : null;
    let matchedType = bestScore > -200 ? bestType : null;

    if (matchedInvoice) {
      if (Array.isArray(matchedInvoice)) {
         let linkedLines = 0;
         matchedInvoice.forEach(inv => {
           const typesToLink = [];
           if (inv.num) typesToLink.push('tax');
           if (inv.txNum) typesToLink.push('tx');
           if (inv.orderNum || typesToLink.length === 0) typesToLink.push('order');

           typesToLink.forEach(t => {
             if (!inv['file_' + t] || globalOverwrite || (inv['file_' + t].score !== undefined && bestScore > inv['file_' + t].score)) {
                matchedInvoicesToUpdate.push({
                    id: inv.id,
                    serialNum: inv.serialNum,
                    txNum: inv.txNum,
                    num: inv.num,
                    orderNum: inv.orderNum,
                    supName: inv.supName,
                    type: t,
                    path: file.link,
                    score: bestScore,
                    filename: file.name
                });
                linkedLines++;
             }
           });
           if (typesToLink.length > 0) matchCount++;
         });
         if (linkedLines > 0) {
           resultsData.push([file.name, `קופה קטנה (${matchedInvoice.length} שורות)`, bestScore, 'שויך']);
         } else {
           resultsData.push([file.name, `קופה קטנה`, bestScore, 'דלג (קישור קיים)']);
           skippedCount++;
         }
      } else {
        if (bestScore < 0) {
           resultsData.push([file.name, `${matchedInvoice.orderDesc || matchedInvoice.supName}`, bestScore, 'דלג (קישור קיים)']);
           skippedCount++;
        } else {
           const existFile = matchedInvoice['file_' + matchedType];
           const existHasPath = !!(existFile && existFile.path);
           if (!existHasPath || globalOverwrite || (existFile && existFile.score !== undefined && bestScore > existFile.score)) {
              matchedInvoicesToUpdate.push({
                  id: matchedInvoice.id,
                  serialNum: matchedInvoice.serialNum,
                  txNum: matchedInvoice.txNum,
                  num: matchedInvoice.num,
                  orderNum: matchedInvoice.orderNum,
                  supName: matchedInvoice.supName,
                  type: matchedType,
                  path: file.link,
                  score: bestScore,
                  filename: file.name
              });
             resultsData.push([file.name, `${matchedInvoice.orderDesc || matchedInvoice.supName} (${matchedType})`, bestScore, 'שויך']);
             matchCount++;
           } else {
             resultsData.push([file.name, `${matchedInvoice.orderDesc || matchedInvoice.supName}`, bestScore, 'דלג (קישור קיים/ציון נמוך יותר)']);
             skippedCount++;
           }
        }
      }
    } else {
      resultsData.push([file.name, '---', bestScore, 'לא נמצאה התאמה']);
    }
  }

  postMessage({ type: 'done', matchCount, skippedCount, resultsData, matchedInvoicesToUpdate });
};
