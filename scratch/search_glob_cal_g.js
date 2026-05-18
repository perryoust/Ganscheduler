const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler';
const files = ['gardens.js', 'cal.js'];

files.forEach(f => {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  content.split('\n').forEach((line, idx) => {
    if (line.includes("getElementById('cal-g1'") || line.includes("getElementById('cal-g2'") || line.includes("getElementById('cal-g3'")) {
      console.log(`${f} Line ${idx + 1}: ${line.trim()}`);
    }
  });
});
