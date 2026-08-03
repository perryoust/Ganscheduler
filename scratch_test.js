const fs = require('fs');
let c = fs.readFileSync('invoices.js', 'utf8');

// Revert matchScore checks in assignment block (both array and single branches)
c = c.replace(
  /const existing = inv\['file_' \+ matchedType\];\s*\r?\n\s*if \(!existing \|\| globalOverwrite \|\| \(existing\.matchScore !== undefined && bestScore > existing\.matchScore\)\) \{\s*\r?\n\s*inv\['file_' \+ matchedType\] = \{ path: file\.link, origin: 'sp', matchScore: bestScore \};/g,
  `if (!inv['file_' + matchedType] || globalOverwrite) {\n              inv['file_' + matchedType] = { path: file.link, origin: 'sp' };`
);

c = c.replace(
  /const existing = matchedInvoice\['file_' \+ matchedType\];\s*\r?\n\s*if \(!existing \|\| globalOverwrite \|\| \(existing\.matchScore !== undefined && bestScore > existing\.matchScore\)\) \{\s*\r?\n\s*matchedInvoice\['file_' \+ matchedType\] = \{ path: file\.link, origin: 'sp', matchScore: bestScore \};/g,
  `if (!matchedInvoice['file_' + matchedType] || globalOverwrite) {\n              matchedInvoice['file_' + matchedType] = { path: file.link, origin: 'sp' };`
);

fs.writeFileSync('invoices.js', c, 'utf8');
console.log('Done - reverted matchScore assignment logic');
