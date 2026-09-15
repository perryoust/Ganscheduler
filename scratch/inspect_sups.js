const fs = require('fs');
const raw = fs.readFileSync('C:/Users/Perry/.gemini/antigravity-ide/brain/cc69a157-75a3-4692-83e2-535c46ccfe65/.system_generated/steps/2987/output.txt', 'utf8');
const data = JSON.parse(raw);
console.log('Top level keys containing עליזה or קצב or קריבושי:');
for (const k of Object.keys(data)) {
  if (k.includes('עליזה') || k.includes('קצב') || k.includes('קריבושי') || k.includes('קיריבושי') || k.includes('לגדול')) {
    console.log('Key:', k, JSON.stringify(data[k]));
  }
}
