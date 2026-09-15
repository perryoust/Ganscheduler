const fs = require('fs');

const supsRaw = fs.readFileSync('C:/Users/Perry/.gemini/antigravity-ide/brain/cc69a157-75a3-4692-83e2-535c46ccfe65/.system_generated/steps/2987/output.txt', 'utf8');
const schRaw = fs.readFileSync('C:/Users/Perry/.gemini/antigravity-ide/brain/cc69a157-75a3-4692-83e2-535c46ccfe65/.system_generated/steps/3007/output.txt', 'utf8');

const supEx = JSON.parse(supsRaw);
const SCH = JSON.parse(schRaw);

const SUPBASE=[{"id":1,"name":"חוגות - ניצני רפואה / ילדי הרכבת","phone":"054-4732253"},{"id":2,"name":"חוגות - ניצני רפואה","phone":"054-4732253"},{"id":3,"name":"תנועה בקצב","phone":"052-8575954"},{"id":16,"name":"תלתן - ספורט","phone":"054-6464387"},{"id":4,"name":"קידו - התעמלות","phone":"050-7500258"},{"id":5,"name":"מדברים על 4 - אילוף כלבים","phone":"050-371-2281"},{"id":6,"name":"שחר חוויות - מופע חנוכה","phone":"054-6589303"},{"id":7,"name":"פמיליסקול - משחק/תאטרון/פלסטלינה","phone":"058-6311608"},{"id":8,"name":"שחר חוויות - מופע פסח","phone":"054-6589303"},{"id":9,"name":"מעשיותאטרון - דרמה/מוסיקה","phone":"054-6589303"},{"id":10,"name":"תלתן - כלבנות","phone":"054-6464387"},{"id":11,"name":"מוראל - מוסיקה ריקוד והתעמלות","phone":"054-5369986"},{"id":12,"name":"ריקי LIKE - ג'ליקו","phone":"055-2288008"},{"id":13,"name":"חיים בתנועה - התעמלות","phone":"052-2242552"},{"id":14,"name":"דרך הספורט - התעמלות","phone":"052-8777920"},{"id":15,"name":"מהנדסי הדור הבא","phone":"054-5252581"},{"id":17,"name":"פמילי סקול - סיפור בתאטרון","phone":"058-6311608"},{"id":18,"name":"עליזה - סיפורים מוסיקליים","phone":"052-3215555"},{"id":19,"name":"תלתן - אנגלית לקטנטנים","phone":"054-6464387"},{"id":20,"name":"פמילי סקול - תנועה","phone":"052-2242552"},{"id":21,"name":"הקסם של אורנה - תאטרון","phone":"052-7211958"},{"id":22,"name":"חוגות - מנהיגות יצירתית","phone":"054-4732253"},{"id":23,"name":"חיים בתנועה - ריקוד","phone":"052-2242552"},{"id":24,"name":"פמילי סקול - יוגה","phone":"058-6311608"},{"id":25,"name":"חיים בתנועה - תאטרון","phone":"052-2242552"},{"id":26,"name":"פמילי סקול - פלסטלינה","phone":"058-6311608"},{"id":27,"name":"תלתן - ברייקדאנס","phone":"054-6464387"},{"id":28,"name":"טל טיפולים שיווק והדרכה - התעמלות","phone":"054-5252581"}];

global.window = {
  supEx,
  SCH,
  SUPBASE,
  _mergedAliasMap: null
};

function supBase(fullName){
  if(!fullName) return '';
  const norm = fullName;
  const match = norm.match(/^(.*?)\s*([-\u2010-\u2015\u2212\u05BE\uFE58\uFE63\uFF0D])\s*(.*)$/);
  const base = match ? match[1].trim() : norm.trim();
  
  if (typeof window !== 'undefined' && window.supEx) {
    if (!window._mergedAliasMap) {
      window._mergedAliasMap = {};
      for (const mainName in window.supEx) {
        if (window.supEx[mainName] && Array.isArray(window.supEx[mainName]._mergedFrom)) {
          window.supEx[mainName]._mergedFrom.forEach(alias => {
            window._mergedAliasMap[alias] = mainName;
          });
        }
      }
    }
    if (window._mergedAliasMap[base]) {
      return window._mergedAliasMap[base];
    }
  }
  return base;
}
global.window.supBase = supBase;

function supAct(fullName){
  if(!fullName) return '';
  const norm = fullName;
  const match = norm.match(/^(.*?)\s*([-\u2010-\u2015\u2212\u05BE\uFE58\uFE63\uFF0D\/])\s*(.*)$/);
  if(match) return match[3].trim();
  return '';
}
global.window.supAct = supAct;

// Copy getSupActs from suppliers.js
function getSupActs(name){
  if(!name) return[];
  const base=supBase(name);
  const exBase=supEx[base]||{};
  const exName=supEx[name]||{};
  const ex = Object.keys(exBase).length ? exBase : exName;
  const fromSch=new Set();

  window.SCH.forEach(s=>{ 
    if(window.supBase(s.a)===base){
      const a=window.supAct(s.a);
      if(a)fromSch.add(a);
      if(s.act)fromSch.add(s.act);
    } 
  });
  window.SUPBASE.forEach(s=>{ if(window.supBase(s.name)===base){const a=window.supAct(s.name);if(a)fromSch.add(a);} });
  const mergedFromBases = ex._mergedFrom||[];
  mergedFromBases.forEach(oldBase=>{
    SCH.forEach(s=>{ 
      if(supBase(s.a)===oldBase){
        const a=supAct(s.a);
        if(a)fromSch.add(a);
        if(s.act)fromSch.add(s.act);
      } 
    });
    SUPBASE.forEach(s=>{ if(supBase(s.name)===oldBase){const a=supAct(s.name);if(a)fromSch.add(a);} });
  });
  
  if(Array.isArray(exBase.acts)) exBase.acts.forEach(a=>{ if(a) fromSch.add(a); });
  if(Array.isArray(exName.acts)) exName.acts.forEach(a=>{ if(a) fromSch.add(a); });

  const hidden = new Set([...(exBase.hiddenActs || []), ...(exName.hiddenActs || [])]);
  return [...fromSch].filter(a => !hidden.has(a)).sort((a,b)=>a.localeCompare(b,'he'));
}

function getAllSup(){
  if(typeof window.SUPBASE==='undefined'||typeof window.supEx==='undefined') return [];
  const mergedAway = new Set(window.supEx['__merged_away']||[]);
  const map={};

  window.SUPBASE.forEach(s=>{
    if(mergedAway.has(s.name)) return;
    const base=window.supBase(s.name);
    const act=window.supAct(s.name);
    if(!map[base]) map[base]={name:base,phone:s.phone,acts:new Set(),fullNames:new Set()};
    if(act) map[base].acts.add(act);
    map[base].fullNames.add(s.name);
    if(!map[base].phone&&s.phone) map[base].phone=s.phone;
  });

  (window.supEx['__c']||[]).forEach(s=>{
    if(mergedAway.has(s.name)) return;
    const base=window.supBase(s.name);
    if(mergedAway.has(base)) return;
    if(!map[base]) map[base]={name:base,phone:s.phone||'',acts:new Set(),fullNames:new Set()};
    map[base].fullNames.add(s.name);
    if(!map[base].phone&&(s.phone||'')) map[base].phone=s.phone;
  });

  if(Array.isArray(window.SCH)){
    window.SCH.forEach(s=>{
      const base = window.supBase(s.a);
      if(!base) return; 
      if(!map[base]){
        map[base]={name:base, phone:'', acts:new Set(), fullNames:new Set(), isDiscovered:true};
      }
      const act = window.supAct(s.a);
      if(act) map[base].acts.add(act);
      map[base].fullNames.add(s.a);
    });
  }

  return Object.values(map).map(m=>({
    ...m,
    acts:[...m.acts].sort((a,b)=>a.localeCompare(b,'he')),
    fullNames:[...m.fullNames]
  })).sort((a,b)=>a.name.localeCompare(b.name,'he'));
}

console.log('getSupActs("לגדול בקצב ע\\"ר - סיפורים מוסיקליים"):', getSupActs('לגדול בקצב ע"ר - סיפורים מוסיקליים'));
console.log('getSupActs("לגדול בקצב"):', getSupActs('לגדול בקצב'));
console.log('supBase("לגדול בקצב"):', supBase('לגדול בקצב'));
console.log('supBase("לגדול בקצב ע\\"ר - סיפורים מוסיקליים"):', supBase('לגדול בקצב ע"ר - סיפורים מוסיקליים'));


