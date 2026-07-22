const fs = require('fs');
const lines = fs.readFileSync('index.html', 'utf8').split('\n');
let cnt = 0;
lines.forEach((l, i) => {
    cnt += (l.match(/<div/g) || []).length;
    cnt -= (l.match(/<\/div/g) || []).length;
    if (l.includes('id="p-')) console.log((i + 1) + ': ' + l.trim() + ' [cnt=' + cnt + ']');
});
console.log('Final count: ' + cnt);
