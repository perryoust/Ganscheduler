const fs = require('fs');

const content = fs.readFileSync('c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler\\styles.css', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('mob-summary') || line.includes('mob-accordion')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
