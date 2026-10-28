import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword,
  setPersistence, browserLocalPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, onValue, goOnline, goOffline } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDiUrCk_eOQ_bmAc1ZCXrSaelG-HpaTLfA",
  authDomain: "ganmanage-free.firebaseapp.com",
  databaseURL: "https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ganmanage-free",
  storageBucket: "ganmanage-free.firebasestorage.app",
  messagingSenderId: "242506763762",
  appId: "1:242506763762:web:f0574f434756d207002f6b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

window._fbGoOnline = () => {
  try {
    goOnline(db);
    console.log('[Firebase] Connection restored via goOnline');
  } catch (e) {
    console.warn('[Firebase] goOnline error:', e);
  }
};

// Handle Back-Forward Cache (bfcache) restoration
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    console.log('[Firebase] Page restored from Back-Forward Cache (bfcache). Reconnecting...');
    window._fbGoOnline();
  }
});

// Handle tab visibility change (user returns to tab)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    window._fbGoOnline();
  }
});

// Handle device coming back online
window.addEventListener('online', () => {
  window._fbGoOnline();
});

// REALTIME LISTENER FOR WORKER TASKS
onAuthStateChanged(auth, (user) => {
  if (user) {
    const tasksRef = ref(db, 'data/global_worker_tasks');
    onValue(tasksRef, (snapshot) => {
      const data = snapshot.val();
      if (window.mergeWorkerTasksLocally && typeof window.mergeWorkerTasksLocally === 'function') {
        window.mergeWorkerTasksLocally(data);
      }
    });
  }
});

// Secondary app instance — used to create new users WITHOUT signing out admin
const app2 = initializeApp(firebaseConfig, 'secondary');
const auth2 = getAuth(app2);

// Domain for fake emails: username ? username@ganmanager.app
const DOMAIN = '@ganmanager.app';

window._fbAuth = auth;
window._fbSignIn = async function (username, password, remember) {
  const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
  await setPersistence(auth, persistence);
  const email = username.includes('@') ? username : username + DOMAIN;
  return signInWithEmailAndPassword(auth, email, password);
};
window._fbSignOut = () => signOut(auth);
window._fbGetToken = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  try { const tok = await user.getIdToken(false); window._cachedToken = tok; return tok; }
  catch (e) { try { return await user.getIdToken(true); } catch (e2) { return null; } }
};

// Initialize Firebase Functions
const functions = getFunctions(app, 'us-central1');
window._fbCallFunction = async function (name, data) {
  const fn = httpsCallable(functions, name);
  const result = await fn(data);
  return result.data;
};

// Create new user using secondary app (admin stays logged in)
window._fbCreateUser = async function (username, password) {
  const email = username.includes('@') ? username : username + DOMAIN;
  const cred = await createUserWithEmailAndPassword(auth2, email, password);
  const newUid = cred.user.uid;
  // Sign out from secondary app immediately
  await signOut(auth2);
  return { uid: newUid, email };
};

// Listen for auth state — kick off app once signed in
onAuthStateChanged(auth, async (user) => {
  // Check for worker fast-track — only if we have a Firebase user
  if (user && window._safeLS && window._safeLS.getItem('ganv5_auth_user') === 'worker') {
    window._fbUser = user;
    try { window._cachedToken = await user.getIdToken(false); } catch (e) { window._cachedToken = null; }
    window.role = 'worker';
    window.permWorker = true;
    window.permPurch = false;
    window.permAct = false;
    window.permMatzava = false;
    const authOverlay = document.getElementById('auth-overlay');
    if (authOverlay) authOverlay.style.display = 'none';
    if (typeof window.activateWorkerApp === 'function') {
      window.activateWorkerApp();
    }
    // Trigger data load for worker
    if (typeof window._onAuthReady === 'function') window._onAuthReady();
    return;
  }

  if (user) {
    window._fbUser = user;
    try { window._cachedToken = await user.getIdToken(false); } catch (e) { window._cachedToken = null; }
    
    // Load User Permissions
    const ADMIN_UID = 'VW5FCIlBb9VS4Eo1BTKyCxq5xa03';
    let permPurch = false;
    let permAct = true;
    let permWorker = false;
    let permMatzava = true;
    let role = 'view';
    if (user.uid === ADMIN_UID) {
      permPurch = true;
      permAct = true;
      permWorker = true;
      permMatzava = true;
      role = 'admin';
    } else {
      try {
        const q = window._cachedToken ? '?auth=' + window._cachedToken : '';
        const userRes = await fetch(`https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app/users/${user.uid}.json${q}`);
        if (userRes.ok) {
          const profile = await userRes.json();
          if (profile) {
            permPurch = !!profile.permPurch;
            permAct = profile.permAct !== false;
            permWorker = !!profile.permWorker || profile.role === 'worker';
            permMatzava = profile.permMatzava !== false;
            role = profile.role || 'view';
            const isManagerRole = role === 'manager' || role === 'vp';
            if (role === 'coordinator' || isManagerRole) {
              window.coordPhone = profile.phone;
              window.coordManagerId = profile.managerId;
              window.coordCities = isManagerRole ? ['ALL'] : (profile.coordCities || []);
              window.coordGardenIds = profile.coordGardenIds || [];
              window.coordTimeScope = isManagerRole ? 'year' : (profile.coordTimeScope || 'month');
              window.coordClsScope = profile.coordClsScope || 'all';
              window.permCoord = true;
              window.permAllCities = isManagerRole || (profile.coordCities || []).includes('ALL') || !!profile.allCities;

              // Force active year & clear any custom year selections
              const targetYear = profile.currentYear || 'tashpaz';
              window.CURRENT_YEAR = targetYear;
              try {
                localStorage.removeItem('_user_custom_year_selected');
                if (window._safeLS) window._safeLS.removeItem('_user_custom_year_selected');
                const metaStr = window._safeLS ? window._safeLS.getItem('ganv5_meta') : localStorage.getItem('ganv5_meta');
                if (metaStr) {
                  const mObj = JSON.parse(metaStr);
                  mObj.currentYear = targetYear;
                  if (window._safeLS) window._safeLS.setItem('ganv5_meta', JSON.stringify(mObj));
                  localStorage.setItem('ganv5_meta', JSON.stringify(mObj));
                }
              } catch(e) {}
            }
          } else if (user.email && user.email.startsWith('worker@')) {
            // Auto-detect worker from email — no profile exists yet
            permWorker = true;
            permAct = false;
            role = 'worker';
            console.log('[Auth] Auto-detected worker role from email:', user.email);
          }
        }
      } catch (e) {
        console.warn('Failed to load user permissions:', e);
        // Fallback: detect worker from email
        if (user.email && user.email.startsWith('worker@')) {
          permWorker = true;
          permAct = false;
          role = 'worker';
        } else if (user.email && user.email.startsWith('coord_')) {
          role = 'coordinator';
          permAct = true;
        } else if (user.email && (user.email.startsWith('vp_') || user.email.startsWith('manager_') || user.email.startsWith('samankal'))) {
          role = 'manager';
          permAct = true;
          window.permAllCities = true;
          window.coordCities = ['ALL'];
          window.permCoord = true;
        }
      }
    }
    window.permPurch = permPurch;
    window.permAct = permAct;
    window.permWorker = permWorker;
    window.permMatzava = permMatzava;
    window.role = role;
    if (role === 'view' || role === 'coordinator' || role === 'manager' || role === 'vp') {
      window.isReadOnly = true;
    }

    // Strict Worker Isolation: If they ONLY have worker permissions, use the isolated mobile UI
    const isStrictWorker = permWorker && (!permAct || role === 'worker') && !permPurch && role !== 'admin';
    if (isStrictWorker) {
      try {
        localStorage.setItem('gan_app_mode', 'worker');
        localStorage.setItem('gan_user_role', role);
      } catch (e) {}
      document.documentElement.classList.add('isolated-mode');

      const authOverlay = document.getElementById('auth-overlay');
      if (authOverlay) authOverlay.style.display = 'none';

      // Load data first, then activate worker UI
      if (typeof window._onAuthReady === 'function') window._onAuthReady();

      // Poll until data is loaded, then activate worker app
      let _workerPollCount = 0;
      const _workerPoll = setInterval(() => {
        _workerPollCount++;
        const dataReady = window.WORKER_TASKS !== undefined;
        if (dataReady || _workerPollCount >= 20) {
          clearInterval(_workerPoll);
          if (typeof window.activateWorkerApp === 'function') {
            window.activateWorkerApp();
          }
          const sysLoad = document.getElementById('system-loading-overlay');
          if (sysLoad) { sysLoad.style.opacity = '0'; setTimeout(()=>sysLoad.style.display='none',300); }
        }
      }, 150);
      return;
    }

    // Strict Coordinator or Manager/VP Isolation: read-only view of their assigned gardens or whole org
    const isStrictCoordinator = (role === 'coordinator' || role === 'manager' || role === 'vp') && (window.permCoord || profile?.allCities || role === 'manager' || role === 'vp') && !permPurch && role !== 'admin';
    if (isStrictCoordinator) {
      try {
        localStorage.setItem('gan_app_mode', 'coordinator');
        localStorage.setItem('gan_user_role', role);
      } catch (e) {}
      document.documentElement.classList.add('isolated-mode');

      const authOverlay = document.getElementById('auth-overlay');
      if (authOverlay) authOverlay.style.display = 'none';
      // Data must load first, then activate (core_app.js now safely skips admin rendering)
      if (typeof window._onAuthReady === 'function') window._onAuthReady();
      // Poll until GARDENS and Firebase sync are loaded, then activate coordinator app
      let _coordPollCount = 0;
      const _coordPoll = setInterval(() => {
        _coordPollCount++;
        const gardensReady = window.GARDENS && window.GARDENS.length > 0;
        const fbReady = window._fbSyncReady;
        if ((gardensReady && fbReady) || _coordPollCount >= 20) {
          clearInterval(_coordPoll);
          if (typeof window.activateCoordinatorApp === 'function') {
            window.activateCoordinatorApp();
          }
          const sysLoad = document.getElementById('system-loading-overlay');
          if (sysLoad) { sysLoad.style.opacity = '0'; setTimeout(()=>sysLoad.style.display='none',200); }
        }
      }, 100);
      return;
    }

    try {
      localStorage.removeItem('gan_app_mode');
      localStorage.setItem('gan_user_role', role);
      document.documentElement.classList.remove('isolated-mode');
    } catch (e) {}

    const authOverlay = document.getElementById('auth-overlay');
    if (authOverlay) authOverlay.style.display = 'none';
    const uname = document.getElementById('auth-user-name');
    if (uname) uname.textContent = '👤 ' + user.email.replace('@ganmanager.app', '');
    const matzavaBtn = document.getElementById('modeBtn-matzava');
    if (matzavaBtn) matzavaBtn.style.display = (window.permMatzava !== false || role === 'admin') ? '' : 'none';
    // Show admin UI immediately after login
    if (typeof window._initUsersUI === 'function') window._initUsersUI();
    if (typeof window._onAuthReady === 'function') window._onAuthReady();
    const sysLoad = document.getElementById('system-loading-overlay');
    if (sysLoad) { sysLoad.style.opacity = '0'; setTimeout(()=>sysLoad.style.display='none',300); }
  } else {
    window._fbUser = null;
    window._cachedToken = null;
    window.permPurch = false;
    window.permAct = false;
    window.permMatzava = true;
    window.role = null;
    try {
      localStorage.removeItem('gan_app_mode');
      localStorage.removeItem('gan_user_role');
      document.documentElement.classList.remove('isolated-mode');
    } catch (e) {}
    const authOverlay = document.getElementById('auth-overlay');
    if (authOverlay) authOverlay.style.display = 'flex';
    const sysLoad = document.getElementById('system-loading-overlay');
    if (sysLoad) sysLoad.style.display = 'none';
  }
});
