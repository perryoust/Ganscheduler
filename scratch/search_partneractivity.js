const fs = require('fs');

const core = fs.readFileSync('c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler\\core.js', 'utf8');
core.split('\n').forEach((line, idx) => {
  if (line.includes('findPartnerActivity')) {
    console.log(`core.js Line ${idx + 1}: ${line.trim()}`);
  }
});

const act = fs.readFileSync('c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler\\activity.js', 'utf8');
act.split('\n').forEach((line, idx) => {
  if (line.includes('findPartnerActivity')) {
    console.log(`activity.js Line ${idx + 1}: ${line.trim()}`);
  }
});
