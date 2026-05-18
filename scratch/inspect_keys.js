const fs = require('fs');

const path = 'c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler\\backup.json';
const db = JSON.parse(fs.readFileSync(path, 'utf8'));
console.log('Keys of backup.json:', Object.keys(db));

const path2 = 'c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler\\payload.json';
if (fs.existsSync(path2)) {
  const db2 = JSON.parse(fs.readFileSync(path2, 'utf8'));
  console.log('Keys of payload.json:', Object.keys(db2));
}
