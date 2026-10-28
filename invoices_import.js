// ── Excel Import ─────────────────────────────────────────────────────────────
function openImportInvoicesModal(){
  const ov = document.createElement('div');
  ov.id = 'import-inv-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:22px;max-width:480px;width:96%;box-shadow:0 8px 32px rgba(0,0,0,.25);direction:rtl">
      <div style="font-weight:800;color:#1a237e;font-size:.95rem;margin-bottom:10px">📥 ייבוא חשבוניות מקובץ JSON</div>
      <div style="background:#e3f2fd;border-radius:8px;padding:10px 13px;font-size:.78rem;color:#0d47a1;margin-bottom:14px;line-height:1.8">
        <b>הוראות:</b><br>
        1. בחר את קובץ ה-JSON שהורדת<br>
        2. מסמכים עם מספר הזמנה זהה לא יוחלפו<br>
        3. ספקים חדשים יתווספו אוטומטית כספקי רכש
      </div>
      <input type="file" id="import-inv-file" accept=".json" style="width:100%;margin-bottom:10px;font-size:.82rem">
      <div id="import-inv-status" style="font-size:.78rem;color:#546e7a;min-height:20px;margin-bottom:10px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="import-inv-cancel" class="btn bs bsm">ביטול</button>
        <button id="import-inv-go" class="btn bg">📥 ייבא</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#import-inv-cancel').addEventListener('click',()=>_removeOverlay('import-inv-overlay'));
  ov.querySelector('#import-inv-go').addEventListener('click', ()=>_doImportInvoices(ov));
}

async function _doImportInvoices(ov){
  const fileEl = ov.querySelector('#import-inv-file');
  const status = ov.querySelector('#import-inv-status');
  if(!fileEl.files[0]){ status.textContent='⚠️ בחר קובץ JSON'; return; }
  status.textContent='⏳ קורא קובץ...';
  const text = await fileEl.files[0].text();
  let imported;
  try { imported = JSON.parse(text); } catch(e){ status.textContent='❌ קובץ לא תקין'; return; }
  if(!Array.isArray(imported)){ status.textContent='❌ הקובץ לא מכיל רשימת מסמכים'; return; }

  // Build duplicate keys: supName+txNum or supName+taxNum
  const dupKeys = new Set();
  window.INVOICES.forEach(i=>{
    const sup = (i.supName||'').trim().toLowerCase();
    if(sup && i.txNum) dupKeys.add(sup+'|tx|'+(i.txNum||'').trim().toLowerCase());
    if(sup && i.num)   dupKeys.add(sup+'|tax|'+(i.num||'').trim().toLowerCase());
  });
  const existingSupNames = new Set(window.getAllSup().map(s=>s.name.toLowerCase().trim()));
  const existingOrderNums = new Set();
  window.INVOICES.forEach(i=>{ if(i.orderNum) existingOrderNums.add(i.orderNum); });

  let added=0, skipped=0, suppAdded=0;
  const newInvoices = [];
  const newSuppliers = [];

  for(const inv of imported){
    // Duplicate check: supName + txNum OR supName + taxNum
    const sup = (inv.supName||'').trim().toLowerCase();
    const txKey  = sup && inv.txNum ? sup+'|tx|' +(inv.txNum||'').trim().toLowerCase()  : null;
    const taxKey = sup && inv.num   ? sup+'|tax|'+(inv.num||'').trim().toLowerCase()    : null;
    if((txKey && dupKeys.has(txKey)) || (taxKey && dupKeys.has(taxKey))){
      skipped++; continue;
    }
    // Register new keys to avoid intra-batch duplicates
    if(txKey)  dupKeys.add(txKey);
    if(taxKey) dupKeys.add(taxKey);
    // Assign fresh ID
    inv.id = Date.now() + added + Math.floor(Math.random()*1000);
    inv.recv = inv.recv || new Date().toISOString().slice(0,10);

    // Auto-fix/recalculate VAT for imported invoice based on supplier entity type
    const vat = inv.vat || window.VAT_RATE || 18;
    const supName = inv.supName || '';
    const et = (window.supEx && window.supEx[supName]) ? window.supEx[supName].entityType : '';
    const isExempt = et==='עוסק פטור' || et==='עמותה';
    const effectiveVat = isExempt ? 0 : vat;
    inv.vat = effectiveVat;

    if (inv.orderTotal) {
      inv.orderAmt = +(inv.orderTotal / (1 + effectiveVat/100)).toFixed(2);
      inv.orderVat = +(inv.orderTotal - inv.orderAmt).toFixed(2);
    }
    if (inv.txTotal) {
      inv.txAmt = +(inv.txTotal / (1 + effectiveVat/100)).toFixed(2);
      inv.txVat = +(inv.txTotal - inv.txAmt).toFixed(2);
    }
    if (inv.total) {
      inv.amt = +(inv.total / (1 + effectiveVat/100)).toFixed(2);
      inv.vatAmt = +(inv.total - inv.amt).toFixed(2);
    }

    newInvoices.push(inv);
    existingOrderNums.add(inv.orderNum||'');
    added++;

    // Check if supplier exists — if not, add as purch supplier
    const supKey = (inv.supName||'').toLowerCase().trim();
    if(supKey && !existingSupNames.has(supKey)){
      existingSupNames.add(supKey);
      const newSup = {
        id: Date.now() + suppAdded + 90000,
        name: inv.supName,
        isPurch: true,
        isAct: false,
        phone1:'', phone2:'', email:'', entityType:'',
        notes:''
      };
      newSuppliers.push(newSup);
      suppAdded++;
    }
  }

  // Merge into app data
  window.INVOICES.push(...newInvoices);
  if(newSuppliers.length){
    // Add to SUPBASE
    if(typeof window.SUPBASE !== 'undefined') window.SUPBASE.push(...newSuppliers);
    // Also add to supEx for quick lookup
    newSuppliers.forEach(s=>{ window.supEx[s.name] = s; });
  }

  window.save(true);
  renderInvoices();
  refreshPurchDash();

  status.innerHTML = `✅ <b>${added}</b> מסמכים יובאו, <b>${skipped}</b> דולגו (כפילויות), <b>${suppAdded}</b> ספקים חדשים נוספו`;
  ov.querySelector('#import-inv-go').style.display='none';
  ov.querySelector('#import-inv-cancel').textContent='סגור';
}


// ── Duplicates modal ──────────────────────────────────────────────────────
let _dupFilterActive = false;

function toggleDupFilter(){
  _dupFilterActive = !_dupFilterActive;
  const btn = document.getElementById('pi-dup-btn');
  if(btn){
    btn.style.background = _dupFilterActive ? '#4a148c' : '#7b1fa2';
    btn.textContent = _dupFilterActive ? '🔍 כפילויות ✓' : '🔍 כפילויות';
  }
  renderInvoices();
}

function openDupModal(){
  const ov = document.createElement('div');
  ov.id = 'dup-modal-ov';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  ov.innerHTML=`
    <div style="background:#fff;border-radius:12px;padding:22px;max-width:560px;width:96%;box-shadow:0 8px 32px rgba(0,0,0,.25);direction:rtl;max-height:90vh;overflow-y:auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><div style="font-weight:800;color:#6a1b9a;font-size:.95rem">🔍 איתור כפילויות</div><button id="dup-close-x" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#999">✕</button></div>
      <div style="font-size:.8rem;color:#546e7a;margin-bottom:10px">בחר פרמטרים לזיהוי כפילויות:</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
        <label style="display:flex;align-items:center;gap:8px;font-size:.83rem;cursor:pointer">
          <input type="checkbox" id="dup-by-order" checked> שם ספק + מספר הזמנה
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:.83rem;cursor:pointer">
          <input type="checkbox" id="dup-by-tx" checked> שם ספק + מספר חשבון עסקה
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:.83rem;cursor:pointer">
          <input type="checkbox" id="dup-by-tax" checked> שם ספק + מספר חשבונית מס / קבלה
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:.83rem;cursor:pointer">
          <input type="checkbox" id="dup-fuzzy"> שם ספק דומה (הבדל של תו אחד — רווח/שגיאת כתיב)
        </label>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="dup-cancel" class="btn bs bsm">ביטול</button>
        <button id="dup-go" class="btn" style="background:#6a1b9a;color:#fff">🔍 הצג כפילויות</button>
      </div>
      <div id="dup-results" style="margin-top:16px"></div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#dup-cancel').addEventListener('click',()=>_removeOverlay('dup-modal-ov'));
  ov.querySelector('#dup-close-x').addEventListener('click',()=>_removeOverlay('dup-modal-ov'));
  ov.querySelector('#dup-go').addEventListener('click',()=>_runDupSearch(ov));
}

function _strSimilar(a,b){
  // Levenshtein distance <= 2 (catches extra space, single char typo)
  if(a===b) return true;
  if(Math.abs(a.length-b.length)>3) return false;
  let dp=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=0;i<a.length;i++){
    let prev=i+1;
    for(let j=0;j<b.length;j++){
      const val=a[i]===b[j]?dp[j]:1+Math.min(dp[j],dp[j+1],prev);
      dp[j]=prev; prev=val;
    }
    dp[b.length]=prev;
  }
  return dp[b.length]<=2;
}

async function _runDupSearch(ov){
  const byOrder = ov.querySelector('#dup-by-order').checked;
  const byTx    = ov.querySelector('#dup-by-tx').checked;
  const byTax   = ov.querySelector('#dup-by-tax').checked;
  const fuzzy   = ov.querySelector('#dup-fuzzy').checked;

  // Build groups
  const groups = {}; // groupKey → [inv]

  INVOICES.forEach(inv=>{
    if(inv.notDup) return; // marked as not-duplicate
    const sup = (inv.supName||'').trim().toLowerCase();
    if(!sup) return;
    const keys=[];
    if(byOrder && inv.orderNum && /\d/.test(inv.orderNum))
      keys.push('📋 '+sup+'|'+(inv.orderNum||'').trim().toLowerCase());
    if(byTx && inv.txNum)
      keys.push('🧾 '+sup+'|'+(inv.txNum||'').trim().toLowerCase());
    if(byTax && inv.num)
      keys.push('📑 '+sup+'|'+(inv.num||'').trim().toLowerCase());
    keys.forEach(k=>{
      if(!groups[k]) groups[k]=[];
      groups[k].push(inv);
    });
  });

  // Fuzzy: group supplier names that are similar
  const fuzzyGroups = {};
  if(fuzzy){
    const supNames = [...new Set(INVOICES.map(i=>(i.supName||'').trim()).filter(Boolean))];
    const matched = new Set();
    for(let i=0;i<supNames.length;i++){
      for(let j=i+1;j<supNames.length;j++){
        const a=supNames[i].toLowerCase(), b=supNames[j].toLowerCase();
        if(!matched.has(a+'/'+b) && _strSimilar(a,b)){
          const k='🏢 דומים: '+supNames[i]+' / '+supNames[j];
          fuzzyGroups[k]=[
            ...INVOICES.filter(inv=>(inv.supName||'').trim()===supNames[i]),
            ...INVOICES.filter(inv=>(inv.supName||'').trim()===supNames[j])
          ];
          matched.add(a+'/'+b);
        }
      }
    }
  }

  const allGroups = {...groups, ...fuzzyGroups};
  const dupGroups = Object.entries(allGroups).filter(([,v])=>v.length>1);

  const res = ov.querySelector('#dup-results');
  if(!dupGroups.length){
    res.innerHTML='<div style="text-align:center;color:#2e7d32;padding:16px;font-size:.85rem">✅ לא נמצאו כפילויות לפי הפרמטרים שנבחרו</div>';
    return;
  }

  const _groupIds = dupGroups.map(([,invs])=>invs.map(i=>i.id));
  res.innerHTML=`<div style="font-weight:700;color:#c62828;margin-bottom:10px;font-size:.85rem">נמצאו ${dupGroups.length} קבוצות כפילויות (${dupGroups.reduce((s,[,v])=>s+v.length,0)} מסמכים)</div>`+
    dupGroups.map(([key,invs],gi)=>`
      <div style="background:#fff3e0;border:1px solid #ffb74d;border-radius:8px;padding:10px;margin-bottom:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-weight:700;font-size:.78rem;color:#e65100">${key.split('|')[0]} (${invs.length} מסמכים)</span>
          <div style="display:flex;gap:5px">
            <button data-merge-gi="${gi}" class="dup-merge-btn" style="background:#1565c0;color:#fff;border:none;border-radius:5px;padding:3px 10px;font-size:.72rem;cursor:pointer">⚡ מזג קבוצה</button>
            <button data-notdup-gi="${gi}" class="dup-notdup-btn" style="background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7;border-radius:5px;padding:3px 10px;font-size:.72rem;cursor:pointer">✅ לא כפילות</button>
          </div>
        </div>
        ${invs.map(inv=>`
          <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px dashed #ffe0b2;font-size:.75rem">
            <span style="flex:1;color:#1a237e;font-weight:600">${inv.supName||''}</span>
            <span style="color:#546e7a;font-size:.7rem">${inv.orderNum?'📋 '+inv.orderNum:''} ${inv.txNum?'🧾 '+inv.txNum:''} ${inv.num?'📑 '+inv.num:''}</span>
            <span style="color:#999;font-size:.7rem">${inv.orderDate||inv.txDate||inv.date||''}</span>
            <button data-inv-id="${inv.id}" class="dup-edit-btn" style="background:none;border:1px solid #1565c0;color:#1565c0;border-radius:4px;padding:1px 6px;font-size:.68rem;cursor:pointer">✏️ ערוך</button>
            <button data-inv-id="${inv.id}" class="dup-del-btn" style="background:none;border:1px solid #c62828;color:#c62828;border-radius:4px;padding:1px 6px;font-size:.68rem;cursor:pointer">🗑️ מחק</button>
          </div>`).join('')}
      </div>`).join('');

  // Event delegation for edit / delete / merge
  res.addEventListener('click', async e=>{
    const editBtn  = e.target.closest('.dup-edit-btn');
    const delBtn   = e.target.closest('.dup-del-btn');
    const mergeBtn = e.target.closest('.dup-merge-btn');
    if(editBtn){
      // Open edit modal on top - keep dup modal open in background
      openNewInvoice(parseInt(editBtn.dataset.invId));
      // Raise invoice modal above dup modal
      const _im = document.getElementById('invoice-m');
      if(_im){ _im.style.zIndex='10001'; _im._fromDup=true; }
    } else if(delBtn){
      const id = parseInt(delBtn.dataset.invId);
      if(!await window.spConfirm('למחוק מסמך זה?')) return;
      INVOICES = INVOICES.filter(i=>i.id!==id);
      save(true); renderInvoices(); refreshPurchDash();
      delBtn.closest('div[style*="border-bottom"]').remove();
    } else if(mergeBtn){
      const gi = parseInt(mergeBtn.dataset.mergeGi);
      _openMergeModal(_groupIds[gi]);
    } else if(e.target.closest('.dup-notdup-btn')){
      const gi = parseInt(e.target.closest('.dup-notdup-btn').dataset.notdupGi);
      const ids = _groupIds[gi];
      if(!await window.spConfirm('לסמן ' + ids.length + ' מסמכים כ"לא כפילות"?')) return;
      ids.forEach(id=>{
        const inv = INVOICES.find(i=>i.id===id);
        if(inv) inv.notDup = true;
      });
      save(true);
      // Remove group from view
      e.target.closest('div[style*="background:#fff3e0"]').remove();
    }
  });

}


function _openMergeModal(ids){
  const invs = ids.map(id=>INVOICES.find(i=>i.id===id)).filter(Boolean);
  if(invs.length<2) return;
  const ov2 = document.createElement('div');
  ov2.id='dup-merge-ov';
  ov2.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center';

  const fmtInv = inv=>`
    <div style="background:#f5f5f5;border-radius:8px;padding:10px;font-size:.78rem;line-height:1.8">
      <div style="font-weight:700;color:#1a237e">${inv.supName||''}</div>
      ${inv.orderNum?`<div>📋 הזמנה: <b>${inv.orderNum}</b>${inv.orderDate?' · '+inv.orderDate:''}</div>`:''}
      ${inv.txNum?`<div>🧾 עסקה: <b>${inv.txNum}</b>${inv.txDate?' · '+inv.txDate:''}</div>`:''}
      ${inv.num?`<div>📑 חשבונית: <b>${inv.num}</b>${inv.date?' · '+inv.date:''}</div>`:''}
      ${inv.orderDesc?`<div>📝 ${inv.orderDesc}</div>`:''}
      ${inv.orderTotal?`<div>💰 סהכ: ₪${inv.orderTotal.toLocaleString()}</div>`:''}
      ${inv.notes?`<div>📌 ${inv.notes}</div>`:''}
    </div>`;

  ov2.innerHTML=`
    <div style="background:#fff;border-radius:12px;padding:22px;max-width:700px;width:97%;box-shadow:0 8px 32px rgba(0,0,0,.3);direction:rtl;max-height:90vh;overflow-y:auto">
      <div style="font-weight:800;color:#1565c0;font-size:.95rem;margin-bottom:14px">⚡ מיזוג כפילויות</div>
      <div style="font-size:.8rem;color:#546e7a;margin-bottom:12px">בחר את המסמך <b>הבסיס</b> שיישמר — שאר הנתונים ייאספו לתוכו:</div>
      <div id="merge-invs" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:14px">
        ${invs.map((inv,i)=>`
          <div style="border:2px solid #e0e0e0;border-radius:8px;padding:8px;cursor:pointer;transition:.15s" data-merge-base="${inv.id}"
            onclick="this.closest('#merge-invs').querySelectorAll('[data-merge-base]').forEach(x=>{x.style.borderColor='#e0e0e0';x.classList.remove('merge-selected')});this.style.borderColor='#1565c0';this.classList.add('merge-selected')">
            <div style="font-size:.7rem;color:#888;margin-bottom:4px">מסמך ${i+1}</div>
            ${fmtInv(inv)}
          </div>`).join('')}
      </div>
      <div style="background:#e3f2fd;border-radius:8px;padding:10px;font-size:.78rem;color:#0d47a1;margin-bottom:14px">
        ℹ️ המיזוג ימלא שדות חסרים במסמך הבסיס מהמסמכים האחרים, ואז ימחק את הכפילויות.
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="merge-cancel" class="btn bs bsm">ביטול</button>
        <button id="merge-go" class="btn" style="background:#1565c0;color:#fff">⚡ בצע מיזוג</button>
      </div>
    </div>`;
  document.body.appendChild(ov2);

  ov2.querySelector('#merge-cancel').addEventListener('click',()=>_removeOverlay('dup-merge-ov'));
  ov2.querySelector('#merge-go').addEventListener('click',()=>{
    const baseEl = ov2.querySelector('.merge-selected');
    if(!baseEl){ showToast('⚠️ בחר מסמך בסיס'); return; }
    const baseId = parseInt(baseEl.dataset.mergeBase);
    const base = INVOICES.find(i=>i.id===baseId);
    if(!base){ showToast('❌ מסמך לא נמצא'); return; }
    // Merge: fill missing fields from other invoices
    invs.filter(i=>i.id!==baseId).forEach(src=>{
      const fields=['orderNum','orderDate','orderAmt','orderTotal','orderDesc','orderType',
        'orderNotes','txNum','txDate','txAmt','txTotal','num','date','amt','total',
        'notes','locCity','locType','locName','assignment','actMonth','file_order','file_tx','file_tax'];
      fields.forEach(f=>{ if(!base[f] && src[f]) base[f]=src[f]; });
      // Auto-detect status
      if(base.num) base.status='tax_invoice';
      else if(base.txNum) base.status='tx_invoice';
      else base.status='order';
    });
    // Delete duplicates
    const delIds = new Set(invs.filter(i=>i.id!==baseId).map(i=>i.id));
    INVOICES = INVOICES.filter(i=>!delIds.has(i.id));
    save(true); renderInvoices(); refreshPurchDash();
    _removeOverlay('dup-merge-ov');
    showToast('✅ מוזגו '+invs.length+' מסמכים לאחד');
    // Re-run search to refresh results
    const _dupOv = document.getElementById('dup-modal-ov');
    if(_dupOv) _runDupSearch(_dupOv);
  });
}

function _getDupIds(){
  const seen = {};
  INVOICES.forEach(inv=>{
    if(inv.notDup) return;
    const sup = (inv.supName||'').trim().toLowerCase();
    if(!sup) return;
    const keys = [];
    if(inv.orderNum && /\d/.test(inv.orderNum))
      keys.push('order|'+sup+'|'+(inv.orderNum||'').trim().toLowerCase());
    if(inv.txNum)
      keys.push('tx|'+sup+'|'+(inv.txNum||'').trim().toLowerCase());
    if(inv.num)
      keys.push('tax|'+sup+'|'+(inv.num||'').trim().toLowerCase());
    keys.forEach(k=>{
      if(!seen[k]) seen[k]=[];
      seen[k].push(inv.id);
    });
  });
  const dupIds = new Set();
  Object.values(seen).forEach(ids=>{ if(ids.length>1) ids.forEach(id=>dupIds.add(id)); });
  return dupIds;
}
