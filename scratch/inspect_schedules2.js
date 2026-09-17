const fs = require('fs');

const API_KEY = "AIzaSyDiUrCk_eOQ_bmAc1ZCXrSaelG-HpaTLfA";
const EMAIL = "perry@ganmanager.app";
const PASSWORD = "pe5178";

async function run() {
  console.log('=== AUTHENTICATING WITH FIREBASE ===');
  try {
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true })
    });
    
    if (!authRes.ok) throw new Error('Auth failed');
    const token = (await authRes.json()).idToken;
    console.log('Token acquired.');
    
    const dbUrl = 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app';
    
    console.log('Fetching clusters...');
    const mRes = await fetch(`${dbUrl}/data/clusters.json?auth=${token}`);
    const clustersObj = await mRes.json();
    const clusters = Object.values(clustersObj || {});
    const cluster1 = clusters.find(m => (m.name||'').includes('ראש העין - 1'));
    console.log('Cluster 1:', cluster1 ? cluster1.name : 'Not found', cluster1 ? cluster1.gardenIds : '');
    
    console.log('\nFetching sch (2026-09-22)...');
    const schRes = await fetch(`${dbUrl}/sch.json?auth=${token}&orderBy="d"&equalTo="2026-09-22"`);
    const sch = await schRes.json();
    
    if (cluster1 && cluster1.gardenIds) {
        for (const [key, s] of Object.entries(sch || {})) {
            if (cluster1.gardenIds.includes(String(s.g))) {
                console.log(`Placement on 22/09 for Garden ${s.g}:`, s);
            }
        }
    }
    
    console.log('\nFetching supBaseEx...');
    const bRes = await fetch(`${dbUrl}/supBaseEx.json?auth=${token}`);
    const supBaseEx = await bRes.json();
    
    if (cluster1 && cluster1.gardenIds) {
       for (const gid of cluster1.gardenIds) {
           const keys = Object.keys(supBaseEx || {}).filter(k => k.includes('_'+gid+'_') && k.endsWith('_2'));
           console.log(`Garden ${gid} recurring schedules (Tuesday):`);
           for (const key of keys) {
               console.log(' -', key, supBaseEx[key]);
           }
       }
    }
  } catch(e) {
    console.error('Error:', e.message);
  }
}
run();
