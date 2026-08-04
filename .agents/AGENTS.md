# Ganscheduler Workspace Rules

## Purchasing Management (ניהול רכש - חשבוניות)
When working on the invoices module (`invoices.js`), adhere to the following business logic for classification:
1. **File Name Priorities**: 
   - If a file name contains the word "חשבונית מס", it MUST be classified as a Tax Invoice (`tax_invoice`), even if it also contains "חשבון עסקה". ("חשבונית מס מנצח").
   - If a file name contains ONLY "חשבון עסקה", it MUST be classified as a Transaction Invoice (`tx_invoice`).
2. **Missing Details**: If an invoice record lacks both Tax Invoice details and Transaction Invoice details, it must be classified as an Order (`order`).
3. **Data Parsing**: When parsing Excel values for `total` or `amt` (סכום / סכום כולל מעמ), explicitly treat `"0"`, `"0.0"`, and `"0.00"` as empty/invalid to avoid false-positive classifications.
4. **Auto-Refresh Safety**: When running Auto Refresh (or silently merging via Excel import), DO NOT blindly overwrite an existing `status` if it was correctly classified by previous logic, unless the new data strictly proves it has upgraded (e.g., from `tx_invoice` to `tax_invoice`).

## Deployment Workflow
At the conclusion of every development session (once a feature is built or a bug is successfully resolved):
1. Execute `git add .` and `git commit -m "..."` followed by `git push`.
2. Always deploy the web application to Firebase using `firebase deploy --only hosting`.
Do not forget to bump the version number in `index.html` before deploying.
