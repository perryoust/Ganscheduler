const fs = require('fs');
const path = require('path');

function replaceInFile(filepath, target, replacement) {
  if (!fs.existsSync(filepath)) {
    console.log(`File not found: ${filepath}`);
    return;
  }
  let content = fs.readFileSync(filepath, 'utf8');
  if (content.includes(target)) {
    content = content.split(target).join(replacement);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`Successfully replaced in ${path.basename(filepath)}`);
  } else {
    // Try normalized newlines
    const normTarget = target.replace(/\r\n/g, '\n');
    const normContent = content.replace(/\r\n/g, '\n');
    if (normContent.includes(normTarget)) {
      const normReplacement = replacement.replace(/\r\n/g, '\n');
      const newContent = normContent.split(normTarget).join(normReplacement);
      fs.writeFileSync(filepath, newContent.replace(/\n/g, '\r\n'), 'utf8');
      console.log(`Successfully replaced in ${path.basename(filepath)} (normalized)`);
    } else {
      console.log(`Target not found in ${path.basename(filepath)}: ${target.substring(0, 40)}...`);
    }
  }
}

const dir = path.join(__dirname, '..');

// 1. core.js
replaceInFile(
  path.join(dir, 'core.js'),
  `gcls(g)==='ביה"ס'?'🏛️ בית ספר':'🏫 גן/צהרון'`,
  `gcls(g)==='ביה"ס'?'🏛️ צהרון בית ספר':'🏫 צהרון גן'`
);

// 2. index.html
replaceInFile(
  path.join(dir, 'index.html'),
  `<div class="fg" style="grid-column:1/-1"><label>🚀 שם הגן/מקום</label>`,
  `<div class="fg" style="grid-column:1/-1"><label>🚀 שם הצהרון/מקום</label>`
);

// 3. sched.js
replaceInFile(
  path.join(dir, 'sched.js'),
  `<option value="">בחר גן</option>`,
  `<option value="">בחר צהרון</option>`
);
replaceInFile(
  path.join(dir, 'sched.js'),
  `<th style="padding:8px">שם הגן</th>`,
  `<th style="padding:8px">שם הצהרון</th>`
);

// 4. activity.js
replaceInFile(
  path.join(dir, 'activity.js'),
  `<th style="padding:6px">גן</th>`,
  `<th style="padding:6px">צהרון</th>`
);
replaceInFile(
  path.join(dir, 'activity.js'),
  `<th style="padding:6px">שם הגן</th>`,
  `<th style="padding:6px">שם הצהרון</th>`
);

// 5. gardens.js
replaceInFile(
  path.join(dir, 'gardens.js'),
  `<span>שם הגן</span>`,
  `<span>שם הצהרון</span>`
);

console.log("All label updates completed!");
