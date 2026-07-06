const fs = require('fs');

// 1. Update index.html to add the filter input in supexm
let html = fs.readFileSync('index.html', 'utf8');

const targetHtml = `<div class="row" style="margin-bottom:11px">
          <div class="fg"><label>מ-תאריך *</label><input type="date" id="supex-from" style="min-width:140px"></div>
          <div class="fg"><label>עד-תאריך *</label><input type="date" id="supex-to" style="min-width:140px"></div>
        </div>`;
const replacementHtml = `<div class="row" style="margin-bottom:11px">
          <div class="fg"><label>מ-תאריך *</label><input type="date" id="supex-from" style="min-width:140px"></div>
          <div class="fg"><label>עד-תאריך *</label><input type="date" id="supex-to" style="min-width:140px"></div>
        </div>
        <div class="fg" style="margin-bottom:11px">
          <label>סינון לפי גנים / בית ספר (אופציונלי)</label>
          <input type="text" id="supex-garden-filter" placeholder="לדוגמה: גן אלה, גן אורן (אפשר להפריד בפסיק לחיפוש כמה גנים)" style="width:100%">
          <div style="font-size:0.7rem; color:#78909c; margin-top:2px;">השאר ריק כדי לייצא את כל הגנים של הספק. להוספת מספר גנים הפרד בפסיק.</div>
        </div>`;

if (html.includes(targetHtml)) {
    html = html.replace(targetHtml, replacementHtml);
    fs.writeFileSync('index.html', html);
    console.log('Added supex-garden-filter to index.html');
} else {
    console.log('Target not found in index.html for supexm filter');
}

// 2. Update suppliers.js to apply the filter
let supp = fs.readFileSync('suppliers.js', 'utf8');

const targetJs = `  if(!from||!to){_spAlertDialog('בחר תאריכים');return;}

  const evs=window.SCH.filter(s=>{
    if(s.d<from||s.d>to) return false;
    if(window._supExName&&window.supBase(s.a)!==window.supBase(window._supExName)) return false;
    if(s.st === 'can') return false; // Match openSupExport logic
    return true;
  })`;

const replacementJs = `  if(!from||!to){_spAlertDialog('בחר תאריכים');return;}

  const gardenFilter = (document.getElementById('supex-garden-filter')?.value || '').toLowerCase().trim();
  const filterTerms = gardenFilter ? gardenFilter.split(',').map(x => x.trim()).filter(x => x) : [];

  const evs=window.SCH.filter(s=>{
    if(s.d<from||s.d>to) return false;
    if(window._supExName&&window.supBase(s.a)!==window.supBase(window._supExName)) return false;
    if(s.st === 'can') return false; // Match openSupExport logic
    
    if (filterTerms.length > 0) {
       const gObj = window.G(s.g);
       const gName = (gObj.name || '').toLowerCase();
       const clsName = (window.gcls && window.gcls(gObj) === 'ביה"ס') ? 'בית ספר' : '';
       
       const match = filterTerms.some(term => gName.includes(term) || (clsName && clsName.includes(term)));
       if (!match) return false;
    }
    
    return true;
  })`;

if (supp.includes(targetJs)) {
    supp = supp.replace(targetJs, replacementJs);
    fs.writeFileSync('suppliers.js', supp);
    console.log('Updated doSupExport logic in suppliers.js');
} else {
    console.log('Target JS not found in suppliers.js');
}

// 3. Clear the filter when opening the modal
const openTargetJs = `  document.getElementById('supex-to').value = to;
  
  document.getElementById('supex-prev').style.display='none';`;

const openReplacementJs = `  document.getElementById('supex-to').value = to;
  if(document.getElementById('supex-garden-filter')) document.getElementById('supex-garden-filter').value = '';
  
  document.getElementById('supex-prev').style.display='none';`;

if (supp.includes(openTargetJs)) {
    supp = supp.replace(openTargetJs, openReplacementJs);
    fs.writeFileSync('suppliers.js', supp);
    console.log('Updated openSupExport to clear filter');
}
