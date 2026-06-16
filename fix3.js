const fs = require('fs');
let t = fs.readFileSync('cal.js', 'utf8');

t = t.replace(
  "const val = typeof item === 'object' ? item.id : item;", 
  "const val = typeof item === 'object' ? item.id : item;\n      const safeVal = String(val).replace(/\"/g, '&quot;');"
);

t = t.replace(
  '<input type="checkbox" value="${val}" class="cal-${type}-multi-chk" onchange="window.calMultiChanged(\'${type}\', \'${plat}\')">',
  '<input type="checkbox" value="${safeVal}" class="cal-${type}-multi-chk" onchange="window.calMultiChanged(\'${type}\', \'${plat}\')">'
);

// We should also fix getCalCity
// Oh wait, getCalCity does: Array.from(listEl.querySelectorAll('.cal-city-multi-chk:checked')).map(el => el.value)
// el.value will automatically unescape &quot; back to " when read via DOM! So it's perfect.

fs.writeFileSync('cal.js', t);
console.log('Fixed cal.js quotes');
