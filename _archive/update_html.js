const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

const htmlToInsert = `        <button id="supex-type-place" class="vbtn" onclick="setSupExType('place')" style="flex:1;font-size:.8rem">📅
          שיבוצים</button>
      </div>
      <!-- Supplier Selector -->
      <div id="supex-supplier-wrap" style="display:none; margin-bottom:12px;">
        <div class="fg">
          <label>בחר ספק (חובה לדוח שיבוצים)</label>
          <select id="supex-supplier-sel" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; font-size:0.9rem;">
            <option value="">-- כל הספקים --</option>
          </select>
        </div>
      </div>
      <div id="supex-act-opts" style="flex:1; display:flex; flex-direction:column; min-height:0;">`;

c = c.replace(
  '        <button id="supex-type-inv" class="vbtn" onclick="setSupExType(\'inv\')" style="flex:1;font-size:.8rem">📄\n          חשבוניות / הזמנות</button>\n      </div>\n      <div id="supex-act-opts" style="flex:1; display:flex; flex-direction:column; min-height:0;">',
  htmlToInsert
);

fs.writeFileSync('index.html', c);
