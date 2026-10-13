// ══════════════════════════════════════════════════════════════════════════
// GanScheduler Version Vault — Automated Versioned Data Checkpoints
// ══════════════════════════════════════════════════════════════════════════
// • Backs up FULL living data: schedules, suppliers, config, invoices, orders, deliveries.
// • Compresses using GZIP Base64 (zero cost, lightweight, under 1% of Firebase free tier).
// • Completely isolated in /version_backups (zero impact on ongoing sync).
// • Retention rule: Keeps at least 10 latest versions, and NEVER deletes any backup < 10 days old.
// • One-click Restore & Download JSON.

(function () {
  'use strict';

  const VAULT_ROOT = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/version_backups';

  function getVersionKey(ver) {
    const raw = String(ver || window.APP_VERSION || 'unknown').trim();
    return 'v' + raw.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  async function getAuthHeader() {
    let tok = null;
    if (window._fbUser) {
      try { tok = await window._fbUser.getIdToken(false); } catch (e) { }
    }
    return tok ? '?auth=' + tok : '';
  }

  // ── 1. Create a Full Version Snapshot ────────────────────────
  window.saveVersionBackup = async function (isManual = false) {
    const ver = window.APP_VERSION || '113.04';
    const vKey = getVersionKey(ver);

    console.log(`[VersionVault] Starting backup check for ${vKey} (manual=${isManual})...`);

    try {
      const authQ = await getAuthHeader();

      // Check if this version already exists (unless manual force)
      if (!isManual) {
        try {
          const checkUrl = `${VAULT_ROOT}/meta/${vKey}.json${authQ}`;
          const cr = await fetch(checkUrl);
          if (cr.ok) {
            const existingMeta = await cr.json();
            if (existingMeta && existingMeta.ts) {
              console.log(`[VersionVault] Version ${vKey} already backed up on ${new Date(existingMeta.ts).toLocaleString('he-IL')}. Skipping.`);
              return false;
            }
          }
        } catch (ce) {
          console.warn('[VersionVault] Meta check warning:', ce.message);
        }
      }

      // Ensure data is available
      const sch = Array.isArray(window.SCH) ? window.SCH : [];
      const sup = window.supEx || {};
      const inv = Array.isArray(window.INVOICES) ? window.INVOICES : [];
      const ord = Array.isArray(window.ORDERS) ? window.ORDERS : [];
      const del = Array.isArray(window.DELIVERIES) ? window.DELIVERIES : [];

      if (sch.length === 0 && !isManual) {
        console.warn('[VersionVault] Schedules not yet loaded in memory. Deferring backup.');
        return false;
      }

      const backupPayload = {
        version: ver,
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
          todos: window.todo ? window.todo.items : []
        }
      };

      const metaInfo = {
        version: ver,
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

      console.log(`[VersionVault] ✅ Version backup ${vKey} saved successfully (${sch.length} sch, ${inv.length} inv).`);
      if (window.showToast) {
        window.showToast(`✅ נוצר גיבוי נתונים מלא לגרסה ${ver} (${sch.length} שיבוצים, ${inv.length} חשבוניות)`);
      }

      // Auto-prune according to retention rule
      pruneOldVersionBackups(authQ);
      return true;

    } catch (err) {
      console.error('[VersionVault] Failed to save version backup:', err);
      if (isManual && window.showToast) window.showToast('❌ שגיאה בשמירת גיבוי: ' + err.message);
      return false;
    }
  };

  // ── 2. Retention Policy: >= 10 versions, and NEVER delete < 10 days old ─
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
        version: v.version || k
      }));

      // Sort descending (newest first)
      items.sort((a, b) => b.ts - a.ts);

      const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - TEN_DAYS_MS;

      // Retention rule:
      // The 10 most recent versions are ALWAYS kept.
      // For items at index >= 10: only delete if created over 10 days ago!
      const toDelete = items.slice(10).filter(item => item.ts < cutoff);

      for (const item of toDelete) {
        console.log(`[VersionVault] 🗑️ Pruning old version backup beyond 10 versions & 10 days: ${item.key}`);
        await fetch(`${VAULT_ROOT}/data/${item.key}.json${authQ}`, { method: 'DELETE' });
        await fetch(`${VAULT_ROOT}/meta/${item.key}.json${authQ}`, { method: 'DELETE' });
      }
    } catch (e) {
      console.warn('[VersionVault] Pruning check error:', e);
    }
  }

  // ── 3. List All Backups ───────────────────────────────────────
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
        ts: m.ts || 0,
        dateStr: m.dateStr || (m.ts ? new Date(m.ts).toLocaleString('he-IL') : '—'),
        counts: m.counts || { schedules: 0, invoices: 0, suppliers: 0 }
      }));

      list.sort((a, b) => b.ts - a.ts);
      return list;
    } catch (e) {
      console.error('[VersionVault] Failed to load list:', e);
      return [];
    }
  };

  // ── 4. Restore from Backup ───────────────────────────────────
  window.restoreVersionBackup = async function (vKey) {
    if (!vKey) return;
    const authQ = await getAuthHeader();

    try {
      // First fetch meta to know what we are restoring
      const metaUrl = `${VAULT_ROOT}/meta/${vKey}.json${authQ}`;
      const mr = await fetch(metaUrl);
      const meta = mr.ok ? await mr.json() : null;
      const verLabel = meta?.version || vKey;
      const dateLabel = meta?.dateStr || '';

      const confirmed = confirm(
        `⚠️ שחזור נתוני מערכת מגרסה ${verLabel}\nתאריך: ${dateLabel}\n\n` +
        `פעולה זו תחליף את כל נתוני המערכת הנוכחיים (חוגים, ספקים, חשבוניות והזמנות) ` +
        `בנתונים שהיו קיימים בדיוק בגרסה זו!\n\nהאם אתה בטוח שברצונך להמשיך בשחזור?`
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
      }

      // Save to Firebase (Force save so live state updates immediately)
      if (window.saveToFirebase) await window.saveToFirebase(false, true);
      if (window.saveOrdersToFirebase) await window.saveOrdersToFirebase();
      if (window.saveDeliveriesToFirebase) await window.saveDeliveriesToFirebase();

      if (window.showToast) {
        window.showToast(`✅ שוחזר בהצלחה לגרסה ${verLabel}! המערכת מתרעננת...`);
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

  // ── 5. Download Backup JSON ──────────────────────────────────
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
      a.download = `GanScheduler_DataBackup_${vKey}_${new Date().toISOString().slice(0, 10)}.json`;
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
        <div class="mb" style="max-width:750px; width:95%; max-height:85vh; display:flex; flex-direction:column; padding:20px; border-radius:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #eee; padding-bottom:12px; margin-bottom:15px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.5rem;">📦</span>
              <div>
                <h3 style="margin:0; color:#1a237e; font-size:1.2rem; font-weight:800;">כספת גיבויי נתונים לפי גרסה</h3>
                <div style="font-size:0.75rem; color:#607d8b;">גיבוי אוטומטי מלא של כל החוגים, הספקים והרכש בענן</div>
              </div>
            </div>
            <button onclick="document.getElementById('version-vault-modal').classList.remove('open')" style="background:none; border:none; font-size:1.4rem; cursor:pointer; color:#78909c;">✕</button>
          </div>

          <div style="background:#e8eaf6; border-radius:8px; padding:10px 14px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <div style="font-size:0.82rem; font-weight:700; color:#283593;">גרסת מערכת נוכחית: <span style="background:#1a237e; color:#fff; padding:2px 8px; border-radius:12px; font-size:0.78rem;">v${window.APP_VERSION || '113.04'}</span></div>
              <div style="font-size:0.72rem; color:#5c6bc0;">שומר לפחות 10 גרסאות אחרונות, ולעולם לא מוחק גיבוי מפחות מ-10 ימים.</div>
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
          <div style="font-weight:700;">טרם נוצרו גיבויי גרסה בכספת</div>
          <div style="font-size:0.8rem; margin-top:4px;">הגיבוי הראשון ייווצר אוטומטית או בלחיצה על 'גבה עכשיו ידנית'.</div>
        </div>
      `;
      return;
    }

    const currentVer = window.APP_VERSION || '113.04';

    el.innerHTML = list.map(item => {
      const isCurrent = item.version === currentVer;
      const c = item.counts || {};
      const schCnt = (c.schedules || 0).toLocaleString();
      const invCnt = (c.invoices || 0).toLocaleString();
      const supCnt = (c.suppliers || 0).toLocaleString();

      return `
        <div style="background:${isCurrent ? '#f1f8e9' : '#ffffff'}; border:1px solid ${isCurrent ? '#a5d6a7' : '#e0e0e0'}; border-radius:8px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-weight:800; font-size:1rem; color:#1a237e;">v${item.version}</span>
              ${isCurrent ? '<span style="background:#2e7d32; color:#fff; font-size:0.68rem; padding:1px 7px; border-radius:10px; font-weight:700;">גרסה פעילה</span>' : ''}
              <span style="font-size:0.75rem; color:#78909c;">🕐 ${item.dateStr}</span>
            </div>
            <div style="font-size:0.78rem; color:#455a64; margin-top:4px; display:flex; gap:12px;">
              <span>📋 <b>${schCnt}</b> חוגים</span>
              <span>🛒 <b>${invCnt}</b> חשבוניות</span>
              <span>🏢 <b>${supCnt}</b> ספקים</span>
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn bo bsm" onclick="window.downloadVersionBackup('${item.key}')" title="הורד קובץ JSON למחשב" style="display:flex; align-items:center; gap:4px;">
              <span>📥 הורד</span>
            </button>
            <button class="btn bp bsm" onclick="window.restoreVersionBackup('${item.key}')" title="שחזר את כל הנתונים מגרסה זו" style="background:#1a237e; border-color:#1a237e; display:flex; align-items:center; gap:4px;">
              <span>🔄 שחזר</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  };

  // ── 7. Auto-Launch on Load (Deferred to not interfere with startup) ────
  function startAutoCheck() {
    // Wait 4.5 seconds after load so initial data sync finishes cleanly
    setTimeout(() => {
      if (window._fbSyncReady && window.SCH && window.SCH.length > 0) {
        window.saveVersionBackup(false);
      } else {
        // Retry once in 6 seconds if data is still loading
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
