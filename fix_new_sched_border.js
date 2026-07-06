const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const target = `<div class="vbtns" style="overflow-x:auto; display:flex; align-items:center; flex:1;">
               <button id="vlb-group-pairs-mobile" class="vbtn active" onclick="setListGroupMode('pairs')">⚖️ זוגות</button>
               <button id="vlb-group-clusters-mobile" class="vbtn" onclick="setListGroupMode('clusters')">📦 אשכולות</button>
               <button class="btn bp bsm" onclick="openNewSched()" style="margin-right:auto; white-space:nowrap; padding:4px 10px; font-size:0.8rem; border-radius:15px; box-shadow:0 1px 3px rgba(0,0,0,0.2);">➕ שיבוץ חדש</button>
             </div>`;
             
const replacement = `<div class="vbtns" style="display:flex; align-items:center;">
               <button id="vlb-group-pairs-mobile" class="vbtn active" onclick="setListGroupMode('pairs')">⚖️ זוגות</button>
               <button id="vlb-group-clusters-mobile" class="vbtn" onclick="setListGroupMode('clusters')">📦 אשכולות</button>
             </div>
             <button class="btn bp bsm" onclick="openNewSched()" style="margin-right:auto; white-space:nowrap; padding:4px 10px; font-size:0.8rem; border-radius:15px; box-shadow:0 1px 3px rgba(0,0,0,0.2);">➕ שיבוץ חדש</button>`;

if (html.includes(target)) {
    html = html.replace(target, replacement);
    fs.writeFileSync('index.html', html);
    console.log('Successfully updated new assignment button layout in index.html');
} else {
    console.log('Target not found in index.html. Trying regex.');
    const regex = /<div class="vbtns" style="overflow-x:auto; display:flex; align-items:center; flex:1;">\s*<button id="vlb-group-pairs-mobile"[\s\S]*?<button class="btn bp bsm" onclick="openNewSched\(\)"[\s\S]*?<\/div>/;
    const match = html.match(regex);
    if(match) {
        let newHtml = match[0].replace('</button>\r\n             </div>', '</button>');
        newHtml = newHtml.replace('<button class="btn bp bsm" onclick="openNewSched()', '</div>\r\n             <button class="btn bp bsm" onclick="openNewSched()"');
        newHtml = newHtml.replace('style="overflow-x:auto; display:flex; align-items:center; flex:1;"', 'style="display:flex; align-items:center;"');
        
        html = html.replace(regex, newHtml);
        fs.writeFileSync('index.html', html);
        console.log('Successfully updated via regex');
    } else {
        console.log('Not found via regex either.');
    }
}
