const fs = require('fs');
async function run() {
    const { getDatabase, ref, get } = require('firebase/database');
    const { initializeApp } = require('firebase/app');

    const app = initializeApp({ databaseURL: 'https://ganmanage-free-default-rtdb.europe-west1.firebasedatabase.app' });
    const db = getDatabase(app);
    
    console.log('Fetching managers...');
    const manSnap = await get(ref(db, 'managers'));
    const managers = manSnap.val() || [];
    
    console.log('Fetching sch...');
    const schSnap = await get(ref(db, 'sch'));
    const sch = Object.values(schSnap.val() || {});

    // Rosh HaAyin Cluster 1
    const cluster1 = managers.find(m => m.name.includes('ראש העין - 1'));
    console.log('Cluster 1 Gardens:', cluster1 ? cluster1.gardenIds : 'Not found');
    
    console.log('\nPlacements for 22/09/2026 in Rosh HaAyin Cluster 1:');
    if (cluster1 && cluster1.gardenIds) {
        const evs = sch.filter(s => s.d === '2026-09-22' && cluster1.gardenIds.includes(String(s.g)));
        console.log(evs);
    }
    
    console.log('\nChecking supBaseEx for these gardens:');
    const supBaseSnap = await get(ref(db, 'supBaseEx'));
    const supBaseEx = supBaseSnap.val() || {};
    
    if (cluster1 && cluster1.gardenIds) {
       for (const gid of cluster1.gardenIds) {
           const keys = Object.keys(supBaseEx).filter(k => k.includes('_'+gid+'_') && k.endsWith('_2')); // Tuesday = 2
           console.log(`Garden ${gid} recurring schedules (Tuesday):`);
           for (const key of keys) {
               console.log(' -', key, supBaseEx[key]);
           }
       }
    }
    process.exit(0);
}
run();
