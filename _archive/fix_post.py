
import re

for filename in ["export_v107.js", "export_v107_dump.js"]:
    with open(filename, "r", encoding="utf-8") as f:
        c = f.read()
    
    c = re.sub(r"let verb = [^\n]*\n[^\n]*verb = [^\n]*\n\s*statusNote = toDateStr \? [^\n]* : verb;",
               "let verb = \"נדחה\";\n              if (linkedNext && linkedNext.d && ev.d && linkedNext.d < ev.d) verb = \"הוקדם\";\n              statusNote = toDateStr ? `${verb} ל-${toDateStr}` : verb;",
               c)
               
    with open(filename, "w", encoding="utf-8") as f:
        f.write(c)

