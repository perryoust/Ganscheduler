# GanScheduler — Client-Side Scaling Migration Plan (Phase 2)
## Self-Contained Handoff Document for AI Agents

> [!IMPORTANT]
> **This document is a complete, self-contained implementation guide for Phase 2.** 
> The system must remain **100% FREE** (Firebase Spark plan). Do not use or suggest Firebase Cloud Functions. We will scale by offloading heavy CPU tasks from the main UI thread to **Web Workers**.

---

## 1. Project Context & Goals

### Current Bottlenecks
With the introduction of Lazy Loading (Phase 1), the memory footprint is small on initial load. However, features like **Excel Export** and **Invoice Scanning** require loading ALL invoices. 
Processing thousands of records with `exceljs` or fuzzy-matching strings freezes the browser's Main Thread, making the app unresponsive and triggering "Page Unresponsive" warnings on mobile.

### The Goal
Keep all processing on the client side to avoid server costs, but run heavy tasks in the background using **Web Workers**.

---

## 2. Step-by-Step Implementation

### STEP 1: Implement Excel Export Web Worker
**Goal:** Prevent UI freeze when generating large Excel files.

1. **Create new file: `excel_worker.js`** in the project root.
   - Use `importScripts('https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js')` at the top.
   - Add `onmessage` listener to receive `invoices`, `suppliers`, `dateRange`, and `filename`.
   - Move the entire `exceljs` workbook building logic from `invoices_export.js` into this worker.
   - Instead of downloading, the worker finishes with `const buffer = await workbook.xlsx.writeBuffer(); postMessage({ buffer });`.

2. **Modify `invoices_export.js`**:
   - Change `exportInvoicesToExcel()` to be the orchestrator.
   - It will first call `await window.loadAllInvoices()` to get the data (if not already loaded).
   - Show a loading spinner / toast: `window.showToast?.('מכין קובץ אקסל ברקע... נא להמתין', 30000);`.
   - Initialize the worker: `const worker = new Worker('excel_worker.js');`.
   - Send data: `worker.postMessage({ invoices: window.INVOICES, suppliers: window.supEx, ... });`.
   - On `worker.onmessage`, receive the buffer, create a `Blob`, and trigger the download via `URL.createObjectURL`.

---

### STEP 2: Implement Scanner Engine Web Worker
**Goal:** Prevent UI freeze when fuzzy-matching hundreds of files against thousands of invoices.

1. **Create new file: `scanner_worker.js`** in the project root.
   - Add the string-matching algorithms (`_cleanVal`, `levenshtein`, substring matching) into the worker.
   - The worker receives a list of file names/paths and the full `INVOICES` array.
   - It runs the heavy `O(n*m)` matching loops.
   - It posts progress updates back to the main thread (`postMessage({ type: 'progress', percent: 45 })`).
   - Finally, it returns the mapped `filesFound` array.

2. **Modify `invoices_scanner.js`**:
   - The main thread handles the **File System Access API** (reading the local folders). This *must* remain on the main thread.
   - After building the raw list of files, instead of matching them locally, it spawns `scanner_worker.js`.
   - It passes the raw files and `window.INVOICES` to the worker.
   - It listens for `progress` messages to update the UI progress bar.
   - When finished, it renders the results UI.

---

### STEP 3: Non-Blocking PDF Generation
**Goal:** Prevent browser crash when generating multiple PDFs.

`html2pdf.js` relies heavily on the DOM (Canvas rendering), so it **cannot** be moved to a Web Worker. 
1. **Modify `invoices.js` (PDF printing section)**:
   - If there is a bulk PDF generation feature, or when saving an invoice creates a PDF, ensure it uses `await new Promise(r => setTimeout(r, 50))` between heavy canvas operations to yield control back to the browser's render cycle.
   - This keeps the UI responsive (e.g., loading spinners can still animate) even while the DOM is busy capturing the PDF.

---

### STEP 4: Code Modularization (Phase 2.5)
**Goal:** Reduce `invoices.js` (currently ~1900 lines) for maintainability.

1. **Extract Modals & Forms**:
   - Move all HTML string templates and modal logic (e.g., `openNewInvoice`, `saveInvoice`) into a new file `invoices_ui_modals.js`.
2. **Update `index.html`**:
   - Add the new `<script>` tags for the split files.
   - Ensure the load order is correct (core dependencies first).

---

## 3. Execution Order

```
1. Create `excel_worker.js` and move workbook logic.
2. Refactor `invoices_export.js` to use the worker.
3. Create `scanner_worker.js` and move matching algorithms.
4. Refactor `invoices_scanner.js` to use the worker and add progress UI.
5. Add yielding (`setTimeout`) to PDF generation loops in `invoices.js`.
6. (Optional/If time permits) Extract modal logic from `invoices.js`.
7. Bump version in `index.html`.
8. Deploy: `git add . ; git commit -m "feat: implement web workers" ; firebase deploy --only hosting`
```

---

## 4. Testing Checklist

- [ ] **Excel Export**: Click export, UI should NOT freeze (can scroll/click other tabs), loader shows, file downloads successfully.
- [ ] **Scanner**: Select a folder, UI should NOT freeze, progress updates smoothly, matches are accurate.
- [ ] **PDF Generation**: Saving an invoice or printing should still work perfectly with Hebrew fonts (RTL).
- [ ] **Mobile**: Test export on mobile to ensure memory limits aren't exceeded.

---
**Agent Instruction:** Read this plan and execute the steps sequentially. Focus first on `excel_worker.js` and `invoices_export.js`.
