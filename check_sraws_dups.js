const fs = require('fs');

try {
  const sraws = JSON.parse(fs.readFileSync('sraws.json', 'utf8'));
  const data = sraws.data || sraws;
  
  console.log('Checking for duplicates in schedule data...\n');
  
  // Group by (garden, supplier, date, time)
  const grouped = {};
  let total = 0;
  
  Object.values(data).forEach(item => {
    if (!item || typeof item !== 'object') return;
    if (!item.d) return; // skip if no date
    
    total++;
    const key = `${item.g}|${item.a}|${item.d}|${item.t}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      id: item.id || 'no-id',
      st: item.st || 'ok',
      nt: item.nt || '',
      pd: item.pd || ''
    });
  });
  
  console.log(`Total records: ${total}`);
  
  const dups = Object.entries(grouped).filter(([k, v]) => v.length > 1);
  console.log(`Groups with >1 entry: ${dups.length}\n`);
  
  if (dups.length > 0) {
    console.log('Duplicates found:\n');
    dups.slice(0, 20).forEach(([k, entries]) => {
      console.log(`${k}`);
      entries.forEach((e, i) => {
        console.log(`  [${i}] id=${e.id}, st=${e.st}, pd=${e.pd}`);
      });
      console.log('');
    });
  } else {
    console.log('No duplicate (garden|supplier|date|time) combinations found.');
  }
  
} catch(e) {
  console.error('Error:', e.message);
  process.exit(1);
}
