// ══════════════════════════════════════════════════════════════════════════
// GanScheduler Version Vault — Automated Versioned Data Checkpoints
// ══════════════════════════════════════════════════════════════════════════
// • Dual Tracking: Tracks both App Version (v113.04) AND Data Sequence (seq #1045).
// • Auto-detects progress: Creates new checkpoint when app version changes,
//   OR when data seq advances significantly (20+ changes / new day with work).
// • Compresses using GZIP Base64 (zero cost, under 1% of Firebase free tier).
// • Isolated in /version_backups (zero impact on ongoing live sync).
// • Retention rule: Keeps AT LEAST 10 latest checkpoints, and NEVER deletes < 10 days old.
// • One-click Restore & Download JSON.

(function () {
  'use strict';

  const VAULT_ROOT = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/version_backups';

  function getCurrentSeq() {
    if (typeof window._fbGetLocalSeq === 'function') {
      const s = window._fbGetLocalSeq();
      if (s) return parseInt(s, 10);
    }
    const stored = window._safeLS ? window._safeLS.getItem('_fbSeq') : null;
    return parseInt(stored || '0', 10);
  }

  function getVersionKey(ver, seq) {
    const rawVer = String(ver || window.APP_VERSION || 'unknown').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const seqNum = parseInt(seq || 0, 10);
    return `v${rawVer}_s${seqNum}`;
  }

  async function getAuthHeader() {
    let tok = null;
    if (window._fbUser) {
      try { tok = await window._fbUser.getIdToken(false); } catch (e) { }
    }
    return tok ? '?auth=' + tok : '';
  }

  // ── 1. Create a Version / Data Checkpoint ──────────────────────
  window.saveVersionBackup = async function (isManual = false) {
    const ver = window.APP_VERSION || '113.04';
    const currentSeq = getCurrentSeq();
    const vKey = getVersionKey(ver, currentSeq);

    console.log(`[VersionVault] Checking checkpoint requirement for ${vKey} (seq=${currentSeq}, manual=${isManual})...`);

    try {
      const authQ = await getAuthHeader();

      // Check if automatic backup is needed
      if (!isManual) {
        try {
          const listUrl = `${VAULT_ROOT}/meta.json${authQ}`;
          const res = await fetch(listUrl);
          if (res.ok) {
            const metaMap = await res.json();
            if (metaMap && typeof metaMap === 'object') {
              const items = Object.values(metaMap).filter(m => m && m.ts);
              items.sort((a, b) => (b.ts || 0) - (a.ts || 0));

              if (items.length > 0) {
                const latest = items[0];
                const lastSeq = parseInt(latest.seq || 0, 10);
                const seqDiff = currentSeq - lastSeq;
                const isNewAppVersion = (latest.version !== ver);
                const isNewDay = (new Date(latest.ts).toDateString() !== new Date().toDateString());

                let shouldBackup = false;
                let reason = '';

                if (isNewAppVersion) {
                  shouldBackup = true;
                  reason = `שדרוג גרסת מערכת מ-${latest.version} ל-${ver}`;
                } else if (seqDiff >= 20) {
                  shouldBackup = true;
                  reason = `הצטברו ${seqDiff} שינויים בנתונים (רצף ${lastSeq} ➔ ${currentSeq})`;
                } else if (isNewDay && seqDiff >= 5) {
                  shouldBackup = true;
                  reason = `יום פעילות חדש עם ${seqDiff} שינויים (רצף ${lastSeq} ➔ ${currentSeq})`;
                }

                if (!shouldBackup) {
                  console.log(`[VersionVault] Data is up to date (latest snapshot at seq #${lastSeq}, current seq #${currentSeq}, diff=${seqDiff}). Skipping.`);
                  return false;
                }

                console.log(`[VersionVault] 🚀 Auto-checkpoint triggered: ${reason}`);
              }
            }
          }
        } catch (ce) {
          console.warn('[VersionVault] Meta check warning:', ce.message);
        }
      }

      // Ensure data is loaded in memory
      const sch = Array.isArray(window.SCH) ? window.SCH : [];
      const sup = window.supEx || {};
      const inv = Array.isArray(window.INVOICES) ? window.INVOICES : [];
      const ord = Array.isArray(window.ORDERS) ? window.ORDERS : [];
      const del = Array.isArray(window.DELIVERIES) ? window.DELIVERIES : [];

      if (sch.length === 0 && !isManual) {
        console.warn('[VersionVault] Schedules not yet loaded in memory. Deferring checkpoint.');
        return false;
      }

      const backupPayload = {
        version: ver,
        seq: currentSeq,
        year: window.CURRENT_YEAR || 'tashpaz',
        createdAt: Date.now(),
        dateStr: new Date().toLocaleString('he-IL'),
        schedules: sch,
        suppliers: sup,
        customGardens: window._GARDENS_EXTRA || [],
        invoices: inv,
        orders: ord,
        deliveries: del,
        matzava: window.MATZAVA_STATE ? {
          records: Array.isArray(window.MATZAVA_STATE.records) ? window.MATZAVA_STATE.records : [],
          nutritionOnly: Array.isArray(window.MATZAVA_STATE.nutritionOnly) ? window.MATZAVA_STATE.nutritionOnly : [],
          schools: Array.isArray(window.MATZAVA_STATE.schools) ? window.MATZAVA_STATE.schools : [],
          lastSync: window.MATZAVA_STATE.lastSync || null
        } : null,
        config: {
          pairs: window.pairs || [],
          clusters: window.clusters || {},
          holidays: window.holidays || [],
          pairBreaks: window.pairBreaks || {},
          managers: window.managers || {},
          blockedDates: window.blockedDates || {},
          gardenBlocks: window.gardenBlocks || {},
          vatRate: window.VAT_RATE || 18,
          activeGardens: window.activeGardens ? [...window.activeGardens] : null,
          schoolBudgets: window.schoolBudgets || {},
          todos: window.todo ? window.todo.items : []
        }
      };

      const metaInfo = {
        version: ver,
        seq: currentSeq,
        key: vKey,
        ts: Date.now(),
        dateStr: new Date().toLocaleString('he-IL'),
        counts: {
          schedules: sch.length,
          suppliers: Object.keys(sup).length,
          invoices: inv.length,
          orders: ord.length,
          deliveries: del.length,
          matzava: ((window.MATZAVA_STATE?.records?.length || 0) + (window.MATZAVA_STATE?.schools?.length || 0) + (window.MATZAVA_STATE?.nutritionOnly?.length || 0))
        }
      };

      let bodyToSend;
      let isCompressed = false;
      if (window.utils && typeof window.utils.compressData === 'function') {
        const compressed = await window.utils.compressData(backupPayload);
        if (compressed) {
          bodyToSend = JSON.stringify({ gz: compressed, meta: metaInfo });
          isCompressed = true;
          metaInfo.gz = true;
        }
      }

      if (!isCompressed) {
        bodyToSend = JSON.stringify({ data: backupPayload, meta: metaInfo });
        metaInfo.gz = false;
      }

      // Save Data node
      const dataUrl = `${VAULT_ROOT}/data/${vKey}.json${authQ}`;
      const dr = await fetch(dataUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: bodyToSend
      });
      if (!dr.ok) throw new Error('HTTP ' + dr.status + ' on data node');

      // Save Meta node (lightweight index for fast listing)
      const metaUrl = `${VAULT_ROOT}/meta/${vKey}.json${authQ}`;
      await fetch(metaUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metaInfo)
      });

      console.log(`[VersionVault] ✅ Checkpoint ${vKey} saved successfully (seq #${currentSeq}, ${sch.length} sch, ${inv.length} inv).`);
      if (window.showToast) {
        window.showToast(`✅ נוצר גיבוי נתונים: גרסה ${ver} (רצף #${currentSeq})`);
      }

      // Auto-prune according to retention rule
      pruneOldVersionBackups(authQ);
      return true;

    } catch (err) {
      console.error('[VersionVault] Failed to save checkpoint:', err);
      if (isManual && window.showToast) window.showToast('❌ שגיאה בשמירת גיבוי: ' + err.message);
      return false;
    }
  };

  // ── 2. Retention Policy: >= 10 checkpoints, and NEVER delete < 10 days old ─
  async function pruneOldVersionBackups(authQ) {
    try {
      const listUrl = `${VAULT_ROOT}/meta.json${authQ}`;
      const res = await fetch(listUrl);
      if (!res.ok) return;
      const metaMap = await res.json();
      if (!metaMap || typeof metaMap !== 'object') return;

      const items = Object.entries(metaMap).map(([k, v]) => ({
        key: k,
        ts: v.ts || 0,
        version: v.version || k,
        seq: v.seq || 0
      }));

      // Sort descending (newest first)
      items.sort((a, b) => b.ts - a.ts);

      const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - TEN_DAYS_MS;

      // Retention rule:
      // The 10 most recent checkpoints are ALWAYS kept.
      // For items beyond 10th (index >= 10): only delete if created over 10 days ago!
      const toDelete = items.slice(10).filter(item => item.ts < cutoff);

      for (const item of toDelete) {
        console.log(`[VersionVault] 🗑️ Pruning old checkpoint beyond 10 versions & 10 days: ${item.key}`);
        await fetch(`${VAULT_ROOT}/data/${item.key}.json${authQ}`, { method: 'DELETE' });
        await fetch(`${VAULT_ROOT}/meta/${item.key}.json${authQ}`, { method: 'DELETE' });
      }
    } catch (e) {
      console.warn('[VersionVault] Pruning check error:', e);
    }
  }

  // ── 3. List All Checkpoints ───────────────────────────────────
  window.loadVersionBackupsList = async function () {
    try {
      const authQ = await getAuthHeader();
      const listUrl = `${VAULT_ROOT}/meta.json${authQ}`;
      const res = await fetch(listUrl);
      if (!res.ok) return [];
      const metaMap = await res.json();
      if (!metaMap || typeof metaMap !== 'object') return [];

      const list = Object.values(metaMap).map(m => ({
        key: m.key,
        version: m.version,
        seq: m.seq || 0,
        ts: m.ts || 0,
        dateStr: m.dateStr || (m.ts ? new Date(m.ts).toLocaleString('he-IL') : '—'),
        counts: m.counts || { schedules: 0, invoices: 0, suppliers: 0, orders: 0 }
      }));

      list.sort((a, b) => b.ts - a.ts);
      return list;
    } catch (e) {
      console.error('[VersionVault] Failed to load list:', e);
      return [];
    }
  };

  // ── 4. Safe Non-Destructive Protection (Live Overwrite Disabled) ─
  window.restoreVersionBackup = async function (vKey) {
    alert(
      '🛡️ שחזור דורס נחסם להגנה על המערכת!\n\n' +
      'כדי להבטיח שלעולם לא יידרס מידע קיים או ייגרם אובדן נתונים, כספת הגיבויים פועלת במצב קריאה וייצוא בלבד.\n\n' +
      'באפשרותך לייצא את הגרסה שנבחרה ישירות לקובץ אקסל מעוצב (📊 ייצוא לאקסל) או להוריד את קובץ הגיבוי (📥 הורד JSON).'
    );
  };

  // ── 5. Export Checkpoint directly to Excel (Multi-Sheet) ───────
  window.exportVersionBackupToExcel = async function (vKey) {
    if (!vKey) return;
    if (typeof window.ExcelJS === 'undefined') {
      alert('ספריית אקסל עדיין נטענת, אנא נסה שוב בעוד מספר שניות.');
      return;
    }

    const authQ = await getAuthHeader();
    try {
      if (window.showToast) window.showToast('📊 מושך נתונים ומכין קובץ אקסל מעוצב...');

      const dataUrl = `${VAULT_ROOT}/data/${vKey}.json${authQ}`;
      const dr = await fetch(dataUrl);
      if (!dr.ok) throw new Error('HTTP ' + dr.status);

      const payload = await dr.json();
      let fullData = null;
      if (payload.gz && window.utils?.decompressData) {
        fullData = await window.utils.decompressData(payload.gz);
      } else {
        fullData = payload.data || payload;
      }

      if (!fullData) throw new Error('קובץ הגיבוי ריק או פגום');

      const wb = new window.ExcelJS.Workbook();
      wb.creator = 'טומשין שיבוץ - כספת גיבויים';
      wb.created = new Date();

      const verLabel = fullData.version || vKey;
      const seqLabel = fullData.seq ? `#${fullData.seq}` : '';

      // Helper function to format header row
      function styleHeader(ws, argbColor) {
        const hRow = ws.getRow(1);
        hRow.height = 26;
        hRow.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argbColor } };
          cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rightToLeft' };
        });
      }

      // ─────────────────────────────────────────────────────────
      // SHEET 1: שיבוצי חוגים (Schedules)
      // ─────────────────────────────────────────────────────────
      const schedules = Array.isArray(fullData.schedules) ? fullData.schedules : [];
      if (schedules.length > 0) {
        const wsSch = wb.addWorksheet('שיבוצי חוגים', {
          views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
        });
        wsSch.columns = [
          { header: 'תאריך', key: 'date', width: 14 },
          { header: 'יום', key: 'day', width: 8 },
          { header: 'צהרון / גן', key: 'gName', width: 22 },
          { header: 'חוג / פעילות', key: 'act', width: 20 },
          { header: 'ספק', key: 'sup', width: 22 },
          { header: 'מפעיל', key: 'oper', width: 18 },
          { header: 'שעות', key: 'time', width: 14 },
          { header: 'סטטוס', key: 'st', width: 14 },
          { header: 'הערות', key: 'note', width: 30 }
        ];
        styleHeader(wsSch, 'FF1A237E');

        schedules.forEach(s => {
          let stText = s.st || 'מתוכנן';
          if (stText === 'done') stText = 'בוצע ✓';
          else if (stText === 'cancel') stText = 'בוטל';
          else if (stText === 'not_held') stText = 'לא התקיים';

          const r = wsSch.addRow({
            date: s.date || '',
            day: s.day || '',
            gName: s.gName || s.garden || '',
            act: s.act || s.subject || '',
            sup: s.sup || '',
            oper: s.oper || '',
            time: s.time || '',
            st: stText,
            note: s.note || ''
          });
          r.eachCell((cell, colNum) => {
            cell.alignment = { horizontal: (colNum === 1 || colNum === 2 || colNum === 7 || colNum === 8) ? 'center' : 'right', vertical: 'middle', readingOrder: 'rightToLeft' };
            cell.font = { name: 'Arial', size: 10 };
          });
        });
      }

      // ─────────────────────────────────────────────────────────
      // SHEET 2: חשבוניות רכש (Invoices)
      // ─────────────────────────────────────────────────────────
      const invoices = Array.isArray(fullData.invoices) ? fullData.invoices : [];
      if (invoices.length > 0) {
        const wsInv = wb.addWorksheet('חשבוניות רכש', {
          views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
        });
        wsInv.columns = [
          { header: 'ספק', key: 'sup', width: 22 },
          { header: 'מספר חשבונית', key: 'invNum', width: 16 },
          { header: 'סוג מסמך', key: 'type', width: 16 },
          { header: 'תאריך', key: 'date', width: 14 },
          { header: 'סכום לפני מע"מ', key: 'subtotal', width: 16 },
          { header: 'מע"מ', key: 'vat', width: 12 },
          { header: 'סה"כ לתשלום', key: 'total', width: 16 },
          { header: 'סטטוס', key: 'status', width: 14 },
          { header: 'הערות', key: 'notes', width: 30 }
        ];
        styleHeader(wsInv, 'FF2E7D32');

        let sumTotal = 0;
        invoices.forEach(inv => {
          let typeLabel = inv.type === 'tax_invoice' ? 'חשבונית מס' : (inv.type === 'tx_invoice' ? 'חשבון עסקה' : 'הזמנה');
          const tot = parseFloat(inv.total || inv.amt || 0) || 0;
          sumTotal += tot;
          const r = wsInv.addRow({
            sup: inv.sup || inv.supplier || '',
            invNum: inv.invNum || inv.num || '',
            type: typeLabel,
            date: inv.date || '',
            subtotal: inv.subtotal || '',
            vat: inv.vat || '',
            total: tot,
            status: inv.status || 'פתוח',
            notes: inv.notes || ''
          });
          r.eachCell((cell, colNum) => {
            cell.alignment = { horizontal: (colNum >= 4 && colNum <= 8) ? 'center' : 'right', vertical: 'middle', readingOrder: 'rightToLeft' };
            cell.font = { name: 'Arial', size: 10 };
          });
        });

        // Summary row
        const sumRow = wsInv.addRow({
          sup: 'סה"כ לתשלום',
          invNum: `${invoices.length} חשבוניות`,
          total: sumTotal
        });
        sumRow.font = { name: 'Arial', size: 11, bold: true };
        sumRow.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
      }

      // ─────────────────────────────────────────────────────────
      // SHEET 3: מצב"ה צהרונים (Matzava Gardens)
      // ─────────────────────────────────────────────────────────
      const matzavaRecords = (fullData.matzava && Array.isArray(fullData.matzava.records)) ? fullData.matzava.records : [];
      if (matzavaRecords.length > 0) {
        const wsMat = wb.addWorksheet('מצבה צהרונים', {
          views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
        });
        wsMat.columns = [
          { header: 'עיר', key: 'city', width: 14 },
          { header: 'שם הצהרון / גן', key: 'name', width: 22 },
          { header: 'כתובת', key: 'address', width: 22 },
          { header: 'גיל', key: 'age', width: 10 },
          { header: '10 חודשים', key: 'kids10', width: 12 },
          { header: '11 חודשים', key: 'kids11', width: 12 },
          { header: 'סה"כ ילדים', key: 'kidsTotal', width: 14 },
          { header: 'מתקיים ב-', key: 'hostGarden', width: 20 },
          { header: 'הערות ואלרגיות', key: 'notes', width: 35 }
        ];
        styleHeader(wsMat, 'FF4A148C');

        matzavaRecords.forEach(r => {
          const row = wsMat.addRow({
            city: r.city || '',
            name: r.name || r.hostGarden || '',
            address: r.address || '',
            age: r.age || '',
            kids10: r.kids10 || '',
            kids11: r.kids11 || '',
            kidsTotal: r.kidsTotal || 0,
            hostGarden: r.hostGarden || '',
            notes: r.notes || ''
          });
          row.eachCell((cell, colNum) => {
            cell.alignment = { horizontal: (colNum >= 4 && colNum <= 7) ? 'center' : 'right', vertical: 'middle', readingOrder: 'rightToLeft' };
            cell.font = { name: 'Arial', size: 10 };
          });
        });
      }

      // ─────────────────────────────────────────────────────────
      // SHEET 4: מצב"ה בתי ספר (Matzava Schools)
      // ─────────────────────────────────────────────────────────
      const matzavaSchools = (fullData.matzava && Array.isArray(fullData.matzava.schools)) ? fullData.matzava.schools : [];
      if (matzavaSchools.length > 0) {
        const wsSchMat = wb.addWorksheet('מצבה בתי ספר', {
          views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
        });
        wsSchMat.columns = [
          { header: 'עיר', key: 'city', width: 14 },
          { header: 'שם בית ספר', key: 'school', width: 24 },
          { header: 'כתובת', key: 'address', width: 22 },
          { header: 'כיתה / קבוצה', key: 'groupName', width: 18 },
          { header: 'רשומים בצהרון', key: 'kids', width: 14 },
          { header: 'איחוד לקבוצה', key: 'mergedKids', width: 14 },
          { header: 'הערות ואלרגיות', key: 'notes', width: 35 }
        ];
        styleHeader(wsSchMat, 'FF004D40');

        matzavaSchools.forEach(sc => {
          const row = wsSchMat.addRow({
            city: sc.city || '',
            school: sc.school || '',
            address: sc.address || '',
            groupName: sc.groupName || '',
            kids: sc.kids || 0,
            mergedKids: sc.mergedKids || sc.kids || 0,
            notes: sc.notes || ''
          });
          row.eachCell((cell, colNum) => {
            cell.alignment = { horizontal: (colNum >= 5 && colNum <= 6) ? 'center' : 'right', vertical: 'middle', readingOrder: 'rightToLeft' };
            cell.font = { name: 'Arial', size: 10 };
          });
        });
      }

      // ─────────────────────────────────────────────────────────
      // SHEET 5: ספקים (Suppliers)
      // ─────────────────────────────────────────────────────────
      const supObj = fullData.suppliers || {};
      const supKeys = Object.keys(supObj);
      if (supKeys.length > 0) {
        const wsSup = wb.addWorksheet('ספקים', {
          views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
        });
        wsSup.columns = [
          { header: 'שם הספק', key: 'name', width: 24 },
          { header: 'תחום פעילות', key: 'subject', width: 22 },
          { header: 'טלפון', key: 'phone', width: 16 },
          { header: 'אימייל / פרטים', key: 'email', width: 24 },
          { header: 'תעריף שעתי', key: 'cost', width: 14 },
          { header: 'הערות', key: 'notes', width: 30 }
        ];
        styleHeader(wsSup, 'FF37474F');

        supKeys.forEach(k => {
          const item = supObj[k] || {};
          const row = wsSup.addRow({
            name: k,
            subject: item.subject || item.sub || '',
            phone: item.phone || item.contact || '',
            email: item.email || '',
            cost: item.cost || item.rate || '',
            notes: item.notes || item.note || ''
          });
          row.eachCell((cell, colNum) => {
            cell.alignment = { horizontal: (colNum === 3 || colNum === 5) ? 'center' : 'right', vertical: 'middle', readingOrder: 'rightToLeft' };
            cell.font = { name: 'Arial', size: 10 };
          });
        });
      }

      // Export workbook to download
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GanScheduler_Archive_${vKey}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (window.showToast) window.showToast('✅ קובץ האקסל של גרסה זו יוצא בהצלחה!');
    } catch (e) {
      console.error('[VersionVault] Excel Export failed:', e);
      alert('❌ שגיאה בייצוא לאקסל: ' + e.message);
    }
  };

  // ── 6. Download Checkpoint JSON ───────────────────────────────
  window.downloadVersionBackup = async function (vKey) {
    if (!vKey) return;
    const authQ = await getAuthHeader();

    try {
      if (window.showToast) window.showToast('📥 מכין קובץ להורדה...');
      const dataUrl = `${VAULT_ROOT}/data/${vKey}.json${authQ}`;
      const dr = await fetch(dataUrl);
      if (!dr.ok) throw new Error('HTTP ' + dr.status);

      const payload = await dr.json();
      let fullData = null;

      if (payload.gz && window.utils?.decompressData) {
        fullData = await window.utils.decompressData(payload.gz);
      } else {
        fullData = payload.data || payload;
      }

      const jsonStr = JSON.stringify(fullData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GanScheduler_Backup_${vKey}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (window.showToast) window.showToast('✅ הקובץ ירד בהצלחה למחשב');
    } catch (e) {
      console.error('[VersionVault] Download failed:', e);
      alert('❌ שגיאה בהורדת הקובץ: ' + e.message);
    }
  };

  // ── 7. UI Modal ──────────────────────────────────────────────
  window.openVersionVaultModal = async function () {
    let m = document.getElementById('version-vault-modal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'version-vault-modal';
      m.className = 'modal';
      m.style.zIndex = '10050';
      m.innerHTML = `
        <div class="mb" style="max-width:780px; width:95%; max-height:85vh; display:flex; flex-direction:column; padding:20px; border-radius:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #eee; padding-bottom:12px; margin-bottom:15px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.5rem;">📦</span>
              <div>
                <h3 style="margin:0; color:#1a237e; font-size:1.2rem; font-weight:800;">כספת גיבויי נתונים (ארכיון לקריאה וייצוא בלבד)</h3>
                <div style="font-size:0.75rem; color:#607d8b;">שמירת צילומי מצב מלאים בענן — מוגן ב-100% מדריסה של המידע הפעיל</div>
              </div>
            </div>
            <button onclick="document.getElementById('version-vault-modal').classList.remove('open')" style="background:none; border:none; font-size:1.4rem; cursor:pointer; color:#78909c;">✕</button>
          </div>

          <div style="background:#e8f5e9; border:1px solid #c8e6c9; border-radius:8px; padding:10px 14px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <div style="font-size:0.82rem; font-weight:700; color:#1b5e20; display:flex; align-items:center; gap:8px;">
                <span>🛡️ <b>מוגן מדריסה</b>: כספת הגיבויים הינה ארכיון לקריאה בלבד!</span>
              </div>
              <div style="font-size:0.75rem; color:#2e7d32; margin-top:3px;">
                המידע נשמר בענן בנפרד. ניתן לייצא כל נקודת זמן ישירות לאקסל מעוצב מבלי לדרוס שום נתון קיים במערכת.
              </div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn bo bsm" onclick="window.renderVersionVaultList()" style="background:#fff; font-weight:700;">🔄 רענן רשימה</button>
            </div>
          </div>

          <div id="version-vault-list" style="flex:1; overflow-y:auto; min-height:220px; display:flex; flex-direction:column; gap:8px; padding-left:4px;">
            <div style="text-align:center; padding:30px; color:#90a4ae;">טוען רשימת גיבויים...</div>
          </div>

          <div style="display:flex; justify-content:flex-end; border-top:1px solid #eee; padding-top:12px; margin-top:15px;">
            <button class="btn bo" onclick="document.getElementById('version-vault-modal').classList.remove('open')">סגור</button>
          </div>
        </div>
      `;
      document.body.appendChild(m);
    }

    const curSeqEl = document.getElementById('vv-current-seq');
    if (curSeqEl) curSeqEl.textContent = '#' + getCurrentSeq();

    m.classList.add('open');
    window.renderVersionVaultList();
  };

  window.renderVersionVaultList = async function () {
    const el = document.getElementById('version-vault-list');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center; padding:30px; color:#90a4ae;">טוען נתונים מהענן...</div>';

    const list = await window.loadVersionBackupsList();
    if (!list || list.length === 0) {
      el.innerHTML = `
        <div style="text-align:center; padding:40px; color:#78909c; background:#fafafa; border-radius:8px;">
          <div style="font-size:2rem; margin-bottom:8px;">📂</div>
          <div style="font-weight:700;">טרם נוצרו גיבויים בכספת</div>
          <div style="font-size:0.8rem; margin-top:4px;">גיבויים נוצרים אוטומטית בענן כצילומי מצב לקריאה בלבד.</div>
        </div>
      `;
      return;
    }

    const currentVer = window.APP_VERSION || '113.04';
    const currentSeq = getCurrentSeq();

    el.innerHTML = list.map((item, idx) => {
      const isLatest = (idx === 0);
      const isCurrentVer = item.version === currentVer;
      const c = item.counts || {};
      const schCnt = (c.schedules || 0).toLocaleString();
      const invCnt = (c.invoices || 0).toLocaleString();
      const supCnt = (c.suppliers || 0).toLocaleString();

      return `
        <div style="background:${isLatest ? '#f1f8e9' : '#ffffff'}; border:1px solid ${isLatest ? '#a5d6a7' : '#e0e0e0'}; border-radius:8px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-weight:800; font-size:1rem; color:#1a237e;">v${item.version}</span>
              <span style="background:#e3f2fd; color:#0d47a1; font-size:0.75rem; padding:2px 8px; border-radius:10px; font-weight:700;">רצף #${item.seq || 0}</span>
              ${isLatest ? '<span style="background:#2e7d32; color:#fff; font-size:0.68rem; padding:1px 7px; border-radius:10px; font-weight:700;">צילום מצב אחרון</span>' : ''}
              <span style="font-size:0.75rem; color:#78909c;">🕐 ${item.dateStr}</span>
            </div>
            <div style="font-size:0.78rem; color:#455a64; margin-top:5px; display:flex; gap:14px; flex-wrap:wrap;">
              <span>📋 <b>${schCnt}</b> חוגים</span>
              <span>🛒 <b>${invCnt}</b> חשבוניות</span>
              <span>🏢 <b>${supCnt}</b> ספקים</span>
              ${c.orders ? `<span>📦 <b>${c.orders}</b> הזמנות</span>` : ''}
              ${c.matzava ? `<span>👶 <b>${c.matzava}</b> מצב"ה</span>` : ''}
            </div>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <button class="btn bg bsm" onclick="window.exportVersionBackupToExcel('${item.key}')" title="ייצא גרסה היסטורית זו ישירות לקובץ Excel מלא" style="background:#2e7d32; border-color:#2e7d32; color:#fff; font-weight:700; display:flex; align-items:center; gap:5px; padding:6px 12px; cursor:pointer;">
              <span>📊 ייצוא לאקסל</span>
            </button>
            <button class="btn bo bsm" onclick="window.downloadVersionBackup('${item.key}')" title="הורד קובץ JSON למחשב" style="background:#f8fafc; border:1px solid #cbd5e1; color:#334155; display:flex; align-items:center; gap:4px; padding:6px 10px; cursor:pointer;">
              <span>📥 הורד JSON</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  };

  // Debounced auto-check helper triggered after saves
  window.checkVersionVaultSync = function () {
    if (window._vvCheckTimer) clearTimeout(window._vvCheckTimer);
    window._vvCheckTimer = setTimeout(() => {
      if (window._fbSyncReady && window.SCH && window.SCH.length > 0) {
        window.saveVersionBackup(false);
      }
    }, 12000); // 12 seconds idle after save
  };

  // ── 7. Auto-Launch on Load (Deferred to not interfere with startup) ────
  function startAutoCheck() {
    setTimeout(() => {
      if (window._fbSyncReady && window.SCH && window.SCH.length > 0) {
        window.saveVersionBackup(false);
      } else {
        setTimeout(() => {
          if (window.SCH && window.SCH.length > 0) {
            window.saveVersionBackup(false);
          }
        }, 6000);
      }
    }, 4500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAutoCheck);
  } else {
    startAutoCheck();
  }

})();
