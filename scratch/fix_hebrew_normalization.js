const fs = require('fs');
let code = fs.readFileSync('invoices.js', 'utf8');

const hasCRLF = code.includes('\r\n');
if (hasCRLF) {
  code = code.replace(/\r\n/g, '\n');
}

const target = `      // Supplier Match Score helper
      const cleanFileBase = file.name.replace(/[-_.]/g, ' ');
      const aliases = window.spScannerAliases || {};
      
      const getSupplierScore = (inv) => {
        let score = 0;
        const supplierBase = window.supBase ? window.supBase(inv.supName) : inv.supName;`;

const replacement = `      // Supplier Match Score helper
      const cleanFileBase = file.name.replace(/[-_.]/g, ' ');
      const aliases = window.spScannerAliases || {};

      const normalizeHebrew = (str) => {
        return (str || '')
          .replace(/יי/g, 'י')
          .replace(/וו/g, 'ו')
          .trim();
      };
      const normFileBase = normalizeHebrew(cleanFileBase);
      
      const getSupplierScore = (inv) => {
        let score = 0;
        const supplierBase = window.supBase ? window.supBase(inv.supName) : inv.supName;
        const normSupName = normalizeHebrew(inv.supName);
        const normSupBase = normalizeHebrew(supplierBase);`;

// Also update the score comparisons to use normalized versions
const targetScores = `        if (cleanFileBase.includes(inv.supName)) return 4;
        if (cleanFileBase.includes(supplierBase)) return 3;`;

const replacementScores = `        if (cleanFileBase.includes(inv.supName) || normFileBase.includes(normSupName)) return 4;
        if (cleanFileBase.includes(supplierBase) || normFileBase.includes(normSupBase)) return 3;`;

if (code.includes(target) && code.includes(targetScores)) {
  code = code.replace(target, replacement);
  code = code.replace(targetScores, replacementScores);
  if (hasCRLF) {
    code = code.replace(/\n/g, '\r\n');
  }
  fs.writeFileSync('invoices.js', code, 'utf8');
  console.log('Successfully injected Hebrew normalization into invoices.js');
} else {
  console.log('Target content not found in invoices.js');
}
