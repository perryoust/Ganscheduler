const fs = require('fs');
const d = fs.readFileSync('data.js', 'utf8');
const SRAWS = JSON.parse(fs.readFileSync('sraws.json', 'utf8'));
const XLSX = require('xlsx');

const wb = XLSX.readFile('GAN.xlsx', {cellDates:true});
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1});

let gData = eval(d.match(/var GARDENS=(\[[\s\S]*?\]);\s*\n/)[1]);
const byDG = {};
let count = 0;

for(let i=1; i<rows.length; i++) {
  const r = rows[i];
  if(!r || !r[5] || !r[3]) continue;
  
  let d = '';
  const rd = r[5];
  if(rd instanceof Date) d = rd.toISOString().slice(0,10);
  else if(typeof rd === 'number') d = new Date(new Date(1899,11,30).getTime()+rd*86400000+12*3600000).toISOString().slice(0,10);
  else if(typeof rd === 'string') {
    const m = rd.match(/(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})/);
    if(m) d = (m[3].length===2?'20'+m[3]:m[3])+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
  }
  if(!d) continue;

  const gn = String(r[3]||'').trim();
  const m = gn.replace(/[\"\'״׳]/g,'').replace(/\s+/g,' ').toLowerCase().replace(/^(גן|צהרון|ביהס|ביס|ביתספר|בית ספר)\s*/,'').split(' - ')[0].split(' / ')[0].split('-')[0].trim();
  
  const matches = gData.filter(g => {
    const gmc = g.name.replace(/[\"\'״׳]/g,'').replace(/\s+/g,' ').toLowerCase().replace(/^(גן|צהרון|ביהס|ביס|ביתספר|בית ספר)\s*/,'').split(' - ')[0].split(' / ')[0].split('-')[0].trim();
    return gmc === m;
  });
  
  if(matches.length > 0) {
    const g = matches[0];
    byDG[d + '|' + g.id] = true;
    count++;
  }
}

console.log('Imported Excel rows with valid Date/Garden:', count);

let kept = 0;
let dropped = 0;
SRAWS.forEach(s => {
  if (byDG[s.d + '|' + Number(s.g)]) dropped++;
  else kept++;
});

console.log('SRAWS records kept:', kept);
console.log('SRAWS records dropped:', dropped);
console.log('Total resulting records:', kept + count);
