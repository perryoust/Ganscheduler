const fs = require('fs');
const utilsJs = fs.readFileSync('../utils.js', 'utf8');

// Mock window object
global.window = {};

eval(utilsJs);

console.log("megaClean('גן כוכב (פ\"ת)'):", window.utils.megaClean('גן כוכב (פ"ת)'));
console.log("megaClean('גן כוכב'):", window.utils.megaClean('גן כוכב'));
console.log("norm('פתח תקווה'):", window.utils.norm('פתח תקווה'));
console.log("norm('פ\"ת'):", window.utils.norm('פ"ת'));
