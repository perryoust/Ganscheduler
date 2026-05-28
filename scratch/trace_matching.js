const fs = require('fs');
let lines = fs.readFileSync('index.html', 'utf8').split('\n');

// Remove the three known extra tags
lines.splice(2512, 1); // 2513
lines.splice(711, 1);  // 712
lines.splice(616, 1);  // 617

const content = lines.join('\n');

let stack = [];
const regex = /<\/?(div|body|html)\b[^>]*>/gi;
let match;

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
    if (stack.length > 0) {
      const open = stack.pop();
      if (line >= 1400 && line <= 1410) {
        console.log(`Line ${line}: Closed tag </${tagName}> matching open <${open.tagName} id="${open.id}" class="${open.className}"> from line ${open.line}`);
      }
    }
  }
}
