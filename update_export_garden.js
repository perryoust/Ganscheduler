const fs = require('fs');

// Update temp_core.js
let core = fs.readFileSync('temp_core.js', 'utf8');

const exportFunc = `

window.exportGardenWA = function() {
  if (!window._geditGid) return;
  const gid = window._geditGid;
  const g = window.getAllGardens().find(x => x.id === gid) || {};
  const ex = (window.supEx && window.supEx['g_' + gid]) || {};
  
  const name = (document.getElementById('gedit-name').value || '').trim() || ex.name || g.name || '';
  const st = (document.getElementById('gedit-st').value || '').trim() || ex.st || g.st || '';
  const city = g.city || '';
  const mgr = typeof window.getGardenMgr === 'function' ? window.getGardenMgr(gid) : null;
  
  let txt = \`📍 *פרטי צהרון/גן:*\n\n\`;
  if (name) txt += \`*שם:* \${name}\n\`;
  if (city) txt += \`*עיר:* \${city}\n\`;
  if (st) txt += \`*כתובת:* \${st}\n\`;
  
  if (mgr) {
    txt += \`\n👤 *\${mgr.role === 'manager' ? 'מנהל' : 'רכז'}:* \${mgr.name}\${mgr.phone ? (' - ' + mgr.phone) : ''}\n\`;
  }
  
  const fallback = () => {
    const t = document.createElement('textarea');
    t.value = txt;
    document.body.appendChild(t);
    t.select();
    try { document.execCommand('copy'); } catch(e){}
    document.body.removeChild(t);
  };
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(() => {
      if (typeof window.showToast === 'function') window.showToast('✅ פרטי הגן הועתקו להודעה!');
    }).catch(fallback);
  } else {
    fallback();
    if (typeof window.showToast === 'function') window.showToast('✅ פרטי הגן הועתקו להודעה!');
  }
};
`;

if (!core.includes('window.exportGardenWA = function')) {
    core = core.replace('function saveGardenCard(){', exportFunc + '\nfunction saveGardenCard(){');
    fs.writeFileSync('temp_core.js', core);
    console.log('Added exportGardenWA to temp_core.js');
}

// Update index.html
let html = fs.readFileSync('index.html', 'utf8');
const targetBtns = `<div style="display:flex;gap:7px;justify-content:flex-end;padding-top:10px;border-top:1px solid #e0e0e0">
          <button class="btn bp" onclick="saveGardenCard()">💾 שמור</button>
          <button class="btn bs" onclick="CM('gedit-m')">ביטול</button>
        </div>`;
const replaceBtns = `<div style="display:flex;gap:7px;justify-content:flex-end;padding-top:10px;border-top:1px solid #e0e0e0; flex-wrap:wrap;">
          <button class="btn bsm" style="background:#25d366;color:#fff;margin-right:auto;border:none;border-radius:4px;padding:6px 12px;font-size:0.8rem;cursor:pointer;" onclick="exportGardenWA()">📋 העתק פרטים</button>
          <button class="btn bp" onclick="saveGardenCard()">💾 שמור</button>
          <button class="btn bs" onclick="CM('gedit-m')">ביטול</button>
        </div>`;

if (html.includes(targetBtns)) {
    html = html.replace(targetBtns, replaceBtns);
    fs.writeFileSync('index.html', html);
    console.log('Added button to index.html');
} else {
    console.log('Button target not found in index.html, using regex fallback');
    // Regex fallback
    const rx = /<div style="display:flex;gap:7px;justify-content:flex-end;padding-top:10px;border-top:1px solid #e0e0e0">([\s\S]*?)<button class="btn bp" onclick="saveGardenCard\(\)">💾 שמור<\/button>/;
    const match = html.match(rx);
    if (match) {
        let rep = '<div style="display:flex;gap:7px;justify-content:flex-end;padding-top:10px;border-top:1px solid #e0e0e0; flex-wrap:wrap;">' + match[1] + '<button class="btn bsm" style="background:#25d366;color:#fff;margin-right:auto;border:none;border-radius:4px;padding:6px 12px;font-size:0.8rem;cursor:pointer;" onclick="exportGardenWA()">📋 העתק פרטים</button>\n          <button class="btn bp" onclick="saveGardenCard()">💾 שמור</button>';
        html = html.replace(rx, rep);
        fs.writeFileSync('index.html', html);
        console.log('Added button to index.html via regex');
    } else {
        console.log('Could not find modal button container via regex');
    }
}
