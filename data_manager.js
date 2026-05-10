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
    let stats = { created: 0, updated: 0, cleaned: 0 };
    
    // 1. Cleanup Pre-existing duplicates in SCH before import
    // (If two records have the same Date|Garden|Supplier|Time but different IDs)
    const seen = new Set();
    const toRemove = [];
    window.SCH.forEach((s, idx) => {
      const normA = window.utils.megaClean(s.a);
      const normT = (s.t || '').slice(0, 5);
      const k = `${s.d}|${Number(s.g)}|${normA}|${normT}`;
      if (seen.has(k)) {
        toRemove.push(idx);
      } else {
        seen.add(k);
      }
    });
    if (toRemove.length > 0) {
      // Remove from end to start to keep indices valid
      toRemove.sort((a,b) => b - a).forEach(idx => window.SCH.splice(idx, 1));
      stats.cleaned = toRemove.length;
      console.log(`[DataManager] Cleaned ${stats.cleaned} duplicate keys from SCH`);
    }

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
