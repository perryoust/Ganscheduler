import os

with open('worker_tasks.js', 'r', encoding='utf-8') as f:
    wt = f.read()

target = """  let displayTasks = [];
  if (isSearch) {
    displayTasks = tasks.filter(t => {
      const gName = window.G ? (window.G(t.gardenId)?.name || '') : '';
      const cName = window.G ? (window.G(t.gardenId)?.city || '') : '';
      const txt = (t.desc + ' ' + gName + ' ' + cName).toLowerCase();
      return txt.includes(window.wtSearchQuery);
    });
    displayTasks.sort((a,b) => b.date.localeCompare(a.date)); // Newest first for search
  } else {
    displayTasks = tasks.filter(t => t.date === window.wtCurrentDate);"""

rep = """  let displayTasks = [];
  if (isSearch) {
    displayTasks = tasks.filter(t => {
      const gName = window.G ? (window.G(t.gardenId)?.name || '') : '';
      const cName = window.G ? (window.G(t.gardenId)?.city || '') : '';
      const txt = (t.desc + ' ' + gName + ' ' + cName).toLowerCase();
      return txt.includes(window.wtSearchQuery);
    });
    displayTasks.sort((a,b) => b.date.localeCompare(a.date)); // Newest first for search
  } else {
    const today = window.td ? window.td() : new Date().toISOString().split('T')[0];
    displayTasks = tasks.filter(t => {
      if (t.date === window.wtCurrentDate) return true;
      // If we are looking at Today or the future, pull ALL past pending tasks forward!
      if (window.wtCurrentDate >= today && t.status === 'pending' && t.date < window.wtCurrentDate) return true;
      return false;
    });"""

if target in wt:
    wt = wt.replace(target, rep)
    with open('worker_tasks.js', 'w', encoding='utf-8') as f:
        f.write(wt)
    print("worker_tasks.js admin roll-forward patched")
else:
    print("Target not found in worker_tasks.js")
