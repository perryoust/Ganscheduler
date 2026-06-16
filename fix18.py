import os

with open('data.js', 'r', encoding='utf-8') as f:
    datajs = f.read()

targetAG = """function AG(){
  // For new years, _GARDENS_ALL holds the full garden list from the year's data
  const all = Array.isArray(window._GARDENS_ALL) && window._GARDENS_ALL.length > 0
    ? [...window._GARDENS_ALL]
    : [...window.GARDENS,...(window._GARDENS_EXTRA||[])];"""

repAG = """function AG(){
  // For new years, _GARDENS_ALL holds the full garden list from the year's data
  const all = Array.isArray(window._GARDENS_ALL) && window._GARDENS_ALL.length > 0
    ? [...window._GARDENS_ALL]
    : [...window.GARDENS,...(window._GARDENS_EXTRA||[])];
  
  // Normalize Petah Tikva globally
  all.forEach(g => {
    if (g.city === 'פ"ת') g.city = 'פתח תקווה';
  });"""

if targetAG in datajs:
    datajs = datajs.replace(targetAG, repAG)
    with open('data.js', 'w', encoding='utf-8') as f:
        f.write(datajs)
    print("data.js patched successfully")
else:
    print("Target AG not found in data.js")

with open('gardens.js', 'r', encoding='utf-8') as f:
    gardensjs = f.read()

if 'פ"ת' in gardensjs:
    import re
    gardensjs = re.sub(r"city:\s*['\"]פ\"ת['\"]", "city: 'פתח תקווה'", gardensjs)
    with open('gardens.js', 'w', encoding='utf-8') as f:
        f.write(gardensjs)
    print("gardens.js patched successfully")

