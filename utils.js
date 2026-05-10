/**
 * Ganscheduler Shared Utilities
 * v1.0.0 - Smarter Architecture
 */
window.utils = {
  /**
   * Normalize a string for robust matching.
   * Removes quotes, extra spaces, and handles Hebrew special characters.
   */
  norm: function(s) {
    if (!s) return '';
    return s.toString()
      .trim()
      .replace(/["'״׳]/g, '')
      .replace(/\s+/g, ' ')
      .toLowerCase();
  },

  /**
   * Advanced cleaning: removes prefixes like "גן" or "צהרון" for better matching.
   */
  megaClean: function(s) {
    let str = this.norm(s);
    const prefixes = ['גן', 'צהרון', 'ביהס', 'ביס', 'ביתספר'];
    for (let p of prefixes) {
      if (str.startsWith(p)) {
        str = str.substring(p.length).trim();
        break;
      }
    }
    return str;
  },

  /**
   * Generate a deterministic ID for a schedule event.
   */
  getEventId: function(d, gid, sid, aid, t) {
    const key = `${d}|${gid}|${sid}|${aid}|${t}`;
    return 'e_' + btoa(unescape(encodeURIComponent(key))).replace(/=/g, '').slice(0, 24);
  },

  /**
   * Find a supplier by name using robust matching.
   */
  findSupplier: function(name) {
    const n = this.norm(name);
    const m = this.megaClean(name);
    return (window.getAllSup() || []).find(s => {
      const sn = this.norm(s.name);
      const sm = this.megaClean(s.name);
      return sn === n || sm === m || sn === m || sm === n;
    });
  },

  /**
   * Find a garden by name and city using robust matching.
   */
  findGarden: function(name, city) {
    const n = this.norm(name);
    const m = this.megaClean(name);
    const c = this.norm(city);
    
    return (window.GARDENS || []).find(g => {
      const gn = this.norm(g.name);
      const gm = this.megaClean(g.name);
      const gc = this.norm(g.city);
      
      const nameMatch = (gn === n || gm === m || gn === m || gm === n);
      const cityMatch = (!c || gc === c);
      return nameMatch && cityMatch;
    });
  }
};
