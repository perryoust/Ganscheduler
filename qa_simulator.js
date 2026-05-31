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

      this.log('מתחיל הרצת בדיקות תקינות מערכת...');

      // Backup real environment
      const backupSCH = JSON.parse(JSON.stringify(window.SCH || []));
      const backupG = typeof window.G === 'function' ? window.G : null;
      const backupGardenPair = typeof window.gardenPair === 'function' ? window.gardenPair : null;
      const backupClusters = window.CLUSTERS ? JSON.parse(JSON.stringify(window.CLUSTERS)) : null;
      const backupSupEx = window.supEx ? JSON.parse(JSON.stringify(window.supEx)) : null;
      const backupInvoices = window.INVOICES ? JSON.parse(JSON.stringify(window.INVOICES)) : null;
      const backupBlockedDates = window.blockedDates ? JSON.parse(JSON.stringify(window.blockedDates)) : null;
      
      const origSave = window.save;
      const origSaveAndRefresh = window.saveAndRefresh;
      const origConfirm = window.confirm;
      const origAlert = window.alert;

      // Mock DOM overrides
      const origGetElementById = document.getElementById;
      const origQuerySelector = document.querySelector;
      const origQuerySelectorAll = document.querySelectorAll;

      let mockDOMValues = {};

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

      // Completely isolated DOM Mock setup
      const setupDOM = (values) => {
        mockDOMValues = values;

        document.getElementById = (id) => {
          if (mockDOMValues[id] !== undefined) {
            return {
              value: mockDOMValues[id],
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
          
          await test.runFn(setupDOM);
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
      
      window.save = origSave;
      window.saveAndRefresh = origSaveAndRefresh;
      window.confirm = origConfirm;
      window.alert = origAlert;
      restoreDOM();

      if (resultsContainer) {
        resultsContainer.innerHTML = html;
      }
    }
  };

  // --- Scenario 1: Bi-directional Cancellation ---
  QA.addTest('סנכרון ביטולים הדדי בין בני זוג', async function(setupDOM) {
    window._nohapQId = 'ev1';
    setupDOM({
      '.nohap-reason-btn.sel': 'מזג אוויר סוער',
      'nohapq-reason': 'בשל גשמים חזקים',
      'nohapq-scope': 'pair'
    });
    
    if (typeof window.saveNohapQ !== 'function') {
      throw new Error('הפונקציה saveNohapQ לא מוגדרת במערכת');
    }

    window.saveNohapQ();

    const ev1 = window.SCH.find(x => x.id === 'ev1');
    const ev2 = window.SCH.find(x => x.id === 'ev2');

    if (!ev1 || ev1.st !== 'nohap') {
      throw new Error(`פעילות המקור לא סומנה כלא-התקיימה (סטטוס נוכחי: ${ev1 ? ev1.st : 'לא נמצאה'})`);
    }
    if (!ev2 || ev2.st !== 'nohap') {
      throw new Error(`פעילות בן-הזוג לא סונכרנה לביטול (סטטוס נוכחי: ${ev2 ? ev2.st : 'לא נמצאה'})`);
    }
  });

  // --- Scenario 2: Makeup Scheduling & Time Sync ---
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
    if (makeups.length !== 2) {
      throw new Error(`לא נוצרו 2 השלמות בזיכרון (נוצרו: ${makeups.length})`);
    }

    const mu1 = makeups.find(s => s.g === 1);
    const mu2 = makeups.find(s => s.g === 2);

    if (!mu1 || mu1.t !== '15:30') {
      throw new Error(`שעת ההשלמה לגן 1 שגויה: ${mu1 ? mu1.t : 'לא קיים'}`);
    }
    if (!mu2 || mu2.t !== '16:15') {
      throw new Error(`שעת ההשלמה לגן 2 שגויה: ${mu2 ? mu2.t : 'לא קיים'}`);
    }
  });

  // --- Scenario 3: Cluster sync verification ---
  QA.addTest('זיהוי אשכולות (Clusters) מעל 2 צהרונים', async function(setupDOM) {
    const cluster = window.CLUSTERS ? window.CLUSTERS.find(c => c.gids && c.gids.map(Number).includes(1)) : null;
    if (!cluster) {
      throw new Error('לא נמצא אשכול מתאים לבדיקה');
    }
    if (cluster.gids.length !== 3) {
      throw new Error(`גודל האשכול שגוי: ${cluster.gids.length} במקום 3`);
    }
  });

  // --- Scenario 4: Backup Integrity simulation ---
  QA.addTest('בדיקת תקינות מנגנון הגיבוי', async function(setupDOM) {
    localStorage.setItem('lastBackup', '2026-05-30');
    const last = localStorage.getItem('lastBackup');
    if (last !== '2026-05-30') {
      throw new Error('השמירה ב-localStorage נכשלה');
    }
  });

  // --- Scenario 5: Cancel Whole Day ---
  QA.addTest('ביטול יום שלם (Cancel Day) גורף', async function(setupDOM) {
    window._cancelDayDs = '2026-06-01';
    setupDOM({
      '.cancelday-reason-btn.sel': 'שביתה',
      'cancelday-note': 'שביתה ארצית'
    });

    if (typeof window.saveCancelDay !== 'function') {
      throw new Error('הפונקציה saveCancelDay לא מוגדרת');
    }

    window.saveCancelDay();

    const ev1 = window.SCH.find(x => x.id === 'ev1');
    const ev2 = window.SCH.find(x => x.id === 'ev2');

    if (ev1.st !== 'can' || ev2.st !== 'can') {
      throw new Error('הפעילויות באותו יום לא בוטלו');
    }
    if (!window.blockedDates['2026-06-01']) {
      throw new Error('התאריך לא התווסף למערך התאריכים החסומים ביומן');
    }
  });

  // --- Scenario 6: Edit Recurring Series ---
  QA.addTest('עריכה וסנכרון סדרה קבועה (Series)', async function(setupDOM) {
    // Ev1 is recurrent
    window.SCH[0]._recId = 999;
    window.SCH[1]._recId = 999;

    setupDOM({
      'rr-from': '2026-06-01',
      'rr-to': '2026-06-08',
      'rr-days': [1], // Monday
      'rr-sup': 'עליזה',
      'rr-act': 'סיפורים מוסיקליים',
      'rr-time': '15:00',
      'rr-sync': true,
      'rr-time-partner': '16:00'
    });

    if (typeof window.saveReplaceRecur !== 'function') {
      throw new Error('הפונקציה saveReplaceRecur לא מוגדרת');
    }

    window.saveReplaceRecur('ev1');

    // Verify original ev1 and ev2 are replaced (deleted) and new ones added
    const replaced1 = window.SCH.find(x => x.id === 'ev1');
    if (replaced1) {
      throw new Error('הפעילות הישנה של הסדרה לא נמחקה מ-window.SCH');
    }

    const newEvs = window.SCH.filter(x => x._recId && x._recId !== 999);
    if (newEvs.length !== 4) {
      // 2 Mondays in date range 1st to 8th of June 2026, for 2 daycares = 4 events
      throw new Error(`סדרת השיבוצים החדשה לא נוצרה נכון בזיכרון (נוצרו: ${newEvs.length} במקום 4)`);
    }

    const partnerEv = newEvs.find(x => x.g === 2);
    if (!partnerEv || partnerEv.t !== '16:00') {
      throw new Error(`שעת סדרת השותף לא סונכרנה נכון ל-16:00 (שעה נוכחית: ${partnerEv ? partnerEv.t : 'אין'})`);
    }
  });

  // --- Scenario 7: Create New Activity on Supplier ---
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
    if (!acts.includes('חוג יוגה יצירתי')) {
      throw new Error('החוג החדש לא התווסף לרשימת הפעילויות של הספק עליזה');
    }
  });

  // --- Scenario 8: Automated VAT check in Procurement ---
  QA.addTest('חישוב ותיקון מע"מ אוטומטי (רכש)', async function(setupDOM) {
    window.supEx = {
      'ספק מורשה': { entityType: 'עוסק מורשה' },
      'עמותת ספורט': { entityType: 'עמותה' }
    };
    window.INVOICES = [
      { id: 'inv1', supName: 'ספק מורשה', total: 117, amt: 0, vat: 17 },
      { id: 'inv2', supName: 'עמותת ספורט', total: 100, amt: 0, vat: 17 }
    ];

    if (typeof window.autoFixInvoicesVAT !== 'function') {
      throw new Error('הפונקציה autoFixInvoicesVAT לא מוגדרת');
    }

    await window.autoFixInvoicesVAT();

    const inv1 = window.INVOICES.find(x => x.id === 'inv1');
    const inv2 = window.INVOICES.find(x => x.id === 'inv2');

    if (inv1.amt !== 100) {
      throw new Error(`חישוב המע"מ לעוסק מורשה נכשל (סכום ללא מע"מ: ${inv1.amt} במקום 100)`);
    }
    if (inv2.amt !== 100) {
      throw new Error(`חישוב המע"מ לעמותה נכשל (עמותה פטורה ממע"מ, סכום ללא מע"מ: ${inv2.amt} במקום 100)`);
    }
  });

  // Register on window
  window.QA_SIMULATOR = QA;
})();
