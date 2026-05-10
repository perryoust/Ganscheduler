/**
 * Bulk Import/Export Schedule Logic
 * v4.0.0 - Smarter Architecture
 */

window.exportBulkSchedule = async function() {
  if (typeof window.ExcelJS === 'undefined') {
    alert('שגיאה: ספריית ExcelJS לא נטענה');
    return;
  }
  try {
    const workbook = new window.ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Schedule');
    ws.views = [{ rightToLeft: true }];
    ws.columns = [
      { header: 'Event ID', key: 'id', width: 15 },
      { header: 'תאריך (YYYY-MM-DD)', key: 'd', width: 15 },
      { header: 'מזהה גן (ID)', key: 'g', width: 10 },
      { header: 'שם הגן', key: 'garden_name', width: 20 },
      { header: 'עיר', key: 'city', width: 15 },
      { header: 'ספק', key: 'a', width: 20 },
      { header: 'פעילות', key: 'act', width: 20 },
      { header: 'שעה (HH:MM)', key: 't', width: 10 },
      { header: 'קבוצה', key: 'grp', width: 10 },
      { header: 'סטטוס', key: 'st', width: 10 },
      { header: 'טלפון', key: 'p', width: 15 },
      { header: 'הערות', key: 'n', width: 30 }
    ];
    ws.getRow(1).font = { bold: true };
    const sch = [...(window.SCH || [])].sort((a,b)=>a.d.localeCompare(b.d)||(window.G(a.g).city||'').localeCompare(window.G(b.g).city||'','he'));
    sch.forEach(s => {
      const g = window.G(s.g);
      ws.addRow({
        id: s.id, d: s.d, g: s.g, garden_name: g ? g.name : '', city: g ? g.city : '',
        a: s.a || '', act: s.act || '', t: s.t || '', grp: s.grp || 1, st: s.st || 'ok', p: s.p || '', n: s.n || ''
      });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kids_Schedule_Bulk_${new Date().toISOString().slice(0,10)}.xlsx`;
    a.click();
    window.showToast('✅ לוח זמנים יוצא בהצלחה');
  } catch (err) {
    alert('שגיאה בייצוא: ' + err.message);
  }
};

window.importBulkSchedule = function(input) {
  const file = input.files[0];
  if (!file) return;

  const statusEl = document.getElementById('bulk-import-status');
  if (statusEl) statusEl.innerHTML = '⏳ מנתח נתונים (Smarter Import v4)...';

  window._importInProgress = true;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      if (!window.XLSX) throw new Error('ספריית XLSX לא נטענה');
      const workbook = window.XLSX.read(data, { type: 'array', cellDates: true });
      const sheetNames = workbook.SheetNames.sort((a, b) => {
        const getPrio = n => (/השלמה|השלמות/.test(n) ? 3 : (/חוסר|חוסרים|לא התקיים/.test(n) ? 2 : 1));
        return getPrio(a) - getPrio(b);
      });

      const schMap = {};
      const stats = { sheets: 0, rows: 0, imported: 0, skippedDate: 0, skippedGarden: new Set() };
      
      const srawsLookup = {};
      if (Array.isArray(window.SRAWS)) {
        window.SRAWS.forEach(s => {
          const k = `${s.d}|${s.g}|${window.utils.norm(s.a)}|${s.t}`;
          srawsLookup[k] = s.id;
        });
      }

      for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const isExS = /חוסר|חוסרים|לא התקיים/.test(sheetName);
        const isMkS = /השלמה|השלמות/.test(sheetName);

        let bestHeader = { idx: -1, count: 0, map: {} };
        for (let i = 0; i < Math.min(15, rows.length); i++) {
          const r = rows[i];
          if (!r || !Array.isArray(r)) continue;
          
          let found = 0, currentMap = {};
          r.forEach((c, idx) => {
            if (!c) return;
            const s = String(c).trim();
            const n = window.utils.norm(s);
            currentMap[n] = idx;
            
            if (/תאריך|date|יום/.test(s)) found++;
            if (/גן|garden|צהרון/.test(s)) found++;
            if (/חוג|ספק|activity/.test(s)) found++;
          });

          if (found > bestHeader.count) {
            bestHeader = { idx: i, count: found, map: currentMap };
          }
          if (found >= 3) break;
        }

        if (bestHeader.count < 2) {
          console.warn(`[Import] No valid headers in "${sheetName}" (Best match count: ${bestHeader.count})`);
          continue;
        }

        headerRowIdx = bestHeader.idx;
        colMap = bestHeader.map;
        console.log(`[Import] Best header row ${headerRowIdx} in "${sheetName}" (${bestHeader.count} matches):`, Object.keys(colMap));
        
        // Debug: alert first row after header
        if (rows.length > headerRowIdx + 1) {
           const debugRow = JSON.stringify(rows[headerRowIdx + 1]);
           console.log(`[Import] First data row preview: ${debugRow}`);
        } else {
           console.warn(`[Import] Sheet "${sheetName}" has no rows after header at index ${headerRowIdx}. Total rows: ${rows.length}`);
        }

        stats.sheets++;

        const getCol = (names) => {
          for (let n of names) {
            const normN = window.utils.norm(n);
            if (colMap[normN] !== undefined) return colMap[normN];
            for (let k in colMap) if (k.includes(normN)) return colMap[k];
          }
          return null;
        };

        const cD = getCol(['תאריך', 'date']), cG = getCol(['גן', 'garden']), cS = getCol(['חוג', 'ספק', 'activity']);
        const cT = getCol(['שעה', 'time']), cGr = getCol(['קבוצה', 'group']), cN = getCol(['הערות', 'notes']), cSt = getCol(['סטטוס', 'status']);
        if (cD === null || cG === null || cS === null) continue;

        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every(c => !c)) continue;
          stats.rows++;

          const val = (idx) => (idx !== null && row[idx] !== undefined) ? row[idx] : null;

          let d = '';
          const rd = val(cD);
          if (rd instanceof Date) d = new Date(rd.getTime() + 12*3600000).toISOString().slice(0, 10);
          else if (typeof rd === 'number') d = new Date(new Date(1899,11,30).getTime() + rd*86400000 + 12*3600000).toISOString().slice(0, 10);
          else if (typeof rd === 'string') {
            const m = rd.match(/(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})/);
            if (m) d = `${m[3].length===2?'20'+m[3]:m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
          }
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { stats.skippedDate++; continue; }

          const gn = String(val(cG) || '').trim();
          const city = getCol(['עיר', 'ישוב']) !== null ? String(val(getCol(['עיר', 'ישוב'])) || '').trim() : '';
          const garden = window.utils.findGarden(gn, city);
          if (!garden) { if (gn) stats.skippedGarden.add(gn); continue; }

          const sRaw = String(val(cS) || '');
          const parts = sRaw.split(' - ');
          const supplier = window.utils.findSupplier(parts[0]);
          if (!supplier) continue;

          const aName = window.utils.norm(parts[1] || '');
          const acts = typeof window.getSupActs === 'function' ? window.getSupActs(supplier.name) : [];
          const actName = acts.find(a => window.utils.norm(a) === aName) || aName || sRaw;

          let t = '';
          const rt = val(cT);
          if (typeof rt === 'number') {
            const mTot = Math.round(rt * 1440);
            t = `${Math.floor(mTot/60).toString().padStart(2,'0')}:${(mTot%60).toString().padStart(2,'0')}`;
          } else if (rt instanceof Date) t = `${rt.getHours().toString().padStart(2,'0')}:${rt.getMinutes().toString().padStart(2,'0')}`;
          else if (rt) {
            const tm = String(rt).trim().replace(/[^\d:]/g, '').slice(0, 5);
            if (tm.includes(':')) { const p = tm.split(':'); t = p[0].padStart(2,'0') + ':' + p[1].padStart(2,'0'); }
          }

          const nt = String(val(cN) || '').trim();
          const isMk = isMkS || nt.includes('השלמה');
          let st = isExS ? 'nohap' : 'ok';
          const vSt = window.utils.norm(val(cSt));
          const lNt = nt.toLowerCase();

          if (/לא התקיים|nohap|לא התקימה/.test(vSt)) st = 'nohap';
          else if (/בוטל|can/.test(vSt)) st = 'can';
          else if (/נדחה|post/.test(vSt)) st = 'post';
          else if (/התקיים|done|ok/.test(vSt)) st = 'done';
          else if (st === 'ok') {
            if (['חסר מדריך', 'לא התקיים', 'חוסר מדריך', 'לא הגיע'].some(w => lNt.includes(w))) st = 'nohap';
            else if (['בוטל', 'מבוטל', 'סגר', 'שביתה'].some(w => lNt.includes(w))) st = 'can';
            else if (/הושלם|התקיים|בוצע/.test(lNt)) st = 'done';
          }

          const fullA = actName ? `${supplier.name} - ${actName}` : supplier.name;
          const sKey = `${d}|${garden.id}|${window.utils.norm(fullA)}|${t}`;
          const fId = srawsLookup[sKey] || window.utils.getEventId(d, garden.id, supplier.name, actName, t);

          if (!schMap[fId] || st !== 'ok' || schMap[fId].st === 'ok') {
            schMap[fId] = {
              id: fId, d, g: garden.id, a: fullA, act: actName, t, st, nt,
              grp: (st === 'can' || st === 'nohap') ? 0 : (val(cGr) || 1),
              _makeupFrom: isMk ? (nt.match(/(\d{1,2})[\.\/](\d{1,2})/) ? `${d.split('-')[0]}-${nt.match(/(\d{1,2})[\.\/](\d{1,2})/)[2].padStart(2,'0')}-${nt.match(/(\d{1,2})[\.\/](\d{1,2})/)[1].padStart(2,'0')}` : '') : '',
              _isImported: true, _isMakeup: isMk || undefined
            };
            stats.imported++;
          }
        }
      }

      const newSCH = Object.values(schMap);
      if (newSCH.length === 0) {
        let msg = 'לא נמצאו נתונים תקינים לעדכון.';
        if (stats.sheets === 0) msg += '\nלא נמצאו כותרות מתאימות בגיליונות.';
        else {
          msg += `\nנסרקו ${stats.sheets} גיליונות ו- ${stats.rows} שורות.`;
          if (stats.skippedGarden.size > 0) msg += `\nלא זוהו ${stats.skippedGarden.size} גנים.`;
          if (stats.skippedDate > 0) msg += `\n${stats.skippedDate} שורות דולגו בגלל תאריך.`;
        }
        throw new Error(msg);
      }

      if (confirm(`✅ נמצאו ${newSCH.length} פעילויות.\nהאם לעדכן?`)) {
        window.SCH = newSCH;
        window.useSraws = false;
        const ok = await window.save(true);
        if (ok) {
          window._safeLS.setItem('fb_sync_ignore_until', String(Date.now() + 60000));
          let sec = 5, cd = document.createElement('div');
          cd.style = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.9);color:white;padding:30px;border-radius:15px;z-index:10000;text-align:center';
          const u = () => {
            cd.innerHTML = `<h3>הייבוא הושלם!</h3><p>מרענן בעוד <b>${sec}</b>...</p>`;
            if (sec <= 0) location.reload(); else { sec--; setTimeout(u, 1000); }
          };
          document.body.appendChild(cd);
          u();
        } else alert('השמירה נכשלה');
      }
    } catch (err) {
      alert('❌ שגיאה: ' + err.message);
    } finally {
      window._importInProgress = false;
      input.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
};
