/**
 * Ganscheduler Utils
 * v4.1.0 - Robust Matching for GAN.xlsx
 */
window.utils = {
  norm: function(s) {
    if (!s) return '';
    return s.toString()
      .trim()
      .replace(/["'״׳]/g, '')
      .replace(/\s+/g, ' ')
      .toLowerCase();
  },

  megaClean: function(s) {
    let str = this.norm(s);
    // Common prefixes to ignore during matching
    const prefixes = ['גן', 'צהרון', 'ביהס', 'ביס', 'ביתספר', 'בית ספר'];
    for (let p of prefixes) {
      if (str.startsWith(p)) {
        str = str.substring(p.length).trim();
        break;
      }
    }
    return str;
  },

  getEventId: function(d, gid, sid, aid, t) {
    // Deterministic ID generation based on core attributes
    const key = `${d}|${gid}|${sid}|${aid}|${t}`;
    return 'e_' + btoa(unescape(encodeURIComponent(key))).replace(/=/g, '').slice(0, 24);
  },

  findSupplier: function(name) {
    if (!name) return null;
    const n = this.norm(name);
    const m = this.megaClean(name);
    
    // 1. Try exact match first
    const all = window.getAllSup() || [];
    let found = all.find(s => this.norm(s.name) === n);
    if (found) return found;
    
    // 2. Try megaClean match
    found = all.find(s => this.megaClean(s.name) === m);
    if (found) return found;
    
    // 3. Try base match (if name contains " - ")
    const base = name.split(' - ')[0];
    const nb = this.norm(base);
    return all.find(s => this.norm(s.name).startsWith(nb));
  },

  findGarden: function(name, city) {
    if (!name) return null;
    const n = this.norm(name);
    const m = this.megaClean(name);
    const c = this.norm(city);
    
    const gardens = window.GARDENS || [];
    
    // Priority 1: Name + City match
    let found = gardens.find(g => (this.norm(g.name) === n || this.megaClean(g.name) === m) && (!c || this.norm(g.city) === c));
    if (found) return found;
    
    // Priority 2: Name match only (if unique enough)
    const matches = gardens.filter(g => this.norm(g.name) === n || this.megaClean(g.name) === m);
    if (matches.length === 1) return matches[0];
    
    return null;
  }
};
