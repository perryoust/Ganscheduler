const fs = require('fs');

function fixExportFile(filename) {
    if (!fs.existsSync(filename)) return;
    let txt = fs.readFileSync(filename, 'utf8');

    // Fix the header for supplier name block (was "כל הספקים - עיר - גנים")
    txt = txt.replace(/const actualName = opts\.title && opts\.title\.includes\('דו"ח שיבוץ לספק - '\) \? opts\.title\.split\('-'\)\[1\]\.split\('\(טווח'\)\[0\]\.trim\(\) : \(window\._supExName \|\| 'כל הספקים'\);/, 
    `let actualName = window._supExName || 'כל הספקים';
            if (opts.title) {
                if (opts.title.includes('דו"ח פעילות לספק:')) {
                    actualName = opts.title.split('דו"ח פעילות לספק:')[1].split('(טווח')[0].trim();
                } else if (opts.title.includes('דו"ח שיבוצים לספק:')) {
                    actualName = opts.title.split('דו"ח שיבוצים לספק:')[1].split('(טווח')[0].trim();
                } else if (opts.title.includes('דו"ח שיבוץ לספק - ')) {
                    actualName = opts.title.split('-')[1].split('(טווח')[0].trim();
                }
            }`);

    // Fix the overall summary table text (was "₪ סה"כ קבוצות לתשלום (כללי)")
    txt = txt.replace(/const totalRow = isPlacement \? ws\.addRow\(\['סה"כ קבוצות בדו"ח', typeGlobalGroups\]\) : ws\.addRow\(\['₪ סה"כ קבוצות לתשלום \(כללי\)', '', typeGlobalGroups\]\);/g, 
    `const totalRow = isPlacement ? ws.addRow(['סה"כ קבוצות בדו"ח', typeGlobalGroups]) : ws.addRow(['סה"כ פעילויות לביצוע', '', typeGlobalGroups]);`);

    // Fix "📊 ריכוז פעילות סופי" when there's an opts.summaryTitle which incorrectly says "סה"כ פעילויות לביצוע: קידו..."
    // Wait, the user said: "ריכוז פעילות לספק: קידו התעמלות... במקום סה"כ פעילויות לביצוע: קידו..."
    // Where is opts.summaryTitle populated? In `core_dash.js` or `admin.js`?
    // Let's just fix it in `export_v107.js` directly by replacing the bad string if it exists in `opts.summaryTitle`.
    txt = txt.replace(/const summaryTitleStr = opts\.summaryTitle \|\| '📊 ריכוז פעילות סופי';/, 
    `let summaryTitleStr = opts.summaryTitle || '📊 ריכוז פעילות סופי';
            if (summaryTitleStr.includes('סה"כ פעילויות לביצוע:')) {
                summaryTitleStr = summaryTitleStr.replace('סה"כ פעילויות לביצוע:', 'ריכוז פעילות לספק:');
            }`);

    fs.writeFileSync(filename, txt);
    console.log('Fixed ' + filename);
}

fixExportFile('export_v107.js');
fixExportFile('export.js');
