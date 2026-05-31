const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, '..', 'activity.js');
let content = fs.readFileSync(filepath, 'utf8');

const targetBlock = `  let totalGrps = 0;
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

  if(!confirm(confirmMsg)) return;
  
  const grpInput = document.getElementById('sp-mu-grp');
  const customGrp = grpInput ? parseInt(grpInput.value, 10) : null;`;

const replacementBlock = `  const grpInput = document.getElementById('sp-mu-grp');
  const customGrp = grpInput ? parseInt(grpInput.value, 10) : null;

  let totalGrps = 0;
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

if (content.includes(targetBlock)) {
  content = content.replace(targetBlock, replacementBlock);
  console.log("Moved customGrp declaration successfully");
} else {
  const normOld = targetBlock.replace(/\r\n/g, '\n');
  const normNew = replacementBlock.replace(/\r\n/g, '\n');
  const normContent = content.replace(/\r\n/g, '\n');
  if (normContent.includes(normOld)) {
    content = normContent.replace(normOld, normNew).replace(/\n/g, '\r\n');
    console.log("Moved customGrp declaration successfully (normalized)");
  } else {
    console.log("Warning: target block not found");
  }
}

fs.writeFileSync(filepath, content, 'utf8');
console.log("Done");
