const fs = require('fs');
let s = fs.readFileSync('suppliers.js', 'utf8');

// The corrupted text
const badText = "summaryTitle: window._supExName ? ריכוז פעילות לספק:  (טווח:  - ) : ריכוז פעילות כל הספקים (טווח:  - )\\n  });";

// The good text
const goodText = "summaryTitle: window._supExName ? \ריכוז פעילות לספק: \ (טווח: \ - \)\ : \ריכוז פעילות כל הספקים (טווח: \ - \)\\\n  });";

s = s.replace(badText, goodText);

// If the above replace didn't work because of backslashes or newlines:
s = s.replace(/summaryTitle:.*\\}\\);/g, goodText);

fs.writeFileSync('suppliers.js', s);