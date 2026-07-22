import sys
import re

with open('invoices.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = r"    // ─── Step 4: Scan all selected folders\s+window\.showToast\('⏳ סורק קבצים\.\.\. נא להמתין', 60000\);"
# We will split the code at this exact target.
match = re.search(target, code)
if not match:
    print("Could not find step 4 target.")
    sys.exit(1)

pos = match.start()
part1 = code[:pos]
part2 = code[pos:]

# find the end of startSharePointScanner
end_target = r"    window\.showToast\('✅ סריקה הסתיימה בהצלחה'\);\n  \};\n"
match2 = re.search(end_target, part2)
if not match2:
    # let's just find "window.startSharePointScanner" end brace
    end_target2 = r"  \};\n\n  window\.parseSharePointBaseUrl"
    match2 = re.search(end_target2, part2)

if match2:
    end_pos = match2.start() + match2.group().index('};')
    
    # We slice part2
    core_logic = part2[:end_pos]
    rest = part2[end_pos:]
    
    new_part2 = f"""
    await window._runCoreScanner(selectedFolders);
  }}

  window._runCoreScanner = async function(selectedFolders) {{
{core_logic}  {rest}"""
    
    with open('invoices.js', 'w', encoding='utf-8') as f:
        f.write(part1 + new_part2)
    print("Successfully extracted _runCoreScanner")
else:
    print("Could not find end of startSharePointScanner")
