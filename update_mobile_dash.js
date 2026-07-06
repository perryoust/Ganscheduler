const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const target = '<button class="btn bg bsm" onclick="exportShortagesToExcel()" title="ייצוא רשימת החוסרים לאקסל בהתאם לפורמט הדרוש">📥 דוח חוסרים</button>';
const replacement = `<div style="display:flex; align-items:center; gap:6px">
               <div class="vbtns" style="margin-left:2px; display:inline-flex;">
                 <button id="vlb-group-pairs-dash-mobile" class="vbtn active" onclick="setListGroupMode('pairs')" style="padding:0 6px; font-size:0.85rem; border-radius:6px 0 0 6px;">⚖️</button>
                 <button id="vlb-group-clusters-dash-mobile" class="vbtn" onclick="setListGroupMode('clusters')" style="padding:0 6px; font-size:0.85rem; border-radius:0 6px 6px 0;">📦</button>
               </div>
               <button class="btn bg bsm" onclick="exportShortagesToExcel()" title="ייצוא רשימת החוסרים לאקסל בהתאם לפורמט הדרוש" style="white-space:nowrap; padding:4px 8px;">📥 חוסרים</button>
            </div>`;

if (html.includes(target)) {
    html = html.replace(target, replacement);
    fs.writeFileSync('index.html', html);
    console.log('Successfully updated mobile dashboard layout in index.html');
} else {
    console.log('Target not found in index.html');
}
