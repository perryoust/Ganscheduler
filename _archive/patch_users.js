const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

const targetStr = `name="nu-access" value="edit">`;
const indexOfEdit = content.indexOf(targetStr);
if (indexOfEdit !== -1) {
  const endOfLabel = content.indexOf('</label>', indexOfEdit) + 8;
  const originalLabel = content.substring(content.lastIndexOf('<label', indexOfEdit), endOfLabel);
  
  const workerRole = `
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio"
                        name="nu-access" value="worker"> עובד שטח (משימות בלבד)</label>`;
                        
  content = content.replace(originalLabel, originalLabel + workerRole);
  fs.writeFileSync('index.html', content);
  console.log('patched index.html');
} else {
  console.log('not found');
}
