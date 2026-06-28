const ExcelJS = require('exceljs');
const path = require('path');

async function inspectDesign() {
  const filePath = path.join(__dirname, "תוכנית חוגים תשפ''ו.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const sheet = workbook.getWorksheet("חוגים");
  
  let schoolRowsScanned = 0;
  let ganRowsScanned = 0;
  
  const uniquePatterns = new Set();
  
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const sivugCell = row.getCell(1);
    if (!sivugCell || !sivugCell.value) continue;
    
    const sivug = sivugCell.value.toString().trim();
    
    if (sivug.includes('ביה"ס') && schoolRowsScanned >= 365) continue;
    if (sivug.includes('גנים') && ganRowsScanned >= 365) continue;
    
    if (sivug.includes('ביה"ס')) schoolRowsScanned++;
    else if (sivug.includes('גנים')) ganRowsScanned++;
    
    let colorSignature = [];
    row.eachCell((cell, colNumber) => {
      let color = "none";
      if (cell.fill && cell.fill.fgColor) {
        color = cell.fill.fgColor.argb || cell.fill.fgColor.theme;
      }
      colorSignature.push(`C${colNumber}:${color}`);
    });
    
    const day = row.getCell(7).value || '';
    const act = row.getCell(8).value || '';
    const name = row.getCell(9).value || '';
    
    const sigString = `${sivug} | Day: ${day} | Act: ${act} | Name: ${name} => ${colorSignature.join(', ')}`;
    uniquePatterns.add(sigString);
    
    if (schoolRowsScanned >= 365 && ganRowsScanned >= 365) {
      break;
    }
  }
  
  console.log(`Scanned ${schoolRowsScanned} school rows and ${ganRowsScanned} gan rows.`);
  console.log("=== UNIQUE COLOR PATTERNS FOUND ===");
  Array.from(uniquePatterns).forEach(p => console.log(p));
}

inspectDesign().catch(console.error);
