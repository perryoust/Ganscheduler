const fs = require('fs');
let lines = fs.readFileSync('index.html', 'utf8').split('\n');

// Remove line 2513 (which is index 2512)
console.log('Removing line 2513:', lines[2512]);
lines.splice(2512, 1);

// Remove line 617 (which is index 616)
console.log('Removing line 617:', lines[616]);
lines.splice(616, 1);

const content = lines.join('\n');

let stack = [];
const regex = /<\/?(div|body|html)\b[^>]*>/gi;
let match;
let mismatches = 0;
while ((match = regex.exec(content)) !== null) {
  const tag = match[0];
  const isClose = tag.startsWith('</');
  const tagName = match[1].toLowerCase();
  if (!isClose) {
    let idMatch = tag.match(/id=\s*["']([^"']+)["']/i);
    let classMatch = tag.match(/class=\s*["']([^"']+)["']/i);
    stack.push({
      tagName,
      id: idMatch ? idMatch[1] : null,
      className: classMatch ? classMatch[1] : null,
      line: content.substring(0, match.index).split('\n').length
    });
  } else {
    if (stack.length > 0) {
      const open = stack.pop();
    } else {
      console.log(`Mismatched close tag ${tag} on line ${content.substring(0, match.index).split('\n').length}`);
      mismatches++;
    }
  }
}
if (stack.length > 0) {
  console.log('Remaining open tags in stack:');
  stack.forEach(s => console.log(`  Line ${s.line}: <${s.tagName} id="${s.id}" class="${s.className}">`));
  mismatches += stack.length;
} else {
  console.log('No remaining open tags.');
}
console.log(`Total mismatches: ${mismatches}`);
