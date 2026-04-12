function calRefG(){
  // Ensure cal-cls matches the active tab
  const clsSel=document.getElementById('cal-cls');
  if(clsSel&&_calTab) clsSel.value=_calTab==='g'?'גנים':'ביה"ס';
  const city=document.getElementById('cal-city').value;
  const cls=document.getElementById('cal-cls').value;
  const gs=gByCF(city,cls).sort((a,b)=>{
    if(!city){const cc=(a.city||'').localeCompare(b.city||'','he');if(cc)return cc;}
    return (a.name||'').localeCompare(b.name||'','he');
  });
  ['cal-g1','cal-g2','cal-g3'].forEach((id,i)=>{
    const sel=document.getElementById(id);
    sel.innerHTML=i===0?'<option value="">כל הצהרונים</option>':'<option value="">—</option>';
    gs.forEach(g=>sel.innerHTML+=`<option value="${g.id}">${city?g.name:g.city+' · '+g.name}</option>`);
  });
  renderCal();
}
function getCalGids(){
  return[parseInt(document.getElementById('cal-g1').value)||null,parseInt(document.getElementById('cal-g2').value)||null,parseInt(document.getElementById('cal-g3').value)||null].filter(Boolean);
}
function getCalF(){
  const gids=getCalGids();
  return{gids:gids.length?gids:null,city:document.getElementById('cal-city').value,cls:document.getElementById('cal-cls').value,cluster:document.getElementById('cal-cl').value,sup:document.getElementById('cal-sup').value};
}
function filterE(f,from,to){
  const all=SCH.filter(s=>{
    if(s.d<from||s.d>to) return false;
    const g=G(s.g);
    if(f.city&&g.city!==f.city) return false;
    if(f.cluster){
      if(f.cluster==='__all__'){
        // only show gardens that belong to at least one cluster
        const allClusterGids=new Set(getClusters().flatMap(c=>c.gardenIds||[]));
        if(!allClusterGids.has(s.g)) return false;
      } else {
        const cl=getClusters().find(c=>c.name===f.cluster);
        if(!cl||(!(cl.gardenIds||[]).map(Number).includes(Number(s.g)))) return false;
      }
    }
    if(f.cls&&gcls(g)!==f.cls) return false;
    if(f.gids&&!f.gids.includes(s.g)) return false;
    if(f.sup && supBase(s.a) !== f.sup && s.a !== f.sup) return false;
    return true;
  });
  const posted=SCH.filter(s=>{
    if(s.st!=='post'||!s.pd||s.pd<from||s.pd>to) return false;
    const g=G(s.g);
    if(f.city&&g.city!==f.city) return false;
    if(f.gids&&!f.gids.includes(s.g)) return false;
    return true;
  }).map(s=>({...s,d:s.pd,_isPostponed:true}));
  return [...all,...posted];
}
let _rangeSubView = 'cal'; // 'cal' | 'list'
let _listSubView='week'; // 'day'|'week'|'month' — sub-view when calV==='list'

function setListSubView(v){
  _listSubView=v;
  ['day','week','month'].forEach(x=>document.getElementById('vlb-'+x)?.classList.toggle('active',x===v));
  renderCal();
}

function setRangeSubView(v){
  _rangeSubView = v;
  document.getElementById('vb-range-cal')?.classList.toggle('active', v==='cal');
  document.getElementById('vb-range-list')?.classList.toggle('active', v==='list');
  renderCal();
}

function setView(v){
  calV=v;
  _rangeSubView='cal';
  ['day','week','month','list','range'].forEach(x=>{
    const el=document.getElementById('vb-'+x);
    if(el) el.classList.toggle('active',x===v);
  });
  const rangeRow = document.getElementById('cal-range-row');
  const listRow  = document.getElementById('cal-list-row');
  const navBtns  = document.querySelectorAll('[onclick="navCal(-1)"],[onclick="navCal(1)"]');
  if(v==='range'){
    if(rangeRow) rangeRow.style.display='flex';
    if(listRow)  listRow.style.display='none';
    navBtns.forEach(b=>b.style.display='none');
    const f=document.getElementById('cal-range-from');
    const t=document.getElementById('cal-range-to');
    if(f&&!f.value) f.value=d2s(monStart(calD));
    if(t&&!t.value) t.value=d2s(addD(monStart(calD),6));
  } else if(v==='list'){
    if(rangeRow) rangeRow.style.display='none';
    if(listRow)  listRow.style.display='flex';
    navBtns.forEach(b=>b.style.display='');
  } else {
    if(rangeRow) rangeRow.style.display='none';
    if(listRow)  listRow.style.display='none';
    navBtns.forEach(b=>b.style.display='');
  }
  renderCal();
}
function navCal(d){
  if(calV==='day') calD=addD(calD,d);
  else if(calV==='week') calD=addD(calD,d*5); // 5-day work week (Sun–Thu)
  else if(calV==='list'){
    const lsv=_listSubView||'week';
    if(lsv==='day') calD=addD(calD,d);
    else if(lsv==='week') calD=addD(calD,d*5); // 5 work days
    else calD=addM(calD,d);
  }
  else calD=addM(calD,d);
  renderCal();
}
function goToday(){calD=new Date();document.getElementById('cal-dp').value=td();renderCal();}
function goDate(s){if(s){calD=s2d(s);renderCal();}}
function jumpToDay(ds){calD=s2d(ds);setView('day');}
function clearCal(){
  ['cal-city','cal-cls','cal-cl','cal-sup'].forEach(id=>document.getElementById(id).value='');
  ['cal-g1','cal-g2','cal-g3'].forEach((id,i)=>{
    const el=document.getElementById(id);
    el.innerHTML=i===0?'<option value="">כל הצהרונים</option>':'<option value="">—</option>';
    GARDENS.forEach(g=>el.innerHTML+=`<option value="${g.id}">${g.city} · ${g.name}</option>`);
  });
  document.getElementById('cal-pair-bar').classList.remove('show');
  renderCal();
}
function clearCalPair(){
  document.getElementById('cal-g1').value='';
  document.getElementById('cal-g2').value='';
  document.getElementById('cal-g3').value='';
  document.getElementById('cal-pair-bar').classList.remove('show');
  renderCal();
}
// Unified pair save — called from calendar, schedule, and garden modal
function addPair(gids){
  if(!gids||gids.length<2){alert('יש לבחור לפחות 2 צהרונים');return;}
  checkDupePairAndSave(gids);
}
function addPairFromCal(){
  addPair(getCalGids());
}
function addPairFromSched(){
  const ids=[parseInt(document.getElementById('s-g1').value)||null,
             parseInt(document.getElementById('s-g2').value)||null,
             parseInt(document.getElementById('s-g3').value)||null].filter(Boolean);
  addPair(ids);
}
function savePairFromGarden(){
  const g2=parseInt(document.getElementById('gm-pg2').value)||null;
  const g3=parseInt(document.getElementById('gm-pg3').value)||null;
  if(!g2){alert('יש לבחור לפחות צהרון שני');return;}
  addPair([gmGid,g2,g3].filter(Boolean));
  openGM(gmGid);
}
function checkDupePairAndSave(gids){
  const dupe=gids.map(gid=>{const p=gardenPair(gid);return p?`${G(gid).name} כבר בזוג "${p.name}"`:null}).filter(Boolean);
  if(dupe.length){if(!confirm(`⚠️ שים לב:\n${dupe.join('\n')}\n\nבכל זאת להמשיך?`)) return;}
  const name=gids.map(id=>G(id).name||'').join(' + ');
  const nm=prompt('שם לזוג:',name);
  if(nm===null) return;
  pairs.push({id:Date.now(),ids:gids,name:nm||name});
  save(); refresh();
  alert(`✅ הזוג "${nm||name}" נשמר!`);
}

function renderCal(){
  const gids=getCalGids();
  const bar=document.getElementById('cal-pair-bar');
  if(gids.length>=2){
    bar.classList.add('show');
    (document.getElementById('cal-pair-lbl')||{}).textContent =gids.map(id=>G(id).name||'').join(' + ');
  } else {
    bar.classList.remove('show');
  }

  const f=getCalF();
  let displayGids=null;
  if(f.gids&&f.gids.length>=2){
    displayGids=f.gids;
  } else if(f.gids&&f.gids.length===1){
    const p=gardenPair(f.gids[0]);
    if(p) displayGids=p.ids;
  }

  let html='';
  if(calV==='day'){
    const ds=d2s(calD);
    (document.getElementById('cal-title')||{}).textContent =`${fD(ds)} - יום ${dayN(ds)}`;
    const evs=filterE(f,ds,ds).sort((a,b)=>(a.t||'').localeCompare(b.t||''));
    if(displayGids) html=renderPairDay(evs,displayGids);
    else if(f.cluster) html=renderClusterDay(evs,ds,f.cluster);
    else html=renderNormalDay(evs,ds);
  } else if(calV==='week'){
    // Show 5 days (Sun-Thu) from calD, not from Monday
    const ws=new Date(calD); ws.setHours(0,0,0,0);
    // If on Fri(5) or Sat(6), start from next Sunday
    const dow0=ws.getDay();
    if(dow0===5) ws.setDate(ws.getDate()+2);
    else if(dow0===6) ws.setDate(ws.getDate()+1);
    const we=addD(ws,4); // 5 days: ws+0,1,2,3,4
    const wsS=d2s(ws),weS=d2s(we);
    (document.getElementById('cal-title')||{}).textContent=`${fD(wsS)} – ${fD(weS)}`;
    const evs=filterE(f,wsS,weS);
    if(displayGids) html=renderPairWeek(evs,ws,displayGids);
    else if(f.cluster) html=renderClusterWeek(evs,ws,f.cluster);
    else html=renderNormalWeek(evs,ws,f);
  } else if(calV==='range'){
    const from=document.getElementById('cal-range-from')?.value||d2s(calD);
    const to=document.getElementById('cal-range-to')?.value||from;
    const fromD=from<=to?from:to, toD=from<=to?to:from;
    const viewLbl=(_rangeSubView==='list')?'📋 רשימה — ':'';
    (document.getElementById('cal-title')||{}).textContent=`${viewLbl}${fD(fromD)} – ${fD(toD)}`;
    const evs=filterE(f,fromD,toD);
    html=(_rangeSubView==='list') ? renderRangeListView(evs,fromD,toD) : renderRangeView(evs,fromD,toD,f,displayGids);
  } else if(calV==='list'){
    let fromDs, toDs, titleStr;
    const lsv = _listSubView||'week';
    if(lsv==='day'){
      fromDs=toDs=d2s(calD);
      titleStr='📋 רשימה — '+fD(fromDs)+' '+dayN(fromDs);
    } else if(lsv==='week'){
      // 5 work days from calD — skip Fri(5)/Sat(6)
      let _ws=new Date(calD); _ws.setHours(0,0,0,0);
      if(_ws.getDay()===5) _ws.setDate(_ws.getDate()+2); // Fri → Sun
      else if(_ws.getDay()===6) _ws.setDate(_ws.getDate()+1); // Sat → Sun
      // Collect 5 work days
      let _wd=new Date(_ws), _days=[]; 
      while(_days.length<5){ if(_wd.getDay()!==5&&_wd.getDay()!==6) _days.push(new Date(_wd)); _wd.setDate(_wd.getDate()+1); }
      fromDs=d2s(_days[0]); toDs=d2s(_days[4]);
      titleStr='📋 רשימה — שבוע '+fD(fromDs)+' – '+fD(toDs);
    } else { // month
      const y2=calD.getFullYear(),m2=calD.getMonth();
      fromDs=d2s(new Date(y2,m2,1)); toDs=d2s(new Date(y2,m2+1,0));
      titleStr='📋 רשימה — '+hebM(calD);
    }
    (document.getElementById('cal-title')||{}).textContent=titleStr;
    const evs=filterE(f,fromDs,toDs);
    html=renderRangeListView(evs,fromDs,toDs);
  } else {
    const y=calD.getFullYear(),m=calD.getMonth();
    (document.getElementById('cal-title')||{}).textContent =hebM(calD);
    const evs=filterE(f,d2s(new Date(y,m,1)),d2s(new Date(y,m+1,0)));
    html=renderMonth(evs,calD);
  }
  document.getElementById('cal-body').innerHTML=html;
}
function isPairBroken(pairId,ds){return !!pairBreaks[pairId+'_'+ds];}
function setPairBreak(pairId,ds,broken){
  const k=pairId+'_'+ds;
  if(broken) pairBreaks[k]=true; else delete pairBreaks[k];
  save(); refresh();
}

// City-based color map for calendar
const CITY_COLORS=(()=>{
  // Neutral palette — one color per city, readable and clean
  const palette=[
    {solid:'#37474f',light:'#eceff1',border:'#b0bec5',text:'#37474f'},
    {solid:'#1565c0',light:'#e3f2fd',border:'#90caf9',text:'#1565c0'},
    {solid:'#2e7d32',light:'#e8f5e9',border:'#a5d6a7',text:'#2e7d32'},
    {solid:'#6a1b9a',light:'#f3e5f5',border:'#ce93d8',text:'#6a1b9a'},
    {solid:'#c62828',light:'#ffebee',border:'#ef9a9a',text:'#c62828'},
    {solid:'#00695c',light:'#e0f2f1',border:'#80cbc4',text:'#00695c'},
    {solid:'#e65100',light:'#fff3e0',border:'#ffcc80',text:'#e65100'},
  ];
  const map={};let idx=0;
  return(city)=>{
    if(!city) return palette[0];
    if(!map[city]) map[city]=palette[idx++%palette.length];
    return map[city];
  };
})();
// ─── Range View — day-by-day between two dates ───────────────────
function renderRangeView(evs, fromDs, toDs, f, displayGids){
  let html='';
  let cur=s2d(fromDs);
  const end=s2d(toDs);
  let dayCount=0;
  while(cur<=end && dayCount<62){
    const ds=d2s(cur);
    const dayEvs=evs.filter(s=>s.d===ds);
    const hol=getHolidayInfo(ds,f&&f.city||null,f&&f.cls||null);
    const blk=getBlockedInfo(ds);
    const isFri=cur.getDay()===5, isSat=cur.getDay()===6;
    const hdrStyle=isSat?'background:linear-gradient(135deg,#546e7a,#78909c)':isFri?'background:linear-gradient(135deg,#e65100,#f4511e)':'';
    html+=`<div class="dsec" style="margin-bottom:10px">
      <div class="dsh gan" style="${hdrStyle}">
        ${fD(ds)} — יום ${dayN(ds)}
        ${hol?`<span style="background:rgba(255,255,255,.2);border-radius:4px;padding:1px 7px;font-size:.72rem">${hol.emoji} ${hol.name}</span>`:''}
        ${dayEvs.length?`<span style="margin-right:auto;font-size:.72rem;opacity:.8">${dayEvs.length} פעילויות</span>`:'<span style="margin-right:auto;font-size:.72rem;opacity:.6">אין פעילויות</span>'}
        <button onclick="openBlockedDate('${ds}')" style="background:rgba(255,255,255,.15);border:none;border-radius:4px;padding:1px 7px;cursor:pointer;font-size:.68rem;color:#fff">🚫</button>
        <button onclick="calD=s2d('${ds}');setView('day')" style="background:rgba(255,255,255,.15);border:none;border-radius:4px;padding:1px 7px;cursor:pointer;font-size:.68rem;color:#fff">📋 יומי</button>
      </div>`;
    if(blk) html+=`<div style="padding:5px 12px;background:#ffebee;font-size:.75rem;color:#c62828;font-weight:700">${blk.icon||'🚫'} ${blk.reason}${blk.note?' — '+blk.note:''}</div>`;

    if(!dayEvs.length){
      html+=`<div style="padding:10px;text-align:center;color:#bbb;font-size:.76rem;background:#fff">אין פעילויות</div>`;

    } else if(f&&f.cluster){
      // ── אשכול: לפי שעה ──
      html+=`<div style="background:#fff;padding:8px">${renderClusterDay(dayEvs,ds,f.cluster)}</div>`;

    } else if(displayGids){
      // ── זוג/שלישייה ספציפי ──
      html+=`<div style="background:#fff;padding:8px">${renderPairDay(dayEvs,displayGids)}</div>`;

    } else {
      // ── תצוגה כללית: עיר → זוגות לפי שעה → צהרונים בודדים לפי שעה ──
      const cityFilter=f&&f.city||'';
      const allCities=cityFilter
        ? [cityFilter]
        : [...new Set(dayEvs.map(s=>G(s.g).city||'אחר'))].sort((a,b)=>a.localeCompare(b,'he'));

      allCities.forEach(city=>{
        const cityEvs=dayEvs.filter(s=>(G(s.g).city||'אחר')===city);
        if(!cityEvs.length) return;
        const clr=CITY_COLORS(city);
        html+=`<div style="margin:0 0 10px 0">`;
        if(!cityFilter){
          html+=`<div style="display:flex;align-items:center;gap:8px;padding:4px 8px;background:${clr.light};border-right:3px solid ${clr.solid};border-radius:5px;margin-bottom:6px">
            <span style="font-weight:800;color:${clr.solid};font-size:.8rem">🏙️ ${city}</span>
            <span style="font-size:.7rem;color:#78909c">${cityEvs.length} פעילויות</span>
          </div>`;
        }

        // --- זוגות: מיון לפי שעה הכי מוקדמת בזוג ---
        const pairedGids=new Set();
        const pairBlocks=[];
        pairs.forEach(pair=>{
          if(isPairBroken(pair.id,ds)) return;
          const pairEvs=cityEvs.filter(s=>pair.ids.includes(s.g) && !s._makeupFrom);
          if(!pairEvs.length) return;
          pair.ids.forEach(id=>pairedGids.add(id));
          const earliest=pairEvs.map(s=>s.t||'99:99').sort()[0];
          pairBlocks.push({pair,pairEvs,earliest});
        });
        // sort pair blocks by earliest event time
        pairBlocks.sort((a,b)=>a.earliest.localeCompare(b.earliest));
        if(pairBlocks.length){
          html+=`<div class="pairs-4col" style="margin-bottom:8px">`;
          pairBlocks.forEach(({pair,pairEvs})=>{
            html+=renderPairCard(pair,pairEvs,{ds,clr,showEdit:true,showExport:true});
          });
          html+=`</div>`;
        }

        // --- גנים בודדים: לפי שם צהרון (אחר"כ שעה) ---
        const soloEvs=cityEvs
          .filter(s=>!pairedGids.has(s.g) || s._makeupFrom)
          .sort((a,b)=>{
            const na=G(a.g).name||'', nb=G(b.g).name||'';
            return na.localeCompare(nb,'he')||(a.t||'99:99').localeCompare(b.t||'99:99');
          });
        if(soloEvs.length){
          html+=`<div style="display:flex;flex-wrap:wrap;gap:6px">`;
          soloEvs.forEach(s=>{
            const g=G(s.g);
            const stc=s.st!=='ok'?'st-'+s.st:'';
            html+=`<div style="min-width:160px;flex:1;max-width:260px;border:1.5px solid ${clr.border};border-radius:7px;padding:7px;cursor:pointer;background:${clr.light};border-right:3px solid ${clr.solid}" onclick="openSP(${s.id})" class="${stc}">
              ${s.t?`<div style="font-size:.8rem;font-weight:800;color:${clr.solid};margin-bottom:2px">⏰ ${fT(s.t)}</div>`:''}
              <div style="font-weight:700;font-size:.78rem;color:#1a237e">${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</div>
              ${s._makeupFrom?`<div style="display:inline-block;background:#e1f5fe;color:#0288d1;border-radius:4px;padding:1px 6px;font-size:.62rem;font-weight:800;border:1px solid #b3e5fc;margin-bottom:2px">📅 השלמה</div>`:''}
              <div style="font-size:.72rem;color:#546e7a;margin-top:1px">${supBase(s.a)}${(s.act||supAct(s.a))?` · ${s.act||supAct(s.a)}`:''}</div>
              <div style="font-size:.68rem;font-weight:700;margin-top:2px">${stLabel(s)}</div>
            </div>`;
          });
          html+=`</div>`;
        }
        html+=`</div>`; // end city block
      });
    }

    html+=`</div>`; // end day
    cur=addD(cur,1);
    dayCount++;
  }
  if(dayCount>=62) html+=`<div style="background:#fff3e0;padding:10px;text-align:center;border-radius:7px;color:#e65100;font-size:.8rem">⚠️ הטווח המקסימלי הוא 62 ימים</div>`;
  return html||`<div class="card" style="text-align:center;color:#999;padding:25px">בחר טווח תאריכים</div>`;
}

// ─── Cluster Day View — sorted by time ─────────────────────────
function renderClusterDay(evs, ds, clusterName){
  let html='';
  const hol=getHolidayInfo(ds,null,null);
  if(hol) html+=`<div class="hol-banner ${hol.type||'vacation'}" style="margin-bottom:8px;font-size:.82rem">${hol.emoji} <b>${hol.name}</b>${hol.note?' — '+hol.note:''}</div>`;
  const blk=getBlockedInfo(ds);
  if(blk) html+=`<div style="background:#fce4ec;border:2px solid #e91e63;border-radius:9px;padding:9px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
    <span style="font-size:.85rem;font-weight:700;color:#c62828">${blk.icon||'🚫'} <b>${blk.reason}</b>${blk.note?' — '+blk.note:''}</span>
    <button onclick="openBlockedDate('${ds}')" style="background:none;border:1.5px solid #e91e63;color:#c62828;border-radius:5px;padding:2px 8px;cursor:pointer;font-size:.72rem">✏️ ערוך</button>
  </div>`;
  const isAll = clusterName==='__all__';
  const clObjD=!isAll&&getClusters().find(cl=>cl.name===clusterName);
  const clGidsD=clObjD?(clObjD.gardenIds||[]):evs.map(s=>s.g).filter((v,i,a)=>a.indexOf(v)===i);
  html+=`<div style="background:#e8eaf6;border-radius:7px;padding:6px 12px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;font-size:.78rem;font-weight:700;color:#1a237e">
    <span>🔢 ${isAll?'כל האשכולות':('אשכול: '+clusterName)} <span style="font-weight:400;color:#546e7a">${evs.length} פעילויות</span></span>
    <button onclick="event.stopPropagation();_exportPairWA(${JSON.stringify(clGidsD)})" style="background:#25d366;border:none;border-radius:4px;color:#fff;font-size:.65rem;padding:2px 8px;cursor:pointer">📋 הודעה</button>
  </div>`;
  if(!evs.length) return html+`<div class="card" style="text-align:center;color:#999;padding:25px">אין פעילויות</div>`;

  if(isAll){
    // ── כל האשכולות: עיר → אשכול → שעה ──
    const allCities=[...new Set(evs.map(s=>G(s.g).city||'אחר'))].sort((a,b)=>a.localeCompare(b,'he'));
    allCities.forEach(city=>{
      const cityEvs=evs.filter(s=>(G(s.g).city||'אחר')===city);
      if(!cityEvs.length) return;
      const clrCity=CITY_COLORS(city);
      html+=`<div style="margin-bottom:14px">
        <div style="padding:5px 10px;background:${clrCity.solid};color:#fff;border-radius:6px;font-size:.82rem;font-weight:800;margin-bottom:8px">🏙️ ${city}</div>`;
      // Group by cluster within city
      const clusterMap={};
      cityEvs.forEach(s=>{
        const gClusters=gardenClusters(s.g);
        const clKey=gClusters.length?gClusters[0].name:'ללא אשכול';
        (clusterMap[clKey]=clusterMap[clKey]||[]).push(s);
      });
      Object.entries(clusterMap).sort((a,b)=>a[0].localeCompare(b[0],'he')).forEach(([clName,clEvs])=>{
        const sorted=[...clEvs].sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
        html+=`<div style="margin-bottom:10px">
          <div style="padding:3px 10px;background:${clrCity.light};border-right:3px solid ${clrCity.solid};border-radius:4px;font-size:.74rem;font-weight:700;color:${clrCity.solid};margin-bottom:5px">🔢 ${clName} — ${sorted.length} פעילויות</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">`;
        sorted.forEach(s=>{
          const g=G(s.g);
          const stc=s.st!=='ok'?'st-'+s.st:'';
          const isM = s => (s._makeupFrom || (s.nt && s.nt.includes('השלמה')));
          html+=`<div style="min-width:160px;flex:1;max-width:260px;border:1.5px solid ${clrCity.border};border-radius:7px;padding:7px;cursor:pointer;background:#fff;border-right:3px solid ${clrCity.solid}" onclick="openSP(${s.id})" class="${stc}">
            ${s.t?`<div style="font-size:.8rem;font-weight:800;color:${clrCity.solid};margin-bottom:2px">⏰ ${fT(s.t)}</div>`:'<div style="font-size:.7rem;color:#aaa">ללא שעה</div>'}
            <div style="font-weight:700;font-size:.78rem;color:#1a237e">${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</div>
            ${isM(s)?`<div style="display:inline-block;background:#e1f5fe;color:#0288d1;border-radius:4px;padding:1px 6px;font-size:.62rem;font-weight:800;border:1px solid #b3e5fc;margin-bottom:2px">📅 השלמה</div>`:''}
            <div style="font-size:.72rem;color:#546e7a;margin-top:1px">${supBase(s.a)}${(s.act||supAct(s.a))?` · ${s.act||supAct(s.a)}`:''}</div>
            <div style="font-size:.68rem;font-weight:700;margin-top:2px">${stLabel(s)}</div>
            <div class="qacts" onclick="event.stopPropagation()">
              ${s.st==='done'?'':`<button title="התקיים" onclick="qSetSt(${s.id},'done')">✔️</button>`}
              ${s.st==='can'?'':`<button title="בטל" onclick="openCanQ(${s.id})">❌</button>`}
              ${s.st==='nohap'?'':`<button title="לא התקיים" onclick="qSetSt(${s.id},'nohap')">⚠️</button>`}
              <button title="דחה" onclick="openPostpone(${s.id})">⏩</button>
              <button title="שיבוץ השלמה" class="btn-makeup" onclick="openMakeupSched(${s.id})">📅</button>
            </div>
          </div>`;
        });
        html+=`</div></div>`;
      });
      html+=`</div>`;
    });
  } else {
    // ── אשכול בודד: לפי שעה ──
    const sorted=[...evs].sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
    sorted.forEach(s=>{
      const g=G(s.g);
      const stc=s.st!=='ok'?'st-'+s.st:'';
      const clrCity=CITY_COLORS(g.city||'');
          const isM = s => (s._makeupFrom || (s.nt && s.nt.includes('השלמה')));
          html+=`<div class="city-block" style="margin-bottom:8px">
        <div class="city-block-hdr" style="background:${clrCity.solid};font-size:.76rem">
          ${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}
          ${g.st?`<span style="font-size:.65rem;font-weight:400;opacity:.8">${g.st}</span>`:''}
          <span style="font-size:.65rem;opacity:.75;font-weight:400">📍 ${g.city||''}</span>
          <button onclick="event.stopPropagation();_exportGardenWA([${g.id}],'${ds}')" style="background:rgba(255,255,255,.28);border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:.68rem;color:#fff;font-weight:700">📋 הודעה</button>
        </div>
        <div style="background:#fff;padding:7px">
          <div class="pslot ${stc}" style="border-right:3px solid ${clrCity.solid};background:${clrCity.light}" onclick="openSP(${s.id})">
            ${s.t?`<div class="pt" style="font-size:.82rem;font-weight:800;color:${clrCity.solid}">⏰ ${fT(s.t)}</div>`:'<div class="pt" style="color:#aaa">ללא שעה</div>'}
            <div class="pn">${supBase(s.a)}</div>
            ${isM(s)?`<div style="display:inline-block;background:#e1f5fe;color:#0288d1;border-radius:4px;padding:1px 6px;font-size:.62rem;font-weight:800;border:1px solid #b3e5fc;margin-bottom:2px">📅 השלמה</div>`:''}
            ${(s.act||supAct(s.a))?`<div style="font-size:.69rem;color:${clrCity.solid};font-weight:600">🎯 ${s.act||supAct(s.a)}</div>`:''}
            ${s.grp>1?`<div style="font-size:.68rem;color:#546e7a">👥 ${s.grp} קבוצות</div>`:''}
            <div class="pst">${stLabel(s)}</div>
            ${s.nt?`<div style="font-size:.68rem;color:#78909c">📝 ${s.nt}</div>`:''}
            <div class="qacts" onclick="event.stopPropagation()">
              ${s.st==='done'?'':`<button title="התקיים" onclick="qSetSt(${s.id},'done')">✔️</button>`}
              ${s.st==='can'?'':`<button title="בטל" onclick="openCanQ(${s.id})">❌</button>`}
              ${s.st==='nohap'?'':`<button title="לא התקיים" onclick="qSetSt(${s.id},'nohap')">⚠️</button>`}
              <button title="דחה" onclick="openPostpone(${s.id})">⏩</button>
              <button title="שיבוץ השלמה" class="btn-makeup" onclick="openMakeupSched(${s.id})">📅</button>
            </div>
          </div>
        </div>
      </div>`;
    });
  }
  return html;
}

// ─── Cluster Week View — each day sorted by time ─────────────────
function renderClusterWeek(evs, weekStart, clusterName){
  const isAll=clusterName==='__all__';
  const clObj=!isAll&&getClusters().find(cl=>cl.name===clusterName);
  const clGids=clObj?(clObj.gardenIds||[]):evs.map(s=>s.g).filter((v,i,a)=>a.indexOf(v)===i);
  const waBtn=`<button onclick="event.stopPropagation();_exportPairWA(${JSON.stringify(clGids)})" style="background:#25d366;border:none;border-radius:4px;color:#fff;font-size:.65rem;padding:2px 8px;cursor:pointer;margin-right:8px">📋 הודעה</button>`;
  let html=`<div style="background:#e8eaf6;border-radius:7px;padding:5px 12px;margin-bottom:10px;font-size:.77rem;font-weight:700;color:#1a237e;display:flex;align-items:center;justify-content:space-between">
    <span>🔢 ${isAll?'כל האשכולות':('אשכול: '+clusterName)} — תצוגה שבועית לפי שעה</span>
    ${waBtn}
  </div>`;
  for(let i=0;i<6;i++){
    const d=addD(weekStart,i);
    const ds=d2s(d);
    const dayEvs=evs.filter(s=>s.d===ds).sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
    const hol=getHolidayInfo(ds,null,null);
    const blk=getBlockedInfo(ds);
    html+=`<div class="dsec" style="margin-bottom:10px">
      <div class="dsh gan">${fD(ds)} — יום ${dayN(ds)}${hol?` 🎉 ${hol.name}`:''}</div>`;
    if(blk) html+=`<div style="padding:5px 12px;background:#ffebee;font-size:.75rem;color:#c62828;font-weight:700">${blk.icon||'🚫'} ${blk.reason}</div>`;
    if(!dayEvs.length){
      html+=`<div style="padding:12px;text-align:center;color:#bbb;font-size:.76rem;background:#fff">אין פעילויות</div>`;
    } else if(isAll){
      // עיר → אשכול → שעה
      const allCities=[...new Set(dayEvs.map(s=>G(s.g).city||'אחר'))].sort((a,b)=>a.localeCompare(b,'he'));
      html+=`<div style="background:#fff;padding:8px">`;
      allCities.forEach(city=>{
        const cityEvs=dayEvs.filter(s=>(G(s.g).city||'אחר')===city);
        if(!cityEvs.length) return;
        const clrCity=CITY_COLORS(city);
        html+=`<div style="margin-bottom:8px">
          <div style="padding:3px 8px;background:${clrCity.solid};color:#fff;border-radius:4px;font-size:.73rem;font-weight:700;margin-bottom:4px">🏙️ ${city}</div>`;
        const clusterMap={};
        cityEvs.forEach(s=>{
          const clKey=(gardenClusters(s.g)[0]||{}).name||'ללא אשכול';
          (clusterMap[clKey]=clusterMap[clKey]||[]).push(s);
        });
        Object.entries(clusterMap).sort((a,b)=>a[0].localeCompare(b[0],'he')).forEach(([clName,clEvs])=>{
          html+=`<div style="font-size:.68rem;font-weight:700;color:${clrCity.solid};background:${clrCity.light};padding:2px 7px;border-radius:3px;margin-bottom:3px">🔢 ${clName}</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:5px">`;
          [...clEvs].sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99')).forEach(s=>{
            const g=G(s.g);
            const stc=s.st!=='ok'?'st-'+s.st:'';
            html+=`<div style="min-width:150px;flex:1;max-width:240px;border:1.5px solid ${clrCity.border};border-right:3px solid ${clrCity.solid};border-radius:6px;padding:6px;cursor:pointer;background:#fff" onclick="openSP(${s.id})" class="${stc}">
              ${s.t?`<div style="font-size:.8rem;font-weight:800;color:${clrCity.solid}">⏰ ${fT(s.t)}</div>`:''}
              <div style="font-weight:700;font-size:.76rem;color:#1a237e">${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</div>
              <div style="font-size:.7rem;color:#546e7a">${supBase(s.a)}${(s.act||supAct(s.a))?` · ${s.act||supAct(s.a)}`:''}</div>
              <div style="font-size:.67rem;margin-top:2px">${stLabel(s)}</div>
            </div>`;
          });
          html+=`</div>`;
        });
        html+=`</div>`;
      });
      html+=`</div>`;
    } else {
      html+=`<div style="background:#fff;padding:8px;display:flex;flex-wrap:wrap;gap:6px">`;
      dayEvs.forEach(s=>{
        const g=G(s.g);
        const stc=s.st!=='ok'?'st-'+s.st:'';
        const clrCity=CITY_COLORS(g.city||'');
        const clBadge=isAll?(gardenClusters(g.id)[0]||{}).name||'':'';
        html+=`<div style="min-width:180px;flex:1;border:1.5px solid ${clrCity.border};border-radius:7px;padding:7px;cursor:pointer;background:${clrCity.light}" onclick="openSP(${s.id})" class="${stc}">
          ${s.t?`<div style="font-size:.82rem;font-weight:800;color:${clrCity.solid};margin-bottom:2px">⏰ ${fT(s.t)}</div>`:''}
          <div style="font-weight:700;font-size:.78rem;color:#1a237e">${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</div>
          ${clBadge?`<div style="font-size:.66rem;color:#546e7a">🔢 ${clBadge}</div>`:''}
          <div style="font-size:.73rem;color:#546e7a">${supBase(s.a)}${(s.act||supAct(s.a))?` · ${s.act||supAct(s.a)}`:''}</div>
          <div style="font-size:.68rem;font-weight:700;margin-top:2px">${stLabel(s)}</div>
        </div>`;
      });
      html+=`</div>`;
    }
    html+=`</div>`;
  }
  return html;
}

function renderNormalDay(evs,ds){
  const calCity=document.getElementById('cal-city').value;
  const calCls=document.getElementById('cal-cls').value;
  const hol=getHolidayInfo(ds,calCity||null,calCls||null);
  let topHtml='';
  if(hol) topHtml=`<div class="hol-banner ${hol.type||'vacation'}" style="margin-bottom:8px;font-size:.82rem">${hol.emoji} <b>${hol.name}</b>${hol.note?' — '+hol.note:''}</div>`;
  const blk=getBlockedInfo(ds);
  if(blk) topHtml+=`<div style="background:#fce4ec;border:2px solid #e91e63;border-radius:9px;padding:9px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
    <span style="font-size:.85rem;font-weight:700;color:#c62828">${blk.icon||'🚫'} <b>${blk.reason}</b>${blk.note?' — '+blk.note:''}</span>
    <button onclick="openBlockedDate('${ds}')" style="background:none;border:1.5px solid #e91e63;color:#c62828;border-radius:5px;padding:2px 8px;cursor:pointer;font-size:.72rem">✏️ ערוך</button>
  </div>`;
  const activeGids=new Set(evs.map(s=>s.g));
  const pairedGids=new Set();
  const pairRowsHtml=[]; // rendered pair rows
  // Group pairs by city for unified color display
  const pairsByCity={};
  const isM = s => !!(s._makeupFrom || (s.nt && /השלמה/i.test(s.nt)));
  const makeups=evs.filter(isM);
  const others=evs.filter(s=>!isM(s));

  pairs.forEach(pair=>{
    if(isPairBroken(pair.id,ds)) return;
    const pairEvs=others.filter(s=>pair.ids.includes(s.g));
    if(!pairEvs.length) return;
    const city=G(pair.ids[0]).city||'אחר';
    if(!pairsByCity[city]) pairsByCity[city]=[];
    pairsByCity[city].push({pair,pairEvs});
    pair.ids.forEach(id=>pairedGids.add(id));
  });
  Object.keys(pairsByCity).sort().forEach(city=>{
    const clr=CITY_COLORS(city);
    const cityPairs=pairsByCity[city];
    cityPairs.forEach(({pair,pairEvs})=>{
      pairRowsHtml.push(renderPairCard(pair,pairEvs,{ds,clr,showEdit:true,showExport:true}));
    });
  });

  const unpairedOthers=others.filter(s=>!pairedGids.has(s.g));
  const allSoloEvs=[...makeups];
  unpairedOthers.forEach(s=>allSoloEvs.push(s));

  pairs.forEach(pair=>{
    if(!isPairBroken(pair.id,ds)) return;
    const pairEvs=others.filter(s=>pair.ids.includes(s.g));
    if(!pairEvs.length) return;
    pairEvs.forEach(s=>{
      if(pairedGids.has(s.g)) return;
      if(!allSoloEvs.find(x=>x.id===s.id))
        allSoloEvs.push({...s,_broken:pair});
    });
  });

  let html=topHtml;
  if(pairRowsHtml.length){
    // Group pair cards by city with headers
    const pairCardsByCity={};
    Object.keys(pairsByCity).sort().forEach(city=>{
      pairCardsByCity[city]=[];
    });
    // Re-assign cards to cities (in order)
    let cardIdx=0;
    Object.keys(pairsByCity).sort().forEach(city=>{
      const clr=CITY_COLORS(city);
      pairsByCity[city].forEach(({pair,pairEvs})=>{
        if(!pairCardsByCity[city]) pairCardsByCity[city]=[];
        pairCardsByCity[city].push(renderPairCard(pair,pairEvs,{ds,clr,showEdit:true,showExport:true}));
      });
    });
    Object.keys(pairCardsByCity).sort().forEach(city=>{
      const cards=pairCardsByCity[city];
      if(!cards||!cards.length) return;
      html+=`<div style="margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div style="flex:1;height:2px;background:${CITY_COLORS(city).solid};opacity:.3"></div>
          <span style="font-size:.75rem;font-weight:800;color:${CITY_COLORS(city).solid};white-space:nowrap">🏙️ ${city} (${cards.length} זוגות)</span>
          <div style="flex:1;height:2px;background:${CITY_COLORS(city).solid};opacity:.3"></div>
        </div>
        <div class="pairs-4col">${cards.join('')}</div>
      </div>`;
    });
  }

  if(allSoloEvs.length){
    const byCitySolo={};
    allSoloEvs.forEach(s=>{
      s.gd=G(s.g);
      const c=s.gd.city||'אחר';
      if(!byCitySolo[c]) byCitySolo[c]=[];
      byCitySolo[c].push(s);
    });
    Object.keys(byCitySolo).sort().forEach(city=>{
      const clr=CITY_COLORS(city);
      html+=`<div style="margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div style="flex:1;height:2px;background:${clr.solid};opacity:.3"></div>
          <span style="font-size:.75rem;font-weight:800;color:${clr.solid};white-space:nowrap">🏙️ ${city} — צהרונים ללא זוג</span>
          <div style="flex:1;height:2px;background:${clr.solid};opacity:.3"></div>
        </div>
        <div class="pairs-4col">`;
      byCitySolo[city].sort((a,b)=>{
        const clA=(gardenClusters(a.g)[0]||{}).name||'ת';
        const clB=(gardenClusters(b.g)[0]||{}).name||'ת';
        return clA.localeCompare(clB,'he')||(a.t||'99:99').localeCompare(b.t||'99:99');
      }).forEach(s=>{
        const stc=s.st!=='ok'?'st-'+s.st:'';
        const brokenBadge=s._broken?`<span style="font-size:.62rem;background:#fff3e0;color:#e65100;padding:1px 5px;border-radius:3px;font-weight:700">⚡ זוג פורק</span>`:'';
                const isM = s => (s._makeupFrom || (s.nt && s.nt.includes('השלמה')));
                html+=`<div class="city-block" style="margin-bottom:0">
          <div class="city-block-hdr" style="background:${clr.solid};font-size:.76rem">
            ${gcls(s.gd)==='ביה"ס'?'🏛️':'🏫'} ${s.gd.name}
            ${s.gd.st?`<span style="font-size:.65rem;font-weight:400;opacity:.8">${s.gd.st}</span>`:''}
            ${brokenBadge}
            <span style="font-size:.65rem;opacity:.75;font-weight:400">📍 ${city}</span>
            <button onclick="event.stopPropagation();_exportGardenWA([${s.g}],'${ds}')" style="background:rgba(255,255,255,.28);border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:.68rem;color:#fff;font-weight:700">📋 הודעה</button>
            <button onclick="event.stopPropagation();quickAddPartner(${s.g})" style="background:rgba(255,255,255,.22);border:none;border-radius:3px;padding:1px 6px;cursor:pointer;font-size:.66rem;color:#fff">➕ בן זוג</button>
          </div>
          <div style="background:#fff;padding:7px">
            <div class="pslot ${stc}" style="border-right:3px solid ${clr.solid};background:${clr.light}" onclick="openSP(${s.id})">
              ${s._fromD?`<div style="font-size:.67rem;color:#e65100;font-weight:700;background:#fff3e0;padding:1px 5px;border-radius:3px;margin-bottom:2px">↩️ הועבר מ-${fD(s._fromD)}</div>`:''}
              ${s.t?`<div class="pt">⏰ ${fT(s.t)}</div>`:''}
              <div class="pn">${supBase(s.a)}</div>
              ${isM(s)?`<div style="display:inline-block;background:#e1f5fe;color:#0288d1;border-radius:4px;padding:1px 6px;font-size:.62rem;font-weight:800;border:1px solid #b3e5fc;margin-bottom:2px">📅 השלמה</div>`:''}
              ${(s.act||supAct(s.a))?`<div style="font-size:.69rem;color:${clr.solid};font-weight:600">🎯 ${s.act||supAct(s.a)}</div>`:''}
              ${s.p?`<div class="pp">📞 ${s.p}</div>`:''}
              ${s.grp>1?`<div style="font-size:.68rem;color:#546e7a">👥 ${s.grp} קבוצות</div>`:''}
              <div class="pst">${stLabel(s)}</div>
              ${s.nt?`<div style="font-size:.68rem;color:#78909c">📝 ${s.nt}</div>`:''}
              <div class="qacts" onclick="event.stopPropagation()">
                ${s.st==='done'?'':`<button title="התקיים" onclick="qSetSt(${s.id},'done')">✔️</button>`}
                ${s.st==='can'?'':`<button title="בטל" onclick="openCanQ(${s.id})">❌</button>`}
                ${s.st==='nohap'?'':`<button title="לא התקיים" onclick="qSetSt(${s.id},'nohap')">⚠️</button>`}
                <button title="דחה" onclick="openPostpone(${s.id})">⏩</button>
                <button title="שיבוץ השלמה" class="btn-makeup" onclick="openMakeupSched(${s.id})">📅</button>
              </div>
            </div>
          </div>
        </div>`;
      });
      html+='</div></div>'; // end city solo group
    });
  }

  if(!html||html===topHtml) html+=`<div class="card" style="text-align:center;color:#999;padding:25px">אין פעילויות ביום זה</div>`;
  return html;
}

// ─── Unified pair card renderer ─────────────────────────
// Used in both calendar day view AND dashboard
// Layout: pair name label (left) | shared supplier info (top) + garden rows (stacked)
function renderPairCard(pair, pairEvs, opts){
  // opts: {ds, clr, showEdit, showExport}
  const ds=opts&&opts.ds||'';
  const clr=(opts&&opts.clr)||{solid:'#37474f',light:'#eceff1',border:'#b0bec5',text:'#37474f'};
  const showEdit=opts&&opts.showEdit!==false;
  const showExport=opts&&opts.showExport!==false;

  // Derive shared supplier info (use first event's data)
  const firstEv=pairEvs[0]||{};
  const supName=firstEv.a||'';
  const supPhone=firstEv.p||(()=>{
    const ex=supBaseEx(supBase(supName));
    return ex&&ex.ph1?ex.ph1:'';
  })();
  const actName=firstEv.act||supAct(supName)||'';

  // Buttons
  const editBtn=showEdit&&ds
    ?`<button onclick="openPairQuickEdit('${pair.id}','${ds}')" style="background:rgba(255,255,255,.25);border:none;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:.65rem;color:#fff" title="ערוך">✏️</button>`
    :'';
  const expBtn=showExport&&ds
    ?`<button onclick="exportPairRow('${pair.id}','${ds}')" style="background:rgba(255,255,255,.3);border:none;border-radius:4px;padding:3px 9px;cursor:pointer;font-size:.7rem;color:#fff;font-weight:700">📋 הודעה</button>`
    :'';

  let html=`<div class="pair-card">
    <div class="pair-card-hdr" style="background:${clr.solid}">
      🔗 ${pair.name}
      <span style="font-size:.68rem;font-weight:400;opacity:.8;margin-right:auto">${G(pair.ids[0]).city||''}</span>
      ${expBtn}${editBtn}
    </div>
    <div class="pair-card-body">
      <div class="pair-card-label" style="background:${clr.light}">
        <span class="pcl-name" style="color:${clr.text}">${pair.name}</span>
        ${showEdit&&ds?`<div class="pcl-btns">
          <button onclick="openPairQuickEdit('${pair.id}','${ds}')" style="background:${clr.solid};border:none;border-radius:3px;padding:1px 5px;cursor:pointer;font-size:.62rem;color:#fff">✏️</button>
        </div>`:''}
      </div>
      <div class="pair-card-content">
        <div class="pair-card-shared">
          ${supName?`<span class="pcs-item">📚 <b>${supBase(supName)}</b></span>`:''}
          ${supPhone?`<span class="pcs-item">📞 ${supPhone}</span>`:''}
          ${actName?`<span class="pcs-item">🎯 ${actName}</span>`:''}
        </div>
        <div class="pair-gardens">`;

  // One row per garden
  pair.ids.filter(Boolean).forEach(gid=>{
    const g=G(gid);
    const gEvs=pairEvs.filter(s=>s.g===gid).sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
    
    if(!gEvs.length){
      const gblkNone=ds?getGardenBlock(gid,ds):null;
      html+=`<div class="pair-garden-row" style="opacity:${gblkNone?1:.5};${gblkNone?'background:#fce4ec;border-right:3px solid #e91e63;':''}" onclick="${ds?`openGcellPopup(${gid},'${ds}',event)`:''}" style="cursor:${ds?'pointer':'default'}">
        <div class="pgr-left">
          <div class="pgr-name">${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</div>
          ${g.st?`<div class="pgr-addr">📍 ${g.st}</div>`:''}
          ${gblkNone
            ?`<div class="pgr-status" style="color:#c62828">${gblkNone.icon||'🚫'} ${gblkNone.reason}</div>`
            :`<div class="pgr-status" style="color:#999;font-size:.67rem">אין פעילות — לחץ להוסיף</div>`}
        </div>
      </div>`;
    } else {
      gEvs.forEach(ev => {
        const stc=ev&&ev.st!=='ok'?'st-'+ev.st:'';
        const gblkEv=ds?getGardenBlock(gid,ds):null;
        const isMakeup = ev._makeupFrom || (ev.nt && ev.nt.includes('השלמה'));
        const makeupBadge = isMakeup ? `<div style="display:inline-block;background:#e1f5fe;color:#0288d1;border-radius:4px;padding:1px 6px;font-size:.62rem;font-weight:800;border:1px solid #b3e5fc;margin-bottom:2px">📅 השלמה</div>` : '';
        
        html+=`<div class="pair-garden-row ${stc}" style="${gblkEv?'border-right:3px solid #e91e63;':''}" onclick="openSP(${ev.id})">
          <div class="pgr-left">
            <div class="pgr-name">${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</div>
            ${g.st?`<div class="pgr-addr">📍 ${g.st}</div>`:''}
            ${makeupBadge}
            ${ev.t?`<div class="pgr-time">⏰ ${fT(ev.t)}</div>`:''}
            ${gblkEv?`<div style="font-size:.67rem;color:#c62828">${gblkEv.icon||'🚫'} ${gblkEv.reason}</div>`:''}
            <div class="pgr-status" style="color:${stc?'#c62828':'#2e7d32'}">${stLabel(ev)}</div>
          </div>
          <div class="pgr-right">
            <div class="pgr-qacts" onclick="event.stopPropagation()">
              ${ev.st==='done'?'':`<button title="התקיים" onclick="qSetSt(${ev.id},'done')">✔️</button>`}
              ${ev.st==='can'?'':`<button title="בטל" onclick="openCanQ(${ev.id})">❌</button>`}
              <button title="דחה שוב" onclick="openPostpone(${ev.id})">⏩</button>
              ${ev.st==='nohap'?'':`<button title="לא התקיים" onclick="openNohapQ(${ev.id})" style="color:#e91e63">⚠️</button>`}
              <button title="שיבוץ השלמה" class="btn-makeup" onclick="openMakeupSched(${ev.id})">📅</button>
            </div>
          </div>
        </div>`;
      });
    }
  });

  html+='</div></div></div></div>';
  return html;
}
function renderGardenCols(evs,gids,clr){
  const cols=gids.filter(Boolean);
  let html='';
  cols.forEach((gid,i)=>{
    const g=G(gid);
    const ge=evs.filter(s=>s.g===gid).sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
    html+=`<div class="garden-col" style="border-right:${i>0?'1px solid rgba(0,0,0,.06)':'none'}">
      <div class="garden-col-hdr" style="color:${clr.text}">
        ${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}
      </div>`;
    if(!ge.length){
      html+='<div style="color:#ccc;font-size:.7rem;text-align:center;padding:10px 0">—</div>';
    } else {
      ge.forEach(s=>{
        const stc=s.st!=='ok'?'st-'+s.st:'';
        html+=`<div class="pslot ${stc}" style="border-right:3px solid ${clr.solid}" onclick="openSP(${s.id})">
          ${s._fromD?`<div style="font-size:.67rem;color:#e65100;font-weight:700;background:#fff3e0;padding:1px 5px;border-radius:3px;margin-bottom:2px">↩️ הועבר מ-${fD(s._fromD)}</div>`:''}
          ${s.t?`<div class="pt">⏰ ${fT(s.t)}</div>`:''}
          <div class="pn">${supBase(s.a)}</div>
          ${s._makeupFrom?`<div style="display:inline-block;background:#e1f5fe;color:#0288d1;border-radius:4px;padding:1px 6px;font-size:.62rem;font-weight:800;border:1px solid #b3e5fc;margin-bottom:2px">📅 השלמה</div>`:''}
          ${(s.act||supAct(s.a))?`<div style="font-size:.69rem;color:${clr.solid};font-weight:600;margin-top:1px">🎯 ${s.act||supAct(s.a)}</div>`:''}
          ${s.p?`<div class="pp">📞 ${s.p}</div>`:''}
          <div class="pst">${stLabel(s)}</div>
          <div class="qacts" onclick="event.stopPropagation()">
            ${s.st==='done'?'':`<button title="התקיים" onclick="qSetSt(${s.id},'done')">✔️</button>`}
            ${s.st==='can'?'':`<button title="בטל" onclick="openCanQ(${s.id})">❌</button>`}
            ${s.st==='nohap'?'':`<button title="לא התקיים" onclick="qSetSt(${s.id},'nohap')">⚠️</button>`}
            <button title="דחה" onclick="openPostpone(${s.id})">⏩</button>
            <button title="שיבוץ השלמה" class="btn-makeup" onclick="openMakeupSched(${s.id})">📅</button>
          </div>
        </div>`;
      });
    }
    html+='</div>';
  });
  // Pad with empty col if only 2 gardens (for 3-col alignment)
  if(cols.length===2){
    html+=`<div class="garden-col" style="border-right:none;background:#fafafa">
      <div style="text-align:center;color:#ddd;padding:20px 0;font-size:.8rem">—</div>
    </div>`;
  }
  return html;
}
function renderPairColsHTML(evs,gids,pairId){
  const cols=[gids[0]||null,gids[1]||null,gids[2]||null];
  const nCols=cols.filter(Boolean).length||1;
  const colsTpl=nCols===1?'1fr':nCols===2?'1fr 1fr':'1fr 1fr 1fr';
  let html=`<div class="pair-cols" style="grid-template-columns:${colsTpl}">`;
  cols.forEach((gid,i)=>{
    if(!gid){
      html+=`<div class="pcol"><div class="pch cx">—</div><div class="pcb"><div class="pempty">—</div></div></div>`;
      return;
    }
    const g=G(gid);
    const ge=evs.filter(s=>s.g===gid).sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
    html+=`<div class="pcol">
      <div style="font-size:.66rem;font-weight:700;text-align:center;padding:2px 6px;background:rgba(0,0,0,.12);color:#fff">${g.city}</div>
      <div class="pch"><span>${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</span></div>
      <div class="pcb">`;
    if(!ge.length) html+='<div class="pempty">אין פעילויות</div>';
    else ge.forEach(s=>html+=`<div class="pslot ${s.st!=='ok'?'st-'+s.st:''}" onclick="openSP(${s.id})">
      ${s.t?`<div class="pt">⏰ ${fT(s.t)}</div>`:''}
      ${s.act?`<div style="font-size:.68rem;color:#1565c0;font-weight:600">${s.act}</div>`:''}
      <div class="pn">${s.a}</div>
      ${s.p?`<div class="pp">📞 ${s.p}</div>`:''}
      <div class="pst">${stLabel(s)}</div>
      <div class="qacts" onclick="event.stopPropagation()">
        ${s.st==='done'?'':`<button title="התקיים" onclick="qSetSt(${s.id},'done')">✔️</button>`}
        ${s.st==='can'?'':`<button title="בטל" onclick="openCanQ(${s.id})">❌</button>`}
        ${s.st==='nohap'?'':`<button title="לא התקיים" onclick="qSetSt(${s.id},'nohap')">⚠️</button>`}
        <button title="דחה" onclick="openPostpone(${s.id})">⏩</button>
        <button title="שיבוץ השלמה" class="btn-makeup" onclick="openMakeupSched(${s.id})">📅</button>
      </div>
    </div>`);
    html+='</div></div>';
  });
  return html+'</div>';
}

function renderPairDay(evs,gids){
  const pclr=pairClrClass(gids[0]?gardenPair(gids[0])?.id:0)||'pc0';
  const pairIds = gids.filter(Boolean);
  return`<div class="pair-row ${pclr}">
    <div class="pair-row-label ${pclr}" style="display:flex;justify-content:space-between;align-items:center">
      <span>🔗 ${gids.map(id=>G(id).name||'').join(' + ')}</span>
      <button onclick="event.stopPropagation();_exportPairWA([${pairIds.join(',')}])" style="background:rgba(255,255,255,.25);border:none;border-radius:4px;color:#fff;font-size:.65rem;padding:1px 6px;cursor:pointer">📋 הודעה</button>
    </div>
    ${renderPairColsHTML(evs,gids)}</div>`;
}

function renderNormalWeek(evs,ws,f){
  const dn=['ראשון','שני','שלישי','רביעי','חמישי','שישי'], tday=td();
  const days=[];
  for(let i=0;i<6;i++) days.push(addD(ws,i));

  let gids=[...new Set(evs.map(s=>s.g))];
  if(f.gids&&f.gids.length) gids=f.gids;
  if(!gids.length) return'<div class="card" style="text-align:center;color:#999;padding:25px">אין פעילויות</div>';

  const usedGids=new Set();
  const byCity={};
  function ensureCity(city){ if(!byCity[city]) byCity[city]={pairs:[],solos:[]}; }

  pairs.forEach(pair=>{
    const myGids=pair.ids.filter(gid=>gids.includes(gid));
    if(!myGids.length) return;
    const city=G(myGids[0]).city||'אחר';
    ensureCity(city);
    myGids.forEach(gid=>usedGids.add(gid));
    byCity[city].pairs.push({pair,gids:myGids});
  });
  gids.filter(gid=>!usedGids.has(gid)).forEach(gid=>{
    const g=G(gid); const city=g.city||'אחר';
    ensureCity(city);
    byCity[city].solos.push(gid);
  });

  const sortedCities=Object.keys(byCity).sort((a,b)=>a.localeCompare(b,'he'));
  sortedCities.forEach(city=>{
    byCity[city].pairs.sort((a,b)=>a.pair.name.localeCompare(b.pair.name,'he'));
    byCity[city].solos.sort((a,b)=>(G(a).name||'').localeCompare(G(b).name||'','he'));
  });

  // border-separate avoids border-collapse + sticky bug
  let html='<div style="overflow-x:auto;border-radius:8px;border:2px solid #9fa8da">'
          +'<table style="min-width:950px;border-collapse:separate;border-spacing:0;width:100%"><thead><tr>';

  html+=`<th style="min-width:140px;background:#e8eaf6;color:#283593;padding:6px 8px;
    border-bottom:2px solid #9fa8da;border-left:1px solid #c5cae9;
    position:sticky;top:0;z-index:3;font-size:.76rem">צהרון / זוג</th>`;

  days.forEach((d,i)=>{
    const ds=d2s(d);
    const hol=getHolidayInfo(ds);
    const blkWk=getBlockedInfo(ds);
    const isToday=ds===tday;
    const bg=isToday?'#1565c0':blkWk?'#fce4ec':hol?hol.bg:'#e8eaf6';
    const col=isToday?'#fff':blkWk?'#c62828':hol?hol.color:'#283593';
    const bottomBorder=blkWk?'border-bottom:3px solid #e91e63':'border-bottom:2px solid #9fa8da';
    html+=`<th style="background:${bg};color:${col};padding:3px 4px;text-align:center;font-size:.76rem;min-width:132px;
      ${bottomBorder};border-left:1px solid ${isToday?'rgba(255,255,255,.3)':'#c5cae9'};
      position:sticky;top:0;z-index:3;white-space:nowrap;line-height:1.3" onclick="jumpToDay('${ds}')">
      <span style="font-weight:700">${dn[i]}</span> <span style="font-size:.64rem;font-weight:400">${fD(ds)}</span>
      <br><span style="font-size:.56rem;font-weight:400;opacity:.7">${toHebDate(ds)}</span>
      ${blkWk?`<span style="font-size:.58rem;cursor:pointer;display:block" onclick="event.stopPropagation();openBlockedDate('${ds}')">${blkWk.icon||'🚫'} ${blkWk.reason}</span>`:''}
    </th>`;
  });
  html+='</tr></thead><tbody>';

  sortedCities.forEach(city=>{
    const clr=CITY_COLORS(city);

    // City header row
    html+=`<tr>
      <td colspan="7" style="background:${clr.solid};color:#fff;padding:7px 12px;font-size:.9rem;font-weight:800;
        border-bottom:1px solid rgba(255,255,255,.2);position:sticky;left:0">
        🏙️ ${city}
        <span style="font-weight:400;font-size:.75rem;opacity:.85;margin-right:8px">${byCity[city].pairs.length} זוגות · ${byCity[city].solos.length} צהרונים בודדים</span>
      </td>
    </tr>`;

    function makeCell(gid, ds, de, blk, hol, clrObj){
      const isToday=ds===tday;
      const cellBg=blk?'#fce4ec':isToday?'#eef2ff':hol?hol.bg+'33':'#fff';
      const borderColor=isToday?'#7986cb':'#dde1f0';
      let inner='';
      if(de.length){
        de.forEach(ev=>{
          inner+=`<div style="border-radius:5px;padding:5px 6px;margin:2px 0;font-size:13px;
            background:#fff;border-right:3px solid ${clrObj.solid};
            ${ev.st==='can'?'opacity:.5;text-decoration:line-through;':ev.st==='post'?'background:#fff8e1;':ev.st==='done'?'background:#f1f8e9;':ev.st==='nohap'?'background:#fce4ec;':''}">
            <div style="display:flex;align-items:flex-start;gap:4px">
              <div style="cursor:pointer;flex:1;min-width:0" onclick="event.stopPropagation();openSP(${ev.id})">
                <div style="font-weight:700;color:${clrObj.solid};word-break:break-word;line-height:1.3">${supBase(ev.a)}${ev.act?`<span style="color:#78909c;font-weight:400"> — ${ev.act}</span>`:''}</div>
                ${ev._makeupFrom?`<div style="display:inline-block;background:#e1f5fe;color:#0288d1;border-radius:4px;padding:1px 5px;font-size:11px;font-weight:800;border:1px solid #b3e5fc;margin-top:2px">📅 השלמה</div>`:''}
                <div style="font-size:12px;color:#5c6bc0;margin-top:1px">${ev.tp||'חוג'}${ev.grp>1?` · <span style="color:#546e7a">👥${ev.grp}</span>`:''}</div>
                ${ev.t?`<div style="font-size:12px;color:#546e7a">⏰ ${fT(ev.t)}</div>`:''}
              </div>
              <div style="display:flex;flex-direction:column;gap:2px;flex-shrink:0" onclick="event.stopPropagation()">
                <button title="התקיים" style="background:${ev.st==='done'?'#2e7d32':'#e8f5e9'};color:${ev.st==='done'?'#fff':'#2e7d32'};border:none;border-radius:3px;padding:2px 5px;font-size:12px;cursor:pointer;line-height:1.4"
                  onclick="openSP(${ev.id});setTimeout(()=>setStatus('done'),80)">✔️</button>
                <button title="בטל" style="background:${ev.st==='can'?'#c62828':'#ffebee'};color:${ev.st==='can'?'#fff':'#c62828'};border:none;border-radius:3px;padding:2px 5px;font-size:12px;cursor:pointer;line-height:1.4"
                  onclick="openSP(${ev.id})">❌</button>
                <button title="לא התקיים" style="background:${ev.st==='nohap'?'#6a1b9a':'#f3e5f5'};color:${ev.st==='nohap'?'#fff':'#6a1b9a'};border:none;border-radius:3px;padding:2px 5px;font-size:12px;cursor:pointer;line-height:1.4"
                  onclick="openSP(${ev.id});setTimeout(()=>markNoHap(),80)">⚠️</button>
                <button title="דחה" style="background:#fff3e0;color:#e65100;border:none;border-radius:3px;padding:2px 5px;font-size:12px;cursor:pointer;line-height:1.4"
                  onclick="event.stopPropagation();openPostpone(${ev.id})">⏩</button>
                <button title="שיבוץ השלמה" class="btn-makeup" style="background:#e3f2fd;color:#1565c0;border:none;border-radius:3px;padding:2px 5px;font-size:12px;cursor:pointer;line-height:1.4"
                  onclick="event.stopPropagation();openMakeupSched(${ev.id})">📅</button>
              </div>
            </div>
          </div>`;
        });
        if(blk) inner+=`<div style="font-size:.68rem;color:#c62828;padding:2px 4px">${blk.icon||'🚫'} ${blk.reason}</div>`;
      } else if(blk){
        inner=`<div style="font-size:.72rem;color:#c62828;padding:4px;text-align:center">${blk.icon||'🚫'} ${blk.reason}</div>`;
      } else if(hol){
        inner=`<span style="font-size:.7rem;color:${hol.color}">${hol.emoji}</span>`;
      } else {
        inner=`<div style="color:#c8cdd5;font-size:1.4rem;font-weight:300;text-align:center;line-height:1;padding:4px 0;cursor:pointer;user-select:none">+</div>`;
      }
      return `<td style="background:${cellBg};
        border-bottom:1px solid ${borderColor};border-left:1px solid ${borderColor};
        ${blk?'border:1.5px solid #e91e63;':''}
        padding:4px;vertical-align:top;min-width:130px"
        onclick="openGcellPopup(${gid},'${ds}',event)">${inner}</td>`;
    }

    // Pairs
    byCity[city].pairs.forEach(({pair,gids:pGids})=>{
      const pairGidList = pGids.join(',');
      html+=`<tr>
        <td colspan="7" style="background:${clr.solid};color:#fff;padding:5px 12px;
          font-size:.82rem;font-weight:800;border-bottom:1px solid rgba(255,255,255,.2)">
          <div style="display:flex;align-items:center;gap:8px">
            <button onclick="event.stopPropagation();_exportPairWA([${pairGidList}])"
              style="background:rgba(255,255,255,.22);border:none;border-radius:5px;color:#fff;
                font-size:.72rem;padding:3px 10px;cursor:pointer;white-space:nowrap;flex-shrink:0">📋 הודעה</button>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🔗 ${pair.name}</span>
          </div>
        </td>
      </tr>`;
      pGids.forEach(gid=>{
        const g=G(gid);
        html+=`<tr><td style="background:#fafbff;font-size:14px;padding:6px 10px;color:#333;font-weight:700;
          border-right:3px solid ${clr.solid};border-bottom:1px solid #dde1f0;border-left:1px solid #dde1f0;
          position:sticky;right:0;z-index:1;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis">
          ${g.name}<br><span style="font-size:12px;color:#78909c;font-weight:400">${g.city}</span>
        </td>`;
        days.forEach(d=>{
          const ds=d2s(d);
          const hol=getHolidayInfo(ds,g.city,gcls(g));
          const gBlk=getGardenBlock(gid,ds);
          const de=evs.filter(s=>s.g===gid&&s.d===ds).sort((a,b)=>(a.t||'').localeCompare(b.t||''));
          html+=makeCell(gid,ds,de,gBlk,hol,clr);
        });
        html+='</tr>';
      });
    });

    // Solo gardens
    byCity[city].solos.forEach(gid=>{
      const g=G(gid);
      html+=`<tr><td style="background:#fafbff;font-size:14px;padding:6px 10px;color:#333;font-weight:700;
        border-right:3px solid ${clr.solid};border-bottom:1px solid #dde1f0;border-left:1px solid #dde1f0;
        position:sticky;right:0;z-index:1;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis">
        ${g.name}<br><span style="font-size:12px;color:#78909c;font-weight:400">${g.city}</span>
      </td>`;
      days.forEach(d=>{
        const ds=d2s(d);
        const hol=getHolidayInfo(ds,g.city,gcls(g));
        const soloBlk=getGardenBlock(gid,ds);
        const de=evs.filter(s=>s.g===gid&&s.d===ds).sort((a,b)=>(a.t||'').localeCompare(b.t||''));
        html+=makeCell(gid,ds,de,soloBlk,hol,clr);
      });
      html+='</tr>';
    });
  });

  return html+'</tbody></table></div>';
}

function renderPairWeek(evs,ws,gids){
  const days=[],dn=['ראשון','שני','שלישי','רביעי','חמישי','שישי'],tday=td();
  for(let i=0;i<6;i++) days.push(addD(ws,i));
  const cols=[gids[0]||null,gids[1]||null,gids[2]||null];
  const pair=gids[0]?gardenPair(gids[0]):null;
  const clr=pair?pairWeekColors(pair.id):{solid:'#1565c0',light:'#e3f2fd'};
  let html='<div class="tw"><table class="wpt"><thead><tr><th class="dth" style="min-width:75px">יום</th>';
  cols.forEach((gid,i)=>{
    if(!gid){html+=`<th class="thx">—</th>`;return;}
    const g=G(gid);
    html+=`<th style="background:${clr.solid};color:#fff;padding:6px 7px;text-align:center;border:1px solid #c5cae9">🏫 ${g.name}<br><span style="font-size:.66rem;font-weight:400;opacity:.9">${g.city}</span></th>`;
  });
  html+='</tr></thead><tbody>';
  days.forEach((d,i)=>{
    const ds=d2s(d);
    const hol=getHolidayInfo(ds);
    const holStyle=hol?`background:${hol.bg};`:'';
    html+=`<tr><td class="dth" style="${ds===tday?'background:#1565c0;color:#fff;':holStyle} text-align:center;white-space:nowrap;font-weight:700">${dn[i]}<br><span style="font-size:.66rem;font-weight:400">${fD(ds)}</span><br><span style="font-size:.58rem;font-weight:400;opacity:.8">${toHebDate(ds)}</span>${hol?`<br><span style="font-size:.64rem;color:${hol.color}">${hol.name}</span>`:''}</td>`;
    cols.forEach((gid,ci)=>{
      if(!gid){html+=`<td style="background:#f5f5f5"></td>`;return;}
      const de=evs.filter(s=>s.g===gid&&s.d===ds).sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
      const cellBg=hol?hol.bg:'#fff';
      const pwBlk=getGardenBlock(gid,ds);
      html+=`<td style="background:${pwBlk?'#fce4ec':cellBg};${pwBlk?'border:1.5px solid #e91e63;':''}" onclick="openGcellPopup(${gid},'${ds}',event)">${de.length?de.map(ev=>`<div style="border-radius:4px;padding:4px 6px;margin-bottom:3px;cursor:pointer;font-size:.72rem;background:${clr.light};border-right:2px solid ${clr.solid};" onclick="event.stopPropagation();openSP(${ev.id})"><div style="font-weight:700;color:#1a237e">${ev.a}</div>${ev.t?`<div style="font-size:.68rem;color:#546e7a">⏰ ${fT(ev.t)}</div>`:''}</div>`).join('')+(pwBlk?`<div style="font-size:.62rem;color:#c62828">${pwBlk.icon||'🚫'} ${pwBlk.reason}</div>`:'')
        :pwBlk?`<div style="font-size:.68rem;color:#c62828;padding:4px;text-align:center">${pwBlk.icon||'🚫'} ${pwBlk.reason}</div>`
        :'<span style="color:#ccc;font-size:.8rem;cursor:pointer">+</span>'}</td>`;
    });
    html+='</tr>';
  });
  return html+'</tbody></table></div>';
}

// Quick action buttons for list/weekly views
function _quickActionBtns(s){
  const sid=s.id;
  const isDone=s.st==='done', isCan=s.st==='can', isNohap=s.st==='nohap';
  return `<div class="qacts" style="opacity:1;display:flex;gap:3px;flex-shrink:0" onclick="event.stopPropagation()">
    ${isDone?'':`<button title="התקיים" style="background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7;border-radius:4px;padding:2px 5px;font-size:.72rem;cursor:pointer;line-height:1"
      onclick="qSetSt(${sid},'done')">✔️</button>`}
    ${isCan?'':`<button title="בטל" style="background:#ffebee;color:#c62828;border:1px solid #ef9a9a;border-radius:4px;padding:2px 5px;font-size:.72rem;cursor:pointer;line-height:1"
      onclick="openCanQ(${sid})">❌</button>`}
    ${isNohap?'':`<button title="לא התקיים" style="background:#f3e5f5;color:#6a1b9a;border:1px solid #ce93d8;border-radius:4px;padding:2px 5px;font-size:.72rem;cursor:pointer;line-height:1"
      onclick="qSetSt(${sid},'nohap')">⚠️</button>`}
    <button title="דחה" style="background:#fff3e0;color:#e65100;border:1px solid #ffcc80;border-radius:4px;padding:2px 5px;font-size:.72rem;cursor:pointer;line-height:1"
      onclick="openPostpone(${sid})">⏩</button>
    <button title="שיבוץ השלמה" class="btn-makeup" style="background:#e3f2fd;color:#1565c0;border:1px solid #90caf9;border-radius:4px;padding:2px 5px;font-size:.72rem;cursor:pointer;line-height:1"
      onclick="openMakeupSched(${sid})">📅</button>
  </div>`;
}

// List view for a date range (used when range sub-view = list)
function renderRangeListView(evs, fromDs, toDs){
  const tday=td();
  const byDate={};
  evs.forEach(s=>{
    const dk=s._isPostponed?s.pd:s.d;
    if(dk>=fromDs&&dk<=toDs){ if(!byDate[dk]) byDate[dk]=[]; byDate[dk].push(s); }
  });
  const dates=Object.keys(byDate).sort();
  const totalEvs=dates.reduce((n,d)=>n+byDate[d].length,0);
  let h=`<div style="font-size:.78rem;color:#546e7a;padding:6px 10px;background:#e8eaf6;border-radius:7px;margin-bottom:8px">
    📊 ${dates.length} ימים · ${totalEvs} פעילויות | ${fD(fromDs)} – ${fD(toDs)}
  </div><div class="card" style="padding:0;overflow:hidden">`;
  if(!dates.length) return h+'<div style="padding:20px;text-align:center;color:#999">אין פעילויות בטווח זה</div></div>';

  dates.forEach(ds=>{
    const dayEvs=byDate[ds].sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
    const isToday=ds===tday;
    const hol=getHolidayInfo(ds);
    const blk=getBlockedInfo(ds);

    h+=`<div style="border-bottom:2px solid #c5cae9">
      <div style="background:${isToday?'#1565c0':hol?hol.bg:blk?'#fce4ec':'#e8eaf6'};color:${isToday?'#fff':hol?hol.color:blk?'#c62828':'#283593'};padding:6px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="jumpToDay('${ds}')">
        <span style="font-weight:700;font-size:.82rem">📅 ${dayN(ds)} ${fD(ds)}</span>
        <span style="display:flex;gap:8px;align-items:center">
          ${hol?`<span style="font-size:.7rem">${hol.emoji} ${hol.name}</span>`:''}
          ${blk?`<span style="font-size:.7rem;cursor:pointer" onclick="event.stopPropagation();openBlockedDate('${ds}')">${blk.icon} ${blk.reason} ✏️</span>`:`<span style="font-size:.65rem;opacity:.4;cursor:pointer" onclick="event.stopPropagation();openBlockedDate('${ds}')" title="חסום">🚫</span>`}
          <span style="font-size:.72rem">${dayEvs.length} פעילויות</span>
        </span>
      </div>
      <div style="padding:6px 8px">`;

    const allCities=[...new Set(dayEvs.map(s=>G(s.g).city||'אחר'))].sort((a,b)=>a.localeCompare(b,'he'));

    allCities.forEach(city=>{
      const cityEvs=dayEvs.filter(s=>(G(s.g).city||'אחר')===city);
      const clr=CITY_COLORS(city);

      h+=`<div style="margin-bottom:8px">
        <div style="background:${clr.light};border-right:4px solid ${clr.solid};border-radius:6px;padding:5px 10px;margin-bottom:5px;font-weight:800;color:${clr.solid};font-size:.88rem">
          🏙️ ${city} · ${cityEvs.length}
        </div>`;

      // ── Group mode: pairs first OR clusters first based on _listGroupMode ──
      const _gmode = typeof _listGroupMode!=='undefined' ? _listGroupMode : 'pairs';

      // Step 1: determine first-priority group
      const firstUsedGids=new Set();

      if(_gmode==='clusters'){
        // Clusters first
        const dayClusters=(typeof getClusters==='function'?getClusters():[]).filter(cl=>
          (cl.city===city||!cl.city)&&(cl.gardenIds||[]).some(gid=>cityEvs.some(s=>s.g===parseInt(gid))));
        const clusteredGids=new Set();
        dayClusters.forEach(cl=>{
          const clEvs=cityEvs.filter(s=>(cl.gardenIds||[]).map(x=>parseInt(x)).includes(s.g))
            .sort((a,b)=>(G(a.g).name||'').localeCompare(G(b.g).name||'','he')||(a.t||'99:99').localeCompare(b.t||'99:99'));
          if(!clEvs.length) return;
          clEvs.forEach(s=>{clusteredGids.add(s.g);firstUsedGids.add(s.g);});
          const clGids=clEvs.map(s=>s.g);
          h+=`<div style="margin-bottom:4px;border:1px solid ${clr.border||clr.solid+'44'};border-radius:6px;overflow:hidden">
            <div style="background:${clr.solid}22;padding:2px 8px;font-size:.7rem;font-weight:700;color:${clr.solid};display:flex;align-items:center;justify-content:space-between">
              <span>🏘️ ${cl.name}</span>
              <button onclick="event.stopPropagation();_exportPairWA(${JSON.stringify(clGids)})" style="background:${clr.solid};border:none;border-radius:4px;padding:1px 6px;cursor:pointer;font-size:.65rem;color:#fff">📋 הודעה</button>
            </div>`;
          clEvs.forEach(s=>{ h+=_listRow(s,clr); });
          h+=`</div>`;
        });
        // Pairs second (only non-clustered)
        const pairedGids=new Set();
        const pairGroups=[];
        pairs.forEach(pair=>{
          if(typeof isPairBroken==='function'&&isPairBroken(pair.id,ds)) return;
          const isM = s => (s._makeupFrom || (s.nt && s.nt.includes('השלמה')));
          const pairEvs=cityEvs.filter(s=>pair.ids.includes(s.g)&&!firstUsedGids.has(s.g) && !isM(s));
          if(!pairEvs.length) return;
          pairEvs.forEach(s=>{pairedGids.add(s.g);firstUsedGids.add(s.g);});
          pairGroups.push({pair,pairEvs});
        });
        pairGroups.sort((a,b)=>(a.pair.name||'').localeCompare(b.pair.name||'','he'));
        pairGroups.forEach(({pair,pairEvs})=>{
          const sorted=pairEvs.sort((a,b)=>(G(a.g).name||'').localeCompare(G(b.g).name||'','he')||(a.t||'99:99').localeCompare(b.t||'99:99'));
          h+=`<div style="margin-bottom:4px;border:1px solid ${clr.border||clr.solid+'44'};border-radius:6px;overflow:hidden">
            <div style="background:${clr.solid}22;padding:2px 8px;font-size:.7rem;font-weight:700;color:${clr.solid};display:flex;align-items:center;justify-content:space-between">
              <span>🔗 ${pair.name}</span>
              <button onclick="event.stopPropagation();_exportPairWA(${JSON.stringify(pair.ids)})" style="background:${clr.solid};border:none;border-radius:4px;padding:1px 6px;cursor:pointer;font-size:.65rem;color:#fff">📋 הודעה</button>
            </div>`;
          sorted.forEach(s=>{ h+=_listRow(s,clr); });
          h+=`</div>`;
        });
      } else {
        // Pairs first (default)
        const pairedGids=new Set();
        const pairGroups=[];
        pairs.forEach(pair=>{
          if(typeof isPairBroken==='function'&&isPairBroken(pair.id,ds)) return;
          const isM = s => (s._makeupFrom || (s.nt && s.nt.includes('השלמה')));
          const pairEvs=cityEvs.filter(s=>pair.ids.includes(s.g) && !isM(s));
          if(!pairEvs.length) return;
          pairEvs.forEach(s=>{pairedGids.add(s.g);firstUsedGids.add(s.g);});
          pairGroups.push({pair,pairEvs});
        });
        pairGroups.sort((a,b)=>(a.pair.name||'').localeCompare(b.pair.name||'','he'));
        pairGroups.forEach(({pair,pairEvs})=>{
          const sorted=pairEvs.sort((a,b)=>(G(a.g).name||'').localeCompare(G(b.g).name||'','he')||(a.t||'99:99').localeCompare(b.t||'99:99'));
          h+=`<div style="margin-bottom:4px;border:1px solid ${clr.border||clr.solid+'44'};border-radius:6px;overflow:hidden">
            <div style="background:${clr.solid}22;padding:2px 8px;font-size:.7rem;font-weight:700;color:${clr.solid};display:flex;align-items:center;justify-content:space-between">
              <span>🔗 ${pair.name}</span>
              <button onclick="event.stopPropagation();_exportPairWA(${JSON.stringify(pair.ids)})" style="background:${clr.solid};border:none;border-radius:4px;padding:1px 6px;cursor:pointer;font-size:.65rem;color:#fff">📋 הודעה</button>
            </div>`;
          sorted.forEach(s=>{ h+=_listRow(s,clr); });
          h+=`</div>`;
        });
        // Clusters second (non-paired only)
        const dayClusters=(typeof getClusters==='function'?getClusters():[]).filter(cl=>
          (cl.city===city||!cl.city)&&(cl.gardenIds||[]).some(gid=>cityEvs.some(s=>s.g===parseInt(gid)&&!firstUsedGids.has(s.g))));
        dayClusters.forEach(cl=>{
          const clEvs=cityEvs.filter(s=>(cl.gardenIds||[]).map(x=>parseInt(x)).includes(s.g)&&!firstUsedGids.has(s.g))
            .sort((a,b)=>(G(a.g).name||'').localeCompare(G(b.g).name||'','he')||(a.t||'99:99').localeCompare(b.t||'99:99'));
          if(!clEvs.length) return;
          clEvs.forEach(s=>firstUsedGids.add(s.g));
          const clGids=clEvs.map(s=>s.g);
          h+=`<div style="margin-bottom:4px;border:1px solid ${clr.border||clr.solid+'44'};border-radius:6px;overflow:hidden">
            <div style="background:${clr.solid}22;padding:2px 8px;font-size:.7rem;font-weight:700;color:${clr.solid};display:flex;align-items:center;justify-content:space-between">
              <span>🏘️ ${cl.name}</span>
              <button onclick="event.stopPropagation();_exportPairWA(${JSON.stringify(clGids)})" style="background:${clr.solid};border:none;border-radius:4px;padding:1px 6px;cursor:pointer;font-size:.65rem;color:#fff">📋 הודעה</button>
            </div>`;
          clEvs.forEach(s=>{ h+=_listRow(s,clr); });
          h+=`</div>`;
        });
      }

      const _allUsedGids=firstUsedGids;


      // ── Solos sorted by time ──
      cityEvs.filter(s=>!_allUsedGids.has(s.g) || (s._makeupFrom || (s.nt && s.nt.includes('השלמה'))))
        .sort((a,b)=>(G(a.g).name||'').localeCompare(G(b.g).name||'','he')||(a.t||'99:99').localeCompare(b.t||'99:99'))
        .forEach(s=>{ h+=_listRow(s,clr); });

      h+=`</div>`;
    });

    h+='</div></div>';
  });
  return h+'</div>';
}

function renderCalList(evs, mDate){
  const y=mDate.getFullYear(),m=mDate.getMonth();
  const tday=td();
  const byDate={};
  evs.forEach(s=>{
    const dk=s._isPostponed?s.pd:s.d;
    if(!byDate[dk]) byDate[dk]=[];
    byDate[dk].push(s);
  });
  const dates=Object.keys(byDate).sort();
  if(!dates.length) return '<div class="card" style="text-align:center;color:#999;padding:25px">אין פעילויות בחודש זה</div>';

  let h='<div class="card" style="padding:0;overflow:hidden">';
  dates.forEach(ds=>{
    const dayEvs=byDate[ds].sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
    const isToday=ds===tday;
    const hol=getHolidayInfo(ds);
    const blk=getBlockedInfo(ds);

    // Day header
    h+=`<div style="border-bottom:2px solid #c5cae9">
      <div style="background:${isToday?'#1565c0':hol?hol.bg:blk?'#fce4ec':'#e8eaf6'};color:${isToday?'#fff':hol?hol.color:blk?'#c62828':'#283593'};padding:6px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="jumpToDay('${ds}')">
        <span style="font-weight:700;font-size:.82rem">📅 ${dayN(ds)} ${fD(ds)}</span>
        <span style="display:flex;gap:8px;align-items:center">
          ${hol?`<span style="font-size:.7rem">${hol.emoji} ${hol.name}</span>`:''}
          ${blk?`<span style="font-size:.7rem;cursor:pointer" onclick="event.stopPropagation();openBlockedDate('${ds}')">${blk.icon} ${blk.reason} ✏️</span>`:`<span style="font-size:.65rem;opacity:.4;cursor:pointer" onclick="event.stopPropagation();openBlockedDate('${ds}')" title="חסום תאריך">🚫</span>`}
          <span style="font-size:.72rem;opacity:.8">${dayEvs.length} פעילויות</span>
        </span>
      </div>`;

    h+='<div style="padding:6px 8px">';

    // Group by city → sort cities
    const allCities=[...new Set(dayEvs.map(s=>G(s.g).city||'אחר'))].sort((a,b)=>a.localeCompare(b,'he'));

    allCities.forEach(city=>{
      const cityEvs=dayEvs.filter(s=>(G(s.g).city||'אחר')===city);
      const clr=CITY_COLORS(city);

      h+=`<div style="margin-bottom:8px">`;
      // City header
      h+=`<div style="display:flex;align-items:center;gap:6px;padding:5px 10px;margin-bottom:5px;background:${clr.light};border-right:4px solid ${clr.solid};border-radius:6px">
        <span style="font-weight:800;color:${clr.solid};font-size:.88rem">🏙️ ${city}</span>
        <span style="font-size:.72rem;color:#78909c">${cityEvs.length} פעילויות</span>
      </div>`;

      // ── Group mode: _listGroupMode controls pairs vs clusters priority ──
      const _gmode2 = typeof _listGroupMode!=='undefined' ? _listGroupMode : 'pairs';
      const pairedGids=new Set();
      const clusteredGidsC=new Set();

      const _renderCluster2=(cl)=>{
        const clEvs=cityEvs.filter(s=>(cl.gardenIds||[]).map(x=>parseInt(x)).includes(s.g)&&!pairedGids.has(s.g)&&!clusteredGidsC.has(s.g))
          .sort((a,b)=>(G(a.g).name||'').localeCompare(G(b.g).name||'','he')||(a.t||'99:99').localeCompare(b.t||'99:99'));
        if(!clEvs.length) return;
        clEvs.forEach(s=>clusteredGidsC.add(s.g));
        const clGids2=clEvs.map(s=>s.g);
        h+=`<div style="margin-bottom:4px;border:1px solid ${clr.border};border-radius:6px;overflow:hidden">
          <div style="background:${clr.solid}22;padding:3px 8px;font-size:.72rem;font-weight:700;color:${clr.solid};display:flex;align-items:center;justify-content:space-between">
            <span>🏘️ ${cl.name}</span>
            <button onclick="event.stopPropagation();_exportPairWA(${JSON.stringify(clGids2)})" style="background:${clr.solid};border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:.68rem;color:#fff;font-weight:700">📋 הודעה</button>
          </div>`;
        clEvs.forEach(s=>{ h+=_listRow(s,clr); });
        h+=`</div>`;
      };
      const clAll=(typeof getClusters==='function'?getClusters():[]).filter(cl=>
        (cl.gardenIds||[]).some(gid=>cityEvs.some(s=>s.g===parseInt(gid))));

      if(_gmode2==='clusters'){
        // Clusters first
        clAll.forEach(cl=>_renderCluster2(cl));
      }

      // Pairs (skip already-clustered if clusters-first mode)
      const pairGroups=[];
      pairs.forEach(pair=>{
        if(isPairBroken&&isPairBroken(pair.id,ds)) return;
        const isM = s => (s._makeupFrom || (s.nt && s.nt.includes('השלמה')));
        const pairEvs=cityEvs.filter(s=>pair.ids.includes(s.g)&&!clusteredGidsC.has(s.g) && !isM(s));
        if(!pairEvs.length) return;
        pairEvs.forEach(s=>pairedGids.add(s.g));
        pairGroups.push({pair,pairEvs});
      });
      pairGroups.sort((a,b)=>(a.pair.name||'').localeCompare(b.pair.name||'','he'));

      if(_gmode2==='pairs'){
        // Clusters second (skip paired)
        clAll.forEach(cl=>_renderCluster2(cl));
      }

      // ── Render pairs ──
      pairGroups.sort((a,b)=>(a.pair.name||'').localeCompare(b.pair.name||'','he'));

      pairGroups.forEach(({pair,pairEvs})=>{
        // Sort pair events by garden name then time
        const sorted=pairEvs.sort((a,b)=>{
          const na=G(a.g).name||'', nb=G(b.g).name||'';
          return na.localeCompare(nb,'he')||(a.t||'99:99').localeCompare(b.t||'99:99');
        });
        h+=`<div style="margin-bottom:4px;border:1px solid ${clr.border};border-radius:6px;overflow:hidden">
          <div style="background:${clr.solid}22;padding:3px 8px;font-size:.72rem;font-weight:700;color:${clr.solid};display:flex;align-items:center;justify-content:space-between">
            <span>🔗 ${pair.name}</span>
            <button onclick="event.stopPropagation();_exportPairWA(${JSON.stringify(pair.ids)})" style="background:${clr.solid};border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:.68rem;color:#fff;font-weight:700">📋 הודעה</button>
          </div>`;
        sorted.forEach(s=>{ h+=_listRow(s,clr); });
        h+=`</div>`;
      });

      // Solos — sorted by garden name (not in pair or cluster)
      const soloEvs=cityEvs
        .filter(s=>!pairedGids.has(s.g)&&!clusteredGidsC.has(s.g))
        .sort((a,b)=>{
          const na=G(a.g).name||'', nb=G(b.g).name||'';
          return na.localeCompare(nb,'he')||(a.t||'99:99').localeCompare(b.t||'99:99');
        });
      soloEvs.forEach(s=>{ h+=_listRow(s,clr); });

      h+=`</div>`; // end city
    });

    h+='</div></div>';
  });
  return h+'</div>';
}

function _listRow(s, clr){
  const g=G(s.g);
  const stC=s.st==='nohap'?'#c62828':s.st==='post'?'#e65100':s.st==='done'?'#2e7d32':'#333';
  const addrLink=g.st?`<a href="https://maps.google.com/?q=${encodeURIComponent(g.st+' '+g.city)}" target="_blank" onclick="event.stopPropagation()" style="font-size:.63rem;color:#1565c0;text-decoration:none">📍 ${g.st}</a>`:'';
  return `<div style="display:grid;grid-template-columns:120px 1fr auto auto auto;align-items:center;gap:5px;padding:3px 6px;border-radius:4px;margin-bottom:2px;background:${s.st==='done'?'#f1f8e9':s.st==='nohap'?'#fce4ec':clr.light};border-right:3px solid ${clr.solid};cursor:pointer" onclick="openSP(${s.id})">
    <div>
      <div style="font-weight:700;font-size:.75rem;color:#1a237e">${g.name}</div>
      <div style="font-size:.65rem;color:#78909c">${s.t?'⏰ '+fT(s.t):''}</div>
      ${addrLink}
    </div>
    <div>
      <div style="font-size:.75rem;font-weight:600;color:#1565c0">${supBase(s.a)}${s.act?' — <span style="color:#546e7a">'+s.act+'</span>':''}</div>
      ${s._makeupFrom?`<div style="display:inline-block;background:#e1f5fe;color:#0288d1;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:800;border:1px solid #b3e5fc;margin-top:2px">📅 השלמה</div>`:''}
      <div style="font-size:.65rem;color:#5c6bc0">${s.tp||'חוג'}</div>
    </div>
    <div style="font-size:.7rem;font-weight:700;color:${stC}">${stLabel(s).replace(/<[^>]+>/g,'')}</div>
    ${_quickActionBtns(s)}
  </div>`;
}

function renderMonth(evs,mDate){
  const y=mDate.getFullYear(),m=mDate.getMonth(),tday=td();
  const fd=new Date(y,m,1),ld=new Date(y,m+1,0);
  const cnt={};evs.forEach(s=>{const dk=s._isPostponed?s.pd:s.d;if(!cnt[dk])cnt[dk]={t:0,c:0};cnt[dk].t++;if(s.st==='can')cnt[dk].c++;});
  let html='<div class="card"><div class="mgrid">';
  ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'].forEach(d=>html+=`<div class="mdh">${d}</div>`);
  for(let i=0;i<fd.getDay();i++) html+='<div class="md om"></div>';
  for(let d=1;d<=ld.getDate();d++){
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const c=cnt[ds];
    const hol=getHolidayInfo(ds);
    const blkM=getBlockedInfo(ds);
    const holStyle=hol?`background:${hol.bg};border-top:3px solid ${hol.border};`:(blkM?'background:#fce4ec;border-top:3px solid #e91e63;':'');
    html+=`<div class="md ${ds===tday?'tdy':''} ${c?'hev':''}" style="${holStyle}" onclick="jumpToDay('${ds}')">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div class="dnum" style="${blkM?'color:#c62828':''}">${d}</div>
          <div style="font-size:.58rem;color:#9e9e9e;line-height:1;margin-top:1px">${toHebDate(ds)}</div>
        </div>
        <span style="font-size:.55rem;opacity:${blkM?1:.25};cursor:pointer;color:${blkM?'#c62828':'#999'}" onclick="event.stopPropagation();openBlockedDate('${ds}')" title="${blkM?'ערוך חסימה':'חסום תאריך'}">${blkM?blkM.icon||'🚫':'🚫'}</span>
      </div>
      ${hol?`<div style="font-size:.65rem;color:${hol.color};font-weight:700">${hol.emoji} ${hol.name}</div>`:''}
      ${blkM?`<div style="font-size:.62rem;color:#c62828;font-weight:700">${blkM.reason}${blkM.note?' — '+blkM.note:''}</div>`:''}
      ${c?`<div class="mcnt">${c.t} פעילויות</div>`:''}
    </div>`;
  }
  const e=ld.getDay();for(let i=e+1;i<7;i++) html+='<div class="md om"></div>';
  return html+'</div></div>';
}

let _calTab='g'; // 'g'=גנים 's'=בתי ספר
function setCalTab(t){
  _calTab=t;
  document.getElementById('cal-tab-g').classList.toggle('active',t==='g');
  document.getElementById('cal-tab-s').classList.toggle('active',t==='s');
  // Sync the hidden cal-cls select so existing filter logic still works
  const clsSel=document.getElementById('cal-cls');
  if(clsSel) clsSel.value=t==='g'?'גנים':'ביה"ס';
  // Reset garden selectors when switching
  ['cal-g1','cal-g2','cal-g3'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value='';
  });
  calRefG();
}
var _dashTab='g'; // 'g'=גנים 's'=בתי ספר
