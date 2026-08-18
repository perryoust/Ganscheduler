// ══════════════════════════════════════════════════════
// Daily Firebase Backup — saves to backups/YYYY-MM-DD
// Max 30 days kept. Runs once per day after successful save.
// ══════════════════════════════════════════════════════
const BACKUP_DB_BASE = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/backups';
const BACKUP_LAST_KEY = '_fbDailyBackupDate';

async function _runDailyBackupIfNeeded(liveData, tok){
  try{
    const today = window.d2s(new Date());
    const lastBackup = window._safeLS.get(BACKUP_LAST_KEY)||'';
    if(lastBackup === today) return; // already backed up today

    const authQ = tok ? '?auth='+tok : '';

    // 1. Write today's backup
    const backupUrl = `${BACKUP_DB_BASE}/${today}.json${authQ}`;
    // Exclude invoices from backup (too large — saved separately in /data/invoices)
    const _backupData = {...liveData};
    delete _backupData.invoices;
    const _now = new Date();
    const _timeStr = _now.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});
    
    // Compress data using GZIP base64 to save 90% bandwidth and prevent hang
    let payload;
    const compressed = await window.utils.compressData(_backupData);
    if (compressed) {
      payload = { gz: compressed, ts: Date.now(), time: _timeStr, version: '10.2c' };
    } else {
      // Fallback if compression fails
      payload = { data: _backupData, ts: Date.now(), time: _timeStr, version: '10.2' };
    }

    const r = await fetch(backupUrl, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if(!r.ok){ console.warn('Backup failed:', r.status); return; }

    // 2. Mark done
    window._safeLS.setItem(BACKUP_LAST_KEY, today);
    console.log('✅ Daily backup saved:', today);

    // 3. Prune backups older than 30 days
    const listR = await fetch(`${BACKUP_DB_BASE}.json?shallow=true${tok?'&auth='+tok:''}`);
    if(listR.ok){
      const keys = Object.keys(await listR.json()||{});
      const cutoff = window.d2s(window.addD(new Date(), -30));
      const toDelete = keys.filter(k=>k<cutoff);
      for(const k of toDelete){
        await fetch(`${BACKUP_DB_BASE}/${k}.json${authQ}`, {method:'DELETE'});
        console.log('🗑️ Deleted old backup:', k);
      }
    }
  } catch(e){ console.warn('Daily backup error:', e.message); }
}
window._runDailyBackupIfNeeded = _runDailyBackupIfNeeded;

async function loadCloudBackups(){
  const el=document.getElementById('cloud-backup-list');
  const btn=document.getElementById('cloud-backup-btn');
  if(!el) return;
  el.style.display = 'block';
  el.innerHTML='<span style="color:#999">טוען...</span>';
  if(btn) btn.disabled=true;
  try{
    let tok=null;
    if(window._fbUser) try{ tok=await window._fbUser.getIdToken(false); }catch(e){}
    const authQ=tok?'?auth='+tok:'';
    const r=await fetch(`${BACKUP_DB_BASE}.json?shallow=true${tok?'&auth='+tok:''}`);
    if(!r.ok){ el.innerHTML='<span style="color:#c62828">שגיאה: '+r.status+'</span>'; return; }
    const _rawJson = await r.json();
    const keys = _rawJson ? Object.keys(_rawJson).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort().reverse().slice(0,30) : [];
    if(!keys.length){ el.innerHTML='<span style="color:#999">אין גיבויים עדיין. גיבוי ראשון יישמר אוטומטית היום.</span>'; return; }
    const today=window.d2s(new Date());
    // Fetch time from each backup (shallow=true returns keys only, need full for time)
    // Instead fetch timestamps in parallel
    const backupMeta = await Promise.all(keys.map(async k=>{
      try{
        const _tr = await fetch(`${BACKUP_DB_BASE}/${k}/time.json${tok?'?auth='+tok:''}`);
        const _time = _tr.ok ? await _tr.json() : null;
        return {k, time: _time||''};
      } catch(e){ return {k, time:''}; }
    }));
    el.innerHTML='<div style="display:flex;flex-direction:column;gap:5px">'+
      backupMeta.map(({k,time})=>`<div style="background:${k===today?'#e8f5e9':'#f5f7ff'};border-radius:7px;padding:7px 11px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <span style="font-weight:700;font-size:.82rem">${window.fD(k)}</span>
          ${time?`<span style="font-size:.7rem;color:#546e7a;margin-right:6px">🕐 ${time}</span>`:''}
          ${k===today?'<span style="font-size:.68rem;background:#2e7d32;color:#fff;border-radius:8px;padding:1px 6px;margin-right:5px">היום</span>':''}
        </div>
        <button class="btn bp bsm" onclick="restoreCloudBackup('${k}')">🔄 שחזר</button>
      </div>`).join('')+'</div>';
  } catch(e){ el.innerHTML='<span style="color:#c62828">שגיאה: '+e.message+'</span>'; }
  if(btn) btn.disabled=false;
}

async function restoreCloudBackup(dateKey){
  if(!confirm(`לשחזר גיבוי מ-${window.fD(dateKey)}?\nהנתונים הנוכחיים יישמרו תחילה כ-snapshot מקומי.`)) return;
  const el=document.getElementById('cloud-backup-list');
  const prevHtml = el ? el.innerHTML : '';
  if(el) el.innerHTML='<span style="color:#e65100">משחזר... (אנא המתן, זה עשוי לקחת מספר שניות)</span>';
  try{
    let tok=null;
    if(window._fbUser) try{ tok=await window._fbUser.getIdToken(false); }catch(e){}
    const authQ=tok?'?auth='+tok:'';
    const r=await fetch(`${BACKUP_DB_BASE}/${dateKey}.json${authQ}`);
    if(!r.ok){ 
      window.showToast('❌ שגיאה בטעינת גיבוי: '+r.status); 
      if(el) el.innerHTML = prevHtml;
      return; 
    }
    const backup=await r.json();
    let appData;
    if (backup.gz) {
      appData = await window.utils.decompressData(backup.gz);
      if (!appData) {
        window.showToast('❌ שגיאה בפריסת הגיבוי');
        if(el) el.innerHTML = prevHtml;
        return;
      }
    } else {
      appData = backup.data||backup;
    }
    if(!appData||!appData.ch){ 
      window.showToast('❌ גיבוי פגום (חסר מידע)'); 
      if(el) el.innerHTML = prevHtml;
      return; 
    }
    // Save current as local snapshot first
    createSnapshot('לפני שחזור מענן');
    // Apply the backup data
    window._MASTER_LOCK = true;
    _applyYearData(appData);
    const ok = await save(true);
    window._MASTER_LOCK = false;
    if(ok){
      showToast('✅ שוחזר מגיבוי '+fD(dateKey)+' — המערכת מתרעננת...');
      setTimeout(()=>{ refresh(); CM('backupm'); }, 1500);
    } else {
      window.showToast('❌ שגיאה בשמירת הנתונים המשוחזרים לענן!');
      if(el) el.innerHTML = prevHtml;
    }
  } catch(e){ 
    showToast('❌ שגיאת שחזור: '+e.message); 
    if(el) el.innerHTML = prevHtml;
  }
}

function _sanitizeSupEx(obj) {
  if (!obj || typeof obj !== 'object') return obj || {};
  const cleaned = {};
  for (const [k, v] of Object.entries(obj)) {
    const cleanKey = k.replace(/[\.\$\#\[\]\/]/g, '_');
    cleaned[cleanKey] = v;
  }
  return cleaned;
}

async function forceDailyBackup(){
  const btn = document.getElementById('cloud-backup-btn');
  showToast('☁️ שומר גיבוי...');
  try{
    let tok=null;
    if(window._fbUser){ try{ tok=await window._fbUser.getIdToken(true); }catch(e){} }
    const _bkpSupEx=(()=>{const _s={...supEx};delete _s['__c'];return _sanitizeSupEx(_s);})();
    const liveData={
      ch:SCH, pairs, supEx:_bkpSupEx, clusters, holidays, pairBreaks,
      managers, blockedDates, gardenBlocks,
      // invoices excluded (too large — stored separately in /data/invoices),
      vatRate:VAT_RATE, activeGardens:activeGardens?[...activeGardens]:null
    };
    // Force backup even if already done today
    _safeLS.setItem(BACKUP_LAST_KEY,''); 
    await _runDailyBackupIfNeeded(liveData, tok);
    showToast('✅ גיבוי נשמר לענן');
    setTimeout(loadCloudBackups, 500);
  } catch(e){ showToast('❌ שגיאת גיבוי: '+e.message); }
}

// ══════════════════════════════════════════════════════
// User Management — admin only
// ══════════════════════════════════════════════════════
const ADMIN_UID = 'VW5FCIlBb9VS4Eo1BTKyCxq5xa03';
const USERS_DB  = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/users';

function _isAdmin(){
  const email = (window._fbUser?.email || '').toLowerCase().trim();
  const dn = (window._fbUser?.displayName || '').toLowerCase().trim();
  return window._fbUser?.uid === ADMIN_UID || email === 'perry@ganmanager.app' || dn === 'perry';
}

window._initUsersUI = function _initUsersUI(){
  const isAdm = _isAdmin();
  
  // Init Global Year Selector for admins
  if (isAdm && window._initGlobalYearSelector) {
    window._initGlobalYearSelector();
  }
  
  // Admin button in mode bar
  const adminModeBtn = document.getElementById('modeBtn-admin');
  if(adminModeBtn) adminModeBtn.style.display = isAdm ? '' : 'none';
  // Legacy buttons
  const btn = document.getElementById('users-mgmt-btn');
  if(btn) btn.style.display = isAdm ? 'inline-flex' : 'none';
  const hBtn = document.getElementById('users-hdr-btn');
  if(hBtn) hBtn.style.display = isAdm ? '' : 'none';
  
  // QA Simulator
  const qaContainer = document.getElementById('qa-simulator-container');
  if(qaContainer) qaContainer.style.display = isAdm ? '' : 'none';
  
  // Dynamic Purchase Mode Visibility
  const hasPurch = !!(window.permPurch || isAdm);
    const workerModeBtn = document.getElementById('modeBtn-worker');
  if(workerModeBtn) workerModeBtn.style.display = (window.permWorker || isAdm) ? '' : 'none';

  const purchModeBtn = document.getElementById('modeBtn-purch');
  if(purchModeBtn) purchModeBtn.style.display = hasPurch ? '' : 'none';
  const purchStatsGrp = document.getElementById('hdr-purch-stats-group');
  if(purchStatsGrp) purchStatsGrp.style.display = hasPurch ? 'contents' : 'none';

  // Danger Zone & Admin Settings - Super Admin / Admin only
  const isSuperAdmin = window._fbUser?.uid === ADMIN_UID || (window._fbUser?.email || '').toLowerCase().trim() === 'perry@ganmanager.app' || (window._fbUser?.displayName || '').toLowerCase().trim() === 'perry';
  
  const dangerZone = document.getElementById('admin-danger-zone');
  if(dangerZone) dangerZone.style.display = isSuperAdmin ? '' : 'none';
  
  const settingsDangerZone = document.getElementById('settings-danger-zone');
  if(settingsDangerZone) settingsDangerZone.style.display = isSuperAdmin ? '' : 'none';

  // Show Data Management and Year Management in Settings only for Admins
  const settingsAdminTabBtn = document.getElementById('settings-admin-tab-btn');
  if(settingsAdminTabBtn) settingsAdminTabBtn.style.display = isAdm ? '' : 'none';
  const settingsAdminData = document.getElementById('settings-admin-data');
  if(settingsAdminData) settingsAdminData.style.display = isAdm ? '' : 'none';
  
  const settingsAdminYear = document.getElementById('settings-admin-year');
  if(settingsAdminYear) settingsAdminYear.style.display = isAdm ? '' : 'none';

  // Coordinator specific UI restrictions
  if (window.role === 'coordinator') {
    window.isReadOnly = true;
    const tabsAct = document.getElementById('tabs-act');
    if (tabsAct) {
      const tabs = tabsAct.querySelectorAll('.tab');
      tabs.forEach(t => {
        const oc = t.getAttribute('onclick') || '';
        if (!oc.includes("'cal'") && !oc.includes("'dash'")) {
          t.style.display = 'none';
        }
      });
    }
    const sysSetBtn = document.getElementById('sys-set-btn');
    if(sysSetBtn) sysSetBtn.style.display = 'none';
    
    // Hide mob-nav buttons that aren't cal or dash
    const mobNavBtns = document.querySelectorAll('.mob-nav-btn');
    mobNavBtns.forEach(b => {
      const tab = b.getAttribute('data-tab');
      if (tab !== 'cal' && tab !== 'dash') {
        b.style.display = 'none';
      }
    });
  }

  // Show logged-in username in header
  if(window._fbUser){
    const uname = window._fbUser.email?.replace('@ganmanager.app','')||'';
    const unameEl = document.getElementById('auth-user-name');
    if(unameEl) unameEl.textContent = '👤 ' + uname;
  }
  // Show logout button (desktop)
  const logoutBtn = document.getElementById('logout-btn');
  if(logoutBtn) logoutBtn.style.display = '';
  // Update username display in header
  const uname2 = window._fbUser?.email?.replace('@ganmanager.app','')||'';
  const unameEl2 = document.getElementById('auth-user-name');
  if(unameEl2 && uname2) unameEl2.textContent = '👤 ' + uname2;
  // Show admin button in mobile nav
  const mobAdminBtn = document.getElementById('mob-admin-btn');
  if(mobAdminBtn) mobAdminBtn.style.display = isAdm ? 'flex' : 'none';
  // Load data if admin
  if(isAdm && typeof loadUsersList==='function') setTimeout(loadUsersList, 500);
  if(isAdm && typeof loadActivityLog==='function') setTimeout(()=>loadActivityLog('week'), 800);
}

async function openUsersModal(){
  if(!_isAdmin()){ showToast('❌ אין הרשאה'); return; }
  ST('admin'); // navigate to admin tab
  setTimeout(loadUsersList, 300);
}

async function _authQ(){
  let tok=null;
  if(window._fbUser) try{ tok=await window._fbUser.getIdToken(false); }catch(e){}
  return tok ? '?auth='+tok : '';
}

async function loadUsersList(){
  const el=document.getElementById('users-list');
  if(!el) return;
  el.innerHTML='<span style="color:#999;font-size:.78rem">טוען...</span>';
  try{
    const q=await _authQ();
    const r=await fetch(USERS_DB+'.json'+q);
    if(!r.ok){ el.innerHTML='<span style="color:#c62828">שגיאה '+r.status+'</span>'; return; }
    const users=await r.json()||{};
    const roleLabel={admin:'👑 מנהל',edit:'✏️ עריכה',view:'👁️ צפייה'};
    const roleBg={admin:'#fce4ec',edit:'#e8f5e9',view:'#e3f2fd'};
    const entries=Object.entries(users).sort((a,b)=>(a[1].name||'').localeCompare(b[1].name||'','he'));
    if(!entries.length){ el.innerHTML='<span style="color:#999;font-size:.78rem">אין משתמשים עדיין</span>'; return; }
    el.innerHTML=entries.map(([uid,u])=>`
      <div style="background:#fff;border-radius:8px;margin-bottom:8px;border:1px solid #e8eaf6;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#f8f9ff">
          <div>
            <span style="font-weight:700;font-size:.85rem">${u.name||u.username||'—'}</span>
            <span style="font-size:.72rem;color:#546e7a;margin-right:6px">${u.username||''}</span>
            ${uid===ADMIN_UID?'<span style="font-size:.68rem;background:#fff3e0;color:#e65100;border-radius:8px;padding:1px 6px">אדמין</span>':''}
          </div>
          ${uid!==ADMIN_UID?`<div style="display:flex;gap:4px"><button class="btn bo bsm" style="font-size:.68rem" onclick="changeUserPassword('${uid}','${u.username||u.name}')">🔑 סיסמה</button><button class="btn br bsm" style="font-size:.68rem" onclick="deleteUser('${uid}','${u.name||u.username}')">🗑️ מחק</button></div>`:''}
        </div>
        ${uid!==ADMIN_UID?`<div style="padding:8px 12px;display:flex;flex-wrap:wrap;gap:16px">
          <div>
            <div style="font-size:.68rem;color:#546e7a;margin-bottom:4px;font-weight:700">גישה ל:</div>
            <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;cursor:pointer;margin-bottom:3px">
              <input type="checkbox" ${u.permAct!==false?'checked':''} onchange="updateUserPerm('${uid}','permAct',this.checked)"> 🎨 חוגים
            </label>
            <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;cursor:pointer">
              <input type="checkbox" ${u.permPurch?'checked':''} onchange="updateUserPerm('${uid}','permPurch',this.checked)"> 🛒 רכש
            </label>
            <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;cursor:pointer;margin-top:3px">
              <input type="checkbox" ${u.permWorker?'checked':''} onchange="updateUserPerm('${uid}','permWorker',this.checked)"> 👷 משימות שטח
            </label>
          </div>
          <div>
            <div style="font-size:.68rem;color:#546e7a;margin-bottom:4px;font-weight:700">רמת גישה:</div>
            <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;cursor:pointer;margin-bottom:3px">
              <input type="radio" name="role_${uid}" value="view" ${u.role==='view'?'checked':''} onchange="changeUserRole('${uid}','view')"> 👁️ צפייה בלבד
            </label>
            <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;cursor:pointer;margin-bottom:3px">
              <input type="radio" name="role_${uid}" value="edit" ${u.role==='edit'?'checked':''} onchange="changeUserRole('${uid}','edit')"> ✏️ עריכה
            </label>
            <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;cursor:pointer">
              <input type="radio" name="role_${uid}" value="coordinator" ${u.role==='coordinator'?'checked':''} onchange="changeUserRole('${uid}','coordinator')"> 👀 רכז שטח 
              ${u.role==='coordinator' ? `<button onclick="window.editCoordPermissions('${uid}')" style="margin-right:8px;font-size:0.7rem;padding:2px 6px;background:#e1f5fe;border:1px solid #81d4fa;border-radius:4px;cursor:pointer;color:#0277bd">✏️ ערוך ערים/גנים</button>` : ''}
            </label>
          </div>
        </div>`:''}
      </div>`).join('');
  } catch(e){ el.innerHTML='<span style="color:#c62828">שגיאה: '+e.message+'</span>'; }
}

async function createNewUser(){
  if(!_isAdmin()) return;
  const username=(document.getElementById('nu-username')?.value||'').trim().toLowerCase();
  const displayName=(document.getElementById('nu-displayname')?.value||'').trim();
  const password=document.getElementById('nu-password')?.value||'';
  const permAct=document.getElementById('nu-perm-act')?.checked!==false;
  const permPurch=document.getElementById('nu-perm-purch')?.checked||false;
  const permWorker=document.getElementById('nu-perm-worker')?.checked||false;
  const role=document.querySelector('input[name="nu-access"]:checked')?.value||'view';
  
  // Coordinator specific
  const isCoord = role === 'coordinator';
  const permCoord = isCoord;
  let coordCities = [];
  let coordGardenIds = [];
  let coordTimeScope = 'month';
  if (isCoord) {
    coordCities = Array.from(document.querySelectorAll('#nu-coord-cities input:checked')).map(cb => cb.value);
    coordGardenIds = Array.from(document.querySelectorAll('#nu-coord-selected-gardens [data-gid]')).map(el => Number(el.dataset.gid));
    coordTimeScope = document.getElementById('nu-coord-timescope')?.value || 'month';
  }
  const statusEl=document.getElementById('nu-status');
  const btn=document.getElementById('nu-create-btn');

  if(!username||!password||!displayName){
    statusEl.innerHTML='<span style="color:#c62828">יש למלא שם משתמש, שם לתצוגה וסיסמה</span>'; return;
  }
  if(password.length<6){
    statusEl.innerHTML='<span style="color:#c62828">הסיסמה חייבת להכיל לפחות 6 תווים</span>'; return;
  }
  if(!/^[a-z0-9_.-]+$/.test(username)){
    statusEl.innerHTML='<span style="color:#c62828">שם משתמש: אותיות לטיניות קטנות, ספרות, קו תחתון בלבד</span>'; return;
  }

  btn.disabled=true;
  statusEl.innerHTML='<span style="color:#1565c0">⏳ יוצר משתמש...</span>';

  try{
    // Create Firebase Auth user (secondary app - admin stays logged in)
    const {uid,email}=await window._fbCreateUser(username, password);

    // Save user profile to RTDB
    const q=await _authQ();
    const r=await fetch(`${USERS_DB}/${uid}.json${q}`,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({uid,username,name:displayName,role,email,permAct,permPurch,permWorker,permCoord,coordCities,coordGardenIds,coordTimeScope,createdAt:Date.now()})
    });
    if(!r.ok) throw new Error('שמירה נכשלה: '+r.status);

    statusEl.innerHTML=`<span style="color:#2e7d32">✅ משתמש נוצר! שם: <b>${username}</b> | סיסמה: <b>${password}</b></span>`;
    document.getElementById('nu-username').value='';
    document.getElementById('nu-displayname').value='';
    document.getElementById('nu-password').value='';
    await loadUsersList();
  } catch(e){
    statusEl.innerHTML=`<span style="color:#c62828">❌ שגיאה: ${e.message}</span>`;
  }
  btn.disabled=false;
}

// ── Coordinator UI Helpers ──
window.loadCoordCityCheckboxes = function(containerId = 'nu-coord-cities', selected = []) {
  const container = document.getElementById(containerId);
  if(!container) return;
  const cities = [...new Set((window.GARDENS||[]).map(g=>g.city||'אחר'))].sort();
  container.innerHTML = cities.map(c => `
    <label style="display:flex;align-items:center;gap:4px;font-size:0.8rem;padding:2px 6px;background:#f5f5f5;border-radius:4px;cursor:pointer">
      <input type="checkbox" value="${c}" ${selected.includes(c) ? 'checked' : ''}> ${c}
    </label>
  `).join('');
};

window.searchCoordGardens = function(q, resultsId = 'nu-coord-garden-results', selectedId = 'nu-coord-selected-gardens') {
  const res = document.getElementById(resultsId);
  if(!res) return;
  if(!q || q.length < 2) { res.style.display = 'none'; return; }
  
  const qLow = q.toLowerCase();
  const gdns = (window.GARDENS||[]).filter(g => g.name.toLowerCase().includes(qLow) || String(g.id).includes(qLow)).slice(0, 8);
  
  if(!gdns.length) {
    res.innerHTML = '<div style="padding:8px;font-size:0.8rem;color:#7f8c8d">לא נמצאו גנים</div>';
  } else {
    res.innerHTML = gdns.map(g => `
      <div style="padding:6px 8px;font-size:0.8rem;cursor:pointer;border-bottom:1px solid #eee" onclick="window.addCoordGarden(${g.id}, '${g.name}', '${selectedId}'); document.getElementById('${resultsId}').style.display='none'; document.getElementById('nu-coord-garden-search').value=''">
        ${g.name} <span style="color:#7f8c8d">(${g.id})</span>
      </div>
    `).join('');
  }
  res.style.display = 'block';
};

window.addCoordGarden = function(id, name, selectedId = 'nu-coord-selected-gardens') {
  const container = document.getElementById(selectedId);
  if(!container) return;
  
  // check if exists
  if(container.querySelector(`[data-gid="${id}"]`)) return;
  
  const tag = document.createElement('div');
  tag.dataset.gid = id;
  tag.style.cssText = 'background:#e1f5fe;color:#0277bd;font-size:0.75rem;padding:3px 8px;border-radius:12px;display:flex;align-items:center;gap:4px';
  tag.innerHTML = `
    ${name} <span style="color:#0288d1">(${id})</span>
    <span onclick="this.parentElement.remove()" style="cursor:pointer;font-weight:bold;margin-right:4px">✕</span>
  `;
  container.appendChild(tag);
};

window.editCoordPermissions = async function(uid) {
  try {
    showToast('⏳ טוען נתוני רכז...');
    const q=await _authQ();
    const r=await fetch(`${USERS_DB}/${uid}.json${q}`);
    if(!r.ok) throw new Error('שגיאה בטעינת המשתמש');
    const u=await r.json();
    
    const coordCities = u.coordCities || [];
    const coordGardenIds = u.coordGardenIds || [];
    const coordTimeScope = u.coordTimeScope || 'month';
    const coordClsScope = u.coordClsScope || 'all';
    
    // Create modal
    const mod = document.createElement('div');
    mod.id = 'coord-perm-modal';
    mod.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;direction:rtl';
    mod.innerHTML = `
      <div style="background:#fff;padding:20px;border-radius:12px;width:95%;max-width:500px;box-shadow:0 10px 25px rgba(0,0,0,0.2)">
        <h3 style="margin:0 0 15px 0;color:#0277bd">✏️ עריכת הרשאות רכז — ${u.name || u.username}</h3>
        
        <div style="margin-bottom:15px">
          <label style="font-weight:700;font-size:0.9rem;color:#37474f">ערים מורשות:</label>
          <div id="edit-coord-cities" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;max-height:150px;overflow-y:auto;background:#f5f7ff;border-radius:8px;padding:10px;border:1px solid #cfd8dc"></div>
        </div>
        
        <div style="margin-bottom:20px">
          <label style="font-weight:700;font-size:0.9rem;color:#37474f">גנים ספציפיים:</label>
          <input type="text" id="edit-coord-g-srch" placeholder="חיפוש גן..." oninput="window.searchCoordGardens(this.value, 'edit-coord-g-res', 'edit-coord-g-sel')" style="width:100%;margin-top:6px;padding:8px;border-radius:6px;border:1px solid #b0bec5">
          <div id="edit-coord-g-res" style="display:none;max-height:120px;overflow-y:auto;background:#fff;border-radius:6px;margin-top:4px;border:1px solid #b0bec5"></div>
          <div id="edit-coord-g-sel" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
        </div>
        
        <div style="margin-bottom:20px">
          <label style="font-weight:700;font-size:0.9rem;color:#37474f">טווח זמן מותר לצפייה:</label>
          <select id="edit-coord-timescope" style="width:100%;margin-top:6px;padding:8px;border-radius:6px;border:1px solid #b0bec5">
            <option value="day" ${coordTimeScope==='day'?'selected':''}>יום (יכול לצפות רק ביום הנוכחי)</option>
            <option value="week" ${coordTimeScope==='week'?'selected':''}>שבוע (יכול לצפות בשבוע הנוכחי)</option>
            <option value="month" ${coordTimeScope==='month'?'selected':''}>חודש (יכול לצפות בחודש הנוכחי)</option>
            <option value="year" ${coordTimeScope==='year'?'selected':''}>שנה (יכול לצפות בכל השנה)</option>
          </select>
        </div>
        
        <div style="margin-bottom:20px">
          <label style="font-weight:700;font-size:0.9rem;color:#37474f">סוג מסגרת מורשית:</label>
          <select id="edit-coord-clsscope" style="width:100%;margin-top:6px;padding:8px;border-radius:6px;border:1px solid #b0bec5">
            <option value="all" ${coordClsScope==='all'?'selected':''}>גם גנים וגם בתי ספר (הכל)</option>
            <option value="גן" ${coordClsScope==='גן'?'selected':''}>גנים בלבד</option>
            <option value="ביהס" ${coordClsScope==='ביהס' || coordClsScope==='ביה"ס' ?'selected':''}>בתי ספר בלבד</option>
          </select>
        </div>
        
        <div style="display:flex;justify-content:flex-end;gap:10px">
          <button class="btn bo" onclick="document.getElementById('coord-perm-modal').remove()">ביטול</button>
          <button class="btn bg" onclick="window.saveCoordPermissions('${uid}')" style="background:#0277bd;border-color:#0277bd">💾 שמור</button>
        </div>
      </div>
    `;
    document.body.appendChild(mod);
    
    // Populate
    window.loadCoordCityCheckboxes('edit-coord-cities', coordCities);
    const selG = document.getElementById('edit-coord-g-sel');
    coordGardenIds.forEach(gid => {
      const gObj = window.G(gid);
      if(gObj && gObj.id) window.addCoordGarden(gObj.id, gObj.name, 'edit-coord-g-sel');
    });
    
  } catch(e) {
    showToast('❌ ' + e.message);
  }
};

window.saveCoordPermissions = async function(uid) {
  const btn = document.querySelector('#coord-perm-modal .bg');
  if(btn) { btn.disabled=true; btn.textContent='שומר...'; }
  
  try {
    const coordCities = Array.from(document.querySelectorAll('#edit-coord-cities input:checked')).map(cb => cb.value);
    const coordGardenIds = Array.from(document.querySelectorAll('#edit-coord-g-sel [data-gid]')).map(el => Number(el.dataset.gid));
    const coordTimeScope = document.getElementById('edit-coord-timescope')?.value || 'month';
    const coordClsScope = document.getElementById('edit-coord-clsscope')?.value || 'all';
    
    const q=await _authQ();
    
    // Also explicitly ensure permCoord=true since they are a coordinator
    await fetch(`${USERS_DB}/${uid}.json${q}`, {
      method: 'PATCH',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ coordCities, coordGardenIds, coordTimeScope, coordClsScope, permCoord: true })
    });
    
    showToast('✅ הרשאות נשמרו בהצלחה');
    document.getElementById('coord-perm-modal').remove();
    await loadUsersList();
  } catch(e) {
    showToast('❌ שגיאה בשמירה: ' + e.message);
    if(btn) { btn.disabled=false; btn.textContent='💾 שמור'; }
  }
};

// Also call loadCoordCityCheckboxes when admin UI is shown
const originalInitUsersUI = window._initUsersUI;
window._initUsersUI = function() {
  if(originalInitUsersUI) originalInitUsersUI();
  window.loadCoordCityCheckboxes();
};


async function changeUserRole(uid, newRole){
  if(!_isAdmin()) return;
  try{
    const q=await _authQ();
    await fetch(`${USERS_DB}/${uid}/role.json${q}`,{
      method:'PUT', headers:{'Content-Type':'application/json'},
      body:JSON.stringify(newRole)
    });
    showToast('✅ תפקיד עודכן');
  } catch(e){ showToast('❌ שגיאה: '+e.message); }
}

async function deleteUser(uid, name){
  if(!_isAdmin()) return;
  if(!confirm(`למחוק את המשתמש "${name}"?\nהם לא יוכלו להתחבר יותר לאפליקציה.`)) return;
  try{
    showToast('⏳ מוחק משתמש...');
    // 1. Delete from Firebase Auth via Cloud Function
    let tok=null;
    if(window._fbUser) try{ tok=await window._fbUser.getIdToken(false); }catch(e){}
    try {
      const endpoints = ['/api/deleteUser', 'https://deleteuser-graclk45jq-uc.a.run.app'];
      let delRes = null;
      let lastErr = null;
      for (const url of endpoints) {
        try {
          const r = await fetch(url, {
            method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
            body:JSON.stringify({uid})
          });
          delRes = r;
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!delRes) throw lastErr || new Error('שגיאה בתקשורת עם השרת');
      if(!delRes.ok){ 
        let e = {error: 'Unknown error'};
        try { e = await delRes.json(); } catch(je){}
        if(e.error && e.error.includes('user-not-found')){
          console.warn('User not in auth, deleting from db');
        } else {
          throw new Error(e.error || 'שגיאה מהשרת');
        }
      }
    } catch (err) {
      if(!confirm('שגיאה במחיקת משתמש משרת ההזדהות: '+(err.message||'שגיאה')+'\nהאם למחוק ממסד הנתונים בכל זאת?')) {
        throw new Error('בוטל על ידי המשתמש');
      }
    }
    // 2. Delete from RTDB regardless
    const q=await _authQ();
    await fetch(`${USERS_DB}/${uid}.json${q}`,{method:'DELETE'});
    showToast(`✅ משתמש "${name}" נמחק לחלוטין`);
    await loadUsersList();
  } catch(e){ showToast('❌ שגיאה: '+e.message); }
}

// Also save admin profile on first load if not exists
async function _ensureAdminProfile(){
  if(!_isAdmin()){ _initUsersUI(); return; }
  _initUsersUI(); // show button immediately
  try{
    const q=await _authQ();
    const r=await fetch(`${USERS_DB}/${ADMIN_UID}.json${q}`);
    if(r.ok){
      const d=await r.json();
      if(!d){
        await fetch(`${USERS_DB}/${ADMIN_UID}.json${q}`,{
          method:'PUT', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            uid:ADMIN_UID,
            username:'perry',
            name:'Perry',
            role:'admin',
            email:'perry@ganmanager.app',
            permAct: true,
            permPurch: true
          })
        });
      }
    }
  } catch(e){}
  _initUsersUI();
}

// ══════════════════════════════════════════════════════
// Activity Log — track changes by all users, 30 days
// ══════════════════════════════════════════════════════
const LOG_DB = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/activityLog';

async function _writeLog(action, target, detail, extra={}){
  try{
    if(!window._fbUser) return;
    const userName = window._fbUser.email?.replace('@ganmanager.app','')||'unknown';
    const entry = {
      ts: Date.now(),
      user: userName,
      action,   // 'status'|'move'|'new'|'delete'|'edit'|'invoice'
      target,   // e.g. "גן חיה - ריקוד"
      detail,   // e.g. "לא התקיים"
      ...extra
    };
    let tok=null;
    if(window._fbUser) try{ tok=await window._fbUser.getIdToken(false); }catch(e){}
    const q = tok?'?auth='+tok:'';
    const key = Date.now()+'_'+Math.random().toString(36).slice(2,7);
    await fetch(`${LOG_DB}/${key}.json${q}`,{
      method:'PUT', headers:{'Content-Type':'application/json'},
      body:JSON.stringify(entry)
    });
  } catch(e){ /* non-critical, ignore */ }
}

async function loadActivityLog(filter='week'){
  const el=document.getElementById('admin-log-body');
  if(!el) return;
  el.innerHTML='<span style="color:#999;font-size:.78rem">טוען...</span>';
  try{
    let tok=null;
    if(window._fbUser) try{ tok=await window._fbUser.getIdToken(false); }catch(e){}
    const q=tok?'?auth='+tok:'';
    const r=await fetch(`${LOG_DB}.json${q}`);
    if(!r.ok){ el.innerHTML='<span style="color:#c62828">שגיאה: '+r.status+'</span>'; return; }
    const raw=await r.json()||{};
    const cutoff = filter==='day'?Date.now()-86400000:filter==='week'?Date.now()-604800000:Date.now()-2592000000;
    let entries=Object.entries(raw)
      .map(([k,v])=>v)
      .filter(v=>v&&v.ts>=cutoff)
      .sort((a,b)=>b.ts-a.ts)
      .slice(0,200);
    if(!entries.length){ el.innerHTML='<span style="color:#999;font-size:.78rem">אין שינויים בתקופה זו</span>'; return; }
    const actionIcon={status:'📋',move:'📅',new:'➕',delete:'🗑️',edit:'✏️',invoice:'💰',cancel:'❌'};
    el.innerHTML=`<table style="width:100%;border-collapse:collapse;font-size:.8rem">
      <thead><tr style="background:#f0f0ff;position:sticky;top:0">
        <th style="padding:6px 10px;text-align:right">זמן</th>
        <th style="padding:6px 10px;text-align:right">משתמש</th>
        <th style="padding:6px 10px;text-align:right">פעולה</th>
        <th style="padding:6px 10px;text-align:right">נושא</th>
        <th style="padding:6px 10px;text-align:right">פרט</th>
      </tr></thead>
      <tbody>`+entries.map((e,i)=>{
        const d=new Date(e.ts);
        const tStr=d.getDate()+'/'+(d.getMonth()+1)+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
        const bg=i%2===0?'#fff':'#f8f8ff';
        return `<tr style="background:${bg};border-bottom:1px solid #eee">
          <td style="padding:5px 10px;color:#546e7a;white-space:nowrap">${tStr}</td>
          <td style="padding:5px 10px;font-weight:700;color:#1a237e">${e.user||'—'}</td>
          <td style="padding:5px 10px">${actionIcon[e.action]||'•'} ${e.action||''}</td>
          <td style="padding:5px 10px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.target||''}</td>
          <td style="padding:5px 10px;color:#2e7d32;font-weight:600">${e.detail||''}</td>
        </tr>`;
      }).join('')+'</tbody></table>';

    // Auto-prune entries older than 30 days
    _pruneOldLogs(raw, tok).catch(()=>{});
  } catch(e){ el.innerHTML='<span style="color:#c62828">שגיאה: '+e.message+'</span>'; }
}

async function _pruneOldLogs(raw, tok){
  const cutoff30 = Date.now()-2592000000;
  const q=tok?'?auth='+tok:'';
  for(const [k,v] of Object.entries(raw)){
    if(v&&v.ts<cutoff30){
      await fetch(`${LOG_DB}/${k}.json${q}`,{method:'DELETE'});
    }
  }
}

function doLogout(){
  if(!confirm('להתנתק?')) return;
  if(typeof window._fbSignOut==='function') window._fbSignOut();
}

async function updateUserPerm(uid, perm, value){
  if(!_isAdmin()) return;
  try{
    const q=await _authQ();
    await fetch(`${USERS_DB}/${uid}/${perm}.json${q}`,{
      method:'PUT', headers:{'Content-Type':'application/json'},
      body:JSON.stringify(value)
    });
    showToast('✅ הרשאה עודכנה');
  } catch(e){ showToast('❌ שגיאה: '+e.message); }
}

async function changeUserPassword(uid, username){
  if(!_isAdmin()) return;
  const newPass = prompt(`סיסמה חדשה עבור "${username}" (לפחות 6 תווים):`);
  if(!newPass) return;
  if(newPass.length < 6){ showToast('❌ סיסמה קצרה מדי (לפחות 6 תווים)'); return; }

  // Strategy: save new password hash to RTDB
  // On next login, Firebase Auth updatePassword is called if user changes their own
  // For admin resetting: store plaintext temporarily in RTDB (admin-only node)
  // User will be required to change on next login
  try{
    showToast('⏳ משנה סיסמה...');
    let tok2=null;
    if(window._fbUser) try{ tok2=await window._fbUser.getIdToken(false); }catch(e){}
    try {
      const endpoints = ['/api/changePassword', 'https://changepassword-graclk45jq-uc.a.run.app'];
      let passRes = null;
      let lastErr = null;
      for (const url of endpoints) {
        try {
          const r = await fetch(url, {
            method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok2},
            body:JSON.stringify({uid, newPassword:newPass})
          });
          passRes = r;
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!passRes) throw lastErr || new Error('שגיאה בתקשורת עם השרת');
      if(!passRes.ok){ 
        let e = {error: 'Unknown error'};
        try { e = await passRes.json(); } catch(je) {}
        throw new Error(e.error||'שגיאה מהשרת'); 
      }
    } catch(err) {
       throw new Error('שגיאה בתקשורת עם שרת ההזדהות: ' + (err.message || 'שגיאה כללית'));
    }
    showToast(`✅ סיסמה שונתה עבור "${username}"`);
    _spAlertDialog(`✅ הסיסמה של "${username}" שונתה בהצלחה.\n\nסיסמה חדשה: ${newPass}`);
  } catch(e){ showToast('❌ שגיאה: '+e.message); }
}
async function fixData() {
  if (!confirm('🛠️ "סופר תיקון" נתונים:\n1. מחיקת מטמון מקומי.\n2. טעינה מחדש מהענן.\n3. איחוד כפילויות אגרסיבי.\n4. שמירה סופית לענן.\n\nלהמשיך?')) return;
  
  try {
    window.showCopyToast('⏳ מנקה מטמון וטוען מהענן...');
    localStorage.removeItem('ganv5');
    localStorage.removeItem('_fbSeq');
    window._localSeq = 0;
    
    // Force load from cloud (ignoring local)
    await window.load(true, true);
    
    window.showCopyToast('⏳ מבצע איחוד כפילויות עמוק...');
    if (window.DataManager && window.DataManager.cleanupDuplicates) {
      window.DataManager.cleanupDuplicates();
    }
    
    window.showCopyToast('⏳ שומר גרסה נקייה לענן...');
    const ok = await window.save(true, true);
    
    if (ok) {
      _spAlertDialog('✅ הנתונים תוקנו וסונכרנו! המערכת תתרענן כעת.');
      location.reload();
    } else {
      _spAlertDialog('❌ השמירה נכשלה. נסה שוב מאוחר יותר.');
    }
  } catch(e) {
    console.error(e);
    _spAlertDialog('❌ שגיאה בתהליך התיקון: ' + e.message);
  }
}
async function nuclearReset() {
  if (!confirm('☢️ מחיקה מוחלטת (Nuclear Reset):\nפעולה זו תמחק את כל השינויים, הייבואים והנתונים מהענן ותחזיר את המערכת למצב ברירת מחדל (SRAWS).\n\nהאם אתה בטוח לחלוטין?')) return;
  if (!confirm('⚠️ אזהרה אחרונה: כל המידע בענן יימחק!')) return;
  
  try {
    window.showCopyToast('⏳ מוחק נתונים מהענן...');
    // 1. Reset to base SRAWS
    window.SCH = SRAWS.map(s => ({...s, st:'ok', nt:s.n||'', grp:1}));
    window.pairs = [];
    window.supEx = {};
    
    // 2. Force save this "Empty" state
    const ok = await window.save(true, true);
    
    if (ok) {
      _spAlertDialog('✅ המערכת אופסה לחלוטין! המטמון המקומי יימחק כעת.');
      localStorage.removeItem('ganv5');
      localStorage.removeItem('_fbSeq');
      location.reload();
    } else {
      _spAlertDialog('❌ המחיקה נכשלה.');
    }
  } catch(e) {
    _spAlertDialog('❌ שגיאה: ' + e.message);
  }
}
window.nuclearReset = nuclearReset;
window.fixData = fixData;

window.deleteYearPrompt = async function() {
  if (!_isAdmin()) return;
  const metaStr = window._safeLS.getItem('ganv5_meta');
  let meta = metaStr ? JSON.parse(metaStr) : null;
  if (!meta || !meta.years || Object.keys(meta.years).length === 0) {
    _spAlertDialog('אין תקופות זמינות למחיקה (חוץ מברירת המחדל).');
    return;
  }
  
  const currentId = meta.currentYear || 'tashpav';
  const availableYears = Object.entries(meta.years).map(([id, y]) => `${id}: ${y.name}`).join('\n');
  
  const idToDelete = prompt(`הזן את מזהה התקופה שברצונך למחוק (באנגלית, למשל tashpaz).\nהתקופה הנוכחית היא: ${currentId}\n\nתקופות קיימות:\n${availableYears}`);
  
  if (!idToDelete) return;
  if (!meta.years[idToDelete]) {
    _spAlertDialog(`שגיאה: תקופה עם מזהה "${idToDelete}" לא קיימת.`);
    return;
  }
  if (idToDelete === 'tashpav') {
     if (!confirm('אזהרה: אתה מנסה למחוק את שנת הלימודים הראשית "tashpav"! האם אתה בטוח שברצונך למחוק אותה?')) return;
  } else {
     if (!confirm(`האם אתה בטוח לחלוטין שברצונך למחוק את התקופה "${meta.years[idToDelete].name}" (${idToDelete})?\nכל השיבוצים, הגנים, החופשות והזוגות של תקופה זו יימחקו מהענן! פעולה זו אינה הפיכה!`)) return;
  }
  
  try {
    let tok = null;
    if (window._fbUser) try { tok = await window._fbUser.getIdToken(true); } catch(e) {}
    if (!tok) { _spAlertDialog('שגיאת אימות — יש להתחבר מחדש.'); return; }
    
    if (window.showCopyToast) window.showCopyToast('⏳ מוחק את התקופה מהענן...');
    const base = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';
    
    // 1. Delete from /years node
    const r = await fetch(`${base}/years/${idToDelete}.json?auth=${tok}`, {
      method: 'DELETE'
    });
    if (!r.ok) throw new Error('Firebase DELETE failed: ' + r.status);
    
    // 2. Remove from local meta
    delete meta.years[idToDelete];
    if (meta.currentYear === idToDelete) {
       meta.currentYear = Object.keys(meta.years)[0] || 'tashpav';
    }
    window._safeLS.setItem('ganv5_meta', JSON.stringify(meta));
    window._safeLS.removeItem('ganv5_y_' + idToDelete);
    
    // 3. Update meta in cloud
    try {
      await fetch(`${base}/years_meta.json?auth=${tok}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(meta)
      });
    } catch(e) {
      console.warn('Failed to update meta in Firebase:', e);
    }
    
    // Refresh year selector
    if (window.initYearSelector) window.initYearSelector();
    if (window.changeCurrentYear) {
      window.changeCurrentYear(meta.currentYear);
    } else {
      location.reload();
    }
    
    _spAlertDialog(`✅ התקופה ${idToDelete} נמחקה בהצלחה!`);
  } catch(e) {
    _spAlertDialog('❌ שגיאה במחיקה: ' + e.message);
  }
};

// ══════════════════════════════════════════════════════
// Set Global Active Year for Non-Admins
// ══════════════════════════════════════════════════════
window._initGlobalYearSelector = async function() {
  const sel = document.getElementById('global-year-selector');
  if (!sel) return;
  try {
    const metaStr = window._safeLS.getItem('ganv5_meta');
    if (!metaStr) return;
    const meta = JSON.parse(metaStr);
    const yearKeys = Object.keys(meta.years || {});
    sel.innerHTML = '';
    yearKeys.forEach(k => {
      const v = meta.years[k];
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = v.name || k;
      sel.appendChild(opt);
    });
    
    // Fetch current global year
    const user = window._fbUser;
    if (user) {
      const token = await user.getIdToken(false);
      const url = `https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/years_meta/currentYear.json?auth=${token}`;
      const res = await fetch(url);
      if (res.ok) {
        const globalYear = await res.json();
        if (globalYear) sel.value = globalYear;
      }
    }
  } catch(e) {}
};

window.setGlobalActiveYear = async function() {
  const sel = document.getElementById('global-year-selector');
  if (!sel) return;
  const targetYear = sel.value;
  if (!targetYear) return;
  
  if (!confirm(`האם אתה בטוח שברצונך להגדיר את ${sel.options[sel.selectedIndex].text} כשנה הפעילה עבור כל הרכזים ועובדי השטח במערכת?`)) return;
  
  try {
    const user = window._fbUser;
    if (!user) throw new Error('משתמש לא מחובר');
    const token = await user.getIdToken(false);
    
    // Update years_meta/currentYear
    const url = `https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/years_meta/currentYear.json?auth=${token}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(targetYear)
    });
    
    if (res.ok) {
      const statusEl = document.getElementById('global-year-status');
      if (statusEl) {
        statusEl.innerHTML = '✅ נשמר בהצלחה!';
        setTimeout(() => statusEl.innerHTML = '', 3000);
      }
      _spAlertDialog(`✅ השנה הגלובלית עודכנה בהצלחה ל-${sel.options[sel.selectedIndex].text}! כל הרכזים והעובדים יראו כעת שנה זו כברירת מחדל.`);
    } else {
      const err = await res.text();
      throw new Error(`שגיאת הרשאות או שרת: ${res.status} ${err}`);
    }
  } catch(e) {
    _spAlertDialog('❌ שגיאה בעדכון השנה הגלובלית: ' + e.message);
  }
};

// ══════════════════════════════════════════════════════
// New Year Wizard — Creates a new school year in Firebase
// ══════════════════════════════════════════════════════

// Hebrew year names map
const _HEBREW_YEARS = {
  'tashpav': 'תשפ"ו (2025-2026)',
  'tashpaz': 'תשפ"ז (2026-2027)',
  'tashpach': 'תשפ"ח (2027-2028)',
  'tashpat': 'תשפ"ט (2028-2029)',
  'tashtzain': 'תש"צ (2029-2030)'
};

function _getNextYearId() {
  const order = ['tashpav','tashpaz','tashpach','tashpat','tashtzain'];
  const curIdx = order.indexOf(window.CURRENT_YEAR || 'tashpav');
  return curIdx >= 0 && curIdx < order.length - 1 ? order[curIdx + 1] : null;
}

function _getNextYearDates(yearId) {
  const map = {
    'tashpaz': { start: '2026-09-01', end: '2027-08-21' },
    'tashpach': { start: '2027-09-01', end: '2028-08-21' },
    'tashpat': { start: '2028-09-01', end: '2029-08-21' },
    'tashtzain': { start: '2029-09-01', end: '2030-08-21' }
  };
  return map[yearId] || { start: '', end: '' };
}

window.openNewYearWizard = function() {
  if (!_isAdmin()) { showToast('❌ רק מנהל יכול לפתוח שנה חדשה'); return; }
  
  const nextId = _getNextYearId() || '';
  const dates = nextId ? _getNextYearDates(nextId) : { start: '', end: '' };
  const suggestedName = nextId ? (_HEBREW_YEARS[nextId] || '') : '';
  
  const m = document.getElementById('newyear-m');
  if (!m) { _spAlertDialog('Modal not found'); return; }
  
  // Fill inputs
  const nameEl = document.getElementById('nyw-custom-name');
  if (nameEl) nameEl.value = suggestedName;
  
  const idEl = document.getElementById('nyw-custom-id');
  if (idEl) idEl.value = nextId;
  
  const fromEl = document.getElementById('nyw-custom-start');
  if (fromEl) fromEl.value = dates.start || '';
  
  const toEl = document.getElementById('nyw-custom-end');
  if (toEl) toEl.value = dates.end || '';
  
  // Build garden checkbox list grouped by city
  const allGardens = typeof AG === 'function' ? AG() : [...(window.GARDENS||[]), ...(window._GARDENS_EXTRA||[])];
  const byCity = {};
  allGardens.forEach(g => {
    const city = g.city || 'אחר';
    if (!byCity[city]) byCity[city] = [];
    byCity[city].push(g);
  });
  
  const listEl = document.getElementById('nyw-garden-list');
  if (listEl) {
    let html = '<div style="display:flex;gap:8px;margin-bottom:10px">' +
      '<button class="btn bg bsm" onclick="document.querySelectorAll(\'#nyw-garden-list input[type=checkbox]\').forEach(c=>c.checked=true)">✅ בחר הכל</button>' +
      '<button class="btn br2 bsm" onclick="document.querySelectorAll(\'#nyw-garden-list input[type=checkbox]\').forEach(c=>c.checked=false)">❌ בטל הכל</button>' +
      '</div>';
    
    const cities = Object.keys(byCity).sort((a,b) => a.localeCompare(b,'he'));
    cities.forEach(city => {
      const gardens = byCity[city].sort((a,b) => a.name.localeCompare(b.name,'he'));
      html += `<div style="margin-bottom:10px">
        <div style="font-weight:700;font-size:.82rem;color:#1a237e;margin-bottom:5px;border-bottom:1px solid #e8eaf6;padding-bottom:3px">
          📍 ${city} (${gardens.length})
          <button style="font-size:.65rem;background:none;border:none;color:#1565c0;cursor:pointer;margin-right:6px" 
            onclick="this.closest('div').querySelectorAll('input[type=checkbox]').forEach(c=>c.checked=true)">בחר עיר</button>
          <button style="font-size:.65rem;background:none;border:none;color:#c62828;cursor:pointer" 
            onclick="this.closest('div').querySelectorAll('input[type=checkbox]').forEach(c=>c.checked=false)">בטל עיר</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px">`;
      gardens.forEach(g => {
        html += `<label style="display:flex;align-items:center;gap:5px;font-size:.78rem;cursor:pointer;padding:2px 4px;border-radius:4px;transition:background .15s" 
          onmouseover="this.style.background='#e8f5e9'" onmouseout="this.style.background=''">
          <input type="checkbox" checked value="${g.id}" name="nyw-garden" style="accent-color:#2e7d32"> ${g.name}
        </label>`;
      });
      html += '</div></div>';
    });
    listEl.innerHTML = html;
  }
  m.classList.add('open');
};

window.executeNewYear = async function() {
  const yearIdInput = document.getElementById('nyw-custom-id');
  const yearNameInput = document.getElementById('nyw-custom-name');
  const startInput = document.getElementById('nyw-custom-start');
  const endInput = document.getElementById('nyw-custom-end');
  
  const yearId = yearIdInput?.value.trim().toLowerCase();
  const yearName = yearNameInput?.value.trim();
  const startDate = startInput?.value;
  const endDate = endInput?.value;
  
  if (!yearId) { _spAlertDialog('שגיאה: יש להזין מזהה ייחודי באנגלית.'); return; }
  if (!/^[a-z0-9_-]+$/.test(yearId)) { _spAlertDialog('שגיאה: המזהה יכול להכיל אותיות באנגלית, מספרים, מקף או קו תחתון בלבד.'); return; }
  if (!yearName) { _spAlertDialog('שגיאה: יש להזין שם לתקופה/שנה.'); return; }
  if (!startDate || !endDate) { _spAlertDialog('שגיאה: יש להזין תאריכי התחלה וסיום.'); return; }
  if (new Date(startDate) > new Date(endDate)) { _spAlertDialog('שגיאה: תאריך ההתחלה לא יכול להיות אחרי תאריך הסיום.'); return; }
  
  // Check if already exists in metadata
  const metaStr = window._safeLS.getItem('ganv5_meta');
  let meta = metaStr ? JSON.parse(metaStr) : { currentYear: 'tashpav', years: { 'tashpav': { name: 'תשפ"ו (2025-2026)', start: '2025-09-01', end: '2026-08-21' } } };
  if (meta.years[yearId]) {
    _spAlertDialog(`שגיאה: מזהה "${yearId}" כבר קיים במערכת.`);
    return;
  }
  
  if (!confirm(`האם ליצור את "${yearName}"?\n\nהגנים המסומנים יועברו לתקופה החדשה.\nהשיבוצים יתאפסו.\nהרכש נשאר גלובלי ולא מושפע.`)) return;
  
  const execBtn = document.getElementById('nyw-exec-btn');
  if (execBtn) { execBtn.disabled = true; execBtn.textContent = '⏳ יוצר תקופה...'; }
  
  try {
    // 1. Collect selected gardens
    const checks = document.querySelectorAll('#nyw-garden-list input[name="nyw-garden"]:checked');
    const selectedGardenIds = new Set([...checks].map(c => parseInt(c.value)));
    
    // Build full garden objects from current gardens
    const allGardens = typeof AG === 'function' ? AG() : [...(window.GARDENS||[]), ...(window._GARDENS_EXTRA||[])];
    const gardensForNewYear = allGardens.filter(g => selectedGardenIds.has(g.id));
    
    if (gardensForNewYear.length === 0) {
      _spAlertDialog('יש לבחור לפחות גן אחד!');
      if (execBtn) { execBtn.disabled = false; execBtn.textContent = '🚀 פתח תקופה/קייטנה חדשה'; }
      return;
    }
    
    // 2. Build pairs (only those with ALL gardens selected)
    const currentPairs = window.pairs || [];
    const newPairs = currentPairs
      .map(p => ({...p, ids: p.ids.filter(id => selectedGardenIds.has(parseInt(id)))}))
      .filter(p => p.ids.length >= 2);
    
    // 3. Build supEx — deep copy, add __gardens_all
    const newSupEx = JSON.parse(JSON.stringify(window.supEx || {}));
    newSupEx.__gardens_all = gardensForNewYear;
    // Remove specific keys
    delete newSupEx.__deleted_sraws_ids;
    delete newSupEx.__phonesVer;
    
    // 4. Build the new period state
    const newState = {
      data: {
        ch: [],  // Empty schedule
        pairs: newPairs,
        supEx: newSupEx,
        clusters: (() => {
          const filtered = {};
          Object.entries(window.clusters || {}).forEach(([key, cl]) => {
            // Skip temporary clusters (those with validFrom/validTo)
            if (cl.validFrom || cl.validTo) return;
            // Only keep gardens that the user selected
            const filteredGids = (cl.gardenIds || []).filter(id => selectedGardenIds.has(parseInt(id)));
            if (filteredGids.length >= 2) {
              filtered[key] = { ...cl, gardenIds: filteredGids };
            }
          });
          return filtered;
        })(),
        holidays: [],
        pairBreaks: {},
        managers: (() => {
          const copied = JSON.parse(JSON.stringify(window.managers || {}));
          Object.values(copied).forEach(m => {
            if (m.gardenIds) {
              m.gardenIds = m.gardenIds.filter(id => selectedGardenIds.has(parseInt(id)));
            }
          });
          return copied;
        })(),
        blockedDates: {},
        gardenBlocks: {},
        activeGardens: [...selectedGardenIds],
        useSraws: false,  // New periods always use direct mode
        spScannerAliases: JSON.parse(JSON.stringify(window.spScannerAliases || {})),
        spScannerFolderLinks: JSON.parse(JSON.stringify(window.spScannerFolderLinks || {}))
      },
      ts: Date.now(),
      seq: 1,
      version: '3.0'
    };
    
    // 5. Save to Firebase
    let tok = null;
    if (window._fbUser) try { tok = await window._fbUser.getIdToken(true); } catch(e) {}
    if (!tok) { _spAlertDialog('שגיאת אימות — יש להתחבר מחדש.'); if (execBtn) { execBtn.disabled = false; execBtn.textContent = '🚀 פתח תקופה/קייטנה חדשה'; } return; }
    
    const base = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';
    const url = `${base}/years/${yearId}/data.json?auth=${tok}`;
    
    showToast('⏳ שומר תקופה חדשה לענן...');
    const r = await fetch(url, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(newState)
    });
    
    if (!r.ok) throw new Error('Firebase PUT failed: ' + r.status);
    
    // 6. Update meta in localStorage
    meta.years[yearId] = { name: yearName, start: startDate, end: endDate };
    window._safeLS.setItem('ganv5_meta', JSON.stringify(meta));
    
    // Save years metadata globally to Firebase
    try {
      const metaUrl = `${base}/years_meta.json?auth=${tok}`;
      await fetch(metaUrl, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(meta)
      });
    } catch(e) {
      console.warn('Failed to save years metadata to Firebase:', e);
    }
    
    // 7. Also save to localStorage for the new year
    window._safeLS.setItem('ganv5_y_' + yearId, JSON.stringify(newState.data));
    
    // 8. Close modal
    const m = document.getElementById('newyear-m');
    if (m) m.classList.remove('open');
    
    // 9. Refresh year selector
    if (window.initYearSelector) window.initYearSelector();
    
    _spAlertDialog(`✅ התקופה/קייטנה "${yearName}" נוצרה בהצלחה!\n\n${gardensForNewYear.length} גנים הועברו.\n${newPairs.length} זוגות הועברו.\n\nכדי לעבור לתקופה החדשה, בחר אותה מתפריט השנה בראש המסך.`);
    showToast('✅ שנה/תקופה חדשה נוצרה — עבור דרך בורר השנה');
    
  } catch(e) {
    console.error('Creation failed:', e);
    _spAlertDialog('❌ שגיאה ביצירת התקופה: ' + e.message);
  } finally {
    if (execBtn) { execBtn.disabled = false; execBtn.textContent = '🚀 פתח תקופה/קייטנה חדשה'; }
  }
};

// Legacy aliases
window.startNewYearWizard = window.openNewYearWizard;
