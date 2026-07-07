const fs = require('fs');
const lines = fs.readFileSync('index.html', 'utf8').split('\n');
let start = -1;
let end = -1;
let d = 0;
for(let i=0; i<lines.length; i++) {
  const l = lines[i];
  if(l.includes('<div class="content"')) start = i;
  if(start !== -1) {
    const openCount = (l.match(/<div/g) || []).length;
    const closeCount = (l.match(/<\/div>/g) || []).length;
    d += openCount - closeCount;
    if(d === 0 && end === -1) {
      end = i;
      break;
    }
  }
}
console.log('Start line:', start, 'End line:', end);
