const fs = require('fs');

const content = fs.readFileSync('c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler\\cal.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('scroll') || line.includes('wheel') || line.includes('touch') || line.includes('onscroll')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
