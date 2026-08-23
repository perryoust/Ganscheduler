# GanScheduler — Lazy Loading Migration Plan
## Self-Contained Handoff Document for AI Agents

> [!IMPORTANT]
> **This document is a complete, self-contained implementation guide.** Any AI agent reading this should be able to execute the migration without needing additional context. All file paths, line numbers, function signatures, and business rules are documented below.

---

## 1. Project Context

### What is GanScheduler?
A Vanilla JS web application for managing after-school programs (צהרונים), including a **Purchasing & Invoices module** (ניהול רכש). It runs on Firebase Hosting + Firebase Realtime Database (REST API, not SDK).

### The Problem
The app loads **ALL** invoices, orders, and deliveries into memory (`window.INVOICES`, `window.ORDERS`, `window.DELIVERIES`) on startup. As data grows (currently ~500 records, will grow to 5,000–50,000), this will crash the browser.

### The Goal
Migrate to **lazy loading**: load only the last 3 months of invoices by default, with "load more" capability. Scanner and export operations will temporarily load all data when needed.

### Key Constraints
- **No build system** — plain JS files served directly. No npm, no webpack, no React.
- **Firebase REST API** — the app uses `fetch()` with REST URLs, NOT the Firebase JS SDK.
- **Hebrew RTL interface** — all UI text is in Hebrew.
- **Version bumping** — every deploy must bump the version in 3 places in `index.html` (title tag, stylesheet query string, `APP_VERSION` variable). Use `multi_replace_file_content`, NOT `run_command`.
- **Deployment** — always: `git add . ; git commit -m "..." ; firebase deploy --only hosting` (global firebase CLI, NOT `.\node_modules\.bin\firebase.cmd`).

---

## 2. Codebase Map — Files That Need Changes

### 2.1 [firebase.js](file:///c:/Users/Perry/.gemini/antigravity-ide/scratch/Ganscheduler/firebase.js) (867 lines)
**Role:** All Firebase communication — load, save, poll, auth.

| Line(s) | Function | What it does now |
|:---|:---|:---|
| 4 | `FB_ROOT` | Base URL: `https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app` |
| 28 | `getFirebaseInvoicesUrl()` | Returns `${FB_ROOT}/invoices.json` |
| 29 | `getFirebaseOrdersUrl()` | Returns `${FB_ROOT}/orders.json` |
| 30 | `getFirebaseDeliveriesUrl()` | Returns `${FB_ROOT}/deliveries.json` |
| 313-454 | `saveToFirebase()` | Saves everything. Lines 411-421 do `PUT /invoices.json` with **entire** array |
| 456-682 | `loadFromFirebase()` | Loads schedules/suppliers/config. Does NOT load invoices (they're lazy loaded) |
| 728-758 | `_fbStartPolling()` | Polls `meta/seq` every 30s to detect changes |
| **792-865** | **`loadPurchasingDataFromFirebase()`** | **THIS IS THE MAIN TARGET.** Loads ALL invoices/orders/deliveries via `fetch()` |

**Key detail about `loadPurchasingDataFromFirebase()` (lines 806-835):**
```javascript
// Current code — LOADS EVERYTHING:
const invUrl = getFirebaseInvoicesUrl() + '?auth=' + tok + '&cb=' + Date.now();
const [ir, or, dr] = await Promise.all([
  fetch(invUrl).catch(() => ({ ok: false })),
  fetch(ordUrl).catch(() => ({ ok: false })),
  fetch(delUrl).catch(() => ({ ok: false }))
]);
if (ir.ok) {
  let cloudInvs = await ir.json();
  // ... merge logic ...
  window.INVOICES = cloudInvs;  // ← ALL INVOICES IN MEMORY
}
```

---

### 2.2 [invoices.js](file:///c:/Users/Perry/.gemini/antigravity-ide/scratch/Ganscheduler/invoices.js) (1,897 lines)
**Role:** Invoices UI — rendering, editing, saving, deleting.

| Line(s) | Function | What it does now |
|:---|:---|:---|
| 6-8 | Module vars | `_appMode`, `_purchTab`, `PURCH_TABS` |
| 20-30 | `switchMode('purch')` | Calls `loadPurchasingDataFromFirebase()` when entering purch mode |
| 82-103 | `SPT(t)` | Switches purch tabs. Calls `renderInvoices()` on 'pinvoices' tab |
| 248-390 | `renderInvoices()` | Renders the invoices table. Line 264: `let list = [...INVOICES]` — reads from global array. Line 387: `MAX_RENDER = 150` — already caps display |
| 509-610 | `refreshPurchDash()` | Dashboard summary. Line 510: `const invs = INVOICES` — reads ALL |
| 612-613 | `window.INVOICES = []` | Global array initialization |
| 1083-1087 | `deleteInvoiceFromModal()` | Deletes, calls `window.save(true)` |
| 1100 | `openNewInvoice(id)` | Opens edit modal. Line 1100: finds inv by `INVOICES.find(i=>i.id===id)` |
| **1457-1585** | **`saveInvoice()`** | Saves invoice. Line 1560-1564: updates `INVOICES` array. Line 1580: calls `window.save()` which triggers full `saveToFirebase()` |
| **1621-1624** | **`deleteInvoice(id)`** | Line 1623: `INVOICES = INVOICES.filter(...)`. Line 1624: `window.save(true)` |

---

### 2.3 [invoices_scanner.js](file:///c:/Users/Perry/.gemini/antigravity-ide/scratch/Ganscheduler/invoices_scanner.js) (848 lines)
**Role:** Scans OneDrive folders and matches files to invoices.

| Line(s) | Key detail |
|:---|:---|
| 202 | `window._runCoreScanner = async function(selectedFolders)` |
| ~270-405 | Main matching loop — iterates over `window.INVOICES` for each file |
| ~431-500 | Fallback matching — also iterates `window.INVOICES` |

**The scanner MUST have ALL invoices loaded.** It cannot work with partial data.

---

### 2.4 [invoices_export.js](file:///c:/Users/Perry/.gemini/antigravity-ide/scratch/Ganscheduler/invoices_export.js) (42,868 bytes)
**Role:** Excel export of invoices.

**Must have ALL invoices loaded for complete export.**

---

### 2.5 [core_data.js](file:///c:/Users/Perry/.gemini/antigravity-ide/scratch/Ganscheduler/core_data.js) (987 lines)
**Role:** Applies loaded data to global variables.

| Line(s) | What it does |
|:---|:---|
| 390-495 | `_applyYearData()` block for invoices — deduplication, auto-cancel, VAT migration |
| 687 | Saves INVOICES to localStorage |
| 923-924 | Builds supplier list from INVOICES |

---

### 2.6 [core_dash.js](file:///c:/Users/Perry/.gemini/antigravity-ide/scratch/Ganscheduler/core_dash.js) (113,320 bytes)
**Role:** Main dashboard. Uses INVOICES for supplier cards and stats.

| Line(s) | What it does |
|:---|:---|
| 138-142 | Dashboard counters — `window.INVOICES.length`, filter by status |
| 518, 603, 834, 894 | Supplier card views — filter INVOICES by supplier name |

---

### 2.7 [database.rules.json](file:///c:/Users/Perry/.gemini/antigravity-ide/scratch/Ganscheduler/database.rules.json) (66 lines)
**Role:** Firebase security rules. Currently has NO indexes on invoices.

---

## 3. Firebase Data Structure

Invoices are stored as a **flat array** at `/invoices` in Firebase RTDB:
```
/invoices/0: { id: 1724001234567, supName: "גיא ברוך", orderNum: "0120082026", status: "order", actMonth: "אוגוסט 2026", ... }
/invoices/1: { id: 1724001234568, supName: "קרביץ", orderNum: "0220082026", ... }
...
```

> [!WARNING]
> **CRITICAL:** Invoices are stored as an **array** (indices 0, 1, 2...), NOT as keyed objects. This means Firebase REST queries like `orderBy` and `equalTo` work on **child properties**, but the keys are numeric indices. To support per-record saves, we need to **migrate to keyed objects** where the key is the invoice `id`.

---

## 4. Step-by-Step Implementation

### STEP 1: Migrate Firebase data structure from array to keyed object
**File:** [firebase.js](file:///c:/Users/Perry/.gemini/antigravity-ide/scratch/Ganscheduler/firebase.js)
**Why:** Arrays in Firebase don't support per-record updates. We need `/invoices/{id}` instead of `/invoices/0`.

**Add a one-time migration function** (can be placed after `loadPurchasingDataFromFirebase`, around line 865):

```javascript
// One-time migration: convert /invoices from array to keyed object
window._migrateInvoicesToKeyed = async function() {
  const tok = await window._fbUser?.getIdToken(false);
  if (!tok) return;
  const url = getFirebaseInvoicesUrl() + '?auth=' + tok + '&cb=' + Date.now();
  const r = await fetch(url);
  if (!r.ok) return;
  const data = await r.json();
  if (!data) return;
  
  // Check if already keyed (first key is NOT a number)
  const keys = Object.keys(data);
  if (keys.length > 0 && isNaN(keys[0])) {
    console.log('[Migration] Invoices already keyed. Skipping.');
    return;
  }
  
  // Convert array to keyed object
  const keyed = {};
  const arr = Array.isArray(data) ? data : Object.values(data);
  arr.forEach(inv => {
    if (inv && inv.id) keyed[inv.id] = inv;
  });
  
  // Write back as keyed object
  const putUrl = getFirebaseInvoicesUrl() + '?auth=' + tok;
  const resp = await fetch(putUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(keyed)
  });
  
  if (resp.ok) {
    console.log('[Migration] ✅ Invoices migrated to keyed format:', Object.keys(keyed).length, 'records');
  } else {
    console.error('[Migration] ❌ Failed to migrate invoices');
  }
};
```

**Trigger:** Call `window._migrateInvoicesToKeyed()` once inside `loadPurchasingDataFromFirebase()` after the first successful load. Add a flag `window._invoicesMigrated` to prevent re-running.

---

### STEP 2: Add per-record save/delete functions
**File:** [firebase.js](file:///c:/Users/Perry/.gemini/antigravity-ide/scratch/Ganscheduler/firebase.js)
**Where:** After the existing `loadPurchasingDataFromFirebase` function (after line 865)

```javascript
// Save a single invoice to Firebase (keyed by id)
window.saveInvoiceToFirebase = async function(inv) {
  if (!inv || !inv.id) return false;
  const tok = await window._fbUser?.getIdToken(false);
  if (!tok) return false;
  const url = `${FB_ROOT}/invoices/${inv.id}.json?auth=${tok}`;
  try {
    const r = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inv)
    });
    if (r.ok) console.log('[Sync] Invoice saved:', inv.id);
    return r.ok;
  } catch (e) {
    console.error('[Sync] Failed to save invoice:', e);
    return false;
  }
};

// Delete a single invoice from Firebase
window.deleteInvoiceFromFirebase = async function(invId) {
  const tok = await window._fbUser?.getIdToken(false);
  if (!tok) return false;
  const url = `${FB_ROOT}/invoices/${invId}.json?auth=${tok}`;
  try {
    const r = await fetch(url, { method: 'DELETE' });
    return r.ok;
  } catch (e) {
    console.error('[Sync] Failed to delete invoice:', e);
    return false;
  }
};

// Load recent invoices (last N by key, which is the id/timestamp)
window.loadRecentInvoices = async function(limit = 150) {
  const tok = await window._fbUser?.getIdToken(false);
  if (!tok) return [];
  const url = `${FB_ROOT}/invoices.json?auth=${tok}&orderBy="$key"&limitToLast=${limit}&cb=${Date.now()}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    return data ? Object.values(data) : [];
  } catch (e) {
    console.error('[Sync] Failed to load recent invoices:', e);
    return [];
  }
};

// Load ALL invoices (for scanner/export only)
window.loadAllInvoices = async function() {
  const tok = await window._fbUser?.getIdToken(false);
  if (!tok) return [];
  const url = getFirebaseInvoicesUrl() + '?auth=' + tok + '&cb=' + Date.now();
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    return data ? Object.values(data) : [];
  } catch (e) {
    console.error('[Sync] Failed to load all invoices:', e);
    return [];
  }
};
```

---

### STEP 3: Modify `loadPurchasingDataFromFirebase()` to load recent only
**File:** [firebase.js](file:///c:/Users/Perry/.gemini/antigravity-ide/scratch/Ganscheduler/firebase.js)
**Lines:** 806-835

**Current code (loads ALL):**
```javascript
const invUrl = getFirebaseInvoicesUrl() + '?auth=' + tok + '&cb=' + Date.now();
```

**Change to (load last 150):**
```javascript
const invUrl = `${FB_ROOT}/invoices.json?auth=${tok}&orderBy="$key"&limitToLast=150&cb=${Date.now()}`;
```

Also, add the migration call **once** after the first successful load (inside the `if (ir.ok)` block, around line 836):
```javascript
// One-time migration to keyed format
if (!window._invoicesMigrated) {
  window._invoicesMigrated = true;
  window._migrateInvoicesToKeyed?.();
}
```

**Also:** add a global tracking variable:
```javascript
window._invoicesPartialLoad = true; // flag that we only loaded recent, not all
```

---

### STEP 4: Modify `saveInvoice()` — save single record instead of full array
**File:** [invoices.js](file:///c:/Users/Perry/.gemini/antigravity-ide/scratch/Ganscheduler/invoices.js)
**Lines:** 1560-1580

**Current code:**
```javascript
if(_editInvId){
  const idx=window.INVOICES.findIndex(i=>i.id===_editInvId);
  if(idx>=0) window.INVOICES[idx]=inv;
} else {
  window.INVOICES.push(inv);
}
// ...
window.save();  // ← THIS saves EVERYTHING to Firebase
```

**Change to:**
```javascript
if(_editInvId){
  const idx=window.INVOICES.findIndex(i=>i.id===_editInvId);
  if(idx>=0) window.INVOICES[idx]=inv;
} else {
  window.INVOICES.push(inv);
}
// ...
// Save invoice individually to Firebase (not the full array)
window.saveInvoiceToFirebase(inv);
// Still save suppliers/config via the main save (but skip invoices)
window.save();
```

> [!WARNING]
> **`window.save()` must STOP saving the full INVOICES array.** Modify `saveToFirebase()` in firebase.js lines 411-421: wrap the INVOICES PUT in a condition `if (!window._invoicesKeyedMode)` so it's skipped when we're in the new mode. Set `window._invoicesKeyedMode = true` after migration.

---

### STEP 5: Modify `deleteInvoice()` — delete single record
**File:** [invoices.js](file:///c:/Users/Perry/.gemini/antigravity-ide/scratch/Ganscheduler/invoices.js)
**Lines:** 1621-1624

**Current code:**
```javascript
async function deleteInvoice(id){
  if(!await window.spConfirm('למחוק חשבונית זו?')) return;
  window.INVOICES=window.INVOICES.filter(i=>i.id!==id);
  window.save(true); renderInvoices(); refreshPurchDash();
}
```

**Change to:**
```javascript
async function deleteInvoice(id){
  if(!await window.spConfirm('למחוק חשבונית זו?')) return;
  window.INVOICES=window.INVOICES.filter(i=>i.id!==id);
  window.deleteInvoiceFromFirebase(id);  // Delete just this record
  window.save(true);  // Save config/suppliers (invoices skip handled by flag)
  renderInvoices(); refreshPurchDash();
}
```

Also update `deleteInvoiceFromModal()` at line 1083-1087 in the same way.

---

### STEP 6: Add "Load More" button to invoices table
**File:** [invoices.js](file:///c:/Users/Perry/.gemini/antigravity-ide/scratch/Ganscheduler/invoices.js)
**Where:** After `renderInvoices()` function (around line 507)

Add a new function:
```javascript
window.loadMoreInvoices = async function() {
  if (window.showToast) window.showToast('טוען חשבוניות נוספות...');
  const all = await window.loadAllInvoices();
  if (all && all.length > 0) {
    window.INVOICES = all;
    window._invoicesPartialLoad = false;
    renderInvoices();
    refreshPurchDash();
    if (window.showToast) window.showToast(`נטענו ${all.length} חשבוניות`);
  }
};
```

**Also:** Modify the `renderInvoices()` function (around line 390, after the `cappedMsg` line) to add a "Load All" button when in partial mode:

```javascript
// After line 390 (the cappedMsg):
const loadAllMsg = window._invoicesPartialLoad 
  ? `<div style="text-align:center;padding:12px">
       <button class="btn bo" onclick="loadMoreInvoices()" style="font-size:0.8rem;padding:6px 18px">
         📥 טען את כל החשבוניות (${INVOICES.length} נטענו מתוך הכל)
       </button>
     </div>` 
  : '';
```

Then append `loadAllMsg` to the table output (after `cappedMsg`).

---

### STEP 7: Update the Scanner to load all before scanning
**File:** [invoices_scanner.js](file:///c:/Users/Perry/.gemini/antigravity-ide/scratch/Ganscheduler/invoices_scanner.js)
**Line:** ~202 (beginning of `_runCoreScanner`)

**Add at the start of the function:**
```javascript
// Ensure all invoices are loaded for scanning
if (window._invoicesPartialLoad && window.loadAllInvoices) {
  window.showToast?.('טוען את כל החשבוניות לצורך סריקה...');
  const all = await window.loadAllInvoices();
  if (all && all.length > 0) {
    window.INVOICES = all;
    window._invoicesPartialLoad = false;
  }
}
```

---

### STEP 8: Update `saveToFirebase()` to skip full INVOICES save in keyed mode
**File:** [firebase.js](file:///c:/Users/Perry/.gemini/antigravity-ide/scratch/Ganscheduler/firebase.js)
**Lines:** 411-421

**Current code:**
```javascript
// Save Invoices Separately
if (Array.isArray(window.INVOICES) && window.INVOICES.length > 0) {
  const invUrl = getFirebaseInvoicesUrl() + authQ;
  const invResp = await fetch(invUrl, { method: 'PUT', ... });
  ...
}
```

**Change to:**
```javascript
// Save Invoices — skip if using per-record keyed mode (saves happen individually)
if (!window._invoicesKeyedMode && Array.isArray(window.INVOICES) && window.INVOICES.length > 0) {
  const invUrl = getFirebaseInvoicesUrl() + authQ;
  const invResp = await fetch(invUrl, { method: 'PUT', ... });
  ...
}
```

---

### STEP 9: Add Firebase indexes
**File:** [database.rules.json](file:///c:/Users/Perry/.gemini/antigravity-ide/scratch/Ganscheduler/database.rules.json)
**Lines:** 13-16

**Current:**
```json
"invoices": {
  ".read": "...",
  ".write": "..."
}
```

**Change to:**
```json
"invoices": {
  ".read": "...",
  ".write": "...",
  ".indexOn": ["actMonth", "supName", "status"]
}
```

> [!NOTE]
> Deploy rules with: `firebase deploy --only database` (in addition to hosting).

---

### STEP 10: Update dashboard to work with partial data
**File:** [invoices.js](file:///c:/Users/Perry/.gemini/antigravity-ide/scratch/Ganscheduler/invoices.js), function `refreshPurchDash()` (line 509)

**Add a note** to the dashboard when in partial mode:
```javascript
function refreshPurchDash(){
  const invs = INVOICES;
  // Show partial-load indicator
  const partialEl = document.getElementById('ps-partial-note');
  if (partialEl) {
    partialEl.style.display = window._invoicesPartialLoad ? 'block' : 'none';
    partialEl.innerHTML = window._invoicesPartialLoad 
      ? `<span style="font-size:.7rem;color:#e65100">⚠️ מציג ${invs.length} חשבוניות אחרונות בלבד. <a href="#" onclick="loadMoreInvoices();return false" style="color:#1565c0">טען הכל</a></span>` 
      : '';
  }
  // ... rest of function unchanged ...
```

**Also add** a `<div id="ps-partial-note"></div>` element in the dashboard HTML section of [index.html](file:///c:/Users/Perry/.gemini/antigravity-ide/scratch/Ganscheduler/index.html) — find the `pdash` panel and add the div near the top of its content.

---

## 5. Execution Order

```
1. database.rules.json  — Add indexes (STEP 9)
2. firebase.js           — Add migration function (STEP 1)
3. firebase.js           — Add per-record save/delete/load functions (STEP 2)
4. firebase.js           — Modify loadPurchasingDataFromFirebase (STEP 3)
5. firebase.js           — Modify saveToFirebase to skip full INVOICES (STEP 8)
6. invoices.js           — Modify saveInvoice() (STEP 4)
7. invoices.js           — Modify deleteInvoice() (STEP 5)
8. invoices.js           — Add loadMoreInvoices + UI button (STEP 6)
9. invoices.js           — Add partial-load dashboard note (STEP 10)
10. invoices_scanner.js  — Add loadAll before scan (STEP 7)
11. index.html           — Add partial-note div + bump version
12. Deploy: git add . ; git commit ; firebase deploy --only hosting,database
```

---

## 6. Testing Checklist

After deployment, verify each of these:

- [ ] **Enter purch mode** — invoices load quickly (only last 150)
- [ ] **Dashboard shows correct counts** for loaded invoices + partial note
- [ ] **Click "Load All"** — all invoices appear, partial note disappears
- [ ] **Edit an invoice and save** — changes persist after page refresh
- [ ] **Create new invoice** — appears in list, persists after refresh
- [ ] **Delete an invoice** — disappears, doesn't come back after refresh
- [ ] **Run scanner** — loads all invoices automatically, matches correctly
- [ ] **Export to Excel** — exports all invoices (loads them first if needed)
- [ ] **Dashboard supplier cards** — show invoice counts correctly
- [ ] **Duplicate check on save** — still warns about duplicate order numbers

---

## 7. Rollback Strategy

If anything breaks:
1. `git revert HEAD` — reverts all code changes
2. `firebase deploy --only hosting` — deploys the reverted code
3. The data in Firebase remains intact — the migration to keyed format is backward-compatible (Object.values() works the same on both arrays and keyed objects)

---

## 8. Business Rules (MUST preserve)

1. **Invoice classification by filename** (AGENTS.md rule): "חשבונית מס" in filename → `tax_invoice` status. "חשבון עסקה" → `tx_invoice`.
2. **Scanner scoring algorithm** must not change — only the data loading mechanism changes.
3. **`window.save()`** must still save suppliers, config, schedules as before. Only the INVOICES part changes.
4. **localStorage fallback** (`ganv5_invoices` key in core_data.js line 687) should still work for offline mode.
5. **Polling** (firebase.js line 728-758) should trigger a reload of the recent invoices when seq changes, not a full reload.
