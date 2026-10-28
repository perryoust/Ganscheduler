// ── LEGACY ONE-TIME IMPORT (ARCHIVED FROM invoices_import.js) ──────────────────
// Archived in v113.76 optimization.
// This was a one-time migration script used in 2022 to import 1,783 historical invoices into Firebase RTDB.
// The raw 872KB data array and full execution history are preserved in Git commit v113.75.
// Neither _IMPORT_DATA nor _runOneTimeImport() are called anywhere in active Ganscheduler code.

async function _runOneTimeImport(){
  if(!await window.spConfirm('ייבא מסמכים חד-פעמי?')) return;
  const btn = document.getElementById('one-time-import-btn');
  if(btn){ btn.disabled=true; btn.textContent='⏳ מייבא...'; }
  window._importInProgress = true;

  const dupKeys = new Set();
  INVOICES.forEach(i=>{
    const sup = String(i.supName||'').trim().toLowerCase();
    if(sup && i.txNum) dupKeys.add(sup+'|tx|'+String(i.txNum||'').trim().toLowerCase());
    if(sup && i.num)   dupKeys.add(sup+'|tax|'+String(i.num||'').trim().toLowerCase());
  });
  const existingSupNames = new Set(getAllSup().map(s=>s.name.toLowerCase().trim()));

  let added=0, skipped=0, suppAdded=0;
  const localInvoices = [];
  const localSups = [];

  const DB_BASE = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';
  const token = window._cachedToken;
  if(!token){ showToast('❌ לא מחובר'); window._importInProgress=false; if(btn){btn.disabled=false;btn.textContent='⚡ ייבוא חד-פעמי';} return; }

  // Convert existing array to object in Firebase first (one-time migration)
  const existingArr = INVOICES;
  if(existingArr.length > 0){
    const existingObj = {};
    existingArr.forEach(i=>{ existingObj[i.id] = i; });
    const r0 = await fetch(`${DB_BASE}/data/invoices.json?auth=${token}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(existingObj)
    });
    if(!r0.ok){ showToast('❌ שגיאה במיגרציה: ' + r0.status); window._importInProgress=false; if(btn){btn.disabled=false;btn.textContent='⚡ ייבוא חד-פעמי';} return; }
    if(btn) btn.textContent = '⏳ ממיר... 0/' + _IMPORT_DATA.length;
  }

  // Now PATCH new invoices in batches of 50
  const toWrite = {};
  for(const inv of (typeof _IMPORT_DATA !== 'undefined' ? _IMPORT_DATA : [])){
    const sup = String(inv.supName||'').trim().toLowerCase();
    const txKey  = sup && inv.txNum ? sup+'|tx|' +String(inv.txNum||'').trim().toLowerCase() : null;
    const taxKey = sup && inv.num   ? sup+'|tax|'+String(inv.num||'').trim().toLowerCase()   : null;
    if((txKey && dupKeys.has(txKey)) || (taxKey && dupKeys.has(taxKey))){ skipped++; continue; }
    if(txKey)  dupKeys.add(txKey);
    if(taxKey) dupKeys.add(taxKey);

    const id = Date.now() + added + Math.floor(Math.random()*9999);
    const entry = {...inv, id, recv: new Date().toISOString().slice(0,10)};
    toWrite[id] = entry;
    localInvoices.push(entry);
    added++;

    const supKey = (inv.supName||'').toLowerCase().trim();
    if(supKey && !existingSupNames.has(supKey)){
      existingSupNames.add(supKey);
      const supId = 9000000 + suppAdded;
      const ns = {id:supId, name:inv.supName, isPurch:true, isAct:false, phone1:'', phone2:'', email:'', entityType:'', notes:''};
      localSups.push(ns);
      suppAdded++;
    }
  }

  // Write new invoices in batches of 50
  const ids = Object.keys(toWrite);
  const BATCH = 50;
  let ok = true;
  for(let i=0; i<ids.length; i+=BATCH){
    const chunk = {};
    ids.slice(i, i+BATCH).forEach(id=>{ chunk[id] = toWrite[id]; });
    try{
      const r = await fetch(`${DB_BASE}/data/invoices.json?auth=${token}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(chunk)
      });
      if(!r.ok){ showToast('❌ שגיאה ' + r.status); ok=false; break; }
    } catch(e){ showToast('❌ ' + e.message); ok=false; break; }
    if(btn) btn.textContent = '⏳ ' + Math.min(i+BATCH, ids.length) + '/' + ids.length;
    await new Promise(res=>setTimeout(res,80));
  }

  // Write new suppliers
  if(ok && localSups.length){
    const supObj = {};
    localSups.forEach(s=>{ supObj[s.id]=s; });
    await fetch(`${DB_BASE}/data/suppliers.json?auth=${token}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(supObj)
    });
  }

  window._importInProgress = false;
  if(ok){
    INVOICES.push(...localInvoices);
    localSups.forEach(s=>{ SUPBASE.push(s); supEx[s.name]=s; });
    if(btn) btn.remove();
    _safeLS.setItem('_oneTimeImportDone','1');
    // Save flag to Firebase so it persists across devices/browsers
    fetch(`${DB_BASE}/data/importDone.json?auth=${token}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({done:true, ts: new Date().toISOString()})
    });
    renderInvoices(); refreshPurchDash();
    showToast('✅ יובאו ' + added + ' | דולגו ' + skipped + ' | ספקים חדשים ' + suppAdded);
  } else {
    window._importInProgress = false;
    if(btn){ btn.disabled=false; btn.textContent='⚡ ייבוא חד-פעמי'; }
  }
}
