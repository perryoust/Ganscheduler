import os
import re

with open('activity.js', 'r', encoding='utf-8') as f:
    content = f.read()

target = """  const makeupNote = `נדחה מ- ${window.fD(data.origD)}`;
  const fullNote = data.notes ? data.notes + ' | ' + makeupNote : makeupNote;"""

rep = """  const isSameDay = data.d === data.origD;
  const makeupNote = isSameDay ? 'החלפת ספק' : `נדחה מ-${window.fD(data.origD)}`;
  const fullNote = data.notes ? data.notes + ' | ' + makeupNote : makeupNote;"""

content = content.replace(target, rep)

target2 = """       const noticeNote = `נדחה ל-${window.fD(data.d)}`;"""
rep2 = """       const isSameDay = data.d === data.origD;
       const noticeNote = isSameDay ? 'הוחלף ספק' : `נדחה ל-${window.fD(data.d)}`;"""

content = content.replace(target2, rep2)

with open('activity.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('activity.js patched')

# Now patch core_globals.js
with open('core_globals.js', 'r', encoding='utf-8') as f:
    cg = f.read()

target_cg = """    else if (s.nt && /דחי?יה|נדחה/i.test(s.nt)) tagText = 'דחיה';
    else if (isM || (s.nt && /השלמה/i.test(s.nt))) tagText = 'השלמה';"""

rep_cg = """    else if (s.nt && /דחי?יה|נדחה/i.test(s.nt)) tagText = 'דחיה';
    else if (s.nt && /החלפ/i.test(s.nt)) tagText = 'החלפה';
    else if (isM || (s.nt && /השלמה/i.test(s.nt))) tagText = 'השלמה';"""

if target_cg in cg:
    cg = cg.replace(target_cg, rep_cg)
    with open('core_globals.js', 'w', encoding='utf-8') as f:
        f.write(cg)
    print('core_globals.js patched')
else:
    print('Target not found in core_globals.js')
