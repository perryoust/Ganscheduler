import codecs

content = """
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

  // 1. Re-import Excel
  const fileHandle = await window._spIdbGet('invExcelFileHandle');
  if (!fileHandle) {
    _spAlertDialog('לא נמצא קובץ אקסל שמור בזיכרון.\\nאנא בצע "ייבוא אקסל" פעם אחת לפחות, בחר את הקובץ ולאחר מכן תוכל לרענן אוטומטית.');
    return;
  }

  // Request permission if needed
  if ((await fileHandle.queryPermission({ mode: 'read' })) !== 'granted') {
    if ((await fileHandle.requestPermission({ mode: 'read' })) !== 'granted') {
      window.showToast('❌ אין הרשאה לקרוא את קובץ האקסל.');
      return;
    }
  }

  window.showToast('📊 מייבא אקסל...', 60000);
  
  // Clean invoices to do a fresh import just like clicking OK on standard import
  window.INVOICES = [];
  
  const file = await fileHandle.getFile();
  // We need to pass input=null to our hijacked importInvoices, but wait, our hijacked importInvoices 
  // reads input.files[0]. We can just invoke import logic directly or mock the input object.
  const mockInput = { files: [file] };
  await window.importInvoices(mockInput, true); // skipConfirm = true for auto-refresh
  
  // Wait for import to complete (importInvoices handles rendering and saving implicitly)
  // Give it a couple of seconds to process the excel file before starting the scanner.
  setTimeout(async () => {
    // 2. Scan folders
    const dirHandle1 = await window._spIdbGet('invDirHandle1');
    const dirHandle2 = await window._spIdbGet('invDirHandle2');
    
    if (!dirHandle1 && !dirHandle2) {
      window.showToast('✅ אקסל יובא בהצלחה. לא הוגדרו תיקיות לסריקה בזיכרון, התהליך הושלם.', 5000);
      return;
    }

    const selectedFolders = [];
    
    if (dirHandle1) {
      if ((await dirHandle1.queryPermission({ mode: 'read' })) !== 'granted') {
        if ((await dirHandle1.requestPermission({ mode: 'read' })) === 'granted') {
           const saved = window.spScannerFolderLinks ? (window.spScannerFolderLinks[dirHandle1.name] || '') : '';
           selectedFolders.push({ handle: dirHandle1, cleanBase: window.parseSharePointBaseUrl(saved), overwrite: false });
        }
      } else {
         const saved = window.spScannerFolderLinks ? (window.spScannerFolderLinks[dirHandle1.name] || '') : '';
         selectedFolders.push({ handle: dirHandle1, cleanBase: window.parseSharePointBaseUrl(saved), overwrite: false });
      }
    }

    if (dirHandle2) {
      if ((await dirHandle2.queryPermission({ mode: 'read' })) !== 'granted') {
        if ((await dirHandle2.requestPermission({ mode: 'read' })) === 'granted') {
           const saved = window.spScannerFolderLinks ? (window.spScannerFolderLinks[dirHandle2.name] || '') : '';
           selectedFolders.push({ handle: dirHandle2, cleanBase: window.parseSharePointBaseUrl(saved), overwrite: false });
        }
      } else {
         const saved = window.spScannerFolderLinks ? (window.spScannerFolderLinks[dirHandle2.name] || '') : '';
         selectedFolders.push({ handle: dirHandle2, cleanBase: window.parseSharePointBaseUrl(saved), overwrite: false });
      }
    }

    if (selectedFolders.length === 0) {
      window.showToast('✅ ייבוא אקסל הסתיים. אין הרשאות לתיקיות.');
      return;
    }

    window.showToast('⏳ סורק תיקיות...', 60000);
    if (typeof window._runCoreScanner === 'function') {
      await window._runCoreScanner(selectedFolders);
    } else {
      _spAlertDialog("שגיאה: פונקציית הסריקה הפנימית לא קיימת.");
    }
  }, 2000);
};
"""

with codecs.open('invoices.js', 'r', 'utf-8') as f:
    text = f.read()

start_idx = text.find("window._spIdbSet = function(key, val) {")

if start_idx != -1:
    new_text = text[:start_idx] + content
    with codecs.open('invoices.js', 'w', 'utf-8') as f:
        f.write(new_text)
    print("Fixed corrupted text")
else:
    print("Could not find start_idx")
