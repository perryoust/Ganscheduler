/**
 * Direct Import Script — runs in Node.js
 * Parses GAN.xlsx, builds clean SCH records, pushes to Firebase
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// ── Load static data from data.js ──
const dataContent = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');

// Extract GARDENS array using eval (data.js uses JS syntax, not JSON)
let GARDENS = [];
let SUPBASE = [];
try {
  const gardensMatch = dataContent.match(/var GARDENS=(\[[\s\S]*?\]);\s*\n/);
  if (gardensMatch) GARDENS = eval(gardensMatch[1]);
} catch(e) { console.error('GARDENS parse error:', e.message); }
console.log('GARDENS loaded:', GARDENS.length);

try {
  const supbaseMatch = dataContent.match(/var SUPBASE=(\[[\s\S]*?\]);\s*\n/);
  if (supbaseMatch) SUPBASE = eval(supbaseMatch[1]);
} catch(e) { console.error('SUPBASE parse error:', e.message); }
console.log('SUPBASE loaded:', SUPBASE.length);

// Load SRAWS from sraws.json
let SRAWS = [];
try {
  SRAWS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'sraws.json'), 'utf8'));
  console.log('SRAWS loaded:', SRAWS.length);
} catch(e) { console.warn('sraws.json not found'); }

// ── Utils ──
function norm(s) {
  if (!s) return '';
  return s.toString().trim().replace(/["'״׳]/g, '').replace(/\s+/g, ' ').toLowerCase();
}
function megaClean(s) {
  if (!s) return '';
  let str = norm(s);
  const prefixes = ['גן', 'צהרון', 'ביהס', 'ביס', 'ביתספר', 'בית ספר'];
  for (let p of prefixes) {
    if (str.startsWith(p)) { str = str.substring(p.length).trim(); break; }
  }
  str = str.split(' - ')[0].split(' / ')[0].split('-')[0].trim();
  return str;
}
function supBase(fullName) {
  if (!fullName) return '';
  const i = fullName.indexOf(' - ');
  return i > 0 ? fullName.substring(0, i).trim() : fullName.trim();
}
function supAct(fullName) {
  if (!fullName) return '';
  const i = fullName.indexOf(' - ');
  return i > 0 ? fullName.substring(i + 3).trim() : '';
}
function findGarden(name, city) {
  if (!name) return null;
  const n = norm(name);
  const m = megaClean(name);
  const c = norm(city);
  let found = GARDENS.find(g => (norm(g.name) === n || megaClean(g.name) === m) && (!c || norm(g.city) === c));
  if (found) return found;
  const matches = GARDENS.filter(g => norm(g.name) === n || megaClean(g.name) === m);
  if (matches.length === 1) return matches[0];
  return null;
}
function findSupplier(name) {
  if (!name) return null;
  const n = norm(name);
  const m = megaClean(name);
  let found = SUPBASE.find(s => norm(s.name) === n);
  if (found) return found;
  found = SUPBASE.find(s => megaClean(s.name) === m);
  if (found) return found;
  const base = name.split(' - ')[0];
  const nb = norm(base);
  return SUPBASE.find(s => norm(s.name).startsWith(nb));
}
function getEventId(d, gid, sid, aid, t) {
  const key = `${d}|${gid}|${sid}|${aid}|${t}`;
  return 'e_' + Buffer.from(key).toString('base64').replace(/=/g, '').slice(0, 24);
}

// ── Parse GAN.xlsx ──
const xlsxPath = path.join(__dirname, '..', 'GAN.xlsx');
console.log('Reading:', xlsxPath);
const workbook = XLSX.readFile(xlsxPath, { cellDates: true });

const recordsToUpsert = [];
const stats = { rows: 0, imported: 0, skipped: 0, noGarden: 0, noDate: 0, nohap: 0, can: 0 };

for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 2) continue;

  // Known GAN.xlsx column indices
  const idxC = 1;   // עיר
  const idxG = 3;   // שם הצהרון
  const idxD = 5;   // תאריך
  const idxA = 8;   // שם החוג (full: "ספק - פעילות")
  const idxGr = 10; // קבוצות
  const idxT = 11;  // שעה
  const idxN = 12;  // הערות

  console.log(`Sheet "${sheetName}": ${rows.length} rows, header: ${(rows[0]||[]).join(' | ')}`);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue;
    stats.rows++;

    // Date Parsing
    let d = '';
    const rd = row[idxD];
    if (rd instanceof Date) d = rd.toISOString().slice(0, 10);
    else if (typeof rd === 'number') d = new Date(new Date(1899,11,30).getTime() + rd*86400000 + 12*3600000).toISOString().slice(0, 10);
    else if (typeof rd === 'string') {
      const m = rd.match(/(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})/);
      if (m) d = `${m[3].length===2?'20'+m[3]:m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { stats.noDate++; continue; }

    // Garden Parsing
    const gn = String(row[idxG] || '').trim();
    const city = String(row[idxC] || '').trim();
    if (!gn) continue;
    const garden = findGarden(gn, city);
    if (!garden) { stats.noGarden++; continue; }

    // Supplier Parsing — handles "ספק - פעילות" format
    const rawA = String(row[idxA] || '').trim();
    if (!rawA || rawA === 'null') { stats.skipped++; continue; }
    const supplier = findSupplier(rawA);
    if (!supplier) { stats.skipped++; continue; }
    
    // Split supplier name into base + activity (e.g. "דרך הספורט - התעמלות")
    const sBase = supBase(supplier.name);
    const sAct = supAct(supplier.name);

    // Time Parsing
    let t = '14:00';
    const rt = row[idxT];
    if (typeof rt === 'number') {
      const mTot = Math.round(rt * 1440);
      t = `${Math.floor(mTot/60).toString().padStart(2,'0')}:${(mTot%60).toString().padStart(2,'0')}`;
    } else if (rt) {
      const tm = String(rt).trim().match(/(\d{1,2}):(\d{1,2})/);
      if (tm) t = tm[1].padStart(2,'0') + ':' + tm[2].padStart(2,'0');
    }

    // STATUS PARSING — Critical logic
    const rawGr = row[idxGr];
    const nt = String(row[idxN] || '').trim();
    let st = 'ok';

    const grValue = (rawGr === undefined || rawGr === null) ? '' : String(rawGr).trim();
    const grNum = Number(grValue);

    // Empty groups = didn't occur
    if (grValue === '' || grNum === 0 || isNaN(grNum)) {
      // Check notes for cancellation keywords
      if (nt && /בוטל|מבוטל|מצב בטחוני|סגר|שביתה/.test(nt)) {
        st = 'can';
        stats.can++;
      } else {
        st = 'nohap';
        stats.nohap++;
      }
    } else if (nt) {
      // Groups has a number but notes indicate issues
      if (/לא התקיים|חסר מדריך|לא הגיע|חוסר מדריך|אין מדריך/.test(nt)) { st = 'nohap'; stats.nohap++; }
      else if (/בוטל|מבוטל|מצב בטחוני|סגר|שביתה/.test(nt)) { st = 'can'; stats.can++; }
    }

    // Use base supplier name (split from activity)
    const fId = getEventId(d, Number(garden.id), sBase, sAct, t);

    recordsToUpsert.push({
      id: fId, d, g: garden.id, a: sBase, t, st, nt,
      act: sAct, // Activity name stored separately
      grp: (st === 'can' || st === 'nohap') ? 0 : (parseInt(grValue) || 1),
      _isImported: true
    });
    stats.imported++;
  }
}

console.log('\n=== IMPORT STATS ===');
console.log('Total rows:', stats.rows);
console.log('Imported:', stats.imported);
console.log('Nohap (לא התקיים):', stats.nohap);
console.log('Cancelled (בוטלו):', stats.can);
console.log('Skipped:', stats.skipped);
console.log('No garden match:', stats.noGarden);
console.log('No date:', stats.noDate);

if (recordsToUpsert.length === 0) {
  console.error('No records to import!');
  process.exit(1);
}

// ── Build SCH: SRAWS + import overrides ──
const importedByKey = {};
recordsToUpsert.forEach(r => {
  const normA = megaClean(r.a);
  const k = `${r.d}|${Number(r.g)}|${normA}`;
  // If multiple activities for same supplier on same day, we just keep the last one or handle it.
  // For status updates, usually one per day.
  importedByKey[k] = r;
});

const result = [];
const usedKeys = new Set();

// Process SRAWS: merge with import data
SRAWS.forEach(s => {
  const normA = megaClean(s.a);
  const k = `${s.d}|${Number(s.g)}|${normA}`;

  const imported = importedByKey[k];
  if (imported) {
    result.push({
      ...s,
      st: imported.st || 'ok',
      nt: imported.nt || s.n || '',
      grp: imported.grp !== undefined ? imported.grp : (s.grp || 1),
      act: imported.act || supAct(s.a) || '',
      a: supBase(s.a), // Use base name
      cr: '', cn: '', pd: '', pt: '',
      _isImported: true
    });
    usedKeys.add(k);
  } else {
    result.push({
      ...s,
      st: s.st || 'ok',
      nt: s.n || '',
      grp: s.grp || 1,
      act: supAct(s.a) || '',
      a: supBase(s.a), // Use base name
      cr: '', cn: '', pd: '', pt: ''
    });
  }
});

// Add unmatched imported records
recordsToUpsert.forEach(r => {
  const normA = megaClean(r.a);
  const k = `${r.d}|${Number(r.g)}|${normA}`;
  if (!usedKeys.has(k)) {
    result.push(r);
  }
});

// Dedup
const seen = {};
const final = [];
result.forEach(s => {
  if (!s.d || !s.g) return;
  const normA = megaClean(s.a);
  const k = `${s.d}|${Number(s.g)}|${normA}`;
  if (!seen[k]) {
    seen[k] = s;
    final.push(s);
  } else {
    const existing = seen[k];
    if (s.st !== 'ok' && existing.st === 'ok') existing.st = s.st;
    if (s.nt && !existing.nt?.includes(s.nt)) existing.nt = (existing.nt ? existing.nt + ' | ' + s.nt : s.nt);
    if (s.grp > existing.grp) existing.grp = s.grp;
    if (!existing.act && s.act) existing.act = s.act;
  }
});

console.log('\n=== FINAL SCH ===');
console.log('Total records:', final.length);
console.log('Matched from import:', usedKeys.size);
console.log('Unmatched extras:', recordsToUpsert.length - usedKeys.size);

// Count statuses
const statusCounts = {};
final.forEach(s => { statusCounts[s.st || 'ok'] = (statusCounts[s.st || 'ok'] || 0) + 1; });
console.log('Status breakdown:', JSON.stringify(statusCounts));

// ── Save result as JSON for browser injection ──
const outputPath = path.join(__dirname, 'scratch', 'import_result.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(final));
console.log('\nSaved to:', outputPath);
console.log('File size:', (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2), 'MB');
