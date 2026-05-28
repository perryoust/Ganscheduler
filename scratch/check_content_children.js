const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// We want to parse the children of <div class="content"> and find if there are any that do not have class="panel" or similar.
const { JSDOM } = require('jsdom');
const dom = new JSDOM(content);
const document = dom.window.document;
const contentDiv = document.querySelector('.content');

if (!contentDiv) {
  console.log('Error: .content not found');
  process.exit(1);
}

console.log('Children of .content:');
Array.from(contentDiv.children).forEach((child, idx) => {
  console.log(`${idx}: tag=${child.tagName}, id=${child.id}, class=${child.className}, displayStyle=${child.style.display}`);
});
