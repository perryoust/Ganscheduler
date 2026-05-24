const XLSX = require('xlsx');
const fs = require('fs');

// Mock global/window requirements
global.window = global;
global.utils = {};

// Mock findGarden & findSupplier to return dummy objects so we don't fail parsing
global.window.utils = {
  findGarden(gardenName, city) {
    return { id: 100, name: gardenName, city };
  },
  findSupplier(rawSupplier, allSups) {
    return { name: rawSupplier };
  },
  norm(s) {
    return (s || '').toLowerCase().trim();
  },
  megaClean(s) {
    return (s || '').toLowerCase().trim();
  },
  getEventId(d, g, sBase, sAct, t) {
    return `${d}|${g}|${sBase}|${t}`;
  }
};

// We will load the actual functions from import_export.js to ensure they are tested directly!
let importExportCode = fs.readFileSync('import_export.js', 'utf8');

// Replace UI/Toast alerts to avoid ReferenceErrors during execution
importExportCode = importExportCode.replace(/document\.getElementById\([^)]*\)/g, 'null');
importExportCode = importExportCode.replace(/location\.reload\(\)/g, '');
importExportCode = importExportCode.replace(/alert\([^)]*\)/g, 'console.log');
importExportCode = importExportCode.replace(/confirm\([^)]*\)/g, 'true');
importExportCode = importExportCode.replace(/window\.saveToFirebase\([^)]*\)/g, 'true');

// Eval the code to load functions in global scope
eval(importExportCode);

const filePath = "C:\\Users\\Perry\\רשת תיכוני טומשין בע מ (חל ץ)\\צהרונים - מסמכים\\פרי\\חוגים\\תוכנית חוגים תשפ''ו.xlsx";

try {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets['חוסרים להשלמה'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  console.log(`\n--- Evaluating Header Detection (should scan up to 50 rows) ---`);
  const headerInfo = _detectHeaders(rows);
  console.log('Header detected:', JSON.stringify(headerInfo, null, 2));

  if (!headerInfo) {
    console.error('❌ Failed to detect headers!');
    process.exit(1);
  }

  const { headerRow, cols } = headerInfo;
  console.log('\n--- Parsing Rows without Completed Filtering ---');
  let importedCount = 0;

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 4) continue;

    // Check if the row has any content
    const hasContent = row.some(c => c !== null && c !== undefined && String(c).trim() !== '');
    if (!hasContent) continue;

    // Date parsing
    const d = _parseDate(row[cols.date]);
    if (!d) continue;

    const gardenName = row[cols.garden];
    const supplier = row[cols.supplier];
    console.log(`Excel Row ${i + 1}: IMPORTED ("${gardenName}" - "${supplier}")`);
    importedCount++;
  }

  console.log('\n--- Summary ---');
  console.log(`Total Rows Parsed: ${importedCount}`);
  console.log(`Imported Open Makeups: ${importedCount}`);

  if (importedCount === 34) {
    console.log('\n✅ Success! All 34 rows from Sheet 2 were successfully read and imported!');
    process.exit(0);
  } else {
    console.log(`\n❌ Failure. Expected 34 rows but got ${importedCount}.`);
    process.exit(1);
  }

} catch (e) {
  console.error(e);
  process.exit(1);
}
