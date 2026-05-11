import os

path = r"c:\Users\Perry\רשת תיכוני טומשין בע מ (חל ץ)\צהרונים - מסמכים\פרי\הורדות\Ganscheduler-main\Ganscheduler\index.html"
assets_path = r"c:\Users\Perry\רשת תיכוני טומשין בע מ (חל ץ)\צהרונים - מסמכים\פרי\הורדות\Ganscheduler-main\Ganscheduler\assets.js"

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

logo_line = ""
for line in lines:
    if 'const LOGO_B64 =' in line:
        logo_line = line.strip()
        break

if logo_line:
    with open(assets_path, 'w', encoding='utf-8') as f:
        f.write(logo_line + '\n')
    print("Success")
else:
    print("Logo not found")
