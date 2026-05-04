const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'sraws.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log("--- Searching for 'מנהיגות' on 2026-02-25 ---");
const leadership = data.filter(item => item.d === "2026-02-25" && item.a && item.a.includes("מנהיגות"));
console.log(JSON.stringify(leadership, null, 2));

console.log("--- Searching for any 'יהלום' or 'תירוש' ---");
const names = data.filter(item => item.a && (item.a.includes("יהלום") || item.a.includes("תירוש")));
console.log("Found " + names.length + " activities with these names in 'a' field.");
// Maybe garden names are in different fields? No, 'g' is ID.
// Let's check GIDs 51 and 121 across ALL dates.
const g51_all = data.filter(item => item.g === 51).slice(0, 5);
console.log("GID 51 (יהלום) samples:");
console.log(JSON.stringify(g51_all, null, 2));

const g121_all = data.filter(item => item.g === 121).slice(0, 5);
console.log("GID 121 (תירוש) samples:");
console.log(JSON.stringify(g121_all, null, 2));
