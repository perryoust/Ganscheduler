const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('onclick="openNewSched()"" style', 'onclick="openNewSched()" style');
fs.writeFileSync('index.html', html);
