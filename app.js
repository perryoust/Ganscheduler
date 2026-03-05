<style>
/* כאן נכנס כל הסטייל המקורי שלך - צמצמתי כדי שיעבור בשיחה */
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;color:#222;direction:rtl;font-size:14px}
.hdr{background:linear-gradient(135deg,#1a237e,#1565c0);color:#fff;padding:11px 18px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 10px rgba(0,0,0,.25);flex-wrap:wrap}
/* ... שאר הסטייל שלך ממשיך כאן ... */
</style>
</head>
<body>
<div class="hdr"><h1>קידס שיבוץ - LIVE</h1></div>

<script>
// המשתנה הראשי של הנתונים
let S = { version: 2, ts: 0, data: { ch: [], pairs: [], supEx: {}, clusters: {}, holidays: [], pairBreaks: [], managers: {}, blockedDates: [], gardenBlocks: {}, invoices: [], vatRate: 17 } };

// פונקציה להעברת נתונים ישנים לענן
async function migrateIfNeeded() {
    const local = localStorage.getItem('sraws_v2');
    if (local) {
        try {
            const parsed = JSON.parse(local);
            await window.fbSet(window.fbRef(window.fbDB, 'appData'), parsed);
            console.log("נתונים הועברו בהצלחה לענן!");
            localStorage.removeItem('sraws_v2'); // מנקה את הזיכרון המקומי
        } catch(e) { console.error("שגיאת העברה:", e); }
    }
}

// חיבור Live למסד הנתונים
function startSync() {
    const dataRef = window.fbRef(window.fbDB, 'appData');
    window.fbOnValue(dataRef, (snapshot) => {
        const cloudData = snapshot.val();
        if (cloudData) {
            S = cloudData;
            if (typeof renderAll === "function") renderAll();
            console.log("סונכרן מהענן");
        } else {
            migrateIfNeeded();
        }
    });
}

// פונקציית שמירה שקוראת לענן
function saveToCloud() {
    window.fbSet(window.fbRef(window.fbDB, 'appData'), S)
        .then(() => {
            alert("נשמר בהצלחה בכל המכשירים!");
        })
        .catch(err => alert("שגיאת שמירה: " + err));
}

// הפעלת הסנכרון בטעינה
window.addEventListener('load', startSync);

/* כאן מגיעות כל הפונקציות המקוריות של האפליקציה ש-Claude כתב */
/* יש להחליף כל קריאה ל-saveData() ב-saveToCloud() */
</script>
</body>
</html>
