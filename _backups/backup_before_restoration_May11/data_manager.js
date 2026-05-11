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
    console.log('[DataManager] Starting Master Overwrite import...');
    
    // 1. Reset everything to baseline (SRAWS default state)
    // This clears all previous imported records (e_...) and resets SRAWS changes.
    window.SCH = SRAWS.map(s => ({...s, st:'ok', nt:s.n||'', grp:1}));
    
    // 2. Apply new records (fuzzy-matched)
    let stats = { created: 0, updated: 0 };
    records.forEach(r => {
      const res = this.upsert(r);
      if (res === 'created') stats.created++;
      if (res === 'updated') stats.updated++;
    });
    
    // 3. Final nuclear cleanup
    this.cleanupDuplicates();
    
    window.useSraws = false;
    console.log('[DataManager] Overwrite import complete:', stats);
    return stats;
  },

  cleanupDuplicates: function() {
    const seen = {};
    const toKeep = [];
    const before = window.SCH.length;
    
    const normClean = (val) => window.utils.megaClean(val);
    const normTime = (t) => {
      if(!t) return '00:00';
      let m = String(t).match(/(\d{1,2}):(\d{1,2})/);
      if(!m) return '00:00';
      return m[1].padStart(2,'0') + ':' + m[2].padStart(2,'0');
    };

    let debugCount = 0;

    window.SCH.forEach(s => {
      if (!s.d || !s.g) return;
      const normA = normClean(s.a);
      const normT = normTime(s.t);
      const normG = Number(s.g);
      const k = `${s.d}|${normG}|${normA}|${normT}`;
      
      if (debugCount < 20) {
         console.log(`[Dedupe Debug] ID: ${s.id}, Key: ${k}`);
         debugCount++;
      }

      if (!seen[k]) {
        seen[k] = s;
        toKeep.push(s);
      } else {
        const existing = seen[k];
        
        if (debugCount < 5 && s.id !== existing.id) {
           console.log(`[Dedupe Match] Merging ${s.id} into ${existing.id} for key: ${k}`);
           debugCount++;
        }

        // 1. Prioritize non-ok status (exceptions)
        if (s.st !== 'ok' && existing.st === 'ok') existing.st = s.st;
        // 2. Merge unique notes
        if (s.nt && existing.nt !== s.nt) {
          if (!existing.nt.includes(s.nt)) existing.nt = (existing.nt ? existing.nt + ' | ' + s.nt : s.nt);
        }
        // 3. Keep manual ID if available
        if (String(s.id).startsWith('e_') && !String(existing.id).startsWith('e_')) {
           Object.assign(existing, s, {id: existing.id}); 
        } else if (String(s.id).startsWith('e_')) {
           existing.id = s.id;
        }
        
        if (!existing.act && s.act) existing.act = s.act;
        if (s.grp > existing.grp) existing.grp = s.grp;
      }
    });
    
    window.SCH = toKeep;
    console.log(`[DataManager] Nuclear Cleanup: Merged ${before - toKeep.length} duplicates. Result: ${toKeep.length}`);
  }
};
