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
    
    const existingIdx = window.SCH.findIndex(s => s.id === record.id);
    
    if (existingIdx !== -1) {
      // SMART MERGE: Keep certain fields if they already exist and the new ones are empty
      const existing = window.SCH[existingIdx];
      
      // If the new record is 'ok' but we have a non-'ok' status in cloud, 
      // we might want to be careful. However, during import, we usually want Latest Win.
      window.SCH[existingIdx] = { ...existing, ...record };
      return 'updated';
    } else {
      window.SCH.push(record);
      return 'created';
    }
  },

  /**
   * Bulk upsert from imported data.
   */
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
