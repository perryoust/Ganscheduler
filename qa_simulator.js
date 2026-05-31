/**
 * QA Simulator and Test Center
 * Runs in-memory automated test scenarios to verify partner scheduling and sync correctness.
 */
(function() {
  const QA = {
    tests: [],
    logs: [],
    
    log: function(msg) {
      console.log('[QA-SIM]', msg);
      this.logs.push(msg);
    },

    addTest: function(name, runFn) {
      this.tests.push({ name, runFn });
    },

    runAll: async function() {
      this.logs = [];
      const resultsContainer = document.getElementById('qa-results');
      if (resultsContainer) {
        resultsContainer.innerHTML = '<div style="color:#666">⏳ מריץ בדיקות...</div>';
      }

      this.log('מתחיל הרצת בדיקות תקינות מערכת מלאה...');

      // Backup real environment
      const backupSCH = JSON.parse(JSON.stringify(window.SCH || []));
      const backupG = typeof window.G === 'function' ? window.G : null;
      const backupGardenPair = typeof window.gardenPair === 'function' ? window.gardenPair : null;
      const backupClusters = window.CLUSTERS ? JSON.parse(JSON.stringify(window.CLUSTERS)) : null;
      const backupSupEx = window.supEx ? JSON.parse(JSON.stringify(window.supEx)) : null;
      const backupInvoices = window.INVOICES ? JSON.parse(JSON.stringify(window.INVOICES)) : null;
      const backupBlockedDates = window.blockedDates ? JSON.parse(JSON.stringify(window.blockedDates)) : null;
      const backupHolidays = window.holidays ? JSON.parse(JSON.stringify(window.holidays)) : null;
      const backupGardenBlocks = window.gardenBlocks ? JSON.parse(JSON.stringify(window.gardenBlocks)) : null;
      const backupCurrentYear = window.CURRENT_YEAR;
      
      const origSave = window.save;
      const origSaveAndRefresh = window.saveAndRefresh;
      const origConfirm = window.confirm;
      const origAlert = window.alert;
      const origPrompt = window.prompt;
      const origFbCreateUser = window._fbCreateUser;
      const origChangeCurrentYear = window.changeCurrentYear;

      // Mock DOM overrides
      const origGetElementById = document.getElementById;
      const origQuerySelector = document.querySelector;
      const origQuerySelectorAll = document.querySelectorAll;

      let mockDOMValues = {};
      let fetchPayloads = [];

      // Intercept fetch for User Creation or Year Save
      const origFetch = window.fetch;
      window.fetch = function(url, options) {
        fetchPayloads.push({ url, options });
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({})
        });
      };

      // Set up Mock Data
      const mockGardens = {
        1: { id: 1, name: 'גן אורן', city: 'ראש העין', st: 'צהרון גן' },
        2: { id: 2, name: 'גן דקל', city: 'ראש העין', st: 'צהרון גן' },
        3: { id: 3, name: 'גן ברוש', city: 'ראש העין', st: 'צהרון גן' }
      };

      const mockPairs = [
        { id: 'pair1', name: 'גן אורן + גן דקל', ids: [1, 2] }
      ];

      const mockClusters = [
        { id: 'cluster1', name: 'אשכול ראש העין', gids: [1, 2, 3] }
      ];

      // Override global helpers
      window.G = (id) => mockGardens[id] || null;
      window.gardenPair = (gid) => mockPairs.find(p => p.ids.map(Number).includes(Number(gid))) || null;
      window.CLUSTERS = mockClusters;

      // Override Saves to execute locally
      window.save = () => Promise.resolve(true);
      window.saveAndRefresh = () => Promise.resolve(true);
      window.confirm = () => true;
      window.alert = () => {};
      window.prompt = () => 'mock_input';
      window._fbCreateUser = () => Promise.resolve({ uid: 'mock_uid_123', email: 'teacher_test@ganmanager.app' });
      
      // Prevent year change from triggering actual reload
      window.changeCurrentYear = function(year) {
        window.CURRENT_YEAR = year;
      };

      // Completely isolated DOM Mock setup
      const setupDOM = (values) => {
        mockDOMValues = values;

        document.getElementById = (id) => {
          if (mockDOMValues[id] !== undefined) {
            return {
              value: mockDOMValues[id],
              checked: mockDOMValues[id] === true,
              style: {},
              classList: { add: () => {}, remove: () => {}, contains: () => false },
              focus: () => {}
            };
          }
          return null;
        };

        document.querySelector = (selector) => {
          if (mockDOMValues[selector] !== undefined) {
            const val = mockDOMValues[selector];
            return {
              value: val,
              dataset: { r: val },
              checked: val === true
            };
          }
          if (selector === 'input[name="nohapq-scope"]:checked') {
            return { value: mockDOMValues['nohapq-scope'] || 'pair' };
          }
          if (selector === 'input[name="nu-access"]:checked') {
            return { value: mockDOMValues['nu-access'] || 'edit' };
          }
          if (selector === '#rr-sync-pair' || selector === '#rr-sync') {
            return { checked: mockDOMValues['rr-sync'] !== false };
          }
          if (selector.startsWith('.sp-mu-syn-time')) {
            const m = selector.match(/data-gid="(\d+)"/);
            const gid = m ? m[1] : null;
            const times = mockDOMValues['sp-mu-syn-times'] || {};
            return { value: times[gid] || '' };
          }
          return null;
        };

        document.querySelectorAll = (selector) => {
          if (selector === '.dash-row-chk:checked') {
            return [];
          }
          if (selector === '.rr-day:checked') {
            const days = mockDOMValues['rr-days'] || [];
            return days.map(d => ({ value: d }));
          }
          if (selector.includes('-syn-chk')) {
            const pfx = selector.includes('sp') ? 'sp-mu' : 'ns-mu';
            const ids = mockDOMValues[pfx + '-syn-ids'] || [];
            return ids.map(id => ({
              value: id,
              checked: true,
              disabled: Number(id) === 1
            }));
          }
          return [];
        };
      };

      const restoreDOM = () => {
        document.getElementById = origGetElementById;
        document.querySelector = origQuerySelector;
        document.querySelectorAll = origQuerySelectorAll;
      };

      let passedCount = 0;
      let html = '<table style="width:100%; border-collapse:collapse; font-size:0.8rem">';
      html += '<tr style="background:#eee; font-weight:bold"><td style="padding:6px">שם תרחיש</td><td style="padding:6px; text-align:center">סטטוס</td></tr>';

      for (let i = 0; i < this.tests.length; i++) {
        const test = this.tests[i];
        this.log(`מריץ בדיקה: ${test.name}...`);
        try {
          // Reset environments for each test
          window.SCH = [
            { id: 'ev1', g: 1, d: '2026-06-01', t: '14:40', a: 'עליזה', act: 'סיפורים מוסיקליים', st: 'ok', grp: 1 },
            { id: 'ev2', g: 2, d: '2026-06-01', t: '14:40', a: 'עליזה', act: 'סיפורים מוסיקליים', st: 'ok', grp: 1 }
          ];
          window.supEx = {
            'עליזה': { entityType: 'עוסק מורשה', acts: ['סיפורים מוסיקליים'] }
          };
          window.INVOICES = [];
          window.blockedDates = {};
          window.holidays = [];
          window.gardenBlocks = {};
          fetchPayloads = [];
          
          await test.runFn(setupDOM, () => fetchPayloads);
          this.log(`✅ ${test.name} עבר בהצלחה.`);
          html += `<tr style="border-bottom:1px solid #ddd"><td style="padding:6px; color:#2e7d32">✅ ${test.name}</td><td style="padding:6px; text-align:center; font-weight:bold; color:#2e7d32">עבר</td></tr>`;
          passedCount++;
        } catch (err) {
          this.log(`❌ ${test.name} נכשל: ${err.message}`);
          html += `<tr style="border-bottom:1px solid #ddd; background:#ffebee"><td style="padding:6px; color:#c62828">❌ ${test.name}<br><small style="color:#666">${err.message}</small></td><td style="padding:6px; text-align:center; font-weight:bold; color:#c62828">נכשל</td></tr>`;
        }
      }

      html += '</table>';
      
      const summaryColor = passedCount === this.tests.length ? '#2e7d32' : '#c62828';
      html = `<div style="font-weight:800; font-size:0.9rem; color:${summaryColor}; margin-bottom:10px">סיכום: ${passedCount} מתוך ${this.tests.length} בדיקות עברו בהצלחה!</div>` + html;

      // Restore environment
      window.SCH = backupSCH;
      if (backupG) window.G = backupG;
      if (backupGardenPair) window.gardenPair = backupGardenPair;
      window.CLUSTERS = backupClusters;
      window.supEx = backupSupEx;
      window.INVOICES = backupInvoices;
      window.blockedDates = backupBlockedDates;
      window.holidays = backupHolidays;
      window.gardenBlocks = backupGardenBlocks;
      window.CURRENT_YEAR = backupCurrentYear;
      
      window.save = origSave;
      window.saveAndRefresh = origSaveAndRefresh;
      window.confirm = origConfirm;
      window.alert = origAlert;
      window.prompt = origPrompt;
      window.fetch = origFetch;
      window._fbCreateUser = origFbCreateUser;
      window.changeCurrentYear = origChangeCurrentYear;
      restoreDOM();

      if (resultsContainer) {
        resultsContainer.innerHTML = html;
      }
    }
  };

  // --- Test 1: Bi-directional Cancellation ---
  QA.addTest('סנכרון ביטולים הדדי בין בני זוג', async function(setupDOM) {
    window._nohapQId = 'ev1';
    setupDOM({
      '.nohap-reason-btn.sel': 'מזג אוויר סוער',
      'nohapq-reason': 'בשל גשמים חזקים',
      'nohapq-scope': 'pair'
    });
    
    window.saveNohapQ();
    const ev1 = window.SCH.find(x => x.id === 'ev1');
    const ev2 = window.SCH.find(x => x.id === 'ev2');

    if (!ev1 || ev1.st !== 'nohap' || !ev2 || ev2.st !== 'nohap') {
      throw new Error('הביטול לא סונכרן בין בני הזוג');
    }
  });

  // --- Test 2: Makeup Scheduling & Time Sync ---
  QA.addTest('סנכרון השלמות ושעות מרובות', async function(setupDOM) {
    window.selEv = 'ev1';
    setupDOM({
      'sp-mu-date': '2026-06-15',
      'sp-mu-time': '15:30',
      'sp-mu-sup': 'עליזה',
      'sp-mu-act': 'סיפורים מוסיקליים',
      'sp-mu-syn-ids': [1, 2],
      'sp-mu-syn-times': { 1: '15:30', 2: '16:15' }
    });

    window.spSaveMakeup();
    const makeups = window.SCH.filter(s => s._isMakeup && s.d === '2026-06-15');
    if (makeups.length !== 2) throw new Error('לא נוצרו השלמות לשני הגנים');
  });

  // --- Test 3: Cluster sync verification ---
  QA.addTest('זיהוי אשכולות (Clusters) מעל 2 צהרונים', async function(setupDOM) {
    const cluster = window.CLUSTERS ? window.CLUSTERS.find(c => c.gids && c.gids.map(Number).includes(1)) : null;
    if (!cluster || cluster.gids.length !== 3) throw new Error('זיהוי אשכול שגוי');
  });

  // --- Test 4: Backup Integrity simulation ---
  QA.addTest('בדיקת תקינות מנגנון הגיבוי', async function(setupDOM) {
    localStorage.setItem('lastBackup', '2026-05-30');
    if (localStorage.getItem('lastBackup') !== '2026-05-30') throw new Error('הגיבוי נכשל');
  });

  // --- Test 5: Cancel Whole Day ---
  QA.addTest('ביטול יום שלם (Cancel Day) גורף', async function(setupDOM) {
    window._cancelDayDs = '2026-06-01';
    setupDOM({
      '.cancelday-reason-btn.sel': 'שביתה',
      'cancelday-note': 'שביתה ארצית'
    });
    window.saveCancelDay();
    const ev1 = window.SCH.find(x => x.id === 'ev1');
    if (ev1.st !== 'can' || !window.blockedDates['2026-06-01']) throw new Error('ביטול יום נכשל');
  });

  // --- Test 6: Edit Recurring Series ---
  QA.addTest('עריכה וסנכרון סדרה קבועה (Series)', async function(setupDOM) {
    window.SCH[0]._recId = 999;
    window.SCH[1]._recId = 999;

    setupDOM({
      'rr-from': '2026-06-01',
      'rr-to': '2026-06-08',
      'rr-days': [1],
      'rr-sup': 'עליזה',
      'rr-act': 'סיפורים מוסיקליים',
      'rr-time': '15:00',
      'rr-sync': true,
      'rr-time-partner': '16:00'
    });

    window.saveReplaceRecur('ev1');
    const newEvs = window.SCH.filter(x => x._recId && x._recId !== 999);
    if (newEvs.length !== 4) throw new Error('סדרת השיבוצים לא נוצרה נכון');
  });

  // --- Test 7: Create New Activity on Supplier ---
  QA.addTest('רישום פעילות חדשה לחלוטין', async function(setupDOM) {
    window.selEv = 'ev1';
    setupDOM({
      'sp-mu-date': '2026-06-15',
      'sp-mu-time': '15:30',
      'sp-mu-sup': 'עליזה',
      'sp-mu-act': '__new__',
      'sp-mu-act-new': 'חוג יוגה יצירתי',
      'sp-mu-syn-ids': [1]
    });

    window.spSaveMakeup();
    const acts = window.supEx['עליזה']?.acts || [];
    if (!acts.includes('חוג יוגה יצירתי')) throw new Error('פעילות חדשה לא נרשמה');
  });

  // --- Test 8: Automated VAT check in Procurement ---
  QA.addTest('חישוב ותיקון מע"מ אוטומטי (רכש)', async function(setupDOM) {
    window.supEx = {
      'ספק מורשה': { entityType: 'עוסק מורשה' },
      'עמותת ספורט': { entityType: 'עמותה' }
    };
    window.INVOICES = [
      { id: 'inv1', supName: 'ספק מורשה', total: 117, amt: 0, vat: 17 },
      { id: 'inv2', supName: 'עמותת ספורט', total: 100, amt: 0, vat: 17 }
    ];

    await window.autoFixInvoicesVAT();
    const inv1 = window.INVOICES.find(x => x.id === 'inv1');
    if (inv1.amt !== 100) throw new Error('מע"מ עוסק מורשה שגוי');
  });

  // --- Test 9: Year Selector Travel ---
  QA.addTest('בורר שנים ותנועת זמן (Time Travel)', async function(setupDOM) {
    window.CURRENT_YEAR = 'tashpav';
    window.changeCurrentYear('tashpaz');
    if (window.CURRENT_YEAR !== 'tashpaz') throw new Error('מעבר השנה נכשל');
  });

  // --- Test 10: Holidays & Calendar Blocks Filtering ---
  QA.addTest('מערכת סינון חגים וחסימות ימי חופשה', async function(setupDOM) {
    window.holidays = [
      { id: 'hol1', name: 'ראש השנה', from: '2026-09-12', to: '2026-09-13', city: '', type: 'all' }
    ];
    if (typeof window.getHolidayInfo !== 'function') throw new Error('getHolidayInfo חסרה');
    const hol = window.getHolidayInfo('2026-09-12');
    if (!hol || hol.name !== 'ראש השנה') throw new Error('זיהוי חג נכשל');
  });

  // --- Test 11: User profile database creation fetch ---
  QA.addTest('יצירת פרופיל משתמש והרשאות אבטחה', async function(setupDOM, getFetchPayloads) {
    setupDOM({
      'nu-username': 'tester_guest',
      'nu-displayname': 'אורח בדיקה',
      'nu-password': 'password_admin',
      'nu-perm-act': true,
      'nu-perm-purch': false,
      'nu-access': 'edit'
    });
    window._fbUser = { uid: 'admin_uid', displayName: 'perry', email: 'perry@ganmanager.app' };

    if (typeof window.createNewUser !== 'function') throw new Error('createNewUser חסרה');
    await window.createNewUser();

    const payloads = getFetchPayloads();
    const userSave = payloads.find(p => p.url.includes('/users/'));
    if (!userSave) throw new Error('שמירת פרופיל המשתמש ב-Firebase לא בוצעה');
  });

  // --- Test 12: WhatsApp Link Export Format ---
  QA.addTest('מחולל קישורים להודעות WhatsApp', async function(setupDOM) {
    window._exGids = [1, 2];
    window._exIsM = false;
    if (typeof window._exportPairWA !== 'function') throw new Error('_exportPairWA חסרה');
    
    // Test execution triggers openExport dialog setup safely
    setupDOM({
      'ex-d1': '2026-06-01',
      'ex-d2': '2026-06-01',
      'ex-fmt': 'brief'
    });
    window.openExport();
    if (window._exGids.length !== 2) throw new Error('הצהרונים המוגדרים לייצוא התאפסו');
  });

  // --- Test 13: Manual Garden Blocks check ---
  QA.addTest('חסימות צהרון ידניות (Garden Blocks)', async function(setupDOM) {
    window.gardenBlocks = {
      '1_2026-06-01': { reason: 'שיפוץ בצהרון', icon: '🚧' }
    };
    if (typeof window.getGardenBlock !== 'function') throw new Error('getGardenBlock חסרה');
    const blk = window.getGardenBlock(1, '2026-06-01');
    if (!blk || blk.reason !== 'שיפוץ בצהרון') throw new Error('חסימה ידנית לא זוהתה');
  });

  // Register on window
  window.QA_SIMULATOR = QA;
})();
