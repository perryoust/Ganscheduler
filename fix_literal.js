const fs = require('fs');
let content = fs.readFileSync('invoices.js', 'utf8');

const target1 = '\\n  // ── Step 6';
const target2 = '\\n  // ""? Step 6';

if (content.includes(target1)) {
  content = content.replace(target1, '\n  // ── Step 6');
  console.log('Fixed target1');
} else if (content.includes(target2)) {
  content = content.replace(target2, '\n  // ── Step 6');
  console.log('Fixed target2');
} else if (content.includes('\\n')) {
  // Just find the literal \n before Step 6
  const idx = content.indexOf('\\n  //');
  if (idx !== -1) {
    content = content.slice(0, idx) + '\n' + content.slice(idx + 2);
    console.log('Fixed generic \\n');
  } else {
    console.log('Could not find literal \\n before Step 6');
  }
}

fs.writeFileSync('invoices.js', content, 'utf8');
