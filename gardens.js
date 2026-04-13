function renderGardens(){
  if(_gardensTab==='fixed'){ renderGardensFixed(); return; }
  // Sync g-cls from active tab if not overridden
  const gClsEl=document.getElementById('g-cls');
  if(gClsEl&&!gClsEl.value) gClsEl.value=_gardensTab==='sch'?'ביה"ס':'גנים';
  const city=document.getElementById('g-city').value;
  const cls=document.getElementById('g-cls').value;
  const cl=document.getElementById('g-cl').value;
  const srch=document.getElementById('g-srch').value.toLowerCase();
  const mgrF=(document.getElementById('g-mgr')||{}).value||'';
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
    h+=`<div style="margin-bottom:16px">
      <div style="font-weight:800;color:#1a237e;font-size:.85rem;padding:6px 10px;background:#e8eaf6;border-radius:6px;margin-bottom:8px">🏙️ ${cityKey}</div>`;
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
            <div style="font-weight:700;color:#1a237e;margin-bottom:3px;flex:1">${gd.name||g.name}</div>
            <button onclick="event.stopPropagation();openGardenEdit(${g.id})" style="background:none;border:none;cursor:pointer;font-size:.7rem;color:#90a4ae;padding:0 2px" title="ערוך כרטיס גן">✏️</button>
          </div>
          ${(gd.st||g.st)?`<div style="font-size:.73rem;color:#666" onclick="event.stopPropagation()">📍 <a href="https://maps.google.com/?q=${encodeURIComponent((gd.st||g.st)+' '+g.city)}" target="_blank" style="color:#1565c0;text-decoration:underline">${gd.st||g.st}</a></div>`:''}
          ${ gd.phone?`<div style="font-size:.72rem;color:#2e7d32;font-weight:600">📞 ${gd.phone}</div>`:''}
          ${mgr?`<div style="font-size:.7rem;color:#1565c0;border-top:1px solid #e8eaf6;margin-top:4px;padding-top:3px">${mgr.role==='manager'?'🏛️':'👤'} ${mgr.name}${mgr.phone?' · 📞 '+mgr.phone:''}</div>`:''}
          ${window.gardenClusters(g.id).length?`<div style="font-size:.71rem;color:#6a1b9a">🔢 ${window.gardenClusters(g.id).map(c=>c.name).join(', ')}</div>`:''}
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:5px">
            ${pair
              ?`<span style="font-size:.7rem;color:#2e7d32;font-weight:700">🔗 ${pair.name}</span>`
              :`<button class="btn bg bsm" style="font-size:.63rem;padding:1px 6px" onclick="event.stopPropagation();quickAddPartner(${g.id})">➕ בן זוג</button>`
            }
            <span style="font-size:.7rem;color:#1565c0">📅 ${cnt}</span>
          </div>
        </div>`;
      });
      h+='</div>';
    });
    h+='</div>';
  });
  document.getElementById('g-body').innerHTML=h||'<p style="color:#999">לא נמצאו צהרונים</p>';
  setTimeout(window._fitScrollAreas,50);
}

function openGmExport(){
  if(!window.gmGid)return;
  const gids=window.gardenPair(window.gmGid)?window.gardenPair(window.gmGid).ids:[window.gmGid];
  window._exGids=gids;
  const ws=window.monStart(window.gmD);
  const fDs=window.gmV==='day'?window.d2s(window.gmD):window.gmV==='week'?window.d2s(ws):window.d2s(new Date(window.gmD.getFullYear(),window.gmD.getMonth(),1));
  const tDs=window.gmV==='day'?window.d2s(window.gmD):window.gmV==='week'?window.d2s(window.addD(ws,5)):window.d2s(new Date(window.gmD.getFullYear(),window.gmD.getMonth()+1,0));
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
  ['day','week','month'].forEach(x=>document.getElementById('gvb-'+x).classList.toggle('active',x===v));
  renderGM();
}
function gmNav(d){
  if(window.gmV==='day') window.gmD=window.addD(window.gmD,d);
  else if(window.gmV==='week') window.gmD=window.addD(window.gmD,d*7);
  else window.gmD=window.addM(window.gmD,d);
  renderGM();
}
function renderGmCal(){ renderGM(); }

function renderGM(){
  const gid=window.gmGid;let from,to,title;
  if(window.gmV==='day'){from=to=window.d2s(window.gmD);title=`${window.fD(from)} - יום ${window.dayN(from)}`;}
  else if(window.gmV==='week'){const ws=window.monStart(window.gmD);from=window.d2s(ws);to=window.d2s(window.addD(ws,5));title=`${window.fD(from)} – ${window.fD(to)}`;}
  else{const y=window.gmD.getFullYear(),m=window.gmD.getMonth();from=window.d2s(new Date(y,m,1));to=window.d2s(new Date(y,m+1,0));title=window.hebM(window.gmD);}
  (document.getElementById('gm-per')||{}).textContent =title;
  const evs=window.SCH.filter(s=>s.g===gid&&s.d>=from&&s.d<=to).sort((a,b)=>a.d.localeCompare(b.d)||(a.t||'').localeCompare(b.t||''));
  if(!evs.length){document.getElementById('gm-cal').innerHTML='<p style="color:#999;text-align:center;padding:18px">אין פעילויות</p>';return;}
  if(window.gmV==='month'){document.getElementById('gm-cal').innerHTML=window.renderMonth(evs,window.gmD);return;}
  let h='<div class="tw"><table><thead><tr><th>תאריך</th><th>יום</th><th>ספק</th><th>שעה</th><th>הערות</th><th>סטטוס</th></tr></thead><tbody>';
  evs.forEach(s=>{
    const g=window.G(s.g);
    const gblk=window.getGardenBlock(s.g,s.d);
    h+=`<tr onclick="window.openSP(${s.id})" class="${window.stClass(s)}"><td>${window.fD(s.d)}</td><td>יום ${window.dayN(s.d)}</td><td>${s.a}</td><td>${window.fT(s.t)}</td><td>${gblk?`<span style="color:#c62828;font-size:.72rem">${gblk.icon||'🚫'} ${gblk.reason}</span>${s.nt?' | '+s.nt:''}`:s.nt||''}</td><td>${window.stLabel(s)}</td></tr>`;
  });
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
  const cityFilt=(document.getElementById('pairs-city')||{}).value||'';
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
    const clr=window.CITY_COLORS(city);
    h+=`<div style="margin-bottom:18px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:7px 11px;background:${clr.light};border-radius:8px;border-right:3px solid ${clr.solid}">
        <span style="font-weight:800;color:${clr.solid};font-size:.85rem">🏙️ ${city}</span>
        <span style="font-size:.72rem;color:${clr.solid};opacity:.75">${byCity[city].length} זוגות/שלישיות</span>
      </div>`;
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
    h+='</div>';
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
  if(isEdit){
    window.pairs[window.editPairIdx]={...window.pairs[window.editPairIdx],ids,name:nm};
  } else {
    window.pairs.push({id:Date.now(),ids,name:nm});
  }
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
    const el=document.getElementById(id);
    if(!el) return;
    el.innerHTML='<option value="">הכל</option><option value="__all__">🔢 כל האשכולות</option>';
    getClusters().forEach(cl=>el.innerHTML+=`<option value='${cl.name}'>${cl.name}</option>`);
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
  if(!pairId){document.getElementById('cal-g1').value='';document.getElementById('cal-g2').value='';document.getElementById('cal-g3').value='';renderCal();return;}
  const pair=pairs.find(p=>p.id===pairId);
  if(!pair) return;
  document.getElementById('cal-g1').value=pair.ids[0]||'';
  document.getElementById('cal-g2').value=pair.ids[1]||'';
  document.getElementById('cal-g3').value=pair.ids[2]||'';
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
            <button class="btn bo bsm" onclick="openEditCluster('${cl.id}')" title="עריכת הגדרות האשכול">✏️ עריכה</button>
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
      h+=`<div style="margin-bottom:16px">
        <div style="font-weight:800;color:#1a237e;font-size:.85rem;padding:6px 10px;background:#e8eaf6;border-radius:6px;margin-bottom:8px">🏙️ ${city}</div>
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
      h+='</div></div>';
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
  [...new Set(SCH.map(s=>s.a))].sort().forEach(n=>document.getElementById('cls-sup').innerHTML+=`<option value="${n}">${n}</option>`);
  SUPBASE.forEach(s=>{if(!document.querySelector(`#cls-sup option[value="${s.name}"]`)) document.getElementById('cls-sup').innerHTML+=`<option value="${s.name}">${s.name}</option>`;});
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
  _exGids = Array.isArray(gids) ? gids : JSON.parse(gids);
  _exIsM = isM;
  if(ds) calD = s2d(ds);
  openExport();
}

function _exportPairWA(gids, isM){
  _exGids = Array.isArray(gids)?gids:JSON.parse(gids);
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
  const ws=monStart(calD);
  const fromDs=calV==='week'?d2s(ws):calV==='day'?d2s(calD):d2s(new Date(calD.getFullYear(),calD.getMonth(),1));
  const toDs=calV==='week'?d2s(addD(ws,5)):calV==='day'?d2s(calD):d2s(new Date(calD.getFullYear(),calD.getMonth()+1,0));
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
  const ws=monStart(calD), we=addD(ws,5);
  const isWeek=(calV==='week');
  const todayStr=d2s(calD);
  document.getElementById('ex-d1').value=isWeek?d2s(ws):todayStr;
  document.getElementById('ex-d2').value=isWeek?d2s(we):todayStr;
  const f=getCalF();
  const gids=_exGids||f.gids;
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
  const f=getCalF();
  const gids=_exGids||f.gids;
  _exGids=null;
  const isM_flag = _exIsM;
  _exIsM = false;
  const rel=SCH.filter(s=>s.d>=from&&s.d<=to&&(!gidsStr||gidsStr.includes(String(s.g))))
    .sort((a,b)=>a.d.localeCompare(b.d)||(a.t||'99').localeCompare(b.t||'99'));
  const relActive=rel.filter(s=>s.st!=='can');
  if(!rel.length){(document.getElementById('ex-prev')||{}).textContent='אין פעילויות';return;}
  const byDate={};rel.forEach(s=>{if(!byDate[s.d])byDate[s.d]=[];byDate[s.d].push(s);});
  let text='';
  const dates=Object.keys(byDate).sort();
  dates.forEach((date,di)=>{
    text+=`📅 ${fD(date)} - יום ${dayN(date)}${isM_flag ? ' (השלמה)' : ''}\n━━━━━━━━━━━━━━━━\n`;
    const byCity={};
    byDate[date].forEach(s=>{
      const g=G(s.g);const c=g.city||'';
      if(!byCity[c])byCity[c]=[];
      byCity[c].push({...s,gd:g});
    });
    Object.keys(byCity).sort().forEach(c=>{
      if(fmt==='full'){
        text+=`🏙️ ${c}\n`;
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
            const supLine=`📚 ${supDisplayName(supBase(s0.a))}${actLabel?' - '+actLabel:''}${s0.p?' · 📞 '+s0.p:''}`;
            const addrs=[...new Set(group.map(s=>s.gd.st||''))];
            const sameAddr=addrs.length===1&&addrs[0];
            if(sameAddr){
              text+=`${supLine}\n  🏫 ${addrs[0]}\n`;
              group.forEach(s=>{ 
                const mTag = (s._makeupFrom || (s.nt && s.nt.includes('השלמה'))) ? '*השלמה* ' : '';
                text+=`     ${s.st==='can'?'❌ ':s.st==='nohap'?'⚠️ ':''}${mTag}${s.gd.name}${s.t?' · ⏰ '+fT(s.t):''}\n`; 
              });
            } else {
              text+=`${supLine}\n`;
              group.forEach(s=>{
                const mTag = (s._makeupFrom || (s.nt && s.nt.includes('השלמה'))) ? '*השלמה* ' : '';
                const addr=s.gd.st?`🏫 ${s.gd.st} · `:'  ';
                text+=`  ${s.st==='can'?'❌ ':s.st==='nohap'?'⚠️ ':'  '}${mTag}${addr}${s.gd.name}${s.st==='can'?' (בוטל)':s.st==='nohap'?' (לא התקיים)':''} ${s.t?' · ⏰ '+fT(s.t):''}\n`;
              });
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
            const supLine=`📚 ${supDisplayName(supBase(s0.a))}${actLabel?' - '+actLabel:''}${s0.p?' · 📞 '+s0.p:''}`;
            const addrs=[...new Set(group.map(s=>s.gd.st||''))];
            const sameAddr=addrs.length===1&&addrs[0];
            if(sameAddr){
              text+=`${supLine}\n  🏫 ${addrs[0]}\n`;
              group.forEach(s=>{ 
                const mTag = (s._makeupFrom || (s.nt && s.nt.includes('השלמה'))) ? '*השלמה* ' : '';
                text+=`     ${s.st==='can'?'❌ ':s.st==='nohap'?'⚠️ ':''}${mTag}${s.gd.name}${s.t?' · ⏰ '+fT(s.t):''}${s.st==='can'?' (בוטל)':s.st==='nohap'?' (לא התקיים)':''}\n`; 
              });
            } else {
              text+=`${supLine}\n`;
              group.forEach(s=>{
                const mTag = (s._makeupFrom || (s.nt && s.nt.includes('השלמה'))) ? '*השלמה* ' : '';
                const addr=s.gd.st?`🏫 ${s.gd.st} · `:'  ';
                text+=`  ${mTag}${addr}${s.gd.name}${s.t?' · ⏰ '+fT(s.t):''}\n`;
              });
            }
            text+='\n';
          });
        }
      } else {
        byCity[c].forEach(s=>{
          const mTag = (s._makeupFrom || (s.nt && s.nt.includes('השלמה'))) ? '*השלמה* ' : '';
          text+=`${s.st==='can'?'❌ ':s.st==='nohap'?'⚠️ ':''}${mTag}${s.gd.name}${s.t?' '+fT(s.t):''} - ${s.a}${s.st==='can'?' (בוטל)':s.st==='nohap'?' (לא התקיים)':''}\n`;
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
  navigator.clipboard.writeText(t).then(()=>alert('✅ הועתק!')).catch(()=>{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);alert('✅ הועתק!');});
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
