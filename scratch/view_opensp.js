const fs = require('fs');

const content = fs.readFileSync('c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler\\activity.js', 'utf8');
const lines = content.split('\n');

let start = -1;
lines.forEach((line, idx) => {
  if (line.includes('function openSP') || line.includes('openSP = function')) {
    start = idx;
  }
});

if (start !== -1) {
  console.log(`Found openSP starting at line ${start + 1}`);
  console.log(lines.slice(start, start + 120).join('\n'));
} else {
  console.log("openSP not found");
}
