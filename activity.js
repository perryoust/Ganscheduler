window._dashTab = window._dashTab || 'g'; // 'g' for Gardens, 's' for Schools
window._dashView = window._dashView || 'todo'; // 'todo', 'handled', 'all', 'can'
window.setDashTab = setDashTab;
window.setDashView = setDashView;
window.renderDash = renderDash;

function setDashTab(t) {
  window._dashTab = t;
  document.querySelectorAll('[id^="dash-tab-"]').forEach(btn => {
    const btnTab = btn.id.replace('dash-tab-', '').replace('-desktop', '').replace('-mobile', '');
    btn.classList.toggle('active', btnTab === t);
  });
  renderDash();
}

function setDashView(v) {
  window._dashView = v;
  document.querySelectorAll('.dash-view-pill').forEach(btn => {
    const btnView = btn.id.replace('dvp-', '').replace('-desktop', '').replace('-mobile', '');
    btn.classList.toggle('active', btnView === v);
  });
  renderDash();
}



function renderDash() {
  const list = document.getElementById('dash-body');
  if (!list) return;

  const dateEl = window.getEl('dash-date');
  const cityEl = window.getEl('dash-city');
  const supEl = window.getEl('dash-sup');
  const fromEl = window.getEl('dash-from');
  const toEl = window.getEl('dash-to');
  const srchEl = window.getEl('dash-srch');

  const date = dateEl ? dateEl.value : '';
  const city = cityEl ? cityEl.value : '';
  const sup = supEl ? supEl.value : '';
  const from = fromEl ? fromEl.value : '';
  const to = toEl ? toEl.value : '';
  const srch = (srchEl ? srchEl.value : '').toLowerCase();

  const tab = window._dashTab || 'g'; // 'g' for Gardens, 's' for Schools
  const view = window._dashView || 'todo'; // 'todo', 'nohap', 'post', 'handled', 'can', 'all'

  const filtered = (window.SCH || []).filter(s => {
    const g = window.G(s.g);
    if (!g) return false;
    
    const gClass = window.gcls ? window.gcls(g) : 'גנים';
    if (tab === 's' && gClass === 'ביה"ס') {
       // Debug: console.log('Found school activity:', s.a, s.st, view);
    }
    if (tab === 'g' && gClass !== 'גנים') return false;
    if (tab === 's' && gClass !== 'ביה"ס') return false;

    if (city && g.city !== city) return false;
    if (sup && window.supBase(s.a) !== sup) return false;
    if (srch && ![(g.name||''), (g.city||''), s.a, s.act, s.nt].some(v=>(v||'').toLowerCase().includes(srch))) return false;

    const isHandled = !!(s._compByMakeup && s._compByMakeup !== "false") || !!((s.nt && /הוקדם ל|נדחה ל|הוזז ל|הקדמה ל|דחייה ל|עבר ל|עובר ל|הועבר ל/i.test(s.nt)) || (s.n && /הוקדם ל|נדחה ל|הוזז ל|הקדמה ל|דחייה ל|עבר ל|עובר ל|הועבר ל/i.test(s.n)));
    const isM = !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.nt)) || (s.n && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.n)) || (s.a && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.a)));

    if (view === 'todo') {
      if (s.st === 'can' || isHandled || isM) return false;
      if (s.st !== 'nohap' && s.st !== 'post') return false;
    } else if (view === 'makeups') {
      const isFuture = s.d >= window.td();
      if (!isM || s.st === 'done' || s.st === 'can' || !isFuture) return false;
    } else if (view === 'nohap') {
      if (s.st !== 'nohap' || isHandled) return false;
    } else if (view === 'post') {
      if (s.st !== 'post' || isHandled) return false;
    } else if (view === 'handled') {
      const isPast = s.d < window.td();
      const autoDoneMakeup = isM && s.st !== 'can' && isPast;
      if (!isHandled && s.st !== 'done' && !autoDoneMakeup) return false;
    } else if (view === 'can') {
      if (s.st !== 'can') return false;
    } else if (view === 'all') {
       // show everything
    }

    if (from && s.d < from) return false;
    if (to && s.d > to) return false;
    
    // Ignore single-day filter for backlog views (To-Do, exceptions, makeups)
    const isBacklogView = ['todo', 'makeups', 'nohap', 'post'].includes(view);
    if (!from && !to && date && s.d !== date && !isBacklogView) return false;

    return true;
  });

  // Sort newest first
  filtered.sort((a, b) => b.d.localeCompare(a.d) || (b.t || '').localeCompare(a.t || ''));

  // Group by City
  const groups = {};
  filtered.forEach(s => {
    const g = window.G(s.g);
    const c = g.city || 'אחר';
    if (!groups[c]) groups[c] = [];
    groups[c].push(s);
  });

  const openCities = new Set();
  document.querySelectorAll('.dash-city-accordion[open]').forEach(det => {
    const cityTitle = det.querySelector('summary span:nth-child(2)')?.textContent?.replace('🏙️ ', '').trim();
    if (cityTitle) openCities.add(cityTitle);
  });

  let html = '';
  Object.keys(groups).sort().forEach((cityName, idx) => {
    const cityEvs = groups[cityName];
    const cityOpen = !!city || openCities.has(cityName); 
    const cityNameEsc = cityName.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const groupId = `dash-group-${cityName.replace(/\s+/g, '_')}`;
    const clr = window.CITY_COLORS ? window.CITY_COLORS(cityName) : {solid:'#1a237e', light:'#f8fafc', border:'#e2e8f0'};

    html += `<details class="dash-city-accordion" ${cityOpen ? 'open' : ''}>
      <summary>
        <div style="display:flex; align-items:center; gap:12px; flex:1">
          <input type="checkbox" onclick="event.stopPropagation(); dashCheckAll('${groupId}', this.checked)" style="width:18px;height:18px">
          <span style="font-weight:800; color:#1e293b; font-size:1.1rem">🏙️ ${cityName}</span>
          <span style="font-weight:700; color:#64748b; font-size:0.9rem; margin-right:5px">(${cityEvs.length})</span>
        </div>
        <div style="font-size:0.75rem; color:#64748b; font-weight:600">לחץ לפירוט ▼</div>
      </summary>
      <div id="${groupId}" class="dash-city-content" style="padding:10px; display:flex; flex-direction:column; gap:8px">`;

    // Internal Grouping: Date -> Pairs/Solo
    const dateGroups = {};
    cityEvs.forEach(s => {
      (dateGroups[s.d] = dateGroups[s.d] || []).push(s);
    });

    Object.keys(dateGroups).sort().reverse().forEach(date => {
      const dateEvs = dateGroups[date];
      html += `<div style="padding:6px 15px; background:#f8f9fa; border-bottom:1px solid #e9ecef; font-weight:700; color:#495057; font-size:0.85rem">📅 ${window.fD(date)}</div>`;
      
      const dateUsedIds = new Set();
      const dateCards = [];

      // Pairs within this date
      (window.pairs || []).forEach(p => {
        const pEvs = dateEvs.filter(s => !dateUsedIds.has(String(s.id)) && p.ids.map(Number).includes(Number(s.g)));
        if (pEvs.length) {
          dateCards.push({ type: 'pair', obj: p, evs: pEvs });
          pEvs.forEach(s => dateUsedIds.add(String(s.id)));
        }
      });

      // Standalone within this date
      dateEvs.filter(s => !dateUsedIds.has(s.id)).forEach(s => {
        const g = window.G(s.g);
        dateCards.push({ type: 'solo', obj: { name: g.name, ids: [g.id] }, evs: [s] });
      });

      dateCards.forEach(card => {
        html += _renderDashCard(card);
      });
    });

    html += `</div></details>`;
  });

  list.innerHTML = html || `<div style="padding:40px; text-align:center; color:#94a3b8">
    <div style="font-size:3rem; margin-bottom:10px">✨</div>
    <div style="font-weight:700">אין פעילויות להצגה בתנאי הסינון הנוכחיים</div>
  </div>`;
  
  if (window.dashUpdateBulkBar) window.dashUpdateBulkBar();
  // Update counts on all active view pills (desktop and mobile)
  const stats = window.getDashStats ? window.getDashStats() : {};
  Object.keys(stats).forEach(k => {
    const dBadge = document.getElementById('dvp-cnt-' + k + '-desktop');
    const mBadge = document.getElementById('dvp-cnt-' + k + '-mobile');
    if (dBadge) dBadge.textContent = stats[k];
    if (mBadge) mBadge.textContent = stats[k];
  });
}

function _renderDashCard(card) {
  const { type, obj, evs } = card;
  const isSolo = type === 'solo';
  const firstG = window.G(evs[0].g);
  const clr = window.CITY_COLORS ? window.CITY_COLORS(firstG.city) : {solid:'#1a237e', light:'#f8fafc', border:'#e2e8f0'};

  return window.ui.renderStandardPairCard(obj, evs, {
    ds: evs[0].d,
    clr: clr,
    context: 'dash',
    isSolo: isSolo
  });
}

window.dashCheckAll = function(groupId, checked) {
  const group = document.getElementById(groupId);
  if (group) {
    const chks = group.querySelectorAll('.dash-row-chk');
    chks.forEach(cb => {
      cb.checked = checked;
    });
  }
  window.dashUpdateBulkBar();
};

window.dashUpdateBulkBar = function() {
  const chks = document.querySelectorAll('.dash-row-chk:checked');
  const bar = document.getElementById('dash-bulk-bar');
  const countEl = document.getElementById('dash-bulk-count');
  if (!bar || !countEl) return;
  
  if (chks.length > 0) {
    bar.style.display = 'flex';
    countEl.textContent = chks.length;
  } else {
    bar.style.display = 'none';
  }
};


window.dashBatchAction = async function(action) {
  const ids = Array.from(document.querySelectorAll('.dash-row-chk:checked')).map(cb => cb.value);
  if (ids.length === 0) return;

  if (action === 'clear') {
    document.querySelectorAll('.dash-row-chk').forEach(cb => cb.checked = false);
    window.dashUpdateBulkBar();
    return;
  }

  let promptMsg = '';
  let notePrefix = '';
  let status = '';
  let stampPrefix = '';

  if (action === 'handled') {
    promptMsg = 'הערות לטיפול (אופציונלי):';
    notePrefix = '✅ טופל: ';
    stampPrefix = 'bulk_handled_';
  } else if (action === 'nohap') {
    promptMsg = 'סיבה ל"לא התקיים" (אופציונלי):';
    notePrefix = '⚠️ לא התקיים: ';
    status = 'nohap';
    stampPrefix = 'bulk_nohap_';
  } else if (action === 'can') {
    promptMsg = 'סיבת ביטול (אופציונלי):';
    notePrefix = '❌ בוטל: ';
    status = 'can';
    stampPrefix = 'bulk_can_';
  }

  const note = prompt(promptMsg);
  if (note === null) return; // User cancelled prompt

  const stamp = stampPrefix + Date.now();
  
  ids.forEach(id => {
    const s = window.SCH.find(x => x.id == id);
    if (s) {
      if (status) s.st = status;
      s._compByMakeup = stamp;
      const nText = notePrefix + (note || (status === 'nohap' ? 'לא התקיים' : status === 'can' ? 'בוטל' : 'טופל'));
      s.nt = s.nt ? s.nt + ' | ' + nText : nText;
      
      // Sync to partners
      const pair = window.gardenPair(s.g);
      const clusterArr = window.gardenClusters ? window.gardenClusters(s.g) : [];
      
      const allPartnerIds = new Set();
      if(pair) pair.ids.forEach(pid => allPartnerIds.add(Number(pid)));
      if(clusterArr) clusterArr.forEach(c => {
        if(c.gids) c.gids.forEach(pid => allPartnerIds.add(Number(pid)));
      });
      allPartnerIds.delete(Number(s.g));

      allPartnerIds.forEach(pId => {
        const ps = window.findPartnerActivity(pId, s.d, s.a);
        if (ps) {
          if (status) ps.st = status;
          ps._compByMakeup = stamp;
          ps.nt = ps.nt ? ps.nt + ' | ' + nText : nText;
        }
      });
    }
  });

  const saveToast = window.showToast('💾 שומר שינויים לענן...', 0);
  try {
    await window.saveAndRefresh('dash', false, true);
    if (saveToast && saveToast.close) saveToast.close();
    window.showToast('✅ נשמר בהצלחה');
  } catch(err) {
    if (saveToast && saveToast.close) saveToast.close();
    window.showToast('❌ שגיאה בשמירה: ' + err.message);
  }

  setTimeout(() => {
    document.querySelectorAll('.dash-row-chk').forEach(cb => cb.checked = false);
    window.dashUpdateBulkBar();
  }, 100);
};

window.dashNavDate = function(dir) {
  const el = window.getEl('dash-date');
  if (!el) return;
  let newVal = '';
  if (dir === 0) newVal = window.td();
  else newVal = window.addD(window.s2d(el.value || window.td()), dir).toISOString().split('T')[0];
  window.syncDashDate(newVal);
  renderDash();
};

function renderCanList() { /* Redundant - Integrated into renderDash */ }



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
  
  console.log('[spBatchAction]', val, {ids});
  switch(val) {
    case 'makeup':
      window.spTriggerMakeupUI();
      break;
    case 'post': 
      window.openPostpone(ids[0]); 
      break;
    case 'nohap': 
      window.qSetSt(ids[0], 'nohap'); 
      break;
    default:
      // Standard statuses (done, ok, can)
      window.spBatchStatus(val);
      break;
  }
};

window.spRowStatusChg = function(id, st) {
  const ev = window.SCH.find(x => x.id == id);
  if(!ev) return;
  
  const pair = window.gardenPair(ev.g);
  let syncPartner = false;
  if(pair) {
    const pGid = pair.ids.find(pid => Number(pid) !== Number(ev.g));
    const pG = window.G(pGid);
    const stText = st === 'nohap' ? 'לא התקיים' : (st === 'can' ? 'ביטול' : (st === 'post' ? 'דחייה' : st));
    
    // Only ask confirm for simple statuses (done/ok). 
    // Exceptions (nohap/can/post) have their own modals with sync options.
    if(st === 'done' || st === 'ok') {
        if(confirm(`האם לעדכן את הסטטוס "${stText}" גם בגן בן-הזוג (${pG.name})?`)) {
            syncPartner = true;
        }
    } else {
        // For exceptions, we pre-set syncPartner to true so it's checked by default in the next modal
        syncPartner = true; 
    }
  }

  window._spSyncPartnerNext = syncPartner; 

  if(st === 'nohap' || st === 'can' || st === 'post') {
    if(st === 'nohap') window.openNohapQ(id);
    else if(st === 'can') window.openCanQ(id);
    else if(st === 'post') window.openPostpone(id);
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
    window.saveAndRefresh('sp', true);
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

// ── Centralized Activity Update Engine ───────────────────
window.updateActivities = function(ids, fields, options = {}) {
  const stamp = options.stamp || 'man_' + Date.now();
  const doSync = options.syncPartner || false;
  const autoStatus = options.autoStatus !== false;

  ids.forEach(id => {
    const ev = window.SCH.find(x => x.id == id);
    if(!ev) return;

    // Apply fields
    Object.keys(fields).forEach(k => {
      if(k === 'nt' && options.appendNote) {
        ev.nt = ev.nt ? ev.nt + ' | ' + fields[k] : fields[k];
      } else {
        ev[k] = fields[k];
      }
    });

    if(autoStatus && fields.nt) {
      const newSt = window._autoDetermineStatus(ev.st, fields.nt);
      if(newSt) ev.st = newSt;
    }

    if(doSync) {
      const pair = window.gardenPair(ev.g);
      if(pair) {
        pair.ids.forEach(pId => {
          if(Number(pId) === Number(ev.g)) return;
          const pev = window.findPartnerActivity(pId, ev.d, ev.a);
          if(pev) {
            Object.keys(fields).forEach(k => {
              if(k === 'nt' && options.appendNote) {
                pev.nt = pev.nt ? pev.nt + ' | ' + fields[k] : fields[k];
              } else {
                pev[k] = fields[k];
              }
            });
            if(autoStatus && fields.nt) {
              const newSt = window._autoDetermineStatus(pev.st, fields.nt);
              if(newSt) pev.st = newSt;
            }
          }
        });
      }
    }
  });
};

window._autoDetermineStatus = function(currentSt, note) {
  if(!note) return null;
  if(currentSt !== 'ok' && currentSt !== 'done') return null;
  
  const lower = note.toLowerCase();
  const isMovedTo = lower.includes('נדחה ל') || lower.includes('הוזז ל') || lower.includes('הזזה ל') || lower.includes('הוקדם ל') || lower.includes('עבר ל') || lower.includes('עובר ל');
  const isMovedFrom = lower.includes('נדחה מ') || lower.includes('הוזז מ') || lower.includes('הזזה מ') || lower.includes('הוקדם מ') || lower.includes('עבר מ') || lower.includes('עובר מ');
  const isPos = lower.includes('השלמה') || isMovedFrom || (lower.includes('נדחה') && !isMovedTo);
  
  if(isPos) return null;

  const canWords = ['בוטל', 'מבוטל', 'מצב בטחוני', 'סגר', 'שביתה', 'מסיבת פורים', 'מסיבות אישיות'];
  const nohapWords = ['חסר מדריך', 'חוסר מדריך', 'אין מדריך', 'לא התקיים', 'לא הגיע', 'חולה', 'נתקע', 'לא נשאר', 'עזב', 'לא התקיימה', 'לא מרגיש טוב', 'לא עונה', 'טעה ביום', 'טעות בשיבוץ', 'לא מצא חניה', 'איחר לא העביר'];
  
  if(canWords.some(w => lower.includes(w)) || isMovedTo) return 'can';
  if(nohapWords.some(w => lower.includes(w))) return 'nohap';
  if(lower.includes('הושלם') || lower.includes('התקיים') || lower.includes('בוצע')) return 'done';
  
  return null;
};

window.spBatchMarkCompManual = function() {
  const ids = window.spGetSelectedIds();
  const handleNt = (document.getElementById('sp-handle-nt')?.value||'').trim();
  const syncCheck = document.getElementById('sp-sync-global') || document.getElementById('sp-sync-pair');
  
  window.updateActivities(ids, {
    _compByMakeup: 'manual_' + Date.now(),
    ...(handleNt ? { nt: '✅ סיום טיפול: ' + handleNt } : {})
  }, {
    syncPartner: !!(syncCheck && syncCheck.checked),
    appendNote: true
  });
  window.saveAndRefresh('sp', true);
};

window.spBatchSaveNt = function() {
  const ids = window.spGetSelectedIds();
  const nt = document.getElementById('sp-nt')?.value;
  const n = document.getElementById('sp-n')?.value;
  
  ids.forEach(id => {
    const ev = window.SCH.find(x => x.id == id);
    if(!ev) return;
    if(nt !== undefined) ev.nt = nt;
    if(n !== undefined) {
      ev.n = n;
      if(ev._recId && !ev._isMakeup && !ev._makeupFrom && !ev._postFrom) {
        window.SCH.forEach(x => { if(x._recId === ev._recId && x.d >= ev.d) x.n = n; });
      }
    }
    // Still apply auto-status for the main notes field
    if(nt) {
      const newSt = window._autoDetermineStatus(ev.st, nt);
      if(newSt) ev.st = newSt;
    }
  });
  window.saveAndRefresh('sp', true);
};

window.openSP = function(id) {
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
  const allSups = window.getAllSup ? window.getAllSup().filter(s2=>window.isActSupplier(s2.name)) : [];
  var initialActs = window.getSupActs ? window.getSupActs(s.a) : [];

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
        <button onclick="window._exportGardenWA([${allGardens.map(ag=>ag.pg.id).join(',')}], '${s.d}')" class="btn bsm" style="background:#1565c0;color:#fff;padding:2px 6px;border-radius:4px;display:flex;align-items:center;gap:4px;border:none">
          <span style="font-size:0.8rem">🚀</span>
          <span style="font-size:0.65rem;font-weight:800">יצוא להודעה</span>
        </button>
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
              <th style="padding:6px;text-align:center">קבוצות</th>
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
              <td style="padding:6px">${pev ? (pev.tp || (window.gcls(rowG)==='גנים'?'חוג':'—')) : '—'}</td>
              <td style="padding:6px;text-align:center;font-weight:700">${pev ? (pev.grp || 1) : '—'}</td>
              <td style="padding:6px">
                ${pev ? `
                  <select onchange="window.spRowStatusChg('${pev.id}', this.value)" style="padding:2px 4px;font-size:0.7rem;border-radius:4px;border:1px solid #ccc;background:${window.stClass(pev)==='done'?'#e8f5e9':(window.stClass(pev)==='nohap'?'#ffebee':'#fff')}">
                    <option value="ok" ${curSt==='ok'?'selected':''}>🔄 תקין</option>
                    <option value="done" ${curSt==='done'?'selected':''}>✔️ בוצע</option>
                    <option value="nohap" ${curSt==='nohap'?'selected':''}>⚠️ לא התקיים</option>
                    <option value="can" ${curSt==='can'?'selected':''}>❌ בוטל</option>
                    <option value="post" ${curSt==='post'?'selected':''}>⏩ נדחה</option>
                  </select>
                  ${(curSt==='nohap'||curSt==='can') ? `<button class="btn br bsm" style="padding:1px 4px;margin-right:3px;border:1px solid #ef9a9a;background:#fff;color:#c62828" title="מחיקה מהלוח" onclick="window.deleteSingleActivity('${pev.id}')">🗑️</button>` : ''}
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
        <option value="delete">🗑️ מחיקה מהלוח</option>
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
        <button class="btn br" style="width:100%;padding:6px;font-weight:700;margin-top:4px;background:#fff;border:1px solid #ccc;color:#666;font-size:.75rem" onclick="window.deleteSingleActivity('${s.id}')">🗑️ מחק שיבוץ זה בלבד (הסרה מהלוח)</button>
      </div>
    </div>
  </div>`;

  // --- STEP 7: Makeup Management ---
  h += `<div id="sp-acc-makeup-wrap" style="margin-top:10px;border:1px solid #ffb74d;border-radius:10px;overflow:hidden;display:${(s.st==='nohap'||s.st==='post'||s.st==='can')?'block':'none'}">
    <div style="background:#fff3e0;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="window.toggleSpAccordion('sp-acc-makeup')">
      <b style="font-size:0.8rem;color:#e65100">📅 קביעת השלמה לפעילות זו</b>
      <span id="sp-acc-makeup-arrow" style="font-size:0.7rem;transition:0.3s">▼</span>
    </div>
    <div id="sp-acc-makeup" style="display:none;padding:12px;background:#fff;border-top:1px solid #ffb74d">
       <div id="sp-makeup-form-inner">
          <div style="font-size:.72rem;color:#e65100;margin-bottom:10px;background:#fff9f0;padding:6px 10px;border-radius:6px;border:1px solid #ffe0b2">
            <b>שיבוץ השלמה:</b> בחר תאריך חדש לביצוע הפעילות. המערכת תסנכרן את השיבוץ לגנים השותפים המסומנים.
          </div>
          <div style="display:grid;gap:10px">
             <div id="sp-mu-free-wrap" style="margin-top:4px"></div>
             <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="fg"><label style="font-size:.7rem;font-weight:700">מפצה על תאריך</label><input type="date" id="sp-mu-orig" value="${s.d}" readonly style="width:100%;background:#f5f5f5;color:#666;padding:4px;border-radius:4px;border:1px solid #ccc"></div>
                <div class="fg"><label style="font-size:.7rem;font-weight:700">תאריך השלמה *</label><input type="date" id="sp-mu-date" value="${window.td()}" style="width:100%;border:1px solid #ffb74d;padding:4px;border-radius:4px" onchange="window.spMuDateChg()"></div>
             </div>
             <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="fg"><label style="font-size:.7rem;font-weight:700">שעה *</label><input type="time" id="sp-mu-time" value="${s.t||''}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>
                <div class="fg">
                  <select id="sp-mu-act" onchange="window.spMuActChg()" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc">
                    <option value="">בחר פעילות...</option>
                    ${initialActs.map(a => `<option value="${a}" ${s.act===a?'selected':''}>${a}</option>`).join('')}
                    <option value="__new__">➕ הוסף פעילות חדשה...</option>
                  </select>
                </div>
             </div>
             <div id="sp-mu-act-new-wrap" style="display:none;margin-bottom:8px">
                <label style="font-size:.7rem;font-weight:700;color:#e65100">שם פעילות חדשה</label>
                <input type="text" id="sp-mu-act-new" placeholder="הכנס שם פעילות..." style="width:100%;padding:6px;border-radius:4px;border:1px solid #ffb74d">
             </div>
             <div class="fg">
                <label style="font-size:.7rem;font-weight:700;color:#e65100">ספק מבצע</label>
                <select id="sp-mu-sup" onchange="window.spMuSupChg()" style="width:100%;padding:6px;border-radius:4px;border:1px solid #ffb74d;font-weight:700;background:#fff8f0">
                  ${allSups.map(sup => `<option value="${sup.name}" ${window.supBase(sup.name)===window.supBase(s.a)?'selected':''}>${sup.name}</option>`).join('')}
                </select>
             </div>
             <div id="sp-mu-partners-wrap" style="margin-top:5px;border:1px solid #eee;border-radius:8px;padding:8px;background:#fafafa"></div>
             <button class="btn borange bsm" style="width:100%;padding:10px;font-weight:800;margin-top:5px" onclick="window.spSaveMakeup()">🚀 בצע שיבוץ השלמה למסומנים</button>
          </div>
       </div>
    </div>
  </div>`;

  // --- STEP 8: Manual Edit ---
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

function toggleSpAccordion(id, forceState = null){
  const el = document.getElementById(id);
  const arrow = document.getElementById(id + '-arrow');
  if(!el) return;
  
  const isCurrentlyOpen = el.style.display !== 'none';
  const shouldOpen = forceState !== null ? forceState : !isCurrentlyOpen;
  
  document.querySelectorAll('[id^="sp-acc-"]').forEach(acc => {
    if(acc.id !== id && !acc.id.endsWith('-wrap')) {
      acc.style.display = 'none';
      const otherArrow = document.getElementById(acc.id + '-arrow');
      if(otherArrow) otherArrow.style.transform = 'rotate(0deg)';
    }
  });

  el.style.display = shouldOpen ? 'block' : 'none';
  if(arrow) arrow.style.transform = shouldOpen ? 'rotate(180deg)' : 'rotate(0deg)';
  if(shouldOpen) el.scrollIntoView({behavior: 'smooth', block: 'nearest'});
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

function deleteSingleActivity(id) {
  const s = window.SCH.find(x => x.id == id);
  if(!s) return;
  const g = window.G(s.g);
  if(!confirm(`האם למחוק את השיבוץ של גן ${g.name} בתאריך ${window.fD(s.d)} לצמיתות?`)) return;
  
  const i = window.SCH.indexOf(s);
  if(i >= 0) window.SCH.splice(i, 1);
  
  // Also check for partner sync
  const pair = window.gardenPair(s.g);
  if(pair) {
    const pEv = window.findPartnerActivity ? window.findPartnerActivity(pair.ids.find(pid => Number(pid) !== Number(s.g)), s.d, s.a) : null;
    if(pEv && confirm(`האם למחוק גם את השיבוץ המקביל בגן בן-הזוג (${window.G(pEv.g).name})?`)) {
      const pi = window.SCH.indexOf(pEv);
      if(pi >= 0) window.SCH.splice(pi, 1);
    }
  }
  
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

function markNoHap(id){
  const targetId = id || window.selEv;
  window.openNohapQ(targetId);
}
window.markNoHap = markNoHap;

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
    const syncChk = document.getElementById('sp-sync-global') || document.getElementById('sp-sync-pair');
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
  } catch(err) { console.error('[setStatus]', err); window.saveAndRefresh('sp', true); }
}
window.setStatus = setStatus;

function saveNt(){
  const s=window.SCH.find(x=>x.id==window.selEv); if(!s) return;
  const ntEl=document.getElementById('sp-nt');
  const nEl=document.getElementById('sp-n');
  const syncChk = document.getElementById('sp-sync-global') || document.getElementById('sp-sync-pair');
  
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
  if(syncChk && syncChk.checked) {
    const pair = window.gardenPair(s.g);
    if(pair) {
      pair.ids.forEach(pId => {
        if(pId === s.g) return;
        const pEv = window.findPartnerActivity(pId, s.d, s.a);
        if(pEv) {
          pEv.nt = s.nt;
          pEv.st = s.st;
        }
      });
    }
  }

  if(nEl) {
    s.n=nEl.value;
    const isM = !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה|makeup/i.test(s.nt)));
    const isP = !!s._postFrom;
    if(s._recId && !isM && !isP) {
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
    const cluster = window.clusters ? Object.values(window.clusters).find(c => c.gids && c.gids.map(Number).includes(Number(s.g))) : null;
    
    const allPartnerIds = new Set();
    if(pair) pair.ids.forEach(id => allPartnerIds.add(Number(id)));
    if(cluster) cluster.gids.forEach(id => allPartnerIds.add(Number(id)));
    allPartnerIds.delete(Number(s.g));

    allPartnerIds.forEach(ogid => {
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

  window.saveAndRefresh('sp', true);
  } catch(err) { console.error('[markCompManual]', err); window.saveAndRefresh('sp', true); }
}

function markCompQuick(id){
  try {
    const s=window.SCH.find(x=>x.id==id); if(!s) return;
    const stamp = 'quick_' + Date.now();
    s._compByMakeup = stamp;
    
    // Sync with partners automatically if it's a pair/cluster (silent sync)
    const pair = window.gardenPair(s.g);
    const cluster = window.clusters ? Object.values(window.clusters).find(c => c.gids && c.gids.map(Number).includes(Number(s.g))) : null;
    if(pair || cluster){
      const gids = new Set();
      if(pair) pair.ids.forEach(i => gids.add(Number(i)));
      if(cluster) cluster.gids.forEach(i => gids.add(Number(i)));
      window.SCH.forEach(p => {
        if(p.d===s.d && p.t===s.t && window.supBase(p.a)===window.supBase(s.a) && gids.has(Number(p.g))){
          p._compByMakeup = stamp;
        }
      });
    }

    window.save();
    if(window.updCounts) window.updCounts();
    window.renderDash();
    if(window.showToast) window.showToast('✅ סומן כטופל');
  } catch(e){ console.error(e); }
}
window.markCompQuick = markCompQuick;

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
  if(window.renderCal) window.renderCal();
  if(window.currentTab==='sched' && window.renderSched) window.renderSched();
}

async function saveAndRefresh(modalId, stayOpen = false, immediate = true){
  const ok = await window.save(immediate);
  if(!stayOpen) {
    if(modalId) window.CM(modalId);
    if(modalId === 'sp' || modalId === 'sp-m') closeSP();
  }
  window.refresh();
  if(stayOpen && (modalId === 'sp' || modalId === 'sp-m') && window.selEv) {
    window.openSP(window.selEv);
  }
  return ok;
}

function openMakeupSched(origId){
  const orig=window.SCH.find(s=>String(s.id)==String(origId)); if(!orig) return;
  window._makeupOrigId = origId;
  window.openSP(origId);
  
  // Use a more robust check to ensure the makeup accordion exists before triggering
  let attempts = 0;
  const checkAndTrigger = () => {
    const muWrap = document.getElementById('sp-acc-makeup-wrap');
    if(muWrap) {
      window.spTriggerMakeupUI();
    } else if (attempts < 10) {
      attempts++;
      setTimeout(checkAndTrigger, 100);
    }
  };
  setTimeout(checkAndTrigger, 100);
}

window.spTriggerMakeupUI = function() {
  console.log('[spTriggerMakeupUI] Activating makeup interface...');
  const muWrap = document.getElementById('sp-acc-makeup-wrap');
  if(muWrap) muWrap.style.display = 'block';
  window.toggleSpAccordion('sp-acc-makeup', true);
  window.spMuSupChg();
  window.spMuDateChg();
};

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

  const newEv1 = {
    ...s, id:newId1, d:newDate, t:s.t, a:newSup||s.a, act:newAct||s.act, st:'ok', 
    pd:'', pt:'', _postFrom: s.d, _isMakeup: true,
    nt: (s.nt ? s.nt + ' | ' : '') + 'השלמה מיום ' + window.fD(s.d)
  };
  delete newEv1._recId;
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
    const newPtEv = {
      ...ptEv, id:newSynId, d:newDate, t:conf.syn.t || ptEv.t, a:newSup||s.a, act:newAct||s.act, st:'ok', 
      pd:'', pt:'', _postFrom: s.d, _isMakeup: true,
      nt: (ptEv.nt ? ptEv.nt + ' | ' : '') + 'השלמה מיום ' + window.fD(s.d)
    };
    delete newPtEv._recId;
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
  delete newEv1._recId;
  window.SCH.push(newEv1);
  
  // Synergy
  const synergyPartners = typeof window.getSynergyData === 'function' ? window.getSynergyData('copy') : [];
  synergyPartners.forEach((syn, idx) => {
    const newPtEv = {...s, id:Date.now() + idx + 1, g:syn.g, d:newDate, t:syn.t || primaryTime || s.t, st:'ok', pd:'', pt:'', cr:'', cn:''};
    delete newPtEv._recId;
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
      const timeInput = document.querySelector(`.${prefix}-syn-time[data-gid="${pId}"]`);
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
window.deleteSingleActivity = deleteSingleActivity;
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

// The openNohapQ modal is defined in core.js. 
// We don't need to override it here anymore as core.js now respects window._spSyncPartnerNext

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

window.openWA = function(phone) {
  if(!phone) { console.warn('openWA: No phone number provided'); return; }
  console.log('openWA: Opening WhatsApp for', phone);
  const clean = phone.replace(/\D/g, '');
  const target = clean.startsWith('972') ? clean : '972' + clean.replace(/^0/, '');
  window.open(`https://wa.me/${target}`, '_blank');
};

// Removed redundant renderDash trigger to stabilize UI
// setTimeout(() => { if (typeof renderDash === 'function') renderDash(); }, 100);

window.spMuSupChg = function() {
  const sup = document.getElementById('sp-mu-sup').value;
  const actSel = document.getElementById('sp-mu-act');
  if(!actSel) return;
  const sid = window.selEv;
  const s = window.SCH.find(x => x.id == sid);
  const acts = window.getSupActs(sup);
  actSel.innerHTML = '<option value="">בחר פעילות...</option>' + 
    acts.map(a => `<option value="${a}" ${s && a===s.act ? 'selected' : ''}>${a}</option>`).join('') +
    '<option value="__new__">➕ הוסף פעילות חדשה...</option>';
  
  // Hide new activity input on supplier change
  const wrap = document.getElementById('sp-mu-act-new-wrap');
  if(wrap) wrap.style.display = 'none';
};

window.spMuActChg = function() {
  const v = document.getElementById('sp-mu-act').value;
  const wrap = document.getElementById('sp-mu-act-new-wrap');
  if(wrap) wrap.style.display = v === '__new__' ? 'block' : 'none';
};

window.spMuDateChg = function() {
  const dateEl = document.getElementById('sp-mu-date');
  if(!dateEl) return;
  const date = dateEl.value;
  const sid = window.selEv;
  const s = window.SCH.find(x => x.id == sid);
  if(!date || !s) return;
  
  window.spUpdateMakeupPartnersTable(s.g, date, s.id);
  window.spShowFreeDays(s.g);
};

window.updateMakeupPartnersTable = function(containerId, gid, date, aid) {
  console.log('[updateMakeupPartnersTable]', {containerId, gid, date, aid});
  const pair = window.gardenPair(gid);
  const cluster = window.CLUSTERS ? window.CLUSTERS.find(c => c.gids && c.gids.map(Number).includes(Number(gid))) : null;
  
  const allPartnerIds = new Set();
  if(pair) pair.ids.forEach(id => allPartnerIds.add(Number(id)));
  if(cluster) cluster.gids.forEach(id => allPartnerIds.add(Number(id)));
  allPartnerIds.delete(Number(gid));
  
  const container = document.getElementById(containerId);
  if(!container) return;
  
  if(allPartnerIds.size === 0) {
    container.innerHTML = `<div style="font-size:0.7rem;color:#777;padding:12px;text-align:center;background:#fff;border-radius:8px;border:1px dashed #ffb74d">ℹ️ אין גנים שותפים לסנכרון אוטומטי (גן בודד)</div>`;
    return;
  }
  
  const otherIds = Array.from(allPartnerIds);
  let rowsHtml = '';
  const prefix = containerId.startsWith('ns') ? 'ns-mu' : 'sp-mu';

  otherIds.forEach(pId => {
    const pG = window.G(pId);
    if(!pG) return;
    const ev = window.SCH.find(s => s.g === pId && s.d === date && s.st !== 'can');
    const stLabel = ev ? (window.stLabel ? window.stLabel(ev) : ev.st) : '—';
    const stClass = ev ? (window.stClass ? window.stClass(ev) : '') : '';
    const sup = ev ? window.supBase(ev.a) : '—';
    const act = ev ? (ev.act || '—') : '—';
    const time = ev ? (window.fT ? window.fT(ev.t) : ev.t) : '—';
    const makeupTime = document.getElementById(prefix.startsWith('sp') ? 'sp-mu-time' : 'ns-mu-time')?.value || (ev ? ev.t : '14:00');
    
    rowsHtml += `<tr style="border-bottom:1px solid #eee;font-size:0.75rem;background:${stClass==='busy'?'#fff9f9':'#fff'}">
      <td style="padding:6px;text-align:center"><input type="checkbox" class="${prefix}-syn-chk" value="${pId}" checked style="width:16px;height:16px;accent-color:#e65100"></td>
      <td style="padding:6px;font-weight:700">${pG.name}</td>
      <td style="padding:6px">
        <input type="time" class="${prefix}-syn-time" data-gid="${pId}" value="${makeupTime}" style="width:75px;padding:2px;border:1px solid #ccc;border-radius:4px;font-size:0.7rem">
      </td>
      <td style="padding:6px">${sup}</td>
      <td style="padding:6px">${act}</td>
      <td style="padding:6px;text-align:center"><span class="badge ${stClass}">${stLabel}</span></td>
    </tr>`;
  });
  
  container.innerHTML = `
    <div style="font-size:0.75rem;font-weight:700;color:#546e7a;margin-bottom:6px">🔗 שותפים לסנכרון השלמה:</div>
    <div class="tw" style="border:1px solid #ffcc80;border-radius:6px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse;text-align:right">
        <thead style="background:#fff3e0;color:#bf360c">
          <tr><th style="padding:6px;width:30px"><input type="checkbox" checked onclick="const cbs=document.querySelectorAll('.${prefix}-syn-chk'); cbs.forEach(cb=>cb.checked=this.checked)"></th><th style="padding:6px">גן</th><th style="padding:6px">שעה</th><th style="padding:6px">ספק</th><th style="padding:6px">פעילות</th><th style="padding:6px">סטטוס</th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
};

window.spUpdateMakeupPartnersTable = function(gid, date, aid) {
    window.updateMakeupPartnersTable('sp-mu-partners-wrap', gid, date, aid);
};

window.spShowFreeDays = function(gid) {
  window.showFreeDaysForMakeup('sp-mu-free-wrap', gid, (ds) => {
    document.getElementById('sp-mu-date').value = ds;
    window.spMuDateChg();
  });
};

window.showFreeDaysForMakeup = function(containerId, gid, onSelect) {
  const container = document.getElementById(containerId);
  if(!container) return;
  
  const DAY_HEB=['ראשון','שני','שלישי','רביעי','חמישי'];
  const g = window.G(gid);
  if(!g) { container.innerHTML = ''; return; }

  const busyDates = new Set(window.SCH.filter(x => {
    if(Number(x.g) !== Number(gid)) return false;
    if(x.st === 'can' || x.st === 'nohap' || x.st === 'post') return false;
    return true;
  }).map(x=>x.d));
  
  const free = []; let d = new Date(); d.setHours(0,0,0,0);
  const isMakeup = true;
  
  for(let i=0; i<21; i++) {
    const dow = d.getDay();
    if(dow >= 0 && dow <= 4) {
      const ds = window.d2s(d);
      const hol = window.getHolidayInfo(ds, g.city, window.gcls(g));
      const isToday = i === 0;
      if(!busyDates.has(ds) && (!hol || isToday)) {
        let label = DAY_HEB[dow] + ' ' + window.fD(ds);
        if(hol) label += ` (${hol.name})`;
        free.push({ds, lbl: label});
      }
    }
    d.setDate(d.getDate() + 1);
  }
  
  if(free.length) {
    container.innerHTML = `<div style="font-size:0.65rem;font-weight:800;color:#2e7d32;margin-bottom:4px">ימים פנויים:</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
      ${free.map(f => `<button class="btn bg bsm" style="font-size:0.68rem;padding:2px 6px;background:#e8f5e9;color:#2e7d32;border:1px solid #c8e6c9" onclick="window._tmpOnSelect('${f.ds}')">${f.lbl}</button>`).join('')}
    </div>`;
    window._tmpOnSelect = onSelect;
  } else {
    container.innerHTML = '';
  }
};

window.spSaveMakeup = function() {
  const sid = window.selEv;
  const origEv = window.SCH.find(x => x.id == sid);
  if(!origEv) return;
  
  const newDate = document.getElementById('sp-mu-date').value;
  const time = document.getElementById('sp-mu-time').value;
  const supName = document.getElementById('sp-mu-sup').value || origEv.a;
  
  if(!newDate || !time) { alert('בחר תאריך ושעה'); return; }
  
  const targets = [{ g: origEv.g, t: time }, ...window.getSynergyData('sp-mu')];
  
  const actVal = document.getElementById('sp-mu-act').value;
  const actName = actVal === '__new__' ? (document.getElementById('sp-mu-act-new')||{}).value : (actVal || origEv.act);
  
  if(actVal === '__new__' && actName) {
    const base = window.supBase(supName);
    if(!window.supEx[base]) window.supEx[base] = {};
    if(!window.supEx[base].acts) window.supEx[base].acts = window.getSupActs(supName);
    if(!window.supEx[base].acts.includes(actName)) {
      window.supEx[base].acts.push(actName);
    }
  }
  
  if(!confirm(`לבצע שיבוץ השלמה ל-${targets.length} גנים בתאריך ${window.fD(newDate)}?`)) return;
  
  targets.forEach(tgt => {
    window.createMakeupActivity({
      g: tgt.g,
      d: newDate,
      t: tgt.t,
      a: supName,
      act: actName,
      tp: origEv.tp || 'חוג',
      origD: origEv.d,
      origId: sid
    });
  });
  
  window.saveAndRefresh('sp', true);
  window.showToast('✅ שיבוץ ההשלמה בוצע בהצלחה');
}

window.createMakeupActivity = function(data) {
  const loopId = Date.now() + Math.random();
  const makeupNote = `השלמה על ${window.fD(data.origD)}`;
  const fullNote = data.notes ? data.notes + ' | ' + makeupNote : makeupNote;
  
  const newEv = {
    id: loopId,
    g: data.g,
    d: data.d,
    t: data.t,
    a: data.a,
    act: data.act,
    tp: data.tp || 'חוג',
    st: 'ok',
    nt: fullNote,
    grp: data.grp || 1,
    _isMakeup: true,
    _makeupFrom: data.origD
  };
  
  window.SCH.push(newEv);
  
  // Link back to original
  if(data.origId) {
    const origExt = window.SCH.find(x => String(x.id) === String(data.origId));
    if(origExt) {
       origExt._compByMakeup = loopId;
       const noticeNote = `השלמה נקבעה ל-${window.fD(data.d)}`;
       if(!origExt.nt || !origExt.nt.includes(noticeNote)) {
          origExt.nt = (origExt.nt ? origExt.nt + ' | ' : '') + noticeNote;
       }
       
       // Sync partner's completion status if applicable
       const pair = window.gardenPair(origExt.g);
       const cluster = window.clusters ? Object.values(window.clusters).find(c => c.gids && c.gids.map(Number).includes(Number(origExt.g))) : null;
       
       const allPartnerIds = new Set();
       if(pair) pair.ids.forEach(id => allPartnerIds.add(Number(id)));
       if(cluster) cluster.gids.forEach(id => allPartnerIds.add(Number(id)));
       allPartnerIds.delete(Number(origExt.g));

       allPartnerIds.forEach(partnerId => {
         const partnerEv = window.SCH.find(ps => 
           Number(ps.g)===Number(partnerId) && ps.d === origExt.d && 
           window.supBase(ps.a) === window.supBase(origExt.a) && !ps._compByMakeup
         );
           if(partnerEv) {
              partnerEv._compByMakeup = loopId;
              if(!partnerEv.nt || !partnerEv.nt.includes(noticeNote)) {
                 partnerEv.nt = (partnerEv.nt ? partnerEv.nt + ' | ' : '') + noticeNote;
              }
           }
         });
       }
    }
  
  window.SCH.push(newEv);
  return loopId;
};

// Quick action handlers (moved from core.js or centralized here)
function qSetSt(id, st) {
  if (st === 'done') window.markCompQuick(id);
  else if (st === 'can') window.openCanQ(id);
  else if (st === 'nohap') window.markNoHap(id);
}
window.qSetSt = qSetSt;

// Global Exports
window.saveAndRefresh = saveAndRefresh;
window.openMakeupSched = openMakeupSched;
window.closeSP = closeSP;
window.refresh = refresh;
window.setStatus = setStatus;
window.markCompManual = markCompManual;
window.openPostpone = openPostpone;
window.openCopy = openCopy;
window.doPostpone = doPostpone;
window.doCopy = doCopy;
window.renderCanList = renderCanList;
window.toggleSpAccordion = toggleSpAccordion;
window.toggleSpRecurBox = toggleSpRecurBox;
window.showSpSaved = showSpSaved;
window.toggleSpEdit = toggleSpEdit;
window.spEditSupChg = spEditSupChg;
window.spEditActChg = spEditActChg;
window.deleteRecurSeries = deleteRecurSeries;
window.deleteSingleActivity = deleteSingleActivity;
window.openReplaceRecur = openReplaceRecur;
window.rrSupChg = rrSupChg;
window.saveReplaceRecur = saveReplaceRecur;
window.spEditSave = spEditSave;
window.setSpActionTab = setSpActionTab;
window.spTogglePairDetails = spTogglePairDetails;
window.cancelEv = cancelEv;
window.markNoHap = markNoHap;
window.saveNt = saveNt;
window.updAndRefresh = updAndRefresh;
window.renderPartnerSynergy = renderPartnerSynergy;
window.getSynergyData = getSynergyData;
window.postDateChg = postDateChg;
window.setDashTab = setDashTab;
window.setDashView = setDashView;
window.renderDash = renderDash;

// ── Activity Exception Modals ───────────────────────────
let _canQId = null;
window.openCanQ = function(id) {
  _canQId = id;
  const s = window.SCH.find(x => x.id == id); if (!s) return;
  const g = window.G(s.g);
  const infoEl = document.getElementById('canq-info');
  if(infoEl) infoEl.innerHTML = `<b>${g.name}</b> · ${g.city} · ${s.a}${s.act?' · '+s.act:''}<br>📅 ${window.fD(s.d)} ${s.t?'⏰ '+window.fT(s.t):''}`;
  const noteEl = document.getElementById('canq-note');
  if(noteEl) noteEl.value = '';
  document.querySelectorAll('.can-reason-btn').forEach(b => b.classList.remove('sel'));
  
  const pair = window.gardenPair(s.g);
  const wrap = document.getElementById('canq-scope-wrap');
  const btns = document.getElementById('canq-scope-btns');
  if (pair && btns && wrap) {
    const partners = pair.ids.filter(gid=>gid!==s.g).map(gid=>window.G(gid)).filter(x=>x.id);
    const allNames = [g,...partners].map(x=>x.name).join(' + ');
    const pairChecked = (window._spSyncPartnerNext === true);
    btns.innerHTML =
      `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.8rem;padding:4px 6px;border-radius:5px;border:1.5px solid #e0e0e0;background:#fff">
        <input type="radio" name="canq-scope" value="solo" ${pairChecked?'':'checked'} style="accent-color:#c62828">
        <span>🏫 <b>${g.name}</b> בלבד</span>
      </label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.8rem;padding:4px 6px;border-radius:5px;border:1.5px solid #e0e0e0;background:#fff">
        <input type="radio" name="canq-scope" value="pair" ${pairChecked?'checked':''} style="accent-color:#c62828">
        <span>🔗 כל הזוג — <b>${allNames}</b></span>
      </label>`;
    wrap.style.display = pairChecked ? 'none' : 'block';
  } else if(wrap) {
    wrap.style.display = 'none';
  }
  const modal = document.getElementById('canqm');
  if(modal) modal.classList.add('open');
};

window.selCanReason = function(btn, reason) {
  document.querySelectorAll('.can-reason-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  const noteEl = document.getElementById('canq-note');
  if (reason === 'אחר' && noteEl) noteEl.focus();
};

window.saveCanQ = function() {
  const sel = document.querySelector('.can-reason-btn.sel');
  const mainReason = sel ? sel.dataset.r : '';
  const extra = (document.getElementById('canq-note')||{}).value?.trim() || '';
  const fullReason = [mainReason, extra].filter(Boolean).join(' — ');
  if (!mainReason && !extra) { alert('יש לבחור סיבת ביטול'); return; }
  
  const scopeEl = document.querySelector('input[name="canq-scope"]:checked');
  const forPair = (scopeEl && scopeEl.value === 'pair') || (window._spSyncPartnerNext === true);
  
  const s = window.SCH.find(x => x.id == _canQId); if (!s) return;
  const doCancel = (evId) => {
    const ev = window.SCH.find(x => x.id == evId); if (!ev) return;
    ev.st = 'can'; ev.cr = mainReason || 'בוטל'; ev.cn = extra;
    const noteAdd = '❌ בוטל: ' + fullReason;
    if (!(ev.nt||'').includes(noteAdd)) {
      ev.nt = ev.nt ? ev.nt + ' | ' + noteAdd : noteAdd;
    }
  };
  
  // Find all selected IDs if this was a batch action
  const selectedIds = new Set();
  document.querySelectorAll('.dash-row-chk:checked').forEach(cb => selectedIds.add(cb.value));
  if (selectedIds.size === 0) selectedIds.add(_canQId);

  selectedIds.forEach(id => {
    const ev = window.SCH.find(x => x.id == id);
    if (!ev) return;
    doCancel(id);
    if(forPair){
      const pair = window.gardenPair(ev.g);
      if(pair) pair.ids.filter(gid => Number(gid) !== Number(ev.g)).forEach(gid => {
        const pEv = window.findPartnerActivity(gid, ev.d, ev.a);
        if(pEv && pEv.st !== 'can') doCancel(pEv.id);
      });
    }
  });
  
  window.saveAndRefresh('canqm', true);

  // Prompt for makeup
  setTimeout(() => {
    if (confirm('🎨 האם ברצונך לקבוע שיעור השלמה כעת?')) {
      window.openMakeupSched(_canQId);
    }
  }, 500);
};

let _cancelDayDs = null;
window.openCancelDay = function(ds) {
  _cancelDayDs = ds || window.td();
  const dateEl = document.getElementById('cancelday-date');
  if(dateEl) dateEl.value = _cancelDayDs;
  const noteEl = document.getElementById('cancelday-note');
  if(noteEl) noteEl.value = '';
  document.querySelectorAll('.cancelday-reason-btn').forEach(b => b.classList.remove('sel'));
  window._updateCancelDayCnt();
  const modal = document.getElementById('cancelday-m');
  if(modal) modal.classList.add('open');
};

window._updateCancelDayCnt = function() {
  const cnt = window.SCH.filter(s => s.d === _cancelDayDs && s.st !== 'can').length;
  const el = document.getElementById('cancelday-cnt');
  if (!el) return;
  el.textContent = cnt > 0 ? `נמצאו ${cnt} פעילויות ביום זה שיבוטלו` : 'אין פעילויות פעילות ביום זה';
  el.style.color = cnt > 0 ? '#c62828' : '#888';
};

window.cancelDayDateChg = function() {
  _cancelDayDs = (document.getElementById('cancelday-date')||{}).value;
  window._updateCancelDayCnt();
};

window.selCancelDayReason = function(btn) {
  document.querySelectorAll('.cancelday-reason-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  if (btn.dataset.r === 'אחר') {
    const noteEl = document.getElementById('cancelday-note');
    if(noteEl) noteEl.focus();
  }
};

window.saveCancelDay = function() {
  const sel = document.querySelector('.cancelday-reason-btn.sel');
  const mainReason = sel?.dataset.r || '';
  const extra = (document.getElementById('cancelday-note')||{}).value?.trim() || '';
  const fullReason = [mainReason, extra].filter(Boolean).join(' — ');
  if (!fullReason) { alert('יש לבחור סיבה'); return; }
  if (!_cancelDayDs) return;
  
  const toCancel = window.SCH.filter(s => s.d === _cancelDayDs && s.st !== 'can');
  if (toCancel.length === 0) { window.showToast('אין פעילויות לביטול ביום זה'); window.CM('cancelday-m'); return; }
  if (!confirm(`לבטל ${toCancel.length} פעילויות בתאריך ${window.fD(_cancelDayDs)}?\nסיבה: ${fullReason}`)) return;
  
  toCancel.forEach(s => {
    s.st = 'can'; s.cr = mainReason || 'בוטל'; s.cn = extra;
    const noteAdd = '❌ בוטל: ' + fullReason;
    s.nt = s.nt ? s.nt + ' | ' + noteAdd : noteAdd;
  });
  const icon = mainReason.includes('שביתה')?'✊':mainReason.includes('מלחמה')||mainReason.includes('מצב')?'🚨':mainReason.includes('חג')?'🕍':'🚫';
  if(!window.blockedDates) window.blockedDates = {};
  window.blockedDates[_cancelDayDs] = { reason: fullReason, note: extra, icon };
  window.saveAndRefresh('cancelday-m');
  window.showToast(`❌ בוטלו ${toCancel.length} פעילויות — ${window.fD(_cancelDayDs)}`);
};

let _nohapQId=null;
window.openNohapQ = function(id){
  _nohapQId=id;
  const s=window.SCH.find(x=>x.id==id); if(!s) return;
  const g=window.G(s.g);
  const infoEl = document.getElementById('nohapq-info');
  if(infoEl) infoEl.innerHTML = `<b>${g.name}</b> מ-${g.city} | ${s.a}${s.act?' - '+s.act:''}<br>בתאריך ${window.fD(s.d)} ${s.t?'בשעה '+window.fT(s.t):''}`;
  const reasonEl = document.getElementById('nohapq-reason');
  if(reasonEl) reasonEl.value='';
  document.querySelectorAll('.nohap-reason-btn').forEach(b=>b.classList.remove('sel'));

  const pair=window.gardenPair(s.g);
  const scopeWrap=document.getElementById('nohapq-scope-wrap');
  const scopeBtns=document.getElementById('nohapq-scope-btns');
  if(pair && scopeBtns && scopeWrap){
    const partners=pair.ids.filter(gid=>gid!==s.g).map(gid=>window.G(gid)).filter(x=>x.id);
    scopeBtns.innerHTML='';
    const allNames=[g,...partners].map(x=>x.name).join(' + ');
    const pairChecked = (window._spSyncPartnerNext === true);
    scopeBtns.innerHTML+=`<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.8rem;padding:4px 6px;border-radius:5px;border:1.5px solid #e0e0e0;background:#fff">
      <input type="radio" name="nohapq-scope" value="solo" ${pairChecked?'':'checked'} style="accent-color:#e91e63">
      <span>🏫 <b>${g.name}</b> בלבד</span>
    </label>`;
    scopeBtns.innerHTML+=`<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.8rem;padding:4px 6px;border-radius:5px;border:1.5px solid #e0e0e0;background:#fff">
      <input type="radio" name="nohapq-scope" value="pair" ${pairChecked?'checked':''} style="accent-color:#e91e63">
      <span>🔗 כל הזוג — <b>${allNames}</b></span>
    </label>`;
    scopeWrap.style.display = pairChecked ? 'none' : 'block';
  } else if(scopeWrap) {
    scopeWrap.style.display='none';
  }
  const modal = document.getElementById('nohapqm');
  if(modal) modal.classList.add('open');
};

window.selNohapReason = function(btn, reason){
  document.querySelectorAll('.nohap-reason-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  const inp = document.getElementById('nohapq-reason');
  if (reason === 'אחר' && inp) inp.focus();
  else if(inp) inp.placeholder = reason;
};

window.saveNohapQ = function(){
  const sel = document.querySelector('.nohap-reason-btn.sel');
  const mainReason = sel ? (sel.dataset.r || sel.textContent.replace(/^\S+ /,'').trim()) : '';
  const extra = (document.getElementById('nohapq-reason')||{}).value?.trim() || '';
  const fullReason=[mainReason,extra].filter(Boolean).join(' — ');
  if(!mainReason&&!extra){alert('יש לבחור סיבה');return;}
  
  const scopeEl=document.querySelector('input[name="nohapq-scope"]:checked');
  const forPair=(scopeEl&&scopeEl.value==='pair') || (window._spSyncPartnerNext === true);
  
  const s = window.SCH.find(x => x.id == _nohapQId); if(!s) return;
  const doNohap = (evId) => {
    const ev = window.SCH.find(x => x.id == evId); if(!ev) return;
    ev.st = 'nohap';
    const noteAdd = '⚠️ לא התקיים: ' + fullReason;
    if (!(ev.nt||'').includes(noteAdd)) {
      ev.nt = ev.nt ? ev.nt + ' | ' + noteAdd : noteAdd;
    }
  };
  
  // Find all selected IDs if this was a batch action
  const selectedIds = new Set();
  document.querySelectorAll('.dash-row-chk:checked').forEach(cb => selectedIds.add(cb.value));
  if (selectedIds.size === 0) selectedIds.add(_nohapQId);

  selectedIds.forEach(id => {
    const ev = window.SCH.find(x => x.id == id);
    if (!ev) return;
    doNohap(id);
    if(forPair){
      const pair = window.gardenPair(ev.g);
      if(pair) pair.ids.filter(gid => Number(gid) !== Number(ev.g)).forEach(gid => {
        const pEv = window.findPartnerActivity(gid, ev.d, ev.a);
        if(pEv && pEv.st !== 'nohap' && pEv.st !== 'done') doNohap(pEv.id);
      });
    }
  });

  window.saveAndRefresh('nohapqm', true);
  
  // Prompt for makeup
  setTimeout(() => {
    if (confirm('🎨 האם ברצונך לקבוע שיעור השלמה כעת?')) {
      window.openMakeupSched(_nohapQId);
    }
  }, 500);
};
