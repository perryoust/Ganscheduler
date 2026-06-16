const fs = require('fs');
let code = fs.readFileSync('worker_tasks.js', 'utf8');

const targetEnd = `  html += \`
      </div>
    </div>
  \`;
  container.innerHTML = html;`;

const newEnd = `  if (!isSearch) {
    html += \`
      <!-- Chat Input Area (WhatsApp style) -->
      <div class="wt-no-print" style="position:absolute; bottom:0; left:0; right:0; background:#f0f0f0; padding:10px; display:flex; align-items:center; gap:8px; border-radius:0 0 8px 8px; border-top:1px solid #e0e0e0;">
        
        <div style="flex:1; background:#ffffff; border-radius:24px; display:flex; align-items:center; padding:4px 15px; gap:8px; box-shadow:0 1px 2px rgba(0,0,0,0.1);">
          <div style="position:relative; width:130px; border-left:1px solid #eee; padding-left:8px;">
            <input type="text" id="wt-inline-garden" placeholder="📍 חפש גן..." onkeyup="window.wtSearchGardenInline(this.value)" style="width:100%; border:none; background:transparent; outline:none; font-size:0.9rem; color:#075e54; font-weight:bold;">
            <div id="wt-inline-garden-results" style="position:absolute; bottom:110%; right:0; width:200px; max-height:150px; overflow-y:auto; background:#fff; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.2); z-index:100; display:none; line-height:1.2;"></div>
            <input type="hidden" id="wt-inline-garden-id">
          </div>
          
          <input type="text" id="wt-inline-desc" placeholder="הקלד הודעה/משימה..." onkeydown="if(event.key==='Enter') window.wtAddInlineTask()" style="flex:1; border:none; background:transparent; outline:none; font-size:1rem; color:#333;">
          
          <label style="display:flex; align-items:center; cursor:pointer;" title="משימה אישית (לא תיראה לעובד)">
            <input type="checkbox" id="wt-inline-admin" style="margin:0;">
            <span style="font-size:1.1rem; margin-right:4px; opacity:0.8;">🔒</span>
          </label>
        </div>
        
        <button onclick="window.wtAddInlineTask()" style="background:#00a884; color:white; border:none; border-radius:50%; width:44px; height:44px; display:flex; justify-content:center; align-items:center; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.2); flex-shrink:0;" title="שלח משימה">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" style="transform:translateX(-2px) rotate(180deg);"><path d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path></svg>
        </button>
        
      </div>
    \`;
  }
  html += \`
      </div>
    </div>
  \`;
  container.innerHTML = html;`;

if (code.includes('<!-- Chat Input Area (WhatsApp style) -->')) {
  console.log('Already exists!');
} else {
  code = code.replace(targetEnd, newEnd);
  // We need to add bottom padding to the notebook to make room for the fixed input area!
  // The input area is absolute bottom:0. It takes around 64px height.
  // The notebook padding-bottom is 20px. Let's make it 80px so text doesn't overlap the input area.
  code = code.replace(/padding:20px 20px 20px 20px;/g, 'padding:20px 20px 80px 20px;');
  fs.writeFileSync('worker_tasks.js', code);
  console.log('Fixed WhatsApp input area!');
}
