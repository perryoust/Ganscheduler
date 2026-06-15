const fs = require('fs');
let code = fs.readFileSync('worker_tasks.js', 'utf8');

// 1. We replace the UI building part of renderWorkerTasksAdmin
// It starts from "      <!-- Diary View -->" down to "container.innerHTML = html;"

const startMarker = '      <!-- Diary View -->';
const endMarker = 'container.innerHTML = html;';

const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf(endMarker, startIdx);

if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find markers!");
  process.exit(1);
}

const originalPart = code.substring(startIdx, endIdx + endMarker.length);

const newUI = `      <!-- Chat View -->
      <div style="background-color:#e5ddd5; border-radius:8px; box-shadow:inset 0 0 10px rgba(0,0,0,0.05); padding:20px 15px; min-height:400px; display:flex; flex-direction:column; position:relative;">
        <div style="flex:1; display:flex; flex-direction:column; gap:12px; padding-bottom:60px;">
        \`;

  if (isSearch) {
    html += \`<div style="text-align:center;"><span style="background:#e1f5fe; color:#0277bd; padding:4px 12px; border-radius:12px; font-size:0.8rem; box-shadow:0 1px 2px rgba(0,0,0,0.1);">🔍 תוצאות חיפוש עבור: "\${window.wtSearchQuery}" (\${displayTasks.length} תוצאות)</span></div>\`;
  }

  if (displayTasks.length === 0) {
    html += \`
      <div style="text-align:center; padding:50px; opacity:0.7;">
        <div style="background:#fff; display:inline-block; padding:10px 20px; border-radius:15px; box-shadow:0 1px 2px rgba(0,0,0,0.1); font-size:0.95rem; color:#555;">
          אין הודעות/משימות \${isSearch ? 'שתואמות לחיפוש' : 'ליום זה'}.
        </div>
      </div>
    \`;
  } else {
    // Group by date if search? For simplicity, just list them.
    displayTasks.forEach(t => {
      const gardenName = window.G ? (window.G(t.gardenId)?.name || 'גן לא ידוע') : 'גן לא ידוע';
      const city = window.G ? (window.G(t.gardenId)?.city || '') : '';
      const loc = city ? \`\${city} - \${gardenName}\` : gardenName;
      
      const isDone = t.status === 'done';
      const isPriv = t.isAdminOnly;
      
      // WhatsApp Sent Message style (RTL -> Left aligned, tail on left)
      html += \`
        <!-- Chat Bubble (Task) -->
        <div style="align-self: flex-end; max-width:85%; position:relative; display:flex; flex-direction:column; align-items:flex-end;">
          \${isSearch ? \`<div style="font-size:0.75rem; color:#888; margin-bottom:2px; text-align:center; width:100%;">\${window.fD ? window.fD(t.date) : t.date}</div>\` : ''}
          <div style="background:\${isDone ? '#f0f0f0' : '#dcf8c6'}; border-radius:12px 12px 0 12px; padding:8px 12px; box-shadow:0 1px 1px rgba(0,0,0,0.15); border:1px solid \${isDone?'#e0e0e0':'#c0e7a8'};">
            
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(0,0,0,0.05); padding-bottom:4px; margin-bottom:4px; gap:10px;">
              <span style="font-size:0.8rem; font-weight:bold; color:#075e54;">📍 \${loc}</span>
              <div style="display:flex; gap:6px;">
                <button onclick="window.wtToggleTaskStatus('\${t.id}')" style="background:transparent; border:none; padding:0; cursor:pointer; font-size:1rem;" title="סמן כבוצע/לא בוצע">
                  \${isDone ? '<span style="color:#4caf50;">✅</span>' : '⬜'}
                </button>
                <button onclick="window.wtAddNote('\${t.id}')" style="background:transparent; color:#888; border:none; padding:0; cursor:pointer; font-size:1rem;" title="הוסף הערה">💬</button>
                <button onclick="window.wtMoveTaskDate('\${t.id}')" style="background:transparent; color:#888; border:none; padding:0; cursor:pointer; font-size:1rem;" title="העבר תאריך">📅</button>
                <button onclick="window.deleteWorkerTask('\${t.id}')" style="background:transparent; color:#ef5350; border:none; padding:0; cursor:pointer; font-size:1rem;" title="מחק משימה">🗑️</button>
              </div>
            </div>
            
            <div style="font-size:1rem; color:\${isDone ? '#888' : '#303030'}; line-height:1.4; \${isDone ? 'text-decoration:line-through;' : ''}">
              \${t.desc.replace(/\\n/g, '<br>')}
            </div>
            
            <div style="display:flex; justify-content:flex-end; align-items:center; gap:5px; margin-top:4px; font-size:0.7rem; color:#888;">
              \${isPriv ? '<span style="color:#e65100;">🔒 אישי</span>' : ''}
              <span>\${isDone && t.doneAt ? \`בוצע: \${t.doneAt.split(' ')[1] || t.doneAt}\` : t.date}</span>
              <span style="color:\${isDone ? '#4fc3f7' : '#999'}; font-size:0.9rem;">✓✓</span>
            </div>
            
            \${t.workerNote ? \`
              <div style="margin-top:6px; background:rgba(255,255,255,0.7); padding:6px 10px; border-radius:8px; font-size:0.85rem; color:#444; border-right:3px solid #075e54;">
                <div style="font-weight:bold; font-size:0.7rem; color:#075e54;">תשובת עובד:</div>
                \${t.workerNote.replace(/</g, '&lt;')}
              </div>
            \` : ''}
          </div>
        </div>
      \`;
    });
  }

  html += \`</div>\`; // End of messages area

  if (!isSearch) {
    html += \`
      <!-- Chat Input Area (WhatsApp style) -->
      <div style="position:absolute; bottom:0; left:0; right:0; background:#f0f0f0; padding:10px; display:flex; align-items:center; gap:8px; border-radius:0 0 8px 8px;">
        
        <div style="flex:1; background:#ffffff; border-radius:24px; display:flex; align-items:center; padding:4px 15px; gap:8px; box-shadow:0 1px 2px rgba(0,0,0,0.1);">
          <div style="position:relative; width:130px; border-left:1px solid #eee; padding-left:8px;">
            <input type="text" id="wt-inline-garden" placeholder="📍 חפש גן..." onkeyup="window.wtSearchGardenInline(this.value)" style="width:100%; border:none; background:transparent; outline:none; font-size:0.9rem; color:#075e54;">
            <div id="wt-inline-garden-results" style="position:absolute; bottom:110%; right:0; width:200px; max-height:150px; overflow-y:auto; background:#fff; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.2); z-index:100; display:none; line-height:1.2;"></div>
            <input type="hidden" id="wt-inline-garden-id">
          </div>
          
          <input type="text" id="wt-inline-desc" placeholder="הקלד הודעה/משימה..." onkeydown="if(event.key==='Enter') window.wtAddInlineTask()" style="flex:1; border:none; background:transparent; outline:none; font-size:1rem; color:#333;">
          
          <label style="display:flex; align-items:center; cursor:pointer; title='משימה אישית (לא תיראה לעובד)'">
            <input type="checkbox" id="wt-inline-admin" style="margin:0;">
            <span style="font-size:1rem; margin-right:2px; opacity:0.6;">🔒</span>
          </label>
        </div>
        
        <button onclick="window.wtAddInlineTask()" style="background:#00a884; color:white; border:none; border-radius:50%; width:40px; height:40px; display:flex; justify-content:center; align-items:center; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.2); flex-shrink:0;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="transform:translateX(-2px) rotate(180deg);"><path d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path></svg>
        </button>
        
      </div>
    \`;
  }

  html += \`
      </div>
    </div>
  \`;
  container.innerHTML = html;`;

code = code.replace(originalPart, newUI);
fs.writeFileSync('worker_tasks.js', code);
console.log("Replaced UI successfully.");
