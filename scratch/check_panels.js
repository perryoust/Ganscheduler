const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

const regex = /<div\s+[^>]*id=["'](p-[^"']+)["'][^>]*/gi;
let match;
while ((match = regex.exec(content)) !== null) {
  const fullTag = match[0];
  const id = match[1];
  const classMatch = fullTag.match(/class=["']([^"']+)["']/i);
  const styleMatch = fullTag.match(/style=["']([^"']+)["']/i);
  console.log(`Panel ID: ${id}`);
  console.log(`  Class: ${classMatch ? classMatch[1] : 'none'}`);
  console.log(`  Style: ${styleMatch ? styleMatch[1] : 'none'}`);
}
