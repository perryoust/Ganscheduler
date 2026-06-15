const fs = require('fs');
const files = ['core_dash.js', 'core_data.js', 'firebase.js', 'gardens.js', 'invoices.js', 'suppliers.js', 'import_export.js', 'activity.js', 'admin.js', 'cal.js', 'fix_invoices.js', 'newFunc.js', 'old_invoices_tmp.js', 'temp_invoices.js'];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Replace alert
  content = content.replace(/\balert\(/g, 'window.spAlert(');
  content = content.replace(/window\.spAlert\(/g, '_spAlertDialog(');
  content = content.replace(/\bwindow\.alert\(/g, '_spAlertDialog(');

  // Replace confirm
  // Since confirm is synchronous and spConfirm is async, we need to add await.
  // We'll replace `confirm(` with `await _spConfirmDialog(`
  content = content.replace(/\bconfirm\(/g, 'await _spConfirmDialog(');
  content = content.replace(/window\.confirm\(/g, 'await _spConfirmDialog(');

  // Replace prompt
  content = content.replace(/\bprompt\(/g, 'await window.spPrompt(');
  content = content.replace(/window\.prompt\(/g, 'await window.spPrompt(');

  // We must also ensure any function that now has 'await _spConfirmDialog' or 'await window.spPrompt' is marked as async.
  // This is a bit tricky with regex, but we can patch the known functions.
  
  if (file === 'invoices.js') {
    content = content.replace('function deleteSupFromCard(', 'async function deleteSupFromCard(');
    content = content.replace('window.sucSaveEdit = function(', 'window.sucSaveEdit = async function(');
    content = content.replace('function gcellUnblock(', 'async function gcellUnblock(');
    content = content.replace('function saveRow(', 'async function saveRow(');
  }
  if (file === 'gardens.js') {
    content = content.replace('function saveRow(', 'async function saveRow(');
    content = content.replace('function saveChanges(', 'async function saveChanges(');
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
