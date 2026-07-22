const fs = require('fs');
let code = fs.readFileSync('activity.js', 'utf8');

// Update renderPartnerSynergy definition
code = code.replace(
  'function renderPartnerSynergy(gid, prefix, currentTimes = {}) {',
  'function renderPartnerSynergy(gid, prefix, currentTimes = {}, currentGrps = {}) {'
);

// Update HTML generation inside renderPartnerSynergy
code = code.replace(
  '<label style="font-size:.7rem;color:#546e7a">שעה:</label>',
  '<label style="font-size:.7rem;color:#546e7a">קבוצות:</label>\\n            <input type="number" id="${prefix}-syn-grp-${pId}" class="${prefix}-syn-grp" data-gid="${pId}" value="${currentGrps[pId] || 1}" min="1" max="10" style="padding:2px 4px;font-size:.8rem;border:1px solid #ccc;border-radius:4px;width:40px">\\n          </div>\\n          <div style="display:flex;align-items:center;gap:5px">\\n            <label style="font-size:.7rem;color:#546e7a">שעה:</label>'
);

// Update getSynergyData
code = code.replace(
  'const timeInput = document.querySelector(`.${prefix}-syn-time[data-gid="${pId}"]`);',
  'const timeInput = document.querySelector(`.${prefix}-syn-time[data-gid="${pId}"]`);\n        const grpInput = document.querySelector(`.${prefix}-syn-grp[data-gid="${pId}"]`);'
);
code = code.replace(
  'data.push({ g: Number(pId), t: timeInput ? timeInput.value : \'\' });',
  'data.push({ g: Number(pId), t: timeInput ? timeInput.value : \'\', grp: grpInput ? parseInt(grpInput.value, 10) : null });'
);

// Now update the usages in openSP, openPostpone, openCopy
// openSP
code = code.replace(
  'const currentTimesSP = {};\n    const partnerInfo = [];',
  'const currentTimesSP = {};\n    const currentGrpsSP = {};\n    const partnerInfo = [];'
);
code = code.replace(
  'if(pev) currentTimesSP[oid] = window.fT(pev.t || s.t);',
  'if(pev) { currentTimesSP[oid] = window.fT(pev.t || s.t); currentGrpsSP[oid] = pev.grp || 1; }'
);
code = code.replace(
  '${spPair ? window.renderPartnerSynergy(s.g, \'sped\', currentTimesSP) : \'\'}',
  '${spPair ? window.renderPartnerSynergy(s.g, \'sped\', currentTimesSP, currentGrpsSP) : \'\'}'
);

// Update openPostpone and openCopy
code = code.replace(
  /const currentTimes = {};\n      if\(pair\) \{/g,
  'const currentTimes = {};\n      const currentGrps = {};\n      if(pair) {'
);
code = code.replace(
  /if\(pEv\) currentTimes\[pId\] = window\.fT\(pEv\.t\|\|s\.t\);/g,
  'if(pEv) { currentTimes[pId] = window.fT(pEv.t||s.t); currentGrps[pId] = pEv.grp || 1; }'
);
code = code.replace(
  /synWrap\.innerHTML = window\.renderPartnerSynergy\(s\.g, 'post', currentTimes\);/g,
  'synWrap.innerHTML = window.renderPartnerSynergy(s.g, \'post\', currentTimes, currentGrps);'
);
code = code.replace(
  /synWrap\.innerHTML = window\.renderPartnerSynergy\(s\.g, 'copy', currentTimes\);/g,
  'synWrap.innerHTML = window.renderPartnerSynergy(s.g, \'copy\', currentTimes, currentGrps);'
);

fs.writeFileSync('activity.js', code);
console.log('Done synergy fixes');