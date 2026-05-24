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

### 1.1 If you use Google Cloud SDK or ADC
```bash
# הורד קובץ Service Account JSON ושים נתיב לסביבה
setx GOOGLE_APPLICATION_CREDENTIALS "C:\path\to\google-credentials.json"
```

או ב-PowerShell פעיל:
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\google-credentials.json"
```

> חשוב: קבצי אישורי Google חייבים להיות מאוחסנים במקום מאובטח ובלתי מחייב ב-git.
>
> ניתן להשתמש ב-`setup-google-credentials.ps1` לקביעת `GOOGLE_APPLICATION_CREDENTIALS` ב-Windows.
>
> אם יש לך הרשאות מתאימות ו־`gcloud` מחובר לחשבון, ניתן גם ליצור את קובץ המפתח אוטומטית בתיקיית הפרויקט:
> ```powershell
> gcloud iam service-accounts create ganscheduler-agent --display-name "GanScheduler Agent"
> gcloud iam service-accounts keys create google-credentials.json --iam-account=ganscheduler-agent@YOUR_PROJECT_ID.iam.gserviceaccount.com --project=YOUR_PROJECT_ID
> .\setup-google-credentials.ps1 -Path ".\google-credentials.json"
> ```
>
### 1.2 Quick: Install gcloud & configure ADC (Windows)
If you don't have `gcloud` installed, you can install with admin rights or use the portable ZIP method below.

Admin (recommended) via winget:
```powershell
winget install --id Google.CloudSDK -e --accept-package-agreements --accept-source-agreements
```

Portable (no-admin) - downloads and installs to your user profile:
```powershell
$url = 'https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-sdk-569.0.0-windows-x86_64.zip'
$tmp = "$env:TEMP\gcloud.zip"
Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing
Expand-Archive -LiteralPath $tmp -DestinationPath $env:USERPROFILE -Force
& "$env:USERPROFILE\google-cloud-sdk\install.bat" --quiet
```

After `gcloud` is available, create or download a Service Account key JSON and set ADC:
```powershell
# If you already have a key file:
.\setup-google-credentials.ps1 -Path "C:\path\to\google-credentials.json"

# Or activate directly using gcloud (optional):
gcloud auth activate-service-account --key-file="C:\path\to\google-credentials.json"
```

If you need to create a service account and key (requires project Owner or IAM permissions):
```bash
gcloud iam service-accounts create ganscheduler-agent --display-name "GanScheduler Agent"
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID --member="serviceAccount:ganscheduler-agent@YOUR_PROJECT_ID.iam.gserviceaccount.com" --role="roles/owner"
gcloud iam service-accounts keys create google-credentials.json --iam-account=ganscheduler-agent@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

Store the `google-credentials.json` safely and then run the `setup-google-credentials.ps1` script above.

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
