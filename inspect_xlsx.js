const fs = require('fs');

try {
    const content = fs.readFileSync('temp_xlsx/xl/sharedStrings.xml', 'utf8');
    const matches = content.match(/<t>(.*?)<\/t>/g);
    if (matches) {
        console.log("Found " + matches.length + " strings.");
        for (let i = 0; i < Math.min(100, matches.length); i++) {
            console.log(i + ": " + matches[i].replace(/<\/?t>/g, ''));
        }
    } else {
        console.log("No strings found in XML.");
    }
} catch (e) {
    console.log("Error: " + e.message);
}
