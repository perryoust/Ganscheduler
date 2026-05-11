
const fs = require('fs');
try {
    const data = JSON.parse(fs.readFileSync('sraws.json', 'utf8'));
    console.log('Sample s.a values:');
    data.slice(0, 20).forEach(s => {
        console.log(`"${s.a}"`);
    });
} catch (e) {
    console.log('Error reading sraws.json:', e.message);
}
