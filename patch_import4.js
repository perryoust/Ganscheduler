const fs = require('fs');
let code = fs.readFileSync('invoices.js', 'utf8');

// Replace importInvoices header
const target1 = "window.importInvoices = async function(input) {\n    if(await window.asyncConfirm(<b>שים לב:</b><br><br>האם למחוק קודם את כל החשבוניות (וכל הקבצים שקישרת אליהן עד כה) ולייבא את האקסל כרשימה חדשה לגמרי?<br><br>• בחר <b>אישור</b> כדי למחוק הכל לפני הייבוא (מומלץ כדי לנקות טעויות מהעבר, תצטרך לסרוק את התיקייה שוב).<br>• בחר <b>ביטול</b> כדי לעדכן חשבוניות קיימות ולשמור על קבצים מקושרים.)) { window.INVOICES = []; if(window.save) await window.save(true); }\n    const file = input.files[0];\n    if (!file) return;\n  \n    if (typeof window.XLSX === \"undefined\") {";

const replacement1 = window.importInvoices = async function(input) {
    if(await window.asyncConfirm('<b>שים לב:</b><br><br>האם למחוק קודם את כל החשבוניות (וכל הקבצים שקישרת אליהן עד כה) ולייבא את האקסל כרשימה חדשה לגמרי?<br><br>• בחר <b>אישור</b> כדי למחוק הכל לפני הייבוא (מומלץ כדי לנקות טעויות מהעבר, תצטרך לסרוק את התיקייה שוב).<br>• בחר <b>ביטול</b> כדי לעדכן חשבוניות קיימות ולשמור על קבצים מקושרים.')) { window.INVOICES = []; if(window.save) await window.save(true); }
    
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
  
    if (typeof window.XLSX === "undefined") {;

code = code.replace(target1, replacement1);

// Update startSharePointScanner to save handles
const target2 =     // ─── Step 1: Pick first folder (requires direct user gesture)
    let dirHandle;
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'read' });
    } catch (e) { return; };

const replacement2 =     // ─── Step 1: Pick first folder (requires direct user gesture)
    let dirHandle;
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      if (window._spIdbSet) await window._spIdbSet('invDirHandle1', dirHandle);
    } catch (e) { return; };

code = code.replace(target2, replacement2);

const target3 =         if (doSecond) {
          try {
            dirHandle2 = await window.showDirectoryPicker({ mode: 'read' });
          } catch(e) {}
        };

const replacement3 =         if (doSecond) {
          try {
            dirHandle2 = await window.showDirectoryPicker({ mode: 'read' });
            if (dirHandle2 && window._spIdbSet) await window._spIdbSet('invDirHandle2', dirHandle2);
          } catch(e) {}
        };

code = code.replace(target3, replacement3);

// Replace button in index.html
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(
   '<button class="btn" style="background:#0277bd;color:#fff" onclick="document.getElementById(\'pi-import-input-moved\').click()" title="ייבוא אקסל">📊 ייבוא אקסל</button>',
   '<button class="btn" style="background:#0277bd;color:#fff" onclick="window.importInvoices()" title="ייבוא אקסל">📊 ייבוא אקסל</button>'
);

html = html.replace(
   '<button class="btn" style="background:#2e7d32;color:#fff" onclick="window.runImportAndScan()" title="ייבוא וסריקה מרוכזת">⚡ ייבוא + סריקה</button>',
   '<button class="btn" style="background:#2e7d32;color:#fff" onclick="window.autoRefreshPurchasing()" title="רענון אוטומטי מלא (אקסל ותיקיות) על סמך שמירות קודמות">⚡ רענון אוטומטי</button>'
);

fs.writeFileSync('invoices.js', code);
fs.writeFileSync('index.html', html);
console.log('Success applied patches');
