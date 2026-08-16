---
name: ganscheduler-knowledge
description: >-
  Comprehensive knowledge base for GanScheduler project. Covers Hebrew/RTL support 
  in Excel exports, Firebase RTDB patterns, invoice classification logic, ExcelJS 
  quirks, VAT calculations, and deployment workflow. Use this skill when working on 
  any GanScheduler feature involving Hebrew text, Excel import/export, database 
  operations, or invoice processing.
---

# GanScheduler — ידע טכני צבור (Known Issues & Best Practices)

## 1. עברית ו-RTL — בעיות ופתרונות

### 1.1 ייצוא אקסל עם ExcelJS
**בעיה**: טקסט עברי מוצג הפוך או משובש בקבצי Excel שיוצאו.
**פתרון מיושם**:
- כל worksheet חייב להגדיר `rightToLeft: true` ב-views:
  ```js
  ws.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }];
  ```
- כל cell עם טקסט עברי חייב `readingOrder: 'rightToLeft'`:
  ```js
  cell.alignment = { horizontal: 'right', vertical: 'middle', readingOrder: 'rightToLeft' };
  ```

### 1.2 CSV Fallback לעברית
**בעיה**: כשלא נטען ExcelJS, ייצוא CSV מציג ג'יבריש באקסל.
**פתרון מיושם**: הוספת UTF-8 BOM בתחילת הקובץ:
```js
const bom = '\uFEFF';
const csv = bom + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
```

### 1.3 שמות קבצים בעברית
**בעיה**: שמות קבצים בעברית נשברים בעת הורדה.
**פתרון**: השתמש ב-`encodeURIComponent` לשם הקובץ ב-Content-Disposition, או צור שם קובץ ASCII-safe עם סיומת `.xlsx`.

---

## 2. Firebase Realtime Database — בעיות ופתרונות

### 2.1 מבנה נתונים שטוח
**כלל**: Firebase RTDB עובד בצורה הטובה ביותר עם מבנה שטוח (denormalized). הפרויקט מאחסן חשבוניות ב-`/invoices`, הזמנות ב-`/orders`, וספקים ב-`/data`.

### 2.2 PATCH vs PUT
**בעיה**: שימוש ב-PUT מוחק שדות קיימים.
**פתרון מיושם**: תמיד להשתמש ב-PATCH (idempotent updates) כדי לעדכן רק שדות שהשתנו.

### 2.3 Security Rules — UID של אדמין
**כלל**: UID האדמין הראשי הוא `VW5FCIlBb9VS4Eo1BTKyCxq5xa03`. חוקי האבטחה מבדילים בין:
- `permAct` = הרשאות פעילות/שיבוצים
- `permPurch` = הרשאות רכש/חשבוניות

### 2.4 גיבוי ושחזור
**כלל**: לפני כל עדכון מאסיבי (ייבוא אקסל), לשמור גיבוי JSON מקומי ב-`backup.json`.

---

## 3. חשבוניות — סיווג מסמכים (invoices.js)

### 3.1 היררכיית סיווג
| סטטוס | תנאי | תצוגה |
|:---|:---|:---|
| `order` | אין מספר חשבונית עסקה ולא חשבונית מס | 📋 הזמנה |
| `tx_invoice` | יש מספר חשבונית עסקה, אין חשבונית מס | 🧾 חשבונית עסקה |
| `tax_invoice` | יש מספר חשבונית מס | 📑 חשבונית מס |
| `tax_receipt` | יש חשבונית מס + חשבונית עסקה | 📑🧾 חשבונית מס קבלה |
| `receipt` | ספק עוסק פטור/עמותה | 🧾 קבלה |

### 3.2 כלל "חשבונית מס מנצח"
**כלל קריטי**: בשם קובץ, אם מופיעות גם "חשבונית מס" וגם "חשבון עסקה", הסיווג הוא **תמיד** `tax_invoice`.

### 3.3 ערכי אפס = ריק
**כלל**: בפענוח Excel, ערכי `"0"`, `"0.0"`, `"0.00"` בשדות `total` ו-`amt` נחשבים כריקים ולא כערכים תקינים.

### 3.4 Auto-Refresh Safety
**כלל**: בעת ייבוא/מיזוג אקסל, **לא** לדרוס סטטוס קיים אלא אם כן הנתון החדש מוכיח שדרוג (למשל, מ-`tx_invoice` ל-`tax_invoice`).

---

## 4. ExcelJS — בעיות ידועות

### 4.1 קונפליקט JSZip
**בעיה**: ExcelJS דורסת את `window.JSZip` כשנטענת.
**פתרון מיושם**: שמירת העותק המקורי של JSZip לפני טעינת ExcelJS:
```js
// בטעינת הדף, לפני ExcelJS
window._SafeJSZip = window.JSZip;
```

### 4.2 טעינה אסינכרונית
**בעיה**: ExcelJS לא תמיד נטענת בזמן. המשתמש לוחץ "ייצוא" לפני הטעינה.
**פתרון מיושם**: בדיקה `typeof window.ExcelJS !== 'undefined'` לפני כל ייצוא, עם fallback ל-CSV.

### 4.3 פורמט תאריכים
**בעיה**: תאריכים בפורמט `dd/mm/yyyy` (ישראלי) לא מוצגים נכון באקסל.
**פתרון**: להגדיר `cell.numFmt = 'dd/mm/yyyy'` ולהעביר אובייקט `Date` ולא string.

---

## 5. Firebase Deploy — בעיות ותקלות

### 5.1 גרסה גלובלית בלבד
**כלל**: להשתמש ב-`firebase deploy --only hosting` הגלובלית, **לא** מתוך `node_modules`.

### 5.2 Version Bump
**כלל**: לפני כל deploy, לעדכן את הגרסה ב-3 מקומות ב-`index.html`:
1. תגית `<title>` (שורה 16)
2. CSS query string `styles.css?v=` (שורה 22)
3. משתנה `window.APP_VERSION` (שורה 26)

### 5.3 Cache Busting
**כלל**: `firebase.json` מגדיר `Cache-Control: no-cache` לקבצי HTML, אך JS/CSS דורשים query string (`?v=XXX`) לרענון.

---

## 6. מע"מ וחישובים

### 6.1 שיעור מע"מ
- ברירת מחדל: `window.VAT_RATE` (כרגע 18%)
- עוסק פטור / עמותה: מע"מ 0%

### 6.2 נוסחת חישוב
```
amt = total / (1 + vat/100)    // סכום לפני מע"מ
vatAmt = total - amt           // סכום מע"מ
```

---

## 7. MCP — שרתים פעילים

| שרת | תפקיד | סטטוס |
|:---|:---|:---|
| `firebase-mcp-server` | ניהול Firebase (DB, Auth, Deploy, Rules) | ✅ פעיל |
| `visualization` | תרשימים וגרפים | ✅ פעיל |
| `google-developer-knowledge` | חיפוש תיעוד | ✅ פעיל |

**שרתים שהוסרו** (לא רלוונטיים): `context`, `notebooks`, `data-agent-kit`, `google-compute-engine`, `datacloud_cloud-sql_remote`.
