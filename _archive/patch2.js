const fs = require('fs');
let text = fs.readFileSync('invoices.js', 'utf8');
text = text.replace(
  'window.importInvoices = async function(input) {\n  if(await window.asyncConfirm(<b>׳©׳™׳  ׳œ׳‘:</b><br><br>׳”׳ ׳  ׳œ׳ž׳—׳•׳§ ׳§׳•׳“׳  ׳ ׳× ׳›׳œ ׳”׳—׳©׳‘׳•׳ ׳™׳•׳× (׳•׳›׳œ ׳”׳§׳‘׳¦׳™׳  ׳©׳§׳™׳©׳¨׳× ׳ ׳œ׳™׳”׳Ÿ ׳¢׳“ ׳›׳”) ׳•׳œ׳™׳™׳‘׳  ׳ ׳× ׳”׳ ׳§׳¡׳œ ׳›׳¨׳©׳™׳ž׳” ׳—׳“׳©׳” ׳œ׳’׳ž׳¨׳™?<br><br>ג€¢ ׳‘׳—׳¨ <b>׳ ׳™׳©׳•׳¨</b> ׳›׳“׳™ ׳œ׳ž׳—׳•׳§ ׳”׳›׳œ ׳œ׳₪׳ ׳™ ׳”׳™׳™׳‘׳•׳  (׳ž׳•׳ž׳œ׳¥ ׳›׳“׳™ ׳œ׳ ׳§׳•׳× ׳˜׳¢׳•׳™׳•׳× ׳ž׳”׳¢׳‘׳¨, ׳×׳¦׳˜׳¨׳š ׳œ׳¡׳¨׳•׳§ ׳ ׳× ׳”׳×׳™׳§׳™׳™׳” ׳©׳•׳‘).<br>ג€¢ ׳‘׳—׳¨ <b>׳‘׳™׳˜׳•׳œ</b> ׳›׳“׳™ ׳œ׳¢׳“׳›׳Ÿ ׳—׳©׳‘׳•׳ ׳™׳•׳× ׳§׳™׳™׳ž׳•׳× ׳•׳œ׳©׳ž׳•׳¨ ׳¢׳œ ׳§׳‘׳¦׳™׳  ׳ž׳§׳•׳©׳¨׳™׳ .)) { window.INVOICES = []; if(window.save) await window.save(true); }',
  'window.importInvoices = async function(input) {\n  if(await window.asyncConfirm(<b>שים לב:</b><br><br>האם למחוק קודם את כל החשבוניות (וכל הקבצים שקישרת אליהן עד כה) ולייבא את האקסל כרשימה חדשה לגמרי?<br><br>• בחר <b>אישור</b> כדי למחוק הכל לפני הייבוא (מומלץ כדי לנקות טעויות מהעבר, תצטרך לסרוק את התיקייה שוב).<br>• בחר <b>ביטול</b> כדי לעדכן חשבוניות קיימות ולשמור על קבצים מקושרים.)) { window.INVOICES = []; if(window.save) await window.save(true); }'
);
fs.writeFileSync('invoices.js', text, 'utf8');
