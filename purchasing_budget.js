// purchasing_budget.js - Budget Ledger Module

window.budgetApp = {
  currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
  
  init() {
    const p = document.getElementById('budget-month-picker');
    if (p && !p.value) p.value = this.currentMonth;
    this.render();
  },

  loadMonth(monthStr) {
    if (!monthStr) return;
    this.currentMonth = monthStr;
    this.render();
  },

  getSchools() {
    const schools = new Set();
    const gAll = window._GARDENS_ALL || window.GARDENS || [];
    gAll.forEach(g => {
      if (g.cls === 'ביה"ס' && g.name) schools.add(g.name.trim());
    });
    
    if (window.schoolBudgets) {
      Object.keys(window.schoolBudgets).forEach(schoolName => {
        if (window.schoolBudgets[schoolName] && window.schoolBudgets[schoolName][this.currentMonth]) {
          schools.add(schoolName.trim());
        }
      });
    }
    return Array.from(schools).sort();
  },

  getSchoolData(schoolName) {
    if (!window.schoolBudgets) window.schoolBudgets = {};
    if (!window.schoolBudgets[schoolName]) window.schoolBudgets[schoolName] = {};
    if (!window.schoolBudgets[schoolName][this.currentMonth]) {
      window.schoolBudgets[schoolName][this.currentMonth] = { budget: 0, expenses: [] };
    }
    // Ensure expenses is array
    if(!Array.isArray(window.schoolBudgets[schoolName][this.currentMonth].expenses)){
      window.schoolBudgets[schoolName][this.currentMonth].expenses = [];
    }
    return window.schoolBudgets[schoolName][this.currentMonth];
  },

  updateBudget(schoolName, val) {
    const num = parseFloat(val) || 0;
    const data = this.getSchoolData(schoolName);
    data.budget = num;
    this.saveToCloud();
    this.render();
  },

  openExpenseModal(schoolName, expId = null) {
    let div = document.getElementById('budget-exp-modal');
    if (!div) {
      div = document.createElement('div');
      div.id = 'budget-exp-modal';
      div.className = 'modal';
      div.innerHTML = `
        <div class="modal-box" style="max-width:400px; padding:0; border-radius:8px; overflow:hidden; background:#fff; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
          <div style="background:#1a237e; color:#fff; padding:12px 15px; display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0; font-size:1.1rem; display:flex; align-items:center; gap:8px;">
              <span>💰</span> <span id="bem-title">רישום הוצאה</span>
            </h3>
            <button onclick="document.getElementById('budget-exp-modal').classList.remove('open')" style="background:none; border:none; color:#fff; cursor:pointer; font-size:1.2rem;">✕</button>
          </div>
          <div style="padding:15px; display:flex; flex-direction:column; gap:12px;">
            <input type="hidden" id="bem-school">
            <input type="hidden" id="bem-id">
            <div>
              <label style="font-size:0.8rem; color:#666; font-weight:600;">תאריך ההוצאה / החשבונית</label>
              <input type="date" id="bem-date" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; font-family:inherit;">
            </div>
            <div>
              <label style="font-size:0.8rem; color:#666; font-weight:600;">שם הספק / תיאור פעילות</label>
              <input type="text" id="bem-sup" placeholder="למשל: יגאל חוגים בע&quot;מ" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; font-family:inherit;">
            </div>
            <div>
              <label style="font-size:0.8rem; color:#666; font-weight:600;">מספר חשבונית (אופציונלי)</label>
              <input type="text" id="bem-inv" placeholder="למשל: 30405" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; font-family:inherit;">
            </div>
            <div>
              <label style="font-size:0.8rem; color:#666; font-weight:600;">סכום כולל מע"מ (₪)</label>
              <input type="number" id="bem-amt" step="0.01" placeholder="למשל: 1500" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; font-family:inherit;">
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:10px;">
              <button class="btn bw" onclick="document.getElementById('budget-exp-modal').classList.remove('open')">ביטול</button>
              <div style="display:flex; gap:10px;">
                <button class="btn bo" id="bem-btn-more" onclick="window.budgetApp.saveExpenseModal(true)">שמור והוסף עוד</button>
                <button class="btn bp" onclick="window.budgetApp.saveExpenseModal(false)">שמור נתונים</button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(div);
    }
    
    // Set default today's date if new
    let dStr = new Date().toISOString().slice(0,10);
    let sVal = '', iVal = '', aVal = '';
    
    document.getElementById('bem-title').innerText = expId ? 'עריכת הוצאה' : 'רישום הוצאה חדשה';
    document.getElementById('bem-school').value = schoolName;
    document.getElementById('bem-id').value = expId || '';
    
    // Hide 'Save & Add Another' if editing
    document.getElementById('bem-btn-more').style.display = expId ? 'none' : 'block';
    
    if (expId) {
      const data = this.getSchoolData(schoolName);
      const exp = data.expenses.find(e => e.id === expId);
      if (exp) {
        // Convert typical DD/MM/YYYY back to YYYY-MM-DD for <input type="date">
        if (exp.date && exp.date.includes('/')) {
          const parts = exp.date.split('/');
          if (parts.length === 3) dStr = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        } else {
          dStr = exp.date || dStr;
        }
        sVal = exp.sup || '';
        iVal = exp.inv || '';
        aVal = exp.amt || '';
      }
    }
    
    document.getElementById('bem-date').value = dStr;
    document.getElementById('bem-sup').value = sVal;
    document.getElementById('bem-inv').value = iVal;
    document.getElementById('bem-amt').value = aVal;
    
    div.classList.add('open');
    setTimeout(() => document.getElementById('bem-sup').focus(), 100);
  },

  saveExpenseModal(keepOpen = false) {
    const schoolName = document.getElementById('bem-school').value;
    const expId = document.getElementById('bem-id').value;
    const dateVal = document.getElementById('bem-date').value;
    const supVal = document.getElementById('bem-sup').value.trim();
    const invVal = document.getElementById('bem-inv').value.trim();
    const amtVal = parseFloat(document.getElementById('bem-amt').value);
    
    if (!supVal) return alert('חובה להזין שם ספק או תיאור');
    if (isNaN(amtVal)) return alert('סכום לא תקין');
    
    // Convert YYYY-MM-DD to DD/MM/YYYY for UI
    let displayDate = dateVal;
    if (dateVal && dateVal.includes('-')) {
      const parts = dateVal.split('-');
      if (parts.length===3) displayDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    
    const data = this.getSchoolData(schoolName);
    
    if (expId) {
      const exp = data.expenses.find(e => e.id === expId);
      if (exp) {
        exp.date = displayDate;
        exp.sup = supVal;
        exp.inv = invVal;
        exp.amt = amtVal;
      }
    } else {
      data.expenses.push({
        id: Date.now().toString(),
        date: displayDate,
        sup: supVal,
        inv: invVal,
        amt: amtVal
      });
    }
    
    this.saveToCloud();
    this.render();
    
    if (keepOpen) {
      // Clear inputs for the next entry
      document.getElementById('bem-sup').value = '';
      document.getElementById('bem-inv').value = '';
      document.getElementById('bem-amt').value = '';
      document.getElementById('bem-sup').focus();
    } else {
      document.getElementById('budget-exp-modal').classList.remove('open');
    }
  },

  deleteExpense(schoolName, expId) {
    const doDelete = () => {
      const data = this.getSchoolData(schoolName);
      if (!data) return;
      data.expenses = data.expenses.filter(e => e.id !== expId);
      this.saveToCloud();
      this.render();
    };

    if (window.askYesNo) {
      window.askYesNo('האם אתה בטוח שברצונך למחוק הוצאה זו?', doDelete);
    } else {
      if(confirm('האם אתה בטוח שברצונך למחוק הוצאה זו?')) doDelete();
    }
  },

  saveToCloud() {
    if(window.saveToFirebase) {
      window.saveToFirebase(true); // silent save
    }
  },

  openCoordinatorModal(schoolName) {
    let div = document.getElementById('budget-coord-modal');
    if (!div) {
      div = document.createElement('div');
      div.id = 'budget-coord-modal';
      div.className = 'modal';
      div.innerHTML = `
        <div class="modal-box" style="max-width:400px; padding:0; border-radius:8px; overflow:hidden; background:#fff; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
          <div style="background:#1a237e; color:#fff; padding:12px 15px; display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0; font-size:1.1rem; display:flex; align-items:center; gap:8px;">
              <span>👤</span> פרטי רכז וחשבון בנק
            </h3>
            <button onclick="document.getElementById('budget-coord-modal').classList.remove('open')" style="background:none; border:none; color:#fff; cursor:pointer; font-size:1.2rem;">✕</button>
          </div>
          <div style="padding:15px; display:flex; flex-direction:column; gap:12px;">
            <input type="hidden" id="bcm-school">
            <div>
              <label style="font-size:0.8rem; color:#666; font-weight:600;">שם הרכז/ת</label>
              <input type="text" id="bcm-name" placeholder="למשל: קרנית רייזל" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; font-family:inherit;">
            </div>
            <div>
              <label style="font-size:0.8rem; color:#666; font-weight:600;">שם הבנק ומספר</label>
              <input type="text" id="bcm-bank" placeholder="למשל: הבינלאומי (31)" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; font-family:inherit;">
            </div>
            <div style="display:flex; gap:10px;">
              <div style="flex:1;">
                <label style="font-size:0.8rem; color:#666; font-weight:600;">מס' סניף</label>
                <input type="text" id="bcm-branch" placeholder="למשל: 124" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; font-family:inherit;">
              </div>
              <div style="flex:2;">
                <label style="font-size:0.8rem; color:#666; font-weight:600;">מס' חשבון</label>
                <input type="text" id="bcm-account" placeholder="למשל: 306881" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; font-family:inherit;">
              </div>
            </div>
            <div>
              <label style="font-size:0.8rem; color:#666; font-weight:600;">שם בעל החשבון</label>
              <input type="text" id="bcm-acc-name" placeholder="למשל: ישראל ישראלי" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; font-family:inherit;">
            </div>
            <div style="font-size:0.75rem; color:#888; background:#f5f5f5; padding:8px; border-radius:4px; margin-top:5px;">
              ℹ️ הפרטים יישמרו אוטומטית גם לחודשים הבאים.
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:10px;">
              <button class="btn bw" onclick="document.getElementById('budget-coord-modal').classList.remove('open')">ביטול</button>
              <button class="btn bp" onclick="window.budgetApp.saveCoordinatorModal()">שמור פרטים</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(div);
    }
    
    document.getElementById('bcm-school').value = schoolName;
    const data = this.getSchoolData(schoolName);
    const coord = data.coordinator || {};
    
    document.getElementById('bcm-name').value = coord.name || '';
    document.getElementById('bcm-bank').value = coord.bankName || '';
    document.getElementById('bcm-branch').value = coord.branch || '';
    document.getElementById('bcm-account').value = coord.account || '';
    document.getElementById('bcm-acc-name').value = coord.accName || '';
    
    div.classList.add('open');
    setTimeout(() => document.getElementById('bcm-name').focus(), 100);
  },

  saveCoordinatorModal() {
    const schoolName = document.getElementById('bcm-school').value;
    const nameVal = document.getElementById('bcm-name').value.trim();
    const bankVal = document.getElementById('bcm-bank').value.trim();
    const branchVal = document.getElementById('bcm-branch').value.trim();
    const accountVal = document.getElementById('bcm-account').value.trim();
    const accNameVal = document.getElementById('bcm-acc-name').value.trim();
    
    const coordData = {
      name: nameVal,
      bankName: bankVal,
      branch: branchVal,
      account: accountVal,
      accName: accNameVal
    };
    
    // Save to current month
    const currentData = this.getSchoolData(schoolName);
    currentData.coordinator = coordData;
    
    // Forward propagation: save to all subsequent months that already exist
    if (window.schoolBudgets && window.schoolBudgets[schoolName]) {
      Object.keys(window.schoolBudgets[schoolName]).forEach(monthStr => {
        if (monthStr > this.currentMonth) {
           window.schoolBudgets[schoolName][monthStr].coordinator = { ...coordData };
        }
      });
    }
    
    this.saveToCloud();
    this.render();
    document.getElementById('budget-coord-modal').classList.remove('open');
  },

  toggleAllExpenses(schoolName, isChecked) {
    const cls = 'exp-chk-' + schoolName.replace(/[^a-zA-Z0-9]/g,'_');
    document.querySelectorAll('.' + cls).forEach(cb => cb.checked = isChecked);
  },

  getSelectedExpenseIds(schoolName) {
    const cls = 'exp-chk-' + schoolName.replace(/[^a-zA-Z0-9]/g,'_');
    const checkboxes = document.querySelectorAll('.' + cls);
    if (!checkboxes || checkboxes.length === 0) return null;
    const selected = [];
    checkboxes.forEach(cb => { if (cb.checked) selected.push(cb.value); });
    return selected;
  },

  render() {
    const container = document.getElementById('pbudget-list');
    if (!container) return;
    const schools = this.getSchools();
    if(schools.length === 0) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#888">לא נמצאו בתי ספר במערכת. יש להגדיר צהרונים מסוג "ביה&quot;ס".</div>';
      return;
    }
    
    let html = '';
    
    schools.forEach(schoolName => {
      const escSchool = schoolName.replace(/'/g, "\\'").replace(/"/g, "&quot;");
      const data = this.getSchoolData(schoolName);
      const totalExpenses = data.expenses.reduce((sum, e) => sum + (Number(e.amt) || 0), 0);
      const remaining = data.budget - totalExpenses;
      
      let pct = 0;
      if (data.budget > 0) pct = Math.min((totalExpenses / data.budget) * 100, 100);
      else if (totalExpenses > 0) pct = 100;
      
      let barColor = '#4caf50'; // Green
      if (pct > 75) barColor = '#ff9800'; // Orange
      if (pct >= 95 || remaining < 0) barColor = '#f44336'; // Red
      
      let expHtml = '';
      if(data.expenses.length > 0) {
        const clsName = 'exp-chk-' + schoolName.replace(/[^a-zA-Z0-9]/g,'_');
        expHtml += `<table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.8rem; background:#fff; border-radius:4px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1)">
          <thead>
            <tr style="background:#e8eaf6; color:#1a237e; text-align:right;">
              <th style="padding:6px;border-bottom:1px solid #ccc;width:30px;text-align:center">
                <input type="checkbox" checked onchange="window.budgetApp.toggleAllExpenses('${escSchool}', this.checked)" style="cursor:pointer;accent-color:#1a237e;">
              </th>
              <th style="padding:6px;border-bottom:1px solid #ccc">תאריך</th>
              <th style="padding:6px;border-bottom:1px solid #ccc">ספק / תיאור</th>
              <th style="padding:6px;border-bottom:1px solid #ccc">חשבונית</th>
              <th style="padding:6px;border-bottom:1px solid #ccc">סכום</th>
              <th style="padding:6px;border-bottom:1px solid #ccc;text-align:center">פעולות</th>
            </tr>
          </thead>
          <tbody>`;
        data.expenses.forEach(e => {
          expHtml += `<tr style="border-bottom:1px solid #eee">
            <td style="padding:6px;text-align:center">
              <input type="checkbox" checked class="${clsName}" value="${e.id}" style="cursor:pointer;accent-color:#1a237e;">
            </td>
            <td style="padding:6px">${e.date||''}</td>
            <td style="padding:6px">${e.sup||''}</td>
            <td style="padding:6px">${e.inv||''}</td>
            <td style="padding:6px;font-weight:bold;color:#d32f2f">₪${(e.amt||0).toLocaleString('he-IL', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
            <td style="padding:6px;text-align:center">
              <span style="cursor:pointer;margin-left:8px" title="ערוך" onclick="window.budgetApp.openExpenseModal('${escSchool}', '${e.id}')">✏️</span>
              <span style="cursor:pointer" title="מחק" onclick="window.budgetApp.deleteExpense('${escSchool}', '${e.id}')">🗑️</span>
            </td>
          </tr>`;
        });
        expHtml += `</tbody></table>`;
      } else {
        expHtml = `<div style="font-size:0.8rem; color:#888; padding:8px 0;">אין הוצאות רשומות לחודש זה.</div>`;
      }
      const coordName = data.coordinator && data.coordinator.name ? data.coordinator.name : 'הגדר רכז';
      html += `
        <div class="card" style="margin-bottom:15px; border-right: 4px solid ${barColor}; padding:15px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div style="font-weight:700; font-size:1.05rem; color:#1a237e; display:flex; align-items:center; gap:10px;">
              <span>🏫 ${schoolName}</span>
              <button onclick="window.budgetApp.openCoordinatorModal('${escSchool}')" style="background:#e8eaf6; color:#1a237e; border:1px solid #c5cae9; border-radius:12px; padding:3px 10px; font-size:0.8rem; cursor:pointer; font-weight:600;">
                👤 ${coordName}
              </button>
            </div>
            
            <div style="display:flex; gap:15px; align-items:center; flex-wrap:wrap;">
              <div style="font-size:0.85rem;">
                <span style="color:#546e7a;">תקציב:</span>
                <input type="number" value="${data.budget}" onchange="window.budgetApp.updateBudget('${escSchool}', this.value)" style="width:80px; padding:3px; border:1px solid #ccc; border-radius:4px; text-align:center;"> ₪
              </div>
              <div style="font-size:0.85rem;">
                <span style="color:#546e7a;">נוצל:</span>
                <span style="color:#d32f2f; font-weight:bold;">₪${totalExpenses.toLocaleString('he-IL', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
              </div>
              <div style="font-size:0.85rem; background:${remaining < 0 ? '#ffebee' : '#e8f5e9'}; padding:4px 8px; border-radius:4px;">
                <span style="color:${remaining < 0 ? '#c62828' : '#2e7d32'}; font-weight:bold;">יתרה: ₪${remaining.toLocaleString('he-IL', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
              </div>
            </div>
          </div>
          
          <!-- Progress Bar -->
          <div style="width:100%; height:6px; background:#e0e0e0; border-radius:3px; margin:10px 0; overflow:hidden;">
            <div style="width:${pct}%; height:100%; background:${barColor}; transition:width 0.3s ease;"></div>
          </div>
          
          <!-- Expenses Section -->
          ${expHtml}
          
          <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
             <button class="btn bo bsm" onclick="window.budgetApp.openExpenseModal('${escSchool}')">➕ רישום הוצאה</button>
             <div style="display:flex; gap:10px;">
                <button class="btn bw bsm" onclick="window.budgetApp.exportSchoolToExcel('${escSchool}')" ${data.expenses.length===0?'disabled style="opacity:0.5"':''}>📊 אקסל</button>
                <button class="btn bw bsm" onclick="window.budgetApp.exportSchoolToPDF('${escSchool}')" ${data.expenses.length===0?'disabled style="opacity:0.5"':''}>🖨️ PDF</button>
             </div>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  },

  async exportMonthToExcel() {
    if (!window.ExcelJS) { alert('ExcelJS לא נטען.'); return; }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('תקציבים ' + this.currentMonth);
    ws.views = [{ rightToLeft: true }];
    
    // Set column widths
    ws.getColumn(1).width = 15;
    ws.getColumn(2).width = 30;
    ws.getColumn(3).width = 15;
    ws.getColumn(4).width = 15;
    
    const schools = this.getSchools();
    schools.forEach(schoolName => {
      const data = this.getSchoolData(schoolName);
      const total = data.expenses.reduce((s, e) => s + (Number(e.amt)||0), 0);
      const rem = data.budget - total;
      
      const headerRow = ws.addRow([schoolName, `תקציב: ₪${data.budget}`, `יתרה: ₪${rem}`, '']);
      for(let i=1; i<=4; i++) {
        headerRow.getCell(i).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        headerRow.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } };
      }
      
      const subHeader = ws.addRow(['תאריך', 'שם ספק / תיאור', 'מספר חשבונית', 'סכום']);
      for(let i=1; i<=4; i++) {
        subHeader.getCell(i).font = { bold: true };
        subHeader.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };
      }
      
      if(data.expenses.length === 0) {
        ws.addRow(['אין הוצאות רשומות']);
      } else {
        data.expenses.forEach(e => {
          ws.addRow([
            e.date||'',
            e.sup||'',
            e.inv||'',
            e.amt||0
          ]);
        });
      }
      ws.addRow([]); // empty row between schools
    });
    
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `דוח_תקציב_חודשי_${this.currentMonth}.xlsx`;
    a.click();
  },
  
  async exportSchoolToExcel(schoolName) {
    if (!window.ExcelJS) { alert('ExcelJS לא נטען.'); return; }
    const selectedIds = this.getSelectedExpenseIds(schoolName);
    const data = this.getSchoolData(schoolName);
    const expensesToExport = selectedIds ? data.expenses.filter(e => selectedIds.includes(e.id)) : data.expenses;
    
    const total = expensesToExport.reduce((s, e) => s + (Number(e.amt)||0), 0);
    const rem = data.budget - total;
    
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('תקציב ' + schoolName.substring(0, 20));
    ws.views = [{ rightToLeft: true }];
    
    ws.getColumn(1).width = 15;
    ws.getColumn(2).width = 30;
    ws.getColumn(3).width = 15;
    ws.getColumn(4).width = 15;
    
    const headerRow = ws.addRow([schoolName, `תקציב: ₪${data.budget}`, `יתרה: ₪${rem}`, '']);
    for(let i=1; i<=4; i++) {
      headerRow.getCell(i).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      headerRow.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } };
    }
    
    const subHeader = ws.addRow(['תאריך', 'שם ספק / תיאור', 'מספר חשבונית', 'סכום']);
    for(let i=1; i<=4; i++) {
      subHeader.getCell(i).font = { bold: true };
      subHeader.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };
    }
    
    if(expensesToExport.length === 0) {
      ws.addRow(['אין הוצאות רשומות']);
    } else {
      expensesToExport.forEach(e => {
        ws.addRow([e.date||'', e.sup||'', e.inv||'', e.amt||0]);
      });
    }
    
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `דוח_תקציב_${schoolName}_${this.currentMonth}.xlsx`;
    a.click();
  },
  
  async exportSchoolToPDF(schoolName) {
    if (!window.pdfMake) { alert('pdfMake not loaded'); return; }
    if (window.initPdfMake) await window.initPdfMake();
    
    const selectedIds = this.getSelectedExpenseIds(schoolName);
    const data = this.getSchoolData(schoolName);
    const expensesToExport = selectedIds ? data.expenses.filter(e => selectedIds.includes(e.id)) : data.expenses;
    
    const total = expensesToExport.reduce((s, e) => s + (Number(e.amt)||0), 0);
    const rem = data.budget - total;
    
    const tableBody = [
      [
        {text: 'סכום', style: 'th'},
        {text: 'חשבונית', style: 'th'},
        {text: 'תאריך', style: 'th'},
        {text: 'ספק', style: 'th'}
      ]
    ];
    
    expensesToExport.forEach(e => {
      tableBody.push([
        {text: '₪ ' + (e.amt||0).toLocaleString('he-IL', {minimumFractionDigits:2}), alignment: 'center'},
        {text: e.inv||'', alignment: 'center'},
        {text: e.date||'', alignment: 'center'},
        {text: e.sup||'', alignment: 'right'}
      ]);
    });
    
    const coord = data.coordinator || {};
    const content = [];
    
    // Header
    const [year, month] = this.currentMonth.split('-');
    const monthNames = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
    const monthName = monthNames[parseInt(month, 10) - 1] || month;
    content.push({text: `תקציב ${monthName} ${year}`, style: 'header'});
    
    if (coord.name) {
      content.push({text: `שולם ע"י - ${coord.name}`, style: 'subheader'});
    }
    
    content.push({text: `בית ספר ${schoolName}`, style: 'subheader'});
    
    // Subtext budget info
    content.push({text: `תקציב מוקצה : ${data.budget.toLocaleString('he-IL')} | יתרה : ${rem.toLocaleString('he-IL')}`, style: 'subtext', margin: [0,0,0,15]});
    
    // Table
    if (expensesToExport.length > 0) {
      content.push({
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', 'auto', '*'],
          body: tableBody
        },
        layout: 'lightHorizontalLines'
      });
    } else {
      content.push({text: 'אין הוצאות', alignment: 'center'});
    }
    
    // Total / Bank details
    if (coord.bankName || coord.account) {
      content.push({text: coord.bankName || '', style: 'bankDetails', margin: [0, 25, 0, 5]});
      if (coord.branch) content.push({text: `סניף ${coord.branch}`, style: 'bankDetails', margin: [0, 0, 0, 5]});
      content.push({text: `מס' חשבון:`, style: 'bankDetails'});
      content.push({text: coord.account || '', style: 'bankDetails', margin: [0, 0, 0, 5]});
      content.push({text: `שולם ע"י - ${coord.accName || coord.name || ''}`, style: 'payerName', margin: [0, 0, 0, 10]});
      content.push({text: `סה"כ להעברה - ${total.toLocaleString('he-IL')} ש"ח`, style: 'totalTransfer'});
    } else {
      content.push({text: `סה"כ הוצאות : ₪ ${total.toLocaleString('he-IL', {minimumFractionDigits:2})}`, style: 'total', margin: [0,20,0,0]});
    }
    
    const docDefinition = {
      defaultStyle: { font: 'Assistant', alignment: 'right', textDirection: 'rtl' },
      content: content,
      styles: {
        header: { fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 5] },
        subheader: { fontSize: 16, bold: true, alignment: 'center', margin: [0, 0, 0, 5] },
        subtext: { fontSize: 12, alignment: 'center' },
        th: { bold: true, fillColor: '#eeeeee', alignment: 'center' },
        total: { fontSize: 16, bold: true, alignment: 'center' },
        bankDetails: { fontSize: 12, bold: true, alignment: 'center' },
        payerName: { fontSize: 14, bold: true, alignment: 'center' },
        totalTransfer: { fontSize: 16, bold: true, alignment: 'center' }
      }
    };
    
    pdfMake.createPdf(docDefinition).download(`תקציב_${schoolName}_${this.currentMonth}.pdf`);
  }
};

// Hook into tab switching
const _origSPT = window.SPT;
if (_origSPT) {
  window.SPT = function(t) {
    _origSPT(t);
    if (t === 'pbudget') {
      window.budgetApp.init();
    }
  };
}
