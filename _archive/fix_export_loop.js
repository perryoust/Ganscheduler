const fs = require('fs');
let txt = fs.readFileSync('export_v107_dump.js', 'utf8');

const regex = /const types = Object\.keys\(byType\)\.sort\(\(a,\s*b\)\s*=>\s*a === 'גנים' \? -1 : \(b === 'גנים' \? 1 : a\.localeCompare\(b\)\)\);[\s\S]*?(?=\} else \{\s*const keys = Object\.keys\(data\[0\]\);)/;

const newBlock = `const types = Object.keys(byType).sort((a,b) => a === 'גנים' ? -1 : (b === 'גנים' ? 1 : a.localeCompare(b)));
        const summaryRows = [];
        types.forEach(type => {
          let typeGlobalGroups = 0;
          
          const typeEvsAll = byType[type];
          const byCity = {};
          typeEvsAll.forEach(s => {
            const c = window.G(s.g).city || 'אחר';
            if(!byCity[c]) byCity[c] = [];
            byCity[c].push(s);
          });
          
          const cities = Object.keys(byCity).sort();
          cities.forEach(city => {
            let typeOk = 0, typeNo = 0, typeGroups = 0;
            const schoolStats = {};
            const typeEvs = byCity[city].sort((a,b) => {
              const ds = a.d.localeCompare(b.d);
              if(ds !== 0) return ds;
              const pA = window.gardenPair(a.g), pB = window.gardenPair(b.g);
              if(pA !== pB) return pA.localeCompare(pB);
              return (a.t || '99:99').localeCompare(b.t || '99:99');
            });

            let actualName = window._supExName || 'כל הספקים';
            if (opts.title) {
                if (opts.title.includes('דו"ח פעילות לספק:')) {
                    actualName = opts.title.split('דו"ח פעילות לספק:')[1].split('(טווח')[0].trim();
                } else if (opts.title.includes('דו"ח שיבוצים לספק:')) {
                    actualName = opts.title.split('דו"ח שיבוצים לספק:')[1].split('(טווח')[0].trim();
                } else if (opts.title.includes('דו"ח שיבוץ לספק - ')) {
                    actualName = opts.title.split('-')[1].split('(טווח')[0].trim();
                }
            }
            const titleRow = ws.addRow([\`\${actualName} - \${city} - \${type}\`]);
            titleRow.font = { bold: true };
            titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };
            titleRow.alignment = { horizontal: 'right' };
            ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, isPlacement ? 8 : 9);

            const headRow = isPlacement ? ws.addRow(['רחוב', 'גן/בי"ס', 'תאריך', 'יום', 'שעה', 'קבוצות', 'סטטוס', 'הערות']) : ws.addRow(['תאריך', 'יום', 'גן/בי"ס', 'שם ספק החוגים', 'פעילות', 'שעה', 'קבוצות', 'סטטוס', 'הערות']);
            headRow.font = { bold: true };
            headRow.eachCell(cell => {
               cell.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
               cell.alignment = { horizontal: 'right' };
            });

            typeEvs.forEach(s => {
              const g = window.G(s.g);
              const isSchool = window.gcls(g) === 'ביה"ס';
              const note = (s.nt || '').toLowerCase();
              
              if(!schoolStats[g.name]) schoolStats[g.name] = { ok: 0, grp: 0 };
              
              // Report is faithful to site, but has safety overrides for notes
              const isMakeup = note.includes('השלמה');
              const isMovedFrom = note.includes('נדחה מ') || note.includes('הוזז מ') || note.includes('הזזה מ') || note.includes('הוקדם מ');
              const isMovedTo = note.includes('נדחה ל') || note.includes('הוזז ל') || note.includes('הזזה ל') || note.includes('הוקדם ל');
              const isPositive = isMakeup || isMovedFrom || ((note.includes('נדחה') || note.includes('הוקדם')) && !isMovedTo);

              let isOk = s.st === 'ok' || s.st === 'done';
              
              if(isOk) {
                const canWords = ['בוטל', 'מבוטל', 'מצב בטחוני', 'סגר', 'שביתה'];
                const nohapWords = ['חסר מדריך', 'חוסר מדריך', 'אין מדריך', 'לא התקיים', 'לא הגיע', 'חולה', 'נתקע', 'לא נשאר', 'עזב', 'לא התקיימה'];
                const isManualCancel = [...canWords, ...nohapWords].some(w => note.includes(w));
                if((isManualCancel || isMovedTo) && !isPositive) {
                   isOk = false;
                }
              }

              // Always show real group count from data, default to 1 if ok
              let grpCount = isOk ? (s.grp || 1) : 0;
              
              if(isOk) { typeOk++; totalOk++; schoolStats[g.name].ok++; } else { typeNo++; totalNo++; }
              typeGroups += grpCount;
              totalGroups += grpCount;
              schoolStats[g.name].grp += grpCount;

              // Clean up status label: show failure if not ok
              let displayStatus = statusLabel;
              if(!isOk) {
                const lower = note.toLowerCase();
                const canWords = ['בוטל', 'מבוטל', 'מצב בטחוני', 'סגר', 'שביתה'];
                if(canWords.some(w => lower.includes(w)) || s.st === 'can') {
                  displayStatus = '❌ בוטל';
                } else {
                  displayStatus = isPositive ? '⚠️ השלמה לא התקיימה' : '⚠️ לא התקיים';
                }
              } else if (statusLabel === 'מתקיים' || s.st === 'ok' || s.st === 'done') {
                 displayStatus = ''; 
              }
              
              let formattedNote = typeof window.formatNoteWithTag === 'function' ? window.formatNoteWithTag(s) : (s.nt || '');
              formattedNote = formattedNote.replace(/(✅|☑️)?\\s*טופל:\\s*טופל(\\s*\\|\\s*)?/g, '').trim();
              formattedNote = formattedNote.replace(/^\\|\\s*|\\s*\\|$/g, '').trim();
              
              const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
              const dayStr = 'יום ' + dayNames[new Date(s.d).getDay()];
              const row = isPlacement ? ws.addRow([g.addr || '', g.name, window.fD(s.d), dayStr, s.t, grpCount, displayStatus, formattedNote]) : ws.addRow([window.fD(s.d), dayStr, g.name, window.supBase ? window.supBase(s.a) : s.a, s.act || window.supAct(s.a) || '', s.t, grpCount, displayStatus, formattedNote]);
              row.eachCell(cell => {
                 cell.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
                 cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
              });
            });

            typeGlobalGroups += typeGroups;

            // Section Sub-Summary
            const typeSum = isPlacement ? ws.addRow([\`📌 \${city} - \${type}: בוצעו \${typeGroups} פעילויות (כולל השלמות)\`, '', '', '', '', '', '', '']) : ws.addRow([\`📌 \${city} - \${type}: בוצעו \${typeGroups} פעילויות (כולל השלמות)\`, '', '', '', '', '', '', '', '']);
            typeSum.font = { bold: true, size: 10, color: { argb: 'FF1A237E' } };
            typeSum.eachCell((cell) => {
              cell.alignment = { horizontal: 'right' };
            });
            ws.mergeCells(typeSum.number, 1, typeSum.number, isPlacement ? 8 : 9);
            ws.addRow([]);
            
            if (type === 'ביה"ס' || type === 'בתי ספר') {
              Object.keys(schoolStats).sort().forEach(sName => {
                if (schoolStats[sName].grp > 0) {
                  summaryRows.push({ label: sName, ok: schoolStats[sName].ok, grp: schoolStats[sName].grp });
                }
              });
            } else {
              if (typeGroups > 0) {
                summaryRows.push({ label: \`\${city} - \${type}\`, ok: typeOk, grp: typeGroups });
              }
            }
          });
          
          // Grand Summary for TYPE
          if (typeGlobalGroups > 0) {
            const typeGrandSum = isPlacement ? ws.addRow([\`סה"כ \${type}: \${typeGlobalGroups} קבוצות\`, '', '', '', '', '', '', '']) : ws.addRow([\`סה"כ \${type}: \${typeGlobalGroups} קבוצות\`, '', '', '', '', '', '', '', '']);
            typeGrandSum.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
            typeGrandSum.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF43A047' } };
            typeGrandSum.eachCell((cell) => { cell.alignment = { horizontal: 'right' }; });
            ws.mergeCells(typeGrandSum.number, 1, typeGrandSum.number, isPlacement ? 8 : 9);
            ws.addRow([]);
            
            // Add a divider in the summary table at the bottom too
            summaryRows.push({ label: \`--- סה"כ \${type} ---\`, ok: 0, grp: typeGlobalGroups, isHeader: true });
          }
        });

        ws.addRow([]);
        let summaryTitleStr = opts.summaryTitle || '📊 ריכוז פעילות סופי';
        if (isPlacement && summaryTitleStr.includes('סה"כ פעילויות לביצוע:')) {
            summaryTitleStr = summaryTitleStr.replace('סה"כ פעילויות לביצוע:', 'ריכוז פעילות לספק:');
        }
        const sumHead = isPlacement ? ws.addRow([summaryTitleStr, '', '', '', '', '', '', '']) : ws.addRow([summaryTitleStr, '', '', '', '', '', '', '', '']);
        sumHead.font = { bold: true, size: 12 };
        sumHead.alignment = { horizontal: 'right' };
        ws.mergeCells(sumHead.number, 1, sumHead.number, isPlacement ? 8 : 9);

        summaryRows.forEach(sr => {
          const row = isPlacement ? ws.addRow([sr.label, sr.isHeader ? '' : \`\${sr.grp} פעילויות\`]) : ws.addRow([sr.label, sr.isHeader ? '' : \`בוצעו \${sr.grp} פעילויות\`, '']);
          if (sr.isHeader) {
            row.font = { bold: true, color: { argb: 'FF1A237E' } };
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };
          }
          row.eachCell(cell => {
            cell.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
            cell.alignment = { horizontal: 'right' };
          });
        });

        const totalRow = isPlacement ? ws.addRow(['סה"כ קבוצות בדו"ח', totalGroups]) : ws.addRow(['₪ סה"כ קבוצות לתשלום (כללי)', '', totalGroups]);
        totalRow.font = { bold: true };
        totalRow.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
          cell.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
          cell.alignment = { horizontal: 'right' };
        });
        ws.mergeCells(totalRow.number, 1, totalRow.number, isPlacement ? 2 : 2);
        ws.addRow([]); // Blank row before the next type starts
      `;

if (regex.test(txt)) {
    txt = txt.replace(regex, newBlock + '\n      ');
    fs.writeFileSync('export_v107.js', txt);
    console.log('Replaced successfully');
} else {
    console.log('Regex did not match');
}
