const { JSDOM } = require('jsdom');
const dom = new JSDOM('<html><body></body></html>');
window = dom.window;
document = window.document;

function supBase(s){
  let w = String(s||'').replace(/"/g,'').replace(/'/g,'').replace(/ בעמ/g,'').replace(/ בע"מ/g,'');
  w = w.replace(/^(\S+)\s+-\s+(.*)$/, ''); 
  return w.trim();
}

console.log('supBase:', supBase('בלאק אנד וויט - מוראל אייזנברג'));
