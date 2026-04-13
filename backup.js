function getSnapshots(){try{return JSON.parse(window._safeLS.getItem('ganv5_snaps')||'[]');}catch{return [];}}
function saveSnapshots(snaps){try{window._safeLS.setItem('ganv5_snaps',JSON.stringify(snaps));}catch(e){}}
function createSnapshot(label){
  const snaps=getSnapshots();
  const data=window._safeLS.getItem('ganv5')||'{}';
  snaps.unshift({ts:Date.now(),label:label||'ידני',size:data.length,data});
  if(snaps.length>MAX_SNAPSHOTS) snaps.length=MAX_SNAPSHOTS;
  saveSnapshots(snaps);
  const quiet=label==='שעתי'||label==='סגירה';
  if(!quiet) window.showCopyToast('✅ גרסה נשמרה: '+new Date().toLocaleTimeString('he-IL'));
  if(document.getElementById('backup-list')&&document.getElementById('backup-list').innerHTML) renderBackupList();
}
function openBackup(){renderBackupList();document.getElementById('backupm').classList.add('open');}
function renderBackupList(){
  const snaps=getSnapshots();
  const el=document.getElementById('backup-list');if(!el)return;
  const stored=window._safeLS.getItem('ganv5')||'';
  (document.getElementById('backup-storage-info')||{}).textContent =
    'נתונים: '+(stored.length/1024).toFixed(1)+'KB | גרסאות: '+snaps.length+'/'+MAX_SNAPSHOTS;
  if(!snaps.length){el.innerHTML='<p style="color:#999">אין גרסאות שמורות עדיין</p>';return;}
  el.innerHTML='<div style="display:flex;flex-direction:column;gap:6px">'+
    snaps.map((s,i)=>`<div style="background:#f5f7ff;border-radius:7px;padding:8px 11px;display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-weight:700;font-size:.82rem">${s.label} <span style="font-size:.69rem;color:#78909c">${new Date(s.ts).toLocaleString('he-IL')}</span></div>
      <div style="font-size:.71rem;color:#546e7a">${(s.size/1024).toFixed(1)}KB</div></div>
      <div style="display:flex;gap:5px">
        <button class="btn bp bsm" onclick="restoreSnapshot(${i})">🔄 שחזר</button>
        <button class="btn br bsm" onclick="deleteSnapshot(${i})">🗑️</button>
      </div></div>`).join('')+'</div>';
}
function restoreSnapshot(i){
  const snaps=getSnapshots();const snap=snaps[i];if(!snap)return;
  if(!confirm('לשחזר לגרסה מ-'+new Date(snap.ts).toLocaleString('he-IL')+'?\nהנתונים הנוכחיים יישמרו אוטומטית לפני שחזור.')) return;
  createSnapshot('לפני שחזור');
  window._safeLS.setItem('ganv5',snap.data);
  window.showCopyToast('✅ שוחזר! טוען מחדש...');
  setTimeout(()=>location.reload(),1200);
}
function deleteSnapshot(i){const snaps=getSnapshots();snaps.splice(i,1);saveSnapshots(snaps);renderBackupList();}
function updateAppFromHTML(input){
  const file=input.files[0]; if(!file) return;
  if(!confirm('האפליקציה תתעדכן לגרסה החדשה. הנתונים הקיימים יישמרו. להמשיך?')) return;
  // Save current data first
  const currentData=window._safeLS.getItem('ganv5');
  const currentCfg=window._safeLS.getItem('autoBackupCfg');
  const r=new FileReader();
  r.onload=e=>{
    try{
      const newHTML=e.target.result;
      if(!newHTML.includes('ganv5')&&!newHTML.includes('מנהל גנים')) throw new Error('קובץ לא נראה כאפליקציה תקינה');
      // Write new HTML to a blob and navigate
      const blob=new Blob([newHTML],{type:'text/html'});
      const url=URL.createObjectURL(blob);
      // Store data to restore after load
      window._safeLS.setItem('_restore_data',currentData||'');
      window._safeLS.setItem('_restore_cfg',currentCfg||'');
      window._safeLS.setItem('_pending_restore','1');
      window.location.href=url;
    }catch(err){alert('שגיאה: '+err.message);}
  };
  r.readAsText(file,'utf-8');
}
// On load: restore data if flagged
(function(){
  if(window._safeLS.getItem('_pending_restore')==='1'){
    window._safeLS.removeItem('_pending_restore');
    const d=window._safeLS.getItem('_restore_data');
    const c=window._safeLS.getItem('_restore_cfg');
    window._safeLS.removeItem('_restore_data');
    window._safeLS.removeItem('_restore_cfg');
    if(d) window._safeLS.setItem('ganv5',d);
    if(c) window._safeLS.setItem('autoBackupCfg',c);
    setTimeout(()=>window.showToast('✅ האפליקציה עודכנה! הנתונים שוחזרו.'),1500);
  }
})();

function importBackup(input){
  const file=input.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(!data.ch&&!data.pairs) throw new Error('פורמט לא תקין');
      createSnapshot('לפני ייבוא');
      const sd={ch:data.ch||[],pairs:data.pairs||[],supEx:data.supEx||{},
        clusters:data.clusters||{},holidays:data.holidays||[],pairBreaks:data.pairBreaks||{},
        managers:data.managers||{},blockedDates:data.blockedDates||{},
        gardenBlocks:data.gardenBlocks||{},invoices:data.invoices||[]};
      const json=JSON.stringify(sd);
      window._safeLS.setItem('ganv5',json);
      // Init meta if missing, write to year key
      let meta=JSON.parse(window._safeLS.getItem('ganv5_meta')||'null');
      if(!meta){
        const yr={key:'תשפו'};
        meta={currentYear:yr.key,years:[yr.key]};
        window._safeLS.setItem('ganv5_meta',JSON.stringify(meta));
      }
      window._safeLS.setItem('ganv5_y_'+meta.currentYear,json);
      window.showCopyToast('✅ ייבוא הצליח! טוען מחדש...');
      setTimeout(()=>location.reload(),1400);
    }catch(err){alert('שגיאה בקובץ: '+err.message);}
  };
  r.readAsText(file);
}
setInterval(()=>createSnapshot('שעתי'),60*60*1000);
window.addEventListener('beforeunload',()=>{
  createSnapshot('סגירה');
  // Try to sync to Firebase before closing
  const raw = _safeLS.getItem('ganv5');
  if(raw && window._fbUser && window._cachedToken){
    const url = FIREBASE_DB_URL + '?auth=' + window._cachedToken;
    try{
      navigator.sendBeacon(url, new Blob([JSON.stringify({data:JSON.parse(raw),ts:Date.now(),version:'10.2'})],{type:'application/json'}));
    }catch(e){}
  }
});

// ── Auto-backup scheduler ──────────────────────────────
let _autoBackupTimer=null;
function loadAutoBackupSettings(){
  // Prefer Firebase data (already loaded into window._fbAppData)
  if(window._fbAppData && window._fbAppData.autoBackupCfg)
    return window._fbAppData.autoBackupCfg;
  return JSON.parse(_safeLS.getItem('autoBackupCfg')||'null');
}
function saveAutoBackupSettings(cfg){
  _safeLS.setItem('autoBackupCfg',JSON.stringify(cfg));
  // Also save to Firebase
  const tok = window._cachedToken;
  if(tok) fetch('https://ganmanage-default-rtdb.europe-west1.firebasedatabase.app/data/autoBackupCfg.json?auth='+tok,{
    method:'PUT', headers:{'Content-Type':'application/json'},
    body:JSON.stringify(cfg)
  }).catch(()=>{});
}
function startAutoBackup(){
  if(_autoBackupTimer) clearInterval(_autoBackupTimer);
  const cfg=loadAutoBackupSettings();
  if(!cfg||!cfg.enabled) return;
  const ms=cfg.freq==='daily'?24*60*60*1000:7*24*60*60*1000;
  _autoBackupTimer=setInterval(()=>{ triggerAutoBackup(); },ms);
  // Check if overdue
  if(cfg.lastBackup){
    const diff=Date.now()-new Date(cfg.lastBackup).getTime();
    if(diff>ms) triggerAutoBackup();
  }
}
function triggerAutoBackup(){
  const cfg=loadAutoBackupSettings()||{};
  exportFullBackup();
  cfg.lastBackup=new Date().toISOString();
  saveAutoBackupSettings(cfg);
  showToast('💾 גיבוי אוטומטי הורד');
}
function openAutoBackupSettings(){
  const cfg=loadAutoBackupSettings()||{enabled:false,freq:'daily',hour:'08:00'};
  document.getElementById('ab-enabled').checked=cfg.enabled||false;
  document.getElementById('ab-freq').value=cfg.freq||'daily';
  document.getElementById('ab-hour').value=cfg.hour||'08:00';
  (document.getElementById('ab-last')||{}).textContent =cfg.lastBackup?'גיבוי אחרון: '+new Date(cfg.lastBackup).toLocaleString('he-IL'):'לא בוצע גיבוי עדיין';
  document.getElementById('autobackup-m').classList.add('open');
}
function saveAutoBackupCfg(){
  const cfg={
    enabled:document.getElementById('ab-enabled').checked,
    freq:document.getElementById('ab-freq').value,
    hour:document.getElementById('ab-hour').value,
    lastBackup:(loadAutoBackupSettings()||{}).lastBackup||null
  };
  saveAutoBackupSettings(cfg);
  startAutoBackup();
  CM('autobackup-m');
  showToast(cfg.enabled?'✅ גיבוי אוטומטי הופעל':'⏸️ גיבוי אוטומטי כובה');
}
// Start on load
setTimeout(startAutoBackup,3000);

function openInfoModal(){
  const used=JSON.stringify(_safeLS.getItem('ganv5')||'').length;
  const kb=(used/1024).toFixed(1);
  document.getElementById('info-storage-stats').innerHTML=
    `<div>נתונים שמורים: <b>${kb} KB</b> / ~5,000 KB אחסון מקסימלי</div>
     <div>גנים: ${GARDENS.length} | פעילויות: ${SCH.length.toLocaleString()} | זוגות: ${pairs.length}</div>
     <div>אשכולות: ${Object.keys(clusters||{}).length} | ספקים: ${getAllSup().length}</div>`;
  document.getElementById('infom').classList.add('open');
}
function exportFullBackup(){
  // Use live in-memory data — most reliable source of truth
  const data={
    version:2,
    exported:new Date().toISOString(),
    ch:SCH.map(s=>({id:s.id,g:s.g,d:s.d,a:s.a,t:s.t,p:s.p,n:s.n,st:s.st,cr:s.cr,cn:s.cn,nt:s.nt,pd:s.pd,pt:s.pt,grp:s.grp,act:s.act||''})),
    pairs,supEx,clusters,holidays,pairBreaks,
    managers:typeof managers!=='undefined'?managers:{},
    blockedDates:typeof blockedDates!=='undefined'?blockedDates:{},
    gardenBlocks:typeof gardenBlocks!=='undefined'?gardenBlocks:{},
    invoices:typeof INVOICES!=='undefined'?INVOICES:[]
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const now=new Date();
  const timeStr=now.getHours().toString().padStart(2,'0')+'-'+now.getMinutes().toString().padStart(2,'0');
  a.href=url;a.download='גיבוי_מנהל_גנים_'+td()+'_'+timeStr+'.json';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
}
function goToCancelled(){
  ST('sched');
  setTimeout(()=>{
    ['s-city','s-cls','s-sup','s-th','s-tt','s-from','s-to','s-srch'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('s-st').value='can';
    sPage=1;renderSched();
  },50);
}
function goToPostponed(){
  ST('sched');
  setTimeout(()=>{
    ['s-city','s-cls','s-sup','s-th','s-tt','s-from','s-to','s-srch'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('s-st').value='post';
    sPage=1;renderSched();
  },50);
}
function goToNohap(){
  ST('sched');
  setTimeout(()=>{
    ['s-city','s-cls','s-sup','s-th','s-tt','s-from','s-to','s-srch'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('s-st').value='nohap';
    sPage=1;renderSched();
  },50);
}
function goToNoHap(){
  ST('sched');
  setTimeout(()=>{
    ['s-city','s-cls','s-sup','s-th','s-tt','s-from','s-to','s-srch'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('s-st').value='nohap';
    sPage=1;renderSched();
  },50);
}
function CM(id){
  const _el = document.getElementById(id);
  if(_el && _el._fromDup){ _el.style.zIndex=''; _el._fromDup=false; }
  _el?.classList.remove('open');
}

