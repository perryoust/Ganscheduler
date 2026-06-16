import os

with open('core_globals.js', 'r', encoding='utf-8') as f:
    cg = f.read()

target_cg = """    let tagText = '';
    if (s.st === 'can' || (s.nt && /ביטול|בוטל/i.test(s.nt))) tagText = 'ביטול';
    else if (s.nt && /הקדמה|הוקדם/i.test(s.nt)) tagText = 'הקדמה';
    else if (s.nt && /דחי?יה|נדחה/i.test(s.nt)) tagText = 'דחיה';
    else if (isM || (s.nt && /השלמה/i.test(s.nt))) tagText = 'השלמה';"""

rep_cg = """    let tagText = '';
    if (s.st === 'can' || (s.nt && /ביטול|בוטל/i.test(s.nt))) tagText = 'ביטול';
    else if (s.st === 'nohap') tagText = ''; // Ensure 'nohap' activities do not get the 'השלמה' tag
    else if (isM || (s.nt && /השלמה/i.test(s.nt))) tagText = 'השלמה';
    else if (s.nt && /הקדמה|הוקדם/i.test(s.nt)) tagText = 'הקדמה';
    else if (s.nt && /דחי?יה|נדחה/i.test(s.nt)) tagText = 'דחיה';"""

if target_cg in cg:
    cg = cg.replace(target_cg, rep_cg)
    with open('core_globals.js', 'w', encoding='utf-8') as f:
        f.write(cg)
    print("core_globals.js patched")
else:
    print("Target not found in core_globals.js")
