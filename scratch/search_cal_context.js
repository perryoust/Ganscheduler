const fs = require('fs');

const content = fs.readFileSync('c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler\\cal.js', 'utf8');
const lines = content.split('\n');

const lineNumbers = [634, 684, 742, 804, 933, 1086, 1474, 1517];

lineNumbers.forEach(ln => {
  console.log(`\n--- CONTEXT FOR LINE ${ln} ---`);
  for (let i = Math.max(1, ln - 4); i <= Math.min(lines.length, ln + 4); i++) {
    console.log(`${i}: ${lines[i-1].trim()}`);
  }
});
