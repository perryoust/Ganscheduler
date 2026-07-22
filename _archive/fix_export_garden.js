const fs = require('fs');

let coreDash = fs.readFileSync('core_dash.js', 'utf8');

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
  
  let txt = \`📍 *פרטי צהרון/גן:*\\n\\n\`;
  if (name) txt += \`*שם:* \${name}\\n\`;
  if (city) txt += \`*עיר:* \${city}\\n\`;
  if (st) txt += \`*כתובת:* \${st}\\n\`;
  
  if (mgr) {
    txt += \`\\n👤 *\${mgr.role === 'manager' ? 'מנהל' : 'רכז'}:* \${mgr.name}\${mgr.phone ? (' - ' + mgr.phone) : ''}\\n\`;
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

if (!coreDash.includes('window.exportGardenWA = function')) {
    coreDash = coreDash.replace('function saveGardenCard(){', exportFunc + '\nfunction saveGardenCard(){');
    fs.writeFileSync('core_dash.js', coreDash);
    console.log('Added exportGardenWA to core_dash.js');
}

// Ensure index.html modal has the correct button (with good encoding!)
let html = fs.readFileSync('index.html', 'utf8');

// Instead of regex replacing the corrupted one, let's just make sure we replace the whole modal bottom bar.
const regex = /<div style="display:flex;gap:7px;justify-content:flex-end;padding-top:10px;border-top:1px solid #e0e0e0(?:; flex-wrap:wrap;)?">([\s\S]*?)<\/div>/g;

// Find the one containing saveGardenCard()
let found = false;
html = html.replace(regex, (match, inner) => {
    if (match.includes('saveGardenCard()')) {
        found = true;
        return \`<div style="display:flex;gap:7px;justify-content:flex-end;padding-top:10px;border-top:1px solid #e0e0e0; flex-wrap:wrap;">
          <button class="btn bsm" style="background:#25d366;color:#fff;margin-right:auto;border:none;border-radius:4px;padding:6px 12px;font-size:0.8rem;cursor:pointer;" onclick="exportGardenWA()">📋 העתק פרטים</button>
          <button class="btn bp" onclick="saveGardenCard()">💾 שמור</button>
          <button class="btn bs" onclick="CM('gedit-m')">ביטול</button>
        </div>\`;
    }
    return match;
});

if(found) {
    fs.writeFileSync('index.html', html);
    console.log('Updated index.html button successfully');
} else {
    console.log('Could not find saveGardenCard button container');
}
