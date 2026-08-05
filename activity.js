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

    if (city && g.city !== city) return false;
    if (sup && window.supBase(s.a) !== sup) return false;
    if (srch && ![(g.name||''), (g.city||''), s.a, s.act, s.nt].some(v=>(v||'').toLowerCase().includes(srch))) return false;

    const isHandled = !!(s._compByMakeup && s._compByMakeup !== "false") || !!((s.nt && /הוקדם ל|נדחה ל|הוזז ל|הקדמה ל|דחייה ל|עבר ל|עובר ל|הועבר ל/i.test(s.nt)) || (s.n && /הוקדם ל|נדחה ל|הוזז ל|הקדמה ל|דחייה ל|עבר ל|עובר ל|הועבר ל/i.test(s.n)));
    const isM = !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.nt)) || (s.n && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.n)) || (s.a && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.a)));

    if (view === 'todo') {
      if (isHandled) return false; // Hide if already handled
      if (s.st !== 'nohap' && s.st !== 'post') return false; // Show only shortages, DO NOT show cancellations (can)
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

  // Group by City and Classification
  const groups = {};
  filtered.forEach(s => {
    const g = window.G(s.g);
    const c = g.city || 'אחר';
    const gClass = window.gcls ? window.gcls(g) : 'גנים';
    const key = `${c} - ${gClass}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  const openCities = new Set();
  document.querySelectorAll('.dash-city-accordion[open]').forEach(det => {
    const cityTitle = det.querySelector('summary span:nth-child(2)')?.textContent?.substring(2).trim();
    if (cityTitle) openCities.add(cityTitle);
  });

  let html = '';

  const todayStr = window.td ? window.td() : new Date().toISOString().split('T')[0];
  const todayPostponed = (window.SCH || []).filter(s => {
    const isHandled = !!(s._compByMakeup && s._compByMakeup !== "false") || !!((s.nt && /הוקדם ל|נדחה ל|הוזז ל|הקדמה ל|דחייה ל|עבר ל|עובר ל|הועבר ל/i.test(s.nt)) || (s.n && /הוקדם ל|נדחה ל|הוזז ל|הקדמה ל|דחייה ל|עבר ל|עובר ל|הועבר ל/i.test(s.n)));
    return s.st === 'post' && s.d === todayStr && !isHandled;
  });

  if (todayPostponed.length > 0) {
    html += `<div style="background:#fff3cd; color:#856404; border:1px solid #ffeeba; padding:12px 15px; border-radius:8px; margin-bottom:15px; font-weight:bold; display:flex; align-items:center; gap:10px; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
        <span style="font-size:1.8rem">⚠️</span>
        <div>
          <div style="font-size:1.1rem;margin-bottom:4px">שימו לב: ${todayPostponed.length} דחיות מהיום להיום!</div>
          <div style="font-size:0.85rem;font-weight:normal">יש לוודא עדכון מול הרכזים וההורים על פעילויות שנדחו היום.</div>
        </div>
     </div>`;
  }

  Object.keys(groups).sort().forEach((groupKey, idx) => {
    const cityEvs = groups[groupKey];
    const parts = groupKey.split(' - ');
    const cityName = parts[0];
    const gClass = parts[1] || 'גנים';
    const displayName = gClass === 'ביה"ס' ? `${cityName} - בתי ספר` : `${cityName} - צהרוני גנים`;
    const typeIcon = gClass === 'ביה"ס' ? '🏛️' : '🏫';
    
    const cityOpen = !!city || openCities.has(displayName); 
    const cityNameEsc = displayName.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const groupId = `dash-group-${groupKey.replace(/\s+/g, '_').replace(/"/g, '').replace(/'/g, '')}`;
    const clr = window.CITY_COLORS ? window.CITY_COLORS(cityName) : {solid:'#1a237e', light:'#f8fafc', border:'#e2e8f0'};

    html += `<details class="dash-city-accordion" ${cityOpen ? 'open' : ''}>
      <summary>
        <div style="display:flex; align-items:center; gap:12px; flex:1">
          <input type="checkbox" onclick="event.stopPropagation(); dashCheckAll('${groupId}', this.checked)" style="width:18px;height:18px">
          <span style="font-weight:800; color:#1e293b; font-size:1.1rem">${typeIcon} ${displayName}</span>
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
      html += `<div onclick="window.ST('cal'); if(window.goDate) window.goDate('${date}')" style="padding:6px 15px; background:#f8f9fa; border-bottom:1px solid #e9ecef; font-weight:700; color:#1e88e5; font-size:0.85rem; cursor:pointer;" title="קפוץ ללוח השנה בתאריך זה">📅 ${window.fD(date)} <span style="font-size:0.7rem; font-weight:normal; margin-right:6px">🔗 הצג בלוח שנה</span></div>`;
      
      const dateUsedIds = new Set();
      const dateCards = [];

      // Groups within this date
      const groupList = (window._listGroupMode === "clusters" && typeof window.getClusters === "function") ? window.getClusters().map(cl => ({...cl, ids: cl.gardenIds})) : (window.pairs || []);
      groupList.forEach(p => {
        const hasException = dateEvs.some(s => !dateUsedIds.has(String(s.id)) && p.ids.map(Number).includes(Number(s.g)));
        if (hasException) {
          const allPairEvs = dateEvs.filter(s => !dateUsedIds.has(String(s.id)) && p.ids.map(Number).includes(Number(s.g)));
          
          if (allPairEvs.length) {
            dateCards.push({ type: 'pair', obj: p, evs: allPairEvs });
            allPairEvs.forEach(s => dateUsedIds.add(String(s.id)));
          }
        }
      });

      // Standalone within this date
      dateEvs.filter(s => !dateUsedIds.has(String(s.id))).forEach(s => {
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

  if (action === 'unhandled') {
    if(!await window.spConfirm('האם להסיר את סטטוס "טופל" מהפריטים שנבחרו?')) return;
    ids.forEach(id => { window.unmarkCompQuick(id); });
    document.querySelectorAll('.dash-row-chk').forEach(cb => cb.checked = false);
    window.dashUpdateBulkBar();
    return;
  }

  const note = prompt(promptMsg);
  if (note === null) return; // User cancelled prompt

  const stamp = stampPrefix + Date.now();
  
  ids.forEach(id => {
    const s = window.SCH.find(x => x.id == id);
    if (s) {
      if (status) s.st = status;
      if (action === 'handled') {
        s._compByMakeup = stamp;
      } else {
        delete s._compByMakeup;
      }
      const nText = notePrefix + (note || (status === 'nohap' ? 'לא התקיים' : status === 'can' ? 'בוטל' : 'טופל'));
      s.nt = s.nt ? s.nt + ' | ' + nText : nText;
      
      // Sync to partners
      const pair = window.gardenPair(s.g);
      const clusterArr = window.gardenClusters ? window.gardenClusters(s.g, s.d) : [];
      
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
          if (action === 'handled') {
            ps._compByMakeup = stamp;
          } else {
            delete ps._compByMakeup;
          }
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
  
  // 1. Same date, same supplier (active)
  let pEv = window.SCH.find(ps => 
    Number(ps.g) === targetGid && normD(ps.d) === targetDate && ps.st !== 'can' &&
    (tSupBase ? window.supBase(ps.a) === tSupBase : true)
  );
  
  // 2. Fallback: Same date, any supplier (active)
  if (!pEv) {
    pEv = window.SCH.find(ps => 
      Number(ps.g) === targetGid && normD(ps.d) === targetDate && ps.st !== 'can'
    );
  }

  // 3. Fallback: Same date, same supplier (including cancelled)
  if (!pEv) {
    pEv = window.SCH.find(ps => 
      Number(ps.g) === targetGid && normD(ps.d) === targetDate &&
      (tSupBase ? window.supBase(ps.a) === tSupBase : true)
    );
  }

  // 4. Fallback: Same date, any supplier (including cancelled)
  if (!pEv) {
    pEv = window.SCH.find(ps => 
      Number(ps.g) === targetGid && normD(ps.d) === targetDate
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
function cleanMakeupNote(orig, dateStr) {
  const formattedDate = typeof window.fD === 'function' ? window.fD(dateStr) : dateStr;
  const targetStr = 'השלמה נקבעה ל-' + formattedDate;
  
  if (orig.nt) {
    orig.nt = orig.nt.split(' | ').filter(part => !part.includes(targetStr)).join(' | ').trim();
  }
  if (orig.n) {
    orig.n = orig.n.split(' | ').filter(part => !part.includes(targetStr)).join(' | ').trim();
  }
}

window.spBatchDelete = async function() {
  const ids = window.spGetSelectedIds();
  if(!ids.length) { _spAlertDialog('יש לסמן לפחות גן אחד למחיקה'); return; }
  
  const restoreMsg = window.SCH.some(x => ids.includes(String(x.id)) && x._isMakeup) ? '\n(פעילויות השלמה מסומנות יוחזרו למקוריות שלא התקיימו)' : '';
  
  if(!await window.spConfirm(`האם למחוק ${ids.length > 1 ? ids.length + ' שיבוצים מסומנים' : 'את השיבוץ המסומן'} מהלוח לצמיתות?` + restoreMsg)) return;
  
  if (!window.supEx) window.supEx = {};
  if (!window.supEx['__deleted_sraws_ids']) window.supEx['__deleted_sraws_ids'] = [];
  
  ids.forEach(id => {
    const s = window.SCH.find(x => x.id == id);
    if(!s) return;
    
    // Check for makeup restoration
    const origEvs = s._isMakeup ? window.SCH.filter(orig => String(orig._compByMakeup) === String(s.id)) : [];
    if (origEvs.length > 0) {
      origEvs.forEach(orig => {
        orig._compByMakeup = '';
        cleanMakeupNote(orig, s.d);
      });
    }
    
    const isSraws = !String(s.id).startsWith('e_');
    if (isSraws && !window.supEx['__deleted_sraws_ids'].includes(s.id)) {
      window.supEx['__deleted_sraws_ids'].push(s.id);
    }
    
    const i = window.SCH.indexOf(s);
    if(i >= 0) window.SCH.splice(i, 1);
  });
  
  window.saveAndRefresh('sp');
};

window.spBatchQSetSt = function(st) {
  const ids = window.spGetSelectedIds();
  if(ids.length) window.qSetSt(ids[0], st); 
};

window.spBatchAction = function(val) {
  const ids = window.spGetSelectedIds();
  if(!ids.length) { _spAlertDialog('יש לסמן לפחות גן אחד בטבלה'); return; }
  
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
    case 'delete':
      window.spBatchDelete();
      break;
    default:
      // Standard statuses (done, ok, can)
      window.spBatchStatus(val);
      break;
  }
};


window.spRowGrpChg = async function(id, val) {
  const ev = window.SCH.find(x => x.id == id);
  if(!ev) return;
  const v = parseInt(val, 10);
  if(v > 0) {
    ev.grp = v;
    const pair = window.gardenPair(ev.g);
    let syncPartner = false;
    if(pair) {
      const pGid = pair.ids.find(pid => Number(pid) !== Number(ev.g));
      const pG = window.G(pGid);
      if(pG && (await window.spConfirm('האם לעדכן את מספר הקבוצות גם בצהרון המקביל (' + pG.name + ')?'))) {
        syncPartner = true;
      }
    }
    if(syncPartner) {
      const pGid = pair.ids.find(pid => Number(pid) !== Number(ev.g));
      const pEv = window.findPartnerActivity ? window.findPartnerActivity(pGid, ev.d, ev.a) : null;
      if(pEv) pEv.grp = v;
    }
    window.save();
    window.refresh();
  }
};

window.spRowStatusChg = async function(id, st) {
  const ev = window.SCH.find(x => x.id == id);
  if(!ev) return;
  
  if (st === 'delete') {
      const origSel = document.querySelector(`select[onchange="window.spRowStatusChg('${id}', this.value)"]`);
      if (origSel) origSel.value = ev.st || 'ok';
      window.deleteSingleActivity(id);
      return;
  }
  
  const pair = window.getGardenGroup ? window.getGardenGroup(ev.g, ev.d) : window.gardenPair(ev.g, ev.d);
  let syncPartner = false;
  if(pair) {
    const pGid = pair.ids.find(pid => Number(pid) !== Number(ev.g));
    const pG = window.G(pGid);
    const isM = !!ev._isMakeup;
    const stText = st === 'nohap' ? (isM ? 'השלמה לא התקיימה' : 'לא התקיים') : (st === 'can' ? 'ביטול' : (st === 'post' ? 'דחייה' : st));
    
    // Only ask confirm for simple statuses (done/ok). 
    // Exceptions (nohap/can/post) have their own modals with sync options.
    if(st === 'done' || st === 'ok') {
        const otherNames = pair.ids.filter(id=>Number(id)!==Number(ev.g)).map(id=>(window.G(id)||{}).name).join(', ');
        const targetType = pair.ids.length > 2 ? 'האשכול' : 'גן בן-הזוג';
        if(await window.spConfirm(`האם לעדכן את הסטטוס "${stText}" גם ב${targetType} (${otherNames})?`)) {
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
    if(st === 'ok') {
      ev.cr = '';
      ev.cn = '';
      ev._compByMakeup = '';
      if(ev.nt) {
        ev.nt = ev.nt.split(' | ').filter(part => 
          !part.includes('לא התקיים:') && 
          !part.includes('בוטל:') && 
          !part.includes('השלמה נקבעה ל-') && 
          !part.includes('הוקדם ל-') &&
          !part.includes('נדחה ל-') &&
          !part.includes('הוזז ל-') &&
          !part.includes('הקדמה ל-') &&
          !part.includes('דחייה ל-') &&
          !part.includes('עבר ל-') &&
          !part.includes('עובר ל-') &&
          !part.includes('הועבר ל-')
        ).join(' | ').trim();
      }
    }
    if(syncPartner) {
      const pev = window.findPartnerActivity(pair.ids.find(pid => Number(pid) !== Number(ev.g)), ev.d, ev.a);
      if(pev) {
        pev.st = st;
        if(st === 'ok') {
          pev.cr = '';
          pev.cn = '';
          pev._compByMakeup = '';
          if(pev.nt) {
            pev.nt = pev.nt.split(' | ').filter(part => 
              !part.includes('לא התקיים:') && 
              !part.includes('בוטל:') && 
              !part.includes('השלמה נקבעה ל-') && 
              !part.includes('הוקדם ל-') &&
              !part.includes('נדחה ל-') &&
              !part.includes('הוזז ל-') &&
              !part.includes('הקדמה ל-') &&
              !part.includes('דחייה ל-') &&
              !part.includes('עבר ל-') &&
              !part.includes('עובר ל-') &&
              !part.includes('הועבר ל-')
            ).join(' | ').trim();
          }
        }
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
    const isM = !!(ev._isMakeup || ev._makeupFrom || (ev.nt && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(ev.nt)) || (ev.a && /השלמה|הוקדם מ/i.test(ev.a)));
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
  window.saveAndRefresh('sp', false);
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

window.spRowTimeChg = function(id, val) {
  const s = window.SCH.find(x => x.id == id);
  if(s) {
    s.t = val;
    // Save without forcing a re-render of the modal so it doesn't jump while typing
    window.saveAndRefresh(null, true);
    if(window.showToast) window.showToast('✅ השעה נשמרה');
  }
};

window.openSP = function(id) {
  if (window.isReadOnly) {
    alert('משתמש זה מוגדר כמשתמש צפייה בלבד (רכז). אין אפשרות לבצע שינויים.');
    return;
  }
  window.selEv = id;
  const s = window.SCH.find(x => x.id == id);
  if(!s) return;

  const isClusterMode = window._listGroupMode === 'clusters' || window._dashTab === 'clusters';
  // We now use openSP for clusters directly, no redirect to openClusterBulkEdit

  try { // ← try-catch to prevent silent failures
  const g=window.G(s.g);
  const spPair = window.getGardenGroup ? window.getGardenGroup(s.g, s.d) : window.gardenPair(s.g, s.d);
  const allSups = window.getAllSup ? window.getAllSup().filter(s2=>window.isActSupplier(s2.name)) : [];
  var initialActs = window.getSupActs ? window.getSupActs(s.a) : [];

  // Build partner info array and currentTimesSP for later use
  const currentTimesSP = {};
  const currentGrpsSP = {};
  currentTimesSP[s.g] = window.fT(s.t);
  currentGrpsSP[s.g] = s.grp || 1;
  const partnerInfo = [];

  let combinedIds = new Set();
  if (window._currentCustomGroup && window._currentCustomGroup.includes(Number(s.g))) {
      window._currentCustomGroup.forEach(gid => combinedIds.add(Number(gid)));
  } else {
      if (spPair) spPair.ids.forEach(gid => combinedIds.add(Number(gid)));
  }
  
  combinedIds.delete(Number(s.g));
  
  combinedIds.forEach(oid => {
    const pg = window.G(oid);
    const pev = window.findPartnerActivity(oid, s.d, s.a);
    if(pev) { currentTimesSP[oid] = window.fT(pev.t || s.t); currentGrpsSP[oid] = pev.grp || 1; }
    partnerInfo.push({ pg, pev });
  });

  // --- Activity type detection ---
  const _dow = new Date(s.d).getDay();
  const isM = !!(s._isMakeup || s._makeupFrom ||
                (s.nt && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.nt)) ||
                (s.n && /השלמה|הוקדם מ/i.test(s.n)) ||
                (s.cn && /השלמה|makeup/i.test(s.cn)) ||
                (s.a && /השלמה|makeup/i.test(s.a)) ||
                (s.act && /השלמה|makeup/i.test(s.act)));
  const repeats = window.SCH.filter(x => x.g === s.g && new Date(x.d).getDay() === _dow && window.supBase(x.a) === window.supBase(s.a) && x.t === s.t && x.st !== 'can').length >= 2;
  const isRec = !isM && (!!s._recId || repeats);

  let customType = '';
  if (s.st === 'can' || (s.nt && /ביטול|בוטל/i.test(s.nt))) customType = 'ביטול';
  else if (s.nt && /הקדמה|הוקדם/i.test(s.nt)) customType = 'הקדמה';
  else if (s.nt && /דחי?יה|נדחה/i.test(s.nt)) customType = 'דחיה';
  else if (isM) customType = 'השלמה';

  const typeTag = isRec
    ? '<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:.68rem;font-weight:700;background:#e3f2fd;color:#1565c0">🔁 פעילות קבועה</span>'
    : customType
    ? `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:.68rem;font-weight:700;background:#fff3e0;color:#e65100">↩️ ${customType}</span>`
    : '<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:.68rem;font-weight:700;background:#eceff1;color:#546e7a">📌 חד-פעמי</span>';

  // --- STEP 1 & 2: Garden Details (Table) ---
  const allGardens = [{pg: g, pev: s}, ...partnerInfo];
  allGardens.sort((a, b) => {
    const tA = (a.pev && a.pev.t) ? a.pev.t : '99:99';
    const tB = (b.pev && b.pev.t) ? b.pev.t : '99:99';
    if (tA !== tB) return tA.localeCompare(tB);
    return (a.pg?.name || '').localeCompare(b.pg?.name || '', 'he');
  });
  
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
              <th style="padding:6px">שם הצהרון</th>
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
            const isMain = Number(rowG.id) === Number(g.id);
            return `
            <tr style="border-bottom:1px solid #f0f0f0;background:${isMain?'#fff':'#fafafa'}">
              <td style="padding:6px;text-align:center">
                ${pId ? `<input type="checkbox" class="sp-garden-sel" value="${pId}" checked onchange="window.spUpdateExVisibility()" style="width:16px;height:16px;accent-color:#5c6bc0">` : '-'}
              </td>
              <td style="padding:6px;font-weight:800;color:#1a237e">${isMain?'':'🔗 '}${rowG.name} <span style="font-size:0.65rem;color:#78909c">(${rowG.city})</span></td>
              <td style="padding:6px">${pev ? window.supBase(pev.a) : '—'}</td>
              <td style="padding:6px">${pev ? (pev.act||'—') : '—'}</td>
              <td style="padding:6px">${pev ? (pev.tp || (window.gcls(rowG)==='גנים'?'חוג':'—')) : '—'}</td>
              <td style="padding:6px;text-align:center;font-weight:700">${pev ? `<input type="number" min="1" max="10" value="${pev.grp || 1}" style="width:40px;text-align:center;border:1px solid #ccc;border-radius:4px" onchange="window.spRowGrpChg(\'${pev.id}\', this.value)">` : '—'}</td>
              <td style="padding:6px">
                ${pev ? `
                  <select onchange="window.spRowStatusChg('${pev.id}', this.value)" style="padding:2px 4px;font-size:0.7rem;border-radius:4px;border:1px solid #ccc;background:${window.stClass(pev)==='done'?'#e8f5e9':(window.stClass(pev)==='nohap'?'#ffebee':'#fff')}">
                    <option value="ok" ${curSt==='ok'?'selected':''}>🔄 תקין</option>
                    <option value="done" ${curSt==='done'?'selected':''}>✔️ בוצע</option>
                    <option value="nohap" ${curSt==='nohap'?'selected':''}>⚠️ לא התקיים</option>
                    <option value="can" ${curSt==='can'?'selected':''}>❌ בוטל</option>
                    <option value="post" ${curSt==='post'?'selected':''}>⏩ נדחה</option>
                    <option value="delete" style="color:#c62828;font-weight:700">לא משובץ</option>
                  </select>
                  ${(curSt==='nohap'||curSt==='can') ? `<button class="btn br bsm" style="padding:1px 4px;margin-right:3px;border:1px solid #ef9a9a;background:#fff;color:#c62828" title="מחיקה מהלוח" onclick="window.deleteSingleActivity('${pev.id}')">🗑️</button>` : ''}
                ` : `<span style="font-size:.7rem;color:#c62828;font-weight:700">לא משובץ</span> <button class="btn bp bsm" style="padding:1px 5px;font-size:0.65rem;margin-right:5px;border-radius:4px" onclick="window.spAddActivityToPartner('${rowG.id}')" title="הוסף שיבוץ לגן זה בהתבסס על הפעילות הנוכחית">➕ הוסף</button>`}
              </td>
              <td style="padding:6px;font-weight:700">
                ${pev ? `<input type="time" value="${pev.t||''}" onchange="window.spRowTimeChg('${pev.id}', this.value)" style="padding:2px 4px;font-size:0.75rem;border-radius:4px;border:1px solid #ccc;width:90px;text-align:center;font-family:inherit">` : '—'}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  // --- STEP 3: Quick Actions (Compact Dropdown) ---
  h += `<div style="background:#f8f9fa;border-radius:10px;padding:12px;border:1px solid #e0e0e0;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
    <div style="display:flex;flex-direction:column">
      <div style="font-size:.75rem;font-weight:800;color:#1a237e">🌐 פעולות גלובליות (למסומנים ב-V)</div>
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
      <button class="btn bp bsm" style="width:100%;padding:8px;font-weight:700;border-radius:6px" onclick="window.spBatchSaveNt()">💾 שמור הערות לגנים המסומנים ב-V בטבלה למעלה</button>
    </div>
  </div>`;

  // --- STEP 5: Exception Handling (Only for relevant statuses) ---
  h += `<div id="sp-ex-box" style="display:none;margin-bottom:12px;border:1.5px solid #ffe082;border-radius:10px;padding:10px;background:#fff8e1">
      <div style="font-size:0.8rem;color:#e65100;font-weight:800;margin-bottom:6px">🛠️ טיפול בחריג</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input type="text" id="sp-handle-nt" style="flex:1;min-width:200px;padding:6px;border-radius:6px;border:1px solid #ffe082;font-size:0.8rem" placeholder="הערת סיום טיפול (לדוגמה: בוצע ידנית ב-20/4...)" value="${s.st==='post'?'נדחה':''}">
        ${spPair ? `<label for="sp-sync-pair" style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="sp-sync-pair" style="width:14px;height:14px;accent-color:#e65100" checked><span style="font-size:0.75rem;font-weight:700;color:#bf360c">${spPair.ids.length > 2 ? 'סנכרן לאשכול' : 'סנכרן לזוג'}</span></label>` : ''}
        <button class="btn borange bsm" style="padding:6px 12px;font-weight:800;border-radius:6px" onclick="window.spBatchMarkCompManual()">סיום טיפול לגנים המסומנים ב-V</button>
      </div>
    </div>`;

  // --- STEP 6: Series Management ---
  const _dObj = s.d ? new Date(s.d) : new Date();
  const _sY = _dObj.getMonth() >= 7 ? _dObj.getFullYear() : _dObj.getFullYear() - 1;
  const tdDate = typeof window.td === 'function' ? window.td() : new Date().toISOString().split('T')[0];
  const defaultFrom = s.d; // Always default to the event's date
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
            <select id="rr-sup" onchange="window.rrSupChg()" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc">${(window.getAllSup ? window.getAllSup().filter(s2=>window.isActSupplier(s2.name)) : []).map(s2=>{ const disp = window.supNameLabel(s2.name) !== s2.name ? window.supNameLabel(s2.name) + ' (' + s2.name + ')' : s2.name; return `<option value="${s2.name}" ${s2.name===s.a?'selected':''}>${disp}</option>`; }).join('')}</select>
          </div>
          <div class="fg"><label style="font-size:.7rem;font-weight:700">🎯 פעילות</label>
            <select id="rr-act" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"><option value="">— ללא שינוי —</option>${(window.getSupActs ? window.getSupActs(s.a) : []).map(a=>`<option value="${a}" ${a===s.act?'selected':''}>${a}</option>`).join('')}</select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr;gap:8px">
          <div class="fg"><label style="font-size:.7rem;font-weight:700">קבוצות</label><input type="number" id="rr-grp" value="${s.grp||1}" min="1" max="10" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>
          <div class="fg"><label style="font-size:.7rem;font-weight:700;display:flex;align-items:center;gap:3px;cursor:pointer" title="הורד סימון כדי לא לשבץ פעילות בגן זה"><input type="checkbox" id="rr-sync-partner-${s.g}" checked style="width:13px;height:13px;accent-color:#1a237e;margin:0"> שעה (${g.name})</label><input type="time" id="rr-time" value="${s.t||''}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>
          ${spPair ? spPair.ids.filter(id=>Number(id)!==Number(s.g)).map((pid, idx) => {
                 let pInfo = partnerInfo.find(pi => Number(pi.pg.id) === Number(pid));
                 let pTime = (pInfo && pInfo.pev) ? pInfo.pev.t : (s.t||'');
                 return `<div class="fg"><label style="font-size:.7rem;font-weight:700;display:flex;align-items:center;gap:3px;cursor:pointer" title="הורד סימון כדי לא לשבץ פעילות בגן זה"><input type="checkbox" id="rr-sync-partner-${pid}" checked style="width:13px;height:13px;accent-color:#1a237e;margin:0"> שעה (${window.G(pid).name})</label><input type="time" id="rr-time-partner-${pid}" value="${pTime}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>`;
            }).join('') : ''}
        </div>
        ${spPair ? `<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="rr-sync" style="width:14px;height:14px;accent-color:#1a237e" checked><span style="font-size:.75rem;font-weight:700;color:#1a237e">${spPair.ids.length > 2 ? 'החל סדרה קבועה על הגנים המסומנים' : 'החל סדרה קבועה על הגנים המסומנים'}</span></label>` : ''}
        <div style="display:flex;gap:6px;margin-top:6px">
          <button class="btn bp" style="flex:1;padding:8px;font-weight:800;font-size:.85rem" onclick="window.saveReplaceRecur('${s.id}')">💾 שמור שינויים והחל סדרה קבועה</button>
          <button class="btn br" style="flex:1;padding:8px;font-weight:800;font-size:.85rem;background:#ffebee;border:1px solid #ef9a9a;color:#c62828" onclick="window.deleteRecurSeries('${s.id}')">ביטול פעילות (עתידי) מתאריך זה והלאה</button>
        </div>
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
                 <div class="fg"><label style="font-size:.7rem;font-weight:700">שעה *</label><input type="time" id="sp-mu-time" value="${s.t||''}" oninput="const tblInp = document.querySelector('.sp-mu-syn-time[data-gid=\'${s.g}\']'); if(tblInp) tblInp.value = this.value" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>
                 <div class="fg">
                   <label style="font-size:.7rem;font-weight:700">בחר פעילות *</label>
                   <select id="sp-mu-act" onchange="window.spMuActChg()" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc">
                     <option value="">בחר פעילות...</option>
                     ${initialActs.map(a => `<option value="${a}" ${s.act===a?'selected':''}>${a}</option>`).join('')}
                     <option value="__new__">➕ הוסף פעילות חדשה...</option>
                   </select>
                 </div>
              </div>
              <div style="display:${(window.gcls(g) === 'ביה&quot;ס' || window.gcls(g) === 'ביה\"ס') ? 'grid' : 'none'};grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
                 <div class="fg">
                   <label style="font-size:.7rem;font-weight:700;color:#e65100">מספר קבוצות</label>
                   <input type="number" id="sp-mu-grp" min="1" max="10" value="${s.grp||1}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ffb74d">
                 </div>
                 <div></div>
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
        <div class="fg"><label for="sp-edit-sup" style="font-size:.7rem;font-weight:700">ספק</label><select id="sp-edit-sup" onchange="window.spEditSupChg()" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc">${allSups.map(sup => { const disp = window.supNameLabel(sup.name) !== sup.name ? window.supNameLabel(sup.name) + ' (' + sup.name + ')' : sup.name; return `<option value="${sup.name}" ${sup.name===s.a ? 'selected':''}>${disp}</option>`; }).join('')}</select></div>
        <div class="fg"><label for="sp-edit-grp" style="font-size:.7rem;font-weight:700">קבוצות</label><input type="number" id="sp-edit-grp" value="${s.grp||1}" min="1" max="10" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>
        <div class="fg"><label for="sp-edit-act" style="font-size:.7rem;font-weight:700">פעילות</label><select id="sp-edit-act" onchange="window.spEditActChg()" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"><option value="">— ללא שינוי —</option>${initialActs.map(a => `<option value="${a}" ${a===s.act ? 'selected':''}>${a}</option>`).join('')}<option value="__new__">➕ פעילות חדשה...</option></select></div>
      </div>
      <div class="fg" id="sp-edit-act-new-wrap" style="display:none;margin-top:8px"><label for="sp-edit-act-new" style="font-size:.7rem;font-weight:700">שם הפעילות החדשה</label><input type="text" id="sp-edit-act-new" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>
      ${spPair ? window.renderPartnerSynergy(s.g, 'sped', currentTimesSP, currentGrpsSP) : ''}
      <button class="btn bg" style="width:100%;padding:8px;font-weight:800;margin-top:8px;font-size:.8rem" onclick="window.spEditSave()">💾 שמור שינויים</button>
    </div>
  </div>`;
  
  // --- STEP 9: Free Days Info ---
  h += `<div style="margin-top:10px;border:1px solid #c8e6c9;border-radius:10px;overflow:hidden">
    <div onclick="window.toggleSpAccordion('sp-acc-free')" style="background:#e8f5e9;padding:8px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">
      <b style="font-size:0.8rem;color:#2e7d32">🗓️ ימים פנויים לצהרון${isClusterMode ? ' ולכל האשכול' : ''} (מידע בלבד)</b>
      <span id="sp-acc-free-arrow" style="font-size:0.7rem;transition:0.3s;color:#2e7d32">▼</span>
    </div>
    <div id="sp-acc-free" style="display:none;padding:12px;background:#fff;border-top:1px solid #c8e6c9">
      <div style="font-size:.72rem;color:#78909c;margin-bottom:8px;background:#f9f9f9;padding:4px 8px;border-radius:4px">תאריכים פנויים לשלושת השבועות הקרובים לצהרון זה:</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        ${window.getSpFreeDaysHtml(s.g, s.d)}
      </div>
      ${(() => {
        if (isClusterMode) {
          const clusterArr = window.gardenClusters ? window.gardenClusters(s.g, s.d) : [];
          const spCluster = clusterArr.length ? clusterArr[0] : null;
          if (spCluster && spCluster.gardenIds) {
            return '<div style="font-size:.72rem;color:#e65100;margin-top:12px;margin-bottom:8px;background:#fff9f0;padding:4px 8px;border-radius:4px;border:1px solid #ffe0b2;font-weight:700">תאריכים פנויים משותפים לכל האשכול (מידע בלבד):</div>' +
                   '<div style="display:flex;gap:5px;flex-wrap:wrap">' +
                   window.getPairSharedFreeDaysHtml(spCluster.gardenIds, '', s.d) +
                   '</div>';
          }
        }
        return spPair ? '<div style="font-size:.72rem;color:#e65100;margin-top:12px;margin-bottom:8px;background:#fff9f0;padding:4px 8px;border-radius:4px;border:1px solid #ffe0b2;font-weight:700">תאריכים פנויים משותפים ל' + (spPair.ids.length > 2 ? 'אשכול' : 'זוג הגנים') + ' (מידע בלבד):</div>' +
               '<div style="display:flex;gap:5px;flex-wrap:wrap">' +
               window.getPairSharedFreeDaysHtml(spPair.ids, '', s.d) +
               '</div>' : '';
      })()}
    </div>
  </div>`;

  // --- STEP 9.5: Missed Activities ---
  h += `<div style="margin-top:10px;border:1px solid #ef9a9a;border-radius:10px;overflow:hidden">
    <div onclick="window.toggleSpAccordion('sp-acc-missed')" style="background:#ffebee;padding:8px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">
      <b style="font-size:0.8rem;color:#c62828">⚠️ פעילויות שלא התקיימו / נדחו (מידע בלבד)</b>
      <span id="sp-acc-missed-arrow" style="font-size:0.7rem;transition:0.3s;color:#c62828">▼</span>
    </div>
    <div id="sp-acc-missed" style="display:none;padding:12px;background:#fff;border-top:1px solid #ef9a9a">
      <div style="font-size:.72rem;color:#c62828;margin-bottom:8px;background:#f9f9f9;padding:4px 8px;border-radius:4px">פעילויות שטרם התקיימו או נדחו ב-${g.name}:</div>
      ${window.getSpMissedHtml ? window.getSpMissedHtml(s.g) : ''}
    </div>
  </div>`;

  // --- STEP 9.8: Duplicate Button ---
  h += `<div id="sp-dup-wrap" style="margin-top:15px; text-align:center; background:#e3f2fd; border:1px solid #90caf9; padding:10px; border-radius:8px; display:none;">
    <div style="font-size:0.8rem; font-weight:800; margin-bottom:8px; color:#1565c0;">בחר תאריך יעד לשכפול:</div>
    <div style="display:flex; justify-content:center; gap:8px;">
      <input type="date" id="sp-dup-date" style="padding:6px; border-radius:4px; border:1px solid #90caf9; width:140px;">
      <button class="btn bg" onclick="window.spExecuteDuplicate()" style="padding:6px 12px; font-weight:800;">שכפל פעילות</button>
    </div>
  </div>
  <div style="margin-top:15px; text-align:center;" id="sp-dup-btn-wrap">
    <button class="btn bo" style="width:100%;padding:10px;font-weight:800;background:#e3f2fd;border:1px solid #90caf9;color:#1565c0;font-size:.85rem;border-radius:8px" onclick="document.getElementById('sp-dup-wrap').style.display='block'; document.getElementById('sp-dup-btn-wrap').style.display='none'; window.toggleSpAccordion('sp-acc-free', true);">📋 שכפל פעילות לתאריך אחר</button>
  </div>`;

  // --- STEP 10: Delete Button ---
  const delBtnText = s._isMakeup ? '🗑️ מחק פעילות השלמה (והחזר מקורית)' : '🗑️ מחק פעילות זו מהלוח (לצמיתות)';
  h += `<div style="margin-top:15px; text-align:center;">
    <button class="btn br" style="width:100%;padding:10px;font-weight:800;background:#ffebee;border:1px solid #ef9a9a;color:#c62828;font-size:.85rem;border-radius:8px" onclick="window.spBatchDelete()">${delBtnText}</button>
  </div>`;

  document.getElementById('sp-m-body').innerHTML = h;
  window.spUpdateExVisibility(); // Initial check
  window.spMuDateChg(); // Pre-populate partners table and free days!
  
  // Reset modal title
  const titleEl = document.getElementById('sp-m-title');
  if (titleEl) titleEl.textContent = 'פרטי פעילות';
  
  window.OM('sp-m');
  } catch(err) {
    console.error('[openSP] Error building panel:', err);
    var spBody=document.getElementById('sp-m-body');
    if(spBody) spBody.innerHTML='<div style="color:#c62828;padding:20px;font-size:.85rem"><b>שגיאה בפתיחת פרטי פעילות:</b><br><pre style="white-space:pre-wrap;margin-top:8px;background:#fff3f3;padding:10px;border-radius:6px;font-size:.75rem">'+err.message+'\n'+err.stack+'</pre></div>';
    window.OM('sp-m');
  }
}
window.openSP = openSP;

window.spAddActivityToPartner = function(targetGid) {
  const s = window.SCH.find(x => x.id == window.selEv);
  if(!s) return;
  const newEv = {
    id: 's_' + Date.now() + '_' + Math.floor(Math.random()*1000),
    g: parseInt(targetGid),
    d: s.d,
    a: s.a,
    t: s.t,
    p: s.p,
    n: s.n,
    st: 'ok',
    cr: 'הוסף מחלון פרטי פעילות',
    cn: s.cn,
    nt: s.nt,
    pd: s.pd,
    pt: s.pt,
    grp: s.grp,
    act: s.act
  };
  window.SCH.push(newEv);
  window.saveAndRefresh(null, true).then(() => {
    window.openSP(s.id); // Refresh modal
    if(window.showToast) window.showToast('✅ הפעילות נוספה בהצלחה לגן');
  });
};

window.spExecuteDuplicate = function() {
  const newDate = document.getElementById('sp-dup-date').value;
  if(!newDate) { alert('נא לבחור תאריך'); return; }
  
  const sels = Array.from(document.querySelectorAll('.sp-garden-sel:checked')).map(el => el.value);
  if(!sels.length) { alert('נא לבחור לפחות צהרון אחד (בתיבות הסימון למעלה)'); return; }
  
  let duplicated = 0;
  sels.forEach(pId => {
    const orig = window.SCH.find(x => x.id == pId);
    if(orig) {
      const cloned = JSON.parse(JSON.stringify(orig));
      cloned.id = Date.now().toString() + Math.floor(Math.random()*1000) + duplicated;
      cloned.d = newDate;
      cloned.st = 'ok';
      delete cloned.nt;
      delete cloned._recId;
      delete cloned._makeupFrom;
      delete cloned._isMakeup;
      
      window.SCH.push(cloned);
      duplicated++;
    }
  });
  
  if(duplicated > 0) {
    if(window.saveAndRefresh) window.saveAndRefresh('sp');
    if(window.showToast) window.showToast('✅ הפעילות שוכפלה בהצלחה ל-' + window.fD(newDate));
    if(window.CM) window.CM('sp-m'); // close modal
  }
};

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

window.getSpMissedHtml = function(gid) {
  const missedEvs = window.SCH.filter(ev => {
    if(ev.g !== gid) return false;
    const nt = ev.nt || '';
    return ev.st === 'can' || ev.st === 'nohap' || /דחי?יה|נדחה|הוזז/i.test(nt);
  }).sort((a,b) => b.d.localeCompare(a.d) || (a.t||'').localeCompare(b.t||''));
  
  if(!missedEvs.length) return '<div style="font-size:.75rem;color:#546e7a">אין פעילויות שעונות לקריטריון זה.</div>';
  
  let h = '<div style="max-height:180px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:2px">';
  missedEvs.forEach(ev => {
    const onclickStr = `window.calD=new Date('${ev.d}');window.currentTab='calendar';if(window.renderCal)window.renderCal();if(window.switchTab)window.switchTab('calendar');window.CM('sp-m');`;
    const stLabel = window.stLabel(ev);
    const ntStr = ev.nt || '';
    h += `<div onclick="${onclickStr}" style="cursor:pointer;border:1px solid #ffcdd2;border-radius:6px;padding:8px;background:#fff;transition:0.2s" onmouseover="this.style.background='#ffebee'" onmouseout="this.style.background='#fff'">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-weight:800;color:#c62828;font-size:.8rem">${window.fD(ev.d)} - יום ${window.dayN(ev.d)}</span>
        <span style="font-size:.7rem">${stLabel}</span>
      </div>
      <div style="font-size:.75rem;color:#1a237e;font-weight:700;margin-bottom:2px">${ev.a} ${ev.act ? `| ${ev.act}` : ''}</div>
      ${ntStr ? `<div style="font-size:.7rem;color:#d32f2f">📝 ${ntStr}</div>` : ''}
    </div>`;
  });
  h += '</div>';
  return h;
};

async function deleteRecurSeries(id) {
  const s = window.SCH.find(x => x.id == id);
  if(!s) return _spAlertDialog('שגיאה. רשומה לא קיימת');
  const g = window.G(s.g);
  
  const affected = s._recId
    ? window.SCH.filter(x => x._recId === s._recId && x.d >= s.d && x.g === s.g)
    : window.SCH.filter(x => window.supBase(x.a) === window.supBase(s.a) && x.d >= s.d && x.g === s.g);
  
  const pair = window.getGardenGroup ? window.getGardenGroup(s.g, s.d) : window.gardenPair(s.g, s.d);

  const syncChk = document.getElementById('rr-sync-pair') || document.getElementById('rr-sync');
  const sync = syncChk ? syncChk.checked : true;

  const partnerGids = [];
  if (sync && pair) {
    pair.ids.forEach(pid => {
      if (Number(pid) !== Number(s.g)) {
        const syncBox = document.getElementById('rr-sync-partner-' + pid);
        if (!syncBox || syncBox.checked) {
          partnerGids.push(Number(pid));
        }
      }
    });
  }

  const gName = g.name.startsWith('גן') ? g.name : `גן ${g.name}`;
  let confirmMsg = `האם אתה בטוח שברצונך למחוק ${affected.length} פעילויות של הספק מתאריך זה והלאה בגן ${gName} מהלוח?`;
  if (partnerGids.length > 0) {
    confirmMsg = `האם אתה בטוח שברצונך למחוק ${affected.length} פעילויות של הספק מתאריך זה והלאה גם מהלוח של הגן ${gName} וגם מהלוחות של הגנים השותפים?`;
  }
  
  if(!await window.spConfirm(confirmMsg)) return;

  if (!window.supEx) window.supEx = {};
  if (!window.supEx['__deleted_sraws_ids']) window.supEx['__deleted_sraws_ids'] = [];

  affected.forEach(x => {
    const isSraws = !String(x.id).startsWith('e_');
    if (isSraws && !window.supEx['__deleted_sraws_ids'].includes(x.id)) {
      window.supEx['__deleted_sraws_ids'].push(x.id);
    }
    const i = window.SCH.indexOf(x);
    if(i >= 0) window.SCH.splice(i, 1);
  });

  if (partnerGids.length > 0) {
    const pAffected = window.SCH.filter(x => {
      const isTarget = partnerGids.includes(Number(x.g));
      const isTimeMatch = x.d >= s.d;
      const isRecMatch = s._recId ? x._recId === s._recId : false;
      const isFallbackMatch = window.supBase(x.a) === window.supBase(s.a);
      return isTarget && isTimeMatch && (isRecMatch || isFallbackMatch);
    });
    
    pAffected.forEach(x => {
      const isSraws = !String(x.id).startsWith('e_');
      if (isSraws && !window.supEx['__deleted_sraws_ids'].includes(x.id)) {
        window.supEx['__deleted_sraws_ids'].push(x.id);
      }
      const i = window.SCH.indexOf(x);
      if(i >= 0) window.SCH.splice(i, 1);
    });
  }
  
  window.saveAndRefresh('sp');
}

async function deleteSingleActivity(id) {
  const s = window.SCH.find(x => x.id == id);
  if(!s) return;
  const g = window.G(s.g);
  
  const gName = g.name.startsWith('גן') ? g.name : `גן ${g.name}`;
  if(!await window.spConfirm(`האם למחוק את השיבוץ של ${gName} בתאריך ${window.fD(s.d)} לצמיתות?`)) return;
  
  if (!window.supEx) window.supEx = {};
  if (!window.supEx['__deleted_sraws_ids']) window.supEx['__deleted_sraws_ids'] = [];
  
  const isSraws = !String(s.id).startsWith('e_');
  if (isSraws && !window.supEx['__deleted_sraws_ids'].includes(s.id)) {
    window.supEx['__deleted_sraws_ids'].push(s.id);
  }
  
  const i = window.SCH.indexOf(s);
  if(i >= 0) window.SCH.splice(i, 1);
  
  // Also check for partner sync
  const pair = window.getGardenGroup ? window.getGardenGroup(s.g, s.d) : window.gardenPair(s.g, s.d);
  if(pair) {
    const partnerGids = pair.ids.filter(pid => Number(pid) !== Number(s.g));
    const partnerEvs = [];
    partnerGids.forEach(pid => {
      const pEv = window.findPartnerActivity ? window.findPartnerActivity(pid, s.d, s.a) : null;
      if (pEv) partnerEvs.push(pEv);
    });
    
    if(partnerEvs.length > 0) {
      if(await window.spConfirm(`האם למחוק גם את ${partnerEvs.length} השיבוצים המקבילים בגנים השותפים?`)) {
        partnerEvs.forEach(pEv => {
          const isSrawsPartner = !String(pEv.id).startsWith('e_');
          if (isSrawsPartner && !window.supEx['__deleted_sraws_ids'].includes(pEv.id)) {
            window.supEx['__deleted_sraws_ids'].push(pEv.id);
          }
          const pi = window.SCH.indexOf(pEv);
          if(pi >= 0) window.SCH.splice(pi, 1);
        });
      }
    }
  }
  
  window.saveAndRefresh('sp');
}

async function toggleSpRecurBox(isChecked) {
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
      if(await window.spConfirm('האם תרצה להסיר את הפעילות הקבועה ולבטל את כל השיבוצים העתידיים בסדרה זו?')) {
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



async function deleteSingleActivity(id) {
  const s = window.SCH.find(x => x.id == id);
  if(!s) return;
  const g = window.G(s.g);
  
  const origEvs = s._isMakeup ? window.SCH.filter(orig => String(orig._compByMakeup) === String(s.id)) : [];
  const restoreMsg = origEvs.length > 0 ? `\n\n(מחיקה זו גם תחזיר את הפעילות המקורית שלא התקיימה לרשימה)` : '';

  if(!await window.spConfirm(`האם למחוק את השיבוץ של גן ${g.name} בתאריך ${window.fD(s.d)} לצמיתות?` + restoreMsg)) return;
  
  const i = window.SCH.indexOf(s);
  if(i >= 0) window.SCH.splice(i, 1);
  
  if (origEvs.length > 0) {
    origEvs.forEach(orig => {
      orig._compByMakeup = '';
      cleanMakeupNote(orig, s.d);
    });
  }
  
  // Also check for partner sync
  const pair = window.getGardenGroup ? window.getGardenGroup(s.g, s.d) : window.gardenPair(s.g, s.d);
  if(pair) {
    const pEvs = pair.ids.filter(pid => Number(pid) !== Number(s.g)).map(pid => window.findPartnerActivity ? window.findPartnerActivity(pid, s.d, s.a) : null).filter(Boolean);
    if(pEvs.length > 0) {
      let hasMakeup = pEvs.some(pe => pe._isMakeup);
      const pRestoreMsg = hasMakeup ? `\n(יש פעילויות השלמה שיחזירו את הפעילות המקורית)` : '';
      const otherNames = pEvs.map(pe => window.G(pe.g).name).join(', ');
      const targetType = pair.ids.length > 2 ? 'באשכול' : 'בגן בן-הזוג';
      if(await window.spConfirm(`האם למחוק גם את השיבוצים המקבילים ${targetType} (${otherNames})?` + pRestoreMsg)) {
        pEvs.forEach(pEv => {
          const pOrigEvs = pEv._isMakeup ? window.SCH.filter(orig => String(orig._compByMakeup) === String(pEv.id)) : [];
          const pi = window.SCH.indexOf(pEv);
          if(pi >= 0) window.SCH.splice(pi, 1);
          if (pOrigEvs.length > 0) {
            pOrigEvs.forEach(orig => {
              orig._compByMakeup = '';
              cleanMakeupNote(orig, pEv.d);
            });
          }
        });
      }
    }
  }
  
  window.saveAndRefresh('sp');
}

function openReplaceRecur(id) {
  const s = window.SCH.find(x => x.id == id);
  if(!s || !s._recId) return _spAlertDialog('פעילות זו אינה חלק מפעילות קבועה');
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
        <div><b>${spPair.ids.length > 2 ? 'אשכול' : 'גן בן-זוג'}:</b> שינוי זה יוחל גם על <b>${spPair.ids.filter(id=>Number(id)!==Number(s.g)).map(id=>(window.G(id)||{}).name||'לא ידוע').join(', ')}</b> אם תיבת הסימון למטה מסומנת.</div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;background:#e8eaf6;padding:8px 10px;border-radius:8px;border:1px solid #c5cae9;cursor:pointer">
        <input type="checkbox" id="rr-sync-pair" checked style="width:18px;height:18px">
        <span style="font-size:.82rem;font-weight:700;color:#1a237e">🔗 החל גם על ${spPair.ids.length > 2 ? 'האשכול' : 'גן בן-הזוג'}</span>
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

async function saveReplaceRecur(id) {
  try {
    const s = window.SCH.find(x => x.id == id);
    if(!s) return;
    
    const from = document.getElementById('rr-from').value;
    const to = document.getElementById('rr-to').value;
    const days = [...document.querySelectorAll('.rr-day:checked')].map(c => parseInt(c.value));
    const sup = document.getElementById('rr-sup').value;
    let act = document.getElementById('rr-act').value;
    if (!act && sup === s.a) act = s.act;
    const time = document.getElementById('rr-time').value;
      const grpInput = document.getElementById('rr-grp');
      const newGrp = grpInput ? parseInt(grpInput.value, 10) : null;
    const syncChk = document.getElementById('rr-sync-pair') || document.getElementById('rr-sync');
    const sync = syncChk ? syncChk.checked : false;
    const partnerTime = document.getElementById('rr-time-partner') ? document.getElementById('rr-time-partner').value : time;

    if(!from || !to || !days.length || !sup) return _spAlertDialog('יש למלא את כל השדות ולבחור ימים');

    if(!await window.spConfirm('⚠️ פעולה זו תמחוק את כל השיבוצים העתידיים של הסדרה הקיימת ותיצור חדשים.\nהאם אתה בטוח?')) return;

    // 1. Collect all series IDs to remove
    const seriesIdsToRemove = new Set([s._recId]);
    const partnerGids = [];
    if (sync) {
      const pair = window.getGardenGroup ? window.getGardenGroup(s.g, s.d) : window.gardenPair(s.g, s.d);
      if (pair) {
        pair.ids.forEach(pid => {
          const syncBox = document.getElementById('rr-sync-partner-' + pid);
          if (!syncBox || syncBox.checked) {
            partnerGids.push(Number(pid));
          }
        });
      }
    } else {
      const syncBox = document.getElementById('rr-sync-partner-' + s.g);
      if (!syncBox || syncBox.checked) {
        partnerGids.push(Number(s.g));
      }
    }

    if (!partnerGids.length) return window._spAlertDialog('יש לסמן לפחות גן אחד אליו תוחל הפעילות');

    // 2. Remove future occurrences from SCH
    if (!window.supEx) window.supEx = {};
    if (!window.supEx['__deleted_sraws_ids']) window.supEx['__deleted_sraws_ids'] = [];

    window.SCH = window.SCH.filter(ev => {
      const isFuture = ev.d >= from;
      const isTargetGarden = partnerGids.includes(Number(ev.g));
      const isOldSeries = ev._recId && seriesIdsToRemove.has(ev._recId);
      
      // Extra safety for legacy events: also match by supplier if _recId is missing but it's clearly part of the same thing.
      // CRITICAL: Only match the exact same day of the week to prevent deleting other days in a separated series!
      const isSameDayOfWeek = new Date(ev.d).getDay() === new Date(s.d).getDay();
      const isOldMatch = !ev._recId && isTargetGarden && window.supBase(ev.a) === window.supBase(s.a) && ev.d >= from && ev.st !== 'can' && isSameDayOfWeek;
      
      const shouldRemove = isFuture && (isOldSeries || isOldMatch);
      if (shouldRemove) {
        const isSraws = !String(ev.id).startsWith('e_');
        if (isSraws && !window.supEx['__deleted_sraws_ids'].includes(ev.id)) {
          window.supEx['__deleted_sraws_ids'].push(ev.id);
        }
      }
      return !shouldRemove;
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
            nt: '', _recId: newRecId + '_' + cur.getDay(), grp: newGrp || s.grp || 1
          });
          // Add for partners if synced
          if (sync) {
            const pair = window.getGardenGroup ? window.getGardenGroup(s.g, s.d) : window.gardenPair(s.g, s.d);
            if (pair) {
              pair.ids.forEach((pid, idx) => {
                if (Number(pid) !== Number(s.g)) {
                  // Keep partner time if possible, otherwise use main time
                    const syncBox = document.getElementById('rr-sync-partner-' + pid);
                    if (syncBox && !syncBox.checked) return; // Skip this partner!
                    let specificPartnerTime = partnerTime;
                    const specificInput = document.getElementById('rr-time-partner-' + pid);
                    if (specificInput) specificPartnerTime = specificInput.value;
                    console.log('PID:', pid, 'SyncBox:', !!syncBox, 'InputFound:', !!specificInput, 'Time:', specificPartnerTime);
                    window.SCH.push({
                      id: eid + (idx+1)*5000, g: pid, d: ds, a: sup, act: act, t: specificPartnerTime, st: 'ok',
                    nt: '', _recId: newRecId + '_' + cur.getDay(), grp: newGrp || s.grp || 1
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
    _spAlertDialog('שגיאה בביצוע ההחלפה: ' + err.message);
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
    const grpInput=document.getElementById('sp-edit-grp');
    const newGrp=grpInput ? parseInt(grpInput.value, 10) : null;
  
  if(newDate) s.d=newDate; 
  if(newSup) s.a=newSup; 
  if(newAct) { s.act=newAct; } else if (newSup && newSup !== origSup) { s.act=''; }
  if(newTime) s.t=newTime;
    if(newGrp && newGrp > 0) s.grp=newGrp;
  
  const synergyPartners = typeof window.getSynergyData === 'function' ? window.getSynergyData('sped') : [];
  synergyPartners.forEach(syn => {
    const pEv = window.findPartnerActivity(syn.g, origDate, origSup);
    if(pEv) {
      if(newDate) pEv.d=newDate;
        if(syn.grp) pEv.grp = syn.grp; else if(newGrp && newGrp > 0) pEv.grp = newGrp; 
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

async function setStatus(idOrSt, maybeSt){
  try {
    let id, st;
    if (maybeSt) { id = idOrSt; st = maybeSt; } 
    else { id = window.selEv; st = idOrSt; }
    const main=window.SCH.find(x=>x.id==id);
    if(!main) return;
    main.st=st;
    let userConfirmedDelete = false;
    let userDeclinedDelete = false;

    if(st==='ok') {
      main.cr='';
      main.cn='';
      
      if (main._compByMakeup && main._compByMakeup !== 'false') {
        const mkIdx = window.SCH.findIndex(x => x.id == main._compByMakeup);
        if (mkIdx > -1) {
          if(await window.spConfirm('פעילות זו קושרה להשלמה/דחייה שנוצרה בתאריך חלופי.\nהחזרתה למצב תקין מאפשרת למחוק גם את הפעילות החלופית.\nהאם למחוק את הפעילות החלופית שנוצרה?')) {
            window.SCH.splice(mkIdx, 1);
            userConfirmedDelete = true;
          } else {
            userDeclinedDelete = true;
          }
        }
      }
      
      if (!main._compByMakeup || main._compByMakeup === 'false') {
         const linkedMkIdx = window.SCH.findIndex(x => x._postFrom === main.d && x.g === main.g && window.supBase(x.a) === window.supBase(main.a) && x._isMakeup);
         if (linkedMkIdx > -1 && !userDeclinedDelete) {
            if (userConfirmedDelete || await window.spConfirm('פעילות זו קושרה להשלמה/דחייה שנוצרה בתאריך חלופי.\nהחזרתה למצב תקין מאפשרת למחוק גם את הפעילות החלופית.\nהאם למחוק את הפעילות החלופית שנוצרה?')) {
               window.SCH.splice(linkedMkIdx, 1);
               userConfirmedDelete = true;
            }
         }
      }

      main._compByMakeup = '';
      if(main.nt) {
        main.nt = main.nt.split(' | ').filter(part =>
          !part.includes('לא התקיים:') &&
          !part.includes('בוטל:') &&
          !part.includes('השלמה נקבעה ל-') &&
          !part.includes('הוקדם ל-') &&
          !part.includes('נדחה ל-') &&
          !part.includes('הוזז ל-') &&
          !part.includes('הקדמה ל-') &&
          !part.includes('דחייה ל-') &&
          !part.includes('עבר ל-') &&
          !part.includes('עובר ל-') &&
          !part.includes('הועבר ל-')
        ).join(' | ').trim();
      }
    } else if (st === 'nohap' || st === 'can' || st === 'post') {
      // A new exception is NOT yet handled — clear any stale stamp
      main._compByMakeup = '';
    }

    // Partner sync using the confirmed syncPartner value
    if(syncPartner) {
      const pair = window.gardenPair(main.g);
      if(pair) {
        const otherIds = pair.ids.map(Number).filter(oid => oid !== Number(main.g));
        otherIds.forEach(oid => {
          const pev = window.findPartnerActivity(oid, main.d, main.a);
          if(pev) {
            pev.st = st;
            if(st==='ok') {
              pev.cr='';
              pev.cn='';
              
              if (pev._compByMakeup && pev._compByMakeup !== 'false') {
                const mkIdx = window.SCH.findIndex(x => x.id == pev._compByMakeup);
                if (mkIdx > -1 && userConfirmedDelete) {
                  window.SCH.splice(mkIdx, 1);
                }
              } else {
                const linkedMkIdx = window.SCH.findIndex(x => x._postFrom === pev.d && x.g === pev.g && window.supBase(x.a) === window.supBase(pev.a) && x._isMakeup);
                if (linkedMkIdx > -1 && userConfirmedDelete) {
                  window.SCH.splice(linkedMkIdx, 1);
                }
              }
              
              pev._compByMakeup = '';
              if(pev.nt) {
                pev.nt = pev.nt.split(' | ').filter(part => 
                  !part.includes('לא התקיים:') && 
                  !part.includes('בוטל:') && 
                  !part.includes('השלמה נקבעה ל-') && 
                  !part.includes('הוקדם ל-') &&
                  !part.includes('נדחה ל-') &&
                  !part.includes('הוזז ל-') &&
                  !part.includes('הקדמה ל-') &&
                  !part.includes('דחייה ל-') &&
                  !part.includes('עבר ל-') &&
                  !part.includes('עובר ל-') &&
                  !part.includes('הועבר ל-')
                ).join(' | ').trim();
              }
            } else if (st === 'nohap' || st === 'can' || st === 'post') {
              // A new exception on partner — clear any stale handled stamp
              pev._compByMakeup = '';
            }
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
    const isM = !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.nt)));
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

async function markCompQuick(id){
  try {
    const s=window.SCH.find(x=>x.id==id); if(!s) return;
    const stamp = 'quick_' + Date.now();
    s._compByMakeup = stamp;
    
    // Sync with partners automatically if it's a pair/cluster (silent sync)
    const pair = window.gardenPair(s.g);
    const cluster = window.clusters ? Object.values(window.clusters).find(c => c.gids && c.gids.map(Number).includes(Number(s.g))) : null;
    
    const allPartnerIds = new Set();
    if(pair) pair.ids.forEach(i => allPartnerIds.add(Number(i)));
    if(cluster) cluster.gids.forEach(i => allPartnerIds.add(Number(i)));
    allPartnerIds.delete(Number(s.g));

    let partnersToUpdate = [];
    allPartnerIds.forEach(ogid => {
      const partnerEv = typeof window.findPartnerActivity === 'function' 
        ? window.findPartnerActivity(ogid, s.d, s.a)
        : window.SCH.find(p => p.d === s.d && window.supBase(p.a) === window.supBase(s.a) && Number(p.g) === Number(ogid));
        
      if (partnerEv && (partnerEv.st === 'nohap' || partnerEv.st === 'can' || partnerEv.st === 'post') && !partnerEv._compByMakeup) {
        partnersToUpdate.push(partnerEv);
      }
    });

    if (partnersToUpdate.length > 0) {
      if(await window.spConfirm('זיהינו גנים מקבילים (זוג/אשכול) עם חריגות באותה פעילות. האם לסמן "טופל" גם עבורם?')) {
        partnersToUpdate.forEach(pev => pev._compByMakeup = stamp);
      }
    }

    window.save();
    setTimeout(() => {
      if(window.updCounts) window.updCounts();
      window.renderDash();
    }, 20);
    if(window.showToast) window.showToast('✅ סומן כטופל');
  } catch(e){ console.error(e); }
}
window.markCompQuick = markCompQuick;

function unmarkCompQuick(id){
  try {
    const s=window.SCH.find(x=>x.id==id); if(!s) return;
    s._compByMakeup = ''; // Clear handled flag
    
    // Clear handled note if any
    if(s.nt) {
      s.nt = s.nt.split(' | ').filter(p => !p.includes('✅ סיום טיפול')).join(' | ').trim();
    }

    // Unmark partners automatically if they share the same timestamp (silent sync)
    const pair = window.gardenPair(s.g);
    const cluster = window.clusters ? Object.values(window.clusters).find(c => c.gids && c.gids.map(Number).includes(Number(s.g))) : null;
    
    const allPartnerIds = new Set();
    if(pair) pair.ids.forEach(i => allPartnerIds.add(Number(i)));
    if(cluster) cluster.gids.forEach(i => allPartnerIds.add(Number(i)));
    allPartnerIds.delete(Number(s.g));

    allPartnerIds.forEach(ogid => {
      const partnerEv = typeof window.findPartnerActivity === 'function' 
        ? window.findPartnerActivity(ogid, s.d, s.a)
        : window.SCH.find(p => p.d === s.d && window.supBase(p.a) === window.supBase(s.a) && Number(p.g) === Number(ogid));
        
      if (partnerEv && partnerEv._compByMakeup) {
        partnerEv._compByMakeup = '';
        if(partnerEv.nt) {
          partnerEv.nt = partnerEv.nt.split(' | ').filter(p => !p.includes('✅ סיום טיפול')).join(' | ').trim();
        }
      }
    });

    window.save();
    setTimeout(() => {
      if(window.updCounts) window.updCounts();
      if(window.renderDash) window.renderDash();
      if(window.renderCal) window.renderCal();
    }, 20);
    if(window.showToast) window.showToast('↩️ הוחזר לרשימת לטיפול');
  } catch(e){ console.error(e); }
}
window.unmarkCompQuick = unmarkCompQuick;

function upd(id,fields){
  const i=window.SCH.findIndex(s=>s.id==id);
  if(i>=0) Object.assign(window.SCH[i],fields);
}

function updAndRefresh(id,fields){
  upd(id,fields); window.save(); window.closeSP(); 
  setTimeout(() => { if(window.refresh) window.refresh(); }, 20);
}

function closeSP(){
  if(window.CM) window.CM('sp-m');
  window.selEv=null;
}

function refresh(){
    if(window.updCounts) window.updCounts();
    if(window.refreshAllDashTabs) window.refreshAllDashTabs();
    else if(window.renderDash) window.renderDash();
    
    if(window.renderCal) window.renderCal();
  if(window.currentTab==='sched' && window.renderSched) window.renderSched();
  if((window.currentTab==='gardens' || window.currentTab==='clusters' || window._dashTab==='clusters') && window.renderClusters) window.renderClusters();
  
  // Also refresh SP modal if it is open to keep details in sync!
  const spm = document.getElementById('sp-m');
  if(spm && spm.classList.contains('open') && window.selEv) {
    window.openSP(window.selEv);
  }
}
window.refresh = refresh;

async function saveAndRefresh(modalId, stayOpen = false, immediate = true){
  if(!stayOpen) {
    if(modalId) window.CM(modalId);
    if(modalId === 'sp' || modalId === 'sp-m') closeSP();
  }
  
  // Yield to browser to let UI update (like closing modals)
  await new Promise(r => setTimeout(r, 20));
  
  const ok = await window.save(immediate);
  
  // Yield again before the heavy refresh
  await new Promise(r => setTimeout(r, 20));
  
  window.refresh();
  // If SP panel is open and we're closing a different modal (e.g. nohapqm, canqm),
  // re-render the SP panel so it reflects the updated data immediately.
  const spEl = document.getElementById('sp');
  const spIsOpen = spEl && spEl.classList.contains('open');
  if (stayOpen && (modalId === 'sp' || modalId === 'sp-m') && window.selEv) {
    window.openSP(window.selEv);
  } else if (spIsOpen && window.selEv && modalId !== 'sp' && modalId !== 'sp-m') {
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

window.postShowFreeDays = function(gid) {
  const container = document.getElementById('post-free-days');
  const wrap = document.getElementById('post-free-wrap');
  if(!container || !wrap) return;
  
  const DAY_HEB=['ראשון','שני','שלישי','רביעי','חמישי'];
  const g = window.G(gid);
  if(!g) { wrap.style.display = 'none'; return; }

  const busyDates = new Set(window.SCH.filter(x => {
    if(Number(x.g) !== Number(gid)) return false;
    if(x.st === 'can' || x.st === 'nohap' || x.st === 'post') return false;
    return true;
  }).map(x=>x.d));
  
  const free = []; let d = new Date(); d.setHours(0,0,0,0);
  
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
    container.innerHTML = free.map(f => `
      <button type="button" class="btn bg bsm" style="font-size:0.68rem;padding:2px 6px;background:#e8f5e9;color:#2e7d32;border:1px solid #c8e6c9;cursor:pointer;border-radius:4px;display:inline-block;margin:2px" onclick="document.getElementById('post-date').value='${f.ds}'; if(window.postDateChg) window.postDateChg();">
        ${f.lbl}
      </button>
    `).join('');
    wrap.style.display = window._postMode === 'move' ? 'block' : 'none';
  } else {
    wrap.style.display = 'none';
  }
};

function openPostpone(id){
  try {
    window.selEvPost=id;
    const s=window.SCH.find(x=>x.id==id); if(!s) return;
    const g=window.G(s.g);
    document.getElementById('post-ev-info').innerHTML=`<b>${g.name}</b> · ${g.city} · ${s.a}`;
    // Ensure the input has a label associated with it in index.html (verified later)
    document.getElementById('post-date').value='';
    document.getElementById('post-reason').value='';
    
    // Populate Suppliers
    const allSups = (window.getAllSup ? window.getAllSup() : (typeof getAllSup === 'function' ? getAllSup() : [])).filter(s2 => window.isActSupplier && window.isActSupplier(s2.name));
    const supSel = document.getElementById('post-sup');
    if (supSel) {
      supSel.innerHTML = '<option value="">— אותו ספק —</option>' + 
        allSups.map(s2 => { const disp = window.supNameLabel(s2.name) !== s2.name ? window.supNameLabel(s2.name) + ' (' + s2.name + ')' : s2.name; return `<option value="${s2.name}">${disp}</option>`; }).join('');
      supSel.value = ''; // default to same
    }
    
    const actSel = document.getElementById('post-act');
    if (actSel) {
      actSel.innerHTML = '<option value="">— אותה פעילות —</option>';
    }
    
    // Show / Hide conflict warnings initially
    const warn = document.getElementById('post-conflict-warn');
    if(warn) warn.style.display = 'none';

    if(typeof window.setPostMode === 'function') window.setPostMode('move');
    
    // Populate Free Days
    if(typeof window.postShowFreeDays === 'function') {
      window.postShowFreeDays(s.g);
    }

    // Set up Synergy UI
    const synWrap = document.getElementById('post-synergy-wrap');
    if(synWrap) {
      let pIds = [];
      if (window._currentCustomGroup && window._currentCustomGroup.includes(Number(s.g))) {
        pIds = Array.from(new Set(window._currentCustomGroup.map(Number)));
      } else {
        const pair = window.getGardenGroup ? window.getGardenGroup(s.g, s.d) : window.gardenPair(s.g, s.d);
        if(pair && pair.ids) pIds = pair.ids.map(Number);
      }

      const currentTimes = {};
      const currentGrps = {};
      currentTimes[s.g] = window.fT(s.t) || '';
      currentGrps[s.g] = s.grp || 1;

      if(pIds.length) {
        pIds.forEach(pId => {
          if(Number(pId) === Number(s.g)) return;
          const pEv = window.SCH.find(ps => ps.d === s.d && Number(ps.g) === Number(pId) && ps.st!=='can' && window.supBase(ps.a)===window.supBase(s.a));
          if(pEv) { currentTimes[pId] = window.fT(pEv.t||s.t); currentGrps[pId] = pEv.grp || 1; }
        });
        synWrap.innerHTML = window.renderPartnerSynergy(s.g, 'post', currentTimes, currentGrps, s.d);
      }
    }
    
    document.getElementById('postm').classList.add('open');
  } catch(e) {
    _spAlertDialog("שגיאה בפתיחת הזזה: " + e.message);
  }
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
    let pIds = [];
    if (window._currentCustomGroup && window._currentCustomGroup.includes(Number(s.g))) {
      pIds = Array.from(new Set(window._currentCustomGroup.map(Number)));
    } else {
      const pair = window.getGardenGroup ? window.getGardenGroup(s.g, s.d) : window.gardenPair(s.g, s.d);
      if(pair && pair.ids) pIds = pair.ids.map(Number);
    }

    const currentTimes = {};
    const currentGrps = {};
    currentTimes[s.g] = window.fT(s.t) || '';
    currentGrps[s.g] = s.grp || 1;

    if(pIds.length) {
      pIds.forEach(pId => {
        if(Number(pId) === Number(s.g)) return;
        const pEv = window.SCH.find(ps => ps.d === s.d && Number(ps.g) === Number(pId) && ps.st!=='can' && window.supBase(ps.a)===window.supBase(s.a));
        if(pEv) { currentTimes[pId] = window.fT(pEv.t||s.t); currentGrps[pId] = pEv.grp || 1; }
      });
    }
    synWrap.innerHTML = window.renderPartnerSynergy(s.g, 'copy', currentTimes, currentGrps, s.d);
  }
  
  document.getElementById('copym').style.display='flex';
}

async function doPostpone(){
  try {
    const sid = window.selEvPost;
    const s = window.SCH.find(x => x.id == sid);
    if(!s) return;
    const newDate = document.getElementById('post-date').value;
    const newSup = document.getElementById('post-sup') ? document.getElementById('post-sup').value : '';
    const newAct = document.getElementById('post-act') ? document.getElementById('post-act').value : '';
    const reason = document.getElementById('post-reason') ? document.getElementById('post-reason').value : '';
    
    if (window._postMode === 'defer') {
      if(!reason.trim()) { _spAlertDialog('יש להזין סיבה לדחייה'); return; }
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
      
      const spModal = document.getElementById('sp');
      if (spModal && spModal.style.display !== 'none' && window.selEv) {
        window.openSP(window.selEv);
      }
      window.saveAndRefresh();
      document.getElementById('postm').classList.remove('open');
      showToast('הפעילות נדחתה');
      return;
    }
    
    if(!newDate) { _spAlertDialog('יש לבחור תאריך'); return; }
    
    const synergyPartners = typeof window.getSynergyData === 'function' ? window.getSynergyData('post') : [];
    const toProcess = [];
    
    // Conflict Alert Phase
    for(let syn of synergyPartners) {
      const pEv = window.SCH.find(ps => ps.d === s.d && ps.g === syn.g && ps.st !== 'can' && window.supBase(ps.a) === window.supBase(s.a));
      if(!pEv) {
        const gObj = window.G(syn.g);
        const msg = `⚠️ לצהרון ${gObj ? gObj.name : 'השותף'} לא נמצאה פעילות מקורית של ${s.a} בתאריך ${window.fD(s.d)}.\nהאם תרצה בכל זאת ליצור לו פעילות חדשה בתאריך החדש (${window.fD(newDate)})?`;
        if(!await window.spConfirm(msg)) continue;
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

    const isPostpone = newDate > s.d;
    const labelText = isPostpone ? 'נדחה' : 'הקדמה';

    const newEv1 = {
      ...s, id:newId1, d:newDate, t:s.t, a:newSup||s.a, act:newAct||s.act, st:'ok', 
      pd:'', pt:'', _postFrom: s.d, _isMakeup: true,
      nt: (s.nt ? s.nt + ' | ' : '') + `${labelText} מיום ` + window.fD(s.d)
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
      const isPostponePartner = newDate > ptEv.d;
      const partnerLabelText = isPostponePartner ? 'נדחה' : 'הקדמה';
      const newPtEv = {
        ...ptEv, id:newSynId, d:newDate, t:conf.syn.t || ptEv.t, a:newSup||s.a, act:newAct||s.act, st:'ok', 
        pd:'', pt:'', _postFrom: ptEv.d, _isMakeup: true,
        nt: (ptEv.nt ? ptEv.nt + ' | ' : '') + `${partnerLabelText} מיום ` + window.fD(ptEv.d)
      };
      delete newPtEv._recId;
      if(!conf.pEv && reason) newPtEv.n = ptEv.n ? ptEv.n + ' | נוצר מדחייה: ' + reason : 'נוצר מדחייה: ' + reason;
      else if(reason) newPtEv.n = ptEv.n ? ptEv.n + ' | נדחה: ' + reason : 'נדחה: ' + reason;
      window.SCH.push(newPtEv);
    });
    
    const toastMsg = isPostpone ? '✅ פעילות נדחתה (כולל סינרגיה)' : '✅ פעילות הוקדמה (כולל סינרגיה)';
    const spModal = document.getElementById('sp');
    if (spModal && spModal.style.display !== 'none' && window.selEv) {
      window.openSP(window.selEv);
    }
    window.saveAndRefresh('postm');
    window.showToast(toastMsg);
  } catch(e) {
    _spAlertDialog("שגיאה בביצוע הזזה: " + e.message);
  }
}

function doCopy(){
  const sid = window._copySrcId;
  const s = window.SCH.find(x => x.id == sid);
  if(!s) return;
  const newDate = document.getElementById('copy-date').value;
  const primaryTime = document.getElementById('copy-time').value;
  if(!newDate) { _spAlertDialog('יש לבחור תאריך יעד'); return; }
  
  // Primary
  const newEv1 = {...s, id:Date.now(), d:newDate, t:primaryTime || s.t, st:'ok', pd:'', pt:'', cr:'', cn:''};
  delete newEv1._recId;
  window.SCH.push(newEv1);
  
  // Synergy
  const synergyPartners = typeof window.getSynergyData === 'function' ? window.getSynergyData('copy') : [];
  synergyPartners.forEach((syn, idx) => {
    const newPtEv = {...s, id:Date.now() + idx + 1, g:syn.g, d:newDate, t:syn.t || primaryTime || s.t, st:'ok', pd:'', pt:'', cr:'', cn:'', grp: syn.grp || s.grp || 1};
    delete newPtEv._recId;
    window.SCH.push(newPtEv);
  });
  
  const spModal = document.getElementById('sp');
  if (spModal && spModal.style.display !== 'none' && window.selEv) {
    window.openSP(window.selEv);
  }
  window.saveAndRefresh('copym');
  window.showToast('✅ פעילות שוכפלה (כולל סינרגיה)');
}



// --- SYNERGY UI HELPER ---
function renderPartnerSynergy(gid, prefix, currentTimes = {}, currentGrps = {}, targetDate = null) {
  let partnerIds = [];
  if (window._currentCustomGroup && window._currentCustomGroup.includes(Number(gid))) {
    partnerIds = Array.from(new Set(window._currentCustomGroup.map(Number)));
  } else {
    const pair = window.getGardenGroup ? window.getGardenGroup(gid, targetDate) : window.gardenPair(gid, targetDate);
    if (pair && pair.ids) {
      partnerIds = pair.ids.map(Number);
    }
  }
  if (!partnerIds.length) return '';

  // Sort partners chronologically by time
  partnerIds.sort((a, b) => {
    const tA = currentTimes[a] || '99:99';
    const tB = currentTimes[b] || '99:99';
    if (tA !== tB) return tA.localeCompare(tB);
    const gA = window.G(a)?.name || '';
    const gB = window.G(b)?.name || '';
    return gA.localeCompare(gB, 'he');
  });
  
  let html = `<div style="background:#f0f4f8;border:1px solid #d1d9e6;border-radius:7px;padding:9px;margin-bottom:10px">`;
  html += `<div style="font-size:.78rem;font-weight:700;color:#1a237e;margin-bottom:6px">📌 סינרגיה: גנים מקושרים</div>`;
  html += `<div class="info-notice" style="margin-bottom:8px; padding:8px 12px; font-size:0.75rem;">
    <span class="icon">🔗</span>
    <div>הפעולה תתבצע גם עבור הגנים המסומנים מטה:</div>
  </div>`;
  html += `<div style="display:flex;flex-direction:column;gap:8px">`;
  
  partnerIds.forEach(pId => {
    const isCurrent = (Number(pId) === Number(gid));
    const pG = window.G(pId);
    if (!pG) return;
    const timeVal = currentTimes[pId] || '';
    html += `
      <div style="display:flex;align-items:center;gap:8px;background:#fff;padding:6px;border-radius:5px;border:1px solid #e0e0e0">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex:1">
          <input type="checkbox" id="${prefix}-syn-chk-${pId}" class="${prefix}-syn-chk" value="${pId}" checked ${isCurrent ? 'disabled' : ''} style="accent-color:#1565c0;width:15px;height:15px">
          <span style="font-size:.8rem;font-weight:600">${pG.name}${isCurrent ? ' (ראשי)' : ''}</span>
        </label>
        <div style="display:flex;align-items:center;gap:5px">
          <label style="font-size:.7rem;color:#546e7a">קבוצות:</label>
          <input type="number" id="${prefix}-syn-grp-${pId}" class="${prefix}-syn-grp" data-gid="${pId}" value="${currentGrps[pId] || 1}" min="1" max="10" style="padding:2px 4px;font-size:.8rem;border:1px solid #ccc;border-radius:4px;width:40px">
        </div>
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
    if (chk.checked && !chk.disabled) {
      const pId = chk.value;
      const timeInput = document.querySelector(`.${prefix}-syn-time[data-gid="${pId}"]`);
        const grpInput = document.querySelector(`.${prefix}-syn-grp[data-gid="${pId}"]`);
      data.push({ g: Number(pId), t: timeInput ? timeInput.value : '', grp: grpInput ? parseInt(grpInput.value, 10) : null });
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

function postSupChg() {
  const supName = document.getElementById('post-sup').value;
  const actSel = document.getElementById('post-act');
  if (!actSel) return;
  
  const sid = window.selEvPost;
  const s = window.SCH ? window.SCH.find(x => x.id == sid) : null;
  const targetSup = supName || (s ? s.a : null);
  
  if (!targetSup) {
    actSel.innerHTML = '<option value="">- ללא שינוי -</option>';
    return;
  }
  
  const acts = window.getSupActs ? window.getSupActs(targetSup) : [];
  actSel.innerHTML = '<option value="">- ללא שינוי -</option>' + acts.map(a => `<option value="${a}">${a}</option>`).join('');
}
window.postSupChg = postSupChg;

function postDateChg() {
  console.log('Postpone date changed');
  const sid = window.selEvPost;
  const s = window.SCH.find(x => x.id == sid);
  if(!s) return;
  const targetDate = document.getElementById('post-date').value;
  const warn = document.getElementById('post-conflict-warn');
  const saveBtn = document.getElementById('postm-save-btn');
  
  if(!targetDate) {
    if(warn) warn.style.display = 'none';
    if(saveBtn && window._postMode === 'move') {
      saveBtn.textContent = '🚀 הזז ועדכן';
    }
    return;
  }
  
  // Set dynamic button text
  if(saveBtn && window._postMode === 'move') {
    const isPostpone = targetDate > s.d;
    saveBtn.textContent = isPostpone ? '🚀 הזז ובצע דחייה' : '🚀 הזז ובצע הקדמה';
  }
  
  // Check if there is an active activity for this garden on targetDate
  const conflict = window.SCH.some(x => 
    Number(x.g) === Number(s.g) && 
    x.d === targetDate && 
    x.st !== 'can' && 
    x.st !== 'nohap' && 
    x.st !== 'post'
  );
  
  if(warn) warn.style.display = conflict ? 'block' : 'none';
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
  const freeWrap = document.getElementById('post-free-wrap');

  if(mode === 'move') {
    if(btnMove) btnMove.classList.add('active');
    if(btnDefer) btnDefer.classList.remove('active');
    if(dateRow) dateRow.style.display = 'block';
    if(timeRow) timeRow.style.display = 'block';
    if(synWrap) synWrap.style.display = 'block';
    if(freeWrap) {
      const freeDaysContainer = document.getElementById('post-free-days');
      if (freeDaysContainer && freeDaysContainer.children.length > 0) {
        freeWrap.style.display = 'block';
      } else {
        freeWrap.style.display = 'none';
      }
    }
    if(typeof window.postDateChg === 'function') {
      window.postDateChg();
    } else if(saveBtn) {
      saveBtn.textContent = '🚀 הזז ועדכן';
      saveBtn.className = 'btn borange';
    }
    if(reasonLbl) reasonLbl.textContent = 'סיבה (אופציונלי)';
  } else {
    if(btnMove) btnMove.classList.remove('active');
    if(btnDefer) btnDefer.classList.add('active');
    if(dateRow) dateRow.style.display = 'none';
    if(timeRow) timeRow.style.display = 'none';
    if(synWrap) synWrap.style.display = 'block'; // Keep synergy visible for defer too!
    if(freeWrap) freeWrap.style.display = 'none'; // Hide in defer mode
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
  
  const allPartnerIds = new Set();
  if(pair) pair.ids.forEach(id => allPartnerIds.add(Number(id)));
  allPartnerIds.delete(Number(gid));
  
  const container = document.getElementById(containerId);
  if(!container) return;
  
  const origEv = aid ? window.SCH.find(x => String(x.id) === String(aid)) : null;

  if(allPartnerIds.size === 0) {
    container.innerHTML = `<div style="font-size:0.7rem;color:#777;padding:12px;text-align:center;background:#fff;border-radius:8px;border:1px dashed #ffb74d">ℹ️ אין גנים שותפים לסנכרון אוטומטי (גן בודד)</div>`;
    return;
  }
  
  const otherIds = Array.from(allPartnerIds);
  let rowsHtml = '';
  const prefix = containerId.startsWith('ns') ? 'ns-mu' : 'sp-mu';
  const primaryMainTime = origEv ? origEv.t : (document.getElementById(prefix.startsWith('sp') ? 'sp-mu-time' : 'ns-mu-time')?.value || '');

  // Add the main garden row first
  const mainG = window.G(gid);
  if (mainG) {
    const ev = window.SCH.find(s => s.g === gid && s.d === date && s.st !== 'can');
    const stLabel = ev ? (window.stLabel ? window.stLabel(ev) : ev.st) : '—';
    const stClass = ev ? (window.stClass ? window.stClass(ev) : '') : '';
    const sup = ev ? window.supBase(ev.a) : (origEv ? window.supBase(origEv.a) : '—');
    const act = ev ? (ev.act || '—') : (origEv ? (origEv.act || '—') : '—');
    const makeupTime = primaryMainTime;
    
    rowsHtml += `<tr style="border-bottom:1px solid #eee;font-size:0.75rem;background:#f5f7ff;font-weight:bold">
      <td style="padding:6px;text-align:center">
        <input type="checkbox" class="${prefix}-syn-chk" value="${gid}" checked disabled style="width:16px;height:16px;accent-color:#e65100">
      </td>
      <td style="padding:6px;color:#1a237e">${mainG.name} (ראשי)</td>
      <td style="padding:6px">
        <input type="time" class="${prefix}-syn-time" data-gid="${gid}" value="${makeupTime}" 
          oninput="const mainTimeInp = document.getElementById('${prefix.startsWith('sp') ? 'sp-mu-time' : 'ns-mu-time'}'); if(mainTimeInp) mainTimeInp.value = this.value"
          style="width:75px;padding:2px;border:1px solid #ffb74d;border-radius:4px;font-size:0.7rem;font-weight:bold;background:#fffde7">
      </td>
      <td style="padding:6px">${sup}</td>
      <td style="padding:6px">${act}</td>
      <td style="padding:6px;text-align:center"><span class="badge ${stClass}">${stLabel}</span></td>
    </tr>`;
  }

  otherIds.forEach(pId => {
    const pG = window.G(pId);
    if(!pG) return;
    const ev = window.SCH.find(s => s.g === pId && s.d === date && s.st !== 'can');
    const origPartnerEv = origEv ? window.SCH.find(s => Number(s.g) === Number(pId) && s.d === origEv.d && window.supBase(s.a) === window.supBase(origEv.a)) : null;
    const stLabel = ev ? (window.stLabel ? window.stLabel(ev) : ev.st) : '—';
    const stClass = ev ? (window.stClass ? window.stClass(ev) : '') : '';
    const sup = ev ? window.supBase(ev.a) : (origPartnerEv ? window.supBase(origPartnerEv.a) : '—');
    const act = ev ? (ev.act || '—') : (origPartnerEv ? (origPartnerEv.act || '—') : '—');
    const makeupTime = (ev && ev.t) ? ev.t : (origPartnerEv && origPartnerEv.t) ? origPartnerEv.t : primaryMainTime;
    
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
          <tr><th style="padding:6px;width:30px"><input type="checkbox" checked onclick="const cbs=document.querySelectorAll('.${prefix}-syn-chk'); cbs.forEach(cb=>cb.checked=this.checked)"></th><th style="padding:6px">צהרון</th><th style="padding:6px">שעה</th><th style="padding:6px">ספק</th><th style="padding:6px">פעילות</th><th style="padding:6px">סטטוס</th></tr>
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

window.spSaveMakeup = async function() {
  const sid = window.selEv;
  const origEv = window.SCH.find(x => x.id == sid);
  if(!origEv) return;
  
  const newDate = document.getElementById('sp-mu-date').value;
  const time = document.getElementById('sp-mu-time').value;
  const supName = document.getElementById('sp-mu-sup').value || origEv.a;
  
  if(!newDate || !time) { _spAlertDialog('בחר תאריך ושעה'); return; }
  
  const targets = [{ g: origEv.g, t: time }, ...window.getSynergyData('sp-mu').map(tgt => ({ g: tgt.g, t: tgt.t || time, grp: tgt.grp }))];
  
  const actVal = document.getElementById('sp-mu-act').value;
  const actName = actVal === '__new__' ? (document.getElementById('sp-mu-act-new')||{}).value : 
                  (actVal ? actVal : (supName === origEv.a ? origEv.act : ''));
  
  if(actVal === '__new__' && actName) {
    const base = window.supBase(supName);
    if(!window.supEx[base]) window.supEx[base] = {};
    if(!window.supEx[base].acts) window.supEx[base].acts = window.getSupActs(supName);
    if(!window.supEx[base].acts.includes(actName)) {
      window.supEx[base].acts.push(actName);
    }
  }
  
  const grpInput = document.getElementById('sp-mu-grp');
  const customGrp = grpInput ? parseInt(grpInput.value, 10) : null;

  let totalGrps = 0;
  targets.forEach(tgt => {
    const targetOrigEv = window.SCH.find(x => 
      Number(x.g) === Number(tgt.g) && 
      x.d === origEv.d && 
      window.supBase(x.a) === window.supBase(origEv.a)
    );
    const grpCount = customGrp || tgt.grp || (targetOrigEv ? targetOrigEv.grp : origEv.grp) || 1;
    totalGrps += grpCount;
  });

  const isSchool = window.gcls ? window.gcls(window.G(origEv.g)) === 'ביה"ס' : false;
  const unitName = isSchool ? 'בתי ספר' : 'גנים';
  const grpText = totalGrps > targets.length ? ` (${totalGrps} קבוצות)` : '';
  const gardenName = window.G(origEv.g) ? window.G(origEv.g).name : 'גן';
  const confirmMsg = targets.length === 1 
    ? `לבצע שיבוץ השלמה ל-${gardenName}${grpText} בתאריך ${window.fD(newDate)}?`
    : `לבצע שיבוץ השלמה ל-${targets.length} ${unitName}${grpText} בתאריך ${window.fD(newDate)}?`;

  if(!await window.spConfirm(confirmMsg)) return;

  targets.forEach(tgt => {
    // Find the original activity for this specific target garden, or fallback to sid if not found
    const targetOrigEv = window.SCH.find(x => 
      Number(x.g) === Number(tgt.g) && 
      x.d === origEv.d && 
      window.supBase(x.a) === window.supBase(origEv.a)
    );
    const correctOrigId = targetOrigEv ? targetOrigEv.id : sid;
    const grpCount = customGrp || tgt.grp || (targetOrigEv ? targetOrigEv.grp : origEv.grp) || 1;

    window.createMakeupActivity({
      g: tgt.g,
      d: newDate,
      t: tgt.t,
      a: supName,
      act: actName,
      tp: origEv.tp || 'חוג',
      origD: origEv.d,
      origId: correctOrigId,
      grp: grpCount
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
  
  // Link back to original
  if(data.origId) {
    const origExt = window.SCH.find(x => String(x.id) === String(data.origId));
    if(origExt) {
       origExt._compByMakeup = loopId;
       const noticeNote = `השלמה נקבעה ל-${window.fD(data.d)}`;
       if(!origExt.nt || !origExt.nt.includes(noticeNote)) {
          origExt.nt = (origExt.nt ? origExt.nt + ' | ' : '') + noticeNote;
       }
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
  const syncContainer = document.getElementById('canq-sync-container');
  const syncLabel = document.getElementById('canq-sync-label');
  const syncChk = document.getElementById('canq-sync-chk');
  
  if (pair && syncContainer && syncLabel && syncChk) {
    if (window._listGroupMode === 'clusters' && pair.name) {
      syncLabel.innerHTML = `סנכרן גם לכל האשכול (<b>${pair.name}</b>)`;
      syncChk.checked = true;
      syncContainer.style.display = 'block';
    } else {
      const partnerId = pair.ids.find(gid => Number(gid) !== Number(s.g));
      const partner = window.G(partnerId);
      if (partner) {
        const pName = partner.name.startsWith('גן') ? partner.name : `גן ${partner.name}`;
        syncLabel.innerHTML = `סנכרן גם לגן בן הזוג (<b>${pName}</b>)`;
        syncChk.checked = true;
        syncContainer.style.display = 'block';
      } else {
        syncContainer.style.display = 'none';
      }
    }
  } else if (syncContainer) {
    syncContainer.style.display = 'none';
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

window.saveCanQ = async function() {
  const sel = document.querySelector('.can-reason-btn.sel');
  const mainReason = sel ? sel.dataset.r : '';
  const extra = (document.getElementById('canq-note')||{}).value?.trim() || '';
  const fullReason = [mainReason, extra].filter(Boolean).join(' — ');
  if (!mainReason && !extra) { _spAlertDialog('יש לבחור סיבת ביטול'); return; }
  
  const syncChk = document.getElementById('canq-sync-chk');
  const forPair = syncChk ? syncChk.checked : false;
  
  const s = window.SCH.find(x => x.id == _canQId); if (!s) return;
  const doCancel = async (evId) => {
    const ev = window.SCH.find(x => x.id == evId); if (!ev) return;
    ev.st = 'can'; ev.cr = mainReason || 'בוטל'; ev.cn = extra;
    // Always clear any previous "handled" stamp — a new cancellation is NOT yet handled
    ev._compByMakeup = '';
    const noteAdd = '❌ בוטל: ' + fullReason;
    if (!(ev.nt||'').includes(noteAdd)) {
      ev.nt = ev.nt ? ev.nt + ' | ' + noteAdd : noteAdd;
    }
  };
  
  doCancel(_canQId);
  if (forPair) {
    const pair = window.gardenPair(s.g);
    if (pair) {
      pair.ids.filter(gid => Number(gid) !== Number(s.g)).forEach(gid => {
        const pEv = window.findPartnerActivity(gid, s.d, s.a);
        if (pEv && pEv.st !== 'can') doCancel(pEv.id);
      });
    }
  }
  
  await window.saveAndRefresh('canqm', false);

  // Prompt for makeup
  setTimeout(async () => {
    if(await window.spConfirm('🎨 האם ברצונך לקבוע שיעור השלמה כעת?')) {
      window.openMakeupSched(_canQId);
    }
  }, 100);
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

window.saveCancelDay = async function() {
  const sel = document.querySelector('.cancelday-reason-btn.sel');
  const mainReason = sel?.dataset.r || '';
  const extra = (document.getElementById('cancelday-note')||{}).value?.trim() || '';
  const fullReason = [mainReason, extra].filter(Boolean).join(' — ');
  if (!fullReason) { _spAlertDialog('יש לבחור סיבה'); return; }
  if (!_cancelDayDs) return;
  
  const toCancel = window.SCH.filter(s => s.d === _cancelDayDs && s.st !== 'can');
  if (toCancel.length === 0) { window.showToast('אין פעילויות לביטול ביום זה'); window.CM('cancelday-m'); return; }
  if (!await window.spConfirm(`לבטל ${toCancel.length} פעילויות בתאריך ${window.fD(_cancelDayDs)}?\nסיבה: ${fullReason}`)) return;
  
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
  const syncContainer = document.getElementById('nohapq-sync-container');
  const syncLabel = document.getElementById('nohapq-sync-label');
  const syncChk = document.getElementById('nohapq-sync-chk');
  
  if(pair && syncContainer && syncLabel && syncChk){
    if (window._listGroupMode === 'clusters' && pair.name) {
      syncLabel.innerHTML = `סנכרן גם לכל האשכול (<b>${pair.name}</b>)`;
      syncChk.checked = true;
      syncContainer.style.display = 'block';
    } else {
      const partnerId = pair.ids.find(gid => Number(gid) !== Number(s.g));
      const partner = window.G(partnerId);
      if (partner) {
        const pName = partner.name.startsWith('גן') ? partner.name : `גן ${partner.name}`;
        syncLabel.innerHTML = `סנכרן גם לגן בן הזוג (<b>${pName}</b>)`;
        syncChk.checked = true;
        syncContainer.style.display = 'block';
      } else {
        syncContainer.style.display = 'none';
      }
    }
  } else if(syncContainer) {
    syncContainer.style.display='none';
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

window.saveNohapQ = async function(){
  const sel = document.querySelector('.nohap-reason-btn.sel');
  const mainReason = sel ? (sel.dataset.r || sel.textContent.replace(/^\S+ /,'').trim()) : '';
  const extra = (document.getElementById('nohapq-reason')||{}).value?.trim() || '';
  const fullReason=[mainReason,extra].filter(Boolean).join(' — ');
  if(!mainReason&&!extra){_spAlertDialog('יש לבחור סיבה');return;}
  
  const s = window.SCH.find(x => x.id == _nohapQId); if(!s) return;
  const doNohap = (evId) => {
    const ev = window.SCH.find(x => x.id == evId); if(!ev) return;
    ev.st = 'nohap';
    // Always clear any previous "handled" stamp — a new exception is NOT yet handled
    ev._compByMakeup = '';
    const isMText = (str) => str && /השלמה|במקום/i.test(str) && !str.includes('השלמה נקבעה ל-');
    const isM = !!(ev._isMakeup || ev._makeupFrom || isMText(ev.nt) || isMText(ev.n) || isMText(ev.a));
    const notePrefix = isM ? '⚠️ השלמה לא התקיימה: ' : '⚠️ לא התקיים: ';
    const noteAdd = notePrefix + fullReason;
    if (!(ev.nt||'').includes(noteAdd)) {
      ev.nt = ev.nt ? ev.nt + ' | ' + noteAdd : noteAdd;
    }
  };
  
  // Always mark main event
  doNohap(_nohapQId);
  
  // Sync pair if exists and checkbox is checked (also check _spSyncPartnerNext from spRowStatusChg)
  const pair = window.gardenPair(s.g);
  const syncChk = document.getElementById('nohapq-sync-chk');
  // _spSyncPartnerNext is set by spRowStatusChg before opening this modal
  const presetSync = (typeof window._spSyncPartnerNext !== 'undefined') ? window._spSyncPartnerNext : true;
  const shouldSync = syncChk ? syncChk.checked : presetSync;
  // Reset the preset so it doesn't bleed into next call
  window._spSyncPartnerNext = undefined;
  
  if (shouldSync) {
    const allPartnerIds = new Set();
    if (window._listGroupMode === 'clusters' && window.gardenClusters) {
      const clusterArr = window.gardenClusters(s.g, s.d);
      clusterArr.forEach(c => (c.gardenIds||[]).forEach(id => allPartnerIds.add(Number(id))));
    } else if (pair) {
      pair.ids.forEach(id => allPartnerIds.add(Number(id)));
    }
    allPartnerIds.delete(Number(s.g));
    
    Array.from(allPartnerIds).forEach(gid => {
      const pEv = window.findPartnerActivity(gid, s.d, s.a);
      if (pEv && pEv.st !== 'nohap') doNohap(pEv.id);
    });
  }

  await window.saveAndRefresh('nohapqm', false);
  
  // Prompt for makeup
  setTimeout(async () => {
    if(await window.spConfirm('🎨 האם ברצונך לקבוע שיעור השלמה כעת?')) {
      window.openMakeupSched(_nohapQId);
    }
  }, 100);
};

window.getSpFreeDaysHtml = function(gid, refDate) {
  const DAY_HEB=['ראשון','שני','שלישי','רביעי','חמישי'];
  const g = window.G(gid);
  if(!g) return '';

  const busyDates = new Set(window.SCH.filter(x => {
    if(Number(x.g) !== Number(gid)) return false;
    if(x.st === 'can' || x.st === 'nohap' || x.st === 'post') return false;
    return true;
  }).map(x=>x.d));
  
  const free = []; let d = new Date(refDate || window._calDate || window.td()); d.setHours(0,0,0,0);
  
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
  
  if(!free.length) return '<span style="color:#777;font-size:0.75rem">לא נמצאו ימים פנויים ב-3 השבועות הקרובים</span>';
  
  return free.map(f => `
    <span style="font-size:0.7rem;padding:4px 8px;background:#e8f5e9;color:#2e7d32;border:1px solid #c8e6c9;border-radius:4px;display:inline-block;margin:2px;font-weight:700;cursor:pointer;" onclick="const d=document.getElementById('sp-dup-date'); if(d){ d.value='${f.ds}'; d.scrollIntoView({behavior:'smooth', block:'center'}); setTimeout(()=>d.focus(), 300); }">
      ${f.lbl}
    </span>
  `).join('');
};

window.jumpToCalendar = function(pairId, gid, dateStr, eventId) {
  if (window.calJump) {
    if (pairId && pairId !== 'undefined') window.calJump(pairId, 'week', null);
    else window.calJump(null, 'week', gid);
  }
  if (window.goDate) window.goDate(dateStr);
  setTimeout(() => { if (window.openSP) window.openSP(eventId); }, 300);
};





window.autoScheduleMakeupToDate = function(eventId, dateStr) {
  if (window.openMakeupSched) {
    window.openMakeupSched(eventId);
    let attempts = 0;
    const setDateInput = () => {
      const dateInput = document.getElementById('sp-mu-date');
      if (dateInput) {
        dateInput.value = dateStr;
        dateInput.dispatchEvent(new Event('change'));
      } else if (attempts < 15) {
        attempts++;
        setTimeout(setDateInput, 100);
      }
    };
    setTimeout(setDateInput, 150);
  }
};

window.getPairSharedFreeDaysHtml = function(gids, nohapEvId = '', refDate) {
  if (!gids || gids.length === 0) return '';
  const DAY_HEB = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];
  
  const busyDates = new Set();
  gids.forEach(gid => {
    window.SCH.forEach(x => {
      if (Number(x.g) === Number(gid)) {
        if (x.st !== 'can' && x.st !== 'nohap' && x.st !== 'post') {
          busyDates.add(x.d);
        }
      }
    });
  });

  const free = [];
  let d = new Date(refDate || window._calDate || window.td());
  d.setHours(0, 0, 0, 0);

  // Search up to 21 days, limit to 8 free days
  for (let i = 0; i < 21 && free.length < 8; i++) {
    const dow = d.getDay();
    if (dow >= 0 && dow <= 4) {
      const ds = window.d2s(d);
      const isToday = i === 0;

      let hasHoliday = false;
      for (const gid of gids) {
        const g = window.G(gid);
        if (g) {
          const hol = window.getHolidayInfo(ds, g.city, window.gcls(g));
          if (hol && !isToday) {
            hasHoliday = true;
            break;
          }
        }
      }

      if (!busyDates.has(ds) && !hasHoliday) {
        free.push({ ds, lbl: DAY_HEB[dow] + ' ' + window.fD(ds) });
      }
    }
    d.setDate(d.getDate() + 1);
  }

  if (!free.length) {
    return '<span style="color:#ef4444; font-size:0.68rem; font-weight:600;">אין ימים פנויים בשבועות הקרובים</span>';
  }

  return free.map(f => {
    if (nohapEvId) {
      return `
        <button class="btn" 
                style="font-size:0.68rem; padding:3px 9px; background:#f1fcf4; color:#1b5e20; border:1px solid #c8e6c9; border-radius:6px; font-weight:700; white-space:nowrap; display:inline-block; margin: 2px; cursor:pointer; transition: transform 0.1s; line-height:1.2;"
                onclick="event.stopPropagation(); window.autoScheduleMakeupToDate('${nohapEvId}', '${f.ds}')"
                onmouseover="this.style.background='#e8f5e9'; this.style.transform='scale(1.05)';"
                onmouseout="this.style.background='#f1fcf4'; this.style.transform='none';">
          ${f.lbl}
        </button>
      `;
    } else {
      return `
        <span style="font-size:0.68rem; padding:3px 9px; background:#f1fcf4; color:#1b5e20; border:1px solid #c8e6c9; border-radius:6px; font-weight:700; white-space:nowrap; display:inline-block; margin: 2px; line-height:1.2; cursor:pointer;" onclick="const d=document.getElementById('sp-dup-date'); if(d){ d.value='${f.ds}'; d.scrollIntoView({behavior:'smooth', block:'center'}); setTimeout(()=>d.focus(), 300); }">
          ${f.lbl}
        </span>
      `;
    }
  }).join(' ');
};

// --- CUSTOM DAILY GROUP LOGIC ---
window.openCustomDailyGroupModal = function() {
    window.OM('custom-group-setup-m');
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('cgm-date').value = today;
    
    // Populate suppliers dropdown
    const sups = window.getAllSup ? window.getAllSup().filter(s => window.isActSupplier(s.name)) : [];
    sups.sort((a,b) => a.name.localeCompare(b.name, 'he'));
    let supOpts = '<option value="">בחר ספק...</option>';
    sups.forEach(s => {
        supOpts += '<option value="' + s.name + '">' + s.name + '</option>';
    });
    document.getElementById('cgm-sup').innerHTML = supOpts;
    
    window.cgmUpdateOptions();
};

window.cgmUpdateOptions = function() {
    const d = document.getElementById('cgm-date').value;
    const sup = document.getElementById('cgm-sup').value;
    const container = document.getElementById('cgm-gids-container');
    container.innerHTML = '';
    
    if (!d || !sup) return;
    
    // Find all gardens that have an activity for this supplier on this date
    const acts = window.SCH.filter(x => x.d === d && window.supBase(x.a) === window.supBase(sup) && x.st !== 'can' && x.st !== 'nohap');
    if (acts.length === 0) {
        container.innerHTML = '<div style="color:#757575;font-size:0.8rem">לא נמצאו גנים משובצים לספק זה ביום הנבחר.</div>';
        return;
    }
    
    let gids = new Set();
    acts.forEach(x => gids.add(Number(x.g)));
    
    const gardenArray = Array.from(gids).map(id => window.G(id)).filter(Boolean);
    gardenArray.sort((a,b) => (a.name||'').localeCompare(b.name||'','he'));
    
    let h = '';
    gardenArray.forEach(g => {
        h += '<label style="display:flex;align-items:center;gap:8px;padding:4px;cursor:pointer;border-bottom:1px solid #f0f0f0">' +
                '<input type="checkbox" class="cgm-garden-cb" value="' + g.id + '" checked>' +
                '<span>' + g.name + ' (' + g.city + ')</span>' +
              '</label>';
    });
    container.innerHTML = h;
};

window.cgmOpenGroup = function() {
    const d = document.getElementById('cgm-date').value;
    const sup = document.getElementById('cgm-sup').value;
    if (!d || !sup) {
        alert('אנא בחר תאריך וספק');
        return;
    }
    
    const cbs = document.querySelectorAll('.cgm-garden-cb:checked');
    if (cbs.length === 0) {
        alert('יש לבחור לפחות גן אחד');
        return;
    }
    
    const selectedGids = Array.from(cbs).map(cb => Number(cb.value));
    
    // We need to find ONE "main activity" to pass to openSP
    // We will use the first one we find for these gardens on that date
    let mainAct = null;
    for (let gid of selectedGids) {
        mainAct = window.SCH.find(x => x.d === d && window.supBase(x.a) === window.supBase(sup) && Number(x.g) === gid);
        if (mainAct) break;
    }
    
    if (!mainAct) {
        alert('שגיאה: לא נמצאה פעילות');
        return;
    }
    
    // Set global flag
    window._currentCustomGroup = selectedGids;
    
    window.CM('custom-group-setup-m');
    window.openSP(mainAct.id);
};


