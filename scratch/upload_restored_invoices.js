const fs = require('fs');
const path = require('path');

async function upload() {
  console.log('=== RESTORING INVOICES DATABASE TO FIREBASE ===');
  
  const invoicesPath = path.join(__dirname, 'restored_invoices.json');
  if (!fs.existsSync(invoicesPath)) {
    console.error('restored_invoices.json not found at:', invoicesPath);
    return;
  }
  
  const invoices = JSON.parse(fs.readFileSync(invoicesPath, 'utf8'));
  console.log(`Loaded ${invoices.length} invoices from local file.`);
  
  const email = 'perry@ganmanager.app';
  const password = 'pe5178';
  const apiKey = 'AIzaSyDiUrCk_eOQ_bmAc1ZCXrSaelG-HpaTLfA';
  
  try {
    console.log('Authenticating with Firebase Auth REST API...');
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    
    if (!authRes.ok) {
      const err = await authRes.json();
      throw new Error(`Auth failed: ${JSON.stringify(err)}`);
    }
    
    const credentials = await authRes.json();
    const token = credentials.idToken;
    console.log('Authenticated successfully!');
    
    console.log('Uploading invoices to Firebase Realtime Database...');
    const invUrl = `https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data/invoices.json?auth=${token}`;
    
    const uploadRes = await fetch(invUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoices)
    });
    
    if (uploadRes.ok) {
      console.log(`SUCCESS: Successfully uploaded all ${invoices.length} invoices to Firebase!`);
    } else {
      console.error(`Upload failed with status ${uploadRes.status}: ${await uploadRes.text()}`);
    }
  } catch(e) {
    console.error('Error during upload:', e.message);
  }
}

upload();
