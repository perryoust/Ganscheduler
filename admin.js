// ══════════════════════════════════════════════════════
// Daily Firebase Backup — saves to backups/YYYY-MM-DD
// Max 30 days kept. Runs once per day after successful save.
// ══════════════════════════════════════════════════════
const BACKUP_DB_BASE = 'https://ganmanage-default-rtdb.europe-west1.firebasedatabase.app/backups';
const BACKUP_LAST_KEY = '_fbDailyBackupDate';

async function _runDailyBackupIfNeeded(liveData, tok){
  try{
    const today = d2s(new Date());
    const lastBackup = _safeLS.get(BACKUP_LAST_KEY)||'';
    if(lastBackup === today) return; // already backed up today

    const authQ = tok ? '?auth='+tok : '';

    // 1. Write today's backup
    const backupUrl = `${BACKUP_DB_BASE}/${today}.json${authQ}`;
    // Exclude invoices from backup (too large — saved separately in /data/invoices)
    const _backupData = {...liveData};
    delete _backupData.invoices;
    const _now = new Date();
    const _timeStr = _now.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});
    const payload = { data: _backupData, ts: Date.now(), time: _timeStr, version: '10.2' };
    const r = await fetch(backupUrl, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if(!r.ok){ console.warn('Backup failed:', r.status); return; }

    // 2. Mark done
    _safeLS.setItem(BACKUP_LAST_KEY, today);
    console.log('✅ Daily backup saved:', today);

    // 3. Prune backups older than 30 days
    const listR = await fetch(`${BACKUP_DB_BASE}.json?shallow=true${tok?'&auth='+tok:''}`);
    if(listR.ok){
      const keys = Object.keys(await listR.json()||{});
      const cutoff = d2s(addD(new Date(), -30));
      const toDelete = keys.filter(k=>k<cutoff);
      for(const k of toDelete){
        await fetch(`${BACKUP_DB_BASE}/${k}.json${authQ}`, {method:'DELETE'});
        console.log('🗑️ Deleted old backup:', k);
      }
    }
  } catch(e){ console.warn('Daily backup error:', e.message); }
}

async function loadCloudBackups(){
  const el=document.getElementById('cloud-backup-list');
  const btn=document.getElementById('cloud-backup-btn');
  if(!el) return;
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
    const today=d2s(new Date());
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
          <span style="font-weight:700;font-size:.82rem">${fD(k)}</span>
          ${time?`<span style="font-size:.7rem;color:#546e7a;margin-right:6px">🕐 ${time}</span>`:''}
          ${k===today?'<span style="font-size:.68rem;background:#2e7d32;color:#fff;border-radius:8px;padding:1px 6px;margin-right:5px">היום</span>':''}
        </div>
        <button class="btn bp bsm" onclick="restoreCloudBackup('${k}')">🔄 שחזר</button>
      </div>`).join('')+'</div>';
  } catch(e){ el.innerHTML='<span style="color:#c62828">שגיאה: '+e.message+'</span>'; }
  if(btn) btn.disabled=false;
}

async function restoreCloudBackup(dateKey){
  if(!confirm(`לשחזר גיבוי מ-${fD(dateKey)}?\nהנתונים הנוכחיים יישמרו תחילה כ-snapshot מקומי.`)) return;
  const el=document.getElementById('cloud-backup-list');
  if(el) el.innerHTML='<span style="color:#e65100">משחזר...</span>';
  try{
    let tok=null;
    if(window._fbUser) try{ tok=await window._fbUser.getIdToken(false); }catch(e){}
    const authQ=tok?'?auth='+tok:'';
    const r=await fetch(`${BACKUP_DB_BASE}/${dateKey}.json${authQ}`);
    if(!r.ok){ showToast('❌ שגיאה בטעינת גיבוי: '+r.status); return; }
    const backup=await r.json();
    const appData=backup.data||backup;
    if(!appData||!appData.ch){ showToast('❌ גיבוי פגום'); return; }
    // Save current as local snapshot first
    createSnapshot('לפני שחזור מענן');
    // Apply the backup data
    _applyYearData(appData);
    save(true);
    showToast('✅ שוחזר מגיבוי '+fD(dateKey)+' — שומר...');
    setTimeout(()=>{ refresh(); CM('backupm'); }, 1500);
  } catch(e){ showToast('❌ שגיאת שחזור: '+e.message); }
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
const ADMIN_UID = 'NflZLysieCdmx21KJEfDYx014Op2';
const USERS_DB  = 'https://ganmanage-default-rtdb.europe-west1.firebasedatabase.app/users';

function _isAdmin(){ return window._fbUser?.uid === ADMIN_UID; }

// Show users button only for admin
window._initUsersUI = function _initUsersUI(){
  const isAdm = _isAdmin();
  // Admin button in mode bar
  const adminModeBtn = document.getElementById('modeBtn-admin');
  if(adminModeBtn) adminModeBtn.style.display = isAdm ? '' : 'none';
  // Legacy buttons
  const btn = document.getElementById('users-mgmt-btn');
  if(btn) btn.style.display = isAdm ? 'inline-flex' : 'none';
  const hBtn = document.getElementById('users-hdr-btn');
  if(hBtn) hBtn.style.display = isAdm ? '' : 'none';
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
          </div>
          <div>
            <div style="font-size:.68rem;color:#546e7a;margin-bottom:4px;font-weight:700">רמת גישה:</div>
            <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;cursor:pointer;margin-bottom:3px">
              <input type="radio" name="role_${uid}" value="view" ${u.role!=='edit'?'checked':''} onchange="changeUserRole('${uid}','view')"> 👁️ צפייה בלבד
            </label>
            <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;cursor:pointer">
              <input type="radio" name="role_${uid}" value="edit" ${u.role==='edit'?'checked':''} onchange="changeUserRole('${uid}','edit')"> ✏️ עריכה
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
  const role=document.querySelector('input[name="nu-access"]:checked')?.value||'view';
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
      body:JSON.stringify({uid,username,name:displayName,role,email,permAct,permPurch,createdAt:Date.now()})
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
    const delRes = await fetch('https://deleteuser-graclk45jq-uc.a.run.app',{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
      body:JSON.stringify({uid})
    });
    if(!delRes.ok){ const e=await delRes.json(); throw new Error(e.error||'שגיאה'); }
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
          body:JSON.stringify({uid:ADMIN_UID,username:'perry',name:'Perry',role:'admin',email:'perry@ganmanager.app'})
        });
      }
    }
  } catch(e){}
  _initUsersUI();
}

// ══════════════════════════════════════════════════════
// Activity Log — track changes by all users, 30 days
// ══════════════════════════════════════════════════════
const LOG_DB = 'https://ganmanage-default-rtdb.europe-west1.firebasedatabase.app/activityLog';

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
    const passRes = await fetch('https://changepassword-graclk45jq-uc.a.run.app',{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok2},
      body:JSON.stringify({uid, newPassword:newPass})
    });
    if(!passRes.ok){ const e=await passRes.json(); throw new Error(e.error||'שגיאה'); }
    showToast(`✅ סיסמה שונתה עבור "${username}"`);
    alert(`✅ הסיסמה של "${username}" שונתה בהצלחה.\n\nסיסמה חדשה: ${newPass}`);
  } catch(e){ showToast('❌ שגיאה: '+e.message); }
}
