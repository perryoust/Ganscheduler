const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// We want to find ALL occurrences of:
// onclick="...(-1)..." ... >◀</button>
// and change ◀ to ▶
html = html.replace(/(onclick="[^"]*\(-1\)[^"]*"[^>]*>)◀(<\/button>)/g, '$1▶$2');

// And ALL occurrences of:
// onclick="...(1)..." ... >▶</button>
// and change ▶ to ◀
// (Be careful not to match -1 with \b1\b, but the regex [^"]*\(1\) is pretty safe since -1 has a minus)
html = html.replace(/(onclick="[^"]*[^-]\(1\)[^"]*"[^>]*>)▶(<\/button>)/g, '$1◀$2');
// Also handle case where it's exactly "(1)"
html = html.replace(/(onclick="[^"]*\(1\)[^"]*"[^>]*>)▶(<\/button>)/g, '$1◀$2');


fs.writeFileSync('index.html', html);
console.log('Fixed ALL arrows in index.html');
