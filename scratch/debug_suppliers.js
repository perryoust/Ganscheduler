const fs = require('fs');
const d = fs.readFileSync('data.js', 'utf8');
const SRAWS = JSON.parse(fs.readFileSync('sraws.json', 'utf8'));
const XLSX = require('xlsx');

const wb = XLSX.readFile('GAN.xlsx', {cellDates:true});
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1});

let gData = eval(fs.readFileSync('data.js','utf8').match(/var GARDENS=(\[[\s\S]*?\]);\s*\n/)[1]);
const SUPBASE = eval(fs.readFileSync('data.js','utf8').match(/var SUPBASE=(\[[\s\S]*?\]);\s*\n/)[1]);

function norm(v){
  return String(v).replace(/\(.*\)/g,'').replace(/[\"\']/g,'').replace(/\s+/g,' ').trim().toLowerCase();
}
function megaClean(v){
  return norm(v).replace(/[^א-תa-zA-Z0-9]/g,'');
}
function findSupplier(name){
  if(!name)return null;
  const n=norm(name);
  const m=megaClean(name);
  let f=SUPBASE.find(s=>norm(s.name)===n);
  if(f)return f;
  f=SUPBASE.find(s=>megaClean(s.name)===m);
  if(f)return f;
  const base=name.split(' - ')[0];
  const nb=norm(base);
  return SUPBASE.find(s=>norm(s.name).startsWith(nb));
}

let noSupCount = 0;
let noSupExamples = new Set();
for(let i=1; i<rows.length; i++){
  const r=rows[i];
  if(!r) continue;
  const rawA=String(r[8]||'').trim();
  if(!rawA||rawA==='null') continue;
  const sup=findSupplier(rawA);
  if(!sup){
    noSupCount++;
    noSupExamples.add(rawA);
  }
}

console.log('Skipped due to no supplier:', noSupCount);
console.log('Examples:', [...noSupExamples].slice(0, 10));
