import codecs

with codecs.open('invoices.js', 'r', 'utf-8') as f:
    code = f.read()

target = """        let score = (cleanNumStr.length < 3) ? 10 : 50;
        
        if (inv.supName) {
          const supWords = String(inv.supName).split(/\s+/).filter(w => w.length > 2);
          for (const word of supWords) {
            if (file.name.includes(word)) score += 20;
          }
        }"""

replacement = """        let score = (cleanNumStr.length < 3) ? 10 : 50;
        
        let supplierMatched = false;
        const decodedLink = decodeURIComponent(file.link);
        if (inv.supName) {
          const supWords = String(inv.supName).split(/\s+/).filter(w => w.length > 2);
          for (const word of supWords) {
            if (file.name.includes(word) || decodedLink.includes(word)) {
              score += 20;
              supplierMatched = true;
            }
          }
        }
        
        // Month matching check
        let monthMatched = false;
        const matchHebName = file.name.match(/(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\\s*(\\d{4})?/) || 
                             decodedLink.match(/(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\\s*(\\d{4})?/);
                             
        if (matchHebName) {
          const targetMonth = hebMonths.indexOf(matchHebName[1]);
          if (inv.orderMonth) {
             const invMonthMatch = inv.orderMonth.match(/(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)/);
             if (invMonthMatch && hebMonths.indexOf(invMonthMatch[1]) === targetMonth) {
               score += 30;
               monthMatched = true;
             } else {
               score -= 30; // Conflicting month
             }
          }
        }
        
        let hasOtherSupplier = false;
        if (!supplierMatched && inv.supName) {
            const otherSups = Array.from(new Set(window.INVOICES.map(i => i.supName).filter(Boolean)));
            for (const osup of otherSups) {
                if (osup === inv.supName) continue;
                const fullSupName = String(osup).trim();
                if (fullSupName.length > 4 && (file.name.includes(fullSupName) || decodedLink.includes(fullSupName))) {
                    hasOtherSupplier = true;
                    break;
                }
            }
        }
        
        if (hasOtherSupplier) {
            score -= 200; // Definitely belongs to another supplier
        } else if (!supplierMatched && !monthMatched && cleanNumStr.length >= 3) {
            score -= 60; // Drops score below 0. A random number match is not enough without supplier or month evidence.
        }"""

if target in code:
    code = code.replace(target, replacement)
    with codecs.open('invoices.js', 'w', 'utf-8') as f:
        f.write(code)
    print("Success patch matching logic")
else:
    print("Target not found!")
