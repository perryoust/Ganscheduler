const fs = require('fs');
const content = fs.readFileSync('invoices.js', 'utf8');
const splitIndex = content.indexOf('// ── SharePoint Local Scanner');
let cleanContent = content;
if (splitIndex !== -1) {
  cleanContent = content.substring(0, splitIndex).trimEnd();
}

const newScannerCode = `\n\n// ── SharePoint Local Scanner ─────────────────────────────
window.startSharePointScanner = async function() {
  if (!window.showDirectoryPicker) {
    alert('הדפדפן שלך אינו תומך בסריקת תיקיות מקומית. אנא השתמש ב-Chrome או Edge עדכני.');
    return;
  }
  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
    const baseUrl = prompt('בחרת את התיקייה המקומית בהצלחה!\\n\\nכעת, אנא הדבק כאן את קישור האינטרנט של התיקייה הזו בדיוק כפי שהוא מופיע ב-SharePoint\\n(לדוגמה: https://tomshin.sharepoint.com/sites/docs/Shared%20Documents/...) :');
    if (!baseUrl) return;
    const cleanBaseUrl = baseUrl.trim().replace(/\\/+$/, '');
    window.showToast('⏳ סורק קבצים במחשב... נא להמתין', 60000);
    const filesFound = [];
    async function scanDir(handle, currentPath) {
      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
          if (!entry.name.startsWith('.') && !entry.name.startsWith('~')) {
            filesFound.push({ name: entry.name, relativePath: currentPath + '/' + encodeURIComponent(entry.name) });
          }
        } else if (entry.kind === 'directory') {
          await scanDir(entry, currentPath + '/' + encodeURIComponent(entry.name));
        }
      }
    }
    await scanDir(dirHandle, '');
    let matchCount = 0;
    const resultsData = [['שם הקובץ', 'מספר שזוהה', 'סטטוס התאמה', 'קישור שנוצר']];
    for (const file of filesFound) {
      const numbersInName = file.name.match(/\\d+/g) || [];
      const link = \`\${cleanBaseUrl}\${file.relativePath}?web=1\`;
      let matchedInvoice = null;
      for (const numStr of numbersInName) {
        if (numStr.length < 3) continue;
        matchedInvoice = window.INVOICES.find(inv => 
          (inv.num && String(inv.num).trim() === numStr) ||
          (inv.orderNum && String(inv.orderNum).trim() === numStr) ||
          (inv.txNum && String(inv.txNum).trim() === numStr)
        );
        if (matchedInvoice) break;
      }
      if (matchedInvoice) {
        matchedInvoice.fileUrl = link;
        matchCount++;
        resultsData.push([file.name, numbersInName.join(','), 'הותאם לספק: ' + matchedInvoice.supName, link]);
      } else {
        resultsData.push([file.name, numbersInName.join(','), 'לא נמצאה התאמה בחשבוניות', link]);
      }
    }
    if (matchCount > 0) {
      window.showToast(\`✅ נמצאו \${filesFound.length} קבצים, מתוכם שודכו \${matchCount} למסמכים במערכת! שומר...\`);
      if (typeof window.saveToFirebase === 'function') await window.saveToFirebase(false, true);
      if (typeof window.renderInvoices === 'function') window.renderInvoices();
    } else {
      window.showToast(\`סריקה הסתיימה. נמצאו \${filesFound.length} קבצים, אך 0 התאמות למסמכים הקיימים.\`);
    }
    if (window.XLSX) {
      const wb = window.XLSX.utils.book_new();
      const ws = window.XLSX.utils.aoa_to_sheet(resultsData);
      ws['!cols'] = [{wch: 40}, {wch: 15}, {wch: 30}, {wch: 80}];
      window.XLSX.utils.book_append_sheet(wb, ws, 'תוצאות סריקה');
      window.XLSX.writeFile(wb, 'תוצאות_סריקת_sharepoint.xlsx');
    }
    alert(\`סיום! נסרקו \${filesFound.length} קבצים.\\nהותאמו ושודכו: \${matchCount}\\nדוח הופק וירד למחשב שלך.\`);
  } catch (error) {
    if (error.name !== 'AbortError') alert('שגיאה בסריקה: ' + error.message);
  }
};
`;
fs.writeFileSync('invoices.js', cleanContent + newScannerCode, 'utf8');
console.log('Fixed invoices.js');
