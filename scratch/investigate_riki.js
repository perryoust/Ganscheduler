const API_KEY = "AIzaSyDiUrCk_eOQ_bmAc1ZCXrSaelG-HpaTLfA";
const EMAIL = "perry@ganmanager.app";
const PASSWORD = "pe5178";

async function investigate() {
  try {
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true })
    });
    const token = (await authRes.json()).idToken;

    // Check 2155 and nearby rows
    for (const id of ['2155', '2156', '2157', '1965', '1966']) {
      const res = await fetch(`https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/invoices/${id}.json?auth=${token}`);
      const d = await res.json();
      if (!d) { console.log(`=== ${id} === (null/missing)`); continue; }
      console.log(`=== INVOICE ${id} ===`);
      console.log('supName:', d.supName);
      console.log('txNum:', d.txNum, '| num:', d.num, '| orderNum:', d.orderNum);
      console.log('orderTotal:', d.orderTotal, '| locCity:', d.locCity, '| locType:', d.locType);
      console.log('orderDesc:', d.orderDesc);
      console.log('file_tx:', d.file_tx ? `${d.file_tx.name} (score:${d.file_tx.score})` : 'none');
      console.log('file_tax:', d.file_tax ? `${d.file_tax.name} (score:${d.file_tax.score})` : 'none');
      console.log('file_order:', d.file_order ? d.file_order.name : 'none');
    }

    // Scan ALL invoices for any row with txNum=7275 (beside חוגות / ריקי לייק)
    console.log('\n=== ALL invoices with txNum containing 7275 ===');
    const invRes = await fetch(`https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/invoices.json?auth=${token}`);
    const allInv = await invRes.json();
    const list = (Array.isArray(allInv) ? allInv : Object.values(allInv)).filter(Boolean);
    const hits = list.filter(i => String(i.txNum || '').includes('7275') || String(i.num || '').includes('7275'));
    hits.forEach(i => console.log(`ID:${i.id} | sup:${i.supName} | txNum:${i.txNum} | num:${i.num} | file_tx:${i.file_tx?.name || 'none'}`));

    // Also find all rows whose file_tx name contains 7275
    console.log('\n=== All rows with file_tx name containing 7275 ===');
    const fileHits = list.filter(i => i.file_tx?.name?.includes('7275'));
    fileHits.forEach(i => console.log(`ID:${i.id} | sup:${i.supName} | txNum:${i.txNum} | file_tx:${i.file_tx.name} (score:${i.file_tx.score})`));

  } catch (e) {
    console.error('Error:', e.message);
  }
}

investigate();
