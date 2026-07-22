const fs = require('fs');
let txt = fs.readFileSync('export_v107.js', 'utf8');

const start = txt.indexOf('if(isSupplierExport){');
let braceCount = 0;
let end = -1;
let started = false;
for(let i=start; i<txt.length; i++) {
    if(txt[i] === '{') {
        braceCount++;
        started = true;
    } else if(txt[i] === '}') {
        braceCount--;
        if(started && braceCount === 0) {
            end = i;
            break;
        }
    }
}

const replacement = `if(isSupplierExport){
        const isPlacement = opts.type === 'supplier_placement';

        const byCity = {};
        data.forEach(s => {
          const g = window.G(s.g);
          const c = g.city || 'ללא עיר';
          if(!byCity[c]) byCity[c] = [];
          byCity[c].push(s);
        });

        const cities = Object.keys(byCity).sort();
        const globalSummaryRows = [];
        let globalTotalGroups = 0;

        cities.forEach((city, cityIdx) => {
          const cityEvs = byCity[city];
          const types = [...new Set(cityEvs.map(s => window.gcls(window.G(s.g))))].sort((a,b) => a === 'גנים' ? -1 : (b === 'גנים' ? 1 : a.localeCompare(b)));
          
          types.forEach((type, typeIdx) => {
            let typeOk = 0, typeNo = 0, typeGroups = 0;
            const typeEvs = cityEvs.filter(s => window.gcls(window.G(s.g)) === type).sort((a,b) => {
              const ds = a.d.localeCompare(b.d);
              if(ds !== 0) return ds;
              const pA = window.gardenPair(a.g), pB = window.gardenPair(b.g);
              const nA = pA ? pA.name : window.G(a.g).name;
              const nB = pB ? pB.name : window.G(b.g).name;
              const ns = nA.localeCompare(nB, 'he');
              if(ns !== 0) return ns;
              return (a.t || '99:99').localeCompare(b.t || '99:99');
            });

            if (cityIdx > 0 || typeIdx > 0) {
              ws.addRow([]);
            }

            const titleRow = ws.addRow([\`\${window._supExName || 'כל הספקים'} - \${city} - \${type}\`]);
            titleRow.font = { bold: true };
            titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };
            titleRow.alignment = { horizontal: 'right' };
            ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, isPlacement ? 8 : 9);

            const headers = isPlacement ? ['רחוב', 'גן/בי"ס', 'תאריך', 'יום', 'שעה', 'קבוצות', 'סטטוס', 'הערות'] : ['תאריך', 'יום', 'גן/בי"ס', 'שם ספק החוגים', 'פעילות', 'שעה', 'קבוצות', 'סטטוס', 'הערות'];
            const headRow = ws.addRow(headers);
            headRow.font = { bold: true };
            headRow.eachCell(cell => {
              cell.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D9E6' } };
              cell.alignment = { horizontal: 'right' };
            });

            const schoolStats = {};
            typeEvs.forEach(s => {
              const statusLabel = (window.stLabel ? window.stLabel(s) : s.st).replace(/<[^>]*>/g, '');
              const g = window.G(s.g);
              const note = (s.nt || '').toLowerCase();
              
              if(!schoolStats[g.name]) schoolStats[g.name] = { ok: 0, grp: 0 };

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

              let grpCount = isOk ? (s.grp || 1) : 0;
              
              if(isOk) { typeOk++; totalOk++; schoolStats[g.name].ok++; } else { typeNo++; totalNo++; }
              typeGroups += grpCount;
              totalGroups += grpCount;
              schoolStats[g.name].grp += grpCount;

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

              const formattedNote = typeof window.formatNoteWithTag === 'function' ? window.formatNoteWithTag(s) : (s.nt || '');
              const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
              const dayStr = 'יום ' + dayNames[new Date(s.d).getDay()];
              
              const row = isPlacement 
                ? ws.addRow([g.st || '', g.name, window.fD(s.d), dayStr, s.t, grpCount, displayStatus, formattedNote]) 
                : ws.addRow([window.fD(s.d), dayStr, g.name, window.supBase ? window.supBase(s.a) : s.a, s.act || window.supAct(s.a) || '', s.t, grpCount, displayStatus, formattedNote]);
              
              row.eachCell(cell => {
                cell.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
                cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
                if(cell.value === null) cell.value = '';
              });
            });

            globalTotalGroups += typeGroups;

            if (isPlacement) {
              const typeSum = ws.addRow([\`📌 \${city} - \${type}: בוצעו \${typeGroups} פעילויות (כולל השלמות)\`, '', '', '', '', '', '', '']);
              typeSum.font = { bold: true, size: 10, color: { argb: 'FF1A237E' } };
              typeSum.eachCell((cell) => { cell.alignment = { horizontal: 'right' }; });
              ws.mergeCells(typeSum.number, 1, typeSum.number, 8);
              ws.addRow([]);

              const summaryTitleStr = opts.summaryTitle ? opts.summaryTitle.replace('סה"כ פעילויות לביצוע:', 'סה"כ פעילויות בדו"ח') : 'סה"כ פעילויות בדו"ח';
              const sumHead = ws.addRow([summaryTitleStr, '', '', '', '', '', '', '']);
              sumHead.font = { bold: true, size: 12 };
              sumHead.alignment = { horizontal: 'right' };
              ws.mergeCells(sumHead.number, 1, sumHead.number, 8);

              let sectionSummaryRows = [];
              if (type === 'ביה"ס' || type === 'בתי ספר') {
                Object.keys(schoolStats).sort().forEach(sName => {
                  if (schoolStats[sName].grp > 0) {
                    sectionSummaryRows.push({ label: sName, grp: schoolStats[sName].grp });
                  }
                });
              } else {
                if (typeGroups > 0) {
                  sectionSummaryRows.push({ label: \`\${city} - \${type}\`, grp: typeGroups });
                }
              }

              sectionSummaryRows.forEach(sr => {
                const row = ws.addRow([sr.label, \`\${sr.grp} פעילויות\`, '', '', '', '', '', '']);
                row.eachCell((cell, colNumber) => {
                  if(colNumber <= 2) cell.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
                  cell.alignment = { horizontal: 'right' };
                });
              });

              const totalRow = ws.addRow(['סה"כ קבוצות בדו"ח', \`\${typeGroups} פעילויות\`, '', '', '', '', '', '']);
              totalRow.font = { bold: true };
              totalRow.eachCell((cell, colNumber) => {
                if(colNumber <= 2) {
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
                  cell.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
                }
                cell.alignment = { horizontal: 'right' };
              });
              ws.addRow([]);
            }

            if (type === 'ביה"ס' || type === 'בתי ספר') {
              Object.keys(schoolStats).sort().forEach(sName => {
                if (schoolStats[sName].grp > 0) {
                  globalSummaryRows.push({ label: sName, grp: schoolStats[sName].grp });
                }
              });
            } else {
              if (typeGroups > 0) {
                globalSummaryRows.push({ label: \`\${city} - \${type}\`, grp: typeGroups });
              }
            }

          });
        });

        ws.addRow([]);
        
        let globalSummaryTitle = opts.summaryTitle || '📊 ריכוז פעילות סופי';
        if (isPlacement && globalSummaryTitle.includes('סה"כ פעילויות לביצוע:')) {
            globalSummaryTitle = globalSummaryTitle.replace('סה"כ פעילויות לביצוע:', 'סיכום כללי לדו"ח שיבוץ:');
        }

        const globalSumHead = ws.addRow([globalSummaryTitle, '', '', '', '', '', '', isPlacement ? '' : '', isPlacement ? undefined : '']);
        globalSumHead.font = { bold: true, size: 12 };
        globalSumHead.alignment = { horizontal: 'right' };
        ws.mergeCells(globalSumHead.number, 1, globalSumHead.number, isPlacement ? 8 : 9);

        globalSummaryRows.forEach(sr => {
          const text = isPlacement ? \`\${sr.grp} פעילויות\` : \`בוצעו \${sr.grp} פעילויות\`;
          const row = isPlacement ? ws.addRow([sr.label, text]) : ws.addRow([sr.label, text, '']);
          row.eachCell((cell, colNumber) => {
            if(isPlacement ? (colNumber <= 2) : (colNumber <= 3 && colNumber != 3)) {
               cell.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
            }
            cell.alignment = { horizontal: 'right' };
          });
          if(!isPlacement) ws.mergeCells(row.number, 2, row.number, 3);
        });

        const globalTotalRowText = isPlacement ? 'סה"כ קבוצות בדו"ח' : '₪ סה"כ קבוצות לתשלום (כללי)';
        const globalTotalValueText = isPlacement ? \`\${globalTotalGroups} פעילויות\` : globalTotalGroups;
        const globalTotalRow = isPlacement ? ws.addRow([globalTotalRowText, globalTotalValueText]) : ws.addRow([globalTotalRowText, '', globalTotalValueText]);
        globalTotalRow.font = { bold: true };
        globalTotalRow.eachCell((cell, colNumber) => {
          if(isPlacement ? (colNumber <= 2) : (colNumber <= 3)) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
            cell.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
          }
          cell.alignment = { horizontal: 'right' };
        });
        if(!isPlacement) ws.mergeCells(globalTotalRow.number, 1, globalTotalRow.number, 2);
        
        ws.addRow([]);
      }`;

txt = txt.substring(0, start) + replacement + txt.substring(end + 1);
fs.writeFileSync('export_v107.js', txt, 'utf8');
console.log('done!');
