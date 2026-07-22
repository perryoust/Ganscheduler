hebMonths = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

file = {"name": "0104092022.pdf", "link": "file://c:/downloads/0104092022.pdf"}
inv = {"supName": "פלוס לגננת בע\"מ", "orderMonth": "09/04/2022", "orderNum": "0104092022"}

import re
import urllib.parse

numStr = "0104092022"
cleanNumStr = re.sub(r'\D', '', numStr).lstrip('0')
score = 10 if len(cleanNumStr) < 3 else 50

supplierMatched = False
decodedLink = urllib.parse.unquote(file['link'])

supWords = [w for w in re.split(r'\s+', inv['supName']) if len(w) > 2]
for word in supWords:
    if word in file['name'] or word in decodedLink:
        score += 20
        supplierMatched = True

monthMatched = False

hasOtherSupplier = False

if hasOtherSupplier:
    score -= 200
elif not supplierMatched and not monthMatched:
    if len(cleanNumStr) <= 5:
        score -= 60
    else:
        score -= 20

print("Final Score:", score)
