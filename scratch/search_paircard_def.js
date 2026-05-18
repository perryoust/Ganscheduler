const fs = require('fs');
const path = require('path');

const files = ['core.js', 'cal.js', 'sched.js', 'activity.js', 'utils.js'];
const dir = 'c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler';

files.forEach(f => {
  const filePath = path.join(dir, f);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    content.split('\n').forEach((line, idx) => {
      if (line.includes('renderStandardPairCard')) {
        console.log(`${f} Line ${idx + 1}: ${line.trim()}`);
      }
    });
  }
});
