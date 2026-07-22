const fs = require('fs');

const files = ['core_dash.js', 'core_data.js', 'firebase.js', 'gardens.js', 'invoices.js', 'suppliers.js', 'import_export.js', 'activity.js', 'admin.js', 'cal.js', 'fix_invoices.js', 'newFunc.js'];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Replace alert
  content = content.replace(/\balert\(/g, 'window._spAlertDialog(');
  content = content.replace(/\bwindow\.alert\(/g, 'window._spAlertDialog(');

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated alert in ${file}`);
  }
}
