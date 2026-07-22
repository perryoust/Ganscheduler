const fs = require('fs');
let code = fs.readFileSync('core_dash.js', 'utf8');

const target = `// ─── PWA Service Worker registration ──────────────────
if('serviceWorker' in navigator){
  const swCode=\`
const CACHE='kids-v2';
const ASSETS=[location.pathname];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('fetch',e=>e.respondWith(
  caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
    if(res.ok){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));}
    return res;
  }).catch(()=>caches.match(e.request)))
));
\`;
  const blob = new Blob([swCode], {type:'text/javascript'});
  const swUrl = URL.createObjectURL(blob);
  navigator.serviceWorker.register(swUrl).catch(()=>{});
}`;

const replacement = `// ─── PWA Service Worker registration (DISABLED) ──────────────────
if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
    }
  });
}`;

code = code.replace(target, replacement);
fs.writeFileSync('core_dash.js', code);
console.log('Fixed SW in core_dash.js');
