function setDashTab(t){
  _dashTab=t;
  document.getElementById('dash-tab-g').classList.toggle('active',t==='g');
  document.getElementById('dash-tab-s').classList.toggle('active',t==='s');
  renderDash();
}
function renderDash(){
function renderDash(){
  const date=document.getElementById('dash-date').value||td();
  const city=document.getElementById('dash-city').value;
  const sup=document.getElementById('dash-sup').value;
  const st=document.getElementById('dash-st').value;
  const clsFilter=_dashTab==='g'?'גנים':'ביה"ס';
  const srch=(document.getElementById('dash-srch')||{value:''}).value.toLowerCase();
  const evs=SCH.filter(s=>{
    if(s.d!==date) return false;
    const g=G(s.g);
    if(gcls(g)!==clsFilter) return false;
    if(city&&g.city!==city) return false;
    if(sup&&supBase(s.a)!==sup&&s.a!==sup) return false;
    if(st&&s.st!==st) return false;
    if(srch&&![g.name,g.city,s.a,g.st,s.act].some(v=>(v||'')
      .toLowerCase().includes(srch))) return false;
    return true;
  }).sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
  const bySup={};
  evs.forEach(s=>{
    const g=G(s.g);
    if(!bySup[s.a]) bySup[s.a]={name:s.a,ph:s.p||'',evs:[]};
    bySup[s.a].evs.push({...s,gd:g});
    if(s.p&&!bySup[s.a].ph) bySup[s.a].ph=s.p;
  });

  if(!Object.keys(bySup).length){
    document.getElementById('dash-body').innerHTML='<p style="color:#999;font-size:.81rem">אין פעילויות ביום זה</p>';
  } else {
    let h='';
    Object.values(bySup).sort((a,b)=>a.name.localeCompare(b.name,'he')).forEach(supData=>{
      const byCity={};
      supData.evs.forEach(s=>{
        const c=s.gd.city||'אחר';
        if(!byCity[c]) byCity[c]=[];
        byCity[c].push(s);
      });
      h+=`<div class="card" style="margin-bottom:10px;padding:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-weight:800;color:#1a237e;font-size:.9rem">📚 ${supBase(supData.name)}</div>
          ${supAct(supData.name)?`<div style="font-size:.75rem;color:#1565c0;font-weight:600">🎯 ${supAct(supData.name)}</div>`:''}
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
        const rows=[]; // {type:'pair',pair,evs:[]} | {type:'solo',ev}
        pairs.forEach(pair=>{
          const pairEvs=ce.filter(s=>pair.ids.includes(s.g));
          if(!pairEvs.length) return;
          pairEvs.forEach(s=>usedIds.add(s.id));
          rows.push({type:'pair',pair,evs:pairEvs});
        });
        ce.filter(s=>!usedIds.has(s.id)).forEach(s=>rows.push({type:'solo',ev:s}));
        rows.sort((a,b)=>{
          const nameA=a.type==='pair'?a.pair.name:G(a.ev.g).name;
          const nameB=b.type==='pair'?b.pair.name:G(b.ev.g).name;
          return nameA.localeCompare(nameB,'he');
        });

        let _pairCards='',_soloCards='';
        rows.forEach(row=>{
          if(row.type==='pair'){
            const _dashClr=CITY_COLORS(G(row.pair.ids[0]).city);
            _pairCards+=renderPairCard(row.pair,row.evs,{ds:date,clr:_dashClr,showEdit:true,showExport:true});
          } else {
            const s=row.ev;
            const stc=s.st!=='ok'?'st-'+s.st:'';
            const _sc=CITY_COLORS(G(s.g).city);
            h+=`<div class="city-block" style="margin-bottom:7px">
              <div class="city-block-hdr" style="background:${_sc.solid};font-size:.76rem">
                🏫 ${s.gd.name}
                <span style="font-size:.67rem;opacity:.8;font-weight:400">📍 ${G(s.g).city}</span>
                <button onclick="event.stopPropagation();_exportGardenWA([${s.g}],'${date}')" style="background:rgba(255,255,255,.28);border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:.68rem;color:#fff;font-weight:700">📋 הודעה</button>
                <button onclick="event.stopPropagation();quickAddPartner(${s.g})"
                  style="background:rgba(255,255,255,.22);border:none;border-radius:4px;padding:1px 7px;cursor:pointer;font-size:.67rem;color:#fff">➕ הוסף בן זוג</button>
              </div>
              <div style="background:#fff;padding:7px">
                <div class="ev ${stc}" onclick="openSP(${s.id})" style="border-radius:5px;border:none;border-right:3px solid ${_sc.solid};background:${_sc.light};margin:0">
                  <span class="est">${stLabel(s)}</span>
                  <div class="eg">${s.gd.name}</div>
                  ${s.gd.st?`<div style="font-size:.67rem;color:#78909c">📍 ${s.gd.st}</div>`:''}
                  ${s.act?`<div style="font-size:.67rem;font-weight:600;color:${_sc.solid}">🎯 ${s.act}</div>`:''}
                  ${s.t?`<div class="et">⏰ ${fT(s.t)}</div>`:''}
                  ${s.grp>1?`<div style="font-size:.67rem;color:#546e7a">👥 ${s.grp}</div>`:''}
                </div>
              </div>
            </div>`;
          }
        });
        if(_pairCards) h+='<div class="pairs-4col">'+_pairCards+'</div>';
        h+='</div>';
      });
      h+='</div>';
    });
    document.getElementById('dash-body').innerHTML=h;
  }

  // Nohap list — all events that didn't happen, sorted by date desc
  const nohapEvs=SCH.filter(s=>s.st==='nohap').sort((a,b)=>b.d.localeCompare(a.d));
  // Can+post list — last 20
  const canEvs=SCH.filter(s=>s.st==='post').sort((a,b)=>b.d.localeCompare(a.d)).slice(0,20);
  const allEvs=[...nohapEvs,...canEvs].sort((a,b)=>b.d.localeCompare(a.d));

  let ch='';
  if(!allEvs.length) ch='<p style="color:#999;font-size:.79rem">אין ביטולים/דחיות</p>';
  else{
    ch='<div class="tw"><table><thead><tr><th>תאריך</th><th>עיר</th><th>גן</th><th>ספק</th><th>סטטוס</th><th>סיבה</th></tr></thead><tbody>';
    allEvs.forEach(s=>{
      const g=G(s.g);
      ch+=`<tr onclick="openSP(${s.id})" class="${stClass(s)}"><td>${fD(s.d)}</td><td>${g.city||''}</td><td>${g.name||''}</td><td>${s.a}</td><td>${stLabel(s)}</td><td>${s.cr||''}${s.cn?' ('+s.cn+')':''}</td></tr>`;
    });
    ch+='</tbody></table></div>';
  }
  document.getElementById('dash-can-body').innerHTML=ch;
}

function openSP(id){
  selEv=id;
  const s=SCH.find(x=>x.id===id);if(!s)return;
  const g=G(s.g);
  const isS=gcls(g)==='ביה"ס';
  let h=`<div style="background:#f5f7ff;border-radius:7px;padding:9px;margin-bottom:10px">
    <div class="ir"><span class="il">📅 תאריך:</span><span style="font-weight:700">${fD(s.d)} יום ${dayN(s.d)}</span></div>
    <div class="ir"><span class="il">🏫 גן:</span><span style="font-weight:700">${g.name}</span></div>
    <div class="ir"><span class="il">🏙️ עיר:</span><span>${g.city}</span></div>
    ${g.st?`<div class="ir"><span class="il">📍 כתובת:</span><span><a href="https://maps.google.com/?q=${encodeURIComponent(g.st+' '+g.city)}" target="_blank" style="color:#1565c0">${g.st}</a></span></div>`:''}
    ${s.t?`<div class="ir"><span class="il">⏰ שעה:</span><span style="font-weight:700;font-size:.9rem">${fT(s.t)}</span></div>`:''}
    <div class="ir"><span class="il">📚 ספק:</span><span style="font-weight:700">${supBase(s.a)}</span></div>
    ${supAct(s.a)?`<div class="ir"><span class="il">🎯 פעילות:</span><span style="color:#1565c0;font-weight:700">${supAct(s.a)}</span></div>`:''}
    ${s.p?`<div class="ir"><span class="il">📞 טלפון:</span><span>${s.p}</span></div>`:''}
    ${(s.act&&s.act!==supAct(s.a))?`<div class="ir"><span class="il">🎯 סוג פעילות:</span><span style="font-weight:700;color:#1565c0">${s.act}</span></div>`:''}
    ${isS&&s.grp>1?`<div class="ir"><span class="il">👥 קבוצות:</span><span>${s.grp}</span></div>`:''}
    ${s.st==='post'?`<div class="ir"><span class="il">⏩ נדחה ל:</span><span style="color:#e65100;font-weight:700">${fD(s.pd)} ${s.pt?fT(s.pt):''}</span></div>`:''}
    ${s._fromD?`<div class="ir"><span class="il">↩️ הועבר מ:</span><span style="color:#e65100;font-weight:700">${fD(s._fromD)}</span></div>`:''}
    <div class="ir"><span class="il">📌 סטטוס:</span><span>${stLabel(s)}</span></div>
  </div>`;
  const spPairForNt=gardenPair(s.g);
  h+=`<div style="margin-bottom:9px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
      <label style="font-size:.74rem;font-weight:700;color:#546e7a">📝 הערות לפעילות זו</label>
      <div style="display:flex;gap:8px;align-items:center">
        ${spPairForNt?`<label style="font-size:.7rem;display:flex;align-items:center;gap:3px;cursor:pointer;color:#e65100">
          <input type="checkbox" id="sp-nt-pair"> לכל הזוג
        </label>`:''}
        <label style="font-size:.7rem;display:flex;align-items:center;gap:3px;cursor:pointer;color:#1565c0" title="הערה שתישמר לכל הפעילויות הבאות של גן זה">
          <input type="checkbox" id="sp-nt-perm" ${s.ntPerm?'checked':''}> הערה קבועה
        </label>
      </div>
    </div>
    <textarea id="sp-nt" rows="2" style="width:100%;font-size:.8rem;border-radius:6px;border:1.5px solid ${s.ntPerm?'#1565c0':'#e0e0e0'};padding:5px">${s.nt||''}</textarea>
    ${s.ntPerm?'<div style="font-size:.67rem;color:#1565c0;margin-top:2px">📌 הערה קבועה — מוצגת בכל הפעילויות של גן זה</div>':''}
    <button class="btn bp bsm" style="width:100%;margin-top:5px" onclick="saveNt()">💾 שמור הערה</button>
  </div>`;
  const spPair=gardenPair(s.g);
  h+=`<div style="margin-bottom:10px">
    <div style="font-size:.8rem;font-weight:700;color:#1a237e;margin-bottom:6px">עדכון סטטוס:</div>
    ${spPair?`<div style="background:#fff3e0;border-radius:6px;padding:5px 9px;margin-bottom:7px;font-size:.75rem;display:flex;align-items:center;gap:8px">
      <span>🔗 ${spPair.name}</span>
      <label style="display:flex;align-items:center;gap:4px;cursor:pointer;margin-right:auto">
        <input type="checkbox" id="sp-pair-chk" style="accent-color:#e65100"> עדכן לכל הזוג
      </label>
    </div>`:''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
      <button class="btn bg bsm" onclick="setStatus('done')" ${s.st==='done'?'style="opacity:.5"':''}>✔️ התקיים</button>
      <button class="btn bo bsm" onclick="setStatus('ok')" ${s.st==='ok'?'style="opacity:.5"':''}>🔄 שחזר למתקיים</button>
    </div>
  </div>`;
  if(s.st!=='can')h+=`<div style="border:1.5px solid #ffcdd2;border-radius:7px;padding:8px;margin-bottom:8px">
    <div style="font-size:.8rem;font-weight:700;color:#c62828;margin-bottom:5px">❌ ביטול</div>
    <div class="copts">
      <div class="copt" onclick="selCO(this,'חג/חופשה')">🎉 חג/חופשה</div>
      <div class="copt" onclick="selCO(this,'מחלה')">🤒 מחלה</div>
      <div class="copt" onclick="selCO(this,'מצב בטחוני')">🛡️ מצב בטחוני</div>
      <div class="copt" onclick="selCO(this,'ביטול ספק')">🏢 ביטול ספק</div>
    </div>
    <input type="text" id="sp-cn" placeholder="הערה" style="width:100%;margin-bottom:5px">
    <button class="btn br bsm" style="width:100%" onclick="cancelEv()">❌ בטל</button>
  </div>`;
  h+=`<button class="btn borange bsm" style="width:100%;margin-bottom:7px" onclick="openPostpone(${s.id})">${s.st==='post'?'⏩ דחה שוב':'⏩ דחה לתאריך אחר'}</button>`;
  h+=`<button class="btn bp bsm" style="width:100%;margin-bottom:7px;background:#1565c0" onclick="openCopy(${s.id})">📋 העתק לתאריך אחר</button>`;
  // Inline edit section — supplier, activity, time
  const spActs=getSupActs(s.a);
  const spAllSups=getAllSup();
  const spPairForEdit=gardenPair(s.g);
  h+=`<div style="border:1.5px solid #b3c6e7;border-radius:7px;padding:9px;margin-bottom:8px;background:#f8fbff">
    <div style="font-size:.8rem;font-weight:700;color:#1a237e;margin-bottom:7px">✏️ עריכת שיבוץ</div>
    <div style="display:grid;gap:6px">
      <div><label style="font-size:.72rem;color:#546e7a;font-weight:700">📚 ספק</label>
        <select id="sp-edit-sup" onchange="spEditSupChg()" style="width:100%;font-size:.8rem">
          ${spAllSups.map(s2=>`<option value="${s2.name}"${s2.name===s.a?' selected':''}>${s2.name}</option>`).join('')}
        </select>
      </div>
      <div><label style="font-size:.72rem;color:#546e7a;font-weight:700">📋 סוג הפעילות</label>
        <select id="sp-edit-ev-type" style="width:100%;font-size:.8rem">
          <option value="חוג"${(s.tp||'חוג')==='חוג'?' selected':''}>🎨 חוג</option>
          <option value="הפעלה"${(s.tp||'')==='הפעלה'?' selected':''}>🎪 הפעלה</option>
          <option value="מופע"${(s.tp||'')==='מופע'?' selected':''}>🎭 מופע</option>
          <option value="אחר"${(s.tp||'')==='אחר'?' selected':''}>📌 אחר</option>
        </select>
      </div>
      <div><label style="font-size:.72rem;color:#546e7a;font-weight:700">🎯 שם הפעילות</label>
        <select id="sp-edit-act" onchange="spEditActChg()" style="width:100%;font-size:.8rem">
          <option value="">— ללא שינוי —</option>
          ${spActs.map(a=>`<option value="${a}"${a===s.act?' selected':''}>${a}</option>`).join('')}
          <option value="__new__">➕ פעילות חדשה...</option>
        </select>
      </div>
      <div id="sp-edit-act-new-wrap" style="display:none">
        <input type="text" id="sp-edit-act-new" placeholder="שם פעילות חדשה" style="width:100%;font-size:.8rem">
      </div>
      <div><label style="font-size:.72rem;color:#546e7a;font-weight:700">⏰ שעה</label>
        <input type="time" id="sp-edit-time" value="${s.t||''}" style="width:100%;font-size:.8rem">
      </div>
      ${spPairForEdit?`<label style="font-size:.75rem;display:flex;align-items:center;gap:6px;cursor:pointer;color:#e65100">
        <input type="checkbox" id="sp-edit-pair-chk"> עדכן לכל הזוג (${spPairForEdit.name})
      </label>`:''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px">
      <button class="btn bp bsm" onclick="spEditSave()">💾 שמור שינויים</button>
      <button class="btn bo bsm" onclick="openEditSched(${s.id})">🖊 עריכה מלאה</button>
    </div>
  </div>`;
  if(s.st==='nohap')h+=`<button class="btn bp bsm" style="width:100%;margin-bottom:7px" onclick="openMakeupSched(${s.id})">📅 שיבוץ השלמה לתאריך חדש</button>`;
  if(s.st!=='nohap')h+=`<div style="border:1.5px solid #f48fb1;border-radius:7px;padding:8px;margin-bottom:8px">
    <div style="font-size:.8rem;font-weight:700;color:#e91e63;margin-bottom:5px">⚠️ לא התקיים</div>
    <div class="copts">
      <div class="copt" onclick="selNO(this,'ספק לא הגיע')">🚫 מדריך לא הגיע</div>
      <div class="copt" onclick="selNO(this,'גן סגור')">🤒 מדריך חולה</div>
      <div class="copt" onclick="selNO(this,'אין ילדים')">👤 חסר מדריך</div>
      <div class="copt" onclick="selNO(this,'אחר')">📝 אחר</div>
    </div>
    <input type="text" id="sp-nn" placeholder="הסבר" style="width:100%;margin-bottom:5px">
    <button class="btn bpurple bsm" style="width:100%" onclick="markNoHap()">⚠️ סמן לא התקיים</button>
  </div>`;

  // Recurring series management — shown only if event belongs to a series
  if(s._recId){
    const seriesCount=SCH.filter(x=>x._recId===s._recId&&x.d>=s.d&&x.g===s.g).length;
    h+=`<div style="border:1.5px solid #b0bec5;border-radius:7px;padding:8px;margin-bottom:8px;background:#f8f9fa"><div style="font-size:.8rem;font-weight:700;color:#37474f;margin-bottom:6px">🔁 שיבוץ קבוע — ${seriesCount} פעילויות מתאריך זה ואילך</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px"><button class="btn br bsm" onclick="deleteRecurSeries(${s.id})">🗑️ מחק מכאן ואילך</button><button class="btn borange bsm" onclick="openReplaceRecur(${s.id})">🔄 החלף שיבוץ קבוע</button></div></div>`;
  }
  h+=`<button class="btn bp bsm" style="width:100%" onclick="saveNt()">💾 שמור הערה</button>`;
  document.getElementById('sp-body').innerHTML=h;
  document.getElementById('sp').classList.add('open');
  const _bd=document.getElementById('sp-backdrop');
  if(_bd) _bd.style.display='block';
}

function spEditSupChg(){
  const sup=document.getElementById('sp-edit-sup').value;
  const actSel=document.getElementById('sp-edit-act');
  const s=SCH.find(x=>x.id===selEv);
  const acts=getSupActs(sup);
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
  const s=SCH.find(x=>x.id===id); if(!s) return;
  const affected=SCH.filter(x=>x._recId===s._recId&&x.d>=s.d&&x.g===s.g);
  if(!confirm(`האם למחוק ${affected.length} פעילויות קבועות מ-${fD(s.d)} ואילך?\n(הפעילויות יימחקו לחלוטין, ללא ביטול)`)) return;
  affected.forEach(x=>{ const i=SCH.indexOf(x); if(i>=0) SCH.splice(i,1); });
  saveAndRefresh('sp');
  showToast(`✅ נמחקו ${affected.length} פעילויות קבועות`);
}

function openReplaceRecur(id){
  const s=SCH.find(x=>x.id===id); if(!s) return;
  const affected=SCH.filter(x=>x._recId===s._recId&&x.d>=s.d&&x.g===s.g);
  const allSups=getAllSup().filter(s2=>isActSupplier(s2.name));
  const g=G(s.g);
  let h=`<div style="font-size:.85rem;font-weight:700;color:#1a237e;margin-bottom:10px">
    🔄 החלפת שיבוץ קבוע — ${affected.length} פעילויות מ-${fD(s.d)} ואילך<br>
    <span style="font-size:.75rem;font-weight:400;color:#546e7a">גן: ${g.name} | ספק נוכחי: ${supBase(s.a)}</span>
  </div>
  <div style="display:grid;gap:8px">
    <div><label style="font-size:.75rem;font-weight:700;color:#546e7a">📚 ספק חדש</label>
      <select id="rr-sup" onchange="rrSupChg()" style="width:100%;font-size:.82rem">
        ${allSups.map(s2=>`<option value="${s2.name}"${s2.name===s.a?' selected':''}>${s2.name}</option>`).join('')}
      </select>
    </div>
    <div id="rr-act-wrap"><label style="font-size:.75rem;font-weight:700;color:#546e7a">🎯 סוג פעילות</label>
      <select id="rr-act" style="width:100%;font-size:.82rem">
        <option value="">— ללא שינוי —</option>
        ${getSupActs(s.a).map(a=>`<option value="${a}"${a===s.act?' selected':''}>${a}</option>`).join('')}
      </select>
    </div>
    <div><label style="font-size:.75rem;font-weight:700;color:#546e7a">⏰ שעה (ריק = ללא שינוי)</label>
      <input type="time" id="rr-time" value="${s.t||''}" style="width:100%;font-size:.82rem">
    </div>
    <div><label style="font-size:.75rem;font-weight:700;color:#546e7a">👥 מספר קבוצות (ריק = ללא שינוי)</label>
      <input type="number" id="rr-grp" min="1" max="20" value="${s.grp||1}" style="width:100%;font-size:.82rem">
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
    <button class="btn br bsm" onclick="CM('rrm')">ביטול</button>
    <button class="btn bg bsm" onclick="saveReplaceRecur(${id})">✅ החלף שיבוץ</button>
  </div>`;
  document.getElementById('rrm-body').innerHTML=h;
  OM('rrm');
}

function rrSupChg(){
  const sup=document.getElementById('rr-sup').value;
  const actSel=document.getElementById('rr-act');
  if(!actSel) return;
  actSel.innerHTML='<option value="">— ללא שינוי —</option>'+
    getSupActs(sup).map(a=>`<option value="${a}">${a}</option>`).join('');
}

function saveReplaceRecur(id){
  const s=SCH.find(x=>x.id===id); if(!s) return;
  const newSup=document.getElementById('rr-sup').value;
  const newAct=document.getElementById('rr-act').value;
  const newTime=document.getElementById('rr-time').value;
  const newGrp=parseInt(document.getElementById('rr-grp').value)||0;
  const affected=SCH.filter(x=>x._recId===s._recId&&x.d>=s.d&&x.g===s.g);
  affected.forEach(x=>{
    if(newSup) x.a=newSup;
    if(newAct) x.act=newAct;
    if(newTime) x.t=newTime;
    if(newGrp>0) x.grp=newGrp;
  });
  saveAndRefresh('rrm');
  showToast(`✅ עודכנו ${affected.length} פעילויות קבועות`);
}
function spEditSave(){
  const s=SCH.find(x=>x.id===selEv); if(!s) return;
  const newSup=document.getElementById('sp-edit-sup').value;
  const actVal=document.getElementById('sp-edit-act').value;
  const newAct=actVal==='__new__'
    ?(document.getElementById('sp-edit-act-new')||{}).value||''
    :actVal;
  const newTime=document.getElementById('sp-edit-time').value;
  const newTp=(document.getElementById('sp-edit-ev-type')||{}).value||'חוג';
  const forPair=(document.getElementById('sp-edit-pair-chk')||{}).checked;
  const updates={};
  if(newSup&&newSup!==s.a) updates.a=newSup;
  if(newAct&&newAct!=='__new__') updates.act=newAct;
  if(newTime&&newTime!==s.t) updates.t=newTime;
  if(newTp) updates.tp=newTp;
  // Always include notes in update
  const newNt2=(document.getElementById('sp-nt')||{}).value;
  if(newNt2!==undefined) updates.nt=newNt2;
  if(!Object.keys(updates).filter(k=>k!=='nt').length&&updates.nt===s.nt){alert('לא בוצע שינוי');return;}
  const pair=gardenPair(s.g);
  if(forPair&&pair){
    SCH.filter(x=>pair.ids.includes(x.g)&&x.d===s.d&&x.id!==selEv)
      .forEach(x=>Object.assign(x,updates));
  }
  Object.assign(s,updates);
  save(); closeSP(); refresh();
  alert('✅ שינויים נשמרו!');
}
function selCO(el,r){document.querySelectorAll('.copt:not([onclick*=selNO])').forEach(o=>o.classList.remove('sel'));el.classList.add('sel');el.dataset.r=r;}
function selNO(el,r){document.querySelectorAll('.copt[onclick*=selNO]').forEach(o=>o.classList.remove('sel'));el.classList.add('sel');el.dataset.r=r;}
function cancelEv(){
  const sel=document.querySelector('.copt.sel');
  if(!sel||!sel.dataset.r||['ספק לא הגיע','גן סגור','אין ילדים','אחר'].includes(sel.dataset.r)){alert('בחר סיבת ביטול');return;}
  const pairChk=document.getElementById('sp-pair-chk');
  const cr=sel.dataset.r; const cn=document.getElementById('sp-cn').value;
  const fields={st:'can',cr,cn};
  if(pairChk&&pairChk.checked){
    const s=SCH.find(x=>x.id===selEv);
    const pair=s&&gardenPair(s.g);
    if(pair) SCH.filter(x=>pair.ids.includes(x.g)&&x.d===s.d&&x.id!==selEv)
      .forEach(x=>Object.assign(x,fields));
  }
  const main=SCH.find(x=>x.id===selEv);
  if(main){
    Object.assign(main,fields);
    const g=G(main.g);
    _writeLog('cancel', `${g.name} — ${main.a}`, `בוטל: ${cr}`, {gName:g.name,date:main.d}).catch(()=>{});
  }
  save(); closeSP(); refresh();
}
function markNoHap(){
  const sel=document.querySelector('.copt.sel');
  const r=sel?sel.dataset.r:'';
  const note=document.getElementById('sp-nn').value;
  const pairChk=document.getElementById('sp-pair-chk');
  const fields={st:'nohap',cr:r||'לא התקיים',cn:note};
  if(pairChk&&pairChk.checked){
    const s=SCH.find(x=>x.id===selEv);
    const pair=s&&gardenPair(s.g);
    if(pair) SCH.filter(x=>pair.ids.includes(x.g)&&x.d===s.d&&x.id!==selEv)
      .forEach(x=>Object.assign(x,fields));
  }
  const main=SCH.find(x=>x.id===selEv);
  if(main){
    Object.assign(main,fields);
    const g=G(main.g);
    _writeLog('status', `${g.name} — ${main.a}`, 'לא התקיים', {gName:g.name,date:main.d}).catch(()=>{});
  }
  save(); closeSP(); refresh();
}
function setStatus(st){
  const pairChk=document.getElementById('sp-pair-chk');
  const forPair=pairChk&&pairChk.checked;
  const fields={st,cr:st==='ok'?'':undefined,cn:st==='ok'?'':undefined};
  if(forPair){
    const s=SCH.find(x=>x.id===selEv); if(!s) return;
    const pair=gardenPair(s.g);
    if(pair){
      SCH.filter(x=>pair.ids.includes(x.g)&&x.d===s.d&&x.id!==selEv)
        .forEach(x=>Object.assign(x,fields));
    }
  }
  const main=SCH.find(x=>x.id===selEv);
  if(main){
    Object.assign(main,fields);
    const stLabels={'done':'התקיים','ok':'מתקיים','nohap':'לא התקיים','can':'בוטל','post':'נדחה'};
    const g=G(main.g);
    _writeLog('status', `${g.name} — ${main.a}`, stLabels[st]||st, {gName:g.name,date:main.d}).catch(()=>{});
  }
  save(); closeSP(); refresh();
}
function saveNt(){
  const s=SCH.find(x=>x.id===selEv); if(!s) return;
  const newNt=document.getElementById('sp-nt').value||'';
  const pairChk=document.getElementById('sp-nt-pair');  // use the NOTES pair checkbox
  const forPair=pairChk&&pairChk.checked;
  const isPermanent=(document.getElementById('sp-nt-perm')||{}).checked;
  // Save to main event
  s.nt=newNt;
  if(isPermanent) s.ntPerm=true; else delete s.ntPerm;
  // Save to pair if requested
  if(forPair){
    const pair=gardenPair(s.g);
    if(pair){
      SCH.filter(x=>pair.ids.map(id=>parseInt(id)).includes(parseInt(x.g))&&x.d===s.d&&x.id!==selEv)
        .forEach(x=>{ x.nt=newNt; if(isPermanent) x.ntPerm=true; else delete x.ntPerm; });
    }
  }
  save(); closeSP(); refresh();
}
function upd(id,fields){
  const i=SCH.findIndex(s=>s.id===id);
  if(i>=0) Object.assign(SCH[i],fields);
}
function updAndRefresh(id,fields){
  upd(id,fields);save(); closeSP(); refresh();
}
function closeSP(){
  document.getElementById('sp').classList.remove('open');
  const bd=document.getElementById('sp-backdrop');
  if(bd) bd.style.display='none';
  selEv=null;
}
// Close SP when tapping overlay on mobile
document.addEventListener('DOMContentLoaded',()=>{
  const sp=document.getElementById('sp');
  if(!sp) return;
  // Add close button visible on mobile
  const closeBtn=document.createElement('button');
  closeBtn.innerHTML='✕ סגור';
  closeBtn.style.cssText='display:none;width:100%;padding:10px;margin-bottom:10px;background:#f5f5f5;border:none;border-radius:8px;font-size:.85rem;cursor:pointer';
  closeBtn.onclick=closeSP;
  closeBtn.id='sp-close-btn';
  sp.insertBefore(closeBtn,sp.firstChild);
  // Show close btn on mobile
  if(window.innerWidth<=768) closeBtn.style.display='block';
  window.addEventListener('resize',()=>{
    closeBtn.style.display=window.innerWidth<=768?'block':'none';
  });

  // Escape key: close any open side panel or modal
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      closeSP();
      document.querySelectorAll('.modal.open').forEach(m=>m.classList.remove('open'));
    }
  });

  // Safety: if backdrop gets stuck, clicking anywhere on content area closes it
  document.getElementById('sp-backdrop')?.addEventListener('click', closeSP);

  // Periodic backdrop safety check — if SP is closed but backdrop is visible, hide it
  setInterval(()=>{
    const bd=document.getElementById('sp-backdrop');
    const spEl=document.getElementById('sp');
    if(bd && spEl && !spEl.classList.contains('open') && bd.style.display==='block'){
      bd.style.display='none';
    }
  }, 2000);
});
function refresh(){
  // Single source of truth for all post-save re-rendering
  updCounts();
  renderDash();
  renderCal();
  const t=currentTab||'';
  if(t==='sched') renderSched();
  if(t==='sup') renderSup();
  if(t==='managers') renderManagers();
  if(t==='gardens') renderGardens();
  if(t==='pairs') renderPairs();
  if(t==='clusters') renderClusters();
  if(t==='holidays') renderHolidays();
  // Sync garden modal if open
  if(document.getElementById('gm')&&document.getElementById('gm').classList.contains('open')) renderGmCal();
}

// Unified save+close+refresh — call this after every data mutation
function saveAndRefresh(modalId){
  save();
  if(modalId) CM(modalId);
  if(modalId==='sp'||modalId===null) closeSP();
  refresh();
}

function qSetSt(id,st){
  const s=SCH.find(x=>x.id===id); if(!s) return;
  s.st=st; save(); refresh();
}

function openEditSched(id){
  const s=SCH.find(x=>x.id===id); if(!s) return;
  const g=G(s.g);
  selEv=id;
  (document.getElementById('es-info')||{}).textContent =g.name+' · '+fD(s.d);
  document.getElementById('es-sup').value=s.a||'';
  esSupChg();
  setTimeout(()=>{
    const atSel=document.getElementById('es-act');
    if(atSel&&s.act) atSel.value=s.act;
    const tpSel=document.getElementById('es-ev-type');
    if(tpSel) tpSel.value=s.tp||'חוג';
  },80);
  document.getElementById('es-time').value=s.t||'';
  document.getElementById('es-for-pair').checked=false;
  document.getElementById('es-pair-note').style.display='none';
  const pair=gardenPair(s.g);
  document.getElementById('es-pair-row').style.display=pair?'flex':'none';
  if(pair) (document.getElementById('es-pair-lbl')||{}).textContent =pair.name;
  document.getElementById('esm').classList.add('open');
}
function esSupChg(){
  const sup=document.getElementById('es-sup').value;
  const acts=getSupActs(sup);
  const atSel=document.getElementById('es-act');
  atSel.innerHTML='<option value="">-- אותו סוג פעילות --</option>'+
    acts.map(a=>`<option value='${a}'>${a}</option>`).join('')+
    '<option value="__new__">➕ חדש...</option>';
}
function saveEditSched(){
  const s=SCH.find(x=>x.id===selEv); if(!s) return;
  const newSup=document.getElementById('es-sup').value;
  const newAct=document.getElementById('es-act').value==='__new__'
    ?document.getElementById('es-act-new').value.trim()
    :document.getElementById('es-act').value;
  const newTime=document.getElementById('es-time').value;
  const newTp=(document.getElementById('es-ev-type')||{}).value;
  const forPair=document.getElementById('es-for-pair').checked;
  const updates={};
  if(newSup) updates.a=newSup;
  if(newAct&&newAct!=='__new__') updates.act=newAct;
  if(newTime) updates.t=newTime;
  if(newTp) updates.tp=newTp;
  if(forPair){
    const pair=gardenPair(s.g);
    if(pair) SCH.filter(x=>pair.ids.includes(x.g)&&x.d===s.d&&x.id!==selEv)
      .forEach(x=>upd(x.id,{...updates}));
  }
  upd(selEv,updates);
  save(); CM('esm'); closeSP(); refresh();
}
function openMakeupSched(origId){
  const orig=SCH.find(x=>x.id===origId); if(!orig) return;
  _makeupOrigId=origId;
  const d=new Date(s2d(orig.d)); d.setDate(d.getDate()+1);
  openNewSched(orig.g, {date:d2s(d), tab:'makeup', makeupFrom:orig.d});
  setTimeout(()=>{
    document.getElementById('ns-sup').value=orig.a||'';
    nsSupChg();
    if(orig.act){const atSel=document.getElementById('ns-act-type');if(atSel)atSel.value=orig.act;}
    document.getElementById('ns-notes').value='השלמה מ-'+fD(orig.d);
  },120);
}
let _makeupOrigId=null;
let _postMode = 'move'; // 'move' | 'defer'
function setPostMode(m){
  _postMode = m;
  document.getElementById('postm-mode-move')?.classList.toggle('active', m==='move');
  document.getElementById('postm-mode-defer')?.classList.toggle('active', m==='defer');
  const title = document.getElementById('postm-title');
  const btn   = document.getElementById('postm-save-btn');
  const lbl   = document.getElementById('post-reason-lbl');
  const pairLbl = document.getElementById('post-pair-action-lbl');
  if(m==='move'){
    if(title) title.textContent='🔀 הזזה לתאריך אחר';
    if(btn){ btn.textContent='🔀 הזז'; }
    if(lbl) lbl.textContent='סיבת ההזזה (אופציונלי)';
    if(pairLbl) pairLbl.textContent='גם להזיז';
  } else {
    if(title) title.textContent='⏩ דחיית פעילות';
    if(btn){ btn.textContent='⏩ דחה'; }
    if(lbl) lbl.textContent='סיבת הדחייה';
    if(pairLbl) pairLbl.textContent='גם לדחות';
  }
}

function openPostpone(id){
  selEvPost=id;
  const s=SCH.find(x=>x.id===id); if(!s) return;
  const g=G(s.g);
  document.getElementById('post-ev-info').innerHTML=
    `<b>${g.name}</b> · ${g.city} · <span style="color:#1565c0">${s.a}</span>${s.act?' · '+s.act:''}<br>
     תאריך מקורי: <b>${fD(s.d)} יום ${dayN(s.d)}</b> ${s.t?'⏰ '+fT(s.t):''}`;
  document.getElementById('post-date').value='';
  document.getElementById('post-time').value=s.t?fT(s.t):'';
  document.getElementById('post-reason').value='';
  document.getElementById('post-conflict-warn').style.display='none';
  setPostMode('move'); // default to move
  // Populate supplier dropdown
  const postSupEl=document.getElementById('post-sup');
  if(postSupEl){
    postSupEl.innerHTML='<option value="">— אותו ספק —</option>';
    getAllSup().forEach(sup=>postSupEl.innerHTML+=`<option value="${sup.name}"${sup.name===s.a?' selected':''}>${sup.name}</option>`);
    postSupChg();
  }
  postShowFreeDays(s);
  const postPair=gardenPair(s.g);
  const pairWrap=document.getElementById('post-pair-wrap');
  if(postPair&&pairWrap){
    const partnerIds=postPair.ids.filter(id=>id!==s.g);
    const partnerNames=partnerIds.map(id=>G(id).name).filter(Boolean).join(', ');
    (document.getElementById('post-pair-name')||{}).textContent=partnerNames;
    pairWrap.style.display='block';
    document.getElementById('post-pair-chk').checked=true;
  } else if(pairWrap){ pairWrap.style.display='none'; }
  document.getElementById('postm').classList.add('open');
}

function postSupChg(){
  const supEl=document.getElementById('post-sup');
  const actEl=document.getElementById('post-act');
  if(!supEl||!actEl) return;
  const supName=supEl.value;
  const s=SCH.find(x=>x.id===selEvPost);
  const srcName=supName||( s?s.a:'');
  const acts=getSupActs(srcName);
  actEl.innerHTML='<option value="">— אותה פעילות —</option>'+
    acts.map(a=>`<option value="${a}"${s&&s.act===a?' selected':''}>${a}</option>`).join('');
}
function postShowFreeDays(s){
  const gid=s.g;
  const g=G(gid);
  const fromD=s2d(s.d);fromD.setDate(fromD.getDate()+1);
  const DAY_HEB=['ראשון','שני','שלישי','רביעי','חמישי'];
  const busyDates=new Set(SCH.filter(x=>x.g===gid&&x.st!=='can').map(x=>x.d));
  const free=[]; let d=new Date(fromD);
  for(let i=0;i<21;i++){
    const dow=d.getDay();
    if(dow>=0&&dow<=4){ // sun-thu (0=sun,4=thu) skip fri(5)+sat(6)
      const ds=d2s(d);
      const hol=getHolidayInfo(ds,g.city,gcls(g));
      if(!busyDates.has(ds)&&!hol){
        free.push({ds,lbl:DAY_HEB[dow]+' '+fD(ds)});
      }
    }
    d.setDate(d.getDate()+1);
  }
  const wrap=document.getElementById('post-free-wrap');
  const fd=document.getElementById('post-free-days');
  if(free.length){
    fd.innerHTML='<div style="font-size:.74rem;font-weight:700;color:#2e7d32;margin-bottom:5px">ימים פנויים (אין פעילות) — לחץ לבחירה:</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:4px">'+
      free.map(f=>`<button class="btn bg bsm" style="font-size:.72rem;padding:3px 9px" onclick="postPickFree('${f.ds}')">${f.lbl}</button>`).join('')+
      '</div>'+
      '<div style="font-size:.71rem;color:#546e7a;margin-top:5px">* שישי ושבת אינם מוצגים</div>';
    wrap.style.display='block';
  } else {
    fd.innerHTML='<div style="color:#e65100;font-size:.75rem">אין ימים פנויים ב-21 יום הקרובים</div>';
    wrap.style.display='block';
  }
}
function postPickFree(ds){
  document.getElementById('post-date').value=ds;
  postDateChg();
}
function postDateChg(){
  const nd=document.getElementById('post-date').value;
  if(!nd){document.getElementById('post-conflict-warn').style.display='none';return;}
  const s=SCH.find(x=>x.id===selEvPost);
  if(!s) return;
  const conflict=SCH.some(x=>x.g===s.g&&x.d===nd&&x.id!==s.id&&x.st!=='can');
  // Also check partner conflict
  const pairChk=document.getElementById('post-pair-chk');
  let partnerConflict=false;
  if(pairChk&&pairChk.checked){
    const pair=gardenPair(s.g);
    if(pair){
      const partnerIds=pair.ids.filter(id=>id!==s.g);
      partnerConflict=partnerIds.some(pid=>SCH.some(x=>x.g===pid&&x.d===nd&&x.st!=='can'));
    }
  }
  const warnEl=document.getElementById('post-conflict-warn');
  warnEl.style.display=(conflict||partnerConflict)?'block':'none';
  if(partnerConflict&&!conflict) warnEl.textContent='⚠️ לצהרון הבן זוג כבר קיימת פעילות בתאריך שנבחר!';
  else warnEl.textContent='⚠️ לגן זה כבר קיימת פעילות בתאריך שנבחר!';
}
function doPostpone(){
  const nd=document.getElementById('post-date').value;
  if(!nd){alert('יש לבחור תאריך חדש');return;}
  const dow=s2d(nd).getDay();
  if(dow===5||dow===6){alert('לא ניתן לשבץ בשישי או שבת');return;}
  const nt=document.getElementById('post-time').value;
  const nr=document.getElementById('post-reason').value;
  const postSupEl=document.getElementById('post-sup');
  const postActEl=document.getElementById('post-act');
  const newSup=postSupEl&&postSupEl.value?postSupEl.value:null;
  const newAct=postActEl&&postActEl.value?postActEl.value:null;
  const isMove=(_postMode||'move')==='move';

  const doOne=(srcId,isPartner)=>{
    const idx=SCH.findIndex(s=>s.id===srcId);
    if(idx<0) return;
    const orig=SCH[idx];
    const origDate=orig.d;
    if(isMove){
      // הזזה: מעדכן את הרשומה המקורית ישירות, שומר הערה מאיפה הוזז
      const moveNote=nr?`(הוזז מ-${fD(origDate)} — ${nr})`:`(הוזז מ-${fD(origDate)})`;
      Object.assign(SCH[idx],{
        d:nd, t:nt||orig.t,
        st:'ok', cr:'', pd:'', pt:'',
        _fromD:origDate,
        nt:orig.nt?orig.nt+' | '+moveNote:moveNote
      });
      if(!isPartner&&newSup) SCH[idx].a=newSup;
      if(!isPartner&&newAct) SCH[idx].act=newAct;
    } else {
      // דחייה: מסמן מקור כנדחה, יוצר רשומה חדשה
      Object.assign(SCH[idx],{st:'post',cr:nr||'נדחה',pd:nd,pt:nt||orig.t});
      const newEntry={...orig,id:Date.now()+(isPartner?1:0),d:nd,
        t:nt||orig.t,st:'ok',cr:'',pd:'',pt:'',
        _fromD:origDate,
        nt:'(הועבר מ-'+fD(origDate)+')'+(nr?' — '+nr:'')};
      if(!isPartner&&newSup) newEntry.a=newSup;
      if(!isPartner&&newAct) newEntry.act=newAct;
      SCH.push(newEntry);
    }
  };
  const orig=SCH.find(s=>s.id===selEvPost);
  const orig2=orig?{...orig}:null; // copy before mutation for logging
  if(orig){
    const origGid = orig.g;
    const origDate = orig.d; // save BEFORE doOne mutates orig (Object.assign changes by reference)
    doOne(selEvPost,false);
    const pairChk=document.getElementById('post-pair-chk');
    if(pairChk&&pairChk.checked){
      const pair=gardenPair(origGid);
      if(pair){
        pair.ids.filter(id=>id!==origGid).forEach(pid=>{
          // Use origDate (saved before mutation) not orig.d (already changed)
          const partnerEv=SCH.find(s=>s.g===pid&&s.d===origDate&&s.st!=='can');
          if(partnerEv) doOne(partnerEv.id,true);
          else console.log('Partner not found for gid',pid,'on',origDate);
        });
      }
    }
  }
  const toast=isMove?`🔀 הוזז ל-${fD(nd)}`:`⏩ נדחה ל-${fD(nd)}`;
  if(orig2){ const g2=G(orig2.g); _writeLog('move',`${g2.name} — ${orig2.a}`,toast,{gName:g2.name,date:nd}).catch(()=>{}); }
  save();CM('postm');closeSP();refresh();
  showToast(toast);
}

// ── Copy Activity to Another Date ──────────────────────────────────
let _copySrcId=null;

function _ensureCopyModal(){
  if(document.getElementById('copym')) return;
  const el=document.createElement('div');
  el.id='copym';
  el.className='modal';
  el.style.cssText='display:none;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1100';
  el.onclick=e=>{if(e.target===el) el.style.display='none';};
  el.innerHTML=`
  <div style="background:#fff;border-radius:12px;padding:18px 16px;width:340px;max-width:96vw;max-height:90vh;overflow-y:auto;direction:rtl">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-weight:800;font-size:1rem;color:#1a237e">📋 העתק לתאריך אחר</div>
      <button onclick="document.getElementById('copym').style.display='none'" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#888">✕</button>
    </div>
    <div id="copy-ev-info" style="background:#e8f4fd;border-radius:7px;padding:8px 10px;font-size:.78rem;color:#1565c0;margin-bottom:10px"></div>
    <div style="margin-bottom:8px">
      <label style="font-size:.75rem;font-weight:700;color:#546e7a;display:block;margin-bottom:3px">📅 תאריך יעד</label>
      <input type="date" id="copy-date" onchange="copyDateChg()" style="width:100%;font-size:.85rem;padding:5px;border-radius:6px;border:1.5px solid #90caf9">
    </div>
    <div id="copy-free-wrap" style="display:none;margin-bottom:8px">
      <div id="copy-free-days"></div>
    </div>
    <div style="margin-bottom:8px">
      <label style="font-size:.75rem;font-weight:700;color:#546e7a;display:block;margin-bottom:3px">⏰ שעה (אופציונלי)</label>
      <input type="time" id="copy-time" style="width:100%;font-size:.85rem;padding:5px;border-radius:6px;border:1.5px solid #e0e0e0">
    </div>
    <div style="margin-bottom:8px">
      <label style="font-size:.75rem;font-weight:700;color:#546e7a;display:block;margin-bottom:3px">📝 הערה (אופציונלי)</label>
      <input type="text" id="copy-note" placeholder="הערה לפעילות המועתקת" style="width:100%;font-size:.82rem;padding:5px;border-radius:6px;border:1.5px solid #e0e0e0">
    </div>
    <div id="copy-pair-wrap" style="display:none;background:#fff3e0;border-radius:6px;padding:7px 10px;margin-bottom:8px;font-size:.76rem">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
        <input type="checkbox" id="copy-pair-chk" onchange="copyDateChg()" style="accent-color:#e65100">
        <span>📎 העתק גם לבן הזוג: <b id="copy-pair-name"></b></span>
      </label>
    </div>
    <div id="copy-conflict-warn" style="display:none;background:#ffebee;border-radius:6px;padding:6px 9px;font-size:.75rem;color:#c62828;margin-bottom:8px"></div>
    <button onclick="doCopy()" style="width:100%;padding:9px;background:#1565c0;color:#fff;border:none;border-radius:7px;font-size:.88rem;font-weight:700;cursor:pointer">📋 העתק פעילות</button>
  </div>`;
  document.body.appendChild(el);
}

function copyShowFreeDays(s){
  const gid=s.g;
  const g=G(gid);
  const fromD=new Date(); // from today forward
  const DAY_HEB=['ראשון','שני','שלישי','רביעי','חמישי'];
  const busyDates=new Set(SCH.filter(x=>x.g===gid&&x.st!=='can').map(x=>x.d));
  const free=[]; let d=new Date(fromD);
  for(let i=0;i<30;i++){
    const dow=d.getDay();
    if(dow>=0&&dow<=4){
      const ds=d2s(d);
      const hol=getHolidayInfo(ds,g.city,gcls(g));
      if(!busyDates.has(ds)&&!hol) free.push({ds,lbl:DAY_HEB[dow]+' '+fD(ds)});
    }
    d.setDate(d.getDate()+1);
    if(free.length>=10) break;
  }
  const wrap=document.getElementById('copy-free-wrap');
  const fd=document.getElementById('copy-free-days');
  if(free.length){
    fd.innerHTML='<div style="font-size:.74rem;font-weight:700;color:#2e7d32;margin-bottom:5px">ימים פנויים — לחץ לבחירה:</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:4px">'+
      free.map(f=>`<button class="btn bg bsm" style="font-size:.72rem;padding:3px 9px" onclick="copyPickFree('${f.ds}')">${f.lbl}</button>`).join('')+
      '</div>';
    wrap.style.display='block';
  } else {
    wrap.style.display='none';
  }
}

function copyPickFree(ds){
  document.getElementById('copy-date').value=ds;
  copyDateChg();
}

function openCopy(id){
  _ensureCopyModal();
  _copySrcId=id;
  const s=SCH.find(x=>x.id===id); if(!s) return;
  const g=G(s.g);
  document.getElementById('copy-ev-info').innerHTML=
    `<b>${g.name}</b> · ${g.city} · <span style="color:#1565c0">${s.a}</span>${s.act?' · '+s.act:''}<br>
     תאריך מקורי: <b>${fD(s.d)} יום ${dayN(s.d)}</b> ${s.t?'⏰ '+fT(s.t):''}`;
  document.getElementById('copy-date').value='';
  document.getElementById('copy-time').value=s.t?fT(s.t):'';
  document.getElementById('copy-note').value='';
  document.getElementById('copy-conflict-warn').style.display='none';
  const copyPair=gardenPair(s.g);
  const pairWrap=document.getElementById('copy-pair-wrap');
  if(copyPair&&pairWrap){
    const partnerNames=copyPair.ids.filter(pid=>pid!==s.g).map(pid=>G(pid).name).filter(Boolean).join(', ');
    document.getElementById('copy-pair-name').textContent=partnerNames;
    pairWrap.style.display='block';
    document.getElementById('copy-pair-chk').checked=true;
  } else if(pairWrap){ pairWrap.style.display='none'; }
  copyShowFreeDays(s);
  document.getElementById('copym').style.display='flex';
}

function copyDateChg(){
  const nd=document.getElementById('copy-date').value;
  if(!nd){document.getElementById('copy-conflict-warn').style.display='none';return;}
  const s=SCH.find(x=>x.id===_copySrcId); if(!s) return;
  const conflict=SCH.some(x=>x.g===s.g&&x.d===nd&&x.st!=='can');
  const pairChk=document.getElementById('copy-pair-chk');
  let partnerConflict=false;
  if(pairChk&&pairChk.checked){
    const pair=gardenPair(s.g);
    if(pair) partnerConflict=pair.ids.filter(pid=>pid!==s.g).some(pid=>SCH.some(x=>x.g===pid&&x.d===nd&&x.st!=='can'));
  }
  const warnEl=document.getElementById('copy-conflict-warn');
  warnEl.style.display=(conflict||partnerConflict)?'block':'none';
  if(partnerConflict&&!conflict) warnEl.textContent='⚠️ לצהרון הבן זוג כבר קיימת פעילות בתאריך שנבחר!';
  else if(conflict) warnEl.textContent='⚠️ לגן זה כבר קיימת פעילות בתאריך שנבחר!';
}

function doCopy(){
  const nd=document.getElementById('copy-date').value;
  if(!nd){alert('יש לבחור תאריך');return;}
  const dow=s2d(nd).getDay();
  if(dow===5||dow===6){alert('לא ניתן לשבץ בשישי או שבת');return;}
  const nt=document.getElementById('copy-time').value;
  const userNote=document.getElementById('copy-note').value.trim();
  const s=SCH.find(x=>x.id===_copySrcId); if(!s) return;

  const makeEntry=(orig,extraId)=>{
    // Build a clean nt: strip previous copy-chain markers to avoid accumulation
    const cleanNt=(orig.nt||'').replace(/\(הועתק מ-[^)]+\)\s*\|?\s*/g,'').trim();
    const copyMark='(הועתק מ-'+fD(orig.d)+')';
    const finalNt=[copyMark, userNote, cleanNt].filter(Boolean).join(' | ');
    return {...orig, id:Date.now()+(extraId||0), d:nd, t:nt||orig.t,
      st:'ok', cr:'', pd:'', pt:'', nt:finalNt};
  };

  SCH.push(makeEntry(s,0));
  const pairChk=document.getElementById('copy-pair-chk');
  if(pairChk&&pairChk.checked){
    const pair=gardenPair(s.g);
    if(pair){
      pair.ids.filter(pid=>pid!==s.g).forEach((pid,i)=>{
        const partnerEv=SCH.find(x=>x.g===pid&&x.d===s.d&&x.st!=='can');
        if(partnerEv) SCH.push(makeEntry(partnerEv,i+1));
      });
    }
  }
  save(); document.getElementById('copym').style.display='none'; closeSP(); refresh();
  showToast(`📋 הועתק ל-${fD(nd)}`);
}

var _nsmTab='once'; // 'once'|'recur'|'makeup'

