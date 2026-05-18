const fs = require('fs');
const path = require('path');

async function check() {
  console.log('=== PROCUREMENT DATA DIAGNOSTIC ===');
  
  // 1. Check payload.json
  const payloadPath = path.join(__dirname, '..', 'payload.json');
  if (fs.existsSync(payloadPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
      const count = Array.isArray(data.invoices) ? data.invoices.length : (data.invoices ? Object.keys(data.invoices).length : 0);
      console.log(`payload.json: invoices count = ${count}`);
    } catch(e) {
      console.log(`payload.json: error reading - ${e.message}`);
    }
  } else {
    console.log('payload.json: not found');
  }

  // 2. Check backup.json
  const backupPath = path.join(__dirname, '..', 'backup.json');
  if (fs.existsSync(backupPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      const count = Array.isArray(data.invoices) ? data.invoices.length : (data.invoices ? Object.keys(data.invoices).length : 0);
      console.log(`backup.json: invoices count = ${count}`);
    } catch(e) {
      console.log(`backup.json: error reading - ${e.message}`);
    }
  } else {
    console.log('backup.json: not found');
  }

  // 3. Check Firebase live invoices
  try {
    const res = await fetch('https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data/invoices.json');
    if (res.ok) {
      const data = await res.json();
      const count = Array.isArray(data) ? data.length : (data ? Object.keys(data).length : 0);
      console.log(`Firebase live: invoices count = ${count}`);
    } else {
      console.log(`Firebase live: fetch failed - status ${res.status}`);
    }
  } catch(e) {
    console.log(`Firebase live: error - ${e.message}`);
  }
}

check();
