// ── SharePoint URL Parser ─────────────────────────────
window.parseSharePointBaseUrl = (url) => {
  let u = url.trim();

  try {
    // 1. Normalize backslashes
    u = u.replace(/\\/g, '/');

    // Local synced path — map to web URL
    const libIndex = u.indexOf('צהרונים - מסמכים');
    if (libIndex !== -1) {
      const relativePath = u.substring(libIndex + 'צהרונים - מסמכים'.length);
      return 'https://tomashin1.sharepoint.com/sites/zaharonim/Shared Documents' + relativePath.replace(/\/+$/, '');
    }
    const tomshinIndex = u.indexOf('רשת תיכוני טומשין בע מ');
    if (tomshinIndex !== -1) {
      // If we find 'רשת תיכוני טומשין בע מ' but not 'צהרונים - מסמכים', we fallback to stripping the first folder
      const rest = u.substring(tomshinIndex).replace(/^[^/]+\//, '');
      return 'https://tomashin1.sharepoint.com/sites/zaharonim/Shared Documents/' + rest.replace(/\/+$/, '');
    }

    if (!u.startsWith('http')) return u.replace(/\/+$/, '');

    const urlObj = new URL(u);

    // AllItems.aspx?id=... → extract real folder path
    if (urlObj.pathname.toLowerCase().endsWith('allitems.aspx') && urlObj.searchParams.has('id')) {
      return urlObj.origin + urlObj.searchParams.get('id').replace(/\/+$/, '');
    }

    // Standard SharePoint link — strip /:f:/r decorators
    let cleanPath = urlObj.pathname.replace(/\/:[a-z]:\/[a-z0-9]/i, '');
    return urlObj.origin + cleanPath.replace(/\/+$/, '');

  } catch (e) {
    return u.replace(/\?.*$/, '').replace(/\/+$/, '');
  }
};

// ── SharePoint Local Scanner ─────────────────────────────

// Helper: Show a simple HTML alert instead of native _spAlertDialog()
function _spAlertDialog(msgHtml) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10002;display:flex;align-items:center;justify-content:center';
    ov.innerHTML = `<div style="background:#fff;border-radius:12px;padding:24px;max-width:400px;width:90%;box-shadow:0 10px 30px rgba(0,0,0,.25);direction:rtl;font-family:inherit;text-align:center">
  <div style="font-size:.9rem;color:#37474f;margin-bottom:20px;line-height:1.6;white-space:pre-wrap">${msgHtml}</div>
  <button id="_sp-alert-ok" class="btn bp" style="padding:8px 24px">אישור</button>
</div>`;
    document.body.appendChild(ov);
    const btn = ov.querySelector('#_sp-alert-ok');
    btn.addEventListener('click', () => { ov.remove(); resolve(); });
    setTimeout(() => btn.focus(), 50);
  });
}


// Show a styled HTML dialog for SharePoint folder setup
// Returns Promise<{url:string, overwrite:bool, addSecond:bool} | null>
function _spFolderDialog(folderName, savedUrl, isSecond) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.58);z-index:10001;display:flex;align-items:center;justify-content:center';
    const title = isSecond ? '📁 תיקייה נוספת — הגדרת קישור' : '📁 סורק SharePoint — הגדרת תיקייה';
    ov.innerHTML = `<div style="background:#fff;border-radius:14px;padding:26px 24px;max-width:540px;width:96%;box-shadow:0 12px 40px rgba(0,0,0,.32);direction:rtl;font-family:inherit">
  <div style="font-weight:800;color:#1a237e;font-size:1rem;margin-bottom:5px">${title}</div>
  <div style="font-size:.8rem;color:#546e7a;margin-bottom:15px">תיקייה נבחרת: <b style="color:#1565c0">${folderName}</b></div>
  <label style="font-weight:700;font-size:.82rem;color:#37474f;display:block;margin-bottom:6px">🔗 קישור SharePoint של תיקייה זו:</label>
  <input id="_sp-url" type="text" value="${(savedUrl||'').replace(/"/g,'&quot;')}"
    placeholder="https://tomashin1.sharepoint.com/sites/zaharonim/Shared Documents/..."
    style="width:100%;padding:9px 11px;border-radius:7px;border:2px solid #90caf9;font-size:.78rem;direction:ltr;text-align:left;box-sizing:border-box;margin-bottom:5px">
  <div id="_sp-hint" style="font-size:.7rem;min-height:18px;margin-bottom:8px">${savedUrl ? '<span style="color:#2e7d32">✅ קישור שמור — ניתן לשנות</span>' : '<span style="color:#e65100">⚠️ פתח את התיקייה ב-SharePoint, העתק כתובת URL מסרגל הדפדפן, הדבק כאן</span>'}</div>
  <div id="_sp-preview" style="display:none;background:#f5f5f5;border-radius:6px;padding:7px 10px;margin-bottom:10px;font-size:.68rem;color:#555;direction:ltr;text-align:left;word-break:break-all;border:1px solid #e0e0e0">
    <span style="color:#888;font-size:.65rem;display:block;margin-bottom:2px;direction:rtl;text-align:right">🔍 נתיב שייוצר לכל קובץ:</span>
    <span id="_sp-preview-text"></span><b style="color:#1565c0">/שם_קובץ.pdf</b><span style="color:#888">?web=1</span>
  </div>
  <div style="background:#e8f5e9;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:.74rem;color:#1b5e20;line-height:1.7">
    <b>⬇ איך מקבלים קישור?</b><br>פתח SharePoint → נווט לתיקייה → העתק כתובת URL מסרגל הדפדפן
  </div>
  <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.82rem;margin-bottom:10px;padding:8px 10px;background:#fff8e1;border-radius:7px;border:1px solid #ffe082">
    <input type="checkbox" id="_sp-overwrite" checked style="width:16px;height:16px;cursor:pointer">
    <span><b>דרוס קישורים קיימים</b> (קבצים שכבר יש להם קישור יתעדכנו)</span>
  </label>
  ${!isSecond ? `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.82rem;margin-bottom:18px;padding:8px 10px;background:#e3f2fd;border-radius:7px;border:1px solid #90caf9">
    <input type="checkbox" id="_sp-add2" style="width:16px;height:16px;cursor:pointer">
    <span><b>סרוק גם תיקייה שנייה</b> (בחר לאחר אישור זה)</span>
  </label>` : '<div style="margin-bottom:18px"></div>'}
  <div style="display:flex;gap:8px;justify-content:flex-end">
    <button id="_sp-cancel" class="btn bs bsm">ביטול</button>
    <button id="_sp-ok" class="btn bp bsm" style="padding:7px 20px">▶ ${isSecond ? 'הוסף ובצע סריקה' : 'המשך'}</button>
  </div>
</div>`;
    document.body.appendChild(ov);
    const urlEl   = ov.querySelector('#_sp-url');
    const hint    = ov.querySelector('#_sp-hint');
    const preview = ov.querySelector('#_sp-preview');
    const prevTxt = ov.querySelector('#_sp-preview-text');

    function updatePreview(rawUrl) {
      const v = (rawUrl || '').trim();
      if (!v) {
        preview.style.display = 'none';
        hint.innerHTML = savedUrl ? '<span style="color:#2e7d32">✅ ישתמש בקישור השמור</span>' : '<span style="color:#e65100">⚠️ חסר קישור</span>';
        return;
      }
      const parsed = window.parseSharePointBaseUrl ? window.parseSharePointBaseUrl(v) : v.replace(/\/+$/, '');
      if (v.includes('sharepoint.com')) {
        hint.innerHTML = '<span style="color:#2e7d32">✅ קישור SharePoint תקין</span>';
      } else if (v.startsWith('http')) {
        hint.innerHTML = '<span style="color:#e65100">⚠️ לא זוהה כ-SharePoint, אך יתקבל</span>';
      } else {
        hint.innerHTML = '<span style="color:#c62828">❌ לא נראה כקישור תקין</span>';
      }
      prevTxt.textContent = parsed;
      preview.style.display = 'block';
    }

    // Show preview for saved URL immediately
    if (savedUrl) updatePreview(savedUrl);

    urlEl.addEventListener('input', () => updatePreview(urlEl.value));
    ov.querySelector('#_sp-cancel').addEventListener('click', () => { ov.remove(); resolve(null); });
    ov.querySelector('#_sp-ok').addEventListener('click', () => {
      const url = (urlEl.value.trim() || savedUrl || '').replace(/\/+$/, '');
      if (!url) { _spAlertDialog('⚠️ יש להזין קישור SharePoint'); return; }
      const overwrite  = ov.querySelector('#_sp-overwrite').checked;
      const addSecond  = !isSecond && ov.querySelector('#_sp-add2') ? ov.querySelector('#_sp-add2').checked : false;
      ov.remove();
      resolve({ url, overwrite, addSecond });
    });
    setTimeout(async () => { urlEl.focus(); urlEl.select(); }, 80);
  });
}

window.spUndoMatch = function(invId, type, rowIdx) {
  const inv = window.INVOICES.find(i => String(i.id) === String(invId));
  if (inv) {
    delete inv['file_' + type];
    window.save(true);
    const row = document.getElementById('sp-sug-row-' + rowIdx);
    if (row) row.remove();
    window.showToast('✅ שיוך בוטל. הקובץ כעת ללא שיוך.');
  }
};

window.startSharePointScanner = async function() {
  if (!window.showDirectoryPicker) {
    await _spAlertDialog('❌ הדפדפן שלך אינו תומך בסריקת תיקיות מקומית.\nאנא השתמש ב-Chrome או Edge עדכני.');
    return;
  }

  // Load saved URLs from localStorage
  if (!window.spScannerFolderLinks) {
    try { window.spScannerFolderLinks = JSON.parse(localStorage.getItem('spScannerFolderLinks') || '{}'); }
    catch(e) { window.spScannerFolderLinks = {}; }
  }

  // ── Step 1: Pick first folder (requires direct user gesture)
  let dirHandle;
  try {
    dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      if (window._spIdbSet) await window._spIdbSet('invDirHandle1', dirHandle);
  } catch (e) {
    if (e.name !== 'AbortError') await _spAlertDialog('❌ שגיאה בבחירת תיקייה:\n' + e.message);
    return;
  }

  // ── Step 2: Show styled dialog for URL + options
  const saved1 = window.spScannerFolderLinks[dirHandle.name] || '';
  const cfg1 = await _spFolderDialog(dirHandle.name, saved1, false);
  if (!cfg1) return;

  // Parse the pasted URL into a clean base path (strips AllItems.aspx?id=... etc.)
  const cleanBase1 = window.parseSharePointBaseUrl(cfg1.url);
  window.spScannerFolderLinks[dirHandle.name] = cfg1.url; // save original URL for next time
  try { localStorage.setItem('spScannerFolderLinks', JSON.stringify(window.spScannerFolderLinks)); } catch(e) {}

  const selectedFolders = [{ handle: dirHandle, cleanBase: cleanBase1, overwrite: cfg1.overwrite }];

  // ── Step 3: Second folder (if user checked "add second folder")
  if (cfg1.addSecond) {
    try {
      const dir2 = await window.showDirectoryPicker({ mode: 'read' });
      if (window._spIdbSet) await window._spIdbSet('invDirHandle2', dir2);
      const saved2 = window.spScannerFolderLinks[dir2.name] || '';
      const cfg2 = await _spFolderDialog(dir2.name, saved2, true);
      if (cfg2) {
        window.spScannerFolderLinks[dir2.name] = cfg2.url;
        const cleanBase2 = window.parseSharePointBaseUrl(cfg2.url);
        selectedFolders.push({ handle: dir2, cleanBase: cleanBase2, overwrite: cfg2.overwrite });
        try { localStorage.setItem('spScannerFolderLinks', JSON.stringify(window.spScannerFolderLinks)); } catch(e) {}
      }
    } catch (e) { /* user cancelled second folder picker */ }
  }

  // ── Step 4: Scan all selected folders
  window.showToast('⏳ סורק קבצים... נא להמתין', 60000);
  await window._runCoreScanner(selectedFolders);
}

window._runCoreScanner = async function(selectedFolders) {
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
        if (/\b(201[0-9]|2020|2021|2022)\b/.test(entry.name)) continue;
        await scanDir(entry, currentPath + '/' + encodeURIComponent(entry.name), cleanBase);
      }
    }
  }

  try {
    for (const folder of selectedFolders) {
      await scanDir(folder.handle, '', folder.cleanBase);
    }
  } catch (scanErr) {
    window.spAlert('❌ שגיאה בסריקת הקבצים:\n' + scanErr.message);
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
    const decodedLink = decodeURIComponent(file.link);
    const fullText = file.name + ' ' + decodedLink;
    
    // Extract numbers with context based on nearby keywords
    const extractedNumbers = [];
    const addNum = (str, ctx) => {
      const clean = str.replace(/\D/g, '').replace(/^0+/, '');
      if (clean.length >= 2 && !extractedNumbers.some(n => n.clean === clean && n.context === ctx)) {
        extractedNumbers.push({ raw: str, clean: clean, context: ctx });
      }
    };

    const taxMatch = fullText.match(/(?:חשבונית\s*מס|חשבונית|קבלה|tax)[^\d]*([\d][\d\-]{2,})/gi);
    if (taxMatch) taxMatch.forEach(m => { const d = m.match(/[\d][\d\-]+/); if(d) addNum(d[0], 'tax'); });

    const txMatch = fullText.match(/(?:חשבונית\s*עסקה|חשבון\s*עסקה|דרישה|דרישת\s*תשלום|tx)[^\d]*(\d{3,})/gi);
    if (txMatch) txMatch.forEach(m => { const d = m.match(/\d+/); if(d) addNum(d[0], 'tx'); });

    const orderMatch = fullText.match(/(?:הזמנה|הזמנת\s*רכש)[^\d]*(\d{3,})/gi);
    if (orderMatch) orderMatch.forEach(m => { const d = m.match(/\d+/); if(d) addNum(d[0], 'order'); });

    const tenDigitMatch = fullText.match(/\b(\d{10})\b/g);
    if (tenDigitMatch) tenDigitMatch.forEach(m => addNum(m, 'order'));

    const allNums = file.name.match(/\d+/g) || [];
    allNums.forEach(num => {
       const clean = num.replace(/\D/g, '').replace(/^0+/, '');
       if (clean.length >= 2 && !extractedNumbers.some(n => n.clean === clean)) {
         addNum(num, 'any');
       }
    });

    // Also capture hyphenated numbers as single units (e.g. "01-162265", "3970-04")
    const hyphenatedNums = file.name.match(/\d+\-\d+/g) || [];
    hyphenatedNums.forEach(num => {
       const clean = num.replace(/\D/g, '').replace(/^0+/, '');
       if (clean.length >= 2 && !extractedNumbers.some(n => n.clean === clean)) {
         addNum(num, 'any');
       }
    });

    const isYear = (val) => { const num = parseInt(val, 10); return num >= 2020 && num <= 2030; };
    const hasOnlyYearNumbers = extractedNumbers.filter(n => !isYear(n.clean)).length === 0;


    let bestInvoice = null;
    let bestType = null;
    let bestScore = -1000;

    for (const numObj of extractedNumbers) {
      const cleanNumStr = numObj.clean;
      
      const potentialMatches = window.INVOICES.filter(inv => {
        let match = false;
        if (inv.num && String(inv.num).replace(/\D/g, '').replace(/^0+/, '') === cleanNumStr) match = true;
        if (inv.txNum && String(inv.txNum).replace(/\D/g, '').replace(/^0+/, '') === cleanNumStr) match = true;
        if (inv.orderNum && String(inv.orderNum).replace(/\D/g, '').replace(/^0+/, '') === cleanNumStr) match = true;
        return match;
      });

      for (const inv of potentialMatches) {
        let type = null;
        let contextBonus = 0;

        if (inv.num && String(inv.num).replace(/\D/g, '').replace(/^0+/, '') === cleanNumStr) {
           type = 'tax';
           if (numObj.context === 'tax') contextBonus = 50;
        } else if (inv.txNum && String(inv.txNum).replace(/\D/g, '').replace(/^0+/, '') === cleanNumStr) {
           type = 'tx';
           if (numObj.context === 'tx') contextBonus = 50;
        } else if (inv.orderNum && String(inv.orderNum).replace(/\D/g, '').replace(/^0+/, '') === cleanNumStr) {
           type = 'order';
           if (numObj.context === 'order') contextBonus = 50;
        }

        if (!type) continue;

        let score = (cleanNumStr.length < 3) ? 10 : 50;
        score += contextBonus;
        
        let supplierMatched = false;
        let supplierWordsMatched = 0;
        const exData = window.supEx ? (window.supEx[inv.supName] || window.supEx[window.supBase ? window.supBase(inv.supName) : inv.supName]) : null;
        const keywords = exData ? exData.keywords : (inv.keywords || '');
        
        if (inv.supName) {
          const supWords = String(inv.supName).split(/\s+/).filter(w => w.length > 2);
          for (const word of supWords) {
            if (file.name.includes(word) || decodedLink.includes(word)) {
              supplierWordsMatched++;
              supplierMatched = true;
            }
          }
          if (keywords) {
             const kwds = keywords.split(',').map(k=>k.trim().toLowerCase()).filter(k=>k);
             if (kwds.some(k => fullText.includes(k))) {
                supplierMatched = true;
                supplierWordsMatched += 2;
             }
          }
          let cleanSup = inv.supName.replace(/["']/g,'').replace(/בעמ/g, '').trim().toLowerCase();
          if (cleanSup.length > 2 && fullText.includes(cleanSup)) {
             supplierMatched = true;
             supplierWordsMatched += 2;
          }
          
          score += (supplierWordsMatched * 100);
        }

        // If it is a generic number, penalize heavily if supplier doesn't match
        if (numObj.context === 'any' && cleanNumStr.length <= 5) {
            if (!supplierMatched) score -= 200;
        }

        let monthMatched = false;
        const hebMonths = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
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

        // Give a slight edge to the type of document mentioned explicitly in the filename
        if (type === 'tax' && (file.name.includes('׳—׳©׳‘׳•׳ ׳™׳× ׳ž׳¡') || file.name.includes('׳—׳©׳‘׳•׳׳™׳× ׳ž׳¡') || file.name.includes('׳§׳‘׳œ׳”'))) score += 100;
        if (type === 'tx' && (file.name.includes('׳—׳©׳‘׳•׳Ÿ ׳¢׳¡׳§׳”') || file.name.includes('׳—׳©׳‘׳•׳׳™׳× ׳¢׳¡׳§׳”') || file.name.includes('׳—׳©׳‘׳•׳ ׳™׳× ׳¢׳¡׳§׳”') || file.name.includes('׳“׳¨׳™׳©׳× ׳×׳©׳œ׳•׳ ') || file.name.includes('׳“׳¨׳™׳©׳”') || file.name.includes('׳§׳‘׳œ׳”'))) score += 100;


        const existing = inv['file_' + type];
        const hasPath = !!(existing && existing.path);
        
        if (hasPath && !globalOverwrite) { if (existing.score !== undefined && score > existing.score) { score -= 5; } else { score -= 500; } } // patched



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
      
      // const decodedLink = decodeURIComponent(link);
      const matchHebName = file.name.match(/(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s*(\d{4})?/) || 
                           decodedLink.match(/(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s*(\d{4})?/);
                           
      if (matchHebName) {
        targetMonth = hebMonths.indexOf(matchHebName[1]);
        if (matchHebName[2]) targetYear = parseInt(matchHebName[2]);
        explicitMonthFound = true;
      }
      
      const isPettyCash = file.name.includes('קופה קטנה');
      const isGett = file.name.includes('גט') && file.name.includes('טקסי');
      
      if (isPettyCash || isGett || (hasOnlyYearNumbers && explicitMonthFound)) {
        if (targetYear === -1) {
          const yearMatch = file.name.match(/\b(202\d)\b/) || decodedLink.match(/\b(202\d)\b/);
          targetYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
        }
        
        for (const inv of window.INVOICES) {
          const supKws = (window.supEx && window.supEx[inv.supName]) ? window.supEx[inv.supName].keywords || '' : ''; const isInvPettyCash = inv.orderNum === 'קופה קטנה' || String(inv.notes||'').includes('קופה קטנה') || String(inv.txNum||'').includes('קופה קטנה') || String(inv.orderDesc||'').includes('קופה קטנה') || String(inv.supName||'').includes('קופה קטנה') || String(supKws).includes('קופה קטנה');
          if (isPettyCash && !isInvPettyCash) continue;
          
          const isInvGett = String(inv.supName||'').toLowerCase().includes('gett') || String(inv.supName||'').includes('גט') || String(inv.notes||'').includes('גט') || String(inv.orderDesc||'').includes('גט');
          if (isGett && !isInvGett) continue;
          
          let supplierScore = 0;
          if (inv.supName) {
             const baseName = window.supBase ? window.supBase(inv.supName) : inv.supName;
             if (file.name.includes(baseName) || file.name.includes(inv.supName)) {
               supplierScore = 20;
             } else {
               let foundAlias = false;
               const spAliases = window.spScannerAliases || {};
               for (const alias in spAliases) {
                 if (spAliases[alias] === baseName || spAliases[alias] === inv.supName) {
                   if (file.name.includes(alias)) {
                     supplierScore = 20;
                     foundAlias = true;
                     break;
                   }
                 }
               }
               
               if (!foundAlias && window.supEx) {
                 const exData = window.supEx[baseName] || window.supEx[inv.supName];
                 if (exData && exData.keywords) {
                   const kws = exData.keywords.split(',').map(k => k.trim()).filter(Boolean);
                   if (kws.some(k => file.name.includes(k))) {
                     supplierScore = 20;
                     foundAlias = true;
                   }
                 }
               }
               
               if (!foundAlias && inv.orderDesc) {
                 const descWords = String(inv.orderDesc).split(/\s+/).filter(w=>w.length>2 && !['של','עם','על','את'].includes(w));
                 if (descWords.some(w => file.name.includes(w))) {
                   supplierScore = 15;
                   foundAlias = true;
                 }
               }
               
               if (!foundAlias) {
                 const firstWord = String(inv.supName).split(/\s+/).filter(w=>w.length>2)[0];
                 if (firstWord && file.name.includes(firstWord)) supplierScore = 10;
               }
             }
          }
          
          if (isPettyCash && supplierScore < 20) supplierScore = 0;
          if (isGett && supplierScore === 0) supplierScore = 10;

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
            
            let type = 'order';
            if (inv.orderNum) type = 'order';
            else if (inv.num) type = 'tax';
            else if (inv.txNum) type = 'tx';
            
            if (file.name.includes('חשבון עסקה') || file.name.includes('חשבונית עסקה') || file.name.toLowerCase().includes('tx')) {
              type = 'tx';
            } else if (file.name.includes('חשבונית') || file.name.includes('חשבונית מס') || file.name.includes('קבלה') || file.name.toLowerCase().includes('tax')) {
              type = 'tax';
            } else if (file.name.includes('הזמנה') || file.name.includes('דרישה')) {
              type = 'order';
            }
            
            const existing = inv['file_' + type];
            const hasPath = !!(existing && existing.path);
            if (hasPath && !globalOverwrite) { if (existing.score !== undefined && score > existing.score) { score -= 5; } else { score -= 500; } } // patched
            
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
           if (!inv['file_' + matchedType] || globalOverwrite || (inv['file_' + matchedType].score !== undefined && bestScore > inv['file_' + matchedType].score)) {
              inv['file_' + matchedType] = { path: file.link, origin: 'sp', score: bestScore };
              const fName = String(file.name || '');
              if (fName.includes('חשבונית מס')) {
                  inv.status = 'tax_invoice';
              } else if (fName.includes('חשבון עסקה') && inv.status !== 'receipt') {
                  inv.status = 'tx_invoice';
              }
             matchCount++;
             linkedLines++;
           }
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
           if (!matchedInvoice['file_' + matchedType] || globalOverwrite || (matchedInvoice['file_' + matchedType].score !== undefined && bestScore > matchedInvoice['file_' + matchedType].score)) {
              matchedInvoice['file_' + matchedType] = { path: file.link, origin: 'sp', score: bestScore };
              const fName = String(file.name || '');
              if (fName.includes('חשבונית מס')) {
                  matchedInvoice.status = 'tax_invoice';
              } else if (fName.includes('חשבון עסקה') && matchedInvoice.status !== 'receipt') {
                  matchedInvoice.status = 'tx_invoice';
              }
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

  // ── Step 6: Save & render
  if (matchCount > 0) {
    window.showToast(`✅ שודכו ${matchCount} קבצים! שומר...`);
    if (window._safeLS) window._safeLS.setItem('ganv5_invoices', JSON.stringify(window.INVOICES || []));
    if (typeof window.saveToFirebase === 'function') await window.saveToFirebase(true, true);
    else if (typeof window.save === 'function') await window.save(true);
    if (typeof window.renderInvoices === 'function') window.renderInvoices();
    if (typeof window.renderAdminSpLinks === 'function') window.renderAdminSpLinks();
  } else {
    window.showToast(`סריקה הסתיימה — 0 התאמות למסמכים קיימים.`);
  }

  // ── Step 6.5: Batch alias suggestions — (DISABLED BY USER REQUEST)
  const pending = window._pendingAliasSuggestions || [];
  window._pendingAliasSuggestions = []; // Reset for next run
  if (pending.length > 0) {
    await new Promise(resolve => {
      let rowsHtml = '';
      pending.forEach((item, idx) => {
        rowsHtml += `
          <div id="sp-sug-row-${idx}" style="display:flex; align-items:center; gap:8px; margin-bottom:10px; padding:8px; background:#f5f5f5; border-radius:6px; direction:rtl;">
            <div style="flex:1; min-width:0;">
              <div style="font-weight:600; font-size:.9rem; color:#1565c0;">${item.supName}</div>
              <div style="font-size:.75rem; color:#666; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${item.fileName}">📄 ${item.fileName}</div>
            </div>
            <input type="text" id="sp-alias-input-${idx}" placeholder="מילת זיהוי..." 
              style="width:90px; padding:6px 8px; border:1px solid #ccc; border-radius:4px; font-size:.85rem; direction:rtl;">
            <button onclick="window.spUndoMatch('${item.invId}', '${item.type}', ${idx})" style="background:transparent;border:none;color:#d32f2f;cursor:pointer;font-size:1.1rem" title="בטל שיוך שגוי זה">❌</button>
          </div>`;
      });

      const formHtml = `
        <div style="direction:rtl; text-align:right; max-height:50vh; overflow-y:auto; padding:4px;">
          <div style="margin-bottom:12px; font-size:.85rem; color:#555;">
            המערכת שייכה קבצים לספקים הבאים. הקלד מילת זיהוי לכל ספק כדי לשפר סריקות עתידיות, או השאר ריק לדילוג.
          </div>
          ${rowsHtml}
        </div>`;

      window.spPromptDialog(
        `🔑 שמירת מילות מפתח לזיהוי ספקים (${pending.length})`,
        formHtml,
        'שמור הכל',
        () => {
          let savedCount = 0;
          pending.forEach((item, idx) => {
            const input = document.getElementById(`sp-alias-input-${idx}`);
            const val = input ? input.value.trim() : '';
            if (val.length > 1) {
              window.spScannerAliases = window.spScannerAliases || {};
              window.spScannerAliases[val] = item.supName;
              savedCount++;
            }
          });
          if (savedCount > 0) {
            localStorage.setItem('spScannerAliases', JSON.stringify(window.spScannerAliases));
            if (window.saveToFirebase) window.saveToFirebase(true, true);
            window.showToast(`✅ נשמרו ${savedCount} מילות זיהוי חדשות`);
          }
          resolve();
          return true; // Close dialog
        },
        true // wide dialog
      );
      // Also resolve if user cancels
      const checkClose = setInterval(() => {
        if (!document.getElementById('sp-pdlg-cancel')) { clearInterval(checkClose); return; }
        document.getElementById('sp-pdlg-cancel').onclick = () => {
          const overlay = document.querySelector('.sp-sys-dialog-overlay');
          if (overlay) { overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 200); }
          resolve();
        };
        clearInterval(checkClose);
      }, 50);
    });
  }

  // ── Step 7: Export results Excel
  if (typeof window.XLSX === "undefined") {
     try { await window.loadScriptAsync('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'); } catch(e){}
  }
  if (window.XLSX) {
    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.aoa_to_sheet(resultsData);
    ws['!cols'] = [{wch: 40}, {wch: 15}, {wch: 35}, {wch: 80}];
    window.XLSX.utils.book_append_sheet(wb, ws, 'תוצאות סריקה');
    window.XLSX.writeFile(wb, 'תוצאות_סריקת_sharepoint.xlsx');
  }

  await _spAlertDialog(
    `<b style="color:#1b5e20;font-size:1.1rem">✅ סריקה הסתיימה בהצלחה!</b>\n\n` +
    `📁 <b>נסרקו:</b> ${filesFound.length} קבצים\n` +
    `🔗 <b>שודכו / עודכנו:</b> ${matchCount} למסמכים\n` +
    (skippedCount ? `⏭️ <b>דולגו</b> (קישור קיים ולא נדרס): ${skippedCount}\n` : '') +
    `\n<span style="color:#1565c0">כעת תוכל ללחוץ על סמל ה-📎 ליד כל מסמך כדי לפתוח אותו ישירות ב-SharePoint.</span>`
  );
}

;


// ==========================================
// AUTO-REFRESH FUNCTIONALITY
// ==========================================


window._spIdbSet = function(key, val) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('GanschedulerDB', 1);
    request.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles');
      }
    };
    request.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('handles', 'readwrite');
      const store = tx.objectStore('handles');
      store.put(val, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
};

window._spIdbGet = function(key) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('GanschedulerDB', 1);
    request.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles');
      }
    };
    request.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('handles')) return resolve(null);
      const tx = db.transaction('handles', 'readonly');
      const store = tx.objectStore('handles');
      const getReq = store.get(key);
      getReq.onsuccess = () => resolve(getReq.result);
      getReq.onerror = () => reject(getReq.error);
    };
    request.onerror = () => reject(request.error);
  });
};

window.autoRefreshPurchasing = async function() {
  if (!window.showOpenFilePicker || !window.showDirectoryPicker) {
    _spAlertDialog('הדפדפן שלך אינו תומך בגישה ישירה לקבצים (File System Access API). אנא השתמש בייבוא רגיל.');
    return;
  }

  window.showToast('⏳ מתחיל רענון אוטומטי. ממתין לאישורי הרשאות...', 60000);

  // 1. Get handles
  const fileHandle = await window._spIdbGet('invExcelFileHandle');
  if (!fileHandle) {
    _spAlertDialog('לא נמצא קובץ אקסל שמור בזיכרון.\nאנא בצע "ייבוא אקסל" פעם אחת לפחות, בחר את הקובץ ולאחר מכן תוכל לרענן אוטומטית.');
    return;
  }

  const dirHandle1 = await window._spIdbGet('invDirHandle1');
  const dirHandle2 = await window._spIdbGet('invDirHandle2');

  // Request all permissions immediately while we still have the user gesture!
  if ((await fileHandle.queryPermission({ mode: 'read' })) !== 'granted') {
    if ((await fileHandle.requestPermission({ mode: 'read' })) !== 'granted') {
      window.showToast('❌ אין הרשאה לקרוא את קובץ האקסל.');
      return;
    }
  }

  const selectedFolders = [];
  window.spScannerFolderLinks = window.spScannerFolderLinks || {};
  try { window.spScannerFolderLinks = JSON.parse(localStorage.getItem('spScannerFolderLinks') || '{}'); } catch(e) {}

  if (dirHandle1) {
    if ((await dirHandle1.queryPermission({ mode: 'read' })) !== 'granted') {
      if ((await dirHandle1.requestPermission({ mode: 'read' })) === 'granted') {
         const saved = window.spScannerFolderLinks[dirHandle1.name] || '';
         selectedFolders.push({ handle: dirHandle1, cleanBase: window.parseSharePointBaseUrl(saved), overwrite: false });
      }
    } else {
       const saved = window.spScannerFolderLinks[dirHandle1.name] || '';
       selectedFolders.push({ handle: dirHandle1, cleanBase: window.parseSharePointBaseUrl(saved), overwrite: false });
    }
  }

  if (dirHandle2) {
    if ((await dirHandle2.queryPermission({ mode: 'read' })) !== 'granted') {
      if ((await dirHandle2.requestPermission({ mode: 'read' })) === 'granted') {
         const saved = window.spScannerFolderLinks[dirHandle2.name] || '';
         selectedFolders.push({ handle: dirHandle2, cleanBase: window.parseSharePointBaseUrl(saved), overwrite: false });
      }
    } else {
       const saved = window.spScannerFolderLinks[dirHandle2.name] || '';
       selectedFolders.push({ handle: dirHandle2, cleanBase: window.parseSharePointBaseUrl(saved), overwrite: false });
    }
  }

  window.showToast('📊 מייבא אקסל ומרענן שורות...', 60000);
  
  const file = await fileHandle.getFile();
  const mockInput = { files: [file] };
  await window.importInvoices(mockInput, true); // skipConfirm = true
  
  if (selectedFolders.length === 0) {
    window.showToast('✅ אקסל יובא בהצלחה. לא הוגדרו תיקיות לסריקה או אין הרשאות.');
    return;
  }

  window.showToast('⏳ סורק תיקיות מול שורות חדשות...', 60000);
  if (typeof window._runCoreScanner === 'function') {
    await window._runCoreScanner(selectedFolders);
  } else {
    _spAlertDialog("שגיאה: פונקציית הסריקה הפנימית לא קיימת.");
  }
};

/* force deploy */
