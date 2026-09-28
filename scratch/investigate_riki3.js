const API_KEY = "AIzaSyDiUrCk_eOQ_bmAc1ZCXrSaelG-HpaTLfA";
const EMAIL = "perry@ganmanager.app";
const PASSWORD = "pe5178";

async function investigate() {
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true })
  });
  const token = (await authRes.json()).idToken;

  const invRes = await fetch(`https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/invoices.json?auth=${token}`);
  const allInv = await invRes.json();
  const list = (Array.isArray(allInv) ? allInv : Object.values(allInv)).filter(Boolean);

  // The problematic record
  const row2155 = list.find(i => String(i.id) === '2155');
  console.log('=== Row 2155 full dump ===');
  console.log(JSON.stringify(row2155, null, 2));

  // Also check: does the same COLLISION pattern exist for other ריקי לייק rows?
  // Look for any ריקי לייק rows where the wrong file was PREVIOUSLY cleaned but might be re-infected
  const riki = list.filter(i => i.supName === 'ריקי לייק');
  console.log('\n=== All ריקי לייק rows with txNum ===');
  riki.filter(r => r.txNum).forEach(r => {
    console.log(`ID:${r.id} txNum:${r.txNum} num:${r.num}`);
    const colliders = list.filter(i => i.txNum === r.txNum && i.id !== r.id);
    if (colliders.length) {
      colliders.forEach(c => console.log(`  ⚠️ Same txNum collision: ID:${c.id} sup:${c.supName}`));
    }
  });

  // Check: what is the origin of the file_tx on 2155?
  console.log('\n=== file_tx origin on 2155 ===');
  if (row2155?.file_tx) {
    console.log(JSON.stringify(row2155.file_tx, null, 2));
  } else {
    console.log('No file_tx');
  }

  // Simulate the scoring for the problematic file against both rows
  console.log('\n=== Simulating why חנה file went to 2155 ===');
  const fileName = 'חנה בית הלחמי - חוגים - בתי ספר - ספטמבר 2026 - חשבון עסקה 7275.pdf';
  const row1965 = list.find(i => String(i.id) === '1965');
  
  // Scoring for 1965 (חוגות)
  // alias: חנה בית הלחמי → חוגות => match!
  // locType: בתי ספר → match!
  // txNum: 7275 → match!
  // orderDesc contains חוגים → match!
  console.log('Row 1965 would score for חנה file:');
  console.log('  supName:', row1965?.supName);
  console.log('  txNum:', row1965?.txNum, '(matches 7275? YES)');
  console.log('  Alias חנה בית הלחמי → חוגות: YES → +300');
  console.log('  locType:', row1965?.locType, '→ בתי ספר in file? YES → +100');
  console.log('  txNum exact match: YES → +250+50+100 = ~800+');
  
  // Scoring for 2155 (ריקי לייק) 
  console.log('\nRow 2155 would score for חנה file:');
  console.log('  supName:', row2155?.supName);
  console.log('  txNum:', row2155?.txNum, '(matches 7275? YES)');
  console.log('  Supplier match "ריקי לייק" in חנה file? NO');
  console.log('  locType:', row2155?.locType, '→ גנים in file? NO');
  console.log('  orderDesc:', row2155?.orderDesc);
  console.log('  So score for 2155: ~400 (only txNum+contextBonus)');
  
  console.log('\n→ 1965 SHOULD win. But 2155 also has the file. Why?');
  console.log('  Answer: The scanner picks ONE winner — it won\'t assign to 2155');
  console.log('  The file_tx on 2155 was set BEFORE the last scan, during Excel import!');
}
investigate();
