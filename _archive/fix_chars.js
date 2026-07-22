const fs = require('fs');
for (const file of ['export_v107.js', 'export_v107_dump.js']) {
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(/let verb = "\uFFFD";/g, 'let verb = "נדחה";');
  c = c.replace(/verb = "\uFFFD";/g, 'verb = "הוקדם";');
  c = c.replace(/\$\{verb\} \uFFFD-\$\{toDateStr\}/g, '\\ ל-\\');
  fs.writeFileSync(file, c, 'utf8');
}
