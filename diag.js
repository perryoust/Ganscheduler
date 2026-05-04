const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'sraws.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log("--- Searching for GID 5 on 2026-02-25 ---");
const g5 = data.filter(item => item.g === 5 && item.d === "2026-02-25");
console.log(JSON.stringify(g5, null, 2));

console.log("--- Searching for GID 51 on 2026-04-29 ---");
const g51 = data.filter(item => item.g === 51 && item.d === "2026-04-29");
console.log(JSON.stringify(g51, null, 2));

console.log("--- Searching for GID 121 on 2026-04-29 ---");
const g121 = data.filter(item => item.g === 121 && item.d === "2026-04-29");
console.log(JSON.stringify(g121, null, 2));
