const fs = require('fs');
let text = fs.readFileSync('invoices.js', 'utf8');
let lines = text.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('await window.asyncConfirm(<b')) {
    lines[i] = '  if(await window.asyncConfirm(<b>שים לב:</b><br><br>האם למחוק קודם את כל החשבוניות (וכל הקבצים שקישרת אליהן עד כה) ולייבא את האקסל כרשימה חדשה לגמרי?<br><br>• בחר <b>אישור</b> כדי למחוק הכל לפני הייבוא (מומלץ כדי לנקות טעויות מהעבר, תצטרך לסרוק את התיקייה שוב).<br>• בחר <b>ביטול</b> כדי לעדכן חשבוניות קיימות ולשמור על קבצים מקושרים.)) { window.INVOICES = []; if(window.save) await window.save(true); }';
  }
}
fs.writeFileSync('invoices.js', lines.join('\n'), 'utf8');
