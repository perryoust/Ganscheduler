const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Add Desktop Tab
if (!html.includes('ST(\\\'worker_tasks\\\')')) {
  html = html.replace(
    '<div class="tab" onclick="ST(\\\'gardens\\\')"',
    '<div class="tab" onclick="ST(\\\'worker_tasks\\\')" title="ניהול משימות והערות לעובדי שטח">👷 משימות שטח</div>\n    <div class="tab" onclick="ST(\\\'gardens\\\')"'
  );
}

// 2. Add Mobile Tab
if (!html.includes('data-tab="worker_tasks"')) {
  html = html.replace(
    '<button class="mob-nav-btn" onclick="ST(\\\'gardens\\\');mobNav(this)" data-tab="gardens">',
    '<button class="mob-nav-btn" onclick="ST(\\\'worker_tasks\\\');mobNav(this)" data-tab="worker_tasks"><span class="mnb-ico">👷</span><span>משימות</span></button>\n      <button class="mob-nav-btn" onclick="ST(\\\'gardens\\\');mobNav(this)" data-tab="gardens">'
  );
}

// 3. Add explanation to Admin panel
if (!html.includes('console.firebase.google.com')) {
  const adminAddUserHTML = `
      <div style="background:#fff3e0;border:1px solid #ffb74d;border-radius:8px;padding:12px;margin-bottom:15px;font-size:0.85rem;color:#e65100;">
        <strong>שימו לב:</strong> מערכת ההרשאות מנוהלת גם דרך מסד הנתונים וגם דרך אימות המשתמשים.
        <br>
        בכדי לאפס או לשנות סיסמא למשתמש קיים (כמו עובד שטח), יש להיכנס לאתר הניהול של פיירבייס בקישור הבא:
        <br>
        <a href="https://console.firebase.google.com/project/ganmanage-free/authentication/users" target="_blank" style="color:#1565c0;font-weight:bold;text-decoration:underline;">console.firebase.google.com</a>
        <br>
        שם יש למחוק את המשתמש ולהוסיף אותו מחדש עם אותו האימייל והסיסמה החדשה.
      </div>
      <div style="font-weight:700;font-size:.85rem;color:#6a1b9a;margin-bottom:10px">➕ יצירת משתמש חדש</div>
`;
  html = html.replace(
    '<div style="font-weight:700;font-size:.85rem;color:#6a1b9a;margin-bottom:10px">➕ יצירת משתמש חדש</div>',
    adminAddUserHTML
  );
}

// 4. Update the cache version so it refreshes for the user
html = html.replace(/worker_tasks\.js(\?v=\d+(\.\d+)?)?/g, 'worker_tasks.js?v=' + Date.now());

fs.writeFileSync('index.html', html);
console.log('Successfully patched index.html');
