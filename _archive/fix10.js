const fs = require('fs');

let admin = fs.readFileSync('admin.js', 'utf8');

const target = `            <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;cursor:pointer">
              <input type="checkbox" \${u.permPurch?'checked':''} onchange="updateUserPerm('\${uid}','permPurch',this.checked)"> 🛒 רכש
            </label>`;

const replacement = `            <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;cursor:pointer">
              <input type="checkbox" \${u.permPurch?'checked':''} onchange="updateUserPerm('\${uid}','permPurch',this.checked)"> 🛒 רכש
            </label>
            <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;cursor:pointer;margin-top:3px">
              <input type="checkbox" \${u.permWorker?'checked':''} onchange="updateUserPerm('\${uid}','permWorker',this.checked)"> 👷 משימות שטח
            </label>`;

if (admin.includes(target) && !admin.includes('👷 משימות שטח')) {
  admin = admin.replace(target, replacement);
  fs.writeFileSync('admin.js', admin);
  console.log('admin.js patched successfully');
} else {
  console.log('Target not found or already patched');
}
