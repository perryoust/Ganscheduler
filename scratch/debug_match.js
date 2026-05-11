const fs = require('fs');
const XLSX = require('xlsx');

const SRAWS = JSON.parse(fs.readFileSync('sraws.json', 'utf8'));
const wb = XLSX.readFile('GAN.xlsx', { cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

function mc(s) {
  if (!s) return '';
  let str = s.toString().trim().replace(/\s+/g, ' ').toLowerCase();
  const prefixes = ['גן', 'צהרון', 'ביהס', 'ביס'];
  for (let p of prefixes) { if (str.startsWith(p)) { str = str.substring(p.length).trim(); break; } }
  return str.split(' - ')[0].split(' / ')[0].split('-')[0].trim();
}

// Check a few SRAWS entries
console.log('=== SRAWS SAMPLES ===');
for (let i = 0; i < 3; i++) {
  const s = SRAWS[i];
  console.log(`SRAWS[${i}]: a="${s.a}", mc="${mc(s.a)}", d="${s.d}", g=${s.g}, t="${s.t}"`);
}

// Check a few Excel entries
console.log('\n=== EXCEL SAMPLES ===');
for (let i = 1; i < 5; i++) {
  const r = rows[i];
  if (!r) continue;
  const rawA = String(r[8] || '');
  console.log(`Row ${i}: supplier="${rawA}", mc="${mc(rawA)}", date="${r[5]}", garden="${r[3]}", time="${r[11]}", groups="${r[10]}"`);
}

// Count matching keys
const srawsKeys = new Set();
SRAWS.forEach(s => {
  const normT = (t) => { if(!t) return '00:00'; let m = String(t).match(/(\d{1,2}):(\d{1,2})/); if(!m) return '00:00'; return m[1].padStart(2,'0')+':'+m[2].padStart(2,'0'); };
  const k = `${s.d}|${Number(s.g)}|${mc(s.a)}|${normT(s.t)}`;
  srawsKeys.add(k);
});

let matched = 0, unmatched = 0, unmatchedExamples = [];
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r || !r[5] || !r[3] || !r[8]) continue;
  let d = '';
  const rd = r[5];
  if (rd instanceof Date) d = rd.toISOString().slice(0, 10);
  else if (typeof rd === 'number') d = new Date(new Date(1899,11,30).getTime() + rd*86400000 + 12*3600000).toISOString().slice(0, 10);
  if (!d) continue;
  
  const normT = (t) => { if(!t) return '00:00'; if(typeof t === 'number') { const m = Math.round(t * 1440); return Math.floor(m/60).toString().padStart(2,'0')+':'+(m%60).toString().padStart(2,'0'); } let m = String(t).match(/(\d{1,2}):(\d{1,2})/); if(!m) return '00:00'; return m[1].padStart(2,'0')+':'+m[2].padStart(2,'0'); };
  
  // Need garden ID - use eval to get GARDENS
  // Just check keys without garden ID for now - match by date+supplier+time
  const k_noG = `${d}|${mc(String(r[8]))}|${normT(r[11])}`;
  
  // Also need to build sraws keys without garden
  if (i === 1) {
    // Build sraws keys without garden for comparison
    const srawsKeysNoG = new Set();
    SRAWS.forEach(s => {
      const k2 = `${s.d}|${mc(s.a)}|${normT(s.t)}`;
      srawsKeysNoG.add(k2);
    });
    console.log('\nSRAWS key sample (no garden):', [...srawsKeysNoG].slice(0, 3));
    console.log('Excel key sample (no garden):', k_noG);
  }
}

// The real issue: let's compare a specific SRAWS entry with its Excel counterpart
const testSraws = SRAWS[0];
const testKey = `${testSraws.d}|${Number(testSraws.g)}|${mc(testSraws.a)}`;
console.log('\nLooking for SRAWS[0] in Excel:', testKey);

for (let i = 1; i < rows.length && i < 1000; i++) {
  const r = rows[i];
  if (!r || !r[5]) continue;
  let d = '';
  const rd = r[5];
  if (rd instanceof Date) d = rd.toISOString().slice(0, 10);
  else if (typeof rd === 'number') d = new Date(new Date(1899,11,30).getTime() + rd*86400000 + 12*3600000).toISOString().slice(0, 10);
  if (d === testSraws.d) {
    console.log(`  Excel match date: row ${i}, garden="${r[3]}", supplier="${r[8]}", mc="${mc(String(r[8]))}" vs SRAWS mc="${mc(testSraws.a)}"`);
  }
}
