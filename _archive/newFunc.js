window.startSharePointScanner = async function() {
  if (!window.showDirectoryPicker) {
    _spAlertDialog('הדפדפן שלך אינו תומך בסריקת תיקיות מקומית. אנא השתמש ב-Chrome או Edge עדכני.');
    return;
  }
  
  try {
    const selectedFolders = [];
    let addAnother = true;
    
    while (addAnother) {
      const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      
      let baseUrl = '';
      if (window.spScannerFolderLinks && window.spScannerFolderLinks[dirHandle.name]) {
        baseUrl = window.spScannerFolderLinks[dirHandle.name];
      }
      
      if (!baseUrl) {
        baseUrl = prompt('בחרת תיקייה בהצלחה!\n\nכעת, הדבק כאן את קישור האינטרנט של התיקייה הזו ב-SharePoint:\n(לדוגמה: https://tomashin1.sharepoint.com/...)');
        if (baseUrl) {
          window.spScannerFolderLinks = window.spScannerFolderLinks || {};
          window.spScannerFolderLinks[dirHandle.name] = baseUrl.trim();
        }
      }
      
      if (baseUrl) {
        selectedFolders.push({ handle: dirHandle, baseUrl: baseUrl.trim().replace(/\/+$/, '') });
      }
      
      addAnother = confirm('האם תרצה לסרוק תיקייה מקומית נוספת במקביל?');
    }
    
    if (selectedFolders.length === 0) return;

    const parseSharePointBaseUrl = window.parseSharePointBaseUrl;
    
    window.showToast('⏳ סורק קבצים במחשב... נא להמתין', 60000);
    const filesFound = [];
    
    async function scanDir(handle, currentPath, folderObj) {
      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
          if (!entry.name.startsWith('.') && !entry.name.startsWith('~')) {
            filesFound.push({ 
              name: entry.name, 
              link: folderObj.cleanBaseUrl + currentPath + '/' + encodeURIComponent(entry.name) + '?web=1'
            });
          }
        } else if (entry.kind === 'directory') {
          await scanDir(entry, currentPath + '/' + encodeURIComponent(entry.name), folderObj);
        }
      }
    }
    
    for (const folder of selectedFolders) {
      // Use the exact URL pasted without smart SharePoint decoding to avoid breaking links
      const cleanBaseUrl = folder.baseUrl.trim().replace(/\/+$/, '');
      folder.cleanBaseUrl = cleanBaseUrl;
      await scanDir(folder.handle, '', folder);
    }
    
    let matchCount = 0;
    const resultsData = [['שם הקובץ', 'מספר שזוהה', 'סטטוס התאמה', 'קישור שנוצר']];
    
    for (const file of filesFound) {
      const numbersInName = file.name.match(/\d+/g) || [];
      const link = file.link;
      
      let matchedInvoice = null;
      let matchedType = null;
      
      let handled = false;
      for (const numStr of numbersInName) {
        if (numStr.length < 3) continue;
        matchedInvoice = window.INVOICES.find(inv => {
          if (inv.num && String(inv.num).trim() === numStr) { matchedType = 'tax'; return true; }
          if (inv.txNum && String(inv.txNum).trim() === numStr) { matchedType = 'tx'; return true; }
          if (inv.orderNum && String(inv.orderNum).trim() === numStr) { matchedType = 'order'; return true; }
          return false;
        });
        if (matchedInvoice) break;
      }
      
      if (matchedInvoice && matchedType) {
        matchedInvoice['file_' + matchedType] = { path: link, local: '' };
        matchCount++;
        resultsData.push([file.name, numbersInName.join(','), 'הותאם לספק: ' + matchedInvoice.supName, link]);
        handled = true;
      }
      
      if (!handled) {
        resultsData.push([file.name, numbersInName.join(','), 'לא נמצאה התאמה בחשבוניות', link]);
      }
    }

    if (matchCount > 0) {
      window.showToast(`✅ נמצאו ${filesFound.length} קבצים, מתוכם שודכו ${matchCount} למסמכים במערכת! שומר...`);
      if (window._safeLS) window._safeLS.setItem('ganv5_invoices', JSON.stringify(window.INVOICES||[]));
      if (typeof window.saveToFirebase === 'function') await window.saveToFirebase(true, true);
      else if (typeof window.save === 'function') await window.save(true);
      if (typeof window.renderInvoices === 'function') window.renderInvoices();
    } else {
      window.showToast(`סריקה הסתיימה. נמצאו ${filesFound.length} קבצים, אך 0 התאמות למסמכים הקיימים.`);
    }
    
    if (window.XLSX) {
      const wb = window.XLSX.utils.book_new();
      const ws = window.XLSX.utils.aoa_to_sheet(resultsData);
      ws['!cols'] = [{wch: 40}, {wch: 15}, {wch: 30}, {wch: 80}];
      window.XLSX.utils.book_append_sheet(wb, ws, 'תוצאות סריקה');
      window.XLSX.writeFile(wb, 'תוצאות_סריקת_sharepoint.xlsx');
    }
    
    _spAlertDialog(`סיום! נסרקו ${filesFound.length} קבצים.\nהותאמו ושודכו: ${matchCount}\nדוח הופק וירד למחשב שלך.`);
  } catch (error) {
    if (error.name !== 'AbortError') _spAlertDialog('שגיאה בסריקה: ' + error.message);
  }
}