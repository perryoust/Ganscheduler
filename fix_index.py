import codecs
lines = codecs.open('index.html', 'r', 'utf8').readlines()
lines[2183] = '        <div style="display:flex;gap:5px">\n'
lines[2184] = '          <button id="suc-btn-exp-purch" class="btn bg bsm" onclick="sucExportDocs()" style="display:none">🚀 יצוא דוח רכש</button>\n'
lines[2185] = '          <button id="suc-btn-exp-act" class="btn bp bsm" onclick="openSupExportFromCard()" style="display:none">🚀 יצוא דוח פעילות</button>\n'
lines[2186] = '          <button class="btn bo bsm" onclick="sucToggleEdit()">✏️ ערוך</button>\n'
lines[2187] = '          <button class="btn bs bsm" onclick="CM(\'sucard-m\')">✖</button>\n'
lines[2188] = '        </div>\n'
codecs.open('index.html', 'w', 'utf8').writelines(lines)