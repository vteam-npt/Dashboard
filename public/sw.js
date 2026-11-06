const CACHE='vivo-app-shell-v2';
const scope=self.registration.scope;
const offlineUrl=new URL('offline.html',scope).href;
const shellUrl=new URL('./',scope).href;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([offlineUrl,shellUrl])).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('vivo-offline-')||key.startsWith('vivo-app-shell-'))&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.mode!=='navigate'||url.origin!==self.location.origin||!url.href.startsWith(scope))return;
 const isShell=url.pathname===new URL(scope).pathname||url.pathname===new URL('index.html',scope).pathname;
 if(!isShell)return;
 event.respondWith(fetch(event.request).then(async response=>{if(response.ok&&response.type!=='opaque'){const cache=await caches.open(CACHE);await cache.put(shellUrl,response.clone());}return response;}).catch(async()=>await caches.match(shellUrl)||await caches.match(offlineUrl)));
});
