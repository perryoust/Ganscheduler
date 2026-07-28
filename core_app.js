window.onload = function(){
  window._appStartTime = Date.now(); // startup window for save protection
  // Auth is handled by onAuthStateChanged in index.html (Firebase module)
  // _onAuthReady is called once user is authenticated
  window._onAuthReady = async function(){
    cleanupStaleLocalStorage();

    // 0. Sync years/periods metadata from Firebase (must run before loadFromFirebase)
    try {
      let tok = await window._fbUser?.getIdToken(false);
      const base = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';
      const r = await fetch(`${base}/years_meta.json${tok ? '?auth=' + tok : ''}`);
      if (r.ok) {
        const cloudMeta = await r.json();
        if (cloudMeta && cloudMeta.years) {
          const localMetaStr = window._safeLS.getItem('ganv5_meta');
          let localMeta = localMetaStr ? JSON.parse(localMetaStr) : { currentYear: 'tashpav', years: {} };
          localMeta.years = { ...localMeta.years, ...cloudMeta.years };
          if (cloudMeta.currentYear) {
            const isNonAdmin = window.role === 'coordinator' || window.role === 'worker' || window.role === 'view';
            if (isNonAdmin || !localMeta.years[localMeta.currentYear]) {
              localMeta.currentYear = cloudMeta.currentYear;
              window.CURRENT_YEAR = cloudMeta.currentYear;
            }
          }
          window._safeLS.setItem('ganv5_meta', JSON.stringify(localMeta));
          if (window.initYearSelector) window.initYearSelector();
        }
      }
    } catch (e) {
      console.warn('Failed to load years metadata from Firebase:', e);
    }

    // 1. Load local data immediately to show UI fast
    load();

    // Skip all admin UI setup for strict workers - they have their own isolated mobile UI
    if (window.role !== 'worker') {
      restoreMissingHolidays();
      syncSupplierList();
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
      repairAllSuppliers();
      syncSupplierList();

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

      // Always default to 'act' mode on load per user request (skip for strict workers - they have isolated UI)
      if (typeof window.switchMode === 'function') {
        window.switchMode('act');
      }

      setTimeout(_fitScrollAreas, 100);
      try{ _ensureAdminProfile(); }catch(e){}
    }


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

      // Invoices are loaded by loadFromFirebase() (firebase.js L292-L314) — no separate fetch needed

      // If Firebase load was successful, update the data and re-render (skip for workers - they have isolated UI)
      if (fbOk && window.role !== 'worker') {
        load();
        syncSupplierList();
        initDrops();
        initHolDrops();
        refreshClusterDrops();
        refreshMgrDrops();
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
      } else if (fbOk && window.role === 'worker') {
        // For workers: just re-render the mobile task list with fresh data
        load();
        if (typeof window.renderWorkerTasksMobile === 'function') window.renderWorkerTasksMobile();
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
    // ONE-TIME CLEANUP FOR מעשיותאטרון
    if (window.supEx && window.supEx['__merged_away']) {
      const oldLen = window.supEx['__merged_away'].length;
      window.supEx['__merged_away'] = window.supEx['__merged_away'].filter(s => !s.includes('מעשיותאטרון'));
      if (window.supEx['__merged_away'].length !== oldLen) {
        window.save(true);
      }
    }
    
    console.log('App fully ready: SCH = ',window.SCH.length,'INVOICES = ',_inv);
    window.refresh(); _fbStartPolling();
  }; 
  if(window._fbUser) window._onAuthReady();
};