const fs = require('fs');

const path = 'invoices.js';
let content = fs.readFileSync(path, 'utf8');

const target2Match = content.match(/const ans = prompt\(`לא נמצאה התאמה לקובץ:[\s\S]*?if\s*\(ans\s*&&\s*ans\.trim\(\)\s*===\s*'דלג'\)\s*{\s*window\._askUnmatched\s*=\s*false;\s*}\s*else\s*if\s*\(ans\s*&&\s*ans\.trim\(\)\)\s*{/m);

if (target2Match) {
  const replacement2 = `const ans = prompt(\`לא נמצאה התאמה לקובץ:\\n\${file.name}\\n\\nאם זו חשבונית של ספק (חדש או קיים), הקלד את שמו.\\n\\nאפשרויות דילוג:\\n- "ביטול" או ריק: דילוג על קובץ זה (ישאל שוב בסריקה הבאה).\\n- המילה "דלג": דילוג אוטומטי על כל שאר הקבצים בסריקה זו.\\n- המילה "תמיד": התעלם מקובץ זה לצמיתות (לא ישאל שוב).\`);
            if (ans && ans.trim() === 'דלג') {
               window._askUnmatched = false;
            } else if (ans && ans.trim() === 'תמיד') {
               window.spScannerAliases = window.spScannerAliases || {};
               window.spScannerAliases[\`__skip__\${file.name}\`] = true;
               if (window.ghAutoSave) window.ghAutoSave(true, true);
               window.showToast(\`✅ הקובץ סומן להתעלמות תמידית בסריקות הבאות\`);
            } else if (ans && ans.trim()) {`;
  content = content.replace(target2Match[0], replacement2);
  console.log('Replaced target 2');
} else {
  console.log('Target 2 not found');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Done');
