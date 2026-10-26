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
          deliveries: del.length
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

  // ── 4. Restore from Checkpoint ─────────────────────────────────
  window.restoreVersionBackup = async function (vKey) {
    if (!vKey) return;
    const authQ = await getAuthHeader();

    try {
      const metaUrl = `${VAULT_ROOT}/meta/${vKey}.json${authQ}`;
      const mr = await fetch(metaUrl);
      const meta = mr.ok ? await mr.json() : null;
      const verLabel = meta?.version || vKey;
      const seqLabel = meta?.seq ? ` (רצף #${meta.seq})` : '';
      const dateLabel = meta?.dateStr || '';

      const confirmed = confirm(
        `⚠️ שחזור נתוני מערכת מגרסה ${verLabel}${seqLabel}\nתאריך: ${dateLabel}\n\n` +
        `פעולה זו תחליף את כל נתוני המערכת הנוכחיים (חוגים, ספקים, חשבוניות והזמנות) ` +
        `בנתונים שהיו קיימים בדיוק בנקודת זמן זו!\n\nהאם אתה בטוח שברצונך להמשיך בשחזור?`
      );
      if (!confirmed) return;

      if (window.showToast) window.showToast('⏳ מושך נתוני גיבוי ופורס אותם...');

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

      if (!fullData || !Array.isArray(fullData.schedules)) {
        throw new Error('קובץ הגיבוי פגום או חסר נתוני שיבוצים תקינים');
      }

      // Apply to live memory
      window.SCH = fullData.schedules || [];
      if (fullData.suppliers) window.supEx = fullData.suppliers;
      if (Array.isArray(fullData.customGardens)) window._GARDENS_EXTRA = fullData.customGardens;
      if (Array.isArray(fullData.invoices)) window.INVOICES = fullData.invoices;
      if (Array.isArray(fullData.orders)) window.ORDERS = fullData.orders;
      if (Array.isArray(fullData.deliveries)) window.DELIVERIES = fullData.deliveries;

      if (fullData.config) {
        if (fullData.config.pairs) window.pairs = fullData.config.pairs;
        if (fullData.config.clusters) window.clusters = fullData.config.clusters;
        if (fullData.config.holidays) window.holidays = fullData.config.holidays;
        if (fullData.config.pairBreaks) window.pairBreaks = fullData.config.pairBreaks;
        if (fullData.config.managers) window.managers = fullData.config.managers;
        if (fullData.config.blockedDates) window.blockedDates = fullData.config.blockedDates;
        if (fullData.config.gardenBlocks) window.gardenBlocks = fullData.config.gardenBlocks;
        if (fullData.config.schoolBudgets) window.schoolBudgets = fullData.config.schoolBudgets;
      }

      // Save to Firebase (Force save so live state updates immediately)
      if (window.saveToFirebase) await window.saveToFirebase(false, true);
      if (window.saveOrdersToFirebase) await window.saveOrdersToFirebase();
      if (window.saveDeliveriesToFirebase) await window.saveDeliveriesToFirebase();

      if (window.showToast) {
        window.showToast(`✅ שוחזר בהצלחה לגרסה ${verLabel}${seqLabel}! המערכת מתרעננת...`);
      }

      setTimeout(() => {
        if (typeof window.refresh === 'function') window.refresh();
        else location.reload();
      }, 1200);

    } catch (e) {
      console.error('[VersionVault] Restore failed:', e);
      alert('❌ שגיאה בשחזור: ' + e.message);
    }
  };

  // ── 5. Download Checkpoint JSON ───────────────────────────────
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

  // ── 6. UI Modal ──────────────────────────────────────────────
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
                <h3 style="margin:0; color:#1a237e; font-size:1.2rem; font-weight:800;">כספת גיבויי נתונים לפי גרסה ורצף שינויים</h3>
                <div style="font-size:0.75rem; color:#607d8b;">גיבוי אוטומטי מלא בענן המזהה שינויים בנתונים (מונה שינויים) גם באותה גרסה</div>
              </div>
            </div>
            <button onclick="document.getElementById('version-vault-modal').classList.remove('open')" style="background:none; border:none; font-size:1.4rem; cursor:pointer; color:#78909c;">✕</button>
          </div>

          <div style="background:#e8eaf6; border-radius:8px; padding:10px 14px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <div style="font-size:0.82rem; font-weight:700; color:#283593; display:flex; align-items:center; gap:8px;">
                <span>גרסה נוכחית: <b style="background:#1a237e; color:#fff; padding:2px 8px; border-radius:12px; font-size:0.75rem;">v${window.APP_VERSION || '113.04'}</b></span>
                <span>מונה שינויים: <b style="background:#0288d1; color:#fff; padding:2px 8px; border-radius:12px; font-size:0.75rem;" id="vv-current-seq">#${getCurrentSeq()}</b></span>
              </div>
              <div style="font-size:0.72rem; color:#5c6bc0; margin-top:3px;">שומר לפחות 10 נקודות אחרונות, ומעולם לא מוחק גיבוי מפחות מ-10 ימים.</div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn bg bsm" onclick="window.saveVersionBackup(true).then(()=>window.renderVersionVaultList())" style="background:#2e7d32; border-color:#2e7d32; color:#fff; font-weight:700;">💾 גבה עכשיו ידנית</button>
              <button class="btn bo bsm" onclick="window.renderVersionVaultList()">🔄 רענן</button>
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
          <div style="font-size:0.8rem; margin-top:4px;">הגיבוי הראשון ייווצר אוטומטית בעת שינויים או בלחיצה על 'גבה עכשיו ידנית'.</div>
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
              ${isLatest ? '<span style="background:#2e7d32; color:#fff; font-size:0.68rem; padding:1px 7px; border-radius:10px; font-weight:700;">הגיבוי האחרון</span>' : ''}
              <span style="font-size:0.75rem; color:#78909c;">🕐 ${item.dateStr}</span>
            </div>
            <div style="font-size:0.78rem; color:#455a64; margin-top:5px; display:flex; gap:14px; flex-wrap:wrap;">
              <span>📋 <b>${schCnt}</b> חוגים</span>
              <span>🛒 <b>${invCnt}</b> חשבוניות</span>
              <span>🏢 <b>${supCnt}</b> ספקים</span>
              ${c.orders ? `<span>📦 <b>${c.orders}</b> הזמנות</span>` : ''}
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn bo bsm" onclick="window.downloadVersionBackup('${item.key}')" title="הורד קובץ JSON למחשב" style="display:flex; align-items:center; gap:4px;">
              <span>📥 הורד</span>
            </button>
            <button class="btn bp bsm" onclick="window.restoreVersionBackup('${item.key}')" title="שחזר את כל הנתונים מנקודה זו" style="background:#1a237e; border-color:#1a237e; display:flex; align-items:center; gap:4px;">
              <span>🔄 שחזר</span>
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
