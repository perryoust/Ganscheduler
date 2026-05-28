import re

with open(r"c:\Users\Perry\רשת תיכוני טומשין בע מ (חל ץ)\צהרונים - מסמכים\פרי\הורדות\Ganscheduler-main\Ganscheduler\index.html", "r", encoding="utf-8") as f:
    content = f.read()

# find all divs with class="panel" or class='panel'
panels = re.findall(r'<div\s+[^>]*id=["\']([^"\']+)["\'][^>]*class=["\']panel["\']', content)
panels_alt = re.findall(r'<div\s+[^>]*class=["\']panel["\'][^>]*id=["\']([^"\']+)["\']', content)
print("Panels found:", list(set(panels + panels_alt)))
