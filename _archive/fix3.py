import codecs
with codecs.open('index.html', 'r', 'utf-8') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if 2184 <= i + 1 <= 2189:
        if i + 1 == 2184:
            new_lines.append('        <div style="display:flex;gap:5px">\n')
        elif i + 1 == 2185:
            new_lines.append('          <button id="suc-btn-exp-purch" class="btn bg bsm" onclick="sucExportDocs()" style="display:none">?? יצוא דוח רכש</button>\n')
        elif i + 1 == 2186:
            new_lines.append('          <button id="suc-btn-exp-act" class="btn bp bsm" onclick="openSupExportFromCard()" style="display:none">?? יצוא דוח פעילות</button>\n')
        elif i + 1 == 2187:
            new_lines.append('          <button class="btn bo bsm" onclick="sucToggleEdit()">?? ערוך</button>\n')
        elif i + 1 == 2188:
            new_lines.append('          <button class="btn bs bsm" onclick="CM(\'sucard-m\')">?</button>\n')
        elif i + 1 == 2189:
            new_lines.append('        </div>\n')
    else:
        new_lines.append(line)

with codecs.open('index.html', 'w', 'utf-8') as f:
    f.writelines(new_lines)

