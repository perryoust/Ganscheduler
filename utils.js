/**
 * Ganscheduler Utils
 * v102.85 - Global UI Unification
 */
window.isMobileMode = window.isMobileMode || (() => window.innerWidth <= 768);
window.getEl = function(id) {
  if (window.isMobileMode()) {
    return document.getElementById(id + '-mobile') || document.getElementById(id + '-desktop') || document.getElementById(id);
  }
  return document.getElementById(id + '-desktop') || document.getElementById(id + '-mobile') || document.getElementById(id);
};
// Fallback for legacy calls from cached files
window._listRow = function(s, clr, ds) {
  console.warn('Legacy _listRow called. Please refresh (Ctrl+F5).');
  if (window.ui && window.ui.renderActivityRow) {
    return window.ui.renderActivityRow(s, { ds, clr, context: 'legacy' });
  }
  return '';
};

window.utils = {
  norm: function(s) {
    if (!s) return '';
    let str = s.toString()
      .trim()
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
      .replace(/["'״׳]/g, '')
      .replace(/\s+/g, ' ')
      .toLowerCase();
    
    if (str === 'פת' || str === 'פ"ת' || str === 'פתח תקוה' || str === 'פתח תקווה') return 'פת';
    if (str === 'ראשון' || str === 'ראשלצ' || str === 'ראשל"צ' || str === 'ראשון לציון') return 'ראשלצ';
    if (str === 'ראש העין' || str === 'ראש עין' || str === 'ראש-העין') return 'ראש העין';
    
    return str;
  },

  megaClean: function(s) {
    if (!s) return '';
    let str = this.norm(s);
    
    // 1. Strip all parentheses and their contents (e.g., city names, descriptions)
    str = str.replace(/\([^)]*\)/g, '').trim();
    
    // 2. Strip common prefixes
    const prefixes = ['גן', 'צהרון', 'ביהס', 'ביס', 'ביתספר', 'בית ספר'];
    for (let p of prefixes) {
      if (str.startsWith(p)) {
        str = str.substring(p.length).trim();
        break;
      }
    }
    // 3. Strip anything after dash or slash for fuzzy matching
    str = str.split(' - ')[0].split(' / ')[0].split('-')[0].trim();
    return str;
  },

  getEventId: function(d, gid, sid, aid, t) {
    // Deterministic ID generation based on core attributes
    const key = `${d}|${gid}|${sid}|${aid}|${t}`;
    return 'e_' + btoa(unescape(encodeURIComponent(key))).replace(/=/g, '').slice(0, 24);
  },

  findSupplier: function(name, _all) {
    if (!name) return null;
    const n = this.norm(name);
    const m = this.megaClean(name);
    
    // 1. Try exact match first
    const all = _all || (window.getAllSup ? window.getAllSup() : []);
    let found = all.find(s => this.norm(s.name) === n);
    if (found) return found;
    
    // 2. Try megaClean match with activity prioritization
    const matches = all.filter(s => this.megaClean(s.name) === m);
    if (matches.length > 0) {
      if (matches.length === 1) return matches[0];
      // Multiple suppliers with same base name - try to find the one that matches the activity in the raw name
      const bestMatch = matches.find(s => {
        const act = window.supAct ? window.supAct(s.name) : '';
        return act && n.includes(this.norm(act));
      });
      return bestMatch || matches[0];
    }
    
    // 3. Try base match (if name contains " - ")
    const base = name.split(/[-\u2013\u2014\/]/)[0].trim();
    const nb = this.norm(base);
    return all.find(s => this.norm(s.name).startsWith(nb));
  },

  findGarden: function(rawName, city) {
    if (!rawName) return null;
    let g = null;
    const GARDENS = window.GARDENS || [];
    
    // Normalize city if provided
    const normC = city ? this.megaClean(this.normCity(city)) : null;

    // 1. Precise match (cleaned)
    if(!g) {
      g = GARDENS.find(x => this.megaClean(x.name) === this.megaClean(rawName) && (!normC || this.megaClean(this.normCity(x.city)) === normC));
    }

    // 2. City extraction from ANY parenthesis (loop through all)
    if(!g && !city) {
      const parentheticals = (rawName.match(/\(([^)]+)\)/g) || []).map(m => m.slice(1, -1));
      for (const p of parentheticals) {
        const c = this.megaClean(this.normCity(p));
        const nameWithoutP = rawName.replace(/\([^)]+\)/g, '').trim();
        const nClean = this.megaClean(nameWithoutP);
        
        // Try to find garden where name is the leftover and city is the extracted paren
        g = GARDENS.find(x => this.megaClean(x.name) === nClean && this.megaClean(this.normCity(x.city)) === c);
        if(g) break;
        
        // Try to find garden where name (with its own parens) matches the raw name minus ONLY the city paren
        const rawMinusThisP = rawName.replace(`(${p})`, '').trim();
        g = GARDENS.find(x => this.megaClean(x.name) === this.megaClean(rawMinusThisP) && this.megaClean(this.normCity(x.city)) === c);
        if(g) break;
      }
    }

    // 3. Fallback to norm name + city fuzzy
    if(!g) {
      const n = this.norm(rawName);
      g = GARDENS.find(x => this.norm(x.name) === n && (!normC || this.megaClean(this.normCity(x.city)) === normC));
    }

    return g;
  },

  normCity: function(c) {
    const CITY_MAP = {
      'פתח תקווה': 'פ"ת',
      'פתח תקוה': 'פ"ת',
      'פ"ת': 'פ"ת',
      'ראש העין': 'ראש העין',
      'ראשל"צ': 'ראשון לציון',
      'ראשון לציון': 'ראשון לציון',
      'באר יעקב': 'באר יעקב',
      'גבעתיים': 'גבעתיים',
      'נס ציונה': 'נס ציונה'
    };
    if(!c) return '';
    const clean = c.trim();
    return CITY_MAP[clean] || clean;
  }
};

window.utils.compressData = async function(data) {
  try {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    const stream = new Blob([jsonStr]).stream();
    const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));
    const compressedResponse = new Response(compressedStream);
    const blob = await compressedResponse.blob();
    const buffer = await blob.arrayBuffer();
    // Convert to base64
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (e) {
    console.error('Compression failed', e);
    return null;
  }
};

window.utils.decompressData = async function(base64Str) {
  try {
    const binary = atob(base64Str);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const stream = new Blob([bytes]).stream();
    const decompressedStream = stream.pipeThrough(new DecompressionStream("gzip"));
    const decompressedResponse = new Response(decompressedStream);
    const text = await decompressedResponse.text();
    return JSON.parse(text);
  } catch (e) {
    console.error('Decompression failed', e);
    return null;
  }
};
