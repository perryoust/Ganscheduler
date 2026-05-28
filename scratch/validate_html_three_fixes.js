const fs = require('fs');
let lines = fs.readFileSync('index.html', 'utf8').split('\n');

// Let's remove the three extra close tags.
// Note: We must remove them from highest line number to lowest line number to avoid messing up the indices.
// 1. Line 2513 (index 2512)
console.log('Removing line 2513:', lines[2512]);
lines.splice(2512, 1);

// 2. Line 712 (index 711)
console.log('Removing line 712:', lines[711]);
lines.splice(711, 1);

// 3. Line 617 (index 616)
console.log('Removing line 617:', lines[616]);
lines.splice(616, 1);

const content = lines.join('\n');

let stack = [];
const regex = /<\/?(div|body|html)\b[^>]*>/gi;
let match;
let errors = 0;

while ((match = regex.exec(content)) !== null) {
  const tag = match[0];
  const isClose = tag.startsWith('</');
  const tagName = match[1].toLowerCase();
  const line = content.substring(0, match.index).split('\n').length;
  
  if (!isClose) {
    let idMatch = tag.match(/id=\s*["']([^"']+)["']/i);
    let classMatch = tag.match(/class=\s*["']([^"']+)["']/i);
    stack.push({
      tagName,
      id: idMatch ? idMatch[1] : null,
      className: classMatch ? classMatch[1] : null,
      line
    });
  } else {
    if (stack.length === 0) {
      console.log(`Error: Close tag </${tagName}> on line ${line} has no matching open tag.`);
      errors++;
    } else {
      const open = stack.pop();
      if (open.tagName !== tagName) {
        console.log(`Error: Close tag </${tagName}> on line ${line} mismatches open tag <${open.tagName} id="${open.id}" class="${open.className}"> on line ${open.line}`);
        errors++;
      }
    }
  }
}

if (stack.length > 0) {
  console.log('Error: Remaining open tags at end of file:');
  stack.forEach(s => console.log(`  Line ${s.line}: <${s.tagName} id="${s.id}" class="${s.className}">`));
  errors += stack.length;
}

console.log(`Validation complete. Errors found: ${errors}`);
