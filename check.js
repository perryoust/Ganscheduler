const fs = require('fs');
const lines = fs.readFileSync('activity.js', 'utf8').split('\n');
for(let i=0; i<lines.length; i++) {
  if(lines[i].includes('id="rr-time"')) {
    console.log('Line ' + i + ': ' + lines[i]);
  }
}