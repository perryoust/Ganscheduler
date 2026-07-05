import re
with open('invoices.js', 'r', encoding='utf-8') as f:
    code = f.read()

match = re.search(r"window\.showToast\('[^']*',\s*60000\);\s*const filesFound = \[\];", code)
if match:
    start_pos = match.start()
    part1 = code[:start_pos]
    part2 = code[start_pos:]
    
    end_match = re.search(r"if \(typeof window\.save === 'function'\) await window\.save\(true\);\s+if \(typeof window\.renderInvoices === 'function'\) window\.renderInvoices\(\);\s+\}", part2)
    if end_match:
        end_pos = end_match.end()
        core_logic = part2[:end_pos]
        rest = part2[end_pos:]
        
        # Remove the closing brace of startSharePointScanner
        core_logic = core_logic.rstrip()[:-1].rstrip()
        
        new_part2 = f"""
    await window._runCoreScanner(selectedFolders);
  }};

  window._runCoreScanner = async function(selectedFolders) {{
    {core_logic}
  }};
  {rest}
"""
        with open('invoices.js', 'w', encoding='utf-8') as f:
            f.write(part1 + new_part2)
        print("Success extracting")
    else:
        print("end match not found")
else:
    print("start match not found")
