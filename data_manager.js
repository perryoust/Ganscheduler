/**
 * Data Manager Module - Smarter Architecture
 * Centralized logic for all schedule manipulations.
 */
window.DataManager = {
  /**
   * Upsert a record into the global schedule.
   * Handles merging, status updates, and ID consistency.
   */
  upsert: function(record) {
    if (!record || !record.id) return false;
    
    // Ensure all required fields exist
    record.st = record.st || 'ok';
    record.grp = record.grp || 1;
    record.t = record.t || '00:00';
    
    let existingIdx = window.SCH.findIndex(s => String(s.id) === String(record.id));
    
    // FUZZY MATCH: If ID doesn't match, check by (date, garden, supplier, time)
    if (existingIdx === -1) {
      const normA = (window.utils ? window.utils.megaClean(record.a) : record.a);
      const normT = (record.t || '').slice(0, 5);
      existingIdx = window.SCH.findIndex(s => 
        s.d === record.d && 
        Number(s.g) === Number(record.g) && 
        (window.utils ? window.utils.megaClean(s.a) : s.a) === normA &&
        (s.t || '').slice(0, 5) === normT
      );
    }
    
    if (existingIdx !== -1) {
      const existing = window.SCH[existingIdx];
      // Debug for target gardens
      const gn = (typeof window.G === 'function' ? window.G(record.g).name : record.g);
      if (gn.includes('צלף') || gn.includes('רוזמרין')) {
        console.log(`[Upsert Debug] UPDATING existing record for ${gn}: ID=${record.id}, OldSt=${existing.st}, NewSt=${record.st}`);
      }
      window.SCH[existingIdx] = { ...existing, ...record };
      // Preserve existing 'act' if the new one is empty
      if (!record.act && existing.act) window.SCH[existingIdx].act = existing.act;
      return 'updated';
    } else {
      const gn = (typeof window.G === 'function' ? window.G(record.g).name : record.g);
      if (gn.includes('צלף') || gn.includes('רוזמרין')) {
        console.log(`[Upsert Debug] CREATING NEW record for ${gn}: ID=${record.id}, St=${record.st}`);
      }
      window.SCH.push(record);
      return 'created';
    }
  },

  importBulk: async function(records) {
    let stats = { created: 0, updated: 0 };
    records.forEach(r => {
      const res = this.upsert(r);
      if (res === 'created') stats.created++;
      if (res === 'updated') stats.updated++;
    });
    
    // Auto-cleanup after bulk import to merge any accidental leftovers
    this.cleanupDuplicates();
    
    window.useSraws = false;
    console.log('[DataManager] Bulk import complete:', stats);
    return stats;
  },

  cleanupDuplicates: function() {
    const seen = {};
    const toKeep = [];
    const before = window.SCH.length;
    
    window.SCH.forEach(s => {
      const normA = (window.utils ? window.utils.megaClean(s.a) : s.a);
      const normT = (s.t || '').slice(0, 5);
      const k = `${s.d}|${Number(s.g)}|${normA}|${normT}`;
      
      if (!seen[k]) {
        seen[k] = s;
        toKeep.push(s);
      } else {
        // MERGE: If existing is 'ok' but duplicate is 'nohap', use 'nohap'
        if (s.st !== 'ok') seen[k].st = s.st;
        if (s.nt) seen[k].nt = (seen[k].nt ? seen[k].nt + ' | ' + s.nt : s.nt);
        if (s.grp > 0) seen[k].grp = s.grp;
      }
    });
    
    window.SCH = toKeep;
    console.log(`[DataManager] Cleanup: Merged ${before - toKeep.length} duplicates.`);
  }
};
