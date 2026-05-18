const fs = require('fs');

const content = fs.readFileSync('c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler\\cal.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('calSelectPair') || line.includes('function calSelectPair')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
