const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'sraws.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// We need to find the correct GIDs for these names first.
// I'll use a helper to find GID by name from the data itself if possible, 
// but better to use the GIDs we already have and confirm names.

const UPDATES = [
    { name: "גן רותם", d: "2026-02-25", a: "מנהיגות", nt: "מדריך חולה" },
    { name: "גן נורית", d: "2026-02-25", a: "מנהיגות", nt: "מדריך חולה" },
    { name: "גן אסיף", d: "2026-04-27", a: "מעשיותאטרון", nt: "חסר מדריך" },
    { name: "גן עינב", d: "2026-04-27", a: "מעשיותאטרון", nt: "חסר מדריך" },
    { name: "גן חיטה", d: "2026-04-16", a: "תלתן", nt: "מדריך לא הגיע" },
    { name: "גן לוטוס", d: "2026-04-16", a: "מעשיותאטרון", nt: "חסר מדריך" },
    { name: "גן נבטים", d: "2026-04-16", a: "מעשיותאטרון", nt: "חסר מדריך" },
    { name: "גן צנובר", d: "2026-04-16", a: "תלתן", nt: "מדריך לא הגיע" },
    { name: "גן פלג", d: "2026-04-28", a: "מעשיותאטרון", nt: "חסר מדריך" },
    { name: "גן יובל", d: "2026-04-28", a: "מעשיותאטרון", nt: "חסר מדריך" },
    { name: "גן יהלום", d: "2026-04-29", a: "מעשיותאטרון", nt: "חסר מדריך" },
    { name: "גן תירוש", d: "2026-04-29", a: "מעשיותאטרון", nt: "חסר מדריך" },
    { name: "גן סברס", d: "2026-04-29", a: "מעשיותאטרון", nt: "חסר מדריך" },
    { name: "גן אודם", d: "2026-04-29", a: "מעשיותאטרון", nt: "חסר מדריך" },
    { name: "גן לוטוס", d: "2026-04-30", a: "מעשיותאטרון", nt: "חסר מדריך" },
    { name: "גן נבטים", d: "2026-04-30", a: "מעשיותאטרון", nt: "חסר מדריך" },
    { name: "גן שמש", d: "2026-05-03", a: "מעשיותאטרון", nt: "חסר מדריך" },
    { name: "גן כרכום", d: "2026-05-03", a: "מעשיותאטרון", nt: "חסר מדריך" },
    { name: "גן סברס", d: "2026-05-06", a: "מעשיותאטרון", nt: "חסר מדריך" },
    { name: "גן אודם", d: "2026-05-06", a: "מעשיותאטרון", nt: "חסר מדריך" },
    { name: "גן פלג", d: "2026-05-03", a: "תלתן", nt: "מדריך חולה" },
    { name: "גן יובל", d: "2026-05-03", a: "תלתן", nt: "מדריך חולה" },
    { name: "גן סיגליות", d: "2026-05-04", a: "תלתן", nt: "מדריך איחר לא העביר פעילות" }
];

// Mapping garden names to IDs based on data analysis
const GARDEN_IDS = {
    "גן רותם": 104,
    "גן נורית": 73,
    "גן אסיף": 20,
    "גן עינב": 85,
    "גן חיטה": 44,
    "גן לוטוס": 63,
    "גן נבטים": 70,
    "גן צנובר": 97,
    "גן פלג": 88,
    "גן יובל": 52,
    "גן יהלום": 51,
    "גן תירוש": 121,
    "גן סברס": 76,
    "גן אודם": 12,
    "גן שמש": 117,
    "גן כרכום": 60,
    "גן סיגליות": 79
};

let changed = 0;
let missing = [];

UPDATES.forEach(u => {
    const gid = GARDEN_IDS[u.name];
    if(!gid) {
        missing.push(u.name + " (No ID mapped)");
        return;
    }
    
    // Find all matching activities (there might be multiple times if we're not careful, but let's match gid, date, and supplier)
    const matches = data.filter(item => item.g === gid && item.d === u.d && item.a && item.a.includes(u.a));
    
    if(matches.length > 0) {
        matches.forEach(m => {
            m.st = 'nohap';
            m.nt = '⚠️ לא התקיים: ' + u.nt;
            changed++;
        });
    } else {
        // If not found, it might be an EXTRA activity that was added later.
        // We'll create it if it's missing? No, user asked to "mark them as nophap if they are not already".
        // If they are not in the file, they might be in localStorage.
        missing.push(`${u.name} on ${u.d} (${u.a})`);
    }
});

if(changed > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

console.log(`Updated ${changed} activities.`);
if(missing.length > 0) {
    console.log("Missing from sraws.json (might be in localStorage or under different supplier name):");
    missing.forEach(m => console.log(" - " + m));
}
