/**
 * Data Manager Module - v5.0 (True Overwrite)
 * Centralized logic for all schedule manipulations.
 */
window.DataManager = {
  /**
   * Upsert a single record into the global schedule.
   * Uses fuzzy matching to find existing records and update them.
   */
  upsert: function(record) {
    if (!record || !record.id) return false;
    
    // Ensure all required fields exist
    record.st = record.st || 'ok';
    record.grp = (record.st === 'can' || record.st === 'nohap') ? 0 : (record.grp || 1);
    record.t = record.t || '00:00';
    
    const normA = (window.utils ? window.utils.megaClean(record.a) : record.a);
    const normT = (record.t || '').slice(0, 5);
    
    // Find existing record by ID first, then by fuzzy key
    let existingIdx = window.SCH.findIndex(s => String(s.id) === String(record.id));
    
    if (existingIdx === -1) {
      existingIdx = window.SCH.findIndex(s => 
        s.d === record.d && 
        Number(s.g) === Number(record.g) && 
        (window.utils ? window.utils.megaClean(s.a) : s.a) === normA &&
        (s.t || '').slice(0, 5) === normT
      );
    }
    
    if (existingIdx !== -1) {
      const existing = window.SCH[existingIdx];
      window.SCH[existingIdx] = { ...existing, ...record };
      if (!record.act && existing.act) window.SCH[existingIdx].act = existing.act;
      return 'updated';
    } else {
      window.SCH.push(record);
      return 'created';
    }
  },

  /**
   * MASTER OVERWRITE IMPORT
   * Completely replaces the schedule with data from the imported records.
   * The imported records become the SINGLE source of truth for their specific dates/gardens.
   */
  importBulk: function(records, coveredDateGardens) {
    console.log('[DataManager] Master Overwrite Import: ' + records.length + ' records');
    
    // Step 1: Index imported records by Date + Garden
    // Since some gardens have multiple activities on the same day, we store arrays
    const importedByDateGarden = {};
    records.forEach(r => {
      const k = `${r.d}|${Number(r.g)}`;
      if (!importedByDateGarden[k]) importedByDateGarden[k] = [];
      importedByDateGarden[k].push(r);
    });
    
    // Step 2: Process base records (SRAWS or existing SCH)
    const result = [];
    const usedKeys = new Set();
    
    // We start with existing SRAWS to preserve anything NOT in the Excel file
    if (typeof SRAWS !== 'undefined' && Array.isArray(SRAWS)) {
      SRAWS.forEach(s => {
        const k = `${s.d}|${Number(s.g)}`;
        
        // If the Excel file has data for this Date+Garden, we SKIP the SRAWS entry entirely.
        // We will insert the Excel records instead later. This prevents duplicates when suppliers change.
        if ((coveredDateGardens && coveredDateGardens.has(k)) || importedByDateGarden[k]) {
          usedKeys.add(k);
        } else {
          // No import data for this specific Date+Garden — keep SRAWS default
          result.push({
            ...s,
            st: s.st || 'ok',
            nt: s.n || '',
            grp: s.grp || 1,
            cr: s.cr || '',
            cn: s.cn || '',
            pd: s.pd || '',
            pt: s.pt || ''
          });
        }
      });
    }
    
    // Step 3: Add ALL imported records
    // This replaces the skipped SRAWS entries and adds any new ones
    records.forEach(r => {
      result.push({
        id: r.id,
        d: r.d,
        g: r.g,
        a: r.a,
        t: r.t,
        p: r.p || '',
        n: r.n || '',
        st: r.st || 'ok',
        cr: r.cr || '',
        cn: r.cn || '',
        nt: r.nt || '',
        pd: r.pd || '',
        pt: r.pt || '',
        grp: r.grp || 1,
        act: r.act || '',
        _isImported: true
      });
    });
    
    // Step 4: Replace SCH entirely
    window.SCH = result;
    
    // Step 5: Clean duplicates as safety net
    this.cleanupDuplicates();
    
    // Step 6: Apply automatic makeup matching (debt/credit)
    this.applyAutoMakeupMatching();
    
    const stats = {
      total: result.length,
      fromImport: records.length,
      fromSraws: result.length - records.length
    };
    console.log('[DataManager] Import complete:', stats);
    return stats;
  },

  /**
   * Calculates the balance of "Owed" vs "Completed" makeups per garden.
   * Debt: Activities that didn't occur (nohap).
   * Credit: Activities marked as "השלמה".
   * Balance: Debt - Credit.
   */
  calculateMakeupBalance: function() {
    const balanceMap = {}; // gardenId -> {name, debt: 0, credit: 0, balance: 0}
    
    const isM = s => {
      if (s.st === 'nohap' || s.st === 'can' || s.st === 'post') return false;
      return !!(s._isMakeup || s._makeupFrom || (s.nt && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.nt)) || (s.n && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.n)) || (s.a && /השלמה|הוקדם מ|נדחה מ|הוזז מ|עבר מ|עובר מ|הועבר מ/i.test(s.a)));
    };

    (window.SCH || []).forEach(s => {
      // Exclude cancelled activities (they don't count towards balance)
      if (s.st === 'can') return;

      const gid = Number(s.g);
      if (!gid) return;

      if (!balanceMap[gid]) {
        const garden = window.G(gid) || { name: 'גן #' + gid };
        balanceMap[gid] = { id: gid, name: garden.name || ('גן #' + gid), debt: 0, credit: 0, balance: 0 };
      }

      // 1. Debt: Not Occurred or Postponed (and not handled)
      const isHandled = !!(s._compByMakeup && s._compByMakeup !== "false") || !!((s.nt && /הוקדם ל|נדחה ל|הוזז ל|הקדמה ל|דחייה ל|עבר ל|עובר ל|הועבר ל/i.test(s.nt)) || (s.n && /הוקדם ל|נדחה ל|הוזז ל|הקדמה ל|דחייה ל|עבר ל|עובר ל|הועבר ל/i.test(s.n)));
      if ((s.st === 'nohap' || s.st === 'post') && !isHandled) {
        balanceMap[gid].debt++;
      }

      // 2. Credit: Makeup
      if (isM(s)) {
        balanceMap[gid].credit++;
      }
    });

    // Final balance calculation
    Object.values(balanceMap).forEach(b => {
      b.balance = b.debt - b.credit;
    });

    return balanceMap;
  },

  /**
   * Automatically matches "Not Occurred" activities with "Makeup" activities.
   * Marks matched nohap activities as handled (_compByMakeup = 'auto_match').
   */
  applyAutoMakeupMatching: function() {
    // Auto-matching is DISABLED.
    // A nohap is only considered "handled" when:
    //   1. The user explicitly clicks ✅ (טופל) in the dashboard
    //   2. A makeup was explicitly linked via createMakeupActivity or doPostpone
    //      (these set _compByMakeup directly with a real activity ID)
    //
    // We DO clear any leftover 'auto_match'/'auto_match_moved' stamps
    // from previous runs so they don't falsely hide nohaps.
    (window.SCH || []).forEach(s => {
      if (s._compByMakeup === 'auto_match' || s._compByMakeup === 'auto_match_moved') {
        delete s._compByMakeup;
      }
    });

    // Handle "moved" nohaps: if a nohap/post has a note saying it was moved TO another date,
    // mark it as handled so it doesn't appear in the todo list (the new date activity covers it).
    const isMovedTo = s => !!((s.nt && /הוקדם ל|נדחה ל|הוזז ל|הקדמה ל|דחייה ל|עבר ל|עובר ל|הועבר ל/i.test(s.nt)) || (s.n && /הוקדם ל|נדחה ל|הוזז ל|הקדמה ל|דחייה ל|עבר ל|עובר ל|הועבר ל/i.test(s.n)));
    (window.SCH || []).forEach(s => {
      if ((s.st === 'nohap' || s.st === 'post') && isMovedTo(s) && !s._compByMakeup) {
        s._compByMakeup = 'auto_match_moved';
      }
    });

    console.log('[DataManager] Auto-makeup matching is disabled. Manual handling only.');
  },

  cleanupDuplicates: function() {
    const seen = {};
    const toKeep = [];
    const before = window.SCH.length;
    
    const normClean = (val) => {
      if (!val) return '';
      return String(val).replace(/\(.*\)/g, '').replace(/[^א-תa-zA-Z0-9]/g, '').toLowerCase();
    };
    const normTime = (t) => {
      if(!t) return '00:00';
      let m = String(t).match(/(\d{1,2}):(\d{1,2})/);
      if(!m) return '00:00';
      return m[1].padStart(2,'0') + ':' + m[2].padStart(2,'0');
    };

    window.SCH.forEach(s => {
      if (!s.d || !s.g) return;
      const normA = normClean(s.a);
      const normT = normTime(s.t);
      const normG = Number(s.g);
      const k = `${s.d}|${normG}|${normA}|${normT}`;
      
      if (!seen[k]) {
        seen[k] = s;
        toKeep.push(s);
      } else {
        const existing = seen[k];
        // Keep the more meaningful status (nohap/can/post > ok)
        if (s.st !== 'ok' && existing.st === 'ok') existing.st = s.st;
        // Merge notes
        if (s.nt && existing.nt !== s.nt) {
          if (!existing.nt) existing.nt = s.nt;
          else if (!existing.nt.includes(s.nt)) existing.nt += ' | ' + s.nt;
        }
        // Keep non-zero grp
        if (s.grp > existing.grp) existing.grp = s.grp;
        // Keep act if existing doesn't have one
        if (!existing.act && s.act) existing.act = s.act;
        // Keep makeup info
        if (s._isMakeup) existing._isMakeup = true;
        if (s._makeupFrom) existing._makeupFrom = s._makeupFrom;
        if (s._compByMakeup) existing._compByMakeup = s._compByMakeup;
      }
    });
    
    window.SCH = toKeep;
    if (before !== toKeep.length) {
      console.log(`[DataManager] Cleanup: removed ${before - toKeep.length} duplicates → ${toKeep.length} records`);
    }
  }
};
