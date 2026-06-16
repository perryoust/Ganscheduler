import os

with open('firebase.js', 'r', encoding='utf-8') as f:
    fb = f.read()

target1 = """const url = `${base}/global_worker_tasks.json?auth=${tok}`;"""
rep1 = """const url = `${base}/data/global_worker_tasks.json?auth=${tok}`;"""

target2 = """const wtUrl = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/global_worker_tasks.json' + (tok ? '?auth=' + tok : '');"""
rep2 = """const wtUrl = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/data/global_worker_tasks.json' + (tok ? '?auth=' + tok : '');"""

if target1 in fb and target2 in fb:
    fb = fb.replace(target1, rep1).replace(target2, rep2)
    with open('firebase.js', 'w', encoding='utf-8') as f:
        f.write(fb)
    print("Fixed paths to data/global_worker_tasks.json")
else:
    print("Target not found. Check exact string.")
