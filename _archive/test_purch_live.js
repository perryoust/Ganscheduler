// ════════════════════════════════════════════════════════
// PURCHASE MODULE LIVE DIAGNOSTIC
// Copy-paste this into the browser console while app is open
// ════════════════════════════════════════════════════════

(function diagnosePurch() {
  const results = {};

  // 1. Authentication state
  results.fbUser = window._fbUser ? window._fbUser.email : 'NOT LOGGED IN';
  results.fbSyncReady = window._fbSyncReady;
  results.cachedToken = window._cachedToken ? 'EXISTS' : 'MISSING';

  // 2. App mode & purch state
  results._appMode = typeof _appMode !== 'undefined' ? _appMode : window._appMode;
  results._purchTab = typeof _purchTab !== 'undefined' ? _purchTab : '??';

  // 3. Data availability
  results.INVOICES_count = Array.isArray(window.INVOICES) ? window.INVOICES.length : 'NOT ARRAY / UNDEFINED';
  results.SCH_count = typeof window.SCH !== 'undefined' ? window.SCH.length : 'UNDEFINED';

  // 4. DOM state BEFORE click
  const tabsPurch = document.getElementById('tabs-purch');
  const ppdash = document.getElementById('p-pdash');
  const modeBtn = document.getElementById('modeBtn-purch');
  results.before = {
    tabsPurch_display: tabsPurch ? tabsPurch.style.display : 'ELEMENT NOT FOUND',
    tabsPurch_computedDisplay: tabsPurch ? window.getComputedStyle(tabsPurch).display : 'N/A',
    ppdash_display: ppdash ? ppdash.style.display : 'ELEMENT NOT FOUND',
    modeBtn_exists: !!modeBtn,
    modeBtn_visible: modeBtn ? window.getComputedStyle(modeBtn).display : 'N/A',
  };

  // 5. Try calling switchMode directly and catch errors
  try {
    window.switchMode('purch');
    results.switchMode_call = 'SUCCESS';
  } catch(e) {
    results.switchMode_call = 'ERROR: ' + e.message + '\n' + e.stack;
  }

  // 6. DOM state AFTER switchMode
  results.after = {
    tabsPurch_display: tabsPurch ? tabsPurch.style.display : 'ELEMENT NOT FOUND',
    tabsPurch_computedDisplay: tabsPurch ? window.getComputedStyle(tabsPurch).display : 'N/A',
    ppdash_display: ppdash ? ppdash.style.display : 'ELEMENT NOT FOUND',
    bodyClass: document.body.className,
  };

  // 7. Check for function availability
  results.functions = {
    switchMode: typeof window.switchMode,
    SPT: typeof window.SPT,
    refreshPurchDash: typeof window.refreshPurchDash,
    renderInvoices: typeof window.renderInvoices,
    renderPurchSuppliers: typeof window.renderPurchSuppliers,
    fillPiSupFilter: typeof window.fillPiSupFilter,
  };

  // 8. Check PURCH_TABS
  results.PURCH_TABS = typeof PURCH_TABS !== 'undefined' ? PURCH_TABS : 'UNDEFINED';

  console.log('=== PURCHASE MODULE DIAGNOSTIC ===');
  console.log(JSON.stringify(results, null, 2));
  console.log('===================================');
  return results;
})();
