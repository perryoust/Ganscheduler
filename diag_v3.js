const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'sraws.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const find = (gid, date) => data.find(item => item.g === gid && item.d === date);

console.log("GID 51 on 2026-04-29:", find(51, "2026-04-29"));
console.log("GID 121 on 2026-04-29:", find(121, "2026-04-29"));
console.log("GID 104 on 2026-02-25:", find(104, "2026-02-25"));

// Let's check if 2026-04-29 exists at all for anyone
const any29 = data.filter(item => item.d === "2026-04-29").length;
console.log("Total activities on 2026-04-29:", any29);

// Check GID 51 on 2026-04-28 or 30
console.log("GID 51 on 2026-04-27:", find(51, "2026-04-27"));
console.log("GID 51 on 2026-05-04:", find(51, "2026-05-04"));
