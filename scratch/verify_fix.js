const fs = require('fs');

const supsRaw = fs.readFileSync('C:/Users/Perry/.gemini/antigravity-ide/brain/cc69a157-75a3-4692-83e2-535c46ccfe65/.system_generated/steps/2987/output.txt', 'utf8');
const schRaw = fs.readFileSync('C:/Users/Perry/.gemini/antigravity-ide/brain/cc69a157-75a3-4692-83e2-535c46ccfe65/.system_generated/steps/3007/output.txt', 'utf8');

const supEx = JSON.parse(supsRaw);
const SCH = JSON.parse(schRaw);

const SUPBASE=[{"id":18,"name":"עליזה - סיפורים מוסיקליים","phone":"052-3215555"}];

const window = {
  supEx,
  SCH,
  SUPBASE,
  _mergedAliasMap: null
};

function supBase(fullName){
  if(!fullName) return '';
  const norm = fullName;
  const match = norm.match(/^(.*?)\s*([-\u2010-\u2015\u2212\u05BE\uFE58\uFE63\uFF0D])\s*(.*)$/);
  const base = match ? match[1].trim() : norm.trim();
  
  if (typeof window !== 'undefined' && window.supEx) {
    if (!window._mergedAliasMap) {
      window._mergedAliasMap = {};
      for (const mainName in window.supEx) {
        const item = window.supEx[mainName];
        if (!item) continue;
        if (Array.isArray(item._mergedFrom)) {
          item._mergedFrom.forEach(alias => {
            if (alias && typeof alias === 'string') {
              const aTrim = alias.trim();
              window._mergedAliasMap[aTrim] = mainName;
              const aBase = aTrim.replace(/^(.*?)\s*([-\u2010-\u2015\u2212\u05BE\uFE58\uFE63\uFF0D])\s*(.*)$/, '$1').trim();
              if (aBase) window._mergedAliasMap[aBase] = mainName;
            }
          });
        }
        if (item.alias && typeof item.alias === 'string') {
          const aTrim = item.alias.trim();
          if (aTrim) {
            window._mergedAliasMap[aTrim] = mainName;
            const aBase = aTrim.replace(/^(.*?)\s*([-\u2010-\u2015\u2212\u05BE\uFE58\uFE63\uFF0D])\s*(.*)$/, '$1').trim();
            if (aBase) window._mergedAliasMap[aBase] = mainName;
          }
        }
      }
    }
    if (window._mergedAliasMap[base]) {
      return window._mergedAliasMap[base];
    }
    if (window._mergedAliasMap[norm.trim()]) {
      return window._mergedAliasMap[norm.trim()];
    }
    // Flexible Hebrew spelling match (e.g. קיריבושי vs קריבושי)
    const baseClean = base.replace(/י/g, '');
    for (const [k, v] of Object.entries(window._mergedAliasMap)) {
      if (k.replace(/י/g, '') === baseClean) {
        return v;
      }
    }
  }
  return base;
}
window.supBase = supBase;

function supAct(fullName){
  if(!fullName) return '';
  const norm = fullName;
  const match = norm.match(/^(.*?)\s*([-\u2010-\u2015\u2212\u05BE\uFE58\uFE63\uFF0D\/])\s*(.*)$/);
  if(match) return match[3].trim();
  return '';
}
window.supAct = supAct;

function getSupActs(name){
  if(!name) return[];
  const base=supBase(name);
  const exBase=window.supEx[base]||{};
  const exName=window.supEx[name]||{};
  const ex = Object.keys(exBase).length ? exBase : exName;
  const fromSch=new Set();

  // 1. From SCH entries
  if (Array.isArray(window.SCH)) {
    window.SCH.forEach(s=>{ 
      if(window.supBase(s.a)===base){
        const a=window.supAct(s.a);
        if(a)fromSch.add(a);
        if(s.act)fromSch.add(s.act);
      } 
    });
  }
  // 2. From SUPBASE
  if (Array.isArray(window.SUPBASE)) {
    window.SUPBASE.forEach(s=>{ if(window.supBase(s.name)===base){const a=window.supAct(s.name);if(a)fromSch.add(a);} });
  }
  // 3. From merged-from history
  const mergedFromBases = Array.isArray(ex._mergedFrom) ? ex._mergedFrom : [];
  mergedFromBases.forEach(oldBase=>{
    if (Array.isArray(window.SCH)) {
      window.SCH.forEach(s=>{ 
        if(window.supBase(s.a)===oldBase || window.supBase(s.a)===window.supBase(oldBase)){
          const a=window.supAct(s.a);
          if(a)fromSch.add(a);
          if(s.act)fromSch.add(s.act);
        } 
      });
    }
    if (Array.isArray(window.SUPBASE)) {
      window.SUPBASE.forEach(s=>{ if(window.supBase(s.name)===oldBase || window.supBase(s.name)===window.supBase(oldBase)){const a=window.supAct(s.name);if(a)fromSch.add(a);} });
    }
    if (window.supEx[oldBase] && Array.isArray(window.supEx[oldBase].acts)) {
      window.supEx[oldBase].acts.forEach(a => { if (a) fromSch.add(a); });
    }
  });

  // 4. From alias if exists
  if (ex.alias && window.supEx[ex.alias] && Array.isArray(window.supEx[ex.alias].acts)) {
    window.supEx[ex.alias].acts.forEach(a => { if (a) fromSch.add(a); });
  }
  
  // 5. Merge with explicitly saved acts
  if(Array.isArray(exBase.acts)) exBase.acts.forEach(a=>{ if(a) fromSch.add(a); });
  if(Array.isArray(exName.acts)) exName.acts.forEach(a=>{ if(a) fromSch.add(a); });

  const hidden = new Set([...(exBase.hiddenActs || []), ...(exName.hiddenActs || [])]);
  return [...fromSch].filter(a => !hidden.has(a)).sort((a,b)=>a.localeCompare(b,'he'));
}

console.log('supBase("לגדול בקצב"):', supBase('לגדול בקצב'));
console.log('supBase("לגדול בקצב ע\\"ר"):', supBase('לגדול בקצב ע"ר'));
console.log('supBase("עליזה קיריבושי"):', supBase('עליזה קיריבושי'));
console.log('supBase("עליזה קריבושי"):', supBase('עליזה קריבושי'));
console.log('supBase("עליזה"):', supBase('עליזה'));
console.log('supBase("לגדול בקצב ע\\"ר - סיפורים מוסיקליים"):', supBase('לגדול בקצב ע"ר - סיפורים מוסיקליים'));

console.log('getSupActs("לגדול בקצב"):', getSupActs('לגדול בקצב'));
console.log('getSupActs("לגדול בקצב ע\\"ר"):', getSupActs('לגדול בקצב ע"ר'));
console.log('getSupActs("עליזה קיריבושי"):', getSupActs('עליזה קיריבושי'));
console.log('getSupActs("עליזה קריבושי"):', getSupActs('עליזה קריבושי'));
console.log('getSupActs("עליזה"):', getSupActs('עליזה'));
console.log('getSupActs("לגדול בקצב ע\\"ר - סיפורים מוסיקליים"):', getSupActs('לגדול בקצב ע"ר - סיפורים מוסיקליים'));
