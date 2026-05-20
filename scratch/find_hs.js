const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (/class=["']hs["']/.test(l)) {
    console.log((i + 1) + ': ' + l.trim());
  }
});
