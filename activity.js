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

  console.log(`[Dash Debug] v101.2 Start. Tab:${tab}, St:${st}, Date:${date}, SCH:${window.SCH ? window.SCH.length : 'null'}`);

  const checkMatch = (s, tTab, tSt, tDate) => {
    const isHandled = !!(s._compByMakeup && s._compByMakeup !== "false");
    const isM = !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה/i.test(s.nt)));
    const g = window.G(s.g);
    if(!g) return false;
    const gClass = window.gcls ? window.gcls(g) : 'גנים';

    if (tTab === 'g' && gClass !== 'גנים') return false;
    if (tTab === 's' && gClass !== 'ביה"ס') return false;

    const from = document.getElementById('dash-from')?.value;
    const to = document.getElementById('dash-to')?.value;
    if (from && to) {
      if (s.d < from || s.d > to) return false;
    } else if (tDate && s.d !== tDate) {
      return false;
    }
    if (!tDate && !from && s.d < window.td()) return false;

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
      const getMinTime = (row) => {
        if (row.type === 'solo') return (row.ev?.t || '99:99').padStart(5, '0');
        if (!row.evs || !row.evs.length) return '99:99';
        const times = row.evs.map(e => (e.t || '99:99').padStart(5, '0'));
        times.sort();
        return times[0];
      };
      const tA = getMinTime(a);
      const tB = getMinTime(b);
      return tA.localeCompare(tB);
    });

    const summary = document.createElement('summary');
    summary.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
      <span style="font-weight:800; color:#2d3748;">🏙️ ${c} (${rows.length})</span>
      <span style="font-size:0.8rem; color:#718096;">לחץ לפירוט</span>
    </div>`;
    accordion.appendChild(summary);

    const content = document.createElement('div');
    content.className = 'city-accordion-content';

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
        const sorted = Array.from(pairMap.values()).sort((a,b) => {
          const tA = (a.t || '99:99').padStart(5, '0');
          const tB = (b.t || '99:99').padStart(5, '0');
          return tA.localeCompare(tB);
        });
        
        const realEv = sorted.find(x=>x.id && !x.id.toString().startsWith('dummy'));
        const realId = realEv ? realEv.id : '';
        h+=`<div style="margin-bottom:4px;border:1px solid ${clr.border||clr.solid+'44'};border-radius:6px;overflow:hidden">
          <div style="background:${clr.solid}22;padding:2px 8px;font-size:.7rem;font-weight:700;color:${clr.solid};display:flex;align-items:center;justify-content:space-between">
            <span>🔗 ${row.pair.name}</span>
            <div style="display:flex;gap:4px">
              ${realId ? `<button onclick="event.stopPropagation();if(window.openSP)window.openSP('${realId}')" style="background:rgba(255,255,255,0.5);border:1px solid ${clr.solid};border-radius:4px;padding:1px 6px;cursor:pointer;font-size:.65rem;color:${clr.solid};font-weight:800" title="עריכת פעילות">✏️ עריכה</button>` : ''}
              <button onclick="event.stopPropagation();if(window._exportPairWA)window._exportPairWA(${JSON.stringify(row.pair.ids)})" style="background:${clr.solid};border:none;border-radius:4px;padding:1px 6px;cursor:pointer;font-size:.65rem;color:#fff">📋 הודעה</button>
            </div>
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

// --- Table Batch Action Wrappers ---
window.spGetSelectedIds = function() {
  const checkboxes = document.querySelectorAll('.sp-garden-sel:checked');
  if(checkboxes.length) {
    return Array.from(checkboxes).map(c => c.value);
  }
  return [window.selEv]; // Fallback if no checkboxes exist/checked
};

// Helper to find the best matching partner activity (relaxed supplier check)
window.findPartnerActivity = function(gid, date, targetSup) {
  const tSupBase = targetSup ? window.supBase(targetSup) : null;
  const targetGid = Number(gid);
  
  const normD = (d) => {
    if(!d) return '';
    if(d instanceof Date) return d.toISOString().split('T')[0];
    if(typeof d === 'string') {
      if(d.includes('T')) return d.split('T')[0];
      if(d.includes('-')) return d; // Assume YYYY-MM-DD
    }
    // Fallback: try new Date
    try { 
      const parsed = new Date(d);
      if(!isNaN(parsed)) return parsed.toISOString().split('T')[0];
    } catch(e){}
    return String(d);
  };

  const targetDate = normD(date);
  
  // 1. Same date, same supplier
  let pEv = window.SCH.find(ps => 
    Number(ps.g) === targetGid && normD(ps.d) === targetDate && ps.st !== 'can' &&
    (tSupBase ? window.supBase(ps.a) === tSupBase : true)
  );
  
  // 2. Fallback: Same date, any supplier
  if (!pEv) {
    pEv = window.SCH.find(ps => 
      Number(ps.g) === targetGid && normD(ps.d) === targetDate && ps.st !== 'can'
    );
  }
  
  if (!pEv) {
    // console.warn(`[findPartnerActivity] No activity found for garden ${gid} on ${targetDate}`);
  }
  
  return pEv;
};

window.spBatchStatus = function(st) {
  const ids = window.spGetSelectedIds();
  ids.forEach(id => window.setStatus(id, st));
};

window.spBatchQSetSt = function(st) {
  const ids = window.spGetSelectedIds();
  if(ids.length) window.qSetSt(ids[0], st); 
};

window.spBatchAction = function(val) {
  const ids = window.spGetSelectedIds();
  if(!ids.length) { alert('יש לסמן לפחות גן אחד בטבלה'); return; }
  
  if(val === 'makeup') { window.openMakeupSched(ids[0]); return; }
  if(val === 'post') { window.openPostpone(ids[0]); return; }
  if(val === 'nohap') { window.qSetSt(ids[0], 'nohap'); return; } // qSetSt handles reason prompt
  
  // Standard statuses (done, ok, can)
  window.spBatchStatus(val);
};

window.spRowStatusChg = function(id, st) {
  const ev = window.SCH.find(x => x.id == id);
  if(!ev) return;
  
  const pair = window.gardenPair(ev.g);
  let syncPartner = false;
  if(pair) {
    const pGid = pair.ids.find(pid => Number(pid) !== Number(ev.g));
    const pG = window.G(pGid);
    if(confirm(`האם להחיל את הסטטוס "${window.stLabel({st})}" גם על הגן בן-הזוג (${pG.name})?`)) {
      syncPartner = true;
    }
  }

  if(st === 'nohap' || st === 'can' || st === 'post') {
    if(st === 'nohap') window.openNohapQ(id);
    else if(st === 'can') window.openCanQ(id);
    else if(st === 'post') window.openPostpone(id);
    window._spSyncPartnerNext = syncPartner; 
  } else {
    ev.st = st;
    if(st === 'ok') { ev.cr = ''; ev.cn = ''; }
    if(syncPartner) {
      const pev = window.findPartnerActivity(pair.ids.find(pid => Number(pid) !== Number(ev.g)), ev.d, ev.a);
      if(pev) {
        pev.st = st;
        if(st === 'ok') { pev.cr = ''; pev.cn = ''; }
      }
    }
    window.saveAndRefresh('sp');
  }
  // Dynamic UI update
  setTimeout(() => window.spUpdateExVisibility(), 100);
};

window.spUpdateExVisibility = function() {
  const ids = window.spGetSelectedIds();
  const box = document.getElementById('sp-ex-box');
  if(!box) return;
  
  const hasExc = ids.some(id => {
    const ev = window.SCH.find(x => x.id == id);
    if(!ev) return false;
    const isM = !!(ev._isMakeup || ev._makeupFrom || (ev.nt && /השלמה/i.test(ev.nt)) || (ev.a && /השלמה/i.test(ev.a)));
    const isExc = (ev.st === 'nohap' || ev.st === 'post' || ev.st === 'can') && !ev._compByMakeup;
    return isExc || (isM && ev.st !== 'done');
  });
  
  box.style.display = hasExc ? 'block' : 'none';
};

window.spBatchMarkCompManual = function() {
  const ids = window.spGetSelectedIds();
  const handleNtEl = document.getElementById('sp-handle-nt');
  const handleNt = handleNtEl ? handleNtEl.value.trim() : '';
  const stamp = 'manual_' + Date.now();
  
  ids.forEach(id => {
    const ev = window.SCH.find(x => x.id == id);
    if(ev) {
      ev._compByMakeup = stamp;
      if(handleNt) {
        const note = '✅ סיום טיפול: ' + handleNt;
        ev.nt = ev.nt ? ev.nt + ' | ' + note : note;
      }
    }
  });
  window.saveAndRefresh('sp');
};

window.spBatchSaveNt = function() {
  const ids = window.spGetSelectedIds();
  const ntEl = document.getElementById('sp-nt');
  const nEl = document.getElementById('sp-n');
  
  ids.forEach(id => {
    const ev = window.SCH.find(x => x.id == id);
    if(!ev) return;
    if(ntEl) ev.nt = ntEl.value;
    if(nEl) {
      ev.n = nEl.value;
      if(ev._recId) {
        window.SCH.forEach(x => {
          if(x._recId === ev._recId && x.d >= ev.d) x.n = nEl.value;
        });
      }
    }
    // Auto-status logic
    if(ntEl && (ev.st === 'ok' || ev.st === 'done')) {
      const val = ntEl.value;
      const lower = val.toLowerCase();
      const isMovedTo = lower.includes('נדחה ל') || lower.includes('הוזז ל') || lower.includes('הזזה ל');
      const isMovedFrom = lower.includes('נדחה מ') || lower.includes('הוזז מ') || lower.includes('הזזה מ');
      const isPos = lower.includes('השלמה') || isMovedFrom || (lower.includes('נדחה') && !isMovedTo);
      if(!isPos) {
        const canWords = ['בוטל', 'מבוטל', 'מצב בטחוני', 'סגר', 'שביתה'];
        const nohapWords = ['חסר מדריך', 'חוסר מדריך', 'אין מדריך', 'לא התקיים', 'לא הגיע', 'חולה', 'נתקע', 'לא נשאר', 'עזב', 'לא התקיימה'];
        if(canWords.some(w => lower.includes(w)) || isMovedTo) {
          ev.st = 'can';
        } else if(nohapWords.some(w => lower.includes(w))) {
          ev.st = 'nohap';
        }
      }
    }
  });
  window.saveAndRefresh('sp');
};

function openSP(id) {
  window.selEv = id;
  const s = window.SCH.find(x => x.id == id);
  if(!s) return;

  const isClusterMode = (window._listGroupMode === 'clusters' || window._dashTab === 'clusters');
  if (isClusterMode) {
    const cls = window.gardenClusters ? window.gardenClusters(s.g) : [];
    if (cls && cls.length > 0) {
      if (window.openClusterBulkEdit) {
        return window.openClusterBulkEdit(cls[0].id, s.d);
      }
    }
  }

  try { // ← try-catch to prevent silent failures
  const g=window.G(s.g);
  const spPair=window.gardenPair(s.g);

  // Build partner info array and currentTimesSP for later use
  const currentTimesSP = {};
  const partnerInfo = [];
  if (spPair) {
    const otherIds = spPair.ids.map(Number).filter(oid => oid !== Number(s.g));
    otherIds.forEach(oid => {
      const pg = window.G(oid);
      const pev = window.findPartnerActivity(oid, s.d, s.a);
      if(pev) currentTimesSP[oid] = window.fT(pev.t || s.t);
      partnerInfo.push({ pg, pev });
    });
  }

  // --- Activity type detection ---
  const _dow = new Date(s.d).getDay();
  const isM = !!(s._isMakeup || s._makeupFrom ||
                (s.nt && /השלמה|makeup/i.test(s.nt)) ||
                (s.n && /השלמה|makeup/i.test(s.n)) ||
                (s.cn && /השלמה|makeup/i.test(s.cn)) ||
                (s.a && /השלמה|makeup/i.test(s.a)) ||
                (s.act && /השלמה|makeup/i.test(s.act)));
  const repeats = window.SCH.filter(x => x.g === s.g && new Date(x.d).getDay() === _dow && window.supBase(x.a) === window.supBase(s.a) && x.t === s.t && x.st !== 'can').length >= 2;
  const isRec = !isM && (!!s._recId || repeats);

  const typeTag = isRec
    ? '<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:.68rem;font-weight:700;background:#e3f2fd;color:#1565c0">🔁 פעילות קבועה</span>'
    : isM
    ? '<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:.68rem;font-weight:700;background:#fff3e0;color:#e65100">↩️ השלמה</span>'
    : '<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:.68rem;font-weight:700;background:#eceff1;color:#546e7a">📌 חד-פעמי</span>';

  // --- STEP 1 & 2: Garden Details (Table) ---
  const allGardens = [{pg: g, pev: s}, ...partnerInfo];
  
  let h = `<div style="background:#fff;border-radius:10px;padding:12px;border:1px solid #e0e0e0;margin-bottom:12px;box-shadow:0 2px 4px rgba(0,0,0,0.02)">
    <div style="font-size:0.85rem;font-weight:800;color:#1a237e;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
      <span>🏠 פירוט גנים ושיבוצים - ${window.fD(s.d)} (${window.dayN(s.d)})</span>
      <div style="display:flex;gap:8px;align-items:center">
        ${typeTag}
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;background:#f3e5f5;padding:2px 6px;border-radius:4px;border:1px solid #ce93d8">
          <input type="checkbox" id="sp-is-rec-chk" ${isRec ? 'checked' : ''} onchange="window.toggleSpRecurBox(this.checked)" style="width:14px;height:14px;accent-color:#6a1b9a">
          <span style="font-size:0.65rem;font-weight:800;color:#6a1b9a">שיבוץ קבוע</span>
        </label>
      </div>
    </div>
    <div class="tw" style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;text-align:right;font-size:0.8rem">
        <thead>
          <tr style="background:#f5f7ff;color:#5c6bc0;border-bottom:2px solid #dbe3ff">
            <th style="padding:6px;width:30px;text-align:center">סמן</th>
            <th style="padding:6px">שם הגן</th>
            <th style="padding:6px">ספק</th>
            <th style="padding:6px">פעילות</th>
            <th style="padding:6px">סוג</th>
            <th style="padding:6px">סטטוס</th>
            <th style="padding:6px">שעה</th>
          </tr>
        </thead>
        <tbody>
          ${allGardens.map((info, idx) => {
            const pev = info.pev;
            const pId = pev ? pev.id : '';
            const rowG = info.pg;
            const curSt = pev ? pev.st : '';
            return `
            <tr style="border-bottom:1px solid #f0f0f0;background:${idx===0?'#fff':'#fafafa'}">
              <td style="padding:6px;text-align:center">
                ${pId ? `<input type="checkbox" class="sp-garden-sel" value="${pId}" checked onchange="window.spUpdateExVisibility()" style="width:16px;height:16px;accent-color:#5c6bc0">` : '-'}
              </td>
              <td style="padding:6px;font-weight:800;color:#1a237e">${idx===0?'':'🔗 '}${rowG.name} <span style="font-size:0.65rem;color:#78909c">(${rowG.city})</span></td>
              <td style="padding:6px">${pev ? window.supBase(pev.a) : '—'}</td>
              <td style="padding:6px">${pev ? (pev.act||'—') : '—'}</td>
              <td style="padding:6px">${window.gcls(rowG)==='גנים'?'חוג':'—'}</td>
              <td style="padding:6px">
                ${pev ? `
                  <select onchange="window.spRowStatusChg('${pev.id}', this.value)" style="padding:2px 4px;font-size:0.7rem;border-radius:4px;border:1px solid #ccc;background:${window.stClass(pev)==='done'?'#e8f5e9':(window.stClass(pev)==='nohap'?'#ffebee':'#fff')}">
                    <option value="ok" ${curSt==='ok'?'selected':''}>🔄 תקין</option>
                    <option value="done" ${curSt==='done'?'selected':''}>✔️ בוצע</option>
                    <option value="nohap" ${curSt==='nohap'?'selected':''}>⚠️ לא התקיים</option>
                    <option value="can" ${curSt==='can'?'selected':''}>❌ בוטל</option>
                    <option value="post" ${curSt==='post'?'selected':''}>⏩ נדחה</option>
                  </select>
                ` : '<span style="font-size:.7rem;color:#c62828;font-weight:700">לא משובץ</span>'}
              </td>
              <td style="padding:6px;font-weight:700">${pev&&pev.t ? window.fT(pev.t) : '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  // --- STEP 3: Quick Actions (Compact Dropdown) ---
  h += `<div style="background:#f8f9fa;border-radius:10px;padding:12px;border:1px solid #e0e0e0;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
    <div style="display:flex;flex-direction:column">
      <div style="font-size:.75rem;font-weight:800;color:#1a237e">🌐 פעולות גלובליות (על המסומנים)</div>
      <div style="font-size:0.65rem;color:#546e7a">הפעולות יחולו רק על הגנים המסומנים בטבלה</div>
    </div>
    <div style="display:flex;gap:8px">
      <select onchange="if(this.value) window.spBatchAction(this.value); this.value='';" style="padding:6px 12px;font-size:0.8rem;font-weight:700;border-radius:6px;border:1px solid #5c6bc0;background:#fff;color:#1a237e;cursor:pointer">
        <option value="">🚀 בחר פעולה מהירה...</option>
        <option value="done">✔️ סמן כ"בוצע"</option>
        <option value="nohap">⚠️ סמן כ"לא התקיים"</option>
        <option value="can">❌ בטל פעילות</option>
        <option value="ok">🔄 שחזור לתקין</option>
        <option value="post">⏩ דחייה למועד אחר</option>
        <option value="makeup">📅 קביעת השלמה</option>
      </select>
    </div>
  </div>`;

  // --- STEP 4: Notes ---
  h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
    <div style="background:#fff;border-radius:10px;padding:10px;border:1px solid #e0e0e0">
      <div style="font-size:.75rem;font-weight:700;color:#1a237e;margin-bottom:4px">📝 הערה חד פעמית (לפעילות זו)</div>
      <textarea id="sp-nt" rows="2" style="width:100%;font-size:.8rem;border-radius:6px;border:1px solid #ccc;padding:6px;resize:none;font-family:inherit" placeholder="למשל: אי קיום, השלמות...">${s.nt||''}</textarea>
    </div>
    <div style="background:#fff;border-radius:10px;padding:10px;border:1px solid #e0e0e0">
      <div style="font-size:.75rem;font-weight:700;color:#1a237e;margin-bottom:4px">📝 הערה קבועה (מעודכן קדימה)</div>
      <textarea id="sp-n" rows="2" style="width:100%;font-size:.8rem;border-radius:6px;border:1px solid #ccc;padding:6px;resize:none;font-family:inherit" placeholder="מעודכן לכל הפעילויות הבאות...">${s.n||''}</textarea>
    </div>
    <div style="grid-column:1/-1">
      <button class="btn bp bsm" style="width:100%;padding:8px;font-weight:700;border-radius:6px" onclick="window.spBatchSaveNt()">💾 שמור הערות לכל המסומנים</button>
    </div>
  </div>`;

  // --- STEP 5: Exception Handling (Only for relevant statuses) ---
  h += `<div id="sp-ex-box" style="display:none;margin-bottom:12px;border:1.5px solid #ffe082;border-radius:10px;padding:10px;background:#fff8e1">
      <div style="font-size:0.8rem;color:#e65100;font-weight:800;margin-bottom:6px">🛠️ טיפול בחריג</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input type="text" id="sp-handle-nt" style="flex:1;min-width:200px;padding:6px;border-radius:6px;border:1px solid #ffe082;font-size:0.8rem" placeholder="הערת סיום טיפול (לדוגמה: בוצע ידנית ב-20/4...)" value="${s.st==='post'?'נדחה':''}">
        ${spPair ? `<label for="sp-sync-pair" style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="sp-sync-pair" style="width:14px;height:14px;accent-color:#e65100" checked><span style="font-size:0.75rem;font-weight:700;color:#bf360c">סנכרן לזוג</span></label>` : ''}
        <button class="btn borange bsm" style="padding:6px 12px;font-weight:800;border-radius:6px" onclick="window.spBatchMarkCompManual()">סיום טיפול לכל המסומנים</button>
      </div>
    </div>`;

  // --- STEP 6: Series Management ---
  const isRecChecked = s._recId ? 'checked' : '';
  const _dObj = s.d ? new Date(s.d) : new Date();
  const _sY = _dObj.getMonth() >= 7 ? _dObj.getFullYear() : _dObj.getFullYear() - 1;
  const defaultFrom = `${_sY}-09-01`;
  const defaultTo = `${_sY + 1}-06-30`;

  h += `<div style="margin-top:10px;border:1px solid #ce93d8;border-radius:10px;overflow:hidden">
    <div style="background:#f3e5f5;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="window.toggleSpAccordion('sp-acc-series')">
      <b style="font-size:0.8rem;color:#6a1b9a">🔄 הגדרות פעילות קבועה (סדרה)</b>
      <span id="sp-acc-series-arrow" style="font-size:0.7rem;transition:0.3s">▼</span>
    </div>
    <div id="sp-acc-series" style="display:none;padding:12px;background:#fff;border-top:1px solid #ce93d8">
      <div style="font-size:.72rem;color:#6a1b9a;margin-bottom:10px;background:#f9f9f9;padding:6px 10px;border-radius:6px">הגדרת טווח תאריכים וימים בשבוע. המערכת תשבץ פעילויות אלו באופן אוטומטי. ${s._recId ? 'שינוי כאן יחליף את הפעילויות העתידיות בסדרה זו.' : ''}</div>
      <div style="display:grid;gap:8px;background:#f9f9f9;padding:10px;border-radius:8px;border:1px solid #eee">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div class="fg"><label style="font-size:.7rem;font-weight:700">📅 מתאריך</label><input type="date" id="rr-from" value="${defaultFrom}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>
          <div class="fg"><label style="font-size:.7rem;font-weight:700">📅 עד תאריך</label><input type="date" id="rr-to" value="${defaultTo}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>
        </div>
        <div class="fg"><label style="font-size:.7rem;font-weight:700">🗓️ ימים בשבוע</label>
          <div style="display:flex;justify-content:space-between;background:#fff;padding:6px;border-radius:4px;border:1px solid #ccc">
            ${['א','ב','ג','ד','ה'].map((d,i)=>`<label style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer"><span style="font-size:.65rem;font-weight:700">${d}</span><input type="checkbox" class="rr-day" value="${i}" ${new Date(s.d).getDay()===i?'checked':''} style="width:14px;height:14px;accent-color:#6a1b9a"></label>`).join('')}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div class="fg"><label style="font-size:.7rem;font-weight:700">📚 ספק</label>
            <select id="rr-sup" onchange="window.rrSupChg()" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc">${(window.getAllSup ? window.getAllSup().filter(s2=>window.isActSupplier(s2.name)) : []).map(s2=>`<option value="${s2.name}" ${s2.name===s.a?'selected':''}>${s2.name}</option>`).join('')}</select>
          </div>
          <div class="fg"><label style="font-size:.7rem;font-weight:700">🎯 פעילות</label>
            <select id="rr-act" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"><option value="">— ללא שינוי —</option>${(window.getSupActs ? window.getSupActs(s.a) : []).map(a=>`<option value="${a}" ${a===s.act?'selected':''}>${a}</option>`).join('')}</select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:${spPair?'1fr 1fr':'1fr'};gap:8px">
          <div class="fg"><label style="font-size:.7rem;font-weight:700">⏰ שעה (${g.name})</label><input type="time" id="rr-time" value="${s.t||''}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>
          ${spPair ? `<div class="fg"><label style="font-size:.7rem;font-weight:700">⏰ שעה (${window.G(spPair.ids.find(id=>Number(id)!==Number(s.g))).name})</label><input type="time" id="rr-time-partner" value="${(partnerInfo.length > 0 && partnerInfo[0].pev) ? partnerInfo[0].pev.t : (s.t||'')}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>` : ''}
        </div>
        ${spPair ? `<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="rr-sync" style="width:14px;height:14px;accent-color:#1a237e" checked><span style="font-size:.75rem;font-weight:700;color:#1a237e">סנכרן עם גן בן-זוג באותם ימים ושעות</span></label>` : ''}
        <button class="btn bp" style="width:100%;padding:8px;font-weight:800;font-size:.85rem;margin-top:6px" onclick="window.saveReplaceRecur('${s.id}')">💾 שמור שינויים והחל סדרה קבועה</button>
        ${s._recId ? `<button class="btn br" style="width:100%;padding:6px;font-weight:700;margin-top:4px;background:#fff;border:1px solid #ef9a9a;color:#c62828;font-size:.75rem" onclick="window.deleteRecurSeries('${s.id}')">🗑️ הסר פעילות קבועה מכאן והלאה</button>` : ''}
      </div>
    </div>
  </div>`;

  // --- STEP 7: Manual Edit ---
  const allSups = window.getAllSup ? window.getAllSup().filter(s2=>window.isActSupplier(s2.name)) : [];
  const initialActs = window.getSupActs ? window.getSupActs(s.a) : [];
  h += `<div style="margin-top:10px;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden">
    <div onclick="window.toggleSpAccordion('sp-acc-edit')" style="background:#f5f5f5;padding:8px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">
      <b style="font-size:0.8rem;color:#455a64">✏️ עריכה ידנית (חד-פעמי)</b>
      <span id="sp-acc-edit-arrow" style="font-size:0.7rem;transition:0.3s">▼</span>
    </div>
    <div id="sp-acc-edit" style="display:none;padding:12px;background:#fff;border-top:1px solid #e0e0e0">
      <div style="font-size:.72rem;color:#78909c;margin-bottom:8px;background:#f9f9f9;padding:4px 8px;border-radius:4px">שינוי תאריך, ספק, פעילות או שעה <b>רק לפעילות זו</b></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="fg"><label for="sp-edit-date" style="font-size:.7rem;font-weight:700">תאריך</label><input type="date" id="sp-edit-date" value="${s.d}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>
        <div class="fg"><label for="sp-edit-time" style="font-size:.7rem;font-weight:700">שעה (${g.name})</label><input type="time" id="sp-edit-time" value="${s.t||''}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>
        <div class="fg"><label for="sp-edit-sup" style="font-size:.7rem;font-weight:700">ספק</label><select id="sp-edit-sup" onchange="window.spEditSupChg()" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc">${allSups.map(sup => `<option value="${sup.name}" ${sup.name===s.a ? 'selected':''}>${sup.name}</option>`).join('')}</select></div>
        <div class="fg"><label for="sp-edit-act" style="font-size:.7rem;font-weight:700">פעילות</label><select id="sp-edit-act" onchange="window.spEditActChg()" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"><option value="">— ללא שינוי —</option>${initialActs.map(a => `<option value="${a}" ${a===s.act ? 'selected':''}>${a}</option>`).join('')}<option value="__new__">➕ פעילות חדשה...</option></select></div>
      </div>
      <div class="fg" id="sp-edit-act-new-wrap" style="display:none;margin-top:8px"><label for="sp-edit-act-new" style="font-size:.7rem;font-weight:700">שם הפעילות החדשה</label><input type="text" id="sp-edit-act-new" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>
      ${spPair ? window.renderPartnerSynergy(s.g, 'sped', currentTimesSP) : ''}
      <button class="btn bg" style="width:100%;padding:8px;font-weight:800;margin-top:8px;font-size:.8rem" onclick="window.spEditSave()">💾 שמור שינויים</button>
    </div>
  </div>`;

  document.getElementById('sp-m-body').innerHTML = h;
  window.spUpdateExVisibility(); // Initial check
  window.OM('sp-m');
  } catch(err) {
    console.error('[openSP] Error building panel:', err);
    var spBody=document.getElementById('sp-m-body');
    if(spBody) spBody.innerHTML='<div style="color:#c62828;padding:20px;font-size:.85rem"><b>שגיאה בפתיחת פרטי פעילות:</b><br><pre style="white-space:pre-wrap;margin-top:8px;background:#fff3f3;padding:10px;border-radius:6px;font-size:.75rem">'+err.message+'\n'+err.stack+'</pre></div>';
    window.OM('sp-m');
  }
}
window.openSP = openSP;

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
            nt: '', _recId: newRecId, grp: s.grp||1
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
                    nt: '', _recId: newRecId, grp: s.grp||1
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
    const pEv = window.findPartnerActivity(syn.g, origDate, origSup);
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
        const pev = window.findPartnerActivity(oid, main.d, main.a);
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
  if(ntEl) {
    const val = ntEl.value;
    s.nt = val;
    const lower = val.toLowerCase();
    const isMovedFrom = lower.includes('נדחה מ') || lower.includes('הוזז מ') || lower.includes('הזזה מ');
    const isMovedTo = lower.includes('נדחה ל') || lower.includes('הוזז ל') || lower.includes('הזזה ל');
    const isPos = lower.includes('השלמה') || isMovedFrom || (lower.includes('נדחה') && !isMovedTo);
    
    // Auto-Correct status based on note keywords (skip if it's a positive exception)
    if((s.st === 'ok' || s.st === 'done') && !isPos) {
      const canWords = ['בוטל', 'מבוטל', 'מצב בטחוני', 'סגר', 'שביתה'];
      const nohapWords = ['חסר מדריך', 'חוסר מדריך', 'אין מדריך', 'לא התקיים', 'לא הגיע', 'חולה', 'נתקע', 'לא נשאר', 'עזב', 'לא התקיימה'];
      if(canWords.some(w => lower.includes(w)) || isMovedTo) {
        s.st = 'can';
        if(typeof window.showToast==='function') window.showToast('ℹ️ הסטטוס עודכן אוטומטית ל"בוטל" (נדחה למועד אחר)');
      } else if(nohapWords.some(w => lower.includes(w))) {
        s.st = 'nohap';
        if(typeof window.showToast==='function') window.showToast('ℹ️ הסטטוס עודכן אוטומטית ל"לא התקיים" עקב ההערה');
      }
    }
  }
  
  // Synergy Sync: Copy note and status to partner garden if synced
  const syncChk = document.getElementById('sp-sync-global');
  const pair = window.gardenPair(s.g);
  if(syncChk && syncChk.checked && pair) {
    pair.ids.forEach(pId => {
      if(pId === s.g) return;
      const pEv = window.findPartnerActivity(pId, s.d, s.a);
      if(pEv) {
        pEv.nt = s.nt;
        pEv.st = s.st;
      }
    });
  }

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
        const partnerEv = window.findPartnerActivity(ogid, s.d, s.a);
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
  if(window.CM) window.CM('sp-m');
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

// Override core openNohapQ to respect the side-panel sync flag
const origOpenNohapQ = window.openNohapQ;
window.openNohapQ = function(id) {
  if(typeof origOpenNohapQ === 'function') origOpenNohapQ(id);
  if(typeof window._spSyncPartnerNext !== 'undefined') {
    const scopeWrap = document.getElementById('nohapq-scope-wrap');
    if(scopeWrap) {
      scopeWrap.style.display = 'none'; // Hide redundancy
      // Pre-set the radio value
      const radio = document.querySelector(`input[name="nohapq-scope"][value="${window._spSyncPartnerNext ? 'pair' : 'solo'}"]`);
      if(radio) radio.checked = true;
    }
    // Clear flag after use
    setTimeout(() => { delete window._spSyncPartnerNext; }, 500);
  }
};

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
