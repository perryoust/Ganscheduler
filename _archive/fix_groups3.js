const fs = require('fs');
let code = fs.readFileSync('activity.js', 'utf8');

// 1. Add Group column to the Table
code = code.replace(
  /\<td style="padding:6px;text-align:center;font-weight:700"\>\$\{pev \? \(pev\.grp \|\| 1\) \: '—'\}\<\/td\>/g,
  '<td style="padding:6px;text-align:center;font-weight:700">${pev ? `<input type="number" min="1" max="10" value="${pev.grp || 1}" style="width:40px;text-align:center;border:1px solid #ccc;border-radius:4px" onchange="window.spRowGrpChg(\\\'${pev.id}\\\', this.value)">` : \'—\'}</td>'
);

// 2. Add Group to Manual Edit Form
code = code.replace(
  '<div class="fg"><label for="sp-edit-act" style="font-size:.7rem;font-weight:700">פעילות</label><select id="sp-edit-act"',
  '<div class="fg"><label for="sp-edit-grp" style="font-size:.7rem;font-weight:700">קבוצות</label><input type="number" id="sp-edit-grp" value="${s.grp||1}" min="1" max="10" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>\n        <div class="fg"><label for="sp-edit-act" style="font-size:.7rem;font-weight:700">פעילות</label><select id="sp-edit-act"'
);

// 3. Add Group to spEditSave
code = code.replace(
  "const newTime=document.getElementById('sp-edit-time').value;",
  "const newTime=document.getElementById('sp-edit-time').value;\n    const grpInput=document.getElementById('sp-edit-grp');\n    const newGrp=grpInput ? parseInt(grpInput.value, 10) : null;"
);
code = code.replace(
  "if(newTime) s.t=newTime;",
  "if(newTime) s.t=newTime;\n    if(newGrp && newGrp > 0) s.grp=newGrp;"
);
code = code.replace(
  "if(newDate) pEv.d=newDate;",
  "if(newDate) pEv.d=newDate;\n        if(newGrp && newGrp > 0) pEv.grp=newGrp;"
);

// 4. Add Group to Recurring Form
code = code.replace(
  '<div class="fg"><label style="font-size:.7rem;font-weight:700">שעה (${g.name})</label><input type="time" id="rr-time"',
  '<div class="fg"><label style="font-size:.7rem;font-weight:700">קבוצות</label><input type="number" id="rr-grp" value="${s.grp||1}" min="1" max="10" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>\n          <div class="fg"><label style="font-size:.7rem;font-weight:700">שעה (${g.name})</label><input type="time" id="rr-time"'
);

// 5. Add Group to saveReplaceRecur
code = code.replace(
  "const time = document.getElementById('rr-time').value;",
  "const time = document.getElementById('rr-time').value;\n      const grpInput = document.getElementById('rr-grp');\n      const newGrp = grpInput ? parseInt(grpInput.value, 10) : null;"
);
code = code.replace(
  /grp: s\.grp\|\|1/g,
  "grp: newGrp || s.grp || 1"
);

// 6. Inject spRowGrpChg function
const grpChgFunc = `
window.spRowGrpChg = function(id, val) {
  const ev = window.SCH.find(x => x.id == id);
  if(!ev) return;
  const v = parseInt(val, 10);
  if(v > 0) {
    ev.grp = v;
    const pair = window.gardenPair(ev.g);
    let syncPartner = false;
    if(pair) {
      const pGid = pair.ids.find(pid => Number(pid) !== Number(ev.g));
      const pG = window.G(pGid);
      if(pG && confirm('האם לעדכן את מספר הקבוצות גם בצהרון המקביל (' + pG.name + ')?')) {
        syncPartner = true;
      }
    }
    if(syncPartner) {
      const pGid = pair.ids.find(pid => Number(pid) !== Number(ev.g));
      const pEv = window.findPartnerActivity ? window.findPartnerActivity(pGid, ev.d, ev.a) : null;
      if(pEv) pEv.grp = v;
    }
    window.updAndRefresh();
  }
};
`;

if (!code.includes('window.spRowGrpChg')) {
  code = code.replace('window.spRowStatusChg = function', grpChgFunc + '\nwindow.spRowStatusChg = function');
}

fs.writeFileSync('activity.js', code);
console.log('Done modifying activity.js');