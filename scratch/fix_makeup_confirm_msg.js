const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, '..', 'activity.js');
let content = fs.readFileSync(filepath, 'utf8');

const oldConfirmLine = `  if(!confirm(\`לבצע שיבוץ השלמה ל-\${targets.length} גנים בתאריך \${window.fD(newDate)}?\`)) return;`;

const newConfirmLine = `  let totalGrps = 0;
  targets.forEach(tgt => {
    const targetOrigEv = window.SCH.find(x => 
      Number(x.g) === Number(tgt.g) && 
      x.d === origEv.d && 
      window.supBase(x.a) === window.supBase(origEv.a)
    );
    const grpCount = customGrp || (targetOrigEv ? targetOrigEv.grp : origEv.grp) || 1;
    totalGrps += grpCount;
  });

  const isSchool = window.gcls ? window.gcls(window.G(origEv.g)) === 'ביה"ס' : false;
  const unitName = isSchool ? 'בתי ספר' : 'גנים';
  const grpText = totalGrps > targets.length ? \` (\${totalGrps} קבוצות)\` : '';
  const gardenName = window.G(origEv.g) ? window.G(origEv.g).name : 'גן';
  const confirmMsg = targets.length === 1 
    ? \`לבצע שיבוץ השלמה ל-\${gardenName}\${grpText} בתאריך \${window.fD(newDate)}?\`
    : \`לבצע שיבוץ השלמה ל-\${targets.length} \${unitName}\${grpText} בתאריך \${window.fD(newDate)}?\`;

  if(!confirm(confirmMsg)) return;`;

if (content.includes(oldConfirmLine)) {
  content = content.replace(oldConfirmLine, newConfirmLine);
  console.log("Confirm line updated successfully");
} else {
  const normOld = oldConfirmLine.replace(/\r\n/g, '\n');
  const normNew = newConfirmLine.replace(/\r\n/g, '\n');
  const normContent = content.replace(/\r\n/g, '\n');
  if (normContent.includes(normOld)) {
    content = normContent.replace(normOld, normNew).replace(/\n/g, '\r\n');
    console.log("Confirm line updated successfully (normalized)");
  } else {
    console.log("Warning: Confirm line not found");
  }
}

fs.writeFileSync(filepath, content, 'utf8');
console.log("Done");
