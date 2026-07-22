import os

with open('worker_tasks.js', 'r', encoding='utf-8') as f:
    wt = f.read()

# 1. Replace confirm in wtDeleteTask
target_del = """window.wtDeleteTask = function(id) {
  if (confirm('האם אתה בטוח שברצונך למחוק משימה זו?')) {"""
rep_del = """window.wtDeleteTask = async function(id) {
  if (await window.spConfirm('האם אתה בטוח שברצונך למחוק משימה זו?')) {"""
if target_del in wt: wt = wt.replace(target_del, rep_del)

# 2. Replace confirm in wtHardRefresh
target_hard = """window.wtHardRefresh = async function() {
  if (confirm('האם אתה בטוח שברצונך לבצע רענון קשיח? זה ימחק כל שינוי מקומי שלא נשמר וימשוך מחדש הכל מהענן.')) {"""
rep_hard = """window.wtHardRefresh = async function() {
  if (await window.spConfirm('האם אתה בטוח שברצונך לבצע רענון קשיח? זה ימחק כל שינוי מקומי שלא נשמר וימשוך מחדש הכל מהענן.')) {"""
if target_hard in wt: wt = wt.replace(target_hard, rep_hard)

# 3. Add Word Export Button
target_btn = """<button onclick="window.wtPrintTasks(window.wtCurrentDate)" class="wt-no-print" style="background:#fff; border:1px solid #ccc; padding:6px 12px; border-radius:20px; cursor:pointer; color:#1565c0; font-weight:bold; display:flex; align-items:center; gap:5px;" title="הדפס את דף המשימות">🖨️ הדפס משימות</button>"""
rep_btn = """<button onclick="window.wtExportWord(window.wtCurrentDate)" class="wt-no-print" style="background:#fff; border:1px solid #ccc; padding:6px 12px; border-radius:20px; cursor:pointer; color:#1565c0; font-weight:bold; display:flex; align-items:center; gap:5px;" title="ייצוא משימות לקובץ Word">📄 ייצוא ל-Word</button>
          <button onclick="window.wtPrintTasks(window.wtCurrentDate)" class="wt-no-print" style="background:#fff; border:1px solid #ccc; padding:6px 12px; border-radius:20px; cursor:pointer; color:#1565c0; font-weight:bold; display:flex; align-items:center; gap:5px;" title="הדפס את דף המשימות">🖨️ הדפס משימות</button>"""
if target_btn in wt: wt = wt.replace(target_btn, rep_btn)

with open('worker_tasks.js', 'w', encoding='utf-8') as f:
    f.write(wt)
print("worker_tasks.js confirm/buttons patched")
