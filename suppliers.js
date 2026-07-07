function setSupExType(t){
  _supExType=t;
  document.getElementById('supex-type-act')?.classList.toggle('active',t==='act');
  document.getElementById('supex-type-place')?.classList.toggle('active',t==='place');
  document.getElementById('supex-type-inv')?.classList.toggle('active',t==='inv');
  const actOpts=document.getElementById('supex-act-opts');
  const invOpts=document.getElementById('supex-inv-opts');
  if(actOpts) actOpts.style.display=(t==='act' || t==='place')?'':'none';
  if(invOpts) invOpts.style.display=t==='inv'?'block':'none';
}
function openSupExport(supName){
  const selWrap = document.getElementById('supex-supplier-wrap');
  const sel = document.getElementById('supex-supplier-sel');
  if(!supName) {
    if(selWrap) selWrap.style.display = 'block';
    if(sel) {
      const sups = (typeof window.getAllSup === 'function' ? window.getAllSup() : []).filter(s => window.isActSupplier(s.name)).sort((a,b)=>a.name.localeCompare(b.name,'he'));
      sel.innerHTML = '<option value="">-- בחר ספק / כל הספקים --</option>' + sups.map(s=>`<option value="${s.name}">${s.name}</option>`).join('');
      sel.value = '';
    }
  } else {
    if(selWrap) selWrap.style.display = 'none';
    if(sel) sel.value = supName;
  }
  _supExName=supName;
  _supExType='act';
  setSupExType('act');
  (document.getElementById('supexm-title')||{}).textContent=supName?`📊 יצוא: ${supName}`:'📊 יצוא דוח ספקים';
  
  const now=new Date();
  // Hierarchy: Supplier Card > Dashboard > Timeline > Current Month
  const from = document.getElementById('suc-from')?.value 
            || document.getElementById('dash-from')?.value 
            || document.getElementById('s-from')?.value
            || window.d2s(new Date(now.getFullYear(), now.getMonth(), 1));

  const to = document.getElementById('suc-to')?.value 
          || document.getElementById('dash-to')?.value 
          || document.getElementById('s-to')?.value
          || window.d2s(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  
  document.getElementById('supex-from').value = from;
  document.getElementById('supex-to').value = to;
  
  document.getElementById('supex-prev').style.display='none';
  if(window._supexSelectedGardens) window._supexSelectedGardens.clear(); if(document.getElementById('supex-garden-multi-search')) document.getElementById('supex-garden-multi-search').value = ''; if(typeof window.renderSupExGardenMultiItems === 'function') window.renderSupExGardenMultiItems();
  document.getElementById('supexm').classList.add('open');
}
function doSupExport(){
  if(_supExType==='inv'){
    // ── יצוא חשבוניות/הזמנות ──
    if(typeof window.exportSupPurchDocs==='function' && window._supExName){
      window.exportSupPurchDocs(window.supBase(window._supExName));
    } else {
      window.showToast('אין מסמכי רכש לספק זה');
    }
    window.CM('supexm');
    return;
  }

  
  let actualSupName = window._supExName;
  const selWrap = document.getElementById('supex-supplier-wrap');
  if(selWrap && selWrap.style.display !== 'none') {
    actualSupName = document.getElementById('supex-supplier-sel').value;
  }
  
  if(_supExType==='place' && !actualSupName) {
    window._spAlertDialog('לצורך הפקת דוח שיבוצים, חובה לבחור ספק ספציפי מהרשימה.');
    return;
  }

  const from=document.getElementById('supex-from').value;
  const to=document.getElementById('supex-to').value;
  if(!from||!to){_spAlertDialog('בחר תאריכים');return;}

  

  const evs=window.SCH.filter(s=>{
    if(s.d<from||s.d>to) return false;
    if(actualSupName&&window.supBase(s.a)!==window.supBase(actualSupName)) return false;
    if(s.st === 'can') return false; // Match openSupExport logic
    
    if (window._supexSelectedGardens && window._supexSelectedGardens.size > 0) {
       const gidStr = s.g.toString();
       if (!window._supexSelectedGardens.has(gidStr)) return false;
    }
    
    return true;
  }).sort((a,b)=>{
    const ga=window.G(a.g),gb=window.G(b.g);
    const cs = (ga.city||'').localeCompare(gb.city||'','he');
    if(cs !== 0) return cs;
    const ds = a.d.localeCompare(b.d);
    if(ds !== 0) return ds;
    const pA = window.gardenPair(a.g), pB = window.gardenPair(b.g);
    const nA = pA ? pA.name : ga.name;
    const nB = pB ? pB.name : gb.name;
    const ns = nA.localeCompare(nB, 'he');
    if(ns !== 0) return ns;
    return (a.t||'99:99').localeCompare(b.t||'99:99');
  });
  
  if(!evs.length){_spAlertDialog('אין פעילויות בטווח זה');return;}

  
  let exportTypeStr = _supExType === 'place' ? 'supplier_placement' : 'supplier';
  let title = '';
  let sumTitle = '';
  if (_supExType === 'place') {
    title = `דו"ח שיבוץ לספק - ${actualSupName} (טווח: ${window.fD(from)} - ${window.fD(to)})`;
    sumTitle = `סה"כ פעילויות בדו"ח (טווח: ${window.fD(from)} - ${window.fD(to)})`;
  } else {
    title = actualSupName ? `דו"ח פעילות לספק: ${actualSupName} (טווח: ${window.fD(from)} - ${window.fD(to)})` : `דו"ח פעילות ספקים (טווח: ${window.fD(from)} - ${window.fD(to)})`;
    sumTitle = actualSupName ? `ריכוז פעילות לספק: ${actualSupName} (טווח: ${window.fD(from)} - ${window.fD(to)})` : `ריכוז פעילות כל הספקים (טווח: ${window.fD(from)} - ${window.fD(to)})`;
  }
  
  
  window.exportToExcel(evs, `דו"ח_${_supExType==='place'?'שיבוצים':'פעילויות'}_${actualSupName||'כל_הספקים'}_${from}_${to}`, {
    type: exportTypeStr,
    title: title,
    summaryTitle: sumTitle
  });

  window.CM('supexm');
}
function exportExcel(){
  const f=window.getCalF();
  const y=window.calD.getFullYear(),m=window.calD.getMonth();
  const from=window.d2s(new Date(y,m,1)),to=window.d2s(new Date(y,m+1,0));
  const rel=window.SCH.filter(s=>s.d>=from&&s.d<=to&&(!f.gids||f.gids.includes(s.g))).sort((a,b)=>a.d.localeCompare(b.d));
  downloadCSV(rel,`פעילויות_${window.hebM(window.calD)}`);
}
function exportExcelSched(){
  const rel=window.getFiltSched();
  downloadCSV(rel,'לוח_זמנים');
}
function downloadCSV(data,fname){
  const headers=['תאריך','יום','עיר','שם הצהרון','כתובת','ספק','שעה','קבוצות','סטטוס','סיבה','הערות','תאריך דחייה'];
  const rows=data.map(s=>{
    const g=window.G(s.g);
    const stMap={ok:'מתקיים',done:'התקיים',can:'בוטל',post:'נדחה',nohap:'לא התקיים'};
    const formattedNote = typeof window.formatNoteWithTag === 'function' ? window.formatNoteWithTag(s) : (s.nt || '');
    return[window.fD(s.d),`יום ${window.dayN(s.d)}`,g.city||'',g.name||'',g.st||'',s.a,window.fT(s.t),s.grp>1?s.grp:'',stMap[s.st]||s.st,s.cr||'',formattedNote,s.pd?window.fD(s.pd):''];
  });
  const bom='\uFEFF';
  const csv=bom+[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download=fname+'.csv';
  a.click();
}

function getAllSup(){
  if(typeof window.SUPBASE==='undefined'||typeof window.supEx==='undefined') return [];
  const mergedAway = new Set(window.supEx['__merged_away']||[]);
  const map={};

  // 1. Master List (SUPBASE)
  window.SUPBASE.forEach(s=>{
    if(mergedAway.has(s.name)) return;
    const base=window.supBase(s.name);
    const act=window.supAct(s.name);
    if(!map[base]) map[base]={name:base,phone:s.phone,acts:new Set(),fullNames:new Set()};
    if(act) map[base].acts.add(act);
    map[base].fullNames.add(s.name);
    if(!map[base].phone&&s.phone) map[base].phone=s.phone;
  });

  // 2. Custom Suppliers (__c)
  (window.supEx['__c']||[]).forEach(s=>{
    if(mergedAway.has(s.name)) return;
    const base=window.supBase(s.name);
    if(mergedAway.has(base)) return;
    if(!map[base]) map[base]={name:base,phone:s.phone||'',acts:new Set(),fullNames:new Set()};
    map[base].fullNames.add(s.name);
    if(!map[base].phone&&(s.phone||'')) map[base].phone=s.phone;
  });

  // 3. DISCOVERY FROM SCHEDULES (SCH)
  // Ensure anyone with actual activities appears in the list, even if definitions are missing
  // We skip mergedAway check here because if they have activities, we WANT to see them
  if(Array.isArray(window.SCH)){
    window.SCH.forEach(s=>{
      const base = window.supBase(s.a);
      if(!base) return; 
      if(!map[base]){
        map[base]={name:base, phone:'', acts:new Set(), fullNames:new Set(), isDiscovered:true};
      }
      const act = window.supAct(s.a);
      if(act) map[base].acts.add(act);
      map[base].fullNames.add(s.a);
    });
  }

  return Object.values(map).map(m=>({
    ...m,
    acts:[...m.acts].sort((a,b)=>a.localeCompare(b,'he')),
    fullNames:[...m.fullNames]
  })).sort((a,b)=>a.name.localeCompare(b.name,'he'));
}
function getSupActs(name){
  if(!name) return[];
  const base=supBase(name);
  const ex=supEx[base]||supEx[name]||{};
  const fromSch=new Set();

  // 1. From SCH entries (always scan — never skip)
  window.SCH.forEach(s=>{ 
    if(window.supBase(s.a)===base){
      const a=window.supAct(s.a);
      if(a)fromSch.add(a);
      if(s.act)fromSch.add(s.act);
    } 
  });
  // 2. From SUPBASE (current base)
  window.SUPBASE.forEach(s=>{ if(window.supBase(s.name)===base){const a=window.supAct(s.name);if(a)fromSch.add(a);} });
  // 3. From merged-from history (_mergedFrom stores old bases that were merged into this one)
  const mergedFromBases = ex._mergedFrom||[];
  mergedFromBases.forEach(oldBase=>{
    SCH.forEach(s=>{ 
      if(supBase(s.a)===oldBase){
        const a=supAct(s.a);
        if(a)fromSch.add(a);
        if(s.act)fromSch.add(s.act);
      } 
    });
    SUPBASE.forEach(s=>{ if(supBase(s.name)===oldBase){const a=supAct(s.name);if(a)fromSch.add(a);} });
  });
  const hidden = new Set(ex.hiddenActs || []);
  // 5. Merge with explicitly saved acts (manual additions not in SCH)
  if(Array.isArray(ex.acts)) ex.acts.forEach(a=>{ if(a) fromSch.add(a); });

  return [...fromSch].filter(a => !hidden.has(a)).sort((a,b)=>a.localeCompare(b,'he'));
}
// Supplier list index helpers — avoid HTML attribute escaping issues
let _supCurrentList = [];
function supOpen(idx){ const n=_supCurrentList[idx]?.name||''; if(n) openSupCard(n); }
function supEdit(idx){ const n=_supCurrentList[idx]?.name||''; if(n){ openSupCard(n); setTimeout(sucToggleEdit,250); } }

let _supViewMode='list';
function setSupView(mode){
  _supViewMode=mode;
  document.getElementById('su-view-cards').classList.toggle('active',mode==='cards');
  document.getElementById('su-view-list').classList.toggle('active',mode==='list');
  renderSup();
}
let _supTab='all';
function setSupTab(t){
  _supTab=t;
  ['all','act','purch'].forEach(x=>{const b=document.getElementById('sup-tab-'+x);if(b)b.classList.toggle('active',x===t);});
  renderSup();
}
let _vatMode='ex'; // 'ex'=excluding VAT, 'inc'=including VAT
function setVatMode(m){
  _vatMode=m;
  document.getElementById('vat-btn-ex')?.classList.toggle('active',m==='ex');
  document.getElementById('vat-btn-inc')?.classList.toggle('active',m==='inc');
  calcVat();
}
function calcVat(){
  const v=parseFloat(document.getElementById('sp-amount')?.value)||0;
  const res=document.getElementById('vat-result');
  if(!res||!v){if(res)res.textContent='';return;}
  if(_vatMode==='ex'){
    res.textContent=`→ כולל מע"מ: ₪${(v*1.17).toFixed(2)}`;
  } else {
    res.textContent=`→ לפני מע"מ: ₪${(v/1.17).toFixed(2)}`;
  }
}
function getAmountExVat(){
  const v=parseFloat(document.getElementById('sp-amount')?.value)||0;
  return _vatMode==='inc'?+(v/1.17).toFixed(2):v;
}
// ────────────────────────────────────────────────────────────────────────────
// repairAllSuppliers — comprehensive supplier list repair
// Run this to fix suppliers after merges, imports, or other data issues
// ────────────────────────────────────────────────────────────────────────────
function repairAllSuppliers(){
  if(!window.supEx) window.supEx={};
  if(!window.supEx['__c']) window.supEx['__c']=[];

  // mergedAway: suppliers intentionally hidden after merge — NEVER modify this list
  const mergedAway = new Set(window.supEx['__merged_away']||[]);
  const mergedFixed = 0;
  const inSupbase = new Set(window.SUPBASE.map(s=>window.supBase(s.name)));
  const inC = new Set(window.supEx['__c'].map(s=>window.supBase(s.name)));
  let added=0, fixed=0;

  // 1. Scan all schedule entries — ensure their base supplier is registered
  const schBases = new Set();
  window.SCH.forEach(s=>{ if(s.a) schBases.add(window.supBase(s.a)); });
  schBases.forEach(base=>{
    if(!base) return;
    // Skip if this base name itself is in mergedAway (it was a custom supplier that got merged)
    if(mergedAway.has(base)) return;
    if(inSupbase.has(base)) return;
    if(inC.has(base)) return;
    window.supEx['__c'].push({id:Date.now()+Math.random(),name:base,phone:window.supEx[base]?.ph1||''});
    if(!window.supEx[base]) window.supEx[base]={};
    if(window.supEx[base].isPurch===undefined) window.supEx[base].isPurch=true;
    inC.add(base);
    added++;
  });

  // 2. Scan INVOICES
  window.INVOICES.forEach(inv=>{
    const base=inv.supName?window.supBase(inv.supName):'';
    if(!base||mergedAway.has(base)||inSupbase.has(base)||inC.has(base)) return;
    window.supEx['__c'].push({id:Date.now()+Math.random(),name:base,phone:window.supEx[base]?.ph1||''});
    if(!window.supEx[base]) window.supEx[base]={};
    if(window.supEx[base].isPurch===undefined) window.supEx[base].isPurch=true;
    if(window.supEx[base].isAct===undefined) window.supEx[base].isAct=false;
    inC.add(base);
    added++;
  });

  // 3. Remove duplicate __c entries (same base name)
  const seenBases = new Set();
  supEx['__c'] = supEx['__c'].filter(s=>{
    const base=supBase(s.name);
    if(seenBases.has(base)) return false;
    seenBases.add(base);
    return true;
  });

  // 4. Clear stale/incomplete acts arrays — force re-derive from SCH on next getSupActs call
  // Only clear if SCH has MORE activities than what's saved (i.e. acts array is outdated)
  let clearedActs=0;
  Object.keys(window.supEx).forEach(k=>{
    if(k==='__c'||k==='__merged_away'||k==='__gardens_extra') return;
    if(!Array.isArray(window.supEx[k]?.acts)) return;
    const base = window.supBase(k)||k;
    // Derive what SCH actually has for this supplier
    const schActs = new Set();
    window.SCH.forEach(s=>{ 
      if(window.supBase(s.a)===base){
        const a=window.supAct(s.a);
        if(a)schActs.add(a);
        if(s.act)schActs.add(s.act);
      } 
    });
    window.SUPBASE.forEach(s=>{ if(window.supBase(s.name)===base){const a=window.supAct(s.name);if(a)schActs.add(a);} });
    const savedActs = new Set(window.supEx[k].acts);
    // If SCH has acts that the saved array is missing → clear saved array so it auto-derives fully
    const missingFromSaved = [...schActs].filter(a=>!savedActs.has(a));
    if(missingFromSaved.length > 0 || window.supEx[k].acts.length === 0){
      delete window.supEx[k].acts; clearedActs++;
    }
  });

  if(added>0||clearedActs>0||mergedFixed>0) window.save();
  const msg=`🔧 ספקים: ${added} נוספו${mergedFixed?`, ${mergedFixed} mergedAway תוקנו`:''}${clearedActs?`, ${clearedActs} acts תוקנו`:''}`;
  console.log(msg);
  if(added>0||mergedFixed>0) window.showToast(`✅ ${msg}`);
  try{ window.renderPurchSuppliers(); }catch(e){}
  try{ renderSup(); }catch(e){}
}

function renderSup(){
  const srch=(document.getElementById('su-srch').value||'').toLowerCase();
  const sortMode=(document.getElementById('su-sort')||{value:'name'}).value;
  // p-sup (חוגים mode) always shows only act suppliers
  let all=getAllSup().filter(s=>{
    const base = s.name||'';
    if(srch && !base.toLowerCase().includes(srch)) return false;
    return window.isActSupplier(base); // Only activity suppliers in חוגים panel
  });
  // Always sort alphabetically first, then by count if selected
  all=[...all].sort((a,b)=>(a.name||'').localeCompare(b.name||'','he'));
  if(sortMode==='cnt') all=[...all].sort((a,b)=>window.supBaseCnt(b.name)-window.supBaseCnt(a.name));

  if(_supViewMode==='list'){
    document.getElementById('su-body').className='scroll-area';
    let h='<table style="width:100%;border-collapse:collapse;font-size:.83rem;table-layout:fixed">'
      +'<colgroup><col style="width:28%"><col style="width:17%"><col style="width:8%"><col style="width:30%"><col style="width:17%"></colgroup>'
      +'<thead><tr style="background:#e8eaf6;position:sticky;top:0">'
      +'<th style="padding:7px 12px;text-align:right;font-weight:700;border-bottom:2px solid #c5cae9">ספק</th>'
      +'<th style="padding:7px 8px;text-align:center;font-weight:700;border-bottom:2px solid #c5cae9;white-space:nowrap">טלפון</th>'
      +'<th style="padding:7px 8px;text-align:center;font-weight:700;border-bottom:2px solid #c5cae9;white-space:nowrap">פעילויות</th>'
      +'<th style="padding:7px 8px;text-align:right;font-weight:700;border-bottom:2px solid #c5cae9">סוגים</th>'
      +'<th style="padding:7px 8px;border-bottom:2px solid #c5cae9"></th>'
      +'</tr></thead><tbody>';
    _supCurrentList = all; // save for index-based helpers
    all.forEach((s,idx)=>{
      const base=s.name;
      const ex=window.supBaseEx(base);
      const cnt=window.supBaseCnt(base);
      const acts=getSupActs(base);
      const phone=ex.ph1||s.phone||'';
      const bg=idx%2===0?'#fff':'#f8f9ff';
      h+=`<tr style="background:${bg};cursor:pointer" onclick="supOpen(${idx})">`
        +`<td style="padding:6px 12px;font-weight:700;color:#1a237e;border-bottom:1px solid #e8eaf6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:0">${base}`
        +`${window.isActSupplier(base)?' <span style="font-size:.65rem;color:#1565c0">🎨</span>':''}` 
        +`${window.isPurchSupplier(base)?' <span style="font-size:.65rem;color:#2e7d32">🛒</span>':''}` 
        +`</td>`
        +`<td style="padding:6px 8px;text-align:center;color:#2e7d32;border-bottom:1px solid #e8eaf6;white-space:nowrap">${phone||'—'}</td>`
        +`<td style="padding:6px 8px;text-align:center;font-weight:700;color:#1565c0;border-bottom:1px solid #e8eaf6">${cnt}</td>`
        +`<td style="padding:6px 8px;border-bottom:1px solid #e8eaf6;font-size:.78rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:0">${acts.join(', ')}</td>`
        +`<td style="padding:6px 8px;text-align:center;border-bottom:1px solid #e8eaf6;white-space:nowrap">`
        +`<button class="btn bp bsm" style="font-size:.65rem" onclick="event.stopPropagation();supOpen(${idx});setTimeout(()=>openSupExportFromCard(),200)">📊</button> `
        +`<button class="btn bo bsm" style="font-size:.65rem" onclick="event.stopPropagation();supEdit(${idx})">✏️</button>`
        +`</td></tr>`;
    });
    h+='</tbody></table>';
    document.getElementById('su-body').innerHTML=h||'<p style="color:#999">לא נמצאו</p>';
    setTimeout(window._fitScrollAreas,50);
    return;
  }

  document.getElementById('su-body').className='sugrid scroll-area';
  _supCurrentList = all;
  let h='';
  all.forEach((s,idx)=>{
    const base=s.name; // already a base name from getAllBaseSups
    const ex=window.supBaseEx(base);
    const cnt=window.supBaseCnt(base);
    const acts=getSupActs(base);
    const phone=ex.ph1||s.phone||'';
    const cntDone=window.SCH.filter(sc=>window.supBase(sc.a)===base&&sc.st==='done').length;
    const cntCan=window.SCH.filter(sc=>window.supBase(sc.a)===base&&sc.st==='can').length;
    h+=`<div class="sucard" style="cursor:pointer;display:flex;flex-direction:column;justify-content:space-between" onclick="supOpen(${idx})">
      <div>
        <div style="font-weight:800;color:#1a237e;font-size:.88rem;line-height:1.35;margin-bottom:6px;word-break:break-word">📚 ${base}</div>
        ${phone?`<div style="color:#2e7d32;font-size:.78rem;font-weight:600;margin-bottom:5px">📞 ${phone}</div>`:''}
        ${acts.length?`<div style="margin-bottom:6px;display:flex;flex-wrap:wrap;gap:3px">
          ${acts.map(a=>`<span style="background:#e3f2fd;color:#1565c0;border-radius:10px;padding:2px 8px;font-size:.71rem;font-weight:600">🎯 ${a}</span>`).join('')}
        </div>`:''}
        ${ex.notes?`<div style="font-size:.68rem;color:#78909c;margin-bottom:4px">📝 ${ex.notes}</div>`:''}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;padding-top:6px;border-top:1px solid #f0f0f0">
        <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
          ${window.isActSupplier(base)?'<span class="sup-flag sup-flag-act" title="ספק חוגים פעיל">🎨</span>':'<span style="display:inline-block;padding:1px 5px;border-radius:10px;font-size:.64rem;background:#fce4ec;color:#c62828;font-weight:700" title="לא מוצג בחוגים">🚫 לא חוג</span>'}
          ${window.isPurchSupplier(base)?'':'<span style="display:inline-block;padding:1px 5px;border-radius:10px;font-size:.64rem;background:#fff3e0;color:#e65100;font-weight:700" title="לא ספק רכש">🚫 לא רכש</span>'}
          ${ex.entityType?`<span style="display:inline-block;padding:1px 6px;border-radius:10px;font-size:.66rem;background:#f3e5f5;color:#6a1b9a;font-weight:700">🏢 ${ex.entityType}</span>`:''}
          <span style="color:#1565c0;font-weight:700;font-size:.72rem">📅 ${cnt}</span>
          ${cntDone?`<span style="color:#2e7d32;font-size:.72rem">✔️ ${cntDone}</span>`:''}
          ${cntCan?`<span style="color:#c62828;font-size:.72rem">❌ ${cntCan}</span>`:''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn bp bsm" style="font-size:.65rem" onclick="event.stopPropagation();supOpen(${idx});setTimeout(()=>openSupExportFromCard(),200)">📊</button>
          <button class="btn bo bsm" style="font-size:.65rem" onclick="event.stopPropagation();supEdit(${idx})">✏️</button>
        </div>
      </div>
    </div>`;
  });
  document.getElementById('su-body').innerHTML=h||'<p style="color:#999">לא נמצאו</p>';
  setTimeout(window._fitScrollAreas,50);
}
function openSupModal(name){
  window.editingSup=name||null;
  (document.getElementById('sum-title')||{}).textContent =name?'✏️ עריכת ספק':'➕ הוסף ספק';
  const s=name?window.SUPBASE.find(x=>x.name===name)||{}:{};
  const ex=name?window.supEx[name]||{}:{};
  const nameInput=document.getElementById('su-name');
  nameInput.value=name||'';
  nameInput.disabled=false; // always allow rename
  nameInput.dataset.orig=name||'';
  const warnEl=document.getElementById('su-name-warn');
  if(warnEl) warnEl.style.display='none';
  nameInput.oninput=()=>{
    const orig=nameInput.dataset.orig;
    if(warnEl) warnEl.style.display=(orig&&nameInput.value!==orig)?'block':'none';
  };
  document.getElementById('su-ph1').value=ex.ph1||s.phone||'';
  document.getElementById('su-ph2').value=ex.ph2||'';
  document.getElementById('su-gov1').value=ex.g1||'';
  document.getElementById('su-gov2').value=ex.g2||'';
  document.getElementById('su-notes').value=ex.notes||'';
  // New fields
  const suContact=document.getElementById('su-contact'); if(suContact) suContact.value=ex.contact||'';
  const suEmail=document.getElementById('su-email'); if(suEmail) suEmail.value=ex.email||'';
  const suAddr=document.getElementById('su-addr'); if(suAddr) suAddr.value=ex.addr||'';
  const suMoe=document.getElementById('su-moe-tax'); if(suMoe) suMoe.value=ex.moeTax||'';
  const suAlias=document.getElementById('su-alias'); if(suAlias) suAlias.value=ex.alias||'';
  const suSchedPh=document.getElementById('su-sched-phone'); if(suSchedPh) suSchedPh.value=ex.schedPhone||'ph1';
  // Supplier type — default: isPurch=true, isAct=false for new suppliers
  const suIsAct = document.getElementById('su-is-act');
  const suIsPurch = document.getElementById('su-is-purch');
  const defaultIsAct = name ? (ex.isAct !== false) : false; // new suppliers default to purch-only
  const defaultIsPurch = name ? (ex.isPurch !== false) : true;
  if(suIsAct) suIsAct.checked = defaultIsAct;
  if(suIsPurch) suIsPurch.checked = defaultIsPurch;
  const suEntityType = document.getElementById('su-entity-type');
  if(suEntityType) suEntityType.value = ex.entityType||'';
  const suEntityTop = document.getElementById('su-entity-type-top');
  if(suEntityTop) suEntityTop.value = ex.entityType||'';
  // Show/hide acts section
  const suActsWrap = document.getElementById('su-acts-wrap');
  if(suActsWrap) suActsWrap.style.display = defaultIsAct ? 'block' : 'none';
  renderSupActsList(name);
  document.getElementById('su-act-new').value='';
  // Show delete button only when editing existing supplier
  const delBtn = document.getElementById('sum-del-btn');
  if (delBtn) delBtn.style.display = name ? 'inline-flex' : 'none';
  document.getElementById('sum').classList.add('open');

  // Attach auto-save listeners
  const attachAutoSave = (id) => {
    const el = document.getElementById(id);
    if(el) {
      el.removeEventListener('change', window._supAutoSaveHandler);
      window._supAutoSaveHandler = () => saveSup(true);
      el.addEventListener('change', window._supAutoSaveHandler);
    }
  };
  ['su-ph1','su-ph2','su-gov1','su-gov2','su-notes','su-contact','su-email','su-addr','su-moe-tax','su-alias','su-sched-phone','su-is-act','su-is-purch','su-entity-type','su-entity-type-top'].forEach(attachAutoSave);
}
function renderSupActsList(name){
  const acts=name?getSupActs(name):[];
  const el=document.getElementById('su-acts-list');
  if(!el) return;
  if(!acts.length){el.innerHTML='<p style="color:#999;font-size:.75rem">אין פעילויות מוגדרות</p>';return;}
  el.innerHTML=acts.map((a,i)=>`
    <div style="display:flex;gap:6px;align-items:center;padding:3px 0;border-bottom:1px solid #f0f0f0">
      <span style="flex:1;font-size:.8rem">🎯 ${a}</span>
      <button class="btn br bsm" style="font-size:.65rem;padding:1px 5px" onclick="removeSupAct(${i})">✕</button>
    </div>`).join('');
}
function addSupAct(){
  const inp=document.getElementById('su-act-new');
  const val=inp.value.trim();
  if(!val) return;
  const name=document.getElementById('su-name').dataset.orig||document.getElementById('su-name').value;
  if(!window.supEx[name]) window.supEx[name]={};
  if(!Array.isArray(window.supEx[name].acts)) window.supEx[name].acts=getSupActs(name);
  if(!window.supEx[name].acts.includes(val)) window.supEx[name].acts.push(val);
  inp.value='';
  renderSupActsList(name);
}
function removeSupAct(idx){
  const name=document.getElementById('su-name').dataset.orig||document.getElementById('su-name').value;
  const acts=getSupActs(name);
  const actToRemove = acts[idx];
  if(!window.supEx[name]) window.supEx[name]={};
  if(!window.supEx[name].hiddenActs) window.supEx[name].hiddenActs=[];
  if(!window.supEx[name].hiddenActs.includes(actToRemove)) window.supEx[name].hiddenActs.push(actToRemove);
  
  if(Array.isArray(window.supEx[name].acts)) {
    window.supEx[name].acts = window.supEx[name].acts.filter(a => a !== actToRemove);
  }
  renderSupActsList(name);
}
function deleteSup() {
  const name = document.getElementById('su-name').dataset.orig;
  if (!name) return;
  const schedCount = window.SCH.filter(s => s.a === name && s.st !== 'can').length;
  const msg = schedCount > 0
    ? `לספק "${name}" יש ${schedCount} פעילויות פעילות.\nמחיקה תסיר את הספק מהמערכת אך לא תמחק את הפעילויות.\n\nלהמשיך?`
    : `למחוק את הספק "${name}"?`;
  if (!confirm(msg)) return;

  // Remove from supEx
  delete window.supEx[name];

  // Remove from custom suppliers list
  if (window.supEx['__c']) {
    window.supEx['__c'] = window.supEx['__c'].filter(s => s.name !== name);
  }

  // Mark as deleted in merged-away (hides from SUPBASE-based suppliers)
  if (!window.supEx['__merged_away']) window.supEx['__merged_away'] = [];
  if (!window.supEx['__merged_away'].includes(name)) window.supEx['__merged_away'].push(name);

  window.save();
  window.CM('sum');
  window.refresh();
  if (typeof renderSup === 'function') renderSup();
  if (typeof window.renderPurchSuppliers === 'function') try { window.renderPurchSuppliers(); } catch(e) {}
  window.showToast('🗑️ ספק "' + name + '" נמחק');
}

function saveSup(silent = false){
  const nameEl=document.getElementById('su-name');
  const name=nameEl.value.trim();
  const origName=nameEl.dataset.orig;
  if(!name){ if(!silent) _spAlertDialog('יש להזין שם'); return; }
  if(origName&&origName!==name){
    if(silent) return; // Do not auto-save if name is being changed (requires prompt)
    if(!confirm(`לשנות את שם הספק מ-"${origName}" ל-"${name}"?\nכל השיבוצים יעודכנו אוטומטית.`)) return;
    window.SCH.forEach(s=>{if(s.a===origName)s.a=name;});
    if(window.supEx[origName]) window.supEx[name]={...window.supEx[origName]};
    delete window.supEx[origName];
    if(window.supEx['__c']) window.supEx['__c']=window.supEx['__c'].map(s=>s.name===origName?{...s,name}:s);
  }
  const existActs=Array.isArray((window.supEx[name]||{}).acts)?(window.supEx[name].acts):getSupActs(name);
  window.supEx[name]={
    ...(window.supEx[name]||{}),
    ph1:document.getElementById('su-ph1').value.trim(),
    ph2:document.getElementById('su-ph2').value.trim(),
    g1:document.getElementById('su-gov1').value.trim(),
    g2:document.getElementById('su-gov2').value.trim(),
    notes:document.getElementById('su-notes').value.trim(),
    contact:document.getElementById('su-contact')?.value.trim()||'',
    email:document.getElementById('su-email')?.value.trim()||'',
    addr:document.getElementById('su-addr')?.value.trim()||'',
    moeTax:document.getElementById('su-moe-tax')?.value.trim()||'',
    alias:document.getElementById('su-alias')?.value.trim()||'',
    schedPhone:document.getElementById('su-sched-phone')?.value||'ph1',
    acts:existActs,
    isAct: !!document.getElementById('su-is-act')?.checked,
    isPurch: !!document.getElementById('su-is-purch')?.checked,
    entityType: document.getElementById('su-entity-type')?.value||''
  };
  if(!origName&&!window.SUPBASE.find(s=>s.name===name)){
    if(!window.supEx['__c']) window.supEx['__c']=[];
    if(!window.supEx['__c'].find(s=>s.name===name)) window.supEx['__c'].push({id:Date.now(),name,phone:window.supEx[name].ph1});
  }
  window.save();window.CM('sum');window.refresh();
  try{ window.renderPurchSuppliers(); }catch(e){}
  try{ renderSup(); }catch(e){}
  if(silent) {
    window.showToast('✅ נשמר!');
    return; // Don't close the modal if auto-saving
  }
  // If opened from invoice modal, pre-fill the supplier field
  if(window._invPendingNewSup && name){
    window._invPendingNewSup=false;
    // Reopen invoice modal with new supplier pre-filled
    setTimeout(()=>{
      const invModal = document.getElementById('invoice-m');
      if(invModal){
        // Fill supplier field
        const supTxt=document.getElementById('inv-sup-text');
        if(supTxt){ supTxt.value=name; window.invUpdateEntityType((window.supEx[name]||{}).entityType||''); }
        // Re-fill datalist
        const dl=document.getElementById('inv-sup-datalist');
        if(dl) dl.innerHTML=getAllSup().map(s=>{
          const safeVal=s.name.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
          return `<option value="${safeVal}">${s.name}`;
        }).join('');
        // Reopen invoice modal
        invModal.classList.add('open');
      }
    }, 100);
  }
  ['dash-sup','cal-sup','s-sup','ns-sup'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const cur=el.value;
    el.innerHTML='<option value="">כל הספקים</option>';
    getAllSup().filter(s=>window.isActSupplier(s.name)).forEach(s=>{
      const disp = window.supNameLabel(s.name) !== s.name ? window.supNameLabel(s.name) + ' (' + s.name + ')' : s.name;
      el.innerHTML+=`<option value='${s.name}'>${disp}</option>`;
    });
    el.value=cur;
  });
}
// Global supplier list used by merge dialog (avoids HTML attribute escaping issues)
let _mergeSupList = [];
function openMerge(){
  _mergeSupList = getAllSup();
  const mm=document.getElementById('mrg-main');
  // Use index as value to avoid HTML escaping issues with " ' characters in names
  mm.innerHTML='<option value="">בחר ספק ראשי...</option>';
  _mergeSupList.forEach((s,i)=>mm.innerHTML+=`<option value="${i}">${s.name}</option>`);
  document.getElementById('mrg-list').innerHTML=_mergeSupList.map((s,i)=>{
    const cnt=window.SCH.filter(sc=>window.supBase(sc.a)===s.name||sc.a===s.name||sc.a.startsWith(s.name+' - ')).length;
    const invCnt=(typeof window.INVOICES!=='undefined')?window.INVOICES.filter(inv=>inv.supName===s.name||window.supBase(inv.supName||'')===s.name).length:0;
    return `<label style="display:flex;gap:6px;padding:4px 6px;cursor:pointer;align-items:center;border-radius:5px" onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background=''">`
      +`<input type="checkbox" data-idx="${i}" style="width:15px;height:15px">`
      +`<span style="flex:1">${s.name} `
      +`<span style="color:#1565c0;font-size:.7rem;font-weight:700">(${cnt} שיבוצים${invCnt?`, ${invCnt} חשבוניות`:''})</span>`
      +`</span></label>`;
  }).join('');
  document.getElementById('mrgm').classList.add('open');
}
// ────────────────────────────────────────────────────────────────────────────
// auditMergedSuppliers — הרץ מה-console לדוח מלא על כל ספק ממוזג
// Usage: auditMergedSuppliers()
// ────────────────────────────────────────────────────────────────────────────
function auditMergedSuppliers(){
  const mergedAway = window.supEx['__merged_away']||[];
  const allSups = getAllSup();
  const lines = [];

  lines.push('=== AUDIT: ספקים ממוזגים ===');
  lines.push(`mergedAway רשימה (${mergedAway.length}): ${mergedAway.join(', ')||'ריק'}`);
  lines.push('');

  // For every supplier, show if they have _mergedFrom
  const suppliersWithMerge = allSups.filter(s=>{
    const ex = window.supEx[s.name]||window.supEx[window.supBase(s.name)]||{};
    return (ex._mergedFrom||[]).length>0;
  });

  lines.push(`=== ספקים עם _mergedFrom (${suppliersWithMerge.length}) ===`);
  suppliersWithMerge.forEach(s=>{
    const base = s.name;
    const ex = window.supEx[base]||{};
    const acts = getSupActs(base);
    const schCnt = window.SCH.filter(sc=>window.supBase(sc.a)===base).length;
    const invCnt = (typeof window.INVOICES!=='undefined'?window.INVOICES:[]).filter(i=>window.supBase(i.supName||'')===base).length;
    lines.push(`\n► ${base}`);
    lines.push(`  _mergedFrom: [${(ex._mergedFrom||[]).join(', ')}]`);
    lines.push(`  isAct: ${ex.isAct} | isPurch: ${ex.isPurch}`);
    lines.push(`  acts (${acts.length}): [${acts.join(', ')}]`);
    lines.push(`  SCH שיבוצים: ${schCnt} | חשבוניות: ${invCnt}`);
    lines.push(`  בלוח חוגים: ${window.isActSupplier(base)?'✅ כן':'❌ לא'} | בלוח רכש: ${window.isPurchSupplier(base)?'✅ כן':'❌ לא'}`);
  });

  lines.push('\n=== mergedAway — פירוט כל ספק שמוסתר ===');
  mergedAway.forEach(name=>{
    const base = window.supBase(name);
    const schOrphans = window.SCH.filter(s=>window.supBase(s.a)===base).length;
    const invOrphans = (typeof window.INVOICES!=='undefined'?window.INVOICES:[]).filter(i=>window.supBase(i.supName||'')===base).length;
    const status = (schOrphans||invOrphans)?'⚠️ יש רשומות יתומות!':'✅ נקי';
    lines.push(`  ${name} (base: ${base}) → ${status}${schOrphans?` SCH:${schOrphans}`:''}${invOrphans?` INV:${invOrphans}`:''}`);
  });

  lines.push('\n=== כל הספקים — סיכום ===');
  allSups.forEach(s=>{
    const base=s.name;
    const acts=getSupActs(base);
    const cnt=window.SCH.filter(sc=>window.supBase(sc.a)===base).length;
    lines.push(`${base}: isAct=${window.isActSupplier(base)} isPurch=${window.isPurchSupplier(base)} acts=[${acts.join(',')}] SCH=${cnt}`);
  });

  const report = lines.join('\n');
  console.log(report);
  // Also show a toast summary
  window.showToast(`🔍 Audit: ${suppliersWithMerge.length} ספקים ממוזגים, ${mergedAway.length} מוסתרים — ראה console`);
  return report;
}

function doMerge(){
  const mainIdx=document.getElementById('mrg-main').value;
  if(mainIdx===''){_spAlertDialog('בחר ספק ראשי');return;}
  const main=_mergeSupList[parseInt(mainIdx)]?.name;
  if(!main){_spAlertDialog('שגיאה: לא נמצא ספק ראשי');return;}
  const checkedIdxs=[...document.querySelectorAll('#mrg-list input[type=checkbox]:checked')].map(c=>parseInt(c.dataset.idx));
  const toMrg=checkedIdxs.map(i=>_mergeSupList[i]?.name).filter(n=>n && n!==main);
  if(!toMrg.length){_spAlertDialog('בחר לפחות ספק אחד למיזוג');return;}
  if(!confirm(`לאחד ${toMrg.length} ספקים אל "${main}"?`)) return;

  const mainBase = window.supBase(main);
  let changedSch=0, changedInv=0;
  const mergedAway = new Set(window.supEx['__merged_away']||[]);

  // Collect all acts from main AND all merged suppliers BEFORE changing anything
  const allActs = new Set(getSupActs(main));
  let mergedIsAct = window.isActSupplier(main);
  let mergedIsPurch = window.isPurchSupplier(main);

  toMrg.forEach(old=>{
    const oldBase = window.supBase(old);

    // Collect acts from this merged supplier
    getSupActs(old).forEach(a=>allActs.add(a));
    if(window.isActSupplier(old)) mergedIsAct = true;
    if(window.isPurchSupplier(old)) mergedIsPurch = true;

    // 1. Update INVOICES
    if(typeof window.INVOICES!=='undefined') window.INVOICES.forEach(inv=>{
      if(window.supBase(inv.supName||'')===oldBase){
        inv.supName = main;
        changedInv++;
      }
    });

    // 3. Merge supEx metadata
    const ex = window.supEx[old] || window.supEx[oldBase] || {};
    if(!window.supEx[mainBase]) window.supEx[mainBase]={};
    const mex = window.supEx[mainBase];
    if(!mex.ph1 && ex.ph1) mex.ph1=ex.ph1;
    if(!mex.ph2 && ex.ph2) mex.ph2=ex.ph2;
    if(!mex.email && ex.email) mex.email=ex.email;
    if(!mex.contact && ex.contact) mex.contact=ex.contact;
    if(!mex.addr && ex.addr) mex.addr=ex.addr;
    if(!mex.g1 && ex.g1) mex.g1=ex.g1;
    if(!mex.moeTax && ex.moeTax) mex.moeTax=ex.moeTax;
    if(!mex.entityType && ex.entityType) mex.entityType=ex.entityType;
    if(!mex.notes && ex.notes) mex.notes=ex.notes;
    
    // Merge keywords and add the old base name as a keyword
    let kws = new Set(mex.keywords ? mex.keywords.split(',').map(s=>s.trim()).filter(Boolean) : []);
    if(ex.keywords) ex.keywords.split(',').forEach(k=>kws.add(k.trim()));
    if(oldBase && oldBase !== mainBase) kws.add(oldBase);
    mex.keywords = [...kws].filter(Boolean).join(', ');

    // 4. Remove old from __c and supEx
    delete window.supEx[old];
    if(old !== oldBase) delete window.supEx[oldBase];
    if(window.supEx['__c']) window.supEx['__c'] = window.supEx['__c'].filter(s=>window.supBase(s.name)!==oldBase);

    // 5. Mark as merged-away (exact names only)
    mergedAway.add(old);
    // Also add all SUPBASE entries for oldBase (except main itself)
    window.SUPBASE.forEach(s=>{
      if(window.supBase(s.name)===oldBase && s.name!==main) mergedAway.add(s.name);
    });
  });

  // Save merged flags and acts on main
  if(!window.supEx[mainBase]) window.supEx[mainBase]={};
  // Store which bases were merged in (for act lookups later)
  const prevMergedFrom = window.supEx[mainBase]._mergedFrom||[];
  const newMergedBases = toMrg.map(o=>window.supBase(o)).filter(b=>b!==mainBase);
  window.supEx[mainBase]._mergedFrom = [...new Set([...prevMergedFrom,...newMergedBases])];
  window._mergedAliasMap = null;
  window.supEx[mainBase].isAct = mergedIsAct;
  window.supEx[mainBase].isPurch = mergedIsPurch;
  window.supEx[mainBase].acts = [...allActs].sort((a,b)=>a.localeCompare(b,'he'));
  // Also store on exact main name if different from base
  if(main !== mainBase){
    if(!window.supEx[main]) window.supEx[main]={};
    window.supEx[main].isAct = mergedIsAct;
    window.supEx[main].isPurch = mergedIsPurch;
    window.supEx[main].acts = window.supEx[mainBase].acts;
  }

  // Ensure main is in __c if not in SUPBASE
  const inSupbase = window.SUPBASE.some(s=>window.supBase(s.name)===mainBase);
  if(!inSupbase){
    if(!window.supEx['__c']) window.supEx['__c']=[];
    if(!window.supEx['__c'].find(s=>window.supBase(s.name)===mainBase)){
      window.supEx['__c'].push({id:Date.now(),name:mainBase,phone:window.supEx[mainBase]?.ph1||''});
    }
  }

  // Remove the __merged_away array push to NOT hide the suppliers
  window.save(true);
  window.CM('mrgm');
  window.refresh();
  try{ window.renderPurchSuppliers(); }catch(e){}
  window.showToast(`✅ אוחדו ${toMrg.length} ספקים → "${main}"${changedSch?` · ${changedSch} שיבוצים`:''}${changedInv?` · ${changedInv} חשבוניות`:''}`);
}

window._selectedPsups = new Set();

window.psupToggleAll = function(checked) {
  if (checked) {
    if (window._psupCurrentList) {
      window._psupCurrentList.forEach(s => window._selectedPsups.add(s.name));
    }
  } else {
    window._selectedPsups.clear();
  }
  if(typeof window.renderPurchSuppliers === 'function') window.renderPurchSuppliers();
};

window.psupCheckChanged = function(name, checked) {
  if (checked) window._selectedPsups.add(name);
  else window._selectedPsups.delete(name);
  if(typeof window.renderPurchSuppliers === 'function') window.renderPurchSuppliers();
};

window.psupMultiDelete = function() {
  const arr = Array.from(window._selectedPsups);
  if(!arr.length) return;
  if(!confirm(`האם למחוק ${arr.length} ספקים נבחרים?`)) return;
  arr.forEach(name => {
    delete window.supEx[name];
    if (window.supEx['__c']) window.supEx['__c'] = window.supEx['__c'].filter(s => s.name !== name);
    if (!window.supEx['__merged_away']) window.supEx['__merged_away'] = [];
    if (!window.supEx['__merged_away'].includes(name)) window.supEx['__merged_away'].push(name);
  });
  window._selectedPsups.clear();
  window.save(true);
  window.refresh();
  if (typeof window.renderPurchSuppliers === 'function') try { window.renderPurchSuppliers(); } catch(e) {}
  window.showToast(`🗑️ נמחקו ${arr.length} ספקים`);
};

window.psupMultiMerge = function() {
  const arr = Array.from(window._selectedPsups);
  if(!arr.length) return;
  
  let opts = '<option value="">בחר ספק ראשי לאיחוד...</option>';
  arr.forEach(name => {
    opts += `<option value="${name.replace(/"/g,'&quot;')}">${name}</option>`;
  });
  
  const formHtml = `
    <div style="direction:rtl; padding:10px;">
      <p style="margin-bottom:10px;">מבין הספקים שסימנת, בחר ספק ראשי אחד שאליו יאוחדו שאר הספקים:</p>
      <select id="multi-merge-target" style="width:100%; padding:8px; border-radius:5px; border:1px solid #ccc; font-size:1rem;">
        ${opts}
      </select>
    </div>
  `;
  
  if (window.spPromptDialog) {
    window.spPromptDialog(
      `🚀 איחוד ${arr.length} ספקים`,
      formHtml,
      'בצע איחוד',
      () => {
         const select = document.getElementById('multi-merge-target');
         const main = select.value;
         if(!main) { window.showToast('יש לבחר ספק ראשי'); return false; }
         
         const otherCount = arr.length - 1;
         if(!confirm(`האם לאחד ${otherCount} ספקים לתוך "${main}"?`)) return true;
         
         const mainBase = window.supBase(main);
         let changedSch=0, changedInv=0;
         const mergedAway = new Set(window.supEx['__merged_away']||[]);
         const allActs = new Set(getSupActs(main));
         let mergedIsAct = window.isActSupplier(main);
         let mergedIsPurch = window.isPurchSupplier(main);

         arr.forEach(old=>{
           if (old === main) return; // skip the main one
           const oldBase = window.supBase(old);
           getSupActs(old).forEach(a=>allActs.add(a));
           if(window.isActSupplier(old)) mergedIsAct = true;
           if(window.isPurchSupplier(old)) mergedIsPurch = true;

           if(window.INVOICES){
             window.INVOICES.forEach(i=>{
               if(window.supBase(i.supName||'')===oldBase){ i.supName=main; changedInv++; }
             });
           }
           mergedAway.add(oldBase);
           if(old!==oldBase) mergedAway.add(old);
         });

         if(!window.supEx[mainBase]) window.supEx[mainBase]={};
         window.supEx[mainBase].acts = Array.from(allActs);
         window.supEx[mainBase].isAct = mergedIsAct;
         window.supEx[mainBase].isPurch = mergedIsPurch;

         if(main !== mainBase){
           if(!window.supEx[main]) window.supEx[main]={};
           window.supEx[main].isAct = mergedIsAct;
           window.supEx[main].isPurch = mergedIsPurch;
           window.supEx[main].acts = window.supEx[mainBase].acts;
         }

         const prevMerged = window.supEx[mainBase]._mergedFrom || [];
         const newMerged = arr.map(old => window.supBase(old)).filter(b => b !== mainBase);
         window.supEx[mainBase]._mergedFrom = [...new Set([...prevMerged, ...newMerged])];
         window._mergedAliasMap = null;

         const inSupbase = window.SUPBASE.some(s=>window.supBase(s.name)===mainBase);
         if(!inSupbase){
           if(!window.supEx['__c']) window.supEx['__c']=[];
           if(!window.supEx['__c'].find(s=>window.supBase(s.name)===mainBase)){
             window.supEx['__c'].push({id:Date.now(),name:mainBase,phone:window.supEx[mainBase]?.ph1||''});
           }
         }

         window._selectedPsups.clear();
         window.save(true);
         window.refresh();
         try{ window.renderPurchSuppliers(); }catch(e){}
         window.showToast(`✅ אוחדו ${arr.length} ספקים → "${main}"${changedSch?` · ${changedSch} שיבוצים`:''}${changedInv?` · ${changedInv} חשבוניות`:''}`);
         return true;
      }
    );
  } else {
    alert('הפונקציה חסרה');
  }
};

var _GARDENS_EXTRA=[]; // user-added gardens stored in localStorage


window._supexSelectedGardens = new Set();
window.toggleSupExGardenMulti = function() {
  document.getElementById('supex-garden-multi-list').classList.toggle('open');
};

window.filterSupExGardenMulti = function() {
  const q = document.getElementById('supex-garden-multi-search').value.toLowerCase();
  const cities = document.querySelectorAll('.supex-city-group');
  cities.forEach(cityDiv => {
    let cityMatch = cityDiv.querySelector('.supex-city-name').textContent.toLowerCase().includes(q);
    let hasVisibleChild = false;
    const items = cityDiv.querySelectorAll('.supex-garden-item');
    items.forEach(el => {
      const match = el.textContent.toLowerCase().includes(q);
      el.style.display = match || cityMatch ? 'flex' : 'none';
      if(match || cityMatch) hasVisibleChild = true;
    });
    cityDiv.style.display = hasVisibleChild || cityMatch ? 'block' : 'none';
    
    const itemsContainer = cityDiv.querySelector('.supex-city-items');
    const toggleSpan = cityDiv.querySelector('.supex-city-toggle');
    if(q) {
       itemsContainer.style.display = 'block';
       if(toggleSpan) toggleSpan.textContent = '➖';
    } else {
       itemsContainer.style.display = 'none';
       if(toggleSpan) toggleSpan.textContent = '➕';
    }
  });
};

window.renderSupExGardenMultiItems = function() {
  const container = document.getElementById('supex-garden-multi-items');
  if(!container) return;
  const rawList = window.GARDENS.concat(window._GARDENS_EXTRA||[]);
  const gMap = new Map();
  rawList.forEach(g => gMap.set(g.id, g));
  const allGans = Array.from(gMap.values()).sort((a,b)=>(a.city||'').localeCompare(b.city||'','he')||(a.name||'').localeCompare(b.name||'','he'));
  
  const cityGroups = {};
  allGans.forEach(g => {
    const c = g.city || 'ללא עיר';
    if(!cityGroups[c]) cityGroups[c] = [];
    cityGroups[c].push(g);
  });
  
  // Re-apply open states
  const openStates = {};
  document.querySelectorAll('.supex-city-group').forEach(cg => {
    const cNameMatch = cg.querySelector('.supex-city-name').textContent.match(/^(.*?)\s+\(\d+\)$/);
    if(cNameMatch && cg.querySelector('.supex-city-items').style.display === 'block') {
      openStates[cNameMatch[1].trim()] = true;
    }
  });
  
  let html = '';
  Object.keys(cityGroups).sort((a,b)=>a.localeCompare(b,'he')).forEach(city => {
    const gans = cityGroups[city];
    const allChecked = gans.every(g => window._supexSelectedGardens.has(g.id.toString()));
    const someChecked = gans.some(g => window._supexSelectedGardens.has(g.id.toString()));
    const isOpen = openStates[city] ? 'block' : 'none';
    const toggleChar = isOpen === 'block' ? '➖' : '➕';
    
    const cityIdStr = gans.map(g=>g.id).join(',');
    
    html += `
      <div class="supex-city-group" style="border-bottom:1px solid #ddd;">
        <div style="display:flex;align-items:center;padding:5px 8px;background:#f5f5f5;font-weight:bold;cursor:pointer;" onclick="window.toggleSupExCityItems(this)">
          <span style="width:20px;text-align:center;font-size:0.8rem" class="supex-city-toggle">${toggleChar}</span>
          <input type="checkbox" style="margin-left:8px;" class="supex-city-cb" ${allChecked?'checked':''} ${someChecked&&!allChecked?'data-indeterminate="true"':''} onclick="event.stopPropagation(); window.toggleSupExCity('${cityIdStr}', this)">
          <span style="font-size:0.85rem;flex:1" class="supex-city-name">${city} (${gans.length})</span>
        </div>
        <div class="supex-city-items" style="display:${isOpen};background:#fafafa;">
    `;
    
    gans.forEach(g => {
      const isChecked = window._supexSelectedGardens.has(g.id.toString());
      html += `
          <div class="supex-garden-item" style="display:flex;align-items:center;padding:5px 8px 5px 24px;cursor:pointer;border-bottom:1px solid #eee;" onclick="window.toggleSupExGardenItem('${g.id}', event)">
            <input type="checkbox" style="margin-left:8px;" class="supex-g-cb" data-id="${g.id}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); window.toggleSupExGardenItem('${g.id}', event)">
            <span style="font-size:0.8rem">${g.name}</span>
          </div>
      `;
    });
    
    html += `</div></div>`;
  });
  
  container.innerHTML = html;
  
  container.querySelectorAll('.supex-city-cb').forEach(cb => {
    if(cb.getAttribute('data-indeterminate')==='true') cb.indeterminate = true;
  });
  
  window.updateSupExGardenMultiLabel();
};

window.toggleSupExCityItems = function(el) {
  const itemsContainer = el.nextElementSibling;
  const toggleSpan = el.querySelector('.supex-city-toggle');
  if(itemsContainer.style.display === 'none') {
    itemsContainer.style.display = 'block';
    if(toggleSpan) toggleSpan.textContent = '➖';
  } else {
    itemsContainer.style.display = 'none';
    if(toggleSpan) toggleSpan.textContent = '➕';
  }
};

window.toggleSupExCity = function(cityIdsStr, cbEl) {
  const isChecked = cbEl.checked;
  const ids = cityIdsStr.split(',');
  ids.forEach(id => {
    if(isChecked) window._supexSelectedGardens.add(id);
    else window._supexSelectedGardens.delete(id);
  });
  window.renderSupExGardenMultiItems();
};

window.toggleSupExGardenItem = function(gid, e) {
  if (e && e.target.tagName !== 'INPUT') {
    const cb = e.currentTarget.querySelector('input[type="checkbox"]');
    if(cb) cb.checked = !cb.checked;
  }
  gid = gid.toString();
  if (window._supexSelectedGardens.has(gid)) {
    window._supexSelectedGardens.delete(gid);
  } else {
    window._supexSelectedGardens.add(gid);
  }
  window.renderSupExGardenMultiItems();
};

window.updateSupExGardenMultiLabel = function() {
  const lbl = document.getElementById('supex-garden-multi-label');
  if(!lbl) return;
  if(window._supexSelectedGardens.size === 0) {
    lbl.textContent = 'כל הגנים (בחר כדי לסנן)';
  } else {
    lbl.textContent = window._supexSelectedGardens.size + ' גנים נבחרו';
  }
};

document.addEventListener('click', e => {
  if(!e.target.closest('#supex-garden-multi-wrap')){
    const list = document.getElementById('supex-garden-multi-list');
    if(list) list.classList.remove('open');
  }
});
