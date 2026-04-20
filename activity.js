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
  
  console.log(`[Dash Debug] v92.6 Start. Tab:${tab}, St:${st}, Date:${date}, SCH:${window.SCH ? window.SCH.length : 'null'}`);

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
                    ${s.act?`<div style="font-size:.67rem;font-weight:600;color:${_sc.solid}">🎯 ${window.supBase(s.a)} | ${s.act}</div>`:''}
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
    <div style="font-size:.82rem;color:#1565c0;font-weight:600">🎯 ${window.supBase(s.a)} | ${s.act||'—'} ${isM?'<span style="color:#0288d1;font-size:.7rem">(השלמה)</span>':''}</div>
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
  const isS=window.gcls(g)==='ביה"ס';
  const spPair=window.gardenPair(s.g);

  let h=`<div style="background:#f5f7ff;border-radius:10px;padding:12px;margin-bottom:12px;border:1px solid #dbe3ff">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div>
        <div style="font-size:1.1rem;font-weight:800;color:#1a237e">${g.name}</div>
        <div style="font-size:.85rem;color:#546e7a">${g.city}${g.st?' | '+g.st:''}</div>
      </div>
      <div style="text-align:left">
        <div style="font-size:.9rem;font-weight:700;color:#1a237e">${window.fD(s.d)}</div>
        <div style="font-size:.8rem;color:#546e7a">יום ${window.dayN(s.d)}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;border-top:1px solid #dbe3ff;padding-top:10px">
      <div><span style="font-size:.75rem;color:#78909c;display:block">📚 ספק</span><span style="font-weight:700;color:#1a237e">${window.supBase(s.a)}</span></div>
      <div><span style="font-size:.75rem;color:#78909c;display:block">🎯 פעילות</span><span style="font-weight:700;color:#1565c0">${s.act||'—'}</span></div>
      ${s.t?`<div><span style="font-size:.75rem;color:#78909c;display:block">⏰ שעה</span><span style="font-weight:700;color:#1a237e">${window.fT(s.t)}</span></div>`:''}
      <div><span style="font-size:.75rem;color:#78909c;display:block">📌 סטטוס</span><span style="transform:scale(0.9);transform-origin:right;display:inline-block">${window.stLabel(s)}</span></div>
    </div>
  </div>`;

  h+=`<div style="margin-bottom:15px;background:#fff;border-radius:8px;padding:10px;border:1px solid #eee">
    <textarea id="sp-nt" rows="2" style="width:100%;font-size:.85rem;border-radius:6px;border:1.5px solid #e0e0e0;padding:8px" placeholder="הוסף הערה...">${s.nt||''}</textarea>
    <button class="btn bp bsm" style="width:100%;margin-top:5px" onclick="window.saveNt()">💾 שמור הערה</button>
  </div>`;

  h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
    <button class="btn bg bsm" onclick="window.setStatus('done')">✔️ התקיים</button>
    <button class="btn bo bsm" onclick="window.setStatus('ok')">🔄 שחזר</button>
  </div>`;

  const isM = !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה/i.test(s.nt)));
  const isExc = (s.st === 'nohap' || s.st === 'post') && !s._compByMakeup;
  
  // Handling Section (Removal from board)
  if (isExc || (isM && s.st !== 'done')) {
    h+=`<div style="background:#fff8e1;border:1.5px solid #ffe082;border-radius:10px;padding:12px;margin-bottom:12px">
      <div style="font-size:.82rem;font-weight:800;color:#e65100;margin-bottom:8px">🛠️ טיפול בחריג / השלמה</div>
      ${spPair ? `
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:10px;cursor:pointer;background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #ffe082">
          <input type="checkbox" id="sp-sync-pair" style="width:17px;height:17px;accent-color:#e65100">
          <span style="font-size:.8rem;font-weight:700;color:#bf360c">🔗 החל גם על בן-הזוג (${spPair.name.replace(g.name,'').replace('+','').trim()})</span>
        </label>
      ` : ''}
      <button class="btn borange" style="width:100%;padding:10px;font-weight:800" onclick="window.markCompManual(${s.id})">🗑️ הסרה מהלוח (סיום טיפול)</button>
      <div style="font-size:.7rem;color:#795548;margin-top:6px;text-align:center">הפעילות תסומן כטופלה ותוסר מרשימת ה-To-Do</div>
    </div>`;
  }

  h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <button class="btn borange bsm" onclick="window.openPostpone(${s.id})">⏩ דחה לתאריך אחר</button>
    <button class="btn bp bsm" onclick="window.openCopy(${s.id})">📋 העתק לתאריך אחר</button>
  </div>`;

  document.getElementById('sp-body').innerHTML=h;
  document.getElementById('sp').classList.add('open');
  if(document.getElementById('sp-backdrop')) document.getElementById('sp-backdrop').style.display='block';
}

function showSpSaved(){
  const msg=document.getElementById('sp-saved-msg');
  if(!msg) return;
  msg.style.display='block';
  setTimeout(()=>{ msg.style.display='none'; }, 2500);
}

function toggleSpEdit(){
  const body=document.getElementById('sp-edit-body');
  const arrow=document.getElementById('sp-edit-arrow');
  if(!body||!arrow) return;
  const isOpening = body.style.display==='none';
  body.style.display = isOpening ? 'flex' : 'none';
  arrow.style.transform = isOpening ? 'rotate(180deg)' : 'rotate(0deg)';
}

function spEditSupChg(){
  const sup=document.getElementById('sp-edit-sup').value;
  const actSel=document.getElementById('sp-edit-act');
  const s=window.SCH.find(x=>x.id===window.selEv);
  const acts=window.getSupActs(sup);
  actSel.innerHTML='<option value="">— ללא שינוי —</option>'+
    acts.map(a=>`<option value="${a}"${s&&s.act===a?' selected':''}>${a}</option>`).join('')+
    '<option value="__new__">➕ פעילות חדשה...</option>';
}

function spEditActChg(){
  const v=document.getElementById('sp-edit-act').value;
  const wrap=document.getElementById('sp-edit-act-new-wrap');
  if(wrap) wrap.style.display=v==='__new__'?'block':'none';
}

function deleteRecurSeries(id){
  const s=window.SCH.find(x=>x.id===id); if(!s) return;
  const affected=window.SCH.filter(x=>x._recId===s._recId&&x.d>=s.d&&x.g===s.g);
  if(!confirm(`האם למחוק ${affected.length} פעילויות קבועות מ-${window.fD(s.d)} ואילך?`)) return;
  affected.forEach(x=>{ const i=window.SCH.indexOf(x); if(i>=0) window.SCH.splice(i,1); });
  window.saveAndRefresh('sp');
}

function openReplaceRecur(id){
  const s=window.SCH.find(x=>x.id===id); if(!s) return;
  const affected=window.SCH.filter(x=>x._recId===s._recId&&x.d>=s.d&&x.g===s.g);
  const allSups=window.getAllSup().filter(s2=>window.isActSupplier(s2.name));
  const g=window.G(s.g);
  let h=`<div style="font-size:.85rem;font-weight:700;color:#1a237e;margin-bottom:10px">
    🔄 החלפת שיבוץ קבוע — ${affected.length} פעילויות<br>
    <span style="font-size:.75rem;font-weight:400;color:#546e7a">גן: ${g.name}</span>
  </div>
  <div style="display:grid;gap:8px">
    <select id="rr-sup" onchange="window.rrSupChg()" style="width:100%">${allSups.map(s2=>`<option value="${s2.name}"${s2.name===s.a?' selected':''}>${s2.name}</option>`).join('')}</select>
    <select id="rr-act" style="width:100%"><option value="">— ללא שינוי —</option>${window.getSupActs(s.a).map(a=>`<option value="${a}"${a===s.act?' selected':''}>${a}</option>`).join('')}</select>
    <input type="time" id="rr-time" value="${s.t||''}" style="width:100%">
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
    <button class="btn br bsm" onclick="CM('rrm')">ביטול</button>
    <button class="btn bg bsm" onclick="window.saveReplaceRecur(${id})">✅ החלף</button>
  </div>`;
  document.getElementById('rrm-body').innerHTML=h;
  window.OM('rrm');
}

function rrSupChg(){
  const sup=document.getElementById('rr-sup').value;
  const actSel=document.getElementById('rr-act');
  if(!actSel) return;
  actSel.innerHTML='<option value="">— ללא שינוי —</option>'+
    window.getSupActs(sup).map(a=>`<option value="${a}">${a}</option>`).join('');
}

function saveReplaceRecur(id){
  const s=window.SCH.find(x=>x.id===id); if(!s) return;
  const newSup=document.getElementById('rr-sup').value;
  const newAct=document.getElementById('rr-act').value;
  const newTime=document.getElementById('rr-time').value;
  const affected=window.SCH.filter(x=>x._recId===s._recId&&x.d>=s.d&&x.g===s.g);
  affected.forEach(x=>{ if(newSup) x.a=newSup; if(newAct) x.act=newAct; if(newTime) x.t=newTime; });
  window.saveAndRefresh('rrm');
}

function spEditSave(){
  const s=window.SCH.find(x=>x.id===window.selEv); if(!s) return;
  const newDate=document.getElementById('sp-edit-date').value;
  const newSup=document.getElementById('sp-edit-sup').value;
  const actVal=document.getElementById('sp-edit-act').value;
  const newAct=actVal==='__new__' ? (document.getElementById('sp-edit-act-new')||{}).value||'' : actVal;
  const newTime=document.getElementById('sp-edit-time').value;
  if(newDate) s.d=newDate; if(newSup) s.a=newSup; if(newAct) s.act=newAct; if(newTime) s.t=newTime;
  window.saveAndRefresh('sp');
}

function setSpActionTab(tab){
  ['nohap','can','comp'].forEach(t=>{
    const p=document.getElementById('sp-panel-'+t);
    const b=document.getElementById('sp-tab-'+t);
    if(p) p.style.display=(t===tab?'block':'none');
    if(b) b.style.background=(t===tab?'#fff':'#f5f5f5');
  });
}

function spTogglePairDetails(){
  const chk = document.getElementById('sp-pair-chk');
  const details = document.getElementById('sp-pair-details');
  if(chk && details) details.style.display = chk.checked ? 'block' : 'none';
}

function selCO(el,r){document.querySelectorAll('.copt:not([onclick*=selNO])').forEach(o=>o.classList.remove('sel'));el.classList.add('sel');el.dataset.r=r;}
function selNO(el,r){document.querySelectorAll('.copt[onclick*=selNO]').forEach(o=>o.classList.remove('sel'));el.classList.add('sel');el.dataset.r=r;}

function cancelEv(){
  const s=window.SCH.find(x=>x.id===window.selEv); if(!s) return;
  s.st='can'; window.saveAndRefresh('sp');
}

function markNoHap(){
  const s=window.SCH.find(x=>x.id===window.selEv); if(!s) return;
  s.st='nohap'; window.saveAndRefresh('sp');
}

function setStatus(idOrSt, maybeSt){
  let id, st;
  if (maybeSt) { id = idOrSt; st = maybeSt; } 
  else { id = window.selEv; st = idOrSt; }
  const main=window.SCH.find(x=>x.id===id);
  if(main){
    main.st=st;
    if(st==='ok') { main.cr=''; main.cn=''; }
  }
  window.saveAndRefresh('sp');
}

function saveNt(){
  const s=window.SCH.find(x=>x.id===window.selEv); if(!s) return;
  const nt=document.getElementById('sp-nt').value;
  s.nt=nt; window.saveAndRefresh('sp');
}

function markCompManual(id){
  const s=window.SCH.find(x=>x.id===id); if(!s) return;
  const syncCheck = document.getElementById('sp-sync-pair');
  const doSync = syncCheck && syncCheck.checked;
  const stamp = 'manual_' + Date.now();
  
  s._compByMakeup = stamp;

  if (doSync) {
    const pair = window.gardenPair(s.g);
    if (pair) {
      const otherIds = pair.ids.map(id=>Number(id)).filter(id=>id!==Number(s.g));
      otherIds.forEach(ogid => {
        // Find matching activity by date, time, supplier, and activity name
        const partnerEv = window.SCH.find(ps => 
          Number(ps.g)===ogid && 
          ps.d === s.d && 
          (ps.t === s.t || (!ps.t && !s.t)) && 
          window.supBase(ps.a) === window.supBase(s.a) &&
          (ps.act || '') === (s.act || '') &&
          ps.st !== 'can'
        );
        if (partnerEv) partnerEv._compByMakeup = stamp;
      });
    }
  }

  window.saveAndRefresh('sp');
}

function upd(id,fields){
  const i=window.SCH.findIndex(s=>s.id===id);
  if(i>=0) Object.assign(window.SCH[i],fields);
}

function updAndRefresh(id,fields){
  upd(id,fields); window.save(); window.closeSP(); window.refresh();
}

function closeSP(){
  document.getElementById('sp').classList.remove('open');
  const bd=document.getElementById('sp-backdrop');
  if(bd) bd.style.display='none';
  window.selEv=null;
}

function refresh(){
  if(window.updCounts) window.updCounts();
  window.renderDash();
  window.renderCanList();
  if(window.renderCal) window.renderCal();
  if(window.currentTab==='sched' && window.renderSched) window.renderSched();
}

function saveAndRefresh(modalId){
  window.save();
  if(modalId) window.CM(modalId);
  closeSP();
  window.refresh();
}

function openMakeupSched(origId){
  const orig=window.SCH.find(s=>s.id===origId); if(!orig) return;
  window._makeupOrigId = origId;
  window.openNewSched(orig.g, {date:window.td(), tab:'makeup', makeupFrom:orig.d, time:orig.t});
}

function openPostpone(id){
  window.selEvPost=id;
  const s=window.SCH.find(x=>x.id===id); if(!s) return;
  const g=window.G(s.g);
  document.getElementById('post-ev-info').innerHTML=`<b>${g.name}</b> · ${g.city} · ${s.a}`;
  document.getElementById('post-date').value='';
  document.getElementById('postm').classList.add('open');
}

function openCopy(id){
  window._copySrcId=id;
  const s=window.SCH.find(x=>x.id===id); if(!s) return;
  const g=window.G(s.g);
  document.getElementById('copy-ev-info').innerHTML=`<b>${g.name}</b> · ${g.city} · ${s.a}`;
  document.getElementById('copym').style.display='flex';
}

function openSupExport(supName){
  const date=document.getElementById('dash-date').value||window.td();
  const evs=window.SCH.filter(s=>s.a===supName&&s.d===date&&s.st!=='can');
  if(!evs.length){alert('אין פעילויות לייצוא');return;}
  const rows=evs.map(s=>({ 'עיר':window.G(s.g).city, 'גן':window.G(s.g).name, 'ספק':s.a, 'פעילות':s.act||'', 'שעה':s.t }));
  window.exportToExcel(rows, `export_${supName}`);
}

window.setDashTab = setDashTab;
window.renderDash = renderDash;
window.renderCanList = renderCanList;
window.openSP = openSP;
window.closeSP = closeSP;
window.setStatus = setStatus;
window.saveNt = saveNt;
window.markNoHap = markNoHap;
window.cancelEv = cancelEv;
window.openMakeupSched = openMakeupSched;
window.openPostpone = openPostpone;
window.openCopy = openCopy;
window.markCompManual = markCompManual;
window.openSupExport = openSupExport;
window.saveAndRefresh = saveAndRefresh;
window.refresh = refresh;
window.toggleSpEdit = toggleSpEdit;
window.spEditSupChg = spEditSupChg;
window.spEditActChg = spEditActChg;
window.deleteRecurSeries = deleteRecurSeries;
window.openReplaceRecur = openReplaceRecur;
window.rrSupChg = rrSupChg;
window.saveReplaceRecur = saveReplaceRecur;
window.spEditSave = spEditSave;
window.setSpActionTab = setSpActionTab;
window.spTogglePairDetails = spTogglePairDetails;
window.selCO = selCO;
window.selNO = selNO;
window.updAndRefresh = updAndRefresh;

setTimeout(() => { if (typeof renderDash === 'function') renderDash(); }, 100);
