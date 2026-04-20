window._dashTab = window._dashTab || 'g';

function setDashTab(t){
  window._dashTab=t;
  document.getElementById('dash-tab-g').classList.toggle('active',t==='g');
  document.getElementById('dash-tab-s').classList.toggle('active',t==='s');
  renderDash();
}

function renderDash(){
  const dateEl=document.getElementById('dash-date');
  const cityEl=document.getElementById('dash-city');
  const supEl=document.getElementById('dash-sup');
  const stEl=document.getElementById('dash-st');
  if(!dateEl || !cityEl || !supEl || !stEl) return;

  const date=dateEl.value;
  const city=cityEl.value;
  const sup=supEl.value;
  const st=stEl.value;
  const tab = (typeof window._dashTab !== 'undefined' ? window._dashTab : 'g');
  const srch=(document.getElementById('dash-srch')||{value:''}).value.toLowerCase();
  
  console.log(`[Dash Debug] v92.5 Start. Tab:${tab}, St:${st}, Date:${date}, SCH:${window.SCH ? window.SCH.length : 'null'}`);

  const checkMatch = (s, tTab, tSt, tDate) => {
    const isHandled = !!(s._compByMakeup && s._compByMakeup !== "false" && s._compByMakeup !== "");
    const isExc = (s.st === 'nohap' || s.st === 'post') && !isHandled;
    const isM = !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה/i.test(s.nt)));
    
    const g = window.G(s.g);
    const gClass = window.gcls ? window.gcls(g) : 'גנים';

    if (tTab === 'g' && gClass !== 'גנים') return false;
    if (tTab === 's' && gClass !== 'ביה"ס') return false;

    if (tSt === 'todo') {
      if (isExc) return true;
      if (isM && s.st !== 'done') {
        if (tDate && s.d !== tDate) return false;
        return true;
      }
      return false;
    } else if (tSt === 'handled') {
      if (!isHandled) return false;
    } else if (tSt) {
      if (s.st !== tSt) return false;
    } else {
      if (s.st === 'can' || isHandled) return false;
    }

    if (tDate && s.d !== tDate) return false;
    if (city && g.city !== city) return false;
    if (sup && window.supBase(s.a) !== sup && s.a !== sup) return false;
    if (srch && ![(g.name||''), (g.city||''), s.a, s.act].some(v=>(v||'').toLowerCase().includes(srch))) return false;

    return true;
  };

  const todoG = (window.SCH || []).filter(s => checkMatch(s, 'g', 'todo', null)).length;
  const todoS = (window.SCH || []).filter(s => checkMatch(s, 's', 'todo', null)).length;
  const gBtn = document.getElementById('dash-tab-g');
  const sBtn = document.getElementById('dash-tab-s');
  if(gBtn) gBtn.textContent = `🚀 גני ילדים (${todoG})`;
  if(sBtn) sBtn.textContent = `🏫 בתי ספר (${todoS})`;

  const evs = (window.SCH || []).filter(s => checkMatch(s, tab, st, date))
    .sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));

  if(!evs.length){
    const emptyMsg = date ? `אין חריגים/השלמות לטיפול בתאריך ${window.fD(date)}` : 'אין חריגים/השלמות לטיפול (כל התאריכים)';
    document.getElementById('dash-body').innerHTML = `<p style="color:#999;font-size:.85rem;padding:20px;text-align:center">${emptyMsg}</p>`;
  } else {
    let h='';
    if(st==='todo'){
      h+=`<div class="card" style="margin-bottom:10px;padding:10px">
        <div style="font-weight:800;color:#1a237e;font-size:.9rem;margin-bottom:10px">📋 רשימת טיפולים מאוחדת (${evs.length})</div>`;
      const byCity={};
      evs.forEach(s=>{
        const g = window.G(s.g);
        const c = g.city || 'אחר';
        if(!byCity[c]) byCity[c]=[];
        byCity[c].push({...s, gd:g});
      });
      Object.keys(byCity).sort().forEach(c=>{
        h+=`<div class="dcity" style="margin-bottom:5px;background:#f5f5f5;padding:4px 10px;border-radius:4px">🏙️ ${c}</div>`;
        byCity[c].forEach(item=>{
           try { h+=_dashListRow(item); } catch(e){ console.error(e); }
        });
      });
      h+=`</div>`;
    } else {
      const bySup={};
      evs.forEach(s=>{
        const g = window.G(s.g);
        if(!bySup[s.a]) bySup[s.a]={name:s.a,ph:s.p||'',evs:[]};
        bySup[s.a].evs.push({...s, gd:g});
      });
      Object.values(bySup).sort((a,b)=>a.name.localeCompare(b.name,'he')).forEach(supData=>{
        const byCity={};
        supData.evs.forEach(s=>{
          const c=s.gd.city||'אחר';
          if(!byCity[c]) byCity[c]=[];
          byCity[c].push(s);
        });
        h+=`<div class="card" style="margin-bottom:10px;padding:10px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="font-weight:800;color:#1a237e;font-size:.9rem">📚 ${window.supBase(supData.name)}</div>
            ${window.supAct(supData.name)?`<div style="font-size:.75rem;color:#1565c0;font-weight:600">🎯 ${window.supAct(supData.name)}</div>`:''}
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              ${supData.ph?`<span style="font-size:.75rem;color:#546e7a">📞 ${supData.ph}</span>`:''}
              <span class="bdg bb" style="font-size:.7rem">${supData.evs.length} גנים</span>
              <button class="btn bp bsm" style="font-size:.68rem;padding:2px 7px" onclick="openSupExport('${supData.name}')">📊 יצוא לאקסל</button>
            </div>
          </div>`;
        Object.keys(byCity).sort().forEach(c=>{
          const ce=byCity[c];
          h+=`<div style="margin-bottom:8px">
            <div class="dcity" style="margin-bottom:5px">🏙️ ${c} (${ce.length})</div>`;
          const usedIds=new Set();
          const rows=[];
          window.pairs.forEach(pair=>{
            const pairEvs=ce.filter(s=>pair.ids.includes(s.g));
            if(!pairEvs.length) return;
            pairEvs.forEach(s=>usedIds.add(s.id));
            rows.push({type:'pair',pair,evs:pairEvs});
          });
          ce.filter(s=>!usedIds.has(s.id)).forEach(s=>rows.push({type:'solo',ev:s}));
          rows.sort((a,b)=>{
            const nameA=a.type==='pair'?a.pair.name:window.G(a.ev.g).name;
            const nameB=b.type==='pair'?b.pair.name:window.G(b.ev.g).name;
            return nameA.localeCompare(nameB,'he');
          });
          rows.forEach(row=>{
            if(row.type==='pair'){
              const _dashClr=window.CITY_COLORS(window.G(row.pair.ids[0]).city);
              h+=window.renderPairCard(row.pair,row.evs,{ds:date,clr:_dashClr,showEdit:true,showExport:true});
            } else {
              const s=row.ev;
              const stc=s.st!=='ok'?'st-'+s.st:'';
              const _sc=window.CITY_COLORS(window.G(s.g).city);
              h+=`<div class="city-block" style="margin-bottom:7px">
                <div class="city-block-hdr" style="background:${_sc.solid};font-size:.76rem">
                   🏫 ${s.gd.name}
                   <span style="font-size:.67rem;opacity:.8;font-weight:400">📍 ${window.G(s.g).city}</span>
                   <button onclick="event.stopPropagation();window._exportGardenWA([${s.g}],'${date}')" style="background:rgba(255,255,255,.28);border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:.68rem;color:#fff;font-weight:700">📋 הודעה</button>
                </div>
                <div style="background:#fff;padding:7px">
                  <div class="ev ${stc}" onclick="window.openSP(${s.id})" style="border-radius:5px;border:none;border-right:3px solid ${_sc.solid};background:${_sc.light};margin:0">
                    <span class="est">${window.stLabel(s)}</span>
                    <div class="eg">${s.gd.name}</div>
                    ${s.act?`<div style="font-size:.67rem;font-weight:600;color:${_sc.solid}">🎯 ${s.act}</div>`:''}
                    ${s.t?`<div class="et">⏰ ${window.fT(s.t)}</div>`:''}
                  </div>
                </div>
              </div>`;
            }
          });
          h+='</div>';
        });
        h+=`</div>`;
      });
    }
    document.getElementById('dash-body').innerHTML=h;
  }
}

function _dashListRow(s){
  const g=window.G(s.g);
  const _sc=window.CITY_COLORS(g.city);
  const isM = !!(s._makeupFrom || (s.nt && s.nt.includes('השלמה')));
  return `<div style="display:grid;grid-template-columns:110px 140px 1fr 100px;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid #eee;cursor:pointer;background:#fff" onclick="window.openSP(${s.id})">
    <div style="font-weight:700;color:#1a237e;font-size:.82rem">${g.name}</div>
    <div style="font-size:.78rem;color:#546e7a">${g.city} | ${window.gcls ? window.gcls(g) : ''}</div>
    <div style="font-size:.82rem;color:#1565c0;font-weight:600">🎯 ${s.act||'—'} ${isM?'<span style="color:#0288d1;font-size:.7rem">(השלמה)</span>':''}</div>
    <div style="display:flex;flex-direction:column;align-items:flex-end">
       <div style="font-size:.75rem;font-weight:700;color:#333">${s.t? (window.fT?window.fT(s.t):s.t) : '--:--'}</div>
       <div style="transform:scale(0.85);transform-origin:left">${window.stLabel ? window.stLabel(s) : ''}</div>
    </div>
  </div>`;
}

function renderCanList(){
  const tab = (typeof _dashTab !== 'undefined' ? _dashTab : 'g');
  const cls = tab === 'g' ? 'גנים' : 'ביה"ס';
  const safeSort = (a, b) => (b.d || '').localeCompare(a.d || '');
  const todoEvs = window.SCH.filter(s => {
    const isM = !!(s._makeupFrom || (s.nt && s.nt.includes('השלמה')));
    const isHandled = !!s._compByMakeup;
    let match = false;
    if ((s.st === 'nohap' || s.st === 'post') && !isHandled) match = true;
    else if (isM && s.st !== 'done') match = true;
    if (!match) return false;
    const g = window.G(s.g);
    return g && window.gcls(g) === cls;
  }).sort(safeSort);
  const handledEvs = window.SCH.filter(s => {
    if (!((s.st === 'nohap' || s.st === 'post') && s._compByMakeup)) return false;
    const g = window.G(s.g);
    return g && window.gcls(g) === cls;
  }).sort(safeSort).slice(0, 25);
  let ch = `<div style="margin-bottom:20px"><div style="font-weight:800;color:#c62828;margin-bottom:8px;font-size:.9rem">🔴 דורש טיפול (השלמה / ביטול סופי) (${todoEvs.length})</div>`;
  if (!todoEvs.length) ch += `<p style="color:#999;font-size:.79rem;padding:10px;background:#f9f9f9;border-radius:6px">אין חריגים הממתינים לטיפול ב${cls}</p>`;
  else ch += _renderMiniTable(todoEvs);
  ch += `</div><div><div style="font-weight:800;color:#2e7d32;margin-bottom:8px;font-size:.9rem">🟢 טופלו לאחרונה (${handledEvs.length})</div>`;
  if (!handledEvs.length) ch += `<p style="color:#999;font-size:.79rem;padding:10px">אין פריטים שטופלו לאחרונה ב${cls}</p>`;
  else ch += _renderMiniTable(handledEvs);
  ch += `</div>`;
  if (document.getElementById('dash-can-body')) document.getElementById('dash-can-body').innerHTML = ch;
}

function _renderMiniTable(evs){
  let h = '<div class="tw"><table><thead><tr><th>תאריך</th><th>עיר</th><th>גן</th><th>ספק</th><th>סטטוס</th><th>סיבה</th></tr></thead><tbody>';
  evs.forEach(s => {
    const g = window.G(s.g);
    h += `<tr onclick="window.openSP(${s.id})" class="${window.stClass?window.stClass(s):''}" style="cursor:pointer"><td>${window.fD(s.d)}</td><td>${g.city||''}</td><td>${g.name||''}</td><td>${s.a||''}</td><td>${window.stLabel(s)}</td><td>${s.cr||''}${s.cn?' ('+s.cn+')':''}</td></tr>`;
  });
  return h + '</tbody></table></div>';
}

function openSP(id){
  window.selEv=id;
  const s=window.SCH.find(x=>x.id===id);if(!s)return;
  const g=window.G(s.g);
  const spPair=window.gardenPair(s.g);
  let h=`<div style="background:#f5f7ff;border-radius:10px;padding:12px;margin-bottom:12px;border:1px solid #dbe3ff"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><div><div style="font-size:1.1rem;font-weight:800;color:#1a237e">${g.name}</div><div style="font-size:.85rem;color:#546e7a">${g.city}</div></div><div style="text-align:left"><div style="font-size:.9rem;font-weight:700;color:#1a237e">${window.fD(s.d)}</div></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;border-top:1px solid #dbe3ff;padding-top:10px"><div><span style="font-size:.75rem;color:#78909c;display:block">📚 ספק</span><span style="font-weight:700;color:#1a237e">${window.supBase(s.a)}</span></div><div><span style="font-size:.75rem;color:#78909c;display:block">🎯 פעילות</span><span style="font-weight:700;color:#1565c0">${s.act||'—'}</span></div></div></div>`;
  h+=`<div style="margin-bottom:15px;background:#fff;border-radius:8px;padding:10px;border:1px solid #eee"><textarea id="sp-nt" rows="2" style="width:100%;font-size:.85rem;border-radius:6px;border:1.5px solid #e0e0e0;padding:8px" placeholder="הוסף הערה...">${s.nt||''}</textarea><button class="btn bp bsm" style="width:100%;margin-top:5px" onclick="window.saveNt()">💾 שמור הערה</button></div>`;
  h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px"><button class="btn bg bsm" onclick="window.setStatus('done')">✔️ התקיים</button><button class="btn bo bsm" onclick="window.setStatus('ok')">🔄 שחזר</button></div>`;
  h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="btn borange bsm" onclick="window.openPostpone(${s.id})">⏩ דחה</button><button class="btn bp bsm" onclick="window.openCopy(${s.id})">📋 העתק</button></div>`;
  document.getElementById('sp-body').innerHTML=h;
  document.getElementById('sp').classList.add('open');
  document.getElementById('sp-backdrop').style.display='block';
}

function saveNt(){
  const s=window.SCH.find(x=>x.id===window.selEv); if(!s) return;
  s.nt=document.getElementById('sp-nt').value;
  window.saveAndRefresh('sp');
}

function closeSP(){
  document.getElementById('sp').classList.remove('open');
  if(document.getElementById('sp-backdrop')) document.getElementById('sp-backdrop').style.display='none';
}

function refresh(){
  window.updCounts();
  window.renderDash();
  window.renderCanList();
  window.renderCal();
}

function saveAndRefresh(modalId){
  window.save();
  if(modalId) window.CM(modalId);
  closeSP();
  window.refresh();
}

window.setDashTab = setDashTab;
window.renderDash = renderDash;
window.renderCanList = renderCanList;
window.openSP = openSP;
window.closeSP = closeSP;
window.saveNt = saveNt;
window.refresh = refresh;
window.saveAndRefresh = saveAndRefresh;

setTimeout(() => { if (typeof renderDash === 'function') renderDash(); }, 100);
