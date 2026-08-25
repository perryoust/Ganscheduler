
function td(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
window.td = td;

function refreshAppUI(){
  try { if(typeof window.updCounts === 'function') window.updCounts(); } catch(e){ console.error("updCounts failed", e); }
  try { if(typeof window.renderDash === 'function') window.renderDash(); } catch(e){ console.error("renderDash failed", e); }
  try { if(typeof window.renderSched === 'function') window.renderSched(); } catch(e){ console.error("renderSched failed", e); }
  try { if(typeof window.renderCal === 'function') window.renderCal(); } catch(e){ console.error("renderCal failed", e); }
  try { if(typeof window.renderGardens === 'function') window.renderGardens(); } catch(e){ console.error("renderGardens failed", e); }
}
window.refreshAppUI = refreshAppUI;

function calculateStats() {
  const tab = (typeof window._dashTab !== 'undefined' ? window._dashTab : 'g');
  const cls = (tab === 'g' ? 'גנים' : 'ביה"ס');
  const sch = window.SCH || [];
  const gdns = window.GARDENS || [];

  // Read Dashboard Filters
  const date = (window.getEl('dash-date')||{}).value || '';
  const city = (window.getEl('dash-city')||{}).value || '';
  const sup = (window.getEl('dash-sup')||{}).value || '';
  const from = (window.getEl('dash-from')||{}).value || '';
  const to = (window.getEl('dash-to')||{}).value || '';
  const srch = ((window.getEl('dash-srch')||{}).value || '').toLowerCase();

  // Helper logic for classification
  const getGcls = (g) => {
    if (typeof window.gcls === 'function') return window.gcls(g);
    if (!g || !g.cls) return 'גנים';
    const c = g.cls.trim();
    if (c.includes('גן')) return 'גנים';
    if (c.includes('בית') || c.includes('בי"ס') || c.includes('ביה"ס') || c.includes('ביהס') || c.includes('ספר')) return 'ביה"ס';
    return 'גנים';
  };

  const baseSch = sch.filter(s => {
    const g = window.G(s.g);
    if (!g) return false;
    
    if (city && g.city !== city) return false;
    if (sup && window.supBase(s.a) !== sup) return false;
    if (srch && ![(g.name||''), (g.city||''), s.a, s.act, s.nt].some(v=>(v||'').toLowerCase().includes(srch))) return false;
    
    if (from && s.d < from) return false;
    if (to && s.d > to) return false;
    
    return true;
  });

  // 2. Calculate Stats
  const today = td();
  const stats = baseSch.reduce((acc, s) => {
    const isHandled = !!(s._compByMakeup && s._compByMakeup !== "false") || !!((s.nt && /הוקדם ל|נדחה ל|הוזז ל|הקדמה ל|דחייה ל|עבר ל|עובר ל|הועבר ל/i.test(s.nt)) || (s.n && /הוקדם ל|נדחה ל|הוזז ל|הקדמה ל|דחייה ל|עבר ל|עובר ל|הועבר ל/i.test(s.n)));
    const isM = !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.nt)) || (s.n && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.n)) || (s.a && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.a)));
    const isException = (s.st === 'nohap' || s.st === 'post') && !isHandled;
    const isMakeupBacklog = isM && s.st !== 'can' && s.st !== 'done' && s.d >= today;
    
    const onSelectedDate = (!from && !to && date) ? (s.d === date) : true;

    // Backlog counts (Ignore date filter)
    if (isException) {
      if (s.st === 'nohap') acc.nohap++;
      if (s.st === 'post') acc.post++;
      if (!isM) acc.todo++;
    }
    if (isMakeupBacklog) acc.makeups++;

    // Date-respecting counts (Respect date filter)
    if (onSelectedDate) {
      acc.all++;
      if (s.st === 'can') acc.can++;
      if (isHandled || s.st === 'done' || (isM && s.st !== 'can' && s.d < today)) {
        acc.handled++;
      }
    }

    return acc;
  }, { todo: 0, can: 0, post: 0, nohap: 0, makeups: 0, handled: 0, all: 0 });
  return stats;
}
window.getDashStats = calculateStats;

function updUIStats() {
  const stats = calculateStats();
  const setEl = (id, v) => { 
    const m = document.getElementById(id + '-mobile');
    const d = document.getElementById(id + '-desktop');
    const r = document.getElementById(id);
    if (m) m.textContent = v;
    if (d) d.textContent = v;
    if (r) r.textContent = v;
    
    // Also try legacy header IDs
    const hId = 'h-' + id.replace('d-', '').replace('dvp-cnt-', '').replace('-cnt', '');
    const hm = document.getElementById(hId + '-mobile');
    const hd = document.getElementById(hId + '-desktop');
    const hr = document.getElementById(hId);
    if (hm) hm.textContent = v;
    if (hd) hd.textContent = v;
    if (hr) hr.textContent = v;
  };
  
  // Dashboard Boxes (Quick Stats)
  setEl('d-todo-cnt', stats.todo);
  setEl('d-can', stats.can);
  setEl('d-post', stats.post);
  setEl('d-nohap', stats.nohap);
  setEl('d-makeups', stats.makeups);
  setEl('d-handled', stats.handled);
  setEl('d-total', stats.all.toLocaleString());

  // Header Stats (Desktop/Mobile sync)
  const hPairs = window.getEl('h-pairs');
  if(hPairs) hPairs.textContent = (window.pairs || []).length;
  
  const hSched = window.getEl('h-sched');
  if(hSched) hSched.textContent = (window.SCH || []).length.toLocaleString();

  const hGardens = window.getEl('h-gardens');
  if(hGardens) {
    const tab = (typeof window._dashTab !== 'undefined' ? window._dashTab : 'g');
    const cls = (tab === 'g' ? 'גנים' : 'ביה"ס');
    const allGans = Array.from(new Map([...(window.GARDENS || []), ...(window._GARDENS_EXTRA || [])].map(g => [g.id, g])).values());
    const activeGardenIds = new Set((window.SCH || []).map(s => String(s.g)));
    const gardenCount = allGans.filter(g => window.gcls(g) === cls && activeGardenIds.has(String(g.id))).length;
    hGardens.textContent = gardenCount;
  }

  // Invoices
  if (typeof window.INVOICES !== 'undefined') {
    setEl('h-inv', window.INVOICES.length);
    if (typeof _migrateInvStatus === 'function') {
      setEl('h-inv-active', window.INVOICES.filter(i => _migrateInvStatus(i.status) === 'order').length);
      setEl('h-inv-prog', window.INVOICES.filter(i => _migrateInvStatus(i.status) === 'tx_invoice').length);
    }
  }

  // Dashboard Pill Badges (Desktop/Mobile sync via getEl)
  setEl('dvp-cnt-todo', stats.todo);
  setEl('dvp-cnt-nohap', stats.nohap);
  setEl('dvp-cnt-post', stats.post);
  setEl('dvp-cnt-handled', stats.handled);
  setEl('dvp-cnt-all', stats.all.toLocaleString());
  setEl('dvp-cnt-can', stats.can);
  setEl('dvp-cnt-makeups', stats.makeups);
}
window.updCounts = updUIStats;


function initDrops(){
  const cs=cities();
  function fC(id){
    const items = cs.map(c => `<option value='${c}'>${c}</option>`).join('');
    ['', '-desktop', '-mobile'].forEach(suffix => {
      const el = document.getElementById(id + suffix);
      if (el) {
        const firstOpt = el.querySelector('option[value=""]');
        const firstHtml = firstOpt ? firstOpt.outerHTML : '';
        el.innerHTML = firstHtml + items;
      }
    });
  }
  function fG(id,first,prefix){
    const items = `<option value="">${first}</option>` + [...GARDENS].sort((a,b)=>{
      const cc=(a.city||'').localeCompare(b.city||'','he');
      return cc||((a.name||'').localeCompare(b.name||'','he'));
    }).map(g=>`<option value='${g.id}'>${prefix?g.city+' · ':''} ${g.name}</option>`).join('');
    
    ['', '-desktop', '-mobile'].forEach(suffix => {
      const el = document.getElementById(id + suffix);
      if (el) el.innerHTML = items;
    });
  }
  fC('dash-city');fC('s-city');fC('g-city');fC('apm-city');fC('pairs-city');fC('cl-city');
  // Filter dropdowns (search/filter): show ONLY act suppliers in חוגים views
  ['dash-sup','s-sup'].forEach(id=>{
    ['', '-desktop', '-mobile'].forEach(suffix => {
      const el = document.getElementById(id + suffix);
      if (el) {
        const firstOpt = el.querySelector('option[value=""]');
        const firstHtml = firstOpt ? firstOpt.outerHTML : '';
        el.innerHTML = firstHtml;
      }
    });
  });
  getAllSup().filter(s=>window.isActSupplier(s.name)).forEach(s=>{
    const disp = window.supNameLabel(s.name) !== s.name ? window.supNameLabel(s.name) + ' (' + s.name + ')' : s.name;
    ['dash-sup','s-sup'].forEach(id=>{
      ['', '-desktop', '-mobile'].forEach(suffix => {
        const el = document.getElementById(id + suffix);
        if (el) el.innerHTML += `<option value='${s.name.replace(/'/g, "&#39;")}'>${disp}</option>`;
      });
    });
  });
  
  // Scheduling dropdowns: show ONLY act suppliers (isAct=true)
  ['ns-sup','es-sup'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) {
      const firstOpt = el.querySelector('option[value=""]');
      const firstHtml = firstOpt ? firstOpt.outerHTML : '';
      el.innerHTML = firstHtml;
    }
  });
  getAllSup().filter(s=>window.isActSupplier(s.name)).forEach(s=>{
    const disp = window.supNameLabel(s.name) !== s.name ? window.supNameLabel(s.name) + ' (' + s.name + ')' : s.name;
    ['ns-sup','es-sup'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML+=`<option value='${s.name.replace(/'/g, "&#39;")}'>${disp}</option>`;});
  });
  fG('cal-g1','כל הצהרונים',true);fG('cal-g2','—',true);fG('cal-g3','—',true);
  fG('s-g1','כל הצהרונים',true);fG('s-g2','—',true);fG('s-g3','—',true);
  fG('apm-g1','בחר צהרון',true);fG('apm-g2','בחר צהרון',true);fG('apm-g3','—',true);
  ['', '-desktop', '-mobile'].forEach(suffix => {
    const el = document.getElementById('cal-dp' + suffix);
    if (el) el.value = td();
  });
  // Default calendar to גנים tab
  ['', '-desktop', '-mobile'].forEach(suffix => {
    const el = document.getElementById('cal-cls' + suffix);
    if (el) el.value = 'גנים';
  });
  if (window.initCalFilters) window.initCalFilters();
}

window.TABS=['dash','cal','sched','gardens','pairs','holidays','clusters','sup','managers','admin'];
window.currentTab='cal';

// ─── GLOBAL NAVIGATION SEARCH ────────────────────────────────────────────────
function navSearchInput(val){
  const res=document.getElementById('nav-search-results');
  if(!res) return;
  const q=(val||'').trim().toLowerCase();
  if(!q){ res.style.display='none'; return; }

  const results=[];

  // Search gardens
  const allG=[...GARDENS,...(_GARDENS_EXTRA||[])];
  allG.forEach(g=>{
    if(!(g.name||'').toLowerCase().includes(q)&&!(g.city||'').toLowerCase().includes(q)) return;
    results.push({
      icon: gcls(g)==='ביה"ס'?'🏛️':'🏫',
      label: `${g.name}`,
      sub: g.city||'',
      action: `switchMode('act');ST('gardens');setTimeout(()=>openGM(${g.id}),200);navSearchClose();`
    });
  });

  // Search suppliers
  getAllSup().forEach(s=>{
    const base=supBase(s.name);
    if(!base.toLowerCase().includes(q)) return;
    results.push({
      icon:'🏢',
      label: base,
      sub: window.isActSupplier(base)?'ספק חוגים':'ספק',
      action: `switchMode('act');ST('sup');setTimeout(()=>openSupCard('${base.replace(/'/g,"\\'")}'),200);navSearchClose();`
    });
  });

  // Search events (by supplier name or garden)
  if(q.length>=2){
    const evMatches=SCH.filter(s=>{
      if(s.st==='can') return false;
      return (s.a||'').toLowerCase().includes(q)||(G(s.g)?.name||'').toLowerCase().includes(q);
    }).slice(0,5);
    evMatches.forEach(s=>{
      const g=G(s.g);
      results.push({
        icon:'📅',
        label:`${supBase(s.a)} — ${g?.name||''}`,
        sub: `${fD(s.d)} ${s.t?fT(s.t):''}`,
        action: `switchMode('act');ST('cal');setTimeout(()=>{goDate('${s.d}');setTimeout(()=>openSP('${s.id}'),200);},150);navSearchClose();`
      });
    });
  }

  if(!results.length){
    res.innerHTML='<div style="padding:10px 14px;color:#999;font-size:.82rem">לא נמצאו תוצאות</div>';
    res.style.display='block'; return;
  }

  res.innerHTML='';
  results.slice(0,12).forEach(r=>{
    const el=document.createElement('div');
    el.style.cssText='padding:8px 12px;cursor:pointer;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:10px';
    el.innerHTML=`
      <span style="font-size:1.1rem;flex-shrink:0">${r.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:.82rem;color:#1a237e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.label}</div>
        ${r.sub?`<div style="font-size:.72rem;color:#78909c">${r.sub}</div>`:''}
      </div>`;
    el.addEventListener('mouseover',()=>el.style.background='#f5f7ff');
    el.addEventListener('mouseout', ()=>el.style.background='');
    el.addEventListener('click', new Function(r.action));
    res.appendChild(el);
  });
  res.style.display='block';
}

function navSearchClose(){
  const res=document.getElementById('nav-search-results');
  if(res) res.style.display='none';
  const inp=document.getElementById('nav-search-input');
  if(inp) inp.value='';
}
// ─────────────────────────────────────────────────────────────────────────────

function ST(t){
  currentTab=t;
  // Always close side panel + backdrop when switching tabs (critical for mobile)
  const _spEl=document.getElementById('sp');
  const _bdEl=document.getElementById('sp-backdrop');
  if(_spEl) _spEl.classList.remove('open');
  if(_bdEl) _bdEl.style.display='none';
  selEv=null;
  // Find the correct tab button by matching onclick attribute — not by index
  // (TABS array has hidden tabs like 'pairs','clusters','managers' that have no button)
  document.querySelectorAll('#tabs-act .tab').forEach(btn=>{
    const fn = btn.getAttribute('onclick')||'';
    btn.classList.toggle('active', fn.includes(`'${t}'`) || fn.includes(`"${t}"`));
  });
  
  // Hide all act panels + admin panel + purch panels, show only active
  const allPanels = [...TABS, 'admin', 'pdash', 'pinvoices', 'psup'];
  allPanels.forEach(x=>{
    const panelEl=document.getElementById('p-'+x);
    if(panelEl){
      const isActive = x===t;
      if(isActive) panelEl.style.display='block';
      else panelEl.style.display='none';
    }
  });

  // purch panels are managed by switchMode, not ST
  if(t==='admin' || t==='worker_tasks'){
    document.getElementById('mode-bar').scrollIntoView();
    // Switch mode visuals to clear mode styling
    document.body.classList.remove('mode-purch');
    document.getElementById('tabs-act').style.display='none';
    document.getElementById('tabs-purch').style.display='none';
    document.getElementById('modeBtn-act').classList.remove('active');
    document.getElementById('modeBtn-purch').classList.remove('active');
    
    if(t==='admin') {
      const adminBtn = document.getElementById('modeBtn-admin');
      if(adminBtn) adminBtn.classList.add('active');
      const workerBtn = document.getElementById('modeBtn-worker');
      if(workerBtn) workerBtn.classList.remove('active');
      // Refresh log stats periodically while admin is open
      if(window._admInt) clearInterval(window._admInt);
      window._admInt=setInterval(()=>{if(currentTab==='admin'&&typeof updateLogStats==='function')updateLogStats()},3000);
      // Load admin data
      if(typeof loadUsersList==='function') setTimeout(loadUsersList,300);
      if(typeof loadActivityLog==='function') setTimeout(()=>loadActivityLog(document.getElementById('log-filter')?.value||'week'),500);
    } else {
      const adminBtn = document.getElementById('modeBtn-admin');
      if(adminBtn) adminBtn.classList.remove('active');
      const workerBtn = document.getElementById('modeBtn-worker');
      if(workerBtn) workerBtn.classList.add('active');
    }
    
    // Hide mobile nav purch if open
    const mnPurch = document.getElementById('mob-nav-purch');
    if (mnPurch) mnPurch.style.display = 'none';
  }
  if(t==='sched') { if(window.renderSched) window.renderSched(); }
  if(t==='gardens'){ if(window.renderGardens) window.renderGardens(); if(window.refreshMgrDrops) window.refreshMgrDrops(); }
  if(t==='cal'){
    if(window.setView) window.setView('list');
    if(window.setListSubView) window.setListSubView('day');
    // Restore nav buttons in case they were hidden by range view
    if(window.calV!=='range'){
      document.querySelectorAll('[onclick*="navCal(-1)"],[onclick*="navCal(1)"]').forEach(b=>b.style.display='');
    }
    if(window.renderCal) window.renderCal();
  }
  if(t==='pairs') { if(window.renderPairs) window.renderPairs(); }
  if(t==='holidays'){ if(window.initHolDrops) window.initHolDrops(); if(window.renderHolidays) window.renderHolidays(); }
  if(t==='clusters') { if(window.renderClusters) window.renderClusters(); }
  if(t==='managers'){ if(window.renderManagers) window.renderManagers(); if(window.refreshMgrDrops) window.refreshMgrDrops(); }
  if(t==='sup') { if(window.renderSup) window.renderSup(); }
  setTimeout(window._fitScrollAreas, 120);
}

function getAllGardens(){ return typeof AG === 'function' ? AG() : [...(window.GARDENS||[]), ...(window._GARDENS_EXTRA||[])]; }
function openAddGarden(){
  document.getElementById('addg-name').value='';
  document.getElementById('addg-st').value='';
  document.getElementById('addg-co').value='';
  document.getElementById('addg-dfrom').value='';
  document.getElementById('addg-dto').value='';
  const cityEl=document.getElementById('addg-city');
  cityEl.innerHTML='<option value="">בחר עיר...</option>';
  cities().forEach(c=>cityEl.innerHTML+=`<option value='${c}'>${c}</option>`);
  const fill=id=>{
    const el=document.getElementById(id);
    el.innerHTML='<option value="">ללא</option>';
    GARDENS.sort((a,b)=>a.name.localeCompare(b.name,'he')).forEach(g=>el.innerHTML+=`<option value='${g.id}'>${g.city} · ${g.name}</option>`);
  };
  fill('addg-partner');fill('addg-partner3');
  const clEl=document.getElementById('addg-cluster');
  clEl.innerHTML='<option value="">ללא אשכול</option><option value="__new__">➕ אשכול חדש...</option>';
  getClusters().forEach(cl=>clEl.innerHTML+=`<option value='${cl.id}'>${cl.name}</option>`);
  clEl.onchange=()=>{
    document.getElementById('addg-cluster-new-wrap').style.display=clEl.value==='__new__'?'block':'none';
  };
  document.getElementById('addgm').classList.add('open');
}
function saveNewGarden(){
  const name=document.getElementById('addg-name').value.trim();
  const city=document.getElementById('addg-city').value;
  const cls=document.getElementById('addg-cls').value;
  if(!name||!city){_spAlertDialog('יש למלא שם ועיר');return;}
  const newId=Date.now();
  const newG={id:newId,name,city,
    st:document.getElementById('addg-st').value.trim(),
    co:document.getElementById('addg-co').value.trim(),
    cls,
    dfrom:document.getElementById('addg-dfrom').value,
    dto:document.getElementById('addg-dto').value
  };
  _GARDENS_EXTRA.push(newG);
  const partnerId=parseInt(document.getElementById('addg-partner').value)||null;
  const partner3Id=parseInt(document.getElementById('addg-partner3').value)||null;
  if(partnerId){
    const ids=[newId,partnerId,partner3Id].filter(Boolean);
    const pName=ids.map(id=>{const g=GARDENS.find(x=>x.id===id)||_GARDENS_EXTRA.find(x=>x.id===id);return g?g.name:'';}).join(' + ');
    const targetId = Date.now()+1;
    pairs.push({id:targetId,ids,name:pName});
    // Cleanup duplicates from other pairs
    window.pairs = window.pairs.map(p => {
      if (p.id === targetId) return p;
      return { ...p, ids: p.ids.filter(id => !ids.map(Number).includes(Number(id))) };
    }).filter(p => p.ids.length >= 2);
  }
  const clVal=document.getElementById('addg-cluster').value;
  if(clVal&&clVal!=='__new__'){
    if(clusters[clVal]&&!clusters[clVal].gardenIds.includes(newId)) clusters[clVal].gardenIds.push(newId);
  } else if(clVal==='__new__'){
    const clName=document.getElementById('addg-cluster-new').value.trim();
    if(clName){
      const clId='cl_'+Date.now();
      clusters[clId]={id:clId,name:clName,desc:'',gardenIds:[newId]};
    }
  }
  if(!supEx['__gardens_extra']) supEx['__gardens_extra']=[];
  supEx['__gardens_extra'].push(newG);
  save();CM('addgm');refresh();refreshClusterDrops();
  _spAlertDialog('✅ '+name+' נוסף בהצלחה!');
}
let _sucName=null;
// ── Supplier card: tab between activities and documents ─────────────
let _sucTab = 'acts'; // 'acts' | 'docs'

function setSucTab(tab){
  _sucTab = tab;
  document.getElementById('suc-tab-acts')?.classList.toggle('active', tab==='acts');
  document.getElementById('suc-tab-docs')?.classList.toggle('active', tab==='docs');
  document.getElementById('suc-acts-section').style.display = tab==='acts' ? '' : 'none';
  document.getElementById('suc-docs-section').style.display = tab==='docs' ? '' : 'none';
  // suc-body holds the schedule table — hide it when viewing docs
  const sucBody = document.getElementById('suc-body');
  if(sucBody) sucBody.style.display = tab==='acts' ? '' : 'none';
  if(tab==='docs') renderSupDocs();
  else renderSupCard();
}

function initSucTabs(){
  const name = _sucName;
  // Determine supplier type based on explicit flags AND actual data
  const isAct = window.isActSupplier(name);
    const isPurch = window.isPurchSupplier(name);
    const btnExpAct = document.getElementById('suc-btn-exp-act');
    const btnExpPurch = document.getElementById('suc-btn-exp-purch');
    if(btnExpAct) btnExpAct.style.display = isAct ? 'inline-flex' : 'none';
    if(btnExpPurch) btnExpPurch.style.display = isPurch ? 'inline-flex' : 'none';

    const tabsDiv = document.getElementById('suc-section-tabs');
    const actsDiv = document.getElementById('suc-acts-section');
    const docsDiv = document.getElementById('suc-docs-section');
    if(!tabsDiv||!actsDiv||!docsDiv) return;

  if(isAct && isPurch){
    // Show tabs, default based on mode
    tabsDiv.style.display = 'block';
    const isModePurch = (typeof _appMode!=='undefined' && _appMode==='purch');
    setSucTab(isModePurch ? 'docs' : 'acts');
  } else if(isPurch && !isAct){
    // Pure purch: show only docs
    tabsDiv.style.display = 'none';
    actsDiv.style.display = 'none';
    docsDiv.style.display = '';
    _sucTab='docs';
    renderSupDocs();
  } else {
    // Pure חוגים: show only acts
    tabsDiv.style.display = 'none';
    actsDiv.style.display = '';
    docsDiv.style.display = 'none';
    _sucTab='acts';
  }
}

function renderSupDocs(){
  const el = document.getElementById('suc-docs-body');
  const totalEl = document.getElementById('suc-docs-total');
  if(!el) return;
  const srch = (document.getElementById('suc-doc-srch')?.value||'').toLowerCase();
  const stf = document.getElementById('suc-doc-status')?.value||'';
  let invs = INVOICES.filter(i=>supBase(i.supName||'')===_sucName);
  if(srch) invs = invs.filter(i=>
    (i.orderNum||'').toLowerCase().includes(srch)||
    (i.txNum||'').toLowerCase().includes(srch)||
    (i.num||'').toLowerCase().includes(srch)||
    (i.orderDesc||'').toLowerCase().includes(srch)
  );
  if(stf) invs = invs.filter(i=>_migrateInvStatus(i.status)===stf);
  invs = [...invs].sort((a,b)=>(b.orderDate||b.txDate||b.date||'').localeCompare(a.orderDate||a.txDate||a.date||''));

  if(!invs.length){
    el.innerHTML='<div style="color:#aaa;text-align:center;padding:16px;font-size:.8rem">אין מסמכים</div>';
    if(totalEl) totalEl.textContent='';
    return;
  }
  const fmtSt = s=>{const m={order:'📋',tx_invoice:'🧾',tax_invoice:'📑',tax_receipt:'📑🧾',receipt:'📄',cancelled:'❌'};return m[s]||m[_migrateInvStatus(s)]||'📄';};
  const total = invs.reduce((s,i)=>s+(i.orderAmt||i.txAmt||i.amt||0),0);
  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:.78rem">
    <thead><tr style="background:#e8eaf6;position:sticky;top:0">
      <th style="padding:5px 8px;text-align:right">תאריך</th>
      <th style="padding:5px 8px;text-align:right">מסמך</th>
      <th style="padding:5px 8px;text-align:right">פירוט</th>
      <th style="padding:5px 8px;text-align:right;white-space:nowrap">סכום</th>
      <th style="padding:5px 8px;text-align:center">סטטוס</th>
      <th style="padding:5px 8px"></th>
    </tr></thead>
    <tbody>
    ${invs.map(inv=>{
      const d = inv.orderDate||inv.txDate||inv.date||'';
      const docNum = inv.orderNum||inv.txNum||inv.num||'—';
      const amt = inv.orderAmt||inv.txAmt||inv.amt||0;
      const amtStr = amt ? `₪${withVat(amt,inv.vat||18).toLocaleString()}` : '—';
      return `<tr style="border-bottom:1px solid #f0f0f0;cursor:pointer" onclick="CM('sucard-m');openNewInvoice(${inv.id})">
        <td style="padding:5px 8px;white-space:nowrap">${d?fD(d):'—'}</td>
        <td style="padding:5px 8px;font-weight:700;color:#1565c0">${docNum}</td>
        <td style="padding:5px 8px;color:#546e7a;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${inv.orderDesc||''}</td>
        <td style="padding:5px 8px;font-weight:700;color:#2e7d32;white-space:nowrap">${amtStr}</td>
        <td style="padding:5px 8px;text-align:center">${fmtSt(inv.status)}</td>
        <td style="padding:5px 8px" onclick="event.stopPropagation()"><button class="btn bo bsm" style="font-size:.65rem" onclick="CM('sucard-m');openNewInvoice(${inv.id})">✏️</button></td>
      </tr>`;
    }).join('')}
    </tbody></table>`;
  if(totalEl) totalEl.textContent = `${invs.length} מסמכים · סה"כ: ₪${total.toLocaleString()} לפני מע"מ`;
}

function sucOpenNewDoc(){
  CM('sucard-m');
  openNewInvoice(null, _sucName);
}

function sucExportDocs(){
  if(typeof exportSupPurchDocs==='function') exportSupPurchDocs(_sucName);
  else showToast('❌ יצוא לא זמין');
}

function openSupCard(name){
  _sucName=supBase(name); // normalize to base name
  // Clear previous content first
  const body=document.getElementById('suc-body');
  if(body) body.innerHTML='';
  document.getElementById('suc-edit-panel').style.display='none';
  document.getElementById('suc-view').style.display='block';
  sucRefreshInfo();
  initSucTabs(); // set correct tab (acts vs docs) based on supplier type
  const now=new Date();
  const sfrom=document.getElementById('suc-from');
  const sto=document.getElementById('suc-to');
  sfrom.value=d2s(new Date(now.getFullYear(),now.getMonth(),1));
  sto.value=d2s(new Date(now.getFullYear(),now.getMonth()+1,0));
  document.getElementById('suc-st').value='';
  sucRefreshActFilt();
  // Only render activities if supplier has actual schedule entries
  const _hasSchEntries = SCH.some(s=>supBase(s.a)===_sucName);
  if(_hasSchEntries) renderSupCard();
  if (typeof window.OM === 'function') window.OM('sucard-m');
  else document.getElementById('sucard-m').classList.add('open');
}
function sucRefreshInfo(){
  const name=_sucName; // always base name e.g. "חוגות"
  const ex=supBaseEx(name);
  const s=SUPBASE.find(x=>supBase(x.name)===name)||{};
  const acts=getSupActs(name);
  const cnt=SCH.filter(sc=>supBase(sc.a)===name).length;
  const acts2=getSupActs(name);
  (document.getElementById('suc-title')||{}).textContent =name;
  const invCnt = (typeof INVOICES!=='undefined') ? INVOICES.filter(i=>supBase(i.supName||'')===name).length : 0;
  const isPurch = window.isPurchSupplier(name);
  const isAct = window.isActSupplier(name);
  let sub = '';
  if(isAct) sub += `${cnt} פעילויות · ${acts2.length} סוגים`;
  if(isPurch && invCnt>0) sub += (sub?' · ':'')+`${invCnt} מסמכי רכש`;
  (document.getElementById('suc-sub')||{}).textContent = sub||name;
  const typeFlags = [
    window.isActSupplier(name)?'<span class="sup-flag sup-flag-act">🎨 ספק חוגים</span>':'<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:.68rem;font-weight:700;background:#fce4ec;color:#c62828">🚫 לא מופיע בחוגים</span>',
    window.isPurchSupplier(name)?'<span class="sup-flag sup-flag-purch">🛒 ספק רכש</span>':'',
    ex.entityType?`<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:.68rem;font-weight:700;background:#f3e5f5;color:#6a1b9a">🏢 ${ex.entityType}</span>`:''
  ].filter(Boolean).join(' ');
  const typeFlagsEl = document.getElementById('suc-type-flags');
  if(typeFlagsEl) typeFlagsEl.innerHTML = typeFlags;
  document.getElementById('suc-info').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:.81rem">
      <div><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">📞 טלפון ראשי</div><div style="font-weight:700">${ex.ph1||s.phone||'—'}</div></div>
      ${ex.ph2?`<div><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">📞 טלפון נוסף</div><div style="font-weight:700">${ex.ph2}</div></div>`:'<div></div>'}
      ${ex.g1?`<div><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">🏛️ ח.פ. / עוסק</div><div style="font-weight:700">${ex.g1}</div></div>`:'<div></div>'}
      ${ex.moeTax?`<div><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">📚 מס' ספק חינוך</div><div style="font-weight:700">${ex.moeTax}</div></div>`:''}
      ${ex.contact?`<div><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">👤 איש קשר</div><div style="font-weight:700">${ex.contact}</div></div>`:''}
      ${ex.email?`<div><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">📧 אימייל</div><div style="font-weight:700">${ex.email}</div></div>`:''}
      ${ex.addr?`<div style="grid-column:1/-1"><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">📍 כתובת</div><div style="font-weight:700">${ex.addr}</div></div>`:''}
      <div style="grid-column:1/-1;display:${window.isActSupplier(name)?'block':'none'}">
        <div style="color:#546e7a;font-size:.69rem;margin-bottom:4px">🎯 סוגי פעילויות</div>
        ${acts.length
          ?acts.map(a=>`<span style="background:#e3f2fd;color:#1565c0;border-radius:12px;padding:2px 9px;font-size:.76rem;font-weight:600;margin-left:4px;margin-bottom:3px;display:inline-block">${a}</span>`).join('')
          :'<span style="color:#999;font-size:.76rem">לא הוגדרו פעילויות — לחץ ✏️ ערוך להוספה</span>'
        }
      </div>
      ${ex.notes?`<div style="grid-column:1/-1"><div style="color:#546e7a;font-size:.69rem;margin-bottom:2px">📝 הערות</div><div>${ex.notes}</div></div>`:''}
    </div>
    `;  // docs shown in suc-docs-section tab
}
function sucRefreshActFilt(){
  const acts=getSupActs(_sucName);
  const el=document.getElementById('suc-act-filt');
  if(!el) return;
  el.innerHTML='<option value="">הכל</option>'+acts.map(a=>`<option value='${a}'>${a}</option>`).join('');
}
function sucToggleEdit(){
  const ep=document.getElementById('suc-edit-panel');
  const vp=document.getElementById('suc-view');
  const showing=ep.style.display!=='none';
  if(showing){ ep.style.display='none'; vp.style.display='block'; return; }
  const name=_sucName; // base name, e.g. "חוגות"
  const ex=supBaseEx(name);
  const s=SUPBASE.find(x=>supBase(x.name)===name)||{};
  document.getElementById('suc-edit-name').value=name;
  document.getElementById('suc-edit-name').dataset.orig=name;
  document.getElementById('suc-edit-ph1').value=ex.ph1||s.phone||'';
  const aliasEl=document.getElementById('suc-edit-alias');
  if(aliasEl) aliasEl.value=ex.alias||'';
  const schedPhEl=document.getElementById('suc-edit-sched-phone');
  if(schedPhEl) schedPhEl.value=ex.schedPhone||'ph1';
  const moeEl=document.getElementById('suc-edit-moe');
  if(moeEl) moeEl.value=ex.moeTax||'';
  const contactEl2=document.getElementById('suc-edit-contact');
  if(contactEl2) contactEl2.value=ex.contact||'';
  const emailEl=document.getElementById('suc-edit-email');
  if(emailEl) emailEl.value=ex.email||'';
  const addrEl2=document.getElementById('suc-edit-addr');
  if(addrEl2) addrEl2.value=ex.addr||'';
  // Show/hide acts section based on isAct flag
  const actsWrap=document.getElementById('suc-acts-wrap');
  if(actsWrap) actsWrap.style.display = (ex.isAct!==false)?'block':'none';
  document.getElementById('suc-edit-ph2').value=ex.ph2||'';
  document.getElementById('suc-edit-g1').value=ex.g1||'';
  document.getElementById('suc-edit-notes').value=ex.notes||'';
  const kwEl=document.getElementById('suc-edit-keywords');
  if(kwEl) kwEl.value=ex.keywords||'';
  // supplier type flags
  const editIsAct=document.getElementById('suc-edit-is-act');
  const editIsPurch=document.getElementById('suc-edit-is-purch');
  if(editIsAct) editIsAct.checked = ex.isAct !== false;
  if(editIsPurch) editIsPurch.checked = ex.isPurch !== false;
  document.getElementById('suc-edit-warn').style.display='none';
  document.getElementById('suc-edit-name').oninput=function(){
    document.getElementById('suc-edit-warn').style.display=this.value!==this.dataset.orig?'block':'none';
  };
  sucRefreshActsList();
  document.getElementById('suc-act-new-inp').value='';
  ep.style.display='block'; vp.style.display='none';
}
function sucRefreshActsList(){
  const acts=getSupActs(_sucName); // derives from schedule data + supEx
  const el=document.getElementById('suc-acts-list');
  if(!el) return;
  el.innerHTML=acts.length
    ?acts.map((a,i)=>`<span class="suc-act-tag" data-act="${a.replace(/"/g,'&quot;')}" style="background:#e3f2fd;border-radius:12px;padding:3px 9px;font-size:.76rem;margin:2px;display:inline-flex;align-items:center;gap:5px">
        🎯 ${a}
        <button onclick="sucRemoveAct(${i})" style="background:none;border:none;color:#e53935;cursor:pointer;font-size:.8rem;padding:0;line-height:1" title="הסר פעילות">✕</button>
      </span>`).join('')
    :'<span style="color:#999;font-size:.75rem">לא נמצאו פעילויות — יתמלא אוטומטית מהנתונים</span>';
}
function sucAddAct(){
  const inp=document.getElementById('suc-act-new-inp');
  const val=inp.value.trim(); if(!val) return;
  if(!supEx[_sucName]) supEx[_sucName]={};
  if(!Array.isArray(supEx[_sucName].acts)) supEx[_sucName].acts=[...getSupActs(_sucName)];
  if(!supEx[_sucName].acts.includes(val)) supEx[_sucName].acts.push(val);
  inp.value=''; sucRefreshActsList(); save();
}
function sucRemoveAct(idx){
  const acts=getSupActs(_sucName); 
  const actToRemove = acts[idx];
  if(!supEx[_sucName]) supEx[_sucName]={};
  if(!supEx[_sucName].hiddenActs) supEx[_sucName].hiddenActs=[];
  if(!supEx[_sucName].hiddenActs.includes(actToRemove)) supEx[_sucName].hiddenActs.push(actToRemove);

  if(Array.isArray(supEx[_sucName].acts)) {
    supEx[_sucName].acts = supEx[_sucName].acts.filter(a => a !== actToRemove);
  }
  sucRefreshActsList(); save();
}
async function deleteSupFromCard() {
  // Use _sucName (set by openSupCard) as the reliable source
  const name = _sucName || (document.getElementById('suc-edit-name') && document.getElementById('suc-edit-name').dataset.orig);
  if (!name) { _spAlertDialog('לא נמצא שם ספק'); return; }

  const activeCount = SCH.filter(s => s.a === name && s.st !== 'can').length;
  const totalCount  = SCH.filter(s => s.a === name).length;

  let msg = `למחוק את הספק "${name}"?\n`;
  if (totalCount > 0) {
    msg += `\nהספק קיים ב-${totalCount} פעילויות — הן יישמרו עם שמו.`;
  }
  msg += '\n\nהספק יוסר מרשימות הספקים אך לא מהפעילויות ההיסטוריות.';
  if (!await window.spConfirm(msg)) return;

  // Remove from supEx
  delete supEx[name];

  // Remove from custom suppliers list
  if (supEx['__c']) supEx['__c'] = supEx['__c'].filter(s => s.name !== name);

  // Hide from SUPBASE-based suppliers
  if (!supEx['__merged_away']) supEx['__merged_away'] = [];
  if (!supEx['__merged_away'].includes(name)) supEx['__merged_away'].push(name);

  save();
  CM('sucard-m');
  if (typeof renderSup === 'function') renderSup();
  if (typeof renderPurchSuppliers === 'function') try { renderPurchSuppliers(); } catch(e) {}
  showToast('🗑️ ספק "' + name + '" הוסר — הפעילויות נשמרו');
}

window.sucSaveKeywordsAuto = function(val) {
  const name = (typeof _sucName !== 'undefined' ? _sucName : null) || (document.getElementById('suc-edit-name') && document.getElementById('suc-edit-name').dataset.orig);
  if(!name) return;
  if(!window.supEx[name]) window.supEx[name] = {};
  window.supEx[name].keywords = val.trim();
  window.save();
  if(typeof window.showToast === 'function') window.showToast('✅ מילות מפתח נשמרו בהצלחה');
};

async function sucSaveEdit(isAuto = false){
  const nameEl=document.getElementById('suc-edit-name');
  const newBase=nameEl.value.trim(); const origBase=nameEl.dataset.orig;
  if(!newBase){ 
    if(!isAuto) _spAlertDialog('יש להזין שם ספק');
    return;
  }
  if(origBase&&origBase!==newBase){
    const affected=SCH.filter(s=>supBase(s.a)===origBase).length;
    if(!await window.spConfirm(`לשנות שם מ-"${origBase}" ל-"${newBase}"?\n${affected} שיבוצים יעודכנו.`)) {
      if(isAuto) nameEl.value = origBase; // Revert
      return;
    }
    SCH.forEach(s=>{
      if(supBase(s.a)===origBase){
        const act=supAct(s.a);
        s.a=act?(newBase+' - '+act):newBase;
      }
    });
    if(supEx[origBase]){supEx[newBase]={...supEx[origBase]};delete supEx[origBase];}
    if(!supEx[newBase]) supEx[newBase] = {};
    if(!supEx[newBase]._mergedFrom) supEx[newBase]._mergedFrom = [];
    if(!supEx[newBase]._mergedFrom.includes(origBase)) supEx[newBase]._mergedFrom.push(origBase);
    window._mergedAliasMap = null; // Invalidate alias cache
    _sucName=newBase;
  }
  if(!supEx[_sucName]) supEx[_sucName]={};
  supEx[_sucName].ph1=document.getElementById('suc-edit-ph1').value.trim();
  supEx[_sucName].ph2=document.getElementById('suc-edit-ph2').value.trim();
  supEx[_sucName].g1=document.getElementById('suc-edit-g1').value.trim();
  supEx[_sucName].notes=document.getElementById('suc-edit-notes').value.trim();
  const kwInp=document.getElementById('suc-edit-keywords');
  if(kwInp) supEx[_sucName].keywords=kwInp.value.trim();
  const aliasInp=document.getElementById('suc-edit-alias');
  if(aliasInp) supEx[_sucName].alias=aliasInp.value.trim();
  const schedPhInp=document.getElementById('suc-edit-sched-phone');
  if(schedPhInp) supEx[_sucName].schedPhone=schedPhInp.value;
  const moeInp=document.getElementById('suc-edit-moe');
  if(moeInp) supEx[_sucName].moeTax=moeInp.value.trim();
  const contactInp2=document.getElementById('suc-edit-contact');
  if(contactInp2) supEx[_sucName].contact=contactInp2.value.trim();
  const emailInp=document.getElementById('suc-edit-email');
  if(emailInp) supEx[_sucName].email=emailInp.value.trim();
  const addrInp2=document.getElementById('suc-edit-addr');
  if(addrInp2) supEx[_sucName].addr=addrInp2.value.trim();
  supEx[_sucName].isAct = document.getElementById('suc-edit-is-act')?.checked !== false;
  supEx[_sucName].isPurch = !!document.getElementById('suc-edit-is-purch')?.checked;
  const actTags=document.querySelectorAll('#suc-acts-list .suc-act-tag');
  const savedActs=[...actTags].map(el=>el.dataset.act).filter(Boolean);
  if(savedActs.length) supEx[_sucName].acts=savedActs;
  save(); renderDash(); renderCal(); updCounts();
  if(_appMode==='purch') renderPurchSuppliers();
  ['dash-sup','cal-sup','s-sup','ns-sup','es-sup'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    const cur=el.value;
    el.innerHTML=id==='es-sup'?'<option value="">-- ללא שינוי --</option>':'<option value="">כל הספקים</option>';
    getAllSup().filter(s=>window.isActSupplier(s.name)).forEach(s=>{
      const disp = window.supNameLabel(s.name) !== s.name ? window.supNameLabel(s.name) + ' (' + s.name + ')' : s.name;
      el.innerHTML+=`<option value='${s.name.replace(/'/g, "&#39;")}'>${disp}</option>`;
    });
    el.value=cur;
  });
  sucRefreshInfo(); sucRefreshActFilt();
  if(!isAuto) {
    sucToggleEdit(); 
  }
  if(typeof showToast === 'function') showToast('✅ נשמר בהצלחה');
}
function clearSupCardFilter(){
  document.getElementById('suc-from').value='';
  document.getElementById('suc-to').value='';
  document.getElementById('suc-st').value='';
  renderSupCard();
}
function renderSupPurchDocsSection(name){
  const invs = INVOICES.filter(i=>supBase(i.supName||'')===name);
  if(!invs.length) return '';
  const fmtStatus = (s)=>{
    const m={order:'📋 הזמנה',tx_invoice:'🧾 חשבונית עסקה',tax_invoice:'📑 חשבונית מס',tax_receipt:'📑🧾 חשבונית מס קבלה',receipt:'📄 קבלה',cancelled:'❌ מבוטל'};
    return m[s]||m[_migrateInvStatus(s)]||s||'—';
  };
  const rows = [...invs].sort((a,b)=>(b.orderDate||b.txDate||b.date||'').localeCompare(a.orderDate||a.txDate||a.date||'')).map(inv=>{
    const dateStr = inv.orderDate||inv.txDate||inv.date||'';
    const baseAmt = inv.orderAmt||inv.txAmt||inv.amt||0;
    const invVat = inv.vat||0;
    const amtStr = baseAmt ? `₪${(invVat>0?withVat(baseAmt,invVat):baseAmt).toLocaleString()}` : '—';
    const docNums = [inv.orderNum&&`📋 ${inv.orderNum}`, inv.txNum&&`🧾 ${inv.txNum}`, inv.num&&`📑 ${inv.num}`].filter(Boolean).join(' · ');
    return `<tr style="border-bottom:1px solid #f0f0f0;cursor:pointer" onclick="CM('sucard-m');openNewInvoice(${inv.id})">
      <td style="padding:5px 8px;font-size:.76rem">${dateStr?fD(dateStr):'—'}</td>
      <td style="padding:5px 8px;font-size:.72rem;color:#546e7a">${docNums||'—'}</td>
      <td style="padding:5px 8px;font-size:.75rem;color:#37474f">${inv.orderDesc||''}</td>
      <td style="padding:5px 8px;font-size:.75rem;font-weight:700;color:#2e7d32;white-space:nowrap">${amtStr}</td>
      <td style="padding:5px 8px;font-size:.72rem">${fmtStatus(inv.status)}</td>
    </tr>`;
  }).join('');
  const total = invs.reduce((s,i)=>s+(i.orderAmt||i.txAmt||i.amt||0),0);
  return `<div style="margin-top:12px;border-top:1.5px solid #e8eaf6;padding-top:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-weight:700;color:#1565c0;font-size:.82rem">📄 מסמכי רכש (${invs.length})</div>
      <div style="display:flex;gap:5px">
        <button class="btn bp bsm" style="font-size:.7rem" onclick="openNewInvoice(null,'${name.replace(/'/g,'\'').replace(/"/g,'&quot;')}')">📄 מסמך חדש</button>
        <button class="btn bg bsm" style="font-size:.7rem" onclick="exportSupPurchDocs('${name.replace(/'/g,'\'').replace(/"/g,'&quot;')}')">📊 יצוא</button>
      </div>
    </div>
    <!-- Search filter -->
    <div style="margin-bottom:6px">
      <input type="text" id="suc-inv-srch" placeholder="חפש במסמכים..." oninput="filterSupCardInvs()" style="width:100%;font-size:.78rem;padding:5px 9px;border-radius:5px;border:1.5px solid #c5cae9">
    </div>
    <div style="overflow-x:auto;max-height:280px;overflow-y:auto">
      <table style="width:100%;border-collapse:collapse;font-size:.8rem">
        <thead style="position:sticky;top:0;background:#e8eaf6">
          <tr>
            <th style="padding:5px 8px;text-align:right">תאריך</th>
            <th style="padding:5px 8px;text-align:right">מסמכים</th>
            <th style="padding:5px 8px;text-align:right">פירוט</th>
            <th style="padding:5px 8px;text-align:right">סכום</th>
            <th style="padding:5px 8px;text-align:right">סטטוס</th>
          </tr>
        </thead>
        <tbody id="suc-inv-tbody">${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:6px;font-size:.72rem;color:#546e7a;text-align:left">
      סה"כ (לפני מע"מ): <b style="color:#1565c0">₪${total.toLocaleString()}</b>
    </div>
  </div>`;
}

function filterSupCardInvs(){
  const srch = (document.getElementById('suc-inv-srch')?.value||'').toLowerCase();
  const rows = document.querySelectorAll('#suc-inv-tbody tr');
  rows.forEach(r=>{ r.style.display=!srch||r.textContent.toLowerCase().includes(srch)?'':'none'; });
}

function exportSupPurchDocs(name){
  const invs = INVOICES.filter(i=>supBase(i.supName||'')===name && _migrateInvStatus(i.status)!=='cancelled');
  if(!invs.length){ showToast('אין מסמכים לייצוא'); return; }
  const fmtStatus = (s)=>{const m={order:'הזמנה',tx_invoice:'חשבונית עסקה',tax_invoice:'חשבונית מס',tax_receipt:'חשבונית מס קבלה',receipt:'קבלה',cancelled:'מבוטל'};return m[s]||m[_migrateInvStatus(s)]||s||''};
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: All documents ──
  const rows = invs.map(inv=>({
    'ספק': inv.supName||'',
    'עיר': inv.locCity||'',
    'תאריך': inv.orderDate||inv.txDate||inv.date||'',
    'מספר הזמנה': inv.orderNum||'',
    'מספר חשבונית עסקה': inv.txNum||'',
    'מספר חשבונית מס': inv.num||'',
    'פירוט': inv.orderDesc||'',
    'סכום לפני מעמ': inv.orderAmt||inv.txAmt||inv.amt||0,
    'מעמ %': inv.vat||0,
    'סכום מעמ': inv.orderVat||inv.txVat||inv.vatAmt||0,
    'סכום כולל מעמ': inv.orderTotal||inv.txTotal||inv.total||0,
    'סטטוס': fmtStatus(inv.status),
    'הערות': inv.notes||''
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  // Auto column widths
  const cols = [{wch:20},{wch:12},{wch:12},{wch:14},{wch:16},{wch:14},{wch:25},{wch:14},{wch:8},{wch:12},{wch:14},{wch:16},{wch:20}];
  ws['!cols'] = cols;
  XLSX.utils.book_append_sheet(wb, ws, 'מסמכי רכש');

  // ── Sheet 2: Summary by city ──
  const cityMap = {};
  invs.forEach(inv=>{
    const city = inv.locCity || 'לא צוין';
    if(!cityMap[city]) cityMap[city]={count:0, base:0, vatAmt:0, total:0};
    cityMap[city].count++;
    cityMap[city].base  += inv.orderAmt||inv.txAmt||inv.amt||0;
    cityMap[city].vatAmt+= inv.orderVat||inv.txVat||inv.vatAmt||0;
    cityMap[city].total += inv.orderTotal||inv.txTotal||inv.total||0;
  });
  const summaryRows = Object.entries(cityMap)
    .sort((a,b)=>a[0].localeCompare(b[0],'he'))
    .map(([city,d])=>({
      'עיר': city,
      'מספר מסמכים': d.count,
      'סה"כ לפני מעמ': +d.base.toFixed(2),
      'סה"כ מעמ': +d.vatAmt.toFixed(2),
      'סה"כ כולל מעמ': +d.total.toFixed(2)
    }));
  // Grand total row
  const grandBase  = invs.reduce((s,i)=>s+(i.orderAmt||i.txAmt||i.amt||0),0);
  const grandVat   = invs.reduce((s,i)=>s+(i.orderVat||i.txVat||i.vatAmt||0),0);
  const grandTotal = invs.reduce((s,i)=>s+(i.orderTotal||i.txTotal||i.total||0),0);
  summaryRows.push({
    'עיר': '✅ סה"כ כללי',
    'מספר מסמכים': invs.length,
    'סה"כ לפני מעמ': +grandBase.toFixed(2),
    'סה"כ מעמ': +grandVat.toFixed(2),
    'סה"כ כולל מעמ': +grandTotal.toFixed(2)
  });
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{wch:16},{wch:14},{wch:16},{wch:14},{wch:16}];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'סיכום לפי עיר');

  XLSX.writeFile(wb, `${name}_מסמכי_רכש.xlsx`);
  showToast(`📊 יוצא: ${invs.length} מסמכים`);
}

function renderSupCard(){
  if(!_sucName) return;
  // Only render activities if supplier has schedule entries
  const hasSchData = SCH.some(s=>supBase(s.a)===_sucName);
  if(!hasSchData) { 
    const el=document.getElementById('suc-body'); 
    if(el) el.innerHTML=''; 
    return; 
  }
  const from=document.getElementById('suc-from').value;
  const to=document.getElementById('suc-to').value;
  const st=document.getElementById('suc-st').value;
  const actFilt=document.getElementById('suc-act-filt')?document.getElementById('suc-act-filt').value:'';
  const evs=SCH.filter(s=>{
    if(supBase(s.a)!==_sucName) return false;
    if(from&&s.d<from) return false;
    if(to&&s.d>to) return false;
    if(st&&s.st!==st) return false;
    if(actFilt&&supAct(s.a)!==actFilt&&s.act!==actFilt) return false;
    return true;
  }).sort((a,b)=>a.d.localeCompare(b.d)||(a.t||'').localeCompare(b.t||''));
  const el=document.getElementById('suc-body');
  if(!evs.length){el.innerHTML='<p style="color:#999;text-align:center;padding:20px">אין פעילויות בטווח ובסינון זה</p>';return;}
  const cntDone=evs.filter(s=>s.st==='done').length;
  const cntCan=evs.filter(s=>s.st==='can' && !s._compByMakeup).length;
  const cntPost=evs.filter(s=>s.st==='post' && !s._compByMakeup).length;
  const cntNohap=evs.filter(s=>s.st==='nohap' && !s._compByMakeup).length;
  const cntActive=evs.length-cntDone-cntCan-cntPost-cntNohap;

  let h=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
    <div style="background:#e8f5e9;border-radius:7px;padding:5px 12px;text-align:center;min-width:70px">
      <div style="font-weight:800;color:#2e7d32">${cntDone}</div><div style="font-size:.68rem;color:#546e7a">התקיים</div>
    </div>
    <div style="background:#fff3e0;border-radius:7px;padding:5px 12px;text-align:center;min-width:70px">
      <div style="font-weight:800;color:#e65100">${cntActive+cntPost}</div><div style="font-size:.68rem;color:#546e7a">מתקיים/נדחה</div>
    </div>
    <div style="background:#ffebee;border-radius:7px;padding:5px 12px;text-align:center;min-width:70px">
      <div style="font-weight:800;color:#c62828">${cntCan}</div><div style="font-size:.68rem;color:#546e7a">בוטל</div>
    </div>
    <div style="background:#fce4ec;border-radius:7px;padding:5px 12px;text-align:center;min-width:70px">
      <div style="font-weight:800;color:#e91e63">${cntNohap}</div><div style="font-size:.68rem;color:#546e7a">לא התקיים</div>
    </div>
    <div style="background:#e3f2fd;border-radius:7px;padding:5px 12px;text-align:center;min-width:70px">
      <div style="font-weight:800;color:#1565c0">${evs.length}</div><div style="font-size:.68rem;color:#546e7a">סה"כ</div>
    </div>
  </div>`;

  h+=`<div class="tw"><table><thead><tr>
    <th>תאריך</th><th>יום</th><th>עיר</th><th>צהרון</th><th>שעה</th><th>פעילות</th><th>קב'</th><th>סטטוס</th><th>הערות</th><th></th>
  </tr></thead><tbody>`;
  evs.filter(s => !s._compByMakeup).forEach(s=>{
    const g=G(s.g);
    h+=`<tr class="${stClass(s)}">
      <td>${fD(s.d)}</td>
      <td>יום ${dayN(s.d)}</td>
      <td>${g.city||''}</td>
      <td><div style="font-weight:700">${g.name}</div>${g.st?`<div style="font-size:.67rem;color:#78909c">${g.st}</div>`:''}</td>
      <td>${fT(s.t)}</td>
      <td><span style="background:#e3f2fd;color:#1565c0;border-radius:10px;padding:1px 7px;font-size:.73rem;font-weight:600">${s.act||'—'}</span></td>
      <td style="text-align:center">${s.grp||1}</td>
      <td>${stLabel(s)}</td>
      <td style="max-width:100px;font-size:.71rem">${s.nt||''}</td>
      <td><button class="btn bo bsm" style="font-size:.65rem" onclick="openSP('${s.id}')">✏️</button></td>
    </tr>`;
  });
  h+='</tbody></table></div>';
  el.innerHTML=h;
}
function openSupExportFromCard(){
  if(!_sucName) return;
  const f = document.getElementById('suc-from')?.value;
  const t = document.getElementById('suc-to')?.value;
  CM('sucard-m');
  openSupExport(_sucName);
  // Re-apply captured dates to the export modal if they exist
  if(f) document.getElementById('supex-from').value = f;
  if(t) document.getElementById('supex-to').value = t;
}

function goToTodayCal(){
  ST('cal');
  setTimeout(()=>{
    ['cal-pair', 'cal-g1', 'cal-g2', 'cal-g3', 'cal-city', 'cal-cls'].forEach(id => {
      const el = window.getEl ? window.getEl(id) : document.getElementById(id);
      if (el) el.value = '';
    });
    calD=new Date();calV='list';
    setListSubView('day');setView('list');renderCal();
  },50);
}
function goToTodayActivities(){
  ST('sched');
  setTimeout(()=>{
    ['s-city','s-cls','s-sup','s-th','s-tt','s-st','s-srch'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('s-from').value=td();
    document.getElementById('s-to').value=td();
    sPage=1;renderSched();
  },50);
}

const MAX_SNAPSHOTS=20;
document.querySelectorAll('.modal').forEach(m=>{m.onclick=e=>{if(e.target===m) m.classList.remove('open');};});


// ── Quick Cancel Popup ──────────────────────────────────
// Nohap, Cancel, and Postpone modals moved to activity.js


// ─── Blocked Dates ────────────────────────────────────────────
let _blockedEditDate=null;

const BLOCKED_ICONS={'טיול':'🚌','מסיבה':'🎉','אירוע מיוחד':'⭐','יום הורים':'👨‍👩‍👧','אחר':'🚫'};

function getBlockedIcon(reason){
  for(const[k,v] of Object.entries(BLOCKED_ICONS)) if(reason&&reason.includes(k)) return v;
  return '🚫';
}

function getBlockedInfo(ds){return blockedDates[ds]||null;}

// ─── Monthly Excel Export ────────────────────────────────────
function openGcellPopup(gid, ds, e){
  e.stopPropagation();
  _gcellGid=parseInt(gid);
  _gcellDs=ds;
  const g=G(_gcellGid);
  const key=`${_gcellGid}_${ds}`;
  const blk=gardenBlocks[key];
  const popup=document.getElementById('gcell-popup');
  document.getElementById('gcell-popup-title').textContent=`${g.name} · ${fD(ds)} יום ${dayN(ds)}`;
  const blkLbl=document.getElementById('gcell-popup-block-lbl');
  const blockBtn=document.getElementById('gcell-block-btn');
  const unblockBtn=document.getElementById('gcell-unblock-btn');
  if(blk){
    blkLbl.textContent=`${blk.icon||'🚫'} חסום: ${blk.reason}`;
    blkLbl.style.display='block';
    blockBtn.textContent='🚫 ערוך חסימה';
    unblockBtn.style.display='block';
  } else {
    blkLbl.style.display='none';
    blockBtn.textContent='🚫 חסום תאריך לצהרון זה';
    unblockBtn.style.display='none';
  }
  // Position near click
  const x=Math.min(e.clientX, window.innerWidth-230);
  const y=Math.min(e.clientY, window.innerHeight-220);
  popup.style.left=x+'px';
  popup.style.top=y+'px';
  popup.style.display='block';
  document.getElementById('gcell-popup-overlay').style.display='block';
}

function closeGcellPopup(){
  document.getElementById('gcell-popup').style.display='none';
  document.getElementById('gcell-popup-overlay').style.display='none';
}

function gcellNewSched(){
  closeGcellPopup();
  openNewSched(_gcellGid, {date:_gcellDs});
}

async function gcellUnblock(){
  closeGcellPopup();
  _blockMode='garden';
  if(!await window.spConfirm('להסיר חסימה זו?')) return;
  delete gardenBlocks[`${_gcellGid}_${_gcellDs}`];
  save(); refresh(); showToast('✅ חסימה הוסרה');
}

function getGardenBlock(gid, ds){ return gardenBlocks[`${parseInt(gid)}_${ds}`]||null; }

// ─── Unified Block Modal ─────────────────────────────────────
// mode: 'date' = whole date block | 'garden' = specific garden+date
let _blockMode='date'; // 'date' | 'garden'

function selBlockReason(btn, reason){
  document.querySelectorAll('.block-reason-btn').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
  const inp=document.getElementById('block-m-reason');
  if(reason!=='אחר') inp.value=reason; else inp.focus();
}

function openBlockModal(mode, gid, ds){
  _blockMode=mode;
  const cancelWrap = document.getElementById('block-m-cancel-wrap');
  const cancelChk  = document.getElementById('block-m-cancel-chk');
  const cancelCnt  = document.getElementById('block-m-cancel-cnt');
  if(mode==='garden'){
    _gcellGid=parseInt(gid); _gcellDs=ds;
    const g=G(_gcellGid);
    const key=`${_gcellGid}_${ds}`;
    const blk=gardenBlocks[key];
    document.getElementById('block-m-title').textContent=`🚫 חסום צהרון לתאריך`;
    document.getElementById('block-m-subtitle').textContent=`${g.name} · ${fD(ds)} יום ${dayN(ds)}`;
    document.getElementById('block-m-reason').value=blk?blk.reason:'';
    document.getElementById('block-m-note').value=blk?blk.note||'':'';
    document.getElementById('block-m-del').style.display=blk?'inline-flex':'none';
    document.querySelectorAll('.block-reason-btn').forEach(b=>{
      b.classList.toggle('sel', blk&&b.textContent.trim().includes(blk.reason));
    });
    if(cancelWrap) cancelWrap.style.display='none';
  } else {
    _blockedEditDate=ds;
    const blk=blockedDates[ds];
    document.getElementById('block-m-title').textContent=`🚫 חסום / ביטול תאריך`;
    document.getElementById('block-m-subtitle').textContent=`📅 ${fD(ds)} — יום ${dayN(ds)}`;
    document.getElementById('block-m-reason').value=blk?blk.reason:'';
    document.getElementById('block-m-note').value=blk?blk.note||'':'';
    document.getElementById('block-m-del').style.display=blk?'inline-flex':'none';
    document.querySelectorAll('.block-reason-btn').forEach(b=>{
      b.classList.toggle('sel', blk&&b.textContent.trim().includes(blk.reason));
    });
    // Show cancel-activities option with count
    if(cancelWrap){
      cancelWrap.style.display='block';
      if(cancelChk) cancelChk.checked=false;
      const cnt=SCH.filter(s=>s.d===ds&&s.st!=='can').length;
      if(cancelCnt){
        cancelCnt.textContent=cnt>0?`${cnt} פעילויות פעילות ביום זה`:'אין פעילויות פעילות ביום זה';
        cancelCnt.style.color=cnt>0?'#c62828':'#888';
      }
    }
  }
  document.getElementById('block-m').classList.add('open');
}

// Keep openBlockedDate as it's called from HTML
function openBlockedDate(ds){ openBlockModal('date', null, ds); }
function gcellBlock(){ openBlockModal('garden', _gcellGid, _gcellDs); }

function saveBlock(){
  const reason=document.getElementById('block-m-reason').value.trim();
  if(!reason){_spAlertDialog('יש להזין סיבה');return;}
  const note=document.getElementById('block-m-note').value.trim();
  const icon=getBlockedIcon(reason);
  if(_blockMode==='garden'){
    const key=`${_gcellGid}_${_gcellDs}`;
    gardenBlocks[key]={reason,note,icon,gid:_gcellGid,d:_gcellDs};
    saveAndRefresh('block-m'); showToast('🚫 צהרון נחסם לתאריך זה');
  } else {
    blockedDates[_blockedEditDate]={reason,note,icon};
    // Optionally cancel all activities
    const cancelChk=document.getElementById('block-m-cancel-chk');
    if(cancelChk&&cancelChk.checked){
      const toCancel=SCH.filter(s=>s.d===_blockedEditDate&&s.st!=='can');
      if(toCancel.length>0){
        toCancel.forEach(s=>{
          s.st='can'; s.cr=reason; s.cn=note;
          const n='❌ בוטל: '+reason+(note?' — '+note:'');
          s.nt=s.nt?s.nt+' | '+n:n;
        });
        saveAndRefresh('block-m');
        showToast(`🚫 תאריך נחסם + בוטלו ${toCancel.length} פעילויות`);
        return;
      }
    }
    saveAndRefresh('block-m'); showToast('🚫 תאריך סומן כחסום');
  }
}

async function deleteBlock(){
  const msg=_blockMode==='garden'?'להסיר את החסימה מגן זה?':'להסיר את החסימה מתאריך זה?';
  if(!await window.spConfirm(msg)) return;
  if(_blockMode==='garden'){
    delete gardenBlocks[`${_gcellGid}_${_gcellDs}`];
    saveAndRefresh('block-m'); showToast('✅ חסימה הוסרה');
  } else {
    delete blockedDates[_blockedEditDate];
    saveAndRefresh('block-m'); showToast('✅ חסימה הוסרה');
  }
}

let _editMgrId=null;

// ─── Auto-import contacts from garden co field ────────
function importContactsFromGardens(){
  if(Object.keys(managers).length>0) return; // already have managers
  const byContact={};
  [...GARDENS,...(_GARDENS_EXTRA||[])].forEach(g=>{
    if(!g.co) return;
    // Parse "Name – 050-XXXXXXX" or "Name - 050-XXXXXXX" or just "Name"
    const m=g.co.match(/^(.+?)\s*[–\-]\s*(\d[\d\-\s]+)$/);
    const name=m?m[1].trim():g.co.trim();
    const phone=m?m[2].trim():'';
    const key=name.toLowerCase();
    if(!byContact[key]) byContact[key]={name,phone,gardenIds:[],city:g.city};
    byContact[key].gardenIds.push(g.id);
    // If gardens span multiple cities, clear city
    if(byContact[key].city!==g.city) byContact[key].city='';
  });
  Object.values(byContact).forEach(c=>{
    const id='mgr_auto_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
    managers[id]={id,name:c.name,phone:c.phone,role:'coord',city:c.city,gardenIds:c.gardenIds};
  });
  if(Object.keys(managers).length>0){
    save();
    console.log('Auto-imported '+Object.keys(managers).length+' contacts from gardens');
  }
}

// ── Garden contact helpers ─────────────────────────────────────
// Resolves garden contact: splits old "name - phone" format OR uses separate fields
function resolveGardenContact(g){
  // Only return data that was EXPLICITLY entered by the user in supEx
  // Never auto-extract from old co field (those are coordinator phones, not garden phones)
  const ex=supEx['g_'+g.id]||{};
  return {
    name:  ex.co   || '',
    phone: ex.coph || ''
  };
}

// Get merged garden data (base + supEx overrides)
function getGardenData(gid){
  const g=getAllGardens().find(x=>x.id===gid)||{};
  const ex=supEx['g_'+gid]||{};
  const contact=resolveGardenContact({...g, ...ex});
  return {
    ...g,
    name:  ex.name||g.name||'',         // garden name (never contact name)
    st:    ex.st!==undefined?ex.st:g.st||'',
    notes: ex.notes||g.notes||'',
    coName:  contact.name,              // contact person name
    phone:   contact.phone              // garden phone
  };
}

let _geditGid=null;
function openGardenEdit(gid){
  _geditGid=gid;
  const g=getAllGardens().find(x=>x.id===gid)||{};
  const ex=supEx['g_'+gid]||{};
  const resolved=resolveGardenContact(g);

  (document.getElementById('gedit-title')||{}).textContent =`✏️ ${g.name}`;

  // Badge
  const mgr=getGardenMgr(gid);
  const clr=CITY_COLORS(g.city);
  document.getElementById('gedit-badge').innerHTML=
    `<span style="background:${clr.light};color:${clr.solid};border-radius:12px;padding:2px 10px;font-size:.75rem;font-weight:700">🏙️ ${g.city}</span>`+
    `<span style="background:#e8f5e9;color:#2e7d32;border-radius:12px;padding:2px 10px;font-size:.75rem">${gcls(g)==='ביה"ס'?'🏛️ צהרון בית ספר':'🏫 צהרון גן'}</span>`;

  // Fields — override from supEx if exists
  document.getElementById('gedit-name').value=ex.name||g.name||'';
  document.getElementById('gedit-st').value=ex.st!==undefined?ex.st:(g.st||'');
  document.getElementById('gedit-co').value=ex.co!==undefined?ex.co:resolved.name;
  document.getElementById('gedit-coph').value=ex.coph!==undefined?ex.coph:resolved.phone;
  document.getElementById('gedit-notes').value=ex.notes||g.notes||'';

  // Manager dropdown
  const mgrSel=document.getElementById('gedit-mgr-sel');
  if(mgrSel) {
    let opts='<option value="">ללא שיוך מנהל/רכז</option>';
    Object.values(managers).sort((a,b)=>a.name.localeCompare(b.name,'he'))
      .forEach(m=>opts+=`<option value="${m.id}" ${mgr && mgr.id === m.id ? 'selected' : ''}>${m.role==='manager'?'🏛️':'👤'} ${m.name}</option>`);
    mgrSel.innerHTML = opts;
  }

  document.getElementById('gedit-m').classList.add('open');
}
window.exportGardenWA = function() {
  if (!window._geditGid) return;
  const gid = window._geditGid;
  const g = window.getAllGardens().find(x => x.id === gid) || {};
  const ex = (window.supEx && window.supEx['g_' + gid]) || {};
  
  const name = (document.getElementById('gedit-name').value || '').trim() || ex.name || g.name || '';
  const st = (document.getElementById('gedit-st').value || '').trim() || ex.st || g.st || '';
  const city = g.city || '';
  const mgr = typeof window.getGardenMgr === 'function' ? window.getGardenMgr(gid) : null;
  
  let txt = `📍 *פרטי צהרון/גן:*\n\n`;
  if (name) txt += `*שם:* ${name}\n`;
  if (city) txt += `*עיר:* ${city}\n`;
  if (st) txt += `*כתובת:* ${st}\n`;
  
  if (mgr) {
    txt += `\n👤 *${mgr.role === 'manager' ? 'מנהל' : 'רכז'}:* ${mgr.name}${mgr.phone ? (' - ' + mgr.phone) : ''}\n`;
  }
  
  const fallback = () => {
    const t = document.createElement('textarea');
    t.value = txt;
    document.body.appendChild(t);
    t.select();
    try { document.execCommand('copy'); } catch(e){}
    document.body.removeChild(t);
  };
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(() => {
      if (typeof window.showToast === 'function') window.showToast('✅ פרטי הגן הועתקו להודעה!');
    }).catch(fallback);
  } else {
    fallback();
    if (typeof window.showToast === 'function') window.showToast('✅ פרטי הגן הועתקו להודעה!');
  }
};

function saveGardenCard(){
  if(!_geditGid) return;
  if(!supEx['g_'+_geditGid]) supEx['g_'+_geditGid]={};
  const ex=supEx['g_'+_geditGid];
  ex.name =document.getElementById('gedit-name').value.trim();
  ex.st   =document.getElementById('gedit-st').value.trim();
  ex.co   =document.getElementById('gedit-co').value.trim();
  ex.coph =document.getElementById('gedit-coph').value.trim();
  if(ex.coph) ex._cophManual=true; // mark as manually edited
  ex.notes=document.getElementById('gedit-notes').value.trim();

  // update manager assignment
  const selMgrId = document.getElementById('gedit-mgr-sel')?.value;
  // Remove this garden from all managers first
  Object.values(managers).forEach(m => {
     if(m.gardenIds) {
       m.gardenIds = m.gardenIds.filter(id => id !== _geditGid);
     }
  });
  // Add to selected manager
  if(selMgrId && managers[selMgrId]) {
     if(!managers[selMgrId].gardenIds) managers[selMgrId].gardenIds = [];
     managers[selMgrId].gardenIds.push(_geditGid);
  }

  save();
  CM('gedit-m');
  if (typeof window.refreshAppUI === 'function') {
    window.refreshAppUI();
  } else {
    renderGardens();
    if(currentTab==='managers') renderManagers();
  }
  showToast('✅ כרטיס הצהרון עודכן');
}

function renderManagers(){
  const cityF=(window.getEl ? window.getEl('mgr-city-filt') : document.getElementById('mgr-city-filt'))?.value || '';
  const roleF=(window.getEl ? window.getEl('mgr-role-filt') : document.getElementById('mgr-role-filt'))?.value || '';
  const all=Object.values(managers).filter(m=>{
    if(cityF&&m.city&&m.city!==cityF) return false;
    if(roleF&&m.role!==roleF) return false;
    return true;
  }).sort((a,b)=>(a.role==='manager'?0:1)-(b.role==='manager'?0:1)||a.name.localeCompare(b.name,'he'));

  const el=document.getElementById('mgr-body');
  if(!all.length){el.innerHTML='<p style="color:#999;text-align:center;padding:20px">אין מנהלים/רכזים. לחץ ➕ להוספה.</p>';return;}

  let h='';
  all.forEach(m=>{
    const gs=(m.gardenIds||[]).map(id=>G(id)).filter(x=>x.id)
      .sort((a,b)=>a.city.localeCompare(b.city,'he')||a.name.localeCompare(b.name,'he'));
    const isMgr=m.role==='manager';
    const roleClr=isMgr?'#1a237e':'#2e7d32';
    const roleBg=isMgr?'#e8eaf6':'#e8f5e9';
    const roleLabel=isMgr?'🏛️ מנהל':'👤 רכז';

    // Group gardens by city for display
    const gByCity={};
    gs.forEach(g=>{if(!gByCity[g.city])gByCity[g.city]=[];gByCity[g.city].push(g);});

    h+=`<div class="card" style="padding:0;margin-bottom:12px;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden">
      <!-- Header -->
      <div style="background:${roleClr};padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <span style="font-weight:800;color:#fff;font-size:.9rem">${roleLabel} ${m.name}</span>
          ${m.city?`<span style="font-size:.72rem;color:rgba(255,255,255,.8);margin-right:10px">🏙️ ${m.city}</span>`:''}
        </div>
        <div style="display:flex;gap:5px">
          <button onclick="openMgrModal('${m.id}')" style="background:rgba(255,255,255,.22);border:none;border-radius:6px;padding:3px 9px;cursor:pointer;color:#fff;font-size:.74rem">✏️ ערוך</button>
          <button onclick="exportMgrContact('${m.id}')" style="background:rgba(255,255,255,.15);border:none;border-radius:6px;padding:3px 9px;cursor:pointer;color:#fff;font-size:.74rem">📋 ייצוא</button>
        </div>
      </div>
      <!-- Contact info -->
      <div style="padding:10px 14px;background:${roleBg};display:flex;gap:18px;flex-wrap:wrap">
        ${m.phone?`<span style="font-size:.8rem">📞 <a href="tel:${m.phone}" style="color:${roleClr};font-weight:700">${m.phone}</a></span>`:''}
        ${m.phone2?`<span style="font-size:.8rem">📞 <a href="tel:${m.phone2}" style="color:${roleClr}">${m.phone2}</a></span>`:''}
        ${m.email?`<span style="font-size:.8rem">✉️ <a href="mailto:${m.email}" style="color:${roleClr}">${m.email}</a></span>`:''}
        ${m.notes?`<span style="font-size:.78rem;color:#546e7a;font-style:italic">💬 ${m.notes}</span>`:''}
        ${!m.phone&&!m.email&&!m.notes?'<span style="font-size:.77rem;color:#aaa">אין פרטי קשר</span>':''}
      </div>
      <!-- Gardens list -->
      <div style="padding:10px 14px">
        <div style="font-size:.74rem;font-weight:700;color:#546e7a;margin-bottom:7px">אחראי על ${gs.length} צהרונים:</div>
        ${gs.length?`<div>
          ${Object.keys(gByCity).sort().map(city=>`
            <div style="margin-bottom:6px">
              <div style="font-size:.65rem;color:#78909c;font-weight:700;margin-bottom:3px">📍 ${city}</div>
              <div style="display:flex;flex-wrap:wrap;gap:3px">
                ${gByCity[city].map(g=>`<span style="background:#e8f5e9;color:#1b5e20;border-radius:12px;padding:2px 9px;font-size:.71rem;cursor:pointer" onclick="openGM(${g.id})">${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</span>`).join('')}
              </div>
            </div>`).join('')}
        </div>`:
        `<span style="font-size:.76rem;color:#aaa">לא שויכו גנים עדיין</span>`}
      </div>
    </div>`;
  });
  el.innerHTML=h;
}

function openMgrModal(id){
  _editMgrId=id;
  const m=id?managers[id]:null;
  (document.getElementById('mgrm-title')||{}).textContent =m?`✏️ עריכת ${m.name}`:'➕ הוסף מנהל/רכז';
  document.getElementById('mgr-name').value=m?m.name:'';
  document.getElementById('mgr-role').value=m?(m.role||'coord'):'coord';
  document.getElementById('mgr-phone').value=m?m.phone||'':'';
  document.getElementById('mgr-phone2').value=m?m.phone2||'':'';
  document.getElementById('mgr-email').value=m?m.email||'':'';
  document.getElementById('mgr-notes').value=m?m.notes||'':'';

  const mgrCityEl=document.getElementById('mgr-city');
  mgrCityEl.innerHTML='<option value="">כל הערים</option>';
  cities().forEach(c=>mgrCityEl.innerHTML+=`<option value='${c}'${m&&m.city===c?' selected':''}>${c}</option>`);

  const mgrGCityEl=document.getElementById('mgr-g-city');
  mgrGCityEl.innerHTML='<option value="">כל הערים</option>';
  cities().forEach(c=>mgrGCityEl.innerHTML+=`<option value='${c}'>${c}</option>`);
  if(m&&m.city) mgrGCityEl.value=m.city;

  mgrFillGardens();
  document.getElementById('mgr-del-btn').style.display=id?'block':'none';

  // Check auth status
  const wrap = document.getElementById('mgr-auth-wrap');
  const active = document.getElementById('mgr-auth-active');
  const emailLabel = document.getElementById('mgr-auth-email');
  if (wrap && active && emailLabel) {
    if (!id || (m && m.role === 'manager')) {
      wrap.style.display = 'none';
      active.style.display = 'none';
    } else {
      // Check if we know their email or if they have a standard generated email
      const cleanPhone = m && m.phone ? m.phone.replace(/\D/g, '') : '';
      const email = `coord_${cleanPhone}@ganmanager.app`;
      // For now, we just assume if they have a phone, we show the create button, 
      // but without a full backend list we don't know if they are created unless we stored it.
      // We will store it in m.hasAuth in the future.
      if (m && m.hasAuth) {
        wrap.style.display = 'none';
        active.style.display = 'block';
        emailLabel.textContent = email;
      } else {
        wrap.style.display = 'block';
        active.style.display = 'none';
      }
    }
  }

  document.getElementById('mgrm').classList.add('open');
}

window.createCoordinatorUser = async function() {
  if (!_editMgrId) return;
  const mgr = managers[_editMgrId];
  if (!mgr || !mgr.phone) {
    alert('לרכז זה אין מספר טלפון מוגדר. נא להזין טלפון תחילה ולשמור.');
    return;
  }
  const cleanPhone = mgr.phone.replace(/\D/g, '');
  if (cleanPhone.length < 9) {
    alert('מספר טלפון לא תקין. (יש לוודא שהוא מכיל 10 ספרות, למשל 0501234567)');
    return;
  }
  const email = `coord_${cleanPhone}@ganmanager.app`;
  const pwd = cleanPhone.substring(0, 6);
  
  if (!await window.spConfirm(`האם ליצור חשבון למערכת עבור הרכז?\nשם משתמש: ${email}\nסיסמה: ${pwd}\n\nלאחר היצירה, הרכז יוכל להיכנס למערכת ולראות רק את השיבוצים שלו.`)) return;
  
  try {
    if (!window._fbCreateUser) throw new Error("פונקציית יצירת משתמש אינה זמינה כעת.");
    const res = await window._fbCreateUser(email, pwd);
    
    // Write user role to Realtime DB
    const token = await window._fbGetToken();
    if (token) {
      const payload = { role: 'coordinator', phone: cleanPhone, name: mgr.name, managerId: _editMgrId };
      const dbUrl = window.getFirebaseRootUrl ? window.getFirebaseRootUrl() : 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';
      await fetch(`${dbUrl}/users/${res.uid}.json?auth=${token}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    }
    
    mgr.hasAuth = true;
    if(typeof save === 'function') await save(true);
    
    document.getElementById('mgr-auth-wrap').style.display = 'none';
    document.getElementById('mgr-auth-active').style.display = 'block';
    document.getElementById('mgr-auth-email').textContent = email;
    alert('החשבון נוצר בהצלחה! שלח לרכז את קישור המערכת עם המייל והסיסמה האלו.');
  } catch(e) {
    if (e.message.includes('email-already-in-use')) {
      alert('חשבון עבור רכז זה (עם מספר הטלפון הזה) כבר קיים במערכת.');
      mgr.hasAuth = true;
      if(typeof save === 'function') await save(true);
      document.getElementById('mgr-auth-wrap').style.display = 'none';
      document.getElementById('mgr-auth-active').style.display = 'block';
      document.getElementById('mgr-auth-email').textContent = email;
    } else {
      alert('שגיאה ביצירת חשבון: ' + e.message);
    }
  }
};

function mgrFillGardens(){
  const m=_editMgrId?managers[_editMgrId]:null;
  const city=document.getElementById('mgr-g-city').value;
  const gs=GARDENS.filter(g=>!city||g.city===city)
    .sort((a,b)=>a.city.localeCompare(b.city,'he')||a.name.localeCompare(b.name,'he'));
  const checked=new Set(m?m.gardenIds||[]:[]);

  // Group by city for easier reading
  const byCity={};
  gs.forEach(g=>{if(!byCity[g.city])byCity[g.city]=[];byCity[g.city].push(g);});

  let h='';
  Object.keys(byCity).sort().forEach(c=>{
    h+=`<div style="padding:4px 6px 2px;font-size:.68rem;font-weight:700;color:#78909c;background:#f5f5f5;border-radius:4px;margin-bottom:2px;margin-top:4px">🏙️ ${c}</div>`;
    byCity[c].forEach(g=>{
      h+=`<label style="display:flex;gap:7px;padding:4px 6px;cursor:pointer;align-items:center;border-radius:5px;transition:background .1s" onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background=''" >
        <input type="checkbox" value="${g.id}" ${checked.has(g.id)?'checked':''} style="min-width:15px;accent-color:#1565c0" onchange="mgrUpdateCount()">
        <span style="flex:1;font-size:.77rem">${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}</span>
        ${g.st?`<span style="font-size:.65rem;color:#aaa">${g.st}</span>`:''}
      </label>`;
    });
  });
  document.getElementById('mgr-gardens').innerHTML=h||'<p style="color:#aaa;font-size:.75rem;text-align:center;padding:10px">אין גנים</p>';
  mgrUpdateCount();
}

function mgrUpdateCount(){
  const n=document.querySelectorAll('#mgr-gardens input:checked').length;
  const el=document.getElementById('mgr-gardens-count');
  if(el) el.textContent=n?`✓ נבחרו ${n} גנים`:'';
}

function mgrSelectAllGardens(sel){
  document.querySelectorAll('#mgr-gardens input[type="checkbox"]').forEach(cb=>cb.checked=sel);
  mgrUpdateCount();
}

function saveMgr(){
  const name=document.getElementById('mgr-name').value.trim();
  if(!name){_spAlertDialog('יש להזין שם');return;}
  const id=_editMgrId||('mgr_'+Date.now());
  const gardenIds=[...document.querySelectorAll('#mgr-gardens input:checked')].map(cb=>parseInt(cb.value));
  
  // Ensure that gardens assigned to this coordinator are removed from any other coordinators
  for (const gid of gardenIds) {
    for (const otherId in managers) {
      if (otherId !== id && managers[otherId].gardenIds) {
        managers[otherId].gardenIds = managers[otherId].gardenIds.filter(existingGid => existingGid !== gid);
      }
    }
  }

  managers[id]={
    id,name,
    role:document.getElementById('mgr-role').value,
    phone:document.getElementById('mgr-phone').value.trim(),
    phone2:document.getElementById('mgr-phone2').value.trim(),
    email:document.getElementById('mgr-email').value.trim(),
    notes:document.getElementById('mgr-notes').value.trim(),
    city:document.getElementById('mgr-city').value,
    gardenIds
  };
  save(); CM('mgrm'); refresh();
  // Refresh all views that show manager/coordinator data
  renderManagers();
  refreshMgrDrops();
  renderGardens();
  if(typeof renderPairs === 'function') renderPairs();
  updCounts();
  showToast('✅ '+name+' נשמר — הנתונים עודכנו בכל האפליקציה');
}

async function deleteMgr(){
  const m=_editMgrId?managers[_editMgrId]:null;
  if(!m) return;
  if(!await window.spConfirm(`למחוק את ${m.name}?`)) return;
  delete managers[_editMgrId];
  save(); CM('mgrm'); refresh();
  // Refresh all views that show manager/coordinator data
  renderManagers();
  refreshMgrDrops();
  renderGardens();
  if(typeof renderPairs === 'function') renderPairs();
  updCounts();
  showToast('✅ '+name+' נשמר — הנתונים עודכנו בכל האפליקציה');
}

let _exportMgrId=null;
function exportMgrContact(id){
  _exportMgrId=id;
  const m=managers[id]; if(!m) return;
  const gs=(m.gardenIds||[]).map(id=>G(id)).filter(x=>x.id)
    .sort((a,b)=>a.city.localeCompare(b.city,'he')||a.name.localeCompare(b.name,'he'));
  const roleLabel=m.role==='manager'?'מנהל':'רכז';
  let txt='';
  txt+=`👤 ${roleLabel}: ${m.name}\n`;
  if(m.phone) txt+=`📞 ${m.phone}\n`;
  if(m.phone2) txt+=`📞 ${m.phone2}\n`;
  if(m.email) txt+=`✉️ ${m.email}\n`;
  if(m.notes) txt+=`💬 ${m.notes}\n`;
  txt+='\n';
  txt+=`🏫 צהרונים באחריותו (${gs.length}):\n`;
  // group by city
  const byCity={};
  gs.forEach(g=>{if(!byCity[g.city])byCity[g.city]=[];byCity[g.city].push(g);});
  Object.keys(byCity).sort().forEach(city=>{
    txt+=`\n📍 ${city}:\n`;
    byCity[city].forEach(g=>{
      const cr=resolveGardenContact(g);
      txt+=`  ${gcls(g)==='ביה"ס'?'🏛️':'🏫'} ${g.name}` + '\n';
      if(g.st) txt+='     📍 ' + g.st + '\n';
      if(cr.name) txt+='     👤 ' + cr.name + '\n';
      if(cr.phone) txt+='     📞 ' + cr.phone + '\n';
    });
  });
  (document.getElementById('mgr-export-text')||{}).textContent =txt;
  document.getElementById('mgr-export-m').classList.add('open');
}

function copyMgrExport(){
  const txt=document.getElementById('mgr-export-text').textContent;
  navigator.clipboard.writeText(txt).then(()=>showToast('✅ הועתק!')).catch(()=>{
    const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);showToast('✅ הועתק!');
  });
}

function shareMgrWhatsApp(){
  const txt=document.getElementById('mgr-export-text').textContent;
  window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
}

function refreshMgrDrops(){
  const mgrOptions=()=>{
    let opts='<option value="">הכל</option>';
    Object.values(managers).sort((a,b)=>a.name.localeCompare(b.name,'he'))
      .forEach(m=>opts+=`<option value="${m.id}">${m.role==='manager'?'🏛️':'👤'} ${m.name}</option>`);
    return opts;
  };
  const el=document.getElementById('g-mgr');
  if(el){const c=el.value;el.innerHTML=mgrOptions();el.value=c;}
  const el2=document.getElementById('s-mgr');
  if(el2){const c=el2.value;el2.innerHTML=mgrOptions();el2.value=c;}
  const mf=document.getElementById('mgr-city-filt');
  if(mf){const c=mf.value;mf.innerHTML='<option value="">כל הערים</option>';cities().forEach(city=>mf.innerHTML+=`<option value='${city}'>${city}</option>`);mf.value=c;}
}

function getGardenMgr(gid){
  return Object.values(managers).find(m=>(m.gardenIds||[]).includes(gid))||null;
}
function setGardensTab(t){
  _gardensTab = t;
  document.querySelectorAll('[id^="g-tab-"]').forEach(btn => {
    const btnT = btn.id.replace('g-tab-', '').replace('-desktop', '').replace('-mobile', '');
    btn.classList.toggle('active', btnT === t);
  });

  const gBody = document.getElementById('g-body');
  const gToolsD = document.getElementById('gardens-tools-desktop');
  const gToolsM = document.getElementById('gardens-tools-mobile');
  const fixedCtrl = document.getElementById('g-fixed-controls');
  const addBtns = document.querySelectorAll('#p-gardens .btn.bp');

  const isG = ['gan','sch'].includes(t);
  if(gToolsD) gToolsD.style.display = isG ? '' : 'none';
  if(gToolsM) gToolsM.style.display = isG ? '' : 'none';
  if(fixedCtrl) fixedCtrl.style.display = t==='fixed' ? '' : 'none';
  const gInfo = document.getElementById('g-info');
  if(gInfo) gInfo.style.display = t==='fixed' ? 'none' : '';
  addBtns.forEach(btn => btn.style.display = isG ? '' : 'none');

  if(t==='pairs'){
    gBody.className='scroll-area';
    gBody.innerHTML='';
    const src=document.querySelector('#p-pairs .card');
    if(src){ gBody.innerHTML=src.innerHTML; }
    if(typeof renderPairs === 'function') renderPairs();
    return;
  }
  if(t==='clusters'){
    gBody.className='scroll-area';
    gBody.innerHTML='';
    const src=document.querySelector('#p-clusters .card');
    if(src){ gBody.innerHTML=src.innerHTML; }
    if(typeof renderClusters === 'function') renderClusters();
    return;
  }
  if(t==='managers'){
    gBody.className='scroll-area';
    gBody.innerHTML='';
    const src=document.querySelector('#p-managers');
    if(src){ gBody.innerHTML=src.innerHTML; }
    renderManagers(); refreshMgrDrops();
    return;
  }
  if(t==='fixed'){
    gBody.className='scroll-area';
    const now=new Date();
    const mFrom=document.getElementById('g-fixed-from');
    const mTo=document.getElementById('g-fixed-to');
    if(mFrom&&!mFrom.value)
      mFrom.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    if(mTo&&!mTo.value){
      const lastDay=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
      mTo.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    }
    renderGardensFixed();
    setTimeout(_fitScrollAreas,50);
    return;
  }
  // gan / sch
  gBody.className='scroll-area';
  const gClsEl = window.getEl ? window.getEl('g-cls') : document.getElementById('g-cls');
  if (gClsEl) {
    if (t === 'gan') gClsEl.value = 'גנים';
    else if (t === 'sch') gClsEl.value = 'ביה"ס';
  }
  if(typeof renderGardens === 'function') renderGardens();
}

// ── Fixed-schedule view ──────────────────────────────────────────
const HEB_DAYS_SHORT=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

function getGardenFixedSched(gardenId, fromDate, toDate){
  const gardenEvs = SCH.filter(s=>{
    if(s.g!==gardenId) return false;
    if(s.st&&s.st!=='ok') return false;
    if(fromDate && s.d < fromDate) return false;
    if(toDate   && s.d > toDate)   return false;
    return true;
  });
  // Strategy 1: use _recId groups (take latest occurrence per series)
  const byRecId = {};
  gardenEvs.filter(s=>s._recId).forEach(s=>{
    if(!byRecId[s._recId] || s.d > byRecId[s._recId].d) byRecId[s._recId]=s;
  });
  const fromRecurring = Object.values(byRecId);
  // Strategy 2: if no _recId, find entries that repeat same dow+supplier+time
  const fromRepeat = [];
  if(fromRecurring.length===0){
    const slotCount = {};
    gardenEvs.forEach(s=>{
      const dow = new Date(s.d).getDay();
      const key = `${dow}|${supBase(s.a)||s.a}|${(s.t||'').slice(0,5)}`;
      if(!slotCount[key]) slotCount[key]={count:0, latest:s};
      slotCount[key].count++;
      if(s.d > slotCount[key].latest.d) slotCount[key].latest=s;
    });
    Object.values(slotCount).filter(v=>v.count>=2).forEach(v=>fromRepeat.push(v.latest));
  }
  const result = fromRecurring.length>0 ? fromRecurring : fromRepeat;
  return result.sort((a,b)=>{
    const da=new Date(a.d).getDay(), db=new Date(b.d).getDay();
    if(da!==db) return da-db;
    return (a.t||'').localeCompare(b.t||'');
  });
}

function renderGardensFixed(){
  const cityF=(document.getElementById('g-city')||{}).value||'';
  const srch=((document.getElementById('g-srch')||{}).value||'').toLowerCase();
  const fixedFromEl=document.getElementById('g-fixed-from');
  const fixedToEl=document.getElementById('g-fixed-to');
  const fixedFrom=fixedFromEl?fixedFromEl.value:'';
  const fixedTo=fixedToEl?fixedToEl.value:'';
  const allG=[...GARDENS,...(_GARDENS_EXTRA||[])].filter(g=>{
    if(gcls(g)!=='גנים') return false;
    if(cityF&&g.city!==cityF) return false;
    if(srch&&![(g.name||''),(g.city||'')].some(x=>x.toLowerCase().includes(srch))) return false;
    return true;
  });
  const byCity={};
  allG.forEach(g=>{ const c=g.city||'אחר'; if(!byCity[c]) byCity[c]=[]; byCity[c].push(g); });
  const sortedCities=Object.keys(byCity).sort((a,b)=>a.localeCompare(b,'he'));

  let h='';
  sortedCities.forEach(city=>{
    const gardens = byCity[city];
    const paired=new Set(), groups=[];
    [...gardens].sort((a,b)=>(a.name||'').localeCompare(b.name||'','he')).forEach(g=>{
      if(paired.has(g.id)) return;
      const pid=gardenPair(g.id);
      const partner=pid?allG.find(x=>x.id===pid):null;
      if(partner){ paired.add(g.id); paired.add(partner.id); groups.push({type:'pair',gardens:[g,partner]}); }
      else groups.push({type:'solo',gardens:[g]});
    });

    h+=`<details class="city-accordion">
      <summary>
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <span style="font-weight:800; color:#2d3748;">🏙️ ${city} (${gardens.length} גנים)</span>
          <span style="font-size:0.8rem; color:#718096;">לחץ לפירוט</span>
        </div>
      </summary>
      <div class="city-accordion-content">`;

    groups.forEach(group=>{
      if(group.type==='pair'){
        h+=`<div style="background:#f3e5f5;border-radius:6px;padding:3px 10px;margin-bottom:5px;font-size:.72rem;color:#6a1b9a;font-weight:700">🔗 ${group.gardens[0].name} + ${group.gardens[1].name}</div>`;
        group.gardens.forEach(g=>{ h+=_renderGardenFixedRow(g); });
      } else {
        h+=_renderGardenFixedRow(group.gardens[0]);
      }
    });
    h+='</div></details>';
  });

  document.getElementById('g-body').innerHTML=h||'<p style="color:#999;padding:20px">לא נמצאו צהרונים</p>';
}

function _renderGardenFixedRow(g){
  const _fFrom=(document.getElementById('g-fixed-from')||{}).value||'';
  const _fTo=(document.getElementById('g-fixed-to')||{}).value||'';
  const fixedEvs=getGardenFixedSched(g.id, _fFrom, _fTo);
  const gid=g.id;
  let rows='';
  if(fixedEvs.length){
    fixedEvs.forEach(s=>{
      const dow=new Date(s.d).getDay();
      const supN=supBase(s.a)||s.a||'ללא שם';
      const actN=s.act||supAct(s.a)||'';
      const time=s.t?s.t.slice(0,5):'—';
      const key = s._recId || `${s.a}_${s.act}_${dow}`;
      
      // Look for partner info
      let partnerInfo = '<span style="color:#90a4ae">—</span>';
      const pair = window.gardenPair(gid);
      if (pair) {
        const partnerId = pair.ids.find(id => Number(id) !== Number(gid));
        if (partnerId) {
          const pg = window.G(partnerId);
          const pev = window.SCH.find(ps => Number(ps.g) === Number(partnerId) && ps.d === s.d && window.supBase(ps.a) === window.supBase(s.a));
          partnerInfo = `<span style="font-weight:700;color:var(--c-secondary)">${pg.name}</span> ${pev ? '<span style="font-size:var(--fs-small);color:var(--c-text-light)">('+window.fT(pev.t)+')</span>' : '<span style="color:var(--c-error);font-size:var(--fs-small)">(לא משובץ)</span>'}`;
        }
      }

      rows+=`<tr style="border-bottom:1px solid #eef0fb">
        <td style="padding:3px 10px;font-weight:600;color:#1a237e;white-space:nowrap">יום ${HEB_DAYS_SHORT[dow]}</td>
        <td style="padding:3px 10px;color:#2e7d32;font-weight:600;white-space:nowrap">${time}</td>
        <td style="padding:3px 10px;color:#222">${supN}${actN?' — '+actN:''}</td>
        <td style="padding:3px 10px;color:var(--c-secondary);font-size:var(--fs-small)">${s.tp||'חוג'}</td>
        <td style="padding:3px 10px;font-size:var(--fs-small)">${partnerInfo}</td>
        <td style="padding:2px 6px;white-space:nowrap">
          <button onclick="event.stopPropagation();openGM(${gid});setTimeout(()=>window.openBulkUpdateRecurring('${key}',${gid}),100)" style="background:#e8eaf6;border:none;border-radius:4px;padding:2px 7px;font-size:.68rem;cursor:pointer;color:#3949ab" title="ערוך שיבוץ קבוע (סדרה)">✏️</button>
          <button onclick="event.stopPropagation();openSP('${s.id}')" style="background:#ffebee;border:none;border-radius:4px;padding:2px 7px;font-size:.68rem;cursor:pointer;color:#c62828;margin-right:2px" title="ביטול/החרגה חד פעמית">❌</button>
        </td>
      </tr>`;
    });
  } else {
    rows=`<tr><td colspan="4" style="padding:5px 10px;color:#bbb;font-size:.72rem;font-style:italic">אין שיבוץ קבוע</td></tr>`;
  }
  return `<div style="display:flex;margin-bottom:7px;border:1px solid #e3e7f5;border-radius:8px;overflow:hidden">
    <div style="background:#f5f7ff;padding:8px 10px;min-width:120px;max-width:140px;display:flex;flex-direction:column;justify-content:space-between;border-left:1px solid #e3e7f5">
      <div style="font-weight:800;color:var(--c-primary);font-size:var(--fs-card-title);margin-bottom:6px">${g.name}</div>
      <div style="display:flex;flex-direction:column;gap:3px;margin-top:4px">
        <button class="btn bp bsm" style="font-size:.62rem;padding:2px 5px" onclick="openGM(${gid})">📂 כרטיס</button>
        <button class="btn bo bsm" style="font-size:.62rem;padding:2px 5px" onclick="_goToGardenSched(${gid})">📅 שיבוצים</button>
      </div>
    </div>
    <div style="flex:1;overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:.78rem">
        <thead><tr style="background:#eef2ff">
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700">יום</th>
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700">שעה</th>
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700">ספק / פעילות</th>
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700">סוג</th>
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700">גן בן-זוג</th>
          <th style="padding:3px 10px;text-align:right;color:#3949ab;font-weight:700"></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function _goToGardenSched(gardenId){
  ST('sched');
  setTimeout(()=>{
    const sel=document.getElementById('s-g1');
    if(sel){ sel.value=gardenId; renderSched(); }
  },250);
}
var _gardensTab='gan';
// ─── ADD PLACE ────────────────────────────────────────
function openAddGardenModal(){
  document.getElementById('ap-name').value='';
  document.getElementById('ap-addr').value='';
  document.getElementById('ap-co').value='';
  document.getElementById('ap-coph').value='';
  document.getElementById('ap-notes').value='';
  document.getElementById('ap-cls').value=_gardensTab==='sch'?'ביה"ס':'גנים';
  const apCity=document.getElementById('ap-city');
  apCity.innerHTML='<option value="">בחר עיר...</option>';
  cities().forEach(c=>apCity.innerHTML+=`<option value='${c}'>${c}</option>`);
  (document.getElementById('addplace-title')||{}).textContent ='➕ הוסף '+(_gardensTab==='sch'?'בית ספר':'צהרון / גן');
  document.getElementById('addplace-m').classList.add('open');
}
function saveNewPlace(){
  const name=document.getElementById('ap-name').value.trim();
  const city=document.getElementById('ap-city').value;
  if(!name||!city){_spAlertDialog('יש למלא שם ועיר');return;}
  const newId=Math.max(...GARDENS.map(g=>g.id),0)+Date.now()%100000;
  const newG={
    id:newId,
    name,
    city,
    st:document.getElementById('ap-addr').value.trim(),
    co:document.getElementById('ap-co').value.trim(),
    coph:document.getElementById('ap-coph').value.trim(),
    notes:document.getElementById('ap-notes').value.trim(),
    cls:document.getElementById('ap-cls').value
  };
  _GARDENS_EXTRA.push(newG);
  if(!supEx['__gardens_extra']) supEx['__gardens_extra']=[];
  supEx['__gardens_extra']=_GARDENS_EXTRA;
  save();CM('addplace-m');refresh();
  _spAlertDialog('✅ '+name+' נוסף בהצלחה!');
}

// ─── Mobile nav ───────────────────────────────────────
function mobNav(btn){
  document.querySelectorAll('#mob-nav .mob-nav-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
}
function mobNavPurch(btn){
  document.querySelectorAll('#mob-nav-purch .mob-nav-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
}

// ─── Data backup / restore ────────────────────────────
function exportData(){
  const data=_safeLS.getItem('ganv5')||'{}';
  const snaps=_safeLS.getItem('ganv5_snaps')||'[]';
  const todos=_safeLS.getItem('ganv5_todos')||'[]';
  const blob=new Blob([JSON.stringify({data:JSON.parse(data),snaps:JSON.parse(snaps),todos:JSON.parse(todos),ts:Date.now()},null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='kids_backup_'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('✅ גיבוי הורד בהצלחה');
}
function importData(){
  const inp=document.createElement('input');
  inp.type='file';inp.accept='.json';
  inp.onchange=e=>{
    const file=e.target.files[0];if(!file) return;
    const reader=new FileReader();
    reader.onload = async ev=>{
      try{
        const parsed=JSON.parse(ev.target.result);
        const data=parsed.data||parsed; // support both formats
        if(!await window.spConfirm('⚠️ ייבוא יחליף את כל הנתונים הנוכחיים.\nהמשך?')) return;
        _safeLS.setItem('ganv5',JSON.stringify(data));
        if(parsed.snaps) _safeLS.setItem('ganv5_snaps',JSON.stringify(parsed.snaps));
        showToast('✅ הנתונים יובאו. טוען מחדש...');
        setTimeout(()=>location.reload(),1200);
      }catch(err){_spAlertDialog('שגיאה בקובץ הגיבוי: '+err.message);}
    };
    reader.readAsText(file);
  };
  inp.click();
}


function showToast(msg,ms=2500){
  let t=document.getElementById('toast-msg');
  if(!t){t=document.createElement('div');t.id='toast-msg';
    t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(30,30,30,.92);color:#fff;padding:9px 20px;border-radius:20px;font-size:.82rem;z-index:9999;pointer-events:none;transition:opacity .3s;white-space:nowrap';
    document.body.appendChild(t);}
  t.textContent=msg;t.style.opacity='1';
  clearTimeout(t._t);t._t=setTimeout(()=>t.style.opacity='0',ms);
}

// ─── PWA Service Worker registration ──────────────────
if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
    }
  });
}



/* ══ Universal filter toggle (desktop + mobile) ══════════════════ */
window.fltToggle = function(wrapId, btnId) {
  const wrap = document.getElementById(wrapId);
  const btn  = document.getElementById(btnId);
  if (!wrap) return;
  const open = wrap.classList.toggle('open');
  if (btn) btn.classList.toggle('open', open);
};
/* Legacy alias */
window.mobToggleFilters = function(id) { window.fltToggle(id, id+'-btn'); };
// Get the phone number to display in schedule for a supplier
function getSupPhone(name){
  const base=supBase(name);
  const ex=supBaseEx(base);
  const schedPhone=ex.schedPhone||'ph1';
  if(schedPhone==='ph2'&&ex.ph2) return ex.ph2;
  const s=SUPBASE.find(x=>supBase(x.name)===base)||{};
  return ex.ph1||s.phone||'';
}


function togglePiFlt(){
  const body=document.getElementById('pi-flt-body');
  const arrow=document.getElementById('pi-flt-arrow');
  if(!body) return;
  const isOpen=body.classList.toggle('open');
  if(arrow) arrow.classList.toggle('open',isOpen);
}
// On desktop: always show filter, on mobile default collapsed
(function(){
  function initPiFlt(){
    const body=document.getElementById('pi-flt-body');
    const header=document.getElementById('pi-flt-header');
    if(!body) return;
    if(window.innerWidth>768){
      body.style.display='flex';
      if(header) header.style.cursor='default';
      const arrow=document.getElementById('pi-flt-arrow');
      if(arrow) arrow.style.display='none';
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initPiFlt);
  else initPiFlt();
  window.addEventListener('resize',()=>{
    const body=document.getElementById('pi-flt-body');
    const arrow=document.getElementById('pi-flt-arrow');
    if(!body) return;
    if(window.innerWidth>768){ body.style.display='flex'; if(arrow) arrow.style.display='none'; }
    else { if(!body.classList.contains('open')) body.style.display=''; if(arrow) arrow.style.display=''; }
  });
})();

// Mobile: tap Firebase button = immediate sync + show modal
async function mobileQuickSync(){
  const btn = document.getElementById('od-btn');
  if(btn){ btn.textContent='🔄 מסנכרן...'; btn.style.background='#e65100'; }
  try{
    // Force token refresh — critical after Rules change
    if(window._fbUser){
      try{ window._cachedToken = await window._fbUser.getIdToken(true); }
      catch(te){ console.warn('Token refresh failed:', te.message); }
    }
    const ok = await loadFromFirebase(false, true);
    await saveToFirebase(false);
    showToast(ok ? '✅ סונכרן עם Firebase' : '⚠️ טעינה נכשלה — בדוק חיבור');
  } catch(e){
    showToast('❌ שגיאת סנכרון: ' + e.message);
    console.error('Sync error:', e);
  }
  _fbUpdateStatus();
}

// ── Invoice status multi-select filter ────────────────────────
const PI_ST_KEY = 'pi_status_filter';

// ── Memory error cleanup ────────────────────────
function cleanupStaleLocalStorage() {
  const currentKey = 'ganv5_y_' + (window.CURRENT_YEAR || 'tashpav');
  let toDelete = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('ganv5_y_') && key !== currentKey) {
      toDelete.push(key);
    }
  }
  toDelete.forEach(k => {
    try { localStorage.removeItem(k); console.log('Cleaned up stale storage key:', k); } catch(e){}
  });
  
  try {
    const snaps = localStorage.getItem('ganv5_snaps');
    if (snaps && snaps.length > 5 * 1024 * 1024) { // 5MB
      localStorage.removeItem('ganv5_snaps');
      console.log('Cleaned up oversized snaps data');
    }
  } catch(e) {}
}

// ── Cross-tab sync listener ────────────────────────
window.addEventListener('storage', (e) => {
  if (e.key && e.key.startsWith('ganv5_y_') && !window._isSaving) {
    showToast('⚠️ נתונים שונו בלשונית אחרת — רענן את הדף', 5000);
  }
});

function _getPiStSelected(){
  return [...document.querySelectorAll('.pi-st-cb:checked')].map(c=>c.value);
}

function _setPiStLabel(){
  const sel = _getPiStSelected();
  const lbl = document.getElementById('pi-status-label');
  if(!lbl) return;
  const names = {'order':'הזמנה','tx_invoice':'חשבונית עסקה','tax_invoice':'חשבונית מס','tax_receipt':'חשבונית מס קבלה','receipt':'קבלה','cancelled':'מבוטל'};
  if(!sel.length) lbl.textContent='הכל';
  else if(sel.length===1) lbl.textContent=names[sel[0]]||sel[0];
  else lbl.textContent=`${sel.length} סטטוסים`;
}

function piStChange(){
  // If all 6 checked → show "הכל"
  const all = document.querySelectorAll('.pi-st-cb');
  const checked = document.querySelectorAll('.pi-st-cb:checked');
  const allCb = document.getElementById('pi-st-all');
  if(allCb) allCb.checked = checked.length === all.length;
  _setPiStLabel();
  // Save to localStorage
  try{
    const _piSt = JSON.stringify(_getPiStSelected());
    _safeLS.setItem(PI_ST_KEY, _piSt);
    const _tok = window._cachedToken;
    if(_tok) fetch('https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data/piStatusFilter.json?auth='+_tok,{
      method:'PUT', headers:{'Content-Type':'application/json'}, body:_piSt
    }).catch(()=>{});
  }catch(e){}
  renderInvoices();
}

function piStAll(cb){
  document.querySelectorAll('.pi-st-cb').forEach(c=>c.checked=cb.checked);
  _setPiStLabel();
  try{
    const _piStC = JSON.stringify(cb.checked?[]:[]);
    _safeLS.setItem(PI_ST_KEY, _piStC);
    const _tok2 = window._cachedToken;
    if(_tok2) fetch('https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data/piStatusFilter.json?auth='+_tok2,{
      method:'PUT', headers:{'Content-Type':'application/json'}, body:_piStC
    }).catch(()=>{});
  }catch(e){}
  renderInvoices();
}

function togglePiStatusMenu(){
  const menu = document.getElementById('pi-status-menu');
  if(!menu) return;
  const isOpen = menu.style.display !== 'none';
  if(isOpen){ menu.style.display='none'; return; }
  menu.style.display='block';
  // Close on outside click
  setTimeout(()=>{
    function close(e){
      const btn=document.getElementById('pi-status-btn');
      if(!menu.contains(e.target)&&!btn?.contains(e.target)){
        menu.style.display='none';
        document.removeEventListener('click',close);
      }
    }
    document.addEventListener('click',close);
  },10);
}

function initPiStatusFilter(){
  // Load saved selection
  try{
    // Load from Firebase first, fallback to localStorage
    const _fbPiSt = window._fbAppData && window._fbAppData.piStatusFilter;
    const saved = _fbPiSt || JSON.parse(_safeLS.getItem(PI_ST_KEY)||'null');
    if(_fbPiSt) _safeLS.setItem(PI_ST_KEY, JSON.stringify(_fbPiSt)); // sync to local
    if(saved && Array.isArray(saved) && saved.length>0){
      document.querySelectorAll('.pi-st-cb').forEach(cb=>{
        cb.checked = saved.includes(cb.value);
      });
    } else {
      // Default: all unchecked = show all
    }
  }catch(e){}
  _setPiStLabel();
}

// Call after DOM ready
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', initPiStatusFilter);
} else { initPiStatusFilter(); }

window.getEl = function(id) {
  if (window.isMobileMode()) {
    return document.getElementById(id + '-mobile') || document.getElementById(id + '-desktop') || document.getElementById(id);
  }
  return document.getElementById(id + '-desktop') || document.getElementById(id + '-mobile') || document.getElementById(id);
};

window.syncDashDate = function(val) {
  const d = document.getElementById('dash-date-desktop');
  const m = document.getElementById('dash-date-mobile');
  if (d) d.value = val;
  if (m) m.value = val;
};

function dashNavDate(d){
  const el = window.getEl('dash-date');
  if(!el) return;
  let newVal = '';
  if(d===0){ newVal = window.td(); }
  else if(d===999){ newVal = ''; }
  else {
    const cur = el.value ? window.s2d(el.value) : new Date();
    newVal = window.d2s(window.addD(cur, d));
  }
  window.syncDashDate(newVal);
  if(window.renderDash) window.renderDash();
}

// _listGroupMode handled globally in data.js / cal.js

function _tryOpenLocalFile(p){
  // Try multiple methods to open a local path
  // Method 1: file:// URL (works in some browsers with local file access)
  const fileUrl = p.startsWith('\\\\') 
    ? 'file:' + p.replace(/\\/g,'/') 
    : p.replace(/\\/g,'/').replace(/^([A-Za-z]):/, 'file:///$1:');
  
  // Method 2: Try window.open with file://
  const w = window.open(fileUrl, '_blank');
  if(w){
    setTimeout(()=>{
      // If nothing happened (blocked), show instructions
      showToast('📂 נסה לפתוח — אם לא נפתח, העתק את הנתיב ופתח ידנית');
    }, 800);
  } else {
    // Popup blocked — copy path and instruct
    _copyToClipboard(p);
    showToast('📋 הנתיב הועתק — פתח סייר קבצים והדבק');
  }
}

// Global Bridge for core helpers
window.G = G;
window.gcls = gcls;
window.d2s = d2s;
window.s2d = s2d;
window.fD = fD;
window.fT = fT;
window.addD = addD;
window.monStart = monStart;
window.dayN = dayN;
window.td = td;
window.stLabel = stLabel;
window.stClass = stClass;
window.gardenPair = gardenPair;
window.showToast = showToast;
window.ST = ST;
window.askYesNo = (msg, onYes) => {
  const m = document.getElementById('askm');
  if(!m) return;
  document.getElementById('ask-msg').innerText = msg;
  const y = document.getElementById('ask-yes');
  const n = document.getElementById('ask-no');
  y.onclick = () => { CM('askm'); if(onYes) onYes(); };
  n.onclick = () => { CM('askm'); };
  m.classList.add('open');
};

window.getBlockedInfo = getBlockedInfo;
window.openSP = window.openSP || (()=>{});
// qSetSt removed - use the one in activity.js

window.getGardenBlock = getGardenBlock;

// ── Year Management ──
window.initYearSelector = function() {
  const sel = document.getElementById('year-selector');
  if (!sel) return;
  try {
    const metaStr = window._safeLS.getItem('ganv5_meta');
    if (metaStr) {
      const meta = JSON.parse(metaStr);
      const yearKeys = Object.keys(meta.years || {});
      sel.innerHTML = '';
      yearKeys.forEach(k => {
        const v = meta.years[k];
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = v.name || k;
        if (k === window.CURRENT_YEAR) opt.selected = true;
        sel.appendChild(opt);
      });
      // Show selector if at least 1 year exists
      sel.style.display = yearKeys.length >= 1 ? '' : 'none';
    }
  } catch(e) {}
  
  // Show archive warning banner if viewing a non-latest year
  _showArchiveBanner();
};

function _showArchiveBanner() {
  // Remove existing banner if any
  const existing = document.getElementById('archive-year-banner');
  if (existing) existing.remove();
  
  try {
    const metaStr = window._safeLS.getItem('ganv5_meta');
    if (!metaStr) return;
    const meta = JSON.parse(metaStr);
    const yearKeys = Object.keys(meta.years || {});
    if (yearKeys.length <= 1) return; // Only one year — no banner needed
    
    // Find the "latest" year (last in the order)
    const latestYear = yearKeys[yearKeys.length - 1];
    if (window.CURRENT_YEAR === latestYear) return; // We're on the latest — no banner
    
    const yearName = (meta.years[window.CURRENT_YEAR] || {}).name || window.CURRENT_YEAR;
    const banner = document.createElement('div');
    banner.id = 'archive-year-banner';
    banner.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;background:linear-gradient(135deg,#fff3e0,#ffe0b2);border:2px solid #e65100;border-radius:20px;padding:8px 20px;display:flex;align-items:center;justify-content:center;gap:10px;font-size:.85rem;font-weight:700;color:#bf360c;box-shadow:0 4px 15px rgba(0,0,0,.2);transition:opacity 0.6s ease-in-out, transform 0.6s ease-in-out;opacity:0;pointer-events:none;';
    banner.innerHTML = `⚠️ אתה צופה/עורך את <span style="background:#e65100;color:#fff;border-radius:6px;padding:2px 8px;font-size:.78rem">${yearName}</span>`;
    document.body.appendChild(banner);
    
    // Animate in
    setTimeout(() => {
      banner.style.opacity = '1';
    }, 100);
    
    // Animate out and remove after 4.5 seconds
    setTimeout(() => {
      banner.style.opacity = '0';
      banner.style.transform = 'translate(-50%, -20px)';
      setTimeout(() => banner.remove(), 600);
    }, 4500);
    
  } catch(e) {}
}

window.changeCurrentYear = function(year) {
  if (year === window.CURRENT_YEAR) return;
  try {
    const metaStr = window._safeLS.getItem('ganv5_meta');
    if (metaStr) {
      const meta = JSON.parse(metaStr);
      meta.currentYear = year;
      window._safeLS.setItem('ganv5_meta', JSON.stringify(meta));
      window.location.reload();
    }
  } catch(e) {}
};

document.addEventListener('DOMContentLoaded', window.initYearSelector);

// [End of core.js]
