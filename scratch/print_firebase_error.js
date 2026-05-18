const https = require('https');

https.get('https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data.json', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Raw Firebase Response:', data);
  });
}).on('error', (e) => {
  console.error(e);
});
