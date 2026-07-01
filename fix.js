const fs = require('fs'); let txt = fs.readFileSync('index.html', 'utf8');
const oldTxt = txt;
txt = txt.replace(/<input type="text" id="(suc-edit-[^"]+)"([^>]+)>/g, (m, id, rest) => {
  if (rest.includes('onchange=')) {
    if (id === 'suc-edit-keywords') return m.replace('window.sucSaveKeywordsAuto(this.value)', 'sucSaveEdit(true)');
    return m;
  }
  return \<input type=\"text\" id=\"\\"\ onchange=\"sucSaveEdit(true)\">\;
});
txt = txt.replace(/<select id="suc-edit-sched-phone"([^>]+)>/g, '<select id="suc-edit-sched-phone" onchange="sucSaveEdit(true)">');
txt = txt.replace(/onchange="sucTypeChg\(\)"/g, 'onchange="sucTypeChg(); sucSaveEdit(true)"');

if(oldTxt !== txt) {
  fs.writeFileSync('index.html', txt);
  console.log('Updated index.html');
} else {
  console.log('No changes in index.html');
}
