import os

with open('worker_tasks.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Search for the buttons container in the pending render:
#   <button onclick="window.wtAddNote('${t.id}')"
content = content.replace(
    '<button onclick="window.wtAddNote(\'${t.id}\')"',
    '<button onclick="window.wtEditTaskDesc(\'${t.id}\')" style="background:transparent; color:#8e24aa; border:none; cursor:pointer; font-size:1.1rem; opacity:0.8;" title="ערוך משימה">✏️</button>\n              <button onclick="window.wtAddNote(\'${t.id}\')"'
)

# 2. Add wtEditTaskDesc function
edit_func = """
window.wtEditTaskDesc = async function(id) {
  const task = (window.WORKER_TASKS || []).find(t => t.id === id);
  if (!task) return;
  const newDesc = await window.spPrompt("ערוך תיאור משימה:", task.desc);
  if (newDesc !== null && newDesc.trim() !== '') {
    task.desc = newDesc.trim();
    if (window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else if (window.save) if(window.saveWorkerTasksToFirebase) window.saveWorkerTasksToFirebase(true); else window.save(true);
    window.renderWorkerTasksAdmin();
  }
};
"""
if "window.wtEditTaskDesc" not in content:
    content = content.replace("window.wtAddNote = async function(id) {", edit_func + "\nwindow.wtAddNote = async function(id) {")

# 3. Fix wtExportWord
export_func_old = """window.wtExportWord = function(ds) {
  const includeDone = confirm('האם להדפיס גם משימות שכבר בוצעו?');
  const tasks = (window.WORKER_TASKS || []).filter(t => {
    if (t.isAdminOnly) return false;
    if (t.date !== ds) return false;
    if (!includeDone && t.status === 'done') return false;
    return true;
  });"""

export_func_new = """window.wtExportWord = async function(ds) {
  const todayTasks = (window.WORKER_TASKS || []).filter(t => !t.isAdminOnly && t.date === ds);
  if (todayTasks.length === 0) {
    if (window.spAlert) window.spAlert('אין משימות לייצוא ביום זה');
    else alert('אין משימות לייצוא ביום זה');
    return;
  }
  
  const hasDone = todayTasks.some(t => t.status === 'done');
  let includeDone = false;
  if (hasDone) {
    if (window.spConfirm) {
      includeDone = await window.spConfirm('יש משימות שכבר בוצעו ביום זה. האם לכלול גם אותן בייצוא?');
    } else {
      includeDone = confirm('יש משימות שכבר בוצעו ביום זה. האם לכלול גם אותן בייצוא?');
    }
  }

  const tasks = todayTasks.filter(t => {
    if (!includeDone && t.status === 'done') return false;
    return true;
  });"""
content = content.replace(export_func_old, export_func_new)

# 4. Fix wtPrintTasks
print_func_old = """window.wtPrintTasks = function(ds) {
  const includeDone = confirm('האם להדפיס גם משימות שכבר בוצעו?');
  const tasks = (window.WORKER_TASKS || []).filter(t => {
    if (t.isAdminOnly) return false;
    if (t.date !== ds) return false;
    if (!includeDone && t.status === 'done') return false;
    return true;
  });"""

print_func_new = """window.wtPrintTasks = async function(ds) {
  const todayTasks = (window.WORKER_TASKS || []).filter(t => !t.isAdminOnly && t.date === ds);
  if (todayTasks.length === 0) {
    if (window.spAlert) window.spAlert('אין משימות להדפסה ביום זה');
    else alert('אין משימות להדפסה ביום זה');
    return;
  }
  
  const hasDone = todayTasks.some(t => t.status === 'done');
  let includeDone = false;
  if (hasDone) {
    if (window.spConfirm) {
      includeDone = await window.spConfirm('יש משימות שכבר בוצעו ביום זה. האם לכלול גם אותן בהדפסה?');
    } else {
      includeDone = confirm('יש משימות שכבר בוצעו ביום זה. האם לכלול גם אותן בהדפסה?');
    }
  }

  const tasks = todayTasks.filter(t => {
    if (!includeDone && t.status === 'done') return false;
    return true;
  });"""
content = content.replace(print_func_old, print_func_new)

# Wait, we need to change onclick="window.wtPrintTasks(window.wtCurrentDate)" 
# and onclick="window.wtExportWord(window.wtCurrentDate)" to be async?
# It's an inline event handler so `onclick="window.wtPrintTasks(window.wtCurrentDate)"` works even if async.

with open('worker_tasks.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
