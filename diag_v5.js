const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'sraws.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const g51_april = data.filter(item => item.g === 51 && item.d.startsWith("2026-04"));
console.log(JSON.stringify(g51_april, null, 2));
