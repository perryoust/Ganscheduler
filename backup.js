function getSnapshots(){try{return JSON.parse(window._safeLS.getItem('ganv5_snaps')||'[]');}catch{return [];}}
function saveSnapshots(snaps){try{window._safeLS.setItem('ganv5_snaps',JSON.stringify(snaps));}catch(e){}}
function createSnapshot(label){
  const snaps=getSnapshots();
  if (typeof window.isDataSafeForExport === 'function' && !window.isDataSafeForExport()) {
    console.warn('[Snapshot] Skipped blank snapshot — data not loaded yet.');
    return;
  }
  let dataStr = '';
  if (typeof window.getMasterDataSnapshot === 'function') {
    dataStr = JSON.stringify(window.getMasterDataSnapshot());
  } else {
    dataStr = window._safeLS.getItem('ganv5_y_' + (window.CURRENT_YEAR || 'tashpaz')) || window._safeLS.getItem('ganv5') || '{}';
  }
  if (!dataStr || dataStr === '{}' || dataStr.length < 10) return;
  const isAuto = (label==='שעתי'||label==='סגירה');
  if (isAuto && dataStr.length > 3000000) {
    console.log('[Backup] Skipping auto snapshot — data too large (' + Math.round(dataStr.length/1024) + 'KB)');
    return;
  }
  snaps.unshift({ts:Date.now(),label:label||'ידני',size:dataStr.length,data:dataStr});
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const filtered = snaps.filter(s => s.ts > sevenDaysAgo || s.label === 'ידני');
  if(filtered.length>MAX_SNAPSHOTS) filtered.length=MAX_SNAPSHOTS;
  saveSnapshots(filtered);
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
async function restoreSnapshot(i){
  const snaps=getSnapshots();const snap=snaps[i];if(!snap)return;
  if(!await window.spConfirm('לשחזר לגרסה מ-'+new Date(snap.ts).toLocaleString('he-IL')+'?\nהנתונים הנוכחיים יישמרו אוטומטית לפני שחזור.')) return;
  createSnapshot('לפני שחזור');
  const currentYearKey = 'ganv5_y_' + (window.CURRENT_YEAR || 'tashpaz');
  window._safeLS.setItem('ganv5', snap.data);
  window._safeLS.setItem(currentYearKey, snap.data);
  try {
    const d = JSON.parse(snap.data);
    if (Array.isArray(d.invoices)) window._safeLS.setItem('ganv5_invoices', JSON.stringify(d.invoices));
    if (Array.isArray(d.orders)) window._safeLS.setItem('ganv5_orders', JSON.stringify(d.orders));
    if (Array.isArray(d.deliveries)) window._safeLS.setItem('ganv5_deliveries', JSON.stringify(d.deliveries));
    if (d.schoolBudgets) window._safeLS.setItem('ganv5_school_budgets', JSON.stringify(d.schoolBudgets));
    if (Array.isArray(d.customGardens)) window._safeLS.setItem('custom_gardens', JSON.stringify(d.customGardens));
    if (d.matzava && window.MATZAVA_STATE) {
      window.MATZAVA_STATE.records = d.matzava.records || [];
      window.MATZAVA_STATE.nutritionOnly = d.matzava.nutritionOnly || [];
      window.MATZAVA_STATE.schools = d.matzava.schools || [];
      window.MATZAVA_STATE.lastSync = d.matzava.lastSync || null;
      window._safeLS.setItem('gan_matzava_' + (window.CURRENT_YEAR || 'tashpaz'), JSON.stringify(d.matzava));
    }
  } catch(e){}
  window.showCopyToast('✅ שוחזר! טוען מחדש...');
  setTimeout(()=>location.reload(),1200);
}
function deleteSnapshot(i){const snaps=getSnapshots();snaps.splice(i,1);saveSnapshots(snaps);renderBackupList();}

function importBackup(input){
  const isAdm = (window.role === 'admin') || (typeof window.isUserAdmin === 'function' && window.isUserAdmin()) || (typeof _isAdmin === 'function' && _isAdmin());
  if (!isAdm) {
    const msg = '⛔ שחזור נתונים מורשה למנהל מערכת בלבד (Admin).';
    if (window.spAlert) window.spAlert(msg);
    else alert(msg);
    if (input) input.value = '';
    return;
  }
  const file=input.files[0];if(!file)return;
  window._MASTER_LOCK = true;
  const r=new FileReader();
  r.onload = async e => {
    try{
      const data=JSON.parse(e.target.result);
      if(!data.ch&&!data.pairs&&!data.schedules) throw new Error('פורמט קובץ לא תקין');
      createSnapshot('לפני ייבוא');
      const sd={ch:data.ch||data.schedules||[],pairs:data.pairs||[],supEx:data.supEx||data.suppliers||{},
        clusters:data.clusters||{},holidays:data.holidays||[],pairBreaks:data.pairBreaks||{},
        managers:data.managers||{},blockedDates:data.blockedDates||{},
        gardenBlocks:data.gardenBlocks||{},invoices:data.invoices||[],
        orders:data.orders||[],deliveries:data.deliveries||[],
        schoolBudgets:data.schoolBudgets||{},
        customGardens:data.customGardens||[],
        workerTasks:data.workerTasks||[],
        todos:data.todos||[]};
      if (Array.isArray(data.orders)) window.ORDERS = data.orders;
      if (Array.isArray(data.deliveries)) window.DELIVERIES = data.deliveries;
      if (data.schoolBudgets) window.schoolBudgets = data.schoolBudgets;
      if (Array.isArray(data.customGardens)) window._GARDENS_EXTRA = data.customGardens;
      if (Array.isArray(data.workerTasks)) {
        window.WORKER_TASKS = data.workerTasks;
        if (typeof window.saveWorkerTasksToFirebase === 'function') {
          window.saveWorkerTasksToFirebase();
        }
      }
      if (data.matzava && window.MATZAVA_STATE) {
        window.MATZAVA_STATE.records = data.matzava.records || [];
        window.MATZAVA_STATE.nutritionOnly = data.matzava.nutritionOnly || [];
        window.MATZAVA_STATE.schools = data.matzava.schools || [];
        window.MATZAVA_STATE.lastSync = data.matzava.lastSync || null;
        try {
          const yKey = 'gan_matzava_' + (window.CURRENT_YEAR || 'tashpaz');
          window._safeLS.setItem(yKey, JSON.stringify(data.matzava));
        } catch(e){}
        if (typeof window.saveMatzavaToFirebase === 'function') {
          window.saveMatzavaToFirebase();
        }
      }
      const json=JSON.stringify(sd);
      window._safeLS.setItem('ganv5',json);
      if(sd.todos.length) window._safeLS.setItem('ganv5_todos', JSON.stringify(sd.todos));
      // Init meta if missing, write to year key
      let meta=JSON.parse(window._safeLS.getItem('ganv5_meta')||'null');
      if(!meta){
        const yr={key:'תשפו'};
        meta={currentYear:yr.key,years:[yr.key]};
        window._safeLS.setItem('ganv5_meta',JSON.stringify(meta));
      }
      window._safeLS.setItem('ganv5_y_'+meta.currentYear,json);
      
      // CRITICAL: Set protection BEFORE save to block race conditions
      window._safeLS.setItem('fb_sync_ignore_until', String(Date.now() + 60000));
      
      if(window.save) {
        window.showCopyToast('⏳ שומר ל-Firebase...');
        const ok = await window.save(true);
        if(!ok) console.error('[Import] Firebase save failed, but LS is updated.');
      }

      window.showCopyToast('✅ ייבוא הצליח! טוען מחדש...');
      setTimeout(()=> {
        window._MASTER_LOCK = false;
        location.reload();
      }, 1400);
    }catch(err){
      window._MASTER_LOCK = false;
      window.spAlert('שגיאה בקובץ: '+err.message);
    }
  };
  r.readAsText(file);
}
setInterval(()=>createSnapshot('שעתי'),60*60*1000);
window.addEventListener('beforeunload',()=>{
  createSnapshot('סגירה');
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
  if(tok) fetch('https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data/autoBackupCfg.json?auth='+tok,{
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
  // Check if overdue or not initialized
  if(!cfg.lastBackup){
    triggerAutoBackup();
  } else {
    const diff=Date.now()-new Date(cfg.lastBackup).getTime();
    if(diff>ms) triggerAutoBackup();
  }
}
async function triggerAutoBackup(){
  const cfg=loadAutoBackupSettings()||{};
  if(await window.spConfirm("💾 הגיע הזמן לגיבוי אוטומטי של המערכת. האם ברצונך להוריד את קובץ הגיבוי למחשב כעת?")) {
    exportFullBackup();
    cfg.lastBackup=new Date().toISOString();
    saveAutoBackupSettings(cfg);
    showToast('💾 גיבוי אוטומטי הורד');
  }
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
  
  const sEl = document.getElementById('info-fb-save');
  if (sEl) sEl.textContent = window._fbLastSaveTs ? new Date(window._fbLastSaveTs).toLocaleTimeString('he-IL') : '—';
  const lEl = document.getElementById('info-fb-load');
  if (lEl) lEl.textContent = window._fbLastLoadTs ? new Date(window._fbLastLoadTs).toLocaleTimeString('he-IL') : '—';

  const bscEl = document.getElementById('bulk-sch-count');
  if (bscEl) bscEl.textContent = (Array.isArray(window.SCH) ? window.SCH.length : (Array.isArray(SCH) ? SCH.length : 0)).toLocaleString();

  if (typeof window.renderVersionVaultIntoContainer === 'function') {
    window.renderVersionVaultIntoContainer('settings-cloud-vault-list', 5);
  }

  document.getElementById('infom').classList.add('open');
}
function exportFullBackup(){
  if (typeof window.isDataSafeForExport === 'function' && !window.isDataSafeForExport()) {
    if (window.spAlert) window.spAlert('⚠️ נתוני המערכת עדיין בטעינה מהענן. נא להמתין מספר שניות לפני הורדת גיבוי.');
    else alert('נתוני המערכת עדיין בטעינה מהענן.');
    return;
  }
  const data = typeof window.getMasterDataSnapshot === 'function' ? window.getMasterDataSnapshot() : {
    version: 4,
    exported: new Date().toISOString(),
    ch: window.SCH || [],
    pairs: window.pairs || [],
    supEx: window.supEx || {},
    clusters: window.clusters || {},
    holidays: window.holidays || [],
    pairBreaks: window.pairBreaks || {},
    managers: window.managers || {},
    blockedDates: window.blockedDates || {},
    gardenBlocks: window.gardenBlocks || {},
    invoices: window.INVOICES || [],
    orders: window.ORDERS || [],
    deliveries: window.DELIVERIES || [],
    schoolBudgets: window.schoolBudgets || {},
    todos: window.todo ? window.todo.items : []
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const now=new Date();
  const timeStr=now.getHours().toString().padStart(2,'0')+'-'+now.getMinutes().toString().padStart(2,'0');
  const ver = window.APP_VERSION || '5.0';
  a.href=url;a.download=`גיבוי_מלא_מערכת_טומשין_v${ver}_${td()}_${timeStr}.json`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
}

async function downloadSystemZip(){
  const ver = window.APP_VERSION || '5.0';
  const toast = (msg) => {
    if (window.showCopyToast) window.showCopyToast(msg);
    else if (window.showToast) window.showToast(msg);
  };
  toast(`📦 אוסף את כל קבצי המערכת מ-Git (ZIP) וקובץ נתוני JSON לגרסה v${ver}...`);

  // Download the JSON Data automatically with version tag
  setTimeout(() => {
    if (typeof window.exportFullBackup === 'function') {
      window.exportFullBackup();
    } else if (typeof window.exportData === 'function') {
      window.exportData();
    }
  }, 1000);

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const zipName = `Ganscheduler-${dd}-${mm}-${yy} ${hh}-${min}.zip`;

  try {
    if (!window.JSZip) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        s.onload = resolve;
        s.onerror = () => reject(new Error('JSZip load failed'));
        document.head.appendChild(s);
      });
    }

    const treeRes = await fetch('https://api.github.com/repos/perryoust/Ganscheduler/git/trees/main?recursive=1');
    if (!treeRes.ok) throw new Error('GitHub tree API error: ' + treeRes.status);
    const treeData = await treeRes.json();
    const blobs = (treeData.tree || []).filter(item => item.type === 'blob');
    if (!blobs.length || treeData.truncated) throw new Error('Empty or truncated GitHub tree');

    const zip = new window.JSZip();
    const BATCH_SIZE = 15;
    for (let i = 0; i < blobs.length; i += BATCH_SIZE) {
      const batch = blobs.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (item) => {
        const encodedPath = item.path.split('/').map(encodeURIComponent).join('/');
        const fileRes = await fetch(`https://raw.githubusercontent.com/perryoust/Ganscheduler/main/${encodedPath}`);
        if (!fileRes.ok) throw new Error(`Failed fetching ${item.path}: ${fileRes.status}`);
        const buf = await fileRes.arrayBuffer();
        zip.file(`Ganscheduler-main/${item.path}`, buf);
      }));
    }

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast(`✅ הורדת ZIP הושלמה: ${zipName} (${blobs.length} קבצים)`);
  } catch (err) {
    console.warn('Client-side Git ZIP build failed, falling back to direct GitHub ZIP:', err);
    const a = document.createElement('a');
    a.href = 'https://github.com/perryoust/Ganscheduler/archive/refs/heads/main.zip';
    a.download = zipName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
window.downloadSystemZip = downloadSystemZip;
function goToCancelled(){
  ST('dash');
  setTimeout(()=>{
    const el = document.getElementById('dash-st');
    const dt = document.getElementById('dash-date');
    if(dt) dt.value = '';
    if(el) { el.value='can'; renderDash(); }
  },50);
}
function goToPostponed(){
  ST('dash');
  setTimeout(()=>{
    const el = document.getElementById('dash-st');
    const dt = document.getElementById('dash-date');
    if(dt) dt.value = '';
    if(el) { el.value='todo'; renderDash(); }
  },50);
}
function goToNohap(){
  ST('dash');
  setTimeout(()=>{
    const el = document.getElementById('dash-st');
    const dt = document.getElementById('dash-date');
    if(dt) dt.value = '';
    if(el) { el.value='todo'; renderDash(); }
  },50);
}
function goToNoHap(){
  ST('dash');
  setTimeout(()=>{
    const el = document.getElementById('dash-st');
    const dt = document.getElementById('dash-date');
    if(dt) dt.value = '';
    if(el) { el.value='todo'; renderDash(); }
  },50);
}



