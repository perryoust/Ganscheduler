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

---

## 8. ייצוא רכזים וגנים ועריכת גנים מרוכזת בטבלה
- **מקור הנתונים**: `managers` (או `window.managers`), תוך בדיקה והצלבה כנגד `AG()` והגנים שמשויכים לרכז ב-`gardenIds` או ב-`g.co`.
- **טלפון בגן**: נשלף במדויק מ-`supEx['g_' + g.id].coph` (הטלפון הישיר של הגן שהוזן בעריכת גן) או מ-`g.coph` / `g.phone`.
- **גיל הגן**: נשלף דרך `window.extractGardenAge(g)` לפי קדימות: ראשית `supEx['g_' + g.id].age` (הגיל שהוזן ידנית בכרטיס הגן או בטבלת הגילאים), לאחר מכן `g.age`, ולבסוף חילוץ Regex משם הגן.
- **סינון לפי ספק חוגים בלבד (`getActiveSupplierNames`)**: מציג אך ורק ספקי חוגים אמיתיים (`window.isActSupplier` פעיל, בעלי פעילויות ב-SCH או ב-SUPBASE), תוך סינון מלא של ספקי רכש/הסעות/קייטרינג.
- **מיון דוחות לפי עיר**: גיליון האקסל הראשי ("כל הרכזים והגנים") וקובץ ה-CSV ממוינים בראש ובראשונה לפי **עיר הגן**, לאחר מכן לפי שם הרכז/ת, ולאחר מכן לפי שם הגן.
- **טבלת עריכת גנים מרוכזת לפי עיר (`garden-age-batch-m` / "📋 עריכת גנים בטבלה")**: ממשק טבלאי מהיר להזנה ועריכה של **רכז/ת אחראי/ת, כתובת, טלפון ישיר בגן וגילאי הגנים** ברצף לפי עיר. כל שדה נשמר אוטומטית מקומית וב-Firebase ומסומן בחיווי וי ירוק (✓), עם תמיכה במקשי חצים / Enter למעבר מהיר בין שורות, כפתורי תגיות גיל מהירים (`3-4`, `4-5` וכו'), וכפתור שמירה גורפת.
- **פורמטי ייצוא**:
  1. **ExcelJS**: עיצוב עברי RTL מלא, כותרת עליונה מעוצבת לפי ספק חוגים/רכז, כותרות עמודות קפואות, עמודת גיל מובנית, סימון מספרי טלפון, וגיליונות נפרדים לכל רכז.
  2. **WhatsApp / הודעה**: פורמט טקסטואלי נקי ומסודר לפי ערים עם פרטי רכז, גיל הגן, כתובות, טלפון הגן ופירוט פעילות המפעיל.
- **דוח שיבוצים לספק (לפני ביצוע - סידור עבודה לספק / `supplier_placement`)**:
  כולל עמודת **גיל** מיד לאחר שם הגן (`רחוב` ⬅️ `גן/בי"ס` ⬅️ `גיל` ⬅️ `תאריך`...), בעיצוב RTL וביישור למרכז.

---

## 9. ניהול משימות שטח וסנכרון עובד (`worker_tasks.js` & `firebase.js`)
- **משימות שטח לעובד (`worker-app-root` / `renderWorkerTasksMobile`)**:
  עובדי שטח פועלים במצב `isWorkerOnlyMode` שאינו מושך את כל מסד השיבוצים הכבד (SCH).
- **הצגת גנים חדשים (`_GARDENS_EXTRA`)**:
  בעת פתיחת מקום/צהרון חדש (כגון בתי ספר או צהרונים שנפתחו ידנית), הנתונים נשמרים הן ב-`supEx['__gardens_extra']` והן בנתיב הממוקד `/data/custom_gardens.json` ב-Firebase. אפליקציית העובד טוענת נתיב זה לצד משימות השטח.
- **תצוגת משימות להיום ולמחר (`wtWorkerActiveTab`)**:
  באפליקציית עובד השטח, המשימות מחולקות כעת לטאבים ולמקטעים ברורים:
  1. `📋 הכל`: מציג גם את משימות היום וגם את משימות המחר בחלוקה למקטעים עם כותרות תאריך מפורטות.
  2. `📅 היום`: מציג משימות להיום כולל משימות פתוחות מימים קודמים.
  3. `🌅 מחר`: מציג משימות המתוכננות למחר עם תגית ייעודית כתומה `🌅 למחר`.



