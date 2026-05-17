const fs = require('fs');
const readline = require('readline');

async function getAllUserRequests() {
  const fileStream = fs.createReadStream('C:\\Users\\Perry\\.gemini\\antigravity\\brain\\fb73567f-2e76-4e0d-90a7-6b17e207ae25\\.system_generated\\logs\\overview.txt');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const userRequests = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'USER_INPUT') {
        userRequests.push({
          step: obj.step_index,
          created_at: obj.created_at,
          // Print all fields to see where the text is
          keys: Object.keys(obj),
          obj: obj
        });
      }
    } catch (e) {
      // Ignore
    }
  }

  // print the last 5 user inputs in full
  console.log(JSON.stringify(userRequests.slice(-5), null, 2));
}

getAllUserRequests();
