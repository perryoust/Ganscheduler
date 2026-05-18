const https = require('https');

https.get('https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data.json', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Keys at root:', Object.keys(parsed));
      if (parsed.seq) console.log('seq:', parsed.seq);
      if (parsed.ts) console.log('ts:', parsed.ts);
      if (parsed.version) console.log('version:', parsed.version);
      
      const mainData = parsed.data || parsed;
      console.log('Main data keys:', Object.keys(mainData));
      
      const sch = mainData.ch || mainData.sch || [];
      console.log('ch length:', sch.length);
      
    } catch (e) {
      console.error('Failed to parse:', e);
    }
  });
}).on('error', (e) => {
  console.error(e);
});
