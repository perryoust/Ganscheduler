// Verification script for garden pairs cleanup logic
global.window = global;

// Mock DOM/environment
global._safeLS = { getItem: () => null, setItem: () => null };

// Load real data.js
const fs = require('fs');
let dataContent = fs.readFileSync('c:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\הורדות\\Ganscheduler-main\\Ganscheduler\\data.js', 'utf8');
dataContent = dataContent.replace('var GARDENS=', 'global.GARDENS=');
dataContent = dataContent.replace('var GARDEN_PHONES=', 'global.GARDEN_PHONES=');
dataContent = dataContent.replace('var AUTOPAIRS=', 'global.AUTOPAIRS=');
eval(dataContent);

global.G = function(id) {
  return window.GARDENS.find(g => Number(g.id) === Number(id)) || {};
};

// Setup initial pairs
window.pairs = [
  { id: 1, ids: [77, 10], name: 'גן סהר + גן אגמית' },
  { id: 2, ids: [94, 24], name: 'גן צדף (חמ"ד) + גן אשכולית' }
];

console.log('--- Initial Pairs ---');
console.log(JSON.stringify(window.pairs, null, 2));

// Test cleanup function mimicking the new logic
function testAddPair(ids, name) {
  const targetId = 100; // Mock target ID
  window.pairs.push({ id: targetId, ids, name });

  // Cleanup duplicates from other pairs
  window.pairs = window.pairs.map(p => {
    if (p.id === targetId) return p;
    return { ...p, ids: p.ids.filter(id => !ids.map(Number).includes(Number(id))) };
  }).filter(p => p.ids.length >= 2);
}

// Add the new pair of [77, 94] (גן סהר וגן צדף)
console.log('\n--- Adding Pair [77, 94] (גן סהר + גן צדף (חמ"ד)) ---');
testAddPair([77, 94], 'גן סהר + גן צדף (חמ"ד)');

console.log('\n--- Pairs After Cleanup ---');
console.log(JSON.stringify(window.pairs, null, 2));

// Verify that 77 and 94 were successfully removed from their old pairs, and those old pairs are removed because they have less than 2 gardens
const pairFor77 = window.pairs.find(p => p.ids.includes(77));
const pairFor94 = window.pairs.find(p => p.ids.includes(94));

if (window.pairs.length === 1 && window.pairs[0].id === 100) {
  console.log('\n✅ Success! The new pair is saved and the old duplicate pairs are cleaned up correctly!');
  process.exit(0);
} else {
  console.log('\n❌ Failure. Cleanup did not produce the expected result.');
  process.exit(1);
}
