const fs = require('fs');
let lines = fs.readFileSync('index.html', 'utf8').split('\n');
lines[2183] = '        <div style="display:flex;gap:5px">';
lines[2184] = '          <button id="suc-btn-exp-purch" class="btn bg bsm" onclick="sucExportDocs()" style="display:none">🚀 יצוא דוח רכש</button>';
lines[2185] = '          <button id="suc-btn-exp-act" class="btn bp bsm" onclick="openSupExportFromCard()" style="display:none">🚀 יצוא דוח פעילות</button>';
lines[2186] = '          <button class="btn bo bsm" onclick="sucToggleEdit()">✏️ ערוך</button>';
lines[2187] = '          <button class="btn bs bsm" onclick="CM(\'sucard-m\')">✖</button>';
lines[2188] = '        </div>';
fs.writeFileSync('index.html', lines.join('\n'));