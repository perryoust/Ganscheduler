const fs = require('fs');
const utilsJs = fs.readFileSync('../utils.js', 'utf8');
const dataJs = fs.readFileSync('../data.js', 'utf8');

global.window = {};
eval(utilsJs);

const match = dataJs.match(/var GARDENS=\[(.*?)\];/s);
window.GARDENS = JSON.parse('[' + match[1] + ']');
console.log("length:", window.GARDENS.length);
