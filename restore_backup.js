// Restore full backup to Firebase
const fs = require('fs');
const https = require('https');
const path = require('path');

const TOKEN = process.argv[2];
if (!TOKEN) { console.error('Usage: node restore_backup.js <TOKEN>'); process.exit(1); }

const backupPath = path.join(
  'C:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות',
  'גיבוי_מנהל_גנים_2026-04-10_18-12.json'
);

const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

// Sanitize Firebase keys
function sanitizeKey(k) {
  return k.replace(/\./g, '｡').replace(/\$/g, '＄').replace(/#/g, '＃')
          .replace(/\[/g, '［').replace(/\]/g, '］').replace(/\//g, '∕');
}
function sanitizeSupEx(obj) {
  if (!obj) return {};
  const out = {};
  Object.entries(obj).forEach(([k, v]) => { out[sanitizeKey(k)] = v; });
  return out;
}

// Build the main data payload (without invoices — they go separately)
const nowTs = Date.now();
const mainPayload = {
  data: {
    ch: backup.ch || [],
    pairs: backup.pairs || [],
    supEx: sanitizeSupEx(backup.supEx || {}),
    clusters: backup.clusters || {},
    holidays: backup.holidays || [],
    pairBreaks: backup.pairBreaks || {},
    managers: backup.managers || {},
    blockedDates: backup.blockedDates || {},
    gardenBlocks: backup.gardenBlocks || {},
    activeGardens: backup.activeGardens || null,
    vatRate: backup.vatRate || 18
  },
  ts: nowTs,
  version: '10.2'
};

console.log('Main payload size:', (Buffer.byteLength(JSON.stringify(mainPayload)) / 1024).toFixed(1), 'KB');
console.log('Activities:', mainPayload.data.ch.length);
console.log('Pairs:', mainPayload.data.pairs.length);

// Build invoices payload (keyed by ID for Firebase)
const invoices = backup.invoices || [];
const invObj = {};
invoices.forEach(inv => {
  if (inv && inv.id) invObj[inv.id] = inv;
});
console.log('Invoices:', Object.keys(invObj).length);
console.log('Invoices payload size:', (Buffer.byteLength(JSON.stringify(invObj)) / 1024).toFixed(1), 'KB');

function putToFirebase(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const url = new URL('https://ganmanage-default-rtdb.europe-west1.firebasedatabase.app' + path + '?auth=' + TOKEN);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(responseBody);
        } else {
          reject(new Error(`Status ${res.statusCode}: ${responseBody.substring(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  try {
    // Step 1: Restore main data
    console.log('\n[1/2] Uploading main data to /data.json...');
    await putToFirebase('/data.json', mainPayload);
    console.log('✅ Main data restored!');

    // Step 2: Restore invoices separately
    console.log('[2/2] Uploading invoices to /data/invoices.json...');
    await putToFirebase('/data/invoices.json', invObj);
    console.log('✅ Invoices restored!');

    console.log('\n🎉 Full backup restored successfully!');
    console.log('Timestamp:', new Date(nowTs).toISOString());
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
