const fs = require('fs');
let data = fs.readFileSync('gardens.js', 'utf8');

const targetStr = `    arr = arr.filter(p => {
      if(p.validFrom && rEnd < p.validFrom) return false;
      if(p.validTo && rStart > p.validTo) return false;
      return true;
    });
  }`;

const replacementStr = `    arr = arr.filter(p => {
      if(p.validFrom && rEnd < p.validFrom) return false;
      if(p.validTo && rStart > p.validTo) return false;
      return true;
    });
    
    // If there is ANY temporary pair active for this period, hide ALL permanent pairs
    if (arr.some(p => p.validFrom)) {
      arr = arr.filter(p => p.validFrom);
    }
  }`;

data = data.replace(targetStr, replacementStr);
fs.writeFileSync('gardens.js', data);
console.log('patched gardens.js pairs');
