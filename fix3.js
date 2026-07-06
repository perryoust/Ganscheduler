const fs = require('fs');
let html = fs.readFileSync('cal.js', 'utf8');

const regex = /\s*\/\/\s*Universal Makeup Section at Top of Week[\s\S]*?let html = wkMakeupHtml \+ '<div class="tw-sticky">'/;
html = html.replace(regex, "\n  let html = '<div class=\"tw-sticky\">'");

fs.writeFileSync('cal.js', html);
console.log('Fixed cal.js weekly grid makeups');
