hebMonths = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

file = {"name": "0104092022.pdf", "link": "file://c:/myfolder/פלוס לגננת/0104092022.pdf"}
inv = {"supName": "פלוס לגננת בע\"מ", "orderMonth": "09/04/2022", "orderNum": "0104092022"}

import re
import urllib.parse

numStr = "0104092022"
cleanNumStr = re.sub(r'\D', '', numStr).lstrip('0')
print("cleanNumStr:", cleanNumStr)

score = 10 if len(cleanNumStr) < 3 else 50

supplierMatched = False
decodedLink = urllib.parse.unquote(file['link'])

supWords = [w for w in re.split(r'\s+', inv['supName']) if len(w) > 2]
for word in supWords:
    if word in file['name'] or word in decodedLink:
        score += 20
        supplierMatched = True

print("supplierMatched:", supplierMatched, "score:", score)

monthMatched = False
matchHebName = re.search(r'(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s*(\d{4})?', file['name'])
if not matchHebName:
    matchHebName = re.search(r'(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s*(\d{4})?', decodedLink)

if matchHebName:
    targetMonth = hebMonths.index(matchHebName.group(1))
    invMonthMatch = re.search(r'(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)', inv['orderMonth'])
    if invMonthMatch:
        if hebMonths.index(invMonthMatch.group(1)) == targetMonth:
            score += 30
            monthMatched = True
        else:
            score -= 30
    else:
        mStr1 = "/" + str(targetMonth + 1) + "/"
        mStr2 = "/" + str(targetMonth + 1).zfill(2) + "/"
        mStr3 = str(targetMonth + 1) + "/"
        mStr4 = str(targetMonth + 1).zfill(2) + "/"
        mStr5 = "." + str(targetMonth + 1) + "."
        mStr6 = "." + str(targetMonth + 1).zfill(2) + "."
        if mStr1 in inv['orderMonth'] or mStr2 in inv['orderMonth'] or inv['orderMonth'].startswith(mStr3) or inv['orderMonth'].startswith(mStr4) or mStr5 in inv['orderMonth'] or mStr6 in inv['orderMonth']:
            score += 30
            monthMatched = True
        elif re.search(r'\d', inv['orderMonth']):
            score -= 10
            
print("monthMatched:", monthMatched, "score:", score)

hasOtherSupplier = False
if not supplierMatched and inv['supName']:
    otherSups = ["עליזה קריבושי", "אלתן דפוס דיגיטלי בע\"מ"]
    for osup in otherSups:
        if osup == inv['supName']: continue
        fullSupName = osup.strip()
        if len(fullSupName) > 4 and (fullSupName in file['name'] or fullSupName in decodedLink):
            hasOtherSupplier = True
            break

print("hasOtherSupplier:", hasOtherSupplier)

if hasOtherSupplier:
    score -= 200
elif not supplierMatched and not monthMatched:
    if len(cleanNumStr) <= 5:
        score -= 60
    else:
        score -= 20

print("Final Score:", score)
