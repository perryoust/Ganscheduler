import re
with open('invoices.js', 'r', encoding='utf-8') as f:
    code = f.read()
idx = code.find('window.showToast')
while idx != -1:
    end = code.find('\n', idx)
    print(code[idx:end])
    idx = code.find('window.showToast', end)
