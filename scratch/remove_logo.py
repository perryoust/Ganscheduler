import os

path = r"c:\Users\Perry\רשת תיכוני טומשין בע מ (חל ץ)\צהרונים - מסמכים\פרי\הורדות\Ganscheduler-main\Ganscheduler\index.html"
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove lines 30, 31, 32 (0-indexed: 29, 30, 31)
# 29: <script>
# 30: const LOGO_B64 = ...
# 31: </script>
del lines[29:32]

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
