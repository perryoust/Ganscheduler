const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'sraws.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const maxId = Math.max(...data.map(item => item.id || 0));

const newActivities = [
    {
        id: maxId + 1,
        g: 51,
        d: "2026-04-29",
        a: "מעשיותאטרון - דרמה/מוסיקה",
        t: "15:30",
        p: "054-6589303",
        st: "nohap",
        nt: "⚠️ לא התקיים: חסר מדריך"
    },
    {
        id: maxId + 2,
        g: 121,
        d: "2026-04-29",
        a: "מעשיותאטרון - דרמה/מוסיקה",
        t: "14:40",
        p: "054-6589303",
        st: "nohap",
        nt: "⚠️ לא התקיים: חסר מדריך"
    }
];

data.push(...newActivities);
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

console.log(`Added 2 missing activities to sraws.json with IDs ${maxId+1} and ${maxId+2}.`);
