function renderGardens(){
  if(window.showInfoNotice) {
    window.showInfoNotice('gardens-info-wrap', '<b>ניהול צהרונים:</b> כאן ניתן לראות את כל הגנים, הזוגות והאשכולות. שינויים בזוגות ישפיעו על הסנכרון בלוח הבקרה ובשיבוץ.', 'info', '🏡');
  }
  if(_gardensTab==='fixed'){ renderGardensFixed(); return; }
  
  const gClsEl = window.getEl('g-cls');
  if(gClsEl && !gClsEl.value) gClsEl.value = _gardensTab === 'sch' ? 'ביה"ס' : 'גנים';
  
  const city = window.getEl('g-city')?.value || '';
  const cls = window.getEl('g-cls')?.value || '';
  const cl = window.getEl('g-cl')?.value || '';
  const srch = (window.getEl('g-srch')?.value || '').toLowerCase();
  const mgrF = window.getEl('g-mgr')?.value || '';
  
  const f=[...window.GARDENS,...(window._GARDENS_EXTRA||[])].filter(g=>{
    if(city&&g.city!==city) return false;
    if(cls&&window.gcls(g)!==cls) return false;
    if(cl){const clObj=window.getClusters().find(c=>c.name===cl);if(!clObj||(!(clObj.gardenIds||[]).includes(g.id))) return false;}
    if(mgrF){const m=window.managers[mgrF];if(!m||(!(m.gardenIds||[]).includes(g.id))) return false;}
    if(srch&&![(g.name||''),(g.city||''),(g.st||''),(g.co||'')].some(x=>x.toLowerCase().includes(srch))) return false;
    return true;
  }).sort((a,b)=>a.name.localeCompare(b.name,'he'));
  (document.getElementById('g-info')||{}).textContent =`${f.length} ${cls==='ביה"ס'?'בתי ספר':'צהרונים'}`;
  const byCity={};
  f.forEach(g=>{
    const c=g.city||'אחר';
    if(!byCity[c]) byCity[c]={gan:[],sch:[]};
    if(window.gcls(g)==='ביה"ס') byCity[c].sch.push(g);
    else byCity[c].gan.push(g);
  });

  let h='';
  Object.keys(byCity).sort().forEach(cityKey=>{
    h+=`<details class="city-accordion">
      <summary>
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <span style="font-weight:800; color:#2d3748;">🏙️ ${cityKey}</span>
          <span style="font-size:0.8rem; color:#718096;">לחץ לפירוט</span>
        </div>
      </summary>
      <div class="city-accordion-content">`;
    [{arr:byCity[cityKey].gan,lbl:'🏫 גני ילדים',cls:'gan'},{arr:byCity[cityKey].sch,lbl:'🏛️ בתי ספר',cls:'sch'}].forEach(sec=>{
      if(!sec.arr.length) return;
      h+=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;margin-top:${sec.cls==='sch'?'14px':'0'}"><div style="height:2px;flex:1;background:${sec.cls==='sch'?'#1565c0':'#2e7d32'};opacity:.25"></div><span class="dsh ${sec.cls}" style="font-size:.76rem;font-weight:800;padding:3px 12px;border-radius:10px">${sec.lbl} (${sec.arr.length})</span><div style="height:2px;flex:1;background:${sec.cls==='sch'?'#1565c0':'#2e7d32'};opacity:.25"></div></div>
        <div class="evgrid" style="margin-bottom:8px">`;
      sec.arr.forEach(g=>{
        const cnt=window.SCH.filter(s=>s.g===g.id).length;
        const pair=window.gardenPair(g.id);
        const mgr=window.getGardenMgr(g.id);
        const gd=window.getGardenData(g.id);
        h+=`<div class="gc" onclick="window.openGM(${g.id})">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div style="font-weight:800;color:var(--c-primary);margin-bottom:3px;flex:1;font-size:var(--fs-card-title)">${gd.name||g.name}</div>
            <button onclick="event.stopPropagation();openGardenEdit(${g.id})" style="background:none;border:none;cursor:pointer;font-size:var(--fs-small);color:#90a4ae;padding:0 2px" title="ערוך כרטיס גן">✏️</button>
          </div>
          ${(gd.st||g.st)?`<div style="font-size:var(--fs-body);color:var(--c-text-light)" onclick="event.stopPropagation()">📍 <a href="https://maps.google.com/?q=${encodeURIComponent((gd.st||g.st)+' '+g.city)}" target="_blank" style="color:var(--c-secondary);text-decoration:underline">${gd.st||g.st}</a></div>`:''}
          ${ gd.phone?`<div style="font-size:var(--fs-body);color:var(--c-success);font-weight:600">📞 ${gd.phone}</div>`:''}
          ${mgr?`<div style="font-size:var(--fs-small);color:var(--c-secondary);border-top:1px solid #e8eaf6;margin-top:4px;padding-top:3px">${mgr.role==='manager'?'🏛️':'👤'} ${mgr.name}${mgr.phone?' · 📞 '+mgr.phone:''}</div>`:''}
          ${window.gardenClusters(g.id).length?`<div style="font-size:var(--fs-small);color:#6a1b9a">🔢 ${window.gardenClusters(g.id).map(c=>c.name).join(', ')}</div>`:''}
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:5px">
            ${pair
              ?`<span style="font-size:var(--fs-small);color:var(--c-success);font-weight:700">🔗 ${pair.name}</span>`
              :`<button class="btn bg bsm" style="font-size:var(--fs-xs);padding:1px 6px" onclick="event.stopPropagation();quickAddPartner(${g.id})">➕ בן זוג</button>`
            }
            <span style="font-size:var(--fs-small);color:var(--c-secondary)">📅 ${cnt}</span>
          </div>
        </div>`;
      });
      h+='</div>';
    });
    h+='</div></details>';
  });
  document.getElementById('g-body').innerHTML=h||'<p style="color:#999">לא נמצאו צהרונים</p>';
  setTimeout(window._fitScrollAreas,50);
}

function openGmExport(){
  if(!window.gmGid)return;
  const gids=window.gardenPair(window.gmGid)?window.gardenPair(window.gmGid).ids:[window.gmGid];
  window._exGids=gids;
  let ws = new Date(window.gmD); ws.setHours(0,0,0,0);
  if(ws.getDay()===5) ws.setDate(ws.getDate()+2);
  else if(ws.getDay()===6) ws.setDate(ws.getDate()+1);
  const days = window.getNextWorkDays(ws, 5);
  const fDs=window.gmV==='day'?window.d2s(window.gmD):window.gmV==='week'?window.d2s(days[0]):window.d2s(new Date(window.gmD.getFullYear(),window.gmD.getMonth(),1));
  const tDs=window.gmV==='day'?window.d2s(window.gmD):window.gmV==='week'?window.d2s(days[4]):window.d2s(new Date(window.gmD.getFullYear(),window.gmD.getMonth()+1,0));

  document.getElementById('ex-d1').value=fDs;
  document.getElementById('ex-d2').value=tDs;
  (document.getElementById('ex-ctx')||{}).textContent=G(gmGid).name+' | '+fD(fDs)+(fDs!==tDs?' – '+fD(tDs):'');
  document.getElementById('exm').classList.add('open');
  setTimeout(()=>genExport(),80);
}
function openGM(gid){
  window.gmGid=gid;window.gmV='week';window.gmD=new Date();
  const g=window.GARDENS.find(x=>x.id===gid)||{};
  (document.getElementById('gm-title')||{}).textContent =`${g.city} · ${g.name}`;
  document.getElementById('gm-det').innerHTML=[g.st?`🏠 ${g.st}`:'',g.co?`👤 ${g.co}`:'',window.gardenClusters(gid).length?`🔢 ${window.gardenClusters(gid).map(c=>c.name).join(', ')}`:''].filter(Boolean).join(' | ');
  const pair=window.gardenPair(gid);
  document.getElementById('gm-pair-current').innerHTML=pair?`<span class="bdg bg2">🔗 כרגע: ${pair.name}</span>`:'<span style="color:#999">לא משויך לזוג</span>';
  document.getElementById('gm-del-pair-btn').style.display=pair?'inline-block':'none';
  const allOther=window.GARDENS.filter(x=>x.id!==gid).sort((a,b)=>a.name.localeCompare(b.name,'he'));
  ['gm-pg2','gm-pg3'].forEach((id,i)=>{
    const sel=document.getElementById(id);
    sel.innerHTML='<option value="">—</option>';
    allOther.forEach(x=>sel.innerHTML+=`<option value="${x.id}">${x.city} · ${x.name}</option>`);
    if(pair&&pair.ids[i+1]) sel.value=pair.ids[i+1];
  });
  renderGM();
  document.getElementById('gm').classList.add('open');
}
function delPairFromGarden(){
  const pair=window.gardenPair(window.gmGid);
  if(!pair) return;
  if(!confirm(`למחוק את הזוג "${pair.name}"?`)) return;
  const idx=window.pairs.findIndex(p=>p.id===pair.id);
  if(idx>=0) window.pairs.splice(idx,1);
  window.save(); window.refresh();
  openGM(window.gmGid);
}
function setGmView(v){
  window.gmV=v;
  ['day','week','month','recur'].forEach(x=>{
    const el = document.getElementById('gvb-'+x);
    if(el) el.classList.toggle('active',x===v);
  });
  renderGM();
}
function gmNav(d){
  if(window.gmV==='day') window.gmD=window.addD(window.gmD,d);
  else if(window.gmV==='week') window.gmD=window.addD(window.gmD,d);

  else window.gmD=window.addM(window.gmD,d);
  renderGM();
}
function renderGmCal(){ renderGM(); }

function renderGM(){
  const gid=window.gmGid;let from,to,title;
  
  if(window.gmV === 'recur') {
    document.getElementById('gm-cal').style.display = 'none';
    const recurEl = document.getElementById('gm-recur');
    if(recurEl) {
      recurEl.style.display = 'block';
      if(typeof renderGmRecurring === 'function') renderGmRecurring(gid, recurEl);
    }
    ['gm-nav-prev', 'gm-per', 'gm-nav-next', 'gm-nav-ns', 'gm-nav-ex'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.style.visibility = 'hidden';
    });
    return;
  }
  
  document.getElementById('gm-cal').style.display = 'block';
  const recurEl = document.getElementById('gm-recur');
  if(recurEl) recurEl.style.display = 'none';
  ['gm-nav-prev', 'gm-per', 'gm-nav-next', 'gm-nav-ns', 'gm-nav-ex'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.style.visibility = 'visible';
  });
  if(window.gmV==='day'){from=to=window.d2s(window.gmD);title=`${window.fD(from)} - יום ${window.dayN(from)}`;}
  else if(window.gmV==='week'){
    let ws = new Date(window.gmD); ws.setHours(0,0,0,0);
    if(ws.getDay()===5) ws.setDate(ws.getDate()+2);
    else if(ws.getDay()===6) ws.setDate(ws.getDate()+1);
    const days = window.getNextWorkDays(ws, 5);
    from = window.d2s(days[0]); to = window.d2s(days[4]);
    title=`${window.fD(from)} – ${window.fD(to)} (5 ימי עבודה)`;
  }

  else{const y=window.gmD.getFullYear(),m=window.gmD.getMonth();from=window.d2s(new Date(y,m,1));to=window.d2s(new Date(y,m+1,0));title=window.hebM(window.gmD);}
  (document.getElementById('gm-per')||{}).textContent =title;
  const evs=window.SCH.filter(s=>s.g===gid&&s.d>=from&&s.d<=to).sort((a,b)=>a.d.localeCompare(b.d)||(a.t||'').localeCompare(b.t||''));
  if(!evs.length){document.getElementById('gm-cal').innerHTML='<p style="color:#999;text-align:center;padding:18px">אין פעילויות</p>';return;}
  if(window.gmV==='month'){document.getElementById('gm-cal').innerHTML=window.renderMonth(evs,window.gmD);return;}
  let h='<div class="tw"><table><thead><tr><th>תאריך</th><th>יום</th><th>שעה</th><th>ספק</th><th>הערות</th><th>סטטוס</th></tr></thead><tbody>';
  evs.forEach(s=>{
    const g=window.G(s.g);
    const gblk=window.getGardenBlock(s.g,s.d);
    const isM = !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה/i.test(s.nt)));
    let tagText = '';
    if (s.st === 'can' || (s.nt && /ביטול|בוטל/i.test(s.nt))) tagText = 'ביטול';
    else if (s.nt && /הקדמה|הוקדם/i.test(s.nt)) tagText = 'הקדמה';
    else if (s.nt && /דחי?יה|נדחה/i.test(s.nt)) tagText = 'דחיה';
    else if (isM || (s.nt && /השלמה/i.test(s.nt))) tagText = 'השלמה';
    const tagHtml = tagText ? `<b style="color:var(--c-warning)">[${tagText}]</b> ` : '';
    const ntStr = gblk ? `<span style="color:#c62828;font-size:.72rem">${gblk.icon||'🚫'} ${gblk.reason}</span>${s.nt?' | '+tagHtml+s.nt:''}` : (s.nt ? tagHtml+s.nt : '');
    const waBtn = `<button class="btn bsm" style="background:#25d366;color:#fff;border:none;padding:2px 6px;font-size:.7rem;cursor:pointer;margin-right:8px;display:inline-flex;align-items:center;height:20px;vertical-align:middle;border-radius:4px" onclick="event.stopPropagation(); window.exportSingleRecurringWA('${s.id}')">📋 הודעה</button>`;
    h+=`<tr onclick="window.openSP('${s.id}')" class="${window.stClass(s)}"><td>${window.fD(s.d)}</td><td>יום ${window.dayN(s.d)}</td><td>${window.fT(s.t)}</td><td>${s.a}</td><td>${ntStr}</td><td style="white-space:nowrap">${window.stLabel(s)}${s.st==='ok'?waBtn:''}</td></tr>`;  });
  document.getElementById('gm-cal').innerHTML=h+'</tbody></table></div>';
}
function quickAddPartner(gid){
  const idx=window.pairs.findIndex(p=>p.ids.includes(gid));
  if(idx>=0){ window.openAddPair(idx); return; }
  window.editPairIdx=null;
  const g=window.G(gid);
  (document.getElementById('apm-title')||{}).textContent ='➕ הוסף זוג — '+g.name;
  document.getElementById('apm-name').value='';
  document.getElementById('apm-city').value=g.city||'';
  document.getElementById('apm-warn').style.display='none';
  const gs=gByCF(g.city,'').sort((a,b)=>a.name.localeCompare(b.name,'he'));
  ['apm-g1','apm-g2','apm-g3'].forEach((id,i)=>{
    const sel=document.getElementById(id);
    sel.innerHTML=i===2?'<option value="">—</option>':'<option value="">בחר גן</option>';
    gs.forEach(x=>sel.innerHTML+=`<option value='${x.id}'>${x.name}</option>`);
    if(i===0) sel.value=gid;
  });
  document.getElementById('apm').classList.add('open');
}
let _pqmId=null,_pqmDs=null;

function openPairQuickEdit(pairId,ds){
  _pqmId=pairId;
  _pqmDs=ds;
  const pair=window.pairs.find(p=>String(p.id)===String(pairId));
  if(!pair) return;
  const gs=pair.ids.map(id=>window.G(id)).filter(x=>x.id);
  const broken=window.isPairBroken(pairId,ds);
  (document.getElementById('pqm-title')||{}).textContent =`🔗 ${pair.name}`;
  document.getElementById('pqm-info').innerHTML=`
    <div style="font-weight:700;color:#1a237e;margin-bottom:5px">${pair.name}</div>
    <div style="color:#546e7a">גנים: ${gs.map(g=>g.name).join(' + ')}</div>
    <div style="color:#546e7a">תאריך: ${fD(ds)}</div>
    ${broken?'<div style="margin-top:5px"><span class="bdg bor">⚡ הזוג פורק להיום</span></div>':''}
  `;
  document.getElementById('pqm-break-btn').style.display=broken?'none':'block';
  document.getElementById('pqm-restore-btn').style.display=broken?'block':'none';
  document.getElementById('pqm').classList.add('open');
}

function pqmEdit(){
  window.CM('pqm');
  const idx=window.pairs.findIndex(p=>String(p.id)===String(_pqmId));
  if(idx>=0) window.openAddPair(idx);
}

function pqmBreakToday(){
  const pair=window.pairs.find(p=>String(p.id)===String(_pqmId));
  if(!pair) return;
  if(!confirm(`לפרק את הזוג "${pair.name}" רק להיום (${window.fD(_pqmDs)})?
הצהרונים יוצגו בנפרד ביום זה בלבד.`)) return;
  window.setPairBreak(_pqmId,_pqmDs,true);
  window.CM('pqm');
}

function pqmRestoreToday(){
  const pair=window.pairs.find(p=>String(p.id)===String(_pqmId));
  if(!pair) return;
  window.setPairBreak(_pqmId,_pqmDs,false);
  window.CM('pqm');
}

function pqmBreakPermanent(){
  const pair=window.pairs.find(p=>String(p.id)===String(_pqmId));
  if(!pair) return;
  if(!confirm(`למחוק לצמיתות את הזוג "${pair.name}"?
הצהרונים יוצגו בנפרד בכל הלוח. פעולה זו אינה ניתנת לביטול.`)) return;
  const idx=window.pairs.findIndex(p=>String(p.id)===String(_pqmId));
  if(idx>=0) window.pairs.splice(idx,1);
  Object.keys(window.pairBreaks).forEach(k=>{if(k.startsWith(_pqmId+'_')) delete window.pairBreaks[k];});
  window.save(); window.CM('pqm'); window.refresh();
}

function renderPairs(){
  const cityFilt = window.getEl('pairs-city')?.value || '';
  const f=window.pairs.filter(p=>{
    if(!cityFilt) return true;
    return p.ids.some(id=>window.G(id).city===cityFilt);
  });
  const el=document.getElementById('pairs-count');
  if(el) el.textContent='('+f.length+')';

  // ── Sidebar: gardens with no pair ───────────────────────
  const pairedGids=new Set(window.pairs.flatMap(p=>p.ids));
  const soloGardens=window.GARDENS.filter(g=>!pairedGids.has(g.id)&&window.gcls(g)==='גנים')
    .sort((a,b)=>a.city.localeCompare(b.city,'he')||a.name.localeCompare(b.name,'he'));
  const bySoloCity={};
  soloGardens.forEach(g=>{if(!bySoloCity[g.city])bySoloCity[g.city]=[];bySoloCity[g.city].push(g);});
  let sideHtml='';
  if(soloGardens.length){
    sideHtml+=`<div style="background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:10px;margin-bottom:10px">
      <div style="font-size:.76rem;font-weight:800;color:#f57f17;margin-bottom:8px">⚠️ צהרונים ללא זוג (${soloGardens.length})</div>`;
    Object.keys(bySoloCity).sort().forEach(city=>{
      sideHtml+=`<div style="margin-bottom:7px">
        <div style="font-size:.69rem;font-weight:700;color:#78909c;margin-bottom:4px">🏙️ ${city}</div>`;
      bySoloCity[city].forEach(g=>{
        sideHtml+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #fff3cd;font-size:.74rem">
          <span>🏫 ${g.name}</span>
          <button class="btn bp bsm" style="font-size:.62rem;padding:1px 6px" onclick="quickAddPartner(${g.id})">➕</button>
        </div>`;
      });
      sideHtml+='</div>';
    });
    sideHtml+='</div>';
  } else {
    sideHtml='<div style="font-size:.75rem;color:#2e7d32;background:#e8f5e9;border-radius:7px;padding:8px 10px">✅ כל הצהרונים משובצים בזוג</div>';
  }
  document.getElementById('pairs-solo').innerHTML=sideHtml;

  // ── Main: pairs list grouped by city ────────────────────
  if(!f.length){
    document.getElementById('pairs-main').innerHTML='<p style="color:#999">לא נמצאו זוגות</p>';
    return;
  }
  const byCity={};
  f.forEach(p=>{
    const city=window.G(p.ids[0]).city||'אחר';
    if(!byCity[city]) byCity[city]=[];
    byCity[city].push(p);
  });

  let h='';
  Object.keys(byCity).sort().forEach(city=>{
    h+=`<details class="city-accordion">
      <summary>
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <span style="font-weight:800; color:#2d3748;">🏙️ ${city} (${byCity[city].length} זוגות/שלישיות)</span>
          <span style="font-size:0.8rem; color:#718096;">לחץ לפירוט</span>
        </div>
      </summary>
      <div class="city-accordion-content">`;
    const clr = window.CITY_COLORS(city);
    byCity[city].forEach(p=>{
      const idx=window.pairs.indexOf(p);
      const gs=p.ids.map(id=>window.G(id)).filter(x=>x.id);
      // Always 3 columns — empty cell if only 2 gardens
      h+=`<div class="pair-row" style="border-right:3px solid ${clr.solid};margin-bottom:10px">
        <div class="pair-row-label" style="background:${clr.solid};display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:800;font-size:.8rem">${p.name||gs.map(g=>g.name).join(' + ')}</span>
          <div style="display:flex;gap:4px">
            <button class="btn bsm" style="background:rgba(255,255,255,.3);border:none;color:#fff;font-size:.7rem;padding:3px 9px;border-radius:4px;cursor:pointer;font-weight:700" onclick="_exportPairWA(${JSON.stringify(p.ids)})">📋 הודעה</button>
            <button class="btn bsm" style="background:rgba(255,255,255,.22);border:none;color:#fff;font-size:.68rem;padding:2px 7px;border-radius:4px;cursor:pointer" onclick="openAddPair(${idx})">✏️ ערוך</button>
            <button class="btn bsm" style="background:rgba(255,255,255,.28);border:none;color:#fff;font-size:.68rem;padding:2px 7px;border-radius:4px;cursor:pointer" onclick="_goToPairSched(${idx})">📋 שיבוץ</button>
            <button class="btn bsm" style="background:rgba(255,255,255,.15);border:none;color:#fff;font-size:.68rem;padding:2px 7px;border-radius:4px;cursor:pointer" onclick="delPair(${idx})">🗑️</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:#e8eaf6">`;
      gs.forEach(g=>{
        const cnt=window.SCH.filter(s=>s.g===g.id&&s.st!=='can').length;
        const last=window.SCH.filter(s=>s.g===g.id&&s.st!=='can').sort((a,b)=>b.d.localeCompare(a.d))[0];
        const mgr=window.getGardenMgr(g.id);
        h+=`<div style="background:#fff;padding:9px 11px">
          <div style="font-weight:800;color:#1a237e;font-size:.82rem;margin-bottom:3px">${window.gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</div>
          ${g.st?`<div style="font-size:.69rem;color:#78909c;margin-bottom:2px">📍 ${g.st}</div>`:''}
          ${mgr?`<div style="font-size:.68rem;color:#1565c0">${mgr.role==='manager'?'🏛️':'👤'} ${mgr.name}</div>`:''}
          <div style="font-size:.68rem;color:#78909c;margin-top:3px">📅 ${cnt} פעילויות${last?' | '+window.fD(last.d):''}</div>
        </div>`;
      });
      // Always 3 cols — add empty left cell for pairs (not triples)
      if(gs.length<3) h+=`<div style="background:#fafafa;border-right:1px solid #e8eaf6;display:flex;align-items:center;justify-content:center"><span style="color:#d0d0d0;font-size:.8rem">—</span></div>`;
      h+='</div></div>';
    });
    h+='</div></details>';
  });
  document.getElementById('pairs-main').innerHTML=h;
}


function _goToPairSched(idx){
  const p=window.pairs[idx];
  if(!p||!p.ids||!p.ids[0]) return;
  // Open new-schedule modal with first garden of pair pre-selected
  window.openNewSched(p.ids[0]);
}

function exportPairNow(idx){_exGids=pairs[idx].ids;openExport();}
function delPair(idx){
  const pair=window.pairs[idx];
  if(!pair) return;
  if(!confirm('למחוק את הזוג "'+pair.name+'"?\nהפעילויות ישארו אך הצהרונים לא יהיו מקושרים יותר.')) return;
  window.pairs.splice(idx,1);
  window.save();window.refresh();
  alert('✅ הזוג נמחק');
}
function openAddPair(idx){
  window.editPairIdx=idx;
  const pair=idx!==null&&idx!==undefined?window.pairs[idx]:null;
  (document.getElementById('apm-title')||{}).textContent =pair?'✏️ עריכת זוג':'➕ הוסף זוג/שלישיה';
  document.getElementById('apm-name').value=pair?pair.name:'';
  document.getElementById('apm-city').value='';
  document.getElementById('apm-warn').style.display='none';
  ['apm-g1','apm-g2','apm-g3'].forEach((id,i)=>{
    const sel=document.getElementById(id);
    sel.innerHTML=i===2?'<option value="">—</option>':'<option value="">בחר גן</option>';
    window.GARDENS.sort((a,b)=>a.name.localeCompare(b.name,'he')).forEach(g=>sel.innerHTML+=`<option value="${g.id}">${g.city} · ${g.name}</option>`);
    if(pair&&pair.ids[i]) sel.value=pair.ids[i];
  });
  document.getElementById('apm').classList.add('open');
}
function apmCity(){
  const city=document.getElementById('apm-city').value;
  const gs=window.gByCF(city,'').sort((a,b)=>a.name.localeCompare(b.name,'he'));
  ['apm-g1','apm-g2','apm-g3'].forEach((id,i)=>{
    const sel=document.getElementById(id);
    const cur=sel.value;
    sel.innerHTML=i===2?'<option value="">—</option>':'<option value="">בחר גן</option>';
    gs.forEach(g=>sel.innerHTML+=`<option value='${g.id}'>${city?g.name:g.city+' · '+g.name}</option>`);
    if(cur) sel.value=cur;
  });
}
function savePairModal(){
  const g1=parseInt(document.getElementById('apm-g1').value)||null;
  const g2=parseInt(document.getElementById('apm-g2').value)||null;
  const g3=parseInt(document.getElementById('apm-g3').value)||null;
  if(!g1){alert('יש לבחור לפחות צהרון אחד');return;}
  const ids=[g1,g2,g3].filter(Boolean);
  const warnEl=document.getElementById('apm-warn');
  const dupe=ids.map(gid=>{
    const p=window.gardenPair(gid);
    const isCurrentPair=window.editPairIdx!==null&&p&&p.id===window.pairs[window.editPairIdx]?.id;
    return p&&!isCurrentPair?`${window.G(gid).name} כבר בזוג "${p.name}"`:null;
  }).filter(Boolean);
  if(dupe.length){
    warnEl.style.display='block';
    warnEl.textContent='⚠️ '+dupe.join(' | ');
    if(!confirm('צהרונים כבר בזוגות אחרים. בכל זאת להמשיך?')) return;
  }
  const nm=document.getElementById('apm-name').value||ids.map(id=>window.G(id).name||'').join(' + ');
  const isEdit=window.editPairIdx!==null&&window.editPairIdx!==undefined;
  let targetPairId;
  if(isEdit){
    targetPairId = window.pairs[window.editPairIdx].id;
    window.pairs[window.editPairIdx]={...window.pairs[window.editPairIdx],ids,name:nm};
  } else {
    targetPairId = Date.now();
    window.pairs.push({id:targetPairId,ids,name:nm});
  }
  // Cleanup duplicates from other pairs
  window.pairs = window.pairs.map(p => {
    if (p.id === targetPairId) return p;
    return { ...p, ids: p.ids.filter(id => !ids.map(Number).includes(Number(id))) };
  }).filter(p => p.ids.length >= 2);
  window.save();window.CM('apm');window.refresh();
  if(window.currentTab==='managers') window.renderManagers();
  alert('✅ '+(isEdit?'הזוג עודכן':'הזוג נשמר')+': '+nm);
}

const HOL_TYPES={
  vacation:{label:'חופשה',emoji:'🟡',bg:'#fffde7',color:'#f57f17',border:'#f9a825'},
  camp:    {label:'קייטנה',emoji:'🟣',bg:'#f3e5f5',color:'#6a1b9a',border:'#ce93d8'},
  event:   {label:'אירוע',emoji:'🟢',bg:'#e8f5e9',color:'#2e7d32',border:'#a5d6a7'},
  noact:   {label:'אין פעילות',emoji:'🔴',bg:'#ffebee',color:'#c62828',border:'#ef9a9a'}
};
function getHolidayInfo(ds,city,scope){
  const h=holidays.find(h=>{
    if(h.from>ds||h.to<ds) return false;
    if(h.city&&city&&h.city!==city) return false;
    if(h.scope&&h.scope!=='all'&&scope&&h.scope!==scope) return false;
    return true;
  });
  if(!h) return null;
  const t=HOL_TYPES[h.type]||HOL_TYPES.vacation;
  return{...t,name:h.name,note:h.note,id:h.id,canSched:h.canSched||false};
}

function initHolDrops(){
  const filtCity=document.getElementById('hol-filt-city');
  filtCity.innerHTML='<option value="">כל הערים</option>';
  cities().forEach(c=>filtCity.innerHTML+=`<option value='${c}'>${c}</option>`);
  const wrap=document.getElementById('hol-city-checks');
  if(wrap) wrap.innerHTML=cities().map(c=>`<label style="display:flex;gap:5px;align-items:center;padding:2px 4px;cursor:pointer"><input type="checkbox" class="hol-city-cb" value='${c}'> ${c}</label>`).join('');
}
function holToggleAll(cb){document.querySelectorAll('.hol-city-cb').forEach(x=>x.checked=cb.checked);}
function getHolCities(){
  const allCb=document.getElementById('hol-city-all');
  if(allCb&&allCb.checked) return '';
  return [...document.querySelectorAll('.hol-city-cb:checked')].map(x=>x.value);
}

function renderHolidays(){
  const fc=document.getElementById('hol-filt-city').value;
  const ft=document.getElementById('hol-filt-type').value;
  const list=holidays
    .filter(h=>(!fc||(h.city===fc||!h.city))&&(!ft||h.type===ft))
    .sort((a,b)=>a.from.localeCompare(b.from));
  let h='';
  if(!list.length){document.getElementById('holidays-body').innerHTML='<p style="color:#999">אין חופשות מוגדרות. לחץ "הוסף".</p>';return;}
  h='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:11px">';
  list.forEach(hol=>{
    const t=HOL_TYPES[hol.type]||HOL_TYPES.vacation;
    const single=hol.from===hol.to;
    const dateStr=single?fD(hol.from):`${fD(hol.from)} – ${fD(hol.to)}`;
    h+=`<div style="background:#fff;border-radius:10px;padding:12px;box-shadow:0 2px 8px rgba(0,0,0,.06);border-right:4px solid ${t.border}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <span style="font-size:.72rem;font-weight:700;padding:2px 7px;border-radius:20px;background:${t.bg};color:${t.color}">${t.emoji} ${t.label}</span>
          <div style="font-weight:700;color:#1a237e;font-size:.88rem;margin-top:4px">${hol.name}</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn bo bsm" onclick="openAddHoliday('${hol.id}')">✏️</button>
          <button class="btn br bsm" onclick="deleteHoliday('${hol.id}')">🗑️</button>
        </div>
      </div>
      <div style="font-size:.8rem;color:#546e7a">📅 ${dateStr}</div>
      <div style="font-size:.78rem;color:#546e7a;margin-top:3px">
        🏙️ ${hol.city||'כל הערים'} &nbsp;|&nbsp; ${hol.scope==='all'||!hol.scope?'גנים ובתי ספר':hol.scope}
      </div>
      ${hol.note?`<div style="font-size:.74rem;color:#78909c;margin-top:3px">📝 ${hol.note}</div>`:''}
      ${hol.canSched?`<div style="font-size:.73rem;color:#2e7d32;background:#e8f5e9;border-radius:5px;padding:2px 7px;margin-top:4px;display:inline-block">✅ ניתן לשבץ</div>`:''}
    </div>`;
  });
  document.getElementById('holidays-body').innerHTML=h+'</div>';
}

let _editHolId=null;
function openAddHoliday(id){
  _editHolId=id;
  const hol=id?holidays.find(h=>h.id===id):null;
  (document.getElementById('holm-title')||{}).textContent =hol?'✏️ עריכת חופשה':'➕ הוסף חופשה/אירוע';
  document.getElementById('hol-name').value=hol?hol.name:'';
  document.getElementById('hol-from').value=hol?hol.from:d2s(calD);
  document.getElementById('hol-to').value=hol?hol.to:d2s(calD);
  document.getElementById('hol-type').value=hol?hol.type:'vacation';
  const allCb=document.getElementById('hol-city-all');
  const cbs=document.querySelectorAll('.hol-city-cb');
  if(hol&&hol.city){
    if(allCb) allCb.checked=false;
    cbs.forEach(cb=>cb.checked=cb.value===hol.city);
  } else {
    if(allCb) allCb.checked=true;
    cbs.forEach(cb=>cb.checked=false);
  }
  document.getElementById('hol-scope').value=hol?hol.scope||'all':'all';
  document.getElementById('hol-note').value=hol?hol.note||'':'';
  const canSchedCb=document.getElementById('hol-can-sched');
  if(canSchedCb) canSchedCb.checked=hol?hol.canSched||false:false;
  document.getElementById('holm').classList.add('open');
}
function saveHoliday(){
  const name=document.getElementById('hol-name').value.trim();
  const from=document.getElementById('hol-from').value;
  const to=document.getElementById('hol-to').value;
  if(!name||!from||!to){alert('יש למלא שם ותאריכים');return;}
  if(from>to){alert('תאריך התחלה חייב להיות לפני סיום');return;}
  const selCities=getHolCities();
  const cityList=Array.isArray(selCities)&&selCities.length?selCities:[''];
  const baseId=_editHolId||('h_'+Date.now());
  if(_editHolId) holidays=holidays.filter(h=>h.id!==_editHolId&&!h.id.startsWith(_editHolId+'_'));
  const canSched=document.getElementById('hol-can-sched')?.checked||false;
  const holType=document.getElementById('hol-type').value;
  cityList.forEach((city,idx)=>{
    const hol={
      id:cityList.length>1?baseId+'_'+idx:baseId,
      name,from,to,
      type:holType,
      city:city,
      scope:document.getElementById('hol-scope').value,
      note:document.getElementById('hol-note').value.trim(),
      canSched:canSched
    };
    holidays.push(hol);
  });
  // Retroactive: if holiday blocks scheduling, cancel matching fixed-schedule events
  if(!canSched&&(holType==='vacation'||holType==='noact'||holType==='camp'||holType==='event')){
    const scope=document.getElementById('hol-scope').value;
    let removed=0;
    SCH.forEach(ev=>{
      if(ev.d<from||ev.d>to) return;
      if(!ev._recId) return; // only fixed/recurring
      if(ev.st==='can') return;
      const g=G(ev.g);
      if(!g||!g.id) return;
      if(cityList.length&&cityList[0]!==''&&!cityList.includes(g.city)) return;
      if(scope==='גנים'&&gcls(g)!=='גנים') return;
      if(scope==='ביה"ס'&&gcls(g)!=='ביה"ס') return;
      ev.st='can';ev.cr='חופשה: '+name;
      removed++;
    });
    if(removed>0) showToast(`⚠️ בוטלו ${removed} פעילויות קבועות בגלל החופשה`);
  }
  save();CM('holm');refresh();
  showToast(`✅ חופשה "${name}" נשמרה (${fD(from)} – ${fD(to)})`);
}
function deleteHoliday(id){
  if(!confirm('למחוק?')) return;
  holidays=holidays.filter(h=>h.id!==id);
  save(); refresh();
}
function getClusters(){return Object.values(clusters||{}).sort((a,b)=>a.name.localeCompare(b.name,'he'));}
function gardenClusters(gid){return getClusters().filter(cl=>(cl.gardenIds||[]).includes(gid));}
const PAIR_COLORS=['#1565c0','#2e7d32','#6a1b9a','#00695c','#c62828','#e65100','#37474f','#4527a0'];
function pairColorIdx(pairId){
  const idx=pairs.findIndex(p=>p.id===pairId);
  return idx>=0?idx%8:0;
}
function pairClrClass(pairId){return 'pc'+pairColorIdx(pairId);}
function pairWeekColors(pairId){
  const c=['#1565c0','#2e7d32','#6a1b9a','#00695c','#c62828','#e65100','#37474f','#4527a0'];
  const bg=['#e3f2fd','#e8f5e9','#f3e5f5','#e0f2f1','#ffebee','#fff3e0','#eceff1','#ede7f6'];
  const i=pairColorIdx(pairId);
  return{solid:c[i],light:bg[i]};
}
function refreshClusterDrops(){
  ['cal-cl','g-cl'].forEach(id=>{
    ['desktop', 'mobile'].forEach(plat => {
      const el = document.getElementById(id + '-' + plat);
      if(!el) return;
      el.innerHTML='<option value="">הכל</option><option value="__all__">🔢 כל האשכולות</option>';
      getClusters().forEach(cl=>el.innerHTML+=`<option value='${cl.name}'>${cl.name}</option>`);
    });
  });
  const pairEl=document.getElementById('cal-pair');
  if(!pairEl) return;
  pairEl.innerHTML='<option value="">בחר זוג מוגדר...</option>';
  const byCity={};
  pairs.forEach((p,idx)=>{
    const city=G(p.ids[0]).city||'אחר';
    if(!byCity[city]) byCity[city]=[];
    byCity[city].push({p,idx});
  });
  Object.keys(byCity).sort().forEach(city=>{
    const gan=byCity[city].filter(({p})=>gcls(G(p.ids[0]))==='גנים');
    const sch=byCity[city].filter(({p})=>gcls(G(p.ids[0]))==='ביה"ס');
    if(gan.length){
      const og=document.createElement('optgroup');
      og.label=`🏙️ ${city} — צהרונים`;
      gan.forEach(({p})=>og.innerHTML+=`<option value='${p.id}'>${p.name}</option>`);
      pairEl.appendChild(og);
    }
    if(sch.length){
      const os=document.createElement('optgroup');
      os.label=`🏙️ ${city} — בתי ספר`;
      sch.forEach(({p})=>os.innerHTML+=`<option value='${p.id}'>${p.name}</option>`);
      pairEl.appendChild(os);
    }
  });
}
function calSelectPair(){
  const pairId=parseInt(document.getElementById('cal-pair').value)||null;
  const g1 = window.getEl('cal-g1');
  const g2 = window.getEl('cal-g2');
  const g3 = window.getEl('cal-g3');
  if(!pairId){
    if(g1) g1.value='';
    if(g2) g2.value='';
    if(g3) g3.value='';
    renderCal();
    return;
  }
  const pair=pairs.find(p=>p.id===pairId);
  if(!pair) return;
  if(g1) g1.value=pair.ids[0]||'';
  if(g2) g2.value=pair.ids[1]||'';
  if(g3) g3.value=pair.ids[2]||'';
  renderCal();
}

let _clustersView='grid';
function setClustersView(v){
  _clustersView=v;
  document.getElementById('cl-view-grid').className=v==='grid'?'btn bp bsm':'btn bo bsm';
  document.getElementById('cl-view-list').className=v==='list'?'btn bp bsm':'btn bo bsm';
  renderClusters();
}

function renderClusters(){
  const all=getClusters();
  const body=document.getElementById('clusters-body');
  const byCity={};
  all.forEach(cl=>{
    const firstG=(cl.gardenIds||[]).map(id=>G(id)).find(g=>g.id);
    const city=firstG?firstG.city:'אחר';
    if(!byCity[city]) byCity[city]={gan:[],sch:[]};
    const hasSch=(cl.gardenIds||[]).some(id=>gcls(G(id))==='ביה"ס');
    const hasGan=(cl.gardenIds||[]).some(id=>gcls(G(id))==='גנים');
    if(hasSch) byCity[city].sch.push(cl);
    if(hasGan&&!hasSch) byCity[city].gan.push(cl);
    if(hasGan&&hasSch) byCity[city].gan.push(cl); // mixed
  });
  const allClusterGids=new Set(all.flatMap(cl=>cl.gardenIds||[]));
  const noCluster=GARDENS.filter(g=>!allClusterGids.has(g.id)&&gcls(g)==='גנים');

  const isGrid=_clustersView!=='list';
  let h='';

  if(!isGrid){
    // ═══ תצוגת רשימה ═══
    h+=`<table style="width:100%;border-collapse:collapse;font-size:.8rem">
      <thead>
        <tr style="background:#e8eaf6;color:#1a237e;font-weight:700;font-size:.78rem">
          <th style="padding:7px 8px;text-align:right;border-bottom:2px solid #c5cae9">אשכול</th>
          <th style="padding:7px 8px;text-align:right;border-bottom:2px solid #c5cae9">עיר</th>
          <th style="padding:7px 8px;text-align:center;border-bottom:2px solid #c5cae9">גנים</th>
          <th style="padding:7px 8px;text-align:right;border-bottom:2px solid #c5cae9">שיבוץ אחרון</th>
          <th style="padding:7px 8px;text-align:center;border-bottom:2px solid #c5cae9">פעולות</th>
        </tr>
      </thead><tbody>`;
    Object.keys(byCity).sort().forEach(city=>{
      [...(byCity[city].gan||[]),...(byCity[city].sch||[])].forEach((cl,i)=>{
        const gs=(cl.gardenIds||[]).map(id=>G(id)).filter(x=>x.id);
        const hist=SCH.filter(s=>(cl.gardenIds||[]).includes(s.g)).map(s=>s.d).sort().slice(-1);
        const lastDate=hist.length?fD(hist[0]):'—';
        const ganCount=gs.filter(g=>gcls(g)==='גנים').length;
        const schCount=gs.filter(g=>gcls(g)==='ביה"ס').length;
        const bg=i%2===0?'#fff':'#f8f9ff';
        h+=`<tr style="background:${bg};border-bottom:1px solid #e8eaf6">
          <td style="padding:7px 8px;font-weight:700;color:#1a237e">🔢 ${cl.name}</td>
          <td style="padding:7px 8px;color:#546e7a">🏙️ ${city}</td>
          <td style="padding:7px 8px;text-align:center;color:#37474f">
            ${ganCount?`<span title="גנים">🏫${ganCount}</span> `:''}${schCount?`<span title="בתי ספר">🏛️${schCount}</span>`:''}
          </td>
          <td style="padding:7px 8px;color:#78909c;font-size:.76rem">${lastDate}</td>
          <td style="padding:7px 8px;text-align:center;white-space:nowrap">
            <button class="btn bp bsm" onclick="openClusterSchedule('${cl.id}')" title="שיבוץ פעילות לאשכול">📅 שיבוץ</button>
            <button class="btn bg bsm" onclick="(()=>{const d=prompt('הכנס תאריך (YYYY-MM-DD):',new Date().toISOString().slice(0,10)); if(d) window.openClusterBulkEdit('${cl.id}', d);})()" title="עריכה מרוכזת של שיבוצים לתאריך">✏️ עריכת שיבוצים</button>
            <button class="btn bo bsm" onclick="openEditCluster('${cl.id}')" title="עריכת הגדרות האשכול">⚙️ הגדרות</button>
            <button class="btn br bsm" onclick="deleteCluster('${cl.id}')" title="מחק אשכול">🗑️</button>
          </td>
        </tr>`;
      });
    });
    h+='</tbody></table>';

    // גנים ללא אשכול (רשימה מתקפלת)
    if(noCluster.length){
      h+=`<div style="margin-top:12px;border-top:2px dashed #ffe082;padding-top:8px">
        <div style="font-weight:800;color:#f57f17;font-size:.82rem;margin-bottom:6px">⚠️ צהרונים ללא אשכול (${noCluster.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">`;
      noCluster.forEach(g=>{
        h+=`<span style="background:#fffde7;border:1px dashed #ffe082;border-radius:5px;padding:3px 7px;font-size:.74rem;display:inline-flex;align-items:center;gap:4px">
          🏫 ${g.city} · ${g.name}
          <button class="btn bp bsm" style="font-size:.62rem;padding:1px 5px" onclick="openEditCluster(null,'${g.id}')">➕</button>
        </span>`;
      });
      h+='</div></div>';
    }

  } else {
    // ═══ תצוגת כרטיסים (מקורית) ═══
    Object.keys(byCity).sort().forEach(city=>{
      h+=`<details class="city-accordion">
        <summary>
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <span style="font-weight:800; color:#2d3748;">🏙️ ${city}</span>
            <span style="font-size:0.8rem; color:#718096;">לחץ לפירוט</span>
          </div>
        </summary>
        <div class="city-accordion-content">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px">`;
      [...(byCity[city].gan||[]),...(byCity[city].sch||[])].forEach(cl=>{
        const gs=(cl.gardenIds||[]).map(id=>G(id)).filter(x=>x.id).sort((a,b)=>a.name.localeCompare(b.name,'he'));
        const ganGs=gs.filter(g=>gcls(g)==='גנים');
        const schGs=gs.filter(g=>gcls(g)==='ביה"ס');
        const hist=SCH.filter(s=>(cl.gardenIds||[]).includes(s.g)).map(s=>s.d).sort().slice(-1);
        const lastDate=hist.length?hist[0]:'';
        h+=`<div class="card" style="padding:10px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
            <div style="font-weight:700;color:#1a237e;font-size:.85rem">🔢 ${cl.name}</div>
            <div style="display:flex;gap:3px">
              <button class="btn bo bsm" onclick="openEditCluster('${cl.id}')">✏️</button>
              <button class="btn br bsm" onclick="deleteCluster('${cl.id}')">🗑️</button>
            </div>
          </div>
          <div style="font-size:.74rem;color:#546e7a;margin-bottom:6px">
            ${ganGs.length?`🏫 ${ganGs.length} גנים`:''} ${schGs.length?`🏛️ ${schGs.length} בתי ספר`:''}
            ${lastDate?`<span style="color:#78909c"> | אחרון: ${fD(lastDate)}</span>`:''}
          </div>
          <div style="max-height:100px;overflow-y:auto;margin-bottom:7px">`;
        gs.forEach(g=>h+=`<div style="font-size:.73rem;padding:2px 0;border-bottom:1px solid #f5f5f5">
          ${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}${g.st?` <span style="color:#aaa">${g.st}</span>`:''}
        </div>`);
        h+=`</div>
          <button class="btn bp bsm" style="width:100%" onclick="openClusterSchedule('${cl.id}')">📅 שבץ לאשכול</button>
        </div>`;
      });
      h+='</div></div></details>';
    });
    // גנים ללא אשכול — תצוגת כרטיסים
    if(noCluster.length){
      const noByCityMap={};
      noCluster.forEach(g=>{const c=g.city||'אחר';if(!noByCityMap[c])noByCityMap[c]=[];noByCityMap[c].push(g);});
      h+=`<div style="margin-top:14px;border-top:2px dashed #ffe082;padding-top:10px">
        <div style="font-weight:800;color:#f57f17;font-size:.83rem;margin-bottom:8px">⚠️ צהרונים ללא אשכול (${noCluster.length})</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:7px">`;
      Object.keys(noByCityMap).sort().forEach(city=>{
        h+=`<div style="background:#fffde7;border:1px dashed #ffe082;border-radius:7px;padding:8px">
          <div style="font-size:.72rem;font-weight:700;color:#f57f17;margin-bottom:4px">🏙️ ${city}</div>`;
        noByCityMap[city].forEach(g=>{
          h+=`<div style="font-size:.75rem;display:flex;justify-content:space-between;align-items:center;padding:2px 0">
            <span>${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</span>
            <button class="btn bp bsm" style="font-size:.63rem;padding:1px 5px" onclick="openEditCluster(null,'${g.id}')">➕</button>
          </div>`;
        });
        h+='</div>';
      });
      h+='</div></div>';
    }
  } // end else grid

  if(!h) h='<p style="color:#999">אין אשכולות.</p>';
  body.innerHTML=h;
}

function openEditCluster(clId,preSelectGid){
  const cl=clId?clusters[clId]:null;
  (document.getElementById('clm-title')||{}).textContent =cl?`✏️ עריכת אשכול: ${cl.name}`:'➕ אשכול חדש';
  document.getElementById('cl-name').value=cl?cl.name:'';
  document.getElementById('cl-desc').value=cl?cl.desc||'':'';
  document.getElementById('cl-name').dataset.editId=clId||'';
  const cityEl=document.getElementById('cl-city');
  cityEl.innerHTML='<option value="">כל הערים</option>';
  cities().forEach(c=>cityEl.innerHTML+=`<option value='${c}'>${c}</option>`);
  clFillGardens(cl);
  if(preSelectGid){const cb=document.querySelector('#cl-gardens input[value="'+preSelectGid+'"]');if(cb)cb.checked=true;}
  document.getElementById('clm').classList.add('open');
}
function clFillGardens(cl){
  const city=document.getElementById('cl-city').value;
  // Schools don't need clusters
  const gs=GARDENS.filter(g=>(!city||g.city===city)&&gcls(g)==='גנים').sort((a,b)=>a.name.localeCompare(b.name,'he'));
  const checked=new Set(cl?cl.gardenIds||[]:[]);
  document.getElementById('cl-gardens').innerHTML=gs.map(g=>`<label style="display:flex;gap:6px;padding:5px 4px;cursor:pointer;align-items:center;border-bottom:1px solid #f5f5f5">
    <input type="checkbox" value="${g.id}" ${checked.has(g.id)?'checked':''} style="min-width:14px">
    <span style="flex:1">${g.city} · ${g.name}</span>
    ${Object.values(clusters||{}).filter(c=>c.id!==cl?.id&&(c.gardenIds||[]).includes(g.id)).map(c=>`<span class="bdg bgray" style="font-size:.63rem">${c.name}</span>`).join('')}
  </label>`).join('');
}
function clFilterCity(){
  const clId=document.getElementById('cl-name').dataset.editId;
  const cl=clId?clusters[clId]:null;
  clFillGardens(cl);
}
function saveClusterModal(){
  const name=document.getElementById('cl-name').value.trim();
  if(!name){alert('יש להזין שם אשכול');return;}
  const editId=document.getElementById('cl-name').dataset.editId;
  const gardenIds=[...document.querySelectorAll('#cl-gardens input:checked')].map(cb=>parseInt(cb.value));
  const id=editId||('cl_'+Date.now());
  clusters[id]={id,name,desc:document.getElementById('cl-desc').value.trim(),gardenIds};
  save();CM('clm');refresh();refreshClusterDrops();
}
function deleteCluster(clId){
  if(!confirm('למחוק אשכול זה?')) return;
  delete clusters[clId];
  save(); refresh();
}

let _clsId=null;
function openClusterSchedule(clId){
  _clsId=clId;
  const cl=clusters[clId];
  if(!cl){return;}
  (document.getElementById('clsm-title')||{}).textContent =`📅 שיבוץ לאשכול: ${cl.name}`;
  document.getElementById('cls-date').value=d2s(calD);
  document.getElementById('cls-sup').innerHTML='<option value="">בחר ספק</option>';
  [...new Set(SCH.map(s=>s.a))].sort().forEach(n=>{
    const disp = window.supNameLabel(n) !== n ? window.supNameLabel(n) + ' (' + n + ')' : n;
    document.getElementById('cls-sup').innerHTML+=`<option value="${n}">${disp}</option>`;
  });
  SUPBASE.forEach(s=>{
    if(!document.querySelector(`#cls-sup option[value="${s.name}"]`)){
      const disp = window.supNameLabel(s.name) !== s.name ? window.supNameLabel(s.name) + ' (' + s.name + ')' : s.name;
      document.getElementById('cls-sup').innerHTML+=`<option value="${s.name}">${disp}</option>`;
    }
  });
  document.getElementById('cls-ph').value='';
  document.getElementById('cls-warn').style.display='none';
  document.getElementById('cls-autotime-row').style.display='none';
  clsBuildGardenList(cl);
  document.getElementById('cls-sup').onchange=function(){
    const s=SCH.find(x=>x.a===this.value&&x.p);
    if(s) document.getElementById('cls-ph').value=s.p;
  };
  document.getElementById('clsm').classList.add('open');
}
function clsBuildGardenList(cl){
  const gs=(cl.gardenIds||[]).map(id=>G(id)).filter(x=>x.id).sort((a,b)=>a.name.localeCompare(b.name,'he'));
  let h='';
  gs.forEach((g,i)=>{
    const lastSched=SCH.filter(s=>s.g===g.id).sort((a,b)=>b.d.localeCompare(a.d))[0];
    const lastT=lastSched?fT(lastSched.t):'';
    h+=`<div style="display:grid;grid-template-columns:auto 1fr 1fr auto;gap:8px;align-items:center;padding:7px 5px;border-bottom:1px solid #f0f0f0">
      <span class="bdg bb" style="font-size:.67rem;white-space:nowrap">${g.city}</span>
      <span style="font-weight:600;font-size:.8rem">${g.name}</span>
      <div class="fg">
        <label style="font-size:.66rem;color:#888">שעה</label>
        <input type="time" id="cls-t-${g.id}" value="${lastT}" style="min-width:90px;padding:4px 6px">
      </div>
      <label style="display:flex;align-items:center;gap:4px;font-size:.74rem;cursor:pointer">
        <input type="checkbox" id="cls-inc-${g.id}" checked>
        כלול
      </label>
    </div>`;
  });
  document.getElementById('cls-gardens-list').innerHTML=h||'<p style="color:#999;padding:10px">לא הוגדרו גנים לאשכול זה</p>';
}
function clsAutoTime(){
  const row=document.getElementById('cls-autotime-row');
  row.style.display=row.style.display==='none'?'block':'none';
}
function applyUniTime(){
  const t=document.getElementById('cls-uni-time').value;
  if(!t) return;
  const cl=clusters[_clsId];
  (cl.gardenIds||[]).forEach(gid=>{
    const el=document.getElementById(`cls-t-${gid}`);
    if(el) el.value=t;
  });
  document.getElementById('cls-autotime-row').style.display='none';
}
function saveClusterSchedule(){
  const date=document.getElementById('cls-date').value;
  const sup=document.getElementById('cls-sup').value;
  const ph=document.getElementById('cls-ph').value;
  if(!date||!sup){alert('יש לבחור תאריך וספק');return;}
  const cl=clusters[_clsId];
  const gs=(cl.gardenIds||[]).map(id=>G(id)).filter(x=>x.id);
  const warns=[];let saved=0;
  gs.forEach(g=>{
    const inc=document.getElementById(`cls-inc-${g.id}`);
    if(!inc||!inc.checked) return;
    const t=document.getElementById(`cls-t-${g.id}`)?.value||'';
    if(gcls(g)==='גנים'&&t){
      const h=parseInt(t.split(':')[0]);
      const per=h<13?'morning':'afternoon';
      const con=SCH.find(s=>s.g===g.id&&s.d===date&&s.st!=='can'&&s.t&&(parseInt(s.t.split(':')[0])<13?'morning':'afternoon')===per);
      if(con) warns.push(`${g.name}: כבר קיים ${con.a} ב-${fT(con.t)}`);
    }
    const newId=Date.now()+Math.random();
    SCH.push({id:newId,g:g.id,d:date,a:sup,t,p:ph,n:'',st:'ok',cr:'',cn:'',nt:'',pd:'',pt:'',grp:1});
    saved++;
  });
  if(warns.length){
    document.getElementById('cls-warn').style.display='block';
    document.getElementById('cls-warn').innerHTML='⚠️ התראות התנגשות שעות:<br>'+warns.join('<br>');
  }
  save();
  if(saved>0){
    alert(`✅ שובצו ${saved} פעילויות לתאריך ${fD(date)}`);
    CM('clsm');refresh();
  }
}

function exportPairRow(pairId,ds,isM){
  const pair=pairs.find(p=>String(p.id)===String(pairId));
  if(!pair) return;
  // Set date to the specific day, then open export modal with pair gids
  const prevD=calD;
  calD=s2d(ds);
  _exportPairWA(pair.ids, isM);
}
function showCopyToast(msg){
  let t=document.getElementById('copy-toast');
  if(!t){t=document.createElement('div');t.id='copy-toast';t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1b5e20;color:#fff;padding:9px 22px;border-radius:24px;font-size:.85rem;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);transition:opacity .4s';document.body.appendChild(t);}
  t.textContent=msg||'✅ ההודעה הועתקה ללוח!';t.style.opacity='1';
  clearTimeout(t._to);t._to=setTimeout(()=>t.style.opacity='0',2200);
}



function _exportGardenWA(gids, ds, isM){
  _exGids = (Array.isArray(gids) ? gids : JSON.parse(gids)).map(Number);
  _exIsM = isM;
  if(ds) calD = s2d(ds);
  openExport();
}

function _exportPairWA(gids, isM){
  _exGids = (Array.isArray(gids)?gids:JSON.parse(gids)).map(Number);
  _exIsM = isM;
  openExport();
}

function toggleExportMenu(){
  const m=document.getElementById('export-menu');
  if(!m) return;
  if(m.style.display!=='none'){m.style.display='none';return;}
  m.style.display='block';
  setTimeout(()=>document.addEventListener('click',function _c(e){
    if(!m.contains(e.target)&&e.target.id!=='export-main-btn'){m.style.display='none';document.removeEventListener('click',_c);}
  }),10);
}
function closeExportMenu(){const m=document.getElementById('export-menu');if(m)m.style.display='none';}
function openCalPrint(){
  // Generate export text and open print window directly
  let _ws = new Date(calD); _ws.setHours(0,0,0,0);
  if(_ws.getDay()===5) _ws.setDate(_ws.getDate()+2);
  else if(_ws.getDay()===6) _ws.setDate(_ws.getDate()+1);
  const _days = window.getNextWorkDays(_ws, 5);
  const fromDs=calV==='week'?d2s(_days[0]):calV==='day'?d2s(calD):d2s(new Date(calD.getFullYear(),calD.getMonth(),1));
  const toDs=calV==='week'?d2s(_days[4]):calV==='day'?d2s(calD):d2s(new Date(calD.getFullYear(),calD.getMonth()+1,0));

  // Set export fields and generate
  document.getElementById('ex-d1').value=fromDs;
  document.getElementById('ex-d2').value=toDs;
  genExport();
  // Open print window after generation
  setTimeout(()=>{
    const t=document.getElementById('ex-prev')?.textContent||'';
    if(!t||t.startsWith('לחץ')){ 
      // Fall back to modal if no content
      document.getElementById('exm').classList.add('open');
      return;
    }
    const w=window.open('','_blank','width=800,height=700');
    if(!w){ document.getElementById('exm').classList.add('open'); return; }
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>לוח זמנים</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;white-space:pre-wrap;font-size:13px;line-height:1.7}@media print{button{display:none}}</style></head>
    <body><button onclick="window.print()" style="margin-bottom:15px;padding:6px 16px;cursor:pointer;font-size:14px">🖨️ הדפס</button><pre>${t.replace(/</g,'&lt;')}</pre></body></html>`);
    w.document.close();
    // DON'T auto-print - let user review first
  }, 150);
}
function openExport(){
  let _ws = new Date(calD); _ws.setHours(0,0,0,0);
  if(_ws.getDay()===5) _ws.setDate(_ws.getDate()+2);
  else if(_ws.getDay()===6) _ws.setDate(_ws.getDate()+1);
  const _days = window.getNextWorkDays(_ws, 5);
  const ws = _days[0], we = _days[4];
  const isWeek=(calV==='week');
  const todayStr=d2s(calD);
  
  let d1Val = isWeek ? d2s(ws) : todayStr;
  let d2Val = isWeek ? d2s(we) : todayStr;
  
  const f=getCalF();
  const gids=_exGids||f.gids;
  
  // Dynamic Date Range expansion if exporting a single day that has a linked postponement
  if (!isWeek && gids && gids.length) {
    const listGids = gids.map(Number);
    let targetDate = '';
    
    // Find any event for these gardens on todayStr that is postponed or has a linked event
    const todayEvents = SCH.filter(s => listGids.includes(Number(s.g)) && s.d === todayStr);
    
    for (let s of todayEvents) {
      // 1. If today's event is postponed to another day (Wednesday -> Thursday)
      if (s.pd && s.pd !== todayStr) {
        targetDate = s.pd;
        break;
      }
      // 2. If today's event is postponed from another day (Thursday -> Wednesday)
      if (s._postFrom && s._postFrom !== todayStr) {
        targetDate = s.d;
        break;
      }
      if (s._makeupFrom && s._makeupFrom !== todayStr) {
        targetDate = s.d;
        break;
      }
      
      // 3. Look at notes/comments for date patterns
      const txt = (s.nt || '') + ' ' + (s.n || '') + ' ' + (s.cn || '');
      const m1 = txt.match(/(\d{4})-(\d{2})-(\d{2})/);
      let parsedDate = '';
      if (m1) parsedDate = m1[0];
      else {
        const m2 = txt.match(/(\d{1,2})[./\-](\d{1,2})([./\-]\d{2,4})?/);
        if (m2) {
          const rawY = m2[3] ? m2[3].replace(/[./\-]/g, '') : '';
          const y = rawY ? (rawY.length === 2 ? '20' + rawY : rawY) : new Date(s.d).getFullYear();
          const m = m2[2].padStart(2, '0');
          const d = m2[1].padStart(2, '0');
          parsedDate = `${y}-${m}-${d}`;
        }
      }
      if (parsedDate && parsedDate !== todayStr) {
        if (s.st === 'nohap' || s.st === 'can') {
          targetDate = parsedDate;
        } else {
          targetDate = s.d;
        }
        break;
      }
    }
    
    // 4. If we are on the target day (Thursday), but the event does not have _postFrom/notes pointing to it,
    // look for the original event (Wednesday) that has pd === todayStr (Thursday)
    if (!targetDate) {
      const origEvent = SCH.find(fs => listGids.includes(Number(fs.g)) && fs.pd === todayStr && fs.d !== todayStr);
      if (origEvent) {
        targetDate = todayStr;
      }
    }
    
    if (targetDate) {
      d1Val = targetDate;
      d2Val = targetDate;
    }
  }
  
  document.getElementById('ex-d1').value=d1Val;
  document.getElementById('ex-d2').value=d2Val;
  
  let ctx=isWeek?`${fD(d2s(ws))} – ${fD(d2s(we))}`:`תאריך: ${fD(d2s(calD))}`;
  if(gids&&gids.length) ctx+=` | גנים: ${gids.map(id=>G(id).name||'').join(' + ')}`;
  (document.getElementById('ex-ctx')||{}).textContent =ctx;
  document.getElementById('exm').classList.add('open');
  // Auto-generate preview — pass gids snapshot so _exGids isn't cleared before use
  const _snapGids = _exGids;
  setTimeout(()=>{ _exGids=_snapGids; genExport(); }, 80);
}
function genExport(){
  const from=document.getElementById('ex-d1').value;
  const to=document.getElementById('ex-d2').value||from;
  const fmt=document.getElementById('ex-fmt').value;
  if(!from){alert('בחר תאריך');return;}
  const gids = (_exGids || f.gids) ? (_exGids || f.gids).map(Number) : null;
  // DON'T clear _exGids here so manual re-generation works
  const isM_flag = _exIsM;
  const rel=SCH.filter(s=>s.d>=from&&s.d<=to&&(!gids||gids.includes(Number(s.g))))
    .sort((a,b)=>a.d.localeCompare(b.d)||(a.t||'99').localeCompare(b.t||'99'));
  const relActive=rel.filter(s=>s.st!=='can');
  if(!rel.length){(document.getElementById('ex-prev')||{}).textContent='אין פעילויות';return;}

  // Row-level type detector
  const getEvType = (s) => {
    const noteText = (s.nt || '') + ' ' + (s.n || '') + ' ' + (s.a || '');
    
    // 1. Explicit Cancel / Nohap logic first
    if (s.st === 'can') return 'can';
    if (s.st === 'nohap') {
      if (/הוקדם ל/i.test(noteText)) return 'preponed_out';
      return 'nohap'; 
    }
    
    // 2. Advancement (הקדמה)
    if (s._postFrom && s.d < s._postFrom) return 'preponed';
    if (/הקדמה מיום|הוקדם מיום|הקדמה|הוקדם מ/i.test(noteText)) return 'preponed';
    
    // 3. Postponement (דחייה)
    if (s._postFrom && s.d > s._postFrom) return 'postponed';
    if (/דחייה מיום|נדחה מיום|הוזז מיום|עבר מיום|דחייה|נדחה|הוזז|השלמה מיום/i.test(noteText)) return 'postponed';
    
    // 4. Preponed out fallback
    if (/הוקדם ל/i.test(noteText)) return 'preponed_out';
    
    // 5. Makeup (השלמה)
    if (s._makeupFrom || (s._isMakeup && !s._postFrom)) return 'makeup';
    if (/השלמה/i.test(noteText)) return 'makeup';
    
    return 'normal';
  };

  const types = rel.map(getEvType);
  const isAllPreponed = types.every(t => t === 'preponed');
  const isAllPostponed = types.every(t => t === 'postponed');
  const isAllPreponedOut = types.every(t => t === 'preponed_out');
  const isAllMakeup = types.every(t => t === 'makeup');
  const isAllNohap = rel.every(s => s.st === 'nohap' || (s.nt && /נדחה ל|הוזז ל|עבר ל|עובר ל|הועבר ל/i.test(s.nt)));
  const isAllCan = rel.every(s => s.st === 'can');

  const getRefDateStr = (relArr, currentExportDate) => {
    for (let s of relArr) {
      let refDate = s._postFrom || s._makeupFrom || null;
      if (!refDate) {
         const txt = (s.nt || '') + ' ' + (s.n || '');
         const m1 = txt.match(/(\d{4})-(\d{2})-(\d{2})/);
         if (m1) refDate = m1[0];
         else {
            const m2 = txt.match(/(\d{1,2})[./\-](\d{1,2})([./\-]\d{2,4})?/);
            if(m2) {
               const rawY = m2[3] ? m2[3].replace(/[./\-]/g, '') : '';
               const y = rawY ? (rawY.length===2 ? '20'+rawY : rawY) : new Date(currentExportDate).getFullYear();
               const m = m2[2].padStart(2, '0');
               const d = m2[1].padStart(2, '0');
               refDate = `${y}-${m}-${d}`;
            }
         }
      }
      if (refDate && refDate !== currentExportDate) {
         try {
           let rDateObj;
           if(typeof window.s2d === 'function') rDateObj = window.s2d(refDate);
           else {
               const parts = refDate.split('-');
               rDateObj = new Date(parts[0], parts[1]-1, parts[2]);
           }
           let cDateObj;
           if(typeof window.s2d === 'function') cDateObj = window.s2d(currentExportDate);
           else {
               const parts = currentExportDate.split('-');
               cDateObj = new Date(parts[0], parts[1]-1, parts[2]);
           }
           
           if (isNaN(rDateObj)) continue;
           
           const dName = typeof window.dayN === 'function' ? window.dayN(refDate) : ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][rDateObj.getDay()];
           
           // Same week check (Sun to Sat week)
           const wStart = (d) => { const x=new Date(d); x.setDate(x.getDate() - x.getDay()); return x.getTime(); };
           const rW = wStart(rDateObj);
           const cW = wStart(cDateObj);
           
           if (rW === cW) {
              return `יום ${dName}`;
           } else {
              return `יום ${dName} ${rDateObj.getDate().toString().padStart(2,'0')}/${(rDateObj.getMonth()+1).toString().padStart(2,'0')}`;
           }
         } catch(e) {}
      }
    }
    return '';
  };

  const refStr = getRefDateStr(rel, rel[0]?.d || from);

  let headerTitle = '';
  const getTargetDayStr = (targetDate, refDate) => {
    try {
      const tDateObj = typeof window.s2d === 'function' ? window.s2d(targetDate) : new Date(targetDate.split('-')[0], targetDate.split('-')[1]-1, targetDate.split('-')[2]);
      const rDateObj = typeof window.s2d === 'function' ? window.s2d(refDate) : new Date(refDate.split('-')[0], refDate.split('-')[1]-1, refDate.split('-')[2]);
      if (isNaN(tDateObj)) return '';
      const dName = typeof window.dayN === 'function' ? window.dayN(targetDate) : ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][tDateObj.getDay()];
      
      const wStart = (d) => { const x=new Date(d); x.setDate(x.getDate() - x.getDay()); return x.getTime(); };
      if (wStart(tDateObj) === wStart(rDateObj)) {
        return `ליום ${dName}`;
      } else {
        return `ליום ${dName} ${tDateObj.getDate().toString().padStart(2,'0')}/${(tDateObj.getMonth()+1).toString().padStart(2,'0')}`;
      }
    } catch(e) { return ''; }
  };

  // Find linked forward/backward postponement dates dynamically
  let forwardTargetDate = '';
  let backwardOriginalDate = '';
  
  if (rel.length > 0) {
    // Search if there is any event in rel that points to another date in rel
    for (let s of rel) {
      if (s._postFrom && rel.some(x => x.d === s._postFrom)) {
        backwardOriginalDate = s._postFrom;
        forwardTargetDate = s.d;
        break;
      }
      if (s.pd && rel.some(x => x.d === s.pd)) {
        backwardOriginalDate = s.d;
        forwardTargetDate = s.pd;
        break;
      }
    }
    
    // Fallback: if we only have 1 date loaded or couldn't find mutual links within rel, use individual event properties
    if (!forwardTargetDate && !backwardOriginalDate && rel.length > 0) {
      const s0 = rel[0];
      if (s0.pd && s0.pd !== s0.d) {
        backwardOriginalDate = s0.d;
        forwardTargetDate = s0.pd;
      } else if (s0._postFrom && s0._postFrom !== s0.d) {
        backwardOriginalDate = s0._postFrom;
        forwardTargetDate = s0.d;
      } else {
        // Look up in the entire SCH for any postponed event in the same garden pointing to s0.d
        const origEvent = SCH.find(fs => Number(fs.g) === Number(s0.g) && fs.pd === s0.d && fs.d !== s0.d);
        if (origEvent) {
          backwardOriginalDate = origEvent.d;
          forwardTargetDate = s0.d;
        } else {
          // Look up if s0 is the original event that has been postponed to a target day in SCH
          const targetEv = SCH.find(fs => Number(fs.g) === Number(s0.g) && fs.d === s0.pd && fs.d !== s0.d);
          if (targetEv) {
            backwardOriginalDate = s0.d;
            forwardTargetDate = targetEv.d;
          }
        }
      }
    }
  }

  if (isAllPreponed) {
    const targetStr = rel[0] && refStr ? getTargetDayStr(rel[0].d, rel[0]._postFrom || rel[0]._makeupFrom || rel[0].d) : '';
    headerTitle = refStr ? `*הקדמה מ${refStr}${targetStr ? ' ' + targetStr : ''}*\n` : '*הקדמה*\n';
  } else if (isAllPostponed || (forwardTargetDate && backwardOriginalDate)) {
    let customRefStr = '';
    let customTargetStr = '';
    
    if (forwardTargetDate && backwardOriginalDate) {
      try {
        const oDateObj = typeof window.s2d === 'function' ? window.s2d(backwardOriginalDate) : new Date(backwardOriginalDate.split('-')[0], backwardOriginalDate.split('-')[1]-1, backwardOriginalDate.split('-')[2]);
        const tDateObj = typeof window.s2d === 'function' ? window.s2d(forwardTargetDate) : new Date(forwardTargetDate.split('-')[0], forwardTargetDate.split('-')[1]-1, forwardTargetDate.split('-')[2]);
        const dNameOriginal = typeof window.dayN === 'function' ? window.dayN(backwardOriginalDate) : ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][oDateObj.getDay()];
        const dNameTarget = typeof window.dayN === 'function' ? window.dayN(forwardTargetDate) : ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][tDateObj.getDay()];
        
        const wStart = (d) => { const x=new Date(d); x.setDate(x.getDate() - x.getDay()); return x.getTime(); };
        
        const currentCalDateStr = typeof d2s === 'function' ? d2s(calD) : (typeof window.d2s === 'function' ? window.d2s(window.calD) : new Date(calD).toISOString().split('T')[0]);
        
        if (wStart(oDateObj) === wStart(tDateObj)) {
          // SAME WEEK
          if (currentCalDateStr === backwardOriginalDate) {
            // We are exporting from the ORIGINAL day (Wednesday) -> Show target (Thursday)
            customRefStr = `יום ${dNameOriginal}`;
            customTargetStr = ` ליום ${dNameTarget}`;
          } else {
            // We are exporting from the TARGET day (Thursday) -> Show only original (Wednesday)
            customRefStr = `יום ${dNameOriginal}`;
            customTargetStr = '';
          }
        } else {
          // DIFFERENT WEEK
          if (currentCalDateStr === backwardOriginalDate) {
            // We are exporting from the ORIGINAL day (Wednesday) -> Show target date + original date
            customRefStr = `יום ${dNameOriginal} ${oDateObj.getDate().toString().padStart(2,'0')}/${(oDateObj.getMonth()+1).toString().padStart(2,'0')}`;
            customTargetStr = ` ליום ${dNameTarget} ${tDateObj.getDate().toString().padStart(2,'0')}/${(tDateObj.getMonth()+1).toString().padStart(2,'0')}`;
          } else {
            // We are exporting from the TARGET day (Thursday) -> Show only original date
            customRefStr = `יום ${dNameOriginal} ${oDateObj.getDate().toString().padStart(2,'0')}/${(oDateObj.getMonth()+1).toString().padStart(2,'0')}`;
            customTargetStr = '';
          }
        }
      } catch(e) {}
    }
    
    headerTitle = customRefStr ? `*נדחה מ${customRefStr}${customTargetStr}*\n` : '*נדחה*\n';
  } else if (isAllPreponedOut) {
    headerTitle = refStr ? `*לא מתקיים - הוקדם ל${refStr}*\n` : '*לא מתקיים - הוקדם*\n';
  } else if (isAllMakeup) {
    const targetStr = rel[0] && refStr ? getTargetDayStr(rel[0].d, rel[0]._postFrom || rel[0]._makeupFrom || rel[0].d) : '';
    const origDate = rel[0] ? (rel[0]._postFrom || rel[0]._makeupFrom) : null;
    const today = typeof window.td === 'function' ? window.td() : new Date().toISOString().split('T')[0];
    
    if (origDate === today) {
      const dNameTarget = typeof window.dayN === 'function' ? window.dayN(rel[0].d) : '';
      headerTitle = `*לא יתקיים היום חוג*\n*השלמה נקבעה ליום ${dNameTarget}*\n`;
    } else {
      headerTitle = refStr ? `*השלמה מ${refStr}${targetStr ? ' ' + targetStr : ''}*\n` : '*השלמה*\n';
    }
  } else if (isAllNohap) {
    headerTitle = '*לא מתקיים*\n';
  } else if (isAllCan) {
    headerTitle = '*בוטל*\n';
  }

  // Row-level label builder based on exact comments
  const getRowTag = (s) => {
    const t = getEvType(s);
    if (isAllMakeup || isAllPreponed || isAllPostponed || isAllPreponedOut) return ''; // Already handled globally
    const sRef = getRefDateStr([s], s.d);
    if (t === 'preponed') return sRef ? `*הקדמה מ${sRef}* · ` : '*הקדמה* · ';
    if (t === 'postponed') return sRef ? `*נדחה מ${sRef}* · ` : '*נדחה* · ';
    if (t === 'preponed_out') return sRef ? `*הוקדם ל${sRef}* · ` : '*הוקדם* · ';
    if (t === 'makeup') return sRef ? `*השלמה מ${sRef}* · ` : '*השלמה* · ';
    return '';
  };

  const incCoord = document.getElementById('ex-inc-coord') && document.getElementById('ex-inc-coord').checked;
  const getCoordStr = (gid) => {
    if (!incCoord) return '';
    const mgr = Object.values(window.managers || {}).find(m => (m.gardenIds||[]).includes(gid));
    if (mgr) return ` (רכז/ת: ${mgr.name} ${mgr.phone||''})`.trimEnd();
    return '';
  };

  const byDate={};rel.forEach(s=>{if(!byDate[s.d])byDate[s.d]=[];byDate[s.d].push(s);});
  let text = headerTitle;
  const dates=Object.keys(byDate).sort();
  dates.forEach((date,di)=>{
    const dayIcon = '🗓️';
    text+=`${dayIcon} ${fD(date)} - יום ${dayN(date)}\n`;
    const byCity={};
    byDate[date].forEach(s=>{
      const g=G(s.g);const c=g.city||'';
      if(!byCity[c])byCity[c]=[];
      byCity[c].push({...s,gd:g});
    });
    Object.keys(byCity).sort().forEach(c=>{
      if(fmt==='full'){
        // ── Group by pairs first, then solos ──────────────────────────
        const cityEvs=byCity[c];
        const usedIds=new Set();
        // Pairs
        pairs.forEach(pair=>{
          const pairEvs=cityEvs.filter(s=>pair.ids.includes(s.g));
          if(!pairEvs.length) return;
          pairEvs.forEach(s=>usedIds.add(s.id));
          // Group same pair by supplier+activity key
          const bySup={};
          pairEvs.forEach(s=>{
            const key=`${s.a}||${s.act||supAct(s.a)||''}||${s.p||''}`;
            if(!bySup[key])bySup[key]=[];
            bySup[key].push(s);
          });
          Object.values(bySup).forEach(group=>{
            const s0=group[0];
            const actLabel=s0.act||supAct(s0.a)||'';
            const supPhone = s0.p || (typeof window.getSupPhone === 'function' ? window.getSupPhone(s0.a) : '') || (SUPBASE.find(sb => sb.name === s0.a) || {}).phone || '';
            const supLine=`📚 ${supDisplayName(supBase(s0.a))}${actLabel?' - '+actLabel:''}${supPhone?' · 📞 '+supPhone:''}`;
            const addrs=[...new Set(group.map(s=>s.gd.st||''))];
            const sameAddr=addrs.length===1&&addrs[0];
            
            const isNohapFunc = (s) => s.st === 'can' || s.st === 'nohap' || (s.nt && /הוקדם ל|נדחה ל|הוזז ל|עבר ל|עובר ל|הועבר ל/i.test(s.nt)) || (s.n && /הוקדם ל|נדחה ל|הוזז ל|עבר ל|עובר ל|הועבר ל/i.test(s.n));
            const allNohap = group.every(isNohapFunc);
            
            const groupMgrs = [...new Set(group.map(s => getCoordStr(s.gd.id)).filter(Boolean))];
            const isPairWithSameMgr = group.length > 1 && groupMgrs.length === 1;
            const sharedMgrStr = isPairWithSameMgr ? groupMgrs[0] : '';
            
            let blockTitle = '';
            let skipInlineNohap = false;
            let skipInlineMTag = false;
            
            if (allNohap && !isAllCan && !isAllNohap && !isAllPreponedOut) {
              blockTitle = '*(לא התקיים)*\n';
              skipInlineNohap = true;
            } else {
              const tags = group.map(s => getRowTag(s));
              if (tags[0] && tags.every(t => t === tags[0])) {
                blockTitle = `${tags[0].replace(' · ', '')}\n`;
                skipInlineMTag = true;
              }
            }
            
            if (blockTitle) text += blockTitle;
            text+=`${supLine}\n📍 ${c}\n`;
            
            if(sameAddr){
              text+=`  📍 ${addrs[0]}\n`;
              group.forEach(s=>{ 
                const mTag = skipInlineMTag ? '' : getRowTag(s);
                const isNohapRow = isNohapFunc(s);
                const stIcon = isNohapRow ? '❌ ' : '🏫 ';
                const statusTag = (!skipInlineNohap && isNohapRow && !isAllCan && !isAllNohap && !isAllPreponedOut) ? ' *(לא התקיים)*' : '';
                const coordText = isPairWithSameMgr ? '' : getCoordStr(s.gd.id);
                text+=`     ${stIcon}${mTag}${s.gd.name}${coordText}${statusTag}${s.t?' · ⏰ '+fT(s.t):''}\n`; 
              });
            } else {
              group.forEach(s=>{
                const mTag = skipInlineMTag ? '' : getRowTag(s);
                const isNohapRow = isNohapFunc(s);
                const stIcon = isNohapRow ? '❌ ' : '🏫 ';
                const addr=s.gd.st?`📍 ${s.gd.st} · `:'';
                const statusTag = (!skipInlineNohap && isNohapRow && !isAllCan && !isAllNohap && !isAllPreponedOut) ? ' *(לא התקיים)*' : '';
                const coordText = isPairWithSameMgr ? '' : getCoordStr(s.gd.id);
                text+=`  ${stIcon}${mTag}${addr}${s.gd.name}${coordText}${statusTag}${s.t?' · ⏰ '+fT(s.t):''}\n`;
              });
            }
            if (isPairWithSameMgr && sharedMgrStr) {
               text+=`     👤 ${sharedMgrStr.replace(' (', '').replace(')', '')}\n`;
            }
            text+='\n';
          });
        });
        // Solos (not in any pair)
        const soloEvs=cityEvs.filter(s=>!usedIds.has(s.id));
        if(soloEvs.length){
          const bySup={};
          soloEvs.forEach(s=>{
            const key=`${s.a}||${s.act||supAct(s.a)||''}||${s.p||''}`;
            if(!bySup[key])bySup[key]=[];
            bySup[key].push(s);
          });
          Object.values(bySup).forEach(group=>{
            const s0=group[0];
            const actLabel=s0.act||supAct(s0.a)||'';
            const supPhone = s0.p || (typeof window.getSupPhone === 'function' ? window.getSupPhone(s0.a) : '') || (SUPBASE.find(sb => sb.name === s0.a) || {}).phone || '';
            const supLine=`📚 ${supDisplayName(supBase(s0.a))}${actLabel?' - '+actLabel:''}${supPhone?' · 📞 '+supPhone:''}`;
            const addrs=[...new Set(group.map(s=>s.gd.st||''))];
            const sameAddr=addrs.length===1&&addrs[0];
            
            const isNohapFunc = (s) => s.st === 'can' || s.st === 'nohap' || (s.nt && /הוקדם ל|נדחה ל|הוזז ל|עבר ל|עובר ל|הועבר ל/i.test(s.nt)) || (s.n && /הוקדם ל|נדחה ל|הוזז ל|עבר ל|עובר ל|הועבר ל/i.test(s.n));
            const allNohap = group.every(isNohapFunc);
            
            let blockTitle = '';
            let skipInlineNohap = false;
            let skipInlineMTag = false;
            
            if (allNohap && !isAllCan && !isAllNohap && !isAllPreponedOut) {
              blockTitle = '*(לא התקיים)*\n';
              skipInlineNohap = true;
            } else {
              const tags = group.map(s => getRowTag(s));
              if (tags[0] && tags.every(t => t === tags[0])) {
                blockTitle = `${tags[0].replace(' · ', '')}\n`;
                skipInlineMTag = true;
              }
            }
            
            if (blockTitle) text += blockTitle;
            text+=`${supLine}\n📍 ${c}\n`;
            
            if(sameAddr){
              text+=`  📍 ${addrs[0]}\n`;
              group.forEach(s=>{ 
                const mTag = skipInlineMTag ? '' : getRowTag(s);
                const isNohapRow = isNohapFunc(s);
                const stIcon = isNohapRow ? '❌ ' : '🏫 ';
                const statusTag = (!skipInlineNohap && isNohapRow && !isAllCan && !isAllNohap && !isAllPreponedOut) ? ' *(לא התקיים)*' : '';
                const coordText = getCoordStr(s.gd.id);
                text+=`     ${stIcon}${mTag}${s.gd.name}${coordText}${statusTag}${s.t?' · ⏰ '+fT(s.t):''}\n`; 
              });
            } else {
              group.forEach(s=>{
                const mTag = skipInlineMTag ? '' : getRowTag(s);
                const isNohapRow = isNohapFunc(s);
                const stIcon = isNohapRow ? '❌ ' : '🏫 ';
                const addr=s.gd.st?`📍 ${s.gd.st} · `:'';
                const statusTag = (!skipInlineNohap && isNohapRow && !isAllCan && !isAllNohap && !isAllPreponedOut) ? ' *(לא התקיים)*' : '';
                const coordText = getCoordStr(s.gd.id);
                text+=`  ${stIcon}${mTag}${addr}${s.gd.name}${coordText}${statusTag}${s.t?' · ⏰ '+fT(s.t):''}\n`;
              });
            }
            text+='\n';
          });
        }
      } else {
        text+=`📍 ${c}\n`;
        byCity[c].forEach(s=>{
          const mTag = getRowTag(s);
          const isNohapRow = s.st === 'can' || s.st === 'nohap' || (s.nt && /הוקדם ל|נדחה ל|הוזז ל|עבר ל|עובר ל|הועבר ל/i.test(s.nt)) || (s.n && /הוקדם ל|נדחה ל|הוזז ל|עבר ל|עובר ל|הועבר ל/i.test(s.n));
          const stIcon = isNohapRow ? '❌ ' : '🏫 ';
          const statusTag = (isNohapRow && !isAllCan && !isAllNohap && !isAllPreponedOut) ? ' *(לא התקיים)*' : '';
          const coordText = getCoordStr(s.gd.id);
          text+=`${stIcon}${mTag}${s.gd.name}${coordText}${statusTag} - ${s.a}${s.t?' · ⏰ '+fT(s.t):''}\n`;
        });
      }
    });
    // Blank line between dates
    text+='\n';
  });
  (document.getElementById('ex-prev')||{}).textContent =text;
}
function copyExport(){
  const t=document.getElementById('ex-prev').textContent;
  if(!t||t.startsWith('לחץ')) return;
  navigator.clipboard.writeText(t).then(()=>{
    if(typeof window.showToast==='function') window.showToast('✅ הועתק ללוח!');
    else alert('✅ הועתק!');
  }).catch(()=>{
    const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
    if(typeof window.showToast==='function') window.showToast('✅ הועתק ללוח!');
    else alert('✅ הועתק!');
  });
}
function printExport(){
  const t=document.getElementById('ex-prev').textContent;
  if(!t||t.startsWith('לחץ')){alert('יש ליצור תצוגה מקדימה תחילה');return;}
  const w=window.open('','_blank','width=700,height=600');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>לוח זמנים</title>
  <style>body{font-family:Arial,sans-serif;padding:20px;white-space:pre-wrap;font-size:14px;line-height:1.7}@media print{button{display:none}}</style></head>
  <body><button onclick="window.print()" style="margin-bottom:15px;padding:6px 16px;cursor:pointer">🖨️ הדפס</button><pre>${t.replace(/</g,'&lt;')}</pre></body></html>`);
  w.document.close();
}

// [backup system unified — see createSnapshot/openBackup above]
var _supExName=null;
var _supExType = 'act'; // 'act' | 'inv'

// ==========================
// Phase 4: Recurring Bulk Updates
// ==========================

window.renderGmRecurring = function(gid, el){
  const evs = window.SCH.filter(s => Number(s.g) === Number(gid) && s.d >= window.td() && s.st !== 'can');
  
  const seriesMap = {};
  evs.forEach(s => {
    if(s.st !== 'ok') return;
    let wd = -1;
    try { const p=s.d.split('-'); wd=new Date(p[0],parseInt(p[1])-1,p[2]).getDay(); } catch(e){}
    if(wd === -1) return;
    
    const key = s._recId || `${s.a}_${s.act}_${wd}`;
    if(!seriesMap[key]){
      seriesMap[key] = {
        key, _recId: s._recId, a: s.a, act: s.act, wd: wd, t: s.t,
        count: 0, firstDate: s.d, lastDate: s.d
      };
    }
    const sm = seriesMap[key];
    sm.count++;
    if(s.d < sm.firstDate) sm.firstDate = s.d;
    if(s.d > sm.lastDate) sm.lastDate = s.d;
  });

  const series = Object.values(seriesMap).sort((a, b) => a.wd - b.wd);

  if(!series.length){
    el.innerHTML = '<p style="text-align:center;padding:20px;color:#78909c">לא נמצאו חוגים קבועים בעתיד (או שכולם בוטלו).</p>';
    return;
  }

  const daysHe = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

  let h = `<div style="font-weight:800;color:#1a237e;margin-bottom:12px">🔄 חוגים קבועים בצהרון (מכאן והלאה)</div>
  <div style="display:grid;gap:10px">`;
  
  series.forEach(sr => {
    h += `<div style="background:#fff;border:1px solid #d1d9e6;border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
      <div>
        <div style="font-weight:800;color:#1565c0;font-size:1rem">${sr.act||'—'} <span style="font-weight:600;color:#546e7a;font-size:.85rem">/ ${sr.a}</span></div>
        <div style="font-size:.8rem;color:#7986cb;margin-top:4px">
          יום <b>${daysHe[sr.wd]}</b> &nbsp;|&nbsp; שעה <b>${window.fT(sr.t)}</b> &nbsp;|&nbsp; ${sr.count} מפגשים צפי (${window.fD(sr.firstDate)} – ${window.fD(sr.lastDate)})
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn bsm" style="background:#25d366;color:#fff;border:none;padding:6px 12px;font-size:.8rem;cursor:pointer;display:inline-flex;align-items:center;gap:4px;border-radius:4px" onclick="event.stopPropagation(); window.exportRecurringWA('${sr.key}', ${gid})">📋 הודעה</button>
        <button class="btn bp bsm" onclick="window.openBulkUpdateRecurring('${sr.key}', ${gid})">✏️ שינוי שיבוץ (מערכתי)</button>
      </div>
    </div>`;
  });
  h += `</div>`;
  el.innerHTML = h;
};

window.openBulkUpdateRecurring = function(key, gid) {
  const el = document.getElementById('gm-recur');
  const evs = window.SCH.filter(s => Number(s.g) === Number(gid) && s.st === 'ok' && s.d >= window.td());
  let srExample = null;
  evs.forEach(s => {
      let wd=-1; try{const p=s.d.split('-'); wd=new Date(p[0],p[1]-1,p[2]).getDay();}catch(e){}
      const k = s._recId || `${s.a}_${s.act}_${wd}`;
      if(k === key) srExample = s;
  });
  
  if(!srExample) return;
  
  const fromDate = window.td();
  const y = parseInt(fromDate.slice(0,4));
  const toDate = (new Date() < new Date(y, 6, 1)) ? `${y}-06-30` : `${y+1}-06-30`;
  
  const currentTimes = {};
  const pair = window.gardenPair(gid);
  if(pair) {
     pair.ids.forEach(pId => {
       if(Number(pId) === Number(gid)) return;
       const pEv = window.SCH.find(ps => Number(ps.g) === Number(pId) && ps.st === 'ok' && ps.a === srExample.a && ps.act === srExample.act && ps.d >= window.td());
       if(pEv) currentTimes[pId] = window.fT(pEv.t || srExample.t);
     });
  }
  
  const allSups = window.getAllSup().filter(s=>window.isActSupplier(s.name));
  const acts = window.getSupActs(srExample.a);
  let dObj=null; try{const p=srExample.d.split('-'); dObj=new Date(p[0],p[1]-1,p[2]);}catch(e){}
  const currWd = dObj ? dObj.getDay() : 0;
  
  let h = `<div style="background:#fff;border-radius:10px;padding:15px;border:1.5px solid #d1d9e6;box-shadow:0 10px 20px rgba(0,0,0,0.05);position:relative">
    <button onclick="window.renderGmRecurring(${gid}, document.getElementById('gm-recur'))" style="position:absolute;top:10px;left:10px;background:none;border:none;font-size:1.2rem;cursor:pointer" title="חזור לרשימה">🔙</button>
    <div style="font-size:1rem;font-weight:900;color:#1a237e;margin-bottom:15px;text-align:center">🛠️ שינוי שיבוץ קבוע (מרחבי)</div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div class="fg"><label for="grm-sup">ספק חדש</label><select id="grm-sup" onchange="window.grmSupChg()" title="בחר ספק" style="width:100%">${allSups.map(s=>{ const disp = window.supNameLabel(s.name) !== s.name ? window.supNameLabel(s.name) + ' (' + s.name + ')' : s.name; return `<option value="${s.name}" ${s.name===srExample.a?'selected':''}>${disp}</option>`; }).join('')}</select></div>
      <div class="fg"><label for="grm-act">פעילות חדשה</label><select id="grm-act" title="בחר פעילות" style="width:100%">${acts.map(a=>`<option value="${a}" ${a===srExample.act?'selected':''}>${a}</option>`).join('')}</select></div>
    </div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:15px;background:#f5f7ff;padding:10px;border-radius:8px">
      <div class="fg"><label for="grm-d1">מ-תאריך</label><input type="date" id="grm-d1" value="${fromDate}" style="width:100%"></div>
      <div class="fg"><label for="grm-d2">עד-תאריך</label><input type="date" id="grm-d2" value="${toDate}" style="width:100%"></div>
      <div class="fg"><label for="grm-wd">ביום קבוע נבחר</label>
        <select id="grm-wd" title="יום בשבוע" style="width:100%">
          ${['ראשון','שני','שלישי','רביעי','חמישי','שישי'].map((n,i) => `<option value="${i}" ${i===currWd?'selected':''}>יום ${n}</option>`).join('')}
        </select>
      </div>
    </div>
    
    <div style="margin-bottom:15px;border-top:1px dashed #ccc;padding-top:12px">
      <div class="fg"><label for="grm-time" style="font-weight:800;color:#1a237e">שעה מעודכנת עבור הגן הראשי (${window.G(gid).name})</label>
        <input type="time" id="grm-time" value="${window.fT(srExample.t)||''}" style="width:100%;max-width:150px">
      </div>
      <div style="margin-top:15px">
        ${window.renderPartnerSynergy ? window.renderPartnerSynergy(gid, 'grm', currentTimes) : ''}
      </div>
    </div>
    <div style="background:#fff3cd;color:#856404;padding:8px 12px;border-radius:5px;font-size:0.78rem;margin-bottom:12px;text-align:center">
      ⚠️ פעולה זו תסיר את הסידור הקיים (בטווח התאריכים הרלוונטי) ותיצור במקומו סידור חדש תוך עקיפת חגים וחופשות.
    </div>
    <button class="btn bg" style="width:100%;font-size:1.05rem;font-weight:900;padding:12px" onclick="window.doBulkUpdateRecurring('${key}', ${gid})">✅ ביצוע החלפה וסינרגיה</button>
  </div>`;
  el.innerHTML = h;
};

window.grmSupChg = function() {
  const sup = document.getElementById('grm-sup').value;
  const actSel = document.getElementById('grm-act');
  actSel.innerHTML = window.getSupActs(sup).map(a=>`<option value="${a}">${a}</option>`).join('');
};

window.doBulkUpdateRecurring = function(key, gid){
  const d1 = document.getElementById('grm-d1').value;
  const d2 = document.getElementById('grm-d2').value;
  const newSup = document.getElementById('grm-sup').value;
  const newAct = document.getElementById('grm-act').value;
  const newWd = parseInt(document.getElementById('grm-wd').value);
  const primaryTime = document.getElementById('grm-time').value;
  
  if(!d1 || !d2 || !newSup || !newAct) return alert('נא למלא תאריכים וספק');
  if(d1 > d2) return alert('תאריך התחלה חייב להיות לפני תאריך סיום');
  
  if(!confirm('המערכת תסיר את כל המפגשים הקיימים בסדרה זו בטווח הנבחר (כולל מהגנים השותפים שסומנו), ותשבץ מחדש.\nהאם להתקדם?')) return;
  
  const synergyPartners = typeof window.getSynergyData === 'function' ? window.getSynergyData('grm') : [];
  const targets = [{g: gid, t: primaryTime}];
  synergyPartners.forEach(syn => targets.push({g: syn.g, t: syn.t || primaryTime}));

  let cRemoved = 0;
  let cAdded = 0;
  
  const newRecoups = targets.map(() => 'rec_'+Date.now()+'_'+Math.random().toString(36).substr(2,5));
  
  targets.forEach((tgt, tIdx) => {
     for(let i = window.SCH.length-1; i >= 0; i--){
       const s = window.SCH[i];
       if(Number(s.g) !== Number(tgt.g)) continue;
       if(s.d < d1 || s.d > d2) continue;
       
       let sWd = -1;
       try{const p=s.d.split('-'); sWd=new Date(p[0],p[1]-1,p[2]).getDay();}catch(e){}
       
       let match = false;
       if(key === s._recId) match = true;
       else if(key.endsWith(`_${sWd}`) && key.includes(s.a) && key.includes(s.act)) match = true;
       
       if(match) {
         window.SCH.splice(i, 1);
         cRemoved++;
       }
     }
     
     let curParts = d1.split('-');
     let cur = new Date(curParts[0], curParts[1]-1, curParts[2]);
     let endParts = d2.split('-');
     let end = new Date(endParts[0], endParts[1]-1, endParts[2]);
     
     while(cur <= end) {
       if(cur.getDay() === newWd) {
         let mm = cur.getMonth()+1; if(mm<10) mm='0'+mm;
         let dd = cur.getDate(); if(dd<10) dd='0'+dd;
         const ds = `${cur.getFullYear()}-${mm}-${dd}`;
         
         const gblk = window.getGardenBlock ? window.getGardenBlock(tgt.g, ds) : null;
         if(!gblk) {
           window.SCH.push({
             id: Date.now() + Math.floor(Math.random()*10000) + tIdx + cAdded,
             g: tgt.g,
             a: newSup,
             act: newAct,
             t: tgt.t,
             d: ds,
             st: 'ok',
             _recId: newRecoups[tIdx]
           });
           cAdded++;
         }
       }
       cur.setDate(cur.getDate() + 1);
     }
  });

  window.saveAndRefresh('gm');
  window.showToast(`✅ תהליך הושלם!\nהוסרו ${cRemoved} מפגשים ישנים ושובצו ${cAdded} חדשים בסינרגיה.`);
};

// --- Cluster Bulk Edit Logic ---
function getClusterGlobalFieldsHtml() {
  return `
    <div style="background: #f8f9fa; border-radius: 8px; border: 1px solid #e0e0e0; padding: 10px; margin-bottom: 10px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.02);">
      <div style="font-weight: 700; font-size: 0.8rem; color: #1565c0; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 0.9rem;">🌐</span> פעולות גלובליות (הכל על המסומנים)
      </div>
      <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
        <div class="fg">
          <label style="font-size: 0.68rem; color: #546e7a; font-weight: 700; margin-bottom: 2px; display: block;">📅 תאריך</label>
          <input type="date" id="clbulk-new-date" style="width: 100%; padding: 5px; border-radius: 5px; border: 1.5px solid #cfd8dc; font-size: 0.8rem;">
        </div>
        <div class="fg">
          <label style="font-size: 0.68rem; color: #546e7a; font-weight: 700; margin-bottom: 2px; display: block;">🚀 ספק</label>
          <select id="clbulk-sup" style="width: 100%; padding: 5px; border-radius: 5px; border: 1.5px solid #cfd8dc; font-size: 0.8rem;"><option value="">ללא שינוי</option></select>
        </div>
        <div class="fg">
          <label style="font-size: 0.68rem; color: #546e7a; font-weight: 700; margin-bottom: 2px; display: block;">🎯 פעילות</label>
          <select id="clbulk-act" onchange="window.applyClBulkUniAct(this.value)" style="width: 100%; padding: 5px; border-radius: 5px; border: 1.5px solid #cfd8dc; font-size: 0.8rem;"><option value="">ללא שינוי</option></select>
        </div>
        <div class="fg">
          <label style="font-size: 0.68rem; color: #546e7a; font-weight: 700; margin-bottom: 2px; display: block;">📞 טלפון ספק</label>
          <input type="text" id="clbulk-ph" placeholder="ללא שינוי" style="width: 100%; padding: 5px; border-radius: 5px; border: 1.5px solid #cfd8dc; font-size: 0.8rem;">
        </div>
        <div class="fg">
          <label style="font-size: 0.68rem; color: #546e7a; font-weight: 700; margin-bottom: 2px; display: block;">📊 סוג</label>
          <select id="clbulk-uni-tp" onchange="window.applyClBulkUniTp(this.value)" style="width: 100%; padding: 5px; border-radius: 5px; border: 1.5px solid #cfd8dc; font-size: 0.8rem;">
            <option value="">ללא שינוי</option>
            <option value="חוג">חוג</option>
            <option value="צהרון">צהרון</option>
            <option value="בוקר">בוקר</option>
            <option value="השלמה">השלמה</option>
          </select>
        </div>
        <div class="fg">
          <label style="font-size: 0.68rem; color: #546e7a; font-weight: 700; margin-bottom: 2px; display: block;">⚡ סטטוס</label>
          <select id="clbulk-uni-st" onchange="window.applyClBulkUniStatus(this.value)" style="width: 100%; padding: 5px; border-radius: 5px; border: 1.5px solid #cfd8dc; font-size: 0.8rem;">
            <option value="">ללא שינוי</option>
            <option value="ok">✅ תקין</option>
            <option value="can">❌ בוטל</option>
            <option value="nohap">⚠️ לא התקיים</option>
          </select>
        </div>
        <div class="fg" style="grid-column: span 2;">
          <label style="font-size: 0.68rem; color: #546e7a; font-weight: 700; margin-bottom: 2px; display: block;">📝 הערה לכולם</label>
          <input type="text" id="clbulk-nt" placeholder="ללא שינוי" style="width: 100%; padding: 5px; border-radius: 5px; border: 1.5px solid #cfd8dc; font-size: 0.8rem;">
        </div>
      </div>
    </div>
  `;
}

window.openClusterBulkEdit = function(clId, ds) {
  console.log('openClusterBulkEdit called with:', clId, ds);
  window._clsId = clId;
  window._clBulkDate = ds;
  let cl = (typeof clusters !== 'undefined' ? clusters[clId] : null);
  if(!cl) {
    cl = (window.getClusters ? window.getClusters() : []).find(c => c.id === clId);
    if(cl) console.log('[BulkEdit] Cluster identified via fallback search:', clId);
    else console.warn('[BulkEdit] Cluster not found by ID:', clId);
  }

  (document.getElementById('sp-m-title')||{}).textContent = `✏️ עריכה מרוכזת: ${cl.name}`;
  
  let mainHtml = `
    <div style="padding: 10px 15px;">
      ${getClusterGlobalFieldsHtml()}
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <div style="font-weight: 800; font-size: 0.85rem; color: #37474f; display:flex; align-items: center; gap: 6px;">
          <span style="color: #1565c0;">🏡</span> פירוט גנים ושיבוצים
        </div>
        <div style="font-size: 0.7rem; color: #78909c;">
          סמן גנים לעדכון/הוספה | תאריך: ${window.fD(ds)}
        </div>
      </div>
      
      <div id="clbulk-list-header" style="display:grid; grid-template-columns: 30px 1fr 100px 100px 70px 80px 65px; gap: 6px; padding: 6px 10px; background: #eceff1; border-radius: 6px 6px 0 0; font-size: 0.68rem; font-weight: 800; color: #455a64; border: 1px solid #cfd8dc; border-bottom: none;">
        <span></span>
        <span>שם הצהרון</span>
        <span>ספק</span>
        <span>פעילות</span>
        <span>סוג</span>
        <span>סטטוס</span>
        <span>שעה</span>
      </div>
      <div id="clbulk-list" style="max-height: 350px; overflow-y: auto; overflow-x: hidden; border: 1px solid #cfd8dc; border-top: none; border-radius: 0 0 6px 6px; background: #fff;"></div>

      <div style="display:flex; gap:10px; justify-content: center; margin-top: 15px; padding-top: 10px; border-top: 1px solid #f0f0f0;">
        <button class="btn bs" onclick="CM('sp-m')" style="min-width: 100px; padding: 8px 15px; font-weight: 600; border: 1.5px solid #cfd8dc; font-size: 0.85rem;">ביטול</button>
        <button class="btn bp" onclick="window.saveClusterBulkEdit()" style="min-width: 200px; padding: 8px 20px; font-weight: 700; font-size: 0.9rem; box-shadow: 0 3px 10px rgba(21,101,192,0.2);">💾 שמור שינויים לכולם</button>
      </div>

      <div style="margin-top: 12px; padding-top: 8px; text-align: center; border-top: 1px dashed #e0e0e0;">
         <button class="btn br bsm" onclick="window.deleteClusterDay()" style="opacity: 0.7; padding: 6px 15px; font-size: 0.75rem;">🗑️ מחק את כל הפעילויות של האשכול להיום</button>
      </div>
    </div>
  `;
  
  const spBody = document.getElementById('sp-m-body');
  if(spBody) spBody.innerHTML = mainHtml;
  
  const supSel = document.getElementById('clbulk-sup');
  supSel.innerHTML = '<option value="">ללא שינוי</option>';
  [...new Set(window.SCH.map(s=>s.a))].sort().forEach(n=>{
    const disp = window.supNameLabel(n) !== n ? window.supNameLabel(n) + ' (' + n + ')' : n;
    supSel.innerHTML+=`<option value="${n}">${disp}</option>`;
  });
  window.SUPBASE.forEach(s=>{
    if(!document.querySelector(`#clbulk-sup option[value="${s.name}"]`)){
      const disp = window.supNameLabel(s.name) !== s.name ? window.supNameLabel(s.name) + ' (' + s.name + ')' : s.name;
      supSel.innerHTML+=`<option value="${s.name}">${disp}</option>`;
    }
  });
  
  document.getElementById('clbulk-ph').value = '';
  document.getElementById('clbulk-nt').value = '';
  if(document.getElementById('clbulk-uni-time')) document.getElementById('clbulk-uni-time').value = '';
  if(document.getElementById('clbulk-act')) document.getElementById('clbulk-act').value = '';
  if(document.getElementById('clbulk-uni-tp')) document.getElementById('clbulk-uni-tp').value = '';
  document.getElementById('clbulk-uni-st').value = '';
  if(document.getElementById('clbulk-new-date')) document.getElementById('clbulk-new-date').value = '';

  const allSupsHtml = supSel.innerHTML.replace('<option value="">ללא שינוי</option>', '<option value="">-- בחר ספק --</option>');

  const gs = (cl.gardenIds||[]).map(id=>window.G(id)).filter(x=>x.id);
  // Sort by time of existing activity, then by name
  gs.sort((a,b) => {
    const evA = window.SCH.find(s => s.g === a.id && s.d === ds && s.st !== 'can');
    const evB = window.SCH.find(s => s.g === b.id && s.d === ds && s.st !== 'can');
    const tA = (evA && evA.t) ? evA.t.replace(/[^\d:]/g,'').slice(0,5) : '99:99';
    const tB = (evB && evB.t) ? evB.t.replace(/[^\d:]/g,'').slice(0,5) : '99:99';
    return tA.localeCompare(tB) || a.name.localeCompare(b.name, 'he');
  });
  let h = '';
  gs.forEach(g => {
    const ev = window.SCH.find(s => s.g === g.id && s.d === ds && s.st !== 'can');
    h += `<div style="display:grid;grid-template-columns:30px 1fr 100px 100px 70px 80px 65px;gap:6px;align-items:center;padding:5px 10px;border-bottom:1px solid #f0f0f0;font-size:.8rem; transition: background 0.2s;" onmouseover="this.style.background='#fcfdfe'" onmouseout="this.style.background='transparent'">
      <label style="display:flex;align-items:center;justify-content:center;cursor:pointer">
        <input type="checkbox" id="clbulk-inc-${g.id}" checked style="width:15px;height:15px;accent-color:#1565c0">
      </label>
      <span style="font-weight:700;color:#2c3e50;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${g.name}">${g.name}</span>
      <select id="clbulk-s-${g.id}" style="font-size:.78rem;padding:4px;border-radius:4px;border:1px solid #cfd8dc" onchange="window.clBulkSupChg('${g.id}', this.value)">
        ${allSupsHtml}
      </select>
      <select id="clbulk-act-${g.id}" style="font-size:.78rem;padding:4px;border-radius:4px;border:1px solid #cfd8dc">
        <option value="">-- פעילות --</option>
      </select>
      <select id="clbulk-tp-${g.id}" style="font-size:.78rem;padding:4px;border-radius:4px;border:1px solid #cfd8dc">
        <option value="">-- סוג --</option>
        <option value="חוג">חוג</option>
        <option value="צהרון">צהרון</option>
        <option value="בוקר">בוקר</option>
        <option value="השלמה">השלמה</option>
      </select>
      <select id="clbulk-st-${g.id}" style="font-size:.78rem;padding:4px;border-radius:4px;border:1px solid #cfd8dc">
        <option value="ok">✅ תקין</option>
        <option value="can">❌ בוטל</option>
        <option value="nohap">⚠️ לא התקיים</option>
      </select>
      <input type="time" id="clbulk-t-${g.id}" value="${ev?window.fT(ev.t):''}" style="padding:3px;font-size:.78rem;border-radius:4px;border:1px solid #cfd8dc">
    </div>`;
  });
  document.getElementById('clbulk-list').innerHTML = h || '<p style="color:#999;padding:20px;text-align:center">אין גנים באשכול זה</p>';

  // Pre-fill existing
  gs.forEach(g => {
    const ev = window.SCH.find(s => s.g === g.id && s.d === ds && s.st !== 'can');
    if(ev) {
       const sEl = document.getElementById(`clbulk-s-${g.id}`);
       if(sEl) {
         sEl.value = ev.a || '';
         window.clBulkSupChg(g.id, ev.a, ev.act);
       }
       if(document.getElementById(`clbulk-tp-${g.id}`)) document.getElementById(`clbulk-tp-${g.id}`).value = ev.tp || 'חוג';
       if(document.getElementById(`clbulk-st-${g.id}`)) document.getElementById(`clbulk-st-${g.id}`).value = ev.st || 'ok';
    }
  });

  supSel.onchange = function() {
    const supName = this.value;
    // 1. Phone Lookup (Official helper + robust fallback)
    if(typeof window.getSupPhone === 'function') {
       document.getElementById('clbulk-ph').value = window.getSupPhone(supName);
    } else {
       const base = window.supBase ? window.supBase(supName) : supName;
       const s = window.SUPBASE.find(x => (window.supBase ? window.supBase(x.name) : x.name) === base);
       if(s && s.phone) document.getElementById('clbulk-ph').value = s.phone;
       else {
         const evPh = window.SCH.find(x => x.a === supName && x.p);
         if(evPh) document.getElementById('clbulk-ph').value = evPh.p;
       }
    }
    window.applyClBulkUniSup(supName);
    
    // 2. Global Activity dropdown (Robust matching)
    const actSel = document.getElementById('clbulk-act');
    if(actSel) {
      actSel.innerHTML = '<option value="">ללא שינוי</option>';
      if(supName) {
        const base = window.supBase ? window.supBase(supName) : supName;
        const su = window.SUPBASE.find(x => (window.supBase ? window.supBase(x.name) : x.name) === base);
        const acts = su ? (su.acts || []) : [];
        if(!acts.length) {
           const sActs = [...new Set(window.SCH.filter(x => (window.supBase ? window.supBase(x.a) : x.a) === base && x.act).map(x=>x.act))].sort();
           sActs.forEach(a => actSel.innerHTML += `<option value="${a}">${a}</option>`);
        } else {
           acts.forEach(a => actSel.innerHTML += `<option value="${a.name || a}">${a.name || a}</option>`);
        }
      }
    }
  };

  OM('sp-m');
};

window.applyClBulkUniTime = function(t) {
  const cl = (typeof clusters !== 'undefined' ? clusters[window._clsId] : null) || (window.getClusters ? window.getClusters().find(c => c.id === window._clsId) : null);
  if(!cl) return;
  cl.gardenIds.forEach(gid => {
    const el = document.getElementById(`clbulk-t-${gid}`);
    if(el) el.value = t;
  });
};

window.applyClBulkUniSup = function(sup) {
  const cl = (typeof clusters !== 'undefined' ? clusters[window._clsId] : null) || (window.getClusters ? window.getClusters().find(c => c.id === window._clsId) : null);
  console.log('applyClBulkUniSup:', sup, 'Cluster found:', cl ? cl.name : 'NO');
  if(!cl || !sup) return;
  cl.gardenIds.forEach(gid => {
    const el = document.getElementById(`clbulk-s-${gid}`);
    if(el) {
       el.value = sup;
       window.clBulkSupChg(gid, sup);
    }
  });
};

window.applyClBulkUniTp = function(tp) {
  const cl = (typeof clusters !== 'undefined' ? clusters[window._clsId] : null) || (window.getClusters ? window.getClusters().find(c => c.id === window._clsId) : null);
  if(!cl || !tp) return;
  cl.gardenIds.forEach(gid => {
    const el = document.getElementById(`clbulk-tp-${gid}`);
    if(el) el.value = tp;
  });
};

window.applyClBulkUniAct = function(act) {
  const cl = (typeof clusters !== 'undefined' ? clusters[window._clsId] : null) || (window.getClusters ? window.getClusters().find(c => c.id === window._clsId) : null);
  if(!cl || !act) return;
  cl.gardenIds.forEach(gid => {
    const el = document.getElementById(`clbulk-act-${gid}`);
    if(el) el.value = act;
  });
};

window.applyClBulkUniStatus = function(st) {
  const cl = (typeof clusters !== 'undefined' ? clusters[window._clsId] : null) || (window.getClusters ? window.getClusters().find(c => c.id === window._clsId) : null);
  if(!cl || !st) return;
  cl.gardenIds.forEach(gid => {
    const el = document.getElementById(`clbulk-st-${gid}`);
    if(el) el.value = st;
  });
};

window.clBulkSupChg = function(gid, supName, selAct) {
  const actSel = document.getElementById(`clbulk-act-${gid}`);
  if(!actSel) return;
  actSel.innerHTML = '<option value="">-- פעילות --</option>';
  if(!supName) return;
  
  const base = window.supBase ? window.supBase(supName) : supName;
  const su = window.SUPBASE.find(s => (window.supBase ? window.supBase(s.name) : s.name) === base);
  const acts = su ? (su.acts || []) : [];
  if(!acts.length) {
     const sActs = [...new Set(window.SCH.filter(x => (window.supBase ? window.supBase(x.a) : x.a) === base && x.act).map(x=>x.act))].sort();
     sActs.forEach(a => actSel.innerHTML += `<option value="${a}">${a}</option>`);
  } else {
     acts.forEach(a => actSel.innerHTML += `<option value="${a.name || a}">${a.name || a}</option>`);
  }
  if(selAct) actSel.value = selAct;
};

window.saveClusterBulkEdit = function() {
  console.log('--- saveClusterBulkEdit Execution Start ---');
  let cl = (typeof clusters !== 'undefined' ? clusters[window._clsId] : null);
  if(!cl && window.getClusters) {
     const allCl = window.getClusters();
     cl = allCl.find(c => c.id === window._clsId || c.name === window._clsId);
     if(!cl && window._clsId.includes('_')) {
        // Very aggressive fallback: match by last segment of ID if it's like cl_city_-_9
        const parts = window._clsId.split('_');
        const lastPart = parts[parts.length-1];
        cl = allCl.find(c => c.id.endsWith('_' + lastPart) || c.name.endsWith(' ' + lastPart));
     }
  }
  
  const ds = window._clBulkDate;
  console.log('Target Cluster:', cl ? cl.name : 'NOT FOUND', 'ID:', window._clsId, 'Date:', ds);
  
  if(!cl || !ds) {
    console.error('Critical Error: Cluster or Date missing from context.');
    if(window.showToast) window.showToast('⚠️ שגיאה: נתוני אשכול חסרים. נסה לרענן.');
    return;
  }

  const newDate = document.getElementById('clbulk-new-date').value;
  const globalSup = document.getElementById('clbulk-sup').value;
  const globalPh = document.getElementById('clbulk-ph').value;
  const globalNt = document.getElementById('clbulk-nt').value;
  console.log('Input Parameters:', {newDate, globalSup, globalPh, globalNt});

  let updated = 0, added = 0;
  cl.gardenIds.forEach(gid => {
    const inc = document.getElementById(`clbulk-inc-${gid}`);
    if(!inc || !inc.checked) return;

    const rowSup = document.getElementById(`clbulk-s-${gid}`).value || globalSup;
    const rowAct = document.getElementById(`clbulk-act-${gid}`).value;
    const rowTp = document.getElementById(`clbulk-tp-${gid}`).value || (document.getElementById('clbulk-uni-tp') ? document.getElementById('clbulk-uni-tp').value : '');
    const rowSt = document.getElementById(`clbulk-st-${gid}`).value;
    const t = document.getElementById(`clbulk-t-${gid}`)?.value || '';
    
    if(!rowSup) {
      console.warn(`Skipping garden ${gid}: No Supplier selected.`);
      return; 
    }

    const ev = window.SCH.find(s => s.g === gid && s.d === ds && s.st !== 'can');

    if(ev) {
      console.log(`Updating existing event for garden ${gid}`);
      if(newDate) ev.d = newDate;
      ev.a = rowSup;
      if(rowAct) ev.act = rowAct;
      if(rowTp) ev.tp = rowTp;
      if(rowSt) ev.st = rowSt;
      if(globalPh) ev.p = globalPh;
      if(globalNt) ev.nt = (ev.nt ? ev.nt + ' | ' : '') + globalNt;
      if(t) ev.t = t;
      updated++;
    } else {
      console.log(`Creating NEW event for garden ${gid}`);
      window.SCH.push({
        id: `IMP_${Date.now()}_${gid}_${Math.floor(Math.random()*100)}`,
        g: gid, d: newDate || ds, a: rowSup, act: rowAct, tp: rowTp, st: rowSt || 'ok', t: t, p: globalPh, nt: globalNt, grp: 1
      });
      added++;
    }
  });

  console.log(`Syncing to Firebase. Updated: ${updated}, Added: ${added}`);
  window.save(true); // Force immediate Firebase sync
  
  try {
    console.log('Triggering UI Refresh...');
    if(typeof window.refresh === 'function') window.refresh();
    else if(typeof window.renderCal === 'function') window.renderCal();
    else if(typeof window.renderDash === 'function') window.renderDash();
  } catch(e) {
    console.error('UI Refresh failed:', e);
  }
  
  window.CM('sp-m');
  if(window.showToast) {
    window.showToast(`✅ עודכנו ${updated} פעילויות${added ? ' ונוספו '+added : ''}`);
  }
  console.log('--- saveClusterBulkEdit Execution Finished ---');
};

window.deleteClusterDay = function() {
  const cl = clusters[window._clsId];
  const ds = window._clBulkDate;
  if(!cl || !ds) return;

  if(!confirm(`למחוק את כל הפעילויות של אשכול "${cl.name}" בתאריך ${window.fD(ds)}?`)) return;

  let deleted = 0;
  for(let i = window.SCH.length-1; i >= 0; i--) {
    const s = window.SCH[i];
    if(s.d === ds && cl.gardenIds.includes(s.g)) {
      window.SCH.splice(i, 1);
      deleted++;
    }
  }

  window.save();
  window.refresh();
  window.CM('sp-m');
  window.showToast(`🗑️ נמחקו ${deleted} פעילויות`);
};

window.exportSingleRecurringWA = function(sid) {
  const s = window.SCH.find(x => x.id === sid);
  if (!s) return;
  const g = window.G(s.g);
  const pair = window.gardenPair(s.g);
  const gids = pair ? pair.ids.map(Number) : [Number(s.g)];

  // Find all matching activities on this date
  const rel = window.SCH.filter(x => x.d === s.d && gids.includes(Number(x.g)) && x.a === s.a && x.st === 'ok');

  const dow = new Date(s.d).getDay();
  const daysHe = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const dayName = daysHe[dow] || window.dayN(s.d);

  let text = `🗓️ יום ${dayName}\n`;

  const actLabel = s.act || window.supAct(s.a) || '';
  const supPhone = (typeof window.getSupPhone === 'function' ? window.getSupPhone(s.a) : '') || (SUPBASE.find(sb => sb.name === s.a) || {}).phone || '';
  const supLine = `📚 ${window.supDisplayName(window.supBase(s.a))}${actLabel ? ' - ' + actLabel : ''}${supPhone ? ' · 📞 ' + supPhone : ''}`;
  text += `${supLine}\n`;
  text += `📍 ${g.city || ''}\n`;

  const addrs = [...new Set(rel.map(x => window.G(x.g).st || ''))].filter(Boolean);
  const sameAddr = addrs.length === 1 && rel.every(x => window.G(x.g).st === addrs[0]);

  if (sameAddr && addrs[0]) {
    text += `  📍 ${addrs[0]}\n`;
    rel.forEach(x => {
      const gardenName = window.G(x.g).name;
      text += `     🏫 ${gardenName}${x.t ? ' · ⏰ ' + window.fT(x.t) : ''}\n`;
    });
  } else {
    rel.forEach(x => {
      const gd = window.G(x.g);
      const addr = gd.st ? `📍 ${gd.st} · ` : '';
      text += `  🏫 ${addr}${gd.name}${x.t ? ' · ⏰ ' + window.fT(x.t) : ''}\n`;
    });
  }

  navigator.clipboard.writeText(text).then(() => {
    if (typeof window.showToast === 'function') window.showToast('✅ ההודעה הועתקה ללוח!');
    else alert('✅ ההודעה הועתקה ללוח:\n\n' + text);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (typeof window.showToast === 'function') window.showToast('✅ ההודעה הועתקה ללוח!');
    else alert('✅ ההודעה הועתקה ללוח:\n\n' + text);
  });
};

window.exportRecurringWA = function(key, gid) {
  const g = window.G(gid);
  const pair = window.gardenPair(gid);
  const gids = pair ? pair.ids.map(Number) : [Number(gid)];

  const evs = window.SCH.filter(s => Number(s.g) === Number(gid) && s.d >= window.td() && s.st !== 'can');
  const seriesMap = {};
  evs.forEach(s => {
    if(s.st !== 'ok') return;
    let wd = -1;
    try { const p=s.d.split('-'); wd=new Date(p[0],parseInt(p[1])-1,p[2]).getDay(); } catch(e){}
    if(wd === -1) return;
    const k = s._recId || `${s.a}_${s.act}_${wd}`;
    if (k === key) {
      seriesMap[k] = { a: s.a, act: s.act, wd: wd, t: s.t };
    }
  });

  const sr = seriesMap[key];
  if (!sr) {
    alert('לא נמצא מידע על פעילות זו');
    return;
  }

  const daysHe = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const dayName = daysHe[sr.wd];

  let text = `🗓️ יום ${dayName}\n`;

  const actLabel = sr.act || window.supAct(sr.a) || '';
  const supPhone = (typeof window.getSupPhone === 'function' ? window.getSupPhone(sr.a) : '') || (SUPBASE.find(sb => sb.name === sr.a) || {}).phone || '';
  const supLine = `📚 ${window.supDisplayName(window.supBase(sr.a))}${actLabel ? ' - ' + actLabel : ''}${supPhone ? ' · 📞 ' + supPhone : ''}`;
  text += `${supLine}\n`;
  text += `📍 ${g.city || ''}\n`;

  const group = [];
  gids.forEach(id => {
    const garden = window.G(id);
    const pEvs = window.SCH.filter(ps => Number(ps.g) === id && ps.st === 'ok' && ps.a === sr.a && ps.d >= window.td());
    let matchEv = null;
    pEvs.forEach(ps => {
      let pwd = -1;
      try { const p=ps.d.split('-'); pwd=new Date(p[0],parseInt(p[1])-1,p[2]).getDay(); } catch(e){}
      if (pwd === sr.wd) {
        matchEv = ps;
      }
    });

    if (matchEv) {
      group.push({ gd: garden, t: matchEv.t });
    } else if (id === Number(gid)) {
      group.push({ gd: g, t: sr.t });
    }
  });

  const addrs = [...new Set(group.map(s => s.gd.st || ''))].filter(Boolean);
  const sameAddr = addrs.length === 1 && group.every(s => s.gd.st === addrs[0]);

  if (sameAddr && addrs[0]) {
    text += `  📍 ${addrs[0]}\n`;
    group.forEach(s => {
      text += `     🏫 ${s.gd.name}${s.t ? ' · ⏰ ' + window.fT(s.t) : ''}\n`;
    });
  } else {
    group.forEach(s => {
      const addr = s.gd.st ? `📍 ${s.gd.st} · ` : '';
      text += `  🏫 ${addr}${s.gd.name}${s.t ? ' · ⏰ ' + window.fT(s.t) : ''}\n`;
    });
  }

  navigator.clipboard.writeText(text).then(() => {
    if (typeof window.showToast === 'function') window.showToast('✅ ההודעה הועתקה ללוח!');
    else alert('✅ ההודעה הועתקה ללוח:\n\n' + text);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (typeof window.showToast === 'function') window.showToast('✅ ההודעה הועתקה ללוח!');
    else alert('✅ ההודעה הועתקה ללוח:\n\n' + text);
  });
};
