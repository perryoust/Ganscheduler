const fs = require('fs'); const code = fs.readFileSync('cal.js', 'utf8'); try { new Function(code)(); console.log('cal OK'); } catch(e) { console.error('cal ERROR', e); }
