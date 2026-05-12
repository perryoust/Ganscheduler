const GARDENS = [
  {id: 98, name: 'גן קוקיה (חמ"ד)', city: 'פ"ת'},
  {id: 99, name: 'גן קורל', city: 'פ"ת'},
  {id: 100, name: 'גן קלמנטינה', city: 'ראש העין'}
];

function megaClean(s) {
  if(!s) return '';
  return String(s).replace(/\s+/g, '').replace(/[^\u0590-\u05FFa-zA-Z0-9]/g, '').toLowerCase();
}

function norm(s) {
  if(!s) return '';
  return megaClean(s.replace(/\(.*\)/g, ''));
}

function findGarden(rawName, city) {
  let g = null;
  
  // 1. Precise match (cleaned)
  if(!g) {
    g = GARDENS.find(x => megaClean(x.name) === megaClean(rawName) && (!city || megaClean(x.city) === megaClean(city)));
  }

  // 2. City extraction from parentheses (loop through all)
  if(!g && !city) {
    const parentheticals = (rawName.match(/\(([^)]+)\)/g) || []).map(m => m.slice(1, -1));
    for (const p of parentheticals) {
      const c = megaClean(p);
      const nameWithoutP = rawName.replace(/\([^)]+\)/g, '').trim();
      const nClean = megaClean(nameWithoutP);
      
      // Try to find garden where name is the leftover and city is the extracted paren
      g = GARDENS.find(x => megaClean(x.name) === nClean && megaClean(x.city) === c);
      if(g) break;
      
      // Try to find garden where name (with its own parens) matches the raw name minus ONLY the city paren
      // This handles "גן קוקיה (חמ"ד) (פ"ת)" where DB name is "גן קוקיה (חמ"ד)"
      const rawMinusThisP = rawName.replace(`(${p})`, '').trim();
      g = GARDENS.find(x => megaClean(x.name) === megaClean(rawMinusThisP) && megaClean(x.city) === c);
      if(g) break;
    }
  }

  // 3. Fallback to norm name + city fuzzy
  if(!g) {
    const n = norm(rawName);
    const c = city ? megaClean(city) : null;
    g = GARDENS.find(x => norm(x.name) === n && (!c || megaClean(x.city) === c));
  }

  return g;
}

const tests = [
  { name: 'גן קוקיה (חמ"ד) (פ"ת)', city: null },
  { name: 'גן קורל (פ"ת)', city: null },
  { name: 'גן קלמנטינה (ראש העין)', city: null }
];

tests.forEach(t => {
  const res = findGarden(t.name, t.city);
  console.log(`Input: "${t.name}" -> Found: ${res ? res.name + ' (' + res.city + ')' : 'NOT FOUND'}`);
});
