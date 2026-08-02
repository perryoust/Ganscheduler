// Simulate matching for the WRONG file
const wrongFile = "אלתן דפוס חוברות פדגוגיות ונהלים.pdf";
const wrongNums = wrongFile.match(/\d+/g) || [];
console.log("Wrong file numbers:", wrongNums);
console.log("Wrong file has NO numbers at all!");

// Now simulate: with no numbers, it would fall into hasOnlyYearNumbers path
const extractedNumbers = [];
const isYear = (val) => { const num = parseInt(val, 10); return num >= 2020 && num <= 2030; };
const hasOnlyYearNumbers = extractedNumbers.filter(n => !isYear(n.clean)).length === 0;
console.log("hasOnlyYearNumbers (empty array!):", hasOnlyYearNumbers);
console.log("This means: when there are NO numbers at all, hasOnlyYearNumbers = TRUE");
console.log("So the wrong file enters the fallback path!");

// Check if supplier name words match
const supName = "אלתן דפוס דיגיטלי בע\"מ";
const supWords = supName.split(/\s+/).filter(w => w.length > 2);
console.log("\nSupplier words:", supWords);
console.log("Which words match in wrong filename:");
for (const w of supWords) {
  console.log(`  "${w}" in "${wrongFile}"? ${wrongFile.includes(w)}`);
}

// Now simulate for the CORRECT file
const rightFile = "אלתן דפוס דיגיטלי בע''מ - פדגוגיה בתי ספר - פתיחת שנת תשפ''ז - 0102082026.pdf";
const rightNums = rightFile.match(/\d+/g) || [];
console.log("\n=== Right file numbers:", rightNums);

// Clean orderNum
const orderNum = "0102082026";
const orderNumClean = orderNum.replace(/\D/g, '').replace(/^0+/, '');
const fileNumClean = rightNums[0].replace(/\D/g, '').replace(/^0+/, '');
console.log("orderNum clean:", orderNumClean);
console.log("file num clean:", fileNumClean);
console.log("MATCH:", orderNumClean === fileNumClean);

// Score calculation for RIGHT file
// It matches on order number (10 digits, context 'order') → 50 base + 50 context = 100
// Plus supplier match: "אלתן" + "דפוס" + "דיגיטלי" = 3 words → 300
// Total estimated score: 400+

// Score for WRONG file (in fallback path)
// It enters the supplier-match fallback with supplier name match
// supplierScore = 20 (direct supplier name match)
// Total estimated score: 20 (but this is a different scoring system in fallback)

console.log("\n=== The real question: does the RIGHT file's score (main path) beat the WRONG file?");
console.log("Main path score for right file: ~400 (50 base + 50 context + 300 supplier)");
console.log("Fallback path for wrong file: 20 (supplier name match)");
console.log("BUT: the fallback path uses a DIFFERENT bestScore/bestInvoice!");
console.log("Wait - the fallback runs ONLY if bestScore < 0 (line 3484)");
console.log("So if the right file was processed FIRST, bestScore would be 400,");
console.log("and the wrong file would NOT enter the fallback path.");
console.log("But if the wrong file was processed FIRST, it WOULD enter fallback,");
console.log("get a score, and then when the right file comes, it should overwrite...");
console.log("Unless the overwrite is blocked by existing file_order being set.");
