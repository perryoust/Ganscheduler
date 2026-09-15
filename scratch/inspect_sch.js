const fs = require('fs');
const raw = fs.readFileSync('C:/Users/Perry/.gemini/antigravity-ide/brain/cc69a157-75a3-4692-83e2-535c46ccfe65/.system_generated/steps/3007/output.txt', 'utf8');
const sch = JSON.parse(raw);
console.log('Total schedules:', Array.isArray(sch) ? sch.length : 'not array');
const found = {};
for (const s of sch) {
  if (s && s.a && (s.a.includes('עליזה') || s.a.includes('קצב') || s.a.includes('קריבושי') || s.a.includes('לגדול') || s.a.includes('סיפורים'))) {
    found[s.a] = (found[s.a] || 0) + 1;
    if (!found[s.a + '_sample']) {
      found[s.a + '_sample'] = { id: s.id, d: s.d, a: s.a, act: s.act, st: s.st };
    }
  }
}
console.log('Matching s.a in SCH:', JSON.stringify(found, null, 2));
