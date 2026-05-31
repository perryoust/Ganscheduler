import os

filepath = r"c:\Users\Perry\רשת תיכוני טומשין בע מ (חל ץ)\צהרונים - מסמכים\פרי\הורדות\Ganscheduler-main\Ganscheduler\activity.js"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = """              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                 <div class="fg"><label style="font-size:.7rem;font-weight:700">שעה *</label><input type="time" id="sp-mu-time" value="${s.t||''}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>
                   <select id="sp-mu-act" onchange="window.spMuActChg()" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc">
                     <option value="">בחר פעילות...</option>
                     ${initialActs.map(a => `<option value="${a}" ${s.act===a?'selected':''}>${a}</option>`).join('')}
                     <option value="__new__">➕ הוסף פעילות חדשה...</option>
                   </select>
                 </div>
              </div>"""

replacement = """              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                 <div class="fg"><label style="font-size:.7rem;font-weight:700">שעה *</label><input type="time" id="sp-mu-time" value="${s.t||''}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc"></div>
                 <div class="fg">
                   <label style="font-size:.7rem;font-weight:700">בחר פעילות *</label>
                   <select id="sp-mu-act" onchange="window.spMuActChg()" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ccc">
                     <option value="">בחר פעילות...</option>
                     ${initialActs.map(a => `<option value="${a}" ${s.act===a?'selected':''}>${a}</option>`).join('')}
                     <option value="__new__">➕ הוסף פעילות חדשה...</option>
                   </select>
                 </div>
              </div>
              <div style="display:${(window.gcls(g) === 'ביה&quot;ס' || window.gcls(g) === 'ביה\\"ס') ? 'grid' : 'none'};grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
                 <div class="fg">
                   <label style="font-size:.7rem;font-weight:700;color:#e65100">מספר קבוצות</label>
                   <input type="number" id="sp-mu-grp" min="1" max="10" value="${s.grp||1}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #ffb74d">
                 </div>
                 <div></div>
              </div>"""

if target in content:
    content = content.replace(target, replacement)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    # Try with relaxed whitespaces
    import re
    # Match the block regardless of exact spaces/tabs
    pattern = re.compile(
        r'<\s*div\s+style\s*=\s*"display:\s*grid;\s*grid-template-columns:\s*1fr\s+1fr;\s*gap:\s*10px\s*">\s*'
        r'<\s*div\s+class\s*=\s*"fg"\s*>\s*<\s*label\s+style\s*=\s*"font-size:\s*\.7rem;\s*font-weight:\s*700\s*"\s*>\u05e9\u05e2\u05d4\s+\*<\s*/label\s*>\s*<\s*input\s+type\s*=\s*"time"\s+id\s*=\s*"sp-mu-time"\s+value\s*=\s*"\s*\$\{\s*s\.t\s*\|\|\s*\'\'\s*\}\s*"\s+style\s*=\s*"width:\s*100%;\s*padding:\s*4px;\s*border-radius:\s*4px;\s*border:\s*1px\s+solid\s+#ccc\s*"\s*>\s*<\s*/div\s*>\s*'
        r'<\s*select\s+id\s*=\s*"sp-mu-act"\s+onchange\s*=\s*"window\.spMuActChg\(\)"[^>]*>\s*'
        r'<\s*option\s+value\s*=\s*""\s*>\u2014?\s*\u05d1\u05d7\u05d5\u05e8\s+\u05e4\u05e2\u05d9\u05dc\u05d5\u05ea\s*\.\.\.<\s*/option\s*>\s*'
        r'\$\{\s*initialActs\.map\([^\)]*\)\.join\([^\)]*\)\s*\}\s*'
        r'<\s*option\s+value\s*=\s*"__new__"\s*>.*?<\s*/option\s*>\s*'
        r'<\s*/select\s*>\s*<\s*/div\s*>\s*<\s*/div\s*>',
        re.DOTALL
    )
    # Let's see if we can find it
    # We can also do a simpler regex match or substring replacement using split.
    print("Exact target not found, trying fuzzy match...")
    # Let's split on the known start and end
    start_anchor = 'id="sp-mu-time"'
    end_anchor = 'id="sp-mu-act-new-wrap"'
    idx_start = content.find(start_anchor)
    idx_end = content.find(end_anchor)
    if idx_start != -1 and idx_end != -1:
        # Go backwards from idx_start to find the opening <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        prefix = content[:idx_start]
        grid_start = prefix.rfind('<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">')
        if grid_start != -1:
            # We want to replace everything from grid_start to idx_end (excluding idx_end)
            # Find the closing </div> before idx_end
            suffix = content[grid_start:idx_end]
            # We want to replace from grid_start to grid_start + len(suffix)
            # but we need to strip trailing whitespaces/elements before id="sp-mu-act-new-wrap"
            # let's find the last </div> in suffix
            last_div = suffix.rfind('</div>')
            if last_div != -1:
                # Find the second to last </div> or similar to make sure we replace the whole row
                # Let's print the slice to verify
                to_replace = content[grid_start:grid_start + last_div + 6]
                print("Found match via anchors:")
                print(repr(to_replace))
                content = content.replace(to_replace, replacement)
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                print("Fuzzy Success")
            else:
                print("Failed to find closing div")
        else:
            print("Failed to find grid start")
    else:
        print("Failed to find anchors")
