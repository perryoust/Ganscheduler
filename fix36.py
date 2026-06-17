import os

with open('worker_tasks.js', 'r', encoding='utf-8') as f:
    wt = f.read()

# Replace the print button
target_print_btn = """<button onclick="window.print()" class="wt-no-print\""""
rep_print_btn = """<button onclick="window.wtPrintTasks(window.wtCurrentDate)" class="wt-no-print\""""
if target_print_btn in wt:
    wt = wt.replace(target_print_btn, rep_print_btn)

# We need to completely rewrite wtExportWord and add wtPrintTasks.
# Let's find where wtExportWord starts.
export_word_target = "window.wtExportWord = function(ds) {"
export_word_end = "document.body.removeChild(url);" # This is usually how it ends, let's just replace from export_word_target to the end of the file, assuming it's at the end.

# Let's just find the exact block.
# Actually, I'll just append window.wtPrintTasks and replace wtExportWord using string slicing.

# Let's write the new functions:
new_functions = """

window.wtExportWord = function(ds) {
  const tasks = (window.WORKER_TASKS || []).filter(t => !t.isAdminOnly && t.date === ds);
  
  const dObj = new Date(ds);
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const dayName = days[dObj.getDay()];
  const dateDisp = window.fD ? window.fD(ds) : ds;
  const titleStr = `יום ${dayName} | ${dateDisp}`;

  let htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head>
    <meta charset='utf-8'>
    <title>משימות שטח</title>
    <style>
      @page WordSection1 { size: 148.5mm 210mm; margin: 15mm; }
      div.WordSection1 { page: WordSection1; direction: rtl; font-family: Arial, sans-serif; }
      h1 { color: #1565c0; text-align: center; font-size: 20pt; margin-bottom: 5px; }
      h2 { color: #555; text-align: center; font-size: 14pt; margin-top: 0; margin-bottom: 20px; font-weight: normal; }
      .task { margin-bottom: 15px; font-size: 14pt; line-height: 1.5; }
      .task-text { display: inline; }
      .checkbox { font-family: 'Segoe UI Symbol', Arial; font-size: 16pt; margin-left: 8px; color: #333; }
      .notes { margin-top: 4px; font-size: 11pt; color: #666; margin-right: 25px; font-style: italic; }
    </style>
  </head>
  <body>
    <div class='WordSection1'>
      <h1>משימות שטח</h1>
      <h2>${titleStr}</h2>`;
      
  tasks.forEach(t => {
    const gardenName = window.G ? (window.G(t.gardenId)?.name || '') : '';
    const isDone = t.status === 'done';
    const box = isDone ? '&#x2611;' : '&#x25A2;';
    
    htmlContent += `
      <div class="task">
        <span class="checkbox">${box}</span>
        <span class="task-text"><b>${gardenName}</b> - ${t.desc.replace(/\\n/g, ' ')}</span>
        ${t.workerNote ? `<div class="notes">הערות ${t.workerName || 'עובד'}: ${t.workerNote}</div>` : ''}
      </div>`;
  });
  
  htmlContent += `</div></body></html>`;
  
  const blob = new Blob(['\\ufeff', htmlContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `משימות_${ds}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

window.wtPrintTasks = function(ds) {
  const tasks = (window.WORKER_TASKS || []).filter(t => !t.isAdminOnly && t.date === ds);
  
  const dObj = new Date(ds);
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const dayName = days[dObj.getDay()];
  const dateDisp = window.fD ? window.fD(ds) : ds;
  const titleStr = `יום ${dayName} | ${dateDisp}`;

  let htmlContent = `
  <!DOCTYPE html>
  <html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8">
    <title>הדפסת משימות</title>
    <style>
      @page { size: A5; margin: 15mm; }
      body { font-family: Arial, sans-serif; direction: rtl; padding: 0; margin: 0; color: #000; }
      h1 { text-align: center; font-size: 24px; margin-bottom: 5px; color: #000; }
      h2 { text-align: center; font-size: 16px; margin-top: 0; margin-bottom: 25px; font-weight: normal; color: #444; }
      .task { margin-bottom: 16px; font-size: 16px; line-height: 1.4; display: flex; align-items: flex-start; }
      .checkbox { border: 1px solid #000; width: 16px; height: 16px; display: inline-block; margin-left: 10px; border-radius: 3px; margin-top: 3px; flex-shrink: 0; }
      .task-content { flex: 1; }
      .task-text { display: inline; }
      .notes { margin-top: 4px; font-size: 13px; color: #555; font-style: italic; }
      .done-check { text-align: center; line-height: 16px; font-size: 14px; font-weight: bold; }
    </style>
  </head>
  <body>
    <h1>משימות שטח</h1>
    <h2>${titleStr}</h2>
    <div>`;
      
  tasks.forEach(t => {
    const gardenName = window.G ? (window.G(t.gardenId)?.name || '') : '';
    const isDone = t.status === 'done';
    const checkHTML = isDone ? '&#10003;' : '';
    
    htmlContent += `
      <div class="task">
        <div class="checkbox"><div class="done-check">${checkHTML}</div></div>
        <div class="task-content">
          <div class="task-text"><b>${gardenName}</b> - ${t.desc.replace(/\\n/g, ' ')}</div>
          ${t.workerNote ? `<div class="notes">הערות ${t.workerName || 'עובד'}: ${t.workerNote}</div>` : ''}
        </div>
      </div>`;
  });
  
  htmlContent += `</div>
    <script>
      window.onload = function() { window.print(); window.close(); }
    </script>
  </body></html>`;

  const printWin = window.open('', '_blank');
  printWin.document.open();
  printWin.document.write(htmlContent);
  printWin.document.close();
};
"""

# Let's replace the old wtExportWord with the new one
idx = wt.find("window.wtExportWord = function(ds) {")
if idx != -1:
    wt = wt[:idx] + new_functions
else:
    wt += new_functions

with open('worker_tasks.js', 'w', encoding='utf-8') as f:
    f.write(wt)

print("worker_tasks.js print and word export patched")
