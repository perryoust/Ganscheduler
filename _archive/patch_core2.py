import sys
import re

with open('invoices.js', 'r', encoding='utf-8') as f:
    code = f.read()

# We look for "Scan all selected folders"
target = r"Scan all selected folders"
match = re.search(target, code)
if not match:
    print("Could not find target.")
    sys.exit(1)

# Find the start of the line
start_pos = code.rfind('\n', 0, match.start())
if start_pos == -1: start_pos = match.start()

part1 = code[:start_pos]
part2 = code[start_pos:]

# find the end of the scanner
end_target = r"window\.showToast\('✅ סריקה הסתיימה בהצלחה'\);"
match2 = re.search(end_target, part2)
if match2:
    # go slightly past it to the closing brace
    end_brace = part2.find('};', match2.end())
    if end_brace != -1:
        end_pos = end_brace + 2
        core_logic = part2[:end_pos]
        rest = part2[end_pos:]
        
        # We also need to remove the closing brace of startSharePointScanner since we hijacked it
        # Actually, core_logic includes }; which is the end of startSharePointScanner!
        # Let's remove }; from the end of core_logic
        core_logic = core_logic[:-2]
        
        new_part2 = f"""
    await window._runCoreScanner(selectedFolders);
  }};

  window._runCoreScanner = async function(selectedFolders) {{
{core_logic}  }};
{rest}"""
        with open('invoices.js', 'w', encoding='utf-8') as f:
            f.write(part1 + new_part2)
        print("Success extracting")
    else:
        print("Could not find end brace")
else:
    print("Could not find success toast")
