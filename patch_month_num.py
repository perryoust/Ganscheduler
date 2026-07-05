import codecs

with codecs.open('invoices.js', 'r', 'utf-8') as f:
    code = f.read()

target = """             } else {
               // Try numeric month match (e.g. "09" for September)
               const numMonthMatch = inv.orderMonth.match(/\\b(0?[1-9]|1[0-2])\\/\\d{2,4}\\b/);
               if (numMonthMatch && parseInt(numMonthMatch[1], 10) === targetMonth + 1) {
                 score += 30;
                 monthMatched = true;
               }
             }"""

replacement = """             } else {
               // Try numeric month match, looking for the month number anywhere in the date string
               const mStr1 = "/" + (targetMonth + 1) + "/";
               const mStr2 = "/" + String(targetMonth + 1).padStart(2, '0') + "/";
               const mStr3 = (targetMonth + 1) + "/";
               const mStr4 = String(targetMonth + 1).padStart(2, '0') + "/";
               const mStr5 = "." + (targetMonth + 1) + ".";
               const mStr6 = "." + String(targetMonth + 1).padStart(2, '0') + ".";
               if (inv.orderMonth.includes(mStr1) || inv.orderMonth.includes(mStr2) || inv.orderMonth.startsWith(mStr3) || inv.orderMonth.startsWith(mStr4) || inv.orderMonth.includes(mStr5) || inv.orderMonth.includes(mStr6)) {
                 score += 30;
                 monthMatched = true;
               } else if (inv.orderMonth.match(/\\d/)) {
                 // Has numbers but not the target month -> conflicting month!
                 score -= 10; // Light penalty so it doesn't kill 6-digit matches completely, but hurts 5-digit
               }
             }"""

code_normalized = code.replace("\\r\\n", "\\n")
target_normalized = target.replace("\\r\\n", "\\n")

if target_normalized in code_normalized:
    code = code_normalized.replace(target_normalized, replacement.replace("\\r\\n", "\\n"))
    with codecs.open('invoices.js', 'w', 'utf-8') as f:
        f.write(code)
    print("Fixed numeric month check")
else:
    print("Target numeric month logic not found")
