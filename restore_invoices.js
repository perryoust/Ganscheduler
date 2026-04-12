// Restore invoices to Firebase
const fs = require('fs');
const https = require('https');

const TOKEN = process.argv[2];
if (!TOKEN) { console.error('Usage: node restore_invoices.js <TOKEN>'); process.exit(1); }

const data = fs.readFileSync('sanitized_invoices.json', 'utf8');
console.log('Payload size:', (Buffer.byteLength(data) / 1024).toFixed(1), 'KB');
console.log('Invoice keys:', Object.keys(JSON.parse(data)).length);

const url = new URL('https://ganmanage-default-rtdb.europe-west1.firebasedatabase.app/data/invoices.json?auth=' + TOKEN);

const options = {
  hostname: url.hostname,
  path: url.pathname + url.search,
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

console.log('Uploading to Firebase...');
const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    if (res.statusCode === 200) {
      console.log('✅ Invoices restored successfully!');
      // Verify count
      const resp = JSON.parse(body);
      console.log('Response keys:', Object.keys(resp).length);
    } else {
      console.log('❌ Error:', body.substring(0, 500));
    }
  });
});

req.on('error', (e) => { console.error('Request error:', e.message); });
req.write(data);
req.end();
