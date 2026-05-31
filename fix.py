import re
with open('index.html', 'r', encoding='utf-8') as f:
    c = f.read()

# Replace the top header buttons
c = re.sub(
    r'<div style="display:flex;gap:5px">\s*<button class="btn bp bsm" onclick="openSupExportFromCard\(\)">(.*?)<\/button>\s*<button class="btn bo bsm" onclick="sucToggleEdit\(\)">(.*?)<\/button>\s*<button class="btn bs bsm" onclick="CM\(''sucard-m''\)">(.*?)<\/button>\s*<\/div>',
    r'<div style="display:flex;gap:5px">\n          <button id="suc-btn-exp-purch" class="btn bg bsm" onclick="sucExportDocs()" style="display:none">?? יצוא דוח רכש</button>\n          <button id="suc-btn-exp-act" class="btn bp bsm" onclick="openSupExportFromCard()" style="display:none">?? יצוא דוח פעילות</button>\n          <button class="btn bo bsm" onclick="sucToggleEdit()">\2</button>\n          <button class="btn bs bsm" onclick="CM(''sucard-m'')">\3</button>\n        </div>',
    c, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(c)
