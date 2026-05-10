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
    
    const existingIdx = window.SCH.findIndex(s => String(s.id) === String(record.id));
    
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
    
    // After bulk upsert, we disable SRAWS merging to prevent stale data overlay
    window.useSraws = false;
    
    console.log('[DataManager] Bulk import complete:', stats);
    return stats;
  }
};
