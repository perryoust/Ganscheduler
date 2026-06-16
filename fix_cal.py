import os

with open('cal.js', 'r', encoding='utf-8') as f:
    caljs = f.read()

caljs = caljs.replace("(window.GARDENS||[])", "(typeof AG === 'function' ? AG() : (window.GARDENS||[]))")

with open('cal.js', 'w', encoding='utf-8') as f:
    f.write(caljs)

print("cal.js patched successfully")
