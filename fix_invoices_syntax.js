const fs = require('fs');
let code = fs.readFileSync('invoices.js', 'utf8');

const target = `      if (window._runScannerAfterImport) {
        window._runScannerAfterImport = false;
        setTimeout(() => {
          window.startSharePointScanner();
        }, 1500);
      }

    } catch (err) {
      console.error("Import error:", err);
      _spAlertDialog("שגיאה בתהליך הייבוא: " + err.message);
      window._runScannerAfterImport = false;
    }
};
  reader.readAsArrayBuffer(file);
};`;

const replacement = `      if (window._runScannerAfterImport) {
        window._runScannerAfterImport = false;
        setTimeout(() => {
          window.startSharePointScanner();
        }, 1500);
      }
      resolve(true);
    } catch (err) {
      console.error("Import error:", err);
      _spAlertDialog("שגיאה בתהליך הייבוא: " + err.message);
      window._runScannerAfterImport = false;
      resolve(false);
    }
  };
  reader.onerror = function() { resolve(false); };
  reader.readAsArrayBuffer(file);
  });
};`;

code = code.replace(target, replacement);
fs.writeFileSync('invoices.js', code);
console.log('Fixed syntax error in invoices.js');
