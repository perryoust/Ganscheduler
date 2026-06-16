import os

# 1. Fix firebase.js to save and load worker tasks
with open('firebase.js', 'r', encoding='utf-8') as f:
    fb = f.read()

target1 = """      activeGardens: window.activeGardens ? [...window.activeGardens] : null,"""
rep1 = """      activeGardens: window.activeGardens ? [...window.activeGardens] : null,
      workerTasks: window.WORKER_TASKS || [],"""

target2 = """    if (cloud.data.todos && window.todo) {
      window.todo.items = cloud.data.todos;
      window.todo.render();
    }"""
rep2 = """    if (cloud.data.todos && window.todo) {
      window.todo.items = cloud.data.todos;
      window.todo.render();
    }
    
    if (cloud.data.workerTasks && typeof window.WORKER_TASKS !== 'undefined') {
      window.WORKER_TASKS = cloud.data.workerTasks;
      if (typeof window.renderWorkerTasksAdmin === 'function') window.renderWorkerTasksAdmin();
    }"""

if target1 in fb:
    fb = fb.replace(target1, rep1)
    fb = fb.replace(target2, rep2)
    with open('firebase.js', 'w', encoding='utf-8') as f:
        f.write(fb)
    print("firebase.js patched")
else:
    print("Target 1 not found in firebase.js")


# 2. Fix activity.js so the original cancelled activity does NOT get "השלמה נקבעה ל-"
with open('activity.js', 'r', encoding='utf-8') as f:
    act = f.read()

target_act = """       const noticeNote = `השלמה נקבעה ל-${window.fD(data.d)}`;
       if(!origExt.nt || !origExt.nt.includes(noticeNote)) {
          origExt.nt = (origExt.nt ? origExt.nt + ' | ' : '') + noticeNote;
       }"""

rep_act = """       // const noticeNote = `השלמה נקבעה ל-${window.fD(data.d)}`;
       // if(!origExt.nt || !origExt.nt.includes(noticeNote)) {
       //    origExt.nt = (origExt.nt ? origExt.nt + ' | ' : '') + noticeNote;
       // }"""

if target_act in act:
    act = act.replace(target_act, rep_act)
    with open('activity.js', 'w', encoding='utf-8') as f:
        f.write(act)
    print("activity.js patched")
else:
    print("Target act not found in activity.js")
