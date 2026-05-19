const fs = require('fs');

const API_KEY = "AIzaSyDiUrCk_eOQ_bmAc1ZCXrSaelG-HpaTLfA";
const EMAIL = "perry@ganmanager.app";
const PASSWORD = "pe5178";

async function run() {
  console.log('=== AUTHENTICATING WITH FIREBASE ===');
  try {
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true })
    });
    
    if (!authRes.ok) {
      const err = await authRes.json();
      throw new Error(`Auth failed: ${JSON.stringify(err)}`);
    }
    
    const authData = await authRes.json();
    const token = authData.idToken;
    console.log('Authentication successful! Token acquired.');
    
    // Fetch live invoices
    const invUrl = `https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data/invoices.json?auth=${token}`;
    console.log('Fetching live invoices from Firebase...');
    const res = await fetch(invUrl);
    if (res.ok) {
      const invoices = await res.json();
      if (!invoices) {
        console.log('Invoices node is null/empty in Firebase database!');
      } else {
        const count = Array.isArray(invoices) ? invoices.length : Object.keys(invoices).length;
        console.log(`Invoices loaded from Firebase: ${count}`);
        const first = Array.isArray(invoices) ? invoices[0] : Object.values(invoices)[0];
        console.log('First invoice sample:', first);
        
        // Save a copy of this cloud data to check locally
        fs.writeFileSync('scratch/cloud_invoices_temp.json', JSON.stringify(invoices, null, 2), 'utf8');
        console.log('Saved cloud invoices snapshot to scratch/cloud_invoices_temp.json');
      }
    } else {
      console.log(`Fetch failed with status ${res.status}`);
    }
  } catch(e) {
    console.error('Error:', e.message);
  }
}

run();
