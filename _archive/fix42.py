import os

with open('firebase_init.js', 'r', encoding='utf-8') as f:
    fb_init = f.read()

# 1. Add imports for database
target_imports = """import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword,
  setPersistence, browserLocalPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";"""

rep_imports = """import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword,
  setPersistence, browserLocalPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";"""

if target_imports in fb_init:
    fb_init = fb_init.replace(target_imports, rep_imports)

# 2. Add RTDB initialization and listener
target_init = """const auth = getAuth(app);

// Secondary app instance"""

rep_init = """const auth = getAuth(app);
const db = getDatabase(app);

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

// Secondary app instance"""

if target_init in fb_init:
    fb_init = fb_init.replace(target_init, rep_init)

with open('firebase_init.js', 'w', encoding='utf-8') as f:
    f.write(fb_init)
print("firebase_init.js RTDB listener patched")
