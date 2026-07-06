const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// The HTML buttons look like: <button class="btn bg" onclick="navCal(-1)">◀</button>
html = html.replace(/onclick="([^"]*?)\(-1\)"\s*>◀<\/button>/g, 'onclick="$1(-1)">▶</button>');
html = html.replace(/onclick="([^"]*?)\(1\)"\s*>▶<\/button>/g, 'onclick="$1(1)">◀</button>');

fs.writeFileSync('index.html', html);
console.log('Fixed arrows in index.html');
