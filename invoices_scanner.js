// ── SharePoint URL Parser ─────────────────────────────
window.parseSharePointBaseUrl = (url, fallbackDirName) => {
  let u = (url || '').trim();

  if (!u && fallbackDirName) {
      return 'https://tomashin1.sharepoint.com/sites/zaharonim/Shared Documents/' + encodeURIComponent(fallbackDirName);
  }
  if (!u) return '';

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
  const cleanBase1 = window.parseSharePointBaseUrl(cfg1.url, dirHandle.name);
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
        const cleanBase2 = window.parseSharePointBaseUrl(cfg2.url, dir2.name);
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
  // Ensure all invoices are loaded for scanning
  if (window._invoicesPartialLoad && window.loadAllInvoices) {
    window.showToast?.('טוען את כל החשבוניות לצורך סריקה...');
    const all = await window.loadAllInvoices();
    if (all && all.length > 0) {
      window.INVOICES = all;
      window._invoicesPartialLoad = false;
    }
  }

const filesFound = [];

  async function scanDir(handle, currentPath, cleanBase) {
    try {
      for await (const entry of handle.values()) {
        try {
          if (entry.kind === 'file') {
            const n = entry.name.toLowerCase();
            if (!n.startsWith('.') && !n.startsWith('~') && (n.endsWith('.pdf') || n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.png'))) {
              filesFound.push({
                name: entry.name,
                link: cleanBase + currentPath + '/' + encodeURIComponent(entry.name) + '?web=1'
              });
            }
          } else if (entry.kind === 'directory') {
            if (entry.name.startsWith('.')) continue;
            await scanDir(entry, currentPath + '/' + encodeURIComponent(entry.name), cleanBase);
          }
        } catch (itemErr) {
          console.warn('Skipping unreadable entry in scanDir:', entry?.name, itemErr);
        }
      }
    } catch (dirErr) {
      console.warn('Error reading directory handle:', currentPath, dirErr);
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

  // ── Step 5: Match logic via Web Worker
  const globalOverwrite = selectedFolders.some(f => f.overwrite);
  const currentYear = new Date().getFullYear();

  window.showToast?.('⏳ מעבד קבצים בסורק ברקע...', 60000);
  
  const worker = new Worker('scanner_worker.js');
  
  worker.onmessage = async function(e) {
    if (e.data.type === 'progress') {
      window.showToast?.(`⏳ מתאים חשבוניות: ${e.data.percent}%...`, 30000);
    } else if (e.data.type === 'done') {
      const { matchCount, skippedCount, resultsData, matchedInvoicesToUpdate } = e.data;
      
      if (matchCount > 0) {
        window.showToast(`✅ שודכו ${matchCount} קבצים! מעדכן מסד נתונים...`);
        
        // Update local INVOICES state
        const cleanDoc = (d) => String(d || '').replace(/\D/g, '').replace(/^0+/, '');
        const cleanSup = (s) => String(s || '').toLowerCase().replace(/["'״׳`]/g, '').replace(/\s*\(?\s*בע[\s.]*מ\s*\)?\s*/gi, ' ').replace(/\s*\(?\s*ltd\.?\s*\)?\s*/gi, ' ').replace(/[-_.,()]/g, ' ').replace(/\s+/g, ' ').trim();

        matchedInvoicesToUpdate.forEach(update => {
          const inv = window.INVOICES.find(i => {
            // 1. Direct ID match
            if (update.id && String(i.id) === String(update.id)) return true;
            // 2. Direct Serial Number match (מס"ד)
            if (update.serialNum && i.serialNum && String(i.serialNum).trim() === String(update.serialNum).trim()) return true;

            const sameSupplier = !update.supName || cleanSup(i.supName) === cleanSup(update.supName);
            if (!sameSupplier) return false;

            // 3. Exact Transaction Invoice Number (מס' חשבון עסקה)
            if (update.txNum && i.txNum && cleanDoc(i.txNum) === cleanDoc(update.txNum)) return true;
            // 4. Exact Tax Invoice Number (מס' חשבונית מס / קבלה)
            if (update.num && i.num && cleanDoc(i.num) === cleanDoc(update.num)) return true;
            // 5. Numeric Order Number ONLY (4+ digits, never match generic labels like "חוגים" or "הסעות")
            if (update.orderNum && i.orderNum && cleanDoc(i.orderNum).length >= 4 && cleanDoc(i.orderNum) === cleanDoc(update.orderNum)) return true;

            return false;
          });
          if (inv) {
            inv['file_' + update.type] = { path: update.path, origin: 'sp', score: update.score, name: update.filename };
            const fName = String(update.filename || '');
            if (fName.includes('חשבונית מס')) {
                inv.status = 'tax_invoice';
            } else if (fName.includes('חשבון עסקה') && inv.status !== 'receipt') {
                inv.status = 'tx_invoice';
            }
          }
        });
        
        if (window._safeLS) window._safeLS.setItem('ganv5_invoices', JSON.stringify(window.INVOICES || []));
        if (typeof window.saveToFirebase === 'function') await window.saveToFirebase(true, true);
        else if (typeof window.save === 'function') await window.save(true);
        if (typeof window.renderInvoices === 'function') window.renderInvoices();
        if (typeof window.renderAdminSpLinks === 'function') window.renderAdminSpLinks();
      } else {
        window.showToast(`סריקה הסתיימה — 0 התאמות למסמכים קיימים.`);
      }
      
      // Call render results table and download summary Excel at the end
      if (typeof window._renderScannerResults === 'function') {
        await window._renderScannerResults(resultsData, matchCount, skippedCount, filesFound.length);
      }
      
      worker.terminate();
    }
  };
  
  worker.onerror = function(err) {
    console.error('Scanner Worker Error:', err);
    window.showToast?.('❌ שגיאה בסריקה ברקע');
    worker.terminate();
  };

  worker.postMessage({
    filesFound,
    invoices: window.INVOICES,
    supEx: window.supEx || {},
    globalOverwrite,
    spScannerAliases: window.spScannerAliases || {},
    currentYear
  });
};

window._renderScannerResults = async function(resultsData, matchCount, skippedCount, totalFiles) {
  // ── Step 7: Export results Excel ──
  if (typeof window.XLSX === "undefined") {
     try { await window.loadScriptAsync('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'); } catch(e){}
  }
  if (window.XLSX && resultsData && resultsData.length > 1) {
    try {
      const wb = window.XLSX.utils.book_new();
      const ws = window.XLSX.utils.aoa_to_sheet(resultsData);
      ws['!cols'] = [{wch: 45}, {wch: 25}, {wch: 15}, {wch: 25}];
      window.XLSX.utils.book_append_sheet(wb, ws, 'תוצאות סריקה');
      window.XLSX.writeFile(wb, 'תוצאות_סריקת_sharepoint.xlsx');
    } catch(err) {
      console.warn('Failed to export scanner results Excel:', err);
    }
  }

  await _spAlertDialog(
    `<b style="color:#1b5e20;font-size:1.1rem">✅ סריקה הסתיימה בהצלחה!</b>\n\n` +
    (totalFiles !== undefined ? `📁 <b>נסרקו:</b> ${totalFiles} קבצים\n` : '') +
    `🔗 <b>שודכו / עודכנו:</b> ${matchCount} למסמכים\n` +
    (skippedCount ? `⏭️ <b>דולגו</b> (קישור קיים ולא נדרס): ${skippedCount}\n` : '') +
    `\n<span style="color:#1565c0">קובץ אקסל עם פירוט תוצאות הסריקה הורד למחשבך. כעת תוכל ללחוץ על סמל ה-📎 ליד כל מסמך כדי לפתוח אותו ישירות.</span>`
  );
};

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
         selectedFolders.push({ handle: dirHandle1, cleanBase: window.parseSharePointBaseUrl(saved, dirHandle1.name), overwrite: false });
      }
    } else {
       const saved = window.spScannerFolderLinks[dirHandle1.name] || '';
       selectedFolders.push({ handle: dirHandle1, cleanBase: window.parseSharePointBaseUrl(saved, dirHandle1.name), overwrite: false });
    }
  }

  if (dirHandle2) {
    if ((await dirHandle2.queryPermission({ mode: 'read' })) !== 'granted') {
      if ((await dirHandle2.requestPermission({ mode: 'read' })) === 'granted') {
         const saved = window.spScannerFolderLinks[dirHandle2.name] || '';
         selectedFolders.push({ handle: dirHandle2, cleanBase: window.parseSharePointBaseUrl(saved, dirHandle2.name), overwrite: false });
      }
    } else {
       const saved = window.spScannerFolderLinks[dirHandle2.name] || '';
       selectedFolders.push({ handle: dirHandle2, cleanBase: window.parseSharePointBaseUrl(saved, dirHandle2.name), overwrite: false });
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
