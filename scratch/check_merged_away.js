const fs = require('fs');
const raw = fs.readFileSync('C:/Users/Perry/.gemini/antigravity-ide/brain/cc69a157-75a3-4692-83e2-535c46ccfe65/.system_generated/steps/2987/output.txt', 'utf8');
const data = JSON.parse(raw);
console.log('__merged_away:', JSON.stringify(data['__merged_away'] || []));
