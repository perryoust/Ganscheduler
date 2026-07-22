import os

with open('worker_tasks.js', 'r', encoding='utf-8') as f:
    wt = f.read()

target = """            <div style="font-size:1.1rem; color:#333; font-family:sans-serif; margin-bottom:4px; line-height:1.4;">
              ${t.desc}
            </div>
            <div style="display:flex; align-items:center; gap:10px; font-size:0.85rem; color:#555;">
              <span style="background:rgba(255,255,255,0.6); padding:2px 8px; border-radius:4px; font-weight:bold;">📍 ${loc}</span>
              ${isPriv ? '<span style="background:#ffe0b2; color:#e65100; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">🔒 אישי למנהל</span>' : ''}
              ${isDone && t.doneAt ? `<span style="color:#4caf50;">(בוצע: ${t.doneAt})</span>` : ''}
            </div>"""

rep = """            <div style="font-size:1.1rem; color:#333; font-family:sans-serif; margin-bottom:4px; line-height:1.4;">
              <strong>${loc}</strong> - ${t.desc.replace(/\\n/g, ' ')}
            </div>
            <div style="display:flex; align-items:center; gap:10px; font-size:0.85rem; color:#555;">
              ${isPriv ? '<span style="background:#ffe0b2; color:#e65100; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.75rem;">🔒 אישי למנהל</span>' : ''}
              ${isDone && t.doneAt ? `<span style="color:#4caf50;">(בוצע: ${t.doneAt})</span>` : ''}
            </div>"""

if target in wt:
    wt = wt.replace(target, rep)
    with open('worker_tasks.js', 'w', encoding='utf-8') as f:
        f.write(wt)
    print("worker_tasks.js patched successfully")
else:
    print("Target block not found in worker_tasks.js")
