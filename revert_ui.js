const fs = require('fs');

const files = ['core_dash.js', 'core_data.js', 'firebase.js', 'gardens.js', 'invoices.js', 'suppliers.js', 'import_export.js', 'activity.js', 'admin.js', 'cal.js', 'fix_invoices.js', 'newFunc.js', 'todo.js', 'index.html'];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Revert await _spConfirmDialog to confirm
  content = content.replace(/await _spConfirmDialog\(/g, 'confirm(');
  
  // Revert await window.spPrompt to prompt
  content = content.replace(/await window\.spPrompt\(/g, 'prompt(');
  
  // Wait, I had manually added async to some functions in my script!
  content = content.replace(/async function deleteSupFromCard\(/g, 'function deleteSupFromCard(');
  content = content.replace(/window\.sucSaveEdit = async function\(/g, 'window.sucSaveEdit = function(');
  content = content.replace(/async function gcellUnblock\(/g, 'function gcellUnblock(');
  content = content.replace(/async function saveRow\(/g, 'function saveRow(');
  content = content.replace(/async function saveChanges\(/g, 'function saveChanges(');

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Reverted async UI in ${file}`);
  }
}
