// pdfmake_orders.js — Native Hebrew PDF generation for Purchase Orders & Delivery Notes
// Uses pdfmake library for direct PDF creation (no html2canvas, no RTL issues)

(function () {
  'use strict';

  // ── INITIALIZATION ──────────────────────────
  let _fontsLoaded = false;
  let _logoDataUrl = null;
  let _initPromise = null;

  /**
   * Convert an ArrayBuffer to a base64 string
   */
  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  /**
   * Load font files and register them with pdfMake.
   * Fetches TTF from /fonts/ directory and converts to base64 for VFS.
   */
  async function initPdfMake() {
    if (_fontsLoaded) return;
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
      try {
        // Load font files in parallel
        const [regularBuf, boldBuf] = await Promise.all([
          fetch('fonts/Assistant-Regular.ttf').then(r => r.arrayBuffer()),
          fetch('fonts/Assistant-Bold.ttf').then(r => r.arrayBuffer())
        ]);

        // Register fonts in pdfMake VFS
        pdfMake.vfs = pdfMake.vfs || {};
        pdfMake.vfs['Assistant-Regular.ttf'] = arrayBufferToBase64(regularBuf);
        pdfMake.vfs['Assistant-Bold.ttf'] = arrayBufferToBase64(boldBuf);

        // Configure font families
        pdfMake.fonts = {
          Assistant: {
            normal: 'Assistant-Regular.ttf',
            bold: 'Assistant-Bold.ttf',
            italics: 'Assistant-Regular.ttf',
            bolditalics: 'Assistant-Bold.ttf'
          }
        };

        // Load logo as base64 data URL
        try {
          const logoRes = await fetch('לוגו לאורך - עושים חינוך אחרת (3000 x 750 פיקסל).png');
          if (logoRes.ok) {
            const logoBuffer = await logoRes.arrayBuffer();
            _logoDataUrl = 'data:image/png;base64,' + arrayBufferToBase64(logoBuffer);
          }
        } catch (e) {
          console.warn('[pdfmake] Could not load logo:', e);
        }

        _fontsLoaded = true;
        console.log('[pdfmake] Fonts and logo loaded successfully');
      } catch (e) {
        console.error('[pdfmake] Failed to load fonts:', e);
        throw e;
      }
    })();

    return _initPromise;
  }

  // ── HELPERS ─────────────────────────────────

  const GREEN = '#2e7d32';
  const DARK_BLUE = '#1a237e';
  const LIGHT_GRAY = '#f5f5f5';
  const BORDER_COLOR = '#cccccc';

  /**
   * Safe text helper — ensures no null/undefined values
   */
  function t(str) {
    return str != null ? String(str) : '';
  }

  /**
   * Format a number as Israeli Shekel currency string
   */
  function shekel(num) {
    return '₪ ' + (num || 0).toFixed(2);
  }

  /**
   * Format a timestamp as Hebrew date string
   */
  function heDate(ts) {
    return new Date(ts).toLocaleDateString('he-IL');
  }

  /**
   * Get the default footer text lines
   */
  function getFooterLines() {
    const defaultFooter = 'טומשין-עושים חינוך אחרת בע"מ (חל"צ) – רשת צהרונים\nהנהלה ראשית: רח\' איינשטיין 18 קומה ב\', נס ציונה, ת.ד. 2318, מיקוד 7403622, טל: 03-9689119 פקס: 039689120\nwww.tomashin.co.il  www.tomashin-kids.co.il';
    const footer = window.PURCH_FOOTER || defaultFooter;
    return footer.split('\n').map(l => l.trim()).filter(l => l);
  }

  /**
   * Build the page footer function for pdfmake
   */
  function buildFooter(footerLines) {
    return function (currentPage, pageCount) {
      const content = [];
      if (footerLines.length > 0) {
        content.push({ text: footerLines[0], bold: true, color: GREEN, fontSize: 9, alignment: 'center', margin: [0, 0, 0, 2] });
      }
      if (footerLines.length > 1) {
        content.push({ text: footerLines.slice(1).join(' | '), fontSize: 7, color: '#555', alignment: 'center' });
      }
      content.push({ text: 'דף ' + currentPage + '/' + pageCount, fontSize: 8, color: '#555', alignment: 'center', margin: [0, 4, 0, 0] });
      return {
        margin: [40, 0, 40, 15],
        stack: content
      };
    };
  }

  // ── PURCHASE ORDER PDF ──────────────────────

  /**
   * Generate a pdfmake document definition for a Purchase Order.
   * Translates the same layout as openOrderPrintPreview().
   */
  function generateOrderDocDef(order) {
    const footerLines = getFooterLines();

    // --- Header section ---
    const headerColumns = [];

    // Right side: title + order number
    headerColumns.push({
      width: '*',
      stack: [
        { text: 'הזמנת רכש' + (order.titleSuffix ? ' : ' + order.titleSuffix : ''), style: 'h3', margin: [0, 0, 0, 4] },
        { text: [{ text: 'מספר הזמנה: ', bold: true }, t(order.orderId)], fontSize: 12, margin: [0, 0, 0, 4] }
      ]
    });

    // Left side: date
    headerColumns.push({
      width: 130,
      alignment: 'left',
      stack: [
        { text: [{ text: 'תאריך: ', bold: true }, heDate(order.ts)], fontSize: 11, margin: [0, 8, 0, 0] }
      ]
    });

    // Logo in top-left
    const logoSection = [];
    if (_logoDataUrl) {
      logoSection.push({
        columns: [
          { width: '*', text: '' },
          { width: 200, image: _logoDataUrl, fit: [200, 50], alignment: 'left' }
        ],
        margin: [0, 0, 0, 5]
      });
    }

    // Supplier info line
    const supplierLine = { text: [{ text: 'לכבוד: ', bold: true }, t(order.supplier)], fontSize: 11, margin: [0, 5, 0, 3] };

    // Supplier contact details
    const contactLines = [];
    if (typeof window.supEx !== 'undefined') {
      const ex = window.supEx[order.supplier] || {};
      const base = (typeof window.SUPBASE !== 'undefined' ? window.SUPBASE.find(s => s.name === order.supplier) : null) || {};
      const contact = ex.contact || '';
      const phone = ex.ph1 || base.phone || '';
      if (contact || phone) {
        let contactStr = '';
        if (contact) contactStr += contact;
        if (contact && phone) contactStr += ' ';
        if (phone) contactStr += phone;
        contactLines.push({ text: contactStr, fontSize: 10, margin: [0, 0, 45, 3], color: '#333' });
      }
    }

    // Order description
    const descSection = [];
    if (order.orderDesc) {
      descSection.push({ text: order.orderDesc, bold: true, alignment: 'center', fontSize: 11, margin: [0, 10, 0, 5] });
    }

    // --- Items table ---
    const tableBody = [];
    // Header row
    tableBody.push([
      { text: '#', style: 'th', alignment: 'center' },
      { text: 'תיאור', style: 'th' },
      { text: 'כמות', style: 'th', alignment: 'center' },
      { text: 'מחיר יחידה', style: 'th', alignment: 'center' },
      { text: 'סה"כ', style: 'th', alignment: 'center' }
    ]);

    // Data rows
    (order.items || []).forEach((item, idx) => {
      tableBody.push([
        { text: String(idx + 1), alignment: 'center', fontSize: 9 },
        { text: t(item.desc), fontSize: 9 },
        { text: String(item.qty || ''), alignment: 'center', fontSize: 9 },
        { text: shekel(item.price), alignment: 'center', fontSize: 9 },
        { text: shekel(item.total), alignment: 'center', fontSize: 9 }
      ]);
    });

    const itemsTable = {
      table: {
        headerRows: 1,
        widths: [25, '*', 45, 70, 70],
        body: tableBody
      },
      layout: {
        hLineColor: () => BORDER_COLOR,
        vLineColor: () => BORDER_COLOR,
        fillColor: (rowIndex) => rowIndex === 0 ? LIGHT_GRAY : null,
        paddingLeft: () => 5,
        paddingRight: () => 5,
        paddingTop: () => 3,
        paddingBottom: () => 3
      },
      margin: [0, 8, 0, 10]
    };

    // --- Totals section ---
    const kitsCount = order.kitsCount || 1;
    const subtotalPerKit = order.subtotal || 0;
    const discountPerKit = order.discount || 0;
    const taxablePerKit = Math.max(0, subtotalPerKit - discountPerKit);
    const totalTaxable = taxablePerKit * kitsCount;
    const vatPercent = Math.round((order.vat / (totalTaxable || 1)) * 100) || 18;

    const totalsStack = [];

    if (kitsCount > 1) {
      totalsStack.push({ text: [{ text: 'סה"כ לערכה בודדת: ', bold: true }, shekel(subtotalPerKit)], fontSize: 10, alignment: 'center', margin: [0, 2, 0, 2] });
      if (discountPerKit) {
        totalsStack.push({ text: [{ text: 'הנחה לערכה: ', bold: true }, '- ' + shekel(discountPerKit)], fontSize: 10, color: '#d32f2f', alignment: 'center', margin: [0, 2, 0, 2] });
      }
      totalsStack.push({ text: [{ text: 'כמות ערכות: ', bold: true, color: GREEN }, { text: String(kitsCount), bold: true, color: GREEN, fontSize: 12 }], fontSize: 10, alignment: 'center', margin: [0, 4, 0, 4] });
      totalsStack.push({ text: [{ text: 'סה"כ (' + kitsCount + ' ערכות): ', bold: true }, shekel(totalTaxable)], fontSize: 10, alignment: 'center', margin: [0, 2, 0, 2] });
    } else {
      totalsStack.push({ text: [{ text: 'סה"כ: ', bold: true }, shekel(subtotalPerKit)], fontSize: 10, alignment: 'center', margin: [0, 2, 0, 2] });
      if (discountPerKit) {
        totalsStack.push({ text: [{ text: 'הנחה: ', bold: true }, '- ' + shekel(discountPerKit)], fontSize: 10, color: '#d32f2f', alignment: 'center', margin: [0, 2, 0, 2] });
      }
    }

    totalsStack.push({ text: [{ text: 'מע"מ ' + vatPercent + '%: ', bold: true }, shekel(order.vat)], fontSize: 10, alignment: 'center', margin: [0, 2, 0, 2] });
    totalsStack.push({
      text: [{ text: 'סה"כ לתשלום: ', bold: true, color: GREEN }, { text: shekel(order.totalPrice), bold: true, color: GREEN, fontSize: 14 }],
      fontSize: 12, alignment: 'center', margin: [0, 6, 0, 4]
    });

    // Notes + Totals side by side
    const footerColumns = [];
    if (order.notes) {
      footerColumns.push({
        width: '*',
        stack: [
          { text: 'הערות:', bold: true, fontSize: 10, margin: [0, 0, 0, 3] },
          { text: t(order.notes), fontSize: 9, color: '#333' }
        ],
        margin: [20, 0, 0, 0]
      });
    } else {
      footerColumns.push({ width: '*', text: '' });
    }

    footerColumns.push({
      width: 200,
      stack: totalsStack,
      alignment: 'center',
      margin: [0, 0, 0, 0],
      // Light background box effect
    });

    // --- Signature section ---
    const signatureSection = [];
    if (order.orderer) {
      const ordererLines = order.orderer.split('\n').map(l => l.trim()).filter(l => l);
      ordererLines.forEach(l => {
        signatureSection.push({ text: l, bold: true, fontSize: 10, alignment: 'center' });
      });
    }
    signatureSection.push({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 1, lineColor: '#000' }],
      alignment: 'center',
      margin: [0, 15, 0, 0]
    });

    // --- Assemble document definition ---
    const docDef = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 60],
      defaultStyle: {
        font: 'Assistant',
        fontSize: 10,
        alignment: 'right'
      },
      styles: {
        h3: { fontSize: 16, bold: true },
        th: { bold: true, fontSize: 9, fillColor: LIGHT_GRAY, alignment: 'right' }
      },
      footer: buildFooter(footerLines),
      content: [
        ...logoSection,
        // Header with green underline
        {
          columns: headerColumns,
          margin: [0, 0, 0, 0]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: GREEN }], margin: [0, 5, 0, 8] },
        // Supplier info
        supplierLine,
        ...contactLines,
        ...descSection,
        // Items table
        itemsTable,
        // Notes + Totals
        {
          columns: footerColumns,
          margin: [0, 10, 0, 0]
        },
        // Signature (aligned to the left in RTL = flex-end)
        {
          columns: [
            { width: '*', text: '' },
            {
              width: 180,
              stack: signatureSection,
              alignment: 'center',
              margin: [0, 50, 0, 0]
            }
          ]
        }
      ]
    };

    return docDef;
  }

  // ── DELIVERY NOTE PDF ───────────────────────

  /**
   * Generate a pdfmake document definition for a Delivery Note.
   * Produces two copies (מקור + עותק) in the same PDF.
   */
  function generateDeliveryDocDef(dlv) {
    const footerLines = getFooterLines();

    function buildDeliveryCopy(copyType) {
      const sections = [];

      // Logo
      if (_logoDataUrl) {
        sections.push({
          columns: [
            { width: '*', text: '' },
            { width: 200, image: _logoDataUrl, fit: [200, 50], alignment: 'left' }
          ],
          margin: [0, 0, 0, 5]
        });
      }

      // Header with copy badge
      const badgeColor = copyType === 'מקור' ? GREEN : '#ef6c00';
      const badgeBg = copyType === 'מקור' ? '#e8f5e9' : '#fff3e0';

      sections.push({
        columns: [
          {
            width: '*',
            stack: [
              { text: 'תעודת משלוח ציוד', style: 'h3', margin: [0, 0, 0, 3] },
              { text: [{ text: 'מספר תעודה: ', bold: true, color: DARK_BLUE }, t(dlv.deliveryId)], fontSize: 12, margin: [0, 0, 0, 3] }
            ]
          },
          {
            width: 70,
            stack: [
              {
                text: copyType,
                bold: true,
                fontSize: 14,
                color: badgeColor,
                alignment: 'center',
                margin: [10, 4, 10, 4]
              }
            ],
            margin: [15, 5, 15, 0]
          },
          {
            width: 130,
            alignment: 'left',
            stack: [
              { text: [{ text: 'תאריך: ', bold: true, color: DARK_BLUE }, heDate(dlv.ts)], fontSize: 11, margin: [0, 8, 0, 0] }
            ]
          }
        ],
        margin: [0, 0, 0, 0]
      });

      // Green line
      sections.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: GREEN }], margin: [0, 5, 0, 8] });

      // Destination / description / driver info
      const infoColumns = [];
      infoColumns.push({ text: [{ text: 'יעד המשלוח: ', bold: true, color: DARK_BLUE }, t(dlv.destination)], fontSize: 10 });
      if (dlv.deliveryDesc) {
        infoColumns.push({ text: [{ text: 'תיאור: ', bold: true, color: DARK_BLUE }, t(dlv.deliveryDesc)], fontSize: 10 });
      }
      infoColumns.push({ text: [{ text: 'שם הנהג/מוביל: ', bold: true, color: DARK_BLUE }, t(dlv.driver) || '_________________'], fontSize: 10 });

      sections.push({
        table: {
          widths: ['*'],
          body: [[{
            stack: infoColumns.map((item, idx) => ({ ...item, margin: [0, idx === 0 ? 0 : 3, 0, 0] })),
            margin: [8, 6, 8, 6]
          }]]
        },
        layout: {
          hLineColor: () => '#eee',
          vLineColor: () => '#eee',
          fillColor: () => '#f9f9f9',
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6
        },
        margin: [0, 0, 0, 10]
      });

      // Items table
      if (dlv.items && dlv.items.length > 0) {
        const tableBody = [];
        tableBody.push([
          { text: '#', style: 'th', alignment: 'center' },
          { text: 'תיאור הציוד', style: 'th' },
          { text: 'כמות', style: 'th', alignment: 'center' },
          { text: 'הערות / ברקוד', style: 'th' }
        ]);

        dlv.items.forEach((item, idx) => {
          tableBody.push([
            { text: String(idx + 1), alignment: 'center', fontSize: 9 },
            { text: t(item.desc), fontSize: 9 },
            { text: String(item.qty || ''), alignment: 'center', fontSize: 9 },
            { text: t(item.note || ''), fontSize: 9 }
          ]);
        });

        sections.push({
          table: {
            headerRows: 1,
            widths: [25, '*', 50, 160],
            body: tableBody
          },
          layout: {
            hLineColor: () => BORDER_COLOR,
            vLineColor: () => BORDER_COLOR,
            fillColor: (rowIndex) => rowIndex === 0 ? LIGHT_GRAY : null,
            paddingLeft: () => 5,
            paddingRight: () => 5,
            paddingTop: () => 4,
            paddingBottom: () => 4
          },
          margin: [0, 0, 0, 10]
        });
      }

      // Notes
      if (dlv.notes) {
        sections.push({
          stack: [
            { text: 'הערות כלליות למשלוח:', bold: true, fontSize: 10, margin: [0, 10, 0, 3] },
            { text: t(dlv.notes), fontSize: 9, color: '#333' }
          ]
        });
      }

      // Signature lines (recipient + signature)
      sections.push({
        columns: [
          { width: '*', text: '' },
          {
            width: 200,
            stack: [
              {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 1, lineColor: '#000' }],
                margin: [0, 0, 0, 4]
              },
              { text: dlv.recipient ? 'שם המקבל: ' + dlv.recipient : 'שם מלא של המקבל', bold: true, fontSize: 9, alignment: 'center' },
              {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 1, lineColor: '#000' }],
                margin: [0, 30, 0, 4]
              },
              { text: 'חתימת המקבל', bold: true, fontSize: 9, alignment: 'center' }
            ],
            alignment: 'center',
            margin: [0, 30, 0, 0]
          }
        ]
      });

      return sections;
    }

    // Build two copies: מקור and עותק
    const originalCopy = buildDeliveryCopy('מקור');
    const duplicateCopy = buildDeliveryCopy('עותק');

    const docDef = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 60],
      defaultStyle: {
        font: 'Assistant',
        fontSize: 10,
        alignment: 'right'
      },
      styles: {
        h3: { fontSize: 16, bold: true },
        th: { bold: true, fontSize: 9, fillColor: LIGHT_GRAY, alignment: 'right' }
      },
      footer: buildFooter(footerLines),
      content: [
        ...originalCopy,
        { text: '', pageBreak: 'after' },
        ...duplicateCopy
      ]
    };

    return docDef;
  }

  // ── PUBLIC API ──────────────────────────────

  /**
   * Download a Purchase Order as PDF using pdfmake.
   */
  window.downloadOrderPdfNative = async function (order) {
    let overlay = document.getElementById('pdf-loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'pdf-loading-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;backdrop-filter:blur(3px);';
      overlay.innerHTML = '<div style="background:#fff;color:#333;padding:25px 35px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.3);text-align:center;max-width:350px;"><div style="font-size:36px;margin-bottom:12px;">⏳</div><h3 style="margin:0 0 8px;font-size:18px;color:#1a237e;">מייצר קובץ PDF</h3><p style="margin:0;font-size:14px;color:#666;">ההורדה תתחיל בעוד רגע...</p></div>';
      document.body.appendChild(overlay);
    } else {
      overlay.style.display = 'flex';
    }

    try {
      await initPdfMake();

      const docDef = generateOrderDocDef(order);

      // Build filename
      let descPart = '';
      if (order.orderDesc && order.orderDesc.trim()) {
        descPart = order.orderDesc.trim();
      } else if (order.items && order.items.length > 0 && order.items[0].desc) {
        descPart = order.items[0].desc.trim().split('\n')[0];
      }
      if (descPart.length > 120) descPart = descPart.substring(0, 120);

      let titleParts = [];
      if (order.supplier) titleParts.push(order.supplier);
      if (descPart) titleParts.push(descPart);
      if (order.orderId) titleParts.push(order.orderId);
      if (titleParts.length === 0) titleParts.push('הזמנת רכש');
      let filename = titleParts.join(' - ').replace(/["\'\\/]/g, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
      if (!filename.endsWith('.pdf')) filename += '.pdf';

      pdfMake.createPdf(docDef).download(filename, () => {
        overlay.style.display = 'none';
        if (window.showToast) window.showToast('✅ הקובץ הורד בהצלחה!', 3000);
      });
    } catch (e) {
      console.error('[pdfmake] Error generating order PDF:', e);
      overlay.style.display = 'none';
      if (window.showToast) window.showToast('❌ שגיאה בהפקת המסמך: ' + e.message, 5000);
    }
  };

  /**
   * Download a Delivery Note as PDF using pdfmake.
   */
  window.downloadDeliveryPdfNative = async function (dlv) {
    let overlay = document.getElementById('pdf-loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'pdf-loading-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;backdrop-filter:blur(3px);';
      overlay.innerHTML = '<div style="background:#fff;color:#333;padding:25px 35px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.3);text-align:center;max-width:350px;"><div style="font-size:36px;margin-bottom:12px;">⏳</div><h3 style="margin:0 0 8px;font-size:18px;color:#1a237e;">מייצר קובץ PDF</h3><p style="margin:0;font-size:14px;color:#666;">ההורדה תתחיל בעוד רגע...</p></div>';
      document.body.appendChild(overlay);
    } else {
      overlay.style.display = 'flex';
    }

    try {
      await initPdfMake();

      const docDef = generateDeliveryDocDef(dlv);

      // Build filename
      let descPart = '';
      if (dlv.notes && dlv.notes.trim()) {
        descPart = dlv.notes.trim().split('\n')[0];
      } else if (dlv.items && dlv.items.length > 0 && dlv.items[0].desc) {
        descPart = dlv.items[0].desc.trim().split('\n')[0];
      }
      if (descPart.length > 120) descPart = descPart.substring(0, 120);

      let titleParts = ['תעודת משלוח'];
      if (dlv.destination) titleParts.push(dlv.destination);
      if (descPart) titleParts.push(descPart);
      if (dlv.deliveryId) titleParts.push(dlv.deliveryId);
      let filename = titleParts.join(' - ').replace(/["\'\\/]/g, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
      if (!filename.endsWith('.pdf')) filename += '.pdf';

      pdfMake.createPdf(docDef).download(filename, () => {
        overlay.style.display = 'none';
        if (window.showToast) window.showToast('✅ הקובץ הורד בהצלחה!', 3000);
      });
    } catch (e) {
      console.error('[pdfmake] Error generating delivery PDF:', e);
      overlay.style.display = 'none';
      if (window.showToast) window.showToast('❌ שגיאה בהפקת המסמך: ' + e.message, 5000);
    }
  };

})();
