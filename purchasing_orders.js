// purchasing_orders.js - Handles Purchase Orders (הזמנות רכש) and Delivery Notes (תעודות משלוח)

window.poSearchQuery = '';
window.pdSearchQuery = '';

let _poSearchTimer = null;
window.poDoSearch = function(val) {
  window.poSearchQuery = (val || '').trim().toLowerCase();
  clearTimeout(_poSearchTimer);
  _poSearchTimer = setTimeout(() => {
    renderPurchOrders();
  }, 200);
};

let _pdSearchTimer = null;
window.pdDoSearch = function(val) {
  window.pdSearchQuery = (val || '').trim().toLowerCase();
  clearTimeout(_pdSearchTimer);
  _pdSearchTimer = setTimeout(() => {
    renderPurchDeliveries();
  }, 200);
};

function renderPurchOrders() {
  const container = document.getElementById('porders-list');
  if (!container) return;

  const orders = window.ORDERS || [];
  if (orders.length === 0) {
    container.innerHTML = '<div style="color:#aaa;font-size:.8rem;text-align:center;padding:20px">אין הזמנות עדיין</div>';
    return;
  }

  let sorted = [...orders];
  if (window.poSearchQuery) {
    const q = window.poSearchQuery;
    sorted = sorted.filter(o => {
      const itemsStr = (o.items || []).map(i => i.desc || '').join(' ');
      const txt = `${o.orderId || ''} ${o.supplier || ''} ${o.orderDesc || ''} ${o.notes || ''} ${itemsStr}`.toLowerCase();
      return txt.includes(q);
    });
  }

  sorted.sort((a, b) => b.ts - a.ts);

  if (sorted.length === 0) {
    container.innerHTML = '<div style="color:#aaa;font-size:.8rem;text-align:center;padding:20px">אין הזמנות התואמות לחיפוש</div>';
    return;
  }

  let html = '<table class="stable" style="width:100%"><thead><tr>' +
    '<th>תאריך</th>' +
    '<th>מספר הזמנה</th>' +
    '<th>לכבוד</th>' +
    '<th>תיאור</th>' +
    '<th>סה"כ (₪)</th>' +
    '<th>פעולות</th>' +
    '</tr></thead><tbody>';

  sorted.forEach(o => {
    const dStr = new Date(o.ts).toLocaleDateString('he-IL');
    html += `<tr>
      <td>${dStr}</td>
      <td style="font-weight:bold">${o.orderId}</td>
      <td>${o.supplier}</td>
      <td>${(o.orderDesc || (o.items && o.items.length > 0 ? o.items[0].desc.split('\n')[0] : '')).replace(/</g, '&lt;')}</td>
      <td style="color:#2e7d32;font-weight:bold">${o.totalPrice.toFixed(2)}</td>
      <td>
        <button class="btn bo bsm" onclick="editOrder('${o.id}')">✏️ ערוך</button>
        <button class="btn bo bsm" onclick="duplicateOrder('${o.id}')">📋 שכפל</button>
        <button class="btn bo bsm" onclick="printOrder('${o.id}')">🖨️ הדפס</button>
        <button class="btn bo bsm" onclick="downloadOrder('${o.id}')">📄 הורד</button>
        <button class="btn bo bsm" onclick="approveOrderToInvoice('${o.id}')" style="background:#4caf50;color:white;border:none;">✅ הפק למעקב</button>
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

  let sorted = [...deliveries];
  if (window.pdSearchQuery) {
    const q = window.pdSearchQuery;
    sorted = sorted.filter(d => {
      const itemsStr = (d.items || []).map(i => i.desc || '').join(' ');
      const txt = `${d.deliveryId || ''} ${d.destination || ''} ${d.deliveryDesc || ''} ${d.driver || ''} ${d.recipient || ''} ${d.notes || ''} ${itemsStr}`.toLowerCase();
      return txt.includes(q);
    });
  }

  sorted.sort((a, b) => b.ts - a.ts);

  if (sorted.length === 0) {
    container.innerHTML = '<div style="color:#aaa;font-size:.8rem;text-align:center;padding:20px">אין תעודות משלוח התואמות לחיפוש</div>';
    return;
  }

  let html = '<table class="stable" style="width:100%"><thead><tr>' +
    '<th>תאריך</th>' +
    '<th>מספר תעודה</th>' +
    '<th>יעד (רכז/שטח)</th>' +
    '<th>תיאור</th>' +
    '<th>נהג/מוביל</th>' +
    '<th>פעולות</th>' +
    '</tr></thead><tbody>';

  sorted.forEach(d => {
    const dStr = new Date(d.ts).toLocaleDateString('he-IL');
    html += `<tr>
      <td>${dStr}</td>
      <td style="font-weight:bold">${d.deliveryId}</td>
      <td>${d.destination}</td>
      <td>${d.deliveryDesc || ''}</td>
      <td>${d.driver || ''}</td>
      <td>
        ${d.spLink ? `<a href="${d.spLink}" target="_blank" class="btn bo bsm" style="text-decoration:none;background:#e3f2fd;color:#1565c0;border-color:#1565c0" title="פתח מסמך מקורי">📂 פתח מסמך</a>
        <button class="btn bo bsm" onclick="spUndoDeliveryMatch('${d.id}')" style="color:red;border:none;background:transparent;font-size:0.8rem;padding:0;min-width:auto;margin-left:5px" title="בטל שיוך">✖</button>` : ''}
        <button class="btn bo bsm" onclick="editDelivery('${d.id}')">✏️ ערוך</button>
        <button class="btn bo bsm" onclick="duplicateDelivery('${d.id}')">📋 שכפל</button>
        <button class="btn bo bsm" onclick="printDelivery('${d.id}')">🖨️ הדפס</button>
        <button class="btn bo bsm" onclick="downloadDelivery('${d.id}')">📄 הורד</button>
        <button class="btn br bsm" onclick="deletePurchDelivery('${d.id}')" style="background:#e53935;color:white;border:none;">🗑️ מחק</button>
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
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = String(today.getFullYear());

  const deliveriesToday = (window.DELIVERIES || []).filter(d => {
    const dt = new Date(d.ts);
    return dt.getDate() === today.getDate() && dt.getMonth() === today.getMonth() && dt.getFullYear() === today.getFullYear();
  });

  const seq = String(deliveriesToday.length + 1).padStart(2, '0');
  return `DLV-${seq}${day}${month}${year}`;
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

      <div style="margin-bottom:12px; background:#f5f5f5; padding:8px 12px; border-radius:6px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <span style="font-size:0.85rem; font-weight:bold; color:#3f51b5; white-space:nowrap;">📋 טען מתוך הזמנה קודמת / תבנית:</span>
        <select id="om-template-select" style="padding:4px 8px; border-radius:4px; border:1px solid #ccc; width:100%; max-width:400px; font-size:0.85rem;" onchange="loadOrderTemplate(this.value)">
          <option value="">-- בחר הזמנה לשכפול נתונים --</option>
          ${(window.ORDERS || []).map(o => `<option value="${o.id}">${o.orderId} - ${o.supplier} (${new Date(o.ts).toLocaleDateString('he-IL')}) - &#8362;${o.totalPrice ? o.totalPrice.toFixed(0) : 0}</option>`).join('')}
        </select>
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
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;background:#e8f5e9;padding:6px 8px;border-radius:6px;border:1px solid #c8e6c9;">
            <b style="color:#2e7d32;font-size:0.95rem;">כמות ערכות:</b>
            <input type="number" id="om-kits-count" value="1" min="1" step="1" style="width:70px;text-align:center;font-weight:bold;font-size:1rem;" onchange="omCalc()" oninput="omCalc()">
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:5px">
            <span>סה"כ ביניים (לערכה):</span>
            <span id="om-subtotal" style="font-weight:bold">0.00 ₪</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
            <span>הנחה לערכה (₪):</span>
            <input type="number" id="om-discount" value="0" min="0" step="0.01" style="width:80px;text-align:center" onchange="omCalc()" oninput="omCalc()">
          </div>
          <div id="om-kits-summary-row" style="display:none;flex-direction:column;gap:3px;margin-top:5px;margin-bottom:5px;padding:6px;background:#ffffff;border-radius:6px;border:1px solid #ded;font-size:0.85rem;color:#333;">
            <div style="display:flex;justify-content:space-between;font-weight:bold;color:#2e7d32;">
              <span>סה"כ לפני מע"מ (<span id="om-kits-lbl">1</span> ערכות):</span>
              <span id="om-kits-total">0.00 ₪</span>
            </div>
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
  let subtotalPerKit = 0;
  
  Array.from(tbody.children).forEach((tr, index) => {
    const numEl = tr.querySelector('.om-row-num');
    if (numEl) numEl.innerText = index + 1;
    
    const qty = parseFloat(tr.querySelector('.om-qty').value) || 0;
    const price = parseFloat(tr.querySelector('.om-price').value) || 0;
    const rowTot = qty * price;
    tr.querySelector('.om-row-total').innerText = rowTot.toFixed(2) + ' ₪';
    subtotalPerKit += rowTot;
  });
  
  const discountInput = document.getElementById('om-discount');
  const discountPerKit = discountInput ? (parseFloat(discountInput.value) || 0) : 0;
  
  let taxablePerKit = subtotalPerKit - discountPerKit;
  if (taxablePerKit < 0) taxablePerKit = 0;

  const kitsInput = document.getElementById('om-kits-count');
  const kitsCount = kitsInput ? (parseInt(kitsInput.value) || 1) : 1;

  let grandTaxable = taxablePerKit * kitsCount;

  const vatInput = document.getElementById('om-vat-rate');
  const vatRate = vatInput ? (parseFloat(vatInput.value) || 0) : (window.VAT_RATE || 18);
  const vat = grandTaxable * (vatRate / 100);
  const total = grandTaxable + vat;
  
  document.getElementById('om-subtotal').innerText = subtotalPerKit.toFixed(2) + ' ₪';
  
  const kitsSummaryRow = document.getElementById('om-kits-summary-row');
  if (kitsSummaryRow) {
    if (kitsCount > 1) {
      kitsSummaryRow.style.display = 'flex';
      const lblEl = document.getElementById('om-kits-lbl');
      if (lblEl) lblEl.innerText = kitsCount;
      const totEl = document.getElementById('om-kits-total');
      if (totEl) totEl.innerText = grandTaxable.toFixed(2) + ' ₪';
    } else {
      kitsSummaryRow.style.display = 'none';
    }
  }

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

  const kitsInput = document.getElementById('om-kits-count');
  const kitsCount = kitsInput ? (parseInt(kitsInput.value) || 1) : 1;

  let grandTaxable = taxable * kitsCount;

  let vatRate = parseFloat(document.getElementById('om-vat-rate').value) || (window.VAT_RATE || 18);
  let vat = grandTaxable * (vatRate / 100);
  let total = grandTaxable + vat;
  
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
    kitsCount: kitsCount,
    vatRate: vatRate,
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

window.loadOrderTemplate = function(id) {
  if (!id) return;
  const order = (window.ORDERS || []).find(o => o.id === id);
  if (!order) return;
  
  if (confirm(`האם לטעון את פרטי הזמנה ${order.orderId} (${order.supplier}) לתוך ההזמנה הנוכחית?`)) {
    document.getElementById('om-supplier').value = order.supplier || '';
    const ordererEl = document.getElementById('om-orderer');
    if(ordererEl) ordererEl.value = order.orderer || '';
    const descEl = document.getElementById('om-orderdesc');
    if(descEl) descEl.value = order.orderDesc || '';
    const suffixEl = document.getElementById('om-titlesuffix');
    if(suffixEl) suffixEl.value = order.titleSuffix || '';
    document.getElementById('om-notes').value = order.notes || '';
    if (order.discount !== undefined) {
      const discEl = document.getElementById('om-discount');
      if (discEl) discEl.value = order.discount;
    }
    if (order.vatRate !== undefined) {
      const vatEl = document.getElementById('om-vat-rate');
      if (vatEl) vatEl.value = order.vatRate;
    }
    
    const tbody = document.getElementById('om-items-body');
    tbody.innerHTML = '';
    if (order.items && order.items.length > 0) {
      order.items.forEach(item => {
        omAddItemRow(item.desc, item.qty, item.price);
      });
    } else {
      omAddItemRow();
    }
    omCalc();
    showToast(`📋 נתוני הזמנה ${order.orderId} נטענו בהצלחה!`);
  }
  document.getElementById('om-template-select').value = '';
};

window.duplicateCurrentOrder = function() {
  const newId = 'ord_' + Date.now();
  const newOrderId = generateOrderId();
  
  document.getElementById('om-orderid').value = newOrderId;
  document.getElementById('om-date').value = new Date().toISOString().split('T')[0];
  
  const titleEl = document.querySelector('#order-modal h2');
  if (titleEl) titleEl.innerHTML = `📦 שכפול הזמנה - הזמנה חדשה ${newOrderId}`;

  const saveBtn = document.querySelector('#order-modal .btn.bp');
  if (saveBtn) saveBtn.setAttribute('onclick', `saveOrder('${newId}')`);
  
  const dupBtn = document.getElementById('btn-dup-current');
  if (dupBtn) dupBtn.remove();
  
  showToast(`📋 ההזמנה שוכפלה בהצלחה! נוצר מספר הזמנה חדש: ${newOrderId}. לחץ על שמור להשלמה.`);
};

function editOrder(id) {
  const order = (window.ORDERS || []).find(o => o.id === id);
  if (!order) return;
  
  openNewOrder();
  
  const titleEl = document.querySelector('#order-modal h2');
  if (titleEl) titleEl.innerHTML = `✏️ עריכת הזמנה ${order.orderId}`;
  
  // Override fields with existing data
  document.getElementById('om-orderid').value = order.orderId;
  document.getElementById('om-date').value = new Date(order.ts).toISOString().split('T')[0];
  document.getElementById('om-supplier').value = order.supplier || '';
  
  const ordererEl = document.getElementById('om-orderer');
  if(ordererEl) ordererEl.value = order.orderer || '';
  
  const descEl = document.getElementById('om-orderdesc');
  if(descEl) descEl.value = order.orderDesc || '';

  const suffixEl = document.getElementById('om-titlesuffix');
  if(suffixEl) suffixEl.value = order.titleSuffix || '';
  
  document.getElementById('om-notes').value = order.notes || '';

  if (order.discount !== undefined) {
    const discEl = document.getElementById('om-discount');
    if (discEl) discEl.value = order.discount;
  }
  if (order.vatRate !== undefined) {
    const vatEl = document.getElementById('om-vat-rate');
    if (vatEl) vatEl.value = order.vatRate;
  }
  
  // Clear items and add existing
  const tbody = document.getElementById('om-items-body');
  tbody.innerHTML = '';
  if (order.items && order.items.length > 0) {
    order.items.forEach(item => {
      omAddItemRow(item.desc, item.qty, item.price);
    });
  } else {
    omAddItemRow();
  }
  
  // Add "📋 שכפל להזמנה חדשה" button to modal action container
  const actionDiv = document.querySelector('#order-modal .modal-box > div:last-child > div:last-child');
  if (actionDiv && !document.getElementById('btn-dup-current')) {
    const dupBtn = document.createElement('button');
    dupBtn.id = 'btn-dup-current';
    dupBtn.className = 'btn bw';
    dupBtn.style.background = '#e8eaf6';
    dupBtn.style.color = '#1a237e';
    dupBtn.style.borderColor = '#3f51b5';
    dupBtn.innerHTML = '📋 שכפל להזמנה חדשה';
    dupBtn.onclick = function() { duplicateCurrentOrder(); };
    actionDiv.insertBefore(dupBtn, actionDiv.lastElementChild);
  }

  // Change save button to use existing ID
  const saveBtn = document.querySelector('#order-modal .btn.bp');
  if (saveBtn) saveBtn.setAttribute('onclick', `saveOrder('${id}')`);
  
  omCalc();
}

function duplicateOrder(id) {
  const order = (window.ORDERS || []).find(o => o.id === id);
  if (!order) return;
  
  openNewOrder();
  
  const newId = 'ord_' + Date.now();
  const newOrderId = generateOrderId();

  const titleEl = document.querySelector('#order-modal h2');
  if (titleEl) titleEl.innerHTML = `📦 שכפול הזמנה - הזמנה חדשה ${newOrderId}`;
  
  document.getElementById('om-orderid').value = newOrderId;
  document.getElementById('om-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('om-supplier').value = order.supplier || '';
  
  const ordererEl = document.getElementById('om-orderer');
  if(ordererEl) ordererEl.value = order.orderer || '';
  
  const descEl = document.getElementById('om-orderdesc');
  if(descEl) descEl.value = order.orderDesc || '';

  const suffixEl = document.getElementById('om-titlesuffix');
  if(suffixEl) suffixEl.value = order.titleSuffix || '';
  
  document.getElementById('om-notes').value = order.notes || '';

  if (order.discount !== undefined) {
    const discEl = document.getElementById('om-discount');
    if (discEl) discEl.value = order.discount;
  }
  if (order.vatRate !== undefined) {
    const vatEl = document.getElementById('om-vat-rate');
    if (vatEl) vatEl.value = order.vatRate;
  }
  
  // Clear items and add existing
  const tbody = document.getElementById('om-items-body');
  tbody.innerHTML = '';
  if (order.items && order.items.length > 0) {
    order.items.forEach(item => {
      omAddItemRow(item.desc, item.qty, item.price);
    });
  } else {
    omAddItemRow();
  }

  const saveBtn = document.querySelector('#order-modal .btn.bp');
  if (saveBtn) saveBtn.setAttribute('onclick', `saveOrder('${newId}')`);
  
  omCalc();
  showToast(`📋 הפרטים שוכפלו בהצלחה להזמנה חדשה (מספר ${newOrderId}). לחץ על "שמור הזמנה" כדי לשמור אותה.`);
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

  const kitsInput = document.getElementById('om-kits-count');
  const kitsCount = kitsInput ? (parseInt(kitsInput.value) || 1) : 1;
  let grandTaxable = taxable * kitsCount;

  const vatInput = document.getElementById('om-vat-rate');
  const vatRate = vatInput ? (parseFloat(vatInput.value) || 0) : (window.VAT_RATE || 18);
  let vat = grandTaxable * (vatRate / 100);
  let total = grandTaxable + vat;
  
  const orderDateStr = document.getElementById('om-date').value;
  const ts = orderDateStr ? new Date(orderDateStr).getTime() : Date.now();
  const orderDesc = document.getElementById('om-orderdesc') ? document.getElementById('om-orderdesc').value.trim() : '';
  const titleSuffix = document.getElementById('om-titlesuffix') ? document.getElementById('om-titlesuffix').value.trim() : '';
  const orderer = document.getElementById('om-orderer') ? document.getElementById('om-orderer').value.trim() : '';

  const order = {
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
    kitsCount: kitsCount,
    vatRate: vatRate,
    vat: vat,
    totalPrice: total
  };
  
  openOrderPrintPreview(order);
}

function openOrderPrintPreview(order, autoDownload = false) {
  const defaultFooter = `טומשין-עושים חינוך אחרת בע"מ (חל"צ) – רשת צהרונים\nהנהלה ראשית: רח' איינשטיין 18 קומה ב', נס ציונה, ת.ד. 2318, מיקוד 7403622, טל: 03-9689119 פקס: 039689120\nwww.tomashin.co.il  www.tomashin-kids.co.il`;
  
  const rtlFix = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '״')
      .replace(/'/g, '׳');
  };

  const footerLines = (window.PURCH_FOOTER || defaultFooter).split('\n').map(l => rtlFix(l.trim())).filter(l => l);
  let footerHtml = '';
  if (footerLines.length > 0) {
    footerHtml += `<b style="color: #2e7d32; font-size: 1.1em;">${footerLines[0]}</b><br>`;
    if (footerLines.length > 1) {
      footerHtml += footerLines.slice(1).join(' | ');
    }
  }

  let descPart = '';
  if (order.orderDesc && order.orderDesc.trim()) {
    descPart = order.orderDesc.trim();
  } else if (order.items && order.items.length > 0 && order.items[0].desc) {
    descPart = order.items[0].desc.trim().split('\n')[0];
  }
  if (descPart.length > 30) descPart = descPart.substring(0, 30);

  let titleParts = [];
  if (order.supplier) titleParts.push(order.supplier);
  if (descPart) titleParts.push(descPart);
  if (order.orderId) titleParts.push(order.orderId);
  if (titleParts.length === 0) titleParts.push('הזמנת רכש');

  let rawTitle = titleParts.join(' - ');
  rawTitle = rawTitle.replace(/["'\\/]/g, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
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
      const kitsCount = order.kitsCount || 1;
      const subtotalPerKit = order.subtotal || 0;
      const discountPerKit = order.discount || 0;
      const taxablePerKit = Math.max(0, subtotalPerKit - discountPerKit);
      const totalTaxable = taxablePerKit * kitsCount;

      let kitsBreakdownHtml = '';
      if (kitsCount > 1) {
        kitsBreakdownHtml = `
          <p style="margin:4px 0; text-align:center;"><span style="font-weight:bold; margin-left:5px;">סה"כ לערכה בודדת:&rlm;</span><span dir="ltr">&#8362; ${subtotalPerKit.toFixed(2)}</span></p>
          ${discountPerKit ? `<p style="margin:4px 0; color:#d32f2f; text-align:center;"><span style="font-weight:bold; margin-left:5px;">הנחה לערכה:&rlm;</span><span dir="ltr">- &#8362; ${discountPerKit.toFixed(2)}</span></p>` : ''}
          <p style="margin:6px 0; background:#f1f8e9; padding:4px 12px; border-radius:4px; display:inline-block; border:1px solid #c8e6c9; text-align:center;">
            <span style="font-weight:bold; margin-left:5px; color:#2e7d32;">כמות ערכות:&rlm;</span><span style="font-weight:bold; font-size:1.1em; color:#2e7d32;">${kitsCount}</span>
          </p>
          <p style="margin:4px 0; text-align:center;"><span style="font-weight:bold; margin-left:5px;">סה"כ (${kitsCount} ערכות):&rlm;</span><span dir="ltr" style="font-weight:bold;">&#8362; ${totalTaxable.toFixed(2)}</span></p>
        `;
      } else {
        kitsBreakdownHtml = `
          <p style="margin:5px 0; text-align:center;"><span style="font-weight:bold; margin-left:5px;">סה"כ:&rlm;</span><span dir="ltr">&#8362; ${subtotalPerKit.toFixed(2)}</span></p>
          ${discountPerKit ? `<p style="margin:5px 0; color:#d32f2f; text-align:center;"><span style="font-weight:bold; margin-left:5px;">הנחה:&rlm;</span><span dir="ltr">- &#8362; ${discountPerKit.toFixed(2)}</span></p>` : ''}
        `;
      }

      footerContentHtml = `
        <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
          <div style="display: flex; flex-direction: column; align-items: center; text-align: center; font-size:0.95em; min-width:220px; background:#fafafa; padding:12px 18px; border-radius:8px; border:1px solid #eee;">
            ${kitsBreakdownHtml}
            <p style="margin:4px 0; text-align:center;"><span style="font-weight:bold; margin-left:5px;">${Math.round((order.vat/(totalTaxable || 1))*100) || 18}% מע"מ:</span><span dir="ltr">&#8362; ${order.vat.toFixed(2)}</span></p>
            <h3 style="color:#2e7d32; margin:8px 0 0 0; text-align:center;"><span style="font-weight:bold; margin-left:5px;">סה"כ לתשלום:&rlm;</span><span dir="ltr">&#8362; ${order.totalPrice.toFixed(2)}</span></h3>
          </div>
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

      <div style="margin-bottom:12px; background:#f5f5f5; padding:8px 12px; border-radius:6px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <span style="font-size:0.85rem; font-weight:bold; color:#3f51b5; white-space:nowrap;">📋 טען מתוך תעודה קודמת / תבנית:</span>
        <select id="dm-template-select" style="padding:4px 8px; border-radius:4px; border:1px solid #ccc; width:100%; max-width:400px; font-size:0.85rem;" onchange="loadDeliveryTemplate(this.value)">
          <option value="">-- בחר תעודת משלוח לשכפול נתונים --</option>
          ${(window.DELIVERIES || []).map(d => `<option value="${d.id}">${d.deliveryId} - ${d.destination} (${new Date(d.ts).toLocaleDateString('he-IL')})</option>`).join('')}
        </select>
      </div>
      
      <div class="row" style="margin-bottom:10px">
        <div style="flex:1">
          <label>מספר תעודה:</label>
          <input type="text" id="dm-deliveryid" value="${deliveryId}" class="in-date" style="font-weight:bold">
        </div>
        <div style="flex:1">
          <label>תאריך:</label>
          <input type="date" id="dm-date" value="${new Date().toISOString().split('T')[0]}" class="in-date">
        </div>
      </div>
      
      <div class="row" style="margin-bottom:10px">
        <div style="flex:1">
          <label>יעד (רכז/שטח/ספק):</label>
          <input type="text" id="dm-destination" class="in-date" placeholder="למשל: רכזת ראש העין">
        </div>
        <div style="flex:1">
          <label>תיאור התעודה:</label>
          <input type="text" id="dm-desc" class="in-date" placeholder="למשל: ערכת מדעים / ציוד חוגים">
        </div>
      </div>
      
      <div class="row" style="margin-bottom:10px">
        <div style="flex:1">
          <label>שם המקבל (אופציונלי):</label>
          <input type="text" id="dm-recipient" class="in-date" placeholder="שם המקבל בשטח...">
        </div>
        <div style="flex:1">
          <label>נהג/מוביל:</label>
          <input type="text" id="dm-driver" class="in-date" placeholder="שם הנהג...">
        </div>
      </div>

      <div style="margin-top:20px;border-top:2px solid #eee;padding-top:15px">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h3 style="margin:0;color:#1a237e">📦 ציוד למשלוח</h3>
          <div style="font-size:0.85rem; color:#666;">
            💡 טיפ: אפשר להעתיק שורות באקסל ולהדביק (Ctrl+V) ישר לתוך תיאור השורה הראשונה
          </div>
        </div>
        
        <div style="max-height: 400px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; margin-bottom:10px;">
          <table class="stable" style="width:100%; margin:0;" id="dm-items-table">
            <thead style="position: sticky; top: 0; background: #fff; z-index: 10;">
              <tr>
                <th style="width:35px; text-align:center;">#</th>
                <th>תיאור ציוד</th>
                <th style="width:80px">כמות</th>
                <th style="width:180px">הערות / ברקוד</th>
                <th style="width:50px"></th>
              </tr>
            </thead>
            <tbody id="dm-items-body" onpaste="handleDeliveryTablePaste(event)">
            </tbody>
          </table>
        </div>
        
        <button class="btn bg bsm" style="margin-top:10px" onclick="dmAddItemRow()">➕ הוסף שורת ציוד</button>
      </div>

      <div style="margin-top:20px">
        <label>הערות כלליות למשלוח:</label>
        <textarea id="dm-notes" rows="3" style="width:100%;border:1px solid #ccc;border-radius:5px;padding:8px"></textarea>
      </div>

      <div style="display:flex;justify-content:space-between;margin-top:20px;align-items:center;">
        <button class="btn bw bsm" onclick="editPurchFooter()">✏️ ערוך כותרת תחתונה בהדפסה</button>
        <div style="display:flex;gap:10px">
          <button class="btn bw" onclick="previewDelivery()">👁️ הצג לפני שמירה</button>
          <button class="btn bo" onclick="closeDeliveryModal()">ביטול</button>
          <button class="btn bp" onclick="saveDelivery('${newId}')">💾 שמור תעודת משלוח</button>
        </div>
      </div>
    </div>
  `;
  
  modal.style.display = 'flex';
  dmAddItemRow(); // Add first empty row
}

window.handleDeliveryTablePaste = function(e) {
  if (!e.target.classList.contains('dm-desc')) return;
  const text = (e.clipboardData || window.clipboardData).getData('text');
  if (!text) return;
  
  if (text.indexOf('\n') === -1 && text.indexOf('\t') === -1) return;
  
  e.preventDefault();
  const rows = text.split(/\r?\n/).filter(r => r.trim());
  const currentRow = e.target.closest('tr');
  let firstRow = true;
  
  rows.forEach(row => {
    const cols = row.split(/\t/);
    let desc = cols[0] ? cols[0].trim() : '';
    let qty = 1;
    let note = '';
    
    if (cols.length >= 3) {
      qty = parseFloat((cols[1] || '').replace(/[^\d.-]/g, '')) || 1;
      note = cols[2] ? cols[2].trim() : '';
    } else if (cols.length === 2) {
      qty = parseFloat((cols[1] || '').replace(/[^\d.-]/g, '')) || 1;
    }
    
    if (desc) {
      if (firstRow && currentRow) {
        currentRow.querySelector('.dm-desc').value = desc;
        currentRow.querySelector('.dm-qty').value = qty;
        currentRow.querySelector('.dm-note').value = note;
        firstRow = false;
      } else {
        dmAddItemRow(desc, qty, note);
      }
    }
  });
  dmCalcRowNums();
};

window.dmCalcRowNums = function() {
  const tbody = document.getElementById('dm-items-body');
  if (!tbody) return;
  Array.from(tbody.children).forEach((tr, index) => {
    const numEl = tr.querySelector('.dm-row-num');
    if (numEl) numEl.innerText = index + 1;
  });
};

window.dmDuplicateItemRow = function(rowId) {
  const tr = document.getElementById(rowId);
  if (!tr) return;
  const desc = tr.querySelector('.dm-desc').value;
  const qty = parseFloat(tr.querySelector('.dm-qty').value) || 1;
  const note = tr.querySelector('.dm-note').value;
  dmAddItemRow(desc, qty, note);
};

function dmAddItemRow(desc='', qty=1, note='') {
  const tbody = document.getElementById('dm-items-body');
  const tr = document.createElement('tr');
  const rowId = 'drow_' + Math.random().toString(36).substr(2, 9);
  tr.id = rowId;
  
  tr.innerHTML = `
    <td class="dm-row-num" style="text-align:center; font-weight:bold; color:#777; vertical-align:middle;"></td>
    <td><input type="text" class="dm-desc in-date" value="${desc.replace(/"/g, '&quot;')}" style="width:100%" placeholder="שם הציוד/פריט..."></td>
    <td><input type="number" class="dm-qty in-date" value="${qty}" min="1" style="width:100%"></td>
    <td><input type="text" class="dm-note in-date" value="${note.replace(/"/g, '&quot;')}" style="width:100%" placeholder="הערות / ברקוד"></td>
    <td style="white-space:nowrap;">
      <button type="button" class="btn bw bsm" onclick="dmDuplicateItemRow('${rowId}')" title="שכפל שורה">+</button>
      <button type="button" class="btn bo bsm" onclick="document.getElementById('${rowId}').remove(); dmCalcRowNums();" title="מחק שורה">🗑️</button>
    </td>
  `;
  tbody.appendChild(tr);
  dmCalcRowNums();
}

function closeDeliveryModal() {
  const modal = document.getElementById('delivery-modal');
  if (modal) modal.style.display = 'none';
}

window.loadDeliveryTemplate = function(id) {
  if (!id) return;
  const dlv = (window.DELIVERIES || []).find(d => d.id === id);
  if (!dlv) return;
  
  if (confirm(`האם לטעון את פרטי תעודת משלוח ${dlv.deliveryId} (${dlv.destination}) לתוך התעודה הנוכחית?`)) {
    document.getElementById('dm-destination').value = dlv.destination || '';
    document.getElementById('dm-desc').value = dlv.deliveryDesc || '';
    document.getElementById('dm-recipient').value = dlv.recipient || '';
    document.getElementById('dm-driver').value = dlv.driver || '';
    document.getElementById('dm-notes').value = dlv.notes || '';
    
    const tbody = document.getElementById('dm-items-body');
    tbody.innerHTML = '';
    if (dlv.items && dlv.items.length > 0) {
      dlv.items.forEach(item => {
        dmAddItemRow(item.desc, item.qty, item.note);
      });
    } else {
      dmAddItemRow();
    }
    showToast(`📋 נתוני תעודה ${dlv.deliveryId} נטענו בהצלחה!`);
  }
  document.getElementById('dm-template-select').value = '';
};

window.duplicateCurrentDelivery = function() {
  const newId = 'dlv_' + Date.now();
  const newDeliveryId = generateDeliveryId();
  
  document.getElementById('dm-deliveryid').value = newDeliveryId;
  document.getElementById('dm-date').value = new Date().toISOString().split('T')[0];
  
  const titleEl = document.querySelector('#delivery-modal h2');
  if (titleEl) titleEl.innerHTML = `🚚 שכפול תעודה - תעודה חדשה ${newDeliveryId}`;

  const saveBtn = document.querySelector('#delivery-modal .btn.bp');
  if (saveBtn) saveBtn.setAttribute('onclick', `saveDelivery('${newId}')`);
  
  const dupBtn = document.getElementById('btn-dup-current-dlv');
  if (dupBtn) dupBtn.remove();
  
  showToast(`📋 תעודת המשלוח שוכפלה בהצלחה! נוצר מספר תעודה חדש: ${newDeliveryId}. לחץ על שמור להשלמה.`);
};

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
    deliveryDesc: document.getElementById('dm-desc').value.trim(),
    recipient: document.getElementById('dm-recipient').value.trim(),
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
  
  const titleEl = document.querySelector('#delivery-modal h2');
  if (titleEl) titleEl.innerHTML = `✏️ עריכת תעודת משלוח ${delivery.deliveryId}`;

  document.getElementById('dm-deliveryid').value = delivery.deliveryId;
  document.getElementById('dm-date').value = new Date(delivery.ts).toISOString().split('T')[0];
  document.getElementById('dm-destination').value = delivery.destination;
  document.getElementById('dm-desc').value = delivery.deliveryDesc || '';
  document.getElementById('dm-recipient').value = delivery.recipient || '';
  document.getElementById('dm-driver').value = delivery.driver || '';
  document.getElementById('dm-notes').value = delivery.notes || '';
  
  const tbody = document.getElementById('dm-items-body');
  tbody.innerHTML = '';
  if (delivery.items && delivery.items.length > 0) {
    delivery.items.forEach(item => {
      dmAddItemRow(item.desc, item.qty, item.note);
    });
  } else {
    dmAddItemRow();
  }

  const actionDiv = document.querySelector('#delivery-modal .modal-box > div:last-child > div:last-child');
  if (actionDiv && !document.getElementById('btn-dup-current-dlv')) {
    const dupBtn = document.createElement('button');
    dupBtn.id = 'btn-dup-current-dlv';
    dupBtn.className = 'btn bw';
    dupBtn.style.background = '#e8eaf6';
    dupBtn.style.color = '#1a237e';
    dupBtn.style.borderColor = '#3f51b5';
    dupBtn.innerHTML = '📋 שכפל לתעודה חדשה';
    dupBtn.onclick = function() { duplicateCurrentDelivery(); };
    actionDiv.insertBefore(dupBtn, actionDiv.lastElementChild);
  }
  
  const saveBtn = document.querySelector('#delivery-modal .btn.bp');
  if (saveBtn) saveBtn.setAttribute('onclick', `saveDelivery('${id}')`);
}

function duplicateDelivery(id) {
  const dlv = (window.DELIVERIES || []).find(d => d.id === id);
  if (!dlv) return;
  
  openNewDelivery();
  
  const newId = 'dlv_' + Date.now();
  const newDeliveryId = generateDeliveryId();

  const titleEl = document.querySelector('#delivery-modal h2');
  if (titleEl) titleEl.innerHTML = `🚚 שכפול תעודה - תעודה חדשה ${newDeliveryId}`;
  
  document.getElementById('dm-deliveryid').value = newDeliveryId;
  document.getElementById('dm-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('dm-destination').value = dlv.destination || '';
  document.getElementById('dm-desc').value = dlv.deliveryDesc || '';
  document.getElementById('dm-recipient').value = dlv.recipient || '';
  document.getElementById('dm-driver').value = dlv.driver || '';
  document.getElementById('dm-notes').value = dlv.notes || '';
  
  const tbody = document.getElementById('dm-items-body');
  tbody.innerHTML = '';
  if (dlv.items && dlv.items.length > 0) {
    dlv.items.forEach(item => {
      dmAddItemRow(item.desc, item.qty, item.note);
    });
  } else {
    dmAddItemRow();
  }

  const saveBtn = document.querySelector('#delivery-modal .btn.bp');
  if (saveBtn) saveBtn.setAttribute('onclick', `saveDelivery('${newId}')`);
  
  showToast(`📋 הפרטים שוכפלו בהצלחה לתעודה חדשה (מספר ${newDeliveryId}). לחץ על "שמור תעודת משלוח" כדי לשמור.`);
}

window.deletePurchOrder = async function(id) {
  if (!confirm('האם אתה בטוח שברצונך למחוק הזמנת רכש זו?')) return;
  
  window.ORDERS = (window.ORDERS || []).filter(o => o.id !== id);
  renderPurchOrders();
  
  if (typeof window.ghAutoSave === 'function') {
    await window.ghAutoSave(true);
  }
  showToast('🗑️ הזמנת הרכש נמחקה בהצלחה!');
};

window.deletePurchDelivery = async function(id) {
  if (!confirm('האם אתה בטוח שברצונך למחוק תעודת משלוח זו?')) return;
  
  window.DELIVERIES = (window.DELIVERIES || []).filter(d => d.id !== id);
  renderPurchDeliveries();
  
  if (typeof window.ghAutoSave === 'function') {
    await window.ghAutoSave(true);
  }
  showToast('🗑️ תעודת המשלוח נמחקה בהצלחה!');
};

function printDelivery(id) {
  const dlv = (window.DELIVERIES || []).find(d => d.id === id);
  if (!dlv) return;
  openDeliveryPrintPreview(dlv, false);
}

window.downloadDelivery = function(id) {
  const dlv = (window.DELIVERIES || []).find(d => d.id === id);
  if (!dlv) return;
  openDeliveryPrintPreview(dlv, true);
};

window.previewDelivery = function() {
  const destination = document.getElementById('dm-destination').value.trim();
  if (!destination) {
    alert('חובה לציין יעד כדי להציג את תעודת המשלוח');
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
  
  const dlv = {
    deliveryId: document.getElementById('dm-deliveryid').value,
    ts: ts,
    destination: destination,
    deliveryDesc: document.getElementById('dm-desc').value.trim(),
    recipient: document.getElementById('dm-recipient').value.trim(),
    driver: document.getElementById('dm-driver').value.trim(),
    notes: document.getElementById('dm-notes').value,
    items: items
  };
  
  openDeliveryPrintPreview(dlv);
};

function openDeliveryPrintPreview(dlv, autoDownload = false) {
  const defaultFooter = `טומשין-עושים חינוך אחרת בע"מ (חל"צ) – רשת צהרונים\nהנהלה ראשית: רח' איינשטיין 18 קומה ב', נס ציונה, ת.ד. 2318, מיקוד 7403622, טל: 03-9689119 פקס: 039689120\nwww.tomashin.co.il  www.tomashin-kids.co.il`;
  
  const rtlFix = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '״')
      .replace(/'/g, '׳');
  };

  const footerLines = (window.PURCH_FOOTER || defaultFooter).split('\n').map(l => rtlFix(l.trim())).filter(l => l);
  let footerHtml = '';
  if (footerLines.length > 0) {
    footerHtml += `<b style="color: #2e7d32; font-size: 1.1em;">${footerLines[0]}</b><br>`;
    if (footerLines.length > 1) {
      footerHtml += footerLines.slice(1).join(' | ');
    }
  }

  let descPart = '';
  if (dlv.notes && dlv.notes.trim()) {
    descPart = dlv.notes.trim().split('\n')[0];
  } else if (dlv.items && dlv.items.length > 0 && dlv.items[0].desc) {
    descPart = dlv.items[0].desc.trim().split('\n')[0];
  }
  if (descPart.length > 30) descPart = descPart.substring(0, 30);

  let titleParts = ['תעודת משלוח'];
  if (dlv.destination) titleParts.push(dlv.destination);
  if (descPart) titleParts.push(descPart);
  if (dlv.deliveryId) titleParts.push(dlv.deliveryId);
  let rawTitle = titleParts.join(' - ');
  rawTitle = rawTitle.replace(/["'\\/]/g, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const titleText = rawTitle.replace(/&/g, '&amp;');

  const getItemLines = (it) => {
    if (!it || !it.desc) return 1;
    const lines = String(it.desc).split('\n').reduce((acc, l) => acc + Math.max(1, Math.ceil(l.length / 42)), 0);
    return Math.max(1, lines);
  };

  const totalLines = dlv.items ? dlv.items.reduce((acc, it) => acc + getItemLines(it), 0) : 0;

  let compactClass = '';
  let MAX_LINES_PER_PAGE = 26;
  let MAX_LINES_PER_PAGE_WITH_TOTALS = 18;

  if (totalLines > 28) {
    compactClass = 'super-compact';
    MAX_LINES_PER_PAGE = 50;
    MAX_LINES_PER_PAGE_WITH_TOTALS = 36;
  } else if (totalLines > 18) {
    compactClass = 'compact';
    MAX_LINES_PER_PAGE = 36;
    MAX_LINES_PER_PAGE_WITH_TOTALS = 26;
  }

  const pages = [];
  let remaining = dlv.items ? [...dlv.items] : [];
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
  const copies = ['מקור', 'עותק'];
  const totalOverallPages = totalPages * 2;
  let pageCounter = 0;

  copies.forEach((copyType) => {
    pages.forEach((pageObj, pageIndex) => {
      pageCounter++;
      const isLastPage = pageObj.hasTotals;
      const isAbsoluteLastPage = pageCounter === totalOverallPages;

      let headerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="text-align:right; font-size:1.1em; font-weight:bold; margin-top:25px; color:#555;">
            ${totalPages > 1 ? `עמוד ${pageIndex + 1} מתוך ${totalPages}` : ''}
          </div>
          <div style="text-align: left; margin-bottom: 10px;">
            <img src="לוגו לאורך - עושים חינוך אחרת (3000 x 750 פיקסל).png" style="max-height:75px; width:auto; object-fit:contain;">
          </div>
        </div>
        <div class="header" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h3 style="margin-top:0; margin-bottom:5px; font-size:1.3em;">תעודת&nbsp;משלוח&nbsp;ציוד</h3>
            <h4 style="margin-top:0; margin-bottom:5px;"><b style="color:#1a237e;">מספר&nbsp;תעודה:&nbsp;</b><span>${rtlFix(dlv.deliveryId)}</span></h4>
          </div>
          <div style="text-align:center;">
            <span style="display:inline-block; padding:4px 18px; border-radius:6px; font-size:1.35em; font-weight:900; letter-spacing:1px; ${copyType === 'מקור' ? 'background:#e8f5e9; color:#1b5e20; border:2px solid #2e7d32;' : 'background:#fff3e0; color:#e65100; border:2px solid #ef6c00;'}">${copyType}</span>
          </div>
          <div style="text-align: left;">
            <p style="margin:0; font-size:1.05em;"><b style="color:#1a237e;">תאריך:&nbsp;</b><span>${new Date(dlv.ts).toLocaleDateString('he-IL')}</span></p>
          </div>
        </div>
        <div style="margin-bottom: 15px; display:flex; justify-content:space-between; font-size:1.05em; background:#f9f9f9; padding:10px 14px; border-radius:6px; border:1px solid #eee; gap:15px; word-spacing:2px;">
          <div><b style="color:#1a237e;">יעד&nbsp;המשלוח:&nbsp;</b><span style="font-weight:600;">${rtlFix(dlv.destination)}</span></div>
          ${dlv.deliveryDesc ? `<div><b style="color:#1a237e;">תיאור:&nbsp;</b><span style="font-weight:600;">${rtlFix(dlv.deliveryDesc)}</span></div>` : ''}
          <div><b style="color:#1a237e;">שם&nbsp;הנהג/מוביל:&nbsp;</b><span style="font-weight:600;">${rtlFix(dlv.driver) || '_________________'}</span></div>
        </div>
      `;

      let tableHtml = '';
      if (pageObj.items.length > 0) {
        tableHtml = `
          <table>
            <tr>
              <th style="width:35px; text-align:center;">#</th>
              <th style="width:auto;">תיאור הציוד</th>
              <th style="width:75px;">כמות</th>
              <th style="width:200px;">הערות / ברקוד</th>
            </tr>
            ${pageObj.items.map((item, idx) => {
              let prevItems = 0;
              for(let i=0; i<pageIndex; i++) prevItems += pages[i].items.length;
              return `
              <tr>
                <td style="text-align:center; vertical-align:top;">${prevItems + idx + 1}</td>
                <td style="word-break:break-word; white-space:pre-wrap; vertical-align:top;">${rtlFix(item.desc).replace(/\n/g, '<br>')}</td>
                <td style="vertical-align:top; text-align:center;">${item.qty}</td>
                <td style="vertical-align:top;">${rtlFix(item.note || '')}</td>
              </tr>
              `;
            }).join('')}
          </table>
        `;
      }

      let footerContentHtml = '';
      if (isLastPage) {
        footerContentHtml = `
          ${dlv.notes ? `<div style="margin-top:20px"><b>הערות כלליות למשלוח:&rlm;</b><br>${rtlFix(dlv.notes).replace(/\n/g, '<br>')}</div>` : ''}
          
          <div style="margin-top: 40px; display: flex; justify-content: flex-end; padding-left: 20px;">
            <div style="display: flex; flex-direction: column; gap: 40px; width: 240px;">
              <div style="border-top: 1px solid #000; text-align: center; padding-top: 5px; font-weight:bold;">
                ${dlv.recipient ? `שם המקבל: ${rtlFix(dlv.recipient)}` : 'שם מלא של המקבל'}
              </div>
              <div style="border-top: 1px solid #000; text-align: center; padding-top: 5px; font-weight:bold;">חתימת המקבל</div>
            </div>
          </div>
        `;
      }

      pagesHtml += `
        <div class="page ${compactClass}" style="${!isAbsoluteLastPage ? 'page-break-after: always;' : ''}">
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
        th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: right; vertical-align: top; word-break: break-word; overflow-wrap: break-word; white-space: pre-wrap; line-height: 1.3; }
        th { background: #f5f5f5; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2e7d32; padding-bottom: 10px; margin-bottom: 10px;}
        
        .compact table { font-size: 0.85em; margin-top: 5px; }
        .compact th, .compact td { padding: 3px 5px; }
        .compact .header { padding-bottom: 5px; margin-bottom: 5px; }
        
        .super-compact table { font-size: 0.75em; margin-top: 2px; }
        .super-compact th, .super-compact td { padding: 2px 3px; }
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

// Attach renderer to SPT
const originalSPT = window.SPT;
window.SPT = function(t) {
  if (originalSPT) originalSPT(t);
  if (t === 'porders') renderPurchOrders();
  if (t === 'pdeliveries') renderPurchDeliveries();
}

window.addNoteToOrder = function(text) {
  const notes = document.getElementById('om-notes');
  if (notes) {
    if (notes.value.trim() !== '') {
      notes.value += '\n' + text;
    } else {
      notes.value = text;
    }
  }
};

window.addNoteToOrderByIndex = function(idx) {
  const notes = window.PURCH_NOTES || ['נא לצרף חשבונית מס מקורית', 'נא לתאם הגעה מראש עם איש הקשר', 'המחיר כולל משלוח עד לכתובת', 'תנאי תשלום: שוטף + 30'];
  const text = notes[idx];
  if (text) {
    window.addNoteToOrder(text);
  }
};

window.renderPurchNotesButtons = function() {
  const container = document.getElementById('om-notes-buttons');
  if (!container) return;
  const notes = window.PURCH_NOTES || ['נא לצרף חשבונית מס מקורית', 'נא לתאם הגעה מראש עם איש הקשר', 'המחיר כולל משלוח עד לכתובת', 'תנאי תשלום: שוטף + 30'];
  let html = '';
  notes.forEach((n, i) => {
    const cleanText = n.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const shortText = cleanText.length > 20 ? cleanText.substring(0,20)+'...' : cleanText;
    html += `<button type="button" class="btn bo bsm" onclick="window.addNoteToOrderByIndex(${i})">➕ ${shortText}</button>`;
  });
  html += `<button type="button" class="btn bw bsm" onclick="window.editPurchNotes()" title="ערוך הערות נפוצות">✏️ ערוך</button>`;
  container.innerHTML = html;
};

window.editPurchNotes = function() {
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
      
      <button class="btn bg bsm" onclick="window.addPurchNoteInput()">➕ הוסף הערה חדשה</button>
      
      <div style="display:flex;justify-content:flex-end;margin-top:25px;gap:10px;border-top:1px solid #eee;padding-top:15px;">
        <button class="btn bo" onclick="document.getElementById('purch-notes-modal').style.display='none'">ביטול</button>
        <button class="btn bp" onclick="window.savePurchNotes()">שמור שינויים</button>
      </div>
    </div>
  `;
};

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

window.savePurchNotes = function() {
  const inputs = document.querySelectorAll('.pn-input');
  const textArray = [];
  inputs.forEach(inp => {
    if (inp.value.trim()) textArray.push(inp.value.trim());
  });
  window.PURCH_NOTES = textArray;
  document.getElementById('purch-notes-modal').style.display='none';
  window.renderPurchNotesButtons();
  if (typeof window.ghAutoSave === 'function') window.ghAutoSave(true);
};

window.renderPurchOrderersButtons = function() {
  const container = document.getElementById('om-orderer-buttons');
  if (!container) return;
  const orderers = window.PURCH_ORDERERS || ['פרי', 'שרית', 'קארין'];
  let html = '';
  orderers.forEach(o => {
    html += `<button type="button" class="btn bg bsm" onclick="window.setPurchOrderer(this)" data-val="${o.replace(/"/g, '&quot;')}" title="הוסף מזמין">➕ ${o.split('\n')[0]}</button>`;
  });
  html += `<button type="button" class="btn bw bsm" onclick="window.editPurchOrderers()" title="ערוך מזמינים נפוצים">✏️ ערוך</button>`;
  container.innerHTML = html;
};

window.setPurchOrderer = function(btn) {
  const el = document.getElementById('om-orderer');
  if (el) el.value = btn.getAttribute('data-val') || '';
};

window.editPurchOrderers = function() {
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
      
      <button class="btn bg bsm" onclick="window.addPurchOrdererInput()">➕ הוסף מזמין חדש</button>
      
      <div style="display:flex;justify-content:flex-end;margin-top:25px;gap:10px;border-top:1px solid #eee;padding-top:15px;">
        <button class="btn bo" onclick="document.getElementById('purch-orderers-modal').style.display='none'">ביטול</button>
        <button class="btn bp" onclick="window.savePurchOrderers()">שמור שינויים</button>
      </div>
    </div>
  `;
};

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

window.savePurchOrderers = function() {
  const inputs = document.querySelectorAll('.po-input');
  const textArray = [];
  inputs.forEach(inp => {
    if (inp.value.trim()) textArray.push(inp.value.trim());
  });
  window.PURCH_ORDERERS = textArray;
  document.getElementById('purch-orderers-modal').style.display='none';
  window.renderPurchOrderersButtons();
  if (typeof window.ghAutoSave === 'function') window.ghAutoSave(true);
};

window.editPurchFooter = function() {
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
        <button class="btn bp" onclick="window.savePurchFooter()">שמור שינויים</button>
      </div>
    </div>
  `;
};

window.savePurchFooter = function() {
  const text = document.getElementById('pf-edit-text').value;
  window.PURCH_FOOTER = text.trim() || null;
  document.getElementById('purch-footer-modal').style.display='none';
  if (typeof window.ghAutoSave === 'function') window.ghAutoSave(true);
};

window.approveOrderToInvoice = function(id) {
  const order = (window.ORDERS || []).find(o => o.id === id);
  if (!order) return;
  
  if (confirm(`האם אתה בטוח שברצונך לאשר את הזמנה ${order.orderId} ולהעביר אותה למעקב חשבוניות?`)) {
    if (!window.INVOICES) window.INVOICES = [];
    
    if (window.INVOICES.some(inv => inv.linkedOrderId === id)) {
      alert('הזמנה זו כבר הועברה למעקב חשבוניות בעבר.');
      return;
    }

    let descPart = '';
    if (order.orderDesc && order.orderDesc.trim()) {
      descPart = order.orderDesc.trim();
    } else if (order.items && order.items.length > 0 && order.items[0].desc) {
      descPart = order.items[0].desc.trim().split('\n')[0];
    }
    
    const amt = parseFloat(order.totalPrice) || 0;
    const vat = parseFloat(order.vat) || 0;
    const rawAmt = amt - vat;
    
    const inv = {
      id: Date.now(),
      ts: Date.now(),
      supName: order.supplier,
      orderNum: order.orderId,
      txNum: '',
      num: '',
      orderDesc: descPart,
      orderAmt: rawAmt.toFixed(2),
      orderVat: vat.toFixed(2),
      orderTot: amt.toFixed(2),
      status: 'order',
      linkedOrderId: id,
      orderMonth: new Date(order.ts).toISOString().substring(0, 7)
    };
    
    window.INVOICES.push(inv);
    if (typeof window.ghAutoSave === 'function') window.ghAutoSave(true);
    alert('ההזמנה הועברה בהצלחה למעקב חשבוניות!');
  }
};

window.openDeliverySpModal = async function() {
  const savedUrl = window._spIdbGet ? await window._spIdbGet('deliverySpUrl') : '';
  const ov = document.createElement('div');
  ov.id = 'del-sp-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:22px;max-width:480px;width:96%;box-shadow:0 8px 32px rgba(0,0,0,.25);direction:rtl">
      <div style="font-weight:800;color:#1a237e;font-size:.95rem;margin-bottom:14px">🔗 סריקת תיקיית תעודות משלוח</div>
      <div style="margin-bottom:12px;font-size:.85rem;color:#444">
        הזן את הקישור הכללי לתיקיית תעודות המשלוח ב-SharePoint:
      </div>
      <input type="text" id="dsp-url" value="${savedUrl || ''}" placeholder="https://tomashin.sharepoint.com/..." style="width:100%;margin-bottom:15px;text-align:left;direction:ltr">
      
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="dsp-cancel" class="btn bs bsm">ביטול</button>
        <button id="dsp-ok" class="btn bg">📁 בחר תיקייה מקומית וסרוק</button>
      </div>
    </div>`;
  document.body.appendChild(ov);

  ov.querySelector('#dsp-cancel').addEventListener('click', () => { ov.remove(); });
  ov.querySelector('#dsp-ok').addEventListener('click', async () => {
    const url = ov.querySelector('#dsp-url').value.trim().replace(/\\/+$/, '');
    if (!url) { alert('יש להזין קישור SharePoint'); return; }
    if (window._spIdbSet) await window._spIdbSet('deliverySpUrl', url);
    ov.remove();
    await window.scanDeliveriesSharePoint(url);
  });
};

window.scanDeliveriesSharePoint = async function(baseUrl) {
  if (!window.showDirectoryPicker) {
    alert('הדפדפן שלך אינו תומך בבחירת תיקיות. אנא השתמש ב-Chrome/Edge.');
    return;
  }
  let dirHandle;
  try {
    dirHandle = await window.showDirectoryPicker({ mode: 'read' });
    if (window._spIdbSet) await window._spIdbSet('deliverySpDir', dirHandle);
  } catch (e) {
    return;
  }
  
  if (typeof window.showToast === 'function') window.showToast('⏳ סורק קבצי תעודות משלוח...', 60000);
  
  let matchCount = 0;
  let filesFound = [];

  const cleanBaseUrl = window.parseSharePointBaseUrl ? window.parseSharePointBaseUrl(baseUrl) : baseUrl;

  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const ext = entry.name.split('.').pop().toLowerCase();
      if (['pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
        filesFound.push({
          name: entry.name,
          link: cleanBaseUrl + '/' + encodeURIComponent(entry.name)
        });
      }
    }
  }
  
  for (const file of filesFound) {
    const numMatch = file.name.match(/\\d+/g);
    if (!numMatch) continue;
    
    for (const num of numMatch) {
      const cleanNum = num.replace(/^0+/, '');
      if (cleanNum.length < 2) continue;
      
      const matchedDeliveries = (window.DELIVERIES || []).filter(dlv => {
        if (dlv.deliveryId && String(dlv.deliveryId).replace(/\\D/g, '').replace(/^0+/, '') === cleanNum) return true;
        return false;
      });
      
      for (const dlv of matchedDeliveries) {
        if (!dlv.spLink) {
          dlv.spLink = file.link;
          matchCount++;
        }
      }
    }
  }
  
  if (typeof window.ghAutoSave === 'function') await window.ghAutoSave(true);
  if (typeof window.renderPurchDeliveries === 'function') window.renderPurchDeliveries();
  
  alert(\`✅ סריקה הסתיימה בהצלחה!\\n\\n📁 נסרקו: \${filesFound.length} קבצים\\n🔗 שודכו: \${matchCount} תעודות משלוח.\`);
};

window.spUndoDeliveryMatch = function(dlvId) {
  const dlv = (window.DELIVERIES || []).find(d => String(d.id) === String(dlvId));
  if (dlv) {
    delete dlv.spLink;
    if (typeof window.ghAutoSave === 'function') window.ghAutoSave(true);
    if (typeof window.renderPurchDeliveries === 'function') window.renderPurchDeliveries();
    if (typeof window.showToast === 'function') window.showToast('✅ שיוך בוטל בהצלחה.');
  }
};

window.exportDeliveriesToExcel = async function() {
  if (typeof window.XLSX === "undefined") {
    if (typeof window.showToast === 'function') window.showToast('⏳ טוען ספריות ייצוא...');
    try {
      await window.loadScriptAsync('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
    } catch(e) {
      alert("שגיאה: ספריית XLSX לא נטענה. אנא רענן את הדף ונסה שוב.");
      return;
    }
  }

  const exportData = [];
  const headers = ['תאריך', 'מספר תעודה', 'תיאור כללי', 'שם הנהג', 'שם המקבל', 'קישור למסמך'];
  exportData.push(headers);

  const sorted = [...(window.DELIVERIES || [])].sort((a,b) => b.ts - a.ts);
  
  for (const dlv of sorted) {
    const dStr = new Date(dlv.ts).toLocaleDateString('he-IL');
    const dlvId = dlv.deliveryId || '';
    const desc = dlv.deliveryDesc || '';
    const driver = dlv.driver || '';
    const recipient = dlv.recipient || '';
    const link = dlv.spLink || '';
    
    exportData.push([
      dStr, dlvId, desc, driver, recipient, link
    ]);
  }

  const wb = window.XLSX.utils.book_new();
  const ws = window.XLSX.utils.aoa_to_sheet(exportData);
  
  ws['!cols'] = [
    {wch: 12}, {wch: 15}, {wch: 35}, {wch: 20}, {wch: 20}, {wch: 50}
  ];
  
  window.XLSX.utils.book_append_sheet(wb, ws, 'תעודות משלוח');
  window.XLSX.writeFile(wb, 'תעודות_משלוח.xlsx');
  
  if (typeof window.showToast === 'function') window.showToast('✅ קובץ אקסל נוצר בהצלחה!');
};
