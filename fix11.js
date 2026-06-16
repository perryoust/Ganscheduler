const fs = require('fs');

let admin = fs.readFileSync('admin.js', 'utf8');

const target1 = `              <input type="checkbox" \${u.permPurch?'checked':''} onchange="updateUserPerm('\${uid}','permPurch',this.checked)"> 🛒 רכש
            </label>`;

const replacement1 = `              <input type="checkbox" \${u.permPurch?'checked':''} onchange="updateUserPerm('\${uid}','permPurch',this.checked)"> 🛒 רכש
            </label>
            <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;cursor:pointer;margin-top:3px">
              <input type="checkbox" \${u.permWorker?'checked':''} onchange="updateUserPerm('\${uid}','permWorker',this.checked)"> 👷 משימות שטח
            </label>`;

if (admin.includes(target1) && !admin.includes('👷 משימות שטח')) {
  admin = admin.replace(target1, replacement1);
  fs.writeFileSync('admin.js', admin);
  console.log('Success: patched admin.js');
} else {
  console.log('Failed to patch admin.js: Target not found or already patched');
}
