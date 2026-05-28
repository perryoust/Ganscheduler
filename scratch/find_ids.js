const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const matches = content.match(/id="p-[^"]+"/g);
console.log("Found panels:", matches);
