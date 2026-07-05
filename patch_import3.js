const fs = require('fs');
let code = fs.readFileSync('invoices.js', 'utf8');
const regex = /window\.importInvoices = async function\(input\) \{[\s\S]*?if \(\!file\) return;

  if \(typeof window\.XLSX === \"undefined\"\) \{
    _spAlertDialog\(\"שגיאה: ספריית XLSX לא נטענה\. אנא רענן את הדף\.\"\);
    return;
  \}/;
const replacement = 'window.importInvoices = async function(input) {
  if(await window.asyncConfirm('<b>שים לב:</b><br><br>האם למחוק קודם את כל החשבוניות (וכל הקבצים שקישרת אליהן עד כה) ולייבא את האקסל כרשימה חדשה לגמרי?<br><br>• בחר <b>אישור</b> כדי למחוק הכל לפני הייבוא (מומלץ כדי לנקות טעויות מהעבר, תצטרך לסרוק את התיקייה שוב).<br>• בחר <b>ביטול</b> כדי לעדכן חשבוניות קיימות ולשמור על קבצים מקושרים.')) { window.INVOICES = []; if(window.save) await window.save(true); }
  
  let file;
  if (!input) {
    if (window.showOpenFilePicker) {
      try {
        const [fileHandle] = await window.showOpenFilePicker({
          types: [{ description: 'Excel Files', accept: {'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [.xlsx], 'application/vnd.ms-excel': [.xls]} }]
        });
        if (window._spIdbSet) await window._spIdbSet('invExcelFileHandle', fileHandle);
        file = await fileHandle.getFile();
      } catch(e) {
        return;
      }
    } else {
      document.getElementById('pi-import-input-moved').click();
      return;
    }
  } else {
    file = input.files[0];
    if (!file) return;
  }

  if (typeof window.XLSX === 'undefined') {
    _spAlertDialog('שגיאה: ספריית XLSX לא נטענה. אנא רענן את הדף.');
    return;
  }';
if (regex.test(code)) {
   code = code.replace(regex, replacement);
   fs.writeFileSync('invoices.js', code);
   console.log('Success');
} else {
   console.log('Regex did not match');
}
