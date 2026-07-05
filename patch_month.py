import codecs

with codecs.open('invoices.js', 'r', 'utf-8') as f:
    code = f.read()

target = """          if (inv.orderMonth) {
             const invMonthMatch = inv.orderMonth.match(/(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)/);
             if (invMonthMatch && hebMonths.indexOf(invMonthMatch[1]) === targetMonth) {
               score += 30;
               monthMatched = true;
             } else {
               score -= 30; // Conflicting month
             }
          }"""

replacement = """          if (inv.orderMonth) {
             const invMonthMatch = inv.orderMonth.match(/(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)/);
             if (invMonthMatch) {
               if (hebMonths.indexOf(invMonthMatch[1]) === targetMonth) {
                 score += 30;
                 monthMatched = true;
               } else {
                 score -= 30; // Conflicting Hebrew month
               }
             } else {
               // Try numeric month match (e.g. "09" for September)
               const numMonthMatch = inv.orderMonth.match(/\\b(0?[1-9]|1[0-2])\\/\\d{2,4}\\b/);
               if (numMonthMatch && parseInt(numMonthMatch[1], 10) === targetMonth + 1) {
                 score += 30;
                 monthMatched = true;
               }
             }
          }"""

code_normalized = code.replace("\\r\\n", "\\n")
target_normalized = target.replace("\\r\\n", "\\n")

if target_normalized in code_normalized:
    code = code_normalized.replace(target_normalized, replacement.replace("\\r\\n", "\\n"))
    with codecs.open('invoices.js', 'w', 'utf-8') as f:
        f.write(code)
    print("Fixed month penalty bug")
else:
    print("Target month logic not found")
