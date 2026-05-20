const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.js'));
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('_fbSignIn')) {
    console.log(`Found _fbSignIn in ${f}`);
  }
});
