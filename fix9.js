const fs = require('fs');

// 1. Update index.html
let html = fs.readFileSync('index.html', 'utf8');

// Add checkbox
const purchCheckbox = '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox"\n                      id="nu-perm-purch"> 🛒 רכש</label>';
const addWorkerCheckbox = '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox"\n                      id="nu-perm-worker"> 👷 משימות שטח</label>';
if (html.includes(purchCheckbox) && !html.includes('nu-perm-worker')) {
  html = html.replace(purchCheckbox, purchCheckbox + '\n                  ' + addWorkerCheckbox);
}

// Remove radio
const workerRadioRegex = /<label style="display:flex;align-items:center;gap:6px;cursor:pointer">\s*<input type="radio"\s*name="nu-access" value="worker"> 👷 עובד שטח \(משימות בלבד\)<\/label>/g;
html = html.replace(workerRadioRegex, '');
fs.writeFileSync('index.html', html);
console.log('index.html updated');

// 2. Update admin.js
let admin = fs.readFileSync('admin.js', 'utf8');

// In loadUsersList
const permPurchHTML = `<input type="checkbox" \${u.permPurch?'checked':''} onchange="updateUserPerm('\${uid}','permPurch',this.checked)"> 🛒 רכש
            </label>`;
const permWorkerHTML = `
            <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;cursor:pointer">
              <input type="checkbox" \${u.permWorker?'checked':''} onchange="updateUserPerm('\${uid}','permWorker',this.checked)"> 👷 משימות שטח
            </label>`;
if (admin.includes(permPurchHTML) && !admin.includes('permWorker')) {
  admin = admin.replace(permPurchHTML, permPurchHTML + permWorkerHTML);
}

// In createNewUser
const permPurchExtract = "const permPurch=document.getElementById('nu-perm-purch')?.checked||false;";
const permWorkerExtract = "const permWorker=document.getElementById('nu-perm-worker')?.checked||false;";
if (admin.includes(permPurchExtract) && !admin.includes(permWorkerExtract)) {
  admin = admin.replace(permPurchExtract, permPurchExtract + '\n  ' + permWorkerExtract);
}

const payloadExtract = "body:JSON.stringify({uid,username,name:displayName,role,email,permAct,permPurch,createdAt:Date.now()})";
const payloadReplace = "body:JSON.stringify({uid,username,name:displayName,role,email,permAct,permPurch,permWorker,createdAt:Date.now()})";
if (admin.includes(payloadExtract)) {
  admin = admin.replace(payloadExtract, payloadReplace);
}

// In _initUsersUI
const hasPurchLogic = "const purchModeBtn = document.getElementById('modeBtn-purch');";
const workerBtnLogic = `  const workerModeBtn = document.getElementById('modeBtn-worker');\n  if(workerModeBtn) workerModeBtn.style.display = (window.permWorker || isAdm) ? '' : 'none';\n\n  `;
if (admin.includes(hasPurchLogic) && !admin.includes('workerModeBtn.style.display')) {
  admin = admin.replace(hasPurchLogic, workerBtnLogic + hasPurchLogic);
}

fs.writeFileSync('admin.js', admin);
console.log('admin.js updated');

// 3. Update firebase_init.js
let fbi = fs.readFileSync('firebase_init.js', 'utf8');

// In onAuthStateChanged
const profilePerms = "permPurch = !!profile.permPurch;\n            permAct = profile.permAct !== false;";
const profilePermsReplace = "permPurch = !!profile.permPurch;\n            permAct = profile.permAct !== false;\n            permWorker = !!profile.permWorker;";
if (fbi.includes(profilePerms) && !fbi.includes('permWorker = !!profile.permWorker')) {
  fbi = fbi.replace(profilePerms, profilePermsReplace);
}

const windowPerms = "window.permPurch = permPurch;\n    window.permAct = permAct;\n    window.role = role;";
const windowPermsReplace = "window.permPurch = permPurch;\n    window.permAct = permAct;\n    window.permWorker = permWorker;\n    window.role = role;";
if (fbi.includes(windowPerms) && !fbi.includes('window.permWorker = permWorker')) {
  fbi = fbi.replace(windowPerms, windowPermsReplace);
}

// In the previous isolation check (which checked role === 'worker'), we change it to check permWorker
const isolationTarget = `if (role === 'worker') {`;
const isolationReplace = `if (permWorker && !permAct && !permPurch && role !== 'admin') {`;
if (fbi.includes(isolationTarget) && !fbi.includes(isolationReplace)) {
  fbi = fbi.replace(isolationTarget, isolationReplace);
}

fs.writeFileSync('firebase_init.js', fbi);
console.log('firebase_init.js updated');
