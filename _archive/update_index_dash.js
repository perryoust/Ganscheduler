const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Desktop
const targetDesktop = '<div class="dash-view-pills">';
const replaceDesktop = `<div class="dash-view-pills">
           <div class="vbtns" style="margin-right:0; margin-left:15px; display:inline-flex;">
             <button id="vlb-group-pairs-dash-desktop" class="vbtn active" onclick="setListGroupMode('pairs')">⚖️ זוגות</button>
             <button id="vlb-group-clusters-dash-desktop" class="vbtn" onclick="setListGroupMode('clusters')">📦 אשכולות</button>
           </div>`;
html = html.replace(targetDesktop, replaceDesktop);

// Mobile
const targetMobile = '<div class="dash-view-pills">';
const replaceMobile = `<div class="dash-view-pills">
               <div class="vbtns" style="margin-left:5px;">
                 <button id="vlb-group-pairs-dash-mobile" class="vbtn active" onclick="setListGroupMode('pairs')" style="padding:0 6px">⚖️</button>
                 <button id="vlb-group-clusters-dash-mobile" class="vbtn" onclick="setListGroupMode('clusters')" style="padding:0 6px">📦</button>
               </div>`;

// Since targetMobile is same as targetDesktop, we need to match it properly. The second occurrence is inside dash-tools-mobile.
let parts = html.split('<div class="dash-view-pills">');
if (parts.length === 3) {
  html = parts[0] + replaceDesktop + parts[1] + replaceMobile + parts[2];
}

fs.writeFileSync('index.html', html);
