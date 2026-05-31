const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, '..', 'activity.js');
let content = fs.readFileSync(filepath, 'utf8');

const target = `              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                 <div class="fg"><label style="font-size:.7rem;font-weight:700">שעה *</label><input type="time" id="sp-mu-time" value="\${s.t||''}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>
                   <select id="sp-mu-act" onchange="window.spMuActChg()" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc">
                     <option value="">בחר פעילות...</option>
                     \${initialActs.map(a => \`<option value="\${a}" \${s.act===a?'selected':''}>\${a}</option>\`).join('')}
                     <option value="__new__">➕ הוסף פעילות חדשה...</option>
                   </select>
                 </div>
              </div>`;

const replacement = `              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                 <div class="fg"><label style="font-size:.7rem;font-weight:700">שעה *</label><input type="time" id="sp-mu-time" value="\${s.t||''}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>
                 <div class="fg">
                   <label style="font-size:.7rem;font-weight:700">בחר פעילות *</label>
                   <select id="sp-mu-act" onchange="window.spMuActChg()" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc">
                     <option value="">בחר פעילות...</option>
                     \${initialActs.map(a => \`<option value="\${a}" \${s.act===a?'selected':''}>\${a}</option>\`).join('')}
                     <option value="__new__">➕ הוסף פעילות חדשה...</option>
                   </select>
                 </div>
              </div>
              <div style="display:\${(window.gcls(g) === 'ביה&quot;ס' || window.gcls(g) === 'ביה\\"ס') ? 'grid' : 'none'};grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
                 <div class="fg">
                   <label style="font-size:.7rem;font-weight:700;color:#e65100">מספר קבוצות</label>
                   <input type="number" id="sp-mu-grp" min="1" max="10" value="\${s.grp||1}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ffb74d">
                 </div>
                 <div></div>
              </div>`;

// Normalize newlines for match
const normalize = str => str.replace(/\r\n/g, '\n').trim();

const normContent = content.replace(/\r\n/g, '\n');
const normTarget = normalize(target);

if (normContent.includes(normTarget)) {
  const normReplacement = replacement.replace(/\r\n/g, '\n');
  const newContent = normContent.replace(normTarget, normReplacement);
  // Write back with original newlines or standard CRLF on windows
  fs.writeFileSync(filepath, newContent.replace(/\n/g, '\r\n'), 'utf8');
  console.log("Success with exact match!");
  process.exit(0);
}

// Anchors approach in JS
const startAnchor = 'id="sp-mu-time"';
const endAnchor = 'id="sp-mu-act-new-wrap"';
const idxStart = normContent.indexOf(startAnchor);
const idxEnd = normContent.indexOf(endAnchor);

if (idxStart !== -1 && idxEnd !== -1) {
  const prefix = normContent.substring(0, idxStart);
  const gridStart = prefix.lastIndexOf('<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">');
  if (gridStart !== -1) {
    const suffix = normContent.substring(gridStart, idxEnd);
    const lastDiv = suffix.lastIndexOf('</div>');
    if (lastDiv !== -1) {
      // Find the second closing div or construct the exact string
      const toReplace = normContent.substring(gridStart, gridStart + lastDiv + 6);
      const newContent = normContent.replace(toReplace, replacement.replace(/\r\n/g, '\n'));
      fs.writeFileSync(filepath, newContent.replace(/\n/g, '\r\n'), 'utf8');
      console.log("Success with anchors match!");
      process.exit(0);
    }
  }
}

console.log("Failed to apply replacement");
process.exit(1);
