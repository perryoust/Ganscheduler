// ── Invoice Excel Export ─────────────────────────────────────────────────────
const _INV_ASSIGN_LABELS = {
  shared:'משותף', daycare:'צהרונים', chanuka:'חנוכה', pesach:'פסח',
  longday:'יום ארוך', summer:'קייטנת קיץ', general:'כללי'
};
const _INV_TYPE_LABELS = {
  enrichment:'העשרה', operations:'תפעול', breakfast:'ארוחות בוקר',
  transport:'נסיעות', other:'אחר'
};
const _INV_LOC_LABELS = {
  garden:'גנים', school:'בתי ספר', joint:'משותף', office:'משרדים'
};
const _MONTH_LABELS = {
  '01':'ינואר','02':'פברואר','03':'מרץ','04':'אפריל','05':'מאי','06':'יוני',
  '07':'יולי','08':'אוגוסט','09':'ספטמבר','10':'אוקטובר','11':'נובמבר','12':'דצמבר'
};

function openInvExportModal(){
  const _ov = document.createElement('div');
  _ov.id = 'inv-export-overlay';
  _ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  _ov.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:22px;max-width:520px;width:96%;box-shadow:0 8px 32px rgba(0,0,0,.25);direction:rtl;max-height:90vh;overflow-y:auto">
      <div style="font-weight:800;color:#1a237e;font-size:.95rem;margin-bottom:14px">📊 יצוא חשבוניות לאקסל</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div><label style="font-size:.75rem;color:#546e7a;display:block;margin-bottom:3px">מתאריך</label>
          <input type="date" id="iex-from" style="width:100%;font-size:.8rem;border:1.5px solid #c5cae9;border-radius:5px;padding:5px 8px"></div>
        <div><label style="font-size:.75rem;color:#546e7a;display:block;margin-bottom:3px">עד תאריך</label>
          <input type="date" id="iex-to" style="width:100%;font-size:.8rem;border:1.5px solid #c5cae9;border-radius:5px;padding:5px 8px"></div>
        <div><label style="font-size:.75rem;color:#546e7a;display:block;margin-bottom:3px">ספק</label>
          <input type="text" id="iex-sup" placeholder="כל הספקים" list="iex-sup-list" style="width:100%;font-size:.8rem;border:1.5px solid #c5cae9;border-radius:5px;padding:5px 8px">
          <datalist id="iex-sup-list"></datalist></div>
        <div><label style="font-size:.75rem;color:#546e7a;display:block;margin-bottom:3px">סיווג</label>
          <select id="iex-type" style="width:100%;font-size:.8rem;border:1.5px solid #c5cae9;border-radius:5px;padding:5px 8px">
            <option value="">הכל</option>
            <option value="enrichment">העשרה</option>
            <option value="operations">תפעול</option>
            <option value="breakfast">ארוחות בוקר</option>
            <option value="transport">נסיעות</option>
            <option value="other">אחר</option>
          </select></div>
        <div><label style="font-size:.75rem;color:#546e7a;display:block;margin-bottom:3px">שיוך</label>
          <select id="iex-assign" style="width:100%;font-size:.8rem;border:1.5px solid #c5cae9;border-radius:5px;padding:5px 8px">
            <option value="">הכל</option>
            <option value="shared">משותף</option>
            <option value="daycare">צהרונים</option>
            <option value="chanuka">חנוכה</option>
            <option value="pesach">פסח</option>
            <option value="longday">יום ארוך</option>
            <option value="summer">קייטנת קיץ</option>
            <option value="general">כללי</option>
          </select></div>
        <div><label style="font-size:.75rem;color:#546e7a;display:block;margin-bottom:3px">עיר</label>
          <input type="text" id="iex-city" placeholder="כל הערים" style="width:100%;font-size:.8rem;border:1.5px solid #c5cae9;border-radius:5px;padding:5px 8px"></div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="iex-cancel" class="btn bs bsm">ביטול</button>
        <button id="iex-export" class="btn bg">📥 יצוא לאקסל</button>
      </div>
    </div>`;
  document.body.appendChild(_ov);
  // Populate supplier datalist
  const dl = _ov.querySelector('#iex-sup-list');
  [...new Set(window.INVOICES.map(i=>i.supName||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'he'))
    .forEach(n=>{ const o=document.createElement('option'); o.value=n; dl.appendChild(o); });
  // Pre-fill from current filter
  const curFrom = document.getElementById('pi-from')?.value||'';
  const curTo   = document.getElementById('pi-to')?.value||'';
  if(curFrom) _ov.querySelector('#iex-from').value = curFrom;
  if(curTo)   _ov.querySelector('#iex-to').value   = curTo;
  _ov.querySelector('#iex-cancel').addEventListener('click', ()=>_removeOverlay('inv-export-overlay'));
  _ov.querySelector('#iex-export').addEventListener('click', ()=>{
    const from   = _ov.querySelector('#iex-from').value||'';
    const to     = _ov.querySelector('#iex-to').value||'';
    const supF   = _ov.querySelector('#iex-sup').value||'';
    const typeF  = _ov.querySelector('#iex-type').value||'';
    const assignF= _ov.querySelector('#iex-assign').value||'';
    const cityF  = _ov.querySelector('#iex-city').value||'';
    _removeOverlay('inv-export-overlay');
    _doExportInvXlsx(from, to, supF, typeF, assignF, cityF);
  });
}

async function _doExportInvXlsx(from='', to='', supF='', typeF='', assignF='', cityF=''){
  if(!INVOICES || !INVOICES.length) { window.showToast('⚠️ אין נתונים לייצוא'); return; }

  window.showToast('⏳ מכין נתונים לאקסל ברקע...', 30000);

  // If partial data loaded, load all before exporting
  if (window._invoicesPartialLoad && window.loadAllInvoices) {
    window.showToast('⏳ מושך את שאר החשבוניות מהענן לצורך ייצוא...', 30000);
    const all = await window.loadAllInvoices();
    if (all && all.length > 0) {
      window.INVOICES = all;
      window._invoicesPartialLoad = false;
    }
  }

  const vat = getVatRate();
  const dateStr  = new Date().toISOString().slice(0,10);
  const rangeStr = from && to ? from+'_עד_'+to : from ? 'מ_'+from : to ? 'עד_'+to : 'כל_התאריכים';
  const filename = 'דוח_רכש_'+rangeStr+'.xlsx';

  const worker = new Worker('excel_worker.js');

  worker.onmessage = function(e) {
    if(e.data.error) {
      window.showToast('⚠️ ' + e.data.error);
      worker.terminate();
      return;
    }
    
    const blob = new Blob([e.data.buffer], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = e.data.filename;
    a.click();
    window.showToast('✅ קובץ אקסל הורד בהצלחה');
    worker.terminate();
  };

  worker.onerror = function(err) {
    console.error('Excel Worker Error:', err);
    window.showToast('❌ שגיאה בהכנת האקסל ברקע');
    worker.terminate();
  };

  // Send data to worker
  worker.postMessage({
    invoices: window.INVOICES,
    suppliers: window.supEx || {},
    vat, from, to, supF, typeF, assignF, cityF, filename
  });
}

window.setInvSort = function(col, dirForce) {
  if (dirForce) {
    window._invSortCol = col;
    window._invSortAsc = (dirForce === 'asc');
  } else {
    if (window._invSortCol === col) {
      window._invSortAsc = !window._invSortAsc;
    } else {
      window._invSortCol = col;
      window._invSortAsc = (col === 'date' ? false : true);
    }
  }
  
  // Update header UI
  const headers = ['supName', 'docNum', 'orderDesc', 'sumBase', 'status'];
  headers.forEach(h => {
    const el = document.getElementById('pi-sort-' + h);
    if(el) el.innerHTML = '';
  });
  if (col !== 'date') {
    const activeEl = document.getElementById('pi-sort-' + col);
    if(activeEl) {
      activeEl.innerHTML = window._invSortAsc ? ' ▲' : ' ▼';
    }
  }
  
  // Sync the date dropdown if it was a date sort
  const sel = document.getElementById('pi-sort');
  if(sel && col === 'date') {
    sel.value = window._invSortAsc ? 'asc' : 'desc';
  } else if (sel && col !== 'date') {
    // maybe disable or just leave it
  }
  
  window.renderInvoices();
};

window.openSavedSharePointFolder = function() {
  let links = {};
  try { links = JSON.parse(localStorage.getItem('spScannerFolderLinks') || '{}'); } catch(e) {}
  const keys = Object.keys(links);
  if (keys.length > 0) {
    window.open(links[keys[0]], '_blank');
  } else {
    _spAlertDialog('לא נמצאה תיקיית SharePoint מקושרת. אנא הפעל את הסורק לפחות פעם אחת כדי לקשר תיקייה.');
  }
};

window.runImportAndScan = function() {
  const input = document.getElementById('pi-import-input-moved');
  if (input) {
    window._runScannerAfterImport = true;
    input.click();
  }
};

/**
 * Smart Invoice Importer (Merge/Update Logic)
 */
window.promptDuplicateResolution = function(newItem, existingItem) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:999999;display:flex;align-items:center;justify-content:center;direction:rtl;font-family:"Assistant",sans-serif;';
    
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;padding:25px;border-radius:12px;width:90%;max-width:500px;box-shadow:0 10px 30px rgba(0,0,0,0.2);display:flex;flex-direction:column;gap:15px;';
    
    const sup = newItem.supName || existingItem.supName || 'לא ידוע';
    const num = newItem.orderNum || newItem.txNum || newItem.num || existingItem.orderNum || existingItem.txNum || existingItem.num || 'ללא מספר';
    const total = newItem.orderTotal || newItem.total || existingItem.orderTotal || existingItem.total || 0;
    
    box.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;color:#d32f2f;font-size:1.2rem;font-weight:bold;margin-bottom:10px;">
        <span style="font-size:1.5rem">⚠️</span> זוהתה כפילות!
      </div>
      <div style="font-size:0.95rem;color:#444;line-height:1.5;">
        המערכת מצאה רשומה שעלולה להיות כפולה עבור:
        <br><br>
        <div style="background:#f5f7fa;padding:12px;border-radius:8px;border:1px solid #e0e0e0;">
          <b>ספק:</b> ${sup}<br>
          <b>מספר מסמך (הזמנה/תעודה):</b> ${num}<br>
          <b>סכום:</b> ₪${parseFloat(total).toFixed(2)}<br>
        </div>
        <br>
        כיצד תרצה להמשיך?
      </div>
      
      <div style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:0.9rem;color:#555;">
        <input type="checkbox" id="dup-apply-all" style="width:16px;height:16px;cursor:pointer;">
        <label for="dup-apply-all" style="cursor:pointer;user-select:none;">החל את בחירתי על כל הכפילויות הבאות (לא אשאל שוב)</label>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;margin-top:15px;">
        <button id="btn-dup-merge" style="background:#0288d1;color:#fff;border:none;padding:10px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:1rem;transition:background 0.2s;">🔄 מיזוג ועדכון (עדכן נתונים קיימים)</button>
        <button id="btn-dup-keep" style="background:#ed6c02;color:#fff;border:none;padding:10px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:1rem;transition:background 0.2s;">➕ השאר כפול (צור רשומה חדשה בכל זאת)</button>
        <button id="btn-dup-skip" style="background:#e0e0e0;color:#333;border:none;padding:10px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:1rem;transition:background 0.2s;">⏭️ דלג (אל תייבא רשומה זו)</button>
      </div>
    `;
    
    ov.appendChild(box);
    document.body.appendChild(ov);
    
    const closeAndResolve = (action) => {
      const applyToAll = document.getElementById('dup-apply-all').checked;
      document.body.removeChild(ov);
      resolve({ action, applyToAll });
    };
    
    document.getElementById('btn-dup-merge').onclick = () => closeAndResolve('merge');
    document.getElementById('btn-dup-keep').onclick = () => closeAndResolve('keep');
    document.getElementById('btn-dup-skip').onclick = () => closeAndResolve('skip');
  });
};

window.importInvoices = async function(input, skipConfirm) {
    if(!skipConfirm && await window.asyncConfirm(`<b>שים לב:</b><br><br>האם למחוק קודם את כל החשבוניות (וכל הקבצים שקישרת אליהן עד כה) ולייבא את האקסל כרשימה חדשה לגמרי?<br><br>• בחר <b>אישור</b> כדי למחוק הכל לפני הייבוא (מומלץ כדי לנקות טעויות מהעבר, תצטרך לסרוק את התיקייה שוב).<br>• בחר <b>ביטול</b> כדי לעדכן חשבוניות קיימות ולשמור על קבצים מקושרים.`)) { window.INVOICES = []; if(window.save) await window.save(true); }
    
    let file;
    if (!input) {
      if (window.showOpenFilePicker) {
        try {
          const [fileHandle] = await window.showOpenFilePicker({
            types: [{ description: 'Excel Files', accept: {'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls']} }]
          });
          if (window._spIdbSet) await window._spIdbSet('invExcelFileHandle', fileHandle);
          file = await fileHandle.getFile();
        } catch(e) { return; }
      } else {
        document.getElementById('pi-import-input-moved').click();
        return;
      }
    } else {
      file = input.files ? input.files[0] : null;
      if (!file) return;
    }
  
    if (typeof window.XLSX === "undefined") {
    window.showToast('⏳ טוען ספריות ייבוא...');
    try {
      await window.loadScriptAsync('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
    } catch(e) {
      _spAlertDialog("שגיאה: ספריית XLSX לא נטענה. אנא רענן את הדף ונסה שוב.");
      return;
    }
  }

  return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onload = async function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to 2D array to support robust header row detection - using raw:false to preserve string values (like leading zeros)
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" });
      if (rawRows.length === 0) {
        _spAlertDialog("הקובץ ריק או לא תקין.");
        return;
      }

      // Dynamically find the real header row
      let headerRowIndex = 0;
      let isComplexFormat = false;
      let headerStrs = [];
      for (let i = 0; i < Math.min(10, rawRows.length); i++) {
        if (!rawRows[i]) continue;
        const rowCells = rawRows[i].filter(c => c !== null && c !== undefined && c !== '').length;
        const rowStrs = rawRows[i].map(c => String(c || '').trim());
        const hasSupplier = rowStrs.some(c => c.includes('ספק'));
        const hasDate = rowStrs.some(c => c.includes('תאריך') || c.includes('חודש'));
        const hasDescOrNum = rowStrs.some(c => c.includes('פירוט') || c.includes('מספר') || c.includes('מס\''));
        
        if (rowCells > 5 && hasSupplier && hasDate && hasDescOrNum) {
          headerRowIndex = i;
          headerStrs = rowStrs;
          if (headerStrs.filter(x => x === 'הערות').length > 1 || headerStrs.filter(x => x.includes('מע"מ')).length > 2) {
            isComplexFormat = true;
          }
          break;
        }
      }

      // Header Mapping (Hebrew -> Internal Key) for fallback
      const map = {
        "מס' הזמנת רכש (רץ)": "orderNum",
        "תאריך הזמנה מדוייק": "orderDate",
        "שם הספק (שרשום ע\"ג החשבונית)": "supName",
        "פירוט הרכישה": "orderDesc",
        "סיווג הרכישה(העשרה/תפעול/ארוחות בוקר/נסיעות/אחר)": "orderType",
        "סיווג הרכישה": "orderType",
        "שיוך הרכישה (משותף/צהרונים/חנוכה/פסח/יום ארוך/קייטנת קיץ/כללי)": "orderAssign",
        "שיוך הרכישה": "orderAssign",
        "חודש הפעילות": "orderMonth",
        "עיר": "locCity",
        "גן /ביה\"ס / משותף משרדים": "locType",
        "שם ביה\"ס/גן": "locName",
        "שם גן-ביהס": "locName",
        "סהכ' סכום ההזמנה כולל מע\"מ": "orderTotal",
        "מס' חשבון עיסקה": "txNum",
        "תאריך חשבון עיסקה": "txDate",
        "מס' חשבונית/קבלה": "num",
        "תאריך החשבונית": "date",
        "מספר הזמנה": "orderNum",
        "תאריך הזמנה": "orderDate",
        "שם הספק": "supName",
        "פירוט": "orderDesc",
        "סהכ הזמנה כולל מעמ": "orderTotal",
        "מס חשבון עסקה": "txNum",
        "סכום עסקה לפני מעמ": "txAmt",
        "סכום עסקה כולל מעמ": "txTotal",
        "מס חשבונית / קבלה": "num",
        "תאריך חשבונית": "date",
        "סכום חשבונית לפני מעמ": "amt",
        "סכום חשבונית כולל מעמ": "total",
        "הערות": "notes",
        "מס\"ד": "serialNum", "מס''ד": "serialNum", "מס'ד": "serialNum", "מס׳׳ד": "serialNum", "מסד": "serialNum"
      };

      let added = 0;
      let updated = 0;
      let skipped = 0;
      let applyToAllAction = null;

      // Build colMapping once before the loop (for complex format)
      let colMapping = null;
      if (isComplexFormat) {
        colMapping = [
          "serialNum", // 0: מס"ד
          "orderNum", // 1
          "orderDate", // 2
          "supName", // 3
          "orderDesc", // 4
          "orderType", // 5
          "orderAssign", // 6
          "orderMonth", // 7
          "locCity", // 8
          "locType", // 9
          "locName", // 10
          "orderTotal", // 11
          "orderNotes", // 12
          "txNum", // 13
          "txDate", // 14
          "txAmt", // 15
          "txTotal", // 16
          "num", // 17
          "date", // 18
          "amt", // 19
          "total", // 20
          "notes" // 21
        ];
        
        const serialIdx = headerStrs.findIndex(x => x && (x.includes('מס"ד') || x.includes("מס''ד") || x.includes("מס'ד") || x.includes("מסד") || x.includes("מסד")));
        if (serialIdx !== -1 && serialIdx !== 0) {
           colMapping[0] = null;
           colMapping[serialIdx] = "serialNum";
        }
      }

      for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length === 0) continue;

        const item = {};
        if (isComplexFormat && colMapping) {
          colMapping.forEach((key, colIdx) => {
            if (key) item[key] = row[colIdx];
          });
        } else {
          // Standard key-based mapping
          const headers = rawRows[headerRowIndex].map(h => String(h || '').trim());
          headers.forEach((h, colIdx) => {
            if (h) {
              const key = map[h] || h;
              item[key] = row[colIdx];
            }
          });
        }

        if (!item.supName) continue; // Skip invalid rows

        // Format dates if they are numeric (Excel serial format) or strings
        ["orderDate", "txDate", "date"].forEach(dk => {
          if (item[dk]) {
            if (typeof item[dk] === "number" || (!isNaN(item[dk]) && String(item[dk]).trim().length < 6)) {
              // Convert Excel serial date
              const parsed = parseFloat(item[dk]);
              if(!isNaN(parsed) && parsed > 20000) {
                 const d = new Date(Math.round((parsed - 25569) * 86400 * 1000));
                 item[dk] = d.toISOString().slice(0, 10);
              }
            } else if (typeof item[dk] === "string" && item[dk].includes('/')) {
              // Handle "DD/MM/YYYY" format explicitly 
              const parts = item[dk].split(/[-/]/);
              if(parts.length === 3) {
                 const y = parts[2].length === 2 ? '20'+parts[2] : parts[2];
                 const m = parts[1].padStart(2, '0');
                 const d = parts[0].padStart(2, '0');
                 item[dk] = `${y}-${m}-${d}`;
              }
            }
          }
        });

        // Helper to check if a numeric value is strictly positive (ignores 0, 0.0, ₪0, etc.)
        const isPositiveNum = (val) => {
          if (val === undefined || val === null) return false;
          const clean = String(val).replace(/[^\d.-]/g, '').trim();
          if (clean === '' || clean === '-' || clean === '.' || isNaN(parseFloat(clean))) return false;
          return parseFloat(clean) > 0;
        };
        // Helper to check if a text field has real content (ignores empty, -, 0, ₪0, etc.)
        const isValidTextField = (val) => {
          if (val === undefined || val === null) return false;
          const s = String(val).trim();
          if (s === '' || s === '-' || s === '0' || s === '0.0' || s === '0.00' || s === '₪ 0.0' || s === '₪ 0.00' || s === '₪ 0' || s === '₪0' || s === '₪0.0' || s === '₪0.00') return false;
          return true;
        };

        // Capture raw presence of tax/tx fields BEFORE numeric coercion turns empty cells into 0
        const _rawHasTax = !!(isValidTextField(item.num) || isValidTextField(item.date) || isPositiveNum(item.total) || isPositiveNum(item.amt));
        const _rawHasTx = !!(isValidTextField(item.txNum) || isValidTextField(item.txDate) || isPositiveNum(item.txTotal) || isPositiveNum(item.txAmt));

        // Ensure numeric fields are correctly typed
        ["orderTotal", "txAmt", "txTotal", "amt", "total"].forEach(nk => {
          if (item[nk] !== undefined && item[nk] !== null) {
            if (typeof item[nk] === 'string') {
              const parsed = parseFloat(item[nk].replace(/[^\d.-]/g, ''));
              item[nk] = isNaN(parsed) ? 0 : parsed;
            } else if (typeof item[nk] === 'number') {
              item[nk] = item[nk];
            }
          } else {
            item[nk] = 0;
          }
        });

        let sName = String(item.supName || "").trim().replace(/[.$#[\]/]/g, '');
        if (typeof window.supBase === 'function') {
            sName = window.supBase(sName);
            if (window.supEx) {
                let foundMatch = false;
                for (const mainKey in window.supEx) {
                    if (window.supEx[mainKey]._mergedFrom && window.supEx[mainKey]._mergedFrom.includes(sName)) {
                        sName = mainKey;
                        foundMatch = true;
                        break;
                    }
                }
                if (!foundMatch) {
                    const sNameLower = sName.toLowerCase();
                    for (const mainKey in window.supEx) {
                        const kwStr = window.supEx[mainKey].keywords;
                        if (kwStr) {
                            const kws = kwStr.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
                            if (kws.some(k => sNameLower.includes(k) || k.includes(sNameLower))) {
                                sName = mainKey;
                                break;
                            }
                        }
                    }
                }
            }
        }
        item.supName = sName;
        const oDesc = String(item.orderDesc || "").trim();
        const oTotal = parseFloat(item.orderTotal || 0).toFixed(2);
        const oMonth = String(item.orderMonth || "").trim();

        // Duplicate checking — smart matching:
        // 1. Try matching by unique document/order numbers for the same supplier.
        // 2. Fall back to description + amount + month if no document numbers match.
        const cleanSupText = (s) => String(s || '').toLowerCase().replace(/["'״׳`]/g, '').replace(/\bבעמ\b/g, '').replace(/\bבע"מ\b/g, '').replace(/בעמ/g, '').replace(/בע"מ/g, '').replace(/[-_.,()]/g, ' ').replace(/\s+/g, ' ').trim();

        const existingIdx = window.INVOICES.findIndex(inv => {
          const sameSup = cleanSupText(inv.supName) === cleanSupText(sName) || (window.supBase ? cleanSupText(window.supBase(inv.supName)) === cleanSupText(window.supBase(sName)) : false);
          if (!sameSup) return false;
          
          const cleanDoc = (d) => String(d || '').replace(/\D/g, '').replace(/^0+/, '');

          // Match by Tax Invoice Number if present
          if (item.num && inv.num && (String(item.num).trim() === String(inv.num).trim() || (cleanDoc(item.num).length >= 2 && cleanDoc(item.num) === cleanDoc(inv.num)))) {
            return true;
          }
          // Match by Transaction Invoice Number if present
          if (item.txNum && inv.txNum && (String(item.txNum).trim() === String(inv.txNum).trim() || (cleanDoc(item.txNum).length >= 2 && cleanDoc(item.txNum) === cleanDoc(inv.txNum)))) {
            return true;
          }
          // Match by Order Number if present and contains digits
          if (item.orderNum && inv.orderNum && /\d{3,}/.test(item.orderNum) && (String(item.orderNum).trim() === String(inv.orderNum).trim() || (cleanDoc(item.orderNum).length >= 3 && cleanDoc(item.orderNum) === cleanDoc(inv.orderNum)))) {
            return true;
          }
          // Cross-match between Transaction Invoice and Tax Invoice numbers
          if (item.txNum && inv.num && (String(item.txNum).trim() === String(inv.num).trim() || (cleanDoc(item.txNum).length >= 2 && cleanDoc(item.txNum) === cleanDoc(inv.num)))) {
            return true;
          }
          if (item.num && inv.txNum && (String(item.num).trim() === String(inv.txNum).trim() || (cleanDoc(item.num).length >= 2 && cleanDoc(item.num) === cleanDoc(inv.txNum)))) {
            return true;
          }

          // Fallback to conservative match (supplier + description + amount + month)
          const sameDesc = String(inv.orderDesc || '').trim() === oDesc;
          const sameTotal = parseFloat(inv.orderTotal || 0).toFixed(2) === oTotal;
          return sameDesc && sameTotal && (sameMonth || !oMonth || !inv.orderMonth);
        });

        // Auto-infer invoice status according to AGENTS.md business rules
        let status = 'order';
        const hasTaxDetails = _rawHasTax || isValidTextField(item.num) || isValidTextField(item.date) || isPositiveNum(item.total) || isPositiveNum(item.amt);
        const hasTxDetails  = _rawHasTx || isValidTextField(item.txNum) || isValidTextField(item.txDate) || isPositiveNum(item.txTotal) || isPositiveNum(item.txAmt);
        
        if (hasTaxDetails) {
          const isExempt = (window.supEx && window.supEx[sName] && (window.supEx[sName].entityType==='עוסק פטור'||window.supEx[sName].entityType==='עמותה'));
          status = isExempt ? 'receipt' : (hasTxDetails ? 'tax_receipt' : 'tax_invoice');
        } else if (hasTxDetails) {
          status = 'tx_invoice';
        }

        const notesLower = String(item.notes || '').toLowerCase();
        const dateLower = String(item.date || '').toLowerCase();
        const descLower = String(item.orderDesc || '').toLowerCase();
        if (['בוטל', 'מבוטל'].some(w => notesLower.includes(w) || dateLower.includes(w) || descLower.includes(w))) {
          status = 'cancelled';
        }
        
        item.status = status;

        if (existingIdx !== -1) {
          const inv = window.INVOICES[existingIdx];
          
          // Check if the excel row is practically identical to the existing record
          // This happens when the user uploads the same Excel file again.
          const isIdentical = 
            (String(item.orderNum||'').trim() === String(inv.orderNum||'').trim()) &&
            (String(item.txNum||'').trim() === String(inv.txNum||'').trim()) &&
            (String(item.num||'').trim() === String(inv.num||'').trim()) &&
            (String(item.orderDesc||'').trim() === String(inv.orderDesc||'').trim()) &&
            (parseFloat(item.orderTotal||0).toFixed(2) === parseFloat(inv.orderTotal||0).toFixed(2));

          let action = applyToAllAction;
          
          if (!action && isIdentical) {
            action = 'merge'; // Silently merge (update) without bothering the user
          }
          
          if (!action && skipConfirm) {
            action = 'merge'; // Auto-refresh mode: always merge without prompting
          }
          
          if (!action) {
            const res = await window.promptDuplicateResolution(item, inv);
            action = res.action;
            if (res.applyToAll) {
              applyToAllAction = action;
            }
          }
          
          if (action === 'skip') {
            skipped++;
            continue; // Skip this row entirely
          } else if (action === 'keep') {
            item.id = Date.now() + Math.floor(Math.random() * 10000);
            window.INVOICES.push(item);
            added++;
          } else {
            // 'merge' action
            const cleanItem = {};
            Object.keys(item).forEach(k => {
              if (item[k] !== undefined && item[k] !== null && item[k] !== '') {
                cleanItem[k] = item[k];
              }
            });
            window.INVOICES[existingIdx] = { ...window.INVOICES[existingIdx], ...cleanItem };
            updated++;
          }
        } else {
          // Add new record
          item.id = Date.now() + Math.floor(Math.random() * 10000);
          window.INVOICES.push(item);
          added++;
        }

        // Auto-Register Supplier Card
        if (sName) {
          if (typeof window.supEx !== 'undefined') {
            if (!window.supEx[sName]) {
              window.supEx[sName] = {
                isPurch: true,
                isAct: false,
                ph1: item.phone || '',
                g1: item.tax || '',
                entityType: '',
                notes: 'נוצר אוטומטית מייבוא רכש'
              };
            }
            const inSupbase = Array.isArray(window.SUPBASE) && window.SUPBASE.some(s => (typeof window.supBase === 'function' ? window.supBase(s.name) : s.name) === sName);
            if (!window.supEx['__c']) window.supEx['__c'] = [];
            const inCustom = window.supEx['__c'].some(s => (typeof window.supBase === 'function' ? window.supBase(s.name) : s.name) === sName);
            if (!inSupbase && !inCustom) {
              window.supEx['__c'].push({
                name: sName,
                phone: item.phone || ''
              });
            }
          }
        }
      }

      _spAlertDialog(`✅ סיום ייבוא: נוספו ${added} חדשות, עודכנו ${updated} קיימות. ${skipped > 0 ? `(דולגו ${skipped} כפילויות)` : ''}`);
      if (typeof renderInvoices === "function") renderInvoices();
      if (typeof renderPurchSuppliers === "function") renderPurchSuppliers();
      if (typeof refreshPurchDash === "function") refreshPurchDash();
      
      console.log('[Import-Purch] Saving to Firebase...', { count: window.INVOICES.length });
      if (typeof window.save === "function") {
        try {
          const ok = await window.save(true);
          console.log('[Import-Purch] window.save result:', ok);
          if (ok) {
            window.showToast('✅ הנתונים סונכרנו בהצלחה');
          } else {
            _spAlertDialog('⚠️ הנתונים יובאו מקומית אך הסנכרון לענן נכשל. נסה לשמור ידנית.');
          }
        } catch (err) {
          console.error('[Import-Purch] Save failed:', err);
          _spAlertDialog('❌ שגיאה בסנכרון לענן: ' + err.message);
        }
      }
      
      
      if (input && input.value !== undefined) input.value = ""; // Reset input

      if (window._runScannerAfterImport) {
        window._runScannerAfterImport = false;
        setTimeout(() => {
          window.startSharePointScanner();
        }, 1500);
      }
      resolve();

    } catch (err) {
      console.error("Import error:", err);
      _spAlertDialog("שגיאה בתהליך הייבוא: " + err.message);
      window._runScannerAfterImport = false;
      reject(err);
    }
  };
  reader.readAsArrayBuffer(file);
  });
};

window.clearScannerLinks = async function() {
  if (!await window.spConfirm('האם אתה בטוח שברצונך לנתק את כל קבצי ה-PDF והתמונות ששודכו לחשבוניות עד כה?\n(החשבוניות עצמן לא יימחקו, רק הקבצים ינותקו).')) return;
  let count = 0;
  window.INVOICES.forEach(inv => {
    if (inv.file_tax || inv.file_tx || inv.file_order) {
      delete inv.file_tax;
      delete inv.file_tx;
      delete inv.file_order;
      count++;
    }
  });
  window.save(true);
  if (typeof window.renderInvoices === 'function') window.renderInvoices();
  _spAlertDialog(`נותקו קבצים מ-${count} חשבוניות בהצלחה!`);
};

window.deleteAllInvoices = async function() {
  const ans = await window.asyncConfirm('<b>⚠️ אזהרה חמורה!</b>\n\nהאם אתה בטוח שברצונך למחוק לחלוטין את כל נתוני הרכש והחשבוניות מהמערכת?\nפעולה זו תאפשר לך להתחיל דף חלק ולייבא את האקסל מחדש.\n\n• לחץ <b>אישור</b> כדי למחוק הכל.\n• לחץ <b>סיום ובדיקה</b> כדי לבטל.');
  if (ans) {
    window.INVOICES = [];
    localStorage.removeItem('spScannerAliases');
    window.spScannerAliases = {};
    if (typeof window.save === 'function') await window.save(true);
    if (typeof window.renderInvoices === 'function') window.renderInvoices();
    if (typeof window.refreshPurchDash === 'function') window.refreshPurchDash();
    _spAlertDialog('✅ כל החשבוניות נמחקו בהצלחה. המערכת מוכנה לייבוא מחדש.');
  }
};

window.asyncPrompt = function(message, defaultText = '') {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.style.padding = '20px';
    dialog.style.borderRadius = '8px';
    dialog.style.border = '1px solid #ccc';
    dialog.style.fontFamily = 'system-ui, sans-serif';
    dialog.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    dialog.style.direction = 'rtl';
    dialog.style.maxWidth = '450px';
    dialog.style.zIndex = '9999';

    const p = document.createElement('p');
    p.innerHTML = message.replace(/\n/g, '<br>');
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultText;
    input.style.width = '100%';
    input.style.padding = '8px';
    input.style.marginTop = '10px';
    input.style.marginBottom = '20px';
    input.style.boxSizing = 'border-box';
    
    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '10px';
    
    const okBtn = document.createElement('button');
    okBtn.innerText = 'אישור';
    okBtn.style.padding = '6px 16px';
    okBtn.style.background = '#e3f2fd';
    okBtn.style.border = '1px solid #90caf9';
    okBtn.style.color = '#0d47a1';
    okBtn.style.borderRadius = '4px';
    okBtn.style.cursor = 'pointer';
    okBtn.onclick = () => {
      resolve(input.value);
      dialog.close();
      dialog.remove();
    };
    
    const cancelBtn = document.createElement('button');
    cancelBtn.innerText = 'ביטול';
    cancelBtn.style.padding = '6px 16px';
    cancelBtn.style.background = '#f5f5f5';
    cancelBtn.style.border = '1px solid #ccc';
    cancelBtn.style.color = '#333';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.onclick = () => {
      resolve(null);
      dialog.close();
      dialog.remove();
    };
    
    btnContainer.appendChild(okBtn);
    btnContainer.appendChild(cancelBtn);
    
    dialog.appendChild(p);
    dialog.appendChild(input);
    dialog.appendChild(btnContainer);
    
    document.body.appendChild(dialog);
    dialog.showModal();
    input.focus();
  });
};

window.asyncConfirm = function(message) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.style.padding = '20px';
    dialog.style.borderRadius = '8px';
    dialog.style.border = '1px solid #ccc';
    dialog.style.fontFamily = 'system-ui, sans-serif';
    dialog.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    dialog.style.direction = 'rtl';
    dialog.style.maxWidth = '450px';
    dialog.style.zIndex = '9999';

    const p = document.createElement('p');
    p.innerHTML = message.replace(/\n/g, '<br>');
    
    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '10px';
    btnContainer.style.marginTop = '20px';
    
    const okBtn = document.createElement('button');
    okBtn.innerText = 'אישור (OK)';
    okBtn.style.padding = '6px 16px';
    okBtn.style.background = '#e3f2fd';
    okBtn.style.border = '1px solid #90caf9';
    okBtn.style.color = '#0d47a1';
    okBtn.style.borderRadius = '4px';
    okBtn.style.cursor = 'pointer';
    okBtn.onclick = () => {
      resolve(true);
      dialog.close();
      dialog.remove();
    };
    
    const cancelBtn = document.createElement('button');
    cancelBtn.innerText = 'סיום ובדיקה (Cancel)';
    cancelBtn.style.padding = '6px 16px';
    cancelBtn.style.background = '#ffebee';
    cancelBtn.style.border = '1px solid #ffcdd2';
    cancelBtn.style.color = '#c62828';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.onclick = () => {
      resolve(false);
      dialog.close();
      dialog.remove();
    };
    
    btnContainer.appendChild(okBtn);
    btnContainer.appendChild(cancelBtn);
    
    dialog.appendChild(p);
    dialog.appendChild(btnContainer);
    
    document.body.appendChild(dialog);
    dialog.showModal();
  });
};

