const _SUP_ALIASES={};
function norm(s){return (s||'').toLowerCase().replace(/['"״׳\-]/g,'').replace(/\s+/g,'').trim();}
function megaClean(s){if(!s)return '';let str=s.replace(/['"״׳]/g,'');str=str.split(/[-\u2010-\u2015\u2212\u05BE\uFE58\uFE63\uFF0D\/]/)[0].trim();return str;}
function supAct(fullName){if(!fullName)return '';const n=_SUP_ALIASES[fullName]||fullName;const m=n.match(/^(.*?)\s*([-\u2010-\u2015\u2212\u05BE\uFE58\uFE63\uFF0D\/])\s*(.*)$/);if(m)return m[3].trim();return '';}
const allSups=[{id:13,name:'חיים בתנועה - התעמלות'},{id:23,name:'חיים בתנועה - ריקוד'},{id:25,name:'חיים בתנועה - תאטרון'}];
function findSupplier(name,all){
  const n=norm(name);
  let f=all.find(s=>norm(s.name)===n);
  if(f)return f;
  const m=megaClean(name);
  const matches=all.filter(s=>megaClean(s.name)===m);
  if(matches.length>0){
    if(matches.length===1)return matches[0];
    const b=matches.find(s=>{const act=supAct(s.name);return act&&n.includes(norm(act));});
    if(b)return b;
    if(name.match(/[-\u2010-\u2015\u2212\u05BE\uFE58\uFE63\uFF0D\/]/))return null;
    return matches[0];
  }
  return null;
}
function test(rawSupplier){
  const sup=findSupplier(rawSupplier,allSups);
  let supplierName;
  if(!sup){
    const firstWord=rawSupplier.split(/[\s\-–—]/)[0].trim();
    const lenient=allSups.find(s=>norm(s.name).startsWith(norm(firstWord)));
    if(!lenient) return 'no lenient';
    if(rawSupplier.match(/[-\u2010-\u2015\u2212\u05BE\uFE58\uFE63\uFF0D\/]/)){
      supplierName=rawSupplier.trim();
    }else{
      supplierName=lenient.name;
    }
  }else{
    supplierName=sup.name;
  }
  const act=supAct(supplierName);
  return {rawSupplier,supplierName,act};
}
console.log(test('חיים בתנועה - התעמלות'));
console.log(test('חיים בתנועה'));
console.log(test('חיים בתנועה - חוג בוקר'));
console.log(test('חיים בתנועה-התעמלות'));
