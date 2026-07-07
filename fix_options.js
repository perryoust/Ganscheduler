const fs = require('fs');
const files = ['suppliers.js', 'temp_core.js', 'core_dash.js', 'old_core.js'];
files.forEach(f => {
  if(fs.existsSync(f)) {
    let c = fs.readFileSync(f, 'utf8');
    c = c.replace(/<option value='\$\{s\.name\}'>/g, "<option value='${s.name.replace(/'/g, \"&#39;\")}'>");
    fs.writeFileSync(f, c);
    console.log('Fixed', f);
  }
});
