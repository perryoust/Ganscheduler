const fs = require('fs');
let txt = fs.readFileSync('export_v107.js', 'utf8');
const start = txt.indexOf('if(isSupplierExport){');
let braceCount = 0;
let end = -1;
let started = false;
for(let i=start; i<txt.length; i++) {
    if(txt[i] === '{') {
        braceCount++;
        started = true;
    } else if(txt[i] === '}') {
        braceCount--;
        if(started && braceCount === 0) {
            end = i;
            break;
        }
    }
}
console.log('Start:', start, 'End:', end);
console.log('Last few lines:\\n' + txt.substring(end - 100, end + 20));
