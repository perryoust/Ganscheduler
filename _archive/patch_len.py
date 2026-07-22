import codecs

with codecs.open('invoices.js', 'r', 'utf-8') as f:
    code = f.read()

target = """        } else if (!supplierMatched && !monthMatched && cleanNumStr.length >= 3) {
            score -= 60; // Drops score below 0. A random number match is not enough without supplier or month evidence.
        }"""

replacement = """        } else if (!supplierMatched && !monthMatched) {
            if (cleanNumStr.length <= 5) {
                score -= 60; // Drops score below 0 for common 3-5 digit numbers
            } else {
                score -= 20; // 6+ digit numbers are very unique, penalize but keep positive
            }
        }"""

code_normalized = code.replace("\\r\\n", "\\n")
target_normalized = target.replace("\\r\\n", "\\n")

if target_normalized in code_normalized:
    code = code_normalized.replace(target_normalized, replacement.replace("\\r\\n", "\\n"))
    with codecs.open('invoices.js', 'w', 'utf-8') as f:
        f.write(code)
    print("Fixed length penalty bug")
else:
    print("Target length penalty not found")
