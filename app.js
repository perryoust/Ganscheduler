// === Kids Scheduler Logic (v24-Cloud) ===

// 1. אתחול משתנים גלובליים
let S = { 
    events: [], teachers: [], gardens: [], 
    settings: { cities: ["ראשון לציון", "חולון", "בת ים"] },
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

// 3. חיבור וסנכרון מול Firebase
function initCloudSync() {
    if (!window.fbDB) return;
    const statusTag = document.getElementById('sync-status');
    if(statusTag) statusTag.innerText = "⏳ מסנכרן...";

    const dataRef = window.fbRef(window.fbDB, 'appData');
    window.fbOnValue(dataRef, (snapshot) => {
        const cloudData = snapshot.val();
        if (cloudData) {
            window.S = cloudData;
            S = cloudData;
            if(statusTag) {
                statusTag.innerText = "✅ מחובר לענן";
                statusTag.style.background = "#2e7d32";
            }
            render();
        } else {
            if(statusTag) statusTag.innerText = "☁️ ענן חדש";
            render();
        }
    });
}

// 4. שמירה לענן
window.saveToFirebase = async function() {
    const ind = document.getElementById('backup-ind');
    if(ind) ind.classList.add('show');
    try {
        S.ts = Date.now();
        await window.fbSet(window.fbRef(window.fbDB, 'appData'), S);
        if(ind) setTimeout(() => ind.classList.remove('show'), 1500);
    } catch (e) {
        alert("שגיאה בשמירה לענן: " + e.message);
    }
};

// 5. ניהול תצוגה ופאנלים
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
    const total = document.getElementById('st-total');
    const pending = document.getElementById('st-pending');
    const done = document.getElementById('st-done');
    
    if(total) total.innerText = S.gardens ? S.gardens.length : 0;
    if(pending) pending.innerText = S.events ? S.events.filter(e => !e.done).length : 0;
    if(done) done.innerText = S.events ? S.events.filter(e => e.done).length : 0;
}

function renderPlacement(date) {
    const cont = document.getElementById('placement-content');
    if(!cont) return;
    const dayEvents = S.events ? S.events.filter(e => e.date === date) : [];
    
    if (dayEvents.length === 0) {
        cont.innerHTML = '<div class="pempty">אין שיבוצים ליום זה.</div>';
        return;
    }

    let html = '<div class="pairs-4col">';
    dayEvents.forEach(ev => {
        html += `
            <div class="pair-card">
                <div class="pair-card-hdr" style="background:#1565c0">
                    <span>🕒 ${ev.time || '08:00'}</span>
                </div>
                <div class="pair-card-body">
                    <div class="pair-card-label"><div class="pcl-name">${ev.garden}</div></div>
                    <div class="pair-garden-row">
                        <div class="pgr-left">
                            <div class="pgr-name">${ev.teacher}</div>
                            <div class="pgr-status">${ev.done ? '✅ בוצע' : '⏳ ממתין'}</div>
                        </div>
                        <div class="pgr-right">
                             <button class="btn bsm bo" onclick="toggleEvent('${ev.id}')">${ev.done ? 'בטל' : 'בצע'}</button>
                        </div>
                    </div>
                </div>
            </div>`;
    });
    html += '</div>';
    cont.innerHTML = html;
}

window.toggleEvent = function(id) {
    const ev = S.events.find(e => e.id === id);
    if(ev) {
        ev.done = !ev.done;
        saveToFirebase();
    }
};

window.closeModal = function(id) { document.getElementById(id).classList.remove('open'); };
window.openNewEventModal = function() { 
    // טעינת רשימות למודל
    const gSel = document.getElementById('ev-garden');
    const tSel = document.getElementById('ev-teacher');
    if(gSel) gSel.innerHTML = S.gardens.map(g => `<option>${g.name}</option>`).join('');
    if(tSel) tSel.innerHTML = S.teachers.map(t => `<option>${t.name}</option>`).join('');
    document.getElementById('modal-event').classList.add('open'); 
};

// אתחול תאריך נוכחי בטעינה
window.addEventListener('load', () => {
    const dInp = document.getElementById('view-date');
    if(dInp) dInp.value = new Date().toISOString().split('T')[0];
});
