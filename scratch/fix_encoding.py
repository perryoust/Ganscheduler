import os

path = r"c:\Users\Perry\רשת תיכוני טומשין בע מ (חל ץ)\צהרונים - מסמכים\פרי\הורדות\Ganscheduler-main\Ganscheduler\index.html"
with open(path, 'rb') as f:
    content = f.read()

# Try to decode from common encodings if it's messed up
try:
    text = content.decode('utf-8')
except:
    text = content.decode('cp1255') # Hebrew Windows

# Fix the head section manually
lines = text.splitlines()

# We want to fix lines 11, 13, 15
lines[10] = '  <meta name="apple-mobile-web-app-title" content="קידס שיבוץ">'
lines[12] = '  <title>Ganscheduler v101.6</title>'
lines[14] = '    href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📅</text></svg>">'

# Ensure the linked scripts are there (lines 16-20)
# Based on my last view, they were at 16-20
# 16: styles.css
# 17: firebase_init.js
# 18: assets.js
# ...

with open(path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')
