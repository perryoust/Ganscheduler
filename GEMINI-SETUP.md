# Google Gemini Integration Guide

## 📝 שלבים להתקנה

### 1️⃣ קבל Google API Key
```
🌐 https://makersuite.google.com/app/apikey
```
- לחץ "Create new API key"
- Copy את הkey

### 2️⃣ עדכן `.claude/settings.json`
```json
"environment": {
  "GOOGLE_API_KEY": "paste_your_actual_key_here",
  "GOOGLE_PROJECT_ID": "your_project_id"
}
```

### 3️⃣ בדוק את הקשר
```bash
npm install axios
node gemini.js
```

---

## 💻 שימוש בקוד

### בסיסי - Generate
```javascript
const GeminiConnector = require('./gemini.js');
const gemini = new GeminiConnector(
  process.env.GOOGLE_API_KEY,
  process.env.GOOGLE_PROJECT_ID
);

// Generate text
const result = await gemini.generate('Your prompt here');
console.log(result.text);
```

### ניתוח קוד
```javascript
const codeAnalysis = await gemini.analyzeCode(
  myCode,
  'javascript'
);
console.log(codeAnalysis.text);
```

### עדכון קוד
```javascript
const refactored = await gemini.refactorCode(
  invoicesCode,
  'javascript',
  'Optimize for large datasets (200K+ rows)'
);
```

### דוקומנטציה
```javascript
const docs = await gemini.generateDocumentation(
  coreJsCode,
  'javascript'
);
```

---

## 🔗 Integration עם GanScheduler

### כדי להשתמש בחשבוניות (invoices.js):
```javascript
const GeminiConnector = require('./gemini.js');

// In your import/export process
async function analyzeImportedInvoices(invoiceData) {
  const gemini = new GeminiConnector(
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_PROJECT_ID
  );

  const analysis = await gemini.generate(`
    Analyze these invoice records for duplicates and anomalies:
    ${JSON.stringify(invoiceData, null, 2)}
    
    Return:
    1. Duplicate detection
    2. Field validation issues
    3. Recommendations
  `);

  return analysis.text;
}
```

---

## 📊 דוגמאות עבודה

### קוד מלא
```javascript
const GeminiConnector = require('./gemini.js');
const fs = require('fs');

async function main() {
  const gemini = new GeminiConnector(
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_PROJECT_ID
  );

  // Read code file
  const code = fs.readFileSync('invoices.js', 'utf8');

  // Analyze
  const analysis = await gemini.analyzeCode(code, 'javascript');
  console.log('Analysis:', analysis.text);

  // Refactor
  const refactored = await gemini.refactorCode(
    code,
    'javascript',
    'Improve performance for large invoice datasets'
  );
  console.log('Refactored:', refactored.text);
}

main().catch(console.error);
```

---

## 🚨 בעיות נפוצות

| בעיה | פתרון |
|------|-------|
| API key invalid | בדוק ב-makersuite.google.com שהkey יש תוקף |
| Connection timeout | בדוק Internet וחוברים ל-Google services |
| Rate limit exceeded | המתן או דקדוק תכנית תשלום |
| CORS error | השתמש ב-server-side (Node.js) לא browser |

---

## 🎯 Use Cases עבור GanScheduler

1. **Invoice Analysis** → Detect duplicates, validate fields
2. **Code Generation** → Generate helper functions
3. **Documentation** → Auto-generate JSDoc comments
4. **Performance Tuning** → Optimize large file handling
5. **Data Validation** → Check integrity of imported data
