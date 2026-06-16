import os

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

print_styles = """
    /* PRINT STYLES FOR DAILY NOTEBOOK */
    @media print {
      body * {
        visibility: hidden;
      }
      #c-cal, #c-cal * {
        visibility: visible;
      }
      #c-cal {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
      }
      .sidebar, header, nav, button, .top-bar, .filters, #cal-controls, .sp-modal-overlay, #sys-msg {
        display: none !important;
      }
      #cal-body {
        margin-top: 0 !important;
      }
      .qacts {
         display: none !important; /* hide action buttons in print */
      }
    }
</style>"""

if '/* PRINT STYLES FOR DAILY NOTEBOOK */' not in html:
    html = html.replace('</style>', print_styles)
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("index.html patched with print styles")
else:
    print("Print styles already exist in index.html")
