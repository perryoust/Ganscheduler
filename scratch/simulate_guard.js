// Simulation: verify the collision guard doesn't break legitimate links
// This mimics exactly what scanner_worker.js does in the new code.
const API_KEY = "AIzaSyDiUrCk_eOQ_bmAc1ZCXrSaelG-HpaTLfA";
const EMAIL = "perry@ganmanager.app";
const PASSWORD = "pe5178";

const cleanSupText = (str) => {
  return String(str || '').toLowerCase()
    .replace(/["'״׳`]/g, '')
    .replace(/\s*\(?\s*בע[\s.]*מ\s*\)?\s*/gi, ' ')
    .replace(/\s*\(?\s*ltd\.?\s*\)?\s*/gi, ' ')
    .replace(/ניקיון|נקיון/g, 'ניקוי')
    .replace(/[-_.,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};
const cleanDocNum = (val) => {
  if (val === undefined || val === null) return '';
  return String(val).replace(/\D/g, '').replace(/^0+/, '') || '0';
};

const BUILTIN_ALIASES = {
  'חנה בית הלחמי': 'חוגות',
  'בית הלחמי': 'חוגות',
  'עדי קייטרינג': 'עדי מ קייטרינג בע"מ',
  'עדי קייטרינג בע"מ': 'עדי מ קייטרינג בע"מ',
  'גטאקסי': 'ג\'יט גטאקסי סרוויסס ישראל בע"מ',
  'גט טקסי': 'ג\'יט גטאקסי סרוויסס ישראל בע"מ',
  'גט': 'ג\'יט גטאקסי סרוויסס ישראל בע"מ',
  'gett': 'ג\'יט גטאקסי סרוויסס ישראל בע"מ',
  'שחר חוויות': 'שחר חוויות חינוכיות בע"מ',
  'שחר': 'שחר חוויות חינוכיות בע"מ',
  'רוזי עמית': 'קידו התעמלות רוזי עמית',
  'קידו': 'קידו התעמלות רוזי עמית',
  'קידו התעמלות': 'קידו התעמלות רוזי עמית',
  'מקס סטוק': 'קרנית רייזל',
  'זול סטוק': 'דנית שאול',
  'עולם הגלידה': 'קרנית רייזל',
  'טל עולם הגלידה': 'דנית שאול'
};
const aliasEntries = Object.entries(BUILTIN_ALIASES).map(([alias, target]) => ({
  aliasClean: cleanSupText(alias),
  targetClean: cleanSupText(target),
  targetRaw: target
}));

async function simulate() {
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true })
  });
  const token = (await authRes.json()).idToken;

  const invRes = await fetch(`https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/invoices.json?auth=${token}`);
  const allInv = await invRes.json();
  const list = (Array.isArray(allInv) ? allInv : Object.values(allInv)).filter(Boolean);

  // Build invPrep
  const invPrep = list.map(inv => ({
    inv,
    cleanNum:   inv.num      ? cleanDocNum(inv.num)      : '',
    cleanTx:    inv.txNum    ? cleanDocNum(inv.txNum)    : '',
    cleanOrder: inv.orderNum ? cleanDocNum(inv.orderNum) : '',
    cleanSup:   cleanSupText(inv.supName || ''),
  }));

  // Build collision sets (same as new scanner_worker.js)
  const txNumToSups = new Map();
  const numToSups   = new Map();
  invPrep.forEach(p => {
    if (p.cleanTx) {
      if (!txNumToSups.has(p.cleanTx)) txNumToSups.set(p.cleanTx, new Set());
      txNumToSups.get(p.cleanTx).add(p.cleanSup);
    }
    if (p.cleanNum) {
      if (!numToSups.has(p.cleanNum)) numToSups.set(p.cleanNum, new Set());
      numToSups.get(p.cleanNum).add(p.cleanSup);
    }
  });
  const txNumCollisionSet = new Set();
  const numCollisionSet   = new Set();
  txNumToSups.forEach((sups, key) => { if (sups.size > 1) txNumCollisionSet.add(key); });
  numToSups.forEach((sups, key) => { if (sups.size > 1) numCollisionSet.add(key); });

  console.log(`\n=== All txNum collisions (${txNumCollisionSet.size}) ===`);
  txNumCollisionSet.forEach(num => {
    const sups = [...txNumToSups.get(num)];
    console.log(`  txNum ${num} → suppliers: ${sups.join(' | ')}`);
  });

  console.log(`\n=== All num collisions (${numCollisionSet.size}) ===`);
  numCollisionSet.forEach(num => {
    const sups = [...numToSups.get(num)];
    console.log(`  num ${num} → suppliers: ${sups.join(' | ')}`);
  });

  // Now check: for each invoice that HAS a file_tx/file_tax — 
  // if that document number is in a collision set, would the guard PASS or BLOCK it?
  console.log('\n=== Collision Guard simulation on EXISTING correct links ===');
  let guardWouldBlock = 0;
  let guardWouldPass  = 0;
  let noCollision     = 0;

  for (const p of invPrep) {
    const inv = p.inv;

    // Check file_tx (txNum collision)
    if (inv.file_tx && inv.file_tx.path) {
      const fileName = (inv.file_tx.name || '').toLowerCase();
      const cleanTxNum = p.cleanTx;
      if (cleanTxNum && txNumCollisionSet.has(cleanTxNum)) {
        // Guard would activate — check if supplier word is in file
        const supWords = p.cleanSup.split(/\s+/).filter(w => w.length >= 2);
        const supInFile = supWords.some(w => fileName.includes(w));
        let aliasInFile = false;
        for (const ae of aliasEntries) {
          if ((ae.targetClean === p.cleanSup || ae.targetRaw === inv.supName) && fileName.includes(ae.aliasClean)) {
            aliasInFile = true; break;
          }
        }
        if (!supInFile && !aliasInFile) {
          guardWouldBlock++;
          console.log(`  ❌ WOULD BLOCK: ID:${inv.id} sup:"${inv.supName}" txNum:${inv.txNum}`);
          console.log(`     file_tx: ${inv.file_tx.name}`);
          console.log(`     supWords: [${supWords.join(', ')}] — none found in file name`);
        } else {
          guardWouldPass++;
        }
      } else {
        noCollision++;
      }
    }

    // Check file_tax (num collision)
    if (inv.file_tax && inv.file_tax.path) {
      const fileName = (inv.file_tax.name || '').toLowerCase();
      const cleanNumStr = p.cleanNum;
      if (cleanNumStr && numCollisionSet.has(cleanNumStr)) {
        const supWords = p.cleanSup.split(/\s+/).filter(w => w.length >= 2);
        const supInFile = supWords.some(w => fileName.includes(w));
        let aliasInFile = false;
        for (const ae of aliasEntries) {
          if ((ae.targetClean === p.cleanSup || ae.targetRaw === inv.supName) && fileName.includes(ae.aliasClean)) {
            aliasInFile = true; break;
          }
        }
        if (!supInFile && !aliasInFile) {
          guardWouldBlock++;
          console.log(`  ❌ WOULD BLOCK: ID:${inv.id} sup:"${inv.supName}" num:${inv.num}`);
          console.log(`     file_tax: ${inv.file_tax.name}`);
          console.log(`     supWords: [${supWords.join(', ')}] — none found in file name`);
        } else {
          guardWouldPass++;
        }
      } else {
        noCollision++;
      }
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`  ✅ Would pass (collision + supplier match): ${guardWouldPass}`);
  console.log(`  ❌ Would BLOCK (collision, no supplier match): ${guardWouldBlock}`);
  console.log(`  ⬜ No collision (guard inactive): ${noCollision}`);
}
simulate();
