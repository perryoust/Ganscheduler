const fs = require('fs');
let c = fs.readFileSync('suppliers.js', 'utf8');

c = c.replace(
  "document.getElementById('supex-type-act')?.classList.toggle('active',t==='act');",
  "document.getElementById('supex-type-act')?.classList.toggle('active',t==='act');\n  document.getElementById('supex-type-place')?.classList.toggle('active',t==='place');"
);

c = c.replace(
  "if(actOpts) actOpts.style.display=t==='act'?'':'none';",
  "if(actOpts) actOpts.style.display=(t==='act' || t==='place')?'':'none';"
);

c = c.replace(
  "function openSupExport(supName){",
  `function openSupExport(supName){
  const selWrap = document.getElementById('supex-supplier-wrap');
  const sel = document.getElementById('supex-supplier-sel');
  if(!supName) {
    if(selWrap) selWrap.style.display = 'block';
    if(sel) {
      const sups = (typeof window.getAllSup === 'function' ? window.getAllSup() : []).filter(s => window.isActSupplier(s.name)).sort((a,b)=>a.name.localeCompare(b.name,'he'));
      sel.innerHTML = '<option value="">-- בחר ספק / כל הספקים --</option>' + sups.map(s=>\`<option value="\${s.name}">\${s.name}</option>\`).join('');
      sel.value = '';
    }
  } else {
    if(selWrap) selWrap.style.display = 'none';
    if(sel) sel.value = supName;
  }`
);

c = c.replace(
  "const from=document.getElementById('supex-from').value;",
  `
  let actualSupName = window._supExName;
  const selWrap = document.getElementById('supex-supplier-wrap');
  if(selWrap && selWrap.style.display !== 'none') {
    actualSupName = document.getElementById('supex-supplier-sel').value;
  }
  
  if(_supExType==='place' && !actualSupName) {
    window._spAlertDialog('לצורך הפקת דוח שיבוצים, חובה לבחור ספק ספציפי מהרשימה.');
    return;
  }

  const from=document.getElementById('supex-from').value;`
);

c = c.replace(
  "if(window._supExName&&window.supBase(s.a)!==window.supBase(window._supExName)) return false;",
  "if(actualSupName&&window.supBase(s.a)!==window.supBase(actualSupName)) return false;"
);

c = c.replace(
  "const title = window._supExName ? `דו\"ח פעילות לספק: ${window._supExName} (טווח: ${window.fD(from)} - ${window.fD(to)})` : `דו\"ח פעילות ספקים (טווח: ${window.fD(from)} - ${window.fD(to)})`;",
  `
  let exportTypeStr = _supExType === 'place' ? 'supplier_placement' : 'supplier';
  let title = '';
  let sumTitle = '';
  if (_supExType === 'place') {
    title = \`דו"ח שיבוץ לספק - \${actualSupName} (טווח: \${window.fD(from)} - \${window.fD(to)})\`;
    sumTitle = \`סה"כ פעילויות בדו"ח (טווח: \${window.fD(from)} - \${window.fD(to)})\`;
  } else {
    title = actualSupName ? \`דו"ח פעילות לספק: \${actualSupName} (טווח: \${window.fD(from)} - \${window.fD(to)})\` : \`דו"ח פעילות ספקים (טווח: \${window.fD(from)} - \${window.fD(to)})\`;
    sumTitle = actualSupName ? \`ריכוז פעילות לספק: \${actualSupName} (טווח: \${window.fD(from)} - \${window.fD(to)})\` : \`ריכוז פעילות כל הספקים (טווח: \${window.fD(from)} - \${window.fD(to)})\`;
  }
  `
);

c = c.replace(
  "window.exportToExcel(evs, `דו\"ח_פעילויות_${window._supExName||'כל_הספקים'}_${from}_${to}`, {",
  `window.exportToExcel(evs, \`דו"ח_\${_supExType==='place'?'שיבוצים':'פעילויות'}_\${actualSupName||'כל_הספקים'}_\${from}_\${to}\`, {`
);

c = c.replace(
  "type:'supplier',",
  "type: exportTypeStr,"
);

c = c.replace(
  "title: title,",
  "title: title,"
);

c = c.replace(
  "summaryTitle: window._supExName ? `ריכוז פעילות לספק: ${window._supExName} (טווח: ${window.fD(from)} - ${window.fD(to)})` : `ריכוז פעילות כל הספקים (טווח: ${window.fD(from)} - ${window.fD(to)})`",
  "summaryTitle: sumTitle"
);

fs.writeFileSync('suppliers.js', c);
