import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword,
  setPersistence, browserLocalPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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
  // Check for worker fast-track
  if (window._safeLS && window._safeLS.getItem('ganv5_auth_user') === 'worker') {
    const authOverlay = document.getElementById('auth-overlay');
    if (authOverlay) authOverlay.style.display = 'none';
    if (typeof window.activateWorkerApp === 'function') {
      window.activateWorkerApp();
    }
    return;
  }

  if (user) {
    window._fbUser = user;
    try { window._cachedToken = await user.getIdToken(false); } catch (e) { window._cachedToken = null; }
    
    // Load User Permissions
    const ADMIN_UID = 'VW5FCIlBb9VS4Eo1BTKyCxq5xa03';
    let permPurch = false;
    let permAct = true;
    let role = 'view';
    if (user.uid === ADMIN_UID) {
      permPurch = true;
      permAct = true;
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
            role = profile.role || 'view';
          }
        }
      } catch (e) {
        console.warn('Failed to load user permissions:', e);
      }
    }
    window.permPurch = permPurch;
    window.permAct = permAct;
    window.role = role;

    const authOverlay = document.getElementById('auth-overlay');
    if (authOverlay) authOverlay.style.display = 'none';
    const uname = document.getElementById('auth-user-name');
    if (uname) uname.textContent = '👤 ' + user.email.replace('@ganmanager.app', '');
    // Show admin UI immediately after login
    if (typeof window._initUsersUI === 'function') window._initUsersUI();
    if (typeof window._onAuthReady === 'function') window._onAuthReady();
  } else {
    window._fbUser = null;
    window._cachedToken = null;
    window.permPurch = false;
    window.permAct = false;
    window.role = null;
    const authOverlay = document.getElementById('auth-overlay');
    if (authOverlay) authOverlay.style.display = 'flex';
  }
});
