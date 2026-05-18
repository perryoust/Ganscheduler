const fs = require('fs');

const path = 'c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler\\payload.json';
const db = JSON.parse(fs.readFileSync(path, 'utf8'));
const data = db.data;

const evs = data.ch.filter(s => s.d === '2026-05-18' && s.a.includes('תנועה בקצב'));
console.log('Movement activities on 2026-05-18:', JSON.stringify(evs, null, 2));
