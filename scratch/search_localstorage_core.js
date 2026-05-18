const fs = require('fs');

['core.js', 'data.js'].forEach(f => {
  const filePath = 'c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler\\' + f;
  const content = fs.readFileSync(filePath, 'utf8');
  content.split('\n').forEach((line, idx) => {
    if (line.includes('localStorage')) {
      console.log(`${f} Line ${idx + 1}: ${line.trim()}`);
    }
  });
});
