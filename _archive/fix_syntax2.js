const fs = require('fs');
let code = fs.readFileSync('invoices.js', 'utf8');

// Normalize newlines for the replacement
code = code.replace(/\r\n/g, '\n');

const target = `    } catch (err) {
      console.error("Import error:", err);
      _spAlertDialog("שגיאה בתהליך הייבוא: " + err.message);
      window._runScannerAfterImport = false;
    }
};
  reader.readAsArrayBuffer(file);
};`;

const replacement = `    } catch (err) {
      console.error("Import error:", err);
      _spAlertDialog("שגיאה בתהליך הייבוא: " + err.message);
      window._runScannerAfterImport = false;
    }
  };
  reader.readAsArrayBuffer(file);
  });
};`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('invoices.js', code);
    console.log('Fixed syntax error in invoices.js');
} else {
    console.log('Target NOT found!');
}
