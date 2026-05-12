const fs = require('fs');
const utilsJs = fs.readFileSync('../utils.js', 'utf8');
const dataJs = fs.readFileSync('../data.js', 'utf8').replace('window.onload', 'var DUMMY');

global.window = {};
eval(utilsJs);
eval(dataJs);

console.log("Gardens loaded:", window.GARDENS.length);

let n = window.utils.norm('גן קלמנטינה');
let m = window.utils.megaClean('גן קלמנטינה');
let c = window.utils.norm('ראש העין');

let found = window.GARDENS.find(g => g.name === 'גן קלמנטינה');
console.log("Found in array manually:", found);
if (found) {
    console.log("this.norm(g.name):", window.utils.norm(found.name), "=== n:", n);
    console.log("this.megaClean(g.name):", window.utils.megaClean(found.name), "=== m:", m);
    console.log("this.norm(g.city):", window.utils.norm(found.city), "=== c:", c);
    
    let priority1 = (window.utils.norm(found.name) === n || window.utils.megaClean(found.name) === m) && (!c || window.utils.norm(found.city) === c);
    console.log("priority1:", priority1);
}

console.log("findGarden call:", window.utils.findGarden('גן קלמנטינה', 'ראש העין'));
