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

## PDF Generation Architecture (חוק ברזל להפקת PDF)
In any PDF export module using `html2pdf.js` / `html2canvas` (`purchasing_orders.js`, `purchasing_budget.js`, etc.):
1. **Container Styling**: MUST ALWAYS be:
   `container.style.cssText = 'position:absolute; top:-99999px; left:-99999px; width:850px; background:#fff; direction:rtl; font-family:Arial, sans-serif;';`
   - **STRICTLY FORBIDDEN**: NEVER use `position:fixed; left:100vw;` or `top:0; left:100vw;` (in RTL this moves elements past the viewport and slices off 60% of the page!).
2. **html2canvas Options**: MUST ALWAYS be:
   `html2canvas: { scale: 2, useCORS: true, logging: false }`
   - **STRICTLY FORBIDDEN**: NEVER pass `windowWidth: 850` or `scrollX: 0` / `scrollY: 0` into html2canvas.
3. **Scroll Reset**: Always save scroll position, call `window.scrollTo(0, 0)` before rendering, and restore scroll in `cleanup()`.
4. **Bidi / Text Isolation**: All dynamic Hebrew/mixed text MUST pass through `rtlFix(text)` to avoid space swallowing and flipped punctuation.

## MCP & Tool Optimization
1. **Primary MCP Server**: Use `firebase-mcp-server` for all Firebase backend, database, auth, and hosting interactions.
2. **Excluded Services**: Do not attempt to use or invoke Cloud SQL, Compute Engine (GCE), BigQuery data-pipeline, or Jupyter notebook tools, as GanScheduler is a pure Vanilla JS/HTML web client with Firebase.

## Automated Version Data Vault (כספת גיבויי נתונים לפי גרסה)
The workspace implements an automated data checkpoint vault in `version_vault.js`:
1. **Scope**: Full living database snapshot (schedules, suppliers, config, custom gardens, invoices, orders, deliveries) saved to `/version_backups/data/v{VERSION_KEY}.json` and `/version_backups/meta/v{VERSION_KEY}.json` in Firebase RTDB.
2. **Compression**: Uses `window.utils.compressData` (GZIP base64) to maintain 0 cost and stay under 1% of the free Firebase tier.
3. **Execution**: Runs automatically once per version deployment (deferred by 4.5s on startup) and can also be triggered manually via `window.saveVersionBackup(true)`.
4. **Retention Policy (חוק הברזל לשמירת גיבויים)**:
   - Always retain AT LEAST 10 most recent versions.
5. **UI & Export (ארכיון בטוח לקריאה וייצוא בלבד)**: Accessible via clicking the version tag in the header (`app-version-label`) or calling `window.openVersionVaultModal()`. Provides one-click rich Excel export (`window.exportVersionBackupToExcel`) across all sheets (schedules, invoices, matzava, suppliers), JSON downloads, and protects live production data by strictly disabling destructive live overwrites.

## Manager & Field Roles Architecture (תפקידי שטח והנהלה)
1. **Roles Hierarchy**:
   - `admin` (👑 מנהל): Full system control, year settings, users, and data management.
   - `edit` (✏️ עריכה): Standard editing permissions for activities and/or purchasing.
   - `view` (👁️ צפייה בלבד): Full desktop UI in read-only mode (`isReadOnly = true`), saves blocked.
   - `coordinator` (👀 רכז שטח): Isolated field view (`coordinator_app.js`) restricted to specified cities/gardens (`coordCities`, `coordGardenIds`).
   - `manager` / `vp` (👔 סמנכ"ל / הנהלה): **All-Cities field view** (`coordinator_app.js`). Sees every garden, city, pair, and cluster across the whole organization without restriction, with full read-only safety (`window.isReadOnly = true`).
2. **Read-Only Enforcement**:
   - When `isReadOnly` is active (`coordinator`, `manager`, `vp`, `view`):
     - `save()` in `core_data.js` immediately halts.
     - Quick action buttons (ביטול, לא התקיים, הזזה, השלמה) are hidden.
     - New schedule creation and edit popups are blocked.
3. **Managers & Users Unification & Auto-Sync (איחוד וסנכרון מנהלים ומשתמשים)**:
   - Direct integration between `window.managers` (רכזים/מנהלים) and `/users` in Firebase RTDB.
   - **Direct Creation**: Create user logins directly from `#mgrm` modal (`window.mgrCreateNewUserAction`), setting `managerId` and initial `coordGardenIds`.
   - **Account Linking**: Connect existing users (e.g. `Elisheva` <=> `אלישבע`) via `#mgr-link-user-select` (`window.mgrLinkExistingUser`).
   - **Live Two-Way Garden Sync**: When gardens are updated in `#mgrm` and saved, `saveMgr()` immediately PATCHes `/users/${linkedUid}` with updated `coordGardenIds`, `coordCities`, and role.
   - **Dynamic Resolution**: `coordinator_app.js` resolves allowed gardens directly from `window.managers[window.coordManagerId].gardenIds` for zero-lag updates.
   - **Access Revocation**: When deleting a coordinator in `deleteMgr()`, system prompts and revokes/deletes user access from `/users`.