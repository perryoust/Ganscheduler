const API_KEY = "AIzaSyDiUrCk_eOQ_bmAc1ZCXrSaelG-HpaTLfA";
const EMAIL = "perry@ganmanager.app";
const PASSWORD = "pe5178";

async function fix() {
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true })
  });
  const token = (await authRes.json()).idToken;
  const base = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';

  // Fix row 2155: remove the wrong file_tx (חנה בית הלחמי file belongs to 1965/חוגות, not ריקי לייק)
  const r = await fetch(`${base}/invoices/2155/file_tx.json?auth=${token}`, {
    method: 'DELETE'
  });
  console.log('DELETE file_tx from 2155:', r.status, r.statusText);
  const body = await r.text();
  console.log('Response:', body);

  // Verify
  const verify = await fetch(`${base}/invoices/2155.json?auth=${token}`);
  const d = await verify.json();
  console.log('\nAfter fix - Row 2155:');
  console.log('  supName:', d.supName);
  console.log('  txNum:', d.txNum, '| num:', d.num);
  console.log('  file_tx:', d.file_tx ? d.file_tx.name : 'CLEARED ✓');
  console.log('  file_tax:', d.file_tax ? d.file_tax.name : 'none');
}
fix();
