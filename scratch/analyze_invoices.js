const XLSX = require('xlsx');
const wb = XLSX.readFile('scratch/user_invoices.xlsx');

console.log('Sheets:', wb.SheetNames);

for (const sn of wb.SheetNames) {
  const ws = wb.Sheets[sn];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log('\nSheet:', sn, '- total rows:', rows.length);

  // Count non-empty rows
  let nonEmpty = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] && rows[i].some(c => c !== null && c !== undefined && c !== '')) nonEmpty++;
  }
  console.log('  non-empty rows:', nonEmpty);

  // Show header structure
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const cells = (rows[i] || []).filter(c => c !== null && c !== undefined && c !== '');
    console.log(`  Row ${i}: ${cells.length} cells =>`, JSON.stringify(rows[i]).substring(0, 200));
  }

  // Now simulate the importInvoices logic
  let headerRowIndex = 0;
  let isComplexFormat = false;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const rowCells = rows[i].filter(c => c !== null && c !== undefined && c !== '').length;
    if (rowCells > 5 && rows[i].some(c => String(c).includes('ספק'))) {
      headerRowIndex = i;
      const headerStrs = rows[i].map(x => String(x || '').trim());
      if (headerStrs.filter(x => x === 'הערות').length > 1 || headerStrs.filter(x => x.includes('מע"מ')).length > 2) {
        isComplexFormat = true;
      }
      break;
    }
  }
  console.log('\n  Detected header row:', headerRowIndex, 'isComplexFormat:', isComplexFormat);

  // Count rows that would be imported vs skipped
  let withSupplier = 0;
  let noSupplier = 0;
  let emptyRows = 0;
  let tooShort = 0;

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) { emptyRows++; continue; }

    // Extract supName based on format
    let supName;
    if (isComplexFormat) {
      supName = row[3]; // col 3 is supName in complex format
    } else {
      supName = row[3]; // typically also col 3
    }

    if (!supName || String(supName).trim() === '' || String(supName).trim() === 'null') {
      noSupplier++;
    } else {
      withSupplier++;
    }
  }

  console.log('  Data rows (after header):', rows.length - headerRowIndex - 1);
  console.log('  With supplier (would import):', withSupplier);
  console.log('  No supplier (would skip):', noSupplier);
  console.log('  Empty rows:', emptyRows);

  // Check for rows with supName but missing orderDate or other patterns
  let withSupNoDate = 0;
  let withSupAndDate = 0;
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const supName = row[3];
    if (!supName || String(supName).trim() === '') continue;
    const orderDate = row[2];
    if (!orderDate) withSupNoDate++;
    else withSupAndDate++;
  }
  console.log('  With supplier + date:', withSupAndDate);
  console.log('  With supplier but NO date:', withSupNoDate);

  // Show some sample rows that have a supplier name
  console.log('\n  Sample rows with supplier:');
  let shown = 0;
  for (let i = headerRowIndex + 1; i < rows.length && shown < 3; i++) {
    const row = rows[i];
    if (!row) continue;
    const supName = row[3];
    if (supName && String(supName).trim() !== '') {
      console.log(`    Row ${i}:`, JSON.stringify(row).substring(0, 250));
      shown++;
    }
  }

  // Show some sample rows WITHOUT supplier name that are non-empty
  console.log('\n  Sample rows WITHOUT supplier (skipped):');
  shown = 0;
  for (let i = headerRowIndex + 1; i < rows.length && shown < 5; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const supName = row[3];
    if (!supName || String(supName).trim() === '') {
      const cells = row.filter(c => c !== null && c !== undefined && c !== '');
      if (cells.length > 0) {
        console.log(`    Row ${i} (${cells.length} cells):`, JSON.stringify(row).substring(0, 250));
        shown++;
      }
    }
  }
}
