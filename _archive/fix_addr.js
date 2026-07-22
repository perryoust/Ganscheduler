const fs = require('fs');
let txt = fs.readFileSync('export_v107.js', 'utf8');

// Fix address: g.st -> (g.add || g.st)
const oldAddr = "g.st || ''";
const newAddr = "(g.add || g.st) || ''";

if (txt.includes(oldAddr)) {
    txt = txt.replace(oldAddr, newAddr);
    console.log("Fixed address field: g.st -> (g.add || g.st)");
} else {
    console.log("Could not find g.st pattern, checking current state...");
    // Check what's there now
    const idx = txt.indexOf("const row = isPlacement");
    if (idx !== -1) {
        console.log(txt.substring(idx, idx + 300));
    }
}

fs.writeFileSync('export_v107.js', txt, 'utf8');
console.log('Done!');
