# GanScheduler - Project Documentation

## 📋 Project Overview
**GanScheduler** הוא מערכת ניהול לוחות זמנים וחשבוניות עם תמיכה ב-Firebase ו-Google Cloud.

### בנויה מ:
- Frontend: HTML5 + CSS3 + Vanilla JS (194KB)
- Backend: Node.js scripts
- Storage: Firebase + Local JSON
- Data: Excel files (XLSX)

---

## 📁 Structure

### Core Files
| File | Size | Purpose |
|------|------|---------|
| `index.html` | 194KB | UI ממשק |
| `core.js` | 152KB | לוגיקה ליבה |
| `invoices.js` | 1MB | ניהול חשבוניות |
| `activity.js` | 117KB | רישום פעילויות |
| `gardens.js` | 99KB | ניהול גנים |

### Integration Files
- `firebase.js` - Firebase SDK wrapper
- `firebase_init.js` - Firebase קונפיגורציה
- `import_export.js` - Import/Export utilities

### Utilities
- `data.js` - מניפולציית נתונים
- `utils.js` - פונקציות עזר
- `data_manager.js` - ניהול מערכת הנתונים

### Data Files
- `GAN.xlsx` / `gan_import.xlsx` - ייבוא רעיוני
- `invoices.xlsx` - חשבוניות
- `backup.json` - גיבוי מלא
- `payload.json` - נתוני payload
- `sraws.json` - נתוני raw

### Backup & Scripts
```
_backups/          - גיבויים היסטוריים
scratch/           - קבצי עבודה זמניים
test_purch*.js     - בדיקות procurement
fix*.js            - Fix scripts
```

---

## 🔧 Setup & Configuration

### 1. Google Cloud Setup
```bash
# הוסף API keys ל-.claude/settings.json
GOOGLE_API_KEY="your_api_key"
GOOGLE_PROJECT_ID="your_project"
```

### 2. Firebase Configuration
```javascript
// firebase_init.js מכיל:
// - projectId
// - apiKey
// - authDomain
// - databaseURL
```

### 3. Agent Configuration
```json
// .claude/settings.json
{
  "agents": {
    "scheduler": {...},
    "googleCloud": {...}
  }
}
```

---

## 💾 Data Management

### Import Process
1. Excel file → `import_export.js`
2. Parse + Validate
3. Check duplicates → `fix_invoices.js`
4. PATCH to Firebase (idempotent)
5. Backup local JSON

### Export Process
1. Firebase → Local JSON
2. Validate integrity
3. Generate Excel report
4. Archive to `_backups/`

### Known Issues & Fixes
- **Duplicates**: Run `fix_invoices.js` before import
- **Integrity**: `fix2.js` validates field preservation
- **Sync**: PATCH method prevents overwrites

---

## 🚀 Common Tasks

### Sync with Firebase
```bash
node firebase.js
```

### Import Invoices (with verification)
```bash
node import_export.js
node fix_invoices.js  # Verify integrity
```

### Analyze Live Data
```bash
node test_purch_live.js
```

### Generate Reports
```bash
node export.js  # Creates HTML + JSON
```

---

## 🔐 Security

### API Keys
- Store in `.claude/settings.json` (git-ignored)
- Use environment variables only
- Rotate regularly

### Data Protection
- Local backups in `_backups/`
- Field-level validation on all updates
- Idempotent operations (no data loss)

---

## 📊 Performance Notes

### Large Files
- `invoices.xlsx`: 200K+ rows
- `backup.json`: 3.3MB
- `payload.json`: 8.1MB
- Cache strategy: Load on demand

### Firebase Sync
- Batch PATCH operations
- Exponential backoff on errors
- 3 retry attempts

---

## 🤖 Claude Agent Integration

### Available Agents
1. **Scheduler-Core**: Code fixes & logic
2. **Firebase-Sync**: Data synchronization
3. **Google-Cloud-Analyzer**: Data analysis & reporting

### Using Agents
```
/claude agent:scheduler-core "fix invoice import"
/claude agent:firebase-sync "sync to firebase"
/claude agent:google-cloud "analyze duplicates"
```

---

## 📞 Support

### Common Questions
- **Sync not working?** Check `firebase_init.js` config
- **Import fails?** Run `fix_invoices.js` first
- **Large file slow?** Use `--batch` flag

### Debugging
```bash
node -e "console.log(require('./firebase.js').config)"
```

---

## ✅ Checklist for New Features
- [ ] Add to appropriate module (core.js, data.js, etc.)
- [ ] Update `activity.js` logging
- [ ] Test with `test_purch*.js`
- [ ] Verify Firebase sync works
- [ ] Backup data before deploy
- [ ] Document in CLAUDE.md

---

**Last Updated**: 2026-05-20  
**Maintained By**: claude-code  
**Status**: Active Development
