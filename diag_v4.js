const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'sraws.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const g51_2026 = data.filter(item => item.g === 51 && item.d.startsWith("2026"));
console.log("GID 51 in 2026 count:", g51_2026.length);
if(g51_2026.length > 0) {
    console.log("Last date for GID 51:", g51_2026[g51_2026.length - 1].d);
}

const g121_2026 = data.filter(item => item.g === 121 && item.d.startsWith("2026"));
console.log("GID 121 in 2026 count:", g121_2026.length);
if(g121_2026.length > 0) {
    console.log("Last date for GID 121:", g121_2026[g121_2026.length - 1].d);
}
