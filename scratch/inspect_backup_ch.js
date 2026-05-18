const fs = require('fs');

const path = 'c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler\\backup.json';
const db = JSON.parse(fs.readFileSync(path, 'utf8'));

// Find gardens matching נגה and קורל in db.ch on 2026-05-18
const evs = db.ch.filter(s => s.d === '2026-05-18' && (s.g === 71 || s.g === 99 || s.g === '71' || s.g === '99'));
console.log('Activities on 2026-05-18 in ch:', JSON.stringify(evs, null, 2));
