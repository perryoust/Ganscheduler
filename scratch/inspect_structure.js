const fs = require('fs');

function inspect(filename) {
  console.log(`\n=== Inspecting ${filename} ===`);
  if (!fs.existsSync(filename)) {
    console.log('File not found');
    return;
  }
  try {
    const raw = fs.readFileSync(filename, 'utf8');
    const data = JSON.parse(raw);
    console.log('Top-level keys:', Object.keys(data));
    if (data.data) {
      console.log('Data keys:', Object.keys(data.data));
      if (data.data.invoices) {
        const invs = data.data.invoices;
        const count = Array.isArray(invs) ? invs.length : Object.keys(invs).length;
        console.log(`data.invoices type: ${typeof invs}, count: ${count}`);
        if (count > 0) {
          const first = Array.isArray(invs) ? invs[0] : Object.values(invs)[0];
          console.log('First invoice sample:', first);
        }
      }
    }
    if (data.invoices) {
      const invs = data.invoices;
      const count = Array.isArray(invs) ? invs.length : Object.keys(invs).length;
      console.log(`invoices type: ${typeof invs}, count: ${count}`);
      if (count > 0) {
        const first = Array.isArray(invs) ? invs[0] : Object.values(invs)[0];
        console.log('First invoice sample:', first);
      }
    }
  } catch(e) {
    console.log('Error:', e.message);
  }
}

inspect('backup.json');
inspect('payload.json');
