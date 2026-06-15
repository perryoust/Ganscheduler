
// renderInvoices and refreshPurchDash moved to invoices.js


// ג”€ג”€ Purch Suppliers panel ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
let _pSupTab='all', _pSupView='cards';
function setPSupTab(t){
  _pSupTab=t;
  ['all','act','purch'].forEach(x=>{
    const b=document.getElementById('psup-tab-'+x);
    if(b) b.classList.toggle('active',x===t);
  });
  renderPurchSuppliers();
}
function setPSupView(v){
  _pSupView=v;
  document.getElementById('psu-view-cards')?.classList.toggle('active',v==='cards');
  document.getElementById('psu-view-list')?.classList.toggle('active',v==='list');
  renderPurchSuppliers();
}
// ג”€ג”€ Purch supplier panel helpers (use index to avoid HTML escaping) ג”€ג”€
let _psupCurrentList = []; // set by renderPurchSuppliers
function psupOpen(idx){ const n=_psupCurrentList[idx]?.name||''; if(n) openSupCard(n); }
function psupEdit(idx){ 
  const n=_psupCurrentList[idx]?.name||''; 
  if(!n) return;
  openSupCard(n); 
  setTimeout(sucToggleEdit,250); 
}
function psupNewInvoice(idx){ openNewInvoice(null, _psupCurrentList[idx]?.name||''); }

// Emergency: clear corrupt mergedAway and rebuild supplier list
async function emergencyFixSuppliers(){
  if(!await window.spConfirm('׳–׳” ׳™׳׳₪׳¡ ׳׳× ׳¨׳©׳™׳׳× ׳”׳¡׳₪׳§׳™׳ ׳”׳׳׳•׳–׳’׳™׳ ׳•׳™׳‘׳ ׳” ׳׳—׳“׳© ׳׳× ׳›׳ ׳”׳¡׳₪׳§׳™׳. ׳׳”׳׳©׳™׳?')) return;
  supEx['__merged_away']=[];
  // Also clear __c to rebuild from scratch
  supEx['__c']=[];
  repairAllSuppliers();
  save();
  setTimeout(()=>{ renderPurchSuppliers(); renderSup(); showToast('ג… ׳¡׳₪׳§׳™׳ ׳׳•׳₪׳¡׳• ׳•׳ ׳‘׳ ׳• ׳׳—׳“׳©'); }, 200);
}

function renderPurchSuppliers(){
  const el = document.getElementById('psu-body');
  if(!el) return;
  if(typeof SUPBASE==='undefined'||!Array.isArray(SUPBASE)||SUPBASE.length===0){
    el.innerHTML='<div style="color:#aaa;padding:20px;text-align:center">׳˜׳•׳¢׳ ׳ ׳×׳•׳ ׳™׳...</div>';
    setTimeout(renderPurchSuppliers, 500);
    return;
  }
  const srch = (document.getElementById('psu-srch')?.value||'').toLowerCase();
  const sortMode = document.getElementById('psu-sort')?.value||'name';
  const allSups = getAllSup();
  console.log('renderPurchSuppliers: getAllSup returned', allSups.length, ', SUPBASE:', SUPBASE.length);
  let list = allSups.filter(s=>{
    const base=s.name||'';
    if(srch && !base.toLowerCase().includes(srch)) return false;
    if(_pSupTab==='act') return isActSupplier(base);
    if(_pSupTab==='purch') return !isActSupplier(base);
    return true; // all
  });
  list = [...list].sort((a,b)=>(a.name||'').localeCompare(b.name||'','he'));
  if(sortMode==='cnt') list=[...list].sort((a,b)=>supBaseCnt(b.name)-supBaseCnt(a.name));
  _psupCurrentList = list; // save for index-based onclick helpers

  if(!list.length){
    // Show debug info to help diagnose the empty list
    el.innerHTML='<div style="color:#aaa;padding:30px;text-align:center">׳׳™׳ ׳¡׳₪׳§׳™׳ ׳׳”׳¦׳’׳”.<br><button class="btn bg" style="margin-top:10px" onclick="emergencyFixSuppliers()">נ”§ ׳‘׳ ׳” ׳׳—׳“׳©</button></div>';
    return;
  }

  const MAX_RENDER = 150;
  const isCapped = list.length > MAX_RENDER;
  const renderList = isCapped ? list.slice(0, MAX_RENDER) : list;
  const cappedMsg = isCapped ? `<div style="text-align:center;color:#888;padding:15px;font-size:0.8rem;grid-column:1/-1">׳׳¦׳™׳’ ${MAX_RENDER} ׳¡׳₪׳§׳™׳ ׳׳×׳•׳ ${list.length}. ׳”׳©׳×׳׳© ׳‘׳—׳™׳₪׳•׳© ׳׳׳™׳§׳•׳“...</div>` : '';

  if(_pSupView==='list'){
    // List view
    let h='<table style="width:100%;border-collapse:collapse;font-size:.83rem">'
      +'<thead><tr style="background:#e8eaf6;position:sticky;top:0">'
      +'<th style="padding:7px 10px;text-align:right">׳¡׳₪׳§</th>'
      +'<th style="padding:7px 8px;text-align:center">׳₪׳¢׳™׳׳•׳™׳•׳×</th>'
      +'<th style="padding:7px 8px;text-align:right">׳˜׳׳₪׳•׳</th>'
      +'<th style="padding:7px 8px;text-align:right">׳¡׳•׳’</th>'
      +'<th style="padding:7px 8px"></th>'
      +'</tr></thead><tbody>';
    renderList.forEach((s,idx)=>{
      const base=s.name;
      const ex=supBaseEx(base);
      const cnt=supBaseCnt(base);
      const phone=ex.ph1||s.phone||'';
      // Use data-idx to avoid HTML attribute escaping issues with special chars
      const bg=idx%2===0?'#fff':'#f8f9ff';
      h+=`<tr style="background:${bg};cursor:pointer;border-bottom:2px solid #e8eaf6" onclick="psupOpen(${idx})">`
        +`<td style="padding:6px 10px;font-weight:700;color:#1a237e">${base}`
        +`${isActSupplier(base)?' <span style="font-size:.65rem;color:#2e7d32">נ¨</span>':''}`
        +`</td>`
        +`<td style="padding:6px 8px;text-align:center;color:#1565c0;font-weight:700">${isActSupplier(base)?cnt:'ג€”'}</td>`
        +`<td style="padding:6px 8px;color:#2e7d32">${phone||'ג€”'}</td>`
        +`<td style="padding:6px 8px;font-size:.76rem;color:#546e7a">${ex.entityType||''}</td>`
        +`<td style="padding:6px 8px;white-space:nowrap" onclick="event.stopPropagation()">`
        +`<button class="btn bp bsm" style="font-size:.65rem" onclick="psupNewInvoice(${idx})">נ“„ ׳”׳–׳׳ ׳”</button> `
        +`<button class="btn bo bsm" style="font-size:.65rem" onclick="psupEdit(${idx})">גן¸</button>`
        +`</td></tr>`;
    });
    if(isCapped){
      h+=`<tr><td colspan="5">${cappedMsg.replace('grid-column:1/-1', '')}</td></tr>`;
    }
    h+='</tbody></table>';
    el.innerHTML=h;
    return;
  }

  // Cards view
  const _cardsHtml=renderList.map((s,idx)=>{
    const base=s.name;
    const ex=supBaseEx(base);
    const cnt=supBaseCnt(base);
    const acts=getSupActs(base);
    const phone=ex.ph1||s.phone||'';
    const cntDone=SCH.filter(sc=>supBase(sc.a)===base&&sc.st==='done').length;
    const isAct = isActSupplier(base);
    return `<div class="sucard" style="cursor:pointer;display:flex;flex-direction:column;justify-content:space-between" onclick="psupOpen(${idx})">
      <div>
        <div class="font-800 text-primary text-base mb-2 break-word" style="line-height:1.35">
          נ“ ${base}
          ${isAct?'<span class="text-xs text-success rounded-6" style="background:#e8f5e9;padding:1px 5px;margin-right:4px">נ¨</span>':''}
        </div>
        ${phone?`<div class="text-success text-sm font-600 mb-2">נ“ ${phone}</div>`:''}
        ${acts.length&&isAct?`<div class="mb-2 flex-c flex-wrap gap-3">
          ${acts.map(a=>`<span class="text-xs font-600 text-secondary rounded-10" style="background:#e3f2fd;padding:2px 8px">נ¯ ${a}</span>`).join('')}
        </div>`:''}
        ${ex.entityType?`<div class="text-xs mb-1" style="color:#6a1b9a">נ¢ ${ex.entityType}</div>`:''}
        ${ex.notes?`<div class="text-xs text-light mb-1">נ“ ${ex.notes}</div>`:''}
      </div>
      <div class="flex-c justify-between mt-2 pt-2" style="border-top:1px solid #f0f0f0">
        <span class="text-xs font-bold text-secondary">${isAct?`נ“… ${cnt} ׳₪׳¢׳™׳׳•׳™׳•׳×${cntDone?` ֲ· ג”ן¸ ${cntDone}`:''}`:''}</span>
        <div class="flex-c gap-2 flex-none" onclick="event.stopPropagation()">
          <button class="btn bp bsm text-xs" onclick="psupNewInvoice(${idx})">נ“„ ׳”׳–׳׳ ׳”</button>
          <button class="btn bo bsm text-xs" onclick="psupEdit(${idx})">גן¸</button>
        </div>
      </div>
    </div>`;
  }).join('');
  el.innerHTML=`<div class="sugrid">${_cardsHtml}${cappedMsg}</div>`;
}

function openNewPurchSupplier(){
  // Set text to __new__ to show inline form within invoice modal
  const txt = document.getElementById('inv-sup-text');
  if(txt){ txt.value='__new__'; invSupTextChg(); }
}
function openSupCardFromPurch(name){
  switchMode('act');
  setTimeout(()=>{ST('sup');setTimeout(()=>{openSupCard(name);setTimeout(sucToggleEdit,150);},100);},120);
}





function _applyYearData(o){
  if(!o || !o.ch){
    window.SCH = SRAWS.map(s=>({...s,st:'ok',nt:s.n||'',grp:1}));
  } else if(o.useSraws === false) {
    // ג•ג•ג• DIRECT MODE: Excel import was used ג€” SRAWS is irrelevant ג•ג•ג•
    // The ch array IS the complete schedule. No merging needed.
    console.log('[_applyYearData] Direct mode (useSraws=false): using ' + o.ch.length + ' records directly');
    window.useSraws = false;
    window.SCH = o.ch.map(x => ({
      id: x.id,
      g: x.g,
      d: x.d,
      a: x.a || '',
      t: x.t || '',
      p: x.p || '',
      n: x.n || '',
      st: x.st || 'ok',
      cr: x.cr || '',
      cn: x.cn || '',
      nt: x.nt || '',
      pd: x.pd || '',
      pt: x.pt || '',
      grp: x.grp || 1,
      act: x.act || '',
      tp: x.tp || '',
      _isMakeup: x._isMakeup || false,
      _makeupFrom: x._makeupFrom || '',
      _compByMakeup: x._compByMakeup || '',
      _fromD: x._fromD || '',
      _postFrom: x._postFrom || '',
      _isImported: x._isImported || false
    }));
  } else {
    // ג•ג•ג• LEGACY MODE: Merge SRAWS with cloud changes ג•ג•ג•
    // 1. Map SRAWS by fuzzy key and ID for merging
    const srawsFuzzy = {};
    const srawsFuzzyById = {};
    const nuclearClean = (val) => {
      if(!val) return '';
      return String(val).replace(/\(.*\)/g, '').replace(/[^׳-׳×a-zA-Z0-9]/g, '').toLowerCase();
    };
    const nuclearTime = (t) => {
      if(!t) return '00:00';
      let m = String(t).match(/(\d{1,2}):(\d{1,2})/);
      if(!m) return '00:00';
      return m[1].padStart(2,'0') + ':' + m[2].padStart(2,'0');
    };
    
    SRAWS.forEach(s => {
      const k = `${s.d}|${Number(s.g)}|${nuclearClean(s.a)}|${nuclearTime(s.t)}`;
      srawsFuzzy[k] = s;
      srawsFuzzyById[s.id] = s;
    });

    // 2. Process changes from cloud/backup
    const m = {}; // SRAWS ID -> Final Object
    const manual = []; // Non-SRAWS manual/imported records
    const coveredDateGardens = new Set();
    
    o.ch.forEach(x => {
      if(!x.d || !x.g) return;
      
      coveredDateGardens.add(`${x.d}|${Number(x.g)}`);
      
      const isManualId = String(x.id).startsWith('e_');
      const k = `${x.d}|${Number(x.g)}|${nuclearClean(x.a)}|${nuclearTime(x.t)}`;
      
      if (srawsFuzzy[k]) {
        const s = srawsFuzzy[k];
        m[s.id] = {...s, ...(m[s.id]||{}), ...x, id: s.id};
      } else if (!isManualId && srawsFuzzyById[x.id]) {
        m[x.id] = {...srawsFuzzyById[x.id], ...(m[x.id]||{}), ...x};
      } else {
        manual.push(x);
      }
    });

    // 3. Assemble SCH: SRAWS (merged) + remaining Manual
    const delIds = (o.supEx && o.supEx['__deleted_sraws_ids']) || [];
    window.SCH = SRAWS.map(s => {
      if (delIds.includes(s.id)) return null;
      const x = m[s.id];
      if (x) return {...s, ...x};
      
      // If this Date+Garden is already covered by the incoming data, 
      // and this SRAWS record didn't match anything above, it's a "Zombie" ג€” skip it.
      if (coveredDateGardens.has(`${s.d}|${Number(s.g)}`)) {
        return null;
      }
      return s;
    }).filter(Boolean);
    
    // Merge manual records (deduplicated by fuzzy key)
    const manualSeen = {};
    manual.forEach(x => {
      const k = `${x.d}|${Number(x.g)}|${nuclearClean(x.a)}|${nuclearTime(x.t)}`;
      if(!manualSeen[k]) {
        manualSeen[k] = x;
        window.SCH.push(x);
      } else {
        if(x.st !== 'ok') manualSeen[k].st = x.st;
        if(x.nt) manualSeen[k].nt = (manualSeen[k].nt ? manualSeen[k].nt + ' | ' + x.nt : x.nt);
      }
    });
  }

  if(window.DataManager) {
    if(window.DataManager.cleanupDuplicates) window.DataManager.cleanupDuplicates();
    if(window.DataManager.applyAutoMakeupMatching) window.DataManager.applyAutoMakeupMatching();
  }

  // ג”€ג”€ג”€ FINAL DEDUPLICATION: Ensure no duplicate IDs or (garden|supplier|date|time) keys ג”€ג”€ג”€
  try {
    const seenIds = new Set();
    const seenKeys = new Set();
    const dedupSCH = [];
    
    (window.SCH || []).forEach(s => {
      if (!s || !s.id) return;
      
      // Skip if this ID was already added
      if (seenIds.has(s.id)) return;
      
      // Skip if this (garden|supplier|date|time) combination was already added
      const fuzzyKey = `${s.g}|${s.a}|${s.d}|${s.t}`;
      if (seenKeys.has(fuzzyKey)) return;
      
      seenIds.add(s.id);
      seenKeys.add(fuzzyKey);
      dedupSCH.push(s);
    });
    
    if (dedupSCH.length < (window.SCH || []).length) {
      console.log(`[_applyYearData] Removed ${(window.SCH || []).length - dedupSCH.length} duplicate schedules`);
      window.SCH = dedupSCH;
    }
  } catch(e) { console.warn('Final deduplication failed:', e); }

  // REST OF THE FUNCTION (Pairs, Invoices, etc.)
  window.supEx = o.supEx || {};
  if(window.supEx['__gardens_extra']) window._GARDENS_EXTRA = window.supEx['__gardens_extra'];
  // For new years: load the full garden list from the year's data
  if(Array.isArray(window.supEx['__gardens_all']) && window.supEx['__gardens_all'].length > 0) {
    window._GARDENS_ALL = window.supEx['__gardens_all'];
  } else {
    window._GARDENS_ALL = null; // Fall back to GARDENS + _GARDENS_EXTRA
  }
  window.spScannerAliases = o.spScannerAliases || {};
  window.spScannerFolderLinks = o.spScannerFolderLinks || window.spScannerFolderLinks || {};

  if(Array.isArray(o.pairs)&&o.pairs.length>0){
    window.pairs = o.pairs.map(p=>({...p,ids:p.ids.map(id=>parseInt(id)).filter(id=>G(id).id)}));
    window.pairs = pairs.filter(p=>p.ids.length>=2);
  } else { initPairs(); }
  const localVat = window._safeLS.getItem('ganv5_vat');
  if (localVat) try { window.VAT_RATE = JSON.parse(localVat); } catch(e){}
  else window.VAT_RATE = o.vatRate || 18;

  let loadedInvs = null;
  if (Array.isArray(o.invoices) && o.invoices.length > 0) {
    loadedInvs = o.invoices; // Cloud/merged data ג€” set by loadFromFirebase()
  } else {
    const localInvs = window._safeLS.getItem('ganv5_invoices');
    if (localInvs) try { loadedInvs = JSON.parse(localInvs); } catch(e){}
  }

  if (loadedInvs) {
    window.INVOICES = Array.isArray(loadedInvs) ? loadedInvs : Object.values(loadedInvs);
    
    // Deduplicate identical invoices created by accident
    const uniqueInvs = [];
    const invMap = new Map();
    window.INVOICES.forEach(inv => {
      // Create a unique key based on supplier name and whatever number is present
      const numKey = inv.num || inv.txNum || inv.orderNum || '';
      if (!numKey) {
        uniqueInvs.push(inv); // Keep invoices without any numbers
        return;
      }
      const key = `${window.supBase ? window.supBase(inv.supName) : inv.supName}_${numKey}`;
      
      if (!invMap.has(key)) {
        invMap.set(key, inv);
      } else {
        // We have a duplicate. Keep the one that has more file links or details!
        const existing = invMap.get(key);
        const existingScore = (existing.file_tax ? 1 : 0) + (existing.file_tx ? 1 : 0) + (existing.file_order ? 1 : 0);
        const newScore = (inv.file_tax ? 1 : 0) + (inv.file_tx ? 1 : 0) + (inv.file_order ? 1 : 0);
        
        if (newScore > existingScore) {
          invMap.set(key, inv); // replace with the better one
        } else if (newScore === existingScore) {
           // Merge file links if they have different ones
           if (!existing.file_tax && inv.file_tax) existing.file_tax = inv.file_tax;
           if (!existing.file_tx && inv.file_tx) existing.file_tx = inv.file_tx;
           if (!existing.file_order && inv.file_order) existing.file_order = inv.file_order;
        }
      }
    });
    window.INVOICES = Array.from(invMap.values()).concat(uniqueInvs);

    // Auto-cancel invoices if "׳‘׳•׳˜׳" is in the notes, date, or orderDesc
    window.INVOICES.forEach(inv => {
      if (inv.status !== 'cancelled') {
        const notesStr = String(inv.notes || '').toLowerCase();
        const dateStr = String(inv.date || '').toLowerCase();
        const descStr = String(inv.orderDesc || '').toLowerCase();
        if (['׳‘׳•׳˜׳', '׳׳‘׳•׳˜׳'].some(w => notesStr.includes(w) || dateStr.includes(w) || descStr.includes(w))) {
          inv.status = 'cancelled';
        }
      }
    });

    // ג”€ג”€ Migrate invoices with double-VAT bug ג”€ג”€
    // Symptom: ordVatMode missing AND orderTotal ג‰ˆ orderAmt * (1 + vat/100)
    // Fix: set ordVatMode='inc', recalculate orderAmt (base) and orderTotal (= entered).
    INVOICES.forEach(inv=>{
      if(inv.ordVatMode) return; // already has mode ג€” skip
      const vat = inv.vat||18;
      if(vat===0) return; // exempt ג€” skip
      // Check order section
      if(inv.orderAmt && inv.orderTotal){
        const expectedTotal = +(inv.orderAmt*(1+vat/100)).toFixed(2);
        if(Math.abs(inv.orderTotal - expectedTotal) < 0.05){
          // orderAmt was entered as inclusive amount, orderTotal is wrong
          const rawInc = inv.orderAmt; // what user entered (includes VAT)
          inv.orderAmt   = +(rawInc/(1+vat/100)).toFixed(2);
          inv.orderVat   = +(inv.orderAmt*vat/100).toFixed(2);
          inv.orderTotal = rawInc; // the correct total IS what user entered
          inv.ordVatMode = 'inc';
        } else {
          inv.ordVatMode = 'ex'; // amounts look correct, just stamp the mode
        }
      }
      // Same for tx section
      if(inv.txAmt && inv.txTotal && !inv.txVatMode){
        const expTx = +(inv.txAmt*(1+vat/100)).toFixed(2);
        if(Math.abs(inv.txTotal - expTx) < 0.05){
          const rawTx = inv.txAmt;
          inv.txAmt   = +(rawTx/(1+vat/100)).toFixed(2);
          inv.txVat   = +(inv.txAmt*vat/100).toFixed(2);
          inv.txTotal = rawTx;
          inv.txVatMode = 'inc';
        } else {
          inv.txVatMode = 'ex';
        }
      }
      // Same for tax/receipt section
      if(inv.amt && inv.total && !inv.invVatMode){
        const expAmt = +(inv.amt*(1+vat/100)).toFixed(2);
        if(Math.abs(inv.total - expAmt) < 0.05){
          const rawAmt = inv.amt;
          inv.amt      = +(rawAmt/(1+vat/100)).toFixed(2);
          inv.vatAmt   = +(inv.amt*vat/100).toFixed(2);
          inv.total    = rawAmt;
          inv.invVatMode = 'inc';
        } else {
          inv.invVatMode = 'ex';
        }
      }
    });
  }
  if(typeof o.vatRate==='number') VAT_RATE=o.vatRate;
  // Sync settings from Firebase to localStorage
  if(o.autoBackupCfg){ _safeLS.setItem('autoBackupCfg',JSON.stringify(o.autoBackupCfg)); if(window._fbAppData) window._fbAppData.autoBackupCfg=o.autoBackupCfg; }
  if(o.piStatusFilter){ try{ _safeLS.setItem(PI_ST_KEY,JSON.stringify(o.piStatusFilter)); }catch(e){} }
  window.clusters = o.clusters&&Object.keys(o.clusters).length?o.clusters:JSON.parse(JSON.stringify(INIT_CLUSTERS));
  window.holidays = o.holidays||[];
  // _GARDENS_EXTRA already populated above
  window.pairBreaks = o.pairBreaks||{};
  window.blockedDates = o.blockedDates||{};
  window.gardenBlocks = o.gardenBlocks||{};
  window.managers = o.managers||{};
  activeGardens = Array.isArray(o.activeGardens)?new Set(o.activeGardens):null;
  if(window.DataManager && window.DataManager.cleanupDuplicates) {
    window.DataManager.cleanupDuplicates();
  }
}

function load(){
  try{
    // If Firebase already applied data directly, skip re-loading
    if(window._fbAppData) {
      return; // data already in memory from Firebase
    }
    // Support migration from old Y1 system (ganv5_y_ keys)
    let st = null;
    const yearKey = 'ganv5_y_' + (window.CURRENT_YEAR || 'tashpav');
    st = _safeLS.getItem(yearKey);
    if(!st && (!window.CURRENT_YEAR || window.CURRENT_YEAR === 'tashpav')) {
      st = _safeLS.getItem('ganv5');
    }
    if(!st && window._fbAppData) { _applyYearData(window._fbAppData); return; }
    if(st){ _applyYearData(JSON.parse(st)); }
    else { initPairs();window.clusters = JSON.parse(JSON.stringify(INIT_CLUSTERS));activeGardens = null; }
  }catch(e){
    console.warn('load() error:', e);
    if(window._fbAppData){ try{ _applyYearData(window._fbAppData); }catch(e2){} }
    else { initPairs();window.clusters = JSON.parse(JSON.stringify(INIT_CLUSTERS));activeGardens = null; }
  }
}
// ג”€ג”€ migratePairsFromAuto ג€” seeds AUTOPAIRS only on first-ever load ג”€ג”€

function migrateGardenPhones(){
  // Force-import all phones from xlsx ג€” overwrite existing unless user manually edited
  // Versioned: if GARDEN_PHONES_VER already applied, skip
  const VER='v2';
  if(supEx.__phonesVer===VER) return;
  let count=0;
  Object.entries(GARDEN_PHONES).forEach(([id,ph])=>{
    const gid=parseInt(id);
    const key='g_'+gid;
    if(!supEx[key]) supEx[key]={};
    const ex=supEx[key];
    if(ex._cophManual) return; // user manually edited ג€” preserve
    if(ph.ph1){ ex.coph=ph.ph1; count++; }
    if(ph.ph2) ex.coph2=ph.ph2;
  });
  supEx.__phonesVer=VER;
  save();
  console.log('migrateGardenPhones: imported '+count+' phones ('+VER+')');
}

function migratePairsFromAuto(){
  // Only run if localStorage has NO saved pairs yet (brand new user)
  const st=_safeLS.getItem('ganv5');
  if(st){
    try{
      const o=JSON.parse(st);
      if(Array.isArray(o.pairs)&&o.pairs.length>0) return; // already has saved pairs, don't override
    }catch(e){}
  }
  // No saved pairs ג€” seed from AUTOPAIRS
  initPairs();
  save();
  console.log('Seeded pairs from AUTOPAIRS: '+pairs.length);
}
async function resetPairsFromAuto(){
  if(!await window.spConfirm('׳”׳׳ ׳׳¨׳¢׳ ׳ ׳׳× ׳”׳–׳•׳’׳•׳× ׳׳”׳¨׳©׳™׳׳” ׳”׳׳•׳‘׳ ׳™׳×?\n׳–׳” ׳™׳׳—׳§ ׳¢׳¨׳™׳›׳•׳× ׳™׳“׳ ׳™׳•׳× ׳©׳‘׳™׳¦׳¢׳×.')) return;
  initPairs();
  save();
  refresh();
  window.spAlert('ג… ׳”׳–׳•׳’׳•׳× ׳¢׳•׳“׳›׳ ׳•! '+pairs.length+' ׳–׳•׳’׳•׳× ׳ ׳˜׳¢׳ ׳•.');
}
const HOLIDAYS_RESTORE = [{"canSched":false,"city":"","from":"2026-03-31","id":"h_1774174272522","name":"׳—׳•׳₪׳©׳× ׳₪׳¡׳—","note":"","scope":"all","to":"2026-04-08","type":"vacation"},{"canSched":false,"city":"","from":"2026-04-22","id":"h_1775731003564","name":"׳™׳•׳ ׳”׳–׳›׳¨׳•׳ ׳׳—׳׳׳™ ׳׳¢׳¨׳›׳•׳× ׳™׳©׳¨׳׳","note":"","scope":"all","to":"2026-04-22","type":"vacation"},{"canSched":false,"city":"","from":"2026-04-23","id":"h_1775731019768","name":"׳™׳•׳ ׳”׳¢׳¦׳׳׳•׳×","note":"","scope":"all","to":"2026-04-23","type":"vacation"},{"canSched":false,"city":"","from":"2026-05-21","id":"h_1775731118232","name":"׳©׳‘׳•׳¢׳•׳×","note":"","scope":"all","to":"2026-05-21","type":"vacation"},{"canSched":false,"city":"׳’׳‘׳¢׳×׳™׳™׳","from":"2026-05-05","id":"h_1775731199678","name":"׳\"׳’ ׳‘׳¢׳•׳׳¨","note":"","scope":"׳‘׳™׳”\"׳¡","to":"2026-05-05","type":"vacation"},{"canSched":true,"city":"","from":"2026-05-05","id":"h_1775731246284","name":"׳§׳™׳™׳˜׳ ׳× ׳\"׳’ ׳‘׳¢׳•׳׳¨","note":"","scope":"all","to":"2026-05-05","type":"camp"},{"canSched":true,"city":"׳’׳‘׳¢׳×׳™׳™׳","from":"2026-05-05","id":"h_1775731264839","name":"׳§׳™׳™׳˜׳ ׳× ׳\"׳’ ׳‘׳¢׳•׳׳¨","note":"","scope":"׳’׳ ׳™׳","to":"2026-05-05","type":"camp"}];

function restoreMissingHolidays() {
  if (window.holidays && window.holidays.length === 0) {
    window.holidays = HOLIDAYS_RESTORE;
    return true;
  }
  return false;
}
function migrateSupActSplit(){
  // Run on every load ג€” SCHEDULES_JS source data has "supplier - activity" format
  let changed=0;
  SCH.forEach(s=>{
    const act=supAct(s.a);
    if(act){
      if(!s.act) s.act=act;
      s.a=supBase(s.a);
      changed++;
    }
  });
  if(changed>0){ 
    console.log('migrateSupAct: fixed '+changed); 
    if(window._fbSyncReady) {
      save(); 
    } else {
      console.warn('migrateSupAct: skip auto-save (Firebase not ready)');
    }
  }
}
async function save(immediate){
  if(false){ showToast('ג ן¸ ׳׳¦׳‘ ׳׳¨׳›׳™׳•׳ ג€” ׳׳ ׳ ׳™׳×׳ ׳׳©׳׳•׳¨ ׳©׳™׳ ׳•׳™׳™׳'); return; }
  
  // CRITICAL: Block all saves (including localStorage) until the first Firebase load completes.
  // This prevents startup migrations from creating a "newer" local state that blocks the cloud load.
  if(!window._fbSyncReady && !immediate) {
    console.warn('save: blocked (Firebase not ready yet)');
    return false;
  }
  
  window._isSaving = true;
  try{
    if (typeof window.cleanSupplierNamesBeforeSave === 'function') {
      window.cleanSupplierNamesBeforeSave();
    }
    // Auto-Makeup disabled by user request
    // if(window.DataManager && window.DataManager.applyAutoMakeupMatching) {
    //   window.DataManager.applyAutoMakeupMatching();
    // }
    // Save ALL entries with ALL fields ג€” works with or without SRAWS
    // Persist year-specific garden list into supEx before saving
    if (Array.isArray(window._GARDENS_ALL) && window._GARDENS_ALL.length > 0) {
      (window.supEx || {}).__gardens_all = window._GARDENS_ALL;
    }
    const data={
      ch:(window.SCH||[]).map(s=>({id:s.id,g:s.g,d:s.d,a:s.a,t:s.t,p:s.p,n:s.n,st:s.st,cr:s.cr,cn:s.cn,nt:s.nt,pd:s.pd,pt:s.pt,grp:s.grp,act:s.act||'',_isMakeup:s._isMakeup||false,_makeupFrom:s._makeupFrom||'',_compByMakeup:s._compByMakeup||'',_fromD:s._fromD||'',_postFrom:s._postFrom||''})),
      pairs:window.pairs||[],
      supEx:window.supEx||{},
      clusters:window.clusters||{},
      holidays:window.holidays||[],
      pairBreaks:window.pairBreaks||{},
      managers:window.managers||{},
      blockedDates:window.blockedDates||{},
      gardenBlocks:window.gardenBlocks||{},
      activeGardens:window.activeGardens?[...window.activeGardens]:null,
      useSraws: typeof window.useSraws!=='undefined'?window.useSraws:true,
      spScannerAliases: window.spScannerAliases || {},
      spScannerFolderLinks: window.spScannerFolderLinks || {}
    };
    const _json=JSON.stringify(data);
    const yearKey = 'ganv5_y_' + (window.CURRENT_YEAR || 'tashpav');
    _safeLS.setItem(yearKey, _json);
    
    // Save invoices globally
    _safeLS.setItem('ganv5_invoices', JSON.stringify(window.INVOICES||[]));
    _safeLS.setItem('ganv5_vat', JSON.stringify(window.VAT_RATE||18));
    
    if (!window.CURRENT_YEAR || window.CURRENT_YEAR === 'tashpav') {
      _safeLS.setItem('ganv5', _json);
    }
    window['_mem_' + yearKey] = _json;
    
    let res = true;
    if (typeof ghAutoSave === 'function') {
      try {
        // CRITICAL: await the Firebase sync if immediate=true
        res = await ghAutoSave(immediate === true);
      } catch(e) { console.error('Firebase save failed', e); res = false; }
    }
    
    save._cnt=(save._cnt||0)+1;
    if(save._cnt%30===0){
      try{
        const snaps=JSON.parse(_safeLS.getItem('ganv5_snaps')||'[]');
        const d=_json;
        snaps.unshift({ts:Date.now(),label:'׳׳•׳˜׳•׳׳˜׳™',size:d.length,data:d});
        if(snaps.length>5) snaps.length=5;
        _safeLS.setItem('ganv5_snaps',JSON.stringify(snaps));
      }catch(e2){}
    }
    return res;
  }catch(e){ console.error('Save fatal error', e); return false; }
  finally { window._isSaving = false; }
}
function initPairs(){
  // Initialize pairs from AUTOPAIRS constant
  const gdns = window.GARDENS || [];
  if(!gdns.length) return;

  window.pairs = AUTOPAIRS.map((arr,i)=>{
    const ids = arr.map(id => Number(id));
    const gs = ids.map(id => window.G(id)).filter(x => x && x.id);
    return {
      id: i + 1, 
      ids: ids, 
      name: gs.length > 0 ? gs.map(g => g.name).join(' + ') : '׳–׳•׳’ ׳׳׳ ׳©׳'
    };
  }).filter(p => p.ids.length > 0);
}

// ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•
// Y1 ג€” Year Management Functions
// ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•ג•


function G(id){
  const gdns = window.GARDENS || [];
  const extra = window._GARDENS_EXTRA || [];
  return gdns.find(g=>Number(g.id)===Number(id)) || extra.find(g=>Number(g.id)===Number(id)) || {};
}
function gcls(g){
  if (!g || !g.cls) return '׳’׳ ׳™׳';
  const c = g.cls.trim();
  // Support both standard quotes (") and Hebrew Gershayim (׳´)
  const isSchool = c.includes('׳‘׳™׳×') || c.includes('׳‘׳™"׳¡') || c.includes('׳‘׳™׳´׳¡') || 
                   c.includes('׳‘׳™׳”"׳¡') || c.includes('׳‘׳™׳”׳´׳¡') || c.includes('׳‘׳™׳”׳¡') || 
                   c.includes('׳¡׳₪׳¨');
  
  if (c.includes('׳’׳')) return '׳’׳ ׳™׳';
  if (isSchool) return '׳‘׳™׳”"׳¡';
  return '׳’׳ ׳™׳';
}
function gByCF(city,cls){return GARDENS.filter(g=>(!city||g.city===city)&&(!cls||gcls(g)===cls));}
function d2s(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');return`${y}-${m}-${dd}`}
function s2d(s){const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function fD(s){if(!s)return '';if(typeof s !== 'string')return s;if(s.includes('/') && !s.includes('-'))return s;const parts=s.split('-');if(parts.length===3){const[y,m,d]=parts;return`${d}/${m}/${y}`}return s}
function fT(t){return t?t.slice(0,5):''}
function addD(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function addM(d,n){const x=new Date(d);x.setMonth(x.getMonth()+n);return x}
function monStart(d){const x=new Date(d);x.setDate(x.getDate()-x.getDay());x.setHours(0,0,0,0);return x}
function dayN(s){const[y,m,d]=s.split('-').map(Number);return['׳¨׳׳©׳•׳','׳©׳ ׳™','׳©׳׳™׳©׳™','׳¨׳‘׳™׳¢׳™','׳—׳׳™׳©׳™','׳©׳™׳©׳™','׳©׳‘׳×'][new Date(y,m-1,d).getDay()]}
function getNextWorkDays(start, count){
  let d = new Date(start);
  let days = [];
  while(days.length < count){
    const dow = d.getDay();
    if(dow !== 5 && dow !== 6) days.push(new Date(d));
    d = addD(d, 1);
  }
  return days;
}
window.getNextWorkDays = getNextWorkDays;


// ג”€ג”€ Hebrew Date (via built-in Intl API) ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
const _hebFmt = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
  day: 'numeric', month: 'long', timeZone: 'UTC'
});
function toHebDate(ds) {
  try {
    const [y, m, d] = ds.split('-').map(Number);
    return _hebFmt.format(new Date(Date.UTC(y, m-1, d)));
  } catch(e) { return ''; }
}

function hebM(d){return['׳™׳ ׳•׳׳¨','׳₪׳‘׳¨׳•׳׳¨','׳׳¨׳¥','׳׳₪׳¨׳™׳','׳׳׳™','׳™׳•׳ ׳™','׳™׳•׳׳™','׳׳•׳’׳•׳¡׳˜','׳¡׳₪׳˜׳׳‘׳¨','׳׳•׳§׳˜׳•׳‘׳¨','׳ ׳•׳‘׳׳‘׳¨','׳“׳¦׳׳‘׳¨'][d.getMonth()]+' '+d.getFullYear()}
function td(){return d2s(new Date())}
function cities(){return[...new Set(GARDENS.map(g=>g.city))].sort()}
function gardenPair(gid){const n=parseInt(gid);return pairs.find(p=>p.ids.map(x=>parseInt(x)).includes(n))||null}
window.getGardenGroup = function(gid) {
  const n = parseInt(gid);
  const pair = (window.pairs || []).find(p => p.ids.map(x => parseInt(x)).includes(n));
  if (pair) return { type: 'pair', ...pair };
  const clusters = window.clusters || {};
  for (const cid in clusters) {
    const cl = clusters[cid];
    if ((cl.gardenIds || []).map(x => parseInt(x)).includes(n)) {
      return { type: 'cluster', id: cid, ids: cl.gardenIds.map(x => parseInt(x)), name: cl.name };
    }
  }
  return null;
};
window.compareActivities = function(a, b) {
  // Normalize time: extract HH:mm and pad
  const getT = (t) => {
    if (!t) return '99:99';
    const parts = t.split(':');
    if (parts.length < 2) return t.padStart(5, '0');
    return parts[0].padStart(2, '0') + ':' + parts[1].padStart(2, '0');
  };
  const tA = getT(a.t);
  const tB = getT(b.t);
  if (tA !== tB) return tA.localeCompare(tB);
  
  const gA = window.G(a.g)?.name || '';
  const gB = window.G(b.g)?.name || '';
  return gA.localeCompare(gB, 'he');
};

function stLabel(s){
  if(s.st==='can') return'<span class="bdg br2">ג ׳‘׳•׳˜׳</span>';
  if(s.st==='done') return'<span class="bdg bg2">ג”ן¸ ׳”׳×׳§׳™׳™׳</span>';
  if(s.st==='post') {
    let isAdv = false;
    if (s.pd && s.d) {
      const parseDate = (str) => {
        if (!str) return null;
        const parts = str.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          }
          return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        }
        return new Date(str);
      };
      const pdObj = parseDate(s.pd);
      const dObj = parseDate(s.d);
      if (pdObj && dObj) {
        isAdv = pdObj < dObj;
      }
    }
    return `<span class="bdg bor">${isAdv ? 'ג× ׳”׳•׳§׳“׳' : 'ג© ׳ ׳“׳—׳”'} ${s.pd?'׳-'+fD(s.pd):''}</span>`;
  }
  if(s.st==='nohap') return'<span class="bdg br2">ג ן¸ ׳׳ ׳”׳×׳§׳™׳™׳</span>';
  return'<span class="bdg bg2">נ« ׳׳×׳§׳™׳™׳</span>';
}

// ג”€ג”€ renderReadOnlyBanner (stub ג€” no archive mode in this version) ג”€ג”€
function renderReadOnlyBanner() {
  const el = document.getElementById('readonly-banner');
  if (el) el.style.display = 'none';
}

function stClass(s){
  if(s.st==='can') return'st-can-row';
  if(s.st==='post') return'st-post-row';
  if(s.st==='nohap') return'st-nohap-row';
  if(s.st==='done') return'st-done-row';
  return'';
}


// ג”€ג”€ Dynamic scroll containers ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
function _fitScrollAreas(){
  const BOTTOM_PAD = 16; // px from bottom of viewport
  document.querySelectorAll('.scroll-area').forEach(el=>{
    // Only adjust visible elements
    if(!el.offsetParent) return;
    const top = el.getBoundingClientRect().top;
    const available = window.innerHeight - top - BOTTOM_PAD;
    if(available > 100){
      el.style.maxHeight = available + 'px';
    }
  });
}

// Run on load, resize, and tab switch
window.addEventListener('resize', _fitScrollAreas);

// ג”€ג”€ Sync supplier __c list from all data sources ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
// Runs after every Firebase load to ensure supplier list is complete
function syncSupplierList(){
  if(!supEx) window.supEx = {};
  if(!supEx['__c']) supEx['__c']=[];
  const existing = new Set(supEx['__c'].map(s=>supBase(s.name)));
  const inSupbase = new Set(SUPBASE.map(s=>supBase(s.name)));
  let added=0;

  // Add suppliers from SCH
  SCH.forEach(s=>{
    const base=supBase(s.a||'');
    if(!base||inSupbase.has(base)||existing.has(base)) return;
    supEx['__c'].push({id:Date.now()+Math.random(),name:base,phone:supEx[base]?.ph1||''});
    if(!supEx[base]) supEx[base]={isPurch:true,isAct:true};
    existing.add(base); added++;
  });

  // Add suppliers from INVOICES (purch-only by default)
  INVOICES.forEach(inv=>{
    const base=supBase(inv.supName||'');
    if(!base||inSupbase.has(base)||existing.has(base)) return;
    supEx['__c'].push({id:Date.now()+Math.random(),name:base,phone:supEx[base]?.ph1||''});
    if(!supEx[base]) supEx[base]={isPurch:true,isAct:false};
    existing.add(base); added++;
  });

  // Remove duplicate __c entries
  const seen=new Set();
  supEx['__c']=supEx['__c'].filter(s=>{
    const b=supBase(s.name);
    if(seen.has(b)) return false;
    seen.add(b); return true;
  });

  if(added>0){ console.log(`syncSupplierList: added ${added} suppliers`); }
  return added;
}

// ג”€ג”€ One-time migration v2: restore acts for merged suppliers ג”€ג”€ג”€ג”€
function restoreSupplierActs(){
  if(supEx.__actsRestored_v2) return;
  let fixed=0;
  
  // Build act map from SCH and SUPBASE (by base name)
  const baseActMap = {};
  const addAct = (base,act) => { if(!baseActMap[base]) baseActMap[base]=new Set(); if(act) baseActMap[base].add(act); };
  SCH.forEach(s=>{ if(s.a){ addAct(supBase(s.a),supAct(s.a)); }});
  SUPBASE.forEach(s=>{ addAct(supBase(s.name),supAct(s.name)); });

  // Also get acts from mergedAway items' original bases
  // Map: each supEx entry that has no acts but HAS SCH entries (without act suffix)
  Object.keys(supEx).forEach(key=>{
    if(key.startsWith('__')) return;
    const ex = supEx[key];
    if(Array.isArray(ex.acts) && ex.acts.length>0) return; // already has acts
    // Check SCH for this key
    const hasSCH = SCH.some(s=>supBase(s.a)===key || s.a===key);
    if(!hasSCH) return;
    // Look for acts in mergedAway that share partial name or _mergedFrom
    const mergedFrom = ex._mergedFrom||[];
    const actsForKey = new Set(baseActMap[key]||[]);
    mergedFrom.forEach(oldBase=>{ (baseActMap[oldBase]||new Set()).forEach(a=>actsForKey.add(a)); });
    // Heuristic: SUPBASE entries where base is substring of key or key is substring of base
    SUPBASE.forEach(s=>{
      const sb=supBase(s.name); const sa=supAct(s.name);
      if(!sa) return;
      if(sb===key||key.includes(sb)||sb.includes(key)||(key.split(' ')[0]===sb.split(' ')[0]&&key.split(' ').length>=2)){
        actsForKey.add(sa);
      }
    });
    if(actsForKey.size>0){
      supEx[key].acts = [...actsForKey].sort((a,b)=>a.localeCompare(b,'he'));
      supEx[key].isAct = true;
      fixed++;
    }
  });

  supEx.__actsRestored_v2 = true;
  if(fixed>0){ save(true); showToast('ג… ׳©׳•׳—׳–׳¨׳• ׳₪׳¢׳™׳׳•׳™׳•׳× ׳-'+fixed+' ׳¡׳₪׳§׳™׳'); }
  console.log('restoreSupplierActs v2: fixed',fixed,'suppliers');
}
