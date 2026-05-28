const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
let stack = [];
const regex = /<\/?(div|body|html)\b[^>]*>/gi;
let match;
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
      if (open.id || (open.className && open.className.includes('content'))) {
        console.log(`Line ${open.line}: Open <${open.tagName} id="${open.id}" class="${open.className}"> closed on line ${content.substring(0, match.index).split('\n').length}`);
      }
    } else {
      console.log(`Mismatched close tag ${tag} on line ${content.substring(0, match.index).split('\n').length}`);
    }
  }
}
if (stack.length > 0) {
  console.log('Remaining open tags in stack:');
  stack.forEach(s => console.log(`  Line ${s.line}: <${s.tagName} id="${s.id}" class="${s.className}">`));
} else {
  console.log('No remaining open tags.');
}
