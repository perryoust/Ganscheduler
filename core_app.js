window.onload = function(){
  window._appStartTime = Date.now(); // startup window for save protection
  // Auth is handled by onAuthStateChanged in index.html (Firebase module)
  // _onAuthReady is called once user is authenticated
  window._onAuthReady = async function(){
    cleanupStaleLocalStorage();

    // 1. Load local data immediately to show UI fast
    load();
    restoreMissingHolidays();
    syncSupplierList(); // supEx is now populated from load()
    migratePairsFromAuto();
    migrateSupActSplit();
    importContactsFromGardens();
    migrateGardenPhones();
    initDrops();
    initHolDrops();
    refreshClusterDrops();
    refreshMgrDrops();
    // dash-date now defaults to empty (All Dates)
    const dashDateEl=document.getElementById('dash-date'); 
    if(dashDateEl) dashDateEl.value='';
    ['dash-srch','s-srch','g-srch','su-srch'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const sfrom=document.getElementById('s-from');if(sfrom&&!sfrom.value) sfrom.value=td();
    const sto=document.getElementById('s-to');if(sto&&!sto.value) sto.value=td();
    const calClsEl=document.getElementById('cal-cls');
    if(calClsEl) calClsEl.value='גנים';
    const gClsEl=document.getElementById('g-cls');
    if(gClsEl) gClsEl.value='גנים';
    renderReadOnlyBanner();
    // Always run supplier repair on load to ensure cards exist
    repairAllSuppliers();
    syncSupplierList(); // re-sync after repair

    // Initial render with local data
    try{ renderDash(); }catch(e){}
    try{ renderCal(); }catch(e){}
    try{ renderClusters(); }catch(e){}
    try{ renderSup(); }catch(e){}
    try{ renderManagers(); }catch(e){}
    try{ updCounts(); }catch(e){}
    try{ odUpdateUI(); }catch(e){}
    try{ refreshPurchDash(); }catch(e){}
    try{ renderPurchSuppliers(); }catch(e){}
    try{ renderInvoices(); }catch(e){}

    // Restore last active mode if permitted, otherwise cleanly default to 'act'
    const savedMode = (typeof _safeLS !== 'undefined' ? _safeLS.getItem('activeAppMode') : null) || 'act';
    if (savedMode === 'purch' && window.permPurch && typeof window.switchMode === 'function') {
      window.switchMode('purch');
    } else if (typeof window.switchMode === 'function') {
      window.switchMode('act');
    }

    setTimeout(_fitScrollAreas, 100);
    try{ _ensureAdminProfile(); }catch(e){}

    // 2. Fetch Firebase data in the background
    try{
      // Step 1: Always get a fresh token before loading
      if(window._fbUser){
        try{ window._cachedToken = await window._fbUser.getIdToken(true); }
        catch(te){ console.warn('Token refresh failed:', te); }
      }
      // Step 2: Wait for static data (SRAWS) and Firebase data in parallel
      await _srawsReady;
      const fbOk = await loadFromFirebase(false, true); // force=true to always load
      if(!fbOk) console.warn('Firebase load returned false, using local data');

      // Load invoices explicitly — they live at a separate Firebase path
      // and need the token that is now guaranteed to be fresh
      try {
        if(window._cachedToken){
          const _iR = await fetch(
            'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data/invoices.json?auth='+window._cachedToken
          );
          if(_iR.ok){
            const _iD = await _iR.json();
            if(_iD && typeof _iD==='object'){
              window.INVOICES = Array.isArray(_iD) ? _iD : Object.values(_iD);
              console.log('Invoices loaded explicitly:', INVOICES.length);
            }
          }
        }
      } catch(ie){ console.warn('Explicit invoices load failed:', ie); }

      // If Firebase load was successful, update the data and re-render
      if (fbOk) {
        load();
        syncSupplierList();
        try{ renderDash(); }catch(e){}
        try{ renderCal(); }catch(e){}
        try{ renderClusters(); }catch(e){}
        try{ renderSup(); }catch(e){}
        try{ renderManagers(); }catch(e){}
        try{ updCounts(); }catch(e){}
        try{ odUpdateUI(); }catch(e){}
        try{ refreshPurchDash(); }catch(e){}
        try{ renderPurchSuppliers(); }catch(e){}
        try{ renderInvoices(); }catch(e){}
      }

    }catch(initErr){ console.warn('Init error:', initErr); }

    const _inv = typeof INVOICES!=='undefined'?INVOICES.length:0;
    const _sch = typeof SCH!=='undefined'?SCH.length:0;
    // AUTO-CLEANUP if duplicated (20k records detected)
    if (_sch > 15000 && window.DataManager && window.DataManager.cleanupDuplicates) {
      console.warn('[Core] Data bloat detected! Cleaning duplicates...');
      window.DataManager.cleanupDuplicates();
      window.save(true); // Persist cleanup
    }
    console.log('App fully ready: SCH = ',window.SCH.length,'INVOICES = ',_inv);
    
    _fbStartPolling();
  }; 
  if(window._fbUser) window._onAuthReady();
};