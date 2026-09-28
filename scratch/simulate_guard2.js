// Simulation v2: verify the REVISED collision guard (rival-in-file approach)
const API_KEY = "AIzaSyDiUrCk_eOQ_bmAc1ZCXrSaelG-HpaTLfA";
const EMAIL = "perry@ganmanager.app";
const PASSWORD = "pe5178";

const cleanSupText = (str) => String(str || '').toLowerCase()
  .replace(/["'״׳`]/g, '').replace(/\s*\(?\s*בע[\s.]*מ\s*\)?\s*/gi, ' ')
  .replace(/\s*\(?\s*ltd\.?\s*\)?\s*/gi, ' ').replace(/ניקיון|נקיון/g, 'ניקוי')
  .replace(/[-_.,()]/g, ' ').replace(/\s+/g, ' ').trim();

const BUILTIN_ALIASES = {
  'חנה בית הלחמי': 'חוגות', 'בית הלחמי': 'חוגות',
  'עדי קייטרינג': 'עדי מ קייטרינג בע"מ', 'עדי קייטרינג בע"מ': 'עדי מ קייטרינג בע"מ',
  'גטאקסי': 'ג\'יט גטאקסי סרוויסס ישראל בע"מ', 'גט טקסי': 'ג\'יט גטאקסי סרוויסס ישראל בע"מ',
  'גט': 'ג\'יט גטאקסי סרוויסס ישראל בע"מ', 'gett': 'ג\'יט גטאקסי סרוויסס ישראל בע"מ',
  'שחר חוויות': 'שחר חוויות חינוכיות בע"מ', 'שחר': 'שחר חוויות חינוכיות בע"מ',
  'רוזי עמית': 'קידו התעמלות רוזי עמית', 'קידו': 'קידו התעמלות רוזי עמית', 'קידו התעמלות': 'קידו התעמלות רוזי עמית',
  'מקס סטוק': 'קרנית רייזל', 'זול סטוק': 'דנית שאול',
  'עולם הגלידה': 'קרנית רייזל', 'טל עולם הגלידה': 'דנית שאול'
};
const aliasEntries = Object.entries(BUILTIN_ALIASES).map(([alias, target]) => ({
  aliasClean: cleanSupText(alias), targetClean: cleanSupText(target), targetRaw: target
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

  const cleanDocNum = val => val === null || val === undefined ? '' : String(val).replace(/\D/g, '').replace(/^0+/, '') || '0';
  const invPrep = list.map(inv => ({
    inv,
    cleanNum: inv.num ? cleanDocNum(inv.num) : '',
    cleanTx:  inv.txNum ? cleanDocNum(inv.txNum) : '',
    cleanSup: cleanSupText(inv.supName || ''),
  }));

  const txNumToSups = new Map(), numToSups = new Map();
  invPrep.forEach(p => {
    if (p.cleanTx) { if (!txNumToSups.has(p.cleanTx)) txNumToSups.set(p.cleanTx, new Set()); txNumToSups.get(p.cleanTx).add(p.cleanSup); }
    if (p.cleanNum) { if (!numToSups.has(p.cleanNum)) numToSups.set(p.cleanNum, new Set()); numToSups.get(p.cleanNum).add(p.cleanSup); }
  });
  const txNumCollisionSet = new Set(), numCollisionSet = new Set();
  txNumToSups.forEach((s, k) => { if (s.size > 1) txNumCollisionSet.add(k); });
  numToSups.forEach((s, k) => { if (s.size > 1) numCollisionSet.add(k); });

  // NEW guard logic: block only if a rival supplier's name appears in the file
  const wouldGuardBlock = (fileName, cleanSup, type, cleanNumStr) => {
    const isCollisionNum = (type === 'tx' && txNumCollisionSet.has(cleanNumStr)) ||
                           (type === 'tax' && numCollisionSet.has(cleanNumStr));
    if (!isCollisionNum) return false;
    const cleanF = (fileName || '').toLowerCase();
    const rivalSups = type === 'tx' ? [...(txNumToSups.get(cleanNumStr) || [])]
                                    : [...(numToSups.get(cleanNumStr) || [])];
    for (const rivalClean of rivalSups) {
      if (rivalClean === cleanSup) continue;
      const rivalWords = rivalClean.split(/\s+/).filter(w => w.length >= 3);
      if (rivalWords.some(w => cleanF.includes(w))) return true;
      for (const ae of aliasEntries) {
        if (ae.targetClean === rivalClean && cleanF.includes(ae.aliasClean)) return true;
      }
    }
    return false;
  };

  let blocked = 0, passed = 0, noCollision = 0;
  const blockedList = [];

  for (const p of invPrep) {
    const inv = p.inv;
    for (const [fileKey, field, type] of [['file_tx', 'txNum', 'tx'], ['file_tax', 'num', 'tax']]) {
      if (!inv[fileKey] || !inv[fileKey].path) continue;
      const fileName = inv[fileKey].name || '';
      const cleanDocN = type === 'tx' ? p.cleanTx : p.cleanNum;
      if (!cleanDocN) { noCollision++; continue; }
      if (wouldGuardBlock(fileName, p.cleanSup, type, cleanDocN)) {
        blocked++;
        blockedList.push({ id: inv.id, sup: inv.supName, docNum: inv[field], file: fileName, type });
      } else if ((type === 'tx' && txNumCollisionSet.has(cleanDocN)) || (type === 'tax' && numCollisionSet.has(cleanDocN))) {
        passed++;
      } else {
        noCollision++;
      }
    }
  }

  if (blockedList.length > 0) {
    console.log(`\n=== WOULD BLOCK (${blocked}) ===`);
    blockedList.forEach(b => console.log(`  ❌ ID:${b.id} sup:"${b.sup}" ${b.type}Num:${b.docNum}\n     file: ${b.file}`));
  }
  console.log(`\n=== SUMMARY ===`);
  console.log(`  ✅ Collision + passes guard: ${passed}`);
  console.log(`  ❌ Would BLOCK: ${blocked}`);
  console.log(`  ⬜ No collision (guard inactive): ${noCollision}`);

  // Special case: simulate חנה בית הלחמי 7275 vs ריקי לייק
  console.log('\n=== Test: file "חנה בית הלחמי...7275" vs ריקי לייק (2155) ===');
  const fileName = 'חנה בית הלחמי - חוגים - בתי ספר - ספטמבר 2026 - חשבון עסקה 7275.pdf';
  const rikiFake = { cleanSup: cleanSupText('ריקי לייק') };
  const res = wouldGuardBlock(fileName, rikiFake.cleanSup, 'tx', '7275');
  console.log(`  Guard BLOCKS ריקי לייק from getting חנה file? ${res ? '✅ YES (correct!)' : '❌ NO (bug!)'}`);
  const chogotFake = { cleanSup: cleanSupText('חוגות') };
  const res2 = wouldGuardBlock(fileName, chogotFake.cleanSup, 'tx', '7275');
  console.log(`  Guard BLOCKS חוגות from getting חנה file? ${res2 ? '❌ WRONG — should pass' : '✅ Passes correctly'}`);
}
simulate();
