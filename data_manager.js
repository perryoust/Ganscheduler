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
  importBulk: function(records) {
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
        if (importedByDateGarden[k]) {
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
    
    const stats = {
      total: result.length,
      fromImport: records.length,
      fromSraws: result.length - records.length
    };
    console.log('[DataManager] Import complete:', stats);
    return stats;
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
