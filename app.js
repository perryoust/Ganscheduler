// המשתנה הראשי של הנתונים
let S = { version: 2, ts: 0, data: { ch: [], pairs: [], supEx: {}, clusters: {}, holidays: [], pairBreaks: [], managers: {}, blockedDates: [], gardenBlocks: {}, invoices: [], vatRate: 17 } };

// פונקציה להעברת נתונים ישנים לענן (קורה פעם אחת במכשיר המקורי)
async function migrateIfNeeded() {
    const local = localStorage.getItem('sraws_v2');
    if (local) {
        try {
            const parsed = JSON.parse(local);
            await window.fbSet(window.fbRef(window.fbDB, 'appData'), parsed);
            console.log("נתונים הועברו לענן!");
            localStorage.removeItem('sraws_v2');
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
