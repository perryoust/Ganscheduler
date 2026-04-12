function setSupExType(t){
  _supExType=t;
  document.getElementById('supex-type-act')?.classList.toggle('active',t==='act');
  document.getElementById('supex-type-inv')?.classList.toggle('active',t==='inv');
  const actOpts=document.getElementById('supex-act-opts');
  const invOpts=document.getElementById('supex-inv-opts');
  if(actOpts) actOpts.style.display=t==='act'?'':'none';
  if(invOpts) invOpts.style.display=t==='inv'?'block':'none';
}
function openSupExport(supName){
  _supExName=supName;
  _supExType='act';
  setSupExType('act');
  (document.getElementById('supexm-title')||{}).textContent=supName?`📊 יצוא: ${supName}`:'📊 יצוא דוח ספקים';
  const now=new Date();
  document.getElementById('supex-from').value=d2s(new Date(now.getFullYear(),now.getMonth(),1));
  document.getElementById('supex-to').value=d2s(new Date(now.getFullYear(),now.getMonth()+1,0));
  document.getElementById('supex-prev').style.display='none';
  document.getElementById('supexm').classList.add('open');
}
function doSupExport(){
  if(_supExType==='inv'){
    // ── יצוא חשבוניות/הזמנות ──
    if(typeof exportSupPurchDocs==='function' && _supExName){
      exportSupPurchDocs(supBase(_supExName));
    } else {
      showToast('אין מסמכי רכש לספק זה');
    }
    CM('supexm');
    return;
  }

  // ── יצוא פעילויות ──
  const from=document.getElementById('supex-from').value;
  const to=document.getElementById('supex-to').value;
  if(!from||!to){alert('בחר תאריכים');return;}

  const _supBase=_supExName?supBase(_supExName):'';
  const _supExData=_supBase?supEx[_supBase]||{}:{};
  const _supObj=_supExName?Object.values(SUPBASE||{}).find(s=>supBase(s.name)===_supBase)||null:null;
  const supPhone=_supExData.phone||(_supObj&&_supObj.phone)||(_supExName?SCH.find(s=>supBase(s.a)===_supBase&&s.p)?.p||'':'');

  const evs=SCH.filter(s=>{
    if(s.d<from||s.d>to) return false;
    if(_supExName&&supBase(s.a)!==supBase(_supExName)) return false;
    return true;
  }).sort((a,b)=>{
    const ga=G(a.g),gb=G(b.g);
    return (ga.city||'').localeCompare(gb.city||'','he')
      ||a.d.localeCompare(b.d)
      ||(a.t||'99:99').localeCompare(b.t||'99:99')
      ||(ga.name||'').localeCompare(gb.name||'','he');
  });
  if(!evs.length){alert('אין פעילויות בטווח זה');return;}

  const stMap={ok:'מתקיים',done:'התקיים',can:'בוטל ❌',post:'נדחה',nohap:'לא התקיים ⚠️'};
  const bom='\uFEFF';
  const q=c=>`"${String(c==null?'':c).replace(/"/g,'""')}"`;
  const lines=[];

  // grp=קבוצות: 1=התקיים בפועל, 0=לא התקיים (כולל ביטול/לא התקיים/נדחה)
  const isHappened = s => (s.grp||1) >= 1 && s.st!=='can' && s.st!=='nohap' && s.st!=='post';
  const isNotHappened = s => (s.grp||1) === 0 || s.st==='can' || s.st==='nohap';
  const isMakeup = s => !!s._makeupFrom;

  const sumRow=(label,evArr)=>{
    const tot    = evArr.length;
    const done   = evArr.filter(s=>isHappened(s)).length; // כולל השלמות שהתקיימו
    const makeup = evArr.filter(s=>isMakeup(s)&&isHappened(s)).length; // השלמות שהתקיימו בפועל
    const notHap = evArr.filter(s=>isNotHappened(s)).length;
    const can    = evArr.filter(s=>s.st==='can').length;
    return [q(label),q(tot),q('התקיימו:'),q(done),q('השלמות:'),q(makeup),q('בוטלו:'),q(can),q('לא התקיימו:'),q(notHap),''].join(',');
  };

  // Header
  if(_supExName){
    lines.push([q('ספק:'),q(_supExName),'','','','','','','','',''].join(','));
    lines.push([q('טלפון:'),q(supPhone),'','','','','','','','',''].join(','));
    lines.push([q('תקופה:'),q(fD(from)+' – '+fD(to)),'','','','','','','','',''].join(','));
    lines.push('');
  }

  lines.push(['עיר','כתובת','שם צהרון','תאריך','יום','פעילות','קבוצות','שעה','סטטוס','סיבה','הערות'].map(q).join(','));

  // Group by city, add per-city summary row
  const cities=[...new Set(evs.map(s=>G(s.g).city||'אחר'))].sort((a,b)=>a.localeCompare(b,'he'));
  cities.forEach(city=>{
    const cityEvs=evs.filter(s=>(G(s.g).city||'אחר')===city);
    cityEvs.forEach(s=>{
      const g=G(s.g);
      const actName=supAct(s.a)||s.a;
      lines.push([
        q(g.city||''),q(g.st||''),q(g.name||''),
        q(fD(s.d)),q(dayN(s.d)),
        q(actName),q(isHappened(s)?(s.grp||1):0),q(fT(s.t)),
        q(stMap[s.st]||'מתקיים'),q(s.cr||''),q(s.nt||'')
      ].join(','));
    });
    // City summary row
    lines.push(sumRow(`סה"כ ${city}:`, cityEvs));
    lines.push('');
  });

  // Grand total row
  lines.push(sumRow('סה"כ פעילויות:', evs));

  const csv=bom+lines.join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`דוח_פעילויות_${_supExName||'כל_הספקים'}_${from}_${to}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  CM('supexm');
}
function exportExcel(){
  const f=getCalF();
  const y=calD.getFullYear(),m=calD.getMonth();
  const from=d2s(new Date(y,m,1)),to=d2s(new Date(y,m+1,0));
  const rel=SCH.filter(s=>s.d>=from&&s.d<=to&&(!f.gids||f.gids.includes(s.g))).sort((a,b)=>a.d.localeCompare(b.d));
  downloadCSV(rel,`פעילויות_${hebM(calD)}`);
}
function exportExcelSched(){
  const rel=getFiltSched();
  downloadCSV(rel,'לוח_זמנים');
}
function downloadCSV(data,fname){
  const headers=['תאריך','יום','עיר','שם הצהרון','כתובת','ספק','שעה','קבוצות','סטטוס','סיבה','הערות','תאריך דחייה'];
  const rows=data.map(s=>{
    const g=G(s.g);
    const stMap={ok:'מתקיים',done:'התקיים',can:'בוטל',post:'נדחה',nohap:'לא התקיים'};
    return[fD(s.d),`יום ${dayN(s.d)}`,g.city||'',g.name||'',g.st||'',s.a,fT(s.t),s.grp>1?s.grp:'',stMap[s.st]||s.st,s.cr||'',s.nt||'',s.pd?fD(s.pd):''];
  });
  const bom='\uFEFF';
  const csv=bom+[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download=fname+'.csv';
  a.click();
}

function getAllSup(){
  if(typeof SUPBASE==='undefined'||typeof supEx==='undefined') return [];
  // mergedAway: exact supplier names that were merged INTO another (the sources)
  const mergedAway = new Set(supEx['__merged_away']||[]);
  const map={};

  // Add SUPBASE entries — skip only exact merged-away names
  SUPBASE.forEach(s=>{
    if(mergedAway.has(s.name)) return; // this entry was explicitly merged away
    const base=supBase(s.name);
    const act=supAct(s.name);
    if(!map[base]) map[base]={name:base,phone:s.phone,acts:new Set(),fullNames:new Set()};
    if(act) map[base].acts.add(act);
    map[base].fullNames.add(s.name);
    if(!map[base].phone&&s.phone) map[base].phone=s.phone;
  });

  // Add custom suppliers (__c) — skip exact merged-away names
  (supEx['__c']||[]).forEach(s=>{
    if(mergedAway.has(s.name)) return;
    const base=supBase(s.name);
    if(!map[base]) map[base]={name:base,phone:s.phone||'',acts:new Set(),fullNames:new Set()};
    map[base].fullNames.add(s.name);
    if(!map[base].phone&&s.phone) map[base].phone=s.phone;
  });

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
  SCH.forEach(s=>{ if(supBase(s.a)===base){const a=supAct(s.a);if(a)fromSch.add(a);} });
  // 2. From SUPBASE (current base)
  SUPBASE.forEach(s=>{ if(supBase(s.name)===base){const a=supAct(s.name);if(a)fromSch.add(a);} });
  // 3. From merged-from history (_mergedFrom stores old bases that were merged into this one)
  const mergedFromBases = ex._mergedFrom||[];
  mergedFromBases.forEach(oldBase=>{
    SCH.forEach(s=>{ if(supBase(s.a)===oldBase){const a=supAct(s.a);if(a)fromSch.add(a);} });
    SUPBASE.forEach(s=>{ if(supBase(s.name)===oldBase){const a=supAct(s.name);if(a)fromSch.add(a);} });
  });
  // 4. Fallback: check mergedAway — find SUPBASE entries whose base was merged into this supplier
  const mergedAway = supEx['__merged_away']||[];
  mergedAway.forEach(mName=>{
    const mBase=supBase(mName);
    if(SCH.some(s=>supBase(s.a)===base)){
      SUPBASE.forEach(s=>{ if(supBase(s.name)===mBase && mBase!==base){
        if(SCH.some(s2=>supBase(s2.a)===mBase)){
          const a=supAct(s.name); if(a) fromSch.add(a);
        }
      }});
    }
  });
  // 5. Merge with explicitly saved acts (manual additions not in SCH)
  if(Array.isArray(ex.acts)) ex.acts.forEach(a=>{ if(a) fromSch.add(a); });

  return [...fromSch].sort((a,b)=>a.localeCompare(b,'he'));
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
  if(!supEx) supEx={};
  if(!supEx['__c']) supEx['__c']=[];

  // mergedAway: suppliers intentionally hidden after merge — NEVER modify this list
  const mergedAway = new Set(supEx['__merged_away']||[]);
  const mergedFixed = 0;
  const inSupbase = new Set(SUPBASE.map(s=>supBase(s.name)));
  const inC = new Set(supEx['__c'].map(s=>supBase(s.name)));
  let added=0, fixed=0;

  // 1. Scan all schedule entries — ensure their base supplier is registered
  const schBases = new Set();
  SCH.forEach(s=>{ if(s.a) schBases.add(supBase(s.a)); });
  schBases.forEach(base=>{
    if(!base) return;
    // Skip if this base name itself is in mergedAway (it was a custom supplier that got merged)
    if(mergedAway.has(base)) return;
    if(inSupbase.has(base)) return;
    if(inC.has(base)) return;
    supEx['__c'].push({id:Date.now()+Math.random(),name:base,phone:supEx[base]?.ph1||''});
    if(!supEx[base]) supEx[base]={};
    if(supEx[base].isPurch===undefined) supEx[base].isPurch=true;
    inC.add(base);
    added++;
  });

  // 2. Scan INVOICES
  INVOICES.forEach(inv=>{
    const base=inv.supName?supBase(inv.supName):'';
    if(!base||mergedAway.has(base)||inSupbase.has(base)||inC.has(base)) return;
    supEx['__c'].push({id:Date.now()+Math.random(),name:base,phone:supEx[base]?.ph1||''});
    if(!supEx[base]) supEx[base]={};
    if(supEx[base].isPurch===undefined) supEx[base].isPurch=true;
    if(supEx[base].isAct===undefined) supEx[base].isAct=false;
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
  Object.keys(supEx).forEach(k=>{
    if(k==='__c'||k==='__merged_away'||k==='__gardens_extra') return;
    if(!Array.isArray(supEx[k]?.acts)) return;
    const base = supBase(k)||k;
    // Derive what SCH actually has for this supplier
    const schActs = new Set();
    SCH.forEach(s=>{ if(supBase(s.a)===base){const a=supAct(s.a);if(a)schActs.add(a);} });
    SUPBASE.forEach(s=>{ if(supBase(s.name)===base){const a=supAct(s.name);if(a)schActs.add(a);} });
    const savedActs = new Set(supEx[k].acts);
    // If SCH has acts that the saved array is missing → clear saved array so it auto-derives fully
    const missingFromSaved = [...schActs].filter(a=>!savedActs.has(a));
    if(missingFromSaved.length > 0 || supEx[k].acts.length === 0){
      delete supEx[k].acts; clearedActs++;
    }
  });

  if(added>0||clearedActs>0||mergedFixed>0) save();
  const msg=`🔧 ספקים: ${added} נוספו${mergedFixed?`, ${mergedFixed} mergedAway תוקנו`:''}${clearedActs?`, ${clearedActs} acts תוקנו`:''}`;
  console.log(msg);
  if(added>0||mergedFixed>0) showToast(`✅ ${msg}`);
  try{ renderPurchSuppliers(); }catch(e){}
  try{ renderSup(); }catch(e){}
}

function renderSup(){
  const srch=(document.getElementById('su-srch').value||'').toLowerCase();
  const sortMode=(document.getElementById('su-sort')||{value:'name'}).value;
  // p-sup (חוגים mode) always shows only act suppliers
  let all=getAllSup().filter(s=>{
    const base = s.name||'';
    if(srch && !base.toLowerCase().includes(srch)) return false;
    return isActSupplier(base); // Only activity suppliers in חוגים panel
  });
  // Always sort alphabetically first, then by count if selected
  all=[...all].sort((a,b)=>(a.name||'').localeCompare(b.name||'','he'));
  if(sortMode==='cnt') all=[...all].sort((a,b)=>supBaseCnt(b.name)-supBaseCnt(a.name));

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
      const ex=supBaseEx(base);
      const cnt=supBaseCnt(base);
      const acts=getSupActs(base);
      const phone=ex.ph1||s.phone||'';
      const bg=idx%2===0?'#fff':'#f8f9ff';
      h+=`<tr style="background:${bg};cursor:pointer" onclick="supOpen(${idx})">`
        +`<td style="padding:6px 12px;font-weight:700;color:#1a237e;border-bottom:1px solid #e8eaf6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:0">${base}`
        +`${isActSupplier(base)?' <span style="font-size:.65rem;color:#1565c0">🎨</span>':''}` 
        +`${isPurchSupplier(base)?' <span style="font-size:.65rem;color:#2e7d32">🛒</span>':''}` 
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
    setTimeout(_fitScrollAreas,50);
    return;
  }

  document.getElementById('su-body').className='sugrid scroll-area';
  _supCurrentList = all;
  let h='';
  all.forEach((s,idx)=>{
    const base=s.name; // already a base name from getAllBaseSups
    const ex=supBaseEx(base);
    const cnt=supBaseCnt(base);
    const acts=getSupActs(base);
    const phone=ex.ph1||s.phone||'';
    const cntDone=SCH.filter(sc=>supBase(sc.a)===base&&sc.st==='done').length;
    const cntCan=SCH.filter(sc=>supBase(sc.a)===base&&sc.st==='can').length;
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
          ${isActSupplier(base)?'<span class="sup-flag sup-flag-act" title="ספק חוגים פעיל">🎨</span>':'<span style="display:inline-block;padding:1px 5px;border-radius:10px;font-size:.64rem;background:#fce4ec;color:#c62828;font-weight:700" title="לא מוצג בחוגים">🚫 לא חוג</span>'}
          ${isPurchSupplier(base)?'':'<span style="display:inline-block;padding:1px 5px;border-radius:10px;font-size:.64rem;background:#fff3e0;color:#e65100;font-weight:700" title="לא ספק רכש">🚫 לא רכש</span>'}
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
  setTimeout(_fitScrollAreas,50);
}
function openSupModal(name){
  editingSup=name||null;
  (document.getElementById('sum-title')||{}).textContent =name?'✏️ עריכת ספק':'➕ הוסף ספק';
  const s=name?SUPBASE.find(x=>x.name===name)||{}:{};
  const ex=name?supEx[name]||{}:{};
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
  if(!supEx[name]) supEx[name]={};
  if(!Array.isArray(supEx[name].acts)) supEx[name].acts=getSupActs(name);
  if(!supEx[name].acts.includes(val)) supEx[name].acts.push(val);
  inp.value='';
  renderSupActsList(name);
}
function removeSupAct(idx){
  const name=document.getElementById('su-name').dataset.orig||document.getElementById('su-name').value;
  const acts=getSupActs(name);
  acts.splice(idx,1);
  if(!supEx[name]) supEx[name]={};
  supEx[name].acts=acts;
  renderSupActsList(name);
}
function deleteSup() {
  const name = document.getElementById('su-name').dataset.orig;
  if (!name) return;
  const schedCount = SCH.filter(s => s.a === name && s.st !== 'can').length;
  const msg = schedCount > 0
    ? `לספק "${name}" יש ${schedCount} פעילויות פעילות.\nמחיקה תסיר את הספק מהמערכת אך לא תמחק את הפעילויות.\n\nלהמשיך?`
    : `למחוק את הספק "${name}"?`;
  if (!confirm(msg)) return;

  // Remove from supEx
  delete supEx[name];

  // Remove from custom suppliers list
  if (supEx['__c']) {
    supEx['__c'] = supEx['__c'].filter(s => s.name !== name);
  }

  // Mark as deleted in merged-away (hides from SUPBASE-based suppliers)
  if (!supEx['__merged_away']) supEx['__merged_away'] = [];
  if (!supEx['__merged_away'].includes(name)) supEx['__merged_away'].push(name);

  save();
  CM('sum');
  refresh();
  if (typeof renderSup === 'function') renderSup();
  if (typeof renderPurchSuppliers === 'function') try { renderPurchSuppliers(); } catch(e) {}
  showToast('🗑️ ספק "' + name + '" נמחק');
}

function saveSup(){
  const nameEl=document.getElementById('su-name');
  const name=nameEl.value.trim();
  const origName=nameEl.dataset.orig;
  if(!name){alert('יש להזין שם');return;}
  if(origName&&origName!==name){
    if(!confirm(`לשנות את שם הספק מ-"${origName}" ל-"${name}"?
כל השיבוצים יעודכנו אוטומטית.`)) return;
    SCH.forEach(s=>{if(s.a===origName)s.a=name;});
    if(supEx[origName]) supEx[name]={...supEx[origName]};
    delete supEx[origName];
    if(supEx['__c']) supEx['__c']=supEx['__c'].map(s=>s.name===origName?{...s,name}:s);
  }
  const existActs=Array.isArray((supEx[name]||{}).acts)?(supEx[name].acts):getSupActs(name);
  supEx[name]={
    ...(supEx[name]||{}),
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
  if(!origName&&!SUPBASE.find(s=>s.name===name)){
    if(!supEx['__c']) supEx['__c']=[];
    if(!supEx['__c'].find(s=>s.name===name)) supEx['__c'].push({id:Date.now(),name,phone:supEx[name].ph1});
  }
  save();CM('sum');refresh();
  try{ renderPurchSuppliers(); }catch(e){}
  try{ renderSup(); }catch(e){}
  // If opened from invoice modal, pre-fill the supplier field
  if(window._invPendingNewSup && name){
    window._invPendingNewSup=false;
    // Reopen invoice modal with new supplier pre-filled
    setTimeout(()=>{
      const invModal = document.getElementById('invoice-m');
      if(invModal){
        // Fill supplier field
        const supTxt=document.getElementById('inv-sup-text');
        if(supTxt){ supTxt.value=name; invUpdateEntityType((supEx[name]||{}).entityType||''); }
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
    getAllSup().forEach(s=>el.innerHTML+=`<option value='${s.name}'>${s.name}</option>`);
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
    const cnt=SCH.filter(sc=>supBase(sc.a)===s.name||sc.a===s.name||sc.a.startsWith(s.name+' - ')).length;
    const invCnt=(typeof INVOICES!=='undefined')?INVOICES.filter(inv=>inv.supName===s.name||supBase(inv.supName||'')===s.name).length:0;
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
  const mergedAway = supEx['__merged_away']||[];
  const allSups = getAllSup();
  const lines = [];

  lines.push('=== AUDIT: ספקים ממוזגים ===');
  lines.push(`mergedAway רשימה (${mergedAway.length}): ${mergedAway.join(', ')||'ריק'}`);
  lines.push('');

  // For every supplier, show if they have _mergedFrom
  const suppliersWithMerge = allSups.filter(s=>{
    const ex = supEx[s.name]||supEx[supBase(s.name)]||{};
    return (ex._mergedFrom||[]).length>0;
  });

  lines.push(`=== ספקים עם _mergedFrom (${suppliersWithMerge.length}) ===`);
  suppliersWithMerge.forEach(s=>{
    const base = s.name;
    const ex = supEx[base]||{};
    const acts = getSupActs(base);
    const schCnt = SCH.filter(sc=>supBase(sc.a)===base).length;
    const invCnt = (typeof INVOICES!=='undefined'?INVOICES:[]).filter(i=>supBase(i.supName||'')===base).length;
    lines.push(`\n► ${base}`);
    lines.push(`  _mergedFrom: [${(ex._mergedFrom||[]).join(', ')}]`);
    lines.push(`  isAct: ${ex.isAct} | isPurch: ${ex.isPurch}`);
    lines.push(`  acts (${acts.length}): [${acts.join(', ')}]`);
    lines.push(`  SCH שיבוצים: ${schCnt} | חשבוניות: ${invCnt}`);
    lines.push(`  בלוח חוגים: ${isActSupplier(base)?'✅ כן':'❌ לא'} | בלוח רכש: ${isPurchSupplier(base)?'✅ כן':'❌ לא'}`);
  });

  lines.push('\n=== mergedAway — פירוט כל ספק שמוסתר ===');
  mergedAway.forEach(name=>{
    const base = supBase(name);
    const schOrphans = SCH.filter(s=>supBase(s.a)===base).length;
    const invOrphans = (typeof INVOICES!=='undefined'?INVOICES:[]).filter(i=>supBase(i.supName||'')===base).length;
    const status = (schOrphans||invOrphans)?'⚠️ יש רשומות יתומות!':'✅ נקי';
    lines.push(`  ${name} (base: ${base}) → ${status}${schOrphans?` SCH:${schOrphans}`:''}${invOrphans?` INV:${invOrphans}`:''}`);
  });

  lines.push('\n=== כל הספקים — סיכום ===');
  allSups.forEach(s=>{
    const base=s.name;
    const acts=getSupActs(base);
    const cnt=SCH.filter(sc=>supBase(sc.a)===base).length;
    lines.push(`${base}: isAct=${isActSupplier(base)} isPurch=${isPurchSupplier(base)} acts=[${acts.join(',')}] SCH=${cnt}`);
  });

  const report = lines.join('\n');
  console.log(report);
  // Also show a toast summary
  showToast(`🔍 Audit: ${suppliersWithMerge.length} ספקים ממוזגים, ${mergedAway.length} מוסתרים — ראה console`);
  return report;
}

function doMerge(){
  const mainIdx=document.getElementById('mrg-main').value;
  if(mainIdx===''){alert('בחר ספק ראשי');return;}
  const main=_mergeSupList[parseInt(mainIdx)]?.name;
  if(!main){alert('שגיאה: לא נמצא ספק ראשי');return;}
  const checkedIdxs=[...document.querySelectorAll('#mrg-list input[type=checkbox]:checked')].map(c=>parseInt(c.dataset.idx));
  const toMrg=checkedIdxs.map(i=>_mergeSupList[i]?.name).filter(n=>n && n!==main);
  if(!toMrg.length){alert('בחר לפחות ספק אחד למיזוג');return;}
  if(!confirm(`לאחד ${toMrg.length} ספקים אל "${main}"?`)) return;

  const mainBase = supBase(main);
  let changedSch=0, changedInv=0;
  const mergedAway = new Set(supEx['__merged_away']||[]);

  // Collect all acts from main AND all merged suppliers BEFORE changing anything
  const allActs = new Set(getSupActs(main));
  let mergedIsAct = isActSupplier(main);
  let mergedIsPurch = isPurchSupplier(main);

  toMrg.forEach(old=>{
    const oldBase = supBase(old);

    // Collect acts from this merged supplier
    getSupActs(old).forEach(a=>allActs.add(a));
    if(isActSupplier(old)) mergedIsAct = true;
    if(isPurchSupplier(old)) mergedIsPurch = true;

    // 1. Update SCH: preserve activity type in new name
    SCH.forEach(s=>{
      if(!s.a) return;
      const sBase = supBase(s.a);
      const sAct = supAct(s.a);
      if(sBase === oldBase){
        // Keep activity type: if main="חיים בתנועה" and sAct="ריקוד" → "חיים בתנועה - ריקוד"
        // If main has its own act suffix: just use mainBase
        s.a = sAct ? (mainBase + ' - ' + sAct) : mainBase;
        changedSch++;
      }
    });

    // 2. Update INVOICES
    if(typeof INVOICES!=='undefined') INVOICES.forEach(inv=>{
      if(supBase(inv.supName||'')===oldBase){
        inv.supName = main;
        changedInv++;
      }
    });

    // 3. Merge supEx metadata
    const ex = supEx[old] || supEx[oldBase] || {};
    if(!supEx[mainBase]) supEx[mainBase]={};
    const mex = supEx[mainBase];
    if(!mex.ph1 && ex.ph1) mex.ph1=ex.ph1;
    if(!mex.ph2 && ex.ph2) mex.ph2=ex.ph2;
    if(!mex.email && ex.email) mex.email=ex.email;
    if(!mex.contact && ex.contact) mex.contact=ex.contact;
    if(!mex.addr && ex.addr) mex.addr=ex.addr;
    if(!mex.g1 && ex.g1) mex.g1=ex.g1;
    if(!mex.moeTax && ex.moeTax) mex.moeTax=ex.moeTax;
    if(!mex.entityType && ex.entityType) mex.entityType=ex.entityType;
    if(!mex.notes && ex.notes) mex.notes=ex.notes;

    // 4. Remove old from __c and supEx
    delete supEx[old];
    if(old !== oldBase) delete supEx[oldBase];
    if(supEx['__c']) supEx['__c'] = supEx['__c'].filter(s=>supBase(s.name)!==oldBase);

    // 5. Mark as merged-away (exact names only)
    mergedAway.add(old);
    // Also add all SUPBASE entries for oldBase (except main itself)
    SUPBASE.forEach(s=>{
      if(supBase(s.name)===oldBase && s.name!==main) mergedAway.add(s.name);
    });
  });

  // Save merged flags and acts on main
  if(!supEx[mainBase]) supEx[mainBase]={};
  // Store which bases were merged in (for act lookups later)
  const prevMergedFrom = supEx[mainBase]._mergedFrom||[];
  const newMergedBases = toMrg.map(o=>supBase(o)).filter(b=>b!==mainBase);
  supEx[mainBase]._mergedFrom = [...new Set([...prevMergedFrom,...newMergedBases])];
  supEx[mainBase].isAct = mergedIsAct;
  supEx[mainBase].isPurch = mergedIsPurch;
  supEx[mainBase].acts = [...allActs].sort((a,b)=>a.localeCompare(b,'he'));
  // Also store on exact main name if different from base
  if(main !== mainBase){
    if(!supEx[main]) supEx[main]={};
    supEx[main].isAct = mergedIsAct;
    supEx[main].isPurch = mergedIsPurch;
    supEx[main].acts = supEx[mainBase].acts;
  }

  // Ensure main is in __c if not in SUPBASE
  const inSupbase = SUPBASE.some(s=>supBase(s.name)===mainBase);
  if(!inSupbase){
    if(!supEx['__c']) supEx['__c']=[];
    if(!supEx['__c'].find(s=>supBase(s.name)===mainBase)){
      supEx['__c'].push({id:Date.now(),name:mainBase,phone:supEx[mainBase]?.ph1||''});
    }
  }

  supEx['__merged_away'] = [...mergedAway];
  save(true);
  CM('mrgm');
  refresh();
  try{ renderPurchSuppliers(); }catch(e){}
  showToast(`✅ אוחדו ${toMrg.length} ספקים → "${main}"${changedSch?` · ${changedSch} שיבוצים`:''}${changedInv?` · ${changedInv} חשבוניות`:''}`);
}

let _GARDENS_EXTRA=[]; // user-added gardens stored in localStorage
