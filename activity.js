window._dashTab = window._dashTab || 'g';
window.setDashTab = setDashTab;
window.renderDash = renderDash;

function setDashTab(t){
  window._dashTab = t;
  const gBtn = document.getElementById('dash-tab-g');
  const sBtn = document.getElementById('dash-tab-s');
  if(gBtn) gBtn.classList.toggle('active', t === 'g');
  if(sBtn) sBtn.classList.toggle('active', t === 's');
  renderDash();
  renderCanList();
}

const _dashListRow = (s) => {
  const g = window.G(s.g);
  if(!g) return '';
  const stc = s.st !== 'ok' ? 'st-' + s.st : '';
  const isM = !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה/i.test(s.nt)));
  const makeupBadge = isM ? `<span style="background:#fff3e0;color:#e65100;padding:2px 6px;border-radius:4px;font-size:0.65rem;font-weight:800;border:1px solid #ffe0b2;">↩️ השלמה</span>` : '';
  
  return `<div class="dash-row ${stc}" onclick="window.openSP('${s.id}')" style="display:flex; align-items:center; gap:15px; padding:10px 15px; border-bottom:1px solid #edf2f7; transition:all 0.2s;">
    <div style="flex:0 0 160px; font-weight:700; color:#2d3748; display:flex; align-items:center; gap:8px;">
      <span style="font-size:1.1rem">${window.gcls(g)==='ביה"ס'?'🏛️':'🏫'}</span>
      <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${g.name}</span>
    </div>
    <div style="flex:0 0 65px; text-align:center;">
      <span style="background:#4a5568; color:white; padding:3px 8px; border-radius:6px; font-weight:800; font-size:0.8rem;">${s.t ? window.fT(s.t) : '--:--'}</span>
    </div>
    <div style="flex:1; display:flex; align-items:center; gap:10px; min-width:0;">
      <div style="display:flex; flex-direction:column; min-width:0;">
        <span style="font-weight:700; color:#4a5568; font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.act || 'ללא פעילות'}</span>
        <span style="font-size:0.75rem; color:#a0aec0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">📍 ${g.city} ${g.st?` | ${g.st}`:''}</span>
        ${s.nt ? `<span style="font-size:0.75rem; color:#e53e3e; font-weight:700; background:#fff5f5; padding:2px 6px; border-radius:4px; margin-top:2px; display:inline-block;">📝 ${s.nt}</span>` : ''}
      </div>
      ${makeupBadge}
    </div>
    <div style="flex:0 0 100px; text-align:right;">
      <span style="font-weight:800; font-size:0.75rem; color:${s.st==='ok'?'#38a169':'#e53e3e'}; text-transform:uppercase;">${window.stLabel(s)}</span>
    </div>
    <div class="qacts" onclick="event.stopPropagation()" style="flex:0 0 130px; display:flex; justify-content:flex-end; gap:5px;">
      ${s.st==='done'?'':`<button title="בוצע" onclick="window.qSetSt('${s.id}','done')" style="background:#f0fff4; color:#38a169; border:1px solid #c6f6d5; padding:4px 8px; border-radius:6px; cursor:pointer;">✔️</button>`}
      ${s.st==='can'?'':`<button title="בטל" onclick="window.openCanQ('${s.id}')" style="background:#fff5f5; color:#e53e3e; border:1px solid #fed7d7; padding:4px 8px; border-radius:6px; cursor:pointer;">❌</button>`}
      ${s.st==='nohap'?'':`<button title="חוסר" onclick="window.qSetSt('${s.id}','nohap')" style="background:#fffaf0; color:#dd6b20; border:1px solid #fbd38d; padding:4px 8px; border-radius:6px; cursor:pointer;">⚠️</button>`}
    </div>
  </div>`;
};

function renderDash() {
  const list = document.getElementById('dash-body');
  if(!list) return;
  list.innerHTML = '';
  
  const dateEl = document.getElementById('dash-date');
  const cityEl = document.getElementById('dash-city');
  const supEl = document.getElementById('dash-sup');
  const stEl = document.getElementById('dash-st');
  if(!dateEl || !cityEl || !supEl || !stEl) return;

  const date = dateEl.value;
  const city = cityEl.value;
  const sup = supEl.value;
  const st = stEl.value;
  const tab = window._dashTab || 'g';
  const srch = (document.getElementById('dash-srch')||{value:''}).value.toLowerCase();

  console.log(`[Dash Debug] v96.9 Start. Tab:${tab}, St:${st}, Date:${date}, SCH:${window.SCH ? window.SCH.length : 'null'}`);

  const checkMatch = (s, tTab, tSt, tDate) => {
    const isHandled = !!(s._compByMakeup && s._compByMakeup !== "false");
    const isM = !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה/i.test(s.nt)));
    const g = window.G(s.g);
    if(!g) return false;
    const gClass = window.gcls ? window.gcls(g) : 'גנים';

    if (tTab === 'g' && gClass !== 'גנים') return false;
    if (tTab === 's' && gClass !== 'ביה"ס') return false;

    if (tDate && s.d !== tDate) return false;
    if (!tDate && s.d < window.td()) return false;

    if (tSt === 'todo') {
      if (s.st === 'can' || isHandled) return false;
      if (s.st === 'nohap' || isM) return true;
      return false;
    } else if (tSt === 'handled') {
      return (s.st === 'done' || isHandled);
    } else if (tSt) {
      if (s.st !== tSt) return false;
    }

    if (city && g.city !== city) return false;
    if (sup && window.supBase(s.a) !== sup) return false;
    if (srch && ![(g.name||''), (g.city||''), s.a, s.act].some(v=>(v||'').toLowerCase().includes(srch))) return false;

    return true;
  };

  const filtered = (window.SCH || []).filter(s => checkMatch(s, tab, st, date));
  
  // Group by City or Supplier
  const groups = {};
  filtered.forEach(s => {
    const g = window.G(s.g);
    const mainKey = (tab === 'g') ? (g.city || 'אחר') : (s.a || 'אחר');
    if(!groups[mainKey]) groups[mainKey] = [];
    groups[mainKey].push(s);
  });

  Object.keys(groups).sort().forEach(c => {
    const evs = groups[c];
    const accordion = document.createElement('details');
    accordion.className = 'city-accordion';
    const summary = document.createElement('summary');
    summary.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
      <span style="font-weight:800; color:#2d3748;">🏙️ ${c} (${evs.length})</span>
      <span style="font-size:0.8rem; color:#718096;">לחץ לפירוט</span>
    </div>`;
    accordion.appendChild(summary);

    const content = document.createElement('div');
    content.className = 'city-accordion-content';

    const rows = [];
    const seenPairs = new Set();
    const soloMap = new Map();

    evs.forEach(s => {
      const pair = window.gardenPair(s.g);
      if (pair) {
        if (!seenPairs.has(pair.id)) {
          const pairEvs = evs.filter(x => {
            const xPair = window.gardenPair(x.g);
            return xPair && xPair.id === pair.id && window.supBase(x.a) === window.supBase(s.a);
          });
          rows.push({type: 'pair', pair, evs: pairEvs});
          seenPairs.add(pair.id);
        }
      } else {
        const key = `${s.g}_${window.supBase(s.a)}`;
        if (!soloMap.has(key) || s.st === 'ok') soloMap.set(key, s);
      }
    });
    
    soloMap.forEach(ev => rows.push({type: 'solo', ev}));
    rows.sort((a, b) => {
      const tA = (a.type === 'pair' ? a.evs[0]?.t : a.ev?.t) || '99:99';
      const tB = (b.type === 'pair' ? b.evs[0]?.t : b.ev?.t) || '99:99';
      return tA.localeCompare(tB);
    });

    let h = '';
    rows.forEach(row => {
      const clr = window.CITY_COLORS ? window.CITY_COLORS(c) : {solid:'#ccc', light:'#eee', border:'#ddd'};
      if(row.type === 'pair') {
        const pairMap = new Map();
        row.evs.forEach(e => {
          if(!pairMap.has(e.g) || e.st === 'ok') pairMap.set(e.g, e);
        });
        row.pair.ids.forEach(gid => {
          if(!pairMap.has(gid)) {
            pairMap.set(gid, { id: 'dummy_'+gid, g: gid, st: 'unassigned', d: date, t: '', act: '' });
          }
        });
        const sorted = Array.from(pairMap.values()).sort((a,b)=>(a.t||'99:99').localeCompare(b.t||'99:99'));
        
        h+=`<div style="margin-bottom:4px;border:1px solid ${clr.border||clr.solid+'44'};border-radius:6px;overflow:hidden">
          <div style="background:${clr.solid}22;padding:2px 8px;font-size:.7rem;font-weight:700;color:${clr.solid};display:flex;align-items:center;justify-content:space-between">
            <span>🔗 ${row.pair.name}</span>
            <button onclick="event.stopPropagation();if(window._exportPairWA)window._exportPairWA(${JSON.stringify(row.pair.ids)})" style="background:${clr.solid};border:none;border-radius:4px;padding:1px 6px;cursor:pointer;font-size:.65rem;color:#fff">📋 הודעה</button>
          </div>`;
        sorted.forEach(s=>{ h+=window._listRow ? window._listRow(s,clr,date) : _dashListRow(s); });
        h+=`</div>`;
      } else {
        h += window._listRow ? window._listRow(row.ev, clr, date) : _dashListRow(row.ev);
      }
    });

    content.innerHTML = h;
    accordion.appendChild(content);
    list.appendChild(accordion);
  });
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
    h += `<tr onclick="window.openSP('${s.id}')" class="${window.stClass?window.stClass(s):''}" style="cursor:pointer"><td>${window.fD(s.d)}</td><td>${g.city||''}</td><td>${g.name||''}</td><td>${s.a||''}</td><td>${window.stLabel(s)}</td><td>${s.cr||''}${s.cn?' ('+s.cn+')':''}</td></tr>`;
  });
  return h + '</tbody></table></div>';
}



window.openSP = openSP;
function openSP(id){
  console.log('[openSP] Triggered for ID:', id);
  window.selEv = String(id);
  const s = window.SCH.find(x => String(x.id) === String(id));
  if(!s){
    console.error('[openSP] Activity not found in window.SCH for id:', id);
    // Still open panel with error message
    var spBody=document.getElementById('sp-body');
    if(spBody) spBody.innerHTML='<div style="color:#c62828;padding:20px">שגיאה: פעילות לא נמצאה (ID: '+id+')</div>';
    document.getElementById('sp').classList.add('open');
    if(document.getElementById('sp-backdrop')) document.getElementById('sp-backdrop').style.display='block';
    return;
  }
  try { // ← try-catch to prevent silent failures
  const g=window.G(s.g);
  const spPair=window.gardenPair(s.g);

  // Find partner garden activities for this specific date — match by date+supplier only (not time)
  let partnersHtml = '';
  const currentTimesSP = {};
  if (spPair) {
    const otherIds = spPair.ids.map(Number).filter(oid => oid !== Number(s.g));
    otherIds.forEach(oid => {
      const pg = window.G(oid);
      const pev = window.SCH.find(ps => 
        Number(ps.g)===oid && ps.d === s.d && 
        window.supBase(ps.a) === window.supBase(s.a) && ps.st !== 'can'
      );
      if(pev) currentTimesSP[oid] = window.fT(pev.t || s.t);
      partnersHtml += `<div style="font-size:.82rem;color:#5c6bc0;font-weight:700;margin-top:4px;display:flex;align-items:center;gap:6px">
        <span style="opacity:0.7">🔗</span> 
        <span>${pg.name}</span> 
        ${pev ? `<span style="font-weight:400;font-size:0.75rem;padding:1px 6px;border-radius:4px;background:#e8eaf6">${window.stLabel(pev)}</span>
        ${pev.t ? '<span style="font-size:.7rem;color:#78909c">⏰ '+window.fT(pev.t)+'</span>' : ''}` : '<span style="font-weight:400;font-size:0.75rem;padding:1px 6px;border-radius:4px;background:#ffebee;color:#c62828">לא משובץ</span>'}
      </div>`;
    });
  }

  // --- Activity type detection ---
  // Heuristic for recurrence: formal ID or appears at least twice in same day-of-week, time, and supplier
  const _dow = new Date(s.d).getDay();
  const isM = !!(s._isMakeup || s._makeupFrom || 
                (s.nt && /השלמה|makeup/i.test(s.nt)) || 
                (s.n && /השלמה|makeup/i.test(s.n)) || 
                (s.cn && /השלמה|makeup/i.test(s.cn)) ||
                (s.a && /השלמה|makeup/i.test(s.a)) ||
                (s.act && /השלמה|makeup/i.test(s.act)));
  const repeats = window.SCH.filter(x => x.g === s.g && new Date(x.d).getDay() === _dow && window.supBase(x.a) === window.supBase(s.a) && x.t === s.t && x.st !== 'can').length >= 2;
  const isRec = !isM && (!!s._recId || repeats);
  
  console.log(`[Recur Check] ID:${s.id} isM:${isM} isRec:${isRec} nt:${s.nt}`);
  const typeTag = isRec ? '<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:.68rem;font-weight:700;background:#e3f2fd;color:#1565c0">🔁 פעילות קבועה</span>'
    : isM ? '<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:.68rem;font-weight:700;background:#fff3e0;color:#e65100">↩️ השלמה</span>'
    : '<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:.68rem;font-weight:700;background:#eceff1;color:#546e7a">📌 חד-פעמי</span>';

  // --- STEP 1: Main Garden Details ---
  let h = `<div style="background:#fff;border-radius:12px;padding:15px;margin-bottom:12px;border:1.5px solid #e0e0e0;box-shadow:0 4px 6px rgba(0,0,0,0.02)">
    <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:.7rem;font-weight:900;color:#1a237e;text-transform:uppercase;background:#e8eaf6;padding:3px 8px;border-radius:4px">🏠 גן נוכחי</span>
        <label style="display:flex;align-items:center;gap:5px;cursor:pointer;background:#f3e5f5;padding:3px 8px;border-radius:4px;border:1px solid #ce93d8">
          <input type="checkbox" id="sp-is-rec-chk" ${isRec ? 'checked' : ''} onchange="window.toggleSpRecurBox(this.checked)" style="width:16px;height:16px;accent-color:#6a1b9a">
          <span style="font-size:0.7rem;font-weight:800;color:#6a1b9a">שיבוץ קבוע</span>
        </label>
      </div>
      <div style="text-align:left">
        <div style="font-size:.9rem;font-weight:800;color:#1a237e">${window.fD(s.d)}</div>
        <div style="font-size:.72rem;color:#7986cb;font-weight:700">יום ${window.dayN(s.d)}</div>
      </div>
    </div>
    
    <div style="margin-bottom:15px">
      <div style="font-size:1.25rem;font-weight:900;color:#1a237e;line-height:1.2">${g.name}</div>
      <div style="font-size:.85rem;color:#78909c;font-weight:600;margin-top:2px">📍 ${g.city}${g.st?' | '+g.st:''}</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;border-top:1px solid #f0f0f0;padding-top:12px;margin-bottom:5px">
      <div><span style="font-size:.7rem;color:#90a4ae;display:block;font-weight:700;text-transform:uppercase">📚 ספק</span><span style="font-weight:800;color:#1a237e;font-size:0.95rem">${window.supBase(s.a)}</span></div>
      <div><span style="font-size:.7rem;color:#90a4ae;display:block;font-weight:700;text-transform:uppercase">🎯 פעילות</span><span style="font-weight:800;color:#1565c0;font-size:0.95rem">${s.act||'—'}</span></div>
      <div><span style="font-size:.7rem;color:#90a4ae;display:block;font-weight:700;text-transform:uppercase">⏰ שעה</span><span style="font-weight:800;color:#1a237e;font-size:0.95rem">${s.t?window.fT(s.t):'—'}</span></div>
      <div><span style="font-size:.7rem;color:#90a4ae;display:block;font-weight:700;text-transform:uppercase">📌 סטטוס</span><span style="display:inline-block;margin-top:2px">${window.stLabel(s)}</span></div>
    </div>
    <div style="margin-top:10px">${typeTag}</div>
  </div>`;

  // --- STEP 2: Partner Garden Info (If exists) ---
  let partnerInfo = [];
  if (spPair) {
    const otherIds = spPair.ids.map(Number).filter(oid => oid !== Number(s.g));
    otherIds.forEach(oid => {
      const pg = window.G(oid);
      const pev = window.SCH.find(ps => Number(ps.g)===oid && ps.d === s.d && window.supBase(ps.a) === window.supBase(s.a) && ps.st !== 'can');
      partnerInfo.push({ pg, pev });
    });

    h += `<div style="background:#f5f7ff;border:1.5px solid #dbe3ff;border-radius:12px;padding:12px;margin-bottom:12px">
      <div style="font-size:.7rem;font-weight:900;color:#5c6bc0;text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:6px">
        <span>🔗 גן בן-זוג</span>
      </div>
      ${partnerInfo.map(pi => `
        <div style="display:flex;justify-content:space-between;align-items:center;background:#fff;padding:8px 10px;border-radius:8px;border:1px solid #dbe3ff">
          <div>
            <div style="font-size:.88rem;font-weight:800;color:#1a237e">${pi.pg.name}</div>
            <div style="font-size:.7rem;color:#7986cb">${pi.pg.city}</div>
          </div>
          <div style="text-align:left">
            ${pi.pev ? `
              <div style="margin-bottom:2px">${window.stLabel(pi.pev)}</div>
              ${pi.pev.t ? '<div style="font-size:.72rem;font-weight:700;color:#5c6bc0">⏰ '+window.fT(pi.pev.t)+'</div>' : ''}
            ` : '<div style="font-size:.75rem;color:#c62828;font-weight:700;background:#ffebee;padding:2px 6px;border-radius:4px">לא משובץ</div>'}
          </div>
        </div>
      `).join('')}
    </div>
  </div>`;
  }

  // --- STEP 3: Actions & Notes ---
  h += `<div style="margin-bottom:12px;background:#fff;border-radius:12px;padding:12px;border:1px solid #eee">
    <div style="font-size:.75rem;font-weight:700;color:#455a64;margin-bottom:8px">📝 הערות לפעילות</div>
    <div style="display:flex;gap:4px;margin-bottom:8px">
      <button class="btn bsm" id="sp-tab-nt" style="flex:1;background:#e8eaf6;color:#1a237e;border:1.5px solid #1a237e;font-weight:700" onclick="document.getElementById('sp-nt-wrap').style.display='block';document.getElementById('sp-n-wrap').style.display='none';this.style.background='#e8eaf6';document.getElementById('sp-tab-n').style.background='#fff';">הערה חד פעמית</button>
      <button class="btn bsm" id="sp-tab-n" style="flex:1;background:#fff;color:#1a237e;border:1.5px solid #1a237e;font-weight:700" onclick="document.getElementById('sp-nt-wrap').style.display='none';document.getElementById('sp-n-wrap').style.display='block';this.style.background='#e8eaf6';document.getElementById('sp-tab-nt').style.background='#fff';">הערה קבועה</button>
    </div>
    <div id="sp-nt-wrap">
      <textarea id="sp-nt" rows="2" style="width:100%;font-size:.85rem;border-radius:8px;border:1.5px solid #e0e0e0;padding:8px;resize:none;font-family:inherit" placeholder="הערה חד פעמית לפעילות זו (למשל: אי קיום, השלמות)...">${s.nt||''}</textarea>
    </div>
    <div id="sp-n-wrap" style="display:none">
      <textarea id="sp-n" rows="2" style="width:100%;font-size:.85rem;border-radius:8px;border:1.5px solid #e0e0e0;padding:8px;resize:none;font-family:inherit" placeholder="הערה קבועה לפעילות זו (מעודכן קדימה)...">${s.n||''}</textarea>
    </div>
    <button class="btn bp bsm" style="width:100%;padding:8px;font-weight:700;margin-top:8px" onclick="window.saveNt()">💾 שמור הערה</button>
  </div>`;

  h += `<div style="margin-bottom:12px;background:#fff;border-radius:12px;padding:15px;border:1.5px solid #eee">
      <label for="sp-sync-global" style="display:flex;align-items:center;gap:12px;margin-bottom:5px;cursor:pointer;background:#f5f7ff;padding:12px;border-radius:10px;border:1.5px solid #dbe3ff">
        <input type="checkbox" id="sp-sync-global" style="width:22px;height:22px;accent-color:#1a237e" checked>
        <div style="line-height:1.3">
          <div style="font-size:0.85rem;font-weight:900;color:#1a237e">🔗 סנכרון 'בוצע' / 'ביטול' / 'סיום טיפול'</div>
        </div>
      </label>
      <div class="info-notice" style="margin-top:0; border-top-left-radius:0; border-top-right-radius:0; border-top:none;">
        <span class="icon">ℹ️</span>
        <div>הפעולה שתבחר תתבצע גם עבור הגן השותף: <b>${window.G(spPair.ids.find(id=>Number(id)!==Number(s.g))).name}</b></div>
      </div>

    <div style="font-size:.8rem;font-weight:900;color:#1a237e;margin-bottom:12px;border-bottom:1px solid #f0f0f0;padding-bottom:8px">⚡ פעולות מהירות</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-bottom:8px">
      <button class="btn bg bsm" style="font-size:.72rem;padding:8px 2px;font-weight:800;border-radius:8px" onclick="window.setStatus('done')">✔️ בוצע</button>
      <button class="btn bsm" style="font-size:.72rem;padding:8px 2px;font-weight:800;border-radius:8px;background:#fff;color:#c62828;border:1px solid #ef9a9a" onclick="window.setStatus('nohap')">⚠️ לא התקיים</button>
      <button class="btn bsm" style="font-size:.72rem;padding:8px 2px;font-weight:800;border-radius:8px;background:#fff;color:#546e7a;border:1px solid #cfd8dc" onclick="window.setStatus('can')">❌ ביטול</button>
      <button class="btn borange bsm" style="font-size:.72rem;padding:8px 2px;font-weight:800;border-radius:8px" onclick="window.openPostpone('${s.id}')">⏩ דחייה</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">
      <button class="btn bp bsm" style="font-size:.72rem;padding:8px 2px;font-weight:800;border-radius:8px" onclick="window.openMakeupSched('${s.id}')">📅 השלמה</button>
      <button class="btn bsm" style="font-size:.72rem;padding:8px 2px;font-weight:800;border-radius:8px;background:#fff;color:#e65100;border:1px solid #ffcc80" onclick="window.markCompManual('${s.id}')">🗑️ סיום טיפול</button>
      <button class="btn bo bsm" style="font-size:.72rem;padding:8px 2px;font-weight:800;border-radius:8px" onclick="window.setStatus('ok')">🔄 שחזור</button>
    </div>
    
    <div id="sp-free-days-wrap" style="margin-top:15px;padding-top:15px;border-top:1px dashed #e0e0e0;display:none">
      <div style="font-size:.75rem;font-weight:900;color:#2e7d32;margin-bottom:8px">📅 ימים פנויים משותפים (לשני הגנים):</div>
      <div id="sp-free-days-list" style="display:flex;flex-wrap:wrap;gap:6px"></div>
    </div>
  </div>`;

  const isExc = (s.st === 'nohap' || s.st === 'post') && !s._compByMakeup;

  // --- STEP 4: Handling Dropdown (Exceptions / Makeups) — only for exceptions ---
  if (isExc || (isM && s.st !== 'done')) {
    h += `<div style="margin-top:10px;border:1.5px solid #ffe082;border-radius:10px;overflow:hidden">
      <div onclick="window.toggleSpAccordion('sp-acc-handling')" style="background:#fff8e1;padding:10px 15px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">
        <b style="font-size:0.85rem;color:#e65100">🛠️ טיפול בחריג</b>
        <span id="sp-acc-handling-arrow" style="font-size:0.7rem;transition:0.3s">▼</span>
      </div>
      <div id="sp-acc-handling" style="display:none;padding:12px;background:#fff;border-top:1px solid #ffe082">
        ${spPair ? `
          <label for="sp-sync-pair" style="display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;background:#fff8e1;padding:8px 12px;border-radius:6px;border:1px solid #ffe082">
            <input type="checkbox" id="sp-sync-pair" style="width:18px;height:18px;accent-color:#e65100" checked>
            <span style="font-size:0.82rem;font-weight:700;color:#bf360c">🔗 החל גם על בן-הזוג</span>
          </label>
        ` : ''}
        <div style="margin-bottom:12px">
          <label for="sp-handle-nt" style="font-size:0.75rem;color:#795548;display:block;margin-bottom:4px;font-weight:700">📝 הערת סיום טיפול:</label>
          <input type="text" id="sp-handle-nt" style="width:100%;padding:10px;border-radius:8px;border:1.5px solid #ffe082;font-size:0.85rem" placeholder="לדוגמה: בוצע ידנית ב-20/4..." value="${s.st==='post'?'נדחה':''}">
        </div>
        <button class="btn borange" style="width:100%;padding:12px;font-weight:900;font-size:0.95rem" onclick="window.markCompManual(${s.id})">🗑️ סיום טיפול והסרה מהלוח</button>
      </div>
    </div>`;
  }

  // --- STEP 5: Series Management (Always visible toggle) ---
  const isRecChecked = s._recId ? 'checked' : '';
  
  // Calculate default dates for school year (Sep 1 to Jun 30)
  const _dObj = s.d ? new Date(s.d) : new Date();
  const _sY = _dObj.getMonth() >= 7 ? _dObj.getFullYear() : _dObj.getFullYear() - 1;
  const defaultFrom = `${_sY}-09-01`;
  const defaultTo = `${_sY + 1}-06-30`;

  h += `<div style="margin-top:10px;border:1.5px solid #ce93d8;border-radius:10px;overflow:hidden">
    <div style="background:#f3e5f5;padding:10px 15px;display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="window.toggleSpAccordion('sp-acc-series')">
      <b style="font-size:0.85rem;color:#6a1b9a">🔄 הגדרות פעילות קבועה (סדרה)</b>
      <span id="sp-acc-series-arrow" style="font-size:0.7rem;transition:0.3s">▼</span>
    </div>
    <div id="sp-acc-series" style="display:none;padding:12px;background:#fff;border-top:1px solid #ce93d8">
      <div style="font-size:.8rem;font-weight:700;color:#1565c0;margin-bottom:8px">גן ראשי: ${g.name}</div>
      <div style="font-size:.72rem;color:#6a1b9a;margin-bottom:10px;background:#f9f9f9;padding:6px 10px;border-radius:6px">הגדרת טווח תאריכים וימים בשבוע. המערכת תשבץ פעילויות אלו באופן אוטומטי. ${s._recId ? 'שינוי כאן יחליף את הפעילויות העתידיות בסדרה זו.' : ''}</div>
      
      <div style="display:grid;gap:10px;background:#f9f9f9;padding:12px;border-radius:10px;border:1px solid #eee">
        <div class="fg"><label style="font-size:.75rem;font-weight:700">📅 טווח תאריכים</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <input type="date" id="rr-from" value="${defaultFrom}" style="width:100%;padding:6px;border-radius:6px;border:1px solid #ccc">
            <input type="date" id="rr-to" value="${defaultTo}" style="width:100%;padding:6px;border-radius:6px;border:1px solid #ccc">
          </div>
        </div>
        
        <div class="fg"><label style="font-size:.75rem;font-weight:700">🗓️ ימים בשבוע</label>
          <div style="display:flex;justify-content:space-between;background:#fff;padding:8px;border-radius:6px;border:1px solid #ccc">
            ${['א','ב','ג','ד','ה'].map((d,i)=>`
              <label style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer">
                <span style="font-size:.7rem;font-weight:700">${d}</span>
                <input type="checkbox" class="rr-day" value="${i}" ${new Date(s.d).getDay()===i?'checked':''} style="width:16px;height:16px;accent-color:#6a1b9a">
              </label>
            `).join('')}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="fg"><label style="font-size:.75rem;font-weight:700">📚 ספק</label>
            <select id="rr-sup" onchange="window.rrSupChg()" style="width:100%;padding:6px;border-radius:6px;border:1px solid #ccc">
              ${(window.getAllSup ? window.getAllSup().filter(s2=>window.isActSupplier(s2.name)) : []).map(s2=>`<option value="${s2.name}" ${s2.name===s.a?'selected':''}>${s2.name}</option>`).join('')}
            </select>
          </div>
          <div class="fg"><label style="font-size:.75rem;font-weight:700">🎯 פעילות</label>
            <select id="rr-act" style="width:100%;padding:6px;border-radius:6px;border:1px solid #ccc">
              <option value="">— ללא שינוי —</option>
              ${(window.getSupActs ? window.getSupActs(s.a) : []).map(a=>`<option value="${a}" ${a===s.act?'selected':''}>${a}</option>`).join('')}
            </select>
          </div>
        </div>
        
        <div class="fg"><label style="font-size:.75rem;font-weight:700">⏰ שעה (ראשי - ${g.name})</label>
          <input type="time" id="rr-time" value="${s.t||''}" style="width:100%;padding:6px;border-radius:6px;border:1px solid #ccc">
        </div>

        ${spPair ? `
          <div class="info-notice" style="margin-top:5px;margin-bottom:5px">
            <span class="icon">🔗</span>
            <div><b>גן בן-זוג:</b> שינוי זה יוחל גם על <b>${window.G(spPair.ids.find(id=>Number(id)!==Number(s.g))).name}</b> אם הסימון למטה מסומן.</div>
          </div>
          <div class="fg" style="margin-top:-5px">
            <label style="font-size:.75rem;font-weight:700">⏰ שעה בן-זוג (${window.G(spPair.ids.find(id=>Number(id)!==Number(s.g))).name})</label>
            <input type="time" id="rr-time-partner" value="${(partnerInfo.length > 0 && partnerInfo[0].pev) ? partnerInfo[0].pev.t : (s.t||'')}" style="width:100%;padding:6px;border-radius:6px;border:1px solid #ccc">
          </div>
          <label style="display:flex;align-items:center;gap:6px;margin-top:8px;cursor:pointer">
            <input type="checkbox" id="rr-sync" style="width:16px;height:16px;accent-color:#1a237e" checked>
            <span style="font-size:.8rem;font-weight:700;color:#1a237e">סנכרן עם גן בן-זוג באותם ימים ושעות</span>
          </label>
        ` : ''}

        <button class="btn bp" style="width:100%;padding:10px;font-weight:800;font-size:.9rem;margin-top:12px" onclick="window.saveReplaceRecur(${s.id})">💾 שמור שינויים והחל סדרה קבועה</button>
        ${s._recId ? `<button class="btn br" style="width:100%;padding:8px;font-weight:700;margin-top:6px;background:#fff;border:1px solid #ef9a9a;color:#c62828" onclick="window.deleteRecurSeries(${s.id})">🗑️ הסר פעילות קבועה מכאן והלאה</button>` : ''}
      </div>
    </div>
  </div>`;

  // --- STEP 6: Edit Accordion — one-time change of date/supplier/time ---
  const allSups = window.getAllSup ? window.getAllSup().filter(s2=>window.isActSupplier(s2.name)) : [];
  const initialActs = window.getSupActs ? window.getSupActs(s.a) : [];

  h += `<div style="margin-top:10px;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden">
    <div onclick="window.toggleSpAccordion('sp-acc-edit')" style="background:#f5f5f5;padding:10px 15px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">
      <b style="font-size:0.85rem;color:#455a64">✏️ עריכה ידנית (חד-פעמי)</b>
      <span id="sp-acc-edit-arrow" style="font-size:0.7rem;transition:0.3s">▼</span>
    </div>
    <div id="sp-acc-edit" style="display:none;padding:12px;background:#fff;border-top:1px solid #e0e0e0">
      <div style="font-size:.8rem;font-weight:700;color:#1565c0;margin-bottom:8px">גן ראשי: ${g.name}</div>
      <div style="font-size:.72rem;color:#78909c;margin-bottom:10px;background:#f9f9f9;padding:6px 10px;border-radius:6px">שינוי תאריך, ספק, פעילות או שעה <b>רק לפעילות זו</b> (לא משנה את הסדרה)</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div class="fg"><label for="sp-edit-date" style="font-size:.75rem;font-weight:700">תאריך</label><input type="date" id="sp-edit-date" value="${s.d}" style="width:100%;padding:8px;border-radius:6px;border:1px solid #ccc"></div>
        <div class="fg"><label for="sp-edit-sup" style="font-size:.75rem;font-weight:700">ספק</label>
          <select id="sp-edit-sup" onchange="window.spEditSupChg()" style="width:100%;padding:8px;border-radius:6px;border:1px solid #ccc">
            ${allSups.map(sup => `<option value="${sup.name}" ${sup.name===s.a ? 'selected':''}>${sup.name}</option>`).join('')}
          </select>
        </div>
        <div class="fg"><label for="sp-edit-act" style="font-size:.75rem;font-weight:700">פעילות</label>
          <select id="sp-edit-act" onchange="window.spEditActChg()" style="width:100%;padding:8px;border-radius:6px;border:1px solid #ccc">
            <option value="">— ללא שינוי —</option>
            ${initialActs.map(a => `<option value="${a}" ${a===s.act ? 'selected':''}>${a}</option>`).join('')}
            <option value="__new__">➕ פעילות חדשה...</option>
          </select>
        </div>
        <div class="fg" id="sp-edit-act-new-wrap" style="display:none"><label for="sp-edit-act-new" style="font-size:.75rem;font-weight:700">שם הפעילות החדשה</label><input type="text" id="sp-edit-act-new" style="width:100%;padding:8px;border-radius:6px;border:1px solid #ccc"></div>
        <div class="fg"><label for="sp-edit-time" style="font-size:.75rem;font-weight:700">שעה (${g.name})</label><input type="time" id="sp-edit-time" value="${s.t||''}" style="width:100%;padding:8px;border-radius:6px;border:1px solid #ccc"></div>
        ${spPair ? window.renderPartnerSynergy(s.g, 'sped', currentTimesSP) : ''}
        <button class="btn bg" style="width:100%;padding:10px;font-weight:800;margin-top:8px" onclick="window.spEditSave()">💾 שמור שינויים</button>
      </div>
    </div>
  </div>`;

  // --- STEP 7 removed per user request ---

  document.getElementById('sp-body').innerHTML=h;
  document.getElementById('sp').classList.add('open');
  if(document.getElementById('sp-backdrop')) document.getElementById('sp-backdrop').style.display='block';
  } catch(err) {
    console.error('[openSP] Error building panel:', err);
    var spBody=document.getElementById('sp-body');
    if(spBody) spBody.innerHTML='<div style="color:#c62828;padding:20px;font-size:.85rem"><b>שגיאה בפתיחת פרטי פעילות:</b><br><pre style="white-space:pre-wrap;margin-top:8px;background:#fff3f3;padding:10px;border-radius:6px;font-size:.75rem">'+err.message+'\n'+err.stack+'</pre></div>';
    document.getElementById('sp').classList.add('open');
    if(document.getElementById('sp-backdrop')) document.getElementById('sp-backdrop').style.display='block';
  }
}

function toggleSpAccordion(id){
  const el = document.getElementById(id);
  const arrow = document.getElementById(id + '-arrow');
  if(!el) return;
  const isOpening = el.style.display === 'none';
  
  // Optional: Close others
  document.querySelectorAll('[id^="sp-acc-"]').forEach(acc => {
    if(acc.id !== id) {
      acc.style.display = 'none';
      const otherArrow = document.getElementById(acc.id + '-arrow');
      if(otherArrow) otherArrow.style.transform = 'rotate(0deg)';
    }
  });

  el.style.display = isOpening ? 'block' : 'none';
  if(arrow) arrow.style.transform = isOpening ? 'rotate(180deg)' : 'rotate(0deg)';
}

function toggleSpRecurBox(isChecked) {
  const el = document.getElementById('sp-acc-series');
  const arrow = document.getElementById('sp-acc-series-arrow');
  if(isChecked) {
    // Open the accordion so they can define the series
    if(el) el.style.display = 'block';
    if(arrow) arrow.style.transform = 'rotate(180deg)';
  } else {
    // Unchecked -> ask if they want to delete series
    const s = window.SCH.find(x => x.id == window.selEv);
    if(s && s._recId) {
      if(confirm('האם תרצה להסיר את הפעילות הקבועה ולבטל את כל השיבוצים העתידיים בסדרה זו?')) {
        window.deleteRecurSeries(s.id);
      } else {
        document.getElementById('sp-is-rec-chk').checked = true; // revert
      }
    } else {
      if(el) el.style.display = 'none';
      if(arrow) arrow.style.transform = 'rotate(0deg)';
    }
  }
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

function deleteRecurSeries(id) {
  const s = window.SCH.find(x => x.id == id);
  if(!s || !s._recId) return alert('לא מזוהה סדרה');
  const affected=window.SCH.filter(x=>x._recId===s._recId&&x.d>=s.d&&x.g===s.g);
  if(!confirm(`האם למחוק ${affected.length} פעילויות קבועות מ-${window.fD(s.d)} ואילך?`)) return;
  affected.forEach(x=>{ const i=window.SCH.indexOf(x); if(i>=0) window.SCH.splice(i,1); });
  window.saveAndRefresh('sp');
}

function openReplaceRecur(id) {
  const s = window.SCH.find(x => x.id == id);
  if(!s || !s._recId) return alert('פעילות זו אינה חלק מפעילות קבועה');
  const g = window.G(s.g);
  const allSups = window.getAllSup().filter(s2 => window.isActSupplier(s2.name));
  const spPair = window.gardenPair(s.g);
  
  // Calculate default dates (from today/activity date till end of year)
  const defaultTo = '2026-08-31'; // Or calculate based on school year
  
  let h = `<div style="font-size:.85rem;font-weight:700;color:#1a237e;margin-bottom:12px">
    🔄 החלפת פעילות קבועה — גן ${g.name}
    <div style="font-size:.72rem;font-weight:400;color:#546e7a;margin-top:4px">שינוי זה יסיר את השיבוצים העתידיים הקיימים בפעילות זו וישבץ חדשים בטווח שתבחר.</div>
  </div>
  
  <div style="display:grid;gap:10px;background:#f9f9f9;padding:12px;border-radius:10px;border:1px solid #eee">
    <div class="fg"><label style="font-size:.75rem;font-weight:700">📅 טווח תאריכים</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <input type="date" id="rr-from" value="${s.d}" style="width:100%;padding:6px;border-radius:6px;border:1px solid #ccc">
        <input type="date" id="rr-to" value="${defaultTo}" style="width:100%;padding:6px;border-radius:6px;border:1px solid #ccc">
      </div>
    </div>
    
    <div class="fg"><label style="font-size:.75rem;font-weight:700">🗓️ ימים בשבוע</label>
      <div style="display:flex;justify-content:space-between;background:#fff;padding:8px;border-radius:6px;border:1px solid #ccc">
        ${['א','ב','ג','ד','ה'].map((d,i)=>`
          <label style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer">
            <span style="font-size:.7rem;font-weight:700">${d}</span>
            <input type="checkbox" class="rr-day" value="${i}" ${new Date(s.d).getDay()===i?'checked':''} style="width:16px;height:16px">
          </label>
        `).join('')}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="fg"><label style="font-size:.75rem;font-weight:700">📚 ספק</label>
        <select id="rr-sup" onchange="window.rrSupChg()" style="width:100%;padding:6px;border-radius:6px;border:1px solid #ccc">
          ${allSups.map(s2=>`<option value="${s2.name}" ${s2.name===s.a?'selected':''}>${s2.name}</option>`).join('')}
        </select>
      </div>
      <div class="fg"><label style="font-size:.75rem;font-weight:700">🎯 פעילות</label>
        <select id="rr-act" style="width:100%;padding:6px;border-radius:6px;border:1px solid #ccc">
          <option value="">— ללא שינוי —</option>
          ${window.getSupActs(s.a).map(a=>`<option value="${a}" ${a===s.act?'selected':''}>${a}</option>`).join('')}
        </select>
      </div>
    </div>
    
    <div class="fg"><label style="font-size:.75rem;font-weight:700">⏰ שעה (${g.name})</label>
      <input type="time" id="rr-time" value="${s.t||''}" style="width:100%;padding:6px;border-radius:6px;border:1px solid #ccc">
    </div>

    ${spPair ? `
      <div class="info-notice">
        <span class="icon">🔗</span>
        <div><b>גן בן-זוג:</b> שינוי זה יוחל גם על <b>${window.G(spPair.ids.find(id=>Number(id)!==Number(s.g))).name}</b> אם תיבת הסימון למטה מסומנת.</div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;background:#e8eaf6;padding:8px 10px;border-radius:8px;border:1px solid #c5cae9;cursor:pointer">
        <input type="checkbox" id="rr-sync-pair" checked style="width:18px;height:18px">
        <span style="font-size:.82rem;font-weight:700;color:#1a237e">🔗 החל גם על גן בן-הזוג</span>
      </label>
    ` : ''}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:15px">
    <button class="btn br" onclick="CM('rrm')">ביטול</button>
    <button class="btn bg" style="font-weight:900" onclick="window.saveReplaceRecur(${id})">✅ בצע החלפה</button>
  </div>`;
  
  document.getElementById('rrm-body').innerHTML = h;
  window.OM('rrm');
}

function rrSupChg() {
  const sup = document.getElementById('rr-sup').value;
  const actSel = document.getElementById('rr-act');
  if(!actSel) return;
  actSel.innerHTML = '<option value="">— ללא שינוי —</option>' +
    window.getSupActs(sup).map(a => `<option value="${a}">${a}</option>`).join('');
}

function saveReplaceRecur(id) {
  try {
    const s = window.SCH.find(x => x.id == id);
    if(!s) return;
    
    const from = document.getElementById('rr-from').value;
    const to = document.getElementById('rr-to').value;
    const days = [...document.querySelectorAll('.rr-day:checked')].map(c => parseInt(c.value));
    const sup = document.getElementById('rr-sup').value;
    const act = document.getElementById('rr-act').value;
    const time = document.getElementById('rr-time').value;
    const sync = document.getElementById('rr-sync') ? document.getElementById('rr-sync').checked : false;
    const partnerTime = document.getElementById('rr-time-partner') ? document.getElementById('rr-time-partner').value : time;

    if(!from || !to || !days.length || !sup) return alert('יש למלא את כל השדות ולבחור ימים');

    if(!confirm('⚠️ פעולה זו תמחוק את כל השיבוצים העתידיים של הסדרה הקיימת ותיצור חדשים.\nהאם אתה בטוח?')) return;

    // 1. Collect all series IDs to remove
    const seriesIdsToRemove = new Set([s._recId]);
    const partnerGids = [];
    if (sync) {
      const pair = window.gardenPair(s.g);
      if (pair) pair.ids.forEach(pid => partnerGids.push(Number(pid)));
    } else {
      partnerGids.push(Number(s.g));
    }

    // 2. Remove future occurrences from SCH
    window.SCH = window.SCH.filter(ev => {
      const isFuture = ev.d >= from;
      const isTargetGarden = partnerGids.includes(Number(ev.g));
      const isOldSeries = ev._recId && seriesIdsToRemove.has(ev._recId);
      // Extra safety: also match by supplier if _recId is missing but it's clearly part of the same thing
      const isOldMatch = isTargetGarden && window.supBase(ev.a) === window.supBase(s.a) && ev.d >= from && ev.st !== 'can';
      
      return !(isFuture && (isOldSeries || isOldMatch));
    });

    // 3. Generate new series
    const newRecId = Date.now();
    let count = 0;
    let cur = new Date(from.replace(/-/g, '/'));
    const endD = new Date(to.replace(/-/g, '/'));
    
    while(cur <= endD && count < 500) {
      if(days.includes(cur.getDay())) {
        const ds = window.d2s(cur);
        const hol = window.getHolidayInfo ? window.getHolidayInfo(ds, window.G(s.g).city) : null;
        if(!hol || hol.canSched || hol.type === 'info') {
          const eid = newRecId + count;
          // Add for primary garden
          window.SCH.push({
            id: eid, g: s.g, d: ds, a: sup, act: act, t: time, st: 'ok', 
            nt: s.nt||'', _recId: newRecId, grp: s.grp||1
          });
          // Add for partners if synced
          if (sync) {
            const pair = window.gardenPair(s.g);
            if (pair) {
              pair.ids.forEach((pid, idx) => {
                if (Number(pid) !== Number(s.g)) {
                  // Keep partner time if possible, otherwise use main time
                  window.SCH.push({
                    id: eid + (idx+1)*5000, g: pid, d: ds, a: sup, act: act, t: partnerTime, st: 'ok',
                    nt: s.nt||'', _recId: newRecId, grp: s.grp||1
                  });
                }
              });
            }
          }
          count++;
        }
      }
      cur.setDate(cur.getDate() + 1);
    }

    window.saveAndRefresh('rrm');
    window.showToast(`✅ הפעילות הקבועה הוחלפה בהצלחה. נוצרו ${count} שיבוצים חדשים.`);
  } catch(err) {
    console.error('[saveReplaceRecur]', err);
    alert('שגיאה בביצוע ההחלפה: ' + err.message);
  }
}

function spEditSave(){
  const s=window.SCH.find(x=>x.id==window.selEv); if(!s) return;
  const origDate = s.d;
  const origSup = s.a;
  
  const newDate=document.getElementById('sp-edit-date').value;
  const newSup=document.getElementById('sp-edit-sup').value;
  const actVal=document.getElementById('sp-edit-act').value;
  const newAct=actVal==='__new__' ? (document.getElementById('sp-edit-act-new')||{}).value||'' : actVal;
  const newTime=document.getElementById('sp-edit-time').value;
  
  if(newDate) s.d=newDate; if(newSup) s.a=newSup; if(newAct) s.act=newAct; if(newTime) s.t=newTime;
  
  const synergyPartners = typeof window.getSynergyData === 'function' ? window.getSynergyData('sped') : [];
  synergyPartners.forEach(syn => {
    const pEv = window.SCH.find(ps => ps.d === origDate && ps.g === syn.g && ps.st !== 'can' && window.supBase(ps.a) === window.supBase(origSup));
    if(pEv) {
      if(newDate) pEv.d=newDate; 
      if(newSup) pEv.a=newSup; 
      if(newAct) pEv.act=newAct; 
      if(syn.t || newTime) pEv.t=syn.t || newTime;
    }
  });

  window.saveAndRefresh('sp');
  window.showToast('✅ הפעילות עודכנה בהצלחה (כולל סינרגיה)');
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
  const s=window.SCH.find(x=>x.id==window.selEv); if(!s) return;
  s.st='can'; window.saveAndRefresh('sp');
}

function markNoHap(){
  const s=window.SCH.find(x=>x.id==window.selEv); if(!s) return;
  s.st='nohap'; window.saveAndRefresh('sp');
}

function setStatus(idOrSt, maybeSt){
  try {
  let id, st;
  if (maybeSt) { id = idOrSt; st = maybeSt; } 
  else { id = window.selEv; st = idOrSt; }
  const main=window.SCH.find(x=>x.id==id);
  if(!main) return;
  main.st=st;
  if(st==='ok') { main.cr=''; main.cn=''; }

  // Partner sync — check global checkbox
  const syncChk = document.getElementById('sp-sync-global');
  if(syncChk && syncChk.checked) {
    const pair = window.gardenPair(main.g);
    if(pair) {
      const otherIds = pair.ids.map(Number).filter(oid => oid !== Number(main.g));
      otherIds.forEach(oid => {
        const pev = window.SCH.find(ps =>
          Number(ps.g)===oid && ps.d === main.d &&
          window.supBase(ps.a) === window.supBase(main.a) && ps.st !== 'can'
        );
        if(pev) {
          pev.st = st;
          if(st==='ok') { pev.cr=''; pev.cn=''; }
        }
      });
    }
  }
  window.saveAndRefresh('sp');
  } catch(err) { console.error('[setStatus]', err); window.saveAndRefresh('sp'); }
}

function saveNt(){
  const s=window.SCH.find(x=>x.id==window.selEv); if(!s) return;
  const ntEl=document.getElementById('sp-nt');
  const nEl=document.getElementById('sp-n');
  if(ntEl) s.nt=ntEl.value;
  if(nEl) {
    s.n=nEl.value;
    if(s._recId) {
      window.SCH.forEach(x => {
        if(x._recId === s._recId && x.d >= s.d) {
          x.n = nEl.value;
        }
      });
    }
  }
  window.saveAndRefresh('sp');
}

function markCompManual(id){
  try {
  const s=window.SCH.find(x=>x.id==id); if(!s) return;
  const syncCheck = document.getElementById('sp-sync-global') || document.getElementById('sp-sync-pair');
  const handleNtEl = document.getElementById('sp-handle-nt');
  const doSync = syncCheck && syncCheck.checked;
  const handleNt = handleNtEl ? handleNtEl.value.trim() : '';
  const stamp = 'manual_' + Date.now();
  
  s._compByMakeup = stamp;
  if (handleNt) {
    const note = '✅ סיום טיפול: ' + handleNt;
    s.nt = s.nt ? s.nt + ' | ' + note : note;
  }

  if (doSync) {
    const pair = window.gardenPair(s.g);
    if (pair) {
      const otherIds = pair.ids.map(id=>Number(id)).filter(id=>id!==Number(s.g));
      otherIds.forEach(ogid => {
        const partnerEv = window.SCH.find(ps => 
          Number(ps.g)===ogid && ps.d === s.d && 
          window.supBase(ps.a) === window.supBase(s.a) && ps.st !== 'can'
        );
        if (partnerEv) {
          partnerEv._compByMakeup = stamp;
          if (handleNt) {
            const note = '✅ סיום טיפול: ' + handleNt;
            partnerEv.nt = partnerEv.nt ? partnerEv.nt + ' | ' + note : note;
          }
        }
      });
    }
  }

  window.saveAndRefresh('sp');
  } catch(err) { console.error('[markCompManual]', err); window.saveAndRefresh('sp'); }
}

function upd(id,fields){
  const i=window.SCH.findIndex(s=>s.id==id);
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
  const orig=window.SCH.find(s=>s.id==origId); if(!orig) return;
  window._makeupOrigId = origId;
  window.openNewSched(orig.g, {date:window.td(), tab:'makeup', makeupFrom:orig.d, time:orig.t});
}

function openPostpone(id){
  window.selEvPost=id;
  const s=window.SCH.find(x=>x.id==id); if(!s) return;
  const g=window.G(s.g);
  document.getElementById('post-ev-info').innerHTML=`<b>${g.name}</b> · ${g.city} · ${s.a}`;
  // Ensure the input has a label associated with it in index.html (verified later)
  document.getElementById('post-date').value='';
  document.getElementById('post-reason').value='';
  if(typeof window.setPostMode === 'function') window.setPostMode('move');
  
  // Set up Synergy UI
  const synWrap = document.getElementById('post-synergy-wrap');
  if(synWrap) {
    const pair = window.gardenPair(s.g);
    const currentTimes = {};
    if(pair) {
      pair.ids.forEach(pId => {
        if(pId === s.g) return;
        const pEv = window.SCH.find(ps => ps.d === s.d && ps.g === pId && ps.st!=='can' && window.supBase(ps.a)===window.supBase(s.a));
        if(pEv) currentTimes[pId] = window.fT(pEv.t||s.t);
      });
    }
    synWrap.innerHTML = window.renderPartnerSynergy(s.g, 'post', currentTimes);
  }
  
  document.getElementById('postm').classList.add('open');
}

function openCopy(id){
  window._copySrcId=id;
  const s=window.SCH.find(x=>x.id==id); if(!s) return;
  const g=window.G(s.g);
  document.getElementById('copy-ev-info').innerHTML=`<b>${g.name}</b> · ${g.city} · ${s.a}`;
  document.getElementById('copy-date').value='';
  document.getElementById('copy-time').value = window.fT(s.t) || '';
  
  // Set up Synergy UI
  const synWrap = document.getElementById('copy-synergy-wrap');
  if(synWrap) {
    const pair = window.gardenPair(s.g);
    const currentTimes = {};
    if(pair) {
      pair.ids.forEach(pId => {
        if(pId === s.g) return;
        const pEv = window.SCH.find(ps => ps.d === s.d && ps.g === pId && ps.st!=='can' && window.supBase(ps.a)===window.supBase(s.a));
        if(pEv) currentTimes[pId] = window.fT(pEv.t||s.t);
      });
    }
    synWrap.innerHTML = window.renderPartnerSynergy(s.g, 'copy', currentTimes);
  }
  
  document.getElementById('copym').style.display='flex';
}

function doPostpone(){
  const sid = window.selEvPost;
  const s = window.SCH.find(x => x.id == sid);
  if(!s) return;
  const newDate = document.getElementById('post-date').value;
  const newSup = document.getElementById('post-sup') ? document.getElementById('post-sup').value : '';
  const newAct = document.getElementById('post-act') ? document.getElementById('post-act').value : '';
  const reason = document.getElementById('post-reason') ? document.getElementById('post-reason').value : '';
  
  if (window._postMode === 'defer') {
    if(!reason.trim()) { alert('יש להזין סיבה לדחייה'); return; }
    s.st = 'post';
    s.pd = ''; // No target date
    s.cn = s.cn ? s.cn + ` (דחייה: ${reason})` : `(דחייה: ${reason})`;
    
    // Process Synergy Partners for defer
    const synergyPartners = typeof window.getSynergyData === 'function' ? window.getSynergyData('post') : [];
    for(let syn of synergyPartners) {
      const pEv = window.SCH.find(ps => ps.d === s.d && ps.g === syn.g && ps.st !== 'can' && window.supBase(ps.a) === window.supBase(s.a));
      if(pEv) {
        pEv.st = 'post';
        pEv.pd = '';
        pEv.cn = pEv.cn ? pEv.cn + ` (דחייה: ${reason})` : `(דחייה: ${reason})`;
      }
    }
    
    window.saveAndRefresh();
    document.getElementById('postm').classList.remove('open');
    showToast('הפעילות נדחתה');
    return;
  }
  
  if(!newDate) { alert('יש לבחור תאריך'); return; }
  
  const synergyPartners = typeof window.getSynergyData === 'function' ? window.getSynergyData('post') : [];
  const toProcess = [];
  
  // Conflict Alert Phase
  for(let syn of synergyPartners) {
    const pEv = window.SCH.find(ps => ps.d === s.d && ps.g === syn.g && ps.st !== 'can' && window.supBase(ps.a) === window.supBase(s.a));
    if(!pEv) {
      const gObj = window.G(syn.g);
      const msg = `⚠️ לצהרון ${gObj ? gObj.name : 'השותף'} לא נמצאה פעילות מקורית של ${s.a} בתאריך ${window.fD(s.d)}.\nהאם תרצה בכל זאת ליצור לו פעילות חדשה בתאריך החדש (${window.fD(newDate)})?`;
      if(!confirm(msg)) continue;
    }
    toProcess.push({ syn, pEv });
  }

  // Primary
  const newId1 = Date.now();
  s.st = 'post';
  s.pd = newDate;
  s.pt = window.fT(s.t);
  s.cn += reason ? ` (דחייה: ${reason})` : '';
  s._compByMakeup = newId1; // Mark original as handled

  const newEv1 = {...s, id:newId1, d:newDate, t:s.t, a:newSup||s.a, act:newAct||s.act, st:'ok', pd:'', pt:'', _postFrom: s.d};
  if(reason) newEv1.n = s.n ? s.n + ' | נדחה: ' + reason : 'נדחה: ' + reason;
  window.SCH.push(newEv1);
  
  // Synergy Execution
  toProcess.forEach((conf, idx) => {
    const newSynId = Date.now() + idx + 1;
    if(conf.pEv) {
      conf.pEv.st = 'post';
      conf.pEv.pd = newDate;
      conf.pEv.pt = conf.syn.t || conf.pEv.t;
      if(reason) conf.pEv.cn += ` (דחייה: ${reason})`;
      conf.pEv._compByMakeup = newSynId;
    }
    const ptEv = conf.pEv || {...s, g: conf.syn.g};
    const newPtEv = {...ptEv, id:newSynId, d:newDate, t:conf.syn.t || ptEv.t, a:newSup||s.a, act:newAct||s.act, st:'ok', pd:'', pt:'', _postFrom: s.d};
    if(!conf.pEv && reason) newPtEv.n = ptEv.n ? ptEv.n + ' | נוצר מדחייה: ' + reason : 'נוצר מדחייה: ' + reason;
    else if(reason) newPtEv.n = ptEv.n ? ptEv.n + ' | נדחה: ' + reason : 'נדחה: ' + reason;
    window.SCH.push(newPtEv);
  });
  
  window.saveAndRefresh('postm');
  window.showToast('✅ פעילות נדחתה (כולל סינרגיה)');
}

function doCopy(){
  const sid = window._copySrcId;
  const s = window.SCH.find(x => x.id == sid);
  if(!s) return;
  const newDate = document.getElementById('copy-date').value;
  const primaryTime = document.getElementById('copy-time').value;
  if(!newDate) { alert('יש לבחור תאריך יעד'); return; }
  
  // Primary
  const newEv1 = {...s, id:Date.now(), d:newDate, t:primaryTime || s.t, st:'ok', pd:'', pt:'', cr:'', cn:''};
  window.SCH.push(newEv1);
  
  // Synergy
  const synergyPartners = typeof window.getSynergyData === 'function' ? window.getSynergyData('copy') : [];
  synergyPartners.forEach((syn, idx) => {
    const newPtEv = {...s, id:Date.now() + idx + 1, g:syn.g, d:newDate, t:syn.t || primaryTime || s.t, st:'ok', pd:'', pt:'', cr:'', cn:''};
    window.SCH.push(newPtEv);
  });
  
  window.saveAndRefresh('copym');
  window.showToast('✅ פעילות שוכפלה (כולל סינרגיה)');
}

function openSupExport(supName){
  const date=document.getElementById('dash-date').value||window.td();
  const evs=window.SCH.filter(s=>s.a===supName&&s.d===date&&s.st!=='can');
  if(!evs.length){alert('אין פעילויות לייצוא');return;}
  const rows=evs.map(s=>({ 'עיר':window.G(s.g).city, 'גן':window.G(s.g).name, 'ספק':s.a, 'פעילות':s.act||'', 'שעה':s.t }));
  window.exportToExcel(rows, `export_${supName}`);
}

// --- SYNERGY UI HELPER ---
function renderPartnerSynergy(gid, prefix, currentTimes = {}) {
  const pair = window.gardenPair(gid);
  if (!pair) return '';
  const partners = pair.ids.filter(id => Number(id) !== Number(gid));
  if (!partners.length) return '';
  
  let html = `<div style="background:#f0f4f8;border:1px solid #d1d9e6;border-radius:7px;padding:9px;margin-bottom:10px">`;
  html += `<div style="font-size:.78rem;font-weight:700;color:#1a237e;margin-bottom:6px">📌 סינרגיה: גנים מקושרים</div>`;
  html += `<div class="info-notice" style="margin-bottom:8px; padding:8px 12px; font-size:0.75rem;">
    <span class="icon">🔗</span>
    <div>הפעולה תתבצע גם עבור הגנים המסומנים מטה:</div>
  </div>`;
  html += `<div style="display:flex;flex-direction:column;gap:8px">`;
  
  partners.forEach(pId => {
    const pG = window.G(pId);
    if (!pG) return;
    const timeVal = currentTimes[pId] || '';
    html += `
      <div style="display:flex;align-items:center;gap:8px;background:#fff;padding:6px;border-radius:5px;border:1px solid #e0e0e0">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex:1">
          <input type="checkbox" id="${prefix}-syn-chk-${pId}" class="${prefix}-syn-chk" value="${pId}" checked style="accent-color:#1565c0;width:15px;height:15px">
          <span style="font-size:.8rem;font-weight:600">${pG.name}</span>
        </label>
        <div style="display:flex;align-items:center;gap:5px">
          <label style="font-size:.7rem;color:#546e7a">שעה:</label>
          <input type="time" id="${prefix}-syn-time-${pId}" class="${prefix}-syn-time" data-gid="${pId}" value="${timeVal}" style="padding:2px 4px;font-size:.8rem;border:1px solid #ccc;border-radius:4px;width:110px">
        </div>
      </div>
    `;
  });
  html += `</div></div>`;
  return html;
}

function getSynergyData(prefix) {
  const data = [];
  const chks = document.querySelectorAll(`.${prefix}-syn-chk`);
  chks.forEach(chk => {
    if (chk.checked) {
      const pId = chk.value;
      const timeInput = document.getElementById(`${prefix}-syn-time-${pId}`);
      data.push({ g: Number(pId), t: timeInput ? timeInput.value : '' });
    }
  });
  return data;
}

window.renderPartnerSynergy = renderPartnerSynergy;
window.getSynergyData = getSynergyData;

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
window.doPostpone = doPostpone;
window.openCopy = openCopy;
window.doCopy = doCopy;
window.markCompManual = markCompManual;
window.openSupExport = openSupExport;
window.saveAndRefresh = saveAndRefresh;
window.refresh = refresh;
window.toggleSpEdit = toggleSpEdit;
window.toggleSpAccordion = toggleSpAccordion;
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

function postDateChg() {
  console.log('Postpone date changed');
}
window.postDateChg = postDateChg;

window.setPostMode = function(mode) {
  window._postMode = mode;
  const btnMove = document.getElementById('postm-mode-move');
  const btnDefer = document.getElementById('postm-mode-defer');
  const dateRow = document.getElementById('post-date').parentElement;
  const timeRow = document.getElementById('post-time').parentElement;
  const synWrap = document.getElementById('post-synergy-wrap');
  const saveBtn = document.getElementById('postm-save-btn');
  const reasonLbl = document.getElementById('post-reason-lbl');

  if(mode === 'move') {
    if(btnMove) btnMove.classList.add('active');
    if(btnDefer) btnDefer.classList.remove('active');
    if(dateRow) dateRow.style.display = 'block';
    if(timeRow) timeRow.style.display = 'block';
    if(synWrap) synWrap.style.display = 'block';
    if(saveBtn) { saveBtn.textContent = '🚀 הזז וצור השלמה'; saveBtn.className = 'btn borange'; }
    if(reasonLbl) reasonLbl.textContent = 'סיבה (אופציונלי)';
  } else {
    if(btnMove) btnMove.classList.remove('active');
    if(btnDefer) btnDefer.classList.add('active');
    if(dateRow) dateRow.style.display = 'none';
    if(timeRow) timeRow.style.display = 'none';
    if(synWrap) synWrap.style.display = 'block'; // Keep synergy visible for defer too!
    if(saveBtn) { saveBtn.textContent = '⏱️ דחה לעת עתה'; saveBtn.className = 'btn bs'; }
    if(reasonLbl) reasonLbl.textContent = 'סיבה (חובה לדחייה)';
  }
};

setTimeout(() => { if (typeof renderDash === 'function') renderDash(); }, 100);
