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

    const invRes = await fetch(`https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/invoices.json?auth=${token}`);
    const allInv = await invRes.json();
    const list = (Array.isArray(allInv) ? allInv : Object.values(allInv)).filter(Boolean);

    const riki = list.filter(i => i.supName === 'ריקי לייק');
    console.log(`Total ריקי לייק rows: ${riki.length}`);

    // Find all ריקי לייק rows where the attached file does NOT contain "ריקי" or "ריקי לייק"
    const wrong = riki.filter(i => {
      const files = [i.file_tx, i.file_tax, i.file_order].filter(Boolean);
      return files.some(f => {
        const name = (f.name || f.path || '').toLowerCase();
        return !name.includes('ריקי');
      });
    });

    console.log(`\n=== ריקי לייק with WRONG file attachments (${wrong.length}) ===`);
    wrong.forEach(i => {
      console.log(`\nID:${i.id} | txNum:${i.txNum} | num:${i.num}`);
      if (i.file_tx) {
        const isBad = !(i.file_tx.name || '').includes('ריקי');
        console.log(`  file_tx [${isBad ? '❌ WRONG' : '✓ OK'}]: ${i.file_tx.name} (score:${i.file_tx.score})`);
      }
      if (i.file_tax) {
        const isBad = !(i.file_tax.name || '').includes('ריקי');
        console.log(`  file_tax [${isBad ? '❌ WRONG' : '✓ OK'}]: ${i.file_tax.name} (score:${i.file_tax.score})`);
      }
      if (i.file_order) {
        const isBad = !(i.file_order.name || '').includes('ריקי');
        console.log(`  file_order [${isBad ? '❌ WRONG' : '✓ OK'}]: ${i.file_order.name}`);
      }
    });

    // Check: are there other invoices sharing the same txNum as ריקי לייק rows?
    console.log(`\n=== txNum collisions for ריקי לייק ===`);
    riki.forEach(r => {
      if (!r.txNum) return;
      const colliders = list.filter(i => i.txNum === r.txNum && i.id !== r.id);
      if (colliders.length > 0) {
        console.log(`ריקי לייק ID:${r.id} txNum:${r.txNum} collides with:`);
        colliders.forEach(c => console.log(`  → ID:${c.id} sup:${c.supName} txNum:${c.txNum}`));
      }
    });

  } catch (e) {
    console.error('Error:', e.message);
  }
}
investigate();
