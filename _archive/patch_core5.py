import re
with open('invoices.js', 'r', encoding='utf-8') as f:
    code = f.read()

start_match = re.search(r"// ─── Step 4: Scan all selected folders\s+window\.showToast\('⏳", code)
if not start_match:
    print("start match not found")
    exit(1)

start_pos = start_match.start()

end_match = re.search(r"await _spAlertDialog\([\s\S]*?\\n<span style=\"color:#1565c0\">[^]*\n  \);\n\};", code[start_pos:])

if not end_match:
    print("end match not found")
    exit(1)

end_pos = start_pos + end_match.end()

part1 = code[:start_pos]
core_logic = code[start_pos:end_pos-2] # remove the closing };
rest = code[end_pos:]

new_part2 = f"""await window._runCoreScanner(selectedFolders);
}};

window._runCoreScanner = async function(selectedFolders) {{
{core_logic}
}};
{rest}"""

with open('invoices.js', 'w', encoding='utf-8') as f:
    f.write(part1 + new_part2)

print("Success Extracting core scanner")
