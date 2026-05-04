import json
import os

# Mapping Garden Names to IDs (based on data.js)
GARDEN_MAP = {
    "ביה\"ס נווה דליה": 5,
    "גן נוחית": 73,
    "גן אסיף": 20,
    "גן עינב": 85,
    "גן חיטה": 44,
    "גן לוטוס": 63,
    "גן נבטים": 70,
    "גן צנובר": 97,
    "גן פלג": 88,
    "גן יובל": 52,
    "גן יהלום": 51,
    "גן תירוש": 121,
    "גן סברס": 76,
    "גן אודם": 12,
    "גן שמש": 117,
    "גן כרכום": 60,
    "גן סיגליות": 79
}

# Updates to apply: (GardenID, Date, Supplier_Substr, Note)
UPDATES = [
    (5, "2026-02-25", "מנהיגות", "מדריך חולה"),
    (73, "2026-02-25", "מנהיגות", "מדריך חולה"),
    (20, "2026-04-27", "דרמה", "חסר מדריך"),
    (85, "2026-04-27", "דרמה", "חסר מדריך"),
    (44, "2026-04-16", "ספורט", "מדריך לא הגיע"),
    (63, "2026-04-16", "דרמה", "חסר מדריך"),
    (70, "2026-04-16", "דרמה", "חסר מדריך"),
    (97, "2026-04-16", "ספורט", "מדריך לא הגיע"),
    (88, "2026-04-28", "דרמה", "חסר מדריך"),
    (52, "2026-04-28", "דרמה", "חסר מדריך"),
    (51, "2026-04-29", "דרמה", "חסר מדריך"),
    (121, "2026-04-29", "דרמה", "חסר מדריך"),
    (76, "2026-04-29", "דרמה", "חסר מדריך"),
    (12, "2026-04-29", "דרמה", "חסר מדריך"),
    (63, "2026-04-30", "דרמה", "חסר מדריך"),
    (70, "2026-04-30", "דרמה", "חסר מדריך"),
    (117, "2026-05-03", "דרמה", "חסר מדריך"),
    (60, "2026-05-03", "דרמה", "חסר מדריך"),
    (76, "2026-05-06", "דרמה", "חסר מדריך"),
    (12, "2026-05-06", "דרמה", "חסר מדריך"),
    (117, "2026-05-03", "דרמה", "חסר מדריך"), # Repeat from screenshot
    (60, "2026-05-03", "דרמה", "חסר מדריך"),  # Repeat from screenshot
    (88, "2026-05-03", "ספורט", "מדריך חולה"),
    (52, "2026-05-03", "ספורט", "מדריך חולה"),
    (79, "2026-05-04", "ספורט", "מדריך איחר לא העביר פעילות")
]

PATH = r'c:\Users\Perry\רשת תיכוני טומשין בע מ (חל ץ)\צהרונים - מסמכים\פרי\הורדות\Ganscheduler-main\Ganscheduler\sraws.json'

with open(PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

changed = 0
for gid, d, a_sub, note in UPDATES:
    found = False
    for item in data:
        if item.get('g') == gid and item.get('d') == d and (a_sub in item.get('a', '')):
            item['st'] = 'nohap'
            item['nt'] = '⚠️ לא התקיים: ' + note
            changed += 1
            found = True
            # Keep looking for duplicates if any
    if not found:
        print(f"Warning: Could not find activity for GID {gid} on {d} with supplier {a_sub}")

if changed > 0:
    with open(PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Successfully updated {changed} activities.")
else:
    print("No activities were updated.")
