const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');
const search = '<div class="vbtns" style="overflow-x:auto">\\r\\n              <button id="vlb-group-pairs-mobile" class="vbtn active" onclick="setListGroupMode(\\'pairs\\')">⚖️ זוגות</button>\\r\\n              <button id="vlb-group-clusters-mobile" class="vbtn" onclick="setListGroupMode(\\'clusters\\')">📦 אשכולות</button>\\r\\n            </div>';
const replace = '<div class="vbtns" style="overflow-x:auto; display:flex; align-items:center; flex:1;">\\r\\n              <button id="vlb-group-pairs-mobile" class="vbtn active" onclick="setListGroupMode(\\'pairs\\')">⚖️ זוגות</button>\\r\\n              <button id="vlb-group-clusters-mobile" class="vbtn" onclick="setListGroupMode(\\'clusters\\')">📦 אשכולות</button>\\r\\n              <button class="btn bp bsm" onclick="openNewSched()" style="margin-right:auto; white-space:nowrap; padding:4px 10px; font-size:0.8rem; border-radius:15px; box-shadow:0 1px 3px rgba(0,0,0,0.2);">➕ שיבוץ חדש</button>\\r\\n            </div>';
c = c.replace(search, replace);
fs.writeFileSync('index.html', c);
