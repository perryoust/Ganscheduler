const fs = require('fs');
let code = fs.readFileSync('worker_tasks.js', 'utf8');

// 1. Remove "+ משימה חדשה" button
code = code.replace(/<button onclick="window\.openNewWorkerTaskModal\(\)"[^>]+>\+ משימה חדשה<\/button>/g, '');

// 2. Add repeating-linear-gradient and line-height for notebook lines
code = code.replace(
  /background-color:#fdf8e4; border-radius:8px; box-shadow:0 4px 15px rgba\(0,0,0,0\.08\); padding:20px 40px; min-height:400px; position:relative; border-right:2px solid #e57373;/g, 
  'background-color:#fdf8e4; background-image: repeating-linear-gradient(transparent, transparent 39px, #e0e0e0 39px, #e0e0e0 40px); background-attachment: local; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.08); padding:20px 40px; min-height:400px; position:relative; border-right:2px solid #e57373; line-height: 40px;'
);

// 3. Replace the end of renderWorkerTasksAdmin to include inline add form
const targetEnd = `
  html += \`
      </div>
    </div>
  \`;
  container.innerHTML = html;
`;
const replacementEnd = `
  if (!isSearch) {
    html += \`
      <!-- Inline Add Task Row -->
      <div style="display:flex; align-items:flex-start; padding:0; position:relative; margin-top:20px;">
        <div style="margin-left:15px; width:24px; text-align:center; color:#e57373; font-weight:bold; font-size:1.5rem; line-height:40px;">+</div>
        <div style="flex:1; display:flex; flex-wrap:wrap; gap:10px; align-items:center; line-height:40px;">
          <div style="position:relative; width:180px;">
            <input type="text" id="wt-inline-garden" placeholder="חפש גן..." onkeyup="window.wtSearchGardenInline(this.value)" style="width:100%; padding:0 6px; height:36px; border:none; background:transparent; outline:none; font-family:inherit; font-size:1rem; border-radius:4px;">
            <div id="wt-inline-garden-results" style="position:absolute; top:100%; right:0; left:0; max-height:120px; overflow-y:auto; background:#fff; border:1px solid #ccc; box-shadow:0 2px 5px rgba(0,0,0,0.2); z-index:100; display:none; line-height:1.2;"></div>
            <input type="hidden" id="wt-inline-garden-id">
          </div>
          <input type="text" id="wt-inline-desc" placeholder="מה צריך לעשות? (הקלד ולחץ Enter)" onkeydown="if(event.key==='Enter') window.wtAddInlineTask()" style="flex:1; min-width:200px; padding:0 6px; height:36px; border:none; background:transparent; outline:none; font-family:inherit; font-size:1.1rem; color:#333; border-radius:4px;">
          <label style="display:flex; align-items:center; gap:4px; cursor:pointer; font-size:0.85rem; color:#e65100; line-height:1;">
            <input type="checkbox" id="wt-inline-admin"> 🔒 אישי
          </label>
          <button onclick="window.wtAddInlineTask()" style="background:#1565c0; color:white; border:none; border-radius:15px; padding:6px 15px; font-weight:bold; cursor:pointer; height:32px; line-height:1;">הוסף</button>
        </div>
      </div>
    \`;
  }
  html += \`
      </div>
    </div>
  \`;
  container.innerHTML = html;
`;
code = code.replace(targetEnd, replacementEnd);

fs.writeFileSync('worker_tasks.js', code);
console.log('Done');
