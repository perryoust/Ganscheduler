const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, '..', 'activity.js');
let content = fs.readFileSync(filepath, 'utf8');

// 1. Modify getSynergyData to ignore disabled checkboxes
const oldGetSynergy = `function getSynergyData(prefix) {
  const data = [];
  const chks = document.querySelectorAll(\`.\${prefix}-syn-chk\`);
  chks.forEach(chk => {
    if (chk.checked) {`;

const newGetSynergy = `function getSynergyData(prefix) {
  const data = [];
  const chks = document.querySelectorAll(\`.\${prefix}-syn-chk\`);
  chks.forEach(chk => {
    if (chk.checked && !chk.disabled) {`;

// Replace getSynergyData
if (content.includes(oldGetSynergy)) {
  content = content.replace(oldGetSynergy, newGetSynergy);
  console.log("getSynergyData updated successfully");
} else {
  // Try with normalized whitespace/newlines
  const normOld = oldGetSynergy.replace(/\r\n/g, '\n');
  const normNew = newGetSynergy.replace(/\r\n/g, '\n');
  const normContent = content.replace(/\r\n/g, '\n');
  if (normContent.includes(normOld)) {
    content = normContent.replace(normOld, normNew).replace(/\n/g, '\r\n');
    console.log("getSynergyData updated successfully (normalized)");
  } else {
    console.log("Warning: getSynergyData target not found");
  }
}

// 2. Modify updateMakeupPartnersTable to include the main garden
const oldUpdateTable = `  otherIds.forEach(pId => {
    const pG = window.G(pId);
    if(!pG) return;
    const ev = window.SCH.find(s => s.g === pId && s.d === date && s.st !== 'can');
    const origPartnerEv = origEv ? window.SCH.find(s => Number(s.g) === Number(pId) && s.d === origEv.d && window.supBase(s.a) === window.supBase(origEv.a)) : null;
    const stLabel = ev ? (window.stLabel ? window.stLabel(ev) : ev.st) : '—';
    const stClass = ev ? (window.stClass ? window.stClass(ev) : '') : '';
    const sup = ev ? window.supBase(ev.a) : (origPartnerEv ? window.supBase(origPartnerEv.a) : '—');
    const act = ev ? (ev.act || '—') : (origPartnerEv ? (origPartnerEv.act || '—') : '—');
    const makeupTime = (ev && ev.t) ? ev.t : (origPartnerEv && origPartnerEv.t) ? origPartnerEv.t : primaryMainTime;
    
    rowsHtml += \`<tr style="border-bottom:1px solid #eee;font-size:0.75rem;background:\${stClass==='busy'?'#fff9f9':'#fff'}">
      <td style="padding:6px;text-align:center"><input type="checkbox" class="\${prefix}-syn-chk" value="\${pId}" checked style="width:16px;height:16px;accent-color:#e65100"></td>
      <td style="padding:6px;font-weight:700">\${pG.name}</td>
      <td style="padding:6px">
        <input type="time" class="\${prefix}-syn-time" data-gid="\${pId}" value="\${makeupTime}" style="width:75px;padding:2px;border:1px solid #ccc;border-radius:4px;font-size:0.7rem">
      </td>
      <td style="padding:6px">\${sup}</td>
      <td style="padding:6px">\${act}</td>
      <td style="padding:6px;text-align:center"><span class="badge \${stClass}">\${stLabel}</span></td>
    </tr>\`;
  });`;

const newUpdateTable = `  // Add the main garden row first
  const mainG = window.G(gid);
  if (mainG) {
    const ev = window.SCH.find(s => s.g === gid && s.d === date && s.st !== 'can');
    const stLabel = ev ? (window.stLabel ? window.stLabel(ev) : ev.st) : '—';
    const stClass = ev ? (window.stClass ? window.stClass(ev) : '') : '';
    const sup = ev ? window.supBase(ev.a) : (origEv ? window.supBase(origEv.a) : '—');
    const act = ev ? (ev.act || '—') : (origEv ? (origEv.act || '—') : '—');
    const makeupTime = primaryMainTime;
    
    rowsHtml += \`<tr style="border-bottom:1px solid #eee;font-size:0.75rem;background:#f5f7ff;font-weight:bold">
      <td style="padding:6px;text-align:center">
        <input type="checkbox" class="\${prefix}-syn-chk" value="\${gid}" checked disabled style="width:16px;height:16px;accent-color:#e65100">
      </td>
      <td style="padding:6px;color:#1a237e">\${mainG.name} (ראשי)</td>
      <td style="padding:6px">
        <input type="time" class="\${prefix}-syn-time" data-gid="\${gid}" value="\${makeupTime}" 
          oninput="const mainTimeInp = document.getElementById('\${prefix.startsWith('sp') ? 'sp-mu-time' : 'ns-mu-time'}'); if(mainTimeInp) mainTimeInp.value = this.value"
          style="width:75px;padding:2px;border:1px solid #ffb74d;border-radius:4px;font-size:0.7rem;font-weight:bold;background:#fffde7">
      </td>
      <td style="padding:6px">\${sup}</td>
      <td style="padding:6px">\${act}</td>
      <td style="padding:6px;text-align:center"><span class="badge \${stClass}">\${stLabel}</span></td>
    </tr>\`;
  }

  otherIds.forEach(pId => {
    const pG = window.G(pId);
    if(!pG) return;
    const ev = window.SCH.find(s => s.g === pId && s.d === date && s.st !== 'can');
    const origPartnerEv = origEv ? window.SCH.find(s => Number(s.g) === Number(pId) && s.d === origEv.d && window.supBase(s.a) === window.supBase(origEv.a)) : null;
    const stLabel = ev ? (window.stLabel ? window.stLabel(ev) : ev.st) : '—';
    const stClass = ev ? (window.stClass ? window.stClass(ev) : '') : '';
    const sup = ev ? window.supBase(ev.a) : (origPartnerEv ? window.supBase(origPartnerEv.a) : '—');
    const act = ev ? (ev.act || '—') : (origPartnerEv ? (origPartnerEv.act || '—') : '—');
    const makeupTime = (ev && ev.t) ? ev.t : (origPartnerEv && origPartnerEv.t) ? origPartnerEv.t : primaryMainTime;
    
    rowsHtml += \`<tr style="border-bottom:1px solid #eee;font-size:0.75rem;background:\${stClass==='busy'?'#fff9f9':'#fff'}">
      <td style="padding:6px;text-align:center"><input type="checkbox" class="\${prefix}-syn-chk" value="\${pId}" checked style="width:16px;height:16px;accent-color:#e65100"></td>
      <td style="padding:6px;font-weight:700">\${pG.name}</td>
      <td style="padding:6px">
        <input type="time" class="\${prefix}-syn-time" data-gid="\${pId}" value="\${makeupTime}" style="width:75px;padding:2px;border:1px solid #ccc;border-radius:4px;font-size:0.7rem">
      </td>
      <td style="padding:6px">\${sup}</td>
      <td style="padding:6px">\${act}</td>
      <td style="padding:6px;text-align:center"><span class="badge \${stClass}">\${stLabel}</span></td>
    </tr>\`;
  });`;

// Replace updateMakeupPartnersTable
if (content.includes(oldUpdateTable)) {
  content = content.replace(oldUpdateTable, newUpdateTable);
  console.log("updateMakeupPartnersTable updated successfully");
} else {
  const normOld = oldUpdateTable.replace(/\r\n/g, '\n');
  const normNew = newUpdateTable.replace(/\r\n/g, '\n');
  const normContent = content.replace(/\r\n/g, '\n');
  if (normContent.includes(normOld)) {
    content = normContent.replace(normOld, normNew).replace(/\n/g, '\r\n');
    console.log("updateMakeupPartnersTable updated successfully (normalized)");
  } else {
    console.log("Warning: updateMakeupPartnersTable target not found");
  }
}

// 3. Add oninput to #sp-mu-time so that it updates the main garden row in the table when changed
const oldTimeInput = `<input type="time" id="sp-mu-time" value="\${s.t||''}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc">`;
const newTimeInput = `<input type="time" id="sp-mu-time" value="\${s.t||''}" oninput="const tblInp = document.querySelector('.sp-mu-syn-time[data-gid=\\'\${s.g}\\']'); if(tblInp) tblInp.value = this.value" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc">`;

if (content.includes(oldTimeInput)) {
  content = content.replace(oldTimeInput, newTimeInput);
  console.log("sp-mu-time updated successfully");
} else {
  const normOld = oldTimeInput.replace(/\r\n/g, '\n');
  const normNew = newTimeInput.replace(/\r\n/g, '\n');
  const normContent = content.replace(/\r\n/g, '\n');
  if (normContent.includes(normOld)) {
    content = normContent.replace(normOld, normNew).replace(/\n/g, '\r\n');
    console.log("sp-mu-time updated successfully (normalized)");
  } else {
    console.log("Warning: sp-mu-time target not found");
  }
}

fs.writeFileSync(filepath, content, 'utf8');
console.log("Done");
