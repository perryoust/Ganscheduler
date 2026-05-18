const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') || f.endsWith('.html'));

files.forEach(f => {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  content.split('\n').forEach((line, idx) => {
    if (line.includes('function switchMode') || line.includes('switchMode = function')) {
      console.log(`${f} Line ${idx + 1}: ${line.trim()}`);
    }
  });
});
