const fs = require('fs');

const path = 'c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler\\db.json';
const db = JSON.parse(fs.readFileSync(path, 'utf8'));

const evs = db.SCH.filter(s => s.d === '2026-05-18' && (s.g === 12 || s.g === 18));
console.log('Matching activities on 2026-05-18:', JSON.stringify(evs, null, 2));
