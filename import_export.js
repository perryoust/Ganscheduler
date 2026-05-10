/**
 * Bulk Import/Export Schedule Logic
 * v4.2.0 - Tailored for GAN.xlsx structure
 */

window.importBulkSchedule = function(input) {
  const file = input.files[0];
  if (!file) return;

  const statusEl = document.getElementById('bulk-import-status');
  if (statusEl) statusEl.innerHTML = '⏳ מנתח נתונים (Smarter Import v4.2)...';

  window._importInProgress = true;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      if (!window.XLSX) throw new Error('ספריית XLSX לא נטענה');
      const workbook = window.XLSX.read(data, { type: 'array', cellDates: true });
      
      // Prioritize sheets: "חוגים" (General) -> "חוסרים להשלמה" (Exceptions)
      const sheetNames = workbook.SheetNames.sort((a, b) => {
        if (a.includes('חוגים')) return -1;
        if (b.includes('חוגים')) return 1;
        return 0;
      });

      const recordsToUpsert = [];
      const stats = { sheets: 0, rows: 0, imported: 0, skipped: 0, noGarden: 0, noDate: 0 };
      
      // Build SRAWS lookup for ID consistency
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
        if (rows.length < 2) continue;

        // Header detection (Best Match)
        let bestHeader = { idx: -1, count: 0, map: {} };
        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const r = rows[i];
          if (!r || !Array.isArray(r)) continue;
          let currentFound = 0, currentMap = {};
          r.forEach((c, idx) => {
            if (!c) return;
            const n = window.utils.norm(c);
            currentMap[n] = idx;
            if (/תאריך|date|יום/.test(n)) currentFound++;
            if (/גן|garden|צהרון/.test(n)) currentFound++;
            if (/חוג|ספק|activity|שם החוג/.test(n)) currentFound++;
          });
          if (currentFound > bestHeader.count) {
            bestHeader = { idx: i, count: currentFound, map: currentMap };
          }
        }

        // FALLBACK for GAN.xlsx known structure if detection is weak
        let col = bestHeader.map;
        const getC = (names, fallback) => {
          for (let n of names) {
            const normN = window.utils.norm(n);
            if (col[normN] !== undefined) return col[normN];
            for (let k in col) if (k.includes(normN)) return col[k];
          }
          return fallback;
        };

        const idxD = getC(['תאריך'], 5);
        const idxG = getC(['שם הצהרון', 'גן'], 3);
        const idxC = getC(['עיר'], 1);
        const idxA = getC(['שם החוג', 'ספק', 'חוג'], 8);
        const idxT = getC(['שעה'], 11);
        const idxN = getC(['הערות'], 12);

        console.log(`[Import] Sheet: ${sheetName}, HeaderRow: ${bestHeader.idx}, Indices: D=${idxD}, G=${idxG}, A=${idxA}`);
        stats.sheets++;

        for (let i = (bestHeader.idx === -1 ? 1 : bestHeader.idx + 1); i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 5) continue;
          stats.rows++;

          // 1. Date Parsing
          let d = '';
          const rd = row[idxD];
          if (rd instanceof Date) d = rd.toISOString().slice(0, 10);
          else if (typeof rd === 'number') d = new Date(new Date(1899,11,30).getTime() + rd*86400000 + 12*3600000).toISOString().slice(0, 10);
          else if (typeof rd === 'string') {
            const m = rd.match(/(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})/);
            if (m) d = `${m[3].length===2?'20'+m[3]:m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
          }
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { stats.noDate++; continue; }

          // 2. Garden Parsing
          const gn = String(row[idxG] || '').trim();
          const city = String(row[idxC] || '').trim();
          if (!gn) continue;
          const garden = window.utils.findGarden(gn, city);
          if (!garden) { stats.noGarden++; continue; }

          // 3. Activity/Supplier Parsing
          const rawA = String(row[idxA] || '').trim();
          if (!rawA || rawA === 'null') { stats.skipped++; continue; } // Skip placeholder rows
          const supplier = window.utils.findSupplier(rawA);
          if (!supplier) { stats.skipped++; continue; }

          // 4. Time Parsing
          let t = '14:00';
          const rt = row[idxT];
          if (typeof rt === 'number') {
            const mTot = Math.round(rt * 1440);
            t = `${Math.floor(mTot/60).toString().padStart(2,'0')}:${(mTot%60).toString().padStart(2,'0')}`;
          } else if (rt) {
            const tm = String(rt).trim().match(/(\d{1,2}):(\d{1,2})/);
            if (tm) t = tm[1].padStart(2,'0') + ':' + tm[2].padStart(2,'0');
          }

          // 5. Status Parsing (Exceptions)
          const nt = String(row[idxN] || '').trim();
          let st = 'ok';
          const lnt = nt.toLowerCase();
          if (/לא התקיים|חסר מדריך|לא הגיע|חוסר מדריך/.test(lnt)) st = 'nohap';
          else if (/בוטל|מבוטל/.test(lnt)) st = 'can';
          else if (/הושלם|בוצע|התקיים/.test(lnt)) st = 'done';

          const sKey = `${d}|${garden.id}|${window.utils.norm(supplier.name)}|${t}`;
          const fId = srawsLookup[sKey] || window.utils.getEventId(d, garden.id, supplier.name, '', t);

          recordsToUpsert.push({
            id: fId, d, g: garden.id, a: supplier.name, act: '', t, st, nt,
            grp: (st === 'can' || st === 'nohap') ? 0 : 1,
            _isImported: true
          });
          stats.imported++;
        }
      }

      if (recordsToUpsert.length === 0) {
        throw new Error(`לא נמצאו נתונים תקינים לעדכון.\nנסרקו ${stats.sheets} גיליונות ו- ${stats.rows} שורות.\n(חסרו תאריכים: ${stats.noDate}, גנים לא זוהו: ${stats.noGarden}, שורות ריקות: ${stats.skipped})`);
      }

      if (confirm(`✅ נמצאו ${recordsToUpsert.length} פעילויות לעדכון.\nהאם להמשיך?`)) {
        await window.DataManager.importBulk(recordsToUpsert);
        const ok = await window.save(true);
        if (ok) {
          window._safeLS.setItem('fb_sync_ignore_until', String(Date.now() + 60000));
          alert('הייבוא הושלם בהצלחה! המערכת תתרענן כעת.');
          location.reload();
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
