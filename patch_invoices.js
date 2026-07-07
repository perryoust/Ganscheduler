const fs = require('fs');
let c = fs.readFileSync('invoices.js', 'utf8');

const target1 = `  const reader = new FileReader();
  reader.onload = async function(e) {`;
const replace1 = `  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async function(e) {`;

const target2 = `      window._runScannerAfterImport = false;
    }
};
  reader.readAsArrayBuffer(file);
};`;
const replace2 = `      window._runScannerAfterImport = false;
      reject(err);
      return;
    }
    resolve();
  };
  reader.onerror = reject;
  reader.readAsArrayBuffer(file);
  });
};`;

if(c.includes(target1) && c.includes(target2)) {
  c = c.replace(target1, replace1).replace(target2, replace2);
  fs.writeFileSync('invoices.js', c);
  console.log('Fixed invoices.js');
} else {
  console.log('Could not find targets');
}
