const fs = require('fs');

const content = fs.readFileSync('c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler\\core.js', 'utf8');
const startIdx = content.indexOf('function calculateStats()');
const endIdx = content.indexOf('window.getDashStats = calculateStats;');

if (startIdx !== -1 && endIdx !== -1) {
  console.log(content.substring(startIdx, endIdx + 37));
} else {
  console.log('Not found');
}
