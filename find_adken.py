import codecs

with codecs.open('invoices.js', 'r', 'utf-8') as f:
    for i, line in enumerate(f):
        if 'עדכן' in line:
            print(f"{i+1}: {line.strip()}")
