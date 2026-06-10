const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('backup.json', 'utf8'));
  const scheds = data.scheds || [];
  
  console.log('Total schedules:', scheds.length);
  
  // Group by (garden, activity, date, time)
  const grouped = {};
  scheds.forEach(s => {
    const key = `${s.g}|${s.a}|${s.d}|${s.t}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  });
  
  const dups = Object.entries(grouped).filter(([k, v]) => v.length > 1);
  console.log('\nTotal duplicate keys:', dups.length);
  
  dups.slice(0, 10).forEach(([k, entries]) => {
    console.log(`\n${k} => ${entries.length} copies`);
    entries.forEach((e, i) => {
      console.log(`  [${i}] id=${e.id}, st=${e.st}, nt=${e.nt || ''}`);
    });
  });
  
  // Also check for same ID appearing twice
  const byId = {};
  scheds.forEach(s => {
    if (!byId[s.id]) byId[s.id] = [];
    byId[s.id].push(s);
  });
  
  const dupIds = Object.entries(byId).filter(([k, v]) => v.length > 1);
  console.log('\n\nSchedules with duplicate IDs:', dupIds.length);
  
} catch(e) {
  console.error('Error:', e.message);
}
