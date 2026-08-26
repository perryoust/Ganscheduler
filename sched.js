function nsSetTab(tab){
  _nsmTab=tab;
  ['once','recur','makeup'].forEach(t=>{
    const btn=document.getElementById('ns-tab-'+t);
    const wrap=document.getElementById('ns-'+t+'-wrap');
    if(btn){
      if(t===tab) btn.classList.add('active');
      else btn.classList.remove('active');
      // Clean up old dynamic inline style assignments
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderRadius = '';
      btn.style.boxShadow = '';
      btn.style.fontWeight = '';
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
      const date=document.getElementById('ns-date').value;
      nsShowFreeDays(gid);
      window.updateMakeupPartnersTable('ns-mu-partners-wrap', gid, date);
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
  if (window.isReadOnly) {
    alert('משתמש זה מוגדר כמשתמש צפייה בלבד (רכז). אין אפשרות לבצע שינויים.');
    return;
  }
  // opts: {date, tab, makeupFrom}
  newSchedForGarden=gid||null;
  _nsmTab='once';
  (document.getElementById('nsm-title')||{}).textContent='➕ שיבוץ חדש';

  // Reset all fields
  window.nsCustomPartners = new Set();

  // Smart date defaults based on active academic year/period
  const today = window.td();
  let yearStart = '';
  let yearEnd = '';
  let recurEnd = '';
  
  try {
    const metaStr = window._safeLS.getItem('ganv5_meta');
    const meta = metaStr ? JSON.parse(metaStr) : null;
    const curY = window.CURRENT_YEAR || (meta ? meta.currentYear : 'tashpav');
    const yInfo = meta && meta.years ? meta.years[curY] : null;
    
    if (yInfo && yInfo.start && yInfo.end) {
      yearStart = yInfo.start;
      yearEnd = yInfo.end;
      const startParts = yInfo.start.split('-').map(Number);
      const startY = startParts[0];
      const startM = startParts[1];
      
      // If year starts in Sep-Dec, regular class activities end June 30th of the following year
      if (startM >= 8) {
        recurEnd = `${startY + 1}-06-30`;
      } else {
        // Summer camp or custom period
        recurEnd = yInfo.end;
      }
    }
  } catch(e) { console.warn('Error reading year meta in openNewSched:', e); }

  const defaultStartDate = opts.date || (yearStart && (today < yearStart || (yearEnd && today > yearEnd)) ? yearStart : today);

  const ns_date=document.getElementById('ns-date');
  if(ns_date) ns_date.value = defaultStartDate;
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
  
  const ns_sup=document.getElementById('ns-sup');
  if(ns_sup) ns_sup.value=opts.sup||'';
  nsSupChg();
  document.getElementById('ns-warn').style.display='none';

  // Recur fields
  const recurFrom=document.getElementById('ns-recur-from');
  const recurTo=document.getElementById('ns-recur-to');
  if(recurFrom) recurFrom.value = defaultStartDate;
  if(recurTo) {
    if (recurEnd) {
      recurTo.value = recurEnd;
    } else {
      const y = new Date().getFullYear();
      const m = new Date().getMonth();
      recurTo.value = `${m >= 8 ? y + 1 : y}-06-30`;
    }
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
  window.cities().forEach(c=>cityEl.innerHTML+=`<option value='${c}'>${c}</option>`);

  if(gid){
    const g=window.G(gid);
    cityEl.value=g.city||'';
    nsRefG();
    setTimeout(()=>{
      document.getElementById('ns-g').value=gid;
      nsCheckPair(gid);
    },50);
  } else {
    document.getElementById('ns-g').innerHTML='<option value="">בחר עיר תחילה</option>';
  }

  // Populate Group/Cluster preset initially
  window.nsUpdateGrpPreset(opts.date || window.d2s(new Date()));
  if (opts.grpId) {
    const grpSel = document.getElementById('ns-grp-preset');
    if (grpSel) {
      grpSel.value = opts.grpId;
      setTimeout(() => window.nsLoadGrpPreset(), 50);
    }
  }

  // Set tab and times
  nsSetTab(opts.tab||'once');
  if(opts.time) document.getElementById('ns-time').value = window.fT(opts.time);
  
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
  document.getElementById('ns-recur-preview').textContent=`📅 יימצאו ${count} פעילויות (ימים: ${dayNames}, ${window.fD(from)}–${window.fD(to)})`;
}
function nsRefG(){
  const cityEl = document.getElementById('ns-city');
  const city = cityEl ? cityEl.value : '';
  const gs=window.gByCF(city,'').sort((a,b)=>a.name.localeCompare(b.name,'he'));
  const sel=document.getElementById('ns-g');
  if(!sel) return;
  sel.innerHTML='<option value="">בחר צהרון</option>';
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
  const date = document.getElementById('ns-date')?.value || window.d2s(new Date());
  const g=window.G(gid);
  document.getElementById('ns-grp-wrap').style.display='block';
  const pair=window.gardenPair(gid, date);
  const choiceWrap = document.getElementById('ns-g2-choice-wrap');
  
  if(pair && pair.ids.length >= 2){
    renderPartnerTable();
    
    // Add Dynamic Explanation (if not already there)
    const infoDivId = 'ns-pair-info-notice';
    let infoDiv = document.getElementById(infoDivId);
    if(!infoDiv && choiceWrap){
      infoDiv = document.createElement('div');
      infoDiv.id = infoDivId;
      infoDiv.className = 'info-notice';
      choiceWrap.insertBefore(infoDiv, choiceWrap.firstChild);
    }
    if(infoDiv){
      const otherIds = pair.ids.map(Number).filter(oid => oid !== Number(gid));
      const partNames = otherIds.map(id => window.G(id).name).join(', ');
      infoDiv.innerHTML = `<span class="icon">🔗</span><div><b>שים לב:</b> גן זה מקושר ל-<b>${partNames}</b>. מומלץ לשבץ אותם יחד.</div>`;
    }

    if(choiceWrap) choiceWrap.style.display = 'block';
  } else {
    if(choiceWrap) choiceWrap.style.display = 'none';
  }
  nsDateChg();
}

function renderPartnerTable(){
  const gid=parseInt(document.getElementById('ns-g').value);
  const date=document.getElementById('ns-date').value;
  const pair=window.gardenPair(gid, date);
  const g2ChoiceContainer = document.getElementById('ns-g2-choice-container');
  if(!g2ChoiceContainer) return;

  const allIdsSet = new Set();
  if (gid) allIdsSet.add(Number(gid));

  const infoDiv = document.getElementById('ns-pair-info-notice');

  if (window.nsCustomPartners && window.nsCustomPartners.size > 0) {
    window.nsCustomPartners.forEach(id => {
      allIdsSet.add(Number(id));
    });
    if (infoDiv) infoDiv.style.display = 'none';
  } else {
    if(pair && pair.ids) {
      pair.ids.map(Number).forEach(id => allIdsSet.add(id));
    }
    if (infoDiv) infoDiv.style.display = 'block';
  }
  
  const allIds = Array.from(allIdsSet);

  // Preserve existing inputs from DOM before re-rendering
  const existingTimes = {};
  document.querySelectorAll('.ns-syn-time').forEach(inp => {
    const pGid = inp.getAttribute('data-gid');
    if (pGid && inp.value) existingTimes[Number(pGid)] = inp.value;
  });
  const existingChecks = {};
  document.querySelectorAll('.ns-syn-chk').forEach(chk => {
    const pGid = chk.value;
    if (pGid) existingChecks[Number(pGid)] = chk.checked;
  });

  let rowsHtml = '';
  
  if(!allIds.length){
    rowsHtml = '<tr><td colspan="7" style="text-align:center;padding:12px;color:#777">אין גנים שותפים כרגע</td></tr>';
  } else {
    allIds.forEach(pId => {
      const isPrimary = Number(pId) === Number(gid);
      const pG = window.G(pId);
      if(!pG) return;
      const ev = window.SCH.find(s => Number(s.g) === Number(pId) && s.d === date && s.st !== 'can');
      
      const stLabel = ev ? (window.stLabel ? window.stLabel(ev) : ev.st) : '—';
      const stClass = ev ? (window.stClass ? window.stClass(ev) : '') : '';
      const sup = ev ? window.supBase(ev.a) : '—';
      const act = ev ? (ev.act || (typeof window.supAct === 'function' ? window.supAct(ev.a) : '') || '—') : '—';
      const type = ev ? (ev.tp || 'חוג') : '—';
      
      const savedInputTime = existingTimes[Number(pId)];
      const defaultTime = document.getElementById('ns-time')?.value || '';
      const timeVal = ev ? (window.fT ? window.fT(ev.t) : ev.t) : (savedInputTime || defaultTime);
      
      let timeDisplay;
      let chkDisplay;
      
      if (isPrimary) {
        timeDisplay = ev ? `<span style="font-weight:600">${timeVal}</span>` : `<input type="time" id="ns-primary-time-table" class="ns-syn-time" data-gid="${pId}" value="${timeVal}" style="width:70px;font-size:.7rem;padding:2px" onchange="document.getElementById('ns-time').value = this.value">`;
        chkDisplay = `<input type="checkbox" checked disabled style="width:18px;height:18px;accent-color:#1565c0" title="גן ראשי - תמיד נכלל">`;
      } else {
        const isChecked = existingChecks[Number(pId)] !== undefined ? existingChecks[Number(pId)] : true;
        timeDisplay = ev ? `<span style="font-weight:600">${timeVal}</span>` : `<input type="time" class="ns-syn-time" data-gid="${pId}" value="${timeVal}" style="width:70px;font-size:.7rem;padding:2px">`;
        chkDisplay = `<input type="checkbox" id="ns-syn-chk-${pId}" class="ns-syn-chk" value="${pId}" style="width:18px;height:18px;accent-color:#1565c0" ${isChecked ? 'checked' : ''}>`;
      }

      rowsHtml += `
        <tr class="${stClass}">
          <td style="text-align:center">${chkDisplay}</td>
          <td style="font-weight:800;color:#1a237e">${pG.name}</td>
          <td>${timeDisplay}</td>
          <td style="font-weight:600">${sup}</td>
          <td>${act}</td>
          <td>${type}</td>
          <td>${stLabel}</td>
        </tr>`;
    });
  }

  g2ChoiceContainer.innerHTML = `
    <div style="font-size:0.75rem;font-weight:700;color:#546e7a;margin-bottom:8px">🔗 גנים שותפים לסנכרון (בחר לשיבוץ מקביל):</div>
    <div class="tw" style="margin-bottom:10px; border-radius:8px; overflow:hidden; border:1px solid #e0e0e0">
      <table style="width:100%;font-size:0.72rem;border-collapse:collapse">
        <thead>
          <tr style="background:#f1f3f9">
            <th style="width:40px;text-align:center;padding:8px">סמן</th>
            <th style="padding:8px">שם הצהרון</th>
            <th style="padding:8px">שעה</th>
            <th style="padding:8px">ספק</th>
            <th style="padding:8px">פעילות</th>
            <th style="padding:8px">סוג</th>
            <th style="padding:8px">סטטוס</th>
          </tr>
        </thead>
        <tbody id="ns-partners-table-body">
          ${rowsHtml}
        </tbody>
      </table>
      <div style="padding:8px; border-top:1px solid #e0e0e0; background:#fff">
        <div style="font-size:0.7rem; color:#546e7a; margin-bottom:4px; font-weight:bold">➕ הוסף גנים/בתי ספר נוספים לסנכרון:</div>
        <div style="display:flex; flex-direction:column; gap:4px; position:relative;">
          <div onclick="document.getElementById('ns-custom-cb-wrap').style.display=document.getElementById('ns-custom-cb-wrap').style.display==='none'?'block':'none'" style="font-size:0.75rem; padding:4px; border:1px solid #ccc; border-radius:4px; background:#fff; cursor:pointer; display:flex; justify-content:space-between">
            <span>בחר גנים (לחץ לפתיחה)...</span>
            <span>▼</span>
          </div>
          <div id="ns-custom-cb-wrap" style="display:none; background:#fff; border:1px solid #ccc; max-height:200px; overflow-y:auto; margin-top:4px; border-radius:4px; box-shadow:inset 0 1px 3px rgba(0,0,0,0.1)">
            <div style="position:sticky; top:0; z-index:10; background:#eee; padding:6px; display:flex; justify-content:space-between; border-bottom:1px solid #ccc">
               <button type="button" onclick="window.nsAddCustomGardens()" style="background:#1565c0; color:#fff; border:none; border-radius:4px; padding:4px 12px; font-size:0.75rem; cursor:pointer; font-weight:bold; box-shadow:0 1px 3px rgba(0,0,0,0.3)">➕ הוסף מסומנים</button>
               <button type="button" onclick="document.getElementById('ns-custom-cb-wrap').style.display='none'" style="cursor:pointer; font-size:0.8rem; border:none; background:transparent">❌ סגור</button>
            </div>
            ${window.nsGenerateAllGardensCheckboxes ? window.nsGenerateAllGardensCheckboxes() : ''}
          </div>
        </div>
      </div>
      <div style="padding:8px; border-top:1px solid #e0e0e0; background:#f9fbe7">
        <label style="font-size:0.75rem; color:#33691e; margin-bottom:4px; font-weight:bold; display:block">🔗 שמירת סנכרון זה לתצוגה מקובצת ביומן:</label>
        <select id="ns-save-group-type" onchange="document.getElementById('ns-save-group-name').style.display=this.value==='none'?'none':'block'" style="width:100%; font-size:0.75rem; padding:4px; border:1px solid #ccc; border-radius:4px">
          <option value="none">אל תשמור כקבוצה (סנכרון פעילות בלבד)</option>
          <option value="pair_temp">זוג חד-פעמי (לתאריך זה בלבד)</option>
          <option value="pair_perm">זוג קבוע</option>
          <option value="cluster_temp">אשכול חד-פעמי (לתאריך זה בלבד)</option>
          <option value="cluster_perm">אשכול קבוע</option>
        </select>
        <input type="text" id="ns-save-group-name" placeholder="שם הקבוצה (אופציונלי)" style="display:none; width:100%; margin-top:6px; font-size:0.75rem; padding:4px; border:1px solid #ccc; border-radius:4px;">
      </div>
    </div>`;
}

window.nsGenerateAllGardensCheckboxes = function() {
  const allGardens = typeof AG === 'function' ? AG() : [...(window.GARDENS||[]), ...(window._GARDENS_EXTRA||[])];
  let h = '';
  const byCity = {};
  const seenIds = new Set();
  
  allGardens.forEach(g => {
    if(!g || !g.id || seenIds.has(g.id)) return;
    seenIds.add(g.id);
    const c = g.city || 'ללא עיר';
    if(!byCity[c]) byCity[c]=[];
    byCity[c].push(g);
  });
  
  const mainGid = parseInt(document.getElementById('ns-g')?.value) || 0;
  
  Object.keys(byCity).sort().forEach(c => {
    byCity[c].sort((a,b)=>(a.name||'').localeCompare(b.name||'','he'));
    h += `<div style="font-weight:bold; font-size:0.75rem; background:#e0e0e0; padding:4px; margin-top:2px; color:#333; position:sticky; top:32px">${c}</div>`;
    byCity[c].forEach(g => {
      const isMain = mainGid === parseInt(g.id);
      h += `
        <label style="display:flex; align-items:center; padding:4px 6px; font-size:0.75rem; cursor:${isMain?'not-allowed':'pointer'}; gap:6px; border-bottom:1px solid #f0f0f0; background:${isMain?'#f9f9f9':'#fff'}">
          <input type="checkbox" value="${g.id}" class="ns-add-custom-cb" style="cursor:${isMain?'not-allowed':'pointer'}; width:16px; height:16px" ${isMain ? 'disabled' : ''}>
          <span style="${isMain?'color:#999':''}">${g.name}</span>
        </label>
      `;
    });
  });
  return h;
};

window.nsAddCustomGardens = function() {
  const cbs = document.querySelectorAll('.ns-add-custom-cb:checked:not(:disabled)');
  if(!cbs.length) return window.spAlert('לא נבחרו גנים להוספה. אנא סמן גנים ברשימה ואז לחץ הוסף.');
  const mainGid = parseInt(document.getElementById('ns-g').value);
  if(!window.nsCustomPartners) window.nsCustomPartners = new Set();
  
  cbs.forEach(cb => {
    const newGid = Number(cb.value);
    if(newGid !== mainGid) window.nsCustomPartners.add(newGid);
    cb.checked = false; 
  });
  
  const wrap = document.getElementById('ns-custom-cb-wrap');
  if(wrap) wrap.style.display='none';
  window.renderPartnerTable();
};

// Initial render once module loads
setTimeout(() => {
  if(document.getElementById('nsm')) {
    // Other event listeners if needed
  }
}, 500);

window.nsLoadGrpPreset = function() {
  const val = document.getElementById('ns-grp-preset').value;
  const primaryWrap = document.getElementById('ns-primary-g-wrap');
  const cityWrap = document.getElementById('ns-city-wrap');

  if (val) {
    if (primaryWrap) primaryWrap.style.display = 'none';
    if (cityWrap) cityWrap.style.display = 'none';
  } else {
    if (primaryWrap) primaryWrap.style.display = 'grid';
    if (cityWrap) cityWrap.style.display = 'block';
    window.nsCustomPartners = new Set();
    window.nsCheckPair(document.getElementById('ns-g').value);
    return;
  }
  
  const parts = val.split('_');
  let gardenIds = [];
  const d = document.getElementById('ns-date')?.value || window.d2s(new Date());
  
  if (parts[0] === 'pair') {
     const idx = parseInt(parts[1]);
     const ps = typeof window.getPairs === 'function' ? window.getPairs(d, d) : (window.pairs || []);
     const p = ps[idx];
     if (p) gardenIds = p.ids.map(Number);
  } else if (parts[0] === 'cl') {
     const clId = parts.slice(1).join('_');
     const cls = typeof window.getClusters === 'function' ? window.getClusters(d, d) : [];
     const cl = cls.find(c => c.id === clId);
     if (cl) gardenIds = cl.gardenIds.map(Number);
  }
  
  if (gardenIds.length > 0) {
     const mainGid = gardenIds[0];
     const g = window.G(mainGid);
     if (g) {
       document.getElementById('ns-city').value = g.city;
       window.nsRefG();
       setTimeout(() => {
         document.getElementById('ns-g').value = mainGid;
         window.nsCustomPartners = new Set(gardenIds);
         window.nsCheckPair(mainGid);
       }, 50);
     }
  }
};

window.nsUpdateGrpPreset = function(d) {
  const grpSel = document.getElementById('ns-grp-preset');
  if (!grpSel) return;
  const currentVal = grpSel.value;
  grpSel.innerHTML = '<option value="">בחר קבוצה (אשכול או זוג)</option>';
  
  // Add clusters (valid for this date)
  const cls = typeof window.getClusters === 'function' ? window.getClusters(d, d) : [];
  if (cls.length > 0) {
    const gOpt = document.createElement('optgroup');
    gOpt.label = 'אשכולות';
    cls.forEach(c => gOpt.innerHTML += `<option value="cl_${c.id}">${c.name}</option>`);
    grpSel.appendChild(gOpt);
  }
  
  // Add pairs
  const ps = typeof window.getPairs === 'function' ? window.getPairs(d, d) : (window.pairs || []);
  if (ps.length > 0) {
    const gOpt = document.createElement('optgroup');
    gOpt.label = 'זוגות גנים';
    ps.forEach((p, idx) => gOpt.innerHTML += `<option value="pair_${idx}">${p.name || 'זוג '+(idx+1)}</option>`);
    grpSel.appendChild(gOpt);
  }
  
  // Restore value if it still exists
  if (currentVal && Array.from(grpSel.options).some(o => o.value === currentVal)) {
    grpSel.value = currentVal;
  }
};

function nsShowFreeDays(gid){
  window.showFreeDaysForMakeup('ns-free-wrap', gid, (ds) => {
    const dateInp = document.getElementById('ns-date');
    if(dateInp){
      dateInp.value=ds;
      nsDateChg();
    }
  });
}

function nsDateChg(){
  const gid=parseInt(document.getElementById('ns-g').value);
  const date=document.getElementById('ns-date').value;
  
  if (date) window.nsUpdateGrpPreset(date);

  // Re-render partner table to show their status on the new date
  renderPartnerTable();
  
  if(_nsmTab === 'makeup') {
    window.updateMakeupPartnersTable('ns-mu-partners-wrap', gid, date);
  }

  const hintEl=document.getElementById('ns-partner-time-hint');
  if(!hintEl) return;
  if(!gid||!date){ hintEl.style.display='none'; return; }
  
  const pair=gardenPair(gid);
  if(!pair){ hintEl.style.display='none'; return; }
  
  const pId=pair.ids.find(id=>Number(id)!==Number(gid));
  if(!pId){ hintEl.style.display='none'; return; }
  
  const partnerG=window.G(pId);
  const partnerEv=window.SCH.find(x=>Number(x.g)===Number(pId) && x.d===date && x.st!=='can');
  
  if(partnerEv && partnerEv.t){
    const pTime = window.fT ? window.fT(partnerEv.t) : partnerEv.t;
    const myTime = document.getElementById('ns-time').value;
    const isSameTime = myTime && (window.fT ? window.fT(myTime) : myTime) === pTime;
    
    hintEl.className = isSameTime ? 'info-notice error' : 'info-notice';
    hintEl.style.display = 'flex';
    hintEl.style.background = isSameTime ? '#fff5f5' : '#e3f2fd';
    hintEl.style.borderColor = isSameTime ? '#feb2b2' : '#bbdefb';

    hintEl.innerHTML = `<span class="icon">${isSameTime?'⚠️':'ℹ️'}</span><div><b>שיבוץ קיים:</b> ל-<b>${partnerG.name}</b> כבר יש פעילות בשעה <b>${pTime}</b>.${!isSameTime ? ' (ניתן לשבץ בשעה שונה)' : ''}</div>`;
  } else {
    hintEl.style.display = 'none';
  }
}

function nsSupChg(){
  const sup=document.getElementById('ns-sup')?.value || '';
  const actSel=document.getElementById('ns-act-type');
  const actNew=document.getElementById('ns-act-type-new');
  if(actNew){actNew.style.display='none';actNew.value='';}
  if(!sup){
    if(actSel) actSel.innerHTML='<option value="">בחר סוג פעילות...</option>';
    const phEl=document.getElementById('ns-ph');
    if(phEl) phEl.value='';
    return;
  }
  const base=window.supBase(sup);
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
  const grpWrap = document.getElementById('ns-grp-wrap');
  if(grpWrap) grpWrap.style.display='block';
  if(!actSel) return;
  const acts=window.getSupActs(sup);
  actSel.innerHTML='<option value="">בחר סוג פעילות...</option>'+
    acts.map(a=>`<option value="${a}">${a}</option>`).join('')+
    '<option value="__new__">➕ הוסף פעילות חדשה...</option>';
}
function nsActTypeChg(){
  const v=document.getElementById('ns-act-type').value;
  const newInp=document.getElementById('ns-act-type-new');
  if(newInp) newInp.style.display=v==='__new__'?'inline-block':'none';
}
async function saveNewSched(closeModal = true){
  const gid=parseInt(document.getElementById('ns-g').value)||null;
  const synPrefix = (_nsmTab === 'makeup') ? 'ns-mu' : 'ns';
  const synergyPartners = typeof window.getSynergyData === 'function' ? window.getSynergyData(synPrefix) : [];
  const date=document.getElementById('ns-date').value;
  const time=document.getElementById('ns-time').value;
  const sup=document.getElementById('ns-sup').value;
  if(date&&gid){
    const _g=G(gid);
    const _hol=getHolidayInfo(date,_g.city||null,gcls(_g)||null);
    if(_hol&&!_hol.canSched&&(_hol.type==='noact'||_hol.type==='vacation'||_hol.type==='camp')){
      if(!(await window.spConfirm('⚠️ יש '+_hol.emoji+' '+_hol.name+' ביום זה.\nבכל זאת לשבץ?'))) return;
    }
  }
  const ph=document.getElementById('ns-ph').value;
  const notes=document.getElementById('ns-notes').value;
  const grp = parseInt(document.getElementById('ns-grp')?.value) || 1;
  let actType = document.getElementById('ns-act-type')?.value;
  if(actType === '__new__') { actType = document.getElementById('ns-act-type-new')?.value.trim(); }
  const evTp = (document.getElementById('ns-ev-type') || {}).value || '';
  if(actType&&actType!=='__new__'){
    const baseSup = window.supBase ? window.supBase(sup) : sup;
    if(!window.supEx[baseSup]) window.supEx[baseSup]={};
    if(!Array.isArray(window.supEx[baseSup].acts)) window.supEx[baseSup].acts=window.getSupActs(baseSup);
    if(!window.supEx[baseSup].acts.includes(actType)) window.supEx[baseSup].acts.push(actType);
  }
  if(!gid||!date||!sup){window.spAlert('יש למלא: גן, תאריך, ספק');return;}
  const g=window.G(gid);
  if(window.gcls(g)==='גנים'&&time){
    const h=parseInt(time.split(':')[0]);
    const period=h<13?'morning':'afternoon';
    const conflict=window.SCH.find(s=>s.g===gid&&s.d===date&&!['can','nohap','post'].includes(s.st)&&!s._compByMakeup&&s.t&&(parseInt(s.t.split(':')[0])<13?'morning':'afternoon')===period&&s.id!==undefined);
    if(conflict){
      const msg = `⚠️ כבר קיימת פעילות ב${period==='morning'?'בוקר':'אחה"צ'}: ${conflict.a} ב-${window.fT(conflict.t)}.\nהאם תרצה בכל זאת להוסיף את השיבוץ הנוכחי?`;
      if(!(await window.spConfirm(msg))) return;
    }
  }
  const newId=Date.now();

  if(_nsmTab==='recur'){
    // Recurring schedule — generate all matching dates
    const recurFrom=document.getElementById('ns-recur-from').value;
    const recurTo=document.getElementById('ns-recur-to').value;
    const selDays=[...document.querySelectorAll('.ns-day-chk:checked')].map(c=>parseInt(c.value));
    const recurTime=time; // now using shared time field
    if(!recurFrom||!recurTo||!selDays.length){window.spAlert('שיבוץ קבוע: יש לבחור תאריך התחלה, סיום, וימים');return;}
    let count=0, cur=new Date(recurFrom.replace(/-/g,'/'));
    const endD=new Date(recurTo.replace(/-/g,'/'));
    const recurring_id=Date.now();
    while(cur<=endD&&count<365){
      if(selDays.includes(cur.getDay())){
        const ds=window.d2s(cur);
        const _hol2=window.getHolidayInfo(ds,window.G(gid).city||null,window.gcls(window.G(gid))||null);
        if(!_hol2||_hol2.type==='info'){
          const eid=recurring_id+count;
          const ev={id:eid,g:gid,d:ds,a:sup,act:actType,tp:evTp||'חוג',t:recurTime,p:ph,n:notes,st:'ok',cr:'',cn:'',nt:notes,pd:'',pt:'',grp,_recId:recurring_id + '_' + cur.getDay()};
          window.SCH.push(ev);
          synergyPartners.forEach((syn, idx) => {
            window.SCH.push({...ev,id:eid+(idx+1)*2000,g:syn.g,t:syn.t||recurTime});
          });
          count++;
        }
      }
      cur.setDate(cur.getDate()+1);
    }
    saveAndRefresh(closeModal ? 'nsm' : null);
    showToast(`✅ נוצרו ${count} פעילויות קבועות`);
    return;
  }

  const datesToSchedule = (window._nsSelectedDates && window._nsSelectedDates.length > 0) 
    ? window._nsSelectedDates 
    : [date];

  let totalScheduled = 0;
  
  for (const d of datesToSchedule) {
    const loopId = Date.now() + totalScheduled;
    
    if(_nsmTab==='makeup'){
      // Makeup schedule
      const makeupOrig=document.getElementById('ns-makeup-orig').value;
      const loopId = window.createMakeupActivity({
        g: gid,
        d: d,
        t: time,
        a: sup,
        act: actType,
        tp: evTp || 'חוג',
        origD: makeupOrig || '',
        origId: window._makeupOrigId || null,
        notes: notes,
        grp: grp
      });

      synergyPartners.forEach((syn, idx) => {
        const baseEv = window.SCH.find(x=>x.id===loopId);
        if(baseEv) window.SCH.push({...baseEv, id: loopId+(idx+1)*10, g: syn.g, t: syn.t||time});
      });
      totalScheduled++;
    } else {
      // One-time
      const newSched={id:loopId,g:gid,d:d,a:sup,act:actType,tp:evTp||'חוג',t:time,p:ph,n:notes,st:'ok',cr:'',cn:'',nt:notes,pd:'',pt:'',grp};
      window.SCH.push(newSched);
      synergyPartners.forEach((syn, idx) => {
        window.SCH.push({...newSched,id:loopId+(idx+1)*10,g:syn.g,t:syn.t||time,nt:notes});
      });
      totalScheduled++;
    }
  }

  const groupType = document.getElementById('ns-save-group-type')?.value;
  if(groupType && groupType !== 'none') {
    const mainGid = parseInt(document.getElementById('ns-g').value);
    const chks = document.querySelectorAll('.ns-syn-chk:checked');
    const gids = [mainGid];
    chks.forEach(c => gids.push(parseInt(c.value)));
    
    if (groupType.startsWith('pair') && gids.length !== 2) {
      window.spAlert('בחרת לשמור כזוג, אבל יש ' + gids.length + ' גנים מסומנים. הקבוצה לא נשמרה ביומן. (השיבוץ עצמו כן נשמר)');
    } else if (gids.length >= 2) {
      const isTemp = groupType.endsWith('temp');
      const isCluster = groupType.startsWith('cluster');
      const validDate = isTemp ? date : '';
      const customName = document.getElementById('ns-save-group-name')?.value.trim();
      const defaultName = isCluster ? 'אשכול' : 'זוג';
      const finalName = customName || (defaultName + (isTemp ? (' (' + window.fD(date) + ')') : ''));
      
      if (isCluster) {
        const id = 'cl_' + Date.now();
        window.clusters = window.clusters || {};
        window.clusters[id] = { id, name: finalName, desc: '', gardenIds: gids, validFrom: validDate, validTo: validDate };
      } else {
        const id = 'p_' + Date.now();
        window.pairs = window.pairs || [];
        window.pairs.push({ id, name: finalName, ids: gids, validFrom: validDate, validTo: validDate });
      }
    }
  }

  window._makeupOrigId = null; // Clear at the end
  window._nsSelectedDates = []; // Clear selection
  saveAndRefresh(closeModal ? 'nsm' : null);
  showToast(`✅ נשמרו ${totalScheduled} שיבוצים בהצלחה`);
}

function sSchedStChange(){
  const st = window.getEl('s-st')?.value;
  const from = window.getEl('s-from');
  const to = window.getEl('s-to');
  
  let fromVal = from?.value || '', toVal = to?.value || '';
  if(!st){
    if(!fromVal) fromVal = window.td();
    if(!toVal) toVal = window.td();
  } else {
    fromVal = ''; toVal = '';
  }

  // Sync back to both desktop/mobile
  ['desktop', 'mobile'].forEach(plat => {
    const f = document.getElementById('s-from-' + plat);
    const t = document.getElementById('s-to-' + plat);
    if(f) f.value = fromVal;
    if(t) t.value = toVal;
  });

  sPage=1; renderSched();
}
function sRefG(){
  const city = window.getEl('s-city')?.value || '';
  const cls = window.getEl('s-cls')?.value || '';
  const gs=window.gByCF(city,cls).sort((a,b)=>a.name.localeCompare(b.name,'he'));
  
  ['s-g1','s-g2','s-g3'].forEach((id,i)=>{
    ['desktop', 'mobile'].forEach(plat => {
      const sel = document.getElementById(id + '-' + plat);
      if(!sel) return;
      sel.innerHTML = i===0 ? '<option value="">כל הצהרונים</option>' : '<option value="">—</option>';
      gs.forEach(g => sel.innerHTML += `<option value="${g.id}">${city ? g.name : g.city + ' · ' + g.name}</option>`);
    });
  });
  sPage=1; renderSched();
}
function getFiltSched(){
  const city = window.getEl('s-city')?.value || '';
  const cls = window.getEl('s-cls')?.value || '';
  const g1 = parseInt(window.getEl('s-g1')?.value) || null;
  const g2 = parseInt(window.getEl('s-g2')?.value) || null;
  const g3 = parseInt(window.getEl('s-g3')?.value) || null;
  const sup = window.getEl('s-sup')?.value || '';
  const th = window.getEl('s-th')?.value || '';
  const tt = window.getEl('s-tt')?.value || '';
  const from = window.getEl('s-from')?.value || '';
  const to = window.getEl('s-to')?.value || '';
  const st = window.getEl('s-st')?.value || '';
  const type = window.getEl('s-type')?.value || '';
  const srch = (window.getEl('s-srch')?.value || '').toLowerCase();
  
  const gids=[g1,g2,g3].filter(Boolean).map(id=>Number(id));
  const isM = s => !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.nt)) || (s.n && /השלמה|הוקדם מ/i.test(s.n)));
  return (window.SCH || []).filter(s=>{
    const g=window.G(s.g);
    if(!g) return false;
    const gClass = window.gcls(g).trim().toLowerCase();
    const filterClass = (cls||'').trim().toLowerCase();
    
    if(type==='makeup' && !isM(s)) return false;
    if(type==='reg' && isM(s)) return false;
    if(city&&g.city!==city) return false;
    if(filterClass&&gClass!==filterClass) return false;
    if(gids.length&&!gids.includes(Number(s.g))) return false;
    if(sup&&window.supBase(s.a)!==sup&&s.a!==sup) return false;
    if(th&&s.t&&s.t<th) return false;
    if(tt&&s.t&&s.t>tt) return false;
    const isHandled = !!(s._compByMakeup && s._compByMakeup !== "false" && s._compByMakeup !== "");
    const isExc = (s.st === 'nohap' || s.st === 'post') && !isHandled;

    if(st==='todo'){
      if(isExc) return true;
      if (isM(s)) {
        if (s.st === 'done') return false; 
        if(from&&s.d<from) return false;
        if(to&&s.d>to) return false;
        return true;
      }
      return false;
    }

    if(from&&s.d<from) return false;
    if(to&&s.d>to) return false;

    if(!st) {
       if(s.st==='can' || isHandled) return false;
    } else {
       if(s.st!==st) return false;
       if((st === 'nohap' || st === 'post') && isHandled) return false;
       if(isHandled && !isM(s) && st==='done') return false; 
    }

    if(srch&&![(g && g.name||''),(g && g.city||''),(s.a||''),(s.nt||'')].some(x=>x.toLowerCase().includes(srch))) return false;
    return true;
  }).sort((a,b)=> {
    const dComp = b.d.localeCompare(a.d);
    if(dComp !== 0) return dComp;

    const gA = window.G(a.g), gB = window.G(b.g);
    const cComp = (gA.city||'').localeCompare(gB.city||'', 'he');
    if(cComp !== 0) return cComp;

    const pA=window.gardenPair(a.g), pB=window.gardenPair(b.g);
    const nA = pA ? pA.name : (gA.name||'');
    const nB = pB ? pB.name : (gB.name||'');
    const nComp = nA.localeCompare(nB, 'he');
    if(nComp !== 0) return nComp;

    return (a.t || '99:99').localeCompare(b.t || '99:99');
  });
}

function setSchedView(v){
  const sf = window.getEl('s-from');
  const st2 = window.getEl('s-to');
  if(!sf||!st2) return;
  const base = sf.value || window.td();
  const d = window.s2d(base);
  
  let fromVal = '', toVal = '';
  if(v==='day'){
    fromVal = window.td(); toVal = window.td();
  } else if(v==='week'){
    const days = window.getNextWorkDays(d, 5);
    fromVal = window.d2s(days[0]); toVal = window.d2s(days[4]);
  } else if(v==='month'){
    const y=d.getFullYear(), m=d.getMonth();
    fromVal = window.d2s(new Date(y,m,1)); toVal = window.d2s(new Date(y,m+1,0));
  }
  
  ['desktop', 'mobile'].forEach(plat => {
    const f = document.getElementById('s-from-' + plat);
    const t = document.getElementById('s-to-' + plat);
    if(f) f.value = fromVal;
    if(t) t.value = toVal;
  });

  document.querySelectorAll('[id^="svb-"]').forEach(btn => {
    const btnV = btn.id.replace('svb-', '').replace('-desktop', '').replace('-mobile', '');
    if (['day', 'week', 'month'].includes(btnV)) {
      btn.classList.toggle('active', btnV === v);
    }
  });
  sPage=1; renderSched();
}

function navSched(dir){
  const sf = window.getEl('s-from');
  const st2 = window.getEl('s-to');
  if(!sf||!st2) return;
  const from = sf.value || window.td(), to = st2.value || window.td();
  const d1 = window.s2d(from), d2 = window.s2d(to);
  const span = Math.max(0, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
  let jump = span + 1;
  if(span >= 4 && span <= 6) jump = 1;

  const nd1 = window.addD(d1, dir * jump);
  const nd2 = window.addD(nd1, span);
  
  const fromVal = window.d2s(nd1), toVal = window.d2s(nd2);
  ['desktop', 'mobile'].forEach(plat => {
    const f = document.getElementById('s-from-' + plat);
    const t = document.getElementById('s-to-' + plat);
    if(f) f.value = fromVal;
    if(t) t.value = toVal;
  });

  sPage=1; renderSched();
}
function navSchedToday(){
  const t = window.td();
  ['desktop', 'mobile'].forEach(plat => {
    const f = document.getElementById('s-from-' + plat);
    const to = document.getElementById('s-to-' + plat);
    if(f) f.value = t;
    if(to) to.value = t;
  });
  sPage=1; renderSched();
}
function renderSched(){
  const all=getFiltSched();
  const todayDate = window.getEl('s-from')?.value || window.getEl('s-to')?.value;
  const pages=Math.ceil(all.length/PG);
  if(sPage>pages&&pages>0) sPage=1;
  const data=all.slice((sPage-1)*PG,sPage*PG);
  (document.getElementById('s-info')||{}).textContent =`מציג ${data.length} מתוך ${all.length.toLocaleString()} פעילויות`;
  const byDate={};
  data.forEach(s=>{
    const dk=s._isPostponed?s.pd:s.d;
    if(!byDate[dk]) byDate[dk]={};
    const g=window.G(s.g);
    const c=g.city||'אחר';
    const cl=window.gcls(g);
    if(!byDate[dk][c]) byDate[dk][c]={gan:[],sch:[]};
    if(cl==='ביה"ס') byDate[dk][c].sch.push({...s,gd:g});
    else byDate[dk][c].gan.push({...s,gd:g});
  });

  let h='';
  Object.keys(byDate).sort((a,b)=>b.localeCompare(a)).forEach(dateKey=>{
    h+=`<div style="font-weight:800;color:#1a237e;font-size:.83rem;padding:6px 10px;background:#e8eaf6;border-radius:6px;margin-bottom:6px;margin-top:10px">
      📅 ${window.fD(dateKey)} יום ${window.dayN(dateKey)}
    </div>`;
    Object.keys(byDate[dateKey]).sort().forEach(city=>{
      const cityData=byDate[dateKey][city];
      h+=`<details class="city-accordion">
        <summary>
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <span style="font-weight:800; color:#2d3748;">🏙️ ${city}</span>
            <span style="font-size:0.8rem; color:#718096;">לחץ לפירוט</span>
          </div>
        </summary>
        <div class="city-accordion-content">`;
      [{arr:cityData.gan,lbl:'🏫 צהרונים',cls:'gan'},{arr:cityData.sch,lbl:'🏛️ בתי ספר',cls:'sch'}].forEach(sec=>{
        if(!sec.arr.length) return;
        h+=`<div class="dsh ${sec.cls}" style="font-size:.7rem;margin-bottom:8px;font-weight:800;color:#546e7a;border-bottom:2px solid #e2e8f0;padding-bottom:4px">${sec.lbl}</div>`;
        
        // Group by pair for consistency
        const pairsMap={};
        const soloList=[];
        sec.arr.forEach(s=>{
          const pair=window.gardenPair(s.g);
          if(pair){
            if(!pairsMap[pair.id]) pairsMap[pair.id]={pair,evs:[]};
            pairsMap[pair.id].evs.push(s);
          } else {
            soloList.push(s);
          }
        });

        // Render Pairs using central UI function
        Object.values(pairsMap).sort((a,b)=>a.pair.name.localeCompare(b.pair.name,'he')).forEach(({pair,evs})=>{
          const clr=window.CITY_COLORS ? window.CITY_COLORS(city) : {solid:'#1a237e', light:'#f8fafc', border:'#e2e8f0'};
          h+=window.ui.renderStandardPairCard(pair, evs, {
            ds: evs[0].d,
            clr: clr,
            context: 'sched'
          });
        });

        // Render Solo Gardens using central UI function
        if(soloList.length){
          soloList.sort((a,b)=>a.gd.name.localeCompare(b.gd.name,'he')).forEach(s=>{
            h+=window.ui.renderStandardPairCard({id:'solo_'+s.id, name:s.gd.name, ids:[s.g]}, [s], {
              ds: s.d,
              clr: window.CITY_COLORS ? window.CITY_COLORS(city) : {solid:'#1a237e', light:'#f8fafc', border:'#e2e8f0'},
              context: 'sched',
              isSolo: true
            });
          });
        }
      });
      h+='</div></details>';
    });
  });

  if (h) {
    const btns = `<div style="display:flex; gap:10px; margin-bottom:10px;">
      <button onclick="document.querySelectorAll('#s-body .city-accordion').forEach(el=>el.setAttribute('open',''))" style="flex:1; padding:8px; border-radius:6px; border:none; background:#1a237e; color:white; font-weight:bold; cursor:pointer;">פרוס הכל 🔽</button>
      <button onclick="document.querySelectorAll('#s-body .city-accordion').forEach(el=>el.removeAttribute('open'))" style="flex:1; padding:8px; border-radius:6px; border:1px solid #1a237e; background:white; color:#1a237e; font-weight:bold; cursor:pointer;">כווץ הכל 🔼</button>
    </div>`;
    h = btns + h;
  }

  if(!h) h='<p style="color:#999;text-align:center;padding:20px">אין פעילויות</p>';
  document.getElementById('s-body').innerHTML=h;
  setTimeout(window._fitScrollAreas,50);
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
function searchAct(){
  sPage=1;
  renderSched();
}
function clearSched(){
  ['s-city','s-cls','s-sup','s-th','s-tt','s-from','s-to','s-st','s-srch'].forEach(id => {
    const elD = document.getElementById(id + '-desktop');
    const elM = document.getElementById(id + '-mobile');
    if(elD) elD.value = '';
    if(elM) elM.value = '';
  });
  sRefG();
}

// Global Bridge
window.renderSched = renderSched;
window.setSchedView = setSchedView;
window.navSched = navSched;
window.navSchedToday = navSchedToday;
window.sSchedStChange = sSchedStChange;
window.sRefG = sRefG;
window.openNewSched = openNewSched;
window.searchAct = searchAct;
window.clearSched = clearSched;

// Initial render once module loads
setTimeout(() => {
  if (typeof renderSched === 'function') renderSched();
}, 150);

