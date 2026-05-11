import os

path = r"c:\Users\Perry\רשת תיכוני טומשין בע מ (חל ץ)\צהרונים - מסמכים\פרי\הורדות\Ganscheduler-main\Ganscheduler\index.html"
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if i == 15: # Line 16 (0-indexed)
        new_lines.append('  <link rel="stylesheet" href="styles.css?v=102.66">\n')
        new_lines.append('  <script type="module" src="firebase_init.js?v=102.66"></script>\n')
        skip = True
        continue
    if skip:
        if '</script>' in line:
            skip = False
        continue
    new_lines.append(line)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
