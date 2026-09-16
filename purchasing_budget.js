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

  addExpense(schoolName) {
    const data = this.getSchoolData(schoolName);
    const dateInput = prompt('תאריך הוצאה (לדוגמה: 01/06/2026):', '');
    if (dateInput === null) return;
    const supInput = prompt('שם הספק (או תיאור הוצאה פנימית):', '');
    if (supInput === null) return;
    const invInput = prompt('מספר חשבונית (השאר ריק אם אין):', '');
    if (invInput === null) return;
    const amtInput = prompt('סכום ההוצאה (₪):', '');
    if (amtInput === null) return;
    const amt = parseFloat(amtInput);
    if (isNaN(amt)) {
      alert('סכום לא תקין');
      return;
    }
    
    data.expenses.push({
      id: Date.now().toString(),
      date: dateInput.trim(),
      sup: supInput.trim(),
      inv: invInput.trim(),
      amt: amt
    });
    
    this.saveToCloud();
    this.render();
  },

  deleteExpense(schoolName, expId) {
    if(!confirm('האם למחוק הוצאה זו?')) return;
    const data = this.getSchoolData(schoolName);
    data.expenses = data.expenses.filter(e => e.id !== expId);
    this.saveToCloud();
    this.render();
  },

  editExpense(schoolName, expId) {
    const data = this.getSchoolData(schoolName);
    const exp = data.expenses.find(e => e.id === expId);
    if(!exp) return;
    
    const newAmt = prompt('עדכן סכום חדש (₪):', exp.amt);
    if(newAmt === null) return;
    const amt = parseFloat(newAmt);
    if(!isNaN(amt)) exp.amt = amt;
    
    const newSup = prompt('עדכן שם ספק/תיאור:', exp.sup);
    if(newSup !== null) exp.sup = newSup.trim();
    
    this.saveToCloud();
    this.render();
  },

  saveToCloud() {
    if(window.saveToFirebase) {
      window.saveToFirebase(true); // silent save
    }
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
        expHtml += `<table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.8rem; background:#fff; border-radius:4px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1)">
          <thead>
            <tr style="background:#e8eaf6; color:#1a237e; text-align:right;">
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
            <td style="padding:6px">${e.date||''}</td>
            <td style="padding:6px">${e.sup||''}</td>
            <td style="padding:6px">${e.inv||''}</td>
            <td style="padding:6px;font-weight:bold;color:#d32f2f">₪${(e.amt||0).toLocaleString('he-IL', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
            <td style="padding:6px;text-align:center">
              <span style="cursor:pointer;margin-left:8px" title="ערוך" onclick="window.budgetApp.editExpense('${schoolName}', '${e.id}')">✏️</span>
              <span style="cursor:pointer" title="מחק" onclick="window.budgetApp.deleteExpense('${schoolName}', '${e.id}')">🗑️</span>
            </td>
          </tr>`;
        });
        expHtml += `</tbody></table>`;
      } else {
        expHtml = `<div style="font-size:0.8rem; color:#888; padding:8px 0;">אין הוצאות רשומות לחודש זה.</div>`;
      }
      
      html += `
        <div class="card" style="margin-bottom:15px; border-right: 4px solid ${barColor}; padding:15px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div style="font-weight:700; font-size:1.05rem; color:#1a237e;">🏫 ${schoolName}</div>
            
            <div style="display:flex; gap:15px; align-items:center; flex-wrap:wrap;">
              <div style="font-size:0.85rem;">
                <span style="color:#546e7a;">תקציב:</span>
                <input type="number" value="${data.budget}" onchange="window.budgetApp.updateBudget('${schoolName}', this.value)" style="width:80px; padding:3px; border:1px solid #ccc; border-radius:4px; text-align:center;"> ₪
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
             <button class="btn bo bsm" onclick="window.budgetApp.addExpense('${schoolName}')">➕ רישום הוצאה</button>
             <button class="btn bw bsm" onclick="window.budgetApp.exportSchoolToPDF('${schoolName}')" ${data.expenses.length===0?'disabled style="opacity:0.5"':''}>🖨️ הדפס דוח (PDF)</button>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  },

  async exportMonthToExcel() {
    if (!window.ExcelJS) { alert('ExcelJS not loaded'); return; }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('תקציב ' + this.currentMonth, {views:[{rightToLeft:true}]});
    
    ws.columns = [
      { header: 'בית ספר', key: 'school', width: 25 },
      { header: 'חודש', key: 'month', width: 12 },
      { header: 'יתרת תקציב', key: 'remaining', width: 15 },
      { header: 'ספק', key: 'sup', width: 25 },
      { header: 'מס חשבונית', key: 'inv', width: 15 },
      { header: 'תאריך', key: 'date', width: 15 },
      { header: 'סכום', key: 'amt', width: 15 }
    ];
    
    // Style headers
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };
    
    const schools = this.getSchools();
    schools.forEach(schoolName => {
      const data = this.getSchoolData(schoolName);
      const total = data.expenses.reduce((s, e) => s + (Number(e.amt)||0), 0);
      const rem = data.budget - total;
      
      if(data.expenses.length === 0) {
        ws.addRow({
          school: schoolName, month: this.currentMonth, remaining: rem,
          sup: '', inv: '', date: '', amt: ''
        });
      } else {
        data.expenses.forEach((e, idx) => {
          ws.addRow({
            school: idx===0 ? schoolName : '',
            month: idx===0 ? this.currentMonth : '',
            remaining: idx===0 ? rem : '',
            sup: e.sup||'',
            inv: e.inv||'',
            date: e.date||'',
            amt: e.amt||0
          });
        });
      }
      ws.addRow([]); // empty row between schools
    });
    
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `דוח_תקציב_${this.currentMonth}.xlsx`;
    a.click();
  },
  
  exportSchoolToPDF(schoolName) {
    if (!window.pdfMake) { alert('pdfMake not loaded'); return; }
    
    const data = this.getSchoolData(schoolName);
    const total = data.expenses.reduce((s, e) => s + (Number(e.amt)||0), 0);
    const rem = data.budget - total;
    
    const tableBody = [
      [
        {text: 'סכום', style: 'th'},
        {text: 'חשבונית', style: 'th'},
        {text: 'תאריך', style: 'th'},
        {text: 'ספק', style: 'th'}
      ]
    ];
    
    data.expenses.forEach(e => {
      tableBody.push([
        {text: '₪' + (e.amt||0).toLocaleString('he-IL', {minimumFractionDigits:2}), alignment: 'center'},
        {text: e.inv||'', alignment: 'center'},
        {text: e.date||'', alignment: 'center'},
        {text: e.sup||'', alignment: 'right'}
      ]);
    });
    
    const docDefinition = {
      defaultStyle: { font: 'Assistant' },
      content: [
        {text: `תקציב ${this.currentMonth.split('-').reverse().join('/')}`, style: 'header'},
        {text: `בית ספר: ${schoolName}`, style: 'subheader'},
        {text: `תקציב מוקצה: ₪${data.budget.toLocaleString('he-IL')}  |  יתרה: ₪${rem.toLocaleString('he-IL')}`, style: 'subtext', margin: [0,0,0,15]},
        
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', '*'],
            body: tableBody
          },
          layout: 'lightHorizontalLines'
        },
        
        {text: `סה"כ הוצאות: ₪${total.toLocaleString('he-IL', {minimumFractionDigits:2})}`, style: 'total', margin: [0,20,0,0]}
      ],
      styles: {
        header: { fontSize: 22, bold: true, alignment: 'center', margin: [0, 0, 0, 5] },
        subheader: { fontSize: 16, bold: true, alignment: 'center', margin: [0, 0, 0, 5] },
        subtext: { fontSize: 12, alignment: 'center' },
        th: { bold: true, fillColor: '#eeeeee', alignment: 'center' },
        total: { fontSize: 18, bold: true, alignment: 'center' }
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
