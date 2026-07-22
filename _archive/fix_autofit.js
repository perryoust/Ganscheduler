const fs = require('fs');
let e = fs.readFileSync('export.js', 'utf8');

const autoFitLogic = ws.columns.forEach(col => {
          let maxLength = 0;
          col.eachCell({ includeEmpty: true }, cell => {
            if (cell.isMerged) return;
            const columnLength = cell.value ? cell.value.toString().length : 0;
            if (columnLength > maxLength) {
              maxLength = columnLength;
            }
          });
          col.width = Math.min(Math.max(maxLength + 2, 10), 60);
        });;

e = e.replace("ws.columns.forEach(col => { col.width = 20; });", autoFitLogic);

fs.writeFileSync('export.js', e);
console.log('Done');