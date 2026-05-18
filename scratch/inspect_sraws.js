const fs = require('fs');

const sraws = JSON.parse(fs.readFileSync('c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler\\sraws.json', 'utf8'));

// Print all activities on 18/05/2026
const dateEvs = sraws.filter(s => s.d === '2026-05-18');
console.log(`Found ${dateEvs.length} activities on 2026-05-18.`);

// Let's filter those containing Supplier "תנועה בקצב"
const movementEvs = dateEvs.filter(s => s.a.includes('תנועה') || s.g === 12 || s.g === 18);
console.log('Movement activities on 2026-05-18:', JSON.stringify(movementEvs, null, 2));
