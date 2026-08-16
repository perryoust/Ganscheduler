# Ganscheduler Workspace Rules

## Purchasing Management (ניהול רכש - חשבוניות)
When working on the invoices module (`invoices.js`), adhere to the following business logic for classification:
1. **File Name Priorities**: 
   - If a file name contains the word "חשבונית מס", it MUST be classified as a Tax Invoice (`tax_invoice`), even if it also contains "חשבון עסקה". ("חשבונית מס מנצח").
   - If a file name contains ONLY "חשבון עסקה", it MUST be classified as a Transaction Invoice (`tx_invoice`).
2. **Missing Details**: If an invoice record lacks both Tax Invoice details and Transaction Invoice details, it must be classified as an Order (`order`).
3. **Data Parsing**: When parsing Excel values for `total` or `amt`, explicitly treat "0", "0.0", and "0.00" as empty/invalid to avoid false-positive classifications.
4. **Auto-Refresh Safety**: When running Auto Refresh (or silently merging via Excel import), DO NOT blindly overwrite an existing `status` if it was correctly classified by previous logic, unless the new data strictly proves it has upgraded (e.g., from `tx_invoice` to `tax_invoice`).

## Deployment Workflow
At the conclusion of every development session (once a feature is built or a bug is successfully resolved):
1. Execute `git add .` and `git commit -m "..."` followed by `git push`.
2. Always deploy the web application to Firebase using `firebase deploy --only hosting` (use the **global** firebase from npm, NOT `.\node_modules\.bin\firebase.cmd`).
3. Do not forget to bump the version number in `index.html` before deploying.

## Tool Usage and Minimizing Prompts
To minimize disruptive 'Allow Command' prompts for the user:
1. NEVER use 'run_command' with Node/Python scripts just to edit files. Always use native 'replace_file_content' or 'multi_replace_file_content'. This applies especially to version bumps in index.html - use multi_replace_file_content to update the 3 version references (title tag, stylesheet query string, and APP_VERSION variable) directly.
2. Chain terminal commands logically if they must be run (e.g., 'git add . ; git commit -m ... ; git push' in a single run_command).
3. NEVER run node -e for any file manipulation. The ONLY acceptable uses of run_command are: git operations, firebase deploy, and running actual build/test scripts.

## MCP & Tool Optimization
1. **Primary MCP Server**: Use `firebase-mcp-server` for all Firebase backend, database, auth, and hosting interactions.
2. **Excluded Services**: Do not attempt to use or invoke Cloud SQL, Compute Engine (GCE), BigQuery data-pipeline, or Jupyter notebook tools, as GanScheduler is a pure Vanilla JS/HTML web client with Firebase.