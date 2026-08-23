const invoices = [
  { id: 1, num: '001', supName: 'אמנות' },
  { id: 2, num: '001', supName: 'אמנות', file_tax: { path: 'url' } }
];

const cleanDoc = (d) => String(d || '').replace(/\D/g, '').replace(/^0+/, '');
const cleanSup = (s) => String(s || '').toLowerCase().replace(/[\"\'\`]/g, '').replace(/\bבעמ\b/g, '').replace(/\bבע\"מ\b/g, '').replace(/[-_.,()]/g, ' ').replace(/\s+/g, ' ').trim();

const filePool = { tax: new Map() };

invoices.forEach(inv => {
    const s = cleanSup(inv.supName);
    const tax = cleanDoc(inv.num);
    if (inv.file_tax && inv.file_tax.path && tax && tax.length >= 1 && s) {
      filePool.tax.set(s + '|' + tax, inv.file_tax);
      filePool.tax.set(tax, inv.file_tax);
    }
});

invoices.forEach(inv => {
    const s = cleanSup(inv.supName);
    const tax = cleanDoc(inv.num);
    if ((!inv.file_tax || !inv.file_tax.path) && tax) {
      if (s && filePool.tax.has(s + '|' + tax)) {
        inv.file_tax = filePool.tax.get(s + '|' + tax);
      }
    }
});

console.log(invoices);
