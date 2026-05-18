const fs = require('fs');

const path = 'c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler\\backup.json';
const db = JSON.parse(fs.readFileSync(path, 'utf8'));

// Find gardens matching נגה and קורל
const noga = db.G.find(g => g.name.includes('נגה'));
const coral = db.G.find(g => g.name.includes('קורל'));

console.log('Noga:', noga);
console.log('Coral:', coral);

if (noga && coral) {
  const evs = db.SCH.filter(s => s.d === '2026-05-18' && (Number(s.g) === Number(noga.id) || Number(s.g) === Number(coral.id)));
  console.log('Activities on 2026-05-18:', JSON.stringify(evs, null, 2));
}
