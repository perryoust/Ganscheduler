// purchasing_orders.js - Handles Purchase Orders (הזמנות רכש) and Delivery Notes (תעודות משלוח)

function renderPurchOrders() {
  const container = document.getElementById('porders-list');
  if (!container) return;

  const orders = window.ORDERS || [];
  if (orders.length === 0) {
    container.innerHTML = '<div style="color:#aaa;font-size:.8rem;text-align:center;padding:20px">אין הזמנות עדיין</div>';
    return;
  }

  // Sort newest first
  const sorted = [...orders].sort((a, b) => b.ts - a.ts);

  let html = '<table class="stable" style="width:100%"><thead><tr>' +
    '<th>תאריך</th>' +
    '<th>מספר הזמנה</th>' +
    '<th>לכבוד</th>' +
    '<th>סה"כ (₪)</th>' +
    '<th>פעולות</th>' +
    '</tr></thead><tbody>';

  sorted.forEach(o => {
    const dStr = new Date(o.ts).toLocaleDateString('he-IL');
    html += `<tr>
      <td>${dStr}</td>
      <td style="font-weight:bold">${o.orderId}</td>
      <td>${o.supplier}</td>
      <td style="color:#2e7d32;font-weight:bold">${o.totalPrice.toFixed(2)}</td>
      <td>
        <button class="btn bo bsm" onclick="editOrder('${o.id}')">✏️ ערוך</button>
        <button class="btn bo bsm" onclick="duplicateOrder('${o.id}')">📋 שכפל</button>
        <button class="btn bo bsm" onclick="printOrder('${o.id}')">🖨️ הדפס</button>
        <button class="btn bo bsm" onclick="downloadOrder('${o.id}')">📄 הורד</button>
        <button class="btn br bsm" onclick="deletePurchOrder('${o.id}')" style="background:#e53935;color:white;border:none;">🗑️ מחק</button>
      </td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderPurchDeliveries() {
  const container = document.getElementById('pdeliveries-list');
  if (!container) return;

  const deliveries = window.DELIVERIES || [];
  if (deliveries.length === 0) {
    container.innerHTML = '<div style="color:#aaa;font-size:.8rem;text-align:center;padding:20px">אין תעודות משלוח עדיין</div>';
    return;
  }

  const sorted = [...deliveries].sort((a, b) => b.ts - a.ts);

  let html = '<table class="stable" style="width:100%"><thead><tr>' +
    '<th>תאריך</th>' +
    '<th>מספר תעודה</th>' +
    '<th>יעד (רכז/שטח)</th>' +
    '<th>נהג/מוביל</th>' +
    '<th>פעולות</th>' +
    '</tr></thead><tbody>';

  sorted.forEach(d => {
    const dStr = new Date(d.ts).toLocaleDateString('he-IL');
    html += `<tr>
      <td>${dStr}</td>
      <td style="font-weight:bold">${d.deliveryId}</td>
      <td>${d.destination}</td>
      <td>${d.driver}</td>
      <td>
        <button class="btn bo bsm" onclick="editDelivery('${d.id}')">✏️ ערוך</button>
        <button class="btn bo bsm" onclick="printDelivery('${d.id}')">🖨️ הדפס</button>
      </td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

function generateOrderId() {
  // Format: sequence (2 digits) + day + month + year
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = String(today.getFullYear());

  const ordersToday = (window.ORDERS || []).filter(o => {
    const d = new Date(o.ts);
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });

  const seq = String(ordersToday.length + 1).padStart(2, '0');
  return `${seq}${day}${month}${year}`;
}

function generateDeliveryId() {
  // Format: DLV + timestamp
  return 'DLV-' + Date.now().toString().slice(-6);
}

function openNewOrder() {
  const newId = 'ord_' + Date.now();
  const orderId = generateOrderId();
  
  // Create modal container if not exists
  let modal = document.getElementById('order-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'order-modal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }

  const suppliers = (typeof getPurchSuppliers === 'function' ? getPurchSuppliers().map(s => s.name) : Object.keys(window.supEx || {})).sort();
  const supOptions = suppliers.map(s => `<option value="${s}">${s}</option>`).join('');

  modal.innerHTML = `
    <div class="modal-box" style="max-width:800px; background:#fff; border-radius:12px; padding:20px; box-shadow:0 10px 40px rgba(0,0,0,0.2)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px">
        <h2 style="margin:0;color:#1a237e">📦 יצירת הזמנת רכש חדשה</h2>
        <button class="btn bo" onclick="closeOrderModal()">X</button>
      </div>
      
      <div class="row" style="margin-bottom:10px">
        <div style="flex:1">
          <label>מספר הזמנה:</label>
          <input type="text" id="om-orderid" value="${orderId}" class="in-date" style="font-weight:bold">
        </div>
        <div style="flex:1">
          <label>תאריך:</label>
          <input type="date" id="om-date" value="${new Date().toISOString().split('T')[0]}" class="in-date">
        </div>
      </div>
      
      <div class="row" style="margin-bottom:10px">
        <div style="flex:1">
          <label>לכבוד:</label>
          <input type="text" id="om-supplier" list="om-sup-list" class="in-date" placeholder="בחר או הקלד...">
          <datalist id="om-sup-list">${supOptions}</datalist>
        </div>
        <div style="flex:1">
          <label>תיאור ההזמנה (כללי):</label>
          <input type="text" id="om-orderdesc" class="in-date" placeholder="למשל: ציוד יצירה...">
        </div>
        <div style="flex:1">
          <label>תוספת לכותרת ההזמנה:</label>
          <input type="text" id="om-titlesuffix" class="in-date" placeholder='למשל: הנה"ח'>
        </div>
      </div>

      <div style="margin-top:20px;border-top:2px solid #eee;padding-top:15px">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h3 style="margin:0;color:#1a237e">🛒 פריטים בהזמנה</h3>
          <div style="font-size:0.85rem; color:#666;">
            💡 טיפ: אפשר להעתיק שורות באקסל ולהדביק (Ctrl+V) ישר לתוך התיאור של השורה הראשונה
          </div>
        </div>
        
        <div style="max-height: 400px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; margin-bottom:10px;">
          <table class="stable" style="width:100%; margin:0;" id="om-items-table">
            <thead style="position: sticky; top: 0; background: #fff; z-index: 10;">
              <tr>
                <th style="width:30px; text-align:center;">#</th>
                <th>תיאור פריט</th>
                <th style="width:80px">כמות</th>
                <th style="width:100px">מחיר יחידה</th>
                <th style="width:100px">סה"כ</th>
                <th style="width:50px"></th>
              </tr>
            </thead>
            <tbody id="om-items-body" onpaste="handleTablePaste(event)">
            </tbody>
          </table>
        </div>
        
        <button class="btn bg bsm" style="margin-top:10px" onclick="omAddItemRow()">➕ הוסף שורה</button>
      </div>

      <div class="row" style="margin-top:20px;align-items:flex-start">
        <div style="flex:2">
          <label>הערות להזמנה:</label>
          <textarea id="om-notes" rows="3" style="width:100%;border:1px solid #ccc;border-radius:5px;padding:8px;margin-bottom:8px"></textarea>
          <div style="font-size:0.8rem;color:#555;margin-bottom:4px">הערות נפוצות:</div>
          <div id="om-notes-buttons" style="display:flex;flex-wrap:wrap;gap:6px">
          </div>
        </div>
        <div style="flex:1;background:#f1f8e9;padding:15px;border-radius:8px;margin-right:15px">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px">
            <span>סה"כ ביניים:</span>
            <span id="om-subtotal" style="font-weight:bold">0.00 ₪</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
            <b>הנחה (₪):</b>
            <input type="number" id="om-discount" value="0" min="0" step="0.01" style="width:80px;text-align:center" onchange="omCalc()">
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:5px;color:#e65100;align-items:center;">
            <span>מע"מ (<input type="number" id="om-vat-rate" value="${window.VAT_RATE || 18}" style="width:45px;padding:2px;border:1px solid #ccc;border-radius:4px;text-align:center;" onchange="omCalc()" oninput="omCalc()">%):</span>
            <span id="om-vat">0.00 ₪</span>
          </div>
          <div style="display:flex;justify-content:space-between;border-top:1px solid #ccc;padding-top:5px;margin-top:5px;font-size:1.1rem">
            <b>סה"כ לתשלום:</b>
            <b id="om-total" style="color:#2e7d32">0.00 ₪</b>
          </div>
          <div style="margin-top:15px;border-top:1px dashed #ccc;padding-top:15px;">
            <label>מזמין:</label>
            <textarea id="om-orderer" class="in-date" placeholder="שם מזמין&#10;תפקיד..." rows="2" style="resize:vertical"></textarea>
            <div style="font-size:0.8rem;color:#555;margin-bottom:4px;margin-top:4px">מזמינים נפוצים:</div>
            <div id="om-orderer-buttons" style="display:flex;flex-wrap:wrap;gap:6px"></div>
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;margin-top:20px;align-items:center;">
        <button class="btn bw bsm" onclick="editPurchFooter()">✏️ ערוך כותרת תחתונה בהדפסה</button>
        <div style="display:flex;gap:10px">
          <button class="btn bw" onclick="previewOrder()">👁️ הצג לפני שמירה</button>
          <button class="btn bo" onclick="closeOrderModal()">ביטול</button>
          <button class="btn bp" onclick="saveOrder('${newId}')">💾 שמור הזמנה</button>
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
  renderPurchNotesButtons();
  renderPurchOrderersButtons();
  omAddItemRow(); // Add first empty row
}

window.handleTablePaste = function(e) {
  if (!e.target.classList.contains('om-desc')) return;
  const text = (e.clipboardData || window.clipboardData).getData('text');
  if (!text) return;
  
  if (text.indexOf('\n') === -1 && text.indexOf('\t') === -1) return; // normal single paste
  
  e.preventDefault();
  const rows = text.split(/\r?\n/).filter(r => r.trim());
  const currentRow = e.target.closest('tr');
  let firstRow = true;
  
  rows.forEach(row => {
    const cols = row.split(/\t/);
    let desc = cols[0] ? cols[0].trim() : '';
    let price = 0;
    let qty = 1;
    
    if (cols.length >= 3) {
      price = parseFloat((cols[1] || '').replace(/[^\d.-]/g, '')) || 0;
      qty = parseFloat((cols[2] || '').replace(/[^\d.-]/g, '')) || 1;
    } else if (cols.length === 2) {
      price = parseFloat((cols[1] || '').replace(/[^\d.-]/g, '')) || 0;
    }
    
    if (desc || price > 0) {
      if (firstRow && currentRow) {
        currentRow.querySelector('.om-desc').value = desc;
        currentRow.querySelector('.om-qty').value = qty;
        currentRow.querySelector('.om-price').value = price;
        firstRow = false;
      } else {
        omAddItemRow(desc, qty, price);
      }
    }
  });
  omCalc();
};

window.omDuplicateItemRow = function(rowId) {
  const tr = document.getElementById(rowId);
  if (!tr) return;
  const desc = tr.querySelector('.om-desc').value;
  const qty = parseFloat(tr.querySelector('.om-qty').value) || 1;
  const price = parseFloat(tr.querySelector('.om-price').value) || 0;
  omAddItemRow(desc, qty, price);
};

function omAddItemRow(desc='', qty=1, price=0) {
  const tbody = document.getElementById('om-items-body');
  const tr = document.createElement('tr');
  const rowId = 'row_' + Math.random().toString(36).substr(2, 9);
  tr.id = rowId;
  
  tr.innerHTML = `
    <td class="om-row-num" style="text-align:center; font-weight:bold; color:#777; vertical-align:middle;"></td>
    <td><input type="text" class="om-desc in-date" style="width:100%" placeholder="שם הפריט..."></td>
    <td><input type="number" class="om-qty in-date" min="1" onchange="omCalc()" style="width:100%"></td>
    <td><input type="number" class="om-price in-date" min="0" step="0.01" onchange="omCalc()" style="width:100%"></td>
    <td class="om-row-total" style="font-weight:bold;vertical-align:middle">0.00 ₪</td>
    <td style="white-space:nowrap;">
      <button type="button" class="btn bw bsm" onclick="omDuplicateItemRow('${rowId}')" title="שכפל שורה">+</button>
      <button type="button" class="btn bo bsm" onclick="document.getElementById('${rowId}').remove(); omCalc();" title="מחק שורה">🗑️</button>
    </td>
  `;
  tbody.appendChild(tr);
  
  tr.querySelector('.om-desc').value = desc;
  tr.querySelector('.om-qty').value = qty;
  tr.querySelector('.om-price').value = price;
  
  omCalc();
}

function omCalc() {
  const tbody = document.getElementById('om-items-body');
  let subtotal = 0;
  
  Array.from(tbody.children).forEach((tr, index) => {
    const numEl = tr.querySelector('.om-row-num');
    if (numEl) numEl.innerText = index + 1;
    
    const qty = parseFloat(tr.querySelector('.om-qty').value) || 0;
    const price = parseFloat(tr.querySelector('.om-price').value) || 0;
    const rowTot = qty * price;
    tr.querySelector('.om-row-total').innerText = rowTot.toFixed(2) + ' ₪';
    subtotal += rowTot;
  });
  
  const discountInput = document.getElementById('om-discount');
  const discount = discountInput ? (parseFloat(discountInput.value) || 0) : 0;
  
  let taxable = subtotal - discount;
  if (taxable < 0) taxable = 0;

  const vatInput = document.getElementById('om-vat-rate');
  const vatRate = vatInput ? (parseFloat(vatInput.value) || 0) : (window.VAT_RATE || 18);
  const vat = taxable * (vatRate / 100);
  const total = taxable + vat;
  
  document.getElementById('om-subtotal').innerText = subtotal.toFixed(2) + ' ₪';
  document.getElementById('om-vat').innerText = vat.toFixed(2) + ' ₪';
  document.getElementById('om-total').innerText = total.toFixed(2) + ' ₪';
}

function closeOrderModal() {
  const modal = document.getElementById('order-modal');
  if (modal) modal.style.display = 'none';
}

async function saveOrder(id) {
  const supplier = document.getElementById('om-supplier').value.trim();
  if (!supplier) {
    alert('חובה לבחור ספק');
    return;
  }
  
  const tbody = document.getElementById('om-items-body');
  const items = [];
  Array.from(tbody.children).forEach(tr => {
    const desc = tr.querySelector('.om-desc').value.trim();
    const qty = parseFloat(tr.querySelector('.om-qty').value) || 0;
    const price = parseFloat(tr.querySelector('.om-price').value) || 0;
    if (desc && qty > 0) {
      items.push({ desc, qty, price, total: qty * price });
    }
  });
  
  if (items.length === 0) {
    alert('חובה להוסיף לפחות פריט אחד להזמנה');
    return;
  }
  
  let subtotal = items.reduce((sum, item) => sum + item.total, 0);
  
  const discountInput = document.getElementById('om-discount');
  const discount = discountInput ? (parseFloat(discountInput.value) || 0) : 0;
  let taxable = subtotal - discount;
  if (taxable < 0) taxable = 0;

  let vatRate = parseFloat(document.getElementById('om-vat-rate').value) || (window.VAT_RATE || 18);
  let vat = taxable * (vatRate / 100);
  let total = taxable + vat;
  
  const orderDateStr = document.getElementById('om-date').value;
  const ts = orderDateStr ? new Date(orderDateStr).getTime() : Date.now();
  const orderDesc = document.getElementById('om-orderdesc') ? document.getElementById('om-orderdesc').value.trim() : '';
  const titleSuffix = document.getElementById('om-titlesuffix') ? document.getElementById('om-titlesuffix').value.trim() : '';
  const orderer = document.getElementById('om-orderer') ? document.getElementById('om-orderer').value.trim() : '';

  const newOrder = {
    id: id,
    orderId: document.getElementById('om-orderid').value,
    ts: ts,
    supplier: supplier,
    orderer: orderer,
    orderDesc: orderDesc,
    titleSuffix: titleSuffix,
    notes: document.getElementById('om-notes').value,
    items: items,
    subtotal: subtotal,
    discount: discount,
    vat: vat,
    totalPrice: total
  };
  
  window.ORDERS = window.ORDERS || [];
  
  const existingIdx = window.ORDERS.findIndex(o => o.id === id);
  if (existingIdx >= 0) {
    window.ORDERS[existingIdx] = newOrder;
  } else {
    window.ORDERS.push(newOrder);
  }
  
  // Sync with INVOICES report
  if (typeof window.INVOICES !== 'undefined') {
    const existingInvIdx = window.INVOICES.findIndex(i => i.orderNum === newOrder.orderId);
    if (existingInvIdx >= 0) {
      window.INVOICES[existingInvIdx] = {
        ...window.INVOICES[existingInvIdx],
        supName: supplier,
        orderDate: document.getElementById('om-date').value,
        orderDesc: orderDesc,
        orderAmt: subtotal,
        orderVat: vat,
        orderTotal: total,
        orderNotes: newOrder.notes,
        vat: vatRate
      };
    } else {
      window.INVOICES.push({
        id: Date.now() + 1,
        supName: supplier,
        vat: vatRate,
        serialNum: '',
        orderNum: newOrder.orderId,
        orderDate: document.getElementById('om-date').value,
        orderDesc: orderDesc,
        orderType: '',
        assignment: '',
        actMonth: '',
        orderAmt: subtotal,
        orderVat: vat,
        orderTotal: total,
        ordVatMode: 'ex',
        orderNotes: newOrder.notes,
        locCity: '',
        locType: '',
        locName: '',
        txNum: '',
        txDate: '',
        txAmt: 0,
        txVat: 0,
        txTotal: 0,
        txVatMode: 'ex',
        num: '',
        date: '',
        amt: 0,
        vatAmt: 0,
        total: 0,
        invVatMode: 'ex',
        recv: '',
        status: 'order',
        cancelReason: '',
        notes: '',
        txNotes: '',
        file_order: null,
        file_tx: null,
        file_tax: null,
        ts: Date.now() + 1
      });
    }
    if (typeof window.renderInvoices === 'function') window.renderInvoices();
  }
  
  closeOrderModal();
  renderPurchOrders();
  
  // Save to Firebase
  if (typeof window.ghAutoSave === 'function') {
    await window.ghAutoSave(true);
  }
  showToast('✅ ההזמנה נשמרה בהצלחה!');
}

function editOrder(id) {
  const order = (window.ORDERS || []).find(o => o.id === id);
  if (!order) return;
  
  openNewOrder();
  
  // Override fields with existing data
  document.getElementById('om-orderid').value = order.orderId;
  document.getElementById('om-date').value = new Date(order.ts).toISOString().split('T')[0];
  document.getElementById('om-supplier').value = order.supplier;
  
  const ordererEl = document.getElementById('om-orderer');
  if(ordererEl) ordererEl.value = order.orderer || '';
  
  const descEl = document.getElementById('om-orderdesc');
  if(descEl) descEl.value = order.orderDesc || '';
  
  document.getElementById('om-notes').value = order.notes || '';
  
  // Clear items and add existing
  const tbody = document.getElementById('om-items-body');
  tbody.innerHTML = '';
  order.items.forEach(item => {
    omAddItemRow(item.desc, item.qty, item.price);
  });
  
  // Change save button to use existing ID
  const saveBtn = document.querySelector('#order-modal .btn.bp');
  saveBtn.setAttribute('onclick', `saveOrder('${id}')`);
  
  omCalc();
}

function duplicateOrder(id) {
  const order = (window.ORDERS || []).find(o => o.id === id);
  if (!order) return;
  
  openNewOrder();
  
  // Date is already today, orderId is newly generated
  document.getElementById('om-supplier').value = order.supplier || '';
  
  const ordererEl = document.getElementById('om-orderer');
  if(ordererEl) ordererEl.value = order.orderer || '';
  
  const descEl = document.getElementById('om-orderdesc');
  if(descEl) descEl.value = order.orderDesc || '';
  
  document.getElementById('om-notes').value = order.notes || '';
  
  // Clear items and add existing
  const tbody = document.getElementById('om-items-body');
  tbody.innerHTML = '';
  order.items.forEach(item => {
    omAddItemRow(item.desc, item.qty, item.price);
  });
  
  omCalc();
  showToast('הפרטים שוכפלו להזמנה חדשה (מספר חדש). לחץ על שמירה כדי לשמור אותה.');
}

function printOrder(id) {
  const order = (window.ORDERS || []).find(o => o.id === id);
  if (!order) return;
  openOrderPrintPreview(order, false);
}

window.downloadOrder = function(id) {
  const order = (window.ORDERS || []).find(o => o.id === id);
  if (!order) return;
  openOrderPrintPreview(order, true);
};

function previewOrder() {
  const supplier = document.getElementById('om-supplier').value.trim();
  if (!supplier) {
    alert('חובה לבחור ספק כדי להציג את ההזמנה');
    return;
  }
  
  const tbody = document.getElementById('om-items-body');
  const items = [];
  Array.from(tbody.children).forEach(tr => {
    const desc = tr.querySelector('.om-desc').value.trim();
    const qty = parseFloat(tr.querySelector('.om-qty').value) || 0;
    const price = parseFloat(tr.querySelector('.om-price').value) || 0;
    if (desc && qty > 0) {
      items.push({ desc, qty, price, total: qty * price });
    }
  });
  
  if (items.length === 0) {
    alert('חובה להוסיף לפחות פריט אחד כדי להציג את ההזמנה');
    return;
  }
  
  let subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const discountInput = document.getElementById('om-discount');
  const discount = discountInput ? (parseFloat(discountInput.value) || 0) : 0;
  let taxable = subtotal - discount;
  if (taxable < 0) taxable = 0;
  const vatInput = document.getElementById('om-vat-rate');
  const vatRate = vatInput ? (parseFloat(vatInput.value) || 0) : (window.VAT_RATE || 18);
  let vat = taxable * (vatRate / 100);
  let total = taxable + vat;
  
  const orderDateStr = document.getElementById('om-date').value;
  const ts = orderDateStr ? new Date(orderDateStr).getTime() : Date.now();
  const orderDesc = document.getElementById('om-orderdesc') ? document.getElementById('om-orderdesc').value.trim() : '';
  const orderer = document.getElementById('om-orderer') ? document.getElementById('om-orderer').value.trim() : '';

  const order = {
    orderId: document.getElementById('om-orderid').value,
    ts: ts,
    supplier: supplier,
    orderer: orderer,
    orderDesc: orderDesc,
    notes: document.getElementById('om-notes').value,
    items: items,
    subtotal: subtotal,
    discount: discount,
    vat: vat,
    totalPrice: total
  };
  
  openOrderPrintPreview(order);
}

function openOrderPrintPreview(order, autoDownload = false) {
  const defaultFooter = `טומשין-עושים חינוך אחרת בע"מ (חל"צ) – רשת צהרונים\nהנהלה ראשית: רח' איינשטיין 18 קומה ב', נס ציונה, ת.ד. 2318, מיקוד 7403622, טל: 03-9689119 פקס: 039689120\nwww.tomashin.co.il  www.tomashin-kids.co.il`;
  
  const rtlFix = (str) => {
    if (!str) return '';
    let fixed = String(str).replace(/([\u0590-\u05FF]+['".,:;)(]+)(\s|$)/g, '$1&rlm;$2');
    fixed = fixed.replace(/ /g, '&nbsp;');
    return fixed;
  };

  const footerLines = (window.PURCH_FOOTER || defaultFooter).split('\n').map(l => rtlFix(l.trim())).filter(l => l);
  let footerHtml = '';
  if (footerLines.length > 0) {
    footerHtml += `<b style="color: #2e7d32; font-size: 1.1em;">${footerLines[0]}</b><br>`;
    for(let i=1; i<footerLines.length; i++){
      footerHtml += `${footerLines[i]}<br>`;
    }
  }

  let rawTitle = `${order.supplier || ''} - ${order.orderDesc ? order.orderDesc + ' - ' : ''}${order.orderId}`;
  rawTitle = rawTitle.replace(/"/g, '').replace(/_/g, ' ').replace(/\s+/g, ' ');
  const titleText = rawTitle.replace(/&/g, '&amp;');

  const getItemLines = (it) => {
    if (!it || !it.desc) return 1;
    const lines = String(it.desc).split('\n').reduce((acc, l) => acc + Math.max(1, Math.ceil(l.length / 42)), 0);
    return Math.max(1, lines);
  };

  const totalLines = order.items ? order.items.reduce((acc, it) => acc + getItemLines(it), 0) : 0;

  let compactClass = '';
  let MAX_LINES_PER_PAGE = 22;
  let MAX_LINES_PER_PAGE_WITH_TOTALS = 14;

  if (totalLines > 25) {
    compactClass = 'super-compact';
    MAX_LINES_PER_PAGE = 45;
    MAX_LINES_PER_PAGE_WITH_TOTALS = 30;
  } else if (totalLines > 14) {
    compactClass = 'compact';
    MAX_LINES_PER_PAGE = 32;
    MAX_LINES_PER_PAGE_WITH_TOTALS = 22;
  }
  
  const pages = [];
  let remaining = order.items ? [...order.items] : [];
  while (remaining.length > 0) {
    let remainingLines = remaining.reduce((acc, it) => acc + getItemLines(it), 0);
    if (remainingLines <= MAX_LINES_PER_PAGE_WITH_TOTALS) {
      pages.push({ items: remaining.splice(0, remaining.length), hasTotals: true });
      break;
    }

    let pageItems = [];
    let pageLines = 0;
    while (remaining.length > 0) {
      let nextLines = getItemLines(remaining[0]);
      if (pageItems.length > 0 && (pageLines + nextLines > MAX_LINES_PER_PAGE)) {
        break;
      }
      pageLines += nextLines;
      pageItems.push(remaining.shift());
    }

    if (remaining.length === 0) {
      if (pageLines > MAX_LINES_PER_PAGE_WITH_TOTALS) {
        pages.push({ items: pageItems, hasTotals: false });
        pages.push({ items: [], hasTotals: true });
      } else {
        pages.push({ items: pageItems, hasTotals: true });
      }
    } else {
      pages.push({ items: pageItems, hasTotals: false });
    }
  }
  if (pages.length === 0) pages.push({ items: [], hasTotals: true });
  
  const totalPages = pages.length;
  let pagesHtml = '';

  pages.forEach((pageObj, pageIndex) => {
    const isLastPage = pageObj.hasTotals;
    
    let headerHtml = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="text-align:right; font-size:1.1em; font-weight:bold; margin-top:25px; color:#555;">
          ${totalPages > 1 ? `עמוד ${pageIndex + 1} מתוך ${totalPages}` : ''}
        </div>
        <div style="text-align: left; margin-bottom: 10px;">
          <img src="לוגו לאורך - עושים חינוך אחרת (3000 x 750 פיקסל).png" style="max-height:75px; width:auto; object-fit:contain;">
        </div>
      </div>
      <div class="header">
        <div>
          <h3 style="margin-top:0; margin-bottom:5px;">הזמנת&nbsp;רכש${order.titleSuffix ? '&nbsp;:&nbsp;' + rtlFix(order.titleSuffix) : ''}</h3>
          <h4 style="margin-top:0; margin-bottom:10px;"><span style="font-weight:bold; margin-left:5px;">מספר&nbsp;הזמנה:&rlm;</span><span>${rtlFix(order.orderId)}</span></h4>
        </div>
        <div style="text-align: left;">
          <p style="margin:0;"><span style="font-weight:bold; margin-left:5px;">תאריך:&rlm;</span><span>${new Date(order.ts).toLocaleDateString('he-IL')}</span></p>
        </div>
      </div>
      <div style="margin-bottom: 5px;">
        <p style="margin:5px 0;"><span style="font-weight:bold; margin-left:5px;">לכבוד:&rlm;</span><span>${rtlFix(order.supplier)}</span></p>
        ${(() => {
          if (typeof window.supEx === 'undefined') return '';
          const ex = window.supEx[order.supplier] || {};
          const base = (typeof window.SUPBASE !== 'undefined' ? window.SUPBASE.find(s => s.name === order.supplier) : null) || {};
          const contact = ex.contact || '';
          const phone = ex.ph1 || base.phone || '';
          if (!contact && !phone) return '';
          let str = '';
          if (contact) str += rtlFix(contact);
          if (contact && phone) str += ' ';
          if (phone) str += rtlFix(phone);
          return `<p style="margin:5px 0; padding-right:45px;"><span>${str}</span></p>`;
        })()}
        ${order.orderDesc ? `<p style="margin:5px 0; margin-top:15px; text-align:center;"><span style="font-weight:bold;">${rtlFix(order.orderDesc)}</span></p>` : ''}
      </div>
    `;

    let tableHtml = '';
    if (pageObj.items.length > 0) {
      tableHtml = `
        <table>
          <tr>
            <th style="width:35px; text-align:center;">#</th>
            <th style="width:auto;">תיאור</th>
            <th style="width:65px;">כמות</th>
            <th style="width:95px;">מחיר&nbsp;יחידה</th>
            <th style="width:95px;">סה"כ</th>
          </tr>
          ${pageObj.items.map((item, idx) => {
            let prevItems = 0;
            for(let i=0; i<pageIndex; i++) prevItems += pages[i].items.length;
            return `
            <tr>
              <td style="text-align:center; vertical-align:top;">${prevItems + idx + 1}</td>
              <td style="word-break:break-word; white-space:pre-wrap; vertical-align:top;">${rtlFix(item.desc).replace(/\n/g, '<br>')}</td>
              <td style="vertical-align:top;">${item.qty}</td>
              <td style="vertical-align:top;"><span dir="ltr">&#8362; ${item.price.toFixed(2)}</span></td>
              <td style="vertical-align:top;"><span dir="ltr">&#8362; ${item.total.toFixed(2)}</span></td>
            </tr>
            `;
          }).join('')}
        </table>
      `;
    }

    let footerContentHtml = '';
    if (isLastPage) {
      footerContentHtml = `
        <div style="margin-top: 20px; text-align: left; font-size:0.95em;">
          <p style="margin:5px 0;"><span style="font-weight:bold; margin-left:5px;">סה"כ:&rlm;</span><span dir="ltr">&#8362; ${order.subtotal.toFixed(2)}</span></p>
          ${order.discount ? `<p style="margin:5px 0; color:#d32f2f;"><span style="font-weight:bold; margin-left:5px;">הנחה:&rlm;</span><span dir="ltr">- &#8362; ${order.discount.toFixed(2)}</span></p>` : ''}
          <p style="margin:5px 0;"><span style="font-weight:bold; margin-left:5px;">${Math.round((order.vat/(order.subtotal - (order.discount || 0)))*100) || 17}% מע"מ:</span><span dir="ltr">&#8362; ${order.vat.toFixed(2)}</span></p>
          <h3 style="color:#2e7d32; margin:10px 0 0 0;"><span style="font-weight:bold; margin-left:5px;">סה"כ לתשלום:&rlm;</span><span dir="ltr">&#8362; ${order.totalPrice.toFixed(2)}</span></h3>
        </div>
        
        ${order.notes ? `<div style="margin-top:20px"><b>הערות:&rlm;</b><br>${rtlFix(order.notes).replace(/\n/g, '<br>')}</div>` : ''}
        
        <div style="margin-top: 40px; display: flex; justify-content: flex-end;">
          <div style="display: flex; flex-direction: column; align-items: center; width: 200px;">
            ${order.orderer ? order.orderer.split('\n').map(l => `<div style="margin-bottom:5px; font-weight:bold;">${rtlFix(l)}</div>`).join('') : ''}
            <div style="border-top: 1px solid #000; width: 100%; margin-top: 35px; text-align: center; padding-top: 5px;">חתימה</div>
          </div>
        </div>
      `;
    }

    pagesHtml += `
      <div class="page ${compactClass}" style="${pageIndex < totalPages - 1 ? 'page-break-after: always;' : ''}">
        ${headerHtml}
        ${tableHtml}
        ${footerContentHtml}
        
        <div style="flex:1;"></div>
        
        <div style="margin-top:20px; text-align:center; font-size:0.85em; color:#555; border-top:1px solid #ccc; padding-top:10px;">
          ${footerHtml}
        </div>
      </div>
    `;
  });

  const w = window.open('', '_blank');
  w.document.write(`
    <html dir="rtl">
    <head>
      <title>${titleText}</title>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
      <style>
        body { font-family: Arial, sans-serif; padding: 0; margin: 0; background: #e0e0e0; }
        .no-print { background: #333; padding: 15px; text-align: center; position: sticky; top: 0; z-index: 1000; box-shadow: 0 2px 5px rgba(0,0,0,0.3); }
        .no-print button { padding: 10px 20px; margin: 0 10px; font-size: 16px; font-weight: bold; cursor: pointer; border: none; border-radius: 5px; color: #fff; }
        .btn-print { background: #2196f3; }
        .btn-pdf { background: #f44336; }
        .page-container { padding: 40px; display: flex; justify-content: center; flex-direction: column; align-items: center; }
        .page { 
          background: #fff; 
          padding: 40px; 
          width: 794px; 
          min-height: 1115px;
          height: auto;
          box-sizing: border-box; 
          box-shadow: 0 0 10px rgba(0,0,0,0.1); 
          display: flex;
          flex-direction: column;
          position: relative;
          margin-bottom: 20px;
        }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.9em; table-layout: fixed; }
        th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: right; vertical-align: top; word-break: break-word; overflow-wrap: break-word; white-space: pre-wrap; line-height: 1.3; }
        th { background: #f5f5f5; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2e7d32; padding-bottom: 10px; margin-bottom: 10px;}
        
        .compact table { font-size: 0.85em; margin-top: 5px; }
        .compact th, .compact td { padding: 2px 4px; }
        .compact .header { padding-bottom: 5px; margin-bottom: 5px; }
        
        .super-compact table { font-size: 0.75em; margin-top: 2px; }
        .super-compact th, .super-compact td { padding: 1px 2px; }
        .super-compact .header { padding-bottom: 2px; margin-bottom: 5px; border-bottom-width: 1px; }
        .super-compact h3, .super-compact h4, .super-compact p { margin-bottom: 1px !important; }

        @page { size: A4 portrait; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff; }
          .page-container { padding: 0; }
          .page { box-shadow: none; padding: 0; width: 100%; min-height: 100%; margin-bottom: 0; }
        }
      </style>
      <script>
        function doPrint() { window.print(); }
        function doPDF() {
          const element = document.getElementById('pdf-content');
          
          // Temporarily remove spacing that causes blank pages in html2pdf
          element.style.padding = '0';
          const pages = element.querySelectorAll('.page');
          pages.forEach(p => {
            p.style.marginBottom = '0';
            p.style.boxShadow = 'none';
          });
          
          const opt = {
            margin:       0,
            filename:     '${rawTitle}' + '.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };
          html2pdf().set(opt).from(element).save().then(() => {
            // Restore spacing after PDF generation
            element.style.padding = '';
            pages.forEach(p => {
              p.style.marginBottom = '';
              p.style.boxShadow = '';
            });
            ${autoDownload ? 'setTimeout(() => window.close(), 1500);' : ''}
          });
        }
        ${autoDownload ? 'window.onload = doPDF;' : ''}
      </script>
    </head>
    <body>
      <div class="no-print">
        <button class="btn-print" onclick="doPrint()">🖨️ הדפס</button>
        <button class="btn-pdf" onclick="doPDF()">📄 הורד כ-PDF</button>
      </div>
      <div class="page-container" id="pdf-content">
        ${pagesHtml}
      </div>
    </body>
    </html>
  `);
}


function openNewDelivery() {
  const newId = 'dlv_' + Date.now();
  const deliveryId = generateDeliveryId();
  
  let modal = document.getElementById('delivery-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'delivery-modal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-box" style="max-width:800px; background:#fff; border-radius:12px; padding:20px; box-shadow:0 10px 40px rgba(0,0,0,0.2)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px">
        <h2 style="margin:0;color:#1a237e">🚚 יצירת תעודת משלוח חדשה</h2>
        <button class="btn bo" onclick="closeDeliveryModal()">X</button>
      </div>
      
      <div class="row" style="margin-bottom:10px">
        <div style="flex:1">
          <label>מספר תעודה:</label>
          <input type="text" id="dm-deliveryid" value="${deliveryId}" class="in-date" readonly style="background:#f5f5f5;font-weight:bold">
        </div>
        <div style="flex:1">
          <label>תאריך:</label>
          <input type="date" id="dm-date" value="${new Date().toISOString().split('T')[0]}" class="in-date">
        </div>
      </div>
      
      <div class="row" style="margin-bottom:10px">
        <div style="flex:1">
          <label>יעד (רכז/שטח):</label>
          <input type="text" id="dm-destination" class="in-date" placeholder="למשל: רכזת ראש העין">
        </div>
        <div style="flex:1">
          <label>נהג/מוביל:</label>
          <input type="text" id="dm-driver" class="in-date" placeholder="שם הנהג...">
        </div>
      </div>

      <div style="margin-top:20px;border-top:2px solid #eee;padding-top:15px">
        <h3 style="margin:0 0 10px 0;color:#1a237e">📦 ציוד למשלוח</h3>
        
        <table class="stable" style="width:100%" id="dm-items-table">
          <thead>
            <tr>
              <th>תיאור ציוד</th>
              <th style="width:80px">כמות</th>
              <th style="width:150px">הערות / ברקוד</th>
              <th style="width:50px"></th>
            </tr>
          </thead>
          <tbody id="dm-items-body">
          </tbody>
        </table>
        
        <button class="btn bw bsm" style="margin-top:10px" onclick="dmAddItemRow()">➕ הוסף שורת ציוד</button>
      </div>

      <div style="margin-top:20px">
        <label>הערות כלליות למשלוח:</label>
        <textarea id="dm-notes" rows="3" style="width:100%;border:1px solid #ccc;border-radius:5px;padding:8px"></textarea>
      </div>

      <div style="display:flex;justify-content:flex-end;margin-top:20px;gap:10px">
        <button class="btn bo" onclick="closeDeliveryModal()">ביטול</button>
        <button class="btn bp" onclick="saveDelivery('${newId}')">💾 שמור תעודת משלוח</button>
      </div>
    </div>
  `;
  
  modal.style.display = 'flex';
  dmAddItemRow(); // Add first empty row
}

function dmAddItemRow(desc='', qty=1, note='') {
  const tbody = document.getElementById('dm-items-body');
  const tr = document.createElement('tr');
  const rowId = 'drow_' + Math.random().toString(36).substr(2, 9);
  tr.id = rowId;
  
  tr.innerHTML = `
    <td><input type="text" class="dm-desc in-date" value="${desc}" style="width:100%" placeholder="שם הציוד..."></td>
    <td><input type="number" class="dm-qty in-date" value="${qty}" min="1" style="width:100%"></td>
    <td><input type="text" class="dm-note in-date" value="${note}" style="width:100%" placeholder="הערות"></td>
    <td><button class="btn bo bsm" onclick="document.getElementById('${rowId}').remove();">X</button></td>
  `;
  tbody.appendChild(tr);
}

function closeDeliveryModal() {
  const modal = document.getElementById('delivery-modal');
  if (modal) modal.style.display = 'none';
}

async function saveDelivery(id) {
  const destination = document.getElementById('dm-destination').value.trim();
  if (!destination) {
    alert('חובה לציין יעד');
    return;
  }
  
  const tbody = document.getElementById('dm-items-body');
  const items = [];
  Array.from(tbody.children).forEach(tr => {
    const desc = tr.querySelector('.dm-desc').value.trim();
    const qty = parseFloat(tr.querySelector('.dm-qty').value) || 0;
    const note = tr.querySelector('.dm-note').value.trim();
    if (desc && qty > 0) {
      items.push({ desc, qty, note });
    }
  });
  
  if (items.length === 0) {
    alert('חובה להוסיף לפחות פריט אחד למשלוח');
    return;
  }
  
  const dateStr = document.getElementById('dm-date').value;
  const ts = dateStr ? new Date(dateStr).getTime() : Date.now();
  
  const newDelivery = {
    id: id,
    deliveryId: document.getElementById('dm-deliveryid').value,
    ts: ts,
    destination: destination,
    driver: document.getElementById('dm-driver').value.trim(),
    notes: document.getElementById('dm-notes').value,
    items: items
  };
  
  window.DELIVERIES = window.DELIVERIES || [];
  
  const existingIdx = window.DELIVERIES.findIndex(d => d.id === id);
  if (existingIdx >= 0) {
    window.DELIVERIES[existingIdx] = newDelivery;
  } else {
    window.DELIVERIES.push(newDelivery);
  }
  
  closeDeliveryModal();
  renderPurchDeliveries();
  
  if (typeof window.ghAutoSave === 'function') {
    await window.ghAutoSave(true);
  }
  showToast('✅ תעודת המשלוח נשמרה!');
}

function editDelivery(id) {
  const delivery = (window.DELIVERIES || []).find(d => d.id === id);
  if (!delivery) return;
  
  openNewDelivery();
  
  document.getElementById('dm-deliveryid').value = delivery.deliveryId;
  document.getElementById('dm-date').value = new Date(delivery.ts).toISOString().split('T')[0];
  document.getElementById('dm-destination').value = delivery.destination;
  document.getElementById('dm-driver').value = delivery.driver || '';
  document.getElementById('dm-notes').value = delivery.notes || '';
  
  const tbody = document.getElementById('dm-items-body');
  tbody.innerHTML = '';
  delivery.items.forEach(item => {
    dmAddItemRow(item.desc, item.qty, item.note);
  });
  
  const saveBtn = document.querySelector('#delivery-modal .btn.bp');
  saveBtn.setAttribute('onclick', `saveDelivery('${id}')`);
}

window.deletePurchOrder = async function(id) {
  if (!confirm('האם אתה בטוח שברצונך למחוק הזמנה זו? המחיקה תמחק גם את החשבונית המקושרת להזמנה זו מחלון חשבוניות.')) return;
  
  const order = (window.ORDERS || []).find(o => o.id === id);
  if (!order) return;
  
  // Remove from ORDERS
  window.ORDERS = window.ORDERS.filter(o => o.id !== id);
  
  // Sync with INVOICES
  if (typeof window.INVOICES !== 'undefined') {
    window.INVOICES = window.INVOICES.filter(i => i.orderNum !== order.orderId);
    if (typeof window.renderInvoices === 'function') window.renderInvoices();
  }
  
  renderPurchOrders();
  
  // Save to Firebase
  if (typeof window.ghAutoSave === 'function') {
    await window.ghAutoSave(true);
  }
  showToast('🗑️ ההזמנה נמחקה בהצלחה!');
};

function printDelivery(id) {
  const dlv = (window.DELIVERIES || []).find(d => d.id === id);
  if (!dlv) return;
  
  const w = window.open('', '_blank');
  w.document.write(`
    <html dir="rtl">
    <head>
      <title>תעודת משלוח ${dlv.deliveryId}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ccc; padding: 10px; text-align: right; }
        th { background: #f5f5f5; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #546e7a; padding-bottom: 20px; margin-bottom: 20px;}
        .signature { margin-top: 80px; display: flex; justify-content: space-around; }
        .sig-line { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; }
      </style>
    </head>
    <body onload="window.print(); window.close();">
      <div class="header">
        <div>
          <h1>תעודת משלוח ציוד</h1>
          <h2>מספר תעודה: ${dlv.deliveryId}</h2>
          <p>תאריך: ${new Date(dlv.ts).toLocaleDateString('he-IL')}</p>
        </div>
        <img src="לוגו קוביה - עושים חינוך אחרת.png" style="max-height: 100px;">
      </div>
      
      <div style="display:flex; justify-content: space-between; font-size:1.1rem; margin-bottom: 30px;">
        <div><b>יעד המשלוח:</b> ${dlv.destination}</div>
        <div><b>שם הנהג/מוביל:</b> ${dlv.driver || '_________________'}</div>
      </div>
      
      <table>
        <tr>
          <th style="width:50px">#</th>
          <th>תיאור הציוד</th>
          <th style="width:100px">כמות</th>
          <th>הערות / ברקוד</th>
        </tr>
        ${dlv.items.map((item, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${item.desc}</td>
            <td>${item.qty}</td>
            <td>${item.note || ''}</td>
          </tr>
        `).join('')}
      </table>
      
      ${dlv.notes ? `<div style="margin-top:30px"><b>הערות כלליות:</b><br>${dlv.notes.replace(/\\n/g, '<br>')}</div>` : ''}
      
      <div class="signature">
        <div class="sig-line">חתימת הנהג</div>
        <div class="sig-line">חתימת המקבל</div>
      </div>
    </body>
    </html>
  `);
}

// Attach renderer to SPT
const originalSPT = window.SPT;
window.SPT = function(t) {
  if (originalSPT) originalSPT(t);
  if (t === 'porders') renderPurchOrders();
  if (t === 'pdeliveries') renderPurchDeliveries();
}

function addNoteToOrder(text) {
  const notes = document.getElementById('om-notes');
  if (notes) {
    if (notes.value.trim() !== '') {
      notes.value += '\n' + text;
    } else {
      notes.value = text;
    }
  }
}

function renderPurchNotesButtons() {
  const container = document.getElementById('om-notes-buttons');
  if (!container) return;
  const notes = window.PURCH_NOTES || ['נא לצרף חשבונית מס מקורית', 'נא לתאם הגעה מראש עם איש הקשר', 'המחיר כולל משלוח עד לכתובת', 'תנאי תשלום: שוטף + 30'];
  let html = '';
  notes.forEach((n, i) => {
    // Avoid quotes issues by using text content directly in HTML
    const safeText = n.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const shortText = n.length > 20 ? n.substring(0,20)+'...' : n;
    html += `<button class="btn bo bsm" onclick="addNoteToOrder('${safeText}')">➕ ${shortText}</button>`;
  });
  html += `<button class="btn bw bsm" onclick="editPurchNotes()" title="ערוך הערות נפוצות">✏️ ערוך</button>`;
  container.innerHTML = html;
}

function editPurchNotes() {
  const notes = window.PURCH_NOTES || ['נא לצרף חשבונית מס מקורית', 'נא לתאם הגעה מראש עם איש הקשר', 'המחיר כולל משלוח עד לכתובת', 'תנאי תשלום: שוטף + 30'];
  
  let modal = document.getElementById('purch-notes-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'purch-notes-modal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
  
  const notesHtml = notes.map((n) => `
    <div style="display:flex; gap:8px; margin-bottom:8px;" class="pn-item">
      <input type="text" class="pn-input" value="${n.replace(/"/g, '&quot;')}" style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px; font-size:14px;">
      <button class="btn br" onclick="this.parentElement.remove()" title="מחק הערה">🗑️</button>
    </div>
  `).join('');

  modal.innerHTML = `
    <div class="modal-box" style="width:500px; max-width:90vw; background:#fff; border-radius:12px; padding:20px; box-shadow:0 10px 40px rgba(0,0,0,0.2);">
      <h3 style="margin:0 0 10px 0;color:#1a237e">✏️ ערוך הערות נפוצות</h3>
      <p style="font-size:0.9em;color:#666;margin-bottom:15px;">כל שורה כאן תהפוך לכפתור בחירת הערה במסך ההזמנה:</p>
      
      <div id="pn-list-container" style="max-height: 350px; overflow-y: auto; padding-right: 5px; margin-bottom: 10px;">
        ${notesHtml}
      </div>
      
      <button class="btn bg bsm" onclick="addPurchNoteInput()">➕ הוסף הערה חדשה</button>
      
      <div style="display:flex;justify-content:flex-end;margin-top:25px;gap:10px;border-top:1px solid #eee;padding-top:15px;">
        <button class="btn bo" onclick="document.getElementById('purch-notes-modal').style.display='none'">ביטול</button>
        <button class="btn bp" onclick="savePurchNotes()">שמור שינויים</button>
      </div>
    </div>
  `;
}

window.addPurchNoteInput = function() {
  const container = document.getElementById('pn-list-container');
  const div = document.createElement('div');
  div.style.cssText = "display:flex; gap:8px; margin-bottom:8px;";
  div.className = "pn-item";
  div.innerHTML = `
    <input type="text" class="pn-input" value="" placeholder="הזן הערה חדשה..." style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px; font-size:14px;">
    <button class="btn br" onclick="this.parentElement.remove()" title="מחק הערה">🗑️</button>
  `;
  container.appendChild(div);
  div.querySelector('input').focus();
};

function savePurchNotes() {
  const inputs = document.querySelectorAll('.pn-input');
  const textArray = [];
  inputs.forEach(inp => {
    if (inp.value.trim()) textArray.push(inp.value.trim());
  });
  window.PURCH_NOTES = textArray;
  document.getElementById('purch-notes-modal').style.display='none';
  renderPurchNotesButtons();
  if (typeof window.ghAutoSave === 'function') window.ghAutoSave(true);
}

function renderPurchOrderersButtons() {
  const container = document.getElementById('om-orderer-buttons');
  if (!container) return;
  const orderers = window.PURCH_ORDERERS || ['פרי', 'שרית', 'קארין'];
  let html = '';
  orderers.forEach(o => {
    html += `<button class="btn bg bsm" onclick="setPurchOrderer(this)" data-val="${o.replace(/"/g, '&quot;')}" title="הוסף מזמין">➕ ${o.split('\n')[0]}</button>`;
  });
  html += `<button class="btn bw bsm" onclick="editPurchOrderers()" title="ערוך מזמינים נפוצים">✏️ ערוך</button>`;
  container.innerHTML = html;
}

window.setPurchOrderer = function(btn) {
  const el = document.getElementById('om-orderer');
  if (el) el.value = btn.getAttribute('data-val') || '';
};

function editPurchOrderers() {
  const orderers = window.PURCH_ORDERERS || ['פרי', 'שרית', 'קארין'];
  
  let modal = document.getElementById('purch-orderers-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'purch-orderers-modal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
  
  const listHtml = orderers.map((o) => `
    <div style="display:flex; gap:8px; margin-bottom:8px;" class="po-item">
      <textarea class="po-input" style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px; font-size:14px; resize:vertical;" rows="2">${o}</textarea>
      <button class="btn br" onclick="this.parentElement.remove()" title="מחק מזמין">🗑️</button>
    </div>
  `).join('');

  modal.innerHTML = `
    <div class="modal-box" style="width:500px; max-width:90vw; background:#fff; border-radius:12px; padding:20px; box-shadow:0 10px 40px rgba(0,0,0,0.2);">
      <h3 style="margin:0 0 10px 0;color:#1a237e">✏️ ערוך מזמינים נפוצים</h3>
      <p style="font-size:0.9em;color:#666;margin-bottom:15px;">כל שורה כאן תהפוך לכפתור בחירת מזמין במסך ההזמנה:</p>
      
      <div id="po-list-container" style="max-height: 350px; overflow-y: auto; padding-right: 5px; margin-bottom: 10px;">
        ${listHtml}
      </div>
      
      <button class="btn bg bsm" onclick="addPurchOrdererInput()">➕ הוסף מזמין חדש</button>
      
      <div style="display:flex;justify-content:flex-end;margin-top:25px;gap:10px;border-top:1px solid #eee;padding-top:15px;">
        <button class="btn bo" onclick="document.getElementById('purch-orderers-modal').style.display='none'">ביטול</button>
        <button class="btn bp" onclick="savePurchOrderers()">שמור שינויים</button>
      </div>
    </div>
  `;
}

window.addPurchOrdererInput = function() {
  const container = document.getElementById('po-list-container');
  const div = document.createElement('div');
  div.style.cssText = "display:flex; gap:8px; margin-bottom:8px;";
  div.className = "po-item";
  div.innerHTML = `
    <textarea class="po-input" placeholder="שם&#10;תפקיד..." style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px; font-size:14px; resize:vertical;" rows="2"></textarea>
    <button class="btn br" onclick="this.parentElement.remove()" title="מחק מזמין">🗑️</button>
  `;
  container.appendChild(div);
  div.querySelector('textarea').focus();
};

function savePurchOrderers() {
  const inputs = document.querySelectorAll('.po-input');
  const textArray = [];
  inputs.forEach(inp => {
    if (inp.value.trim()) textArray.push(inp.value.trim());
  });
  window.PURCH_ORDERERS = textArray;
  document.getElementById('purch-orderers-modal').style.display='none';
  renderPurchOrderersButtons();
  if (typeof window.ghAutoSave === 'function') window.ghAutoSave(true);
}

function editPurchFooter() {
  const defaultFooter = `טומשין-עושים חינוך אחרת בע"מ (חל"צ) – רשת צהרונים
הנהלה ראשית: רח' איינשטיין 18 קומה ב', נס ציונה, ת.ד. 2318, מיקוד 7403622, טל: 03-9689119 פקס: 039689120
www.tomashin.co.il  www.tomashin-kids.co.il`;
  const footer = window.PURCH_FOOTER || defaultFooter;
  
  let modal = document.getElementById('purch-footer-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'purch-footer-modal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
  
  modal.innerHTML = `
    <div class="modal-box" style="width:500px; max-width:90vw; background:#fff; border-radius:12px; padding:20px; box-shadow:0 10px 40px rgba(0,0,0,0.2);">
      <h3 style="margin:0 0 10px 0;color:#1a237e">✏️ ערוך כותרת תחתונה בהדפסה</h3>
      <p style="font-size:0.9em;color:#666;margin-bottom:15px;">הטקסט יופיע בתחתית כל עמוד מודפס. השורה הראשונה תודגש בירוק.</p>
      
      <textarea id="pf-edit-text" rows="5" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:5px;resize:vertical;font-size:14px;white-space:pre-wrap;">${footer}</textarea>
      
      <div style="display:flex;justify-content:flex-end;margin-top:25px;gap:10px;border-top:1px solid #eee;padding-top:15px;">
        <button class="btn bo" onclick="document.getElementById('purch-footer-modal').style.display='none'">ביטול</button>
        <button class="btn bp" onclick="savePurchFooter()">שמור שינויים</button>
      </div>
    </div>
  `;
}

function savePurchFooter() {
  const text = document.getElementById('pf-edit-text').value;
  window.PURCH_FOOTER = text.trim() || null;
  document.getElementById('purch-footer-modal').style.display='none';
  if (typeof window.ghAutoSave === 'function') window.ghAutoSave(true);
}
