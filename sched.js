function nsSetTab(tab){
  _nsmTab=tab;
  ['once','recur','makeup'].forEach(t=>{
    const btn=document.getElementById('ns-tab-'+t);
    const wrap=document.getElementById('ns-'+t+'-wrap');
    if(btn){
      const isActive = t===tab;
      btn.style.background=isActive?'#1a237e':'transparent';
      btn.style.color=isActive?'#fff':'#1a237e';
      btn.style.borderRadius='7px';
    }
    if(wrap) wrap.style.display=t===tab?'block':'none';
  });
  // Date/Time fields are shared between once and makeup
  const onceWrap=document.getElementById('ns-once-wrap');
  if(onceWrap) onceWrap.style.display=(tab==='once'||tab==='makeup')?'block':'none';

  // Free days wrap logic
  const freeWrap = document.getElementById('ns-free-wrap');
  if(freeWrap){
    if(tab==='makeup'){
      const gid=parseInt(document.getElementById('ns-g').value)||null;
      nsShowFreeDays(gid);
    } else {
      freeWrap.style.display='none';
    }
  }

  // Update header title
  const titles={once:'📅 שיבוץ חדש',recur:'🔁 שיבוץ קבוע',makeup:'↩️ שיבוץ השלמה'};
  (document.getElementById('nsm-title')||{}).textContent=titles[tab]||'➕ שיבוץ חדש';
  nsDateChg();
}


function nsGChg(){
  const gid=parseInt(document.getElementById('ns-g').value)||null;
  nsCheckPair(gid);
}

function openNewSched(gid, opts={}){
  // opts: {date, tab, makeupFrom}
  newSchedForGarden=gid||null;
  _nsmTab='once';
  (document.getElementById('nsm-title')||{}).textContent='➕ שיבוץ חדש';

  // Reset all fields
  const ns_date=document.getElementById('ns-date');
  if(ns_date) ns_date.value=opts.date||d2s(calD);
  const ns_time=document.getElementById('ns-time');
  if(ns_time) ns_time.value=opts.time||'';
  document.getElementById('ns-time-g2').value='';
  document.getElementById('ns-ph').value='';
  document.getElementById('ns-notes').value='';
  document.getElementById('ns-grp').value='1';
  const choiceWrap = document.getElementById('ns-g2-choice-wrap');
  const partnerWrap = document.getElementById('ns-g2-partner-wrap');
  if(choiceWrap) choiceWrap.style.display='none';
  if(partnerWrap) partnerWrap.style.display='none';
  
  const atSel=document.getElementById('ns-act-type');
  if(atSel){atSel.innerHTML='<option value="">בחר סוג פעילות...</option>';atSel.value='';}
  const atNew=document.getElementById('ns-act-type-new');
  if(atNew){atNew.style.display='none';atNew.value='';}
  document.getElementById('ns-warn').style.display='none';

  // Recur fields
  const today=td();
  const recurFrom=document.getElementById('ns-recur-from');
  const recurTo=document.getElementById('ns-recur-to');
  if(recurFrom) recurFrom.value=opts.date||today;
  if(recurTo){
    // Default end: end of current school year
    const y=new Date().getFullYear();
    const m=new Date().getMonth();
    recurTo.value=`${m>=8?y+1:y}-06-30`;
  }
  document.querySelectorAll('.ns-day-chk').forEach(c=>c.checked=false);
  // Pre-check day of selected date
  if(opts.date){
    const dObj=new Date(opts.date.replace(/-/g,'/'));
    const dayChk=document.querySelector(`.ns-day-chk[value="${dObj.getDay()}"]`);
    if(dayChk) dayChk.checked=true;
  }
  document.getElementById('ns-recur-preview').textContent='';

  // Makeup
  const makeupOrig=document.getElementById('ns-makeup-orig');
  if(makeupOrig) makeupOrig.value=opts.makeupFrom||'';

  // City/garden dropdowns
  const cityEl=document.getElementById('ns-city');
  cityEl.innerHTML='<option value="">בחר עיר</option>';
  cities().forEach(c=>cityEl.innerHTML+=`<option value='${c}'>${c}</option>`);

  if(gid){
    const g=G(gid);
    cityEl.value=g.city||'';
    nsRefG();
    setTimeout(()=>{
      document.getElementById('ns-g').value=gid;
      nsCheckPair(gid);
    },50);
  } else {
    document.getElementById('ns-g').innerHTML='<option value="">בחר עיר תחילה</option>';
  }

  // Set tab and times
  nsSetTab(opts.tab||'once');
  if(opts.time) document.getElementById('ns-time').value = fT(opts.time);
  
  if((opts.tab||'once')==='makeup') nsShowFreeDays(gid);
  else document.getElementById('ns-free-wrap').style.display='none';

  document.getElementById('nsm').classList.add('open');
}

function nsPreviewRecur(){
  const from=document.getElementById('ns-recur-from').value;
  const to=document.getElementById('ns-recur-to').value;
  const days=[...document.querySelectorAll('.ns-day-chk:checked')].map(c=>parseInt(c.value));
  if(!from||!to||!days.length){
    document.getElementById('ns-recur-preview').textContent='';
    return;
  }
  let count=0, cur=new Date(from.replace(/-/g,'/'));
  const end=new Date(to.replace(/-/g,'/'));
  while(cur<=end&&count<200){
    if(days.includes(cur.getDay())) count++;
    cur.setDate(cur.getDate()+1);
  }
  const dn=['ראשון','שני','שלישי','רביעי','חמישי'];
  const dayNames=days.map(d=>dn[d]).join(', ');
  document.getElementById('ns-recur-preview').textContent=`📅 יימצאו ${count} פעילויות (ימים: ${dayNames}, ${fD(from)}–${fD(to)})`;
}
function nsRefG(){
  const cityEl = document.getElementById('ns-city');
  const city = cityEl ? cityEl.value : '';
  const gs=gByCF(city,'').sort((a,b)=>a.name.localeCompare(b.name,'he'));
  const sel=document.getElementById('ns-g');
  if(!sel) return;
  sel.innerHTML='<option value="">בחר גן</option>';
  gs.forEach(g=>sel.innerHTML+=`<option value="${g.id}">${g.name}</option>`);
  
  const choiceWrap = document.getElementById('ns-g2-choice-wrap');
  const partnerWrap = document.getElementById('ns-g2-partner-wrap');
  if(choiceWrap) choiceWrap.style.display='none';
  if(partnerWrap) partnerWrap.style.display='none';
  
  const grpWrap = document.getElementById('ns-grp-wrap');
  if(grpWrap) grpWrap.style.display='none';
  
  sel.onchange=function(){nsCheckPair(parseInt(this.value)||null);};
}
function nsCheckPair(gid){
  if(!gid) return;
  const g=G(gid);
  document.getElementById('ns-grp-wrap').style.display='block';
  const pair=gardenPair(gid);
  const choiceWrap = document.getElementById('ns-g2-choice-wrap');
  const partnerWrap = document.getElementById('ns-g2-partner-wrap');
  
  if(pair && pair.ids.length>=2){
    const partnerId = pair.ids.find(id=>id!==gid);
    if(partnerId){
      const partG = G(partnerId);
      if(choiceWrap) choiceWrap.style.display='block';
      const lbl = document.getElementById('ns-g2-lbl');
      if(lbl) lbl.textContent=`צהרון בן זוג? (${partG.name})`;
      const g2sel = document.getElementById('ns-g2');
      if(g2sel){
        g2sel.innerHTML=`<option value="">לא - רק ל${g.name}</option><option value="${partnerId}" selected>כן - גם ל${partG.name}</option>`;
        g2sel.onchange = () => {
          if(partnerWrap) partnerWrap.style.display = g2sel.value ? 'block' : 'none';
        };
      }
      
      const nameDisp = document.getElementById('ns-g2-name-display');
      if(nameDisp) nameDisp.textContent = partG.name;
      
      // Secondary time for partner
      const t2inp = document.getElementById('ns-time-g2');
      if(t2inp){
        const date=document.getElementById('ns-date').value;
        const partnerEv=window.SCH.find(x=>x.g===partnerId && x.d===date && x.st!=='can');
        if(partnerEv&&partnerEv.t) t2inp.value=fT(partnerEv.t);
        else t2inp.value='';
      }
      // Trigger display if selected
      if(partnerWrap) partnerWrap.style.display = (g2sel && g2sel.value) ? 'block' : 'none';
    }
  } else {
    if(choiceWrap) choiceWrap.style.display='none';
    if(partnerWrap) partnerWrap.style.display='none';
  }
  nsDateChg();
}

function nsShowFreeDays(gid){
  if(!gid){ document.getElementById('ns-free-wrap').style.display='none'; return; }
  const g=G(gid);
  const fromD=new Date(); // from today
  const DAY_HEB=['ראשון','שני','שלישי','רביעי','חמישי'];
  const busyDates=new Set(window.SCH.filter(x=>x.g===gid&&x.st!=='can').map(x=>x.d));
  const free=[]; let d=new Date(fromD);
  for(let i=0;i<21;i++){
    const dow=d.getDay();
    if(dow>=0&&dow<=4){
      const ds=d2s(d);
      const hol=getHolidayInfo(ds,g.city,gcls(g));
      if(!busyDates.has(ds)&&!hol) free.push({ds,lbl:DAY_HEB[dow]+' '+fD(ds)});
    }
    d.setDate(d.getDate()+1);
  }
  const wrap=document.getElementById('ns-free-wrap');
  const fd=document.getElementById('ns-free-days');
  if(!wrap||!fd) return;
  if(free.length){
    fd.innerHTML='<div style="font-size:.74rem;font-weight:700;color:#2e7d32;margin-bottom:5px;width:100%">ימים פנויים לשיבוץ — לחץ לבחירה:</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:4px">'+
      free.map(f=>`<button class="btn bg bsm" style="font-size:.72rem;padding:3px 9px" onclick="nsPickFree('${f.ds}')">${f.lbl}</button>`).join('')+
      '</div>';
    wrap.style.display='block';
  } else {
    fd.innerHTML='<div style="color:#e65100;font-size:.75rem">אין ימים פנויים ב-21 יום הקרובים</div>';
    wrap.style.display='block';
  }
}

function nsPickFree(ds){
  const dateInp = document.getElementById('ns-date');
  if(dateInp){
    dateInp.value=ds;
    nsDateChg();
  }
}

function nsDateChg(){
  const gid=parseInt(document.getElementById('ns-g').value);
  const date=document.getElementById('ns-date').value;
  const hintEl=document.getElementById('ns-partner-time-hint');
  if(!hintEl) return;
  if(!gid||!date){ hintEl.style.display='none'; return; }
  
  const pair=gardenPair(gid);
  if(!pair){ hintEl.style.display='none'; return; }
  
  const pId=pair.ids.find(id=>id!==gid);
  if(!pId){ hintEl.style.display='none'; return; }
  
  const partnerG=G(pId);
  const partnerEv=window.SCH.find(x=>x.g===pId && x.d===date && x.st!=='can');
  
  if(partnerEv && partnerEv.t){
    hintEl.textContent=`⏰ שעת גן ${partnerG.name}: ${fT(partnerEv.t)}`;
    hintEl.style.display='block';
  } else {
    hintEl.style.display='none';
  }
}

function nsSupChg(){
  const sup=document.getElementById('ns-sup').value;
  if(!sup) return;
  const base=supBase(sup);
  const ex=window.supEx[base]||window.supEx[sup]||{};
  const ph=ex.ph1||(SUPBASE.find(s=>supBase(s.name)===base&&s.phone)||SUPBASE.find(s=>s.name===sup)||{}).phone||'';
  document.getElementById('ns-ph').value=ph;
  // alias hint
  const aliasWrap=document.getElementById('ns-alias-wrap');
  const aliasHint=document.getElementById('ns-alias-hint');
  if(aliasWrap&&aliasHint){
    if(ex.alias){aliasHint.textContent=`🏷️ יוצג כ: "${ex.alias}"`;aliasWrap.style.display='block';}
    else{aliasHint.textContent='';aliasWrap.style.display='none';}
  }
  document.getElementById('ns-grp-wrap').style.display='block';
  const actSel=document.getElementById('ns-act-type');
  if(!actSel) return;
  const acts=getSupActs(sup);
  actSel.innerHTML='<option value="">בחר סוג פעילות...</option>'+
    acts.map(a=>`<option value='${a}'>${a}</option>`).join('')+
    '<option value="__new__">➕ הוסף פעילות חדשה...</option>';
}
function nsActTypeChg(){
  const v=document.getElementById('ns-act-type').value;
  const newInp=document.getElementById('ns-act-type-new');
  if(newInp) newInp.style.display=v==='__new__'?'inline-block':'none';
}
function saveNewSched(){
  const gid=parseInt(document.getElementById('ns-g').value)||null;
  const g2id=parseInt(document.getElementById('ns-g2').value)||null;
  const date=document.getElementById('ns-date').value;
  const time=document.getElementById('ns-time').value;
  const sup=document.getElementById('ns-sup').value;
  if(date&&gid){
    const _g=G(gid);
    const _hol=getHolidayInfo(date,_g.city||null,gcls(_g)||null);
    if(_hol&&!_hol.canSched&&(_hol.type==='noact'||_hol.type==='vacation'||_hol.type==='camp')){
      if(!confirm('⚠️ יש '+_hol.emoji+' '+_hol.name+' ביום זה.\nבכל זאת לשבץ?')) return;
    }
  }
  const ph=document.getElementById('ns-ph').value;
  const notes=document.getElementById('ns-notes').value;
  const grp=parseInt(document.getElementById('ns-grp').value)||1;
  let actType=document.getElementById('ns-act-type').value;
  if(actType==='__new__'){actType=document.getElementById('ns-act-type-new').value.trim();}
  const evTp=(document.getElementById('ns-ev-type')||{}).value||'חוג';
  if(actType&&actType!=='__new__'){
    if(!window.supEx[sup]) window.supEx[sup]={};
    if(!Array.isArray(window.supEx[sup].acts)) window.supEx[sup].acts=getSupActs(sup);
    if(!window.supEx[sup].acts.includes(actType)) window.supEx[sup].acts.push(actType);
  }
  if(!gid||!date||!sup){alert('יש למלא: גן, תאריך, ספק');return;}
  const g=G(gid);
  if(gcls(g)==='גנים'&&time){
    const h=parseInt(time.split(':')[0]);
    const period=h<13?'morning':'afternoon';
    const conflict=window.SCH.find(s=>s.g===gid&&s.d===date&&s.st!=='can'&&s.t&&(parseInt(s.t.split(':')[0])<13?'morning':'afternoon')===period&&s.id!==undefined);
    if(conflict){
      document.getElementById('ns-warn').style.display='block';
      (document.getElementById('ns-warn')||{}).textContent =`⚠️ כבר קיימת פעילות ב${period==='morning'?'בוקר':'אחה"צ'}: ${conflict.a} ב-${fT(conflict.t)}`;
      return;
    }
  }
  const newId=Date.now();

  if(_nsmTab==='recur'){
    // Recurring schedule — generate all matching dates
    const recurFrom=document.getElementById('ns-recur-from').value;
    const recurTo=document.getElementById('ns-recur-to').value;
    const selDays=[...document.querySelectorAll('.ns-day-chk:checked')].map(c=>parseInt(c.value));
    const recurTime=time; // now using shared time field
    if(!recurFrom||!recurTo||!selDays.length){alert('שיבוץ קבוע: יש לבחור תאריך התחלה, סיום, וימים');return;}
    let count=0, cur=new Date(recurFrom.replace(/-/g,'/'));
    const endD=new Date(recurTo.replace(/-/g,'/'));
    const recurring_id=Date.now();
    while(cur<=endD&&count<365){
      if(selDays.includes(cur.getDay())){
        const ds=d2s(cur);
        const _hol2=getHolidayInfo(ds,G(gid).city||null,gcls(G(gid))||null);
        if(!_hol2||_hol2.type==='info'||_hol2.canSched){
          const eid=recurring_id+count;
          const ev={id:eid,g:gid,d:ds,a:sup,act:actType,tp:evTp||'חוג',t:recurTime,p:ph,n:notes,st:'ok',cr:'',cn:'',nt:notes,pd:'',pt:'',grp,_recId:recurring_id};
          window.SCH.push(ev);
          if(g2id) window.SCH.push({...ev,id:eid+1000,g:g2id});
          count++;
        }
      }
      cur.setDate(cur.getDate()+1);
    }
    saveAndRefresh('nsm');
    showToast(`✅ נוצרו ${count} פעילויות קבועות`);
    return;
  }

  if(_nsmTab==='makeup'){
    // Makeup schedule
    const makeupOrig=document.getElementById('ns-makeup-orig').value;
    const makeupNote = `השלמה מ-${fD(makeupOrig)}`;
    const fullNote = notes ? notes + ' | ' + makeupNote : makeupNote;
    const newSched={id:newId,g:gid,d:date,a:sup,act:actType,tp:evTp||'חוג',t:time,p:ph,n:fullNote,st:'ok',cr:'',cn:'',nt:fullNote,pd:'',pt:'',grp,_makeupFrom:makeupOrig||'',_isMakeup:true};
    
    // Requirement: Link back to original activity and mark it as completed
    if(typeof _makeupOrigId !== 'undefined' && _makeupOrigId){
      const origExt = window.SCH.find(x => x.id === _makeupOrigId);
      if(origExt) origExt._compByMakeup = newId;
    }

    window.SCH.push(newSched);
    if(g2id) {
      const g2time = document.getElementById('ns-time-g2').value || time;
      window.SCH.push({...newSched,id:newId+1,g:g2id,t:g2time});
    }
    saveAndRefresh('nsm');
    showToast('✅ שיבוץ השלמה נשמר');
    return;
  }

  // One-time
  const newSched={id:newId,g:gid,d:date,a:sup,act:actType,tp:evTp||'חוג',t:time,p:ph,n:notes,st:'ok',cr:'',cn:'',nt:notes,pd:'',pt:'',grp};
  window.SCH.push(newSched);
  if(g2id){
    const g2time = document.getElementById('ns-time-g2').value || time;
    window.SCH.push({...newSched,id:newId+1,g:g2id,t:g2time,nt:notes});
  }
  saveAndRefresh('nsm');
  showToast('✅ שיבוץ נשמר');
}

function sSchedStChange(){
  const st=document.getElementById('s-st').value;
  const from=document.getElementById('s-from');
  const to=document.getElementById('s-to');
  if(!st){
    // הכל → default to today
    if(from&&!from.value) from.value=td();
    if(to&&!to.value) to.value=td();
  } else {
    // ספציפי → clear date filter to show all
    if(from) from.value='';
    if(to) to.value='';
  }
  sPage=1; renderSched();
}
function sRefG(){
  const city=document.getElementById('s-city').value;
  const cls=document.getElementById('s-cls').value;
  const gs=gByCF(city,cls).sort((a,b)=>a.name.localeCompare(b.name,'he'));
  ['s-g1','s-g2','s-g3'].forEach((id,i)=>{
    const sel=document.getElementById(id);
    sel.innerHTML=i===0?'<option value="">כל הצהרונים</option>':'<option value="">—</option>';
    gs.forEach(g=>sel.innerHTML+=`<option value="${g.id}">${city?g.name:g.city+' · '+g.name}</option>`);
  });
  sPage=1;renderSched();
}
function getFiltSched(){
  const city=document.getElementById('s-city').value;
  const cls=document.getElementById('s-cls').value;
  const g1=parseInt(document.getElementById('s-g1').value)||null;
  const g2=parseInt(document.getElementById('s-g2').value)||null;
  const g3=parseInt(document.getElementById('s-g3').value)||null;
  const sup=document.getElementById('s-sup').value;
  const th=document.getElementById('s-th').value;
  const tt=document.getElementById('s-tt').value;
  const from=document.getElementById('s-from').value;
  const to=document.getElementById('s-to').value;
  const st=document.getElementById('s-st').value;
  const type=document.getElementById('s-type').value;
  const srch=document.getElementById('s-srch').value.toLowerCase();
  const gids=[g1,g2,g3].filter(Boolean);
  const isM = s => !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה/i.test(s.nt)));
  return window.SCH.filter(s=>{
    const g=G(s.g);
    if(type==='makeup' && !isM(s)) return false;
    if(type==='reg' && isM(s)) return false;
    if(city&&g.city!==city) return false;
    if(cls&&gcls(g)!==cls) return false;
    if(gids.length&&!gids.includes(s.g)) return false;
    if(sup&&supBase(s.a)!==sup&&s.a!==sup) return false;
    if(th&&s.t&&s.t<th) return false;
    if(tt&&s.t&&s.t>tt) return false;
    if(from&&s.d<from) return false;
    if(to&&s.d>to) return false;

    // Status Logic
    if(st==='todo'){
      if(!(s.st==='nohap' || s.st==='post' || isM(s))) return false;
    } else if(!st) {
       if(s.st==='can') return false;
    } else if(s.st!==st) return false;

    if(srch&&![(g.name||''),(g.city||''),(s.a||''),(s.nt||'')].some(x=>x.toLowerCase().includes(srch))) return false;
    return true;
  }).sort((a,b)=>a.d.localeCompare(b.d)||(a.t||'').localeCompare(b.t||''));
}

// Global Bridge
window.renderSched = renderSched;
window.setSchedView = setSchedView;
window.navSched = navSched;
window.navSchedToday = navSchedToday;
window.sSchedStChange = sSchedStChange;
window.sRefG = sRefG;
function setSchedView(v){
  const sf=document.getElementById('s-from'), st2=document.getElementById('s-to');
  if(!sf||!st2) return;
  const base=sf.value||td();
  const d=s2d(base);
  if(v==='day'){
    sf.value=td(); st2.value=td();
  } else if(v==='week'){
    const mon=monStart(new Date(d)); sf.value=d2s(mon); st2.value=d2s(addD(mon,6));
  } else if(v==='month'){
    const y=d.getFullYear(), m=d.getMonth();
    sf.value=d2s(new Date(y,m,1)); st2.value=d2s(new Date(y,m+1,0));
  }
  ['day','week','month'].forEach(x=>document.getElementById('svb-'+x)?.classList.toggle('active',x===v));
  sPage=1; renderSched();
}

function navSched(dir){
  const sf=document.getElementById('s-from'),st2=document.getElementById('s-to');
  if(!sf||!st2) return;
  const from=sf.value||td(),to=st2.value||td();
  const d1=s2d(from),d2=s2d(to);
  const span=Math.max(0,Math.round((d2-d1)/(1000*60*60*24)));
  const nd1=addD(d1,dir*(span+1));
  const nd2=addD(nd1,span);
  sf.value=d2s(nd1); st2.value=d2s(nd2);
  sPage=1; renderSched();
}
function navSchedToday(){
  const t=td();
  document.getElementById('s-from').value=t;
  document.getElementById('s-to').value=t;
  sPage=1; renderSched();
}
function renderSched(){
  const all=getFiltSched();
  const hasFilter=['s-city','s-cls','s-sup','s-th','s-tt','s-from','s-to','s-st','s-srch'].some(id=>{const el=document.getElementById(id);return el&&el.value;});
  const todayDate=document.getElementById('s-from').value||document.getElementById('s-to').value;
  const pages=Math.ceil(all.length/PG);
  if(sPage>pages&&pages>0) sPage=1;
  const data=all.slice((sPage-1)*PG,sPage*PG);
  (document.getElementById('s-info')||{}).textContent =`מציג ${data.length} מתוך ${all.length.toLocaleString()} פעילויות`;
  const byDate={};
  data.forEach(s=>{
    const dk=s._isPostponed?s.pd:s.d;
    if(!byDate[dk]) byDate[dk]={};
    const g=G(s.g);
    const c=g.city||'אחר';
    const cl=gcls(g);
    if(!byDate[dk][c]) byDate[dk][c]={gan:[],window.SCH:[]};
    if(cl==='ביה"ס') byDate[dk][c].window.SCH.push({...s,gd:g});
    else byDate[dk][c].gan.push({...s,gd:g});
  });

  let h='';
  Object.keys(byDate).sort().forEach(dateKey=>{
    h+=`<div style="font-weight:800;color:#1a237e;font-size:.83rem;padding:6px 10px;background:#e8eaf6;border-radius:6px;margin-bottom:6px;margin-top:10px">
      📅 ${fD(dateKey)} יום ${dayN(dateKey)}
    </div>`;
    Object.keys(byDate[dateKey]).sort().forEach(city=>{
      const cityData=byDate[dateKey][city];
      h+=`<div style="margin-bottom:8px">
        <div style="font-size:.75rem;font-weight:700;color:#546e7a;padding:3px 8px;background:#eceff1;border-radius:4px;margin-bottom:4px">🏙️ ${city}</div>`;
      [{arr:cityData.gan,lbl:'🏫 צהרונים',cls:'gan'},{arr:cityData.window.SCH,lbl:'🏛️ בתי ספר',cls:'window.SCH'}].forEach(sec=>{
        if(!sec.arr.length) return;
        h+=`<div class="dsh ${sec.cls}" style="font-size:.7rem;margin-bottom:3px">${sec.lbl}</div>
          <div class="tw"><table style="margin-bottom:6px"><thead><tr>
            <th>צהרון</th><th>ספק</th><th>שעה</th><th>סטטוס</th><th>הערות</th><th style="width:130px">פעולות</th>
          </tr></thead><tbody>`;
        sec.arr.sort((a,b)=>{
          // Sort by pair name first, then time — matches calendar order
          const pA=gardenPair(a.g),pB=gardenPair(b.g);
          const pnA=pA?pA.name:G(a.g).name;
          const pnB=pB?pB.name:G(b.g).name;
          return pnA.localeCompare(pnB,'he')||(a.t||'99:99').localeCompare(b.t||'99:99');
        }).forEach(s=>{
          h+=`<tr onclick="openSP(${s.id})" class="${stClass(s)}" style="cursor:pointer">
            <td><div style="font-weight:700">${s.gd.name}</div>${s.gd.st?`<div style="font-size:.68rem;color:#78909c">${s.gd.st}</div>`:''}</td>
            <td><div style="font-weight:700">${supBase(s.a)}</div>${supAct(s.a)?`<div style="font-size:.7rem;color:#1565c0">🎯 ${supAct(s.a)}</div>`:''}<span style="font-size:.68rem;color:#78909c">${s.p||''}</span></td>
            <td>${window.fT ? window.fT(s.t) : s.t}</td>
            <td>${window.stLabel ? window.stLabel(s) : ''}</td>
            <td style="max-width:90px;font-size:.72rem">${s.nt||''}</td>
            <td onclick="event.stopPropagation()">${window._quickActionBtns ? window._quickActionBtns(s) : ''}</td>
          </tr>`;
        });
        h+='</tbody></table></div>';
      });
      h+='</div>';
    });
  });
  if(!h) h='<p style="color:#999;text-align:center;padding:20px">אין פעילויות</p>';
  document.getElementById('s-body').innerHTML=h;
  setTimeout(_fitScrollAreas,50);
  let pg='';
  if(pages>1){
    const st=Math.max(1,sPage-3),en=Math.min(pages,sPage+3);
    if(st>1) pg+=`<button class="pgbtn" onclick="goPg(1)">1</button>`;
    if(st>2) pg+='<span>…</span>';
    for(let p=st;p<=en;p++) pg+=`<button class="pgbtn ${p===sPage?'active':''}" onclick="goPg(${p})">${p}</button>`;
    if(en<pages-1) pg+='<span>…</span>';
    if(en<pages) pg+=`<button class="pgbtn" onclick="goPg(${pages})">${pages}</button>`;
  }
  document.getElementById('s-pag').innerHTML=pg;
}
function goPg(p){sPage=p;renderSched();}
function clearSched(){
  ['s-city','s-cls','s-sup','s-th','s-tt','s-from','s-to','s-st','s-srch'].forEach(id=>document.getElementById(id).value='');
  sRefG();
}

