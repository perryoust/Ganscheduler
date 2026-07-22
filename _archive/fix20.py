import os

# Fix activity.js
with open('activity.js', 'r', encoding='utf-8') as f:
    activity = f.read()

target1 = """  const isSameDay = data.d === data.origD;
  const makeupNote = isSameDay ? 'החלפת ספק' : `נדחה מ-${window.fD(data.origD)}`;
  const fullNote = data.notes ? data.notes + ' | ' + makeupNote : makeupNote;"""

rep1 = """  const makeupNote = `השלמה עבור ${window.fD(data.origD)}`;
  const fullNote = data.notes ? data.notes + ' | ' + makeupNote : makeupNote;"""

target2 = """       const isSameDay = data.d === data.origD;
       const noticeNote = isSameDay ? 'הוחלף ספק' : `נדחה ל-${window.fD(data.d)}`;"""

rep2 = """       const noticeNote = `השלמה נקבעה ל-${window.fD(data.d)}`;"""

if target1 in activity:
    activity = activity.replace(target1, rep1)
    activity = activity.replace(target2, rep2)
    with open('activity.js', 'w', encoding='utf-8') as f:
        f.write(activity)
    print("activity.js patched")
else:
    print("Target 1 not found in activity.js")

# Fix core_globals.js
with open('core_globals.js', 'r', encoding='utf-8') as f:
    cg = f.read()

target_cg = """    let tagText = '';
    if (s.st === 'can' || (s.nt && /ביטול|בוטל/i.test(s.nt))) tagText = 'ביטול';
    else if (s.nt && /הקדמה|הוקדם/i.test(s.nt)) tagText = 'הקדמה';
    else if (s.nt && /דחי?יה|נדחה/i.test(s.nt)) tagText = 'דחיה';
    else if (s.nt && /החלפ/i.test(s.nt)) tagText = 'החלפה';
    else if (isM || (s.nt && /השלמה/i.test(s.nt))) tagText = 'השלמה';"""

rep_cg = """    let tagText = '';
    if (s.st === 'can' || (s.nt && /ביטול|בוטל/i.test(s.nt))) tagText = 'ביטול';
    else if (s.st === 'nohap') tagText = ''; // Do not add a tag for no-hap, it is just "לא התקיים"
    else if (isM || (s.nt && /השלמה/i.test(s.nt))) tagText = 'השלמה';
    else if (s.nt && /הקדמה|הוקדם/i.test(s.nt)) tagText = 'הקדמה';
    else if (s.nt && /דחי?יה|נדחה/i.test(s.nt)) tagText = 'דחיה';"""

if target_cg in cg:
    cg = cg.replace(target_cg, rep_cg)
    with open('core_globals.js', 'w', encoding='utf-8') as f:
        f.write(cg)
    print("core_globals.js patched")
else:
    print("Target cg not found in core_globals.js")

