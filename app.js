// === Kids Scheduler Logic (v24-Cloud) ===

// 1. אתחול משתנים גלובליים
let S = { 
    events: [], teachers: [], gardens: [], 
    ts: Date.now() 
};
window.S = S;

// 2. פונקציית הכניסה
window.checkLogin = function() {
    const pin = document.getElementById('sys-pin').value;
    if (pin === "1234") {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-main-container').style.display = 'block';
        initCloudSync();
    } else {
        document.getElementById('login-error').style.display = 'block';
        document.getElementById('sys-pin').value = '';
    }
};

// 3. חיבור וסנכרון מול Firebase (עם המתנה לטעינה)
function initCloudSync() {
    if (!window.fbDB) {
        setTimeout(initCloudSync, 500);
        return;
    }
    const statusTag = document.getElementById('sync-status');
    if(statusTag) statusTag.innerText = "⏳ מתחבר...";

    const dataRef = window.fbRef(window.fbDB, 'appData');
    window.fbOnValue(dataRef, (snapshot) => {
        const cloudData = snapshot.val();
        if (cloudData) {
            window.S = cloudData;
            S = cloudData;
            if(statusTag) {
                statusTag.innerText = "✅ מחובר";
                statusTag.style.background = "#2e7d32";
            }
            render();
        } else {
            if(statusTag) statusTag.innerText = "☁️ ענן ריק";
            render();
        }
    });
}

// 4. שמירה לענן
window.saveToFirebase = async function() {
    const ind = document.getElementById('backup-ind');
    if(ind) ind.style.display = 'block';
    try {
        S.ts = Date.now();
        await window.fbSet(window.fbRef(window.fbDB, 'appData'), S);
        if(ind) setTimeout(() => ind.style.display = 'none', 1500);
    } catch (e) {
        alert("שגיאה בשמירה: " + e.message);
    }
};

// 5. ניהול תצוגה
window.setMode = function(m) {
    document.body.className = (m === 'purch') ? 'mode-purch' : 'mode-sched';
    document.getElementById('m-btn-sched').classList.toggle('active', m === 'sched');
    document.getElementById('m-btn-purch').classList.toggle('active', m === 'purch');
    document.getElementById('hdr-mode').innerText = (m === 'purch') ? 'מצב רכש' : 'מצב שיבוץ';
};

window.showPanel = function(id) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById('p-' + id).classList.add('active');
    document.querySelectorAll('.tab, .mob-nav-btn').forEach(t => t.classList.remove('active'));
    render();
};

window.render = function() {
    const dInp = document.getElementById('view-date');
    if(!dInp) return;
    const d = dInp.value || new Date().toISOString().split('T')[0];
    const hdrDate = document.getElementById('hdr-date');
    if(hdrDate) hdrDate.innerText = new Date(d).toLocaleDateString('he-IL');
    
    updateStats();
    renderPlacement(d);
};

function updateStats() {
    if(document.getElementById('st-total')) document.getElementById('st-total').innerText = S.gardens ? S.gardens.length : 0;
    if(document.getElementById('st-pending')) document.getElementById('st-pending').innerText = S.events ? S.events.filter(e => !e.done).length : 0;
    if(document.getElementById('st-done')) document.getElementById('st-done').innerText = S.events ? S.events.filter(e => e.done).length : 0;
}

function renderPlacement(date) {
    const cont = document.getElementById('placement-content');
    if(!cont) return;
    const dayEvents = S.events ? S.
