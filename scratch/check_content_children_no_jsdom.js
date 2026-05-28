const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// A simple regex parser to find direct children of <div class="content">
// Let's locate '<div class="content">'
const startIdx = content.indexOf('<div class="content">');
if (startIdx === -1) {
  console.log('Error: <div class="content"> not found');
  process.exit(1);
}

// Let's slice from startIdx
const subContent = content.substring(startIdx + '<div class="content">'.length);

// We will scan tags and keep track of nesting level.
// When nesting level is 1, it's a direct child of .content!
let level = 1;
const tagRegex = /<(\/?)([a-zA-Z0-9:-]+)(?:\s+([^>]*))?>/g;
let match;
console.log('Direct children of .content:');
while ((match = tagRegex.exec(subContent)) !== null) {
  const isClose = match[1] === '/';
  const tagName = match[2].toLowerCase();
  const attrs = match[3] || '';

  if (isClose) {
    level--;
    if (level === 0) {
      console.log('Finished parsing .content');
      break;
    }
  } else {
    // Check if it's a self-closing tag
    const isSelfClosing = attrs.endsWith('/') || ['img', 'br', 'hr', 'input', 'link', 'meta'].includes(tagName);
    
    if (level === 1) {
      // Direct child!
      const idMatch = attrs.match(/id=["']([^"']+)["']/i);
      const classMatch = attrs.match(/class=["']([^"']+)["']/i);
      const styleMatch = attrs.match(/style=["']([^"']+)["']/i);
      console.log(`Tag: <${tagName}>, id="${idMatch ? idMatch[1] : ''}", class="${classMatch ? classMatch[1] : ''}", style="${styleMatch ? styleMatch[1] : ''}"`);
    }

    if (!isSelfClosing) {
      level++;
    }
  }
}
