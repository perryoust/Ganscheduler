const fs = require('fs');

try {
  // Let's load the data from backup.json or payload.json
  const data = JSON.parse(fs.readFileSync('backup.json', 'utf8'));
  const gardens = data.data.gardens || [];
  console.log(`Loaded ${gardens.length} gardens from backup.json.`);
  
  // Search for "בר לב"
  const barLev = gardens.filter(g => g.name.includes("בר לב") || g.name.includes("כצנלסון") || g.name.includes("נווה דליה"));
  console.log("\nMatching gardens in database:");
  barLev.forEach(g => {
    console.log(`ID: ${g.id}, Name: "${g.name}", City: "${g.city}"`);
  });
} catch (e) {
  console.error(e);
}
