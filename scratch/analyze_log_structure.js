const fs = require('fs');
const readline = require('readline');

async function analyzeLogStructure() {
  const fileStream = fs.createReadStream('C:\\Users\\Perry\\.gemini\\antigravity\\brain\\fb73567f-2e76-4e0d-90a7-6b17e207ae25\\.system_generated\\logs\\overview.txt');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const types = new Map();
  const sources = new Map();
  let count = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      types.set(obj.type, (types.get(obj.type) || 0) + 1);
      if (obj.source) sources.set(obj.source, (sources.get(obj.source) || 0) + 1);
      count++;
      if (count < 10) {
        console.log("Sample object:", JSON.stringify(obj, null, 2));
      }
    } catch (e) {
      // Ignore
    }
  }

  console.log("Total objects:", count);
  console.log("Types:", Array.from(types.entries()));
  console.log("Sources:", Array.from(sources.entries()));
}

analyzeLogStructure();
