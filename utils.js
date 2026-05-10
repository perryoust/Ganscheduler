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
   * Generate a deterministic ID for a schedule event.
   * Format: e_{date}_{gardenId}_{supplierId}_{activityId}_{time}
   */
  getEventId: function(d, gid, sid, aid, t) {
    // Ensure inputs are clean
    const cleanD = (d || '').toString().trim();
    const cleanT = (t || '').toString().trim().replace(/[^\d:]/g, '');
    const cleanG = (gid || 0).toString();
    const cleanS = (sid || 0).toString();
    const cleanA = (aid || 0).toString();
    
    const key = `${cleanD}|${cleanG}|${cleanS}|${cleanA}|${cleanT}`;
    // Use a simpler, faster hashing or just b64
    return 'e_' + btoa(unescape(encodeURIComponent(key))).replace(/=/g, '').slice(0, 24);
  },

  /**
   * Find a supplier by name using robust matching.
   */
  findSupplier: function(name) {
    const n = this.norm(name);
    return (window.getAllSup() || []).find(s => this.norm(s.name) === n);
  },

  /**
   * Find a garden by name and city using robust matching.
   */
  findGarden: function(name, city) {
    const nN = this.norm(name);
    const nC = this.norm(city);
    return (window.GARDENS || []).find(g => 
      this.norm(g.name) === nN && (!nC || this.norm(g.city) === nC)
    );
  }
};
