const fs = require('fs');
let data = fs.readFileSync('gardens.js', 'utf8');

const targetStr = `    arr = arr.filter(cl => {
      if(cl.validFrom && rEnd < cl.validFrom) return false;
      if(cl.validTo && rStart > cl.validTo) return false;
      return true;
    });
  }`;

const replacementStr = `    arr = arr.filter(cl => {
      if(cl.validFrom && rEnd < cl.validFrom) return false;
      if(cl.validTo && rStart > cl.validTo) return false;
      return true;
    });
    
    // If there is ANY temporary cluster active for this period, hide ALL permanent clusters
    if (arr.some(c => c.validFrom)) {
      arr = arr.filter(c => c.validFrom);
    }
  }`;

data = data.replace(targetStr, replacementStr);
fs.writeFileSync('gardens.js', data);
console.log('patched gardens.js');
